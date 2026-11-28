import type { JsonValue } from './index';

export type CandidateEncoder = (
  view: JsonValue,
  action: JsonValue,
  seat: string,
) => readonly number[] | null;

export type CandidateRating = {
  version: 1;
  encoder: string;
  coefficients: number[];
  threshold: number;
};

export function readCandidateRating(
  input: unknown,
  encoder: string,
  width: number,
): CandidateRating {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid candidate-rating model');
  const model = input as Record<string, unknown>;
  if (
    Object.keys(model).sort().join(',') !==
      'coefficients,encoder,threshold,version' ||
    model.version !== 1 ||
    model.encoder !== encoder ||
    !Array.isArray(model.coefficients) ||
    model.coefficients.length !== width ||
    !model.coefficients.every(
      (n) => typeof n === 'number' && Number.isFinite(n),
    ) ||
    typeof model.threshold !== 'number' ||
    ![0.02, 0.06, 0.12].includes(model.threshold)
  )
    throw new Error(
      'Candidate-rating model does not match this decision encoder',
    );
  return {
    version: 1,
    encoder,
    coefficients: [...model.coefficients],
    threshold: model.threshold,
  };
}

function kind(action: JsonValue) {
  return action && typeof action === 'object' && !Array.isArray(action)
    ? action.type
    : undefined;
}

/** Find the same single alternative for paired training and for Worker inference. */
export function candidateRatingAlternative(
  encode: CandidateEncoder,
  view: JsonValue,
  actions: readonly JsonValue[],
  seat: string,
  baseline: JsonValue,
) {
  const reference = encode(view, baseline, seat);
  if (!reference) return null;
  let chosen: { action: JsonValue; difference: number[] } | null = null;
  let least = Infinity;
  for (const action of actions) {
    const alternative = encode(view, action, seat);
    if (!alternative) continue;
    if (alternative.length !== reference.length)
      throw new Error('Inconsistent decision encoder dimension');
    const difference = alternative.map(
      (value, index) => value - reference[index]!,
    );
    if (!difference.every(Number.isFinite))
      throw new Error('Non-finite decision features');
    const distance = difference.reduce(
      (sum, value) => sum + Math.abs(value),
      0,
    );
    if (!distance) continue;
    // Prefer a distinct decision such as passing over a nearby price change.
    const priority = distance + Number(kind(action) === kind(baseline)) * 100;
    if (priority >= least) continue;
    least = priority;
    chosen = { action, difference };
  }
  return chosen;
}

export function applyCandidateRating(
  model: CandidateRating,
  encode: CandidateEncoder,
  view: JsonValue,
  actions: readonly JsonValue[],
  seat: string,
  baseline: JsonValue,
) {
  const alternative = candidateRatingAlternative(
    encode,
    view,
    actions,
    seat,
    baseline,
  );
  if (!alternative) return baseline;
  if (alternative.difference.length !== model.coefficients.length)
    throw new Error('Candidate-rating model dimension changed');
  const score = alternative.difference.reduce(
    (sum, n, i) => sum + n * model.coefficients[i]!,
    0,
  );
  if (!Number.isFinite(score))
    throw new Error('Invalid candidate-rating score');
  return score > model.threshold ? alternative.action : baseline;
}
