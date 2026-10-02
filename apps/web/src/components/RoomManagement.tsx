import type { Command } from '@tablemax/protocol';
import type { RoomSession } from '../session/useRoomSession';
import { RollbackHistory } from './RollbackHistory';
export function RoomManagement({ session }: { session: RoomSession }) {
  const { view, locked, command, bindingCode, isHost } = session;
  if (!isHost || !view) return null;
  return (
    <details className="management" open={Boolean(bindingCode)}>
      <summary>牌桌管理</summary>
      {view?.lifecycleActions.map((action, i) => (
        <button
          key={i}
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
      {view?.status === 'lobby' ? (
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
              onClick={() => {
                if (
                  confirm(
                    '清空牌桌？所有手机身份和电脑座位将移除，朋友需要重新入座。',
                  )
                )
                  command({ type: 'new-room' });
              }}
            >
              清空牌桌
            </button>
          )}
        </>
      ) : (
        <>
          {view?.status === 'playing' && (
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
              <button
                className="secondary"
                disabled={locked}
                onClick={() => {
                  if (confirm('结束当前对局？已保存状态和历史将保留。'))
                    command({ type: 'end' });
                }}
              >
                结束对局
              </button>
            </>
          )}
          {view?.status === 'ended' && (
            <button
              disabled={locked}
              onClick={() => command({ type: 'replay' })}
            >
              原班人马再开一局
            </button>
          )}
          {view.status === 'ended' && (
            <button
              className="secondary"
              disabled={locked}
              onClick={() => {
                if (
                  confirm(
                    '清空牌桌？所有手机身份和电脑座位将移除，朋友需要重新入座。',
                  )
                )
                  command({ type: 'new-room' });
              }}
            >
              清空牌桌
            </button>
          )}
          <RollbackHistory key={view.instanceId} session={session} />
        </>
      )}
      {bindingCode && (
        <details open>
          <summary>一次性换绑码 · 两分钟有效</summary>
          <p>交给对应玩家，原身份已撤销。</p>
          <textarea readOnly aria-label="一次性绑定码" value={bindingCode} />
        </details>
      )}
      <a
        className="button secondary"
        href={view.gameView ? '/public/game' : '/public'}
      >
        打开公共屏
      </a>
    </details>
  );
}
