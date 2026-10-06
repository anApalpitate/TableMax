import type {
  BotDifficulty,
  BotStrategy,
} from '../../../packages/game-sdk/src';
import {
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
import { forecast, nextBid, type Forecast } from './planner';
import type {
  Action,
  OwnedPlant,
  Plant,
  PowerGridView,
  Resource,
} from '../types';

class GridEvaluator {
  readonly player;
  readonly plans = new Map<string, Forecast>();
  constructor(
    readonly view: PowerGridView,
    readonly level: number,
    readonly signal?: AbortSignal,
  ) {
    this.player = view.players[view.self!.seatId]!;
  }
  plan(plants = this.player.plants, cash = this.view.self!.cash) {
    const key =
      plants
        .map((p) => p.id)
        .sort((a, b) => a - b)
        .join(',') +
      ':' +
      cash;
    if (!this.plans.has(key)) {
      const cases =
        this.view.phase === 'offer'
          ? 1 +
            this.view.actualMarket.length *
              Math.max(1, this.player.plants.length)
          : this.view.phase === 'auction'
            ? 1 + Math.max(1, this.player.plants.length)
            : this.view.phase === 'replace'
              ? this.player.plants.length
              : 1;
      this.plans.set(
        key,
        forecast(
          this.view,
          plants,
          cash,
          this.level,
          this.signal,
          Math.floor(
            (this.level === 2 ? 6000 : this.level === 1 ? 1000 : 160) / cases,
          ),
        ),
      );
    }
    return this.plans.get(key)!;
  }
  fuelCost(plant: Plant): number {
    const stock = pooledResources(this.player.plants);
    let cheapest = Infinity;
    for (
      let coal = 0;
      coal <= (plant.fuel === 'hybrid' ? plant.input : 0);
      coal++
    ) {
      const use = fuelUse(plant.id, coal);
      let cost = 0;
      for (const r of RESOURCES)
        for (let i = 0; i < Math.max(0, use[r] - stock[r]); i++) {
          const unit = price(r, this.view.resources[r] - i);
          cost += unit ?? Infinity;
        }
      cheapest = Math.min(cheapest, cost);
    }
    return cheapest;
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
    if (this.level > 0)
      return this.player.plants
        .map((old) => plants.filter((p) => p.id !== old.id))
        .sort(
          (a, b) =>
            this.plan(b, Math.max(0, this.view.self!.cash - plantId)).score -
              this.plan(a, Math.max(0, this.view.self!.cash - plantId)).score ||
            a[0]!.id - b[0]!.id,
        )[0]!;
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
    if (!Number.isFinite(this.fuelCost(plant))) return 0;
    if (this.level > 0) {
      const baseline = this.plan(),
        proposed = this.plan(next, Math.max(0, this.view.self!.cash - plantId));
      const fuelReserve = RESOURCES.reduce(
        (n, r) => n + proposed.demand[r] * this.unit(r),
        0,
      );
      const buildingReserve =
        this.player.cities.length === 0
          ? 10
          : Math.min(22, ...this.view.buildOptions.map((o) => o.cost), 22);
      return Math.max(
        0,
        Math.floor(
          Math.min(
            this.view.self!.cash - fuelReserve - buildingReserve,
            Math.max(
              0,
              proposed.score - baseline.score,
              (next.reduce((n, p) => n + getPlant(p.id).output, 0) -
                this.capacity()) *
                (this.player.cities.length >= this.view.endThreshold - 5
                  ? 18
                  : 10),
            ),
          ),
        ),
      );
    }
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
        ? Math.max(8, this.fuelCost(plant)) +
          (this.player.cities.length === 0
            ? 10
            : Math.min(22, ...this.view.buildOptions.map((o) => o.cost), 22))
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
  signal?: AbortSignal,
): Action {
  if (!view.self || !actions.length)
    throw new Error('电力公司策略缺少本人决策。');
  const level = ['default', 'doubao', 'juewu'].indexOf(difficulty);
  if (level < 0) throw new Error('不支持的人机等级。');
  const evaluate = new GridEvaluator(view, level, signal),
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
    const amount = nextBid(
      view.auction!.amount,
      evaluate.value(view.auction!.plantId),
    );
    return (
      actions.find((a) => a.type === 'bid' && a.amount === amount) ??
      actions.find((a) => a.type === 'pass')!
    );
  }
  if (view.phase === 'replace') {
    const discard = actions.filter(
      (a): a is Extract<Action, { type: 'discard-plant' }> =>
        a.type === 'discard-plant',
    );
    if (discard.length)
      return discard.sort((a, b) => {
        if (level > 0)
          return (
            evaluate.plan(p.plants.filter((plant) => plant.id !== b.plantId))
              .score -
              evaluate.plan(p.plants.filter((plant) => plant.id !== a.plantId))
                .score || a.plantId - b.plantId
          );
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
          evaluate.unit(b.resource) - evaluate.unit(a.resource) ||
          Number(getPlant(a.plantId).fuel === 'hybrid') -
            Number(getPlant(b.plantId).fuel === 'hybrid') ||
          getPlant(b.plantId).output / getPlant(b.plantId).input -
            getPlant(a.plantId).output / getPlant(a.plantId).input,
      )[0]!;
    return actions.find((a) => a.type === 'discard-salvage')!;
  }
  if (view.phase === 'resources') {
    const planned = evaluate.plan();
    const buys = actions.filter(
      (a): a is Extract<Action, { type: 'buy-resource' }> =>
        a.type === 'buy-resource' && (a.quantity ?? 1) === 1,
    );
    const need = buys.filter((a) => planned.demand[a.resource] > 0);
    if (need.length)
      return need.sort(
        (a, b) =>
          evaluate.unit(a.resource) - evaluate.unit(b.resource) ||
          Number(getPlant(a.plantId).fuel === 'hybrid') -
            Number(getPlant(b.plantId).fuel === 'hybrid') ||
          a.plantId - b.plantId,
      )[0]!;
    return finish();
  }
  if (view.phase === 'building') {
    if (level > 0) {
      const planned = evaluate.plan();
      const production = maximumProduction(p.plants);
      const rival = Math.max(
        0,
        ...Object.entries(view.players)
          .filter(([seat]) => seat !== view.self!.seatId)
          .map(([, player]) =>
            maximumProduction(player.plants, player.cities.length),
          ),
      );
      const affordable = view.buildOptions
        .filter((o) => o.cost <= view.self!.cash)
        .sort((a, b) => a.cost - b.cost || a.cityId.localeCompare(b.cityId))[0];
      return (
        actions.find(
          (a) => a.type === 'build' && a.cityId === planned.cities[0],
        ) ??
        (affordable &&
        (p.cities.length < Math.min(p.capacity, production) ||
          (p.cities.length >= view.endThreshold - 5 && production >= rival)) &&
        (p.cities.length < view.endThreshold - 1 || production >= rival)
          ? actions.find(
              (a) => a.type === 'build' && a.cityId === affordable.cityId,
            )
          : null) ??
        finish()
      );
    }
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
    const strategic = level > 0 ? evaluate.plan() : null;
    const plants = p.plants.filter((plant) => !p.ran.includes(plant.id));
    const remaining = Math.max(
        0,
        p.cities.length -
          p.ran.reduce((sum, id) => sum + getPlant(id).output, 0),
      ),
      plan = planProduction(plants, remaining, pooledResources(p.plants));
    for (const intended of [...(strategic?.runs ?? plan.runs)].sort(
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
    if (strategic && !strategic.runs.length)
      return (
        actions.find(
          (a) => a.type === 'finish' && a.cities === strategic.powered,
        ) ?? finish()
      );
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
        signal,
      ),
      memory: null,
    };
  },
};
