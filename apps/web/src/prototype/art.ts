import landscape from './assets/table-landscape.webp';
import portrait from './assets/table-portrait.webp';
import cover from './assets/game-cover.webp';
import avatar1 from './assets/avatar-1.webp';
import avatar2 from './assets/avatar-2.webp';
import avatar3 from './assets/avatar-3.webp';
import avatar4 from './assets/avatar-4.webp';
import avatar5 from './assets/avatar-5.webp';
import avatar6 from './assets/avatar-6.webp';
import dice from './assets/dice.webp';
import meeple from './assets/meeple.webp';
import cards from './assets/cards.webp';
import chips from './assets/chips.webp';
import waiting from './assets/status-waiting.webp';
import offline from './assets/status-offline.webp';
import recovery from './assets/status-recovery.webp';

export const art = {
  landscape,
  portrait,
  cover,
  dice,
  meeple,
  cards,
  chips,
  waiting,
  offline,
  recovery,
};
const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6];
// Artwork follows the stable seat, never the current display order or authority.
export function avatarFor(id: string) {
  const number = Number(id.slice(1));
  return avatars[
    (Number.isInteger(number) && number > 0 ? number - 1 : 0) % avatars.length
  ]!;
}
