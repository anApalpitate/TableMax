import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RoomSession } from '../session/useRoomSession';
import { ConfirmationDialog } from './ConfirmationDialog';
import { feedbackText } from '../content/feedback';
import { useNotifications } from './notifications/context';

/** Both entry points use the current projection, never a captured seat object. */
export function useSeatRemoval(session: RoomSession) {
  const notifications = useNotifications();
  const latest = useRef(session);
  useLayoutEffect(() => {
    latest.current = session;
  }, [session]);
  const [target, setTarget] = useState<{
    id: string;
    quick: boolean;
    instance: string;
    branch: number;
  } | null>(null);
  const sent = useRef<string | null>(null);
  const eligible = (current: RoomSession, id: string, quick: boolean) => {
    const seat = current.view?.seats.find((s) => s.id === id);
    return current.canManageSeats &&
      seat &&
      (current.isHost || seat.id !== current.view?.self.seatId) &&
      (!quick || seat.controller === 'bot' || !seat.online)
      ? seat
      : null;
  };
  const submit = (id: string, quick: boolean) => {
    const current = latest.current;
    const key = `${current.view?.instanceId}:${current.view?.branch}:${current.view?.revision}:${id}:${current.errorId}`;
    if (
      sent.current === key ||
      current.locked ||
      current.view?.status === 'playing' ||
      !eligible(current, id, quick)
    )
      return;
    sent.current = key;
    current.command({ type: 'remove-seat', seatId: id });
    setTarget(null);
  };
  const request = (id: string, quick = false) => {
    const current = latest.current;
    const seat = eligible(current, id, quick);
    if (!seat || current.locked || current.busy || current.awaitingConfirmation)
      return;
    if (current.view?.status === 'playing') {
      notifications?.show(feedbackText('seats.removeWhilePlaying'), 'info');
      return;
    }
    if (quick && seat.controller === 'bot') submit(id, quick);
    else
      setTarget({
        id,
        quick,
        instance: current.view!.instanceId,
        branch: current.view!.branch,
      });
  };
  const seat = target && eligible(session, target.id, target.quick);
  const valid =
    seat &&
    session.view?.instanceId === target?.instance &&
    session.view?.branch === target?.branch;
  useEffect(() => {
    if (!target || valid) return;
    const timer = setTimeout(() => setTarget(null), 0);
    return () => clearTimeout(timer);
  }, [target, valid]);
  return {
    request,
    confirmation:
      target && valid ? (
        <ConfirmationDialog
          title="移除座位"
          confirmLabel="确认移除"
          cancel={() => setTarget(null)}
          disabled={session.locked || session.view?.status === 'playing'}
          confirm={() => {
            if (
              latest.current.view?.instanceId !== target.instance ||
              latest.current.view?.branch !== target.branch
            )
              return;
            submit(target.id, target.quick);
          }}
        >
          <p>
            {feedbackText(
              seat.controller === 'human'
                ? 'seats.confirmRemoveHuman'
                : 'seats.confirmRemoveBot',
              { player: seat.name },
            )}
          </p>
        </ConfirmationDialog>
      ) : null,
  };
}
