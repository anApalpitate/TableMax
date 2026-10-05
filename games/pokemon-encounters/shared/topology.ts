export type BoardLayout = Readonly<{ rows: number; columns: number }>;
export function topology(layout: BoardLayout) {
  if (
    !Number.isInteger(layout.rows) ||
    !Number.isInteger(layout.columns) ||
    layout.rows < 1 ||
    layout.columns < 1 ||
    layout.rows * layout.columns > 64
  )
    throw new Error('Invalid board layout');
  const count = layout.rows * layout.columns;
  const column = (slot: number) => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= count)
      throw new Error('Invalid board slot');
    return slot % layout.columns;
  };
  return {
    count,
    column,
    columns: Array.from({ length: layout.columns }, (_, c) =>
      Array.from({ length: layout.rows }, (_, r) => r * layout.columns + c),
    ),
    neighbors: (slot: number) => {
      const c = column(slot);
      return [
        c > 0 ? slot - 1 : -1,
        c + 1 < layout.columns ? slot + 1 : -1,
      ].filter((i) => i >= 0);
    },
  };
}
