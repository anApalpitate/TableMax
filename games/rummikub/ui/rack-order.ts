import type { Tile } from '../types';

export type RackSort = 'color' | 'value' | 'dealt';
export type RackOrder = { ids: string[]; mode: RackSort };

export function sortRack(tiles: Tile[], mode: RackSort): string[] {
  if (mode === 'dealt') return tiles.map((tile) => tile.id);
  return [...tiles]
    .sort((left, right) => {
      const value = (left.value ?? 99) - (right.value ?? 99);
      const color = (left.color ?? 'z').localeCompare(right.color ?? 'z');
      return mode === 'value' ? value || color : color || value;
    })
    .map((tile) => tile.id);
}

/** Presentation only: retain authorized survivors and append newly drawn tiles. */
export function reconcileRackOrder(order: RackOrder, tiles: Tile[]): RackOrder {
  const authorized = new Set(tiles.map((tile) => tile.id));
  const ids = [...new Set(order.ids)].filter((id) => authorized.has(id));
  const known = new Set(ids);
  ids.push(
    ...tiles.filter((tile) => !known.has(tile.id)).map((tile) => tile.id),
  );
  return { ...order, ids };
}

export function restoreRackOrder(value: unknown, tiles: Tile[]): RackOrder {
  if (
    value &&
    typeof value === 'object' &&
    'ids' in value &&
    'mode' in value &&
    Array.isArray(value.ids) &&
    value.ids.length <= 106 &&
    value.ids.every((id) => typeof id === 'string') &&
    (value.mode === 'color' || value.mode === 'value' || value.mode === 'dealt')
  )
    return reconcileRackOrder({ ids: value.ids, mode: value.mode }, tiles);
  return { ids: sortRack(tiles, 'color'), mode: 'color' };
}

export function restoreRackCache(
  value: unknown,
  scope: string,
  tiles: Tile[],
): RackOrder {
  return restoreRackOrder(
    value &&
      typeof value === 'object' &&
      'scope' in value &&
      value.scope === scope &&
      'order' in value
      ? value.order
      : null,
    tiles,
  );
}

export function moveRackTile(
  order: RackOrder,
  id: string,
  before: string | null,
): RackOrder {
  if (!order.ids.includes(id) || before === id) return order;
  if (before !== null && !order.ids.includes(before)) return order;
  const ids = order.ids.filter((entry) => entry !== id);
  ids.splice(before === null ? ids.length : ids.indexOf(before), 0, id);
  return { ...order, ids };
}
