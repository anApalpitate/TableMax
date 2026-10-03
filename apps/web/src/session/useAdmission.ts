import { useCallback, useEffect, useRef, useState } from 'react';
import {
  JoinSchema,
  SessionReplySchema,
  type AvatarId,
} from '@tablemax/protocol';

const storageKey = 'tablemax-admission';
type Admission = {
  kind: 'join';
  requestKey: string;
  value: string;
  createdAt: number;
  avatarId?: AvatarId;
};
function loadAdmission(): Admission | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(storageKey) ?? 'null',
    ) as Admission | null;
    if (
      !value ||
      value.kind !== 'join' ||
      !Number.isSafeInteger(value.createdAt)
    )
      return null;
    const body = {
      name: value.value,
      requestKey: value.requestKey,
      avatarId: value.avatarId,
    };
    if (!JoinSchema.safeParse(body).success || !value.requestKey) return null;
    return value;
  } catch {
    return null;
  }
}
export function useAdmission(
  enabled: boolean,
  setCredential: (token: string) => void,
  setMessage: (message: string) => void,
  messages: Record<string, string>,
) {
  const [pending, setPending] = useState<Admission | null>(() =>
    enabled ? loadAdmission() : null,
  );
  const [busy, setBusy] = useState(false);
  const current = useRef(pending);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const run = useCallback(
    async (request: Admission) => {
      if (active.current) return;
      // Do not automatically resubmit an old request after the server's
      // recovery window: its receipt may already have been pruned.
      if (request.createdAt + 24 * 60 * 60 * 1000 <= Date.now()) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* No request is sent. */
        }
        current.current = null;
        setPending(null);
        setMessage(messages['session-request-expired']!);
        return;
      }
      const controller = new AbortController();
      active.current = controller;
      setBusy(true);
      setMessage('正在入座…');
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        // Persist before sending. Reload and uncertain replies reuse this key.
        localStorage.setItem(storageKey, JSON.stringify(request));
        current.current = request;
        setPending(request);
        const response = await fetch('/api/session/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            name: request.value,
            requestKey: request.requestKey,
            avatarId: request.avatarId,
          }),
        });
        const parsed = SessionReplySchema.safeParse(await response.json());
        if (!parsed.success) throw new Error('invalid-session-reply');
        const reply = parsed.data;
        if (reply.ok) {
          localStorage.setItem('tablemax-player', reply.token);
          localStorage.removeItem(storageKey);
          current.current = null;
          if (mounted.current) {
            setPending(null);
            setCredential(reply.token);
            setMessage(
              reply.duplicateName ? '已有同名朋友，以座位编号区分。' : '已入座',
            );
          }
        } else {
          // A storage failure may follow an earlier committed but lost response.
          // Preserve that operation until its original confirmation is recovered.
          if (reply.reason !== 'save-or-action-failed') {
            localStorage.removeItem(storageKey);
            current.current = null;
            if (mounted.current) setPending(null);
          }
          if (mounted.current)
            setMessage(
              messages[reply.reason] ??
                '入座未完成，请联系电脑管理员检查牌桌。',
            );
        }
      } catch {
        if (mounted.current)
          setMessage(
            current.current
              ? '尚未收到入座确认。可重试原请求，刷新也不会重复占座。'
              : '浏览器无法保存身份，请在系统浏览器中打开。',
          );
      } finally {
        clearTimeout(timeout);
        active.current = null;
        if (mounted.current) setBusy(false);
      }
    },
    [setCredential, setMessage, messages],
  );
  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    try {
      const previous = JSON.parse(
        localStorage.getItem(storageKey) ?? 'null',
      ) as { kind?: string } | null;
      if (previous?.kind === 'redeem') {
        localStorage.removeItem(storageKey);
        setMessage('换手机功能已移除，请使用原浏览器检查原座位。');
      }
    } catch {
      /* Invalid local data never becomes a new admission. */
    }
    const recover = () => {
      if (document.visibilityState !== 'hidden' && current.current)
        void run(current.current);
    };
    const initialRecovery = setTimeout(() => {
      if (current.current) void run(current.current);
    }, 0);
    window.addEventListener('online', recover);
    window.addEventListener('pageshow', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      mounted.current = false;
      clearTimeout(initialRecovery);
      active.current?.abort();
      window.removeEventListener('online', recover);
      window.removeEventListener('pageshow', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [enabled, run, setMessage]);
  return {
    busy,
    pending: Boolean(pending),
    avatarId: pending?.avatarId,
    retry: () => {
      if (current.current) void run(current.current);
    },
    join: (value: string, avatarId?: AvatarId) => {
      const request = current.current ??
        loadAdmission() ?? {
          kind: 'join' as const,
          value: value.trim(),
          createdAt: Date.now(),
          ...(avatarId ? { avatarId } : {}),
          requestKey: Array.from(
            crypto.getRandomValues(new Uint8Array(32)),
            (byte) => byte.toString(16).padStart(2, '0'),
          ).join(''),
        };
      return run(request);
    },
  };
}
