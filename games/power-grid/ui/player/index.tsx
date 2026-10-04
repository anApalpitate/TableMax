import { useState, type CSSProperties } from 'react';
import { getPlant, RESOURCES, RESOURCE_LABELS } from '../../data/catalog';
import { income } from '../../data/economy';
import { GERMANY_REGIONS, getCity } from '../../data/germany';
import type { Action, PowerGridView, Resource } from '../../types';
import { PlantCard, ResourceIcon } from '../components';
import { FUEL_LABELS } from '../labels';

type Props = {
  view: PowerGridView;
  actions: readonly Action[];
  locked: boolean;
  choose(action: Action): void;
  city: string | null;
  selectCity(city: string): void;
  selectedPlant: number | null;
  selectPlant(plant: number): void;
  artFor?(id: number): CSSProperties;
};

function AmountPicker({
  minimum,
  maximum,
  value,
  change,
}: {
  minimum: number;
  maximum: number;
  value: number;
  change(value: number): void;
}) {
  const step = (delta: number) =>
    change(
      Math.max(
        minimum,
        Math.min(
          maximum,
          !Number.isFinite(value)
            ? minimum
            : delta > 0
              ? Math.floor(value) + delta
              : Math.ceil(value) + delta,
        ),
      ),
    );
  return (
    <div className="pg-amount-picker">
      <button
        type="button"
        aria-label="减少报价"
        disabled={value <= minimum}
        onClick={() => step(-1)}
      >
        −
      </button>
      <label>
        <input
          aria-label="报价金额"
          inputMode="numeric"
          type="number"
          min={minimum}
          max={maximum}
          step="1"
          value={Number.isFinite(value) ? value : ''}
          onChange={(event) =>
            change(
              event.target.value === ''
                ? Number.NaN
                : Number(event.target.value),
            )
          }
        />
        <span>E</span>
      </label>
      <button
        type="button"
        aria-label="增加报价"
        disabled={value >= maximum}
        onClick={() => step(1)}
      >
        ＋
      </button>
      <button
        type="button"
        aria-label="加价五元"
        disabled={value >= maximum}
        onClick={() => step(5)}
      >
        ＋5
      </button>
    </div>
  );
}

function OfferControls({
  actions,
  locked,
  choose,
  selectedPlant,
  selectPlant,
  artFor,
}: Props) {
  const offers = actions.filter((action) => action.type === 'offer');
  const ids = [...new Set(offers.map((action) => action.plantId))];
  const plantId = ids.includes(selectedPlant ?? -1) ? selectedPlant! : ids[0];
  const available = offers.filter((action) => action.plantId === plantId);
  const minimum = available[0]?.amount ?? 0;
  const maximum = available.at(-1)?.amount ?? minimum;
  const [amount, setAmount] = useState(minimum);
  const value = amount;
  const action = available.find((offer) => offer.amount === value);
  const pass = actions.find((entry) => entry.type === 'pass');
  return (
    <section className="pg-controls">
      <h2>选择电厂竞拍</h2>
      <div className="pg-select-plants">
        {ids.map((id) => (
          <PlantCard
            key={id}
            id={id}
            selected={plantId === id}
            disabled={locked}
            onClick={() => {
              selectPlant(id);
              setAmount(id);
            }}
            {...(artFor ? { art: artFor(id) } : {})}
          />
        ))}
      </div>
      {plantId != null && (
        <>
          <AmountPicker
            minimum={minimum}
            maximum={maximum}
            value={value}
            change={setAmount}
          />
          <button
            className="pg-primary"
            disabled={locked || !action}
            onClick={() => action && choose(action)}
          >
            以 {Number.isFinite(value) ? value : '…'} E 竞拍 {plantId} 号电厂
          </button>
        </>
      )}
      {pass && (
        <button disabled={locked} onClick={() => choose(pass)}>
          本轮不买电厂
        </button>
      )}
    </section>
  );
}

function BidControls({ view, actions, locked, choose }: Props) {
  const bids = actions.filter((action) => action.type === 'bid');
  const minimum = bids[0]?.amount ?? 0,
    maximum = bids.at(-1)?.amount ?? minimum;
  const [amount, setAmount] = useState(minimum);
  const action = bids.find((entry) => entry.amount === amount);
  const pass = actions.find((entry) => entry.type === 'pass');
  return (
    <section className="pg-controls">
      <h2>竞拍 {view.auction?.plantId} 号电厂</h2>
      {bids.length > 0 && (
        <>
          <AmountPicker
            minimum={minimum}
            maximum={maximum}
            value={amount}
            change={setAmount}
          />
          <button
            className="pg-primary"
            disabled={locked || !action}
            onClick={() => action && choose(action)}
          >
            确认出价 {Number.isFinite(amount) ? amount : '…'} E
          </button>
        </>
      )}
      {pass && (
        <button disabled={locked} onClick={() => choose(pass)}>
          退出本次竞拍
        </button>
      )}
    </section>
  );
}

function RegionControls({ view, actions, locked, choose }: Props) {
  const choices = actions.filter((action) => action.type === 'select-regions');
  const [selected, setSelected] = useState<string[]>(choices[0]?.regions ?? []);
  const action = choices.find(
    (choice) =>
      choice.regions.length === selected.length &&
      choice.regions.every((region) => selected.includes(region)),
  );
  return (
    <section className="pg-controls">
      <h2>选定 {view.regionCount} 个相邻区域</h2>
      <div className="pg-region-choices">
        {GERMANY_REGIONS.map((region) => (
          <button
            key={region.id}
            style={{ '--pg-region-color': region.color } as CSSProperties}
            aria-pressed={selected.includes(region.id)}
            onClick={() =>
              setSelected((previous) =>
                previous.includes(region.id)
                  ? previous.filter((id) => id !== region.id)
                  : [...previous, region.id],
              )
            }
          >
            {region.name}
            {selected.includes(region.id) ? ' ✓' : ''}
          </button>
        ))}
      </div>
      <button
        className="pg-primary"
        disabled={locked || !action}
        onClick={() => action && choose(action)}
      >
        确认区域 {selected.length}/{view.regionCount}
      </button>
    </section>
  );
}

function FuelTransfer({
  actions,
  locked,
  choose,
}: Pick<Props, 'actions' | 'locked' | 'choose'>) {
  const transfers = actions.filter((action) => action.type === 'transfer');
  const swaps = actions.filter((action) => action.type === 'swap-resources');
  const [expanded, setExpanded] = useState(false);
  if (!transfers.length && !swaps.length) return null;
  return (
    <div className="pg-transfers">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        调配厂间燃料 {expanded ? '▴' : '▾'}
      </button>
      {expanded && (
        <div className="pg-transfer-list">
          {transfers.map((action) => (
            <button
              key={`${action.fromPlantId}-${action.toPlantId}-${action.resource}`}
              disabled={locked}
              onClick={() => choose(action)}
            >
              <ResourceIcon resource={action.resource} />
              {action.fromPlantId} → {action.toPlantId}
              <span>转移 1</span>
            </button>
          ))}
          {swaps.map((action) => (
            <button
              key={`swap-${action.fromPlantId}-${action.toPlantId}-${action.resource}`}
              disabled={locked}
              onClick={() => choose(action)}
            >
              <ResourceIcon resource={action.resource} />
              {action.fromPlantId} ↔ {action.toPlantId}
              <ResourceIcon resource={action.otherResource} />
              <span>交换各 1</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceControls({ view, actions, locked, choose, artFor }: Props) {
  const own = view.self && view.players[view.self.seatId];
  const finish = actions.find((action) => action.type === 'finish');
  return (
    <section className="pg-controls">
      <h2>采购燃料</h2>
      <div className="pg-own-plants">
        {own?.plants.map((plant) => (
          <div className="pg-fuel-plant" key={plant.id}>
            <PlantCard
              id={plant.id}
              owned={plant}
              {...(artFor ? { art: artFor(plant.id) } : {})}
            />
            <div className="pg-fuel-purchases">
              {RESOURCES.map((resource) => {
                const action = actions.find(
                  (entry) =>
                    entry.type === 'buy-resource' &&
                    entry.plantId === plant.id &&
                    entry.resource === resource,
                );
                if (!action) return null;
                return (
                  <button
                    key={resource}
                    disabled={locked}
                    onClick={() => choose(action)}
                  >
                    <ResourceIcon resource={resource} />
                    <span>＋1 {RESOURCE_LABELS[resource]}</span>
                    <strong>{view.resourcePrices[resource]} E</strong>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {finish && (
        <button
          className="pg-primary"
          disabled={locked}
          onClick={() => choose(finish)}
        >
          完成采购
        </button>
      )}
    </section>
  );
}

function ReplacementControls({ view, actions, locked, choose, artFor }: Props) {
  const discards = actions.filter((action) => action.type === 'discard-plant');
  const salvages = actions.filter((action) => action.type === 'salvage');
  const resources = RESOURCES.filter(
    (resource) => (view.replacement?.salvage[resource] ?? 0) > 0,
  );
  return (
    <section className="pg-controls">
      <h2>{discards.length ? '选择淘汰旧电厂' : '安置剩余燃料'}</h2>
      {discards.length > 0 && (
        <div className="pg-select-plants">
          {discards.map((action) => (
            <div key={action.plantId}>
              <PlantCard
                id={action.plantId}
                {...(artFor ? { art: artFor(action.plantId) } : {})}
              />
              <button disabled={locked} onClick={() => choose(action)}>
                淘汰 {action.plantId} 号
              </button>
            </div>
          ))}
        </div>
      )}
      {resources.map((resource) => {
        const discard = actions.find(
          (action) =>
            action.type === 'discard-salvage' && action.resource === resource,
        );
        return (
          <div className="pg-salvage" key={resource}>
            <header>
              <ResourceIcon resource={resource} />
              <strong>
                {RESOURCE_LABELS[resource]}{' '}
                {view.replacement?.salvage[resource]}
              </strong>
            </header>
            <div>
              {salvages
                .filter((action) => action.resource === resource)
                .map((action) => (
                  <button
                    key={action.plantId}
                    disabled={locked}
                    onClick={() => choose(action)}
                  >
                    存入 {action.plantId} 号
                  </button>
                ))}
              {discard && (
                <button
                  className="pg-danger"
                  disabled={locked}
                  onClick={() => choose(discard)}
                >
                  丢弃 1 {RESOURCE_LABELS[resource]}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function BuildControls({
  view,
  actions,
  locked,
  choose,
  city,
  selectCity,
}: Props) {
  const builds = actions.filter((action) => action.type === 'build');
  const option = view.buildOptions.find((entry) => entry.cityId === city);
  const action = builds.find((entry) => entry.cityId === city);
  const finish = actions.find((entry) => entry.type === 'finish');
  return (
    <section className="pg-controls pg-build-controls">
      <h2>扩建电网</h2>
      <select
        aria-label="可建设城市"
        value={city ?? ''}
        onChange={(event) => selectCity(event.target.value)}
      >
        <option value="">选择城市查看费用</option>
        {view.buildOptions.map((entry) => (
          <option key={entry.cityId} value={entry.cityId}>
            {getCity(entry.cityId).name} {entry.cost} E
          </option>
        ))}
      </select>
      {city && (
        <div className="pg-build-preview">
          <strong>{getCity(city).name}</strong>
          {option ? (
            <>
              <dl className="pg-build-costs">
                <div>
                  <dt>城市位置</dt>
                  <dd>{option.buildingCost} 电币</dd>
                </div>
                <div>
                  <dt>连接费</dt>
                  <dd>{option.connectionCost} 电币</dd>
                </div>
              </dl>
              <strong className="pg-build-price">
                总价 {option.cost} 电币
              </strong>
              <button
                className="pg-primary"
                disabled={locked || !action}
                onClick={() => action && choose(action)}
              >
                建设 {getCity(city).name}
              </button>
            </>
          ) : (
            <span>当前不能在这座城市建设</span>
          )}
        </div>
      )}
      {finish && (
        <button disabled={locked} onClick={() => choose(finish)}>
          完成建设
        </button>
      )}
    </section>
  );
}

function PowerControls({ view, actions, locked, choose, artFor }: Props) {
  const own = view.self && view.players[view.self.seatId];
  const finishes = actions.filter((action) => action.type === 'finish');
  const maximum = Math.max(0, ...finishes.map((action) => action.cities ?? 0));
  const [cities, setCities] = useState(maximum);
  const supply = Math.min(cities, maximum);
  const finish = finishes.find((action) => action.cities === supply);
  return (
    <section className="pg-controls">
      <h2>启动电厂</h2>
      <div className="pg-own-plants">
        {own?.plants.map((plant) => {
          const runs = actions.filter(
            (action): action is Extract<Action, { type: 'run' }> =>
              action.type === 'run' && action.plantId === plant.id,
          );
          const spec = getPlant(plant.id);
          const runButtons = runs.map((action) => (
            <button
              className="pg-primary"
              key={action.coal}
              disabled={locked}
              onClick={() => choose(action)}
            >
              {spec.fuel === 'hybrid' ? (
                <span>
                  煤 {action.coal} ＋ 油 {spec.input - action.coal}
                </span>
              ) : (
                <span>启动 {FUEL_LABELS[spec.fuel]}</span>
              )}
              <strong>⚡ {spec.output} 城</strong>
            </button>
          ));
          return (
            <div className="pg-run-plant" key={plant.id}>
              <PlantCard
                id={plant.id}
                owned={plant}
                {...(artFor ? { art: artFor(plant.id) } : {})}
              />
              <div>
                {own.ran.includes(plant.id) ? (
                  <strong className="pg-running">✓ 已发电</strong>
                ) : runs.length ? (
                  spec.fuel === 'hybrid' && runs.length > 1 ? (
                    <details className="pg-run-options">
                      <summary>选择燃料 ▾</summary>
                      {runButtons}
                    </details>
                  ) : (
                    runButtons
                  )
                ) : (
                  <span>燃料不足</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="pg-power-finish">
        <label>
          供电城市
          <select
            aria-label="选择供电城市数"
            value={supply}
            onChange={(event) => setCities(Number(event.target.value))}
          >
            {finishes.map((action) => (
              <option key={action.cities} value={action.cities}>
                {action.cities} 城，收入 {income(action.cities ?? 0)} E
              </option>
            ))}
          </select>
        </label>
        <button
          className="pg-primary"
          disabled={locked || !finish}
          onClick={() => finish && choose(finish)}
        >
          供电 {supply} 城，收入 {income(supply)} E
        </button>
      </div>
    </section>
  );
}

export function PlayerControls(props: Props) {
  if (!props.view.self || !props.actions.length) return null;
  const Component =
    props.view.phase === 'regions'
      ? RegionControls
      : props.view.phase === 'offer'
        ? OfferControls
        : props.view.phase === 'auction'
          ? BidControls
          : props.view.phase === 'resources'
            ? ResourceControls
            : props.view.phase === 'building'
              ? BuildControls
              : props.view.phase === 'replace'
                ? ReplacementControls
                : props.view.phase === 'powering'
                  ? PowerControls
                  : null;
  return Component ? (
    <>
      <Component {...props} />
      <FuelTransfer
        actions={props.actions}
        locked={props.locked}
        choose={props.choose}
      />
    </>
  ) : null;
}

export type { Action, PowerGridView, Resource };
