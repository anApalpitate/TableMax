/* eslint-disable react-refresh/only-export-components -- Feedback identity helpers share this game-owned presentation module. */
import { useEffect, useRef } from 'react';
import {
  claimAudioEvent,
  subscribeSoundPreference,
  useAudioOutput,
  useSoundPreference,
  type GameHost,
} from '@tablemax/web-host';
import { asset } from './Theme';
export function feedbackKey(feedback: GameHost['feedback']) {
  return feedback
    ? `${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';
}
export class SavedFeedback {
  private readonly seen = new Set<string>();
  constructor(initial: GameHost['feedback']) {
    if (initial) this.seen.add(feedbackKey(initial));
  }
  accept(feedback: GameHost['feedback']) {
    const key = feedbackKey(feedback);
    if (!key || this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > 64) this.seen.delete(this.seen.values().next().value!);
    return true;
  }
}
export function Effects({ session }: { session: GameHost }) {
  const marker = useRef<HTMLSpanElement>(null);
  const media = useRef<HTMLAudioElement | null>(null);
  const seen = useRef(new SavedFeedback(session.feedback));
  const generation = useRef(0);
  const [enabled] = useSoundPreference();
  const canPlay = useAudioOutput();
  useEffect(() => {
    const audio = new Audio();
    media.current = audio;
    audio.preload = 'none';
    audio.volume = 0.45;
    const stop = () => {
      generation.current++;
      audio.pause();
    };
    const hide = () => {
      if (document.hidden) stop();
    };
    const unsubscribe = subscribeSoundPreference((audible) => {
      if (!audible) stop();
    });
    document.addEventListener('visibilitychange', hide);
    return () => {
      stop();
      unsubscribe();
      document.removeEventListener('visibilitychange', hide);
      audio.removeAttribute('src');
      audio.load();
      media.current = null;
    };
  }, []);
  useEffect(() => {
    const token = ++generation.current;
    const invalidate = () => {
      generation.current++;
    };
    media.current?.pause();
    const { feedback, view, connected, motion } = session;
    const fresh =
      feedback &&
      feedback.instanceId === view?.instanceId &&
      feedback.branch === view.branch &&
      feedback.revision === view.revision;
    if (
      !seen.current.accept(feedback) ||
      !fresh ||
      !connected ||
      view?.paused ||
      view?.botError ||
      view?.playMode === 'test' ||
      document.hidden ||
      !motion.length
    )
      return;
    const end = motion.includes('cockroach-poker:end');
    const reveal = motion.includes('cockroach-poker:reveal');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = marker.current
      ?.closest('.cp-game')
      ?.querySelector(reveal ? '.cp-last' : '.cp-stage');
    const animation =
      !reduced && target instanceof HTMLElement
        ? target.animate(
            [
              {
                transform: end
                  ? 'rotate(-1deg) translateY(8px)'
                  : reveal
                    ? 'rotateY(25deg)'
                    : 'translateX(-8px)',
                opacity: 0.65,
              },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 450, easing: 'ease-out' },
          )
        : null;
    if (enabled && canPlay)
      void Promise.resolve(
        session.role === 'player'
          ? true
          : claimAudioEvent(`cockroach-poker:${feedbackKey(feedback)}`),
      ).then((granted) => {
        if (
          !granted ||
          token !== generation.current ||
          !media.current ||
          document.hidden
        )
          return;
        media.current.src = asset(
          `audio/${end ? 'end' : reveal ? 'reveal' : 'pass'}.wav`,
        );
        void media.current.play().catch(() => {
          /* Browser gesture policy: no queued replay. */
        });
      });
    return () => {
      animation?.cancel();
      invalidate();
      media.current?.pause();
    };
  }, [session, enabled, canPlay]);
  return <span ref={marker} hidden aria-hidden="true" />;
}
