import type { PokemonView } from '../rules/project';
import type { Action } from '../rules';
import type { View } from '../expansion/project';
import type { Action as ExpansionAction } from '../expansion/state';

function drawFeatures(
  board: readonly { faceUp: boolean; card: { value: number | null } | null }[],
  discard: boolean,
  value: number | null,
  round: number,
  deck: number,
) {
  const visible = board.flatMap(({ card }) =>
    card?.value == null ? [] : [card.value],
  );
  const average =
    visible.reduce((sum, entry) => sum + entry, 0) /
    Math.max(visible.length, 1);
  const take = Number(discard);
  return [
    take,
    (take * (value ?? 0)) / 20,
    take * Number(value === null),
    (take * average) / 20,
    (take * visible.length) / board.length,
    take * Number(value !== null && visible.includes(value)),
    (take * Math.min(round, 10)) / 10,
    (take * Math.min(deck, 100)) / 100,
  ];
}

export function encodeOriginalDraw(
  view: PokemonView,
  action: Action,
  seat: string,
) {
  const board = view.boards[seat];
  if (view.turnSeat !== seat || !board || action.type !== 'draw') return null;
  return drawFeatures(
    board,
    action.source === 'discard',
    view.discardTop?.value ?? null,
    view.roundNumber,
    view.deckCount,
  );
}

export function encodeExpansionDraw(
  view: View,
  action: ExpansionAction,
  seat: string,
) {
  const board = view.boards[seat];
  if (view.turnSeat !== seat || !board || action.type !== 'draw') return null;
  const option =
    action.source === 'discard'
      ? view.discardOptions[action.discardIndex]
      : null;
  return drawFeatures(
    board,
    action.source === 'discard',
    option?.value ?? null,
    view.roundNumber,
    view.deckCount,
  );
}
