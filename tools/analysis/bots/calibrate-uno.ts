import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import {
  loadUnoLeafScorer,
  unoLeafFeatureNames,
  unoLeafFeatures,
} from '../../../games/uno/bot/calibration';
import { createUnoSearchStrategy } from '../../../games/uno/bot/search-strategy';
import type { UnoView } from '../../../games/uno/types';
import { rules } from '../../../games/uno/rules';
import { RandomSource } from '../../../packages/platform-core/src/random';
import {
  fitModel,
  linearPrediction,
  probability,
  type WeightedExample,
} from './fit';
import {
  collectUnoRoots,
  independentSeed,
  pairedUnoDifferences,
  sampleUnoContinuations,
  type UnoLeafLabel,
  type UnoSampleOptions,
} from './uno-samples';

interface EvaluatedLeaf extends UnoLeafLabel {
  seed: number;
}

function scoreFeatures(features: readonly number[]) {
  return [
    1,
    3 * (features[1]! - features[2]!) - 3 * features[4]! + features[6]!,
  ];
}

function average(values: readonly number[]) {
  return values.length
    ? values.reduce((sum, current) => sum + current, 0) / values.length
    : null;
}

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

type Outcome = 0 | 1 | null;

function outcomesByCandidate(outcomes: readonly (readonly Outcome[])[]) {
  const complete = outcomes.filter((values) =>
    values.every((value) => value !== null),
  );
  if (!complete.length) return [];
  return complete[0]!.map((_, index) =>
    average(complete.map((values) => values[index]! as number))!,
  );
}

function bestCandidate(scores: readonly number[]) {
  return scores.reduce(
    (best, score, index) => (score > scores[best]! ? index : best),
    0,
  );
}

function bootstrap(groups: readonly number[], seed: number) {
  if (groups.length < 8) return null;
  const rng = new RandomSource(seed);
  const replicates = Array.from({ length: 2048 }, () => {
    let sum = 0;
    for (let index = 0; index < groups.length; index++)
      sum += groups[Math.floor(rng.next() * groups.length)]!;
    return sum / groups.length;
  }).sort((a, b) => a - b);
  return {
    lower: replicates[Math.floor(0.025 * (replicates.length - 1))]!,
    upper: replicates[Math.ceil(0.975 * (replicates.length - 1))]!,
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
const rootPolicy = values['root-policy'];
if (rootPolicy !== 'reference' && rootPolicy !== 'search')
  throw new Error('Choose reference or search root policy');

const training: EvaluatedLeaf[] = [];
const bootstrapLeaf = (view: UnoView) =>
  probability(-1 + scoreFeatures(unoLeafFeatures(view))[1]!);
let trainUnfinished = 0;
for (const seed of trainSeeds) {
  const roots = await collectUnoRoots(seed, options);
  for (const [index, root] of roots.entries()) {
    const sample = sampleUnoContinuations(
      root,
      { ...options, seed: independentSeed(seed, 0x10000 + index) },
      bootstrapLeaf,
    );
    trainUnfinished += sample.unfinished;
    training.push(
      ...sample.leaves
        .filter(({ completed }) => completed > 0)
        .map((leaf) => ({ ...leaf, seed })),
    );
  }
  console.error(
    JSON.stringify({
      stage: 'fit-data',
      seed,
      roots: roots.length,
      rows: training.length,
    }),
  );
}
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
const evaluator = loadUnoLeafScorer(calibration);
const evaluate = (row: EvaluatedLeaf) =>
  probability(linearPrediction(row.features, calibration.coefficients));
const calibrationDigest = createHash('sha256')
  .update(JSON.stringify(calibration))
  .digest('hex');
const heldoutStrategy =
  rootPolicy === 'search'
    ? createUnoSearchStrategy(calibration, calibrationDigest, hypotheses)
    : undefined;
const heldout: EvaluatedLeaf[] = [];
const regrets: { seed: number; value: number }[] = [];
let rankingPairs = 0;
let confirmedPairs = 0;
let orderedPairs = 0;
let holdoutUnfinished = 0;
let rankingUnfinished = 0;
for (const seed of holdoutSeeds) {
  const roots = await collectUnoRoots(seed, options, heldoutStrategy);
  for (const [index, root] of roots.entries()) {
    const primary = sampleUnoContinuations(
      root,
      { ...options, seed: independentSeed(seed, 0x20000 + index) },
      evaluator,
    );
    if (!primary.short.candidates.length) continue;
    holdoutUnfinished += primary.unfinished;
    heldout.push(
      ...primary.leaves
        .filter(({ completed }) => completed > 0)
        .map((leaf) => ({ ...leaf, seed })),
    );
    const scores = primary.short.candidates.map(
      ({ winProbability }) => winProbability,
    );
    const comparison = sampleUnoContinuations(
      root,
      { ...options, seed: independentSeed(seed, 0x30000 + index) },
      evaluator,
    );
    rankingUnfinished += comparison.unfinished;
    const referenceScores = outcomesByCandidate(comparison.outcomes);
    if (!referenceScores.length) continue;
    for (let a = 0; a < scores.length; a++) {
      for (let b = a + 1; b < scores.length; b++) {
        rankingPairs++;
        const groups = pairedUnoDifferences(
          comparison.outcomes,
          options.continuations,
          a,
          b,
        );
        if (Math.abs(average(groups) ?? 0) < 0.05) continue;
        const range = bootstrap(
          groups,
          independentSeed(seed, 0x42000 + index * 64 + a * 8 + b),
        );
        if (!range || (range.lower <= 0 && range.upper >= 0)) continue;
        confirmedPairs++;
        if (
          (range.lower > 0 && scores[a]! > scores[b]!) ||
          (range.upper < 0 && scores[b]! > scores[a]!)
        )
          orderedPairs++;
      }
    }
    const final = sampleUnoContinuations(
      root,
      { ...options, seed: independentSeed(seed, 0x50000 + index) },
      evaluator,
    );
    rankingUnfinished += final.unfinished;
    const differences = pairedUnoDifferences(
      final.outcomes,
      options.continuations,
      bestCandidate(referenceScores),
      bestCandidate(scores),
    );
    const regret = average(differences);
    if (regret !== null) regrets.push({ seed, value: regret });
  }
  console.error(
    JSON.stringify({
      stage: 'holdout',
      seed,
      roots: roots.length,
      rows: heldout.length,
    }),
  );
}

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
const substantialBins = bins.filter(({ rows }) => rows >= overall.rows * 0.05);
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
      revision: 1,
      setup: rules.setup!.defaults,
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
