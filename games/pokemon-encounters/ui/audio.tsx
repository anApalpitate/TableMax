import { claimAudioEvent } from '@tablemax/web-host';
import { useEffect, useRef, useState } from 'react';
import type { RoomFeedback } from '../../../packages/protocol/src';
import type { PokemonView } from '../rules/project';
import {
  soundRecipe,
  type SoundCue,
  type SoundCueRecipe,
} from './presentation-state';
import { SavedSoundPlayer } from './sound-player';
import { SOUND_MAX_LATE_MS } from './sound-timing';
import draw from '../../../assets/games/pokemon-encounters/audio/draw-v1.flac';
import replace from '../../../assets/games/pokemon-encounters/audio/replace-v1.flac';
import effect from '../../../assets/games/pokemon-encounters/audio/effect-complete-v1.flac';
import result from '../../../assets/games/pokemon-encounters/audio/round-result-v1.flac';
import victory from '../../../assets/games/pokemon-encounters/audio/match-result-v1.flac';
import error from '../../../assets/games/pokemon-encounters/audio/error-v1.flac';
import mew from '../../../assets/games/pokemon-encounters/audio/mew-v1.flac';
import zapdos from '../../../assets/games/pokemon-encounters/audio/zapdos-v1.flac';
import snorlax from '../../../assets/games/pokemon-encounters/audio/snorlax-v1.flac';
import charizard from '../../../assets/games/pokemon-encounters/audio/charizard-v1.flac';
import rocket from '../../../assets/games/pokemon-encounters/audio/team-rocket-entrance-user-v2.flac';
import rocketReturn from '../../../assets/games/pokemon-encounters/audio/rocket-return-v1.flac';
import meowth from '../../../assets/games/pokemon-encounters/audio/meowth-coin-user-v2.flac';
import pikachu from '../../../assets/games/pokemon-encounters/audio/pikachu-user-v2.flac';
import jigglypuff from '../../../assets/games/pokemon-encounters/audio/jigglypuff-user-v2.flac';
import eevee from '../../../assets/games/pokemon-encounters/audio/eevee-user-v2.flac';
import bulbasaur from '../../../assets/games/pokemon-encounters/audio/bulbasaur-user-v2.flac';
import squirtle from '../../../assets/games/pokemon-encounters/audio/squirtle-user-v2.flac';
import gengar from '../../../assets/games/pokemon-encounters/audio/gengar-user-v2.flac';

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
  jigglypuff,
  eevee,
  bulbasaur,
  squirtle,
  gengar,
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

function reducedMotionPreference() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function SoundControl({
  feedback,
  eventKey = '',
  game = null,
  errorId,
  compact = false,
  iconOnly = false,
  disabled = false,
  paused = false,
  canPlay = true,
  recipe,
  resolveSource,
}: {
  feedback: RoomFeedback | null;
  eventKey?: string;
  game?: PokemonView | null;
  errorId: string;
  compact?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
  paused?: boolean;
  canPlay?: boolean;
  recipe?: (
    event: RoomFeedback['events'][number],
    reducedMotion: boolean,
  ) => SoundCueRecipe[];
  resolveSource?: (
    cue: SoundCue,
    event: RoomFeedback['events'][number],
  ) => string | undefined;
}) {
  const [enabled, setEnabled] = useState(preference);
  const [blocked, setBlocked] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(reducedMotionPreference);
  // Mounting a screen never replays feedback that arrived before its subscription.
  const last = useRef(feedbackKey(feedback) + eventKey);
  const lastError = useRef(errorId);
  const player = useRef<SavedSoundPlayer | null>(null);
  const permission = useRef(0);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const audio = { effect: new Audio(), cry: new Audio() };
    audio.effect.preload = 'none';
    audio.cry.preload = 'none';
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
    if (!enabled || disabled || paused || !canPlay) player.current?.stop();
  }, [enabled, disabled, paused, canPlay]);
  useEffect(() => {
    const id = feedbackKey(feedback) + eventKey;
    if (!feedback) {
      last.current = '';
      permission.current++;
      player.current?.stop();
      return;
    }
    if (last.current === id) return;
    last.current = id;
    if (!enabled || disabled || paused || !canPlay) return;
    const event = feedback.events.at(-1);
    if (!event) return;
    const permit = permission.current,
      playback = player.current,
      occurredAt = Date.now();
    void Promise.resolve(claimAudioEvent(id) ?? true)
      .then((accepted) => {
        if (
          accepted &&
          permission.current === permit &&
          last.current === id &&
          player.current === playback
        )
          playback?.enqueueEvent(
            id,
            (recipe
              ? recipe(event, reducedMotion)
              : soundRecipe(event.kind, event.action, game, { reducedMotion })
            ).map(({ cue, ...recipe }) => ({
              ...recipe,
              source:
                recipe.source ?? resolveSource?.(cue, event) ?? sources[cue],
            })),
            occurredAt,
          );
      })
      .catch(() => undefined);
  }, [
    feedback,
    eventKey,
    game,
    enabled,
    disabled,
    paused,
    canPlay,
    reducedMotion,
    recipe,
    resolveSource,
  ]);
  useEffect(() => {
    if (lastError.current === errorId) return;
    lastError.current = errorId;
    if (!errorId || !enabled || disabled || paused || !canPlay) return;
    const permit = permission.current,
      playback = player.current,
      current = last.current,
      key = `${current}:error:${errorId}`,
      occurredAt = Date.now();
    void Promise.resolve(claimAudioEvent(key) ?? true)
      .then((accepted) => {
        if (
          accepted &&
          permission.current === permit &&
          last.current === current &&
          lastError.current === errorId &&
          player.current === playback
        )
          playback?.enqueueEvent(
            key,
            [
              {
                source: error,
                lane: 'effect',
                priority: 3,
                delayMs: 0,
                maxLateMs: SOUND_MAX_LATE_MS,
              },
            ],
            occurredAt,
          );
      })
      .catch(() => undefined);
  }, [errorId, enabled, disabled, paused, canPlay]);
  return (
    <button
      className={`secondary sound-control${iconOnly ? ' sound-icon-control' : ''}`}
      style={
        iconOnly
          ? {
              display: 'grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              padding: 9,
              flex: '0 0 44px',
            }
          : undefined
      }
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
        !canPlay && enabled
          ? '由电脑指定的公共屏或管理窗口播放'
          : disabled
            ? '测试模式已关闭提示音'
            : blocked && enabled
              ? '声音待启用，点击允许播放'
              : enabled
                ? '关闭提示音'
                : '开启提示音'
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
      {iconOnly ? (
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          style={{ display: 'block' }}
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9h4l5-4v14l-5-4H3z" />
          {enabled && !disabled ? (
            <>
              <path d="M16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14" />
              {blocked && canPlay && (
                <circle
                  cx="20"
                  cy="3"
                  r="1.5"
                  fill="currentColor"
                  stroke="none"
                />
              )}
            </>
          ) : (
            <path d="m16 9 5 6m0-6-5 6" />
          )}
        </svg>
      ) : disabled ? (
        '声音：关'
      ) : blocked && enabled && canPlay ? (
        '点击启用声音'
      ) : compact ? (
        enabled ? (
          '声音：开'
        ) : (
          '声音：关'
        )
      ) : enabled ? (
        '提示音已开启 · 静音'
      ) : (
        '开启提示音'
      )}
    </button>
  );
}
