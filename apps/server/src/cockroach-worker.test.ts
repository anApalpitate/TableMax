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
import {
  rules as poker,
  bot as pokerBot,
} from '../../../games/cockroach-poker';
import {
  rules as salad,
  bot as saladBot,
} from '../../../games/cockroach-salad';
const modules = [
  { rules: poker, bot: pokerBot },
  { rules: salad, bot: saladBot },
];
import { WorkerBotExecutor } from './bot-executor';

let workerPath: string;
beforeAll(async () => {
  mkdirSync('tmp', { recursive: true });
  const output = mkdtempSync(resolve('tmp/cockroach-integration-worker-'));
  mkdirSync(join(output, 'bots'));
  workerPath = join(output, 'bot-worker.cjs');
  const manifests = modules.map(({ rules }) => {
    const id = rules.manifest.id;
    const module = JSON.parse(
      readFileSync(`games/${id}/game-module.json`, 'utf8'),
    );
    module.entries = {
      rules: `games/${id}.cjs`,
      bot: `bots/${id}.cjs`,
      web: `web/${id}.js`,
    };
    return module;
  });
  writeFileSync(join(output, 'modules.json'), JSON.stringify(manifests));
  await build({
    entryPoints: ['apps/server/src/bot-worker.ts'],
    outfile: workerPath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    logLevel: 'silent',
  });
  for (const { rules } of modules)
    await build({
      entryPoints: [`games/${rules.manifest.id}/bot/index.ts`],
      outfile: join(output, `bots/${rules.manifest.id}.cjs`),
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
  module: (typeof modules)[number],
  count: number,
  difficulty: BotDifficulty,
) {
  const { rules, bot } = module;
  const room = new RoomCoordinator(
    {
      ...rules,
      initialize: (context: Parameters<typeof rules.initialize>[0]) =>
        rules.initialize({ ...context, random: new RandomSource(63) }),
    },
    bot,
    new MemoryRepository(),
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
    await host({ type: 'add-bot', name: `电脑${i + 1}`, difficulty });
  await host({ type: 'start' });
  return room;
}
for (const module of modules)
  for (const count of [2, 6])
    for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
      it(`${module.rules.manifest.id} ${count} seats ${difficulty} executes an authorized action in a 32MiB Worker under two seconds`, async () => {
        const room = await fixture(module, count, difficulty),
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
          expect(room.view(room.hostToken).gameView).not.toHaveProperty(
            'hands',
          );
        } finally {
          clearTimeout(timer);
        }
      });
    }
