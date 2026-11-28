import type { Action, ModernArtView } from '../ui/view';

export function encodeAuctionBid(
  view: ModernArtView,
  action: Action,
  seat: string,
) {
  const auction = view.auction;
  if (
    view.self?.seatId !== seat ||
    auction?.kind !== 'once' ||
    (action.type !== 'bid' && action.type !== 'pass')
  )
    return null;
  const bid = Number(action.type === 'bid');
  const amount = action.type === 'bid' ? action.amount : 0;
  const quotedValue = auction.cards.reduce(
    (sum, card) =>
      sum +
      (view.artists.find(({ id }) => id === card.artistId)?.currentValue ?? 0),
    0,
  );
  return [
    bid,
    amount / 150,
    amount / Math.max(1, view.self.cash),
    (bid * auction.currentBid) / 150,
    (bid * quotedValue) / 100,
    (bid * auction.cards.length) / 2,
    (bid * view.round) / 4,
    bid * Number(auction.seller === seat),
  ];
}
