import { useEffect, useRef, useState } from 'react';
import { claimAudioEvent } from '@tablemax/web-host';
import type { AvalonView } from '../types';
import {
  AvalonSavedFeedback,
  avalonCue,
  avalonFeedbackKey,
  type AvalonCue,
  type Feedback,
} from './presentation';
import pledge from '../../../assets/games/avalon/audio/pledge-v1.flac';
import team from '../../../assets/games/avalon/audio/team-v1.flac';
import ballot from '../../../assets/games/avalon/audio/ballot-v1.flac';
import approved from '../../../assets/games/avalon/audio/approved-v1.flac';
import rejected from '../../../assets/games/avalon/audio/rejected-v1.flac';
import success from '../../../assets/games/avalon/audio/quest-success-v1.flac';
import fail from '../../../assets/games/avalon/audio/quest-fail-v1.flac';
import assassination from '../../../assets/games/avalon/audio/assassination-v1.flac';
import goodWin from '../../../assets/games/avalon/audio/good-win-v1.flac';
import evilWin from '../../../assets/games/avalon/audio/evil-win-v1.flac';
import assassinationGood from '../../../assets/games/avalon/audio/assassination-good-v1.flac';
import assassinationEvil from '../../../assets/games/avalon/audio/assassination-evil-v1.flac';

const sources: Record<AvalonCue, string> = {
  pledge,
  team,
  ballot,
  approved,
  rejected,
  'quest-success': success,
  'quest-fail': fail,
  assassination,
  'good-win': goodWin,
  'evil-win': evilWin,
};
const preferenceEvent = 'avalon-sound-preference';
function preference(key: string) {
  try {
    return (
      localStorage.getItem(key) !== 'true' &&
      (localStorage.getItem(key) !== null ||
        localStorage.getItem('tablemax-sound-muted') !== 'true')
    );
  } catch {
    return true;
  }
}

export function AvalonSoundControl({
  feedback,
  game,
  disabled,
  canPlay,
  player,
}: {
  feedback: Feedback | null;
  game: AvalonView | null;
  disabled: boolean;
  canPlay: boolean;
  player: boolean;
}) {
  const muteKey = player
    ? 'tablemax-avalon-player-sound-muted'
    : 'tablemax-sound-muted';
  const [enabled, setEnabled] = useState(() => preference(muteKey));
  const [blocked, setBlocked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const media = useRef<HTMLAudioElement | null>(null);
  const seen = useRef(new AvalonSavedFeedback(feedback));
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
    const changed = () => setEnabled(preference(muteKey));
    window.addEventListener('storage', changed);
    window.addEventListener(preferenceEvent, changed);
    return () => {
      window.removeEventListener('storage', changed);
      window.removeEventListener(preferenceEvent, changed);
    };
  }, [muteKey]);
  useEffect(() => {
    generation.current++;
    media.current?.pause();
  }, [feedback?.instanceId, feedback?.branch, disabled, canPlay, enabled]);
  useEffect(() => {
    if (!seen.current.accept(feedback)) return;
    if (
      !feedback ||
      !game ||
      disabled ||
      !enabled ||
      !canPlay ||
      document.hidden ||
      (player && !unlocked)
    )
      return;
    const cue = avalonCue(feedback, game);
    if (
      !cue ||
      (player &&
        (cue === 'ballot' || cue === 'pledge') &&
        game.latest?.actor !== game.self?.seatId)
    )
      return;
    const source =
      cue === 'assassination'
        ? game.winner === 'good'
          ? assassinationGood
          : assassinationEvil
        : sources[cue];
    const permit = ++generation.current;
    void Promise.resolve(
      player ? true : claimAudioEvent(avalonFeedbackKey(feedback)),
    )
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
        audio.volume = 0.56;
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
  }, [feedback, game, disabled, enabled, canPlay, player, unlocked]);
  const unlock = () => {
    const audio = media.current;
    if (!audio) return;
    const permit = ++generation.current;
    audio.pause();
    audio.src = pledge;
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
      className="av-sound-control"
      data-avalon-sound
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
          /* Per-window preference remains useful. */
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
