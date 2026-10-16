import type { Action, BoatView, CargoId, ManilaView } from '../rules/view';

const sums: number[][] = [[1]];
for (let n = 1; n <= 3; n++) {
  const distribution = Array(n * 6 + 1).fill(0) as number[];
  for (let total = 0; total < sums[n - 1]!.length; total++)
    for (let die = 1; die <= 6; die++)
      distribution[total + die] =
        distribution[total + die]! + sums[n - 1]![total]! / 6;
  sums.push(distribution);
}
export function chance(
  position: number,
  rolls: number,
  minimum: number,
): number {
  return sums[Math.max(0, Math.min(3, rolls))]!.reduce(
    (p, value, total) => p + (position + total >= minimum ? value : 0),
    0,
  );
}
export function exact(position: number, rolls: number, target: number): number {
  return sums[Math.max(0, Math.min(3, rolls))]![target - position] ?? 0;
}
export function ownShares(v: ManilaView, cargo: CargoId): number {
  return v.self!.shares.filter((share) => share.cargo === cargo).length;
}
export function priceStep(v: ManilaView, cargo: CargoId): number {
  return v.market[cargo] === 20 ? 10 : 5;
}
export function pirates(v: ManilaView): string[] {
  return v.spaces
    .filter((x) => x.kind === 'pirate' && x.occupant)
    .map((x) => x.occupant!);
}
export function success(v: ManilaView, b: BoatView): number {
  if (b.destination === 'port') return 1;
  if (b.destination === 'shipyard') return 0;
  return chance(b.position, 3 - v.movement, pirates(v).length ? 14 : 13);
}
export function countsAtLeast(
  probabilities: number[],
  minimum: number,
): number {
  let distribution = [1];
  for (const p of probabilities) {
    const next = Array(distribution.length + 1).fill(0) as number[];
    for (let i = 0; i < distribution.length; i++) {
      next[i] = next[i]! + distribution[i]! * (1 - p);
      next[i + 1] = next[i + 1]! + distribution[i]! * p;
    }
    distribution = next;
  }
  return distribution.reduce(
    (total, p, index) => total + (index >= minimum ? p : 0),
    0,
  );
}
export function projectedWealth(v: ManilaView, cautious: boolean): number {
  const seat = v.self!.seatId,
    ps = pirates(v),
    mine = ps.filter((x) => x === seat).length;
  let total = 0;
  for (const b of v.boats) {
    const p = success(v, b),
      cargo = v.cargos.find((x) => x.id === b.cargo)!;
    const dilution =
      cautious && v.movement < 2
        ? Math.min(1, (cargo.costs.length - b.crew.length) * 0.35)
        : 0;
    total +=
      p *
      ((b.crew.filter((x) => x === seat).length /
        (b.crew.length + dilution || 1)) *
        cargo.payout +
        ownShares(v, b.cargo) * priceStep(v, b.cargo));
    if (ps.length)
      total +=
        (exact(b.position, 3 - v.movement, 13) * cargo.payout * mine) /
        ps.length;
  }
  const probabilities = v.boats.map((b) => success(v, b));
  for (const space of v.spaces)
    if (space.occupant === seat) {
      if (space.kind === 'port')
        total += space.payout! * countsAtLeast(probabilities, space.index + 1);
      if (space.kind === 'shipyard')
        total +=
          space.payout! *
          countsAtLeast(
            probabilities.map((p) => 1 - p),
            space.index + 1,
          );
      if (space.kind === 'insurance')
        for (let i = 0; i < 3; i++)
          if (v.spaces.find((x) => x.id === `shipyard-${i}`)?.occupant !== seat)
            total -=
              [6, 8, 15][i]! *
              countsAtLeast(
                probabilities.map((p) => 1 - p),
                i + 1,
              );
    }
  return total;
}
export function placementScore(
  v: ManilaView,
  action: Extract<Action, { type: 'place' }>,
  depth: number,
): number {
  const space = v.spaces.find((x) => x.id === action.space)!,
    seat = v.self!.seatId;
  const probabilities = v.boats.map((b) => success(v, b));
  let score = -space.cost;
  if (space.kind === 'cargo') {
    const boat = v.boats.find((x) => x.cargo === space.cargo)!,
      mine = boat.crew.filter((x) => x === seat).length;
    const extra =
      depth >= 2 && v.movement < 2
        ? Math.min(
            1,
            (v.cargos.find((c) => c.id === boat.cargo)!.costs.length -
              boat.crew.length -
              1) *
              0.4,
          )
        : 0;
    const before = mine / (boat.crew.length + extra || 1),
      after = (mine + 1) / (boat.crew.length + 1 + extra);
    score += success(v, boat) * space.payout! * (after - before);
  } else if (space.kind === 'port')
    score += space.payout! * countsAtLeast(probabilities, space.index + 1);
  else if (space.kind === 'shipyard')
    score +=
      space.payout! *
      countsAtLeast(
        probabilities.map((x) => 1 - x),
        space.index + 1,
      );
  else if (space.kind === 'insurance') {
    score = 10;
    for (let i = 0; i < 3; i++)
      if (v.spaces.find((x) => x.id === `shipyard-${i}`)?.occupant !== seat)
        score -=
          [6, 8, 15][i]! *
          countsAtLeast(
            probabilities.map((x) => 1 - x),
            i + 1,
          );
    if (depth >= 2) score -= Math.max(0, 10 - v.self!.cash) * 0.12;
  } else if (space.kind === 'pirate') {
    const ps = pirates(v);
    score += v.boats.reduce(
      (sum, b) =>
        sum +
        (exact(b.position, 3 - v.movement, 13) *
          v.cargos.find((x) => x.id === b.cargo)!.payout) /
          (ps.length + 1),
      0,
    );
    if (v.movement < 2)
      score +=
        v.boats.reduce(
          (sum, b) =>
            sum +
            (exact(b.position, 2 - v.movement, 13) *
              chance(13, 1, 14) *
              v.cargos.find((x) => x.id === b.cargo)!.payout) /
              (b.crew.length + 1),
          0,
        ) * 0.6;
  } else if (space.kind === 'pilot') {
    const modified = structuredClone(v);
    modified.phase = space.id === 'pilot-small' ? 'pilot-small' : 'pilot-large';
    const options: Action[] = [{ type: 'pilot', moves: [] }];
    const limit = space.index ? 2 : 1;
    for (const b of v.boats)
      if (b.destination === 'sea')
        for (const delta of [-limit, limit])
          if (b.position + delta >= 0)
            options.push({ type: 'pilot', moves: [{ cargo: b.cargo, delta }] });
    score +=
      Math.max(...options.map((a) => influenceScore(v, a, depth >= 2))) * 0.65;
  }
  if (v.self!.cash < space.cost) score -= depth >= 2 ? 3 : 1;
  return score;
}
export function influenceScore(
  v: ManilaView,
  action: Action,
  cautious: boolean,
): number {
  const next = structuredClone(v);
  if (action.type === 'pilot')
    for (const move of action.moves) {
      const b = next.boats.find((x) => x.cargo === move.cargo)!;
      b.position += move.delta;
      if (b.position > 13) {
        b.position = 14;
        b.destination = 'port';
      }
    }
  else if (action.type === 'board' && action.cargo) {
    const b = next.boats.find((x) => x.cargo === action.cargo)!;
    b.crew.push(next.self!.seatId);
    const pirate = next.spaces.find(
      (x) => x.kind === 'pirate' && x.occupant === next.self!.seatId,
    );
    if (pirate) pirate.occupant = null;
  } else if (action.type === 'plunder') {
    const b = next.boats.find((x) => x.cargo === action.cargo)!;
    b.destination = action.destination;
    b.plundered = true;
    b.crew = [];
  }
  return projectedWealth(next, cautious) - projectedWealth(v, cautious);
}
export function setupScore(
  v: ManilaView,
  a: Extract<Action, { type: 'setup' }>,
  horizon: number,
): number {
  let score = 0;
  for (let i = 0; i < 3; i++) {
    const cargo = a.cargos[i]!,
      position = a.positions[i]!;
    score +=
      chance(position, 3, 13) *
      (ownShares(v, cargo) * priceStep(v, cargo) * horizon +
        v.cargos.find((c) => c.id === cargo)!.payout * 0.06);
  }
  return score;
}
