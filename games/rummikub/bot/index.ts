import type { BotStrategy } from '@tablemax/game-sdk';
import { RULES_VERSION } from '../data/catalog';
import { inspectTurn } from '../shared/turn';
import type { Action, RummikubView } from '../types';
import { planTurn } from './planner';

export { planTurn } from './planner';
export { SEARCH_LIMITS } from './budget';

export const bot: BotStrategy = {
  id: 'rummikub-local',
  version: '1.0.0',
  gameId: 'rummikub',
  rulesVersion: RULES_VERSION,
  difficulties: ['default', 'doubao', 'juewu'],
  validateMemory(input) {
    if (input !== null) throw new Error('拉密策略记忆无效。');
    return null;
  },
  async decide({
    view: inputView,
    actions: inputActions,
    decision,
    memory,
    difficulty = 'default',
    signal,
  }) {
    bot.validateMemory(memory);
    const view = inputView as RummikubView;
    if (view.self?.seatId !== decision.seatId)
      throw new Error('拉密策略决策身份不一致。');
    const result = planTurn(view, difficulty, signal);
    if (result.action) {
      inspectTurn(
        {
          rack: view.self.rack.map((tile) => tile.id),
          table: view.table,
          opened: view.self.opened,
        },
        result.action,
      );
      return { action: result.action, memory: null };
    }
    const actions = inputActions as readonly Action[];
    // A rule-proved play keeps an empty-pool decision moving even if the
    // bounded optimizer did not discover that particular rearrangement.
    const suggestion = actions.find((action) => action.type === 'submit-turn');
    if (suggestion?.type === 'submit-turn') {
      inspectTurn(
        {
          rack: view.self.rack.map((tile) => tile.id),
          table: view.table,
          opened: view.self.opened,
        },
        suggestion,
      );
      if (signal.aborted) throw new Error('拉密策略已取消。');
      return { action: suggestion, memory: null };
    }
    // The rule-supplied draw/pass is already authorized for the same decision.
    const fallback =
      actions.find((action) => action.type === 'draw') ??
      actions.find((action) => action.type === 'pass');
    if (!fallback) throw new Error('拉密策略没有合法摸牌或停牌动作。');
    if (signal.aborted) throw new Error('拉密策略已取消。');
    return { action: fallback, memory: null };
  },
};
