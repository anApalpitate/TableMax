import type { BotStrategy } from '../../../packages/game-sdk/src';
import type { Action, ArtistId, CardFace, ModernArtView } from '../ui/view';
import { ARTISTS, RULES_VERSION } from '../data/catalog';
import { observeMemory, validateMemory } from './memory';
import { RoundPlanner } from './planner';

// The strategy only evaluates its supplied projection. It never receives State.
class ArtEvaluator {
  constructor(
    private readonly view: ModernArtView,
    private readonly level: number,
    private readonly planner: RoundPlanner,
  ) {}
  price(id: ArtistId, extra = 0, offeredArtist = id, settled = false): number {
    const ranked = this.view.artists
      .map((artist, order) => ({
        artist,
        order,
        count: artist.playedCount + (artist.id === offeredArtist ? extra : 0),
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count || a.order - b.order);
    const index = ranked.findIndex((x) => x.artist.id === id);
    const artist = this.view.artists.find((x) => x.id === id)!;
    const past = artist.history.reduce((a, b) => a + b, 0);
    if (index < 0 || index > 2)
      return !settled &&
        this.level === 2 &&
        this.view.self!.hand.some((card) => card.artistId === id)
        ? (past + 10) * 0.2
        : 0;
    const present = 30 - index * 10 + past;
    if (settled) return present;
    const own = this.view.self!.hand.filter(
      (card) => card.artistId === id,
    ).length;
    const confidence =
      artist.playedCount + (id === offeredArtist ? extra : 0) >= 4
        ? 1
        : Math.min(
            0.95,
            0.45 +
              (artist.playedCount + (id === offeredArtist ? extra : 0)) * 0.11 +
              own * (this.level === 2 ? 0.1 : 0.04) +
              (this.planner.unknown[id] /
                Math.max(
                  1,
                  Object.values(this.planner.unknown).reduce(
                    (a, b) => a + b,
                    0,
                  ),
                )) *
                [0.06, 0.1, 0.14][this.level]!,
          );
    return present * confidence;
  }
  budget(): number {
    const auction = this.view.auction!;
    const total = auction.cards.reduce(
      (sum, card) => sum + this.price(card.artistId),
      0,
    );
    const discount = [0.48, 0.69, 0.82][this.level]!;
    const available = this.view.self!.cash - this.planner.cashReserve();
    return Math.max(0, Math.floor(Math.min(total * discount, available)));
  }
  offered(card: CardFace, type: 'offer' | 'add-double'): number {
    const count = this.view.artists.find(
      (x) => x.id === card.artistId,
    )!.playedCount;
    const companion =
      type === 'offer' && card.auctionKind === 'double' && count < 4
        ? this.view.self!.hand.find(
            (other) =>
              other.artistId === card.artistId &&
              other.auctionKind !== 'double',
          )
        : undefined;
    const used = companion ? [card, companion] : [card];
    const extra = used.length;
    const value =
      this.price(card.artistId, extra) * (type === 'add-double' ? 2 : extra);
    const future = this.planner.offerAdjustment(used, extra);
    if (this.level === 0)
      return value + (card.auctionKind === 'double' ? 4 : 0);
    let control = 0;
    if (count + extra >= 5) {
      for (const artist of ARTISTS) {
        const own = this.view.players[
          this.view.self!.seatId
        ]!.collection.filter((c) => c.artistId === artist.id).length;
        const others = Object.entries(this.view.players)
          .filter(([seat]) => seat !== this.view.self!.seatId)
          .reduce(
            (sum, [, player]) =>
              sum +
              player.collection.filter((c) => c.artistId === artist.id).length,
            0,
          );
        control +=
          (own - others / (this.view.seatOrder.length - 1)) *
          this.price(artist.id, extra, card.artistId, true);
      }
      return control + future;
    }
    return (
      value +
      future +
      this.view.players[this.view.self!.seatId]!.collection.filter(
        (c) => c.artistId === card.artistId,
      ).length *
        (this.level === 2 ? 3 : 1.5)
    );
  }
}
export const bot: BotStrategy = {
  id: 'modern-art-local',
  version: '1.0.0',
  gameId: 'modern-art',
  rulesVersion: RULES_VERSION,
  difficulties: ['default', 'doubao', 'juewu'],
  validateMemory,
  async decide({
    view: inputView,
    actions: inputActions,
    difficulty = 'default',
    random,
    signal,
    memory,
  }) {
    if (signal.aborted) throw new Error('策略已取消。');
    const view = inputView as ModernArtView;
    const actions = inputActions as readonly Action[];
    if (!view.self || !actions.length) throw new Error('缺少本人合法决策。');
    const level = ['default', 'doubao', 'juewu'].indexOf(difficulty);
    if (level < 0) throw new Error('不支持的人机等级。');
    const observed = observeMemory(memory, view, level);
    const planner = new RoundPlanner(view, observed, level, signal);
    const evaluator = new ArtEvaluator(view, level, planner);
    let selected: Action | undefined;
    if (
      actions[0]!.type === 'offer' ||
      actions.some((action) => action.type === 'add-double')
    ) {
      const candidates = actions.filter(
        (action): action is Extract<Action, { cardId: string }> =>
          'cardId' in action,
      );
      const ratings = candidates.map((action) => ({
        action,
        score:
          evaluator.offered(
            view.self!.hand.find((card) => card.id === action.cardId)!,
            action.type,
          ) + (level === 0 ? random.next() * 12 : 0),
      }));
      ratings.sort(
        (a, b) =>
          b.score - a.score || a.action.cardId.localeCompare(b.action.cardId),
      );
      selected =
        ratings[0] && (view.phase !== 'double' || ratings[0].score > 0)
          ? ratings[0].action
          : actions.find((action) => action.type === 'decline-double');
    } else if (actions.some((action) => action.type === 'set-price')) {
      const amount = Math.min(
        view.self.cash,
        Math.max(0, evaluator.budget() + (level ? 2 : 0)),
      );
      selected = actions.find(
        (action) => action.type === 'set-price' && action.amount === amount,
      );
    } else if (actions.some((action) => action.type === 'sealed-bid')) {
      const amount = evaluator.budget();
      selected = actions.find(
        (action) => action.type === 'sealed-bid' && action.amount === amount,
      );
    } else if (actions.some((action) => action.type === 'buy')) {
      selected = actions.find(
        (action) =>
          action.type ===
          (view.auction!.fixedPrice! <= evaluator.budget() ? 'buy' : 'pass'),
      );
    } else if (actions.some((action) => action.type === 'bid')) {
      const bids = actions.filter(
        (action): action is Extract<Action, { amount: number }> =>
          action.type === 'bid',
      );
      const budget = evaluator.budget();
      const current = view.auction!.currentBid;
      const target =
        observed.raises >= 2
          ? budget
          : Math.floor(
              budget *
                (observed.raises === 1
                  ? 0.88
                  : level === 0
                    ? 0.5 + random.next() * 0.18
                    : [0, 0.64, 0.72][level]!),
            );
      const jump = Math.max(2, Math.ceil(budget * [0.2, 0.26, 0.28][level]!));
      const amount =
        view.auction!.kind === 'once'
          ? budget
          : Math.min(budget, Math.max(target, current + jump));
      selected =
        bids.find((action) => action.amount === amount) ??
        actions.find((action) => action.type === 'pass');
    }
    selected ??= actions[0]!;
    if (view.auction?.kind === 'open' && selected.type === 'bid')
      observed.raises = Math.min(3, observed.raises + 1);
    return { action: selected, memory: observed };
  },
};
