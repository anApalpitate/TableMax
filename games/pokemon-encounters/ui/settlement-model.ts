import type { PokemonView } from '../rules/project';
import type { TableSeat } from './table';
export function resultRows(game: PokemonView, seats: readonly TableSeat[]) {
  return seats.map((seat) => ({
    ...seat,
    score: game.roundResult!.scores[seat.id]!.total,
    rank:
      1 +
      seats.filter(
        (other) =>
          game.roundResult!.scores[other.id]!.total <
          game.roundResult!.scores[seat.id]!.total,
      ).length,
    roundWinner: game.roundResult!.winners.includes(seat.id),
    matchWinner: game.matchWinners.includes(seat.id),
  }));
}
