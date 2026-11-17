import { useState } from 'react';
import type { Command } from '@tablemax/protocol';
import type { RoomSession } from '../session/useRoomSession';
import { ConfirmationDialog } from './ConfirmationDialog';
import { BoxOverlayPanel } from './BoxOverlayPanel';
import { SessionFeedback } from './SessionFeedback';
import { OwnerControl } from './OwnerControl';
import { DeviceTransferRequests } from './DeviceTransfer';
import { feedbackText } from '../content/feedback';
import './room-management.css';
import './settings-panel.css';

export function RoomManagementControl({
  session,
  lifecycleLabel,
  returnToLobby = false,
}: {
  session: RoomSession;
  lifecycleLabel?: string;
  returnToLobby?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (session.role !== 'host' || !session.isHost || !session.canControl)
    return null;
  return (
    <>
      <button
        type="button"
        className="secondary room-management-control"
        aria-label="牌桌管理"
        title="牌桌管理"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="7" width="18" height="10" rx="4" />
          <path d="M9 3h6M9 21h6M9 12h6" />
        </svg>
      </button>
      {open && (
        <BoxOverlayPanel
          title="牌桌管理"
          className="settings-panel room-management-panel"
          close={() => setOpen(false)}
        >
          <RoomManagement
            session={session}
            {...(lifecycleLabel === undefined ? {} : { lifecycleLabel })}
            hideSaved
            returnToLobby={returnToLobby}
          />
        </BoxOverlayPanel>
      )}
    </>
  );
}

export function RoomManagement({
  session,
  lifecycleLabel = '开始下一局',
  display = 'full',
  hideSaved = false,
  returnToLobby = false,
}: {
  session: RoomSession;
  lifecycleLabel?: string;
  display?: 'full' | 'actions' | 'details';
  hideSaved?: boolean;
  returnToLobby?: boolean;
}) {
  const { view, locked, command, isHost, canControl } = session;
  const [confirmation, setConfirmation] = useState<'end' | 'clear' | null>(
    null,
  );
  if (!canControl || !view) return null;
  const showActions = display !== 'details';
  const showDetails = display !== 'actions';
  const actions = (
    <>
      {view.status === 'playing' && (
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
      {view.status === 'playing' &&
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
      {isHost && view.status === 'lobby' && (
        <button
          className="secondary"
          disabled={locked || !view.game}
          onClick={() => command({ type: 'join-open', open: !view.joinOpen })}
        >
          {view.joinOpen ? '关闭加入' : '开放加入'}
        </button>
      )}
      {view.status === 'ended' && (
        <button disabled={locked} onClick={() => command({ type: 'replay' })}>
          {feedbackText('management.resumeJoining')}
        </button>
      )}
      {isHost && view.status !== 'playing' && view.seats.length > 0 && (
        <button
          className="secondary room-actions-clear"
          disabled={locked}
          onClick={() => setConfirmation('clear')}
        >
          清空牌桌
        </button>
      )}
    </>
  );
  return (
    <section
      className={`management${display === 'actions' ? ' room-actions' : ' room-management-details'}`}
      aria-label={display === 'actions' ? '牌桌操作' : '牌桌管理'}
    >
      {display === 'full' && (
        <SessionFeedback session={session} hideSaved={hideSaved} />
      )}
      {display === 'full' ? (
        <div className="room-management-action-group">
          <h3>对局操作</h3>
          <div className="room-management-action-buttons">{actions}</div>
        </div>
      ) : (
        showActions && actions
      )}
      {showDetails && isHost && (
        <div className="room-management-section">
          {display === 'full' && <h3>玩家与设备</h3>}
          <OwnerControl session={session} />
          <DeviceTransferRequests session={session} />
        </div>
      )}
      {confirmation && isHost && (
        <ConfirmationDialog
          title={confirmation === 'end' ? '结束游戏' : '清空牌桌'}
          cancel={() => setConfirmation(null)}
          disabled={
            locked ||
            (confirmation === 'end' && view.status !== 'playing') ||
            (confirmation === 'clear' && view.status === 'playing')
          }
          confirm={() => {
            command(
              confirmation === 'end'
                ? {
                    type: 'end',
                    ...(returnToLobby ? { returnToLobby: true as const } : {}),
                  }
                : { type: 'new-room' },
            );
            setConfirmation(null);
          }}
        >
          {confirmation === 'clear' && (
            <p>{feedbackText('management.confirmClear')}</p>
          )}
        </ConfirmationDialog>
      )}
    </section>
  );
}
