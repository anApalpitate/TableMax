import landscape from '../../../../assets/platform/table-landscape.webp';
import portrait from '../../../../assets/platform/table-portrait.webp';
import cover from '../../../../assets/platform/game-cover.webp';
import avatar1 from '../../../../assets/platform/avatar-1.webp';
import avatar2 from '../../../../assets/platform/avatar-2.webp';
import avatar3 from '../../../../assets/platform/avatar-3.webp';
import avatar4 from '../../../../assets/platform/avatar-4.webp';
import avatar5 from '../../../../assets/platform/avatar-5.webp';
import avatar6 from '../../../../assets/platform/avatar-6.webp';
import dice from '../../../../assets/platform/dice.webp';
import meeple from '../../../../assets/platform/meeple.webp';
import cards from '../../../../assets/platform/cards.webp';
import chips from '../../../../assets/platform/chips.webp';
import waiting from '../../../../assets/platform/status-waiting.webp';
import offline from '../../../../assets/platform/status-offline.webp';
import recovery from '../../../../assets/platform/status-recovery.webp';

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
