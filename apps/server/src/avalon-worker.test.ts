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
import type { BotDifficulty } from '@tablemax/game-sdk';
import { rulesByVariant } from '../../../games/avalon/rules';
import { botsByVariant } from '../../../games/avalon/bot';
import type { AvalonView, Variant } from '../../../games/avalon/types';
import { createGameRegistry } from './game-registry';
import { WorkerBotExecutor } from './bot-executor';

let workerPath: string;
beforeAll(async () => {
  mkdirSync('tmp', { recursive: true });
  const output = mkdtempSync(resolve('tmp/avalon-worker-'));
  mkdirSync(join(output, 'bots'));
  workerPath = join(output, 'bot-worker.cjs');
  const module = JSON.parse(
    readFileSync('games/avalon/game-module.json', 'utf8'),
  );
  module.entries = {
    rules: 'games/avalon.cjs',
    bot: 'bots/avalon.cjs',
    web: 'web/avalon.js',
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
    entryPoints: ['games/avalon/bot/index.ts'],
    outfile: join(output, 'bots/avalon.cjs'),
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
  variant: Variant,
) {
  const room = new RoomCoordinator(
    rulesByVariant[variant],
    botsByVariant[variant],
    new MemoryRepository(),
    undefined,
    'test',
    createGameRegistry(),
    undefined,
    variant,
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
  for (let i = 0; i < count; i++)
    await host({ type: 'add-bot', name: `圆桌${i + 1}`, difficulty });
  await host({ type: 'start' });
  return { room, host };
}
for (const count of [5, 6])
  for (const variant of ['classic', 'court'] as const)
    for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
      it(`Avalon ${variant} ${count} seats ${difficulty} completes a natural match in isolated 32MiB Workers`, async () => {
        const { room, host } = await fixture(count, difficulty, variant);
        const executor = new WorkerBotExecutor(workerPath);
        let decisions = 0,
          maximumMs = 0;
        const phases = new Set<string>();
        while (
          room.view(room.hostToken).status === 'playing' &&
          decisions < 200
        ) {
          const g = room.view(room.hostToken).gameView as AvalonView;
          phases.add(g.phase);
          expect(g.self).toBeNull();
          expect(g.revealedRoles).toBeNull();
          const task = room.botTask();
          expect(task).not.toBeNull();
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2000);
          try {
            const started = performance.now();
            const result = await executor.execute(task!, controller.signal);
            maximumMs = Math.max(maximumMs, performance.now() - started);
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
          if (decisions === count + 2) {
            await host({ type: 'pause' });
            const checkpoint = room.view(room.hostToken).history.at(-1)!;
            await host({ type: 'rollback', checkpointId: checkpoint.id });
            expect(room.view(room.hostToken).paused).toBe(true);
            await host({ type: 'resume' });
          }
        }
        const final = room.view(room.hostToken);
        expect(final.status).toBe('ended');
        expect((final.gameView as AvalonView).winner).not.toBeNull();
        expect(
          phases.has('reveal') && phases.has('team') && phases.has('vote'),
        ).toBe(true);
        expect(maximumMs).toBeLessThan(2000);
        expect(decisions).toBeGreaterThan(count);
      }, 120000);
    }
it('Avalon cancels an obsolete Worker without committing its result', async () => {
  const { room } = await fixture(6, 'juewu', 'court');
  const controller = new AbortController();
  const result = new WorkerBotExecutor(workerPath).execute(
    room.botTask()!,
    controller.signal,
  );
  controller.abort();
  await expect(result).rejects.toThrow('cancelled');
  expect(room.view(room.hostToken).history).toHaveLength(0);
});
