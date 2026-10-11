import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import {
  canonical,
  createBlob,
  createSignedCatalog,
  sha256,
  zipFiles,
} from '../../release/game-package-format.mjs';
import {
  TestHistory,
  compareRates,
  failureLimit,
  testIdentity,
} from '../runner/history.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
const args = process.argv.slice(2);
assert.ok(
  args.every((arg) => arg.startsWith('--only=')),
  'Only --only=<exact-case-id,...> is supported',
);
assert.ok(args.length <= 1);
const only = args[0]?.slice(7).split(',');
const startedAt = new Date().toISOString();
const started = performance.now();
const script = 'tools/test/platform/verify-package-fault-matrix.mjs';
const childScript = 'tools/test/platform/package-fault-child.mjs';
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/package-fault-matrix-'));
const evidence = resolve(
  'artifacts/maintenance/v1.0.6/package-fault-matrix',
  work.split(/[\\/]/).at(-1),
);
await mkdir(evidence, { recursive: true });
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const module = JSON.parse(await readFile('games/uno/game-module.json', 'utf8'));
module.entries = { rules: 'rules.cjs', bot: 'bot.cjs', web: 'web/index.js' };
module.styles = ['web/style.css'];
delete module.details;
const archives = new Map();
const codeRecords = (revision) => [
  { path: 'rules.cjs', data: Buffer.from(`module.exports = '${revision}';`) },
  {
    path: 'bot.cjs',
    data: Buffer.from(`module.exports = {fixture:'${revision}'};`),
  },
  {
    path: 'web/index.js',
    data: Buffer.from(`export const fixture = '${revision}';`),
  },
  {
    path: 'web/style.css',
    data: Buffer.from(`.fixture { --revision: ${revision}; }`),
  },
];
async function blob(kind, records) {
  const result = await createBlob(kind, records, work, 'v1.0.6');
  archives.set(result.id, await readFile(join(work, result.assetName)));
  return result;
}
const shared = await blob('resources', [
  { path: 'shared/image.svg', data: Buffer.from('<svg/>') },
]);
const oldCode = await blob('code', codeRecords('old'));
const newCode = await blob('code', codeRecords('new'));
const newResources = await blob('resources', [
  { path: 'images/picture.svg', data: Buffer.from('<svg>new-resource</svg>') },
  { path: 'audio/sound.bin', data: Buffer.from('fixture-local-audio-bytes') },
]);
const releases = [oldCode, newCode].map((code, index) => {
  const release = {
    gameId: 'uno',
    module,
    code: code.id,
    resources: index ? [shared.id, newResources.id] : [shared.id],
    resourceMap: {
      'shared/image.svg': { blobId: shared.id, path: 'shared/image.svg' },
    },
    releaseTag: 'v1.0.6',
  };
  return { releaseId: sha256(canonical(release)), ...release };
});
const catalog = {
  schemaVersion: 1,
  releases,
  blobs: [shared, oldCode, newCode, newResources],
};
const altered = new Map();
altered.set(
  'signed-invalid-zip',
  Buffer.from('invalid ZIP, but correctly signed archive digest'),
);
altered.set('signed-file-mismatch', zipFiles(codeRecords('altered')));
altered.set(
  'signed-extra-file',
  zipFiles([
    ...codeRecords('new'),
    { path: 'web/extra.js', data: Buffer.from('extra') },
  ]),
);
const unsafe = zipFiles([{ path: 'web/aaaaa', data: Buffer.from('unsafe') }]);
for (
  let offset = unsafe.indexOf(Buffer.from('web/aaaaa'));
  offset >= 0;
  offset = unsafe.indexOf(Buffer.from('web/aaaaa'))
)
  Buffer.from('../escape').copy(unsafe, offset);
altered.set('signed-unsafe-path', unsafe);
const envelopes = {};
for (const [name, bytes] of altered) {
  const changed = structuredClone(catalog);
  const descriptor = changed.blobs.find((item) => item.id === newCode.id);
  descriptor.archiveBytes = bytes.length;
  descriptor.archiveSha256 = sha256(bytes);
  envelopes[name] = createSignedCatalog(changed, pem);
}
const requests = [];
const sockets = new Set();
const newIds = new Set([newCode.id, newResources.id]);
const server = createServer((request, response) => {
  const [scenario, id] = request.url.slice(1).split('/');
  let bytes = archives.get(id);
  if (!bytes) {
    response.writeHead(404).end();
    return;
  }
  const actual = newIds.has(id) ? scenario : 'normal';
  if (actual.startsWith('signed-') && id === newCode.id)
    bytes = altered.get(actual);
  if (actual === 'tamper')
    bytes = Buffer.concat([Buffer.from([bytes[0] ^ 1]), bytes.subarray(1)]);
  if (actual === 'overlong')
    bytes = Buffer.concat([bytes, Buffer.from('extra')]);
  if (actual === 'short') bytes = bytes.subarray(0, bytes.length - 9);
  const record = {
    scenario: actual,
    blobId: id,
    bytes: 0,
    status: actual === 'http-error' ? 503 : 200,
    startedAt: new Date().toISOString(),
    completed: false,
  };
  requests.push(record);
  const start = performance.now();
  response.on('close', () => {
    record.durationMs = performance.now() - start;
    record.finishedAt = new Date().toISOString();
  });
  response.writeHead(record.status, {
    'Content-Type': 'application/octet-stream',
  });
  if (record.status !== 200) {
    response.end('fixture HTTP failure');
    return;
  }
  let offset = 0;
  const send = () => {
    if (response.destroyed) return;
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + 64));
    offset += chunk.length;
    record.bytes += chunk.length;
    response.write(chunk);
    if (actual === 'disconnect') {
      setTimeout(() => response.destroy(), 15);
      return;
    }
    if (actual === 'stall') return;
    if (offset === bytes.length) {
      record.completed = true;
      response.end();
    } else timer = setTimeout(send, 3);
  };
  let timer;
  response.on('close', () => clearTimeout(timer));
  send();
});
server.on('connection', (socket) => {
  sockets.add(socket);
  socket.once('close', () => sockets.delete(socket));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const fixture = {
  publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
  envelope: createSignedCatalog(catalog, pem),
  envelopes,
  url: `http://127.0.0.1:${server.address().port}`,
  oldRef: releases[0].releaseId,
  newRef: releases[1].releaseId,
  oldBlobs: [oldCode, shared],
  saveBytes: '{"fixture":"saved-old-release","identity":"unchanged"}',
};
fixture.saveSha256 = sha256(fixture.saveBytes);
const fixturePath = join(work, 'fixture.json');
await writeFile(fixturePath, JSON.stringify(fixture));
const live = new Set();
const inputPaths = [
  script,
  childScript,
  'apps/server/src/game-packages/store.ts',
  'apps/server/src/game-packages/verification.ts',
  'apps/server/src/game-packages/types.ts',
  'games/uno/game-module.json',
  'tools/release/game-package-format.mjs',
  'pnpm-lock.yaml',
];
const inputs = await Promise.all(
  inputPaths.map(async (path) => ({
    path,
    sha256: sha256(await readFile(path)),
  })),
);
function launch(root, mode, spec = {}) {
  const child = fork(
    resolve(childScript),
    [fixturePath, root, mode, JSON.stringify(spec)],
    {
      execArgv: ['--import', 'tsx'],
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        TABLEMAX_AUTO_MAINTENANCE: '0',
        TABLEMAX_TEST_SOUND: 'off',
      },
    },
  );
  live.add(child);
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk).slice(-12000);
  });
  child.stdout.resume();
  const exited = new Promise((done) =>
    child.once('close', (code, signal) => {
      live.delete(child);
      done({ code, signal });
    }),
  );
  const message = new Promise((done, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Child timeout: ${stderr}`));
    }, 20000);
    child.once('message', (value) => {
      clearTimeout(timer);
      if (value.type === 'error') reject(new Error(value.error));
      else done(value);
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Child exited without result (${code}): ${stderr}`));
    });
  });
  return { child, exited, message };
}
async function finishChild(item) {
  try {
    const result = await item.message;
    const exit = await item.exited;
    assert.equal(exit.code, 0);
    return result;
  } catch (error) {
    if (live.has(item.child)) item.child.kill('SIGKILL');
    await item.exited;
    throw error;
  }
}
const history = new TestHistory(process.cwd());
const limit = failureLimit();
const runId = history.start(limit);
const checks = [];
let selection = [];
let failures = 0;
let trace;
try {
  trace = await finishChild(launch(join(work, 'trace'), 'trace'));
  assert.equal(trace.type, 'completed');
  assert.ok(trace.events.some((event) => event.operation === 'fsyncSync'));
  assert.ok(trace.events.some((event) => event.target === 'index.json'));
  const occurrences = new Map();
  const cases = trace.events.flatMap((event) => {
    const location = sha256(
      canonical({
        operation: event.operation,
        path: event.path,
        target: event.target,
      }),
    ).slice(0, 12);
    const occurrence = occurrences.get(location) ?? 0;
    occurrences.set(location, occurrence + 1);
    const windows =
      event.operation === 'writeFileSync'
        ? ['before', 'partial', 'after']
        : ['before', 'after'];
    return windows.flatMap((when) =>
      ['throw', 'kill'].map((action) => ({
        id: `io-${location}-${occurrence}-${when}-${action}`,
        ordinal: event.ordinal,
        event,
        when,
        action,
      })),
    );
  });
  for (const [network, action, expectedError] of [
    ['disconnect', 'network', 'terminated|fetch failed|aborted'],
    ['short', 'network', 'archive-hash-mismatch'],
    ['overlong', 'network', 'download-size-mismatch'],
    ['tamper', 'network', 'archive-hash-mismatch'],
    ['http-error', 'network', 'download-failed'],
    ['stall', 'cancel'],
    ['stall', 'kill-download'],
    ['signed-invalid-zip', 'network', 'invalid-zip'],
    ['signed-file-mismatch', 'network', 'package-file-hash-mismatch'],
    ['signed-extra-file', 'network', 'extra-package-file'],
    ['signed-unsafe-path', 'network', 'unsafe-zip-member'],
    ['signature', 'network'],
  ])
    cases.push({
      id: `network-${network}-${action}`,
      network,
      action,
      ...(expectedError ? { expectedError } : {}),
    });
  if (only)
    assert.ok(
      only.every((id) => cases.some((item) => item.id === id)),
      'Unknown exact case ID',
    );
  selection = cases
    .filter((item) => !only || only.includes(item.id))
    .map((item) => ({
      ...item,
      identity: testIdentity('verification', script, [item.id]),
    }))
    .sort((a, b) =>
      compareRates(history.get(a.identity.id), history.get(b.identity.id)),
    );
  await writeFile(
    join(evidence, 'plan.json'),
    JSON.stringify(
      {
        scope: 'shared,tooling',
        cases: selection,
        trace: trace.events,
        inputs,
        exclusions: [
          'actual disk exhaustion',
          'physical devices',
          'power loss',
        ],
      },
      null,
      2,
    ),
  );
  for (const spec of selection) {
    const start = performance.now();
    const beforeRequests = requests.length;
    const root = join(work, spec.id);
    let result;
    try {
      const running = launch(root, 'fault', spec);
      let committed;
      let termination;
      if (spec.action === 'kill' || spec.action === 'kill-download') {
        try {
          const reached = await running.message;
          assert.equal(reached.type, 'fault-reached');
          assert.equal(reached.pid, running.child.pid);
          committed = reached.event.indexCommitted;
          assert.equal(running.child.kill('SIGKILL'), true);
          termination = await running.exited;
          assert.ok(termination.signal || termination.code !== 0);
        } finally {
          if (live.has(running.child)) running.child.kill('SIGKILL');
          await running.exited;
        }
      } else {
        result = await finishChild(running);
        committed = result.indexCommitted;
      }
      const recovered = await finishChild(
        launch(root, 'recover', { committed }),
      );
      assert.equal(recovered.type, 'recovered');
      checks.push({
        id: spec.id,
        status: 'passed',
        durationMs: performance.now() - start,
        committed,
        termination,
        recovered,
        injection: result,
        requests: requests.slice(beforeRequests),
      });
    } catch (error) {
      failures++;
      checks.push({
        id: spec.id,
        status: 'failed',
        durationMs: performance.now() - start,
        error: error.stack ?? String(error),
        requests: requests.slice(beforeRequests),
      });
    }
    const check = checks.at(-1);
    history.record(
      runId,
      `${runId}:${spec.id}`,
      spec.identity,
      check.status,
      check.durationMs,
      { evidence: join(evidence, 'results.json'), ...check },
    );
    await writeFile(
      join(evidence, `${spec.id}.json`),
      JSON.stringify(check, null, 2),
    );
    if (check.status === 'failed') console.error(`${spec.id}: ${check.error}`);
    else if (checks.length % 25 === 0)
      console.log(
        `${checks.length}/${selection.length} passed; ${(performance.now() - started).toFixed(0)} ms`,
      );
    if (failures >= limit) break;
  }
  for (const input of inputs)
    assert.equal(
      sha256(await readFile(input.path)),
      input.sha256,
      `Verification input changed: ${input.path}`,
    );
} catch (error) {
  failures++;
  checks.push({
    id: 'matrix-infrastructure',
    status: 'failed',
    error: error.stack ?? String(error),
  });
  console.error(error.stack ?? String(error));
} finally {
  for (const child of live) child.kill('SIGKILL');
  await Promise.all(
    [...live].map((child) => new Promise((done) => child.once('close', done))),
  );
  for (const socket of sockets) socket.destroy();
  await new Promise((done) => server.close(done));
  history.finish(
    runId,
    failures >= limit ? 'stopped' : failures ? 'failed' : 'passed',
    failures,
  );
  const report = {
    result: failures ? 'failed' : 'passed',
    scope: 'shared,tooling',
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: performance.now() - started,
    inputs,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    fixture: {
      oldRef: fixture.oldRef,
      newRef: fixture.newRef,
      archiveHashes: catalog.blobs.map((blob) => ({
        id: blob.id,
        sha256: blob.archiveSha256,
      })),
    },
    trace: trace?.events,
    checks,
    failures,
    failureLimit: limit,
    unexecuted: selection
      .slice(
        checks.filter((check) => check.id !== 'matrix-infrastructure').length,
      )
      .map((item) => item.id),
    allChildrenExited: live.size === 0,
    work,
    evidence,
    requests: requests.length,
    responseBytes: requests.reduce((sum, request) => sum + request.bytes, 0),
    boundary:
      'Production PackageStore source; signed small code/resources fixtures; actual loopback HTTP and child termination; injected filesystem I/O failures before/after every observed installation operation and partial writes. Fresh-process recovery and protected old bytes are checked per case. No shipping EXE claim.',
    exclusions: [
      'actual disk exhaustion (user waived)',
      'author visible launch (user waived)',
      'power loss and real filesystem/fsync durability',
      'physical phone/LAN/Safari (user will verify)',
      'legacy migration, uninstall, preinstalled bootstrap and catalog-update write faults',
    ],
    history: history.report(runId),
  };
  await writeFile(
    join(evidence, 'results.json'),
    JSON.stringify(report, null, 2),
  );
  history.close();
  console.log(
    JSON.stringify({
      result: report.result,
      completed: checks.length,
      selected: selection.length,
      failures,
      durationMs: report.durationMs,
      evidence,
      allChildrenExited: report.allChildrenExited,
    }),
  );
  if (failures) process.exitCode = 1;
}
