import type { Action, PowerGridView } from '../types';
import { maximumProduction } from '../rules/production';

export function encodeMidgameBuild(
  view: PowerGridView,
  action: Action,
  seat: string,
) {
  const player = view.players[seat];
  if (
    !player ||
    view.self?.seatId !== seat ||
    view.actor !== seat ||
    view.phase !== 'building' ||
    view.round <= 1 ||
    Math.max(
      ...Object.values(view.players).map(({ cities }) => cities.length),
    ) >=
      view.endThreshold - 2 ||
    (action.type !== 'build' && action.type !== 'finish')
  )
    return null;
  const option =
    action.type === 'build'
      ? view.buildOptions.find(({ cityId }) => cityId === action.cityId)
      : null;
  if (action.type === 'build' && !option) return null;
  const build = Number(option !== null);
  const cost = option?.cost ?? 0;
  return [
    build,
    cost / 30,
    cost / Math.max(1, view.self.cash),
    (build * (maximumProduction(player.plants) - player.cities.length)) / 10,
    (build * player.cities.length) / view.endThreshold,
    (build * view.step) / 3,
    (option?.connectionCost ?? 0) / 15,
    (option?.buildingCost ?? 0) / 20,
  ];
}
