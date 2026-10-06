/* eslint-disable react-refresh/only-export-components -- The game-local provider and its hook form one presentation boundary. */
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { GameHost } from '@tablemax/web-host';
import type { RoomFeedback } from '../../../../packages/protocol/src';
import type { View } from '../project';
import {
  PresentationQueue,
  presentationSteps,
  type PresentationStep,
} from './playback';
export type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type Snapshot = {
  scope: string;
  current: PresentationStep | null;
  last: PresentationStep | null;
  resultReady: boolean;
  anchors: Readonly<Record<string, AnchorRect>>;
  seen: readonly number[];
};
export class PresentationClock {
  private initialized = true;
  private queue = new PresentationQueue();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private state: Snapshot = {
    scope: '',
    current: null,
    last: null,
    resultReady: true,
    anchors: {},
    seen: [],
  };
  constructor(scope: string, committedIds: readonly number[]) {
    this.queue.reset(scope, committedIds);
    this.state = { ...this.state, scope, seen: [...committedIds] };
  }
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private publish(patch: Partial<Snapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  cancel(scope: string, committedIds: readonly number[] = []) {
    clearTimeout(this.timer);
    this.queue.reset(scope, committedIds);
    this.publish({
      scope,
      current: null,
      last: null,
      resultReady: true,
      seen: [...committedIds],
    });
  }
  dispose() {
    this.initialized = false;
    this.cancel('disposed');
  }
  receive(
    scope: string,
    steps: PresentationStep[],
    disabled: boolean,
    committedIds: readonly number[],
  ) {
    if (!this.initialized) {
      this.initialized = true;
      this.cancel(scope, committedIds);
      return;
    }
    if (disabled) {
      this.cancel(scope, committedIds);
      return;
    }
    if (this.state.scope !== scope) this.cancel(scope);
    const fresh = steps.filter((s) => !this.queue.has(s.event.id));
    if (!fresh.length) return;
    this.queue.append(scope, fresh);
    this.publish({
      seen: [...new Set([...this.state.seen, ...fresh.map((s) => s.event.id)])],
      ...(fresh.some((s) => s.kind === 'result') ? { resultReady: false } : {}),
    });
    if (!this.state.current) this.advance();
  }
  private advance() {
    const current = this.queue.next();
    this.publish({
      current,
      ...(current ? { last: current } : {}),
      ...(current?.kind === 'result' ? { resultReady: true } : {}),
    });
    if (current)
      this.timer = setTimeout(() => this.advance(), current.durationMs);
  }
  measure() {
    const anchors = { ...this.state.anchors };
    let changed = false;
    document
      .querySelectorAll<HTMLElement>(
        '.expansion-screen [data-slot], .expansion-screen [data-pile]',
      )
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        if (
          r.width > 2 &&
          r.height > 2 &&
          r.bottom > 0 &&
          r.top < innerHeight
        ) {
          const id = el.dataset.slot ?? '@' + el.dataset.pile;
          const rect = {
            x: r.x + scrollX,
            y: r.y + scrollY,
            width: r.width,
            height: r.height,
          };
          if (JSON.stringify(anchors[id]) !== JSON.stringify(rect)) {
            anchors[id] = rect;
            changed = true;
          }
        }
      });
    if (changed) this.publish({ anchors });
  }
}
type Presentation = {
  motion: readonly string[];
  resultReady: boolean;
  current: PresentationStep | null;
  feedback: RoomFeedback | null;
  eventKey: string;
  anchors: Readonly<Record<string, AnchorRect>>;
};
const Context = createContext<Presentation>({
  motion: [],
  resultReady: true,
  current: null,
  feedback: null,
  eventKey: '',
  anchors: {},
});
export const useExpansionPresentation = () => useContext(Context);
export function ExpansionPresentation({
  session,
  game,
  children,
}: {
  session: GameHost;
  game: View | null;
  children: ReactNode;
}) {
  const scope =
    session.view?.instanceId +
    ':' +
    session.view?.branch +
    ':' +
    game?.roundNumber +
    ':' +
    session.role;
  const [clock] = useState(
    () => new PresentationClock(scope, game?.events.map((e) => e.id) ?? []),
  );
  const state = useSyncExternalStore(clock.subscribe, clock.snapshot);
  const disabled =
    !session.connected ||
    Boolean(session.view?.paused) ||
    session.view?.playMode !== 'play';
  useLayoutEffect(() => {
    clock.measure();
    const measure = () => clock.measure();
    const observer = new ResizeObserver(measure);
    const screen = document.querySelector('.expansion-screen');
    if (screen) observer.observe(screen);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [clock, scope, game]);
  useEffect(() => {
    const events =
      game?.events.filter((e) => session.motion.includes('event:' + e.id)) ??
      [];
    clock.receive(
      scope,
      game && session.feedback
        ? presentationSteps(
            game,
            events,
            session.feedback.revision,
            matchMedia('(prefers-reduced-motion: reduce)').matches,
          )
        : [],
      disabled,
      game?.events.map((e) => e.id) ?? [],
    );
  }, [clock, scope, disabled, game, session.feedback, session.motion]);
  useEffect(() => () => clock.dispose(), [clock]);
  const current = disabled || state.scope !== scope ? null : state.current;
  const sound =
    disabled || state.scope !== scope ? null : (current ?? state.last);
  const feedback: RoomFeedback | null =
    sound && session.view
      ? {
          instanceId: session.view.instanceId,
          branch: session.view.branch,
          revision: sound.revision,
          events: [
            {
              kind: sound.event.kind,
              text: sound.event.text,
              ...(sound.event.action ? { action: sound.event.action } : {}),
            },
          ],
        }
      : null;
  const incomingResult = game?.events.some(
    (e) =>
      e.kind === 'round-result' &&
      session.motion.includes('event:' + e.id) &&
      !state.seen.includes(e.id),
  );
  const motion = current
    ? [
        'event:' + current.event.id,
        ...(current.kind === 'result' ? ['@result'] : []),
        ...current.effects.pulse,
      ]
    : [];
  return (
    <Context.Provider
      value={{
        current,
        motion,
        resultReady: disabled || (!incomingResult && state.resultReady),
        feedback,
        eventKey: sound ? ':event:' + sound.event.id : '',
        anchors: state.anchors,
      }}
    >
      {children}
    </Context.Provider>
  );
}
