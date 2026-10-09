import type {
  GameRules,
  JsonValue,
  PendingDecision,
} from '../../../packages/game-sdk/src';
import { RULES_VERSION } from '../data/catalog';
import { normalizeTable } from '../shared/melds';
import { findLegalPlay, inspectTurn } from '../shared/turn';
import type { Action, JokerReleaseProof } from '../types';
import { applyAction, initialize, nextGame } from './engine';
import { project } from './project';
import { validateState, type State } from './state';
export { initialize, project, validateState };
export type { State } from './state';
export type { Action } from '../types';

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).sort().join(',') === [...keys].sort().join(',');
export function validateAction(input: unknown): Action {
  if (!object(input)) throw new Error('拉密动作格式无效。');
  if (
    exact(input, ['type']) &&
    ['draw', 'pass', 'next-game'].includes(input.type as string)
  )
    return { type: input.type as 'draw' | 'pass' | 'next-game' };
  if (
    input.type !== 'submit-turn' ||
    !exact(
      input,
      input.releases === undefined
        ? ['type', 'table']
        : ['type', 'table', 'releases'],
    )
  )
    throw new Error('拉密整回合动作格式无效。');
  const table = normalizeTable(
    input.table as Parameters<typeof normalizeTable>[0],
  );
  const releases: JokerReleaseProof[] = [];
  if (input.releases !== undefined) {
    if (!Array.isArray(input.releases) || input.releases.length > 2)
      throw new Error('百搭证明数量无效。');
    for (const proof of input.releases) {
      if (
        !object(proof) ||
        !exact(proof, ['jokerId', 'replacementSets']) ||
        !['joker-a', 'joker-b'].includes(proof.jokerId as string)
      )
        throw new Error('百搭释放证明格式无效。');
      releases.push({
        jokerId: proof.jokerId as string,
        replacementSets: normalizeTable(
          proof.replacementSets as Parameters<typeof normalizeTable>[0],
        ),
      });
    }
    if (new Set(releases.map((r) => r.jokerId)).size !== releases.length)
      throw new Error('百搭证明不能重复。');
  }
  return {
    type: 'submit-turn',
    table,
    ...(releases.length ? { releases } : {}),
  };
}
export function decisions(s: State): PendingDecision[] {
  return s.phase === 'playing' && s.turnSeat
    ? [
        {
          id: `rummikub:${s.gameNumber}:${s.turnNumber}:${s.turnSeat}`,
          seatId: s.turnSeat,
        },
      ]
    : [];
}
export function isLegalAction(s: State, input: unknown, seat: string): boolean {
  try {
    if (s.phase !== 'playing' || s.turnSeat !== seat) return false;
    const action = validateAction(input);
    if (action.type === 'draw') return s.pool.length > 0;
    if (action.type === 'pass') {
      if (s.pool.length) return false;
      const search = findLegalPlay({
        rack: s.racks[seat]!,
        table: s.table,
        opened: s.opened[seat]!,
      });
      return search.complete && !search.action;
    }
    if (action.type !== 'submit-turn') return false;
    inspectTurn(
      { rack: s.racks[seat]!, table: s.table, opened: s.opened[seat]! },
      action,
    );
    return true;
  } catch {
    return false;
  }
}
export function legalActions(s: State, seat: string): Action[] {
  if (s.phase !== 'playing' || s.turnSeat !== seat) return [];
  const search = findLegalPlay(
    { rack: s.racks[seat]!, table: s.table, opened: s.opened[seat]! },
    s.pool.length ? { maxNodes: 100 } : {},
  );
  return [
    ...(search.action ? [search.action] : []),
    ...(s.pool.length
      ? [{ type: 'draw' as const }]
      : search.complete && !search.action
        ? [{ type: 'pass' as const }]
        : []),
  ];
}
export const rules: GameRules = {
  manifest: {
    id: 'rummikub',
    name: '拉密',
    gameVersion: '1.0.0',
    rulesVersion: RULES_VERSION,
    sdkVersion: 1,
    stateVersion: 1,
    players: { min: 2, max: 4 },
    assetNamespace: 'rummikub',
    decisionTimer: true,
  },
  initialize: initialize as GameRules['initialize'],
  validateState: validateState as GameRules['validateState'],
  validateAction,
  decisions: (s) => decisions(s as State),
  ended: (s) => (s as State).phase === 'ended',
  isLegalAction: (s, a, seat) => isLegalAction(s as State, a, seat),
  legalActions: (s, seat) => legalActions(s as State, seat),
  lifecycleActions: (s) =>
    (s as State).phase === 'game-result' ? [{ type: 'next-game' }] : [],
  applyLifecycle(input, inputAction, context) {
    const action = validateAction(inputAction);
    if (action.type !== 'next-game')
      throw new Error('当前没有该生命周期操作。');
    const before = input as State,
      state = nextGame(before, context);
    return {
      state: state as JsonValue,
      decision: {
        label: `第 ${state.gameNumber} 局开始之前`,
        revealedInformation: true,
        roundNumber: before.gameNumber,
      },
      events: [{ kind: 'game-started', text: state.latest!.text }],
    };
  },
  apply(input, inputAction, seat, context) {
    const before = input as State,
      action = validateAction(inputAction);
    if (!isLegalAction(before, action, seat))
      throw new Error('当前不能执行该拉密动作。');
    const state = applyAction(before, action, seat, context);
    const latest = state.latest!;
    return {
      state: state as JsonValue,
      decision: {
        label: `第 ${before.gameNumber} 局，座位 ${before.seats.indexOf(seat) + 1} ${action.type === 'submit-turn' ? '整回合出牌' : action.type === 'draw' ? '摸牌' : '无牌可出'}之前`,
        revealedInformation: action.type !== 'pass',
        roundNumber: before.gameNumber,
      },
      events: [
        {
          kind: state.phase === 'playing' ? 'turn-complete' : 'game-ended',
          text: latest.text,
          action: {
            actor: seat,
            verb: latest.verb,
            cardCategory:
              action.type === 'submit-turn'
                ? `${latest.placedTileIds.length}张数字牌`
                : null,
            ability: null,
            targets: [],
          },
        },
      ],
    };
  },
  project: (s, viewer) => project(s as State, viewer) as JsonValue,
};
