import type { Action, ManilaView } from '../rules/view';
import { influenceScore, placementScore, setupScore } from './evaluation';
import { evaluateDoubao } from './doubao';

export function evaluateJuewu(v: ManilaView, a: Action): number {
  const remaining = Math.max(
    ...v.cargos.map((c) => 5 - [0, 5, 10, 15, 20, 30].indexOf(v.market[c.id])),
  );
  if (a.type === 'bid') {
    // Value control by comparing the best and worst feasible starts for one's
    // portfolio, rather than treating hidden rival shares as known.
    const concentration = Math.max(
      ...v.cargos.map(
        (c) => v.self!.shares.filter((s) => s.cargo === c.id).length,
      ),
    );
    const budget = Math.min(
      v.self!.cash * 0.45,
      4 + concentration * (remaining > 2 ? 2.5 : 4),
    );
    return budget - a.amount;
  }
  if (a.type === 'buy-share') {
    const horizon = Math.min(3, remaining),
      price = Math.max(5, v.market[a.cargo]);
    return (
      v.market[a.cargo] +
      horizon * 3.8 -
      price -
      (v.self!.cash - price < 10 ? 6 : 0)
    );
  }
  if (a.type === 'setup')
    return (
      setupScore(v, a, 1.8) +
      a.cargos.reduce(
        (score, cargo, index) =>
          score + (v.market[cargo] === 20 ? 1 : 0) * a.positions[index]! * 0.02,
        0,
      )
    );
  if (a.type === 'place') {
    let score = placementScore(v, a, 3);
    const space = v.spaces.find((x) => x.id === a.space)!;
    // Keep liquidity for remaining workers, and value taking a scarce post
    // before publicly observed opponents can claim it.
    const remainingWorkers = v.players[v.self!.seatId]!.availableWorkers - 1;
    if (v.self!.cash - space.cost < remainingWorkers * 2)
      score -= Math.min(2, remainingWorkers * 0.6);
    if ((space.kind === 'cargo' || space.kind === 'insurance') && score > 0)
      score += 0.15;
    return score;
  }
  if (a.type === 'pilot' || a.type === 'board' || a.type === 'plunder') {
    const mine = influenceScore(v, a, true);
    // Opponent public crews and redeemed shares permit a bounded denial term.
    let opponents = 0;
    for (const seat of v.seatOrder)
      if (seat !== v.self!.seatId) {
        const next = structuredClone(v);
        next.self = {
          seatId: seat,
          cash: v.players[seat]!.cash,
          shares: v.players[seat]!.revealedShares,
          availableCredit: 0,
        };
        opponents += influenceScore(next, a, true);
      }
    return mine - opponents * 0.18;
  }
  if (a.type === 'mortgage' && v.phase === 'financing') {
    const share = v.self!.shares.find((s) => s.id === a.shareId)!;
    // Redeemed shares are already public: mortgage those first to avoid
    // retaining a concealed identity only to reveal it on a later redemption.
    return share.revealed ? 0.01 : 0;
  }
  return evaluateDoubao(v, a);
}
