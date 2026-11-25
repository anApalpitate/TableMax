import { createHash } from 'node:crypto';
import { fitUnoOnGpu } from './uno-gpu-fit';
import { readTrainingLease } from '../../../packages/platform-core/src/training-lease';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
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
  searchUnoPlays,
  type UnoSearchResult,
} from '../../../games/uno/bot/search';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { fitModel, type WeightedExample } from './fit';
import { collectUnoResidualExamples } from './uno-residual-labels';
import { readUnoLearningCorpus } from './local-uno-corpus';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';
import { calibrationSeeds } from './uno-calibration-provenance';
import { openTrainingCheckpoint } from './training-checkpoint';
import { bot } from '../../../games/uno/bot/index';
import {
  collectUnoRoots,
  independentSeed,
  pairedUnoDifferences,
  sampleUnoContinuations,
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
    checkpoint: { type: 'string' },
    'steps-per-run': { type: 'string' },
    'idle-lease': { type: 'string' },
    'idle-session': { type: 'string' },
    'jobs-root': { type: 'string' },
    'train-seeds': { type: 'string' },
    'tune-seeds': { type: 'string' },
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
const report = JSON.parse(readFileSync(values.calibration, 'utf8'));
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
const scoreLeaf = loadUnoLeafScorer(report.calibration);
const trainSeeds = seedList(values['train-seeds']);
const tuneSeeds = seedList(values['tune-seeds']);
const excluded = new Set(calibrationSeeds(report));
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

interface PositionEvidence {
  root: UnoRoot;
  short: UnoSearchResult;
  outcomes: readonly (readonly (0 | 1 | null)[])[];
  unfinished: number;
}
async function collect(
  seed: number,
  salt: number,
  inputRoots?: readonly UnoRoot[],
): Promise<PositionEvidence[]> {
  const result: PositionEvidence[] = [];
  checkIdle();
  const roots =
    inputRoots ?? (await collectUnoRoots(seed, options, undefined, checkIdle));
  for (const [index, root] of roots.entries()) {
    const signal = new AbortController().signal;
    const short = searchUnoPlays(
      root.view,
      root.actions,
      root.memory,
      new RandomSource(independentSeed(seed, salt + index)),
      signal,
      scoreLeaf,
      { samples: hypotheses, maxRuleSteps: hypotheses * 8 * 16 },
    );
    if (!short.candidates.length) continue;
    const long = sampleUnoContinuations(
      root,
      {
        ...options,
        seed: independentSeed(seed, salt + 0x10000 + index),
      },
      scoreLeaf,
      checkIdle,
    );
    if (
      JSON.stringify(long.short.candidates.map(({ action }) => action)) !==
      JSON.stringify(short.candidates.map(({ action }) => action))
    )
      throw new Error('The frozen short and long UNO candidate sets differ');
    result.push({
      root,
      short,
      outcomes: long.outcomes,
      unfinished: long.unfinished,
    });
  }
  return result;
}

const corpus = values['learning-log']
  ? readUnoLearningCorpus(values['learning-log'], options.roots)
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
type GpuFit = { coefficients: number[]; device: string; torch: string };
type Checkpoint = {
  training: WeightedExample[];
  trainingUnfinished: number;
  trainingSeeds: number[];
  tuningSeeds: number[];
  tuning: PositionEvidence[][];
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
const identity = createHash('sha256')
  .update(
    JSON.stringify({
      revision: 1,
      strategy: bot.version,
      features: unoCorrectionFeatureNames,
      calibrationDigest,
      work,
      tuneSeeds,
      options,
      corpus: corpus?.inputDigest,
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
  (state.fit !== undefined && state.trainingSeeds.length !== work.length)
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
async function beginUnit() {
  checkIdle(true);
  if (remaining > 0) {
    remaining--;
    return;
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
const { training } = state;
for (const seed of work.slice(state.trainingSeeds.length)) {
  await beginUnit();
  const positions = await collect(seed, 0xc0000, localRoots.get(seed));
  for (const { root, short, outcomes, unfinished } of positions) {
    state.trainingUnfinished += unfinished;
    const rows = collectUnoResidualExamples(
      root,
      short,
      outcomes,
      options.continuations,
    );
    training.push(
      ...rows.map((row) => ({ ...row, weight: row.weight / positions.length })),
    );
  }
  state.trainingSeeds.push(seed);
  checkpoint?.save(state);
  console.error(
    JSON.stringify({ phase: 'residual-labels', seed, rows: training.length }),
  );
}
if (!training.length)
  throw new Error('No complete paired residual labels were available');
const penalty = 0.001;
const solver = fileURLToPath(new URL('./ridge-cuda.py', import.meta.url));
if (!state.fit) {
  await beginUnit();
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
for (const seed of tuneSeeds.slice(state.tuningSeeds.length)) {
  await beginUnit();
  tuning.push(await collect(seed, 0xe0000));
  state.tuningSeeds.push(seed);
  checkpoint?.save(state);
  console.error(
    JSON.stringify({
      phase: 'residual-tuning',
      seed,
      positions: tuning.at(-1)!.length,
    }),
  );
}
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
      trainSeeds,
      tuneSeeds,
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
