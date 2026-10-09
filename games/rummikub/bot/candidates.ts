import { getTile } from '../data/catalog';
import {
  COLORS,
  type Color,
  type Meld,
  type Placement,
  type Tile,
} from '../types';
import type { SearchBudget } from './budget';

export type Candidate = {
  key: string;
  meld: Meld;
  mask: bigint;
  rackMask: bigint;
  rackCount: number;
  rackPoints: number;
};
export type CandidatePool = {
  tiles: Tile[];
  rackMask: bigint;
  requiredMask: bigint;
  candidates: Candidate[];
  byTile: Candidate[][];
  rackByTile: Candidate[][];
  bits: bigint[];
};

export function meldKey(meld: Meld): string {
  return `${meld.kind}:${meld.tiles
    .map((tile) => `${tile.tileId}/${tile.color}/${tile.value}`)
    .sort()
    .join(',')}`;
}

/** Enumerate legal face patterns directly, with bounded physical-copy variants. */
export function buildCandidates(
  rack: readonly Tile[],
  table: readonly Meld[],
  budget: SearchBudget,
): CandidatePool {
  const tiles = [
    ...[...rack].sort((a, b) => a.id.localeCompare(b.id)),
    ...table
      .flatMap((meld) => meld.tiles.map((tile) => getTile(tile.tileId)))
      .sort((a, b) => a.id.localeCompare(b.id)),
  ];
  const index = new Map(tiles.map((tile, i) => [tile.id, i]));
  const bits = tiles.map((_, i) => 1n << BigInt(i));
  const rackMask = (1n << BigInt(rack.length)) - 1n;
  const requiredMask = ((1n << BigInt(tiles.length)) - 1n) ^ rackMask;
  const candidates: Candidate[] = [];
  const byTile: Candidate[][] = tiles.map(() => []);
  const seen = new Set<string>();
  const natural = new Map<string, Tile[]>();
  const jokers = tiles.filter((tile) => tile.joker);
  for (const tile of tiles) {
    if (tile.joker) continue;
    const key = `${tile.color}/${tile.value}`;
    const list = natural.get(key) ?? [];
    list.push(tile);
    natural.set(key, list);
  }
  const add = (meld: Meld) => {
    const key = meldKey(meld);
    if (seen.has(key)) return;
    if (candidates.length >= budget.limits.candidates) {
      budget.stats.truncated = true;
      return;
    }
    let mask = 0n;
    let rackCount = 0;
    let rackPoints = 0;
    for (const placement of meld.tiles) {
      const i = index.get(placement.tileId);
      if (i === undefined) return;
      mask |= bits[i]!;
      if (i < rack.length) {
        rackCount++;
        rackPoints += tiles[i]!.value ?? 30;
      }
    }
    const candidate = {
      key,
      meld,
      mask,
      rackMask: mask & rackMask,
      rackCount,
      rackPoints,
    };
    seen.add(key);
    candidates.push(candidate);
    for (const placement of meld.tiles)
      byTile[index.get(placement.tileId)!]!.push(candidate);
  };
  // Always keep the actual table as a feasible exact-cover foundation.
  for (const meld of table)
    add({ kind: meld.kind, tiles: meld.tiles.map((tile) => ({ ...tile })) });
  const pattern = (
    kind: Meld['kind'],
    slots: { color: Color; value: number }[],
  ) => {
    if (candidates.length >= budget.limits.candidates) return;
    if (
      slots.filter((slot) => !natural.has(`${slot.color}/${slot.value}`))
        .length > jokers.length
    )
      return;
    let variants = 0;
    const chosen: Placement[] = [];
    const limit = table.length ? 40 : 256;
    const fill = (position: number, usedJokers: number) => {
      if (
        variants >= limit ||
        candidates.length >= budget.limits.candidates ||
        !budget.generate()
      )
        return;
      if (position === slots.length) {
        variants++;
        add({ kind, tiles: chosen.map((placement) => ({ ...placement })) });
        return;
      }
      const slot = slots[position]!;
      for (const tile of natural.get(`${slot.color}/${slot.value}`) ?? []) {
        chosen.push({ tileId: tile.id, ...slot });
        fill(position + 1, usedJokers);
        chosen.pop();
      }
      for (let j = 0; j < jokers.length; j++) {
        if (usedJokers & (1 << j)) continue;
        chosen.push({ tileId: jokers[j]!.id, ...slot });
        fill(position + 1, usedJokers | (1 << j));
        chosen.pop();
      }
    };
    fill(0, 0);
    if (variants >= limit) budget.stats.truncated = true;
  };
  // Three- to five-tile patterns make table splitting available before long runs.
  for (const size of [3, 4])
    for (let value = 1; value <= 13; value++)
      for (let colors = 1; colors < 16; colors++) {
        const selected = COLORS.filter((_, i) => colors & (1 << i));
        if (selected.length === size)
          pattern(
            'group',
            selected.map((color) => ({ color, value })),
          );
      }
  for (let length = 3; length <= 13; length++)
    for (const color of COLORS)
      for (let start = 1; start + length - 1 <= 13; start++)
        pattern(
          'run',
          Array.from({ length }, (_, i) => ({ color, value: start + i })),
        );
  candidates.sort(
    (a, b) =>
      b.rackCount - a.rackCount ||
      b.rackPoints - a.rackPoints ||
      a.key.localeCompare(b.key),
  );
  for (const list of byTile)
    list.sort(
      (a, b) =>
        b.rackCount - a.rackCount ||
        b.rackPoints - a.rackPoints ||
        a.key.localeCompare(b.key),
    );
  budget.stats.candidates = Math.max(
    budget.stats.candidates,
    candidates.length,
  );
  const rackByTile = byTile
    .slice(0, rack.length)
    .map((list) =>
      list.filter((candidate) => !(candidate.mask & requiredMask)),
    );
  return {
    tiles,
    rackMask,
    requiredMask,
    candidates,
    byTile,
    rackByTile,
    bits,
  };
}
