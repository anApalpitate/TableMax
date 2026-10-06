import { describe, expect, it } from 'vitest';
import type { Action } from '../../types';
import { resourcePurchasePreview } from './resource-purchase-preview';

const one: Action = { type: 'buy-resource', plantId: 4, resource: 'coal' };
const two: Action = {
  type: 'buy-resource',
  plantId: 4,
  resource: 'coal',
  quantity: 2,
};
const three: Action = {
  type: 'buy-resource',
  plantId: 4,
  resource: 'coal',
  quantity: 3,
};

describe('phone resource purchase quotes', () => {
  it('selects the original authorized action and sums crossed price tiers', () => {
    const actions = [three, one, two];
    const before = structuredClone(actions);
    const preview = resourcePurchasePreview(actions, 4, 'coal', 4, 2);
    expect(preview).toMatchObject({ maximum: 3, quantity: 2, cost: 15 });
    expect(preview.action).toBe(two);
    expect(actions).toEqual(before);
    expect(resourcePurchasePreview(actions, 4, 'coal', 4, 3).cost).toBe(23);
  });

  it('keeps the legacy single-unit action without adding a quantity', () => {
    const preview = resourcePurchasePreview([one, two], 4, 'coal', 4, 1);
    expect(preview.action).toBe(one);
    expect(preview.action).not.toHaveProperty('quantity');
    expect(preview.cost).toBe(7);
  });

  it('uses only the current plant and resource legal limit', () => {
    const unrelated: Action[] = [
      { type: 'buy-resource', plantId: 7, resource: 'oil', quantity: 6 },
      { type: 'buy-resource', plantId: 4, resource: 'oil', quantity: 4 },
      { type: 'finish' },
    ];
    const preview = resourcePurchasePreview(
      [one, two, ...unrelated],
      4,
      'coal',
      4,
      5,
    );
    expect(preview).toMatchObject({ maximum: 2, quantity: 2, cost: 15 });
    expect(preview.action).toBe(two);
  });

  it('does not turn a partial or invalid numeric draft into a purchase', () => {
    for (const draft of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1, 1.5]) {
      const preview = resourcePurchasePreview([one, two], 4, 'coal', 4, draft);
      expect(preview.action).toBeUndefined();
      expect(preview.cost).toBeNull();
    }
    expect(
      resourcePurchasePreview([one, three], 4, 'coal', 4, 2).cost,
    ).toBeNull();
  });

  it('quotes uranium across its unequal price tiers', () => {
    const actions: Action[] = [
      { type: 'buy-resource', plantId: 11, resource: 'uranium' },
      { type: 'buy-resource', plantId: 11, resource: 'uranium', quantity: 2 },
    ];
    expect(resourcePurchasePreview(actions, 11, 'uranium', 4, 2).cost).toBe(22);
  });

  it('disables a quote after stock or legal purchase actions disappear', () => {
    expect(resourcePurchasePreview([one], 4, 'coal', 0, 1).cost).toBeNull();
    expect(resourcePurchasePreview([], 4, 'coal', 4, 2)).toMatchObject({
      maximum: 0,
      quantity: 0,
      action: undefined,
      cost: null,
    });
  });
});
