import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { prepareModuleFixture } from '../../../scripts/fixtures/prepare-module-fixture';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createServer } from 'node:net';
import { io } from 'socket.io-client';
import {
  ServiceReadySchema,
  type ServiceConfig,
  type Command,
  type CommandReply,
  type RoomView,
} from '@tablemax/protocol';

const directory = mkdtempSync(join(tmpdir(), 'tablemax-entry-'));
const bundle = join(directory, 'server.cjs');
const children: ChildProcessWithoutNullStreams[] = [];
let fixtureCount = 0;

beforeAll(async () => {
  await prepareModuleFixture(directory);
  await build({
    entryPoints: [resolve('apps/server/src/entry.ts')],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    logLevel: 'silent',
  });
});

afterEach(async () => {
  await Promise.all(
    children.splice(0).map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const closed = new Promise<void>((done) =>
        child.once('close', () => done()),
      );
      child.kill('SIGKILL');
      await closed;
    }),
  );
});

afterAll(() => rmSync(directory, { recursive: true, force: true }));

function configuration(): ServiceConfig {
  const dataDir = join(directory, `data-${fixtureCount++}`);
  const webDir = join(dataDir, 'web');
  mkdirSync(webDir, { recursive: true });
  writeFileSync(join(webDir, 'index.html'), '<html>local entry fixture</html>');
  return { host: '127.0.0.1', port: 0, dataDir, webDir, playMode: 'test' };
}

function launch(config?: ServiceConfig) {
  const child = spawn(
    process.execPath,
    [bundle, ...(config ? [] : ['--desktop-pipe'])],
    {
      cwd: directory,
      windowsHide: true,
      env: {
        ...process.env,
        ...(config
          ? {
              TABLEMAX_HOST: config.host,
              TABLEMAX_PORT: String(config.port),
              TABLEMAX_DATA_DIR: config.dataDir,
              TABLEMAX_WEB_DIR: config.webDir,
              TABLEMAX_PLAY_MODE: config.playMode,
            }
          : {}),
      },
    },
  );
  children.push(child);
  let stdout = '';
  let stderr = '';
  const messages: unknown[] = [];
  const exited = new Promise<number | null>((done) =>
    child.once('close', (code) => done(code)),
  );
  child.stdout
    .setEncoding('utf8')
    .on('data', (text: string) => (stdout += text));
  child.stderr
    .setEncoding('utf8')
    .on('data', (text: string) => (stderr += text));
  createInterface({ input: child.stdout }).on('line', (line) => {
    messages.push(JSON.parse(line));
  });
  const first = async () => {
    await expect
      .poll(() => messages.length, { timeout: 5_000 })
      .toBeGreaterThan(0);
    return messages[0];
  };
  return {
    child,
    messages,
    exited,
    first,
    output: () => ({ stdout, stderr }),
    send: (value: unknown) => child.stdin.write(`${JSON.stringify(value)}\n`),
  };
}

async function post(port: number, path: string, body: unknown) {
  return (
    await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  ).json();
}

async function command(
  port: number,
  token: string,
  action: Command['command'],
) {
  const { view }: { view: RoomView } = await post(port, '/api/session/view', {
    token,
  });
  const socket = io(`http://127.0.0.1:${port}`, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  try {
    return await new Promise<CommandReply>((done, reject) =>
      socket.timeout(3_000).emit(
        'room:command',
        {
          actionId: crypto.randomUUID(),
          instanceId: view.instanceId,
          revision: view.revision,
          branch: view.branch,
          command: action,
        },
        (error: Error | null, reply: CommandReply) =>
          error ? reject(error) : done(reply),
      ),
    );
  } finally {
    socket.disconnect();
  }
}

it('starts only after a private config, hands credentials to the parent, saves and restores identities', async () => {
  const config = configuration();
  const running = launch();
  running.send({ type: 'start', config });
  const ready = ServiceReadySchema.parse(await running.first());
  expect((await post(ready.port, '/api/session/view', {})).view.self.role).toBe(
    'public',
  );
  expect(
    (await post(ready.port, '/api/session/view', { token: ready.hostToken }))
      .view.self.role,
  ).toBe('host');
  expect(
    (
      await command(ready.port, ready.hostToken, {
        type: 'select-game',
        gameId: 'pokemon-encounters',
      })
    ).ok,
  ).toBe(true);
  const player = await post(ready.port, '/api/session/join', {
    name: '管道恢复玩家',
  });
  const before = (
    await post(ready.port, '/api/session/view', { token: player.token })
  ).view;
  running.send({ type: 'stop' });
  expect(await running.exited).toBe(0);
  expect(running.output().stderr).not.toContain(ready.hostToken);
  expect(
    readFileSync(join(config.dataDir, 'logs/service.log'), 'utf8'),
  ).not.toContain(ready.hostToken);
  expect(
    readFileSync(join(config.dataDir, 'logs/service.log'), 'utf8'),
  ).toContain('service-stopped');

  const restarted = launch();
  restarted.send({ type: 'start', config });
  const next = ServiceReadySchema.parse(await restarted.first());
  const restored = (
    await post(next.port, '/api/session/view', { token: player.token })
  ).view;
  expect(restored.self).toEqual(before.self);
  expect(restored.instanceId).toBe(before.instanceId);
  expect(restored.revision).toBe(before.revision);
  expect(next.hostToken).not.toBe(ready.hostToken);
  restarted.child.stdin.end();
  expect(await restarted.exited).toBe(0);
}, 15_000);

it.each(['stop', 'eof'] as const)(
  'handles %s while the service is still starting',
  async (method) => {
    const config = configuration();
    const running = launch();
    running.send({ type: 'start', config });
    if (method === 'stop') running.send({ type: 'stop' });
    else running.child.stdin.end();
    expect(await running.exited).toBe(0);
    // Windows can deliver pipe EOF after the ready write has already flushed.
    expect(running.messages.length).toBeLessThanOrEqual(1);
    for (const message of running.messages) ServiceReadySchema.parse(message);
    expect(
      readFileSync(join(config.dataDir, 'logs/service.log'), 'utf8'),
    ).toContain('service-stopped');
  },
);

it('ends without creating a service when the private parent closes before config', async () => {
  const running = launch();
  running.child.stdin.end();
  expect(await running.exited).toBe(0);
  expect(running.output().stdout).toBe('');
});

it.each([
  {
    label: 'invalid config',
    message: { type: 'start', config: { secret: 'must-not-be-logged' } },
    code: 'INVALID_DESKTOP_CONFIG',
  },
  {
    label: 'unknown message',
    message: { type: 'unknown', secret: 'must-not-be-logged' },
    code: 'INVALID_DESKTOP_MESSAGE',
  },
  {
    label: 'extra fields',
    message: { type: 'stop', secret: 'must-not-be-logged' },
    code: 'INVALID_DESKTOP_MESSAGE',
  },
  {
    label: 'stop before start',
    message: { type: 'stop' },
    code: 'INVALID_DESKTOP_MESSAGE',
  },
])(
  'rejects $label with no input reflected in diagnostics',
  async ({ message, code }) => {
    const running = launch();
    running.send(message);
    expect(await running.first()).toEqual({
      type: 'error',
      message: 'Invalid desktop service message',
      code,
    });
    expect(await running.exited).toBe(1);
    expect(JSON.stringify(running.output())).not.toContain(
      'must-not-be-logged',
    );
  },
);

it.each([
  {
    label: 'malformed JSON',
    raw: '{"secret":"must-not-be-logged"',
    code: 'INVALID_DESKTOP_MESSAGE',
  },
  {
    label: 'oversize message',
    raw: 'x'.repeat(16 * 1024 + 1),
    code: 'DESKTOP_MESSAGE_TOO_LARGE',
  },
])(
  'rejects $label and flushes the error before exit',
  async ({ raw, code }) => {
    const running = launch();
    running.child.stdin.write(`${raw}\n`);
    expect(await running.first()).toEqual({
      type: 'error',
      message: 'Invalid desktop service message',
      code,
    });
    expect(await running.exited).toBe(1);
    expect(JSON.stringify(running.output())).not.toContain(
      'must-not-be-logged',
    );
  },
);

it('rejects a second start and gracefully closes the already running service', async () => {
  const config = configuration();
  const running = launch();
  running.send({ type: 'start', config });
  await running.first();
  running.send({ type: 'start', config });
  expect(await running.exited).toBe(1);
  expect(running.messages).toHaveLength(2);
  expect(running.messages[1]).toEqual({
    type: 'error',
    message: 'Invalid desktop service message',
    code: 'INVALID_DESKTOP_MESSAGE',
  });
  expect(
    readFileSync(join(config.dataDir, 'logs/service.log'), 'utf8'),
  ).toContain('service-stopped');
});

it('reports a port conflict safely and preserves a damaged save file', async () => {
  const listener = createServer();
  await new Promise<void>((done) => listener.listen(0, '127.0.0.1', done));
  try {
    const config = configuration();
    config.port = (listener.address() as { port: number }).port;
    const running = launch();
    running.send({ type: 'start', config });
    expect(await running.first()).toMatchObject({
      type: 'error',
      code: 'EADDRINUSE',
    });
    expect(await running.exited).toBe(1);
    expect(running.output().stderr).not.toContain(config.dataDir);
  } finally {
    await new Promise<void>((done) => listener.close(() => done()));
  }
  const config = configuration();
  const file = join(config.dataDir, 'room.sqlite');
  const corrupted = Buffer.from('intentionally damaged SQLite original');
  writeFileSync(file, corrupted);
  const running = launch();
  running.send({ type: 'start', config });
  expect(await running.first()).toMatchObject({
    type: 'error',
    message: 'damaged-save-database',
  });
  expect(await running.exited).toBe(1);
  expect(readFileSync(file)).toEqual(corrupted);
});

it('keeps ordinary standalone stdout sanitized and ignores private stdin commands', async () => {
  const running = launch(configuration());
  const first = await running.first();
  expect(first).toMatchObject({
    type: 'ready',
    health: { protocolVersion: 6 },
  });
  expect(first).not.toHaveProperty('hostToken');
  running.send({ type: 'stop' });
  running.child.stdin.end();
  expect(running.child.exitCode).toBeNull();
  expect(running.output().stdout).not.toContain('hostToken');
});
