import { it, expect } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  renameSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { createService } from '../service';
import { PackageStore } from './store';
import { PROJECT_GAME_PUBLIC_KEY } from './project-public-key';
import { WorkerBotExecutor } from '../bot-executor';
import type { Command } from '@tablemax/protocol';
import type { SignedCatalog } from './types';

const artifacts = resolve('artifacts/game-packages/v1.0.6');
const signedCatalog = JSON.parse(
  readFileSync(join(artifacts, 'TableMax-game-catalog-v1.0.6.json'), 'utf8'),
) as SignedCatalog;
const unoPack = signedCatalog.payload.releases.find(
  (release) => release.gameId === 'uno',
)!.offlineAsset!;
function fixture() {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/package-service-'));
  const webDir = join(root, 'web'),
    dataDir = join(root, 'data'),
    gamesDir = join(root, 'games');
  mkdirSync(webDir);
  mkdirSync(dataDir);
  writeFileSync(join(webDir, 'index.html'), '<html>isolated base</html>');
  writeFileSync(
    join(root, 'game-catalog.json'),
    readFileSync(join(artifacts, 'TableMax-game-catalog-v1.0.6.json')),
  );
  return {
    root,
    webDir,
    dataDir,
    gamesDir,
    host: '127.0.0.1' as const,
    port: 0,
  };
}
async function command(
  service: Awaited<ReturnType<typeof createService>>,
  value: Command['command'],
) {
  const view = service.room.view(service.hostToken);
  return service.room.command(service.hostToken, {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command: value,
  });
}
async function importPack(
  service: Awaited<ReturnType<typeof createService>>,
  pack: string,
) {
  return service.app.inject({
    method: 'POST',
    url: '/api/game-packages/import',
    headers: {
      authorization: `Bearer ${service.hostToken}`,
      'content-type': 'application/octet-stream',
    },
    payload: readFileSync(join(artifacts, pack)),
  });
}

it('selects a separately installed nondefault gameplay without installing its default sibling', async () => {
  for (const [gameId, variantId] of [
    ['pokemon-encounters', 'expansion'],
    ['avalon', 'court'],
  ]) {
    const config = fixture();
    const service = await createService(config);
    try {
      const release = signedCatalog.payload.releases.find(
        (r) => r.gameId === gameId && r.variantId === variantId,
      )!;
      const imported = await importPack(service, release.offlineAsset!);
      expect(imported.statusCode, imported.body).toBe(200);
      const snapshot = (
        await service.app.inject('/api/game-packages')
      ).json() as ReturnType<PackageStore['snapshot']>;
      expect(Object.keys(snapshot.index.releases)).toEqual([release.releaseId]);
      expect(
        (await command(service, { type: 'select-game', gameId: gameId! })).ok,
      ).toBe(true);
      expect(service.room.view().game?.variantId).toBe(variantId);
      expect(service.room.view().game?.releaseRef).toBe(release.releaseId);
    } finally {
      await service.close();
      rmSync(config.root, { recursive: true, force: true });
    }
  }
}, 30000);

it('starts an empty portable base, imports every signed gameplay pack immediately, enforces host management and serves pinned public bytes', async () => {
  const config = fixture();
  const service = await createService(config);
  try {
    const port = await service.listen();
    const actual = await fetch(`http://127.0.0.1:${port}/api/game-packages`);
    expect(actual.status).toBe(200);
    const initial = (await actual.json()) as ReturnType<
      PackageStore['snapshot']
    >;
    expect(Object.keys(initial.index.releases)).toHaveLength(0);
    expect(service.room.view().game).toBeNull();
    const packs = signedCatalog.payload.releases.map(
      (release) => release.offlineAsset!,
    );
    for (const pack of packs) {
      const response = await importPack(service, pack);
      expect(response.statusCode, response.body).toBe(200);
    }
    const catalog = JSON.parse(
      readFileSync(
        join(artifacts, 'TableMax-game-catalog-v1.0.6.json'),
        'utf8',
      ),
    ) as SignedCatalog;
    const snapshot = (
      await service.app.inject('/api/game-packages')
    ).json() as ReturnType<PackageStore['snapshot']>;
    expect(Object.keys(snapshot.index.releases).length).toBe(
      catalog.payload.releases.length,
    );
    expect(snapshot.unavailableReleaseIds).toEqual([]);
    for (const release of catalog.payload.releases) {
      const web = await service.app.inject(
        `/game-packages/${release.releaseId}/${release.module.entries.web}`,
      );
      expect(web.statusCode, web.body.slice(0, 80)).toBe(200);
      expect(web.headers['content-type']).toContain('javascript');
      expect(
        (
          await service.app.inject(
            `/game-packages/${release.releaseId}/${release.module.entries.rules}`,
          )
        ).statusCode,
      ).toBe(404);
      for (const css of release.module.styles ?? [])
        expect(
          (
            await service.app.inject(
              `/game-packages/${release.releaseId}/${css}`,
            )
          ).statusCode,
        ).toBe(200);
      const resource = Object.keys(release.resourceMap)[0];
      if (resource)
        expect(
          (
            await service.app.inject(
              `/game-packages/${release.releaseId}/resources/${resource}`,
            )
          ).statusCode,
        ).toBe(200);
    }
    const uno = catalog.payload.releases.find((r) => r.gameId === 'uno')!;
    expect(
      (await command(service, { type: 'select-game', gameId: 'uno' })).ok,
    ).toBe(true);
    expect(service.room.view().game?.releaseRef).toBe(uno.releaseId);
    const player = await service.room.join('Player');
    for (const token of [undefined, player.token, 'invalid']) {
      const headers = token ? { authorization: `Bearer ${token}` } : {};
      expect(
        (
          await service.app.inject({
            method: 'POST',
            url: '/api/game-packages/manage',
            headers,
            payload: { operation: 'uninstall', releaseId: uno.releaseId },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await service.app.inject({
            method: 'POST',
            url: '/api/game-packages/import',
            headers: { ...headers, 'content-type': 'application/octet-stream' },
            payload: Buffer.from('bad'),
          })
        ).statusCode,
      ).toBe(403);
    }
    const referenced = await service.app.inject({
      method: 'POST',
      url: '/api/game-packages/manage',
      headers: { authorization: `Bearer ${service.hostToken}` },
      payload: { operation: 'uninstall', releaseId: uno.releaseId },
    });
    expect(referenced.statusCode).toBe(400);
    expect(referenced.body).toContain('release-in-use');
    expect(
      (
        await service.app.inject({
          method: 'POST',
          url: '/api/game-packages/import',
          headers: {
            authorization: `Bearer ${service.hostToken}`,
            'content-type': 'application/octet-stream',
          },
          payload: Buffer.from('bad'),
        })
      ).statusCode,
    ).toBe(400);
    const oversized = await service.app.inject({
      method: 'POST',
      url: '/api/game-packages/import',
      headers: {
        authorization: `Bearer ${service.hostToken}`,
        'content-type': 'application/octet-stream',
        'content-length': '64000000',
      },
      payload: Buffer.from('bad'),
    });
    expect(oversized.statusCode).toBeGreaterThanOrEqual(400);
    expect(
      (
        await command(service, {
          type: 'remove-seat',
          seatId: service.room.view().seats[0]!.id,
        })
      ).ok,
    ).toBe(true);
    for (const name of ['One', 'Two'])
      expect((await command(service, { type: 'add-bot', name })).ok).toBe(true);
    expect((await command(service, { type: 'start' })).ok).toBe(true);
    const task = service.room.botTask();
    expect(task?.releaseRef).toBe(uno.releaseId);
    const workerPath = join(config.root, 'bot-worker.cjs');
    await build({
      entryPoints: ['apps/server/src/bot-worker.ts'],
      outfile: workerPath,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      logLevel: 'silent',
    });
    const store = new PackageStore({
      root: config.gamesDir,
      publicKey: PROJECT_GAME_PUBLIC_KEY,
      protectedReleaseIds: () => [],
    });
    let usedEntry = '';
    const executor = new WorkerBotExecutor(workerPath, (current) => {
      expect(current.releaseRef).toBe(uno.releaseId);
      const pinned = store.resolveModule(current.releaseRef!)!;
      usedEntry = join(pinned.root, pinned.release.module.entries.bot);
      return usedEntry;
    });
    const result = await executor.execute(task!, AbortSignal.timeout(2000));
    expect(usedEntry).toContain(uno.code);
    expect(result.action).toBeDefined();
  } finally {
    await service.close();
    rmSync(config.root, { recursive: true, force: true });
  }
}, 30000);

it('preserves actual SQLite save and identities across missing pinned package repair and restores paused', async () => {
  const config = fixture();
  let service = await createService(config);
  try {
    expect((await importPack(service, unoPack)).statusCode).toBe(200);
    expect(
      (await command(service, { type: 'select-game', gameId: 'uno' })).ok,
    ).toBe(true);
    const player = await service.room.join('Persisted');
    const ref = service.room.view().game!.releaseRef!;
    expect((await command(service, { type: 'add-bot', name: 'Bot' })).ok).toBe(
      true,
    );
    await service.room.command(player.token, {
      actionId: crypto.randomUUID(),
      instanceId: service.room.view().instanceId,
      revision: service.room.view().revision,
      branch: service.room.view().branch,
      command: { type: 'ready', ready: true },
    });
    expect((await command(service, { type: 'start' })).ok).toBe(true);
    const instance = service.room.view().instanceId;
    await service.close();
    renameSync(
      join(config.gamesDir, 'uno', 'blobs'),
      join(config.root, 'preserved-missing-blobs'),
    );
    const databaseBefore = readFileSync(join(config.dataDir, 'room.sqlite'));
    service = await createService(config);
    expect(service.room.missingRelease).toBe(ref);
    expect(readFileSync(join(config.dataDir, 'room.sqlite'))).toEqual(
      databaseBefore,
    );
    expect(service.room.view(player.token).self.role).toBe('player');
    expect((await importPack(service, unoPack)).statusCode).toBe(200);
    await expect.poll(() => service.room.missingRelease).toBeNull();
    expect(service.room.view().game?.releaseRef).toBe(ref);
    expect(service.room.view().instanceId).toBe(instance);
    expect(service.room.view().paused).toBe(true);
    expect(service.room.view(player.token).self.role).toBe('player');
  } finally {
    await service.close();
    rmSync(config.root, { recursive: true, force: true });
  }
}, 30000);
