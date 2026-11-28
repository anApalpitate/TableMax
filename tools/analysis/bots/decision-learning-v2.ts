import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { JsonValue } from '../../../packages/game-sdk/src/index';
import { allowsGameAction } from '../../../packages/platform-core/src/game-actions';
import type { Snapshot } from '../../../packages/platform-core/src/model';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { learningWin, replaceLearningActor } from './decision-learning';
import {
  learningV2Candidates,
  type LearningV2Pilot,
} from './decision-learning-v2-pilots';
import {
  evaluateBotMatch,
  type EvaluationCheckpoint,
  type EvaluationMatch,
  type EvaluationStep,
} from './evaluate';
import { linearPrediction, type WeightedExample } from './fit';

type Candidate = NonNullable<ReturnType<typeof learningV2Candidates>>[number];
type RatedRoot = {
  before: Snapshot;
  event: EvaluationStep;
  candidates: Candidate[];
  stratum: string;
  priority: number;
};
export const learningV2Thresholds = [0.02, 0.06, 0.12] as const;
export type LearningV2Fit = {
  coefficients: number[];
  threshold: number;
  limit: number;
};
export type LearningV2Unit = {
  trace: string;
  eligible: number;
  alternatives: number;
  roots: {
    decision: string;
    stratum: string;
    scenarios: number;
    rows: (WeightedExample & { action: JsonValue; prior: number })[];
  }[];
};

export const learningV2Digest = (state: unknown) =>
  createHash('sha256').update(JSON.stringify(state)).digest('hex');

function choose(candidates: Candidate[], fit: LearningV2Fit) {
  let best: Candidate | undefined;
  let bestScore = fit.threshold;
  for (const candidate of candidates) {
    const score = linearPrediction(candidate.features, fit.coefficients);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function traces(events: EvaluationStep[], start: string, end: string) {
  const prefix = [start];
  for (const event of events)
    prefix.push(learningV2Digest([prefix.at(-1), event]));
  if (prefix.at(-1) !== end)
    throw new Error('Action trace does not match the evaluator');
  return prefix;
}

async function runFork(
  match: EvaluationMatch,
  actor: string,
  checkpoint: EvaluationCheckpoint,
  event: EvaluationStep,
  pick: JsonValue,
  maxSteps: number,
) {
  let changed = false;
  const branch = replaceLearningActor(match, actor, (input, original) => {
    if (changed || input.decision.id !== event.decision?.id) return original;
    if (!isDeepStrictEqual(original, event.action))
      throw new Error('Restored heuristic choice changed');
    changed = true;
    return pick;
  });
  const outcome = await evaluateBotMatch(branch, { checkpoint, maxSteps });
  if (!changed) throw new Error('Restored decision was not executed');
  return outcome;
}

export async function labelLearningV2(
  match: EvaluationMatch,
  pilot: LearningV2Pilot,
  actor: string,
  maxSteps: number,
  rootLimit = 4,
): Promise<LearningV2Unit> {
  const events: EvaluationStep[] = [];
  const strata = new Map<string, RatedRoot[]>();
  const rng = new RandomSource((match.seed ^ 0x161460bd) >>> 0 || 1);
  const signal = new AbortController().signal;
  let prior: Snapshot | undefined;
  let eligible = 0;
  let alternatives = 0;
  const baseline = await evaluateBotMatch(match, {
    maxSteps,
    onStep(event, snapshot) {
      events.push(event);
      if (prior && event.decision?.seatId === actor) {
        const { state } = prior;
        const input = {
          view: match.rules.project(state, { role: 'player', seatId: actor }),
          actions: match.rules.legalActions(state, actor),
          decision: event.decision,
          signal,
        };
        const candidates = learningV2Candidates(pilot, input, event.action);
        if (candidates?.length) {
          eligible++;
          alternatives += candidates.length;
          const stratum = pilot.stratum(input);
          const selected = strata.get(stratum) ?? [];
          selected.push({
            before: prior,
            event,
            candidates,
            stratum,
            priority: rng.next(),
          });
          selected.sort((a, b) => a.priority - b.priority);
          if (selected.length > rootLimit) selected.pop();
          strata.set(stratum, selected);
        }
      }
      prior = snapshot();
    },
  });
  const baselineWon = learningWin(pilot, baseline, actor);
  const prefix = traces(
    events,
    baseline.checkpoint.match,
    baseline.checkpoint.traceDigest,
  );
  const selections = [...strata.values()];
  const chosen = Array.from({ length: rootLimit }, (_, rank) =>
    selections.flatMap((rows) => (rows[rank] ? [rows[rank]] : [])),
  )
    .flat()
    .slice(0, rootLimit)
    .sort((a, b) => a.event.number - b.event.number);
  const roots: LearningV2Unit['roots'] = [];
  for (const root of chosen) {
    const checkpoint: EvaluationCheckpoint = {
      version: 1,
      match: baseline.checkpoint.match,
      steps: root.event.number - 1,
      snapshot: root.before,
      traceDigest: prefix[root.event.number - 1]!,
    };
    const accepted = root.candidates.filter(({ action }) =>
      allowsGameAction(
        match.rules,
        root.before.state,
        match.rules.validateAction(action),
        actor,
      ),
    );
    if (accepted.length !== root.candidates.length)
      throw new Error('Candidate provider returned an unauthorized action');
    const gameScenarios = pilot.game === 'manila' ? 8 : 1;
    const differences = accepted.map(() => 0);
    let scenarios = 0;
    async function labelBatch(count: number) {
      while (scenarios < count) {
        const world = scenarios++;
        // Manila dice are drawn after the fork. Already dealt holdings stay in the rules snapshot.
        const here =
          world === 0
            ? checkpoint
            : {
                ...checkpoint,
                snapshot: {
                  ...checkpoint.snapshot,
                  random: Math.floor(rng.next() * 0xffffffff) + 1,
                },
              };
        const reference =
          world === 0
            ? baselineWon
            : learningWin(
                pilot,
                await evaluateBotMatch(match, { checkpoint: here, maxSteps }),
                actor,
              );
        for (const [index, candidate] of accepted.entries()) {
          const result = await runFork(
            match,
            actor,
            here,
            root.event,
            candidate.action,
            maxSteps,
          );
          differences[index]! += learningWin(pilot, result, actor) - reference;
        }
      }
    }
    await labelBatch(gameScenarios);
    if (
      gameScenarios === 8 &&
      differences.some((total) => Math.abs(total / scenarios) <= 0.03)
    )
      await labelBatch(16);
    roots.push({
      decision: root.event.decision!.id,
      stratum: root.stratum,
      scenarios,
      rows: accepted.map((candidate, index) => ({
        action: candidate.action,
        features: candidate.features,
        prior: candidate.prior,
        target: differences[index]! / scenarios,
        weight: 1 / chosen.length / accepted.length,
      })),
    });
  }
  return {
    trace: baseline.checkpoint.traceDigest,
    eligible,
    alternatives,
    roots,
  };
}

export function pickLearningV2Fit(
  units: readonly LearningV2Unit[],
  coefficients: number[],
): LearningV2Fit {
  const candidates = learningV2Thresholds.flatMap((threshold) =>
    [1, 3].map((limit) => ({ coefficients, threshold, limit })),
  );
  const score = (fit: LearningV2Fit) =>
    units.reduce((sum, { roots }) => {
      let changes = 0;
      let gain = 0;
      for (const root of roots) {
        if (changes === fit.limit) break;
        const ranked = root.rows
          .map((row) => ({
            row,
            value: linearPrediction(row.features, coefficients),
          }))
          .sort((a, b) => b.value - a.value)[0];
        if (ranked && ranked.value > fit.threshold) {
          gain += ranked.row.target;
          changes++;
        }
      }
      return sum + gain / Math.max(roots.length, 1);
    }, 0);
  return candidates
    .map((fit) => ({ fit, gain: score(fit) }))
    .sort(
      (a, b) =>
        b.gain - a.gain ||
        b.fit.threshold - a.fit.threshold ||
        a.fit.limit - b.fit.limit,
    )[0]!.fit;
}

export async function reviewLearningV2(
  match: EvaluationMatch,
  pilot: LearningV2Pilot,
  actor: string,
  fit: LearningV2Fit,
  maxSteps: number,
  controls: boolean,
) {
  const baseline = await evaluateBotMatch(match, { maxSteps });
  const baselineWon = learningWin(pilot, baseline, actor);
  let changes = 0;
  let pendingChange: JsonValue | undefined;
  let original: JsonValue | undefined;
  let first:
    { before: Snapshot; event: EvaluationStep; action: JsonValue } | undefined;
  let before: Snapshot | undefined;
  const events: EvaluationStep[] = [];
  const learned = replaceLearningActor(match, actor, (input, action) => {
    if (changes >= fit.limit) return action;
    const alternatives = learningV2Candidates(pilot, input, action);
    const picked = alternatives && choose(alternatives, fit);
    if (!picked) return action;
    changes++;
    if (changes === 1) {
      pendingChange = picked.action;
      original = action;
    }
    return picked.action;
  });
  const candidate = await evaluateBotMatch(learned, {
    maxSteps,
    ...(controls
      ? {
          onStep(event, snapshot) {
            events.push(event);
            if (pendingChange !== undefined) {
              if (before && original !== undefined)
                first = {
                  before,
                  event: { ...event, action: pendingChange },
                  action: original,
                };
              pendingChange = undefined;
            }
            if (!first) before = snapshot();
          },
        }
      : {}),
  });
  const candidateWon = learningWin(pilot, candidate, actor);
  let firstChangeGain: number | null = null;
  if (first) {
    const outer = first;
    const prefix = traces(
      events,
      candidate.checkpoint.match,
      candidate.checkpoint.traceDigest,
    );
    const checkpoint: EvaluationCheckpoint = {
      version: 1,
      match: candidate.checkpoint.match,
      steps: outer.event.number - 1,
      snapshot: outer.before,
      traceDigest: prefix[outer.event.number - 1]!,
    };
    // Compare the selected action and the heuristic from the same root with no later learned interventions.
    const alternatives = await runFork(
      match,
      actor,
      checkpoint,
      { ...outer.event, action: outer.action },
      outer.event.action,
      maxSteps,
    );
    const reference = await evaluateBotMatch(match, { checkpoint, maxSteps });
    firstChangeGain =
      learningWin(pilot, alternatives, actor) -
      learningWin(pilot, reference, actor);
  }
  let controlWon = baselineWon;
  let controlInterventions = 0;
  if (controls && pilot.hasPrior) {
    const heuristic = replaceLearningActor(match, actor, (input, baseline) => {
      if (controlInterventions >= fit.limit) return baseline;
      const alternatives = learningV2Candidates(pilot, input, baseline);
      const best = alternatives?.reduce<Candidate | undefined>(
        (top, current) => (!top || current.prior > top.prior ? current : top),
        undefined,
      );
      if (!best || best.prior <= 0) return baseline;
      controlInterventions++;
      return best.action;
    });
    controlWon = learningWin(
      pilot,
      await evaluateBotMatch(heuristic, { maxSteps }),
      actor,
    );
  }
  return {
    baselineWon,
    controlWon,
    candidateWon,
    interventions: changes,
    controlInterventions,
    firstChangeGain,
    baselineTrace: baseline.checkpoint.traceDigest,
    candidateTrace: candidate.checkpoint.traceDigest,
  };
}
