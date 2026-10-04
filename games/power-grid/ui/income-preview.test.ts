import { describe, expect, it } from 'vitest';
import { emptyStock, getPlant } from '../data/catalog';
import type { OwnedPlant, PlayerView, PowerGridView, Stock } from '../types';
import { incomePreview } from './income-preview';

const owned = (id: number, resources: Partial<Stock> = {}): OwnedPlant => ({
  id,
  resources: { ...emptyStock(), ...resources },
});
const player = (
  plants: OwnedPlant[],
  cities = 12,
  extra: Partial<PlayerView> = {},
): PlayerView => ({
  plants,
  cities: Array.from({ length: cities }, (_, index) => `city-${index}`),
  cash: null,
  capacity: plants.reduce((sum, plant) => sum + getPlant(plant.id).output, 0),
  powered: 0,
  ran: [],
  ...extra,
});
function fixture(
  players: Record<string, PlayerView>,
  extra: Partial<PowerGridView> = {},
): PowerGridView {
  const seats = Object.keys(players);
  return {
    gameId: 'power-grid',
    round: 2,
    step: 1,
    phase: 'resources',
    actor: seats[0] ?? null,
    seatOrder: seats,
    playerOrder: seats,
    regions: [],
    regionCount: 3,
    plantLimit: 3,
    step2Threshold: 7,
    endThreshold: 17,
    market: [],
    actualMarket: [],
    futureMarket: [],
    deckCount: 0,
    step3Pending: false,
    resources: emptyStock(),
    resourcePrices: { coal: null, oil: null, garbage: null, uranium: null },
    supply: emptyStock(),
    replenishment: emptyStock(),
    auction: null,
    replacement: null,
    bought: [],
    passed: [],
    players,
    self: null,
    buildOptions: [],
    winners: [],
    finalResults: [],
    latest: null,
    history: [],
    ...extra,
  };
}

describe('authorized income preview', () => {
  it('uses available fuel and the city limit, rather than nominal plant capacity', () => {
    const view = fixture({
      p1: player([owned(25, { coal: 2 }), owned(26), owned(13)]),
    });
    expect(incomePreview(view)?.cities).toBe(6);
    view.players.p1!.cities = ['one', 'two'];
    expect(incomePreview(view)?.cities).toBe(2);
    view.players.p1!.cities = [];
    expect(incomePreview(view)).toMatchObject({ cities: 0, income: 10 });
  });

  it('counts transferable fuel left in an already operated warehouse', () => {
    const view = fixture(
      {
        p1: player([owned(25, { coal: 2 }), owned(4)], 12, {
          ran: [25],
          powered: 5,
        }),
      },
      { phase: 'powering' },
    );
    // The remaining two coal can move from 25 to 4, supplying one more city.
    expect(incomePreview(view)).toMatchObject({ cities: 6, income: 73 });
    expect(view.players.p1!.plants[0]!.resources.coal).toBe(2);
    expect(view.players.p1!.plants[1]!.resources.coal).toBe(0);
  });

  it('never runs an already operated plant a second time', () => {
    const view = fixture(
      { p1: player([owned(25, { coal: 2 })], 12, { ran: [25], powered: 5 }) },
      { phase: 'powering' },
    );
    expect(incomePreview(view)?.cities).toBe(5);
  });

  it('accounts for mixed fuel sharing without promising incompatible fuel twice', () => {
    const view = fixture({
      p1: player([owned(25, { coal: 2 }), owned(21, { oil: 2 })]),
    });
    expect(incomePreview(view)?.cities).toBe(9);
    view.players.p1!.plants[1]!.resources.oil = 0;
    expect(incomePreview(view)?.cities).toBe(5);
  });

  it('uses actual completed supply for players before the current actor', () => {
    const view = fixture(
      {
        p1: player([owned(25, { coal: 2 })], 12, { ran: [25], powered: 2 }),
        p2: player([owned(13)]),
        p3: player([owned(18)]),
      },
      { phase: 'powering', actor: 'p2' },
    );
    expect(incomePreview(view, 'p1')).toMatchObject({
      cities: 2,
      completed: true,
    });
    expect(incomePreview(view, 'p2')).toMatchObject({
      cities: 1,
      completed: false,
    });
    expect(incomePreview(view, 'p3')).toMatchObject({
      cities: 2,
      completed: false,
    });
  });

  it('allows only the acting phone to annotate a legal unsaved supply selection', () => {
    const view = fixture(
      { p1: player([owned(25)], 12, { ran: [25], powered: 5 }) },
      { phase: 'powering', self: { seatId: 'p1', cash: 999 } },
    );
    expect(incomePreview(view, 'p1', 3)?.selectedCities).toBe(3);
    for (const invalid of [-1, 1.5, 6, Number.NaN])
      expect(incomePreview(view, 'p1', invalid)?.selectedCities).toBeNull();
    view.self = null;
    expect(incomePreview(view, 'p1', 3)?.selectedCities).toBeNull();
    view.self = { seatId: 'p2', cash: 100 };
    expect(incomePreview(view, 'p1', 3)?.selectedCities).toBeNull();
    expect(incomePreview(view, 'p1')).not.toHaveProperty('cash');
  });

  it('shows final proved supply and the 20-plus reference value without recomputing burnt fuel', () => {
    const view = fixture(
      { p1: player([], 21) },
      {
        phase: 'ended',
        actor: null,
        finalResults: [
          {
            seatId: 'p1',
            powered: 21,
            cash: 17,
            cities: 21,
            availableResources: emptyStock(),
            burned: emptyStock(),
            operated: [],
          },
        ],
      },
    );
    expect(incomePreview(view)).toMatchObject({
      cities: 21,
      income: 150,
      completed: true,
    });
    expect(incomePreview(view, 'unknown')).toBeNull();
  });
});
