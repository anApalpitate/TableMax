import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import {
  loadUnoLeafScorer,
  unoLeafFeatureNamesFor,
} from '../../../games/uno/bot/calibration';
import { linearPrediction, probability } from './fit';
import { isUnoSearchSamples } from '../../../games/uno/bot/search-budget';
import { fitUnoCalibration } from './uno-calibration-fit';
import { calibrationSeeds } from './uno-calibration-provenance';
import {
  average,
  bootstrap,
  scoreFeatures,
  type CalibrationSeedEvidence,
  type EvaluatedLeaf,
} from './uno-calibration-seed';
import { naturalFitCorpus } from './uno-fit-corpus';
import { penaltyKinds, pendingCalibration } from './uno-pending';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';

const sha = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex');
function load(path: string) {
  const bytes = readFileSync(path);
  return { value: JSON.parse(bytes.toString('utf8')), sha256: sha(bytes) };
}
const { values } = parseArgs({
  options: {
    report: { type: 'string' },
    checkpoint: { type: 'string' },
    'pending-data': { type: 'string' },
    'natural-fit-data': { type: 'string' },
    'frozen-plan': { type: 'string' },
  },
});
if (!values.report || !values.checkpoint)
  throw new Error('Pass the completed B report and frozen checkpoint');
const evidence = load(values.report);
const report = evidence.value;
if (
  report?.type !== 'uno-calibration-development' ||
  report.revision !== 3 ||
  !isCurrentUnoPilot(report.pilot) ||
  !['standard', 'anchored'].includes(report.fitPolicy) ||
  !['reference', 'search'].includes(report.rootPolicy) ||
  report.calibrationDigest !== sha(JSON.stringify(report.calibration)) ||
  !isUnoSearchSamples(report.options?.hypotheses) ||
  (report.options.labelHypotheses !== undefined &&
    (![8, 16].includes(report.options.labelHypotheses) ||
      report.options.labelHypotheses > report.options.hypotheses)) ||
  [
    report.options.roots,
    report.options.continuations,
    report.options.maxSteps,
    report.rankingBudget?.worldBatches,
    report.rankingBudget?.continuations,
  ].some((n) => !Number.isSafeInteger(n) || n < 1)
)
  throw new Error('Expected a current, complete B calibration report');
calibrationSeeds(report);
loadUnoLeafScorer(report.calibration);
const featureVersion = report.calibration.version;
const featureCount = unoLeafFeatureNamesFor(featureVersion).length;
const stored = load(values.checkpoint);
if (
  stored.value?.version !== 1 ||
  stored.value.identity !== report.batchDigest ||
  stored.value.state?.fittedDigest !== report.calibrationDigest
)
  throw new Error(
    'The checkpoint must contain the frozen report coefficients and batch',
  );
const state = stored.value.state;

function records(group: unknown, seeds: readonly number[]) {
  if (
    !group ||
    typeof group !== 'object' ||
    Array.isArray(group) ||
    Object.keys(group).length !== seeds.length
  )
    throw new Error(
      'The checkpoint must contain every recorded fit and holdout opening',
    );
  return seeds.map((seed) => {
    const entry = (group as Record<number, CalibrationSeedEvidence>)[seed];
    if (
      entry?.seed !== seed ||
      !Number.isSafeInteger(entry.roots) ||
      entry.roots < 0 ||
      entry.roots > report.options.roots ||
      ![
        entry.unfinished,
        entry.rankingUnfinished,
        entry.rankingPairs,
        entry.confirmedPairs,
        entry.orderedPairs,
      ].every((n) => Number.isSafeInteger(n) && n >= 0) ||
      entry.confirmedPairs > entry.rankingPairs ||
      entry.orderedPairs > entry.confirmedPairs ||
      !Array.isArray(entry.regrets) ||
      entry.regrets.length > entry.roots ||
      entry.regrets.some(
        (value) => !Number.isFinite(value) || Math.abs(value) > 1,
      ) ||
      !Array.isArray(entry.rows) ||
      entry.rows.some(
        (row) =>
          row?.seed !== seed ||
          !Array.isArray(row.features) ||
          row.features.length !== featureCount ||
          !row.features.every(Number.isFinite) ||
          !Number.isSafeInteger(row.completed) ||
          row.completed < 1 ||
          row.completed > report.options.continuations ||
          !Number.isSafeInteger(row.wins) ||
          row.wins < 0 ||
          row.wins > row.completed ||
          ![
            'turn',
            'drawn',
            'choose-color',
            'draw-four',
            'draw-penalty',
            'result',
          ].includes(row.stage),
      )
    )
      throw new Error('The checkpoint has malformed seed evidence');
    return entry;
  });
}
const fitRecords = records(state.fit, report.trainSeeds);
const heldout = records(state.holdout, report.holdoutSeeds);
const naturalInput = values['natural-fit-data']
  ? load(values['natural-fit-data'])
  : null;
const naturalCorpus =
  naturalInput &&
  naturalFitCorpus(
    naturalInput.value,
    report.options,
    report.trainSeeds,
    featureVersion,
  );
const naturalLineage = naturalCorpus
  ? {
      corpusSha256: naturalInput!.sha256,
      sourceBatchDigest: naturalCorpus.sourceBatchDigest,
      sourceReportSha256: naturalCorpus.sourceReportSha256,
      sourceSha256: naturalCorpus.sourceSha256,
    }
  : undefined;
if (
  !isDeepStrictEqual(report.naturalFit, naturalLineage) ||
  (naturalCorpus && !isDeepStrictEqual(naturalCorpus.fit, fitRecords))
)
  throw new Error(
    'The evaluated model must retain its exact natural fit corpus',
  );

const pendingInput = values['pending-data']
  ? load(values['pending-data'])
  : null;
const pending =
  pendingInput && pendingCalibration(pendingInput.value, featureVersion);
if (
  Boolean(report.pending) !== Boolean(pending) ||
  (pending &&
    (pendingInput!.sha256 !== report.pending.dataSha256 ||
      !isDeepStrictEqual(
        pending.fit.map(({ seed }) => seed),
        report.pending.fitSeeds,
      ) ||
      !isDeepStrictEqual(
        pending.review.map(({ seed }) => seed),
        report.pending.reviewSeeds,
      )))
)
  throw new Error(
    'The report must retain its exact supplemental fit and review data',
  );
const frozen = values['frozen-plan'] ? load(values['frozen-plan']) : null;
if (frozen) {
  const plan = frozen.value;
  const expected = {
    sourceSha256: report.sourceSha256,
    runtime: report.runtime,
    pilot: report.pilot,
    selectedCalibrationDigest: report.calibrationDigest,
    ...(featureVersion === 1 ? {} : { featureVersion }),
    trainSeeds: report.trainSeeds,
    holdoutSeeds: report.holdoutSeeds,
    pendingReviewSeeds: report.pending?.reviewSeeds,
    options: report.options,
    fitPolicy: report.fitPolicy,
    rootPolicy: report.rootPolicy,
    rankingBudget: report.rankingBudget,
    naturalFitSha256: naturalInput?.sha256,
    pendingFitSourceSha256: pendingInput?.value?.frozenFitSourceSha256,
  };
  if (
    plan?.type !== 'uno-b-qualification-plan' ||
    Object.entries(expected).some(
      ([field, value]) => !isDeepStrictEqual(plan[field], value),
    )
  )
    throw new Error(
      'The completed batch differs from the frozen qualification plan',
    );
}

const naturalFit = fitRecords.flatMap(({ rows }) => rows);
const supplementalFit =
  pending?.fit.flatMap(({ seed, rows }) =>
    rows.map((row) => ({ ...row, seed })),
  ) ?? [];
const supplementalSeeds = new Set(supplementalFit.map(({ seed }) => seed));
const samples = [...naturalFit, ...supplementalFit];
const counts = new Map<number, number>();
for (const { seed } of samples) counts.set(seed, 1 + (counts.get(seed) ?? 0));
const fitted = fitUnoCalibration(
  samples.map((row) => ({
    seed: row.seed,
    natural: !supplementalSeeds.has(row.seed),
    features: row.features,
    target: row.wins / row.completed,
    weight: (supplementalSeeds.has(row.seed) ? 0.2 : 1) / counts.get(row.seed)!,
  })),
  report.fitPolicy,
);
if (
  !isDeepStrictEqual(report.calibration.coefficients, fitted.coefficients) ||
  !isDeepStrictEqual(report.baselineCoefficients, fitted.reference) ||
  !isDeepStrictEqual(report.fitSelection, fitted.selection) ||
  report.fitRows !== naturalFit.length ||
  report.trainUnfinished !==
    fitRecords.reduce((sum, row) => sum + row.unfinished, 0) ||
  (pending &&
    (report.pending.fitRows !== supplementalFit.length ||
      report.pending.fitWeightPerSeed !== 0.2 ||
      report.pending.continuations !== pending.options.continuations))
)
  throw new Error(
    'The reported B fit was not reproduced by the recorded fit labels',
  );

function summarize(
  rows: readonly EvaluatedLeaf[],
  evaluate: (row: EvaluatedLeaf) => number,
) {
  const pairs = rows.map((row) => ({
    prediction: evaluate(row),
    rate: row.wins / row.completed,
  }));
  const prediction = average(pairs.map(({ prediction }) => prediction));
  const actual = average(pairs.map(({ rate }) => rate));
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
const evaluate = (row: EvaluatedLeaf) =>
  probability(linearPrediction(row.features, fitted.coefficients));
const rows = heldout.flatMap(({ rows }) => rows);
const sum = (
  name:
    | 'unfinished'
    | 'rankingUnfinished'
    | 'rankingPairs'
    | 'confirmedPairs'
    | 'orderedPairs',
) => heldout.reduce((total, row) => total + row[name], 0);
const overall = summarize(rows, evaluate);
const baseline = summarize(rows, (r) =>
  probability(linearPrediction(scoreFeatures(r.features), fitted.reference)),
);
const bins = Array.from({ length: 10 }, (_, i) =>
  summarize(
    rows.filter((r) => Math.min(9, Math.floor(evaluate(r) * 10)) === i),
    evaluate,
  ),
);
const naturalPending = rows.filter(
  ({ stage }) => stage === 'draw-penalty' || stage === 'draw-four',
);
const pendingRows = pending?.review.flatMap(({ seed, rows }) =>
  rows.map((row) => ({ ...row, seed })),
);
const cases =
  pendingRows &&
  Object.fromEntries(
    penaltyKinds.map((kind) => [
      kind,
      summarize(
        pendingRows.filter((row) => row.kind === kind),
        evaluate,
      ),
    ]),
  );
const stages = {
  playing: summarize(
    rows.filter(({ stage }) =>
      ['turn', 'drawn', 'choose-color'].includes(stage),
    ),
    evaluate,
  ),
  pending: summarize(pendingRows ?? naturalPending, evaluate),
  settled: summarize(
    rows.filter(({ stage }) => stage === 'result'),
    evaluate,
  ),
};
const regrets = heldout.flatMap(({ regrets }) =>
  regrets.length ? [average(regrets)!] : [],
);
const confirmedPairs = sum('confirmedPairs');
const orderedPairs = sum('orderedPairs');
const ranking = {
  pairs: sum('rankingPairs'),
  confirmedPairs,
  orderedPairs,
  accuracy: confirmedPairs ? orderedPairs / confirmedPairs : null,
  averageRegret: average(regrets),
  regretInterval: bootstrap(regrets, 0x6ac96),
  rootsWithRegret: heldout.reduce((n, row) => n + row.regrets.length, 0),
};
const groups = [
  ...bins.filter(({ rows: count }) => count >= overall.rows * 0.05),
  ...Object.values(stages),
  ...Object.values(cases ?? {}),
];
const coverage = {
  search: report.rootPolicy === 'search',
  rollout:
    report.options.continuations >= 16 &&
    report.rankingBudget.worldBatches * report.rankingBudget.continuations >=
      16,
  naturalSeeds: overall.seeds >= 20,
  groupedSeeds: groups.every(({ seeds }) => seeds >= 8),
  confirmedPairs: confirmedPairs >= 30,
  regretSeeds: regrets.length >= 20,
};
const metrics = {
  overallGap: overall.gap !== null && overall.gap <= 0.02,
  brier:
    overall.brier !== null &&
    baseline.brier !== null &&
    overall.brier <= baseline.brier,
  groupedGap: groups.every(({ gap }) => gap !== null && gap <= 0.05),
  directionAccuracy: ranking.accuracy !== null && ranking.accuracy >= 0.7,
  regret:
    ranking.averageRegret !== null &&
    ranking.averageRegret <= 0.02 &&
    ranking.regretInterval !== null,
};
const evaluation = !Object.values(coverage).every(Boolean)
  ? 'insufficient'
  : Object.values(metrics).every(Boolean)
    ? 'meets-measured-gates'
    : 'missed';
const reported = {
  overall,
  baseline,
  bins,
  stages,
  ranking,
  evaluation,
  holdoutUnfinished: sum('unfinished'),
  rankingUnfinished: sum('rankingUnfinished'),
};
if (
  Object.entries(reported).some(
    ([field, value]) => !isDeepStrictEqual(report[field], value),
  ) ||
  (pending &&
    (!isDeepStrictEqual(report.pending.cases, cases) ||
      !isDeepStrictEqual(
        report.pending.natural,
        summarize(naturalPending, evaluate),
      )))
)
  throw new Error(
    'The completed B report does not match the recomputed measurements and verdict',
  );
console.log(
  JSON.stringify(
    {
      type: 'uno-b-qualification-audit',
      verification: 'passed',
      pilot: unoPilotEvidence,
      reportSha256: evidence.sha256,
      checkpointSha256: stored.sha256,
      frozenPlanSha256: frozen?.sha256 ?? null,
      evaluatedHoldoutSeeds: heldout.length,
      calibrationDigest: report.calibrationDigest,
      coverage,
      metrics,
      evaluation,
      ranking,
    },
    null,
    2,
  ),
);
