import type { BotStrategy } from '@tablemax/game-sdk';
import type { View } from '../project';
import type { Action } from '../state';
import { observeMemory, validateMemory } from './memory';
import { choose } from './strategy';
export const bot: BotStrategy = {
  id: 'pokemon-encounters/expansion',
  version: '1',
  gameId: 'pokemon-encounters',
  rulesVersion: 'tablemax-cn-expansion-v1',
  difficulties: ['default', 'doubao', 'juewu'],
  validateMemory,
  observe: ({ view, memory, seatId, difficulty }) =>
    observeMemory(memory, view as View, seatId, difficulty),
  async decide({
    view: raw,
    actions: choices,
    decision,
    memory,
    difficulty = 'default',
    random,
    signal,
  }) {
    if (signal.aborted) throw new Error('Aborted');
    const view = raw as View;
    const observed = observeMemory(memory, view, decision.seatId, difficulty);
    const action = choose(
      view,
      choices as readonly Action[],
      observed,
      difficulty,
      random,
      signal,
    );
    return { action, memory: observed };
  },
};
