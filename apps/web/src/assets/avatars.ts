import avatar1 from '../../../../assets/platform/avatar-1.webp';
import avatar2 from '../../../../assets/platform/avatar-2.webp';
import avatar3 from '../../../../assets/platform/avatar-3.webp';
import avatar4 from '../../../../assets/platform/avatar-4.webp';
import avatar5 from '../../../../assets/platform/avatar-5.webp';
import avatar6 from '../../../../assets/platform/avatar-6.webp';
const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6];
export function avatarFor(id: string) {
  return avatars[
    [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % avatars.length
  ]!;
}
