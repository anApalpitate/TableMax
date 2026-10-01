import { GameHelp } from '../../../../games/pokemon-encounters/ui/public';
import cover from '../../../../assets/games/pokemon-encounters/cover-v1.webp';
import dice from '../../../../assets/platform/dice.webp';
import { avatarFor } from '../assets/avatars';
import { ScreenLink } from '../components/ScreenLink';
import { RoomManagement } from '../components/RoomManagement';
import { InviteFriends } from '../components/InviteFriends';
import { SessionFeedback } from '../components/SessionFeedback';
import type { RoomSession } from '../session/useRoomSession';

export function BoxScreen({ session }: { session: RoomSession }) {
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
        <img src={cover} alt="明亮花园中的桌游聚会" />
        <div>
          <p className="eyebrow">你的桌游盒子</p>
          <h1>{view?.game.name ?? '宝可梦奇遇：皮卡丘和朋友们'}</h1>
          <p>
            {isHost
              ? '电脑管理牌桌，朋友用手机游玩。'
              : role === 'public'
                ? '公共屏 · 只读观战'
                : '入座、准备，一起开始。'}
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
            <p>回到盒子不影响对局，朋友们仍在同一张牌桌。</p>
          </div>
          <ScreenLink className="button" href={`/${role}/game`}>
            进入牌桌
          </ScreenLink>
        </div>
      )}
      <div className="grid">
        <section className="card stage">
          <h2>
            玩家{' '}
            <span className="muted">
              {view?.seats.length ?? 0} / {view?.game.max ?? 5}
            </span>
          </h2>
          <div className="seats">
            {view?.seats.map((seat, i) => (
              <article className="seat" key={seat.id}>
                <img className="avatar" src={avatarFor(seat.id)} alt="" />
                <h3>
                  {seat.name}
                  {seat.id === self?.id ? ' · 你' : ''}
                </h3>
                <p>
                  {' '}
                  {seat.controller === 'bot'
                    ? '电脑'
                    : seat.online
                      ? '在线'
                      : '离线'}
                </p>
                <span className="tag">
                  {lobby ? (seat.ready ? '已准备' : '未准备') : '已入座'}
                </span>
                {isHost && lobby && (
                  <details className="seat-settings">
                    <summary>座位设置</summary>
                    <div className="row">
                      <button
                        className="secondary"
                        disabled={locked || i === 0}
                        onClick={() => {
                          const ids = view.seats.map((s) => s.id);
                          [ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!];
                          command({ type: 'order', seats: ids });
                        }}
                      >
                        前移
                      </button>
                      <button
                        className="secondary"
                        disabled={locked}
                        onClick={() =>
                          command({ type: 'remove-seat', seatId: seat.id })
                        }
                      >
                        移除
                      </button>
                    </div>
                  </details>
                )}
              </article>
            ))}
          </div>
          {view?.seats.length === 0 && (
            <div className="empty">
              <img src={dice} alt="" />
              <p>邀请朋友扫码，或添加电脑一起玩。</p>
            </div>
          )}
          {self && lobby && (
            <div className="player-actions">
              <button
                disabled={locked}
                onClick={() => command({ type: 'ready', ready: !self.ready })}
              >
                {self.ready ? '取消准备' : '我准备好了'}
              </button>
            </div>
          )}
          {isHost && lobby && (
            <div className="lobby-start">
              <button
                className="secondary"
                disabled={locked || view.seats.length >= view.game.max}
                onClick={() =>
                  command({
                    type: 'add-bot',
                    name: `电脑 ${view.seats.filter((s) => s.controller === 'bot').length + 1}`,
                  })
                }
              >
                添加电脑
              </button>
              <button
                disabled={
                  locked ||
                  view.seats.length < view.game.min ||
                  !view.seats.every((s) => s.ready)
                }
                onClick={() => command({ type: 'start' })}
              >
                开始游戏
              </button>
              <p className="muted">
                {view.seats.length < view.game.min
                  ? '至少两位朋友或电脑入座即可开局。'
                  : view.seats.every((s) => s.ready)
                    ? '大家已准备，开始吧。'
                    : '等朋友们准备好，就能开始。'}
              </p>
            </div>
          )}
          {role === 'player' && !credential && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!busy && name.trim()) void join();
              }}
            >
              <h2>加入牌桌</h2>
              <label htmlFor="nickname">你的昵称</label>
              <input
                id="nickname"
                autoComplete="nickname"
                value={name}
                maxLength={24}
                onChange={(event) => setName(event.target.value)}
              />
              <button disabled={busy || !name.trim()}>加入</button>
              <details>
                <summary>换手机绑定</summary>
                <label htmlFor="binding">房主提供的绑定码</label>
                <input
                  id="binding"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !code.trim()}
                  onClick={() => void join(true)}
                >
                  绑定原座位
                </button>
              </details>
            </form>
          )}
        </section>
        <aside className="card controls">
          {role !== 'player' && <InviteFriends session={session} />}
          <RoomManagement session={session} />
          {isHost && (
            <details>
              <summary>换手机</summary>
              {view?.seats
                .filter((s) => s.controller === 'human')
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

          <details>
            <summary>游戏帮助</summary>
            <GameHelp />
          </details>
        </aside>
      </div>
      <footer>
        TableMax · 本地牌桌<span></span>
      </footer>
    </main>
  );
}
