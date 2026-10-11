import { PlatformGame } from '../session/gameHostAdapter';
import { client as independent } from '../../../../games/power-grid/web';
import type { RoomSession } from '../session/useRoomSession';
export const client = {
  ...independent,
  Screen: ({ session }: { session: RoomSession }) => (
    <PlatformGame session={session} client={independent} />
  ),
};
export default client.Screen;
