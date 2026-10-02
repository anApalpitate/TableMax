import { instances } from './cards';
import { scoreBoard, type Score } from './scoring';
import type { PublicAction } from '@tablemax/game-sdk';
import { validPublicAction } from './public-actions';

export const phases = [
  'initial-flip',
  'draw',
  'place',
  'mew-other',
  'mew-self',
  'rocket-meowth',
  'rocket-pikachu',
  'zapdos-self',
  'zapdos-receive',
  'snorlax-choice',
  'charizard-choice',
  'charizard-view',
  'round-result',
  'match-result',
] as const;
export type Phase = (typeof phases)[number];
export type Slot = { instanceId: string; faceUp: boolean };
export type State = {
  gameId: 'pokemon-encounters';
  rulesVersion: 'tablemax-cn-s19-v1';
  stateVersion: 1;
  roundNumber: number;
  seatOrder: string[];
  winsBySeat: Record<string, number>;
  boards: Record<string, Slot[]>;
  deck: string[];
  discard: string[];
  held: string | null;
  phase: Phase;
  turnSeat: string;
  initialDone: string[];
  step: number;
  drawSource: 'deck' | 'discard' | null;
  coin: 'meowth' | 'pikachu' | null;
  recipientQueue: string[];
  recipientIndex: number;
  peekSlot: number | null;
  roundResult: { scores: Record<string, Score>; winners: string[] } | null;
  matchWinners: string[];
  events: {
    id: number;
    kind: 'draw' | 'replace' | 'effect-complete' | 'round-result';
    text: string;
    action?: PublicAction;
  }[];
};

export function actor(s: State): string {
  return s.phase === 'zapdos-receive'
    ? s.recipientQueue[s.recipientIndex]!
    : s.turnSeat;
}
export function decisionId(s: State, seat: string) {
  return `r${s.roundNumber}-d${s.step}-${s.phase}-${seat}`;
}

export function validateState(input: unknown, seats: readonly string[]): State {
  const s = input as State;
  const fail = () => {
    throw new Error('Invalid Pokemon state');
  };
  if (
    !s ||
    s.gameId !== 'pokemon-encounters' ||
    s.rulesVersion !== 'tablemax-cn-s19-v1' ||
    s.stateVersion !== 1 ||
    !Array.isArray(s.seatOrder) ||
    JSON.stringify(s.seatOrder) !== JSON.stringify(seats) ||
    seats.length < 2 ||
    seats.length > 6 ||
    new Set(seats).size !== seats.length ||
    !phases.includes(s.phase) ||
    !seats.includes(s.turnSeat) ||
    !Number.isInteger(s.roundNumber) ||
    s.roundNumber < 1 ||
    !Number.isInteger(s.step) ||
    s.step < 0 ||
    !s.boards ||
    !s.winsBySeat ||
    !Array.isArray(s.deck) ||
    !Array.isArray(s.discard) ||
    !Array.isArray(s.initialDone) ||
    !Array.isArray(s.recipientQueue) ||
    !Array.isArray(s.matchWinners) ||
    !Array.isArray(s.events)
  )
    return fail();
  if (
    Object.keys(s.boards).length !== seats.length ||
    Object.keys(s.winsBySeat).length !== seats.length ||
    seats.some(
      (seat) =>
        !Number.isInteger(s.winsBySeat[seat]) ||
        s.winsBySeat[seat]! < 0 ||
        s.winsBySeat[seat]! > 3 ||
        !Array.isArray(s.boards[seat]) ||
        s.boards[seat]!.length !== 6 ||
        s.boards[seat]!.some(
          (slot) =>
            !slot ||
            typeof slot.instanceId !== 'string' ||
            typeof slot.faceUp !== 'boolean',
        ),
    )
  )
    return fail();
  const all = [
    ...seats.flatMap((seat) => s.boards[seat]!.map((slot) => slot.instanceId)),
    ...s.deck,
    ...s.discard,
    ...(s.held === null ? [] : [s.held]),
  ];
  if (
    all.length !== 56 ||
    new Set(all).size !== 56 ||
    all.some((id) => !instances.includes(id))
  )
    return fail();
  if (
    !['deck', 'discard', null].includes(s.drawSource) ||
    !['meowth', 'pikachu', null].includes(s.coin) ||
    (s.peekSlot !== null &&
      (!Number.isInteger(s.peekSlot) || s.peekSlot < 0 || s.peekSlot > 5)) ||
    !Number.isInteger(s.recipientIndex) ||
    s.recipientIndex < 0 ||
    new Set(s.initialDone).size !== s.initialDone.length ||
    s.initialDone.some((seat) => !seats.includes(seat))
  )
    return fail();
  const result = s.phase === 'round-result' || s.phase === 'match-result';
  const holds = [
    'place',
    'mew-other',
    'mew-self',
    'rocket-meowth',
    'rocket-pikachu',
    'zapdos-self',
    'zapdos-receive',
  ].includes(s.phase);
  if (
    holds !== (s.held !== null) ||
    (s.phase === 'initial-flip' &&
      (s.initialDone.length >= seats.length ||
        s.drawSource !== null ||
        s.deck.length !== 56 - seats.length * 6 ||
        s.discard.length !== 0 ||
        seats.some(
          (seat) =>
            s.boards[seat]!.filter((c) => c.faceUp).length !==
            (s.initialDone.includes(seat) ? 1 : 0),
        ))) ||
    (s.phase !== 'initial-flip' && s.initialDone.length !== seats.length)
  )
    return fail();
  const required: Partial<Record<Phase, string>> = {
    'mew-other': 'special-mew',
    'rocket-meowth': 'special-team-rocket',
    'rocket-pikachu': 'special-team-rocket',
    'zapdos-self': 'special-zapdos',
  };
  if (required[s.phase] && s.held?.split('#')[0] !== required[s.phase])
    return fail();
  if (
    (s.phase === 'rocket-meowth' && s.coin !== 'meowth') ||
    (s.phase === 'rocket-pikachu' && s.coin !== 'pikachu')
  )
    return fail();
  const queue = Array.from(
    { length: seats.length - 1 },
    (_, i) => seats[(seats.indexOf(s.turnSeat) + i + 1) % seats.length]!,
  );
  if (s.phase === 'zapdos-receive') {
    if (
      JSON.stringify(queue) !== JSON.stringify(s.recipientQueue) ||
      s.recipientIndex >= queue.length
    )
      return fail();
  } else if (s.recipientQueue.length !== 0 || s.recipientIndex !== 0)
    return fail();
  if (s.phase === 'charizard-view') {
    if (s.peekSlot === null || s.boards[s.turnSeat]![s.peekSlot]!.faceUp)
      return fail();
  } else if (s.peekSlot !== null) return fail();
  if (
    s.phase === 'charizard-choice' &&
    s.boards[s.turnSeat]!.every((c) => c.faceUp)
  )
    return fail();
  if (result) {
    if (
      !s.roundResult ||
      s.held !== null ||
      seats.some((seat) => s.boards[seat]!.some((c) => !c.faceUp))
    )
      return fail();
    const scores = Object.fromEntries(
      seats.map((seat) => [
        seat,
        scoreBoard(s.boards[seat]!.map((c) => c.instanceId)),
      ]),
    );
    const min = Math.min(...Object.values(scores).map((v) => v.total));
    const winners = seats.filter((seat) => scores[seat]!.total === min);
    if (
      JSON.stringify(scores) !== JSON.stringify(s.roundResult.scores) ||
      JSON.stringify(winners) !== JSON.stringify(s.roundResult.winners) ||
      winners.some((seat) => s.winsBySeat[seat]! < 1)
    )
      return fail();
  } else if (s.roundResult !== null) return fail();
  const match = seats.filter((seat) => s.winsBySeat[seat] === 3);
  if (
    JSON.stringify(match) !== JSON.stringify(s.matchWinners) ||
    (s.phase === 'match-result') !== match.length > 0
  )
    return fail();
  if (
    s.events.length > 30 ||
    s.events.some(
      (event, i) =>
        !Number.isInteger(event.id) ||
        event.id < 1 ||
        event.id > s.step ||
        (i > 0 && event.id <= s.events[i - 1]!.id) ||
        !['draw', 'replace', 'effect-complete', 'round-result'].includes(
          event.kind,
        ) ||
        typeof event.text !== 'string' ||
        event.text.length > 100 ||
        (event.action !== undefined && !validPublicAction(event.action, seats)),
    )
  )
    return fail();
  return structuredClone(s);
}
