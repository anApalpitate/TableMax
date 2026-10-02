import type { BotStrategy } from '@tablemax/game-sdk';
import type { PokemonView } from '../rules/project';
import type { Action } from '../rules';
import { validateMemory, observeMemory, rememberAction } from './memory';
import { basicAction, preliminaryAction } from './strategy';
import { PositionEvaluator } from './evaluation';

export const bot: BotStrategy = {
  id: 'pokemon-encounters/basic',
  version: '1',
  gameId: 'pokemon-encounters',
  rulesVersion: 'tablemax-cn-s19-v1',
  difficulties: ['default', 'doubao', 'juewu'],
  validateMemory,
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
    if (difficulty === 'default')
      return {
        action: basicAction(view, actions, decision.seatId),
        memory: null,
      };
    if (difficulty !== 'doubao' && difficulty !== 'juewu')
      throw new Error('Invalid bot difficulty');
    const observed = observeMemory(memory, view, decision.seatId);
    const action =
      difficulty === 'doubao'
        ? preliminaryAction(view, actions, decision.seatId, observed)
        : new PositionEvaluator(view, decision.seatId, observed, signal).choose(
            actions,
          );
    return { action, memory: rememberAction(observed, action) };
  },
};
