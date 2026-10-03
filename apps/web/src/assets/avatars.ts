import { AVATAR_PRESETS } from '@tablemax/protocol';

const images = import.meta.glob<string>(
  '../../../../assets/platform/avatar-*.webp',
  { eager: true, query: '?url', import: 'default' },
);
export function avatarFor(id: string) {
  return images[`../../../../assets/platform/${id}.webp`] ?? '';
}
export const avatarChoices = AVATAR_PRESETS.map((avatar) => ({
  ...avatar,
  src: avatarFor(avatar.id),
}));
