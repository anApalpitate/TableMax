import type { Color } from '../types';

export const COLOR_NAMES: Record<Color, string> = {
  black: '黑',
  blue: '蓝',
  orange: '橙',
  red: '红',
};

export function scoreLabel(score: number) {
  if (Number.isInteger(score)) return String(score);
  for (const denominator of [2, 3, 6]) {
    const numerator = Math.round(score * denominator);
    if (Math.abs(numerator / denominator - score) < 1e-9)
      return `${numerator}/${denominator}`;
  }
  return score.toLocaleString('zh-CN', { maximumFractionDigits: 3 });
}
