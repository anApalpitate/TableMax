/* eslint-disable react-refresh/only-export-components -- The lazy game entry exports the platform client. */
import { useState } from 'react';
import type { JsonValue } from '@tablemax/game-sdk';
import {
  CountdownSettings,
  DecisionCountdown,
  DisplaySettings,
  OverlayPanel,
  PlayModeBadge,
  PlayModeControl,
  RoomManagement,
  RulesGuide,
  ScreenLink,
  SessionFeedback,
  type GameClient,
  type GameHost,
} from '@tablemax/web-host';
import type { Action, ManilaView } from '../rules/view';
import { HarborBoard, Market, Players } from '../ui/Board';
import { PlayerControls } from '../ui/PlayerControls';
import { cargoColors, cargoNames, phaseNames } from '../ui/labels';
import { cargoStyle } from '../ui/pieces';
import { manilaRulebook } from '../ui/RulesGuide';
import '../ui/style.css';

function ManilaScreen({ session }: { session: GameHost }) {
  const { view, role, command, connected, locked, canControl } = session;
  const game = view?.gameView as ManilaView | null;
  const [panel, setPanel] = useState<'menu' | 'rules' | 'ledger' | null>(null);
  const [selection, setSelection] = useState<{
    boundary: string;
    action: Action | null;
  } | null>(null);
  const boundary = `${view?.instanceId}:${view?.branch}:${view?.decisionId ?? 'waiting'}`;
  const actions = role === 'player' ? ((view?.actions ?? []) as Action[]) : [];
  const draft =
    selection?.boundary === boundary &&
    selection.action &&
    actions.some(
      (action) => JSON.stringify(action) === JSON.stringify(selection.action),
    )
      ? selection.action
      : null;
  const select = (action: Action | null) => setSelection({ boundary, action });
  const choose = (action: Action) => {
    if (
      role === 'player' &&
      view?.decisionId &&
      !locked &&
      connected &&
      !view.paused &&
      view.status === 'playing'
    ) {
      command({
        type: 'game',
        decisionId: view.decisionId,
        action: action as unknown as JsonValue,
      });
    }
  };
  const names = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, seat.name]) ?? [],
  );
  const nameText = (text: string) =>
    Object.entries(names).reduce(
      (result, [id, name]) => result.replaceAll(id, name),
      text,
    );
  const active =
    connected && view?.status === 'playing' && !view.paused && !view.botError;
  const saved =
    session.motion.length > 0 && view?.playMode !== 'test' && active;
  const notice = !connected
    ? '正在重新连接'
    : (view?.botError ??
      (view?.paused
        ? view.restored
          ? '存档已恢复，等待房主继续'
          : '游戏已暂停'
        : view?.status === 'ended' && game?.phase !== 'ended'
          ? (view.endReason ?? '对局已结束')
          : ''));
  const nextVoyage = view?.lifecycleActions.find(
    (action) => (action as Action).type === 'next-voyage',
  ) as Action | undefined;
  const rank = game?.scores
    ? [...game.seatOrder].sort((a, b) => game.scores![b]! - game.scores![a]!)
    : [];
  return (
    <main
      className={`manila-screen mn-screen mn-screen--${role}`}
      data-phase={game?.phase}
      data-play-mode={view?.playMode ?? 'play'}
      data-saved-motion={saved ? 'true' : 'false'}
      data-motion={
        saved && session.motion.includes('manila:sail') ? 'sail' : ''
      }
    >
      <header className="mn-toolbar">
        <ScreenLink className="button" href={`/${role}`}>
          ‹ 盒子
        </ScreenLink>
        <div className="mn-brand">
          <strong>MANILA</strong>
          <span>马尼拉 · 经典版</span>
        </div>
        {game && <span className="mn-voyage">第 {game.voyage} 航次</span>}
        <div className="mn-toolbar-tools">
          <PlayModeBadge mode={view?.playMode} />
          <button
            className="game-rulebook-entry"
            onClick={() => setPanel('rules')}
          >
            规则
          </button>
          <button onClick={() => setPanel('ledger')}>账本</button>
          <button onClick={() => setPanel('menu')}>菜单</button>
        </div>
      </header>
      <SessionFeedback session={session} />
      {notice && (
        <div className="mn-notice" role="status">
          <span>{notice}</span>
          {canControl && connected && view?.paused && (
            <button
              disabled={locked}
              onClick={() => command({ type: 'resume' })}
            >
              继续航行
            </button>
          )}
        </div>
      )}
      {!game || !view ? (
        <section className="mn-empty">
          <h1>等待商人齐聚港湾</h1>
          <p>{connected ? '回到盒子入座并准备。' : '正在恢复港湾沙盘。'}</p>
          <ScreenLink className="button" href={`/${role}`}>
            回到盒子
          </ScreenLink>
        </section>
      ) : (
        <>
          <section className="mn-status" aria-label="当前阶段">
            <div>
              <span className="mn-mobile-voyage">第 {game.voyage} 航次 · </span>
              <strong>{phaseNames[game.phase]}</strong>
              <span className="mn-status-detail">
                {game.turnSeat
                  ? `${names[game.turnSeat] ?? '商人'}${game.turnSeat === game.self?.seatId ? ' · 轮到你' : '行动'}`
                  : game.phase === 'ended'
                    ? '一项货物达到 30，比较最终财富'
                    : '等待保存结果'}
              </span>
            </div>
            <DecisionCountdown
              view={view}
              connected={connected}
              compact={role === 'player'}
            />
          </section>
          {role === 'player' && game.self && (
            <section className="mn-private" aria-label="本人财富与秘密股份">
              <div>
                <strong>{game.self.cash} ₱</strong>
                <span> · 可抵押额度 {game.self.availableCredit} ₱</span>
              </div>
              <div className="mn-shares">
                {game.self.shares.map((share) => (
                  <span
                    className="mn-share"
                    key={share.id}
                    style={cargoStyle(cargoColors[share.cargo])}
                  >
                    {cargoNames[share.cargo]}
                    {share.mortgaged ? ' · 已抵押' : ''}
                    {share.revealed ? ' · 已公开' : ''}
                  </span>
                ))}
              </div>
            </section>
          )}
          <div className="mn-layout">
            <div className="mn-main">
              {game.phase === 'ended' && game.scores && (
                <section className="mn-result">
                  <h2>
                    {game.winners.map((id) => names[id]).join('、')}赢得贸易盛会
                  </h2>
                  <p>现金 ＋ 股份市值 − 每张抵押股份 15 ₱</p>
                  <ol>
                    {rank.map((id) => (
                      <li key={id}>
                        <strong>
                          {names[id]} · {game.scores![id]} ₱
                        </strong>
                      </li>
                    ))}
                  </ol>
                  {canControl && (
                    <button
                      className="mn-primary"
                      disabled={locked}
                      onClick={() => command({ type: 'replay' })}
                    >
                      原班人马再玩一局
                    </button>
                  )}
                </section>
              )}
              <HarborBoard
                game={game}
                names={names}
                actions={actions}
                draft={draft}
                select={select}
                locked={locked || !active}
              />
              {game.phase === 'round-result' && game.result && (
                <section className="mn-result">
                  <h2>第 {game.result.voyage} 航次完成</h2>
                  <div className="mn-rule-values">
                    {game.seatOrder.map((id) => (
                      <span key={id}>
                        {names[id]}{' '}
                        <strong>
                          {game.result!.income[id]! >= 0 ? '+' : ''}
                          {game.result!.income[id]} ₱
                        </strong>
                      </span>
                    ))}
                  </div>
                  <p>
                    靠港：
                    {game.result.port
                      .map((cargo) => cargoNames[cargo])
                      .join('、') || '无'}{' '}
                    · 进坞：
                    {game.result.shipyard
                      .map((cargo) => cargoNames[cargo])
                      .join('、') || '无'}
                  </p>
                  {canControl && nextVoyage && (
                    <button
                      className="mn-primary"
                      disabled={locked || !active}
                      onClick={() =>
                        command({
                          type: 'lifecycle',
                          action: nextVoyage as unknown as JsonValue,
                        })
                      }
                    >
                      开始下一航次
                    </button>
                  )}
                </section>
              )}
              {game.latest && (
                <section className="mn-receipt" aria-label="最新已保存结果">
                  <p>{nameText(game.latest)}</p>
                </section>
              )}
            </div>
            <aside className="mn-side">
              {role === 'player' && game.self && game.phase !== 'ended' && (
                <PlayerControls
                  key={boundary}
                  game={game}
                  actions={actions}
                  locked={locked || !active}
                  draft={draft}
                  select={select}
                  choose={choose}
                />
              )}
              <Market game={game} />
              <Players game={game} seats={view.seats} />
            </aside>
          </div>
        </>
      )}
      {panel && (
        <OverlayPanel
          className="mn-overlay"
          title={
            panel === 'rules'
              ? '马尼拉 · 图文规则'
              : panel === 'ledger'
                ? '商人账本'
                : '港湾菜单'
          }
          close={() => setPanel(null)}
        >
          {panel === 'rules' ? (
            <RulesGuide {...manilaRulebook} />
          ) : panel === 'ledger' && game ? (
            <div className="mn-screen mn-panel">
              <Players game={game} seats={view?.seats ?? []} />
              <Market game={game} />
              {game.result && (
                <>
                  <h2>最近航次分红</h2>
                  <ul className="mn-log">
                    {game.seatOrder.map((id) => (
                      <li key={id}>
                        {names[id]}：{game.result!.income[id]} ₱
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p>现金和股份张数公开；只有本人能查看未揭示股份的种类。</p>
              {game.phase === 'ended' && (
                <ul className="mn-log">
                  {game.seatOrder.map((id) => (
                    <li key={id}>
                      <strong>{names[id]}</strong>：
                      {game.players[id]!.revealedShares.map(
                        (share) =>
                          `${cargoNames[share.cargo]}${share.mortgaged ? '（抵押）' : ''}`,
                      ).join('、')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div className="dialog-actions game-menu-settings">
                <CountdownSettings session={session} />
                {role !== 'player' && <DisplaySettings role={role} />}
              </div>
              {canControl && (
                <RoomManagement
                  session={session}
                  lifecycleLabel="开始下一航次"
                />
              )}
            </>
          )}
        </OverlayPanel>
      )}
      <PlayModeControl session={session} />
    </main>
  );
}

export const client: GameClient = {
  Screen: ManilaScreen,
  savedChanges: (before, after) => {
    const previous = before as ManilaView;
    const next = after as ManilaView;
    if (!next.latest || JSON.stringify(previous) === JSON.stringify(next))
      return [];
    return previous.voyage === next.voyage &&
      next.dice.length > previous.dice.length
      ? ['manila:sail']
      : ['manila:result'];
  },
  motionDuration: 1000,
};
