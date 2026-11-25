import { expect, it } from 'vitest';
import { searchUnoPlays } from './search';
import { unoLeafFeatureNames } from './calibration';
import { createUnoSearchStrategy } from './search-strategy';
import { context, fixture } from '../rules/test-fixtures';
import { legalActions, project } from '../rules';
import type { State } from '../rules/state';
import type { Memory } from './index';
import type { UnoView } from '../types';

const signal = new AbortController().signal;
const memory: Memory = {
  version: 1,
  roundNumber: 1,
  serial: 0,
  knownCards: { b: ['blue-1-a'] },
  colorHints: {},
};
const score = (view: UnoView) => 1 / (1 + view.self!.hand.length);
function search(state: State, maxRuleSteps = 2048) {
  return searchUnoPlays(
    project(state, { role: 'player', seatId: 'a' }),
    legalActions(state, 'a'),
    memory,
    context(42, state.seats).random,
    signal,
    score,
    { samples: 8, maxRuleSteps },
  );
}

it('uses the same paired search for identical authorized inputs with different hidden deals', () => {
  const a = fixture({
    a: ['red-1-a', 'red-skip-a', 'wild-1', 'wild-draw-four-1'],
    b: ['blue-1-a', 'green-1-a'],
    c: ['yellow-1-a', 'green-2-a'],
    d: ['yellow-2-a', 'green-3-a'],
  });
  const b = fixture({
    a: a.hands.a!,
    b: ['blue-1-a', 'blue-2-a'],
    c: ['green-1-a', 'yellow-1-a'],
    d: ['green-2-a', 'green-3-a'],
  });
  const original = structuredClone(a);
  expect(project(a, { role: 'player', seatId: 'a' })).toEqual(
    project(b, { role: 'player', seatId: 'a' }),
  );
  const result = search(a);
  expect(result).toEqual(search(b));
  expect(result.samples).toBe(8);
  expect(result.candidates).toHaveLength(6);
  expect(result.candidates.map(({ action }) => action.cardId)).not.toContain(
    'wild-draw-four-1',
  );
  expect(result.ruleSteps).toBeLessThanOrEqual(8 * 6 * 16);
  expect(a).toEqual(original);
});

it('starts only a complete hypothesis within the residual rule-step budget', () => {
  const state = fixture({
    a: ['red-1-a', 'red-skip-a', 'yellow-1-a'],
    b: ['blue-1-a', 'blue-2-a'],
    c: ['green-1-a', 'green-2-a'],
    d: ['yellow-2-a', 'green-3-a'],
  });
  expect(search(state, 31)).toEqual({
    candidates: [],
    samples: 0,
    ruleSteps: 0,
  });
  const result = search(state, 32);
  expect(result.samples).toBe(1);
  expect(result.candidates).toHaveLength(2);
  expect(result.ruleSteps).toBeLessThanOrEqual(32);
});

it('does not search mandatory responses or use conflicting remembered cards', () => {
  const state = fixture({
    a: ['red-1-a', 'red-skip-a', 'yellow-1-a'],
    b: ['blue-1-a', 'blue-2-a'],
    c: ['green-1-a', 'green-2-a'],
    d: ['yellow-2-a', 'green-3-a'],
  });
  const view = project(state, { role: 'player', seatId: 'a' });
  const result = searchUnoPlays(
    view,
    legalActions(state, 'a'),
    { ...memory, knownCards: { b: ['red-1-a'] } },
    context(42, state.seats).random,
    signal,
    score,
  );
  expect(result.samples).toBe(0);
  expect(
    searchUnoPlays(
      { ...view, unoWindow: { seatId: 'b' } },
      legalActions(state, 'a'),
      memory,
      context(42, state.seats).random,
      signal,
      score,
    ).samples,
  ).toBe(0);
});

it('binds and uses the leaf calibration for the isolated B strategy', async () => {
  const state = fixture({
    a: ['red-1-a', 'red-skip-a', 'wild-1'],
    b: ['blue-1-a', 'blue-2-a'],
    c: ['green-1-a', 'green-2-a'],
    d: ['yellow-2-a', 'green-3-a'],
  });
  const view = project(state, { role: 'player', seatId: 'a' });
  const actions = legalActions(state, 'a');
  const identity = '1'.repeat(64);
  const calibration = {
    version: 1,
    features: unoLeafFeatureNames,
    coefficients: unoLeafFeatureNames.map((name) =>
      name === 'own-hand-count' ? -10 : 0,
    ),
  };
  expect(() =>
    createUnoSearchStrategy({ ...calibration, features: ['bias'] }, identity),
  ).toThrow('feature contract');
  const strategy = createUnoSearchStrategy(calibration, identity, 8);
  const first = await strategy.decide({
    view,
    actions,
    decision: { id: 'fixture', seatId: 'a' },
    memory,
    random: context(42, state.seats).random,
    difficulty: 'juewu',
    signal,
  });
  expect(strategy.version).toContain(identity);
  expect(actions).toContainEqual(first.action);
  expect(first.memory).toEqual(memory);
});
