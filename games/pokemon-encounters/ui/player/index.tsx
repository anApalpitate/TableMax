import { useState } from 'react';
import type { JsonValue } from '@tablemax/game-sdk';
import type { Action } from '../../rules';
import type { PokemonView } from '../../rules/project';
import { Board, CardFace } from '../cards';
import { phaseLabels } from '../phases';

export function PlayerControls({
  view,
  seatId,
  names,
  actions: input,
  locked,
  choose,
}: {
  view: PokemonView;
  seatId: string;
  names: Record<string, string>;
  actions: readonly JsonValue[];
  locked: boolean;
  choose(action: JsonValue): void;
}) {
  const actions = input as readonly Action[];
  const [selection, setSelection] = useState<Action | null>(null);
  const [first, setFirst] = useState<number | null>(null);
  const chooseOwn = (slot: number) => {
    if (view.phase === 'snorlax-choice') {
      if (first === null || first === slot) {
        setFirst(first === slot ? null : slot);
        setSelection(null);
      } else {
        setSelection(
          actions.find(
            (a) =>
              a.type === 'swap' &&
              a.a === Math.min(first, slot) &&
              a.b === Math.max(first, slot),
          ) ?? null,
        );
      }
    } else
      setSelection(
        actions.find(
          (a) => 'slot' in a && a.type !== 'mew-target' && a.slot === slot,
        ) ?? null,
      );
  };
  const ownSlots =
    view.phase === 'snorlax-choice'
      ? [0, 1, 2, 3, 4, 5]
      : actions.flatMap((a) =>
          'slot' in a && a.type !== 'mew-target' ? [a.slot] : [],
        );
  const selectedSlots =
    selection && 'slot' in selection && selection.type !== 'mew-target'
      ? [selection.slot]
      : selection?.type === 'swap'
        ? [selection.a, selection.b]
        : first === null
          ? []
          : [first];
  const short = (a: Action) =>
    a.type === 'draw'
      ? `从${a.source === 'deck' ? '牌库' : '弃牌顶'}取牌`
      : a.type === 'discard-held'
        ? '直接弃掉暂持牌'
        : a.type === 'decline-ability'
          ? '不发动能力'
          : a.type === 'close-peek'
            ? '已看完，关闭查看'
            : a.type === 'swap'
              ? `交换位置 ${a.a + 1} 和 ${a.b + 1}`
              : a.type === 'mew-target'
                ? `选择 ${names[a.seat]} 的位置 ${a.slot + 1}`
                : 'slot' in a
                  ? `选择位置 ${a.slot + 1}`
                  : '下一局';
  return (
    <div className="pokemon-player">
      <span className="tag">{view.winsBySeat[seatId]} / 3 胜</span>
      <Board
        view={view}
        seatId={seatId}
        slots={ownSlots}
        selected={selectedSlots}
        locked={locked}
        select={chooseOwn}
      />
      <h3>{phaseLabels[view.phase]}</h3>
      {view.peek && (
        <div className="private-peek" role="status">
          <p>仅你可见 · 位置 {view.peek.slot + 1} · 牌仍朝下</p>
          <CardFace card={view.peek.card} />
        </div>
      )}
      {view.phase === 'mew-other' &&
        view.seatOrder
          .filter((seat) => seat !== seatId)
          .map((seat) => (
            <section key={seat} className="target-board">
              <h4>{names[seat]}</h4>
              <Board
                view={view}
                seatId={seat}
                slots={[0, 1, 2, 3, 4, 5]}
                selected={
                  selection?.type === 'mew-target' && selection.seat === seat
                    ? [selection.slot]
                    : []
                }
                locked={locked}
                select={(slot) =>
                  setSelection(
                    actions.find(
                      (a) =>
                        a.type === 'mew-target' &&
                        a.seat === seat &&
                        a.slot === slot,
                    ) ?? null,
                  )
                }
              />
            </section>
          ))}
      <div className="intent-actions">
        {actions
          .filter((a) => !('slot' in a) && a.type !== 'swap')
          .map((a) => (
            <button
              className="secondary"
              key={a.type + (a.type === 'draw' ? a.source : '')}
              disabled={locked}
              aria-pressed={JSON.stringify(a) === JSON.stringify(selection)}
              onClick={() => {
                setSelection(a);
                setFirst(null);
              }}
            >
              {short(a)}
            </button>
          ))}
      </div>
      <div className="submit-choice">
        <p aria-live="polite">
          {selection
            ? short(selection)
            : first !== null
              ? '再选一个不同位置'
              : '先选择，再确认提交'}
        </p>
        <button
          disabled={locked || !selection}
          onClick={() => {
            if (selection) choose(selection);
          }}
        >
          确认提交
        </button>
        <button
          className="secondary"
          disabled={locked || (!selection && first === null)}
          onClick={() => {
            setSelection(null);
            setFirst(null);
          }}
        >
          取消选择
        </button>
      </div>
    </div>
  );
}
