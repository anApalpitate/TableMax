import type { AuctionKind, CardFace, ArtistId } from './view';

export type PaintingSort = 'artist' | 'auction' | 'original';

const artistOrder: readonly ArtistId[] = [
  'manuel',
  'sigrid',
  'daniel',
  'ramon',
  'rafael',
];
const auctionOrder: readonly AuctionKind[] = [
  'open',
  'once',
  'sealed',
  'fixed',
  'double',
];

// Sorting is a local display choice. The authoritative order and card IDs stay intact.
export function sortPaintings(
  cards: readonly CardFace[],
  mode: PaintingSort,
): CardFace[] {
  if (mode === 'original') return [...cards];
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const artist =
        artistOrder.indexOf(a.card.artistId) -
        artistOrder.indexOf(b.card.artistId);
      const auction =
        auctionOrder.indexOf(a.card.auctionKind) -
        auctionOrder.indexOf(b.card.auctionKind);
      return (
        (mode === 'artist' ? artist : auction || artist) || a.index - b.index
      );
    })
    .map(({ card }) => card);
}
