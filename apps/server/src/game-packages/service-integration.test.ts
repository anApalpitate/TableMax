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
import { createHash } from 'node:crypto';
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
  const temporaryRoot = resolve(process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp');
  mkdirSync(temporaryRoot, { recursive: true });
  const root = mkdtempSync(join(temporaryRoot, 'package-service-'));
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
    const release = currentReleases.find((item) => item.releaseId === ref)!;
    expect(release.gameId).toBe('uno');
    expect(release.module.compatibility.sdk).toBe(1);
    expect(release.module.compatibility.webHost).toBe(1);
    const digest = (bytes: Uint8Array) =>
      createHash('sha256').update(bytes).digest('hex');
    const frozenBlobs = signedCatalog.payload.blobs.filter((blob) =>
      [release.code, ...release.resources].includes(blob.id),
    );
    const verifyFrozenBytes = () => {
      for (const blob of frozenBlobs) {
        expect(digest(readFileSync(join(artifacts, blob.assetName)))).toBe(
          blob.archiveSha256,
        );
        for (const file of blob.files)
          expect(
            digest(
              readFileSync(
                join(
                  config.gamesDir,
                  release.gameId,
                  'blobs',
                  blob.id,
                  file.path,
                ),
              ),
            ),
          ).toBe(file.sha256);
      }
    };
    verifyFrozenBytes();
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
    verifyFrozenBytes();
    for (const [token, role] of [
      [service.hostToken, 'host'],
      [player.token, 'player'],
    ] as const) {
      const projected = await service.app.inject({
        method: 'POST',
        url: '/api/session/view',
        payload: { token },
      });
      expect(projected.statusCode).toBe(200);
      const view = projected.json().view;
      expect(view.self.role).toBe(role);
      expect(view.game.releaseRef).toBe(ref);
      expect(view.gameView).not.toBeNull();
      const page = await service.app.inject(`/${role}/game`);
      expect(page.statusCode).toBe(200);
    }
    expect(service.room.view(service.hostToken).gameView).toEqual(
      service.room.view().gameView,
    );
    expect(service.room.view(player.token).gameView).not.toEqual(
      service.room.view(service.hostToken).gameView,
    );
    const webPath = release.module.entries.web;
    const webFile = frozenBlobs
      .flatMap((blob) => blob.files)
      .find((file) => file.path === webPath)!;
    const webEntry = await service.app.inject(
      `/game-packages/${ref}/${webPath}`,
    );
    expect(webEntry.statusCode).toBe(200);
    expect(digest(webEntry.rawPayload)).toBe(webFile.sha256);
  } finally {
    await service.close();
    rmSync(config.root, { recursive: true, force: true });
  }
}, 30000);
