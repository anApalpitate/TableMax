import type { JsonValue } from '@tablemax/game-sdk';
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

export interface BotLearningStore {
  status(): BotLearningStatus;
  update(options: BotLearningOptions, position: LearningPosition | null): void;
  wants(gameId: string): boolean;
  record(event: LearningEvent): void;
}
