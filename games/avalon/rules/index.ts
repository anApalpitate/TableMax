import type { GameRules, JsonValue, PendingDecision } from '@tablemax/game-sdk';
import {
  COURT_RULES_VERSION,
  RULES_VERSION,
  type Action,
  type Variant,
} from '../types';
import { applyAction, assassinSeat, goodSeats, initialize } from './engine';
import { project } from './project';
import {
  alignment,
  exact,
  object,
  questSizes,
  validateState,
  type State,
} from './state';
export { initialize, project, validateState };
export type { State } from './state';
export type { Action } from '../types';
export function validateAction(input: unknown): Action {
  if (!object(input) || typeof input.type !== 'string')
    throw new Error('阿瓦隆动作格式无效。');
  if (input.type === 'acknowledge' && exact(input, ['type']))
    return { type: 'acknowledge' };
  if (
    input.type === 'propose-team' &&
    exact(input, ['type', 'team']) &&
    Array.isArray(input.team) &&
    input.team.length >= 2 &&
    input.team.length <= 4 &&
    new Set(input.team).size === input.team.length &&
    input.team.every(
      (seat) =>
        typeof seat === 'string' && seat.length > 0 && seat.length <= 128,
    )
  )
    return { type: 'propose-team', team: [...input.team] as string[] };
  if (
    input.type === 'vote-team' &&
    exact(input, ['type', 'vote']) &&
    (input.vote === 'approve' || input.vote === 'reject')
  )
    return { type: 'vote-team', vote: input.vote };
  if (
    input.type === 'quest-card' &&
    exact(input, ['type', 'card']) &&
    (input.card === 'success' || input.card === 'fail')
  )
    return { type: 'quest-card', card: input.card };
  if (
    input.type === 'assassinate' &&
    exact(input, ['type', 'target']) &&
    typeof input.target === 'string' &&
    input.target.length > 0 &&
    input.target.length <= 128
  )
    return { type: 'assassinate', target: input.target };
  throw new Error('阿瓦隆动作格式无效。');
}
function combinations(seats: readonly string[], size: number): string[][] {
  if (!size) return [[]];
  return seats.flatMap((seat, index) =>
    combinations(seats.slice(index + 1), size - 1).map((rest) => [
      seat,
      ...rest,
    ]),
  );
}
export function legalActions(s: State, seat: string): Action[] {
  if (!s.seats.includes(seat)) return [];
  if (s.phase === 'reveal' && !s.acknowledged.includes(seat))
    return [{ type: 'acknowledge' }];
  if (s.phase === 'team' && s.leader === seat)
    return combinations(
      s.seats,
      questSizes(s.seats.length)[s.questNumber - 1]!,
    ).map((team) => ({ type: 'propose-team', team }));
  if (s.phase === 'vote' && !Object.hasOwn(s.votes, seat))
    return [
      { type: 'vote-team', vote: 'approve' },
      { type: 'vote-team', vote: 'reject' },
    ];
  if (
    s.phase === 'quest' &&
    s.team.includes(seat) &&
    !Object.hasOwn(s.questCards, seat)
  )
    return [
      { type: 'quest-card', card: 'success' },
      ...(alignment(s.roles[seat]!) === 'evil'
        ? [{ type: 'quest-card' as const, card: 'fail' as const }]
        : []),
    ];
  if (s.phase === 'assassinate' && assassinSeat(s) === seat)
    return goodSeats(s).map((target) => ({ type: 'assassinate', target }));
  return [];
}
export function isLegalAction(s: State, raw: unknown, seat: string): boolean {
  try {
    const action = validateAction(raw);
    if (action.type === 'propose-team') {
      if (action.team.some((id) => !s.seats.includes(id))) return false;
      action.team = s.seats.filter((id) => action.team.includes(id));
    }
    return legalActions(s, seat).some(
      (allowed) => JSON.stringify(allowed) === JSON.stringify(action),
    );
  } catch {
    return false;
  }
}
export function decisions(s: State): PendingDecision[] {
  const group = ['reveal', 'vote', 'quest'].includes(s.phase)
    ? `avalon:${s.phase}:${s.questNumber}:${s.proposalNumber}`
    : undefined;
  return s.seats
    .filter((seat) => legalActions(s, seat).length)
    .map((seat) => ({
      id: `avalon:${s.phase}:${s.questNumber}:${s.proposalNumber}:${seat}`,
      seatId: seat,
      ...(group ? { concurrencyGroup: group } : {}),
    }));
}
function createRules(variant: Variant): GameRules {
  return {
    manifest: {
      id: 'avalon',
      name: '阿瓦隆',
      gameVersion: '1.0.0',
      rulesVersion: variant === 'court' ? COURT_RULES_VERSION : RULES_VERSION,
      sdkVersion: 1,
      stateVersion: 1,
      players: { min: 5, max: 6 },
      assetNamespace: 'avalon',
      decisionTimer: true,
    },
    initialize: (context) => initialize(context, variant) as JsonValue,
    validateState: (input, seats) =>
      validateState(input, seats, variant) as JsonValue,
    validateAction,
    decisions: (input) => decisions(input as State),
    ended: (input) => (input as State).phase === 'ended',
    legalActions: (input, seat) => legalActions(input as State, seat),
    isLegalAction: (input, action, seat) =>
      isLegalAction(input as State, action, seat),
    lifecycleActions: () => [],
    applyLifecycle() {
      throw new Error('阿瓦隆没有中局管理动作，请结束后再玩一局。');
    },
    apply(input, raw, seat, context) {
      const before = input as State,
        action = validateAction(raw);
      if (
        JSON.stringify(context.seats) !== JSON.stringify(before.seats) ||
        !isLegalAction(before, action, seat)
      )
        throw new Error('当前不能执行该阿瓦隆动作。');
      const state = applyAction(before, action, seat),
        latest = state.latest!;
      const revealed =
        action.type === 'propose-team' ||
        action.type === 'assassinate' ||
        (action.type === 'vote-team' && state.phase !== 'vote') ||
        (action.type === 'quest-card' && state.phase !== 'quest');
      const label =
        action.type === 'quest-card'
          ? '密封任务牌'
          : action.type === 'vote-team'
            ? '密封投票'
            : action.type === 'acknowledge'
              ? '确认身份'
              : action.type === 'assassinate'
                ? '指认目标'
                : '提名队伍';
      return {
        state: state as JsonValue,
        decision: {
          label: `第 ${before.questNumber} 次任务，座位 ${before.seats.indexOf(seat) + 1} ${label}之前`,
          revealedInformation: revealed,
          roundNumber: before.questNumber,
        },
        events: [
          {
            kind: latest.verb,
            text: latest.text,
            action: {
              actor: seat,
              verb: latest.verb,
              cardCategory: null,
              ability: null,
              targets: latest.targets.map((target) => ({
                seat: target,
                slots: [],
              })),
            },
          },
        ],
      };
    },
    project: (input, viewer) => project(input as State, viewer) as JsonValue,
  };
}
export const rules = createRules('classic');
export const rulesByVariant = { classic: rules, court: createRules('court') };
