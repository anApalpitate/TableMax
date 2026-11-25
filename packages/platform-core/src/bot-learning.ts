import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';
import type { BotLearningOptions, BotLearningStatus } from '@tablemax/protocol';

export interface LearningPosition {
  instanceId: string;
  branch: number;
  revision: number;
  gameId: string;
  rulesVersion: string;
  variantId?: string;
  releaseRef?: string;
}

export type LearningEvent =
  | (LearningPosition & {
      type: 'decision';
      seat: number;
      decisionId: string;
      checkpointId: string;
      beforeRevision: number;
      source: 'bot' | 'player-command';
      observation: JsonValue;
      actions: readonly JsonValue[];
      action: JsonValue;
      policy?: {
        id: string;
        version: string;
        difficulty?: BotDifficulty;
        memory: JsonValue;
        modelRef?: string;
      };
      result?: JsonValue;
    })
  | (LearningPosition & {
      type: 'rollback';
      previousBranch: number;
      checkpointId: string;
    })
  | (LearningPosition & {
      type: 'abandoned';
    });

export function durableLearningProvenance(
  source: Extract<LearningEvent, { type: 'decision' }>['source'],
  difficulty?: BotDifficulty,
) {
  return {
    labelVersion: 1 as const,
    sourceType: source,
    qualityTier:
      source === 'bot' && difficulty && difficulty !== 'default'
        ? ('standard' as const)
        : ('exploratory' as const),
    validationStatus: 'durable-authorized' as const,
    sourceBasis:
      source === 'bot'
        ? ('saved-bot-policy' as const)
        : ('saved-player-command' as const),
  };
}

export interface BotLearningStore {
  status(): BotLearningStatus;
  update(options: BotLearningOptions, position: LearningPosition | null): void;
  wants(gameId: string): boolean;
  record(event: LearningEvent): void;
}
