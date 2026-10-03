import { describe, expect, it } from 'vitest';
import { ARTISTS, CARDS, CARD_IDS, getCard } from '../data/catalog';
import type { Action, ArtistId, AuctionKind, ModernArtView } from '../ui/view';
import { rules, decisions } from './index';
import { countCards, emptyNumbers, prices, rankArtists } from './scoring';
import { validateState, type State } from './state';
import { RandomSource } from '../../../packages/platform-core/src/random';

type Spec = [ArtistId, AuctionKind?];
function fixture(hands: Spec[][], collections: Spec[][] = []): State {
  const seats = hands.map((_, index) => `S${index + 1}`);
  const s = rules.initialize({ seats, random: new RandomSource(1) }) as State;
  const available = [...CARDS];
  const allocate = ([artist, kind]: Spec) => {
    const index = available.findIndex(
      (card) =>
        card.artistId === artist && (!kind || card.auctionKind === kind),
    );
    if (index < 0) throw new Error('Fixture card exhausted');
    return available.splice(index, 1)[0]!.id;
  };
  s.hands = Object.fromEntries(
    seats.map((seat, index) => [seat, hands[index]!.map(allocate)]),
  );
  s.collections = Object.fromEntries(
    seats.map((seat, index) => [
      seat,
      (collections[index] ?? []).map(allocate),
    ]),
  );
  s.deck = available.map((card) => card.id);
  s.played = countCards(Object.values(s.collections).flat());
  return validateState(s, seats);
}
function apply(s: State, action: Action, seat: string): State {
  const before = structuredClone(s);
  const state = rules.apply(s, action, seat, {
    seats: s.seatOrder,
    random: new RandomSource(3),
  }).state as State;
  expect(s).toEqual(before);
  expect(validateState(JSON.parse(JSON.stringify(state)), s.seatOrder)).toEqual(
    state,
  );
  return state;
}
function offer(s: State) {
  return apply(s, { type: 'offer', cardId: s.hands.S1![0]! }, 'S1');
}
function view(s: State, seat?: string) {
  return rules.project(
    s,
    seat ? { role: 'player', seatId: seat } : { role: 'public' },
  ) as ModernArtView;
}
const filler: Spec[] = [['rafael', 'open']];

describe('Modern Art risk boundaries', () => {
  it('has the adopted 70-card distribution and correct initial deals', () => {
    expect(CARD_IDS.length).toBe(70);
    expect(new Set(CARD_IDS).size).toBe(70);
    for (const artist of ARTISTS)
      expect(CARDS.filter((card) => card.artistId === artist.id)).toHaveLength(
        artist.cardCount,
      );
    for (const count of [3, 4, 5]) {
      const seats = Array.from({ length: count }, (_, i) => `S${i}`);
      const s = validateState(
        rules.initialize({ seats, random: new RandomSource(5) }),
        seats,
      );
      expect(
        Object.values(s.hands).every(
          (hand) =>
            hand.length ===
            ({ 3: 10, 4: 9, 5: 8 } as Record<number, number>)[count],
        ),
      ).toBe(true);
      expect(s.deck).toHaveLength(
        70 - count * ({ 3: 10, 4: 9, 5: 8 } as Record<number, number>)[count]!,
      );
    }
  });
  it('ends immediately when a double first card is the fifth; no second card is consumed', () => {
    let s = fixture(
      [
        [
          ['manuel', 'double'],
          ['manuel', 'open'],
        ],
        filler,
        filler,
      ],
      [[], [['manuel'], ['manuel'], ['manuel'], ['manuel']]],
    );
    const second = s.hands.S1![1]!;
    s = offer(s);
    expect(s.phase).toBe('round-result');
    expect(s.results[0]!.unsold).toHaveLength(1);
    expect(s.hands.S1).toContain(second);
    expect(s.results[0]!.income.S2).toBe(120);
  });
  it('counts both double cards but sells neither when the second is fifth', () => {
    let s = fixture(
      [
        [
          ['manuel', 'double'],
          ['manuel', 'open'],
        ],
        filler,
        filler,
      ],
      [[], [['manuel'], ['manuel'], ['manuel']]],
    );
    s = offer(s);
    expect(s.phase).toBe('double');
    s = apply(s, { type: 'add-double', cardId: s.hands.S1![0]! }, 'S1');
    expect(s.results[0]!.unsold).toHaveLength(2);
    expect(s.results[0]!.counts.manuel).toBe(5);
    expect(s.results[0]!.income.S2).toBe(90);
    expect(s.cash.S1).toBe(100);
  });
  it('changes auctioneer and skips intermediate auction opportunities after a second player joins', () => {
    let s = offer(
      fixture([[['manuel', 'double']], filler, [['manuel', 'once']], filler]),
    );
    s = apply(s, { type: 'decline-double' }, 'S1');
    s = apply(s, { type: 'decline-double' }, 'S2');
    s = apply(s, { type: 'add-double', cardId: s.hands.S3![0]! }, 'S3');
    expect(s.auction!.seller).toBe('S3');
    expect(s.auction!.queue).toEqual(['S4', 'S1', 'S2', 'S3']);
    s = apply(s, { type: 'bid', amount: 11 }, 'S4');
    for (const seat of ['S1', 'S2', 'S3']) s = apply(s, { type: 'pass' }, seat);
    expect(s.cash.S3).toBe(111);
    expect(s.cash.S1).toBe(100);
    expect(s.collections.S4).toHaveLength(2);
    expect(s.turnSeat).toBe('S4');
  });
  it('pays other sellers, while self purchases pay the bank', () => {
    let s = offer(
      fixture([
        [
          ['manuel', 'once'],
          ['daniel', 'open'],
        ],
        filler,
        filler,
      ]),
    );
    s = apply(s, { type: 'bid', amount: 17 }, 'S2');
    s = apply(s, { type: 'pass' }, 'S3');
    s = apply(s, { type: 'pass' }, 'S1');
    expect(s.cash).toEqual({ S1: 117, S2: 83, S3: 100 });
    let own = offer(
      fixture([
        [
          ['manuel', 'once'],
          ['daniel', 'open'],
        ],
        filler,
        filler,
      ]),
    );
    own = apply(own, { type: 'pass' }, 'S2');
    own = apply(own, { type: 'pass' }, 'S3');
    own = apply(own, { type: 'bid', amount: 9 }, 'S1');
    expect(own.cash).toEqual({ S1: 91, S2: 100, S3: 100 });
  });
  it('resets confirmations after an open raise and supports free unsold auctions', () => {
    let s = offer(
      fixture([
        [
          ['manuel', 'open'],
          ['daniel', 'once'],
        ],
        filler,
        filler,
      ]),
    );
    s = apply(s, { type: 'pass' }, 'S1');
    s = apply(s, { type: 'bid', amount: 10 }, 'S2');
    expect(s.auction!.passes).toEqual([]);
    expect(decisions(s).map((d) => d.seatId)).toEqual(['S1', 'S3']);
    s = apply(s, { type: 'pass' }, 'S1');
    s = apply(s, { type: 'bid', amount: 12 }, 'S3');
    expect(s.auction!.passes).toEqual([]);
    s = apply(s, { type: 'pass' }, 'S1');
    s = apply(s, { type: 'pass' }, 'S2');
    expect(s.collections.S3).toHaveLength(1);
    expect(s.cash.S3).toBe(88);
    let free = offer(
      fixture([
        [
          ['manuel', 'open'],
          ['daniel', 'once'],
        ],
        filler,
        filler,
      ]),
    );
    for (const seat of ['S1', 'S2', 'S3'])
      free = apply(free, { type: 'pass' }, seat);
    expect(free.collections.S1).toHaveLength(1);
    expect(free.cash.S1).toBe(100);
  });
  it('keeps sealed amounts secret, stable decisions, and resolves simultaneous ties correctly', () => {
    const base = offer(
      fixture([
        [
          ['manuel', 'sealed'],
          ['daniel', 'once'],
        ],
        filler,
        filler,
      ]),
    );
    const before = decisions(base);
    let s = apply(base, { type: 'sealed-bid', amount: 37 }, 'S2');
    expect(decisions(s).find((d) => d.seatId === 'S3')).toEqual(
      before.find((d) => d.seatId === 'S3'),
    );
    expect(view(s).self).toBeNull();
    expect(view(s).auction!.submitted).toEqual(['S2']);
    expect(JSON.stringify(view(s))).not.toContain('37');
    expect(view(s, 'S3').self!.sealedBid).toBeNull();
    expect(view(s, 'S2').self!.sealedBid).toBe(37);
    s = apply(s, { type: 'sealed-bid', amount: 37 }, 'S3');
    s = apply(s, { type: 'sealed-bid', amount: 37 }, 'S1');
    expect(s.collections.S1).toHaveLength(1);
    expect(s.cash.S1).toBe(63);
    expect(view(s).history.at(-1)!.sealedBids).toEqual({
      S2: 37,
      S3: 37,
      S1: 37,
    });
    let other = apply(base, { type: 'sealed-bid', amount: 0 }, 'S1');
    other = apply(other, { type: 'sealed-bid', amount: 5 }, 'S3');
    other = apply(other, { type: 'sealed-bid', amount: 5 }, 'S2');
    expect(other.collections.S2).toHaveLength(1);
    let zero = base;
    for (const seat of ['S3', 'S1', 'S2'])
      zero = apply(zero, { type: 'sealed-bid', amount: 0 }, seat);
    expect(zero.collections.S1).toHaveLength(1);
    expect(zero.cash.S1).toBe(100);
  });
  it('handles forced fixed-price self purchase and the adopted zero price', () => {
    let s = offer(
      fixture([
        [
          ['manuel', 'fixed'],
          ['daniel', 'once'],
        ],
        filler,
        filler,
      ]),
    );
    s = apply(s, { type: 'set-price', amount: 25 }, 'S1');
    s = apply(s, { type: 'pass' }, 'S2');
    s = apply(s, { type: 'pass' }, 'S3');
    expect(s.cash.S1).toBe(75);
    let zero = fixture([
      [
        ['manuel', 'fixed'],
        ['daniel', 'once'],
      ],
      filler,
      filler,
    ]);
    zero.cash.S1 = 0;
    zero = offer(zero);
    zero = apply(zero, { type: 'set-price', amount: 0 }, 'S1');
    zero = apply(zero, { type: 'buy' }, 'S2');
    expect(zero.cash.S1).toBe(0);
    expect(zero.collections.S2).toHaveLength(1);
  });
  it('ranks only played artists, resolves board-order ties and preserves dormant historical values', () => {
    const counts = emptyNumbers();
    counts.manuel = 3;
    counts.sigrid = 3;
    counts.daniel = 5;
    counts.ramon = 3;
    expect(rankArtists(counts)).toEqual([
      'daniel',
      'manuel',
      'sigrid',
      'ramon',
    ]);
    const history = {
      manuel: [30],
      sigrid: [20],
      daniel: [0],
      ramon: [10],
      rafael: [0],
    };
    expect(prices(counts, history)).toEqual({
      manuel: 50,
      sigrid: 30,
      daniel: 30,
      ramon: 0,
      rafael: 0,
    });
    counts.ramon = 4;
    expect(prices(counts, history).ramon).toBe(30);
    expect(history.ramon).toEqual([10]);
    expect(rankArtists({ ...emptyNumbers(), rafael: 5 })).toEqual(['rafael']);
  });
  it('skips empty-handed auctioneers, and does not sell the final card on exhaustion', () => {
    let s = offer(fixture([[['manuel', 'once']], [], filler]));
    for (const seat of ['S2', 'S3', 'S1']) s = apply(s, { type: 'pass' }, seat);
    expect(s.turnSeat).toBe('S3');
    let end = fixture([[['manuel', 'double']], [], []]);
    end = offer(end);
    expect(end.phase).toBe('ended');
    expect(end.results[0]!.reason).toBe('exhausted');
    expect(end.results[0]!.unsold).toHaveLength(1);
    expect(end.winners).toEqual(['S1', 'S2', 'S3']);
    expect(view(end).finalCash).toEqual({ S1: 100, S2: 100, S3: 100 });
  });
  it('ends when the fifth card also exhausts all hands, or the final double pair exhausts them', () => {
    const fifth = offer(
      fixture(
        [[['manuel', 'open']], [], []],
        [[], [['manuel'], ['manuel'], ['manuel'], ['manuel']]],
      ),
    );
    expect(fifth.phase).toBe('ended');
    expect(fifth.results[0]!.reason).toBe('fifth-card');
    expect(fifth.cash.S2).toBe(220);
    expect(fifth.winners).toEqual(['S2']);
    let pair = offer(
      fixture([
        [
          ['manuel', 'double'],
          ['manuel', 'open'],
        ],
        [],
        [],
      ]),
    );
    pair = apply(
      pair,
      { type: 'add-double', cardId: pair.hands.S1![0]! },
      'S1',
    );
    expect(pair.phase).toBe('ended');
    expect(pair.results[0]!.reason).toBe('exhausted');
    expect(pair.results[0]!.unsold).toHaveLength(2);
    expect(pair.results[0]!.counts.manuel).toBe(2);
    expect(pair.winners).toEqual(['S1', 'S2', 'S3']);
  });
  it('rejects impossible restored auction positions and money creation', () => {
    const fixed = offer(fixture([[['manuel', 'fixed']], filler, filler]));
    const skipped = structuredClone(fixed);
    skipped.auction!.index = 1;
    expect(() => validateState(skipped, skipped.seatOrder)).toThrow();
    const once = offer(fixture([[['manuel', 'once']], filler, filler]));
    const premature = structuredClone(once);
    premature.auction!.highBidder = 'S1';
    premature.auction!.currentBid = 40;
    premature.auction!.bidRevision = 1;
    expect(() => validateState(premature, premature.seatOrder)).toThrow();
    const bid = apply(once, { type: 'bid', amount: 4 }, 'S2');
    const future = structuredClone(bid);
    future.auction!.highBidder = 'S3';
    expect(() => validateState(future, future.seatOrder)).toThrow();
    for (const revision of [0, 5]) {
      const invalidRevision = structuredClone(bid);
      invalidRevision.auction!.bidRevision = revision;
      expect(() =>
        validateState(invalidRevision, invalidRevision.seatOrder),
      ).toThrow();
    }
    const double = offer(fixture([[['manuel', 'double']], filler, filler]));
    double.auction!.bidRevision = 1;
    expect(() => validateState(double, double.seatOrder)).toThrow();
    for (const kind of ['sealed', 'open'] as const) {
      const s = offer(fixture([[['manuel', kind]], filler, filler]));
      s.auction!.index = 1;
      expect(() => validateState(s, s.seatOrder)).toThrow();
    }
    const rich = structuredClone(once);
    rich.cash.S1 = 101;
    expect(() => validateState(rich, rich.seatOrder)).toThrow();
  });
  it('requires the unsold fifth card to belong to the artist ending the round', () => {
    const s = offer(
      fixture(
        [[['manuel', 'open']], filler, filler],
        [[], [['manuel'], ['manuel'], ['manuel'], ['manuel'], ['sigrid']]],
      ),
    );
    const damaged = structuredClone(s);
    const result = damaged.results[0]!;
    const other = result.paintings.S2!.find(
      (id) => getCard(id).artistId === 'sigrid',
    )!;
    result.paintings.S2 = result.paintings
      .S2!.filter((id) => id !== other)
      .concat(result.unsold);
    result.unsold = [other];
    result.income.S2 = result.paintings.S2.reduce(
      (sum, id) => sum + result.values[getCard(id).artistId],
      0,
    );
    damaged.discard = [
      ...damaged.seatOrder.flatMap((seat) => result.paintings[seat]!),
      ...result.unsold,
    ];
    expect(() => validateState(damaged, damaged.seatOrder)).toThrow();
  });
  it('rejects malformed, oversized, stale and unauthorized actions without mutation', () => {
    const s = offer(
      fixture([
        [
          ['manuel', 'once'],
          ['daniel', 'open'],
        ],
        filler,
        filler,
      ]),
    );
    const before = structuredClone(s);
    for (const [action, seat] of [
      [{ type: 'bid', amount: 101 }, 'S2'],
      [{ type: 'bid', amount: 0 }, 'S2'],
      [{ type: 'bid', amount: 1 }, 'S1'],
      [{ type: 'buy' }, 'S2'],
      [{ type: 'bid', amount: 1, actor: 'S2' }, 'S2'],
      [{ type: 'bid', amount: 1.5 }, 'S2'],
      [{ type: 'pass' }, 'unknown'],
    ] as const)
      expect(() =>
        rules.apply(s, action, seat, {
          seats: s.seatOrder,
          random: new RandomSource(1),
        }),
      ).toThrow();
    expect(s).toEqual(before);
    const wrong = structuredClone(s);
    wrong.deck[0] = wrong.hands.S1![0]!;
    expect(() => validateState(wrong, s.seatOrder)).toThrow();
    const negative = structuredClone(s);
    negative.cash.S1 = -1;
    expect(() => validateState(negative, s.seatOrder)).toThrow();
    expect(() => validateState(s, [...s.seatOrder].reverse())).toThrow();
    const mismatch = structuredClone(s);
    mismatch.auction!.kind = 'fixed';
    expect(() => validateState(mismatch, s.seatOrder)).toThrow();
    const badPhase = structuredClone(s);
    badPhase.phase = 'double';
    expect(() => validateState(badPhase, s.seatOrder)).toThrow();
  });
  it('settles double round boundaries from the last actual contributor and keeps the old hands', () => {
    let s = fixture(
      [
        [['manuel', 'double']],
        filler,
        [
          ['manuel', 'open'],
          ['daniel', 'open'],
        ],
      ],
      [[], [['manuel'], ['manuel'], ['manuel']]],
    );
    s = offer(s);
    s = apply(s, { type: 'decline-double' }, 'S1');
    s = apply(s, { type: 'decline-double' }, 'S2');
    s = apply(s, { type: 'add-double', cardId: s.hands.S3![0]! }, 'S3');
    expect(s.nextSeat).toBe('S1');
    const old = s.hands.S3![0]!;
    const next = rules.applyLifecycle(
      s,
      { type: 'next-round' },
      { seats: s.seatOrder, random: new RandomSource(4) },
    ).state as State;
    expect(validateState(next, next.seatOrder)).toEqual(next);
    expect(next.turnSeat).toBe('S1');
    expect(next.hands.S3).toContain(old);
    expect(next.hands.S3).toHaveLength(7);
    const broken = structuredClone(s);
    broken.results[0]!.income.S2!++;
    expect(() => validateState(broken, s.seatOrder)).toThrow();
    const history = structuredClone(s);
    history.values.manuel[0] = 20;
    expect(() => validateState(history, s.seatOrder)).toThrow();
  });
});

export { fixture, getCard };
