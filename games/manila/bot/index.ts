import type { BotStrategy } from '@tablemax/game-sdk';
import type { Action, ManilaView } from '../rules/view';
import { evaluateDefault } from './default';
import { evaluateDoubao } from './doubao';
import { evaluateJuewu } from './juewu';

export const bot: BotStrategy = {
  id: 'manila-local',
  version: '1.0.0',
  gameId: 'manila',
  rulesVersion: 'manila-classic-2005-v1',
  difficulties: ['default', 'doubao', 'juewu'],
  validateMemory(input) {
    if (input !== null) throw new Error('Invalid Manila bot memory');
    return null;
  },
  async decide({
    view,
    actions,
    memory,
    difficulty = 'default',
    random,
    signal,
  }) {
    if (memory !== null || !['default', 'doubao', 'juewu'].includes(difficulty))
      throw new Error('Invalid Manila bot configuration');
    const v = view as ManilaView;
    if (!v.self || !actions.length)
      throw new Error('No authorized Manila decision');
    const evaluate =
      difficulty === 'juewu'
        ? evaluateJuewu
        : difficulty === 'doubao'
          ? evaluateDoubao
          : evaluateDefault;
    let best = -Infinity;
    const choices: Action[] = [];
    for (const raw of actions) {
      if (signal.aborted) throw new Error('Manila bot cancelled');
      const action = raw as Action,
        value = evaluate(v, action);
      if (value > best + 1e-9) {
        best = value;
        choices.length = 0;
        choices.push(action);
      } else if (Math.abs(value - best) < 1e-9) choices.push(action);
    }
    return {
      action: choices[Math.floor(random.next() * choices.length)]!,
      memory: null,
    };
  },
};
