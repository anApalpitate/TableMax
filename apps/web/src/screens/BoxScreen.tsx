import { useState } from 'react';
import type { BotDifficulty } from '@tablemax/protocol';
import cover from '../../../../assets/games/pokemon-encounters/cover-v1.webp';
import { ScreenLink } from '../components/ScreenLink';
import { RoomManagement } from '../components/RoomManagement';
import { InviteFriends } from '../components/InviteFriends';
import { SessionFeedback } from '../components/SessionFeedback';
import { RoomTable } from '../components/RoomTable';
import type { RoomSession } from '../session/useRoomSession';

const botDescriptions: Record<BotDifficulty, string> = {
  default: '简单决策，轻松陪玩。',
  doubao: '分析已知牌面和局势，权衡得分与风险。',
  juewu: '结合全部已知信息推演，比较当前选择。',
};
const botDifficultyNames: Record<BotDifficulty, string> = {
  default: '默认',
  doubao: '豆包',
  juewu: '绝悟',
};

export function BoxScreen({ session }: { session: RoomSession }) {
  const [difficulty, setDifficulty] = useState<BotDifficulty>('default');
  const {
    role,
    view,
    self,
    isHost,
    locked,
    command,
    name,
    setName,
    code,
    setCode,
    credential,
    busy,
    join,
    connected,
  } = session;
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
    <main className={`shell box-screen ${role}`}>
      <header>
        <span className="brand">
          <span className="brand-mark">T</span>TableMax
        </span>
        <span
          className={`connection ${connected ? 'online' : ''}`}
          role="status"
        >
          {connected ? '本地连接已就绪' : '正在连接本地服务'}
        </span>
      </header>
      <section className="hero">
        <img src={cover} alt="宝可梦奇遇游戏封面" />
        <div>
          <p className="eyebrow">你的桌游盒子</p>
          <h1>{view?.game.name ?? '宝可梦奇遇：皮卡丘和朋友们'}</h1>
          <p>
            {role === 'host'
              ? '电脑 · 房主管理与公共展示'
              : role === 'public'
                ? '现场公共屏 · 只读展示'
                : '手机 · 你的玩家座位'}
          </p>
        </div>
      </section>
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
                  {view?.seats.length ?? 0} / {view?.game.max ?? 5}
                </span>
              </h2>
              <p>
                {humans} 位手机玩家{bots > 0 ? ` · ${bots} 位人机` : ''}
              </p>
            </div>
            <span className="room-status">{roomStatus}</span>
          </div>
          {self && lobby && (
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
          {role === 'player' && !credential && (
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
              <details>
                <summary>换手机绑定</summary>
                <label htmlFor="binding">房主提供的绑定码</label>
                <input
                  id="binding"
                  disabled={busy || session.admissionPending}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || session.admissionPending || !code.trim()}
                  onClick={() => void join(true)}
                >
                  绑定原座位
                </button>
              </details>
            </form>
          )}
          {isHost && lobby && view && (
            <div className="host-lobby">
              <div className="lobby-toolbar">
                <div className="bot-invite">
                  <div>
                    <label htmlFor="bot-difficulty">人机等级</label>
                    <select
                      id="bot-difficulty"
                      value={difficulty}
                      disabled={locked}
                      aria-describedby="bot-description"
                      onChange={(event) =>
                        setDifficulty(event.target.value as BotDifficulty)
                      }
                    >
                      {Object.entries(botDifficultyNames).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <button
                    className="secondary"
                    disabled={locked || view.seats.length >= view.game.max}
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
                <div className="lobby-start">
                  <button
                    disabled={
                      locked ||
                      view.seats.length < view.game.min ||
                      !everyoneReady
                    }
                    onClick={() => command({ type: 'start' })}
                  >
                    开始游戏
                  </button>
                </div>
              </div>
              <div className="lobby-status-text">
                <p id="bot-description">{botDescriptions[difficulty]}</p>
                <p>
                  {view.seats.length < view.game.min
                    ? '至少两位玩家或人机入座即可开局。'
                    : everyoneReady
                      ? '大家已准备，开始吧。'
                      : '等朋友们在各自手机上准备好。'}
                </p>
              </div>
            </div>
          )}
          <RoomTable
            seats={view?.seats ?? []}
            capacity={view?.game.max ?? 5}
            selfId={self?.id ?? null}
            lobby={lobby}
            status={roomStatus}
            everyoneReady={everyoneReady}
          />
          {isHost && lobby && view && view.seats.length > 0 && (
            <details className="seat-manager">
              <summary>座位设置</summary>
              <div className="seat-manager__list">
                {view.seats.map((seat, index) => (
                  <div
                    className="seat-manager__row"
                    key={seat.id}
                    data-seat-id={seat.id}
                  >
                    <span className="seat-manager__number">{index + 1}</span>
                    <strong>{seat.name}</strong>
                    {seat.controller === 'bot' && (
                      <select
                        className="seat-difficulty"
                        aria-label={`${seat.name}的人机等级`}
                        data-seat-id={seat.id}
                        disabled={locked}
                        value={seat.botDifficulty ?? 'default'}
                        onChange={(event) =>
                          command({
                            type: 'set-bot-difficulty',
                            seatId: seat.id,
                            difficulty: event.target.value as BotDifficulty,
                          })
                        }
                      >
                        {Object.entries(botDifficultyNames).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                    <button
                      className="secondary"
                      aria-label={`${seat.name}前移`}
                      disabled={locked || index === 0}
                      onClick={() => {
                        const ids = view.seats.map((item) => item.id);
                        [ids[index - 1], ids[index]] = [
                          ids[index]!,
                          ids[index - 1]!,
                        ];
                        command({ type: 'order', seats: ids });
                      }}
                    >
                      前移
                    </button>
                    <button
                      className="secondary"
                      aria-label={`移除${seat.name}`}
                      disabled={locked}
                      onClick={() =>
                        command({ type: 'remove-seat', seatId: seat.id })
                      }
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
        {role !== 'player' && (
          <aside className="card controls">
            <p className="phone-entry-note">
              每位朋友扫码，用自己的手机入座和操作。
            </p>
            <InviteFriends session={session} />
            <RoomManagement session={session} />
            {isHost && (
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
            )}
            {role === 'host' && !isHost && (
              <p>本页面没有房主管理身份，请从桌面程序打开主机。</p>
            )}
          </aside>
        )}
      </div>
      <footer>TableMax · 本地聚会牌桌 · 电脑管理，手机游玩</footer>
    </main>
  );
}
