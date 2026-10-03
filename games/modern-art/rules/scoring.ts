import { ARTISTS, getCard } from '../data/catalog';
import type { ArtistId, ArtistNumbers } from '../ui/view';

export function emptyNumbers(): ArtistNumbers {
  return Object.fromEntries(ARTISTS.map(({ id }) => [id, 0])) as ArtistNumbers;
}
export function countCards(cards: readonly string[]): ArtistNumbers {
  const counts = emptyNumbers();
  for (const id of cards) counts[getCard(id).artistId]++;
  return counts;
}
export function rankArtists(counts: ArtistNumbers): ArtistId[] {
  return ARTISTS.filter(({ id }) => counts[id] > 0)
    .map(({ id }) => id)
    .sort(
      (a, b) =>
        counts[b] - counts[a] ||
        ARTISTS.findIndex((x) => x.id === a) -
          ARTISTS.findIndex((x) => x.id === b),
    );
}
export function increments(counts: ArtistNumbers): ArtistNumbers {
  const result = emptyNumbers();
  rankArtists(counts)
    .slice(0, 3)
    .forEach((id, index) => {
      result[id] = 30 - index * 10;
    });
  return result;
}
export function prices(
  counts: ArtistNumbers,
  history: Record<ArtistId, number[]>,
): ArtistNumbers {
  const result = increments(counts);
  for (const { id } of ARTISTS)
    if (result[id]) result[id] += history[id].reduce((a, b) => a + b, 0);
  return result;
}
export function income(
  collection: readonly string[],
  values: ArtistNumbers,
): number {
  return collection.reduce(
    (total, id) => total + values[getCard(id).artistId],
    0,
  );
}
export function winners(
  cash: Record<string, number>,
  seats: readonly string[],
): string[] {
  const max = Math.max(...seats.map((seat) => cash[seat]!));
  return seats.filter((seat) => cash[seat] === max);
}
