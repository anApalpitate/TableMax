import { useCallback, useEffect, useState } from 'react';
import type { ScreenRole } from '../navigation';

const changed = 'tablemax-interaction-preference';
const preferenceKey = (role: ScreenRole) =>
  `tablemax-interaction-blocked-${role}`;

export function useInteractionPreference(role: ScreenRole) {
  const key = preferenceKey(role);
  const [blocked, setBlocked] = useState(() => {
    try {
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const storage = (event: StorageEvent) => {
      if (event.key === key) setBlocked(event.newValue === 'true');
    };
    const local = (event: Event) => {
      const detail = (
        event as CustomEvent<{ role: ScreenRole; blocked: boolean }>
      ).detail;
      if (detail?.role === role) setBlocked(detail.blocked);
    };
    window.addEventListener('storage', storage);
    window.addEventListener(changed, local);
    return () => {
      window.removeEventListener('storage', storage);
      window.removeEventListener(changed, local);
    };
  }, [role, key]);
  const update = useCallback(
    (next: boolean) => {
      setBlocked(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // The current window still remembers the choice when storage is unavailable.
      }
      window.dispatchEvent(
        new CustomEvent(changed, { detail: { role, blocked: next } }),
      );
    },
    [role, key],
  );
  return [blocked, update] as const;
}
