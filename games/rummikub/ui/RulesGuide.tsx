/* eslint-disable react-refresh/only-export-components -- Rule chapters are composed by the platform display shell. */
import type { ReactNode } from 'react';
import type { Color } from '../types';
import { NumberTile } from './NumberTile';

type ExampleFace = { color: Color; value: number; joker?: boolean };
function RuleSet({ faces }: { faces: ExampleFace[] }) {
  return (
    <div className="rk-rule-set">
      {faces.map((face, index) => (
        <NumberTile
          key={index}
          tile={{
            id: `example-${face.color}-${face.value}-${index}`,
            color: face.color,
            value: face.value,
            joker: face.joker ?? false,
          }}
          {...(face.joker
            ? { binding: { color: face.color, value: face.value } }
            : {})}
        />
      ))}
    </div>
  );
}
function Diagram({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <figure className="rk-rule-diagram">
      {children}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
function Flow({ steps }: { steps: string[] }) {
  return (
    <ol className="rk-rule-flow">
      {steps.map((step, index) => (
        <li key={step}>
          <span>{index + 1}</span>
          {step}
        </li>
      ))}
    </ol>
  );
}

export const rummikubRulebook = {
  className: 'rk-rules',
  summary: (
    <>
      把私有牌架上的数字牌组成合法牌组，或重组公开桌面。率先清空牌架者赢得本局。经典版支持
      2–4 人；整场比较获胜局数，再比较累计分数。
    </>
  ),
  chapters: [
    {
      id: 'rk-rules-goal',
      label: '目标与牌',
      title: '106 张牌，先清空你的牌架',
      content: (
        <>
          <p>
            黑、蓝、橙、红四种颜色各有 1–13，每张两份，另有两张百搭。每人起手 14
            张，其余组成牌池。只有本人能看自己的牌，桌面和各人剩余张数公开。
          </p>
          <Diagram caption="四色使用方形、菱形、三角和圆形辅助辨识；数字牌的颜色和数字不能改变。">
            <RuleSet
              faces={[
                { color: 'black', value: 9 },
                { color: 'blue', value: 9 },
                { color: 'orange', value: 9 },
                { color: 'red', value: 9 },
              ]}
            />
          </Diagram>
          <p>
            本平台一场默认包含与人数相同的局数，每局重新抽数字比最高定先手。牌池和别人的牌架始终保密。
          </p>
        </>
      ),
    },
    {
      id: 'rk-rules-sets',
      label: '合法牌组',
      title: '同数组与顺子，两种合法组合',
      content: (
        <>
          <p>
            <strong>同数组：</strong>3 或 4
            张数字相同、颜色互不相同的牌。两张同色同数的牌不能放进同一组。
          </p>
          <Diagram caption="三个不同颜色的 7 可组成同数组，也可以再加入橙色 7。">
            <RuleSet
              faces={[
                { color: 'black', value: 7 },
                { color: 'blue', value: 7 },
                { color: 'red', value: 7 },
              ]}
            />
          </Diagram>
          <p>
            <strong>顺子：</strong>至少 3 张同色连续数字。1
            只能作最小数字，不能接在 13 后；同色重复数字不能进入同一条顺子。
          </p>
          <Diagram caption="蓝色 4、5、6 构成顺子；还可向前接 3 或向后接 7。">
            <RuleSet
              faces={[
                { color: 'blue', value: 4 },
                { color: 'blue', value: 5 },
                { color: 'blue', value: 6 },
              ]}
            />
          </Diagram>
          <p>百搭可代替任何颜色和数字，放入牌组前明确指定其代表的牌。</p>
        </>
      ),
    },
    {
      id: 'rk-rules-opening',
      label: '首出 30 点',
      title: '先用自己的牌达到 30 点',
      content: (
        <>
          <p>
            第一次出牌须仅用本人牌架，组成一个或多个合法牌组，数字合计至少 30
            点。百搭按当时代表的数字计点。
          </p>
          <Diagram caption="黑色 10、11、12 合计 33 点，可独立完成首出。">
            <RuleSet
              faces={[
                { color: 'black', value: 10 },
                { color: 'black', value: 11 },
                { color: 'black', value: 12 },
              ]}
            />
            <span className="rk-rule-equation">10 + 11 + 12 = 33 ≥ 30</span>
          </Diagram>
          <p>
            首出这一回合不能添入、拆开或移动原桌面牌组。完成首出后的后续回合，才可自由操作桌面。
          </p>
          <p>
            达不到首出条件，或本回合选择不出牌，就摸 1
            张结束回合。摸到的牌从下次回合才能使用。
          </p>
        </>
      ),
    },
    {
      id: 'rk-rules-turn',
      label: '重组与提交',
      title: '自由重组，最后一次提交整个桌面',
      content: (
        <>
          <Flow
            steps={[
              '选取桌面牌或手牌',
              '建立、拆分或合并牌组',
              '整桌合法后提交回合',
            ]}
          />
          <p>
            每个出牌回合至少放入 1
            张本人牌。可以给原组加牌、拆分长顺子、拆开四张同数组，或把桌面原牌重新组合；回合结束时，所有桌面原牌都须留在合法牌组中。
          </p>
          <Diagram caption="把红色 3–8 拆成 3–5 与 6–8，再把本人红色 9 加到后段。两段都至少三张。">
            <RuleSet
              faces={[3, 4, 5, 6, 7, 8].map((value) => ({
                color: 'red',
                value,
              }))}
            />
            <span className="rk-rule-arrow" aria-hidden="true">
              ↓
            </span>
            <RuleSet
              faces={[3, 4, 5].map((value) => ({ color: 'red', value }))}
            />
            <RuleSet
              faces={[6, 7, 8, 9].map((value) => ({ color: 'red', value }))}
            />
          </Diagram>
          <p>
            操作只改变本人草稿。点牌后可建立新组，或放入现有组的开头／末尾；组操作中可按数字排、从选中牌拆分及调整组类型。暂时取出的牌放入暂持区，自己的牌也可退回牌架。
          </p>
          <p>
            “撤销”返回上一步，“重置”恢复本回合开始的桌面。完成后点“提交回合”；未完成的组、重复牌、遗漏原桌面牌和非法首出都会拒绝保存，草稿仍保留。
          </p>
        </>
      ),
    },
    {
      id: 'rk-rules-joker',
      label: '百搭',
      title: '替换百搭，必须当回合重新使用',
      content: (
        <>
          <p>
            完成首出后，可以用本人牌或桌面牌替换百搭，也可通过合法拆分与重组把它释放。替代后的旧组其余牌须能构成合法牌组；释放的百搭必须在这个回合加入新的合法牌组，不能放回牌架。
          </p>
          <Diagram caption="用蓝色 4 替换顺子中的百搭，再把百搭作橙色 9，与黑色 9、红色 9 组成新组。">
            <RuleSet
              faces={[
                { color: 'blue', value: 3 },
                { color: 'blue', value: 4, joker: true },
                { color: 'blue', value: 5 },
              ]}
            />
            <span className="rk-rule-arrow" aria-hidden="true">
              ↓
            </span>
            <RuleSet
              faces={[
                { color: 'blue', value: 3 },
                { color: 'blue', value: 4 },
                { color: 'blue', value: 5 },
              ]}
            />
            <RuleSet
              faces={[
                { color: 'black', value: 9 },
                { color: 'orange', value: 9, joker: true },
                { color: 'red', value: 9 },
              ]}
            />
          </Diagram>
          <p>
            含百搭的三张同数组有两种未使用颜色，其中任一种同数牌均可合法替换。含百搭的组仍可加牌、拆分或重组，不能一概锁住。
          </p>
          <p>
            同时重组两枚百搭也一样：两枚都须各自完成合法替代，并在当回合加入新的合法牌组。
          </p>
          <p>
            在草稿中选中百搭，打开“更多”指定颜色数字；替换后改绑并重组。提交会核验释放和重用条件，且本回合仍至少要打出
            1 张本人牌。
          </p>
        </>
      ),
    },
    {
      id: 'rk-rules-score',
      label: '结算与计时',
      title: '本局计分，整场比较赢局数',
      content: (
        <>
          <p>
            一人清空牌架，本局结束。其他人以剩余数字总和记负分，获胜者记这些负分的相反数之和。留在牌架的每张百搭计
            30 点。
          </p>
          <Diagram caption="例如两人对局，另一人剩红色 5、橙色 8：剩余 13 点，他记 −13，清空者记 +13。">
            <RuleSet
              faces={[
                { color: 'red', value: 5 },
                { color: 'orange', value: 8 },
              ]}
            />
            <span className="rk-rule-equation">5 + 8 = 13 → −13 / +13</span>
          </Diagram>
          <p>
            牌池空后，仅在无任何合法出牌时过牌。所有人连续不能出牌即堵局：剩余点数最低者获胜，其他人记自己与最低点数之差的负数，赢家记相反的正额。最低点数并列时，本平台采用共同赢家并均分正额，保留分数精度。
          </p>
          <p>
            本局结束后，由管理员或已授权房主开始下一局。整场结束先比较获胜局数，仍相同再比较累计分数；两项相同共同获胜。这是所采用经典规则的整场比较方式。
          </p>
          <div className="rk-rule-note">
            <strong>数字版计时适配</strong>
            <p>
              官方实体规则规定每回合一分钟，超时未完成重组须恢复原桌面并接受处罚。TableMax
              按平台要求让倒计时只提醒，不自动处罚或代操作。草稿未公开、非法提交会拒绝保存，不能把非法提交当作超时。
            </p>
          </div>
        </>
      ),
    },
  ],
  source: (
    <>
      采用 Rummikub Classic 官方规则，2–4 人。
      <a
        href="https://rummikub.com/wp-content/uploads/2025/06/4600-0236-0013-EN-_rummikub-Classic.pdf"
        target="_blank"
        rel="noreferrer"
      >
        原文 PDF
      </a>{' '}
      的 URL 文件名为 0013，正文印码为 D-4600-0236-0014/EN
      270525。图示为本项目原创逻辑示意；计时与堵局并列处理已分别标注项目适配。
    </>
  ),
};
