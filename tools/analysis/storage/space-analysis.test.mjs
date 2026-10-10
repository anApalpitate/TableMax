import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  symlink,
  readFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventory, analyze, duplicates, main } from './space-analysis.mjs';

test('inventory excludes links and nested repositories; reports generated images separately from assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tablemax-space-test-'));
  const outside = await mkdtemp(join(tmpdir(), 'tablemax-space-outside-'));
  try {
    for (const path of [
      'artifacts/maintenance/v1/demo',
      'artifacts/uno/validation/run',
      'assets',
      'nested/.git',
      'runtime/a',
      'runtime/b',
    ])
      await mkdir(join(root, path), { recursive: true });
    await writeFile(join(root, 'artifacts/maintenance/v1/demo/a.png'), 'same');
    await writeFile(join(root, 'artifacts/maintenance/v1/demo/b.png'), 'same');
    await writeFile(
      join(root, 'artifacts/uno/validation/run/game.png'),
      'game',
    );
    await writeFile(join(root, 'assets/original.png'), 'original');
    await writeFile(join(root, 'nested/ignored.bin'), 'ignored');
    await writeFile(join(root, 'runtime/a/node.exe'), 'node');
    await writeFile(join(root, 'runtime/b/node.exe'), 'node');
    await writeFile(join(outside, 'external.bin'), 'external');
    await symlink(
      outside,
      join(root, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const snapshot = await inventory(root);
    assert.equal(snapshot.logicalBytes, 28);
    assert.deepEqual(snapshot.skippedLinks, ['linked']);
    assert.deepEqual(snapshot.skippedRepositories, ['nested']);
    const report = analyze(snapshot);
    assert.equal(report.screenshots.files, 3);
    assert.equal(report.screenshots.bytes, 12);
    assert.equal(report.screenshots.groups[0].bytes, 8);
    assert.equal(report.runtimes.length, 2);
    const hashes = await duplicates(snapshot);
    assert.equal(hashes.groups.length, 2);
    assert.equal(hashes.errors.length, 0);
    await writeFile(
      join(root, 'artifacts/maintenance/v1/demo/b.png'),
      'changed',
    );
    const stale = await duplicates(snapshot);
    assert.equal(stale.errors.length, 1);
    assert.equal(
      stale.groups.filter((group) => group.kind === 'generated-image').length,
      0,
    );
    snapshot.files.push({ path: 'tmp/../outside.png', bytes: 4, mtimeMs: 0 });
    const unsafe = await duplicates(snapshot);
    assert.equal(unsafe.errors.length, 2);
    assert.ok(
      unsafe.errors.some((item) => item.message === 'Unsafe inventory path'),
    );
    assert.equal(
      await readFile(join(outside, 'external.bin'), 'utf8'),
      'external',
    );
    await assert.rejects(
      main([
        'scan',
        `--root=${root}`,
        `--output=${join(root, 'assets/original.png')}`,
      ]),
      /already exists/,
    );
    await assert.rejects(main(['scan', '--unknown=yes']), /Unknown option/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('empty inventory and partial measurements are explicit', () => {
  const snapshot = {
    schemaVersion: 1,
    files: [],
    errors: [{ message: 'denied' }],
    skippedLinks: [],
    skippedRepositories: [],
  };
  assert.equal(analyze(snapshot).complete, false);
  assert.equal(analyze(snapshot).screenshots.share, 0);
  assert.throws(() => analyze({ schemaVersion: 99 }), /Unsupported/);
});
