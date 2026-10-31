import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const option = (name) =>
  process.argv
    .find((a) => a.startsWith('--' + name + '='))
    ?.slice(name.length + 3);
const task = path.resolve(option('task') ?? '');
assert(
  task.startsWith(path.resolve('tmp') + path.sep),
  'task must be within tmp',
);
const evidence = option('evidence');
assert.match(evidence ?? '', /^[a-z0-9-]+$/);
const source = path.resolve(option('source') ?? '');
const work = path.join(task, evidence),
  formal = path.resolve('artifacts/maintenance', path.basename(task), evidence);
await fs.mkdir(work, { recursive: false });
await fs.mkdir(formal, { recursive: true });
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
const report = {
  boundary:
    'Current source store/service with real signed preinstalled package bytes. History archive handoff is an explicit post-preservation fixture; does not prove installer preservation or system capacity.',
  checks: [],
  failures: [],
  inputs: [],
};
const check = async (id, run) => {
  try {
    const details = await run();
    report.checks.push({ id, result: 'passed', details });
  } catch (error) {
    report.failures.push({ id, error: error.stack });
    report.checks.push({ id, result: 'failed' });
    if (report.failures.length >= 10) throw error;
  }
};
const entry = path.join(work, 'entry.ts');
await fs.writeFile(
  entry,
  `export {createService} from ${JSON.stringify(path.resolve('apps/server/src/service.ts'))};export {PackageStore} from ${JSON.stringify(path.resolve('apps/server/src/game-packages/store.ts'))};export {PROJECT_GAME_PUBLIC_KEY as key} from ${JSON.stringify(path.resolve('apps/server/src/game-packages/project-public-key.ts'))};export {readZip} from ${JSON.stringify(path.resolve('apps/server/src/game-packages/verification.ts'))};`,
);
const out = path.join(work, 'runtime.cjs');
const built = await build({
  entryPoints: [entry],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  metafile: true,
  logLevel: 'silent',
});
for (const p of Object.keys(built.metafile.inputs).filter(
  (p) => !p.includes('node_modules') && !path.resolve(p).startsWith(work),
))
  report.inputs.push({ path: p, sha256: hash(await fs.readFile(p)) });
const { PackageStore, createService, key, readZip } = createRequire(
  import.meta.url,
)(out);
const seedPath = path.join(source, '..', 'web', 'catalog.json');
const seedBytes = await fs.readFile(seedPath);
report.inputs.push({ path: seedPath, sha256: hash(seedBytes) });
await fs.mkdir(path.join(work, 'web'), { recursive: true });
await fs.writeFile(path.join(work, 'web', 'catalog.json'), seedBytes);
const app = path.join(work, 'app'),
  preinstalled = path.join(app, 'preinstalled-games'),
  games = path.join(work, 'games');
await fs.cp(source, preinstalled, { recursive: true });
await fs.mkdir(path.join(app, 'web'), { recursive: true });
await fs.writeFile(
  path.join(app, 'web', 'index.html'),
  '<html>archive lifecycle</html>',
);
const catalogBytes = await fs.readFile(path.join(preinstalled, 'catalog.json'));
const catalog = JSON.parse(catalogBytes).payload;
const bootstrap = JSON.parse(
  await fs.readFile(path.join(preinstalled, 'bootstrap.json'), 'utf8'),
);
const releases = bootstrap.releaseIds.map((id) =>
  catalog.releases.find((r) => r.releaseId === id),
);
const resourceIds = [...new Set(releases.flatMap((r) => r.resources))];
for (const p of [
  'catalog.json',
  'bootstrap.json',
  ...catalog.blobs
    .filter((b) =>
      bootstrap.releaseIds.some((id) => {
        const r = catalog.releases.find((r) => r.releaseId === id);
        return r.code === b.id || r.resources.includes(b.id);
      }),
    )
    .map((b) => 'blobs/' + b.id + '.zip'),
])
  report.inputs.push({
    path: path.join(source, p),
    sha256: hash(await fs.readFile(path.join(source, p))),
  });
const opts = {
  root: games,
  publicKey: key,
  protectedReleaseIds: () => releases.map((r) => r.releaseId),
};
let store = new PackageStore(opts),
  service;
const bytesOf = async (asset) =>
  asset?.data ?? (asset ? await fs.readFile(asset.path) : undefined);
const noMaterializedResources = async () => {
  for (const r of releases)
    for (const id of r.resources)
      await assert.rejects(fs.access(path.join(games, r.gameId, 'blobs', id)), {
        code: 'ENOENT',
      });
};
try {
  await check('fresh-current-resources-stay-archived', async () => {
    await store.importPreinstalled(preinstalled);
    for (const r of releases) assert(store.resolveModule(r.releaseId));
    await noMaterializedResources();
    return { releases: releases.length, resourceBlobs: resourceIds.length };
  });
  await check('every-public-resource-real-http-sha-and-mime', async () => {
    service = await createService({
      dataDir: path.join(work, 'data'),
      gamesDir: games,
      webDir: path.join(app, 'web'),
      host: '127.0.0.1',
      port: 0,
      playMode: 'test',
    });
    const origin = 'http://127.0.0.1:' + (await service.listen());
    let count = 0,
      total = 0;
    for (const r of releases) {
      for (const [name, ref] of Object.entries(r.resourceMap)) {
        const blob = catalog.blobs.find((b) => b.id === ref.blobId),
          file = blob.files.find((f) => f.path === ref.path);
        const response = await fetch(
          origin + '/game-packages/' + r.releaseId + '/resources/' + name,
        );
        assert.equal(response.status, 200, name);
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(bytes.length, file.size, name);
        assert.equal(hash(bytes), file.sha256, name);
        if (count === 0) {
          const url =
            origin + '/game-packages/' + r.releaseId + '/resources/' + name;
          for (const [range, expected] of [
            ['bytes=0-15', bytes.subarray(0, 16)],
            ['bytes=-16', bytes.subarray(-16)],
          ]) {
            const partial = await fetch(url, { headers: { Range: range } });
            assert.equal(partial.status, 206);
            assert.deepEqual(
              Buffer.from(await partial.arrayBuffer()),
              expected,
            );
          }
          const invalid = await fetch(url, {
            headers: { Range: 'bytes=999999999-' },
          });
          assert.equal(invalid.status, 416);
        }
        assert.match(response.headers.get('cache-control'), /immutable/);
        if (name.endsWith('.webp'))
          assert.match(response.headers.get('content-type'), /image\/webp/);
        count++;
        total += bytes.length;
      }
      for (const denied of [
        r.module.entries.rules,
        r.module.entries.bot,
        'web/secret.cjs',
        'web/secret.cjs.br',
      ]) {
        const response = await fetch(
          origin + '/game-packages/' + r.releaseId + '/' + denied,
        );
        assert.notEqual(response.status, 200, denied);
      }
    }
    await service.close();
    service = undefined;
    await noMaterializedResources();
    return { resourceRequests: count, bytesVerified: total };
  });
  await check('restart-current-mapping-and-byte-identity', async () => {
    store = new PackageStore(opts);
    await store.importPreinstalled(preinstalled);
    for (const r of releases) {
      assert.equal(store.current(r.gameId, r.variantId).releaseId, r.releaseId);
      for (const [name, ref] of Object.entries(r.resourceMap)) {
        const file = catalog.blobs
          .find((b) => b.id === ref.blobId)
          .files.find((f) => f.path === ref.path);
        assert.equal(
          hash(await bytesOf(store.resolvePublicResource(r.releaseId, name))),
          file.sha256,
        );
      }
    }
    await noMaterializedResources();
  });
  await check('source-tamper-rejected-without-index-change', async () => {
    const id = resourceIds[0],
      target = path.join(preinstalled, 'blobs', id + '.zip'),
      original = await fs.readFile(target),
      index = await fs.readFile(path.join(games, 'index.json'));
    const changed = Buffer.from(original);
    changed[changed.length - 1] ^= 1;
    await fs.writeFile(target, changed);
    try {
      await assert.rejects(
        new PackageStore(opts).importPreinstalled(preinstalled),
      );
      assert.deepEqual(
        await fs.readFile(path.join(games, 'index.json')),
        index,
      );
    } finally {
      await fs.writeFile(target, original);
    }
  });
  await check('missing-current-archive-rejected', async () => {
    const target = path.join(preinstalled, 'blobs', resourceIds[0] + '.zip'),
      held = target + '.held';
    await fs.rename(target, held);
    try {
      await assert.rejects(
        new PackageStore(opts).importPreinstalled(preinstalled),
      );
    } finally {
      await fs.rename(held, target);
    }
  });
  await check('retained-signed-history-survives-old-app-removal', async () => {
    const archives = path.join(games, '.resource-archives');
    await fs.mkdir(path.join(archives, 'catalogs'), { recursive: true });
    await fs.mkdir(path.join(archives, 'blobs'), { recursive: true });
    await fs.writeFile(
      path.join(archives, 'catalogs', hash(catalogBytes) + '.json'),
      catalogBytes,
    );
    for (const id of resourceIds)
      await fs.copyFile(
        path.join(preinstalled, 'blobs', id + '.zip'),
        path.join(archives, 'blobs', id + '.zip'),
      );
    await fs.rename(preinstalled, preinstalled + '.removed');
    store = new PackageStore(opts);
    for (const r of releases) {
      assert(store.resolveModule(r.releaseId));
      for (const [name, ref] of Object.entries(r.resourceMap)) {
        const file = catalog.blobs
          .find((b) => b.id === ref.blobId)
          .files.find((f) => f.path === ref.path);
        assert.equal(
          hash(await bytesOf(store.resolvePublicResource(r.releaseId, name))),
          file.sha256,
        );
      }
    }
    return {
      boundary:
        'Emulates already verified archive preservation; does not execute installer Commit.',
    };
  });
  await check('retained-archive-tamper-rejected', async () => {
    const target = path.join(
        games,
        '.resource-archives',
        'blobs',
        resourceIds[0] + '.zip',
      ),
      original = await fs.readFile(target),
      changed = Buffer.from(original);
    changed[changed.length - 1] ^= 1;
    await fs.writeFile(target, changed);
    try {
      assert.throws(() => new PackageStore(opts));
    } finally {
      await fs.writeFile(target, original);
    }
  });
  await check('legacy-materialized-G-remains-readable', async () => {
    const oldGames = path.join(work, 'legacy-G');
    await fs.cp(games, oldGames, { recursive: true });
    const archives = path.join(oldGames, '.resource-archives');
    await fs.rename(archives, archives + '.excluded');
    for (const r of releases)
      for (const id of r.resources) {
        const members = readZip(
          await fs.readFile(
            path.join(preinstalled + '.removed', 'blobs', id + '.zip'),
          ),
        );
        for (const [name, data] of members) {
          const target = path.join(oldGames, r.gameId, 'blobs', id, name);
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, data);
        }
      }
    const old = new PackageStore({ ...opts, root: oldGames });
    for (const r of releases) {
      assert(old.resolveModule(r.releaseId));
      for (const [name, ref] of Object.entries(r.resourceMap)) {
        const file = catalog.blobs
          .find((b) => b.id === ref.blobId)
          .files.find((f) => f.path === ref.path);
        assert.equal(
          hash(await bytesOf(old.resolvePublicResource(r.releaseId, name))),
          file.sha256,
        );
      }
    }
  });
  await check('missing-retained-archive-refuses-affected-release', async () => {
    const id = resourceIds[0];
    const target = path.join(games, '.resource-archives', 'blobs', id + '.zip');
    await fs.rename(target, target + '.held');
    try {
      const unavailable = new PackageStore(opts);
      for (const release of releases.filter((r) => r.resources.includes(id)))
        assert.equal(unavailable.resolveModule(release.releaseId), undefined);
    } finally {
      await fs.rename(target + '.held', target);
    }
  });
  await check('reinstall-reclaims-only-verified-current-archives', async () => {
    const sentinel = path.join(games, '.resource-archives', 'unknown.dat');
    await fs.writeFile(sentinel, 'Preserve unknown user bytes');
    await fs.rename(preinstalled + '.removed', preinstalled);
    store = new PackageStore(opts);
    await store.importPreinstalled(preinstalled);
    for (const id of resourceIds)
      await assert.rejects(
        fs.access(path.join(games, '.resource-archives', 'blobs', id + '.zip')),
        { code: 'ENOENT' },
      );
    assert.equal(
      await fs.readFile(sentinel, 'utf8'),
      'Preserve unknown user bytes',
    );
    for (const release of releases)
      assert(store.resolveModule(release.releaseId));
    await noMaterializedResources();
  });
} finally {
  if (service) await service.close();
  for (const input of report.inputs) {
    const actual = hash(await fs.readFile(input.path));
    if (actual !== input.sha256)
      report.failures.push({
        id: 'input-integrity',
        path: input.path,
        expected: input.sha256,
        actual,
      });
  }
  report.result = report.failures.length ? 'failed' : 'passed';
  await fs.writeFile(
    path.join(formal, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await fs.writeFile(
    path.join(work, 'report.json'),
    JSON.stringify(report, null, 2),
  );
}
console.log(
  JSON.stringify({
    result: report.result,
    checks: report.checks.length,
    failures: report.failures,
  }),
);
if (report.failures.length) process.exitCode = 1;
