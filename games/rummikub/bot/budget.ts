import type { BotDifficulty } from '@tablemax/game-sdk';

export const SEARCH_LIMITS = {
  default: { candidates: 900, generation: 14000, nodes: 1000 },
  doubao: { candidates: 3000, generation: 60000, nodes: 14000 },
  juewu: { candidates: 7000, generation: 130000, nodes: 36000 },
} as const satisfies Record<
  BotDifficulty,
  { candidates: number; generation: number; nodes: number }
>;

export type SearchStats = {
  candidates: number;
  generationSteps: number;
  nodes: number;
  truncated: boolean;
};

/** Deterministic limits keep elapsed time out of action selection and saves. */
export class SearchBudget {
  readonly stats: SearchStats = {
    candidates: 0,
    generationSteps: 0,
    nodes: 0,
    truncated: false,
  };
  readonly limits: (typeof SEARCH_LIMITS)[BotDifficulty];
  constructor(
    difficulty: BotDifficulty,
    private readonly signal?: AbortSignal,
  ) {
    this.limits = SEARCH_LIMITS[difficulty];
  }
  check(): void {
    if (this.signal?.aborted) throw new Error('拉密策略已取消。');
  }
  generate(): boolean {
    this.check();
    if (this.stats.generationSteps >= this.limits.generation) {
      this.stats.truncated = true;
      return false;
    }
    this.stats.generationSteps++;
    return true;
  }
  visit(): boolean {
    this.check();
    if (this.stats.nodes >= this.limits.nodes) {
      this.stats.truncated = true;
      return false;
    }
    this.stats.nodes++;
    return true;
  }
}
