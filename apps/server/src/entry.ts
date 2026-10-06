import { createService } from './service';
import { ServiceConfigSchema } from '@tablemax/protocol';
import type { ServiceConfig } from '@tablemax/protocol';
import { join } from 'node:path';
import { writeSync } from 'node:fs';
import { DesktopPipe, DesktopPipeError } from './desktop-pipe';

interface ParentPort {
  on(event: 'message', callback: (event: { data: unknown }) => void): void;
  postMessage(value: unknown): void;
}
const parentPort = (process as NodeJS.Process & { parentPort?: ParentPort })
  .parentPort;
const privatePipe = process.argv.includes('--desktop-pipe');
let pipe: DesktopPipe | undefined;
let service: Awaited<ReturnType<typeof createService>> | undefined;
let startup: Promise<void> | undefined;
let closing: Promise<void> | undefined;
let stopping = false;
let failing = false;

async function start(config: ServiceConfig) {
  let lastProgress = -Infinity;
  service = await createService(
    {
      ...config,
      botWorkerPath: config.botWorkerPath ?? join(__dirname, 'bot-worker.cjs'),
    },
    undefined,
    () => {
      if (!privatePipe || performance.now() - lastProgress < 1000) return;
      lastProgress = performance.now();
      // Migration is synchronous: a timer/queued stream write cannot deliver
      // heartbeats while SQLite imports and verifies the historical journal.
      writeSync(1, '{"type":"startup-progress","stage":"save-migration"}\n');
    },
  );
  const port = await service.listen();
  // EOF or stop can arrive while SQLite and the HTTP listener are opening.
  if (stopping) return;
  const ready = {
    type: 'ready',
    port,
    health: service.health,
    hostToken: service.hostToken,
  };
  if (pipe) await pipe.send(ready);
  else if (parentPort) parentPort.postMessage(ready);
  else
    console.log(
      JSON.stringify({ type: 'ready', port, health: service.health }),
    );
}

function begin(config: ServiceConfig) {
  startup = start(config);
  void startup.catch(fail);
}

async function close() {
  await startup?.catch(() => undefined);
  closing ??= service?.close() ?? Promise.resolve();
  await closing;
}

async function stop() {
  if (stopping) return;
  stopping = true;
  await close();
  if (!failing) process.exit(0);
}

function safeError(error: unknown) {
  if (error instanceof DesktopPipeError)
    return { message: error.message, code: error.code };
  const detail = error instanceof Error ? error.message : '';
  const rawCode =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
  const code = /^[A-Z][A-Z0-9_]{0,63}$/.test(rawCode) ? rawCode : null;
  // Keep actionable categories without echoing config, paths, JSON, or secrets.
  let message = 'Service startup failed';
  if (/incompatible|Unsupported foundation database version/.test(detail))
    message = 'incompatible-save-database';
  else if (/damaged|SQLITE_CORRUPT|malformed|not a database/.test(detail))
    message = 'damaged-save-database';
  else if (
    /readonly|read-only|disk is full|unable to open database/.test(detail)
  )
    message = 'Data directory is read-only or unavailable';
  return { message, code };
}

async function fail(error: unknown) {
  if (failing) return;
  failing = true;
  stopping = true;
  const reported = safeError(error);
  console.error(reported.message);
  await close().catch(() => undefined);
  const message = { type: 'error', ...reported };
  if (pipe) await pipe.send(message).catch(() => undefined);
  else parentPort?.postMessage(message);
  process.exit(1);
}

process.on('SIGINT', () => void stop().catch(fail));
process.on('SIGTERM', () => void stop().catch(fail));

if (privatePipe) {
  process.stdout.on('error', () => void stop().catch(fail));
  pipe = new DesktopPipe(
    process.stdin,
    process.stdout,
    (message) => {
      if (message.type === 'stop') {
        if (!startup)
          void fail(new DesktopPipeError('INVALID_DESKTOP_MESSAGE'));
        else void stop().catch(fail);
      } else if (startup || stopping) {
        void fail(new DesktopPipeError('INVALID_DESKTOP_MESSAGE'));
      } else {
        begin(message.config);
      }
    },
    () => void stop().catch(fail),
    (error) => void fail(error),
  );
} else if (parentPort) {
  parentPort.on('message', (event) => {
    if (startup) {
      if (
        typeof event.data === 'object' &&
        event.data !== null &&
        'type' in event.data &&
        event.data.type === 'stop'
      ) {
        void stop().catch(fail);
      }
      return;
    }
    try {
      begin(ServiceConfigSchema.parse(event.data));
    } catch (error) {
      void fail(error);
    }
  });
} else {
  try {
    begin(
      ServiceConfigSchema.parse({
        host: process.env.TABLEMAX_HOST ?? '127.0.0.1',
        port: Number(process.env.TABLEMAX_PORT ?? 38473),
        dataDir: process.env.TABLEMAX_DATA_DIR,
        webDir: process.env.TABLEMAX_WEB_DIR,
        playMode: process.env.TABLEMAX_PLAY_MODE,
      }),
    );
  } catch (error) {
    void fail(error);
  }
}
