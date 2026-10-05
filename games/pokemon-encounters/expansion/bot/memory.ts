import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';
import { categories } from '../cards';
import type { View } from '../project';

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
              Object.keys(k).sort().join(',') !== 'category,source,turn' ||
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
          lastEvent: -1,
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
  for (const e of view.events.filter((e) => e.id > m.lastEvent)) {
    const a = e.action;
    if (a) {
      const target = a.targets[0];
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
          source: 'public',
          turn: m.turn,
        };
  if (view.peek)
    for (const c of view.peek.cards)
      m.known[view.peek.seat]![c.slot] = {
        category: c.card.categoryId,
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
