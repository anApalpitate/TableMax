/* eslint-disable react-refresh/only-export-components -- Static rule chapters are composed by the platform display shell. */
import { cardArt } from '../../../assets/games/pokemon-encounters/catalog';
import './rules-guide.css';

const screenshots = import.meta.glob(
  '../../../assets/games/pokemon-encounters/rules/*.webp',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;
function GuideImage({ name, caption }: { name: string; caption: string }) {
  const src =
    screenshots[`../../../assets/games/pokemon-encounters/rules/${name}.webp`];
  return src ? (
    <figure>
      <img src={src} alt={caption} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  ) : null;
}
const abilities = [
  {
    id: 'special-mew',
    name: '梦幻 · 必须执行',
    text: '先用梦幻换其他玩家的一张牌，再用得到的牌换本人一张，最后把本人换出的牌弃掉。两次选位都由行动者完成。',
  },
  {
    id: 'special-team-rocket',
    name: '火箭队 · 必须执行',
    text: '先投币。喵喵面：换入本人一格。皮卡丘面：选择一格，所有玩家同位置的牌和火箭队弃到堆底，从本人开始顺时针补牌朝上。',
  },
  {
    id: 'special-zapdos',
    name: '闪电鸟 · 必须执行',
    text: '换入本人场地，换出的牌顺时针传给下一位；每位接牌者自己选格替换，再传出换出的牌。最后一张放弃牌堆底。',
  },
  {
    id: 'special-snorlax',
    name: '卡比兽 · 可选发动',
    text: '换入后可交换本人两张不同位置的牌，正反面保持；也可以不发动。刚放入的卡比兽也可交换。',
  },
  {
    id: 'special-charizard',
    name: '喷火龙 · 可选发动',
    text: '换入后可临时查看本人一张暗牌，看完仍朝下；也可以不发动。没有暗牌时跳过，其他玩家不会看到查看值。',
  },
  {
    id: 'special-ditto',
    name: '百变怪 · 结算生效',
    text: '复制同一行紧邻的左或右数字。程序联合计算百变怪的合法组合，选择包含同列归零后场地总分最低的一种。',
  },
] as const;

export const pokemonRulebook = {
  className: 'pokemon-rules',
  summary: (
    <>
      让自己的六张牌总分尽量低：摸牌、替换、发动能力，利用同列同值归零。小局最低分得一胜，先到三胜赢整局。
    </>
  ),
  chapters: [
    {
      id: 'pokemon-rules-board',
      label: '开局与牌桌',
      title: '两行三列，先翻一张',
      content: (
        <>
          <p>
            每人六张暗牌，排成两行三列。所有人用各自手机选择一张翻开，全员完成后开始顺时针回合。初始翻牌不发动能力，也不能查看其他暗牌。
          </p>
          <GuideImage
            name="table"
            caption="公开牌桌的单席示例：六张牌固定两行三列，明牌公开，暗牌只显示牌背。手机操作本人牌桌，电脑显示公开全局；当前行动者、步骤和暂持牌另行显示。"
          />
          <p>
            数字代表结算分值，目标是低分。牌堆区分未摸的牌库与正面弃牌堆；弃牌堆为空时不能从中取牌。
          </p>
        </>
      ),
    },
    {
      id: 'pokemon-rules-turn',
      label: '摸牌与替换',
      title: '先取牌，再决定怎么放',
      content: (
        <>
          <GuideImage
            name="draw"
            caption="隔离本人操作示例：取到的牌放在暂持区；点本人具体位置执行替换，换入牌朝上。行动面板显示当前要完成的意图。"
          />
          <ol>
            <li>取牌库顶牌，或取非空弃牌堆顶牌。新摸到的牌公开显示。</li>
            <li>
              普通牌从牌库摸到，可以替换本人明牌或暗牌，也可以直接弃掉。从弃牌堆取到则必须替换。
            </li>
            <li>
              替换时新牌朝上；换出的暗牌先翻开再弃掉。直接弃牌不要求额外翻本人暗牌。
            </li>
            <li>遇到能力按下一章完成全部步骤，再交给下一位。</li>
          </ol>
          <p>
            梦幻、火箭队、闪电鸟新摸到时必须执行，不能直接弃掉绕过。牌库耗尽时，整个弃牌堆重洗成新牌库。
          </p>
        </>
      ),
    },
    {
      id: 'pokemon-rules-abilities',
      label: '六种能力',
      title: '新摸到并换入，才检查主动能力',
      content: (
        <>
          <p>
            主动能力只在本人正常回合摸到并换入时检查；初始翻牌、场地牌转移、火箭队补牌和结算揭牌都不会连锁发动。
          </p>
          <div className="pokemon-rulebook__abilities">
            {abilities.map((ability) => (
              <div key={ability.id}>
                <img src={cardArt(ability.id).image} alt="" loading="lazy" />
                <div>
                  <h4>{ability.name}</h4>
                  <p>{ability.text}</p>
                </div>
              </div>
            ))}
          </div>
          <p>
            传牌、补位、两次替换或查看确认必须全部完成，期间即使有人六张已全明，也不会提前打断能力或结算。
          </p>
        </>
      ),
    },
    {
      id: 'pokemon-rules-scoring',
      label: '计分与三胜',
      title: '同列同值归零，最低分赢小局',
      content: (
        <>
          <GuideImage
            name="scoring"
            caption="公开结算：所有暗牌翻开，卡牌放大展示；同列相同有效数值的两张归零，最低总分玩家加一胜。"
          />
          <p>
            普通操作或完整能力结束后，若任意一人六张全明，立刻结算，没有其他玩家的最后回合。程序翻开剩余暗牌，先解析百变怪，再逐列计分。
          </p>
          <div className="pokemon-rulebook__scoring">
            <div>
              <h4>同列相同数字</h4>
              <p>两张都计 0。比较数字，不比较角色；负数相同也归零。</p>
              <strong>4 + 4 → 0</strong>
            </div>
            <div>
              <h4>同列不同数字</h4>
              <p>两张分值相加，再加总三列；没有额外奖惩。</p>
              <strong>−2 + 5 → 3</strong>
            </div>
          </div>
          <p>
            最低分所有玩家各加一胜。未到三胜由小局赢家中随机一位开下一小局，重新洗全部
            56
            张、各发六张、各翻一张，胜局数保留。任意人到三胜结束，同时达标为共同赢家。
          </p>
        </>
      ),
    },
  ],
  source: (
    <>
      按 TableMax
      中文采用规则整理：能力完整结算后结束、百变怪联合最低分、三胜与共同赢家依照用户确认及项目方案。实体版出版信息与部分原文尚未认证，不以其他版本规则替代。配图为隔离示例对局的实际界面，正式游玩无需联网。
    </>
  ),
};
