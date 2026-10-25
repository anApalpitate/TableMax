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
import { useEffect, useState } from 'react';

// One platform owner advances the native runtime profile. Game clients can
// declare presentation capability but never receive the private bridge.
let displayProfileGeneration = 0;

configureGameHost({
  ScreenLink,
  FullscreenControl,
  // webHost 1 keeps its legacy public role ABI for frozen releases, but the
  // current platform no longer provides a public-screen settings surface.
  DisplaySettings: ({ role }) =>
    role === 'public' ? null : <DisplaySettings {...(role ? { role } : {})} />,
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
  const fixed = client.layout?.contract === 'fixed-v1';
  const [displayError, setDisplayError] = useState(false);
  const [displayAttempt, setDisplayAttempt] = useState(0);
  useEffect(() => {
    const display = window.tablemaxDisplay;
    if (session.role !== 'host' || !display?.setLayoutProfile) return;
    let active = true;
    const generation = ++displayProfileGeneration;
    void display
      .setLayoutProfile(fixed ? 'fixed-host-1280-v1' : 'legacy', generation)
      .then(() => {
        if (active && generation === displayProfileGeneration)
          setDisplayError(false);
      })
      .catch(() => {
        // A replaced page or StrictMode generation cannot change the profile.
        if (!active || generation !== displayProfileGeneration) return;
        setDisplayError(true);
      });
    return () => {
      active = false;
      const reset = ++displayProfileGeneration;
      void display.setLayoutProfile?.('legacy', reset).catch(() => {});
    };
  }, [session.role, fixed, displayAttempt]);
  const ref = session.view?.game?.releaseRef;
  return (
    <>
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
          management: (props) => (
            <RoomManagement session={session} {...props} />
          ),
          feedback: (props) => <SessionFeedback session={session} {...props} />,
          playMode: () => <PlayModeControl session={session} />,
          countdown: (props) => (
            <CountdownSettings session={session} {...props} />
          ),
        }}
      />
      {displayError && (
        <aside className="tablemax-display-error" role="alert">
          显示设置未应用
          <button onClick={() => setDisplayAttempt((value) => value + 1)}>
            重试
          </button>
        </aside>
      )}
    </>
  );
}
