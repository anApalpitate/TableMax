/* eslint-disable react-refresh/only-export-components -- Static rule chapters are composed by the platform display shell. */
import { INCOME, settingsFor } from '../data/economy';
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
    '城市多者在前；同城数比最大电厂编号。第一轮先随机，竞拍结束后再按电厂重排。',
  ],
  [
    '2',
    '竞拍电厂',
    '正序选厂，其他有资格者按固定顺时针座位加价。每轮最多买一厂；第一轮每人必须买厂。',
  ],
  [
    '3',
    '采购资源',
    '逆序逐人采购，从最便宜份额开始付钱，只能买本人的电厂能储存的燃料。',
  ],
  ['4', '建设城市', '逆序逐人建城，支付占位费与最便宜完整路线费；也可不建设。'],
  [
    '5',
    '行政结算',
    '正序逐人烧料发电、结束供电并收收入，然后统一补给资源和更新电厂市场。',
  ],
] as const;

export const powerGridRulebook = {
  className: 'pg-rules',
  summary: (
    <>
      经营经典德国电网：竞拍电厂、买燃料、连接城市、供电赚钱。终局比能实际供电的城市数。
    </>
  ),
  chapters: [
    {
      id: 'pg-rules-flow',
      label: '五个阶段',
      title: '每轮都按五个阶段前进',
      content: (
        <>
          <p>
            每人起始 50
            电币（E）。先选择相邻区域，随后反复进行下列五阶段。“第几轮”与“第几步”（STEP）
            是不同的进度。
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
          <p>
            领先者先选厂，落后者先买资源、先建城。顺序在轮内固定，不因刚买厂或刚建城而改变。
          </p>
        </>
      ),
    },
    {
      id: 'pg-rules-plants',
      label: '电厂与燃料',
      title: '读厂牌，再买够燃料',
      content: (
        <>
          <GuideImage
            name="market"
            caption="电厂市场与资源市场：厂牌编号是最低起拍价；燃料标记和数字表示一次运行所需输入；闪电后的数字表示可供电城市数。"
          />
          <p>
            STEP 1、2 只可拍当前市场最小四厂；STEP 3
            的六厂全部可拍。出价必须高于当前价且付得起。退出该场后不能回来；发起时选“本轮跳过”则失去整轮后续竞拍资格。
          </p>
          <p>
            两人每人最多四厂，其他人数最多三厂。超限时拆旧厂，不能拆刚购入的新厂；旧燃料可转存到合法仓位或弃回供应。
          </p>
          <GuideImage
            name="company"
            caption="公开公司牌：电厂类型、燃料仓储和城市数公开。每厂最多存一次输入量的两倍；各玩家现金在游戏中仅本人可见。"
          />
          <p>
            混燃厂的煤与油共用仓位，可自由混合所需份数。环保厂和核聚变厂不用燃料。每厂一轮最多运行一次，必须支付完整输入；多出的电力不增加收入。
          </p>
          <div className="pg-rulebook__example">
            <h4>混燃示例</h4>
            <p>
              输入 2 的煤油厂可以烧 2 煤、1 煤 + 1 油，或 2 油。最多储存 4
              份煤油合计。燃料用完回供应，等行政补给才回市场。
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'pg-rules-network',
      label: '路线与 STEP',
      title: '占位费 + 路线费，组成建城总价',
      content: (
        <>
          <GuideImage
            name="network"
            caption="经典德国地图：线路数字是连接费，城市位置为 10／15／20 电币。可建选项使用完整最便宜路线，不是只看相邻的一条线。"
          />
          <p>
            首城只付最低空位占位费。以后从本人任一已建城市到新城，计算最便宜完整路线；同一回合刚建的城市也可作为起点。路线能经过空城、他人城市或已满城市，但不能借他人网络免费连接。
          </p>
          <p>
            每次建新城都重新支付该次完整路线费；曾付过的线路不会永久免费。城市只能在所选区域内建，路线也只能走所选区域。
          </p>
          <div className="pg-rulebook__steps">
            <div>
              <h4>STEP 1</h4>
              <p>每城最多一位玩家，占位 10 E。</p>
            </div>
            <div>
              <h4>STEP 2</h4>
              <p>每城最多两位玩家，新增位置 15 E；空城首位仍只付 10 E。</p>
            </div>
            <div>
              <h4>STEP 3</h4>
              <p>每城最多三位玩家，第三位置 20 E；所有市场电厂可拍。</p>
            </div>
          </div>
          <p>
            第二步在人数对应阈值达成的整次建城结束后触发，新位置从下次建城开放。第三步由第三步牌触发，在规定的下一阶段边界生效，界面的
            STEP 显示可用状态；两者都不是“第 2 轮／第 3 轮”。
          </p>
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
        </>
      ),
    },
    {
      id: 'pg-rules-scoring',
      label: '收入与胜负',
      title: '赚收入，留够终局所需燃料',
      content: (
        <>
          <p>
            运行电厂后明确“结束供电”，选择不超过本人城市数和已产生电力的供电数；主动少供电不退燃料。收入只看实际供电城市，0
            城也能领 10 E。
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
            有人达到终局城市阈值时，所有玩家仍完成整次建城，随后直接结算，不再买资源。比较已有城市、电厂和燃料实际能供电的最多城市数；平手依次比较剩余现金、已建城市数。
          </p>
          <p>
            TableMax
            自动选择达到最大供电数的最少燃料合法方案，并实际扣除燃料。三级完全相同记共同赢家。自动选方案与共同赢家是项目采用方式；经典供电、费用及地图规则保持。
          </p>
        </>
      ),
    },
  ],
  source: (
    <>
      采用经典基础版德国修正版（2009 规则文本），不使用 Recharged
      或其他地图规则。出版依据为 Rio Grande Games 经典规则与 2F Games 经典
      FAQ；逐卡认证边界见项目来源页。配图来自隔离示例的公开区域，现金保密，正式游玩无需联网。
    </>
  ),
};
