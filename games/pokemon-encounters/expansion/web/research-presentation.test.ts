import { expect, it } from 'vitest';
import {
  researchRewardText,
  researchRiskText,
  researchAdjustmentText,
  researchScoreText,
  rewardTextParts,
} from './research-presentation';

it('retains the exact reward text while protecting score units and complete rounding notes', () => {
  for (const source of [
    '梦幻计为−12分，再减10分',
    '正基础分折半（向下取整）',
    '正基础分折半(向下取整)',
  ]) {
    const parts = rewardTextParts(source);
    expect(parts.map((p) => p.text).join('')).toBe(source);
    expect(parts.filter((p) => p.keepTogether).map((p) => p.text)).toEqual(
      source.includes('折半')
        ? [source.includes('（') ? '（向下取整）' : '(向下取整)']
        : ['−12分', '10分'],
    );
  }
});

it('uses the authoritative description of a compound reward instead of the legacy deduction', () => {
  expect(
    researchRewardText({ reward: 8, rewardText: '归零一行，并可额外获得一胜' }),
  ).toBe('归零一行，并可额外获得一胜');
  expect(researchRewardText({ reward: 8 })).toBe('减 8 分');
  expect(researchRiskText({ riskText: '未达成时加 6 分' })).toBe(
    '未达成时加 6 分',
  );
  expect(researchRiskText({})).toBeNull();
});

it('keeps a failed task penalty distinct from a deduction, including zero-score effects', () => {
  expect(researchAdjustmentText(12)).toBe('减 12 分');
  expect(researchAdjustmentText(-6)).toBe('加 6 分');
  expect(researchAdjustmentText(0)).toBe('分数不变');
  expect(researchScoreText({ base: 18, deduction: 12, total: 6 })).toBe(
    '场地 18 分，研究减 12 分，最终 6 分',
  );
  expect(researchScoreText({ base: 18, deduction: -6, total: 24 })).toBe(
    '场地 18 分，研究加 6 分，最终 24 分',
  );
});
