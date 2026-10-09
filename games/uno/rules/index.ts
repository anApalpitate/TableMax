import type { GameRules, JsonValue, PendingDecision } from '@tablemax/game-sdk';
import { COLORS, type Action } from '../types';
import { getCard, RULES_VERSION } from '../data/catalog';
import { applyAction, initialize, matches, nextRound } from './engine';
import { project } from './project';
import { exact, object, validateState, type State } from './state';
const ACTION_LABELS: Record<Action['type'], string> = {
  play: '出牌',
  draw: '摸牌',
  pass: '保留刚摸牌',
  'choose-color': '选择颜色',
  'accept-draw-four': '接受 +4',
  'challenge-draw-four': '质疑 +4',
  'declare-uno': '补喊 UNO',
  'catch-uno': '抓漏喊 UNO',
  'next-round': '开始下一小局',
};
export { initialize, project, validateState };
export type { State } from './state';
export type { Action } from '../types';
export function validateAction(input: unknown): Action {
  if (!object(input) || typeof input.type !== 'string')
    throw new Error('UNO 动作格式无效。');
  if (
    exact(input, ['type']) &&
    [
      'draw',
      'pass',
      'accept-draw-four',
      'challenge-draw-four',
      'declare-uno',
      'next-round',
    ].includes(input.type)
  )
    return {
      type: input.type as
        | 'draw'
        | 'pass'
        | 'accept-draw-four'
        | 'challenge-draw-four'
        | 'declare-uno'
        | 'next-round',
    };
  if (
    input.type === 'catch-uno' &&
    exact(input, ['type', 'target']) &&
    typeof input.target === 'string' &&
    input.target.length > 0 &&
    input.target.length <= 128
  )
    return { type: 'catch-uno', target: input.target };
  if (
    input.type === 'choose-color' &&
    exact(input, ['type', 'color']) &&
    COLORS.includes(input.color as (typeof COLORS)[number])
  )
    return {
      type: 'choose-color',
      color: input.color as (typeof COLORS)[number],
    };
  if (
    input.type === 'play' &&
    typeof input.cardId === 'string' &&
    (input.uno === undefined || typeof input.uno === 'boolean')
  ) {
    const card = getCard(input.cardId);
    const keys = [
      'type',
      'cardId',
      ...(input.color === undefined ? [] : ['color']),
      ...(input.uno === undefined ? [] : ['uno']),
    ];
    if (
      !exact(input, keys) ||
      (card.color === null
        ? !COLORS.includes(input.color as (typeof COLORS)[number])
        : input.color !== undefined)
    )
      throw new Error('UNO 出牌参数无效。');
    return {
      type: 'play',
      cardId: card.id,
      ...(card.color === null
        ? { color: input.color as (typeof COLORS)[number] }
        : {}),
      ...(input.uno === undefined ? {} : { uno: input.uno as boolean }),
    };
  }
  throw new Error('UNO 动作格式无效。');
}
export function legalActions(s: State, seat: string): Action[] {
  if (s.phase !== 'playing' || !s.seats.includes(seat)) return [];
  const actions: Action[] = [];
  if (s.unoWindow)
    actions.push(
      seat === s.unoWindow.seatId
        ? { type: 'declare-uno' }
        : { type: 'catch-uno', target: s.unoWindow.seatId },
    );
  if (s.turnSeat !== seat) return actions;
  if (s.stage === 'choose-color')
    return [
      ...actions,
      ...COLORS.map((color) => ({ type: 'choose-color' as const, color })),
    ];
  if (s.stage === 'draw-four')
    return [
      ...actions,
      { type: 'accept-draw-four' },
      { type: 'challenge-draw-four' },
    ];
  if (s.stage !== 'turn' && s.stage !== 'drawn') return actions;
  const hand = s.stage === 'drawn' ? [s.drawnCardId!] : s.hands[seat]!;
  for (const id of hand) {
    if (!matches(s, id)) continue;
    const card = getCard(id),
      variants =
        card.color === null
          ? COLORS.map((color) => ({
              type: 'play' as const,
              cardId: id,
              color,
            }))
          : [{ type: 'play' as const, cardId: id }];
    for (const action of variants) {
      actions.push(action);
      if (s.hands[seat]!.length === 2) actions.push({ ...action, uno: true });
    }
  }
  actions.push(s.stage === 'drawn' ? { type: 'pass' } : { type: 'draw' });
  return actions;
}
export function isLegalAction(s: State, input: unknown, seat: string): boolean {
  try {
    const action = validateAction(input);
    // Explicit false is normalized by intent, without expanding the bounded list.
    const comparable =
      action.type === 'play' && action.uno === false
        ? {
            type: action.type,
            cardId: action.cardId,
            ...(action.color ? { color: action.color } : {}),
          }
        : action;
    return legalActions(s, seat).some(
      (a) => JSON.stringify(a) === JSON.stringify(comparable),
    );
  } catch {
    return false;
  }
}
export function decisions(s: State): PendingDecision[] {
  if (s.phase !== 'playing') return [];
  // UNO race responses and the current turn conflict, so there is no concurrencyGroup.
  return s.seats
    .filter((seat) => legalActions(s, seat).length)
    .map((seat) => ({
      id: `uno:${s.roundNumber}:${s.turnNumber}:${s.actionSerial}:${seat}`,
      seatId: seat,
    }));
}
export const rules: GameRules = {
  manifest: {
    id: 'uno',
    name: 'UNO',
    gameVersion: '1.0.0',
    rulesVersion: RULES_VERSION,
    sdkVersion: 1,
    stateVersion: 1,
    players: { min: 2, max: 6 },
    assetNamespace: 'uno',
    decisionTimer: true,
  },
  initialize: initialize as GameRules['initialize'],
  validateState: validateState as GameRules['validateState'],
  validateAction,
  decisions: (s) => decisions(s as State),
  ended: (s) => (s as State).phase === 'ended',
  legalActions: (s, seat) => legalActions(s as State, seat),
  isLegalAction: (s, a, seat) => isLegalAction(s as State, a, seat),
  lifecycleActions: (s) =>
    (s as State).phase === 'round-result' ? [{ type: 'next-round' }] : [],
  applyLifecycle(input, inputAction, context) {
    const before = input as State,
      action = validateAction(inputAction);
    if (action.type !== 'next-round')
      throw new Error('当前没有该 UNO 生命周期操作。');
    const state = nextRound(before, context);
    return {
      state: state as JsonValue,
      decision: {
        label: `第 ${state.roundNumber} 小局开始之前`,
        revealedInformation: true,
        roundNumber: before.roundNumber,
      },
      events: [{ kind: 'round-started', text: state.latest!.text }],
    };
  },
  apply(input, inputAction, seat, context) {
    const before = input as State,
      action = validateAction(inputAction);
    if (!isLegalAction(before, action, seat))
      throw new Error('当前不能执行该 UNO 动作。');
    const state = applyAction(before, action, seat, context),
      latest = state.latest!;
    return {
      state: state as JsonValue,
      decision: {
        label: `第 ${before.roundNumber} 小局，座位 ${before.seats.indexOf(seat) + 1} ${ACTION_LABELS[action.type]}之前`,
        revealedInformation: [
          'play',
          'draw',
          'accept-draw-four',
          'challenge-draw-four',
          'catch-uno',
        ].includes(action.type),
        roundNumber: before.roundNumber,
      },
      events: [
        {
          kind:
            state.phase === 'playing'
              ? latest.verb
              : state.phase === 'ended'
                ? 'match-ended'
                : 'round-ended',
          text: latest.text,
          action: {
            actor: seat,
            verb: latest.verb,
            cardCategory: latest.card
              ? latest.card.kind === 'number'
                ? `${latest.card.color}-${latest.card.value}`
                : latest.card.kind
              : null,
            ability:
              latest.card?.kind === 'number'
                ? null
                : (latest.card?.kind ?? null),
            targets: latest.targets.map((target) => ({
              seat: target,
              slots: [],
            })),
          },
        },
      ],
    };
  },
  project: (s, viewer) => project(s as State, viewer) as JsonValue,
};
