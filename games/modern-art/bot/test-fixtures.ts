import type { RuleContext } from '@tablemax/game-sdk';
import { CARDS } from '../data/catalog';
import { rules } from '../rules';
import { countCards } from '../rules/scoring';
import type { State } from '../rules/state';
import type { AuctionKind } from '../ui/view';

export function pressureOffer(ctx: RuleContext, kind: AuctionKind) {
  const [seller, rival, self] = ctx.seats as readonly [string, string, string];
  const state = rules.initialize(ctx) as State;
  const available = [...CARDS];
  const take = (predicate: (card: (typeof CARDS)[number]) => boolean) => {
    const index = available.findIndex(predicate);
    if (index < 0) throw new Error('Missing Modern Art fixture painting');
    return available.splice(index, 1)[0]!.id;
  };
  const offered = take(
    (card) => card.artistId === 'manuel' && card.auctionKind === kind,
  );
  const paintings = Array.from({ length: 3 }, () =>
    take((card) => card.artistId === 'manuel'),
  );
  state.collections = { [seller]: [], [rival]: paintings, [self]: [] };
  state.hands = {
    [seller]: [offered],
    [rival]: [
      take((card) => card.artistId === 'ramon'),
      take((card) => card.artistId === 'sigrid'),
    ],
    [self]: [
      take((card) => card.artistId === 'rafael'),
      take((card) => card.artistId === 'daniel'),
    ],
  };
  state.turnSeat = seller;
  state.played = countCards(paintings);
  state.deck = available.map(({ id }) => id);
  return rules.apply(
    rules.validateState(state, ctx.seats),
    { type: 'offer', cardId: offered },
    seller,
    ctx,
  ).state as State;
}
