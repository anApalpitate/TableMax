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
  clampInteractionOrb,
  normalizedInteractionPoint,
} from './model';
import { useInteractionAudio } from './useInteractionAudio';
import { useInteractionPreference } from './useInteractionPreference';
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
          '--pour-at': `${shot.pourAtMs ?? Math.round(event.durationMs * 0.24)}ms`,
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
              '--hit-delay': `${step.hitMs ?? Math.min(event.durationMs - 1, step.atMs + 320)}ms`,
              '--flight-duration': `${Math.max(1, (step.hitMs ?? Math.min(event.durationMs - 1, step.atMs + 320)) - step.atMs)}ms`,
              '--object-fade-duration': `${Math.min(180, event.durationMs - (step.hitMs ?? Math.min(event.durationMs - 1, step.atMs + 320)))}ms`,
              '--scatter-x': `${((index % 3) - 1) * 22}px`,
              '--scatter-y': `${(index % 2 ? -1 : 1) * 13}px`,
            } as CSSProperties
          }
        >
          <img
            src={
              interactionAsset(`object-${step.object}.webp`) ||
              interactionAsset(`object-${step.object}.svg`)
            }
            alt=""
          />
          <span className="interaction-splash" />
          {step.object === 'flower' && (
            <span className="interaction-flower-bloom">
              <img src={interactionAsset('object-flower.webp')} alt="" />
            </span>
          )}
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
                  '--delay': `${Math.min(event.durationMs - 180, (shot.steps[0]?.hitMs ?? 320) + i * 55)}ms`,
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
  const [blocked] = useInteractionPreference(role);
  const orbKey = `tablemax-interaction-orb-${role}`;
  const [orb, setOrb] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(orbKey) ?? 'null');
      if (
        saved &&
        Number.isFinite(saved.x) &&
        Number.isFinite(saved.y) &&
        saved.x >= 0 &&
        saved.x <= 1 &&
        saved.y >= 0 &&
        saved.y <= 1
      )
        return saved as { x: number; y: number };
    } catch {
      // A missing preference uses the initial right-hand position.
    }
    return { x: 1 - 38 / window.innerWidth, y: 0.67 };
  });
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [dragging, setDragging] = useState(false);
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    anchor: { x: number; y: number };
    last: { x: number; y: number };
    dragged: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const [wheel, setWheel] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState(-1);
  const selection = useRef(-1);
  const [shooting, setShooting] = useState<ShotId | null>(null);
  const aimPointer = useRef<number | null>(null);
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
    // Moving the portal into/out of a modal replaces the captured DOM node.
    // Discard that gesture before the new orb can receive another pointer.
    if (pointer.current?.timer) clearTimeout(pointer.current.timer);
    pointer.current = null;
    aimPointer.current = null;
    selection.current = -1;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setWheel(null);
      setSelected(-1);
      setDragging(false);
    });
    return () => {
      active = false;
    };
  }, [surface]);
  useEffect(() => {
    let active = true;
    audioStop();
    if (pointer.current?.timer) clearTimeout(pointer.current.timer);
    pointer.current = null;
    aimPointer.current = null;
    queueMicrotask(() => {
      if (!active) return;
      setShooting(null);
      setWheel(null);
      setSpeech(false);
      setLive(null);
      setDragging(false);
    });
    return () => {
      active = false;
    };
  }, [contextKey, connected, audioStop]);
  useEffect(() => {
    const resize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      if (pointer.current?.timer) clearTimeout(pointer.current.timer);
      pointer.current = null;
      setDragging(false);
      setWheel(null);
    };
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (pointer.current?.timer) clearTimeout(pointer.current.timer);
    };
  }, []);
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
    const startedAt = performance.now();
    const endsAt = startedAt + interaction.durationMs;
    queueMicrotask(() => {
      if (!active) return;
      setLive({ event: interaction, endsAt });
      void audioPlay(interaction, startedAt);
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
        if (pointer.current?.timer) clearTimeout(pointer.current.timer);
        pointer.current = null;
        aimPointer.current = null;
        selection.current = -1;
        setDragging(false);
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
        if (pointer.current?.timer) clearTimeout(pointer.current.timer);
        pointer.current = null;
        selection.current = -1;
        setDragging(false);
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
    if (!reply.ok) setMessage('互动未发送，请检查连接后再试');
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
      aimPointer.current = null;
      setShooting(slot.id);
    }
  }
  const resting = clampInteractionOrb(
    orb.x * viewport.width,
    orb.y * viewport.height,
    viewport.width,
    viewport.height,
  );
  const displayed = wheel ?? resting;
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
              aria-label={wheel ? '取消互动' : '拖动移动，按住打开互动轮盘'}
              title={wheel ? '取消互动' : '拖动移动，按住并滑动选择互动'}
              data-dragging={dragging}
              data-open={Boolean(wheel)}
              style={{ left: displayed.x, top: displayed.y }}
              onPointerDown={(event) => {
                if (event.button !== 0 || pointer.current) return;
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                selection.current = -1;
                setSelected(-1);
                const rect = event.currentTarget.getBoundingClientRect();
                const anchor = {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                };
                const gesture = {
                  id: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                  anchor,
                  last: anchor,
                  dragged: false,
                  timer: null as ReturnType<typeof setTimeout> | null,
                };
                pointer.current = gesture;
                gesture.timer = setTimeout(() => {
                  if (pointer.current !== gesture || gesture.dragged) return;
                  setShooting(null);
                  setWheel(
                    clampInteractionOrb(
                      gesture.anchor.x,
                      gesture.anchor.y,
                      viewport.width,
                      viewport.height,
                      138,
                    ),
                  );
                }, 240);
              }}
              onPointerMove={(event) => {
                const gesture = pointer.current;
                if (!gesture || event.pointerId !== gesture.id) return;
                event.preventDefault();
                if (wheel) {
                  const index = interactionSector(
                    event.clientX - wheel.x,
                    event.clientY - wheel.y,
                  );
                  selection.current = index;
                  setSelected(index);
                  return;
                }
                const dx = event.clientX - gesture.x,
                  dy = event.clientY - gesture.y;
                if (Math.hypot(dx, dy) < 8 && !gesture.dragged) return;
                gesture.dragged = true;
                if (gesture.timer) clearTimeout(gesture.timer);
                setDragging(true);
                gesture.last = clampInteractionOrb(
                  gesture.anchor.x + dx,
                  gesture.anchor.y + dy,
                  viewport.width,
                  viewport.height,
                );
                setOrb(
                  normalizedInteractionPoint(
                    gesture.last.x,
                    gesture.last.y,
                    viewport.width,
                    viewport.height,
                  ),
                );
              }}
              onPointerUp={(event) => {
                const gesture = pointer.current;
                if (!gesture || gesture.id !== event.pointerId) return;
                event.preventDefault();
                event.stopPropagation();
                if (gesture.timer) clearTimeout(gesture.timer);
                pointer.current = null;
                setDragging(false);
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
                if (gesture.dragged) {
                  try {
                    localStorage.setItem(
                      orbKey,
                      JSON.stringify(
                        normalizedInteractionPoint(
                          gesture.last.x,
                          gesture.last.y,
                          viewport.width,
                          viewport.height,
                        ),
                      ),
                    );
                  } catch {
                    /* Current position remains usable. */
                  }
                } else if (wheel) choose(selection.current);
              }}
              onPointerCancel={() => {
                if (pointer.current?.timer) clearTimeout(pointer.current.timer);
                pointer.current = null;
                setDragging(false);
                setWheel(null);
                setSelected(-1);
                selection.current = -1;
              }}
              onLostPointerCapture={() => {
                if (!pointer.current) return;
                if (pointer.current.timer) clearTimeout(pointer.current.timer);
                pointer.current = null;
                setDragging(false);
                setWheel(null);
                setSelected(-1);
                selection.current = -1;
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (wheel) setWheel(null);
              }}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  if (!wheel)
                    setWheel(
                      clampInteractionOrb(
                        resting.x,
                        resting.y,
                        viewport.width,
                        viewport.height,
                        138,
                      ),
                    );
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
                {wheel ? (
                  <path d="m6 6 12 12M18 6 6 18" />
                ) : (
                  <>
                    <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="1" />
                  </>
                )}
              </svg>
              {wheel && <span className="interaction-orb__cancel">取消</span>}
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
                      <svg
                        className="interaction-wheel__speech-icon"
                        viewBox="0 0 24 24"
                        role="img"
                        aria-label="发言"
                      >
                        <path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                        <path d="M7 10h.01M12 10h.01M17 10h.01" />
                      </svg>
                    )}
                    {slot.id !== 'speech' && <span>{slot.label}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {shooting && (
            <div
              className="interaction-aim"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                aimPointer.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerUp={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                const beganHere = aimPointer.current === event.pointerId;
                aimPointer.current = null;
                const effectId = shooting;
                setShooting(null);
                if (!beganHere) return;
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
              onPointerCancel={() => {
                aimPointer.current = null;
                setShooting(null);
              }}
            >
              <div className="interaction-aim__hint">
                <span>点击位置发射</span>
                <button
                  type="button"
                  className="secondary"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    aimPointer.current = null;
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
                  audio.unlock();
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
