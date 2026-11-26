import { deepStrictEqual } from 'node:assert';
import { describe, expect, it } from 'vitest';
import type { BotDifficulty } from '@tablemax/game-sdk';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { getTile, RULES_VERSION } from '../data/catalog';
import { parseMeld } from '../shared/melds';
import { inspectTurn } from '../shared/turn';
import type { Action, Meld, PlayAction, RummikubView } from '../types';
import { SEARCH_LIMITS, TABLE_PRESSURE_LIMITS, bot, planTurn } from './index';

const id = (color: string, value: number, copy = 'a') =>
  `${color}-${String(value).padStart(2, '0')}-${copy}`;
const run = (color: string, start: number, end: number) =>
  parseMeld(
    Array.from({ length: end - start + 1 }, (_, i) => id(color, start + i)),
  )!;
const group = (value: number, colors = ['red', 'blue', 'orange']) =>
  parseMeld(colors.map((color) => id(color, value)))!;
function fixture(
  rack: string[],
  table: Meld[] = [group(10)],
  opened = true,
): RummikubView {
  return {
    gameId: 'rummikub',
    rulesVersion: RULES_VERSION,
    phase: 'playing',
    seatOrder: ['S1', 'S2'],
    gameNumber: 1,
    gameCount: 2,
    roundCount: 1,
    turnNumber: 1,
    turnSeat: 'S1',
    table,
    poolCount: 50,
    players: {
      S1: { rackCount: rack.length, opened, score: 0, wins: 0 },
      S2: { rackCount: 14, opened: false, score: 0, wins: 0 },
    },
    self: { seatId: 'S1', rack: rack.map(getTile), opened },
    results: [],
    winners: [],
    latest: null,
  };
}
const placed = (view: RummikubView, action: PlayAction | null) =>
  action
    ? inspectTurn(
        {
          rack: view.self!.rack.map((tile) => tile.id),
          table: view.table,
          opened: view.self!.opened,
        },
        action,
      ).placedTileIds.length
    : 0;
const choose = (
  view: RummikubView,
  difficulty: BotDifficulty,
  actions: Action[] = [{ type: 'draw' }],
  signal = new AbortController().signal,
) =>
  bot.decide({
    view,
    actions,
    difficulty,
    decision: { id: 'fixture-turn', seatId: 'S1' },
    memory: null,
    random: new RandomSource(31),
    signal,
  });

describe('Rummikub bounded authorized local strategies', () => {
  it('places the final natural tile on the improved table returned by Juewu', () => {
    const table = [
      'orange-07-b orange-08-a joker-b orange-10-a orange-11-a orange-12-a orange-13-a',
      'blue-10-b blue-11-b blue-12-a blue-13-a',
      'black-13-b blue-13-b red-13-a',
      'blue-01-b blue-02-a blue-03-a blue-04-b blue-05-a blue-06-a blue-07-a blue-08-a',
      'black-07-b blue-07-b red-07-a',
      'black-08-a blue-08-b orange-08-b red-08-a',
      'black-08-b black-09-a black-10-a black-11-b black-12-b',
      'black-09-b black-10-b black-11-a',
      'black-01-a black-02-a black-03-a black-04-a black-05-a black-06-a',
      'black-01-b orange-01-a red-01-a',
      'orange-01-b orange-02-a orange-03-b orange-04-b',
      'black-02-b blue-02-b red-02-b',
      'black-03-b blue-03-b red-03-b',
      'black-04-b orange-04-a red-04-a',
      'black-05-b blue-05-b orange-05-a red-05-a',
      'red-02-a red-03-a red-04-b red-05-b red-06-a',
      'red-06-b red-07-b red-08-b red-09-a red-10-a red-11-a red-12-a red-13-b',
      'red-10-b red-11-b red-12-b',
    ].map((tiles) => parseMeld(tiles.split(' '))!);
    const view = fixture(['orange-11-b', 'orange-07-a'], table);
    view.gameNumber = view.gameCount = 4;
    view.players.S1!.wins = 2;
    view.players.S2!.wins = 1;
    const result = planTurn(view, 'juewu');
    expect(placed(view, result.action)).toBe(2);
    expect(result.stats.nodes).toBeLessThanOrEqual(SEARCH_LIMITS.juewu.nodes);
    expect(result.stats.generationSteps).toBeLessThanOrEqual(
      SEARCH_LIMITS.juewu.generation,
    );

    const earlier = { ...view, gameNumber: 3 };
    expect(placed(earlier, planTurn(earlier, 'juewu').action)).toBe(1);

    const behind = {
      ...view,
      players: {
        S1: { ...view.players.S1!, wins: 1, score: -30 },
        S2: { ...view.players.S2!, wins: 2, score: 30 },
      },
    };
    expect(placed(behind, planTurn(behind, 'juewu').action)).toBe(1);
  });

  it('Doubao finds six tiles where greedy uses the overlapping five-tile run', () => {
    const view = fixture([
      ...Array.from({ length: 5 }, (_, i) => id('black', i + 1)),
      id('blue', 3),
      id('orange', 3),
      id('blue', 4),
      id('orange', 4),
    ]);
    expect(placed(view, planTurn(view, 'default').action)).toBe(5);
    expect(placed(view, planTurn(view, 'doubao').action)).toBe(6);
  });
  it('Juewu changes two runs together to free a tile that one-set search cannot use', () => {
    const view = fixture(
      [id('blue', 7), id('orange', 7)],
      [run('red', 1, 4), run('red', 5, 7)],
    );
    expect(planTurn(view, 'default').action).toBeNull();
    expect(planTurn(view, 'doubao').action).toBeNull();
    expect(placed(view, planTurn(view, 'juewu').action)).toBe(2);
  });
  it('replaces a table joker and reuses that same physical instance in this turn', () => {
    const old = parseMeld(
      [id('red', 5), id('red', 6), 'joker-a'],
      { 'joker-a': { color: 'red', value: 7 } },
      'run',
    )!;
    const view = fixture(
      [id('red', 7), id('blue', 10), id('orange', 10)],
      [old],
    );
    const action = planTurn(view, 'doubao').action;
    expect(placed(view, action)).toBe(3);
    expect(action?.releases?.map((proof) => proof.jokerId)).toEqual([
      'joker-a',
    ]);
    expect(
      action?.table
        .flatMap((meld) => meld.tiles)
        .filter((tile) => tile.tileId === 'joker-a'),
    ).toHaveLength(1);
  });
  it('keeps the independent replacement proofs for two table jokers separate', () => {
    const first = parseMeld(
      [id('red', 5), id('red', 6), 'joker-a'],
      { 'joker-a': { color: 'red', value: 7 } },
      'run',
    )!;
    const second = parseMeld(
      [id('blue', 10), id('blue', 11), 'joker-b'],
      { 'joker-b': { color: 'blue', value: 12 } },
      'run',
    )!;
    const view = fixture(
      [
        id('red', 7),
        id('blue', 12),
        id('orange', 2),
        id('orange', 3),
        id('black', 2),
        id('black', 3),
      ],
      [first, second],
    );
    const action = planTurn(view, 'juewu').action!;
    expect(placed(view, action)).toBe(6);
    expect(action.releases?.map((proof) => proof.jokerId).sort()).toEqual([
      'joker-a',
      'joker-b',
    ]);
    const one = action.releases!.find((proof) => proof.jokerId === 'joker-a')!;
    const two = action.releases!.find((proof) => proof.jokerId === 'joker-b')!;
    expect(
      one.replacementSets.flatMap((meld) =>
        meld.tiles.map((tile) => tile.tileId),
      ),
    ).toEqual(expect.arrayContaining([id('red', 5), id('red', 6)]));
    expect(
      two.replacementSets.flatMap((meld) =>
        meld.tiles.map((tile) => tile.tileId),
      ),
    ).toEqual(expect.arrayContaining([id('blue', 10), id('blue', 11)]));
  });
  it('opens at thirty with rack tiles and preserves every original set', () => {
    const view = fixture(
      [
        id('black', 1),
        id('black', 2),
        id('black', 3),
        id('blue', 12),
        id('orange', 12),
        id('red', 12),
      ],
      [group(10)],
      false,
    );
    for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
      const action = planTurn(view, difficulty).action!;
      expect(
        inspectTurn(
          {
            rack: view.self!.rack.map((tile) => tile.id),
            table: view.table,
            opened: false,
          },
          action,
        ).points,
      ).toBeGreaterThanOrEqual(30);
      expect(action.table).toContainEqual(view.table[0]);
    }
  });
  it('keeps joker opening point thresholds distinct while memoizing the same instances', () => {
    const view = fixture([id('red', 9), 'joker-a', 'joker-b'], [], false);
    for (const difficulty of ['doubao', 'juewu'] as const) {
      const action = planTurn(view, difficulty).action!;
      expect(placed(view, action)).toBe(3);
      expect(
        inspectTurn(
          {
            rack: view.self!.rack.map((tile) => tile.id),
            table: [],
            opened: false,
          },
          action,
        ).points,
      ).toBeGreaterThanOrEqual(30);
    }
  });
  it('uses the authorized draw/pass if the bounded search finds no valid play', async () => {
    const view = fixture(
      [id('black', 1), id('black', 2), id('black', 3)],
      [],
      false,
    );
    expect((await choose(view, 'default')).action).toEqual({ type: 'draw' });
    expect((await choose(view, 'juewu', [{ type: 'pass' }])).action).toEqual({
      type: 'pass',
    });
  });
  it('revisits a lower run endpoint after adding its immediate neighbour', () => {
    const view = fixture([id('red', 1), id('red', 2)], [run('red', 3, 5)]);
    expect(placed(view, planTurn(view, 'default').action)).toBe(2);
  });
  it('uses a rule-proved complex play if its own bounded optimizer has no candidate', async () => {
    const view = fixture(
      [id('blue', 7), id('orange', 7)],
      [run('red', 1, 4), run('red', 5, 7)],
    );
    const proof = planTurn(view, 'juewu').action!;
    expect((await choose(view, 'default', [proof])).action).toEqual(proof);
  });
  it('is deterministic, has no secret history, and leaves the supplied input unchanged', async () => {
    const view = fixture([id('black', 11), id('black', 12), id('black', 13)]);
    const before = structuredClone(view);
    for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
      const choices = await Promise.all([
        choose(view, difficulty),
        choose(structuredClone(view), difficulty),
      ]);
      expect(choices[0]).toEqual(choices[1]);
      expect(choices[0]!.memory).toBeNull();
      deepStrictEqual(view, before);
    }
    expect(bot.validateMemory(null)).toBeNull();
    expect(() => bot.validateMemory({ hiddenRack: [] })).toThrow();
  });
  it('honors cancellation and rejects inconsistent seat identity', async () => {
    const view = fixture([id('black', 11), id('black', 12), id('black', 13)]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      choose(view, 'juewu', [{ type: 'draw' }], controller.signal),
    ).rejects.toThrow('取消');
    await expect(
      bot.decide({
        view,
        actions: [],
        memory: null,
        random: new RandomSource(1),
        signal: new AbortController().signal,
        decision: { id: 'bad', seatId: 'S2' },
      }),
    ).rejects.toThrow('身份');
  });
  it('bounds dense-table candidates, generation work and search nodes at every level', () => {
    const table = ['black', 'blue', 'orange', 'red'].map((color) =>
      run(color, 1, 10),
    );
    const view = fixture(
      [
        ...['black', 'blue', 'orange', 'red'].flatMap((color) =>
          [11, 12, 13].map((value) => id(color, value)),
        ),
        'joker-a',
        'joker-b',
      ],
      table,
    );
    for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
      const started = performance.now();
      const plan = planTurn(view, difficulty);
      expect(plan.action).toBeTruthy();
      expect(plan.stats.candidates).toBeLessThanOrEqual(
        SEARCH_LIMITS[difficulty].candidates,
      );
      expect(plan.stats.generationSteps).toBeLessThanOrEqual(
        SEARCH_LIMITS[difficulty].generation,
      );
      expect(plan.stats.nodes).toBeLessThanOrEqual(
        SEARCH_LIMITS[difficulty].nodes,
      );
      expect(performance.now() - started).toBeLessThan(1500);
    }
  });
});

describe('Rummikub pressure on the next player', () => {
  it('joins two open runs without changing the tiles played when the next seat has one tile', async () => {
    const view = fixture(
      [id('red', 5), id('black', 11)],
      [run('red', 2, 4), run('red', 6, 8)],
    );
    view.players.S2 = { ...view.players.S2!, opened: true, rackCount: 1 };
    const original = structuredClone(view);
    const baseline = planTurn(view, 'juewu');
    const pressured = planTurn(view, 'mischief');
    const own = (action: PlayAction) =>
      inspectTurn(
        {
          rack: view.self!.rack.map((tile) => tile.id),
          table: view.table,
          opened: true,
        },
        action,
      ).placedTileIds;
    expect(baseline.action!.table).toHaveLength(2);
    expect(pressured.action!.table).toHaveLength(1);
    expect(own(pressured.action!)).toEqual(own(baseline.action!));
    expect(own(pressured.action!)).toEqual([id('red', 5)]);
    expect(pressured.pressure!.after).toBeLessThan(pressured.pressure!.before);
    expect(pressured.pressure!.pairs).toBeLessThanOrEqual(
      TABLE_PRESSURE_LIMITS.pairs,
    );
    expect(pressured.pressure!.alternatives).toBeLessThanOrEqual(
      TABLE_PRESSURE_LIMITS.alternatives,
    );
    expect(pressured.pressure!.proofs).toBeLessThanOrEqual(
      TABLE_PRESSURE_LIMITS.proofs,
    );
    expect((await choose(view, 'mischief')).action).toEqual(pressured.action);
    expect(view).toEqual(original);
  });

  it('keeps the original plan before a valid target is imminent and on its own finishing move', () => {
    const table = [run('red', 2, 4), run('red', 6, 8)];
    const view = fixture([id('red', 5), id('black', 11)], table);
    view.players.S2 = { ...view.players.S2!, opened: false, rackCount: 1 };
    expect(planTurn(view, 'mischief')).toEqual(planTurn(view, 'juewu'));
    view.players.S2 = { ...view.players.S2, opened: true, rackCount: 2 };
    expect(planTurn(view, 'mischief')).toEqual(planTurn(view, 'juewu'));
    const winning = fixture([id('red', 5)], table);
    winning.players.S2 = { ...winning.players.S2!, opened: true, rackCount: 1 };
    expect(planTurn(winning, 'mischief')).toEqual(planTurn(winning, 'juewu'));
    expect(placed(winning, planTurn(winning, 'mischief').action)).toBe(1);
  });

  it('never performs the second pass before its own opening', () => {
    const view = fixture(
      [id('blue', 12), id('orange', 12), id('red', 12)],
      [group(10)],
      false,
    );
    view.players.S2 = { ...view.players.S2!, opened: true, rackCount: 1 };
    const planned = planTurn(view, 'mischief');
    expect(planned.pressure).toBeUndefined();
    expect(planned).toEqual(planTurn(view, 'juewu'));
    expect(placed(view, planned.action)).toBe(3);
  });
});
