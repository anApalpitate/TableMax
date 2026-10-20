import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  applicationVersion,
  allocateBuildVersion,
  confirmBuildVersion,
  versionIdentity,
} from './application-version.mjs';
test('public identity, bounded Windows build number, concurrent allocation and release reset', async () => {
  const root = await mkdtemp(resolve('tmp/version-fixture-'));
  try {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ version: '1.0.6' }),
    );
    await writeFile(
      join(root, 'build-version.json'),
      JSON.stringify({ releaseVersion: '1.0.6', revision: 0 }),
    );
    assert.deepEqual(
      (
        await Promise.all([
          allocateBuildVersion(root),
          allocateBuildVersion(root),
        ])
      )
        .map((v) => v.revision)
        .sort(),
      [1, 2],
    );
    assert.equal((await applicationVersion(root)).buildVersion, '1.0.6.2');
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ version: '1.0.7' }),
    );
    assert.equal((await allocateBuildVersion(root)).buildVersion, '1.0.7.1');
    for (const [version, revision] of [
      ['1.0.6.1', 0],
      ['2.0.0', 0],
      ['1.0.6', 65535],
      ['1.0.6', -1],
    ])
      assert.throws(() => versionIdentity(version, revision));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function reservationRoot(t) {
  const root = await mkdtemp(resolve('tmp/version-reservation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ version: '1.0.8' }),
  );
  await writeFile(
    join(root, 'build-version.json'),
    JSON.stringify({ releaseVersion: '1.0.8', revision: 6 }),
  );
  return root;
}
const sessionId = 'delivery-test-session';
test('the delivery session environment applies to the legacy root-only call', async (t) => {
  const root = await reservationRoot(t);
  const moduleUrl = new URL('./application-version.mjs', import.meta.url).href;
  const code = `import { allocateBuildVersion } from ${JSON.stringify(moduleUrl)};
    const first = await allocateBuildVersion(${JSON.stringify(root)});
    const retry = await allocateBuildVersion(${JSON.stringify(root)});
    console.log(JSON.stringify([first.buildVersion, retry.buildVersion]));`;
  const result = await promisify(execFile)(
    process.execPath,
    ['--input-type=module', '-e', code],
    {
      env: { ...process.env, TABLEMAX_DELIVERY_SESSION: sessionId },
      windowsHide: true,
    },
  );
  assert.deepEqual(JSON.parse(result.stdout), ['1.0.8.7', '1.0.8.7']);
});
test('a session retries and concurrent reservations share one pending revision', async (t) => {
  const root = await reservationRoot(t);
  const versions = await Promise.all(
    Array.from({ length: 5 }, () => allocateBuildVersion(root, { sessionId })),
  );
  assert.deepEqual(
    versions.map((value) => value.buildVersion),
    Array(5).fill('1.0.8.7'),
  );
  const bytes = await readFile(join(root, 'build-version.json'));
  assert.equal(
    (await allocateBuildVersion(root, { sessionId })).buildVersion,
    '1.0.8.7',
  );
  assert.deepEqual(await readFile(join(root, 'build-version.json')), bytes);
  const pending = JSON.parse(
    await readFile(join(root, 'build-version.reservation.json'), 'utf8'),
  );
  assert.equal(pending.baseRevision, 6);
  assert.equal(pending.revision, 7);
});
test('pending revisions reject another session, missing session and wrong confirmations without mutation', async (t) => {
  const root = await reservationRoot(t);
  await allocateBuildVersion(root, { sessionId });
  const path = join(root, 'build-version.reservation.json');
  const bytes = await readFile(path);
  await assert.rejects(
    allocateBuildVersion(root, { sessionId: 'another-session' }),
    /conflicts/,
  );
  await assert.rejects(allocateBuildVersion(root), /pending/);
  await assert.rejects(
    confirmBuildVersion(
      { sessionId: 'another-session', buildVersion: '1.0.8.7' },
      root,
    ),
    /conflicts/,
  );
  await assert.rejects(
    confirmBuildVersion({ sessionId, buildVersion: '1.0.8.8' }, root),
    /does not match/,
  );
  assert.deepEqual(await readFile(path), bytes);
  const state = await readFile(join(root, 'build-version.json'));
  await confirmBuildVersion({ sessionId, buildVersion: '1.0.8.7' }, root);
  assert.deepEqual(await readFile(join(root, 'build-version.json')), state);
  await assert.rejects(readFile(path), { code: 'ENOENT' });
  assert.equal((await allocateBuildVersion(root)).buildVersion, '1.0.8.8');
});
test('modified state bytes, public version and malformed reservations fail closed', async (t) => {
  const root = await reservationRoot(t);
  await allocateBuildVersion(root, { sessionId });
  const path = join(root, 'build-version.json');
  const bytes = await readFile(path);
  await writeFile(path, Buffer.concat([bytes, Buffer.from(' ')]));
  await assert.rejects(
    allocateBuildVersion(root, { sessionId }),
    /inputs changed/,
  );
  await assert.rejects(
    confirmBuildVersion({ sessionId, buildVersion: '1.0.8.7' }, root),
    /inputs changed/,
  );
  await writeFile(path, bytes);
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ version: '1.0.9' }),
  );
  await assert.rejects(
    allocateBuildVersion(root, { sessionId }),
    /inputs changed/,
  );
  await writeFile(join(root, 'build-version.reservation.json'), 'null');
  await assert.rejects(
    allocateBuildVersion(root, { sessionId }),
    /Invalid delivery reservation/,
  );
});
test('invalid session ids do not allocate or confirm a revision', async (t) => {
  const root = await reservationRoot(t);
  for (const invalid of ['', ' ', '\n', 7])
    await assert.rejects(
      allocateBuildVersion(root, { sessionId: invalid }),
      /Invalid delivery session/,
    );
  assert.equal((await applicationVersion(root)).buildVersion, '1.0.8.6');
  await assert.rejects(
    confirmBuildVersion({ sessionId, buildVersion: '1.0.8.7' }, root),
    /No delivery reservation/,
  );
});
