import { useGameClient } from './game-clients/registry';
import { useEffect } from 'react';
import { navigate, useScreenRoute } from './navigation';
import { useRoomSession } from './session/useRoomSession';
import { BoxScreen } from './screens/BoxScreen';
import { GameScreen } from './screens/GameScreen';
import type { ScreenRole } from './navigation';
import { PlayerFrame } from './components/PlayerFrame';
import { InteractionLayer } from './interactions/InteractionLayer';
import { screenAccess } from './session/screen-access';
import { ManagementEntry } from './components/ManagementEntry';

function RoomApp({ role, inGame }: { role: ScreenRole; inGame: boolean }) {
  const session = useRoomSession(role);
  const access = screenAccess(role, session.view);
  const gameClient = useGameClient(
    inGame && access.game ? session.view?.game?.id : undefined,
    session.view?.game?.variantId,
    session.view?.game?.releaseRef,
  );
  useEffect(() => {
    if (role === 'player' && inGame && session.view && !access.game)
      navigate('/player', true);
  }, [role, inGame, session.view, access.game]);
  if (role === 'host' && !access.management)
    return <ManagementEntry waiting={!session.view && !session.message} />;
  return (
    <div
      className="room-root"
      data-room-revision={session.view?.revision}
      data-room-instance={session.view?.instanceId}
      data-room-branch={session.view?.branch}
    >
      {inGame && access.game ? (
        <GameScreen
          key={`${session.view?.game?.id}:${session.view?.game?.variantId}:${session.view?.instanceId}`}
          session={session}
          {...gameClient}
        />
      ) : (
        <BoxScreen session={session} />
      )}
      <InteractionLayer session={session} />
    </div>
  );
}

export function App() {
  const route = useScreenRoute();
  if (!route)
    return (
      <main className="shell game-loading management-entry">
        <h1>页面不可用</h1>
        <p>此网址已停用或不存在。</p>
        <a className="button" href="/">
          进入玩家端
        </a>
      </main>
    );
  // Only the inner document owns a player session. Keeping this iframe mounted
  // at every display size preserves the game component's local drafts.
  if (route.role === 'player' && window.self === window.top)
    return <PlayerFrame initialUrl={window.location.href} />;
  return <RoomApp key={route.role} {...route} />;
}
