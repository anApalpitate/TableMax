import type { BotStrategy } from '../../../packages/game-sdk/src';
import type { Action, ArtistId, CardFace, ModernArtView } from '../ui/view';
import { ARTISTS, RULES_VERSION } from '../data/catalog';

// The strategy only evaluates its supplied projection. It never receives State.
class ArtEvaluator {
  constructor(
    private readonly view: ModernArtView,
    private readonly level: number,
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
              own * (this.level === 2 ? 0.1 : 0.04),
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
    const reserve = this.view.round < 4 ? [0.62, 0.72, 0.84][this.level]! : 1;
    return Math.max(
      0,
      Math.floor(Math.min(total * discount, this.view.self!.cash * reserve)),
    );
  }
  offered(card: CardFace): number {
    const count = this.view.artists.find(
      (x) => x.id === card.artistId,
    )!.playedCount;
    const extra =
      count === 4
        ? 1
        : card.auctionKind === 'double' &&
            this.view.self!.hand.some(
              (other) =>
                other.artistId === card.artistId &&
                other.auctionKind !== 'double',
            )
          ? 2
          : 1;
    const value = this.price(card.artistId, extra);
    if (this.level < 2) return value + (card.auctionKind === 'double' ? 4 : 0);
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
      return control;
    }
    return (
      value +
      this.view.players[this.view.self!.seatId]!.collection.filter(
        (c) => c.artistId === card.artistId,
      ).length *
        3
    );
  }
}
export const bot: BotStrategy = {
  id: 'modern-art-local',
  version: '1.0.0',
  gameId: 'modern-art',
  rulesVersion: RULES_VERSION,
  difficulties: ['default', 'doubao', 'juewu'],
  validateMemory(input) {
    if (input !== null) throw new Error('现代艺术策略记忆无效。');
    return null;
  },
  async decide({
    view: inputView,
    actions: inputActions,
    difficulty = 'default',
    random,
    signal,
    memory,
  }) {
    if (signal.aborted) throw new Error('策略已取消。');
    if (memory !== null) throw new Error('现代艺术策略记忆无效。');
    const view = inputView as ModernArtView;
    const actions = inputActions as readonly Action[];
    if (!view.self || !actions.length) throw new Error('缺少本人合法决策。');
    const level = ['default', 'doubao', 'juewu'].indexOf(difficulty);
    if (level < 0) throw new Error('不支持的人机等级。');
    const evaluator = new ArtEvaluator(view, level);
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
          ) + (level === 0 ? random.next() * 12 : 0),
      }));
      ratings.sort(
        (a, b) =>
          b.score - a.score || a.action.cardId.localeCompare(b.action.cardId),
      );
      selected = ratings[0]?.action;
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
      const amount =
        view.auction!.kind === 'once'
          ? budget
          : Math.min(budget, view.auction!.currentBid + (level === 0 ? 1 : 2));
      selected =
        bids.find((action) => action.amount === amount) ??
        actions.find((action) => action.type === 'pass');
    }
    return { action: selected ?? actions[0]!, memory: null };
  },
};
