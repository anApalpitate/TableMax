import { useLayoutEffect, useState } from 'react';
import {
  measureViewport,
  sameViewport,
  subscribeViewport,
  type ViewportSnapshot,
} from './viewport';

/** rootSelector binds measurement only; layout, role and supported sizes stay with callers. */
export function useViewportSnapshot(
  rootSelector: string,
  safeAreaPrefix: string,
) {
  const [snapshot, setSnapshot] = useState<ViewportSnapshot>(() => ({
    ...measureViewport(
      { width: window.innerWidth, height: window.innerHeight },
      window.visualViewport,
    ),
    revision: 0,
  }));
  useLayoutEffect(
    () =>
      subscribeViewport(rootSelector, safeAreaPrefix, (next) => {
        setSnapshot((previous) =>
          sameViewport(previous, next)
            ? previous
            : { ...next, revision: previous.revision + 1 },
        );
      }),
    [rootSelector, safeAreaPrefix],
  );
  return snapshot;
}
