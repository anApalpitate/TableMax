import { it, expect } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  renameSync,
  copyFileSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { createService } from '../service';
import type { Command } from '@tablemax/protocol';
import type { SignedCatalog } from './types';
import { preferredCatalogReleases, releaseCompatible } from './catalog';
import { retiredVariant, retiredVariantPolicies } from '../game-variant-policy';
const artifacts = resolve('artifacts/game-packages/v1.0.6/current');
const signedCatalog = JSON.parse(
  readFileSync(join(artifacts, 'TableMax-game-catalog-v1.0.6.json'), 'utf8'),
) as SignedCatalog;
const currentReleases = preferredCatalogReleases(
  signedCatalog.payload.releases,
).filter(
  (r) =>
    releaseCompatible(r) &&
    !retiredVariant(r.gameId, r.variantId, retiredVariantPolicies()),
);
function fixture() {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/package-service-'));
  const webDir = join(root, 'app', 'web'),
    dataDir = join(root, 'data'),
    gamesDir = join(root, 'games'),
    payload = join(root, 'app', 'preinstalled-games');
  mkdirSync(webDir, { recursive: true });
  mkdirSync(join(payload, 'blobs'), { recursive: true });
  writeFileSync(
    join(webDir, 'index.html'),
    '<html>complete program test</html>',
  );
  writeFileSync(join(payload, 'catalog.json'), JSON.stringify(signedCatalog));
  writeFileSync(
    join(payload, 'bootstrap.json'),
    JSON.stringify({
      schemaVersion: 1,
      releaseIds: currentReleases.map((r) => r.releaseId),
    }),
  );
  const closure = new Set(
    currentReleases.flatMap((r) => [r.code, ...r.resources]),
  );
  for (const blob of signedCatalog.payload.blobs.filter((b) =>
    closure.has(b.id),
  ))
    copyFileSync(
      join(artifacts, blob.assetName),
      join(payload, 'blobs', blob.id + '.zip'),
    );
  return {
    root,
    webDir,
    dataDir,
    gamesDir,
    host: '127.0.0.1' as const,
    port: 0,
    playMode: 'test' as const,
  };
}
async function command(
  service: Awaited<ReturnType<typeof createService>>,
  command: Command['command'],
) {
  const view = service.room.view(service.hostToken);
  return service.room.command(service.hostToken, {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  });
}
it('preserves actual SQLite save and identities across local executable repair of current files and restores paused', async () => {
  const config = fixture();
  let service = await createService(config);
  try {
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
    service = await createService(config);
    expect(service.room.missingRelease).toBeNull();
    expect(service.room.view().game?.releaseRef).toBe(ref);
    expect(service.room.view().instanceId).toBe(instance);
    expect(service.room.view().paused).toBe(true);
    expect(service.room.view(player.token).self.role).toBe('player');
  } finally {
    await service.close();
    rmSync(config.root, { recursive: true, force: true });
  }
}, 30000);
