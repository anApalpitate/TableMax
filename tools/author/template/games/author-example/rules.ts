import type { GameRules } from '@tablemax/game-sdk';
type State = { seats: string[]; turn: number; total: number };
type Action = { type: 'add'; value: number };
export const rules: GameRules<State, Action, State> = {
  manifest: {
    id: 'author-example',
    name: '独立作者示例',
    gameVersion: '1.0.0',
    rulesVersion: 'example-1',
    sdkVersion: 1,
    stateVersion: 1,
    players: { min: 2, max: 2 },
    assetNamespace: 'author-example',
  },
  initialize: ({ seats }) => ({ seats: [...seats], turn: 0, total: 0 }),
  validateState(input, seats) {
    const state = input as State;
    if (
      !state ||
      !Array.isArray(state.seats) ||
      JSON.stringify(state.seats) !== JSON.stringify(seats) ||
      !Number.isInteger(state.turn) ||
      state.turn < 0 ||
      state.turn > 6 ||
      !Number.isInteger(state.total) ||
      state.total < 0 ||
      state.total > 18
    )
      throw new Error('Invalid example state');
    return state;
  },
  decisions: (state) =>
    state.turn < 6
      ? [{ id: `add-${state.turn}`, seatId: state.seats[state.turn % 2]! }]
      : [],
  ended: (state) => state.turn === 6,
  validateAction(input) {
    const action = input as Action;
    if (
      !action ||
      action.type !== 'add' ||
      ![1, 2, 3].includes(action.value) ||
      Object.keys(action).length !== 2
    )
      throw new Error('Invalid example action');
    return { type: 'add', value: action.value };
  },
  legalActions: (state, seat) =>
    state.turn < 6 && state.seats[state.turn % 2] === seat
      ? [1, 2, 3].map((value) => ({ type: 'add', value }))
      : [],
  lifecycleActions: () => [],
  applyLifecycle() {
    throw new Error('No example lifecycle action');
  },
  apply(state, action, seat) {
    if (state.turn >= 6 || state.seats[state.turn % 2] !== seat)
      throw new Error('Wrong example actor');
    return {
      state: {
        seats: [...state.seats],
        turn: state.turn + 1,
        total: state.total + action.value,
      },
      decision: { label: '加数之前', revealedInformation: false },
    };
  },
  project: (state) => ({ ...state, seats: [...state.seats] }),
};
