import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  unlink,
  rmdir,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  verifyRetainedGameRecords,
  verifyRetainedGameSnapshot,
  createRetainedPlatformSnapshot,
  selectRetainedGameRelease,
} from './game-packages.mjs';
import { canReuseInternalGames } from './prepare-internal-games.mjs';
import { sha256, canonical } from './game-package-format.mjs';
import { validateInputs } from '../build/module-build.mjs';

function identity(snapshot) {
  return sha256(
    JSON.stringify({
      version: snapshot.version,
      buildVersion: snapshot.buildVersion,
      assemblerSha256: snapshot.assemblerSha256,
      units: snapshot.units.map(({ id, fingerprint }) => ({ id, fingerprint })),
    }),
  );
}

async function fixture(t) {
  const id = 'probe-retained-' + randomUUID().replaceAll('-', '');
  const projector = 'packages/game-sdk/src/metadata.mjs';
  const projectorSha256 = sha256(await readFile(projector));
  const units = [];
  const directories = [];
  const ownedFiles = new Set();
  let originalPath;
  t.after(async () => {
    for (const path of ownedFiles)
      await unlink(path).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    for (const directory of directories.reverse()) await rmdir(directory);
    if (originalPath) await unlink(originalPath);
  });
  for (const part of ['rules', 'bot', 'web', 'metadata']) {
    const unitId = `game-${id}-${part}`;
    const inputs = {
      files: [
        {
          path: `tmp/nonexistent-original-input-${id}`,
          sha256: 'a'.repeat(64),
        },
        { path: projector, sha256: projectorSha256 },
      ],
      globs: [],
    };
    const fingerprint = sha256(JSON.stringify(inputs));
    const parent = resolve('.cache/build-modules/v1', unitId);
    const directory = join(parent, fingerprint);
    const filesDirectory = join(directory, 'files');
    await mkdir(filesDirectory, { recursive: true });
    directories.push(parent, directory, filesDirectory);
    const member = part === 'metadata' ? 'details.json' : part + '.txt';
    const data = Buffer.from(
      part === 'metadata'
        ? JSON.stringify({ schemaVersion: 1, id })
        : `frozen ${part}`,
    );
    const files = [{ path: member, bytes: data.length, sha256: sha256(data) }];
    const unit = { id: unitId, fingerprint, directory, inputs, files };
    units.push(unit);
    const memberPath = join(filesDirectory, member);
    const manifestPath = join(directory, 'manifest.json');
    await writeFile(memberPath, data, { flag: 'wx' });
    await writeFile(
      manifestPath,
      JSON.stringify({ schemaVersion: 1, ...unit }),
      { flag: 'wx' },
    );
    ownedFiles.add(memberPath);
    ownedFiles.add(manifestPath);
  }
  const original = {
    schemaVersion: 1,
    version: '1.0.6',
    buildVersion: '1.0.6.10',
    assemblerSha256: 'b'.repeat(64),
    modules: [{ id }],
    units,
  };
  original.id = identity(original);
  originalPath = resolve('build/snapshots', original.id + '.json');
  await mkdir(resolve('build/snapshots'), { recursive: true });
  const originalRaw = Buffer.from(JSON.stringify(original) + '\n');
  await writeFile(originalPath, originalRaw, { flag: 'wx' });
  const snapshot = {
    ...structuredClone(original),
    buildVersion: '1.0.6.13',
    assemblerSha256: 'c'.repeat(64),
    retainedGameSnapshot: original.id,
    retainedGameSnapshotSha256: sha256(originalRaw),
    retainedGameAssemblerSha256: original.assemblerSha256,
  };
  snapshot.id = identity(snapshot);
  return { original, originalRaw, originalPath, snapshot, units, ownedFiles };
}

test('new platform revision retains exact old game inputs without claiming current source', async (t) => {
  const f = await fixture(t);
  const proof = await verifyRetainedGameSnapshot(f.snapshot);
  assert.equal(proof.snapshot, f.original.id);
  assert.equal(proof.snapshotSha256, sha256(f.originalRaw));
  assert.equal(proof.unitCount, 4);
  await assert.rejects(validateInputs(f.units[0]));
});

test('new public platform version keeps explicit original game version, exact records and raw-source proof', async (t) => {
  const f = await fixture(t);
  const refreshed = createRetainedPlatformSnapshot(f.original, f.originalRaw, {
    application: {
      releaseVersion: '1.0.7',
      revision: 1,
      buildVersion: '1.0.7.1',
    },
    assemblerSha256: 'c'.repeat(64),
    platform: [{ id: 'platform-box', fingerprint: 'e'.repeat(64) }],
  });
  assert.equal(refreshed.version, '1.0.7');
  assert.equal(refreshed.buildVersion, '1.0.7.1');
  assert.equal(refreshed.retainedGameVersion, '1.0.6');
  assert.deepEqual(
    refreshed.units.filter((unit) => unit.id.startsWith('game-')),
    f.original.units,
  );
  assert.deepEqual(refreshed.modules, f.original.modules);
  assert.equal(refreshed.retainedGameSnapshotSha256, sha256(f.originalRaw));
  const proof = await verifyRetainedGameSnapshot(refreshed);
  assert.equal(proof.version, '1.0.6');
  for (const change of [
    (value) => {
      delete value.retainedGameVersion;
    },
    (value) => {
      value.retainedGameVersion = '1.0.7';
    },
    (value) => {
      value.buildVersion = '1.0.6.1';
      value.id = identity(value);
    },
  ]) {
    const changed = structuredClone(refreshed);
    change(changed);
    assert.throws(() => verifyRetainedGameRecords(changed, f.original));
  }
});

test('equal game caches cannot return an old-tag directory or a missing target catalog', async (t) => {
  const f = await fixture(t);
  const directory = await mkdtemp(resolve('tmp/retained-catalog-'));
  const catalog = join(directory, 'TableMax-game-catalog-v1.0.6.json');
  let catalogCreated = false;
  t.after(async () => {
    if (catalogCreated) await unlink(catalog);
    await rmdir(directory);
  });
  const prior = { releaseTag: 'v1.0.6', units: f.units };
  assert.equal(
    await canReuseInternalGames(f.snapshot, directory, prior),
    false,
  );
  await writeFile(catalog, '{}\n', { flag: 'wx' });
  catalogCreated = true;
  assert.equal(await canReuseInternalGames(f.snapshot, directory, prior), true);
  assert.equal(
    await canReuseInternalGames(
      { ...f.snapshot, version: '1.0.7' },
      directory,
      prior,
    ),
    false,
  );
});

test('retained signed game release keeps its complete identity and old tag across a platform release', () => {
  const body = {
    gameId: 'probe',
    module: { id: 'probe' },
    code: 'a'.repeat(64),
    resources: ['b'.repeat(64)],
    resourceMap: {
      'probe/icon.webp': { blobId: 'b'.repeat(64), path: 'icon.webp' },
    },
    releaseTag: 'v1.0.6',
  };
  const original = { releaseId: sha256(canonical(body)), ...body };
  const next = { ...body, releaseTag: 'v1.0.7' };
  const obsoleteBody = {
    ...body,
    code: 'c'.repeat(64),
    module: { id: 'probe', previousMetadata: true },
    offlineAsset: 'TableMax-probe-v1.0.6-offline.zip',
  };
  const obsolete = {
    releaseId: sha256(canonical(obsoleteBody)),
    ...obsoleteBody,
  };
  assert.equal(selectRetainedGameRelease(next, [original]), original);
  assert.equal(selectRetainedGameRelease(next, [obsolete, original]), original);
  assert.throws(() => selectRetainedGameRelease(next, [obsolete]));
  const extraBody = { ...body, offlineAsset: 'unexpected-offline.zip' };
  assert.throws(() =>
    selectRetainedGameRelease(next, [
      {
        releaseId: sha256(canonical(extraBody)),
        ...extraBody,
      },
    ]),
  );
  assert.equal(
    JSON.stringify(selectRetainedGameRelease(next, [original])),
    JSON.stringify(original),
  );
  assert.throws(() => selectRetainedGameRelease(next, []));
  for (const change of [
    { code: 'c'.repeat(64) },
    { resources: ['c'.repeat(64)] },
    { module: { id: 'probe', changed: true } },
    { resourceMap: {} },
  ])
    assert.throws(() =>
      selectRetainedGameRelease({ ...next, ...change }, [original]),
    );
  assert.throws(() =>
    selectRetainedGameRelease(next, [
      { ...original, releaseId: 'c'.repeat(64) },
    ]),
  );
});

test('retained game validation rejects changed cached bytes and unexpected members', async (t) => {
  const f = await fixture(t);
  const member = join(f.units[0].directory, 'files/rules.txt');
  const original = await readFile(member);
  await writeFile(member, 'changed');
  await assert.rejects(verifyRetainedGameSnapshot(f.snapshot));
  await writeFile(member, original);
  const extra = join(f.units[0].directory, 'files/unknown.txt');
  f.ownedFiles.add(extra);
  await writeFile(extra, 'unknown');
  await assert.rejects(verifyRetainedGameSnapshot(f.snapshot));
});

test('raw original snapshot hash is required beyond its canonical identity', async (t) => {
  const f = await fixture(t);
  await writeFile(
    f.originalPath,
    Buffer.concat([f.originalRaw, Buffer.from(' ')]),
  );
  await assert.rejects(verifyRetainedGameSnapshot(f.snapshot));
});

test('changed snapshot identities, input fingerprints, records and paths reject retention', async (t) => {
  const f = await fixture(t);
  for (const mutate of [
    (s) => {
      s.retainedGameSnapshot = 'd'.repeat(64);
    },
    (s) => {
      s.id = 'd'.repeat(64);
    },
    (s) => {
      s.modules[0].id += '-changed';
    },
    (s) => {
      s.units.pop();
      s.id = identity(s);
    },
    (s) => {
      s.units[0].files[0].sha256 = 'd'.repeat(64);
    },
  ]) {
    const changed = structuredClone(f.snapshot);
    mutate(changed);
    assert.throws(() => verifyRetainedGameRecords(changed, f.original));
  }
  for (const mutate of [
    (o) => {
      o.units[0].inputs.files[0].sha256 = 'd'.repeat(64);
    },
    (o) => {
      o.units[0].directory = resolve('tmp/untrusted-cache');
    },
  ]) {
    const original = structuredClone(f.original);
    mutate(original);
    const snapshot = {
      ...structuredClone(f.snapshot),
      units: structuredClone(original.units),
    };
    assert.throws(() => verifyRetainedGameRecords(snapshot, original));
  }
});
