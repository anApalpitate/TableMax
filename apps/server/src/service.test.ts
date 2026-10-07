import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createService } from './service';
import { createConnection } from 'node:net';

it('serves role routes, rejects unknown APIs, and keeps data paths private', async () => {
  const webDir = mkdtempSync(join(tmpdir(), 'tablemax-web-'));
  const dataDir = mkdtempSync(join(tmpdir(), 'tablemax-service-'));
  writeFileSync(join(webDir, 'index.html'), '<html>local fixture</html>');
  const service = await createService({
    host: '127.0.0.1',
    port: 0,
    webDir,
    dataDir,
  });
  try {
    const health = await service.app.inject('/api/foundation/health');
    expect(health.statusCode).toBe(200);
    expect(health.body).not.toContain(dataDir);
    for (const path of [
      '/host',
      '/public',
      '/player',
      '/host/game',
      '/public/game',
      '/player/game',
    ]) {
      const page = await service.app.inject(path);
      expect(page.body).toContain('local fixture');
      expect(page.headers['content-security-policy']).toContain(
        `frame-ancestors ${path.startsWith('/player') ? "'self'" : "'none'"}`,
      );
    }
    expect((await service.app.inject('/api/missing')).statusCode).toBe(404);
    const hostJoin = await service.app.inject({
      method: 'POST',
      url: '/api/session/join',
      payload: { name: '管理员', hostToken: service.hostToken },
    });
    expect(hostJoin.statusCode).toBe(400);
    expect(service.room.view(service.hostToken).self).toEqual({
      role: 'host',
      seatId: null,
    });
    expect(service.room.view().seats).toEqual([]);
    expect(
      (await service.app.inject('/api/foundation/qr?address=example.com'))
        .statusCode,
    ).toBe(400);
  } finally {
    await service.close();
  }
});

it('closes the service with an unfinished offline phone request and records clean shutdown', async () => {
  const webDir = mkdtempSync(join(tmpdir(), 'tablemax-web-'));
  const dataDir = mkdtempSync(join(tmpdir(), 'tablemax-service-'));
  writeFileSync(join(webDir, 'index.html'), '<html>local fixture</html>');
  const service = await createService({
    host: '127.0.0.1',
    port: 0,
    webDir,
    dataDir,
  });
  const port = await service.listen();
  const socket = createConnection({ host: '127.0.0.1', port });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    socket.write(
      'POST /api/session/join HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 200\r\n\r\n{',
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    await Promise.race([
      service.close(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Shutdown held by incomplete HTTP request')),
          1500,
        );
      }),
    ]);
    expect(readFileSync(join(dataDir, 'logs/service.log'), 'utf8')).toContain(
      'service-stopped',
    );
  } finally {
    if (timer) clearTimeout(timer);
    socket.destroy();
    await service.close();
  }
});
