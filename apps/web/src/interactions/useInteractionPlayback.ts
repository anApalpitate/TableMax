import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import type { InteractionEvent } from '@tablemax/protocol';
import {
  InteractionPlaybackController,
  type InteractionPlaybackAudio,
  type LiveInteractionShot,
} from './playback-controller';

interface InteractionFeed {
  subscribeInteractions(
    listener: (event: InteractionEvent, receivedAt: number) => void,
  ): () => void;
  subscribeInteractionResets?(listener: () => void): () => void;
  interactionResetKey: unknown;
}
/** Session gates delivery; render-late connected/resetKey values never retire new work. */
export function useInteractionPlayback(
  session: InteractionFeed,
  blocked: boolean,
  audio: InteractionPlaybackAudio,
) {
  const {
    subscribeInteractions,
    subscribeInteractionResets,
    interactionResetKey,
  } = session;
  const [shots, setShots] = useState<LiveInteractionShot[]>([]);
  const [controller] = useState(
    () =>
      new InteractionPlaybackController({
        audio,
        now: () => performance.now(),
        visible: () => document.visibilityState !== 'hidden',
        publish: setShots,
      }),
  );
  const clear = useCallback(() => controller.clear(), [controller]);
  useLayoutEffect(() => {
    // Stop immediately on the blocking preference commit; defer only painting.
    controller.setBlocked(blocked, false);
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) controller.publish();
    });
    return () => {
      mounted = false;
    };
  }, [controller, blocked]);
  useEffect(
    () =>
      subscribeInteractions((event, receivedAt) =>
        controller.receive(event, receivedAt),
      ),
    [subscribeInteractions, controller],
  );
  useEffect(
    () => subscribeInteractionResets?.(() => controller.clear()),
    [subscribeInteractionResets, controller],
  );
  useLayoutEffect(() => {
    // Older fixtures without the synchronous reset feed retain the legacy fallback.
    if (subscribeInteractionResets) return;
    controller.clear(false);
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) controller.publish();
    });
    return () => {
      mounted = false;
    };
  }, [subscribeInteractionResets, interactionResetKey, controller]);
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') controller.clear();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
    };
  }, [controller]);
  useEffect(() => () => controller.clear(false), [controller]);
  return { shots, clear };
}
