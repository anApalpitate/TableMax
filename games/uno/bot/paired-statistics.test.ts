import { expect, it } from 'vitest';
import {
  summarizeUnoComparison,
  unoArms,
  unoComparisonDecision,
  type UnoPairedSeed,
  type UnoPool,
} from '../../../tools/analysis/bots/uno-paired-statistics';

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
