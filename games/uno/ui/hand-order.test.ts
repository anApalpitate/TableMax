import { describe, expect, it } from 'vitest';
import type { Card } from '../types';
import { reconcileOrder, sortedHand } from './hand-order';
const card = (
  id: string,
  color: Card['color'],
  value: number | null,
  kind: Card['kind'] = 'number',
): Card => ({ id, color, value, kind });
const cards = [
  card('b2', 'blue', 2),
  card('r9', 'red', 9),
  card('r1', 'red', 1),
  card('w', null, null, 'wild'),
  card('g2', 'green', 2),
];
describe('private hand presentation', () => {
  it('puts legal cards first, then sorts colors or numbers without changing input', () => {
    expect(sortedHand(cards, new Set(['w']), 'color')).toEqual([
      'w',
      'r1',
      'r9',
      'g2',
      'b2',
    ]);
    expect(sortedHand(cards, new Set(), 'number')).toEqual([
      'r1',
      'g2',
      'b2',
      'r9',
      'w',
    ]);
    expect(cards[0]!.id).toBe('b2');
  });
  it('keeps manual order across legality changes, removes departed cards and appends draws', () => {
    const order = {
      ids: ['w', 'b2', 'r9', 'r1', 'g2'],
      mode: 'color' as const,
      manual: true,
    };
    const next = [
      ...cards.filter((entry) => entry.id !== 'r9'),
      card('new', 'yellow', 0),
    ];
    expect(reconcileOrder(order, next, new Set(['r1'])).ids).toEqual([
      'w',
      'b2',
      'r1',
      'g2',
      'new',
    ]);
    expect(order.ids).toHaveLength(5);
  });
  it('does not reshuffle when another player takes the turn', () => {
    const order = {
      ids: ['w', 'r1', 'r9', 'g2', 'b2'],
      mode: 'color' as const,
      manual: false,
    };
    expect(reconcileOrder(order, cards, new Set()).ids).toEqual(order.ids);
  });
});
