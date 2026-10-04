import { RESOURCES, RESOURCE_LABELS } from '../data/catalog';
import type { PowerGridView, Resource } from '../types';
import { ResourceIcon } from './components';
import './fuel-market.css';

const ORDINARY_PRICES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const URANIUM_PRICES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16] as const;
const SHORT_NAMES: Record<Resource, string> = {
  coal: '煤',
  oil: '油',
  garbage: '垃圾',
  uranium: '铀',
};

function PriceAreas({
  view,
  resource,
}: {
  view: PowerGridView;
  resource: Resource;
}) {
  const prices = resource === 'uranium' ? URANIUM_PRICES : ORDINARY_PRICES;
  const capacity = resource === 'uranium' ? 1 : 3;
  return (
    <article
      className={`pg-price-lane pg-price-lane--${resource}`}
      data-resource={resource}
    >
      <header>
        <ResourceIcon resource={resource} />
        <h3>{SHORT_NAMES[resource]}</h3>
        <span>余 {view.resources[resource]} 份</span>
        {view.resourcePrices[resource] == null && <strong>售罄</strong>}
      </header>
      <div className="pg-price-areas">
        {prices.map((cost, index) => {
          const count = Math.min(
            capacity,
            Math.max(
              0,
              view.resources[resource] - (prices.length - index - 1) * capacity,
            ),
          );
          const cheapest = count > 0 && cost === view.resourcePrices[resource];
          return (
            <div
              key={cost}
              data-price={cost}
              data-count={count}
              className={`pg-price-area${cheapest ? ' pg-price-area--next' : ''}${count === 0 ? ' pg-price-area--empty' : ''}`}
              aria-label={`${RESOURCE_LABELS[resource]}每份${cost}电币，剩余${count}份${cheapest ? '，当前最低有货价' : ''}`}
            >
              <strong>{cost}</strong>
              <span className="pg-price-count" aria-label={`剩余${count}份`}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function ResourceMarket({
  view,
  compact = false,
  summary = false,
}: {
  view: PowerGridView;
  compact?: boolean;
  summary?: boolean;
}) {
  return (
    <section
      className={`pg-resource-market pg-fuel-market${compact ? ' pg-resource-market--compact' : ''}${summary ? ' pg-fuel-market--summary' : ''}`}
      aria-label={summary ? '燃料当前价格与存量' : '燃料价格阶梯'}
    >
      {!summary && (
        <div className="pg-fuel-market-heading">
          <h2>燃料市场</h2>
          <span>上：单价 E/份 下：余量</span>
        </div>
      )}
      {summary ? (
        <div className="pg-fuel-summary">
          {RESOURCES.map((resource) => (
            <div key={resource} data-resource-summary={resource}>
              <ResourceIcon resource={resource} />
              <span>{SHORT_NAMES[resource]}</span>
              <strong>
                {view.resourcePrices[resource] == null
                  ? '售罄'
                  : `${view.resourcePrices[resource]} E`}
              </strong>
              <span>余{view.resources[resource]}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="pg-price-lanes">
          {RESOURCES.map((resource) => (
            <PriceAreas key={resource} view={view} resource={resource} />
          ))}
        </div>
      )}
    </section>
  );
}
