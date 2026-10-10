export const RULES_VERSION = 'classic-2012-1';
export const COURT_RULES_VERSION = 'classic-2012-court-1';
export const ROLES = [
  'merlin',
  'percival',
  'servant',
  'assassin',
  'morgana',
  'mordred',
  'oberon',
  'minion',
] as const;
export type Role = (typeof ROLES)[number];
export type Alignment = 'good' | 'evil';
export type Variant = 'classic' | 'court';
export type Phase =
  'reveal' | 'team' | 'vote' | 'quest' | 'assassinate' | 'ended';
export type Vote = 'approve' | 'reject';
export type QuestCard = 'success' | 'fail';
export type Action =
  | { type: 'acknowledge' }
  | { type: 'propose-team'; team: string[] }
  | { type: 'vote-team'; vote: Vote }
  | { type: 'quest-card'; card: QuestCard }
  | { type: 'assassinate'; target: string };
export type ProposalResult = {
  questNumber: number;
  proposalNumber: number;
  leader: string;
  team: string[];
  votes: Record<string, Vote>;
  approved: boolean;
};
export type QuestResult = {
  questNumber: number;
  proposalNumber: number;
  leader: string;
  team: string[];
  failCount: number;
  succeeded: boolean;
};
export type LatestAction = {
  serial: number;
  actor: string | null;
  verb: string;
  text: string;
  targets: string[];
};
export type Knowledge = { evilSeats: string[]; merlinCandidates: string[] };
export type AvalonView = {
  gameId: 'avalon';
  rulesVersion: string;
  variant: Variant;
  phase: Phase;
  seatOrder: string[];
  leader: string;
  questNumber: number;
  proposalNumber: number;
  rejectedTeams: number;
  questSizes: number[];
  team: string[];
  submittedSeats: string[];
  history: ProposalResult[];
  quests: QuestResult[];
  successCount: number;
  failCount: number;
  assassin: string | null;
  assassinationTarget: string | null;
  winner: Alignment | null;
  winReason:
    | 'three-failures'
    | 'five-rejections'
    | 'merlin-assassinated'
    | 'merlin-survived'
    | null;
  winners: string[];
  revealedRoles: Record<string, Role> | null;
  self: {
    seatId: string;
    role: Role;
    alignment: Alignment;
    knowledge: Knowledge;
    submitted: boolean;
    vote: Vote | null;
    questCard: QuestCard | null;
  } | null;
  latest: LatestAction | null;
};
