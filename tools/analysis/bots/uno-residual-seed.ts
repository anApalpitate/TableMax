import { loadUnoLeafScorer } from '../../../games/uno/bot/calibration';
import { unoSearchBest } from '../../../games/uno/bot/correction';
import { unoSearchRuleSteps } from '../../../games/uno/bot/search-budget';
import {
  searchUnoPlays,
  type UnoSearchResult,
} from '../../../games/uno/bot/search';
import { RandomSource } from '../../../packages/platform-core/src/random';
import {
  collectUnoRoots,
  independentSeed,
  pairedUnoDifferences,
  sampleUnoContinuations,
  type UnoRoot,
  type UnoSampleOptions,
} from './uno-samples';

export interface UnoResidualPosition {
  root: UnoRoot;
  short: UnoSearchResult;
  outcomes: readonly (readonly (0 | 1 | null)[])[];
  unfinished: number;
}

export interface UnoResidualSeed {
  seed: number;
  salt: number;
  options: UnoSampleOptions;
  calibration: unknown;
}

export async function collectUnoResidualSeed(
  task: UnoResidualSeed,
  inputRoots?: readonly UnoRoot[],
  checkIdle?: () => void,
): Promise<UnoResidualPosition[]> {
  const { seed, salt, options } = task;
  const scoreLeaf = loadUnoLeafScorer(task.calibration);
  const result: UnoResidualPosition[] = [];
  checkIdle?.();
  const roots =
    inputRoots ??
    (await collectUnoRoots(
      seed,
      options.nearTie ? { ...options, roots: options.roots * 3 } : options,
      undefined,
      checkIdle,
    ));
  for (const [index, root] of roots.entries()) {
    checkIdle?.();
    const short = searchUnoPlays(
      root.view,
      root.actions,
      root.memory,
      new RandomSource(independentSeed(seed, salt + index)),
      new AbortController().signal,
      scoreLeaf,
      {
        samples: options.hypotheses,
        maxRuleSteps: unoSearchRuleSteps(options.hypotheses),
      },
    );
    if (!short.candidates.length) continue;
    const baseline = unoSearchBest(short.candidates)!;
    const reference = short.candidates.indexOf(baseline);
    const close = options.nearTie
      ? short.candidates.flatMap((candidate, position) =>
          baseline.winProbability - candidate.winProbability <=
          0.03 + Number.EPSILON
            ? [position]
            : [],
        )
      : [];
    if (
      options.nearTie &&
      (short.samples < Math.max(8, options.hypotheses * 0.75) ||
        close.length < 2)
    )
      continue;
    const label = (group: number) =>
      sampleUnoContinuations(
        root,
        {
          ...options,
          seed: independentSeed(seed, salt + group + index),
          ...(options.nearTie
            ? {
                labelHypotheses: 8 as const,
                onlyCandidates: close,
                reference: 'shared-rounds' as const,
              }
            : {}),
        },
        scoreLeaf,
        checkIdle,
      );
    const long = label(0x10000);
    if (
      JSON.stringify(long.short.candidates.map(({ action }) => action)) !==
      JSON.stringify(short.candidates.map(({ action }) => action))
    )
      throw new Error('The frozen short and long UNO candidate sets differ');
    const uncertain =
      options.nearTie &&
      close.some((position) => {
        if (position === reference) return false;
        const pairs = pairedUnoDifferences(
          long.outcomes,
          options.continuations,
          position,
          reference,
        );
        const mean =
          pairs.reduce((sum, value) => sum + value, 0) / pairs.length;
        return pairs.length < 8 || Math.abs(mean) <= 0.03;
      });
    const extra = uncertain ? label(0x20000) : undefined;
    if (
      extra &&
      JSON.stringify(extra.short.candidates.map(({ action }) => action)) !==
        JSON.stringify(short.candidates.map(({ action }) => action))
    )
      throw new Error('The extra UNO reference changed the candidate set');
    result.push({
      root,
      short,
      outcomes: extra ? [...long.outcomes, ...extra.outcomes] : long.outcomes,
      unfinished: long.unfinished + (extra?.unfinished ?? 0),
    });
    if (options.nearTie && result.length >= options.roots) break;
  }
  return result;
}
