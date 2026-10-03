import type { PokemonView } from '../rules/project';
export const phaseLabels: Record<PokemonView['phase'], string> = {
  'initial-flip': '翻开第一张牌',
  draw: '取一张牌',
  place: '换牌或弃牌',
  'mew-other': '梦幻 选朋友的牌',
  'mew-self': '梦幻 换入场地',
  'rocket-meowth': '喵喵面 换一张牌',
  'rocket-pikachu': '皮卡丘面 选同一位置',
  'zapdos-self': '闪电鸟 换入场地',
  'zapdos-receive': '接牌 换入场地',
  'snorlax-choice': '卡比兽 交换两张牌',
  'charizard-choice': '喷火龙 查看暗牌',
  'charizard-view': '记住这张牌',
  'round-result': '小局结算',
  'match-result': '三胜大局结束',
};
