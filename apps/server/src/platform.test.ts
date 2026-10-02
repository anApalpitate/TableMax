import { it, expect } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import type { Command, CommandReply, RoomView } from '@tablemax/protocol';
import { createService as createServiceBase } from './service';
import { rules, bot } from '@tablemax/game-template';
const createService = (input: Parameters<typeof createServiceBase>[0]) =>
  createServiceBase(input, { rules, bot });

it('persists host-only play mode through real sockets and SQLite restart, with explicit normal-start override', async () => {
  const config = dirs();
  let service = await createService(config);
  const clients: Socket[] = [];
  try {
    const port = await service.listen();
    const origin = `http://127.0.0.1:${port}`;
    const hostClient = await connect(origin, service.hostToken);
    const publicClient = await connect(origin);
    const admission = await joinPlayer(service, '手机朋友');
    const phone = await connect(origin, admission.token);
    clients.push(hostClient, publicClient, phone);
    expect((await sync(hostClient)).playMode).toBe('play');
    for (const unauthorized of [publicClient, phone])
      expect(
        await command(unauthorized, { type: 'set-play-mode', mode: 'test' }),
      ).toEqual({ ok: false, reason: 'unauthorized' });
    const before = await sync(hostClient);
    expect(
      (await command(hostClient, { type: 'set-play-mode', mode: 'test' })).ok,
    ).toBe(true);
    const after = await sync(publicClient);
    expect(after.playMode).toBe('test');
    expect(after.revision).toBe(before.revision + 1);
    expect(after.gameView).toEqual(before.gameView);
    for (const client of clients) client.disconnect();
    await service.close();
    const database = new DatabaseSync(join(config.dataDir, 'room.sqlite'));
    try {
      const row = database.prepare('SELECT data FROM saves').get() as {
        data: string;
      };
      expect(JSON.parse(row.data).playMode).toBe('test');
    } finally {
      database.close();
    }
    service = await createService(config);
    expect(service.room.view().playMode).toBe('test');
    expect(service.room.view(admission.token).self.role).toBe('player');
    await service.close();
    service = await createService({ ...config, playMode: 'play' });
    expect(service.room.view().playMode).toBe('play');
    expect(service.room.view().seats).toHaveLength(1);
    expect(service.room.view(admission.token).self.role).toBe('player');
  } finally {
    for (const client of clients) client.disconnect();
    await service.close();
  }
});

it('admits and prepares six phone seats for the authorized variant and rejects a seventh without losing the room', async () => {
  const service = await createServiceBase(dirs());
  const tokens: string[] = [];
  try {
    const initial = service.room.view(service.hostToken);
    expect(initial.game).toBeNull();
    expect(
      (
        await service.room.command(service.hostToken, {
          actionId: 'select',
          instanceId: initial.instanceId,
          branch: initial.branch,
          revision: initial.revision,
          command: { type: 'select-game', gameId: 'pokemon-encounters' },
        })
      ).ok,
    ).toBe(true);
    for (let index = 0; index < 6; index++) {
      const response = await service.app.inject({
        method: 'POST',
        url: '/api/session/join',
        payload: { name: `手机玩家 ${index + 1}` },
      });
      expect(response.statusCode).toBe(200);
      tokens.push(response.json().token);
    }
    expect(service.room.view(service.hostToken).game!.max).toBe(6);
    expect(service.room.view().seats).toHaveLength(6);
    const overflow = await service.app.inject({
      method: 'POST',
      url: '/api/session/join',
      payload: { name: '第七位' },
    });
    expect(overflow.statusCode).toBe(409);
    expect(overflow.json().reason).toBe('room-full');
    const run = (credential: string, c: Command['command']) => {
      const view = service.room.view(credential);
      return service.room.command(credential, {
        actionId: crypto.randomUUID(),
        instanceId: view.instanceId,
        branch: view.branch,
        revision: view.revision,
        command: c,
      });
    };
    for (const credential of tokens)
      expect((await run(credential, { type: 'ready', ready: true })).ok).toBe(
        true,
      );
    expect((await run(service.hostToken, { type: 'start' })).ok).toBe(true);
    const publicGame = service.room.view().gameView as {
      deckCount: number;
      boards: Record<string, unknown[]>;
      phase: string;
    };
    expect(publicGame.deckCount).toBe(20);
    expect(Object.values(publicGame.boards)).toHaveLength(6);
    for (const credential of tokens) {
      const view = service.room.view(credential);
      expect(
        (
          await run(credential, {
            type: 'game',
            decisionId: view.decisionId!,
            action: { type: 'initial-flip', slot: 0 },
          })
        ).ok,
      ).toBe(true);
    }
    expect((service.room.view().gameView as { phase: string }).phase).toBe(
      'draw',
    );
    expect(service.room.view(service.hostToken).self).toEqual({
      role: 'host',
      seatId: null,
    });
    expect(service.room.view(service.hostToken).actions).toEqual([]);
  } finally {
    await service.close();
  }
});

const dirs = () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tablemax-platform-'));
  const webDir = mkdtempSync(join(tmpdir(), 'tablemax-web-'));
  writeFileSync(join(webDir, 'index.html'), '<html>local</html>');
  return { dataDir, webDir, host: '127.0.0.1', port: 0 };
};
async function connect(origin: string, token?: string) {
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: token ? { token } : {},
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('room:view', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}
async function sync(socket: Socket): Promise<RoomView> {
  return new Promise((resolve) => {
    socket.once('room:view', resolve);
    socket.emit('room:sync');
  });
}
async function command(
  socket: Socket,
  c: Command['command'],
  envelope?: Command,
): Promise<CommandReply> {
  const view = await sync(socket);
  const input = envelope ?? {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    branch: view.branch,
    revision: view.revision,
    command: c,
  };
  return new Promise((resolve, reject) =>
    socket
      .timeout(2000)
      .emit(
        'room:command',
        input,
        (error: Error | null, result: CommandReply) =>
          error ? reject(error) : resolve(result),
      ),
  );
}
async function joinPlayer(
  service: Awaited<ReturnType<typeof createService>>,
  name = '朋友',
) {
  const result = await service.app.inject({
    method: 'POST',
    url: '/api/session/join',
    payload: { name },
  });
  expect(result.statusCode).toBe(200);
  return result.json() as { token: string; duplicateName: boolean };
}

it('validates actual socket identities, personalized wire messages, duplicate ACKs and immediate revocation', async () => {
  const service = await createService(dirs());
  const port = await service.listen();
  const origin = `http://127.0.0.1:${port}`;
  const clients: Socket[] = [];
  try {
    const host = await connect(origin, service.hostToken);
    const publicClient = await connect(origin);
    clients.push(host, publicClient);
    const a = await joinPlayer(service);
    const b = await joinPlayer(service);
    expect(b.duplicateName).toBe(true);
    const player = await connect(origin, a.token);
    const other = await connect(origin, b.token);
    clients.push(player, other);
    expect((await sync(publicClient)).seats.every((s) => s.online)).toBe(true);
    expect(await command(player, { type: 'start' })).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
    expect(
      await command(publicClient, { type: 'add-bot', name: '越权' }),
    ).toEqual({ ok: false, reason: 'unauthorized' });
    await command(player, { type: 'ready', ready: true });
    await command(other, { type: 'ready', ready: true });
    await command(host, { type: 'start' });
    const p = await sync(player);
    const pub = await sync(publicClient);
    const h = await sync(host);
    expect(pub.gameView).toEqual(h.gameView);
    expect((pub.gameView as { ownSecret: null }).ownSecret).toBeNull();
    expect((p.gameView as { ownSecret: number }).ownSecret).toBeGreaterThan(0);
    expect((await sync(other)).actions).toEqual([]);
    const wire = JSON.stringify([p, pub, h]);
    for (const key of [
      'tokenHash',
      'before',
      'random',
      'secrets',
      a.token,
      service.hostToken,
    ])
      expect(wire).not.toContain(key);
    const input: Command = {
      actionId: crypto.randomUUID(),
      instanceId: p.instanceId,
      branch: p.branch,
      revision: p.revision,
      command: {
        type: 'game',
        decisionId: p.decisionId!,
        action: p.actions[0] as never,
      },
    };
    const first = await command(player, input.command, input);
    const duplicate = await command(player, input.command, input);
    expect(first).toEqual(duplicate);
    other.disconnect();
    await new Promise((r) => setTimeout(r, 20));
    expect((await sync(host)).seats[1]!.online).toBe(false);
    await command(host, { type: 'end' });
    const revoked = new Promise<void>((resolve) =>
      player.once('room:revoked', () => resolve()),
    );
    await command(host, { type: 'new-room' });
    await revoked;
    expect(
      (
        await service.app.inject({
          method: 'POST',
          url: '/api/session/view',
          payload: { token: a.token },
        })
      ).statusCode,
    ).toBe(401);
    const removed = await service.app.inject({
      method: 'POST',
      url: '/api/session/redeem',
      payload: { code: 'a'.repeat(64) },
    });
    expect(removed.statusCode).toBe(404);
  } finally {
    clients.forEach((c) => c.disconnect());
    await service.close();
  }
});

it('persists real SQLite state across restart, pauses restoration and rejects old branch messages', async () => {
  const config = dirs();
  let service = await createService(config);
  const a = await joinPlayer(service, '甲');
  const b = await joinPlayer(service, '乙');
  const run = async (credential: string, command: Command['command']) => {
    const v = service.room.view(credential);
    return service.room.command(credential, {
      actionId: crypto.randomUUID(),
      instanceId: v.instanceId,
      revision: v.revision,
      branch: v.branch,
      command,
    });
  };
  try {
    await run(a.token, { type: 'ready', ready: true });
    await run(b.token, { type: 'ready', ready: true });
    await run(service.hostToken, { type: 'start' });
    const v = service.room.view(a.token);
    const old = {
      actionId: 'old',
      instanceId: v.instanceId,
      revision: v.revision,
      branch: v.branch,
      command: {
        type: 'game',
        decisionId: v.decisionId!,
        action: v.actions[0] as never,
      },
    };
    expect((await service.room.command(a.token, old)).ok).toBe(true);
    const accepted = service.room.view(a.token).gameView;
    await service.close();
    service = await createService(config);
    expect(service.room.view(a.token).gameView).toEqual(accepted);
    expect(service.room.view().paused).toBe(true);
    expect(await service.room.command(a.token, old)).toEqual({
      ok: false,
      reason: 'stale-branch',
    });
    await run(service.hostToken, {
      type: 'rollback',
      checkpointId: service.room.view(service.hostToken).history[0]!.id,
    });
    expect(service.room.view(a.token).decisionId).toBe(v.decisionId);
  } finally {
    await service.close();
  }
});

it('preserves corrupted and incompatible save records rather than silently creating a new room', async () => {
  for (const mode of ['json', 'version', 'state']) {
    const config = dirs();
    const service = await createService(config);
    await joinPlayer(service);
    await service.close();
    const file = join(config.dataDir, 'room.sqlite');
    const db = new DatabaseSync(file);
    if (mode === 'version') db.exec('PRAGMA user_version=999');
    else if (mode === 'json')
      db.prepare('UPDATE saves SET data=?').run('{broken');
    else {
      const row = db.prepare('SELECT data FROM saves').get()!;
      const value = JSON.parse(String(row.data));
      value.seats[0].controller = 'impossible';
      db.prepare('UPDATE saves SET data=?').run(JSON.stringify(value));
    }
    db.close();
    const before = readFileSync(file);
    await expect(createService(config)).rejects.toThrow();
    expect(readFileSync(file)).toEqual(before);
  }
});

it('recovers actual HTTP admissions after lost replies and SQLite restart without publishing recovery secrets', async () => {
  const config = dirs();
  let service = await createService(config);
  const requestKey = randomBytes(32).toString('hex');
  const post = (url: string, payload: Record<string, string>) =>
    service.app.inject({ method: 'POST', url, payload });
  try {
    const first = (
      await post('/api/session/join', { name: '断网朋友', requestKey })
    ).json();
    expect(first.ok).toBe(true);
    const before = service.room.view(first.token);
    await service.close();
    service = await createService(config);
    expect(
      (
        await post('/api/session/join', { name: '断网朋友', requestKey })
      ).json(),
    ).toEqual(first);
    expect(service.room.view().seats).toHaveLength(1);
    expect(
      (await post('/api/session/join', { name: '改写名字', requestKey })).json()
        .reason,
    ).toBe('session-request-conflict');
    expect(
      (
        await post('/api/session/join', {
          name: '无效',
          requestKey: 'guessable',
        })
      ).statusCode,
    ).toBe(400);
    expect(service.room.view(first.token).self.seatId).toBe(before.self.seatId);
    expect(
      (await post('/api/session/redeem', { code: 'a'.repeat(64) })).statusCode,
    ).toBe(404);
    const wire = JSON.stringify(service.room.view());
    for (const value of [
      requestKey,
      first.token,
      'sealedCredential',
      'sessionReceipts',
      'bindings',
    ])
      expect(wire).not.toContain(value);
  } finally {
    await service.close();
  }
});
