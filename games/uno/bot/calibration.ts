import { handValue } from '../rules/scoring';
import type { UnoView } from '../types';

export const unoLeafFeatureNames = [
  'bias',
  'own-score',
  'leading-rival-score',
  'round-settled',
  'own-hand-count',
  'own-hand-value',
  'own-match-count',
  'smallest-rival-hand',
  'acts-next',
  'pending-draw-count',
  'pending-draw-target',
  'pending-challenge',
] as const;

export function unoLeafFeatures(view: UnoView): readonly number[] {
  const self = view.self;
  if (!self)
    throw new Error('UNO leaf evaluation requires the authorized seat');
  const opponents = view.seatOrder
    .filter((seat) => seat !== self.seatId)
    .map((seat) => view.players[seat]!);
  const ongoing = view.phase === 'playing';
  const matchCount = self.hand.filter(
    (card) =>
      card.color === null ||
      card.color === view.activeColor ||
      (card.kind === view.topCard.kind &&
        (card.kind !== 'number' || card.value === view.topCard.value)),
  ).length;
  const pending = view.drawPenalty?.count ?? (view.drawFour ? 4 : 0);
  return [
    1,
    view.players[self.seatId]!.score / 500,
    Math.max(...opponents.map((opponent) => opponent.score)) / 500,
    Number(!ongoing),
    ongoing ? self.hand.length / 108 : 0,
    ongoing ? handValue(self.hand.map((card) => card.id)) / 500 : 0,
    ongoing ? matchCount / 108 : 0,
    ongoing
      ? Math.min(...opponents.map((opponent) => opponent.handCount)) / 108
      : 0,
    Number(view.turnSeat === self.seatId),
    pending / 108,
    Number(pending > 0 && view.turnSeat === self.seatId),
    Number(view.drawFour !== null),
  ];
}

export function loadUnoLeafScorer(input: unknown): (view: UnoView) => number {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid UNO leaf calibration');
  const value = input as Record<string, unknown>;
  if (
    value.version !== 1 ||
    JSON.stringify(value.features) !== JSON.stringify(unoLeafFeatureNames) ||
    !Array.isArray(value.coefficients) ||
    value.coefficients.length !== unoLeafFeatureNames.length ||
    !value.coefficients.every((coefficient) => Number.isFinite(coefficient))
  )
    throw new Error('UNO leaf calibration does not match the feature contract');
  const coefficients = [...(value.coefficients as number[])];
  return (view) => {
    const features = unoLeafFeatures(view);
    const score = coefficients.reduce(
      (total, coefficient, index) => total + coefficient * features[index]!,
      0,
    );
    if (!Number.isFinite(score)) throw new Error('Invalid UNO leaf logit');
    return 1 / (1 + Math.exp(-score));
  };
}
