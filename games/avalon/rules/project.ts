import type { Viewer } from '@tablemax/game-sdk';
import {
  COURT_RULES_VERSION,
  RULES_VERSION,
  type AvalonView,
  type Knowledge,
  type Role,
} from '../types';
import { alignment, questSizes, type State } from './state';
export function roleKnowledge(
  roles: Record<string, Role>,
  seats: readonly string[],
  seat: string,
): Knowledge {
  const role = roles[seat]!;
  const evilSeats =
    role === 'merlin'
      ? seats.filter(
          (other) =>
            alignment(roles[other]!) === 'evil' && roles[other] !== 'mordred',
        )
      : alignment(role) === 'evil' && role !== 'oberon'
        ? seats.filter(
            (other) =>
              other !== seat &&
              alignment(roles[other]!) === 'evil' &&
              roles[other] !== 'oberon',
          )
        : [];
  const merlinCandidates =
    role === 'percival'
      ? seats.filter((other) => ['merlin', 'morgana'].includes(roles[other]!))
      : [];
  return { evilSeats, merlinCandidates };
}
export function project(s: State, viewer: Viewer): AvalonView {
  const seat =
    viewer.role === 'player' && s.seats.includes(viewer.seatId)
      ? viewer.seatId
      : null;
  const submittedSeats =
    s.phase === 'reveal'
      ? s.acknowledged
      : s.phase === 'vote'
        ? s.seats.filter((id) => Object.hasOwn(s.votes, id))
        : s.phase === 'quest'
          ? s.seats.filter((id) => Object.hasOwn(s.questCards, id))
          : [];
  const winner = s.winner;
  return structuredClone({
    gameId: 'avalon',
    rulesVersion: s.variant === 'court' ? COURT_RULES_VERSION : RULES_VERSION,
    variant: s.variant,
    phase: s.phase,
    seatOrder: s.seats,
    leader: s.leader,
    questNumber: s.questNumber,
    proposalNumber: s.proposalNumber,
    rejectedTeams: s.rejectedTeams,
    questSizes: questSizes(s.seats.length),
    team: s.team,
    submittedSeats,
    history: s.history,
    quests: s.quests,
    successCount: s.quests.filter((q) => q.succeeded).length,
    failCount: s.quests.filter((q) => !q.succeeded).length,
    assassin: ['assassinate', 'ended'].includes(s.phase)
      ? s.seats.find((id) => s.roles[id] === 'assassin')!
      : null,
    assassinationTarget: s.assassinationTarget,
    winner,
    winReason: s.winReason,
    winners: winner
      ? s.seats.filter((id) => alignment(s.roles[id]!) === winner)
      : [],
    revealedRoles: s.phase === 'ended' ? s.roles : null,
    self: seat
      ? {
          seatId: seat,
          role: s.roles[seat]!,
          alignment: alignment(s.roles[seat]!),
          knowledge: roleKnowledge(s.roles, s.seats, seat),
          submitted: submittedSeats.includes(seat),
          vote: s.votes[seat] ?? null,
          questCard: s.questCards[seat] ?? null,
        }
      : null,
    latest: s.latest,
  } satisfies AvalonView);
}
