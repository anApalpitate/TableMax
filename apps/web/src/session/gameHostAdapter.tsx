import { HostedGame, type GameClient } from '@tablemax/web-host';
import { configureGameHost } from '@tablemax/web-host/platform';
import { ScreenLink } from '../components/ScreenLink';
import { FullscreenControl } from '../components/FullscreenControl';
import { DisplaySettings } from '../components/DisplaySettings';
import { RoomManagement } from '../components/RoomManagement';
import { SessionFeedback } from '../components/SessionFeedback';
import { PlayModeControl } from '../components/PlayModeControl';
import { CountdownSettings } from '../components/CountdownSettings';
import { useAudioOutput } from './useAudioOutput';
import { avatarFor, avatarChoices } from '../assets/avatars';
import type { RoomSession } from './useRoomSession';

configureGameHost({
  ScreenLink,
  FullscreenControl,
  DisplaySettings,
  useAudioOutput,
  avatarFor,
  avatarChoices,
  claimAudioEvent: (key) => window.tablemaxAudio?.claimEvent(key) ?? true,
});

/** The only platform session adapter. No private capability enters the game. */
export function PlatformGame({
  session,
  client,
}: {
  session: RoomSession;
  client: GameClient;
}) {
  const ref = session.view?.game?.releaseRef;
  return (
    <HostedGame
      session={session}
      client={client}
      {...(ref
        ? {
            resourceUrl: (id: string) =>
              `/game-packages/${ref}/resources/${id.split('/').map(encodeURIComponent).join('/')}`,
          }
        : {})}
      presentation={{
        management: (props) => <RoomManagement session={session} {...props} />,
        feedback: (props) => <SessionFeedback session={session} {...props} />,
        playMode: () => <PlayModeControl session={session} />,
        countdown: (props) => (
          <CountdownSettings session={session} {...props} />
        ),
      }}
    />
  );
}
