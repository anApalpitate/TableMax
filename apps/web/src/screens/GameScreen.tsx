import { useState } from 'react';
import type { JsonValue } from '../../../../packages/game-sdk/src';
import type { PokemonView } from '../../../../games/pokemon-encounters/rules/project';
import {
  SeatResult,
  PublicLog,
  GameHelp,
} from '../../../../games/pokemon-encounters/ui/public';
import { GameTable } from '../../../../games/pokemon-encounters/ui/table';
import { SoundControl } from '../../../../games/pokemon-encounters/ui/audio';
import { avatarFor } from '../assets/avatars';
import { ScreenLink } from '../components/ScreenLink';
import { SessionFeedback } from '../components/SessionFeedback';
import { OverlayPanel } from '../components/OverlayPanel';
import { FullscreenControl } from '../components/FullscreenControl';
import { RoomManagement } from '../components/RoomManagement';
import type { RoomSession } from '../session/useRoomSession';

export function GameScreen({ session }: { session: RoomSession }) {
  const {
    view,
    role,
    self,
    isHost,
    locked,
    command,
    connected,
    feedback,
    errorId,
    motion,
  } = session;
  const game = view?.gameView as PokemonView | null;
  const [panel, setPanel] = useState<'menu' | 'friends' | null>(null);
  const names = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, seat.name]) ?? [],
  );
  const choose = (action: JsonValue) => {
    if (view?.decisionId)
      command({ type: 'game', decisionId: view.decisionId, action });
  };
  const actions = (view?.actions ?? []) as readonly JsonValue[];
  const seats = (
    view?.seats.filter((seat) => role !== 'player' || seat.id === self?.id) ??
    []
  ).map((seat) => ({ ...seat, portrait: avatarFor(seat.id) }));
  return (
    <main
      className={`game-screen ${role} ${feedback?.events.at(-1)?.kind === 'round-result' && motion.length ? 'saved-result' : ''}`}
    >
      <header className="game-toolbar">
        <ScreenLink className="button secondary back-to-box" href={`/${role}`}>
          ‹ 盒子
        </ScreenLink>
        <h1>{view?.game.name ?? '朋友们的牌桌'}</h1>
        <span
          className={`connection ${connected ? 'online' : ''}`}
          role="status"
        >
          {connected ? '本地连接已就绪' : '正在连接本地服务'}
        </span>
        <FullscreenControl />
        {role !== 'player' && (
          <SoundControl compact feedback={feedback} errorId={errorId} />
        )}
        <button className="secondary" onClick={() => setPanel('menu')}>
          菜单
        </button>
      </header>
      <SessionFeedback session={session} />
      {!game || !view ? (
        <div className="table-unavailable">
          <h2>{connected ? '牌桌还没有开始' : '等待重新连接'}</h2>
          <p>
            {connected
              ? '回到盒子加入并准备，开局后会自动进入。'
              : '重新连接后恢复本人授权的最新牌桌。'}
          </p>
          <ScreenLink className="button" href={`/${role}`}>
            回到盒子
          </ScreenLink>
        </div>
      ) : (
        <>
          {(view.paused ||
            view.botError ||
            (view.status === 'ended' && !game.matchWinners.length)) && (
            <div className="table-notice" role="status">
              <span>
                {view.botError ||
                  (view.status === 'ended'
                    ? view.endReason || '对局已结束'
                    : view.restored
                      ? '已读取存档，等待房主恢复'
                      : '游戏已暂停')}
              </span>
              {isHost && view.status === 'playing' && (
                <button
                  disabled={locked}
                  onClick={() => command({ type: 'resume' })}
                >
                  恢复游戏
                </button>
              )}
              {isHost && view.status === 'ended' && (
                <button
                  disabled={locked}
                  onClick={() => command({ type: 'replay' })}
                >
                  再玩一局
                </button>
              )}
            </div>
          )}
          <GameTable
            game={game}
            seats={seats}
            selfId={self?.id ?? null}
            names={names}
            player={role === 'player'}
            actions={actions}
            locked={locked}
            paused={view.paused}
            playing={view.status === 'playing'}
            selectionKey={`${view.instanceId}:${view.branch}:${view.revision}`}
            choose={choose}
            showFriends={() => setPanel('friends')}
            {...(isHost && view.status === 'ended'
              ? { playAgain: () => command({ type: 'replay' }) }
              : {})}
            {...(isHost && !view.paused && view.lifecycleActions.length
              ? {
                  nextRound: () =>
                    command({
                      type: 'lifecycle',
                      action: view.lifecycleActions[0] as {
                        type: 'next-round';
                      },
                    }),
                }
              : {})}
          />
        </>
      )}
      {panel && (
        <OverlayPanel
          title={panel === 'menu' ? '牌桌菜单' : '朋友的牌桌'}
          close={() => setPanel(null)}
        >
          {panel === 'friends' ? (
            view?.seats
              .filter((seat) => seat.id !== self?.id)
              .map((seat) => (
                <section key={seat.id} className="friend-board">
                  <h3>{seat.name}</h3>
                  {game && <SeatResult view={game} seatId={seat.id} />}
                </section>
              ))
          ) : (
            <>
              {isHost && (
                <>
                  <h3>房主管理</h3>
                  <RoomManagement session={session} />
                  <details>
                    <summary>换手机</summary>
                    {view?.seats
                      .filter((seat) => seat.controller === 'human')
                      .map((seat) => (
                        <button
                          className="secondary"
                          key={seat.id}
                          disabled={locked}
                          onClick={() => {
                            if (
                              confirm(
                                `为 ${seat.name} 换手机？原身份会立即失效，座位和游戏数据保留。`,
                              )
                            )
                              command({ type: 'rebind', seatId: seat.id });
                          }}
                        >
                          {seat.name} · 换手机
                        </button>
                      ))}
                  </details>
                </>
              )}

              {game && <PublicLog view={game} />}
              <details>
                <summary>游戏帮助</summary>
                <GameHelp />
              </details>
            </>
          )}
        </OverlayPanel>
      )}
    </main>
  );
}
