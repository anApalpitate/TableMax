import { emptyStock, RESOURCES } from '../data/catalog';
import { price } from '../data/economy';
import { CITIES, shortestConnection } from '../data/germany';
import {
  maximumProduction,
  planProduction,
  pooledResources,
} from '../rules/production';
import type { Action, OwnedPlant, PowerGridView, Resource } from '../types';

type Purchase = Extract<Action, { type: 'buy-resource' }>;
type Build = Extract<Action, { type: 'build' }>;

export function gridLeader(view: PowerGridView): string | undefined {
  const ranked = Object.entries(view.players)
    .map(([seat, player]) => ({
      seat,
      production: maximumProduction(player.plants, player.cities.length),
      cities: player.cities.length,
    }))
    .sort((a, b) => b.production - a.production || b.cities - a.cities);
  const [first, second] = ranked;
  return first &&
    second &&
    first.seat !== view.self!.seatId &&
    (first.production > second.production ||
      (first.production === second.production &&
        first.cities >= second.cities + 2))
    ? first.seat
    : undefined;
}

function buyLater(view: PowerGridView, seat: string) {
  return (
    view.playerOrder.indexOf(seat) < view.playerOrder.indexOf(view.self!.seatId)
  );
}

function availableFuel(view: PowerGridView, plants: readonly OwnedPlant[]) {
  const stock = pooledResources(plants);
  for (const resource of RESOURCES) stock[resource] += view.resources[resource];
  return stock;
}

export function plantPressure(view: PowerGridView, leader: string | undefined) {
  const auction = view.auction!;
  if (!leader || auction.highBidder !== leader) return 0;
  const opened = view.history
    .map(({ verb, plantId }) => verb === 'offer' && plantId === auction.plantId)
    .lastIndexOf(true);
  if (
    opened < 0 ||
    view.history
      .slice(opened + 1)
      .filter(
        (entry) => entry.verb === 'bid' && entry.actor === view.self!.seatId,
      ).length >= 3
  )
    return 0;
  const player = view.players[leader]!;
  // Include market stock as an upper estimate, without assuming a rival can pay.
  const stock = availableFuel(view, player.plants);
  const maximum = player.cities.length + 1;
  const current = planProduction(player.plants, maximum, stock).output;
  const candidate = { id: auction.plantId, resources: emptyStock() };
  const available = [...player.plants, candidate];
  const options =
    available.length > view.plantLimit
      ? player.plants.map((old) => available.filter(({ id }) => id !== old.id))
      : [available];
  const proposed = Math.max(
    ...options.map((plants) => planProduction(plants, maximum, stock).output),
  );
  return proposed > current ? 3 : 0;
}

export function fuelPressure(
  view: PowerGridView,
  leader: string,
  base: Purchase,
  alternatives: readonly Purchase[],
) {
  if (!buyLater(view, leader)) return base;
  const player = view.players[leader]!;
  const stock = availableFuel(view, player.plants);
  const productionAfter = (purchase: Purchase) =>
    planProduction(player.plants, player.cities.length, {
      ...stock,
      [purchase.resource]: stock[purchase.resource] - (purchase.quantity ?? 1),
    }).output;
  const cost = (resource: Resource, quantity: number) =>
    Array.from(
      { length: quantity },
      (_, i) => price(resource, view.resources[resource] - i) ?? Infinity,
    ).reduce((sum, current) => sum + current, 0);
  const baseCost = cost(base.resource, base.quantity ?? 1);
  let remainingProduction = productionAfter(base);
  let best = base;
  for (const option of alternatives) {
    if (
      option.resource === base.resource ||
      cost(option.resource, option.quantity ?? 1) > baseCost + 1
    )
      continue;
    const after = productionAfter(option);
    if (after < remainingProduction) {
      remainingProduction = after;
      best = option;
    }
  }
  return best;
}

export function cityPressure(
  view: PowerGridView,
  leader: string,
  base: Build,
  alternatives: readonly Build[],
  nextCity: string | undefined,
  signal?: AbortSignal,
) {
  if (!buyLater(view, leader)) return base;
  const target = view.players[leader]!;
  if (!target.cities.length) return base;
  const own = view.players[view.self!.seatId]!;
  const cost = new Map(
    view.buildOptions.map((option) => [option.cityId, option.cost]),
  );
  const remaining = new Map<string, number>();
  for (const player of Object.values(view.players))
    for (const cityId of player.cities)
      remaining.set(cityId, (remaining.get(cityId) ?? 0) + 1);
  const eligible = alternatives.filter(
    ({ cityId }) =>
      !target.cities.includes(cityId) &&
      (cost.get(cityId) ?? Infinity) <= cost.get(base.cityId)! + 2 &&
      (remaining.get(cityId) ?? 0) === view.step - 1,
  );
  if (!eligible.length) return base;

  const options = CITIES.filter(
    ({ id, region }) =>
      view.regions.includes(region) &&
      !target.cities.includes(id) &&
      (remaining.get(id) ?? 0) < view.step,
  )
    .map(({ id }) => {
      if (signal?.aborted) throw new Error('策略已取消。');
      return {
        id,
        cost:
          (shortestConnection(target.cities, id, view.regions)?.cost ??
            Infinity) +
          10 +
          5 * (remaining.get(id) ?? 0),
      };
    })
    .sort((a, b) => a.cost - b.cost);
  const [nearest, second] = options;
  if (
    !nearest ||
    !second ||
    nearest.id === base.cityId ||
    !(second.cost > nearest.cost)
  )
    return base;
  const preferred = eligible.find(({ cityId }) => cityId === nearest.id);
  if (!preferred) return base;
  if (nextCity && nextCity !== preferred.cityId) {
    const link = (cityId: string) =>
      shortestConnection([...own.cities, cityId], nextCity, view.regions)
        ?.cost ?? Infinity;
    if (link(preferred.cityId) > link(base.cityId) + 1) return base;
  }
  return preferred;
}
