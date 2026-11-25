import { RandomSource } from '../../../packages/platform-core/src/random';

export const unoOpponentPools = {
  starter: { weight: 0.25, opponents: ['default', 'default', 'default'] },
  mixed: { weight: 0.5, opponents: ['default', 'doubao', 'juewu'] },
  strong: { weight: 0.25, opponents: ['doubao', 'juewu', 'juewu'] },
} as const;

export type UnoPool = keyof typeof unoOpponentPools;
export type UnoArm = 'A' | 'B' | 'C';
export const unoArms = ['A', 'B', 'C'] as const;

export interface UnoPairedMatch {
  arm: UnoArm;
  seat: number;
  outcome: 'ended' | 'step-limit' | 'cancelled' | 'failed';
  won: boolean | null;
  steps?: number;
  traceDigest?: string;
  error?: string;
}

export interface UnoPairedSeed {
  pool: UnoPool;
  seed: number;
  matches: readonly UnoPairedMatch[];
}

export function completeUnoBlock(block: UnoPairedSeed) {
  return (
    block.matches.length === 12 &&
    unoArms.every((arm) =>
      [0, 1, 2, 3].every(
        (seat) =>
          block.matches.filter(
            (match) =>
              match.arm === arm &&
              match.seat === seat &&
              match.outcome === 'ended' &&
              typeof match.won === 'boolean',
          ).length === 1,
      ),
    )
  );
}

function blockDifference(
  block: UnoPairedSeed,
  target: UnoArm,
  reference: UnoArm,
) {
  const wins = (arm: UnoArm) =>
    block.matches.filter((match) => match.arm === arm && match.won).length;
  return (wins(target) - wins(reference)) / 4;
}

export function summarizeUnoComparison(
  blocks: readonly UnoPairedSeed[],
  target: UnoArm,
  reference: UnoArm,
  bootstrapSeed: number,
  looks: 1 | 2,
) {
  const pools = (Object.keys(unoOpponentPools) as UnoPool[]).map((pool) => {
    const all = blocks.filter((block) => block.pool === pool);
    const complete = all.filter(completeUnoBlock);
    const differences = complete.map((block) =>
      blockDifference(block, target, reference),
    );
    return { pool, all: all.length, complete: complete.length, differences };
  });
  const counts = pools.map(({ pool, all, complete }) => ({
    pool,
    all,
    complete,
  }));
  if (pools.some(({ complete }) => complete < 2)) {
    return {
      target,
      reference,
      counts,
      difference: null,
      interval95: null,
      decisionInterval: null,
    };
  }
  const average = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const difference = pools.reduce(
    (sum, group) =>
      sum + unoOpponentPools[group.pool].weight * average(group.differences),
    0,
  );
  const random = new RandomSource(bootstrapSeed);
  const distribution = Array.from({ length: 10000 }, () =>
    pools.reduce((sum, group) => {
      let resampled = 0;
      for (let draw = 0; draw < group.complete; draw++)
        resampled +=
          group.differences[Math.floor(random.next() * group.complete)]!;
      return (
        sum + (unoOpponentPools[group.pool].weight * resampled) / group.complete
      );
    }, 0),
  ).sort((a, b) => a - b);
  const percentile = (level: number) =>
    distribution[Math.floor(level * (distribution.length - 1))]!;
  const interval = (tail: number) => ({
    lower: percentile(tail),
    upper: percentile(1 - tail),
  });
  return {
    target,
    reference,
    counts,
    difference,
    interval95: interval(0.025),
    decisionInterval: interval(looks === 2 ? 0.0125 : 0.025),
  };
}

export function unoComparisonDecision(
  analysis: ReturnType<typeof summarizeUnoComparison>,
  blocks: readonly UnoPairedSeed[],
  canExpand: boolean,
) {
  if (blocks.some((block) => !completeUnoBlock(block)))
    return 'incomplete-blocks';
  if (analysis.difference === null || analysis.decisionInterval === null)
    return 'insufficient';
  if (analysis.difference >= 0.03 && analysis.decisionInterval.lower > 0)
    return 'meets-win-rate-gate';
  if (analysis.decisionInterval.upper < 0.03) return 'below-target';
  return canExpand ? 'expand' : 'insufficient';
}
