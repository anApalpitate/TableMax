import type { Action, ManilaView } from '../rules/view';
import {
  influenceScore,
  ownShares,
  placementScore,
  setupScore,
} from './evaluation';

export function evaluateDefault(v: ManilaView, a: Action): number {
  if (a.type === 'mortgage') return v.phase === 'financing' ? 0 : -1000;
  if (a.type === 'repay') return -1000;
  if (a.type === 'pass' || a.type === 'skip-share') return 0;
  if (a.type === 'next-voyage') return 1;
  if (a.type === 'bid')
    return a.amount <= 3 + v.self!.shares.length
      ? 2 - a.amount / 20
      : -a.amount;
  if (a.type === 'buy-share')
    return v.self!.cash >= 10
      ? 8 -
          Math.max(5, v.market[a.cargo]) +
          v.market[a.cargo] * 0.4 +
          ownShares(v, a.cargo)
      : -1;
  if (a.type === 'setup') return setupScore(v, a, 1);
  if (a.type === 'place') return placementScore(v, a, 1);
  return influenceScore(v, a, false);
}
