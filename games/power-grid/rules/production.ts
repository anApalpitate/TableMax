import { emptyStock, getPlant, RESOURCES } from '../data/catalog';
import type { OwnedPlant, Resource, Stock } from '../types';

export function pooledResources(plants: readonly OwnedPlant[]): Stock {
  const stock = emptyStock();
  for (const plant of plants)
    for (const resource of RESOURCES)
      stock[resource] += plant.resources[resource];
  return stock;
}
export function fuelUse(plantId: number, coal: number): Stock {
  const plant = getPlant(plantId);
  const used = emptyStock();
  if (plant.fuel === 'hybrid') {
    used.coal = coal;
    used.oil = plant.input - coal;
  } else if (plant.input > 0) used[plant.fuel as Resource] = plant.input;
  return used;
}
export function runChoices(plant: OwnedPlant): number[] {
  const face = getPlant(plant.id);
  if (face.fuel === 'hybrid')
    return Array.from({ length: face.input + 1 }, (_, coal) => coal).filter(
      (coal) =>
        plant.resources.coal >= coal &&
        plant.resources.oil >= face.input - coal,
    );
  return RESOURCES.every(
    (resource) => plant.resources[resource] >= fuelUse(plant.id, 0)[resource],
  )
    ? [0]
    : [];
}
// A small resource-budget dynamic program. Equivalent budget states merge;
// production never enumerates complete UI action combinations.
export function planProduction(
  plants: readonly OwnedPlant[],
  cities = 42,
  available = pooledResources(plants),
) {
  type Plan = {
    used: Stock;
    output: number;
    runs: { plantId: number; coal: number }[];
  };
  let frontier = new Map<string, Plan>([
    ['0,0,0,0', { used: emptyStock(), output: 0, runs: [] }],
  ]);
  for (const owned of plants) {
    const plant = getPlant(owned.id);
    const next = new Map(frontier);
    const choices =
      plant.fuel === 'hybrid'
        ? Array.from({ length: plant.input + 1 }, (_, i) => i)
        : [0];
    for (const entry of frontier.values())
      for (const coal of choices) {
        const need = fuelUse(plant.id, coal),
          used = emptyStock();
        for (const resource of RESOURCES)
          used[resource] = entry.used[resource] + need[resource];
        if (RESOURCES.some((resource) => used[resource] > available[resource]))
          continue;
        const key = RESOURCES.map((resource) => used[resource]).join(',');
        const output = Math.min(cities, entry.output + plant.output);
        if (output > (next.get(key)?.output ?? -1))
          next.set(key, {
            used,
            output,
            runs: [...entry.runs, { plantId: plant.id, coal }],
          });
      }
    frontier = next;
  }
  return [...frontier.values()].sort(
    (a, b) =>
      b.output - a.output ||
      RESOURCES.reduce((n, r) => n + a.used[r] - b.used[r], 0) ||
      a.runs.length - b.runs.length,
  )[0]!;
}
export function maximumProduction(
  plants: readonly OwnedPlant[],
  cities = 42,
): number {
  return planProduction(plants, cities).output;
}
