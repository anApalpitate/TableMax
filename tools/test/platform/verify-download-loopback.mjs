import { failureLimit } from '../runner/failure-policy.mjs';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { PackageStore } from '../../../apps/server/src/game-packages/store.ts';
import {
  canonical,
  sha256,
  crc32,
  blobIdentity,
  releaseIdentity,
} from '../../../apps/server/src/game-packages/verification.ts';
import { downloadLoopback } from '../support/download-loopback.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
// Minimal stored ZIP fixture. Fake code/resources exercise the real installer, not gameplay.
function zip(files) {
  const locals = [],
    central = [];
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
const { publicKey, privateKey } = generateKeyPairSync('ed25519'),
  archives = new Map();
function blob(kind, files) {
  const archive = zip(files);
  const value = {
    id: '',
    kind,
    files: files.map(([path, data]) => ({
      path,
      size: data.length,
      sha256: sha256(data),
    })),
    archiveBytes: archive.length,
    archiveSha256: sha256(archive),
    installedBytes: files.reduce((sum, [, data]) => sum + data.length, 0),
    assetName: kind + '.zip',
    releaseTag: 'v1.0.6',
  };
  value.id = blobIdentity(value);
  archives.set(value.id, archive);
  return value;
}
const code = blob('code', [
  ['rules.cjs', Buffer.from('fixture')],
  ['bot.cjs', Buffer.from('fixture')],
  ['web/index.js', Buffer.from('fixture')],
]);
const resource = blob('resources', [['fixture.bin', Buffer.alloc(2048, 7)]]);
const module = JSON.parse(readFileSync('games/uno/game-module.json', 'utf8'));
module.entries = { rules: 'rules.cjs', bot: 'bot.cjs', web: 'web/index.js' };
const releases = ['first', 'second'].map((variantId) => {
  const value = {
    releaseId: '',
    gameId: 'uno',
    variantId,
    module,
    code: code.id,
    resources: [resource.id],
    resourceMap: { fixture: { blobId: resource.id, path: 'fixture.bin' } },
    releaseTag: 'v1.0.6',
  };
  value.releaseId = releaseIdentity(value);
  return value;
});
const payload = { schemaVersion: 1, releases, blobs: [code, resource] },
  envelope = {
    payload,
    signature: sign(null, Buffer.from(canonical(payload)), privateKey).toString(
      'base64',
    ),
  };
mkdirSync('tmp', { recursive: true });
const work = mkdtempSync(resolve('tmp/download-loopback-'));
const output =
  process.env.TABLEMAX_TEST_OUTPUT_DIR ??
  resolve(
    'artifacts/maintenance/v1.0.6/test-flow-optimization',
    'download-' + Date.now(),
  );
mkdirSync(output, { recursive: true });
const network = await downloadLoopback(archives);
const report = {
  result: 'started',
  startedAt: new Date().toISOString(),
  work,
  kind: 'simulated-loopback-faults',
  scope:
    'Real 127.0.0.1 HTTP and production PackageStore with signed artificial blobs; no real internet failure, disk-full or power-loss claim.',
  checks: [],
  stages: [],
  failures: 0,
};
const save = () =>
  writeFileSync(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
let sequence = 0;
function store(fault) {
  const value = new PackageStore({
    root: join(work, 'store-' + sequence++),
    publicKey,
    protectedReleaseIds: () => [],
    assetUrl: (b) => network.origin + '/' + b.id,
    fetch: network.fetch,
    fault,
  });
  value.setCatalog(envelope);
  return value;
}
const limit = failureLimit();
async function check(name, operation) {
  if (report.failures >= limit) {
    report.checks.push({ name, status: 'unstarted' });
    return;
  }
  const started = performance.now();
  try {
    await operation();
    report.checks.push({
      name,
      status: 'passed',
      durationMs: performance.now() - started,
    });
  } catch (error) {
    report.failures++;
    report.checks.push({
      name,
      status: 'failed',
      error: error.message,
      durationMs: performance.now() - started,
    });
  }
  save();
}
try {
  await check(
    'duplicate targets, shared closure, progress, complete index and zero-byte installed reuse',
    async () => {
      network.setMode('normal');
      const value = store(),
        progress = [];
      value.subscribe(() =>
        progress.push(
          value.snapshot().tasks.map((task) => ({
            phase: task.phase,
            bytes: task.transferredBytes,
          })),
        ),
      );
      const startRequests = network.requests.length,
        startBytes = network.received.reduce((n, r) => n + r.receivedBytes, 0),
        started = performance.now();
      await Promise.all([
        value.install(releases[0].releaseId),
        value.install(releases[0].releaseId),
        value.install(releases[1].releaseId),
      ]);
      assert.equal(network.requests.length - startRequests, 2);
      assert.equal(Object.keys(value.snapshot().index.blobs).length, 2);
      assert.equal(Object.keys(value.snapshot().index.releases).length, 2);
      assert.ok(
        progress.some((tasks) =>
          tasks.some((task) => task.phase === 'downloading' && task.bytes > 0),
        ),
      );
      report.stages.push({
        kind: 'cold-loopback',
        installWallMs: performance.now() - started,
        requests: network.requests.length - startRequests,
        receivedBytes:
          network.received.reduce((n, r) => n + r.receivedBytes, 0) -
          startBytes,
      });
      const warm = performance.now(),
        before = network.requests.length;
      await value.install(releases[0].releaseId);
      assert.equal(network.requests.length, before);
      report.stages.push({
        kind: 'installed-cache-hit',
        installWallMs: performance.now() - warm,
        requests: 0,
        receivedBytes: 0,
      });
    },
  );
  for (const mode of ['truncate', 'error', 'tamper'])
    await check(
      mode + ' preserves transaction visibility and error summary',
      async () => {
        network.setMode(mode);
        const value = store();
        await assert.rejects(value.install(releases[0].releaseId));
        assert.equal(Object.keys(value.snapshot().index.releases).length, 0);
        const task = value.snapshot().tasks[0];
        assert.equal(task.phase, 'failed');
        assert.ok(task.error && task.error.length < 200);
        value.cancel(releases[0].releaseId);
      },
    );
  await check(
    'cancellation aborts stalled body without committing index',
    async () => {
      network.setMode('stall');
      const value = store();
      value.subscribe(() => {
        if (value.snapshot().tasks.some((task) => task.transferredBytes > 0))
          value.cancel(releases[0].releaseId);
      });
      const timeout = setTimeout(
        () => value.cancel(releases[0].releaseId),
        3000,
      );
      try {
        await assert.rejects(value.install(releases[0].releaseId));
      } finally {
        clearTimeout(timeout);
      }
      assert.equal(value.snapshot().tasks[0].phase, 'cancelled');
      assert.equal(Object.keys(value.snapshot().index.releases).length, 0);
    },
  );
  network.setMode('normal');
  for (const phase of ['before-journal', 'before-index', 'after-index'])
    await check('recovery at ' + phase, async () => {
      const value = store((at) => {
        if (at === phase)
          throw new Error('controlled-transaction-interruption');
      });
      await assert.rejects(
        value.install(releases[0].releaseId),
        /controlled-transaction/,
      );
      const recovered = new PackageStore({
        root: value.root,
        publicKey,
        protectedReleaseIds: () => [],
      });
      assert.equal(
        Boolean(recovered.selected('uno', 'first')),
        phase === 'after-index',
      );
    });
  await check('signature changes remain rejected', async () => {
    const value = store();
    assert.throws(
      () =>
        value.setCatalog({
          ...envelope,
          signature: Buffer.alloc(64).toString('base64'),
        }),
      /signature/,
    );
    assert.ok(existsSync(join(value.root, 'catalog.json')));
  });
  report.result = report.failures ? 'failed' : 'passed';
} finally {
  await network.close();
  report.requests = network.requests;
  report.received = network.received;
  report.finishedAt = new Date().toISOString();
  save();
}
console.log(
  JSON.stringify({
    result: report.result,
    checks: report.checks.length,
    failures: report.failures,
    report: join(output, 'results.json'),
    stages: report.stages,
  }),
);
if (report.failures) process.exitCode = 1;
