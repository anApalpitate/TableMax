import { expect, it } from 'vitest';
import {
  sizeUnoComparison,
  summarizeUnoComparison,
  unoArms,
  unoComparisonDecision,
  type UnoPairedSeed,
  type UnoPool,
} from '../../../tools/analysis/bots/uno-paired-statistics';
import {
  followsUnoComparisonSeeds,
  matchesUnoComparisonStage,
  selectUnoComparisonSeeds,
  unoComparisonDigest,
  unoComparisonPasses,
  validateUnoComparisonPlan,
  type UnoComparisonPlan,
} from '../../../tools/analysis/bots/uno-comparison-plan';

function block(
  seed: number,
  pool: UnoPool,
  winningCSeats: number,
): UnoPairedSeed {
  return {
    seed,
    pool,
    matches: unoArms.flatMap((arm) =>
      Array.from({ length: 4 }, (_, seat) => ({
        arm,
        seat,
        outcome: 'ended' as const,
        won: arm === 'C' && seat < winningCSeats,
      })),
    ),
  };
}

it('weights whole seed blocks by frozen opponent pool and reproduces bootstrap intervals', () => {
  const blocks = [
    block(1, 'starter', 4),
    block(2, 'starter', 4),
    block(3, 'mixed', 2),
    block(4, 'mixed', 2),
    block(5, 'strong', 0),
    block(6, 'strong', 0),
  ];
  const comparison = summarizeUnoComparison(blocks, 'C', 'B', 9, 2);
  expect(comparison.difference).toBe(0.5);
  expect(comparison.interval95).toEqual({ lower: 0.5, upper: 0.5 });
  expect(comparison.decisionInterval).toEqual({ lower: 0.5, upper: 0.5 });
  expect(summarizeUnoComparison(blocks, 'C', 'B', 9, 2)).toEqual(comparison);
  expect(unoComparisonDecision(comparison, blocks, true)).toBe(
    'meets-win-rate-gate',
  );
  const incomplete = [
    ...blocks,
    { ...blocks[0]!, seed: 7, matches: blocks[0]!.matches.slice(0, 11) },
  ];
  expect(unoComparisonDecision(comparison, incomplete, true)).toBe(
    'incomplete-blocks',
  );
});

it('reaches futility or expansion using predeclared results', () => {
  const pools = ['starter', 'mixed', 'strong'] as const;
  const noGain = pools.flatMap((pool, index) => [
    block(index * 2 + 1, pool, 0),
    block(index * 2 + 2, pool, 0),
  ]);
  const summary = summarizeUnoComparison(noGain, 'C', 'B', 9, 2);
  expect(unoComparisonDecision(summary, noGain, true)).toBe('below-target');
  const uncertain = {
    ...summary,
    difference: 0.02,
    interval95: { lower: -0.01, upper: 0.05 },
    decisionInterval: { lower: -0.01, upper: 0.05 },
  };
  expect(unoComparisonDecision(uncertain, noGain, true)).toBe('expand');
  expect(unoComparisonDecision(uncertain, noGain, false)).toBe('insufficient');
});

const singleLook: UnoComparisonPlan = {
  version: 1,
  looks: 1,
  bootstrapSeed: 9,
  maxSteps: 15000,
  seeds: {
    starter: { first: [1, 2], extra: [] },
    mixed: { first: [3, 4, 5, 6], extra: [] },
    strong: { first: [7, 8], extra: [] },
  },
};

it('preserves declared pool order and seat rotation when resuming or expanding', () => {
  const plan: UnoComparisonPlan = {
    ...singleLook,
    looks: 2,
    seeds: {
      starter: { first: [1, 2], extra: [9] },
      mixed: { first: [3, 4, 5, 6], extra: [10, 11] },
      strong: { first: [7, 8], extra: [12] },
    },
  };
  expect(validateUnoComparisonPlan(plan)).toHaveLength(12);
  expect(() =>
    validateUnoComparisonPlan({ ...plan, developmentSeeds: [9] }),
  ).toThrow(/development/);
  const first = selectUnoComparisonSeeds(plan, 1);
  const reserve = selectUnoComparisonSeeds(plan, 2);
  expect(reserve.map(({ ordinal }) => ordinal)).toEqual([2, 4, 5, 2]);
  const blocks = [...first, ...reserve].map(({ pool, seed }) =>
    block(seed, pool, 4),
  );
  expect(followsUnoComparisonSeeds(blocks.slice(0, 3), first, true)).toBe(true);
  expect(followsUnoComparisonSeeds(blocks.slice(1, 4), first, true)).toBe(
    false,
  );
  expect(matchesUnoComparisonStage(plan, 2, blocks)).toBe(true);
  expect(matchesUnoComparisonStage(plan, 2, blocks.slice(0, -1))).toBe(false);
  const report = {
    type: 'uno-abc-acceptance',
    decision: 'meets-win-rate-gate',
    failures: 0,
    undispatched: [],
    plan,
    stage: 2,
    blocks,
    sourceSha256: 'a'.repeat(64),
    node: 'v22.0.0',
    planDigest: unoComparisonDigest(plan, 'B', 'C', 'a'.repeat(64), 'v22.0.0'),
  };
  expect(unoComparisonPasses(report, 'B', 'C')).toBe(false); // Stage one already passed.
  const expanded = [...first, ...reserve].map(({ pool, seed }) =>
    block(seed, pool, seed > 8 ? 4 : seed === 1 ? 1 : 0),
  );
  expect(unoComparisonPasses({ ...report, blocks: expanded }, 'B', 'C')).toBe(
    true,
  );
});

it('checks the exact planned blocks and the B and C reports before accepting a win-rate result', () => {
  const blocks = selectUnoComparisonSeeds(singleLook, 1).map(({ pool, seed }) =>
    block(seed, pool, 4),
  );
  const report = {
    type: 'uno-abc-acceptance',
    decision: 'meets-win-rate-gate',
    failures: 0,
    undispatched: [],
    plan: singleLook,
    stage: 1,
    blocks,
    sourceSha256: 'a'.repeat(64),
    node: 'v22.0.0',
    planDigest: unoComparisonDigest(
      singleLook,
      'B',
      'C',
      'a'.repeat(64),
      'v22.0.0',
    ),
  };
  expect(unoComparisonPasses(report, 'B', 'C')).toBe(true);
  expect(unoComparisonPasses(report, 'changed B', 'C')).toBe(false);
  expect(
    unoComparisonPasses({ ...report, blocks: blocks.slice(1) }, 'B', 'C'),
  ).toBe(false);
  expect(
    unoComparisonPasses({ ...report, type: 'uno-abc-progress' }, 'B', 'C'),
  ).toBe(false);
});

it('sizes the first and reserve blocks from per-pool sample variance', () => {
  const blocks = (['starter', 'mixed', 'strong'] as const).flatMap(
    (pool, index) =>
      [0, 1, 2, 2, 3].map((wins, i) => block(index * 5 + i + 1, pool, wins)),
  );
  // Each set of five differences has sample variance 0.08125.
  const one = sizeUnoComparison(blocks, 1);
  const two = sizeUnoComparison(blocks, 2);
  expect(one.pools[0]?.variance).toBeCloseTo(0.08125);
  expect(one.firstBlocks).toBe(784);
  expect(two.firstBlocks).toBe(1024);
  expect(two.pools.map(({ first, extra }) => [first, extra])).toEqual([
    [256, 128],
    [512, 256],
    [256, 128],
  ]);
  expect(two.firstMatches).toBe(12288);
  expect(two.maximumBlocks).toBe(1536);
  expect(() => sizeUnoComparison(blocks.slice(0, 10), 2)).toThrow(/per pool/);
  expect(() => sizeUnoComparison([...blocks, blocks[0]!], 1)).toThrow(
    /distinct/,
  );
});
