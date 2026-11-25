import { expect, it, vi } from 'vitest';
import { evaluateBotMatch } from '../../../tools/analysis/bots/evaluate';
import { bot, rules } from '..';

const fixture = {
  rules,
  seed: 781,
  seats: [
    { id: 'seat-1', strategy: bot, difficulty: 'default' },
    { id: 'seat-2', strategy: bot, difficulty: 'doubao' },
    { id: 'seat-3', strategy: bot, difficulty: 'juewu' },
    { id: 'seat-4', strategy: bot, difficulty: 'default' },
  ] as const,
};

it('uses the same committed trace when a seeded mixed UNO match is resumed', async () => {
  const first = await evaluateBotMatch(fixture, { maxSteps: 17 });
  expect(first.outcome).toBe('step-limit');
  expect(first.checkpoint.steps).toBe(17);
  const restarted = await evaluateBotMatch(fixture, {
    maxSteps: 15000,
    checkpoint: JSON.parse(JSON.stringify(first.checkpoint)),
  });
  const uninterrupted = await evaluateBotMatch(fixture, { maxSteps: 15000 });
  expect(uninterrupted.outcome).toBe('ended');
  expect(uninterrupted.publicResult).toMatchObject({
    phase: 'ended',
    winners: [expect.any(String)],
  });
  expect(restarted).toEqual(uninterrupted);
  await expect(
    evaluateBotMatch(
      { ...fixture, seed: 782 },
      { maxSteps: 15000, checkpoint: first.checkpoint },
    ),
  ).rejects.toThrow('does not match');
}, 30_000);

it('rejects an injected illegal action before emitting any committed trace step', async () => {
  const first = await evaluateBotMatch(fixture, { maxSteps: 1 });
  const snapshot = structuredClone(first.checkpoint);
  const step = vi.fn();
  const badBot = {
    ...bot,
    async decide() {
      return {
        action: { type: 'play', cardId: 'unknown-card' },
        memory: null,
      };
    },
  };
  await expect(
    evaluateBotMatch(
      {
        ...fixture,
        seats: fixture.seats.map((seat) => ({ ...seat, strategy: badBot })),
      },
      { maxSteps: 5, checkpoint: first.checkpoint, onStep: step },
    ),
  ).rejects.toThrow('Illegal evaluation action');
  expect(step).not.toHaveBeenCalled();
  expect(first.checkpoint).toEqual(snapshot);
});

it('leaves the current checkpoint unchanged when a strategy is cancelled', async () => {
  const start = await evaluateBotMatch(fixture, { maxSteps: 1 });
  const controller = new AbortController();
  const cancelledBot = {
    ...bot,
    async decide() {
      controller.abort();
      throw new Error('Aborted');
    },
  };
  const result = await evaluateBotMatch(
    {
      ...fixture,
      seats: fixture.seats.map((seat) => ({ ...seat, strategy: cancelledBot })),
    },
    { maxSteps: 5, checkpoint: start.checkpoint, signal: controller.signal },
  );
  expect(result.outcome).toBe('cancelled');
  expect(result.checkpoint).toEqual(start.checkpoint);
});
