import { describe, expect, it } from 'vitest';
import { card, instancesForSeats } from './cards';
import { scoreBoard } from './scoring';
import { tasks, matchesTask } from './research';

describe('expansion immutable deck and scoring contract', () => {
  it('has 34 classes and conserved 112/144 decks with near-original ability ratios', () => {
    for (const [seats, size, active] of [
      [2, 112, 27],
      [6, 144, 35],
    ]) {
      const deck = instancesForSeats(seats!);
      expect(deck).toHaveLength(size!);
      expect(new Set(deck).size).toBe(size);
      expect(new Set(deck.map((id) => card(id).categoryId)).size).toBe(34);
      expect(deck.filter((id) => card(id).ability !== null)).toHaveLength(
        active!,
      );
    }
  });
  it('zeros intersecting lines once, including negative lines', () => {
    const board = [
      'ordinary--2#01',
      'ordinary--2#02',
      'ordinary--2#03',
      'ordinary-1#01',
      'ordinary-1#02',
      'ordinary-1#03',
      'ordinary-4#01',
      'ordinary-4#02',
      'ordinary-4#03',
    ];
    const result = scoreBoard(board);
    expect(result.base).toBe(0);
    expect(result.zeroSlots).toHaveLength(9);
  });
  it('resolves horizontal and vertical copies jointly with anchored paths', () => {
    const board = [
      'special-ditto#01',
      'special-zorua#01',
      'ordinary-4#01',
      'ordinary-1#01',
      'ordinary-3#01',
      'ordinary-5#01',
      'ordinary-6#01',
      'ordinary-7#01',
      'ordinary-8#01',
    ];
    const result = scoreBoard(board, ['R23']);
    expect(result.copies).toHaveLength(2);
    for (const copy of result.copies) {
      expect(new Set(copy.path).size).toBe(copy.path.length);
      expect(card(board[copy.path.at(-1)!]!).value).not.toBeNull();
    }
  });
  it('never lets research choose a worse base score', () => {
    const board = [
      'ordinary-4#01',
      'special-ditto#01',
      'ordinary-8#01',
      'ordinary-1#01',
      'ordinary-3#01',
      'ordinary-5#01',
      'ordinary-6#01',
      'ordinary-7#01',
      'ordinary-9#01',
    ];
    expect(scoreBoard(board, ['R12', 'R20']).base).toBe(scoreBoard(board).base);
  });
  it('provides thirty research tasks and strict pre-reveal visibility semantics', () => {
    expect(tasks).toHaveLength(30);
    const board = [
      'ordinary-4#01',
      'ordinary-4#02',
      'ordinary-4#03',
      'ordinary-1#01',
      'ordinary-3#01',
      'ordinary-5#01',
      'ordinary-6#01',
      'ordinary-7#01',
      'ordinary-9#01',
    ];
    const score = scoreBoard(board);
    expect(
      matchesTask('R24', board, score, [
        false,
        false,
        false,
        true,
        true,
        true,
        false,
        false,
        false,
      ]),
    ).toBe(true);
    expect(matchesTask('R24', board, score, Array(9).fill(true))).toBe(false);
  });
});
