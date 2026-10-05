import { original } from '../variants/original';
import { topology } from '../shared/topology';
const grid = topology(original.layout);
import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';
import { categories } from '../rules/cards';
import type { PokemonView } from '../rules/project';

export const memoryProfiles = {
  default: { cards: 2, turns: 3, history: 8, rounds: 1 },
  doubao: { cards: 6, turns: 8, history: 32, rounds: 2 },
  juewu: {
    cards: 6,
    turns: Number.MAX_SAFE_INTEGER,
    history: 128,
    rounds: Number.MAX_SAFE_INTEGER,
  },
} as const;
type LegacyMemory = {
  version: 1;
  roundNumber: number;
  seatId: string;
  cards: (string | null)[];
};
type History = {
  id: number;
  actor: string | null;
  verb: string;
  card: string | null;
};
type Summary = {
  round: number;
  turns: number;
  winners: string[];
  scores: Record<string, number>;
};
export type StrategyMemory =
  | LegacyMemory
  | {
      version: 2;
      roundNumber: number;
      seatId: string;
      cards: (string | null)[];
      ages: number[];
      turn: number;
      lastEvent: number;
      turnSeat: string;
      phase: string;
      history: History[];
      summaries: Summary[];
    };

export function validateMemory(input: unknown): JsonValue {
  if (input === null) return null;
  const value = input as StrategyMemory;
  const keys =
    value?.version === 2
      ? 'ages,cards,history,lastEvent,phase,roundNumber,seatId,summaries,turn,turnSeat,version'
      : 'cards,roundNumber,seatId,version';
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).sort().join(',') !== keys ||
    ![1, 2].includes(value.version) ||
    !Number.isInteger(value.roundNumber) ||
    value.roundNumber < 1 ||
    typeof value.seatId !== 'string' ||
    !value.seatId.length ||
    value.seatId.length > 128 ||
    !Array.isArray(value.cards) ||
    value.cards.length !== grid.count ||
    value.cards.some(
      (id) => id !== null && !categories.some((c) => c.categoryId === id),
    ) ||
    categories.some(
      (c) =>
        value.cards.filter((id) => id === c.categoryId).length > c.quantity,
    )
  )
    throw new Error('Invalid strategy memory');
  if (
    value.version === 2 &&
    (!Array.isArray(value.ages) ||
      value.ages.length !== grid.count ||
      value.ages.some(
        (age) => !Number.isInteger(age) || age < 0 || age > value.turn,
      ) ||
      !Number.isInteger(value.turn) ||
      value.turn < 0 ||
      !Number.isInteger(value.lastEvent) ||
      value.lastEvent < -1 ||
      typeof value.turnSeat !== 'string' ||
      typeof value.phase !== 'string' ||
      !Array.isArray(value.history) ||
      value.history.length > 128 ||
      value.history.some(
        (h) =>
          !h ||
          !Number.isInteger(h.id) ||
          typeof h.verb !== 'string' ||
          !(h.actor === null || typeof h.actor === 'string') ||
          !(h.card === null || categories.some((c) => c.categoryId === h.card)),
      ) ||
      !Array.isArray(value.summaries) ||
      value.summaries.some(
        (s) =>
          !s ||
          !Number.isInteger(s.round) ||
          s.round < 1 ||
          !Number.isInteger(s.turns) ||
          s.turns < 0 ||
          !Array.isArray(s.winners) ||
          s.winners.some((w) => typeof w !== 'string') ||
          !s.scores ||
          Object.values(s.scores).some(
            (score) => typeof score !== 'number' || !Number.isFinite(score),
          ),
      ))
  )
    throw new Error('Invalid strategy memory');
  return structuredClone(value);
}

/** Deduplicated saved observation, exclusively from the owner's projection. */
export function observeMemory(
  input: JsonValue,
  view: PokemonView,
  seatId: string,
  difficulty: BotDifficulty = 'juewu',
): Extract<StrategyMemory, { version: 2 }> {
  const previous = validateMemory(input) as StrategyMemory | null;
  const same =
    previous?.roundNumber === view.roundNumber && previous.seatId === seatId;
  const memory: Extract<StrategyMemory, { version: 2 }> =
    same && previous.version === 2
      ? previous
      : {
          version: 2,
          roundNumber: view.roundNumber,
          seatId,
          cards: same
            ? [...previous.cards]
            : Array<string | null>(grid.count).fill(null),
          ages: Array<number>(grid.count).fill(0),
          turn: 0,
          lastEvent:
            previous?.version === 2 && previous.seatId === seatId
              ? previous.lastEvent
              : previous
                ? (view.events.at(-1)?.id ?? -1)
                : (view.events.at(-1)?.id ?? 0) - 1,
          turnSeat: view.turnSeat,
          phase: view.phase,
          history:
            previous?.version === 2 &&
            previous.seatId === seatId &&
            view.roundNumber > previous.roundNumber
              ? previous.history
              : [],
          summaries:
            previous?.version === 2 &&
            previous.seatId === seatId &&
            view.roundNumber > previous.roundNumber
              ? previous.summaries
              : [],
        };
  const profile = memoryProfiles[difficulty];
  const fresh = view.events.filter((e) => e.id > memory.lastEvent);
  if (
    same &&
    previous.version === 2 &&
    memory.turnSeat === seatId &&
    memory.phase !== 'initial-flip' &&
    !['round-result', 'match-result'].includes(memory.phase) &&
    fresh.length &&
    (view.turnSeat !== seatId ||
      ['round-result', 'match-result'].includes(view.phase))
  )
    memory.turn++;
  for (const event of fresh) {
    const action = event.action;
    if (!action) continue;
    if (action.actor === seatId && action.verb === 'swap') {
      const pair = action.targets.find((t) => t.seat === seatId)?.slots;
      if (pair?.length === 2) {
        const [a, b] = pair as [number, number];
        [memory.cards[a], memory.cards[b]] = [
          memory.cards[b]!,
          memory.cards[a]!,
        ];
        [memory.ages[a], memory.ages[b]] = [memory.ages[b]!, memory.ages[a]!];
      }
    }
    memory.history.push({
      id: event.id,
      actor: action.actor,
      verb: action.verb,
      card: action.cardCategory,
    });
  }
  memory.history = memory.history.slice(-profile.history);
  memory.lastEvent = Math.max(
    memory.lastEvent,
    ...view.events.map((e) => e.id),
  );
  for (let slot = 0; slot < grid.count; slot++) {
    if (
      view.boards[seatId]![slot]!.faceUp ||
      memory.turn - memory.ages[slot]! >= profile.turns
    )
      memory.cards[slot] = null;
  }
  if (view.peek && view.turnSeat === seatId) {
    memory.cards[view.peek.slot] = view.peek.card.categoryId;
    memory.ages[view.peek.slot] = memory.turn;
  }
  const remembered = memory.cards
    .map((id, slot) => ({ id, slot, age: memory.ages[slot]! }))
    .filter((c) => c.id)
    .sort((a, b) => b.age - a.age || b.slot - a.slot);
  for (const card of remembered.slice(profile.cards))
    memory.cards[card.slot] = null;
  if (
    view.roundResult &&
    !memory.summaries.some((s) => s.round === view.roundNumber)
  )
    memory.summaries.push({
      round: view.roundNumber,
      turns: memory.turn,
      winners: [...view.roundResult.winners],
      scores: Object.fromEntries(
        Object.entries(view.roundResult.scores).map(([seat, score]) => [
          seat,
          score.total,
        ]),
      ),
    });
  memory.summaries = memory.summaries.slice(-profile.rounds);
  memory.turnSeat = view.turnSeat;
  memory.phase = view.phase;
  return memory;
}
