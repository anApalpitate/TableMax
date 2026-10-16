import type { Viewer } from '@tablemax/game-sdk';
import { CARGOS, CARGO } from './catalog';
import { credit } from './actions';
import { turnSeat, workerCount, type State } from './state';
import type { ManilaView } from './view';

export function project(s: State, viewer: Viewer): ManilaView {
  const own =
    viewer.role === 'player' && s.seats.includes(viewer.seatId)
      ? viewer.seatId
      : null;
  return structuredClone({
    gameId: 'manila',
    voyage: s.voyage,
    phase: s.phase,
    seatOrder: s.seats,
    turnSeat: turnSeat(s),
    harborMaster: s.harborMaster,
    placementRound: s.placementRound,
    movement: s.movement,
    market: s.market,
    stock: s.stock,
    cargos: CARGOS.map((id) => ({ id, ...CARGO[id] })),
    boats: s.boats,
    spaces: s.spaces,
    auction: {
      bid: s.auction.bid,
      highBidder: s.auction.highBidder,
      passed: s.auction.passed,
    },
    payment: s.payment
      ? {
          seatId: s.payment.seatId,
          amount: s.payment.amount,
          reason: s.payment.reason,
        }
      : null,
    players: Object.fromEntries(
      s.seats.map((seat) => {
        const p = s.players[seat]!;
        return [
          seat,
          {
            cash: p.cash,
            shareCount: p.shares.length,
            mortgageCount: p.shares.filter((x) => x.mortgaged).length,
            revealedShares: p.shares.filter(
              (x) => s.phase === 'ended' || x.revealed,
            ),
            availableWorkers: workerCount(s) - p.usedWorkers,
            passed: p.passed,
          },
        ];
      }),
    ),
    self: own
      ? {
          seatId: own,
          cash: s.players[own]!.cash,
          shares: s.players[own]!.shares,
          availableCredit: credit(s, own),
        }
      : null,
    latest: s.latest,
    dice: s.dice,
    result: s.result,
    scores: s.scores,
    winners: s.winners,
  });
}
