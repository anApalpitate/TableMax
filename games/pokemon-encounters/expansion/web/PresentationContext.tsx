import { PresentationClock, type AnchorRect } from './presentation-clock';
import { measurePresentationAnchors } from './presentation-anchors';
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
import type { RoomFeedback } from '@tablemax/web-host';
import type { View } from '../project';
import { presentationSteps, type PresentationStep } from './playback';
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
  const viewerSeat =
    session.role === 'player' ? (session.self?.id ?? '') : null;
  const scope =
    session.view?.instanceId +
    ':' +
    session.view?.branch +
    ':' +
    game?.roundNumber +
    ':' +
    session.role +
    ':' +
    viewerSeat;
  const authorityKey = JSON.stringify([
    session.view?.instanceId,
    session.view?.branch,
    session.role,
    viewerSeat,
  ]);
  const [clock] = useState(
    () =>
      new PresentationClock(
        scope,
        game?.events.map((e) => e.id) ?? [],
        authorityKey,
      ),
  );
  const state = useSyncExternalStore(clock.subscribe, clock.snapshot);
  const disabled =
    !session.connected ||
    Boolean(session.view?.paused) ||
    session.view?.playMode !== 'play';
  useLayoutEffect(() => {
    clock.measure(measurePresentationAnchors());
    const measure = () => clock.measure(measurePresentationAnchors());
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
            viewerSeat,
          )
        : [],
      disabled,
      game?.events.map((e) => e.id) ?? [],
      authorityKey,
    );
  }, [
    clock,
    scope,
    authorityKey,
    disabled,
    game,
    session.feedback,
    session.motion,
    viewerSeat,
  ]);
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
