import { expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import type { Command, CommandReply, RoomView } from '@tablemax/protocol';
import { RoomCoordinator, type Save } from '@tablemax/platform-core';
import { rules, bot } from '../../../games/modern-art';
import type { ModernArtView } from '../../../games/modern-art/ui/view';
import { createService } from './service';
import { SqliteSaveRepository } from './save-repository';

it('serializes open bids while accepting concurrent confirmations of the same saved price', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tablemax-open-auction-'));
  const webDir = mkdtempSync(join(tmpdir(), 'tablemax-open-web-'));
  writeFileSync(join(webDir, 'index.html'), '<html>local</html>');
  const config = { dataDir, webDir, host: '127.0.0.1', port: 0 };
  let service = await createService(config, {
    rules: {
      ...rules,
      initialize: (context) =>
        rules.initialize({ ...context, random: { next: () => 0.999999 } }),
    },
    bot,
  });
  let sockets: Socket[] = [];
  const connect = async (token: string) => {
    const address = service.app.server.address() as { port: number };
    const socket = io(`http://127.0.0.1:${address.port}`, {
      forceNew: true,
      transports: ['websocket'],
      auth: { token },
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('room:view', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  };
  const envelope = (view: RoomView, command: Command['command']): Command => ({
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    branch: view.branch,
    revision: view.revision,
    command,
  });
  const send = (socket: Socket, command: Command) =>
    new Promise<CommandReply>((resolve, reject) => {
      socket
        .timeout(3000)
        .emit(
          'room:command',
          command,
          (error: Error | null, reply: CommandReply) =>
            error ? reject(error) : resolve(reply),
        );
    });
  const tokens: string[] = [];
  const game = () => service.room.view().gameView as ModernArtView;
  const playerGame = (token: string) =>
    service.room.view(token).gameView as ModernArtView;
  try {
    await service.listen();
    let host = await connect(service.hostToken);
    for (let index = 0; index < 3; index++) {
      const response = await service.app.inject({
        method: 'POST',
        url: '/api/session/join',
        payload: { name: `竞拍者 ${index + 1}` },
      });
      tokens.push(response.json().token);
    }
    let phones = await Promise.all(tokens.map(connect));
    const run = (index: number, command: Command['command']) =>
      send(phones[index]!, envelope(service.room.view(tokens[index]), command));
    const manage = (command: Command['command']) =>
      send(host, envelope(service.room.view(service.hostToken), command));
    for (let index = 0; index < 3; index++)
      expect((await run(index, { type: 'ready', ready: true })).ok).toBe(true);
    expect((await manage({ type: 'start' })).ok).toBe(true);
    const open = playerGame(tokens[0]!).self!.hand.find(
      (card) => card.auctionKind === 'open',
    )!;
    expect(open).toBeDefined();
    expect(
      (
        await run(0, {
          type: 'game',
          decisionId: service.room.view(tokens[0]).decisionId!,
          action: { type: 'offer', cardId: open.id },
        })
      ).ok,
    ).toBe(true);
    const before = tokens.map((token) => service.room.view(token));
    const pass = (view: RoomView) =>
      envelope(view, {
        type: 'game',
        decisionId: view.decisionId!,
        action: { type: 'pass' },
      });
    const replies = await Promise.all(
      [0, 1].map((index) => send(phones[index]!, pass(before[index]!))),
    );
    expect(replies.every((reply) => reply.ok)).toBe(true);
    expect(game().auction!.passes).toHaveLength(2);
    expect(service.room.view(tokens[2]).selectionToken).toBe(
      before[2]!.selectionToken,
    );
    const bid = envelope(before[2]!, {
      type: 'game',
      decisionId: before[2]!.decisionId!,
      action: { type: 'bid', amount: 15 },
    });
    const accepted = await send(phones[2]!, bid);
    expect(accepted.ok).toBe(true);
    expect(game().auction!.currentBid).toBe(15);
    expect(game().auction!.passes).toEqual([]);
    const revision = service.room.view().revision;
    expect(await send(phones[2]!, bid)).toEqual(accepted);
    expect(service.room.view().revision).toBe(revision);
    expect(await send(phones[0]!, pass(before[0]!))).toEqual({
      ok: false,
      reason: 'stale-revision',
    });
    expect(game().auction!.passes).toEqual([]);
    expect(
      await send(
        host,
        envelope(service.room.view(service.hostToken), {
          type: 'game',
          decisionId: service.room.view(tokens[0]).decisionId!,
          action: { type: 'pass' },
        }),
      ),
    ).toMatchObject({ ok: false, reason: 'not-actionable' });

    const late = pass(service.room.view(tokens[0]));
    expect((await manage({ type: 'pause' })).ok).toBe(true);
    expect((await manage({ type: 'resume' })).ok).toBe(true);
    expect(await send(phones[0]!, late)).toEqual({
      ok: false,
      reason: 'stale-revision',
    });
    const current = tokens.map((token) => service.room.view(token));
    expect(
      (
        await Promise.all(
          [0, 1].map((index) => send(phones[index]!, pass(current[index]!))),
        )
      ).every((reply) => reply.ok),
    ).toBe(true);
    expect(game().auction).toBeNull();
    expect(playerGame(tokens[2]!).self!.cash).toBe(85);
    expect(game().players[before[2]!.self.seatId!]!.collection).toHaveLength(1);
    const checkpointId = service.room
      .view(service.hostToken)
      .history.at(-2)!.id;
    expect((await manage({ type: 'rollback', checkpointId })).ok).toBe(true);
    expect(await send(phones[0]!, pass(current[0]!))).toMatchObject({
      ok: false,
      reason: 'stale-branch',
    });
    expect(game().auction!.currentBid).toBe(15);
    expect(game().auction!.passes).toEqual([]);
    expect((await manage({ type: 'resume' })).ok).toBe(true);
    const saved = service.room.view(tokens[0]).gameView;
    const pending = pass(service.room.view(tokens[0]));
    for (const socket of sockets) socket.disconnect();
    sockets = [];
    await service.close();
    service = await createService(config);
    await service.listen();
    host = await connect(service.hostToken);
    phones = await Promise.all(tokens.map(connect));
    expect(service.room.view().paused).toBe(true);
    expect(service.room.view(tokens[0]).gameView).toEqual(saved);
    expect(await send(phones[0]!, pending)).toMatchObject({
      ok: false,
      reason: 'stale-branch',
    });
    expect((await manage({ type: 'resume' })).ok).toBe(true);
    const restored = tokens.map((token) => service.room.view(token));
    expect(
      (
        await Promise.all(
          [0, 1].map((index) => send(phones[index]!, pass(restored[index]!))),
        )
      ).every((reply) => reply.ok),
    ).toBe(true);
    expect(game().auction).toBeNull();
  } finally {
    for (const socket of sockets) socket.disconnect();
    await service.close();
  }
}, 30000);

it('opens a durable predecessor save with per-seat open-auction clocks and keeps its players and price', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tablemax-open-migration-'));
  const webDir = mkdtempSync(join(tmpdir(), 'tablemax-open-web-'));
  writeFileSync(join(webDir, 'index.html'), '<html>local</html>');
  const repository = new SqliteSaveRepository(dataDir);
  const predecessor = new RoomCoordinator(
    {
      ...rules,
      initialize: (context) =>
        rules.initialize({ ...context, random: { next: () => 0.999999 } }),
      // This is the previous released decision generator for open auctions.
      decisions: (state) =>
        rules.decisions(state).map(({ id, seatId }) => ({ id, seatId })),
    },
    bot,
    repository,
  );
  const send = (token: string, command: Command['command']) => {
    const view = predecessor.view(token);
    return predecessor.command(token, {
      actionId: crypto.randomUUID(),
      instanceId: view.instanceId,
      revision: view.revision,
      branch: view.branch,
      command,
    });
  };
  const players = [];
  for (let index = 0; index < 3; index++) {
    const player = await predecessor.join(`旧存档玩家 ${index + 1}`);
    players.push(player);
    expect((await send(player.token, { type: 'ready', ready: true })).ok).toBe(
      true,
    );
  }
  expect((await send(predecessor.hostToken, { type: 'start' })).ok).toBe(true);
  const first = players[0]!.token;
  const offered = (
    predecessor.view(first).gameView as ModernArtView
  ).self!.hand.find((card) => card.auctionKind === 'open')!;
  expect(
    (
      await send(first, {
        type: 'game',
        decisionId: predecessor.view(first).decisionId!,
        action: { type: 'offer', cardId: offered.id },
      })
    ).ok,
  ).toBe(true);
  expect(
    (
      await send(first, {
        type: 'game',
        decisionId: predecessor.view(first).decisionId!,
        action: { type: 'bid', amount: 23 },
      })
    ).ok,
  ).toBe(true);
  const before = players.map((player) => predecessor.view(player.token));
  const clocks = (repository.load() as Save).decisionClocks!;
  expect(clocks).toHaveLength(2);
  repository.close();
  const service = await createService({
    dataDir,
    webDir,
    host: '127.0.0.1',
    port: 0,
  });
  try {
    await service.listen();
    expect(service.room.view().paused).toBe(true);
    const remainingMs = Math.min(...clocks.map((clock) => clock.remainingMs));
    expect(service.room.view().decisionClock!.remainingMs).toBe(remainingMs);
    for (let index = 0; index < players.length; index++) {
      const response = await service.app.inject({
        method: 'POST',
        url: '/api/session/view',
        payload: { token: players[index]!.token },
      });
      expect(response.json().view.gameView).toEqual(before[index]!.gameView);
    }
    expect(
      (service.room.view().gameView as ModernArtView).auction!.currentBid,
    ).toBe(23);
  } finally {
    await service.close();
  }
});
