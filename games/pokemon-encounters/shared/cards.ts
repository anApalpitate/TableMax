import catalog from '../../../docs/games/pokemon-encounters/cards.json';
export const categories = catalog.cards;
export const instances = categories.flatMap((card) =>
  Array.from(
    { length: card.quantity },
    (_, i) => `${card.categoryId}#${String(i + 1).padStart(2, '0')}`,
  ),
);
export function card(instance: string) {
  const result = categories.find(
    (c) => c.categoryId === instance.split('#')[0],
  );
  if (!result || !instances.includes(instance)) throw new Error('Invalid card');
  return result;
}
export function numeric(instance: string): number | null {
  const value = card(instance).value;
  return value.kind === 'fixed' ? value.number! : null;
}
