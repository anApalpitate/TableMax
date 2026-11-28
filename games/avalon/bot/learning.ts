import type { Action, AvalonView } from '../types';

export function encodeTeamVote(view: AvalonView, action: Action, seat: string) {
  const self = view.self;
  if (
    view.variant !== 'configured' ||
    view.phase !== 'vote' ||
    self?.seatId !== seat ||
    action.type !== 'vote-team' ||
    !view.team.length
  )
    return null;
  const approve = Number(action.vote === 'approve');
  const evil = Number(self.alignment === 'evil');
  const known = view.team.filter((member) =>
    self.knowledge.evilSeats.includes(member),
  ).length;
  const overlaps = view.quests.map((quest) => {
    const overlap =
      quest.team.filter((member) => view.team.includes(member)).length /
      view.team.length;
    return quest.succeeded ? overlap : -overlap;
  });
  return [
    approve,
    approve * evil,
    (approve * known) / view.team.length,
    (approve * evil * known) / view.team.length,
    approve * Number(view.team.includes(seat)),
    (approve * view.rejectedTeams) / 5,
    (approve * evil * view.rejectedTeams) / 5,
    (approve * (view.successCount - view.failCount)) / 3,
    (approve * overlaps.reduce((sum, value) => sum + value, 0)) /
      Math.max(1, overlaps.length),
  ];
}
