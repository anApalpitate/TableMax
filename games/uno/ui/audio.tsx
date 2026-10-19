import { useEffect, useRef, useState } from 'react';
import {
  claimAudioEvent,
  subscribeSoundPreference,
  useSoundPreference,
  useSoundActivation,
  type GameHost,
} from '@tablemax/web-host';
import type { UnoView } from '../types';
import { unoSavedCue, type UnoCue } from './saved-feedback';
import place from '../../../assets/games/uno/audio/place-v2.flac';
import draw from '../../../assets/games/uno/audio/draw-v2.flac';
import reverse from '../../../assets/games/uno/audio/reverse-v2.flac';
import skip from '../../../assets/games/uno/audio/skip-v2.flac';
import drawTwo from '../../../assets/games/uno/audio/draw-two-v2.flac';
import drawFour from '../../../assets/games/uno/audio/draw-four-v2.flac';
import wild from '../../../assets/games/uno/audio/wild-v2.flac';
import uno from '../../../assets/games/uno/audio/uno-v2.flac';
import catchUno from '../../../assets/games/uno/audio/catch-uno-v2.flac';
import acceptFour from '../../../assets/games/uno/audio/accept-four-v2.flac';
import challengeSuccess from '../../../assets/games/uno/audio/challenge-success-v2.flac';
import challengeFailure from '../../../assets/games/uno/audio/challenge-failure-v2.flac';
import challenge from '../../../assets/games/uno/audio/challenge-v1.flac';
import win from '../../../assets/games/uno/audio/win-v2.flac';

type Feedback = NonNullable<GameHost['feedback']>;
const feedbackKey = (feedback: Feedback | null) =>
  feedback
    ? `uno:${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';
const sources: Record<UnoCue, string> = {
  place,
  draw,
  reverse,
  skip,
  'draw-two': drawTwo,
  'draw-four': drawFour,
  wild,
  uno,
  'catch-uno': catchUno,
  'accept-four': acceptFour,
  challenge,
  'challenge-success': challengeSuccess,
  'challenge-failure': challengeFailure,
  win,
};

export function UnoSoundControl({
  feedback,
  game,
  disabled,
  canPlay,
  player,
}: {
  feedback: Feedback | null;
  game: UnoView | null;
  disabled: boolean;
  canPlay: boolean;
  player: boolean;
}) {
  const [enabled, setEnabled] = useSoundPreference();
  const [blocked, setBlocked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const media = useRef<HTMLAudioElement | null>(null);
  const seen = useRef(new Set([feedbackKey(feedback)]));
  const generation = useRef(0);
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    media.current = audio;
    const unsubscribeSound = subscribeSoundPreference((audible) => {
      if (!audible) {
        generation.current++;
        audio.pause();
      }
    });
    const hide = () => {
      if (document.hidden) {
        generation.current++;
        audio.pause();
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      // Invalidate native claims and pending playback before releasing the source.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      unsubscribeSound();
      document.removeEventListener('visibilitychange', hide);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      media.current = null;
    };
  }, []);
  useEffect(() => {
    generation.current++;
    media.current?.pause();
  }, [feedback?.instanceId, feedback?.branch, disabled, canPlay]);
  useEffect(() => {
    const key = feedbackKey(feedback);
    if (!key || seen.current.has(key)) return;
    seen.current.add(key);
    if (seen.current.size > 40)
      seen.current.delete(seen.current.values().next().value!);
    if (
      !game?.latest ||
      disabled ||
      !canPlay ||
      !enabled ||
      document.hidden ||
      (player && (!unlocked || game.latest.actor !== game.self?.seatId))
    )
      return;
    const cue = unoSavedCue(game.latest, game.phase);
    if (!cue) return;
    const source = sources[cue];
    const permit = ++generation.current;
    void Promise.resolve(player ? true : claimAudioEvent(key))
      .then((accepted) => {
        const audio = media.current;
        if (
          !accepted ||
          permit !== generation.current ||
          !audio ||
          document.hidden
        )
          return;
        audio.pause();
        audio.src = source;
        audio.volume = 0.58;
        audio.muted = false;
        void audio.play().then(
          () => {
            if (permit === generation.current) setBlocked(false);
          },
          () => {
            if (permit === generation.current) setBlocked(true);
          },
        );
      })
      .catch(() => undefined);
  }, [feedback, game, disabled, canPlay, enabled, player, unlocked]);
  const unlock = () => {
    const audio = media.current;
    if (!audio) return;
    const permit = ++generation.current;
    audio.pause();
    audio.src = place;
    audio.muted = true;
    void audio.play().then(
      () => {
        if (generation.current !== permit || media.current !== audio) return;
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        setBlocked(false);
        setUnlocked(true);
      },
      () => {
        if (generation.current === permit) {
          audio.muted = false;
          setBlocked(true);
        }
      },
    );
  };
  useSoundActivation(() => {
    if (!disabled && canPlay) unlock();
  });
  const audible = enabled && !disabled && !blocked && (!player || unlocked);
  const label = disabled
    ? '测试或暂停中，提示音关闭'
    : blocked || (player && enabled && !unlocked)
      ? '点击启用提示音'
      : enabled
        ? '提示音已开启，点击静音'
        : '提示音已静音，点击开启';
  return (
    <button
      type="button"
      className="uno-icon-button"
      aria-label={label}
      title={label}
      aria-pressed={audible}
      disabled={disabled}
      onClick={() => {
        if (enabled && (blocked || (player && !unlocked))) {
          unlock();
          return;
        }
        const next = !enabled;
        setEnabled(next);
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 9v6h4l5 4V5L8 9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {audible ? (
          <path
            d="M16 8q4 4 0 8m3-11q7 7 0 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="m17 9 5 6m0-6-5 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
