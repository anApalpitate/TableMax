import type { JsonValue } from '@tablemax/game-sdk';
import { categories } from '../rules/cards';
import type { PokemonView } from '../rules/project';
import type { Action } from '../rules';

export type StrategyMemory = {
  version: 1;
  roundNumber: number;
  seatId: string;
  cards: (string | null)[];
};

export function validateMemory(input: unknown): JsonValue {
  if (input === null) return null;
  const value = input as StrategyMemory;
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).sort().join(',') !==
      'cards,roundNumber,seatId,version' ||
    value.version !== 1 ||
    !Number.isInteger(value.roundNumber) ||
    value.roundNumber < 1 ||
    typeof value.seatId !== 'string' ||
    !value.seatId.length ||
    value.seatId.length > 128 ||
    !Array.isArray(value.cards) ||
    value.cards.length !== 6 ||
    value.cards.some(
      (id) => id !== null && !categories.some((c) => c.categoryId === id),
    ) ||
    categories.some(
      (c) =>
        value.cards.filter((id) => id === c.categoryId).length > c.quantity,
    )
  )
    throw new Error('Invalid strategy memory');
  return structuredClone(value);
}

// Only the owner's authorized peek survives its temporary display. Other
// players cannot move a hidden owner card without making its replacement public.
export function observeMemory(
  input: JsonValue,
  view: PokemonView,
  seatId: string,
): StrategyMemory {
  const previous = validateMemory(input) as StrategyMemory | null;
  const memory: StrategyMemory =
    previous?.roundNumber === view.roundNumber && previous.seatId === seatId
      ? previous
      : {
          version: 1,
          roundNumber: view.roundNumber,
          seatId,
          cards: Array<string | null>(6).fill(null),
        };
  for (let slot = 0; slot < 6; slot++)
    if (view.boards[seatId]![slot]!.faceUp) memory.cards[slot] = null;
  if (view.peek && view.turnSeat === seatId)
    memory.cards[view.peek.slot] = view.peek.card.categoryId;
  return memory;
}

export function rememberAction(memory: StrategyMemory, action: Action) {
  if (action.type === 'swap')
    [memory.cards[action.a], memory.cards[action.b]] = [
      memory.cards[action.b]!,
      memory.cards[action.a]!,
    ];
  else if (action.type === 'replace') memory.cards[action.slot] = null;
  return memory;
}
