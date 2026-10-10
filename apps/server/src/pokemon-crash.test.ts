import { it, expect } from 'vitest';
import { build } from 'esbuild';
import { fork } from 'node:child_process';
import { join, resolve } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { io, type Socket } from 'socket.io-client';
import type { RoomView, CommandReply, Command } from '@tablemax/protocol';
import { prepare } from '../../../tools/test/fixtures/prepare-pokemon';
import { createService } from './service';
import { prepareModuleFixture } from '../../../tools/test/fixtures/prepare-module-fixture';
import { safeHttpPort } from '../../../tools/test/fixtures/safe-http-port';

it.each([
  {
    id: 'V08',
    actions: [
      { type: 'draw', source: 'deck' },
      { type: 'replace', slot: 1 },
      { type: 'peek', slot: 2 },
    ],
  },
  {
    id: 'V06',
    actions: [
      { type: 'draw', source: 'deck' },
      { type: 'replace', slot: 5 },
    ],
  },
  { id: 'V05', actions: [{ type: 'draw', source: 'deck' }] },
])(
  'V15 recovers a real SIGKILL at $id confirmed ability boundary without revealing another seat',
  async ({ id, actions }) => {
    const dir = mkdtempSync(join(tmpdir(), 'tablemax-pokemon-kill-')),
      webDir = join(dir, 'web');
    mkdirSync(webDir);
    writeFileSync(join(webDir, 'index.html'), '<html>fixture</html>');
    const players = await prepare(id, dir);
    const file = join(dir, 'crash.cjs');
    await prepareModuleFixture(dir);
    await build({
      entryPoints: [resolve('tools/test/fixtures/crash-pokemon.ts')],
      outfile: file,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      logLevel: 'silent',
    });
    const child = fork(file, [], {
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      env: {
        ...process.env,
        TABLEMAX_CRASH_DATA: dir,
        TABLEMAX_CRASH_WEB: webDir,
        TABLEMAX_CRASH_PORT: String(await safeHttpPort()),
      },
    });
    const exited = new Promise<void>((r) => child.once('exit', () => r()));
    const clients: Socket[] = [];
    const ready = await new Promise<{ port: number; hostToken: string }>(
      (r, reject) => {
        child.once('message', r);
        child.once('error', reject);
        child.once('exit', () => reject(new Error('Exited before ready')));
      },
    );
    const origin = `http://127.0.0.1:${ready.port}`;
    const view = async (token?: string): Promise<RoomView> =>
      (
        await (
          await fetch(`${origin}/api/session/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(token ? { token } : {}),
          })
        ).json()
      ).view;
    const send = async (token: string, command: Command['command']) => {
      const socket = io(origin, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
      });
      clients.push(socket);
      const current = await view(token);
      return new Promise<CommandReply>((r, reject) =>
        socket.timeout(5000).emit(
          'room:command',
          {
            actionId: crypto.randomUUID(),
            instanceId: current.instanceId,
            revision: current.revision,
            branch: current.branch,
            command,
          },
          (error: Error | null, reply: CommandReply) =>
            error ? reject(error) : r(reply),
        ),
      );
    };
    try {
      expect((await send(ready.hostToken, { type: 'resume' })).ok).toBe(true);
      for (const action of actions) {
        const current = await view(players[0]!.token);
        expect(
          (
            await send(players[0]!.token, {
              type: 'game',
              decisionId: current.decisionId!,
              action,
            })
          ).ok,
        ).toBe(true);
      }
      const before = await view(players[0]!.token);
      child.kill('SIGKILL');
      await exited;
      const service = await createService({
        host: '127.0.0.1',
        port: await safeHttpPort(),
        dataDir: dir,
        webDir,
      });
      try {
        expect(service.room.view(players[0]!.token).gameView).toEqual(
          before.gameView,
        );
        expect(service.room.view().paused).toBe(true);
        expect(service.room.view().branch).toBeGreaterThan(before.branch);
        expect(
          (service.room.view(players[1]!.token).gameView as { peek: unknown })
            .peek,
        ).toBeNull();
        expect(
          (service.room.view().gameView as { peek: unknown }).peek,
        ).toBeNull();
      } finally {
        await service.close();
      }
    } finally {
      clients.forEach((socket) => socket.disconnect());
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGKILL');
      await exited;
    }
  },
  20000,
);
