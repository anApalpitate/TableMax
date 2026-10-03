import type { RuleContext } from '../../../packages/game-sdk/src';
import { ARTISTS, CARD_IDS, getCard, getArtist } from '../data/catalog';
import type { Action, ArtistId, ModernArtLog } from '../ui/view';
import { actingSeats, clockwise, RULES_VERSION, type State } from './state';
import {
  emptyNumbers,
  increments,
  income,
  prices,
  rankArtists,
  winners,
} from './scoring';

export function log(state: State, entry: Omit<ModernArtLog, 'id'>) {
  state.history.push({ id: `log-${++state.logSerial}`, ...entry });
  state.history = state.history.slice(-60);
}
export function note(
  state: State,
  actor: string | null,
  verb: string,
  text: string,
  cards: readonly string[] = [],
  amount: number | null = null,
) {
  log(state, {
    actor,
    verb,
    text,
    cards: cards.map(getCard),
    amount,
    winner: null,
    sealedBids: null,
  });
}
export function deal(state: State) {
  const counts =
    state.seatOrder.length === 3
      ? [10, 6, 6, 0]
      : state.seatOrder.length === 4
        ? [9, 4, 4, 0]
        : [8, 3, 3, 0];
  for (let index = 0; index < counts[state.round - 1]!; index++)
    for (const seat of state.seatOrder) {
      const card = state.deck.pop();
      if (!card) throw new Error('发牌牌库不足。');
      state.hands[seat]!.push(card);
    }
}
export function initialize(context: RuleContext): State {
  if (
    context.seats.length < 3 ||
    context.seats.length > 5 ||
    new Set(context.seats).size !== context.seats.length
  )
    throw new Error('现代艺术需要 3–5 位玩家。');
  const deck = [...CARD_IDS];
  for (let index = deck.length - 1; index > 0; index--) {
    const roll = context.random.next();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1)
      throw new Error('随机源无效。');
    const swap = Math.floor(roll * (index + 1));
    [deck[index], deck[swap]] = [deck[swap]!, deck[index]!];
  }
  const state: State = {
    gameId: 'modern-art',
    rulesVersion: RULES_VERSION,
    stateVersion: 1,
    seatOrder: [...context.seats],
    round: 1,
    phase: 'offer',
    turnSeat: context.seats[0]!,
    nextSeat: context.seats[0]!,
    hands: Object.fromEntries(context.seats.map((seat) => [seat, []])),
    cash: Object.fromEntries(context.seats.map((seat) => [seat, 100])),
    collections: Object.fromEntries(context.seats.map((seat) => [seat, []])),
    deck,
    discard: [],
    played: emptyNumbers(),
    values: Object.fromEntries(
      ARTISTS.map(({ id }) => [id, [] as number[]]),
    ) as Record<ArtistId, number[]>,
    auction: null,
    auctionSerial: 0,
    step: 0,
    logSerial: 0,
    history: [],
    results: [],
    winners: [],
  };
  deal(state);
  note(state, null, 'deal', '第一轮画作已发到各自手机。');
  return state;
}

// Owns round boundaries, scoring and clockwise hand exhaustion. No UI timing.
export class MatchFlow {
  constructor(private readonly state: State) {}
  advance(seller: string) {
    const s = this.state;
    const next = clockwise(s.seatOrder, seller)
      .slice(1)
      .concat(seller)
      .find((seat) => s.hands[seat]!.length > 0);
    if (!next) throw new Error('空手边界未结算。');
    s.auction = null;
    s.phase = 'offer';
    s.turnSeat = next;
    s.nextSeat = next;
  }
  finishIfNeeded(): boolean {
    const s = this.state;
    const fifth = Object.values(s.played).some((count) => count === 5);
    const exhausted = s.seatOrder.every((seat) => s.hands[seat]!.length === 0);
    if (!fifth && !exhausted) return false;
    const a = s.auction!;
    const values = prices(s.played, s.values);
    const additions = increments(s.played);
    const earnings = Object.fromEntries(
      s.seatOrder.map((seat) => [seat, income(s.collections[seat]!, values)]),
    );
    const result = {
      round: s.round,
      ranking: rankArtists(s.played),
      counts: { ...s.played },
      increments: additions,
      values,
      income: earnings,
      paintings: structuredClone(s.collections),
      unsold: [...a.cards],
      reason: fifth ? ('fifth-card' as const) : ('exhausted' as const),
    };
    s.results.push(result);
    for (const { id } of ARTISTS) s.values[id].push(additions[id]);
    for (const seat of s.seatOrder) {
      s.cash[seat]! += earnings[seat]!;
      s.discard.push(...s.collections[seat]!);
      s.collections[seat] = [];
    }
    s.discard.push(...a.cards);
    s.nextSeat = clockwise(s.seatOrder, a.seller)[1]!;
    s.auction = null;
    s.turnSeat = null;
    s.phase = s.round === 4 || exhausted ? 'ended' : 'round-result';
    s.winners = s.phase === 'ended' ? winners(s.cash, s.seatOrder) : [];
    note(
      s,
      a.seller,
      'round-result',
      `第 ${s.round} 轮已结算，${fifth ? '第五幅画' : '最后的画作'}不成交。`,
      result.unsold,
    );
    return true;
  }
  nextRound() {
    const s = this.state;
    if (s.phase !== 'round-result') throw new Error('当前不能进入下一轮。');
    s.round++;
    s.played = emptyNumbers();
    deal(s);
    s.turnSeat = clockwise(s.seatOrder, s.nextSeat).find(
      (seat) => s.hands[seat]!.length > 0,
    )!;
    s.phase = 'offer';
    note(
      s,
      null,
      'deal',
      `第 ${s.round} 轮开始${s.round === 4 ? '，本轮不补牌' : '，新画作已加入各自手牌'}。`,
    );
  }
}

// A short lived controller modifies only the cloned state of one accepted intent.
export class AuctionFlow {
  private readonly match: MatchFlow;
  constructor(private readonly state: State) {
    this.match = new MatchFlow(state);
  }
  private take(seat: string, cardId: string) {
    const hand = this.state.hands[seat]!;
    const index = hand.indexOf(cardId);
    if (index < 0) throw new Error('画作不在本人手牌。');
    hand.splice(index, 1);
    this.state.played[getCard(cardId).artistId]++;
  }
  private configure() {
    const s = this.state;
    const a = s.auction!;
    const order = clockwise(s.seatOrder, a.seller);
    a.queue =
      a.kind === 'double'
        ? order
        : a.kind === 'once'
          ? [...order.slice(1), a.seller]
          : a.kind === 'fixed'
            ? order.slice(1)
            : [];
    a.index = 0;
    s.phase = a.kind === 'double' ? 'double' : 'auction';
  }
  private sell(winner: string, amount: number) {
    const s = this.state;
    const a = s.auction!;
    s.cash[winner]! -= amount;
    if (winner !== a.seller) s.cash[a.seller]! += amount;
    s.collections[winner]!.push(...a.cards);
    log(s, {
      actor: a.seller,
      verb: 'sale',
      text: `画作以 ${amount} 成交${winner === a.seller ? '，拍卖师向银行付款' : ''}。`,
      cards: a.cards.map(getCard),
      amount,
      winner,
      sealedBids: a.kind === 'sealed' ? { ...a.sealedBids } : null,
    });
    this.match.advance(a.seller);
  }
  private offer(seat: string, cardId: string) {
    const s = this.state;
    this.take(seat, cardId);
    const card = getCard(cardId);
    s.auction = {
      id: `r${s.round}-a${++s.auctionSerial}`,
      kind: card.auctionKind,
      cards: [cardId],
      seller: seat,
      originalSeller: seat,
      currentBid: 0,
      highBidder: null,
      fixedPrice: null,
      passes: [],
      sealedBids: {},
      queue: [],
      index: 0,
      bidRevision: 0,
    };
    note(
      s,
      seat,
      'offer',
      `出画：${getArtist(card.artistId).name} · ${card.title}。`,
      [cardId],
    );
    if (!this.match.finishIfNeeded()) this.configure();
  }
  apply(action: Action, seat: string) {
    const s = this.state;
    if (action.type === 'offer') {
      this.offer(seat, action.cardId);
      return;
    }
    const a = s.auction!;
    if (action.type === 'add-double') {
      this.take(seat, action.cardId);
      a.cards.push(action.cardId);
      a.seller = seat;
      a.kind = getCard(action.cardId).auctionKind;
      s.turnSeat = seat;
      note(s, seat, 'double-add', '加入同画家画作，接任拍卖师。', a.cards);
      if (!this.match.finishIfNeeded()) this.configure();
    } else if (action.type === 'decline-double') {
      note(s, seat, 'double-decline', '本次不加入组合拍卖。');
      if (++a.index === a.queue.length) this.sell(a.seller, 0);
    } else if (action.type === 'sealed-bid') {
      a.sealedBids[seat] = action.amount;
      note(s, seat, 'sealed-submit', '已提交暗标，金额待全员提交后一起公开。');
      if (Object.keys(a.sealedBids).length === s.seatOrder.length) {
        const top = Math.max(...Object.values(a.sealedBids));
        const winner = clockwise(s.seatOrder, a.seller).find(
          (id) => a.sealedBids[id] === top,
        )!;
        this.sell(winner, top);
      }
    } else if (action.type === 'set-price') {
      a.fixedPrice = action.amount;
      note(
        s,
        seat,
        'set-price',
        `定价 ${action.amount}。`,
        a.cards,
        action.amount,
      );
    } else if (action.type === 'buy') {
      this.sell(seat, a.fixedPrice!);
    } else if (action.type === 'bid') {
      a.currentBid = action.amount;
      a.highBidder = seat;
      a.bidRevision++;
      a.passes = [];
      note(
        s,
        seat,
        'bid',
        `公开出价 ${action.amount}。`,
        a.cards,
        action.amount,
      );
      if (a.kind === 'once' && ++a.index === a.queue.length)
        this.sell(seat, action.amount);
    } else if (action.type === 'pass') {
      note(
        s,
        seat,
        'pass',
        a.kind === 'open' ? '确认当前价不加价。' : '本次不竞买。',
      );
      if (a.kind === 'open') {
        a.passes.push(seat);
        if (!actingSeats(s).length)
          this.sell(a.highBidder ?? a.seller, a.currentBid);
      } else if (++a.index === a.queue.length) {
        this.sell(
          a.kind === 'fixed' ? a.seller : (a.highBidder ?? a.seller),
          a.kind === 'fixed' ? a.fixedPrice! : a.currentBid,
        );
      }
    } else throw new Error('不支持的拍卖动作。');
  }
}
