import { useEffect } from 'react';
import type { RoomSession } from '../session/useRoomSession';
import { useNotifications } from './notifications/context';
import { feedbackText } from '../content/feedback';

export function BoxFeedback({ session }: { session: RoomSession }) {
  const notifications = useNotifications();
  const { message, messageKind, errorId, connected } = session;
  const progress = messageKind === 'progress';
  const connectionMessage = messageKind === 'connection';
  useEffect(() => {
    if (!message || progress || connectionMessage || messageKind === 'saved')
      return;
    notifications?.show(
      message,
      messageKind === 'success' ? 'success' : 'error',
    );
  }, [
    message,
    messageKind,
    errorId,
    progress,
    connectionMessage,
    notifications,
  ]);
  const persistent =
    !connected ||
    connectionMessage ||
    progress ||
    session.admissionPending ||
    session.awaitingConfirmation;
  if (!persistent) return null;
  return (
    <div className="session-feedback">
      <p className="feedback" role="status">
        {!connected && !connectionMessage
          ? feedbackText('session.connecting')
          : message}
      </p>
      {session.admissionPending && (
        <button
          className="secondary"
          disabled={session.busy}
          onClick={session.retryAdmission}
        >
          {session.busy ? '等待入座确认…' : '重试入座确认'}
        </button>
      )}
      {session.awaitingConfirmation && (
        <button
          className="secondary"
          disabled={!session.connected}
          onClick={session.retry}
        >
          重试确认
        </button>
      )}
    </div>
  );
}
