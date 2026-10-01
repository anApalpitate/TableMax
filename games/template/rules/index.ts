import type { GameRules, JsonValue } from '@tablemax/game-sdk';
import { score } from './scoring';
import { validateState, type State } from './state';
import { project } from './project';

export const rules: GameRules = {
  manifest: {
    id: 'template',
    name: '幸运骰子 · 平台验证游戏',
    gameVersion: '1.0.0',
    rulesVersion: 'template-v1',
    sdkVersion: 1,
    stateVersion: 1,
    players: { min: 2, max: 5 },
    assetNamespace: 'template',
  },
  initialize(context) {
    return {
      seats: [...context.seats],
      secrets: Object.fromEntries(
        context.seats.map((s) => [
          s,
          1 + Math.floor(context.random.next() * 6),
        ]),
      ),
      choices: {},
      turn: 0,
      winners: [],
    };
  },
  validateState,
  decisions(input) {
    const s = input as State;
    return s.turn < s.seats.length
      ? [{ id: `choose-${s.turn}`, seatId: s.seats[s.turn]! }]
      : [];
  },
  ended(input) {
    const s = input as State;
    return s.turn === s.seats.length;
  },
  lifecycleActions(input) {
    return rules.ended(input) ? [{ type: 'next-round' }] : [];
  },
  applyLifecycle(input, action, context) {
    if (
      !rules.ended(input) ||
      (action as { type: string }).type !== 'next-round'
    )
      throw new Error('Invalid lifecycle action');
    return {
      state: rules.initialize(context),
      decision: { label: '开始下一局之前', revealedInformation: true },
    };
  },
  validateAction(input): JsonValue {
    const a = input as { type: string; value: number };
    if (a && a.type === 'next-round' && Object.keys(a).length === 1)
      return { type: 'next-round' };
    if (
      !a ||
      a.type !== 'choose' ||
      ![1, 2, 3].includes(a.value) ||
      Object.keys(a).length !== 2
    )
      throw new Error('Invalid action');
    return { type: a.type, value: a.value };
  },
  legalActions(input, seatId) {
    const s = input as State;
    return s.seats[s.turn] === seatId
      ? [1, 2, 3].map((value) => ({ type: 'choose', value }))
      : [];
  },
  apply(input, action, seatId) {
    const state = structuredClone(input) as State;
    if (state.seats[state.turn] !== seatId) throw new Error('Wrong actor');
    state.choices[seatId] = (action as { value: number }).value;
    state.turn++;
    if (state.turn === state.seats.length)
      state.winners = score(
        Object.fromEntries(
          state.seats.map((s) => [s, state.secrets[s]! + state.choices[s]!]),
        ),
      );
    return {
      state,
      decision: {
        label: `座位 ${state.seats.indexOf(seatId) + 1} 选择之前`,
        revealedInformation: state.turn === state.seats.length,
      },
    };
  },
  project(input, viewer) {
    return project(input as State, viewer);
  },
};
