import { HostedGame } from '@tablemax/web-host';
import { client as independent } from '../../../../games/pokemon-encounters/web';
import type { RoomSession } from '../session/useRoomSession';
export const client = {
  ...independent,
  Screen: ({ session }: { session: RoomSession }) => (
    <HostedGame session={session} client={independent} />
  ),
};
export default client.Screen;
