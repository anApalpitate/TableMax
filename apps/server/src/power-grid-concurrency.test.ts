import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { expect, it, vi } from 'vitest';
import { RandomSource } from '@tablemax/platform-core/random';
import type { BotStrategy, JsonValue } from '@tablemax/game-sdk';
import type { Command, CommandReply, RoomView } from '@tablemax/protocol';
import { rules } from '../../../games/power-grid/rules';
import type { Action, PowerGridView } from '../../../games/power-grid/types';
import { SqliteSaveRepository } from './save-repository';
import { createService } from './service';

const bot: BotStrategy = {
  id: 'power-grid-concurrency-test',
  version: '1',
  gameId: 'power-grid',
  rulesVersion: rules.manifest.rulesVersion,
  validateMemory: () => null,
  decide: async ({ actions }) => ({ action: actions[0]!, memory: null }),
};

function envelope(view: RoomView, command: Command['command']): Command {
  return {
    actionId: randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  };
}

async function fixture() {
  const dataDir = mkdtempSync(join(tmpdir(), 'tablemax-pg-race-'));
  const webDir = join(dataDir, 'web');
  mkdirSync(webDir);
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
  let sockets: Socket[] = [];
  const tokens: string[] = [];
  const connect = async (token: string) => {
    const socket = io(
      `http://127.0.0.1:${(service.app.server.address() as { port: number }).port}`,
      { forceNew: true, transports: ['websocket'], auth: { token } },
    );
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('room:view', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  };
  const send = (socket: Socket, request: Command) =>
    new Promise<CommandReply>((resolve, reject) => {
      socket
        .timeout(3000)
        .emit(
          'room:command',
          request,
          (error: Error | null, reply: CommandReply) =>
            error ? reject(error) : resolve(reply),
        );
    });
  await service.listen();
  let host = await connect(service.hostToken);
  for (let index = 0; index < 3; index++) {
    const joined = await service.app.inject({
      method: 'POST',
      url: '/api/session/join',
      payload: { name: `并发电网${index + 1}` },
    });
    expect(joined.statusCode).toBe(200);
    tokens.push(joined.json().token);
  }
  let phones = await Promise.all(tokens.map(connect));
  const view = (index = -1) =>
    service.room.view(index === -1 ? service.hostToken : tokens[index]);
  const game = () => view().gameView as PowerGridView;
  const acting = () =>
    tokens.findIndex((_, index) => view(index).actions.length);
  const request = (index: number, action: Action) => {
    const current = view(index);
    return envelope(current, {
      type: 'game',
      decisionId: current.decisionId!,
      action: action as JsonValue,
    });
  };
  const run = async (index: number, command: Command['command']) => {
    const reply = await send(
      index === -1 ? host : phones[index]!,
      envelope(view(index), command),
    );
    expect(reply.ok).toBe(true);
    return reply;
  };
  const take = async (action: Action) => {
    const index = acting();
    expect(index).toBeGreaterThanOrEqual(0);
    const reply = await send(phones[index]!, request(index, action));
    expect(reply.ok).toBe(true);
    return reply;
  };
  for (let index = 0; index < tokens.length; index++)
    await run(index, { type: 'ready', ready: true });
  await run(-1, { type: 'set-owner', seatId: view(0).self.seatId });
  await run(0, { type: 'start' });
  await take(view(acting()).actions[0]! as Action);
  return {
    view,
    game,
    acting,
    request,
    run,
    take,
    send,
    async secondPhone(index: number) {
      return connect(tokens[index]!);
    },
    phone(index: number) {
      return phones[index]!;
    },
    async restart() {
      for (const socket of sockets) socket.disconnect();
      sockets = [];
      await service.close();
      service = await createService(config, { rules, bot });
      await service.listen();
      host = await connect(service.hostToken);
      phones = await Promise.all(tokens.map(connect));
    },
    async close() {
      for (const socket of sockets) socket.disconnect();
      await service.close();
    },
  };
}

it('serializes real simultaneous auction quotes, deduplicates two phone connections and rejects old turns across failed save, restart and rollback', async () => {
  const f = await fixture();
  try {
    await f.take({ type: 'offer', plantId: 3, amount: 3 });
    const index = f.acting();
    const seat = f.view(index).self.seatId!;
    const secondPhone = await f.secondPhone(index);
    const before = f.view(index);
    const beforeHistoryCount = f.view().history.length;
    const firstBid = f.request(index, { type: 'bid', amount: 5 });
    const otherIndex = (index + 1) % 3;
    const unauthorizedBid = envelope(f.view(otherIndex), firstBid.command);
    const replies = await Promise.all([
      f.send(f.phone(index), firstBid),
      f.send(secondPhone, firstBid),
      f.send(f.phone(otherIndex), unauthorizedBid),
    ]);
    expect(replies[0]).toEqual(replies[1]);
    expect(replies[0]!.ok).toBe(true);
    expect(replies[2]!.ok).toBe(false);
    expect(f.view().revision).toBe(before.revision + 1);
    expect(f.game().auction).toMatchObject({ amount: 5, highBidder: seat });
    expect(f.view().history).toHaveLength(beforeHistoryCount + 1);
    expect(
      await f.send(secondPhone, {
        ...firstBid,
        command: {
          type: 'game',
          decisionId: before.decisionId!,
          action: { type: 'bid', amount: 6 },
        },
      }),
    ).toMatchObject({ ok: false, reason: 'action-id-conflict' });

    const next = f.acting();
    const nextPhone = await f.secondPhone(next);
    const beforeRace = f.view(next);
    const quote = f.request(next, { type: 'bid', amount: 7 });
    const pass = f.request(next, { type: 'pass' });
    const raced = await Promise.all([
      f.send(f.phone(next), quote),
      f.send(nextPhone, pass),
    ]);
    expect(raced.filter((reply) => reply.ok)).toHaveLength(1);
    expect(raced.find((reply) => !reply.ok)).toMatchObject({
      reason: 'stale-revision',
    });
    expect(f.view().revision).toBe(beforeRace.revision + 1);
    const accepted = raced[0]!.ok ? quote : pass;
    const acceptedReply = raced.find((reply) => reply.ok)!;
    const lost = raced[0]!.ok ? pass : quote;
    expect(await f.send(f.phone(next), accepted)).toEqual(acceptedReply);
    expect(
      await f.send(f.phone(next), {
        ...lost,
        actionId: randomUUID(),
        revision: f.view().revision,
      }),
    ).toMatchObject({ ok: false, reason: 'stale-decision' });

    const saved = f.game();
    const checkpointId = f.view().history.at(-1)!.id;
    await f.restart();
    expect(f.game()).toEqual(saved);
    expect(f.view().paused).toBe(true);
    expect(f.view().branch).toBeGreaterThan(accepted.branch);
    const restoredRevision = f.view().revision;
    expect(await f.send(f.phone(next), accepted)).toMatchObject({
      ok: false,
      reason: 'stale-branch',
    });
    expect(f.view().revision).toBe(restoredRevision);
    await f.run(0, { type: 'resume' });

    const current = f.acting();
    const beforeFailure = f.view(current);
    const beforeFailureGame = f.game();
    const retry = f.request(current, { type: 'bid', amount: 9 });
    const fail = vi
      .spyOn(SqliteSaveRepository.prototype, 'save')
      .mockImplementationOnce(() => {
        throw new Error('injected-concurrent-save-failure');
      });
    try {
      expect(await f.send(f.phone(current), retry)).toMatchObject({
        ok: false,
        reason: 'save-or-action-failed',
      });
      expect(f.view(current).revision).toBe(beforeFailure.revision);
      expect(f.game()).toEqual(beforeFailureGame);
    } finally {
      fail.mockRestore();
    }
    expect((await f.send(f.phone(current), retry)).ok).toBe(true);
    const afterRetry = f.view().revision;
    expect((await f.send(f.phone(current), retry)).ok).toBe(true);
    expect(f.view().revision).toBe(afterRetry);
    await f.run(-1, { type: 'rollback', checkpointId });
    expect(f.view().paused).toBe(true);
    expect(f.game().auction).toEqual(
      (beforeRace.gameView as PowerGridView).auction,
    );
    expect(await f.send(f.phone(next), accepted)).toMatchObject({
      ok: false,
      reason: 'stale-branch',
    });
    expect(await f.send(f.phone(current), retry)).toMatchObject({
      ok: false,
      reason: 'stale-branch',
    });
  } finally {
    vi.restoreAllMocks();
    await f.close();
  }
}, 15000);

it('keeps public purchase/build order and gives rearrangements their own serialized decision boundary during fuel purchases and clockwise bidding', async () => {
  const f = await fixture();
  try {
    // All fixtures are acquired through legal server commands. The three
    // players buy 3/4/5; only the owner of 5 later buys coal plant 8.
    while (f.game().phase === 'offer' || f.game().phase === 'auction')
      await f.take(
        f.game().phase === 'auction'
          ? { type: 'pass' }
          : (f.view(f.acting()).actions as Action[]).find(
              (action) => action.type === 'offer',
            )!,
      );
    expect(
      f.game().playerOrder.map((seat) => f.game().players[seat]!.plants[0]!.id),
    ).toEqual([5, 4, 3]);
    const reverse = [...f.game().playerOrder].reverse();
    const resourceOrder: string[] = [];
    while (f.game().phase === 'resources') {
      resourceOrder.push(f.game().actor!);
      const purchase = (f.view(f.acting()).actions as Action[]).find(
        (action) =>
          action.type === 'buy-resource' && action.resource === 'coal',
      );
      if (purchase) await f.take(purchase);
      await f.take({ type: 'finish' });
    }
    expect(resourceOrder).toEqual(reverse);
    const buildOrder: string[] = [];
    while (f.game().phase === 'building') {
      buildOrder.push(f.game().actor!);
      await f.take({ type: 'finish' });
    }
    expect(buildOrder).toEqual(reverse);
    while (f.game().phase === 'powering')
      await f.take({ type: 'finish', cities: 0 });
    const owner = f.game().actor!;
    expect(f.game().players[owner]!.plants[0]!.id).toBe(5);
    await f.take({ type: 'offer', plantId: 8, amount: 8 });
    while (f.game().phase === 'auction') await f.take({ type: 'pass' });
    expect(f.game().bought).toContain(owner);
    while (f.game().phase === 'offer') await f.take({ type: 'pass' });
    while (f.game().actor !== owner) await f.take({ type: 'finish' });
    const index = f.acting();
    const secondPhone = await f.secondPhone(index);
    const before = f.view(index);
    const transfer = f.request(index, {
      type: 'transfer',
      resource: 'coal',
      fromPlantId: 5,
      toPlantId: 8,
    });
    const buy = f.request(index, {
      type: 'buy-resource',
      resource: 'coal',
      plantId: 8,
    });
    const purchaseRace = await Promise.all([
      f.send(f.phone(index), transfer),
      f.send(secondPhone, buy),
    ]);
    expect(purchaseRace.filter((reply) => reply.ok)).toHaveLength(1);
    expect(purchaseRace.find((reply) => !reply.ok)).toMatchObject({
      reason: 'stale-revision',
    });
    expect(f.view(index).revision).toBe(before.revision + 1);
    expect(f.game().actor).toBe(owner);
    expect(f.view(index).decisionId).not.toBe(before.decisionId);
    // Ensure there is exactly one unit in plant 8 for the next auction's
    // rearrangement, regardless of which command won this race.
    if (!purchaseRace[0]!.ok)
      await f.take({
        type: 'transfer',
        resource: 'coal',
        fromPlantId: 5,
        toPlantId: 8,
      });
    await f.take({ type: 'finish' });
    while (f.game().phase === 'building') await f.take({ type: 'finish' });
    while (f.game().phase === 'powering')
      await f.take({ type: 'finish', cities: 0 });
    expect(f.game().actor).toBe(owner);
    await f.take({ type: 'offer', plantId: 6, amount: 6 });
    await f.take({ type: 'bid', amount: 7 });
    while (f.game().actor !== owner) await f.take({ type: 'pass' });
    const beforeBid = f.view(index);
    const rearrange = f.request(index, {
      type: 'transfer',
      resource: 'coal',
      fromPlantId: 8,
      toPlantId: 5,
    });
    const bid = f.request(index, { type: 'bid', amount: 9 });
    const bidRace = await Promise.all([
      f.send(f.phone(index), rearrange),
      f.send(secondPhone, bid),
    ]);
    expect(bidRace.filter((reply) => reply.ok)).toHaveLength(1);
    expect(bidRace.find((reply) => !reply.ok)).toMatchObject({
      reason: 'stale-revision',
    });
    expect(f.view(index).revision).toBe(beforeBid.revision + 1);
    if (bidRace[0]!.ok) {
      expect(f.game().actor).toBe(owner);
      expect(f.game().auction!.amount).toBe(7);
      expect(f.view(index).decisionId).not.toBe(beforeBid.decisionId);
      await f.take({ type: 'bid', amount: 9 });
    }
    expect(f.game().auction!.highBidder).toBe(owner);
    expect(f.game().auction!.amount).toBe(9);
    expect(
      await f.send(f.phone(index), {
        ...rearrange,
        actionId: randomUUID(),
        revision: f.view().revision,
      }),
    ).toMatchObject({ ok: false, reason: 'stale-decision' });
    while (f.game().phase === 'auction') await f.take({ type: 'pass' });
    expect(f.game().bought.filter((seat) => seat === owner)).toHaveLength(1);
    expect(f.game().players[owner]!.plants.map((plant) => plant.id)).toEqual([
      5, 8, 6,
    ]);
  } finally {
    await f.close();
  }
}, 15000);
