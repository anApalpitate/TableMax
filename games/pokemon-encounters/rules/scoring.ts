import { numeric } from './cards';

export type Score = {
  values: number[];
  columns: number[];
  total: number;
  copies: {
    slot: number;
    direction: 'left' | 'right';
    path: number[];
    value: number;
  }[];
};

// Enumerate directions jointly; a Ditto chain must terminate at a fixed card.
export function scoreBoard(board: readonly string[]): Score {
  if (board.length !== 6 || new Set(board).size !== 6)
    throw new Error('Invalid scoring board');
  const fixed = board.map(numeric);
  const ditto = fixed.flatMap((value, i) => (value === null ? [i] : []));
  if (ditto.length > 2) throw new Error('Too many Ditto');
  const assignments: Record<number, number>[] = [];
  function enumerate(index: number, choices: Record<number, number>) {
    if (index === ditto.length) {
      assignments.push(choices);
      return;
    }
    const slot = ditto[index]!;
    for (const to of [slot - 1, slot + 1]) {
      if (to >= 0 && to < 6 && Math.floor(to / 3) === Math.floor(slot / 3))
        enumerate(index + 1, { ...choices, [slot]: to });
    }
  }
  enumerate(0, {});
  const candidates: Score[] = [];
  for (const choices of assignments) {
    const resolve = (
      slot: number,
      path: number[] = [],
    ): { value: number; path: number[] } | null => {
      if (path.includes(slot)) return null;
      const nextPath = [...path, slot];
      if (fixed[slot] !== null) return { value: fixed[slot]!, path: nextPath };
      return resolve(choices[slot]!, nextPath);
    };
    const resolved = fixed.map((_, slot) => resolve(slot));
    if (resolved.some((r) => r === null)) continue;
    const values = resolved.map((r) => r!.value);
    const columns = [0, 1, 2].map((i) =>
      values[i] === values[i + 3] ? 0 : values[i]! + values[i + 3]!,
    );
    candidates.push({
      values,
      columns,
      total: columns.reduce((a, b) => a + b, 0),
      copies: ditto.map((slot) => ({
        slot,
        direction: choices[slot]! < slot ? 'left' : 'right',
        path: resolved[slot]!.path,
        value: values[slot]!,
      })),
    });
  }
  const compare = (a: Score, b: Score) => {
    if (a.total !== b.total) return a.total - b.total;
    for (let i = 0; i < 6; i++)
      if (a.values[i] !== b.values[i]) return a.values[i]! - b.values[i]!;
    for (let i = 0; i < a.copies.length; i++)
      if (a.copies[i]!.direction !== b.copies[i]!.direction)
        return a.copies[i]!.direction === 'left' ? -1 : 1;
    return 0;
  };
  candidates.sort(compare);
  if (!candidates[0]) throw new Error('No anchored Ditto assignment');
  return candidates[0];
}
