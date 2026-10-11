import type { BotStrategy } from '@tablemax/game-sdk';
export const bot: BotStrategy = {
  id: 'author-example-bot',
  gameId: 'author-example',
  version: '1.0.0',
  rulesVersion: 'example-1',
  validateMemory(value) {
    if (value !== null) throw new Error('Invalid example memory');
    return null;
  },
  async decide({ actions, memory }) {
    if (!actions.length) throw new Error('No legal action');
    return { action: actions[0]!, memory };
  },
};
