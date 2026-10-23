import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createService } from './service';
import { createConnection } from 'node:net';
import { GameRegistry } from '@tablemax/platform-core';

it('serves role routes, rejects unknown APIs, and keeps data paths private', async () => {
  const webDir = mkdtempSync(join(tmpdir(), 'tablemax-web-'));
  const dataDir = mkdtempSync(join(tmpdir(), 'tablemax-service-'));
  writeFileSync(join(webDir, 'index.html'), '<html>local fixture</html>');
  writeFileSync(join(webDir, 'fixture.js'), 'export const fixture = true;');
  const service = await createService(
    {
      host: '127.0.0.1',
      port: 0,
      webDir,
      dataDir,
    },
    new GameRegistry([]),
  );
  try {
    const health = await service.app.inject('/api/foundation/health');
    expect(health.statusCode).toBe(200);
    expect(health.body).not.toContain(dataDir);
    const asset = await service.app.inject('/fixture.js');
    expect(asset.statusCode).toBe(200);
    expect(asset.body).toBe('export const fixture = true;');
    expect(asset.headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
    for (const path of [
      '/',
      '/?invite=friend',
      '/host',
      '/host/',
      '/host?invite=friend',
      '/player',
      '/player/',
      '/player?invite=friend',
      '/host/game',
      '/host/game/',
      '/player/game',
      '/player/game/',
      '/player/game?choice=test',
    ]) {
      const page = await service.app.inject(path);
      expect(page.statusCode).toBe(200);
      expect(page.body).toContain('local fixture');
      expect(page.body).not.toContain(service.hostToken);
      expect(page.headers['content-security-policy']).toContain(
        `frame-ancestors ${path === '/' || path.startsWith('/?') || path.startsWith('/player') ? "'self'" : "'none'"}`,
      );
    }
    for (const path of [
      '/public',
      '/public/',
      '/public/game',
      '/public/game/',
    ]) {
      for (const suffix of [
        '',
        '?token=old-public-token&host=old-host-token',
      ]) {
        const page = await service.app.inject(path + suffix);
        expect(page.statusCode).toBe(410);
        expect(page.headers['content-type']).toContain('text/html');
        expect(page.headers['cache-control']).toBe('no-store');
        expect(page.headers.location).toBeUndefined();
        expect(page.headers['content-security-policy']).toContain(
          "frame-ancestors 'none'",
        );
        expect(page.body).toContain('独立公共屏已停用');
        expect(page.body).toContain('<a href="/">进入玩家页面</a>');
        expect(page.body).not.toMatch(/<script\b|\/host\b|local fixture/);
        expect(page.body).not.toContain('old-public-token');
        expect(page.body).not.toContain('old-host-token');
        expect(page.body).not.toContain(service.hostToken);
      }
    }
    for (const path of [
      '/api/health',
      '/player/admin',
      '/player-other',
      '/game',
      '/public/extra',
      '/public/game/extra',
      '/publicity',
      '/public/game-other',
      '/player//',
      '/host//',
      '/public//',
      '/public/game//',
    ]) {
      const page = await service.app.inject(path);
      expect(page.statusCode).toBe(404);
      expect(page.headers['content-security-policy']).toContain(
        "frame-ancestors 'none'",
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
    const anonymous = await service.app.inject({
      method: 'POST',
      url: '/api/session/view',
      payload: {},
    });
    expect(anonymous.statusCode).toBe(200);
    expect(anonymous.json().view).toMatchObject({
      self: { role: 'public', seatId: null },
      capabilities: { manage: false, manageSeats: false, control: false },
      actions: [],
      lifecycleActions: [],
    });
    const forgedRole = await service.app.inject({
      method: 'POST',
      url: '/api/session/view',
      payload: { role: 'host' },
    });
    expect(forgedRole.statusCode).toBe(400);
    const invalidIdentity = await service.app.inject({
      method: 'POST',
      url: '/api/session/view',
      payload: { token: 'x'.repeat(32) },
    });
    expect(invalidIdentity.statusCode).toBe(401);
    expect(invalidIdentity.json()).toEqual({
      ok: false,
      reason: 'invalid-identity',
    });
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
  const service = await createService(
    {
      host: '127.0.0.1',
      port: 0,
      webDir,
      dataDir,
    },
    new GameRegistry([]),
  );
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
