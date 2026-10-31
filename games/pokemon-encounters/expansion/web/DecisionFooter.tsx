import { BufferCard } from './Cards';
import type { PlayerDecisionProps } from './player-decision-contract';
import { labels } from './view-model';
export function DecisionFooter({
  game,
  heldOptions,
  decision,
}: PlayerDecisionProps) {
  const {
    actions,
    mode,
    setMode,
    slots,
    setSlots,
    self,
    locked,
    choose,
    selectedType,
    working,
    candidates,
    chosen,
    selectingSlots,
    commandLabel,
  } = decision;
  return (
    <>
      <div className="ex-decision-footer">
        {working.some((a) => a.type === 'row-target') ? (
          <div className="ex-submit">
            <button
              data-action="row-target"
              disabled={locked}
              onClick={() => {
                const a = candidates.find((v) => v.type === 'row-target');
                if (a) choose(a);
              }}
            >
              确认交换这一整行
            </button>
          </div>
        ) : selectingSlots ? (
          <div className="ex-submit">
            <button
              data-action={selectedType}
              disabled={locked || !chosen}
              onClick={() => {
                if (chosen) choose(chosen);
              }}
            >
              {commandLabel}
              {slots.length > 0 && (
                <span className="ex-command-target">
                  {slots.map((s) => s + 1).join('、')}号位
                </span>
              )}
            </button>
          </div>
        ) : null}
        {heldOptions}
        {mode === 'reposition' && (
          <button
            className="secondary ex-cancel"
            onClick={() => {
              setMode('');
              setSlots([]);
            }}
          >
            取消换位
          </button>
        )}
        <div className="ex-simple-actions">
          {actions
            .filter((a) =>
              [
                'decline-ability',
                'close-peek',
                'activate-arceus',
                'extra-draw',
                'pass-direction',
              ].includes(a.type),
            )
            .map((a) => (
              <button
                key={'direction' in a ? a.direction : a.type}
                data-action={a.type}
                data-direction={'direction' in a ? a.direction : undefined}
                disabled={locked}
                className={a.type === 'decline-ability' ? 'secondary' : ''}
                onClick={() => choose(a)}
              >
                {'direction' in a
                  ? a.direction === 'clockwise'
                    ? '顺时针接力 ↻'
                    : '逆时针接力 ↺'
                  : a.type === 'decline-ability' &&
                      game.phase === 'mewtwo-choice'
                    ? '不交换'
                    : labels[a.type]}
              </button>
            ))}
        </div>
        {game.phase !== 'draw' && !game.held && (
          <BufferCard game={game} seat={self} />
        )}
      </div>
    </>
  );
}
