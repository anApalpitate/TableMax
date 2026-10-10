import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TransferReplySchema,
  TransferRequestSchema,
  type TransferState,
} from '@tablemax/protocol';
import { randomId } from './randomId';
import { feedbackReason, feedbackText } from '../content/feedback';

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
            feedbackReason(
              parsed.data.reason,
              'transfer.failed',
              'transferErrors',
            ),
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
          setMessage(feedbackText('transferStatus.approved'));
        } else if (next.status === 'pending')
          setMessage(feedbackText('transferStatus.pending'));
        else {
          clear();
          setMessage(
            {
              rejected: feedbackText('transferStatus.rejected'),
              cancelled: feedbackText('transferStatus.cancelled'),
              expired: feedbackText('transferErrors.transfer-request-expired'),
              revoked: feedbackText('transferStatus.revoked'),
            }[next.status],
          );
        }
      } catch {
        if (mounted.current && current.current === input)
          setMessage(feedbackText('transfer.unconfirmed'));
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
        setMessage(feedbackText('transfer.storageFailed'));
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
