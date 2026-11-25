import type { BotStrategy } from '@tablemax/game-sdk';
import type { Action, UnoView } from '../types';
import { loadUnoLeafScorer } from './calibration';
import { bot, type Memory } from './index';
import { searchUnoPlays } from './search';

/** Evaluation arm B. The official strategy uses the existing version until validation. */
export function createUnoSearchStrategy(
  calibration: unknown,
  calibrationDigest: string,
  samples: 8 | 16 = 16,
): BotStrategy {
  if (!/^[a-f0-9]{64}$/.test(calibrationDigest))
    throw new Error('UNO search needs a frozen calibration digest');
  const score = loadUnoLeafScorer(calibration);
  return {
    ...bot,
    id: 'uno-local/search',
    version: `1/${samples}/${calibrationDigest}`,
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
        { samples, maxRuleSteps: samples * 8 * 16 },
      );
      const [first, ...remaining] = result.candidates;
      if (!first) return baseline;
      const best = remaining.reduce(
        (best, candidate) =>
          candidate.winProbability > best.winProbability ? candidate : best,
        first,
      );
      return { ...baseline, action: best.action };
    },
  };
}
