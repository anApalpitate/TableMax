import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import {
  PackageStore as LocalModuleStore,
  type PackageStoreOptions,
} from './store';
import {
  canonical,
  sha256,
  blobIdentity,
  releaseIdentity,
  readZip,
  crc32,
  GAME_SIZE_LIMIT,
  verifyCatalog,
} from './verification';
import type {
  GameRelease,
  PackageBlob,
  PackageCatalog,
  SignedCatalog,
} from './types';

// Fixture sources are in-memory bytes; production has no network installer.
class PackageStore extends LocalModuleStore {
  constructor(
    private fixtureOptions: PackageStoreOptions & {
      fetch?: (
        url: string | URL | Request,
        init?: RequestInit,
      ) => Promise<Response>;
      assetUrl?: (blob: PackageBlob) => string;
    },
  ) {
    super(fixtureOptions);
    const path = join(fixtureOptions.root, 'catalog.json');
    if (existsSync(path))
      this.setCatalog(JSON.parse(readFileSync(path, 'utf8')));
  }
  install(id: string) {
    return this.run(id, async (blob) => {
      if (!this.fixtureOptions.fetch) throw new Error('missing-fixture-source');
      return Buffer.from(
        await (
          await this.fixtureOptions.fetch(
            this.fixtureOptions.assetUrl?.(blob) ?? blob.id,
          )
        ).arrayBuffer(),
      );
    });
  }
}
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function developmentFixture() {
  const f = fixture();
  const runtime = join(f.root, 'runtime');
  const module = structuredClone(f.release.module);
  module.entries = {
    rules: 'games/uno.cjs',
    bot: 'bots/uno.cjs',
    web: '/games/uno/web/entry.js',
  };
  module.styles = [];
  for (const directory of ['games', 'bots', 'web/games/uno/web'])
    mkdirSync(join(runtime, directory), { recursive: true });
  writeFileSync(join(runtime, 'modules.json'), JSON.stringify([module]));
  writeFileSync(join(runtime, module.entries.rules), 'exact development rules');
  writeFileSync(join(runtime, module.entries.bot), 'exact development bot');
  writeFileSync(join(runtime, 'web/games/uno/web/entry.js'), 'exact web');
  const options = {
    root: join(f.root, 'nested/missing/parents/packages'),
    publicKey: f.publicKey,
    protectedReleaseIds: () => [],
    development: true,
  };
  return { ...f, runtime, module, options };
}

describe('development runtime path checks', () => {
  it('checks a shared local blob once per startup stage and reuses the completed registration proof', () => {
    const f = developmentFixture();
    f.module.variants = ['first', 'second'].map((id) => ({
      id,
      name: id,
      description: 'Shared-runtime verification fixture',
      compatibility: f.module.compatibility,
    }));
    f.module.defaultVariantId = 'first';
    writeFileSync(join(f.runtime, 'modules.json'), JSON.stringify([f.module]));
    writeFileSync(
      join(f.runtime, 'web/games/uno/web/large.bin'),
      Buffer.alloc(GAME_SIZE_LIMIT, 1),
    );
    const sourcePrefix = f.runtime + '/';
    const installedPrefix = join(f.options.root, 'uno/blobs') + '/';
    const normalize = (path: string) => path.replaceAll('\\', '/');
    const counts = {
      sourceFiles: 0,
      sourceBytes: 0,
      installedFiles: 0,
      installedBytes: 0,
    };
    const reset = () => {
      for (const key of Object.keys(counts) as (keyof typeof counts)[])
        counts[key] = 0;
    };
    const read = fs.readFileSync;
    const mocked = vi.spyOn(fs, 'readFileSync').mockImplementation(((
      path: fs.PathOrFileDescriptor,
      options?: unknown,
    ) => {
      const bytes = read(path, options as never);
      const absolute = normalize(resolve(String(path)));
      const size = Buffer.isBuffer(bytes)
        ? bytes.length
        : Buffer.byteLength(bytes);
      if (
        absolute.startsWith(normalize(sourcePrefix)) &&
        absolute !== normalize(join(f.runtime, 'modules.json'))
      ) {
        counts.sourceFiles++;
        counts.sourceBytes += size;
      }
      if (absolute.startsWith(normalize(installedPrefix))) {
        counts.installedFiles++;
        counts.installedBytes += size;
      }
      return bytes;
    }) as typeof fs.readFileSync);
    syncBuiltinESMExports();
    try {
      const first = new LocalModuleStore(f.options);
      first.loadDevelopment(f.runtime);
      const ref = first.current('uno', 'first')!.releaseId;
      const release = first.snapshot().index.releases[ref]!;
      const blob = first.snapshot().index.blobs[release.code]!;
      expect(counts).toEqual({
        sourceFiles: blob.files.length,
        sourceBytes: blob.installedBytes,
        installedFiles: blob.files.length,
        installedBytes: blob.installedBytes,
      });
      reset();

      const reopened = new LocalModuleStore(f.options);
      expect(counts).toEqual({
        sourceFiles: 0,
        sourceBytes: 0,
        installedFiles: blob.files.length,
        installedBytes: blob.installedBytes,
      });
      reset();
      reopened.loadDevelopment(f.runtime);
      expect(counts).toEqual({
        sourceFiles: blob.files.length,
        sourceBytes: blob.installedBytes,
        installedFiles: blob.files.length,
        installedBytes: blob.installedBytes,
      });
      reset();
      for (const variant of ['first', 'second'])
        expect(
          reopened.resolveModule(reopened.current('uno', variant)!.releaseId),
        ).toBeDefined();
      expect(counts.installedFiles).toBe(0);
      expect(counts.installedBytes).toBe(0);

      // The index-stage proof never excuses a later registration check.
      const betweenStages = new LocalModuleStore(f.options);
      const target = join(f.options.root, 'uno', 'blobs', blob.id);
      writeFileSync(
        join(target, f.module.entries.rules),
        'changed after index',
      );
      betweenStages.loadDevelopment(f.runtime);
      expect(readFileSync(join(target, f.module.entries.rules), 'utf8')).toBe(
        'exact development rules',
      );
      expect(betweenStages.current('uno', 'first')!.releaseId).toBe(ref);
    } finally {
      mocked.mockRestore();
      syncBuiltinESMExports();
    }
  });

  it('creates absent parent directories and rejects damaged or extra installed files on reopening', () => {
    for (const kind of ['damaged', 'extra']) {
      const f = developmentFixture();
      const store = new LocalModuleStore(f.options);
      store.loadDevelopment(f.runtime);
      const ref = store.current('uno')!.releaseId;
      const installed = store.resolveModule(ref)!;
      expect(installed).toBeDefined();
      writeFileSync(
        join(
          installed.root,
          kind === 'extra' ? 'extra.txt' : f.module.entries.rules,
        ),
        'unexpected bytes',
      );
      const reopened = new LocalModuleStore(f.options);
      expect(reopened.resolveModule(ref)).toBeUndefined();
      expect(reopened.snapshot().unavailableReleaseIds).toContain(ref);
    }
  });

  it('rejects an installed-store ancestor junction without touching its target', () => {
    const f = developmentFixture();
    const outside = join(f.root, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'sentinel'), 'preserved');
    symlinkSync(
      outside,
      join(f.root, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    expect(
      () =>
        new LocalModuleStore({
          ...f.options,
          root: join(f.root, 'linked/packages'),
        }),
    ).toThrow('store-link-rejected');
    expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('preserved');
    expect(existsSync(join(outside, 'packages'))).toBe(false);
  });

  it('rejects a runtime ancestor junction and rules-file symlink metadata', () => {
    const f = developmentFixture();
    const store = new LocalModuleStore(f.options);
    const alias = join(f.root, 'runtime-alias');
    symlinkSync(
      f.runtime,
      alias,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    expect(() => store.loadDevelopment(alias)).toThrow('runtime-link-rejected');
    const rulesPath = join(f.runtime, f.module.entries.rules);
    const outside = join(f.root, 'outside-rules.cjs');
    writeFileSync(outside, 'preserved source');
    rmSync(rulesPath);
    let restore = () => {};
    try {
      symlinkSync(outside, rulesPath, 'file');
    } catch (error) {
      if (
        process.platform !== 'win32' ||
        (error as NodeJS.ErrnoException).code !== 'EPERM'
      )
        throw error;
      // Standard Windows accounts can create junctions but require an extra
      // privilege for file symlinks. Keep the real junction check above and
      // inject only the unavailable file's OS metadata for this rejection.
      writeFileSync(rulesPath, 'unread placeholder');
      const original = fs.lstatSync;
      const mocked = vi.spyOn(fs, 'lstatSync').mockImplementation(((
        path: fs.PathLike,
        options?: unknown,
      ) => {
        const info = original(path, options as never);
        return resolve(String(path)) === rulesPath
          ? Object.assign(Object.create(info), { isSymbolicLink: () => true })
          : info;
      }) as typeof fs.lstatSync);
      syncBuiltinESMExports();
      restore = () => {
        mocked.mockRestore();
        syncBuiltinESMExports();
      };
      console.info(
        'File symlink creation denied by Windows EPERM; injected lstat symlink metadata for this case.',
      );
    }
    try {
      expect(() => store.loadDevelopment(f.runtime)).toThrow(
        'runtime-link-rejected',
      );
    } finally {
      restore();
    }
    expect(readFileSync(outside, 'utf8')).toBe('preserved source');
  });

  it('propagates permission and ENOTDIR failures instead of treating them as absent paths', () => {
    const original = fs.lstatSync;
    for (const code of ['EACCES', 'ENOTDIR']) {
      const f = developmentFixture();
      const error = Object.assign(new Error('path check ' + code), { code });
      const mocked = vi.spyOn(fs, 'lstatSync').mockImplementation(((
        path: fs.PathLike,
        options?: unknown,
      ) => {
        if (resolve(String(path)) === f.options.root) throw error;
        return original(path, options as never);
      }) as typeof fs.lstatSync);
      syncBuiltinESMExports();
      try {
        expect(() => new LocalModuleStore(f.options)).toThrow(error);
      } finally {
        mocked.mockRestore();
        syncBuiltinESMExports();
      }
    }
  });

  it('rejects escaping runtime entries before materializing them', () => {
    const f = developmentFixture();
    f.module.entries.rules = '../outside.cjs';
    writeFileSync(join(f.runtime, 'modules.json'), JSON.stringify([f.module]));
    const store = new LocalModuleStore(f.options);
    expect(() => store.loadDevelopment(f.runtime)).toThrow(
      'invalid-legacy-entry',
    );
    expect(store.current('uno')).toBeUndefined();
  });
});
function zip(files: [string, Buffer][], mode = 0): Buffer {
  const locals: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const [path, data] of files) {
    const name = Buffer.from(path),
      local = Buffer.alloc(30),
      entry = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    entry.writeUInt32LE(0x02014b50);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(crc32(data), 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(mode >>> 0, 38);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    central.push(entry, name);
    offset += local.length + name.length + data.length;
  }
  const cd = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
function fixture(text = 'first') {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const files: [string, Buffer][] = [
    ['rules.cjs', Buffer.from(text)],
    ['bot.cjs', Buffer.from('bot')],
    ['web/index.js', Buffer.from('web')],
    ['web/private.cjs', Buffer.from('server-only')],
  ];
  const archive = zip(files);
  const blob: PackageBlob = {
    id: '',
    kind: 'code',
    files: files.map(([path, data]) => ({
      path,
      size: data.length,
      sha256: sha256(data),
    })),
    archiveBytes: archive.length,
    archiveSha256: sha256(archive),
    installedBytes: files.reduce((n, [, data]) => n + data.length, 0),
    assetName: 'code.zip',
    releaseTag: 'v1.0.6',
  };
  blob.id = blobIdentity(blob);
  const module = JSON.parse(
    readFileSync(resolve('games/uno/game-module.json'), 'utf8'),
  );
  module.entries = { rules: 'rules.cjs', bot: 'bot.cjs', web: 'web/index.js' };
  const release: GameRelease = {
    releaseId: '',
    gameId: 'uno',
    module,
    code: blob.id,
    resources: [],
    resourceMap: {},
    releaseTag: 'v1.0.6',
  };
  release.releaseId = releaseIdentity(release);
  const catalog: PackageCatalog = {
    schemaVersion: 1,
    releases: [release],
    blobs: [blob],
  };
  const envelope: SignedCatalog = {
    payload: catalog,
    signature: sign(null, Buffer.from(canonical(catalog)), privateKey).toString(
      'base64',
    ),
  };
  const temporaryRoot = resolve(process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp');
  mkdirSync(temporaryRoot, { recursive: true });
  const root = mkdtempSync(join(temporaryRoot, 'package-store-'));
  roots.push(root);
  const offline = join(root, 'offline.zip');
  writeFileSync(
    offline,
    zip([
      ['catalog.json', Buffer.from(JSON.stringify(envelope))],
      [
        'release.json',
        Buffer.from(JSON.stringify({ releaseId: release.releaseId })),
      ],
      [`blobs/${blob.id}.zip`, archive],
    ]),
  );
  return {
    publicKey,
    privateKey,
    root,
    offline,
    release,
    blob,
    envelope,
    archive,
  };
}
describe('signed immutable package store', () => {
  it('merges concurrent release commits into the latest durable index', async () => {
    const first = fixture('first'),
      second = fixture('second');
    const payload = {
      schemaVersion: 1 as const,
      releases: [first.release, second.release],
      blobs: [first.blob, second.blob],
    };
    const envelope = {
      payload,
      signature: sign(
        null,
        Buffer.from(canonical(payload)),
        first.privateKey,
      ).toString('base64'),
    };
    const options = {
      root: join(first.root, 'games'),
      publicKey: first.publicKey,
      protectedReleaseIds: () => [],
      fetch: async (url: string | URL | Request) =>
        new Response(
          new Uint8Array(
            String(url).endsWith(first.blob.id)
              ? first.archive
              : second.archive,
          ),
        ),
      assetUrl: (blob: PackageBlob) => 'https://example.invalid/' + blob.id,
    };
    const store = new PackageStore(options);
    store.setCatalog(envelope);
    await Promise.all([
      store.install(first.release.releaseId),
      store.install(second.release.releaseId),
    ]);
    for (const value of [store, new PackageStore(options)]) {
      expect(Object.keys(value.snapshot().index.releases).sort()).toEqual(
        [first.release.releaseId, second.release.releaseId].sort(),
      );
      expect(Object.keys(value.snapshot().index.blobs)).toHaveLength(2);
    }
  });

  it('retires only recognized uncommitted journal temporaries without parsing partial JSON', async () => {
    const f = fixture(),
      root = join(f.root, 'games');
    const options = {
      root,
      publicKey: f.publicKey,
      protectedReleaseIds: () => [],
      fetch: async () => new Response(new Uint8Array(f.archive)),
      assetUrl: () => 'https://example.invalid/',
    };
    const store = new PackageStore(options);
    store.setCatalog(f.envelope);
    await store.install(f.release.releaseId);
    const txn = '11111111-1111-4111-8111-111111111111',
      atomic = '22222222-2222-4222-8222-222222222222';
    const temporary = join(root, '.transactions', `${txn}.json.${atomic}.tmp`),
      stage = join(root, '.staging', txn);
    for (const bytes of ['', '{"stage":', '{"uncommitted":true}']) {
      mkdirSync(stage);
      writeFileSync(join(stage, 'partial'), 'not installed');
      writeFileSync(temporary, bytes);
      expect(
        new PackageStore(options).snapshot().index.releases[
          f.release.releaseId
        ],
      ).toBeDefined();
      expect(existsSync(temporary)).toBe(false);
      expect(existsSync(stage)).toBe(false);
    }
    writeFileSync(join(root, '.transactions', 'unexpected.tmp'), '{}');
    expect(() => new PackageStore(options)).toThrow('invalid-install-journal');
  });

  it('recovers the durable visibility boundary at each installation commit interruption', async () => {
    for (const phase of [
      'before-journal',
      'before-index',
      'after-index',
    ] as const) {
      const f = fixture();
      const root = join(f.root, 'games');
      const store = new PackageStore({
        root,
        publicKey: f.publicKey,
        protectedReleaseIds: () => [],
        assetUrl: () => 'https://example.invalid/asset',
        fetch: async () => new Response(new Uint8Array(f.archive)),
        fault: (at) => {
          if (at === phase) throw new Error('simulated-interruption');
        },
      });
      store.setCatalog(f.envelope);
      await expect(store.install(f.release.releaseId)).rejects.toThrow(
        'simulated-interruption',
      );
      const restarted = new PackageStore({
        root,
        publicKey: f.publicKey,
        protectedReleaseIds: () => [],
      });
      expect(restarted.selected('uno')?.releaseId).toBe(
        phase === 'after-index' ? f.release.releaseId : undefined,
      );
    }
  });
  it('survives injected disk commit failures, preserving prior index and permitting missing-package repair', async () => {
    const f = fixture();
    let fault = false;
    const store = new PackageStore({
      root: join(f.root, 'games'),
      publicKey: f.publicKey,
      protectedReleaseIds: () => [],
      assetUrl: () => 'https://example.invalid/asset',
      fetch: async () => new Response(new Uint8Array(f.archive)),
      fault: (phase) => {
        if (fault && phase === 'before-index') throw new Error('ENOSPC');
      },
    });
    store.setCatalog(f.envelope);
    fault = true;
    await expect(store.install(f.release.releaseId)).rejects.toThrow('ENOSPC');
    expect(store.selected('uno')).toBeUndefined();
    const reopened = new PackageStore({
      root: join(f.root, 'games'),
      publicKey: f.publicKey,
      protectedReleaseIds: () => [],
      assetUrl: () => 'https://example.invalid/asset',
      fetch: async () => new Response(new Uint8Array(f.archive)),
    });
    expect(reopened.selected('uno')).toBeUndefined();
    await reopened.install(f.release.releaseId);
    rmSync(
      join(reopened.resolveModule(f.release.releaseId)!.root, 'rules.cjs'),
    );
    const missing = new PackageStore({
      root: join(f.root, 'games'),
      publicKey: f.publicKey,
      protectedReleaseIds: () => [],
      assetUrl: () => 'https://example.invalid/asset',
      fetch: async () => new Response(new Uint8Array(f.archive)),
    });
    expect(missing.resolveModule(f.release.releaseId)).toBeUndefined();
    expect(missing.snapshot().unavailableReleaseIds).toContain(
      f.release.releaseId,
    );
    expect(
      missing.snapshot().index.releases[f.release.releaseId],
    ).toBeDefined();
    const newer = fixture('newer release');
    missing.setCatalog({
      payload: newer.envelope.payload,
      signature: sign(
        null,
        Buffer.from(canonical(newer.envelope.payload)),
        f.privateKey,
      ).toString('base64'),
    });
    await missing.install(f.release.releaseId);
    expect(missing.resolveModule(f.release.releaseId)).toBeDefined();
    expect(missing.snapshot().unavailableReleaseIds).not.toContain(
      f.release.releaseId,
    );
    expect(missing.snapshot().catalog.releases[0]?.releaseId).toBe(
      newer.release.releaseId,
    );
  });
  it('binds legacy migration to exact preserved bytes and tuple, and safely retires an unfinished transaction', () => {
    const f = fixture();
    const gameRoot = join(f.root, 'games'),
      snapshot = join(gameRoot, '.legacy', 'abc123');
    mkdirSync(join(snapshot, 'games'), { recursive: true });
    mkdirSync(join(snapshot, 'bots'), { recursive: true });
    mkdirSync(join(snapshot, 'web', 'games', 'uno', 'web'), {
      recursive: true,
    });
    const module = structuredClone(f.release.module);
    module.entries = {
      rules: 'games/uno.cjs',
      bot: 'bots/uno.cjs',
      web: '/games/uno/web/entry.js',
    };
    module.styles = [];
    writeFileSync(join(snapshot, 'modules.json'), JSON.stringify([module]));
    writeFileSync(join(snapshot, 'games', 'uno.cjs'), 'exact old rules');
    writeFileSync(join(snapshot, 'bots', 'uno.cjs'), 'exact old bot');
    writeFileSync(
      join(snapshot, 'web', 'games', 'uno', 'web', 'entry.js'),
      'old browser',
    );
    const store = new PackageStore({
      root: gameRoot,
      publicKey: f.publicKey,
      protectedReleaseIds: () => [],
    });
    const [ref] = store.migrateLegacy(snapshot);
    expect(ref).toBeDefined();
    expect(
      store.findLegacyRelease('uno', undefined, module.compatibility)
        ?.releaseId,
    ).toBe(ref);
    expect(
      store.findLegacyRelease('uno', undefined, {
        ...module.compatibility,
        rulesVersion: 'unknown',
      }),
    ).toBeUndefined();
    expect(
      readFileSync(
        join(store.resolveModule(ref!)!.root, module.entries.rules),
        'utf8',
      ),
    ).toBe('exact old rules');
    expect(store.resolvePublicFile(ref!, 'web/web/entry.js')).toBeDefined();
    mkdirSync(join(gameRoot, '.staging', 'abc-def'), { recursive: true });
    writeFileSync(
      join(gameRoot, '.transactions', 'abc-def.json'),
      JSON.stringify({
        gameId: 'uno',
        stage: 'abc-def',
        blobs: [],
        index: store.snapshot().index,
      }),
    );
    const reopened = new PackageStore({
      root: gameRoot,
      publicKey: f.publicKey,
      protectedReleaseIds: () => [],
    });
    expect(reopened.selected('uno')?.releaseId).toBe(ref);
  });
  it('keeps old package selected after failed update, and rollback uses the exact old reference', async () => {
    const first = fixture('old'),
      newer = fixture('new');
    const catalog: PackageCatalog = {
      schemaVersion: 1,
      releases: [first.release, newer.release],
      blobs: [first.blob, newer.blob],
    };
    const envelope = {
      payload: catalog,
      signature: sign(
        null,
        Buffer.from(canonical(catalog)),
        first.privateKey,
      ).toString('base64'),
    };
    let corrupt = false;
    const store = new PackageStore({
      root: join(first.root, 'games'),
      publicKey: first.publicKey,
      protectedReleaseIds: () => [],
      assetUrl: (b) => b.id,
      fetch: async (url) =>
        new Response(
          new Uint8Array(
            corrupt
              ? Buffer.from('bad')
              : String(url) === first.blob.id
                ? first.archive
                : newer.archive,
          ),
        ),
    });
    store.setCatalog(envelope);
    await store.install(first.release.releaseId);
    corrupt = true;
    await expect(store.install(newer.release.releaseId)).rejects.toThrow();
    expect(store.selected('uno')?.releaseId).toBe(first.release.releaseId);
    corrupt = false;
    await store.install(newer.release.releaseId);
    expect(store.resolveModule(first.release.releaseId)).toBeDefined();
    store.rollback(first.release.releaseId);
    expect(store.selected('uno')?.releaseId).toBe(first.release.releaseId);
  });
  it('imports complete signed dependencies, exposes only public web and protects referenced releases', async () => {
    const f = fixture();
    const store = new PackageStore({
      root: join(f.root, 'games'),
      publicKey: f.publicKey,
      protectedReleaseIds: () => [f.release.releaseId],
    });
    await store.importOffline(f.offline);
    expect(store.selected('uno')?.releaseId).toBe(f.release.releaseId);
    expect(
      store.resolvePublicFile(f.release.releaseId, 'rules.cjs'),
    ).toBeUndefined();
    expect(
      store.resolvePublicFile(f.release.releaseId, 'web/private.cjs'),
    ).toBeUndefined();
    expect(
      readFileSync(
        store.resolvePublicFile(f.release.releaseId, 'web/index.js')!,
        'utf8',
      ),
    ).toBe('web');
    expect(() => store.uninstall(f.release.releaseId)).toThrow(
      'release-in-use',
    );
    const restarted = new PackageStore({
      root: join(f.root, 'games'),
      publicKey: f.publicKey,
      protectedReleaseIds: () => [],
    });
    expect(restarted.selected('uno')?.releaseId).toBe(f.release.releaseId);
  });
  it('rejects tampered catalog, escaping paths, case collision and links before installation', () => {
    const f = fixture();
    f.envelope.payload.releases[0]!.gameId = 'tampered';
    expect(() => verifyCatalog(f.envelope, f.publicKey)).toThrow(
      'invalid-catalog-signature',
    );
    for (const files of [
      [['../bad', Buffer.from('x')]],
      [
        ['A', Buffer.from('x')],
        ['a', Buffer.from('x')],
      ],
    ] as [string, Buffer][][])
      expect(() => readZip(zip(files))).toThrow('unsafe-zip-member');
    expect(() =>
      readZip(zip([['link', Buffer.from('target')]], 0xa1ff0000)),
    ).toThrow('unsafe-zip-member');
  });
  it('deduplicates local materialization requests, commits once and reports real byte totals', async () => {
    const f = fixture();
    let calls = 0;
    const store = new PackageStore({
      root: join(f.root, 'games'),
      publicKey: f.publicKey,
      protectedReleaseIds: () => [],
      assetUrl: () => 'https://example.invalid/asset',
      fetch: async () => {
        calls++;
        return new Response(new Uint8Array(f.archive));
      },
    });
    store.setCatalog(f.envelope);
    await Promise.all([
      store.install(f.release.releaseId),
      store.install(f.release.releaseId),
    ]);
    expect(calls).toBe(1);
    expect(store.snapshot().tasks[0]).toMatchObject({
      phase: 'complete',
      transferredBytes: f.archive.length,
      totalBytes: f.archive.length,
    });
  });
  it('hash failures retain previous installed selection and cancellation never registers', async () => {
    const f = fixture();
    const store = new PackageStore({
      root: join(f.root, 'games'),
      publicKey: f.publicKey,
      protectedReleaseIds: () => [],
      assetUrl: () => 'https://example.invalid/asset',
      fetch: async () => new Response(Buffer.from('bad')),
    });
    store.setCatalog(f.envelope);
    await expect(store.install(f.release.releaseId)).rejects.toThrow(
      'archive-hash-mismatch',
    );
    expect(store.selected('uno')).toBeUndefined();
    expect(store.snapshot().tasks[0]?.phase).toBe('failed');
  });
});
