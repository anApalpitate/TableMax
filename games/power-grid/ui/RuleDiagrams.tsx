import type { CSSProperties, ReactNode } from 'react';
import { plantImage } from '../../../assets/games/power-grid/catalog';
import { getPlant, RESOURCE_LABELS, RESOURCES } from '../data/catalog';
import { INITIAL_MARKET, income, price } from '../data/economy';
import { GERMANY_EDGES, getCity } from '../data/germany';
import type { Resource } from '../types';
import { ResourceIcon } from './components';

const illustrations = import.meta.glob(
  '../../../assets/games/power-grid/rules/illustrations-v1/*.webp',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;
const fuelAtlas =
  illustrations[
    '../../../assets/games/power-grid/rules/illustrations-v1/fuels-atlas-v1.webp'
  ];
const houseArt =
  illustrations[
    '../../../assets/games/power-grid/rules/illustrations-v1/house-v1.webp'
  ];

function FuelPiece({ resource }: { resource: Resource }) {
  const index = RESOURCES.indexOf(resource);
  return (
    <span
      className={`pg-rule-fuel pg-rule-fuel--${resource}`}
      aria-hidden="true"
      style={
        fuelAtlas
          ? {
              backgroundImage: `url(${fuelAtlas})`,
              backgroundPosition: `${(index % 2) * 100}% ${Math.floor(index / 2) * 100}%`,
            }
          : undefined
      }
    >
      {!fuelAtlas && <ResourceIcon resource={resource} />}
    </span>
  );
}

function HousePiece() {
  return (
    <span
      className="pg-rule-house"
      aria-hidden="true"
      style={houseArt ? { backgroundImage: `url(${houseArt})` } : undefined}
    >
      {!houseArt && '⌂'}
    </span>
  );
}

function Diagram({
  kind,
  caption,
  children,
}: {
  kind: 'flow' | 'resources' | 'storage' | 'network' | 'steps' | 'income';
  caption: string;
  children: ReactNode;
}) {
  return (
    <figure className="pg-rule-diagram" data-rule-diagram={kind}>
      <div className="pg-rule-diagram__scene">{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function ScenePlant({ id }: { id: number }) {
  const plant = getPlant(id);
  const art = plantImage(plant.fuel, id);
  const style: CSSProperties = {
    backgroundImage: `url(${art.url})`,
    backgroundPosition: art.position,
    backgroundSize: art.size,
  };
  return (
    <div className="pg-rule-plant">
      <strong className="pg-rule-plant__number">
        {id.toString().padStart(2, '0')}
      </strong>
      <div className="pg-rule-plant__art" style={style} aria-hidden="true" />
      <div className="pg-rule-plant__engine">
        <span>{plant.input ? `耗料 ${plant.input} 份` : '免燃料'}</span>
        <strong>
          <HousePiece />
          {plant.output} 城
        </strong>
      </div>
    </div>
  );
}

const phases = [
  ['排序', '城市多者在前', '同城数比最大厂号'],
  ['竞拍电厂', '按排名选厂', '场内顺时针加价'],
  ['采购燃料', '逆排名', '一家全部买完再换人'],
  ['建设城市', '逆排名', '一家全部建完再换人'],
  ['行政结算', '正排名发电', '收入、补给、更新市场'],
] as const;

export function FlowDiagram() {
  return (
    <Diagram
      kind="flow"
      caption="五阶段每轮循环；STEP 1／2／3 是整局的发展时期。顺序箭头表达规则流程，不是当前玩家状态。"
    >
      <ol className="pg-rule-flow">
        {phases.map(([name, order, detail], index) => (
          <li key={name}>
            <span className="pg-rule-number" aria-hidden="true">
              {index + 1}
            </span>
            <h4>{name}</h4>
            <strong>{order}</strong>
            <span>{detail}</span>
          </li>
        ))}
      </ol>
      <div className="pg-rule-cycle">
        <span aria-hidden="true">↻</span> 结算完成，回到下一轮排序
      </div>
      <div className="pg-rule-first-round">
        <strong>第一轮</strong>
        <span>随机排名</span>
        <b aria-hidden="true">→</b>
        <span>每人必须买厂</span>
        <b aria-hidden="true">→</b>
        <span>按厂号重新排名</span>
      </div>
    </Diagram>
  );
}

export function AuctionOrderExample() {
  return (
    <div className="pg-rule-order-example" data-rule-detail="auction-order">
      <div className="pg-rule-order-example__rank">
        <h4>排名决定谁选厂</h4>
        <ol>
          {[
            ['甲', '6 城', '最大厂号 17'],
            ['乙', '5 城', '最大厂号 15'],
            ['丙', '5 城', '最大厂号 10'],
          ].map(([name, cities, plant], index) => (
            <li key={name}>
              <span className="pg-rule-number">{index + 1}</span>
              <strong>公司{name}</strong>
              <span>{cities}</span>
              <span>{plant}</span>
            </li>
          ))}
        </ol>
        <p>
          选厂 甲 → 乙 → 丙<br />
          采购、建城 丙 → 乙 → 甲
        </p>
      </div>
      <div className="pg-rule-order-example__seats">
        <h4>座位决定谁接着加价</h4>
        <div
          className="pg-rule-seat-ring"
          aria-label="固定座位顺时针为甲、丙、乙"
        >
          <span className="pg-rule-seat pg-rule-seat--a">公司甲</span>
          <span className="pg-rule-seat pg-rule-seat--c">公司丙</span>
          <span className="pg-rule-seat pg-rule-seat--b">公司乙</span>
          <b aria-hidden="true">↻</b>
        </div>
        <p>
          甲发起：甲报价 → 丙 → 乙<br />
          跳过已购厂、整轮不买及退出本场者
        </p>
      </div>
      <div className="pg-rule-auction-market">
        <h4>STEP 1／2 的电厂市场</h4>
        <div>
          <strong>当前市场，可拍</strong>
          <div className="pg-rule-market-row">
            {[3, 4, 5, 6].map((id) => (
              <ScenePlant key={id} id={id} />
            ))}
          </div>
        </div>
        <div className="pg-rule-auction-market__future">
          <strong>未来市场，暂不可拍</strong>
          <div className="pg-rule-market-row">
            {[7, 8, 9, 10].map((id) => (
              <ScenePlant key={id} id={id} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CoalZone({ amount, count }: { amount: number; count: number }) {
  return (
    <div className="pg-rule-coal-zone">
      <strong>{amount} E／份</strong>
      <div>
        {[0, 1, 2].map((slot) => (
          <span
            key={slot}
            className={`pg-rule-resource-slot${slot < count ? ' is-filled' : ''}`}
          >
            {slot < count && <FuelPiece resource="coal" />}
          </span>
        ))}
      </div>
      <span>现有 {count} 份</span>
    </div>
  );
}

export function ResourcesDiagram() {
  return (
    <Diagram
      kind="resources"
      caption="初始价格和印刷容量均为公开规则。采购示例假设便宜价区只余一份煤，不代表正在进行的市场。"
    >
      <div className="pg-rule-initial-prices">
        {RESOURCES.map((resource) => (
          <div key={resource}>
            <FuelPiece resource={resource} />
            <strong>{RESOURCE_LABELS[resource]}</strong>
            <span>初始最低价</span>
            <b>{price(resource, INITIAL_MARKET[resource])} E／份</b>
          </div>
        ))}
      </div>
      <div className="pg-rule-purchase-example">
        <h4>买两份，可能跨两个价区</h4>
        <div className="pg-rule-price-example">
          <CoalZone amount={1} count={1} />
          <span className="pg-rule-arrow" aria-hidden="true">
            →
          </span>
          <CoalZone amount={2} count={3} />
        </div>
        <p className="pg-rule-equation">
          <span>
            第 1 份 <b>1 E</b>
          </span>
          <span aria-hidden="true">＋</span>
          <span>
            第 2 份 <b>2 E</b>
          </span>
          <span aria-hidden="true">＝</span>
          <strong>合计 3 E</strong>
        </p>
      </div>
      <dl className="pg-rule-price-capacity">
        <div>
          <dt>煤／油／垃圾</dt>
          <dd>1–8 E，每种每价各 3 位</dd>
        </div>
        <div>
          <dt>铀</dt>
          <dd>1–8、10、12、14、16 E，每价 1 位</dd>
        </div>
      </dl>
      <div className="pg-rule-resource-cycle">
        <span>市场</span>
        <b aria-hidden="true">→</b>
        <span>电厂仓位</span>
        <b aria-hidden="true">→</b>
        <span>烧料回供应</span>
        <b aria-hidden="true">→</b>
        <span>行政补给市场</span>
      </div>
      <p className="pg-rule-small-note">
        采购从最便宜的有货位置取；补给从最贵空位向便宜处填。
      </p>
    </Diagram>
  );
}

export function StorageDiagram() {
  const plant = getPlant(5);
  return (
    <Diagram
      kind="storage"
      caption="05 号混燃厂：完整输入 2 份，最多供电 1 城，煤油共用 4 个仓位。厂景只是插画，规则由标注决定。"
    >
      <div className="pg-rule-storage-layout">
        <div>
          <ScenePlant id={plant.id} />
          <p className="pg-rule-small-note">厂号 05 也是最低起拍价 5 E</p>
        </div>
        <div className="pg-rule-warehouse">
          <h4>仓储 = 一次输入 × 2</h4>
          <strong>
            {plant.input} × 2 = {plant.input * 2} 个共用仓位
          </strong>
          <div className="pg-rule-warehouse__slots">
            {(['coal', 'coal', 'coal', 'oil'] as const).map(
              (resource, index) => (
                <span key={index}>
                  <FuelPiece resource={resource} />
                </span>
              ),
            )}
          </div>
          <p>3 煤 + 1 油，合法存满；不能另给油再开 4 格。</p>
        </div>
      </div>
      <h4>三种配方，都完整运行一次</h4>
      <div className="pg-rule-fuel-recipes">
        {[
          { label: '2 煤', fuels: ['coal', 'coal'] as const },
          { label: '1 煤 + 1 油', fuels: ['coal', 'oil'] as const },
          { label: '2 油', fuels: ['oil', 'oil'] as const },
        ].map(({ label, fuels }) => (
          <div key={label}>
            <div>
              {fuels.map((resource, index) => (
                <FuelPiece key={index} resource={resource} />
              ))}
            </div>
            <strong>{label}</strong>
            <span aria-hidden="true">↓</span>
            <span>
              <HousePiece />
              最多 {plant.output} 城
            </span>
          </div>
        ))}
      </div>
      <div className="pg-rule-limit-pair">
        <span>不能半烧，换半次供电</span>
        <span>不能双倍烧料，一轮运行两次</span>
      </div>
    </Diagram>
  );
}

function routeCost(cities: readonly string[]) {
  return cities.slice(1).map((city, index) => {
    const previous = cities[index]!;
    const edge = GERMANY_EDGES.find(
      ({ from, to }) =>
        (from === previous && to === city) ||
        (to === previous && from === city),
    );
    if (!edge) throw new Error('规则图解引用了不存在的德国线路。');
    return edge.cost;
  });
}
const cheapRoute = ['duisburg', 'essen', 'dusseldorf', 'aachen'] as const;
const detour = ['duisburg', 'essen', 'dusseldorf', 'koln', 'aachen'] as const;
const cheapCosts = routeCost(cheapRoute);
const detourCosts = routeCost(detour);
const cheapTotal = cheapCosts.reduce((sum, cost) => sum + cost, 0);
const detourTotal = detourCosts.reduce((sum, cost) => sum + cost, 0);

function RoutePath({
  cities,
  costs,
}: {
  cities: readonly string[];
  costs: readonly number[];
}) {
  return (
    <ol className="pg-rule-route">
      {cities.map((city, index) => (
        <li key={city}>
          <div
            className={`pg-rule-city${index === 0 ? ' is-owned' : index === cities.length - 1 ? ' is-target' : ''}`}
          >
            <HousePiece />
            <strong>{getCity(city).name}</strong>
            <span>
              {index === 0
                ? '本人已有城市'
                : index === cities.length - 1
                  ? '新城首位 10 E'
                  : '经过，不占位'}
            </span>
          </div>
          {index < costs.length && (
            <span className="pg-rule-edge">
              <b>{costs[index]} E</b>
              <span aria-hidden="true">→</span>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function NetworkDiagram() {
  return (
    <Diagram
      kind="network"
      caption="经典德国地图中的公开线路片段，仅作静态规则示例。所经城市可空、被别人占据或已满，连接费用照付。"
    >
      <h4>从本人城市到新城，比较整条路线</h4>
      <RoutePath cities={cheapRoute} costs={cheapCosts} />
      <div className="pg-rule-route-total">
        <span>
          连接费{' '}
          <b>
            {cheapCosts.join(' + ')} = {cheapTotal} E
          </b>
        </span>
        <span aria-hidden="true">＋</span>
        <span>
          占位费 <b>10 E</b>
        </span>
        <strong>总价 {cheapTotal + 10} E</strong>
      </div>
      <div className="pg-rule-detour">
        <strong>另一条路线，经科隆</strong>
        <p>{detour.map((city) => getCity(city).name).join(' → ')}</p>
        <span>
          连接 {detourCosts.join(' + ')} = {detourTotal}{' '}
          E，另加占位费；这条更贵。
        </span>
      </div>
      <div className="pg-rule-limit-pair">
        <span>本轮刚建的城市，可作下次起点</span>
        <span>每次建新城，重新支付完整路线费</span>
      </div>
    </Diagram>
  );
}

export function StepsDiagram() {
  return (
    <Diagram
      kind="steps"
      caption="STEP 控制可用城市位置与市场。抽到第三步牌后，在对应阶段边界生效，不能提前开放后续位置。"
    >
      <div className="pg-rule-step-cities">
        {[1, 2, 3].map((step) => (
          <div key={step}>
            <h4>STEP {step}</h4>
            <div className="pg-rule-step-cities__slots">
              {[10, 15, 20].map((cost, index) => (
                <span
                  key={cost}
                  className={index < step ? 'is-open' : 'is-locked'}
                >
                  <HousePiece />
                  <b>{cost} E</b>
                  <span>{index < step ? '可用' : '未开放'}</span>
                </span>
              ))}
            </div>
            <strong>每城最多 {step} 家公司</strong>
            <span>
              {step === 3 ? '市场 6 厂，全部可拍' : '市场 8 厂，最低 4 厂可拍'}
            </span>
          </div>
        ))}
      </div>
      <div className="pg-rule-step-boundary">
        <h4>达到第二步阈值</h4>
        <div className="pg-rule-resource-cycle">
          <span>全体完成本轮建城</span>
          <b aria-hidden="true">→</b>
          <span>进入 STEP 2</span>
          <b aria-hidden="true">→</b>
          <span>本次行政用第二步补给</span>
        </div>
        <p>第二城市位置，要等下次建城才能使用。</p>
      </div>
      <dl className="pg-rule-step-triggers">
        <div>
          <dt>竞拍抽到第三步牌</dt>
          <dd>购厂机会全部结束 → 采购开始，STEP 3 生效</dd>
        </div>
        <div>
          <dt>建城补牌抽到</dt>
          <dd>本轮建城保持旧容量 → 行政开始，STEP 3 生效</dd>
        </div>
        <div>
          <dt>行政市场更新抽到</dt>
          <dd>本次最后用 STEP 2 补给 → 下一轮开始，STEP 3 生效</dd>
        </div>
      </dl>
    </Diagram>
  );
}

export function IncomeDiagram() {
  const plants = [7, 10, 15].map(getPlant);
  const capacity = plants.reduce((sum, plant) => sum + plant.output, 0);
  const cities = 6;
  return (
    <Diagram
      kind="income"
      caption="出版规则示例：07、10、15 号厂共烧 3 油和 4 煤，产能 7；只有 6 座城市，最多供 6 城，收入 73 E。"
    >
      <div className="pg-rule-income-plants">
        {plants.map((plant) => (
          <div key={plant.id}>
            <ScenePlant id={plant.id} />
            <span>{plant.id === 7 ? '烧 3 油' : '烧 2 煤'}</span>
          </div>
        ))}
      </div>
      <div className="pg-rule-income-result">
        <div>
          <span>产生电力</span>
          <strong>{capacity} 城</strong>
        </div>
        <span aria-hidden="true">与</span>
        <div>
          <span>已有城市</span>
          <strong>{cities} 城</strong>
        </div>
        <span aria-hidden="true">→</span>
        <div>
          <span>实际供电</span>
          <strong>{Math.min(capacity, cities)} 城</strong>
        </div>
        <span aria-hidden="true">→</span>
        <div className="pg-rule-income-result__cash">
          <span>本轮收入</span>
          <strong>{income(cities)} E</strong>
        </div>
      </div>
      <p className="pg-rule-small-note">
        多余 1 城电力作废。可以少供电，但已经完整烧掉的燃料不返还。
      </p>
      <div className="pg-rule-income-minimum">
        <span>
          供电 0 城 <b>{income(0)} E</b>
        </span>
        <span>
          供电 20＋城 <b>{income(20)} E</b>
        </span>
      </div>
    </Diagram>
  );
}

export function EndgameExample() {
  return (
    <div className="pg-rule-endgame" data-rule-detail="endgame">
      <h4>四人终局示例：建城领先，也可能输</h4>
      <div className="pg-rule-endgame__companies">
        <div>
          <strong>公司甲</strong>
          <span>
            <HousePiece />
            已建 17 城
          </span>
          <span>
            现有厂和燃料可供 <b>12 城</b>
          </span>
        </div>
        <div className="is-winner">
          <strong>公司乙</strong>
          <span>
            <HousePiece />
            已建 16 城
          </span>
          <span>
            现有厂和燃料可供 <b>14 城</b>
          </span>
          <b>乙获胜</b>
        </div>
      </div>
      <div className="pg-rule-endgame__priority">
        <span>
          <b>1</b> 实际供电
        </span>
        <span aria-hidden="true">→</span>
        <span>
          <b>2</b> 剩余现金
        </span>
        <span aria-hidden="true">→</span>
        <span>
          <b>3</b> 已建城市
        </span>
      </div>
    </div>
  );
}
