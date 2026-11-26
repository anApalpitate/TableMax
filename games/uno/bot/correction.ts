import { getCard } from '../data/catalog';
import { handValue } from '../rules/scoring';
import type { Action, UnoView } from '../types';
import type { Memory } from './index';
import type { UnoSearchResult } from './search';
import type { UnoSearchSamples } from './search-budget';

type Play = Extract<Action, { type: 'play' }>;
type Candidate = UnoSearchResult['candidates'][number];

export const unoCorrectionFeatureNames = [
  'same-color',
  'number',
  'skip',
  'reverse',
  'draw-two',
  'wild',
  'draw-four',
  'own-remaining',
  'own-value',
  'own-followups',
  'own-wilds',
  'own-controls',
  'own-last-playable',
  'clockwise',
  'next-hand',
  'affected-hand',
  'next-one-card',
  'own-score-distance',
  'affected-score-distance',
  'leader-score-distance',
  'hint-matches',
  'known-color',
  'known-evidence-available',
  'known-one-card',
  'blocks-leader',
] as const;

export interface UnoCorrectionModel {
  version: 1;
  calibrationDigest: string;
  features: readonly string[];
  coefficients: readonly number[];
  weight: number;
  cap: number;
}

export function unoCandidateFeatures(
  view: UnoView,
  memory: Memory,
  action: Play,
): readonly number[] {
  const self = view.self;
  if (!self) throw new Error('UNO candidate features require the acting seat');
  const card = getCard(action.cardId);
  const color = card.color ?? action.color;
  if (color === undefined)
    throw new Error('UNO Wild action must specify a color');
  const remaining = self.hand.filter((held) => held.id !== action.cardId);
  const followups = remaining.filter(
    (held) =>
      held.color === null ||
      held.color === color ||
      (held.kind === card.kind &&
        (held.kind !== 'number' || held.value === card.value)),
  );
  const seats = view.seatOrder;
  const size = seats.length;
  const origin = seats.indexOf(self.seatId);
  const direction = card.kind === 'reverse' ? -view.direction : view.direction;
  const nextSeat = (steps: number) =>
    seats[(origin + direction * steps + size * 2) % size]!;
  const skips =
    card.kind === 'skip' ||
    (card.kind === 'reverse' && size === 2) ||
    (card.kind === 'draw-two' && !view.setup?.drawPenaltyStacking);
  const next = nextSeat(skips ? 2 : 1);
  const affected = nextSeat(1);
  const target = view.players[affected]!;
  const nextPlayer = view.players[next]!;
  const leadingScore = Math.max(
    ...seats
      .filter((seat) => seat !== self.seatId)
      .map((seat) => view.players[seat]!.score),
  );
  const known = memory.knownCards[next] ?? [];
  const hint = memory.colorHints[next];
  const knownColor = known.some((id) => getCard(id).color === color);
  return [
    Number(color === view.activeColor),
    Number(card.kind === 'number'),
    Number(card.kind === 'skip'),
    Number(card.kind === 'reverse'),
    Number(card.kind === 'draw-two'),
    Number(card.kind === 'wild'),
    Number(card.kind === 'wild-draw-four'),
    remaining.length / 108,
    handValue(remaining.map(({ id }) => id)) / 500,
    followups.length / 108,
    remaining.filter((held) => held.color === null).length / 8,
    remaining.filter((held) => held.kind !== 'number').length / 32,
    Number(remaining.length === 1 && followups.length === 1),
    Number(direction === 1),
    nextPlayer.handCount / 108,
    target.handCount / 108,
    Number(nextPlayer.handCount === 1),
    (500 - view.players[self.seatId]!.score) / 500,
    (500 - target.score) / 500,
    (500 - leadingScore) / 500,
    hint?.color === color ? hint.strength : 0,
    Number(knownColor),
    Number(known.length > 0),
    Number(knownColor && nextPlayer.handCount === 1),
    skips ? target.score / 500 : 0,
  ];
}

export function loadUnoCorrection(
  input: unknown,
  calibrationDigest: string,
): UnoCorrectionModel {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid UNO correction model');
  const model = input as UnoCorrectionModel;
  if (
    model.version !== 1 ||
    model.calibrationDigest !== calibrationDigest ||
    JSON.stringify(model.features) !==
      JSON.stringify(unoCorrectionFeatureNames) ||
    !Array.isArray(model.coefficients) ||
    model.coefficients.length !== unoCorrectionFeatureNames.length ||
    !model.coefficients.every(Number.isFinite) ||
    ![0, 0.25, 0.5, 0.75].includes(model.weight) ||
    ![0.01, 0.02, 0.03].includes(model.cap)
  )
    throw new Error(
      'UNO correction does not match its frozen calibration or feature contract',
    );
  return { ...model, coefficients: [...model.coefficients] };
}

export function unoSearchBest(
  candidates: readonly Candidate[],
): Candidate | undefined {
  let best = candidates[0];
  for (const candidate of candidates)
    if (candidate.winProbability > best!.winProbability) best = candidate;
  return best;
}

export function unoCorrectedBest(
  result: UnoSearchResult,
  view: UnoView,
  memory: Memory,
  model: UnoCorrectionModel,
  sampleBudget: UnoSearchSamples,
  shuffleResiduals?: (values: readonly number[]) => readonly number[],
) {
  const baseline = unoSearchBest(result.candidates);
  if (
    !baseline ||
    result.samples < Math.max(8, 0.75 * sampleBudget) ||
    model.weight === 0
  )
    return baseline;
  const reference = unoCandidateFeatures(view, memory, baseline.action);
  const challengers = result.candidates.filter(
    (candidate) =>
      candidate !== baseline &&
      baseline.winProbability - candidate.winProbability <=
        0.03 + Number.EPSILON,
  );
  const residuals = challengers.map(({ action }) =>
    unoCandidateFeatures(view, memory, action).reduce(
      (sum, feature, index) =>
        sum + (feature - reference[index]!) * model.coefficients[index]!,
      0,
    ),
  );
  const appliedResiduals =
    shuffleResiduals && residuals.length > 1
      ? shuffleResiduals(residuals)
      : residuals;
  let resultScore = baseline.winProbability;
  let best = baseline;
  for (const [index, candidate] of challengers.entries()) {
    const residual = appliedResiduals[index]!;
    if (!Number.isFinite(residual))
      throw new Error('Invalid UNO residual prediction');
    const score =
      candidate.winProbability +
      Math.max(-model.cap, Math.min(model.cap, model.weight * residual));
    if (
      score > resultScore + Number.EPSILON ||
      (Math.abs(score - resultScore) <= Number.EPSILON &&
        candidate.winProbability > best.winProbability)
    ) {
      best = candidate;
      resultScore = score;
    }
  }
  return best;
}
