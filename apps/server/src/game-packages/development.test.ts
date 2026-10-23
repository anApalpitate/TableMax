import { expect, it } from 'vitest';
import { build } from 'esbuild';
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createService } from '../service';
import { PackageStore } from './store';
import { PROJECT_GAME_PUBLIC_KEY } from './project-public-key';
import {
  blobIdentity,
  canonical,
  GAME_SIZE_LIMIT,
  releaseIdentity,
  validateCatalog,
  verifyCatalog,
} from './verification';
import type { Command } from '@tablemax/protocol';
import type { ModuleManifest } from '@tablemax/game-sdk/module-manifest';

type Service = Awaited<ReturnType<typeof createService>>;
async function fixture() {
  const temporaryRoot = resolve(process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp');
  mkdirSync(temporaryRoot, { recursive: true });
  const root = mkdtempSync(join(temporaryRoot, 'development-games-'));
  const app = join(root, 'app');
  for (const path of [
    'games',
    'bots',
    'web/games/manila/web',
    'web/games/manila/resources/manila',
  ])
    mkdirSync(join(app, path), { recursive: true });
  const module = JSON.parse(
    readFileSync('games/manila/game-module.json', 'utf8'),
  ) as ModuleManifest;
  module.entries = {
    rules: 'games/manila.cjs',
    bot: 'bots/manila.cjs',
    web: '/games/manila/web/entry.js',
  };
  module.styles = [];
  delete module.details;
  writeFileSync(join(app, 'modules.json'), JSON.stringify([module]));
  writeFileSync(
    join(app, '.tablemax-development.json'),
    JSON.stringify({ version: 1 }),
  );
  writeFileSync(
    join(app, 'web/index.html'),
    '<html>source development fixture</html>',
  );
  writeFileSync(
    join(app, 'web/games/manila/web/entry.js'),
    'export const sourceRevision = 1;',
  );
  for (const name of ['boat-v1.webp', 'harbor-v1.webp', 'site-port-v2.webp'])
    writeFileSync(
      join(app, 'web/games/manila/resources/manila', name),
      readFileSync(join('assets/games/manila', name)),
    );
  await Promise.all(
    ['rules', 'bot'].map((part) =>
      build({
        entryPoints: [resolve(`games/manila/${part}/index.ts`)],
        outfile: join(app, part === 'rules' ? 'games' : 'bots', 'manila.cjs'),
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node22',
        logLevel: 'silent',
      }),
    ),
  );
  return {
    root,
    app,
    config: {
      host: '127.0.0.1',
      port: 0,
      webDir: join(app, 'web'),
      dataDir: join(root, 'data'),
      gamesDir: join(root, 'games'),
    },
  };
}
async function command(
  service: Service,
  token: string,
  command: Command['command'],
) {
  const view = service.room.view(token);
  const reply = await service.room.command(token, {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  });
  expect(reply).toMatchObject({ ok: true });
}
it('loads Manila on the first source startup and serves the current browser entry', async () => {
  const f = await fixture();
  const service = await createService(f.config);
  try {
    await command(service, service.hostToken, {
      type: 'select-game',
      gameId: 'manila',
    });
    const ref = service.room.view().game!.releaseRef!;
    expect(ref).toMatch(/^[a-f0-9]{64}$/);
    const descriptor = await service.app.inject({
      method: 'GET',
      url: `/api/game-packages/releases/${ref}`,
    });
    expect(descriptor.statusCode).toBe(200);
    const entry = await service.app.inject({
      method: 'GET',
      url: `/game-packages/${ref}/` + descriptor.json().module.entries.web,
    });
    expect(entry.statusCode).toBe(200);
    expect(entry.body).toContain('sourceRevision = 1');
    for (const name of [
      'boat-v1.webp',
      'harbor-v1.webp',
      'site-port-v2.webp',
    ]) {
      const image = await service.app.inject({
        method: 'GET',
        url: `/game-packages/${ref}/resources/manila/${name}`,
      });
      expect(image.statusCode).toBe(200);
      expect(image.headers['content-type']).toBe('image/webp');
      expect(image.rawPayload).toEqual(
        readFileSync(join('assets/games/manila', name)),
      );
    }
    for (const suffix of [
      'uno/boat-v1.webp',
      'manila/missing.webp',
      'games/manila.cjs',
      'bots/manila.cjs',
    ]) {
      const denied = await service.app.inject({
        method: 'GET',
        url: `/game-packages/${ref}/resources/${suffix}`,
      });
      expect(denied.statusCode).toBe(404);
    }
    await command(service, service.hostToken, {
      type: 'select-game',
      gameId: 'manila',
    });
    expect(service.room.view().game!.releaseRef).toBe(ref);
  } finally {
    await service.close();
  }
}, 30000);
it('uses the rebuilt source for new games while an existing SQLite match stays pinned across restarts', async () => {
  const f = await fixture();
  let service = await createService(f.config);
  try {
    await command(service, service.hostToken, {
      type: 'select-game',
      gameId: 'manila',
    });
    const tokens: string[] = [];
    for (const name of ['源码甲', '源码乙', '源码丙']) {
      const player = await service.room.join(name);
      tokens.push(player.token);
      await command(service, player.token, { type: 'ready', ready: true });
    }
    await command(service, service.hostToken, { type: 'start' });
    const original = service.room.view();
    const oldRef = original.game!.releaseRef!;
    await service.close();
    writeFileSync(
      join(f.app, 'web/games/manila/web/entry.js'),
      'export const sourceRevision = 2;',
    );
    service = await createService(f.config);
    expect(service.room.view().instanceId).toBe(original.instanceId);
    expect(service.room.view().game!.releaseRef).toBe(oldRef);
    expect(service.room.view().gameView).toEqual(original.gameView);
    expect(service.room.view(tokens[0]!).self.role).toBe('player');
    const restoredImage = await service.app.inject({
      method: 'GET',
      url: `/game-packages/${oldRef}/resources/manila/boat-v1.webp`,
    });
    expect(restoredImage.statusCode).toBe(200);
    expect(restoredImage.rawPayload).toEqual(
      readFileSync('assets/games/manila/boat-v1.webp'),
    );
    await command(service, service.hostToken, {
      type: 'select-game',
      gameId: 'manila',
      endCurrent: true,
    });
    const newRef = service.room.view().game!.releaseRef!;
    expect(newRef).not.toBe(oldRef);
    const oldEntry = await service.app.inject({
      method: 'GET',
      url: `/game-packages/${oldRef}/web/web/entry.js`,
    });
    const newEntry = await service.app.inject({
      method: 'GET',
      url: `/game-packages/${newRef}/web/web/entry.js`,
    });
    expect(oldEntry.body).toContain('sourceRevision = 1');
    expect(newEntry.body).toContain('sourceRevision = 2');
    await service.close();
    service = await createService(f.config);
    expect(service.room.view().game!.releaseRef).toBe(newRef);
    await command(service, service.hostToken, {
      type: 'select-game',
      gameId: 'manila',
    });
    expect(service.room.view().game!.releaseRef).toBe(newRef);
  } finally {
    await service.close();
  }
}, 30000);
it('cannot make an unsigned local runtime current outside an explicitly marked development build', async () => {
  const f = await fixture();
  const store = new PackageStore({
    root: f.config.gamesDir,
    publicKey: PROJECT_GAME_PUBLIC_KEY,
    protectedReleaseIds: () => [],
  });
  expect(() => store.loadDevelopment(f.app)).toThrow('not-development-build');
  expect(store.current('manila')).toBeUndefined();
  expect(Object.keys(store.snapshot().index.releases)).toHaveLength(0);
}, 30000);

it('keeps non-legacy resource resolution bound to its explicit inventory map', async () => {
  const f = await fixture();
  const options = {
    root: f.config.gamesDir,
    publicKey: PROJECT_GAME_PUBLIC_KEY,
    protectedReleaseIds: () => [],
  };
  const development = new PackageStore({ ...options, development: true });
  development.loadDevelopment(f.app);
  const index = development.snapshot().index;
  const original = development.current('manila')!;
  const unmapped = structuredClone(original);
  delete unmapped.legacy;
  unmapped.releaseId = releaseIdentity(unmapped);
  const mapped = structuredClone(unmapped);
  const resource = structuredClone(index.blobs[mapped.code]!);
  resource.kind = 'resources';
  resource.files = resource.files.filter(
    (file) => file.path === 'web/resources/manila/boat-v1.webp',
  );
  resource.installedBytes = resource.files[0]!.size;
  resource.id = blobIdentity(resource);
  index.blobs[resource.id] = resource;
  const resourceDirectory = join(
    f.config.gamesDir,
    'manila',
    'blobs',
    resource.id,
    'web/resources/manila',
  );
  mkdirSync(resourceDirectory, { recursive: true });
  writeFileSync(
    join(resourceDirectory, 'boat-v1.webp'),
    readFileSync('assets/games/manila/boat-v1.webp'),
  );
  mapped.resources = [resource.id];
  mapped.resourceMap['manila/boat-v1.webp'] = {
    blobId: resource.id,
    path: 'web/resources/manila/boat-v1.webp',
  };
  mapped.releaseId = releaseIdentity(mapped);
  index.releases[unmapped.releaseId] = unmapped;
  index.releases[mapped.releaseId] = mapped;
  writeFileSync(join(f.config.gamesDir, 'index.json'), JSON.stringify(index));
  const store = new PackageStore(options);
  expect(
    store.resolvePublicFile(unmapped.releaseId, 'manila/boat-v1.webp'),
  ).toBeUndefined();
  expect(store.resolvePublicFile(mapped.releaseId, 'manila/boat-v1.webp')).toBe(
    join(
      f.config.gamesDir,
      'manila',
      'blobs',
      resource.id,
      'web/resources/manila/boat-v1.webp',
    ),
  );
  expect(
    store.resolvePublicFile(mapped.releaseId, 'manila/../games/manila.cjs'),
  ).toBeUndefined();
  expect(
    store.resolvePublicFile(mapped.releaseId, 'games/manila.cjs'),
  ).toBeUndefined();
}, 30000);

it('restores a materialized local runtime over the historical transfer limit and rejects forged receipts or changed files', async () => {
  const f = await fixture();
  const largeRelative = 'web/resources/manila/large-local-runtime.bin';
  writeFileSync(
    join(f.app, 'web/games/manila/resources/manila/large-local-runtime.bin'),
    Buffer.alloc(GAME_SIZE_LIMIT, 1),
  );
  const options = {
    root: f.config.gamesDir,
    publicKey: PROJECT_GAME_PUBLIC_KEY,
    protectedReleaseIds: () => [],
  };
  let service: Service | undefined;
  try {
    service = await createService(f.config);
    await command(service, service.hostToken, {
      type: 'select-game',
      gameId: 'manila',
    });
    const ref = service.room.view().game!.releaseRef!;
    const entryPath = `/game-packages/${ref}/web/web/entry.js`;
    const entryBefore = await service.app.inject(entryPath);
    expect(entryBefore.statusCode).toBe(200);
    await service.close();
    service = undefined;

    // No development option: proof belongs to the existing local record itself.
    const restored = new PackageStore(options);
    const index = restored.snapshot().index;
    const release = index.releases[ref]!;
    const code = index.blobs[release.code]!;
    expect(code.installedBytes).toBeGreaterThan(GAME_SIZE_LIMIT);
    expect(code.files.find((file) => file.path === largeRelative)?.size).toBe(
      GAME_SIZE_LIMIT,
    );
    expect(restored.resolveModule(ref)?.release.releaseId).toBe(ref);
    const catalog = {
      schemaVersion: 1 as const,
      releases: Object.values(index.releases),
      blobs: Object.values(index.blobs),
    };
    expect(() => validateCatalog(catalog)).toThrow('game-package-size-limit');
    const keys = generateKeyPairSync('ed25519');
    expect(() =>
      verifyCatalog(
        {
          payload: catalog,
          signature: sign(
            null,
            Buffer.from(canonical(catalog)),
            keys.privateKey,
          ).toString('base64'),
        },
        keys.publicKey,
      ),
    ).toThrow('game-package-size-limit');

    service = await createService(f.config);
    expect(service.room.view().game!.releaseRef).toBe(ref);
    const entryAfter = await service.app.inject(entryPath);
    expect(entryAfter.statusCode).toBe(200);
    expect(entryAfter.rawPayload).toEqual(entryBefore.rawPayload);
    await service.close();
    service = undefined;

    const indexPath = join(f.config.gamesDir, 'index.json');
    const originalIndex = JSON.stringify(index);
    const forgedReceipt = structuredClone(index);
    forgedReceipt.blobs[code.id]!.archiveSha256 = '0'.repeat(64);
    writeFileSync(indexPath, JSON.stringify(forgedReceipt));
    expect(() => new PackageStore({ ...options, development: true })).toThrow(
      'game-package-size-limit',
    );

    const notLocal = structuredClone(index);
    const ordinary = notLocal.releases[ref]!;
    delete ordinary.legacy;
    ordinary.releaseId = releaseIdentity(ordinary);
    delete notLocal.releases[ref];
    notLocal.releases[ordinary.releaseId] = ordinary;
    for (const key of Object.keys(notLocal.selected))
      if (notLocal.selected[key] === ref)
        notLocal.selected[key] = ordinary.releaseId;
    writeFileSync(indexPath, JSON.stringify(notLocal));
    expect(() => new PackageStore({ ...options, development: true })).toThrow(
      'game-package-size-limit',
    );

    writeFileSync(indexPath, originalIndex);
    const file = openSync(
      join(f.config.gamesDir, release.gameId, 'blobs', code.id, largeRelative),
      'r+',
    );
    try {
      writeSync(file, Buffer.from([0]), 0, 1, 0);
    } finally {
      closeSync(file);
    }
    expect(() => new PackageStore(options)).toThrow(
      'installed-package-corrupt',
    );
  } finally {
    await service?.close();
  }
}, 30000);
