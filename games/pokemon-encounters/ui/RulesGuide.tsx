import {
  BoardExample,
  GuideScene,
  RuleFlow,
  VictoryExample,
} from './RuleDiagrams';
import { scoringExample } from './rule-examples';
import './rules-guide.css';

export const pokemonRulebook = {
  className: 'pokemon-rules',
  summary: (
    <>
      把六张牌的总分降下来，利用同列同值归零。小局最低分得一胜，先到三胜赢整局；并列最低分一起得胜。
    </>
  ),
  chapters: [
    {
      id: 'pokemon-rules-board',
      label: '目标与开局',
      title: '两行三列，先翻一张',
      content: (
        <>
          <p>
            2–6
            人，每人六张暗牌，排成两行三列。每人选一张翻开，全员完成后开始顺时针回合。其余五张不能偷看，初翻不发动能力。
          </p>
          <GuideScene
            name="setup"
            caption="开局示例：一张明牌、五张暗牌。位置固定为两行三列。"
          >
            <BoardExample values={[4, null, null, null, null, null]} />
          </GuideScene>
          <div className="pk-rule-callout">
            <strong>数字越低越好</strong>
            <p>
              牌面数字是分值。相同分值放在同一列，两张都计
              0；比较数字，不比较精灵名字。
            </p>
          </div>
          <p>
            开局弃牌堆为空，首个回合只能取牌库。第一小局随机选起始玩家，之后由上一小局赢家中随机一人先行动。
          </p>
        </>
      ),
    },
    {
      id: 'pokemon-rules-turn',
      label: '取牌与换入',
      title: '取牌来源不同，弃牌选择也不同',
      content: (
        <>
          <GuideScene
            name="turn"
            caption="普通回合：取一张公开牌，再选择本人位置换入或直接弃掉。"
          >
            <RuleFlow
              steps={[
                '取牌库顶或弃牌顶',
                '新取到的牌公开',
                '换入或弃掉',
                '完成后下一位',
              ]}
            />
          </GuideScene>
          <div className="pk-rule-choices">
            <div>
              <h4>从牌库取</h4>
              <p>
                普通牌可换入本人任意明格或暗格，也可直接弃掉。直接弃牌不用额外翻本人暗牌。
              </p>
            </div>
            <div>
              <h4>从弃牌堆取</h4>
              <p>
                只能取最新的顶牌。普通牌必须换入，不能拿来又直接弃掉；空堆不能取。
              </p>
            </div>
          </div>
          <p>
            换入牌朝上；换出的暗牌先翻开，再放弃牌顶。新摸到梦幻、火箭队或闪电鸟时，必须执行对应能力。
          </p>
          <p>
            牌库空时，整个弃牌堆重洗成新牌库，不保留原弃牌顶。手机只显示弃牌顶，电脑可查看公开弃牌记录。
          </p>
        </>
      ),
    },
    {
      id: 'pokemon-rules-mew',
      label: '梦幻',
      title: '梦幻：先换别人，再换自己',
      content: (
        <>
          <GuideScene
            name="mew"
            caption="两次选位都由取到梦幻的行动者完成，先选别人场地，再选本人场地。"
          >
            <RuleFlow
              steps={[
                '梦幻换入其他玩家一格',
                '得到那一格原来的牌',
                '所得牌换入本人一格',
                '本人换出的牌弃顶',
              ]}
            />
          </GuideScene>
          <p>
            分值
            2，正常回合新摸到必须执行。可以选其他玩家的明牌或暗牌；得到的牌公开，换入本人时朝上。
          </p>
          <div className="pk-rule-callout">
            <strong>两步都要做完</strong>
            <p>
              得到的牌不连锁发动能力；即使第一步让别人六张全明，也先完成本人换入和弃牌，再检查结束。
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'pokemon-rules-rocket',
      label: '火箭队',
      title: '火箭队：先投币，再处理同一位置',
      content: (
        <>
          <GuideScene
            name="rocket"
            caption="正常回合新摸到火箭队，先投币。两种币面对应不同流程。"
          >
            <div className="pk-rule-choices">
              <div>
                <h4>喵喵面</h4>
                <RuleFlow steps={['火箭队换入本人一格', '换出的牌放弃牌顶']} />
              </div>
              <div>
                <h4>皮卡丘面</h4>
                <RuleFlow
                  steps={['选一个位置，全桌同位弃底', '从本人起顺时针补牌朝上']}
                />
              </div>
            </div>
          </GuideScene>
          <p>
            分值
            12，正常回合新摸到必须执行。皮卡丘面将所有玩家同一位置的牌及新摸火箭队放到弃牌底，全部移出后再从本人起顺时针各补一张。
          </p>
          <div className="pk-rule-callout">
            <strong>补牌不发动能力</strong>
            <p>
              补齐全部空位后才检查结束。补牌时若牌库空，仍将整个弃牌堆重洗，继续完成补位。
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'pokemon-rules-zapdos',
      label: '闪电鸟',
      title: '闪电鸟：顺时针接力，各自选格',
      content: (
        <>
          <GuideScene
            name="zapdos"
            caption="其余玩家顺时针各接一次，最后换出的牌放弃牌底，不再传回起点。"
          >
            <RuleFlow
              steps={[
                '本人换入闪电鸟',
                '换出的牌交下一位',
                '每位自己选格换入并传牌',
                '末位换出的牌弃底',
              ]}
            />
          </GuideScene>
          <p>
            分值
            10，正常回合新摸到必须执行。本人先选格换入，接牌者各自选择明格或暗格；换入朝上，换出的暗牌公开后继续传递。
          </p>
          <div className="pk-rule-callout">
            <strong>传递牌不连锁</strong>
            <p>
              整圈接力及最后弃底完成后才检查结束。过程中有人六张全明，也不打断尚未完成的接牌。
            </p>
          </div>
        </>
      ),
    },
    {
      id: 'pokemon-rules-abilities',
      label: '交换与私看',
      title: '卡比兽与喷火龙：换入后可选发动',
      content: (
        <>
          <p>
            两张牌分值都是
            10。正常回合新摸到并换入后，可发动，也可选择“不发动”；从牌库取到直接弃掉时不触发。
          </p>
          <h4>卡比兽：交换本人两张牌</h4>
          <GuideScene
            name="snorlax"
            caption="交换两个不同位置，明暗朝向随牌一起移动。刚放入的卡比兽也能参与。"
          >
            <RuleFlow
              steps={['选本人两个不同位置', '两张牌互换', '正反面保持']}
            />
          </GuideScene>
          <h4>喷火龙：只让本人看一张暗牌</h4>
          <GuideScene
            name="charizard"
            caption="只临时查看本人一张暗牌，看完仍在原位朝下，其他玩家看不到牌值。"
          >
            <RuleFlow
              steps={['选本人一张暗牌', '仅本人临时查看', '确认后恢复牌背']}
            />
          </GuideScene>
          <p>
            本人没有暗牌时，喷火龙自动跳过。初始翻牌、场地牌转移、火箭队补牌和结算揭牌都不触发主动能力。
          </p>
        </>
      ),
    },
    {
      id: 'pokemon-rules-scoring',
      label: '计分与百变怪',
      title: '同列同值归零，百变怪看全场总分',
      content: (
        <>
          <p>
            结算先解析百变怪，再逐列计分：上下有效数字相同，两张都计
            0；不同就相加。负数相同也归零，没有额外奖惩。
          </p>
          <GuideScene
            name="ditto"
            caption="百变怪复制右侧 9，凑成中列 9／9 归零。复制较大的数字，反而让全场更低。"
          >
            <BoardExample
              values={scoringExample.values}
              paired={[1, 4]}
              ditto={4}
            />
            <div className="pk-rule-column-scores">
              <span>4 + 3 = 7</span>
              <span>9 + 9 → 0</span>
              <span>−2 + 9 = 7</span>
            </div>
            <strong className="pk-rule-total">全场总分 14</strong>
          </GuideScene>
          <p>
            百变怪只在结算生效，复制同一行紧邻的左或右数字，不跨行。图中复制左侧
            3 会得到总分 26，所以程序选择右侧 9。
          </p>
          <p>
            多个百变怪联合考虑配对，自动选取全场地总分最低的合法组合；可以沿另一个百变怪解析到真实数字，不能用无数字来源的循环赋值。
          </p>
        </>
      ),
    },
    {
      id: 'pokemon-rules-end',
      label: '结束与三胜',
      title: '能力做完才结算，最低分共同得胜',
      content: (
        <>
          <p>
            普通操作或当前能力完整结束后，只要任意一人六张全明，就立即结束小局。没有其他玩家的最后回合；所有剩余暗牌公开后统一计分。
          </p>
          <GuideScene
            name="match"
            caption="最低分玩家各加一胜。示例中甲、乙同时达到三胜，成为共同整局赢家。"
          >
            <VictoryExample />
          </GuideScene>
          <p>
            没人达到三胜时，开始新小局：重洗全部 56
            张、重新发六张暗牌、各翻一张，胜局数和座位保留。任意人到三胜结束整局，同时达标共同获胜。
          </p>
          <div className="pk-rule-callout">
            <strong>先完成能力，再检查六张全明</strong>
            <p>
              梦幻两次换入、火箭队补位、闪电鸟全圈传牌、卡比兽发动或不发动、喷火龙查看确认，都须先完成。
            </p>
          </div>
        </>
      ),
    },
  ],
  source: (
    <>
      按 TableMax
      中文采用规则整理，六人、能力完整结算、百变怪联合最低分与共同三胜依照用户确认及项目方案；实体版部分原文尚未认证。插图为
      imagegen 原创规则场景，位置、流程及分值由代码排版，全部本地打包。
    </>
  ),
};
