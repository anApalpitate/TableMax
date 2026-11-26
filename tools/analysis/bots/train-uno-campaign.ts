import { isUnoSearchSamples } from '../../../games/uno/bot/search-budget';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import {
  assertLearningBudget,
  learningJobByteLimit,
} from '../../../packages/platform-core/src/learning-storage';
import { calibrationSeeds } from './uno-calibration-provenance';
import { matchesUnoCorrectionCalibration } from './uno-correction-provenance';
import { correctionSeeds } from './uno-correction-seeds';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';
import { unoResidualSourceDigest } from './uno-residual-source';

interface Run {
  id: string;
  trainSeeds: number[];
  tuneSeeds: number[];
}
interface Plan {
  version: 1;
  runs: Run[];
  roots: number;
  continuations: number;
  maxSteps: number;
}

const sha = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
const { values } = parseArgs({
  options: {
    plan: { type: 'string' },
    calibration: { type: 'string' },
    'work-dir': { type: 'string' },
    jobs: { type: 'string', default: '1' },
    'steps-per-run': { type: 'string' },
  },
});
if (!values.plan || !values.calibration || !values['work-dir'])
  throw new Error(
    'Provide the independent C plan, qualified B report and existing work directory',
  );
function read(path: string, limit = 1024 * 1024) {
  const file = lstatSync(path);
  if (!file.isFile() || file.isSymbolicLink() || file.size > limit)
    throw new Error('Invalid local C campaign input');
  const bytes = readFileSync(path);
  if (bytes.length > limit)
    throw new Error('C campaign input grew during read');
  return {
    bytes,
    value: JSON.parse(bytes.toString('utf8')),
    sha256: sha(bytes),
  };
}
const calibration = read(values.calibration);
const b = calibration.value;
if (
  b?.type !== 'uno-calibration-development' ||
  !isCurrentUnoPilot(b.pilot) ||
  b.evaluation !== 'meets-measured-gates' ||
  b.calibrationDigest !== sha(JSON.stringify(b.calibration)) ||
  !isUnoSearchSamples(b.options?.hypotheses)
)
  throw new Error(
    'Independent C training requires a B report meeting the measured calibration gates',
  );

const planned = read(values.plan);
const plan = planned.value as Plan;
if (
  plan?.version !== 1 ||
  !Array.isArray(plan.runs) ||
  plan.runs.length < 2 ||
  [plan.roots, plan.continuations, plan.maxSteps].some(
    (n) => !Number.isSafeInteger(n) || n < 1,
  ) ||
  plan.runs.some(
    (run) =>
      typeof run?.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(run.id),
  ) ||
  new Set(plan.runs.map(({ id }) => id)).size !== plan.runs.length
)
  throw new Error('Invalid independent C campaign plan');
const seeds = plan.runs.flatMap((run) => correctionSeeds(run));
const bSeeds = new Set(calibrationSeeds(b));
if (
  new Set(seeds).size !== seeds.length ||
  seeds.some((seed) => bSeeds.has(seed))
)
  throw new Error(
    'All C runs must use distinct training and tuning seeds outside B calibration',
  );
const jobs = Number(values.jobs);
const steps = Number(values['steps-per-run']);
const maxJobs = Math.min(8, Math.max(1, availableParallelism() - 2));
if (
  !Number.isSafeInteger(jobs) ||
  jobs < 1 ||
  jobs > maxJobs ||
  (values['steps-per-run'] !== undefined &&
    (!Number.isSafeInteger(steps) || steps < 1))
)
  throw new Error('Invalid C campaign work limit');
const directory = resolve(values['work-dir']);
function requireDirectory(path: string) {
  const item = lstatSync(path);
  if (!item.isDirectory() || item.isSymbolicLink())
    throw new Error('Expected an isolated local work directory');
}
requireDirectory(directory);
function frozenFile(path: string, bytes: Buffer) {
  const old = lstatSync(path, { throwIfNoEntry: false });
  if (old) {
    if (!read(path).bytes.equals(bytes))
      throw new Error('The C campaign frozen inputs changed');
    return;
  }
  assertLearningBudget(directory, bytes.length, learningJobByteLimit);
  const staging = path + '.' + randomUUID() + '.tmp';
  writeFileSync(staging, bytes, { flag: 'wx', flush: true, mode: 0o600 });
  try {
    linkSync(staging, path);
  } finally {
    unlinkSync(staging);
  }
}
const sourceSha256 = unoResidualSourceDigest();
const trainer = fileURLToPath(
  new URL('./train-uno-correction.ts', import.meta.url),
);
const descriptor = {
  type: 'uno-campaign-frozen-inputs',
  version: 1,
  pilot: unoPilotEvidence,
  planSha256: planned.sha256,
  calibrationReportSha256: calibration.sha256,
  sourceSha256,
  launcherSha256: sha(readFileSync(new URL(import.meta.url))),
  node: process.version,
  plan,
};
const frozenCalibration = join(directory, 'calibration.json');
frozenFile(
  join(directory, 'campaign.json'),
  Buffer.from(JSON.stringify(descriptor, null, 2) + '\n'),
);
frozenFile(frozenCalibration, calibration.bytes);

async function runTrainer(args: string[]) {
  const child = spawn(process.execPath, ['--import', 'tsx', trainer, ...args], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise<Buffer>((accept, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        child.kill();
        reject(new Error('The C candidate report exceeded its format limit'));
        return;
      }
      chunks.push(chunk);
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) accept(Buffer.concat(chunks));
      else
        reject(new Error('A C training run ended before producing a result'));
    });
  });
}

const completed = [];
for (const [index, run] of plan.runs.entries()) {
  const relatedSeeds = plan.runs
    .filter((_, at) => at !== index)
    .flatMap((peer) => correctionSeeds(peer));
  const dir = join(directory, run.id);
  if (!lstatSync(dir, { throwIfNoEntry: false })) mkdirSync(dir);
  requireDirectory(dir);
  const output = join(dir, 'candidate.json');
  const old = lstatSync(output, { throwIfNoEntry: false });
  const fresh = old
    ? null
    : await runTrainer([
        '--calibration=' + frozenCalibration,
        '--train-seeds=' + run.trainSeeds.join(','),
        '--tune-seeds=' + run.tuneSeeds.join(','),
        '--related-seeds=' + relatedSeeds.join(','),
        '--roots=' + plan.roots,
        '--continuations=' + plan.continuations,
        '--max-steps=' + plan.maxSteps,
        '--jobs=' + jobs,
        '--jobs-root=' + directory,
        '--checkpoint=' + join(dir, 'checkpoint.json'),
        ...(values['steps-per-run'] === undefined
          ? []
          : ['--steps-per-run=' + steps]),
      ]);
  const candidate = fresh
    ? JSON.parse(fresh.toString('utf8'))
    : read(output).value;
  if (fresh && candidate.type === 'uno-residual-progress') {
    console.log(
      JSON.stringify({
        type: 'uno-residual-campaign-progress',
        run: run.id,
        completed,
        training: candidate,
      }),
    );
    break;
  }
  if (
    !matchesUnoCorrectionCalibration(candidate, b, calibration.sha256) ||
    !isCurrentUnoPilot(candidate.pilot) ||
    candidate.node !== process.version ||
    candidate.sourceSha256 !== sourceSha256 ||
    !isDeepStrictEqual(candidate.options, {
      roots: plan.roots,
      hypotheses: b.options.hypotheses,
      continuations: plan.continuations,
      maxSteps: plan.maxSteps,
    }) ||
    !isDeepStrictEqual(candidate.trainSeeds, run.trainSeeds) ||
    !isDeepStrictEqual(candidate.tuneSeeds, run.tuneSeeds) ||
    !isDeepStrictEqual(candidate.relatedSeeds, relatedSeeds) ||
    candidate.localCorpus !== null ||
    unoResidualSourceDigest() !== sourceSha256
  )
    throw new Error('C candidate does not match the frozen campaign');
  if (fresh) frozenFile(output, fresh);
  completed.push({
    id: run.id,
    candidate: output,
    sha256: sha(readFileSync(output)),
    trainingRows: candidate.trainingRows,
    tuneResults: candidate.tuneResults,
    weight: candidate.model?.weight,
    cap: candidate.model?.cap,
  });
}
if (completed.length === plan.runs.length)
  console.log(
    JSON.stringify(
      {
        type: 'uno-residual-campaign',
        calibrationReportSha256: calibration.sha256,
        planSha256: planned.sha256,
        completed,
      },
      null,
      2,
    ),
  );
