import { describe, expect, it } from 'vitest';
import {
  card,
  category,
  instancesForSeats,
  categoriesForProfile,
} from '../cards';
import { researchDefinition, tasksForProfile, matchesTask } from '../research';
import { scoreBoard, type ResolvedCardDefinitions } from '../scoring';

const profile = 'events-research-v3' as const;
const ids = [
  'R01',
  'R02',
  'R03',
  'R05',
  'R06',
  'R08',
  'R11',
  'R13',
  'R14',
  'R15',
  'R16',
  'R17',
  'R18',
  'R19',
  'R22',
  'R23',
  'R24',
];
const override = (
  board: readonly string[],
  values: number[],
): ResolvedCardDefinitions =>
  Object.fromEntries(
    board.map((id, slot) => [
      id,
      { ...category('ordinary-1', profile), value: values[slot]! },
    ]),
  );

describe('events research v3 isolated configuration and scoring', () => {
  it('uses the same 144 conserved instances for two through six seats without altering older values or decks', () => {
    for (const seats of [2, 3, 4, 5, 6]) {
      const deck = instancesForSeats(seats, profile);
      expect(deck).toHaveLength(144);
      expect(new Set(deck).size).toBe(144);
      expect(deck).toEqual(instancesForSeats(2, profile));
      for (const id of [
        'special-arceus',
        'special-groudon',
        'special-kyogre',
        'special-rayquaza',
      ])
        expect(
          deck.filter((instance) => card(instance, profile).categoryId === id),
        ).toHaveLength(1);
      for (const id of ['special-ditto', 'special-zorua'])
        expect(
          deck.filter((instance) => card(instance, profile).categoryId === id),
        ).toHaveLength(2);
    }
    expect(categoriesForProfile(profile)).toHaveLength(34);
    expect(card('ordinary-metagross#01', profile).value).toBe(5);
    expect(card('ordinary-metagross#01').value).toBe(10);
    expect(instancesForSeats(2)).toHaveLength(112);
    expect(tasksForProfile('research-buffer-v2')).toHaveLength(30);
    expect(tasksForProfile('legacy')).toHaveLength(30);
    expect(tasksForProfile(profile).map((task) => task.id)).toEqual(ids);
    expect(() => researchDefinition('R04', profile)).toThrow();
    expect(researchDefinition('R04', 'legacy')).toBeDefined();
  });

  for (const id of ids)
    it(`${id}: the documented inventory-valid diagram achieves the predicate and a counterexample fails`, () => {
      const definition = researchDefinition(id, profile),
        { instances: board, preReveal } = definition.diagram.sample;
      const result = scoreBoard(board, [id], preReveal, profile);
      expect(result.research[0]!.achieved).toBe(true);
      expect(result.victory).toEqual({ bonus: 0, eligible: true, cap: 3 });
      const defs = { ...override(board, [0, 1, 2, 3, 4, 5, 6, 7, 9]) };
      if (id === 'R03')
        for (const slot of [0, 2, 6, 8])
          defs[board[slot]!] = { ...defs[board[slot]!]!, value: 1 };
      if (id === 'R14') defs[board[0]!] = category('special-snorlax', profile);
      const failed = scoreBoard(
        board,
        [id],
        Array(9).fill(true),
        profile,
        defs,
      );
      expect(failed.research[0]!.achieved).toBe(false);
      expect(failed.total).toBe(failed.base);
      expect(failed.victory).toEqual({ bonus: 0, eligible: true, cap: 3 });
    });

  it('R23 divides positive and negative odd bases directly and preserves half points', () => {
    const board = researchDefinition('R23', profile).diagram.sample.instances;
    for (const remainder of [1, -1, 0]) {
      const defs = override(board, [5, 5, 5, remainder, 2, 4, 8, 8, 8]);
      const result = scoreBoard(
        board,
        ['R23'],
        Array(9).fill(true),
        profile,
        defs,
      );
      expect(result.research[0]!.achieved).toBe(true);
      expect(result.total).toBe((remainder + 6) / 2);
    }
    const negative = scoreBoard(
      board,
      ['R23'],
      Array(9).fill(true),
      profile,
      override(board, [5, 5, 5, -1, -2, -4, 8, 8, 8]),
    );
    expect(negative.base).toBe(-7);
    expect(negative.total).toBe(-3.5);
  });

  it('R24 applies every fully hidden row once after zeroing, with floor rounding for negative cards', () => {
    const board = researchDefinition('R24', profile).diagram.sample.instances;
    const defs = override(board, [5, -1, 3, 4, 4, 4, 8, -2, 1]);
    const result = scoreBoard(
      board,
      ['R24'],
      [false, false, false, false, false, false, true, false, false],
      profile,
      defs,
    );
    expect(result.zeroSlots).toContain(3);
    expect(result.total).toBe(2 - 1 + 1 + 0 + 0 + 0 + 8 - 2 + 1);
    expect(result.research[0]!.effects![0]!.slots).toEqual([0, 1, 2, 3, 4, 5]);
    const allHidden = scoreBoard(
      board,
      ['R24'],
      Array(9).fill(false),
      profile,
      defs,
    );
    expect(allHidden.total).toBe(2 - 1 + 1 + 4 - 1 + 0);
  });

  it('uses resolved weather values and transformed roles/attributes for research without changing originals', () => {
    const board = researchDefinition('R17', profile).diagram.sample.instances;
    const defs = override(board, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const slot of [0, 1, 2])
      (defs as Record<string, ReturnType<typeof card>>)[board[slot]!] = {
        ...category('ordinary-4', profile),
        value: 2,
      };
    const result = scoreBoard(
      board,
      ['R17'],
      Array(9).fill(true),
      profile,
      defs,
    );
    expect(
      matchesTask('R17', board, result, Array(9).fill(true), profile, defs),
    ).toBe(true);
    expect(card(board[1]!, profile).categoryId).not.toBe('ordinary-4');
  });
});
