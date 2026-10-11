import { afterEach, expect, it } from 'vitest';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { PackageStore } from './store';
import { PROJECT_GAME_PUBLIC_KEY } from './project-public-key';
import type { SignedCatalog } from './types';
import { createService } from '../service';

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
    const snapshot = (
      await service.app.inject('/api/game-packages')
    ).json() as ReturnType<PackageStore['snapshot']>;
    expect(Object.keys(snapshot.index.releases)).toHaveLength(
      currentReleases.length,
    );
    expect(snapshot.unavailableReleaseIds).toEqual([]);
    expect(service.room.view().game?.id).toBe('pokemon-encounters');
    expect(service.room.view().game?.variantId).toBe('original');
    const store = new PackageStore(f.options);
    const before = readFileSync(join(f.options.root, 'index.json'));
    await store.importPreinstalled(f.source);
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

it('preserves existing exact selections and refs, repairs indexed missing files, and does not resurrect an explicit uninstall', async () => {
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
  ).toBeUndefined();
}, 30000);

it('rejects a corrupt signed payload before changing an existing index and leaves an empty box service usable', async () => {
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
  const box = fixture(false);
  const service = await createService(box.config);
  try {
    expect(service.room.view().game).toBeNull();
    const snapshot = (
      await service.app.inject('/api/game-packages')
    ).json() as ReturnType<PackageStore['snapshot']>;
    expect(Object.keys(snapshot.index.releases)).toHaveLength(0);
    expect(
      await new PackageStore(box.options).importPreinstalled(box.source),
    ).toEqual([]);
    const view = service.room.view(service.hostToken);
    expect(
      (
        await service.room.command(service.hostToken, {
          actionId: crypto.randomUUID(),
          instanceId: view.instanceId,
          branch: view.branch,
          revision: view.revision,
          command: { type: 'join-open', open: false },
        })
      ).ok,
    ).toBe(true);
  } finally {
    await service.close();
  }
  mkdirSync(join(box.source, 'blobs'), { recursive: true });
  writeFileSync(join(box.source, 'catalog.json'), JSON.stringify(envelope));
  writeFileSync(
    join(box.source, 'bootstrap.json'),
    JSON.stringify({
      schemaVersion: 1,
      releaseIds: currentReleases.map((r) => r.releaseId),
    }),
  );
  const restoredIds = new Set(
    currentReleases.flatMap((r) => [r.code, ...r.resources]),
  );
  for (const blob of envelope.payload.blobs.filter((b) =>
    restoredIds.has(b.id),
  ))
    copyFileSync(
      join(assets, blob.assetName),
      join(box.source, 'blobs', blob.id + '.zip'),
    );
  const restored = await createService(box.config);
  try {
    expect(restored.room.view().game).toBeNull();
    const snapshot = (
      await restored.app.inject('/api/game-packages')
    ).json() as ReturnType<PackageStore['snapshot']>;
    expect(Object.keys(snapshot.index.releases)).toHaveLength(
      currentReleases.length,
    );
  } finally {
    await restored.close();
  }
}, 30000);
