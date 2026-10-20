import { describe, expect, it } from 'vitest';
import { legacyUnoSetup, unoSetupDefaults, validateUnoSetup } from './config';
import {
  initialize,
  legalActions,
  project,
  rules,
  validateState,
} from './rules';
import { context, fixture } from './rules/test-fixtures';
import type { State } from './rules/state';

describe('UNO persisted setup and pure catch timing', () => {
  it('defaults new matches to penalty passing and a 500ms catch delay', () => {
    const state = initialize(context(17));
    expect(state.setup).toEqual(unoSetupDefaults);
    expect(state.setup!.drawPenaltyStacking).toBe(true);
    expect(state.drawPenalty).toBeNull();
    expect(rules.setup!.fromState!(state)).toEqual(unoSetupDefaults);
    expect(validateState(state, state.seats)).toEqual(state);
  });
  it('rejects an explicitly malformed setup before consuming the rule random source', () => {
    let calls = 0;
    expect(() =>
      initialize({
        seats: ['a', 'b'],
        setup: null,
        random: {
          next: () => {
            calls++;
            return 0.5;
          },
        },
      }),
    ).toThrow();
    expect(calls).toBe(0);
  });
  it('keeps an explicitly disabled penalty-passing setting for a new match', () => {
    const setup = { drawPenaltyStacking: false, catchUnoDelayMs: 500 };
    const state = initialize({ ...context(17), setup });
    expect(state.setup).toEqual(setup);
    expect(Object.hasOwn(state, 'drawPenalty')).toBe(false);
  });
  it.each([0, 100, 500, 1000, 2000, 5000])(
    'accepts an exact %ims delay without changing its value',
    (catchUnoDelayMs) => {
      const value = { drawPenaltyStacking: true, catchUnoDelayMs };
      expect(validateUnoSetup(value)).toEqual(value);
    },
  );
  it.each([
    null,
    [],
    {},
    { drawPenaltyStacking: 'true', catchUnoDelayMs: 500 },
    { drawPenaltyStacking: false, catchUnoDelayMs: -100 },
    { drawPenaltyStacking: false, catchUnoDelayMs: 50 },
    { drawPenaltyStacking: false, catchUnoDelayMs: 5100 },
    { drawPenaltyStacking: false, catchUnoDelayMs: NaN },
    { drawPenaltyStacking: false, catchUnoDelayMs: 500, otherRule: true },
  ])('rejects malformed, unbounded or unapproved setup: %j', (value) => {
    expect(() => validateUnoSetup(value)).toThrow();
  });
  it('restores old bytes and old 0ms behavior without adding settings during projection or actions', () => {
    const old = fixture({
      a: ['red-7-a', 'blue-5-a'],
      b: ['blue-1-a'],
      c: ['green-1-a'],
    });
    const bytes = JSON.stringify(old);
    const restored = validateState(JSON.parse(bytes), old.seats);
    expect(JSON.stringify(restored)).toBe(bytes);
    expect(rules.setup!.fromState!(restored)).toEqual(legacyUnoSetup);
    expect(Object.hasOwn(project(restored, { role: 'public' }), 'setup')).toBe(
      false,
    );
    const next = rules.apply(
      restored,
      { type: 'play', cardId: 'red-7-a' },
      'a',
      context(1, old.seats),
    ).state as State;
    expect(Object.hasOwn(next, 'setup')).toBe(false);
    expect(
      rules.actionTiming!(next, { type: 'catch-uno', target: 'a' }, 'b')
        ?.delayMs,
    ).toBe(0);
    expect(JSON.stringify(old)).toBe(bytes);
  });
  it('only describes a legal catch window, leaves declaration immediate and binds the saved serial', () => {
    const base = fixture({
      a: ['red-7-a', 'blue-5-a'],
      b: ['blue-1-a'],
      c: ['green-1-a'],
    });
    base.setup = { drawPenaltyStacking: false, catchUnoDelayMs: 5000 };
    const state = rules.apply(
      base,
      { type: 'play', cardId: 'red-7-a' },
      'a',
      context(1, base.seats),
    ).state as State;
    const action = { type: 'catch-uno', target: 'a' };
    expect(legalActions(state, 'b')).toContainEqual(action);
    const timing = rules.actionTiming!(state, action, 'b')!;
    expect(timing).toEqual({
      key: `uno-catch:1:2:${state.actionSerial}:a`,
      delayMs: 5000,
    });
    expect(rules.actionTiming!(state, { type: 'declare-uno' }, 'a')).toBeNull();
    expect(rules.actionTiming!(state, action, 'a')).toBeNull();
    const declared = rules.apply(
      state,
      { type: 'declare-uno' },
      'a',
      context(1, state.seats),
    ).state as State;
    expect(rules.actionTiming!(declared, action, 'b')).toBeNull();
    expect(rules.botTiming!(state, 'b', 'default')).toMatchObject({
      minMs: 5000,
      maxMs: 5000,
    });
  });
});
