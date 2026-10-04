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
import offer from '../../../assets/games/modern-art/audio/offer-v1.wav';
import open from '../../../assets/games/modern-art/audio/auction-open-v1.wav';
import once from '../../../assets/games/modern-art/audio/auction-once-v1.wav';
import sealed from '../../../assets/games/modern-art/audio/auction-sealed-v1.wav';
import fixed from '../../../assets/games/modern-art/audio/auction-fixed-v1.wav';
import doubleOpen from '../../../assets/games/modern-art/audio/double-open-v1.wav';
import doubleAdd from '../../../assets/games/modern-art/audio/double-add-v1.wav';
import bid from '../../../assets/games/modern-art/audio/bid-v1.wav';
import sealedSubmit from '../../../assets/games/modern-art/audio/sealed-submit-v1.wav';
import priceSet from '../../../assets/games/modern-art/audio/price-set-v1.wav';
import pass from '../../../assets/games/modern-art/audio/pass-v1.wav';
import sale from '../../../assets/games/modern-art/audio/sale-v1.wav';
import roundStart from '../../../assets/games/modern-art/audio/round-start-v1.wav';
import roundResult from '../../../assets/games/modern-art/audio/round-result-v1.wav';
import matchResult from '../../../assets/games/modern-art/audio/match-result-v1.wav';
import error from '../../../assets/games/modern-art/audio/error-v1.wav';

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
const muteKey = 'tablemax-sound-muted';
function preference() {
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
}: {
  feedback: RoomFeedback | null;
  game: ModernArtView | null;
  errorId: string;
  disabled?: boolean;
  canPlay?: boolean;
}) {
  const [enabled, setEnabled] = useState(preference);
  const [blocked, setBlocked] = useState(false);
  const saved = useRef(new ModernArtSavedFeedback(feedback));
  const lastError = useRef(errorId);
  const player = useRef<ModernArtSoundPlayer | null>(null);
  const permission = useRef(0);
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    const playback = new ModernArtSoundPlayer(audio, () => setBlocked(true));
    player.current = playback;
    const storage = (event: StorageEvent) => {
      if (event.key !== muteKey) return;
      const next = preference();
      if (!next) {
        permission.current++;
        playback.stop();
      }
      setEnabled(next);
    };
    window.addEventListener('storage', storage);
    return () => {
      playback.dispose();
      player.current = null;
      window.removeEventListener('storage', storage);
    };
  }, []);
  useEffect(() => {
    if (!enabled || disabled || !canPlay) {
      permission.current++;
      player.current?.stop();
    }
  }, [enabled, disabled, canPlay]);
  useEffect(() => {
    if (!feedback) {
      permission.current++;
      player.current?.stop();
      return;
    }
    if (!saved.current.accept(feedback) || !enabled || disabled || !canPlay)
      return;
    const cue = modernArtSoundCue(feedback, game);
    if (!cue) return;
    const permit = permission.current;
    const playback = player.current;
    void Promise.resolve(
      window.tablemaxAudio?.claimEvent(modernArtFeedbackKey(feedback)) ?? true,
    )
      .then((accepted) => {
        if (
          accepted &&
          permission.current === permit &&
          player.current === playback
        )
          playback?.enqueue(sources[cue]);
      })
      .catch(() => undefined);
  }, [feedback, game, enabled, disabled, canPlay]);
  useEffect(() => {
    if (lastError.current === errorId) return;
    lastError.current = errorId;
    if (!errorId || !enabled || disabled || !canPlay) return;
    const permit = permission.current;
    const playback = player.current;
    void Promise.resolve(
      window.tablemaxAudio?.claimEvent(
        `${modernArtFeedbackKey(feedback)}:modern-art-error:${errorId}`,
      ) ?? true,
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
  }, [errorId, feedback, enabled, disabled, canPlay]);
  const label = disabled
    ? '当前暂不播放提示音'
    : blocked && canPlay && enabled
      ? '允许播放提示音'
      : enabled
        ? '提示音已开启，点击静音'
        : '提示音已静音，点击开启';
  const unlock = () => {
    const permit = permission.current;
    const playback = player.current;
    void playback?.unlock(offer).then(
      (unlocked) => {
        if (
          unlocked &&
          permission.current === permit &&
          player.current === playback
        )
          setBlocked(false);
      },
      () => {
        if (permission.current === permit && player.current === playback)
          setBlocked(true);
      },
    );
  };
  return (
    <button
      className="secondary ma-sound-control"
      data-modern-art-sound="true"
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
    </button>
  );
}
