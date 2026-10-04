/* eslint-disable react-refresh/only-export-components -- Lazy adapters expose one platform client object. */
import { useState } from 'react';
import type { JsonValue } from '../../../../packages/game-sdk/src';
import type {
  Action,
  ModernArtView,
} from '../../../../games/modern-art/ui/view';
import {
  AuctionStage,
  MarketBoard,
  MarketHistory,
  Museums,
  PublicLog,
  RoundResult,
  SavedAction,
} from '../../../../games/modern-art/ui/public';
import { PlayerControls } from '../../../../games/modern-art/ui/player';
import '../../../../games/modern-art/ui/style.css';
import '../../../../games/modern-art/ui/public/avatars.css';
import type { GameClient } from './registry';
import type { RoomSession } from '../session/useRoomSession';
import { ScreenLink } from '../components/ScreenLink';
import { SessionFeedback } from '../components/SessionFeedback';
import { OverlayPanel } from '../components/OverlayPanel';
import { RoomManagement } from '../components/RoomManagement';
import { FullscreenControl } from '../components/FullscreenControl';
import { DisplaySettings } from '../components/DisplaySettings';
import { PlayModeBadge } from '../components/PlayModeBadge';
import { PlayModeControl } from '../components/PlayModeControl';
import { avatarFor } from '../assets/avatars';
import { PaintingSortControl } from '../../../../games/modern-art/ui/painting-display';
import type { PaintingSort } from '../../../../games/modern-art/ui/sorting';
import { DecisionCountdown } from '../components/DecisionCountdown';
import { ModernArtSoundControl } from '../../../../games/modern-art/ui/audio';
import { useAudioOutput } from '../session/useAudioOutput';

function ModernArtScreen({ session }: { session: RoomSession }) {
  const { role, view, connected, command, locked, canControl, motion } =
    session;
  const game = view?.gameView as ModernArtView | null;
  const canPlay = useAudioOutput();
  const [panel, setPanel] = useState<'menu' | 'museums' | 'market' | null>(
    null,
  );
  const [collectionSort, setCollectionSort] = useState<PaintingSort>('artist');
  const names = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, seat.name]) ?? [],
  );
  const portraits = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, avatarFor(seat.avatarId)]) ?? [],
  );
  const nextRound = view?.lifecycleActions.find(
    (action) => (action as Action).type === 'next-round',
  ) as Action | undefined;
  const choose = (action: Action) => {
    if (view?.decisionId)
      command({
        type: 'game',
        decisionId: view.decisionId,
        action: action as JsonValue,
      });
  };
  const saved = view?.playMode !== 'test' && motion.length > 0;
  const ended = view?.status === 'ended' && game?.phase === 'ended';
  const activityMessage = !connected
    ? '正在重新连接'
    : view?.status === 'ended'
      ? '游戏已结束'
      : view?.paused
        ? '游戏已暂停'
        : view?.botError
          ? '等待恢复游戏'
          : undefined;
  const showSessionFeedback = !(
    ended &&
    connected &&
    session.message === '已保存' &&
    !session.admissionPending &&
    !session.awaitingConfirmation
  );
  const emptyFinalMuseums =
    ended &&
    game.seatOrder.every((seat) => game.players[seat]?.collection.length === 0);
  const featuredAuction =
    role !== 'player' &&
    connected &&
    view?.status === 'playing' &&
    !view.paused &&
    !view.botError &&
    game &&
    (game.phase === 'auction' || game.phase === 'double') &&
    game.auction !== null &&
    game.auction.cards.length > 0 &&
    game.seatOrder.every((seat) => game.players[seat]?.collection.length === 0);
  const mergedPausedOffer =
    role === 'player' && view?.paused === true && game?.phase === 'offer';
  const notice =
    view &&
    game &&
    (view.paused ||
      view.botError ||
      (view.status === 'ended' && game.phase !== 'ended')) ? (
      <div
        className={`ma-notice ${mergedPausedOffer ? 'ma-notice--with-clock' : ''}`}
        role="status"
      >
        <span
          title={activityMessage}
          className={
            mergedPausedOffer && (view.restored || view.botError)
              ? 'ma-notice__explanation'
              : undefined
          }
        >
          {view.botError ||
            (view.status === 'ended'
              ? view.endReason || '对局已结束'
              : view.restored
                ? '存档已恢复，等待房主继续'
                : mergedPausedOffer
                  ? '已暂停'
                  : '游戏已暂停')}
        </span>
        {mergedPausedOffer && (
          <DecisionCountdown view={view} connected={connected} compact />
        )}
        {canControl && view.status === 'playing' && (
          <button disabled={locked} onClick={() => command({ type: 'resume' })}>
            恢复游戏
          </button>
        )}
        {canControl && view.status === 'ended' && (
          <button disabled={locked} onClick={() => command({ type: 'replay' })}>
            再玩一局
          </button>
        )}
      </div>
    ) : null;
  return (
    <main
      className={`ma-screen ${role} ${saved ? 'ma-saved' : ''}`}
      data-play-mode={view?.playMode ?? 'play'}
    >
      <header className="ma-toolbar">
        <ScreenLink className="button secondary" href={`/${role}`}>
          ‹ 盒子
        </ScreenLink>
        <div className="ma-brand">
          <strong>MODERN ART</strong>
          <span>现代艺术</span>
        </div>
        <span className="ma-round">第 {game?.round ?? 1} / 4 轮</span>
        <span
          className={`connection ${connected ? 'online' : ''}`}
          role="status"
        >
          {connected ? '本地已连接' : '正在连接'}
        </span>
        <FullscreenControl />
        {role !== 'player' && <DisplaySettings />}
        {role !== 'player' && (
          <PaintingSortControl
            value={collectionSort}
            change={setCollectionSort}
            label="全局收藏排序"
          />
        )}
        <PlayModeBadge mode={view?.playMode} />
        {role !== 'player' && (
          <ModernArtSoundControl
            feedback={session.feedback}
            game={game}
            errorId={session.errorId}
            disabled={view?.playMode === 'test' || view?.paused || !connected}
            canPlay={canPlay}
          />
        )}
        <button className="secondary" onClick={() => setPanel('menu')}>
          菜单
        </button>
      </header>
      {showSessionFeedback && <SessionFeedback session={session} />}
      {!game || !view ? (
        <div className="ma-unavailable">
          <h1>等待拍卖开始</h1>
          <p>{connected ? '回到盒子入座并准备。' : '正在恢复本地牌桌。'}</p>
          <ScreenLink className="button" href={`/${role}`}>
            回到盒子
          </ScreenLink>
        </div>
      ) : (
        <>
          {role === 'player' && !mergedPausedOffer && notice}
          <div
            className={`ma-table ${featuredAuction ? 'ma-table--featured-auction' : ''} ${featuredAuction && game.auction && game.auction.cards.length > 1 ? 'ma-table--paired-auction' : ''}`}
          >
            <MarketBoard view={game} showHistory={() => setPanel('market')} />
            <div className="ma-center">
              {mergedPausedOffer ? (
                notice
              ) : game.phase === 'round-result' || game.phase === 'ended' ? (
                <RoundResult view={game} names={names} portraits={portraits} />
              ) : (
                <AuctionStage
                  view={game}
                  names={names}
                  activityMessage={activityMessage}
                  countdown={
                    <DecisionCountdown
                      view={view}
                      connected={connected}
                      compact
                    />
                  }
                />
              )}
              {canControl &&
                !view.paused &&
                game.phase === 'round-result' &&
                nextRound && (
                  <button
                    className="ma-next-round"
                    disabled={locked}
                    onClick={() =>
                      command({
                        type: 'lifecycle',
                        action: nextRound as JsonValue,
                      })
                    }
                  >
                    开始下一轮
                  </button>
                )}
              {canControl &&
                view.status === 'ended' &&
                game.phase === 'ended' && (
                  <button
                    className="ma-next-round"
                    disabled={locked}
                    onClick={() => command({ type: 'replay' })}
                  >
                    原班人马再玩一局
                  </button>
                )}
            </div>
            {role === 'player' && !ended && (
              <SavedAction view={game} names={names} />
            )}
            {role !== 'player' && (!ended || notice) && (
              <div className="ma-table-footer">
                {!ended && <SavedAction view={game} names={names} />}
                {notice}
              </div>
            )}
            {role === 'player' && game.self && (
              <PlayerControls
                view={game}
                actions={(view.actions ?? []) as Action[]}
                locked={locked || view.paused || view.status !== 'playing'}
                selectionKey={`${view.instanceId}:${view.branch}:${view.selectionToken ?? 'none'}`}
                names={names}
                activityMessage={activityMessage}
                choose={choose}
              />
            )}
            {role !== 'player' && !emptyFinalMuseums && (
              <Museums
                view={game}
                names={names}
                portraits={portraits}
                selfId={null}
                sort={collectionSort}
              />
            )}
            {role === 'player' && (
              <button
                className="secondary ma-museums-control"
                onClick={() => setPanel('museums')}
              >
                查看各家收藏
              </button>
            )}
          </div>
        </>
      )}
      {panel && (
        <OverlayPanel
          title={
            panel === 'museums'
              ? '各家博物馆'
              : panel === 'market'
                ? '历轮估值'
                : '拍卖行菜单'
          }
          close={() => setPanel(null)}
        >
          {panel === 'museums' && game ? (
            <div className="ma-screen ma-panel">
              <div className="ma-hand-tools">
                <span>公开收藏</span>
                <PaintingSortControl
                  value={collectionSort}
                  change={setCollectionSort}
                  label="各家公开收藏排序"
                />
              </div>
              <Museums
                view={game}
                names={names}
                portraits={portraits}
                selfId={game.self?.seatId ?? null}
                sort={collectionSort}
              />
            </div>
          ) : panel === 'market' && game ? (
            <div className="ma-screen ma-panel">
              <MarketHistory view={game} />
            </div>
          ) : (
            <>
              {canControl && (
                <RoomManagement session={session} lifecycleLabel="开始下一轮" />
              )}
              {game && (
                <>
                  <h3>已保存的拍卖记录</h3>
                  <div className="ma-screen ma-panel">
                    <PublicLog view={game} names={names} />
                  </div>
                </>
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
  Screen: ModernArtScreen,
  savedChanges: (before, after) => {
    const previous = before as ModernArtView;
    const next = after as ModernArtView;
    return previous.latest?.id !== next.latest?.id && next.latest
      ? [`modern-art:${next.latest.id}`]
      : [];
  },
  motionDuration: 500,
};
