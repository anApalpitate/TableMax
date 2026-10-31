/* eslint-disable react-refresh/only-export-components -- The rulebook is composed by the game screen. */
import type { ReactNode } from 'react';
import { Card, type CardFace } from './Card';
import { legacyUnoSetup, type UnoSetup } from '../config';

function Diagram({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <figure className="uno-rule-diagram">
      {children}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
const face = (color: CardFace['color'], value: number): CardFace => ({
  color,
  kind: 'number',
  value,
});
const effect = (
  kind: CardFace['kind'],
  color: CardFace['color'] = null,
): CardFace => ({ color, kind, value: null });

export function unoRulebook(setup: Readonly<UnoSetup> = legacyUnoSetup) {
  return {
    className: 'uno-rules',
    summary: (
      <>
        经典 UNO，2–6 人。跟颜色、数字或符号出牌，把手牌先出完；最后一张前记得喊
        UNO。每局赢家收取对手剩余牌的点数，先到 500 分赢得整场。
        <span className="uno-rule-current-setup">
          本局补牌传递{setup.drawPenaltyStacking ? '开启' : '关闭'}，抓漏延迟{' '}
          {setup.catchUnoDelayMs / 1000} 秒。
        </span>
      </>
    ),
    chapters: [
      {
        id: 'uno-rule-goal',
        label: '牌与目标',
        title: '108 张经典牌，每人先拿 7 张',
        content: (
          <>
            <p>
              红、黄、绿、蓝四种颜色各有 0–9 和跳过、反转、+2。每色 0
              各一张，1–9 与三种功能牌各两张；另有四张万能变色、四张万能
              +4。先出完手牌者赢得本局。
            </p>
            <Diagram caption="鲜明四色加上不同形状辅助辨识；颜色与点数以牌面为准。">
              <div className="uno-rule-cards">
                {(['red', 'yellow', 'green', 'blue'] as const).map((color) => (
                  <Card key={color} card={face(color, 7)} />
                ))}
              </div>
            </Diagram>
            <p>
              其他人的牌面、牌库顺序始终保密，只公开剩余张数、弃牌堆顶牌与分数。倒计时只提醒，不自动出牌或处罚。
            </p>
          </>
        ),
      },
      {
        id: 'uno-rule-turn',
        label: '出牌与摸牌',
        title: '同色、同数、同符号，三种跟牌方式',
        content: (
          <>
            <p>
              轮到你时，打出一张与堆顶同颜色、同数字或同符号的牌，也可以打出合法万能牌。每次只出一张。
            </p>
            <Diagram caption="红色 7 上，可以出任意红牌、其他颜色的 7，或万能牌。">
              <div className="uno-rule-match">
                <Card card={face('red', 7)} />
                <span aria-hidden="true">→</span>
                <div className="uno-rule-cards">
                  <Card card={face('red', 2)} />
                  <Card card={face('blue', 7)} />
                  <Card card={effect('wild')} />
                </div>
              </div>
            </Diagram>
            <p>
              没有合适牌时摸一张；也可以主动选择不出手中可出的牌。摸到的牌能出就立即出，也可以保留后过牌；这个回合不能改出原先手中的其他牌。
            </p>
            <p>
              主操作中亮起的牌可直接点出。万能牌先选颜色，点选颜色后才提交。摸牌后“刚摸到”标签标明本回合唯一可出的那张牌。
            </p>
          </>
        ),
      },
      {
        id: 'uno-rule-actions',
        label: '功能牌',
        title: '跳过、反转与罚摸牌，改变桌上的节奏',
        content: (
          <>
            <div className="uno-rule-effects">
              <Diagram caption="跳过：下一位跳过回合。">
                <Card card={effect('skip', 'red')} />
              </Diagram>
              <Diagram caption="反转：行牌方向反转。">
                <Card card={effect('reverse', 'blue')} />
              </Diagram>
              <Diagram caption="+2：下一位摸两张，并失去回合。">
                <Card card={effect('draw-two', 'green')} />
              </Diagram>
            </div>
            <p>
              两人对局，跳过或反转都让出牌者继续行动；+2
              的对手罚摸后也由出牌者继续。经典规则不允许叠加 +2 或
              +4；本平台的“补牌传递”默认开启，可在开局设置中关闭。不开启抢出、7–0
              换牌等其他变体。
            </p>
            {setup.drawPenaltyStacking && (
              <p>
                本局已开启补牌传递：面对 +2，可继续出 +2 或万能 +4；面对
                +4，可继续出 +4，把累计张数传给下一位，不能接 +2。
                也可接受累计处罚并失去回合，或质疑最后一张 +4。
                继续传递即放弃对上一张 +4 的质疑。最后一张 +2
                会直接结清累计处罚后收局，最后一张 +4 只处理接受或质疑。
              </p>
            )}
            <p>
              开局翻出
              +2，庄家左手第一位先摸两张并跳过；翻出跳过则先跳过第一位；翻出反转则庄家先走并反向。翻出万能牌由第一位选色；翻出
              +4 放回重翻。
            </p>
          </>
        ),
      },
      {
        id: 'uno-rule-wild',
        label: '万能 +4 与质疑',
        title: '选择颜色，+4 还要经得起质疑',
        content: (
          <>
            <Diagram caption="万能变色可自由选色；万能 +4 的合法条件是手里没有当前颜色。">
              <div className="uno-rule-cards">
                <Card card={effect('wild')} />
                <Card card={effect('wild-draw-four')} />
              </div>
              <div className="uno-rule-color-chips">
                <span>● 红</span>
                <span>▲ 黄</span>
                <span>■ 绿</span>
                <span>◆ 蓝</span>
              </div>
            </Diagram>
            <p>
              万能变色即使手里有能出的其他牌，也可使用。万能 +4
              则仅在手里没有当前颜色时才合法；同数字或同符号、但不同颜色的牌，不阻止使用
              +4。
            </p>
            <table>
              <caption>单张 +4 的处理</caption>
              <thead>
                <tr>
                  <th>选择与结果</th>
                  <th>罚摸</th>
                  <th>下一步</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>接受</th>
                  <td>接牌者 4 张</td>
                  <td>失去回合</td>
                </tr>
                <tr>
                  <th>质疑成功</th>
                  <td>出牌者 4 张</td>
                  <td>质疑者正常行动</td>
                </tr>
                <tr>
                  <th>质疑失败</th>
                  <td>质疑者 6 张</td>
                  <td>失去回合</td>
                </tr>
              </tbody>
            </table>
            <p>
              只有被指向的下一位可质疑，并查看出牌者当时的手牌证据；其他玩家不能查看。
            </p>
            <p>允许诈唬；对手通过质疑判断 +4 是否合法。选色后才提交出牌。</p>
            {setup.drawPenaltyStacking && (
              <p>
                补牌传递中，+4
                接在累计处罚之后，接受者摸全部累计张数；质疑成功由最后出 +4
                的玩家承担累计处罚，质疑者继续行动；失败则质疑者摸累计张数再加两张并失去回合。
              </p>
            )}
          </>
        ),
      },
      {
        id: 'uno-rule-call',
        label: '喊 UNO',
        title: '剩一张前，大声喊 UNO!',
        content: (
          <>
            <Diagram caption="剩一张时须喊 UNO。">
              <div className="uno-rule-cards">
                <Card card={face('red', 3)} />
                <Card card={face('yellow', 8)} />
              </div>
              <strong className="uno-rule-call">UNO!</strong>
            </Diagram>
            <ol>
              <li>打出倒数第二张后，本人可立即喊 UNO。</li>
              <li>本局延迟结束后，其他人可抓漏；先成功保存者生效。</li>
              <li>下一位开始出牌、摸牌或响应 +4 后，抓漏窗口关闭。</li>
            </ol>
            <p>
              漏喊被抓住罚摸两张，不自动处罚。本局抓漏延迟{' '}
              {setup.catchUnoDelayMs / 1000}{' '}
              秒，只控制其他人的抓漏按钮；本人喊牌与下一位行动不必等待。房主仅可在开局前调整延迟。
            </p>
          </>
        ),
      },
      {
        id: 'uno-rule-score',
        label: '结算与多局',
        title: '先清空赢本局，先到 500 分赢整场',
        content: (
          <>
            <div className="uno-rule-score">
              <div>
                <Card card={face('yellow', 8)} />
                <strong>8 分</strong>
              </div>
              <div>
                <Card card={effect('reverse', 'green')} />
                <strong>20 分</strong>
              </div>
              <div>
                <Card card={effect('wild-draw-four')} />
                <strong>50 分</strong>
              </div>
            </div>
            <p>
              数字牌按面值计分；跳过、反转、+2 每张 20 分；万能变色、万能 +4
              每张 50 分。赢家获得所有对手剩余手牌点数之和，其他人本局得分为 0。
            </p>
            <p>
              最后一张是 +2 时先执行罚摸再计分；最后一张是 +4
              时仍须由对手接受或质疑，处理完处罚后再判断是否清空与计分。
            </p>
            <p>
              没有人达到 500
              分，由管理员或获授权的房主开始下一局，保留累计分数。先达到 500
              分者赢得整场，可以原班人马再玩一场。
            </p>
          </>
        ),
      },
    ],
    source: (
      <>
        采用 Mattel G7942 经典 108 牌 UNO 官方规则（2005），平台人数上限为六人。
        <a
          href="https://service.mattel.com/instruction_sheets/g7942-0720.pdf"
          target="_blank"
          rel="noreferrer"
        >
          官方规则 PDF
        </a>
        。图解为本项目原创。补牌传递与数字抓漏延迟是平台设置，与经典原文规则分别说明。
      </>
    ),
  };
}
