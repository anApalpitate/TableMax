import { getCard } from '../data/catalog';
import type { UnoDecisionObservation } from '../rules/project';
import type { Action } from '../types';
import type { Memory } from './index';

type Play = Extract<Action, { type: 'play' }>;

function threat(view: UnoDecisionObservation, seatId: string) {
  const { score, handCount } = view.players[seatId]!;
  return score + Math.max(0, 8 - handCount) * 8 + (handCount === 1 ? 14 : 0);
}

/** Re-evaluate the target at each decision using only public progress. */
export function leadingRival(view: UnoDecisionObservation): string | undefined {
  if (!view.self || view.seatOrder.length < 3) return undefined;
  const ordered = [...view.seatOrder].sort(
    (left, right) => threat(view, right) - threat(view, left),
  );
  const [leader, following] = ordered;
  if (
    !leader ||
    !following ||
    leader === view.self.seatId ||
    threat(view, leader) - threat(view, following) < 12
  )
    return undefined;
  return leader;
}

export function pressureOnLeader(
  view: UnoDecisionObservation,
  action: Play,
  memory: Memory,
  target: string,
): number {
  const seat = view.self!.seatId;
  const card = getCard(action.cardId);
  const seats = view.seatOrder;
  const index = seats.indexOf(seat);
  const at = (steps: number) =>
    seats[(index + steps + seats.length * 2) % seats.length]!;
  const next = at(view.direction);
  const reverse = at(-view.direction);
  const color = card.color ?? action.color;
  const urgency = view.players[target]!.handCount <= 2 ? 1.35 : 1;
  let pressure = 0;
  let responder = next;
  if (card.kind === 'skip') {
    if (target === next) pressure += 132;
    responder = at(2 * view.direction);
  } else if (card.kind === 'reverse') {
    if (target === next && reverse !== next) pressure += 120;
    responder = reverse;
  } else if (card.kind === 'draw-two' || card.kind === 'wild-draw-four') {
    if (target === next) {
      // A draw penalty can be passed on only when the current match enables it.
      pressure +=
        (card.kind === 'wild-draw-four' ? 180 : 140) *
        (view.setup?.drawPenaltyStacking ? 0.7 : 1);
    }
    if (!view.setup?.drawPenaltyStacking && card.kind === 'draw-two')
      responder = at(2 * view.direction);
  }
  if (responder === target) {
    if (next !== target) pressure -= 65;
    const known = memory.knownCards[target] ?? [];
    const follows = known.some((id) => {
      const seen = getCard(id);
      return (
        seen.color === null ||
        seen.color === color ||
        (seen.kind === card.kind &&
          (seen.kind !== 'number' || seen.value === card.value))
      );
    });
    if (follows) pressure -= 45;
    else if (known.length === view.players[target]!.handCount) pressure += 45;
    else if (memory.colorHints[target]?.color === color) pressure -= 18;
  }
  return pressure * urgency;
}
