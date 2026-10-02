import { parentPort, workerData } from 'node:worker_threads';
import { bot as templateBot } from '@tablemax/game-template';
import { bot as pokemonBot } from '../../../games/pokemon-encounters';
import { RandomSource, type RoomCoordinator } from '@tablemax/platform-core';

const task = workerData as NonNullable<ReturnType<RoomCoordinator['botTask']>>;
async function run() {
  const bot = [pokemonBot, templateBot].find(
    (strategy) => strategy.id === task.data.id,
  );
  if (!bot || task.data.version !== bot.version)
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
