import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
import { DatabaseSync } from 'node:sqlite';
import { io, type Socket } from 'socket.io-client';
import {
  RoomCoordinator,
  RandomSource,
  type Save,
  type SaveRepository,
  type SaveExtras,
} from '@tablemax/platform-core';
import type { Command, RoomView } from '@tablemax/protocol';
import { CommandReplySchema, RoomViewSchema } from '@tablemax/protocol';
import type { JsonValue } from '@tablemax/game-sdk';
import { createGameRegistry } from './game-registry';
import { installedModules } from './module-loader';
import { SqliteSaveRepository } from './save-repository';
import { WorkerBotExecutor } from './bot-executor';
import { createService } from './service';
import { pokemonExpansion } from '../../../games/pokemon-encounters/expansion';
import type {
  Action,
  State,
} from '../../../games/pokemon-encounters/expansion/state';

const run = `run-${Date.now()}-${randomUUID().slice(0, 8)}`;
const evidence = resolve(
  'artifacts/maintenance/v1.0.2/pokemon-expansion-verification/integration',
  run,
);
const temporary = resolve('tmp/pokemon-expansion-verification', run);
const sourceFiles = [
  'apps/server/src/module-loader.ts',
  'apps/server/src/game-registry.ts',
  'apps/server/src/bot-worker.ts',
  'apps/server/src/service.ts',
  'apps/server/src/save-repository.ts',
  'apps/server/src/bot-executor.ts',
  'packages/platform-core/src/room.ts',
  'packages/platform-core/src/game-registry.ts',
  'packages/platform-core/src/save-validation.ts',
  'packages/protocol/src/index.ts',
  'games/pokemon-encounters/game-module.json',
  'games/pokemon-encounters/rules/index.ts',
  'games/pokemon-encounters/bot/index.ts',
  'games/pokemon-encounters/expansion/index.ts',
  'games/pokemon-encounters/expansion/state.ts',
  'games/pokemon-encounters/expansion/project.ts',
  'games/pokemon-encounters/expansion/cards.ts',
  'games/pokemon-encounters/expansion/research.ts',
  'games/pokemon-encounters/expansion/scoring.ts',
  'games/pokemon-encounters/expansion/bot/index.ts',
  'games/pokemon-encounters/expansion/bot/strategy.ts',
  'games/pokemon-encounters/expansion/bot/memory.ts',
];
const hashes = () =>
  Object.fromEntries(
    sourceFiles.map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(resolve(path)))
        .digest('hex'),
    ]),
  );
let beforeHashes: Record<string, string>;
const results: { scenario: string; detail: unknown }[] = [];
beforeAll(async () => {
  mkdirSync(evidence, { recursive: true });
  mkdirSync(temporary, { recursive: true });
  beforeHashes = hashes();
  const options = {
    bundle: true,
    platform: 'node' as const,
    format: 'cjs' as const,
    target: 'node22',
    logLevel: 'silent' as const,
  };
  await build({
    ...options,
    entryPoints: ['apps/server/src/bot-worker.ts'],
    outfile: join(temporary, 'bot-worker.cjs'),
  });
  const item = installedModules().find(
    (module) => module.id === 'pokemon-encounters',
  )!;
  mkdirSync(join(temporary, 'games'), { recursive: true });
  mkdirSync(join(temporary, 'bots'), { recursive: true });
  await build({
    ...options,
    entryPoints: [item.entries.rules],
    outfile: join(temporary, 'games/pokemon-encounters.cjs'),
  });
  await build({
    ...options,
    entryPoints: [item.entries.bot],
    outfile: join(temporary, 'bots/pokemon-encounters.cjs'),
  });
  writeFileSync(
    join(temporary, 'modules.json'),
    JSON.stringify([
      {
        ...item,
        entries: {
          rules: 'games/pokemon-encounters.cjs',
          bot: 'bots/pokemon-encounters.cjs',
          web: '/games/pokemon-encounters/web/entry.js',
        },
      },
    ]),
  );
  expect(hashes()).toEqual(beforeHashes);
}, 30000);
afterAll(() => {
  const after = hashes();
  writeFileSync(
    join(evidence, 'results.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceHashesBefore: beforeHashes,
        sourceHashesAfter: after,
        sourceStable: JSON.stringify(beforeHashes) === JSON.stringify(after),
        temporary,
        results,
        scope:
          'Actual registry, RoomCoordinator, SQLite, localhost HTTP/Socket.IO and compiled isolated Worker. Fixture decisions and simulated humans; no GUI, physical devices or portable ZIP verification.',
      },
      null,
      2,
    ) + '\n',
  );
  expect(after).toEqual(beforeHashes);
});

class Repository implements SaveRepository {
  readonly sqlite: SqliteSaveRepository;
  fail = false;
  constructor(name: string) {
    const directory = join(evidence, name);
    mkdirSync(directory, { recursive: true });
    this.sqlite = new SqliteSaveRepository(directory);
  }
  load() {
    return this.sqlite.load();
  }
  save(value: Save, extras?: SaveExtras) {
    if (this.fail) throw new Error('Injected storage failure');
    this.sqlite.save(value, extras);
  }
  getAvatar(id: string) {
    return this.sqlite.getAvatar(id);
  }
  close() {
    this.sqlite.close();
  }
}
function envelope(view: RoomView, command: Command['command']): Command {
  return {
    actionId: randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  };
}
async function send(
  room: RoomCoordinator,
  command: Command['command'],
  credential = room.hostToken,
) {
  return room.command(credential, envelope(room.view(credential), command));
}
async function ok(
  room: RoomCoordinator,
  command: Command['command'],
  credential = room.hostToken,
) {
  expect(await send(room, command, credential)).toMatchObject({ ok: true });
}
const saved = (repository: Repository) => repository.load() as Save;
async function table(repository: Repository, count = 2, bots = 0) {
  const room = await RoomCoordinator.open(createGameRegistry(), repository);
  await ok(room, { type: 'select-game', gameId: 'pokemon-encounters' });
  await ok(room, { type: 'select-variant', variantId: 'expansion' });
  const credentials: Record<string, string> = {};
  for (let i = 0; i < count - bots; i++) {
    const joined = await room.join(`真人${i}`),
      seat = room.view(joined.token).self.seatId!;
    credentials[seat] = joined.token;
    await ok(room, { type: 'ready', ready: true }, joined.token);
  }
  for (let i = 0; i < bots; i++)
    await ok(room, {
      type: 'add-bot',
      name: `人机${i}`,
      difficulty: (['default', 'doubao', 'juewu'] as const)[i % 3]!,
    });
  await ok(room, { type: 'start' });
  return { room, credentials };
}
async function play(
  room: RoomCoordinator,
  repository: Repository,
  credentials: Record<string, string>,
  action?: Action,
) {
  const state = saved(repository).snapshot!.state as State,
    decision = pokemonExpansion.decisions(state)[0]!;
  const chosen =
    action ?? pokemonExpansion.legalActions(state, decision.seatId)[0]!;
  await ok(
    room,
    { type: 'game', decisionId: decision.id, action: chosen },
    credentials[decision.seatId]!,
  );
}
async function toDraw(
  room: RoomCoordinator,
  repository: Repository,
  credentials: Record<string, string>,
) {
  while (
    ['research-vote', 'initial-flip'].includes(
      (saved(repository).snapshot!.state as State).phase,
    )
  )
    await play(room, repository, credentials);
}
function moveToTop(state: State, instance: string) {
  const replacement = state.deck.at(-1)!;
  const index = state.deck.indexOf(instance);
  if (index >= 0) state.deck[index] = replacement;
  else {
    const discarded = state.discard.indexOf(instance);
    if (discarded >= 0) state.discard[discarded] = replacement;
    else {
      const slot = Object.values(state.boards)
        .flat()
        .find((c) => c.instanceId === instance);
      if (!slot) throw new Error('Missing fixture card');
      slot.instanceId = replacement;
    }
  }
  state.deck[state.deck.length - 1] = instance;
}
function ordinaryHumanAction(
  state: State,
  legal: readonly JsonValue[],
): Action {
  const actions = legal as readonly Action[];
  if (state.phase === 'draw' || state.phase === 'lucario-draw')
    return (
      actions.find((a) => a.type === 'draw' && a.source === 'deck') ??
      actions[0]!
    );
  return (
    actions.find(
      (a) =>
        a.type === 'replace' && !state.boards[state.turnSeat]![a.slot]!.faceUp,
    ) ??
    actions.find((a) => a.type === 'decline-ability') ??
    actions[0]!
  );
}

describe('actual installed expansion and authoritative persistence', () => {
  it('serves protocol 7 expansion selection and private votes through real localhost HTTP and Socket.IO', async () => {
    const dataDir = join(evidence, 'socket-service'),
      webDir = join(temporary, 'web');
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(webDir, { recursive: true });
    writeFileSync(
      join(webDir, 'index.html'),
      '<html>Expansion service fixture</html>',
    );
    const service = await createService({
      host: '127.0.0.1',
      port: 0,
      dataDir,
      webDir,
      playMode: 'test',
      botWorkerPath: join(temporary, 'bot-worker.cjs'),
    });
    const sockets: Socket[] = [],
      views = new Map<Socket, RoomView>();
    try {
      const port = await service.listen(),
        origin = `http://127.0.0.1:${port}`;
      const health = (await fetch(`${origin}/api/foundation/health`).then(
        (response) => response.json(),
      )) as { protocolVersion: number };
      expect(health.protocolVersion).toBe(7);
      const connect = async (credential?: string) => {
        const socket = io(origin, {
          auth: credential ? { token: credential } : {},
          transports: ['websocket'],
          forceNew: true,
        });
        sockets.push(socket);
        await new Promise<void>((resolve, reject) => {
          socket.on('room:view', (value) => {
            views.set(socket, RoomViewSchema.parse(value));
            resolve();
          });
          socket.once('connect_error', reject);
        });
        return socket;
      };
      const transmit = (socket: Socket, command: Command['command']) =>
        new Promise<void>((resolve, reject) => {
          socket
            .timeout(3000)
            .emit(
              'room:command',
              envelope(views.get(socket)!, command),
              (error: Error | null, reply: unknown) => {
                if (error) reject(error);
                else {
                  expect(CommandReplySchema.parse(reply)).toMatchObject({
                    ok: true,
                  });
                  resolve();
                }
              },
            );
        });
      const host = await connect(service.hostToken),
        publicSocket = await connect();
      await transmit(host, {
        type: 'select-game',
        gameId: 'pokemon-encounters',
      });
      await transmit(host, { type: 'select-variant', variantId: 'expansion' });
      const tokens: string[] = [];
      for (let i = 0; i < 2; i++) {
        const reply = (await fetch(`${origin}/api/session/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `手机${i}` }),
        }).then((response) => response.json())) as { token: string };
        tokens.push(reply.token);
      }
      const phones = await Promise.all(tokens.map((token) => connect(token)));
      for (const phone of phones)
        await transmit(phone, { type: 'ready', ready: true });
      await transmit(host, { type: 'start' });
      await vi.waitFor(() =>
        expect(views.get(phones[0]!)?.decisionId).not.toBeNull(),
      );
      const choice = views.get(phones[0]!)!.actions[0]! as Action;
      await transmit(phones[0]!, {
        type: 'game',
        decisionId: views.get(phones[0]!)!.decisionId!,
        action: choice,
      });
      await vi.waitFor(() =>
        expect(
          (
            views.get(publicSocket)!.gameView as ReturnType<
              typeof pokemonExpansion.project
            >
          ).votedSeats,
        ).toHaveLength(1),
      );
      const publicGame = views.get(publicSocket)!.gameView as ReturnType<
        typeof pokemonExpansion.project
      >;
      expect(publicGame.ownVote).toBeNull();
      expect(publicGame.voteCounts).toBeNull();
      expect(views.get(publicSocket)!.actions).toEqual([]);
      expect(
        (views.get(phones[1]!)!.gameView as typeof publicGame).ownVote,
      ).toBeNull();
      await transmit(phones[1]!, {
        type: 'game',
        decisionId: views.get(phones[1]!)!.decisionId!,
        action: views.get(phones[1]!)!.actions[1]! as Action,
      });
      await vi.waitFor(() =>
        expect(
          (views.get(publicSocket)!.gameView as typeof publicGame).phase,
        ).toBe('initial-flip'),
      );
      expect(views.get(publicSocket)!.game?.variantId).toBe('expansion');
      expect(
        (views.get(publicSocket)!.gameView as typeof publicGame).activeResearch,
      ).toHaveLength(1);
      results.push({
        scenario: 'real localhost HTTP and Socket.IO',
        detail: {
          host: '127.0.0.1',
          protocol: health.protocolVersion,
          roles: ['host', 'public', 'player', 'player'],
          votePrivacy: 'checked',
        },
      });
    } finally {
      for (const socket of sockets) socket.close();
      await service.close();
    }
  }, 15000);

  it('loads original defaults and expansion identities without loading another game', async () => {
    const registry = createGameRegistry(),
      original = await registry.load('pokemon-encounters'),
      expansion = await registry.load('pokemon-encounters', 'expansion');
    expect(original.variantId).toBe('original');
    expect(original.rules.manifest.rulesVersion).toBe('tablemax-cn-s19-v1');
    expect(expansion.variantId).toBe('expansion');
    expect(expansion.rules.manifest.rulesVersion).toBe(
      'tablemax-cn-expansion-v1',
    );
    expect(expansion.bot.id).toBe('pokemon-encounters/expansion');
    await expect(
      registry.load('pokemon-encounters', 'invented'),
    ).rejects.toThrow('unknown-game-variant');
    expect(registry.catalog().map((item) => item.id)).toEqual([
      'pokemon-encounters',
      'modern-art',
      'power-grid',
    ]);
    results.push({
      scenario: 'registry',
      detail: { default: original.variantId, expansion: expansion.variantId },
    });
  });

  it('keeps seats and owner while switching, rejects player/public/in-play switches and storage failure', async () => {
    const repository = new Repository('switch');
    try {
      const room = await RoomCoordinator.open(createGameRegistry(), repository);
      await ok(room, { type: 'select-game', gameId: 'pokemon-encounters' });
      const a = await room.join('房主'),
        b = await room.join('朋友');
      const owner = room.view(a.token).self.seatId!;
      await ok(room, { type: 'set-owner', seatId: owner });
      await ok(room, { type: 'ready', ready: true }, a.token);
      const command = {
        type: 'select-variant',
        variantId: 'expansion',
      } as const;
      expect(await send(room, command, a.token)).toMatchObject({
        ok: false,
        reason: 'unauthorized',
      });
      expect(
        await room.command(undefined, envelope(room.view(), command)),
      ).toMatchObject({ ok: false, reason: 'unauthorized' });
      const before = room.view(a.token),
        disk = repository.load();
      repository.fail = true;
      expect(await send(room, command)).toMatchObject({ ok: false });
      expect(room.view(a.token)).toEqual(before);
      expect(repository.load()).toEqual(disk);
      repository.fail = false;
      await ok(room, command);
      const after = RoomViewSchema.parse(room.view(a.token));
      expect(after.self.seatId).toBe(owner);
      expect(after.ownerSeatId).toBe(owner);
      expect(after.seats.map((seat) => seat.id)).toEqual(
        before.seats.map((seat) => seat.id),
      );
      expect(after.seats.every((seat) => !seat.ready)).toBe(true);
      expect(after.instanceId).not.toBe(before.instanceId);
      await ok(room, { type: 'ready', ready: true }, a.token);
      await ok(room, { type: 'ready', ready: true }, b.token);
      await ok(room, { type: 'start' }, a.token);
      expect(
        await send(room, { type: 'select-variant', variantId: 'original' }),
      ).toMatchObject({ ok: false, reason: 'end-first' });
      await ok(room, { type: 'end' });
      await ok(room, { type: 'replay' }, a.token);
      expect(room.view().game?.variantId).toBe('expansion');
      const restored = await RoomCoordinator.open(
        createGameRegistry(),
        repository,
        room.hostToken,
      );
      expect(restored.view(a.token).self.seatId).toBe(owner);
      expect(restored.view().game?.variantId).toBe('expansion');
      results.push({
        scenario: 'switch permissions and transaction',
        detail: 'passed',
      });
    } finally {
      repository.close();
    }
  });

  it('normalizes only the exact legacy original fingerprint and rejects ambiguous expansion saves without replacing them', async () => {
    const repository = new Repository('legacy');
    try {
      const room = await RoomCoordinator.open(createGameRegistry(), repository);
      await ok(room, { type: 'select-game', gameId: 'pokemon-encounters' });
      const original = saved(repository);
      delete original.variantId;
      original.revision++;
      repository.save(original);
      const legacy = await RoomCoordinator.open(
        createGameRegistry(),
        repository,
        room.hostToken,
      );
      expect(legacy.view().game?.variantId).toBe('original');
      expect(saved(repository).variantId).toBe('original');
      await ok(legacy, { type: 'select-variant', variantId: 'expansion' });
      const ambiguous = saved(repository);
      delete ambiguous.variantId;
      ambiguous.revision++;
      repository.save(ambiguous);
      await expect(
        RoomCoordinator.open(createGameRegistry(), repository, room.hostToken),
      ).rejects.toThrow();
      expect(saved(repository)).toEqual(ambiguous);
      results.push({
        scenario: 'legacy original and ambiguous missing variant',
        detail: 'passed',
      });
    } finally {
      repository.close();
    }
  });

  it('continues a legacy original six-slot game, checkpoint history and original Worker after two SQLite reopens', async () => {
    const repository = new Repository('legacy-playing');
    try {
      let room = await RoomCoordinator.open(createGameRegistry(), repository);
      await ok(room, { type: 'select-game', gameId: 'pokemon-encounters' });
      await ok(room, { type: 'add-bot', name: '旧原版默认' });
      await ok(room, {
        type: 'add-bot',
        name: '旧原版绝悟',
        difficulty: 'juewu',
      });
      await ok(room, { type: 'start' });
      const executor = new WorkerBotExecutor(join(temporary, 'bot-worker.cjs'));
      for (let n = 0; n < 3; n++) {
        const task = room.botTask()!,
          result = await executor.execute(task, new AbortController().signal);
        expect(
          await room.submitBot(
            task,
            result.action,
            result.memory,
            result.random,
          ),
        ).toMatchObject({ ok: true });
      }
      const legacy = saved(repository);
      delete legacy.variantId;
      legacy.revision++;
      repository.save(legacy);
      const gameState = structuredClone(legacy.snapshot!.state),
        history = structuredClone(legacy.history);
      room = await RoomCoordinator.open(
        createGameRegistry(),
        repository,
        room.hostToken,
      );
      expect(room.view().game?.variantId).toBe('original');
      expect(saved(repository).snapshot!.state).toEqual(gameState);
      expect(saved(repository).history).toEqual(history);
      expect(
        Object.values(
          (room.view().gameView as { boards: Record<string, unknown[]> })
            .boards,
        ).every((board) => board.length === 6),
      ).toBe(true);
      await ok(room, { type: 'resume' });
      const task = room.botTask()!,
        result = await executor.execute(task, new AbortController().signal);
      expect(task.variantId).toBe('original');
      expect(task.rulesVersion).toBe('tablemax-cn-s19-v1');
      expect(
        await room.submitBot(task, result.action, result.memory, result.random),
      ).toMatchObject({ ok: true });
      const continued = saved(repository);
      room = await RoomCoordinator.open(
        createGameRegistry(),
        repository,
        room.hostToken,
      );
      expect(saved(repository).snapshot!.state).toEqual(
        continued.snapshot!.state,
      );
      expect(saved(repository).history).toEqual(continued.history);
      expect(room.view().paused).toBe(true);
      results.push({
        scenario: 'legacy original active save and original Worker',
        detail: {
          checkpoints: continued.history.length,
          originalRulesVersion: task.rulesVersion,
        },
      });
    } finally {
      repository.close();
    }
  }, 15000);

  it('accepts six concurrent locked votes from one revision and reveals only completion before final save', async () => {
    const repository = new Repository('concurrent-vote');
    try {
      const { room, credentials } = await table(repository, 6);
      const initial = room.view(),
        state = saved(repository).snapshot!.state as State;
      const entries = Object.entries(credentials),
        first = entries[0]!;
      const firstView = room.view(first[1]),
        firstEnvelope = envelope(firstView, {
          type: 'game',
          decisionId: firstView.decisionId!,
          action: {
            type: 'vote-research',
            taskId: state.researchCandidates[0]!,
          },
        });
      await expect(
        room.command(first[1], firstEnvelope),
      ).resolves.toMatchObject({ ok: true });
      const publicView = room.view().gameView as ReturnType<
        typeof pokemonExpansion.project
      >;
      expect(publicView.votedSeats).toEqual([first[0]]);
      expect(publicView.voteCounts).toBeNull();
      expect(publicView.ownVote).toBeNull();
      expect(
        (room.view(entries[1]![1]).gameView as typeof publicView).ownVote,
      ).toBeNull();
      await expect(
        room.command(first[1], firstEnvelope),
      ).resolves.toMatchObject({ ok: true });
      const replies = await Promise.all(
        entries.slice(1).map(([seat, credential], index) => {
          const view = { ...room.view(credential), revision: initial.revision };
          return room.command(
            credential,
            envelope(view, {
              type: 'game',
              decisionId: `r1-research-vote-${seat}`,
              action: {
                type: 'vote-research',
                taskId: state.researchCandidates[(index + 1) % 3]!,
              },
            }),
          );
        }),
      );
      expect(replies.every((reply) => reply.ok)).toBe(true);
      const after = saved(repository).snapshot!.state as State;
      expect(after.phase).toBe('initial-flip');
      expect(Object.keys(after.votesBySeat)).toHaveLength(6);
      expect(
        Object.values(after.voteCounts!).reduce((sum, n) => sum + n, 0),
      ).toBe(6);
      expect(after.activeResearch).toHaveLength(1);
      expect(after.boards[entries[0]![0]]).toHaveLength(9);
      const storedRandom = saved(repository).snapshot!.random;
      const restored = await RoomCoordinator.open(
        createGameRegistry(),
        repository,
        room.hostToken,
      );
      expect(restored.view().paused).toBe(true);
      expect(saved(repository).snapshot!.random).toBe(storedRandom);
      expect(saved(repository).snapshot!.state).toEqual(after);
      results.push({
        scenario: 'six concurrent locked votes',
        detail: { votes: 6, phase: after.phase },
      });
    } finally {
      repository.close();
    }
  });

  it('does not draw or reveal on a failed final vote; restart and retry advance exactly once', async () => {
    const repository = new Repository('failed-vote');
    try {
      const { room, credentials } = await table(repository);
      await play(room, repository, credentials);
      const before = saved(repository),
        seat = pokemonExpansion.decisions(before.snapshot!.state as State)[0]!
          .seatId;
      const view = room.view(credentials[seat]!),
        command = {
          type: 'game',
          decisionId: view.decisionId!,
          action: view.actions[1]! as JsonValue,
        } as const;
      const audit = new DatabaseSync(
        join(evidence, 'failed-vote', 'room.sqlite'),
      );
      const journalCount = audit
        .prepare('SELECT COUNT(*) AS total FROM journal')
        .get()!.total;
      // Fail after the journal INSERT, exercising SQLite ROLLBACK rather than a pre-save stub.
      audit.exec(
        "CREATE TRIGGER fail_latest_save BEFORE UPDATE ON saves BEGIN SELECT RAISE(ABORT, 'Injected save replacement failure'); END;",
      );
      try {
        expect(
          await room.command(credentials[seat]!, envelope(view, command)),
        ).toMatchObject({ ok: false });
        expect(
          audit.prepare('SELECT COUNT(*) AS total FROM journal').get()!.total,
        ).toBe(journalCount);
      } finally {
        audit.exec('DROP TRIGGER fail_latest_save;');
        audit.close();
      }
      expect(repository.load()).toEqual(before);
      expect(room.view(credentials[seat]!)).toEqual(view);
      const restored = await RoomCoordinator.open(
        createGameRegistry(),
        repository,
        room.hostToken,
      );
      await ok(restored, { type: 'resume' });
      await ok(
        restored,
        {
          type: 'game',
          decisionId: restored.view(credentials[seat]!).decisionId!,
          action: view.actions[1]! as JsonValue,
        },
        credentials[seat]!,
      );
      const after = saved(repository).snapshot!.state as State;
      expect(after.phase).toBe('initial-flip');
      expect(after.activeResearch).toHaveLength(1);
      const checkpoint = restored.view(restored.hostToken).history.at(-1)!;
      await ok(restored, { type: 'rollback', checkpointId: checkpoint.id });
      expect((saved(repository).snapshot!.state as State).phase).toBe(
        'research-vote',
      );
      expect(saved(repository).snapshot!.random).toBe(before.snapshot!.random);
      results.push({
        scenario: 'failed final vote restart and rollback',
        detail: 'passed',
      });
    } finally {
      repository.close();
    }
  });
});

const boundaries = [
  ['special-charizard', 'charizard-view'],
  ['special-mewtwo', 'mewtwo-choice'],
  ['special-mew', 'mew-self'],
  ['special-zapdos', 'zapdos-receive'],
  ['special-team-rocket', 'rocket'],
  ['special-arceus', 'arceus-choice'],
  ['special-lucario', 'lucario-draw'],
  ['special-groudon', 'row-choice'],
] as const;
it.each(boundaries)(
  'SQLite restart at %s / %s preserves authority, private projections and replayed randomness',
  async (category, boundary) => {
    const repository = new Repository(`boundary-${category}`);
    try {
      const prepared = await table(repository);
      let room = prepared.room;
      await toDraw(room, repository, prepared.credentials);
      const fixture = saved(repository),
        state = fixture.snapshot!.state as State;
      moveToTop(state, `${category}#01`);
      pokemonExpansion.validateState(state, state.seatOrder);
      fixture.revision++;
      repository.save(fixture);
      room = await RoomCoordinator.open(
        createGameRegistry(),
        repository,
        room.hostToken,
      );
      await ok(room, { type: 'resume' });
      await play(room, repository, prepared.credentials, {
        type: 'draw',
        source: 'deck',
      });
      for (let n = 0; n < 5; n++) {
        const current = saved(repository).snapshot!.state as State;
        if (
          current.phase === boundary ||
          (boundary === 'rocket' && current.phase.startsWith('rocket-'))
        )
          break;
        const legal = pokemonExpansion.legalActions(
          current,
          pokemonExpansion.decisions(current)[0]!.seatId,
        );
        const action =
          legal.find((a) => a.type === 'peek') ??
          legal.find((a) => a.type === 'extra-draw') ??
          legal.find((a) => a.type === 'replace' && a.slot === 1) ??
          legal[0]!;
        await play(room, repository, prepared.credentials, action);
      }
      const before = saved(repository),
        checkpointState = before.snapshot!.state as State;
      expect(
        checkpointState.phase === boundary ||
          (boundary === 'rocket' &&
            checkpointState.phase.startsWith('rocket-')),
      ).toBe(true);
      const actor = pokemonExpansion.decisions(checkpointState)[0]!.seatId;
      const publicView = room.view().gameView as ReturnType<
        typeof pokemonExpansion.project
      >;
      expect(publicView.peek).toBeNull();
      if (['charizard-view', 'mewtwo-choice'].includes(checkpointState.phase)) {
        expect(
          (
            room.view(prepared.credentials[actor]!)
              .gameView as typeof publicView
          ).peek,
        ).not.toBeNull();
        for (const [seat, credential] of Object.entries(prepared.credentials))
          if (seat !== actor)
            expect(
              (room.view(credential).gameView as typeof publicView).peek,
            ).toBeNull();
      }
      const action =
        checkpointState.phase === 'arceus-choice'
          ? ({ type: 'activate-arceus' } as const)
          : pokemonExpansion.legalActions(checkpointState, actor)[0]!;
      const random = new RandomSource(before.snapshot!.random);
      const expected = pokemonExpansion.apply(checkpointState, action, actor, {
        seats: checkpointState.seatOrder,
        random,
      }).state;
      repository.close();
      const reopened = new Repository(`boundary-${category}`);
      try {
        room = await RoomCoordinator.open(
          createGameRegistry(),
          reopened,
          room.hostToken,
        );
        expect(room.view().paused).toBe(true);
        expect(saved(reopened).snapshot!.state).toEqual(checkpointState);
        await ok(room, { type: 'resume' });
        await play(room, reopened, prepared.credentials, action);
        expect(saved(reopened).snapshot!.state).toEqual(expected);
        expect(saved(reopened).snapshot!.random).toBe(random.state);
        if (category === 'special-arceus') {
          expect(expected.arceusUsed).toBe(true);
          expect(expected.deck).toEqual(checkpointState.deck);
          expect(expected.discard).toEqual(checkpointState.discard);
          for (const seat of expected.seatOrder) {
            expect(expected.boards[seat]!.filter((c) => c.faceUp)).toHaveLength(
              1,
            );
            expect(expected.boards[seat]!.map((c) => c.instanceId)).toEqual(
              checkpointState.boards[seat]!.map((c) => c.instanceId),
            );
          }
        }
        results.push({
          scenario: `SQLite boundary ${category}`,
          detail: {
            phase: checkpointState.phase,
            resumedPhase: expected.phase,
            privateProjection: 'checked',
          },
        });
      } finally {
        reopened.close();
      }
    } finally {
      try {
        repository.close();
      } catch {
        /* already closed to simulate reopening */
      }
    }
  },
  15000,
);

it('compiled Worker rejects cross-version strategy identity and cancellation; old task cannot affect a switched room', async () => {
  const repository = new Repository('worker-identity');
  try {
    const { room } = await table(repository, 2, 2),
      task = room.botTask()!,
      executor = new WorkerBotExecutor(join(temporary, 'bot-worker.cjs'));
    const wrong = { ...task, variantId: 'original' };
    await expect(
      executor.execute(wrong, new AbortController().signal),
    ).rejects.toThrow('strategy-failed');
    const controller = new AbortController(),
      pending = executor.execute(task, controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow('cancelled');
    await ok(room, { type: 'end' });
    await ok(room, { type: 'select-variant', variantId: 'original' });
    const before = repository.load();
    expect(
      await room.submitBot(
        task,
        task.actions[0]!,
        task.data.memory,
        task.data.random,
      ),
    ).toMatchObject({ ok: false, reason: 'stale-instance' });
    expect(repository.load()).toEqual(before);
    results.push({
      scenario: 'Worker identity cancellation stale task',
      detail: 'passed',
    });
  } finally {
    repository.close();
  }
}, 15000);

it('real isolated 32MiB Workers finish a four-seat mixed three-level three-win match through SQLite and authorized actions', async () => {
  const repository = new Repository('worker-mixed');
  const matchStarted = performance.now();
  try {
    const { room, credentials } = await table(repository, 4, 3),
      executor = new WorkerBotExecutor(join(temporary, 'bot-worker.cjs'));
    let calls = 0,
      steps = 0,
      maxWorkerMs = 0;
    const levels = new Set<string>(),
      phases = new Set<string>();
    for (; steps < 3000; steps++) {
      const state = saved(repository).snapshot!.state as State;
      if (state.phase === 'match-result') break;
      if (state.phase === 'round-result') {
        await ok(room, { type: 'lifecycle', action: { type: 'next-round' } });
        continue;
      }
      phases.add(state.phase);
      const task = room.botTask();
      if (task) {
        levels.add(task.data.difficulty!);
        const controller = new AbortController(),
          timeout = setTimeout(() => controller.abort(), 2000),
          started = performance.now();
        try {
          const result = await executor.execute(task, controller.signal);
          maxWorkerMs = Math.max(maxWorkerMs, performance.now() - started);
          calls++;
          expect(task.actions).toContainEqual(result.action);
          expect(
            await room.submitBot(
              task,
              result.action,
              result.memory,
              result.random,
            ),
          ).toMatchObject({ ok: true });
        } finally {
          clearTimeout(timeout);
        }
      } else {
        const decision = pokemonExpansion.decisions(state)[0]!,
          legal = pokemonExpansion.legalActions(state, decision.seatId);
        await play(
          room,
          repository,
          credentials,
          ordinaryHumanAction(state, legal),
        );
      }
    }
    const final = saved(repository).snapshot!.state as State;
    expect(final.phase).toBe('match-result');
    expect(calls).toBeGreaterThan(0);
    expect([...levels].sort()).toEqual(['default', 'doubao', 'juewu']);
    expect(final.roundResult?.winners.length).toBeGreaterThan(0);
    results.push({
      scenario: 'mixed four-seat real Worker three-win match',
      detail: {
        calls,
        steps,
        maxWorkerMs,
        levels: [...levels],
        phases: [...phases],
        rounds: final.roundNumber,
        elapsedMs: performance.now() - matchStarted,
        matchWinners: final.matchWinners,
      },
    });
  } finally {
    repository.close();
  }
  // Four seats can each reach two wins before the ninth round decides the match.
  // Whole-match SQLite/history work is distinct from each Worker's two-second cap.
}, 600000);
