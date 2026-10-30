import { expect, it } from 'vitest';
import type { PokemonView } from '../rules/project';
import type { TableSeat } from './table';
import { resultRows } from './settlement-model';
it('keeps seat order, negative scores, competition ranks and distinct round/match winners', () => {
  const game = {
    roundResult: {
      scores: { a: { total: -2 }, b: { total: -2 }, c: { total: 10 } },
      winners: ['a', 'b'],
    },
    matchWinners: ['b'],
  } as unknown as PokemonView;
  const seats = ['c', 'a', 'b'].map((id) => ({ id, name: id })) as TableSeat[];
  const rows = resultRows(game, seats);
  expect(
    rows.map((r) => [r.id, r.rank, r.score, r.roundWinner, r.matchWinner]),
  ).toEqual([
    ['c', 3, 10, false, false],
    ['a', 1, -2, true, false],
    ['b', 1, -2, true, true],
  ]);
  expect(seats.map((s) => s.id)).toEqual(['c', 'a', 'b']);
});
it('keeps all common match winners', () => {
  const game = {
    roundResult: {
      scores: { a: { total: 0 }, b: { total: 0 } },
      winners: ['a', 'b'],
    },
    matchWinners: ['a', 'b'],
  } as unknown as PokemonView;
  expect(
    resultRows(game, ['a', 'b'].map((id) => ({ id })) as TableSeat[]).every(
      (s) => s.rank === 1 && s.roundWinner && s.matchWinner,
    ),
  ).toBe(true);
});
