/* eslint-disable react-refresh/only-export-components -- Shared ESM host API. */
import {
  createContext,
  useContext,
  useRef,
  useLayoutEffect,
  type ReactNode,
  type AnchorHTMLAttributes,
} from 'react';
import type { GameHost, GameClient, GameHostSlots } from './types';
import { presentationServices } from './presentation-services';
export type {
  GameHost,
  GameClient,
  GameCommand,
  GameSetupSettingsProps,
} from './types';
export type { RoomFeedback, PublicAction } from '@tablemax/protocol';
export { WEB_HOST_VERSION } from './types';
export { resourceUrl } from './resource-url';
export { OverlayPanel } from './components/OverlayPanel';
export { PlayModeBadge } from './components/PlayModeBadge';
export { DecisionCountdown } from './components/DecisionCountdown';
export { RulesGuide } from './components/RulesGuide';
export { useDecisionClock } from './components/useDecisionClock';
export { useViewportSnapshot } from './viewport/useViewportSnapshot';
export type {
  ViewportSnapshot,
  ViewportMeasurement,
  ViewportSize,
  SafeInsets,
} from './viewport/viewport';
export { BeginnerGuidanceSetting } from './components/BeginnerGuidanceSetting';
export { SettingHelp } from './components/SettingHelp';
export { useGuidancePreference } from './preferences/useGuidancePreference';
export {
  useSoundPreference,
  useSoundActivation,
  subscribeSoundPreference,
} from './preferences/useSoundPreference';

const Context = createContext<GameHostSlots | null>(null);
function useSlots() {
  const value = useContext(Context);
  if (!value) throw new Error('Game host presentation is not mounted');
  return value;
}
export function RoomManagement({
  lifecycleLabel,
}: {
  session?: GameHost;
  lifecycleLabel?: string;
}) {
  return useSlots().management(lifecycleLabel ? { lifecycleLabel } : {});
}
export function SessionFeedback({
  mode,
}: {
  session?: GameHost;
  mode?: 'all' | 'saved' | 'messages';
}) {
  return useSlots().feedback(mode ? { mode } : undefined);
}
export function PlayModeControl(_props: { session?: GameHost }) {
  void _props;
  return useSlots().playMode();
}
export function CountdownSettings({
  children,
}: {
  session?: GameHost;
  children?: ReactNode;
}) {
  return useSlots().countdown(children === undefined ? {} : { children });
}
export function ScreenLink(
  props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string },
) {
  const Component = presentationServices().ScreenLink;
  return <Component {...props} />;
}
export function FullscreenControl() {
  const Component = presentationServices().FullscreenControl;
  return <Component />;
}
export function DisplaySettings(props: { role?: GameHost['role'] }) {
  const Component = presentationServices().DisplaySettings;
  return <Component {...props} />;
}
export function useAudioOutput() {
  return presentationServices().useAudioOutput();
}
export function claimAudioEvent(key: string) {
  return presentationServices().claimAudioEvent(key);
}
export function avatarFor(id: string) {
  return presentationServices().avatarFor(id);
}
export { avatarChoices } from './presentation-services';

/** Private controls are bound to presentation slots, never passed to games. */
export function HostedGame({
  session,
  client,
  presentation,
  resourceUrl: resolveResource,
}: {
  session: GameHost;
  client: GameClient;
  presentation: GameHostSlots;
  resourceUrl?: (id: string) => string;
}) {
  const latest = useRef(session);
  useLayoutEffect(() => {
    latest.current = session;
  });
  const snapshot = session.view;
  const host: GameHost = {
    role: session.role,
    view: snapshot,
    self: session.self,
    connected: session.connected,
    locked: session.locked,
    canControl: session.canControl,
    message: session.message,
    ...(session.messageKind === undefined
      ? {}
      : { messageKind: session.messageKind }),
    admissionPending: session.admissionPending,
    awaitingConfirmation: session.awaitingConfirmation,
    feedback: session.feedback,
    errorId: session.errorId,
    motion: session.motion,
    ...(resolveResource ? { resourceUrl: resolveResource } : {}),
    command(value) {
      if (!['game', 'lifecycle', 'resume', 'replay'].includes(value.type))
        return;
      const current = latest.current;
      if (
        !snapshot ||
        !current.view ||
        current.locked ||
        snapshot.instanceId !== current.view.instanceId ||
        snapshot.branch !== current.view.branch ||
        snapshot.selectionToken !== current.view.selectionToken ||
        snapshot.decisionId !== current.view.decisionId
      )
        return;
      if (value.type === 'game') {
        if (value.decisionId !== snapshot.decisionId) return;
      } else if (!current.canControl) return;
      current.command(value);
    },
  };
  const Screen = client.Screen;
  return (
    <Context.Provider value={presentation}>
      <Screen session={host} />
    </Context.Provider>
  );
}
