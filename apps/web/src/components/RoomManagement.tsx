import type { Command } from '@tablemax/protocol';
import type { RoomSession } from '../session/useRoomSession';
export function RoomManagement({ session }: { session: RoomSession }) {
  const { view, locked, command, bindingCode, isHost } = session;
  if (!isHost || !view) return null;
  return (
    <details className="management" open={Boolean(bindingCode)}>
      <summary>更多房间设置</summary>
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
              onClick={() => command({ type: 'new-room' })}
            >
              创建新房间
            </button>
          )}
          <details>
            <summary>决策点回退（{view?.history.length}）</summary>
            <p>恢复到该选择之前。已看见的信息无法撤销；回退后保持暂停。</p>
            {view?.history
              .slice()
              .reverse()
              .map((h) => (
                <button
                  className="secondary"
                  key={h.id}
                  disabled={locked}
                  onClick={() => {
                    if (
                      confirm(
                        `恢复到“${h.label}”？后续选择将撤销，已揭示信息无法从记忆消除。`,
                      )
                    )
                      command({
                        type: 'rollback',
                        checkpointId: h.id,
                      });
                  }}
                >
                  {h.label}
                  {h.revealedInformation ? ' · 含揭示' : ''}
                </button>
              ))}
          </details>
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
      <a className="button secondary" href="/player">
        房主用独立玩家身份参与
      </a>
    </details>
  );
}
