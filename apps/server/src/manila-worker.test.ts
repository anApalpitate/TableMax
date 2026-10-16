import { beforeAll, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { RoomCoordinator } from '@tablemax/platform-core';
import type {
  Save,
  SaveRepository,
} from '../../../packages/platform-core/src/model';
import type { Command } from '@tablemax/protocol';
import { rules, bot } from '../../../games/manila';
import type { ManilaView } from '../../../games/manila/rules/view';
import { WorkerBotExecutor } from './bot-executor';

let workerPath: string;
beforeAll(async () => {
  mkdirSync('tmp', { recursive: true });
  const output = mkdtempSync(resolve('tmp/manila-worker-'));
  mkdirSync(join(output, 'bots'));
  workerPath = join(output, 'bot-worker.cjs');
  const module = JSON.parse(
    readFileSync('games/manila/game-module.json', 'utf8'),
  );
  module.entries = {
    rules: 'games/manila.cjs',
    bot: 'bots/manila.cjs',
    web: 'web/manila.js',
  };
  writeFileSync(join(output, 'modules.json'), JSON.stringify([module]));
  await build({
    entryPoints: ['apps/server/src/bot-worker.ts'],
    outfile: workerPath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    logLevel: 'silent',
  });
  await build({
    entryPoints: ['games/manila/bot/index.ts'],
    outfile: join(output, 'bots/manila.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    logLevel: 'silent',
  });
});
class MemoryRepository implements SaveRepository {
  value: Save | null = null;
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    this.value = structuredClone(value);
  }
}
async function fixture(count: number) {
  const room = new RoomCoordinator(
    rules,
    bot,
    new MemoryRepository(),
    undefined,
    'test',
  );
  const host = async (command: Command['command']) => {
    const v = room.view(room.hostToken);
    expect(
      (
        await room.command(room.hostToken, {
          actionId: crypto.randomUUID(),
          instanceId: v.instanceId,
          revision: v.revision,
          branch: v.branch,
          command,
        })
      ).ok,
    ).toBe(true);
  };
  const levels = ['default', 'doubao', 'juewu'] as const;
  for (let i = 0; i < count; i++)
    await host({
      type: 'add-bot',
      name: `航商${i + 1}`,
      difficulty: levels[i % 3]!,
    });
  await host({ type: 'start' });
  return { room, host };
}
for (const count of [3, 4, 5]) {
  it(`Manila ${count} seats mixed levels finish naturally in real 32MiB Workers through the platform save path`, async () => {
    const { room, host } = await fixture(count);
    const executor = new WorkerBotExecutor(workerPath);
    const phases = new Set<string>();
    let decisions = 0;
    while (room.view().status === 'playing' && decisions < 2500) {
      const v = room.view().gameView as ManilaView;
      expect(v.self).toBeNull();
      phases.add(v.phase);
      const task = room.botTask();
      expect(task).not.toBeNull();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      try {
        const result = await executor.execute(task!, controller.signal);
        expect(
          (
            await room.submitBot(
              task!,
              result.action,
              result.memory,
              result.random,
            )
          ).ok,
        ).toBe(true);
      } finally {
        clearTimeout(timer);
      }
      decisions++;
      if (decisions === count + 4) {
        const stale = room.botTask()!;
        const point = room.view(room.hostToken).history.at(-1)!;
        await host({ type: 'rollback', checkpointId: point.id });
        expect(room.view().paused).toBe(true);
        expect(
          (
            await room.submitBot(
              stale,
              stale.actions[0]!,
              null,
              stale.data.random,
            )
          ).ok,
        ).toBe(false);
        await host({ type: 'resume' });
      }
    }
    const final = room.view();
    expect(final.status).toBe('ended');
    const game = final.gameView as ManilaView;
    expect(game.winners.length).toBeGreaterThan(0);
    expect(Object.values(game.market)).toContain(30);
    expect(Object.keys(game.scores!)).toHaveLength(count);
    expect(
      phases.has('auction') && phases.has('setup') && phases.has('place'),
    ).toBe(true);
    expect(final.botError).toBeNull();
  }, 240000);
}
it('Manila cancels an obsolete real Worker without adding a saved checkpoint', async () => {
  const { room } = await fixture(3);
  const controller = new AbortController();
  const result = new WorkerBotExecutor(workerPath).execute(
    room.botTask()!,
    controller.signal,
  );
  controller.abort();
  await expect(result).rejects.toThrow('cancelled');
  expect(room.view(room.hostToken).history).toHaveLength(0);
});
