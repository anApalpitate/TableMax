import type { RoomSession } from '../session/useRoomSession';
export function SessionFeedback({ session }: { session: RoomSession }) {
  return (
    <div className="session-feedback">
      <p
        className={`feedback ${session.message === '已保存' ? 'saved-acknowledgement' : ''}`}
        aria-live="polite"
      >
        {session.message || (session.connected ? '' : '正在连接本地服务…')}
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
