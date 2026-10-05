import { expect, it } from 'vitest';
import { topology } from './topology';
import { original } from '../variants/original';
import { categories, instances } from './cards';
import { originalCreatureIds, creatureResources } from './presentation';
it('preserves original cardinality and gives future grids row-safe topology', () => {
  const grid = topology(original.layout);
  expect(grid.count).toBe(6);
  expect(grid.columns).toEqual([
    [0, 3],
    [1, 4],
    [2, 5],
  ]);
  expect(grid.neighbors(2)).toEqual([1]);
  expect(grid.neighbors(3)).toEqual([4]);
  const expanded = topology({ rows: 3, columns: 3 });
  expect(expanded.count).toBe(9);
  expect(expanded.columns[2]).toEqual([2, 5, 8]);
  expect(expanded.neighbors(5)).toEqual([4]);
  expect(categories).toHaveLength(original.categoryCount);
  expect(instances).toHaveLength(original.cardCount);
  for (const card of categories)
    expect(
      creatureResources[originalCreatureIds[card.categoryId]!].category,
    ).toBe(card.categoryId);
  expect(() => grid.column(6)).toThrow();
  expect(() => topology({ rows: 0, columns: 3 })).toThrow();
});
