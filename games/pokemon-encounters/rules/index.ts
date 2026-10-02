import type { GameRules, JsonValue, RuleContext } from '@tablemax/game-sdk';
import { instances, card } from './cards';
import { scoreBoard } from './scoring';
import {
  actor,
  decisionId,
  validateState,
  type State,
  type Phase,
} from './state';
import { project } from './project';
import { announceAction } from './public-actions';

export type Action =
  | { type: 'initial-flip' | 'replace' | 'peek'; slot: number }
  | { type: 'mew-target'; seat: string; slot: number }
  | { type: 'draw'; source: 'deck' | 'discard' }
  | { type: 'swap'; a: number; b: number }
  | { type: 'discard-held' | 'decline-ability' | 'close-peek' | 'next-round' };
const slots = [0, 1, 2, 3, 4, 5];
export function shuffle(
  cards: readonly string[],
  random: RuleContext['random'],
) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
function round(
  context: RuleContext,
  starter: string,
  wins: Record<string, number>,
  number: number,
  step = 0,
): State {
  const seatOrder = [...context.seats];
  const deck = shuffle(instances, context.random);
  const boards: State['boards'] = Object.fromEntries(
    seatOrder.map((seat) => [seat, []]),
  );
  const order = clockwise(seatOrder, starter);
  for (let slot = 0; slot < 6; slot++)
    for (const seat of order)
      boards[seat]!.push({ instanceId: deck.pop()!, faceUp: false });
  return {
    gameId: 'pokemon-encounters',
    rulesVersion: 'tablemax-cn-s19-v1',
    stateVersion: 1,
    roundNumber: number,
    seatOrder,
    winsBySeat: wins,
    boards,
    deck,
    discard: [],
    held: null,
    phase: 'initial-flip',
    turnSeat: starter,
    initialDone: [],
    step,
    drawSource: null,
    coin: null,
    recipientQueue: [],
    recipientIndex: 0,
    peekSlot: null,
    roundResult: null,
    matchWinners: [],
    events: [],
  };
}
function clockwise(seats: readonly string[], start: string) {
  return Array.from(
    { length: seats.length },
    (_, i) => seats[(seats.indexOf(start) + i) % seats.length]!,
  );
}
function event(s: State, kind: State['events'][number]['kind'], text: string) {
  s.events.push({ id: s.step, kind, text });
  s.events = s.events.slice(-30);
}
function drawDeck(s: State, context: RuleContext) {
  if (!s.deck.length) {
    s.deck = shuffle(s.discard, context.random);
    s.discard = [];
  }
  const instance = s.deck.pop();
  if (!instance) throw new Error('No available card');
  return instance;
}
function replace(s: State, seat: string, slot: number) {
  if (!s.held) throw new Error('No held card');
  const outgoing = s.boards[seat]![slot]!.instanceId;
  s.boards[seat]![slot] = { instanceId: s.held, faceUp: true };
  s.held = null;
  return outgoing;
}
function finish(s: State, ability: boolean) {
  s.held = null;
  s.peekSlot = null;
  s.recipientQueue = [];
  s.recipientIndex = 0;
  s.drawSource = null;
  if (s.seatOrder.some((seat) => s.boards[seat]!.every((c) => c.faceUp))) {
    for (const seat of s.seatOrder)
      for (const c of s.boards[seat]!) c.faceUp = true;
    const scores = Object.fromEntries(
      s.seatOrder.map((seat) => [
        seat,
        scoreBoard(s.boards[seat]!.map((c) => c.instanceId)),
      ]),
    );
    const min = Math.min(...Object.values(scores).map((score) => score.total));
    const winners = s.seatOrder.filter((seat) => scores[seat]!.total === min);
    for (const seat of winners) s.winsBySeat[seat]!++;
    s.roundResult = { scores, winners };
    s.matchWinners = s.seatOrder.filter((seat) => s.winsBySeat[seat] === 3);
    s.phase = s.matchWinners.length ? 'match-result' : 'round-result';
    event(
      s,
      'round-result',
      `第 ${s.roundNumber} 小局已结算，最低分 ${min}，${winners.length} 位共同赢家。`,
    );
  } else {
    s.turnSeat = clockwise(s.seatOrder, s.turnSeat)[1]!;
    s.phase = 'draw';
    event(
      s,
      ability ? 'effect-complete' : 'replace',
      ability ? '能力完整完成，进入下一回合。' : '取牌处理完成，进入下一回合。',
    );
  }
}
const labels: Record<Phase, string> = {
  'initial-flip': '选择初始翻牌之前',
  draw: '选择取牌来源之前',
  place: '处理已摸牌之前',
  'mew-other': '选择梦幻目标之前',
  'mew-self': '完成梦幻己方替换之前',
  'rocket-meowth': '选择火箭队替换之前',
  'rocket-pikachu': '选择火箭队同位之前',
  'zapdos-self': '选择闪电鸟换入之前',
  'zapdos-receive': '接收传牌选位之前',
  'snorlax-choice': '决定卡比兽能力之前',
  'charizard-choice': '决定喷火龙能力之前',
  'charizard-view': '确认查看结束之前',
  'round-result': '开始下一小局之前',
  'match-result': '大局结果',
};
export const rules: GameRules = {
  manifest: {
    id: 'pokemon-encounters',
    name: '宝可梦奇遇：皮卡丘和朋友们',
    gameVersion: '1.0.0',
    rulesVersion: 'tablemax-cn-s19-v1',
    sdkVersion: 1,
    stateVersion: 1,
    // Six seats are a user-authorized digital variant, not a publisher claim.
    players: { min: 2, max: 6 },
    assetNamespace: 'pokemon-encounters',
  },
  initialize(context) {
    if (context.seats.length < 2 || context.seats.length > 6)
      throw new Error('Invalid seats');
    const starter =
      context.seats[Math.floor(context.random.next() * context.seats.length)]!;
    return round(
      context,
      starter,
      Object.fromEntries(context.seats.map((seat) => [seat, 0])),
      1,
    );
  },
  validateState,
  decisions(input) {
    const s = input as State;
    if (s.phase === 'initial-flip')
      return s.seatOrder
        .filter((seat) => !s.initialDone.includes(seat))
        .map((seat) => ({ id: decisionId(s, seat), seatId: seat }));
    return ['round-result', 'match-result'].includes(s.phase)
      ? []
      : [{ id: decisionId(s, actor(s)), seatId: actor(s) }];
  },
  ended(input) {
    return (input as State).phase === 'match-result';
  },
  validateAction(input): Action {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('Invalid action');
    const a = input as Record<string, unknown>;
    const keys = (names: string[]) =>
      Object.keys(a).sort().join(',') === names.sort().join(',');
    const slot = (v: unknown) =>
      typeof v === 'number' && Number.isInteger(v) && slots.includes(v);
    if (
      ['discard-held', 'decline-ability', 'close-peek', 'next-round'].includes(
        String(a.type),
      ) &&
      keys(['type'])
    )
      return { type: a.type } as Action;
    if (
      ['initial-flip', 'replace', 'peek'].includes(String(a.type)) &&
      keys(['type', 'slot']) &&
      slot(a.slot)
    )
      return { type: a.type, slot: a.slot } as Action;
    if (
      a.type === 'draw' &&
      keys(['type', 'source']) &&
      ['deck', 'discard'].includes(String(a.source))
    )
      return { type: a.type, source: a.source } as Action;
    if (
      a.type === 'mew-target' &&
      keys(['type', 'seat', 'slot']) &&
      typeof a.seat === 'string' &&
      slot(a.slot)
    )
      return { type: a.type, seat: a.seat, slot: a.slot } as Action;
    if (
      a.type === 'swap' &&
      keys(['type', 'a', 'b']) &&
      slot(a.a) &&
      slot(a.b) &&
      a.a !== a.b
    )
      return { type: a.type, a: a.a, b: a.b } as Action;
    throw new Error('Invalid action');
  },
  legalActions(input, seat) {
    const s = input as State;
    if (s.phase === 'initial-flip')
      return s.seatOrder.includes(seat) && !s.initialDone.includes(seat)
        ? slots.map((slot) => ({ type: 'initial-flip', slot }))
        : [];
    if (['round-result', 'match-result'].includes(s.phase) || actor(s) !== seat)
      return [];
    switch (s.phase) {
      case 'draw':
        return [
          { type: 'draw', source: 'deck' },
          ...(s.discard.length ? [{ type: 'draw', source: 'discard' }] : []),
        ];
      case 'place':
        return [
          ...slots.map((slot) => ({ type: 'replace', slot })),
          ...(s.drawSource === 'deck' ? [{ type: 'discard-held' }] : []),
        ];
      case 'mew-other':
        return s.seatOrder
          .filter((id) => id !== seat)
          .flatMap((id) =>
            slots.map((slot) => ({ type: 'mew-target', seat: id, slot })),
          );
      case 'mew-self':
      case 'rocket-meowth':
      case 'rocket-pikachu':
      case 'zapdos-self':
      case 'zapdos-receive':
        return slots.map((slot) => ({ type: 'replace', slot }));
      case 'snorlax-choice':
        return [
          { type: 'decline-ability' },
          ...slots.flatMap((a) =>
            slots.filter((b) => b > a).map((b) => ({ type: 'swap', a, b })),
          ),
        ];
      case 'charizard-choice':
        return [
          { type: 'decline-ability' },
          ...slots
            .filter((slot) => !s.boards[seat]![slot]!.faceUp)
            .map((slot) => ({ type: 'peek', slot })),
        ];
      case 'charizard-view':
        return [{ type: 'close-peek' }];
      default:
        return [];
    }
  },
  lifecycleActions(input) {
    return (input as State).phase === 'round-result'
      ? [{ type: 'next-round' }]
      : [];
  },
  applyLifecycle(input, action, context) {
    const s = input as State;
    if (
      s.phase !== 'round-result' ||
      (rules.validateAction(action) as Action).type !== 'next-round'
    )
      throw new Error('Invalid lifecycle');
    const winners = s.roundResult!.winners;
    const starter =
      winners[Math.floor(context.random.next() * winners.length)]!;
    const next = round(
      context,
      starter,
      { ...s.winsBySeat },
      s.roundNumber + 1,
      s.step + 1,
    );
    next.events = [...s.events];
    event(
      next,
      'effect-complete',
      `第 ${next.roundNumber} 小局已发牌，等待每位玩家翻开一张。`,
    );
    next.events.at(-1)!.action = {
      actor: null,
      verb: 'deal',
      cardCategory: null,
      ability: null,
      targets: next.seatOrder.map((seat) => ({ seat, slots: [...slots] })),
    };
    return {
      state: next,
      decision: {
        label: `开始第 ${next.roundNumber} 小局之前`,
        roundNumber: next.roundNumber,
        revealedInformation: true,
      },
      events: next.events
        .filter((event) => event.id === next.step)
        .map(({ kind, text, action }) => ({
          kind,
          text,
          ...(action ? { action } : {}),
        })),
    };
  },
  apply(input, raw, seat, context) {
    const a = rules.validateAction(raw) as Action;
    if (
      !rules
        .legalActions(input, seat)
        .some((legal) => JSON.stringify(legal) === JSON.stringify(a))
    )
      throw new Error('Illegal action');
    const s = structuredClone(input) as State;
    const before = s.phase;
    s.step++;
    const label = `S${s.seatOrder.indexOf(seat) + 1} ${labels[before]}`;
    if (a.type === 'initial-flip') {
      s.boards[seat]![a.slot]!.faceUp = true;
      s.initialDone.push(seat);
      event(s, 'replace', `S${s.seatOrder.indexOf(seat) + 1} 完成初始翻牌。`);
      if (s.initialDone.length === s.seatOrder.length) s.phase = 'draw';
    } else if (a.type === 'draw') {
      s.drawSource = a.source;
      s.coin = null;
      s.held = a.source === 'deck' ? drawDeck(s, context) : s.discard.pop()!;
      const category = card(s.held).categoryId;
      s.phase =
        category === 'special-mew'
          ? 'mew-other'
          : category === 'special-zapdos'
            ? 'zapdos-self'
            : 'place';
      if (category === 'special-team-rocket') {
        s.coin = context.random.next() < 0.5 ? 'meowth' : 'pikachu';
        s.phase = s.coin === 'meowth' ? 'rocket-meowth' : 'rocket-pikachu';
      }
      event(
        s,
        'draw',
        `S${s.seatOrder.indexOf(seat) + 1} 从${a.source === 'deck' ? '牌库' : '弃牌顶'}摸牌${s.coin ? `，硬币为${s.coin === 'meowth' ? '喵喵' : '皮卡丘'}` : ''}。`,
      );
    } else if (a.type === 'mew-target') {
      s.held = replace(s, a.seat, a.slot);
      s.phase = 'mew-self';
      event(s, 'replace', '梦幻已换入目标场地，等待行动者完成己方替换。');
    } else if (a.type === 'replace') {
      if (before === 'rocket-pikachu') {
        const order = clockwise(s.seatOrder, s.turnSeat);
        const rocket = s.held!;
        // P03: insert each at bottom in chronological order, then refill all.
        s.discard.unshift(s.boards[seat]![a.slot]!.instanceId);
        s.discard.unshift(rocket);
        for (const id of order.slice(1))
          s.discard.unshift(s.boards[id]![a.slot]!.instanceId);
        s.held = null;
        // Removed slots are replaced within this atomic rule step; no partial state is published or saved.
        for (const id of order)
          s.boards[id]![a.slot] = {
            instanceId: drawDeck(s, context),
            faceUp: true,
          };
        finish(s, true);
      } else {
        const incoming = s.held!;
        const outgoing = replace(s, seat, a.slot);
        if (before === 'zapdos-self' || before === 'zapdos-receive') {
          s.held = outgoing;
          if (before === 'zapdos-self') {
            s.recipientQueue = clockwise(s.seatOrder, s.turnSeat).slice(1);
            s.recipientIndex = 0;
          } else s.recipientIndex++;
          if (s.recipientIndex === s.recipientQueue.length) {
            s.discard.unshift(outgoing);
            s.held = null;
            finish(s, true);
          } else {
            s.phase = 'zapdos-receive';
            event(s, 'replace', '传牌已保存，等待下一位接牌者选位。');
          }
        } else {
          s.discard.push(outgoing);
          if (
            before === 'place' &&
            card(incoming).categoryId === 'special-snorlax'
          )
            s.phase = 'snorlax-choice';
          else if (
            before === 'place' &&
            card(incoming).categoryId === 'special-charizard' &&
            s.boards[seat]!.some((c) => !c.faceUp)
          )
            s.phase = 'charizard-choice';
          else
            finish(
              s,
              before !== 'place' ||
                card(incoming).abilityDefinition?.mode === 'optional',
            );
          if (s.phase === 'snorlax-choice' || s.phase === 'charizard-choice')
            event(s, 'replace', '新牌已换入，等待可选能力选择。');
        }
      }
    } else if (a.type === 'discard-held') {
      s.discard.push(s.held!);
      s.held = null;
      finish(s, false);
    } else if (a.type === 'swap') {
      const board = s.boards[seat]!;
      [board[a.a], board[a.b]] = [board[a.b]!, board[a.a]!];
      finish(s, true);
    } else if (a.type === 'peek') {
      s.peekSlot = a.slot;
      s.phase = 'charizard-view';
      event(s, 'replace', '行动者正在临时查看本人暗牌。');
    } else if (a.type === 'decline-ability' || a.type === 'close-peek')
      finish(s, true);
    const announcement = announceAction(input as State, s, a, seat);
    for (const entry of s.events.filter((entry) => entry.id === s.step))
      entry.action = announcement;
    return {
      state: s,
      decision: {
        label,
        roundNumber: s.roundNumber,
        revealedInformation:
          !['snorlax-choice', 'charizard-view'].includes(before) ||
          a.type === 'peek',
      },
      events: s.events
        .filter((event) => event.id === s.step)
        .map(({ kind, text, action }) => ({
          kind,
          text,
          ...(action ? { action } : {}),
        })),
    };
  },
  project(input, viewer) {
    return project(input as State, viewer);
  },
};

// Keep actions and views JSON-only at the SDK boundary.
export const jsonAction = (action: Action): JsonValue => action;
