import { expect, it } from 'vitest';
import { RandomSource } from '../../../packages/platform-core/src/random';
import {
  measureAttribution,
  poolPlaceboTuning,
  shuffledResiduals,
  summarizeAttribution,
  tunePlacebo,
  type AttributionObservation,
} from '../../../tools/analysis/bots/uno-attribution';
import {
  unoCorrectedBest,
  unoCorrectionFeatureNames,
  unoSearchBest,
} from './correction';
import { fixture } from '../rules/test-fixtures';
import { legalActions, project } from '../rules';
import { observe } from './index';
import { searchUnoPlays } from './search';

it('permutes only the challenger residuals while preserving their multiset and deterministic seed', () => {
  const values = [0.125, -0.04, 0.02, 0];
  const shuffled = shuffledResiduals(values, new RandomSource(37));
  expect(shuffled).not.toEqual(values);
  expect([...shuffled].sort()).toEqual([...values].sort());
  expect(shuffledResiduals(values, new RandomSource(37))).toEqual(shuffled);
  expect(shuffledResiduals([0.125], new RandomSource(37))).toEqual([0.125]);
});

it('matches the placebo change rate only with independent development counts', () => {
  const fitted = poolPlaceboTuning([
    {
      roots: 8,
      learnedChanges: 3,
      simulatedShuffles: 64,
      simulatedChanges: 48,
    },
    {
      roots: 8,
      learnedChanges: 5,
      simulatedShuffles: 64,
      simulatedChanges: 32,
    },
  ]);
  expect(fitted.learnedRate).toBe(0.5);
  expect(fitted.expectedRate).toBe(0.5);
  expect(fitted.retention).toBe(0.8);
  expect(() =>
    poolPlaceboTuning([
      {
        roots: 1,
        learnedChanges: 2,
        simulatedShuffles: 8,
        simulatedChanges: 1,
      },
    ]),
  ).toThrow('Invalid placebo tuning counts');
});

it('requires matched rates, independent seeds and positive paired gains before attributing a benefit', () => {
  const tuning = poolPlaceboTuning([
    {
      roots: 32,
      learnedChanges: 16,
      simulatedShuffles: 256,
      simulatedChanges: 160,
    },
  ]);
  const rows: AttributionObservation[] = Array.from(
    { length: 8 },
    (_, index) => {
      const base = {
        seed: 4101 + index,
        node: 'play' as const,
        eligible: 3,
        unfinished: 0,
        worlds: 8,
      };
      return [
        {
          ...base,
          changed: true,
          placeboChanged: false,
          gain: 0.2,
          placeboGain: 0,
          learningMinusPlacebo: 0.2,
        },
        {
          ...base,
          changed: true,
          placeboChanged: true,
          gain: 0.2,
          placeboGain: 0.05,
          learningMinusPlacebo: 0.15,
        },
        {
          ...base,
          changed: false,
          placeboChanged: true,
          gain: 0,
          placeboGain: -0.01,
          learningMinusPlacebo: 0.01,
        },
        {
          ...base,
          changed: false,
          placeboChanged: false,
          gain: 0,
          placeboGain: 0,
          learningMinusPlacebo: 0,
        },
        { ...base, eligible: 1, changed: false, gain: 0 },
      ];
    },
  ).flat();
  const success = summarizeAttribution(rows, tuning, 101);
  expect(success.result).toBe('supports-learned-correction');
  expect(success.cAgainstPlacebo.seeds).toBe(8);
  expect(success.oneAlternative).toBe(8);
  expect(summarizeAttribution(rows.slice(0, 10), tuning, 101).result).toBe(
    'insufficient-diagnostic-evidence',
  );
  const differentRate = rows.map((row) =>
    row.eligible < 2
      ? row
      : {
          ...row,
          placeboChanged: false,
          placeboGain: 0,
          learningMinusPlacebo: row.gain ?? 0,
        },
  );
  expect(summarizeAttribution(differentRate, tuning, 101).result).toBe(
    'insufficient-diagnostic-evidence',
  );
  const noBenefit = rows.map((row) =>
    row.changed ? { ...row, gain: 0, learningMinusPlacebo: 0 } : row,
  );
  expect(summarizeAttribution(noBenefit, tuning, 101).result).toBe(
    'inconclusive-effects',
  );
});

it('labels complete continuations of the actual corrected choices in one authorized position', () => {
  const model = {
    version: 1 as const,
    calibrationDigest: 'a'.repeat(64),
    features: unoCorrectionFeatureNames,
    coefficients: unoCorrectionFeatureNames.map((name) =>
      name === 'own-value' ? 20 : 0,
    ),
    weight: 0.5,
    cap: 0.02,
  };
  const state = fixture({
    a: ['red-9-a', 'red-1-a', 'blue-3-a'],
    b: ['blue-1-a', 'blue-2-a', 'yellow-2-a', 'yellow-4-a'],
    c: ['green-1-a', 'green-2-a', 'green-3-a', 'green-4-a'],
    d: ['red-2-a', 'red-3-a', 'red-4-a', 'red-6-a'],
  });
  const view = project(state, { role: 'player', seatId: 'a' });
  const actions = legalActions(state, 'a');
  const memory = observe(view, null, 'juewu');
  const root = { seed: 9874, id: 'fixture-attribution', view, actions, memory };
  const search = searchUnoPlays(
    view,
    actions,
    memory,
    new RandomSource(57),
    new AbortController().signal,
    () => 0.5,
    { samples: 8, maxRuleSteps: 1024 },
  );
  const baseline = search.candidates.indexOf(unoSearchBest(search.candidates)!);
  const corrected = search.candidates.indexOf(
    unoCorrectedBest(search, view, memory, model, 8)!,
  );
  expect(baseline).toBeGreaterThanOrEqual(0);
  expect(corrected).not.toBe(baseline);
  const captured = [
    {
      baseline,
      corrected,
      search,
      root,
      challengers: search.candidates.length - 1,
    },
  ];
  const placebo = tunePlacebo(captured, model, 8);
  const result = measureAttribution(
    captured,
    model,
    {
      roots: 1,
      hypotheses: 8,
      continuations: 1,
      maxSteps: 15000,
    },
    () => 0.5,
    placebo.retention,
  );
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ changed: true, worlds: 8, unfinished: 0 });
}, 30000);
