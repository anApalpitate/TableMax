import type { RoomSession } from '../session/useRoomSession';
import { feedbackText } from '../content/feedback';
export function SessionFeedback({
  session,
  hideSaved = false,
}: {
  session: RoomSession;
  hideSaved?: boolean;
}) {
  return (
    <div className="session-feedback">
      {!(hideSaved && session.messageKind === 'saved') && (
        <p
          className={`feedback ${session.messageKind === 'saved' ? 'saved-acknowledgement' : ''}`}
          aria-live="polite"
        >
          {session.message ||
            (session.connected ? '' : feedbackText('session.connecting'))}
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
