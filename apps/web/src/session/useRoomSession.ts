import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  RoomViewSchema,
  CommandReplySchema,
  RoomFeedbackSchema,
  NetworkSchema,
  type RoomFeedback,
  type Command,
  type RoomView,
  type AvatarId,
} from '@tablemax/protocol';
import { getGameClient } from '../game-clients/registry';
import { navigate, type ScreenRole } from '../navigation';
import { useAdmission } from './useAdmission';
const messages: Record<string, string> = {
  unauthorized: '你没有此操作的管理权限。',
  'game-not-selected': '请先由管理员选择游戏。',
  'game-load-failed': '游戏加载失败，当前牌桌保持不变，请重试。',
  'unknown-game': '这个游戏尚未安装。',
  'too-many-seats': '当前人数超过目标游戏上限，请先调整座位。',
  'invalid-identity': '身份已失效，请使用原浏览器恢复，或联系管理员检查座位。',
  'stale-branch': '历史已回退，请按最新状态重新选择。',
  'stale-revision': '状态已变化，请重新选择。',
  'stale-decision': '该选择已结束，请按最新状态操作。',
  'not-ready': '请达到所选游戏的最低人数，并等待全部玩家准备。',
  'joining-closed-or-full': '当前不能加入：牌桌已关闭入座、开始或满员。',
  'joining-closed': '牌桌已关闭入座或已经开始，请联系电脑管理员。',
  'room-full': '牌桌已满，请电脑管理员检查是否有离线的重复座位。',
  'session-request-revoked':
    '原座位身份已撤销，请使用原浏览器恢复，或联系管理员检查座位。',
  'session-request-conflict': '入座请求不一致，请联系电脑管理员检查原座位。',
  'session-request-expired': '入座确认已超过一天，请联系管理员检查原座位。',
  'session-request-limit': '入座请求过多，请联系电脑管理员检查座位。',
  'invalid-name': '请输入 1–24 字的昵称。',
  'invalid-message': '请求内容无效，请重新选择。',
  'invalid-avatar': '请选择一个可用头像。',
  'avatar-unavailable': '这个头像已被朋友选走，请选择另一个。',
  'avatars-locked': '对局进行中，请在结束后更换头像。',
  'stale-instance': '新的大局已经准备好，请按当前牌桌重新操作。',
  'unsupported-bot-difficulty': '当前游戏不支持这个人机等级。',
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
export function useRoomSession(role: ScreenRole) {
  const [credential, setCredential] = useState(() => credentialFor(role));
  const [view, setView] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [addresses, setAddresses] = useState<string[]>([]);
  const [adapters, setAdapters] = useState<
    Array<{
      address: string;
      name: string;
      kind: 'lan' | 'virtual' | 'link-local';
    }>
  >([]);
  const [address, setAddress] = useState('');
  const [networkMessage, setNetworkMessage] = useState('');
  const refreshNetworkRef = useRef<(() => Promise<void>) | null>(null);
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
  const admission = useAdmission(
    role === 'player' && !credential,
    setCredential,
    setMessage,
    messages,
  );
  useEffect(() => {
    const socket = io({
      auth: credential ? { token: credential } : {},
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:sync');
      setMessage((current) => (current.startsWith('连接') ? '' : current));
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
        if (previous?.revision !== next.revision || next.playMode === 'test')
          setMotion([]);
        changedSlots.current = [];
        if (
          previous?.game?.id === next.game?.id &&
          previous?.gameView &&
          next.gameView &&
          next.playMode === 'play' &&
          previous.instanceId === next.instanceId &&
          previous.branch === next.branch
        ) {
          const client = next.game && getGameClient(next.game.id);
          changedSlots.current =
            client?.savedChanges(previous.gameView, next.gameView) ?? [];
        }
        if (
          !previous ||
          next.paused ||
          previous.status !== next.status ||
          previous.branch !== next.branch ||
          previous.instanceId !== next.instanceId
        ) {
          setMotion([]);
          setFeedback(null);
        }
        if (previous?.status === 'lobby' && next.gameView)
          navigate(`/${role}/game`);
        if (next.status === 'lobby' && location.pathname.endsWith('/game'))
          navigate(`/${role}`, true);
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
      if (current.paused) return;
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
      setMotion(current.playMode === 'test' ? [] : changedSlots.current);
      if (motionTimer.current) clearTimeout(motionTimer.current);
      if (current.playMode === 'play')
        motionTimer.current = setTimeout(
          () => setMotion([]),
          (current.game && getGameClient(current.game.id)?.motionDuration) ||
            1200,
        );
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
    let disposed = false;
    let networkRequest: AbortController | null = null;
    const refreshNetwork = async () => {
      if (networkRequest || role === 'player') return;
      const controller = new AbortController();
      networkRequest = controller;
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch('/api/room/network', {
          signal: controller.signal,
        });
        const network = NetworkSchema.parse(await response.json());
        if (disposed) return;
        setAddresses(network.addresses);
        setAdapters(network.adapters);
        setAddress((selected) => {
          const preferred =
            selected || localStorage.getItem('tablemax-address') || '';
          return network.addresses.includes(preferred)
            ? preferred
            : (network.addresses[0] ?? '');
        });
        setPort(network.port);
        setNetworkMessage(
          network.addresses.length
            ? ''
            : '未发现可用地址，请连接局域网后刷新。',
        );
      } catch {
        if (!disposed)
          setNetworkMessage('地址刷新失败，请检查电脑服务后重试。');
      } finally {
        clearTimeout(timeout);
        networkRequest = null;
      }
    };
    refreshNetworkRef.current = refreshNetwork;
    void refreshNetwork();
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refreshNetwork();
    }, 10000);
    const wake = () => {
      if (document.visibilityState === 'hidden') return;
      if (socket.connected) socket.emit('room:sync');
      else socket.connect();
      void refreshNetwork();
    };
    window.addEventListener('online', wake);
    window.addEventListener('pageshow', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      disposed = true;
      networkRequest?.abort();
      refreshNetworkRef.current = null;
      clearInterval(interval);
      window.removeEventListener('online', wake);
      window.removeEventListener('pageshow', wake);
      document.removeEventListener('visibilitychange', wake);
      // Changing identity closes the old socket deliberately. Its disconnect
      // message must not overwrite a successful admission result.
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
      setView(null);
      synced.current = null;
      socketRef.current = null;
      pending.current = null;
      if (motionTimer.current) clearTimeout(motionTimer.current);
    };
  }, [credential, role]);
  const isHost = view?.self.role === 'host';
  const self = view?.seats.find((s) => s.id === view.self.seatId);
  const locked = busy || admission.busy || !connected || !view;
  function send(envelope: Command) {
    pending.current = envelope;
    setBusy(true);
    setAwaitingConfirmation(false);
    setMessage('正在提交…');
    socketRef.current
      ?.timeout(5000)
      .emit('room:command', envelope, (error: Error | null, input: unknown) => {
        if (pending.current !== envelope) return;
        if (error) {
          setAwaitingConfirmation(true);
          setMessage('尚未收到保存确认，请重试确认。');
          socketRef.current?.emit('room:sync');
          return;
        }
        const parsed = CommandReplySchema.safeParse(input);
        if (!parsed.success) {
          setAwaitingConfirmation(true);
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
  return {
    role,
    view,
    connected,
    busy: busy || admission.busy,
    admissionPending: admission.pending,
    admissionAvatarId: admission.avatarId,
    retryAdmission: admission.retry,
    awaitingConfirmation,
    message,
    name,
    setName,
    addresses,
    adapters,
    networkMessage,
    refreshNetwork: () => refreshNetworkRef.current?.(),
    address,
    setAddress: (selected: string) => {
      localStorage.setItem('tablemax-address', selected);
      setAddress(selected);
    },
    port,
    feedback,
    errorId,
    motion,
    credential,
    isHost,
    canControl: view?.capabilities.control ?? false,
    self,
    locked,
    command,
    join: (avatarId?: AvatarId) => admission.join(name, avatarId),
    retry: () => {
      if (pending.current) send(pending.current);
    },
  };
}
export type RoomSession = ReturnType<typeof useRoomSession>;
