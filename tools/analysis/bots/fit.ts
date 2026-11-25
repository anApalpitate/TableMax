export interface WeightedExample {
  features: readonly number[];
  target: number;
  weight: number;
}

export function linearPrediction(
  features: readonly number[],
  coefficients: readonly number[],
) {
  return features.reduce(
    (sum, value, index) => sum + value * coefficients[index]!,
    0,
  );
}

export function probability(logit: number) {
  return 1 / (1 + Math.exp(-logit));
}

function solve(matrix: number[][], vector: number[]) {
  for (let column = 0; column < vector.length; column++) {
    const scale = matrix[column]![column]!;
    if (!Number.isFinite(scale) || scale <= 0)
      throw new Error('Model fit became singular');
    for (let row = column + 1; row < vector.length; row++) {
      const factor = matrix[row]![column]! / scale;
      for (let offset = column; offset < vector.length; offset++) {
        matrix[row]![offset]! -= factor * matrix[column]![offset]!;
      }
      vector[row]! -= factor * vector[column]!;
    }
  }
  for (let row = vector.length - 1; row >= 0; row--) {
    for (let column = row + 1; column < vector.length; column++)
      vector[row]! -= matrix[row]![column]! * vector[column]!;
    vector[row]! /= matrix[row]![row]!;
  }
  if (!vector.every(Number.isFinite))
    throw new Error('Model fit produced non-finite coefficients');
  return vector;
}

export function fitModel(
  samples: readonly WeightedExample[],
  model: 'logistic' | 'linear',
  penalty = 0.001,
): number[] {
  const width = samples[0]?.features.length;
  if (
    !width ||
    !(penalty > 0) ||
    samples.some(
      ({ features, target, weight }) =>
        features.length !== width ||
        !features.every(Number.isFinite) ||
        !Number.isFinite(target) ||
        !Number.isFinite(weight) ||
        weight <= 0 ||
        (model === 'logistic' && (target < 0 || target > 1)),
    )
  )
    throw new Error('Invalid weighted model samples');

  const totalWeight = samples.reduce((sum, item) => sum + item.weight, 0);
  const coefficients: number[] = Array(width).fill(0);
  for (
    let iteration = 0;
    iteration < (model === 'linear' ? 1 : 40);
    iteration++
  ) {
    const hessian: number[][] = Array.from({ length: width }, (_, row) =>
      Array.from({ length: width }, (_, column) =>
        row === column ? penalty : 0,
      ),
    );
    const gradient = coefficients.map((coefficient) => -penalty * coefficient);
    for (const { features, weight, target } of samples) {
      const logit = linearPrediction(features, coefficients);
      const predicted = model === 'logistic' ? probability(logit) : logit;
      const scaled = weight / totalWeight;
      const curvature =
        model === 'logistic' ? scaled * predicted * (1 - predicted) : scaled;
      for (let row = 0; row < width; row++) {
        gradient[row]! += scaled * (target - predicted) * features[row]!;
        for (let column = 0; column < width; column++)
          hessian[row]![column]! +=
            curvature * features[row]! * features[column]!;
      }
    }
    const step = solve(hessian, gradient);
    // Dampen the Newton step when near-separated training labels create a large step.
    const largest = Math.max(...step.map(Math.abs));
    const rate = model === 'linear' ? 1 : Math.min(1, 1 / largest);
    for (let index = 0; index < width; index++)
      coefficients[index]! += step[index]! * rate;
    if (largest < 1e-7) break;
  }
  return coefficients;
}
