import { useSyncExternalStore } from 'react';

const key = 'tablemax-sound-volume';
const changed = 'tablemax-sound-volume-change';
let fallback = 1;

export function getSoundVolume() {
  if (typeof window === 'undefined') return 1;
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === null) return 1;
    const volume = Number(saved);
    return saved.trim() && Number.isFinite(volume) && volume >= 0 && volume <= 1
      ? volume
      : 1;
  } catch {
    return fallback;
  }
}

export function subscribeSoundVolume(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) listener();
  };
  window.addEventListener(changed, listener);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(changed, listener);
    window.removeEventListener('storage', storage);
  };
}

function setSoundVolume(volume: number) {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) return;
  fallback = volume;
  try {
    window.localStorage.setItem(key, String(volume));
  } catch {
    // Keep the page's preference when storage is blocked.
  }
  window.dispatchEvent(new Event(changed));
}

export function useSoundVolume() {
  return [
    useSyncExternalStore(subscribeSoundVolume, getSoundVolume, () => 1),
    setSoundVolume,
  ] as const;
}

type VolumePort = { volume: number };
const nominal = new WeakMap<VolumePort, number>();

export function setPlaybackVolume(output: VolumePort, level: number) {
  nominal.set(output, level);
  output.volume = level * getSoundVolume();
}

export function trackPlaybackVolume(output: VolumePort) {
  if (!nominal.has(output)) nominal.set(output, output.volume);
  const update = () => {
    output.volume = nominal.get(output)! * getSoundVolume();
  };
  update();
  return subscribeSoundVolume(update);
}
