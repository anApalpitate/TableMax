import { createService } from './service';
import { ServiceConfigSchema } from '@tablemax/protocol';
import type { ServiceConfig } from '@tablemax/protocol';
import { join } from 'node:path';

interface ParentPort {
  on(event: 'message', callback: (event: { data: unknown }) => void): void;
  postMessage(value: unknown): void;
}
const parentPort = (process as NodeJS.Process & { parentPort?: ParentPort })
  .parentPort;

async function start(config: ServiceConfig) {
  const service = await createService({
    ...config,
    botWorkerPath: config.botWorkerPath ?? join(__dirname, 'bot-worker.cjs'),
  });
  const port = await service.listen();
  const ready = {
    type: 'ready',
    port,
    health: service.health,
    hostToken: service.hostToken,
  };
  if (parentPort) parentPort.postMessage(ready);
  else
    console.log(
      JSON.stringify({ type: 'ready', port, health: service.health }),
    );

  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    await service.close();
    process.exit(0);
  }
  parentPort?.on('message', (event) => {
    if (
      typeof event.data === 'object' &&
      event.data !== null &&
      'type' in event.data &&
      event.data.type === 'stop'
    ) {
      void stop().catch(fail);
    }
  });
  process.on('SIGINT', () => void stop().catch(fail));
  process.on('SIGTERM', () => void stop().catch(fail));
}

function fail(error: unknown) {
  console.error(
    error instanceof Error ? error.message : 'Service startup failed',
  );
  parentPort?.postMessage({
    type: 'error',
    message: error instanceof Error ? error.message : 'Service startup failed',
  });
  process.exit(1);
}

if (parentPort) {
  let started = false;
  parentPort.on('message', (event) => {
    if (started) return;
    started = true;
    try {
      void start(ServiceConfigSchema.parse(event.data)).catch(fail);
    } catch (error) {
      fail(error);
    }
  });
} else {
  try {
    void start(
      ServiceConfigSchema.parse({
        host: process.env.TABLEMAX_HOST ?? '127.0.0.1',
        port: Number(process.env.TABLEMAX_PORT ?? 38473),
        dataDir: process.env.TABLEMAX_DATA_DIR,
        webDir: process.env.TABLEMAX_WEB_DIR,
      }),
    ).catch(fail);
  } catch (error) {
    fail(error);
  }
}
