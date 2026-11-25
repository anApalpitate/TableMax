import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import {
  readTrainingLease,
  writeTrainingControl,
} from '../../../packages/platform-core/src/training-lease';
import { assertLearningBudget } from '../../../packages/platform-core/src/learning-storage';
import { IdleTrainingLease } from './idle-training-lease';

it('allows idle training only after opt-in, revokes it during play and resumes when quiet', async () => {
  vi.useFakeTimers({ now: Date.UTC(2026, 10, 26) });
  const root = resolve(process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp');
  mkdirSync(root, { recursive: true });
  const profile = mkdtempSync(join(root, 'training-lease-'));
  mkdirSync(join(profile, 'learning'));
  const file = join(profile, 'learning', 'training-lease.json');
  let enabled = false;
  const callbacks = new Set<() => void>();
  const room = {
    canTrainWhileIdle: true,
    subscribe(callback: () => void) {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
  };
  const notify = () => callbacks.forEach((callback) => callback());
  const lease = new IdleTrainingLease(profile, room, () => enabled);
  lease.start();
  try {
    expect(lease.status()).toBe('disabled');
    expect(readTrainingLease(file)).toBeUndefined();
    enabled = true;
    notify();
    expect(readTrainingLease(file)?.allowed).toBe(false);
    await vi.advanceTimersByTimeAsync(5300);
    const first = readTrainingLease(file)!;
    expect(first.allowed).toBe(true);
    expect(lease.status()).toBe('waiting');
    writeTrainingControl(join(profile, 'learning', 'training-worker.json'), {
      version: 1,
      session: first.session,
      stage: 'running',
      writtenAt: Date.now(),
    });
    expect(lease.status()).toBe('running');
    room.canTrainWhileIdle = false;
    notify();
    expect(readTrainingLease(file)?.allowed).toBe(false);
    expect(lease.status()).toBe('paused');
    await vi.advanceTimersByTimeAsync(8000);
    expect(readTrainingLease(file)?.allowed).not.toBe(true);
    room.canTrainWhileIdle = true;
    notify();
    await vi.advanceTimersByTimeAsync(4999);
    expect(readTrainingLease(file)?.allowed).not.toBe(true);
    await vi.advanceTimersByTimeAsync(751);
    expect(readTrainingLease(file)?.allowed).toBe(true);
    writeTrainingControl(join(profile, 'learning', 'training-worker.json'), {
      version: 1,
      session: first.session,
      stage: 'candidate',
      writtenAt: Date.now() - 6000,
    });
    expect(lease.status()).toBe('candidate');
    lease.stop();
    expect(readTrainingLease(file)?.allowed).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    expect(readTrainingLease(file)).toBeUndefined();
  } finally {
    lease.stop();
    vi.useRealTimers();
  }
});

it('halts training allocations at the logical budget without removing retained entries', () => {
  const root = resolve(process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp');
  mkdirSync(root, { recursive: true });
  const profile = mkdtempSync(join(root, 'training-quota-'));
  const job = join(profile, 'job');
  mkdirSync(job);
  const previous = join(job, 'checkpoint.json');
  writeFileSync(previous, 'saved checkpoint');
  expect(() => assertLearningBudget(profile, 8, 24)).not.toThrow();
  expect(() => assertLearningBudget(profile, 9, 24)).toThrow(
    'UNO_LEARNING_QUOTA',
  );
  expect(readFileSync(previous, 'utf8')).toBe('saved checkpoint');
});
