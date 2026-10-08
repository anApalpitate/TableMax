import { useCallback, useEffect, useRef } from 'react';
import type {} from '../../../desktop/src/audio-types';
import { INTERACTION_CATALOG, type InteractionEvent } from '@tablemax/protocol';
import { interactionAsset } from './assets';

export function useInteractionAudio(enabled: boolean) {
  const context = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const epoch = useRef(0);
  const allowed = useRef(false);
  const currentEnabled = useRef(enabled);
  useEffect(() => {
    currentEnabled.current = enabled;
  }, [enabled]);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const stop = useCallback(() => {
    epoch.current++;
    try {
      source.current?.stop();
    } catch {
      /* Already ended. */
    }
    source.current = null;
  }, []);
  useEffect(() => {
    const bridge = window.tablemaxInteractionAudio;
    let active = true;
    allowed.current = enabled && !bridge;
    const unsubscribe = bridge?.subscribe((value) => {
      if (!active) return;
      allowed.current = value && currentEnabled.current;
      if (!allowed.current) stop();
    });
    if (bridge) {
      if (enabled)
        void bridge
          .connect()
          .then((value) => {
            if (active) allowed.current = value;
          })
          .catch(() => {
            allowed.current = false;
          });
      else void bridge.disconnect().catch(() => undefined);
    }
    const unlock = () => {
      if (!currentEnabled.current) return;
      context.current ??= new AudioContext();
      void context.current.resume().catch(() => undefined);
    };
    // Native windows can enable Web Audio immediately; browsers use a gesture.
    if (bridge && enabled) unlock();
    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true });
    return () => {
      active = false;
      stop();
      unsubscribe?.();
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      if (bridge) void bridge.disconnect().catch(() => undefined);
    };
  }, [enabled, stop]);
  useEffect(
    () => () => {
      void context.current?.close().catch(() => undefined);
    },
    [],
  );
  const play = useCallback(
    async (event: InteractionEvent) => {
      stop();
      const generation = epoch.current;
      const audio = context.current;
      if (
        !allowed.current ||
        !currentEnabled.current ||
        !audio ||
        audio.state !== 'running'
      )
        return;
      const payload = event.interaction;
      const entry =
        payload.type === 'shot'
          ? INTERACTION_CATALOG.shots.find((s) => s.id === payload.effectId)!
          : INTERACTION_CATALOG.phrases.find((p) => p.id === payload.phraseId)!;
      const url = interactionAsset(entry.audio);
      if (!url) return;
      try {
        // Claim before decoding: a later owner never restarts this same sound.
        if (
          window.tablemaxInteractionAudio &&
          !(await window.tablemaxInteractionAudio.claimEvent(event.eventId))
        )
          return;
        let buffer = buffers.current.get(url);
        if (!buffer) {
          const response = await fetch(url);
          if (!response.ok) return;
          buffer = await audio.decodeAudioData(await response.arrayBuffer());
          buffers.current.set(url, buffer);
        }
        if (
          generation !== epoch.current ||
          !allowed.current ||
          !currentEnabled.current ||
          document.visibilityState === 'hidden'
        )
          return;
        const node = audio.createBufferSource();
        node.buffer = buffer;
        node.connect(audio.destination);
        source.current = node;
        node.start();
      } catch {
        /* Playback failure never blocks the room FIFO or game. */
      }
    },
    [stop],
  );
  return { play, stop };
}
