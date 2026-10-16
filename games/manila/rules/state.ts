import { CARGOS, MARKET, BERTH_PAYOUTS, emptySpaces } from './catalog';
import { finalScores, resolveWinners } from './scoring';
import type {
  BoatView,
  CargoId,
  Phase,
  ShareView,
  SpaceView,
  VoyageResult,
} from './view';

export type State = {
  version: 1;
  seats: string[];
  voyage: number;
  phase: Phase;
  serial: number;
  harborMaster: string;
  players: Record<
    string,
    { cash: number; shares: ShareView[]; usedWorkers: number; passed: boolean }
  >;
  market: Record<CargoId, number>;
  stock: Record<CargoId, number>;
  boats: BoatView[];
  spaces: SpaceView[];
  auction: {
    bid: number;
    highBidder: string | null;
    passed: string[];
    actor: string;
  };
  placementRound: number;
  placementCursor: number;
  movement: number;
  boardQueue: number[];
  boardCursor: number;
  plunderQueue: CargoId[];
  dice: { movement: number; values: Record<string, number> }[];
  result: VoyageResult | null;
  latest: string;
  scores: Record<string, number> | null;
  winners: string[];
  payment: {
    seatId: string;
    amount: number;
    reason: 'auction' | 'share' | 'place' | 'insurance';
    cargo: CargoId | null;
    space: string | null;
  } | null;
  settlementBefore: Record<string, number> | null;
};

export function workerCount(s: State): number {
  return s.seats.length === 3 ? 4 : 3;
}
export function occupant(s: State, id: string): string | null {
  return s.spaces.find((x) => x.id === id)?.occupant ?? null;
}
export function turnSeat(s: State): string | null {
  if (s.phase === 'ended') return null;
  if (s.phase === 'financing') return s.payment!.seatId;
  if (s.phase === 'auction') return s.auction.actor;
  if (s.phase === 'place')
    return s.seats[
      (s.seats.indexOf(s.harborMaster) + s.placementCursor) % s.seats.length
    ]!;
  if (s.phase === 'board')
    return occupant(s, `pirate-${s.boardQueue[s.boardCursor]}`);
  if (s.phase.startsWith('pilot-')) return occupant(s, s.phase);
  if (s.phase === 'plunder')
    return occupant(s, 'pirate-0') ?? occupant(s, 'pirate-1');
  return s.harborMaster;
}

function invalid(): never {
  throw new Error('Invalid Manila state');
}
function object(x: unknown): x is Record<string, unknown> {
  return (
    !!x &&
    typeof x === 'object' &&
    !Array.isArray(x) &&
    Object.getPrototypeOf(x) === Object.prototype
  );
}
function exact(x: unknown, keys: string[]): x is Record<string, unknown> {
  return (
    object(x) && Object.keys(x).sort().join('|') === [...keys].sort().join('|')
  );
}
function integer(
  x: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): x is number {
  return (
    Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max
  );
}
function ids(
  x: unknown,
  allowed: readonly string[],
  unique = true,
): x is string[] {
  return (
    Array.isArray(x) &&
    x.every((v) => typeof v === 'string' && allowed.includes(v)) &&
    (!unique || new Set(x).size === x.length)
  );
}
function recordNumbers(
  x: unknown,
  keys: readonly string[],
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): boolean {
  return (
    exact(x, [...keys]) && Object.values(x).every((v) => integer(v, min, max))
  );
}

export function validateState(input: unknown, seats: readonly string[]): State {
  if (
    !exact(input, [
      'version',
      'seats',
      'voyage',
      'phase',
      'serial',
      'harborMaster',
      'players',
      'market',
      'stock',
      'boats',
      'spaces',
      'auction',
      'placementRound',
      'placementCursor',
      'movement',
      'boardQueue',
      'boardCursor',
      'plunderQueue',
      'dice',
      'result',
      'latest',
      'scores',
      'winners',
      'payment',
      'settlementBefore',
    ])
  )
    invalid();
  const s = input as unknown as State;
  if (
    s.version !== 1 ||
    !ids(s.seats, seats) ||
    s.seats.length < 3 ||
    s.seats.length > 5 ||
    JSON.stringify(s.seats) !== JSON.stringify(seats) ||
    !integer(s.voyage, 1) ||
    !integer(s.serial, 0) ||
    ![
      'auction',
      'share',
      'setup',
      'place',
      'board',
      'pilot-small',
      'pilot-large',
      'plunder',
      'financing',
      'round-result',
      'ended',
    ].includes(s.phase) ||
    !s.seats.includes(s.harborMaster) ||
    !exact(s.players, s.seats) ||
    !exact(s.market, CARGOS) ||
    !Object.values(s.market).every((x) => MARKET.includes(x)) ||
    !recordNumbers(s.stock, CARGOS, 0, 5) ||
    !integer(s.placementRound, 0, workerCount(s)) ||
    !integer(s.placementCursor, 0, s.seats.length - 1) ||
    !integer(s.movement, 0, 3) ||
    typeof s.latest !== 'string' ||
    s.latest.length > 500 ||
    !ids(s.winners, s.seats)
  )
    invalid();
  const allShares = new Set<string>();
  const counts = Object.fromEntries(CARGOS.map((c) => [c, 0])) as Record<
    CargoId,
    number
  >;
  for (const seat of s.seats) {
    const p = s.players[seat]!;
    if (
      !exact(p, ['cash', 'shares', 'usedWorkers', 'passed']) ||
      !integer(p.cash, 0) ||
      !integer(p.usedWorkers, 0, workerCount(s)) ||
      typeof p.passed !== 'boolean' ||
      !Array.isArray(p.shares) ||
      p.shares.length < 2 ||
      p.shares.length > 20
    )
      invalid();
    for (const share of p.shares) {
      if (
        !exact(share, ['id', 'cargo', 'mortgaged', 'revealed']) ||
        !CARGOS.includes(share.cargo) ||
        !new RegExp(`^${share.cargo}-[1-5]$`).test(share.id) ||
        allShares.has(share.id) ||
        typeof share.mortgaged !== 'boolean' ||
        typeof share.revealed !== 'boolean'
      )
        invalid();
      allShares.add(share.id);
      counts[share.cargo]++;
    }
  }
  if (CARGOS.some((c) => counts[c] + s.stock[c] !== 5)) invalid();
  if (
    !exact(s.auction, ['bid', 'highBidder', 'passed', 'actor']) ||
    !integer(s.auction.bid, 0) ||
    !s.seats.includes(s.auction.actor) ||
    (s.auction.highBidder !== null &&
      !s.seats.includes(s.auction.highBidder)) ||
    !ids(s.auction.passed, s.seats) ||
    (s.auction.bid === 0) !== (s.auction.highBidder === null) ||
    (s.auction.highBidder !== null &&
      s.auction.passed.includes(s.auction.highBidder))
  )
    invalid();
  if (
    s.phase === 'auction' &&
    (s.auction.passed.includes(s.auction.actor) ||
      (s.auction.highBidder !== null &&
        s.auction.actor === s.auction.highBidder))
  )
    invalid();
  if (
    !Array.isArray(s.boats) ||
    ![0, 3].includes(s.boats.length) ||
    !ids(
      s.boats.map((b) => b?.cargo),
      CARGOS,
    )
  )
    invalid();
  const used = Object.fromEntries(s.seats.map((seat) => [seat, 0]));
  for (const boat of s.boats) {
    if (
      !exact(boat, [
        'cargo',
        'position',
        'destination',
        'destinationIndex',
        'crew',
        'plundered',
      ]) ||
      !integer(boat.position, 0, 14) ||
      !['sea', 'port', 'shipyard'].includes(boat.destination) ||
      typeof boat.plundered !== 'boolean' ||
      !ids(boat.crew, s.seats, false) ||
      boat.crew.length > (boat.cargo === 'jade' ? 4 : 3) ||
      (boat.destination === 'sea'
        ? boat.destinationIndex !== null || boat.position > 13
        : !integer(boat.destinationIndex, 0, 2)) ||
      (boat.destination === 'port' && boat.position !== 14) ||
      (boat.plundered && boat.crew.length !== 0)
    )
      invalid();
  }
  for (const destination of ['port', 'shipyard']) {
    const indices = s.boats
      .filter((b) => b.destination === destination)
      .map((b) => b.destinationIndex!)
      .sort();
    if (indices.some((value, index) => value !== index)) invalid();
  }
  const expectedSpaces = emptySpaces(s.boats.map((b) => b.cargo));
  if (!Array.isArray(s.spaces) || s.spaces.length !== expectedSpaces.length)
    invalid();
  for (const [index, space] of s.spaces.entries()) {
    const expected = expectedSpaces[index]!;
    if (
      !exact(space, [
        'id',
        'kind',
        'cargo',
        'index',
        'cost',
        'payout',
        'occupant',
      ]) ||
      Object.entries(expected).some(
        ([key, value]) =>
          key !== 'occupant' && space[key as keyof SpaceView] !== value,
      ) ||
      (space.occupant !== null && !s.seats.includes(space.occupant))
    )
      invalid();
    if (space.occupant) used[space.occupant] = used[space.occupant]! + 1;
  }
  for (const boat of s.boats) {
    const crew = s.spaces
      .filter((space) => space.cargo === boat.cargo && space.occupant)
      .map((space) => space.occupant!);
    if (JSON.stringify(crew) !== JSON.stringify(boat.crew)) invalid();
    const cargoSpaces = s.spaces.filter((space) => space.cargo === boat.cargo);
    if (
      cargoSpaces.some(
        (space, index) =>
          space.occupant !== null &&
          cargoSpaces.slice(0, index).some((x) => x.occupant === null),
      )
    )
      invalid();
  }
  if (s.seats.some((seat) => used[seat]! > s.players[seat]!.usedWorkers))
    invalid();
  if (
    !Array.isArray(s.boardQueue) ||
    s.boardQueue.some((x) => x !== 0 && x !== 1) ||
    new Set(s.boardQueue).size !== s.boardQueue.length ||
    !integer(s.boardCursor, 0, s.boardQueue.length) ||
    !ids(s.plunderQueue, CARGOS) ||
    s.plunderQueue.some(
      (c) =>
        !s.boats.some(
          (b) =>
            b.cargo === c &&
            b.destination === 'sea' &&
            b.position === 13 &&
            b.plundered,
        ),
    )
  )
    invalid();
  if (
    !Array.isArray(s.dice) ||
    s.dice.length !== s.movement ||
    s.dice.some(
      (roll, index) =>
        !exact(roll, ['movement', 'values']) ||
        roll.movement !== index + 1 ||
        !recordNumbers(
          roll.values,
          s.boats.map((b) => b.cargo),
          1,
          6,
        ),
    )
  )
    invalid();
  if ((s.phase === 'financing') !== (s.payment !== null)) invalid();
  if (s.payment) {
    const p = s.payment;
    if (
      !exact(p, ['seatId', 'amount', 'reason', 'cargo', 'space']) ||
      !s.seats.includes(p.seatId) ||
      !integer(p.amount, 1) ||
      !['auction', 'share', 'place', 'insurance'].includes(p.reason) ||
      (p.cargo !== null && !CARGOS.includes(p.cargo)) ||
      (p.space !== null && !s.spaces.some((x) => x.id === p.space)) ||
      s.players[p.seatId]!.cash >= p.amount ||
      !s.players[p.seatId]!.shares.some((x) => !x.mortgaged) ||
      (p.reason === 'share') !== (p.cargo !== null) ||
      (p.reason === 'place') !== (p.space !== null)
    )
      invalid();
    if (
      p.reason === 'auction' &&
      (p.seatId !== s.harborMaster ||
        p.seatId !== s.auction.highBidder ||
        p.amount !== s.auction.bid ||
        s.auction.passed.length !== s.seats.length - 1)
    )
      invalid();
    if (
      p.reason === 'share' &&
      (p.seatId !== s.harborMaster ||
        p.amount !== Math.max(5, s.market[p.cargo!]) ||
        s.stock[p.cargo!] === 0)
    )
      invalid();
    if (p.reason === 'place') {
      const space = s.spaces.find((x) => x.id === p.space)!;
      const payer = s.players[p.seatId]!,
        funds =
          payer.cash + payer.shares.filter((x) => !x.mortgaged).length * 12;
      if (
        p.seatId !==
          s.seats[
            (s.seats.indexOf(s.harborMaster) + s.placementCursor) %
              s.seats.length
          ] ||
        p.amount !== Math.min(space.cost, funds) ||
        space.occupant !== null ||
        space.kind === 'insurance' ||
        payer.passed ||
        payer.usedWorkers >= workerCount(s)
      )
        invalid();
    }
    if (p.reason === 'insurance') {
      const liability = s.boats
        .filter((b) => b.destination === 'shipyard')
        .reduce(
          (total, b) =>
            total +
            (occupant(s, `shipyard-${b.destinationIndex}`) === p.seatId
              ? 0
              : BERTH_PAYOUTS[b.destinationIndex!]!),
          0,
        );
      if (
        p.seatId !== occupant(s, 'insurance') ||
        p.amount !== liability ||
        s.movement !== 3 ||
        s.boats.some((b) => b.destination === 'sea') ||
        s.settlementBefore === null
      )
        invalid();
    }
  }
  if (
    s.settlementBefore !== null &&
    (!recordNumbers(s.settlementBefore, s.seats, 0) ||
      s.phase !== 'financing' ||
      s.payment?.reason !== 'insurance')
  )
    invalid();
  const preSetup =
    ['auction', 'share', 'setup'].includes(s.phase) ||
    (s.phase === 'financing' &&
      ['auction', 'share'].includes(s.payment!.reason));
  if (
    preSetup &&
    (s.boats.length ||
      s.movement ||
      s.placementRound ||
      Object.values(s.players).some((p) => p.usedWorkers || p.passed))
  )
    invalid();
  if (!preSetup && s.boats.length !== 3) invalid();
  if (
    s.phase === 'place' &&
    (s.placementRound < 1 ||
      s.players[turnSeat(s)!]!.passed ||
      s.players[turnSeat(s)!]!.usedWorkers >= workerCount(s))
  )
    invalid();
  if (
    s.phase === 'board' &&
    (s.movement !== 2 || s.boardCursor >= s.boardQueue.length || !turnSeat(s))
  )
    invalid();
  if (s.phase.startsWith('pilot-') && (s.movement !== 2 || !turnSeat(s)))
    invalid();
  if (
    s.phase === 'place' &&
    s.movement !==
      s.placementRound -
        1 -
        (s.seats.length === 3 && s.placementRound > 1 ? 1 : 0)
  )
    invalid();
  if (
    (s.phase.startsWith('pilot-') ||
      s.phase === 'round-result' ||
      s.phase === 'ended') &&
    s.placementRound !== workerCount(s)
  )
    invalid();
  if (
    s.phase === 'plunder' &&
    (s.movement !== 3 || !s.plunderQueue.length || !turnSeat(s))
  )
    invalid();
  const settled = s.phase === 'round-result' || s.phase === 'ended';
  if (
    settled !== (s.result !== null) ||
    (settled &&
      (s.movement !== 3 ||
        s.boats.some((b) => b.destination === 'sea') ||
        s.plunderQueue.length))
  )
    invalid();
  if (s.result) {
    const r = s.result;
    if (
      !exact(r, [
        'voyage',
        'income',
        'port',
        'shipyard',
        'plundered',
        'dice',
      ]) ||
      r.voyage !== s.voyage ||
      !recordSigned(r.income, s.seats) ||
      JSON.stringify(r.port) !==
        JSON.stringify(
          s.boats.filter((b) => b.destination === 'port').map((b) => b.cargo),
        ) ||
      JSON.stringify(r.shipyard) !==
        JSON.stringify(
          s.boats
            .filter((b) => b.destination === 'shipyard')
            .map((b) => b.cargo),
        ) ||
      JSON.stringify(r.plundered) !==
        JSON.stringify(
          s.boats.filter((b) => b.plundered).map((b) => b.cargo),
        ) ||
      JSON.stringify(r.dice) !== JSON.stringify(s.dice)
    )
      invalid();
  }
  const reachedEnd = Object.values(s.market).includes(30);
  if (
    (s.phase === 'ended') !== reachedEnd ||
    (s.phase === 'ended'
      ? JSON.stringify(s.scores) !== JSON.stringify(finalScores(s)) ||
        JSON.stringify(s.winners) !==
          JSON.stringify(resolveWinners(finalScores(s), s.seats))
      : s.scores !== null || s.winners.length !== 0)
  )
    invalid();
  return structuredClone(s);
}
function recordSigned(x: unknown, keys: readonly string[]): boolean {
  return (
    exact(x, [...keys]) &&
    Object.values(x).every((v) => Number.isSafeInteger(v))
  );
}
