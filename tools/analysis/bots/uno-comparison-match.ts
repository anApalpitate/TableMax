import { bot, rules } from '../../../games/uno';
import { createUnoSearchStrategy } from '../../../games/uno/bot/search-strategy';
import { evaluateBotMatch } from './evaluate';
import { unoPilotEvidence } from './uno-pilot';
import {
  unoArms,
  unoOpponentPools,
  type UnoArm,
  type UnoPairedMatch,
  type UnoPool,
} from './uno-paired-statistics';

export interface UnoComparisonInputs {
  calibration: unknown;
  calibrationDigest: string;
  hypotheses: 8 | 16;
  correction: unknown;
  candidateDigest: string;
  maxSteps: number;
}

export interface UnoComparisonSeed {
  pool: UnoPool;
  seed: number;
  ordinal: number;
}

export interface UnoComparisonMatch extends UnoComparisonSeed {
  arm: UnoArm;
  seat: number;
}

const permutations = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
] as const;

export function createUnoComparisonEvaluator(input: UnoComparisonInputs) {
  const strategies = {
    A: bot,
    B: createUnoSearchStrategy(
      input.calibration,
      input.calibrationDigest,
      input.hypotheses,
    ),
    C: createUnoSearchStrategy(
      input.calibration,
      input.calibrationDigest,
      input.hypotheses,
      {
        model: input.correction,
        digest: input.candidateDigest,
      },
    ),
  };
  return async ({
    pool,
    seed,
    ordinal,
    seat,
    arm,
  }: UnoComparisonMatch): Promise<UnoPairedMatch> => {
    const opponents = unoOpponentPools[pool].opponents;
    const permutation = permutations[ordinal % permutations.length]!;
    const seats = Array.from({ length: 4 }, (_, index) => {
      const id = `seat-${index + 1}`;
      const offset = (index + 4 - seat) % 4;
      return offset === 0
        ? { id, strategy: strategies[arm], difficulty: 'juewu' as const }
        : {
            id,
            strategy: bot,
            difficulty: opponents[permutation[offset - 1]!]!,
          };
    });
    const result = await evaluateBotMatch(
      { rules, seats, seed, setup: unoPilotEvidence.setup },
      { maxSteps: input.maxSteps },
    );
    const winners = (result.publicResult as { winners?: unknown })?.winners;
    if (result.outcome === 'ended' && !Array.isArray(winners))
      throw new Error('Ended UNO match did not report winners');
    return {
      arm,
      seat,
      outcome: result.outcome,
      won:
        result.outcome === 'ended'
          ? (winners as string[]).includes(seats[seat]!.id)
          : null,
      steps: result.checkpoint.steps,
      traceDigest: result.checkpoint.traceDigest,
    };
  };
}

export async function runUnoComparisonBlock(
  seed: UnoComparisonSeed,
  jobs: number,
  remainingFailures: number,
  play: (match: UnoComparisonMatch) => Promise<UnoPairedMatch>,
  signal: AbortSignal,
) {
  const assignments = [0, 1, 2, 3].flatMap((seat) =>
    unoArms.map((arm) => ({ ...seed, seat, arm })),
  );
  const matches: UnoPairedMatch[] = [];
  let next = 0;
  let failures = 0;
  let active = 0;
  const consume = async () => {
    // Reserve one possible failure for every in-flight match.
    while (
      !signal.aborted &&
      next < assignments.length &&
      failures + active < remainingFailures
    ) {
      const index = next++;
      const assignment = assignments[index]!;
      active++;
      try {
        const result = await play(assignment);
        if (result.seat !== assignment.seat || result.arm !== assignment.arm)
          throw new Error('Comparison worker returned a different match');
        if (result.outcome !== 'ended') failures++;
        matches[index] = result;
      } catch (error) {
        failures++;
        matches[index] = {
          arm: assignment.arm,
          seat: assignment.seat,
          outcome: 'failed',
          won: null,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown UNO comparison error',
        };
      } finally {
        active--;
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(assignments.length, jobs, remainingFailures) },
      consume,
    ),
  );
  signal.throwIfAborted();
  return { matches, failures };
}
