import type { BotDifficulty, BotStrategy, JsonValue } from '@tablemax/game-sdk';
import { CARD_IDS, getCard, RULES_VERSION } from '../data/catalog';
import {
  COLORS,
  type Action,
  type Card,
  type Color,
  type UnoView,
} from '../types';
export type Memory = {
  version: 1;
  roundNumber: number;
  serial: number;
  knownCards: Record<string, string[]>;
  colorHints: Record<string, { color: Color; strength: number }>;
};
function validMemory(input: unknown): Memory | null {
  if (input === null) return null;
  const m = input as Memory;
  if (
    !m ||
    typeof m !== 'object' ||
    Array.isArray(m) ||
    Object.keys(m).sort().join(',') !==
      'colorHints,knownCards,roundNumber,serial,version' ||
    m.version !== 1 ||
    !Number.isSafeInteger(m.roundNumber) ||
    m.roundNumber < 1 ||
    !Number.isSafeInteger(m.serial) ||
    m.serial < 0 ||
    !m.knownCards ||
    typeof m.knownCards !== 'object' ||
    Array.isArray(m.knownCards) ||
    Object.keys(m.knownCards).length > 6 ||
    !Object.values(m.knownCards).every(
      (ids) =>
        Array.isArray(ids) &&
        ids.length <= 108 &&
        new Set(ids).size === ids.length &&
        ids.every((id) => CARD_IDS.includes(id)),
    ) ||
    !m.colorHints ||
    typeof m.colorHints !== 'object' ||
    Array.isArray(m.colorHints) ||
    Object.keys(m.colorHints).length > 6 ||
    !Object.values(m.colorHints).every(
      (hint) =>
        hint &&
        typeof hint === 'object' &&
        Object.keys(hint).sort().join(',') === 'color,strength' &&
        COLORS.includes(hint.color) &&
        Number.isFinite(hint.strength) &&
        hint.strength >= 0 &&
        hint.strength <= 1,
    )
  )
    throw new Error('UNO 策略记忆版本或内容无效。');
  return structuredClone(m);
}
function fresh(view: UnoView): Memory {
  return {
    version: 1,
    roundNumber: view.roundNumber,
    serial: 0,
    knownCards: {},
    colorHints: {},
  };
}
export function observe(
  view: UnoView,
  memory: unknown,
  difficulty: BotDifficulty,
): Memory {
  let m = validMemory(memory) ?? fresh(view);
  if (
    !view.self ||
    Object.keys(m.knownCards).some((seat) => !view.seatOrder.includes(seat)) ||
    Object.keys(m.colorHints).some((seat) => !view.seatOrder.includes(seat))
  )
    throw new Error('UNO 策略观察身份或座位无效。');
  if (m.roundNumber !== view.roundNumber) m = fresh(view);
  const latest = view.latest;
  if (!latest || latest.serial <= m.serial) return m;
  if (difficulty !== 'default' && latest.actor) {
    if (latest.verb === 'play' && latest.card) {
      m.knownCards[latest.actor] = (m.knownCards[latest.actor] ?? []).filter(
        (id) => id !== latest.card!.id,
      );
      if (latest.color)
        m.colorHints[latest.actor] = {
          color: latest.color,
          strength: latest.card.color === null ? 0.65 : 0.35,
        };
    }
    if (
      latest.verb === 'challenge-draw-four' &&
      latest.actor === view.self.seatId &&
      view.self.challengeEvidence
    ) {
      const e = view.self.challengeEvidence;
      m.knownCards[e.offender] = e.cards
        .map((card) => card.id)
        .slice(difficulty === 'doubao' ? -3 : 0);
    }
  }
  if (difficulty === 'default') {
    m.knownCards = {};
    m.colorHints = {};
  }
  m.serial = latest.serial;
  return m;
}
const points = (card: Card) =>
  card.kind === 'number' ? card.value! : card.color ? 20 : 50;
function adjacent(
  view: UnoView,
  seat: string,
  direction = view.direction,
  steps = 1,
): string {
  return view.seatOrder[
    (view.seatOrder.indexOf(seat) +
      direction * steps +
      view.seatOrder.length * 2) %
      view.seatOrder.length
  ]!;
}
function colorCount(hand: readonly Card[], color: Color): number {
  return hand.filter((card) => card.color === color).length;
}
function chosenColorScore(
  view: UnoView,
  color: Color,
  hand: readonly Card[],
  memory: Memory,
  difficulty: BotDifficulty,
): number {
  let value =
    colorCount(hand, color) * 8 +
    hand
      .filter((card) => card.color === color)
      .reduce((sum, card) => sum + points(card), 0) *
      0.18;
  if (difficulty === 'juewu' && view.self) {
    const rival = adjacent(view, view.self.seatId),
      known = memory.knownCards[rival] ?? [],
      hint = memory.colorHints[rival];
    value -= known.filter((id) => getCard(id).color === color).length * 5;
    if (hint?.color === color)
      value -= hint.strength * (view.players[rival]!.handCount <= 2 ? 14 : 5);
  }
  return value;
}
export function chooseAction(
  view: UnoView,
  rawActions: readonly Action[],
  memory: Memory,
  difficulty: BotDifficulty,
  signal?: AbortSignal,
): Action {
  if (!view.self || !rawActions.length)
    throw new Error('UNO 策略没有本人合法选择。');
  if (signal?.aborted) throw new Error('UNO 策略已取消。');
  const self = view.self,
    hand = self.hand;
  // Every tier handles out-of-turn UNO race responses before the main turn.
  const uno =
    rawActions.find((a) => a.type === 'declare-uno') ??
    rawActions.find((a) => a.type === 'catch-uno');
  if (uno) return uno;
  const choose = rawActions.filter(
    (a): a is Extract<Action, { type: 'choose-color' }> =>
      a.type === 'choose-color',
  );
  if (choose.length)
    return [...choose].sort(
      (a, b) =>
        chosenColorScore(view, b.color, hand, memory, difficulty) -
        chosenColorScore(view, a.color, hand, memory, difficulty),
    )[0]!;
  const accept = rawActions.find((a) => a.type === 'accept-draw-four');
  if (accept) {
    const challenge = rawActions.find((a) => a.type === 'challenge-draw-four');
    const claim = view.drawFour;
    // A challenge is based on authorized remembered evidence, never a hidden flag.
    const knownGuilty =
      claim &&
      (memory.knownCards[claim.offender] ?? []).some(
        (id) => getCard(id).color === claim.previousColor,
      );
    return difficulty !== 'default' && knownGuilty && challenge
      ? challenge
      : accept;
  }
  const plays = rawActions
    .filter((a): a is Extract<Action, { type: 'play' }> => a.type === 'play')
    .filter(
      (a) =>
        getCard(a.cardId).kind !== 'wild-draw-four' ||
        !hand.some((c) => c.color === view.activeColor),
    )
    .filter((a) => hand.length !== 2 || a.uno === true);
  if (!plays.length) {
    const fallback = rawActions.find(
      (a) => a.type === 'draw' || a.type === 'pass',
    );
    if (!fallback) throw new Error('UNO 策略没有合法主动作。');
    return fallback;
  }
  const seat = self.seatId,
    next = adjacent(view, seat),
    danger = view.players[next]!.handCount <= 2;
  function evaluate(action: Extract<Action, { type: 'play' }>): number {
    const card = getCard(action.cardId),
      remaining = hand.filter((c) => c.id !== action.cardId),
      color = card.color ?? action.color!;
    if (!remaining.length) return 100000;
    if (difficulty === 'default')
      return (
        (card.color ? 100 : 0) +
        (card.kind === 'number' ? 20 : 0) +
        colorCount(remaining, color) +
        points(card) * 0.02
      );
    let score =
      points(card) * 0.6 +
      chosenColorScore(view, color, remaining, memory, difficulty);
    score -= card.color === null ? 30 : 0; // Save flexible wilds while ordinary exits remain.
    if (card.kind === 'draw-two') score += danger ? 48 : 11;
    if (card.kind === 'wild-draw-four') score += danger ? 58 : 13;
    if (card.kind === 'skip') score += danger ? 37 : 8;
    if (card.kind === 'reverse') {
      const opposite = adjacent(view, seat, view.direction === 1 ? -1 : 1);
      score +=
        view.seatOrder.length === 2
          ? 12
          : danger
            ? view.players[opposite]!.handCount > 2
              ? 32
              : -8
            : 3;
    }
    if (difficulty === 'doubao') return score;
    // Score next two accessible plays under visible colors/symbols, plus last-card risk.
    let followups = 0;
    for (const c of remaining) {
      if (signal?.aborted) throw new Error('UNO 策略已取消。');
      if (
        c.color === null ||
        c.color === color ||
        (c.kind === card.kind &&
          (c.kind !== 'number' || c.value === card.value))
      )
        followups++;
    }
    score +=
      followups * 4 +
      new Set(remaining.filter((c) => c.color).map((c) => c.color)).size * 2;
    const extraTurn =
      view.seatOrder.length === 2 &&
      ['skip', 'reverse', 'draw-two', 'wild-draw-four'].includes(card.kind);
    if (extraTurn)
      score += followups ? 20 + Math.max(...remaining.map(points)) * 0.3 : -12;
    if (remaining.length === 1) {
      const last = remaining[0]!;
      score += last.color === null ? 26 : last.color === color ? 23 : 4;
      if (
        extraTurn &&
        (last.color === null || last.color === color || last.kind === card.kind)
      )
        score += 100;
    }
    const responder =
      card.kind === 'reverse' && view.seatOrder.length > 2
        ? adjacent(view, seat, view.direction === 1 ? -1 : 1)
        : ['skip', 'draw-two', 'wild-draw-four'].includes(card.kind)
          ? adjacent(view, seat, view.direction, 2)
          : next;
    if (responder !== seat && view.players[responder]!.handCount === 1) {
      const known = memory.knownCards[responder] ?? [],
        hint = memory.colorHints[responder];
      if (
        known.some(
          (id) =>
            getCard(id).color === color ||
            getCard(id).color === null ||
            (getCard(id).kind === card.kind &&
              getCard(id).value === card.value),
        )
      )
        score -= 80;
      else if (hint?.color === color) score -= hint.strength * 30;
    }
    return score;
  }
  return [...plays].sort(
    (a, b) =>
      evaluate(b) - evaluate(a) ||
      a.cardId.localeCompare(b.cardId) ||
      String(a.color).localeCompare(String(b.color)),
  )[0]!;
}
export const bot: BotStrategy = {
  id: 'uno-local',
  version: '1.0.0',
  gameId: 'uno',
  rulesVersion: RULES_VERSION,
  difficulties: ['default', 'doubao', 'juewu'],
  validateMemory: (input) => validMemory(input) as JsonValue,
  observe({ view, memory, seatId, difficulty }) {
    const projection = view as UnoView;
    if (projection.self?.seatId !== seatId)
      throw new Error('UNO 策略观察座位不一致。');
    return observe(projection, memory, difficulty) as JsonValue;
  },
  async decide({
    view: inputView,
    actions,
    decision,
    memory,
    difficulty = 'default',
    signal,
  }) {
    const view = inputView as UnoView;
    if (view.self?.seatId !== decision.seatId)
      throw new Error('UNO 策略决策身份不一致。');
    const m = observe(view, memory, difficulty);
    return {
      action: chooseAction(view, actions as Action[], m, difficulty, signal),
      memory: m as JsonValue,
    };
  },
};
