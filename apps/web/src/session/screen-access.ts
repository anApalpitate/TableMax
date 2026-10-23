import type { RoomView } from '@tablemax/protocol';
import type { ScreenRole } from '../navigation';

// A URL or locally stored token is not proof of identity. Only the server's
// authenticated projection enables the management tree or a player's game.
export function screenAccess(role: ScreenRole, view: RoomView | null) {
  return {
    management: role === 'host' && view?.self.role === 'host',
    game:
      (role === 'host' && view?.self.role === 'host') ||
      (role === 'player' && view?.self.role === 'player'),
  };
}
