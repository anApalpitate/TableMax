import { getTile, TILE_IDS } from '../data/catalog';
import { prepareTurn, TurnProofCache } from '../shared/turn';
import {
  COLORS,
  type Color,
  type Meld,
  type PlayAction,
  type Placement,
  type RummikubView,
  type Tile,
} from '../types';

export const TABLE_PRESSURE_LIMITS = {
  pairs: 256,
  alternatives: 128,
  proofs: 6,
} as const;
export type TablePressure = {
  pairs: number;
  alternatives: number;
  proofs: number;
  before: number;
  after: number;
};

const face = (color: Color, value: number) => `${color}/${value}`;
const rank = (tiles: readonly Placement[]) =>
  [...tiles].sort((a, b) => a.value - b.value);

function unknownFaces(view: RummikubView) {
  const visible = new Set([
    ...view.self!.rack.map(({ id }) => id),
    ...view.table.flatMap((meld) => meld.tiles.map(({ tileId }) => tileId)),
  ]);
  const faces = new Map<string, number>();
  for (const id of TILE_IDS) {
    if (visible.has(id)) continue;
    const tile = getTile(id);
    const key = tile.joker ? 'joker' : face(tile.color!, tile.value!);
    faces.set(key, 1 + (faces.get(key) ?? 0));
  }
  return faces;
}

function endpoints(meld: Meld) {
  return {
    low: Math.min(...meld.tiles.map(({ value }) => value)),
    high: Math.max(...meld.tiles.map(({ value }) => value)),
  };
}

function openFaces(table: readonly Meld[]) {
  const open = new Set<string>();
  for (const meld of table) {
    if (meld.kind === 'group') {
      if (meld.tiles.length < COLORS.length)
        for (const color of COLORS) {
          if (!meld.tiles.some((tile) => tile.color === color))
            open.add(face(color, meld.tiles[0]!.value));
        }
    } else {
      const { low, high } = endpoints(meld);
      const color = meld.tiles[0]!.color;
      if (low > 1) open.add(face(color, low - 1));
      if (high < 13) open.add(face(color, high + 1));
    }
  }
  if (open.size) open.add('joker');
  return open;
}

function risk(table: readonly Meld[], unknown: ReadonlyMap<string, number>) {
  return [...openFaces(table)].reduce(
    (sum, key) => sum + (unknown.get(key) ?? 0),
    0,
  );
}

function mergeRuns(left: Meld, right: Meld): Meld[] | undefined {
  if (
    left.kind !== 'run' ||
    right.kind !== 'run' ||
    left.tiles[0]!.color !== right.tiles[0]!.color
  )
    return undefined;
  const a = endpoints(left),
    b = endpoints(right);
  if (a.high + 1 !== b.low && b.high + 1 !== a.low) return undefined;
  return [{ kind: 'run', tiles: rank([...left.tiles, ...right.tiles]) }];
}

function accepts(meld: Meld, tile: Placement) {
  if (meld.kind === 'group') {
    return (
      meld.tiles.length < COLORS.length &&
      tile.value === meld.tiles[0]!.value &&
      !meld.tiles.some(({ color }) => color === tile.color)
    );
  }
  if (tile.color !== meld.tiles[0]!.color) return false;
  const { low, high } = endpoints(meld);
  return tile.value === low - 1 || tile.value === high + 1;
}

function* moveOne(source: Meld, destination: Meld): Generator<[Meld, Meld]> {
  if (source.tiles.length <= 3) return;
  const edges = source.kind === 'run' ? endpoints(source) : undefined;
  for (const tile of source.tiles) {
    if (
      (edges && tile.value !== edges.low && tile.value !== edges.high) ||
      getTile(tile.tileId).joker ||
      !accepts(destination, tile)
    )
      continue;
    const received = [...destination.tiles, tile];
    yield [
      { ...source, tiles: source.tiles.filter((entry) => entry !== tile) },
      {
        ...destination,
        tiles: destination.kind === 'run' ? rank(received) : received,
      },
    ];
  }
}

/** Reorder the proved turn only. The physical set left by Juewu never changes. */
export function refineThreatenedTable(
  view: RummikubView,
  action: PlayAction,
  signal?: AbortSignal,
): { action: PlayAction; pressure?: TablePressure } {
  const self = view.self!;
  const ownSeat = view.seatOrder.indexOf(self.seatId);
  const following =
    view.players[view.seatOrder[(ownSeat + 1) % view.seatOrder.length]!]!;
  const size = (table: readonly Meld[]) =>
    table.reduce((sum, meld) => sum + meld.tiles.length, 0);
  if (
    !self.opened ||
    !following.opened ||
    following.rackCount !== 1 ||
    size(action.table) - size(view.table) === self.rack.length
  )
    return { action };

  const unknown = unknownFaces(view);
  const before = risk(action.table, unknown);
  const pressure: TablePressure = {
    pairs: 0,
    alternatives: 0,
    proofs: 0,
    before,
    after: before,
  };
  let best = action;
  const context = {
    rack: self.rack.map(({ id }: Tile) => id),
    table: view.table,
    opened: self.opened,
  };
  const proofCache = new TurnProofCache();
  const table = action.table;
  const canCheck = () =>
    pressure.after > 0 &&
    pressure.pairs < TABLE_PRESSURE_LIMITS.pairs &&
    pressure.alternatives < TABLE_PRESSURE_LIMITS.alternatives &&
    pressure.proofs < TABLE_PRESSURE_LIMITS.proofs;
  const consider = (remaining: readonly Meld[], newMelds: readonly Meld[]) => {
    if (signal?.aborted) throw new Error('拉密策略已取消。');
    if (
      pressure.alternatives >= TABLE_PRESSURE_LIMITS.alternatives ||
      pressure.proofs >= TABLE_PRESSURE_LIMITS.proofs ||
      pressure.after === 0
    )
      return;
    pressure.alternatives++;
    const next = [...remaining, ...newMelds];
    const exposed = risk(next, unknown);
    if (exposed >= pressure.after) return;
    pressure.proofs++;
    const proven = prepareTurn(context, next, {
      maxNodes: 160,
      proofCache,
      ...(signal ? { signal } : {}),
    });
    if (signal?.aborted) throw new Error('拉密策略已取消。');
    if (!proven) return;
    best = proven;
    pressure.after = exposed;
  };
  for (let a = 0; a < table.length && canCheck(); a++)
    for (let b = a + 1; b < table.length && canCheck(); b++) {
      if (signal?.aborted) throw new Error('拉密策略已取消。');
      pressure.pairs++;
      const left = table[a]!,
        right = table[b]!;
      const remaining = table.filter((_, i) => i !== a && i !== b);
      const merged = mergeRuns(left, right);
      if (merged) consider(remaining, merged);
      for (const change of moveOne(left, right)) consider(remaining, change);
      for (const change of moveOne(right, left)) consider(remaining, change);
    }
  return { action: best, pressure };
}
