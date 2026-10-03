import type { Viewer } from '../../../packages/game-sdk/src';
import { ARTISTS, getCard } from '../data/catalog';
import type { ModernArtView } from '../ui/view';
import { prices } from './scoring';
import { actingSeats, type State } from './state';

export function project(s: State, viewer: Viewer): ModernArtView {
  const a = s.auction;
  const result = ['round-result', 'ended'].includes(s.phase)
    ? s.results.at(-1)!
    : null;
  const estimate = result?.values ?? prices(s.played, s.values);
  const own =
    viewer.role === 'player' && s.seatOrder.includes(viewer.seatId)
      ? viewer.seatId
      : null;
  return {
    round: s.round,
    phase: s.phase,
    seatOrder: [...s.seatOrder],
    turnSeat: s.turnSeat,
    deckCount: s.deck.length,
    discardCount: s.discard.length,
    auction: a
      ? {
          id: a.id,
          kind: a.kind,
          cards: a.cards.map(getCard),
          seller: a.seller,
          originalSeller: a.originalSeller,
          currentBid: a.currentBid,
          highBidder: a.highBidder,
          fixedPrice: a.fixedPrice,
          actingSeats: actingSeats(s),
          submitted: s.seatOrder.filter((seat) => seat in a.sealedBids),
          passes: [...a.passes],
        }
      : null,
    artists: ARTISTS.map((artist) => ({
      ...artist,
      playedCount: s.played[artist.id],
      history: [...s.values[artist.id]],
      currentValue: estimate[artist.id],
    })),
    players: Object.fromEntries(
      s.seatOrder.map((seat) => [
        seat,
        {
          handCount: s.hands[seat]!.length,
          collection: s.collections[seat]!.map(getCard),
          cash: s.phase === 'ended' ? s.cash[seat]! : null,
        },
      ]),
    ),
    self: own
      ? {
          seatId: own,
          hand: s.hands[own]!.map(getCard),
          cash: s.cash[own]!,
          sealedBid: a?.kind === 'sealed' ? (a.sealedBids[own] ?? null) : null,
        }
      : null,
    roundResult: result
      ? {
          round: result.round,
          ranking: [...result.ranking],
          counts: { ...result.counts },
          values: { ...result.values },
          income: { ...result.income },
          paintings: Object.fromEntries(
            s.seatOrder.map((seat) => [
              seat,
              result.paintings[seat]!.map(getCard),
            ]),
          ),
          reason: result.reason,
        }
      : null,
    finalCash: s.phase === 'ended' ? { ...s.cash } : null,
    winners: [...s.winners],
    latest: s.history.length ? structuredClone(s.history.at(-1)!) : null,
    history: structuredClone(s.history),
  };
}
