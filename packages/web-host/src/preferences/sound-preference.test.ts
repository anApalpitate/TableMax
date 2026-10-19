import { describe, expect, it, vi } from 'vitest';
import {
  createSoundPreferenceStore,
  soundMutedKey,
  type SoundPreferenceEnvironment,
} from './sound-preference';

function fixture(initial: Record<string, string> = {}) {
  const saved = new Map(Object.entries(initial));
  const documents = new Set<{
    changed: ((enabled: boolean) => void) | null;
  }>();
  const document = () => {
    const target = { changed: null as ((enabled: boolean) => void) | null };
    documents.add(target);
    const environment: SoundPreferenceEnvironment = {
      read: (key) => saved.get(key) ?? null,
      write: (key, value) => {
        saved.set(key, value);
        if (key === soundMutedKey)
          for (const other of documents)
            if (other !== target) other.changed?.(value !== 'true');
      },
      listen: (changed) => {
        target.changed = changed;
        return () => {
          target.changed = null;
        };
      },
      broadcast: (enabled) => target.changed?.(enabled),
    };
    return createSoundPreferenceStore(environment);
  };
  return { saved, document };
}

describe('current-device sound preference', () => {
  it('uses the existing global preference ahead of legacy phone values', () => {
    const f = fixture({
      [soundMutedKey]: 'false',
      'tablemax-manila-player-sound-muted': 'true',
    });
    expect(f.document().get()).toBe(true);
    expect(f.saved.get(soundMutedKey)).toBe('false');
  });

  it('migrates missing global preferences and preserves an explicit old mute', () => {
    const f = fixture({
      'tablemax-modern-art-phone-sound-muted': 'false',
      'tablemax-avalon-player-sound-muted': 'true',
    });
    expect(f.document().get()).toBe(false);
    expect(f.saved.get(soundMutedKey)).toBe('true');
    expect(f.saved.get('tablemax-avalon-player-sound-muted')).toBe('true');
  });

  it('notifies local playback and another document before set returns', () => {
    const f = fixture();
    const local = f.document();
    const frameOrPublicWindow = f.document();
    const stopLocal = vi.fn();
    const stopOther = vi.fn();
    const releaseLocal = local.subscribe(stopLocal);
    const releaseOther = frameOrPublicWindow.subscribe(stopOther);
    local.set(false);
    expect(local.get()).toBe(false);
    expect(frameOrPublicWindow.get()).toBe(false);
    expect(stopLocal).toHaveBeenCalledTimes(1);
    expect(stopOther).toHaveBeenCalledTimes(1);
    expect(f.document().get()).toBe(false);
    frameOrPublicWindow.set(true);
    expect(local.get()).toBe(true);
    expect(stopLocal).toHaveBeenCalledTimes(2);
    releaseLocal();
    releaseOther();
  });

  it('keeps local controls and synchronous playback cancellation when storage is denied', () => {
    const store = createSoundPreferenceStore({
      read: () => {
        throw new Error('denied');
      },
      write: () => {
        throw new Error('denied');
      },
      listen: () => () => {},
      broadcast: () => {},
    });
    const stop = vi.fn();
    const release = store.subscribe(stop);
    expect(store.get()).toBe(true);
    store.set(false);
    expect(store.get()).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
    release();
    const releaseAgain = store.subscribe(stop);
    expect(store.get()).toBe(false);
    releaseAgain();
  });

  it('broadcasts an explicit enable gesture even when sound was already enabled', () => {
    const activate = vi.fn();
    const store = createSoundPreferenceStore({
      read: () => 'false',
      write: () => {},
      listen: () => () => {},
      broadcast: activate,
    });
    const changed = vi.fn();
    const release = store.subscribe(changed);
    store.set(true);
    expect(changed).not.toHaveBeenCalled();
    expect(activate).toHaveBeenCalledWith(true);
    release();
  });

  it('refreshes a remounted page from changes made while its last subscriber was absent', () => {
    const f = fixture();
    const page = f.document();
    const other = f.document();
    const release = page.subscribe(() => {});
    expect(page.get()).toBe(true);
    release();
    other.set(false);
    const releaseAgain = page.subscribe(() => {});
    expect(page.get()).toBe(false);
    releaseAgain();
  });
});
