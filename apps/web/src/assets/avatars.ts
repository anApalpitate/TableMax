import avatar1 from './tabletop/avatar-1.webp';
import avatar2 from './tabletop/avatar-2.webp';
import avatar3 from './tabletop/avatar-3.webp';
import avatar4 from './tabletop/avatar-4.webp';
import avatar5 from './tabletop/avatar-5.webp';
import avatar6 from './tabletop/avatar-6.webp';
const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6];
export function avatarFor(id: string) {
  return avatars[
    [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % avatars.length
  ]!;
}
