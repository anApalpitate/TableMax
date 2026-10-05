import type { BotStrategy } from '@tablemax/game-sdk';
import type { PokemonView } from '../rules/project';
import type { Action } from '../rules';
import { validateMemory, observeMemory } from './memory';
import { preliminaryAction } from './strategy';
import { PositionEvaluator } from './evaluation';

export const bot: BotStrategy = {
  id: 'pokemon-encounters/basic',
  version: '1',
  gameId: 'pokemon-encounters',
  rulesVersion: 'tablemax-cn-s19-v1',
  difficulties: ['default', 'doubao', 'juewu'],
  validateMemory,
  observe: ({ view, memory, seatId, difficulty }) =>
    observeMemory(memory, view as PokemonView, seatId, difficulty),
  async decide({
    view: input,
    actions: raw,
    decision,
    signal,
    memory,
    difficulty = 'default',
  }) {
    if (signal.aborted) throw new Error('Aborted');
    bot.validateMemory(memory);
    const view = input as PokemonView;
    const actions = raw as readonly Action[];
    if (!actions.length) throw new Error('No legal choice');
    if (!['default', 'doubao', 'juewu'].includes(difficulty))
      throw new Error('Invalid bot difficulty');
    const observed = observeMemory(memory, view, decision.seatId, difficulty);
    const action =
      difficulty === 'default'
        ? preliminaryAction(view, actions, decision.seatId, observed)
        : new PositionEvaluator(
            view,
            decision.seatId,
            observed,
            signal,
            difficulty,
          ).choose(actions);
    return { action, memory: observed };
  },
};
