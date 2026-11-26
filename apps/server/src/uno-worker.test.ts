import { beforeAll, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { GameRegistry, RoomCoordinator } from '@tablemax/platform-core';
import { verifyUnoWorker } from '../../../tools/analysis/bots/uno-worker-verification';
import { unoCorrectionFeatureNames } from '../../../games/uno/bot/correction';
import {
  unoLeafFeatureNames,
  unoLeafFeatureNamesFor,
  type UnoLeafFeatureVersion,
} from '../../../games/uno/bot/calibration';
import { LocalBotModels } from './local-bot-models';
import { LocalBotLearning } from './local-bot-learning';
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
  const temporaryRoot = resolve(process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp');
  mkdirSync(temporaryRoot, { recursive: true });
  const output = mkdtempSync(join(temporaryRoot, 'uno-worker-'));
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
async function hostCommand(room: RoomCoordinator, command: Command['command']) {
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
  for (let i = 0; i < count; i++)
    await hostCommand(room, {
      type: 'add-bot',
      name: `UNO电脑${i + 1}`,
      difficulty,
    });
  await hostCommand(room, { type: 'start' });
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
      const profile = mkdtempSync(join(dirname(workerPath), 'capture-'));
      room.configureBotLearning(new LocalBotLearning(profile, true));
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
        const capture = JSON.parse(
          readFileSync(
            join(profile, 'learning', 'uno-decisions-v1.jsonl'),
            'utf8',
          ),
        );
        expect(capture).toMatchObject({
          source: 'bot',
          policy: { difficulty },
          provenance: {
            sourceType: 'bot',
            qualityTier: difficulty === 'default' ? 'exploratory' : 'standard',
            validationStatus: 'durable-authorized',
          },
        });
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

it.each([
  { seats: 2, drawPenaltyStacking: true, catchUnoDelayMs: 500 },
  { seats: 4, drawPenaltyStacking: false, catchUnoDelayMs: 500 },
  { seats: 4, drawPenaltyStacking: true, catchUnoDelayMs: 1000 },
  { seats: 6, drawPenaltyStacking: true, catchUnoDelayMs: 500 },
])(
  'keeps the heuristic Worker for an out-of-scope match %j',
  async ({ seats, ...setup }) => {
    const registry = new GameRegistry([
      {
        catalog: { id: 'uno', name: 'UNO', min: 2, max: 6 },
        load: async () => ({ rules, bot, releaseRef: '6'.repeat(64) }),
      },
    ]);
    const repository = new MemoryRepository();
    const room = await RoomCoordinator.open(
      registry,
      repository,
      undefined,
      undefined,
      'uno',
      {
        active: () => {
          throw new Error('Out-of-scope match queried the active model');
        },
        load: () => {
          throw new Error('Out-of-scope match loaded a model');
        },
      },
    );
    await hostCommand(room, { type: 'set-game-setup', setup });
    for (let i = 0; i < seats; i++)
      await hostCommand(room, {
        type: 'add-bot',
        name: `UNO电脑${i + 1}`,
        difficulty: 'juewu',
      });
    await hostCommand(room, { type: 'start' });
    const task = room.botTask()!;
    expect(task.data.modelRef).toBeUndefined();
    expect(room.botModelData(task.data)).toBeUndefined();
    expect(
      Object.values(repository.value!.snapshot!.bots).every(
        ({ modelRef }) => modelRef === undefined,
      ),
    ).toBe(true);
    const result = await new WorkerBotExecutor(workerPath).execute(
      task,
      new AbortController().signal,
    );
    expect(
      (await room.submitBot(task, result.action, result.memory, result.random))
        .ok,
    ).toBe(true);
  },
);

it('pins the validated local model through the real Worker, rollback, and recovery', async () => {
  const releaseRef = '6'.repeat(64);
  const registry = new GameRegistry([
    {
      catalog: { id: 'uno', name: 'UNO', min: 2, max: 6 },
      load: async () => ({ rules, bot, releaseRef }),
    },
  ]);
  const dataDir = mkdtempSync(join(dirname(workerPath), 'model-test-'));
  const modelDir = join(dataDir, 'learning', 'models');
  mkdirSync(modelDir, { recursive: true });
  const store = new LocalBotModels(dataDir);
  const envelope = {
    version: 1 as const,
    binding: {
      gameId: 'uno',
      releaseRef,
      rulesVersion: bot.rulesVersion,
      strategyId: bot.id,
      strategyVersion: bot.version,
      difficulty: 'juewu' as const,
    },
    // These digests and coefficients are an isolated fixture, not promotion evidence.
    reviews: {
      calibration: 'a'.repeat(64),
      comparison: 'b'.repeat(64),
      runtime: 'c'.repeat(64),
    },
    model: {
      version: 1,
      samples: 8,
      calibrationDigest: '1'.repeat(64),
      calibration: {
        version: 1,
        features: [...unoLeafFeatureNames],
        coefficients: unoLeafFeatureNames.map(() => 0),
      },
    },
  };
  const modelBytes = JSON.stringify(envelope);
  const ref = createHash('sha256').update(modelBytes).digest('hex');
  const modelPath = join(modelDir, ref + '.json');
  expect(store.promote(envelope)).toBe(ref);

  const repository = new MemoryRepository();
  const room = await RoomCoordinator.open(
    registry,
    repository,
    undefined,
    undefined,
    'uno',
    store,
  );
  for (const name of ['电脑甲', '电脑乙', '电脑丙', '电脑丁'])
    await hostCommand(room, { type: 'add-bot', name, difficulty: 'juewu' });
  await hostCommand(room, { type: 'start' });
  const task = room.botTask()!;
  expect(task.data.modelRef).toBe(ref);
  expect(JSON.stringify(room.view(room.hostToken))).not.toContain(ref);
  const signal = new AbortController().signal;

  // A pinned saved choice cannot silently use the unlearned policy.
  await expect(
    new WorkerBotExecutor(workerPath).execute(task, signal),
  ).rejects.toThrow('strategy-failed');
  const worker = new WorkerBotExecutor(
    workerPath,
    undefined,
    undefined,
    (data) => room.botModelData(data),
  );
  const result = await worker.execute(task, signal);
  expect(
    (await room.submitBot(task, result.action, result.memory, result.random))
      .ok,
  ).toBe(true);
  await hostCommand(room, {
    type: 'rollback',
    checkpointId: room.view(room.hostToken).history[0]!.id,
  });
  for (const savedBot of Object.values(repository.value!.snapshot!.bots))
    expect(savedBot.modelRef).toBe(ref);

  // Deactivating the active pointer only affects subsequent matches.
  store.deactivate(ref);
  expect(store.active(envelope.binding)).toBeUndefined();
  const restored = await RoomCoordinator.open(
    registry,
    repository,
    room.hostToken,
    undefined,
    undefined,
    store,
  );
  expect(restored.view().restored).toBe(true);
  expect(
    Object.values(repository.value!.snapshot!.bots).every(
      (saved) => saved.modelRef === ref,
    ),
  ).toBe(true);

  const saved = structuredClone(repository.value);
  writeFileSync(modelPath, '{}');
  const damaged = await RoomCoordinator.open(
    registry,
    repository,
    room.hostToken,
    undefined,
    undefined,
    store,
  );
  expect(damaged.view().botError).toContain('本机人机模型');
  expect(damaged.botTask()).toBeNull();
  expect(repository.value).toEqual(saved);
  await expect(damaged.restoreMissingRelease()).rejects.toThrow(
    'incompatible-bot-model',
  );
  writeFileSync(modelPath, modelBytes);
  expect(await damaged.restoreMissingRelease()).toBe(true);
  expect(damaged.view().botError).toBeNull();
  expect(
    Object.values(repository.value!.snapshot!.bots).every(
      (entry) => entry.modelRef === ref,
    ),
  ).toBe(true);
});

async function verifyWorkerCorrection(
  samples: 8 | 32,
  featureVersion: UnoLeafFeatureVersion = 1,
) {
  const features = unoLeafFeatureNamesFor(featureVersion);
  const calibration = {
    version: featureVersion,
    features: [...features],
    coefficients: features.map((name) =>
      name === 'rival-score-over-hand-size' ? 0.25 : 0,
    ),
  };
  const calibrationDigest = createHash('sha256')
    .update(JSON.stringify(calibration))
    .digest('hex');
  const baseline = {
    version: 1,
    samples,
    calibrationDigest,
    calibration,
  };
  const evidence = await verifyUnoWorker({
    game: { bot, rules, releaseRef: '6'.repeat(64) },
    workerPath,
    botEntry: join(dirname(workerPath), 'bots', 'uno.cjs'),
    scratch: dirname(workerPath),
    calibrationDigest,
    comparisonDigest: 'b'.repeat(64),
    baseline,
    candidate: {
      ...baseline,
      correction: {
        version: 1,
        calibrationDigest,
        features: [...unoCorrectionFeatureNames],
        coefficients: unoCorrectionFeatureNames.map(() => 0),
        weight: 0.5,
        cap: 0.02,
      },
    },
  });
  expect(evidence).toMatchObject({
    result: 'passed',
    keyPositions: 'passed',
    workerOldGenerationMiB: 32,
    restart: 'passed',
    rollback: 'passed',
    persistence: 'passed',
    cancellation: 'passed',
    tamper: 'passed',
    timing: { B: { decisions: 6 }, C: { decisions: 7 } },
  });
}

it.each([8, 32] as const)(
  'measures B and C with up to %s worlds in real Workers and verifies SQLite recovery',
  (samples) => verifyWorkerCorrection(samples),
  15000,
);

it(
  'keeps version 2 calibration bound across real Workers and SQLite recovery',
  () => verifyWorkerCorrection(32, 2),
  15000,
);
