import { getTile } from '../data/catalog';
import { COLORS, type Color, type Meld, type Placement } from '../types';

export type JokerBindings = Record<string, { color: Color; value: number }>;
const colorIndex = (color: Color) => COLORS.indexOf(color);
export function normalizeMeld(input: Meld): Meld {
  if (
    !input ||
    !['run', 'group'].includes(input.kind) ||
    !Array.isArray(input.tiles) ||
    input.tiles.length > 13
  )
    throw new Error('牌组格式无效。');
  const tiles = input.tiles.map((p): Placement => {
    if (
      !p ||
      typeof p.tileId !== 'string' ||
      !COLORS.includes(p.color) ||
      !Number.isInteger(p.value) ||
      p.value < 1 ||
      p.value > 13
    )
      throw new Error('牌面或百搭绑定无效。');
    const tile = getTile(p.tileId);
    if (!tile.joker && (tile.color !== p.color || tile.value !== p.value))
      throw new Error('数字牌不能改变颜色或数字。');
    return { tileId: p.tileId, color: p.color, value: p.value };
  });
  if (new Set(tiles.map((p) => p.tileId)).size !== tiles.length)
    throw new Error('同一张牌不能重复使用。');
  if (input.kind === 'group') {
    if (
      tiles.length < 3 ||
      tiles.length > 4 ||
      new Set(tiles.map((p) => p.value)).size !== 1 ||
      new Set(tiles.map((p) => p.color)).size !== tiles.length
    )
      throw new Error('同数组须为三或四张同数、不同色的牌。');
    tiles.sort((a, b) => colorIndex(a.color) - colorIndex(b.color));
  } else {
    if (
      tiles.length < 3 ||
      tiles.length > 13 ||
      new Set(tiles.map((p) => p.color)).size !== 1
    )
      throw new Error('顺子须为至少三张同色连续数字。');
    tiles.sort((a, b) => a.value - b.value);
    if (tiles.some((p, i) => i > 0 && p.value !== tiles[i - 1]!.value + 1))
      throw new Error('顺子数字必须连续，十三不能接一。');
  }
  return { kind: input.kind, tiles };
}
export function normalizeTable(table: readonly Meld[]): Meld[] {
  if (!Array.isArray(table) || table.length > 35)
    throw new Error('桌面牌组数量无效。');
  const normalized = table.map(normalizeMeld);
  const ids = normalized.flatMap((meld) => meld.tiles.map((p) => p.tileId));
  if (ids.length > 106 || new Set(ids).size !== ids.length)
    throw new Error('桌面重复使用了牌。');
  return normalized;
}
export function tableKey(table: readonly Meld[]): string {
  return JSON.stringify(
    normalizeTable(table)
      .map((m) => JSON.stringify(m))
      .sort(),
  );
}
/** Infer a valid set; explicit bindings always take precedence. */
export function parseMeld(
  ids: readonly string[],
  jokerBindings: JokerBindings = {},
  kind?: Meld['kind'],
): Meld | null {
  if (ids.length < 3 || ids.length > 13 || new Set(ids).size !== ids.length)
    return null;
  try {
    const tiles = ids.map(getTile);
    const naturals = tiles.filter((tile) => !tile.joker);
    const jokers = tiles.filter((tile) => tile.joker);
    const attempt = (
      k: Meld['kind'],
      assignments: JokerBindings,
    ): Meld | null => {
      try {
        return normalizeMeld({
          kind: k,
          tiles: tiles.map((tile) => ({
            tileId: tile.id,
            color: tile.color ?? assignments[tile.id]!.color,
            value: tile.value ?? assignments[tile.id]!.value,
          })),
        });
      } catch {
        return null;
      }
    };
    if (
      (!kind || kind === 'group') &&
      ids.length <= 4 &&
      naturals.length &&
      new Set(naturals.map((tile) => tile.value)).size === 1
    ) {
      const assignments: JokerBindings = { ...jokerBindings };
      const occupied = new Set(naturals.map((tile) => tile.color!));
      for (const joker of jokers) {
        const supplied = assignments[joker.id];
        if (supplied) occupied.add(supplied.color);
      }
      for (const joker of jokers) {
        if (assignments[joker.id]) continue;
        const color = COLORS.find((candidate) => !occupied.has(candidate));
        if (!color) break;
        assignments[joker.id] = { color, value: naturals[0]!.value! };
        occupied.add(color);
      }
      const group = attempt('group', assignments);
      if (group) return group;
    }
    if (
      (!kind || kind === 'run') &&
      naturals.length &&
      new Set(naturals.map((tile) => tile.color)).size === 1
    ) {
      const color = naturals[0]!.color!;
      for (let start = 1; start + ids.length - 1 <= 13; start++) {
        const occupied = new Set(naturals.map((tile) => tile.value!));
        if (
          naturals.some(
            (tile) => tile.value! < start || tile.value! >= start + ids.length,
          )
        )
          continue;
        const assignments: JokerBindings = { ...jokerBindings };
        for (const joker of jokers) {
          const supplied = assignments[joker.id];
          if (supplied) occupied.add(supplied.value);
        }
        for (const joker of jokers) {
          if (assignments[joker.id]) continue;
          const value = Array.from(
            { length: ids.length },
            (_, i) => start + i,
          ).find((candidate) => !occupied.has(candidate));
          if (value === undefined) break;
          assignments[joker.id] = { color, value };
          occupied.add(value);
        }
        const run = attempt('run', assignments);
        if (run) return run;
      }
    }
  } catch {
    return null;
  }
  return null;
}
