import type { Role, Variant } from './types';

export const CONFIGURED_RULES_VERSION = 'classic-2012-configured-1';
export const ROLE_NAMES: Record<Role, string> = {
  merlin: '梅林',
  percival: '派西维尔',
  servant: '亚瑟的忠臣',
  morgana: '莫甘娜',
  assassin: '刺客',
  minion: '爪牙',
  mordred: '莫德雷德',
  oberon: '奥伯伦',
};
export const PLAYER_SETUPS: Readonly<
  Record<
    number,
    {
      servants: number;
      evil: readonly Role[];
      quests: readonly number[];
    }
  >
> = {
  5: { servants: 1, evil: ['morgana', 'assassin'], quests: [2, 3, 2, 3, 3] },
  6: { servants: 2, evil: ['morgana', 'assassin'], quests: [2, 3, 4, 3, 4] },
  7: {
    servants: 2,
    evil: ['morgana', 'assassin', 'oberon'],
    quests: [2, 3, 3, 4, 4],
  },
  8: {
    servants: 3,
    evil: ['morgana', 'assassin', 'minion'],
    quests: [3, 4, 4, 5, 5],
  },
  9: {
    servants: 4,
    evil: ['morgana', 'assassin', 'mordred'],
    quests: [3, 4, 4, 5, 5],
  },
  10: {
    servants: 4,
    evil: ['morgana', 'assassin', 'mordred', 'oberon'],
    quests: [3, 4, 4, 5, 5],
  },
};
export function playerSetup(count: number) {
  const setup = PLAYER_SETUPS[count];
  if (!setup) throw new Error('阿瓦隆需要 5–10 位玩家。');
  return setup;
}
export function configuredRoles(count: number): Role[] {
  const setup = playerSetup(count);
  return [
    'merlin',
    'percival',
    ...Array<Role>(setup.servants).fill('servant'),
    ...setup.evil,
  ];
}
export function rulesVersionFor(variant: Variant): string {
  return variant === 'configured'
    ? CONFIGURED_RULES_VERSION
    : variant === 'court'
      ? 'classic-2012-court-1'
      : 'classic-2012-1';
}
