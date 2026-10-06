import { price, TOTAL_RESOURCES } from '../data/economy';
import type { Resource } from '../types';

export function resourcePurchaseCost(
  resource: Resource,
  marketCount: number,
  quantity: number,
): number | null {
  if (
    !Number.isSafeInteger(marketCount) ||
    marketCount < 0 ||
    marketCount > TOTAL_RESOURCES[resource] ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > marketCount
  )
    return null;
  let cost = 0;
  for (let unit = 0; unit < quantity; unit++)
    cost += price(resource, marketCount - unit)!;
  return cost;
}
