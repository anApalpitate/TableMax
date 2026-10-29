import { Board, Card } from './Cards';
import type { PlayerDecisionProps } from './player-decision-contract';
export function DecisionField({ game, motion, decision }: PlayerDecisionProps) {
  const {
    actions,
    slots,
    exchange,
    setExchange,
    names,
    self,
    locked,
    choose,
    selectedType,
    working,
    chosenSeat,
    pairs,
    selectable,
    select,
    selectingSlots,
  } = decision;
  return (
    <>
      {working.some((a) => a.type === 'row-target') ? (
        <div className="ex-row-choice">
          <p>
            与 {names[chosenSeat]} 交换第{' '}
            {game.rowAbility === 'groudon'
              ? 3
              : game.rowAbility === 'kyogre'
                ? 2
                : 1}{' '}
            行，朝向随牌移动。
          </p>
          <Board game={game} seat={chosenSeat} />
        </div>
      ) : selectingSlots ? (
        <div className="ex-target-board">
          <div className="ex-target-heading">
            <strong>
              {chosenSeat === self ? '本人场地' : `${names[chosenSeat]}的场地`}
            </strong>
            <span>{pairs.length ? '选择两个不同位置' : '选择一个位置'}</span>
          </div>
          <Board
            game={game}
            seat={chosenSeat}
            selected={slots}
            selectable={selectable}
            select={select}
            locked={locked}
            motion={motion}
          />
          {selectedType === 'ninja-target' && (
            <div className="ex-branch">
              <button
                className={!exchange ? 'selected' : ''}
                onClick={() => setExchange(false)}
              >
                只盖回
              </button>
              <button
                className={exchange ? 'selected' : ''}
                onClick={() => setExchange(true)}
              >
                盖回并交换
              </button>
            </div>
          )}
        </div>
      ) : !game.peek ? (
        <div className="ex-target-board ex-own-board">
          <Board game={game} seat={self} motion={motion} />
        </div>
      ) : null}
      {game.peek && (
        <div className="ex-private-peek">
          <h3>仅本人可见</h3>
          <div>
            {game.peek.cards.map((p) => (
              <section key={p.slot}>
                <Card profile={game.rulesProfile} face={p.card} />
                <span>{p.slot + 1}号位</span>
                {actions.some(
                  (a) => a.type === 'mewtwo-exchange' && a.slot === p.slot,
                ) && (
                  <button
                    data-action="mewtwo-exchange"
                    data-slot-index={p.slot}
                    disabled={locked}
                    onClick={() =>
                      choose({ type: 'mewtwo-exchange', slot: p.slot })
                    }
                  >
                    与此牌交换
                  </button>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
