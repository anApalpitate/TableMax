/* eslint-disable react-refresh/only-export-components -- The lazy game module exports its platform client. */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
import type { Action, UnoView } from '../types';
import { Board, Seats } from '../ui/Board';
import { Card } from '../ui/Card';
import { ColorChoice, Hand, colorNames } from '../ui/Hand';
import { UnoSoundControl } from '../ui/audio';
import { unoRulebook } from '../ui/RulesGuide';
import '../ui/style.css';

function SavedEffect({ game }: { game: UnoView }) {
  const layer = useRef<HTMLDivElement>(null);
  const latest = game.latest;
  useLayoutEffect(() => {
    const element = layer.current;
    if (!element || !latest) return;
    const seat = (id: string | null) =>
      id
        ? document.querySelector<HTMLElement>(
            `.uno-seat[data-seat-id="${CSS.escape(id)}"]`,
          )
        : null;
    const discard = document.querySelector<HTMLElement>(
      '.uno-discard-pile > .uno-card',
    );
    const deck = document.querySelector<HTMLElement>(
      '.uno-draw-pile > .uno-card',
    );
    const hand = document.querySelector<HTMLElement>('.uno-hand-scroll');
    const point = (node: HTMLElement | null, fallback: HTMLElement) => {
      const rect = (node ?? fallback).getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
      };
    };
    if (discard) {
      const land = point(discard, element);
      element.style.setProperty('--land-x', `${land.x}px`);
      element.style.setProperty('--land-y', `${land.y}px`);
    }
    for (const flight of element.querySelectorAll<HTMLElement>('.uno-flight')) {
      const draw = flight.dataset.flight === 'draw';
      const owner = draw ? (latest.targets[0] ?? latest.actor) : latest.actor;
      const actor = owner === game.self?.seatId && hand ? hand : seat(owner);
      const from = point(draw ? deck : actor, element);
      const to = point(draw ? actor : discard, element);
      flight.style.setProperty('--from-x', `${from.x}px`);
      flight.style.setProperty('--from-y', `${from.y}px`);
      flight.style.setProperty('--to-x', `${to.x}px`);
      flight.style.setProperty('--to-y', `${to.y}px`);
      flight.style.setProperty(
        '--uno-card-width',
        `${draw ? 76 : Math.min(190, to.width)}px`,
      );
    }
    const highlighted = latest.targets
      .map((id) => seat(id))
      .filter((node): node is HTMLElement => Boolean(node));
    for (const target of highlighted) target.dataset.feedbackTarget = 'true';
    return () => {
      for (const target of highlighted)
        target.removeAttribute('data-feedback-target');
    };
  }, [latest, game.self?.seatId]);
  if (!latest) return null;
  const kind =
    game.phase !== 'playing'
      ? 'win'
      : /catch|challenge/.test(latest.verb)
        ? 'challenge'
        : /declare/.test(latest.verb) || /UNO/.test(latest.text)
          ? 'uno'
          : (latest.card?.kind ??
            (latest.verb === 'choose-color' ? 'wild' : latest.verb));
  const symbol =
    kind === 'win'
      ? '★'
      : kind === 'reverse'
        ? '↔'
        : kind === 'skip'
          ? '⊘'
          : kind === 'draw-two'
            ? '+2'
            : kind === 'wild-draw-four'
              ? '+4'
              : kind === 'uno'
                ? 'UNO!'
                : kind === 'challenge'
                  ? '!'
                  : '';
  return (
    <div
      ref={layer}
      className={`uno-saved-effect uno-saved-effect--${kind}`}
      aria-hidden="true"
    >
      <div className="uno-effect-ring" />
      {latest.card && (
        <div className="uno-flight uno-flying-card" data-flight="play">
          <Card card={latest.card} />
        </div>
      )}
      {Array.from({ length: Math.min(4, latest.drawCount) }, (_, index) => (
        <div
          className="uno-flight uno-drawing-card"
          data-flight="draw"
          key={index}
          style={{ '--flight-delay': `${index * 70}ms` } as CSSProperties}
        >
          <Card back />
        </div>
      ))}
      {symbol && <span className="uno-effect-symbol">{symbol}</span>}
      {['win', 'uno', 'wild', 'wild-draw-four'].includes(kind) && (
        <div className="uno-confetti">
          {Array.from({ length: 18 }, (_, index) => (
            <i
              key={index}
              style={
                {
                  '--piece': index,
                  '--piece-drop': `${(index % 4) * 30}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UnoScreen({ session }: { session: GameHost }) {
  const { role, view, connected, locked, canControl, command } = session;
  const game = view?.gameView as UnoView | null;
  const [panel, setPanel] = useState<
    'menu' | 'rules' | 'players' | 'evidence' | null
  >(null);
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
  const accept = action('accept-draw-four');
  const challenge = action('challenge-draw-four');
  const evidence = game?.self?.challengeEvidence;
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
  const heading =
    game?.phase === 'ended'
      ? '整场结束'
      : game?.phase === 'round-result'
        ? '本局结束'
        : game?.stage === 'draw-four'
          ? `${names[game.drawFour?.target ?? ''] ?? '下一位'}回应 +4`
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
            className="game-rulebook-entry"
            type="button"
            onClick={() => setPanel('rules')}
          >
            规则
          </button>
          <button type="button" onClick={() => setPanel('menu')}>
            菜单
          </button>
          {!player && <FullscreenControl />}
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
              className={`uno-turn-note${notice ? ' uno-turn-note--notice' : ''}`}
            >
              {notice || (game.direction === 1 ? '顺时针' : '逆时针')}
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
              <button type="button" onClick={() => setPanel('players')}>
                玩家
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
                      <button
                        className="uno-primary"
                        type="button"
                        disabled={locked || !active}
                        onClick={() => choose((declare ?? catchUno)!)}
                      >
                        {declare ? '喊 UNO!' : '抓漏喊'}
                      </button>
                    </div>
                  )}
                  {(accept || challenge) && (
                    <section className="uno-reaction uno-reaction--four">
                      <h2>{names[game.drawFour?.offender ?? '']}出了 +4</h2>
                      <p>
                        接受摸 4 张；质疑失败摸 6
                        张。质疑会核验对方出牌时是否持有
                        {game.drawFour
                          ? colorNames[game.drawFour.previousColor]
                          : '当前颜色'}
                        。
                      </p>
                      <div className="uno-reaction-actions">
                        {accept && (
                          <button
                            className="uno-primary"
                            type="button"
                            disabled={locked || !active}
                            onClick={() => choose(accept)}
                          >
                            接受，摸 4 张
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
                  {evidence && (
                    <button
                      type="button"
                      className="uno-evidence-entry"
                      onClick={() => setPanel('evidence')}
                    >
                      查看你的质疑证据
                    </button>
                  )}
                  <Hand
                    key={`${view.instanceId}:${view.branch}:${view.decisionId ?? 'waiting'}`}
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
                ? '围桌玩家'
                : panel === 'evidence'
                  ? '仅你可见的质疑证据'
                  : 'UNO 菜单'
          }
          close={() => setPanel(null)}
          className="uno-overlay"
        >
          {panel === 'rules' ? (
            <RulesGuide {...unoRulebook} />
          ) : (
            <div className="uno-panel">
              {panel === 'players' ? (
                game && view && <Seats game={game} seats={view.seats} compact />
              ) : panel === 'evidence' ? (
                evidence && (
                  <>
                    <h2>{names[evidence.offender]}的出牌前手牌</h2>
                    <p>
                      当时应跟{colorNames[evidence.previousColor]}。
                      {evidence.guilty
                        ? '持有当前颜色，+4 不合法。'
                        : '没有当前颜色，+4 合法。'}
                    </p>
                    <div className="uno-evidence-cards">
                      {evidence.cards.map((card) => (
                        <Card key={card.id} card={card} />
                      ))}
                    </div>
                  </>
                )
              ) : (
                <>
                  {player && <FullscreenControl />}
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
