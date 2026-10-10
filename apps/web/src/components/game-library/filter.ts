export type LibraryGame = {
  id: string;
  name: string;
  min: number;
  max: number;
  tags: string[];
  searchTerms: string[];
  tagline: string;
  development: boolean;
};

function normalize(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

export function availableLibraryTags(games: readonly LibraryGame[]) {
  return [...new Set(games.flatMap((game) => game.tags))];
}

export function filterLibraryGames(
  games: readonly LibraryGame[],
  filters: { query: string; tag: string | null; players: number | null },
) {
  const words = normalize(filters.query).split(/\s+/).filter(Boolean);
  return games.filter((game) => {
    if (filters.tag !== null && !game.tags.includes(filters.tag)) return false;
    if (
      filters.players !== null &&
      (filters.players < game.min || filters.players > game.max)
    )
      return false;
    const text = normalize(
      [
        game.name,
        game.id,
        game.tagline,
        ...game.tags,
        ...game.searchTerms,
      ].join(' '),
    );
    return words.every((word) => text.includes(word));
  });
}
