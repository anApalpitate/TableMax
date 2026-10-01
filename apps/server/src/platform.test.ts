import { it, expect } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Command, CommandReply, RoomView } from '@tablemax/protocol';
import { createService } from './service';

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
    const revoked = new Promise<void>((resolve) =>
      player.once('room:revoked', () => resolve()),
    );
    const rebind = await command(host, {
      type: 'rebind',
      seatId: p.self.seatId!,
    });
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
    const code = rebind.ok ? rebind.bindingCode! : '';
    const redeemed = await service.app.inject({
      method: 'POST',
      url: '/api/session/redeem',
      payload: { code },
    });
    expect(redeemed.statusCode).toBe(200);
    expect(
      (
        await service.app.inject({
          method: 'POST',
          url: '/api/session/redeem',
          payload: { code },
        })
      ).statusCode,
    ).toBe(409);
    const rebound = await connect(origin, redeemed.json().token as string);
    clients.push(rebound);
    expect((await sync(rebound)).self.seatId).toBe(p.self.seatId);
    other.disconnect();
    await new Promise((r) => setTimeout(r, 20));
    expect((await sync(host)).seats[1]!.online).toBe(false);
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
