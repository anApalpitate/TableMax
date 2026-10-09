import { rackValue } from '../data/catalog';
import type { GameResult } from '../types';

export function scoreGame(
  seats: readonly string[],
  racks: Record<string, string[]>,
  reason: GameResult['reason'],
  gameNumber: number,
): GameResult {
  const rackValues = Object.fromEntries(
    seats.map((seat) => [seat, rackValue(racks[seat]!)]),
  );
  const minimum = Math.min(...Object.values(rackValues));
  const winners = seats.filter((seat) =>
    reason === 'empty-rack'
      ? racks[seat]!.length === 0
      : rackValues[seat] === minimum,
  );
  if (!winners.length || (reason === 'empty-rack' && winners.length !== 1))
    throw new Error('本局没有唯一清空牌架的合法赢家。');
  const scores = Object.fromEntries(
    seats.map((seat) => [
      seat,
      winners.includes(seat)
        ? 0
        : reason === 'blocked'
          ? minimum - rackValues[seat]!
          : -rackValues[seat]!,
    ]),
  );
  const reward = -Object.values(scores).reduce((sum, score) => sum + score, 0);
  // Project ruling: tied blocked winners share the positive amount exactly;
  // points may be rational halves/thirds, never rounded or lost.
  for (const winner of winners) scores[winner] = reward / winners.length;
  return { gameNumber, reason, winners, rackValues, scores };
}
export function matchWinners(
  seats: readonly string[],
  wins: Record<string, number>,
  scores: Record<string, number>,
): string[] {
  const mostWins = Math.max(...seats.map((seat) => wins[seat]!));
  const tied = seats.filter((seat) => wins[seat] === mostWins);
  const mostPoints = Math.max(...tied.map((seat) => scores[seat]!));
  return tied.filter((seat) => scores[seat] === mostPoints);
}
