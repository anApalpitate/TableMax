import { afterAll, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { forecast, nextBid } from '../bot/planner';
const strategyMetrics: unknown[] = [];
afterAll(() => {
  if (strategyMetrics.length && process.env.TABLEMAX_STRATEGY_METRICS)
    writeFileSync(
      process.env.TABLEMAX_STRATEGY_METRICS,
      JSON.stringify(strategyMetrics, null, 2),
    );
  if (strategyMetrics.length)
    console.info(
      'POWER_GRID_STRATEGY_METRICS=' + JSON.stringify(strategyMetrics),
    );
});
import { RandomSource } from '../../../packages/platform-core/src/random';
import { emptyStock, getPlant, PLANT_IDS, RESOURCES } from '../data/catalog';
import {
  income,
  price,
  replenishment,
  settingsFor,
  TOTAL_RESOURCES,
} from '../data/economy';
import { CITIES } from '../data/germany';
import type { Action, OwnedPlant, PowerGridView, Stock } from '../types';
import { bot, chooseAction } from '../bot';
import {
  decisions,
  initialize,
  legalActions,
  regionChoices,
  rules,
  validateAction,
  validateState,
  type State,
} from './index';
import { maximumProduction } from './production';
import { MarketFlow } from './market';
import { resourcePurchaseCost } from './resource-purchase';

const context = (seats: readonly string[], seed = 1) => ({
  seats,
  random: new RandomSource(seed),
});
function setup(count = 4, seed = 1): State {
  const seats = Array.from({ length: count }, (_, i) => `S${i + 1}`);
  const s = initialize(context(seats, seed));
  return apply(s, legalActions(s, s.actor!)[0]!);
}
function apply(s: State, action: Action, seat = s.actor!): State {
  const before = structuredClone(s);
  for (const legal of legalActions(s, seat))
    expect(JSON.stringify(validateAction(legal))).toBe(JSON.stringify(legal));
  const next = rules.apply(
    s,
    action,
    seat,
    context(s.seatOrder, s.actionSerial + 7),
  ).state as State;
  expect(s).toEqual(before);
  expect(validateState(JSON.parse(JSON.stringify(next)), s.seatOrder)).toEqual(
    next,
  );
  if (next.actor) expect(decisions(next)[0]!.id).not.toBe(decisions(s)[0]?.id);
  return next;
}
// Explicit state fixtures retain conservation and all deck partitions.
function fixture(
  plants: number[][],
  phase: State['phase'] = 'building',
  step: 1 | 2 | 3 = 1,
): State {
  const seats = plants.map((_, i) => `S${i + 1}`);
  const s = initialize(context(seats, 4));
  s.regions = regionChoices(settingsFor(seats.length).regions)[0]!;
  s.round = 2;
  s.actionSerial = 1;
  s.phase = phase;
  s.step = step;
  s.actor = phase === 'powering' ? s.playerOrder[0]! : s.playerOrder.at(-1)!;
  s.bought = [...seats];
  s.phaseIndex = 0;
  const owned = plants.flat();
  s.players = Object.fromEntries(
    seats.map((seat, index) => [
      seat,
      {
        cash: 1000,
        plants: plants[index]!.map((id) => ({ id, resources: emptyStock() })),
        cities: [],
        powered: 0,
        ran: [],
        produced: 0,
      },
    ]),
  );
  s.hiddenRemoved = PLANT_IDS.filter(
    (id) => id > 10 && id !== 13 && !owned.includes(id),
  ).slice(0, settingsFor(seats.length).removed);
  const remaining = PLANT_IDS.filter(
    (id) => !owned.includes(id) && !s.hiddenRemoved.includes(id),
  );
  s.market = remaining.slice(0, step === 3 ? 6 : 8);
  s.deck = [...remaining.slice(s.market.length), ...(step === 3 ? [] : [0])];
  s.removed = step === 3 ? [0] : [];
  s.incomeIssued = 1000 * seats.length - 50 * seats.length;
  s.spent = 0;
  return s;
}
function fuel(s: State, seat: string, id: number, stock: Partial<Stock>) {
  const owned = s.players[seat]!.plants.find((p) => p.id === id)!;
  for (const resource of RESOURCES) {
    const add = stock[resource] ?? 0;
    owned.resources[resource] += add;
    const market = Math.min(add, s.resources[resource]);
    s.resources[resource] -= market;
    s.supply[resource] -= add - market;
  }
}
function cities(s: State, seat: string, count: number) {
  s.players[seat]!.cities = CITIES.filter((c) => s.regions.includes(c.region))
    .slice(0, count)
    .map((c) => c.id);
  const max = Math.max(...Object.values(s.players).map((p) => p.cities.length));
  // Move obsolete fixture market cards to removed; use higher unowned cards.
  while (s.market[0]! <= max) {
    s.removed.push(s.market.shift()!);
    const index = s.deck.findIndex((id) => id > max);
    s.market.push(s.deck.splice(index, 1)[0]!);
    s.market.sort((a, b) => a - b);
  }
}
function nextStep3(s: State) {
  s.deck = [0, ...s.deck.filter((id) => id !== 0)];
}

describe('Power Grid classic risk boundaries', () => {
  it('uses the classic 42 plants, exact player settings and original economy tables', () => {
    expect(PLANT_IDS).toEqual([
      ...Array.from({ length: 38 }, (_, i) => i + 3),
      42,
      44,
      46,
      50,
    ]);
    for (const count of [2, 3, 4, 5, 6]) {
      const s = initialize(
        context(
          Array.from({ length: count }, (_, i) => `S${i}`),
          count,
        ),
      );
      validateState(s, s.seatOrder);
      expect(s.market).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
      expect(s.deck[0]).toBe(13);
      expect(s.hiddenRemoved).toHaveLength(settingsFor(count).removed);
      expect(s.hiddenRemoved).not.toContain(13);
      expect(s.deck).toHaveLength(35 - settingsFor(count).removed);
      expect(s.players.S0!.cash).toBe(50);
    }
    expect([2, 3, 4, 5, 6].map(settingsFor)).toEqual([
      { regions: 3, removed: 8, plantLimit: 4, step2: 10, end: 21 },
      { regions: 3, removed: 8, plantLimit: 3, step2: 7, end: 17 },
      { regions: 4, removed: 4, plantLimit: 3, step2: 7, end: 17 },
      { regions: 5, removed: 0, plantLimit: 3, step2: 7, end: 15 },
      { regions: 5, removed: 0, plantLimit: 3, step2: 6, end: 14 },
    ]);
    expect(replenishment(3, 2)).toEqual({
      coal: 5,
      oil: 3,
      garbage: 2,
      uranium: 1,
    });
    expect([0, 1, 6, 12, 17, 20, 21].map(income)).toEqual([
      10, 22, 73, 118, 142, 150, 150,
    ]);
    expect([
      price('coal', 24),
      price('coal', 21),
      price('coal', 1),
      price('oil', 18),
      price('garbage', 6),
      price('uranium', 2),
      price('uranium', 0),
    ]).toEqual([1, 2, 8, 3, 7, 14, null]);
  });
  it('enforces ordered auctioning, distinct pass scopes and first-round purchase', () => {
    let s = setup(4, 8);
    const opener = s.actor!;
    expect(legalActions(s, opener).some((a) => a.type === 'pass')).toBe(false);
    s = apply(s, { type: 'offer', plantId: 3, amount: 3 });
    const next = s.seatOrder[(s.seatOrder.indexOf(opener) + 1) % 4]!;
    expect(s.actor).toBe(next);
    const buyer = s.actor!;
    s = apply(s, { type: 'bid', amount: 4 });
    while (s.phase === 'auction') s = apply(s, { type: 'pass' });
    expect(s.bought).toEqual([buyer]);
    expect(s.actor).toBe(opener);
    expect(legalActions(s, buyer)).toEqual([]);
    expect(() =>
      rules.apply(
        s,
        { type: 'offer', plantId: 4, amount: 51 },
        opener,
        context(s.seatOrder),
      ),
    ).toThrow();
    expect(() =>
      rules.apply(
        s,
        { type: 'offer', plantId: s.market[4]!, amount: s.market[4]! },
        opener,
        context(s.seatOrder),
      ),
    ).toThrow();
    while (s.phase === 'offer' || s.phase === 'auction') {
      const action =
        s.phase === 'offer'
          ? legalActions(s, s.actor!)[0]!
          : ({ type: 'pass' } as Action);
      s = apply(s, action);
    }
    expect(s.phase).toBe('resources');
    expect(Object.values(s.players).every((p) => p.plants.length === 1)).toBe(
      true,
    );
    expect(s.playerOrder.map((seat) => s.players[seat]!.plants[0]!.id)).toEqual(
      [...s.playerOrder.map((seat) => s.players[seat]!.plants[0]!.id)].sort(
        (a, b) => b - a,
      ),
    );
  });
  it('offers zero-purchase cleanup only at auction phase end and changes each decision id', () => {
    let s = fixture([[20], [25], [26]], 'offer');
    s.actor = s.playerOrder[0]!;
    s.bought = [];
    validateState(s, s.seatOrder);
    const smallest = s.market[0]!;
    s = apply(s, { type: 'pass' });
    expect(s.market).toContain(smallest);
    s = apply(s, { type: 'pass' });
    expect(s.market).toContain(smallest);
    s = apply(s, { type: 'pass' });
    expect(s.phase).toBe('resources');
    expect(s.removed).toContain(smallest);
  });
  it('drops an old plant and individually salvages or discards fuel with conservation', () => {
    let s = fixture([[4, 5, 13], [20], [25]], 'offer');
    s.actor = 'S1';
    s.playerOrder = ['S1', 'S2', 'S3'];
    s.bought = [];
    fuel(s, 'S1', 4, { coal: 4 });
    s.market = s.market.filter((id) => id !== 6);
    s.deck = s.deck.filter((id) => id !== 6);
    s.market.push(6);
    s.market.sort((a, b) => a - b);
    // Place the displaced eighth market card back into the deck.
    while (s.market.length > 8) s.deck.unshift(s.market.pop()!);
    validateState(s, s.seatOrder);
    s = apply(s, { type: 'offer', plantId: 6, amount: 6 });
    while (s.phase === 'auction') s = apply(s, { type: 'pass' });
    expect(s.phase).toBe('replace');
    expect(legalActions(s, 'S1')).not.toContainEqual({
      type: 'discard-plant',
      plantId: 6,
    });
    s = apply(s, { type: 'discard-plant', plantId: 4 });
    expect(s.replacement!.salvage.coal).toBe(4);
    s = apply(s, { type: 'salvage', resource: 'coal', plantId: 5 });
    s = apply(s, { type: 'discard-salvage', resource: 'coal' });
    s = apply(s, { type: 'salvage', resource: 'coal', plantId: 5 });
    s = apply(s, { type: 'salvage', resource: 'coal', plantId: 5 });
    expect(s.phase).toBe('offer');
    expect(s.players.S1!.plants.find((p) => p.id === 5)!.resources.coal).toBe(
      3,
    );
  });
  it('buys only storable finite fuel and runs full quantities once including all hybrid mixes', () => {
    let s = fixture([[46], [50]], 'resources', 3);
    s.actor = s.playerOrder.at(-1)!;
    const seat = s.actor!,
      plant = s.players[seat]!.plants[0]!;
    if (plant.id === 50) {
      s.playerOrder.reverse();
      s.actor = seat === 'S1' ? 'S2' : 'S1';
    }
    const owner = s.actor!;
    expect(
      legalActions(s, owner).some(
        (a) => a.type === 'buy-resource' && a.resource === 'uranium',
      ),
    ).toBe(false);
    s.phase = 'powering';
    s.phaseIndex = 0;
    s.playerOrder = [owner, s.seatOrder.find((x) => x !== owner)!];
    s.actor = owner;
    cities(s, owner, 4);
    fuel(s, owner, 46, { coal: 3, oil: 3 });
    validateState(s, s.seatOrder);
    expect(legalActions(s, owner).filter((a) => a.type === 'run')).toEqual(
      [0, 1, 2, 3].map((coal) => ({ type: 'run', plantId: 46, coal })),
    );
    s = apply(s, { type: 'run', plantId: 46, coal: 1 });
    expect(s.players[owner]!.plants[0]!.resources).toEqual({
      coal: 2,
      oil: 1,
      garbage: 0,
      uranium: 0,
    });
    expect(
      legalActions(s, owner).some((a) => a.type === 'run' && a.plantId === 46),
    ).toBe(false);
    s = apply(s, { type: 'finish', cities: 1 });
    expect(s.players[owner]!.powered).toBe(1);
  });
  it('rejects malformed, partition, finite-token, treasury and projection corruption', () => {
    const s = setup();
    const publicView = rules.project(s, { role: 'public' }) as PowerGridView;
    expect(publicView.self).toBeNull();
    expect(
      Object.values(publicView.players).every((p) => p.cash === null),
    ).toBe(true);
    const own = rules.project(s, {
      role: 'player',
      seatId: 'S1',
    }) as PowerGridView;
    expect(own.self!.cash).toBe(50);
    expect(own.players.S2!.cash).toBeNull();
    for (const corrupt of [
      (x: State) => x.deck.push(x.deck[0]!),
      (x: State) => x.resources.coal--,
      (x: State) => x.players.S1!.cash++,
      (x: State) => (x.actor = 'outsider'),
      (x: State) => (x.phase = 'powering'),
      (x: State) => (x.regions = ['north']),
      (x: State) => (x.step = 3),
    ]) {
      const bad = structuredClone(s);
      corrupt(bad);
      expect(() => validateState(bad, s.seatOrder)).toThrow();
    }
    for (const bad of [
      { type: 'bid', amount: NaN },
      { type: 'pass', amount: 1 },
      { type: 'offer', plantId: 48, amount: 48 },
      { type: 'run', plantId: 46, coal: 4 },
      { type: 'select-regions', regions: ['north', 'north'] },
    ])
      expect(() => validateAction(bad)).toThrow();
  });
  it('defers step 2 until every builder finishes and preserves the fixed order all round', () => {
    let s = fixture([[20], [25], [26]], 'building');
    const first = s.actor!,
      others = s.seatOrder.filter((seat) => seat !== first),
      initialOrder = [...s.playerOrder];
    cities(s, first, 6);
    const shared = s.players[first]!.cities[0]!;
    validateState(s, s.seatOrder);
    const newCity = legalActions(s, first).find(
      (a): a is Extract<Action, { type: 'build' }> => a.type === 'build',
    )!;
    s = apply(s, newCity);
    expect(s.players[first]!.cities.length).toBe(7);
    expect(s.step).toBe(1);
    s = apply(s, { type: 'finish' });
    expect(s.step).toBe(1);
    expect(
      legalActions(s, s.actor!).some(
        (a) => a.type === 'build' && a.cityId === shared,
      ),
    ).toBe(false);
    expect(others).toHaveLength(2);
    s = apply(s, { type: 'finish' });
    s = apply(s, { type: 'finish' });
    expect(s.step).toBe(2);
    expect(s.phase).toBe('powering');
    expect(s.playerOrder).toEqual(initialOrder);
  });
  it('scores available cities and fuel, burns a minimal final plan, and pays no final income', () => {
    let s = fixture(
      [
        [20, 25, 50],
        [26, 31, 44],
        [30, 36, 39],
      ],
      'building',
      3,
    );
    for (const seat of s.seatOrder) {
      cities(s, seat, 17);
      for (const plant of s.players[seat]!.plants) {
        const face = getPlant(plant.id);
        if (face.input) fuel(s, seat, plant.id, { [face.fuel]: face.input });
      }
    }
    // The configured regions contain 21 cities; all three players can share in step 3.
    const beforeIncome = s.incomeIssued;
    validateState(s, s.seatOrder);
    s = apply(s, { type: 'finish' });
    s = apply(s, { type: 'finish' });
    s = apply(s, { type: 'finish' });
    expect(s.phase).toBe('ended');
    expect(s.finalResults[0]!.powered).toBe(17);
    expect(s.incomeIssued).toBe(beforeIncome);
    expect(
      s.finalResults.every(
        (r) =>
          RESOURCES.reduce((sum, resource) => sum + r.burned[resource], 0) <= 7,
      ),
    ).toBe(true);
    expect(s.finalResults.find((r) => r.seatId === 'S1')!.powered).toBe(16);
    expect(
      Object.values(s.players)
        .flatMap((p) => p.plants)
        .reduce((sum, p) => sum + p.resources.uranium, 0),
    ).toBe(0);
  });
  it('keeps the step 3 sentinel in the future market until every auction opportunity is completed', () => {
    let s = fixture([[20], [25], [26]], 'offer');
    s.actor = s.playerOrder[0]!;
    s.bought = [];
    nextStep3(s);
    const lowest = s.market[0]!;
    s = apply(s, { type: 'offer', plantId: lowest, amount: lowest });
    while (s.phase === 'auction') s = apply(s, { type: 'pass' });
    expect(s.phase).toBe('offer');
    expect(s.step).toBe(1);
    expect(s.step3Pending).toBe('auction');
    expect(s.market.at(-1)).toBe(0);
    const before = [...s.market];
    s = apply(s, { type: 'pass' });
    expect(s.market).toEqual(before);
    s = apply(s, { type: 'pass' });
    expect(s.phase).toBe('resources');
    expect(s.step).toBe(3);
    expect(s.market).toHaveLength(6);
    expect(s.removed).toContain(before[0]);
    expect(s.removed).toContain(0);
    expect(
      (rules.project(s, { role: 'player', seatId: s.actor! }) as PowerGridView)
        .actualMarket,
    ).toHaveLength(6);
  });
  it('discards the sentinel and lowest immediately in building, but opens third city slots only in bureaucracy', () => {
    let s = fixture([[20], [25], [26]], 'building');
    const first = s.actor!;
    cities(s, first, 2);
    nextStep3(s);
    const shared = s.players[first]!.cities[0]!,
      build = legalActions(s, first).find((a) => a.type === 'build')!;
    s = apply(s, build);
    expect(s.step).toBe(1);
    expect(s.step3Pending).toBe('building');
    expect(s.market).toHaveLength(6);
    expect(s.removed).toEqual(expect.arrayContaining([0, 3, 4]));
    s = apply(s, { type: 'finish' });
    expect(
      legalActions(s, s.actor!).some(
        (a) => a.type === 'build' && a.cityId === shared,
      ),
    ).toBe(false);
    s = apply(s, { type: 'finish' });
    s = apply(s, { type: 'finish' });
    expect(s.phase).toBe('powering');
    expect(s.step).toBe(3);
    expect(
      Math.max(...Object.values(s.players).map((p) => p.cities.length)),
    ).toBeLessThan(7);
  });
  it.each([1, 2] as const)(
    'uses the final step 2 refill after a bureaucracy step 3 draw from step %i',
    (step) => {
      let s = fixture([[20], [25], [26]], 'powering', step);
      if (step === 2) cities(s, 'S1', 7);
      nextStep3(s);
      validateState(s, s.seatOrder);
      const oil = s.resources.oil,
        garbage = s.resources.garbage,
        largest = s.market.at(-1)!;
      for (let i = 0; i < 3; i++) s = apply(s, { type: 'finish', cities: 0 });
      expect(s.round).toBe(3);
      expect(s.phase).toBe('offer');
      expect(s.step).toBe(3);
      expect(s.resources.oil - oil).toBe(3);
      expect(s.resources.garbage - garbage).toBe(2);
      expect(s.deck).toContain(largest);
      expect(s.market).toHaveLength(6);
    },
  );
  it('resolves a step 3 draw during the single step 2 entry removal with the documented boundary policy', () => {
    let s = fixture([[20], [25], [26]], 'building');
    cities(s, 'S1', 7);
    nextStep3(s);
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'finish' });
    expect(s.phase).toBe('powering');
    expect(s.step).toBe(3);
    expect(s.step3Pending).toBeNull();
    expect(s.market).toHaveLength(6);
    const oil = s.resources.oil;
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'finish', cities: 0 });
    expect(s.resources.oil - oil).toBe(4);
    expect(s.step).toBe(3);
    expect(s.phase).toBe('offer');
  });
  it('continues when the step 3 deck and market are depleted instead of fabricating plants', () => {
    let s = fixture([[20], [25], [26]], 'powering', 3);
    s.removed.push(...s.deck);
    s.deck = [];
    const initial = s.market.length;
    validateState(s, s.seatOrder);
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'finish', cities: 0 });
    expect(s.market).toHaveLength(initial - 1);
    s.removed.push(...s.market);
    s.market = [];
    validateState(s, s.seatOrder);
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'pass' });
    expect(s.phase).toBe('resources');
    expect(s.market).toEqual([]);
  });
  it('removes successive obsolete draws immediately without touching owned small plants', () => {
    const s = fixture([[3, 20], [25], [26]], 'building');
    cities(s, s.actor!, 5);
    const small = s.deck.filter((id) => id <= 5 && id !== 0);
    s.deck = [...small, ...s.deck.filter((id) => !small.includes(id))];
    new MarketFlow(s, context(s.seatOrder)).removeObsolete('building');
    validateState(s, s.seatOrder);
    expect(s.market.every((id) => id > 5)).toBe(true);
    expect(s.players.S1!.plants[0]!.id).toBe(3);
  });
  it('rearranges full hybrid warehouses atomically and makes room to salvage an old plant', () => {
    let s = fixture([[5, 12, 13], [20], [25]], 'offer');
    s.actor = 'S1';
    s.playerOrder = ['S1', 'S2', 'S3'];
    s.bought = [];
    fuel(s, 'S1', 5, { coal: 4 });
    fuel(s, 'S1', 12, { oil: 4 });
    validateState(s, s.seatOrder);
    expect(legalActions(s, 'S1').some((a) => a.type === 'transfer')).toBe(
      false,
    );
    s = apply(s, {
      type: 'swap-resources',
      resource: 'coal',
      otherResource: 'oil',
      fromPlantId: 5,
      toPlantId: 12,
    });
    expect(s.players.S1!.plants.find((p) => p.id === 5)!.resources).toEqual({
      coal: 3,
      oil: 1,
      garbage: 0,
      uranium: 0,
    });
    s = apply(s, { type: 'offer', plantId: 3, amount: 3 });
    while (s.phase === 'auction') s = apply(s, { type: 'pass' });
    expect(s.phase).toBe('replace');
    s = apply(s, { type: 'discard-plant', plantId: 5 });
    s = apply(s, {
      type: 'transfer',
      resource: 'oil',
      fromPlantId: 12,
      toPlantId: 3,
    });
    expect(legalActions(s, 'S1')).toContainEqual({
      type: 'salvage',
      resource: 'coal',
      plantId: 12,
    });
  });
  it('charges lowest vacant slots and an entire cheapest path through full cities', () => {
    let s = fixture([[20], [25], [26]], 'building', 2);
    s.regions = ['northwest', 'southwest', 'east'];
    cities(s, 'S1', 7);
    s.players.S1!.cities = [
      'dusseldorf',
      'koln',
      ...CITIES.filter(
        (city) =>
          s.regions.includes(city.region) &&
          !['dusseldorf', 'koln', 'aachen', 'duisburg', 'essen'].includes(
            city.id,
          ),
      )
        .slice(0, 5)
        .map((city) => city.id),
    ];
    s.players.S2!.cities = ['dusseldorf'];
    s.players.S3!.cities = ['duisburg'];
    s.actor = 'S3';
    s.playerOrder = ['S1', 'S2', 'S3'];
    validateState(s, s.seatOrder);
    const view = rules.project(s, {
      role: 'player',
      seatId: 'S3',
    }) as PowerGridView;
    const target = view.buildOptions.find((o) => o.cityId === 'aachen')!;
    expect(target).toMatchObject({
      connectionCost: 11,
      buildingCost: 10,
      cost: 21,
    });
    expect(target.path).toContain('dusseldorf');
    expect(view.buildOptions.find((o) => o.cityId === 'koln')).toMatchObject({
      connectionCost: 6,
      buildingCost: 15,
      cost: 21,
    });
    expect(view.buildOptions.some((o) => o.cityId === 'dusseldorf')).toBe(
      false,
    );
    s = apply(s, { type: 'build', cityId: 'aachen' });
    expect(s.players.S3!.cash).toBe(979);
    expect(legalActions(s, 'S3')).not.toContainEqual({
      type: 'build',
      cityId: 'aachen',
    });
  });
  it('breaks final ties by cash then connected cities, and returns all completely tied winners', () => {
    let s = fixture([[50], [44], [33]], 'building', 3);
    cities(s, 'S1', 17);
    cities(s, 'S2', 17);
    cities(s, 'S3', 17);
    // Unequal available capacities can still tie when the smaller networks cap production.
    s.players.S1!.cities = s.players.S1!.cities.slice(0, 4);
    s.players.S2!.cities = s.players.S2!.cities.slice(0, 4);
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'finish' });
    expect(s.winners).toEqual(['S3']);
    let tied = fixture([[50], [44], [33]], 'building', 3);
    cities(tied, 'S1', 17);
    cities(tied, 'S2', 17);
    cities(tied, 'S3', 17);
    tied.players.S1!.cities = tied.players.S1!.cities.slice(0, 4);
    tied.players.S2!.cities = tied.players.S2!.cities.slice(0, 4);
    tied.players.S1!.cash += 1;
    tied.incomeIssued += 1;
    for (let i = 0; i < 3; i++) tied = apply(tied, { type: 'finish' });
    expect(tied.winners).toEqual(['S1']);
    let all = fixture(
      [
        [20, 25, 44],
        [26, 31, 50],
        [32, 36, 33],
      ],
      'building',
      3,
    );
    for (const seat of all.seatOrder) {
      cities(all, seat, 17);
      for (const plant of all.players[seat]!.plants) {
        const face = getPlant(plant.id);
        if (face.input) fuel(all, seat, plant.id, { [face.fuel]: face.input });
      }
    }
    // S2 and S3 both produce 17; cash and network are identical.
    for (let i = 0; i < 3; i++) all = apply(all, { type: 'finish' });
    expect(all.winners).toEqual(['S2', 'S3']);
  });
});

describe('Power Grid atomic resource purchase', () => {
  function purchasing(plants = [[8], [13], [18]]) {
    const state = fixture(plants, 'resources');
    state.playerOrder = ['S3', 'S2', 'S1'];
    state.actor = 'S1';
    return state;
  }
  function market(
    state: State,
    resource: (typeof RESOURCES)[number],
    count: number,
  ) {
    state.supply[resource] += state.resources[resource] - count;
    state.resources[resource] = count;
  }
  it('quotes each actual price tier for all four finite markets', () => {
    for (const resource of RESOURCES) {
      for (let count = 1; count <= TOTAL_RESOURCES[resource]; count++) {
        let expected = 0;
        for (let quantity = 1; quantity <= count; quantity++) {
          expected += price(resource, count - quantity + 1)!;
          expect(resourcePurchaseCost(resource, count, quantity)).toBe(
            expected,
          );
        }
      }
      for (const [count, quantity] of [
        [0, 1],
        [2, 3],
        [2, 0],
        [2, 1.5],
        [2, NaN],
        [2, Infinity],
        [-1, 1],
        [1.5, 1],
        [TOTAL_RESOURCES[resource] + 1, 1],
      ])
        expect(resourcePurchaseCost(resource, count!, quantity!)).toBeNull();
    }
    expect(resourcePurchaseCost('coal', 22, 4)).toBe(7);
    expect(resourcePurchaseCost('uranium', 2, 2)).toBe(30);
  });
  it('preserves legacy single-unit actions and strictly validates quantity requests', () => {
    const single = {
      type: 'buy-resource',
      plantId: 8,
      resource: 'coal',
    } as const;
    expect(validateAction(single)).toEqual(single);
    expect(validateAction({ ...single, quantity: 1 })).toEqual(single);
    expect(validateAction({ ...single, quantity: 4 })).toEqual({
      ...single,
      quantity: 4,
    });
    for (const quantity of [0, -1, 1.5, NaN, Infinity, '2', null, undefined])
      expect(() => validateAction({ ...single, quantity })).toThrow();
    expect(() =>
      validateAction({ ...single, quantity: 2, amount: 1 }),
    ).toThrow();
    expect(() =>
      validateAction({
        type: 'salvage',
        plantId: 8,
        resource: 'coal',
        quantity: 2,
      }),
    ).toThrow();
  });
  it('crosses price tiers in one saved decision while matching legacy purchases', () => {
    const before = purchasing();
    market(before, 'coal', 22);
    validateState(before, before.seatOrder);
    const action: Action = {
      type: 'buy-resource',
      plantId: 8,
      resource: 'coal',
      quantity: 4,
    };
    expect(legalActions(before, 'S1')).toContainEqual(action);
    const result = rules.apply(before, action, 'S1', context(before.seatOrder));
    const next = result.state as State;
    expect(next.actionSerial).toBe(before.actionSerial + 1);
    expect(next.logSerial).toBe(before.logSerial + 1);
    expect(result.events).toHaveLength(1);
    expect(result.decision).toMatchObject({ roundNumber: before.round });
    expect(next.history.at(-1)).toMatchObject({
      actor: 'S1',
      verb: 'buy-resource',
      plantId: 8,
      resource: 'coal',
      amount: 7,
      text: '购入 4 份煤，支付 7 电币。',
    });
    expect(next.players.S1!.cash).toBe(993);
    expect(next.players.S1!.plants[0]!.resources.coal).toBe(4);
    expect(next.resources.coal).toBe(18);
    expect(next.actor).toBe(before.actor);
    expect(next.playerOrder).toEqual(before.playerOrder);
    validateState(next, next.seatOrder);
    let sequential = structuredClone(before);
    for (let unit = 0; unit < 4; unit++)
      sequential = apply(sequential, {
        type: 'buy-resource',
        plantId: 8,
        resource: 'coal',
      });
    expect(next.players).toEqual(sequential.players);
    expect(next.resources).toEqual(sequential.resources);
    expect(next.supply).toEqual(sequential.supply);
    expect(next.spent).toBe(sequential.spent);
    const restored = validateState(
      JSON.parse(JSON.stringify(before)),
      before.seatOrder,
    );
    expect(
      rules.apply(restored, action, 'S1', context(before.seatOrder)).state,
    ).toEqual(next);
    expect(before.players.S1!.plants[0]!.resources.coal).toBe(0);
    const publicView = rules.project(next, { role: 'public' }) as PowerGridView;
    expect(
      Object.values(publicView.players).every((player) => player.cash === null),
    ).toBe(true);
  });
  it('limits quantities by cash, finite inventory and shared hybrid capacity', () => {
    const affordable = purchasing();
    market(affordable, 'coal', 22);
    affordable.players.S1!.cash = 3;
    affordable.incomeIssued -= 997;
    validateState(affordable, affordable.seatOrder);
    expect(
      legalActions(affordable, 'S1').filter(
        (action) => action.type === 'buy-resource',
      ),
    ).toEqual([
      { type: 'buy-resource', plantId: 8, resource: 'coal' },
      { type: 'buy-resource', plantId: 8, resource: 'coal', quantity: 2 },
    ]);
    const paid = apply(affordable, {
      type: 'buy-resource',
      plantId: 8,
      resource: 'coal',
      quantity: 2,
    });
    expect(paid.players.S1!.cash).toBe(0);
    expect(
      legalActions(paid, 'S1').some((action) => action.type === 'buy-resource'),
    ).toBe(false);

    const hybrid = purchasing([[5, 20], [13], [18]]);
    fuel(hybrid, 'S1', 5, { coal: 1, oil: 1 });
    validateState(hybrid, hybrid.seatOrder);
    const hybridBuys = legalActions(hybrid, 'S1').filter(
      (action) => action.type === 'buy-resource' && action.plantId === 5,
    );
    expect(hybridBuys).toHaveLength(4);
    expect(
      hybridBuys.every(
        (action) =>
          action.type === 'buy-resource' && (action.quantity ?? 1) <= 2,
      ),
    ).toBe(true);
    const filled = apply(hybrid, {
      type: 'buy-resource',
      plantId: 5,
      resource: 'oil',
      quantity: 2,
    });
    expect(filled.players.S1!.plants[0]!.resources).toEqual({
      coal: 1,
      oil: 3,
      garbage: 0,
      uranium: 0,
    });
    expect(
      legalActions(filled, 'S1').some(
        (action) => action.type === 'buy-resource' && action.plantId === 5,
      ),
    ).toBe(false);

    const uranium = purchasing([[11], [13], [18]]);
    const exhausted = apply(uranium, {
      type: 'buy-resource',
      plantId: 11,
      resource: 'uranium',
      quantity: 2,
    });
    expect(exhausted.players.S1!.cash).toBe(970);
    expect(exhausted.resources.uranium).toBe(0);
    expect(
      legalActions(exhausted, 'S1').some(
        (action) => action.type === 'buy-resource',
      ),
    ).toBe(false);
  });
  it('rejects over-budget, excess, wrong-fuel, foreign and out-of-turn batches without mutation', () => {
    const state = purchasing([[5, 8], [13], [18]]);
    fuel(state, 'S1', 5, { coal: 2, oil: 1 });
    const snapshot = structuredClone(state);
    for (const [action, seat] of [
      [
        { type: 'buy-resource', plantId: 5, resource: 'oil', quantity: 2 },
        'S1',
      ],
      [
        { type: 'buy-resource', plantId: 8, resource: 'coal', quantity: 7 },
        'S1',
      ],
      [
        { type: 'buy-resource', plantId: 8, resource: 'oil', quantity: 2 },
        'S1',
      ],
      [
        { type: 'buy-resource', plantId: 13, resource: 'coal', quantity: 2 },
        'S1',
      ],
      [
        { type: 'buy-resource', plantId: 8, resource: 'coal', quantity: 2 },
        'S2',
      ],
    ] as const) {
      expect(() =>
        rules.apply(state, action, seat, context(state.seatOrder)),
      ).toThrow();
      expect(state).toEqual(snapshot);
    }
    const poor = purchasing();
    poor.players.S1!.cash = 1;
    poor.incomeIssued -= 999;
    const poorBefore = structuredClone(poor);
    expect(() =>
      rules.apply(
        poor,
        { type: 'buy-resource', plantId: 8, resource: 'coal', quantity: 2 },
        'S1',
        context(poor.seatOrder),
      ),
    ).toThrow();
    expect(poor).toEqual(poorBefore);
    const soldOut = purchasing([[11], [13], [18]]);
    market(soldOut, 'uranium', 1);
    const soldOutBefore = structuredClone(soldOut);
    expect(() =>
      rules.apply(
        soldOut,
        { type: 'buy-resource', plantId: 11, resource: 'uranium', quantity: 2 },
        'S1',
        context(soldOut.seatOrder),
      ),
    ).toThrow();
    expect(soldOut).toEqual(soldOutBefore);
  });
  it('batches planned bot demand at every difficulty and accepts legacy actions', () => {
    const state = purchasing([[4], [3], [13]]);
    cities(state, 'S1', 1);
    const view = rules.project(state, {
      role: 'player',
      seatId: 'S1',
    }) as PowerGridView;
    const actions = legalActions(state, 'S1');
    const legacy = actions.filter(
      (action) =>
        action.type !== 'buy-resource' || action.quantity === undefined,
    );
    for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
      const chosen = chooseAction(view, actions, difficulty, { next: () => 0 });
      const unit = chooseAction(view, legacy, difficulty, { next: () => 0 });
      expect(unit).toEqual({
        type: 'buy-resource',
        plantId: 4,
        resource: 'coal',
      });
      const demand = forecast(
        view,
        view.players.S1!.plants,
        view.self!.cash,
        difficulty === 'default' ? 0 : difficulty === 'doubao' ? 1 : 2,
      ).demand.coal;
      expect(chosen).toEqual({ ...unit, quantity: demand });
      expect(demand).toBeGreaterThan(1);
      expect(actions).toContainEqual(chosen);
      const bought = apply(state, chosen);
      expect(bought.players.S1!.plants[0]!.resources.coal).toBe(demand);
    }
  });
  it('caps bot batches at planned deficits and available legal quantities', () => {
    for (const scarce of [false, true]) {
      const state = purchasing([[4], [3], [13]]);
      cities(state, 'S1', 1);
      if (scarce) market(state, 'coal', 2);
      else fuel(state, 'S1', 4, { coal: 1 });
      const view = rules.project(state, {
        role: 'player',
        seatId: 'S1',
      }) as PowerGridView;
      const actions = legalActions(state, 'S1');
      for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
        const demand = forecast(
          view,
          view.players.S1!.plants,
          view.self!.cash,
          difficulty === 'default' ? 0 : difficulty === 'doubao' ? 1 : 2,
        ).demand.coal;
        const eligible = actions.filter(
          (a): a is Extract<Action, { type: 'buy-resource' }> =>
            a.type === 'buy-resource' && (a.quantity ?? 1) <= demand,
        );
        const chosen = chooseAction(view, actions, difficulty, {
          next: () => 0,
        });
        if (!eligible.length) {
          expect(chosen).toEqual({ type: 'finish' });
          continue;
        }
        expect(chosen.type).toBe('buy-resource');
        expect(eligible).toContainEqual(chosen);
        if (chosen.type === 'buy-resource')
          expect(chosen.quantity ?? 1).toBe(
            Math.max(...eligible.map((a) => a.quantity ?? 1)),
          );
        validateState(apply(state, chosen), state.seatOrder);
      }
    }
  });
});

describe('Power Grid bounded production and seeded full games', () => {
  it('keeps a free plant first and avoids burning redundant fuel after enough cities are powered', () => {
    let s = fixture([[4, 13], [20], [25]], 'powering');
    s.playerOrder = ['S1', 'S2', 'S3'];
    s.actor = 'S1';
    cities(s, 'S1', 1);
    fuel(s, 'S1', 4, { coal: 2 });
    const choose = () =>
      chooseAction(
        rules.project(s, { role: 'player', seatId: 'S1' }) as PowerGridView,
        legalActions(s, 'S1'),
        'juewu',
        { next: () => 0 },
      );
    expect(choose()).toEqual({ type: 'run', plantId: 13, coal: 0 });
    s = apply(s, choose());
    expect(choose()).toEqual({ type: 'finish', cities: 1 });
    s = apply(s, choose());
    expect(s.players.S1!.plants.find((p) => p.id === 4)!.resources.coal).toBe(
      2,
    );
  });
  it('avoids unnecessary reserves at all difficulties and ignores every rival cash balance', () => {
    const s = fixture([[4], [3], [13]], 'resources');
    s.playerOrder = ['S3', 'S2', 'S1'];
    s.actor = 'S1';
    fuel(s, 'S1', 4, { coal: 2 });
    const view = rules.project(s, {
        role: 'player',
        seatId: 'S1',
      }) as PowerGridView,
      actions = legalActions(s, 'S1');
    expect(chooseAction(view, actions, 'default', { next: () => 0 })).toEqual({
      type: 'finish',
    });
    expect(chooseAction(view, actions, 'doubao', { next: () => 0 })).toEqual({
      type: 'finish',
    });
    expect(chooseAction(view, actions, 'juewu', { next: () => 0 })).toEqual({
      type: 'finish',
    });
    const other = structuredClone(s);
    other.players.S2!.cash += 100;
    other.players.S3!.cash -= 100;
    validateState(other, other.seatOrder);
    expect(rules.project(other, { role: 'player', seatId: 'S1' })).toEqual(
      view,
    );
    for (const difficulty of ['default', 'doubao', 'juewu'] as const)
      expect(
        chooseAction(
          rules.project(other, {
            role: 'player',
            seatId: 'S1',
          }) as PowerGridView,
          actions,
          difficulty,
          { next: () => 0 },
        ),
      ).toEqual(chooseAction(view, actions, difficulty, { next: () => 0 }));
  });
  it('permits four plants in a two-player classic game and replaces an old fifth plant', () => {
    let s = fixture([[3, 4, 5, 13], [20]], 'offer');
    s.playerOrder = ['S1', 'S2'];
    s.actor = 'S1';
    s.bought = [];
    validateState(s, s.seatOrder);
    s = apply(s, { type: 'offer', plantId: 6, amount: 6 });
    s = apply(s, { type: 'pass' });
    expect(s.phase).toBe('replace');
    expect(
      legalActions(s, 'S1').filter((a) => a.type === 'discard-plant'),
    ).toHaveLength(4);
    expect(legalActions(s, 'S1')).not.toContainEqual({
      type: 'discard-plant',
      plantId: 6,
    });
    s = apply(s, { type: 'discard-plant', plantId: 13 });
    expect(s.players.S1!.plants).toHaveLength(4);
  });
  it('allocates shared coal/oil to produce the most cities rather than summing unusable capacities', () => {
    const plants: OwnedPlant[] = [
      { id: 25, resources: { coal: 2, oil: 0, garbage: 0, uranium: 0 } },
      { id: 46, resources: { coal: 0, oil: 3, garbage: 0, uranium: 0 } },
      { id: 50, resources: emptyStock() },
    ];
    expect(maximumProduction(plants)).toBe(18);
    plants[1]!.resources.oil = 1;
    expect(maximumProduction(plants)).toBe(13);
  });
  it('limits every auction to three meaningful raises including a final one-unit margin', () => {
    for (let budget = 1; budget <= 200; budget++) {
      let current = 0,
        raises = 0;
      while (nextBid(current, budget) !== null) {
        const next = nextBid(current, budget)!;
        expect(next).toBeLessThanOrEqual(budget);
        expect(next - current >= 2 || next === budget).toBe(true);
        current = next + 1;
        raises++;
      }
      expect(raises).toBeLessThanOrEqual(3);
    }
    expect(nextBid(29, 30)).toBe(30);
    expect(nextBid(30, 30)).toBeNull();
  });
  it('uses future public fuel pressure to reserve rather than filling every plant blindly', () => {
    const s = fixture([[4], [20], [42]], 'resources');
    s.actor = 'S1';
    fuel(s, 'S1', 4, { coal: 2 });
    const view = rules.project(s, {
      role: 'player',
      seatId: 'S1',
    }) as PowerGridView;
    const actions = legalActions(s, 'S1');
    expect(chooseAction(view, actions, 'default', { next: () => 0 })).toEqual({
      type: 'finish',
    });
    expect(chooseAction(view, actions, 'juewu', { next: () => 0 }).type).toBe(
      'buy-resource',
    );
    const before = JSON.stringify(view);
    const plan = forecast(view, view.players.S1!.plants, view.self!.cash, 2);
    expect(plan.nodes).toBeLessThanOrEqual(6000);
    expect(JSON.stringify(view)).toBe(before);
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      forecast(
        view,
        view.players.S1!.plants,
        view.self!.cash,
        2,
        controller.signal,
      ),
    ).toThrow('取消');
  });
  it('buys a feasible mixed recipe when neither resource can provide the full input alone', () => {
    const s = fixture([[21], [13], [18]], 'resources');
    s.actor = 'S1';
    cities(s, 'S1', 3);
    for (const r of RESOURCES) {
      if (r === 'coal' || r === 'oil') {
        s.resources[r] = 1;
        s.supply[r] = TOTAL_RESOURCES[r] - 1;
      }
    }
    const view = rules.project(s, {
      role: 'player',
      seatId: 'S1',
    }) as PowerGridView;
    const plan = forecast(view, view.players.S1!.plants, view.self!.cash, 1);
    expect(plan.demand.coal).toBe(1);
    expect(plan.demand.oil).toBe(1);
    expect(legalActions(s, 'S1')).toContainEqual(
      chooseAction(view, legalActions(s, 'S1'), 'doubao', { next: () => 0 }),
    );
  });
  it('triggers a winning two-player ending even when production is below 21 cities', () => {
    let s = fixture([[3], [13, 18, 22, 27]], 'building', 3);
    cities(s, 'S1', 10);
    cities(s, 'S2', 20);
    const view = rules.project(s, {
      role: 'player',
      seatId: 'S2',
    }) as PowerGridView;
    const legal = legalActions(s, 'S2');
    const action = chooseAction(view, legal, 'juewu', { next: () => 0 });
    expect(maximumProduction(s.players.S2!.plants)).toBeLessThan(21);
    expect(action.type).toBe('build');
    expect(legal).toContainEqual(action);
    s = apply(s, action);
    s = apply(s, { type: 'finish' });
    s = apply(s, { type: 'finish' });
    expect(s.phase).toBe('ended');
    expect(s.winners).toEqual(['S2']);
  });
  for (const count of [2, 3, 4, 5, 6])
    for (const difficulty of ['default', 'doubao', 'juewu'] as const)
      for (const seed of [0, 1, 2])
        it(`${count} players / ${difficulty} seed ${seed} completes a conserved, restorable game`, async () => {
          const seats = Array.from({ length: count }, (_, i) => `S${i + 1}`),
            random = new RandomSource(
              count * 71 + difficulty.length + seed * 719,
            );
          let s = initialize({ seats, random }),
            actionsTaken = 0,
            longest = 0;
          while (s.phase !== 'ended' && actionsTaken++ < 6000) {
            const decision = decisions(s)[0]!,
              actions = legalActions(s, decision.seatId);
            expect(actions.length).toBeGreaterThan(0);
            for (const legal of actions)
              expect(JSON.stringify(validateAction(legal))).toBe(
                JSON.stringify(legal),
              );
            const began = performance.now();
            const chosen = await bot.decide({
              view: rules.project(s, {
                role: 'player',
                seatId: decision.seatId,
              }),
              actions,
              decision,
              memory: null,
              difficulty,
              random,
              signal: new AbortController().signal,
            });
            longest = Math.max(longest, performance.now() - began);
            const before = JSON.stringify(s);
            s = rules.apply(s, chosen.action, decision.seatId, {
              seats,
              random,
            }).state as State;
            expect(before).not.toBe(JSON.stringify(s));
            validateState(s, seats);
            if (actionsTaken % 25 === 0)
              expect(
                validateState(JSON.parse(JSON.stringify(s)), seats),
              ).toEqual(s);
          }
          expect({
            phase: s.phase,
            round: s.round,
            actionsTaken,
          }).toMatchObject({
            phase: 'ended',
          });
          strategyMetrics.push({
            count,
            difficulty,
            seed,
            actions: actionsTaken,
            round: s.round,
            longestMs: longest,
          });
          expect(longest).toBeLessThan(1500);
          expect(s.winners.length).toBeGreaterThan(0);
          for (const resource of RESOURCES)
            expect(
              s.resources[resource] +
                s.supply[resource] +
                Object.values(s.players).reduce(
                  (sum, p) =>
                    sum +
                    p.plants.reduce(
                      (n, plant) => n + plant.resources[resource],
                      0,
                    ),
                  0,
                ),
            ).toBe(TOTAL_RESOURCES[resource]);
        }, 60000);
});
