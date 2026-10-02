import { RoomCoordinator } from './room';
import { RandomSource } from './random';
import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';
import type { PlayMode } from '@tablemax/protocol';

export function botDelayMs(
  mode: PlayMode,
  difficulty: BotDifficulty = 'default',
) {
  return mode === 'test'
    ? 40
    : { default: 1500, doubao: 1800, juewu: 2200 }[difficulty];
}

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
  private taskKey: string | null = null;
  constructor(
    private room: RoomCoordinator,
    private delayMs?: number,
    private timeoutMs = 2_000,
    private executor?: BotExecutor,
  ) {
    this.unsubscribe = room.subscribe(() => this.schedule());
    this.schedule();
  }
  private schedule() {
    if (this.stopped) return;
    const task = this.room.botTask();
    const key = task
      ? JSON.stringify([
          task.instanceId,
          task.revision,
          task.branch,
          task.decision.id,
          task.decision.seatId,
          task.data.id,
          task.data.version,
          task.data.difficulty ?? 'default',
          this.room.playMode,
        ])
      : null;
    // Presence updates have no authoritative revision. Preserve their already
    // running delay/calculation so reconnects neither starve nor cancel a bot.
    if (task && this.taskKey === key) return;
    this.cancel?.();
    this.cancel = undefined;
    this.taskKey = key;
    if (!task) return;
    const controller = new AbortController();
    let cancelledByReschedule = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(
      () => {
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
                  difficulty: task.data.difficulty ?? 'default',
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
            // The deadline also aborts the Worker, but it remains a genuine
            // strategy failure. Only explicit replacement/stop cancellation is
            // silent; revision checks still reject failures from old branches.
            if (!this.stopped && !cancelledByReschedule)
              await this.room.botFailed(task);
          })
          .catch(() => {
            /* Failed storage must never produce a success message or a retry loop. */
          })
          .finally(() => {
            if (timeout) clearTimeout(timeout);
          });
      },
      this.delayMs ?? botDelayMs(this.room.playMode, task.data.difficulty),
    );
    this.cancel = () => {
      cancelledByReschedule = true;
      clearTimeout(timer);
      if (timeout) clearTimeout(timeout);
      controller.abort();
    };
  }
  stop() {
    this.stopped = true;
    this.cancel?.();
    this.taskKey = null;
    this.unsubscribe();
  }
}
