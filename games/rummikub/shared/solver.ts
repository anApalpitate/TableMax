import { getTile } from '../data/catalog';
import { COLORS, type Meld, type Placement } from '../types';

type Pattern = {
  kind: Meld['kind'];
  natural: number[];
  joker: number[];
  points: number;
};
export type SearchOptions = {
  minOptional?: number;
  minPoints?: number;
  maxNodes?: number;
  signal?: AbortSignal;
  accept?: (melds: Meld[]) => boolean;
};
export type SearchResult = {
  melds: Meld[] | null;
  complete: boolean;
  nodes: number;
};
const indexOf = (id: string) => {
  const tile = getTile(id);
  return tile.joker ? 52 : COLORS.indexOf(tile.color!) * 13 + tile.value! - 1;
};
const face = (index: number) => ({
  color: COLORS[Math.floor(index / 13)]!,
  value: (index % 13) + 1,
});

/** Count-based exact cover avoids permutations of the two identical copies. */
export function searchSets(
  requiredIds: readonly string[],
  availableIds: readonly string[],
  options: SearchOptions = {},
): SearchResult {
  if (
    new Set(availableIds).size !== availableIds.length ||
    new Set(requiredIds).size !== requiredIds.length ||
    requiredIds.some((id) => !availableIds.includes(id))
  )
    throw new Error('组合搜索牌实例无效。');
  const available = Array<number>(53).fill(0);
  const required = Array<number>(53).fill(0);
  for (const id of availableIds) available[indexOf(id)]!++;
  for (const id of requiredIds) required[indexOf(id)]!++;
  const jokerLimit = available[52]!;
  const patterns: Pattern[] = [];
  const addPattern = (kind: Meld['kind'], faces: number[]) => {
    const natural: number[] = [],
      joker: number[] = [];
    function choose(i: number) {
      if (i === faces.length) {
        patterns.push({
          kind,
          natural: [...natural],
          joker: [...joker],
          points: faces.reduce((sum, f) => sum + (f % 13) + 1, 0),
        });
        return;
      }
      const f = faces[i]!;
      if (available[f]! > 0) {
        natural.push(f);
        choose(i + 1);
        natural.pop();
      }
      if (joker.length < jokerLimit) {
        joker.push(f);
        choose(i + 1);
        joker.pop();
      }
    }
    choose(0);
  };
  for (let value = 0; value < 13; value++) {
    for (let mask = 1; mask < 16; mask++) {
      const colors = [0, 1, 2, 3].filter((c) => mask & (1 << c));
      if (colors.length >= 3)
        addPattern(
          'group',
          colors.map((c) => c * 13 + value),
        );
    }
  }
  for (let color = 0; color < 4; color++)
    for (let start = 0; start < 11; start++)
      for (let end = start + 2; end < 13; end++) {
        const faces = Array.from(
          { length: end - start + 1 },
          (_, i) => color * 13 + start + i,
        );
        if (faces.filter((f) => available[f] === 0).length <= jokerLimit)
          addPattern('run', faces);
      }
  patterns.sort(
    (a, b) =>
      b.natural.length + b.joker.length - (a.natural.length + a.joker.length) ||
      b.points - a.points,
  );
  const byFace: Pattern[][] = Array.from({ length: 53 }, () => []);
  for (const p of patterns) {
    for (const f of p.natural) byFace[f]!.push(p);
    if (p.joker.length) byFace[52]!.push(p);
  }
  const fits = (p: Pattern) =>
    available[52]! >= p.joker.length &&
    p.natural.every((f) => available[f]! > 0);
  const selected: Pattern[] = [];
  const requiredSet = new Set(requiredIds);
  const memo = new Set<string>();
  let nodes = 0,
    interrupted = false;
  let answer: Meld[] | null = null;
  const materialize = (): Meld[] => {
    const queues: string[][] = Array.from({ length: 53 }, () => []);
    for (const id of [
      ...requiredIds,
      ...availableIds.filter((id) => !requiredSet.has(id)),
    ])
      queues[indexOf(id)]!.push(id);
    return selected.map((p) => {
      const tiles: Placement[] = p.natural.map((f) => ({
        tileId: queues[f]!.shift()!,
        ...face(f),
      }));
      for (const f of p.joker)
        tiles.push({ tileId: queues[52]!.shift()!, ...face(f) });
      return { kind: p.kind, tiles };
    });
  };
  const accept = () => {
    const candidate = materialize();
    if (!options.accept || options.accept(candidate)) {
      answer = candidate;
      return true;
    }
    const jokerIds = candidate
      .flatMap((m) => m.tiles)
      .filter((p) => getTile(p.tileId).joker)
      .map((p) => p.tileId);
    if (jokerIds.length === 2) {
      const swapped = candidate.map((m) => ({
        ...m,
        tiles: m.tiles.map((p) => ({
          ...p,
          tileId:
            p.tileId === jokerIds[0]
              ? jokerIds[1]!
              : p.tileId === jokerIds[1]
                ? jokerIds[0]!
                : p.tileId,
        })),
      }));
      if (options.accept(swapped)) {
        answer = swapped;
        return true;
      }
    }
    return false;
  };
  function visit(optional: number, points: number, optionalStart = 0): boolean {
    nodes++;
    if (
      options.signal?.aborted ||
      (options.maxNodes !== undefined && nodes > options.maxNodes)
    ) {
      interrupted = true;
      return false;
    }
    const requiredCount = required.reduce((sum, n) => sum + n, 0);
    if (
      requiredCount === 0 &&
      optional >= (options.minOptional ?? 0) &&
      points >= (options.minPoints ?? 0) &&
      accept()
    )
      return true;
    const key = `${required.join(',')}|${available.join(',')}|${Math.min(optional, options.minOptional ?? 0)}|${Math.min(points, options.minPoints ?? 0)}|${optionalStart}`;
    if (memo.has(key)) return false;
    let choices: Pattern[] = [];
    if (requiredCount) {
      let smallest = Number.POSITIVE_INFINITY;
      for (let f = 0; f < 53; f++) {
        if (!required[f]) continue;
        const candidates = byFace[f]!.filter(fits);
        if (!candidates.length) {
          memo.add(key);
          return false;
        }
        if (candidates.length < smallest) {
          smallest = candidates.length;
          choices = candidates;
        }
      }
    } else choices = patterns.slice(optionalStart).filter(fits);
    choices.sort((a, b) => {
      const optionalA =
        a.natural.filter((f) => required[f] === 0).length +
        Math.max(0, a.joker.length - required[52]!);
      const optionalB =
        b.natural.filter((f) => required[f] === 0).length +
        Math.max(0, b.joker.length - required[52]!);
      return optionalB - optionalA || b.points - a.points;
    });
    for (const p of choices) {
      const consumedRequired: number[] = [];
      let extra = 0;
      for (const f of p.natural) {
        available[f]!--;
        if (required[f]! > 0) {
          required[f]!--;
          consumedRequired.push(f);
        } else extra++;
      }
      available[52]! -= p.joker.length;
      const usedJokers = Math.min(required[52]!, p.joker.length);
      required[52]! -= usedJokers;
      extra += p.joker.length - usedJokers;
      selected.push(p);
      const found = visit(
        optional + extra,
        points + p.points,
        requiredCount ? 0 : patterns.indexOf(p),
      );
      selected.pop();
      for (const f of p.natural) available[f]!++;
      for (const f of consumedRequired) required[f]!++;
      available[52]! += p.joker.length;
      required[52]! += usedJokers;
      if (found) return true;
      if (interrupted) return false;
    }
    // A custom acceptance predicate may distinguish different partitions of the
    // same counts. Do not memoize those states as impossible.
    if (!options.accept) memo.add(key);
    return false;
  }
  visit(0, 0);
  return { melds: answer, complete: !interrupted, nodes };
}
