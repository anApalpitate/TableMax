import type { BotStrategy } from '@tablemax/game-sdk';
export const bot: BotStrategy = {
  id: 'template-simple',
  version: '1.0.0',
  gameId: 'template',
  rulesVersion: 'template-v1',
  validateMemory(input) {
    if (input !== null) throw new Error('Invalid memory');
    return null;
  },
  async decide({ actions, random, memory }) {
    if (!actions.length) throw new Error('No legal action');
    return {
      action: actions[Math.floor(random.next() * actions.length)]!,
      memory,
    };
  },
};
