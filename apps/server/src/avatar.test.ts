import { expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  RoomViewSchema,
  type Command,
  type CommandReply,
  type RoomView,
} from '@tablemax/protocol';
import { rules, bot } from '@tablemax/game-template';
import { createService } from './service';

function dirs() {
  const dataDir = mkdtempSync(join(tmpdir(), 'tablemax-avatar-data-'));
  const webDir = mkdtempSync(join(tmpdir(), 'tablemax-avatar-web-'));
  writeFileSync(
    join(webDir, 'index.html'),
    '<html>local avatar fixture</html>',
  );
  return { host: '127.0.0.1', port: 0, dataDir, webDir };
}
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
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('room sync timed out')),
      2000,
    );
    socket.once('room:view', (view) => {
      clearTimeout(timer);
      try {
        resolve(RoomViewSchema.parse(view));
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
async function send(socket: Socket, command: Command): Promise<CommandReply> {
  return new Promise((resolve, reject) =>
    socket
      .timeout(2000)
      .emit(
        'room:command',
        command,
        (error: Error | null, reply: CommandReply) =>
          error ? reject(error) : resolve(reply),
      ),
  );
}
async function admission(origin: string, body: unknown) {
  const response = await fetch(`${origin}/api/session/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as {
      ok: boolean;
      reason?: string;
      token?: string;
    },
  };
}

it('claims avatars through real HTTP and Socket.IO, broadcasts occupancy, and recovers lost replies with SQLite restart', async () => {
  const config = dirs();
  let service = await createService(config, { rules, bot });
  const sockets: Socket[] = [];
  try {
    const origin = `http://127.0.0.1:${await service.listen()}`;
    const publicClient = await connect(origin);
    const hostClient = await connect(origin, service.hostToken);
    sockets.push(publicClient, hostClient);
    const bodies = ['甲', '乙'].map((name) => ({
      name,
      avatarId: 'avatar-7',
      requestKey: randomBytes(32).toString('hex'),
    }));
    const raced = await Promise.all(
      bodies.map((body) => admission(origin, body)),
    );
    expect(raced.filter((reply) => reply.body.ok)).toHaveLength(1);
    expect(
      raced
        .filter((reply) => !reply.body.ok)
        .map((reply) => [reply.status, reply.body.reason]),
    ).toEqual([[409, 'avatar-unavailable']]);
    const winnerIndex = raced.findIndex((reply) => reply.body.ok);
    const winnerBody = bodies[winnerIndex]!;
    const winnerToken = raced[winnerIndex]!.body.token!;
    const other = await admission(origin, { name: '丙', avatarId: 'avatar-8' });
    expect(other.body.ok).toBe(true);
    const winner = await connect(origin, winnerToken);
    const second = await connect(origin, other.body.token!);
    sockets.push(winner, second);
    const before = await sync(publicClient);
    expect(before.seats.map((seat) => seat.avatarId)).toEqual([
      'avatar-7',
      'avatar-8',
    ]);
    const inputs = [winner, second].map(() =>
      envelope(before, { type: 'set-avatar', avatarId: 'avatar-9' }),
    );
    const replies = await Promise.all([
      send(winner, inputs[0]!),
      send(second, inputs[1]!),
    ]);
    expect(replies.filter((reply) => reply.ok)).toHaveLength(1);
    expect(replies.filter((reply) => !reply.ok)).toEqual([
      { ok: false, reason: 'avatar-unavailable' },
    ]);
    const changed = await sync(publicClient);
    expect(
      changed.seats.filter((seat) => seat.avatarId === 'avatar-9'),
    ).toHaveLength(1);
    for (const socket of [hostClient, winner, second])
      expect((await sync(socket)).seats).toEqual(changed.seats);
    const commandWinner = replies[0].ok ? winner : second;
    const acceptedInput = inputs[replies[0].ok ? 0 : 1]!;
    expect(await send(commandWinner, acceptedInput)).toEqual(
      replies.find((reply) => reply.ok),
    );
    expect(
      await send(
        hostClient,
        envelope(changed, { type: 'set-avatar', avatarId: 'avatar-26' }),
      ),
    ).toEqual({ ok: false, reason: 'unauthorized' });
    expect(
      await send(
        publicClient,
        envelope(changed, { type: 'set-avatar', avatarId: 'avatar-26' }),
      ),
    ).toEqual({ ok: false, reason: 'unauthorized' });
    expect(
      (await admission(origin, { name: '非法', avatarId: 'avatar-27' })).body
        .reason,
    ).toBe('invalid-avatar');
    expect(
      (await admission(origin, { ...winnerBody, avatarId: 'avatar-26' })).body
        .reason,
    ).toBe('session-request-conflict');
    for (const socket of sockets) socket.disconnect();
    expect(
      (await admission(origin, { name: '掉线也不释放', avatarId: 'avatar-9' }))
        .body.reason,
    ).toBe('avatar-unavailable');
    await service.close();
    service = await createService(config, { rules, bot });
    const restartedOrigin = `http://127.0.0.1:${await service.listen()}`;
    // Pretend the first admission's response never arrived; original request recovers the same identity even after an avatar change.
    const recovered = await admission(restartedOrigin, winnerBody);
    expect(recovered.body.token).toBe(winnerToken);
    expect(service.room.view(winnerToken).self.role).toBe('player');
    expect(
      service.room.view().seats.map((seat) => [seat.id, seat.avatarId]),
    ).toEqual(changed.seats.map((seat) => [seat.id, seat.avatarId]));
    const restoredSocket = await connect(restartedOrigin, winnerToken);
    sockets.push(restoredSocket);
    expect(
      (await sync(restoredSocket)).seats.map((seat) => seat.avatarId),
    ).toEqual(changed.seats.map((seat) => seat.avatarId));
  } finally {
    for (const socket of sockets) socket.disconnect();
    await service.close();
  }
});

it('persists a legacy-avatar migration at a fresh journal revision and refuses damaged explicit ownership', async () => {
  const config = dirs();
  let service = await createService(config, { rules, bot });
  const first = await service.room.join('甲');
  await service.room.join('乙');
  const oldRevision = service.room.view().revision;
  await service.close();
  const databasePath = join(config.dataDir, 'room.sqlite');
  const editSave = (
    edit: (value: { seats: { avatarId?: string }[]; revision: number }) => void,
  ) => {
    const database = new DatabaseSync(databasePath);
    try {
      const row = database
        .prepare('SELECT data FROM saves WHERE id=1')
        .get() as { data: string };
      const value = JSON.parse(row.data);
      edit(value);
      database
        .prepare('UPDATE saves SET data=? WHERE id=1')
        .run(JSON.stringify(value));
    } finally {
      database.close();
    }
  };
  editSave((value) => {
    for (const seat of value.seats) delete seat.avatarId;
  });
  service = await createService(config, { rules, bot });
  const migrated = service.room.view(first.token);
  expect(migrated.self.role).toBe('player');
  expect(migrated.revision).toBe(oldRevision + 1);
  expect(new Set(migrated.seats.map((seat) => seat.avatarId)).size).toBe(2);
  await service.close();
  service = await createService(config, { rules, bot });
  expect(service.room.view().revision).toBe(migrated.revision);
  expect(service.room.view().seats.map((seat) => seat.avatarId)).toEqual(
    migrated.seats.map((seat) => seat.avatarId),
  );
  await service.close();
  editSave((value) => {
    value.seats[1]!.avatarId = value.seats[0]!.avatarId!;
  });
  await expect(createService(config, { rules, bot })).rejects.toThrow(
    'damaged-save',
  );
});
