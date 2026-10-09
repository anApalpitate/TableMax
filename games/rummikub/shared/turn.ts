import { getTile } from '../data/catalog';
import type { JokerReleaseProof, Meld, PlayAction } from '../types';
import { normalizeTable, tableKey } from './melds';
import { searchSets, type SearchOptions, type SearchResult } from './solver';

export type TurnContext = {
  rack: readonly string[];
  table: readonly Meld[];
  opened: boolean;
};
export type TurnInspection = { placedTileIds: string[]; points: number };
const cloneMelds = (melds: readonly Meld[]): Meld[] =>
  melds.map((meld) => ({
    ...meld,
    tiles: meld.tiles.map((placement) => ({ ...placement })),
  }));

/** One planning call owns this FIFO cache; it is never game state. */
export class TurnProofCache {
  private readonly entries = new Map<string, Meld[] | null>();

  get size(): number {
    return this.entries.size;
  }

  get(key: string): Meld[] | null | undefined {
    const melds = this.entries.get(key);
    return melds ? cloneMelds(melds) : melds;
  }

  set(key: string, melds: readonly Meld[] | null): void {
    if (!this.entries.has(key) && this.entries.size >= 256)
      this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, melds ? cloneMelds(melds) : null);
  }
}

export type TurnPreparationOptions = Pick<
  SearchOptions,
  'maxNodes' | 'signal'
> & {
  proofCache?: TurnProofCache;
};

const tileIds = (table: readonly Meld[]) =>
  table.flatMap((m) => m.tiles.map((p) => p.tileId));
function baseInspection(context: TurnContext, table: readonly Meld[]) {
  const before = normalizeTable(context.table),
    after = normalizeTable(table);
  const oldIds = tileIds(before),
    nextIds = tileIds(after);
  if (
    new Set(context.rack).size !== context.rack.length ||
    context.rack.some((id) => oldIds.includes(id))
  )
    throw new Error('本人牌架实例无效。');
  context.rack.forEach(getTile);
  if (oldIds.some((id) => !nextIds.includes(id)))
    throw new Error('桌面原牌必须全部留在桌面。');
  if (nextIds.some((id) => !oldIds.includes(id) && !context.rack.includes(id)))
    throw new Error('只能使用本人牌架和公开桌面上的牌。');
  const placedTileIds = nextIds.filter((id) => !oldIds.includes(id));
  if (!placedTileIds.length) throw new Error('每回合须至少打出一张本人牌。');
  let points = 0;
  if (!context.opened) {
    const oldGroups = after.filter((m) =>
      m.tiles.some((p) => oldIds.includes(p.tileId)),
    );
    if (
      oldGroups.some((m) => m.tiles.some((p) => !oldIds.includes(p.tileId))) ||
      tableKey(oldGroups) !== tableKey(before)
    )
      throw new Error('首出当回合不能操作原桌面牌组。');
    points = after
      .filter((m) => m.tiles.every((p) => !oldIds.includes(p.tileId)))
      .flatMap((m) => m.tiles)
      .reduce((sum, p) => sum + p.value, 0);
    if (points < 30) throw new Error('首出须仅用本人牌组成至少三十点。');
  }
  return { before, after, placedTileIds, points };
}
function releaseSources(before: readonly Meld[], after: readonly Meld[]) {
  const needed: { jokerId: string; source: Meld }[] = [];
  for (const source of before) {
    for (const joker of source.tiles.filter((p) => getTile(p.tileId).joker)) {
      const destination = after.find((m) =>
        m.tiles.some((p) => p.tileId === joker.tileId),
      )!;
      const next = destination.tiles.find((p) => p.tileId === joker.tileId)!;
      const anchored =
        destination.kind === source.kind &&
        next.value === joker.value &&
        (source.kind === 'group' || next.color === joker.color) &&
        destination.tiles.some(
          (p) =>
            p.tileId !== joker.tileId &&
            !getTile(p.tileId).joker &&
            source.tiles.some((q) => q.tileId === p.tileId),
        );
      if (!anchored) needed.push({ jokerId: joker.tileId, source });
    }
  }
  return needed;
}
export function inspectTurn(
  context: TurnContext,
  action: PlayAction,
): TurnInspection {
  if (!action || action.type !== 'submit-turn')
    throw new Error('整回合动作无效。');
  const { before, after, placedTileIds, points } = baseInspection(
    context,
    action.table,
  );
  const needed = releaseSources(before, after);
  const proofs = action.releases ?? [];
  if (
    proofs.length > 2 ||
    new Set(proofs.map((p) => p.jokerId)).size !== proofs.length
  )
    throw new Error('百搭释放证明重复或过长。');
  const allowed = new Set([...tileIds(before), ...placedTileIds]);
  for (const entry of needed) {
    if (!context.opened) throw new Error('完成首出后的后续回合才能回收百搭。');
    const proof = proofs.find((p) => p.jokerId === entry.jokerId);
    if (!proof) throw new Error('移动或改绑百搭须提供合法释放证明。');
    const replacements = normalizeTable(proof.replacementSets);
    const ids = tileIds(replacements);
    if (
      ids.includes(entry.jokerId) ||
      ids.some((id) => !allowed.has(id)) ||
      entry.source.tiles.some(
        (p) => p.tileId !== entry.jokerId && !ids.includes(p.tileId),
      )
    )
      throw new Error(
        '替代牌组必须合法覆盖百搭原组的其余牌，且不能使用未出手牌。',
      );
    // The returned joker is necessarily on a legitimate final set, never kept
    // on the rack; all old table IDs were checked above.
  }
  if (
    proofs.some(
      (proof) => !needed.some((entry) => entry.jokerId === proof.jokerId),
    )
  )
    throw new Error('没有释放的百搭不能附加证明。');
  return { placedTileIds, points };
}

/** Produce the bounded, auditable joker witnesses required by the final board. */
function buildTurn(
  context: TurnContext,
  table: readonly Meld[],
  options: TurnPreparationOptions = {},
): { action: PlayAction | null; complete: boolean } {
  try {
    const { before, after, placedTileIds } = baseInspection(context, table);
    const releases: JokerReleaseProof[] = [];
    const available = [...tileIds(before), ...placedTileIds];
    for (const entry of releaseSources(before, after)) {
      const required = entry.source.tiles
        .filter((p) => p.tileId !== entry.jokerId)
        .map((p) => p.tileId);
      const direct = after.filter(
        (m) => !m.tiles.some((p) => p.tileId === entry.jokerId),
      );
      if (required.every((id) => tileIds(direct).includes(id))) {
        releases.push({ jokerId: entry.jokerId, replacementSets: direct });
        continue;
      }
      if (options.signal?.aborted) return { action: null, complete: false };
      const proofAvailable = available.filter((id) => id !== entry.jokerId);
      const key = options.proofCache
        ? JSON.stringify([
            [...required].sort(),
            [...proofAvailable].sort(),
            options.maxNodes ?? null,
          ])
        : '';
      const cached = options.proofCache?.get(key);
      const proof =
        cached !== undefined
          ? { melds: cached, complete: true }
          : searchSets(required, proofAvailable, options);
      if (cached === undefined && proof.complete && !options.signal?.aborted)
        options.proofCache?.set(key, proof.melds);
      if (!proof.melds) return { action: null, complete: proof.complete };
      releases.push({
        jokerId: entry.jokerId,
        replacementSets: normalizeTable(proof.melds),
      });
    }
    const action: PlayAction = {
      type: 'submit-turn',
      table: after,
      ...(releases.length ? { releases } : {}),
    };
    inspectTurn(context, action);
    return { action, complete: true };
  } catch {
    return { action: null, complete: true };
  }
}
export function prepareTurn(
  context: TurnContext,
  table: readonly Meld[],
  options: TurnPreparationOptions = {},
): PlayAction | null {
  return buildTurn(context, table, options).action;
}

/** Exact existence is used for empty-pool passes; callers may bound suggestions. */
export function findLegalPlay(
  context: TurnContext,
  options: Omit<SearchOptions, 'accept' | 'minOptional' | 'minPoints'> = {},
): { action: PlayAction | null; complete: boolean; nodes: number } {
  let action: PlayAction | null = null;
  const ids = tileIds(context.table);
  let result: SearchResult;
  if (!context.opened) {
    // Initial sets cannot touch the old table. Any count-cover solution is
    // therefore valid independently of the partition and can use memoization.
    result = searchSets([], context.rack, {
      ...options,
      minOptional: 1,
      minPoints: 30,
    });
    if (result.melds)
      action = prepareTurn(
        context,
        [...context.table, ...result.melds],
        options,
      );
  } else {
    // First solve the relaxed count problem, with memoization. A proof of no
    // partition is also a proof that no joker-aware play exists. Without an
    // old table joker, every solution already satisfies all turn restrictions.
    const available = [...ids, ...context.rack];
    result = searchSets(ids, available, { ...options, minOptional: 1 });
    if (!result.melds)
      return { action: null, complete: result.complete, nodes: result.nodes };
    const first = buildTurn(context, result.melds, options);
    if (first.action)
      return { action: first.action, complete: true, nodes: result.nodes };
    if (!first.complete)
      return { action: null, complete: false, nodes: result.nodes };
    if (!ids.some((id) => getTile(id).joker))
      throw new Error('无百搭的组合解未通过回合不变量。');
    let proofIncomplete = false;
    result = searchSets(ids, available, {
      ...options,
      minOptional: 1,
      accept: (sets) => {
        const candidate = buildTurn(context, sets, options);
        if (!candidate.complete) proofIncomplete = true;
        action = candidate.action;
        return action !== null;
      },
    });
    if (!action && proofIncomplete) result.complete = false;
  }
  return { action, complete: result.complete, nodes: result.nodes };
}
