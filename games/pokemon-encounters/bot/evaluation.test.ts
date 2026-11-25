import { expect, it } from 'vitest';
import { evaluateBotMatch } from '../../../tools/analysis/bots/evaluate';
import { bot, rules } from '..';

it('runs Pokémon original through the same headless evaluation to the native match result', async () => {
  const result = await evaluateBotMatch(
    {
      rules,
      seed: 20261126,
      seats: [
        { id: 'seat-1', strategy: bot, difficulty: 'default' },
        { id: 'seat-2', strategy: bot, difficulty: 'default' },
      ],
    },
    { maxSteps: 15000 },
  );
  expect(result.outcome).toBe('ended');
  expect(result.publicResult).toMatchObject({
    phase: 'match-result',
    winsBySeat: expect.any(Object),
  });
  expect(result.publicResult).not.toHaveProperty('self');
  expect(result.checkpoint.steps).toBeGreaterThan(2);
}, 30_000);
