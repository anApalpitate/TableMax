import type {
  BotDifficulty,
  BotStrategy,
} from '../../../packages/game-sdk/src/index';
import { RandomSource } from '../../../packages/platform-core/src/random';
import type { EvaluationMatch } from './evaluate';

export const learningPools = ['starter', 'mixed', 'strong'] as const;
export type LearningPool = (typeof learningPools)[number];
export const learningPoolWeights = { starter: 0.25, mixed: 0.5, strong: 0.25 };

const tiers: Record<LearningPool, readonly BotDifficulty[]> = {
  starter: ['default'],
  mixed: ['default', 'doubao', 'juewu'],
  strong: ['doubao', 'juewu', 'juewu'],
};

export function pooledLearningMatch(
  loaded: { bot: BotStrategy; rules: EvaluationMatch['rules'] },
  players: number,
  seed: number,
  focus: number,
  pool: LearningPool,
  order: number,
) {
  const opponents = tiers[pool];
  const seats: EvaluationMatch['seats'] = Array.from(
    { length: players },
    (_, seat) => ({
      id: `seat-${seat + 1}`,
      strategy: loaded.bot,
      difficulty:
        seat === focus
          ? 'juewu'
          : opponents[
              (((seat - focus + players - 1) % players) + order) %
                opponents.length
            ]!,
    }),
  );
  return {
    input: { rules: loaded.rules, seed, seats },
    actor: seats[focus]!.id,
  };
}

export function poolForBlock(index: number): LearningPool {
  return index % 4 === 0 ? 'starter' : index % 4 === 3 ? 'strong' : 'mixed';
}

type Block = { pool: LearningPool; difference: number };
const average = (runs: readonly number[]) =>
  runs.reduce((sum, n) => sum + n, 0) / runs.length;

export function summarizeLearningBlocks(
  blocks: readonly Block[],
  seed: number,
  looks: 1 | 2 = 1,
) {
  const groups = learningPools.map((pool) => {
    const differences = blocks
      .filter((row) => row.pool === pool)
      .map((row) => row.difference);
    if (differences.length < 2)
      throw new Error(`Too few complete ${pool} opening blocks`);
    const difference = average(differences);
    const variance =
      differences.reduce((sum, n) => sum + (n - difference) ** 2, 0) /
      (differences.length - 1);
    return {
      pool,
      differences,
      difference,
      variance,
      weight: learningPoolWeights[pool],
    };
  });
  const difference = groups.reduce(
    (sum, row) => sum + row.weight * row.difference,
    0,
  );
  const random = new RandomSource(seed);
  const trials = Array.from({ length: 10_000 }, () =>
    groups.reduce((total, { differences, weight }) => {
      let sum = 0;
      for (let n = 0; n < differences.length; n++)
        sum += differences[Math.floor(random.next() * differences.length)]!;
      return total + (weight * sum) / differences.length;
    }, 0),
  ).sort((a, b) => a - b);
  const interval95 = { lower: trials[249]!, upper: trials[9749]! };
  const decisionInterval =
    looks === 1 ? interval95 : { lower: trials[124]!, upper: trials[9874]! };
  return {
    openings: blocks.length,
    difference,
    interval95,
    decisionInterval,
    passes: difference >= 0.03 && decisionInterval.lower > 0,
    pools: groups.map(({ pool, differences, difference, variance }) => ({
      pool,
      openings: differences.length,
      difference,
      variance,
    })),
  };
}

export function sizeLearningBlocks(variance: number, looks: 1 | 2) {
  if (!Number.isFinite(variance) || variance < 0)
    throw new Error('Invalid opening-block variance');
  const z = looks === 1 ? 1.959964 : 2.241403;
  return Math.max(32, 4 * Math.ceil((variance * (z / 0.02) ** 2) / 4));
}
