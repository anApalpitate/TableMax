export const soundMutedKey = 'tablemax-sound-muted';
const legacyKeys = [
  'tablemax-modern-art-phone-sound-muted',
  'tablemax-avalon-player-sound-muted',
  'tablemax-manila-player-sound-muted',
] as const;

export interface SoundPreferenceEnvironment {
  read(key: string): string | null;
  write(key: string, value: string): void;
  listen(changed: (enabled: boolean) => void): () => void;
  broadcast(enabled: boolean): void;
}

/** A device preference never enters a room command, checkpoint or audio claim. */
export function createSoundPreferenceStore(
  environment: SoundPreferenceEnvironment,
) {
  let value: boolean | undefined;
  let stopListening: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const read = () => {
    try {
      const saved = environment.read(soundMutedKey);
      if (saved !== null) return saved !== 'true';
      const legacy = legacyKeys.map((key) => environment.read(key));
      if (legacy.some((entry) => entry !== null)) {
        // Preserve an existing mute when formerly independent phone settings differ.
        const enabled = !legacy.includes('true');
        try {
          environment.write(soundMutedKey, String(!enabled));
        } catch {
          // Keep the migrated value usable even when its write is denied.
        }
        return enabled;
      }
      return true;
    } catch {
      return value ?? true;
    }
  };
  const get = () => (value ??= read());
  const accept = (next: boolean) => {
    if (next === get()) return;
    value = next;
    for (const changed of listeners) changed();
  };
  return {
    get,
    set(next: boolean) {
      accept(next);
      try {
        environment.write(soundMutedKey, String(!next));
      } catch {
        // Denied storage retains the in-document preference and notifications.
      }
      environment.broadcast(next);
    },
    subscribe(changed: () => void) {
      if (!listeners.size) {
        value = read();
        stopListening = environment.listen(accept);
      }
      listeners.add(changed);
      return () => {
        listeners.delete(changed);
        if (!listeners.size) {
          stopListening?.();
          stopListening = undefined;
        }
      };
    },
  };
}
