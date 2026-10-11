import Fastify from 'fastify';
import staticFiles from '@fastify/static';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  existsSync,
  writeFileSync,
  unlinkSync,
  createReadStream,
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  EchoSchema,
  HealthSchema,
  ServiceConfigSchema,
  type ServiceConfig,
  JoinSchema,
  SessionSchema,
  AvatarUploadSchema,
  type RoomFeedback,
  TransferRequestSchema,
  TransferProofSchema,
  NetworkUpdateSchema,
  type RoomProjection,
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
import { normalizeAvatar, AVATAR_HTTP_LIMIT } from './avatar-images';
import { NetworkSettings, normalizeUrl } from './network-settings';
import { InteractionDispatcher } from './interactions';
import { RoomProjectionState } from './room-projections';
import { SyncDiagnostics } from './sync-diagnostics';
import { PackageStore } from './game-packages/store';
import { PROJECT_GAME_PUBLIC_KEY } from './game-packages/project-public-key';
import { gameAssetUrl, gameCatalogUrl } from './game-packages/distribution';

export async function createService(
  input: ServiceConfig,
  game?: LoadedGame | GameRegistry,
  migrationProgress?: () => void,
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
  const packages: PackageStore | undefined = config.gamesDir
    ? new PackageStore({
        root: config.gamesDir,
        publicKey: PROJECT_GAME_PUBLIC_KEY,
        protectedReleaseIds: () => [
          ...(repository?.referencedReleases() ?? []),
          ...(repository?.hasUnpinnedHistory() && packages
            ? Object.values(packages.snapshot().index.releases)
                .filter((r) => r.legacy)
                .map((r) => r.releaseId)
            : []),
        ],
        assetUrl: gameAssetUrl,
      })
    : undefined;
  let freshFullInitialGame: string | undefined;
  if (packages) {
    const catalogPath = join(config.webDir, '..', 'game-catalog.json');
    if (
      existsSync(catalogPath) &&
      !existsSync(join(packages.root, 'catalog.json'))
    )
      packages.setCatalog(JSON.parse(readFileSync(catalogPath, 'utf8')));
    const legacyRoot = join(packages.root, '.legacy');
    if (existsSync(legacyRoot))
      for (const name of readdirSync(legacyRoot))
        if (/^[a-f0-9]{64}$/.test(name))
          packages.migrateLegacy(join(legacyRoot, name));
    try {
      const preinstalled = await packages.importPreinstalled(
        join(config.webDir, '..', 'preinstalled-games'),
        migrationProgress,
      );
      const original = packages.selected('pokemon-encounters', 'original');
      if (
        original &&
        preinstalled.includes(original.releaseId) &&
        packages.resolveModule(original.releaseId)
      )
        freshFullInitialGame = original.gameId;
    } catch (error) {
      // Retain existing games and missing-reference repair mode if a local payload is damaged.
      log(
        `preinstalled-games-failed:${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
  const registry =
    game instanceof GameRegistry ? game : createGameRegistry(false, packages);
  if (packages)
    registry.resolveSavedRelease = (saved) => {
      if (!saved.manifest) return undefined;
      const module = registry
        .catalog()
        .find((item) => item.id === saved.manifest!.id);
      const selected = saved.variantId ?? module?.defaultVariantId;
      const bot = Object.values(saved.snapshot?.bots ?? {})[0];
      const release = packages.findLegacyRelease(saved.manifest.id, selected, {
        gameVersion: saved.manifest.gameVersion,
        rulesVersion: saved.manifest.rulesVersion,
        stateVersion: saved.manifest.stateVersion,
        ...(bot ? { strategyVersion: bot.version } : {}),
      });
      if (!release) throw new Error('missing-game-release');
      return release.releaseId;
    };
  try {
    repository = new SqliteSaveRepository(config.dataDir, migrationProgress);
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
              registry,
              repository,
              undefined,
              config.playMode,
              game === undefined
                ? !packages
                  ? process.env.TABLEMAX_AUTHOR_MODE === '1'
                    ? registry.catalog()[0]?.id
                    : 'pokemon-encounters'
                  : process.env.TABLEMAX_AUTHOR_MODE === '1'
                    ? undefined
                    : freshFullInitialGame
                : undefined,
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
      ? new WorkerBotExecutor(config.botWorkerPath, (task) => {
          if (!task.releaseRef) return undefined;
          const installed = packages?.resolveModule(task.releaseRef);
          if (!installed) throw new Error('missing-game-release');
          return join(installed.root, installed.release.module.entries.bot);
        })
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
    protocolVersion: 8,
    database: 'ok',
    starts: storage.starts,
    runtime: {
      node: process.versions.node,
      electron: process.versions.electron ?? null,
      sqlite: storage.version,
    },
  });

  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api/'))
      reply.header('Cache-Control', 'no-store');
    reply.header(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'none'; frame-ancestors ${/^\/(?:player(?:\/game)?)?(?:\?|$)/.test(request.url) ? "'self'" : "'none'"}`,
    );
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
  });
  app.get('/api/foundation/health', () => health);
  const isPackageAdmin = (request: { headers: Record<string, unknown> }) => {
    const value = request.headers.authorization;
    if (typeof value !== 'string' || !value.startsWith('Bearer ')) return false;
    try {
      return room.identity(value.slice(7)).role === 'host';
    } catch {
      return false;
    }
  };
  if (packages) {
    app.get('/api/game-packages', () => packages.snapshot());
    app.get<{ Params: { ref: string } }>(
      '/api/game-packages/releases/:ref',
      (request, reply) => {
        const found = packages.resolveModule(request.params.ref);
        return found
          ? found.release
          : reply.code(404).send({ reason: 'missing-game-release' });
      },
    );
    app.get<{ Params: { ref: string; '*': string } }>(
      '/game-packages/:ref/*',
      (request, reply) => {
        const suffix = request.params['*'];
        const path = packages.resolvePublicFile(
          request.params.ref,
          suffix.startsWith('resources/') ? suffix.slice(10) : suffix,
        );
        if (!path) return reply.code(404).send();
        const ext = path.split('.').pop();
        const mime: Record<string, string> = {
          js: 'text/javascript',
          css: 'text/css',
          webp: 'image/webp',
          png: 'image/png',
          jpg: 'image/jpeg',
          svg: 'image/svg+xml',
          flac: 'audio/flac',
          wav: 'audio/wav',
          mp3: 'audio/mpeg',
          ogg: 'audio/ogg',
          json: 'application/json',
        };
        reply.type(mime[ext ?? ''] ?? 'application/octet-stream');
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');
        return reply.send(createReadStream(path));
      },
    );
    app.post<{ Body: { operation?: string; releaseId?: string } }>(
      '/api/game-packages/manage',
      async (request, reply) => {
        if (!isPackageAdmin(request))
          return reply.code(403).send({ reason: 'unauthorized' });
        const { operation, releaseId } = request.body ?? {};
        try {
          if (operation === 'refresh') {
            const response = await fetch(gameCatalogUrl(), {
              signal: AbortSignal.timeout(30000),
            });
            if (
              !response.ok ||
              Number(response.headers.get('content-length')) > 2_000_000
            )
              throw new Error('catalog-download-failed');
            const body = await response.text();
            if (Buffer.byteLength(body) > 2_000_000)
              throw new Error('catalog-size-limit');
            packages.setCatalog(JSON.parse(body));
          } else {
            if (!releaseId || !/^[a-f0-9]{64}$/.test(releaseId))
              return reply.code(400).send({ reason: 'invalid-message' });
            if (operation === 'install')
              void packages.install(releaseId).catch(() => {});
            else if (operation === 'cancel') packages.cancel(releaseId);
            else if (operation === 'uninstall') packages.uninstall(releaseId);
            else if (operation === 'rollback') packages.rollback(releaseId);
            else return reply.code(400).send({ reason: 'invalid-message' });
          }
          return { ok: true };
        } catch (error) {
          return reply.code(400).send({
            ok: false,
            reason:
              error instanceof Error
                ? error.message
                : 'package-operation-failed',
          });
        }
      },
    );
    app.addContentTypeParser(
      'application/octet-stream',
      { parseAs: 'buffer', bodyLimit: 63_999_999 },
      (_request, body, done) => done(null, body),
    );
    app.post(
      '/api/game-packages/import',
      {
        bodyLimit: 63_999_999,
        onRequest: async (request, reply) => {
          if (!isPackageAdmin(request))
            return reply.code(403).send({ reason: 'unauthorized' });
        },
      },
      async (request, reply) => {
        if (!isPackageAdmin(request) || !Buffer.isBuffer(request.body))
          return reply.code(403).send({ reason: 'unauthorized' });
        const path = join(
          packages.root,
          '.staging',
          `import-${randomUUID()}.zip`,
        );
        try {
          writeFileSync(path, request.body, { flag: 'wx' });
          return { ok: true, releaseId: await packages.importOffline(path) };
        } catch (error) {
          return reply.code(400).send({
            ok: false,
            reason:
              error instanceof Error ? error.message : 'package-import-failed',
          });
        } finally {
          if (existsSync(path)) unlinkSync(path);
        }
      },
    );
  }

  const network = new NetworkDirectory();
  const networkSettings = new NetworkSettings(config.dataDir);
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
  const serverSessionId = randomUUID();
  const syncDiagnostics = new SyncDiagnostics();
  const interactions = new InteractionDispatcher(
    room,
    (event) => {
      for (const socket of sockets.sockets.sockets.values()) {
        try {
          room.identity(socket.data.credential as string | undefined);
          socket.emit('room:interaction', event);
        } catch {
          /* Revoked connections receive no further interactions. */
        }
      }
    },
    serverSessionId,
  );
  const projections = new RoomProjectionState(
    room,
    () => interactions.watermark,
    () => broadcast(),
    serverSessionId,
    syncDiagnostics,
  );
  let connectedSeats = online();
  let closing = false;
  const broadcast = (feedback?: RoomFeedback, savedAt?: number) => {
    if (closing) return;
    const startedAt = performance.now();
    interactions.synchronize();
    const connected = online();
    connectedSeats = connected;
    projections.advance();
    // Duplicate tabs for one identity share this broadcast's projection only.
    // No long-lived cache can retain revoked authority or stale clock samples.
    const views = new Map<string, RoomProjection>();
    for (const socket of sockets.sockets.sockets.values()) {
      try {
        const credential = socket.data.credential as string | undefined;
        const identity = room.identity(credential);
        const key =
          identity.role === 'player'
            ? `player:${identity.seatId}`
            : identity.role;
        let projection = views.get(key);
        if (!projection) {
          projection = projections.project(credential, connected);
          views.set(key, projection);
        }
        socket.emit('room:view', projection);
        if (feedback) socket.emit('room:feedback', feedback);
      } catch {
        socket.emit('room:revoked');
        socket.disconnect(true);
      }
    }
    const completedAt = performance.now();
    syncDiagnostics.record('broadcast', completedAt - startedAt);
    if (savedAt !== undefined)
      syncDiagnostics.record('saveToBroadcast', completedAt - savedAt);
  };
  const onlineChanged = () => {
    if (closing) return false;
    const current = online();
    if (
      current.size === connectedSeats.size &&
      [...current].every((seat) => connectedSeats.has(seat))
    )
      return false;
    broadcast();
    return true;
  };
  const unsubscribe = room.subscribe(broadcast);
  const unsubscribePackages = packages?.subscribe(() => {
    registry.refresh(createGameRegistry(false, packages).registrations());
    broadcast();
    if (room.missingRelease) void room.restoreMissingRelease().catch(() => {});
  });
  app.post('/api/session/transfer/request', async (request, reply) => {
    const parsed = TransferRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ ok: false, reason: 'invalid-message' });
    try {
      return {
        ok: true,
        transfer: await room.requestTransfer(
          parsed.data.seatId,
          parsed.data.requestKey,
        ),
      };
    } catch (error) {
      return reply.code(409).send({ ok: false, reason: sessionFailure(error) });
    }
  });
  for (const operation of ['status', 'cancel'] as const) {
    app.post(`/api/session/transfer/${operation}`, async (request, reply) => {
      const parsed = TransferProofSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ ok: false, reason: 'invalid-message' });
      try {
        const transfer =
          operation === 'cancel'
            ? await room.cancelTransfer(parsed.data.requestKey)
            : room.transferStatus(parsed.data.requestKey);
        return { ok: true, transfer };
      } catch (error) {
        return reply
          .code(409)
          .send({ ok: false, reason: sessionFailure(error) });
      }
    });
  }
  app.post(
    '/api/session/join',
    { bodyLimit: AVATAR_HTTP_LIMIT },
    async (request, reply) => {
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
        if (parsed.data.avatarId && parsed.data.avatarImage)
          throw new Rejection('invalid-avatar');
        const image = parsed.data.avatarImage
          ? normalizeAvatar(parsed.data.avatarImage)
          : undefined;
        return {
          ok: true,
          ...(await room.join(
            parsed.data.name,
            parsed.data.requestKey,
            image?.id ?? parsed.data.avatarId,
            image,
          )),
        };
      } catch (error) {
        return reply
          .code(409)
          .send({ ok: false, reason: sessionFailure(error) });
      }
    },
  );
  app.post(
    '/api/session/avatar',
    { bodyLimit: AVATAR_HTTP_LIMIT },
    async (request, reply) => {
      const parsed = AvatarUploadSchema.safeParse(request.body);
      if (!parsed.success)
        return reply
          .code(400)
          .send({ ok: false, reason: 'invalid-avatar-image' });
      try {
        const identity = room.identity(parsed.data.token);
        if (identity.role !== 'player') throw new Rejection('unauthorized');
        const image = normalizeAvatar(parsed.data.avatarImage);
        return await room.uploadAvatar(
          parsed.data.token,
          parsed.data.envelope,
          image,
        );
      } catch (error) {
        return reply
          .code(409)
          .send({ ok: false, reason: sessionFailure(error) });
      }
    },
  );
  app.get<{ Params: { id: string } }>('/api/avatars/:id', (request, reply) => {
    if (!/^custom-[0-9a-f]{64}$/.test(request.params.id))
      return reply.code(404).send();
    const png = repository.getAvatar(request.params.id);
    if (!png) return reply.code(404).send();
    return reply
      .type('image/png')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(Buffer.from(png));
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
  const networkView = () => ({
    ...network.read(),
    ...networkSettings.read(),
    port: (app.server.address() as { port: number }).port,
  });
  app.get('/api/room/network', networkView);
  app.post('/api/room/network', (request, reply) => {
    const parsed = NetworkUpdateSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ ok: false, reason: 'invalid-message' });
    try {
      if (room.identity(parsed.data.token).role !== 'host')
        throw new Rejection('unauthorized');
    } catch {
      return reply.code(403).send({ ok: false, reason: 'unauthorized' });
    }
    let externalJoinUrl: string | null;
    try {
      externalJoinUrl =
        parsed.data.externalJoinUrl === null
          ? null
          : normalizeUrl(parsed.data.externalJoinUrl);
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        reason: 'invalid-external-url',
        message: (error as Error).message,
      });
    }
    try {
      networkSettings.save(externalJoinUrl);
      const next = networkView();
      sockets.emit('room:network', next);
      return next;
    } catch {
      return reply.code(409).send({
        ok: false,
        reason: 'network-settings-failed',
        message: '连接设置未能保存，请检查数据目录后重试。',
      });
    }
  });
  app.get('/api/foundation/addresses', () => network.read());
  app.get<{ Querystring: { address?: string; external?: string } }>(
    '/api/foundation/qr',
    async (request, reply) => {
      const port = (app.server.address() as { port: number } | null)?.port;
      const address = request.query.address;
      const external = request.query.external === '1';
      const target = external
        ? networkSettings.read().externalJoinUrl
        : port && address && network.read().addresses.includes(address)
          ? `http://${address}:${port}`
          : null;
      if (!target)
        return reply.code(400).send({
          error: external ? 'external-entry-not-configured' : 'invalid-address',
        });
      const svg = await QRCode.toString(target, {
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
    try {
      room.identity(socket.data.credential as string | undefined);
      if (!onlineChanged())
        socket.emit(
          'room:view',
          projections.project(
            socket.data.credential as string | undefined,
            online(),
          ),
        );
    } catch {
      socket.emit('room:revoked');
      socket.disconnect(true);
      return;
    }
    socket.on('disconnect', onlineChanged);
    socket.on(
      'room:interaction:send',
      (input: unknown, acknowledge: unknown) => {
        if (typeof acknowledge === 'function')
          acknowledge(
            interactions.send(
              socket.data.credential as string | undefined,
              input,
            ),
          );
      },
    );
    socket.on('room:sync', (acknowledge?: unknown) => {
      try {
        const projection = projections.project(
          socket.data.credential as string | undefined,
          online(),
        );
        if (typeof acknowledge === 'function')
          acknowledge({ ok: true, ...projection });
        else socket.emit('room:view', projection);
      } catch {
        if (typeof acknowledge === 'function')
          acknowledge({ ok: false, reason: 'invalid-identity' });
        socket.emit('room:revoked');
        socket.disconnect(true);
      }
    });
    socket.on('room:probe', (input: unknown, acknowledge: unknown) => {
      if (typeof acknowledge !== 'function') return;
      try {
        acknowledge(
          projections.probe(
            socket.data.credential as string | undefined,
            input,
            online,
          ),
        );
      } catch {
        acknowledge({ ok: false, reason: 'invalid-identity' });
        socket.emit('room:revoked');
        socket.disconnect(true);
      }
    });
    socket.on('room:command:status', (input: unknown, acknowledge: unknown) => {
      if (typeof acknowledge !== 'function') return;
      try {
        const credential = socket.data.credential as string | undefined;
        room.identity(credential);
        const outcome = room.commandStatus(credential, input);
        acknowledge({
          ok: true,
          ...projections.project(credential, online()),
          outcome,
        });
      } catch {
        acknowledge({ ok: false, reason: 'invalid-identity' });
        socket.emit('room:revoked');
        socket.disconnect(true);
      }
    });
    socket.on('room:command', (input: unknown, acknowledge: unknown) => {
      if (typeof acknowledge !== 'function') return;
      const startedAt = performance.now();
      void room
        .command(socket.data.credential as string | undefined, input)
        .then((result) => {
          syncDiagnostics.record('commandReply', performance.now() - startedAt);
          acknowledge(result);
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
    closing = true;
    projections.dispose();
    interactions.dispose();
    scheduler.stop();
    unsubscribe();
    unsubscribePackages?.();
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
    syncDiagnostics: () => syncDiagnostics.snapshot(),
    async listen() {
      await app.listen({ host: config.host, port: config.port });
      log('service-ready');
      return (app.server.address() as { port: number }).port;
    },
    close: () => app.close(),
  };
}
