import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs, promisify } from 'node:util';
import {
  isUnoLeafFeatureVersion,
  unoLeafFeatureNamesFor,
} from '../../../games/uno/bot/calibration';
import { isUnoSearchSamples } from '../../../games/uno/bot/search-budget';
import { linearPrediction, probability } from './fit';
import {
  average,
  bootstrap,
  collectCalibrationSeed,
  scoreFeatures,
  type CalibrationSeedEvidence,
  type CalibrationSeedTask,
  type EvaluatedLeaf,
  type RankingBudget,
} from './uno-calibration-seed';
import { fitUnoCalibration } from './uno-calibration-fit';
import { naturalFitCorpus } from './uno-fit-corpus';
import { openTrainingCheckpoint } from './training-checkpoint';
import { unoPilotEvidence } from './uno-pilot';
import { penaltyKinds, pendingCalibration } from './uno-pending';
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
    'feature-version': { type: 'string', default: '1' },
    'holdout-seeds': { type: 'string' },
    roots: { type: 'string', default: '1' },
    hypotheses: { type: 'string', default: '8' },
    'label-hypotheses': { type: 'string' },
    continuations: { type: 'string', default: '16' },
    'max-steps': { type: 'string', default: '15000' },
    'root-policy': { type: 'string', default: 'reference' },
    'pending-data': { type: 'string' },
    'natural-fit-data': { type: 'string' },
    'fit-policy': { type: 'string', default: 'standard' },
    'fit-only': { type: 'boolean', default: false },
    'expected-calibration-digest': { type: 'string' },
    'ranking-world-batches': { type: 'string', default: '1' },
    'ranking-continuations': { type: 'string' },
    'ranking-reference': { type: 'string' },
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

const featureVersion = Number(values['feature-version']);
if (!isUnoLeafFeatureVersion(featureVersion))
  throw new Error('Invalid UNO leaf feature version');
const trainSeeds = seeds(values['train-seeds']);
const fitOnly = values['fit-only'];
if (fitOnly && values['holdout-seeds'] !== undefined)
  throw new Error('Fit-only calibration accepts no holdout seeds');
const holdoutSeeds = fitOnly ? [] : seeds(values['holdout-seeds']);
const expectedCalibrationDigest = values['expected-calibration-digest'];
if (
  expectedCalibrationDigest !== undefined &&
  !/^[a-f0-9]{64}$/.test(expectedCalibrationDigest)
)
  throw new Error('Invalid expected calibration digest');
const pendingBytes = values['pending-data']
  ? readFileSync(values['pending-data'])
  : null;
const pending = pendingBytes
  ? pendingCalibration(
      JSON.parse(pendingBytes.toString('utf8')),
      featureVersion,
    )
  : null;
const pendingDigest = pendingBytes
  ? createHash('sha256').update(pendingBytes).digest('hex')
  : null;
const allSeeds = [
  ...trainSeeds,
  ...holdoutSeeds,
  ...(pending?.fit.map(({ seed }) => seed) ?? []),
  ...(pending?.review.map(({ seed }) => seed) ?? []),
];
if (new Set(allSeeds).size !== allSeeds.length)
  throw new Error(
    'Natural and pending calibration partitions must all use disjoint seeds',
  );
const hypotheses = Number(values.hypotheses);
if (!isUnoSearchSamples(hypotheses))
  throw new Error('Choose 8, 16, or up to 32 hypotheses');
const labelHypotheses =
  values['label-hypotheses'] === undefined
    ? undefined
    : Number(values['label-hypotheses']);
if (
  labelHypotheses !== undefined &&
  ((labelHypotheses !== 8 && labelHypotheses !== 16) ||
    labelHypotheses > hypotheses)
)
  throw new Error(
    'Calibration must label 8 or 16 complete worlds within the search budget',
  );
const options: UnoSampleOptions = {
  roots: Number(values.roots),
  hypotheses,
  ...(labelHypotheses === undefined ? {} : { labelHypotheses }),
  continuations: Number(values.continuations),
  maxSteps: Number(values['max-steps']),
};
if (
  [options.roots, options.continuations, options.maxSteps].some(
    (value) => !Number.isSafeInteger(value) || value < 1,
  )
)
  throw new Error('Invalid calibration collection budget');
const corpusBytes = values['natural-fit-data']
  ? readFileSync(values['natural-fit-data'])
  : null;
const corpus = corpusBytes
  ? naturalFitCorpus(
      JSON.parse(corpusBytes.toString('utf8')),
      options,
      trainSeeds,
      featureVersion,
    )
  : null;
const fitCorpusDigest = corpusBytes
  ? createHash('sha256').update(corpusBytes).digest('hex')
  : null;
const rankingReference = values['ranking-reference'];
if (rankingReference !== undefined && rankingReference !== 'shared-rounds')
  throw new Error('Invalid independent ranking reference');
const rankingBudget: RankingBudget = {
  worldBatches: Number(values['ranking-world-batches']),
  continuations: Number(
    values['ranking-continuations'] ?? options.continuations,
  ),
  ...(rankingReference === undefined ? {} : { reference: rankingReference }),
};
if (
  !Number.isInteger(rankingBudget.worldBatches) ||
  rankingBudget.worldBatches < 1 ||
  rankingBudget.worldBatches > 8 ||
  !Number.isInteger(rankingBudget.continuations) ||
  rankingBudget.continuations < 1 ||
  rankingBudget.continuations > 64
)
  throw new Error('Invalid independent ranking budget');
const requestedFit = values['fit-policy'];
if (requestedFit !== 'standard' && requestedFit !== 'anchored')
  throw new Error('Choose standard or anchored calibration fit');
const fitPolicy: 'standard' | 'anchored' = requestedFit;
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
      'uno-calibration-fit',
      'uno-fit-corpus',
      'uno-calibration-worker',
      'uno-samples',
      'uno-shared-reference',
      'uno-pending',
      'collect-uno-pending',
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
      pendingDigest,
      fitCorpusDigest,
      fitPolicy,
      ...(featureVersion === 1 ? {} : { featureVersion }),
      ...(fitOnly ? { fitOnly } : {}),
      ...(expectedCalibrationDigest === undefined
        ? {}
        : { expectedCalibrationDigest }),
      options,
      rankingBudget,
      rootPolicy,
    }),
  )
  .digest('hex');
const initial: Checkpoint = {
  fit: corpus
    ? Object.fromEntries(corpus.fit.map((row) => [row.seed, row]))
    : {},
  holdout: {},
};
const checkpoint = values.checkpoint
  ? openTrainingCheckpoint(values.checkpoint, batchDigest, initial)
  : null;
const state = checkpoint?.state ?? initial;
if (corpus && !isDeepStrictEqual(state.fit, initial.fit))
  throw new Error(
    'Calibration checkpoint no longer matches its frozen natural fit corpus',
  );
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
  featureVersion,
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
  const naturalFit = fitRecords.flatMap(({ rows }) => rows);
  const supplementalFit =
    pending?.fit.flatMap(({ seed, rows }) =>
      rows.map((row) => ({ ...row, seed })),
    ) ?? [];
  const supplementalSeeds = new Set(supplementalFit.map(({ seed }) => seed));
  // One targeted original seed receives one fifth the weight of one natural fit seed.
  const pendingFitWeight = 0.2;
  const training = [...naturalFit, ...supplementalFit];
  const trainUnfinished = fitRecords.reduce(
    (total, row) => total + row.unfinished,
    0,
  );
  const rowsPerSeed = new Map<number, number>();
  for (const row of training)
    rowsPerSeed.set(row.seed, 1 + (rowsPerSeed.get(row.seed) ?? 0));
  const examples = training.map((row) => ({
    seed: row.seed,
    natural: !supplementalSeeds.has(row.seed),
    features: row.features,
    target: row.wins / row.completed,
    weight:
      (supplementalSeeds.has(row.seed) ? pendingFitWeight : 1) /
      rowsPerSeed.get(row.seed)!,
  }));
  const fit = fitUnoCalibration(examples, fitPolicy);
  const calibration = {
    version: featureVersion,
    features: unoLeafFeatureNamesFor(featureVersion),
    coefficients: fit.coefficients,
  };
  const reference = fit.reference;
  const evaluate = (row: EvaluatedLeaf) =>
    probability(linearPrediction(row.features, calibration.coefficients));
  const calibrationDigest = createHash('sha256')
    .update(JSON.stringify(calibration))
    .digest('hex');
  if (
    expectedCalibrationDigest !== undefined &&
    calibrationDigest !== expectedCalibrationDigest
  )
    throw new Error(
      'Fitted coefficients differ from the predeclared candidate',
    );
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
    console.error(
      JSON.stringify({
        stage: 'fit-frozen',
        fitPolicy,
        selection: fit.selection?.penalty,
        naturalRows: naturalFit.length,
        pendingRows: supplementalFit.length,
        calibrationDigest,
      }),
    );
  }
  if (fitOnly) {
    console.log(
      JSON.stringify(
        {
          type: 'uno-calibration-fit',
          batchDigest,
          sourceSha256,
          runtime: process.version,
          pilot: unoPilotEvidence,
          options,
          fitPolicy,
          fitSelection: fit.selection,
          trainSeeds,
          fitRows: naturalFit.length,
          trainUnfinished,
          naturalFitSha256: fitCorpusDigest,
          ...(pending
            ? {
                pending: {
                  dataSha256: pendingDigest,
                  fitSeeds: pending.fit.map(({ seed }) => seed),
                  fitRows: supplementalFit.length,
                  fitWeightPerSeed: pendingFitWeight,
                },
              }
            : {}),
          calibration,
          calibrationDigest,
          baselineCoefficients: reference,
        },
        null,
        2,
      ),
    );
    return;
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
      ranking: rankingBudget,
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
  const naturalPending = heldout.filter(
    ({ stage }) => stage === 'draw-four' || stage === 'draw-penalty',
  );
  const supplementalReview = pending?.review.flatMap(({ seed, rows }) =>
    rows.map((row) => ({ ...row, seed })),
  );
  const pendingBreakdown =
    supplementalReview &&
    Object.fromEntries(
      penaltyKinds.map((kind) => [
        kind,
        summary(
          supplementalReview.filter((row) => row.kind === kind),
          evaluate,
        ),
      ]),
    );
  const stages = {
    playing: summary(
      heldout.filter(({ stage }) =>
        ['turn', 'drawn', 'choose-color'].includes(stage),
      ),
      evaluate,
    ),
    pending: summary(supplementalReview ?? naturalPending, evaluate),
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
    rankingBudget.worldBatches * rankingBudget.continuations >= 16 &&
    overall.seeds >= 20 &&
    substantialBins.every(({ seeds }) => seeds >= 8) &&
    Object.values(stages).every(({ seeds }) => seeds >= 8) &&
    (!pendingBreakdown ||
      Object.values(pendingBreakdown).every(({ seeds }) => seeds >= 8)) &&
    confirmedPairs >= 30 &&
    regretSeeds.length >= 20;
  const passesMetrics =
    overall.gap !== null &&
    overall.gap <= 0.02 &&
    overall.brier !== null &&
    baseline.brier !== null &&
    overall.brier <= baseline.brier &&
    [
      ...substantialBins,
      ...Object.values(stages),
      ...Object.values(pendingBreakdown ?? {}),
    ].every(({ gap }) => gap !== null && gap <= 0.05) &&
    ranking.accuracy !== null &&
    ranking.accuracy >= 0.7 &&
    ranking.averageRegret !== null &&
    ranking.averageRegret <= 0.02 &&
    ranking.regretInterval !== null;
  console.log(
    JSON.stringify(
      {
        type: 'uno-calibration-development',
        revision: 3,
        batchDigest,
        sourceSha256,
        runtime: process.version,
        pilot: unoPilotEvidence,
        setup: unoPilotEvidence.setup,
        rootPolicy,
        trainSeeds,
        holdoutSeeds,
        options,
        rankingBudget,
        calibration,
        calibrationDigest,
        baselineCoefficients: reference,
        fitPolicy,
        ...(fit.selection ? { fitSelection: fit.selection } : {}),
        fitRows: naturalFit.length,
        ...(corpus
          ? {
              naturalFit: {
                corpusSha256: fitCorpusDigest,
                sourceBatchDigest: corpus.sourceBatchDigest,
                sourceReportSha256: corpus.sourceReportSha256,
                sourceSha256: corpus.sourceSha256,
              },
            }
          : {}),
        ...(pending
          ? {
              pending: {
                dataSha256: pendingDigest,
                fitSeeds: pending.fit.map(({ seed }) => seed),
                reviewSeeds: pending.review.map(({ seed }) => seed),
                fitRows: supplementalFit.length,
                fitWeightPerSeed: pendingFitWeight,
                continuations: pending.options.continuations,
                natural: summary(naturalPending, evaluate),
                cases: pendingBreakdown,
              },
            }
          : {}),
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
