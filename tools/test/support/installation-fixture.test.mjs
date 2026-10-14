import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  createInstallationFixture,
  snapshotFixture,
  protectedFixtureHashes,
} from './installation-fixture.mjs';

test('binds the before state, including same-length changes, empty directories and extra user files', () => {
  const fixture = createInstallationFixture();
  const original = fixture.snapshot();
  const protectedBefore = protectedFixtureHashes(fixture);
  writeFileSync(fixture.path('候选文件.txt'), 'old');
  const first = fixture.snapshot();
  writeFileSync(fixture.path('候选文件.txt'), 'new');
  const second = fixture.snapshot();
  assert.notEqual(original.sha256, first.sha256);
  assert.notEqual(first.sha256, second.sha256);
  mkdirSync(fixture.path('空目录'));
  assert.notEqual(second.sha256, fixture.snapshot().sha256);
  assert.deepEqual(protectedFixtureHashes(fixture), protectedBefore);
});

test('rejects escaped paths, mismatched fixture identity and linked directories', () => {
  const fixture = createInstallationFixture();
  assert.throws(() => fixture.path('../outside'), /escapes/);
  assert.throws(
    () => snapshotFixture(fixture.work, 'another-instance'),
    /identity/,
  );
  const link = join(fixture.install, 'linked-data');
  symlinkSync(
    fixture.externalData,
    link,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  try {
    assert.throws(() => fixture.snapshot(), /link/);
  } finally {
    unlinkSync(link);
  }
});
