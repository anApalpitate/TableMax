import type { Fuel, Plant, Resource, Stock } from '../types';

export const RULES_VERSION = 'classic-germany-2009-project-1';
export const RESOURCES: readonly Resource[] = [
  'coal',
  'oil',
  'garbage',
  'uranium',
];
export const RESOURCE_LABELS: Record<Resource, string> = {
  coal: '煤',
  oil: '石油',
  garbage: '垃圾',
  uranium: '铀',
};
export const FUEL_LABELS: Record<Fuel, string> = {
  ...RESOURCE_LABELS,
  hybrid: '煤／油',
  green: '环保',
  fusion: '聚变',
};
// Classic base deck, transcribed from the SOB player aid; original-rule card
// illustrations and independent physical-card photos are tracked in sources.md.
const SPECS: [number, Fuel, number, number][] = [
  [3, 'oil', 2, 1],
  [4, 'coal', 2, 1],
  [5, 'hybrid', 2, 1],
  [6, 'garbage', 1, 1],
  [7, 'oil', 3, 2],
  [8, 'coal', 3, 2],
  [9, 'oil', 1, 1],
  [10, 'coal', 2, 2],
  [11, 'uranium', 1, 2],
  [12, 'hybrid', 2, 2],
  [13, 'green', 0, 1],
  [14, 'garbage', 2, 2],
  [15, 'coal', 2, 3],
  [16, 'oil', 2, 3],
  [17, 'uranium', 1, 2],
  [18, 'green', 0, 2],
  [19, 'garbage', 2, 3],
  [20, 'coal', 3, 5],
  [21, 'hybrid', 2, 4],
  [22, 'green', 0, 2],
  [23, 'uranium', 1, 3],
  [24, 'garbage', 2, 4],
  [25, 'coal', 2, 5],
  [26, 'oil', 2, 5],
  [27, 'green', 0, 3],
  [28, 'uranium', 1, 4],
  [29, 'hybrid', 1, 4],
  [30, 'garbage', 3, 6],
  [31, 'coal', 3, 6],
  [32, 'oil', 3, 6],
  [33, 'green', 0, 4],
  [34, 'uranium', 1, 5],
  [35, 'oil', 1, 5],
  [36, 'coal', 3, 7],
  [37, 'green', 0, 4],
  [38, 'garbage', 3, 7],
  [39, 'uranium', 1, 6],
  [40, 'oil', 2, 6],
  [42, 'coal', 2, 6],
  [44, 'green', 0, 5],
  [46, 'hybrid', 3, 7],
  [50, 'fusion', 0, 6],
];
export const PLANTS: readonly Plant[] = SPECS.map(
  ([id, fuel, input, output]) => ({ id, fuel, input, output }),
);
export const PLANT_IDS = PLANTS.map((plant) => plant.id);
export function getPlant(id: number): Plant {
  const plant = PLANTS.find((entry) => entry.id === id);
  if (!plant) throw new Error('未知电厂。');
  return plant;
}
export function emptyStock(): Stock {
  return { coal: 0, oil: 0, garbage: 0, uranium: 0 };
}
export function accepts(plantId: number, resource: Resource): boolean {
  const fuel = getPlant(plantId).fuel;
  return (
    fuel === resource ||
    (fuel === 'hybrid' && (resource === 'coal' || resource === 'oil'))
  );
}
export function totalStock(stock: Stock): number {
  return RESOURCES.reduce((sum, resource) => sum + stock[resource], 0);
}
