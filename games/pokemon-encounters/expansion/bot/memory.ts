import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';
import { categories } from '../cards';
import type { View } from '../project';
import { trickRoomMap } from '../events';

export const profiles = {
  default: { privateCards: 2, lifetime: 3, history: 8, rounds: 1 },
  doubao: { privateCards: 6, lifetime: 8, history: 32, rounds: 2 },
  juewu: {
    privateCards: 54,
    lifetime: Number.MAX_SAFE_INTEGER,
    history: 128,
    rounds: 13,
  },
} as const;
type Knowledge = {
  category: string;
  originalCategory?: string;
  abilityUsed?: boolean;
  source: 'public' | 'private';
  turn: number;
};
export type Memory = {
  version: 1;
  round: number;
  seat: string;
  turn: number;
  lastEvent: number;
  turnSeat: string;
  phase: string;
  known: Record<string, (Knowledge | null)[]>;
  history: {
    id: number;
    actor: string | null;
    verb: string;
    card: string | null;
  }[];
  summaries: {
    round: number;
    winners: string[];
    scores: Record<string, number>;
  }[];
};
const categoryIds = new Set(categories.map((c) => c.categoryId));
export function validateMemory(input: unknown): JsonValue {
  if (input === null) return null;
  const m = input as Memory;
  if (
    !m ||
    typeof m !== 'object' ||
    Array.isArray(m) ||
    Object.keys(m).sort().join(',') !==
      'history,known,lastEvent,phase,round,seat,summaries,turn,turnSeat,version' ||
    m.version !== 1 ||
    !Number.isSafeInteger(m.round) ||
    m.round < 1 ||
    typeof m.seat !== 'string' ||
    !m.seat ||
    typeof m.turnSeat !== 'string' ||
    typeof m.phase !== 'string' ||
    !Number.isSafeInteger(m.turn) ||
    m.turn < 0 ||
    !Number.isSafeInteger(m.lastEvent) ||
    m.lastEvent < -1 ||
    !m.known ||
    typeof m.known !== 'object' ||
    Array.isArray(m.known) ||
    Object.keys(m.known).length < 2 ||
    Object.keys(m.known).length > 6 ||
    !m.known[m.seat] ||
    Object.values(m.known).some(
      (board) =>
        !Array.isArray(board) ||
        board.length !== 9 ||
        board.some(
          (k) =>
            k !== null &&
            (!k ||
              Object.keys(k).some(
                (key) =>
                  ![
                    'category',
                    'originalCategory',
                    'abilityUsed',
                    'source',
                    'turn',
                  ].includes(key),
              ) ||
              (k.originalCategory !== undefined &&
                !categoryIds.has(k.originalCategory)) ||
              (k.abilityUsed !== undefined &&
                typeof k.abilityUsed !== 'boolean') ||
              !categoryIds.has(k.category) ||
              !['public', 'private'].includes(k.source) ||
              !Number.isSafeInteger(k.turn) ||
              k.turn < 0 ||
              k.turn > m.turn),
        ),
    ) ||
    !Array.isArray(m.history) ||
    m.history.length > 128 ||
    m.history.some(
      (h) =>
        !h ||
        Object.keys(h).sort().join(',') !== 'actor,card,id,verb' ||
        !Number.isSafeInteger(h.id) ||
        h.id < 0 ||
        !(h.actor === null || typeof h.actor === 'string') ||
        typeof h.verb !== 'string' ||
        !(h.card === null || categoryIds.has(h.card)),
    ) ||
    !Array.isArray(m.summaries) ||
    m.summaries.length > 13 ||
    m.summaries.some(
      (s) =>
        !s ||
        Object.keys(s).sort().join(',') !== 'round,scores,winners' ||
        !Number.isSafeInteger(s.round) ||
        s.round < 1 ||
        !Array.isArray(s.winners) ||
        s.winners.some((w) => typeof w !== 'string') ||
        !s.scores ||
        typeof s.scores !== 'object' ||
        Object.values(s.scores).some((n) => !Number.isFinite(n)),
    )
  )
    throw new Error('Invalid expansion bot memory');
  return structuredClone(m) as JsonValue;
}

export function observeMemory(
  input: JsonValue,
  view: View,
  seat: string,
  difficulty: BotDifficulty,
): Memory {
  validateMemory(input);
  const old = input as Memory | null;
  if (!view.seatOrder.includes(seat)) throw new Error('Invalid observing seat');
  const m: Memory =
    old && old.round === view.roundNumber && old.seat === seat
      ? structuredClone(old)
      : {
          version: 1,
          round: view.roundNumber,
          seat,
          turn: 0,
          // A new round or restored observer has no slot trajectory to replay.
          // Retained events may belong to the previous round; current visible
          // faces and the authorized peek below establish the new knowledge.
          lastEvent: view.events.at(-1)?.id ?? -1,
          turnSeat: view.turnSeat,
          phase: view.phase,
          known: Object.fromEntries(
            view.seatOrder.map((id) => [
              id,
              Array<Knowledge | null>(9).fill(null),
            ]),
          ),
          history: old?.history ?? [],
          summaries: old?.summaries ?? [],
        };
  if (m.turnSeat === seat && view.turnSeat !== seat && view.phase === 'draw')
    m.turn++;
  // A missing public trajectory cannot leave a remembered identity attached to
  // its old slot. Current authorized faces below repopulate what is still known.
  const firstEvent = view.events[0];
  if (
    old &&
    old.round === view.roundNumber &&
    firstEvent &&
    firstEvent.id > m.lastEvent + 1
  )
    for (const board of Object.values(m.known)) board.fill(null);
  let rocketCoin: 'meowth' | 'pikachu' | null =
    m.phase === 'rocket-pikachu'
      ? 'pikachu'
      : m.phase === 'rocket-meowth'
        ? 'meowth'
        : null;
  const trickEvent = view.events.find(
    (event) => event.effect?.eventKind === 'trick-room',
  );
  for (const e of view.events.filter((e) => e.id > m.lastEvent)) {
    if (e.kind === 'special-event' && e.effect?.eventKind === 'trick-room')
      for (const board of Object.values(m.known))
        for (const known of board)
          if (known) {
            known.originalCategory ??= known.category;
            known.category = trickRoomMap[known.category] ?? known.category;
          }
    // The public effect identifies the previously visible source slot before
    // a cover/swap, never the real instance ID or any hidden card identity.
    const source = e.effect?.source;
    if (source) {
      const known = m.known[source.seat]?.[source.slot];
      if (known) known.abilityUsed = true;
    }
    const a = e.action;
    if (a) {
      const target = a.targets[0];
      if (a.verb === 'draw' || a.verb === 'draw-buffer')
        rocketCoin = e.effect?.coin ?? null;
      if (
        target &&
        ['replace', 'mew-target', 'mewtwo-exchange'].includes(a.verb)
      ) {
        const rocketReplacement =
          a.verb === 'replace' &&
          a.ability === 'team-rocket' &&
          a.cardCategory === 'special-team-rocket';
        if (rocketReplacement && rocketCoin !== 'meowth') {
          // Pikachu replaces this column for everyone; the action does not
          // identify each supplement. Unknown old faces are no longer valid.
          for (const board of Object.values(m.known))
            for (const slot of target.slots) board[slot] = null;
        } else {
          const role = a.cardCategory;
          const originalCertain =
            view.rulesProfile !== 'events-research-v3' ||
            view.currentEvent?.kind !== 'trick-room' ||
            (trickEvent !== undefined && trickEvent.id > e.id) ||
            (role !== null && trickRoomMap[role] === undefined);
          for (const slot of target.slots)
            m.known[target.seat]![slot] =
              role === null
                ? null
                : {
                    category: role,
                    ...(view.rulesProfile === 'events-research-v3' &&
                    originalCertain
                      ? { originalCategory: role }
                      : {}),
                    source: 'public',
                    turn: m.turn,
                  };
        }
      }
      if (target && ['swap', 'reposition', 'ninja-swap'].includes(a.verb)) {
        const board = m.known[target.seat];
        const [x, y] = target.slots;
        if (board && x !== undefined && y !== undefined)
          [board[x], board[y]] = [board[y]!, board[x]!];
      }
      if (target && a.verb === 'row-target' && a.actor) {
        const own = m.known[a.actor],
          other = m.known[target.seat];
        if (own && other)
          for (const slot of target.slots)
            [own[slot], other[slot]] = [other[slot]!, own[slot]!];
      }
      m.history.push({
        id: e.id,
        actor: a.actor,
        verb: a.verb,
        card: a.cardCategory,
      });
    }
    m.lastEvent = e.id;
  }
  for (const id of view.seatOrder)
    for (const [i, c] of (view.boards[id] ?? []).entries())
      if (c.card)
        m.known[id]![i] = {
          category: c.card.categoryId,
          ...(view.rulesProfile === 'events-research-v3'
            ? {
                originalCategory:
                  c.card.originalCategoryId ?? c.card.categoryId,
              }
            : {}),
          abilityUsed: c.card.abilityUsed ?? false,
          source: 'public',
          turn: m.turn,
        };
  if (view.peek)
    for (const c of view.peek.cards)
      m.known[view.peek.seat]![c.slot] = {
        category: c.card.categoryId,
        ...(view.rulesProfile === 'events-research-v3'
          ? { originalCategory: c.card.originalCategoryId ?? c.card.categoryId }
          : {}),
        abilityUsed: c.card.abilityUsed ?? false,
        source: view.boards[view.peek.seat]?.[c.slot]?.faceUp
          ? 'public'
          : 'private',
        turn: m.turn,
      };
  const profile = profiles[difficulty];
  const privateEntries = Object.values(m.known)
    .flatMap((board) => board.map((k, i) => ({ board, k, i })))
    .filter((entry) => entry.k?.source === 'private')
    .sort((a, b) => b.k!.turn - a.k!.turn);
  privateEntries.forEach(({ board, k, i }, index) => {
    if (index >= profile.privateCards || m.turn - k!.turn >= profile.lifetime)
      board[i] = null;
  });
  m.history = m.history.slice(-profile.history);
  if (
    view.roundResult &&
    !m.summaries.some((s) => s.round === view.roundNumber)
  )
    m.summaries.push({
      round: view.roundNumber,
      winners: [...view.roundResult.winners],
      scores: Object.fromEntries(
        Object.entries(view.roundResult.scores).map(([id, score]) => [
          id,
          score.total,
        ]),
      ),
    });
  m.summaries = m.summaries.slice(-profile.rounds);
  m.turnSeat = view.turnSeat;
  m.phase = view.phase;
  return m;
}
