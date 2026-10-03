import type { ArtistId, AuctionKind, CardFace } from '../ui/view';

export const RULES_VERSION = 'tablemax-modern-art-classic-v1';

// Subtype counts are the documented TableMax adoption of the classic deck.
export const ARTISTS: readonly {
  id: ArtistId;
  name: string;
  color: string;
  cardCount: number;
}[] = [
  { id: 'manuel', name: 'Manuel Carvalho', color: '#cca43a', cardCount: 12 },
  { id: 'sigrid', name: 'Sigrid Thaler', color: '#528ba8', cardCount: 13 },
  { id: 'daniel', name: 'Daniel Melim', color: '#c56e61', cardCount: 14 },
  { id: 'ramon', name: 'Ramon Martins', color: '#739478', cardCount: 15 },
  { id: 'rafael', name: 'Rafael Silveira', color: '#d78b4f', cardCount: 16 },
];
export const DISTRIBUTION: Record<ArtistId, Record<AuctionKind, number>> = {
  manuel: { open: 2, once: 3, sealed: 2, fixed: 3, double: 2 },
  sigrid: { open: 3, once: 2, sealed: 3, fixed: 3, double: 2 },
  daniel: { open: 3, once: 3, sealed: 3, fixed: 3, double: 2 },
  ramon: { open: 3, once: 3, sealed: 3, fixed: 3, double: 3 },
  rafael: { open: 4, once: 3, sealed: 3, fixed: 3, double: 3 },
};
export const CARDS: readonly CardFace[] = ARTISTS.flatMap(({ id }) => {
  let index = 0;
  return (['open', 'once', 'sealed', 'fixed', 'double'] as const).flatMap(
    (auctionKind) =>
      Array.from({ length: DISTRIBUTION[id][auctionKind] }, () => {
        const artIndex = ++index;
        return {
          id: `${id}-${String(artIndex).padStart(2, '0')}`,
          artistId: id,
          title: `作品 ${String(artIndex).padStart(2, '0')}`,
          auctionKind,
          artIndex,
        };
      }),
  );
});
export const CARD_IDS = CARDS.map((card) => card.id);
const cardById = new Map(CARDS.map((card) => [card.id, card]));
export function getCard(id: string): CardFace {
  const card = cardById.get(id);
  if (!card) throw new Error('未知画作。');
  return { ...card };
}
export function getArtist(id: ArtistId) {
  const artist = ARTISTS.find((entry) => entry.id === id);
  if (!artist) throw new Error('未知艺术家。');
  return artist;
}
