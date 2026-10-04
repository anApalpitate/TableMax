import type { Resource, Stock } from '../types';

export const TOTAL_RESOURCES: Stock = {
  coal: 24,
  oil: 24,
  garbage: 24,
  uranium: 12,
};
export const INITIAL_MARKET: Stock = {
  coal: 24,
  oil: 18,
  garbage: 6,
  uranium: 2,
};
export const INCOME = [
  10, 22, 33, 44, 54, 64, 73, 82, 90, 98, 105, 112, 118, 124, 129, 134, 138,
  142, 145, 148, 150,
] as const;
export type PlayerSettings = {
  regions: number;
  removed: number;
  plantLimit: number;
  step2: number;
  end: number;
};
const SETTINGS: Record<number, PlayerSettings> = {
  2: { regions: 3, removed: 8, plantLimit: 4, step2: 10, end: 21 },
  3: { regions: 3, removed: 8, plantLimit: 3, step2: 7, end: 17 },
  4: { regions: 4, removed: 4, plantLimit: 3, step2: 7, end: 17 },
  5: { regions: 5, removed: 0, plantLimit: 3, step2: 7, end: 15 },
  6: { regions: 5, removed: 0, plantLimit: 3, step2: 6, end: 14 },
};
// Columns are coal/oil/garbage/uranium, read from the original printed table.
const REFILL: Record<number, [number, number, number, number][]> = {
  2: [
    [3, 2, 1, 1],
    [4, 2, 2, 1],
    [3, 4, 3, 1],
  ],
  3: [
    [4, 2, 1, 1],
    [5, 3, 2, 1],
    [3, 4, 3, 1],
  ],
  4: [
    [5, 3, 2, 1],
    [6, 4, 3, 2],
    [4, 5, 4, 2],
  ],
  5: [
    [5, 4, 3, 2],
    [7, 5, 3, 3],
    [5, 6, 5, 2],
  ],
  6: [
    [7, 5, 3, 2],
    [9, 6, 5, 3],
    [6, 7, 6, 3],
  ],
};
export function settingsFor(players: number): PlayerSettings {
  const settings = SETTINGS[players];
  if (!settings) throw new Error('电力公司需要 2–6 位玩家。');
  return { ...settings };
}
export function income(cities: number): number {
  return INCOME[Math.min(20, Math.max(0, Math.floor(cities)))]!;
}
export function replenishment(players: number, step: 1 | 2 | 3): Stock {
  const [coal, oil, garbage, uranium] = REFILL[players]![step - 1]!;
  return { coal, oil, garbage, uranium };
}
// Markets are packed from the expensive end; buying removes the cheapest token.
export function price(resource: Resource, count: number): number | null {
  if (count <= 0) return null;
  if (resource === 'uranium')
    return [16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1][count - 1]!;
  return 9 - Math.ceil(count / 3);
}
