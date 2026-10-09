import { COLORS, type Tile } from '../types';
export { COLORS } from '../types';
export const RULES_VERSION = 'classic-2025-digital-v1';
export const TILES: readonly Tile[] = [
  ...COLORS.flatMap((color) =>
    Array.from({ length: 13 }, (_, index) => index + 1).flatMap((value) =>
      ['a', 'b'].map((copy) => ({
        id: `${color}-${String(value).padStart(2, '0')}-${copy}`,
        color,
        value,
        joker: false,
      })),
    ),
  ),
  { id: 'joker-a', color: null, value: null, joker: true },
  { id: 'joker-b', color: null, value: null, joker: true },
];
export const TILE_IDS = TILES.map((tile) => tile.id);
const tilesById = new Map(TILES.map((tile) => [tile.id, tile]));
export function getTile(id: string): Tile {
  const tile = tilesById.get(id);
  if (!tile) throw new Error('拉密牌不存在。');
  return tile;
}
export function rackValue(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + (getTile(id).value ?? 30), 0);
}
