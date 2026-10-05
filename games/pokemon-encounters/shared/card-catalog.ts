export type CardDefinition = {
  categoryId: string;
  quantity: number;
  value: { kind: string; number?: number };
};

/** Data-independent catalog. Definition order is also the stable deck order. */
export function createCardCatalog<T extends CardDefinition>(
  definitions: readonly T[],
) {
  const categories = [...definitions];
  const byCategory = new Map(
    categories.map((definition) => [definition.categoryId, definition]),
  );
  if (
    byCategory.size !== categories.length ||
    categories.some(
      (definition) =>
        !definition.categoryId ||
        definition.categoryId.includes('#') ||
        !Number.isInteger(definition.quantity) ||
        definition.quantity < 1,
    )
  )
    throw new Error('Invalid card catalog');
  const instances = categories.flatMap((definition) =>
    Array.from(
      { length: definition.quantity },
      (_, index) =>
        `${definition.categoryId}#${String(index + 1).padStart(2, '0')}`,
    ),
  );
  const validInstances = new Set(instances);
  const category = (id: string) => {
    const definition = byCategory.get(id);
    if (!definition) throw new Error('Invalid card category');
    return definition;
  };
  const card = (instance: string) => {
    if (!validInstances.has(instance)) throw new Error('Invalid card');
    return category(instance.split('#')[0]!);
  };
  const numeric = (instance: string): number | null => {
    const value = card(instance).value;
    return value.kind === 'fixed' ? value.number! : null;
  };
  return { categories, instances, category, card, numeric };
}
