import type { GameRules, JsonValue, RuleContext } from '@tablemax/game-sdk';
import {
  card,
  correctAnswers,
  setupDefaults,
  thoughtMs,
  validateSetup,
  vegetables,
  type State,
  type Action,
  type SaladView,
  type Answer,
} from '../types';
import { validateState } from './state';
function begin(s: State, actor: string) {
  s.actor = actor;
  s.turn++;
  s.step++;
  s.phase = 'thinking';
  s.answer = null;
  s.late = false;
  s.responses = {};
  const oldTops = s.piles.map((p) => p.at(-1));
  const id = s.hands[actor]!.shift();
  if (id === undefined) throw new Error('无牌不能继续回合');
  s.current = id;
  s.piles[s.pile]!.push(id);
  // Keep the covered taboo for exactly this transition turn.
  s.taboo = [
    ...new Set([
      ...(card(id).taboo ? s.piles.map((p) => p.at(-1)) : oldTops)
        .filter((v): v is number => v !== undefined)
        .map(card)
        .filter((c) => c.taboo)
        .map((c) => c.vegetable),
      ...(card(id).taboo ? [card(id).vegetable] : []),
    ]),
  ];
}
function view(s: State, seat: string | null): SaladView {
  return {
    seats: [...s.seats],
    counts: Object.fromEntries(s.seats.map((k) => [k, s.hands[k]!.length])),
    piles: s.piles.map((p) =>
      p.length ? card(p.at(-1)!) : null,
    ) as SaladView['piles'],
    pileCounts: s.piles.map((p) => p.length),
    pile: s.pile,
    actor: s.actor,
    phase: s.phase,
    step: s.step,
    current: card(s.current),
    previousVegetable: s.previousVegetable,
    previousAnswer: s.previousAnswer,
    taboo: [...s.taboo],
    answer: s.answer,
    late: s.late,
    winners: [...s.winners],
    setup: { ...s.setup },
    accepted: s.accepted,
    lastResult: s.lastResult,
    selfResponse: seat ? (s.responses[seat] ?? null) : null,
  };
}
function finish(input: State, automatic: boolean): State {
  const s = structuredClone(input);
  const challengers = s.seats.filter((k) => s.responses[k] === 'challenge');
  const guilty =
    automatic ||
    s.late ||
    !correctAnswers(view(s, null)).includes(s.answer as Answer);
  let next = s.seats[(s.seats.indexOf(s.actor) + 1) % s.seats.length]!;
  if (automatic || challengers.length) {
    const recipients = guilty ? [s.actor] : challengers;
    const all = [...s.piles[0], ...s.piles[1]];
    all.forEach((id, i) =>
      s.hands[recipients[i % recipients.length]!]!.push(id),
    );
    s.piles = [[], []];
    s.pile = 0;
    s.previousAnswer = null;
    s.previousVegetable = null;
    next = recipients[0]!;
    s.lastResult = automatic
      ? '无人作答，当前玩家收取全部桌面牌。'
      : guilty
        ? '质疑成立，作答者收取全部桌面牌一次。'
        : '质疑不成立，误判者按座位顺序均分桌面牌。';
  } else {
    // Never disclose whether an unchallenged answer was right.
    s.lastResult = '质疑窗口结束，继续出牌。';
    s.accepted++;
    s.previousAnswer = s.answer;
    s.previousVegetable = card(s.current).vegetable;
    if (card(s.current).taboo) s.pile = 1 - s.pile;
  }
  if (s.hands[s.actor]!.length === 0) {
    s.winners = [s.actor];
    s.phase = 'ended';
    s.step++;
    return s;
  }
  begin(s, next);
  return s;
}
function result(s: State, label: string, reveal = false) {
  return {
    state: s as unknown as JsonValue,
    decision: { label, revealedInformation: reveal },
    events: [{ kind: 'salad', text: label }],
  };
}
export const rules: GameRules = {
  manifest: {
    id: 'cockroach-salad',
    name: '蟑螂沙拉',
    gameVersion: '1.0.0',
    rulesVersion: 'classic-40839-digital-v1',
    sdkVersion: 1,
    stateVersion: 1,
    players: { min: 2, max: 6 },
    assetNamespace: 'cockroach-salad',
  },
  setup: {
    defaults: setupDefaults,
    validate: validateSetup,
    fromState: (s) => (s as unknown as State).setup,
  },
  initialize(context: RuleContext) {
    if (
      context.seats.length < 2 ||
      context.seats.length > 6 ||
      new Set(context.seats).size !== context.seats.length
    )
      throw new Error('需要2–6个不同座位');
    const deck = Array.from({ length: 128 }, (_, i) => i);
    for (let i = 127; i > 0; i--) {
      const j = Math.floor(context.random.next() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    const count = Math.floor(128 / context.seats.length);
    const s: State = {
      seats: [...context.seats],
      hands: Object.fromEntries(
        context.seats.map((k) => [k, deck.splice(0, count)]),
      ),
      spare: deck,
      piles: [[], []],
      pile: 0,
      actor: context.seats[0]!,
      phase: 'thinking',
      step: 0,
      turn: 0,
      current: 0,
      previousVegetable: null,
      previousAnswer: null,
      taboo: [],
      answer: null,
      late: false,
      responses: {},
      winners: [],
      setup:
        context.setup === undefined
          ? { ...setupDefaults }
          : validateSetup(context.setup),
      accepted: 0,
      lastResult: '第一座位开始，按座位顺序出牌。',
    };
    begin(s, s.actor);
    return s as unknown as JsonValue;
  },
  validateState: (input, seats) =>
    validateState(input, seats) as unknown as JsonValue,
  decisions(input) {
    const s = input as unknown as State;
    if (s.phase === 'ended') return [];
    const ds = [];
    if (s.phase !== 'thinking')
      for (const k of s.seats)
        if (k !== s.actor && !s.responses[k])
          ds.push({
            id: `salad-response-${s.turn}`,
            seatId: k,
            concurrencyGroup: `salad-review-${s.turn}`,
          });
    if (s.phase !== 'review')
      ds.push({ id: `salad-answer-${s.turn}-${s.phase}`, seatId: s.actor });
    return ds;
  },
  ended: (s) => (s as unknown as State).phase === 'ended',
  legalActions(input, seat) {
    const s = input as unknown as State;
    if (s.phase === 'ended' || !s.seats.includes(seat)) return [];
    if (seat === s.actor)
      return s.phase === 'review'
        ? []
        : [...vegetables, 'cockroach'].map((answer) => ({
            type: 'answer',
            answer,
          }));
    return s.phase === 'thinking' || s.responses[seat]
      ? []
      : [{ type: 'challenge' }, { type: 'pass' }];
  },
  validateAction(input) {
    const a = input as Action;
    if (!a || typeof a !== 'object') throw new Error('无效动作');
    if (
      a.type === 'answer' &&
      Object.keys(a).sort().join() === 'answer,type' &&
      [...vegetables, 'cockroach'].includes(a.answer)
    )
      return { type: a.type, answer: a.answer };
    if (
      ['challenge', 'pass', 'next-round'].includes(a.type) &&
      Object.keys(a).length === 1
    )
      return { type: a.type };
    throw new Error('无效动作');
  },
  apply(input, raw, seat) {
    const legal = rules.legalActions(input, seat);
    if (!legal.some((a) => JSON.stringify(a) === JSON.stringify(raw)))
      throw new Error('动作已过期或无权操作');
    const s = structuredClone(input) as unknown as State;
    const a = raw as Action;
    if (a.type === 'answer') {
      s.answer = a.answer;
      s.phase = 'review';
      s.step++;
    } else if (a.type === 'challenge' || a.type === 'pass')
      s.responses[seat] = a.type;
    return result(
      s,
      a.type === 'answer'
        ? '答案已保存，等待共同质疑窗口。'
        : '本次选择已保存。',
    );
  },
  automaticAction(input) {
    const s = input as unknown as State;
    if (s.phase === 'ended') return null;
    return {
      key: `salad-${s.step}-${s.phase}`,
      delayMs:
        s.phase === 'thinking'
          ? thoughtMs(s)
          : s.phase === 'overtime'
            ? 3000
            : 1800,
      action: { type: 'deadline', step: s.step, phase: s.phase },
    };
  },
  applyAutomatic(input, action) {
    const s = structuredClone(input) as unknown as State;
    const a = action as { type: string; step: number; phase: string };
    if (
      a.type !== 'deadline' ||
      a.step !== s.step ||
      a.phase !== s.phase ||
      s.phase === 'ended'
    )
      throw new Error('过期自动截止');
    if (s.phase === 'thinking') {
      s.phase = 'overtime';
      s.late = true;
      s.step++;
      return result(s, '已超过思考时限，可以质疑拖延。');
    }
    const next = finish(s, s.phase === 'overtime');
    return result(next, next.lastResult, true);
  },
  botTiming(input, seat, difficulty) {
    const s = input as unknown as State;
    if (!rules.legalActions(input, seat).length) return null;
    const ranges = {
      default: [650, 1350],
      doubao: [380, 850],
      juewu: [180, 550],
    }[difficulty];
    return {
      key: `salad-${s.step}-${seat}`,
      minMs: ranges[0]!,
      maxMs: ranges[1]!,
    };
  },
  project: (input, viewer) =>
    view(
      input as unknown as State,
      viewer.role === 'player' ? viewer.seatId : null,
    ) as unknown as JsonValue,
  lifecycleActions: (s) => (rules.ended(s) ? [{ type: 'next-round' }] : []),
  applyLifecycle(s, a, c) {
    if (!rules.ended(s) || (a as Action).type !== 'next-round')
      throw new Error('本局尚未结束');
    return result(
      rules.initialize(c) as unknown as State,
      '新一局开始。',
      true,
    );
  },
};
