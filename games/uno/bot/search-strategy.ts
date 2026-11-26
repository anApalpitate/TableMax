import type { BotStrategy } from '@tablemax/game-sdk';
import type { Action, UnoView } from '../types';
import { loadUnoLeafScorer } from './calibration';
import { bot, type Memory } from './index';
import { searchUnoPlays, type UnoSearchResult } from './search';
import { unoSearchRuleSteps, type UnoSearchSamples } from './search-budget';
import {
  loadUnoCorrection,
  unoCorrectedBest,
  unoSearchBest,
} from './correction';

/** Evaluation arms B/C. The official strategy keeps its existing version until validation. */
export function createUnoSearchStrategy(
  calibration: unknown,
  calibrationDigest: string,
  samples: UnoSearchSamples = 16,
  correction?: { model: unknown; digest: string; placebo?: boolean },
  onSearch?: (
    result: UnoSearchResult,
    baseline: Action,
    selected: Action,
  ) => void,
): BotStrategy {
  if (!/^[a-f0-9]{64}$/.test(calibrationDigest))
    throw new Error('UNO search needs a frozen calibration digest');
  const score = loadUnoLeafScorer(calibration);
  if (correction && !/^[a-f0-9]{64}$/.test(correction.digest))
    throw new Error('UNO correction needs a frozen model digest');
  const model = correction
    ? loadUnoCorrection(correction.model, calibrationDigest)
    : null;
  return {
    ...bot,
    id: correction?.placebo
      ? 'uno-local/placebo'
      : model
        ? 'uno-local/corrected'
        : 'uno-local/search',
    version: [1, samples, calibrationDigest, correction?.digest]
      .filter(Boolean)
      .join('/'),
    async decide(input) {
      const baseline = await bot.decide(input);
      if (input.difficulty !== 'juewu') return baseline;
      const result = searchUnoPlays(
        input.view as UnoView,
        input.actions as Action[],
        baseline.memory as Memory,
        input.random,
        input.signal,
        score,
        { samples, maxRuleSteps: unoSearchRuleSteps(samples) },
      );
      const baseAction =
        unoSearchBest(result.candidates)?.action ?? (baseline.action as Action);
      const selected = model
        ? (unoCorrectedBest(
            result,
            input.view as UnoView,
            baseline.memory as Memory,
            model,
            samples,
            correction?.placebo
              ? (values) => {
                  const shuffled = [...values];
                  let seed = 2166136261;
                  for (const character of input.decision.id)
                    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
                  for (let index = shuffled.length - 1; index > 0; index--) {
                    seed ^= seed << 13;
                    seed ^= seed >>> 17;
                    seed ^= seed << 5;
                    const other = (seed >>> 0) % (index + 1);
                    [shuffled[index], shuffled[other]] = [
                      shuffled[other]!,
                      shuffled[index]!,
                    ];
                  }
                  return shuffled;
                }
              : undefined,
          )?.action ?? baseAction)
        : baseAction;
      onSearch?.(result, baseAction, selected);
      return { ...baseline, action: selected };
    },
  };
}
