import type { Action, RaView } from '../rules';

export const auctionDiskEncoder = { id: 'auction-disk-v1', width: 9 } as const;

export function encodeAuctionDisk(view: RaView, action: Action, seat: string) {
  const own = view.players.find((player) => player.seat === seat);
  if (
    view.actor !== seat ||
    !view.auction ||
    !own?.private ||
    (action.type !== 'bid' && action.type !== 'pass')
  )
    return null;
  const bid = Number(action.type === 'bid');
  const disk = action.type === 'bid' ? action.disk : 0;
  const lot = view.lot.filter((tile) => tile !== null);
  return [
    bid,
    disk / 16,
    (bid * view.center) / 16,
    (bid * lot.length) / 8,
    (bid * own.disks.length) / 4,
    (bid * view.raDrawn) / view.limit,
    (bid * view.epoch) / 3,
    bid * Number(view.auction.caller === seat),
    (bid * own.held.length) / 24,
  ];
}
