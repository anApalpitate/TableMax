import { describe, expect, it } from 'vitest';
import { marketValueParts } from './market-value';
import type { ModernArtView } from './view';
const artist = (
  history: number[],
  currentValue: number,
): ModernArtView['artists'][number] => ({
  id: 'manuel',
  name: 'Manuel',
  color: '',
  cardCount: 12,
  playedCount: 3,
  history,
  currentValue,
});
describe('market value composition', () => {
  it('uses the same historical base before and after current-round settlement', () => {
    expect(marketValueParts(artist([30], 50), 2)).toEqual({
      historical: 30,
      increment: 20,
      eligible: true,
    });
    expect(marketValueParts(artist([30, 20], 50), 2)).toEqual({
      historical: 30,
      increment: 20,
      eligible: true,
    });
  });
  it('retains historical value while current-round payment is zero', () => {
    expect(marketValueParts(artist([30, 20], 0), 3)).toEqual({
      historical: 50,
      increment: 0,
      eligible: false,
    });
    expect(marketValueParts(artist([30, 20, 0], 0), 3)).toEqual({
      historical: 50,
      increment: 0,
      eligible: false,
    });
    expect(marketValueParts(artist([30, 20, 0, 10], 60), 4)).toEqual({
      historical: 50,
      increment: 10,
      eligible: true,
    });
  });
  it('has no historical value on the first round and consumes the projected payment', () => {
    expect(marketValueParts(artist([], 30), 1)).toEqual({
      historical: 0,
      increment: 30,
      eligible: true,
    });
    expect(marketValueParts(artist([30], 30), 1)).toEqual({
      historical: 0,
      increment: 30,
      eligible: true,
    });
  });
});
