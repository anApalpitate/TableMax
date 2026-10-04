import { useEffect, useRef, useState } from 'react';
import type { RoomFeedback } from '../../../packages/protocol/src';
import type { PowerGridView } from '../types';
import bid from '../../../assets/games/power-grid/audio/bid-v1.wav';
import fuel from '../../../assets/games/power-grid/audio/fuel-v1.wav';
import build from '../../../assets/games/power-grid/audio/build-v1.wav';
import plant from '../../../assets/games/power-grid/audio/plant-v1.wav';
import run from '../../../assets/games/power-grid/audio/run-v1.wav';
import end from '../../../assets/games/power-grid/audio/end-v1.wav';

const sources = { bid, fuel, build, plant, run, end };
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
    ? `power-grid:${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';
}

export function PowerGridSoundControl({
  feedback,
  game,
  disabled,
  canPlay,
}: {
  feedback: RoomFeedback | null;
  game: PowerGridView | null;
  disabled: boolean;
  canPlay: boolean;
}) {
  const [enabled, setEnabled] = useState(preference);
  const [blocked, setBlocked] = useState(false);
  const last = useRef(feedbackKey(feedback));
  const playback = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    playback.current = audio;
    const storage = (event: StorageEvent) => {
      if (event.key === muteKey) setEnabled(preference());
    };
    window.addEventListener('storage', storage);
    return () => {
      // The generation is deliberately an invalidation counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      playback.current = null;
      window.removeEventListener('storage', storage);
    };
  }, []);
  useEffect(() => {
    if (disabled || !enabled || !canPlay || !feedback) {
      generation.current++;
      playback.current?.pause();
    }
  }, [disabled, enabled, canPlay, feedback]);
  useEffect(() => {
    const key = feedbackKey(feedback);
    if (!key || key === last.current) return;
    last.current = key;
    if (disabled || !enabled || !canPlay || !game?.latest || !feedback) return;
    const verb = game.latest.verb;
    const cue: keyof typeof sources | null =
      game.phase === 'ended'
        ? 'end'
        : ['offer', 'bid'].includes(verb)
          ? 'bid'
          : ['buy-resource', 'transfer', 'salvage', 'discard-salvage'].includes(
                verb,
              )
            ? 'fuel'
            : verb === 'build'
              ? 'build'
              : ['purchase-plant', 'discard-plant'].includes(verb)
                ? 'plant'
                : ['run', 'supply', 'round', 'step'].includes(verb)
                  ? 'run'
                  : null;
    if (!cue) return;
    const current = generation.current,
      audio = playback.current;
    void Promise.resolve(window.tablemaxAudio?.claimEvent(key) ?? true)
      .then((accepted) => {
        if (
          !accepted ||
          current !== generation.current ||
          audio !== playback.current ||
          !audio
        )
          return;
        audio.pause();
        audio.src = sources[cue];
        audio.currentTime = 0;
        audio.volume = 0.42;
        void audio.play().then(
          () => setBlocked(false),
          () => setBlocked(true),
        );
      })
      .catch(() => undefined);
  }, [feedback, game, disabled, enabled, canPlay]);
  return (
    <button
      type="button"
      data-power-grid-sound="true"
      aria-pressed={enabled}
      title={blocked ? '点击声音按钮启用播放' : '已保存动作的工业提示音'}
      onClick={() => {
        const value = blocked || !enabled;
        if (value && playback.current) {
          const audio = playback.current;
          generation.current++;
          audio.src = bid;
          audio.volume = 0;
          void audio.play().then(
            () => {
              audio.pause();
              audio.currentTime = 0;
            },
            () => setBlocked(true),
          );
        }
        setEnabled(value);
        setBlocked(false);
        try {
          localStorage.setItem(muteKey, String(!value));
        } catch {
          /* Storage denial does not affect game decisions. */
        }
      }}
    >
      {enabled ? '声音开' : '静音'}
    </button>
  );
}
