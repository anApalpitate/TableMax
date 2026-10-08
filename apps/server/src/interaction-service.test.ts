import { expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rules, bot } from '@tablemax/game-template';
import {
  type InteractionEvent,
  type InteractionReply,
} from '@tablemax/protocol';
import { createService } from './service';

for (const transport of ['polling', 'websocket']) {
  it(`broadcasts only live accepted interactions over ${transport}, preserving the room revision and checkpoint`, async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'interaction-service-data-'));
    const webDir = mkdtempSync(join(tmpdir(), 'interaction-service-web-'));
    writeFileSync(
      join(webDir, 'index.html'),
      '<html>interaction fixture</html>',
    );
    const service = await createService(
      { host: '127.0.0.1', port: 0, webDir, dataDir },
      { rules, bot },
    );
    const sockets: Socket[] = [];
    const connect = async (origin: string, token?: string) => {
      const socket = io(origin, {
        transports: [transport],
        forceNew: true,
        auth: token ? { token } : {},
      });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once('room:view', () => resolve());
        socket.once('connect_error', reject);
      });
      return socket;
    };
    try {
      const origin = `http://127.0.0.1:${await service.listen()}`;
      const a = await service.room.join('甲');
      const b = await service.room.join('乙');
      const players = [
        await connect(origin, a.token),
        await connect(origin, b.token),
      ];
      const host = await connect(origin, service.hostToken),
        publicScreen = await connect(origin);
      const before = JSON.stringify(service.room.view());
      const events = [players[0]!, players[1]!, host, publicScreen].map(
        (socket) =>
          new Promise<InteractionEvent>((resolve) =>
            socket.once('room:interaction', resolve),
          ),
      );
      const request = {
        ...service.room.interactionContext(),
        requestId: 'a'.repeat(32),
        interaction: {
          type: 'shot',
          effectId: 'egg',
          point: { x: 0.2, y: 0.7 },
        },
      };
      const send = (socket: Socket, data: unknown) =>
        new Promise<InteractionReply>((resolve, reject) =>
          socket
            .timeout(2000)
            .emit(
              'room:interaction:send',
              data,
              (error: Error | null, reply: InteractionReply) =>
                error ? reject(error) : resolve(reply),
            ),
        );
      const reply = await send(players[0]!, request);
      expect(reply.ok).toBe(true);
      const received = await Promise.all(events);
      expect(new Set(received.map((e) => e.eventId)).size).toBe(1);
      expect(received[0]!.actorSeatId).toBe(
        service.room.view(a.token).self.seatId,
      );
      expect(JSON.stringify(service.room.view())).toBe(before);
      expect(await send(host, request)).toEqual({
        ok: false,
        reason: 'unauthorized',
      });
      expect(await send(publicScreen, request)).toEqual({
        ok: false,
        reason: 'unauthorized',
      });
      expect(await send(players[0]!, request)).toEqual(reply);
      const refreshed = await connect(origin, b.token);
      let replayed = false;
      refreshed.on('room:interaction', () => {
        replayed = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(replayed).toBe(false);
    } finally {
      sockets.forEach((socket) => socket.disconnect());
      await service.close();
    }
  });
}
