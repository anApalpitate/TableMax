import { RulesGuide } from '@tablemax/web-host';
import { tasksForProfile, type RulesProfile } from '../research';
import { categoriesForProfile } from '../cards';
import { ResearchCard } from './ResearchCard';
import { AbilityLegend, GuideScene } from '../../ui/RuleDiagrams';
import { bufferedProfile } from './view-model';

export function Rulebook({ profile }: { profile: RulesProfile }) {
  const buffered = bufferedProfile(profile);
  const latest = profile === 'events-research-v3';
  return (
    <RulesGuide
      className="expansion-rules"
      summary={
        buffered
          ? latest
            ? '经营九格，用三张同值连线归零。研究改变分数，特殊事件影响局面，最低分得一胜，先到三胜。'
            : '经营九格，用三张同值连线归零。最低最终分获胜，研究会改变分数和授胜，先到三胜结束。'
          : '经营九格，用三张同值连线归零。结算最低分得一胜，先到三胜。'
      }
      source="TableMax自制扩展；数值与任务为项目方案，原版出版来源缺口保持记录。"
      chapters={[
        {
          id: 'start',
          label: '目标开局',
          title: '投研究，再翻一张',
          content: (
            <>
              <p>
                2–6人，投票三选一，全员锁定后最高票当选，平票随机。每人九张暗牌，自己翻一张；超梦、阿尔宙斯不进初始场地。
              </p>
              <p>
                选择研究即锁定投票。每项的“条件与风险”可查看完整要求、收益和示意图，不会提交投票。角色插画表达主题，不代替任务条件。
              </p>
              <GuideScene
                name="setup"
                caption="九宫格扩展：牌位与数字由下方代码表示。"
              >
                <div className="ex-rule-grid">
                  {Array.from({ length: 9 }, (_, i) => (
                    <span key={i}>{i === 0 ? '4' : '?'}</span>
                  ))}
                </div>
              </GuideScene>
            </>
          ),
        },
        {
          id: 'turn',
          label: '取牌换位',
          title: buffered
            ? '取牌、缓冲，或交换本人两格'
            : '顶部两弃牌，或交换本人两格',
          content: (
            <>
              <p>
                {buffered
                  ? '普通回合可取摸牌堆顶、唯一弃牌顶部，或本人缓冲。弃牌和缓冲取得必须使用。允许弃掉的摸牌可存入自己的空缓冲，替代放入或弃牌并结束回合；强制换入和接力过程中不能存牌。路卡利欧的额外摸牌，以及超梦未偷换而放弃侦察后的摸牌，仍可按原来源弃掉或存入空缓冲。'
                  : '可取牌库顶或弃牌顶部两张之一；牌库牌可弃，弃牌取得必须使用。'}
                普通换入朝上，换出公开弃顶。不取牌时可公开交换本人两格，朝向随牌移动，替代整个回合，不私看、不发动能力。
              </p>
              <p>
                通常先取牌并换入，再处理能力；梦幻、火箭队、闪电鸟及超梦按各自流程先处理指定步骤。卡牌换位替代整个回合。
                {buffered
                  ? '每人缓冲最多一张，牌公开但只有本人能取出，不能直接交换两张缓冲；缓冲不计场地分、归零或研究条件。'
                  : '两个“可选弃牌”来自同一弃牌堆。'}
                行动轮到你时才显示操作。
              </p>
              {buffered && (
                <figure className="ex-buffer-rule">
                  <div>
                    <span>摸牌堆</span>
                    <span>弃牌顶部</span>
                    <span>本人缓冲</span>
                  </div>
                  <p aria-hidden="true">↓</p>
                  <strong>当前取牌</strong>
                  <p>
                    弃牌和缓冲牌必须使用；可弃的摸牌可换入、弃掉或存入空缓冲。
                  </p>
                </figure>
              )}
            </>
          ),
        },
        {
          id: 'abilities',
          label: '特殊能力',
          title: '按功能看，完整处理后才收局',
          content: (
            <>
              <AbilityLegend expansion />
              <p>
                每张特殊牌的主动能力使用后移除星标。移位、盖回、换人、弃牌
                {buffered ? '或缓冲' : ''}
                都保留已使用状态，取回不会恢复。只有该牌实际洗回牌库，或开始下一小局，才恢复能力。复制牌的被动计分规则不受影响。
              </p>
              <ul>
                {categoriesForProfile(profile)
                  .filter((c) => c.ability || c.copy)
                  .map((c) => (
                    <li key={c.categoryId}>
                      <strong>{c.name}：</strong>
                      {c.copy
                        ? (c.copy === 'horizontal' ? '横向' : '纵向') +
                          '复制紧邻分值。'
                        : c.ability === 'charizard'
                          ? '可私看本人一张暗牌，牌留原位朝下。'
                          : c.ability === 'mewtwo'
                            ? latest
                              ? '私看一名对手一格，可交换该张牌或放弃；确认后完成本人换入。'
                              : '看同一对手两格后，可交换一张或放弃；确认后完成本人换入。'
                            : c.ability === 'arceus'
                              ? '全桌含自身盖回，每人随机一明，每小局全桌一次，不洗牌重发。'
                              : c.ability === 'greninja'
                                ? '任意一名玩家两格盖回，或盖回并公开交换。'
                                : c.ability === 'lucario'
                                  ? '仅从牌库额外摸一张，可按规则回洗补充牌库；无牌可摸时不可发动。额外牌不发动主动能力。'
                                  : c.ability === 'groudon'
                                    ? '交换对手第三行。'
                                    : c.ability === 'kyogre'
                                      ? '交换对手第二行。'
                                      : c.ability === 'rayquaza'
                                        ? '交换对手第一行。'
                                        : c.ability === 'snorlax'
                                          ? '可交换本人两格，朝向随牌移动。'
                                          : c.ability === 'zapdos'
                                            ? '选择顺／逆时针，每位其他玩家接牌换入一次，末牌弃底。'
                                            : c.ability === 'mew'
                                              ? '换入对手一格，再把所得牌换入本人。'
                                              : '抛币；喵喵面换入本人，皮卡丘面处理全员同格，弃底补位。'}
                    </li>
                  ))}
              </ul>
            </>
          ),
        },
        {
          id: 'score',
          label: '计分三胜',
          title: '三行、三列、两主对角线',
          content: (
            <>
              <p>
                三张有效值相同即归零，交叉格只一次，负值连线也归零，牌不拿走。复制路径必须到固定数字，最低基础分优先，同分选择研究处理后最有利的解。完整能力后任意玩家全明就收局，不留残局回合。
              </p>
              <div className="ex-rule-grid">
                {[7, 4, 7, 0, 7, 3, 7, 6, 7].map((v, i) => (
                  <span
                    className={[0, 2, 4, 6, 8].includes(i) ? 'ex-zero' : ''}
                    key={i}
                  >
                    {v}
                  </span>
                ))}
              </div>
              <p>
                示例：两条对角线归零，余牌合计13分。最低最终分可共同获胜。
                {latest
                  ? '每位最低分玩家各得一胜；研究只调整分数，不增加胜局。先累计三胜结束大局。'
                  : buffered
                    ? '每位赢家按本人的研究条件授胜：通常一胜，奖励最多再加一胜；失败代价可能限制本局授胜或累计上限，已有胜场不撤回。累计达到三胜即可成为大局赢家。'
                    : '先到三胜。'}
                {latest
                  ? '计分明细区分有效值、归零后的计分贡献与研究调整；总分折半保留半分，暗置整行按逐牌折半向下取整。'
                  : buffered
                    ? '计分明细显示本局实际增减分与授胜；最低分但未获胜星时，仍是下一小局起手候选。'
                    : '计分明细显示基础分与研究减分。'}
              </p>
            </>
          ),
        },
        {
          id: 'research',
          label: '研究任务',
          title: latest ? '17项开局共同研究' : '24项开局＋6项丰缘任务',
          content: (
            <>
              <p>
                {latest ? (
                  '开局从17项抽三个不同候选，全员暗投共同选择。任务只检查本人九格，未达成不处罚；组合羁绊不再追加专属研究。'
                ) : (
                  <>
                    三种丰缘神兽首次同时在玩家场地明置，追加专属任务；弃牌、暂持
                    {buffered ? '、缓冲' : ''}
                    和结算强制揭牌不计，最后合法行动仍可触发。两项只在结算判定。
                    {buffered
                      ? '奖励可能改变牌分、扩大负分收益或增加授胜；归零判定保持不变。高收益任务也可能有未达成代价，逐项查看下方条件与风险。'
                      : '各减分一次。'}
                  </>
                )}
                数字使用复制后、归零前值，不展示局中暗牌进度。
              </p>
              <div className="expansion-screen ex-research-reference ex-rule-tasks">
                {tasksForProfile(profile).map((t) => (
                  <ResearchCard key={t.id} task={t} profile={profile} />
                ))}
              </div>
            </>
          ),
        },
        ...(latest
          ? [
              {
                id: 'events',
                label: '局内事件',
                title: '一小局一次随机特殊事件',
                content: (
                  <>
                    <p>
                      全桌各完成两个正常回合后，标记牌混入剩余牌库。首次从牌库取得标记牌时公布事件，先于该牌的能力生效；额外摸牌也可能触发。六种事件等概率，每小局至多一次。
                    </p>
                    <p>
                      雨、晴、沙、雪只调整场地当前明置牌；翻明或换入继续生效，盖回或离场停止。数值从印刷值重新计算，复制继承邻牌有效值，不再次加减。分数角标标出天气与来源，暗牌不显示变化。
                    </p>
                    <p>
                      戏法空间只替换触发时场地的普通角色，含暗牌，保持实例、位置和明暗；之后换入不替换。Mega与羁绊暂只展示主题及“效果待设计”，没有额外分数或胜局效果。
                    </p>
                  </>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
