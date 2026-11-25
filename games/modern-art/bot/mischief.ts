import type { Action, ModernArtView } from '../ui/view';

// Recent public sales and visible portfolios are a proxy, not inferred cash.
export function marketLeader(view: ModernArtView): string | undefined {
  const position = new Map(view.seatOrder.map((seat) => [seat, 0]));
  for (const deal of view.history) {
    const { actor, winner, amount } = deal;
    if (
      deal.verb !== 'sale' ||
      actor === null ||
      winner === null ||
      amount === null
    )
      continue;
    position.set(winner, position.get(winner)! - amount);
    if (winner !== actor) position.set(actor, position.get(actor)! + amount);
  }
  const prices = new Map(
    view.artists.map((artist) => [artist.id, artist.currentValue]),
  );
  const ranked = view.seatOrder
    .map((seat) => ({
      seat,
      value:
        position.get(seat)! +
        view.players[seat]!.collection.reduce(
          (sum, card) => sum + prices.get(card.artistId)!,
          0,
        ),
    }))
    .sort((a, b) => b.value - a.value);
  const [leader, second] = ranked;
  return leader &&
    second &&
    leader.seat !== view.self!.seatId &&
    leader.value - second.value >= 8
    ? leader.seat
    : undefined;
}

export function pressureBid(
  auction: NonNullable<ModernArtView['auction']>,
  target: string,
  raises: number,
  bids: readonly Extract<Action, { amount: number }>[],
  budget: number,
  lotValue: number,
  available: number,
): Action | undefined {
  if (
    (auction.kind !== 'open' && auction.kind !== 'once') ||
    auction.highBidder !== target ||
    auction.seller === target ||
    raises >= 3
  )
    return undefined;
  const minimum = auction.currentBid + (auction.kind === 'open' ? 2 : 1);
  const limit = Math.min(budget + 4, lotValue * 0.9, available);
  if (minimum > limit) return undefined;
  return bids.find((bid) => bid.type === 'bid' && bid.amount === minimum);
}
