import { useCallback, useEffect, useRef, useState } from 'react';
import {
  JoinSchema,
  SessionReplySchema,
  type AvatarId,
} from '@tablemax/protocol';
import { randomId } from './randomId';
import { AdmissionRecovery, ADMISSION_TIMEOUT } from './admissionRecovery';
import { ROOM_SYNC_INTERVAL } from './reliableRoomSync';
import { feedbackReason, feedbackText } from '../content/feedback';

const storageKey = 'tablemax-admission';
type Admission = {
  kind: 'join';
  requestKey: string;
  value: string;
  createdAt: number;
  avatarId?: AvatarId;
  avatarImage?: string;
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
      avatarImage: value.avatarImage,
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
) {
  const [pending, setPending] = useState<Admission | null>(() =>
    enabled ? loadAdmission() : null,
  );
  const [busy, setBusy] = useState(false);
  const current = useRef(pending);
  const recovery = useRef(new AdmissionRecovery());
  const runRef = useRef<(request: Admission) => Promise<void>>(async () => {});
  const mounted = useRef(true);
  const run = useCallback(
    async (request: Admission) => {
      if (!mounted.current) return;
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
        setMessage(feedbackText('sessionErrors.session-request-expired'));
        return;
      }
      const attempt = recovery.current.begin();
      if (!attempt) return;
      const controller = attempt.controller;
      setBusy(true);
      setMessage(feedbackText('admission.joining'));
      const timeout = setTimeout(() => controller.abort(), ADMISSION_TIMEOUT);
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
            avatarImage: request.avatarImage,
          }),
        });
        const parsed = SessionReplySchema.safeParse(await response.json());
        if (!mounted.current || !recovery.current.isCurrent(attempt)) return;
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
              reply.duplicateName
                ? feedbackText('admission.duplicateName')
                : feedbackText('admission.joined'),
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
            setMessage(feedbackReason(reply.reason, 'admission.failed'));
        }
      } catch {
        if (mounted.current && recovery.current.isCurrent(attempt))
          setMessage(
            current.current
              ? feedbackText('admission.unconfirmed')
              : feedbackText('admission.storageFailed'),
          );
      } finally {
        clearTimeout(timeout);
        const finished = recovery.current.finish(attempt);
        if (mounted.current && finished.current) setBusy(false);
        if (
          mounted.current &&
          finished.recover &&
          current.current &&
          document.visibilityState !== 'hidden'
        )
          queueMicrotask(() => {
            if (mounted.current && current.current)
              void runRef.current(current.current);
          });
      }
    },
    [setCredential, setMessage],
  );
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  const cancel = useCallback(() => {
    recovery.current.cancel();
    current.current = null;
    localStorage.removeItem(storageKey);
    setPending(null);
    setBusy(false);
  }, []);
  useEffect(() => {
    mounted.current = enabled;
    if (!enabled) return;
    const gate = recovery.current;
    try {
      const previous = JSON.parse(
        localStorage.getItem(storageKey) ?? 'null',
      ) as { kind?: string } | null;
      if (previous?.kind === 'redeem') {
        localStorage.removeItem(storageKey);
        setMessage(feedbackText('admission.legacyTransferExpired'));
      }
    } catch {
      /* Invalid local data never becomes a new admission. */
    }
    const recover = () => {
      if (
        document.visibilityState !== 'hidden' &&
        current.current &&
        gate.recover()
      )
        void run(current.current);
    };
    const initialRecovery = setTimeout(() => {
      if (current.current) void run(current.current);
    }, 0);
    window.addEventListener('online', recover);
    window.addEventListener('pageshow', recover);
    document.addEventListener('visibilitychange', recover);
    const interval = setInterval(recover, ROOM_SYNC_INTERVAL);
    return () => {
      mounted.current = false;
      clearTimeout(initialRecovery);
      gate.cancel();
      clearInterval(interval);
      window.removeEventListener('online', recover);
      window.removeEventListener('pageshow', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [enabled, run, setMessage]);
  return {
    cancel,
    busy,
    pending: Boolean(pending),
    avatarId: pending?.avatarId,
    avatarImage: pending?.avatarImage,
    retry: () => {
      if (current.current) void run(current.current);
    },
    join: (value: string, avatarId?: AvatarId, avatarImage?: string) => {
      const request = current.current ??
        loadAdmission() ?? {
          kind: 'join' as const,
          value: value.trim(),
          createdAt: Date.now(),
          ...(avatarImage ? { avatarImage } : avatarId ? { avatarId } : {}),
          requestKey: randomId(32),
        };
      return run(request);
    },
  };
}
