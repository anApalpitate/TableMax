import { useGameClient } from './game-clients/registry';
import { useScreenRoute } from './navigation';
import { useRoomSession } from './session/useRoomSession';
import { BoxScreen } from './screens/BoxScreen';
import { GameScreen } from './screens/GameScreen';
import type { ScreenRole } from './navigation';

function RoomApp({ role, inGame }: { role: ScreenRole; inGame: boolean }) {
  const session = useRoomSession(role);
  const gameClient = useGameClient(session.view?.game?.id);
  return (
    <>
      {inGame ? (
        <GameScreen session={session} {...gameClient} />
      ) : (
        <BoxScreen session={session} />
      )}
    </>
  );
}

export function App() {
  const route = useScreenRoute();
  return <RoomApp key={route.role} {...route} />;
}
