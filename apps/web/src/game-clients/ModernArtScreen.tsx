import { PlatformGame } from '../session/gameHostAdapter';
import { client as independent } from '../../../../games/modern-art/web';
import type { RoomSession } from '../session/useRoomSession';
export const client = {
  ...independent,
  Screen: ({ session }: { session: RoomSession }) => (
    <PlatformGame session={session} client={independent} />
  ),
};
export default client.Screen;
