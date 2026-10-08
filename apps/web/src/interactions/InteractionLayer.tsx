import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  INTERACTION_CATALOG,
  type InteractionEvent,
  type ShotId,
} from '@tablemax/protocol';
import type { RoomSession } from '../session/useRoomSession';
import { OverlayPanel } from '../components/OverlayPanel';
import { interactionAsset } from './assets';
import {
  interactionSector,
  interactionWheel,
  normalizedInteractionPoint,
} from './model';
import { useInteractionAudio } from './useInteractionAudio';
import './interaction.css';

function useInteractionSurface() {
  const [surface, setSurface] = useState<HTMLElement>(document.body);
  useEffect(() => {
    let opened: HTMLDialogElement[] = [];
    const update = (records: MutationRecord[] = []) => {
      const dialogs = Array.from(
        document.querySelectorAll<HTMLDialogElement>('dialog[open]'),
      );
      opened = opened.filter((dialog) => dialogs.includes(dialog));
      for (const dialog of dialogs)
        if (!opened.includes(dialog)) opened.push(dialog);
      for (const record of records)
        if (
          record.attributeName === 'open' &&
          record.target instanceof HTMLDialogElement &&
          record.target.open
        ) {
          opened = opened.filter((dialog) => dialog !== record.target);
          opened.push(record.target);
        }
      setSurface(opened.at(-1) ?? document.body);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    return () => observer.disconnect();
  }, []);
  return surface;
}

function SavedInteraction({
  event,
  actor,
  endsAt,
}: {
  event: InteractionEvent;
  actor: string;
  endsAt: number;
}) {
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    element.current?.style.setProperty(
      '--elapsed',
      `${Math.max(0, event.durationMs - (endsAt - performance.now()))}ms`,
    );
  }, [event.durationMs, endsAt]);
  const payload = event.interaction;
  if (payload.type === 'speech') {
    const phrase = INTERACTION_CATALOG.phrases.find(
      (p) => p.id === payload.phraseId,
    )!;
    return (
      <div className="interaction-speech" role="status">
        <strong>{actor}</strong>
        <span>{phrase.text}</span>
      </div>
    );
  }
  const shot = INTERACTION_CATALOG.shots.find(
    (s) => s.id === payload.effectId,
  )!;
  const x = payload.point.x * window.innerWidth;
  const y = payload.point.y * window.innerHeight;
  return (
    <div
      ref={element}
      className="interaction-shot"
      data-effect={shot.id}
      aria-label={`${actor}${shot.label}`}
      style={
        {
          '--hit-x': `${x}px`,
          '--hit-y': `${y}px`,
          '--duration': `${event.durationMs}ms`,
        } as CSSProperties
      }
    >
      {shot.steps.map((step, index) => (
        <div
          key={index}
          className="interaction-projectile"
          data-object={step.object}
          style={
            {
              '--delay': `${step.atMs}ms`,
              '--scatter-x': `${((index % 3) - 1) * 22}px`,
              '--scatter-y': `${(index % 2 ? -1 : 1) * 13}px`,
            } as CSSProperties
          }
        >
          <img
            src={
              interactionAsset(`object-${step.object}.svg`) ||
              interactionAsset(`object-${step.object}.webp`)
            }
            alt=""
          />
          <span className="interaction-splash" />
        </div>
      ))}
      {shot.id === 'cappuccino' && (
        <>
          <span className="interaction-coffee-stream" />
          <span className="interaction-coffee-foam" />
        </>
      )}
      {shot.id === 'flower' && (
        <div className="interaction-petals">
          {Array.from({ length: 12 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  '--petal-angle': `${i * 30}deg`,
                  '--delay': `${1100 + i * 90}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <span className="interaction-actor">{actor}</span>
    </div>
  );
}

export function InteractionLayer({ session }: { session: RoomSession }) {
  const { role, self, connected, view, interaction } = session;
  const canSend = role === 'player' && Boolean(self) && connected;
  const surface = useInteractionSurface();
  const preferenceKey = `tablemax-interaction-blocked-${role}`;
  const [blocked, setBlocked] = useState(() => {
    try {
      return localStorage.getItem(preferenceKey) === 'true';
    } catch {
      return false;
    }
  });
  const [wheel, setWheel] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState(-1);
  const selection = useRef(-1);
  const [shooting, setShooting] = useState<ShotId | null>(null);
  const [speech, setSpeech] = useState(false);
  const [message, setMessage] = useState('');
  const [live, setLive] = useState<{
    event: InteractionEvent;
    endsAt: number;
  } | null>(null);
  const consumed = useRef('');
  const audio = useInteractionAudio(!blocked);
  const audioPlay = audio.play,
    audioStop = audio.stop;
  const contextKey = `${view?.instanceId}:${view?.branch}`;
  useEffect(() => {
    let active = true;
    audioStop();
    queueMicrotask(() => {
      if (!active) return;
      setShooting(null);
      setWheel(null);
      setSpeech(false);
      setLive(null);
    });
    return () => {
      active = false;
    };
  }, [contextKey, connected, audioStop]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === preferenceKey) setBlocked(event.newValue === 'true');
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, [preferenceKey]);
  useEffect(() => {
    let active = true;
    if (blocked) {
      audioStop();
      queueMicrotask(() => {
        if (active) setLive(null);
      });
    }
    return () => {
      active = false;
    };
  }, [blocked, audioStop]);
  useEffect(() => {
    if (!interaction || consumed.current === interaction.eventId) return;
    consumed.current = interaction.eventId;
    if (blocked || !connected || document.visibilityState === 'hidden') return;
    let active = true;
    const endsAt = performance.now() + interaction.durationMs;
    queueMicrotask(() => {
      if (!active) return;
      setLive({ event: interaction, endsAt });
      void audioPlay(interaction);
    });
    return () => {
      active = false;
    };
  }, [interaction, blocked, connected, audioPlay]);
  useEffect(() => {
    if (!live) return;
    const timer = setTimeout(
      () => {
        setLive(null);
        audioStop();
      },
      Math.max(0, live.endsAt - performance.now()),
    );
    return () => clearTimeout(timer);
  }, [live, audioStop]);
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') {
        setLive(null);
        setWheel(null);
        setShooting(null);
        audioStop();
      }
    };
    document.addEventListener('visibilitychange', hide);
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (shooting || wheel)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setShooting(null);
        setWheel(null);
      }
    };
    document.addEventListener('keydown', cancel, true);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      document.removeEventListener('keydown', cancel, true);
    };
  }, [shooting, wheel, audioStop]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);
  async function send(payload: Parameters<RoomSession['sendInteraction']>[0]) {
    const reply = await session.sendInteraction(payload);
    if (!reply.ok)
      setMessage(
        reply.reason === 'queue-full'
          ? '您的手速太快了，请稍后再试'
          : '互动未发送，请检查连接后再试',
      );
  }
  function choose(index: number) {
    const slot = interactionWheel[index];
    setWheel(null);
    setSelected(-1);
    selection.current = -1;
    if (!slot) return;
    if (slot.id === 'speech') {
      setShooting(null);
      setSpeech(true);
    } else {
      setSpeech(false);
      setShooting(slot.id);
    }
  }
  const restingY = Math.max(
    145,
    Math.min(window.innerHeight - 145, window.innerHeight * 0.67),
  );
  return (
    <>
      {createPortal(
        <div
          className="interaction-layer"
          data-interaction-layer
          data-blocked={blocked}
        >
          {live && !blocked && (
            <SavedInteraction
              key={live.event.eventId}
              event={live.event}
              endsAt={live.endsAt}
              actor={
                view?.seats.find((s) => s.id === live.event.actorSeatId)
                  ?.name ?? '玩家'
              }
            />
          )}
          {canSend && (
            <button
              type="button"
              className="interaction-orb"
              aria-label="按住打开互动轮盘"
              title="按住并滑动选择互动"
              style={{ top: `${restingY}px` }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                selection.current = -1;
                setSelected(-1);
                setShooting(null);
                setWheel({
                  x: Math.min(
                    window.innerWidth - 134,
                    Math.max(134, event.clientX),
                  ),
                  y: Math.min(
                    window.innerHeight - 134,
                    Math.max(134, event.clientY),
                  ),
                });
              }}
              onPointerMove={(event) => {
                if (!wheel) return;
                const index = interactionSector(
                  event.clientX - wheel.x,
                  event.clientY - wheel.y,
                );
                selection.current = index;
                setSelected(index);
              }}
              onPointerUp={(event) => {
                if (!wheel) return;
                event.preventDefault();
                event.stopPropagation();
                choose(selection.current);
              }}
              onPointerCancel={() => {
                setWheel(null);
                setSelected(-1);
                selection.current = -1;
              }}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  if (!wheel)
                    setWheel({ x: window.innerWidth / 2, y: restingY });
                } else if (
                  wheel &&
                  ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(
                    event.key,
                  )
                ) {
                  event.preventDefault();
                  const index =
                    (selection.current +
                      (event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                        ? 5
                        : 1) +
                      6) %
                    6;
                  selection.current = index;
                  setSelected(index);
                }
              }}
              onKeyUp={(event) => {
                if (wheel && (event.key === ' ' || event.key === 'Enter')) {
                  event.preventDefault();
                  choose(selection.current);
                }
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="1" />
              </svg>
            </button>
          )}
          {(role !== 'player' || self) && (
            <button
              type="button"
              className="interaction-block"
              aria-label={blocked ? '恢复互动' : '屏蔽互动'}
              title={blocked ? '恢复互动' : '屏蔽互动'}
              aria-pressed={blocked}
              onClick={() => {
                const next = !blocked;
                setBlocked(next);
                try {
                  localStorage.setItem(preferenceKey, String(next));
                } catch {
                  /* Memory preference still works. */
                }
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                {blocked ? (
                  <path d="m8 8 8 6m0-6-8 6" />
                ) : (
                  <path d="M7 11h.01M12 11h.01M17 11h.01" />
                )}
              </svg>
            </button>
          )}
          {wheel && (
            <div
              className="interaction-wheel"
              role="group"
              aria-label="互动轮盘"
              style={{ left: wheel.x, top: wheel.y }}
            >
              <svg
                className="interaction-wheel__sectors"
                viewBox="-132 -132 264 264"
                aria-hidden="true"
              >
                {interactionWheel.map((slot, index) => {
                  const from = ((-120 + index * 60) * Math.PI) / 180,
                    to = from + Math.PI / 3;
                  const point = (radius: number, angle: number) =>
                    `${radius * Math.cos(angle)} ${radius * Math.sin(angle)}`;
                  return (
                    <path
                      key={slot.id}
                      data-selected={selected === index}
                      d={`M${point(128, from)} A128 128 0 0 1 ${point(128, to)} L${point(35, to)} A35 35 0 0 0 ${point(35, from)} Z`}
                    />
                  );
                })}
              </svg>
              {interactionWheel.map((slot, index) => {
                const angle = ((-90 + index * 60) * Math.PI) / 180;
                return (
                  <div
                    key={slot.id}
                    className="interaction-wheel__slot"
                    data-selected={selected === index}
                    style={{
                      left: 132 + Math.cos(angle) * 86,
                      top: 132 + Math.sin(angle) * 86,
                    }}
                  >
                    {slot.image ? (
                      <img src={interactionAsset(slot.image)} alt="" />
                    ) : (
                      <span
                        className="interaction-wheel__speech-icon"
                        aria-hidden="true"
                      >
                        •••
                      </span>
                    )}
                    <span>{slot.label}</span>
                  </div>
                );
              })}
              <span className="interaction-wheel__centre" aria-hidden="true">
                松手选择
              </span>
            </div>
          )}
          {shooting && (
            <div
              className="interaction-aim"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerUp={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                const effectId = shooting;
                setShooting(null);
                void send({
                  type: 'shot',
                  effectId,
                  point: normalizedInteractionPoint(
                    event.clientX,
                    event.clientY,
                    window.innerWidth,
                    window.innerHeight,
                  ),
                });
              }}
            >
              <div className="interaction-aim__hint">
                <span>点击位置发射</span>
                <button
                  type="button"
                  className="secondary"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onPointerUp={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setShooting(null);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setShooting(null);
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          )}
          {message && (
            <div className="interaction-message" role="alert">
              {message}
            </div>
          )}
        </div>,
        surface,
      )}
      {speech && (
        <OverlayPanel title="发言" close={() => setSpeech(false)}>
          <div className="interaction-phrases">
            {INTERACTION_CATALOG.phrases.map((phrase) => (
              <button
                type="button"
                key={phrase.id}
                disabled={!canSend}
                onClick={() => {
                  setSpeech(false);
                  void send({ type: 'speech', phraseId: phrase.id });
                }}
              >
                {phrase.text}
              </button>
            ))}
          </div>
        </OverlayPanel>
      )}
    </>
  );
}
