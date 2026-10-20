import { kindOf } from './cards';
export function loserFor(
  seats: string[],
  hands: Record<string, number[]>,
  piles: Record<string, number[]>,
  turn: string,
): string | null {
  const threshold = seats.length === 2 ? 5 : 4;
  const collected = seats.find((s) =>
    Object.values(
      piles[s]!.reduce<Record<string, number>>((n, c) => {
        const k = kindOf(c);
        n[k] = (n[k] ?? 0) + 1;
        return n;
      }, {}),
    ).some((n) => n >= threshold),
  );
  return collected ?? (hands[turn]!.length === 0 ? turn : null);
}
export function winnersFor(seats: string[], loser: string | null): string[] {
  return loser ? seats.filter((s) => s !== loser) : [];
}
