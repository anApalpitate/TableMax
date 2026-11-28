import type { Action, RummikubView } from '../types';

export function encodeTurn(view: RummikubView, action: Action, seat: string) {
  const self = view.self;
  if (
    self?.seatId !== seat ||
    view.turnSeat !== seat ||
    !self.opened ||
    view.phase !== 'playing' ||
    self.rack.length < 3 ||
    (action.type !== 'submit-turn' && action.type !== 'draw')
  )
    return null;
  const placedIds = new Set(
    action.type === 'submit-turn'
      ? action.table.flatMap(({ tiles }) => tiles.map(({ tileId }) => tileId))
      : [],
  );
  const placed = self.rack.filter(({ id }) => placedIds.has(id));
  if (placed.length === self.rack.length) return null;
  const play = Number(action.type === 'submit-turn');
  const opposing = view.seatOrder
    .filter((id) => id !== seat)
    .map((id) => view.players[id]!.rackCount);
  return [
    play,
    placed.length / self.rack.length,
    placed.reduce((sum, tile) => sum + (tile.value ?? 30), 0) / 120,
    placed.filter(({ joker }) => joker).length / 2,
    (play * Math.min(...opposing)) / 14,
    (play * Math.min(view.poolCount, 60)) / 60,
    (play * self.rack.length) / 24,
    action.type === 'submit-turn' ? (action.releases?.length ?? 0) / 2 : 0,
  ];
}
