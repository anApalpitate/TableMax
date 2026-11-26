import { beforeAll, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';
import type { BotDifficulty } from '@tablemax/game-sdk';
import type { Command } from '@tablemax/protocol';
import { RoomCoordinator } from '@tablemax/platform-core';
import { RandomSource } from '@tablemax/platform-core/random';
import type {
  Save,
  SaveRepository,
} from '../../../packages/platform-core/src/model';
import { rules, bot } from '../../../games/rummikub';
import type { State } from '../../../games/rummikub/rules';
import type { PlayAction } from '../../../games/rummikub/types';
import { pressureTable } from '../../../games/rummikub/bot/test-fixtures';
import { SqliteSaveRepository } from './save-repository';
import { WorkerBotExecutor } from './bot-executor';
import lateGame from './fixtures/rummikub-late-game.json';
import worstLateGame from './fixtures/rummikub-juewu-peak.json';
import doubaoLateGame from './fixtures/rummikub-doubao-late-game.json';
import denseLateGame from './fixtures/rummikub-dense-late-game.json';
import type { JsonValue } from '@tablemax/game-sdk';

let workerPath: string;
beforeAll(async () => {
  const root = resolve(process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp');
  mkdirSync(root, { recursive: true });
  const output = mkdtempSync(join(root, 'rummikub-worker-'));
  mkdirSync(join(output, 'bots'));
  workerPath = join(output, 'bot-worker.cjs');
  const module = JSON.parse(
    readFileSync(resolve('games/rummikub/game-module.json'), 'utf8'),
  );
  module.entries = {
    rules: 'games/rummikub.cjs',
    bot: 'bots/rummikub.cjs',
    web: 'web/rummikub.js',
  };
  writeFileSync(join(output, 'modules.json'), JSON.stringify([module]));
  await build({
    entryPoints: ['apps/server/src/bot-worker.ts'],
    outfile: workerPath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
  });
  await build({
    entryPoints: ['games/rummikub/bot/index.ts'],
    outfile: join(output, 'bots/rummikub.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
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
async function fixture(seats: number, difficulty: BotDifficulty) {
  const room = new RoomCoordinator(
    {
      ...rules,
      initialize: (context) =>
        rules.initialize({ ...context, random: new RandomSource(57) }),
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
  for (let index = 0; index < seats; index++)
    await host({ type: 'add-bot', name: `电脑${index + 1}`, difficulty });
  await host({ type: 'start' });
  return room;
}
for (const seats of [2, 3, 4]) {
  for (const difficulty of bot.difficulties!) {
    it(`runs ${seats} seats ${difficulty} in the actual 32MiB Worker under the two-second deadline`, async () => {
      const room = await fixture(seats, difficulty),
        task = room.botTask()!;
      const controller = new AbortController(),
        executor = new WorkerBotExecutor(workerPath);
      const timer = setTimeout(() => controller.abort(), 2000),
        start = performance.now();
      try {
        const result = await executor.execute(task, controller.signal);
        expect(performance.now() - start).toBeLessThan(2000);
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
      } finally {
        clearTimeout(timer);
      }
    });
  }
}
it('cancels an in-flight Rummikub Worker without saving its late result', async () => {
  const room = await fixture(4, 'juewu'),
    task = room.botTask()!;
  const controller = new AbortController(),
    executor = new WorkerBotExecutor(workerPath);
  const promise = executor.execute(task, controller.signal);
  controller.abort();
  await expect(promise).rejects.toThrow('cancelled');
  expect(room.view(room.hostToken).history).toHaveLength(0);
});

const pressurePeak = (() => {
  const fixture = structuredClone(worstLateGame);
  const state = rules.validateState(
    fixture.state,
    fixture.state.seats,
  ) as State;
  const seat = fixture.decision.seatId;
  const following =
    state.seats[(state.seats.indexOf(seat) + 1) % state.seats.length]!;
  state.pool.push(...state.racks[following]!.splice(1));
  rules.validateState(state, state.seats);
  return {
    state,
    decision: fixture.decision,
    randomSnapshot: fixture.randomSnapshot,
    view: rules.project(state, { role: 'player', seatId: seat }),
    actions: rules.legalActions(state, seat),
  };
})();

for (const [label, difficulty, peak] of [
  ['default', 'default', worstLateGame],
  ['doubao', 'doubao', doubaoLateGame],
  ['juewu', 'juewu', lateGame],
  ['juewu-dense', 'juewu', denseLateGame],
  ['juewu-local-coverage', 'juewu', doubaoLateGame],
  ['juewu-peak', 'juewu', worstLateGame],
  ['mischief-peak', 'mischief', pressurePeak],
] as const) {
  it(`replays a measured late-game joker hotspot ${label} in the bounded Worker`, async () => {
    // These generated positions contain no production player data. The default
    // level also replays the latest juewu peak's 54-table/3-rack position.
    // Other cases retain the old 2071ms and dense 1596ms measured hotspots.
    // First-hand Worker checks cannot cover their generation and heap pressure.
    const state = rules.validateState(peak.state, peak.state.seats) as State;
    const task: NonNullable<ReturnType<RoomCoordinator['botTask']>> = {
      gameId: 'rummikub',
      rulesVersion: rules.manifest.rulesVersion,
      instanceId: 'late-game-fixture',
      revision: 1,
      branch: 0,
      decision: peak.decision,
      view: peak.view as JsonValue,
      actions: peak.actions as JsonValue[],
      data: {
        id: bot.id,
        version: bot.version,
        difficulty,
        memory: null,
        random: peak.randomSnapshot,
      },
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const start = performance.now();
    try {
      const result = await new WorkerBotExecutor(workerPath).execute(
        task,
        controller.signal,
      );
      expect(performance.now() - start).toBeLessThan(2000);
      expect(
        rules.isLegalAction!(state, result.action, task.decision.seatId),
      ).toBe(true);
      expect(result.memory).toBeNull();
      expect(result.random).toBe(peak.randomSnapshot);
      if (label === 'juewu-local-coverage') {
        const play = result.action as PlayAction;
        expect(play.type).toBe('submit-turn');
        const count = (table: PlayAction['table']) =>
          table.reduce((sum, meld) => sum + meld.tiles.length, 0);
        expect(count(play.table) - count(state.table)).toBe(4);
      }
      const direct = await bot.decide({
        view: task.view,
        actions: task.actions,
        decision: task.decision,
        difficulty,
        memory: null,
        random: new RandomSource(peak.randomSnapshot),
        signal: new AbortController().signal,
      });
      expect(result.action).toEqual(direct.action);
    } finally {
      clearTimeout(timer);
    }
  });
}

it('persists the Mischief rearrangement in a real Worker and replays it after SQLite recovery', async () => {
  const profile = mkdtempSync(join(dirname(workerPath), 'style-profile-'));
  const fixtureRules = { ...rules, initialize: pressureTable };
  let repository = new SqliteSaveRepository(profile);
  let room = new RoomCoordinator(fixtureRules, bot, repository);
  const host = async (command: Command['command']) => {
    const { instanceId, revision, branch } = room.view(room.hostToken);
    expect(
      (
        await room.command(room.hostToken, {
          actionId: crypto.randomUUID(),
          instanceId,
          revision,
          branch,
          command,
        })
      ).ok,
    ).toBe(true);
  };
  try {
    await host({ type: 'add-bot', name: '电脑甲', difficulty: 'mischief' });
    await host({ type: 'add-bot', name: '电脑乙', difficulty: 'juewu' });
    await host({ type: 'start' });
    const task = room.botTask()!;
    expect(room.view().game?.botDifficulties).toContain('mischief');
    expect(task.data).toMatchObject({
      difficulty: 'mischief',
      version: bot.version,
    });
    const executor = new WorkerBotExecutor(workerPath);
    const start = performance.now();
    const result = await executor.execute(task, AbortSignal.timeout(2000));
    expect(performance.now() - start).toBeLessThan(2000);
    const action = result.action as PlayAction;
    expect(action.type).toBe('submit-turn');
    const red = action.table.filter(({ tiles }) => tiles[0]!.color === 'red');
    expect(red).toHaveLength(1);
    expect(red[0]!.tiles).toHaveLength(7);
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
    room = new RoomCoordinator(fixtureRules, bot, repository, room.hostToken);
    expect(room.view()).toMatchObject({ restored: true, paused: true });
    expect(
      (repository.load() as Save).snapshot?.bots[task.decision.seatId],
    ).toEqual(task.data);
    await host({ type: 'resume' });
    const repeated = await executor.execute(
      room.botTask()!,
      AbortSignal.timeout(2000),
    );
    expect(repeated).toEqual(result);
  } finally {
    repository.close();
  }
});
