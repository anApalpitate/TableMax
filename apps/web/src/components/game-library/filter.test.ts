import { expect, it } from 'vitest';
import {
  availableLibraryTags,
  filterLibraryGames,
  type LibraryGame,
} from './filter';

const games: LibraryGame[] = [
  {
    id: 'pokemon-encounters',
    name: '宝可梦奇遇',
    min: 2,
    max: 6,
    tags: ['冒险', '收集'],
    searchTerms: ['ＰＯＫＥＭＯＮ'],
    tagline: '捕捉伙伴，在岛屿旅行中完成收集',
    development: false,
  },
  {
    id: 'modern-art',
    name: '现代艺术',
    min: 3,
    max: 5,
    tags: ['拍卖', '经济'],
    searchTerms: ['Modern Art'],
    tagline: '竞拍画作，判断市场行情',
    development: false,
  },
  {
    id: 'power-grid',
    name: '电力公司',
    min: 2,
    max: 6,
    tags: ['经济', '策略'],
    searchTerms: ['Power Grid', '经典德国'],
    tagline: '拍卖电厂，规划供电网络',
    development: false,
  },
  {
    id: 'rummikub',
    name: '拉密',
    min: 2,
    max: 4,
    tags: ['益智', '数字'],
    searchTerms: ['Rummikub', '麻将牌'],
    tagline: '重组数字组合，率先打出所有手牌',
    development: true,
  },
  {
    id: 'uno',
    name: 'UNO',
    min: 2,
    max: 6,
    tags: ['派对', '卡牌'],
    searchTerms: ['优诺'],
    tagline: '匹配颜色数字，轻松开玩',
    development: false,
  },
];

const unfiltered = { query: '', tag: null, players: null };
const ids = (items: readonly LibraryGame[]) => items.map((game) => game.id);

it.each([
  ['宝可梦', ['pokemon-encounters']],
  ['modern-art', ['modern-art']],
  ['pokemon', ['pokemon-encounters']],
  ['  UnO  ', ['uno']],
  ['ＰＯＷＥＲ　ＧＲＩＤ', ['power-grid']],
  ['策略 POWER', ['power-grid']],
  ['重组\n数字\t手牌', ['rummikub']],
  ['经济', ['modern-art', 'power-grid']],
  ['优诺', ['uno']],
])(
  'searches names, IDs, aliases, tags and taglines for %s',
  (query, expected) => {
    expect(ids(filterLibraryGames(games, { ...unfiltered, query }))).toEqual(
      expected,
    );
  },
);

it('requires every search word even when words match different fields', () => {
  expect(
    ids(filterLibraryGames(games, { ...unfiltered, query: 'POWER 拍卖' })),
  ).toEqual(['power-grid']);
  expect(
    filterLibraryGames(games, { ...unfiltered, query: 'POWER 卡牌' }),
  ).toEqual([]);
});

it('combines query, exact category and player count without hiding development games', () => {
  expect(
    ids(
      filterLibraryGames(games, {
        query: '经典',
        tag: '经济',
        players: 6,
      }),
    ),
  ).toEqual(['power-grid']);
  expect(
    ids(
      filterLibraryGames(games, {
        query: '数字',
        tag: '益智',
        players: 4,
      }),
    ),
  ).toEqual(['rummikub']);
  expect(
    filterLibraryGames(games, {
      query: '数字',
      tag: '益智',
      players: 5,
    }),
  ).toEqual([]);
});

it.each([
  [1, []],
  [2, ['pokemon-encounters', 'power-grid', 'rummikub', 'uno']],
  [3, ['pokemon-encounters', 'modern-art', 'power-grid', 'rummikub', 'uno']],
  [4, ['pokemon-encounters', 'modern-art', 'power-grid', 'rummikub', 'uno']],
  [5, ['pokemon-encounters', 'modern-art', 'power-grid', 'uno']],
  [6, ['pokemon-encounters', 'power-grid', 'uno']],
  [7, []],
])(
  'includes both player-count boundaries for %i players',
  (players, expected) => {
    expect(ids(filterLibraryGames(games, { ...unfiltered, players }))).toEqual(
      expected,
    );
  },
);

it('matches only the complete registered category', () => {
  expect(
    ids(filterLibraryGames(games, { ...unfiltered, tag: '经济' })),
  ).toEqual(['modern-art', 'power-grid']);
  expect(filterLibraryGames(games, { ...unfiltered, tag: '经' })).toEqual([]);
  expect(
    filterLibraryGames(games, { ...unfiltered, tag: '未登记分类' }),
  ).toEqual([]);
});

it('returns an empty result for unmatched queries and an empty catalog', () => {
  expect(
    filterLibraryGames(games, { ...unfiltered, query: '没有这样的游戏' }),
  ).toEqual([]);
  expect(filterLibraryGames([], unfiltered)).toEqual([]);
  expect(availableLibraryTags([])).toEqual([]);
});

it('preserves catalog order and object identities while leaving inputs unchanged', () => {
  const input = structuredClone(games);
  const before = structuredClone(input);
  for (const game of input) {
    Object.freeze(game.tags);
    Object.freeze(game.searchTerms);
    Object.freeze(game);
  }
  Object.freeze(input);
  const filters = Object.freeze({ ...unfiltered, query: ' \t\n　' });
  const result = filterLibraryGames(input, filters);
  expect(result).toEqual(before);
  expect(ids(result)).toEqual(ids(input));
  result.forEach((game, index) => expect(game).toBe(input[index]));
  expect(ids(filterLibraryGames(input, { ...filters, players: 6 }))).toEqual([
    'pokemon-encounters',
    'power-grid',
    'uno',
  ]);
  expect(availableLibraryTags(input)).toEqual([
    '冒险',
    '收集',
    '拍卖',
    '经济',
    '策略',
    '益智',
    '数字',
    '派对',
    '卡牌',
  ]);
  expect(input).toEqual(before);
  expect(filters).toEqual({ ...unfiltered, query: ' \t\n　' });
});

it('deduplicates categories in their first registered order', () => {
  const duplicateTags = [
    { ...games[0]!, tags: ['策略', '策略', '经济'] },
    { ...games[1]!, tags: ['经济', '拍卖', '策略'] },
  ];
  expect(availableLibraryTags(duplicateTags)).toEqual(['策略', '经济', '拍卖']);
});
