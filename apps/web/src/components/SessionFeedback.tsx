import type { RoomSession } from '../session/useRoomSession';
export function SessionFeedback({ session }: { session: RoomSession }) {
  return (
    <div className="session-feedback">
      <p className="feedback" aria-live="polite">
        {session.message || (session.connected ? '' : '正在连接本地服务…')}
      </p>
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
