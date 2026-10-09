import { afterEach, expect, it, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import QRCode from 'qrcode';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  CommandReplySchema,
  NetworkSchema,
  RoomViewSchema,
  RoomProjectionSchema,
  SessionReplySchema,
  TransferReplySchema,
  type Command,
  type RoomView,
  type RoomProjection,
  type ServiceConfig,
  type TransferState,
} from '@tablemax/protocol';
import { rules, bot } from '@tablemax/game-template';
import type { Save } from '@tablemax/platform-core';
import { createService } from './service';
import { NetworkDirectory } from './network-directory';
import { readCurrentSave } from './save-audit';
import { safeHttpPort } from '../../../scripts/fixtures/safe-http-port';

type Service = Awaited<ReturnType<typeof createService>>;
const tmpRoot = resolve('tmp');
const directories: string[] = [];
const services = new Set<Service>();
const clients: Socket[] = [];
const requestKey = () => randomBytes(32).toString('hex');

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  for (const service of services) await service.close();
  services.clear();
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) {
    expect(dirname(directory)).toBe(tmpRoot);
    expect(basename(directory)).toMatch(/^debug-network-/);
    rmSync(directory, { recursive: true, force: true });
  }
});

async function fixture(): Promise<ServiceConfig> {
  mkdirSync(tmpRoot, { recursive: true });
  const directory = mkdtempSync(join(tmpRoot, 'debug-network-'));
  directories.push(directory);
  const dataDir = join(directory, 'data');
  const webDir = join(directory, 'web');
  mkdirSync(dataDir);
  mkdirSync(webDir);
  writeFileSync(join(webDir, 'index.html'), '<html>connection fixture</html>');
  return { dataDir, webDir, host: '127.0.0.1', port: await safeHttpPort() };
}

async function start(config: ServiceConfig) {
  const service = await createService(config, { rules, bot });
  services.add(service);
  return { service, origin: `http://127.0.0.1:${await service.listen()}` };
}
async function stop(service: Service) {
  await service.close();
  services.delete(service);
}

function event<T>(
  socket: Socket,
  name: string,
  accepts: (value: T) => boolean = () => true,
): Promise<T> {
  return new Promise((done, reject) => {
    const timeout = setTimeout(() => {
      socket.off(name, receive);
      reject(new Error(`Timed out waiting for ${name}`));
    }, 5000);
    function receive(value: T) {
      if (!accepts(value)) return;
      clearTimeout(timeout);
      socket.off(name, receive);
      done(value);
    }
    socket.on(name, receive);
  });
}

async function connect(
  origin: string,
  token?: string,
  transport: 'websocket' | 'polling' = 'websocket',
) {
  const socket = io(origin, {
    forceNew: true,
    autoConnect: false,
    transports: [transport],
    upgrade: false,
    reconnection: false,
    auth: token ? { token } : {},
  });
  clients.push(socket);
  const ready = event<unknown>(socket, 'room:view');
  socket.connect();
  RoomProjectionSchema.parse(await ready);
  return socket;
}

async function sync(socket: Socket): Promise<RoomView> {
  const result: { ok: boolean; view: unknown } = await socket
    .timeout(5000)
    .emitWithAck('room:sync');
  expect(result.ok).toBe(true);
  return RoomViewSchema.parse(result.view);
}
function envelope(view: RoomView, value: Command['command']): Command {
  return {
    actionId: randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command: value,
  };
}
async function send(socket: Socket, value: Command['command']) {
  return CommandReplySchema.parse(
    await socket
      .timeout(5000)
      .emitWithAck('room:command', envelope(await sync(socket), value)),
  );
}
function post(origin: string, path: string, body: unknown) {
  return fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
}
async function joinPlayer(origin: string, name: string) {
  const response = await post(origin, '/api/session/join', {
    name,
    requestKey: requestKey(),
  });
  expect(response.status).toBe(200);
  const reply = SessionReplySchema.parse(await response.json());
  if (!reply.ok) throw new Error(reply.reason);
  return reply.token;
}
async function transfer(
  origin: string,
  operation: 'request' | 'status' | 'cancel',
  body: unknown,
): Promise<TransferState> {
  const response = await post(
    origin,
    `/api/session/transfer/${operation}`,
    body,
  );
  expect(response.status).toBe(200);
  const reply = TransferReplySchema.parse(await response.json());
  if (!reply.ok) throw new Error(reply.reason);
  return reply.transfer;
}
function saved(dataDir: string) {
  const database = new DatabaseSync(join(dataDir, 'room.sqlite'), {
    readOnly: true,
  });
  try {
    return readCurrentSave(database) as Save;
  } finally {
    database.close();
  }
}
async function assertQr(origin: string, query: string, target: string) {
  const response = await fetch(`${origin}/api/foundation/qr?${query}`);
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const image = await response.text();
  expect(image).toBe(await QRCode.toString(target, { type: 'svg', margin: 2 }));
  return image;
}

it('restricts external entry settings to the desktop administrator, pushes the saved QR target and retains it after restart', async () => {
  const directory = vi
    .spyOn(NetworkDirectory.prototype, 'read')
    .mockReturnValue({
      addresses: ['127.0.0.1'],
      adapters: [{ address: '127.0.0.1', name: 'Test adapter', kind: 'lan' }],
    });
  const config = await fixture();
  const { service, origin } = await start(config);
  const host = await connect(origin, service.hostToken);
  const publicClient = await connect(origin);
  const ownerToken = await joinPlayer(origin, '手机房主');
  const friendToken = await joinPlayer(origin, '朋友');
  const owner = await connect(origin, ownerToken);
  const ownerSeat = (await sync(owner)).self.seatId;
  expect((await send(host, { type: 'set-owner', seatId: ownerSeat })).ok).toBe(
    true,
  );
  expect((await sync(owner)).capabilities.control).toBe(true);
  for (const token of [undefined, requestKey(), ownerToken, friendToken]) {
    const response = await post(origin, '/api/room/network', {
      ...(token ? { token } : {}),
      externalJoinUrl: 'https://unauthorized.example',
    });
    expect(response.status).toBe(token ? 403 : 400);
    expect(await response.json()).toEqual({
      ok: false,
      reason: token ? 'unauthorized' : 'invalid-message',
    });
  }
  const original = saved(config.dataDir);
  expect(
    NetworkSchema.parse(
      await (await fetch(`${origin}/api/room/network`)).json(),
    ).externalJoinUrl,
  ).toBeNull();
  const received = event<unknown>(publicClient, 'room:network');
  const updated = await post(origin, '/api/room/network', {
    token: service.hostToken,
    externalJoinUrl: 'https://EXAMPLE.com:8443/',
  });
  expect(updated.status).toBe(200);
  const network = NetworkSchema.parse(await updated.json());
  expect(network.externalJoinUrl).toBe('https://example.com:8443');
  expect(NetworkSchema.parse(await received)).toEqual(network);
  expect(
    NetworkSchema.parse(
      await (await fetch(`${origin}/api/room/network`)).json(),
    ),
  ).toEqual(network);
  expect(saved(config.dataDir)).toEqual(original);
  expect(
    JSON.parse(
      readFileSync(join(config.dataDir, 'network-settings.json'), 'utf8'),
    ),
  ).toEqual({ externalJoinUrl: network.externalJoinUrl });
  const firstQr = await assertQr(
    origin,
    'external=1',
    network.externalJoinUrl!,
  );
  directory.mockReturnValue({ addresses: [], adapters: [] });
  expect(
    NetworkSchema.parse(
      await (await fetch(`${origin}/api/room/network`)).json(),
    ),
  ).toMatchObject({ addresses: [], externalJoinUrl: network.externalJoinUrl });
  expect(await assertQr(origin, 'external=1', network.externalJoinUrl!)).toBe(
    firstQr,
  );
  directory.mockReturnValue({
    addresses: network.addresses,
    adapters: network.adapters,
  });
  for (const externalJoinUrl of [
    'https://example.com/tablemax/player',
    'https://user:pass@example.com',
    'javascript:alert(1)',
    'https://example.com/player?token=secret',
  ]) {
    const invalid = await post(origin, '/api/room/network', {
      token: service.hostToken,
      externalJoinUrl,
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { reason: string }).reason).toBe(
      'invalid-external-url',
    );
    expect(
      NetworkSchema.parse(
        await (await fetch(`${origin}/api/room/network`)).json(),
      ).externalJoinUrl,
    ).toBe(network.externalJoinUrl);
  }
  const nextTarget = 'http://mapped.example:8080';
  expect(
    (
      await post(origin, '/api/room/network', {
        token: service.hostToken,
        externalJoinUrl: 'mapped.example:8080/player',
      })
    ).status,
  ).toBe(200);
  expect(await assertQr(origin, 'external=1', nextTarget)).not.toBe(firstQr);
  await assertQr(origin, 'address=127.0.0.1', origin);
  const forwardedQr = await fetch(
    `${origin}/api/foundation/qr?address=127.0.0.1`,
    {
      headers: {
        'X-Forwarded-Host': 'unauthorized.example',
        'X-Forwarded-Proto': 'https',
      },
    },
  );
  expect(await forwardedQr.text()).toBe(
    await QRCode.toString(origin, { type: 'svg', margin: 2 }),
  );
  expect(
    (await fetch(`${origin}/api/foundation/qr?address=not-an-adapter`)).status,
  ).toBe(400);
  const addresses = await (
    await fetch(`${origin}/api/foundation/addresses`)
  ).json();
  expect(addresses).toEqual({
    addresses: ['127.0.0.1'],
    adapters: network.adapters,
  });
  for (const client of [host, publicClient, owner]) client.disconnect();
  await stop(service);
  const restarted = await start(config);
  expect(
    NetworkSchema.parse(
      await (await fetch(`${restarted.origin}/api/room/network`)).json(),
    ).externalJoinUrl,
  ).toBe(nextTarget);
  await assertQr(restarted.origin, 'external=1', nextTarget);
  const cleared = await post(restarted.origin, '/api/room/network', {
    token: restarted.service.hostToken,
    externalJoinUrl: null,
  });
  expect(NetworkSchema.parse(await cleared.json()).externalJoinUrl).toBeNull();
  expect(
    (await fetch(`${restarted.origin}/api/foundation/qr?external=1`)).status,
  ).toBe(400);
  await assertQr(restarted.origin, 'address=127.0.0.1', restarted.origin);
});

it('keeps root and legacy player links reloadable while protecting saved identities, secrets and administrator authority', async () => {
  const config = await fixture();
  const legacySettings =
    '{"externalJoinUrl":"https://mapped.example:8443/player"}\n';
  writeFileSync(join(config.dataDir, 'network-settings.json'), legacySettings);
  const { service, origin } = await start(config);
  expect(
    NetworkSchema.parse(
      await (await fetch(`${origin}/api/room/network`)).json(),
    ).externalJoinUrl,
  ).toBe('https://mapped.example:8443');
  expect(
    readFileSync(join(config.dataDir, 'network-settings.json'), 'utf8'),
  ).toBe(legacySettings);
  await assertQr(origin, 'external=1', 'https://mapped.example:8443');

  const playerToken = await joinPlayer(origin, '根入口玩家');
  const friendToken = await joinPlayer(origin, '旧入口朋友');
  const host = await connect(origin, service.hostToken);
  const player = await connect(origin, playerToken, 'polling');
  const friend = await connect(origin, friendToken, 'polling');
  expect((await send(player, { type: 'ready', ready: true })).ok).toBe(true);
  expect((await send(friend, { type: 'ready', ready: true })).ok).toBe(true);
  expect((await send(host, { type: 'start' })).ok).toBe(true);
  const original = await sync(player);
  const publicView = await sync(await connect(origin));
  expect(original.self.role).toBe('player');
  expect(original.gameView).toMatchObject({
    ownSecret: expect.any(Number),
    results: null,
  });
  expect(original.capabilities.control).toBe(false);
  expect(publicView.gameView).toMatchObject({ ownSecret: null, results: null });
  expect((await sync(host)).gameView).toMatchObject({
    ownSecret: null,
    results: null,
  });
  const beforeReload = saved(config.dataDir);

  for (const path of ['/', '/?invite=friend', '/player', '/player/game']) {
    const page = await fetch(`${origin}${path}`);
    expect(page.status).toBe(200);
    expect(page.headers.get('Content-Security-Policy')).toContain(
      "frame-ancestors 'self'",
    );
    const html = await page.text();
    expect(html).toContain('connection fixture');
    expect(html).not.toContain(playerToken);
    expect(html).not.toContain(service.hostToken);
    const response = await post(origin, '/api/session/view', {
      token: playerToken,
    });
    expect(response.status).toBe(200);
    const { view } = (await response.json()) as { view: unknown };
    const reloaded = RoomViewSchema.parse(view);
    expect(reloaded.self).toEqual(original.self);
    expect(reloaded.gameView).toEqual(original.gameView);
    expect(reloaded.capabilities.control).toBe(false);
    const unauthenticated = await post(origin, '/api/session/view', {});
    const anonymousView = RoomViewSchema.parse(
      ((await unauthenticated.json()) as { view: unknown }).view,
    );
    expect(anonymousView.self).toEqual({ role: 'public', seatId: null });
    expect(anonymousView.gameView).toMatchObject({
      ownSecret: null,
      results: null,
    });
  }
  expect(saved(config.dataDir)).toEqual(beforeReload);
  for (const path of ['/host', '/host/game', '/public', '/public/game']) {
    const page = await fetch(`${origin}${path}`);
    expect(page.status).toBe(200);
    expect(page.headers.get('Content-Security-Policy')).toContain(
      "frame-ancestors 'none'",
    );
    expect(await page.text()).not.toContain(service.hostToken);
  }
  const invalid = await post(origin, '/api/session/view', {
    token: requestKey(),
  });
  expect(invalid.status).toBe(401);
  const denied = await send(player, {
    type: 'set-owner',
    seatId: original.self.seatId,
  });
  expect(denied.ok).toBe(false);
  expect((await sync(player)).capabilities.control).toBe(false);
  player.disconnect();
  const reconnected = await connect(origin, playerToken, 'polling');
  expect((await sync(reconnected)).self).toEqual(original.self);
  expect((await sync(reconnected)).gameView).toEqual(original.gameView);
});

it('acknowledges authorized sync, preserves event-only clients and pushes saved changes through polling', async () => {
  const config = await fixture();
  const { service, origin } = await start(config);
  const aToken = await joinPlayer(origin, '甲');
  const bToken = await joinPlayer(origin, '乙');
  const host = await connect(origin, service.hostToken);
  const publicClient = await connect(origin, undefined, 'polling');
  const a = await connect(origin, aToken, 'polling');
  const b = await connect(origin, bToken, 'polling');
  expect(a.io.engine.transport.name).toBe('polling');
  const legacyReply = event<unknown>(publicClient, 'room:view');
  publicClient.emit('room:sync');
  expect(RoomProjectionSchema.parse(await legacyReply).view.self.role).toBe(
    'public',
  );
  expect((await sync(host)).self.role).toBe('host');
  expect((await sync(a)).self.role).toBe('player');
  expect((await sync(a)).self.seatId).not.toBe((await sync(b)).self.seatId);
  const before = await sync(a);
  const pushed = event<RoomProjection>(
    publicClient,
    'room:view',
    (projection) => projection.view.revision > before.revision,
  );
  expect((await send(a, { type: 'ready', ready: true })).ok).toBe(true);
  expect(
    RoomProjectionSchema.parse(await pushed).view.seats.find(
      (seat) => seat.id === before.self.seatId,
    )?.ready,
  ).toBe(true);
  expect(
    saved(config.dataDir).seats.find((seat) => seat.id === before.self.seatId)
      ?.ready,
  ).toBe(true);
  expect((await send(b, { type: 'ready', ready: true })).ok).toBe(true);
  expect((await send(host, { type: 'start' })).ok).toBe(true);
  const publicView = await sync(publicClient);
  const aView = await sync(a);
  const bView = await sync(b);
  expect(publicView.gameView).toMatchObject({ ownSecret: null, results: null });
  expect(aView.gameView).toMatchObject({
    ownSecret: expect.any(Number),
    results: null,
  });
  expect(bView.gameView).toMatchObject({
    ownSecret: expect.any(Number),
    results: null,
  });
  expect(publicView.actions).toEqual([]);
  expect((await sync(host)).actions).toEqual([]);
  const reconnectingSeat = aView.self.seatId;
  a.disconnect();
  const reconnected = await connect(origin, aToken, 'polling');
  expect((await sync(reconnected)).self.seatId).toBe(reconnectingSeat);
  expect((await sync(reconnected)).gameView).toEqual(aView.gameView);
});

it('approves replacement phones through saved commands, revokes the old socket and recovers the same identity after restart', async () => {
  const config = await fixture();
  const { service, origin } = await start(config);
  const oldToken = await joinPlayer(origin, '旧手机');
  const friendToken = await joinPlayer(origin, '另一位朋友');
  const host = await connect(origin, service.hostToken);
  const publicClient = await connect(origin);
  const oldPhone = await connect(origin, oldToken, 'polling');
  const friend = await connect(origin, friendToken);
  const seatId = (await sync(oldPhone)).self.seatId!;
  expect((await send(host, { type: 'set-owner', seatId })).ok).toBe(true);
  expect((await send(oldPhone, { type: 'ready', ready: true })).ok).toBe(true);
  expect((await send(friend, { type: 'ready', ready: true })).ok).toBe(true);
  expect((await send(host, { type: 'start' })).ok).toBe(true);
  const original = await sync(oldPhone);
  const canceledKey = requestKey();
  const canceledRequest = await transfer(origin, 'request', {
    seatId,
    requestKey: canceledKey,
  });
  expect(canceledRequest.status).toBe('pending');
  expect(
    (await transfer(origin, 'cancel', { requestKey: canceledKey })).status,
  ).toBe('cancelled');
  expect(
    (await transfer(origin, 'status', { requestKey: canceledKey })).status,
  ).toBe('cancelled');
  const key = requestKey();
  const pending = await transfer(origin, 'request', {
    seatId,
    requestKey: key,
  });
  expect(pending.status).toBe('pending');
  expect(pending).not.toHaveProperty('token');
  expect(
    await transfer(origin, 'request', { seatId, requestKey: key }),
  ).toEqual(pending);
  expect(await transfer(origin, 'status', { requestKey: key })).toEqual(
    pending,
  );
  const adminView = await sync(host);
  expect(adminView.transferRequests).toEqual([
    {
      requestId: pending.requestId,
      seatId,
      verificationCode: pending.verificationCode,
      expiresAt: pending.expiresAt,
    },
  ]);
  for (const viewer of [publicClient, oldPhone, friend]) {
    const projection = await sync(viewer);
    expect(projection.transferRequests).toBeUndefined();
    expect(JSON.stringify(projection)).not.toContain(pending.verificationCode);
    expect(
      await send(viewer, {
        type: 'approve-transfer',
        requestId: pending.requestId,
      }),
    ).toEqual({ ok: false, reason: 'unauthorized' });
  }
  const revoked = event<unknown>(oldPhone, 'room:revoked');
  const disconnected = event<string>(oldPhone, 'disconnect');
  const approvalEnvelope = envelope(await sync(host), {
    type: 'approve-transfer',
    requestId: pending.requestId,
  });
  const approvedCommand = CommandReplySchema.parse(
    await host.timeout(5000).emitWithAck('room:command', approvalEnvelope),
  );
  expect(approvedCommand.ok).toBe(true);
  await revoked;
  expect(await disconnected).toBe('io server disconnect');
  expect(
    CommandReplySchema.parse(
      await host.timeout(5000).emitWithAck('room:command', approvalEnvelope),
    ),
  ).toEqual(approvedCommand);
  const approved = await transfer(origin, 'status', { requestKey: key });
  if (approved.status !== 'approved')
    throw new Error('Phone replacement was not approved');
  expect(approved.token).not.toBe(oldToken);
  expect(await transfer(origin, 'status', { requestKey: key })).toEqual(
    approved,
  );
  expect(
    await transfer(origin, 'request', { seatId, requestKey: key }),
  ).toEqual(approved);
  const denied = await post(origin, '/api/session/view', { token: oldToken });
  expect(denied.status).toBe(401);
  expect(await denied.json()).toEqual({
    ok: false,
    reason: 'invalid-identity',
  });
  const invalidSocket = io(origin, {
    forceNew: true,
    autoConnect: false,
    transports: ['polling'],
    reconnection: false,
    auth: { token: oldToken },
  });
  clients.push(invalidSocket);
  const invalid = event<Error>(invalidSocket, 'connect_error');
  invalidSocket.connect();
  expect((await invalid).message).toBe('invalid-identity');
  invalidSocket.disconnect();
  const newPhone = await connect(origin, approved.token, 'polling');
  const replaced = await sync(newPhone);
  expect(replaced.self).toEqual(original.self);
  expect(replaced.ownerSeatId).toBe(seatId);
  expect(replaced.capabilities).toEqual(original.capabilities);
  expect(replaced.gameView).toEqual(original.gameView);
  expect(
    replaced.seats.map(({ id, name, avatarId, ready }) => ({
      id,
      name,
      avatarId,
      ready,
    })),
  ).toEqual(
    original.seats.map(({ id, name, avatarId, ready }) => ({
      id,
      name,
      avatarId,
      ready,
    })),
  );
  expect(replaced.seats).toHaveLength(2);
  expect((await sync(friend)).self.seatId).toBe(original.seats[1]!.id);
  const stored = JSON.stringify(saved(config.dataDir));
  for (const secret of [key, oldToken, approved.token])
    expect(stored).not.toContain(secret);
  for (const client of [host, publicClient, friend, newPhone])
    client.disconnect();
  await stop(service);
  const restarted = await start(config);
  expect(
    await transfer(restarted.origin, 'status', { requestKey: key }),
  ).toEqual(approved);
  expect(
    await transfer(restarted.origin, 'request', { seatId, requestKey: key }),
  ).toEqual(approved);
  expect(
    (await post(restarted.origin, '/api/session/view', { token: oldToken }))
      .status,
  ).toBe(401);
  const restoredPhone = await connect(
    restarted.origin,
    approved.token,
    'polling',
  );
  const restored = await sync(restoredPhone);
  expect(restored.self).toEqual(original.self);
  expect(restored.ownerSeatId).toBe(seatId);
  expect(restored.gameView).toEqual(original.gameView);
  expect(restored.seats).toHaveLength(2);
});
