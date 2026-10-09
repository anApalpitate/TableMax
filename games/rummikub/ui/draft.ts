import type { Color, Meld, Placement, RummikubView, Tile } from '../types';

export type DraftGroup = {
  id: string;
  kind: Meld['kind'];
  tiles: string[];
};
export type Binding = { color: Color; value: number };
export type TurnDraft = {
  groups: DraftGroup[];
  rack: string[];
  tray: string[];
  bindings: Record<string, Binding>;
  nextGroup: number;
};
export type DraftContext = {
  tiles: Record<string, Tile>;
  originalRack: Set<string>;
  originalTable: Set<string>;
};

export function isJoker(id: string) {
  return id === 'joker-a' || id === 'joker-b';
}

export function turnScope(
  instance: string,
  branch: number,
  game: RummikubView,
) {
  return `${instance}:${branch}:${game.turnNumber}:${game.self?.seatId ?? ''}:${JSON.stringify([game.table, game.self?.rack.map((tile) => tile.id)])}`;
}

export function contextFor(game: RummikubView): DraftContext {
  const tiles: Record<string, Tile> = Object.create(null);
  for (const group of game.table)
    for (const placement of group.tiles)
      tiles[placement.tileId] = {
        id: placement.tileId,
        color: isJoker(placement.tileId) ? null : placement.color,
        value: isJoker(placement.tileId) ? null : placement.value,
        joker: isJoker(placement.tileId),
      };
  for (const tile of game.self?.rack ?? []) tiles[tile.id] = tile;
  return {
    tiles,
    originalRack: new Set(game.self?.rack.map((tile) => tile.id)),
    originalTable: new Set(
      game.table.flatMap((group) => group.tiles.map((tile) => tile.tileId)),
    ),
  };
}

export function initialDraft(game: RummikubView): TurnDraft {
  return {
    groups: game.table.map((group, index) => ({
      id: `saved-${index}`,
      kind: group.kind,
      tiles: group.tiles.map((tile) => tile.tileId),
    })),
    rack: game.self?.rack.map((tile) => tile.id) ?? [],
    tray: [],
    bindings: Object.fromEntries(
      game.table
        .flatMap((group) => group.tiles)
        .filter((tile) => isJoker(tile.tileId))
        .map((tile) => [tile.tileId, { color: tile.color, value: tile.value }]),
    ),
    nextGroup: 1,
  };
}

export function placementFor(
  id: string,
  draft: TurnDraft,
  context: DraftContext,
): Placement | null {
  const tile = context.tiles[id];
  if (!tile) return null;
  const face = tile.joker ? draft.bindings[id] : tile;
  return face?.color && face.value !== null && face.value !== undefined
    ? { tileId: id, color: face.color, value: face.value }
    : null;
}

export function tableFor(
  draft: TurnDraft,
  context: DraftContext,
): Meld[] | null {
  const table: Meld[] = [];
  for (const group of draft.groups) {
    if (!group.tiles.length) continue;
    const placements = group.tiles.map((id) =>
      placementFor(id, draft, context),
    );
    if (placements.some((tile) => tile === null)) return null;
    table.push({ kind: group.kind, tiles: placements as Placement[] });
  }
  return table;
}

function inferKind(
  ids: string[],
  draft: TurnDraft,
  context: DraftContext,
): Meld['kind'] {
  const placements = ids
    .map((id) => placementFor(id, draft, context))
    .filter((tile) => tile !== null);
  return placements.length > 1 &&
    placements.every((tile) => tile.value === placements[0]!.value)
    ? 'group'
    : 'run';
}

/** IDs move between containers; no operation clones a physical tile. */
export function moveTiles(
  draft: TurnDraft,
  ids: string[],
  destination: { group: string; index?: number } | 'new' | 'rack' | 'tray',
  context: DraftContext,
): TurnDraft {
  const selected = new Set(ids);
  if (
    !ids.length ||
    selected.size !== ids.length ||
    ids.some((id) => !Object.hasOwn(context.tiles, id))
  )
    return draft;
  if (destination === 'rack' && ids.some((id) => !context.originalRack.has(id)))
    return draft;
  const source = draft.groups.find(
    (group) =>
      typeof destination === 'object' && group.id === destination.group,
  );
  if (typeof destination === 'object' && !source) return draft;
  const insertAt =
    source && typeof destination === 'object'
      ? Math.max(
          0,
          Math.min(
            source.tiles.length,
            destination.index ?? source.tiles.length,
          ),
        )
      : 0;
  const removedBefore =
    source?.tiles.slice(0, insertAt).filter((id) => selected.has(id)).length ??
    0;
  let groups = draft.groups.map((group) => ({
    ...group,
    tiles: group.tiles.filter((id) => !selected.has(id)),
  }));
  const rack = draft.rack.filter((id) => !selected.has(id));
  const tray = draft.tray.filter((id) => !selected.has(id));
  let nextGroup = draft.nextGroup;
  if (destination === 'new') {
    groups.push({
      id: `draft-${nextGroup++}`,
      kind: inferKind(ids, draft, context),
      tiles: [...ids],
    });
  } else if (destination === 'rack') rack.push(...ids);
  else if (destination === 'tray') tray.push(...ids);
  else
    groups = groups.map((group) => {
      if (group.id !== destination.group) return group;
      const at = Math.max(0, insertAt - removedBefore);
      const tiles = [
        ...group.tiles.slice(0, at),
        ...ids,
        ...group.tiles.slice(at),
      ];
      return { ...group, kind: inferKind(tiles, draft, context), tiles };
    });
  return {
    ...draft,
    groups: groups.filter((group) => group.tiles.length > 0),
    rack,
    tray,
    nextGroup,
  };
}

export function splitGroup(
  draft: TurnDraft,
  id: string,
  before: string,
): TurnDraft {
  const group = draft.groups.find((entry) => entry.id === id);
  const at = group?.tiles.indexOf(before) ?? -1;
  if (!group || at < 1) return draft;
  return {
    ...draft,
    groups: draft.groups.flatMap((entry) =>
      entry.id === id
        ? [
            { ...entry, tiles: entry.tiles.slice(0, at) },
            {
              id: `draft-${draft.nextGroup}`,
              kind: entry.kind,
              tiles: entry.tiles.slice(at),
            },
          ]
        : [entry],
    ),
    nextGroup: draft.nextGroup + 1,
  };
}

export function sortGroup(
  draft: TurnDraft,
  id: string,
  context: DraftContext,
): TurnDraft {
  return {
    ...draft,
    groups: draft.groups.map((group) =>
      group.id !== id
        ? group
        : {
            ...group,
            tiles: [...group.tiles].sort((a, b) => {
              const left = placementFor(a, draft, context);
              const right = placementFor(b, draft, context);
              return (
                (left?.value ?? 99) - (right?.value ?? 99) ||
                (left?.color ?? '').localeCompare(right?.color ?? '')
              );
            }),
          },
    ),
  };
}

/** Session-storage drafts are untrusted and must match this exact turn's tiles. */
export function restoreDraft(
  value: unknown,
  context: DraftContext,
): TurnDraft | null {
  if (!value || typeof value !== 'object') return null;
  const draft = value as TurnDraft;
  if (
    !Array.isArray(draft.groups) ||
    !Array.isArray(draft.rack) ||
    !Array.isArray(draft.tray) ||
    !Number.isSafeInteger(draft.nextGroup) ||
    draft.nextGroup < 1 ||
    !draft.bindings ||
    typeof draft.bindings !== 'object' ||
    Array.isArray(draft.bindings)
  )
    return null;
  if (
    draft.groups.some(
      (group) =>
        !group ||
        typeof group.id !== 'string' ||
        (group.kind !== 'run' && group.kind !== 'group') ||
        !Array.isArray(group.tiles),
    )
  )
    return null;
  if (
    new Set(draft.groups.map((group) => group.id)).size !== draft.groups.length
  )
    return null;
  const ids = [
    ...draft.groups.flatMap((group) => group.tiles),
    ...draft.rack,
    ...draft.tray,
  ];
  if (
    ids.some(
      (id) => typeof id !== 'string' || !Object.hasOwn(context.tiles, id),
    ) ||
    new Set(ids).size !== ids.length ||
    ids.length !== Object.keys(context.tiles).length ||
    draft.rack.some((id) => !context.originalRack.has(id))
  )
    return null;
  for (const [id, binding] of Object.entries(draft.bindings)) {
    if (
      !context.tiles[id]?.joker ||
      !binding ||
      !['black', 'blue', 'orange', 'red'].includes(binding.color) ||
      !Number.isInteger(binding.value) ||
      binding.value < 1 ||
      binding.value > 13
    )
      return null;
  }
  return draft;
}
