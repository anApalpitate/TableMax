import { expect, it } from 'vitest';
import {
  loadUnoLeafScorer,
  unoLeafFeatures,
  unoLeafFeatureNames,
  unoLeafFeatureNamesFor,
} from './calibration';
import { project } from '../rules/project';
import { fixture } from '../rules/test-fixtures';
import {
  fitUnoCalibration,
  referenceAnchor,
} from '../../../tools/analysis/bots/uno-calibration-fit';
import { scoreFeatures } from '../../../tools/analysis/bots/uno-calibration-seed';
import { linearPrediction } from '../../../tools/analysis/bots/fit';
import { calibrationSeeds } from '../../../tools/analysis/bots/uno-calibration-provenance';
import { pendingCalibration } from '../../../tools/analysis/bots/uno-pending';
import { unoPilotEvidence } from '../../../tools/analysis/bots/uno-pilot';

const width = unoLeafFeatureNames.length;

it('keeps the legacy leaf contract and distinguishes the same public score in different seats', () => {
  const base = fixture({
    a: ['red-1-a', 'red-2-a', 'wild-1'],
    b: ['yellow-1-a'],
    c: ['blue-1-a', 'blue-2-a', 'blue-3-a', 'blue-4-a'],
    d: ['green-1-a', 'green-2-a'],
  });
  const views = [
    { a: 120, b: 400, c: 200, d: 100 },
    { a: 120, b: 200, c: 400, d: 100 },
  ].map((scores) =>
    project(
      { ...base, scores, turnSeat: 'b' },
      { role: 'player', seatId: 'a' },
    ),
  );
  const legacy = views.map((view) => unoLeafFeatures(view));
  expect(legacy[0]).toEqual(legacy[1]);
  const joint = views.map((view) => unoLeafFeatures(view, 2));
  expect(joint.map((features) => features.slice(0, width))).toEqual(legacy);
  expect(joint.map((features) => features.slice(width))).toEqual([
    [0.08, 0.8, 0.8, 0],
    [0.08, 0.4, 0.4, 0],
  ]);

  const names = unoLeafFeatureNamesFor(2);
  const coefficients = names.map((key) =>
    Number(key === 'rival-score-over-hand-size'),
  );
  const scorer = loadUnoLeafScorer({
    version: 2,
    features: names,
    coefficients,
  });
  expect(scorer(views[0]!)).toBeGreaterThan(scorer(views[1]!));
  expect(() =>
    loadUnoLeafScorer({ version: 1, features: names, coefficients }),
  ).toThrow('feature contract');
  expect(() =>
    loadUnoLeafScorer({
      version: 2,
      features: names,
      coefficients: coefficients.slice(0, width),
    }),
  ).toThrow('feature contract');
});

it('reproduces the simple calibration exactly as a prior over leaf features', () => {
  const features = Array.from(
    { length: width },
    (_, index) => (index + 2) * 0.23,
  );
  features[0] = 1;
  const reference = [-0.17, 0.34];
  expect(
    linearPrediction(features, referenceAnchor(reference, width)),
  ).toBeCloseTo(linearPrediction(scoreFeatures(features), reference), 12);
});

it('chooses calibration strength from grouped natural fit rows', () => {
  const rows = Array.from({ length: 12 }, (_, index) => {
    const features = Array<number>(width).fill(0);
    features[0] = 1;
    features[1] = index * 0.1;
    return {
      seed: 4101 + index,
      natural: true,
      features,
      target: (index + 1) / 14,
      weight: 1,
    };
  });
  const joined = [
    ...rows,
    { ...rows[0]!, seed: 5201, natural: false, weight: 0.2 },
  ];
  const fitted = fitUnoCalibration(joined, 'anchored');
  expect(fitted.selection?.folds).toBe(4);
  expect(fitted.selection?.cv).toHaveLength(5);
  expect(fitted.selection?.cv.every((row) => Number.isFinite(row.brier))).toBe(
    true,
  );
  expect(fitted.coefficients).toHaveLength(width);
  expect(() => fitUnoCalibration(rows.slice(0, 7), 'anchored')).toThrow(
    'eight original natural seeds',
  );
});

it('keeps every rare fit and review seed outside correction and paired evaluation inputs', () => {
  const report = {
    trainSeeds: [10, 11],
    holdoutSeeds: [36, 37],
    pending: { fitSeeds: [73], reviewSeeds: [91] },
  };
  expect(calibrationSeeds(report)).toEqual([10, 11, 36, 37, 73, 91]);
  expect(() =>
    calibrationSeeds({
      ...report,
      pending: { fitSeeds: [10], reviewSeeds: [91] },
    }),
  ).toThrow('overlap');
  expect(() =>
    calibrationSeeds({ ...report, pending: { reviewSeeds: [91] } }),
  ).toThrow('frozen seeds');
});

it('rejects pooled or mislabelled pending review rows', () => {
  const row = {
    kind: 'draw-four',
    stage: 'draw-four',
    leadingScore: 245,
    features: Array(width).fill(0),
    completed: 16,
    wins: 6,
  };
  const seed = {
    seed: 701,
    found: { 'draw-four': 1, 'draw-two': 0, 'last-draw-four': 0 },
    rows: [row],
    unfinished: 0,
  };
  const good = {
    type: 'uno-pending-calibration',
    version: 1,
    pilot: unoPilotEvidence,
    options: { continuations: 16, maxSteps: 15000 },
    fit: [seed],
    review: [{ ...seed, seed: 901 }],
  };
  expect(pendingCalibration(good)).toEqual(good);
  const joint = {
    ...good,
    featureVersion: 2,
    fit: [
      {
        ...seed,
        rows: [
          { ...row, features: Array(unoLeafFeatureNamesFor(2).length).fill(0) },
        ],
      },
    ],
    review: [{ ...seed, seed: 901, rows: [] }],
  };
  expect(pendingCalibration(joint, 2)).toEqual(joint);
  expect(() => pendingCalibration(joint)).toThrow('Invalid');
  expect(() => pendingCalibration({ ...good, featureVersion: 2 }, 2)).toThrow(
    'Invalid',
  );
  expect(() => pendingCalibration({ ...good, review: [seed] })).toThrow(
    'overlapping',
  );
  expect(() =>
    pendingCalibration({
      ...good,
      review: [{ ...seed, seed: 901, rows: [{ ...row, stage: 'turn' }] }],
    }),
  ).toThrow('Invalid');
});
