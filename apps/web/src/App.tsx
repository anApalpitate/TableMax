import { useGameClient } from './game-clients/registry';
import { useScreenRoute } from './navigation';
import { useRoomSession } from './session/useRoomSession';
import { BoxScreen } from './screens/BoxScreen';
import { GameScreen } from './screens/GameScreen';
import type { ScreenRole } from './navigation';
import { PlayerFrame } from './components/PlayerFrame';

function RoomApp({ role, inGame }: { role: ScreenRole; inGame: boolean }) {
  const session = useRoomSession(role);
  const gameClient = useGameClient(
    inGame ? session.view?.game?.id : undefined,
    session.view?.game?.variantId,
  );
  return (
    <div
      className="room-root"
      data-room-revision={session.view?.revision}
      data-room-instance={session.view?.instanceId}
      data-room-branch={session.view?.branch}
    >
      {inGame ? (
        <GameScreen
          key={`${session.view?.game?.id}:${session.view?.game?.variantId}:${session.view?.instanceId}`}
          session={session}
          {...gameClient}
        />
      ) : (
        <BoxScreen session={session} />
      )}
    </div>
  );
}

export function App() {
  const route = useScreenRoute();
  // Only the inner document owns a player session. Keeping this iframe mounted
  // at every display size preserves the game component's local drafts.
  if (route.role === 'player' && window.self === window.top)
    return <PlayerFrame initialUrl={window.location.href} />;
  return <RoomApp key={route.role} {...route} />;
}
