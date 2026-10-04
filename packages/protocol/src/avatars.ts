import { z } from 'zod';

// Stable public IDs; artwork can be replaced without changing saved identity.
export const AVATAR_PRESETS = [
  { id: 'avatar-1', name: '青绿熊' },
  { id: 'avatar-2', name: '珊瑚狐' },
  { id: 'avatar-3', name: '金兔' },
  { id: 'avatar-4', name: '猫头鹰' },
  { id: 'avatar-5', name: '企鹅' },
  { id: 'avatar-6', name: '小猫' },
  { id: 'avatar-7', name: '考拉' },
  { id: 'avatar-8', name: '熊猫' },
  { id: 'avatar-9', name: '浣熊' },
  { id: 'avatar-10', name: '小鹿' },
  { id: 'avatar-11', name: '松鼠' },
  { id: 'avatar-12', name: '水獭' },
  { id: 'avatar-13', name: '小狗' },
  { id: 'avatar-14', name: '刺猬' },
  { id: 'avatar-15', name: '小象' },
  { id: 'avatar-16', name: '河马' },
  { id: 'avatar-17', name: '狮子' },
  { id: 'avatar-18', name: '老虎' },
  { id: 'avatar-19', name: '小猪' },
  { id: 'avatar-20', name: '小羊' },
  { id: 'avatar-21', name: '小牛' },
  { id: 'avatar-22', name: '小马' },
  { id: 'avatar-23', name: '乌龟' },
  { id: 'avatar-24', name: '青蛙' },
  { id: 'avatar-25', name: '小鸭' },
  { id: 'avatar-26', name: '海豹' },
] as const;
export type PresetAvatarId = (typeof AVATAR_PRESETS)[number]['id'];
export type AvatarId = PresetAvatarId | `custom-${string}`;
export const PresetAvatarIdSchema = z.enum(
  AVATAR_PRESETS.map((preset) => preset.id),
);
export const CustomAvatarIdSchema = z
  .string()
  .regex(/^custom-[0-9a-f]{64}$/)
  .transform((id) => id as `custom-${string}`);
export const AvatarIdSchema = z.union([
  PresetAvatarIdSchema,
  CustomAvatarIdSchema,
]);
export const AvatarImageSchema = z
  .string()
  .min(1)
  .max(700_000)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/);
