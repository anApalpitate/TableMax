import { setTimeout as delay } from 'node:timers/promises';
import { expect, it } from 'vitest';
import {
  runUnoComparisonBlock,
  type UnoComparisonMatch,
  type UnoComparisonSeed,
} from '../../../tools/analysis/bots/uno-comparison-match';

const matchup: UnoComparisonSeed = { pool: 'mixed', seed: 42, ordinal: 5 };
const order = (match: UnoComparisonMatch) =>
  match.seat * 3 + ['A', 'B', 'C'].indexOf(match.arm);

it('orders games by the frozen seat/arm sequence despite uneven worker completion', async () => {
  const signal = new AbortController().signal;
  const completed: number[] = [];
  const play = async (match: UnoComparisonMatch) => {
    const index = order(match);
    await delay(index === 0 ? 25 : 1);
    completed.push(index);
    return {
      arm: match.arm,
      seat: match.seat,
      outcome: 'ended' as const,
      won: index % 2 === 1,
    };
  };
  const serial = await runUnoComparisonBlock(matchup, 1, 10, play, signal);
  completed.length = 0;
  const parallel = await runUnoComparisonBlock(matchup, 6, 10, play, signal);
  expect(completed[0]).not.toBe(0);
  expect(parallel).toEqual(serial);
  expect(parallel.matches).toHaveLength(12);
});

it('reserves one failure slot for every in-flight game even near the cutoff', async () => {
  const signal = new AbortController().signal;
  const dispatched: number[] = [];
  const play = async (match: UnoComparisonMatch) => {
    const index = order(match);
    dispatched.push(index);
    await delay(index === 1 ? 20 : 1);
    if (index === 3) throw new Error('Fixture worker failed');
    if (index === 1 || index === 6)
      return {
        arm: match.arm,
        seat: match.seat,
        outcome: 'step-limit' as const,
        won: null,
      };
    return {
      arm: match.arm,
      seat: match.seat,
      outcome: 'ended' as const,
      won: false,
    };
  };
  const serial = await runUnoComparisonBlock(matchup, 1, 3, play, signal);
  dispatched.length = 0;
  const parallel = await runUnoComparisonBlock(matchup, 8, 3, play, signal);
  expect(dispatched).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(parallel).toEqual(serial);
  expect(parallel.failures).toBe(3);
});

it('reuses completed A/B controls while dispatching the four new C games', async () => {
  const signal = new AbortController().signal;
  const play = async (match: UnoComparisonMatch) => ({
    arm: match.arm,
    seat: match.seat,
    outcome: 'ended' as const,
    won: match.seat % 2 === 0,
  });
  const before = await runUnoComparisonBlock(matchup, 2, 10, play, signal);
  const control = { ...matchup, matches: before.matches };
  const dispatched: number[] = [];
  const next = await runUnoComparisonBlock(
    matchup,
    4,
    10,
    async (assignment) => {
      dispatched.push(order(assignment));
      const result = await play(assignment);
      return { ...result, won: !result.won };
    },
    signal,
    control,
  );
  expect(dispatched).toEqual([2, 5, 8, 11]);
  expect(next.matches).toEqual(
    before.matches.map((match) =>
      match.arm === 'C' ? { ...match, won: !match.won } : match,
    ),
  );
  await expect(
    runUnoComparisonBlock(matchup, 2, 10, play, signal, {
      ...control,
      seed: 95,
    }),
  ).rejects.toThrow('complete matching seed block');
});

it('rejects an interrupted block instead of treating cancellation as a saved match result', async () => {
  const controller = new AbortController();
  const work = runUnoComparisonBlock(
    matchup,
    2,
    10,
    async (match) => {
      controller.abort(new Error('Interrupted fixture batch'));
      return {
        arm: match.arm,
        seat: match.seat,
        outcome: 'cancelled',
        won: null,
      };
    },
    controller.signal,
  );
  await expect(work).rejects.toThrow('Interrupted fixture batch');
});
