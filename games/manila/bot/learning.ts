import type { Action, ManilaView } from '../rules/view';
import { evaluateJuewu } from './juewu';

export function encodePlacement(
  view: ManilaView,
  action: Action,
  seat: string,
) {
  if (
    view.self?.seatId !== seat ||
    view.turnSeat !== seat ||
    view.phase !== 'place' ||
    action.type !== 'place'
  )
    return null;
  const space = view.spaces.find(({ id }) => id === action.space);
  if (!space) return null;
  const boat = view.boats.find(({ cargo }) => cargo === space.cargo);
  const stake = view.self.shares.filter(
    ({ cargo, mortgaged }) => cargo === space.cargo && !mortgaged,
  ).length;
  return [
    evaluateJuewu(view, action) / 25,
    space.cost / 10,
    space.cost / Math.max(1, view.self.cash),
    (space.payout ?? 0) / 40,
    Number(space.kind === 'port'),
    Number(space.kind === 'shipyard'),
    Number(space.kind === 'pirate'),
    Number(space.kind === 'pilot'),
    Number(space.kind === 'insurance'),
    (boat?.position ?? 0) / 15,
    stake / 5,
  ];
}
