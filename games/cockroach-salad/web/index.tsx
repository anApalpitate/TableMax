/* eslint-disable react-refresh/only-export-components -- Lazy game client exports a platform adapter. */
import { useMemo, useState } from 'react';
import type { JsonValue } from '@tablemax/game-sdk';
import {
  useDecisionClock,
  CountdownSettings,
  DisplaySettings,
  OverlayPanel,
  RoomManagement,
  ScreenLink,
  SessionFeedback,
  resourceUrl as releaseResourceUrl,
  type GameClient,
  type GameHost,
  type GameSetupSettingsProps,
} from '@tablemax/web-host';
import {
  names,
  vegetables,
  type Action,
  type Card,
  type SaladView,
  type Setup,
} from '../types';
import { SavedFeedback, SoundControl } from '../ui/SavedFeedback';
import '../ui/style.css';
const resourceUrl = (id: string) => releaseResourceUrl(id, import.meta.url);
function Face({ value }: { value: Card | null }) {
  return value ? (
    <div className={`salad-card ${value.taboo ? 'salad-taboo' : ''}`}>
      <img src={resourceUrl(`cockroach-salad/${value.vegetable}.svg`)} alt="" />
      <strong>{names[value.vegetable]}</strong>
      {value.taboo && <span>🪳 禁忌牌</span>}
    </div>
  ) : (
    <div className="salad-card salad-empty">空牌堆</div>
  );
}
function SetupSettings({ value, disabled, onChange }: GameSetupSettingsProps) {
  const speed = (value as Setup)?.speed ?? 'accelerating';
  return (
    <label className="salad-setting">
      思考节奏
      <select
        value={speed}
        disabled={disabled}
        onChange={(e) => onChange({ speed: e.target.value })}
      >
        <option value="accelerating">渐渐加快 · 6.5至1.8秒</option>
        <option value="relaxed">固定宽松 · 6.5秒</option>
        <option value="classic">固定经典 · 3秒</option>
        <option value="fast">固定快速 · 1.8秒</option>
      </select>
    </label>
  );
}
function Clock({
  timing,
}: {
  timing:
    | { key: string; remainingMs: number; serverTime: number; running: boolean }
    | null
    | undefined;
}) {
  const clock = useMemo(
    () =>
      timing
        ? {
            id: timing.key,
            remainingMs: timing.remainingMs,
            serverTime: timing.serverTime,
            running: timing.running,
          }
        : null,
    [timing],
  );
  const left = useDecisionClock(clock);
  return (
    <strong className="salad-clock" role="timer">
      {(Math.ceil(left / 100) / 10).toFixed(1)} 秒
      {timing?.running ? '' : ' · 暂停'}
    </strong>
  );
}
function Rulebook() {
  return (
    <div className="salad-rulebook">
      <h2>128张牌，一场嘴快脑更快的沙拉</h2>
      <p>
        2–6人。四种蔬菜各28张普通牌、4张禁忌牌。平均发为面朝下的个人牌堆，余牌移出；不得提前查看自己的牌。按座位顺序开始，先出完者在质疑窗口结束后获胜。
      </p>
      <div className="salad-examples">
        {vegetables.map((v, i) => (
          <Face key={v} value={{ id: i * 32, vegetable: v, taboo: false }} />
        ))}
      </div>
      <h2>说真话；遇到重复，就必须说谎</h2>
      <p>
        通常回答当前蔬菜。当前蔬菜与上一张牌的蔬菜、上一次实际回答、可见禁忌蔬菜任一相同，改答另一个蔬菜；替代词也不得是上一张蔬菜、上一答案或禁忌。禁忌牌一律回答“蟑螂”。五个按钮固定位置，错误答案也可以点击。
      </p>
      <img
        className="salad-rule-picture"
        src={resourceUrl('cockroach-salad/rules.svg')}
        alt="番茄接番茄时，避开番茄和禁忌甜椒，改说生菜或花椰菜"
      />
      <h2>两堆轮流，禁忌只看露出的牌</h2>
      <p>
        打出禁忌牌后，下张牌换至另一堆。换堆的第一张牌仍须避开覆盖前的旧禁忌，因此该回合可能两种禁忌同时有效。之后旧禁忌被盖住即可解除。
      </p>
      <h2>共同质疑，窗口结束一起判</h2>
      <p>
        以下是数字改编：答完共同等待1.8秒，其他人可质疑或放过。超过思考时限即成为拖延，仍可在额外3秒内回答或被质疑；3秒后无人回答自动收全部桌面牌。晚回答的拖延事实保留。错误或拖延被漏抓则过关，系统不公布正确答案。
      </p>
      <p>
        质疑在同窗内秘密提交，第一人不会提前揭晓对错。成立时作答者只收一遍两堆；不成立时所有误判者按固定座位顺序轮流各收一张，余数由靠前者取得。收取顺序为第一堆从底到顶、再第二堆从底到顶，放个人牌堆底。犯错者或首位误判者开始新轮。所有人放过也等到窗口截止，不提前推进。
      </p>
      <h2>最后一张同样要等</h2>
      <p>
        空手玩家先等待本窗口。无人质疑或质疑不成立才获胜；成立则拿回桌面牌，继续。暂停及重启按最后保存的剩余时间恢复；回退保留所回到的阶段，并重新开始该阶段的完整时限。
      </p>
      <p>
        默认渐快每次无处罚过关缩短0.1秒，最低1.8秒；可在开局选择固定节奏。人机默认／豆包／绝悟逐级加快反应并减少失误和漏抓，只看公开信息。
      </p>
      <p>
        依据 Schmidt Spiele 40839
        经典规则英文第9–14页，排除蟑螂汤混合玩法。按钮回答、速度、质疑与多人分牌为本平台数字改编；原版直接判每个错误和超过三秒的迟疑。
      </p>
    </div>
  );
}
function Screen({ session }: { session: GameHost }) {
  const { view, role, locked, command } = session;
  const game = view?.gameView as unknown as SaladView | null;
  const [panel, setPanel] = useState<'rules' | 'settings' | null>(null);
  const actions = (view?.actions ?? []) as Action[];
  const active =
    !!view &&
    !view.paused &&
    view.status === 'playing' &&
    session.connected &&
    !locked;
  const name = (id: string) => view?.seats.find((s) => s.id === id)?.name ?? id;
  const choose = (action: Action) => {
    if (view?.decisionId)
      command({
        type: 'game',
        decisionId: view.decisionId,
        action: action as JsonValue,
      });
  };
  return (
    <main className={`salad-screen salad-${role}`}>
      <header>
        <ScreenLink href={`/${role}`}>‹ 盒子</ScreenLink>
        <h1>
          蟑螂沙拉 <span>脆生生的脑力派对</span>
        </h1>
        <button onClick={() => setPanel('rules')}>图文规则</button>
        <button onClick={() => setPanel('settings')}>游戏设置</button>
      </header>
      <SessionFeedback session={session} />
      <SavedFeedback session={session} />
      {game ? (
        <>
          <section className="salad-status">
            <h2>
              {game.phase === 'ended'
                ? `${game.winners.map(name).join('、')} 获胜！`
                : `${name(game.actor)}${game.phase === 'review' ? ' 已回答' : ' 作答中'}`}
            </h2>
            {game.phase !== 'ended' && (
              <Clock key={game.step} timing={view?.automaticTiming} />
            )}
            {game.phase === 'overtime' && (
              <strong>已拖延 · 可质疑，继续无操作将自动收牌</strong>
            )}
          </section>
          <div className="salad-layout">
            <section className="salad-table">
              <div className="salad-context">
                <span>
                  上一张：
                  {game.previousVegetable
                    ? names[game.previousVegetable]
                    : '无'}
                </span>
                <span>
                  上一答案：
                  {game.previousAnswer ? names[game.previousAnswer] : '无'}
                </span>
              </div>
              <div className="salad-piles">
                {game.piles.map((p, i) => (
                  <section
                    key={i}
                    className={i === game.pile ? 'salad-current' : ''}
                  >
                    <h3>
                      第{i + 1}堆 · {game.pileCounts[i]}张
                      {i === game.pile ? ' · 当前' : ''}
                    </h3>
                    <Face value={p} />
                  </section>
                ))}
              </div>
              <div className="salad-taboo-label">
                本次禁忌：
                {game.taboo.length
                  ? game.taboo.map((v) => names[v]).join('、')
                  : '无'}
              </div>
              <p className="salad-answer">
                本次回答：
                <strong>
                  {game.answer ? names[game.answer] : '等待点击…'}
                </strong>
              </p>
              {role === 'player' && (
                <section className="salad-controls" aria-label="作答与质疑">
                  <div className="salad-answer-buttons">
                    {[...vegetables, 'cockroach' as const].map((answer) => (
                      <button
                        key={answer}
                        disabled={
                          !active || !actions.some((a) => a.type === 'answer')
                        }
                        onClick={() => choose({ type: 'answer', answer })}
                      >
                        {answer === 'cockroach' ? (
                          '🪳'
                        ) : (
                          <img
                            src={resourceUrl(`cockroach-salad/${answer}.svg`)}
                            alt=""
                          />
                        )}
                        {names[answer]}
                      </button>
                    ))}
                  </div>
                  <div className="salad-reactions">
                    {(['challenge', 'pass'] as const).map((type) => (
                      <button
                        key={type}
                        disabled={
                          !active || !actions.some((a) => a.type === type)
                        }
                        onClick={() => choose({ type })}
                      >
                        {type === 'challenge' ? '质疑错误／拖延' : '本窗放过'}
                      </button>
                    ))}
                  </div>
                  {game.selfResponse && (
                    <p>
                      已秘密提交：
                      {game.selfResponse === 'challenge' ? '质疑' : '放过'}
                      ，等待共同截止。
                    </p>
                  )}
                </section>
              )}
              <p className="salad-result" aria-live="polite">
                {game.lastResult}
              </p>
            </section>
            <aside className="salad-seats">
              {game.seats.map((id) => (
                <div
                  key={id}
                  className={id === game.actor ? 'salad-seat-active' : ''}
                >
                  <strong>{name(id)}</strong>
                  <span>{game.counts[id]} 张</span>
                  {role === 'player' && id === session.self?.id && (
                    <small>你</small>
                  )}
                </div>
              ))}
            </aside>
          </div>
        </>
      ) : (
        <p>在盒子完成准备后开始。</p>
      )}
      {panel && (
        <OverlayPanel
          title={panel === 'rules' ? '蟑螂沙拉 · 图文规则' : '蟑螂沙拉 · 设置'}
          close={() => setPanel(null)}
          className="salad-overlay"
        >
          {panel === 'rules' ? (
            <Rulebook />
          ) : (
            <>
              <SoundControl />
              <CountdownSettings session={session} />
              <DisplaySettings role={role} />
              {game && (
                <p>
                  本局节奏：
                  {
                    {
                      accelerating: '渐渐加快',
                      relaxed: '固定宽松',
                      classic: '固定经典',
                      fast: '固定快速',
                    }[game.setup.speed]
                  }
                  ；在盒子开局设置调整下一局。
                </p>
              )}
              {session.canControl && (
                <RoomManagement session={session} lifecycleLabel="开始下一局" />
              )}
            </>
          )}
        </OverlayPanel>
      )}
    </main>
  );
}
export const client: GameClient = {
  SetupSettings,
  Screen,
  savedChanges: () => [],
  motionDuration: 0,
};
