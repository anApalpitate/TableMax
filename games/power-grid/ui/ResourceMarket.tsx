import { RESOURCES, RESOURCE_LABELS } from '../data/catalog';
import type { PowerGridView, Resource } from '../types';
import { ResourceIcon } from './components';

const ORDINARY_PRICES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const URANIUM_PRICES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16] as const;

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
        <h3>{RESOURCE_LABELS[resource]}</h3>
        <span>现存 {view.resources[resource]} 份</span>
        <strong>
          {view.resourcePrices[resource] == null
            ? '已售罄'
            : `本次 ${view.resourcePrices[resource]}电币/份`}
        </strong>
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
              aria-label={`${RESOURCE_LABELS[resource]}每份${cost}电币，${count === 0 ? '空位，暂无燃料' : `剩余${count}份`}${cheapest ? '，从此价区购买' : ''}`}
            >
              <strong>{cost}</strong>
              <div className="pg-price-tokens" aria-hidden="true">
                {Array.from({ length: capacity }, (_, token) => (
                  <span
                    key={token}
                    className={token < count ? 'pg-price-token--filled' : ''}
                  >
                    {token < count ? '●' : '×'}
                  </span>
                ))}
              </div>
              <span>{count === 0 ? '空位' : `余${count}份`}</span>
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
}: {
  view: PowerGridView;
  compact?: boolean;
}) {
  const areas = (
    <div className="pg-price-lanes">
      {RESOURCES.map((resource) => (
        <PriceAreas key={resource} view={view} resource={resource} />
      ))}
      <p className="pg-resource-direction">
        煤、油、垃圾每区3份；铀每区1份。补给从高价空位回填；跨价区后单价会上升。
      </p>
    </div>
  );
  return (
    <section
      className={`pg-resource-market${compact ? ' pg-resource-market--compact' : ''}`}
    >
      <h2>燃料价格区</h2>
      <p className="pg-resource-direction">
        单价：电币/份。从▸最低有货价区逐份买。
      </p>
      <div className="pg-resources" aria-label="四种燃料当前最低单价与存量">
        {RESOURCES.map((resource) => (
          <div
            key={resource}
            className={`pg-resource-price pg-resource-price--${resource}`}
          >
            <ResourceIcon resource={resource} />
            <span>{RESOURCE_LABELS[resource]}</span>
            <strong>
              {view.resourcePrices[resource] == null
                ? '售罄'
                : `${view.resourcePrices[resource]}`}
            </strong>
            <span>余{view.resources[resource]}份</span>
          </div>
        ))}
      </div>
      {compact ? (
        <details className="pg-market-details">
          <summary>查看各价格区与剩余燃料</summary>
          {areas}
        </details>
      ) : (
        areas
      )}
    </section>
  );
}
