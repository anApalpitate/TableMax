import { useMemo, useSyncExternalStore } from 'react';
import type { DecisionClock } from '@tablemax/protocol';

/** Cached snapshots let all presentations share the same monotonic sampling. */
function clockStore(clock: DecisionClock | null) {
  const receivedAt = performance.now();
  let remaining = clock?.remainingMs ?? 0;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  const sample = () => {
    const next = Math.max(
      0,
      (clock?.remainingMs ?? 0) -
        (clock?.running ? performance.now() - receivedAt : 0),
    );
    if (next !== remaining) {
      remaining = next;
      for (const listener of listeners) listener();
    }
    if (next === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
  return {
    read: () => remaining,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (clock?.running && remaining > 0 && timer === undefined) {
        sample();
        if (remaining > 0) timer = setInterval(sample, 100);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
  };
}

export function useDecisionClock(clock: DecisionClock | null) {
  const store = useMemo(() => clockStore(clock), [clock]);
  return useSyncExternalStore(store.subscribe, store.read, store.read);
}
