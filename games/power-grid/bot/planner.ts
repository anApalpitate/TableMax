import { accepts, emptyStock, getPlant, RESOURCES } from '../data/catalog';
import { income, price, replenishment, TOTAL_RESOURCES } from '../data/economy';
import { CITIES, EDGES } from '../data/germany';
import {
  fuelUse,
  maximumProduction,
  pooledResources,
} from '../rules/production';
import type { OwnedPlant, PowerGridView, Stock } from '../types';

export type Forecast = {
  score: number;
  powered: number;
  demand: Stock;
  cities: string[];
  runs: { plantId: number; coal: number }[];
  nodes: number;
};
type Recipe = { output: number; used: Stock; runs: Forecast['runs'] };
type Position = {
  cash: number;
  cities: string[];
  stock: Stock;
  market: Stock;
  supply: Stock;
  step: 1 | 2 | 3;
  powered: number;
  terminal: boolean;
  first: Omit<Forecast, 'score' | 'nodes'> | null;
};
const publicDistances = new Map<string, Map<string, number>>();
function distances(regions: readonly string[]) {
  const key = [...regions].sort().join(',');
  if (publicDistances.has(key)) return publicDistances.get(key)!;
  const cities = CITIES.filter((c) => regions.includes(c.region));
  const ids = cities.map((c) => c.id);
  const matrix = ids.map((id) =>
    ids.map((other) => (id === other ? 0 : Infinity)),
  );
  for (const edge of EDGES) {
    const a = ids.indexOf(edge.from),
      b = ids.indexOf(edge.to);
    if (a >= 0 && b >= 0) matrix[a]![b] = matrix[b]![a] = edge.cost;
  }
  for (let k = 0; k < ids.length; k++)
    for (let i = 0; i < ids.length; i++)
      for (let j = 0; j < ids.length; j++)
        matrix[i]![j] = Math.min(
          matrix[i]![j]!,
          matrix[i]![k]! + matrix[k]![j]!,
        );
  const result = new Map(
    ids.flatMap((id, i) =>
      ids.map((other, j) => [`${id}:${other}`, matrix[i]![j]!] as const),
    ),
  );
  publicDistances.set(key, result);
  return result;
}

// Repack only resources which the proposed plant group can legally store.
// Fixed-fuel warehouses precede shared warehouses; transfers do not change value.
export function stored(
  plants: readonly OwnedPlant[],
  stock: Stock,
  values?: Stock,
): Stock {
  const remaining = { ...stock },
    result = emptyStock();
  for (const owned of [...plants].sort(
    (a, b) =>
      Number(getPlant(a.id).fuel === 'hybrid') -
        Number(getPlant(b.id).fuel === 'hybrid') || a.id - b.id,
  )) {
    let room = getPlant(owned.id).input * 2;
    for (const resource of [...RESOURCES].sort((a, b) =>
      values ? values[b] - values[a] : 0,
    )) {
      if (!accepts(owned.id, resource)) continue;
      const amount = Math.min(room, remaining[resource]);
      room -= amount;
      remaining[resource] -= amount;
      result[resource] += amount;
    }
  }
  return result;
}

function recipes(plants: readonly OwnedPlant[]): Recipe[] {
  let frontier: Recipe[] = [{ output: 0, used: emptyStock(), runs: [] }];
  for (const owned of plants) {
    const face = getPlant(owned.id),
      next = [...frontier];
    for (const entry of frontier)
      for (
        let coal = 0;
        coal <= (face.fuel === 'hybrid' ? face.input : 0);
        coal++
      ) {
        const use = fuelUse(owned.id, coal),
          used = emptyStock();
        for (const resource of RESOURCES)
          used[resource] = use[resource] + entry.used[resource];
        next.push({
          output: entry.output + face.output,
          used,
          runs: [...entry.runs, { plantId: owned.id, coal }],
        });
      }
    // Equivalent resource/production states cannot improve a later forecast.
    frontier = [
      ...new Map(
        next.map((entry) => [
          [entry.output, ...RESOURCES.map((r) => entry.used[r])].join(','),
          entry,
        ]),
      ).values(),
    ];
  }
  return frontier.sort(
    (a, b) => b.output - a.output || a.runs.length - b.runs.length,
  );
}

export function forecast(
  view: PowerGridView,
  plants: readonly OwnedPlant[],
  cash: number,
  level: number,
  signal?: AbortSignal,
  maxNodes?: number,
): Forecast {
  if (!view.self) throw new Error('规划缺少本人投影。');
  const own = view.players[view.self.seatId]!,
    horizon = level === 2 ? 3 : level === 1 ? 2 : 1;
  const width = level === 2 ? 16 : level === 1 ? 8 : 1;
  const limit = maxNodes ?? (level === 2 ? 6000 : level === 1 ? 1000 : 160);
  const values = Object.fromEntries(
    RESOURCES.map((r) => [
      r,
      view.resourcePrices[r] ?? (r === 'uranium' ? 16 : 8),
    ]),
  ) as Stock;
  const allRecipes = recipes(plants),
    original = pooledResources(own.plants);
  const distance = distances(view.regions);
  const zones = CITIES.filter((c) => view.regions.includes(c.region));
  const rivals = Object.entries(view.players).filter(
    ([seat]) => seat !== view.self!.seatId,
  );
  const rivalPower = Math.max(
    0,
    ...rivals.map(([, p]) => maximumProduction(p.plants, p.cities.length)),
  );
  const buildTarget = (position: Position, output: number) =>
    position.cities.length >= view.endThreshold - 5 && output >= rivalPower
      ? Math.max(output, view.endThreshold)
      : output;
  let nodes = 0,
    ceiling = limit;
  const tick = () => {
    if (signal?.aborted) throw new Error('策略已取消。');
    if (nodes >= ceiling) return false;
    nodes++;
    return true;
  };
  const optionCache = new Map<string, { id: string; cost: number }[]>();
  const occupied = new Map(
    zones.map((city) => [
      city.id,
      rivals.filter(([, p]) => p.cities.includes(city.id)).length,
    ]),
  );
  const contestedCities = new Set(
    zones
      .filter((city) =>
        rivals.some(([, p]) =>
          p.cities.some((id) => (distance.get(id + ':' + city.id) ?? 99) <= 8),
        ),
      )
      .map((city) => city.id),
  );
  const options = (position: Position, contested: boolean) => {
    const key =
      position.step +
      ':' +
      Number(contested) +
      ':' +
      [...position.cities].sort().join(',');
    if (!optionCache.has(key))
      optionCache.set(
        key,
        zones
          .filter(
            (city) =>
              !position.cities.includes(city.id) &&
              occupied.get(city.id)! < position.step,
          )
          .map((city) => {
            const connection = position.cities.length
              ? Math.min(
                  ...position.cities.map(
                    (id) => distance.get(id + ':' + city.id) ?? Infinity,
                  ),
                )
              : 0;
            return {
              id: city.id,
              cost:
                connection +
                10 +
                occupied.get(city.id)! * 5 +
                (contested && contestedCities.has(city.id) ? 5 : 0),
            };
          })
          .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id)),
      );
    return optionCache.get(key)!.filter((o) => o.cost <= position.cash);
  };
  const rank = (p: Position) => {
    if (p.terminal)
      return (
        (p.powered > rivalPower
          ? 100_000
          : p.powered < rivalPower
            ? -100_000
            : 0) +
        p.powered * 1000 +
        (p.cash / (1 + p.cash)) * 100
      );
    // Cash includes every predicted purchase and income. Residual fuel has only
    // conservative replacement value; no unknown future plant is purchased.
    return (
      p.cash +
      p.cities.length * 30 +
      p.powered * 8 +
      RESOURCES.reduce(
        (n, r) => n + p.stock[r] * (price(r, p.market[r]) ?? 0) * 0.25,
        0,
      )
    );
  };
  const results: Position[][] = [];
  const firstKey = (p: Position) => JSON.stringify(p.first);
  for (const scenario of level === 2 ? ['base', 'fuel', 'city'] : ['base']) {
    const initialStock = stored(plants, original, values),
      supply = { ...view.supply };
    for (const r of RESOURCES) supply[r] += original[r] - initialStock[r];
    let frontier: Position[] = [
      {
        cash,
        cities: [...own.cities],
        stock: initialStock,
        market: { ...view.resources },
        supply,
        step:
          view.step3Pending &&
          ['offer', 'auction', 'replace'].includes(view.phase)
            ? 3
            : view.step,
        powered: 0,
        terminal: false,
        first: null,
      },
    ];
    for (let round = 0; round < horizon; round++) {
      ceiling = Math.min(
        limit,
        nodes + Math.floor(limit / horizon / (level === 2 ? 3 : 1)),
      );
      const next: Position[] = [];
      for (const position of frontier) {
        if (round > 0 && position.terminal) {
          next.push(position);
          continue;
        }
        const currentRecipes =
          round === 0 && view.phase === 'powering'
            ? recipes(plants.filter((p) => !own.ran.includes(p.id)))
            : allRecipes;
        const produced =
          round === 0 && view.phase === 'powering'
            ? own.ran.reduce((sum, id) => sum + getPlant(id).output, 0)
            : 0;
        const purchaseAllowed = !['building', 'powering'].includes(view.phase);
        const variants = currentRecipes.flatMap((raw) =>
          level > 0 && round === 0 && purchaseAllowed
            ? [
                { ...raw, reserve: 0 },
                { ...raw, reserve: 1 },
              ]
            : [{ ...raw, reserve: 0 }],
        );
        const ratings = new Map(
          variants.map((recipe) => {
            const cost = RESOURCES.reduce((sum, r) => {
              const needed = Math.max(
                0,
                recipe.used[r] * (1 + recipe.reserve) - position.stock[r],
              );
              for (let i = 0; i < needed; i++)
                sum += price(r, position.market[r] - i) ?? Infinity;
              return sum;
            }, 0);
            return [
              recipe,
              income(
                Math.min(recipe.output + produced, position.cities.length + 3),
              ) *
                (horizon - round) -
                cost,
            ] as const;
          }),
        );
        variants.sort(
          (a, b) => ratings.get(b)! - ratings.get(a)! || a.reserve - b.reserve,
        );
        // Always retain a no-purchase baseline before bounded expansion.
        const baseline = variants.findIndex(
          (r) =>
            RESOURCES.every(
              (resource) => r.used[resource] <= position.stock[resource],
            ) && r.reserve === 0,
        );
        if (baseline > 0) variants.unshift(variants.splice(baseline, 1)[0]!);
        for (const raw of variants) {
          const recipe = { ...raw, output: raw.output + produced };
          if (!tick()) break;
          const stock = { ...position.stock },
            market = { ...position.market },
            supply = { ...position.supply },
            demand = emptyStock();
          let expense = 0,
            possible = true;
          for (const r of RESOURCES) {
            demand[r] = Math.max(
              0,
              recipe.used[r] * (1 + recipe.reserve) - stock[r],
            );
            if (
              round === 0 &&
              ['building', 'powering'].includes(view.phase) &&
              demand[r] > 0
            )
              possible = false;
            let remaining = market[r];
            if (scenario === 'fuel' && round > 0) {
              const pressure = rivals.reduce(
                (sum, [, p]) =>
                  sum +
                  p.plants.reduce(
                    (n, plant) =>
                      n +
                      (accepts(plant.id, r)
                        ? Math.max(
                            0,
                            getPlant(plant.id).input - plant.resources[r],
                          )
                        : 0),
                    0,
                  ),
                0,
              );
              const removed = Math.min(remaining, pressure);
              remaining -= removed;
              supply[r] += removed;
            }
            for (let i = 0; i < demand[r]; i++) {
              const cost = price(r, remaining--);
              if (cost === null) {
                possible = false;
                break;
              }
              expense += cost;
            }
            stock[r] += demand[r];
            market[r] = Math.max(0, remaining);
          }
          const packed = stored(plants, stock);
          if (
            !possible ||
            expense > position.cash ||
            RESOURCES.some((r) => packed[r] < stock[r])
          )
            continue;
          const funded = {
            ...position,
            cash: position.cash - expense,
            stock,
            market,
            supply,
          };
          let builds = [funded];
          // Search three expansion decisions, then finish each branch greedily.
          if (view.phase !== 'powering' || round > 0)
            for (let depth = 0; depth < 3; depth++) {
              const branches = [...builds];
              for (const b of builds) {
                if (
                  b.cities.length >= buildTarget(b, recipe.output) ||
                  b.cities.length >= view.endThreshold
                )
                  continue;
                for (const option of options(
                  b,
                  scenario === 'city' && round > 0,
                ).slice(0, level === 0 ? 1 : 3)) {
                  if (!tick()) break;
                  branches.push({
                    ...b,
                    cash: b.cash - option.cost,
                    cities: [...b.cities, option.id],
                  });
                }
              }
              builds = branches
                .sort(
                  (a, b) =>
                    income(Math.min(recipe.output, b.cities.length)) *
                      (horizon - round) +
                      b.cash -
                      income(Math.min(recipe.output, a.cities.length)) *
                        (horizon - round) -
                      a.cash ||
                    a.cities.join(',').localeCompare(b.cities.join(',')),
                )
                .slice(0, width);
            }
          for (let b of builds) {
            if (view.phase !== 'powering' || round > 0)
              while (
                b.cities.length < buildTarget(b, recipe.output) &&
                b.cities.length < view.endThreshold
              ) {
                const option = options(b, scenario === 'city' && round > 0)[0];
                if (
                  !option ||
                  !tick() ||
                  ((income(b.cities.length + 1) - income(b.cities.length)) *
                    (horizon - round) +
                    38 <
                    option.cost &&
                    !(
                      b.cities.length >= view.endThreshold - 5 &&
                      recipe.output >= rivalPower
                    ))
                )
                  break;
                b = {
                  ...b,
                  cash: b.cash - option.cost,
                  cities: [...b.cities, option.id],
                };
              }
            const powered = Math.min(b.cities.length, recipe.output),
              remaining = emptyStock();
            for (const r of RESOURCES) remaining[r] = stock[r] - recipe.used[r];
            const ending =
              b.cities.length >= view.endThreshold ||
              rivals.some(([, p]) => p.cities.length >= view.endThreshold);
            const step =
              view.step3Pending && view.phase === 'building'
                ? 3
                : b.step === 1 &&
                    Math.max(
                      b.cities.length,
                      ...rivals.map(([, p]) => p.cities.length),
                    ) >= view.step2Threshold
                  ? 2
                  : b.step;
            const refill = replenishment(view.seatOrder.length, step);
            const replenished = { ...market };
            const returned = { ...supply };
            for (const r of RESOURCES) {
              returned[r] += recipe.used[r];
              const amount = Math.min(
                TOTAL_RESOURCES[r] - market[r],
                refill[r],
                returned[r],
              );
              replenished[r] = market[r] + amount;
              returned[r] -= amount;
            }
            next.push({
              ...b,
              cash: b.cash + (ending ? 0 : income(powered)),
              stock: remaining,
              market: replenished,
              supply: returned,
              step,
              powered,
              terminal: ending,
              first: b.first ?? {
                powered,
                demand,
                cities: b.cities.slice(own.cities.length),
                runs: recipe.runs,
              },
            });
          }
        }
      }
      if (!next.length) break;
      frontier = next
        .sort(
          (a, b) =>
            rank(b) - rank(a) ||
            b.powered - a.powered ||
            a.cities.join(',').localeCompare(b.cities.join(',')),
        )
        .filter(
          (position, index, sorted) =>
            round === 0 ||
            sorted.findIndex((p) => firstKey(p) === firstKey(position)) ===
              index,
        )
        .slice(0, width);
    }
    if (frontier.length) results.push(frontier.filter((p) => p.first));
  }
  const combined = (results[0] ?? [])
    .map((position) => {
      const alternatives = results.map((scenario) =>
        scenario.find((p) => firstKey(p) === firstKey(position)),
      );
      const lowest = Math.min(
        ...alternatives.map((p) => (p ? rank(p) : rank(position) - 20)),
      );
      return { position, lowest };
    })
    .sort(
      (a, b) =>
        b.lowest - a.lowest ||
        b.position.powered - a.position.powered ||
        firstKey(a.position).localeCompare(firstKey(b.position)),
    );
  const chosen = combined[0]?.position;
  if (!chosen)
    return {
      score: 0,
      powered: 0,
      demand: emptyStock(),
      cities: [],
      runs: [],
      nodes,
    };
  return {
    score: combined[0]!.lowest - cash,
    ...(chosen.first ?? {
      powered: 0,
      demand: emptyStock(),
      cities: [],
      runs: [],
    }),
    nodes: Math.min(nodes, limit),
  };
}

export function nextBid(current: number, budget: number): number | null {
  const ceiling = Math.floor(budget);
  if (current >= ceiling) return null;
  const target = [
    Math.ceil(ceiling * 0.6),
    Math.ceil(ceiling * 0.85),
    ceiling,
  ].find((n) => n > current)!;
  return Math.min(ceiling, Math.max(current + 2, target));
}
