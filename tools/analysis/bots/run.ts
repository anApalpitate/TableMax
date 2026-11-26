import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
    setup: { type: 'string' },
    'uno-calibration': { type: 'string' },
    'uno-samples': { type: 'string' },
    'uno-correction': { type: 'string' },
  },
});
const selected = values.game;
if (!selected || !values.seeds || !values.levels)
  throw new Error(
    'Usage: node --import tsx tools/analysis/bots/run.ts --game=<game-id> [--variant=<variant-id>] --seeds=41,42 --levels=default,doubao [--max-steps=15000] [--setup=<JSON>] [--uno-calibration=<JSON-path> --uno-samples=8|16 --uno-correction=<JSON-path>]',
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
  if (samples !== 8 && samples !== 16)
    throw new Error('UNO search uses 8 or 16 samples');
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
console.log(
  JSON.stringify({
    type: 'batch',
    game: rules.manifest,
    variantId: loaded.variantId,
    strategy: strategy.version,
    seeds,
    levels: seats.map(({ difficulty }) => difficulty),
    setup: setup ?? rules.setup?.defaults,
    maxSteps,
  }),
);
for (const seed of seeds) {
  try {
    const result = await evaluateBotMatch(
      { rules, seats, seed, ...(setup === undefined ? {} : { setup }) },
      { maxSteps },
    );
    console.log(
      JSON.stringify({
        type: 'match',
        seed,
        outcome: result.outcome,
        steps: result.checkpoint.steps,
        inputDigest: result.checkpoint.match,
        traceDigest: result.checkpoint.traceDigest,
        result: result.publicResult,
      }),
    );
    if (result.outcome !== 'ended') process.exitCode = 1;
  } catch (error) {
    console.log(
      JSON.stringify({
        type: 'match',
        seed,
        outcome: 'failed',
        reason:
          error instanceof Error ? error.message : 'Unknown evaluation error',
      }),
    );
    process.exitCode = 1;
  }
}
