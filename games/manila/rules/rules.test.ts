import { describe, expect, it } from 'vitest';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { rules } from './index';
import { bot } from '../bot';
import { CARGO, CARGOS, MARKET } from './catalog';
import { turnSeat, validateState, type State } from './state';
import { finalScores, resolveWinners } from './scoring';
import type { Action, ManilaView } from './view';

const seats = ['A', 'B', 'C', 'D'];
const context = (ids = seats, random = { next: () => 0 }) => ({
  seats: ids,
  random,
});
function apply(s: State, a: Action, random = { next: () => 0 }): State {
  const before = JSON.stringify(s),
    actor = turnSeat(s)!;
  const result = rules.apply(s, a, actor, context(s.seats, random))
    .state as State;
  expect(JSON.stringify(s)).toBe(before);
  return validateState(result, s.seats);
}
function fixture(ids = seats): State {
  let s = rules.initialize(context(ids)) as State;
  for (let i = 0; i < ids.length; i++) s = apply(s, { type: 'pass' });
  s = apply(s, { type: 'skip-share' });
  return apply(s, {
    type: 'setup',
    cargos: ['nutmeg', 'silk', 'ginseng'],
    positions: [3, 3, 3],
  });
}
function existing(s: State, id: string, seat: string): void {
  const space = s.spaces.find((x) => x.id === id)!;
  space.occupant = seat;
  s.players[seat]!.usedWorkers++;
  for (const b of s.boats)
    b.crew = s.spaces
      .filter((x) => x.cargo === b.cargo && x.occupant)
      .map((x) => x.occupant!);
}
function finalPlacement(positions = [3, 3, 3]): State {
  const s = fixture();
  s.placementRound = 3;
  s.movement = 2;
  s.boats.forEach((b, i) => {
    b.position = positions[i]!;
  });
  s.dice = [1, 2].map((movement) => ({
    movement,
    values: { nutmeg: 1, silk: 1, ginseng: 1 },
  }));
  return s;
}
function passPlacements(s: State, random = { next: () => 0 }): State {
  for (let i = 0; i < 10 && s.phase === 'place'; i++)
    s = apply(s, { type: 'pass' }, random);
  return s;
}

describe('Manila classic 2005 rules', () => {
  it('pins original printed cargo, berth, market and participant constants', () => {
    expect(CARGO).toEqual({
      nutmeg: { name: '肉豆蔻', payout: 24, costs: [2, 3, 4] },
      silk: { name: '丝绸', payout: 30, costs: [3, 4, 5] },
      ginseng: { name: '人参', payout: 18, costs: [1, 2, 3] },
      jade: { name: '翡翠', payout: 36, costs: [3, 4, 5, 5] },
    });
    expect(MARKET).toEqual([0, 5, 10, 15, 20, 30]);
    expect(() => rules.initialize(context(['A', 'B']))).toThrow();
    expect(() => rules.initialize(context(['A', 'A', 'B']))).toThrow();
  });
  it.each([3, 4, 5])(
    'deals %i players two shares only from each cargo first three, preserving five total',
    (count) => {
      const ids = Array.from({ length: count }, (_, i) => `S${i}`),
        s = rules.initialize(context(ids, new RandomSource(51))) as State;
      expect(validateState(s, ids)).toEqual(s);
      for (const p of Object.values(s.players)) {
        expect(p.cash).toBe(30);
        expect(p.shares).toHaveLength(2);
        expect(p.shares.every((x) => /[1-3]$/.test(x.id))).toBe(true);
      }
      for (const c of CARGOS)
        expect(
          s.stock[c] +
            Object.values(s.players)
              .flatMap((p) => p.shares)
              .filter((x) => x.cargo === c).length,
        ).toBe(5);
    },
  );
  it('all-pass opening retains first seat; winning bidder alone pays and starts placing', () => {
    let s = rules.initialize(context()) as State;
    s = apply(s, { type: 'pass' });
    s = apply(s, { type: 'bid', amount: 3 });
    s = apply(s, { type: 'pass' });
    s = apply(s, { type: 'pass' });
    expect(s.phase).toBe('share');
    expect(s.harborMaster).toBe('B');
    expect(s.players.B!.cash).toBe(27);
    expect(s.players.A!.cash).toBe(30);
    s = apply(s, { type: 'skip-share' });
    s = apply(s, {
      type: 'setup',
      cargos: ['jade', 'ginseng', 'silk'],
      positions: [5, 4, 0],
    });
    expect(turnSeat(s)).toBe('B');
  });
  it('raises strictly, forbids passed re-entry and does not leak or pre-charge losing collateral', () => {
    let s = rules.initialize(context()) as State;
    s.players.A!.cash = 1;
    s = apply(s, { type: 'bid', amount: 13 });
    expect(s.players.A!.cash).toBe(1);
    expect(s.players.A!.shares.every((x) => !x.mortgaged)).toBe(true);
    expect(() =>
      rules.apply(s, { type: 'bid', amount: 13 }, 'B', context()),
    ).toThrow();
    expect(() =>
      rules.apply(s, { type: 'bid', amount: 14 }, 'A', context()),
    ).toThrow();
    s = apply(s, { type: 'pass' });
    s = apply(s, { type: 'pass' });
    s = apply(s, { type: 'pass' });
    expect(s.phase).toBe('financing');
    expect(turnSeat(s)).toBe('A');
    const chosen = s.players.A!.shares[1]!;
    s = apply(s, { type: 'mortgage', shareId: chosen.id });
    expect(s.phase).toBe('share');
    expect(s.players.A!.cash).toBe(0);
    expect(s.players.A!.shares[1]!.mortgaged).toBe(true);
    expect(s.players.A!.shares[0]!.mortgaged).toBe(false);
    const pub = rules.project(s, { role: 'public' }) as ManilaView;
    expect(pub.players.A!.revealedShares).toEqual([]);
  });
  it('forces multiple chosen collateral steps and rejects another owner’s share', () => {
    let s = rules.initialize(context()) as State;
    s.players.A!.cash = 0;
    s = apply(s, { type: 'bid', amount: 24 });
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'pass' });
    expect(s.phase).toBe('financing');
    expect(() =>
      rules.apply(
        s,
        { type: 'mortgage', shareId: s.players.B!.shares[0]!.id },
        'A',
        context(),
      ),
    ).toThrow();
    s = apply(s, { type: 'mortgage', shareId: s.players.A!.shares[1]!.id });
    expect(s.phase).toBe('financing');
    expect(s.players.A!.cash).toBe(12);
    s = apply(s, { type: 'mortgage', shareId: s.players.A!.shares[0]!.id });
    expect(s.phase).toBe('share');
    expect(s.players.A!.cash).toBe(0);
  });
  it('prices one optional share at max(5,market), decreases only corresponding stock', () => {
    let s = rules.initialize(context()) as State;
    for (let i = 0; i < 4; i++) s = apply(s, { type: 'pass' });
    s.market.jade = 20;
    const stock = s.stock.jade;
    s = apply(s, { type: 'buy-share', cargo: 'jade' });
    expect(s.players.A!.cash).toBe(10);
    expect(s.players.A!.shares).toHaveLength(3);
    expect(s.stock.jade).toBe(stock - 1);
    expect(s.phase).toBe('setup');
    expect(() =>
      rules.apply(s, { type: 'buy-share', cargo: 'jade' }, 'A', context()),
    ).toThrow();
  });
  it('enumerates all 600 lane configurations and validates exact parameters and actors', () => {
    let s = rules.initialize(context()) as State;
    for (let i = 0; i < 4; i++) s = apply(s, { type: 'pass' });
    s = apply(s, { type: 'skip-share' });
    expect(
      rules.legalActions(s, 'A').filter((x) => (x as Action).type === 'setup'),
    ).toHaveLength(600);
    for (const a of [
      { type: 'setup', cargos: ['jade', 'silk', 'jade'], positions: [3, 3, 3] },
      {
        type: 'setup',
        cargos: ['jade', 'silk', 'ginseng'],
        positions: [6, 2, 1],
      },
      {
        type: 'setup',
        cargos: ['jade', 'silk', 'ginseng'],
        positions: [3, 3, 2],
      },
      { type: 'pass', extra: 1 },
    ])
      expect(() => rules.validateAction(a)).toThrow();
    expect(() =>
      rules.apply(
        s,
        {
          type: 'setup',
          cargos: ['jade', 'silk', 'ginseng'],
          positions: [3, 3, 3],
        },
        'D',
        context(),
      ),
    ).toThrow();
  });
  it('allows only cheapest vacant crew and first pirate berth; preserves input immutability', () => {
    let s = fixture();
    expect(rules.legalActions(s, 'A')).toContainEqual({
      type: 'place',
      space: 'cargo-nutmeg-0',
    });
    expect(rules.legalActions(s, 'A')).not.toContainEqual({
      type: 'place',
      space: 'cargo-nutmeg-1',
    });
    expect(rules.legalActions(s, 'A')).not.toContainEqual({
      type: 'place',
      space: 'pirate-1',
    });
    s = apply(s, { type: 'place', space: 'cargo-nutmeg-0' });
    expect(s.players.A!.cash).toBe(28);
    expect(s.boats[0]!.crew).toEqual(['A']);
  });
  it('three players place twice before first roll and receive four workers', () => {
    let s = fixture(['A', 'B', 'C']);
    for (let i = 0; i < 3; i++)
      s = apply(s, {
        type: 'place',
        space: `cargo-${['nutmeg', 'silk', 'ginseng'][i]}-0`,
      });
    expect(s.movement).toBe(0);
    expect(s.placementRound).toBe(2);
    expect(turnSeat(s)).toBe('A');
    for (let i = 0; i < 3; i++)
      s = apply(s, {
        type: 'place',
        space: `cargo-${['nutmeg', 'silk', 'ginseng'][i]}-1`,
      });
    expect(s.movement).toBe(1);
    expect(s.placementRound).toBe(3);
    expect(
      (rules.project(s, { role: 'public' }) as ManilaView).players.A!
        .availableWorkers,
    ).toBe(2);
  });
  it('passing permanently forfeits subsequent placements in that voyage, but sail still resolves', () => {
    let s = fixture();
    s = apply(s, { type: 'pass' });
    expect(rules.legalActions(s, 'A')).toEqual([]);
    s = passPlacements(s);
    expect(s.phase).toBe('round-result');
    expect(s.movement).toBe(3);
  });
  it('2005 insolvent blind passenger may take paid posts, consumes all funds and cannot insure', () => {
    let s = fixture();
    s.players.A!.cash = 1;
    s.players.A!.shares.forEach((x) => {
      x.mortgaged = true;
    });
    // Cheapest post is ginseng at 1: no blind privilege while it is affordable.
    expect(rules.legalActions(s, 'A')).not.toContainEqual({
      type: 'place',
      space: 'port-2',
    });
    s.players.A!.cash = 0;
    expect(rules.legalActions(s, 'A')).toContainEqual({
      type: 'place',
      space: 'port-0',
    });
    expect(rules.legalActions(s, 'A')).not.toContainEqual({
      type: 'place',
      space: 'insurance',
    });
    s = apply(s, { type: 'place', space: 'port-0' });
    expect(s.players.A!.cash).toBe(0);
  });
  it('second-roll pirates board free in captain order, cannot displace full crews, promote remaining pirate', () => {
    let s = finalPlacement([13, 13, 9]);
    s.placementRound = 2;
    s.phase = 'board';
    s.boardQueue = [0, 1];
    s.boardCursor = 0;
    existing(s, 'pirate-0', 'B');
    existing(s, 'pirate-1', 'C');
    for (let i = 0; i < 3; i++) existing(s, `cargo-nutmeg-${i}`, 'D');
    validateState(s, seats);
    expect(rules.legalActions(s, 'B')).toContainEqual({
      type: 'board',
      cargo: 'silk',
    });
    expect(rules.legalActions(s, 'B')).not.toContainEqual({
      type: 'board',
      cargo: 'nutmeg',
    });
    s = apply(s, { type: 'board', cargo: 'silk' });
    expect(turnSeat(s)).toBe('C');
    expect(s.boats[1]!.crew).toEqual(['B']);
    expect(s.players.B!.cash).toBe(30);
    s = apply(s, { type: 'board', cargo: null });
    expect(s.phase).toBe('place');
    expect(s.spaces.find((x) => x.id === 'pirate-0')!.occupant).toBe('C');
    expect(s.spaces.find((x) => x.id === 'pirate-1')!.occupant).toBeNull();
  });
  it('pilots act small then large; pilot reaching 13 triggers no pirate and exceeding it docks', () => {
    let s = finalPlacement([12, 12, 10]);
    existing(s, 'pilot-small', 'B');
    existing(s, 'pilot-large', 'C');
    existing(s, 'pirate-0', 'D');
    s = passPlacements(s);
    expect(s.phase).toBe('pilot-small');
    s = apply(s, { type: 'pilot', moves: [{ cargo: 'nutmeg', delta: 1 }] });
    expect(s.phase).toBe('pilot-large');
    expect(s.boats[0]!.plundered).toBe(false);
    s = apply(s, {
      type: 'pilot',
      moves: [
        { cargo: 'nutmeg', delta: 1 },
        { cargo: 'silk', delta: -1 },
      ],
    });
    expect(s.boats[0]!.destination).toBe('port');
    expect(s.boats[0]!.plundered).toBe(false);
  });
  it('small pilot rejects ±2; large supports one ±2 or two ±1 but never offboard backwards', () => {
    const s = finalPlacement([0, 8, 9]);
    s.phase = 'pilot-small';
    existing(s, 'pilot-small', 'A');
    expect(() =>
      rules.apply(
        s,
        { type: 'pilot', moves: [{ cargo: 'silk', delta: 2 }] },
        'A',
        context(),
      ),
    ).toThrow();
    expect(rules.legalActions(s, 'A')).not.toContainEqual({
      type: 'pilot',
      moves: [{ cargo: 'nutmeg', delta: -1 }],
    });
    s.phase = 'pilot-large';
    existing(s, 'pilot-large', 'A');
    expect(rules.legalActions(s, 'A')).toContainEqual({
      type: 'pilot',
      moves: [{ cargo: 'silk', delta: 2 }],
    });
    expect(rules.legalActions(s, 'A')).toContainEqual({
      type: 'pilot',
      moves: [
        { cargo: 'silk', delta: 1 },
        { cargo: 'ginseng', delta: -1 },
      ],
    });
  });
  it('third-roll exact13 with no pirates arrives, increments market and crew divide whole cargo payout', () => {
    let s = finalPlacement([12, 13, 4]);
    existing(s, 'cargo-nutmeg-0', 'B');
    existing(s, 'cargo-nutmeg-1', 'C');
    existing(s, 'port-0', 'B');
    s = passPlacements(s);
    expect(s.phase).toBe('round-result');
    expect(s.boats[0]!.destination).toBe('port');
    expect(s.players.B!.cash).toBe(48);
    expect(s.players.C!.cash).toBe(42);
    expect(s.market.nutmeg).toBe(5);
  });
  it('third-roll pirates clear crew and split loot, captain chooses independent destinations', () => {
    let s = finalPlacement([12, 12, 3]);
    existing(s, 'pirate-0', 'B');
    existing(s, 'pirate-1', 'C');
    existing(s, 'cargo-nutmeg-0', 'A');
    s = passPlacements(s);
    expect(s.phase).toBe('plunder');
    expect(s.boats[0]!.crew).toEqual([]);
    expect(turnSeat(s)).toBe('B');
    s = apply(s, { type: 'plunder', cargo: 'nutmeg', destination: 'port' });
    expect(s.phase).toBe('plunder');
    s = apply(s, { type: 'plunder', cargo: 'silk', destination: 'shipyard' });
    expect(s.phase).toBe('round-result');
    expect(s.players.B!.cash).toBe(57);
    expect(s.players.C!.cash).toBe(57);
    expect(s.players.A!.cash).toBe(30);
    expect(s.market.nutmeg).toBe(5);
    expect(s.market.silk).toBe(0);
  });
  it('insurance pays 6/8/15 for occupied and empty repair slots, except its own claim', () => {
    let s = finalPlacement();
    existing(s, 'insurance', 'A');
    s.players.A!.cash += 10;
    existing(s, 'shipyard-0', 'A');
    existing(s, 'shipyard-1', 'B');
    s = passPlacements(s);
    expect(s.players.A!.cash).toBe(17);
    expect(s.players.B!.cash).toBe(38);
    expect(s.players.C!.cash).toBe(30);
    expect(s.phase).toBe('round-result');
  });
  it('insurer receives all other income first, then chooses collateral, bank covers irrecoverable shortfall', () => {
    let s = finalPlacement();
    existing(s, 'insurance', 'A');
    existing(s, 'shipyard-2', 'B');
    s.players.A!.cash = 0;
    s = passPlacements(s);
    expect(s.phase).toBe('financing');
    expect(s.payment?.amount).toBe(29);
    expect(s.players.B!.cash).toBe(45);
    s = apply(s, { type: 'mortgage', shareId: s.players.A!.shares[1]!.id });
    expect(s.phase).toBe('financing');
    s = apply(s, { type: 'mortgage', shareId: s.players.A!.shares[0]!.id });
    expect(s.phase).toBe('round-result');
    expect(s.players.A!.cash).toBe(0);
    expect(s.players.B!.cash).toBe(45);
    expect(s.players.A!.shares.every((x) => x.mortgaged)).toBe(true);
  });
  it('restores insurer’s mandatory collateral choice and rejects missing settlement/forged amount', () => {
    let s = finalPlacement();
    existing(s, 'insurance', 'A');
    s.players.A!.cash = 0;
    s = passPlacements(s);
    expect(validateState(JSON.parse(JSON.stringify(s)), seats)).toEqual(s);
    const missing = structuredClone(s);
    missing.settlementBefore = null;
    expect(() => validateState(missing, seats)).toThrow();
    const forged = structuredClone(s);
    forged.payment!.amount++;
    expect(() => validateState(forged, seats)).toThrow();
  });
  it('2005 scoring counts every share even mortgaged, subtracts 15 and has shared ties', () => {
    const s = fixture();
    s.market = { nutmeg: 20, silk: 30, ginseng: 10, jade: 5 };
    s.players.A!.shares[0]!.mortgaged = true;
    const expected =
      30 + s.players.A!.shares.reduce((n, x) => n + s.market[x.cargo], 0) - 15;
    expect(finalScores(s).A).toBe(expected);
    expect(resolveWinners({ A: 100, B: 100, C: 99 }, ['A', 'B', 'C'])).toEqual([
      'A',
      'B',
    ]);
    const before = finalScores(s).A;
    s.players.A!.cash -= 15;
    s.players.A!.shares[0]!.mortgaged = false;
    expect(finalScores(s).A).toBe(before);
  });
  it('repayment costs15 and makes identity public, mortgage by itself keeps initially concealed cargo private', () => {
    let s = fixture();
    const id = s.players.A!.shares[0]!.id;
    s = apply(s, { type: 'mortgage', shareId: id });
    expect(
      (rules.project(s, { role: 'public' }) as ManilaView).players.A!
        .revealedShares,
    ).toEqual([]);
    s = apply(s, { type: 'repay', shareId: id });
    expect(s.players.A!.cash).toBe(27);
    expect(
      (rules.project(s, { role: 'public' }) as ManilaView).players.A!
        .revealedShares[0]!.id,
    ).toBe(id);
  });
  it('increments 20 straight to30, ends atomically, reveals final scores and rejects further actions', () => {
    let s = finalPlacement([13, 0, 0]);
    s.market.nutmeg = 20;
    s = passPlacements(s);
    expect(s.phase).toBe('ended');
    expect(s.market.nutmeg).toBe(30);
    expect(rules.decisions(s)).toEqual([]);
    expect(rules.lifecycleActions(s)).toEqual([]);
    expect(s.scores).toEqual(finalScores(s));
    expect(() =>
      rules.apply(s, { type: 'next-voyage' }, 'A', context()),
    ).toThrow();
  });
  it('projects only own hidden shares, no mutable aliases, and invalid player gets public information', () => {
    const s = fixture(),
      pub = rules.project(s, { role: 'public' }) as ManilaView,
      a = rules.project(s, { role: 'player', seatId: 'A' }) as ManilaView;
    expect(pub.self).toBeNull();
    expect(a.self!.shares).toHaveLength(2);
    expect(
      Object.values(pub.players).every((p) => p.revealedShares.length === 0),
    ).toBe(true);
    expect(rules.project(s, { role: 'player', seatId: 'X' })).toEqual(pub);
    a.self!.shares[0]!.cargo = 'jade';
    a.players.B!.cash = 0;
    expect(s.players.B!.cash).toBe(30);
    expect(rules.project(s, { role: 'public' })).toEqual(pub);
  });
  it.each(['version', 'stock', 'crew', 'phase', 'seats', 'unknown'])(
    'rejects tampered save invariant %s',
    (key) => {
      const s = fixture();
      if (key === 'version') s.version = 2 as 1;
      if (key === 'stock') s.stock.jade++;
      if (key === 'crew') s.boats[0]!.crew = ['A'];
      if (key === 'phase') s.phase = 'board';
      if (key === 'seats') s.seats.reverse();
      if (key === 'unknown')
        (s as unknown as Record<string, unknown>).cheat = true;
      expect(() => validateState(s, seats)).toThrow();
    },
  );
  it('lifecycle only advances settled voyages and preserves immutable share/market economy', () => {
    const s = passPlacements(fixture()),
      next = rules.applyLifecycle(s, { type: 'next-voyage' }, context())
        .state as State;
    expect(validateState(next, seats)).toEqual(next);
    expect(next.voyage).toBe(2);
    expect(next.phase).toBe('auction');
    expect(next.players.A!.shares).toEqual(s.players.A!.shares);
    expect(next.market).toEqual(s.market);
    expect(() =>
      rules.applyLifecycle(fixture(), { type: 'next-voyage' }, context()),
    ).toThrow();
  });
});

describe('Manila authorized local strategies', () => {
  it.each(['default', 'doubao', 'juewu'] as const)(
    'completes original 3/4/5-player seeded games with %s and validates every saved decision',
    async (difficulty) => {
      for (const count of [3, 4, 5]) {
        const ids = Array.from({ length: count }, (_, i) => `P${i}`),
          random = new RandomSource(count * 91),
          strategyRandom = new RandomSource(count * 251);
        let s = rules.initialize(context(ids, random)) as State;
        for (let step = 0; step < 3000 && !rules.ended(s); step++) {
          const decision = rules.decisions(s)[0]!;
          expect(decision).toBeDefined();
          const actions = rules.legalActions(s, decision.seatId),
            view = rules.project(s, {
              role: 'player',
              seatId: decision.seatId,
            });
          const { action } = await bot.decide({
            view,
            actions,
            decision,
            memory: null,
            difficulty,
            random: strategyRandom,
            signal: new AbortController().signal,
          });
          expect(rules.isLegalAction!(s, action, decision.seatId)).toBe(true);
          s = apply(s, action as Action, random);
          if (step % 17 === 0)
            s = validateState(JSON.parse(JSON.stringify(s)), ids);
        }
        expect(s.phase).toBe('ended');
        expect(s.winners.length).toBeGreaterThan(0);
      }
    },
  );
  it('replays identical rule and strategy seeds byte-for-byte and restores the same pending result', async () => {
    async function play() {
      let s = fixture();
      const rng = new RandomSource(144),
        brng = new RandomSource(391);
      for (let n = 0; n < 70 && !rules.ended(s); n++) {
        const decision = rules.decisions(s)[0]!;
        const { action } = await bot.decide({
          view: rules.project(s, { role: 'player', seatId: decision.seatId }),
          actions: rules.legalActions(s, decision.seatId),
          decision,
          memory: null,
          difficulty: 'juewu',
          random: brng,
          signal: new AbortController().signal,
        });
        s = apply(s, action as Action, rng);
      }
      return s;
    }
    expect(await play()).toEqual(await play());
  });
  it('rejects incompatible bot memory and respects cancellation', async () => {
    expect(() => bot.validateMemory({})).toThrow();
    const s = fixture(),
      decision = rules.decisions(s)[0]!,
      abort = new AbortController();
    abort.abort();
    await expect(
      bot.decide({
        view: rules.project(s, { role: 'player', seatId: 'A' }),
        actions: rules.legalActions(s, 'A'),
        decision,
        memory: null,
        difficulty: 'default',
        random: new RandomSource(1),
        signal: abort.signal,
      }),
    ).rejects.toThrow('cancelled');
  });
});
