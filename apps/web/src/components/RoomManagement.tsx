import { useState } from 'react';
import type { Command } from '@tablemax/protocol';
import type { RoomSession } from '../session/useRoomSession';
import { RollbackHistory } from './RollbackHistory';
import { ConfirmationDialog } from './ConfirmationDialog';
import { PlayerBindingControl } from './PlayerBindingControl';
import { SessionFeedback } from './SessionFeedback';

export function RoomManagement({
  session,
  includeBindings = false,
}: {
  session: RoomSession;
  includeBindings?: boolean;
}) {
  const { view, locked, command, isHost } = session;
  const [confirmation, setConfirmation] = useState<'end' | 'clear' | null>(
    null,
  );
  if (!isHost || !view) return null;
  return (
    <section className="management">
      <SessionFeedback session={session} />
      {view.status === 'playing' && (
        <>
          <h3>房主管理</h3>
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
          <button
            className="danger end-game"
            disabled={locked}
            onClick={() => setConfirmation('end')}
          >
            结束游戏
          </button>
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
            开始下一局
          </button>
        ))}
      {view.status === 'lobby' && (
        <>
          <button
            className="secondary"
            disabled={locked}
            onClick={() => command({ type: 'join-open', open: !view.joinOpen })}
          >
            {view.joinOpen ? '关闭加入' : '开放加入'}
          </button>
          {view.seats.length > 0 && (
            <button
              className="secondary"
              disabled={locked}
              onClick={() => setConfirmation('clear')}
            >
              清空牌桌
            </button>
          )}
        </>
      )}
      {view.status === 'ended' && (
        <>
          <button disabled={locked} onClick={() => command({ type: 'replay' })}>
            原班人马再开一局
          </button>
          <button
            className="secondary"
            disabled={locked}
            onClick={() => setConfirmation('clear')}
          >
            清空牌桌
          </button>
        </>
      )}
      {includeBindings && <PlayerBindingControl session={session} />}
      {view.status !== 'lobby' && (
        <RollbackHistory key={view.instanceId} session={session} />
      )}
      <a
        className="button secondary"
        href={view.gameView ? '/public/game' : '/public'}
      >
        打开公共屏
      </a>
      {confirmation && (
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
              <p>当前游戏将立即结束，所有手机停止行动。</p>
              <p>
                已保存的状态和历史保留。结束后可原班重新准备，或通过决策点回退后恢复。
              </p>
            </>
          ) : (
            <p>
              所有手机身份和人机座位都将移除，朋友们需要重新扫码入座。当前牌桌状态与有效历史将清空。
            </p>
          )}
        </ConfirmationDialog>
      )}
    </section>
  );
}
