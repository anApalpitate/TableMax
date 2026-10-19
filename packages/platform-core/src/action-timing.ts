import { createHash } from 'node:crypto';
import type { GameRules, JsonValue } from '@tablemax/game-sdk';
import type { RoomView } from '@tablemax/protocol';
import type { ActionClockState, Save } from './model';
import { requireThat } from './errors';

function descriptor(
  rules: GameRules,
  state: JsonValue,
  action: JsonValue,
  seat: string,
) {
  const value = rules.actionTiming?.(state, action, seat);
  if (!value) return null;
  requireThat(
    typeof value.key === 'string' &&
      value.key.length > 0 &&
      value.key.length <= 256 &&
      Number.isSafeInteger(value.delayMs) &&
      value.delayMs >= 0 &&
      value.delayMs <= 5000,
    'invalid-action-timing',
  );
  return {
    key: createHash('sha256').update(value.key).digest('hex'),
    delayMs: value.delayMs,
  };
}

export function pendingActionTimings(data: Save, rules: GameRules | null) {
  const result = new Map<string, number>();
  if (!rules?.actionTiming || !data.snapshot || data.status !== 'playing')
    return result;
  for (const decision of rules.decisions(data.snapshot.state))
    for (const action of rules.legalActions(
      data.snapshot.state,
      decision.seatId,
    )) {
      const timing = descriptor(
        rules,
        data.snapshot.state,
        action,
        decision.seatId,
      );
      if (timing && timing.delayMs > 0) result.set(timing.key, timing.delayMs);
    }
  requireThat(result.size <= 32, 'invalid-action-timing');
  return result;
}

export function remainingActionClock(clock: ActionClockState, now: number) {
  return Math.max(
    0,
    clock.remainingMs -
      (clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt)),
  );
}

export function synchronizeActionClocks(
  next: Save,
  previous: Save | null,
  rules: GameRules | null,
  now: number,
  restoring = false,
) {
  if (!rules?.actionTiming) return;
  const reset =
    !previous ||
    previous.instanceId !== next.instanceId ||
    previous.branch !== next.branch ||
    previous.manifest?.id !== next.manifest?.id;
  const old = new Map(
    (previous?.actionClocks ?? []).map((clock) => [clock.key, clock]),
  );
  next.actionClocks = [...pendingActionTimings(next, rules)].map(
    ([key, delayMs]) => {
      const clock = reset ? undefined : old.get(key);
      return {
        key,
        remainingMs: clock
          ? restoring
            ? clock.remainingMs
            : remainingActionClock(clock, now)
          : delayMs,
        startedAt: next.paused ? null : now,
      };
    },
  );
}

export function actionDelayRemaining(
  data: Save,
  rules: GameRules,
  action: JsonValue,
  seat: string,
  now: number,
) {
  if (!data.snapshot) return 0;
  const timing = descriptor(rules, data.snapshot.state, action, seat);
  if (!timing) return 0;
  const clock = data.actionClocks?.find((clock) => clock.key === timing.key);
  return clock ? remainingActionClock(clock, now) : timing.delayMs;
}

export function projectActionTimings(
  data: Save,
  rules: GameRules,
  seat: string | null,
  now: number,
): NonNullable<RoomView['actionTiming']> {
  if (!seat || !data.snapshot || data.status !== 'playing') return [];
  const result = new Map<
    string,
    NonNullable<RoomView['actionTiming']>[number]
  >();
  for (const action of rules.legalActions(data.snapshot.state, seat)) {
    if (
      !action ||
      typeof action !== 'object' ||
      Array.isArray(action) ||
      typeof action.type !== 'string'
    )
      continue;
    if (!descriptor(rules, data.snapshot.state, action, seat)) continue;
    const remainingMs = actionDelayRemaining(data, rules, action, seat, now);
    if ((result.get(action.type)?.remainingMs ?? -1) < remainingMs)
      result.set(action.type, {
        actionType: action.type,
        remainingMs,
        serverTime: now,
        running: !data.paused,
      });
  }
  return [...result.values()];
}
