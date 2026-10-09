import { expect, it } from 'vitest';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { TILE_IDS } from '../data/catalog';
import { parseMeld } from '../shared/melds';
import { findLegalPlay } from '../shared/turn';
import type { Meld } from '../types';
import { applyAction, initialize, nextGame } from './engine';
import { isLegalAction, rules } from './index';
import { project } from './project';
import { matchWinners } from './scoring';
import { validateState } from './state';

const ids = (color: string, ...values: number[]) =>
  values.map((value) => `${color}-${String(value).padStart(2, '0')}-a`);
const context = () => ({ seats: ['a', 'b'], random: new RandomSource(73) });
function fixture(rack: string[], table: Meld[] = [], emptyPool = false) {
  const s = initialize(context());
  const used = [...rack, ...table.flatMap((m) => m.tiles.map((p) => p.tileId))];
  const rest = TILE_IDS.filter((id) => !used.includes(id));
  s.racks = { a: rack, b: emptyPool ? rest : rest.slice(0, 14) };
  s.pool = emptyPool ? [] : rest.slice(14);
  s.table = table;
  s.opened = { a: table.length > 0, b: table.length > 0 };
  s.startSeat = 'a';
  s.turnSeat = 'a';
  s.turnNumber = 3;
  s.serial = 2;
  s.latest = {
    serial: 2,
    actor: 'b',
    verb: 'draw',
    text: 'fixture',
    placedTileIds: [],
  };
  return s;
}
it('初始化二至四人每人十四张，唯一物理分区并且纯输入', () => {
  for (const count of [2, 3, 4]) {
    const seats = ['a', 'b', 'c', 'd'].slice(0, count);
    const s = initialize({ seats, random: new RandomSource(147 + count) });
    expect(s.gameCount).toBe(count);
    expect(s.pool.length).toBe(106 - 14 * count);
    expect(seats.map((seat) => s.racks[seat]!.length)).toEqual(
      Array(count).fill(14),
    );
    expect(validateState(s, seats)).toEqual(s);
    expect(s.turnSeat).toBe(s.startSeat);
  }
});
it('摸牌自愿合法并立即结束，摸到的牌不在公开投影或事件', () => {
  const s = fixture(ids('black', 10, 11, 12));
  const before = structuredClone(s);
  const drawn = s.pool[0]!;
  const next = applyAction(s, { type: 'draw' }, 'a', context());
  expect(s).toEqual(before);
  expect(next.turnSeat).toBe('b');
  expect(next.racks.a).toContain(drawn);
  expect(next.latest!.placedTileIds).toEqual([]);
  expect(project(next, { role: 'public' }).self).toBeNull();
  expect(JSON.stringify(project(next, { role: 'public' }))).not.toContain(
    drawn,
  );
  expect(() => applyAction(next, { type: 'draw' }, 'a', context())).toThrow(
    /尚未轮到/,
  );
});
it('整回合一笔保存原子终局，下一局重发并保留累计', () => {
  const s = fixture(ids('black', 10, 11, 12));
  const action = {
    type: 'submit-turn' as const,
    table: [parseMeld(s.racks.a!)!],
  };
  const next = applyAction(s, action, 'a', context());
  expect(next.phase).toBe('game-result');
  expect(next.racks.a).toEqual([]);
  expect(next.results[0]!.winners).toEqual(['a']);
  expect(validateState(next, ['a', 'b'])).toEqual(next);
  const second = nextGame(next, context());
  expect(second.phase).toBe('playing');
  expect(second.gameNumber).toBe(2);
  expect(second.racks.a).toHaveLength(14);
  expect(second.racks.b).toHaveLength(14);
  expect(second.wins.a).toBe(1);
  expect(second.results).toEqual(next.results);
  expect(validateState(second, ['a', 'b'])).toEqual(second);
  expect(rules.lifecycleActions(second as never)).toEqual([]);
});
it('空池仍可重组时不能自愿跳过，预算不代替无解', () => {
  const table = [parseMeld(ids('blue', 1, 2, 3))!];
  const s = fixture(ids('blue', 4), table, true);
  expect(isLegalAction(s, { type: 'pass' }, 'a')).toBe(false);
  expect(isLegalAction(s, { type: 'draw' }, 'a')).toBe(false);
  const action = findLegalPlay({
    rack: s.racks.a!,
    table: s.table,
    opened: true,
  }).action;
  expect(action).not.toBeNull();
  expect(isLegalAction(s, action, 'a')).toBe(true);
});
it('稠密桌面真实无解完成穷尽，强制跳过不伪造堵局', () => {
  const table: Meld[] = [parseMeld(['blue-01-a', 'orange-01-a', 'red-01-b'])!];
  for (const value of [3, 5, 7, 9, 11, 13])
    for (const copy of ['a', 'b'])
      table.push(
        parseMeld(
          ['blue', 'orange', 'red'].map(
            (color) => `${color}-${String(value).padStart(2, '0')}-${copy}`,
          ),
        )!,
      );
  const s = fixture(['red-01-a'], table, true);
  const started = performance.now();
  const result = findLegalPlay({ rack: s.racks.a!, table, opened: true });
  const elapsed = performance.now() - started;
  expect(result).toMatchObject({ action: null, complete: true });
  expect(elapsed).toBeLessThan(1500);
  expect(result.nodes).toBeLessThan(10000);
  const next = applyAction(s, { type: 'pass' }, 'a', context());
  expect(next.passed).toEqual(['a']);
  expect(next.phase).toBe('playing');
  expect(validateState(next, ['a', 'b'])).toEqual(next);
});
it('双百搭稠密无解按真实计数穷尽并记录节点和耗时', () => {
  const table: Meld[] = [parseMeld(['blue-01-a', 'orange-01-a', 'red-01-b'])!];
  for (const value of [3, 5, 7, 9, 11, 13])
    for (const copy of ['a', 'b']) {
      const group = ['blue', 'orange', 'red'].map(
        (color) => `${color}-${String(value).padStart(2, '0')}-${copy}`,
      );
      const jokerId =
        copy === 'b' && value === 13
          ? 'joker-a'
          : copy === 'b' && value === 11
            ? 'joker-b'
            : null;
      if (jokerId) group[2] = jokerId;
      table.push(
        parseMeld(
          group,
          jokerId ? { [jokerId]: { color: 'red', value } } : {},
        )!,
      );
    }
  const started = performance.now();
  const result = findLegalPlay(
    { rack: ['red-01-a'], table, opened: true },
    { maxNodes: 50000 },
  );
  const elapsed = performance.now() - started;
  console.info(
    '拉密双百搭无解搜索',
    JSON.stringify({
      tableTiles: 39,
      rackTiles: 1,
      nodes: result.nodes,
      complete: result.complete,
      elapsedMs: elapsed,
    }),
  );
  expect(result).toMatchObject({ action: null, complete: true });
  expect(elapsed).toBeLessThan(1500);
});
it('四人空池全员穷尽无解到堵局保存后下一局重发并累计', () => {
  const seats = ['a', 'b', 'c', 'd'];
  const fourContext = { seats, random: new RandomSource(73) };
  const table: Meld[] = [parseMeld(['blue-01-a', 'orange-01-a', 'red-01-b'])!];
  for (const value of [3, 5, 7, 9, 11, 13])
    for (const copy of ['a', 'b']) {
      const group = ['blue', 'orange', 'red'].map(
        (color) => `${color}-${String(value).padStart(2, '0')}-${copy}`,
      );
      const jokerId =
        copy === 'b' && value === 13
          ? 'joker-a'
          : copy === 'b' && value === 11
            ? 'joker-b'
            : null;
      if (jokerId) group[2] = jokerId;
      table.push(
        parseMeld(
          group,
          jokerId ? { [jokerId]: { color: 'red', value } } : {},
        )!,
      );
    }
  const copies = (color: string, values: number[]) =>
    values.flatMap((value) =>
      ['a', 'b'].map(
        (copy) => `${color}-${String(value).padStart(2, '0')}-${copy}`,
      ),
    );
  const odd = [1, 3, 5, 7, 9, 11, 13],
    even = [2, 4, 6, 8, 10, 12];
  // This synthetic legal 106-tile partition isolates the exhausted-pool
  // lifecycle. It does not claim a naturally played route to this table.
  let state = initialize(fourContext);
  state.table = table;
  state.pool = [];
  state.racks = {
    a: ['red-01-a'],
    b: [...copies('black', odd), ...copies('blue', even), 'red-11-b'],
    c: [...copies('black', even), ...copies('orange', even), 'red-13-b'],
    d: [...copies('red', even), 'blue-01-b', 'orange-01-b'],
  };
  state.opened = { a: true, b: false, c: false, d: false };
  state.startSeat = 'a';
  state.turnSeat = 'a';
  state.turnNumber = 5;
  state.serial = 4;
  state.latest = {
    serial: 4,
    actor: 'd',
    verb: 'draw',
    text: '合成合法分区：空牌池堵局边界',
    placedTileIds: [],
  };
  const roundtrip = (input: typeof state) =>
    validateState(JSON.parse(JSON.stringify(input)), seats);
  expect(seats.map((seat) => state.racks[seat]!.length)).toEqual([
    1, 27, 25, 14,
  ]);
  expect(roundtrip(state)).toEqual(state);
  const proofs: { seat: string; nodes: number }[] = [];
  const started = performance.now();
  for (const [index, seat] of seats.entries()) {
    const proof = findLegalPlay({
      rack: state.racks[seat]!,
      table: state.table,
      opened: state.opened[seat]!,
    });
    expect(proof).toMatchObject({ action: null, complete: true });
    proofs.push({ seat, nodes: proof.nodes });
    expect(isLegalAction(state, { type: 'pass' }, seat)).toBe(true);
    const before = structuredClone(state);
    const next = applyAction(state, { type: 'pass' }, seat, fourContext);
    expect(state).toEqual(before);
    expect(next.passed).toEqual(seats.slice(0, index + 1));
    expect(next.table).toEqual(state.table);
    expect(next.racks).toEqual(state.racks);
    expect(next.serial).toBe(state.serial + 1);
    expect(next.latest).toMatchObject({
      actor: seat,
      verb: 'pass',
      placedTileIds: [],
    });
    expect(next.phase).toBe(index === 3 ? 'game-result' : 'playing');
    expect(next.turnSeat).toBe(index === 3 ? null : seats[index + 1]);
    state = roundtrip(next);
    expect(state).toEqual(next);
  }
  expect(state.results).toEqual([
    {
      gameNumber: 1,
      reason: 'blocked',
      winners: ['a'],
      rackValues: { a: 1, b: 193, c: 181, d: 86 },
      scores: { a: 457, b: -192, c: -180, d: -85 },
    },
  ]);
  expect(state.scores).toEqual({ a: 457, b: -192, c: -180, d: -85 });
  expect(state.wins).toEqual({ a: 1, b: 0, c: 0, d: 0 });
  expect(Object.values(state.scores).reduce((sum, n) => sum + n, 0)).toBe(0);
  expect(rules.lifecycleActions(state as never)).toEqual([
    { type: 'next-game' },
  ]);
  const beforeNextGame = structuredClone(state);
  const second = nextGame(state, fourContext);
  expect(state).toEqual(beforeNextGame);
  expect(second).toMatchObject({
    phase: 'playing',
    gameNumber: 2,
    gameCount: 4,
    turnNumber: 1,
    table: [],
    passed: [],
    opened: { a: false, b: false, c: false, d: false },
    wins: state.wins,
    scores: state.scores,
    results: state.results,
  });
  expect(seats.map((seat) => second.racks[seat]!.length)).toEqual([
    14, 14, 14, 14,
  ]);
  expect(second.pool).toHaveLength(50);
  expect(second.turnSeat).toBe(second.startSeat);
  expect(roundtrip(second)).toEqual(second);
  console.info(
    '拉密四人空池堵局完整链',
    JSON.stringify({
      syntheticPartition: true,
      tableTiles: 39,
      rackTiles: [1, 27, 25, 14],
      proofs,
      elapsedMs: performance.now() - started,
      result: state.results[0],
      nextGame: second.gameNumber,
    }),
  );
});
it('损坏存档不能复制牌、改变公开牌面或伪造计分与旧席位', () => {
  const s = initialize(context());
  const duplicate = structuredClone(s);
  duplicate.pool[0] = duplicate.racks.a![0]!;
  expect(() => validateState(duplicate, ['a', 'b'])).toThrow();
  const badScore = structuredClone(s);
  badScore.scores.a = 10;
  expect(() => validateState(badScore, ['a', 'b'])).toThrow();
  expect(() => validateState(s, ['b', 'a'])).toThrow();
  const forgedFeedback = structuredClone(s);
  forgedFeedback.serial = 1;
  forgedFeedback.latest = {
    serial: 1,
    actor: 'a',
    verb: 'draw',
    text: '摸牌',
    placedTileIds: [s.racks.a![0]!],
  };
  expect(() => validateState(forgedFeedback, ['a', 'b'])).toThrow();
});
it('重排他人秘密和牌池不改变公共或本人授权投影', () => {
  const s = initialize(context());
  const changed = structuredClone(s);
  changed.racks.b!.reverse();
  changed.pool.reverse();
  expect(validateState(changed, ['a', 'b'])).toEqual(changed);
  expect(project(changed, { role: 'public' })).toEqual(
    project(s, { role: 'public' }),
  );
  expect(project(changed, { role: 'player', seatId: 'a' })).toEqual(
    project(s, { role: 'player', seatId: 'a' }),
  );
});
it('终场先比赢局数，再比较累计分，同分共同赢家', () => {
  expect(
    matchWinners(
      ['a', 'b', 'c'],
      { a: 2, b: 1, c: 2 },
      { a: 10, b: 100, c: 20 },
    ),
  ).toEqual(['c']);
  expect(
    matchWinners(
      ['a', 'b', 'c'],
      { a: 2, b: 1, c: 2 },
      { a: 20, b: 100, c: 20 },
    ),
  ).toEqual(['a', 'c']);
});
