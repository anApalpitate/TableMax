import type { View } from '../project';
import type { Action } from '../state';

export function imminentRival(view: View, seat: string): string | undefined {
  if (
    view.rulesProfile !== 'events-research-v3' ||
    (view.phase !== 'greninja-choice' && view.phase !== 'row-choice')
  )
    return undefined;
  const contenders = view.seatOrder.filter(
    (id) => id !== seat && view.winsBySeat[id] === 2,
  );
  return contenders.length === 1 ? contenders[0] : undefined;
}

export type PressureEvidence = { disruption: number; outcomes: number[] };
type Rated = { action: Action; value: number };
const toleratedCost = 1.5;
const maxPressure = 2;

export function pressureChoice(
  ordered: readonly Rated[],
  evidence: ReadonlyMap<Action, PressureEvidence>,
  samples: number,
) {
  const baseline = ordered[0]!;
  const reference = evidence.get(baseline.action)!;
  const bonus = ({ disruption }: PressureEvidence) =>
    Math.min(maxPressure, Math.max(0, disruption / samples) * 0.25);
  let best = baseline;
  let adjusted = baseline.value - bonus(reference);
  for (const candidate of ordered.slice(1)) {
    if (candidate.value > baseline.value + toleratedCost) break;
    const measured = evidence.get(candidate.action)!;
    // Lower outcome ranks are better. Keep every sampled terminal win or non-loss
    // of the baseline, including wins shared with other seats.
    if (
      measured.outcomes.length !== reference.outcomes.length ||
      measured.outcomes.some(
        (outcome, index) => outcome > reference.outcomes[index]!,
      )
    )
      continue;
    const value = candidate.value - bonus(measured);
    if (value < adjusted) {
      adjusted = value;
      best = candidate;
    }
  }
  return best.action;
}
