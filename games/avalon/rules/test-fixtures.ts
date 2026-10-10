import type { RuleContext } from '@tablemax/game-sdk';
import type { Action, Variant } from '../types';
import { rulesByVariant } from './index';
import type { State } from './state';
export function context(
  seed = 37,
  seats = ['a', 'b', 'c', 'd', 'e'],
): RuleContext {
  let random = seed >>> 0;
  return {
    seats,
    random: {
      next() {
        random ^= random << 13;
        random ^= random >>> 17;
        random ^= random << 5;
        return (random >>> 0) / 4294967296;
      },
    },
  };
}
export function fixture(variant: Variant = 'classic', count = 5): State {
  const seats = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, count);
  return rulesByVariant[variant].initialize(context(37, seats)) as State;
}
export function apply(s: State, action: Action, seat: string): State {
  const rules = rulesByVariant[s.variant];
  const result = rules.apply(s, action, seat, context(37, s.seats))
    .state as State;
  return rules.validateState(result, result.seats) as State;
}
export function reveal(s: State): State {
  for (const seat of s.seats)
    if (!s.acknowledged.includes(seat))
      s = apply(s, { type: 'acknowledge' }, seat);
  return s;
}
export function approve(s: State, team: string[]): State {
  s = apply(s, { type: 'propose-team', team }, s.leader);
  for (const seat of s.seats)
    s = apply(s, { type: 'vote-team', vote: 'approve' }, seat);
  return s;
}
export function quest(s: State, failSeats: string[] = []): State {
  for (const seat of s.team)
    s = apply(
      s,
      {
        type: 'quest-card',
        card: failSeats.includes(seat) ? 'fail' : 'success',
      },
      seat,
    );
  return s;
}
