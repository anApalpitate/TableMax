import type { CSSProperties } from 'react';
import { getPlant, RESOURCE_LABELS, RESOURCES } from '../data/catalog';
import type {
  Fuel,
  OwnedPlant,
  PowerGridView,
  Resource,
  Stock,
} from '../types';
import { FUEL_LABELS, PLAYER_COLORS } from './labels';

export function ResourceIcon({ resource }: { resource: Resource }) {
  return (
    <svg
      className={`pg-resource-icon pg-resource-icon--${resource}`}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      {resource === 'coal' ? (
        <path
          d="m6 11 8-7 12 6 3 13-12 6L3 22Z"
          fill="#38352e"
          stroke="#161613"
          strokeWidth="2"
        />
      ) : resource === 'oil' ? (
        <>
          <rect
            x="7"
            y="3"
            width="18"
            height="26"
            rx="4"
            fill="#593b1f"
            stroke="#201b17"
            strokeWidth="2"
          />
          <path d="M7 10H25M7 22H25" stroke="#caa269" strokeWidth="3" />
        </>
      ) : resource === 'garbage' ? (
        <>
          <rect
            x="4"
            y="6"
            width="24"
            height="21"
            rx="3"
            fill="#dbc02b"
            stroke="#746413"
            strokeWidth="2"
          />
          <path
            d="m12 13 4-5 4 5m0 6-3 6-4-5m-4-6-3 5h7"
            stroke="#66521a"
            fill="none"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          <circle
            cx="16"
            cy="16"
            r="12"
            fill="#da3834"
            stroke="#7b1d1b"
            strokeWidth="2"
          />
          <circle cx="16" cy="16" r="3" fill="#ffe9bb" />
          <path
            d="m15 12-3-6-5 6 6 2m7 2 6-2-1 8-6-4m-5 3-3 5 8 1-1-6"
            fill="#ffe9bb"
          />
        </>
      )}
    </svg>
  );
}

function PlantIllustration({ fuel }: { fuel: Fuel }) {
  const green = fuel === 'green' || fuel === 'fusion';
  const nuclear = fuel === 'uranium' || fuel === 'fusion';
  return (
    <svg
      className="pg-plant-illustration"
      viewBox="0 0 180 94"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`pg-sky-${fuel}`} x2="0" y2="1">
          <stop stopColor={green ? '#bfd8bc' : '#cec5ad'} />
          <stop offset="1" stopColor="#e8ddbf" />
        </linearGradient>
      </defs>
      <rect width="180" height="94" fill={`url(#pg-sky-${fuel})`} />
      <path
        d="M0 73Q45 61 78 75T180 70V94H0Z"
        fill={green ? '#698b59' : '#77795f'}
      />
      {green && !nuclear ? (
        <>
          <path
            d="M42 31V83M105 21V77M145 42V84"
            stroke="#d8d8ca"
            strokeWidth="5"
          />
          <path
            d="m42 31-25-12m25 12 23-14m-23 14 2 24m61-34-22-16m22 16 22-12m-22 12v25m40-4-15-10m15 10 14-8m-14 8v17"
            stroke="#f0efe1"
            strokeWidth="4"
          />
        </>
      ) : nuclear ? (
        <>
          <path
            d="M25 82Q45 46 36 24H64Q55 47 75 82Z"
            fill="#bebdb0"
            stroke="#696a63"
            strokeWidth="2"
          />
          <path
            d="M88 83Q110 48 101 28H126Q119 48 143 83Z"
            fill="#d6d3c2"
            stroke="#696a63"
            strokeWidth="2"
          />
          <path
            d="M43 17Q32 6 46 3M112 19Q130 8 113 0"
            stroke="#f2eee1"
            strokeWidth="13"
            strokeLinecap="round"
            fill="none"
            opacity=".85"
          />
        </>
      ) : (
        <>
          <path
            d="M19 79V37H76V79M81 79V49H156V79"
            fill="#8a6e52"
            stroke="#4a4635"
            strokeWidth="2"
          />
          <path
            d="M19 37 40 23 40 37 61 24 61 37 76 29"
            fill="#b19c70"
            stroke="#4a4635"
            strokeWidth="2"
          />
          <path
            d="M91 51V12H103V51M117 51V7H129V51"
            fill="#997c57"
            stroke="#4a4635"
            strokeWidth="2"
          />
          <path d="M90 14H104M116 11H130" stroke="#ded3b3" strokeWidth="6" />
          <path
            d="M33 48V62M49 48V62M65 48V62M97 62V74M116 62V74M136 62V74"
            stroke="#efc261"
            strokeWidth="7"
          />
          <path
            d="M98 5Q79-5 91-15M123-1Q139-8 122-20"
            stroke="#ede8d8"
            strokeWidth="12"
            fill="none"
            opacity=".85"
          />
          {fuel === 'oil' && (
            <ellipse
              cx="150"
              cy="66"
              rx="19"
              ry="13"
              fill="#625b43"
              stroke="#333c32"
              strokeWidth="2"
            />
          )}
          {fuel === 'garbage' && (
            <path d="m21 81 14-12 15 12 19-15 17 15" fill="#cfb035" />
          )}
        </>
      )}
      <path d="M0 87H180" stroke="#61533a" strokeWidth="4" />
    </svg>
  );
}

export function PlantCard({
  id,
  owned,
  selected = false,
  disabled = false,
  onClick,
  art,
  compact = false,
}: {
  id: number;
  owned?: OwnedPlant;
  selected?: boolean;
  disabled?: boolean;
  onClick?(): void;
  art?: CSSProperties;
  compact?: boolean;
}) {
  const plant = getPlant(id);
  const fuel = plant.fuel === 'hybrid' ? 'coal' : plant.fuel;
  const contents = (
    <>
      <div className="pg-plant-top">
        <strong className="pg-plant-number">{id}</strong>
        <span>{FUEL_LABELS[plant.fuel]}</span>
      </div>
      {art ? (
        <div className="pg-plant-art" style={art} />
      ) : (
        <PlantIllustration fuel={plant.fuel} />
      )}
      <div className="pg-plant-engine">
        <div className="pg-plant-consumption">
          {RESOURCES.includes(fuel as Resource) ? (
            <>
              <ResourceIcon resource={fuel as Resource} />
              {plant.fuel === 'hybrid' && <ResourceIcon resource="oil" />}
              <strong>{plant.input}</strong>
            </>
          ) : (
            <strong>免费</strong>
          )}
        </div>
        <span aria-hidden="true">➜</span>
        <strong className="pg-plant-output">⌂ {plant.output}</strong>
      </div>
      {owned && (
        <StockDisplay
          stock={owned.resources}
          capacity={plant.input * 2}
          compact={compact}
        />
      )}
    </>
  );
  const className = `pg-plant-card pg-plant-card--${plant.fuel}${selected ? ' pg-plant-card--selected' : ''}${compact ? ' pg-plant-card--compact' : ''}`;
  const label = `${id}号${FUEL_LABELS[plant.fuel]}电厂，消耗${plant.input}，供电${plant.output}城`;
  return onClick ? (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
    >
      {contents}
    </button>
  ) : (
    <article className={className} aria-label={label}>
      {contents}
    </article>
  );
}

export function StockDisplay({
  stock,
  capacity,
  compact = false,
}: {
  stock: Stock;
  capacity?: number;
  compact?: boolean;
}) {
  const visible = RESOURCES.filter((resource) => stock[resource] > 0);
  const count = RESOURCES.reduce(
    (total, resource) => total + stock[resource],
    0,
  );
  return (
    <div
      className={`pg-stock${compact ? ' pg-stock--compact' : ''}`}
      aria-label={`储存${count}${capacity == null ? '' : `，上限${capacity}`}`}
    >
      {visible.map((resource) => (
        <span key={resource} title={RESOURCE_LABELS[resource]}>
          <ResourceIcon resource={resource} />
          <strong>{stock[resource]}</strong>
        </span>
      ))}
      {!visible.length && <span>空仓</span>}
      {capacity != null && capacity > 0 && (
        <span className="pg-stock-capacity">
          {count}/{capacity}
        </span>
      )}
    </div>
  );
}

export function PlantMarket({
  view,
  select,
  selected,
  artFor,
}: {
  view: PowerGridView;
  select?(id: number): void;
  selected?: number | null;
  artFor?(id: number): CSSProperties;
}) {
  return (
    <section className="pg-market">
      <h2>电厂市场</h2>
      <div className="pg-market-row">
        {view.actualMarket.map((id) => (
          <PlantCard
            key={id}
            id={id}
            selected={selected === id}
            {...(select ? { onClick: () => select(id) } : {})}
            {...(artFor ? { art: artFor(id) } : {})}
          />
        ))}
      </div>
      {view.futureMarket.length > 0 && (
        <>
          <h3>未来市场</h3>
          <div className="pg-market-row pg-market-row--future">
            {view.futureMarket.map((id) => (
              <PlantCard
                key={id}
                id={id}
                {...(artFor ? { art: artFor(id) } : {})}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function ResourceMarket({ view }: { view: PowerGridView }) {
  return (
    <section className="pg-resource-market">
      <h2>燃料市场</h2>
      <div className="pg-resources">
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
                : `${view.resourcePrices[resource]} E`}
            </strong>
            <span>余 {view.resources[resource]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PlayerCompanies({
  view,
  names,
  portraits,
  active = true,
  artFor,
}: {
  view: PowerGridView;
  names: Record<string, string>;
  portraits: Record<string, string>;
  active?: boolean;
  artFor?(id: number): CSSProperties;
}) {
  return (
    <section className="pg-companies" aria-label="各家电力公司">
      {view.seatOrder.map((seat, index) => {
        const player = view.players[seat]!;
        return (
          <article
            key={seat}
            className={`pg-company${active && view.actor === seat ? ' pg-company--acting' : ''}${view.winners.includes(seat) ? ' pg-company--winner' : ''}`}
            style={
              { '--pg-player-color': PLAYER_COLORS[index] } as CSSProperties
            }
          >
            <header>
              <img src={portraits[seat]} alt="" />
              <strong title={names[seat]}>
                <span className="pg-seat-number">{index + 1}</span>
                {names[seat] ?? `公司${index + 1}`}
              </strong>
              {view.winners.includes(seat) && <span aria-label="冠军">★</span>}
            </header>
            <div className="pg-company-stats">
              <span>⌂ {player.cities.length}</span>
              <span>⚡ {player.capacity}</span>
              {player.cash != null && <span>{player.cash} E</span>}
              {active && view.actor === seat && <span>行动中</span>}
            </div>
            <div className="pg-company-plants">
              {player.plants.map((plant) => (
                <PlantCard
                  key={plant.id}
                  id={plant.id}
                  owned={plant}
                  compact
                  {...(artFor ? { art: artFor(plant.id) } : {})}
                />
              ))}
              {!player.plants.length && (
                <span className="pg-no-plant">等待购厂</span>
              )}
            </div>
            <div className="pg-company-summary">
              <span>
                {player.plants.map((plant) => `#${plant.id}`).join(' ') ||
                  '等待购厂'}
              </span>
              <div>
                {RESOURCES.map((resource) => {
                  const total = player.plants.reduce(
                    (sum, plant) => sum + plant.resources[resource],
                    0,
                  );
                  return total > 0 ? (
                    <span key={resource}>
                      <ResourceIcon resource={resource} />
                      {total}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function AuctionDisplay({
  view,
  names,
  artFor,
}: {
  view: PowerGridView;
  names: Record<string, string>;
  artFor?(id: number): CSSProperties;
}) {
  const auction = view.auction;
  if (!auction) return null;
  return (
    <section className="pg-auction-display">
      <PlantCard
        id={auction.plantId}
        {...(artFor ? { art: artFor(auction.plantId) } : {})}
      />
      <div>
        <h2>当前竞拍</h2>
        <strong className="pg-bid-price">
          {auction.amount}
          <span>E</span>
        </strong>
        <span className="pg-high-bidder">{names[auction.highBidder]}</span>
      </div>
    </section>
  );
}
