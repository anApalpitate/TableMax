import type { State } from './state';
/** 2005 English original: all owned shares retain market value; each loan costs 15. */
export function finalScores(s: State): Record<string, number> {
  return Object.fromEntries(
    s.seats.map((seat) => [
      seat,
      s.players[seat]!.cash +
        s.players[seat]!.shares.reduce(
          (total, share) =>
            total + s.market[share.cargo] - (share.mortgaged ? 15 : 0),
          0,
        ),
    ]),
  );
}
/** The original has no secondary tiebreak; equally wealthy players share the win. */
export function resolveWinners(
  scores: Record<string, number>,
  seats: readonly string[],
): string[] {
  const highest = Math.max(...seats.map((seat) => scores[seat]!));
  return seats.filter((seat) => scores[seat] === highest);
}
