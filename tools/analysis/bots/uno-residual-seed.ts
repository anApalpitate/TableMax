import { loadUnoLeafScorer } from '../../../games/uno/bot/calibration';
import { unoSearchRuleSteps } from '../../../games/uno/bot/search-budget';
import {
  searchUnoPlays,
  type UnoSearchResult,
} from '../../../games/uno/bot/search';
import { RandomSource } from '../../../packages/platform-core/src/random';
import {
  collectUnoRoots,
  independentSeed,
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
    inputRoots ?? (await collectUnoRoots(seed, options, undefined, checkIdle));
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
    const long = sampleUnoContinuations(
      root,
      {
        ...options,
        seed: independentSeed(seed, salt + 0x10000 + index),
      },
      scoreLeaf,
      checkIdle,
    );
    if (
      JSON.stringify(long.short.candidates.map(({ action }) => action)) !==
      JSON.stringify(short.candidates.map(({ action }) => action))
    )
      throw new Error('The frozen short and long UNO candidate sets differ');
    result.push({
      root,
      short,
      outcomes: long.outcomes,
      unfinished: long.unfinished,
    });
  }
  return result;
}
