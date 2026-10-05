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
  const slots = Array.from({ length: count }, (_, slot) => slot);
  const column = (slot: number) => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= count)
      throw new Error('Invalid board slot');
    return slot % layout.columns;
  };
  const row = (slot: number) => {
    column(slot);
    return Math.floor(slot / layout.columns);
  };
  const horizontalNeighbors = (slot: number) => {
    const c = column(slot);
    return [
      c > 0 ? slot - 1 : -1,
      c + 1 < layout.columns ? slot + 1 : -1,
    ].filter((i) => i >= 0);
  };
  const verticalNeighbors = (slot: number) => {
    const r = row(slot);
    return [
      r > 0 ? slot - layout.columns : -1,
      r + 1 < layout.rows ? slot + layout.columns : -1,
    ].filter((i) => i >= 0);
  };
  return {
    count,
    slots,
    row,
    column,
    rows: Array.from({ length: layout.rows }, (_, r) =>
      slots.filter((slot) => row(slot) === r),
    ),
    columns: Array.from({ length: layout.columns }, (_, c) =>
      Array.from({ length: layout.rows }, (_, r) => r * layout.columns + c),
    ),
    diagonals:
      layout.rows === layout.columns
        ? [
            slots.filter((slot) => row(slot) === column(slot)),
            slots.filter(
              (slot) => row(slot) + column(slot) === layout.columns - 1,
            ),
          ]
        : [],
    horizontalNeighbors,
    verticalNeighbors,
    neighbors: horizontalNeighbors,
  };
}
