import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createService } from './service';

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
    for (const path of ['/host', '/public', '/player']) {
      expect((await service.app.inject(path)).body).toContain('local fixture');
    }
    expect((await service.app.inject('/api/missing')).statusCode).toBe(404);
    expect(
      (await service.app.inject('/api/foundation/qr?address=example.com'))
        .statusCode,
    ).toBe(400);
  } finally {
    await service.close();
  }
});
