import type { Action, ManilaView } from '../rules/view';
import { influenceScore, placementScore, setupScore } from './evaluation';
import { evaluateDefault } from './default';

export function evaluateDoubao(v: ManilaView, a: Action): number {
  if (a.type === 'bid') {
    const concentrated = Math.max(
      ...v.cargos.map(
        (c) => v.self!.shares.filter((s) => s.cargo === c.id).length,
      ),
    );
    const budget = Math.min(v.self!.cash * 0.4, 5 + concentrated * 2);
    return budget - a.amount;
  }
  if (a.type === 'buy-share')
    return v.self!.cash < 10
      ? -2
      : 12 + v.market[a.cargo] * 0.5 - Math.max(5, v.market[a.cargo]);
  if (a.type === 'setup') return setupScore(v, a, 1.5);
  if (a.type === 'place') return placementScore(v, a, 2);
  if (a.type === 'pilot' || a.type === 'board' || a.type === 'plunder')
    return influenceScore(v, a, true);
  return evaluateDefault(v, a);
}
