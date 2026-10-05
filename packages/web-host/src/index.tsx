/* eslint-disable react-refresh/only-export-components -- Shared ESM host API. */
import {
  createContext,
  useContext,
  useRef,
  useLayoutEffect,
  type ReactNode,
} from 'react';
import type { RoomSession } from '../../../apps/web/src/session/useRoomSession';
import type { GameHost, GameClient } from './types';
import { RoomManagement as Management } from '../../../apps/web/src/components/RoomManagement';
import { SessionFeedback as Feedback } from '../../../apps/web/src/components/SessionFeedback';
import { PlayModeControl as Mode } from '../../../apps/web/src/components/PlayModeControl';
import { CountdownSettings as Settings } from '../../../apps/web/src/components/CountdownSettings';
export type { GameHost, GameClient } from './types';
export { WEB_HOST_VERSION } from './types';
export { ScreenLink } from '../../../apps/web/src/components/ScreenLink';
export { OverlayPanel } from '../../../apps/web/src/components/OverlayPanel';
export { FullscreenControl } from '../../../apps/web/src/components/FullscreenControl';
export { DisplaySettings } from '../../../apps/web/src/components/DisplaySettings';
export { PlayModeBadge } from '../../../apps/web/src/components/PlayModeBadge';
export { DecisionCountdown } from '../../../apps/web/src/components/DecisionCountdown';
export { RulesGuide } from '../../../apps/web/src/components/RulesGuide';
export { useDecisionClock } from '../../../apps/web/src/components/useDecisionClock';
export { BeginnerGuidanceSetting } from '../../../apps/web/src/components/BeginnerGuidanceSetting';
export { useGuidancePreference } from '../../../apps/web/src/session/useGuidancePreference';
export { useAudioOutput } from '../../../apps/web/src/session/useAudioOutput';
export { avatarFor, avatarChoices } from '../../../apps/web/src/assets/avatars';
export {
  Management as PlatformRoomManagement,
  Feedback as PlatformSessionFeedback,
  Mode as PlatformPlayModeControl,
  Settings as PlatformCountdownSettings,
};

const Context = createContext<RoomSession | null>(null);
function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error('Game host is not mounted');
  return session;
}
export function RoomManagement({
  lifecycleLabel,
}: {
  session?: GameHost;
  lifecycleLabel?: string;
}) {
  return (
    <Management
      session={useSession()}
      {...(lifecycleLabel ? { lifecycleLabel } : {})}
    />
  );
}
export function SessionFeedback(props: { session?: GameHost }) {
  void props;
  return <Feedback session={useSession()} />;
}
export function PlayModeControl(props: { session?: GameHost }) {
  void props;
  return <Mode session={useSession()} />;
}
export function CountdownSettings({
  children,
}: {
  session?: GameHost;
  children?: ReactNode;
}) {
  return <Settings session={useSession()}>{children}</Settings>;
}
export function claimAudioEvent(key: string) {
  return window.tablemaxAudio?.claimEvent(key) ?? true;
}
export function HostedGame({
  session,
  client,
}: {
  session: RoomSession;
  client: GameClient;
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
    admissionPending: session.admissionPending,
    awaitingConfirmation: session.awaitingConfirmation,
    feedback: session.feedback,
    errorId: session.errorId,
    motion: session.motion,
    command(value) {
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
    <Context.Provider value={session}>
      <Screen session={host} />
    </Context.Provider>
  );
}
