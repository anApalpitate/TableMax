import { numeric } from './cards';
import { original } from '../variants/original';
import { topology } from '../shared/topology';
const grid = topology(original.layout);

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
  if (board.length !== grid.count || new Set(board).size !== grid.count)
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
    for (const to of grid.neighbors(slot))
      enumerate(index + 1, { ...choices, [slot]: to });
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
    const columns = grid.columns.map(([a, b]) =>
      values[a!] === values[b!] ? 0 : values[a!]! + values[b!]!,
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
    for (let i = 0; i < grid.count; i++)
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
