import { card } from './cards';
import { categoryMatches, lines } from './research';
import type {
  ResearchEffect,
  ResearchTask,
  VictoryPolicy,
} from './config/types';
import type { Score } from './scoring';
export type ScoreEffect = {
  kind: string;
  label: string;
  adjustment: number;
  slots?: number[];
};
export const ordinaryVictory = (): VictoryPolicy => ({
  bonus: 0,
  eligible: true,
  cap: 3,
});
/** Every effect reads the same original values/base. Effects never feed one another. */
function effectResult(
  effect: ResearchEffect,
  board: readonly string[],
  score: Score,
): ScoreEffect {
  const zero = new Set(score.zeroSlots);
  switch (effect.kind) {
    case 'flat':
      return {
        kind: effect.kind,
        label: effect.amount < 0 ? '研究分数奖励' : '研究风险代价',
        adjustment: effect.amount,
      };
    case 'base-scale':
      return {
        kind: effect.kind,
        label: `正基础分取${effect.denominator === 2 ? '一半' : '三分之一'}`,
        adjustment:
          score.base > 0
            ? Math.floor(score.base / effect.denominator) - score.base
            : 0,
      };
    case 'base-credit':
      return {
        kind: effect.kind,
        label: '正基础分回馈',
        adjustment: -Math.min(
          effect.cap,
          Math.max(0, score.base) * effect.factor,
        ),
      };
    case 'negative-scale': {
      const slots = score.values.flatMap((v, i) =>
        v < 0 && !zero.has(i) ? [i] : [],
      );
      return {
        kind: effect.kind,
        label: `负数牌按${effect.factor}倍计分`,
        slots,
        adjustment: slots.reduce(
          (n, i) => n + score.values[i]! * (effect.factor - 1),
          0,
        ),
      };
    }
    case 'zero-bounty':
      return {
        kind: effect.kind,
        label: '归零位置额外奖励',
        slots: score.zeroSlots,
        adjustment: -Math.min(
          effect.cap,
          score.zeroSlots.length * effect.amount,
        ),
      };
    case 'copy-zero-bounty': {
      const eligibleLines = score.matchedLines.filter((line) => {
        const copies = score.copies.filter((copy) =>
          lines[line]!.includes(copy.slot),
        );
        return (
          score.values[lines[line]![0]!]! >= effect.minimumValue &&
          copies.length >= effect.minimumCopies &&
          new Set(
            copies.map((copy) => card(board[copy.path.at(-1)!]!).categoryId),
          ).size >= effect.minimumRoles
        );
      });
      const slots = score.copies
        .filter((copy) =>
          eligibleLines.some((line) => lines[line]!.includes(copy.slot)),
        )
        .map((copy) => copy.slot);
      return {
        kind: effect.kind,
        label: '达标线复制牌奖励',
        slots,
        adjustment: -Math.min(effect.cap, slots.length * effect.amount),
      };
    }
    case 'card-value': {
      let slots = effect.slots.filter(
        (i) =>
          !zero.has(i) &&
          categoryMatches(card(board[i]!).categoryId, effect.category) &&
          (effect.minimum === null || score.values[i]! >= effect.minimum),
      );
      if (effect.highestOnly && slots.length)
        slots = [
          slots.reduce((best, i) =>
            score.values[i]! > score.values[best]! ? i : best,
          ),
        ];
      const adjustment = slots.reduce(
        (n, i) => n + effect.value - score.values[i]!,
        0,
      );
      return {
        kind: effect.kind,
        label: `指定未归零牌计为${effect.value}分`,
        slots,
        adjustment: Math.max(-effect.cap, adjustment),
      };
    }
  }
}
export function researchReward(
  task: ResearchTask,
  achieved: boolean,
  board: readonly string[],
  score: Score,
) {
  const effects = achieved
    ? task.rewardEffects!.map((effect) => effectResult(effect, board, score))
    : [
        {
          kind: 'failure',
          label: '未达成研究代价',
          adjustment: task.failurePenalty!,
        },
      ];
  const victory = {
    ...(achieved ? task.successVictory! : task.failureVictory!),
  };
  return {
    effects,
    victory,
    title: achieved ? `${task.name}研究达成` : null,
    deduction: -effects.reduce((sum, effect) => sum + effect.adjustment, 0),
  };
}
export function mergeVictory(
  policies: readonly VictoryPolicy[],
): VictoryPolicy {
  return {
    bonus: policies.some((p) => p.bonus === 1) ? 1 : 0,
    eligible: policies.every((p) => p.eligible),
    cap: policies.some((p) => p.cap === 2) ? 2 : 3,
  };
}
/** Existing wins are never revoked by a failed research cap. */
export function victoryAward(
  existing: number,
  policy: VictoryPolicy,
): 0 | 1 | 2 {
  return (
    policy.eligible
      ? Math.max(
          0,
          Math.min(1 + policy.bonus, policy.cap - existing, 3 - existing),
        )
      : 0
  ) as 0 | 1 | 2;
}
