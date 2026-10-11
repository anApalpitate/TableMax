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

// Timers may compete; all actions still pass through the room's serial save queue.
type Task = NonNullable<ReturnType<RoomCoordinator['botTask']>>;
type Waiting = {
  task: Task;
  remaining: number;
  due: number;
  timer?: ReturnType<typeof setTimeout> | undefined;
  controller?: AbortController;
};
export function reactionDelayMs(task: Task): number {
  const timing = task.timing!;
  const text = JSON.stringify([
    task.instanceId,
    task.branch,
    timing.key,
    task.decision.seatId,
    task.data.random,
  ]);
  let hash = 2166136261;
  for (const char of text)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return (
    timing.minMs +
    Math.floor((hash / 0x100000000) * (timing.maxMs - timing.minMs + 1))
  );
}
export class BotScheduler {
  private waiting = new Map<string, Waiting>();
  private unsubscribe: () => void;
  private stopped = false;
  constructor(
    private room: RoomCoordinator,
    private delayMs?: number,
    private timeoutMs = 2_000,
    private executor?: BotExecutor,
  ) {
    this.unsubscribe = room.subscribe(() => this.schedule());
    this.schedule();
  }
  private key(task: Task) {
    return JSON.stringify([
      task.instanceId,
      task.variantId,
      task.rulesVersion,
      task.branch,
      task.timing?.key ?? task.revision,
      task.decision.seatId,
      task.data.id,
      task.data.version,
      task.data.difficulty,
      this.room.playMode,
    ]);
  }
  private discard(key: string, waiting: Waiting) {
    clearTimeout(waiting.timer);
    waiting.controller?.abort();
    this.waiting.delete(key);
  }
  private schedule() {
    if (this.stopped) return;
    if (this.room.botPaused) {
      for (const [key, entry] of this.waiting) {
        if (!entry.task.timing || entry.controller) {
          this.discard(key, entry);
          continue;
        }
        if (entry.timer) entry.remaining = Math.max(0, entry.due - Date.now());
        clearTimeout(entry.timer);
        entry.timer = undefined;
      }
      return;
    }
    const tasks = this.room.botTasks();
    const keys = new Set(tasks.map((task) => this.key(task)));
    for (const [key, entry] of this.waiting)
      if (!keys.has(key)) this.discard(key, entry);
    for (const task of tasks) {
      const key = this.key(task);
      let entry = this.waiting.get(key);
      if (!entry) {
        entry = {
          task,
          remaining:
            this.delayMs ??
            (this.room.playMode === 'test'
              ? 40
              : task.timing
                ? reactionDelayMs(task)
                : botDelayMs(this.room.playMode, task.data.difficulty)),
          due: 0,
        };
        this.waiting.set(key, entry);
      } else entry.task = task;
      if (entry.timer || entry.controller) continue;
      entry.due = Date.now() + entry.remaining;
      const pending = entry;
      entry.timer = setTimeout(
        () => void this.run(key, pending),
        entry.remaining,
      );
    }
  }
  private async run(key: string, entry: Waiting) {
    entry.timer = undefined;
    const task = entry.task;
    const controller = new AbortController();
    entry.controller = controller;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const failure = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('timeout'));
        }, this.timeoutMs);
      });
      const calculate = this.executor
        ? this.executor.execute(task, controller.signal)
        : Promise.resolve().then(async () => {
            const random = new RandomSource(task.data.random);
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
          });
      const result = await Promise.race([calculate, failure]);
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
    } catch {
      if (!this.stopped && this.waiting.get(key) === entry)
        await this.room.botFailed(task).catch(() => {});
    } finally {
      clearTimeout(timeout);
      if (this.waiting.get(key) === entry) this.waiting.delete(key);
    }
  }
  stop() {
    this.stopped = true;
    for (const [key, entry] of this.waiting) this.discard(key, entry);
    this.unsubscribe();
  }
}
