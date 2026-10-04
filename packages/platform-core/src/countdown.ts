import { createHash, randomUUID } from 'node:crypto';
import type { GameRules, PendingDecision } from '@tablemax/game-sdk';
import {
  DEFAULT_COUNTDOWN_SECONDS,
  type DecisionClock,
} from '@tablemax/protocol';
import type { DecisionClockState, Save } from './model';

export const decisionClockKey = (decision: PendingDecision) =>
  createHash('sha256')
    .update(
      decision.concurrencyGroup
        ? `group:${decision.concurrencyGroup}`
        : `decision:${decision.seatId}:${decision.id}`,
    )
    .digest('hex');

export function remainingClock(clock: DecisionClockState, now: number) {
  return Math.max(
    0,
    clock.remainingMs -
      (clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt)),
  );
}

export function synchronizeDecisionClocks(
  next: Save,
  previous: Save | null,
  rules: GameRules | null,
  now: number,
  restoring = false,
) {
  const pending =
    next.status === 'playing' && next.snapshot && rules
      ? rules.decisions(next.snapshot.state)
      : [];
  const reset =
    !previous ||
    previous.instanceId !== next.instanceId ||
    previous.branch !== next.branch ||
    previous.manifest?.id !== next.manifest?.id ||
    previous.countdownSeconds !== next.countdownSeconds;
  const old = new Map(
    (previous?.decisionClocks ?? []).map((clock) => [clock.key, clock]),
  );
  next.decisionClocks = [...new Set(pending.map(decisionClockKey))].map(
    (key) => {
      const existing = reset ? undefined : old.get(key);
      return {
        key,
        id: existing?.id ?? randomUUID(),
        // On restart, the room is paused at the last committed sample. Neither
        // unsaved crash time nor time with the application closed can be exact.
        remainingMs: existing
          ? restoring
            ? existing.remainingMs
            : remainingClock(existing, now)
          : (next.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS) * 1000,
        startedAt: next.paused ? null : now,
      };
    },
  );
}

export function projectDecisionClock(
  data: Save,
  rules: GameRules | null,
  seatId: string | null,
  now: number,
): DecisionClock | null {
  if (
    data.status !== 'playing' ||
    !data.snapshot ||
    !rules ||
    rules.manifest.decisionTimer === false
  )
    return null;
  const pending = rules.decisions(data.snapshot.state);
  const keys = new Set(
    pending
      .filter((decision) => !seatId || decision.seatId === seatId)
      .map(decisionClockKey),
  );
  const clocks = (data.decisionClocks ?? []).filter((clock) =>
    keys.has(clock.key),
  );
  const clock = clocks.reduce<DecisionClockState | null>(
    (earliest, candidate) =>
      !earliest ||
      remainingClock(candidate, now) < remainingClock(earliest, now)
        ? candidate
        : earliest,
    null,
  );
  if (!clock) return null;
  return {
    id: clock.id,
    remainingMs: remainingClock(clock, now),
    serverTime: now,
    running: !data.paused && clock.startedAt !== null,
  };
}
