import { ARTISTS, CARD_IDS, getCard } from '../data/catalog';
import type {
  ArtistId,
  ArtistNumbers,
  AuctionKind,
  ModernArtLog,
  Phase,
} from '../ui/view';
import {
  countCards,
  increments,
  income,
  prices,
  rankArtists,
  winners,
} from './scoring';

export { RULES_VERSION } from '../data/catalog';
import { RULES_VERSION } from '../data/catalog';
// At most 70 cards pay 120, plus the five players' initial 100 each.
export const MAX_CASH = 8900;
export type AuctionState = {
  id: string;
  kind: AuctionKind;
  cards: string[];
  seller: string;
  originalSeller: string;
  currentBid: number;
  highBidder: string | null;
  fixedPrice: number | null;
  passes: string[];
  sealedBids: Record<string, number>;
  queue: string[];
  index: number;
  bidRevision: number;
};
export type RoundResult = {
  round: number;
  ranking: ArtistId[];
  counts: ArtistNumbers;
  increments: ArtistNumbers;
  values: ArtistNumbers;
  income: Record<string, number>;
  paintings: Record<string, string[]>;
  unsold: string[];
  reason: 'fifth-card' | 'exhausted';
};
export type State = {
  gameId: 'modern-art';
  rulesVersion: string;
  stateVersion: 1;
  seatOrder: string[];
  round: number;
  phase: Phase;
  turnSeat: string | null;
  nextSeat: string;
  hands: Record<string, string[]>;
  cash: Record<string, number>;
  collections: Record<string, string[]>;
  deck: string[];
  discard: string[];
  played: ArtistNumbers;
  values: Record<ArtistId, number[]>;
  auction: AuctionState | null;
  auctionSerial: number;
  step: number;
  logSerial: number;
  history: ModernArtLog[];
  results: RoundResult[];
  winners: string[];
};
export function clockwise(seats: readonly string[], start: string): string[] {
  const index = seats.indexOf(start);
  return Array.from(
    { length: seats.length },
    (_, offset) => seats[(index + offset) % seats.length]!,
  );
}
export function actingSeats(state: State): string[] {
  const a = state.auction;
  if (state.phase === 'offer') return state.turnSeat ? [state.turnSeat] : [];
  if (!a || !['auction', 'double'].includes(state.phase)) return [];
  if (state.phase === 'double') return [a.queue[a.index]!];
  if (a.kind === 'sealed')
    return state.seatOrder.filter((seat) => !(seat in a.sealedBids));
  if (a.kind === 'open')
    return state.seatOrder.filter(
      (seat) => seat !== a.highBidder && !a.passes.includes(seat),
    );
  if (a.kind === 'fixed' && a.fixedPrice === null) return [a.seller];
  return [a.queue[a.index]!];
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = MAX_CASH): value is number =>
  Number.isSafeInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max;
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((x) => typeof x === 'string');
const keys = (value: unknown, expected: readonly string[]) =>
  record(value) && equal(Object.keys(value).sort(), [...expected].sort());
function numbers(value: unknown, max: number) {
  return (
    keys(
      value,
      ARTISTS.map((x) => x.id),
    ) &&
    Object.values(value as Record<string, unknown>).every((x) =>
      integer(x, 0, max),
    )
  );
}
function seatCards(value: unknown, seats: readonly string[]) {
  return (
    keys(value, seats) &&
    Object.values(value as Record<string, unknown>).every(
      (x) => strings(x) && x.every((id) => CARD_IDS.includes(id)),
    )
  );
}
function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new Error('现代艺术存档状态无效。');
}
export function validateState(input: unknown, seats: readonly string[]): State {
  requireValid(record(input));
  const s = input as State;
  requireValid(
    keys(s, [
      'gameId',
      'rulesVersion',
      'stateVersion',
      'seatOrder',
      'round',
      'phase',
      'turnSeat',
      'nextSeat',
      'hands',
      'cash',
      'collections',
      'deck',
      'discard',
      'played',
      'values',
      'auction',
      'auctionSerial',
      'step',
      'logSerial',
      'history',
      'results',
      'winners',
    ]),
  );
  requireValid(
    s.gameId === 'modern-art' &&
      s.rulesVersion === RULES_VERSION &&
      s.stateVersion === 1,
  );
  requireValid(
    strings(s.seatOrder) &&
      s.seatOrder.length >= 3 &&
      s.seatOrder.length <= 5 &&
      new Set(s.seatOrder).size === s.seatOrder.length &&
      equal(s.seatOrder, seats),
  );
  requireValid(
    integer(s.round, 1, 4) &&
      ['offer', 'double', 'auction', 'round-result', 'ended'].includes(
        s.phase,
      ) &&
      seats.includes(s.nextSeat),
  );
  requireValid(
    seatCards(s.hands, seats) &&
      seatCards(s.collections, seats) &&
      keys(s.cash, seats) &&
      Object.values(s.cash).every((x) => integer(x)),
  );
  requireValid(
    strings(s.deck) &&
      strings(s.discard) &&
      numbers(s.played, 5) &&
      keys(
        s.values,
        ARTISTS.map((x) => x.id),
      ),
  );
  requireValid(
    integer(s.auctionSerial, 0, 70) &&
      integer(s.step, 0, 1000000) &&
      integer(s.logSerial, 0, 2000000),
  );
  requireValid(
    Array.isArray(s.results) &&
      s.results.length <= 4 &&
      Array.isArray(s.history) &&
      s.history.length <= 60 &&
      strings(s.winners),
  );
  const history = Object.fromEntries(
    ARTISTS.map(({ id }) => [id, [] as number[]]),
  ) as Record<ArtistId, number[]>;
  const discarded: string[] = [];
  for (const [index, result] of s.results.entries()) {
    requireValid(
      record(result) &&
        keys(result, [
          'round',
          'ranking',
          'counts',
          'increments',
          'values',
          'income',
          'paintings',
          'unsold',
          'reason',
        ]) &&
        result.round === index + 1 &&
        ['fifth-card', 'exhausted'].includes(result.reason),
    );
    requireValid(
      seatCards(result.paintings, seats) &&
        strings(result.unsold) &&
        result.unsold.length >= 1 &&
        result.unsold.length <= 2,
    );
    const cards = [
      ...seats.flatMap((seat) => result.paintings[seat]!),
      ...result.unsold,
    ];
    requireValid(
      cards.every((id) => CARD_IDS.includes(id)) &&
        new Set(cards).size === cards.length,
    );
    const counts = countCards(cards);
    requireValid(
      numbers(result.counts, 5) &&
        equal(result.counts, counts) &&
        equal(result.ranking, rankArtists(counts)) &&
        equal(result.increments, increments(counts)) &&
        equal(result.values, prices(counts, history)),
    );
    requireValid(
      keys(result.income, seats) &&
        seats.every(
          (seat) =>
            result.income[seat] ===
            income(result.paintings[seat]!, result.values),
        ),
    );
    requireValid(
      result.reason === 'fifth-card'
        ? Object.values(counts).filter((x) => x === 5).length === 1 &&
            counts[getCard(result.unsold.at(-1)!).artistId] === 5
        : Math.max(...Object.values(counts)) < 5 &&
            index === s.results.length - 1 &&
            s.phase === 'ended',
    );
    if (result.unsold.length === 2)
      requireValid(
        getCard(result.unsold[0]!).auctionKind === 'double' &&
          getCard(result.unsold[1]!).auctionKind !== 'double' &&
          getCard(result.unsold[0]!).artistId ===
            getCard(result.unsold[1]!).artistId,
      );
    for (const { id } of ARTISTS) history[id].push(result.increments[id]);
    discarded.push(...cards);
  }
  requireValid(equal(s.values, history) && equal(s.discard, discarded));
  // Sales only transfer money, and self purchases remove it to the bank.
  const issuedCash =
    100 * seats.length +
    s.results.reduce(
      (total, result) =>
        total + Object.values(result.income).reduce((a, b) => a + b, 0),
      0,
    );
  requireValid(Object.values(s.cash).reduce((a, b) => a + b, 0) <= issuedCash);
  const resultPhase = s.phase === 'round-result' || s.phase === 'ended';
  requireValid(s.round === s.results.length + (resultPhase ? 0 : 1));
  if (resultPhase) {
    requireValid(
      s.auction === null &&
        s.turnSeat === null &&
        Object.values(s.collections).every((cards) => cards.length === 0) &&
        equal(s.played, s.results.at(-1)!.counts),
    );
    requireValid(
      s.phase === 'ended'
        ? s.round === 4 ||
            s.results.at(-1)!.reason === 'exhausted' ||
            Object.values(s.hands).every((cards) => cards.length === 0)
        : s.round < 4 && s.results.at(-1)!.reason === 'fifth-card',
    );
    if (s.results.at(-1)!.reason === 'exhausted')
      requireValid(Object.values(s.hands).every((cards) => cards.length === 0));
  } else {
    requireValid(typeof s.turnSeat === 'string' && seats.includes(s.turnSeat));
    requireValid(Object.values(s.hands).some((cards) => cards.length > 0));
    if (s.phase === 'offer')
      requireValid(s.auction === null && s.hands[s.turnSeat]!.length > 0);
    else {
      const a = s.auction;
      requireValid(
        record(a) &&
          keys(a, [
            'id',
            'kind',
            'cards',
            'seller',
            'originalSeller',
            'currentBid',
            'highBidder',
            'fixedPrice',
            'passes',
            'sealedBids',
            'queue',
            'index',
            'bidRevision',
          ]),
      );
      requireValid(
        a.id === `r${s.round}-a${s.auctionSerial}` &&
          s.auctionSerial > 0 &&
          ['open', 'once', 'sealed', 'fixed', 'double'].includes(a.kind) &&
          seats.includes(a.seller) &&
          seats.includes(a.originalSeller) &&
          s.turnSeat === a.seller,
      );
      requireValid(
        strings(a.cards) &&
          a.cards.length >= 1 &&
          a.cards.length <= 2 &&
          a.cards.every((id) => CARD_IDS.includes(id)),
      );
      if (a.cards.length === 2)
        requireValid(
          getCard(a.cards[0]!).auctionKind === 'double' &&
            getCard(a.cards[1]!).artistId === getCard(a.cards[0]!).artistId &&
            getCard(a.cards[1]!).auctionKind === a.kind &&
            a.kind !== 'double',
        );
      else
        requireValid(
          getCard(a.cards[0]!).auctionKind === a.kind &&
            a.seller === a.originalSeller,
        );
      requireValid(
        integer(a.currentBid) &&
          (a.highBidder === null || seats.includes(a.highBidder)) &&
          strings(a.passes) &&
          new Set(a.passes).size === a.passes.length &&
          a.passes.every((seat) => seats.includes(seat)),
      );
      requireValid(
        record(a.sealedBids) &&
          Object.entries(a.sealedBids).every(
            ([seat, value]) =>
              seats.includes(seat) && integer(value) && value <= s.cash[seat]!,
          ),
      );
      requireValid(
        strings(a.queue) &&
          integer(a.index, 0, seats.length - 1) &&
          integer(a.bidRevision, 0, MAX_CASH),
      );
      if (s.phase === 'double')
        requireValid(
          a.kind === 'double' &&
            equal(a.queue, clockwise(seats, a.seller)) &&
            a.currentBid === 0 &&
            a.highBidder === null &&
            a.fixedPrice === null &&
            a.passes.length === 0 &&
            a.bidRevision === 0 &&
            Object.keys(a.sealedBids).length === 0,
        );
      else {
        requireValid(a.kind !== 'double');
        if (a.kind === 'open' || a.kind === 'once')
          requireValid(
            a.currentBid === 0
              ? a.highBidder === null && a.bidRevision === 0
              : a.highBidder !== null &&
                  a.currentBid <= s.cash[a.highBidder]! &&
                  a.bidRevision > 0 &&
                  a.bidRevision <= a.currentBid,
          );
        else
          requireValid(
            a.currentBid === 0 &&
              a.highBidder === null &&
              a.passes.length === 0 &&
              a.bidRevision === 0,
          );
        requireValid(
          a.kind === 'sealed'
            ? Object.keys(a.sealedBids).length < seats.length
            : Object.keys(a.sealedBids).length === 0,
        );
        requireValid(
          a.kind === 'fixed'
            ? a.fixedPrice === null ||
                (integer(a.fixedPrice) && a.fixedPrice <= s.cash[a.seller]!)
            : a.fixedPrice === null,
        );
        const cycle = clockwise(seats, a.seller);
        requireValid(
          equal(
            a.queue,
            a.kind === 'once'
              ? [...cycle.slice(1), a.seller]
              : a.kind === 'fixed'
                ? cycle.slice(1)
                : [],
          ),
        );
        if (a.kind === 'fixed')
          requireValid(
            a.index < seats.length - 1 &&
              (a.fixedPrice !== null || a.index === 0),
          );
        if (a.kind === 'once')
          requireValid(
            a.passes.length === 0 &&
              a.bidRevision <= a.index &&
              (a.highBidder === null ||
                a.queue.slice(0, a.index).includes(a.highBidder)),
          );
        if (a.kind === 'open' || a.kind === 'sealed')
          requireValid(a.index === 0);
        if (a.kind === 'open')
          requireValid(
            !a.passes.includes(a.highBidder ?? '') && actingSeats(s).length > 0,
          );
      }
    }
    const counts = countCards([
      ...Object.values(s.collections).flat(),
      ...(s.auction?.cards ?? []),
    ]);
    requireValid(
      equal(s.played, counts) && Math.max(...Object.values(counts)) < 5,
    );
  }
  const partition = [
    ...s.deck,
    ...s.discard,
    ...Object.values(s.hands).flat(),
    ...Object.values(s.collections).flat(),
    ...(s.auction?.cards ?? []),
  ];
  requireValid(
    partition.length === 70 &&
      new Set(partition).size === 70 &&
      partition.every((id) => CARD_IDS.includes(id)),
  );
  requireValid(
    equal(s.winners, s.phase === 'ended' ? winners(s.cash, seats) : []),
  );
  let previousLog = 0;
  for (const log of s.history) {
    requireValid(
      record(log) &&
        keys(log, [
          'id',
          'actor',
          'verb',
          'cards',
          'amount',
          'winner',
          'sealedBids',
          'text',
        ]) &&
        typeof log.id === 'string' &&
        /^log-\d+$/.test(log.id),
    );
    const serial = Number(log.id.slice(4));
    requireValid(integer(serial, previousLog + 1, s.logSerial));
    previousLog = serial;
    requireValid(
      (log.actor === null || seats.includes(log.actor)) &&
        (log.winner === null || seats.includes(log.winner)) &&
        typeof log.verb === 'string' &&
        typeof log.text === 'string' &&
        log.text.length <= 1000 &&
        Array.isArray(log.cards) &&
        log.cards.every(
          (face) =>
            record(face) &&
            CARD_IDS.includes(face.id) &&
            equal(face, getCard(face.id)),
        ) &&
        (log.amount === null || integer(log.amount)),
    );
    requireValid(
      log.sealedBids === null ||
        (keys(log.sealedBids, seats) &&
          Object.values(log.sealedBids).every((x) => integer(x)) &&
          log.verb === 'sale'),
    );
    if (log.verb === 'sealed-submit')
      requireValid(log.amount === null && log.sealedBids === null);
  }
  requireValid(
    s.history.length ? previousLog === s.logSerial : s.logSerial === 0,
  );
  return structuredClone(s);
}
