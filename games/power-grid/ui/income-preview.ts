import { getPlant } from '../data/catalog';
import { income } from '../data/economy';
import { planProduction, pooledResources } from '../rules/production';
import type { PowerGridView } from '../types';

export type IncomePreview = {
  seatId: string;
  cities: number;
  income: number;
  completed: boolean;
  selectedCities: number | null;
};

/** Read-only estimate from the authorized projection; it never selects a run. */
export function incomePreview(
  view: PowerGridView,
  seatId = view.self?.seatId ?? view.actor ?? view.playerOrder[0],
  selectedCities?: number,
): IncomePreview | null {
  if (!seatId) return null;
  const player = view.players[seatId];
  if (!player) return null;
  const seatIndex = view.playerOrder.indexOf(seatId);
  const actorIndex = view.actor ? view.playerOrder.indexOf(view.actor) : -1;
  const completed =
    view.phase === 'ended' ||
    (view.phase === 'powering' &&
      actorIndex >= 0 &&
      seatIndex >= 0 &&
      seatIndex < actorIndex);
  let cities: number;
  if (completed) {
    cities =
      view.phase === 'ended'
        ? (view.finalResults.find((result) => result.seatId === seatId)
            ?.powered ?? player.powered)
        : player.powered;
  } else {
    const ran = new Set(view.phase === 'powering' ? player.ran : []);
    const produced = [...ran].reduce((sum, id) => sum + getPlant(id).output, 0);
    const remaining = planProduction(
      player.plants.filter((plant) => !ran.has(plant.id)),
      Math.max(0, player.cities.length - produced),
      pooledResources(player.plants),
    ).output;
    cities = Math.min(player.cities.length, produced + remaining);
  }
  // The draft belongs only to the acting phone. It is never public state.
  const ownSelection =
    !completed &&
    view.phase === 'powering' &&
    view.actor === seatId &&
    view.self?.seatId === seatId &&
    selectedCities != null &&
    Number.isInteger(selectedCities) &&
    selectedCities >= 0 &&
    selectedCities <= player.powered
      ? selectedCities
      : null;
  return {
    seatId,
    cities,
    income: income(cities),
    completed,
    selectedCities: ownSelection,
  };
}
