import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { verifyResourceCleanup } from './installation-evidence.mjs';
import { hash } from './installation-toolchain.mjs';

test('uninstall evidence binds deletion, retained bytes and raw receipt before reinstall', async (t) => {
  const root = await mkdtemp(resolve('tmp/resource-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'data/games'), { recursive: true });
  const identity = {
    productId: 'fixture',
    installationId: 'case-1',
    ownerSid: 'S-fixture',
    buildVersion: '1.0.7.1',
  };
  const bytes = Buffer.from('original saved-game resource');
  const retained = {
    path: 'games/kept.txt',
    bytes: bytes.length,
    sha256: hash(bytes),
    reason: '旧局依赖，保留。',
  };
  const deleted = {
    path: 'games/removed.txt',
    bytes: bytes.length,
    sha256: hash(bytes),
    reason: '未引用资源，删除。',
  };
  await writeFile(join(root, 'data/games/kept.txt'), bytes);
  const receipt = {
    schemaVersion: 1,
    ...identity,
    root,
    boxRoot: join(root, 'data'),
    result: 'completed',
    deleted: [deleted],
    retained: [retained],
    deferred: [],
  };
  const before = [retained, deleted].map((file) => ({
    ...file,
    path: file.path.slice(6),
  }));
  const source = join(root, 'data/.uninstall-resources.json');
  const options = {
    root,
    identity,
    before,
    directory: join(root, 'evidence'),
    name: 'first-uninstall-resources.json',
  };
  await writeFile(source, JSON.stringify(receipt));
  const proof = await verifyResourceCleanup(options);
  assert.equal(hash(await readFile(proof.path)), proof.sha256);
  assert.deepEqual(JSON.parse(proof.raw), proof.receipt);
  // A recreated deletion target and a changed retained member each invalidate
  // the same execution; neither can be hidden by a matching JSON receipt.
  await writeFile(join(root, 'data/games/removed.txt'), bytes);
  await assert.rejects(
    verifyResourceCleanup({
      ...options,
      name: 'final-uninstall-resources.json',
    }),
  );
  await rm(join(root, 'data/games/removed.txt'));
  await writeFile(join(root, 'data/games/kept.txt'), 'tampered');
  await assert.rejects(
    verifyResourceCleanup({
      ...options,
      name: 'final-uninstall-resources.json',
    }),
  );
  await writeFile(join(root, 'data/games/kept.txt'), bytes);
  receipt.retained = [];
  await writeFile(source, JSON.stringify(receipt));
  await assert.rejects(
    verifyResourceCleanup({
      ...options,
      name: 'final-uninstall-resources.json',
    }),
    /missing from uninstall receipt/,
  );
  receipt.retained = [{ ...retained, path: 'games/../escape' }];
  await writeFile(source, JSON.stringify(receipt));
  await assert.rejects(
    verifyResourceCleanup({
      ...options,
      name: 'final-uninstall-resources.json',
    }),
  );
});
