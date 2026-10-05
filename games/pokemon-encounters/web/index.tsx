/* eslint-disable react-refresh/only-export-components -- Lazy adapters expose one platform client object. */
import { useState } from 'react';
import { client as expansionClient } from '../expansion/web';
import type { JsonValue } from '../../../packages/game-sdk/src';
import type { PokemonView } from '../rules/project';
import { SeatResult, PublicLog } from '../ui/public';
import { GameTable } from '../ui/table';
import { SoundControl } from '../ui/audio';
import { SavedMotion, savedChanges, savedMotionDuration } from '../ui/motion';
import type { GameClient, GameHost as RoomSession } from '@tablemax/web-host';
import { useAudioOutput } from '@tablemax/web-host';
import '../ui/screen.css';
import '../ui/style.css';
import { avatarFor } from '@tablemax/web-host';
import { ScreenLink } from '@tablemax/web-host';
import { SessionFeedback } from '@tablemax/web-host';
import { OverlayPanel } from '@tablemax/web-host';
import { FullscreenControl } from '@tablemax/web-host';
import { RoomManagement } from '@tablemax/web-host';
import { PlayModeControl } from '@tablemax/web-host';
import { PlayModeBadge } from '@tablemax/web-host';
import { DisplaySettings } from '@tablemax/web-host';
import { RulesGuide } from '@tablemax/web-host';
import { pokemonRulebook } from '../ui/RulesGuide';
import { CountdownSettings } from '@tablemax/web-host';
import { BeginnerGuidanceSetting } from '@tablemax/web-host';
import { useGuidancePreference } from '@tablemax/web-host';

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
  const [guidanceEnabled] = useGuidancePreference('pokemon-encounters');
  const [panel, setPanel] = useState<'menu' | 'friends' | 'rules' | null>(null);
  const [ruleChapter, setRuleChapter] = useState<string | null>(null);
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
    portrait: avatarFor(seat.avatarId),
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
            aria-label={connected ? '本地连接已就绪' : '正在连接本地服务'}
            title={connected ? '本地连接已就绪' : '正在连接本地服务'}
          >
            {role === 'player' ? (
              <span className="toolbar-connection-mark" aria-hidden="true" />
            ) : connected ? (
              '本地连接已就绪'
            ) : (
              '正在连接本地服务'
            )}
          </span>
          {role !== 'player' && <FullscreenControl />}
          {role === 'player' && (
            <button
              className="secondary toolbar-friends"
              aria-label="看看朋友的牌桌"
              onClick={() => setPanel('friends')}
            >
              朋友
            </button>
          )}
          {role !== 'player' && <DisplaySettings />}
          {role !== 'player' && <PlayModeBadge mode={view?.playMode} />}
          {role !== 'player' && (
            <SoundControl
              compact
              disabled={view?.playMode === 'test'}
              paused={view?.paused ?? false}
              feedback={feedback}
              errorId={errorId}
              game={game}
              canPlay={canPlay}
            />
          )}
          <button
            className="secondary game-rulebook-entry"
            onClick={() => {
              setRuleChapter(null);
              setPanel('rules');
            }}
          >
            规则
          </button>
          <button
            className="secondary toolbar-menu"
            onClick={() => setPanel('menu')}
          >
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
              showRules={(chapter) => {
                setRuleChapter(chapter);
                setPanel('rules');
              }}
              showFriends={() => setPanel('friends')}
              friendsInToolbar={role === 'player'}
              guidanceEnabled={guidanceEnabled}
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
            title={
              panel === 'rules' ? (
                <>
                  <span className="rules-guide__title-part">宝可梦奇遇</span>
                  <span className="rules-guide__title-part">图文规则</span>
                </>
              ) : panel === 'menu' ? (
                '牌桌菜单'
              ) : (
                '朋友的牌桌'
              )
            }
            close={() => setPanel(null)}
          >
            {panel === 'rules' ? (
              <RulesGuide {...pokemonRulebook} initialChapter={ruleChapter} />
            ) : panel === 'friends' ? (
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
                {role === 'player' && (
                  <div className="pokemon-mobile-menu-controls">
                    <FullscreenControl />
                    <PlayModeBadge mode={view?.playMode} />
                  </div>
                )}
                <CountdownSettings session={session}>
                  <BeginnerGuidanceSetting gameId="pokemon-encounters" />
                </CountdownSettings>
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
  motionDuration: (view) => savedMotionDuration(view as PokemonView),
};
export const clientsByVariant = {
  original: client,
  expansion: expansionClient,
};
