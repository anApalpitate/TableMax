import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fitUnoOnGpu } from './uno-gpu-fit';
import { readTrainingLease } from '../../../packages/platform-core/src/training-lease';
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { parseArgs, promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  assertLearningBudget,
  learningJobByteLimit,
} from '../../../packages/platform-core/src/learning-storage';
import { loadUnoLeafScorer } from '../../../games/uno/bot/calibration';
import {
  unoCorrectedBest,
  unoCorrectionFeatureNames,
  unoSearchBest,
  type UnoCorrectionModel,
} from '../../../games/uno/bot/correction';
import {
  collectUnoResidualSeed,
  type UnoResidualPosition,
  type UnoResidualSeed,
} from './uno-residual-seed';
import { fitModel, type WeightedExample } from './fit';
import { collectUnoResidualExamples } from './uno-residual-labels';
import {
  readUnoLearningCorpus,
  unoLearningQualityWeights,
} from './local-uno-corpus';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';
import { calibrationSeeds } from './uno-calibration-provenance';
import { openTrainingCheckpoint } from './training-checkpoint';
import { unoResidualSourceDigest as sourceDigest } from './uno-residual-source';
import { bot } from '../../../games/uno/bot/index';
import {
  pairedUnoDifferences,
  type UnoRoot,
  type UnoSampleOptions,
} from './uno-samples';

function seedList(value: string | undefined) {
  const values = value?.split(',').map(Number);
  if (
    !values?.length ||
    new Set(values).size !== values.length ||
    values.some(
      (seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff,
    )
  )
    throw new Error('Pass unique positive 32-bit seeds');
  return values;
}

const { values } = parseArgs({
  options: {
    calibration: { type: 'string' },
    'learning-log': { type: 'string' },
    'learning-review': { type: 'string' },
    'learning-source-weight': { type: 'string', default: 'graded' },
    checkpoint: { type: 'string' },
    'steps-per-run': { type: 'string' },
    'idle-lease': { type: 'string' },
    'idle-session': { type: 'string' },
    'jobs-root': { type: 'string' },
    jobs: { type: 'string', default: '1' },
    'train-seeds': { type: 'string' },
    'tune-seeds': { type: 'string' },
    'related-seeds': { type: 'string' },
    roots: { type: 'string', default: '2' },
    continuations: { type: 'string', default: '16' },
    'max-steps': { type: 'string', default: '15000' },
  },
});
const leasePath = values['idle-lease'];
const leaseSession = values['idle-session'];
if (Boolean(leasePath) !== Boolean(leaseSession))
  throw new Error(
    'Provide both idle lease and session when using the local watcher',
  );
const maximumJobs = Math.min(8, Math.max(1, availableParallelism() - 2));
const jobs = Number(values.jobs);
if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > maximumJobs)
  throw new Error('Choose between 1 and ' + maximumJobs + ' residual jobs');
if (leasePath && jobs !== 1)
  throw new Error('Idle training uses one local residual job');
let nextLeaseRead = 0;
function checkIdle(force = false) {
  if (!leasePath) return;
  const now = Date.now();
  if (!force && now < nextLeaseRead) return;
  nextLeaseRead = now + 125;
  const lease = readTrainingLease(leasePath, now);
  if (!lease?.allowed || lease.session !== leaseSession)
    throw new Error('UNO_IDLE_TRAINING_PAUSED');
}
checkIdle(true);
if (!values.calibration)
  throw new Error('Pass a frozen UNO B calibration report');
const calibrationBytes = readFileSync(values.calibration);
const report = JSON.parse(calibrationBytes.toString('utf8'));
const sha = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
const calibrationReportSha256 = sha(calibrationBytes);
const hypotheses = report?.options?.hypotheses;
if (
  report?.type !== 'uno-calibration-development' ||
  !isCurrentUnoPilot(report.pilot) ||
  report?.evaluation !== 'meets-measured-gates' ||
  !Array.isArray(report.trainSeeds) ||
  !Array.isArray(report.holdoutSeeds) ||
  (hypotheses !== 8 && hypotheses !== 16)
)
  throw new Error(
    'UNO correction training requires a B report meeting the measured calibration gates',
  );
const calibrationDigest = createHash('sha256')
  .update(JSON.stringify(report.calibration))
  .digest('hex');
if (report.calibrationDigest !== calibrationDigest)
  throw new Error('The B calibration digest does not match the frozen report');
loadUnoLeafScorer(report.calibration);
const trainSeeds = seedList(values['train-seeds']);
const tuneSeeds = seedList(values['tune-seeds']);
const relatedSeeds =
  values['related-seeds'] === undefined
    ? []
    : seedList(values['related-seeds']);
const previous = calibrationSeeds(report);
const excluded = new Set([...previous, ...relatedSeeds]);
if (excluded.size !== previous.length + relatedSeeds.length)
  throw new Error('Related C seeds must be separate from B calibration seeds');
if (
  trainSeeds.some((seed) => excluded.has(seed)) ||
  tuneSeeds.some((seed) => excluded.has(seed) || trainSeeds.includes(seed))
)
  throw new Error(
    'C training and tuning must use separate seed pools outside B calibration',
  );
const options: UnoSampleOptions = {
  roots: Number(values.roots),
  hypotheses,
  continuations: Number(values.continuations),
  maxSteps: Number(values['max-steps']),
};
if (
  [options.roots, options.continuations, options.maxSteps].some(
    (value) => !Number.isSafeInteger(value) || value < 1,
  )
)
  throw new Error('Invalid correction training budget');

const sourceWeight = values['learning-source-weight'];
if (sourceWeight !== 'graded' && sourceWeight !== 'uniform')
  throw new Error('Choose graded or uniform local source weights');
if (values['learning-review'] && !values['learning-log'])
  throw new Error('UNO human review requires its exact --learning-log');
const corpus = values['learning-log']
  ? readUnoLearningCorpus(
      values['learning-log'],
      options.roots,
      values['learning-review'],
    )
  : null;
const occupiedSeeds = new Set([...excluded, ...trainSeeds, ...tuneSeeds]);
for (const entry of corpus?.entries ?? []) {
  if (occupiedSeeds.has(entry.seed))
    throw new Error('Local learning group overlaps a model evaluation seed');
  occupiedSeeds.add(entry.seed);
}
const localRoots = new Map(
  (corpus?.entries ?? []).map(({ seed, roots }) => [seed, roots]),
);
const localWeights = new Map<UnoRoot, number>();
if (sourceWeight === 'graded') {
  for (const roots of localRoots.values())
    for (const root of roots)
      localWeights.set(root, unoLearningQualityWeights[root.qualityTier]);
}
type GpuFit = { coefficients: number[]; device: string; torch: string };
type Checkpoint = {
  training: WeightedExample[];
  trainingUnfinished: number;
  trainingSeeds: number[];
  tuningSeeds: number[];
  tuning: UnoResidualPosition[][];
  fit?: GpuFit;
};
const work = [...trainSeeds, ...localRoots.keys()];
const initial: Checkpoint = {
  training: [],
  trainingUnfinished: 0,
  trainingSeeds: [],
  tuningSeeds: [],
  tuning: [],
};
const sourceSha256 = sourceDigest();
const identity = createHash('sha256')
  .update(
    JSON.stringify({
      revision: 2,
      sourceSha256,
      node: process.version,
      calibrationReportSha256,
      strategy: bot.version,
      features: unoCorrectionFeatureNames,
      calibrationDigest,
      work,
      tuneSeeds,
      ...(relatedSeeds.length ? { relatedSeeds } : {}),
      options,
      corpus: corpus?.inputDigest,
      ...(corpus
        ? {
            provenance: {
              version: 1,
              reviewDigest: corpus.reviewDigest,
              sourceWeight,
            },
          }
        : {}),
    }),
  )
  .digest('hex');
const jobsRoot = values['jobs-root'] && resolve(values['jobs-root']);
if (
  jobsRoot &&
  (!values.checkpoint ||
    dirname(dirname(resolve(values.checkpoint))) !== jobsRoot)
)
  throw new Error(
    'Training checkpoint must stay in its configured job directory',
  );
const checkpoint = values.checkpoint
  ? openTrainingCheckpoint(
      values.checkpoint,
      identity,
      initial,
      jobsRoot
        ? (bytes) => assertLearningBudget(jobsRoot, bytes, learningJobByteLimit)
        : undefined,
    )
  : null;
const state = checkpoint?.state ?? initial;
if (
  !Array.isArray(state.training) ||
  !Array.isArray(state.trainingSeeds) ||
  !Array.isArray(state.tuningSeeds) ||
  !Array.isArray(state.tuning) ||
  state.tuning.length !== state.tuningSeeds.length ||
  state.trainingSeeds.some((seed, index) => seed !== work[index]) ||
  state.tuningSeeds.some((seed, index) => seed !== tuneSeeds[index]) ||
  (state.fit !== undefined && state.trainingSeeds.length !== work.length) ||
  (state.fit === undefined && state.tuningSeeds.length > 0)
)
  throw new Error('Training checkpoint has invalid stage boundaries');
let remaining =
  values['steps-per-run'] === undefined
    ? Infinity
    : Number(values['steps-per-run']);
if (
  values['steps-per-run'] !== undefined &&
  (!checkpoint || !Number.isSafeInteger(remaining) || remaining < 1)
)
  throw new Error('A positive step limit requires --checkpoint');
async function reserveUnits(limit = 1): Promise<number> {
  checkIdle(true);
  if (remaining > 0) {
    const units = Math.min(remaining, limit);
    remaining -= units;
    return units;
  }
  await new Promise<void>((done, fail) => {
    process.stdout.write(
      JSON.stringify({
        type: 'uno-residual-progress',
        state: 'paused',
        identity,
        labelledSeeds: state.trainingSeeds.length,
        totalLabelSeeds: work.length,
        tunedSeeds: state.tuningSeeds.length,
        totalTuneSeeds: tuneSeeds.length,
        fitted: state.fit !== undefined,
      }) + '\n',
      (error) => (error ? fail(error) : done()),
    );
  });
  process.exit(0);
}
function assertSource() {
  if (sourceDigest() !== sourceSha256)
    throw new Error('Correction training source changed during the frozen run');
}
const worker = fileURLToPath(
  new URL('./uno-residual-worker.ts', import.meta.url),
);
const exec = promisify(execFile);
async function collectInChild(task: UnoResidualSeed, signal: AbortSignal) {
  const { stdout } = await exec(
    process.execPath,
    ['--import', 'tsx', worker, JSON.stringify(task)],
    { windowsHide: true, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, signal },
  );
  const result = JSON.parse(stdout) as {
    seed: number;
    positions: UnoResidualPosition[];
  };
  if (
    result.seed !== task.seed ||
    !Array.isArray(result.positions) ||
    result.positions.some((position) => position.root?.seed !== task.seed)
  )
    throw new Error('Residual worker returned a different seed');
  return result.positions;
}
async function processSeeds(
  seeds: readonly number[],
  salt: number,
  record: (seed: number, positions: UnoResidualPosition[]) => void,
) {
  const stopped = new AbortController();
  const stop = () =>
    stopped.abort(new Error('UNO residual labeling interrupted'));
  if (jobs > 1) {
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
  try {
    for (let index = 0; index < seeds.length;) {
      const planned = seeds.slice(index, index + jobs);
      const firstCaptured = planned.findIndex((seed) => localRoots.has(seed));
      // Local observations never go into subprocess arguments.
      const limit =
        firstCaptured < 0 ? planned.length : Math.max(1, firstCaptured);
      const batch = planned.slice(0, await reserveUnits(limit));
      const tasks = batch.map((seed) => ({
        seed,
        salt,
        options,
        calibration: report.calibration,
      }));
      const results = await Promise.allSettled(
        tasks.map((task) =>
          tasks.length === 1
            ? collectUnoResidualSeed(task, localRoots.get(task.seed), checkIdle)
            : collectInChild(task, stopped.signal),
        ),
      );
      stopped.signal.throwIfAborted();
      for (const [offset, outcome] of results.entries()) {
        if (outcome.status === 'rejected') throw outcome.reason;
        checkIdle(true);
        assertSource();
        record(batch[offset]!, outcome.value);
      }
      index += batch.length;
    }
  } finally {
    if (jobs > 1) {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    }
  }
}

const { training } = state;
await processSeeds(
  work.slice(state.trainingSeeds.length),
  0xc0000,
  (seed, positions) => {
    for (const { root, short, outcomes, unfinished } of positions) {
      state.trainingUnfinished += unfinished;
      const rows = collectUnoResidualExamples(
        root,
        short,
        outcomes,
        options.continuations,
      );
      const sourceMultiplier = localWeights.get(root) ?? 1;
      training.push(
        ...rows.map((row) => ({
          ...row,
          weight: (row.weight * sourceMultiplier) / positions.length,
        })),
      );
    }
    state.trainingSeeds.push(seed);
    checkpoint?.save(state);
    console.error(
      JSON.stringify({ phase: 'residual-labels', seed, rows: training.length }),
    );
  },
);
if (!training.length)
  throw new Error('No complete paired residual labels were available');
const penalty = 0.001;
const solver = fileURLToPath(new URL('./ridge-cuda.py', import.meta.url));
if (!state.fit) {
  await reserveUnits();
  state.fit = JSON.parse(
    await fitUnoOnGpu(
      solver,
      JSON.stringify({ examples: training, penalty }),
      checkIdle,
    ),
  ) as GpuFit;
}
const fit = state.fit;
const independentFit = fitModel(training, 'linear', penalty);
if (
  fit.coefficients.length !== independentFit.length ||
  fit.coefficients.some(
    (coefficient, index) =>
      !Number.isFinite(coefficient) ||
      Math.abs(coefficient - independentFit[index]!) > 1e-6,
  )
)
  throw new Error('GPU fit differs from the independent numeric check');
assertSource();
checkpoint?.save(state);
const model: UnoCorrectionModel = {
  version: 1,
  calibrationDigest,
  features: unoCorrectionFeatureNames,
  coefficients: fit.coefficients,
  weight: 0,
  cap: 0.01,
};
const { tuning } = state;
await processSeeds(
  tuneSeeds.slice(state.tuningSeeds.length),
  0xe0000,
  (seed, positions) => {
    tuning.push(positions);
    state.tuningSeeds.push(seed);
    checkpoint?.save(state);
    console.error(
      JSON.stringify({
        phase: 'residual-tuning',
        seed,
        positions: positions.length,
      }),
    );
  },
);
const tuneResults = [0, 0.25, 0.5, 0.75].flatMap((weight) =>
  [0.01, 0.02, 0.03].map((cap) => {
    let changes = 0;
    let matched = 0;
    const seedGains: number[] = [];
    for (const positions of tuning) {
      const gains: number[] = [];
      for (const { root, short, outcomes } of positions) {
        const baseline = unoSearchBest(short.candidates)!;
        const selected = unoCorrectedBest(
          short,
          root.view,
          root.memory,
          { ...model, weight, cap },
          hypotheses,
        )!;
        const differences = pairedUnoDifferences(
          outcomes.map((trials) =>
            trials.some((trial) => trial === null)
              ? trials.map(() => null)
              : trials,
          ),
          options.continuations,
          short.candidates.indexOf(selected),
          short.candidates.indexOf(baseline),
        );
        if (!differences.length) continue;
        matched++;
        if (selected !== baseline) changes++;
        gains.push(
          differences.reduce((sum, value) => sum + value, 0) /
            differences.length,
        );
      }
      if (gains.length)
        seedGains.push(
          gains.reduce((sum, value) => sum + value, 0) / gains.length,
        );
    }
    return {
      weight,
      cap,
      changes,
      matched,
      seeds: seedGains.length,
      gain: seedGains.length
        ? seedGains.reduce((sum, gain) => sum + gain, 0) / seedGains.length
        : 0,
    };
  }),
);
const frozen = tuneResults.reduce((best, current) =>
  current.gain > best.gain + Number.EPSILON && current.matched >= best.matched
    ? current
    : best,
);
console.log(
  JSON.stringify(
    {
      type: 'uno-residual-candidate',
      pilot: unoPilotEvidence,
      calibrationDigest,
      calibrationReportSha256,
      sourceSha256,
      node: process.version,
      trainSeeds,
      tuneSeeds,
      ...(relatedSeeds.length ? { relatedSeeds } : {}),
      options,
      device: fit.device,
      torch: fit.torch,
      trainingRows: training.length,
      localCorpus: corpus
        ? {
            inputDigest: corpus.inputDigest,
            matches: corpus.matches,
            usable: corpus.entries.length,
            seeds: [...localRoots.keys()],
            invalidLines: corpus.invalidLines,
            provenance: {
              version: 1,
              reviewDigest: corpus.reviewDigest,
              sourceWeight,
              eligible: corpus.eligible,
              selected: corpus.selected,
              selectedMatches: corpus.selectedMatches,
              isolated: corpus.isolated,
            },
          }
        : null,
      trainingUnfinished: state.trainingUnfinished,
      tuningUnfinished: tuning
        .flat()
        .reduce((sum, position) => sum + position.unfinished, 0),
      tuneResults,
      model: { ...model, weight: frozen.weight, cap: frozen.cap },
    },
    null,
    2,
  ),
);
