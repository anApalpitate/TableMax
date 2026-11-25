import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JsonValue } from '../../../packages/game-sdk/src/index';
import type { Command } from '../../../packages/protocol/src/index';
import {
  GameRegistry,
  RoomCoordinator,
  type Save,
} from '../../../packages/platform-core/src/index';
import { LocalBotModels } from '../../../apps/server/src/local-bot-models';
import { SqliteSaveRepository } from '../../../apps/server/src/save-repository';
import {
  WorkerBotExecutor,
  workerOldGenerationMiB,
  type WorkerDiagnostic,
} from '../../../apps/server/src/bot-executor';
import { botModelBinding } from '../../../packages/platform-core/src/bot-model';
import type { LoadedGame } from '../../../packages/platform-core/src/game-registry';
import { unoPilotMatch } from '../../../games/uno/config';
import type { Memory } from '../../../games/uno/bot/index';
import type { Action, UnoView } from '../../../games/uno/types';
import { fixture } from '../../../games/uno/rules/test-fixtures';

const decisionDeadline = 2_000;

const scenarios = [
  'near-500',
  'next-seat-one-card',
  'reverse',
  'forced-finish',
  'opening-wild',
  'known-final-color',
] as const;
type Position = (typeof scenarios)[number];
type Task = NonNullable<ReturnType<RoomCoordinator['botTask']>>;

function position(name: Position, seats: readonly string[]) {
  const [a, b, c, d] = seats as readonly [string, string, string, string];
  const nameIsEnd = name === 'forced-finish';
  const wild = name === 'opening-wild';
  const state = fixture(
    {
      [a]: nameIsEnd ? ['red-1-a'] : ['red-1-a', 'red-reverse-a', 'wild-2'],
      [b]: ['green-4-a'],
      [c]: ['yellow-2-a', 'yellow-3-a'],
      [d]: ['blue-8-a', 'blue-9-a'],
    },
    wild ? 'wild-1' : 'red-5-a',
    a,
  );
  state.setup = { ...unoPilotMatch.setup };
  state.drawPenalty = null;
  state.unoDeclared[b] = true;
  if (wild) {
    state.stage = 'choose-color';
  } else if (name === 'near-500' || nameIsEnd) {
    const winner = nameIsEnd ? a : b;
    state.roundNumber = 2;
    state.scores[winner] = 495;
    state.wins[winner] = 1;
    const handValues = { [a]: 0, [b]: 0, [c]: 245, [d]: 250 };
    state.results.push({
      roundNumber: 1,
      winner,
      points: 495,
      handValues,
      scores: { ...state.scores },
    });
  } else if (name === 'reverse') {
    state.direction = -1;
  }
  return state;
}

async function host(room: RoomCoordinator, command: Command['command']) {
  const { instanceId, revision, branch } = room.view(room.hostToken);
  const reply = await room.command(room.hostToken, {
    actionId: randomUUID(),
    instanceId,
    revision,
    branch,
    command,
  });
  assert.ok(reply.ok, JSON.stringify(reply));
}

function p95(samples: readonly number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!;
}

export async function verifyUnoWorker(input: {
  game: LoadedGame;
  workerPath: string;
  botEntry: string;
  scratch: string;
  baseline: JsonValue;
  candidate: JsonValue;
  calibrationDigest: string;
  comparisonDigest: string;
}) {
  const binding = botModelBinding(input.game, 'juewu');
  assert.ok(binding && input.game.bot.model);
  const root = mkdtempSync(join(input.scratch, 'worker-verification-'));
  const models = new LocalBotModels(root);
  const store = (model: JsonValue) =>
    models.promote({
      version: 1,
      binding,
      reviews: {
        calibration: input.calibrationDigest,
        comparison: input.comparisonDigest,
        // This isolated reference is internal to the verifier and is never registered on the user's profile.
        runtime: '0'.repeat(64),
      },
      model: input.game.bot.model!.validate(model),
    });
  const bRef = store(input.baseline);
  const cRef = store(input.candidate);
  assert.notEqual(bRef, cRef);
  const timings = { B: [] as number[], C: [] as number[] };
  const startups = { B: [] as number[], C: [] as number[] };
  const computations = { B: [] as number[], C: [] as number[] };
  const rssBefore = process.memoryUsage.rss();
  let sampledPeakRss = rssBefore;
  const sampleMemory = () => {
    sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage.rss());
  };
  const positions = [];
  let recovery:
    | {
        restart: 'passed';
        rollback: 'passed';
        persistence: 'passed';
        cancellation: 'passed';
        tamper: 'passed';
      }
    | undefined;
  for (const name of scenarios) {
    const activeRules = input.game.rules;
    const game = {
      ...input.game,
      rules: {
        ...activeRules,
        initialize({ seats }: { seats: readonly string[] }) {
          return position(name, seats) as unknown as JsonValue;
        },
      },
    };
    const registry = new GameRegistry([
      {
        catalog: { id: 'uno', name: 'UNO', min: 2, max: 6 },
        load: async () => game,
      },
    ]);
    const directory = join(root, name);
    mkdirSync(directory);
    const repository = new SqliteSaveRepository(directory);
    let activeRepo = repository;
    try {
      let rejectWrite = false;
      const writable = {
        load: () => activeRepo.load(),
        save(...args: Parameters<SqliteSaveRepository['save']>) {
          if (rejectWrite) throw new Error('injected-save-failure');
          activeRepo.save(...args);
        },
      };
      let room = await RoomCoordinator.open(
        registry,
        writable,
        undefined,
        'test',
        'uno',
        models,
      );
      for (const seat of ['一', '二', '三', '四'])
        await host(room, {
          type: 'add-bot',
          name: `电脑${seat}`,
          difficulty: 'juewu',
        });
      await host(room, { type: 'start' });

      // Freeze the synthetic root, including the acting seat's authorized memory and RNG.
      const setup = activeRepo.load() as Save;
      const actor = setup.seats[0]!.id;
      const rival = setup.seats[1]!.id;
      const memory: Memory = {
        version: 1,
        roundNumber: name === 'near-500' || name === 'forced-finish' ? 2 : 1,
        serial: 0,
        knownCards:
          name === 'known-final-color' ? { [rival]: ['green-4-a'] } : {},
        colorHints: {},
      };
      Object.assign(setup.snapshot!.bots[actor]!, { random: 31, memory });
      setup.revision++;
      activeRepo.save(setup);
      room = await RoomCoordinator.open(
        registry,
        writable,
        room.hostToken,
        'test',
        'uno',
        models,
      );
      await host(room, { type: 'resume' });
      const task = room.botTask();
      assert.ok(task);
      assert.equal(task.data.modelRef, cRef);
      assert.equal(task.decision.seatId, actor);
      assert.deepEqual(task.data.memory, memory);
      const view = task.view as UnoView;
      assert.equal(view.self?.seatId, actor);
      assert.equal(view.players[rival]!.handCount, 1);
      assert.ok(!Object.hasOwn(view, 'deck') && !Object.hasOwn(view, 'hands'));
      assert.equal((room.view(room.hostToken).gameView as UnoView).self, null);
      if (name === 'near-500') assert.equal(view.players[rival]!.score, 495);
      if (name === 'reverse') assert.equal(view.direction, -1);
      if (name === 'known-final-color')
        assert.deepEqual(memory.knownCards[rival], ['green-4-a']);

      function executor(diagnostic?: (event: WorkerDiagnostic) => void) {
        return new WorkerBotExecutor(
          input.workerPath,
          () => input.botEntry,
          diagnostic,
          (data) => room.botModelData(data),
        );
      }
      async function run(arm: 'B' | 'C', task: Task) {
        const worker = executor((event) => {
          sampleMemory();
          if (event.phase === 'startup') startups[arm].push(event.durationMs);
          if (event.phase === 'onlineToResult' && event.outcome === 'success')
            computations[arm].push(event.durationMs);
        });
        const start = performance.now();
        const result = await worker.execute(
          task,
          AbortSignal.timeout(decisionDeadline),
        );
        const elapsed = performance.now() - start;
        timings[arm].push(elapsed);
        assert.ok(
          elapsed < decisionDeadline,
          'UNO Worker exceeded its wall budget',
        );
        assert.ok(
          task.actions.some(
            (choice) =>
              JSON.stringify(choice) === JSON.stringify(result.action),
          ),
          'Worker selected an unauthorized action',
        );
        return result;
      }
      const bTask = { ...task, data: { ...task.data, modelRef: bRef } };
      const b = await run('B', bTask);
      const c = await run('C', task);
      const fixed = name === 'forced-finish' || name === 'opening-wild';
      if (fixed) {
        assert.deepEqual(
          c,
          b,
          'A non-learned node changed under the correction',
        );
      } else {
        const plays = (task.actions as Action[]).filter(
          (action) => action.type === 'play',
        );
        assert.ok(
          plays.length >= 2 &&
            plays.some((action) => action.cardId === 'red-reverse-a'),
        );
        assert.equal((c.action as Action).type, 'play');
      }

      const submit = (result: typeof c, usedTask = task) =>
        room.submitBot(usedTask, result.action, result.memory, result.random);
      const before = activeRepo.load() as Save;
      if (name === 'known-final-color') {
        const worker = executor();
        const controller = new AbortController();
        const pending = worker.execute(task, controller.signal);
        controller.abort();
        await assert.rejects(pending, /cancelled/);
        await assert.rejects(
          new WorkerBotExecutor(input.workerPath, () => input.botEntry).execute(
            task,
            AbortSignal.timeout(decisionDeadline),
          ),
          /strategy-failed/,
        );
        rejectWrite = true;
        try {
          const failed = await submit(c);
          assert.deepEqual(failed, {
            ok: false,
            reason: 'save-or-action-failed',
          });
          assert.deepEqual(activeRepo.load(), before);
        } finally {
          rejectWrite = false;
        }
      }
      assert.ok((await submit(c)).ok);
      const saved = activeRepo.load() as Save;
      assert.equal(saved.history.length, before.history.length + 1);
      assert.equal(saved.snapshot!.bots[actor]!.modelRef, cRef);
      assert.equal(saved.snapshot!.bots[actor]!.random, c.random);
      const after = game.rules.project(saved.snapshot!.state, {
        role: 'player',
        seatId: actor,
      });
      const observedMemory =
        game.bot.observe?.({
          view: after,
          memory: c.memory,
          seatId: actor,
          difficulty: 'juewu',
        }) ?? c.memory;
      assert.deepEqual(saved.snapshot!.bots[actor]!.memory, observedMemory);
      if (name === 'forced-finish') {
        assert.deepEqual((saved.snapshot!.state as UnoView).winners, [actor]);
      }
      positions.push({
        name,
        candidates: task.actions.length,
        corrected: JSON.stringify(b.action) !== JSON.stringify(c.action),
      });
      if (name !== 'known-final-color') continue;

      await host(room, {
        type: 'rollback',
        checkpointId: saved.history.at(-1)!.id,
      });
      const rolledBack = activeRepo.load() as Save;
      assert.deepEqual(rolledBack.snapshot, before.snapshot);
      assert.equal(
        (await submit(c)).ok,
        false,
        'A pre-rollback result was accepted',
      );
      assert.deepEqual(activeRepo.load(), rolledBack);
      models.deactivate(cRef);
      assert.equal(models.active(binding), undefined);
      activeRepo = new SqliteSaveRepository(directory);
      repository.close();
      const reopened = await RoomCoordinator.open(
        registry,
        writable,
        room.hostToken,
        'test',
        'uno',
        models,
      );
      assert.equal(reopened.view().restored, true);
      assert.equal(reopened.view().paused, true);
      assert.equal(reopened.view().botError, null);
      assert.deepEqual((activeRepo.load() as Save).snapshot, before.snapshot);
      const beforeDamage = activeRepo.load();
      const path = join(root, 'learning', 'models', cRef + '.json');
      const originalBytes = readFileSync(path);
      writeFileSync(path, '{}');
      let damaged;
      try {
        damaged = await RoomCoordinator.open(
          registry,
          writable,
          room.hostToken,
          'test',
          'uno',
          models,
        );
        assert.ok(damaged.view().botError);
        assert.equal(damaged.botTask(), null);
        assert.deepEqual(activeRepo.load(), beforeDamage);
      } finally {
        writeFileSync(path, originalBytes);
      }
      assert.equal(await damaged.restoreMissingRelease(), true);
      room = damaged;
      assert.equal(room.view().restored, true);
      await host(room, { type: 'resume' });
      const restored = room.botTask();
      assert.ok(restored);
      assert.deepEqual(restored.data, task.data);
      const repeated = await run('C', restored);
      assert.deepEqual(repeated, c);
      assert.ok((await submit(repeated, restored)).ok);
      recovery = {
        restart: 'passed',
        rollback: 'passed',
        persistence: 'passed',
        cancellation: 'passed',
        tamper: 'passed',
      };
    } finally {
      activeRepo.close();
    }
  }
  assert.ok(recovery);
  assert.equal(positions.length, scenarios.length);
  for (const arm of ['B', 'C'] as const) {
    assert.equal(startups[arm].length, timings[arm].length);
    assert.equal(computations[arm].length, timings[arm].length);
  }
  return {
    result: 'passed' as const,
    binding,
    maxDecisionMs: Math.max(...timings.B, ...timings.C),
    decisionDeadlineMs: decisionDeadline,
    workerOldGenerationMiB,
    timing: Object.fromEntries(
      (['B', 'C'] as const).map((arm) => [
        arm,
        {
          decisions: timings[arm].length,
          firstWorkerMs: timings[arm][0],
          decisionP95Ms: p95(timings[arm]),
          startupP95Ms: p95(startups[arm]),
          onlineToResultP95Ms: p95(computations[arm]),
        },
      ]),
    ),
    memory: {
      rssBefore,
      sampledPeakRss,
      processPeakRssKiB: process.resourceUsage().maxRSS,
    },
    modelBytes: {
      B: Buffer.byteLength(JSON.stringify(input.baseline)),
      C: Buffer.byteLength(JSON.stringify(input.candidate)),
    },
    positions,
    keyPositions: 'passed' as const,
    failures: 0,
    ...recovery,
  };
}
