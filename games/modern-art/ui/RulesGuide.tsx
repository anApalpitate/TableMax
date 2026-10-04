/* eslint-disable react-refresh/only-export-components -- Static rule chapters are composed by the platform display shell. */
import { AuctionMark } from './painting-display';
import { auctionNames } from './public/labels';
import type { AuctionKind } from './view';
import './rules-guide.css';

const screenshots = import.meta.glob(
  '../../../assets/games/modern-art/rules/*.webp',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;
function GuideImage({ name, caption }: { name: string; caption: string }) {
  const src =
    screenshots[`../../../assets/games/modern-art/rules/${name}.webp`];
  return src ? (
    <figure>
      <img src={src} alt={caption} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  ) : null;
}
const descriptions: Record<AuctionKind, string> = {
  open: '大家自由加价。点击“本次不加价”确认当前价格；有人再次加价后，你又可以选择。除领拍者外全员确认，才会成交。',
  once: '从拍卖人左侧开始顺时针，每人只能出价一次或放弃。拍卖人最后决定。最高价得画。',
  sealed:
    '每人秘密提交一次金额，0 表示不投标；全员提交才同时揭标。最高价相同，拍卖人优先，再按其左侧顺序。',
  fixed:
    '拍卖人设定自己付得起的价格。从其左侧逐个询问，首位接受者买入；都不买时，拍卖人按原价自购。',
  double:
    '补一幅同画家、非双重拍卖的画，按第二幅的方式一起卖。别人补画，就由他收全部货款，下一次从他左侧出画。无人补画，首幅免费归原拍卖人。',
};

export const modernArtRulebook = {
  className: 'ma-rules',
  summary: (
    <>
      四轮经营博物馆：选画上拍、竞拍收藏，轮末按画家行情兑钱。四轮后现金最多者获胜。
    </>
  ),
  chapters: [
    {
      id: 'ma-rules-flow',
      label: '回合与选画',
      title: '出一幅画，让大家竞拍',
      content: (
        <>
          <p>
            每人从 100
            千元开始。轮到你时，点一幅手牌上拍；画上的角标决定拍卖方式。选画没有倒计时。
          </p>
          <GuideImage
            name="hand"
            caption="手机手牌：画家色框与画家标记表示归属，另一角标表示拍卖方式。手牌仅本人可见，向下滚动查看更多画作。"
          />
          <p>
            得标款付给拍卖人；拍卖人自购则付银行。买入画作公开放在收藏区，轮末兑钱。除双拍交接外，下一次由拍卖人左侧玩家出画。
          </p>
        </>
      ),
    },
    {
      id: 'ma-rules-market',
      label: '行情与轮末',
      title: '看数量、看每幅收益',
      content: (
        <>
          <GuideImage
            name="market"
            caption="行情板：已上拍 n / 5 是本轮出现的画作数量；下方金额是每幅画当前预计可兑的钱，单位为千元。"
          />
          <p>
            任一画家出现第 5 幅，立刻结束本轮；第 5
            幅不拍卖、无人获得。如果双拍第二幅是第 5
            幅，最后两幅都不成交，但都计入数量。
          </p>
          <p>
            只按本轮已上拍数量排名；平手时，行情板从左到右的画家优先。预估会随新画上拍变化，不能当作最终售价。
          </p>
        </>
      ),
    },
    {
      id: 'ma-rules-auctions',
      label: '五种拍卖',
      title: '认角标，选对操作',
      content: (
        <>
          <GuideImage
            name="auction"
            caption="拍卖台：当前方式、拍卖人、领拍金额与参与状态公开显示；手机金额框保留你正在输入的报价。"
          />
          <div className="ma-rulebook__auctions">
            {(Object.keys(descriptions) as AuctionKind[]).map((kind) => (
              <div key={kind}>
                <span>
                  <AuctionMark kind={kind} />
                </span>
                <div>
                  <h4>{auctionNames[kind]}</h4>
                  <p>{descriptions[kind]}</p>
                </div>
              </div>
            ))}
          </div>
          <p>
            竞价使用整数千元，不能超过本人现金。公开和一次出价必须高于当前价。公开、一次、暗标无人出价时，画作免费归拍卖人。竞拍倒计时仅提醒，归零不会自动出价或成交。
          </p>
        </>
      ),
    },
    {
      id: 'ma-rules-scoring',
      label: '兑现与胜负',
      title: '前三名兑钱，历史价值累计',
      content: (
        <>
          <GuideImage
            name="collection"
            caption="公开收藏：买入后放在各家博物馆，按画家靠拢；收藏属于本轮，轮末结算后移出游戏。"
          />
          <p>
            第一、二、三名本轮分别增加 30、20、10 千元。它们的每幅兑现值 =
            以前各轮已累积的价值 + 本轮增加值。本轮跌出前三的画家，每幅兑
            0，旧价值保留供以后轮次使用。
          </p>
          <div className="ma-rulebook__example">
            <h4>算一遍就明白</h4>
            <p>
              某画家首轮第一名（30），第二轮第二名（20），第二轮每幅兑 50
              千元。第三轮若跌出前三则兑 0；第四轮重回第三名则兑 60 千元。
            </p>
          </div>
          <p>
            没上拍的手牌留到后续轮次；第二、三轮补牌，第四轮不补。所有玩家手牌耗尽时，最后的单幅或组合不成交，随后结算并结束。四轮后公开最终现金，最高者共同获胜。
          </p>
        </>
      ),
    },
  ],
  source: (
    <>
      按 TableMax
      经典版本整理。画家皮肤与图标为项目演绎；公开“确认当前价”是数字化约定。出版依据为
      GeGe
      中文规则，版本差异以项目采用规格为准。配图为隔离示例对局的实际界面，正式游玩无需联网。
    </>
  ),
};
