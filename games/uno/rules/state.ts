import { CARD_IDS, getCard, RULES_VERSION } from '../data/catalog';
import {
  COLORS,
  type Color,
  type LatestAction,
  type RoundResult,
} from '../types';
import { handValue } from './scoring';
export type DrawFour = {
  offender: string;
  target: string;
  previousColor: Color;
  chosenColor: Color;
  evidenceIds: string[];
  guilty: boolean;
};
export type Evidence = {
  challenger: string;
  offender: string;
  previousColor: Color;
  cardIds: string[];
  guilty: boolean;
};
export type State = {
  rulesVersion: string;
  stateVersion: 1;
  seats: string[];
  phase: 'playing' | 'round-result' | 'ended';
  stage: 'turn' | 'drawn' | 'choose-color' | 'draw-four' | 'result';
  roundNumber: number;
  turnNumber: number;
  actionSerial: number;
  dealer: string;
  turnSeat: string | null;
  direction: 1 | -1;
  activeColor: Color | null;
  deck: string[];
  discard: string[];
  hands: Record<string, string[]>;
  scores: Record<string, number>;
  wins: Record<string, number>;
  unoDeclared: Record<string, boolean>;
  drawnCardId: string | null;
  drawFour: DrawFour | null;
  unoWindow: { seatId: string } | null;
  evidence: Evidence | null;
  results: RoundResult[];
  winners: string[];
  latest: LatestAction | null;
};
export const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export const exact = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean =>
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const integer = (value: unknown, min = 0): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min;
const color = (value: unknown): value is Color =>
  COLORS.includes(value as Color);
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 108 &&
  value.every((id) => typeof id === 'string' && CARD_IDS.includes(id)) &&
  new Set(value).size === value.length;
function fail(): never {
  throw new Error('UNO 存档状态或秘密证据无效。');
}
export function validateState(input: unknown, seats: readonly string[]): State {
  if (
    !object(input) ||
    !exact(input, [
      'rulesVersion',
      'stateVersion',
      'seats',
      'phase',
      'stage',
      'roundNumber',
      'turnNumber',
      'actionSerial',
      'dealer',
      'turnSeat',
      'direction',
      'activeColor',
      'deck',
      'discard',
      'hands',
      'scores',
      'wins',
      'unoDeclared',
      'drawnCardId',
      'drawFour',
      'unoWindow',
      'evidence',
      'results',
      'winners',
      'latest',
    ])
  )
    fail();
  const s = input as State;
  if (
    s.rulesVersion !== RULES_VERSION ||
    s.stateVersion !== 1 ||
    !Array.isArray(s.seats) ||
    s.seats.length < 2 ||
    s.seats.length > 6 ||
    new Set(s.seats).size !== s.seats.length ||
    !s.seats.every((seat) => typeof seat === 'string') ||
    JSON.stringify(s.seats) !== JSON.stringify(seats) ||
    !s.seats.includes(s.dealer) ||
    !['playing', 'round-result', 'ended'].includes(s.phase) ||
    !['turn', 'drawn', 'choose-color', 'draw-four', 'result'].includes(
      s.stage,
    ) ||
    !integer(s.roundNumber, 1) ||
    !integer(s.turnNumber, 1) ||
    !integer(s.actionSerial) ||
    ![1, -1].includes(s.direction) ||
    (s.activeColor !== null && !color(s.activeColor)) ||
    !ids(s.deck) ||
    !ids(s.discard) ||
    !s.discard.length ||
    !object(s.hands) ||
    !exact(s.hands, seats) ||
    !object(s.scores) ||
    !exact(s.scores, seats) ||
    !object(s.wins) ||
    !exact(s.wins, seats) ||
    !object(s.unoDeclared) ||
    !exact(s.unoDeclared, seats) ||
    !s.seats.every(
      (seat) =>
        ids(s.hands[seat]) &&
        integer(s.scores[seat]) &&
        integer(s.wins[seat]) &&
        typeof s.unoDeclared[seat] === 'boolean' &&
        (!s.unoDeclared[seat] || s.hands[seat]!.length === 1),
    )
  )
    fail();
  const all = [
    ...s.deck,
    ...s.discard,
    ...s.seats.flatMap((seat) => s.hands[seat]!),
  ];
  if (all.length !== 108 || new Set(all).size !== 108) fail();
  const top = getCard(s.discard.at(-1)!);
  if (s.phase === 'playing') {
    if (
      !s.turnSeat ||
      !s.seats.includes(s.turnSeat) ||
      s.stage === 'result' ||
      (s.activeColor === null) !== (s.stage === 'choose-color') ||
      (s.stage === 'choose-color' &&
        (top.kind !== 'wild' || s.discard.length !== 1 || s.turnNumber !== 1))
    )
      fail();
    if (
      s.stage !== 'draw-four' &&
      s.seats.some((seat) => !s.hands[seat]!.length)
    )
      fail();
    if (
      s.stage === 'draw-four' &&
      s.seats.some(
        (seat) => seat !== s.drawFour?.offender && !s.hands[seat]!.length,
      )
    )
      fail();
  } else if (
    s.turnSeat !== null ||
    s.stage !== 'result' ||
    s.activeColor === null ||
    s.drawFour !== null ||
    s.drawnCardId !== null ||
    s.unoWindow !== null
  )
    fail();
  if (top.color && s.activeColor !== top.color) fail();
  if (s.stage === 'drawn') {
    if (
      typeof s.drawnCardId !== 'string' ||
      !s.hands[s.turnSeat!]!.includes(s.drawnCardId)
    )
      fail();
    const drawn = getCard(s.drawnCardId);
    if (
      drawn.color !== null &&
      drawn.color !== s.activeColor &&
      !(drawn.kind === 'number'
        ? drawn.value === top.value && top.kind === 'number'
        : drawn.kind === top.kind)
    )
      fail();
  } else if (s.drawnCardId !== null) fail();
  if (s.stage === 'draw-four') {
    const claim = s.drawFour;
    if (
      !object(claim) ||
      !exact(claim, [
        'offender',
        'target',
        'previousColor',
        'chosenColor',
        'evidenceIds',
        'guilty',
      ]) ||
      !s.seats.includes(claim.offender) ||
      claim.target !== s.turnSeat ||
      claim.target === claim.offender ||
      !color(claim.previousColor) ||
      !color(claim.chosenColor) ||
      claim.chosenColor !== s.activeColor ||
      top.kind !== 'wild-draw-four' ||
      !ids(claim.evidenceIds) ||
      typeof claim.guilty !== 'boolean' ||
      claim.guilty !==
        claim.evidenceIds.some(
          (id) => getCard(id).color === claim.previousColor,
        )
    )
      fail();
    const targetIndex =
      (s.seats.indexOf(claim.offender) + s.direction + s.seats.length) %
      s.seats.length;
    const currentHand = s.hands[claim.offender]!;
    const added = currentHand.length - claim.evidenceIds.length;
    if (
      s.seats[targetIndex] !== claim.target ||
      JSON.stringify(currentHand.slice(0, claim.evidenceIds.length)) !==
        JSON.stringify(claim.evidenceIds)
    )
      fail();
    // Only a saved UNO catch can add cards while a +4 claim is pending. The
    // complete pre-penalty hand must survive: a subset would erase guilt.
    if (
      added !== 0 &&
      (claim.evidenceIds.length !== 1 ||
        added < 0 ||
        added > 2 ||
        s.latest?.verb !== 'catch-uno' ||
        s.latest.targets.length !== 1 ||
        s.latest.targets[0] !== claim.offender ||
        s.latest.drawCount !== added ||
        s.unoWindow !== null ||
        s.unoDeclared[claim.offender])
    )
      fail();
  } else if (s.drawFour !== null) fail();
  if (
    s.unoWindow !== null &&
    (!object(s.unoWindow) ||
      !exact(s.unoWindow, ['seatId']) ||
      !s.seats.includes(s.unoWindow.seatId) ||
      s.hands[s.unoWindow.seatId]!.length !== 1 ||
      s.unoDeclared[s.unoWindow.seatId] ||
      s.phase !== 'playing' ||
      !['turn', 'draw-four'].includes(s.stage))
  )
    fail();
  if (s.evidence !== null) {
    const e = s.evidence;
    if (
      !object(e) ||
      !exact(e, [
        'challenger',
        'offender',
        'previousColor',
        'cardIds',
        'guilty',
      ]) ||
      !s.seats.includes(e.challenger) ||
      !s.seats.includes(e.offender) ||
      e.challenger === e.offender ||
      !color(e.previousColor) ||
      !ids(e.cardIds) ||
      typeof e.guilty !== 'boolean' ||
      e.guilty !== e.cardIds.some((id) => getCard(id).color === e.previousColor)
    )
      fail();
  }
  if (
    !Array.isArray(s.results) ||
    s.results.length !== s.roundNumber - (s.phase === 'playing' ? 1 : 0) ||
    !Array.isArray(s.winners) ||
    new Set(s.winners).size !== s.winners.length ||
    s.winners.some((seat) => !s.seats.includes(seat))
  )
    fail();
  const totals = Object.fromEntries(seats.map((seat) => [seat, 0])),
    wins = { ...totals };
  for (const [index, result] of s.results.entries()) {
    if (
      !object(result) ||
      !exact(result, [
        'roundNumber',
        'winner',
        'points',
        'handValues',
        'scores',
      ]) ||
      result.roundNumber !== index + 1 ||
      !seats.includes(result.winner) ||
      !integer(result.points) ||
      !object(result.handValues) ||
      !exact(result.handValues, seats) ||
      !object(result.scores) ||
      !exact(result.scores, seats) ||
      !seats.every(
        (seat) =>
          integer(result.handValues[seat]) && integer(result.scores[seat]),
      ) ||
      result.handValues[result.winner] !== 0 ||
      result.points !==
        Object.values(result.handValues).reduce((a, b) => a + b, 0) ||
      Object.values(totals).some((n) => n >= 500)
    )
      fail();
    totals[result.winner]! += result.points;
    wins[result.winner]!++;
    if (!seats.every((seat) => result.scores[seat] === totals[seat])) fail();
  }
  if (
    !seats.every(
      (seat) => s.scores[seat] === totals[seat] && s.wins[seat] === wins[seat],
    )
  )
    fail();
  const winners = seats.filter((seat) => totals[seat]! >= 500);
  if (
    JSON.stringify(s.winners) !== JSON.stringify(winners) ||
    (s.phase === 'ended') !== (winners.length === 1)
  )
    fail();
  if (s.phase !== 'playing') {
    const result = s.results.at(-1)!;
    if (
      s.hands[result.winner]!.length ||
      !seats.every(
        (seat) => handValue(s.hands[seat]!) === result.handValues[seat],
      )
    )
      fail();
  }
  if (s.latest !== null) {
    const latest = s.latest;
    if (
      !object(latest) ||
      !exact(latest, [
        'serial',
        'actor',
        'verb',
        'text',
        'card',
        'color',
        'targets',
        'drawCount',
      ]) ||
      latest.serial !== s.actionSerial ||
      (latest.actor !== null && !seats.includes(latest.actor)) ||
      ![
        'round-started',
        'play',
        'draw',
        'pass',
        'choose-color',
        'accept-draw-four',
        'challenge-draw-four',
        'declare-uno',
        'catch-uno',
      ].includes(latest.verb) ||
      typeof latest.text !== 'string' ||
      latest.text.length > 500 ||
      !Array.isArray(latest.targets) ||
      latest.targets.some((seat) => !seats.includes(seat)) ||
      !integer(latest.drawCount) ||
      latest.drawCount > 108 ||
      (latest.color !== null && !color(latest.color)) ||
      (latest.card !== null &&
        (!object(latest.card) ||
          JSON.stringify(latest.card) !==
            JSON.stringify(getCard(latest.card.id))))
    )
      fail();
  } else if (s.actionSerial !== 0) fail();
  return structuredClone(s);
}
