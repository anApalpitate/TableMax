import { expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { RoomCoordinator, type Save } from '@tablemax/platform-core';
import { io, type Socket } from 'socket.io-client';
import { RandomSource } from '@tablemax/platform-core/random';
import type { Command, CommandReply, RoomView } from '@tablemax/protocol';
import type { BotStrategy, JsonValue } from '@tablemax/game-sdk';
import { rules } from '../../../games/power-grid/rules';
import { bot as localBot } from '../../../games/power-grid/bot';
import { pressureAuction } from '../../../games/power-grid/bot/test-fixtures';
import { SqliteSaveRepository } from './save-repository';
import { WorkerBotExecutor } from './bot-executor';
import type { Action, PowerGridView } from '../../../games/power-grid/types';
import { createService } from './service';

// This transport test uses only real phone seats; strategy quality and Worker
// loading have separate seeded-match and actual-desktop verification.
const bot: BotStrategy = {
  id: 'power-grid-transport-test',
  version: '1',
  gameId: 'power-grid',
  rulesVersion: rules.manifest.rulesVersion,
  validateMemory: () => null,
  decide: async ({ actions }) => ({ action: actions[0]!, memory: null }),
};

it('persists classic auction, fuel, building and production through real sockets, failed saves, duplicate ACKs, rollback and restart without exposing cash', async () => {
  const root = resolve(
    process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp/power-grid-bot-rise-20261126',
  );
  mkdirSync(root, { recursive: true });
  const dataDir = mkdtempSync(join(root, 'power-grid-data-'));
  const webDir = mkdtempSync(join(root, 'power-grid-web-'));
  writeFileSync(join(webDir, 'index.html'), '<html>local</html>');
  const config = { dataDir, webDir, host: '127.0.0.1', port: 0 };
  let service = await createService(config, {
    rules: {
      ...rules,
      initialize: (context) =>
        rules.initialize({ ...context, random: new RandomSource(21) }),
    },
    bot,
  });
  const tokens: string[] = [];
  let clients: Socket[] = [];
  const connect = async (token?: string) => {
    const socket = io(
      `http://127.0.0.1:${(service.app.server.address() as { port: number }).port}`,
      {
        forceNew: true,
        transports: ['websocket'],
        auth: token ? { token } : {},
      },
    );
    clients.push(socket);
    await new Promise<void>((done, reject) => {
      socket.once('room:view', () => done());
      socket.once('connect_error', reject);
    });
    return socket;
  };
  const envelope = (view: RoomView, command: Command['command']): Command => ({
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  });
  const send = (socket: Socket, value: Command) =>
    new Promise<CommandReply>((done, reject) => {
      socket
        .timeout(3000)
        .emit(
          'room:command',
          value,
          (error: Error | null, reply: CommandReply) =>
            error ? reject(error) : done(reply),
        );
    });
  const run = (token: string, socket: Socket, command: Command['command']) =>
    send(socket, envelope(service.room.view(token), command));
  try {
    await service.listen();
    let host = await connect(service.hostToken);
    const observer = await connect();
    for (let index = 0; index < 3; index++) {
      const joined = await service.app.inject({
        method: 'POST',
        url: '/api/session/join',
        payload: { name: `电网${index + 1}` },
      });
      expect(joined.statusCode).toBe(200);
      tokens.push(joined.json().token);
    }
    let phones = await Promise.all(tokens.map(connect));
    for (let index = 0; index < 3; index++)
      expect(
        (
          await run(tokens[index]!, phones[index]!, {
            type: 'ready',
            ready: true,
          })
        ).ok,
      ).toBe(true);
    expect(
      (
        await run(service.hostToken, host, {
          type: 'set-owner',
          seatId: service.room.view(tokens[0]).self.seatId,
        })
      ).ok,
    ).toBe(true);
    expect((await run(tokens[0]!, phones[0]!, { type: 'start' })).ok).toBe(
      true,
    );
    const regionsIndex = tokens.findIndex(
      (token) => service.room.view(token).actions.length,
    );
    const regionView = service.room.view(tokens[regionsIndex]);
    const regionsEnvelope = envelope(regionView, {
      type: 'game',
      decisionId: regionView.decisionId!,
      action: regionView.actions[0]! as JsonValue,
    });
    expect((await send(phones[regionsIndex]!, regionsEnvelope)).ok).toBe(true);
    const currentIndex = tokens.findIndex(
      (token) => service.room.view(token).actions.length,
    );
    const current = service.room.view(tokens[currentIndex]);
    const offer = (current.actions as Action[]).find(
      (action) => action.type === 'offer',
    )!;
    expect(offer.type).toBe('offer');
    const publicGame = service.room.view(service.hostToken)
      .gameView as PowerGridView;
    expect(publicGame.self).toBeNull();
    expect(service.room.view(service.hostToken).actions).toEqual([]);
    expect(
      Object.values(publicGame.players).every((player) => player.cash === null),
    ).toBe(true);
    // Public network prices depend only on the visible map and occupancy,
    // never on the actor's affordable balance or on a private recommendation.
    expect(publicGame.buildOptions.every((option) => option.cost >= 10)).toBe(
      true,
    );
    const other = (currentIndex + 1) % 3;
    expect(
      (service.room.view(tokens[other]).gameView as PowerGridView).players[
        current.self.seatId!
      ]!.cash,
    ).toBeNull();
    expect(
      (
        await send(
          observer,
          envelope(service.room.view(), {
            type: 'game',
            decisionId: current.decisionId!,
            action: offer as JsonValue,
          }),
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await send(
          phones[other]!,
          envelope(service.room.view(tokens[other]), {
            type: 'game',
            decisionId: current.decisionId!,
            action: offer as JsonValue,
          }),
        )
      ).ok,
    ).toBe(false);
    const original = envelope(current, {
      type: 'game',
      decisionId: current.decisionId!,
      action: offer as JsonValue,
    });
    const before = service.room.view(tokens[currentIndex]);
    const fail = vi
      .spyOn(SqliteSaveRepository.prototype, 'save')
      .mockImplementationOnce(() => {
        throw new Error('injected-disk-failure');
      });
    try {
      expect(await send(phones[currentIndex]!, original)).toMatchObject({
        ok: false,
        reason: 'save-or-action-failed',
      });
      expect(service.room.view(tokens[currentIndex]).revision).toBe(
        before.revision,
      );
      expect(service.room.view(tokens[currentIndex]).gameView).toEqual(
        before.gameView,
      );
    } finally {
      fail.mockRestore();
    }
    expect((await send(phones[currentIndex]!, original)).ok).toBe(true);
    const afterOffer = service.room.view().revision;
    expect((await send(phones[currentIndex]!, original)).ok).toBe(true);
    expect(service.room.view().revision).toBe(afterOffer);
    for (let index = 0; index < 8; index++) {
      if ((service.room.view().gameView as PowerGridView).phase !== 'auction')
        break;
      const bidder = tokens.findIndex(
        (token) => service.room.view(token).actions.length,
      );
      const view = service.room.view(tokens[bidder]);
      const pass = view.actions.find(
        (action) => (action as Action).type === 'pass',
      )!;
      expect(pass).toBeDefined();
      expect(
        (
          await send(
            phones[bidder]!,
            envelope(view, {
              type: 'game',
              decisionId: view.decisionId!,
              action: pass as JsonValue,
            }),
          )
        ).ok,
      ).toBe(true);
    }
    const won = service.room.view(tokens[currentIndex])
      .gameView as PowerGridView;
    expect(won.players[current.self.seatId!]!.plants).toHaveLength(1);
    expect(won.self!.cash).toBe(50 - (offer as { amount: number }).amount);
    // Exercise the SDK's exact legal-action contract across phase boundaries.
    // Direct rules tests alone cannot detect normalization/key-order failures
    // in the platform's JSON comparison before it reaches rules.apply.
    const take = async (action: Action) => {
      const acting = tokens.findIndex(
        (token) => service.room.view(token).actions.length,
      );
      expect(acting).toBeGreaterThanOrEqual(0);
      const view = service.room.view(tokens[acting]);
      expect(
        (
          await send(
            phones[acting]!,
            envelope(view, {
              type: 'game',
              decisionId: view.decisionId!,
              action: action as JsonValue,
            }),
          )
        ).ok,
      ).toBe(true);
    };
    for (let guard = 0; guard < 20; guard++) {
      const view = tokens
        .map((token) => service.room.view(token))
        .find((value) => value.actions.length)!;
      const phase = (view.gameView as PowerGridView).phase;
      if (phase === 'resources') break;
      const action = (view.actions as Action[]).find(
        (value) => value.type === (phase === 'auction' ? 'pass' : 'offer'),
      )!;
      await take(action);
    }
    expect((service.room.view().gameView as PowerGridView).phase).toBe(
      'resources',
    );
    const fuelSeat = tokens.findIndex(
      (token) => service.room.view(token).actions.length,
    );
    const fuelSeatId = service.room.view(tokens[fuelSeat]).self.seatId!;
    for (let unit = 0; unit < 2; unit++) {
      const view = service.room.view(tokens[fuelSeat]);
      const action = (view.actions as Action[]).find(
        (value) => value.type === 'buy-resource',
      )!;
      expect(action).toBeDefined();
      await take(action);
    }
    while (
      (service.room.view().gameView as PowerGridView).phase === 'resources'
    )
      await take({ type: 'finish' });
    const firstBuild = (
      service.room.view(tokens[fuelSeat]).actions as Action[]
    ).find((value) => value.type === 'build')!;
    expect(firstBuild).toBeDefined();
    await take(firstBuild);
    while ((service.room.view().gameView as PowerGridView).phase === 'building')
      await take({ type: 'finish' });
    let operated = false;
    while (
      (service.room.view().gameView as PowerGridView).phase === 'powering'
    ) {
      const view = tokens
        .map((token) => service.room.view(token))
        .find((value) => value.actions.length)!;
      const runPlant = (view.actions as Action[]).find(
        (value) => value.type === 'run',
      );
      if (runPlant && !operated && view.self.seatId === fuelSeatId) {
        await take(runPlant);
        operated = true;
      } else {
        await take({
          type: 'finish',
          cities: view.self.seatId === fuelSeatId ? 1 : 0,
        });
      }
    }
    expect(operated).toBe(true);
    const afterProduction = service.room.view(tokens[fuelSeat])
      .gameView as PowerGridView;
    expect(afterProduction.round).toBe(2);
    expect(afterProduction.players[fuelSeatId]!.powered).toBe(1);
    expect(afterProduction.players[fuelSeatId]!.plants[0]!.resources).toEqual({
      coal: 0,
      oil: 0,
      garbage: 0,
      uranium: 0,
    });
    const saved = service.room.view(tokens[currentIndex]).gameView;
    const checkpointId = service.room
      .view(service.hostToken)
      .history.at(-1)!.id;
    for (const client of clients) client.disconnect();
    clients = [];
    await service.close();
    service = await createService(config, { rules, bot });
    await service.listen();
    host = await connect(service.hostToken);
    phones = await Promise.all(tokens.map(connect));
    expect(service.room.view().paused).toBe(true);
    expect(service.room.view(tokens[currentIndex]).gameView).toEqual(saved);
    expect(service.room.view().ownerSeatId).toBe(
      service.room.view(tokens[0]).self.seatId,
    );
    expect((await run(tokens[0]!, phones[0]!, { type: 'resume' })).ok).toBe(
      true,
    );
    expect(
      (
        await run(service.hostToken, host, {
          type: 'set-owner',
          seatId: service.room.view(tokens[1]).self.seatId,
        })
      ).ok,
    ).toBe(true);
    expect(
      (await run(service.hostToken, host, { type: 'rollback', checkpointId }))
        .ok,
    ).toBe(true);
    expect(service.room.view().ownerSeatId).toBe(
      service.room.view(tokens[1]).self.seatId,
    );
    expect(service.room.view().paused).toBe(true);
    expect((await send(phones[currentIndex]!, original)).ok).toBe(false);
    expect((await send(phones[regionsIndex]!, regionsEnvelope)).ok).toBe(false);
    const hidden = service.room.view().gameView as PowerGridView;
    expect(
      Object.values(hidden.players).every((player) => player.cash === null),
    ).toBe(true);
  } finally {
    vi.restoreAllMocks();
    for (const client of clients) client.disconnect();
    await service.close();
  }
}, 30000);

it('runs the Power Grid Mischief counterbid through the real Worker and resumes SQLite', async () => {
  const taskRoot = resolve(
    process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp/power-grid-bot-rise-20261126',
  );
  mkdirSync(taskRoot, { recursive: true });
  const output = mkdtempSync(join(taskRoot, 'power-grid-worker-'));
  const workerPath = join(output, 'bot-worker.cjs');
  const strategyPath = join(output, 'power-grid.cjs');
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
      entryPoints: ['games/power-grid/bot/index.ts'],
      outfile: strategyPath,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
    }),
  ]);
  const game = {
    ...rules,
    initialize: (context: Parameters<typeof rules.initialize>[0]) =>
      pressureAuction(context, 39),
  };
  let repository = new SqliteSaveRepository(output);
  let room = new RoomCoordinator(game, localBot, repository);
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
    await host({ type: 'add-bot', name: '电网甲', difficulty: 'mischief' });
    await host({ type: 'add-bot', name: '电网乙', difficulty: 'juewu' });
    await host({ type: 'add-bot', name: '电网丙', difficulty: 'doubao' });
    await host({ type: 'start' });
    const task = room.botTask()!;
    const view = task.view as PowerGridView;
    expect(task.data).toMatchObject({
      difficulty: 'mischief',
      version: localBot.version,
    });
    expect(room.view().game?.botDifficulties).toContain('mischief');
    expect(view.players[view.auction!.highBidder]!.cash).toBeNull();
    const worker = new WorkerBotExecutor(workerPath, () => strategyPath);
    const start = performance.now();
    const result = await worker.execute(task, AbortSignal.timeout(2000));
    expect(performance.now() - start).toBeLessThan(2000);
    expect(result.action).toEqual({ type: 'bid', amount: 42 });
    expect(
      (await room.submitBot(task, result.action, result.memory, result.random))
        .ok,
    ).toBe(true);
    await host({
      type: 'rollback',
      checkpointId: room.view(room.hostToken).history[0]!.id,
    });
    repository.close();
    repository = new SqliteSaveRepository(output);
    room = new RoomCoordinator(game, localBot, repository, room.hostToken);
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
