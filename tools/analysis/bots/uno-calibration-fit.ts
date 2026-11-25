import {
  fitModel,
  linearPrediction,
  probability,
  type WeightedExample,
} from './fit';
import { scoreFeatures } from './uno-calibration-seed';

type FitRow = WeightedExample & { seed: number; natural: boolean };

const candidates = [0.001, 0.01, 0.05, 0.1, 'reference'] as const;
type Strength = (typeof candidates)[number];

function referenceFit(rows: readonly WeightedExample[]) {
  return fitModel(
    rows.map((row) => ({ ...row, features: scoreFeatures(row.features) })),
    'logistic',
  );
}

export function referenceAnchor(reference: readonly number[], width: number) {
  return Array.from({ length: width }, (_, column) => {
    const axis = Array<number>(width).fill(0);
    axis[column] = 1;
    return (
      (column === 0 ? reference[0]! : 0) +
      reference[1]! * scoreFeatures(axis)[1]!
    );
  });
}

export function fitUnoCalibration(
  training: readonly FitRow[],
  policy: 'standard' | 'anchored',
) {
  const reference = referenceFit(training);
  if (policy === 'standard')
    return { reference, coefficients: fitModel(training, 'logistic') };
  const seeds = new Set(
    training.filter(({ natural }) => natural).map(({ seed }) => seed),
  );
  if (seeds.size < 8)
    throw new Error('Anchored fit needs at least eight original natural seeds');
  const folds = 4;
  const seedFold = new Map(
    [...seeds]
      .sort((a, b) => a - b)
      .map((seed, index) => [seed, index % folds]),
  );
  const foldFor = (seed: number) => seedFold.get(seed) ?? seed % folds;
  const rows = candidates.map((penalty) => ({ penalty, errors: 0, weight: 0 }));
  for (let fold = 0; fold < folds; fold++) {
    const learn = training.filter(({ seed }) => foldFor(seed) !== fold);
    const verify = training.filter(
      ({ seed, natural }) => natural && foldFor(seed) === fold,
    );
    if (!verify.length) continue;
    if (!learn.some(({ natural }) => natural))
      throw new Error('Calibration folds lose all natural fit seeds');
    const anchor = referenceAnchor(
      referenceFit(learn),
      learn[0]!.features.length,
    );
    for (const result of rows) {
      const model =
        result.penalty === 'reference'
          ? anchor
          : fitModel(learn, 'logistic', result.penalty, anchor);
      for (const { features, target, weight } of verify) {
        const p = probability(linearPrediction(features, model));
        result.errors +=
          weight * (target * (1 - p) ** 2 + (1 - target) * p ** 2);
        result.weight += weight;
      }
    }
  }
  const cv = rows.map(({ penalty, errors, weight }) => ({
    penalty,
    brier: errors / weight,
  }));
  // Prefer stronger regularization when equivalent on training folds.
  const selected: Strength = cv.reduce((best, row) =>
    row.brier <= best.brier + 1e-12 ? row : best,
  ).penalty;
  const anchor = referenceAnchor(reference, training[0]!.features.length);
  const coefficients =
    selected === 'reference'
      ? anchor
      : fitModel(training, 'logistic', selected, anchor);
  return {
    reference,
    coefficients,
    selection: { folds, penalty: selected, cv },
  };
}
