import { useEffect, useRef, useState } from 'react';
import type { RoomFeedback } from '../../../packages/protocol/src';
import type { PokemonView } from '../rules/project';
import { soundCues, type SoundCue } from './presentation-state';
import { SavedSoundPlayer } from './sound-player';
import draw from '../../../assets/games/pokemon-encounters/audio/draw-v1.wav';
import replace from '../../../assets/games/pokemon-encounters/audio/replace-v1.wav';
import effect from '../../../assets/games/pokemon-encounters/audio/effect-complete-v1.wav';
import result from '../../../assets/games/pokemon-encounters/audio/round-result-v1.wav';
import victory from '../../../assets/games/pokemon-encounters/audio/match-result-v1.wav';
import error from '../../../assets/games/pokemon-encounters/audio/error-v1.wav';
import mew from '../../../assets/games/pokemon-encounters/audio/mew-v1.wav';
import zapdos from '../../../assets/games/pokemon-encounters/audio/zapdos-v1.wav';
import snorlax from '../../../assets/games/pokemon-encounters/audio/snorlax-v1.wav';
import charizard from '../../../assets/games/pokemon-encounters/audio/charizard-v1.wav';
import rocket from '../../../assets/games/pokemon-encounters/audio/rocket-v1.wav';
import rocketReturn from '../../../assets/games/pokemon-encounters/audio/rocket-return-v1.wav';
import meowth from '../../../assets/games/pokemon-encounters/audio/meowth-game-v1.mp3';
import pikachu from '../../../assets/games/pokemon-encounters/audio/pikachu-starter-game-v1.mp3';

const sources: Record<SoundCue, string> = {
  draw,
  replace,
  'effect-complete': effect,
  'round-result': result,
  'match-result': victory,
  error,
  mew,
  zapdos,
  snorlax,
  charizard,
  rocket,
  'rocket-return': rocketReturn,
  meowth,
  pikachu,
};
const muteKey = 'tablemax-sound-muted';
function preference() {
  try {
    return localStorage.getItem(muteKey) !== 'true';
  } catch {
    return true;
  }
}
function feedbackKey(feedback: RoomFeedback | null) {
  return feedback
    ? `${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';
}

export function SoundControl({
  feedback,
  game = null,
  errorId,
  compact = false,
  disabled = false,
  canPlay = true,
}: {
  feedback: RoomFeedback | null;
  game?: PokemonView | null;
  errorId: string;
  compact?: boolean;
  disabled?: boolean;
  canPlay?: boolean;
}) {
  const [enabled, setEnabled] = useState(preference);
  const [blocked, setBlocked] = useState(false);
  // Mounting a screen never replays feedback that arrived before its subscription.
  const last = useRef(feedbackKey(feedback));
  const lastError = useRef(errorId);
  const player = useRef<SavedSoundPlayer | null>(null);
  const permission = useRef(0);
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    const playback = new SavedSoundPlayer(audio, () => setBlocked(true));
    player.current = playback;
    const storage = (event: StorageEvent) => {
      if (event.key !== muteKey) return;
      const next = preference();
      if (!next) playback.stop();
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
    permission.current++;
    if (!enabled || disabled || !canPlay) player.current?.stop();
  }, [enabled, disabled, canPlay]);
  useEffect(() => {
    const id = feedbackKey(feedback);
    if (!feedback) {
      last.current = '';
      permission.current++;
      player.current?.stop();
      return;
    }
    if (last.current === id) return;
    last.current = id;
    if (!enabled || disabled || !canPlay) return;
    const event = feedback.events.at(-1);
    if (!event) return;
    const permit = permission.current,
      playback = player.current;
    void Promise.resolve(window.tablemaxAudio?.claimEvent(id) ?? true)
      .then((accepted) => {
        if (
          accepted &&
          permission.current === permit &&
          player.current === playback
        )
          playback?.enqueue(
            soundCues(event.kind, event.action, game).map(
              (cue) => sources[cue],
            ),
          );
      })
      .catch(() => undefined);
  }, [feedback, game, enabled, disabled, canPlay]);
  useEffect(() => {
    if (lastError.current === errorId) return;
    lastError.current = errorId;
    if (!errorId || !enabled || disabled || !canPlay) return;
    const permit = permission.current,
      playback = player.current;
    void Promise.resolve(
      window.tablemaxAudio?.claimEvent(`${last.current}:error:${errorId}`) ??
        true,
    )
      .then((accepted) => {
        if (
          accepted &&
          permission.current === permit &&
          player.current === playback
        )
          playback?.enqueue([error]);
      })
      .catch(() => undefined);
  }, [errorId, enabled, disabled, canPlay]);
  return (
    <button
      className="secondary sound-control"
      disabled={disabled}
      aria-pressed={enabled && !disabled}
      aria-label={
        disabled
          ? '测试模式已关闭提示音'
          : blocked && canPlay && enabled
            ? '声音待启用，点击允许播放'
            : enabled
              ? '提示音已开启 · 静音'
              : '提示音已静音 · 开启'
      }
      title={
        !canPlay && enabled ? '由电脑指定的公共屏或管理窗口播放' : undefined
      }
      onClick={() => {
        if (blocked && enabled && canPlay) {
          void player.current
            ?.unlock(draw)
            .then(() => setBlocked(false))
            .catch(() => setBlocked(true));
          return;
        }
        const next = !enabled;
        if (!next) player.current?.stop();
        setEnabled(next);
        try {
          localStorage.setItem(muteKey, String(!next));
        } catch {
          /* Session preference remains usable. */
        }
        if (next && canPlay)
          void player.current
            ?.unlock(draw)
            .then(() => setBlocked(false))
            .catch(() => setBlocked(true));
      }}
    >
      {disabled
        ? '声音：关'
        : blocked && enabled && canPlay
          ? '点击启用声音'
          : compact
            ? enabled
              ? '声音：开'
              : '声音：关'
            : enabled
              ? '提示音已开启 · 静音'
              : '开启提示音'}
    </button>
  );
}
