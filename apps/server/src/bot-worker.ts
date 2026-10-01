import { parentPort, workerData } from 'node:worker_threads';
import { bot } from '@tablemax/game-template';
import { RandomSource, type RoomCoordinator } from '@tablemax/platform-core';

const task = workerData as NonNullable<ReturnType<RoomCoordinator['botTask']>>;
async function run() {
  if (task.data.id !== bot.id || task.data.version !== bot.version)
    throw new Error('incompatible-strategy');
  const random = new RandomSource(task.data.random);
  const result = await bot.decide({
    view: task.view,
    actions: task.actions,
    decision: task.decision,
    memory: bot.validateMemory(task.data.memory),
    random,
    signal: new AbortController().signal,
  });
  parentPort!.postMessage({ ...result, random: random.state });
}
void run().catch(() => {
  parentPort!.postMessage({ error: 'strategy-failed' });
});
