import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { RoomFeedback } from '../../../packages/protocol/src';
import type { PowerGridView } from '../types';
import bid from '../../../assets/games/power-grid/audio/bid-v2.wav';
import fuel from '../../../assets/games/power-grid/audio/fuel-v2.wav';
import build from '../../../assets/games/power-grid/audio/build-v2.wav';
import plant from '../../../assets/games/power-grid/audio/plant-v2.wav';
import run from '../../../assets/games/power-grid/audio/run-v2.wav';
import end from '../../../assets/games/power-grid/audio/end-v2.wav';
import './audio-effects.css';

const sources = { bid, fuel, build, plant, run, end };
type Cue = keyof typeof sources;
const muteKey = 'tablemax-sound-muted';
const preferenceEvent = 'power-grid-sound-preference';
function preference() {
  try {
    return localStorage.getItem(muteKey) !== 'true';
  } catch {
    return true;
  }
}
function usePreference() {
  const [enabled, setEnabled] = useState(preference);
  useEffect(() => {
    const changed = (event: Event) =>
      setEnabled(
        event instanceof CustomEvent && typeof event.detail === 'boolean'
          ? event.detail
          : preference(),
      );
    const storage = (event: StorageEvent) => {
      if (event.key === muteKey) setEnabled(preference());
    };
    window.addEventListener('storage', storage);
    window.addEventListener(preferenceEvent, changed);
    return () => {
      window.removeEventListener('storage', storage);
      window.removeEventListener(preferenceEvent, changed);
    };
  }, []);
  return [enabled, setEnabled] as const;
}
function feedbackKey(feedback: RoomFeedback | null) {
  return feedback
    ? `power-grid:${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';
}
function accept(seen: Set<string>, feedback: RoomFeedback | null) {
  const key = feedbackKey(feedback);
  if (!key || seen.has(key)) return '';
  seen.add(key);
  if (seen.size > 24) seen.delete(seen.values().next().value!);
  return key;
}
function cueFor(
  feedback: RoomFeedback,
  game: PowerGridView | null,
): Cue | null {
  if (!game) return null;
  const verbs = feedback.events
    .map((event) => event.action?.verb)
    .filter(Boolean);
  if (
    feedback.events.some((event) => event.kind === 'game-ended') ||
    verbs.includes('end')
  )
    return 'end';
  if (
    verbs.some((verb) => verb === 'purchase-plant' || verb === 'discard-plant')
  )
    return 'plant';
  if (verbs.includes('build')) return 'build';
  if (
    verbs.some((verb) =>
      [
        'buy-resource',
        'transfer',
        'swap-resources',
        'salvage',
        'discard-salvage',
      ].includes(verb!),
    )
  )
    return 'fuel';
  if (verbs.some((verb) => ['run', 'supply', 'round', 'step'].includes(verb!)))
    return 'run';
  if (verbs.some((verb) => verb === 'offer' || verb === 'bid')) return 'bid';
  return null;
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
  const [enabled, setEnabled] = usePreference();
  const [blocked, setBlocked] = useState(false);
  const seen = useRef(new Set([feedbackKey(feedback)]));
  const playback = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  const claimSequence = useRef(0);
  const unlocking = useRef(false);
  const queued = useRef<Cue | null>(null);
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    playback.current = audio;
    return () => {
      // These counters invalidate pending native claims and media promises.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      claimSequence.current++;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      playback.current = null;
    };
  }, []);
  useEffect(() => {
    if (disabled || !enabled || !canPlay || !feedback) {
      generation.current++;
      claimSequence.current++;
      unlocking.current = false;
      queued.current = null;
      playback.current?.pause();
    }
  }, [disabled, enabled, canPlay, feedback]);
  useEffect(() => {
    const key = accept(seen.current, feedback);
    if (!key || disabled || !enabled || !canPlay || !feedback) return;
    const cue = cueFor(feedback, game);
    if (!cue) return;
    const sequence = ++claimSequence.current;
    if (!unlocking.current) {
      generation.current++;
      playback.current?.pause();
    }
    const current = generation.current,
      audio = playback.current;
    void Promise.resolve(window.tablemaxAudio?.claimEvent(key) ?? true)
      .then((accepted) => {
        if (
          !accepted ||
          current !== generation.current ||
          sequence !== claimSequence.current ||
          audio !== playback.current ||
          !audio
        )
          return;
        if (unlocking.current) {
          queued.current = cue;
          return;
        }
        audio.pause();
        audio.src = sources[cue];
        audio.currentTime = 0;
        audio.volume = 0.42;
        void audio.play().then(
          () => {
            if (current === generation.current) setBlocked(false);
          },
          () => {
            if (current === generation.current) setBlocked(true);
          },
        );
      })
      .catch(() => undefined);
  }, [feedback, game, disabled, enabled, canPlay]);
  return (
    <button
      type="button"
      data-power-grid-sound="true"
      aria-pressed={enabled}
      title={
        blocked ? '点击启用声音；旧动作不会补播' : '已保存动作的电网主题提示音'
      }
      onClick={() => {
        const value = blocked || !enabled;
        setEnabled(value);
        setBlocked(false);
        try {
          localStorage.setItem(muteKey, String(!value));
        } catch {
          /* Denied storage does not affect decisions. */
        }
        window.dispatchEvent(
          new CustomEvent(preferenceEvent, { detail: value }),
        );
        const audio = playback.current;
        if (!value || !audio || disabled || !canPlay) {
          generation.current++;
          claimSequence.current++;
          unlocking.current = false;
          queued.current = null;
          audio?.pause();
          return;
        }
        const current = ++generation.current;
        claimSequence.current++;
        unlocking.current = true;
        queued.current = null;
        audio.pause();
        audio.src = bid;
        audio.currentTime = 0;
        audio.volume = 0;
        void audio.play().then(
          () => {
            if (current !== generation.current || audio !== playback.current)
              return;
            audio.pause();
            audio.currentTime = 0;
            unlocking.current = false;
            const cue = queued.current;
            queued.current = null;
            if (cue) {
              audio.src = sources[cue];
              audio.volume = 0.42;
              void audio.play().then(
                () => {
                  if (current === generation.current) setBlocked(false);
                },
                () => {
                  if (current === generation.current) setBlocked(true);
                },
              );
            }
          },
          () => {
            if (current === generation.current) {
              unlocking.current = false;
              queued.current = null;
              setBlocked(true);
            }
          },
        );
      }}
    >
      {blocked ? '启用声音' : enabled ? '声音开' : '静音'}
    </button>
  );
}

const presentation: Record<Cue, { symbol: string; label: string }> = {
  bid: { symbol: '⌁', label: '电厂竞价' },
  fuel: { symbol: '▣', label: '燃料装卸' },
  build: { symbol: '⌂', label: '电网连接' },
  plant: { symbol: '⚙', label: '电厂入网' },
  run: { symbol: 'ϟ', label: '供电运行' },
  end: { symbol: '✦', label: '电网结算' },
};
/** Decorative public feedback only; no command, hidden amount or modal layer. */
export function PowerGridSavedEffects({
  feedback,
  game,
  disabled,
}: {
  feedback: RoomFeedback | null;
  game: PowerGridView | null;
  disabled: boolean;
}) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [effect, setEffect] = useState<{ key: string; cue: Cue } | null>(null);
  const seen = useRef(new Set([feedbackKey(feedback)]));
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  const lifetime = useRef<{
    frame: number;
    expiry: ReturnType<typeof setTimeout> | undefined;
  }>({ frame: 0, expiry: undefined });
  useEffect(() => {
    const clock = lifetime.current;
    return () => {
      cancelAnimationFrame(clock.frame);
      clearTimeout(clock.expiry);
    };
  }, []);
  useEffect(() => {
    // A live preference change can arrive after the saved event was accepted.
    // Shorten the active lifetime once; duplicate feedback cannot extend it.
    if (reduced) {
      const clock = lifetime.current;
      clearTimeout(clock.expiry);
      clock.expiry = setTimeout(() => setEffect(null), 350);
    }
  }, [reduced]);
  useEffect(() => {
    const clock = lifetime.current;
    if (disabled || !feedback) {
      accept(seen.current, feedback);
      cancelAnimationFrame(clock.frame);
      clearTimeout(clock.expiry);
      clock.frame = requestAnimationFrame(() => setEffect(null));
      return;
    }
    const key = accept(seen.current, feedback);
    if (!key) return;
    const cue = cueFor(feedback, game);
    if (!cue) return;
    cancelAnimationFrame(clock.frame);
    clearTimeout(clock.expiry);
    clock.frame = requestAnimationFrame(() => {
      setEffect({ key, cue });
      clock.expiry = setTimeout(
        () => setEffect(null),
        reduced ? 350 : cue === 'end' ? 1800 : 1100,
      );
    });
  }, [feedback, game, disabled, reduced]);
  if (!effect || disabled || !feedback) return null;
  const { symbol, label } = presentation[effect.cue];
  return (
    <div
      key={effect.key}
      aria-hidden="true"
      data-power-grid-effect={effect.cue}
      className={`pg-saved-fx pg-saved-fx--${effect.cue}${reduced ? ' pg-saved-fx--reduced' : ''}`}
    >
      <div className="pg-saved-fx__current" />
      <div className="pg-saved-fx__ring" />
      <div className="pg-saved-fx__marks">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} style={{ '--pg-fx-index': i } as CSSProperties} />
        ))}
      </div>
      <div className="pg-saved-fx__badge">
        <b>{symbol}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}
