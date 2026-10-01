import { RoomCoordinator } from './room';
import { RandomSource } from './random';
import type { JsonValue } from '@tablemax/game-sdk';

export interface BotExecutor {
  execute(
    task: NonNullable<ReturnType<RoomCoordinator['botTask']>>,
    signal: AbortSignal,
  ): Promise<{ action: JsonValue; memory: JsonValue; random: number }>;
}

// Production uses an isolated worker executor; the default is for trusted test strategies.
export class BotScheduler {
  private cancel: (() => void) | undefined;
  private unsubscribe: () => void;
  private stopped = false;
  constructor(
    private room: RoomCoordinator,
    private delayMs = 350,
    private timeoutMs = 2_000,
    private executor?: BotExecutor,
  ) {
    this.unsubscribe = room.subscribe(() => this.schedule());
    this.schedule();
  }
  private schedule() {
    this.cancel?.();
    if (this.stopped) return;
    const task = this.room.botTask();
    if (!task) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      const random = new RandomSource(task.data.random);
      const failure = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('timeout'));
        }, this.timeoutMs);
      });
      void Promise.race([
        this.executor
          ? this.executor.execute(task, controller.signal)
          : Promise.resolve().then(async () => {
              const result = await this.room.strategy.decide({
                view: task.view,
                actions: task.actions,
                decision: task.decision,
                memory: task.data.memory,
                random,
                signal: controller.signal,
              });
              return { ...result, random: random.state };
            }),
        failure,
      ])
        .then(async (result) => {
          if (controller.signal.aborted) return;
          const reply = await this.room.submitBot(
            task,
            result.action,
            result.memory,
            result.random,
          );
          if (
            !reply.ok &&
            ![
              'stale-instance',
              'stale-branch',
              'stale-revision',
              'not-actionable',
            ].includes(reply.reason)
          )
            await this.room.botFailed(task);
        })
        .catch(async () => {
          if (!this.stopped) await this.room.botFailed(task);
        })
        .catch(() => {
          /* Failed storage must never produce a success message or a retry loop. */
        })
        .finally(() => {
          if (timeout) clearTimeout(timeout);
        });
    }, this.delayMs);
    this.cancel = () => {
      clearTimeout(timer);
      if (timeout) clearTimeout(timeout);
      controller.abort();
    };
  }
  stop() {
    this.stopped = true;
    this.cancel?.();
    this.unsubscribe();
  }
}
