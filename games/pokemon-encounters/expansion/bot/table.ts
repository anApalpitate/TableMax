export type TableFields = {
  boards: Record<string, string[]>;
  up: Record<string, boolean[]>;
};

/** Synthetic identities only, derived from authorized faces and memory. */
export type AbilityKnowledge = { usedAbilityIds?: readonly string[] };
export const abilityAvailable = (model: AbilityKnowledge, id: string) =>
  !model.usedAbilityIds?.includes(id);

/** Copies hypothetical fields without changing identities, orientations or inputs. */
export function copyTableFields(fields: TableFields): TableFields {
  return {
    boards: Object.fromEntries(
      Object.entries(fields.boards).map(([id, board]) => [id, [...board]]),
    ),
    up: Object.fromEntries(
      Object.entries(fields.up).map(([id, faces]) => [id, [...faces]]),
    ),
  };
}
