import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  RoomViewSchema,
  CommandReplySchema,
  RoomFeedbackSchema,
  type RoomFeedback,
  type Command,
  type RoomView,
} from '@tablemax/protocol';
import {
  SeatResult,
  GameHelp,
  TableStatus,
  PublicLog,
} from '../../../games/pokemon-encounters/ui/public';
import { PlayerControls } from '../../../games/pokemon-encounters/ui/player';
import type { PokemonView } from '../../../games/pokemon-encounters/rules/project';
import { SoundControl } from '../../../games/pokemon-encounters/ui/audio';
import { SavedMotion } from '../../../games/pokemon-encounters/ui/motion';
import cover from '../../../games/pokemon-encounters/assets/cover-v1.webp';
import dice from './prototype/assets/dice.webp';
import avatar1 from './prototype/assets/avatar-1.webp';
import avatar2 from './prototype/assets/avatar-2.webp';
import avatar3 from './prototype/assets/avatar-3.webp';
import avatar4 from './prototype/assets/avatar-4.webp';
import avatar5 from './prototype/assets/avatar-5.webp';
import avatar6 from './prototype/assets/avatar-6.webp';

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6];
const messages: Record<string, string> = {
  unauthorized: '此操作需要房主身份。',
  'invalid-identity': '身份已失效，请联系房主换绑。',
  'stale-branch': '历史已回退，请按最新状态重新选择。',
  'stale-revision': '状态已变化，请重新选择。',
  'stale-decision': '该选择已结束，请按最新状态操作。',
  'not-ready': '请等待至少两位玩家全部准备。',
  'joining-closed-or-full': '当前不能加入：房间已关闭、开始或满员。',
  'binding-expired': '绑定码已过期或已经使用。',
  'save-or-action-failed': '操作未确认保存，请检查本地存储后重试。',
  'illegal-action': '选择无效，请重新同步。',
};
function credentialFor(role: string) {
  if (role === 'player') return localStorage.getItem('tablemax-player') ?? '';
  if (role === 'public') return '';
  const value = new URLSearchParams(location.hash.slice(1)).get('host');
  if (value) {
    sessionStorage.setItem('tablemax-host', value);
    history.replaceState(null, '', location.pathname);
  }
  return sessionStorage.getItem('tablemax-host') ?? '';
}
function avatar(id: string) {
  return avatars[
    [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % avatars.length
  ]!;
}

export function App() {
  const role =
    location.pathname === '/player'
      ? 'player'
      : location.pathname === '/public'
        ? 'public'
        : 'host';
  const [credential, setCredential] = useState(() => credentialFor(role));
  const [view, setView] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [bindingCode, setBindingCode] = useState('');
  const [addresses, setAddresses] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [port, setPort] = useState(38473);
  const [feedback, setFeedback] = useState<RoomFeedback | null>(null);
  const [errorId, setErrorId] = useState('');
  const [motion, setMotion] = useState<string[]>([]);
  const synced = useRef<RoomView | null>(null);
  const changedSlots = useRef<string[]>([]);
  const lastFeedback = useRef('');
  const motionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pending = useRef<Command | null>(null);
  useEffect(() => {
    const socket = io({
      auth: credential ? { token: credential } : {},
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:sync');
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setView(null);
      synced.current = null;
      changedSlots.current = [];
      setMotion([]);
      setFeedback(null);
      setMessage('连接已断开，等待重新同步。');
    });
    socket.on('room:view', (input: unknown) => {
      const parsed = RoomViewSchema.safeParse(input);
      if (parsed.success) {
        const next = parsed.data,
          previous = synced.current;
        changedSlots.current = [];
        if (
          previous?.gameView &&
          next.gameView &&
          previous.instanceId === next.instanceId &&
          previous.branch === next.branch
        ) {
          const before = previous.gameView as PokemonView,
            after = next.gameView as PokemonView;
          if (before.phase !== after.phase) changedSlots.current.push('@phase');
          if (JSON.stringify(before.held) !== JSON.stringify(after.held))
            changedSlots.current.push('@held');
          for (const seat of after.seatOrder)
            after.boards[seat]!.forEach((slot, i) => {
              if (
                JSON.stringify(slot) !==
                JSON.stringify(before.boards[seat]?.[i])
              )
                changedSlots.current.push(slot.slotId);
            });
        }
        if (
          !previous ||
          previous.branch !== next.branch ||
          previous.instanceId !== next.instanceId
        ) {
          setMotion([]);
          setFeedback(null);
        }
        synced.current = next;
        setView(next);
      } else {
        setView(null);
        setMessage('服务数据不兼容，请重新启动程序。');
      }
    });
    socket.on('room:feedback', (input: unknown) => {
      const parsed = RoomFeedbackSchema.safeParse(input);
      const current = synced.current;
      if (!parsed.success || !current) return;
      const item = parsed.data,
        key = `${item.instanceId}:${item.branch}:${item.revision}`;
      if (
        key === lastFeedback.current ||
        item.instanceId !== current.instanceId ||
        item.branch !== current.branch ||
        item.revision !== current.revision
      )
        return;
      lastFeedback.current = key;
      setFeedback(item);
      setMotion(changedSlots.current);
      if (motionTimer.current) clearTimeout(motionTimer.current);
      motionTimer.current = setTimeout(() => setMotion([]), 260);
    });
    const revoked = () => {
      setConnected(false);
      setView(null);
      synced.current = null;
      setMotion([]);
      setFeedback(null);
      pending.current = null;
      setBusy(false);
      setAwaitingConfirmation(false);
      setMessage(messages['invalid-identity']!);
      if (role === 'player') {
        localStorage.removeItem('tablemax-player');
        setCredential('');
      }
    };
    socket.on('room:revoked', revoked);
    socket.on('connect_error', (error: Error) => {
      if (error.message === 'invalid-identity') revoked();
      else setMessage('连接失败，请检查电脑服务和局域网。');
    });
    const abort = new AbortController();
    void fetch('/api/room/network', { signal: abort.signal })
      .then(async (r) => {
        const network = (await r.json()) as {
          addresses: string[];
          port: number;
        };
        setAddresses(network.addresses);
        setAddress(network.addresses[0] ?? '');
        setPort(network.port);
      })
      .catch(() => undefined);
    return () => {
      abort.abort();
      socket.disconnect();
      socketRef.current = null;
      if (motionTimer.current) clearTimeout(motionTimer.current);
    };
  }, [credential, role]);
  const isHost = view?.self.role === 'host';
  const self = view?.seats.find((s) => s.id === view.self.seatId);
  const locked = busy || !connected || !view;
  function send(envelope: Command) {
    pending.current = envelope;
    setBusy(true);
    setAwaitingConfirmation(true);
    setMessage('正在提交…');
    socketRef.current
      ?.timeout(5000)
      .emit('room:command', envelope, (error: Error | null, input: unknown) => {
        if (pending.current !== envelope) return;
        if (error) {
          setMessage('尚未收到保存确认，请重试确认。');
          socketRef.current?.emit('room:sync');
          return;
        }
        const parsed = CommandReplySchema.safeParse(input);
        if (!parsed.success) {
          setMessage('服务确认无效，请重新同步。');
          socketRef.current?.emit('room:sync');
          return;
        }
        pending.current = null;
        setBusy(false);
        setAwaitingConfirmation(false);
        const reply = parsed.data;
        if (reply.ok) {
          setMessage('已保存');
          if (reply.bindingCode) setBindingCode(reply.bindingCode);
        } else {
          setErrorId(envelope.actionId);
          setMessage(
            messages[reply.reason] ?? '操作未完成，请按最新状态重试。',
          );
          socketRef.current?.emit('room:sync');
        }
      });
  }
  function command(value: Command['command']) {
    if (!view || locked || pending.current) return;
    send({
      actionId: Array.from(crypto.getRandomValues(new Uint32Array(4))).join(
        '-',
      ),
      instanceId: view.instanceId,
      revision: view.revision,
      branch: view.branch,
      command: value,
    });
  }
  async function join(rebind = false) {
    setBusy(true);
    try {
      const response = await fetch(
        rebind ? '/api/session/redeem' : '/api/session/join',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            rebind
              ? { code: code.trim() }
              : {
                  name: name.trim(),
                  ...(sessionStorage.getItem('tablemax-host')
                    ? { hostToken: sessionStorage.getItem('tablemax-host')! }
                    : {}),
                },
          ),
        },
      );
      const result = (await response.json()) as {
        ok: boolean;
        token?: string;
        duplicateName?: boolean;
        reason?: string;
      };
      if (!result.ok || !result.token)
        throw new Error(messages[result.reason ?? ''] ?? '加入失败');
      localStorage.setItem('tablemax-player', result.token);
      setCredential(result.token);
      setMessage(
        result.duplicateName ? '已有同名朋友，以座位编号区分。' : '已加入',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '连接失败');
    } finally {
      setBusy(false);
    }
  }
  const game = view?.gameView as PokemonView | null;
  const names = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, seat.name]) ?? [],
  );
  return (
    <SavedMotion.Provider value={motion}>
      <main
        className={`shell ${role} ${game ? 'active-game' : ''} ${feedback?.events.at(-1)?.kind === 'round-result' && motion.length ? 'saved-result' : ''}`}
      >
        <header>
          <a className="brand" href={role === 'player' ? '/player' : '/public'}>
            <span className="brand-mark">T</span>TableMax
          </a>
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
            <p className="eyebrow">和朋友一起坐到桌边</p>
            <h1>
              {role === 'player' && !self
                ? '欢迎来到桌边。'
                : view?.status === 'lobby'
                  ? '今晚，一起玩。'
                  : view?.status === 'ended'
                    ? '这一局，留下好回忆。'
                    : '在花园里，遇见新朋友。'}
            </h1>
            <p>{view?.game.name ?? '正在准备牌桌'}</p>
            <span className="tag">
              {view?.status === 'lobby'
                ? '大厅'
                : view?.paused
                  ? '已暂停'
                  : view?.status === 'ended'
                    ? view.endReason
                    : '对局中'}
            </span>
          </div>
        </section>
        <p className="feedback" aria-live="polite">
          {message ||
            (self
              ? `你是 ${self.name} · 座位 ${view!.seats.indexOf(self) + 1}`
              : '手机与电脑连接同一局域网即可加入。')}
        </p>
        {awaitingConfirmation && (
          <button
            onClick={() => {
              if (pending.current) send(pending.current);
            }}
            disabled={!connected}
          >
            重试确认
          </button>
        )}
        <div className="grid">
          <section className="card stage">
            {game && <TableStatus view={game} names={names} />}
            <h2>{view?.status === 'lobby' ? '朋友们的座位' : '牌桌'}</h2>
            <div className="seats">
              {view?.seats
                .filter(
                  (seat) => role !== 'player' || !self || seat.id === self.id,
                )
                .map((seat, i) => (
                  <article
                    className={`seat ${seat.id === (game?.actorSeat ?? game?.turnSeat) ? 'active' : ''}`}
                    key={seat.id}
                  >
                    <img className="avatar" src={avatar(seat.id)} alt="" />
                    <h3>{seat.name}</h3>
                    <p>
                      座位 {view.seats.findIndex((s) => s.id === seat.id) + 1} ·{' '}
                      {seat.controller === 'bot'
                        ? '电脑'
                        : seat.online
                          ? '在线'
                          : '离线'}
                    </p>
                    {view.status === 'lobby' ? (
                      <span className="tag">
                        {seat.ready ? '已准备' : '未准备'}
                      </span>
                    ) : self?.id === seat.id && game && view.actions.length ? (
                      <PlayerControls
                        key={`${view.instanceId}:${view.branch}:${view.revision}:${self.id}`}
                        view={game}
                        seatId={self.id}
                        names={names}
                        actions={
                          view.actions as Parameters<
                            typeof PlayerControls
                          >[0]['actions']
                        }
                        locked={locked}
                        choose={(action) =>
                          command({
                            type: 'game',
                            decisionId: view.decisionId!,
                            action,
                          })
                        }
                      />
                    ) : (
                      <SeatResult view={game} seatId={seat.id} />
                    )}
                    {isHost && view.status === 'lobby' && (
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
                    )}
                    {isHost && seat.controller === 'human' && (
                      <button
                        className="secondary"
                        disabled={locked}
                        onClick={() => {
                          if (
                            confirm(
                              '换绑会立即使原手机身份失效，保留座位和游戏数据。继续？',
                            )
                          )
                            command({ type: 'rebind', seatId: seat.id });
                        }}
                      >
                        换手机
                      </button>
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
            {view?.paused && (
              <p className="notice">
                {view.restored
                  ? '已读取存档，等待房主恢复和玩家重连。'
                  : '房主已暂停，选择暂时停止。'}
              </p>
            )}
            {view?.botError && <p className="error">{view.botError}</p>}
            {view?.status === 'playing' &&
              game?.phase !== 'round-result' &&
              !view.paused &&
              !view.actions.length && (
                <p className="muted">
                  等待{' '}
                  {view.seats.find((s) => s.id === game?.actorSeat)?.name ??
                    '其他玩家'}{' '}
                  行动。真人离线时保留座位。
                </p>
              )}
            {self && view?.status === 'lobby' && (
              <div className="player-actions">
                <button
                  disabled={locked}
                  onClick={() => command({ type: 'ready', ready: !self.ready })}
                >
                  {self.ready ? '取消准备' : '我准备好了'}
                </button>
              </div>
            )}
            {game && <PublicLog view={game} />}
          </section>
          <aside className="card controls">
            {role !== 'player' && (
              <SoundControl feedback={feedback} errorId={errorId} />
            )}
            {role === 'player' && sessionStorage.getItem('tablemax-host') && (
              <a className="button secondary" href="/host">
                返回房主管理
              </a>
            )}
            {self && (
              <details>
                <summary>朋友列表</summary>
                {view?.seats
                  .filter((s) => s.id !== self.id)
                  .map((s) => (
                    <div key={s.id}>
                      <p>
                        {s.name} ·{' '}
                        {s.controller === 'bot'
                          ? '电脑'
                          : s.online
                            ? '在线'
                            : '离线'}
                      </p>
                      {game && <SeatResult view={game} seatId={s.id} />}
                    </div>
                  ))}
              </details>
            )}
            {role === 'player' && !credential && (
              <>
                <h2>加入牌桌</h2>
                <label htmlFor="nickname">你的昵称</label>
                <input
                  id="nickname"
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  disabled={busy || !name.trim()}
                  onClick={() => void join()}
                >
                  加入
                </button>
                <details>
                  <summary>换手机绑定</summary>
                  <label htmlFor="binding">房主提供的绑定码</label>
                  <input
                    id="binding"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <button
                    disabled={busy || !code.trim()}
                    onClick={() => void join(true)}
                  >
                    绑定原座位
                  </button>
                </details>
              </>
            )}
            {isHost && (
              <details className="management" open={view?.status === 'lobby'}>
                <summary>
                  <h2>房主管理</h2>
                </summary>
                {view?.lifecycleActions.map((action, i) => (
                  <button
                    key={i}
                    disabled={locked}
                    onClick={() =>
                      command({
                        type: 'lifecycle',
                        action: action as Extract<
                          Command['command'],
                          { type: 'lifecycle' }
                        >['action'],
                      })
                    }
                  >
                    开始下一局
                  </button>
                ))}
                {view?.status === 'lobby' ? (
                  <>
                    <button
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
                      className="secondary"
                      disabled={locked}
                      onClick={() =>
                        command({ type: 'join-open', open: !view.joinOpen })
                      }
                    >
                      {view.joinOpen ? '关闭加入' : '开放加入'}
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
                  </>
                ) : (
                  <>
                    {view?.status === 'playing' && (
                      <>
                        <button
                          disabled={locked}
                          onClick={() =>
                            command({
                              type:
                                view.paused || view.botError
                                  ? 'resume'
                                  : 'pause',
                            })
                          }
                        >
                          {view.paused || view.botError
                            ? '恢复游戏'
                            : '暂停游戏'}
                        </button>
                        <button
                          className="secondary"
                          disabled={locked}
                          onClick={() => {
                            if (
                              confirm('结束当前对局？已保存状态和历史将保留。')
                            )
                              command({ type: 'end' });
                          }}
                        >
                          结束对局
                        </button>
                      </>
                    )}
                    {view?.status === 'ended' && (
                      <button
                        disabled={locked}
                        onClick={() => command({ type: 'new-room' })}
                      >
                        创建新房间
                      </button>
                    )}
                    <details>
                      <summary>决策点回退（{view?.history.length}）</summary>
                      <p>
                        恢复到该选择之前。已看见的信息无法撤销；回退后保持暂停。
                      </p>
                      {view?.history
                        .slice()
                        .reverse()
                        .map((h) => (
                          <button
                            className="secondary"
                            key={h.id}
                            disabled={locked}
                            onClick={() => {
                              if (
                                confirm(
                                  `恢复到“${h.label}”？后续选择将撤销，已揭示信息无法从记忆消除。`,
                                )
                              )
                                command({
                                  type: 'rollback',
                                  checkpointId: h.id,
                                });
                            }}
                          >
                            {h.label}
                            {h.revealedInformation ? ' · 含揭示' : ''}
                          </button>
                        ))}
                    </details>
                  </>
                )}
                {bindingCode && (
                  <details open>
                    <summary>一次性换绑码 · 两分钟有效</summary>
                    <p>交给对应玩家，原身份已撤销。</p>
                    <textarea
                      readOnly
                      aria-label="一次性绑定码"
                      value={bindingCode}
                    />
                  </details>
                )}
                <a className="button secondary" href="/public">
                  打开公共屏
                </a>
                <a className="button secondary" href="/player">
                  房主用独立玩家身份参与
                </a>
              </details>
            )}
            {role !== 'player' && (
              <>
                <h2>邀请朋友</h2>
                <label htmlFor="address">电脑地址</label>
                <select
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                >
                  {addresses.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                {address ? (
                  <>
                    <img
                      className="qr"
                      src={`/api/foundation/qr?address=${encodeURIComponent(address)}`}
                      alt="手机加入二维码"
                    />
                    <p className="url">
                      http://{address}:{port}/player
                    </p>
                  </>
                ) : (
                  <p>未发现局域网地址，请检查网络。</p>
                )}
                <details>
                  <summary>连接帮助</summary>
                  <p>
                    手机和电脑连接同一局域网；选择手机能访问的网卡地址，在系统浏览器打开。请检查私人网络防火墙、访客网络和设备隔离；地址改变后重新扫码。
                  </p>
                </details>
              </>
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
          TableMax · 本地牌桌<span>游戏资源随程序本地加载</span>
        </footer>
      </main>
    </SavedMotion.Provider>
  );
}
