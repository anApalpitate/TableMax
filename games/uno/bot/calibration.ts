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

const unoJointThreatLeafFeatureNames = [
  ...unoLeafFeatureNames,
  'own-score-over-hand-size',
  'rival-score-over-hand-size',
  'acting-rival-score-over-hand-size',
  'last-draw-four',
] as const;

export type UnoLeafFeatureVersion = 1 | 2;

export function isUnoLeafFeatureVersion(
  version: unknown,
): version is UnoLeafFeatureVersion {
  return version === 1 || version === 2;
}

export function unoLeafFeatureNamesFor(
  version: UnoLeafFeatureVersion,
): readonly string[] {
  return version === 1 ? unoLeafFeatureNames : unoJointThreatLeafFeatureNames;
}

export function unoLeafFeatures(
  view: UnoView,
  version: UnoLeafFeatureVersion = 1,
): readonly number[] {
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
  const features = [
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
  if (version === 1) return features;

  const progress = ({
    score,
    handCount,
  }: {
    score: number;
    handCount: number;
  }) => score / 500 / Math.max(1, handCount);
  return [
    ...features,
    ongoing
      ? view.players[self.seatId]!.score / 500 / Math.max(1, self.hand.length)
      : 0,
    ongoing ? Math.max(...opponents.map(progress)) : 0,
    ongoing && view.turnSeat !== null && view.turnSeat !== self.seatId
      ? progress(view.players[view.turnSeat]!)
      : 0,
    Number(
      Boolean(
        view.drawFour && view.players[view.drawFour.offender]!.handCount === 0,
      ),
    ),
  ];
}

export function loadUnoLeafScorer(input: unknown): (view: UnoView) => number {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid UNO leaf calibration');
  const value = input as Record<string, unknown>;
  const version = value.version;
  if (!isUnoLeafFeatureVersion(version))
    throw new Error('UNO leaf calibration does not match the feature contract');
  const names = unoLeafFeatureNamesFor(version);
  if (
    JSON.stringify(value.features) !== JSON.stringify(names) ||
    !Array.isArray(value.coefficients) ||
    value.coefficients.length !== names.length ||
    !value.coefficients.every((coefficient) => Number.isFinite(coefficient))
  )
    throw new Error('UNO leaf calibration does not match the feature contract');
  const coefficients = [...(value.coefficients as number[])];
  return (view) => {
    const features = unoLeafFeatures(view, version);
    const score = coefficients.reduce(
      (total, coefficient, index) => total + coefficient * features[index]!,
      0,
    );
    if (!Number.isFinite(score)) throw new Error('Invalid UNO leaf logit');
    return 1 / (1 + Math.exp(-score));
  };
}
