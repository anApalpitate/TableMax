/* eslint-disable react-refresh/only-export-components -- Static rule chapters are composed by the platform display shell. */
import { INITIAL_MARKET, INCOME, price, settingsFor } from '../data/economy';
import './rules-guide.css';

const screenshots = import.meta.glob(
  '../../../assets/games/power-grid/rules/*.webp',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;
function GuideImage({ name, caption }: { name: string; caption: string }) {
  const src =
    screenshots[`../../../assets/games/power-grid/rules/${name}.webp`];
  return src ? (
    <figure>
      <img src={src} alt={caption} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  ) : null;
}
const phases = [
  [
    '1',
    '排序',
    '城市多者在前；同城数比最大电厂编号。第一轮先随机，竞拍结束后按电厂重新排序。',
  ],
  [
    '2',
    '竞拍电厂',
    '按排序正序选厂，场内加价按固定座位顺时针。一轮每人最多买一厂。',
  ],
  [
    '3',
    '采购燃料',
    '按排序逆序，一家公司买完再换下一家；逐份支付市场最便宜的现有单价。',
  ],
  [
    '4',
    '建设城市',
    '仍按排序逆序；支付城市占位费与本次最便宜完整路线费。可以不建城。',
  ],
  [
    '5',
    '行政结算',
    '正序逐厂发电、明确结束供电并收入；全体完成后补给资源、更新市场、进入下一轮。',
  ],
] as const;
const resourceLabels = {
  coal: '煤',
  oil: '油',
  garbage: '垃圾',
  uranium: '铀',
} as const;
function OrderExample({ reverse = false }: { reverse?: boolean }) {
  return (
    <div
      className="pg-rulebook__order"
      aria-label={reverse ? '逆序采购与建城示例' : '正序选厂示例'}
    >
      {(reverse
        ? ['第3名', '第2名', '第1名']
        : ['第1名', '第2名', '第3名']
      ).map((name, i) => (
        <span key={name}>
          <b>{name}</b>
          {i < 2 && <i aria-hidden="true">→</i>}
        </span>
      ))}
    </div>
  );
}
function PriceZones({ uranium = false }: { uranium?: boolean }) {
  const prices = uranium
    ? [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16]
    : [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div
      className={`pg-rulebook__price-zones${uranium ? ' pg-rulebook__price-zones--uranium' : ''}`}
      aria-label={
        uranium
          ? '铀价格区示意，每格一份'
          : '煤、油、垃圾价格区示意，每种每格三份'
      }
    >
      {prices.map((amount) => (
        <div key={amount}>
          <b>{amount} E</b>
          <span aria-hidden="true">{uranium ? '●' : '● ● ●'}</span>
        </div>
      ))}
    </div>
  );
}

export const powerGridRulebook = {
  className: 'pg-rules',
  summary: (
    <>
      经营经典德国电网：买厂、买燃料、连接城市，供电赚钱。终局比较真正能供电的城市数，不只看城市数量。
    </>
  ),
  chapters: [
    {
      id: 'pg-rules-flow',
      label: '目标与五阶段',
      title: '先看一轮流程，再看三个发展时期',
      content: (
        <>
          <p>
            每人起始 50
            电币（E）。全体使用选定的一整组相邻区域；数字版由首位行动者选择区域。先随机排第一轮顺序，然后重复五阶段。
          </p>
          <ol className="pg-rulebook__phases">
            {phases.map(([number, name, text]) => (
              <li key={number}>
                <span aria-hidden="true">{number}</span>
                <div>
                  <h4>{name}</h4>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="pg-rulebook__example">
            <h4>第一轮有两个例外</h4>
            <p>
              每人必须买一座电厂，不能选择“本轮不买电厂”。全部买完后按最大电厂编号从高到低重新排序，再开始逆序采购。第一轮可以不建城。
            </p>
          </div>
          <p>
            “第几轮”是五阶段循环的次数；“第几步”（STEP
            1／2／3）是整局的发展时期。不是每轮升级一步，也不是五阶段中的序号。
          </p>
        </>
      ),
    },
    {
      id: 'pg-rules-order',
      label: '顺序与竞拍',
      title: '选厂按排名，场内加价按围桌顺时针',
      content: (
        <>
          <p>
            轮首按已建城市数从多到少排名；同城数比最大电厂编号，编号大者在前。除第一轮例外，本轮刚买厂或建城不会立即改排名。
          </p>
          <GuideImage
            name="order"
            caption="实际行动顺序区域：按排名选厂，逆序采购与建城；场内加价另按固定围桌顺时针，并跳过失去购厂资格的公司。"
          />
          <h4>正序：决定谁先选厂</h4>
          <OrderExample />
          <p>
            当前第一位有购买资格的公司从“可竞拍电厂”中选一厂，报不低于厂号的整数起价。第一、二步只可选最小四厂；第三步六厂全可竞拍。
          </p>
          <div className="pg-rulebook__example">
            <h4>顺时针：决定谁接着加价</h4>
            <p>
              加价使用固定围桌座位环，跳过已购厂、整轮不买或已退出该场的人。它与轮首排名是两种顺序。报价必须高于当前最高价，且本人现金足够。
            </p>
            <div className="pg-rulebook__seat-ring" aria-label="围桌顺时针示例">
              <span>公司甲</span>
              <span>公司乙</span>
              <span>公司丙</span>
              <b aria-hidden="true">↻</b>
            </div>
            <p>
              例如围桌是甲→乙→丙，即使排名是甲→丙→乙，甲发起后仍由乙先加价，再到丙；已失去资格者跳过。
            </p>
          </div>
          <h4>两种退出，后果不同</h4>
          <dl className="pg-rulebook__choices">
            <div>
              <dt>退出本次竞拍</dt>
              <dd>不能重回这场，但本轮还可参加之后的竞拍。</dd>
            </div>
            <div>
              <dt>本轮不买电厂</dt>
              <dd>选厂时直接跳过，失去本轮全部后续购厂资格；第一轮不能用。</dd>
            </div>
          </dl>
          <p>
            一轮最多买一厂。购厂者退出本轮其余竞拍；发起者自己赢了，换下一位有资格者选厂；别人赢了，原发起者继续选厂或本轮跳过。成交后立即补牌并按编号重排市场。
          </p>
          <p>
            两人每人最多四厂，其他人数最多三厂。超限先拆一座旧厂，不能拆刚买的新厂；旧燃料逐份转存到合法仓位，或自愿弃回供应。全部处理完才继续竞拍。
          </p>
        </>
      ),
    },
    {
      id: 'pg-rules-resources',
      label: '采购与价格区',
      title: '落后者先买，按现有最便宜价逐份付钱',
      content: (
        <>
          <GuideImage
            name="market"
            caption="实际电厂市场：当前市场列出可竞拍电厂，未来市场暂不可拍；购厂后立即补牌并按编号重排。"
          />
          <GuideImage
            name="resource-prices"
            caption="实际燃料价区：现有资源从最便宜价格逐份购买，空位表示此价位暂无可买燃料；每份保存后当前单价重新更新。"
          />
          <h4>逆序：一家完成后，下一家再开始</h4>
          <OrderExample reverse />
          <p>
            采购与建城都从本轮排名最后者开始。一家公司可买多份，但每份分别付款，买完明确结束采购；资源售罄后当轮不能继续买。不是所有玩家同时抢购。
          </p>
          <h4>煤、油、垃圾：每种在每个价位各放三份</h4>
          <PriceZones />
          <h4>铀：每个价位只放一份</h4>
          <PriceZones uranium />
          <p className="pg-rulebook__diagram-note">
            以上是公开印刷价区示意，不代表当前市场余量。数字是每一份的电币价格，圆点表示该价位的容量。
          </p>
          <dl
            className="pg-rulebook__initial-prices"
            aria-label="第一轮初始最低燃料价"
          >
            {(['coal', 'oil', 'garbage', 'uranium'] as const).map(
              (resource) => (
                <div key={resource}>
                  <dt>{resourceLabels[resource]}</dt>
                  <dd>{price(resource, INITIAL_MARKET[resource])} E／份</dd>
                </div>
              ),
            )}
          </dl>
          <div className="pg-rulebook__example">
            <h4>同一次采购，价格也会升</h4>
            <p>
              若 1 E 价位只剩一份煤，下一档为 2 E，连续买两份要付 1 + 2 = 3
              E；不能把第一份单价套用到全部数量。界面的当前价随每份保存后的市场变化更新。
            </p>
          </div>
          <p>
            只买本人现有电厂能储存的燃料；仓位不是通用背包。有限资源总量为煤／油／垃圾各
            24 份、铀 12
            份。燃烧和弃置先回供应，不立即补到市场；行政阶段才按人数和 STEP
            补给，并从最贵空位向便宜处填。
          </p>
        </>
      ),
    },
    {
      id: 'pg-rules-plants',
      label: '厂牌与仓位',
      title: '一次耗料、供电能力、仓储容量各不相同',
      content: (
        <>
          <GuideImage
            name="company"
            caption="实际公司区域：类型符号与深色框标记燃料；耗料是一次运行输入，供电是最多城市数；仓位显示已有资源占用，游戏中现金仅本人可见。"
          />
          <p>
            厂号既是编号也是最低起拍价，插画不决定规则。每厂最多存一次输入的两倍，只存它能用的燃料。混燃厂的煤和油共用总仓位；环保厂、核聚变厂不耗燃料，也不提供仓位。
          </p>
          <div className="pg-rulebook__example">
            <h4>混燃示例：输入 2，仓位共 4</h4>
            <div className="pg-rulebook__recipes">
              <span>2 煤</span>
              <span>1 煤 + 1 油</span>
              <span>2 油</span>
            </div>
            <p>
              三种配方都能完整启动一次，不能只烧一份换半次供电。输入 3 的 46
              号厂有四种配方；选择燃料展开后逐个呈现。
            </p>
          </div>
          <p>
            本人电厂之间可把兼容燃料逐份转存，满仓混燃可使用合法煤油交换；重排不花电币。不能转给其他公司，不能超仓，不能把煤塞进燃油厂。
          </p>
        </>
      ),
    },
    {
      id: 'pg-rules-network',
      label: '建城与路线',
      title: '占位费 + 本次完整路线费 = 建城总价',
      content: (
        <>
          <GuideImage
            name="network"
            caption="实际德国地图与城市预览：线路标签为连接费，城市位置为 10／15／20 E。手机预览列出占位费、整条路线费和总价，不是只读相邻的一条线。"
          />
          <p>
            建城仍按本轮排名逆序。首城只付最低空位占位费；之后从本人任一已建城市到新城，计算本次最便宜完整路线。同一次建城阶段刚建的城市，也可以成为下一次路线起点。
          </p>
          <div className="pg-rulebook__example">
            <h4>路线计算示例</h4>
            <p>
              假设所选路线连续两段费用为 3 E 和 5 E，新城最低空位是 10
              E，总价就是 3 + 5 + 10 = 18
              E。界面预览使用真实地图的最低总路线；此例只演示加法，不是一条指定的德国线路。
            </p>
          </div>
          <p>
            路线可经过空城、他人城市或已满城市，但不占经过城市的位置。只能走所选区域，不能借别人网络免费连接；每次建新城重新支付该次完整路线费，曾付过的线路不会永久免费。本人不能在同一城市放第二栋房屋。
          </p>
        </>
      ),
    },
    {
      id: 'pg-rules-steps',
      label: 'STEP 与补给',
      title: 'STEP 决定城市容量与可拍市场',
      content: (
        <>
          <div className="pg-rulebook__steps">
            <div>
              <h4>STEP 1</h4>
              <p>每城最多一家公司，空位 10 E。</p>
            </div>
            <div>
              <h4>STEP 2</h4>
              <p>每城最多两家公司，第二位置 15 E；空城首位仍为 10 E。</p>
            </div>
            <div>
              <h4>STEP 3</h4>
              <p>每城最多三家公司，第三位置 20 E；市场六厂全部可拍。</p>
            </div>
          </div>
          <dl className="pg-rulebook__thresholds">
            {[2, 3, 4, 5, 6].map((players) => {
              const setting = settingsFor(players);
              return (
                <div key={players}>
                  <dt>{players} 人</dt>
                  <dd>
                    第二步 {setting.step2} 城<br />
                    终局 {setting.end} 城
                  </dd>
                </div>
              );
            })}
          </dl>
          <p>
            有人达到第二步阈值后，仍完成所有人的整次建城；再移除市场最小厂并补牌，行政采用第二步补给。第二城市位置要到下次建城才能使用。
          </p>
          <h4>第三步牌：抽到时机决定生效边界</h4>
          <dl className="pg-rulebook__choices">
            <div>
              <dt>竞拍期间抽到</dt>
              <dd>
                暂放未来市场并洗牌，所有人完成购厂机会后，采购阶段开始时进入第三步。
              </dd>
            </div>
            <div>
              <dt>建城补牌时抽到</dt>
              <dd>本轮剩余建城仍用旧容量，行政阶段开始时进入第三步。</dd>
            </div>
            <div>
              <dt>行政市场更新时抽到</dt>
              <dd>
                本次最后使用第二步补给，下一轮开始进入第三步；即使之前仍是第一步，也不继续用第一步表。
              </dd>
            </div>
          </dl>
          <p>
            第三步可直接跳过第二步。第二步入场补牌正好抽到第三步的交叉情形，项目按建城结束边界立即进入第三步，本次行政用第三步补给；此项为项目解释。界面
            STEP 显示当前可用状态。
          </p>
        </>
      ),
    },
    {
      id: 'pg-rules-scoring',
      label: '发电与收入',
      title: '完整烧料一次，收入按实际供电城市',
      content: (
        <>
          <p>
            行政阶段按正序。每厂每轮最多运行一次，必须烧完整输入；不能加倍燃料运行两次。电力多于城市时多余部分作废，环保与聚变也需要明确启动。
          </p>
          <p>
            运行后明确“结束供电”，选择不超过本人城市数和本轮已产生电力的整数供电数；可以少供电，但不返还已烧燃料。0
            城也有 10 E 收入。
          </p>
          <dl className="pg-rulebook__income" aria-label="供电城市收入表">
            {INCOME.map((amount, cities) => (
              <div key={cities}>
                <dt>{cities === 20 ? '20+ 城' : `${cities} 城`}</dt>
                <dd>{amount} E</dd>
              </div>
            ))}
          </dl>
          <p>
            所有公司完成行政后，资源依当前人数／STEP
            补给，再更新市场。第一、二步把最大厂放牌堆底并补牌；第三步移除最小厂并补牌。市场始终重排，第三步牌堆耗尽后不制造替代牌。
          </p>
        </>
      ),
    },
    {
      id: 'pg-rules-end',
      label: '终局与秘密',
      title: '终局比实际供电，现金和城市用于平局',
      content: (
        <>
          <p>
            有人达到上表终局阈值，仍完成全体整次建城，随后直接终局；不再买燃料或电厂。只有已有城市、电厂和燃料能实际供电的数量计入成绩。
          </p>
          <div className="pg-rulebook__winning">
            <span>① 实际供电多</span>
            <span>② 剩余现金多</span>
            <span>③ 已建城市多</span>
          </div>
          <p>
            TableMax
            自动选择达到最大供电数的最少燃料合法方案，真实扣料并显示逐厂运行与配方；省略不影响胜负的最后收入。自动选最少燃料、三级完全相同记共同赢家属于项目采用方式。
          </p>
          <p>
            游戏中只有本人能看自己的现金；公开电厂、燃料、城市、拍卖和行动顺序，终局才显示各家现金。牌堆顺序与秘密移除的牌号不公开，规则卡片也不会显示它们。
          </p>
        </>
      ),
    },
  ],
  source: (
    <>
      采用经典基础版德国修正版（2009 规则文本），不混入 Recharged。出版依据为
      Rio Grande Games 经典规则与 2F Games 经典
      FAQ；部分逐卡数据的出版认证缺口仍见项目来源页。价格图解是公开规则示意，三张界面配图来自隔离示例的实际渲染，正式游玩不依赖互联网。
    </>
  ),
};
