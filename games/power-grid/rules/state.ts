import {
  accepts,
  getPlant,
  PLANT_IDS,
  RESOURCES,
  RULES_VERSION,
  totalStock,
} from '../data/catalog';
import { settingsFor, TOTAL_RESOURCES } from '../data/economy';
import { CITIES, getCity, isConnectedRegions, REGIONS } from '../data/germany';
import type { State } from './model';
import { fuelUse, planProduction, pooledResources } from './production';

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): value is number =>
  Number.isSafeInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max;
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const exact = (value: unknown, expected: readonly string[]) =>
  record(value) && equal(Object.keys(value).sort(), [...expected].sort());
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');
const unique = (
  value: unknown,
  allowed: readonly unknown[],
): value is string[] =>
  Array.isArray(value) &&
  new Set(value).size === value.length &&
  value.every((v) => allowed.includes(v));
const stock = (value: unknown) =>
  exact(value, RESOURCES) &&
  RESOURCES.every((r) =>
    integer((value as Record<string, unknown>)[r], 0, TOTAL_RESOURCES[r]),
  );
function requireValid(value: unknown): asserts value {
  if (!value) throw new Error('电力公司存档状态无效。');
}
export function validateState(input: unknown, seats: readonly string[]): State {
  requireValid(
    exact(input, [
      'gameId',
      'rulesVersion',
      'stateVersion',
      'seatOrder',
      'playerOrder',
      'round',
      'step',
      'phase',
      'actor',
      'phaseIndex',
      'regions',
      'deck',
      'market',
      'removed',
      'hiddenRemoved',
      'resources',
      'supply',
      'players',
      'auction',
      'replacement',
      'bought',
      'passed',
      'auctionOpener',
      'step3Pending',
      'ending',
      'actionSerial',
      'logSerial',
      'history',
      'incomeIssued',
      'spent',
      'winners',
      'finalResults',
    ]),
  );
  const s = input as State;
  requireValid(
    s.gameId === 'power-grid' &&
      s.rulesVersion === RULES_VERSION &&
      s.stateVersion === 1,
  );
  requireValid(
    strings(s.seatOrder) &&
      s.seatOrder.length >= 2 &&
      s.seatOrder.length <= 6 &&
      new Set(s.seatOrder).size === s.seatOrder.length &&
      s.seatOrder.every((seat) => !!seat && seat.length <= 200) &&
      equal(s.seatOrder, seats),
  );
  const settings = settingsFor(seats.length);
  requireValid(
    unique(s.playerOrder, seats) &&
      s.playerOrder.length === seats.length &&
      unique(s.bought, seats) &&
      unique(s.passed, seats) &&
      !s.bought.some((seat) => s.passed.includes(seat)),
  );
  requireValid(
    integer(s.round, 1) &&
      [1, 2, 3].includes(s.step) &&
      [
        'regions',
        'offer',
        'auction',
        'replace',
        'resources',
        'building',
        'powering',
        'ended',
      ].includes(s.phase) &&
      integer(s.phaseIndex, 0, seats.length),
  );
  requireValid(s.actor === null || seats.includes(s.actor));
  requireValid(s.auctionOpener === null || seats.includes(s.auctionOpener));
  requireValid(
    integer(s.actionSerial) &&
      integer(s.logSerial) &&
      integer(s.incomeIssued) &&
      integer(s.spent) &&
      typeof s.ending === 'boolean',
  );
  requireValid(
    unique(
      s.regions,
      REGIONS.map((r) => r.id),
    ),
  );
  if (s.phase === 'regions')
    requireValid(
      s.regions.length === 0 &&
        s.round === 1 &&
        s.step === 1 &&
        s.actionSerial === 0 &&
        s.actor === s.playerOrder[0],
    );
  else
    requireValid(
      s.regions.length === settings.regions && isConnectedRegions(s.regions),
    );
  requireValid(
    stock(s.resources) && stock(s.supply) && exact(s.players, seats),
  );
  const plantIds: number[] = [],
    occupied: Record<string, number> = {};
  for (const seat of seats) {
    const p = s.players[seat]!;
    requireValid(
      exact(p, ['cash', 'plants', 'cities', 'powered', 'ran', 'produced']) &&
        integer(p.cash) &&
        integer(p.powered, 0, 42) &&
        integer(p.produced, 0, 28),
    );
    requireValid(
      Array.isArray(p.plants) &&
        p.plants.length <=
          settings.plantLimit +
            (s.phase === 'replace' &&
            s.replacement?.buyer === seat &&
            s.replacement.removedPlantId === null
              ? 1
              : 0),
    );
    requireValid(
      unique(
        p.cities,
        CITIES.map((city) => city.id),
      ) &&
        p.cities.every((cityId) =>
          s.regions.includes(getCity(cityId).region),
        ) &&
        p.powered <= p.cities.length,
    );
    for (const cityId of p.cities)
      occupied[cityId] = (occupied[cityId] ?? 0) + 1;
    for (const owned of p.plants) {
      requireValid(
        exact(owned, ['id', 'resources']) &&
          PLANT_IDS.includes(owned.id) &&
          stock(owned.resources),
      );
      requireValid(
        RESOURCES.every(
          (r) => owned.resources[r] === 0 || accepts(owned.id, r),
        ) && totalStock(owned.resources) <= getPlant(owned.id).input * 2,
      );
      plantIds.push(owned.id);
    }
    requireValid(
      Array.isArray(p.ran) &&
        new Set(p.ran).size === p.ran.length &&
        p.ran.every((id) => p.plants.some((plant) => plant.id === id)) &&
        p.produced === p.ran.reduce((sum, id) => sum + getPlant(id).output, 0),
    );
    if (s.phase !== 'powering')
      requireValid(p.ran.length === 0 && p.produced === 0);
    if (s.phase === 'powering' && s.playerOrder.indexOf(seat) > s.phaseIndex)
      requireValid(p.ran.length === 0 && p.powered === 0);
    if (
      s.round > 1 ||
      ['resources', 'building', 'powering', 'ended'].includes(s.phase)
    )
      requireValid(p.plants.length >= 1);
  }
  requireValid(Object.values(occupied).every((count) => count <= s.step));
  if (s.step === 2)
    requireValid(
      Object.values(s.players).some((p) => p.cities.length >= settings.step2),
    );
  for (const entries of [s.deck, s.market, s.removed, s.hiddenRemoved])
    requireValid(
      Array.isArray(entries) &&
        entries.every(
          (id) => integer(id, 0, 50) && (id === 0 || PLANT_IDS.includes(id)),
        ),
    );
  requireValid(
    s.hiddenRemoved.length === settings.removed &&
      s.hiddenRemoved.every((id) => id > 10 && id !== 13),
  );
  const partition = [
    ...s.deck,
    ...s.market,
    ...s.removed,
    ...s.hiddenRemoved,
    ...plantIds,
  ];
  requireValid(
    partition.length === 43 &&
      new Set(partition).size === 43 &&
      [0, ...PLANT_IDS].every((id) => partition.includes(id)),
  );
  requireValid(
    equal(
      s.market,
      [...s.market].sort(
        (a, b) => (a === 0 ? Infinity : a) - (b === 0 ? Infinity : b),
      ),
    ),
  );
  requireValid(
    s.step3Pending === null ||
      ['auction', 'building', 'bureaucracy'].includes(s.step3Pending),
  );
  if (s.step === 3) {
    requireValid(
      s.step3Pending === null && s.removed.includes(0) && s.market.length <= 6,
    );
  } else if (s.step3Pending === 'auction')
    requireValid(
      s.market.length === 8 &&
        s.market.at(-1) === 0 &&
        ['offer', 'auction', 'replace'].includes(s.phase),
    );
  else if (s.step3Pending !== null)
    requireValid(
      s.market.length === 6 &&
        s.removed.includes(0) &&
        (s.step3Pending === 'building'
          ? s.phase === 'building'
          : s.phase === 'powering'),
    );
  else requireValid(s.market.length === 8 && s.deck.includes(0));
  requireValid(
    s.market.every(
      (id) =>
        id === 0 ||
        id > Math.max(...Object.values(s.players).map((p) => p.cities.length)),
    ),
  );
  if (s.phase === 'auction') {
    const a = s.auction;
    requireValid(
      exact(a, [
        'plantId',
        'opener',
        'highBidder',
        'amount',
        'passes',
        'actor',
      ]) && a !== null,
    );
    requireValid(
      (s.step === 3 ? s.market : s.market.slice(0, 4)).includes(a.plantId) &&
        a.plantId !== 0 &&
        integer(a.amount, a.plantId) &&
        s.auctionOpener === a.opener,
    );
    requireValid(
      seats.includes(a.opener) &&
        seats.includes(a.highBidder) &&
        a.actor === s.actor &&
        seats.includes(a.actor) &&
        a.actor !== a.highBidder &&
        a.amount <= s.players[a.highBidder]!.cash,
    );
    requireValid(
      unique(a.passes, seats) &&
        !a.passes.includes(a.highBidder) &&
        !a.passes.includes(a.actor) &&
        !s.bought.includes(a.actor) &&
        !s.passed.includes(a.actor) &&
        !s.bought.includes(a.highBidder) &&
        !s.passed.includes(a.highBidder),
    );
  } else requireValid(s.auction === null);
  if (s.phase === 'replace') {
    const r = s.replacement;
    requireValid(
      exact(r, [
        'buyer',
        'newPlantId',
        'oldPlantIds',
        'removedPlantId',
        'salvage',
      ]) && r !== null,
    );
    requireValid(
      r.buyer === s.actor &&
        s.bought.includes(r.buyer) &&
        Array.isArray(r.oldPlantIds) &&
        r.oldPlantIds.length === settings.plantLimit &&
        new Set(r.oldPlantIds).size === r.oldPlantIds.length &&
        r.oldPlantIds.every(
          (id) => PLANT_IDS.includes(id) && id !== r.newPlantId,
        ) &&
        s.players[r.buyer]!.plants.some((p) => p.id === r.newPlantId) &&
        stock(r.salvage),
    );
    if (r.removedPlantId === null)
      requireValid(
        totalStock(r.salvage) === 0 &&
          equal(
            [...s.players[r.buyer]!.plants.map((p) => p.id)].sort(
              (a, b) => a - b,
            ),
            [...r.oldPlantIds, r.newPlantId].sort((a, b) => a - b),
          ),
      );
    else
      requireValid(
        r.oldPlantIds.includes(r.removedPlantId) &&
          s.removed.includes(r.removedPlantId) &&
          totalStock(r.salvage) > 0 &&
          RESOURCES.every(
            (resource) =>
              r.salvage[resource] === 0 || accepts(r.removedPlantId!, resource),
          ) &&
          totalStock(r.salvage) <= getPlant(r.removedPlantId).input * 2 &&
          equal(
            s.players[r.buyer]!.plants.map((p) => p.id).sort((a, b) => a - b),
            [
              ...r.oldPlantIds.filter((id) => id !== r.removedPlantId),
              r.newPlantId,
            ].sort((a, b) => a - b),
          ),
      );
  } else requireValid(s.replacement === null);
  for (const resource of RESOURCES) {
    const total =
      s.resources[resource] +
      s.supply[resource] +
      Object.values(s.players).reduce(
        (sum, p) =>
          sum + p.plants.reduce((n, plant) => n + plant.resources[resource], 0),
        0,
      ) +
      (s.replacement?.salvage[resource] ?? 0);
    requireValid(total === TOTAL_RESOURCES[resource]);
  }
  requireValid(
    Object.values(s.players).reduce((sum, p) => sum + p.cash, 0) ===
      seats.length * 50 + s.incomeIssued - s.spent,
  );
  if (['resources', 'building', 'powering'].includes(s.phase)) {
    requireValid(
      s.phaseIndex < seats.length &&
        s.actor ===
          (s.phase === 'powering'
            ? s.playerOrder
            : [...s.playerOrder].reverse())[s.phaseIndex] &&
        s.auctionOpener === null &&
        s.bought.length + s.passed.length === seats.length,
    );
  }
  if (s.phase === 'offer')
    requireValid(
      s.actor !== null &&
        !s.bought.includes(s.actor) &&
        !s.passed.includes(s.actor) &&
        s.phaseIndex === 0,
    );
  requireValid(Array.isArray(s.finalResults) && unique(s.winners, seats));
  if (s.phase === 'ended') {
    requireValid(
      s.actor === null &&
        s.ending &&
        Object.values(s.players).some((p) => p.cities.length >= settings.end),
    );
    requireValid(
      s.finalResults.length === seats.length &&
        new Set(s.finalResults.map((r) => r.seatId)).size === seats.length,
    );
    for (const result of s.finalResults) {
      requireValid(
        exact(result, [
          'seatId',
          'powered',
          'cash',
          'cities',
          'availableResources',
          'burned',
          'operated',
        ]) &&
          seats.includes(result.seatId) &&
          stock(result.availableResources) &&
          stock(result.burned) &&
          Array.isArray(result.operated),
      );
      const player = s.players[result.seatId]!,
        remaining = pooledResources(player.plants);
      requireValid(
        result.cash === player.cash &&
          result.cities === player.cities.length &&
          result.powered === player.powered &&
          RESOURCES.every(
            (r) =>
              remaining[r] + result.burned[r] === result.availableResources[r],
          ),
      );
      const capacity = { coal: 0, oil: 0, garbage: 0, uranium: 0, hybrid: 0 };
      for (const owned of player.plants) {
        const face = getPlant(owned.id);
        if (face.input)
          capacity[face.fuel as keyof typeof capacity] += face.input * 2;
      }
      requireValid(
        Math.max(0, result.availableResources.coal - capacity.coal) +
          Math.max(0, result.availableResources.oil - capacity.oil) <=
          capacity.hybrid &&
          result.availableResources.garbage <= capacity.garbage &&
          result.availableResources.uranium <= capacity.uranium,
      );
      const planned = planProduction(
        player.plants,
        player.cities.length,
        result.availableResources,
      );
      requireValid(
        result.powered === planned.output &&
          totalStock(result.burned) === totalStock(planned.used),
      );
      requireValid(
        new Set(result.operated.map((run) => run.plantId)).size ===
          result.operated.length,
      );
      const burned = { coal: 0, oil: 0, garbage: 0, uranium: 0 };
      let output = 0;
      for (const run of result.operated) {
        requireValid(
          exact(run, ['plantId', 'coal']) &&
            player.plants.some((p) => p.id === run.plantId) &&
            integer(
              run.coal,
              0,
              getPlant(run.plantId).fuel === 'hybrid'
                ? getPlant(run.plantId).input
                : 0,
            ),
        );
        const use = fuelUse(run.plantId, run.coal);
        for (const resource of RESOURCES) burned[resource] += use[resource];
        output += getPlant(run.plantId).output;
      }
      requireValid(
        equal(result.burned, burned) &&
          result.powered === Math.min(result.cities, output),
      );
    }
    requireValid(
      equal(
        s.finalResults,
        [...s.finalResults].sort(
          (a, b) =>
            b.powered - a.powered || b.cash - a.cash || b.cities - a.cities,
        ),
      ),
    );
    const best = s.finalResults[0]!;
    requireValid(
      equal(
        s.winners,
        s.finalResults
          .filter(
            (r) =>
              r.powered === best.powered &&
              r.cash === best.cash &&
              r.cities === best.cities,
          )
          .map((r) => r.seatId),
      ),
    );
  } else
    requireValid(
      !s.ending &&
        s.finalResults.length === 0 &&
        s.winners.length === 0 &&
        s.actor !== null,
    );
  requireValid(
    Array.isArray(s.history) &&
      s.history.length <= 60 &&
      s.history.length === Math.min(s.logSerial, 60),
  );
  for (const [index, entry] of s.history.entries()) {
    requireValid(
      exact(entry, [
        'id',
        'actor',
        'verb',
        'plantId',
        'cityId',
        'resource',
        'amount',
        'text',
      ]) && entry.id === `pg-${s.logSerial - s.history.length + index + 1}`,
    );
    requireValid(
      (entry.actor === null || seats.includes(entry.actor)) &&
        (entry.plantId === null || PLANT_IDS.includes(entry.plantId)) &&
        (entry.cityId === null || CITIES.some((c) => c.id === entry.cityId)) &&
        (entry.resource === null || RESOURCES.includes(entry.resource)) &&
        (entry.amount === null || integer(entry.amount)) &&
        typeof entry.verb === 'string' &&
        entry.verb.length <= 50 &&
        typeof entry.text === 'string' &&
        entry.text.length <= 500,
    );
  }
  return structuredClone(s);
}
