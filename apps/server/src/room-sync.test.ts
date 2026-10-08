import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import {
  CommandReplySchema,
  InteractionEventSchema,
  InteractionReplySchema,
  RoomProjectionSchema,
  RoomSyncReplySchema,
  RoomProbeReplySchema,
  RoomCommandStatusReplySchema,
  type Command,
  type RoomProjection,
} from '@tablemax/protocol';
import { rules, bot } from '@tablemax/game-template';
import { createService } from './service';
import { SqliteSaveRepository } from './save-repository';

afterEach(() => vi.restoreAllMocks());
function next<T>(socket: Socket, name: string, parse: (value: unknown) => T) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(name, receive);
      reject(new Error(`Missing ${name}`));
    }, 2000);
    function receive(value: unknown) {
      clearTimeout(timeout);
      socket.off(name, receive);
      try {
        resolve(parse(value));
      } catch (error) {
        reject(error);
      }
    }
    socket.on(name, receive);
  });
}
async function sync(socket: Socket): Promise<RoomProjection> {
  const result = RoomSyncReplySchema.parse(
    await socket.timeout(2000).emitWithAck('room:sync'),
  );
  if (!result.ok) throw new Error(result.reason);
  return result;
}
function envelope(
  projection: RoomProjection,
  command: Command['command'],
): Command {
  return {
    actionId: randomUUID(),
    instanceId: projection.view.instanceId,
    branch: projection.view.branch,
    revision: projection.view.revision,
    command,
  };
}
async function fixture(transport: 'polling' | 'websocket') {
  const dataDir = mkdtempSync(join(tmpdir(), 'room-sync-data-'));
  const webDir = mkdtempSync(join(tmpdir(), 'room-sync-web-'));
  writeFileSync(join(webDir, 'index.html'), '<html>room sync fixture</html>');
  const service = await createService(
    { host: '127.0.0.1', port: 0, dataDir, webDir },
    { rules, bot },
  );
  const origin = `http://127.0.0.1:${await service.listen()}`;
  const clients: Socket[] = [];
  const connect = async (credential?: string) => {
    const socket = io(origin, {
      transports: [transport],
      upgrade: false,
      reconnection: false,
      forceNew: true,
      autoConnect: false,
      auth: credential ? { token: credential } : {},
    });
    clients.push(socket);
    const initial = next(socket, 'room:view', (value) =>
      RoomProjectionSchema.parse(value),
    );
    socket.connect();
    await initial;
    return socket;
  };
  return {
    service,
    connect,
    close: async () => {
      clients.forEach((socket) => socket.disconnect());
      await service.close();
    },
  };
}

for (const transport of ['polling', 'websocket'] as const) {
  it(`orders authorized projections, cheap probes, readonly results and independent interaction watermarks over ${transport}`, async () => {
    const { service, connect, close } = await fixture(transport);
    try {
      const a = await service.room.join('甲');
      const b = await service.room.join('乙');
      const player = await connect(a.token);
      const other = await connect(b.token);
      const host = await connect(service.hostToken);
      const publicScreen = await connect();
      const before = await sync(player);
      await sync(publicScreen);
      expect(service.health.protocolVersion).toBe(8);
      expect(before.syncHint).toBe('idle');
      const view = vi.spyOn(service.room, 'view');
      const state = vi.spyOn(service.room, 'synchronizationState');
      const diagnosticBefore = service.syncDiagnostics();
      const probe = RoomProbeReplySchema.parse(
        await player
          .timeout(2000)
          .emitWithAck('room:probe', { stamp: before.stamp }),
      );
      expect(probe).toEqual({
        ok: true,
        unchanged: true,
        stamp: before.stamp,
        syncHint: 'idle',
        interactionWatermark: 0,
      });
      expect(view).not.toHaveBeenCalled();
      expect(state).not.toHaveBeenCalled();
      const diagnosticAfter = service.syncDiagnostics();
      expect(diagnosticAfter.metrics.projection.count).toBe(
        diagnosticBefore.metrics.projection.count,
      );
      expect(diagnosticAfter.metrics.probeUnchanged.count).toBe(
        diagnosticBefore.metrics.probeUnchanged.count + 1,
      );
      const input = envelope(before, { type: 'ready', ready: true });
      const unknown = RoomCommandStatusReplySchema.parse(
        await player.timeout(2000).emitWithAck('room:command:status', input),
      );
      expect(unknown).toMatchObject({
        ok: true,
        outcome: { status: 'unknown' },
      });
      expect((await sync(player)).stamp).toEqual(before.stamp);
      const pushed = next(publicScreen, 'room:view', (value) =>
        RoomProjectionSchema.parse(value),
      );
      const saved = CommandReplySchema.parse(
        await player.timeout(2000).emitWithAck('room:command', input),
      );
      expect(saved.ok).toBe(true);
      const publicUpdate = await pushed;
      expect(publicUpdate.view.self.role).toBe('public');
      expect(publicUpdate.stamp.viewSeq).toBeGreaterThan(before.stamp.viewSeq);
      const confirmed = RoomCommandStatusReplySchema.parse(
        await player.timeout(2000).emitWithAck('room:command:status', input),
      );
      expect(confirmed).toMatchObject({
        ok: true,
        outcome: { status: 'completed', reply: saved },
      });
      if (!confirmed.ok) throw new Error('Missing authorized confirmation');
      expect(confirmed.view.revision).toBe(before.view.revision + 1);
      const otherQuery = RoomCommandStatusReplySchema.parse(
        await other.timeout(2000).emitWithAck('room:command:status', input),
      );
      expect(otherQuery).toMatchObject({
        ok: true,
        outcome: { status: 'unknown' },
      });
      const publicQuery = RoomCommandStatusReplySchema.parse(
        await publicScreen
          .timeout(2000)
          .emitWithAck('room:command:status', input),
      );
      expect(publicQuery).toMatchObject({
        ok: true,
        outcome: { status: 'unqueryable', reason: 'unauthorized' },
      });
      expect(
        await player.timeout(2000).emitWithAck('room:command', input),
      ).toEqual(saved);
      expect((await sync(player)).stamp).toEqual(confirmed.stamp);
      const repaired = RoomProbeReplySchema.parse(
        await player
          .timeout(2000)
          .emitWithAck('room:probe', { stamp: before.stamp }),
      );
      expect(repaired).toMatchObject({
        ok: true,
        unchanged: false,
        stamp: confirmed.stamp,
      });
      const live = next(publicScreen, 'room:interaction', (value) =>
        InteractionEventSchema.parse(value),
      );
      const request = {
        ...service.room.interactionContext(),
        requestId: 'a'.repeat(32),
        interaction: { type: 'speech', phraseId: 'nice' },
      };
      const acknowledged = InteractionReplySchema.parse(
        await player
          .timeout(2000)
          .emitWithAck('room:interaction:send', request),
      );
      expect(acknowledged.ok).toBe(true);
      const event = await live;
      expect(event.serverSessionId).toBe(confirmed.stamp.serverSessionId);
      expect(event.interactionSeq).toBe(1);
      const afterInteraction = await sync(player);
      expect(afterInteraction.stamp).toEqual(confirmed.stamp);
      expect(afterInteraction.interactionWatermark).toBe(1);
      expect(afterInteraction.view.revision).toBe(confirmed.view.revision);
      expect(
        await player
          .timeout(2000)
          .emitWithAck('room:interaction:send', request),
      ).toEqual(acknowledged);
      expect((await sync(player)).interactionWatermark).toBe(1);
      const disconnected = next(host, 'room:view', (value) =>
        RoomProjectionSchema.parse(value),
      );
      other.disconnect();
      const onlineUpdate = await disconnected;
      expect(onlineUpdate.view.revision).toBe(afterInteraction.view.revision);
      expect(onlineUpdate.stamp.viewSeq).toBeGreaterThan(
        afterInteraction.stamp.viewSeq,
      );
      expect(
        onlineUpdate.view.seats.find(
          (seat) => seat.id === service.room.view(b.token).self.seatId,
        )?.online,
      ).toBe(false);
      const diagnostics = service.syncDiagnostics();
      expect(diagnostics.metrics.commandReply.count).toBe(2);
      expect(diagnostics.metrics.saveToBroadcast.count).toBeGreaterThan(0);
      expect(JSON.stringify(diagnostics)).not.toContain(a.token);
      expect(JSON.stringify(diagnostics)).not.toContain(service.hostToken);
    } finally {
      await close();
    }
  });
}

it('reports a failed save without changing projection order and confirms an exact retry once', async () => {
  const { service, connect, close } = await fixture('websocket');
  try {
    const a = await service.room.join('甲');
    const player = await connect(a.token);
    const before = await sync(player);
    const input = envelope(before, { type: 'ready', ready: true });
    vi.spyOn(SqliteSaveRepository.prototype, 'save').mockImplementationOnce(
      () => {
        throw new Error('disk full');
      },
    );
    const failed = CommandReplySchema.parse(
      await player.timeout(2000).emitWithAck('room:command', input),
    );
    expect(failed).toEqual({ ok: false, reason: 'save-or-action-failed' });
    const status = RoomCommandStatusReplySchema.parse(
      await player.timeout(2000).emitWithAck('room:command:status', input),
    );
    expect(status).toMatchObject({
      ok: true,
      stamp: before.stamp,
      outcome: { status: 'completed', reply: failed },
    });
    const reply = CommandReplySchema.parse(
      await player.timeout(2000).emitWithAck('room:command', input),
    );
    expect(reply.ok).toBe(true);
    const confirmed = RoomCommandStatusReplySchema.parse(
      await player.timeout(2000).emitWithAck('room:command:status', input),
    );
    expect(confirmed).toMatchObject({
      ok: true,
      outcome: { status: 'completed', reply },
    });
    if (!confirmed.ok) throw new Error('Missing result');
    expect(confirmed.view.revision).toBe(before.view.revision + 1);
    expect(
      await player.timeout(2000).emitWithAck('room:command', input),
    ).toEqual(reply);
    expect((await sync(player)).stamp).toEqual(confirmed.stamp);
  } finally {
    await close();
  }
});
