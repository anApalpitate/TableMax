import { expect, it } from 'vitest';
import { project } from '../rules';
import { fixture } from '../rules/test-fixtures';
import {
  unoCandidateFeatures,
  unoCorrectedBest,
  unoCorrectionFeatureNames,
  loadUnoCorrection,
} from './correction';
import { collectUnoResidualExamples } from '../../../tools/analysis/bots/uno-residual-labels';

const state = fixture({
  a: ['red-1-a', 'red-skip-a', 'wild-1'],
  b: ['green-1-a'],
  c: ['blue-1-a', 'yellow-1-a'],
  d: ['blue-2-a', 'yellow-2-a'],
});
const view = project(state, { role: 'player', seatId: 'a' });
const memory = {
  version: 1 as const,
  roundNumber: 1,
  serial: 0,
  knownCards: {},
  colorHints: {},
};
const normal = { type: 'play' as const, cardId: 'red-1-a' };
const skip = { type: 'play' as const, cardId: 'red-skip-a' };
const wild = {
  type: 'play' as const,
  cardId: 'wild-1',
  color: 'blue' as const,
};
const calibrationDigest = '1'.repeat(64);
const candidate = {
  version: 1 as const,
  calibrationDigest,
  features: unoCorrectionFeatureNames,
  coefficients: unoCorrectionFeatureNames.map((feature) =>
    feature === 'skip' ? 1 : 0,
  ),
  cap: 0.02,
  weight: 0.5,
};
const result = {
  samples: 12,
  ruleSteps: 100,
  candidates: [
    { action: normal, winProbability: 0.28 },
    { action: skip, winProbability: 0.265 },
    { action: wild, winProbability: 0.249 },
  ],
};

it('only corrects near ties after enough common worlds and clips the correction', () => {
  expect(unoCorrectedBest(result, view, memory, candidate, 16)?.action).toEqual(
    skip,
  );
  expect(
    unoCorrectedBest({ ...result, samples: 11 }, view, memory, candidate, 16)
      ?.action,
  ).toEqual(normal);
  expect(
    unoCorrectedBest(
      {
        ...result,
        candidates: [
          result.candidates[0]!,
          { action: skip, winProbability: 0.259 },
        ],
      },
      view,
      memory,
      candidate,
      16,
    )?.action,
  ).toEqual(normal);
  expect(
    unoCorrectedBest(
      {
        ...result,
        candidates: [
          result.candidates[0]!,
          { action: skip, winProbability: 0.26 },
        ],
      },
      view,
      memory,
      candidate,
      16,
    )?.action,
  ).toEqual(normal);
  expect(() => loadUnoCorrection(candidate, '2'.repeat(64))).toThrow(
    'frozen calibration',
  );
  expect(unoCandidateFeatures(view, memory, wild)).toHaveLength(
    candidate.features.length,
  );
});

it('keeps B below the 24 completed worlds required by the adaptive C budget', () => {
  expect(
    unoCorrectedBest({ ...result, samples: 23 }, view, memory, candidate, 32)
      ?.action,
  ).toEqual(normal);
  expect(
    unoCorrectedBest({ ...result, samples: 24 }, view, memory, candidate, 32)
      ?.action,
  ).toEqual(skip);
});

it('fits pairwise residual labels from complete shared worlds, leaving unknown branches uncounted', () => {
  const samples = collectUnoResidualExamples(
    { seed: 17, id: 'fixture', view, actions: [normal, skip, wild], memory },
    result,
    [
      [0, 1, null],
      [0, 1, null],
      [1, 1, null],
      [1, 1, null],
    ],
    2,
  );
  expect(samples).toHaveLength(1);
  expect(samples[0]!.target).toBeCloseTo(0.515);
  expect(samples[0]!.weight).toBeGreaterThan(0);
  expect(samples[0]!.weight).toBeLessThan(0.01);
  expect(samples[0]!.features[unoCorrectionFeatureNames.indexOf('skip')]).toBe(
    1,
  );
});
