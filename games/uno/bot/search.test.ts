import { expect, it } from 'vitest';
import { searchUnoPlays } from './search';
import { unoLeafFeatureNames } from './calibration';
import { createUnoSearchStrategy } from './search-strategy';
import { context, fixture } from '../rules/test-fixtures';
import { legalActions, project, rules } from '../rules';
import { projectUnoMemoryObservation } from '../rules/project';
import type { State } from '../rules/state';
import { observe, type Memory } from './index';
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

it('preserves challenge memory while projecting only the observing seat evidence', () => {
  const state = fixture({
    a: ['wild-draw-four-1', 'red-1-a', 'yellow-4-a'],
    b: ['blue-1-a', 'blue-2-a'],
    c: ['green-1-a', 'green-2-a'],
    d: ['yellow-2-a', 'green-3-a'],
  });
  const game = context(79, state.seats);
  const claim = rules.apply(
    state,
    {
      type: 'play',
      cardId: 'wild-draw-four-1',
      color: 'blue',
    },
    'a',
    game,
  ).state as State;
  const challenged = rules.apply(
    claim,
    { type: 'challenge-draw-four' },
    'b',
    game,
  ).state as State;
  expect(challenged.evidence?.challenger).toBe('b');
  const before = structuredClone(challenged);
  for (const seatId of state.seats) {
    const full = project(challenged, { role: 'player', seatId });
    const compact = projectUnoMemoryObservation(challenged, seatId);
    expect(compact.self?.challengeEvidence).toEqual(
      full.self?.challengeEvidence,
    );
    const observed = observe(compact, null, 'juewu');
    expect(observed).toEqual(observe(full, null, 'juewu'));
    if (seatId === 'b') expect(observed.knownCards.a).toContain('red-1-a');
    else expect(observed.knownCards.a).toBeUndefined();
  }
  expect(challenged).toEqual(before);
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
