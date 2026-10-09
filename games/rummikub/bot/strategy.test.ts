import { deepStrictEqual } from 'node:assert';
import { describe, expect, it } from 'vitest';
import type { BotDifficulty } from '@tablemax/game-sdk';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { getTile, RULES_VERSION } from '../data/catalog';
import { parseMeld } from '../shared/melds';
import { inspectTurn } from '../shared/turn';
import type { Action, Meld, PlayAction, RummikubView } from '../types';
import { SEARCH_LIMITS, bot, planTurn } from './index';

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
