import type { LibraryGame } from './filter';

// Presentation only: these entries never enter the playable server catalog.
// Versions and player counts remain undecided in docs/games/candidates.md.
export const plannedLibraryGames: LibraryGame[] = [
  {
    id: 'grand-austria-hotel',
    name: '奥地利大饭店',
    tags: ['经营', '策略'],
    searchTerms: ['Grand Austria Hotel', '待开发'],
    tagline: '一间饭店，等候下一批客人',
  },
  {
    id: 'dune-imperium',
    name: '沙丘·帝国',
    tags: ['策略', '卡牌'],
    searchTerms: ['Dune Imperium', '沙丘帝国', '待开发'],
    tagline: '沙海之上，新的布局尚待展开',
  },
  {
    id: 'scout',
    name: 'SCOUT',
    tags: ['卡牌'],
    searchTerms: ['Scout', '待开发'],
    tagline: '聚光灯已备好，等待好戏登场',
  },
  {
    id: 'flip-7',
    name: 'Flip 7',
    tags: ['卡牌', '派对'],
    searchTerms: ['Flip7', '待开发'],
    tagline: '下一张翻牌，留给未来的牌局',
  },
].map((game) => ({
  ...game,
  min: null,
  max: null,
  development: true,
  planned: true,
}));
