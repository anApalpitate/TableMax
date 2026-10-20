/* eslint-disable react-refresh/only-export-components -- The lazy game module exports its platform client. */
import { useEffect, useState } from 'react';
import type { JsonValue } from '@tablemax/game-sdk';
import {
  avatarFor,
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
  useAudioOutput,
  type GameClient,
  type GameHost,
} from '@tablemax/web-host';
import type { Action, UnoView } from '../types';
import type { UnoSetup } from '../config';
import { Board, Seats, Leaderboard } from '../ui/Board';
import { Card } from '../ui/Card';
import { ColorChoice, Hand, colorNames } from '../ui/Hand';
import { UnoSoundControl } from '../ui/audio';
import { unoRulebook } from '../ui/RulesGuide';
import { SavedEffect } from '../ui/SavedEffects';
import { UnoSetupSettings } from '../ui/SetupSettings';
import '../ui/style.css';

function CatchUnoControl({
  timing,
  disabled,
  choose,
}: {
  timing:
    { remainingMs: number; serverTime: number; running: boolean } | undefined;
  disabled: boolean;
  choose(): void;
}) {
  const [receivedAt] = useState(() => performance.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!timing?.running || timing.remainingMs <= 0) return;
    const update = () => {
      const passed = performance.now() - receivedAt;
      setElapsed(passed);
      if (passed >= timing.remainingMs) clearInterval(timer);
    };
    const timer = setInterval(update, 50);
    return () => clearInterval(timer);
  }, [receivedAt, timing?.running, timing?.remainingMs]);
  const remaining = Math.max(
    0,
    (timing?.remainingMs ?? 0) - (timing?.running ? elapsed : 0),
  );
  const seconds = (Math.ceil(remaining / 100) / 10).toFixed(1);
  return (
    <button
      className="uno-primary uno-catch-control"
      type="button"
      disabled={disabled || remaining > 0}
      onClick={choose}
      aria-label={
        remaining > 0 ? '质疑漏喊 UNO，等待 ' + seconds + ' 秒' : '质疑漏喊 UNO'
      }
    >
      {remaining > 0 ? '抓漏 ' + seconds + ' 秒' : '抓漏 UNO'}
    </button>
  );
}

function UnoScreen({ session }: { session: GameHost }) {
  const { role, view, connected, locked, canControl, command } = session;
  const game = view?.gameView as UnoView | null;
  const [panel, setPanel] = useState<'menu' | 'rules' | 'players' | null>(null);
  const [dismissedEvidence, setDismissedEvidence] = useState('');
  const [announcedEvidence, setAnnouncedEvidence] = useState('');
  const canPlay = useAudioOutput();
  const player = role === 'player';
  const currentFeedback =
    session.feedback?.instanceId === view?.instanceId &&
    session.feedback?.branch === view?.branch &&
    session.feedback?.revision === view?.revision
      ? session.feedback
      : null;
  const names = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, seat.name]) ?? [],
  );
  const active =
    view?.status === 'playing' && connected && !view.paused && !view.botError;
  const actions = (view?.actions ?? []) as Action[];
  const action = (type: Action['type']) =>
    actions.find((entry) => entry.type === type);
  const choose = (choice: Action) => {
    if (view?.decisionId)
      command({
        type: 'game',
        decisionId: view.decisionId,
        action: choice as unknown as JsonValue,
      });
  };
  const notice = !connected
    ? '正在重新连接'
    : view?.botError
      ? view.botError
      : view?.paused
        ? view.restored
          ? '存档已恢复，等待房主继续'
          : '游戏已暂停'
        : '';
  const declare = action('declare-uno');
  const catchUno = action('catch-uno');
  const catchTiming = view?.actionTiming?.find(
    (timing) => timing.actionType === 'catch-uno',
  );
  const acceptPenalty = action('accept-draw-penalty');
  const accept = action('accept-draw-four');
  const challenge = action('challenge-draw-four');
  const evidence = game?.self?.challengeEvidence;
  const evidenceKey = `${view?.instanceId}:${view?.branch}:${game?.latest?.serial}`;
  const result = game?.results.at(-1);
  const lifecycle = view?.lifecycleActions.find(
    (entry) => (entry as Action).type === 'next-round',
  );
  const ownTurn = player && game?.turnSeat === game?.self?.seatId;
  const shownSaved =
    session.motion.length > 0 &&
    view?.playMode !== 'test' &&
    connected &&
    !view?.paused;
  const authorizedEvidence = Boolean(
    player &&
    evidence &&
    game &&
    game.self &&
    game.latest &&
    game.latest.actor === game.self.seatId &&
    /challenge/.test(game.latest.verb),
  );
  if (
    authorizedEvidence &&
    shownSaved &&
    currentFeedback &&
    announcedEvidence !== evidenceKey
  )
    setAnnouncedEvidence(evidenceKey);
  const heading =
    game?.phase === 'ended'
      ? '整场结束'
      : game?.phase === 'round-result'
        ? '本局结束'
        : game?.stage === 'draw-four'
          ? `${names[game.drawFour?.target ?? ''] ?? '下一位'}回应 +4`
          : game?.stage === 'draw-penalty'
            ? ownTurn
              ? '传递或补牌'
              : `${names[game.turnSeat ?? ''] ?? '下一位'}回应补牌`
            : game?.stage === 'choose-color'
              ? '选择开局颜色'
              : ownTurn
                ? '轮到你'
                : `${names[game?.turnSeat ?? ''] ?? '下一位'}的回合`;
  return (
    <main
      className={`uno-screen uno-screen--${role}`}
      data-phase={game?.phase}
      data-play-mode={view?.playMode ?? 'play'}
    >
      <header className="uno-toolbar">
        <ScreenLink href={`/${role}`} className="uno-box-link">
          ‹ 盒子
        </ScreenLink>
        <strong className="uno-brand">UNO</strong>
        {game && (
          <span className="uno-round-counter">第 {game.roundNumber} 局</span>
        )}
        <div className="uno-toolbar-tools">
          <PlayModeBadge mode={view?.playMode} />
          <UnoSoundControl
            feedback={currentFeedback}
            game={game}
            disabled={
              !connected ||
              Boolean(view?.paused || view?.botError) ||
              view?.playMode === 'test'
            }
            canPlay={canPlay}
            player={player}
          />
          <button
            className="game-rulebook-entry uno-icon-button"
            type="button"
            aria-label="规则"
            title="规则"
            onClick={() => setPanel('rules')}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v15M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" />
            </svg>
          </button>
          <button
            type="button"
            className="uno-icon-button"
            aria-label="菜单"
            title="菜单"
            onClick={() => setPanel('menu')}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>
      {((session.message && session.message !== '已保存') ||
        session.admissionPending ||
        session.awaitingConfirmation) && <SessionFeedback session={session} />}
      {!game || !view ? (
        <div className="uno-unavailable">
          <h1>等待 UNO 开局</h1>
          <ScreenLink href={`/${role}`}>回到盒子</ScreenLink>
        </div>
      ) : (
        <>
          <div className="uno-turn-bar">
            <div className="uno-turn-identity">
              {game.turnSeat && (
                <img
                  src={avatarFor(
                    view.seats.find((seat) => seat.id === game.turnSeat)
                      ?.avatarId ?? 'avatar-1',
                  )}
                  alt=""
                />
              )}
              <strong>{heading}</strong>
            </div>
            <span
              className={`uno-turn-note${notice ? ' uno-turn-note--notice' : ''}${game.drawPenalty ? ' uno-turn-note--penalty' : ''}`}
            >
              {notice ||
                (game.drawPenalty
                  ? `累计补 ${game.drawPenalty.count} 张`
                  : game.direction === 1
                    ? '顺时针'
                    : '逆时针')}
            </span>
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
            {player && (
              <button
                type="button"
                className="uno-icon-button"
                aria-label="积分榜"
                onClick={() => setPanel('players')}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M3 21h18M5 21V11h4v10M10 21V4h4v17M15 21V8h4v13" />
                </svg>
              </button>
            )}
          </div>
          {player && <Seats game={game} seats={view.seats} compact />}
          {game.phase === 'playing' ? (
            <div
              className={`uno-workspace${player ? ' uno-workspace--player' : ''}`}
            >
              <Board game={game} seats={view.seats} player={player} />
              {player && game.self && (
                <div className="uno-player-workspace">
                  {(declare || catchUno) && (
                    <div className="uno-reaction uno-reaction--uno">
                      <div>
                        <strong>
                          {declare
                            ? '剩一张，补喊 UNO!'
                            : `${names[game.unoWindow?.seatId ?? '']}还没喊 UNO`}
                        </strong>
                      </div>
                      {declare && (
                        <button
                          className="uno-primary"
                          type="button"
                          disabled={locked || !active}
                          onClick={() => choose(declare)}
                        >
                          UNO!
                        </button>
                      )}
                      {catchUno && (
                        <CatchUnoControl
                          key={`${view.instanceId}:${view.branch}:${view.decisionId}:${game.unoWindow?.seatId}:${catchTiming?.serverTime}:${catchTiming?.remainingMs}`}
                          timing={catchTiming}
                          disabled={locked || !active}
                          choose={() => choose(catchUno)}
                        />
                      )}
                    </div>
                  )}
                  {(accept || challenge) && (
                    <section className="uno-reaction uno-reaction--four">
                      <h2>{names[game.drawFour?.offender ?? '']}出了 +4</h2>
                      <p>
                        接受摸 {game.drawPenalty?.count ?? 4} 张；质疑失败摸{' '}
                        {(game.drawPenalty?.count ?? 4) + 2}
                        张。对方是否持有
                        {game.drawFour
                          ? colorNames[game.drawFour.previousColor]
                          : '当前颜色'}
                        。
                      </p>
                      {actions.some((entry) => entry.type === 'play') && (
                        <p>也可从手牌出 +4 继续传递，放弃质疑上一张 +4。</p>
                      )}
                      <div className="uno-reaction-actions">
                        {accept && (
                          <button
                            className="uno-primary"
                            type="button"
                            disabled={locked || !active}
                            onClick={() => choose(accept)}
                          >
                            接受摸 {game.drawPenalty?.count ?? 4} 张
                          </button>
                        )}
                        {challenge && (
                          <button
                            type="button"
                            disabled={locked || !active}
                            onClick={() => choose(challenge)}
                          >
                            质疑 +4
                          </button>
                        )}
                      </div>
                    </section>
                  )}
                  {acceptPenalty && (
                    <section className="uno-reaction uno-reaction--penalty">
                      <strong>
                        补牌累计 {game.drawPenalty?.count ?? 2} 张
                      </strong>
                      <button
                        className="uno-primary"
                        type="button"
                        disabled={locked || !active}
                        onClick={() => choose(acceptPenalty)}
                      >
                        接受摸 {game.drawPenalty?.count ?? 2} 张
                      </button>
                    </section>
                  )}
                  {action('choose-color') && (
                    <section className="uno-reaction">
                      <h2>选一种开局颜色</h2>
                      <ColorChoice
                        locked={locked || !active}
                        choose={(color) =>
                          choose({ type: 'choose-color', color })
                        }
                      />
                    </section>
                  )}
                  <Hand
                    key={`${view.instanceId}:${game.self.seatId}:${game.roundNumber}`}
                    scope={`${view.instanceId}:${game.self.seatId}:${game.roundNumber}`}
                    boundary={`${view.branch}:${view.decisionId ?? 'waiting'}`}
                    game={game}
                    actions={actions}
                    choose={choose}
                    locked={locked || !active}
                  />
                </div>
              )}
            </div>
          ) : (
            result && (
              <section className="uno-results">
                <div className="uno-result-intro">
                  <span className="uno-result-star" aria-hidden="true">
                    ★
                  </span>
                  <div>
                    <h1>
                      {
                        names[
                          game.phase === 'ended'
                            ? game.winners[0]!
                            : result.winner
                        ]
                      }
                      获胜
                    </h1>
                    <p>
                      {game.phase === 'ended'
                        ? '率先达到 500 分，赢得整场'
                        : `本局收获 ${result.points} 分`}
                    </p>
                  </div>
                </div>
                <div className="uno-result-players">
                  {game.seatOrder.map((id) => (
                    <article
                      key={id}
                      className={`uno-result-player${id === result.winner ? ' uno-result-player--winner' : ''}`}
                    >
                      <img
                        src={avatarFor(
                          view.seats.find((seat) => seat.id === id)?.avatarId ??
                            'avatar-1',
                        )}
                        alt=""
                      />
                      <h2>{names[id]}</h2>
                      <strong>
                        {game.players[id]!.score}
                        <span>累计分</span>
                      </strong>
                      <dl>
                        <div>
                          <dt>剩牌点数</dt>
                          <dd>{result.handValues[id]}</dd>
                        </div>
                        <div>
                          <dt>本局得分</dt>
                          <dd>+{id === result.winner ? result.points : 0}</dd>
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
                  <div className="uno-result-actions">
                    {lifecycle ? (
                      <button
                        className="uno-primary"
                        type="button"
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
                        className="uno-primary"
                        type="button"
                        disabled={locked}
                        onClick={() => command({ type: 'replay' })}
                      >
                        原班人马再玩一场
                      </button>
                    )}
                  </div>
                )}
              </section>
            )
          )}
          {game.latest && (
            <div
              className="uno-latest"
              data-latest-saved-action
              aria-live="polite"
            >
              <strong>
                {game.latest.actor ? names[game.latest.actor] : 'UNO'}
              </strong>
              <span>
                {game.latest.text
                  .replace(/^座位 \d+ /, '')
                  .replace(
                    /座位 (\d+)/g,
                    (_text, number: string) =>
                      names[game.seatOrder[Number(number) - 1]!] ??
                      `座位 ${number}`,
                  )
                  .replace(
                    /下一位/g,
                    game.latest.targets[0]
                      ? (names[game.latest.targets[0]] ?? '下一位')
                      : '下一位',
                  )}
              </span>
              <span className="uno-saved-label">已保存</span>
            </div>
          )}
          {authorizedEvidence &&
            evidence &&
            announcedEvidence === evidenceKey &&
            dismissedEvidence !== evidenceKey && (
              <section
                className="uno-challenge-result"
                aria-label="仅你可见的质疑证据"
              >
                <div className="uno-challenge-result-heading">
                  <p>
                    <strong>{evidence.guilty ? '质疑成功' : '质疑失败'}</strong>{' '}
                    {names[evidence.offender]}当时
                    {evidence.guilty ? '持有' : '没有'}
                    {colorNames[evidence.previousColor]}。
                  </p>
                  <button
                    type="button"
                    className="uno-icon-button"
                    aria-label="关闭质疑证据"
                    title="关闭质疑证据"
                    onClick={() => setDismissedEvidence(evidenceKey)}
                  >
                    ×
                  </button>
                </div>
                <div
                  className="uno-evidence-cards"
                  aria-label="对方出牌前的手牌"
                >
                  {evidence.cards.map((card) => (
                    <Card key={card.id} card={card} />
                  ))}
                </div>
              </section>
            )}
          {shownSaved && (
            <SavedEffect
              key={`${view.instanceId}:${view.branch}:${game.latest?.serial}`}
              game={game}
            />
          )}
        </>
      )}
      {panel && (
        <OverlayPanel
          title={
            panel === 'rules'
              ? 'UNO 经典版图文规则'
              : panel === 'players'
                ? '积分榜'
                : 'UNO 菜单'
          }
          close={() => setPanel(null)}
          className="uno-overlay"
        >
          {panel === 'rules' ? (
            <RulesGuide
              {...unoRulebook(
                game?.setup ?? (view?.game?.setup as UnoSetup | undefined),
              )}
            />
          ) : (
            <div className="uno-panel">
              {panel === 'players' ? (
                game && view && <Leaderboard game={game} seats={view.seats} />
              ) : (
                <>
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
                  <h2>电脑玩家</h2>
                  <div className="uno-bot-guide">
                    <p>
                      <strong>默认</strong> 优先出普通牌，选择手中较多的颜色。
                    </p>
                    <p>
                      <strong>豆包</strong>{' '}
                      比较牌分和颜色衔接，也会关注下家的张数。
                    </p>
                    <p>
                      <strong>绝悟</strong>{' '}
                      结合公开出牌与各人张数安排攻击和留牌，只使用本人获授权的信息。
                    </p>
                  </div>
                  <h2>对局记录</h2>
                  {game?.results.length ? (
                    <div className="uno-history">
                      {game.results.map((entry) => (
                        <article key={entry.roundNumber}>
                          <h3>第 {entry.roundNumber} 局</h3>
                          <p>
                            {names[entry.winner]}获得 {entry.points} 分
                          </p>
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
  Screen: UnoScreen,
  SetupSettings: UnoSetupSettings,
  savedChanges(before, after) {
    const previous = before as UnoView;
    const next = after as UnoView;
    return next.latest && previous.latest?.serial !== next.latest.serial
      ? [`uno:${next.latest.serial}`]
      : [];
  },
  motionDuration(view) {
    const game = view as UnoView;
    if (game.phase !== 'playing') return 1800;
    const latest = game.latest;
    if (!latest) return 0;
    if (/declare|catch|challenge/.test(latest.verb) || /UNO/.test(latest.text))
      return 1200;
    if (latest.card && latest.card.kind !== 'number') return 1200;
    if (latest.verb === 'choose-color') return 1200;
    return latest.drawCount > 1 ? 950 : 650;
  },
};
