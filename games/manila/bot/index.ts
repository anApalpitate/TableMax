import type { BotDifficulty, BotStrategy } from '@tablemax/game-sdk';
import type { Action, ManilaView } from '../rules/view';
import { evaluateDefault } from './default';
import { evaluateDoubao } from './doubao';
import { evaluateJuewu } from './juewu';
import { leadingRival, rivalPressure } from './mischief';

const evaluate = {
  default: evaluateDefault,
  doubao: evaluateDoubao,
  juewu: evaluateJuewu,
  mischief: evaluateJuewu,
} satisfies Record<BotDifficulty, typeof evaluateJuewu>;

export const bot: BotStrategy = {
  id: 'manila-local',
  version: '1.1.0',
  gameId: 'manila',
  rulesVersion: 'manila-classic-2005-v1',
  difficulties: ['default', 'doubao', 'juewu', 'mischief'],
  validateMemory(input) {
    if (input !== null) throw new Error('Invalid Manila bot memory');
    return null;
  },
  async decide({
    view,
    actions,
    decision,
    memory,
    difficulty = 'default',
    random,
    signal,
  }) {
    bot.validateMemory(memory);
    if (!Object.hasOwn(evaluate, difficulty))
      throw new Error('Invalid Manila bot configuration');
    const v = view as ManilaView;
    if (
      v.self?.seatId !== decision.seatId ||
      v.turnSeat !== decision.seatId ||
      !actions.length
    )
      throw new Error('No authorized Manila decision');

    // Visit the same candidates in the supplied order for normal play and pressure.
    const scores = (actions as readonly Action[]).map((action) => {
      if (signal.aborted) throw new Error('Manila bot cancelled');
      return { action, baseline: evaluate[difficulty](v, action) };
    });
    const target = difficulty === 'mischief' ? leadingRival(v) : undefined;
    const adjust = target ? rivalPressure(v, target) : undefined;
    const bestBaseline = scores.reduce(
      (maximum, { baseline }) => Math.max(maximum, baseline),
      -Infinity,
    );
    let best = -Infinity;
    const choices: Action[] = [];
    for (const { action, baseline } of scores) {
      if (signal.aborted) throw new Error('Manila bot cancelled');
      const bonus = adjust && baseline >= bestBaseline - 2 ? adjust(action) : 0;
      const value = baseline + bonus;
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
