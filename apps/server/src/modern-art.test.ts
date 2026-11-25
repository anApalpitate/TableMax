import { expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { RoomCoordinator, type Save } from '@tablemax/platform-core';
import { io, type Socket } from 'socket.io-client';
import { RandomSource } from '@tablemax/platform-core/random';
import type { JsonValue } from '@tablemax/game-sdk';
import {
  RoomFeedbackSchema,
  type Command,
  type CommandReply,
  type RoomView,
} from '@tablemax/protocol';
import { rules, bot } from '../../../games/modern-art';
import type { ModernArtView } from '../../../games/modern-art/ui/view';
import { pressureOffer } from '../../../games/modern-art/bot/test-fixtures';
import { createService } from './service';
import { SqliteSaveRepository } from './save-repository';
import { WorkerBotExecutor } from './bot-executor';

it('keeps sealed bids private through real sockets, durable restart, independent submissions and rollback', async () => {
  const root = resolve(
    'tmp',
    process.env.TABLEMAX_TASK_ID ?? 'modern-art-bot-rise-20261126',
  );
  mkdirSync(root, { recursive: true });
  const dataDir = mkdtempSync(join(root, 'modern-art-data-'));
  const webDir = mkdtempSync(join(root, 'modern-art-web-'));
  writeFileSync(join(webDir, 'index.html'), '<html>local</html>');
  const config = { dataDir, webDir, host: '127.0.0.1', port: 0 };
  let service = await createService(config, {
    rules: {
      ...rules,
      initialize: (context) =>
        rules.initialize({ ...context, random: new RandomSource(9) }),
    },
    bot,
  });
  let clients: Socket[] = [];
  const connect = async (token?: string) => {
    const socket = io(
      `http://127.0.0.1:${service.app.server.address() && (service.app.server.address() as { port: number }).port}`,
      {
        forceNew: true,
        transports: ['websocket'],
        auth: token ? { token } : {},
      },
    );
    clients.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('room:view', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  };
  const send = (socket: Socket, envelope: Command) =>
    new Promise<CommandReply>((resolve, reject) => {
      socket
        .timeout(3000)
        .emit(
          'room:command',
          envelope,
          (error: Error | null, result: CommandReply) =>
            error ? reject(error) : resolve(result),
        );
    });
  const envelope = (view: RoomView, command: Command['command']): Command => ({
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  });
  const run = (token: string, socket: Socket, command: Command['command']) =>
    send(socket, envelope(service.room.view(token), command));
  const tokens: string[] = [];
  try {
    await service.listen();
    let host = await connect(service.hostToken);
    const observer = await connect();
    const feedback: unknown[] = [];
    observer.on('room:feedback', (value: unknown) => {
      RoomFeedbackSchema.parse(value);
      feedback.push(value);
    });
    for (let i = 0; i < 3; i++) {
      const response = await service.app.inject({
        method: 'POST',
        url: '/api/session/join',
        payload: { name: `美术馆${i + 1}` },
      });
      tokens.push(response.json().token);
    }
    let phones = await Promise.all(tokens.map(connect));
    for (let i = 0; i < 3; i++)
      expect(
        (await run(tokens[i]!, phones[i]!, { type: 'ready', ready: true })).ok,
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
    for (let step = 0; step < 500; step++) {
      const pub = service.room.view().gameView as ModernArtView;
      if (pub.auction?.kind === 'sealed' && pub.phase === 'auction') break;
      if (service.room.view(service.hostToken).lifecycleActions.length) {
        expect(
          (
            await run(tokens[0]!, phones[0]!, {
              type: 'lifecycle',
              action: { type: 'next-round' },
            })
          ).ok,
        ).toBe(true);
        continue;
      }
      const index = tokens.findIndex(
        (token) => service.room.view(token).actions.length,
      );
      expect(index).toBeGreaterThanOrEqual(0);
      const view = service.room.view(tokens[index]);
      const game = view.gameView as ModernArtView;
      const preferred = game.self?.hand.find(
        (card) => card.auctionKind === 'sealed',
      );
      const action =
        view.actions.find(
          (a) =>
            (a as { type: string; cardId?: string }).type === 'offer' &&
            (a as { cardId?: string }).cardId === preferred?.id,
        ) ??
        view.actions.find((a) =>
          ['pass', 'decline-double'].includes((a as { type: string }).type),
        ) ??
        view.actions[0]!;
      expect(
        (
          await run(tokens[index]!, phones[index]!, {
            type: 'game',
            decisionId: view.decisionId!,
            action: action as JsonValue,
          })
        ).ok,
      ).toBe(true);
    }
    const before = tokens.map((token) => service.room.view(token));
    const beforeGame = before[0]!.gameView as ModernArtView;
    expect(beforeGame.auction?.kind).toBe('sealed');
    const publicGame = service.room.view(service.hostToken)
      .gameView as ModernArtView;
    expect(publicGame.self).toBeNull();
    expect(
      Object.values(publicGame.players).every((player) => player.cash === null),
    ).toBe(true);
    expect(service.room.view(service.hostToken).actions).toEqual([]);
    const cash = beforeGame.self!.cash;
    const original = envelope(before[0]!, {
      type: 'game',
      decisionId: before[0]!.decisionId!,
      action: { type: 'sealed-bid', amount: Math.min(1, cash) },
    });
    expect((await send(phones[0]!, original)).ok).toBe(true);
    const revision = service.room.view().revision;
    expect((await send(phones[0]!, original)).ok).toBe(true);
    expect(service.room.view().revision).toBe(revision);
    const hidden = service.room.view().gameView as ModernArtView;
    expect(hidden.auction!.submitted).toHaveLength(1);
    expect(hidden.history.every((log) => log.sealedBids === null)).toBe(true);
    expect(
      (service.room.view(tokens[1]).gameView as ModernArtView).self!.sealedBid,
    ).toBeNull();
    const saved = service.room.view(tokens[0]).gameView;
    const checkpointId = service.room
      .view(service.hostToken)
      .history.at(-1)!.id;
    for (const socket of clients) socket.disconnect();
    clients = [];
    await service.close();
    service = await createService(config);
    await service.listen();
    host = await connect(service.hostToken);
    phones = await Promise.all(tokens.map(connect));
    expect(service.room.view().paused).toBe(true);
    expect(service.room.view(tokens[0]).gameView).toEqual(saved);
    expect(service.room.view().ownerSeatId).toBe(before[0]!.self.seatId);
    expect((await run(tokens[0]!, phones[0]!, { type: 'resume' })).ok).toBe(
      true,
    );
    const peers = tokens.slice(1).map((token) => service.room.view(token));
    const replies = await Promise.all(
      peers.map((view, index) =>
        send(
          phones[index + 1]!,
          envelope(view, {
            type: 'game',
            decisionId: view.decisionId!,
            action: { type: 'sealed-bid', amount: 0 },
          }),
        ),
      ),
    );
    expect(replies.every((reply) => reply.ok)).toBe(true);
    const revealed = service.room.view().gameView as ModernArtView;
    expect(
      revealed.history.some(
        (log) => log.sealedBids && Object.keys(log.sealedBids).length === 3,
      ),
    ).toBe(true);
    // A checkpoint restores game information, never the administrator's current delegation.
    expect(
      (
        await run(service.hostToken, host, {
          type: 'set-owner',
          seatId: before[1]!.self.seatId,
        })
      ).ok,
    ).toBe(true);
    expect(
      (await run(service.hostToken, host, { type: 'rollback', checkpointId }))
        .ok,
    ).toBe(true);
    const rolled = service.room.view(tokens[0]).gameView as ModernArtView;
    expect(rolled.self!.sealedBid).toBeNull();
    expect(rolled.auction!.submitted).toEqual([]);
    expect(service.room.view().ownerSeatId).toBe(before[1]!.self.seatId);
    expect(await send(phones[0]!, original)).toMatchObject({ ok: false });
    expect(feedback.length).toBeGreaterThan(0);
  } finally {
    for (const socket of clients) socket.disconnect();
    await service.close();
  }
}, 30000);

it('runs the Modern Art Mischief counterbid in the real Worker and replays it after SQLite recovery', async () => {
  const taskRoot = resolve(
    'tmp',
    process.env.TABLEMAX_TASK_ID ?? 'modern-art-bot-rise-20261126',
  );
  mkdirSync(taskRoot, { recursive: true });
  const output = mkdtempSync(join(taskRoot, 'modern-art-worker-'));
  const workerPath = join(output, 'bot-worker.cjs');
  const strategyPath = join(output, 'modern-art.cjs');
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
      entryPoints: ['games/modern-art/bot/index.ts'],
      outfile: strategyPath,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
    }),
  ]);
  const fixture = {
    ...rules,
    initialize(context: Parameters<typeof rules.initialize>[0]) {
      return rules.apply(
        pressureOffer(context, 'open'),
        { type: 'bid', amount: 24 },
        context.seats[1]!,
        context,
      ).state;
    },
  };
  let repository = new SqliteSaveRepository(output);
  let room = new RoomCoordinator(fixture, bot, repository);
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
    await host({ type: 'add-bot', name: '画廊甲', difficulty: 'juewu' });
    await host({ type: 'add-bot', name: '画廊乙', difficulty: 'juewu' });
    await host({ type: 'add-bot', name: '画廊丙', difficulty: 'mischief' });
    await host({ type: 'start' });
    const seat = room.view().seats[2]!.id;
    const task = room.botTask(seat)!;
    expect(task.data).toMatchObject({
      version: '1.1.0',
      difficulty: 'mischief',
    });
    expect(room.view().game?.botDifficulties).toContain('mischief');
    const authorized = task.view as ModernArtView;
    expect(authorized.self?.seatId).toBe(seat);
    expect(
      Object.values(authorized.players).every(({ cash }) => cash === null),
    ).toBe(true);
    const worker = new WorkerBotExecutor(workerPath, () => strategyPath);
    const started = performance.now();
    const result = await worker.execute(task, AbortSignal.timeout(2000));
    expect(performance.now() - started).toBeLessThan(2000);
    expect(result.action).toEqual({ type: 'bid', amount: 26 });
    expect(
      (await room.submitBot(task, result.action, result.memory, result.random))
        .ok,
    ).toBe(true);
    expect((room.view().gameView as ModernArtView).auction?.currentBid).toBe(
      26,
    );
    await host({
      type: 'rollback',
      checkpointId: room.view(room.hostToken).history[0]!.id,
    });
    repository.close();
    repository = new SqliteSaveRepository(output);
    room = new RoomCoordinator(fixture, bot, repository, room.hostToken);
    expect(room.view()).toMatchObject({ restored: true, paused: true });
    expect((repository.load() as Save).snapshot?.bots[seat]).toEqual(task.data);
    await host({ type: 'resume' });
    const replay = await worker.execute(
      room.botTask(seat)!,
      AbortSignal.timeout(2000),
    );
    expect(replay).toEqual(result);
  } finally {
    repository.close();
  }
}, 15000);
