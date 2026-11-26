import type { BotDifficulty, BotStrength } from '@tablemax/game-sdk';
import { prepareTurn, TurnProofCache } from '../shared/turn';
import { getTile } from '../data/catalog';
import type { Meld, PlayAction, RummikubView, Tile } from '../types';
import { SearchBudget, type SearchStats } from './budget';
import { refineThreatenedTable, type TablePressure } from './mischief';
import {
  buildCandidates,
  type Candidate,
  type CandidatePool,
} from './candidates';

export type TurnPlan = {
  action: PlayAction | null;
  stats: SearchStats;
  pressure?: TablePressure;
};

function remainingPotential(
  rack: readonly Tile[],
  used: ReadonlySet<string>,
): number {
  const remaining = rack.filter((tile) => !used.has(tile.id));
  let potential = 0;
  for (const tile of remaining) {
    if (tile.joker) {
      potential += 8;
      continue;
    }
    const group = new Set(
      remaining
        .filter((other) => other.value === tile.value && !other.joker)
        .map((other) => other.color),
    ).size;
    const neighbours = remaining.filter(
      (other) =>
        other.color === tile.color &&
        other.value !== null &&
        Math.abs(other.value - tile.value!) <= 2 &&
        other.value !== tile.value,
    ).length;
    potential += Math.min(4, group - 1 + neighbours);
  }
  return potential;
}

function actionScore(
  rack: readonly Tile[],
  mask: bigint,
  level: number,
): number {
  const played = new Set(
    rack.filter((_, i) => mask & (1n << BigInt(i))).map((tile) => tile.id),
  );
  if (played.size === rack.length) return 1_000_000_000;
  const points = [...played].reduce(
    (sum, id) => sum + (getTile(id).value ?? 30),
    0,
  );
  return (
    played.size * 10000 +
    points * 10 +
    (level > 0 ? remainingPotential(rack, played) : 0)
  );
}

/** Complete-turn search uses only the supplied public table and private rack. */
function searchTurn(
  view: RummikubView,
  difficulty: BotStrength,
  signal?: AbortSignal,
): TurnPlan {
  const budget = new SearchBudget(difficulty, signal);
  budget.check();
  if (
    !view.self ||
    view.phase !== 'playing' ||
    view.turnSeat !== view.self.seatId
  )
    throw new Error('拉密策略没有本人回合。');
  const self = view.self;
  const level = ['default', 'doubao', 'juewu'].indexOf(difficulty);
  if (level < 0) throw new Error('拉密策略等级无效。');
  const context = {
    rack: self.rack.map((tile) => tile.id),
    table: view.table,
    opened: self.opened,
  };
  let best: PlayAction | null = null;
  let bestScore = -Infinity;
  const sortedRack = [...self.rack].sort((a, b) => a.id.localeCompare(b.id));
  const allRackMask = (1n << BigInt(sortedRack.length)) - 1n;
  const rackBits = new Map(
    sortedRack.map((tile, i) => [tile.id, 1n << BigInt(i)]),
  );
  const scoreCache = new Map<bigint, number>();
  const proofCache = new TurnProofCache();
  const consider = (table: Meld[], used: bigint) => {
    budget.check();
    const mask = used & allRackMask;
    let score = scoreCache.get(mask);
    if (score === undefined) {
      score = actionScore(sortedRack, mask, level);
      scoreCache.set(mask, score);
    }
    // Candidate ordering is already stable. Equal-score repartitions have no
    // strategic benefit, so preserve the first legal one without stringifying.
    if (score <= bestScore) return;
    const action = prepareTurn(context, table, {
      maxNodes: 160,
      proofCache,
      ...(signal ? { signal } : {}),
    });
    budget.check();
    if (!action) return;
    best = action;
    bestScore = score;
  };
  const original = view.table.map((meld) => ({
    kind: meld.kind,
    tiles: meld.tiles.map((tile) => ({ ...tile })),
  }));
  const rackPool = buildCandidates(self.rack, [], budget);
  const greedy: Candidate[] = [];
  let greedyMask = 0n;
  for (const candidate of rackPool.candidates) {
    if (candidate.mask & greedyMask) continue;
    greedy.push(candidate);
    greedyMask |= candidate.mask;
  }
  if (greedy.length)
    consider(
      [...original, ...greedy.map((candidate) => candidate.meld)],
      greedyMask,
    );

  // Add to existing runs/groups without moving their tiles or releasing a joker.
  if (self.opened) {
    const available = self.rack.filter(
      (tile) =>
        !(
          greedyMask &
          (1n <<
            BigInt(rackPool.tiles.findIndex((entry) => entry.id === tile.id)))
        ),
    );
    const augmented = original.map((meld) => ({
      kind: meld.kind,
      tiles: [...meld.tiles],
    }));
    const used = new Set<string>();
    let previousUsed = -1;
    while (previousUsed !== used.size) {
      previousUsed = used.size;
      for (const tile of available) {
        if (tile.joker || used.has(tile.id)) continue;
        for (const meld of augmented) {
          if (
            meld.kind === 'group' &&
            meld.tiles.length < 4 &&
            meld.tiles[0]!.value === tile.value &&
            !meld.tiles.some((placement) => placement.color === tile.color)
          ) {
            meld.tiles.push({
              tileId: tile.id,
              color: tile.color!,
              value: tile.value!,
            });
            used.add(tile.id);
            break;
          }
          if (meld.kind === 'run' && meld.tiles[0]!.color === tile.color) {
            const first = Math.min(
              ...meld.tiles.map((placement) => placement.value),
            );
            const last = Math.max(
              ...meld.tiles.map((placement) => placement.value),
            );
            if (tile.value === first - 1 || tile.value === last + 1) {
              meld.tiles.push({
                tileId: tile.id,
                color: tile.color!,
                value: tile.value!,
              });
              meld.tiles.sort((a, b) => a.value - b.value);
              used.add(tile.id);
              break;
            }
          }
        }
      }
    }
    if (used.size)
      consider(
        [...augmented, ...greedy.map((candidate) => candidate.meld)],
        [...used].reduce((mask, id) => mask | rackBits.get(id)!, greedyMask),
      );
  }

  const packRack = (
    pool: CandidatePool,
    unavailable: bigint,
    base: Meld[],
    nodeStop: number = budget.limits.nodes,
  ) => {
    const selected: Candidate[] = [];
    const seen = new Set<string>();
    const visit = (used: bigint, skipped: bigint, points: number) => {
      if (budget.stats.nodes >= nodeStop) {
        budget.stats.truncated = true;
        return;
      }
      if (!budget.visit()) return;
      // Before opening, joker assignments can alter the thirty-point threshold.
      // Afterwards the chosen rack instances fully determine the evaluation.
      const memo = `${used}:${skipped}:${self.opened ? 0 : Math.min(30, points)}`;
      if (seen.has(memo)) return;
      seen.add(memo);
      const remaining = pool.rackMask & ~(used | skipped);
      if (!remaining) {
        consider(
          [...base, ...selected.map((candidate) => candidate.meld)],
          used,
        );
        return;
      }
      let pivot = -1;
      let options: Candidate[] = [];
      for (let i = 0; i < self.rack.length; i++) {
        if (!(remaining & pool.bits[i]!)) continue;
        const choices = pool.rackByTile[i]!.filter(
          (candidate) => !(candidate.mask & (used | skipped)),
        );
        if (pivot < 0 || choices.length < options.length) {
          pivot = i;
          options = choices;
          if (!options.length) break;
        }
      }
      for (const candidate of options) {
        selected.push(candidate);
        visit(
          used | candidate.mask,
          skipped,
          points +
            (self.opened
              ? 0
              : candidate.meld.tiles.reduce(
                  (sum, tile) => sum + tile.value,
                  0,
                )),
        );
        selected.pop();
        if (bestScore >= 1_000_000_000 || budget.stats.nodes >= nodeStop)
          return;
      }
      visit(used, skipped | pool.bits[pivot]!, points);
    };
    visit(unavailable, 0n, 0);
  };
  if (level > 0 && bestScore < 1_000_000_000)
    packRack(rackPool, 0n, original, level === 1 ? 3000 : 5000);
  if (!self.opened || level === 0 || bestScore >= 1_000_000_000)
    return { action: best, stats: budget.stats };

  // Juewu's local and whole-table searches share the same candidate pool.
  const searchTable = (
    moving: readonly Meld[],
    stationary: Meld[],
    pool: CandidatePool,
    alreadyPlaced = 0n,
    nodeStop: number = budget.limits.nodes,
  ) => {
    if (budget.stats.nodes >= nodeStop || !budget.visit()) return;
    const selected: Candidate[] = [];
    const requiredOrder = pool.tiles
      .map((_, i) => i)
      .filter((i) => i >= self.rack.length && !(alreadyPlaced & pool.bits[i]!))
      .sort((a, b) => pool.byTile[a]!.length - pool.byTile[b]!.length);
    const covered = new Set<bigint>();
    const hasTableJoker = moving.some((meld) =>
      meld.tiles.some((placement) => getTile(placement.tileId).joker),
    );
    const visit = (used: bigint) => {
      if (budget.stats.nodes >= nodeStop || !budget.visit()) return;
      if (!hasTableJoker) {
        if (covered.has(used)) return;
        covered.add(used);
      }
      const remaining = pool.requiredMask & ~used;
      if (!remaining) {
        const base = [
          ...stationary,
          ...selected.map((candidate) => candidate.meld),
        ];
        consider(base, used);
        packRack(pool, used, base, nodeStop);
        return;
      }
      const pivot = requiredOrder.find((i) => remaining & pool.bits[i]!)!;
      for (const candidate of pool.byTile[pivot]!) {
        if (candidate.mask & used) continue;
        selected.push(candidate);
        visit(used | candidate.mask);
        selected.pop();
        if (bestScore >= 1_000_000_000 || budget.stats.nodes >= nodeStop)
          return;
      }
    };
    visit(alreadyPlaced);
  };
  if (level === 1) {
    for (const [index, meld] of view.table.entries()) {
      if (
        budget.stats.nodes >= budget.limits.nodes ||
        bestScore >= 1_000_000_000
      )
        break;
      const moving = [meld];
      searchTable(
        moving,
        original.filter((_, i) => i !== index),
        buildCandidates(self.rack, moving, budget),
      );
    }
  } else {
    const pool = buildCandidates(self.rack, view.table, budget);
    const byId = new Map(pool.tiles.map((tile, i) => [tile.id, pool.bits[i]!]));
    const perSet = Math.floor(8000 / Math.max(1, view.table.length));
    for (const [index, meld] of view.table.entries()) {
      if (bestScore >= 1_000_000_000) break;
      const localMask = meld.tiles.reduce(
        (mask, tile) => mask | byId.get(tile.tileId)!,
        0n,
      );
      searchTable(
        [meld],
        original.filter((_, i) => i !== index),
        pool,
        pool.requiredMask & ~localMask,
        budget.stats.nodes + perSet,
      );
    }
    if (bestScore < 1_000_000_000) searchTable(view.table, [], pool);
  }
  return { action: best, stats: budget.stats };
}

function finishWinningRound(
  view: RummikubView,
  action: PlayAction,
): PlayAction {
  const self = view.self;
  if (!self?.opened || view.gameNumber !== view.gameCount) return action;
  const own = view.players[self.seatId]!;
  const opponents = view.seatOrder
    .filter((seat) => seat !== self.seatId)
    .map((seat) => view.players[seat]!);
  const wins = own.wins + 1;
  // Each opponent tile is worth at least one point when this rack empties.
  const minimumScore =
    own.score + opponents.reduce((sum, player) => sum + player.rackCount, 0);
  const winsMatch = opponents.every(
    (player) =>
      wins > player.wins ||
      (wins === player.wins && minimumScore > player.score - player.rackCount),
  );
  if (!winsMatch) return action;

  const placed = new Set(
    action.table.flatMap(({ tiles }) => tiles.map(({ tileId }) => tileId)),
  );
  const remaining = self.rack.filter(({ id }) => !placed.has(id));
  const tile = remaining[0];
  if (
    remaining.length !== 1 ||
    !tile ||
    tile.joker ||
    !tile.color ||
    tile.value === null
  )
    return action;

  const { id: tileId, color, value } = tile;
  const target = action.table.findIndex((meld) => {
    if (meld.tiles.some((entry) => getTile(entry.tileId).joker)) return false;
    const first = meld.tiles[0]!;
    if (meld.kind === 'group')
      return (
        meld.tiles.length < 4 &&
        first.value === value &&
        meld.tiles.every((entry) => entry.color !== color)
      );
    const last = meld.tiles.at(-1)!;
    return (
      first.color === color &&
      (value === first.value - 1 || value === last.value + 1)
    );
  });
  if (target < 0) return action;

  return {
    ...action,
    table: action.table.map((meld, index) =>
      index === target
        ? {
            ...meld,
            tiles: [...meld.tiles, { tileId, color, value }].sort(
              (a, b) => a.value - b.value || a.color.localeCompare(b.color),
            ),
          }
        : meld,
    ),
  };
}

export function planTurn(
  view: RummikubView,
  difficulty: BotDifficulty,
  signal?: AbortSignal,
): TurnPlan {
  const baseline = searchTurn(
    view,
    difficulty === 'mischief' ? 'juewu' : difficulty,
    signal,
  );
  if (difficulty === 'juewu' && baseline.action)
    return { ...baseline, action: finishWinningRound(view, baseline.action) };
  if (difficulty !== 'mischief' || !baseline.action) return baseline;
  return {
    ...baseline,
    ...refineThreatenedTable(view, baseline.action, signal),
  };
}
