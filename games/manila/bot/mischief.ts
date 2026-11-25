import type { Action, ManilaView } from '../rules/view';
import {
  chance,
  influenceScore,
  priceStep,
  projectedWealth,
  publicPerspective,
} from './evaluation';

export function leadingRival(v: ManilaView): string | undefined {
  const own = v.self!.seatId;
  const knownShares = (seat: string) =>
    seat === own ? v.self!.shares : v.players[seat]!.revealedShares;
  const known = v.seatOrder.flatMap(knownShares);
  const hiddenValues = v.cargos
    .flatMap(({ id }) => {
      const count =
        5 - v.stock[id] - known.filter(({ cargo }) => cargo === id).length;
      return Array.from({ length: Math.max(0, count) }, () => v.market[id]);
    })
    .sort((a, b) => a - b);
  const ranges = v.seatOrder.map((seat) => {
    const player = v.players[seat]!;
    const visible = knownShares(seat);
    const base =
      player.cash -
      15 * player.mortgageCount +
      visible.reduce((sum, share) => sum + v.market[share.cargo], 0);
    const count = player.shareCount - visible.length;
    return {
      seat,
      low:
        base +
        hiddenValues.slice(0, count).reduce((sum, price) => sum + price, 0),
      high:
        base +
        (count
          ? hiddenValues.slice(-count).reduce((sum, price) => sum + price, 0)
          : 0),
    };
  });
  return ranges.find(
    (candidate) =>
      candidate.seat !== own &&
      ranges.every(
        (other) => other === candidate || candidate.low >= other.high + 3,
      ),
  )?.seat;
}

export function rivalPressure(v: ManilaView, target: string) {
  const publicHolder = publicPerspective(v, target);
  const targetShares = publicHolder.self!.shares;
  const possibleGrowth = targetShares.reduce(
    (sum, { cargo }) => sum + priceStep(v, cargo),
    0,
  );
  return (action: Action): number => {
    let prevented = 0;
    switch (action.type) {
      case 'bid':
        return v.auction.highBidder === target &&
          v.self!.cash - action.amount >= 6
          ? 2.25
          : 0;
      case 'setup':
        prevented =
          possibleGrowth -
          targetShares.reduce((sum, { cargo }) => {
            const index = action.cargos.indexOf(cargo);
            return index < 0
              ? sum
              : sum +
                  chance(action.positions[index]!, 3, 13) * priceStep(v, cargo);
          }, 0);
        break;
      case 'place': {
        const space = v.spaces.find(({ id }) => id === action.space)!;
        const boat = v.boats.find(({ cargo }) => cargo === space.cargo);
        if (space.kind !== 'cargo' || !boat?.crew.includes(target)) return 0;
        const changed = {
          ...publicHolder,
          boats: v.boats.map((item) =>
            item === boat
              ? { ...item, crew: [...item.crew, v.self!.seatId] }
              : item,
          ),
        };
        prevented =
          projectedWealth(publicHolder, true) - projectedWealth(changed, true);
        break;
      }
      case 'pilot':
      case 'board':
      case 'plunder':
        prevented = -influenceScore(v, action, true, target);
        break;
    }
    return Math.min(4, Math.max(0, prevented) * 0.45);
  };
}
