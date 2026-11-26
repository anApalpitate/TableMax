import { isUnoSearchSamples } from '../../../games/uno/bot/search-budget';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createUnoSearchStrategy } from '../../../games/uno/bot/search-strategy';
import { BotDifficultySchema } from '../../../packages/protocol/src/index';
import { createGameRegistry } from '../../../apps/server/src/game-registry';
import { evaluateBotMatch } from './evaluate';
import { matchesUnoCorrectionCalibration } from './uno-correction-provenance';

const { values } = parseArgs({
  options: {
    game: { type: 'string' },
    variant: { type: 'string' },
    seeds: { type: 'string' },
    levels: { type: 'string' },
    'max-steps': { type: 'string' },
    jobs: { type: 'string', default: '1' },
    setup: { type: 'string' },
    'uno-calibration': { type: 'string' },
    'uno-samples': { type: 'string' },
    'uno-correction': { type: 'string' },
  },
});
const selected = values.game;
if (!selected || !values.seeds || !values.levels)
  throw new Error(
    'Usage: node --import tsx tools/analysis/bots/run.ts --game=<game-id> [--variant=<variant-id>] --seeds=41,42 --levels=default,doubao [--max-steps=15000] [--jobs=1] [--setup=<JSON>] [--uno-calibration=<JSON-path> --uno-samples=8|16|32 --uno-correction=<JSON-path>]',
  );
const jobs = Number(values.jobs);
const maximumJobs = Math.min(8, Math.max(1, availableParallelism() - 2));
if (!Number.isInteger(jobs) || jobs < 1 || jobs > maximumJobs)
  throw new Error(
    'Offline evaluation jobs must be between 1 and ' + maximumJobs,
  );
const loaded = await createGameRegistry().load(selected, values.variant);
const { rules } = loaded;
let strategy = loaded.bot;
if (values['uno-calibration']) {
  if (selected !== 'uno')
    throw new Error('This calibration only applies to UNO');
  const bytes = readFileSync(values['uno-calibration']);
  const input = JSON.parse(bytes.toString('utf8'));
  const correctionBytes = values['uno-correction']
    ? readFileSync(values['uno-correction'])
    : null;
  const candidate =
    correctionBytes && JSON.parse(correctionBytes.toString('utf8'));
  const candidateReport = candidate?.type === 'uno-residual-candidate';
  const frozen =
    candidateReport && candidate.calibrationReportSha256 !== undefined;
  const samples = Number(
    values['uno-samples'] ?? (frozen ? input?.options?.hypotheses : 16),
  );
  if (!isUnoSearchSamples(samples))
    throw new Error('UNO search uses an upper limit of 8, 16, or 32 samples');
  if (
    frozen &&
    (!matchesUnoCorrectionCalibration(
      candidate,
      input,
      createHash('sha256').update(bytes).digest('hex'),
    ) ||
      candidate.options?.hypotheses !== samples)
  )
    throw new Error(
      'The UNO candidate requires its exact calibration report and search sample budget',
    );
  const correction = correctionBytes
    ? {
        model: candidateReport ? candidate.model : candidate,
        digest: createHash('sha256').update(correctionBytes).digest('hex'),
      }
    : undefined;
  strategy = createUnoSearchStrategy(
    input?.type === 'uno-calibration-development' ? input.calibration : input,
    createHash('sha256')
      .update(
        JSON.stringify(
          input?.type === 'uno-calibration-development'
            ? input.calibration
            : input,
        ),
      )
      .digest('hex'),
    samples,
    correction,
  );
} else if (
  values['uno-samples'] !== undefined ||
  values['uno-correction'] !== undefined
) {
  throw new Error('UNO search options require a calibration file');
}
const seeds = values.seeds.split(',').map(Number);
if (
  new Set(seeds).size !== seeds.length ||
  seeds.some((seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff)
)
  throw new Error('Seeds must be unique positive unsigned 32-bit integers');
const seats = values.levels.split(',').map((level, index) => ({
  id: `seat-${index + 1}`,
  strategy,
  difficulty: BotDifficultySchema.parse(level),
}));
const setup = values.setup === undefined ? undefined : JSON.parse(values.setup);
const maxSteps = Number(values['max-steps'] ?? 15000);
const batch = {
  type: 'batch',
  game: rules.manifest,
  variantId: loaded.variantId,
  strategy: strategy.version,
  seeds,
  levels: seats.map(({ difficulty }) => difficulty),
  setup: setup ?? rules.setup?.defaults,
  maxSteps,
};

function failedMatch(seed: number, reason: string) {
  return { type: 'match', seed, outcome: 'failed', reason };
}

async function evaluate(seed: number) {
  try {
    const result = await evaluateBotMatch(
      { rules, seats, seed, ...(setup === undefined ? {} : { setup }) },
      { maxSteps },
    );
    return {
      type: 'match',
      seed,
      outcome: result.outcome,
      steps: result.checkpoint.steps,
      inputDigest: result.checkpoint.match,
      traceDigest: result.checkpoint.traceDigest,
      result: result.publicResult,
    };
  } catch (error) {
    return failedMatch(
      seed,
      error instanceof Error ? error.message : 'Unknown evaluation error',
    );
  }
}

type Match = Awaited<ReturnType<typeof evaluate>>;

function isMatch(value: unknown, seed: number): value is Match {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.type === 'match' &&
    record.seed === seed &&
    ['ended', 'step-limit', 'cancelled', 'failed'].includes(
      String(record.outcome),
    )
  );
}

async function evaluateGroup(
  assigned: number[],
  args: readonly string[],
  signal: AbortSignal,
): Promise<Match[]> {
  const output: Buffer[] = [];
  try {
    const worker = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        fileURLToPath(import.meta.url),
        ...args,
        '--seeds=' + assigned.join(','),
      ],
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, signal },
    );
    worker.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    await once(worker, 'close');
  } catch {
    return assigned.map((seed) =>
      failedMatch(seed, 'Offline seed worker stopped'),
    );
  }

  const [header, ...lines] = Buffer.concat(output)
    .toString('utf8')
    .trim()
    .split(/\r?\n/);
  if (header !== JSON.stringify({ ...batch, seeds: assigned })) {
    return assigned.map((seed) =>
      failedMatch(seed, 'Offline seed worker input differs'),
    );
  }

  return assigned.map((seed, index) => {
    try {
      const value: unknown = JSON.parse(lines[index] ?? '');
      if (isMatch(value, seed)) return value;
    } catch {
      // A stopped worker may leave an incomplete final line.
    }
    return failedMatch(
      seed,
      'Offline seed worker did not return a valid match',
    );
  });
}

function report(match: Match) {
  console.log(JSON.stringify(match));
  if (match.outcome !== 'ended') process.exitCode = 1;
}

console.log(JSON.stringify(batch));
if (jobs === 1 || seeds.length < 2) {
  for (const seed of seeds) report(await evaluate(seed));
} else {
  const groupSize = 8;
  const args = Object.entries(values).flatMap(([option, value]) =>
    value === undefined || option === 'seeds' || option === 'jobs'
      ? []
      : ['--' + option + '=' + value],
  );
  const controller = new AbortController();
  const stop = () => {
    process.exitCode = 1;
    controller.abort();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    for (
      let start = 0;
      start < seeds.length && !controller.signal.aborted;
      start += jobs * groupSize
    ) {
      const windowSeeds = seeds.slice(start, start + jobs * groupSize);
      const count = Math.min(jobs, windowSeeds.length);
      const results = await Promise.all(
        Array.from({ length: count }, (_, index) => {
          const from = Math.floor((index * windowSeeds.length) / count);
          const to = Math.floor(((index + 1) * windowSeeds.length) / count);
          return evaluateGroup(
            windowSeeds.slice(from, to),
            args,
            controller.signal,
          );
        }),
      );
      for (const match of results.flat()) report(match);
    }
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}
