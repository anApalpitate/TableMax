import { describe, it, expect, afterEach } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { PackageStore } from './store';
import {
  canonical,
  sha256,
  blobIdentity,
  releaseIdentity,
  readZip,
  crc32,
  verifyCatalog,
} from './verification';
import type {
  GameRelease,
  PackageBlob,
  PackageCatalog,
  SignedCatalog,
} from './types';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
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
  mkdirSync(resolve('tmp'), { recursive: true });
  const root = mkdtempSync(resolve('tmp/package-store-'));
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
  it('limits concurrent distinct dependency downloads to two', async () => {
    const fixtures = [fixture('one'), fixture('two'), fixture('three')];
    const first = fixtures[0]!;
    for (let i = 0; i < fixtures.length; i++) {
      fixtures[i]!.release.variantId = `variant-${i}`;
      fixtures[i]!.release.releaseId = releaseIdentity(fixtures[i]!.release);
    }
    const catalog: PackageCatalog = {
      schemaVersion: 1,
      releases: fixtures.map((f) => f.release),
      blobs: fixtures.map((f) => f.blob),
    };
    let active = 0,
      max = 0;
    const store = new PackageStore({
      root: join(first.root, 'games'),
      publicKey: first.publicKey,
      protectedReleaseIds: () => [],
      assetUrl: (b) => b.id,
      fetch: async (url) => {
        active++;
        max = Math.max(max, active);
        await new Promise((done) => setTimeout(done, 10));
        active--;
        return new Response(
          new Uint8Array(
            fixtures.find((f) => f.blob.id === String(url))!.archive,
          ),
        );
      },
    });
    store.setCatalog({
      payload: catalog,
      signature: sign(
        null,
        Buffer.from(canonical(catalog)),
        first.privateKey,
      ).toString('base64'),
    });
    await Promise.all(fixtures.map((f) => store.install(f.release.releaseId)));
    expect(max).toBe(2);
    expect(Object.keys(store.snapshot().index.releases)).toHaveLength(3);
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
  it('cancels a stalled transfer without installing or counting it as a strategy failure', async () => {
    const f = fixture();
    let abortObserved = false;
    const store = new PackageStore({
      root: join(f.root, 'games'),
      publicKey: f.publicKey,
      protectedReleaseIds: () => [],
      assetUrl: () => 'https://example.invalid/asset',
      fetch: async (_url, init) =>
        new Promise<Response>((_done, reject) => {
          init?.signal?.addEventListener('abort', () => {
            abortObserved = true;
            reject(new Error('aborted'));
          });
        }),
    });
    store.setCatalog(f.envelope);
    const task = store.install(f.release.releaseId);
    await new Promise((done) => setTimeout(done, 5));
    store.cancel(f.release.releaseId);
    await expect(task).rejects.toThrow('aborted');
    expect(abortObserved).toBe(true);
    expect(store.snapshot().tasks[0]?.phase).toBe('cancelled');
    expect(store.selected('uno')).toBeUndefined();
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
  it('deduplicates online requests, commits once and reports real byte totals', async () => {
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
