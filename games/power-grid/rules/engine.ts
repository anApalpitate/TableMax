import type { RuleContext } from '../../../packages/game-sdk/src';
import {
  accepts,
  emptyStock,
  getPlant,
  PLANT_IDS,
  RESOURCE_LABELS,
  RESOURCES,
  RULES_VERSION,
  totalStock,
} from '../data/catalog';
import {
  INITIAL_MARKET,
  income,
  settingsFor,
  TOTAL_RESOURCES,
} from '../data/economy';
import { CITIES, getCity, shortestConnection } from '../data/germany';
import type { Action, CityOption, PowerGridLog, Resource } from '../types';
import { MarketFlow, shuffle } from './market';
import type { State } from './model';
import { fuelUse, planProduction, pooledResources } from './production';
import { resourcePurchaseCost } from './resource-purchase';

export function initialize(context: RuleContext): State {
  const seats = [...context.seats],
    settings = settingsFor(seats.length);
  if (new Set(seats).size !== seats.length || seats.some((s) => !s))
    throw new Error('电力公司座位无效。');
  const initial = shuffle(
    PLANT_IDS.filter((id) => id > 10 && id !== 13),
    context.random,
  );
  const hiddenRemoved = initial.splice(0, settings.removed);
  const order = shuffle(seats, context.random);
  return {
    gameId: 'power-grid',
    rulesVersion: RULES_VERSION,
    stateVersion: 1,
    seatOrder: seats,
    playerOrder: order,
    round: 1,
    step: 1,
    phase: 'regions',
    actor: order[0]!,
    phaseIndex: 0,
    regions: [],
    deck: [13, ...initial, 0],
    market: [3, 4, 5, 6, 7, 8, 9, 10],
    removed: [],
    hiddenRemoved,
    resources: { ...INITIAL_MARKET },
    supply: { coal: 0, oil: 6, garbage: 18, uranium: 10 },
    players: Object.fromEntries(
      seats.map((seat) => [
        seat,
        { cash: 50, plants: [], cities: [], powered: 0, ran: [], produced: 0 },
      ]),
    ),
    auction: null,
    replacement: null,
    bought: [],
    passed: [],
    auctionOpener: null,
    step3Pending: null,
    ending: false,
    actionSerial: 0,
    logSerial: 0,
    history: [],
    incomeIssued: 0,
    spent: 0,
    winners: [],
    finalResults: [],
  };
}
export function log(
  s: State,
  entry: Partial<Omit<PowerGridLog, 'id'>> &
    Pick<PowerGridLog, 'verb' | 'text'>,
) {
  s.history.push({
    id: `pg-${++s.logSerial}`,
    actor: null,
    plantId: null,
    cityId: null,
    resource: null,
    amount: null,
    ...entry,
  });
  if (s.history.length > 60) s.history.shift();
}
export function playerOrder(s: State): string[] {
  return [...s.seatOrder].sort(
    (a, b) =>
      s.players[b]!.cities.length - s.players[a]!.cities.length ||
      Math.max(0, ...s.players[b]!.plants.map((p) => p.id)) -
        Math.max(0, ...s.players[a]!.plants.map((p) => p.id)),
  );
}
export function buildOptions(s: State, seat: string): CityOption[] {
  const player = s.players[seat];
  if (!player) return [];
  return CITIES.filter(
    (city) =>
      s.regions.includes(city.region) && !player.cities.includes(city.id),
  ).flatMap((city) => {
    const occupied = Object.values(s.players).filter((p) =>
      p.cities.includes(city.id),
    ).length;
    if (occupied >= s.step) return [];
    const route = shortestConnection(player.cities, city.id, s.regions);
    if (!route) return [];
    const buildingCost = [10, 15, 20][occupied]!,
      cost = route.cost + buildingCost;
    return [
      {
        cityId: city.id,
        cost,
        connectionCost: route.cost,
        buildingCost,
        path: route.path,
      },
    ];
  });
}
export function ownedPlant(s: State, seat: string, id: number) {
  const plant = s.players[seat]!.plants.find((p) => p.id === id);
  if (!plant) throw new Error('这不是本人的电厂。');
  return plant;
}
export function canStore(
  s: State,
  seat: string,
  plantId: number,
  resource: Resource,
): boolean {
  const owned = ownedPlant(s, seat, plantId);
  return (
    accepts(plantId, resource) &&
    totalStock(owned.resources) < getPlant(plantId).input * 2
  );
}
function spend(s: State, seat: string, amount: number) {
  s.players[seat]!.cash -= amount;
  s.spent += amount;
}

export class TurnFlow {
  private readonly market: MarketFlow;
  constructor(
    private readonly s: State,
    context: RuleContext,
  ) {
    this.market = new MarketFlow(s, context);
  }
  startResources() {
    const s = this.s;
    if (s.step3Pending === 'auction') this.market.activateStep3();
    if (s.round === 1) s.playerOrder = playerOrder(s);
    s.phase = 'resources';
    s.phaseIndex = 0;
    s.actor = s.playerOrder.at(-1)!;
    s.auctionOpener = null;
  }
  private nextInPhase() {
    const s = this.s;
    s.phaseIndex++;
    const reverse = s.phase === 'resources' || s.phase === 'building';
    const order = reverse ? [...s.playerOrder].reverse() : s.playerOrder;
    s.actor = order[s.phaseIndex] ?? null;
    return s.actor !== null;
  }
  finish(cities?: number) {
    const s = this.s,
      seat = s.actor!;
    if (s.phase === 'resources') {
      if (!this.nextInPhase()) {
        s.phase = 'building';
        s.phaseIndex = 0;
        s.actor = s.playerOrder.at(-1)!;
      }
      return;
    }
    if (s.phase === 'building') {
      if (this.nextInPhase()) return;
      s.ending = Object.values(s.players).some(
        (p) => p.cities.length >= settingsFor(s.seatOrder.length).end,
      );
      if (s.ending) {
        if (s.step3Pending === 'building') this.market.activateStep3();
        this.end();
        return;
      }
      if (s.step3Pending === 'building') this.market.activateStep3();
      else if (
        s.step === 1 &&
        Object.values(s.players).some(
          (p) => p.cities.length >= settingsFor(s.seatOrder.length).step2,
        )
      ) {
        const step3 = this.market.startStep2();
        log(s, {
          verb: 'step',
          text: step3
            ? '进入第三步；下轮可以建设三个城市位置。'
            : '进入第二步；下轮可以建设第二个城市位置。',
        });
      }
      s.phase = 'powering';
      s.phaseIndex = 0;
      s.actor = s.playerOrder[0]!;
      for (const player of Object.values(s.players)) {
        player.ran = [];
        player.produced = 0;
        player.powered = 0;
      }
      return;
    }
    const p = s.players[seat]!;
    p.powered = cities!;
    const payment = income(p.powered);
    p.cash += payment;
    s.incomeIssued += payment;
    log(s, {
      actor: seat,
      verb: 'supply',
      amount: p.powered,
      text: `供电 ${p.powered} 座城市，获得 ${payment} 电币。`,
    });
    if (this.nextInPhase()) return;
    this.market.bureaucracy();
    // Classic p.6 requires one final Step 2 refill when its card is drawn
    // during bureaucracy, even if Step 1 was skipped. These automatic
    // updates are atomic, so resolve that card before choosing the table.
    this.market.replenish(s.step3Pending === 'bureaucracy' ? 2 : s.step);
    if (s.step3Pending === 'bureaucracy') this.market.activateStep3();
    s.round++;
    s.playerOrder = playerOrder(s);
    s.phase = 'offer';
    s.phaseIndex = 0;
    s.actor = s.playerOrder[0]!;
    s.bought = [];
    s.passed = [];
    s.auctionOpener = null;
    for (const player of Object.values(s.players)) {
      player.ran = [];
      player.produced = 0;
    }
    log(s, { verb: 'round', text: `第 ${s.round} 轮开始。` });
  }
  build(cityId: string) {
    const s = this.s,
      seat = s.actor!,
      option = buildOptions(s, seat).find((entry) => entry.cityId === cityId)!;
    spend(s, seat, option.cost);
    s.players[seat]!.cities.push(cityId);
    log(s, {
      actor: seat,
      verb: 'build',
      cityId,
      amount: option.cost,
      text: `连接${getCity(cityId).name}，支付 ${option.cost} 电币。`,
    });
    this.market.removeObsolete('building');
  }
  run(plantId: number, coal: number) {
    const s = this.s,
      seat = s.actor!,
      plant = ownedPlant(s, seat, plantId),
      used = fuelUse(plantId, coal);
    for (const resource of RESOURCES) {
      plant.resources[resource] -= used[resource];
      s.supply[resource] += used[resource];
    }
    s.players[seat]!.ran.push(plantId);
    s.players[seat]!.produced += getPlant(plantId).output;
    log(s, {
      actor: seat,
      verb: 'run',
      plantId,
      amount: getPlant(plantId).output,
      text: `运行 ${plantId} 号电厂，产能 ${getPlant(plantId).output} 城。`,
    });
  }
  private end() {
    const s = this.s;
    s.finalResults = s.seatOrder
      .map((seatId) => {
        const player = s.players[seatId]!,
          availableResources = pooledResources(player.plants),
          plan = planProduction(player.plants, player.cities.length);
        for (const resource of RESOURCES) {
          let remaining = plan.used[resource];
          for (const plant of player.plants) {
            const burned = Math.min(remaining, plant.resources[resource]);
            plant.resources[resource] -= burned;
            remaining -= burned;
          }
          s.supply[resource] += plan.used[resource];
        }
        return {
          seatId,
          powered: plan.output,
          cash: player.cash,
          cities: player.cities.length,
          availableResources,
          burned: plan.used,
          operated: plan.runs,
        };
      })
      .sort(
        (a, b) =>
          b.powered - a.powered || b.cash - a.cash || b.cities - a.cities,
      );
    const best = s.finalResults[0]!;
    s.winners = s.finalResults
      .filter(
        (r) =>
          r.powered === best.powered &&
          r.cash === best.cash &&
          r.cities === best.cities,
      )
      .map((r) => r.seatId);
    s.phase = 'ended';
    s.actor = null;
    s.phaseIndex = s.seatOrder.length;
    s.auctionOpener = null;
    for (const result of s.finalResults)
      s.players[result.seatId]!.powered = result.powered;
    log(s, { verb: 'end', text: `对局结束：最高供电 ${best.powered} 城。` });
  }
}

export class AuctionFlow {
  private readonly market: MarketFlow;
  constructor(
    private readonly s: State,
    private readonly context: RuleContext,
  ) {
    this.market = new MarketFlow(s, context);
  }
  private eligible() {
    return this.s.seatOrder.filter(
      (seat) =>
        !this.s.bought.includes(seat) &&
        !this.s.passed.includes(seat) &&
        !this.s.auction?.passes.includes(seat),
    );
  }
  private nextBidder(after: string) {
    const s = this.s,
      a = s.auction!,
      eligible = this.eligible().filter((seat) => seat !== a.highBidder);
    for (let i = 1; i <= s.seatOrder.length; i++) {
      const seat =
        s.seatOrder[(s.seatOrder.indexOf(after) + i) % s.seatOrder.length]!;
      if (eligible.includes(seat)) {
        a.actor = seat;
        s.actor = seat;
        return;
      }
    }
    this.sell();
  }
  offer(plantId: number, amount: number) {
    const s = this.s,
      seat = s.actor!;
    s.auctionOpener = seat;
    s.auction = {
      plantId,
      opener: seat,
      highBidder: seat,
      amount,
      passes: [],
      actor: seat,
    };
    s.phase = 'auction';
    log(s, {
      actor: seat,
      verb: 'offer',
      plantId,
      amount,
      text: `竞拍 ${plantId} 号电厂，起价 ${amount} 电币。`,
    });
    this.nextBidder(seat);
  }
  bid(amount: number) {
    const s = this.s,
      a = s.auction!,
      seat = s.actor!;
    a.amount = amount;
    a.highBidder = seat;
    log(s, {
      actor: seat,
      verb: 'bid',
      plantId: a.plantId,
      amount,
      text: `${a.plantId} 号电厂出价 ${amount} 电币。`,
    });
    this.nextBidder(seat);
  }
  pass() {
    const s = this.s,
      seat = s.actor!;
    if (s.phase === 'auction') {
      s.auction!.passes.push(seat);
      log(s, {
        actor: seat,
        verb: 'pass',
        plantId: s.auction!.plantId,
        text: '退出本次竞拍。',
      });
      this.nextBidder(seat);
    } else {
      s.passed.push(seat);
      log(s, { actor: seat, verb: 'pass-round', text: '本轮不再购买电厂。' });
      this.continue();
    }
  }
  private sell() {
    const s = this.s,
      a = s.auction!,
      buyer = a.highBidder,
      player = s.players[buyer]!;
    const oldPlantIds = player.plants.map((p) => p.id);
    spend(s, buyer, a.amount);
    player.plants.push({ id: a.plantId, resources: emptyStock() });
    s.bought.push(buyer);
    s.market = s.market.filter((id) => id !== a.plantId);
    s.auction = null;
    log(s, {
      actor: buyer,
      verb: 'purchase-plant',
      plantId: a.plantId,
      amount: a.amount,
      text: `购得 ${a.plantId} 号电厂，支付 ${a.amount} 电币。`,
    });
    this.market.draw('auction');
    this.market.removeObsolete('auction');
    if (player.plants.length > settingsFor(s.seatOrder.length).plantLimit) {
      s.replacement = {
        buyer,
        newPlantId: a.plantId,
        oldPlantIds,
        removedPlantId: null,
        salvage: emptyStock(),
      };
      s.phase = 'replace';
      s.actor = buyer;
    } else this.continue();
  }
  continue() {
    const s = this.s;
    if (s.replacement && totalStock(s.replacement.salvage) > 0) return;
    s.replacement = null;
    s.phase = 'offer';
    const remaining = s.playerOrder.filter(
      (seat) => !s.bought.includes(seat) && !s.passed.includes(seat),
    );
    if (remaining.length) {
      s.actor = remaining.includes(s.auctionOpener ?? '')
        ? s.auctionOpener!
        : remaining[0]!;
      return;
    }
    if (s.bought.length === 0) this.market.removeAndDraw('auction');
    new TurnFlow(s, this.context).startResources();
  }
  discard(plantId: number) {
    const s = this.s,
      r = s.replacement!,
      plant = ownedPlant(s, r.buyer, plantId);
    r.salvage = { ...plant.resources };
    r.removedPlantId = plantId;
    s.removed.push(plantId);
    s.players[r.buyer]!.plants = s.players[r.buyer]!.plants.filter(
      (p) => p.id !== plantId,
    );
    log(s, {
      actor: r.buyer,
      verb: 'discard-plant',
      plantId,
      text: `拆除 ${plantId} 号旧电厂。`,
    });
    if (totalStock(r.salvage) === 0) this.continue();
  }
  salvage(resource: Resource, plantId?: number) {
    const s = this.s,
      r = s.replacement!;
    r.salvage[resource]--;
    if (plantId === undefined) s.supply[resource]++;
    else ownedPlant(s, r.buyer, plantId).resources[resource]++;
    log(s, {
      actor: r.buyer,
      verb: plantId === undefined ? 'discard-salvage' : 'salvage',
      resource,
      plantId: plantId ?? null,
      text:
        plantId === undefined
          ? `弃置 1 份${RESOURCE_LABELS[resource]}至供应。`
          : `转存 1 份${RESOURCE_LABELS[resource]}到 ${plantId} 号电厂。`,
    });
    if (totalStock(r.salvage) === 0) this.continue();
  }
}

export function applyAction(s: State, action: Action, context: RuleContext) {
  const seat = s.actor!,
    auction = new AuctionFlow(s, context),
    turn = new TurnFlow(s, context);
  switch (action.type) {
    case 'select-regions':
      s.regions = [...action.regions];
      s.phase = 'offer';
      s.actor = s.playerOrder[0]!;
      log(s, { actor: seat, verb: 'regions', text: '已选定相连的德国区域。' });
      break;
    case 'offer':
      auction.offer(action.plantId, action.amount);
      break;
    case 'bid':
      auction.bid(action.amount);
      break;
    case 'pass':
      auction.pass();
      break;
    case 'discard-plant':
      auction.discard(action.plantId);
      break;
    case 'salvage':
      auction.salvage(action.resource, action.plantId);
      break;
    case 'discard-salvage':
      auction.salvage(action.resource);
      break;
    case 'buy-resource': {
      const quantity = action.quantity ?? 1,
        cost = resourcePurchaseCost(
          action.resource,
          s.resources[action.resource],
          quantity,
        )!;
      spend(s, seat, cost);
      s.resources[action.resource] -= quantity;
      ownedPlant(s, seat, action.plantId).resources[action.resource] +=
        quantity;
      log(s, {
        actor: seat,
        verb: 'buy-resource',
        plantId: action.plantId,
        resource: action.resource,
        amount: cost,
        text: `购入 ${quantity} 份${RESOURCE_LABELS[action.resource]}，支付 ${cost} 电币。`,
      });
      break;
    }
    case 'transfer':
      ownedPlant(s, seat, action.fromPlantId).resources[action.resource]--;
      ownedPlant(s, seat, action.toPlantId).resources[action.resource]++;
      log(s, {
        actor: seat,
        verb: 'transfer',
        plantId: action.toPlantId,
        resource: action.resource,
        text: `将 1 份${RESOURCE_LABELS[action.resource]}转存到 ${action.toPlantId} 号电厂。`,
      });
      break;
    case 'swap-resources': {
      const from = ownedPlant(s, seat, action.fromPlantId),
        to = ownedPlant(s, seat, action.toPlantId);
      from.resources[action.resource]--;
      to.resources[action.resource]++;
      to.resources[action.otherResource]--;
      from.resources[action.otherResource]++;
      log(s, {
        actor: seat,
        verb: 'swap-resources',
        plantId: action.toPlantId,
        text: `${action.fromPlantId}、${action.toPlantId} 号电厂交换 1 份${RESOURCE_LABELS[action.resource]}与 1 份${RESOURCE_LABELS[action.otherResource]}。`,
      });
      break;
    }
    case 'build':
      turn.build(action.cityId);
      break;
    case 'run':
      turn.run(action.plantId, action.coal);
      break;
    case 'finish':
      turn.finish(action.cities);
      break;
  }
  // All resources remain physical and finite, including transient salvage.
  for (const resource of RESOURCES)
    if (s.resources[resource] > TOTAL_RESOURCES[resource])
      throw new Error('资源市场溢出。');
}
