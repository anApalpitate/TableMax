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
import type { PokemonView } from '../../../../games/pokemon-encounters/rules/project';
import {
  savedChanges,
  SAVED_MOTION_MS,
} from '../../../../games/pokemon-encounters/ui/motion';
import { navigate, type ScreenRole } from '../navigation';
const messages: Record<string, string> = {
  unauthorized: '此操作需要房主身份。',
  'invalid-identity': '身份已失效，请联系房主换绑。',
  'stale-branch': '历史已回退，请按最新状态重新选择。',
  'stale-revision': '状态已变化，请重新选择。',
  'stale-decision': '该选择已结束，请按最新状态操作。',
  'not-ready': '请等待至少两位玩家全部准备。',
  'joining-closed-or-full': '当前不能加入：牌桌已关闭入座、开始或满员。',
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
export function useRoomSession(role: ScreenRole) {
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
        if (previous?.revision !== next.revision) setMotion([]);
        changedSlots.current = [];
        if (
          previous?.gameView &&
          next.gameView &&
          previous.instanceId === next.instanceId &&
          previous.branch === next.branch
        ) {
          const before = previous.gameView as PokemonView,
            after = next.gameView as PokemonView;
          changedSlots.current = savedChanges(before, after);
        }
        if (
          !previous ||
          next.paused ||
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
      setMotion(changedSlots.current);
      if (motionTimer.current) clearTimeout(motionTimer.current);
      motionTimer.current = setTimeout(() => setMotion([]), SAVED_MOTION_MS);
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
      pending.current = null;
      if (motionTimer.current) clearTimeout(motionTimer.current);
    };
  }, [credential, role]);
  const isHost = view?.self.role === 'host';
  const self = view?.seats.find((s) => s.id === view.self.seatId);
  const locked = busy || !connected || !view;
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
            rebind ? { code: code.trim() } : { name: name.trim() },
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
  return {
    role,
    view,
    connected,
    busy,
    awaitingConfirmation,
    message,
    name,
    setName,
    code,
    setCode,
    bindingCode,
    addresses,
    address,
    setAddress,
    port,
    feedback,
    errorId,
    motion,
    credential,
    isHost,
    self,
    locked,
    command,
    join,
    retry: () => {
      if (pending.current) send(pending.current);
    },
  };
}
export type RoomSession = ReturnType<typeof useRoomSession>;
