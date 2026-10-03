import Fastify from 'fastify';
import staticFiles from '@fastify/static';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  EchoSchema,
  HealthSchema,
  ServiceConfigSchema,
  type ServiceConfig,
  JoinSchema,
  SessionSchema,
  type RoomFeedback,
} from '@tablemax/protocol';
import {
  RoomCoordinator,
  BotScheduler,
  Rejection,
  GameRegistry,
  type LoadedGame,
} from '@tablemax/platform-core';
import { createGameRegistry } from './game-registry';
import { SqliteSaveRepository } from './save-repository';
import { WorkerBotExecutor } from './bot-executor';
import { openFoundationDatabase } from './database';
import { NetworkDirectory } from './network-directory';

export async function createService(
  input: ServiceConfig,
  game?: LoadedGame | GameRegistry,
) {
  const config = ServiceConfigSchema.parse(input);
  mkdirSync(join(config.dataDir, 'logs'), { recursive: true });
  const log = (event: string) =>
    appendFileSync(
      join(config.dataDir, 'logs', 'service.log'),
      `${JSON.stringify({ at: new Date().toISOString(), event })}\n`,
    );
  const storage = openFoundationDatabase(config.dataDir);
  let repository: SqliteSaveRepository;
  let room: RoomCoordinator;
  try {
    repository = new SqliteSaveRepository(config.dataDir);
    try {
      room =
        game && !(game instanceof GameRegistry)
          ? new RoomCoordinator(
              game.rules,
              game.bot,
              repository,
              undefined,
              config.playMode,
            )
          : await RoomCoordinator.open(
              game ?? createGameRegistry(),
              repository,
              undefined,
              config.playMode,
            );
    } catch (error) {
      repository.close();
      throw error;
    }
  } catch (error) {
    storage.close();
    throw error;
  }
  const scheduler = new BotScheduler(
    room,
    undefined,
    2_000,
    config.botWorkerPath
      ? new WorkerBotExecutor(config.botWorkerPath)
      : undefined,
  );
  const app = Fastify({
    logger: false,
    bodyLimit: 16 * 1024,
    // A phone going offline mid-request must not hold desktop shutdown open.
    forceCloseConnections: true,
  });
  const sockets = new Server(app.server, { maxHttpBufferSize: 16 * 1024 });
  const health = HealthSchema.parse({
    status: 'ready',
    phase: 'platform-foundation',
    protocolVersion: 6,
    database: 'ok',
    starts: storage.starts,
    runtime: {
      node: process.versions.node,
      electron: process.versions.electron ?? null,
      sqlite: storage.version,
    },
  });

  app.addHook('onSend', async (_request, reply) => {
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
  });
  app.get('/api/foundation/health', () => health);

  const network = new NetworkDirectory();
  const sessionFailure = (error: unknown) =>
    error instanceof Rejection ? error.message : 'save-or-action-failed';
  const online = () => {
    const seats = new Set<string>();
    for (const socket of sockets.sockets.sockets.values()) {
      try {
        const identity = room.identity(
          socket.data.credential as string | undefined,
        );
        if (identity.role === 'player') seats.add(identity.seatId);
      } catch {
        /* Revoked identities do not retain connection status. */
      }
    }
    return seats;
  };
  const broadcast = (feedback?: RoomFeedback) => {
    const connected = online();
    for (const socket of sockets.sockets.sockets.values()) {
      try {
        socket.emit(
          'room:view',
          room.view(socket.data.credential as string | undefined, connected),
        );
        if (feedback) socket.emit('room:feedback', feedback);
      } catch {
        socket.emit('room:revoked');
        socket.disconnect(true);
      }
    }
  };
  const unsubscribe = room.subscribe(broadcast);
  app.post('/api/session/join', async (request, reply) => {
    const parsed = JoinSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({
        ok: false,
        reason: parsed.error.issues.some(
          (issue) => issue.path[0] === 'avatarId',
        )
          ? 'invalid-avatar'
          : 'invalid-name',
      });
    try {
      return {
        ok: true,
        ...(await room.join(
          parsed.data.name,
          parsed.data.requestKey,
          parsed.data.avatarId,
        )),
      };
    } catch (error) {
      return reply.code(409).send({ ok: false, reason: sessionFailure(error) });
    }
  });
  app.post('/api/session/view', (request, reply) => {
    const body = SessionSchema.safeParse(request.body);
    if (!body.success)
      return reply.code(400).send({ ok: false, reason: 'invalid-message' });
    try {
      return { ok: true, view: room.view(body.data.token, online()) };
    } catch {
      return reply.code(401).send({ ok: false, reason: 'invalid-identity' });
    }
  });
  app.get('/api/room/network', () => ({
    ...network.read(),
    port: (app.server.address() as { port: number }).port,
  }));
  app.get('/api/foundation/addresses', () => network.read());
  app.get<{ Querystring: { address?: string } }>(
    '/api/foundation/qr',
    async (request, reply) => {
      const address = request.query.address;
      if (!address || !network.read().addresses.includes(address))
        return reply.code(400).send({ error: 'invalid-address' });
      const port = (app.server.address() as { port: number }).port;
      const svg = await QRCode.toString(`http://${address}:${port}/player`, {
        type: 'svg',
        margin: 2,
      });
      return reply.type('image/svg+xml').send(svg);
    },
  );

  sockets.use((socket, next) => {
    const parsed = SessionSchema.safeParse(socket.handshake.auth);
    if (!parsed.success) return next(new Error('invalid-identity'));
    try {
      room.identity(parsed.data.token);
      socket.data.credential = parsed.data.token;
      next();
    } catch {
      next(new Error('invalid-identity'));
    }
  });
  sockets.on('connection', (socket) => {
    broadcast();
    socket.on('disconnect', () => broadcast());
    socket.on('room:sync', () => {
      try {
        socket.emit(
          'room:view',
          room.view(socket.data.credential as string | undefined, online()),
        );
      } catch {
        socket.emit('room:revoked');
        socket.disconnect(true);
      }
    });
    socket.on('room:command', (input: unknown, acknowledge: unknown) => {
      if (typeof acknowledge !== 'function') return;
      void room
        .command(socket.data.credential as string | undefined, input)
        .then((result) => {
          acknowledge(result);
          if (!result.ok) broadcast();
        });
    });
    socket.emit('foundation:ready', health);
    socket.on('foundation:echo', (input: unknown, acknowledge: unknown) => {
      if (typeof acknowledge !== 'function') return;
      const message = EchoSchema.safeParse(input);
      acknowledge(
        message.success
          ? { ok: true, text: message.data.text }
          : { ok: false, reason: 'invalid-message' },
      );
    });
  });

  app.addHook('preClose', async () => {
    scheduler.stop();
    unsubscribe();
    // Disconnect clients without calling io.close(), which also closes HTTP.
    sockets.disconnectSockets(true);
    sockets.engine.close();
  });
  app.addHook('onClose', async () => {
    repository.close();
    storage.close();
    log('service-stopped');
  });

  try {
    await app.register(staticFiles, {
      root: config.webDir,
      index: ['index.html'],
    });
    for (const route of [
      '/host',
      '/public',
      '/player',
      '/host/game',
      '/public/game',
      '/player/game',
    ]) {
      app.get(route, (_request, reply) => reply.sendFile('index.html'));
    }
    await app.ready();
  } catch (error) {
    await app.close();
    throw error;
  }

  return {
    app,
    health,
    room,
    hostToken: room.hostToken,
    async listen() {
      await app.listen({ host: config.host, port: config.port });
      log('service-ready');
      return (app.server.address() as { port: number }).port;
    },
    close: () => app.close(),
  };
}
