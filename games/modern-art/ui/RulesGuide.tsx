/* eslint-disable react-refresh/only-export-components -- Static rule chapters are composed by the platform display shell. */
import type { ReactNode } from 'react';
import { AuctionMark } from './painting-display';
import { auctionNames } from './public/labels';
import type { AuctionKind } from './view';
import './rules-guide.css';

const illustrations = import.meta.glob(
  '../../../assets/games/modern-art/rules/illustrations-v2/*.webp',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;
function GuideImage({
  name,
  caption,
  children,
}: {
  name: string;
  caption: string;
  children?: ReactNode;
}) {
  const src =
    illustrations[
      `../../../assets/games/modern-art/rules/illustrations-v2/${name}.webp`
    ];
  return (
    <figure className="ma-rulebook__diagram" data-rule-illustration={name}>
      {src && <img src={src} alt={caption} loading="lazy" />}
      {children}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
function RuleFlow({ steps }: { steps: string[] }) {
  return (
    <ol className="ma-rulebook__flow">
      {steps.map((step, i) => (
        <li key={step}>
          <span className="ma-rulebook__step-number">{i + 1}</span>
          <span>{step}</span>
          {i < steps.length - 1 && <b aria-hidden="true">→</b>}
        </li>
      ))}
    </ol>
  );
}
const auctions: {
  kind: AuctionKind;
  image: string;
  steps: string[];
  detail: string;
}[] = [
  {
    kind: 'open',
    image: 'auction-open',
    steps: ['自由加价', '确认当前价', '全员确认后成交'],
    detail:
      '公开报价必须高于当前价。点击“本次不加价”只确认眼前的价格；有人加价后，旧确认清空，可以重新选择。领先者视为确认，其余人全部确认才成交。没人报价时，全部确认后免费归拍卖人。',
  },
  {
    kind: 'once',
    image: 'auction-once',
    steps: ['从拍卖人左侧开始', '逐席出价一次或放弃', '拍卖人最后决定'],
    detail:
      '沿座位顺序，每人只有一次出价机会；出价须高于当前价。最高价得画。所有人都不出价时，画作免费归拍卖人。',
  },
  {
    kind: 'sealed',
    image: 'auction-sealed',
    steps: ['秘密填写金额', '提交后锁定', '全员提交一起揭标'],
    detail:
      '每人提交一次，0 表示不投标。最高价得画；最高价相同，实际拍卖人优先，否则从他左侧顺时针找最近的同价玩家。全部为 0 时，免费归拍卖人。提交状态公开，揭标前金额保密。',
  },
  {
    kind: 'fixed',
    image: 'auction-fixed',
    steps: ['拍卖人设定价格', '左侧起逐席询问', '首位买入或卖家自购'],
    detail:
      '拍卖人只能设定自己付得起的价格。第一位接受者买入；其他人都拒绝时，拍卖人按原价付银行并取得画作。TableMax 允许定价为 0，以便资金耗尽时仍可推进；这是项目采用项。',
  },
  {
    kind: 'double',
    image: 'auction-double',
    steps: ['双拍首幅上拍', '补同画家非双拍牌', '按第二幅的方式合卖'],
    detail:
      '先问原拍卖人是否补画，再从他左侧逐席询问。第二幅不能也是双拍。别人补画，就由补画者接任拍卖人，收全部货款；下一次从他左侧出画，中间玩家的出画机会跳过。无人补画，首幅免费归原拍卖人。',
  },
];

export const modernArtRulebook = {
  className: 'ma-rules',
  summary: (
    <>
      经营博物馆四轮：用手牌发起拍卖，买入值得收藏的画，轮末按行情兑现。最终现金最多者获胜，平手共同获胜。
    </>
  ),
  chapters: [
    {
      id: 'ma-rules-flow',
      label: '回合与选画',
      title: '选画上拍，经营你的博物馆',
      content: (
        <>
          <p>
            经典玩法支持 3–5 人，每人从 100
            千元开始。稳定座位首席先出画，之后按公开座位顺序推进。轮到你时，点一幅手牌上拍；画家色标表示归属，拍卖角标决定方式。选画不计时。
          </p>
          <GuideImage
            name="hand-to-auction"
            caption="规则示意：私人手牌进入拍卖台，得标画作进入公开收藏；并非游戏界面截图。"
          >
            <RuleFlow
              steps={['本人手牌选一幅', '按角标进行拍卖', '得标者加入公开收藏']}
            />
            <div className="ma-rulebook__payment">
              <span>他人买入 → 货款给拍卖人</span>
              <span>拍卖人自购 → 货款给银行</span>
            </div>
          </GuideImage>
          <p>
            现金与手牌仅本人可见，收藏和手牌张数公开。没牌的人不能发起拍卖，仍可以竞拍。除双拍交接外，下一次由拍卖人左侧玩家出画。
          </p>
          <table className="ma-rulebook__table">
            <caption>每人发牌张数；未拍出的手牌保留</caption>
            <thead>
              <tr>
                <th>人数</th>
                <th>开局</th>
                <th>第 2 轮</th>
                <th>第 3 轮</th>
                <th>第 4 轮</th>
              </tr>
            </thead>
            <tbody>
              {[
                [3, 10, 6, 6, 0],
                [4, 9, 4, 4, 0],
                [5, 8, 3, 3, 0],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((n, i) =>
                    i === 0 ? (
                      <th scope="row" key={i}>
                        {n} 人
                      </th>
                    ) : (
                      <td key={i}>{n}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    },
    {
      id: 'ma-rules-market',
      label: '行情与轮末',
      title: '看本轮热度，也看历史价值',
      content: (
        <>
          <p>
            市场“已上拍 n /
            5”只统计本轮出现数量；方形白数字是该画家全套总量，不是牌库剩余。板序依次为
            Manuel、Sigrid、Daniel、Ramon、Rafael，总量为 12、13、14、15、16
            张。
          </p>
          <GuideImage
            name="round-trigger"
            caption="第五幅立即结束本轮。双拍第二幅是第五幅时，最后两幅均不成交。"
          >
            <div className="ma-rulebook__boundaries">
              <p>
                <strong>单幅／双拍首幅成为第 5 幅</strong>
                <br />第 5 幅无主、不拍卖；双拍首幅也不再补画。
              </p>
              <p>
                <strong>双拍第二幅成为第 5 幅</strong>
                <br />
                最后两幅都无主、不成交，但两幅都计入热度。
              </p>
            </div>
          </GuideImage>
          <p>
            只给本轮出现过的画家排名，数量相同按市场从左到右优先。前三名本轮分别增值
            30／20／10 千元；其每幅兑现值是历史累计加本轮增值。跌出前三时本轮兑
            0，过去的价值继续保留。
          </p>
          <GuideImage
            name="history-value"
            caption="同一画家四轮示例：历史一直保留，是否兑现由本轮前三资格决定。"
          >
            <table className="ma-rulebook__table">
              <thead>
                <tr>
                  <th>轮次</th>
                  <th>本轮资格</th>
                  <th>本轮增值</th>
                  <th>每幅兑现</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['1', '第一名', 30, 30],
                  ['2', '第二名', 20, 50],
                  ['3', '未入前三', 0, 0],
                  ['4', '第三名', 10, 60],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((value, i) => (
                      <td key={i}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </GuideImage>
          <p>
            市场的大数字是“按目前公开数量计算的每幅预估兑现”，会随出画改变，不保证最终结算，也不是扣除买画成本后的利润。历史增值可从“历轮行情”查看。
          </p>
        </>
      ),
    },
    {
      id: 'ma-rules-auctions',
      label: '五种拍卖',
      title: '认角标，按对应方式竞拍',
      content: (
        <>
          <p>
            报价以整数千元计，不得超过本人现金。公开与一次拍卖必须高于当前价。双拍两幅必须是同一画家，合起来只进行一次拍卖。
          </p>
          <div className="ma-rulebook__auctions">
            {auctions.map(({ kind, image, steps, detail }) => (
              <section key={kind}>
                <h4>
                  <span className="ma-rulebook__auction-mark">
                    <AuctionMark kind={kind} />
                  </span>
                  {auctionNames[kind]}
                </h4>
                <GuideImage
                  name={image}
                  caption={`${auctionNames[kind]}规则示意；步骤与数字由界面文字准确说明。`}
                >
                  <RuleFlow steps={steps} />
                </GuideImage>
                <p>{detail}</p>
              </section>
            ))}
          </div>
          <p>
            上方进度条仅提醒思考时间，到时响一次提示音；仍可完成合法操作，不自动报价、弃权或成交。静音和查看规则不改变拍卖规则。
          </p>
        </>
      ),
    },
    {
      id: 'ma-rules-scoring',
      label: '兑现与胜负',
      title: '收藏每轮兑现，最终比较现金',
      content: (
        <>
          <GuideImage
            name="settlement"
            caption="本轮收藏按行情兑现后移出游戏；未拍出的手牌保留。四轮结束比较最终现金。"
          >
            <RuleFlow
              steps={[
                '按画家兑现本轮收藏',
                '已买收藏移出游戏',
                '保留手牌进入后续轮次',
              ]}
            />
          </GuideImage>
          <p>
            每位玩家本轮收入＝各画家收藏张数 ×
            对应每幅兑现值，再相加。已买收藏结算后移出游戏，不洗回牌库。没上拍的手牌继续保留，第二、三轮补牌，第四轮不补牌。
          </p>
          <p>
            任一画家第 5
            幅出现立即结算。若所有人手牌耗尽，最后尚未成交的单幅或组合不成交，随后结算并结束；双拍耗尽组合沿用
            TableMax 的经典采用裁定。
          </p>
          <div className="ma-rulebook__example">
            <h4>四轮后看最终现金</h4>
            <p>
              现金保密到游戏结束；本轮收入不等于最终成绩。最高现金者获胜，平手共同获胜。轮末继续下一轮和终局再玩由手机房主或管理员按平台授权操作。
            </p>
          </div>
        </>
      ),
    },
  ],
  source: (
    <>
      按 CMON 经典规则与 GeGe 中文出版规则整理，版本差异及裁定见 TableMax
      采用规格。稳定首席、公开当前价确认、允许 0
      定价、平手共同获胜和末张双拍组合裁定属于项目采用项。配图为内置 imagegen
      原创逻辑场景，画家皮肤为原创演绎；精确规则、数字和箭头由代码排版，全部本地打包。
    </>
  ),
};
