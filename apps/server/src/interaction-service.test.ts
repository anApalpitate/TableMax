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

function nextInteraction(socket: Socket) {
  return new Promise<InteractionEvent>((resolve, reject) => {
    const receive = (event: InteractionEvent) => {
      clearTimeout(timeout);
      resolve(event);
    };
    const timeout = setTimeout(() => {
      socket.off('room:interaction', receive);
      reject(new Error('New interaction waited for the old effect to finish'));
    }, 1500);
    socket.once('room:interaction', receive);
  });
}

for (const transport of ['polling', 'websocket']) {
  it(`immediately replaces live mixed interactions over ${transport} without replay or game state changes`, async () => {
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
      const recipients = [players[0]!, players[1]!, host, publicScreen];
      const deliveries = recipients.map((socket) => {
        const events: InteractionEvent[] = [];
        socket.on('room:interaction', (event: InteractionEvent) =>
          events.push(event),
        );
        return events;
      });
      const before = JSON.stringify(service.room.view(service.hostToken));
      const events = recipients.map(nextInteraction);
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
      expect(JSON.stringify(service.room.view(service.hostToken))).toBe(before);
      expect(await send(host, request)).toEqual({
        ok: false,
        reason: 'unauthorized',
      });
      expect(await send(publicScreen, request)).toEqual({
        ok: false,
        reason: 'unauthorized',
      });
      expect(await send(players[0]!, request)).toEqual(reply);
      const liveEventIds = [received[0]!.eventId];
      for (let id = 1; id <= 6; id++) {
        const input = {
          ...request,
          requestId: id.toString(16).padStart(32, '0'),
          interaction:
            id % 2
              ? { type: 'speech', phraseId: 'nice' }
              : { type: 'shot', effectId: 'tomato', point: { x: 0.9, y: 0.1 } },
        };
        const published = recipients.map(nextInteraction);
        const result = await send(players[id % 2]!, input);
        expect(result.ok).toBe(true);
        const replacement = await Promise.all(published);
        expect(new Set(replacement.map((event) => event.eventId)).size).toBe(1);
        expect(replacement[0]).toMatchObject(input);
        liveEventIds.push(replacement[0]!.eventId);
        // An older retry must not interrupt the replacement at any recipient.
        expect(await send(players[0]!, request)).toEqual(reply);
      }
      expect(new Set(liveEventIds).size).toBe(7);
      for (const delivery of deliveries)
        expect(delivery.map((event) => event.eventId)).toEqual(liveEventIds);
      expect(JSON.stringify(service.room.view(service.hostToken))).toBe(before);
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
