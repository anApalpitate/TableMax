import { expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { RandomSource } from '@tablemax/platform-core/random';
import type { Command, CommandReply, RoomView } from '@tablemax/protocol';
import type { JsonValue } from '@tablemax/game-sdk';
import { rules, bot } from '../../../games/rummikub';
import { findLegalPlay } from '../../../games/rummikub/shared/turn';
import type { Action, RummikubView } from '../../../games/rummikub/types';
import { createService } from './service';
import { SqliteSaveRepository } from './save-repository';

function request(view: RoomView, command: Command['command']): Command {
  return {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  };
}
function game(view: RoomView): RummikubView {
  return view.gameView as RummikubView;
}
function nextAction(view: RummikubView): Action {
  const self = view.self!;
  const result = findLegalPlay({
    rack: self.rack.map((t) => t.id),
    table: view.table,
    opened: self.opened,
  });
  if (result.action) return result.action;
  if (view.poolCount) return { type: 'draw' };
  expect(result.complete).toBe(true);
  return { type: 'pass' };
}
async function fixture(seed = 11) {
  mkdirSync(resolve('tmp'), { recursive: true });
  const base = mkdtempSync(resolve('tmp/rummikub-service-'));
  const dataDir = join(base, 'data'),
    webDir = join(base, 'web');
  mkdirSync(webDir);
  writeFileSync(join(webDir, 'index.html'), '<html>local</html>');
  const config = { dataDir, webDir, host: '127.0.0.1', port: 0 };
  const selectedRules = {
    ...rules,
    initialize: (context: Parameters<typeof rules.initialize>[0]) =>
      rules.initialize({ ...context, random: new RandomSource(seed) }),
  };
  let service = await createService(config, { rules: selectedRules, bot });
  let clients: Socket[] = [];
  let port = await service.listen();
  const projections: { credential: string | undefined; view: RoomView }[] = [];
  const connect = async (credential?: string) => {
    const socket = io(`http://127.0.0.1:${port}`, {
      forceNew: true,
      transports: ['websocket'],
      auth: credential ? { token: credential } : {},
    });
    clients.push(socket);
    socket.on('room:view', (input: { view: RoomView }) =>
      projections.push({ credential, view: input.view }),
    );
    await new Promise<void>((done, reject) => {
      socket.once('room:view', () => done());
      socket.once('connect_error', reject);
    });
    return socket;
  };
  const send = (socket: Socket, envelope: Command) =>
    new Promise<CommandReply>((done, reject) => {
      socket
        .timeout(5000)
        .emit(
          'room:command',
          envelope,
          (error: Error | null, reply: CommandReply) =>
            error ? reject(error) : done(reply),
        );
    });
  const run = (
    credential: string,
    socket: Socket,
    command: Command['command'],
  ) => send(socket, request(service.room.view(credential), command));
  let host = await connect(service.hostToken);
  const observer = await connect();
  const tokens: string[] = [],
    players: Socket[] = [];
  for (const name of ['拉密甲', '拉密乙']) {
    const response = await service.app.inject({
      method: 'POST',
      url: '/api/session/join',
      payload: { name },
    });
    expect(response.statusCode).toBe(200);
    const token: string = response.json().token;
    tokens.push(token);
    players.push(await connect(token));
    expect(
      (await run(token, players.at(-1)!, { type: 'ready', ready: true })).ok,
    ).toBe(true);
  }
  expect((await run(service.hostToken, host, { type: 'start' })).ok).toBe(true);
  const actor = () => {
    const seat = game(service.room.view()).turnSeat;
    const index = tokens.findIndex(
      (token) => service.room.view(token).self.seatId === seat,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    return { token: tokens[index]!, socket: players[index]!, index };
  };
  const close = async () => {
    clients.forEach((socket) => socket.disconnect());
    clients = [];
    await service.close();
  };
  const restart = async () => {
    await close();
    service = await createService(config, { rules: selectedRules, bot });
    port = await service.listen();
    host = await connect(service.hostToken);
    for (let i = 0; i < tokens.length; i++)
      players[i] = await connect(tokens[i]!);
  };
  return {
    get service() {
      return service;
    },
    get host() {
      return host;
    },
    observer,
    tokens,
    players,
    projections,
    actor,
    run,
    send,
    connect,
    close,
    restart,
  };
}

it('keeps racks private and commits complete turns once through sockets, failed saves, rollback and durable restart', async () => {
  const f = await fixture();
  try {
    for (const credential of [undefined, f.service.hostToken]) {
      const publicView = game(f.service.room.view(credential));
      expect(publicView.self).toBeNull();
      expect(publicView.table).toEqual([]);
      expect(Object.values(publicView.players).map((p) => p.rackCount)).toEqual(
        [14, 14],
      );
    }
    const privateIds = f.tokens.flatMap((token) =>
      game(f.service.room.view(token)).self!.rack.map((t) => t.id),
    );
    for (const id of privateIds)
      expect(JSON.stringify(f.service.room.view())).not.toContain(id);
    const a = f.actor(),
      before = f.service.room.view(a.token),
      action = nextAction(game(before));
    const other = f.tokens[1 - a.index]!;
    const illegal = request(f.service.room.view(other), {
      type: 'game',
      decisionId: before.decisionId!,
      action: action as JsonValue,
    });
    expect((await f.send(f.players[1 - a.index]!, illegal)).ok).toBe(false);
    expect(f.service.room.view(a.token).revision).toBe(before.revision);
    const command = request(before, {
      type: 'game',
      decisionId: before.decisionId!,
      action: action as JsonValue,
    });
    const originalSave = SqliteSaveRepository.prototype.save;
    const saveSpy = vi
      .spyOn(SqliteSaveRepository.prototype, 'save')
      .mockImplementationOnce(() => {
        throw new Error('simulated disk-full');
      });
    expect((await f.send(a.socket, command)).ok).toBe(false);
    expect(f.service.room.view(a.token).revision).toBe(before.revision);
    expect(game(f.service.room.view(a.token))).toEqual(game(before));
    saveSpy.mockImplementation(originalSave);
    expect((await f.send(a.socket, command)).ok).toBe(true);
    const saved = f.service.room.view(a.token),
      safeTable = structuredClone(game(saved).table);
    expect((await f.send(a.socket, command)).ok).toBe(true);
    expect(f.service.room.view(a.token).revision).toBe(saved.revision);
    saveSpy.mockRestore();
    const checkpoint = f.service.room.view(f.service.hostToken).history.at(-1)!;
    expect(
      (
        await f.run(f.service.hostToken, f.host, {
          type: 'rollback',
          checkpointId: checkpoint.id,
        })
      ).ok,
    ).toBe(true);
    expect(f.service.room.view(a.token).paused).toBe(true);
    expect(game(f.service.room.view(a.token))).toEqual(game(before));
    expect((await f.send(a.socket, command)).ok).toBe(false);
    expect(
      (await f.run(f.service.hostToken, f.host, { type: 'resume' })).ok,
    ).toBe(true);
    expect(
      (
        await f.run(a.token, a.socket, {
          type: 'game',
          decisionId: f.service.room.view(a.token).decisionId!,
          action: action as JsonValue,
        })
      ).ok,
    ).toBe(true);
    expect(game(f.service.room.view()).table).toEqual(safeTable);
    const durable = structuredClone(game(f.service.room.view(a.token))),
      branch = f.service.room.view(a.token).branch;
    await f.restart();
    expect(f.service.room.view(a.token).paused).toBe(true);
    expect(f.service.room.view(a.token).branch).toBeGreaterThan(branch);
    expect(game(f.service.room.view(a.token))).toEqual(durable);
    expect(game(f.service.room.view(f.service.hostToken)).self).toBeNull();
    expect(
      (await f.run(f.service.hostToken, f.host, { type: 'resume' })).ok,
    ).toBe(true);
    let played = action.type === 'submit-turn';
    for (let step = 0; step < 120 && !played; step++) {
      const current = f.actor(),
        view = f.service.room.view(current.token),
        move = nextAction(game(view));
      expect(
        (
          await f.run(current.token, current.socket, {
            type: 'game',
            decisionId: view.decisionId!,
            action: move as JsonValue,
          })
        ).ok,
      ).toBe(true);
      played = move.type === 'submit-turn';
    }
    expect(played).toBe(true);
    const visibleIds = new Set(
      game(f.service.room.view()).table.flatMap((m) =>
        m.tiles.map((t) => t.tileId),
      ),
    );
    for (const token of f.tokens) {
      const own = game(f.service.room.view(token)).self!;
      for (const tile of own.rack)
        if (!visibleIds.has(tile.id))
          expect(JSON.stringify(f.service.room.view())).not.toContain(tile.id);
    }
    expect(
      f.projections.some((p) => p.credential === undefined && p.view?.gameView),
    ).toBe(true);
  } finally {
    vi.restoreAllMocks();
    await f.close();
  }
}, 60000);

it('confirms a saved turn after reconnection and revokes an approved old device across rollback', async () => {
  const f = await fixture(57);
  try {
    const actor = f.actor(),
      before = f.service.room.view(actor.token);
    const envelope = request(before, {
      type: 'game',
      decisionId: before.decisionId!,
      action: nextAction(game(before)) as JsonValue,
    });
    // The reconnecting client has no retained acknowledgement and asks the
    // authoritative receipt endpoint instead of guessing or replaying a turn.
    expect((await f.send(actor.socket, envelope)).ok).toBe(true);
    actor.socket.disconnect();
    const reconnected = await f.connect(actor.token);
    const confirmed = await reconnected
      .timeout(5000)
      .emitWithAck('room:command:status', envelope);
    expect(confirmed).toMatchObject({
      ok: true,
      outcome: { status: 'completed', reply: { ok: true } },
    });
    expect(confirmed.view.revision).toBe(before.revision + 1);
    const other = f.players[1 - actor.index]!;
    expect(
      await other.timeout(5000).emitWithAck('room:command:status', envelope),
    ).toMatchObject({ ok: true, outcome: { status: 'unknown' } });
    const checkpoint = f.service.room.view(f.service.hostToken).history.at(-1)!;
    const own = game(f.service.room.view(actor.token));
    const seatId = f.service.room.view(actor.token).self.seatId!;
    const requestKey =
      crypto.randomUUID().replaceAll('-', '') +
      crypto.randomUUID().replaceAll('-', '');
    const pendingResponse = await f.service.app.inject({
      method: 'POST',
      url: '/api/session/transfer/request',
      payload: { seatId, requestKey },
    });
    expect(pendingResponse.statusCode).toBe(200);
    const pending = pendingResponse.json().transfer;
    expect(pending.status).toBe('pending');
    expect(pending).not.toHaveProperty('token');
    expect(
      (
        await f.run(actor.token, reconnected, {
          type: 'approve-transfer',
          requestId: pending.requestId,
        })
      ).ok,
    ).toBe(false);
    const revoked = new Promise<void>((done) =>
      reconnected.once('disconnect', () => done()),
    );
    expect(
      (
        await f.run(f.service.hostToken, f.host, {
          type: 'approve-transfer',
          requestId: pending.requestId,
        })
      ).ok,
    ).toBe(true);
    await revoked;
    const statusResponse = await f.service.app.inject({
      method: 'POST',
      url: '/api/session/transfer/status',
      payload: { requestKey },
    });
    const approved = statusResponse.json().transfer;
    expect(approved.status).toBe('approved');
    expect(approved.token).not.toBe(actor.token);
    const newPhone = await f.connect(approved.token);
    expect(f.service.room.view(approved.token).self.seatId).toBe(seatId);
    expect(game(f.service.room.view(approved.token))).toEqual(own);
    expect(() => f.service.room.view(actor.token)).toThrow();
    expect(
      (
        await f.run(f.service.hostToken, f.host, {
          type: 'rollback',
          checkpointId: checkpoint.id,
        })
      ).ok,
    ).toBe(true);
    expect(f.service.room.view(approved.token).self.seatId).toBe(seatId);
    expect(game(f.service.room.view(approved.token))).toEqual(game(before));
    expect(() => f.service.room.view(actor.token)).toThrow();
    const oldResponse = await f.service.app.inject({
      method: 'POST',
      url: '/api/session/view',
      payload: { token: actor.token },
    });
    expect(oldResponse.statusCode).toBe(401);
    expect((await f.run(approved.token, newPhone, { type: 'resume' })).ok).toBe(
      false,
    );
    expect(
      (await f.run(f.service.hostToken, f.host, { type: 'resume' })).ok,
    ).toBe(true);
  } finally {
    await f.close();
  }
}, 30000);
