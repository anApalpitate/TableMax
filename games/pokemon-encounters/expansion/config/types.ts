export const abilities = [
  'mew',
  'team-rocket',
  'zapdos',
  'charizard',
  'snorlax',
  'mewtwo',
  'arceus',
  'greninja',
  'lucario',
  'groudon',
  'kyogre',
  'rayquaza',
] as const;
export type Ability = (typeof abilities)[number];
export type CategoryPresentation = {
  creature: string;
  frame: string;
  abilitySummary: string;
};
export type CardDefinition = {
  categoryId: string;
  name: string;
  value: number | null;
  ability: Ability | null;
  copy: 'horizontal' | 'vertical' | null;
  abilityText: string | null;
  presentation: CategoryPresentation;
};
export type DeckProfile = {
  id: 'small' | 'standard';
  minSeats: number;
  maxSeats: number;
  total: number;
  counts: Record<string, number>;
};
export type RulesProfile = 'legacy' | 'research-buffer-v2';
export type VictoryPolicy = { bonus: 0 | 1; eligible: boolean; cap: 2 | 3 };
export type ResearchEffect =
  | { kind: 'flat'; amount: number }
  | { kind: 'base-scale'; denominator: 2 | 3 }
  | { kind: 'base-credit'; factor: number; cap: number }
  | { kind: 'negative-scale'; factor: number }
  | { kind: 'zero-bounty'; amount: number; cap: number }
  | {
      kind: 'copy-zero-bounty';
      amount: number;
      cap: number;
      minimumValue: number;
      minimumCopies: number;
      minimumRoles: number;
    }
  | {
      kind: 'card-value';
      slots: number[];
      category: string | null;
      minimum: number | null;
      highestOnly: boolean;
      value: number;
      cap: number;
    };
export type ResearchTask = {
  id: string;
  name: string;
  description: string;
  reward: number;
  pool: 'opening' | 'hoenn';
  rewardText?: string;
  riskText?: string;
  rewardEffects?: ResearchEffect[];
  failurePenalty?: number;
  successVictory?: VictoryPolicy;
  failureVictory?: VictoryPolicy;
};
export type ResearchCondition =
  | { type: 'all'; conditions: ResearchCondition[] }
  | {
      type: 'count';
      slots: number[];
      minimum: number | null;
      maximum: number | null;
      category: string | null;
      ability: boolean | null;
      copy: boolean | null;
      outsideZero: boolean;
      atLeast: number;
      atMost: number;
    }
  | { type: 'zero-count'; minimum: number; maximum: number }
  | { type: 'distinct-exact'; slots: number[]; count: number }
  | { type: 'signed-row-balance'; zeroGroups: number[][]; otherMinimum: number }
  | {
      type: 'copy-anchors';
      minimumCopies: number;
      minimumRoles: number;
      minimumValue: number;
    }
  | { type: 'visible-roles'; faceUp: number; minimumRoles: number }
  | { type: 'group-sum'; groups: number[][]; sum: number }
  | {
      type: 'zero-lines';
      lines: number[];
      require: 'any' | 'all';
      minimumValue: number | null;
      minimumRoles: number | null;
    }
  | {
      type: 'equal-groups';
      groups: number[][];
      minimumValue: number | null;
      differentGroups: boolean;
    }
  | {
      type: 'ordered-values';
      groups: number[][];
      require: 'any' | 'all';
      minimumStep: number;
      equalStep: boolean;
      exactStep: number | null;
      minimumSpan: number;
    }
  | {
      type: 'center-extreme';
      center: number;
      slots: number[];
      extreme: 'minimum' | 'maximum';
    }
  | {
      type: 'value-bands';
      bands: {
        slots: number[];
        minimum: number | null;
        maximum: number | null;
      }[];
    }
  | { type: 'signed-line-sum'; groups: number[][]; sum: number }
  | {
      type: 'equal-sums';
      groups: number[][];
      minimumDistinctPerGroup: number;
      distinctSlots: number[];
      minimumDistinctSlots: number;
    }
  | { type: 'distinct-values'; slots: number[]; minimum: number }
  | { type: 'distinct-roles'; slots: number[]; minimum: number }
  | { type: 'ordinary-only'; slots: number[] }
  | { type: 'required-abilities'; abilities: Ability[] }
  | { type: 'copy-in-zero-line' }
  | {
      type: 'hidden-zero-line';
      minimumFaceUp: number;
      minimumFaceDown: number;
      minimumHiddenInLine: number;
    }
  | {
      type: 'center-rings';
      center: number;
      higherSlots: number[];
      lowerSlots: number[];
    }
  | {
      type: 'different-zero-values';
      minimumDifferent: number;
      minimumHighValue: number;
      negativeOutsideZero: boolean;
    };
export type ResearchDiagram = {
  kind: 'lines' | 'positions' | 'values' | 'roles' | 'copy' | 'visibility';
  sample: { instances: string[]; preReveal: boolean[] };
  highlightSlots: number[];
  highlightLines: number[];
  arrows: { from: number; to: number }[];
  annotations: { slots: number[]; text: string }[];
  caption: string;
};
export type ResearchDefinition = ResearchTask & {
  condition: ResearchCondition;
  illustrationId: string;
  diagram: ResearchDiagram;
  presentation: {
    flavor: string;
    subjects: string[];
  };
};
