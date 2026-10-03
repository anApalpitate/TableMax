import type { PublicAction } from '../../../packages/protocol/src';
import { categories } from '../rules/cards';

export function cardName(category: string | null) {
  return (
    categories
      .find((card) => card.categoryId === category)
      ?.displayName.replace('外观', '') ?? '卡牌'
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
  const targetDetails = action.targets.map(({ seat, slots }) => {
    const name = names[seat] ?? '玩家';
    const positions = slots.map((slot) => slot + 1).join('、');
    return {
      seat,
      name,
      slots: [...slots],
      slotsLabel: positions ? `${positions}号位` : '',
      label: `${name}${positions ? ` ${positions} 号位` : ''}`,
    };
  });
  const targets = targetDetails.map(({ label }) => label);
  let operation: string;
  let subject: string | null = card;
  let abilityLabel: string | null =
    action.ability && action.ability !== action.cardCategory ? ability : null;
  let sourceLabel: string | null = null;
  let note: string | null = null;
  let publicTargets = targets;
  switch (action.verb) {
    case 'initial-flip':
      operation = '翻开初始牌';
      break;
    case 'draw':
      operation = '取牌';
      sourceLabel = action.source === 'discard' ? '弃牌顶' : '牌库';
      break;
    case 'replace':
      operation = '换入';
      break;
    case 'discard':
      operation = '弃掉';
      note = '放到弃牌顶';
      break;
    case 'mew-target':
      operation = '交换朋友的牌';
      subject = '梦幻';
      abilityLabel = null;
      break;
    case 'rocket-refill':
      operation = '全员同位换牌';
      subject = '火箭队';
      abilityLabel = null;
      break;
    case 'zapdos-pass':
      operation = '接牌与传递';
      abilityLabel = card === '闪电鸟' ? null : '闪电鸟';
      break;
    case 'swap':
      operation = '交换两个位置';
      subject = '卡比兽';
      abilityLabel = null;
      break;
    case 'peek':
      operation = '查看本人暗牌';
      subject = '喷火龙';
      abilityLabel = null;
      note = '仅本人可见';
      publicTargets = [];
      break;
    case 'close-peek':
      operation = '结束查看';
      subject = '喷火龙';
      abilityLabel = null;
      note = '原牌保持朝下';
      publicTargets = [];
      break;
    case 'decline':
      operation = '放弃能力';
      subject = ability;
      abilityLabel = null;
      publicTargets = [];
      break;
    case 'deal':
      operation = '新小局已发牌';
      subject = null;
      abilityLabel = null;
      note = '请选择初始翻牌';
      break;
    case 'round-result':
      operation = '本小局已结算';
      subject = null;
      abilityLabel = null;
      break;
    default:
      operation = '完成操作';
      subject = null;
      abilityLabel = null;
      publicTargets = [];
      break;
  }
  const title = `${operation}${subject ? ` ${subject}` : ''}`;
  const detail = [
    sourceLabel ? `从${sourceLabel}取牌` : null,
    abilityLabel ? `${abilityLabel}能力` : null,
    ...publicTargets,
    note,
  ]
    .filter(Boolean)
    .join('，');
  return {
    actor,
    title,
    detail,
    operation,
    subject,
    abilityLabel,
    sourceLabel,
    targets: publicTargets,
    targetDetails: publicTargets.length ? targetDetails : [],
    note,
    cardCategory: action.ability ?? action.cardCategory,
  };
}

/** A short label must describe exactly the committed targets, never inferred seats. */
export function tableTargetSummary(
  targets: ReturnType<typeof presentAction>['targetDetails'],
  seats: readonly string[],
) {
  const first = targets[0];
  if (
    !first ||
    !first.slots.length ||
    targets.length !== seats.length ||
    new Set(targets.map(({ seat }) => seat)).size !== seats.length ||
    !seats.every((seat) => targets.some((target) => target.seat === seat))
  )
    return null;
  const positions = JSON.stringify([...first.slots].sort((a, b) => a - b));
  if (
    !targets.every(
      ({ slots }) =>
        JSON.stringify([...slots].sort((a, b) => a - b)) === positions,
    )
  )
    return null;
  return {
    name: '全员',
    slotsLabel: first.slotsLabel,
    label: targets.map(({ label }) => label).join('；'),
  };
}
