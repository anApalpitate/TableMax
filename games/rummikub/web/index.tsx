/* eslint-disable react-refresh/only-export-components -- Lazy adapters expose one platform client object. */
import { useState } from 'react';
import type { JsonValue } from '@tablemax/game-sdk';
import {
  avatarFor,
  CountdownSettings,
  DecisionCountdown,
  DisplaySettings,
  FullscreenControl,
  OverlayPanel,
  PlayModeBadge,
  PlayModeControl,
  RoomManagement,
  RulesGuide,
  ScreenLink,
  SessionFeedback,
  useAudioOutput,
  type GameClient,
  type GameHost,
} from '@tablemax/web-host';
import type { Action, RummikubView } from '../types';
import { PublicBoard } from '../ui/Board';
import { PlayerWorkshop, WaitingRack } from '../ui/PlayerWorkshop';
import { turnScope } from '../ui/draft';
import { RummikubSoundControl } from '../ui/audio';
import { rummikubRulebook } from '../ui/RulesGuide';
import { scoreLabel } from '../ui/labels';
import '../ui/style.css';

function RummikubScreen({ session }: { session: GameHost }) {
  const { role, view, connected, locked, canControl, command } = session;
  const game = view?.gameView as RummikubView | null;
  const [panel, setPanel] = useState<'menu' | 'rules' | 'players' | null>(null);
  const canPlay = useAudioOutput();
  const currentFeedback =
    session.feedback?.instanceId === view?.instanceId &&
    session.feedback?.branch === view?.branch &&
    session.feedback?.revision === view?.revision
      ? session.feedback
      : null;
  const names = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, seat.name]) ?? [],
  );
  const portraits = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, avatarFor(seat.avatarId)]) ?? [],
  );
  const ownTurn =
    role === 'player' &&
    game?.self?.seatId === game?.turnSeat &&
    game?.phase === 'playing';
  const active =
    view?.status === 'playing' && connected && !view.paused && !view.botError;
  const notice = !connected
    ? '正在重新连接'
    : view?.botError
      ? view.botError
      : view?.paused
        ? view.restored
          ? '存档已恢复，等待房主继续'
          : '游戏已暂停'
        : '';
  const choose = (action: Action) => {
    if (view?.decisionId)
      command({
        type: 'game',
        decisionId: view.decisionId,
        action: action as unknown as JsonValue,
      });
  };
  const lifecycle = view?.lifecycleActions.find(
    (action) => (action as Action).type === 'next-game',
  );
  const result = game?.results.at(-1);
  const saved = session.motion.length > 0 && view?.playMode !== 'test';
  const seatStrip = game && (
    <div className="rk-seats" aria-label="玩家与牌架张数">
      {game.seatOrder.map((id, index) => {
        const player = game.players[id]!;
        return (
          <article
            key={id}
            className={`rk-seat${game.turnSeat === id ? ' rk-seat--current' : ''}${game.self?.seatId === id ? ' rk-seat--self' : ''}`}
          >
            <span className="rk-seat-number">{index + 1}</span>
            <img src={portraits[id]} alt="" />
            <div className="rk-seat-identity">
              <strong title={names[id]}>{names[id]}</strong>
              <span>
                {player.rackCount} 张{player.opened ? '，已首出' : '，未首出'}
              </span>
            </div>
            <span className="rk-seat-score" title="累计分数">
              {scoreLabel(player.score)} 分
            </span>
          </article>
        );
      })}
    </div>
  );
  return (
    <main
      className={`rk-screen rk-screen--${role}${saved ? ' rk-saved' : ''}`}
      data-phase={game?.phase}
      data-play-mode={view?.playMode ?? 'play'}
    >
      <header className="rk-toolbar">
        <ScreenLink href={`/${role}`} className="rk-box-link">
          ‹ 盒子
        </ScreenLink>
        <strong className="rk-brand">拉密</strong>
        {game && (
          <span className="rk-game-counter">
            第 {game.gameNumber}/{game.gameCount} 局
          </span>
        )}
        <div className="rk-toolbar-tools">
          <PlayModeBadge mode={view?.playMode} />
          <RummikubSoundControl
            feedback={currentFeedback}
            game={game}
            disabled={
              !connected ||
              Boolean(view?.paused || view?.botError) ||
              view?.playMode === 'test'
            }
            canPlay={canPlay}
            player={role === 'player'}
          />
          <button
            className="game-rulebook-entry"
            type="button"
            onClick={() => setPanel('rules')}
          >
            规则
          </button>
          <button type="button" onClick={() => setPanel('menu')}>
            菜单
          </button>
          {role !== 'player' && <FullscreenControl />}
        </div>
      </header>
      {((session.message && session.message !== '已保存') ||
        session.admissionPending ||
        session.awaitingConfirmation) && <SessionFeedback session={session} />}
      {!game || !view ? (
        <div className="rk-unavailable">
          <h1>等待拉密开局</h1>
          <ScreenLink href={`/${role}`}>回到盒子</ScreenLink>
        </div>
      ) : (
        <>
          <div className="rk-turn-bar">
            <div className="rk-turn-identity">
              {game.turnSeat && <img src={portraits[game.turnSeat]} alt="" />}
              <strong>
                {game.phase === 'playing'
                  ? ownTurn
                    ? '轮到你'
                    : `${names[game.turnSeat ?? ''] ?? '下一位'}的回合`
                  : game.phase === 'ended'
                    ? '整场结束'
                    : '本局结算'}
              </strong>
            </div>
            {notice ? (
              <span className="rk-notice" role="status">
                {notice}
              </span>
            ) : (
              <span className="rk-pool-count">牌池 {game.poolCount} 张</span>
            )}
            <DecisionCountdown view={view} connected={connected} compact />
            {canControl && view.paused && (
              <button
                type="button"
                disabled={locked}
                onClick={() => command({ type: 'resume' })}
              >
                恢复
              </button>
            )}
            {role === 'player' && (
              <button
                type="button"
                className="rk-players-entry"
                onClick={() => setPanel('players')}
                aria-label="查看全部玩家"
              >
                玩家
              </button>
            )}
          </div>
          {role !== 'player' && seatStrip}
          {game.phase === 'playing' ? (
            ownTurn && game.self ? (
              <PlayerWorkshop
                key={turnScope(view.instanceId, view.branch, game)}
                game={game}
                scope={turnScope(view.instanceId, view.branch, game)}
                locked={locked || !active}
                actions={view.actions as Action[]}
                choose={choose}
              />
            ) : (
              <div
                className={`rk-saved-workspace${role === 'player' ? ' rk-saved-workspace--player' : ''}`}
              >
                <section className="rk-table-section">
                  <div className="rk-section-heading">
                    <h2>已保存桌面</h2>
                    <span>
                      {game.table.reduce(
                        (sum, group) => sum + group.tiles.length,
                        0,
                      )}{' '}
                      张
                    </span>
                  </div>
                  <PublicBoard
                    table={game.table}
                    placed={game.latest?.placedTileIds ?? []}
                  />
                </section>
                {role === 'player' && game.self && <WaitingRack game={game} />}
              </div>
            )
          ) : (
            result && (
              <div className="rk-results-scroll">
                <section className="rk-results">
                  <h1>
                    {game.phase === 'ended'
                      ? '整场结算'
                      : `第 ${game.gameNumber} 局结算`}
                  </h1>
                  <p>
                    {result.reason === 'empty-rack'
                      ? `${result.winners.map((id) => names[id]).join('、')}清空牌架`
                      : '牌池已空，所有人均无合法出牌'}
                  </p>
                  <div className="rk-result-grid">
                    {game.seatOrder.map((id) => (
                      <article
                        key={id}
                        className={`rk-result${(game.phase === 'ended' ? game.winners : result.winners).includes(id) ? ' rk-result--winner' : ''}`}
                      >
                        <img src={portraits[id]} alt="" />
                        <h2>{names[id]}</h2>
                        {(game.phase === 'ended'
                          ? game.winners
                          : result.winners
                        ).includes(id) && (
                          <span className="rk-winner-label">
                            ★ {game.phase === 'ended' ? '整场赢家' : '本局赢家'}
                          </span>
                        )}
                        <dl>
                          <div>
                            <dt>牌架点数</dt>
                            <dd>{result.rackValues[id]}</dd>
                          </div>
                          <div>
                            <dt>本局分数</dt>
                            <dd>
                              {result.scores[id]! > 0 ? '+' : ''}
                              {scoreLabel(result.scores[id]!)}
                            </dd>
                          </div>
                          <div>
                            <dt>累计分数</dt>
                            <dd>{scoreLabel(game.players[id]!.score)}</dd>
                          </div>
                          <div>
                            <dt>获胜局数</dt>
                            <dd>{game.players[id]!.wins}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                  {canControl && (
                    <div className="rk-result-actions">
                      {lifecycle ? (
                        <button
                          type="button"
                          className="rk-primary"
                          disabled={locked}
                          onClick={() =>
                            command({
                              type: 'lifecycle',
                              action: lifecycle as unknown as JsonValue,
                            })
                          }
                        >
                          开始下一局
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rk-primary"
                          disabled={locked}
                          onClick={() => command({ type: 'replay' })}
                        >
                          原班人马再玩一场
                        </button>
                      )}
                    </div>
                  )}
                </section>
                <section className="rk-final-table">
                  <h2>本局最终桌面</h2>
                  <PublicBoard table={game.table} />
                </section>
              </div>
            )
          )}
          {game.latest && (
            <div
              className="rk-latest"
              aria-live="polite"
              data-latest-saved-action
            >
              <strong>
                {game.latest.actor ? names[game.latest.actor] : '拉密'}
              </strong>
              <span>{game.latest.text}</span>
              <span className="rk-saved-label">已保存</span>
            </div>
          )}
        </>
      )}
      {panel && (
        <OverlayPanel
          title={
            panel === 'rules' ? (
              <>
                <span className="rules-guide__title-part">拉密经典版</span>
                <span className="rules-guide__title-part">图文规则</span>
              </>
            ) : panel === 'players' ? (
              '围桌玩家'
            ) : (
              '拉密菜单'
            )
          }
          close={() => setPanel(null)}
          className="rk-overlay"
        >
          {panel === 'rules' ? (
            <RulesGuide {...rummikubRulebook} />
          ) : (
            <div className="rk-screen rk-panel">
              {panel === 'players' ? (
                seatStrip
              ) : (
                <>
                  {role === 'player' && <FullscreenControl />}
                  <div className="dialog-actions game-menu-settings">
                    <CountdownSettings session={session} />
                    <DisplaySettings role={role} />
                  </div>
                  {canControl && (
                    <RoomManagement
                      session={session}
                      lifecycleLabel="开始下一局"
                    />
                  )}
                  <h2>对局记录</h2>
                  {game?.results.length ? (
                    <div className="rk-history">
                      {game.results.map((entry) => (
                        <article key={entry.gameNumber}>
                          <h3>第 {entry.gameNumber} 局</h3>
                          <p>
                            {entry.winners.map((id) => names[id]).join('、')}
                            获胜
                          </p>
                          <dl>
                            {game.seatOrder.map((id) => (
                              <div key={id}>
                                <dt>{names[id]}</dt>
                                <dd>
                                  {entry.scores[id]! > 0 ? '+' : ''}
                                  {scoreLabel(entry.scores[id]!)} 分
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>本局尚未结算。</p>
                  )}
                </>
              )}
            </div>
          )}
        </OverlayPanel>
      )}
      <PlayModeControl session={session} />
    </main>
  );
}

export const client: GameClient = {
  Screen: RummikubScreen,
  savedChanges(before, after) {
    const previous = before as RummikubView;
    const next = after as RummikubView;
    return next.latest && previous.latest?.serial !== next.latest.serial
      ? [`rummikub:${next.latest.serial}`]
      : [];
  },
  motionDuration: 650,
};
