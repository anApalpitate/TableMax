import { useEffect, useRef, useState } from 'react';
import type { RoomFeedback } from '../../../packages/protocol/src';
import draw from '../../../assets/games/pokemon-encounters/audio/draw-v1.wav';
import replace from '../../../assets/games/pokemon-encounters/audio/replace-v1.wav';
import effect from '../../../assets/games/pokemon-encounters/audio/effect-complete-v1.wav';
import result from '../../../assets/games/pokemon-encounters/audio/round-result-v1.wav';
import error from '../../../assets/games/pokemon-encounters/audio/error-v1.wav';
const sources = {
  draw,
  replace,
  'effect-complete': effect,
  'round-result': result,
  error,
};
export function SoundControl({
  feedback,
  errorId,
  compact = false,
}: {
  feedback: RoomFeedback | null;
  errorId: string;
  compact?: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const last = useRef('');
  const lastError = useRef('');
  const player = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!feedback) {
      player.current?.pause();
      return;
    }
    const id = `${feedback.instanceId}:${feedback.branch}:${feedback.revision}`;
    if (last.current === id) return;
    last.current = id;
    if (!enabled) return;
    const event = feedback.events.at(-1);
    if (!event) return;
    if (player.current) player.current.pause();
    const audio = new Audio(sources[event.kind]);
    audio.volume = 0.45;
    player.current = audio;
    void audio.play().catch(() => undefined);
  }, [feedback, enabled]);
  useEffect(() => {
    if (lastError.current === errorId) return;
    lastError.current = errorId;
    if (!errorId || !enabled) return;
    player.current?.pause();
    const audio = new Audio(error);
    audio.volume = 0.35;
    player.current = audio;
    void audio.play().catch(() => undefined);
  }, [errorId, enabled]);
  useEffect(() => () => player.current?.pause(), []);
  return (
    <button
      className="secondary sound-control"
      aria-pressed={enabled}
      aria-label={enabled ? '提示音已开启 · 静音' : '开启本屏提示音'}
      onClick={() => {
        if (enabled) {
          player.current?.pause();
          setEnabled(false);
        } else {
          // User gesture unlocks playback. Only future saved events play afterwards.
          const audio = new Audio(draw);
          audio.volume = 0.2;
          player.current = audio;
          void audio
            .play()
            .then(() => setEnabled(true))
            .catch(() => setEnabled(false));
        }
      }}
    >
      {compact
        ? enabled
          ? '声音：开'
          : '声音：关'
        : enabled
          ? '提示音已开启 · 静音'
          : '开启本屏提示音'}
    </button>
  );
}
