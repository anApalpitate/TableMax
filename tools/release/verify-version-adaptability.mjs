import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { assertWorkspaceRoot } from '../shared/workspace-root.mjs';

assertWorkspaceRoot();
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const evidence = resolve(
  'artifacts/maintenance/v1.0.6/version-adaptability-20261012',
);
await mkdir(evidence, { recursive: true });
const work = await mkdtemp(resolve('tmp/version-adaptability-'));
const pointer = JSON.parse(
  await readFile('artifacts/package-payloads/v1.0.6/current.json', 'utf8'),
);
const oldExecutable = join(evidence, 'before/TableMax-1.0.6-win-x64-box.exe');
const newExecutable = pointer.deliveries.find((d) => d.edition === 'box')
  .executable.path;
const digest = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
const currentDirectory = resolve('artifacts/game-packages/v1.0.6/current');
const historicalDirectory = resolve(
  'artifacts/game-packages/v1.0.6/avalon-configured-final-20261011',
);
const oldCatalog = JSON.parse(
  await readFile(
    join(historicalDirectory, 'TableMax-game-catalog-v1.0.6.json'),
    'utf8',
  ),
).payload;
const newCatalog = JSON.parse(
  await readFile(
    join(currentDirectory, 'TableMax-game-catalog-v1.0.6.json'),
    'utf8',
  ),
).payload;
const oldUno = oldCatalog.releases.find((r) => r.gameId === 'uno');
const oldAvalon = oldCatalog.releases.find((r) => r.gameId === 'avalon');
const newAvalon = newCatalog.releases.find(
  (r) => r.gameId === 'avalon' && r.module.compatibility.protocol === 8,
);
const checks = [];
const apps = new Map();
for (const [name, executable] of [
  ['old-box', oldExecutable],
  ['new-box', newExecutable],
]) {
  const app = await mkdtemp(resolve('tmp/version-compatibility-app-'));
  await promisify(execFile)(executable, [`--extract-only=${app}`], {
    windowsHide: true,
    timeout: 120000,
  });
  apps.set(name, app);
}

const requests = [];
const remoteFiles = new Map([
  ['/TableMax/games/catalog.json', 'TableMax-game-catalog-v1.0.6.json'],
  [
    '/TableMax/games/v1.0.6/catalog.json',
    'TableMax-game-catalog-v1.0.6-legacy.json',
  ],
  ...newCatalog.blobs.map((blob) => [
    `/TableMax/games/${blob.releaseTag}/packages/${blob.assetName}`,
    blob.assetName,
  ]),
]);
const distribution = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  requests.push(path);
  const file = remoteFiles.get(path);
  if (!file) {
    response.writeHead(404).end();
    return;
  }
  try {
    response.end(await readFile(join(currentDirectory, file)));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => distribution.listen(0, '127.0.0.1', resolve));
const loopback = `http://127.0.0.1:${distribution.address().port}`;
const preload = join(work, 'distribution-fixture.cjs');
await writeFile(
  preload,
  `const original = globalThis.fetch; globalThis.fetch = (input, options) => { const url = new URL(String(input)); if (url.origin !== 'https://anapalpitate.github.io') throw new Error('External test request forbidden'); return original(${JSON.stringify(loopback)} + url.pathname, options); };`,
);

async function open(executable, name) {
  const app = apps.get(name);
  const child = spawn(
    join(app, 'node.exe'),
    ['--require', preload, join(app, 'server.cjs'), '--desktop-pipe'],
    {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TABLEMAX_AUTO_MAINTENANCE: '0' },
    },
  );
  const exited = new Promise((resolve) => child.once('exit', resolve));
  const lines = createInterface({ input: child.stdout });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Packaged service startup timed out')),
      30000,
    );
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('Packaged service exited before ready'));
    });
    lines.on('line', (line) => {
      const message = JSON.parse(line);
      if (message.type === 'ready') {
        clearTimeout(timer);
        resolve(message);
      } else if (message.type === 'error') {
        clearTimeout(timer);
        reject(new Error(message.message));
      }
    });
  });
  child.stderr.resume();
  child.stdin.write(
    JSON.stringify({
      type: 'start',
      config: {
        host: '127.0.0.1',
        port: 0,
        dataDir: join(work, 'data'),
        gamesDir: join(work, 'games'),
        webDir: join(app, 'web'),
        playMode: 'test',
      },
    }) + '\n',
  );
  let socket;
  try {
    const privateIdentity = await ready;
    const origin = `http://127.0.0.1:${privateIdentity.port}`;
    const token = privateIdentity.hostToken;
    const view = async () => {
      const result = await (
        await fetch(origin + '/api/session/view', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        })
      ).json();
      assert.equal(result.ok, true);
      return result.view;
    };
    const importPack = async (directory, release) =>
      fetch(origin + '/api/game-packages/import', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/octet-stream',
        },
        body: await readFile(join(directory, release.offlineAsset)),
      });
    const command = async (command) => {
      socket ??= io(origin, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
      });
      if (!socket.connected)
        await new Promise((resolve, reject) => {
          socket.once('connect', resolve);
          socket.once('connect_error', reject);
        });
      const state = await view();
      const result = await new Promise((resolve, reject) =>
        socket.timeout(5000).emit(
          'room:command',
          {
            actionId: randomUUID(),
            instanceId: state.instanceId,
            branch: state.branch,
            revision: state.revision,
            command,
          },
          (error, value) => (error ? reject(error) : resolve(value)),
        ),
      );
      assert.equal(result.ok, true, result.reason);
      return view();
    };
    const close = async () => {
      socket?.disconnect();
      child.stdin.end(JSON.stringify({ type: 'stop' }) + '\n');
      const timer = setTimeout(() => child.kill(), 10000);
      await exited;
      clearTimeout(timer);
      lines.close();
    };
    const snapshot = async () =>
      (await fetch(origin + '/api/game-packages')).json();
    const manage = async (operation, releaseId) =>
      fetch(origin + '/api/game-packages/manage', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ operation, releaseId }),
      });
    return { view, importPack, command, close, snapshot, manage };
  } catch (error) {
    socket?.disconnect();
    child.kill();
    await exited;
    lines.close();
    throw error;
  }
}

let host;
try {
  host = await open(oldExecutable, 'old-box');
  assert.equal(
    (await host.importPack(historicalDirectory, oldUno)).status,
    200,
  );
  assert.equal(
    (await host.importPack(historicalDirectory, oldAvalon)).status,
    200,
  );
  checks.push('actual old box installs original protocol-7 packages');
  assert.equal((await host.manage('refresh')).status, 200);
  let snapshot = await host.snapshot();
  const recommendation = snapshot.catalog.releases.find(
    (r) => r.gameId === 'avalon',
  );
  assert.equal(recommendation.releaseId, oldAvalon.releaseId);
  assert.equal(recommendation.compatible, true);
  const compatible = snapshot.catalog.releases.find(
    (r) => r.gameId === 'modern-art',
  );
  assert.equal(compatible.compatible, true);
  assert.equal(
    (await host.manage('install', compatible.releaseId)).status,
    200,
  );
  const deadline = Date.now() + 15000;
  while (
    Date.now() < deadline &&
    !(await host.snapshot()).index.releases[compatible.releaseId]
  )
    await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok((await host.snapshot()).index.releases[compatible.releaseId]);
  assert.ok(requests.some((path) => path.includes('/packages/')));
  checks.push(
    'actual old box refreshes fixed legacy URL and downloads current compatible code/resources while new capability release is withheld',
  );
  const rejected = await host.importPack(currentDirectory, newAvalon);
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).reason, /incompatible/);
  checks.push('actual old box rejects protocol-8 capability package');
  await host.command({ type: 'select-game', gameId: 'uno' });
  await host.command({ type: 'add-bot', name: 'One' });
  await host.command({ type: 'add-bot', name: 'Two' });
  await host.command({ type: 'start' });
  const saved = await host.command({ type: 'pause' });
  assert.equal(saved.game.releaseRef, oldUno.releaseId);
  await host.close();
  host = undefined;
  host = await open(newExecutable, 'new-box');
  assert.equal((await host.manage('refresh')).status, 200);
  assert.equal(
    (await host.snapshot()).catalog.releases.find((r) => r.gameId === 'avalon')
      .releaseId,
    newAvalon.releaseId,
  );
  checks.push(
    'actual new box uses stable catalog and recommends current capability release',
  );
  const restored = await host.view();
  assert.equal(restored.paused, true);
  assert.equal(restored.instanceId, saved.instanceId);
  assert.equal(restored.game.releaseRef, oldUno.releaseId);
  checks.push(
    'actual new box restores old SQLite save with exact original release and instance',
  );
  assert.equal(
    (await host.importPack(historicalDirectory, oldAvalon)).status,
    200,
  );
  assert.equal(
    (await host.importPack(currentDirectory, newAvalon)).status,
    200,
  );
  assert.equal((await host.view()).game.releaseRef, oldUno.releaseId);
  checks.push(
    'actual new box accepts old and new game packages without replacing pinned save',
  );
  const report = {
    result: 'passed',
    buildVersion: pointer.buildVersion,
    snapshot: pointer.snapshot,
    oldExecutableSha256: await digest(oldExecutable),
    newExecutableSha256: await digest(newExecutable),
    oldRelease: oldUno.releaseId,
    newRelease: newAvalon.releaseId,
    work,
    extractedApps: Object.fromEntries(apps),
    checks,
    distributionRequests: requests,
    boundary:
      'actual extracted box Node services; loopback, offline import and SQLite; no publication/CDN or physical-device claim',
  };
  await writeFile(
    join(evidence, 'actual-compatibility-online.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
} finally {
  await host?.close();
  await new Promise((resolve) => distribution.close(resolve));
}
