/* eslint-disable react-refresh/only-export-components -- The game owns its rulebook. */
import type { ReactNode } from 'react';
import { Relic, BallotMark, Crown } from './Relic';
import { RoleCard } from './RoleCard';

function Diagram({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <figure className="av-rule-diagram">
      {children}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export const avalonRulebook = {
  className: 'av-rules',
  summary: (
    <>
      经典《抵抗组织：阿瓦隆》，本平台支持 5–6
      人。忠诚势力尝试完成三次任务，邪恶势力暗中破坏；梅林知晓敌人，却必须躲过刺客的最后一剑。
    </>
  ),
  chapters: [
    {
      id: 'av-goal',
      label: '阵营与胜负',
      title: '三次成功之后，梅林仍须生还',
      content: (
        <>
          <Diagram caption="任务先达到三次失败，邪恶获胜；先达到三次成功，进入最后刺杀。">
            <div className="av-rule-goal">
              <div>
                <Relic kind="grail" />
                <strong>3 次成功</strong>
                <span>进入最后刺杀</span>
              </div>
              <div>
                <Relic kind="raven" />
                <strong>3 次失败</strong>
                <span>邪恶势力获胜</span>
              </div>
            </div>
          </Diagram>
          <p>
            五人局是三名忠诚、两名邪恶；六人局是四名忠诚、两名邪恶。身份随机分配，你可以自由发言、质疑与诈唬，但角色卡和秘密知识只在本人设备查看。
          </p>
          <p>
            邪恶势力也可通过连续否决五支队伍直接获胜。忠诚阵营完成三次任务后，刺客准确指认梅林则邪恶逆转获胜；指认其他人则忠诚获胜。
          </p>
        </>
      ),
    },
    {
      id: 'av-roles',
      label: '角色与知识',
      title: '同坐圆桌，各自知晓不同秘密',
      content: (
        <>
          <div className="av-rule-roles">
            <RoleCard role="merlin" compact />
            <RoleCard role="assassin" compact />
            <RoleCard role="servant" compact />
          </div>
          <p>
            <strong>基础经典：</strong>
            梅林、刺客、一名爪牙，其余是亚瑟的忠臣。梅林知道所有邪恶玩家；刺客与爪牙互相认识；普通忠臣不知道其他角色。梅林不要公开身份，否则最后可能被刺杀。
          </p>
          <div className="av-rule-roles">
            <RoleCard role="percival" compact />
            <RoleCard role="morgana" compact />
          </div>
          <p>
            <strong>宫廷迷局：</strong>
            加入派西维尔与莫甘娜。派西维尔看到梅林和莫甘娜两名候选，但无法分辨谁是谁；莫甘娜属于邪恶，与刺客互相认识。梅林仍知道两名邪恶玩家。其余席位是忠臣。
          </p>
          <p>
            本次两种配置都不加入莫德雷德、奥伯伦或湖中女神。管理员和公共屏只能看到公开信息。刺杀阶段显示当前刺客的行动席位，其他角色在整局结束后才公开；这是数字操作的适配。
          </p>
        </>
      ),
    },
    {
      id: 'av-team',
      label: '组队与表决',
      title: '队长提名，全员秘密表态后同时公开',
      content: (
        <>
          <Diagram caption="每次组队：选队员 → 明确提名 → 全员表决 → 揭示每人的赞成／反对。">
            <div className="av-rule-flow">
              <span>
                <Crown />
                队长提名
              </span>
              <b>→</b>
              <span>
                <BallotMark approve />
                全员表决
              </span>
              <b>→</b>
              <span>
                <Relic kind="seal" />
                过半通过
              </span>
            </div>
          </Diagram>
          <p>
            队长按当前任务人数选出队伍，可以包含自己。所有人讨论后，都要投赞成或反对，队长和非队员也须表决。表决在所有人提交后一起揭示，赞成票必须严格超过总人数的一半；平票是否决。
          </p>
          <p>
            队伍被否决，队长标记顺时针交给下一人，再提名同一次任务的队伍。连续五次否决，邪恶立即获胜。队伍通过后进入秘密任务；无论任务成功或失败，队长再顺时针交给下一人，连续否决数清零。
          </p>
          <div className="av-rule-size-table">
            <strong>人数</strong>
            {[1, 2, 3, 4, 5].map((number) => (
              <strong key={number}>任务 {number}</strong>
            ))}
            <span>5 人</span>
            {[2, 3, 2, 3, 3].map((size, index) => (
              <span key={`5:${index}`}>{size}</span>
            ))}
            <span>6 人</span>
            {[2, 3, 4, 3, 4].map((size, index) => (
              <span key={`6:${index}`}>{size}</span>
            ))}
          </div>
        </>
      ),
    },
    {
      id: 'av-quest',
      label: '秘密任务',
      title: '成功或失败牌，只公布数量和结果',
      content: (
        <>
          <Diagram caption="本平台 5–6 人：没有失败牌才成功，任意一张失败牌便失败。">
            <div className="av-rule-goal">
              <div className="av-rule-quest-card">
                <Relic kind="grail" />
                <strong>成功</strong>
                <span>忠诚必须使用</span>
              </div>
              <div className="av-rule-quest-card av-rule-quest-card--fail">
                <Relic kind="raven" />
                <strong>失败</strong>
                <span>邪恶可选择使用</span>
              </div>
            </div>
          </Diagram>
          <p>
            只有通过的队员提交任务牌。忠诚角色只能出成功；邪恶角色可以出成功或失败。所有队员提交完后，任务牌匿名混合结算；只公布成功与失败张数，不公布某张牌是谁提交的。
          </p>
          <p>
            这里是经典 5–6
            人配置，所以五次任务都只需一张失败牌就会失败。不使用七人以上第四任务需要两张失败的规则。任务中的隐秘选择不会由动效、音色或提交时序泄露。
          </p>
        </>
      ),
    },
    {
      id: 'av-assassin',
      label: '最后刺杀',
      title: '邪恶势力公开商议，刺客落下最后一剑',
      content: (
        <>
          <Diagram caption="三次任务成功后，刺客选择一个人：刺中梅林，邪恶胜；梅林生还，忠诚胜。">
            <div className="av-rule-assassin">
              <Relic kind="sword" />
              <span>刺客指认</span>
              <b>→</b>
              <RoleCard role="merlin" compact />
            </div>
          </Diagram>
          <p>
            完成第三次成功任务时，邪恶势力可公开讨论谁是梅林，最终由刺客作出一次指认。只能选择一个人，不能要求其他玩家展示角色；目标提交后立即结算并公开全员身份。
          </p>
        </>
      ),
    },
    {
      id: 'av-platform',
      label: '数字牌桌',
      title: '现场讨论、各自操作、保存后揭示',
      content: (
        <>
          <p>
            队长直接点选圆桌成员，再按“提名队伍”确认。全员表决和队员任务牌可同时提交；提交后不能修改。卡面选择立即提交，秘密选择只在本人设备确认。
          </p>
          <p>
            “查看身份”打开本人角色与秘密知识，关闭、失焦或切到后台会收起。倒计时只提醒，不代投票、代出任务牌或自动刺杀。管理员或获授权房主可暂停、恢复和原班人马再玩一局。只有电脑管理员能回退对局。
          </p>
          <p>
            全屏演出与声音只表达已保存的公开结果；恢复、回退和首次同步不重播。可静音，减少动态设置会保留简洁落点。
          </p>
        </>
      ),
    },
  ],
  source: (
    <>
      采用 Indie Boards & Cards 的 2012 经典《The Resistance: Avalon》规则（
      <a
        href="https://indieboardsandcards.com/our-games/the-resistance-avalon/"
        target="_blank"
        rel="noreferrer"
      >
        发布方
      </a>
      、
      <a
        href="https://cdn.1j1ju.com/medias/a6/dc/c1-the-resistance-avalon-rulebook.pdf"
        target="_blank"
        rel="noreferrer"
      >
        同版规则 PDF
      </a>
      ）。平台保留 5–6
      人、基础经典与宫廷迷局两种同版角色配置；数字保密、同时提交和显示行为是本项目适配。
    </>
  ),
};
