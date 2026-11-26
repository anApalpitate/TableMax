const sampleCaps = [8, 16, 32] as const;

export type UnoSearchSamples = (typeof sampleCaps)[number];

export function isUnoSearchSamples(value: unknown): value is UnoSearchSamples {
  return sampleCaps.some((samples) => samples === value);
}

export const unoSearchRuleStepLimit = 2048;

export function unoSearchRuleSteps(samples: UnoSearchSamples): number {
  return Math.min(samples * 8 * 16, unoSearchRuleStepLimit);
}
