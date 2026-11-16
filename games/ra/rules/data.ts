export const rulesVersion = '25cg-retail3-base-v1';
export const auctionSlots = 8;
export const limits = { 2: 6, 3: 8, 4: 9, 5: 10 } as const;
export const startingDisks = {
  2: [
    [9, 6, 5, 2],
    [8, 7, 4, 3],
  ],
  3: [
    [13, 8, 5, 2],
    [12, 9, 6, 3],
    [11, 10, 7, 4],
  ],
  4: [
    [13, 6, 2],
    [12, 7, 3],
    [11, 8, 4],
    [10, 9, 5],
  ],
  5: [
    [16, 7, 2],
    [15, 8, 3],
    [14, 9, 4],
    [13, 10, 5],
    [12, 11, 6],
  ],
} as const;
export type PlayerCount = keyof typeof limits;

const supply = {
  ra: { ra: 30 },
  god: { god: 8 },
  gold: { gold: 5 },
  pharaoh: { pharaoh: 25 },
  nile: { nile: 25 },
  flood: { flood: 12 },
  civilization: {
    art: 5,
    religion: 5,
    writing: 5,
    agriculture: 5,
    astronomy: 5,
  },
  monument: {
    sphinx: 5,
    pyramid: 5,
    obelisk: 5,
    statue: 5,
    mortuary: 5,
    shrine: 5,
    temple: 5,
    'step-pyramid': 5,
  },
  disaster: { war: 4, earthquake: 2, funeral: 2, drought: 2 },
};
export type Kind = keyof typeof supply;
export type Tile = { id: string; kind: Kind; face: string };
export const tiles = Object.fromEntries(
  (Object.entries(supply) as [Kind, Record<string, number>][]).flatMap(
    ([kind, faces]) =>
      Object.entries(faces).flatMap(([face, count]) =>
        Array.from({ length: count }, (_, index) => {
          const id = `${face}-${index + 1}`;
          return [id, { id, kind, face } satisfies Tile] as const;
        }),
      ),
  ),
);
export const tileIds = Object.keys(tiles);
export const tileNames: Record<string, string> = {
  ra: '拉',
  god: '神明',
  gold: '黄金',
  pharaoh: '法老',
  nile: '尼罗河',
  flood: '洪水',
  art: '艺术',
  religion: '宗教',
  writing: '书写',
  agriculture: '农业',
  astronomy: '天文',
  sphinx: '狮身人面像',
  pyramid: '金字塔',
  obelisk: '方尖碑',
  statue: '雕像',
  mortuary: '陵墓',
  shrine: '圣龛',
  temple: '神庙',
  'step-pyramid': '阶梯金字塔',
  war: '战争',
  earthquake: '地震',
  funeral: '葬礼',
  drought: '旱灾',
};
export function tile(id: string): Tile {
  if (!Object.hasOwn(tiles, id)) throw new Error('未知板块');
  return tiles[id]!;
}
export const persists = (id: string) =>
  ['pharaoh', 'nile', 'monument'].includes(tile(id).kind);
