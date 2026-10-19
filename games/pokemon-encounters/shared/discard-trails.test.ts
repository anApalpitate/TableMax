import { expect, it } from 'vitest';
import { validDiscardSources } from './discard-trails';

it('accepts bounded public origins while rejecting identities, private extensions and duplicate sources', () => {
  expect(
    validDiscardSources(['@held', { seat: 'S1', slot: 5 }], ['S1', 'S2'], 6),
  ).toBe(true);
  for (const sources of [
    ['special-mew#01'],
    [{ seat: 'S1', slot: 0, card: 'special-mew#01' }],
    [{ seat: 'S3', slot: 0 }],
    [{ seat: 'S1', slot: 6 }],
    [{ seat: 'S1', slot: -1 }],
    [
      { seat: 'S1', slot: 0 },
      { seat: 'S1', slot: 0 },
    ],
    ['@held', '@held'],
  ])
    expect(validDiscardSources(sources, ['S1', 'S2'], 6)).toBe(false);
});
