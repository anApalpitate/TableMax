import { describe, expect, it } from 'vitest';
import type { Tile } from '../types';
import {
  moveRackTile,
  reconcileRackOrder,
  restoreRackOrder,
  restoreRackCache,
  sortRack,
} from './rack-order';

const tiles: Tile[] = [
  { id: 'red-03-a', color: 'red', value: 3, joker: false },
  { id: 'blue-02-a', color: 'blue', value: 2, joker: false },
  { id: 'black-02-a', color: 'black', value: 2, joker: false },
];

describe('Rummikub authorized local rack order', () => {
  it('refuses a cached order from a different instance or stable seat', () => {
    const order = { ids: tiles.map((tile) => tile.id), mode: 'dealt' as const };
    const cache = { scope: 'instance:a', order };
    expect(restoreRackCache(cache, 'instance:a', tiles)).toEqual(order);
    for (const scope of ['instance:b', 'other:a'])
      expect(restoreRackCache(cache, scope, tiles)).toEqual({
        ids: sortRack(tiles, 'color'),
        mode: 'color',
      });
  });
  it('keeps custom survivors in place and appends a newly drawn tile', () => {
    const order = { ids: [tiles[1]!.id, tiles[0]!.id], mode: 'value' as const };
    expect(reconcileRackOrder(order, tiles).ids).toEqual([
      tiles[1]!.id,
      tiles[0]!.id,
      tiles[2]!.id,
    ]);
    expect(order.ids).toEqual([tiles[1]!.id, tiles[0]!.id]);
  });

  it('restores only currently authorized unique IDs and rejects malformed caches', () => {
    expect(
      restoreRackOrder(
        { ids: ['foreign', tiles[0]!.id, tiles[0]!.id], mode: 'dealt' },
        tiles,
      ).ids,
    ).toEqual(tiles.map((tile) => tile.id));
    for (const value of [
      null,
      { ids: [1], mode: 'color' },
      { ids: [], mode: 'other' },
      { ids: Array(107).fill('a'), mode: 'color' },
    ])
      expect(restoreRackOrder(value, tiles)).toEqual({
        ids: sortRack(tiles, 'color'),
        mode: 'color',
      });
  });

  it('reconciles a saved order after playing and drawing without sorting survivors again', () => {
    const first = restoreRackOrder(
      { ids: tiles.map((tile) => tile.id), mode: 'color' },
      tiles,
    );
    const next = reconcileRackOrder(first, [tiles[2]!, tiles[1]!]);
    expect(next.ids).toEqual([tiles[1]!.id, tiles[2]!.id]);
    expect(
      reconcileRackOrder(next, [tiles[2]!, tiles[1]!, tiles[0]!]).ids,
    ).toEqual([tiles[1]!.id, tiles[2]!.id, tiles[0]!.id]);
  });

  it('reorders locally without losing hidden draft tiles or accepting foreign destinations', () => {
    const order = { ids: tiles.map((tile) => tile.id), mode: 'color' as const };
    expect(moveRackTile(order, tiles[2]!.id, tiles[0]!.id).ids).toEqual([
      tiles[2]!.id,
      tiles[0]!.id,
      tiles[1]!.id,
    ]);
    expect(moveRackTile(order, tiles[0]!.id, null).ids).toEqual([
      tiles[1]!.id,
      tiles[2]!.id,
      tiles[0]!.id,
    ]);
    expect(moveRackTile(order, 'foreign', null)).toBe(order);
    expect(moveRackTile(order, tiles[0]!.id, 'foreign')).toBe(order);
    expect(order.ids).toEqual(tiles.map((tile) => tile.id));
  });
});
