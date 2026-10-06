import { useState } from 'react';
import { RESOURCE_LABELS } from '../../data/catalog';
import type { Action, Resource } from '../../types';
import { ResourceIcon } from '../components';
import { resourcePurchasePreview } from './resource-purchase-preview';
import './resource-purchase.css';

export function ResourcePurchase({
  plantId,
  resource,
  marketCount,
  actions,
  locked,
  choose,
}: {
  plantId: number;
  resource: Resource;
  marketCount: number;
  actions: readonly Action[];
  locked: boolean;
  choose(action: Action): void;
}) {
  const [draft, setDraft] = useState(1);
  const { maximum, quantity, action, cost } = resourcePurchasePreview(
    actions,
    plantId,
    resource,
    marketCount,
    draft,
  );
  // When a legal limit changes, keep the valid draft instead of reviving an
  // older larger selection if a later synchronization expands the limit.
  if (Number.isSafeInteger(draft) && draft >= 1 && draft !== quantity)
    setDraft(quantity);
  const name = RESOURCE_LABELS[resource];
  const prefix = `${plantId}号电厂${name}`;
  const valid = action != null && cost != null;
  const step = (delta: number) =>
    setDraft(
      Math.max(
        1,
        Math.min(
          maximum,
          Number.isFinite(quantity)
            ? delta > 0
              ? Math.floor(quantity) + delta
              : Math.ceil(quantity) + delta
            : 1,
        ),
      ),
    );
  return (
    <div
      className="pg-resource-purchase"
      data-plant-id={plantId}
      data-resource={resource}
    >
      <div className="pg-resource-purchase-head">
        <strong>
          <ResourceIcon resource={resource} />
          {name}
        </strong>
        <div className="pg-resource-quantity">
          <button
            type="button"
            aria-label={`减少${prefix}采购数量`}
            title={`少买1份${name}`}
            disabled={locked || quantity <= 1}
            onClick={() => step(-1)}
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            aria-label={`${prefix}采购数量`}
            min={1}
            max={maximum}
            step={1}
            disabled={locked}
            value={Number.isFinite(quantity) ? quantity : ''}
            onChange={(event) =>
              setDraft(
                event.target.value === ''
                  ? Number.NaN
                  : Number(event.target.value),
              )
            }
          />
          <button
            type="button"
            aria-label={`增加${prefix}采购数量`}
            title={`多买1份${name}`}
            disabled={locked || quantity >= maximum}
            onClick={() => step(1)}
          >
            ＋
          </button>
        </div>
      </div>
      <button
        type="button"
        className="pg-primary pg-resource-buy"
        data-resource-purchase-confirm
        aria-label={`${plantId}号电厂购买${valid ? quantity : '所选'}份${name}，总价${cost ?? '待定'}电币`}
        disabled={locked || !valid}
        onClick={() => valid && choose(action)}
      >
        <span>购买{valid ? quantity : '…'}份</span>
        <strong>{cost ?? '…'}电币</strong>
      </button>
    </div>
  );
}
