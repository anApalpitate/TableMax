import { describe, it, expect } from 'vitest';
import { instancesForSeats, numeric } from './cards';
import { tasks, matchesTask } from './research';
import { scoreBoard } from './scoring';
const values: Record<string, number[]> = {
  R01: [4, 4, 4, 1, 3, 5, 6, 7, 8],
  R02: [4, 1, 3, 4, 5, 6, 4, 7, 8],
  R03: [4, 1, 3, 5, 4, 6, 7, 8, 4],
  R04: [1, 4, 3, 4, 4, 4, 5, 4, 6],
  R05: [4, 1, 4, 3, 4, 5, 4, 6, 4],
  R06: [10, 10, 10, 1, 3, 4, 5, 6, 7],
  R07: [4, 1, 4, 3, 5, 6, 4, 7, 4],
  R08: [0, 1, 2, 3, 4, 3, 5, 1, 6],
  R09: [4, 1, 6, 3, 5, 7, 6, 8, 4],
  R10: [0, 1, 2, 5, 8, 3, 6, 4, 7],
  R11: [0, 1, 2, 3, -2, 4, 5, 6, 7],
  R12: [0, 1, 2, 3, 12, 4, 5, 6, 7],
  R13: [0, 1, 2, 3, 4, 5, 0, 1, 2],
  R14: [-2, -1, 3, 0, 1, 4, 5, 6, 7],
  R15: [3, 4, 5, 0, 1, 2, 6, 7, 8],
  R16: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  R17: [0, 1, 5, 1, 2, 3, 0, 2, 4],
  R18: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  R19: [-2, 0, 1, 3, 4, 5, 6, 7, 8],
  R21: [-2, 0, 1, 3, 4, 5, 6, 7, 8],
  R24: [4, 4, 4, 1, 3, 5, 6, 7, 8],
  H01: [8, 9, 10, 4, 5, 6, 0, 1, 2],
  H02: [6, 7, 8, 0, 0, 0, 9, 10, 11],
  H03: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  H04: [8, 0, 9, 1, 5, 2, 10, 3, 11],
  H05: [0, 4, 1, 5, 6, 7, 2, 8, 3],
  H06: [10, 10, 10, 3, 3, 3, -2, 1, 4],
};
function boardForValues(v: number[]) {
  const available = instancesForSeats(2).filter((id) => numeric(id) !== null);
  return v.map((n) => {
    const index = available.findIndex((id) => numeric(id) === n);
    if (index < 0) throw new Error(`No fixture card ${n}`);
    return available.splice(index, 1)[0]!;
  });
}
const specific: Record<string, string[]> = {
  R20: [
    'special-ditto#01',
    'ordinary-4#01',
    'special-zorua#01',
    'ordinary-1#01',
    'ordinary-3#01',
    'ordinary-4#02',
    'ordinary-5#01',
    'ordinary-6#01',
    'ordinary-7#01',
  ],
  R22: [
    'special-groudon#01',
    'special-kyogre#01',
    'special-rayquaza#01',
    'ordinary-1#01',
    'ordinary-3#01',
    'ordinary-4#01',
    'ordinary-5#01',
    'ordinary-6#01',
    'ordinary-7#01',
  ],
  R23: [
    'ordinary-4#01',
    'special-ditto#01',
    'ordinary-4#02',
    'ordinary-1#01',
    'ordinary-3#01',
    'ordinary-5#01',
    'ordinary-6#01',
    'ordinary-7#01',
    'ordinary-8#01',
  ],
};
describe('all thirty research predicates have physically possible positive and negative examples', () => {
  for (const t of tasks)
    it(`${t.id} ${t.name}`, () => {
      const board = specific[t.id] ?? boardForValues(values[t.id]!);
      const pre =
        t.id === 'R24'
          ? [false, false, true, true, true, true, false, false, false]
          : Array(9).fill(true);
      const score = scoreBoard(board, [t.id], pre);
      expect(matchesTask(t.id, board, score, pre)).toBe(true);
      expect(score.research[0]!.deduction).toBe(t.reward);
      const available = new Set(instancesForSeats(2));
      expect(board.every((id) => available.has(id))).toBe(true);
      expect(new Set(board).size).toBe(9);
      let seed = 17,
        found = false;
      for (let sample = 0; sample < 100 && !found; sample++) {
        const deck = instancesForSeats(2).filter((id) => numeric(id) !== null);
        const candidate = Array.from({ length: 9 }, () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return deck.splice(
            Math.floor((seed / 4294967296) * deck.length),
            1,
          )[0]!;
        });
        found = !matchesTask(
          t.id,
          candidate,
          scoreBoard(candidate),
          Array(9).fill(true),
        );
      }
      expect(found, 'negative fixture exists').toBe(true);
    });
  it('rejects unknown research identities', () => {
    expect(() => scoreBoard(boardForValues(values.R01!), ['R99'])).toThrow();
  });
});
