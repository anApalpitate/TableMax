import { expect, it } from 'vitest';
import { createCardCatalog } from './card-catalog';
import { originalCards } from '../variants/original-cards';

it('binds independent card identities with equal values without original gameplay imports', () => {
  const catalog = createCardCatalog([
    {
      categoryId: 'first-creature',
      quantity: 2,
      value: { kind: 'fixed', number: 2 },
    },
    {
      categoryId: 'second-creature',
      quantity: 1,
      value: { kind: 'fixed', number: 2 },
    },
  ]);
  expect(catalog.instances).toEqual([
    'first-creature#01',
    'first-creature#02',
    'second-creature#01',
  ]);
  expect(catalog.numeric('first-creature#02')).toBe(
    catalog.numeric('second-creature#01'),
  );
  expect(() => catalog.card('first-creature#03')).toThrow();
  expect(() => catalog.card('ordinary--2#01')).toThrow();
  expect(originalCards.instances).toHaveLength(56);
  expect(originalCards.instances[0]).toBe('ordinary--2#01');
});
