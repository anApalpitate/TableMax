import {
  continueUnoHypothesisRound,
  type UnoHypothesisLeaf,
} from '../../../games/uno/bot/search';
import { unoWinningScore } from '../../../games/uno/rules/scoring';

type Branch = Pick<UnoHypothesisLeaf, 'state' | 'memories' | 'seat'>;
type UnoRoundOutcome = { winner: string; points: number; steps: number };

/**
 * The fixed rollout policies ignore cumulative scores, and a new round resets
 * their observations and memory. Branches can reuse that round's points and step
 * cost while each keeps its own scores and remaining budget.
 */
export function continueSharedUnoHypotheses(
  branches: readonly Branch[],
  seed: number,
  maxSteps: number,
  signal: AbortSignal,
  nextRoundSeed: (round: number) => number,
): (0 | 1 | null)[] {
  const first = branches[0];
  if (!first) return [];

  const { seats, roundNumber, dealer, setup, rulesVersion } = first.state;
  const dealerIndex = seats.indexOf(dealer);
  const zeroScores = Object.fromEntries(seats.map((seat) => [seat, 0]));
  const rounds = new Map<number, UnoRoundOutcome>();
  if (
    dealerIndex < 0 ||
    !Number.isSafeInteger(maxSteps) ||
    maxSteps < 1 ||
    !Number.isInteger(seed) ||
    seed < 1 ||
    seed > 0xffffffff
  )
    throw new Error('Invalid shared UNO continuation input');

  return branches.map((branch) => {
    signal.throwIfAborted();
    const state = branch.state;
    if (
      branch.seat !== first.seat ||
      state.roundNumber !== roundNumber ||
      state.dealer !== dealer ||
      state.rulesVersion !== rulesVersion ||
      state.setup?.catchUnoDelayMs !== setup?.catchUnoDelayMs ||
      state.setup?.drawPenaltyStacking !== setup?.drawPenaltyStacking ||
      state.seats.length !== seats.length ||
      seats.some((seat, index) => state.seats[index] !== seat)
    )
      throw new Error(
        'Shared UNO continuation branches must belong to one hypothesis',
      );

    const initial =
      state.phase === 'playing'
        ? continueUnoHypothesisRound(branch, seed, maxSteps, signal)
        : { state, steps: 0 };
    if (initial.state.phase === 'ended')
      return initial.state.winners.includes(branch.seat) ? 1 : 0;
    if (initial.state.phase !== 'round-result') return null;

    const scores = { ...initial.state.scores };
    let steps = initial.steps;
    for (let round = roundNumber + 1; steps < maxSteps; round++) {
      signal.throwIfAborted();
      let outcome = rounds.get(round);
      if (!outcome) {
        const next = continueUnoHypothesisRound(
          {
            seat: branch.seat,
            memories: {},
            state: {
              ...initial.state,
              roundNumber: round - 1,
              dealer:
                seats[(dealerIndex + round - roundNumber - 1) % seats.length]!,
              actionSerial: 0,
              scores: { ...zeroScores },
              wins: { ...zeroScores },
              results: [],
              winners: [],
            },
          },
          nextRoundSeed(round),
          maxSteps - steps,
          signal,
        );
        if (next.state.phase === 'playing') return null;

        const result = next.state.results.at(-1);
        if (!result || result.roundNumber !== round)
          throw new Error(
            'Shared UNO continuation did not record a round result',
          );
        outcome = {
          winner: result.winner,
          points: result.points,
          steps: next.steps,
        };
        rounds.set(round, outcome);
      }

      steps += outcome.steps;
      if (steps > maxSteps) return null;

      scores[outcome.winner]! += outcome.points;
      if (scores[outcome.winner]! >= unoWinningScore)
        return outcome.winner === branch.seat ? 1 : 0;
    }
    return null;
  });
}
