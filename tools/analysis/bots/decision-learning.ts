import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  candidateRatingAlternative,
  type BotDifficulty,
  type BotStrategy,
  type JsonValue,
} from '../../../packages/game-sdk/src/index';
import type { Snapshot } from '../../../packages/platform-core/src/model';
import { RandomSource } from '../../../packages/platform-core/src/random';
import type { DecisionLearningPilot } from './decision-learning-pilots';
import {
  evaluateBotMatch,
  type EvaluationMatch,
  type EvaluationStep,
} from './evaluate';
import type { WeightedExample } from './fit';
import { linearPrediction } from './fit';

type Input = Parameters<BotStrategy['decide']>[0];
type Decision = { action: JsonValue; difference: number[] };
type Terminal = Awaited<ReturnType<typeof evaluateBotMatch>>;
type Root = Decision & { before: Snapshot; event: EvaluationStep };

const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const levels: readonly BotDifficulty[] = ['default', 'doubao', 'juewu'];

export function learningMatch(
  pilot: DecisionLearningPilot,
  { bot, rules }: { bot: BotStrategy; rules: EvaluationMatch['rules'] },
  seed: number,
  index: number,
) {
  const focus = index % pilot.players;
  const seats: EvaluationMatch['seats'] = Array.from(
    { length: pilot.players },
    (_, seat) => ({
      id: 'seat-' + (seat + 1),
      strategy: bot,
      difficulty:
        seat === focus ? 'juewu' : levels[(seat + index) % levels.length]!,
    }),
  );
  return { actor: seats[focus]!.id, input: { rules, seed, seats } };
}

function learningAlternative(
  pilot: DecisionLearningPilot,
  input: Pick<Input, 'view' | 'actions' | 'decision'>,
  baseline: JsonValue,
): Decision | null {
  return candidateRatingAlternative(
    pilot.features,
    input.view,
    input.actions,
    input.decision.seatId,
    baseline,
  );
}

export function learningWin(
  pilot: DecisionLearningPilot,
  result: Terminal,
  seat: string,
) {
  if (result.outcome !== 'ended')
    throw new Error('Learning match did not reach a rules ending');
  const view = result.publicResult as Record<string, unknown>;
  const value = view[pilot.result];
  if (pilot.result === 'winner') {
    if (typeof value !== 'string') throw new Error('Missing terminal winner');
    return Number(value === seat);
  }
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((id) => typeof id !== 'string')
  )
    throw new Error('Missing terminal winning seats');
  return Number(value.includes(seat));
}

export function replaceLearningActor(
  match: EvaluationMatch,
  actor: string,
  apply: (input: Input, action: JsonValue) => JsonValue,
): EvaluationMatch {
  return {
    ...match,
    seats: match.seats.map((seat) => {
      if (seat.id !== actor) return seat;
      const original = seat.strategy;
      return {
        ...seat,
        strategy: {
          ...original,
          async decide(input) {
            const result = await original.decide(input);
            input.signal.throwIfAborted();
            return { ...result, action: apply(input, result.action) };
          },
        },
      };
    }),
  };
}

export async function labelLearningMatch(
  match: EvaluationMatch,
  pilot: DecisionLearningPilot,
  actor: string,
  maxSteps: number,
  rootLimit: number,
) {
  const events: EvaluationStep[] = [];
  const roots: Root[] = [];
  let occupied = 0;
  let before: Snapshot | undefined;
  const sample = new RandomSource((match.seed ^ 0x2ac779d1) >>> 0 || 1);
  const baseline = await evaluateBotMatch(match, {
    maxSteps,
    onStep(event, snapshot) {
      events.push(event);
      if (before && event.decision?.seatId === actor) {
        const view = match.rules.project(before.state, {
          role: 'player',
          seatId: actor,
        });
        const actions = match.rules.legalActions(before.state, actor);
        const alternative = learningAlternative(
          pilot,
          { view, actions, decision: event.decision },
          event.action,
        );
        if (alternative) {
          occupied++;
          const slot =
            occupied <= rootLimit
              ? occupied - 1
              : Math.floor(sample.next() * occupied);
          if (slot < rootLimit) roots[slot] = { ...alternative, before, event };
        }
      }
      before = snapshot();
    },
  });
  const baseWin = learningWin(pilot, baseline, actor);
  const receipts = new Map<number, string>();
  const wanted = new Set(roots.map(({ event }) => event.number));
  let trace = baseline.checkpoint.match;
  for (const event of events) {
    if (wanted.has(event.number)) receipts.set(event.number, trace);
    trace = digest([trace, event]);
  }
  if (trace !== baseline.checkpoint.traceDigest)
    throw new Error('Baseline action trace was not reproduced');
  const examples: WeightedExample[] = [];
  for (const root of roots) {
    let changed = 0;
    const alternative = replaceLearningActor(
      match,
      actor,
      (input, baseAction) => {
        if (changed || input.decision.id !== root.event.decision?.id)
          return baseAction;
        if (
          !isDeepStrictEqual(root.event.action, baseAction) ||
          !input.actions.some((candidate) =>
            isDeepStrictEqual(candidate, root.action),
          )
        )
          throw new Error(
            'Snapshot did not restore the same authorized decision',
          );
        changed++;
        return root.action;
      },
    );
    const outcome = await evaluateBotMatch(alternative, {
      maxSteps,
      checkpoint: {
        version: 1,
        match: baseline.checkpoint.match,
        steps: root.event.number - 1,
        snapshot: root.before,
        traceDigest: receipts.get(root.event.number)!,
      },
    });
    if (changed !== 1) throw new Error('One-decision fork did not execute');
    examples.push({
      features: root.difference,
      target: learningWin(pilot, outcome, actor) - baseWin,
      weight: 1 / roots.length,
    });
  }
  return {
    examples,
    eligibleDecisions: occupied,
    trace: baseline.checkpoint.traceDigest,
  };
}

export async function reviewLearningMatch(
  match: EvaluationMatch,
  pilot: DecisionLearningPilot,
  actor: string,
  fit: { coefficients: readonly number[]; threshold: number },
  maxSteps: number,
) {
  let interventions = 0;
  const learned = replaceLearningActor(match, actor, (input, baseline) => {
    const candidate = learningAlternative(pilot, input, baseline);
    if (
      !candidate ||
      linearPrediction(candidate.difference, fit.coefficients) <= fit.threshold
    )
      return baseline;
    interventions++;
    return candidate.action;
  });
  const baseline = await evaluateBotMatch(match, { maxSteps });
  const candidate = await evaluateBotMatch(learned, { maxSteps });
  return {
    baselineWon: learningWin(pilot, baseline, actor),
    candidateWon: learningWin(pilot, candidate, actor),
    interventions,
    baselineTrace: baseline.checkpoint.traceDigest,
    candidateTrace: candidate.checkpoint.traceDigest,
  };
}

export function decisionLearningInterval(
  values: readonly number[],
  seed: number,
) {
  if (values.length < 2)
    throw new Error('Interval needs two independent opening seeds');
  const random = new RandomSource(seed);
  const trials = Array.from({ length: 10000 }, () => {
    let sum = 0;
    for (let n = 0; n < values.length; n++)
      sum += values[Math.floor(random.next() * values.length)]!;
    return sum / values.length;
  }).sort((a, b) => a - b);
  return { lower: trials[249]!, upper: trials[9749]! };
}
