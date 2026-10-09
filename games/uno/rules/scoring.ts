import { getCard } from '../data/catalog';
import type { RoundResult } from '../types';
export function handValue(ids: readonly string[]): number {
  return ids.reduce((sum, id) => {
    const card = getCard(id);
    return sum + (card.kind === 'number' ? card.value! : card.color ? 20 : 50);
  }, 0);
}
export function scoreRound(
  seats: readonly string[],
  hands: Record<string, string[]>,
  winner: string,
  scores: Record<string, number>,
  roundNumber: number,
): RoundResult {
  if (
    !seats.includes(winner) ||
    hands[winner]?.length !== 0 ||
    seats.filter((seat) => !hands[seat]!.length).length !== 1
  )
    throw new Error('UNO 小局赢家无效。');
  const handValues = Object.fromEntries(
    seats.map((seat) => [seat, handValue(hands[seat]!)]),
  );
  const points = Object.values(handValues).reduce(
    (sum, value) => sum + value,
    0,
  );
  return {
    roundNumber,
    winner,
    points,
    handValues,
    scores: { ...scores, [winner]: scores[winner]! + points },
  };
}
