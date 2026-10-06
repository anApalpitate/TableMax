import { afterEach, expect, it, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readCurrentSave } from './save-audit';
import { randomUUID } from 'node:crypto';
import {
  RoomViewSchema,
  type RoomView,
  type Command,
  type CommandReply,
} from '@tablemax/protocol';
import type { Save } from '@tablemax/platform-core';
import { rules, bot } from '@tablemax/game-template';
import { createService } from './service';
import { SqliteSaveRepository } from './save-repository';
import { safeHttpPort } from '../../../scripts/fixtures/safe-http-port';

afterEach(() => vi.restoreAllMocks());
function dirs() {
  const parent = join(process.cwd(), 'tmp');
  mkdirSync(parent, { recursive: true });
  const workDir = mkdtempSync(join(parent, 'countdown-crosslayer-'));
  const dataDir = join(workDir, 'data');
  const webDir = join(workDir, 'web');
  mkdirSync(dataDir);
  mkdirSync(webDir);
  writeFileSync(
    join(webDir, 'index.html'),
    '<html>countdown test fixture</html>',
  );
  return { host: '127.0.0.1', port: 0, dataDir, webDir };
}
async function connect(origin: string, credential?: string) {
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: credential ? { token: credential } : {},
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('room:view', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}
async function sync(socket: Socket): Promise<RoomView> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('room sync timeout')),
      2000,
    );
    socket.once('room:view', (value: unknown) => {
      clearTimeout(timeout);
      try {
        resolve(RoomViewSchema.parse(value));
      } catch (error) {
        reject(error);
      }
    });
    socket.emit('room:sync');
  });
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
async function command(socket: Socket, value: Command): Promise<CommandReply> {
  return new Promise((resolve, reject) =>
    socket
      .timeout(2000)
      .emit(
        'room:command',
        value,
        (error: Error | null, reply: CommandReply) =>
          error ? reject(error) : resolve(reply),
      ),
  );
}
async function send(socket: Socket, value: Command['command']) {
  return command(socket, envelope(await sync(socket), value));
}
async function admission(origin: string, name: string): Promise<string> {
  const reply = await fetch(`${origin}/api/session/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  expect(reply.status).toBe(200);
  return ((await reply.json()) as { token: string }).token;
}
function readSave(dataDir: string) {
  const database = new DatabaseSync(join(dataDir, 'room.sqlite'), {
    readOnly: true,
  });
  try {
    const count = database
      .prepare('SELECT COUNT(*) AS count FROM journal')
      .get() as { count: number };
    return { value: readCurrentSave(database) as Save, count: count.count };
  } finally {
    database.close();
  }
}

it('synchronizes HTTP players and Socket.IO viewers from saved platform timing; tests owner permissions, failed SQLite transactions and paused restart', async () => {
  let now = 1_900_000_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const config = dirs();
  config.port = await safeHttpPort();
  let service = await createService(config, { rules, bot });
  const sockets: Socket[] = [];
  try {
    let origin = `http://127.0.0.1:${await service.listen()}`;
    const tokens = [
      await admission(origin, '甲'),
      await admission(origin, '乙'),
    ];
    const host = await connect(origin, service.hostToken);
    const publicClient = await connect(origin);
    const a = await connect(origin, tokens[0]);
    const b = await connect(origin, tokens[1]);
    sockets.push(host, publicClient, a, b);
    expect((await sync(host)).countdownSeconds).toBe(20);
    const seat = (await sync(a)).self.seatId;
    expect((await send(host, { type: 'set-owner', seatId: seat })).ok).toBe(
      true,
    );
    for (const unauthorized of [publicClient, a, b])
      expect(
        await send(unauthorized, { type: 'set-countdown', seconds: 5 }),
      ).toEqual({ ok: false, reason: 'unauthorized' });
    expect((await send(host, { type: 'set-countdown', seconds: 120 })).ok).toBe(
      true,
    );
    expect((await sync(a)).countdownSeconds).toBe(120);
    expect((await send(host, { type: 'set-countdown', seconds: 5 })).ok).toBe(
      true,
    );
    expect((await send(a, { type: 'ready', ready: true })).ok).toBe(true);
    expect((await send(b, { type: 'ready', ready: true })).ok).toBe(true);
    expect((await send(a, { type: 'start' })).ok).toBe(true);
    const baseline = (await sync(a)).decisionClock!;
    expect((await sync(host)).decisionClock).toEqual(baseline);
    expect((await sync(publicClient)).decisionClock).toEqual(baseline);
    expect((await sync(b)).decisionClock).toBeNull();
    const writes = readSave(config.dataDir).count;
    now += 2_000;
    for (let i = 0; i < 3; i++)
      expect((await sync(a)).decisionClock!.remainingMs).toBe(3_000);
    expect(readSave(config.dataDir).count).toBe(writes);
    expect((await send(a, { type: 'pause' })).ok).toBe(true);
    now += 100_000;
    expect((await sync(publicClient)).decisionClock).toMatchObject({
      id: baseline.id,
      remainingMs: 3_000,
      running: false,
    });
    expect((await send(a, { type: 'resume' })).ok).toBe(true);
    const before = readSave(config.dataDir);
    const failedRequest = envelope(await sync(host), {
      type: 'set-countdown',
      seconds: 120,
    });
    const fail = vi
      .spyOn(SqliteSaveRepository.prototype, 'save')
      .mockImplementationOnce(() => {
        throw new Error('disk full fixture');
      });
    expect(await command(host, failedRequest)).toEqual({
      ok: false,
      reason: 'save-or-action-failed',
    });
    fail.mockRestore();
    expect(readSave(config.dataDir)).toEqual(before);
    expect((await sync(publicClient)).countdownSeconds).toBe(5);
    expect((await sync(a)).decisionClock).toMatchObject({
      id: baseline.id,
      remainingMs: 3_000,
    });
    for (const socket of sockets) socket.disconnect();
    await service.close();
    now += 24 * 60 * 60 * 1000;
    service = await createService(config, { rules, bot });
    origin = `http://127.0.0.1:${await service.listen()}`;
    const restoredHost = await connect(origin, service.hostToken);
    const restoredPlayer = await connect(origin, tokens[0]);
    sockets.push(restoredHost, restoredPlayer);
    const restored = await sync(restoredPlayer);
    expect(restored.self.seatId).toBe(seat);
    expect(restored.paused).toBe(true);
    expect(restored.countdownSeconds).toBe(5);
    expect(restored.decisionClock).toMatchObject({
      id: baseline.id,
      remainingMs: 3_000,
      running: false,
    });
    expect(readSave(config.dataDir).value.decisionClocks![0]!.remainingMs).toBe(
      3_000,
    );
    expect((await send(restoredPlayer, { type: 'resume' })).ok).toBe(true);
    now += 10_000;
    const elapsed = await sync(restoredPlayer);
    expect(elapsed.decisionClock!.remainingMs).toBe(0);
    expect(elapsed.actions).toHaveLength(3);
    expect(
      (
        await send(restoredPlayer, {
          type: 'game',
          decisionId: elapsed.decisionId!,
          action: { type: 'choose', value: 1 },
        })
      ).ok,
    ).toBe(true);
    expect(service.room.view(tokens[1]).decisionClock!.remainingMs).toBe(5_000);
  } finally {
    for (const socket of sockets) socket.disconnect();
    await service.close();
  }
});

it('migrates an old SQLite save to default 20 exactly once and protects explicitly corrupt timing', async () => {
  const config = dirs();
  let service = await createService(config, { rules, bot });
  const player = await service.room.join('原玩家');
  const revision = service.room.view().revision;
  await service.close();
  const edit = (change: (value: Save) => void) => {
    const database = new DatabaseSync(join(config.dataDir, 'room.sqlite'));
    try {
      const value = readCurrentSave(database) as Save;
      change(value);
      database
        .prepare('UPDATE saves SET data=? WHERE id=1')
        .run(JSON.stringify(value));
    } finally {
      database.close();
    }
  };
  edit((value) => {
    delete value.countdownSeconds;
    delete value.decisionClocks;
  });
  try {
    service = await createService(config, { rules, bot });
    expect(service.room.view(player.token).self.role).toBe('player');
    expect(service.room.view().countdownSeconds).toBe(20);
    expect(service.room.view().revision).toBe(revision + 1);
    expect(readSave(config.dataDir).value.countdownSeconds).toBe(20);
    await service.close();
    service = await createService(config, { rules, bot });
    expect(service.room.view().revision).toBe(revision + 1);
    await service.close();
    edit((value) => {
      value.countdownSeconds = 6;
    });
    const invalid = readSave(config.dataDir);
    await expect(createService(config, { rules, bot })).rejects.toThrow(
      'damaged-save',
    );
    expect(readSave(config.dataDir)).toEqual(invalid);
  } finally {
    await service.close();
  }
});
