import { describe, expect, it } from 'vitest';
import { sortPaintings } from './sorting';
import type { CardFace } from './view';

const cards: readonly CardFace[] = [
  {
    id: 'rafael-1',
    artistId: 'rafael',
    title: '一',
    auctionKind: 'open',
    artIndex: 1,
  },
  {
    id: 'manuel-2',
    artistId: 'manuel',
    title: '二',
    auctionKind: 'sealed',
    artIndex: 2,
  },
  {
    id: 'manuel-1',
    artistId: 'manuel',
    title: '三',
    auctionKind: 'open',
    artIndex: 1,
  },
  {
    id: 'sigrid-1',
    artistId: 'sigrid',
    title: '四',
    auctionKind: 'open',
    artIndex: 1,
  },
  {
    id: 'manuel-3',
    artistId: 'manuel',
    title: '五',
    auctionKind: 'open',
    artIndex: 3,
  },
];

describe('local painting arrangement', () => {
  it('groups painters, keeps their relative order and preserves action object identities', () => {
    const before = JSON.stringify(cards);
    const result = sortPaintings(cards, 'artist');
    expect(result.map((card) => card.id)).toEqual([
      'manuel-2',
      'manuel-1',
      'manuel-3',
      'sigrid-1',
      'rafael-1',
    ]);
    expect(result[0]).toBe(cards[1]);
    expect(JSON.stringify(cards)).toBe(before);
    expect(new Set(result.map((card) => card.id))).toEqual(
      new Set(cards.map((card) => card.id)),
    );
  });

  it('groups auction kinds and restores the original display order', () => {
    expect(sortPaintings(cards, 'auction').map((card) => card.id)).toEqual([
      'manuel-1',
      'manuel-3',
      'sigrid-1',
      'rafael-1',
      'manuel-2',
    ]);
    const original = sortPaintings(cards, 'original');
    expect(original).toEqual(cards);
    expect(original).not.toBe(cards);
  });
});
