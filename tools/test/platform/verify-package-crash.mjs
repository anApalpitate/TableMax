import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  canonical,
  createBlob,
  createSignedCatalog,
  sha256,
} from '../../release/game-package-format.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/package-crash-'));
const evidence = resolve('artifacts/results/package-crash', String(Date.now()));
await mkdir(evidence, { recursive: true });
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const module = JSON.parse(await readFile('games/uno/game-module.json', 'utf8'));
module.entries = { rules: 'rules.cjs', bot: 'bot.cjs', web: 'web/index.js' };
const blobs = [],
  releases = [],
  archives = {};
for (const revision of ['old', 'new']) {
  const blob = await createBlob(
    'code',
    [
      {
        path: 'rules.cjs',
        data: Buffer.from(`module.exports = '${revision}';`),
      },
      { path: 'bot.cjs', data: Buffer.from('module.exports = {};') },
      { path: 'web/index.js', data: Buffer.from('export {};') },
    ],
    work,
    'v1.0.6',
  );
  blobs.push(blob);
  archives[blob.id] = join(work, blob.assetName);
  const release = {
    gameId: 'uno',
    module,
    code: blob.id,
    resources: [],
    resourceMap: {},
    releaseTag: 'v1.0.6',
  };
  releases.push({ releaseId: sha256(canonical(release)), ...release });
}
const fixture = {
  publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
  envelope: createSignedCatalog(
    { schemaVersion: 1, releases, blobs },
    privateKey.export({ type: 'pkcs8', format: 'pem' }),
  ),
  oldRef: releases[0].releaseId,
  newRef: releases[1].releaseId,
  archives,
};
const fixtureFile = join(work, 'fixture.json');
await writeFile(fixtureFile, JSON.stringify(fixture));
const live = new Set();
function launch(root, mode, phase) {
  const child = fork(
    resolve('tools/test/platform/package-crash-child.mjs'),
    [fixtureFile, root, mode, phase],
    {
      execArgv: ['--import', 'tsx'],
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    },
  );
  live.add(child);
  let stderr = '';
  child.stderr.on('data', (bytes) => {
    stderr += bytes;
  });
  const exited = new Promise((resolveExit) =>
    child.once('exit', (code, signal) => {
      live.delete(child);
      resolveExit({ code, signal });
    }),
  );
  const message = new Promise((resolveMessage, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('child-timeout'));
    }, 30_000);
    child.once('message', (value) => {
      clearTimeout(timer);
      resolveMessage(value);
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`child-exited-before-message: ${code}: ${stderr}`));
    });
  });
  return { child, message, exited };
}
const checks = [];
let failures = 0;
try {
  for (const phase of ['before-journal', 'before-index', 'after-index']) {
    try {
      const root = join(work, phase);
      const crashing = launch(root, 'crash', phase);
      const reached = await crashing.message;
      assert.equal(reached.type, 'fault-reached');
      assert.equal(reached.phase, phase);
      assert.equal(reached.pid, crashing.child.pid);
      assert.equal(crashing.child.kill('SIGKILL'), true);
      const terminated = await crashing.exited;
      assert.ok(terminated.signal || terminated.code !== 0);
      const reopening = launch(root, 'recover', phase);
      const recovered = await reopening.message;
      const exit = await reopening.exited;
      assert.equal(exit.code, 0);
      assert.equal(recovered.type, 'recovered');
      assert.equal(
        recovered.selectedBefore,
        phase === 'after-index' ? fixture.newRef : fixture.oldRef,
      );
      assert.equal(recovered.oldResolved, true);
      assert.deepEqual(recovered.journalsAfterRecovery, []);
      assert.equal(recovered.selectedAfter, fixture.newRef);
      assert.equal(recovered.newResolved, true);
      const oldBytes = await readFile(
        join(root, 'uno', 'blobs', blobs[0].id, 'rules.cjs'),
      );
      assert.equal(
        sha256(oldBytes),
        blobs[0].files.find((file) => file.path === 'rules.cjs').sha256,
      );
      checks.push({
        phase,
        passed: true,
        killedPid: reached.pid,
        terminated,
        recovered,
      });
    } catch (error) {
      checks.push({
        phase,
        passed: false,
        error: String(error.stack ?? error),
      });
      if (++failures >= 3) break;
    }
  }
} finally {
  await Promise.all(
    [...live].map(
      (child) =>
        new Promise((done) => {
          child.once('exit', done);
          child.kill('SIGKILL');
        }),
    ),
  );
}
const report = {
  passed: failures === 0,
  work,
  checks,
  allChildrenExited: live.size === 0,
  boundary:
    'Actual child-process termination and fresh-process recovery at before-journal, before-index and after-index. Signed small fixtures exercise production PackageStore without changing shipping code.',
  exclusions: [
    'power loss',
    'filesystem/fsync durability',
    'every extraction/file-write point',
    'disk exhaustion',
    'physical devices',
  ],
};
await writeFile(
  join(evidence, 'results.json'),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    passed: report.passed,
    checks: checks.length,
    failures,
    evidence,
    work,
    allChildrenExited: report.allChildrenExited,
  }),
);
if (!report.passed) process.exitCode = 1;
