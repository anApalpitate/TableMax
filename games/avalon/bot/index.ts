import type { BotDifficulty, BotStrategy, JsonValue } from '@tablemax/game-sdk';
import { CONFIGURED_RULES_VERSION } from '../config';
import {
  COURT_RULES_VERSION,
  RULES_VERSION,
  type Action,
  type AvalonView,
} from '../types';
type Hypothesis = { evil: string[]; weight: number };
const goodRole = (role: string) =>
  ['merlin', 'percival', 'servant'].includes(role);
const binomial = (n: number, k: number) => {
  let value = 1;
  for (let i = 1; i <= k; i++) value = (value * (n - i + 1)) / i;
  return value;
};
function combinations(seats: readonly string[], count: number): string[][] {
  if (count === 0) return [[]];
  return seats.flatMap((seat, i) =>
    combinations(seats.slice(i + 1), count - 1).map((rest) => [seat, ...rest]),
  );
}
/** At most 210 hypotheses, using only this seat's authorized projection. */
export function hypotheses(
  view: AvalonView,
  difficulty: BotDifficulty,
): Hypothesis[] {
  const self = view.self;
  if (!self) throw new Error('阿瓦隆策略缺少本人投影。');
  const known = new Set(self.knowledge.evilSeats);
  if (self.alignment === 'evil') known.add(self.seatId);
  const result: Hypothesis[] = [];
  for (const evil of combinations(view.seatOrder, view.evilCount)) {
    if (
      [...known].some((seat) => !evil.includes(seat)) ||
      (self.alignment === 'good' && evil.includes(self.seatId))
    )
      continue;
    if (
      view.variant !== 'configured' &&
      self.role === 'merlin' &&
      evil.some((seat) => !known.has(seat))
    )
      continue;
    if (
      self.role === 'percival' &&
      self.knowledge.merlinCandidates.filter((seat) => evil.includes(seat))
        .length !== 1
    )
      continue;
    let weight = 1;
    const observed =
      difficulty === 'default'
        ? view.quests.slice(-1)
        : difficulty === 'doubao'
          ? view.quests.slice(-2)
          : view.quests;
    for (const q of observed) {
      const count = q.team.filter((seat) => evil.includes(seat)).length;
      if (count < q.failCount) {
        weight = 0;
        break;
      }
      // Success is evidence, never proof of loyalty: evil can play success.
      const sabotage = q.questNumber === 1 ? 0.4 : 0.7;
      weight *=
        binomial(count, q.failCount) *
        sabotage ** q.failCount *
        (1 - sabotage) ** (count - q.failCount);
    }
    if (difficulty === 'juewu')
      for (const p of view.history) {
        const contaminated = p.team.some((seat) => evil.includes(seat));
        for (const seat of view.seatOrder) {
          // Social evidence stays deliberately soft; no vote proves a role.
          const approve = evil.includes(seat)
            ? contaminated
              ? 0.74
              : 0.38
            : p.team.includes(seat)
              ? 0.7
              : 0.48;
          weight *=
            (p.votes[seat] === 'approve' ? approve : 1 - approve) ** 0.25;
        }
        if (contaminated && evil.includes(p.leader)) weight *= 1.12;
      }
    if (weight > 0) result.push({ evil, weight });
  }
  const sum = result.reduce((value, entry) => value + entry.weight, 0);
  if (!sum) throw new Error('阿瓦隆授权证据没有一致的阵营假设。');
  return result.map((entry) => ({
    evil: entry.evil,
    weight: entry.weight / sum,
  }));
}
export function cleanProbability(
  team: readonly string[],
  beliefs: Hypothesis[],
  threshold = 1,
): number {
  return beliefs.reduce(
    (sum, h) =>
      sum +
      (team.filter((seat) => h.evil.includes(seat)).length >= threshold
        ? 0
        : h.weight),
    0,
  );
}
function merlinScore(
  view: AvalonView,
  candidate: string,
  difficulty: BotDifficulty,
): number {
  const self = view.self!;
  if (candidate === self.seatId || self.knowledge.evilSeats.includes(candidate))
    return -1000;
  if (difficulty === 'default') return 0;
  const knownEvil = new Set([self.seatId, ...self.knowledge.evilSeats]);
  let score = 0;
  for (const p of difficulty === 'doubao'
    ? view.history.slice(-5)
    : view.history) {
    const corrupted = p.team.some((seat) => knownEvil.has(seat));
    const informed = corrupted
      ? p.votes[candidate] === 'reject'
      : p.votes[candidate] === 'approve';
    // Compare potentially informed choices with ordinary self-interest.
    score += informed ? (p.team.includes(candidate) ? 0.35 : 1) : -0.3;
    if (p.leader === candidate) score += corrupted ? -0.5 : 1.2;
  }
  return score;
}
export function chooseAction(
  view: AvalonView,
  actions: readonly Action[],
  difficulty: BotDifficulty,
  random: { next(): number },
  signal?: AbortSignal,
): Action {
  if (!view.self || !actions.length)
    throw new Error('阿瓦隆策略没有本人合法选择。');
  if (signal?.aborted) throw new Error('阿瓦隆策略已取消。');
  const self = view.self;
  const threshold = view.questFailThresholds[view.questNumber - 1]!;
  const acknowledge = actions.find(
    (a) => a.type === 'acknowledge' || a.type === 'finish-discussion',
  );
  if (acknowledge) return acknowledge;
  const questCards = actions.filter((a) => a.type === 'quest-card');
  if (questCards.length) {
    const fail = questCards.find(
      (a) => a.type === 'quest-card' && a.card === 'fail',
    );
    if (!fail) return questCards[0]!;
    if (difficulty === 'default') return fail;
    const evil = view.team.filter(
      (seat) => seat === self.seatId || self.knowledge.evilSeats.includes(seat),
    );
    // Select enough known partners without observing any sealed submissions.
    const saboteurs = view.seatOrder
      .filter((seat) => evil.includes(seat))
      .slice(0, threshold);
    const winAtStake = view.successCount === 2 || view.failCount === 2;
    const hide =
      difficulty === 'juewu' &&
      view.questNumber === 1 &&
      !winAtStake &&
      evil.length === 1;
    return saboteurs.includes(self.seatId) && !hide
      ? fail
      : questCards.find(
          (a) => a.type === 'quest-card' && a.card === 'success',
        )!;
  }
  const assassination = actions.filter(
    (a): a is Extract<Action, { type: 'assassinate' }> =>
      a.type === 'assassinate',
  );
  if (assassination.length) {
    const tie = new Map(assassination.map((a) => [a.target, random.next()]));
    return [...assassination].sort(
      (a, b) =>
        merlinScore(view, b.target, difficulty) -
          merlinScore(view, a.target, difficulty) ||
        tie.get(b.target)! - tie.get(a.target)!,
    )[0]!;
  }
  const beliefs = hypotheses(view, difficulty);
  const proposals = actions.filter(
    (a): a is Extract<Action, { type: 'propose-team' }> =>
      a.type === 'propose-team',
  );
  if (proposals.length) {
    const tie = new Map(proposals.map((a) => [a, random.next()]));
    function score(team: readonly string[]): number {
      if (signal?.aborted) throw new Error('阿瓦隆策略已取消。');
      if (self.alignment === 'evil') {
        const ownEvil = team.filter(
          (seat) =>
            seat === self.seatId || self.knowledge.evilSeats.includes(seat),
        ).length;
        if (view.variant === 'configured')
          return (
            (1 - cleanProbability(team, beliefs, threshold)) * 100 +
            (ownEvil === threshold ? 2 : 0)
          );
        return ownEvil === threshold
          ? 100 +
              cleanProbability(
                team.filter(
                  (seat) =>
                    seat !== self.seatId &&
                    !self.knowledge.evilSeats.includes(seat),
                ),
                beliefs,
              ) *
                2
          : ownEvil > threshold
            ? difficulty === 'default'
              ? 99
              : 65
            : 0;
      }
      const clean = cleanProbability(team, beliefs, threshold);
      if (difficulty === 'default')
        return (team.includes(self.seatId) ? 2 : 0) + clean;
      const continuity = view.quests
        .filter((q) => q.succeeded)
        .reduce(
          (sum, q) => sum + q.team.filter((seat) => team.includes(seat)).length,
          0,
        );
      // Merlin still uses his knowledge but need not always include himself.
      return (
        clean * (difficulty === 'juewu' ? 100 : 50) +
        continuity * 0.6 +
        (self.role === 'merlin' && difficulty === 'juewu'
          ? 0
          : team.includes(self.seatId)
            ? 0.5
            : 0)
      );
    }
    const scores = new Map(proposals.map((a) => [a, score(a.team)]));
    return [...proposals].sort(
      (a, b) => scores.get(b)! - scores.get(a)! || tie.get(b)! - tie.get(a)!,
    )[0]!;
  }
  const votes = actions.filter(
    (a): a is Extract<Action, { type: 'vote-team' }> => a.type === 'vote-team',
  );
  if (votes.length) {
    const clean = cleanProbability(view.team, beliefs, threshold);
    const evilOnTeam =
      view.variant === 'configured'
        ? 1 - clean >= 0.5
        : view.team.filter(
            (seat) =>
              seat === self.seatId || self.knowledge.evilSeats.includes(seat),
          ).length >= threshold;
    const approve =
      self.alignment === 'evil'
        ? evilOnTeam
        : view.rejectedTeams === 4 ||
          (difficulty === 'default'
            ? view.team.includes(self.seatId) || view.rejectedTeams >= 2
            : clean >=
              (view.rejectedTeams >= 3
                ? 0.15
                : difficulty === 'juewu'
                  ? 0.4
                  : 0.35));
    return votes.find((a) => a.vote === (approve ? 'approve' : 'reject'))!;
  }
  throw new Error('阿瓦隆策略没有可处理的合法动作。');
}
function createBot(rulesVersion: string): BotStrategy {
  return {
    id: 'avalon-local',
    version: '1.0.0',
    gameId: 'avalon',
    rulesVersion,
    difficulties: ['default', 'doubao', 'juewu'],
    immediateActions: ['finish-discussion'],
    ...(rulesVersion === CONFIGURED_RULES_VERSION
      ? {
          testImmediateActions: ['vote-team', 'quest-card'],
          concurrentActions: ['vote-team', 'quest-card'],
        }
      : {}),
    validateMemory(input) {
      if (input !== null) throw new Error('阿瓦隆策略记忆格式无效。');
      return null;
    },
    async decide({
      view: raw,
      actions,
      decision,
      memory,
      difficulty = 'default',
      random,
      signal,
    }) {
      if (memory !== null) throw new Error('阿瓦隆策略记忆格式无效。');
      const view = raw as AvalonView;
      if (
        view.gameId !== 'avalon' ||
        view.rulesVersion !== rulesVersion ||
        view.self?.seatId !== decision.seatId ||
        !goodRole(view.self.role) !== (view.self.alignment === 'evil')
      )
        throw new Error('阿瓦隆策略授权身份不一致。');
      return {
        action: chooseAction(
          view,
          actions as Action[],
          difficulty,
          random,
          signal,
        ) as JsonValue,
        memory: null,
      };
    },
  };
}
export const bot = createBot(CONFIGURED_RULES_VERSION);
export const botsByVariant = {
  configured: bot,
  classic: createBot(RULES_VERSION),
  court: createBot(COURT_RULES_VERSION),
};
