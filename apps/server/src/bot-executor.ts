import { Worker } from 'node:worker_threads';
import type { BotExecutor, RoomCoordinator } from '@tablemax/platform-core';
import type { JsonValue } from '@tablemax/game-sdk';

export class WorkerBotExecutor implements BotExecutor {
  constructor(private workerPath: string) {}
  execute(
    task: NonNullable<ReturnType<RoomCoordinator['botTask']>>,
    signal: AbortSignal,
  ): Promise<{ action: JsonValue; memory: JsonValue; random: number }> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('cancelled'));
        return;
      }
      const worker = new Worker(this.workerPath, {
        workerData: task,
        resourceLimits: { maxOldGenerationSizeMb: 32 },
      });
      let settled = false;
      const finish = (
        error: Error | null,
        result?: { action: JsonValue; memory: JsonValue; random: number },
      ) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', cancel);
        void worker.terminate();
        if (error) reject(error);
        else resolve(result!);
      };
      const cancel = () => finish(new Error('cancelled'));
      signal.addEventListener('abort', cancel, { once: true });
      worker.once('error', (error) => finish(error));
      worker.once('exit', () => finish(new Error('worker-exited')));
      worker.once(
        'message',
        (result: {
          action: JsonValue;
          memory: JsonValue;
          random: number;
          error?: string;
        }) => {
          if (
            result.error ||
            !Number.isInteger(result.random) ||
            result.random <= 0 ||
            result.random > 0xffffffff
          )
            finish(new Error('strategy-failed'));
          else finish(null, result);
        },
      );
    });
  }
}
