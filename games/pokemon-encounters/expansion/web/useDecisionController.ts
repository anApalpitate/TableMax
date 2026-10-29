import { useState } from 'react';
import type { GameHost } from '@tablemax/web-host';
import { avatarFor } from '@tablemax/web-host';
import type { JsonValue } from '@tablemax/game-sdk';
import type { View } from '../project';
import type { Action } from '../state';
import { namesOf, pairTypes } from './view-model';

export function useDecisionController(session: GameHost, game: View) {
  const actions = (session.view?.actions ?? []) as Action[];
  const [mode, setMode] = useState(''),
    [target, setTarget] = useState(''),
    [slots, setSlots] = useState<number[]>([]),
    [exchange, setExchange] = useState(false);
  const names = namesOf(session),
    self = session.self?.id ?? '',
    locked = session.locked || !session.connected;
  const choose = (action: Action) => {
    if (!locked && session.view?.decisionId)
      session.command({
        type: 'game',
        decisionId: session.view.decisionId,
        action: action as unknown as JsonValue,
      });
  };
  const selectedType =
    mode ||
    actions.find(
      (a) => pairTypes.includes(a.type) || 'slot' in a || 'seat' in a,
    )?.type;
  const working = actions.filter((a) => a.type === selectedType);
  const targets = [
    ...new Set(working.flatMap((a) => ('seat' in a ? [a.seat] : []))),
  ];
  const chosenSeat = target || targets[0] || self;
  const actorAvatar = avatarFor(
    session.view?.seats.find((seat) => seat.id === (game.actorSeat ?? self))
      ?.avatarId ?? 'builtin-1',
  );
  const candidates = working.filter(
    (a) => !('seat' in a) || a.seat === chosenSeat,
  );
  const single = candidates.filter(
    (a): a is Extract<Action, { slot: number }> => 'slot' in a,
  );
  const pairs = candidates.filter(
    (a): a is Extract<Action, { a: number; b: number }> => 'a' in a,
  );
  const selectable = [
    ...new Set(
      single.map((a) => a.slot).concat(pairs.flatMap((a) => [a.a, a.b])),
    ),
  ];
  const select = (i: number) =>
    setSlots((prev) =>
      prev.includes(i)
        ? prev.filter((s) => s !== i)
        : pairs.length
          ? [...prev.slice(-1), i]
          : [i],
    );
  const chosen =
    single.find((a) => slots.length === 1 && a.slot === slots[0]) ??
    pairs.find(
      (a) =>
        slots.length === 2 &&
        a.a === Math.min(...slots) &&
        a.b === Math.max(...slots) &&
        (!('swap' in a) || a.swap === exchange),
    );
  const selectingSlots =
    !game.peek &&
    selectable.length > 0 &&
    (game.phase !== 'draw' || mode === 'reposition');
  const commandLabel =
    selectedType === 'initial-flip'
      ? '翻开这张牌'
      : selectedType === 'peek'
        ? '查看这张暗牌'
        : selectedType === 'mew-target'
          ? '换入对手此格'
          : selectedType === 'mewtwo-target'
            ? game.rulesProfile === 'events-research-v3'
              ? '查看这一张牌'
              : '查看这两张牌'
            : selectedType === 'ninja-target'
              ? exchange
                ? '盖回并交换这两格'
                : '盖回这两格'
              : selectedType === 'reposition'
                ? '本回合交换这两格'
                : selectedType === 'swap'
                  ? '交换这两格'
                  : '换入这里';

  return {
    actions,
    mode,
    setMode,
    target,
    setTarget,
    slots,
    setSlots,
    exchange,
    setExchange,
    names,
    self,
    locked,
    choose,
    selectedType,
    working,
    targets,
    chosenSeat,
    actorAvatar,
    candidates,
    single,
    pairs,
    selectable,
    select,
    chosen,
    selectingSlots,
    commandLabel,
  };
}
