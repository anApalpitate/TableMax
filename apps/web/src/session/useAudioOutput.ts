import { useEffect, useState } from 'react';
import type {} from '../../../desktop/src/audio-types';
export function useAudioOutput() {
  const bridge = window.tablemaxAudio;
  const [canPlay, setCanPlay] = useState(!bridge);
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    const unsubscribe = bridge.subscribe((value) => {
      if (active) setCanPlay(value);
    });
    void bridge.connect().then(
      (value) => {
        if (active) setCanPlay(value);
      },
      () => {
        if (active) setCanPlay(false);
      },
    );
    return () => {
      active = false;
      unsubscribe();
      void bridge.disconnect().catch(() => undefined);
    };
  }, [bridge]);
  return canPlay;
}
