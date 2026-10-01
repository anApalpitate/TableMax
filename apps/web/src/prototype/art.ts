import landscape from '../assets/tabletop/table-landscape.webp';
import portrait from '../assets/tabletop/table-portrait.webp';
import cover from '../assets/tabletop/game-cover.webp';
import avatar1 from '../assets/tabletop/avatar-1.webp';
import avatar2 from '../assets/tabletop/avatar-2.webp';
import avatar3 from '../assets/tabletop/avatar-3.webp';
import avatar4 from '../assets/tabletop/avatar-4.webp';
import avatar5 from '../assets/tabletop/avatar-5.webp';
import avatar6 from '../assets/tabletop/avatar-6.webp';
import dice from '../assets/tabletop/dice.webp';
import meeple from '../assets/tabletop/meeple.webp';
import cards from '../assets/tabletop/cards.webp';
import chips from '../assets/tabletop/chips.webp';
import waiting from '../assets/tabletop/status-waiting.webp';
import offline from '../assets/tabletop/status-offline.webp';
import recovery from '../assets/tabletop/status-recovery.webp';

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
