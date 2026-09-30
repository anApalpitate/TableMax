import Fastify from 'fastify';
import staticFiles from '@fastify/static';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { appendFileSync, mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import {
  EchoSchema,
  HealthSchema,
  ServiceConfigSchema,
  type ServiceConfig,
} from '@tablemax/protocol';
import { openFoundationDatabase } from './database';

export async function createService(input: ServiceConfig) {
  const config = ServiceConfigSchema.parse(input);
  mkdirSync(join(config.dataDir, 'logs'), { recursive: true });
  const log = (event: string) =>
    appendFileSync(
      join(config.dataDir, 'logs', 'service.log'),
      `${JSON.stringify({ at: new Date().toISOString(), event })}\n`,
    );
  const storage = openFoundationDatabase(config.dataDir);
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });
  const sockets = new Server(app.server, { maxHttpBufferSize: 16 * 1024 });
  const health = HealthSchema.parse({
    status: 'ready',
    phase: 'engineering-foundation',
    protocolVersion: 1,
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

  const addresses = [
    ...new Set(
      Object.values(networkInterfaces()).flatMap(
        (entries) =>
          entries
            ?.filter((entry) => entry.family === 'IPv4' && !entry.internal)
            .map((entry) => entry.address) ?? [],
      ),
    ),
  ];
  app.get('/api/foundation/addresses', () => ({ addresses }));
  app.get<{ Querystring: { address?: string } }>(
    '/api/foundation/qr',
    async (request, reply) => {
      const address = request.query.address;
      if (!address || !addresses.includes(address))
        return reply.code(400).send({ error: 'invalid-address' });
      const port = (app.server.address() as { port: number }).port;
      const svg = await QRCode.toString(`http://${address}:${port}/player`, {
        type: 'svg',
        margin: 2,
      });
      return reply.type('image/svg+xml').send(svg);
    },
  );

  sockets.on('connection', (socket) => {
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
    // Disconnect clients without calling io.close(), which also closes HTTP.
    sockets.disconnectSockets(true);
    sockets.engine.close();
  });
  app.addHook('onClose', async () => {
    storage.close();
    log('service-stopped');
  });

  try {
    await app.register(staticFiles, {
      root: config.webDir,
      index: ['index.html'],
    });
    for (const route of ['/host', '/public', '/player']) {
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
    async listen() {
      await app.listen({ host: config.host, port: config.port });
      log('service-ready');
      return (app.server.address() as { port: number }).port;
    },
    close: () => app.close(),
  };
}
