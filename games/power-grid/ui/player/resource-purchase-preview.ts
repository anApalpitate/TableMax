import { resourcePurchaseCost } from '../../rules/resource-purchase';
import type { Action, Resource } from '../../types';

export function resourcePurchasePreview(
  actions: readonly Action[],
  plantId: number,
  resource: Resource,
  marketCount: number,
  draft: number,
) {
  const purchases = actions.filter(
    (action): action is Extract<Action, { type: 'buy-resource' }> =>
      action.type === 'buy-resource' &&
      action.plantId === plantId &&
      action.resource === resource,
  );
  const maximum = Math.max(
    0,
    ...purchases.map((action) => action.quantity ?? 1),
  );
  const quantity =
    Number.isSafeInteger(draft) && draft >= 1
      ? Math.min(draft, maximum)
      : draft;
  const action = purchases.find(
    (purchase) => (purchase.quantity ?? 1) === quantity,
  );
  const cost = action
    ? resourcePurchaseCost(resource, marketCount, quantity)
    : null;
  return { maximum, quantity, action, cost };
}
