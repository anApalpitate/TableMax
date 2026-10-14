import { expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { GameRegistry } from '@tablemax/platform-core';
import { rules, bot } from '../../../games/template';
import { createService } from './service';
import { SqliteSaveRepository } from './save-repository';
import { io } from 'socket.io-client';
import type { Save } from '@tablemax/platform-core';

it('keeps SQLite open until an admitted asynchronous game selection has saved', async () => {
  mkdirSync('tmp', { recursive: true });
  const work = mkdtempSync(resolve('tmp/shutdown-service-'));
  const webDir = join(work, 'web');
  const dataDir = join(work, 'data');
  mkdirSync(webDir);
  writeFileSync(join(webDir, 'index.html'), '<html>shutdown fixture</html>');
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  const loading = new Promise<void>((done) => {
    started = done;
  });
  const registry = new GameRegistry([
    {
      catalog: {
        id: rules.manifest.id,
        name: rules.manifest.name,
        ...rules.manifest.players,
      },
      async load() {
        started();
        await gate;
        return { rules, bot };
      },
    },
  ]);
  const closed = vi.spyOn(SqliteSaveRepository.prototype, 'close');
  const service = await createService(
    { host: '127.0.0.1', port: 0, webDir, dataDir },
    registry,
  );
  const view = service.room.view(service.hostToken);
  const command = service.room.command(service.hostToken, {
    actionId: randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command: { type: 'select-game', gameId: rules.manifest.id },
  });
  await loading;
  const closing = service.close();
  try {
    await new Promise<void>((done) => setImmediate(done));
    expect(closed).not.toHaveBeenCalled();
    expect(service.close()).toBe(closing);
    await expect(service.room.join('关闭后')).rejects.toThrow(
      'service-closing',
    );
    release();
    expect((await command).ok).toBe(true);
    expect(await closing).toBe('drained');
    expect(closed).toHaveBeenCalledTimes(1);
    const reopened = new SqliteSaveRepository(dataDir);
    try {
      expect((reopened.load() as Save | null)?.manifest?.id).toBe(
        rules.manifest.id,
      );
    } finally {
      reopened.close();
    }
  } finally {
    release();
    await command;
    await closing;
    closed.mockRestore();
  }
});

it('returns save-failed after closing both databases and retains the last committed room', async () => {
  mkdirSync('tmp', { recursive: true });
  const work = mkdtempSync(resolve('tmp/shutdown-service-'));
  const webDir = join(work, 'web');
  const dataDir = join(work, 'data');
  mkdirSync(webDir);
  writeFileSync(join(webDir, 'index.html'), '<html>fixture</html>');
  const service = await createService(
    { host: '127.0.0.1', port: 0, webDir, dataDir },
    { rules, bot },
  );
  await service.room.join('原玩家');
  const write = vi
    .spyOn(SqliteSaveRepository.prototype, 'save')
    .mockImplementation(() => {
      throw new Error('fixture-save-failed');
    });
  try {
    const pending = service.room.join('未保存');
    const rejected = expect(pending).rejects.toThrow('fixture-save-failed');
    const closing = service.close();
    await rejected;
    expect(await closing).toBe('save-failed');
    write.mockRestore();
    const reopened = new SqliteSaveRepository(dataDir);
    try {
      expect((reopened.load() as Save).seats.map((s) => s.name)).toEqual([
        '原玩家',
      ]);
    } finally {
      reopened.close();
    }
  } finally {
    write.mockRestore();
    await service.close();
  }
});

it('drains a real Socket command and refuses a second command during the close barrier', async () => {
  mkdirSync('tmp', { recursive: true });
  const work = mkdtempSync(resolve('tmp/shutdown-service-'));
  const webDir = join(work, 'web');
  const dataDir = join(work, 'data');
  mkdirSync(webDir);
  writeFileSync(join(webDir, 'index.html'), '<html>fixture</html>');
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  const loading = new Promise<void>((done) => {
    entered = done;
  });
  const registry = new GameRegistry([
    {
      catalog: {
        id: rules.manifest.id,
        name: rules.manifest.name,
        ...rules.manifest.players,
      },
      async load() {
        entered();
        await gate;
        return { rules, bot };
      },
    },
  ]);
  const service = await createService(
    { host: '127.0.0.1', port: 0, webDir, dataDir },
    registry,
  );
  const port = await service.listen();
  const socket = io(`http://127.0.0.1:${port}`, {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket'],
    auth: { token: service.hostToken },
  });
  const ready = new Promise<void>((done, reject) => {
    socket.once('connect', done);
    socket.once('connect_error', reject);
  });
  socket.connect();
  try {
    await ready;
    const view = service.room.view(service.hostToken);
    const make = () => ({
      actionId: randomUUID(),
      instanceId: view.instanceId,
      revision: view.revision,
      branch: view.branch,
      command: { type: 'select-game', gameId: rules.manifest.id },
    });
    const admitted = socket
      .timeout(2000)
      .emitWithAck('room:command', make())
      .catch(() => null);
    await loading;
    const closing = service.close();
    expect(
      await socket.timeout(1000).emitWithAck('room:command', make()),
    ).toEqual({ ok: false, reason: 'service-closing' });
    release();
    expect(await closing).toBe('drained');
    await admitted;
    const reopened = new SqliteSaveRepository(dataDir);
    try {
      expect((reopened.load() as Save).manifest!.id).toBe(rules.manifest.id);
    } finally {
      reopened.close();
    }
  } finally {
    release();
    socket.disconnect();
    await service.close();
  }
});
