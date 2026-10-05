import type { PublicAction } from '@tablemax/game-sdk';
import { card, instancesForSeats, categories } from './cards';
import { scoreBoard, type Score } from './scoring';
import { task } from './research';
export const phases = [
  'research-vote',
  'initial-flip',
  'draw',
  'place',
  'mew-other',
  'mew-self',
  'rocket-meowth',
  'rocket-pikachu',
  'zapdos-direction',
  'zapdos-self',
  'zapdos-receive',
  'snorlax-choice',
  'charizard-choice',
  'charizard-view',
  'mewtwo-target',
  'mewtwo-choice',
  'arceus-choice',
  'greninja-choice',
  'lucario-choice',
  'lucario-draw',
  'row-choice',
  'round-result',
  'match-result',
] as const;
export type Phase = (typeof phases)[number];
export type Action =
  | { type: 'vote-research'; taskId: string }
  | {
      type: 'initial-flip' | 'replace' | 'peek' | 'mewtwo-exchange';
      slot: number;
    }
  | { type: 'mew-target'; seat: string; slot: number }
  | { type: 'draw'; source: 'deck' }
  | { type: 'draw'; source: 'discard'; discardIndex: 0 | 1 }
  | { type: 'swap' | 'reposition'; a: number; b: number }
  | { type: 'mewtwo-target'; seat: string; a: number; b: number }
  | { type: 'ninja-target'; seat: string; a: number; b: number; swap: boolean }
  | { type: 'row-target'; seat: string }
  | { type: 'pass-direction'; direction: 'clockwise' | 'counterclockwise' }
  | {
      type:
        | 'discard-held'
        | 'decline-ability'
        | 'close-peek'
        | 'activate-arceus'
        | 'extra-draw'
        | 'next-round';
    };
export type Slot = { instanceId: string; faceUp: boolean };
export type State = {
  gameId: 'pokemon-encounters';
  variantId: 'expansion';
  rulesVersion: 'tablemax-cn-expansion-v1';
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
  peekSlots: number[];
  targetSeat: string | null;
  suppressedAbility: boolean;
  rowAbility: 'groudon' | 'kyogre' | 'rayquaza' | null;
  researchCandidates: string[];
  votesBySeat: Record<string, string>;
  voteCounts: Record<string, number> | null;
  activeResearch: string[];
  usedOpeningResearch: string[];
  usedHoennResearch: string[];
  hoennTriggered: boolean;
  hoennPending: string | null;
  arceusUsed: boolean;
  preReveal: Record<string, boolean[]> | null;
  roundResult: { scores: Record<string, Score>; winners: string[] } | null;
  matchWinners: string[];
  eventCounter: number;
  events: { id: number; kind: string; text: string; action?: PublicAction }[];
};
export const actor = (s: State) =>
  s.phase === 'zapdos-receive'
    ? s.recipientQueue[s.recipientIndex]!
    : s.turnSeat;
export const decisionId = (s: State, seat: string) =>
  ['research-vote', 'initial-flip'].includes(s.phase)
    ? `r${s.roundNumber}-${s.phase}-${seat}`
    : `r${s.roundNumber}-d${s.step}-${s.phase}-${seat}`;
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
function validActionEvent(input: unknown, seats: readonly string[]): boolean {
  if (!record(input)) return false;
  const a = input as PublicAction,
    keys = Object.keys(a).sort().join(',');
  const verbs = [
    'vote-research',
    'initial-flip',
    'draw',
    'replace',
    'peek',
    'mew-target',
    'mewtwo-target',
    'mewtwo-exchange',
    'swap',
    'reposition',
    'ninja-cover',
    'ninja-swap',
    'row-target',
    'pass-direction',
    'discard-held',
    'decline-ability',
    'close-peek',
    'activate-arceus',
    'extra-draw',
  ];
  if (
    ![
      'ability,actor,cardCategory,targets,verb',
      'ability,actor,cardCategory,source,targets,verb',
    ].includes(keys) ||
    a.actor === null ||
    !seats.includes(a.actor) ||
    !verbs.includes(a.verb) ||
    (a.cardCategory !== null &&
      !categories.some((c) => c.categoryId === a.cardCategory)) ||
    (a.ability !== null && !categories.some((c) => c.ability === a.ability)) ||
    !Array.isArray(a.targets) ||
    a.targets.length > seats.length ||
    new Set(a.targets.map((t) => t?.seat)).size !== a.targets.length
  )
    return false;
  if (
    a.source !== undefined &&
    (a.verb !== 'draw' || !['deck', 'discard'].includes(a.source))
  )
    return false;
  if (
    a.targets.some(
      (t) =>
        !record(t) ||
        Object.keys(t).sort().join(',') !== 'seat,slots' ||
        !seats.includes(t.seat) ||
        !Array.isArray(t.slots) ||
        new Set(t.slots).size !== t.slots.length ||
        t.slots.some((n) => !Number.isInteger(n) || n < 0 || n > 8),
    )
  )
    return false;
  return (
    ![
      'vote-research',
      'peek',
      'close-peek',
      'mewtwo-target',
      'decline-ability',
    ].includes(a.verb) || a.targets.length === 0
  );
}
export function validateState(input: unknown, seats: readonly string[]): State {
  const fail = (): never => {
    throw new Error('Invalid expansion state');
  };
  if (!record(input)) return fail();
  const s = input as State;
  const keys = [
    'gameId',
    'variantId',
    'rulesVersion',
    'stateVersion',
    'roundNumber',
    'seatOrder',
    'winsBySeat',
    'boards',
    'deck',
    'discard',
    'held',
    'phase',
    'turnSeat',
    'initialDone',
    'step',
    'drawSource',
    'coin',
    'recipientQueue',
    'recipientIndex',
    'peekSlots',
    'targetSeat',
    'suppressedAbility',
    'rowAbility',
    'researchCandidates',
    'votesBySeat',
    'voteCounts',
    'activeResearch',
    'usedOpeningResearch',
    'usedHoennResearch',
    'hoennTriggered',
    'hoennPending',
    'arceusUsed',
    'preReveal',
    'roundResult',
    'matchWinners',
    'eventCounter',
    'events',
  ];
  if (
    Object.keys(s).sort().join(',') !== keys.sort().join(',') ||
    s.gameId !== 'pokemon-encounters' ||
    s.variantId !== 'expansion' ||
    s.rulesVersion !== 'tablemax-cn-expansion-v1' ||
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
    !Number.isInteger(s.eventCounter) ||
    s.eventCounter < 0 ||
    !record(s.boards) ||
    !record(s.winsBySeat) ||
    !record(s.votesBySeat)
  )
    return fail();
  const sameKeys = (v: Record<string, unknown>) =>
    Object.keys(v).sort().join(',') === [...seats].sort().join(',');
  if (!sameKeys(s.boards) || !sameKeys(s.winsBySeat)) return fail();
  const stringArray = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((n) => typeof n === 'string');
  if (
    ![
      s.deck,
      s.discard,
      s.initialDone,
      s.recipientQueue,
      s.researchCandidates,
      s.activeResearch,
      s.usedOpeningResearch,
      s.usedHoennResearch,
      s.matchWinners,
    ].every(stringArray) ||
    !Array.isArray(s.peekSlots) ||
    !Array.isArray(s.events) ||
    typeof s.suppressedAbility !== 'boolean' ||
    typeof s.hoennTriggered !== 'boolean' ||
    typeof s.arceusUsed !== 'boolean' ||
    !['deck', 'discard', null].includes(s.drawSource) ||
    !['meowth', 'pikachu', null].includes(s.coin) ||
    ![null, 'groudon', 'kyogre', 'rayquaza'].includes(s.rowAbility) ||
    !Number.isInteger(s.recipientIndex) ||
    s.recipientIndex < 0 ||
    (s.targetSeat !== null && !seats.includes(s.targetSeat))
  )
    return fail();
  const voting = s.phase === 'research-vote',
    result = ['round-result', 'match-result'].includes(s.phase);
  if (
    seats.some(
      (id) =>
        !Array.isArray(s.boards[id]) ||
        s.boards[id]!.length !== (voting ? 0 : 9) ||
        s.boards[id]!.some(
          (c) =>
            !record(c) ||
            Object.keys(c).sort().join(',') !== 'faceUp,instanceId' ||
            typeof c.instanceId !== 'string' ||
            typeof c.faceUp !== 'boolean',
        ) ||
        !Number.isInteger(s.winsBySeat[id]) ||
        s.winsBySeat[id]! < 0 ||
        s.winsBySeat[id]! > 3,
    )
  )
    return fail();
  const all = [
      ...seats.flatMap((id) => s.boards[id]!.map((c) => c.instanceId)),
      ...s.deck,
      ...s.discard,
      ...(s.held === null ? [] : [s.held]),
    ],
    expected = instancesForSeats(seats.length);
  if (
    all.length !== expected.length ||
    new Set(all).size !== expected.length ||
    all.some((id) => !expected.includes(id))
  )
    return fail();
  if (
    s.researchCandidates.length !== 3 ||
    new Set(s.researchCandidates).size !== 3 ||
    s.researchCandidates.some((id) => task(id).pool !== 'opening') ||
    Object.entries(s.votesBySeat).some(
      ([id, v]) => !seats.includes(id) || !s.researchCandidates.includes(v),
    ) ||
    [s.usedOpeningResearch, s.usedHoennResearch, s.activeResearch].some(
      (ids) => new Set(ids).size !== ids.length,
    ) ||
    s.usedOpeningResearch.some((id) => task(id).pool !== 'opening') ||
    s.usedHoennResearch.some((id) => task(id).pool !== 'hoenn') ||
    s.activeResearch.length !==
      (voting ? 0 : s.hoennTriggered && s.hoennPending === null ? 2 : 1) ||
    s.activeResearch.some(
      (id, i) => task(id).pool !== (i === 0 ? 'opening' : 'hoenn'),
    )
  )
    return fail();
  if (voting) {
    if (
      Object.keys(s.votesBySeat).length >= seats.length ||
      s.voteCounts !== null ||
      s.discard.length ||
      s.initialDone.length ||
      s.arceusUsed ||
      s.hoennTriggered ||
      s.held !== null
    )
      return fail();
  } else {
    if (
      Object.keys(s.votesBySeat).length !== seats.length ||
      !record(s.voteCounts) ||
      Object.keys(s.voteCounts).sort().join(',') !==
        [...s.researchCandidates].sort().join(',') ||
      s.researchCandidates.some(
        (id) =>
          s.voteCounts![id] !==
          Object.values(s.votesBySeat).filter((v) => v === id).length,
      ) ||
      !s.researchCandidates.includes(s.activeResearch[0]!) ||
      !s.usedOpeningResearch.includes(s.activeResearch[0]!)
    )
      return fail();
    const highest = Math.max(...Object.values(s.voteCounts));
    if (s.voteCounts[s.activeResearch[0]!] !== highest) return fail();
  }
  if (
    new Set(s.initialDone).size !== s.initialDone.length ||
    s.initialDone.some((id) => !seats.includes(id)) ||
    (!voting &&
      s.phase !== 'initial-flip' &&
      s.initialDone.length !== seats.length)
  )
    return fail();
  if (
    s.phase === 'initial-flip' &&
    (s.initialDone.length === seats.length ||
      s.discard.length !== 2 ||
      s.deck.length !== expected.length - seats.length * 9 - 2 ||
      seats.some((id) =>
        s.boards[id]!.some((c) =>
          ['special-mewtwo', 'special-arceus'].includes(
            card(c.instanceId).categoryId,
          ),
        ),
      ) ||
      seats.some(
        (id) =>
          s.boards[id]!.filter((c) => c.faceUp).length !==
          (s.initialDone.includes(id) ? 1 : 0),
      ))
  )
    return fail();
  const holds = [
    'place',
    'mew-other',
    'mew-self',
    'rocket-meowth',
    'rocket-pikachu',
    'zapdos-direction',
    'zapdos-self',
    'zapdos-receive',
    'mewtwo-target',
    'mewtwo-choice',
  ].includes(s.phase);
  if (
    holds !== (s.held !== null) ||
    s.peekSlots.some((i) => !Number.isInteger(i) || i < 0 || i > 8) ||
    new Set(s.peekSlots).size !== s.peekSlots.length
  )
    return fail();
  if (s.phase === 'charizard-view') {
    if (
      s.peekSlots.length !== 1 ||
      s.targetSeat !== s.turnSeat ||
      s.boards[s.turnSeat]![s.peekSlots[0]!]!.faceUp
    )
      return fail();
  } else if (s.phase === 'mewtwo-choice') {
    if (
      s.peekSlots.length !== 2 ||
      s.targetSeat === null ||
      s.targetSeat === s.turnSeat
    )
      return fail();
  } else if (s.peekSlots.length || s.targetSeat !== null) return fail();
  if (s.phase === 'zapdos-receive' || s.phase === 'zapdos-self') {
    const order = (direction: number) =>
      Array.from(
        { length: seats.length - 1 },
        (_, i) =>
          seats[
            (seats.indexOf(s.turnSeat) + (i + 1) * direction + seats.length) %
              seats.length
          ]!,
      );
    if (
      s.recipientQueue.length !== seats.length - 1 ||
      new Set(s.recipientQueue).size !== s.recipientQueue.length ||
      s.recipientQueue.includes(s.turnSeat) ||
      s.recipientQueue.some((id) => !seats.includes(id)) ||
      s.recipientIndex >= s.recipientQueue.length ||
      ![order(1), order(-1)].some(
        (q) => JSON.stringify(q) === JSON.stringify(s.recipientQueue),
      ) ||
      (s.phase === 'zapdos-self' && s.recipientIndex !== 0)
    )
      return fail();
  } else if (s.recipientQueue.length || s.recipientIndex !== 0) return fail();
  if (
    (s.phase === 'row-choice') !== (s.rowAbility !== null) ||
    (s.phase === 'arceus-choice' && s.arceusUsed) ||
    (s.phase === 'rocket-meowth' && s.coin !== 'meowth') ||
    (s.phase === 'rocket-pikachu' && s.coin !== 'pikachu')
  )
    return fail();
  if (s.suppressedAbility && !['lucario-draw', 'place'].includes(s.phase))
    return fail();
  if (
    s.phase === 'charizard-choice' &&
    s.boards[s.turnSeat]!.every((c) => c.faceUp)
  )
    return fail();
  const required: Partial<Record<Phase, string>> = {
    'mew-other': 'special-mew',
    'mewtwo-target': 'special-mewtwo',
    'mewtwo-choice': 'special-mewtwo',
    'zapdos-direction': 'special-zapdos',
    'rocket-meowth': 'special-team-rocket',
    'rocket-pikachu': 'special-team-rocket',
  };
  if (required[s.phase] && card(s.held!).categoryId !== required[s.phase])
    return fail();
  if (
    s.hoennPending !== null &&
    (!s.hoennTriggered ||
      task(s.hoennPending).pool !== 'hoenn' ||
      !s.usedHoennResearch.includes(s.hoennPending))
  )
    return fail();
  if (
    !s.hoennTriggered &&
    (s.hoennPending !== null || s.activeResearch.length > 1)
  )
    return fail();
  if (
    s.activeResearch.length === 2 &&
    !s.usedHoennResearch.includes(s.activeResearch[1]!)
  )
    return fail();
  if (
    s.hoennPending !== null &&
    [
      'research-vote',
      'initial-flip',
      'draw',
      'round-result',
      'match-result',
    ].includes(s.phase)
  )
    return fail();
  const visibleGods = seats.flatMap((id) =>
    s.boards[id]!.filter((c) => c.faceUp).map(
      (c) => card(c.instanceId).ability,
    ),
  );
  if (
    !result &&
    !s.hoennTriggered &&
    ['groudon', 'kyogre', 'rayquaza'].every((id) =>
      visibleGods.includes(id as 'groudon' | 'kyogre' | 'rayquaza'),
    )
  )
    return fail();
  if (result) {
    if (
      !record(s.preReveal) ||
      !sameKeys(s.preReveal) ||
      seats.some(
        (id) =>
          !Array.isArray(s.preReveal![id]) ||
          s.preReveal![id]!.length !== 9 ||
          s.preReveal![id]!.some((v) => typeof v !== 'boolean') ||
          s.boards[id]!.some((c) => !c.faceUp),
      ) ||
      !record(s.roundResult) ||
      !record(s.roundResult.scores) ||
      !sameKeys(s.roundResult.scores) ||
      !Array.isArray(s.roundResult.winners)
    )
      return fail();
    const scores = Object.fromEntries(
      seats.map((id) => [
        id,
        scoreBoard(
          s.boards[id]!.map((c) => c.instanceId),
          s.activeResearch,
          s.preReveal![id]!,
        ),
      ]),
    );
    const min = Math.min(...Object.values(scores).map((v) => v.total)),
      winners = seats.filter((id) => scores[id]!.total === min);
    if (
      JSON.stringify(scores) !== JSON.stringify(s.roundResult.scores) ||
      JSON.stringify(winners) !== JSON.stringify(s.roundResult.winners) ||
      winners.some((id) => s.winsBySeat[id]! < 1)
    )
      return fail();
  } else if (s.preReveal !== null || s.roundResult !== null) return fail();
  const winners = seats.filter((id) => s.winsBySeat[id] === 3);
  if (
    JSON.stringify(winners) !== JSON.stringify(s.matchWinners) ||
    (s.phase === 'match-result') !== winners.length > 0
  )
    return fail();
  if (
    s.events.length > 60 ||
    s.events.some(
      (e, i) =>
        !record(e) ||
        !Number.isInteger(e.id) ||
        e.id < 1 ||
        e.id > s.eventCounter ||
        (i > 0 && e.id <= s.events[i - 1]!.id) ||
        typeof e.kind !== 'string' ||
        !['vote', 'research', 'draw', 'action', 'round-result'].includes(
          e.kind,
        ) ||
        typeof e.text !== 'string' ||
        e.text.length > 500 ||
        !['id,kind,text', 'action,id,kind,text'].includes(
          Object.keys(e).sort().join(','),
        ) ||
        (e.action !== undefined && !validActionEvent(e.action, seats)),
    )
  )
    return fail();
  return structuredClone(s);
}
