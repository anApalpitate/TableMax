import { expect, it } from 'vitest';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import {
  RandomSource,
  RoomCoordinator,
  type Save,
} from '@tablemax/platform-core';
import type { Command } from '@tablemax/protocol';
import { createGameRegistry } from './game-registry';
import { SqliteSaveRepository } from './save-repository';
import { WorkerBotExecutor } from './bot-executor';
import { pokemonExpansion as rules } from '../../../games/pokemon-encounters/expansion';
import { bot } from '../../../games/pokemon-encounters/expansion/bot';
import { directPressureFixture } from '../../../games/pokemon-encounters/expansion/bot/test-fixtures';
import type { View } from '../../../games/pokemon-encounters/expansion/project';

it('registers Mischief for expansion while preserving the original strategy version and levels', async () => {
  const registry = createGameRegistry();
  const original = await registry.load('pokemon-encounters', 'original');
  const expansion = await registry.load('pokemon-encounters', 'expansion');
  expect(original.bot).toMatchObject({
    version: '1',
    difficulties: ['default', 'doubao', 'juewu'],
  });
  expect(expansion.bot).toMatchObject({
    version: '1.1.0',
    difficulties: ['default', 'doubao', 'juewu', 'mischief'],
  });
});

it('saves a real Worker response to the two-win rival and replays it after SQLite recovery', async () => {
  const root = resolve(
    process.env.TABLEMAX_TEST_TMP_ROOT ??
      'tmp/pokemon-expansion-bot-rise-20261126',
  );
  mkdirSync(root, { recursive: true });
  const profile = mkdtempSync(join(root, 'expansion-worker-'));
  const workerPath = join(profile, 'bot-worker.cjs');
  const strategyPath = join(profile, 'pokemon.cjs');
  await Promise.all([
    build({
      entryPoints: ['apps/server/src/bot-worker.ts'],
      outfile: workerPath,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
    }),
    build({
      entryPoints: ['games/pokemon-encounters/bot/index.ts'],
      outfile: strategyPath,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
    }),
  ]);
  const game = {
    ...rules,
    initialize(context: Parameters<typeof rules.initialize>[0]) {
      return directPressureFixture({ ...context, random: new RandomSource(1) });
    },
  };
  const registry = createGameRegistry();
  let repository = new SqliteSaveRepository(profile);
  const open = (token?: string) =>
    new RoomCoordinator(
      game,
      bot,
      repository,
      token,
      'test',
      registry,
      undefined,
      'expansion',
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
    await host({ type: 'add-bot', name: '电脑甲', difficulty: 'mischief' });
    await host({ type: 'add-bot', name: '电脑乙', difficulty: 'juewu' });
    await host({ type: 'start' });
    // Freeze the authorized sampled-world input for the Worker and its replay.
    const startedSave = repository.load() as Save;
    const actor = room.botTask()!.decision.seatId;
    startedSave.snapshot!.bots[actor]!.random = 3;
    startedSave.snapshot!.bots[actor]!.memory = null;
    startedSave.revision++;
    repository.save(startedSave);
    repository.close();
    repository = new SqliteSaveRepository(profile);
    room = open(room.hostToken);
    await host({ type: 'resume' });
    const task = room.botTask()!;
    expect(room.view().game?.botDifficulties).toContain('mischief');
    expect(task.data).toMatchObject({
      difficulty: 'mischief',
      version: '1.1.0',
    });
    const view = task.view as View;
    const rival = view.seatOrder.find((seat) => view.winsBySeat[seat] === 2)!;
    expect(view.phase).toBe('greninja-choice');
    const worker = new WorkerBotExecutor(workerPath, () => strategyPath);
    const started = performance.now();
    const result = await worker.execute(task, AbortSignal.timeout(2000));
    expect(performance.now() - started).toBeLessThan(2000);
    expect(result.action).toMatchObject({ type: 'ninja-target', seat: rival });
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
      await worker.execute(room.botTask()!, AbortSignal.timeout(2000)),
    ).toEqual(result);
  } finally {
    repository.close();
  }
}, 15000);
