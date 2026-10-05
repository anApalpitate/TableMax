import { useState, useContext } from 'react';
import { SavedMotion } from '../motion';
import type { JsonValue } from '@tablemax/game-sdk';
import type { Action } from '../../rules';
import type { PokemonView } from '../../rules/project';
import { Board, CardFace } from '../cards';
import { WinTrack } from '../WinTrack';
import { topology } from '../../shared/topology';
import { original } from '../../variants/original';
import { decisionGuidance } from '../decision-guidance';
import { DecisionHint } from '../DecisionHint';

export function PlayerControls({
  view,
  seatId,
  names,
  actions: input,
  locked,
  choose,
  showRules,
  guidanceEnabled = false,
}: {
  view: PokemonView;
  seatId: string;
  names: Record<string, string>;
  actions: readonly JsonValue[];
  locked: boolean;
  choose(action: JsonValue): void;
  showRules?: ((chapter: string) => void) | undefined;
  guidanceEnabled?: boolean;
}) {
  const actions = input as readonly Action[];
  const motion = useContext(SavedMotion);
  const [selection, setSelection] = useState<Action | null>(null);
  const [first, setFirst] = useState<number | null>(null);
  const targets = view.seatOrder.filter((seat) =>
    actions.some(
      (action) => action.type === 'mew-target' && action.seat === seat,
    ),
  );
  const [target, setTarget] = useState(targets[0] ?? '');
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
      ? topology(original.layout).slots
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
            ? '查看完成，关闭暗牌查看'
            : a.type === 'swap'
              ? `交换位置 ${a.a + 1} 和 ${a.b + 1}`
              : a.type === 'mew-target'
                ? `选择 ${names[a.seat]} 的位置 ${a.slot + 1}`
                : 'slot' in a
                  ? `${a.type === 'initial-flip' ? '翻开' : a.type === 'peek' ? '查看' : '换入'}位置 ${a.slot + 1}`
                  : '下一局';
  const intentActions = actions.filter(
    (a) =>
      !('slot' in a) &&
      a.type !== 'swap' &&
      a.type !== 'draw' &&
      a.type !== 'close-peek',
  );
  const intentButtons = intentActions.map((a) => (
    <button
      className={
        a.type === 'discard-held'
          ? 'intent-action discard-held-action'
          : 'intent-action secondary'
      }
      key={a.type}
      aria-label={short(a)}
      disabled={locked}
      onClick={() => choose(a)}
    >
      {a.type === 'discard-held'
        ? '弃掉'
        : a.type === 'decline-ability'
          ? '不发动'
          : short(a)}
    </button>
  ));
  return (
    <div className="pokemon-player" data-phase={view.phase}>
      <WinTrack wins={view.winsBySeat[seatId]!} />
      {(view.phase === 'draw' || view.phase === 'charizard-view') && (
        <DecisionHint
          guidance={decisionGuidance(view, actions, selection, first)}
          pending={locked}
          showRules={showRules}
          expanded={guidanceEnabled}
        />
      )}
      {view.phase !== 'charizard-view' && view.phase !== 'mew-other' && (
        <Board
          view={view}
          seatId={seatId}
          slots={ownSlots}
          selected={selectedSlots}
          locked={locked}
          select={chooseOwn}
        />
      )}
      {view.peek && (
        <div className="private-peek charizard-peek" role="status">
          <p className="peek-caption">
            <strong>仅你可见</strong>
            <span>位置 {view.peek.slot + 1}</span>
            <span>牌仍朝下</span>
          </p>
          <button
            type="button"
            className="close-peek-action"
            aria-label="查看完成，关闭暗牌查看"
            disabled={locked || !actions.some((a) => a.type === 'close-peek')}
            onClick={() => {
              const close = actions.find((a) => a.type === 'close-peek');
              if (close) choose(close);
            }}
          >
            查看完成
          </button>
          <span className="private-peek-card">
            <CardFace card={view.peek.card} />
            <span
              className={`peek-flame ${motion.includes('@saved') ? 'peek-just-saved' : 'peek-static'}`}
              aria-hidden="true"
            >
              {['top', 'right', 'bottom', 'left'].map((edge) => (
                <svg
                  key={edge}
                  className={`flame-edge flame-${edge}`}
                  viewBox="0 0 120 65"
                  preserveAspectRatio="none"
                >
                  <path
                    fill="#ff732d"
                    d="M2 62C-4 44 15 41 10 20c20 11 9 29 20 29 4-15 23-19 20-46 30 20 11 41 26 47 6-16 23-21 25-37 25 23 7 34 17 49Z"
                  />
                  <path
                    fill="#ffd05a"
                    d="M15 63c-6-11 7-14 7-25 10 7 6 19 17 20 9-15 14-15 18-31 13 15 4 25 21 31 10-5 12-17 17-21 0 13 15 19 13 26Z"
                  />
                </svg>
              ))}
            </span>
          </span>
        </div>
      )}
      {view.phase === 'mew-other' && (
        <>
          <div className="target-tabs" aria-label="选择朋友的场地">
            {targets.map((seat) => (
              <button
                key={seat}
                className="secondary"
                aria-pressed={target === seat}
                title={names[seat]}
                aria-label={`选择 ${view.seatOrder.indexOf(seat) + 1} 号 ${names[seat]} 的场地`}
                onClick={() => {
                  setTarget(seat);
                  setSelection(null);
                }}
                disabled={locked}
              >
                <span className="target-seat-number" aria-hidden="true">
                  {view.seatOrder.indexOf(seat) + 1}
                </span>
                <span className="target-seat-name">{names[seat]}</span>
              </button>
            ))}
          </div>
          {targets
            .filter((seat) => seat === target)
            .map((seat) => (
              <section
                key={seat}
                className="target-board"
                aria-label={names[seat]}
              >
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
        </>
      )}
      <div className="player-action-bar">
        {view.phase !== 'draw' && view.phase !== 'charizard-view' && (
          <DecisionHint
            guidance={decisionGuidance(view, actions, selection, first)}
            pending={locked}
            showRules={showRules}
            expanded={guidanceEnabled}
          />
        )}
        {ownSlots.length > 0 || view.phase === 'mew-other' ? (
          <div className="submit-choice">
            <p aria-live="polite">
              {selection
                ? selection.type === 'mew-target'
                  ? `${names[selection.seat]} 位置 ${selection.slot + 1}`
                  : 'slot' in selection
                    ? `位置 ${selection.slot + 1} 已选中`
                    : selection.type === 'swap'
                      ? `位置 ${selection.a + 1} 和 ${selection.b + 1} 已选中`
                      : '两张牌已选中'
                : first !== null
                  ? '再选一个不同位置'
                  : view.phase === 'snorlax-choice'
                    ? '选择两张牌交换位置'
                    : view.phase === 'charizard-choice'
                      ? '选择要查看的暗牌'
                      : view.phase === 'mew-other'
                        ? '选择朋友的一张牌'
                        : view.phase === 'initial-flip'
                          ? '选择要翻开的卡位'
                          : '选择换入位置'}
            </p>
            <div
              className="choice-actions"
              data-has-intent={intentActions.length > 0}
            >
              <button
                className="confirm-action"
                aria-label={selection ? short(selection) : undefined}
                disabled={locked || !selection}
                onClick={() => {
                  if (selection) choose(selection);
                }}
              >
                {view.phase === 'initial-flip'
                  ? '翻开这张'
                  : view.phase === 'snorlax-choice'
                    ? '交换两张'
                    : view.phase === 'charizard-choice'
                      ? '查看这张'
                      : view.phase === 'mew-other'
                        ? '选这张牌'
                        : '换入这里'}
              </button>
              {intentButtons}
              <button
                className="secondary cancel-selection"
                aria-label="取消卡片选择"
                disabled={locked || (!selection && first === null)}
                onClick={() => {
                  setSelection(null);
                  setFirst(null);
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="intent-actions">{intentButtons}</div>
        )}
      </div>
    </div>
  );
}
