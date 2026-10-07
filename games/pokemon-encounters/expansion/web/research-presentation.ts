type ResearchSummary = {
  reward: number;
  rewardText?: string;
  riskText?: string;
};

/** New tasks describe several outcomes; reward is only a legacy compatibility field. */
export function researchRewardText(
  task: Pick<ResearchSummary, 'reward' | 'rewardText'>,
) {
  return task.rewardText || `减 ${task.reward} 分`;
}

export function researchRiskText(task: Pick<ResearchSummary, 'riskText'>) {
  return task.riskText || null;
}

/** Keep units and parenthesized rule phrases intact without changing the source text. */
export function rewardTextParts(value: string) {
  const parts: { text: string; keepTogether: boolean }[] = [];
  let start = 0;
  for (const match of value.matchAll(
    /（[^）]+）|\([^)]*\)|[−-]?\d+(?:\.\d+)?\s*分|三分之一/g,
  )) {
    if (match.index > start)
      parts.push({
        text: value.slice(start, match.index),
        keepTogether: false,
      });
    parts.push({ text: match[0], keepTogether: true });
    start = match.index + match[0].length;
  }
  if (start < value.length)
    parts.push({ text: value.slice(start), keepTogether: false });
  return parts;
}

/** Deduction is signed: a failed high-risk task may increase the final score. */
export function researchAdjustmentText(deduction: number) {
  return deduction > 0
    ? `减 ${deduction} 分`
    : deduction < 0
      ? `加 ${-deduction} 分`
      : '分数不变';
}

export function researchScoreText(score: {
  base: number;
  deduction: number;
  total: number;
}) {
  return `场地 ${score.base} 分，研究${researchAdjustmentText(score.deduction)}，最终 ${score.total} 分`;
}
