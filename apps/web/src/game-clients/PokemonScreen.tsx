/* eslint-disable react-refresh/only-export-components -- Lazy adapters expose one platform client object. */
import { useState } from 'react';
import type { JsonValue } from '../../../../packages/game-sdk/src';
import type { PokemonView } from '../../../../games/pokemon-encounters/rules/project';
import {
  SeatResult,
  PublicLog,
} from '../../../../games/pokemon-encounters/ui/public';
import { GameTable } from '../../../../games/pokemon-encounters/ui/table';
import { SoundControl } from '../../../../games/pokemon-encounters/ui/audio';
import {
  SavedMotion,
  savedChanges,
  SAVED_MOTION_MS,
} from '../../../../games/pokemon-encounters/ui/motion';
import type { GameClient } from './registry';
import { useAudioOutput } from '../session/useAudioOutput';
import '../../../../games/pokemon-encounters/ui/screen.css';
import '../../../../games/pokemon-encounters/ui/style.css';
import { avatarFor } from '../assets/avatars';
import { ScreenLink } from '../components/ScreenLink';
import { SessionFeedback } from '../components/SessionFeedback';
import { OverlayPanel } from '../components/OverlayPanel';
import { FullscreenControl } from '../components/FullscreenControl';
import { RoomManagement } from '../components/RoomManagement';
import { PlayModeControl } from '../components/PlayModeControl';
import { PlayModeBadge } from '../components/PlayModeBadge';
import { DisplaySettings } from '../components/DisplaySettings';
import type { RoomSession } from '../session/useRoomSession';

function PokemonScreen({ session }: { session: RoomSession }) {
  const {
    view,
    role,
    self,
    canControl,
    locked,
    command,
    connected,
    feedback,
    errorId,
    motion,
  } = session;
  const game = view?.gameView as PokemonView | null;
  const canPlay = useAudioOutput();
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
  ).map((seat) => ({
    ...seat,
    portrait: avatarFor(seat.id),
    ...(seat.botDifficulty
      ? {
          botLabel: `${{ default: '默认', doubao: '豆包', juewu: '绝悟' }[seat.botDifficulty]}人机`,
        }
      : {}),
  }));
  return (
    <SavedMotion.Provider value={view?.playMode === 'test' ? [] : motion}>
      <main
        className={`pokemon-screen game-screen ${role} ${view?.playMode !== 'test' && feedback?.events.at(-1)?.kind === 'round-result' && motion.length ? 'saved-result' : ''}`}
        data-play-mode={view?.playMode ?? 'play'}
      >
        <header className="game-toolbar">
          <ScreenLink
            className="button secondary back-to-box"
            href={`/${role}`}
          >
            ‹ 盒子
          </ScreenLink>
          <h1>{view?.game?.name ?? '朋友们的牌桌'}</h1>
          <span
            className={`connection ${connected ? 'online' : ''}`}
            role="status"
          >
            {connected ? '本地连接已就绪' : '正在连接本地服务'}
          </span>
          <FullscreenControl />
          {role !== 'player' && <DisplaySettings />}
          <PlayModeBadge mode={view?.playMode} />
          {role !== 'player' && (
            <SoundControl
              compact
              disabled={view?.playMode === 'test'}
              feedback={feedback}
              errorId={errorId}
              game={game}
              canPlay={canPlay}
            />
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
                ? role === 'player'
                  ? '回到盒子加入并准备，开局后会自动进入。'
                  : '朋友们用手机扫码入座并准备，由房主开始游戏。'
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
                {canControl && view.status === 'playing' && (
                  <button
                    disabled={locked}
                    onClick={() => command({ type: 'resume' })}
                  >
                    恢复游戏
                  </button>
                )}
                {canControl && view.status === 'ended' && (
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
              playMode={view.playMode}
              feedback={feedback}
              selectionKey={`${view.instanceId}:${view.branch}:${view.selectionToken ?? 'none'}`}
              motionKey={`${view.instanceId}:${view.branch}:${feedback?.revision ?? 'sync'}`}
              choose={choose}
              showFriends={() => setPanel('friends')}
              {...(canControl && view.status === 'ended'
                ? { playAgain: () => command({ type: 'replay' }) }
                : {})}
              {...(canControl && !view.paused && view.lifecycleActions.length
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
              <div className={`pokemon-screen pokemon-panel ${role}`}>
                {view?.seats
                  .filter((seat) => seat.id !== self?.id)
                  .map((seat) => (
                    <section key={seat.id} className="friend-board">
                      <h3>{seat.name}</h3>
                      {game && <SeatResult view={game} seatId={seat.id} />}
                    </section>
                  ))}
              </div>
            ) : (
              <>
                {canControl && <RoomManagement session={session} />}

                {game && (
                  <div className={`pokemon-screen pokemon-panel ${role}`}>
                    <PublicLog view={game} names={names} />
                  </div>
                )}
              </>
            )}
          </OverlayPanel>
        )}
        <PlayModeControl session={session} />
      </main>
    </SavedMotion.Provider>
  );
}

export const client: GameClient = {
  Screen: PokemonScreen,
  savedChanges: (before, after) =>
    savedChanges(before as PokemonView, after as PokemonView),
  motionDuration: SAVED_MOTION_MS,
};
