import type { Viewer } from '../../../packages/game-sdk/src';
import { getTile } from '../data/catalog';
import type { RummikubView } from '../types';
import type { State } from './state';

export function project(s: State, viewer: Viewer): RummikubView {
  const self =
    viewer.role === 'player' && s.seats.includes(viewer.seatId)
      ? viewer.seatId
      : null;
  return {
    gameId: 'rummikub',
    rulesVersion: s.rulesVersion,
    phase: s.phase,
    seatOrder: [...s.seats],
    gameNumber: s.gameNumber,
    gameCount: s.gameCount,
    roundCount: s.roundCount,
    turnNumber: s.turnNumber,
    turnSeat: s.turnSeat,
    table: structuredClone(s.table),
    poolCount: s.pool.length,
    players: Object.fromEntries(
      s.seats.map((seat) => [
        seat,
        {
          rackCount: s.racks[seat]!.length,
          opened: s.opened[seat]!,
          score: s.scores[seat]!,
          wins: s.wins[seat]!,
        },
      ]),
    ),
    self: self
      ? {
          seatId: self,
          rack: s.racks[self]!.map((id) => ({ ...getTile(id) })),
          opened: s.opened[self]!,
        }
      : null,
    results: structuredClone(s.results),
    winners: [...s.winners],
    latest: s.latest ? structuredClone(s.latest) : null,
  };
}
