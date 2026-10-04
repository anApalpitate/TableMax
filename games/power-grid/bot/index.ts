import type {
  BotDifficulty,
  BotStrategy,
} from '../../../packages/game-sdk/src';
import {
  accepts,
  emptyStock,
  getPlant,
  RESOURCES,
  RULES_VERSION,
} from '../data/catalog';
import { income, price } from '../data/economy';
import { CITIES, EDGES, shortestConnection } from '../data/germany';
import {
  fuelUse,
  maximumProduction,
  planProduction,
  pooledResources,
} from '../rules/production';
import type {
  Action,
  OwnedPlant,
  Plant,
  PowerGridView,
  Resource,
} from '../types';

class GridEvaluator {
  readonly player;
  constructor(
    readonly view: PowerGridView,
    readonly level: number,
  ) {
    this.player = view.players[view.self!.seatId]!;
  }
  fuelCost(plant: Plant): number {
    if (plant.input === 0) return 0;
    const resource =
      plant.fuel === 'hybrid'
        ? this.unit('coal') <= this.unit('oil')
          ? 'coal'
          : 'oil'
        : (plant.fuel as Resource);
    let count = this.view.resources[resource],
      cost = 0;
    for (let i = 0; i < plant.input; i++) {
      cost += price(resource, count) ?? 12;
      count--;
    }
    return cost;
  }
  unit(resource: Resource) {
    return (
      this.view.resourcePrices[resource] ?? (resource === 'uranium' ? 20 : 12)
    );
  }
  capacity() {
    return this.player.capacity;
  }
  replacement(plantId: number): OwnedPlant[] {
    const plants = [
      ...this.player.plants,
      { id: plantId, resources: emptyStock() },
    ];
    if (plants.length <= this.view.plantLimit) return plants;
    let best = plants.slice(1),
      score = -Infinity;
    for (const old of this.player.plants) {
      const next = plants.filter((p) => p.id !== old.id),
        rating = next.reduce(
          (sum, p) =>
            sum + getPlant(p.id).output * 12 - this.fuelCost(getPlant(p.id)),
          0,
        );
      if (rating > score) {
        best = next;
        score = rating;
      }
    }
    return best;
  }
  value(plantId: number): number {
    const plant = getPlant(plantId),
      next = this.replacement(plantId);
    const output = next.reduce((sum, p) => sum + getPlant(p.id).output, 0),
      gain = output - this.capacity();
    if (this.player.plants.length >= this.view.plantLimit && gain <= 0) {
      const currentCost = this.player.plants.reduce(
          (sum, p) => sum + this.fuelCost(getPlant(p.id)),
          0,
        ),
        nextCost = next.reduce(
          (sum, p) => sum + this.fuelCost(getPlant(p.id)),
          0,
        );
      if (nextCost >= currentCost) return 0;
      return Math.max(
        0,
        (currentCost - nextCost) * (this.level + 2) + plant.output * 2,
      );
    }
    const rivals = Math.max(
      ...Object.entries(this.view.players)
        .filter(([seat]) => seat !== this.view.self!.seatId)
        .map(([, p]) => p.capacity),
    );
    const late =
      this.view.step === 3 ||
      Math.max(
        ...Object.values(this.view.players).map((p) => p.cities.length),
      ) >=
        this.view.endThreshold - 4;
    const gainValue =
      Math.max(0, gain) * (this.level === 0 ? 8 : late ? 15 : 12);
    const saving =
      Math.max(0, plant.output * 3 - this.fuelCost(plant)) * (this.level + 1);
    const need = this.player.cities.length >= this.capacity() ? 8 : 0;
    const urgency = this.level === 2 && late && output >= rivals ? 9 : 0;
    const reserve =
      this.level === 0
        ? 8
        : this.player.plants.reduce(
            (sum, p) => sum + this.fuelCost(getPlant(p.id)),
            0,
          ) + Math.min(22, this.player.cities.length === 0 ? 10 : 15);
    return Math.max(
      0,
      Math.floor(
        Math.min(
          this.view.self!.cash - reserve,
          gainValue + saving + need + urgency,
        ),
      ),
    );
  }
  startScore(cityId: string): number {
    const selected = CITIES.filter(
      (c) => this.view.regions.includes(c.region) && c.id !== cityId,
    );
    const cheapest = selected
      .map(
        (c) =>
          shortestConnection([cityId], c.id, this.view.regions)?.cost ?? 100,
      )
      .sort((a, b) => a - b)
      .slice(0, this.level === 2 ? 6 : 3);
    const local = EDGES.filter(
      (edge) => edge.from === cityId || edge.to === cityId,
    ).filter((edge) =>
      this.view.regions.includes(
        CITIES.find(
          (city) => city.id === (edge.from === cityId ? edge.to : edge.from),
        )!.region,
      ),
    ).length;
    return (
      cheapest.reduce((sum, cost) => sum + cost, 0) -
      local * (this.level === 2 ? 4 : 1)
    );
  }
  buildingScore(cityId: string): number {
    const option = this.view.buildOptions.find((o) => o.cityId === cityId)!;
    if (!this.player.cities.length)
      return option.cost + this.startScore(cityId);
    if (this.level < 2) return option.cost;
    const future = CITIES.filter(
      (c) =>
        this.view.regions.includes(c.region) &&
        !this.player.cities.includes(c.id) &&
        c.id !== cityId,
    );
    const link = Math.min(
      ...future.map(
        (c) =>
          shortestConnection(
            [...this.player.cities, cityId],
            c.id,
            this.view.regions,
          )?.cost ?? 100,
      ),
    );
    const contest = Object.entries(this.view.players)
      .filter(([seat]) => seat !== this.view.self!.seatId)
      .some(([, p]) => p.cities.includes(cityId))
      ? 2
      : 0;
    return option.cost + link * 0.35 - contest;
  }
}

export function chooseAction(
  view: PowerGridView,
  actions: readonly Action[],
  difficulty: BotDifficulty,
  random: { next(): number },
): Action {
  if (!view.self || !actions.length)
    throw new Error('电力公司策略缺少本人决策。');
  const level = ['default', 'doubao', 'juewu'].indexOf(difficulty);
  if (level < 0) throw new Error('不支持的人机等级。');
  const evaluate = new GridEvaluator(view, level),
    p = evaluate.player;
  const finish = () => actions.filter((a) => a.type === 'finish').at(-1)!;
  if (view.phase === 'regions') {
    const choices = actions.filter(
      (a): a is Extract<Action, { type: 'select-regions' }> =>
        a.type === 'select-regions',
    );
    if (level === 0)
      return choices[Math.floor(random.next() * choices.length)]!;
    const score = (regions: string[]) =>
      EDGES.filter(
        (e) =>
          regions.includes(CITIES.find((c) => c.id === e.from)!.region) &&
          regions.includes(CITIES.find((c) => c.id === e.to)!.region),
      ).reduce((sum, e) => sum + (level === 2 ? 22 : 15) - e.cost, 0);
    return choices.sort((a, b) => score(b.regions) - score(a.regions))[0]!;
  }
  if (view.phase === 'offer') {
    const offers = actions.filter(
      (a): a is Extract<Action, { type: 'offer' }> =>
        a.type === 'offer' && a.amount === a.plantId,
    );
    const options = offers
      .map((a) => ({
        action: a,
        score:
          evaluate.value(a.plantId) -
          a.amount +
          (level === 0 ? random.next() * 7 : 0),
      }))
      .sort((a, b) => b.score - a.score || a.action.plantId - b.action.plantId);
    if (options[0] && (view.round === 1 || options[0].score >= 0))
      return options[0].action;
    return actions.find((a) => a.type === 'pass') ?? offers[0]!;
  }
  if (view.phase === 'auction') {
    const bid = actions.find(
      (a): a is Extract<Action, { type: 'bid' }> => a.type === 'bid',
    );
    return bid && bid.amount <= evaluate.value(view.auction!.plantId)
      ? bid
      : actions.find((a) => a.type === 'pass')!;
  }
  if (view.phase === 'replace') {
    const discard = actions.filter(
      (a): a is Extract<Action, { type: 'discard-plant' }> =>
        a.type === 'discard-plant',
    );
    if (discard.length)
      return discard.sort((a, b) => {
        const score = (id: number) => {
          const face = getPlant(id),
            plant = p.plants.find((entry) => entry.id === id)!;
          return (
            face.output * (level === 0 ? 9 : 13) -
            evaluate.fuelCost(face) +
            (level === 2
              ? RESOURCES.reduce(
                  (sum, r) => sum + plant.resources[r] * evaluate.unit(r),
                  0,
                ) * 0.25
              : 0)
          );
        };
        return score(a.plantId) - score(b.plantId) || a.plantId - b.plantId;
      })[0]!;
    const salvage = actions.filter(
      (a): a is Extract<Action, { type: 'salvage' }> => a.type === 'salvage',
    );
    if (salvage.length)
      return salvage.sort(
        (a, b) =>
          getPlant(b.plantId).output / getPlant(b.plantId).input -
          getPlant(a.plantId).output / getPlant(a.plantId).input,
      )[0]!;
    return actions.find((a) => a.type === 'discard-salvage')!;
  }
  if (view.phase === 'resources') {
    const stock = pooledResources(p.plants),
      demand = emptyStock();
    const desired = level === 2 && view.step < 3 ? 2 : 1;
    // Fuel priority follows efficiency; hybrids choose the less contested type.
    for (const owned of [...p.plants].sort(
      (a, b) =>
        getPlant(b.id).output / (getPlant(b.id).input || 0.01) -
        getPlant(a.id).output / (getPlant(a.id).input || 0.01),
    )) {
      const face = getPlant(owned.id);
      if (face.input === 0) continue;
      let resource: Resource;
      if (face.fuel === 'hybrid') {
        const demandAt = (r: Resource) =>
          Object.entries(view.players)
            .filter(([seat]) => seat !== view.self!.seatId)
            .reduce(
              (sum, [, player]) =>
                sum +
                player.plants.reduce(
                  (n, plant) =>
                    n + (accepts(plant.id, r) ? getPlant(plant.id).input : 0),
                  0,
                ),
              0,
            );
        resource =
          evaluate.unit('coal') + (level === 2 ? demandAt('coal') * 0.3 : 0) <=
          evaluate.unit('oil') + (level === 2 ? demandAt('oil') * 0.3 : 0)
            ? 'coal'
            : 'oil';
      } else resource = face.fuel as Resource;
      demand[resource] += face.input * desired;
    }
    const reserve =
      level === 0
        ? 5
        : Math.min(
            25,
            view.buildOptions
              .filter((o) => o.cost <= view.self!.cash)
              .sort((a, b) => a.cost - b.cost)[0]?.cost ?? 10,
          );
    const buys = actions.filter(
      (a): a is Extract<Action, { type: 'buy-resource' }> =>
        a.type === 'buy-resource',
    );
    const need = buys.filter(
      (a) =>
        stock[a.resource] < demand[a.resource] &&
        (view.resourcePrices[a.resource] ?? 99) <= view.self!.cash - reserve,
    );
    if (need.length) {
      const priority = (a: Extract<Action, { type: 'buy-resource' }>) =>
        ((demand[a.resource] - stock[a.resource]) /
          Math.max(1, demand[a.resource])) *
          10 -
        evaluate.unit(a.resource) * 0.15 +
        getPlant(a.plantId).output / getPlant(a.plantId).input;
      return need.sort((a, b) => priority(b) - priority(a))[0]!;
    }
    // When chosen fuel is sold out, hybrids can still run on the other fuel.
    if (
      maximumProduction(p.plants) <
      Math.min(p.capacity, Math.max(1, p.cities.length))
    ) {
      const useful = buys.filter(
        (a) =>
          view.self!.cash > evaluate.unit(a.resource) &&
          accepts(a.plantId, a.resource),
      );
      if (useful.length)
        return useful.sort(
          (a, b) => evaluate.unit(a.resource) - evaluate.unit(b.resource),
        )[0]!;
    }
    return finish();
  }
  if (view.phase === 'building') {
    const builds = actions
      .filter(
        (a): a is Extract<Action, { type: 'build' }> => a.type === 'build',
      )
      .sort(
        (a, b) =>
          evaluate.buildingScore(a.cityId) - evaluate.buildingScore(b.cityId),
      );
    if (!builds.length) return finish();
    const production = maximumProduction(p.plants),
      target =
        level === 0
          ? p.capacity
          : Math.min(p.capacity, Math.max(production, 1));
    const opponents = Object.entries(view.players)
      .filter(([seat]) => seat !== view.self!.seatId)
      .map(([, player]) =>
        maximumProduction(player.plants, player.cities.length),
      );
    const canWin =
      production >= Math.max(...opponents) &&
      production >= view.endThreshold - 1;
    if (p.cities.length >= target && !canWin) return finish();
    if (
      level === 2 &&
      !canWin &&
      p.cities.length >= target - 1 &&
      p.cities.length >= view.step2Threshold &&
      p.cities.length < view.endThreshold - 2
    ) {
      const option = view.buildOptions.find(
        (o) => o.cityId === builds[0]!.cityId,
      )!;
      if (
        income(p.cities.length + 1) - income(p.cities.length) <
        option.cost / 4
      )
        return finish();
    }
    // Avoid a premature losing ending; keep the last city for a stronger plant.
    if (level > 0 && p.cities.length >= view.endThreshold - 1 && !canWin)
      return finish();
    return builds[0]!;
  }
  if (view.phase === 'powering') {
    const plants = p.plants.filter((plant) => !p.ran.includes(plant.id));
    const remaining = Math.max(
        0,
        p.cities.length -
          p.ran.reduce((sum, id) => sum + getPlant(id).output, 0),
      ),
      plan = planProduction(plants, remaining, pooledResources(p.plants));
    for (const intended of [...plan.runs].sort(
      (a, b) =>
        (getPlant(a.plantId).fuel === 'hybrid' ? 1 : 0) -
        (getPlant(b.plantId).fuel === 'hybrid' ? 1 : 0),
    )) {
      const run = actions.find(
        (a) =>
          a.type === 'run' &&
          a.plantId === intended.plantId &&
          a.coal === intended.coal,
      );
      if (run) return run;
      const need = fuelUse(intended.plantId, intended.coal),
        owned = p.plants.find((plant) => plant.id === intended.plantId)!;
      const transfer = actions.find(
        (a) =>
          a.type === 'transfer' &&
          a.toPlantId === intended.plantId &&
          owned.resources[a.resource] < need[a.resource],
      );
      if (transfer) return transfer;
      const swap = actions.find(
        (a) =>
          a.type === 'swap-resources' &&
          ((a.toPlantId === intended.plantId &&
            owned.resources[a.resource] < need[a.resource] &&
            owned.resources[a.otherResource] > need[a.otherResource]) ||
            (a.fromPlantId === intended.plantId &&
              owned.resources[a.otherResource] < need[a.otherResource] &&
              owned.resources[a.resource] > need[a.resource])),
      );
      if (swap) return swap;
    }
    // Any locally legal alternative may be needed before a mixed warehouse frees space.
    const run = actions
      .filter((a): a is Extract<Action, { type: 'run' }> => a.type === 'run')
      .sort(
        (a, b) => getPlant(b.plantId).output - getPlant(a.plantId).output,
      )[0];
    return remaining > 0 && run ? run : finish();
  }
  return actions[0]!;
}

export const bot: BotStrategy = {
  id: 'power-grid-local',
  version: '1.0.1',
  gameId: 'power-grid',
  rulesVersion: RULES_VERSION,
  difficulties: ['default', 'doubao', 'juewu'],
  validateMemory(input) {
    if (input !== null) throw new Error('电力公司策略记忆无效。');
    return null;
  },
  async decide({
    view,
    actions,
    difficulty = 'default',
    random,
    signal,
    memory,
  }) {
    if (signal.aborted) throw new Error('策略已取消。');
    if (memory !== null) throw new Error('电力公司策略记忆无效。');
    return {
      action: chooseAction(
        view as PowerGridView,
        actions as readonly Action[],
        difficulty,
        random,
      ),
      memory: null,
    };
  },
};
