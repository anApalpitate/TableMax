import { GameRegistry } from '@tablemax/platform-core';

// Only descriptors live in the service bundle. Rules and strategy load after
// selection, or while restoring an existing save for that game.
export function createGameRegistry(includeTemplate = false) {
  return new GameRegistry([
    {
      catalog: {
        id: 'pokemon-encounters',
        name: '宝可梦奇遇：皮卡丘和朋友们',
        min: 2,
        max: 6,
      },
      load: () => import('../../../games/pokemon-encounters'),
    },
    {
      catalog: {
        id: 'modern-art',
        name: '现代艺术',
        min: 3,
        max: 5,
        decisionTimer: true,
      },
      load: () => import('../../../games/modern-art'),
    },
    {
      catalog: {
        id: 'power-grid',
        name: '电力公司',
        min: 2,
        max: 6,
        decisionTimer: true,
      },
      load: () => import('../../../games/power-grid'),
    },
    ...(includeTemplate
      ? [
          {
            catalog: {
              id: 'template',
              name: '幸运骰子 · 平台验证游戏',
              min: 2,
              max: 5,
            },
            load: () => import('../../../games/template'),
          },
        ]
      : []),
  ]);
}
