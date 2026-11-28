import type {
  BotDifficulty,
  BotStrategy,
} from '../../../packages/game-sdk/src/index';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { bot, type Memory } from '../../../games/uno/bot/index';
import {
  unoLeafFeatures,
  type UnoLeafFeatureVersion,
} from '../../../games/uno/bot/calibration';
import {
  unoSearchRuleSteps,
  type UnoSearchSamples,
} from '../../../games/uno/bot/search-budget';
import {
  continueUnoHypothesis,
  searchUnoPlays,
} from '../../../games/uno/bot/search';
import { unoPilotMatch } from '../../../games/uno/config';
import { rules, project } from '../../../games/uno/rules';
import type { Action, UnoView } from '../../../games/uno/types';
import { evaluateBotMatch } from './evaluate';
import { continueSharedUnoHypotheses } from './uno-shared-reference';

export interface UnoRoot {
  seed: number;
  id: string;
  view: UnoView;
  actions: readonly Action[];
  memory: Memory;
}

export interface UnoSampleOptions {
  roots: number;
  hypotheses: UnoSearchSamples;
  labelHypotheses?: 8 | 16;
  continuations: number;
  maxSteps: number;
  nearTie?: true;
}

export function unoCalibrationLabelOptions(
  options: UnoSampleOptions,
): UnoSampleOptions {
  const { labelHypotheses, ...collection } = options;
  return { ...collection, hypotheses: labelHypotheses ?? options.hypotheses };
}

interface RolloutOptions {
  hypotheses: UnoSearchSamples;
  labelHypotheses?: 8 | 16;
  continuations: number;
  maxSteps: number;
  seed: number;
  onlyCandidates?: readonly number[];
  reference?: 'shared-rounds';
  featureVersion?: UnoLeafFeatureVersion;
}

export interface UnoLeafLabel {
  features: readonly number[];
  stage: UnoView['stage'];
  wins: number;
  completed: number;
}

export interface UnoRootSamples {
  short: ReturnType<typeof searchUnoPlays>;
  outcomes: readonly (readonly (0 | 1 | null)[])[];
  leaves: readonly UnoLeafLabel[];
  unfinished: number;
}

export function independentSeed(seed: number, group: number): number {
  let value = (seed ^ group) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0 || 1;
}

export async function collectUnoRoots(
  seed: number,
  options: UnoSampleOptions,
  policy: BotStrategy = bot,
  checkpoint?: () => void,
): Promise<UnoRoot[]> {
  const rng = new RandomSource(independentSeed(seed, 0x201a1));
  const roots: UnoRoot[] = [];
  let eligible = 0;
  const observer: BotStrategy = {
    ...policy,
    id: 'uno-local/root-sampling',
    async decide(input) {
      const view = input.view as UnoView;
      const result = await policy.decide(input);
      const actions = input.actions as Action[];
      if (
        view.stage === 'turn' &&
        !view.unoWindow &&
        view.self!.hand.length > 1 &&
        actions.filter(({ type }) => type === 'play').length > 1
      ) {
        const position = eligible++;
        const slot =
          position < options.roots
            ? position
            : Math.floor(rng.next() * (position + 1));
        if (slot < options.roots)
          roots[slot] = {
            seed,
            id: input.decision.id,
            view,
            actions,
            memory: result.memory as Memory,
          };
      }
      return result;
    },
  };
  const opponents: readonly BotDifficulty[] = ['default', 'doubao', 'juewu'];
  const seats = Array.from({ length: unoPilotMatch.seatCount }, (_, index) => {
    const offset = (index + 4 - (seed % 4)) % 4;
    return {
      id: `seat-${index + 1}`,
      strategy: offset === 0 ? observer : bot,
      difficulty:
        offset === 0 ? ('juewu' as const) : opponents[(offset + seed) % 3]!,
    };
  });
  const match = await evaluateBotMatch(
    { rules, seats, seed, setup: unoPilotMatch.setup },
    {
      maxSteps: options.maxSteps,
      ...(checkpoint ? { onStep: checkpoint } : {}),
    },
  );
  if (match.outcome !== 'ended')
    throw new Error(
      `Root sampling match ${seed} did not reach the 500-point result`,
    );
  return roots;
}

export function sampleUnoContinuations(
  root: UnoRoot,
  options: RolloutOptions,
  evaluate: (view: UnoView) => number,
  checkpoint?: () => void,
): UnoRootSamples {
  const signal = new AbortController().signal;
  const leaves: UnoLeafLabel[] = [];
  const outcomes: (0 | 1 | null)[][] = [];
  const selected = options.onlyCandidates && new Set(options.onlyCandidates);
  let unfinished = 0;
  let labeledWorlds = 0;
  const short = searchUnoPlays(
    root.view,
    root.actions,
    root.memory,
    new RandomSource(options.seed),
    signal,
    evaluate,
    {
      samples: options.hypotheses,
      maxRuleSteps: unoSearchRuleSteps(options.hypotheses),
      onHypothesis(branches) {
        if (labeledWorlds >= (options.labelHypotheses ?? options.hypotheses))
          return;
        labeledWorlds++;
        const byCandidate = branches.map((): (0 | 1 | null)[] => []);
        const chosen = Array.from(branches.entries()).filter(
          ([index]) => !selected || selected.has(index),
        );
        const sharedBranches =
          options.reference === 'shared-rounds'
            ? chosen.map(([, leaf]) => leaf)
            : null;
        for (let trial = 0; trial < options.continuations; trial++) {
          const seed = independentSeed(
            options.seed,
            1 + trial + outcomes.length,
          );
          let sharedResults: (0 | 1 | null)[] | null = null;
          if (sharedBranches) {
            checkpoint?.();
            sharedResults = continueSharedUnoHypotheses(
              sharedBranches,
              seed,
              options.maxSteps,
              signal,
              (round) => independentSeed(seed, 0x11d27 + round),
            );
          }
          for (const [offset, [index, leaf]] of chosen.entries()) {
            const result = sharedResults
              ? sharedResults[offset]!
              : continueUnoHypothesis(
                  leaf,
                  seed,
                  options.maxSteps,
                  signal,
                  checkpoint,
                );
            if (result === null) unfinished++;
            byCandidate[index]!.push(result);
          }
        }
        for (const [index, leaf] of branches.entries()) {
          if (
            leaf.state.phase === 'ended' ||
            (selected && !selected.has(index))
          )
            continue;
          const completed = byCandidate[index]!.filter(
            (value) => value !== null,
          );
          const view = project(leaf.state, {
            role: 'player',
            seatId: leaf.seat,
          });
          leaves.push({
            features: unoLeafFeatures(view, options.featureVersion),
            stage: view.stage,
            completed: completed.length,
            wins: completed.filter((outcome) => outcome === 1).length,
          });
        }
        for (let trial = 0; trial < options.continuations; trial++)
          outcomes.push(
            byCandidate.map((candidate) => candidate[trial] ?? null),
          );
      },
    },
  );
  return { short, leaves, outcomes, unfinished };
}

export function pairedUnoDifferences(
  outcomes: readonly (readonly (0 | 1 | null)[])[],
  continuations: number,
  first: number,
  second: number,
) {
  const groups: number[] = [];
  for (let index = 0; index < outcomes.length; index += continuations) {
    const compared = outcomes
      .slice(index, index + continuations)
      .flatMap((outcome) => {
        const a = outcome[first];
        const b = outcome[second];
        return a == null || b == null ? [] : [a - b];
      });
    if (compared.length)
      groups.push(
        compared.reduce((sum, value) => sum + value, 0) / compared.length,
      );
  }
  return groups;
}
