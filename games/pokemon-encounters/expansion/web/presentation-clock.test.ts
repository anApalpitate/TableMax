import { afterEach, expect, it, vi } from 'vitest';
import type { View } from '../project';
import { PresentationClock } from './presentation-clock';
import { presentedWins, presentationSteps } from './playback';

const game = {
  boards: {},
  activeResearch: [],
  matchWinners: [],
  roundResult: null,
} as unknown as View;
const steps = (id: number) =>
  presentationSteps(
    game,
    [{ id, kind: 'research', text: '新任务' }],
    id,
    false,
  );
afterEach(() => vi.useRealTimers());

it('a live next round plays only its new saved cues while a restored authority does not', () => {
  vi.useFakeTimers();
  const clock = new PresentationClock('round1', [1], 'instance:branch1:player');
  clock.receive(
    'round2',
    steps(3),
    false,
    [1, 2, 3],
    'instance:branch1:player',
  );
  expect(clock.snapshot().current?.event.id).toBe(3);
  vi.runAllTimers();
  clock.receive(
    'round2',
    steps(2),
    false,
    [1, 2, 3],
    'instance:branch1:player',
  );
  expect(clock.snapshot().current).toBeNull();
  clock.receive(
    'restored-round1',
    steps(4),
    false,
    [1, 2, 3, 4],
    'instance:branch2:player',
  );
  expect(clock.snapshot().current).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  clock.dispose();
});

it('a branch change cancels queued timers and consumes restored events without replay', () => {
  vi.useFakeTimers();
  const clock = new PresentationClock('branch1', []);
  clock.receive('branch1', [...steps(1), ...steps(2)], false, [1, 2]);
  clock.receive('branch2', steps(3), false, [1, 2, 3]);
  expect(clock.snapshot().current).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  clock.receive('branch2', steps(3), false, [1, 2, 3]);
  expect(clock.snapshot().current).toBeNull();
  clock.receive('branch2', steps(4), false, [1, 2, 3, 4]);
  expect(clock.snapshot().current?.event.id).toBe(4);
  clock.dispose();
});

it('geometry is supplied by the DOM adapter, deduplicated and retained for departing cards', () => {
  const clock = new PresentationClock('round', []);
  const listener = vi.fn();
  clock.subscribe(listener);
  const rect = { x: 12, y: 20, width: 40, height: 56 };
  clock.measure({ A: rect });
  clock.measure({ A: { ...rect } });
  expect(listener).toHaveBeenCalledTimes(1);
  clock.measure({ B: rect });
  expect(clock.snapshot().anchors).toEqual({ A: rect, B: rect });
  clock.dispose();
});

it('mount and fast reentry consume existing receipts without replay, then play a new save', () => {
  vi.useFakeTimers();
  const clock = new PresentationClock('round1', [1]);
  clock.receive('round1', steps(1), false, [1]);
  expect(clock.snapshot().current).toBeNull();
  clock.receive('round1', steps(2), false, [1, 2]);
  expect(clock.snapshot().current?.event.id).toBe(2);
  clock.dispose();
  expect(vi.getTimerCount()).toBe(0);
  clock.receive('round1', steps(2), false, [1, 2]);
  expect(clock.snapshot().current).toBeNull();
  clock.receive('round1', steps(3), false, [1, 2, 3]);
  expect(clock.snapshot().current?.event.id).toBe(3);
  clock.dispose();
});

it('pause cancels the queue and resume does not replay the cancelled receipt', () => {
  vi.useFakeTimers();
  const clock = new PresentationClock('round1', []);
  clock.receive('round1', steps(1), false, [1]);
  clock.receive('round1', steps(1), true, [1]);
  clock.receive('round1', steps(1), false, [1]);
  expect(clock.snapshot().current).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it('both common winners gain their final star only in the result stage', () => {
  const result = {
    winsBySeat: { A: 3, B: 2, C: 1 },
    roundResult: { winners: ['A', 'B'], scores: {} },
  } as Pick<View, 'winsBySeat' | 'roundResult'>;
  expect(['A', 'B', 'C'].map((s) => presentedWins(result, s, false))).toEqual([
    2, 1, 1,
  ]);
  expect(['A', 'B', 'C'].map((s) => presentedWins(result, s, true))).toEqual([
    3, 2, 1,
  ]);
  expect(presentedWins({ ...result, roundResult: null }, 'A', false)).toBe(3);
});
