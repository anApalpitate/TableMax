import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  NotificationCenter,
  NOTIFICATION_FADE_MS,
} from './notification-center';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it('counts fading notices toward the limit and retires only the oldest when a fourth arrives', () => {
  const center = new NotificationCenter(3);
  const first = center.show('入座失败', 'error', 10000)!;
  const original = center.snapshot();
  center.dismiss(first);
  expect(center.snapshot()[0]?.leaving).toBe(true);
  expect(original[0]?.leaving).toBe(false);
  center.show('头像已被选择', 'error', 10000);
  center.show('外部入口已保存', 'success', 10000);
  expect(center.snapshot()).toHaveLength(3);
  center.show('连接已恢复', 'info', 10000);
  expect(center.snapshot().map((item) => item.message)).toEqual([
    '头像已被选择',
    '外部入口已保存',
    '连接已恢复',
  ]);
  vi.advanceTimersByTime(NOTIFICATION_FADE_MS);
  expect(center.snapshot()).toHaveLength(3);
  expect(original).toEqual([
    { id: first, message: '入座失败', tone: 'error', leaving: false },
  ]);
});

it('gives errors longer reading time and removes each notice only after its fade', () => {
  const center = new NotificationCenter();
  const info = center.show('已入座')!;
  const error = center.show('牌桌已满，请联系管理员。', 'error')!;
  vi.advanceTimersByTime(5499);
  expect(center.snapshot().every((item) => !item.leaving)).toBe(true);
  vi.advanceTimersByTime(1);
  expect(center.snapshot().find((item) => item.id === info)?.leaving).toBe(
    true,
  );
  expect(center.snapshot().find((item) => item.id === error)?.leaving).toBe(
    false,
  );
  vi.advanceTimersByTime(NOTIFICATION_FADE_MS);
  expect(center.snapshot().map((item) => item.id)).toEqual([error]);
  vi.advanceTimersByTime(8500 - 5500 - NOTIFICATION_FADE_MS);
  expect(center.snapshot()[0]?.leaving).toBe(true);
  vi.advanceTimersByTime(NOTIFICATION_FADE_MS);
  expect(center.snapshot()).toEqual([]);
});

it('renews a repeated notice even during fading without an old removal deleting it', () => {
  const center = new NotificationCenter();
  const id = center.show('入座失败', 'error', 1000)!;
  vi.advanceTimersByTime(1000);
  expect(center.snapshot()[0]?.leaving).toBe(true);
  vi.advanceTimersByTime(100);
  expect(center.show('入座失败', 'error', 1000)).toBe(id);
  expect(center.snapshot()).toHaveLength(1);
  expect(center.snapshot()[0]?.leaving).toBe(false);
  vi.advanceTimersByTime(999);
  expect(center.snapshot()[0]?.leaving).toBe(false);
  vi.advanceTimersByTime(1);
  expect(center.snapshot()[0]?.leaving).toBe(true);
  vi.advanceTimersByTime(NOTIFICATION_FADE_MS);
  expect(center.snapshot()).toEqual([]);
});

it('keeps the reading timer paused until both hover and keyboard focus leave', () => {
  const center = new NotificationCenter();
  const id = center.show('请检查座位', 'error', 1000)!;
  vi.advanceTimersByTime(400);
  center.hold(id, 'hover', true);
  center.hold(id, 'focus', true);
  vi.advanceTimersByTime(2000);
  center.hold(id, 'hover', false);
  vi.advanceTimersByTime(2000);
  expect(center.snapshot()[0]?.leaving).toBe(false);
  center.hold(id, 'focus', false);
  vi.advanceTimersByTime(599);
  expect(center.snapshot()[0]?.leaving).toBe(false);
  vi.advanceTimersByTime(1);
  expect(center.snapshot()[0]?.leaving).toBe(true);
});

it('preserves remaining reading time while hidden, including notices created in the background', () => {
  const center = new NotificationCenter();
  const first = center.show('请检查入座条件', 'error', 1000)!;
  vi.advanceTimersByTime(400);
  center.setHidden(true);
  const second = center.show('连接已恢复', 'info', 1000)!;
  vi.advanceTimersByTime(10000);
  expect(center.snapshot().every((item) => !item.leaving)).toBe(true);
  center.setHidden(false);
  vi.advanceTimersByTime(600);
  expect(center.snapshot().find((item) => item.id === first)?.leaving).toBe(
    true,
  );
  expect(center.snapshot().find((item) => item.id === second)?.leaving).toBe(
    false,
  );
  vi.advanceTimersByTime(400);
  expect(center.snapshot().find((item) => item.id === second)?.leaving).toBe(
    true,
  );
});

it('clears reading and fade timers and stops updates after a listener unsubscribes', () => {
  const center = new NotificationCenter();
  const listener = vi.fn();
  const unsubscribe = center.subscribe(listener);
  const first = center.show('旧提示', 'info', 1000)!;
  center.dismiss(first);
  center.show('另一条提示', 'error', 1000);
  center.clear();
  expect(center.snapshot()).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
  unsubscribe();
  listener.mockClear();
  center.show('新提示', 'info', 1000);
  vi.advanceTimersByTime(1000 + NOTIFICATION_FADE_MS);
  expect(center.snapshot()).toEqual([]);
  expect(listener.mock.calls).toHaveLength(0);
});

it('rejects invalid limits and ignores empty messages', () => {
  for (const limit of [0, -1, 1.5, NaN, Infinity])
    expect(() => new NotificationCenter(limit)).toThrow();
  const center = new NotificationCenter(1);
  expect(center.show(' \n ')).toBeUndefined();
  expect(center.snapshot()).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
});
