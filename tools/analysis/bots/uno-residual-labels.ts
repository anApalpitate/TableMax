import {
  unoCandidateFeatures,
  unoSearchBest,
} from '../../../games/uno/bot/correction';
import type { UnoSearchResult } from '../../../games/uno/bot/search';
import type { WeightedExample } from './fit';
import { pairedUnoDifferences, type UnoRoot } from './uno-samples';

export function collectUnoResidualExamples(
  root: UnoRoot,
  short: UnoSearchResult,
  outcomes: readonly (readonly (0 | 1 | null)[])[],
  continuations: number,
): WeightedExample[] {
  const reference = unoSearchBest(short.candidates);
  if (!reference || !outcomes.length) return [];
  const referenceIndex = short.candidates.indexOf(reference);
  const referenceFeatures = unoCandidateFeatures(
    root.view,
    root.memory,
    reference.action,
  );
  const totalHypotheses = outcomes.length / continuations;
  return short.candidates.flatMap((candidate, index) => {
    if (index === referenceIndex) return [];
    const differences = pairedUnoDifferences(
      outcomes,
      continuations,
      index,
      referenceIndex,
    );
    if (differences.length < 2) return [];
    const mean =
      differences.reduce((sum, value) => sum + value, 0) / differences.length;
    const semSquared =
      differences.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      ((differences.length - 1) * differences.length);
    const reliableWeight =
      differences.length / totalHypotheses / (1 + semSquared / 0.05 ** 2);
    const features = unoCandidateFeatures(
      root.view,
      root.memory,
      candidate.action,
    ).map((value, position) => value - referenceFeatures[position]!);
    const keyPosition =
      candidate.action.color !== undefined ||
      root.view.seatOrder.some(
        (seat) =>
          root.view.players[seat]!.score >= 400 ||
          (seat !== root.view.self?.seatId &&
            root.view.players[seat]!.handCount === 1),
      );
    return [
      {
        features,
        target: mean - (candidate.winProbability - reference.winProbability),
        weight:
          (reliableWeight * (keyPosition ? 2 : 1)) /
          (short.candidates.length - 1),
      },
    ];
  });
}
