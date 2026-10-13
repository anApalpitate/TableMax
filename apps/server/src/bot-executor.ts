import { Worker } from 'node:worker_threads';
import type { BotExecutor, RoomCoordinator } from '@tablemax/platform-core';
import type { JsonValue } from '@tablemax/game-sdk';

export interface WorkerDiagnostic {
  phase: 'startup' | 'onlineToResult' | 'cancel' | 'exit';
  durationMs: number;
  outcome: 'pending' | 'success' | 'cancelled' | 'failed' | 'exited';
}

export class WorkerBotExecutor implements BotExecutor {
  constructor(
    private workerPath: string,
    private botEntry?: (
      task: NonNullable<ReturnType<RoomCoordinator['botTask']>>,
    ) => string | undefined,
    private diagnostic?: (sample: WorkerDiagnostic) => void,
  ) {}
  execute(
    task: NonNullable<ReturnType<RoomCoordinator['botTask']>>,
    signal: AbortSignal,
  ): Promise<{ action: JsonValue; memory: JsonValue; random: number }> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('cancelled'));
        return;
      }
      const startedAt = this.diagnostic ? performance.now() : 0;
      let onlineAt: number | undefined;
      let finishedAt: number | undefined;
      let outcome: WorkerDiagnostic['outcome'] = 'pending';
      const record = (phase: WorkerDiagnostic['phase'], since: number) => {
        if (!this.diagnostic) return;
        try {
          this.diagnostic({
            phase,
            durationMs: performance.now() - since,
            outcome,
          });
        } catch {
          // Optional measurements must never change strategy or cancellation semantics.
        }
      };
      const worker = new Worker(this.workerPath, {
        workerData: { ...task, botEntry: this.botEntry?.(task) },
        resourceLimits: { maxOldGenerationSizeMb: 32 },
      });
      if (this.diagnostic)
        worker.once('online', () => {
          if (settled) return;
          onlineAt = performance.now();
          record('startup', startedAt);
        });
      let settled = false;
      const finish = (
        error: Error | null,
        result?: { action: JsonValue; memory: JsonValue; random: number },
      ) => {
        if (settled) return;
        settled = true;
        if (this.diagnostic) finishedAt = performance.now();
        signal.removeEventListener('abort', cancel);
        void worker.terminate();
        if (error) reject(error);
        else resolve(result!);
      };
      const cancel = () => {
        if (settled) return;
        outcome = 'cancelled';
        record('cancel', startedAt);
        finish(new Error('cancelled'));
      };
      signal.addEventListener('abort', cancel, { once: true });
      worker.once('error', (error) => {
        if (settled) return;
        outcome = 'failed';
        finish(error);
      });
      worker.once('exit', () => {
        if (outcome === 'pending') outcome = 'exited';
        record('exit', finishedAt ?? startedAt);
        finish(new Error('worker-exited'));
      });
      worker.once(
        'message',
        (result: {
          action: JsonValue;
          memory: JsonValue;
          random: number;
          error?: string;
        }) => {
          if (settled) return;
          const failed =
            result.error ||
            !Number.isInteger(result.random) ||
            result.random <= 0 ||
            result.random > 0xffffffff;
          outcome = failed ? 'failed' : 'success';
          if (onlineAt !== undefined) record('onlineToResult', onlineAt);
          if (failed) finish(new Error('strategy-failed'));
          else finish(null, result);
        },
      );
    });
  }
}
