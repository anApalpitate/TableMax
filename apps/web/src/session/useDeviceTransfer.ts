import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TransferReplySchema,
  TransferRequestSchema,
  type TransferState,
} from '@tablemax/protocol';
import { randomId } from './randomId';

const storageKey = 'tablemax-device-transfer';
type Request = { seatId: string; requestKey: string; createdAt: number };
function load(): Request | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(storageKey) ?? 'null',
    ) as Request | null;
    return value &&
      Number.isSafeInteger(value.createdAt) &&
      TransferRequestSchema.safeParse({
        seatId: value.seatId,
        requestKey: value.requestKey,
      }).success
      ? value
      : null;
  } catch {
    return null;
  }
}
const reasons: Record<string, string> = {
  'invalid-seat': '原座位已不存在，请联系电脑管理员。',
  'transfer-request-limit': '换机申请较多，请管理员处理后再试。',
  'session-request-conflict': '申请座位不一致，请取消后重新选择。',
  'transfer-request-expired': '申请已过期，请重新申请。',
  'save-or-action-failed': '申请尚未确认保存，请重试原申请。',
};
export function useDeviceTransfer(
  enabled: boolean,
  acceptCredential: (token: string) => void,
) {
  const [request, setRequest] = useState<Request | null>(() =>
    enabled ? load() : null,
  );
  const [state, setState] = useState<TransferState | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const current = useRef(request);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const accept = useRef(acceptCredential);
  const known = useRef(false);
  useEffect(() => {
    accept.current = acceptCredential;
  }, [acceptCredential]);
  const clear = useCallback(() => {
    localStorage.removeItem(storageKey);
    current.current = null;
    if (mounted.current) setRequest(null);
  }, []);
  const run = useCallback(
    async (operation: 'request' | 'status' | 'cancel', input: Request) => {
      if (active.current || !mounted.current) return;
      const controller = new AbortController();
      active.current = controller;
      setBusy(true);
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(`/api/session/transfer/${operation}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
          body: JSON.stringify(
            operation === 'request'
              ? { seatId: input.seatId, requestKey: input.requestKey }
              : { requestKey: input.requestKey },
          ),
        });
        const parsed = TransferReplySchema.safeParse(await response.json());
        if (!parsed.success) throw new Error('invalid-transfer-reply');
        if (!mounted.current || current.current !== input) return;
        if (!parsed.data.ok) {
          setMessage(
            reasons[parsed.data.reason] ?? '换机未完成，请联系电脑管理员。',
          );
          if (
            ['invalid-seat', 'transfer-request-expired'].includes(
              parsed.data.reason,
            )
          )
            clear();
          return;
        }
        const next = parsed.data.transfer;
        known.current = true;
        setState(next);
        if (next.status === 'approved') {
          // Keep the proof until the replacement credential is stored successfully.
          accept.current(next.token);
          clear();
          setMessage('已接续原座位。');
        } else if (next.status === 'pending')
          setMessage('等待电脑管理员核对并批准。');
        else {
          clear();
          setMessage(
            {
              rejected: '管理员未批准本次换机。',
              cancelled: '已取消申请。',
              expired: '申请已过期，请重新申请。',
              revoked: '原座位或设备身份已变化，请重新申请。',
            }[next.status],
          );
        }
      } catch {
        if (mounted.current && current.current === input)
          setMessage('尚未收到换机确认，请重试原申请。');
      } finally {
        clearTimeout(timeout);
        if (active.current === controller) active.current = null;
        if (mounted.current) setBusy(false);
      }
    },
    [clear],
  );
  useEffect(() => {
    if (!enabled) return;
    mounted.current = true;
    const recover = () => {
      if (document.visibilityState === 'hidden' || !current.current) return;
      const value = current.current;
      void run(
        value.createdAt + 5 * 60_000 > Date.now() && !known.current
          ? 'request'
          : 'status',
        value,
      );
    };
    const initial = setTimeout(recover, 0);
    const timer = setInterval(recover, 2000);
    window.addEventListener('online', recover);
    window.addEventListener('pageshow', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      mounted.current = false;
      active.current?.abort();
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener('online', recover);
      window.removeEventListener('pageshow', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [enabled, run]);
  return {
    state,
    message,
    busy,
    pending: Boolean(request),
    seatId: request?.seatId,
    start: (seatId: string) => {
      if (!enabled || current.current || active.current) return;
      const value = { seatId, requestKey: randomId(32), createdAt: Date.now() };
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
        current.current = value;
        setRequest(value);
        setState(null);
        known.current = false;
        void run('request', value);
      } catch {
        setMessage('浏览器无法保存申请，请使用可保存身份的浏览器。');
      }
    },
    retry: () => {
      if (current.current)
        void run(
          current.current.createdAt + 5 * 60_000 > Date.now() && !state
            ? 'request'
            : 'status',
          current.current,
        );
    },
    cancel: () => {
      if (current.current) void run('cancel', current.current);
    },
  };
}
export type DeviceTransferSession = ReturnType<typeof useDeviceTransfer>;
