import type { Card } from '../types';

export type SortMode = 'color' | 'number';
export interface HandOrder {
  ids: string[];
  mode: SortMode;
  manual: boolean;
}
const colors = ['red', 'yellow', 'green', 'blue', null];
const kinds = [
  'number',
  'skip',
  'reverse',
  'draw-two',
  'wild',
  'wild-draw-four',
];
export function sortedHand(cards: Card[], legal: Set<string>, mode: SortMode) {
  const color = (card: Card) => colors.indexOf(card.color);
  const value = (card: Card) =>
    card.kind === 'number' ? card.value! : 10 + kinds.indexOf(card.kind);
  return [...cards]
    .sort(
      (a, b) =>
        Number(legal.has(b.id)) - Number(legal.has(a.id)) ||
        (mode === 'color'
          ? color(a) - color(b) || value(a) - value(b)
          : value(a) - value(b) || color(a) - color(b)),
    )
    .map((card) => card.id);
}
export function reconcileOrder(
  order: HandOrder,
  cards: Card[],
  legal: Set<string>,
): HandOrder {
  const present = new Set(cards.map((card) => card.id));
  const ids = order.ids.filter((id) => present.has(id));
  const known = new Set(ids);
  ids.push(
    ...cards.filter((card) => !known.has(card.id)).map((card) => card.id),
  );
  return {
    ...order,
    ids:
      order.manual || !legal.size ? ids : sortedHand(cards, legal, order.mode),
  };
}
export function readOrder(key: string): HandOrder {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      value &&
      typeof value === 'object' &&
      'ids' in value &&
      'mode' in value &&
      'manual' in value &&
      Array.isArray(value.ids) &&
      value.ids.length <= 108 &&
      value.ids.every((id) => typeof id === 'string') &&
      (value.mode === 'color' || value.mode === 'number') &&
      typeof value.manual === 'boolean'
    )
      return {
        ids: [...new Set(value.ids)],
        mode: value.mode,
        manual: value.manual,
      };
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  return { ids: [], mode: 'color', manual: false };
}
