import type { RuleContext } from '@tablemax/game-sdk';
import {
  CARD_IDS,
  cardLabel,
  getCard,
  COLOR_LABELS,
  RULES_VERSION,
} from '../data/catalog';
import type { Action, LatestAction } from '../types';
import { scoreRound } from './scoring';
import type { State } from './state';
export function shuffle<T>(values: readonly T[], context: RuleContext): T[] {
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(context.random.next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}
export function nextSeat(s: State, seat: string, steps = 1): string {
  return s.seats[
    (s.seats.indexOf(seat) + s.direction * steps + s.seats.length * 2) %
      s.seats.length
  ]!;
}
export function matches(s: State, id: string): boolean {
  const card = getCard(id),
    top = getCard(s.discard.at(-1)!);
  return (
    card.color === null ||
    card.color === s.activeColor ||
    (card.kind === 'number'
      ? top.kind === 'number' && card.value === top.value
      : card.kind === top.kind)
  );
}
/** Mutates only an already-owned next-state clone. Never exposes card identities. */
export function takeCards(
  s: State,
  seat: string,
  count: number,
  context: RuleContext,
): number {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (!s.deck.length && s.discard.length > 1) {
      const top = s.discard.pop()!;
      s.deck = shuffle(s.discard, context);
      s.discard = [top];
    }
    const id = s.deck.pop();
    if (!id) break;
    s.hands[seat]!.push(id);
    drawn++;
  }
  if (drawn) s.unoDeclared[seat] = false;
  return drawn;
}
function latest(
  s: State,
  actor: string | null,
  verb: string,
  text: string,
  details: Partial<
    Pick<LatestAction, 'card' | 'color' | 'targets' | 'drawCount'>
  > = {},
): void {
  s.latest = {
    serial: ++s.actionSerial,
    actor,
    verb,
    text,
    card: null,
    color: null,
    targets: [],
    drawCount: 0,
    ...details,
  };
}
function advance(s: State, seat: string): void {
  s.turnSeat = seat;
  s.turnNumber++;
  s.stage = 'turn';
  s.drawnCardId = null;
}
function finishRound(s: State, winner: string): void {
  const result = scoreRound(s.seats, s.hands, winner, s.scores, s.roundNumber);
  s.results.push(result);
  s.scores = result.scores;
  s.wins[winner]!++;
  s.winners = s.seats.filter((seat) => s.scores[seat]! >= 500);
  s.phase = s.winners.length ? 'ended' : 'round-result';
  s.stage = 'result';
  s.turnSeat = null;
  s.drawFour = null;
  s.drawnCardId = null;
  s.unoWindow = null;
  s.latest!.text += `；座位 ${s.seats.indexOf(winner) + 1} 赢得第 ${s.roundNumber} 小局，获得 ${result.points} 分${s.phase === 'ended' ? '，达到 500 分赢得整场' : ''}。`;
}
function dealRound(s: State, context: RuleContext): State {
  s.deck = shuffle(CARD_IDS, context);
  s.discard = [];
  s.hands = Object.fromEntries(s.seats.map((seat) => [seat, []]));
  s.unoDeclared = Object.fromEntries(s.seats.map((seat) => [seat, false]));
  s.phase = 'playing';
  s.stage = 'turn';
  s.direction = 1;
  s.turnNumber = 1;
  s.drawnCardId = null;
  s.drawFour = null;
  s.unoWindow = null;
  s.evidence = null;
  s.winners = [];
  // Deal clockwise from the dealer's left, one card at a time.
  for (let n = 0; n < 7; n++)
    for (let i = 1; i <= s.seats.length; i++)
      s.hands[nextSeat(s, s.dealer, i)]!.push(s.deck.pop()!);
  let opening = s.deck.pop()!;
  const rejected: string[] = [];
  // Set +4 aside while finding the next opening card, then return and shuffle
  // the DRAW pile. This preserves all 108 cards and has a bounded four retries.
  while (getCard(opening).kind === 'wild-draw-four') {
    rejected.push(opening);
    opening = s.deck.pop()!;
  }
  if (rejected.length) s.deck = shuffle([...s.deck, ...rejected], context);
  s.discard = [opening];
  const card = getCard(opening);
  s.activeColor = card.color;
  s.turnSeat = nextSeat(s, s.dealer);
  let targets: string[] = [],
    drawCount = 0,
    note = '';
  if (card.kind === 'reverse') {
    s.direction = -1;
    s.turnSeat = s.dealer;
    note = '，开局反转，发牌者先行动';
  } else if (card.kind === 'skip') {
    targets = [s.turnSeat];
    s.turnSeat = nextSeat(s, s.turnSeat);
    note = '，首位玩家被跳过';
  } else if (card.kind === 'draw-two') {
    targets = [s.turnSeat];
    drawCount = takeCards(s, s.turnSeat, 2, context);
    s.turnSeat = nextSeat(s, s.turnSeat);
    note = '，首位玩家摸 2 张并跳过';
  } else if (card.kind === 'wild') {
    s.stage = 'choose-color';
    note = '，首位玩家选择开局颜色';
  }
  latest(
    s,
    null,
    'round-started',
    `第 ${s.roundNumber} 小局开始，开局牌 ${cardLabel(opening)}${note}。`,
    { card: { ...card }, color: s.activeColor, targets, drawCount },
  );
  return s;
}
export function initialize(context: RuleContext): State {
  if (
    context.seats.length < 2 ||
    context.seats.length > 6 ||
    new Set(context.seats).size !== context.seats.length
  )
    throw new Error('经典 UNO 支持 2–6 个平台座位。');
  const pick = shuffle(CARD_IDS, context).slice(0, context.seats.length),
    ranks = pick.map((id) => getCard(id).value ?? 0);
  const highest = Math.max(...ranks);
  let tied = context.seats.filter((_, i) => ranks[i] === highest);
  // Publisher does not specify tie breaking: tied seats re-draw until unique.
  for (let attempt = 0; tied.length > 1 && attempt < 8; attempt++) {
    const retry = shuffle(CARD_IDS, context)
        .slice(0, tied.length)
        .map((id) => getCard(id).value ?? 0),
      max = Math.max(...retry);
    tied = tied.filter((_, i) => retry[i] === max);
  }
  const seats = [...context.seats],
    zero = Object.fromEntries(seats.map((seat) => [seat, 0]));
  const s: State = {
    rulesVersion: RULES_VERSION,
    stateVersion: 1,
    seats,
    phase: 'playing',
    stage: 'turn',
    roundNumber: 1,
    turnNumber: 1,
    actionSerial: 0,
    dealer: tied[0]!,
    turnSeat: null,
    direction: 1,
    activeColor: null,
    deck: [],
    discard: [],
    hands: {},
    scores: zero,
    wins: { ...zero },
    unoDeclared: {},
    drawnCardId: null,
    drawFour: null,
    unoWindow: null,
    evidence: null,
    results: [],
    winners: [],
    latest: null,
  };
  return dealRound(s, context);
}
export function nextRound(before: State, context: RuleContext): State {
  if (before.phase !== 'round-result')
    throw new Error('当前不能开始 UNO 下一小局。');
  const s = structuredClone(before);
  s.roundNumber++;
  s.dealer = s.seats[(s.seats.indexOf(s.dealer) + 1) % s.seats.length]!;
  return dealRound(s, context);
}
export function applyAction(
  before: State,
  action: Action,
  seat: string,
  context: RuleContext,
): State {
  const s = structuredClone(before),
    position = s.seats.indexOf(seat) + 1;
  // Evidence remains available only to its authorized challenger until next round.
  if (action.type === 'declare-uno') {
    s.unoDeclared[seat] = true;
    s.unoWindow = null;
    latest(s, seat, action.type, `座位 ${position} 补喊 UNO。`);
    return s;
  }
  if (action.type === 'catch-uno') {
    s.unoWindow = null;
    const count = takeCards(s, action.target, 2, context);
    latest(
      s,
      seat,
      action.type,
      `座位 ${position} 抓住座位 ${s.seats.indexOf(action.target) + 1} 漏喊 UNO，后者摸 ${count} 张。`,
      { targets: [action.target], drawCount: count },
    );
    return s;
  }
  // A saved card play, draw or +4 response begins the next player's turn.
  s.unoWindow = null;
  if (action.type === 'choose-color') {
    s.activeColor = action.color;
    s.stage = 'turn';
    latest(
      s,
      seat,
      action.type,
      `座位 ${position} 选择${COLOR_LABELS[action.color]}色开局。`,
      { color: action.color },
    );
    return s;
  }
  if (
    action.type === 'accept-draw-four' ||
    action.type === 'challenge-draw-four'
  ) {
    const claim = s.drawFour!;
    const challenged = action.type === 'challenge-draw-four',
      guilty = challenged && claim.guilty;
    if (challenged)
      s.evidence = {
        challenger: seat,
        offender: claim.offender,
        previousColor: claim.previousColor,
        cardIds: [...claim.evidenceIds],
        guilty: claim.guilty,
      };
    const target = guilty ? claim.offender : seat,
      count = takeCards(s, target, guilty ? 4 : challenged ? 6 : 4, context);
    s.drawFour = null;
    advance(s, guilty ? seat : nextSeat(s, seat));
    latest(
      s,
      seat,
      action.type,
      challenged
        ? `座位 ${position} 质疑 +4 ${guilty ? '成功' : '失败'}，座位 ${s.seats.indexOf(target) + 1} 摸 ${count} 张${guilty ? '，质疑者正常行动' : '并跳过'}。`
        : `座位 ${position} 接受 +4，摸 ${count} 张并跳过。`,
      { targets: [target], drawCount: count, color: s.activeColor },
    );
    if (!s.hands[claim.offender]!.length) finishRound(s, claim.offender);
    return s;
  }
  if (action.type === 'draw') {
    const count = takeCards(s, seat, 1, context),
      id = s.hands[seat]!.at(-1)!;
    if (count && matches(s, id)) {
      s.drawnCardId = id;
      s.stage = 'drawn';
    } else advance(s, nextSeat(s, seat));
    latest(
      s,
      seat,
      action.type,
      count
        ? `座位 ${position} 摸 1 张。`
        : `座位 ${position} 无可摸牌，本回合结束。`,
      { drawCount: count },
    );
    return s;
  }
  if (action.type === 'pass') {
    advance(s, nextSeat(s, seat));
    latest(
      s,
      seat,
      action.type,
      `座位 ${position} 保留刚摸到的牌，本回合结束。`,
    );
    return s;
  }
  if (action.type !== 'play') throw new Error('UNO 游戏动作无效。');
  const card = getCard(action.cardId),
    previousColor = s.activeColor!,
    hand = s.hands[seat]!;
  hand.splice(hand.indexOf(action.cardId), 1);
  s.discard.push(action.cardId);
  s.drawnCardId = null;
  s.stage = 'turn';
  s.unoDeclared[seat] = hand.length === 1 && action.uno === true;
  if (hand.length === 1 && !s.unoDeclared[seat]) s.unoWindow = { seatId: seat };
  s.activeColor = card.color ?? action.color!;
  let targets: string[] = [],
    drawCount = 0,
    suffix = '';
  if (card.kind === 'wild-draw-four') {
    const target = nextSeat(s, seat);
    targets = [target];
    s.drawFour = {
      offender: seat,
      target,
      previousColor,
      chosenColor: s.activeColor,
      evidenceIds: [...hand],
      guilty: hand.some((id) => getCard(id).color === previousColor),
    };
    s.turnSeat = target;
    s.turnNumber++;
    s.stage = 'draw-four';
    suffix = '，等待下一位接受或质疑';
  } else {
    let steps = 1;
    if (card.kind === 'reverse') {
      s.direction = s.direction === 1 ? -1 : 1;
      if (s.seats.length === 2) steps = 2;
      suffix = '，方向反转';
    }
    if (card.kind === 'skip') {
      steps = 2;
      targets = [nextSeat(s, seat)];
      suffix = '，下一位被跳过';
    }
    if (card.kind === 'draw-two') {
      steps = 2;
      const target = nextSeat(s, seat);
      targets = [target];
      drawCount = takeCards(s, target, 2, context);
      suffix = `，下一位摸 ${drawCount} 张并跳过`;
    }
    advance(s, nextSeat(s, seat, steps));
  }
  latest(
    s,
    seat,
    'play',
    `座位 ${position} 打出 ${cardLabel(action.cardId)}${card.color ? '' : `，选择${COLOR_LABELS[s.activeColor]}色`}${suffix}${s.unoDeclared[seat] ? '，喊 UNO' : ''}。`,
    { card: { ...card }, color: s.activeColor, targets, drawCount },
  );
  // Forced +2 draw already happened. +4 settlement waits for the target's choice.
  if (!hand.length && card.kind !== 'wild-draw-four') finishRound(s, seat);
  return s;
}
