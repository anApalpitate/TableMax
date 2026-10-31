/* eslint-disable react-refresh/only-export-components -- Lazy game-client exports. */
import { useEffect, useId, useState, type CSSProperties } from 'react';
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
  avatarFor,
  useAudioOutput,
  useViewportSnapshot,
  type GameClient,
  type GameHost,
} from '@tablemax/web-host';
import type { Action, AvalonView } from '../types';
import {
  BallotResult,
  Council,
  FinalResult,
  QuestTrack,
  RejectionTrack,
} from '../ui/Board';
import { RoleCard, PrivateKnowledge } from '../ui/RoleCard';
import { PlayerControls } from '../ui/PlayerControls';
import { AvalonEffects } from '../ui/Effects';
import { AvalonSoundControl } from '../ui/audio';
import { avalonRulebookFor } from '../ui/RulesGuide';
import '../ui/style.css';
import '../ui/layout.css';

function SavedAction({
  game,
  names,
}: {
  game: AvalonView;
  names: Record<string, string>;
}) {
  if (!game.latest) return null;
  const text = game.latest.text.replace(
    /座位\s?(\d+)/g,
    (_match, number: string) =>
      names[game.seatOrder[Number(number) - 1] ?? ''] ?? `座位 ${number}`,
  );
  const actor = game.latest.actor ? names[game.latest.actor] : null;
  return (
    <div
      className="av-saved-action"
      data-latest-saved-action
      aria-live="polite"
    >
      <span className="av-saved-seal" aria-hidden="true">
        ✓
      </span>
      <div>
        {actor && <strong>{actor}</strong>}
        <span>
          {actor && text.startsWith(actor)
            ? text.slice(actor.length).trim()
            : text}
        </span>
      </div>
      <span className="av-saved-label">已保存</span>
    </div>
  );
}

function Table({
  session,
  game,
  names,
  showIdentity,
}: {
  session: GameHost;
  game: AvalonView;
  names: Record<string, string>;
  showIdentity(): void;
}) {
  const view = session.view!;
  const player = session.role === 'player';
  const actions = view.actions as Action[];
  const [selected, setSelected] = useState<string[]>([]);
  const nomination = actions.some((entry) => entry.type === 'propose-team');
  const stabbing = actions.some((entry) => entry.type === 'assassinate');
  const active =
    session.connected &&
    !session.locked &&
    view.status === 'playing' &&
    !view.paused &&
    !view.botError;
  const selectable =
    !active || !player
      ? []
      : nomination
        ? game.seatOrder
        : stabbing
          ? actions.flatMap((entry) =>
              entry.type === 'assassinate' ? [entry.target] : [],
            )
          : [];
  const toggle = (id: string) => {
    if (!selectable.includes(id)) return;
    setSelected((previous) =>
      stabbing
        ? previous[0] === id
          ? []
          : [id]
        : previous.includes(id)
          ? previous.filter((member) => member !== id)
          : [...previous, id],
    );
  };
  const choose = (action: Action) => {
    if (view.decisionId && active)
      session.command({
        type: 'game',
        decisionId: view.decisionId,
        action: action as unknown as JsonValue,
      });
  };
  return (
    <div className={`av-workspace${player ? ' av-workspace--player' : ''}`}>
      {game.phase === 'ended' ? (
        <FinalResult game={game} names={names} />
      ) : (
        <Council
          game={game}
          seats={view.seats}
          selected={nomination || stabbing ? selected : game.team}
          selectable={selectable}
          toggle={toggle}
          compact={player}
        />
      )}
      {player && game.self && (
        <PlayerControls
          game={game}
          actions={actions}
          selected={selected}
          locked={!active}
          names={names}
          choose={choose}
          showIdentity={showIdentity}
        />
      )}
    </div>
  );
}

function AvalonScreen({ session }: { session: GameHost }) {
  const viewportId = useId();
  const viewport = useViewportSnapshot(
    `[data-av-viewport="${viewportId}"]`,
    '--av-safe-',
  );
  const { role, view, connected, locked, canControl, command } = session;
  const game = view?.gameView as AvalonView | null;
  const player = role === 'player';
  const [panel, setPanel] = useState<
    'menu' | 'rules' | 'history' | 'identity' | null
  >(null);
  const canPlay = useAudioOutput();
  const names = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, seat.name]) ?? [],
  );
  const feedback =
    session.feedback?.instanceId === view?.instanceId &&
    session.feedback?.branch === view?.branch &&
    session.feedback?.revision === view?.revision
      ? session.feedback
      : null;
  const disabled =
    !connected ||
    Boolean(view?.paused || view?.botError) ||
    view?.playMode === 'test';
  useEffect(() => {
    const hide = () =>
      setPanel((current) => (current === 'identity' ? null : current));
    window.addEventListener('blur', hide);
    const visibility = () => {
      if (document.hidden) hide();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const notice = !connected
    ? '正在重新连接'
    : view?.botError
      ? view.botError
      : view?.paused
        ? view.restored
          ? '存档已恢复，等待房主继续'
          : '游戏已暂停'
        : '';
  const heading =
    game?.phase === 'reveal'
      ? '圆桌宣誓'
      : game?.phase === 'team'
        ? `${names[game.leader] ?? '队长'} 正在组队`
        : game?.phase === 'discussion'
          ? `${names[game.discussion?.current ?? ''] ?? '当前玩家'} 正在发言`
          : game?.phase === 'vote'
            ? '议会秘密表决'
            : game?.phase === 'quest'
              ? '远征任务进行中'
              : game?.phase === 'assassinate'
                ? '最后刺杀'
                : '圆桌传奇落幕';
  const expected =
    game?.phase === 'quest'
      ? game.team.length
      : game?.phase === 'vote' || game?.phase === 'reveal'
        ? game.seatOrder.length
        : 0;
  const latestProposal = game?.history.at(-1);
  const revealBallots =
    latestProposal &&
    (game?.phase === 'quest' ||
      /^team-(approved|rejected)$/.test(game?.latest?.verb ?? ''));
  const acknowledge = (view?.actions as Action[] | undefined)?.find(
    (action) => action.type === 'acknowledge',
  );
  const identityScope = `${view?.instanceId}:${view?.branch}:${game?.self?.seatId}`;
  const discussion = game?.phase === 'discussion' ? game.discussion : null;
  const discussionDone =
    discussion?.order.filter(
      (id) =>
        discussion.completed.includes(id) || discussion.skipped.includes(id),
    ).length ?? 0;
  const nextSpeaker = discussion?.current
    ? discussion.order
        .slice(discussion.order.indexOf(discussion.current) + 1)
        .find(
          (id) =>
            !discussion.completed.includes(id) &&
            !discussion.skipped.includes(id),
        )
    : undefined;
  return (
    <main
      className={`avalon-screen av-screen--${role}`}
      data-av-viewport={viewportId}
      data-av-layout={
        player ? (viewport.available.width >= 960 ? 'L' : 'P') : 'H'
      }
      style={
        {
          '--av-viewport-height': `${viewport.viewport.height}px`,
        } as CSSProperties
      }
      data-phase={game?.phase}
      data-play-mode={view?.playMode ?? 'play'}
      data-av-saved={session.motion.length > 0 && !disabled}
    >
      <header className="av-toolbar">
        <ScreenLink href={`/${role}`} className="av-box-link">
          ‹ 盒子
        </ScreenLink>
        <strong className="av-brand">阿瓦隆</strong>
        <span className="av-edition">
          {(game?.variant ?? view?.game?.variantId ?? 'configured') ===
          'configured'
            ? '经典配置'
            : (game?.variant ?? view?.game?.variantId) === 'court'
              ? '旧局：宫廷迷局'
              : '旧局：经典圆桌'}
        </span>
        <div className="av-toolbar-tools">
          <PlayModeBadge mode={view?.playMode} />
          <AvalonSoundControl
            feedback={feedback}
            game={game}
            disabled={disabled}
            canPlay={canPlay}
            player={player}
          />
          {player && game?.self && game.phase !== 'ended' && (
            <button
              type="button"
              className="av-identity-entry"
              onClick={() => setPanel('identity')}
              aria-label="查看我的秘密身份"
              title="查看我的秘密身份"
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <rect x="5" y="3" width="14" height="18" rx="3" />
                <path d="M8 10q4-5 8 0l-4 5-4-5Z" />
                <path d="M9 18h6" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="game-rulebook-entry av-toolbar-icon"
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
              <path d="m12 5-3-2H3v16h6l3 2 3-2h6V3h-6Zm0 0v16M6 8h3M6 12h3m6-4h3m-3 4h3" />
            </svg>
          </button>
          <button
            type="button"
            className="av-toolbar-icon av-menu-entry"
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
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path
                transform="translate(0.5 0)"
                d="M8 6h13M8 12h13M8 18h13M3 5l1 1-1 1-1-1Zm0 6 1 1-1 1-1-1Zm0 6 1 1-1 1-1-1Z"
              />
            </svg>
          </button>
        </div>
      </header>
      <SessionFeedback session={session} mode="messages" />
      {!game || !view ? (
        <div className="av-unavailable">
          <h1>等待圆桌议会开局</h1>
          <ScreenLink href={`/${role}`}>回到盒子</ScreenLink>
        </div>
      ) : (
        <>
          <div className="av-status-bar">
            <div>
              <strong
                className={
                  game.phase === 'discussion'
                    ? 'av-speaking-heading'
                    : undefined
                }
              >
                {game.phase === 'discussion' ? (
                  <>
                    <span className="av-speaking-name">
                      {names[game.discussion?.current ?? ''] ?? '当前玩家'}
                    </span>
                    <span className="av-speaking-action">正在发言</span>
                  </>
                ) : (
                  heading
                )}
              </strong>
              {game.phase === 'assassinate' && game.assassin && (
                <span
                  className="av-public-assassin"
                  data-av-public-assassin={game.assassin}
                >
                  <img
                    src={avatarFor(
                      view.seats.find((seat) => seat.id === game.assassin)
                        ?.avatarId ?? 'builtin-1',
                    )}
                    alt=""
                  />
                  <span>{names[game.assassin]}</span>
                </span>
              )}
              {expected > 0 && (
                <span>
                  {game.submittedSeats.length} / {expected} 已提交
                </span>
              )}
            </div>
            <div className="av-status-tools">
              <DecisionCountdown view={view} connected={connected} compact />
              {notice && <strong className="av-notice">{notice}</strong>}
              {canControl && view.paused && (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => command({ type: 'resume' })}
                >
                  恢复
                </button>
              )}
            </div>
          </div>
          {game.phase === 'discussion' && (
            <section className="av-discussion" aria-label="发言进度">
              <div className="av-discussion-summary">
                <div className="av-discussion-progress">
                  <span>发言进度</span>
                  <strong
                    aria-label={`已结束 ${discussionDone} 人，其中跳过 ${discussion?.skipped.length ?? 0} 人，共 ${discussion?.order.length ?? 0} 人`}
                  >
                    {discussionDone} / {discussion?.order.length ?? 0}
                  </strong>
                </div>
                <div className="av-discussion-next">
                  {nextSpeaker ? (
                    <>
                      <span>下一位</span>
                      <strong>{names[nextSpeaker]}</strong>
                    </>
                  ) : (
                    <span>本轮最后发言</span>
                  )}
                </div>
              </div>
              {role === 'host' &&
                view.lifecycleActions.map((raw, i) => {
                  const action = raw as Action;
                  return action.type === 'skip-discussion' ? (
                    <button
                      key={i}
                      type="button"
                      disabled={!connected || locked || view.paused}
                      aria-label={`跳过当前发言：${names[action.target]}`}
                      onClick={() =>
                        command({ type: 'lifecycle', action: raw as JsonValue })
                      }
                    >
                      跳过当前发言
                    </button>
                  ) : null;
                })}
            </section>
          )}
          <div className="av-campaign">
            <QuestTrack game={game} />
            <div className="av-campaign-side">
              <div className="av-score">
                <span>
                  <b>{game.successCount}</b> 成功
                </span>
                <span>
                  <b>{game.failCount}</b> 失败
                </span>
              </div>
              <RejectionTrack count={game.rejectedTeams} />
            </div>
          </div>
          <Table
            key={`${view.instanceId}:${view.branch}:${game.proposalNumber}:${game.phase}`}
            session={session}
            game={game}
            names={names}
            showIdentity={() => setPanel('identity')}
          />
          {revealBallots && (
            <div className="av-recent-ballot">
              <span>{latestProposal.approved ? '队伍通过' : '队伍否决'}</span>
              <div>
                {Object.entries(latestProposal.votes).map(([id, vote]) => (
                  <span
                    className={`av-vote-inline av-vote-inline--${vote}`}
                    key={id}
                  >
                    {vote === 'approve' ? '✓' : '×'} {names[id]}
                  </span>
                ))}
              </div>
            </div>
          )}
          <SavedAction game={game} names={names} />
          {canControl && game.phase === 'ended' && (
            <button
              type="button"
              className="av-replay av-primary"
              disabled={locked}
              onClick={() => command({ type: 'replay' })}
            >
              原班人马再玩一局
            </button>
          )}
          {!player && game.phase !== 'ended' && (
            <div className="av-public-footer">
              <button type="button" onClick={() => setPanel('history')}>
                议会记录
              </button>
            </div>
          )}
        </>
      )}
      {panel && (
        <OverlayPanel
          key={panel === 'identity' ? identityScope : panel}
          title={
            panel === 'rules'
              ? '阿瓦隆 图文规则'
              : panel === 'history'
                ? '圆桌议会记录'
                : panel === 'identity'
                  ? '仅你可见的秘密身份'
                  : '阿瓦隆菜单'
          }
          close={() => setPanel(null)}
          className={`av-overlay${panel === 'identity' ? ' av-overlay--secret' : ''}`}
        >
          {panel === 'rules' ? (
            <RulesGuide {...avalonRulebookFor(game)} />
          ) : (
            <div className="av-panel">
              {panel === 'identity' ? (
                player &&
                game?.self &&
                game.phase !== 'ended' && (
                  <div className="av-identity-detail" data-av-secret="true">
                    <RoleCard role={game.self.role} />
                    <PrivateKnowledge self={game.self} names={names} />
                    {acknowledge && (
                      <button
                        type="button"
                        className="av-primary"
                        data-av-action="acknowledge"
                        disabled={locked || !connected || Boolean(view?.paused)}
                        onClick={() => {
                          if (view?.decisionId)
                            command({
                              type: 'game',
                              decisionId: view.decisionId,
                              action: acknowledge as unknown as JsonValue,
                            });
                          setPanel(null);
                        }}
                      >
                        确认身份并入席
                      </button>
                    )}
                  </div>
                )
              ) : panel === 'history' ? (
                <div className="av-history">
                  {game?.history.length ? (
                    game.history
                      .slice()
                      .reverse()
                      .map((proposal) => (
                        <BallotResult
                          key={proposal.proposalNumber}
                          proposal={proposal}
                          names={names}
                        />
                      ))
                  ) : (
                    <p>圆桌尚未完成第一次表决。</p>
                  )}
                  {game?.quests.map((quest) => (
                    <article
                      className="av-history-quest"
                      key={quest.questNumber}
                    >
                      <h3>
                        第 {quest.questNumber} 次任务：
                        {quest.succeeded ? '成功' : '失败'}
                      </h3>
                      <p>
                        队伍：{quest.team.map((id) => names[id]).join('、')}
                      </p>
                      <p className="av-semantic-groups">
                        <span>失败牌 {quest.failCount} 张</span>
                        <span>每张牌的提交者保密</span>
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <>
                  {player && game?.self && game.phase !== 'ended' && (
                    <button type="button" onClick={() => setPanel('identity')}>
                      查看我的秘密身份
                    </button>
                  )}

                  <div className="dialog-actions game-menu-settings">
                    <CountdownSettings session={session} />
                    <DisplaySettings role={role} />
                  </div>
                  {canControl && <RoomManagement session={session} />}
                  <button
                    type="button"
                    className="av-history-entry"
                    onClick={() => setPanel('history')}
                  >
                    查看议会与任务记录
                  </button>
                  <h3>电脑玩家</h3>
                  <p>
                    <strong>默认</strong>
                    按本人知识与公开结果选择队伍、表决和任务牌。
                  </p>
                  <p>
                    <strong>豆包</strong>结合否决与任务记录更新可疑程度。
                  </p>
                  <p>
                    <strong>绝悟</strong>
                    比较与公开失败数量一致的阵营组合，兼顾隐匿与刺杀判断。所有等级均只使用本人授权信息。
                  </p>
                </>
              )}
            </div>
          )}
        </OverlayPanel>
      )}
      <AvalonEffects feedback={feedback} game={game} disabled={disabled} />
      <PlayModeControl session={session} />
    </main>
  );
}

export const client: GameClient = {
  Screen: AvalonScreen,
  savedChanges(before, after) {
    const previous = before as AvalonView;
    const next = after as AvalonView;
    return next.latest && previous.latest?.serial !== next.latest.serial
      ? [`avalon:${next.latest.serial}`]
      : [];
  },
  motionDuration(view) {
    const game = view as AvalonView;
    return game.latest?.verb === 'assassination'
      ? 2600
      : /team-|quest-(success|fail)|game-ended/.test(game.latest?.verb ?? '') ||
          game.phase === 'ended'
        ? 1900
        : 500;
  },
};
export const clientsByVariant = {
  configured: client,
  classic: client,
  court: client,
};
