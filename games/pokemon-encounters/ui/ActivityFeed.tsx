import type { PokemonView } from '../rules/project';
import { cardArt } from '../../../assets/games/pokemon-encounters/catalog';
import { presentAction, tableTargetSummary } from './action-presentation';
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
  const art = action?.cardCategory ? cardArt(action.cardCategory) : null;
  const targetDetails = action?.targetDetails ?? [];
  const targetSummary = tableTargetSummary(targetDetails, game.seatOrder);
  return (
    <section
      className={`action-announcement compact-action ${latest?.action?.ability ? 'has-ability' : ''}`}
      aria-label="最新已保存操作"
      data-verb={latest?.action?.verb}
      data-actor={latest?.action?.actor ?? ''}
    >
      {art?.image ? (
        <img className="action-card-art" src={art.image} alt="" />
      ) : (
        <span className="action-symbol" aria-hidden="true">
          {game.roundResult ? '★' : '↻'}
        </span>
      )}
      <div
        className="action-copy"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="action-kicker">
          <span className="action-label">最近行动</span>
          {action && (
            <>
              {' '}
              <span className="action-actor">{action.actor}</span>
            </>
          )}
        </span>
        <strong className="action-title">
          {action ? (
            <>
              <span className="action-verb">{action.operation}</span>
              {action.subject && (
                <>
                  {' '}
                  <span className="action-subject">{action.subject}</span>
                </>
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
        {action && (
          <span className="action-detail">
            {action.sourceLabel && (
              <>
                <span className="action-source">
                  从{action.sourceLabel}
                </span>{' '}
              </>
            )}
            {action.abilityLabel && (
              <>
                <span className="action-ability">
                  {action.abilityLabel}能力
                </span>{' '}
              </>
            )}
            {action.targets.length > 0 && (
              <>
                <span className="action-targets action-targets-full">
                  {targetDetails.map((target, index) => (
                    <span
                      className="action-target-label"
                      key={index}
                      role="group"
                      aria-label={target.label}
                      title={target.label}
                    >
                      <span className="action-target-name" title={target.name}>
                        {target.name}
                      </span>{' '}
                      {target.slotsLabel && (
                        <span className="action-target-slots">
                          {target.slotsLabel}
                        </span>
                      )}
                    </span>
                  ))}
                </span>
                <span className="action-targets action-targets-mobile">
                  {targetSummary ? (
                    <span
                      className="action-target-label action-target-summary"
                      role="group"
                      aria-label={targetSummary.label}
                      title={targetSummary.label}
                    >
                      <span className="action-target-name">
                        {targetSummary.name}
                      </span>{' '}
                      <span className="action-target-slots">
                        {targetSummary.slotsLabel}
                      </span>
                    </span>
                  ) : (
                    targetDetails.map((target, index) => (
                      <span
                        className="action-target-label"
                        key={index}
                        role="group"
                        aria-label={target.label}
                        title={target.label}
                      >
                        <span
                          className="action-target-name"
                          title={target.name}
                        >
                          {target.seat === latest?.action?.actor
                            ? '本人'
                            : target.name}
                        </span>{' '}
                        {target.slotsLabel && (
                          <span className="action-target-slots">
                            {target.slotsLabel}
                          </span>
                        )}
                      </span>
                    ))
                  )}
                </span>
              </>
            )}
            {action.note && <span className="action-note">{action.note}</span>}
          </span>
        )}
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
