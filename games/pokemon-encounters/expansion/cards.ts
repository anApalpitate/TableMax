export type Ability =
  | 'mew'
  | 'team-rocket'
  | 'zapdos'
  | 'charizard'
  | 'snorlax'
  | 'mewtwo'
  | 'arceus'
  | 'greninja'
  | 'lucario'
  | 'groudon'
  | 'kyogre'
  | 'rayquaza';
export type Category = {
  categoryId: string;
  name: string;
  value: number | null;
  small: number;
  standard: number;
  ability: Ability | null;
  copy: 'horizontal' | 'vertical' | null;
};
const ordinary = (
  id: string,
  name: string,
  value: number,
  small: number,
  standard: number,
): Category => ({
  categoryId: id,
  name,
  value,
  small,
  standard,
  ability: null,
  copy: null,
});
const special = (
  id: Ability,
  name: string,
  value: number,
  small: number,
  standard: number,
): Category => ({
  categoryId: `special-${id}`,
  name,
  value,
  small,
  standard,
  ability: id,
  copy: null,
});
export const categories: Category[] = [
  ordinary('ordinary--2', '皮卡丘', -2, 3, 4),
  ordinary('ordinary-0', '胖丁', 0, 3, 4),
  ordinary('ordinary-1', '伊布', 1, 4, 6),
  ordinary('ordinary-3', '妙蛙种子', 3, 3, 4),
  ordinary('ordinary-4', '杰尼龟', 4, 5, 7),
  ordinary('ordinary-5', '六尾', 5, 5, 7),
  ordinary('ordinary-6', '呆呆兽', 6, 3, 4),
  ordinary('ordinary-7', '耿鬼', 7, 4, 4),
  ordinary('ordinary-8', '魔墙人偶', 8, 3, 4),
  ordinary('ordinary-9', '大岩蛇', 9, 4, 5),
  ordinary('ordinary-togepi', '波克比', -1, 2, 3),
  ordinary('ordinary-magikarp', '鲤鱼王', 0, 4, 5),
  ordinary('ordinary-piplup', '波加曼', 2, 5, 7),
  ordinary('ordinary-rowlet', '木木枭', 3, 4, 6),
  ordinary('ordinary-psyduck', '可达鸭', 6, 5, 6),
  ordinary('ordinary-garchomp', '烈咬陆鲨', 11, 4, 6),
  ordinary('ordinary-gardevoir', '沙奈朵', 8, 5, 6),
  ordinary('ordinary-dragonite', '快龙', 9, 4, 5),
  ordinary('ordinary-metagross', '巨金怪', 10, 5, 6),
  ordinary('ordinary-mimikyu', '谜拟丘', -2, 3, 3),
  special('mew', '梦幻', 2, 2, 3),
  special('team-rocket', '火箭队', 12, 4, 4),
  special('zapdos', '闪电鸟', 10, 3, 4),
  special('charizard', '喷火龙', 10, 5, 6),
  special('snorlax', '卡比兽', 10, 2, 5),
  {
    categoryId: 'special-ditto',
    name: '百变怪',
    value: null,
    small: 2,
    standard: 2,
    ability: null,
    copy: 'horizontal',
  },
  special('mewtwo', '超梦', 8, 2, 2),
  special('arceus', '阿尔宙斯', 0, 1, 1),
  special('greninja', '甲贺忍蛙', 7, 2, 2),
  special('lucario', '路卡利欧', 10, 3, 5),
  special('groudon', '固拉多', 12, 2, 2),
  special('kyogre', '盖欧卡', 12, 2, 2),
  special('rayquaza', '裂空座', 12, 2, 2),
  {
    categoryId: 'special-zorua',
    name: '索罗亚',
    value: null,
    small: 2,
    standard: 2,
    ability: null,
    copy: 'vertical',
  },
];
const definitions = new Map(categories.map((c) => [c.categoryId, c]));
export const instancesForSeats = (seats: number) => {
  if (!Number.isInteger(seats) || seats < 2 || seats > 6)
    throw new Error('Invalid expansion seats');
  return categories.flatMap((c) =>
    Array.from(
      { length: seats <= 3 ? c.small : c.standard },
      (_, i) => `${c.categoryId}#${String(i + 1).padStart(2, '0')}`,
    ),
  );
};
const instances = new Set(instancesForSeats(6));
export function card(instance: string): Category {
  if (!instances.has(instance)) throw new Error('Invalid expansion card');
  return definitions.get(instance.split('#')[0]!)!;
}
export const numeric = (instance: string) => card(instance).value;
export const abilityText: Record<Ability, string> = {
  mew: '换入对手一张牌，再将所得换入本人。',
  'team-rocket': '抛币：喵喵换入本人；皮卡丘全员同格弃底补牌。',
  zapdos: '选择传牌方向，换入本人后向其他玩家依次接力。',
  charizard: '可私看本人一张暗牌，保持朝下。',
  snorlax: '可交换本人两个不同位置，朝向随牌移动。',
  mewtwo: '私看同一对手两格，再决定与其中一张交换或放弃。',
  arceus: '可把全桌盖回，每人均匀随机翻明一格；每小局一次。',
  greninja: '可把任意一名玩家两格盖回，或盖回并交换。',
  lucario: '可额外取牌一次，所取特殊牌不再触发主动能力。',
  groudon: '可与一名对手交换第三行，朝向随牌移动。',
  kyogre: '可与一名对手交换第二行，朝向随牌移动。',
  rayquaza: '可与一名对手交换第一行，朝向随牌移动。',
};
