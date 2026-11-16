import { persists, tile } from './data';
import type { Breakdown, Player, State } from './state';

export const total = (p: Player) => p.scores.at(-1)?.total ?? 10;
const count = (p: Player, kind: string) =>
  p.held.filter((id) => tile(id).kind === kind).length;
const disks = (p: Player) => [...p.up, ...p.down];
const highest = (p: Player) => Math.max(...disks(p));
const diskSum = (p: Player) => disks(p).reduce((sum, n) => sum + n, 0);

export function highestSeat(state: State): string {
  return state.seats.reduce((a, b) =>
    highest(state.players[a]!) > highest(state.players[b]!) ? a : b,
  );
}

function rank(value: number, values: number[], award: number, penalty: number) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  return max === min ? 0 : value === max ? award : value === min ? penalty : 0;
}

export function breakdown(
  player: Player,
  all: Player[],
  epoch: number,
): Breakdown {
  const civilizations = new Set(
    player.held
      .filter((id) => tile(id).kind === 'civilization')
      .map((id) => tile(id).face),
  ).size;
  const monuments: Record<string, number> = {};
  for (const id of player.held) {
    const { kind, face } = tile(id);
    if (kind === 'monument') monuments[face] = (monuments[face] ?? 0) + 1;
  }
  const diversity = Object.keys(monuments).length;
  const flood = count(player, 'flood');
  return {
    pharaoh: rank(
      count(player, 'pharaoh'),
      all.map((p) => count(p, 'pharaoh')),
      5,
      -2,
    ),
    god: 2 * count(player, 'god'),
    gold: 3 * count(player, 'gold'),
    river: flood + (flood > 0 ? count(player, 'nile') : 0),
    civilization: [-5, 0, 0, 5, 10, 15][civilizations]!,
    monument:
      epoch === 3
        ? (diversity === 8 ? 15 : diversity === 7 ? 10 : diversity) +
          Object.values(monuments).reduce(
            (sum, n) => sum + Math.max(0, n - 2) * 5,
            0,
          )
        : 0,
    disks: epoch === 3 ? rank(diskSum(player), all.map(diskSum), 5, -5) : 0,
  };
}

export function settle(state: State) {
  const all = state.seats.map((id) => state.players[id]!);
  for (const p of all) {
    const parts = breakdown(p, all, state.epoch);
    const before = total(p);
    const after = Math.max(
      0,
      before + Object.values(parts).reduce((sum, n) => sum + n, 0),
    );
    p.scores.push({
      epoch: state.epoch,
      parts,
      total: after,
      delta: after - before,
    });
  }
  if (state.epoch === 3) {
    state.phase = 'ended';
    state.actor = null;
    state.winner = [...state.seats].sort((a, b) => {
      const left = state.players[a]!;
      const right = state.players[b]!;
      return total(right) - total(left) || highest(right) - highest(left);
    })[0]!;
    return;
  }
  for (const id of state.lot) if (id !== null) state.removed.push(id);
  state.lot.fill(null);
  for (const p of all) {
    state.removed.push(...p.held.filter((id) => !persists(id)));
    p.held = p.held.filter(persists);
    p.up = disks(p).sort((a, b) => a - b);
    p.down = [];
  }
  state.epoch++;
  state.raDrawn = 0;
  state.actor = highestSeat(state);
  state.phase = 'turn';
}
