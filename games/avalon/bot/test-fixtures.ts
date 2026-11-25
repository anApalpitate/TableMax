import type { RuleContext } from '@tablemax/game-sdk';
import type { Alignment } from '../types';
import { rulesByVariant } from '../rules';
import { apply, approve, discuss, quest, reveal } from '../rules/test-fixtures';
import type { State } from '../rules/state';

function pressureStart(context: RuleContext, side: Alignment, starter: number) {
  const state = rulesByVariant.configured.initialize(context) as State;
  const [a, b, c, d, e, f, g] = context.seats as readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  state.roles = {
    [a]: side === 'good' ? 'merlin' : 'assassin',
    [b]: side === 'good' ? 'morgana' : 'merlin',
    [c]: side === 'good' ? 'assassin' : 'morgana',
    [d]: 'oberon',
    [e]: 'percival',
    [f]: 'servant',
    [g]: 'servant',
  };
  state.initialLeader = state.leader = context.seats[starter]!;
  return reveal(state);
}

export function pressureNomination(
  context: RuleContext,
  side: Alignment = 'good',
) {
  const [a, b, c, , e, f, g] = context.seats as readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  let state = pressureStart(context, side, 1);
  state = quest(approve(state, [a, b]));
  state = quest(approve(state, [b, e, f]));
  state =
    side === 'good'
      ? quest(approve(state, [b, e, g]), [b])
      : quest(approve(state, [a, c, g]), [a]);
  while (state.leader !== a) {
    state = discuss(
      apply(state, { type: 'propose-team', team: [a, b, c, e] }, state.leader),
    );
    for (const seat of state.seats)
      state = apply(state, { type: 'vote-team', vote: 'reject' }, seat);
  }
  return state;
}
