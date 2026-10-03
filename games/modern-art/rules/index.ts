import type {
  GameRules,
  JsonValue,
  PendingDecision,
  RuleContext,
} from '../../../packages/game-sdk/src';
import { getCard, CARD_IDS } from '../data/catalog';
import type { Action } from '../ui/view';
import { initialize, AuctionFlow, MatchFlow } from './engine';
import { actingSeats, RULES_VERSION, validateState, type State } from './state';
import { project } from './project';
export type { Action } from '../ui/view';

export function validateAction(input: unknown): Action {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('动作格式无效。');
  const a = input as Record<string, unknown>;
  const keys = Object.keys(a).sort().join(',');
  if (
    ['offer', 'add-double'].includes(a.type as string) &&
    keys === 'cardId,type' &&
    typeof a.cardId === 'string' &&
    CARD_IDS.includes(a.cardId)
  )
    return { type: a.type as 'offer' | 'add-double', cardId: a.cardId };
  if (
    ['bid', 'sealed-bid', 'set-price'].includes(a.type as string) &&
    keys === 'amount,type' &&
    Number.isSafeInteger(a.amount) &&
    (a.amount as number) >= 0 &&
    (a.amount as number) <= 8900
  )
    return {
      type: a.type as 'bid' | 'sealed-bid' | 'set-price',
      amount: a.amount as number,
    };
  if (
    ['decline-double', 'pass', 'buy', 'next-round'].includes(
      a.type as string,
    ) &&
    keys === 'type'
  )
    return { type: a.type as 'pass' | 'decline-double' | 'buy' | 'next-round' };
  throw new Error('动作格式无效。');
}
export function decisions(s: State): PendingDecision[] {
  const a = s.auction;
  return actingSeats(s).map((seatId) => {
    if (a?.kind === 'sealed')
      return {
        id: `${a.id}:sealed:${seatId}`,
        seatId,
        concurrencyGroup: `${a.id}:sealed`,
      };
    return {
      id: `${s.round}:${s.auctionSerial}:${s.phase}:${a?.bidRevision ?? 0}:${a?.index ?? 0}:${seatId}`,
      seatId,
    };
  });
}
export function legalActions(s: State, seat: string): Action[] {
  if (!actingSeats(s).includes(seat)) return [];
  const a = s.auction;
  if (s.phase === 'offer')
    return s.hands[seat]!.map((cardId) => ({ type: 'offer', cardId }));
  if (s.phase === 'double')
    return [
      { type: 'decline-double' },
      ...s.hands[seat]!.filter(
        (id) =>
          getCard(id).artistId === getCard(a!.cards[0]!).artistId &&
          getCard(id).auctionKind !== 'double',
      ).map((cardId) => ({ type: 'add-double' as const, cardId })),
    ];
  const cash = s.cash[seat]!;
  if (a!.kind === 'fixed') {
    if (a!.fixedPrice === null)
      return Array.from({ length: cash + 1 }, (_, amount) => ({
        type: 'set-price',
        amount,
      }));
    return cash >= a!.fixedPrice
      ? [{ type: 'pass' }, { type: 'buy' }]
      : [{ type: 'pass' }];
  }
  if (a!.kind === 'sealed')
    return Array.from({ length: cash + 1 }, (_, amount) => ({
      type: 'sealed-bid',
      amount,
    }));
  return [
    { type: 'pass' },
    ...Array.from(
      { length: Math.max(0, cash - a!.currentBid) },
      (_, index) => ({
        type: 'bid' as const,
        amount: a!.currentBid + index + 1,
      }),
    ),
  ];
}
function verifyContext(state: State, context: RuleContext) {
  if (JSON.stringify(state.seatOrder) !== JSON.stringify(context.seats))
    throw new Error('座位顺序不一致。');
}
export const rules: GameRules = {
  manifest: {
    id: 'modern-art',
    name: '现代艺术',
    gameVersion: '1.0.0',
    rulesVersion: RULES_VERSION,
    sdkVersion: 1,
    stateVersion: 1,
    players: { min: 3, max: 5 },
    assetNamespace: 'modern-art',
  },
  initialize,
  validateState,
  decisions(input) {
    return decisions(input as State);
  },
  ended(input) {
    return (input as State).phase === 'ended';
  },
  validateAction,
  legalActions(input, seat) {
    return legalActions(input as State, seat);
  },
  lifecycleActions(input) {
    return (input as State).phase === 'round-result'
      ? [{ type: 'next-round' }]
      : [];
  },
  applyLifecycle(input, inputAction, context) {
    const before = input as State;
    verifyContext(before, context);
    if (
      before.phase !== 'round-result' ||
      validateAction(inputAction).type !== 'next-round'
    )
      throw new Error('当前不能进入下一轮。');
    const state = structuredClone(before);
    state.step++;
    new MatchFlow(state).nextRound();
    return {
      state,
      decision: {
        label: `开始第 ${state.round} 轮之前`,
        revealedInformation: state.round !== 4,
        roundNumber: before.round,
      },
      events: [{ kind: 'effect-complete', text: state.history.at(-1)!.text }],
    };
  },
  apply(input, inputAction, seat, context) {
    const before = input as State;
    verifyContext(before, context);
    const action = validateAction(inputAction);
    if (
      !legalActions(before, seat).some(
        (entry) => JSON.stringify(entry) === JSON.stringify(action),
      )
    )
      throw new Error('当前不能执行此拍卖动作。');
    const state = structuredClone(before);
    state.step++;
    new AuctionFlow(state).apply(action, seat);
    return {
      state,
      decision: {
        label: `座位 ${before.seatOrder.indexOf(seat) + 1} ${before.phase === 'double' ? '决定组合拍卖' : before.auction?.kind === 'sealed' ? '提交暗标' : '拍卖选择'}之前`,
        revealedInformation:
          ['offer', 'add-double', 'bid', 'set-price'].includes(action.type) ||
          (before.auction?.kind === 'sealed' &&
            state.auction?.id !== before.auction.id),
        roundNumber: before.round,
      },
      events: state.history
        .filter((entry) => Number(entry.id.slice(4)) > before.logSerial)
        .map((entry) => ({
          kind:
            entry.verb === 'round-result'
              ? ('round-result' as const)
              : ('effect-complete' as const),
          text: entry.text,
        })),
    };
  },
  project(input, viewer): JsonValue {
    return project(input as State, viewer);
  },
};
