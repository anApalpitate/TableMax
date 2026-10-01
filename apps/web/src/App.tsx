import { SavedMotion } from '../../../games/pokemon-encounters/ui/motion';
import { useScreenRoute } from './navigation';
import { useRoomSession } from './session/useRoomSession';
import { BoxScreen } from './screens/BoxScreen';
import { GameScreen } from './screens/GameScreen';
import type { ScreenRole } from './navigation';

function RoomApp({ role, inGame }: { role: ScreenRole; inGame: boolean }) {
  const session = useRoomSession(role);
  return (
    <SavedMotion.Provider value={session.motion}>
      {inGame ? (
        <GameScreen session={session} />
      ) : (
        <BoxScreen session={session} />
      )}
    </SavedMotion.Provider>
  );
}

export function App() {
  const route = useScreenRoute();
  return <RoomApp key={route.role} {...route} />;
}
