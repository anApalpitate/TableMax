import { loadInstalledModule } from './module-loader';
import { parentPort, workerData } from 'node:worker_threads';
import { RandomSource } from '@tablemax/platform-core/random';
import type { RoomCoordinator } from '@tablemax/platform-core';

const task = workerData as NonNullable<ReturnType<RoomCoordinator['botTask']>>;
async function run() {
  const module = await loadInstalledModule(task.gameId, 'bot');
  const bot =
    task.variantId === undefined
      ? module.bot
      : (
          module as typeof module & {
            botsByVariant?: Record<string, typeof module.bot>;
          }
        ).botsByVariant?.[task.variantId];
  if (
    !bot ||
    task.data.id !== bot.id ||
    task.data.version !== bot.version ||
    task.gameId !== bot.gameId ||
    task.rulesVersion !== bot.rulesVersion
  )
    throw new Error('incompatible-strategy');
  if (
    !(bot.difficulties ?? ['default']).includes(
      task.data.difficulty ?? 'default',
    )
  )
    throw new Error('incompatible-strategy');
  const random = new RandomSource(task.data.random);
  const result = await bot.decide({
    view: task.view,
    actions: task.actions,
    decision: task.decision,
    memory: bot.validateMemory(task.data.memory),
    difficulty: task.data.difficulty ?? 'default',
    random,
    signal: new AbortController().signal,
  });
  parentPort!.postMessage({ ...result, random: random.state });
}
void run().catch(() => {
  parentPort!.postMessage({ error: 'strategy-failed' });
});
