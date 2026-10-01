import type { PokemonView } from '../rules/project';
export const phaseLabels: Record<PokemonView['phase'], string> = {
  'initial-flip': '各自翻开一张初始牌',
  draw: '选择取牌来源',
  place: '替换己方一张，或合法弃牌',
  'mew-other': '梦幻：选择其他玩家的一格',
  'mew-self': '梦幻：完成己方替换',
  'rocket-meowth': '火箭队：喵喵面，替换己方一格',
  'rocket-pikachu': '火箭队：皮卡丘面，选择全员同一位置',
  'zapdos-self': '闪电鸟：换入己方场地',
  'zapdos-receive': '接牌者：选择换入位置',
  'snorlax-choice': '卡比兽：交换两格，或不发动',
  'charizard-choice': '喷火龙：查看一张己方暗牌，或不发动',
  'charizard-view': '看完后确认关闭，牌仍朝下',
  'round-result': '小局结算 · 等待房主开始下一局',
  'match-result': '三胜大局结束',
};
