import { describe, expect, it } from 'vitest';
import type { RummikubView } from '../types';
import {
  contextFor,
  initialDraft,
  moveTiles,
  restoreDraft,
  sortGroup,
  splitGroup,
  tableFor,
  turnScope,
} from './draft';

function fixture(): RummikubView {
  return {
    gameId: 'rummikub',
    rulesVersion: 'classic-2025-digital-v1',
    phase: 'playing',
    seatOrder: ['a', 'b'],
    gameNumber: 1,
    gameCount: 2,
    roundCount: 1,
    turnNumber: 3,
    turnSeat: 'a',
    poolCount: 72,
    table: [
      {
        kind: 'run',
        tiles: [3, 4, 5, 6].map((value) => ({
          tileId: `red-0${value}-a`,
          color: 'red',
          value,
        })),
      },
    ],
    self: {
      seatId: 'a',
      opened: true,
      rack: [
        { id: 'blue-09-a', color: 'blue', value: 9, joker: false },
        { id: 'black-09-a', color: 'black', value: 9, joker: false },
        { id: 'joker-a', color: null, value: null, joker: true },
      ],
    },
    players: {
      a: { rackCount: 3, opened: true, score: 0, wins: 0 },
      b: { rackCount: 14, opened: false, score: 0, wins: 0 },
    },
    results: [],
    winners: [],
    latest: null,
  };
}
const allIds = (draft: ReturnType<typeof initialDraft>) =>
  [
    ...draft.groups.flatMap((group) => group.tiles),
    ...draft.rack,
    ...draft.tray,
  ].sort();

describe('Rummikub private turn draft', () => {
  it('splits and recombines physical tiles without copying or dropping instances', () => {
    const game = fixture(),
      context = contextFor(game),
      start = initialDraft(game);
    const split = splitGroup(start, 'saved-0', 'red-05-a');
    expect(split.groups.map((group) => group.tiles.length)).toEqual([2, 2]);
    const held = moveTiles(split, ['red-05-a', 'red-06-a'], 'tray', context);
    const joined = moveTiles(
      held,
      ['red-05-a', 'red-06-a'],
      { group: 'saved-0' },
      context,
    );
    expect(joined.groups).toHaveLength(1);
    expect(allIds(joined)).toEqual(allIds(start));
    expect(start.groups[0]!.tiles).toHaveLength(4);
  });

  it('keeps insertion indices correct when selected tiles come from the destination group', () => {
    const game = fixture(),
      context = contextFor(game),
      draft = initialDraft(game);
    const next = moveTiles(
      draft,
      ['red-03-a'],
      { group: 'saved-0', index: 3 },
      context,
    );
    expect(next.groups[0]!.tiles).toEqual([
      'red-04-a',
      'red-05-a',
      'red-03-a',
      'red-06-a',
    ]);
    expect(sortGroup(next, 'saved-0', context).groups[0]!.tiles).toEqual(
      draft.groups[0]!.tiles,
    );
  });

  it('allows temporary table tiles but cannot place them on the private rack', () => {
    const game = fixture(),
      context = contextFor(game),
      draft = initialDraft(game);
    expect(moveTiles(draft, ['red-03-a'], 'rack', context)).toBe(draft);
    const held = moveTiles(draft, ['red-03-a'], 'tray', context);
    expect(held.tray).toEqual(['red-03-a']);
    expect(restoreDraft(held, context)).toEqual(held);
  });

  it('requires an explicit joker binding before serializing the final board', () => {
    const game = fixture(),
      context = contextFor(game),
      draft = initialDraft(game);
    const placed = moveTiles(
      draft,
      ['blue-09-a', 'black-09-a', 'joker-a'],
      'new',
      context,
    );
    expect(tableFor(placed, context)).toBeNull();
    const bound = {
      ...placed,
      bindings: { 'joker-a': { color: 'orange' as const, value: 9 } },
    };
    expect(tableFor(bound, context)?.at(-1)?.tiles.at(-1)).toEqual({
      tileId: 'joker-a',
      color: 'orange',
      value: 9,
    });
  });

  it('rejects duplicate, missing, foreign, and maliciously bound restored tiles', () => {
    const game = fixture(),
      context = contextFor(game),
      draft = initialDraft(game);
    expect(restoreDraft({ ...draft, tray: ['red-03-a'] }, context)).toBeNull();
    expect(
      restoreDraft({ ...draft, rack: draft.rack.slice(1) }, context),
    ).toBeNull();
    expect(
      restoreDraft(
        { ...draft, rack: ['blue-09-b', ...draft.rack.slice(1)] },
        context,
      ),
    ).toBeNull();
    expect(
      restoreDraft(
        { ...draft, bindings: { 'joker-a': { color: 'red', value: 14 } } },
        context,
      ),
    ).toBeNull();
    expect(
      restoreDraft(
        { ...draft, bindings: { 'blue-09-a': { color: 'red', value: 3 } } },
        context,
      ),
    ).toBeNull();
  });

  it('preserves its scope across unrelated safe sync and invalidates seat, branch, or turn changes', () => {
    const game = fixture(),
      scope = turnScope('instance', 1, game);
    expect(
      turnScope('instance', 1, {
        ...game,
        latest: {
          serial: 7,
          actor: 'b',
          verb: 'pass',
          placedTileIds: [],
          text: '安全消息',
        },
      }),
    ).toBe(scope);
    expect(turnScope('instance', 2, game)).not.toBe(scope);
    expect(turnScope('other-instance', 1, game)).not.toBe(scope);
    expect(turnScope('instance', 1, { ...game, turnNumber: 4 })).not.toBe(
      scope,
    );
    expect(
      turnScope('instance', 1, {
        ...game,
        self: { ...game.self!, seatId: 'b' },
      }),
    ).not.toBe(scope);
  });
});
