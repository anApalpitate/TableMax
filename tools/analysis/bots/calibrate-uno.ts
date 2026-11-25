import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { unoLeafFeatureNames } from '../../../games/uno/bot/calibration';
import {
  fitModel,
  linearPrediction,
  probability,
  type WeightedExample,
} from './fit';
import {
  average,
  bootstrap,
  collectCalibrationSeed,
  scoreFeatures,
  type CalibrationSeedEvidence,
  type CalibrationSeedTask,
  type EvaluatedLeaf,
} from './uno-calibration-seed';
import { openTrainingCheckpoint } from './training-checkpoint';
import { unoPilotEvidence } from './uno-pilot';
import type { UnoSampleOptions } from './uno-samples';

function summary(
  rows: readonly EvaluatedLeaf[],
  predict: (row: EvaluatedLeaf) => number,
) {
  const pairs = rows.map((row) => ({
    prediction: predict(row),
    rate: row.wins / row.completed,
  }));
  const prediction = average(pairs.map((pair) => pair.prediction));
  const actual = average(pairs.map((pair) => pair.rate));
  return {
    rows: rows.length,
    seeds: new Set(rows.map(({ seed }) => seed)).size,
    prediction,
    actual,
    gap:
      prediction === null || actual === null
        ? null
        : Math.abs(prediction - actual),
    brier: average(
      pairs.map(
        ({ prediction: p, rate }) => rate * (1 - p) ** 2 + (1 - rate) * p ** 2,
      ),
    ),
  };
}

function aggregateBySeed(values: readonly { seed: number; value: number }[]) {
  const seeds = new Map<number, number[]>();
  for (const { seed, value } of values) {
    const group = seeds.get(seed);
    if (group) group.push(value);
    else seeds.set(seed, [value]);
  }
  return [...seeds.values()].map((group) => average(group)!);
}

const { values } = parseArgs({
  options: {
    'train-seeds': { type: 'string' },
    'holdout-seeds': { type: 'string' },
    roots: { type: 'string', default: '1' },
    hypotheses: { type: 'string', default: '8' },
    continuations: { type: 'string', default: '16' },
    'max-steps': { type: 'string', default: '15000' },
    'root-policy': { type: 'string', default: 'reference' },
    jobs: { type: 'string', default: '1' },
    checkpoint: { type: 'string' },
    'steps-per-run': { type: 'string' },
  },
});

function seeds(input: string | undefined) {
  if (!input)
    throw new Error('Pass disjoint --train-seeds and --holdout-seeds lists');
  const result = input.split(',').map(Number);
  if (
    result.some(
      (seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff,
    ) ||
    result.length !== new Set(result).size
  )
    throw new Error(
      'Calibration seeds must be unique positive 32-bit integers',
    );
  return result;
}

const trainSeeds = seeds(values['train-seeds']);
const holdoutSeeds = seeds(values['holdout-seeds']);
if (holdoutSeeds.some((seed) => trainSeeds.includes(seed)))
  throw new Error('Calibration fit and holdout seeds overlap');
const hypotheses = Number(values.hypotheses);
if (hypotheses !== 8 && hypotheses !== 16)
  throw new Error('Choose 8 or 16 hypotheses');
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
  throw new Error('Invalid calibration collection budget');
const requestedPolicy = values['root-policy'];
if (requestedPolicy !== 'reference' && requestedPolicy !== 'search')
  throw new Error('Choose reference or search root policy');
const rootPolicy: 'reference' | 'search' = requestedPolicy;

const maximumJobs = Math.min(8, Math.max(1, availableParallelism() - 2));
const jobs = Number(values.jobs);
const requestedUnits = Number(values['steps-per-run'] ?? Infinity);
if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > maximumJobs)
  throw new Error('Choose between 1 and ' + maximumJobs + ' calibration jobs');
if (
  values['steps-per-run'] !== undefined &&
  (!values.checkpoint ||
    !Number.isSafeInteger(requestedUnits) ||
    requestedUnits < 1)
)
  throw new Error('A positive calibration step limit requires --checkpoint');

function sourceDigest() {
  const productDirectories = [
    'games/uno/bot',
    'games/uno/data',
    'games/uno/rules',
  ];
  const files = [
    ...productDirectories.flatMap((directory) =>
      readdirSync(directory, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.test.ts') &&
            entry.name !== 'test-fixtures.ts',
        )
        .map(({ name }) => directory + '/' + name),
    ),
    ...['index', 'config', 'types'].map((name) => 'games/uno/' + name + '.ts'),
    ...['bot-scheduler', 'game-actions', 'random'].map(
      (name) => 'packages/platform-core/src/' + name + '.ts',
    ),
    ...[
      'calibrate-uno',
      'uno-calibration-seed',
      'uno-calibration-worker',
      'uno-samples',
      'evaluate',
      'fit',
      'uno-pilot',
      'training-checkpoint',
    ].map((name) => 'tools/analysis/bots/' + name + '.ts'),
  ].sort();
  const hash = createHash('sha256');
  for (const file of files) {
    const digest = createHash('sha256')
      .update(readFileSync(file))
      .digest('hex');
    hash.update(file + '\n' + digest + '\n');
  }
  return hash.digest('hex');
}

type Checkpoint = {
  fit: Record<string, CalibrationSeedEvidence>;
  holdout: Record<string, CalibrationSeedEvidence>;
  fittedDigest?: string;
};
const sourceSha256 = sourceDigest();
const batchDigest = createHash('sha256')
  .update(
    JSON.stringify({
      sourceSha256,
      runtime: process.version,
      pilot: unoPilotEvidence,
      trainSeeds,
      holdoutSeeds,
      options,
      rootPolicy,
    }),
  )
  .digest('hex');
const initial: Checkpoint = { fit: {}, holdout: {} };
const checkpoint = values.checkpoint
  ? openTrainingCheckpoint(values.checkpoint, batchDigest, initial)
  : null;
const state = checkpoint?.state ?? initial;
for (const [name, seeds] of [
  ['fit', trainSeeds],
  ['holdout', holdoutSeeds],
] as const) {
  const records = state[name];
  if (
    !records ||
    Array.isArray(records) ||
    Object.entries(records).some(
      ([key, row]) =>
        key !== String(row.seed) ||
        !seeds.includes(row.seed) ||
        !Array.isArray(row.rows),
    )
  )
    throw new Error('Invalid calibration checkpoint seed records');
}
if (
  (state.fittedDigest !== undefined &&
    Object.keys(state.fit).length !== trainSeeds.length) ||
  (Object.keys(state.holdout).length && !state.fittedDigest)
)
  throw new Error('Invalid calibration checkpoint stage boundary');

let remaining = requestedUnits;
const stopped = new AbortController();
const stop = () => stopped.abort(new Error('Calibration interrupted'));
if (jobs > 1) {
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
const worker = fileURLToPath(
  new URL('./uno-calibration-worker.ts', import.meta.url),
);
const runChild = promisify(execFile);
async function collectStage(
  seeds: readonly number[],
  records: Record<string, CalibrationSeedEvidence>,
  taskFor: (seed: number) => CalibrationSeedTask,
) {
  const pending = seeds
    .filter((seed) => !Object.hasOwn(records, seed))
    .slice(0, remaining);
  remaining -= pending.length;
  let next = 0;
  let failure: unknown;
  const consume = async () => {
    while (!stopped.signal.aborted && next < pending.length) {
      const seed = pending[next++]!;
      const task = taskFor(seed);
      try {
        const row =
          jobs === 1
            ? await collectCalibrationSeed(task)
            : (JSON.parse(
                (
                  await runChild(
                    process.execPath,
                    ['--import', 'tsx', worker, JSON.stringify(task)],
                    {
                      windowsHide: true,
                      encoding: 'utf8',
                      maxBuffer: 4 * 1024 * 1024,
                      signal: stopped.signal,
                    },
                  )
                ).stdout,
              ) as CalibrationSeedEvidence);
        if (
          row.seed !== seed ||
          !Array.isArray(row.rows) ||
          row.rows.some((leaf) => leaf.seed !== seed)
        )
          throw new Error('Calibration worker returned a different seed');
        if (checkpoint && sourceDigest() !== sourceSha256)
          throw new Error('Calibration source changed during the batch');
        records[seed] = row;
        checkpoint?.save(state);
        console.error(
          JSON.stringify({
            stage: task.stage,
            seed,
            roots: row.roots,
            rows: row.rows.length,
            completedSeeds: Object.keys(records).length,
            totalSeeds: seeds.length,
          }),
        );
      } catch (error) {
        failure ??= error;
        stopped.abort(error);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(jobs, pending.length) }, consume),
  );
  if (failure) throw failure;
  stopped.signal.throwIfAborted();
  return seeds.flatMap((seed) => (records[seed] ? [records[seed]] : []));
}

function pause() {
  console.log(
    JSON.stringify({
      type: 'uno-calibration-progress',
      batchDigest,
      sourceSha256,
      fittedSeeds: Object.keys(state.fit).length,
      totalFitSeeds: trainSeeds.length,
      holdoutSeeds: Object.keys(state.holdout).length,
      totalHoldoutSeeds: holdoutSeeds.length,
    }),
  );
}

const fitRecords = await collectStage(trainSeeds, state.fit, (seed) => ({
  stage: 'fit-data',
  seed,
  options,
}));
if (fitRecords.length === trainSeeds.length) {
  await evaluateHoldout(fitRecords);
} else {
  pause();
}
if (jobs > 1) {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}

async function evaluateHoldout(fitRecords: readonly CalibrationSeedEvidence[]) {
  const training = fitRecords.flatMap(({ rows }) => rows);
  const trainUnfinished = fitRecords.reduce(
    (total, row) => total + row.unfinished,
    0,
  );
  const rowsPerSeed = new Map<number, number>();
  for (const row of training)
    rowsPerSeed.set(row.seed, 1 + (rowsPerSeed.get(row.seed) ?? 0));
  const examples: WeightedExample[] = training.map((row) => ({
    features: row.features,
    target: row.wins / row.completed,
    weight: 1 / rowsPerSeed.get(row.seed)!,
  }));
  const calibration = {
    version: 1,
    features: unoLeafFeatureNames,
    coefficients: fitModel(examples, 'logistic'),
  };
  const reference = fitModel(
    examples.map((example) => ({
      ...example,
      features: scoreFeatures(example.features),
    })),
    'logistic',
  );
  const evaluate = (row: EvaluatedLeaf) =>
    probability(linearPrediction(row.features, calibration.coefficients));
  const calibrationDigest = createHash('sha256')
    .update(JSON.stringify(calibration))
    .digest('hex');
  if (
    state.fittedDigest !== undefined &&
    state.fittedDigest !== calibrationDigest
  )
    throw new Error(
      'Holdout checkpoint uses different frozen fitted coefficients',
    );
  if (!state.fittedDigest) {
    state.fittedDigest = calibrationDigest;
    checkpoint?.save(state);
  }
  const holdoutRecords = await collectStage(
    holdoutSeeds,
    state.holdout,
    (seed) => ({
      stage: 'holdout',
      seed,
      options,
      calibration,
      rootPolicy,
    }),
  );
  if (holdoutRecords.length !== holdoutSeeds.length) {
    pause();
    return;
  }
  if (sourceDigest() !== sourceSha256)
    throw new Error('Calibration source changed during the batch');
  const heldout = holdoutRecords.flatMap(({ rows }) => rows);
  const regrets = holdoutRecords.flatMap(({ seed, regrets }) =>
    regrets.map((value) => ({ seed, value })),
  );
  const sum = (
    field:
      | 'rankingPairs'
      | 'confirmedPairs'
      | 'orderedPairs'
      | 'unfinished'
      | 'rankingUnfinished',
  ) => holdoutRecords.reduce((total, row) => total + row[field], 0);
  const rankingPairs = sum('rankingPairs');
  const confirmedPairs = sum('confirmedPairs');
  const orderedPairs = sum('orderedPairs');
  const holdoutUnfinished = sum('unfinished');
  const rankingUnfinished = sum('rankingUnfinished');
  const overall = summary(heldout, evaluate);
  const baseline = summary(heldout, (row) =>
    probability(linearPrediction(scoreFeatures(row.features), reference)),
  );
  const bins = Array.from({ length: 10 }, (_, bin) =>
    summary(
      heldout.filter(
        (row) => Math.min(9, Math.floor(evaluate(row) * 10)) === bin,
      ),
      evaluate,
    ),
  );
  const stages = {
    playing: summary(
      heldout.filter(({ stage }) =>
        ['turn', 'drawn', 'choose-color'].includes(stage),
      ),
      evaluate,
    ),
    pending: summary(
      heldout.filter(
        ({ stage }) => stage === 'draw-four' || stage === 'draw-penalty',
      ),
      evaluate,
    ),
    settled: summary(
      heldout.filter(({ stage }) => stage === 'result'),
      evaluate,
    ),
  };
  const regretSeeds = aggregateBySeed(regrets);
  const ranking = {
    pairs: rankingPairs,
    confirmedPairs,
    orderedPairs,
    accuracy: confirmedPairs ? orderedPairs / confirmedPairs : null,
    averageRegret: average(regretSeeds),
    regretInterval: bootstrap(regretSeeds, 0x6ac96),
    rootsWithRegret: regrets.length,
  };
  const substantialBins = bins.filter(
    ({ rows }) => rows >= overall.rows * 0.05,
  );
  const enoughCoverage =
    rootPolicy === 'search' &&
    options.continuations >= 16 &&
    overall.seeds >= 20 &&
    substantialBins.every(({ seeds }) => seeds >= 8) &&
    Object.values(stages).every(({ seeds }) => seeds >= 8) &&
    confirmedPairs >= 30 &&
    regretSeeds.length >= 20;
  const passesMetrics =
    overall.gap !== null &&
    overall.gap <= 0.02 &&
    overall.brier !== null &&
    baseline.brier !== null &&
    overall.brier <= baseline.brier &&
    [...substantialBins, ...Object.values(stages)].every(
      ({ gap }) => gap !== null && gap <= 0.05,
    ) &&
    ranking.accuracy !== null &&
    ranking.accuracy >= 0.7 &&
    ranking.averageRegret !== null &&
    ranking.averageRegret <= 0.02 &&
    ranking.regretInterval !== null;
  console.log(
    JSON.stringify(
      {
        type: 'uno-calibration-development',
        revision: 2,
        batchDigest,
        sourceSha256,
        runtime: process.version,
        pilot: unoPilotEvidence,
        setup: unoPilotEvidence.setup,
        rootPolicy,
        trainSeeds,
        holdoutSeeds,
        options,
        calibration,
        calibrationDigest,
        baselineCoefficients: reference,
        fitRows: training.length,
        trainUnfinished,
        holdoutUnfinished,
        rankingUnfinished,
        overall,
        baseline,
        bins,
        stages,
        ranking,
        evaluation: !enoughCoverage
          ? 'insufficient'
          : passesMetrics
            ? 'meets-measured-gates'
            : 'missed',
      },
      null,
      2,
    ),
  );
}
