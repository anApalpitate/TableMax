import type { AvalonView } from '../types';

export function influentialOpponent(
  view: AvalonView,
  beliefs: readonly { evil: readonly string[]; weight: number }[],
): string | undefined {
  const { seatId, alignment } = view.self!;
  const influence = new Map(view.seatOrder.map((seat) => [seat, 0]));
  for (const proposal of view.history)
    if (proposal.approved)
      influence.set(proposal.leader, influence.get(proposal.leader)! + 2);
  for (const quest of view.quests)
    if (quest.succeeded)
      for (const participant of quest.team)
        influence.set(participant, influence.get(participant)! + 1);
  const ranked = view.seatOrder
    .flatMap((seat) => {
      const publicInfluence = influence.get(seat)!;
      if (seat === seatId || publicInfluence < 2) return [];
      const evil = beliefs.reduce(
        (sum, belief) => sum + (belief.evil.includes(seat) ? belief.weight : 0),
        0,
      );
      const opponent = alignment === 'good' ? evil : 1 - evil;
      return opponent >= 0.65
        ? [{ seat, score: opponent * publicInfluence }]
        : [];
    })
    .sort((a, b) => b.score - a.score);
  const [first, second] = ranked;
  return first && (!second || first.score - second.score >= 0.5)
    ? first.seat
    : undefined;
}
