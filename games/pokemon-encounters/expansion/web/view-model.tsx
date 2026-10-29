import type { GameHost } from '@tablemax/web-host';
import type { View, Face } from '../project';
import type { Action } from '../state';
import { type RulesProfile } from '../research';
import { categories, categoryPresentation } from '../cards';

export const phaseText: Record<View['phase'], string> = {
  'research-vote': '投票选择研究任务',
  'initial-flip': '翻开一张初始牌',
  draw: '选择取牌来源',
  place: '选择放入位置',
  'mew-other': '梦幻：选择对手一张牌',
  'mew-self': '梦幻：换入本人场地',
  'rocket-meowth': '火箭队：选择换入位置',
  'rocket-pikachu': '火箭队：选择同一牌位',
  'zapdos-direction': '闪电鸟：选择传牌方向',
  'zapdos-self': '闪电鸟：选择换入位置',
  'zapdos-receive': '闪电鸟：接力换入',
  'snorlax-choice': '卡比兽：交换本人两张',
  'charizard-choice': '喷火龙：查看一张暗牌',
  'charizard-view': '喷火龙：本人私看',
  'mewtwo-target': '超梦：查看同一对手两张',
  'mewtwo-choice': '超梦：选择交换或放弃',
  'arceus-choice': '阿尔宙斯：盖回全桌，每人随机一明',
  'greninja-choice': '忍蛙：选择两格盖回',
  'lucario-choice': '路卡利欧：额外取一张',
  'lucario-draw': '路卡利欧：额外取牌',
  'row-choice': '三神：交换对应一整行',
  'round-result': '本小局结算',
  'match-result': '大局结束',
};

export const labels: Partial<Record<Action['type'], string>> = {
  'decline-ability': '放弃能力',
  'close-peek': '查看完成',
  'activate-arceus': '发动，每人随机一明',
  'extra-draw': '再取一张',
  'discard-held': '弃掉这张牌',
  'pass-direction': '选择传牌方向',
};

export const namesOf = (session: GameHost) =>
  Object.fromEntries(session.view?.seats.map((s) => [s.id, s.name]) ?? []);

export const summaryOf = (face: Face, profile?: RulesProfile) =>
  face.abilityUsed && face.ability
    ? '能力已使用'
    : categoryPresentation(face.categoryId, profile).abilitySummary ||
      `${face.value ?? '复制'} 分`;

export const pairTypes = [
  'swap',
  'reposition',
  'mewtwo-target',
  'ninja-target',
];

export const bufferedProfile = (profile: RulesProfile | undefined) =>
  profile === 'research-buffer-v2' || profile === 'events-research-v3';

export function eventText(
  event: View['events'][number],
  names: Record<string, string>,
) {
  const action = event.action;
  if (!action || !action.actor) return event.text;
  if (action.verb === 'activate-arceus')
    return `${names[action.actor] ?? '玩家'}发动阿尔宙斯：全桌盖回，每人随机翻明一格。`;
  const verbs: Record<string, string> = {
    draw: '取出',
    replace: '换入',
    peek: '查看本人暗牌',
    'mew-target': '将梦幻换入',
    'mewtwo-target': '发动精神侦察',
    'mewtwo-exchange': '选择交换',
    swap: '交换本人两格',
    reposition: '调整本人两格',
    'ninja-target': '用忍蛙处理两格',
    'ninja-cover': '盖回两张牌',
    'ninja-swap': '盖回并交换两张牌',
    'row-target': '交换整行',
    'pass-direction': '确定接力方向',
    'activate-arceus': '发动返璞归真',
    'extra-draw': '继续额外取牌',
    'close-peek': '完成私看',
    'decline-ability': '放弃可选能力',
    'initial-flip': '翻开初始牌',
    'discard-held': '弃掉暂持牌',
    'store-buffer': '将暂持牌存入本人缓冲',
    'draw-buffer': '从本人缓冲取出',
  };
  const category =
    categories.find((c) => c.categoryId === action.cardCategory) ??
    categories.find((c) => c.ability !== null && c.ability === action.ability);
  const targets = action.targets
    .map(
      (t) =>
        `${names[t.seat] ?? '玩家'}的${t.slots.map((i) => i + 1).join('、')}号位`,
    )
    .join('；');
  return `${names[action.actor] ?? '玩家'}${verbs[action.verb] ?? '完成操作'}${category ? ` ${category.name}` : ''}${targets ? `，目标为${targets}` : ''}。`;
}

export function eventDescription(
  event: View['events'][number],
  names: Record<string, string>,
) {
  return eventText(event, names)
    .split(/(\d+(?:、\d+)*号位)/u)
    .map((part, index) =>
      /^\d+(?:、\d+)*号位$/u.test(part) ? (
        <span className="ex-position-phrase" key={index}>
          {part}
        </span>
      ) : (
        part
      ),
    );
}
