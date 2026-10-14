import { afterEach, expect, it } from 'vitest';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { PackageStore } from './store';
import { PROJECT_GAME_PUBLIC_KEY } from './project-public-key';
import type { SignedCatalog } from './types';
import { createService } from '../service';
import { createGameRegistry } from '../game-registry';
import { RoomCoordinator, type Save } from '@tablemax/platform-core';
import { WorkerBotExecutor } from '../bot-executor';

import { preferredCatalogReleases, releaseCompatible } from './catalog';
import { retiredVariant, retiredVariantPolicies } from '../game-variant-policy';
const assets = resolve(
  process.env.TABLEMAX_TEST_GAME_PACKAGES ??
    'artifacts/game-packages/v1.0.6/current',
);
const envelope = JSON.parse(
  readFileSync(join(assets, 'TableMax-game-catalog-v1.0.6.json'), 'utf8'),
) as SignedCatalog;
const currentReleases = preferredCatalogReleases(
  envelope.payload.releases,
).filter(
  (r) =>
    releaseCompatible(r) &&
    !retiredVariant(r.gameId, r.variantId, retiredVariantPolicies()),
);
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function fixture(payload = true) {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/preinstalled-games-'));
  roots.push(root);
  const webDir = join(root, 'app', 'web');
  const source = join(root, 'app', 'preinstalled-games');
  mkdirSync(webDir, { recursive: true });
  writeFileSync(join(webDir, 'index.html'), '<html>isolated bootstrap</html>');
  if (payload) {
    mkdirSync(join(source, 'blobs'), { recursive: true });
    writeFileSync(join(source, 'catalog.json'), JSON.stringify(envelope));
    writeFileSync(
      join(source, 'bootstrap.json'),
      JSON.stringify({
        schemaVersion: 1,
        releaseIds: currentReleases.map((r) => r.releaseId),
      }),
    );
    const ids = new Set(
      currentReleases.flatMap((r) => [r.code, ...r.resources]),
    );
    for (const blob of envelope.payload.blobs.filter((b) => ids.has(b.id)))
      copyFileSync(
        join(assets, blob.assetName),
        join(source, 'blobs', blob.id + '.zip'),
      );
  }
  const options = {
    root: join(root, 'games'),
    publicKey: PROJECT_GAME_PUBLIC_KEY,
    protectedReleaseIds: () => [],
    fetch: (() => {
      throw new Error('bootstrap must be offline');
    }) as typeof fetch,
  };
  return {
    root,
    source,
    options,
    config: {
      dataDir: join(root, 'data'),
      gamesDir: options.root,
      webDir,
      host: '127.0.0.1',
      port: 0,
      playMode: 'test' as const,
    },
  };
}

it('bootstraps all current compatible signed gameplays before the full service opens, with no network or restart required', async () => {
  const f = fixture();
  const service = await createService(f.config);
  try {
    expect(service.installation.currentMappingSha256).toBe(
      createHash('sha256')
        .update(readFileSync(join(f.source, 'bootstrap.json')))
        .digest('hex'),
    );
    const installed = new PackageStore(f.options).snapshot();
    expect(Object.keys(installed.index.releases)).toHaveLength(
      currentReleases.length,
    );
    expect(installed.unavailableReleaseIds).toEqual([]);
    for (const [method, url] of [
      ['GET', '/api/game-packages'],
      ['POST', '/api/game-packages/manage'],
      ['POST', '/api/game-packages/import'],
    ] as const) {
      const response = await service.app.inject({
        method,
        url,
        headers: { authorization: 'Bearer ' + service.hostToken },
        ...(method === 'POST' ? { payload: { operation: 'refresh' } } : {}),
      });
      expect(response.statusCode).toBe(404);
    }
    expect(service.room.view().game?.id).toBe('pokemon-encounters');
    expect(service.room.view().game?.variantId).toBe('original');
    const store = new PackageStore(f.options);
    const before = readFileSync(join(f.options.root, 'index.json'));
    await store.importPreinstalled(f.source);
    expect(store.currentMappingSha256).toBe(
      service.installation.currentMappingSha256,
    );
    expect(readFileSync(join(f.options.root, 'index.json'))).toEqual(before);
    for (const release of currentReleases)
      expect(store.resolveModule(release.releaseId)).toBeDefined();
  } finally {
    await service.close();
  }
  // A default untouched lobby legitimately has no save; the full payload still
  // provides its default on reopening without changing persistence semantics.
  const reopened = await createService(f.config);
  try {
    expect(reopened.room.view().game?.id).toBe('pokemon-encounters');
    expect(reopened.room.view().game?.variantId).toBe('original');
  } finally {
    await reopened.close();
  }
}, 30000);

it('loads each bundled gameplay and saves an authorized decision from the actual packaged Worker', async () => {
  const f = fixture();
  const store = new PackageStore(f.options);
  await store.importPreinstalled(f.source);
  const registry = createGameRegistry(false, store);
  const pointer = JSON.parse(
    readFileSync('artifacts/package-payloads/v1.0.6/current.json', 'utf8'),
  );
  const delivery = pointer.deliveries.find(
    (d: { edition: string }) => d.edition === 'full',
  );
  const manifest = JSON.parse(readFileSync(delivery.manifestPath, 'utf8'));
  const workerRecord = manifest.files.find(
    (file: { path: string }) => file.path === 'bot-worker.cjs',
  );
  let workerPath = join(
    delivery.manifestPath,
    '..',
    'win-unpacked',
    'bot-worker.cjs',
  );
  if (!existsSync(workerPath)) {
    const proof = JSON.parse(
      readFileSync(
        `artifacts/maintenance/v${pointer.version}/windows-editions/${pointer.snapshot}/shipping-executable-checks-full.json`,
        'utf8',
      ),
    );
    expect(proof.result).toBe('passed');
    expect(proof.executableSha256).toBe(delivery.executable.sha256);
    expect(
      createHash('sha256')
        .update(readFileSync(delivery.executable.path))
        .digest('hex'),
    ).toBe(delivery.executable.sha256);
    workerPath = join(proof.extracted, 'bot-worker.cjs');
  }
  expect(workerRecord).toBeDefined();
  expect(
    createHash('sha256').update(readFileSync(workerPath)).digest('hex'),
  ).toBe(workerRecord.sha256);
  const executor = new WorkerBotExecutor(workerPath, (task) => {
    const installed = store.resolveModule(task.releaseRef!)!;
    return join(installed.root, installed.release.module.entries.bot);
  });
  for (const release of currentReleases) {
    const loaded = await registry.load(release.gameId, release.variantId);
    let saved: Save | null = null;
    const room = new RoomCoordinator(
      loaded.rules,
      loaded.bot,
      {
        load: () => structuredClone(saved),
        save: (value: Save) => {
          saved = structuredClone(value);
        },
      },
      undefined,
      'test',
      registry,
      undefined,
      release.variantId,
      release.releaseId,
    );
    const host = async (
      command: import('@tablemax/protocol').Command['command'],
    ) => {
      const view = room.view(room.hostToken);
      expect(
        (
          await room.command(room.hostToken, {
            actionId: crypto.randomUUID(),
            instanceId: view.instanceId,
            revision: view.revision,
            branch: view.branch,
            command,
          })
        ).ok,
        release.gameId,
      ).toBe(true);
    };
    for (let i = 0; i < loaded.rules.manifest.players.min; i++)
      await host({ type: 'add-bot', name: 'Bundled ' + i });
    await host({ type: 'start' });
    const task = room.botTask()!;
    expect(task.releaseRef).toBe(release.releaseId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const result = await executor.execute(task, controller.signal);
      expect(
        (
          await room.submitBot(
            task,
            result.action,
            result.memory,
            result.random,
          )
        ).ok,
        release.gameId,
      ).toBe(true);
    } finally {
      clearTimeout(timeout);
    }
  }
}, 30000);

it('preserves existing exact selections and refs, repairs indexed missing files, and repairs historical uninstalls from the executable', async () => {
  const f = fixture();
  const store = new PackageStore(f.options);
  const previousAssets = resolve('artifacts/game-packages/v1.0.6');
  const previous = JSON.parse(
    readFileSync(
      join(previousAssets, 'TableMax-game-catalog-v1.0.6.json'),
      'utf8',
    ),
  ) as SignedCatalog;
  const oldClassic = previous.payload.releases.find(
    (r) => r.gameId === 'avalon' && r.variantId === 'classic',
  )!;
  await store.importOffline(join(previousAssets, oldClassic.offlineAsset!));
  await store.importPreinstalled(f.source);
  expect(store.selected('avalon', 'classic')?.releaseId).toBe(
    oldClassic.releaseId,
  );
  expect(store.resolveModule(oldClassic.releaseId)).toBeDefined();
  const uno = envelope.payload.releases.find((r) => r.gameId === 'uno')!;
  rmSync(join(f.options.root, uno.gameId, 'blobs', uno.code), {
    recursive: true,
  });
  const restarted = new PackageStore(f.options);
  expect(restarted.resolveModule(uno.releaseId)).toBeUndefined();
  await restarted.importPreinstalled(f.source);
  expect(restarted.resolveModule(uno.releaseId)).toBeDefined();
  restarted.uninstall(uno.releaseId);
  await new PackageStore(f.options).importPreinstalled(f.source);
  expect(
    new PackageStore(f.options).resolveModule(uno.releaseId),
  ).toBeDefined();
}, 30000);

it('rejects corrupt or absent complete payloads without changing saved bytes', async () => {
  const f = fixture();
  const store = new PackageStore(f.options);
  await store.importPreinstalled(f.source);
  const before = readFileSync(join(f.options.root, 'index.json'));
  writeFileSync(
    join(f.source, 'blobs', envelope.payload.blobs[0]!.id + '.zip'),
    'corrupt',
  );
  await expect(store.importPreinstalled(f.source)).rejects.toThrow(
    'archive-hash-mismatch',
  );
  expect(readFileSync(join(f.options.root, 'index.json'))).toEqual(before);
  const absent = fixture(false);
  await expect(createService(absent.config)).rejects.toThrow(
    '完整程序的预装游戏无法初始化',
  );
  await expect(
    new PackageStore(absent.options).importPreinstalled(absent.source),
  ).rejects.toThrow('missing-preinstalled-games');
}, 30000);

it('uses only bundled current releases despite cached selections, with old variants restricted to restoration', async () => {
  const f = fixture();
  const store = new PackageStore(f.options);
  const previousAssets = resolve('artifacts/game-packages/v1.0.6');
  const old = JSON.parse(
    readFileSync(
      join(previousAssets, 'TableMax-game-catalog-v1.0.6.json'),
      'utf8',
    ),
  ) as SignedCatalog;
  const classic = old.payload.releases.find(
    (r) => r.gameId === 'avalon' && r.variantId === 'classic',
  )!;
  await store.importOffline(join(previousAssets, classic.offlineAsset!));
  await store.importPreinstalled(f.source);
  const registry = createGameRegistry(false, store);
  expect(
    registry
      .catalog()
      .find((g) => g.id === 'avalon')
      ?.variants?.map((v) => v.id),
  ).toEqual(['configured']);
  for (const release of currentReleases) {
    expect(store.current(release.gameId, release.variantId)?.releaseId).toBe(
      release.releaseId,
    );
    expect(
      (await registry.load(release.gameId, release.variantId)).releaseRef,
    ).toBe(release.releaseId);
  }
  const saved = {
    manifest: {
      id: 'avalon',
      gameVersion: classic.module.compatibility.gameVersion,
      rulesVersion: classic.module.compatibility.rulesVersion,
      stateVersion: classic.module.compatibility.stateVersion,
    },
    variantId: 'classic',
    releaseRef: classic.releaseId,
  } as import('@tablemax/platform-core').Save;
  expect((await registry.loadSaved(saved)).restoreOnly).toBe(true);
  await expect(
    registry.load('avalon', 'classic', classic.releaseId),
  ).rejects.toThrow();
  writeFileSync(
    join(f.options.root, 'catalog.json'),
    'invalid old cached directory',
  );
  const restarted = new PackageStore(f.options);
  await restarted.importPreinstalled(f.source);
  expect(restarted.current('avalon', 'configured')?.releaseId).toBe(
    store.current('avalon', 'configured')?.releaseId,
  );
}, 30000);
