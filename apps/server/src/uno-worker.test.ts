import { beforeAll, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { RoomCoordinator } from '@tablemax/platform-core';
import { RandomSource } from '@tablemax/platform-core/random';
import type {
  Save,
  SaveRepository,
} from '../../../packages/platform-core/src/model';
import type { Command } from '@tablemax/protocol';
import type { BotDifficulty } from '@tablemax/game-sdk';
import { rules, bot } from '../../../games/uno';
import { WorkerBotExecutor } from './bot-executor';

let workerPath: string;
beforeAll(async () => {
  mkdirSync('tmp', { recursive: true });
  const output = mkdtempSync(resolve('tmp/uno-worker-'));
  mkdirSync(join(output, 'bots'));
  workerPath = join(output, 'bot-worker.cjs');
  const module = JSON.parse(readFileSync('games/uno/game-module.json', 'utf8'));
  module.entries = {
    rules: 'games/uno.cjs',
    bot: 'bots/uno.cjs',
    web: 'web/uno.js',
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
    entryPoints: ['games/uno/bot/index.ts'],
    outfile: join(output, 'bots/uno.cjs'),
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
async function fixture(
  count: number,
  difficulty: BotDifficulty,
  repository = new MemoryRepository(),
) {
  const room = new RoomCoordinator(
    {
      ...rules,
      initialize: (context) =>
        rules.initialize({ ...context, random: new RandomSource(63) }),
    },
    bot,
    repository,
  );
  const host = async (command: Command['command']) => {
    const view = room.view(room.hostToken);
    expect(
      (
        await room.command(room.hostToken, {
          actionId: crypto.randomUUID(),
          instanceId: view.instanceId,
          revision: view.revision,
          branch: view.branch,
          command,
        })
      ).ok,
    ).toBe(true);
  };
  for (let i = 0; i < count; i++)
    await host({ type: 'add-bot', name: `UNO电脑${i + 1}`, difficulty });
  await host({ type: 'start' });
  return room;
}
for (const count of [2, 4, 6])
  for (const difficulty of [
    'default',
    'doubao',
    'juewu',
    'mischief',
  ] as const) {
    it(`UNO ${count} seats ${difficulty} executes an authorized action in a 32MiB Worker under two seconds`, async () => {
      const room = await fixture(count, difficulty),
        task = room.botTask()!;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      try {
        const started = performance.now();
        const result = await new WorkerBotExecutor(workerPath).execute(
          task,
          controller.signal,
        );
        expect(performance.now() - started).toBeLessThan(2000);
        expect(
          (
            await room.submitBot(
              task,
              result.action,
              result.memory,
              result.random,
            )
          ).ok,
        ).toBe(true);
        expect(room.view(room.hostToken).history).toHaveLength(1);
        expect(room.view(room.hostToken).gameView).not.toHaveProperty('hands');
      } finally {
        clearTimeout(timer);
      }
    });
  }
it('UNO cancels an old Worker without saving its result', async () => {
  const room = await fixture(6, 'juewu');
  const controller = new AbortController();
  const result = new WorkerBotExecutor(workerPath).execute(
    room.botTask()!,
    controller.signal,
  );
  controller.abort();
  await expect(result).rejects.toThrow('cancelled');
  expect(room.view(room.hostToken).history).toHaveLength(0);
});

it('persists the UNO style and restores it in the same strategy release', async () => {
  const repository = new MemoryRepository();
  const room = await fixture(4, 'mischief', repository);
  expect(room.view().game?.botDifficulties).toEqual([
    'default',
    'doubao',
    'juewu',
    'mischief',
  ]);
  expect(repository.value?.snapshot?.bots).toBeDefined();
  const restored = new RoomCoordinator(rules, bot, repository);
  expect(restored.view()).toMatchObject({ restored: true, paused: true });
  expect(
    restored.view().seats.map(({ botDifficulty }) => botDifficulty),
  ).toEqual(Array(4).fill('mischief'));
  expect(
    Object.values(repository.value!.snapshot!.bots).map(
      ({ difficulty, version }) => [difficulty, version],
    ),
  ).toEqual(Array.from({ length: 4 }, () => ['mischief', '1.1.0']));
});
