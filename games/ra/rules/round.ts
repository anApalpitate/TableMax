import type { PublicEvent } from '@tablemax/game-sdk';
import { limits, tile, tileNames, type Kind } from './data';
import { settle } from './scoring';
import { playerCount, type Cause, type State } from './state';

export type Action =
  | { type: 'draw' | 'invokeRa' | 'pass' | 'finishGod' }
  | { type: 'bid'; disk: number }
  | { type: 'spendGod'; godId: string; slot: number; tileId: string }
  | { type: 'discard'; disasterId: string; tileIds: string[] };

export const following = (s: State, seat: string) =>
  s.seats[(s.seats.indexOf(seat) + 1) % s.seats.length]!;
const seatName = (s: State, seat: string) =>
  `${s.seats.indexOf(seat) + 1} 号席`;
const name = (id: string) => tileNames[tile(id).face]!;
type Cue =
  | 'draw'
  | 'open'
  | 'bid'
  | 'won'
  | 'clear'
  | 'hold'
  | 'god'
  | 'disaster'
  | 'epoch'
  | 'final';
type Tell = (text: string, cue?: Cue) => void;

function bidOptions(s: State, seat: string) {
  const auction = s.auction!;
  const best = Math.max(0, ...auction.bids.map((bid) => bid.disk ?? 0));
  return {
    disks: s.players[seat]!.up.filter((disk) => disk > best),
    pass: auction.caller !== seat || auction.cause !== 'invokeOpen' || best > 0,
  };
}

const victims: Record<string, Kind> = {
  war: 'civilization',
  earthquake: 'monument',
  funeral: 'pharaoh',
};

function discardOptions(s: State): Extract<Action, { type: 'discard' }>[] {
  const pending = s.disaster!;
  const disasterId = pending.queue[0]!;
  const { face } = tile(disasterId);
  const held = [...s.players[pending.owner]!.held].sort();
  const make = (tileIds: string[]): Extract<Action, { type: 'discard' }> => ({
    type: 'discard',
    disasterId,
    tileIds: [...tileIds].sort(),
  });
  if (face === 'drought') {
    const river = [
      ...held.filter((id) => tile(id).kind === 'flood'),
      ...held.filter((id) => tile(id).kind === 'nile'),
    ];
    return [make(river.slice(0, 2))];
  }
  const eligible = held.filter((id) => tile(id).kind === victims[face]);
  if (eligible.length <= 2) return [make(eligible)];
  const byFace = new Map<string, string[]>();
  for (const id of eligible) {
    const key = tile(id).face;
    const group = byFace.get(key) ?? [];
    group.push(id);
    byFace.set(key, group);
  }
  const groups = [...byFace.values()];
  return groups.flatMap((group, index) => [
    ...(group.length >= 2 ? [make(group.slice(0, 2))] : []),
    ...groups.slice(index + 1).map((other) => make([group[0]!, other[0]!])),
  ]);
}

function godOptions(s: State, seat: string): Action[] {
  return s.players[seat]!.held.filter((id) => tile(id).kind === 'god').flatMap(
    (godId) =>
      s.lot.flatMap((tileId, slot) =>
        tileId !== null && tile(tileId).kind !== 'god'
          ? [{ type: 'spendGod' as const, godId, slot, tileId }]
          : [],
      ),
  );
}

export function legal(s: State, seat: string): Action[] {
  if (s.actor !== seat) return [];
  switch (s.phase) {
    case 'turn':
      return [
        ...(s.lot.includes(null) ? [{ type: 'draw' as const }] : []),
        { type: 'invokeRa' },
        ...godOptions(s, seat),
      ];
    case 'auction': {
      const { disks, pass } = bidOptions(s, seat);
      return [
        ...disks.map((disk) => ({ type: 'bid' as const, disk })),
        ...(pass ? [{ type: 'pass' as const }] : []),
      ];
    }
    case 'godChain':
      return [{ type: 'finishGod' }, ...godOptions(s, seat)];
    case 'disaster':
      return discardOptions(s);
    case 'ended':
      return [];
  }
}

function scoreEpoch(s: State, tell: Tell) {
  tell(`第 ${s.epoch} 时代结算`, s.epoch === 3 ? 'final' : 'epoch');
  settle(s);
}

function nextTurn(s: State, first: string, tell: Tell) {
  s.phase = 'turn';
  const index = s.seats.indexOf(first);
  const seat = s.seats
    .map((_, i) => s.seats[(index + i) % s.seats.length]!)
    .find((id) => s.players[id]!.up.length);
  if (seat) s.actor = seat;
  else scoreEpoch(s, tell);
}

function resumeGod(s: State, seat: string, resume: string, tell: Tell) {
  if (godOptions(s, seat).length) {
    s.phase = 'godChain';
    s.actor = seat;
  } else nextTurn(s, resume, tell);
}

function discard(s: State, ids: string[], tell: Tell) {
  const pending = s.disaster!;
  const disasterId = pending.queue.shift()!;
  const owner = s.players[pending.owner]!;
  owner.held = owner.held.filter((id) => !ids.includes(id));
  s.removed.push(disasterId, ...ids);
  tell(
    `${seatName(s, pending.owner)}处理${name(disasterId)}：${ids.length ? ids.map(name).join('、') : '无板块可弃'}`,
    'disaster',
  );
}

function advanceDisasters(s: State, tell: Tell) {
  const pending = s.disaster!;
  while (pending.queue.length) {
    const options = discardOptions(s);
    if (options.length > 1) return;
    discard(s, options[0]!.tileIds, tell);
  }
  s.disaster = null;
  if (pending.godChain) resumeGod(s, pending.owner, pending.resume, tell);
  else nextTurn(s, pending.resume, tell);
}

function acquire(
  s: State,
  seat: string,
  ids: string[],
  resume: string,
  godChain: boolean,
  tell: Tell,
) {
  const queue = ids.filter((id) => tile(id).kind === 'disaster');
  s.players[seat]!.held.push(
    ...ids.filter((id) => tile(id).kind !== 'disaster'),
  );
  s.phase = 'disaster';
  s.actor = seat;
  s.disaster = { owner: seat, queue, resume, godChain };
  advanceDisasters(s, tell);
}

function advanceAuction(s: State, tell: Tell) {
  const auction = s.auction!;
  while (auction.bids.length < s.seats.length) {
    const seat = s.actor!;
    const { disks, pass } = bidOptions(s, seat);
    if (pass ? disks.length > 0 : disks.length !== 1) return;
    const disk = pass ? null : disks[0]!;
    auction.bids.push({ seat, disk });
    tell(
      `${seatName(s, seat)}${disk === null ? '跳过' : `出价 ${disk}`}`,
      disk === null ? undefined : 'bid',
    );
    s.actor = following(s, seat);
  }
  const bid = auction.bids.filter((entry) => entry.disk !== null).at(-1);
  const resume = following(s, auction.caller);
  s.auction = null;
  s.lastAuction = {
    ...auction,
    winner: bid?.seat ?? null,
    received: bid ? s.center : null,
  };
  if (bid && bid.disk !== null) {
    const player = s.players[bid.seat]!;
    const lot = s.lot.filter((id) => id !== null);
    s.lot.fill(null);
    player.up = player.up.filter((disk) => disk !== bid.disk);
    player.down.push(s.center);
    tell(
      `${seatName(s, bid.seat)}赢得 ${lot.length} 枚板块，以 ${bid.disk} 换取中央盘 ${s.center}`,
      'won',
    );
    s.center = bid.disk;
    acquire(s, bid.seat, lot, resume, false, tell);
  } else {
    if (auction.cause === 'invokeFull') {
      s.removed.push(...s.lot.filter((id) => id !== null));
      s.lot.fill(null);
    }
    tell(
      auction.cause === 'invokeFull'
        ? '无人出价，拍卖行清空'
        : '无人出价，拍卖行保留',
      auction.cause === 'invokeFull' ? 'clear' : 'hold',
    );
    nextTurn(s, resume, tell);
  }
}

function openAuction(s: State, caller: string, cause: Cause, tell: Tell) {
  s.phase = 'auction';
  s.actor = following(s, caller);
  s.auction = { cause, caller, bids: [] };
  advanceAuction(s, tell);
}

export function play(s: State, action: Action, seat: string): PublicEvent[] {
  const events: PublicEvent[] = [];
  const tell: Tell = (text, cue) => {
    events.push({ kind: cue ? `ra-${cue}` : 'ra-turn', text });
  };
  const next = following(s, seat);
  switch (action.type) {
    case 'draw': {
      const id = s.bag.pop();
      if (!id) throw new Error('板块袋异常耗尽');
      tell(
        `${seatName(s, seat)}抽出${name(id)}`,
        tile(id).kind === 'ra' ? 'open' : 'draw',
      );
      if (tile(id).kind !== 'ra') {
        s.lot[s.lot.indexOf(null)] = id;
        nextTurn(s, next, tell);
      } else {
        s.removed.push(id);
        s.raDrawn++;
        if (s.raDrawn === limits[playerCount(s.seats.length)])
          scoreEpoch(s, tell);
        else openAuction(s, seat, 'drawRa', tell);
      }
      break;
    }
    case 'invokeRa':
      tell(`${seatName(s, seat)}呼唤拉`, 'open');
      openAuction(
        s,
        seat,
        s.lot.includes(null) ? 'invokeOpen' : 'invokeFull',
        tell,
      );
      break;
    case 'bid':
    case 'pass':
      s.auction!.bids.push({
        seat,
        disk: action.type === 'bid' ? action.disk : null,
      });
      tell(
        `${seatName(s, seat)}${action.type === 'bid' ? `出价 ${action.disk}` : '跳过'}`,
        action.type === 'bid' ? 'bid' : undefined,
      );
      s.actor = next;
      advanceAuction(s, tell);
      break;
    case 'spendGod':
      s.players[seat]!.held = s.players[seat]!.held.filter(
        (id) => id !== action.godId,
      );
      s.removed.push(action.godId);
      s.lot[action.slot] = null;
      tell(`${seatName(s, seat)}使用神明取走${name(action.tileId)}`, 'god');
      acquire(s, seat, [action.tileId], next, true, tell);
      break;
    case 'finishGod':
      nextTurn(s, next, tell);
      break;
    case 'discard':
      discard(s, action.tileIds, tell);
      advanceDisasters(s, tell);
      break;
  }
  s.serial++;
  // Keep feedback within the room protocol's eight-event limit. The newest
  // entries carry the outcome when a single move also resolves forced steps.
  return events.slice(-8);
}
