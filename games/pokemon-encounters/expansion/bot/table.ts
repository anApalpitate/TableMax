export type TableFields = {
  boards: Record<string, string[]>;
  up: Record<string, boolean[]>;
};

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
