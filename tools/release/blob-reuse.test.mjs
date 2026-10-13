import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  createBlob,
  createSignedCatalog,
  canonical,
  sha256,
} from './game-package-format.mjs';
import { loadTrustedBlobReuse } from './blob-reuse.mjs';

const keys = generateKeyPairSync('ed25519');
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' });
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
async function fixture() {
  const directory = await mkdtemp(resolve('tmp/efficiency-build-'));
  const before = join(directory, 'before'),
    after = join(directory, 'after');
  await mkdir(before);
  await mkdir(after);
  const records = [
    { path: 'rules/game.cjs', data: Buffer.from('exports.version=1') },
    { path: 'bots/game.cjs', data: Buffer.from('exports.version=1') },
    { path: 'web/entry.js', data: Buffer.from('export default 1') },
  ];
  const resourceRecords = [
    {
      path: 'icon.webp',
      data: Buffer.from('fixed-fixture-resource'.repeat(100)),
    },
  ];
  const code = await createBlob('code', records, before, 'v1.0.6');
  const resource = await createBlob(
    'resources',
    resourceRecords,
    before,
    'v1.0.6',
  );
  // Valid prior bytes intentionally differ from the current writer's timestamp recipe.
  const archive = await readFile(join(before, resource.assetName));
  archive.writeUInt16LE(1, 10);
  resource.archiveSha256 = sha256(archive);
  await writeFile(join(before, resource.assetName), archive);
  const body = {
    gameId: 'probe',
    module: {
      id: 'probe',
      entries: {
        rules: 'rules/game.cjs',
        bot: 'bots/game.cjs',
        web: 'web/entry.js',
      },
    },
    code: code.id,
    resources: [resource.id],
    resourceMap: {
      'probe/icon.webp': { blobId: resource.id, path: 'icon.webp' },
    },
    releaseTag: 'v1.0.6',
  };
  const catalog = {
    schemaVersion: 1,
    blobs: [code, resource],
    releases: [{ releaseId: sha256(canonical(body)), ...body }],
  };
  const catalogPath = join(before, 'TableMax-game-catalog-v1.0.6.json');
  const sign = async () =>
    writeFile(
      catalogPath,
      JSON.stringify(createSignedCatalog(catalog, privateKey)),
    );
  await sign();
  return {
    directory,
    before,
    after,
    records,
    resourceRecords,
    code,
    resource,
    catalog,
    catalogPath,
    sign,
  };
}

test('single code change preserves exact trusted resource bytes and recompresses only code', async () => {
  const f = await fixture();
  const reuse = await loadTrustedBlobReuse([f.before], { publicKey });
  const changed = f.records.map((item) => ({
    ...item,
    data: Buffer.concat([item.data, Buffer.from(';')]),
  }));
  const code = await createBlob('code', changed, f.after, 'v1.0.6', { reuse });
  const resource = await createBlob(
    'resources',
    f.resourceRecords,
    f.after,
    'v1.0.6',
    { reuse },
  );
  assert.notEqual(code.id, f.code.id);
  assert.deepEqual(resource, f.resource);
  assert.equal(
    sha256(await readFile(join(f.after, resource.assetName))),
    f.resource.archiveSha256,
  );
  assert.deepEqual(
    [reuse.metrics.reusedBlobs, reuse.metrics.compressedBlobs],
    [1, 1],
  );
  assert.equal(reuse.evidence[0].archiveSha256, f.resource.archiveSha256);
});

test('untrusted directory signature and archive corruption fail closed', async () => {
  const f = await fixture();
  const wrong = generateKeyPairSync('ed25519').publicKey.export({
    type: 'spki',
    format: 'pem',
  });
  await assert.rejects(
    loadTrustedBlobReuse([f.before], { publicKey: wrong }),
    /signature/,
  );
  await writeFile(join(f.before, f.code.assetName), Buffer.from('corrupt'));
  await assert.rejects(
    loadTrustedBlobReuse([f.before], { publicKey }),
    /archive integrity/,
  );
});

test('signed incorrect member hashes and missing dependencies cannot become trusted reuse', async () => {
  const f = await fixture();
  f.catalog.blobs[0].files[0].sha256 = '0'.repeat(64);
  f.catalog.blobs[0].id = sha256(
    canonical({
      kind: f.catalog.blobs[0].kind,
      files: f.catalog.blobs[0].files,
    }),
  );
  f.catalog.releases[0].code = f.catalog.blobs[0].id;
  const body = { ...f.catalog.releases[0] };
  delete body.releaseId;
  f.catalog.releases[0].releaseId = sha256(canonical(body));
  await f.sign();
  await assert.rejects(
    loadTrustedBlobReuse([f.before], { publicKey }),
    /member integrity/,
  );
  const second = await fixture();
  second.catalog.blobs = [second.catalog.blobs[0]];
  await second.sign();
  await assert.rejects(
    loadTrustedBlobReuse([second.before], { publicKey }),
    /missing-package-dependency/,
  );
  const collision = await fixture();
  collision.resource.assetName = collision.code.assetName;
  await collision.sign();
  await assert.rejects(
    loadTrustedBlobReuse([collision.before], { publicKey }),
    /asset whitelist/,
  );
});

test('signed unsupported ZIP metadata and missing archive reject reuse', async () => {
  const f = await fixture();
  const archive = await readFile(join(f.before, f.resource.assetName));
  const central = archive.readUInt32LE(archive.length - 6);
  archive.writeUInt32LE(0xa0000000, central + 38);
  f.resource.archiveSha256 = sha256(archive);
  await writeFile(join(f.before, f.resource.assetName), archive);
  await f.sign();
  await assert.rejects(
    loadTrustedBlobReuse([f.before], { publicKey }),
    /unsafe-zip-member/,
  );
  const second = await fixture();
  await rename(
    join(second.before, second.resource.assetName),
    join(second.before, 'missing.zip'),
  );
  await assert.rejects(loadTrustedBlobReuse([second.before], { publicKey }), {
    code: 'ENOENT',
  });
});
