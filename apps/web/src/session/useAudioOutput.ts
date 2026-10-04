import { useEffect, useState } from 'react';
import type {} from '../../../desktop/src/audio-types';
export function useAudioOutput() {
  const bridge = window.tablemaxAudio;
  const [canPlay, setCanPlay] = useState(!bridge);
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = bridge.subscribe((value) => {
      if (active) setCanPlay(value);
    });
    // React can mount after pushState before WebView2 commits its current
    // Source. Keep native /game authorization strict and retry that short gap.
    const connect = (attempt = 0) => {
      void bridge.connect().then(
        (value) => {
          if (active) setCanPlay(value);
        },
        () => {
          if (!active) return;
          setCanPlay(false);
          if (attempt < 5)
            retry = setTimeout(() => connect(attempt + 1), 40 * 2 ** attempt);
        },
      );
    };
    connect();
    return () => {
      active = false;
      clearTimeout(retry);
      unsubscribe();
      void bridge.disconnect().catch(() => undefined);
    };
  }, [bridge]);
  return canPlay;
}
