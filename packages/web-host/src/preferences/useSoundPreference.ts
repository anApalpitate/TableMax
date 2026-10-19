import { useEffect, useSyncExternalStore } from 'react';
import { createSoundPreferenceStore, soundMutedKey } from './sound-preference';

const eventName = 'tablemax-sound-preference';
const store = createSoundPreferenceStore({
  read: (key) => window.localStorage.getItem(key),
  write: (key, value) => window.localStorage.setItem(key, value),
  broadcast: (enabled) =>
    window.dispatchEvent(new CustomEvent(eventName, { detail: enabled })),
  listen: (changed) => {
    const local = (event: Event) => {
      const value = (event as CustomEvent<unknown>).detail;
      if (typeof value === 'boolean') changed(value);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === soundMutedKey || event.key === null)
        changed(event.newValue !== 'true');
    };
    window.addEventListener(eventName, local);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener(eventName, local);
      window.removeEventListener('storage', storage);
    };
  },
});

export function useSoundPreference() {
  const enabled = useSyncExternalStore(store.subscribe, store.get, () => true);
  return [enabled, store.set] as const;
}

/** Stop active and pending media in the same notification that updates controls. */
export function subscribeSoundPreference(changed: (enabled: boolean) => void) {
  return store.subscribe(() => changed(store.get()));
}

/** Only a local switch gesture can grant browser playback permission. */
export function useSoundActivation(activate: () => void) {
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<unknown>).detail === true) activate();
    };
    window.addEventListener(eventName, changed);
    return () => window.removeEventListener(eventName, changed);
  }, [activate]);
}
