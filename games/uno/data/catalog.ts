import { COLORS, type Card, type CardKind } from '../types';
export const RULES_VERSION = 'classic-108-g7942-1';
const cards: Card[] = [];
for (const color of COLORS) {
  for (let value = 0; value <= 9; value++) {
    for (const copy of value === 0 ? ['a'] : ['a', 'b'])
      cards.push({
        id: `${color}-${value}-${copy}`,
        color,
        kind: 'number',
        value,
      });
  }
  for (const kind of ['skip', 'reverse', 'draw-two'] as const)
    for (const copy of ['a', 'b'])
      cards.push({ id: `${color}-${kind}-${copy}`, color, kind, value: null });
}
for (const kind of ['wild', 'wild-draw-four'] as const)
  for (let copy = 1; copy <= 4; copy++)
    cards.push({ id: `${kind}-${copy}`, color: null, kind, value: null });
export const CARDS: readonly Card[] = Object.freeze(
  cards.map((card) => Object.freeze(card)),
);
export const CARD_IDS = Object.freeze(CARDS.map((card) => card.id));
const catalog = new Map(CARDS.map((card) => [card.id, card]));
export function getCard(id: string): Card {
  const card = catalog.get(id);
  if (!card) throw new Error('UNO 牌编号无效。');
  return card;
}
export const KIND_LABELS: Record<CardKind, string> = {
  number: '数字',
  skip: '跳过',
  reverse: '反转',
  'draw-two': '+2',
  wild: '变色',
  'wild-draw-four': '+4',
};
export const COLOR_LABELS = {
  red: '红',
  yellow: '黄',
  green: '绿',
  blue: '蓝',
};
export function cardLabel(id: string): string {
  const card = getCard(id);
  return `${card.color ? COLOR_LABELS[card.color] : ''}${card.kind === 'number' ? card.value : KIND_LABELS[card.kind]}`;
}
