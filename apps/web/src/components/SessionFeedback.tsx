import type { RoomSession } from '../session/useRoomSession';
import { feedbackText } from '../content/feedback';
export function SessionFeedback({
  session,
  hideSaved = false,
  mode = 'all',
}: {
  session: RoomSession;
  hideSaved?: boolean;
  mode?: 'all' | 'saved' | 'messages';
}) {
  const saved = session.messageKind === 'saved';
  if (mode === 'saved')
    return (
      <span className="session-save-anchor">
        <span className="session-save-overlay" role="status" aria-live="polite">
          {saved ? session.message : ''}
        </span>
      </span>
    );
  const message =
    saved && (hideSaved || mode === 'messages')
      ? ''
      : session.message ||
        (session.connected ? '' : feedbackText('session.connecting'));
  if (!message && !session.admissionPending && !session.awaitingConfirmation)
    return null;
  return (
    <div className="session-feedback">
      {message && (
        <p
          className={`feedback ${session.messageKind === 'saved' ? 'saved-acknowledgement' : ''}`}
          aria-live="polite"
        >
          {message}
        </p>
      )}
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
