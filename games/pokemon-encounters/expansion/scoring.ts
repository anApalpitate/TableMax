import { card } from './cards';
import { grid, lines, matchesTask, task } from './research';
export type Score = {
  values: number[];
  matchedLines: number[];
  zeroSlots: number[];
  base: number;
  research: { taskId: string; achieved: boolean; deduction: number }[];
  deduction: number;
  total: number;
  copies: {
    slot: number;
    direction: 'left' | 'right' | 'up' | 'down';
    path: number[];
    value: number;
  }[];
};
export function scoreBoard(
  board: readonly string[],
  taskIds: readonly string[] = [],
  preReveal: readonly boolean[] = Array(9).fill(true),
): Score {
  if (
    board.length !== 9 ||
    new Set(board).size !== 9 ||
    preReveal.length !== 9 ||
    new Set(taskIds).size !== taskIds.length
  )
    throw new Error('Invalid expansion scoring board');
  const cards = board.map(card),
    fixed = cards.map((c) => c.value),
    copySlots = grid.slots.filter((i) => fixed[i] === null);
  if (copySlots.length > 4) throw new Error('Too many expansion copies');
  const candidates: Score[] = [];
  function enumerate(index: number, choices: Record<number, number>) {
    if (index < copySlots.length) {
      const slot = copySlots[index]!;
      for (const to of cards[slot]!.copy === 'vertical'
        ? grid.verticalNeighbors(slot)
        : grid.horizontalNeighbors(slot))
        enumerate(index + 1, { ...choices, [slot]: to });
      return;
    }
    const resolve = (
      slot: number,
      path: number[] = [],
    ): { value: number; path: number[] } | null => {
      if (path.includes(slot)) return null;
      const next = [...path, slot];
      if (fixed[slot] !== null) return { value: fixed[slot]!, path: next };
      return resolve(choices[slot]!, next);
    };
    const resolved = grid.slots.map((i) => resolve(i));
    if (resolved.some((r) => r === null)) return;
    const values = resolved.map((r) => r!.value),
      matchedLines = lines.flatMap((l, i) =>
        l.every((n) => values[n] === values[l[0]!]) ? [i] : [],
      ),
      zeroSlots = [...new Set(matchedLines.flatMap((i) => lines[i]!))].sort(
        (a, b) => a - b,
      );
    const base = values.reduce(
      (n, v, i) => n + (zeroSlots.includes(i) ? 0 : v),
      0,
    );
    const score: Score = {
      values,
      matchedLines,
      zeroSlots,
      base,
      research: [],
      deduction: 0,
      total: base,
      copies: copySlots.map((slot) => ({
        slot,
        direction:
          choices[slot] === slot - 3
            ? 'up'
            : choices[slot] === slot + 3
              ? 'down'
              : choices[slot]! < slot
                ? 'left'
                : 'right',
        path: resolved[slot]!.path,
        value: values[slot]!,
      })),
    };
    score.research = taskIds.map((taskId) => {
      const achieved = matchesTask(taskId, board, score, preReveal);
      return {
        taskId,
        achieved,
        deduction: achieved ? task(taskId).reward : 0,
      };
    });
    score.deduction = score.research.reduce((n, r) => n + r.deduction, 0);
    score.total = base - score.deduction;
    candidates.push(score);
  }
  enumerate(0, {});
  candidates.sort((a, b) => {
    if (a.base !== b.base) return a.base - b.base;
    if (a.deduction !== b.deduction) return b.deduction - a.deduction;
    for (let i = 0; i < 9; i++)
      if (a.values[i] !== b.values[i]) return a.values[i]! - b.values[i]!;
    const order = { left: 0, right: 1, up: 2, down: 3 };
    for (let i = 0; i < a.copies.length; i++) {
      const difference =
        order[a.copies[i]!.direction] - order[b.copies[i]!.direction];
      if (difference) return difference;
    }
    return 0;
  });
  if (!candidates[0]) throw new Error('No anchored expansion copy assignment');
  return candidates[0];
}
