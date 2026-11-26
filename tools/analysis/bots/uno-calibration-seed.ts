import { createHash } from 'node:crypto';
import {
  loadUnoLeafScorer,
  unoLeafFeatures,
  unoLeafFeatureNames,
} from '../../../games/uno/bot/calibration';
import { createUnoSearchStrategy } from '../../../games/uno/bot/search-strategy';
import type { UnoView } from '../../../games/uno/types';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { probability } from './fit';
import {
  collectUnoRoots,
  independentSeed,
  pairedUnoDifferences,
  sampleUnoContinuations,
  type UnoLeafLabel,
  type UnoRoot,
  type UnoRootSamples,
  type UnoSampleOptions,
} from './uno-samples';

export interface EvaluatedLeaf extends UnoLeafLabel {
  seed: number;
}

export function scoreFeatures(features: readonly number[]) {
  return [
    1,
    3 * (features[1]! - features[2]!) - 3 * features[4]! + features[6]!,
  ];
}

export function average(values: readonly number[]) {
  return values.length
    ? values.reduce((sum, current) => sum + current, 0) / values.length
    : null;
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

export function bootstrap(groups: readonly number[], seed: number) {
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

export type Calibration = {
  version: number;
  features: typeof unoLeafFeatureNames;
  coefficients: number[];
};

export type RankingBudget = { worldBatches: number; continuations: number };

export function rankingSamples(
  root: UnoRoot,
  options: UnoSampleOptions,
  rating: (view: UnoView) => number,
  reference: UnoRootSamples['short'],
  seed: number,
  budget: RankingBudget,
  onlyCandidates?: readonly number[],
) {
  const outcomes: (readonly Outcome[])[] = [];
  let unfinished = 0;
  const actions = JSON.stringify(
    reference.candidates.map(({ action }) => action),
  );
  for (let batch = 0; batch < budget.worldBatches; batch++) {
    const sample = sampleUnoContinuations(
      root,
      {
        ...options,
        continuations: budget.continuations,
        ...(onlyCandidates ? { onlyCandidates } : {}),
        seed: batch === 0 ? seed : independentSeed(seed, 0x67000 + batch),
      },
      rating,
    );
    if (
      JSON.stringify(sample.short.candidates.map(({ action }) => action)) !==
      actions
    )
      throw new Error('Paired UNO reference changed the frozen candidates');
    outcomes.push(...sample.outcomes);
    unfinished += sample.unfinished;
  }
  return { outcomes, unfinished };
}

export type CalibrationSeedTask = {
  seed: number;
  options: UnoSampleOptions;
} & (
  | { stage: 'fit-data' }
  | {
      stage: 'holdout';
      calibration: Calibration;
      rootPolicy: 'reference' | 'search';
      ranking: RankingBudget;
    }
);

export interface CalibrationSeedEvidence {
  seed: number;
  roots: number;
  rows: EvaluatedLeaf[];
  unfinished: number;
  rankingUnfinished: number;
  rankingPairs: number;
  confirmedPairs: number;
  orderedPairs: number;
  regrets: number[];
}

export async function collectCalibrationSeed(
  task: CalibrationSeedTask,
): Promise<CalibrationSeedEvidence> {
  const { seed, options } = task;
  const rows: EvaluatedLeaf[] = [];
  const regrets: number[] = [];
  let unfinished = 0;
  let rankingUnfinished = 0;
  let rankingPairs = 0;
  let confirmedPairs = 0;
  let orderedPairs = 0;
  let rootCount: number;
  if (task.stage === 'fit-data') {
    const roots = await collectUnoRoots(seed, options);
    rootCount = roots.length;
    const bootstrapLeaf = (view: UnoView) =>
      probability(-1 + scoreFeatures(unoLeafFeatures(view))[1]!);
    for (const [index, root] of roots.entries()) {
      const sample = sampleUnoContinuations(
        root,
        { ...options, seed: independentSeed(seed, 0x10000 + index) },
        bootstrapLeaf,
      );
      unfinished += sample.unfinished;
      rows.push(
        ...sample.leaves
          .filter(({ completed }) => completed > 0)
          .map((leaf) => ({ ...leaf, seed })),
      );
    }
  } else {
    const { calibration } = task;
    const evaluator = loadUnoLeafScorer(calibration);
    const calibrationDigest = createHash('sha256')
      .update(JSON.stringify(calibration))
      .digest('hex');
    const strategy =
      task.rootPolicy === 'search'
        ? createUnoSearchStrategy(
            calibration,
            calibrationDigest,
            options.hypotheses,
          )
        : undefined;
    const roots = await collectUnoRoots(seed, options, strategy);
    rootCount = roots.length;
    for (const [index, root] of roots.entries()) {
      const primary = sampleUnoContinuations(
        root,
        { ...options, seed: independentSeed(seed, 0x20000 + index) },
        evaluator,
      );
      if (!primary.short.candidates.length) continue;
      unfinished += primary.unfinished;
      rows.push(
        ...primary.leaves
          .filter(({ completed }) => completed > 0)
          .map((leaf) => ({ ...leaf, seed })),
      );
      const scores = primary.short.candidates.map(
        ({ winProbability }) => winProbability,
      );
      const comparison = rankingSamples(
        root,
        options,
        evaluator,
        primary.short,
        independentSeed(seed, 0x30000 + index),
        task.ranking,
      );
      rankingUnfinished += comparison.unfinished;
      const referenceScores = outcomesByCandidate(comparison.outcomes);
      if (!referenceScores.length) continue;
      for (let a = 0; a < scores.length; a++) {
        for (let b = a + 1; b < scores.length; b++) {
          rankingPairs++;
          const groups = pairedUnoDifferences(
            comparison.outcomes,
            task.ranking.continuations,
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
      const referenceBest = bestCandidate(referenceScores);
      const shortBest = bestCandidate(scores);
      if (referenceBest === shortBest) {
        regrets.push(0);
        continue;
      }
      const final = rankingSamples(
        root,
        options,
        evaluator,
        primary.short,
        independentSeed(seed, 0x50000 + index),
        task.ranking,
        [referenceBest, shortBest],
      );
      rankingUnfinished += final.unfinished;
      const differences = pairedUnoDifferences(
        final.outcomes,
        task.ranking.continuations,
        referenceBest,
        shortBest,
      );
      const regret = average(differences);
      if (regret !== null) regrets.push(regret);
    }
  }
  return {
    seed,
    roots: rootCount,
    rows,
    unfinished,
    rankingUnfinished,
    rankingPairs,
    confirmedPairs,
    orderedPairs,
    regrets,
  };
}
