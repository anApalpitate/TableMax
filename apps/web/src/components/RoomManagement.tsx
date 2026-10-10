import { useState } from 'react';
import type { Command } from '@tablemax/protocol';
import type { RoomSession } from '../session/useRoomSession';
import { RollbackHistory } from './RollbackHistory';
import { ConfirmationDialog } from './ConfirmationDialog';
import { SessionFeedback } from './SessionFeedback';
import { OwnerControl } from './OwnerControl';
import { DeviceTransferRequests } from './DeviceTransfer';
import { feedbackText } from '../content/feedback';
import './room-management.css';

export function RoomManagement({
  session,
  lifecycleLabel = '开始下一局',
  display = 'full',
}: {
  session: RoomSession;
  lifecycleLabel?: string;
  display?: 'full' | 'actions' | 'details';
}) {
  const { view, locked, command, isHost, canControl } = session;
  const [confirmation, setConfirmation] = useState<'end' | 'clear' | null>(
    null,
  );
  if (!canControl || !view) return null;
  const showActions = display !== 'details';
  const showDetails = display !== 'actions';
  return (
    <section
      className={`management${display === 'actions' ? ' room-actions' : ' room-management-details'}`}
      aria-label={display === 'actions' ? '牌桌操作' : '牌桌管理'}
    >
      {display === 'full' && <SessionFeedback session={session} />}
      {display === 'full' && <h3>{isHost ? '管理员设置' : '房主控制'}</h3>}
      {showDetails && isHost && (
        <div className="room-management-section">
          <OwnerControl session={session} />
        </div>
      )}
      {showDetails && isHost && (
        <div className="room-management-section">
          <DeviceTransferRequests session={session} />
        </div>
      )}
      {showActions && view.status === 'playing' && (
        <>
          <button
            disabled={locked}
            onClick={() =>
              command({
                type: view.paused || view.botError ? 'resume' : 'pause',
              })
            }
          >
            {view.paused || view.botError ? '恢复游戏' : '暂停游戏'}
          </button>
          {isHost && (
            <button
              className="danger end-game"
              disabled={locked}
              onClick={() => setConfirmation('end')}
            >
              结束游戏
            </button>
          )}
        </>
      )}
      {showActions &&
        view.status === 'playing' &&
        !view.paused &&
        view.lifecycleActions.map((action, index) => (
          <button
            key={index}
            disabled={locked}
            onClick={() =>
              command({
                type: 'lifecycle',
                action: action as Extract<
                  Command['command'],
                  { type: 'lifecycle' }
                >['action'],
              })
            }
          >
            {lifecycleLabel}
          </button>
        ))}
      {showActions && isHost && view.status === 'lobby' && (
        <button
          className="secondary"
          disabled={locked || !view.game}
          onClick={() => command({ type: 'join-open', open: !view.joinOpen })}
        >
          {view.joinOpen ? '关闭加入' : '开放加入'}
        </button>
      )}
      {showActions && view.status === 'ended' && (
        <button disabled={locked} onClick={() => command({ type: 'replay' })}>
          {display === 'full' ? '原班人马再开一局' : '再玩一局'}
        </button>
      )}
      {showActions &&
        isHost &&
        view.status !== 'playing' &&
        view.seats.length > 0 && (
          <button
            className="secondary room-actions-clear"
            disabled={locked}
            onClick={() => setConfirmation('clear')}
          >
            清空牌桌
          </button>
        )}
      {showDetails && isHost && view.status !== 'lobby' && (
        <RollbackHistory key={view.instanceId} session={session} />
      )}
      {showDetails && isHost && (
        <a
          className="button secondary"
          href={view.gameView ? '/public/game' : '/public'}
        >
          打开公共屏
        </a>
      )}
      {confirmation && isHost && (
        <ConfirmationDialog
          title={confirmation === 'end' ? '结束游戏' : '清空牌桌'}
          confirmLabel={
            confirmation === 'end' ? '确认结束游戏' : '确认清空牌桌'
          }
          cancel={() => setConfirmation(null)}
          disabled={
            locked ||
            (confirmation === 'end' && view.status !== 'playing') ||
            (confirmation === 'clear' && view.status === 'playing')
          }
          confirm={() => {
            command({ type: confirmation === 'end' ? 'end' : 'new-room' });
            setConfirmation(null);
          }}
        >
          {confirmation === 'end' ? (
            <>
              <p>{feedbackText('management.confirmEnd')}</p>
              <p>{feedbackText('management.endEffect')}</p>
            </>
          ) : (
            <p>{feedbackText('management.confirmClear')}</p>
          )}
        </ConfirmationDialog>
      )}
    </section>
  );
}
