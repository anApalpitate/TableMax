import type {
  Alignment,
  LatestAction,
  Phase,
  ProposalResult,
  QuestCard,
  QuestResult,
  Role,
  Variant,
  Vote,
  AvalonView,
} from '../types';
export type State = {
  variant: Variant;
  phase: Phase;
  seats: string[];
  initialLeader: string;
  leader: string;
  roles: Record<string, Role>;
  acknowledged: string[];
  questNumber: number;
  proposalNumber: number;
  rejectedTeams: number;
  team: string[];
  votes: Record<string, Vote>;
  questCards: Record<string, QuestCard>;
  history: ProposalResult[];
  quests: QuestResult[];
  assassinationTarget: string | null;
  winner: Alignment | null;
  winReason: AvalonView['winReason'];
  actionSerial: number;
  latest: LatestAction | null;
};
export const object = (input: unknown): input is Record<string, unknown> =>
  !!input && typeof input === 'object' && !Array.isArray(input);
export const exact = (input: Record<string, unknown>, keys: string[]) =>
  Object.keys(input).length === keys.length &&
  keys.every((key) => Object.hasOwn(input, key));
export const alignment = (role: Role): Alignment =>
  ['merlin', 'percival', 'servant'].includes(role) ? 'good' : 'evil';
export const questSizes = (count: number): number[] =>
  count === 5 ? [2, 3, 2, 3, 3] : [2, 3, 4, 3, 4];
export const nextSeat = (state: Pick<State, 'seats'>, seat: string) =>
  state.seats[(state.seats.indexOf(seat) + 1) % state.seats.length]!;
export function roleDeck(count: number, variant: Variant): Role[] {
  return variant === 'court'
    ? [
        'merlin',
        'percival',
        'assassin',
        'morgana',
        ...Array<Role>(count - 4).fill('servant'),
      ]
    : [
        'merlin',
        'assassin',
        'minion',
        ...Array<Role>(count - 3).fill('servant'),
      ];
}
const stateKeys = [
  'variant',
  'phase',
  'seats',
  'initialLeader',
  'leader',
  'roles',
  'acknowledged',
  'questNumber',
  'proposalNumber',
  'rejectedTeams',
  'team',
  'votes',
  'questCards',
  'history',
  'quests',
  'assassinationTarget',
  'winner',
  'winReason',
  'actionSerial',
  'latest',
];
export function validateState(
  input: unknown,
  seats: readonly string[],
  expectedVariant?: Variant,
): State {
  const fail = (): never => {
    throw new Error('阿瓦隆存档不变量无效。');
  };
  if (!object(input) || !exact(input, stateKeys)) fail();
  const s = input as unknown as State;
  if (
    !Array.isArray(s.seats) ||
    s.seats.length < 5 ||
    s.seats.length > 6 ||
    new Set(s.seats).size !== s.seats.length ||
    !s.seats.every(
      (seat) =>
        typeof seat === 'string' && seat.length > 0 && seat.length <= 128,
    ) ||
    JSON.stringify(s.seats) !== JSON.stringify(seats) ||
    !['classic', 'court'].includes(s.variant) ||
    (expectedVariant !== undefined && s.variant !== expectedVariant) ||
    !['reveal', 'team', 'vote', 'quest', 'assassinate', 'ended'].includes(
      s.phase,
    ) ||
    !s.seats.includes(s.initialLeader) ||
    !s.seats.includes(s.leader)
  )
    fail();
  const validSeats = (values: unknown): values is string[] =>
    Array.isArray(values) &&
    new Set(values).size === values.length &&
    values.every((seat) => typeof seat === 'string' && s.seats.includes(seat));
  const record = (
    value: unknown,
    allowedSeats: readonly string[],
    allowedValues: readonly unknown[],
  ) =>
    object(value) &&
    Object.entries(value).every(
      ([seat, card]) =>
        allowedSeats.includes(seat) && allowedValues.includes(card),
    );
  if (
    !record(s.roles, s.seats, roleDeck(s.seats.length, s.variant)) ||
    Object.keys(s.roles).length !== s.seats.length ||
    JSON.stringify(Object.values(s.roles).sort()) !==
      JSON.stringify(roleDeck(s.seats.length, s.variant).sort()) ||
    !validSeats(s.acknowledged) ||
    !validSeats(s.team) ||
    !record(s.votes, s.seats, ['approve', 'reject']) ||
    !record(s.questCards, s.team, ['success', 'fail']) ||
    Object.entries(s.questCards).some(
      ([seat, card]) => card === 'fail' && alignment(s.roles[seat]!) !== 'evil',
    )
  )
    fail();
  if (
    !Number.isInteger(s.questNumber) ||
    s.questNumber < 1 ||
    s.questNumber > 5 ||
    !Number.isInteger(s.proposalNumber) ||
    s.proposalNumber < 1 ||
    s.proposalNumber > 25 ||
    !Number.isInteger(s.rejectedTeams) ||
    s.rejectedTeams < 0 ||
    s.rejectedTeams > 5 ||
    !Number.isInteger(s.actionSerial) ||
    s.actionSerial < 0 ||
    !Array.isArray(s.history) ||
    s.history.length > 25 ||
    !Array.isArray(s.quests) ||
    s.quests.length > 5
  )
    fail();
  let leader = s.initialLeader,
    questNumber = 1,
    rejected = 0,
    completed = 0;
  for (const [index, h] of s.history.entries()) {
    if (
      !object(h) ||
      !exact(h, [
        'questNumber',
        'proposalNumber',
        'leader',
        'team',
        'votes',
        'approved',
      ]) ||
      h.questNumber !== questNumber ||
      h.proposalNumber !== index + 1 ||
      h.leader !== leader ||
      !validSeats(h.team) ||
      h.team.length !== questSizes(s.seats.length)[questNumber - 1] ||
      !record(h.votes, s.seats, ['approve', 'reject']) ||
      Object.keys(h.votes).length !== s.seats.length ||
      h.approved !==
        Object.values(h.votes).filter((vote) => vote === 'approve').length >
          s.seats.length / 2
    )
      fail();
    if (h.approved) {
      const q = s.quests[completed];
      if (!q) {
        if (index !== s.history.length - 1 || s.phase !== 'quest') fail();
      } else {
        if (
          !object(q) ||
          !exact(q, [
            'questNumber',
            'proposalNumber',
            'leader',
            'team',
            'failCount',
            'succeeded',
          ]) ||
          q.questNumber !== questNumber ||
          q.proposalNumber !== h.proposalNumber ||
          q.leader !== leader ||
          JSON.stringify(q.team) !== JSON.stringify(h.team) ||
          !Number.isInteger(q.failCount) ||
          q.failCount < 0 ||
          q.failCount >
            q.team.filter((seat) => alignment(s.roles[seat]!) === 'evil')
              .length ||
          q.succeeded !== (q.failCount === 0)
        )
          fail();
        completed++;
        questNumber++;
        rejected = 0;
        leader = nextSeat(s, leader);
      }
    } else {
      rejected++;
      leader = nextSeat(s, leader);
    }
    if (rejected >= 5 && index !== s.history.length - 1) fail();
    const finished = s.quests.slice(0, completed);
    if (
      (finished.filter((q) => q.succeeded).length >= 3 ||
        finished.filter((q) => !q.succeeded).length >= 3) &&
      index !== s.history.length - 1
    )
      fail();
  }
  if (completed !== s.quests.length) fail();
  const successCount = s.quests.filter((q) => q.succeeded).length,
    failCount = s.quests.length - successCount;
  const terminalQuest = successCount === 3 || failCount === 3;
  // Terminal positions keep the completed quest and its leader visible.
  const expectedLeader = terminalQuest
    ? s.quests.at(-1)!.leader
    : rejected === 5
      ? s.history.at(-1)!.leader
      : leader;
  const expectedQuest = terminalQuest ? s.quests.length : questNumber;
  const pending = ['reveal', 'team', 'vote'].includes(s.phase);
  if (
    s.leader !== expectedLeader ||
    s.questNumber !== expectedQuest ||
    s.proposalNumber !== s.history.length + (pending ? 1 : 0) ||
    s.rejectedTeams !== rejected
  )
    fail();
  if (s.phase === 'reveal') {
    if (
      s.history.length ||
      s.quests.length ||
      s.acknowledged.length >= s.seats.length ||
      s.team.length ||
      Object.keys(s.votes).length ||
      Object.keys(s.questCards).length
    )
      fail();
  } else if (s.acknowledged.length !== s.seats.length) fail();
  if (s.phase === 'team' && s.team.length) fail();
  if (
    ['vote', 'quest'].includes(s.phase) &&
    s.team.length !== questSizes(s.seats.length)[s.questNumber - 1]
  )
    fail();
  if (s.phase !== 'vote' && Object.keys(s.votes).length) fail();
  if (s.phase === 'vote' && Object.keys(s.votes).length >= s.seats.length)
    fail();
  if (s.phase !== 'quest' && Object.keys(s.questCards).length) fail();
  if (
    s.phase === 'quest' &&
    (Object.keys(s.questCards).length >= s.team.length ||
      JSON.stringify(s.team) !== JSON.stringify(s.history.at(-1)!.team))
  )
    fail();
  if (
    ['assassinate', 'ended'].includes(s.phase) &&
    JSON.stringify(s.team) !== JSON.stringify(s.history.at(-1)!.team)
  )
    fail();
  if (
    terminalQuest &&
    failCount === 3 &&
    (s.phase !== 'ended' ||
      s.winner !== 'evil' ||
      s.winReason !== 'three-failures')
  )
    fail();
  if (
    rejected === 5 &&
    (s.phase !== 'ended' ||
      s.winner !== 'evil' ||
      s.winReason !== 'five-rejections')
  )
    fail();
  if (successCount === 3) {
    if (!['assassinate', 'ended'].includes(s.phase)) fail();
    if (s.phase === 'ended') {
      if (
        !s.assassinationTarget ||
        !s.seats.includes(s.assassinationTarget) ||
        alignment(s.roles[s.assassinationTarget]!) !== 'good'
      )
        fail();
      const hit = s.roles[s.assassinationTarget!] === 'merlin';
      if (
        s.winner !== (hit ? 'evil' : 'good') ||
        s.winReason !== (hit ? 'merlin-assassinated' : 'merlin-survived')
      )
        fail();
    }
  } else if (s.assassinationTarget !== null) fail();
  if (
    !terminalQuest &&
    rejected < 5 &&
    ['assassinate', 'ended'].includes(s.phase)
  )
    fail();
  if (
    s.phase !== 'ended' &&
    (s.winner !== null ||
      s.winReason !== null ||
      s.assassinationTarget !== null)
  )
    fail();
  const serial =
    s.acknowledged.length +
    s.history.length * (s.seats.length + 1) +
    s.quests.reduce((sum, q) => sum + q.team.length, 0) +
    (s.phase === 'vote' ? 1 + Object.keys(s.votes).length : 0) +
    Object.keys(s.questCards).length +
    (s.assassinationTarget ? 1 : 0);
  if (s.actionSerial !== serial) fail();
  if (
    s.latest === null
      ? s.actionSerial !== 0
      : !object(s.latest) ||
        !exact(s.latest, ['serial', 'actor', 'verb', 'text', 'targets']) ||
        s.latest.serial !== s.actionSerial ||
        (s.latest.actor !== null && !s.seats.includes(s.latest.actor)) ||
        typeof s.latest.verb !== 'string' ||
        typeof s.latest.text !== 'string' ||
        s.latest.text.length > 512 ||
        !validSeats(s.latest.targets)
  )
    fail();
  return structuredClone(s);
}
