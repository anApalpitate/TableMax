import type { PokemonView } from '../rules/project';
import { presentAction } from './action-presentation';
import { useId, useRef } from 'react';

export function ActivityFeed({
  game,
  names,
}: {
  game: PokemonView;
  names: Record<string, string>;
}) {
  const history = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const latest = game.events.at(-1);
  const action = latest?.action ? presentAction(latest.action, names) : null;
  return (
    <section
      className={`action-announcement compact-action ${latest?.action?.ability ? 'has-ability' : ''}`}
      aria-label="最新已保存操作"
      data-verb={latest?.action?.verb}
      data-actor={latest?.action?.actor ?? ''}
    >
      <div
        className="action-copy"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {action && <span className="action-actor">{action.actor}</span>}
        <strong className="action-title">
          {action ? (
            <>
              <span>{action.operation}</span>{' '}
              {action.subject && action.subject !== '卡牌' && (
                <span>{action.subject}</span>
              )}
            </>
          ) : (
            latest?.text.replaceAll(' · ', ' ') ||
            (game.roundResult
              ? game.matchWinners.length
                ? '大局已结束'
                : '本小局已揭晓'
              : '暂无保存行动')
          )}
        </strong>
      </div>
      <button
        className="secondary recent-actions"
        onClick={() => history.current?.showModal()}
        aria-label="查看最近操作"
      >
        记录
      </button>
      <dialog
        ref={history}
        className="card-gallery-panel action-history-panel"
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            history.current?.close();
        }}
      >
        <header className="gallery-heading">
          <h2 id={titleId}>最近操作</h2>
          <button
            className="secondary"
            onClick={() => history.current?.close()}
          >
            关闭
          </button>
        </header>
        <ol className="recent-action-list">
          {game.events
            .slice()
            .reverse()
            .map((event) => {
              const item = event.action
                ? presentAction(event.action, names)
                : null;
              return (
                <li key={event.id}>
                  <strong>{item?.actor ?? '牌桌'}</strong>
                  <span>
                    {item?.title ?? event.text.replaceAll(' · ', ' ')}
                  </span>
                  {item?.detail && <small>{item.detail}</small>}
                </li>
              );
            })}
        </ol>
      </dialog>
    </section>
  );
}
