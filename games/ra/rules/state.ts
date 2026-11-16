import {
  auctionSlots,
  limits,
  startingDisks,
  tile,
  tileIds,
  type PlayerCount,
} from './data';

export type Phase = 'turn' | 'auction' | 'godChain' | 'disaster' | 'ended';
export type Cause = 'drawRa' | 'invokeFull' | 'invokeOpen';
export type Bid = { seat: string; disk: number | null };
export type Auction = { cause: Cause; caller: string; bids: Bid[] };
export type Breakdown = {
  pharaoh: number;
  god: number;
  gold: number;
  river: number;
  civilization: number;
  monument: number;
  disks: number;
};
export type Score = {
  epoch: number;
  parts: Breakdown;
  delta: number;
  total: number;
};
export type Player = {
  up: number[];
  down: number[];
  held: string[];
  scores: Score[];
};
export type State = {
  seats: string[];
  players: Record<string, Player>;
  epoch: number;
  raDrawn: number;
  phase: Phase;
  actor: string | null;
  serial: number;
  center: number;
  bag: string[];
  lot: (string | null)[];
  removed: string[];
  auction: Auction | null;
  lastAuction:
    (Auction & { winner: string | null; received: number | null }) | null;
  disaster: {
    owner: string;
    queue: string[];
    resume: string;
    godChain: boolean;
  } | null;
  winner: string | null;
};

export function playerCount(n: number): PlayerCount {
  if (n !== 2 && n !== 3 && n !== 4 && n !== 5)
    throw new Error('需要 2–5 个座位');
  return n;
}

function invariant(value: unknown): asserts value {
  if (!value) throw new Error('太阳神存档状态无效');
}

export function validateState(input: unknown, seats: readonly string[]): State {
  const s = input as State;
  const n = playerCount(seats.length);
  invariant(
    s &&
      Array.isArray(s.seats) &&
      s.seats.length === n &&
      seats.every((id, i) => id === s.seats[i]),
  );
  invariant(
    new Set(seats).size === n &&
      s.players &&
      Object.keys(s.players).length === n,
  );
  invariant(Number.isInteger(s.epoch) && s.epoch >= 1 && s.epoch <= 3);
  invariant(Number.isSafeInteger(s.serial) && s.serial >= 0);
  invariant(
    ['turn', 'auction', 'godChain', 'disaster', 'ended'].includes(s.phase),
  );
  invariant(
    Number.isInteger(s.raDrawn) && s.raDrawn >= 0 && s.raDrawn <= limits[n],
  );
  invariant(
    Array.isArray(s.bag) &&
      Array.isArray(s.removed) &&
      Array.isArray(s.lot) &&
      s.lot.length === auctionSlots,
  );
  invariant(s.lot.every((id) => id === null || tile(id).kind !== 'ra'));
  const allDisks = [s.center];
  const allTiles = [
    ...s.bag,
    ...s.removed,
    ...s.lot.filter((id) => id !== null),
  ];
  for (const seat of seats) {
    const p = s.players[seat];
    invariant(
      p &&
        Array.isArray(p.up) &&
        Array.isArray(p.down) &&
        Array.isArray(p.held) &&
        Array.isArray(p.scores),
    );
    invariant(p.up.length + p.down.length === startingDisks[n][0].length);
    invariant(
      p.held.every((id) => !['ra', 'disaster'].includes(tile(id).kind)),
    );
    invariant(p.scores.length === (s.phase === 'ended' ? 3 : s.epoch - 1));
    let prior = 10;
    p.scores.forEach((score, i) => {
      const keys = [
        'pharaoh',
        'god',
        'gold',
        'river',
        'civilization',
        'monument',
        'disks',
      ] as const;
      invariant(
        score.epoch === i + 1 &&
          score.parts &&
          Object.keys(score.parts).length === keys.length &&
          keys.every((key) => Number.isSafeInteger(score.parts[key])),
      );
      const total = Math.max(
        0,
        prior + keys.reduce((sum, key) => sum + score.parts[key], 0),
      );
      invariant(score.total === total && score.delta === total - prior);
      prior = total;
    });
    allDisks.push(...p.up, ...p.down);
    allTiles.push(...p.held);
  }
  invariant(
    allDisks.length === 1 + n * startingDisks[n][0].length &&
      allDisks.sort((a, b) => a - b).every((disk, index) => disk === index + 1),
  );
  invariant((s.phase === 'auction') === (s.auction !== null));
  invariant((s.phase === 'disaster') === (s.disaster !== null));
  if (s.auction) {
    const { caller, cause, bids } = s.auction;
    const first = seats.indexOf(caller);
    invariant(
      first >= 0 &&
        ['drawRa', 'invokeFull', 'invokeOpen'].includes(cause) &&
        Array.isArray(bids) &&
        bids.length < n &&
        s.actor === seats[(first + bids.length + 1) % n],
    );
    let high = 0;
    bids.forEach((bid, i) => {
      invariant(bid.seat === seats[(first + i + 1) % n]);
      if (bid.disk !== null) {
        invariant(
          bid.disk > high && s.players[bid.seat]!.up.includes(bid.disk),
        );
        high = bid.disk;
      }
    });
  }
  if (s.disaster) {
    const { owner, resume, queue, godChain } = s.disaster;
    invariant(
      s.actor === owner &&
        seats.includes(resume) &&
        typeof godChain === 'boolean' &&
        Array.isArray(queue) &&
        queue.length > 0 &&
        queue.every((id) => tile(id).kind === 'disaster'),
    );
    allTiles.push(...queue);
  }
  invariant(
    allTiles.length === tileIds.length &&
      new Set(allTiles).size === tileIds.length &&
      allTiles.every((id) => Object.hasOwn(tilesIndex, id)),
  );
  if (s.phase === 'ended') {
    invariant(
      s.actor === null &&
        s.epoch === 3 &&
        s.winner !== null &&
        seats.includes(s.winner),
    );
  } else {
    invariant(
      s.winner === null &&
        s.actor !== null &&
        seats.includes(s.actor) &&
        s.raDrawn < limits[n],
    );
    if (s.phase !== 'disaster') invariant(s.players[s.actor]!.up.length > 0);
  }
  return s;
}
const tilesIndex = Object.fromEntries(tileIds.map((id) => [id, true]));
