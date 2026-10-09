import { useEffect, useRef, useState } from 'react';
import { claimAudioEvent, type GameHost } from '@tablemax/web-host';
import type { LatestAction, UnoView } from '../types';
import place from '../../../assets/games/uno/audio/place-v1.flac';
import draw from '../../../assets/games/uno/audio/draw-v1.flac';
import reverse from '../../../assets/games/uno/audio/reverse-v1.flac';
import skip from '../../../assets/games/uno/audio/skip-v1.flac';
import drawTwo from '../../../assets/games/uno/audio/draw-two-v1.flac';
import drawFour from '../../../assets/games/uno/audio/draw-four-v1.flac';
import wild from '../../../assets/games/uno/audio/wild-v1.flac';
import uno from '../../../assets/games/uno/audio/uno-v1.flac';
import challenge from '../../../assets/games/uno/audio/challenge-v1.flac';
import win from '../../../assets/games/uno/audio/win-v1.flac';

const muteKey = 'tablemax-sound-muted';
const preferenceEvent = 'uno-sound-preference';
type Feedback = NonNullable<GameHost['feedback']>;
const feedbackKey = (feedback: Feedback | null) =>
  feedback
    ? `uno:${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';
const preference = () => {
  try {
    return localStorage.getItem(muteKey) !== 'true';
  } catch {
    return true;
  }
};
function sourceFor(latest: LatestAction, phase: UnoView['phase']) {
  if (phase !== 'playing') return win;
  if (/ended|result|round-won/.test(latest.verb)) return win;
  if (/challenge|catch/.test(latest.verb)) return challenge;
  if (latest.verb === 'choose-color') return wild;
  if (
    /declare/.test(latest.verb) ||
    (latest.verb === 'play' && /UNO/.test(latest.text))
  )
    return uno;
  if (/draw|accept/.test(latest.verb) && latest.verb !== 'play') return draw;
  if (latest.card?.kind === 'reverse') return reverse;
  if (latest.card?.kind === 'skip') return skip;
  if (latest.card?.kind === 'draw-two') return drawTwo;
  if (latest.card?.kind === 'wild-draw-four') return drawFour;
  if (latest.card?.kind === 'wild') return wild;
  return latest.verb === 'play' ? place : null;
}

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
  const [enabled, setEnabled] = useState(preference);
  const [blocked, setBlocked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const media = useRef<HTMLAudioElement | null>(null);
  const seen = useRef(new Set([feedbackKey(feedback)]));
  const generation = useRef(0);
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    media.current = audio;
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
      document.removeEventListener('visibilitychange', hide);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      media.current = null;
    };
  }, []);
  useEffect(() => {
    const changed = () => setEnabled(preference());
    window.addEventListener('storage', changed);
    window.addEventListener(preferenceEvent, changed);
    return () => {
      window.removeEventListener('storage', changed);
      window.removeEventListener(preferenceEvent, changed);
    };
  }, []);
  useEffect(() => {
    generation.current++;
    media.current?.pause();
  }, [feedback?.instanceId, feedback?.branch, disabled, canPlay, enabled]);
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
    const source = sourceFor(game.latest, game.phase);
    if (!source) return;
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
        try {
          localStorage.setItem(muteKey, String(!next));
          window.dispatchEvent(new Event(preferenceEvent));
        } catch {
          /* Keep a per-window preference when storage is unavailable. */
        }
        if (next) unlock();
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
