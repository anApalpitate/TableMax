import { useSyncExternalStore } from 'react';

const values = new Map<string, boolean>();
const eventName = 'tablemax-guidance-preference';
const keyFor = (gameId: string) => `tablemax-guidance:${gameId}`;

function read(key: string) {
  if (!values.has(key)) {
    let enabled = false;
    try {
      enabled = localStorage.getItem(key) === 'true';
    } catch {
      // A blocked store still permits changing the preference in this window.
    }
    values.set(key, enabled);
  }
  return values.get(key)!;
}

export function useGuidancePreference(gameId: string) {
  const key = keyFor(gameId);
  const enabled = useSyncExternalStore(
    (changed) => {
      const local = (event: Event) => {
        if ((event as CustomEvent<string>).detail === key) changed();
      };
      const storage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) {
          values.set(
            key,
            event.key === null ? false : event.newValue === 'true',
          );
          changed();
        }
      };
      window.addEventListener(eventName, local);
      window.addEventListener('storage', storage);
      return () => {
        window.removeEventListener(eventName, local);
        window.removeEventListener('storage', storage);
      };
    },
    () => read(key),
    () => false,
  );
  const setEnabled = (next: boolean) => {
    values.set(key, next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // Keep the in-window value when persistence is unavailable.
    }
    window.dispatchEvent(new CustomEvent(eventName, { detail: key }));
  };
  return [enabled, setEnabled] as const;
}
