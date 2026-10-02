import type { PublicAction } from '../../../packages/protocol/src';
import { categories } from '../rules/cards';

export function cardName(category: string | null) {
  return (
    categories.find((card) => card.categoryId === category)?.displayName ??
    '卡牌'
  );
}

/** Uses only the committed public action, never a player's peek or hidden board. */
export function presentAction(
  action: PublicAction,
  names: Record<string, string>,
) {
  const actor = action.actor ? (names[action.actor] ?? '玩家') : '房主';
  const card = cardName(action.cardCategory);
  const ability = cardName(action.ability);
  const targets = action.targets.map(
    ({ seat, slots }) =>
      `${names[seat] ?? '玩家'}${slots.length ? ` · ${slots.map((slot) => slot + 1).join('、')} 号位` : ''}`,
  );
  let title: string;
  let detail = targets.join('；');
  switch (action.verb) {
    case 'initial-flip':
      title = `翻开初始牌 · ${card}`;
      break;
    case 'draw':
      title = `取牌 · ${card}`;
      detail = `从${action.source === 'discard' ? '弃牌顶' : '牌库'}取牌${action.ability ? ` · ${ability}能力` : ''}`;
      break;
    case 'replace':
      title = `换入 · ${card}${action.ability && action.ability !== action.cardCategory ? `（${ability}）` : ''}`;
      break;
    case 'discard':
      title = `弃掉 · ${card}`;
      detail = '已放到弃牌顶';
      break;
    case 'mew-target':
      title = '梦幻 · 与朋友交换卡牌';
      break;
    case 'rocket-refill':
      title = '火箭队 · 全员同位换牌';
      break;
    case 'zapdos-pass':
      title = `闪电鸟 · 接牌与传递（${card}）`;
      break;
    case 'swap':
      title = '卡比兽 · 交换两个位置';
      break;
    case 'peek':
      title = '喷火龙 · 查看本人暗牌';
      detail = '查看内容仅本人可见';
      break;
    case 'close-peek':
      title = '喷火龙 · 已结束查看';
      detail = '查看权限已关闭，原牌仍朝下';
      break;
    case 'decline':
      title = `${ability} · 放弃发动`;
      detail = '本次能力选择已完成';
      break;
    case 'deal':
      title = '新小局已发牌';
      detail = '各位玩家选择初始翻牌';
      break;
    case 'round-result':
      title = '本小局已结算';
      break;
  }
  return {
    actor,
    title,
    detail,
    cardCategory: action.ability ?? action.cardCategory,
  };
}
