import { createHash } from 'node:crypto';
import type { GameRules } from '@tablemax/game-sdk';
import type { RoomView } from '@tablemax/protocol';
import type { Save } from './model';
import { requireThat } from './errors';
import { remainingActionClock } from './action-timing';

export function automaticDescriptor(data: Save, rules: GameRules | null) {
  if (data.status !== 'playing' || !data.snapshot || !rules?.automaticAction)
    return null;
  const value = rules.automaticAction(structuredClone(data.snapshot.state));
  if (!value) return null;
  requireThat(
    !!rules.applyAutomatic &&
      typeof value.key === 'string' &&
      value.key.length > 0 &&
      value.key.length <= 256 &&
      Number.isSafeInteger(value.delayMs) &&
      value.delayMs >= 1 &&
      value.delayMs <= 120_000,
    'invalid-automatic-timing',
  );
  return {
    ...value,
    key: createHash('sha256').update(value.key).digest('hex'),
  };
}

export function synchronizeAutomaticClock(
  next: Save,
  previous: Save | null,
  rules: GameRules | null,
  now: number,
  restoring = false,
) {
  if (!rules?.automaticAction && next.automaticClock === undefined) return;
  const pending = automaticDescriptor(next, rules);
  if (!pending) {
    next.automaticClock = null;
    return;
  }
  const old = previous?.automaticClock;
  const reuse =
    old &&
    old.key === pending.key &&
    previous.instanceId === next.instanceId &&
    previous.manifest?.id === next.manifest?.id &&
    (restoring || previous.branch === next.branch);
  next.automaticClock = {
    key: pending.key,
    remainingMs: reuse
      ? restoring
        ? old.remainingMs
        : remainingActionClock(old, now)
      : pending.delayMs,
    startedAt: next.paused ? null : now,
  };
}

export function projectAutomaticTiming(
  data: Save,
  now: number,
): NonNullable<RoomView['automaticTiming']> | null {
  const clock = data.automaticClock;
  return clock
    ? {
        key: clock.key,
        remainingMs: remainingActionClock(clock, now),
        serverTime: now,
        running: !data.paused && clock.startedAt !== null,
      }
    : null;
}

export function validateAutomaticClock(data: Save, rules: GameRules | null) {
  const descriptor = automaticDescriptor(data, rules);
  const clock = data.automaticClock;
  requireThat(
    descriptor
      ? !!clock &&
          Object.keys(clock).sort().join(',') === 'key,remainingMs,startedAt' &&
          clock.key === descriptor.key &&
          Number.isSafeInteger(clock.remainingMs) &&
          clock.remainingMs >= 0 &&
          clock.remainingMs <= descriptor.delayMs &&
          (data.paused
            ? clock.startedAt === null
            : Number.isSafeInteger(clock.startedAt) && clock.startedAt! >= 0)
      : clock === undefined || clock === null,
    'damaged-save',
  );
}
