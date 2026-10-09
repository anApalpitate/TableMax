import { useEffect, useRef, useState } from 'react';
import { claimAudioEvent, type GameHost } from '@tablemax/web-host';
import type { RummikubView } from '../types';
import place from '../../../assets/games/rummikub/audio/place-v1.wav';
import draw from '../../../assets/games/rummikub/audio/draw-v1.wav';
import win from '../../../assets/games/rummikub/audio/win-v1.wav';

const muteKey = 'tablemax-sound-muted';
type RoomFeedback = NonNullable<GameHost['feedback']>;
const preferenceEvent = 'rummikub-sound-preference';
function preference() {
  try {
    return localStorage.getItem(muteKey) !== 'true';
  } catch {
    return true;
  }
}
const keyFor = (feedback: RoomFeedback | null) =>
  feedback
    ? `rummikub:${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';

export function RummikubSoundControl({
  feedback,
  game,
  disabled,
  canPlay,
  player = false,
}: {
  feedback: RoomFeedback | null;
  game: RummikubView | null;
  disabled: boolean;
  canPlay: boolean;
  player?: boolean;
}) {
  const [enabled, setEnabled] = useState(preference);
  const [blocked, setBlocked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const seen = useRef(new Set([keyFor(feedback)]));
  const generation = useRef(0);
  useEffect(() => {
    const media = new Audio();
    media.preload = 'none';
    audio.current = media;
    return () => {
      // Invalidate native claims and browser playback promises on unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      media.pause();
      media.removeAttribute('src');
      media.load();
      audio.current = null;
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
    if (disabled || !canPlay || !enabled) {
      generation.current++;
      audio.current?.pause();
    }
  }, [disabled, canPlay, enabled]);
  useEffect(() => {
    const key = keyFor(feedback);
    if (!key || seen.current.has(key)) return;
    seen.current.add(key);
    if (seen.current.size > 32)
      seen.current.delete(seen.current.values().next().value!);
    if (
      !feedback ||
      !game?.latest ||
      disabled ||
      !canPlay ||
      !enabled ||
      document.hidden ||
      (player && (!unlocked || game.latest.actor !== game.self?.seatId))
    )
      return;
    const source =
      game.latest.verb === 'game-ended'
        ? win
        : game.latest.verb === 'submit-turn'
          ? place
          : game.latest.verb === 'draw'
            ? draw
            : null;
    if (!source) return;
    const permit = ++generation.current;
    void Promise.resolve(player ? true : claimAudioEvent(key))
      .then((accepted) => {
        const media = audio.current;
        if (!accepted || permit !== generation.current || !media) return;
        media.pause();
        media.src = source;
        media.volume = 0.42;
        media.muted = false;
        void media.play().then(
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
    const media = audio.current;
    if (!media) return;
    const permit = ++generation.current;
    media.pause();
    media.src = place;
    media.muted = true;
    void media.play().then(
      () => {
        if (generation.current !== permit || audio.current !== media) return;
        media.pause();
        media.currentTime = 0;
        media.muted = false;
        setBlocked(false);
        setUnlocked(true);
      },
      () => {
        if (generation.current === permit) {
          media.muted = false;
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
      className="rk-icon-button rk-sound-control"
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
          /* Per-window preference still works without storage. */
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
