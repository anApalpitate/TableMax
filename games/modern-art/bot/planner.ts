import { ARTISTS, getCard } from '../data/catalog';
import type {
  ArtistId,
  ArtistNumbers,
  CardFace,
  ModernArtView,
} from '../ui/view';
import type { ArtMemory } from './memory';

function numbers(value = 0): ArtistNumbers {
  return Object.fromEntries(
    ARTISTS.map(({ id }) => [id, value]),
  ) as ArtistNumbers;
}

function additions(counts: ArtistNumbers): ArtistNumbers {
  const result = numbers();
  ARTISTS.filter(({ id }) => counts[id] > 0)
    .map(({ id }, order) => ({ id, order }))
    .sort((a, b) => counts[b.id] - counts[a.id] || a.order - b.order)
    .slice(0, 3)
    .forEach(({ id }, index) => {
      result[id] = 30 - index * 10;
    });
  return result;
}

// This is a bounded forecast of public supply, not a simulation of hidden hands.
// Doubao considers the next round; Juewu compares every remaining round.
export class RoundPlanner {
  readonly horizon: number;
  readonly unknown: ArtistNumbers;
  constructor(
    private readonly view: ModernArtView,
    memory: ArtMemory,
    private readonly level: number,
    private readonly signal: AbortSignal,
  ) {
    this.horizon =
      level === 0 ? 0 : Math.min(4 - view.round, level === 1 ? 1 : 3);
    const known = new Set([
      ...memory.remembered,
      ...view.self!.hand.map((card) => card.id),
      ...Object.values(view.players).flatMap((player) =>
        player.collection.map((card) => card.id),
      ),
      ...(view.auction?.cards.map((card) => card.id) ?? []),
    ]);
    this.unknown = numbers();
    for (const artist of ARTISTS)
      this.unknown[artist.id] =
        artist.cardCount -
        [...known].filter((id) => getCard(id).artistId === artist.id).length;
  }

  counts(extra = 0, artistId?: ArtistId): ArtistNumbers {
    return Object.fromEntries(
      this.view.artists.map((artist) => [
        artist.id,
        artist.playedCount + (artist.id === artistId ? extra : 0),
      ]),
    ) as ArtistNumbers;
  }

  private pricesByRound(
    hand: readonly CardFace[],
    counts: ArtistNumbers,
  ): ArtistNumbers[] {
    if (!this.horizon) return [];
    const seed = additions(counts);
    const base = Object.fromEntries(
      this.view.artists.map((artist) => [
        artist.id,
        artist.history.reduce((sum, value) => sum + value, 0) + seed[artist.id],
      ]),
    ) as ArtistNumbers;
    const held = numbers();
    for (const card of hand) held[card.artistId]++;
    const result = Array.from({ length: this.horizon }, () => numbers());
    // Balanced supply plus one surge for each artist prevents assuming a single
    // future ranking. Unknown opponent cards and future deck order stay unknown.
    for (let scenario = 0; scenario <= ARTISTS.length; scenario++) {
      if (this.signal.aborted) throw new Error('策略已取消。');
      const remaining = { ...this.unknown };
      const values = { ...base };
      for (let round = 0; round < this.horizon; round++) {
        const pressure = numbers();
        for (const [index, artist] of ARTISTS.entries()) {
          const owned = held[artist.id] * Math.pow(0.6, round);
          const surge = scenario === index + 1 ? 1.7 : 1;
          pressure[artist.id] = Math.min(
            5,
            (remaining[artist.id] * 0.27 + owned * 0.65) * surge,
          );
        }
        const increment = additions(pressure);
        for (const artist of ARTISTS) {
          values[artist.id] += increment[artist.id];
          if (increment[artist.id])
            result[round]![artist.id] +=
              values[artist.id] / (ARTISTS.length + 1);
          remaining[artist.id] = Math.max(
            0,
            remaining[artist.id] - pressure[artist.id],
          );
        }
      }
    }
    return result;
  }

  portfolio(hand: readonly CardFace[], counts = this.counts()): number {
    const forecast = this.pricesByRound(hand, counts);
    if (!forecast.length) return 0;
    const held = numbers();
    for (const card of hand) held[card.artistId]++;
    let result = 0;
    for (const artist of ARTISTS) {
      // Holding a hand full of the same artist cannot guarantee selling it all.
      const opportunities = forecast.flatMap((values, round) =>
        Array.from(
          { length: 2 },
          (_, slot) =>
            values[artist.id] *
            0.62 *
            Math.pow(0.82, round + 1) *
            (slot === 0 ? 1 : 0.55),
        ),
      );
      opportunities.sort((a, b) => b - a);
      result += opportunities
        .slice(0, held[artist.id])
        .reduce((sum, value) => sum + value, 0);
    }
    return result;
  }

  offerAdjustment(cards: readonly CardFace[], extra: number): number {
    if (!this.horizon) return 0;
    const removed = new Set(cards.map((card) => card.id));
    const remaining = this.view.self!.hand.filter(
      (card) => !removed.has(card.id),
    );
    return (
      (this.portfolio(remaining, this.counts(extra, cards[0]!.artistId)) -
        this.portfolio(this.view.self!.hand)) *
      (this.level === 1 ? 0.3 : 0.72)
    );
  }

  cashReserve(): number {
    const future = this.pricesByRound(this.view.self!.hand, this.counts());
    if (!future.length) return 0;
    const nextOpportunity = Math.max(...Object.values(future[0]!));
    return Math.min(
      this.view.self!.cash * (this.level === 1 ? 0.24 : 0.34),
      nextOpportunity * (this.level === 1 ? 0.3 : 0.48),
    );
  }
}
