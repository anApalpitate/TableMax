import { useCallback, useEffect, useState } from 'react';
import type {} from '../../../desktop/src/audio-types';
import { INTERACTION_CATALOG, type InteractionEvent } from '@tablemax/protocol';
import { interactionAsset } from './assets';
import { InteractionAudioPlayer } from './audio-player';
const audioUrls = [...INTERACTION_CATALOG.shots, ...INTERACTION_CATALOG.phrases]
  .map((entry) => interactionAsset(entry.audio))
  .filter(Boolean);
export function useInteractionAudio(enabled: boolean) {
  const [engine] = useState(
    () =>
      new InteractionAudioPlayer({
        createContext: () => {
          const constructor =
            window.AudioContext ??
            (window as Window & { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (!constructor) throw new Error('Audio is unavailable');
          return new constructor();
        },
        fetchAudio: async (url) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error('Interaction audio is unavailable');
          return response.arrayBuffer();
        },
        canPlay: () => document.visibilityState !== 'hidden',
        claim: async (eventId) =>
          window.tablemaxInteractionAudio
            ? window.tablemaxInteractionAudio.claimEvent(eventId)
            : true,
        now: () => performance.now(),
      }),
  );
  const stop = useCallback(() => engine.stop(), [engine]);
  const unlock = useCallback(() => {
    if (!enabled) return;
    try {
      void engine.unlock(audioUrls).catch(() => undefined);
    } catch {
      /* Unsupported browsers keep visual interactions. */
    }
  }, [engine, enabled]);
  useEffect(() => {
    const bridge = window.tablemaxInteractionAudio;
    let active = true;
    engine.setEnabled(enabled);
    engine.setOwner(enabled && !bridge);
    const unsubscribe = bridge?.subscribe((value) => {
      if (!active) return;
      engine.setOwner(value && enabled);
    });
    if (enabled) engine.prepare(audioUrls);
    if (bridge) {
      if (enabled) {
        unlock();
        void bridge
          .connect()
          .then((value) => {
            if (active) engine.setOwner(value && enabled);
          })
          .catch(() => {
            engine.setOwner(false);
          });
      } else void bridge.disconnect().catch(() => undefined);
    }
    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('pointerup', unlock, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true });
    return () => {
      active = false;
      engine.setOwner(false);
      stop();
      unsubscribe?.();
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('pointerup', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      if (bridge) void bridge.disconnect().catch(() => undefined);
    };
  }, [enabled, engine, stop, unlock]);
  useEffect(() => () => engine.close(), [engine]);
  const play = useCallback(
    async (event: InteractionEvent, startedAt: number) => {
      const payload = event.interaction;
      const entry =
        payload.type === 'shot'
          ? INTERACTION_CATALOG.shots.find(
              (shot) => shot.id === payload.effectId,
            )!
          : INTERACTION_CATALOG.phrases.find(
              (phrase) => phrase.id === payload.phraseId,
            )!;
      const url = interactionAsset(entry.audio);
      if (url)
        await engine.play(url, event.eventId, startedAt, event.durationMs);
    },
    [engine],
  );
  return { play, stop, unlock };
}
