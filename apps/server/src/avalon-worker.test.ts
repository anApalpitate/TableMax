import { beforeAll, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
import { SqliteSaveRepository } from './save-repository';
import { pressureNomination } from '../../../games/avalon/bot/test-fixtures';

let workerPath: string;
beforeAll(async () => {
  const root = resolve(process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp');
  mkdirSync(root, { recursive: true });
  const output = mkdtempSync(join(root, 'avalon-worker-'));
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
  await Promise.all([
    build({
      entryPoints: ['apps/server/src/bot-worker.ts'],
      outfile: workerPath,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      logLevel: 'silent',
    }),
    build({
      entryPoints: ['games/avalon/bot/index.ts'],
      outfile: join(output, 'bots/avalon.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      logLevel: 'silent',
    }),
  ]);
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
for (const count of [5, 6, 7, 8, 9, 10])
  for (const variant of ['configured'] as const)
    for (const difficulty of botsByVariant[variant].difficulties!) {
      it(`Avalon ${variant} ${count} seats ${difficulty} completes a natural match in isolated 32MiB Workers`, async () => {
        const { room, host } = await fixture(count, difficulty, variant);
        const executor = new WorkerBotExecutor(workerPath);
        let decisions = 0,
          maximumMs = 0;
        const phases = new Set<string>();
        while (
          room.view(room.hostToken).status === 'playing' &&
          decisions < 650
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

it('10 Mischief sealed ballots calculate simultaneously in real Workers and survive serial commits', async () => {
  const { room } = await fixture(10, 'mischief', 'configured');
  while ((room.view().gameView as AvalonView).phase !== 'vote') {
    const task = room.botTask()!;
    expect(
      (await room.submitBot(task, task.actions[0]!, null, task.data.random)).ok,
    ).toBe(true);
  }
  const tasks = room.botTasks();
  expect(tasks).toHaveLength(10);
  const executor = new WorkerBotExecutor(workerPath);
  let active = 0,
    peak = 0;
  const started = performance.now();
  await Promise.all(
    tasks.map(async (task) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      active++;
      peak = Math.max(peak, active);
      try {
        const result = await executor.execute(task, controller.signal);
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
      } finally {
        active--;
        clearTimeout(timer);
      }
    }),
  );
  expect(peak).toBe(10);
  expect(active).toBe(0);
  expect(performance.now() - started).toBeLessThan(2000);
  expect(room.view().botError).toBeNull();
});

it('persists a configured Mischief nomination and replays it with a real Worker after reopening SQLite', async () => {
  const profile = mkdtempSync(join(dirname(workerPath), 'avalon-mischief-'));
  const rules = {
    ...rulesByVariant.configured,
    initialize: (
      context: Parameters<typeof rulesByVariant.configured.initialize>[0],
    ) => pressureNomination(context),
  };
  const bot = botsByVariant.configured;
  const registry = createGameRegistry();
  let repository = new SqliteSaveRepository(profile);
  const open = (token?: string) =>
    new RoomCoordinator(
      rules,
      bot,
      repository,
      token,
      'test',
      registry,
      undefined,
      'configured',
    );
  let room = open();
  const host = async (command: Command['command']) => {
    const { instanceId, revision, branch } = room.view(room.hostToken);
    expect(
      await room.command(room.hostToken, {
        actionId: crypto.randomUUID(),
        instanceId,
        revision,
        branch,
        command,
      }),
    ).toMatchObject({ ok: true });
  };
  try {
    for (let i = 0; i < 7; i++)
      await host({
        type: 'add-bot',
        name: '圆桌' + (i + 1),
        difficulty: 'mischief',
      });
    await host({ type: 'start' });
    const task = room.botTask()!;
    expect(room.view().game?.botDifficulties).toContain('mischief');
    expect(task.data).toMatchObject({
      difficulty: 'mischief',
      version: '1.1.0',
    });
    const view = task.view as AvalonView;
    expect(view.questNumber).toBe(4);
    expect(view.self?.role).toBe('merlin');
    expect(view.revealedRoles).toBeNull();
    const started = performance.now();
    const executor = new WorkerBotExecutor(workerPath);
    const result = await executor.execute(task, AbortSignal.timeout(2000));
    expect(performance.now() - started).toBeLessThan(2000);
    expect((result.action as { team: string[] }).team).not.toContain(
      view.seatOrder[1],
    );
    expect(task.actions).toContainEqual(result.action);
    expect(
      (await room.submitBot(task, result.action, result.memory, result.random))
        .ok,
    ).toBe(true);
    await host({
      type: 'rollback',
      checkpointId: room.view(room.hostToken).history[0]!.id,
    });
    repository.close();
    repository = new SqliteSaveRepository(profile);
    room = open(room.hostToken);
    expect(room.view()).toMatchObject({ restored: true, paused: true });
    expect(
      (repository.load() as Save).snapshot?.bots[task.decision.seatId],
    ).toEqual(task.data);
    await host({ type: 'resume' });
    expect(
      await executor.execute(room.botTask()!, AbortSignal.timeout(2000)),
    ).toEqual(result);
  } finally {
    repository.close();
  }
});
