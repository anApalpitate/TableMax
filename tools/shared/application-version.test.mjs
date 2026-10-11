import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  applicationVersion,
  allocateBuildVersion,
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
