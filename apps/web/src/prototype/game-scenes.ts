// Curated authorized UI views, not a rules engine or hidden-state fixture.
// A back contains no card identity/value. Reveals are new public demo events.
export type GameRole = 'host' | 'player';
export type Tile =
  | { faceUp: false; empty?: true }
  | { faceUp: true; name: string; value: string };
export interface SceneStep {
  id: string;
  title: string;
  actor: 'S1' | 'S2' | 'S3';
  target: 'self' | 'other' | 'source' | 'ability' | 'peek' | 'auto';
  hand?: string;
  hint: string;
}
export interface GameScene {
  id: string;
  name: string;
  steps: SceneStep[];
}
const step = (
  id: string,
  title: string,
  target: SceneStep['target'],
  hint: string,
  actor: SceneStep['actor'] = 'S1',
  hand?: string,
): SceneStep => ({ id, title, actor, target, hint, ...(hand ? { hand } : {}) });
export const scenes: GameScene[] = [
  {
    id: 'initial',
    name: '初始翻牌',
    steps: [
      step('initial', '选择初始明牌', 'self', '只能选一张；不能偷看暗牌。'),
      step(
        'initial-wait',
        '等待其他玩家翻牌',
        'auto',
        '全员完成才开始普通回合。',
      ),
      step(
        'source',
        '选择摸牌来源',
        'source',
        '初始弃牌为空，只能从牌库摸牌。',
      ),
      step(
        'replace',
        '处理已摸牌',
        'self',
        '选择己方替换位或直接弃掉。',
        'S1',
        '普通牌 3',
      ),
    ],
  },
  {
    id: 'normal',
    name: '普通摸牌与替换',
    steps: [
      step(
        'source',
        '选择摸牌来源',
        'source',
        '牌库顶或最新弃牌顶；摸到的牌公开。',
      ),
      step(
        'replace',
        '处理已摸牌',
        'self',
        '牌库普通牌可直接弃；弃牌取牌必须替换。',
        'S1',
        '普通牌 3',
      ),
    ],
  },
  {
    id: 'mew',
    name: '梦幻：两次替换',
    steps: [
      step(
        'mew-other',
        '梦幻：选择其他玩家的牌',
        'other',
        '明牌与暗牌均可；此步骤只由行动者选。',
        'S1',
        '梦幻 2',
      ),
      step(
        'mew-self',
        '梦幻：选择己方替换位',
        'self',
        '对方全明仍要完成第二次替换，不提前结算。',
        'S1',
        '收到的公开牌 4',
      ),
    ],
  },
  {
    id: 'rocket-meowth',
    name: '火箭队：喵喵面',
    steps: [
      step(
        'rocket-m',
        '火箭队：喵喵面已保存',
        'self',
        '先有币面，再替换己方一张，旧牌置顶。',
        'S1',
        '火箭队 12',
      ),
    ],
  },
  {
    id: 'rocket-pikachu',
    name: '火箭队：皮卡丘面',
    steps: [
      step(
        'rocket-p',
        '火箭队：皮卡丘面已保存',
        'self',
        '选择一个位置，全员同位置牌弃底。',
        'S1',
        '火箭队 12',
      ),
      step(
        'refill-s1',
        '正在补位：S1',
        'auto',
        '从行动者开始顺时针补位，补入能力牌不触发。',
      ),
      step(
        'refill-s2',
        '正在补位：S2',
        'auto',
        'S1 已全明仍继续补齐所有玩家。',
      ),
      step(
        'refill-s3',
        '正在补位：S3',
        'auto',
        '最后一个空位补齐后才检查结束。',
      ),
    ],
  },
  {
    id: 'zapdos',
    name: '闪电鸟：完整传牌',
    steps: [
      step(
        'zapdos-self',
        '闪电鸟：选择己方替换位',
        'self',
        '换出牌传给下一座位，正常回合行动者保持 S1。',
        'S1',
        '闪电鸟 10',
      ),
      step(
        'receive-s2',
        '闪电鸟：S2 接牌选位',
        'self',
        '只有 S2 手机选位，其余玩家等待。',
        'S2',
        '传递中的公开牌 5',
      ),
      step(
        'receive-s3',
        '闪电鸟：S3 接牌选位',
        'self',
        '最后换出牌弃底，之后才检查结束。',
        'S3',
        '传递中的公开牌 6',
      ),
    ],
  },
  {
    id: 'snorlax',
    name: '卡比兽：可选交换',
    steps: [
      step(
        'swap',
        '卡比兽：交换两格或不发动',
        'ability',
        '选择两个不同位置；原有正反面保持。',
        'S1',
        '已换入卡比兽 10',
      ),
    ],
  },
  {
    id: 'charizard',
    name: '喷火龙：己方临时查看',
    steps: [
      step(
        'peek-select',
        '喷火龙：查看己方一张暗牌',
        'peek',
        '可以不发动；查看不改变暗牌朝向。',
        'S1',
        '已换入喷火龙 10',
      ),
      step(
        'peek-view',
        '喷火龙：确认查看结束',
        'peek',
        '只有本人临时看到，关闭后不持续展示。',
      ),
    ],
  },
  {
    id: 'charizard-empty',
    name: '喷火龙：无暗牌',
    steps: [
      step(
        'no-target',
        '无合法暗牌，自动跳过查看',
        'auto',
        '能力完成后检查六牌全明并结算。',
      ),
    ],
  },
  { id: 'result', name: '百变怪、配对与共同赢家', steps: [] },
];
export function publicTiles(allUp = false): Tile[] {
  return Array.from({ length: 6 }, (_, index) =>
    index === 0 || allUp
      ? {
          faceUp: true,
          name: '普通牌',
          value: String([1, 5, 9, 0, 5, 4][index]),
        }
      : { faceUp: false },
  );
}

export function sceneBoards(id: string): Record<string, Tile[]> {
  const boards = {
    S1: publicTiles(id === 'charizard-empty'),
    S2: publicTiles(),
    S3: publicTiles(),
  };
  if (id === 'initial')
    for (const owner of ['S1', 'S2', 'S3'] as const)
      boards[owner] = Array.from({ length: 6 }, () => ({ faceUp: false }));
  if (['zapdos', 'rocket-meowth', 'rocket-pikachu'].includes(id))
    boards.S1 = publicTiles(true).map((tile, i) =>
      i === 5 ? { faceUp: false } : tile,
    );
  if (id === 'mew')
    boards.S2 = publicTiles(true).map((tile, i) =>
      i === 5 ? { faceUp: false } : tile,
    );
  if (id === 'snorlax' || id.startsWith('charizard'))
    boards.S1[0] = {
      faceUp: true,
      name: id === 'snorlax' ? '卡比兽' : '喷火龙',
      value: '10',
    };
  return boards;
}
