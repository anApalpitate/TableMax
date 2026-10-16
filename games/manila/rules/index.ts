import type { GameRules } from '@tablemax/game-sdk';
import { initialize, execute, nextVoyage } from './engine';
import { legalActions, validateAction, isLegalAction } from './actions';
import { project } from './project';
import { turnSeat, validateState, type State } from './state';
import type { Action } from './view';
import { publicEvents } from './events';

export const rules: GameRules = {
  manifest: {
    id: 'manila',
    name: '马尼拉',
    gameVersion: '1.0.0',
    rulesVersion: 'manila-classic-2005-v1',
    sdkVersion: 1,
    stateVersion: 1,
    players: { min: 3, max: 5 },
    assetNamespace: 'manila',
  },
  initialize,
  validateState,
  decisions(input) {
    const s = input as State,
      seatId = turnSeat(s);
    return seatId
      ? [{ id: `manila-${s.voyage}-${s.serial}-${s.phase}`, seatId }]
      : [];
  },
  ended(input) {
    return (input as State).phase === 'ended';
  },
  validateAction,
  legalActions(input, seat) {
    return legalActions(input as State, seat);
  },
  isLegalAction(input, action, seat) {
    return isLegalAction(input as State, action as Action, seat);
  },
  lifecycleActions(input) {
    return (input as State).phase === 'round-result'
      ? [{ type: 'next-voyage' }]
      : [];
  },
  applyLifecycle(input, action) {
    if (
      (input as State).phase !== 'round-result' ||
      validateAction(action).type !== 'next-voyage'
    )
      throw new Error('Invalid Manila lifecycle action');
    const state = structuredClone(input) as State;
    state.serial++;
    nextVoyage(state);
    return {
      state,
      decision: {
        label: '下一航次之前',
        revealedInformation: true,
        roundNumber: state.voyage - 1,
      },
      events: publicEvents(input as State, state, { type: 'next-voyage' }),
    };
  },
  apply(input, raw, seat, context) {
    const action = validateAction(raw),
      s = input as State;
    if (!isLegalAction(s, action, seat))
      throw new Error('Illegal Manila action or actor');
    const state = structuredClone(s);
    execute(state, action, seat, context);
    const revealed =
      state.movement !== s.movement ||
      state.phase === 'ended' ||
      action.type === 'repay';
    return {
      state,
      decision: {
        label: `第${s.voyage}航次 · ${s.phase}选择之前`,
        revealedInformation: revealed,
        roundNumber: s.voyage,
      },
      events: publicEvents(s, state, action),
    };
  },
  project(input, viewer) {
    return project(input as State, viewer);
  },
};
