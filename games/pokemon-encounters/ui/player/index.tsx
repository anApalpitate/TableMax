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
    } else {
      const next =
        actions.find(
          (a) => 'slot' in a && a.type !== 'mew-target' && a.slot === slot,
        ) ?? null;
      setSelection(
        JSON.stringify(next) === JSON.stringify(selection) ? null : next,
      );
    }
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
        ? '弃掉这张牌'
        : a.type === 'decline-ability'
          ? '跳过能力'
          : a.type === 'close-peek'
            ? '已看完，关闭查看'
            : a.type === 'swap'
              ? `交换位置 ${a.a + 1} 和 ${a.b + 1}`
              : a.type === 'mew-target'
                ? `选择 ${names[a.seat]} 的位置 ${a.slot + 1}`
                : 'slot' in a
                  ? `${a.type === 'initial-flip' ? '翻开' : a.type === 'peek' ? '查看' : '换入'}位置 ${a.slot + 1}`
                  : '下一局';
  return (
    <div className="pokemon-player">
      <span className="tag win-track">
        <span className="win-pips" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i < view.winsBySeat[seatId]! ? 'earned' : ''}>
              ✦
            </i>
          ))}
        </span>
        {view.winsBySeat[seatId]} / 3 胜
      </span>
      <p className="decision-hint">
        {view.phase === 'draw'
          ? '点上方牌堆，取一张新牌。'
          : view.phase === 'snorlax-choice'
            ? '点两张牌交换位置，或跳过能力。'
            : view.phase === 'mew-other'
              ? '先选一位朋友的牌，再换入自己的场地。'
              : view.phase === 'charizard-view'
                ? '记住这张牌，看完后关闭。'
                : '点选卡位，选好后确认。'}
      </p>
      {view.phase !== 'charizard-view' && (
        <Board
          view={view}
          seatId={seatId}
          slots={ownSlots}
          selected={selectedSlots}
          locked={locked}
          select={chooseOwn}
        />
      )}
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
                slots={actions.flatMap((a) =>
                  a.type === 'mew-target' && a.seat === seat ? [a.slot] : [],
                )}
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
          .filter(
            (a) => !('slot' in a) && a.type !== 'swap' && a.type !== 'draw',
          )
          .map((a) => (
            <button
              className="secondary"
              key={a.type + (a.type === 'draw' ? a.source : '')}
              disabled={locked}
              onClick={() => {
                choose(a);
              }}
            >
              {short(a)}
            </button>
          ))}
      </div>
      {ownSlots.length > 0 || view.phase === 'mew-other' ? (
        <div className="submit-choice">
          <p aria-live="polite">
            {selection
              ? short(selection)
              : first !== null
                ? '再选一个不同位置'
                : '选一张牌'}
          </p>
          <button
            className="confirm-action"
            disabled={locked || !selection}
            onClick={() => {
              if (selection) choose(selection);
            }}
          >
            {selection
              ? short(selection)
              : view.phase === 'initial-flip'
                ? '翻开这张'
                : view.phase === 'snorlax-choice'
                  ? '交换这两张'
                  : view.phase === 'charizard-choice'
                    ? '查看这张'
                    : view.phase === 'mew-other'
                      ? '选这张牌'
                      : '换入这里'}
          </button>
          {(selection || first !== null) && (
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
          )}
        </div>
      ) : null}
    </div>
  );
}
