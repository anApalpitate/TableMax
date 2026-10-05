import { copyTableFields, type TableFields } from './table';

/** The fresh identities come only from one authorized hypothesis, in deal order. */
export function previewRocketPikachu(
  fields: TableFields,
  order: readonly string[],
  pool: readonly string[],
  slot: number,
  consumed = 0,
) {
  const fresh = order.map((_, index) => pool.at(-1 - consumed - index));
  if (
    fresh.some((id) => id === undefined) ||
    new Set(fresh).size !== fresh.length
  )
    throw new Error('Invalid authorized Rocket replacements');
  const result = copyTableFields(fields);
  const removed = order.map((seat) => result.boards[seat]![slot]!);
  order.forEach((seat, index) => {
    result.boards[seat]![slot] = fresh[index]!;
    result.up[seat]![slot] = true;
  });
  return { ...result, removed, fresh };
}
