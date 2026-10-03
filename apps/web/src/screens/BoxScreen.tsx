import { useState } from 'react';
import type { BotDifficulty } from '@tablemax/protocol';
import cover from '../../../../assets/games/pokemon-encounters/cover-v1.webp';
import { ScreenLink } from '../components/ScreenLink';
import { RoomManagement } from '../components/RoomManagement';
import { InviteFriends } from '../components/InviteFriends';
import { SessionFeedback } from '../components/SessionFeedback';
import { RoomTable } from '../components/RoomTable';
import { OverlayPanel } from '../components/OverlayPanel';
import { SeatSettings } from '../components/SeatSettings';
import { GameLibrary } from '../components/GameLibrary';
import { PlayModeControl } from '../components/PlayModeControl';
import { PlayModeBadge } from '../components/PlayModeBadge';
import { DisplaySettings } from '../components/DisplaySettings';
import type { RoomSession } from '../session/useRoomSession';

const difficultyNames: Record<BotDifficulty, string> = {
  default: '默认',
  doubao: '豆包',
  juewu: '绝悟',
};
const botDescriptions: Record<BotDifficulty, string> = {
  default: '简单决策，轻松陪玩。',
  doubao: '分析已知牌面和局势，权衡得分与风险。',
  juewu: '结合全部已知信息推演，比较当前选择。',
};
type BoxPanel =
  'intro' | 'seats' | 'management' | 'library' | 'bot-info' | null;

export function BoxScreen({ session }: { session: RoomSession }) {
  const [difficulty, setDifficulty] = useState<BotDifficulty>('default');
  const [panel, setPanel] = useState<BoxPanel>(null);
  const {
    role,
    view,
    self,
    isHost,
    canControl,
    locked,
    command,
    name,
    setName,
    credential,
    busy,
    join,
    connected,
  } = session;
  const game = view?.game;
  const owner = view?.seats.find((seat) => seat.id === view.ownerSeatId);
  const lobby = view?.status === 'lobby';
  const humans =
    view?.seats.filter((seat) => seat.controller === 'human').length ?? 0;
  const bots =
    view?.seats.filter((seat) => seat.controller === 'bot').length ?? 0;
  const everyoneReady = Boolean(
    view?.seats.length && view.seats.every((seat) => seat.ready),
  );
  const roomStatus = !view
    ? '正在同步牌桌'
    : lobby
      ? view.joinOpen
        ? '扫码入座中'
        : '已关闭入座'
      : view.status === 'ended'
        ? '对局已结束'
        : view.paused || view.botError
          ? '对局已暂停'
          : '对局进行中';
  return (
    <main
      className={`shell box-screen ${role}`}
      data-play-mode={view?.playMode ?? 'play'}
    >
      <header>
        <span className="brand">
          <span className="brand-mark">T</span>TableMax
        </span>
        <div className="header-status">
          {role !== 'player' && <DisplaySettings />}
          <PlayModeBadge mode={view?.playMode} />
          <span
            className={`connection ${connected ? 'online' : ''}`}
            role="status"
          >
            {connected ? '本地连接已就绪' : '正在连接本地服务'}
          </span>
        </div>
      </header>
      <section className="hero">
        {game?.id === 'pokemon-encounters' && (
          <img src={cover} alt={`${game.name}游戏封面`} />
        )}
        <div>
          <h1>{game?.name ?? '选个游戏，朋友们上桌'}</h1>
          <p>
            {role === 'host'
              ? '电脑 · 管理员与公共展示'
              : role === 'public'
                ? '现场公共屏 · 只读展示'
                : '手机 · 你的玩家座位'}
          </p>
        </div>
        {isHost && game && (
          <button
            type="button"
            className="secondary"
            disabled={view?.status === 'playing' || locked}
            onClick={() => setPanel('library')}
          >
            切换游戏
          </button>
        )}
        {game && (
          <button
            type="button"
            className="secondary box-info-control"
            aria-label="游戏介绍"
            title="游戏介绍"
            onClick={() => setPanel('intro')}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path d="M12 11v6" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="7" r="1" fill="currentColor" />
            </svg>
          </button>
        )}
      </section>
      {!game && <GameLibrary session={session} />}
      <SessionFeedback session={session} />
      {Boolean(view?.gameView) && view && (
        <div className="continue-game">
          <div>
            <h2>
              {view.status === 'ended' ? '查看对局结果' : '牌桌已经准备好'}
            </h2>
            <p>朋友们仍在同一张牌桌，随时回到游戏。</p>
          </div>
          <ScreenLink className="button" href={`/${role}/game`}>
            进入牌桌
          </ScreenLink>
        </div>
      )}
      <div className="grid">
        <section className="card stage">
          <div className="room-heading">
            <div>
              <h2>
                聚会牌桌{' '}
                <span>
                  {view?.seats.length ?? 0} / {view?.game?.max ?? 6}
                </span>
              </h2>
              {owner && <p className="owner-badge">房主 · {owner.name}</p>}
              <p>
                {humans} 位手机玩家{bots > 0 ? ` · ${bots} 位人机` : ''}
              </p>
            </div>
            <div className="room-heading__actions">
              <span className="room-status">{roomStatus}</span>
              {isHost && lobby && (
                <button
                  type="button"
                  className="secondary"
                  disabled={!view?.seats.length}
                  onClick={() => setPanel('seats')}
                >
                  座位设置
                </button>
              )}
            </div>
          </div>
          {self && lobby && game && (
            <div className="player-actions">
              <p>
                你已坐在{' '}
                {view!.seats.findIndex((seat) => seat.id === self.id) + 1} 号位
                · {self.name}
              </p>
              <button
                disabled={locked}
                onClick={() => command({ type: 'ready', ready: !self.ready })}
              >
                {self.ready ? '取消准备' : '我准备好了'}
              </button>
            </div>
          )}
          {role === 'player' && !credential && game && (
            <form
              className="join-table"
              onSubmit={(event) => {
                event.preventDefault();
                if (!busy && name.trim()) void join();
              }}
            >
              <h2>加入牌桌</h2>
              <label htmlFor="nickname">你的昵称</label>
              <div className="join-table__row">
                <input
                  id="nickname"
                  autoComplete="nickname"
                  placeholder="朋友们怎么称呼你？"
                  value={name}
                  maxLength={24}
                  disabled={busy || session.admissionPending}
                  onChange={(event) => setName(event.target.value)}
                />
                <button
                  disabled={busy || session.admissionPending || !name.trim()}
                >
                  加入
                </button>
              </div>
            </form>
          )}
          {canControl && lobby && view && game && (
            <div className="host-lobby">
              <div className="lobby-toolbar">
                {isHost && (
                  <div className="bot-invite">
                    <div>
                      <label htmlFor="bot-difficulty">人机等级</label>
                      <select
                        id="bot-difficulty"
                        value={difficulty}
                        disabled={locked}
                        onChange={(event) =>
                          setDifficulty(event.target.value as BotDifficulty)
                        }
                      >
                        {Object.entries(difficultyNames).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      <button
                        type="button"
                        className="secondary bot-info-control"
                        aria-label="人机等级说明"
                        title="人机等级说明"
                        onClick={() => setPanel('bot-info')}
                      >
                        ⓘ
                      </button>
                    </div>
                    <button
                      className="secondary"
                      disabled={locked || view.seats.length >= game.max}
                      onClick={() => {
                        let number = 1;
                        while (
                          view.seats.some(
                            (seat) => seat.name === `人机 ${number}`,
                          )
                        )
                          number++;
                        command({
                          type: 'add-bot',
                          name: `人机 ${number}`,
                          difficulty,
                        });
                      }}
                    >
                      添加人机
                    </button>
                  </div>
                )}
                <div className="lobby-start">
                  <button
                    disabled={
                      locked || view.seats.length < game.min || !everyoneReady
                    }
                    onClick={() => command({ type: 'start' })}
                  >
                    开始游戏
                  </button>
                </div>
              </div>
              <p className="lobby-status-text">
                {view.seats.length < game.min
                  ? '至少两位玩家或人机入座即可开局。'
                  : everyoneReady
                    ? '大家已准备，开始吧。'
                    : '等朋友们在各自手机上准备好。'}
              </p>
            </div>
          )}
          <RoomTable
            seats={view?.seats ?? []}
            capacity={view?.game?.max ?? 6}
            selfId={self?.id ?? null}
            lobby={lobby}
            status={roomStatus}
            everyoneReady={everyoneReady}
          />
        </section>
        {role !== 'player' && (
          <aside className="card controls">
            <p className="phone-entry-note">
              每位朋友扫码，用自己的手机入座和操作。
            </p>
            <InviteFriends session={session} />
            {isHost && (
              <>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setPanel('management')}
                >
                  牌桌管理
                </button>
              </>
            )}
            {role === 'host' && !isHost && (
              <p>本页面没有管理员身份，请从桌面程序打开主机。</p>
            )}
          </aside>
        )}
      </div>
      {role === 'player' && canControl && (
        <button className="secondary" onClick={() => setPanel('management')}>
          房主控制
        </button>
      )}
      {panel === 'library' && isHost && (
        <OverlayPanel title="游戏库" close={() => setPanel(null)}>
          <GameLibrary session={session} close={() => setPanel(null)} />
        </OverlayPanel>
      )}
      <PlayModeControl session={session} />
      {panel === 'intro' && (
        <OverlayPanel title="游戏介绍" close={() => setPanel(null)}>
          <div className="game-introduction">
            {game?.id === 'pokemon-encounters' && (
              <img src={cover} alt={`${game.name}游戏封面`} />
            )}
            <div>
              <h3>{game?.name ?? '请先选择游戏'}</h3>
              <p>
                {view?.game?.min ?? 2}–{view?.game?.max ?? 6} 位玩家 ·
                本地聚会桌游
              </p>
            </div>
          </div>
          <p>
            每位朋友使用自己的手机操作。电脑由管理员管理，并向现场展示公共信息；也可加入本地人机。
          </p>
        </OverlayPanel>
      )}
      {panel === 'seats' && isHost && (
        <OverlayPanel title="座位设置" close={() => setPanel(null)}>
          <SeatSettings session={session} />
        </OverlayPanel>
      )}
      {panel === 'management' && canControl && (
        <OverlayPanel title="牌桌管理" close={() => setPanel(null)}>
          <RoomManagement session={session} />
        </OverlayPanel>
      )}
      {panel === 'bot-info' && isHost && (
        <OverlayPanel title="人机等级说明" close={() => setPanel(null)}>
          {Object.entries(difficultyNames).map(([value, title]) => (
            <section className="bot-level-description" key={value}>
              <h3>{title}</h3>
              <p>{botDescriptions[value as BotDifficulty]}</p>
            </section>
          ))}
          <p>三档均在本地运行，只使用本人获准的信息。</p>
        </OverlayPanel>
      )}
      <footer>TableMax · 本地聚会牌桌 · 电脑管理，手机游玩</footer>
    </main>
  );
}
