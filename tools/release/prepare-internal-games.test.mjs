import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  verifyRetainedGameRecords,
  verifyRetainedGameSnapshot,
} from './game-packages.mjs';
import { sha256 } from './game-package-format.mjs';
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
