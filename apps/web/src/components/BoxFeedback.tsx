import { useEffect } from 'react';
import type { RoomSession } from '../session/useRoomSession';
import { useNotifications } from './notifications/context';

export function BoxFeedback({ session }: { session: RoomSession }) {
  const notifications = useNotifications();
  const { message, errorId, connected } = session;
  const progress = message === '正在入座…' || message === '正在提交…';
  const connectionMessage =
    message.startsWith('连接') || message.startsWith('正在重新同步');
  useEffect(() => {
    if (!message || progress || connectionMessage || message === '已保存')
      return;
    notifications?.show(
      message,
      message === '已入座' || message.startsWith('已有同名朋友')
        ? 'success'
        : 'error',
    );
  }, [message, errorId, progress, connectionMessage, notifications]);
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
        {!connected && !connectionMessage ? '正在连接本地服务…' : message}
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
