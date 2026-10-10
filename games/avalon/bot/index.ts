import type { BotDifficulty, BotStrategy, JsonValue } from '@tablemax/game-sdk';
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
/** Enumerate at most 15 pairs. Every constraint comes from this seat's projection. */
export function hypotheses(
  view: AvalonView,
  difficulty: BotDifficulty,
): Hypothesis[] {
  const self = view.self;
  if (!self) throw new Error('阿瓦隆策略缺少本人投影。');
  const known = new Set(self.knowledge.evilSeats);
  if (self.alignment === 'evil') known.add(self.seatId);
  const result: Hypothesis[] = [];
  for (let i = 0; i < view.seatOrder.length; i++)
    for (let j = i + 1; j < view.seatOrder.length; j++) {
      const evil = [view.seatOrder[i]!, view.seatOrder[j]!];
      if (
        [...known].some((seat) => !evil.includes(seat)) ||
        (self.alignment === 'good' && evil.includes(self.seatId))
      )
        continue;
      if (self.role === 'merlin' && evil.some((seat) => !known.has(seat)))
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
): number {
  return beliefs.reduce(
    (sum, h) =>
      sum + (team.some((seat) => h.evil.includes(seat)) ? 0 : h.weight),
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
  const acknowledge = actions.find((a) => a.type === 'acknowledge');
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
    // Known partners deterministically choose one saboteur, without reading submissions.
    const saboteur = view.seatOrder.find((seat) => evil.includes(seat));
    const winAtStake = view.successCount === 2 || view.failCount === 2;
    const hide =
      difficulty === 'juewu' &&
      view.questNumber === 1 &&
      !winAtStake &&
      evil.length === 1;
    return saboteur === self.seatId && !hide
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
        return ownEvil === 1
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
          : ownEvil === 2
            ? difficulty === 'default'
              ? 99
              : 65
            : 0;
      }
      const clean = cleanProbability(team, beliefs);
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
    return [...proposals].sort(
      (a, b) => score(b.team) - score(a.team) || tie.get(b)! - tie.get(a)!,
    )[0]!;
  }
  const votes = actions.filter(
    (a): a is Extract<Action, { type: 'vote-team' }> => a.type === 'vote-team',
  );
  if (votes.length) {
    const clean = cleanProbability(view.team, beliefs);
    const evilOnTeam = view.team.some(
      (seat) => seat === self.seatId || self.knowledge.evilSeats.includes(seat),
    );
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
export const bot = createBot(RULES_VERSION);
export const botsByVariant = {
  classic: bot,
  court: createBot(COURT_RULES_VERSION),
};
