import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { HostedGame } from '../../../packages/web-host/src';
import type { RoomSession } from '../../../apps/web/src/session/useRoomSession';
import { client } from '../../../games/pokemon-encounters/expansion/web';
import '../../../apps/web/src/styles.css';

type Role = 'host' | 'public' | 'player';
type Fixture = { views: Record<Role, RoomSession['view']> };
declare global {
  interface Window {
    awardsShow(name: string, role: Role): void;
    awardsCommands: unknown[];
  }
}
const fixtures: Record<string, Fixture> = await fetch('/fixtures.json').then(
  (response) => response.json(),
);
const root = createRoot(document.getElementById('root')!);
window.awardsCommands = [];
window.awardsShow = (name, role) => {
  const view = fixtures[name]!.views[role]!;
  const session = {
    role,
    view,
    connected: true,
    locked: false,
    self: role === 'player' ? view.seats[0] : undefined,
    canControl: false,
    isHost: role === 'host',
    name: '',
    message: '',
    admissionPending: false,
    awaitingConfirmation: false,
    busy: false,
    errorId: '',
    credential: null,
    motion: [],
    feedback: null,
    networkInterfaces: [],
    externalJoinUrl: null,
    networkMessage: '',
    command(value: unknown) {
      window.awardsCommands.push(value);
      throw new Error('Settlement display fixture must not issue commands');
    },
    setName() {},
    join() {},
    retry() {},
  } as unknown as RoomSession;
  document.body.className = role === 'player' ? 'player-page' : '';
  flushSync(() =>
    root.render(
      <HostedGame key={`${name}-${role}`} session={session} client={client} />,
    ),
  );
};
