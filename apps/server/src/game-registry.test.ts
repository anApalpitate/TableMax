import { expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import {
  CommandReplySchema,
  RoomViewSchema,
  type Command,
  type RoomView,
} from '@tablemax/protocol';
import { createGameRegistry } from './game-registry';
import { createService } from './service';

it('exposes independent production games and keeps the template internal', async () => {
  expect(
    createGameRegistry()
      .catalog()
      .map((entry) => entry.id),
  ).toEqual(['pokemon-encounters', 'modern-art', 'power-grid']);
  const internal = createGameRegistry(true);
  expect(internal.catalog()).toHaveLength(4);
  expect((await internal.load('power-grid')).rules.manifest.id).toBe(
    'power-grid',
  );
  expect((await internal.load('modern-art')).rules.manifest.id).toBe(
    'modern-art',
  );
  expect((await internal.load('template')).rules.manifest.id).toBe('template');
});

it('persists lazy selection and accepts six real sockets submitting from the same snapshot', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tablemax-selection-'));
  const webDir = mkdtempSync(join(tmpdir(), 'tablemax-selection-web-'));
  writeFileSync(join(webDir, 'index.html'), '<html>local</html>');
  const config = { dataDir, webDir, host: '127.0.0.1', port: 0 };
  let service = await createService(config);
  const clients: Socket[] = [];
  try {
    const port = await service.listen(),
      origin = `http://127.0.0.1:${port}`;
    const connect = async (token?: string) => {
      const socket = io(origin, {
        auth: token ? { token } : {},
        transports: ['websocket'],
        forceNew: true,
      });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once('room:view', () => resolve());
        socket.once('connect_error', reject);
      });
      return socket;
    };
    const send = (
      socket: Socket,
      view: RoomView,
      command: Command['command'],
    ) =>
      new Promise<ReturnType<typeof CommandReplySchema.parse>>(
        (resolve, reject) => {
          socket.timeout(3000).emit(
            'room:command',
            {
              actionId: crypto.randomUUID(),
              instanceId: view.instanceId,
              revision: view.revision,
              branch: view.branch,
              command,
            },
            (error: Error | null, reply: unknown) =>
              error ? reject(error) : resolve(CommandReplySchema.parse(reply)),
          );
        },
      );
    const host = await connect(service.hostToken);
    const empty = RoomViewSchema.parse(service.room.view(service.hostToken));
    expect(empty.game).toBeNull();
    expect(empty.catalog).toHaveLength(3);
    expect(
      (
        await send(host, empty, {
          type: 'select-game',
          gameId: 'pokemon-encounters',
        })
      ).ok,
    ).toBe(true);
    const tokens: string[] = [];
    for (let n = 0; n < 6; n++) {
      const admission = await service.app.inject({
        method: 'POST',
        url: '/api/session/join',
        payload: { name: `手机${n}` },
      });
      expect(admission.statusCode).toBe(200);
      tokens.push(admission.json().token);
    }
    const phones = await Promise.all(tokens.map(connect));
    const ready = tokens.map((token) => service.room.view(token));
    expect(new Set(ready.map((view) => view.revision)).size).toBe(1);
    const replies = await Promise.all(
      phones.map((phone, i) =>
        send(phone, ready[i]!, { type: 'ready', ready: true }),
      ),
    );
    expect(replies.every((reply) => reply.ok)).toBe(true);
    expect(
      (
        await send(host, service.room.view(service.hostToken), {
          type: 'start',
        })
      ).ok,
    ).toBe(true);
    const pending = tokens.map((token) => service.room.view(token));
    const flipped = await Promise.all(
      phones.map((phone, i) =>
        send(phone, pending[i]!, {
          type: 'game',
          decisionId: pending[i]!.decisionId!,
          action: { type: 'initial-flip', slot: i },
        }),
      ),
    );
    expect(flipped.every((reply) => reply.ok)).toBe(true);
    expect(service.room.view(service.hostToken).history).toHaveLength(6);
    const saved = service.room.view(tokens[0]);
    for (const client of clients) client.disconnect();
    await service.close();
    service = await createService(config);
    expect(service.room.view(tokens[0]).game!.id).toBe('pokemon-encounters');
    expect(service.room.view(tokens[0]).gameView).toEqual(saved.gameView);
    expect(service.room.view().paused).toBe(true);
  } finally {
    for (const client of clients) client.disconnect();
    await service.close();
  }
});
