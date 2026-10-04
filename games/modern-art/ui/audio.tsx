import { useEffect, useRef, useState } from 'react';
import type { RoomFeedback } from '../../../packages/protocol/src';
import type { ModernArtView } from './view';
import {
  modernArtFeedbackKey,
  modernArtSoundCue,
  ModernArtSavedFeedback,
  type ModernArtSoundCue,
} from './presentation-state';
import { ModernArtSoundPlayer } from './sound-player';
import offer from '../../../assets/games/modern-art/audio/offer-v2.wav';
import open from '../../../assets/games/modern-art/audio/auction-open-v2.wav';
import once from '../../../assets/games/modern-art/audio/auction-once-v2.wav';
import sealed from '../../../assets/games/modern-art/audio/auction-sealed-v2.wav';
import fixed from '../../../assets/games/modern-art/audio/auction-fixed-v2.wav';
import doubleOpen from '../../../assets/games/modern-art/audio/double-open-v2.wav';
import doubleAdd from '../../../assets/games/modern-art/audio/double-add-v2.wav';
import bid from '../../../assets/games/modern-art/audio/bid-v2.wav';
import sealedSubmit from '../../../assets/games/modern-art/audio/sealed-submit-v2.wav';
import priceSet from '../../../assets/games/modern-art/audio/price-set-v2.wav';
import pass from '../../../assets/games/modern-art/audio/pass-v2.wav';
import sale from '../../../assets/games/modern-art/audio/sale-v2.wav';
import roundStart from '../../../assets/games/modern-art/audio/round-start-v2.wav';
import roundResult from '../../../assets/games/modern-art/audio/round-result-v2.wav';
import matchResult from '../../../assets/games/modern-art/audio/match-result-v2.wav';
import error from '../../../assets/games/modern-art/audio/error-v2.wav';
import timeElapsed from '../../../assets/games/modern-art/audio/time-elapsed-v2.wav';
import { ModernArtTimerFeedback } from './timer-feedback';

const sources: Record<ModernArtSoundCue, string> = {
  offer,
  'auction-open': open,
  'auction-once': once,
  'auction-sealed': sealed,
  'auction-fixed': fixed,
  'double-open': doubleOpen,
  'double-add': doubleAdd,
  bid,
  'sealed-submit': sealedSubmit,
  'price-set': priceSet,
  pass,
  sale,
  'round-start': roundStart,
  'round-result': roundResult,
  'match-result': matchResult,
  error,
};
const desktopMuteKey = 'tablemax-sound-muted';
const phoneMuteKey = 'tablemax-modern-art-phone-sound-muted';
let phoneAudio: HTMLAudioElement | null = null;
let phoneUnlocked = false;
let phoneUnlocking = false;
function preference(muteKey: string) {
  try {
    return localStorage.getItem(muteKey) !== 'true';
  } catch {
    return true;
  }
}

export function ModernArtSoundControl({
  feedback,
  game,
  errorId,
  disabled = false,
  canPlay = true,
  localOnly = false,
  timer = null,
}: {
  feedback: RoomFeedback | null;
  game: ModernArtView | null;
  errorId: string;
  disabled?: boolean;
  canPlay?: boolean;
  /** Phone sounds have their own device preference and no desktop claim. */
  localOnly?: boolean;
  timer?: { key: string; remainingMs: number; running: boolean } | null;
}) {
  const muteKey = localOnly ? phoneMuteKey : desktopMuteKey;
  const [enabled, setEnabled] = useState(() => preference(muteKey));
  const [blocked, setBlocked] = useState(localOnly && !phoneUnlocked);
  const saved = useRef(new ModernArtSavedFeedback(feedback));
  const lastError = useRef(errorId);
  const player = useRef<ModernArtSoundPlayer | null>(null);
  const permission = useRef(0);
  const unlockAttempt = useRef(0);
  const reminders = useRef(new ModernArtTimerFeedback());
  useEffect(() => {
    // Reuse the same phone decoder across the box route: some mobile browsers
    // grant gesture playback to the element rather than the whole document.
    const audio = localOnly ? (phoneAudio ??= new Audio()) : new Audio();
    audio.preload = 'none';
    const playback = new ModernArtSoundPlayer(audio, () => {
      if (localOnly) phoneUnlocked = false;
      setBlocked(true);
    });
    player.current = playback;
    const storage = (event: StorageEvent) => {
      if (event.key !== muteKey) return;
      const next = preference(muteKey);
      if (!next) {
        permission.current++;
        playback.stop();
      }
      setEnabled(next);
    };
    window.addEventListener('storage', storage);
    return () => {
      if (localOnly) phoneUnlocking = false;
      playback.dispose();
      player.current = null;
      window.removeEventListener('storage', storage);
    };
  }, [localOnly, muteKey]);
  useEffect(() => {
    if (!enabled || disabled || !canPlay) {
      if (localOnly) phoneUnlocking = false;
      permission.current++;
      player.current?.stop();
    }
  }, [enabled, disabled, canPlay, localOnly]);
  useEffect(() => {
    if (!feedback) {
      permission.current++;
      player.current?.stop();
      return;
    }
    if (
      !saved.current.accept(feedback) ||
      !enabled ||
      disabled ||
      !canPlay ||
      (localOnly && !phoneUnlocked && !phoneUnlocking)
    )
      return;
    const cue = modernArtSoundCue(feedback, game);
    if (!cue) return;
    const permit = permission.current;
    const playback = player.current;
    void Promise.resolve(
      localOnly
        ? true
        : (window.tablemaxAudio?.claimEvent(modernArtFeedbackKey(feedback)) ??
            true),
    )
      .then((accepted) => {
        if (
          accepted &&
          permission.current === permit &&
          player.current === playback
        )
          playback?.enqueue(
            sources[cue],
            cue.startsWith('auction-') || cue === 'double-open',
          );
      })
      .catch(() => undefined);
  }, [feedback, game, enabled, disabled, canPlay, localOnly]);
  useEffect(() => {
    if (lastError.current === errorId) return;
    lastError.current = errorId;
    if (
      !errorId ||
      !enabled ||
      disabled ||
      !canPlay ||
      (localOnly && !phoneUnlocked && !phoneUnlocking)
    )
      return;
    const permit = permission.current;
    const playback = player.current;
    void Promise.resolve(
      localOnly
        ? true
        : (window.tablemaxAudio?.claimEvent(
            `${modernArtFeedbackKey(feedback)}:modern-art-error:${errorId}`,
          ) ?? true),
    )
      .then((accepted) => {
        if (
          accepted &&
          permission.current === permit &&
          player.current === playback
        )
          playback?.enqueue(error);
      })
      .catch(() => undefined);
  }, [errorId, feedback, enabled, disabled, canPlay, localOnly]);
  const timerKey = timer?.key;
  const timerRemaining = timer?.remainingMs;
  const timerRunning = timer?.running;
  useEffect(() => {
    if (!timerKey || timerRemaining === undefined || timerRunning === undefined)
      return;
    // Consume the crossing even when muted, disconnected, or not the sound owner.
    if (
      !reminders.current.accept(timerKey, timerRemaining, timerRunning) ||
      !enabled ||
      disabled ||
      !canPlay ||
      document.hidden ||
      (localOnly && !phoneUnlocked)
    )
      return;
    const permit = permission.current;
    const playback = player.current;
    void Promise.resolve(
      localOnly ? true : (window.tablemaxAudio?.claimEvent(timerKey) ?? true),
    )
      .then((accepted) => {
        if (
          accepted &&
          permission.current === permit &&
          player.current === playback
        )
          playback?.enqueue(timeElapsed);
      })
      .catch(() => undefined);
  }, [
    timerKey,
    timerRemaining,
    timerRunning,
    enabled,
    disabled,
    canPlay,
    localOnly,
  ]);
  const label = disabled
    ? '当前暂不播放提示音'
    : blocked && canPlay && enabled
      ? localOnly
        ? '点击启用手机提示音'
        : '允许播放提示音'
      : enabled
        ? '提示音已开启，点击静音'
        : '提示音已静音，点击开启';
  const unlock = () => {
    const permit = permission.current;
    const playback = player.current;
    if (!playback) return;
    const attempt = ++unlockAttempt.current;
    if (localOnly) phoneUnlocking = true;
    void playback.unlock(offer).then(
      (unlocked) => {
        if (
          unlockAttempt.current === attempt &&
          permission.current === permit &&
          player.current === playback
        ) {
          if (localOnly) {
            phoneUnlocked = unlocked;
            phoneUnlocking = false;
          }
          setBlocked(!unlocked);
        }
      },
      () => {
        if (
          unlockAttempt.current === attempt &&
          permission.current === permit &&
          player.current === playback
        ) {
          if (localOnly) {
            phoneUnlocked = false;
            phoneUnlocking = false;
          }
          setBlocked(true);
        }
      },
    );
  };
  return (
    <button
      className="secondary ma-sound-control"
      data-modern-art-sound="true"
      data-local-sound={localOnly ? 'true' : 'false'}
      disabled={disabled}
      aria-pressed={enabled && !disabled}
      aria-label={label}
      title={
        !canPlay && enabled ? '由电脑指定的公共屏或管理窗口播放提示音' : label
      }
      onClick={() => {
        if (blocked && enabled && canPlay) {
          unlock();
          return;
        }
        const next = !enabled;
        permission.current++;
        if (!next) player.current?.stop();
        setEnabled(next);
        try {
          localStorage.setItem(muteKey, String(!next));
        } catch {
          /* This window's preference remains usable. */
        }
        if (next && canPlay) unlock();
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 9h4l5-4v14l-5-4H4z"
          fill="currentColor"
          stroke="currentColor"
          strokeLinejoin="round"
        />
        {enabled && !disabled ? (
          <path
            d="M16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"
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
      {localOnly && blocked && enabled && !disabled && <span>启用声音</span>}
    </button>
  );
}
