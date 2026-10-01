import { it, expect } from 'vitest';
import { fork } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { io } from 'socket.io-client';
import { createService } from './service';
import type { CommandReply } from '@tablemax/protocol';

it('recovers a transaction ACK after forcibly killing the actual server process', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tablemax-crash-'));
  const path = join(dir, 'server.cjs');
  const webDir = join(dir, 'web');
  const { mkdirSync } = await import('node:fs');
  mkdirSync(webDir);
  writeFileSync(join(webDir, 'index.html'), '<html>fixture</html>');
  await build({
    entryPoints: [resolve('scripts/fixtures/crash-service.ts')],
    outfile: path,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
  });
  const child = fork(path, [], {
    env: {
      ...process.env,
      TABLEMAX_CRASH_DATA: dir,
      TABLEMAX_CRASH_WEB: webDir,
    },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  const exited = new Promise<void>((r) => child.once('exit', () => r()));
  const ready = await new Promise<{ port: number; hostToken: string }>(
    (r, reject) => {
      child.once('message', (m) => r(m as { port: number; hostToken: string }));
      child.once('error', reject);
      child.once('exit', () =>
        reject(new Error('crash fixture exited before ready')),
      );
    },
  );
  const origin = `http://127.0.0.1:${ready.port}`;
  const post = async (url: string, body: unknown) =>
    (
      await fetch(`${origin}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    ).json();
  const host = io(origin, {
    auth: { token: ready.hostToken },
    transports: ['websocket'],
  });
  const send = async (command: unknown) => {
    const { view } = await post('/api/session/view', {
      token: ready.hostToken,
    });
    return new Promise<CommandReply>((r, reject) =>
      host.timeout(2000).emit(
        'room:command',
        {
          actionId: crypto.randomUUID(),
          instanceId: view.instanceId,
          revision: view.revision,
          branch: view.branch,
          command,
        },
        (error: Error | null, result: CommandReply) =>
          error ? reject(error) : r(result),
      ),
    );
  };
  try {
    const player = await post('/api/session/join', { name: '恢复玩家' });
    const p = io(origin, {
      auth: { token: player.token },
      transports: ['websocket'],
    });
    try {
      const { view } = await post('/api/session/view', { token: player.token });
      await new Promise<CommandReply>((r) =>
        p.emit(
          'room:command',
          {
            actionId: 'ready',
            instanceId: view.instanceId,
            revision: view.revision,
            branch: view.branch,
            command: { type: 'ready', ready: true },
          },
          r,
        ),
      );
      await send({ type: 'add-bot', name: '恢复电脑' });
      expect((await send({ type: 'start' })).ok).toBe(true);
      const before = (await post('/api/session/view', { token: player.token }))
        .view;
      child.kill('SIGKILL');
      await exited;
      const restored = await createService({
        dataDir: dir,
        webDir,
        host: '127.0.0.1',
        port: 0,
      });
      try {
        expect(restored.room.view(player.token).gameView).toEqual(
          before.gameView,
        );
        expect(restored.room.view().paused).toBe(true);
        expect(restored.room.view().revision).toBeGreaterThan(before.revision);
      } finally {
        await restored.close();
      }
    } finally {
      p.disconnect();
    }
  } finally {
    host.disconnect();
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL');
    await exited;
  }
}, 15_000);
