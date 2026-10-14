import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  unlink,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readCurrentSave } from '../../../apps/server/src/save-codec.mjs';
import { launchDesktop } from '../support/desktop-test.mjs';
import { saveVerificationScreenshot } from '../support/screenshots.mjs';
import { digest, localFile } from '../runner/evidence.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const option = (name) =>
  process.argv
    .find((arg) => arg.startsWith('--' + name + '='))
    ?.slice(name.length + 3);
const deliveryPath = resolve(option('delivery') ?? '');
const helper = resolve(option('helper') ?? '');
const fixtureRoot = resolve(
  'artifacts/maintenance/v1.0.6/pokemon-events-v3-verification/legacy-v2-1063-20261012-a',
);
const sourceSha256 = digest(
  await readFile('tools/test/installation/verify-installed-legacy-save.mjs'),
);
async function noLinks(path) {
  for (let cursor = path; ; cursor = dirname(cursor)) {
    try {
      assert.ok(!(await lstat(cursor)).isSymbolicLink(), 'Linked input');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (cursor === dirname(cursor)) break;
  }
}
for (const path of [deliveryPath, helper, fixtureRoot]) {
  assert.ok(path.startsWith(resolve('.') + '\\'), 'Workspace input required');
  for (let cursor = path; ; cursor = dirname(cursor)) {
    assert.ok(!(await lstat(cursor)).isSymbolicLink(), 'Linked input');
    if (cursor === dirname(cursor)) break;
  }
}
const delivery = JSON.parse(await readFile(deliveryPath, 'utf8'));
assert.equal(
  delivery.executable.installation.productId,
  '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}',
);
const installation = delivery.executable.installation;
const candidate = installation.candidateDirectory;
for (const path of [
  candidate,
  installation.manifestPath,
  delivery.executable.path,
]) {
  assert.ok(
    path.startsWith(resolve('.') + '\\'),
    'Workspace delivery input required',
  );
  await noLinks(path);
}
const candidateManifest = localFile(candidate, 'installation-manifest.json');
assert.equal(
  digest(await readFile(candidateManifest)),
  installation.manifestSha256,
);
assert.equal(
  digest(await readFile(delivery.executable.path)),
  delivery.executable.sha256,
);
const fixture = JSON.parse(
  await readFile(join(fixtureRoot, 'fixture.json'), 'utf8'),
);
assert.equal(
  fixture.binding.executableSha256,
  '45eff9712c56019c1a87c2d0f9df674c5e606cb9ef4f14e8128ccab94fd7364f',
);
assert.equal(
  digest(await readFile(join(fixtureRoot, 'data/room.sqlite'))),
  fixture.sqliteSha256,
);
assert.equal(
  digest(await readFile(join(fixtureRoot, 'games/index.json'))),
  fixture.gamesIndexSha256,
);
for (const file of fixture.files)
  assert.equal(
    digest(
      await readFile(
        localFile(
          join(fixtureRoot, 'games/pokemon-encounters/blobs', file.blobId),
          file.path,
        ),
      ),
    ),
    file.sha256,
  );
await noLinks(resolve('tmp'));
const work = await mkdtemp(resolve('tmp/installation-real-legacy-'));
await noLinks(work);
const source = join(work, '旧便携 TableMax');
const installRoot = join(work, '新版程序 目录');
const box = join(installRoot, 'TableMax');
const output = resolve(
  process.env.TABLEMAX_TEST_OUTPUT_DIR ??
    join(
      'artifacts/maintenance/v1.0.6/installation-remaining',
      'real-legacy-' + Date.now(),
    ),
);
const relativeOutput = relative(resolve('artifacts/maintenance'), output);
assert.ok(
  relativeOutput &&
    !isAbsolute(relativeOutput) &&
    relativeOutput !== '..' &&
    !relativeOutput.startsWith('..' + sep),
  'Evidence must remain in workspace maintenance',
);
await noLinks(output);
await mkdir(output, { recursive: false });
const environment = { ...process.env };
for (const key of Object.keys(environment))
  if (
    key.startsWith('TABLEMAX_') ||
    key.startsWith('WEBVIEW2_') ||
    ['NODE_OPTIONS', 'NODE_PATH'].includes(key)
  )
    environment[key] = undefined;
Object.assign(environment, {
  TEMP: work,
  TMP: work,
  TABLEMAX_DATA_DIR: box,
  TABLEMAX_BOX_DIRECTORY: box,
  TABLEMAX_HOST: '127.0.0.1',
  TABLEMAX_PORT: '0',
  TABLEMAX_AUTO_MAINTENANCE: '0',
  TABLEMAX_TEST_MAINTENANCE: '0',
});
const report = {
  result: 'running',
  fixture: true,
  deliveryPath,
  work,
  installRoot,
  oldExecutableSha256: fixture.binding.executableSha256,
  installerSha256: delivery.executable.sha256,
  nativeSha256: digest(
    await readFile(localFile(candidate, 'TableMax/app/TableMax.exe')),
  ),
  helperSha256: digest(await readFile(helper)),
  helperSourceSha256: digest(
    await readFile('apps/desktop/installation-runtime/UpdateHelper.cs'),
  ),
  sourceSha256,
  installationRecipe: installation.recipe.inputs,
  checks: [],
  boundary:
    'Actual helper migration and installed Native/Node with a preserved real 1.0.6.3 save/immutable release/credentials/checkpoints. Separate fixture product and composite helper input; no Inno, registry, formal installer, physical phone, OS power loss or public release claim.',
};
async function inventory(root) {
  const result = [];
  async function walk(path, prefix = '') {
    for (const item of await readdir(path, { withFileTypes: true })) {
      assert.ok(!item.isSymbolicLink());
      const name = prefix + item.name;
      if (item.isDirectory()) await walk(join(path, item.name), name + '/');
      else
        result.push({
          path: name,
          sha256: digest(await readFile(join(path, item.name))),
        });
    }
  }
  await walk(root);
  return result.sort((a, b) => a.path.localeCompare(b.path));
}
async function invoke(args, label, expected) {
  const child = spawn(helper, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: environment,
  });
  let text = '';
  child.stdout.on('data', (chunk) => {
    text += chunk;
  });
  child.stderr.on('data', (chunk) => {
    text += chunk;
  });
  const code = await new Promise((done, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Helper exceeded bounded budget'));
    }, 120000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (value) => {
      clearTimeout(timer);
      done(value);
    });
  });
  await writeFile(join(output, label + '.log'), text);
  assert.equal(code, expected, label + '; inspect saved log');
  return { code, diagnostic: text };
}
let desktop, host, origin, hostToken;
let sockets = [];
async function view(token) {
  const result = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
      signal: AbortSignal.timeout(10000),
    })
  ).json();
  assert.equal(result.ok, true);
  return result.view;
}
async function socket(token) {
  const client = io(origin, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  sockets.push(client);
  await new Promise((done, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Socket readiness timed out')),
      15000,
    );
    client.once('room:view', () => {
      clearTimeout(timer);
      done();
    });
    client.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  return client;
}
async function command(client, token, value) {
  const current = await view(token);
  const result = await new Promise((done, reject) =>
    client.timeout(10000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: current.instanceId,
        revision: current.revision,
        branch: current.branch,
        command: value,
      },
      (error, reply) => (error ? reject(error) : done(reply)),
    ),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
}
async function launch() {
  desktop = await launchDesktop({
    executablePath: join(box, 'app/TableMax.exe'),
    timeout: 45000,
    env: environment,
  });
  host = await desktop.firstWindow();
  await host.locator('.connection.online').waitFor();
  origin = new URL(host.url()).origin;
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken);
  return socket(hostToken);
}
async function close() {
  for (const item of sockets) item.disconnect();
  sockets = [];
  await desktop?.close();
  desktop = undefined;
}
try {
  await mkdir(source);
  await cp(join(fixtureRoot, 'data'), source, { recursive: true });
  await cp(join(fixtureRoot, 'games'), join(source, 'games'), {
    recursive: true,
  });
  await writeFile(
    join(source, 'TableMax.config.json'),
    '{"dataDirectory":"."}\n',
  );
  const preferences = {
    version: 1,
    host: { resolution: '1280x720', interfaceScale: 125 },
    public: { resolution: '1920x1080', interfaceScale: 150 },
  };
  await writeFile(
    join(source, 'display-settings.json'),
    JSON.stringify(preferences) + '\n',
  );
  await writeFile(
    join(source, '朋友保存的文件.txt'),
    '保留的真实旧档迁移附加文件\n',
  );
  const before = await inventory(source);
  await mkdir(installRoot);
  await invoke(
    [
      '--commit',
      '--root=' + installRoot,
      '--candidate=' + candidate,
      '--manifest=' + candidateManifest,
      '--installer-source=' + delivery.executable.path,
      '--migration-root=' + source,
      '--health-timeout=90000',
    ],
    'old-save-migration',
    0,
  );
  assert.deepEqual(await inventory(source), before);
  assert.deepEqual(
    JSON.parse(await readFile(join(box, 'TableMax.config.json'), 'utf8')),
    { dataDirectory: '.' },
  );
  assert.deepEqual(
    JSON.parse(await readFile(join(box, 'display-settings.json'), 'utf8')),
    preferences,
  );
  assert.equal(
    digest(await readFile(join(box, '朋友保存的文件.txt'))),
    digest(await readFile(join(source, '朋友保存的文件.txt'))),
  );
  report.checks.push({
    name: 'real-old-save-migrated-with-originals-and-settings-preserved',
    result: 'passed',
    sourceFiles: before,
  });
  const tokens = JSON.parse(
    await readFile(join(fixtureRoot, 'player-credentials.local.json'), 'utf8'),
  ).tokens;
  let hostSocket = await launch();
  const restored = await view();
  assert.equal(restored.instanceId, fixture.instanceId);
  assert.equal(restored.status, 'playing');
  assert.equal(restored.game.releaseRef, fixture.releaseRef);
  assert.equal(restored.paused, true);
  assert.deepEqual(
    restored.gameView,
    JSON.parse(await readFile(join(fixtureRoot, 'public-view.json'), 'utf8'))
      .gameView,
  );
  const database = new DatabaseSync(join(box, 'room.sqlite'), {
    readOnly: true,
  });
  let original;
  try {
    original = readCurrentSave(database);
  } finally {
    database.close();
  }
  assert.equal(
    tokens.length,
    original.seats.filter((seat) => seat.controller !== 'bot').length,
  );
  assert.equal(original.history.length, fixture.checkpointCount);
  for (let i = 0; i < tokens.length; i++) {
    await socket(tokens[i]);
    assert.equal((await view(tokens[i])).self.seatId, original.seats[i].id);
  }
  await host.goto(origin + '/host/game');
  await host.locator('.expansion-screen').waitFor();
  const nativeWindow = await desktop.browserWindow(host);
  const captured = await nativeWindow.evaluate(async (window) =>
    (await window.webContents.capturePage()).toPNG().toString('base64'),
  );
  await saveVerificationScreenshot(
    join(output, 'real-old-release.png'),
    Buffer.from(captured, 'base64'),
  );
  const pending = join(box, '.installation-transactions', randomUUID());
  await mkdir(pending);
  const identity = await readFile(join(box, '.install.json'));
  const state = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      root: installRoot,
      phase: 'health-failed',
      dataDirectory: box,
      databaseFingerprint: '0'.repeat(64),
    }),
  );
  await writeFile(join(pending, 'state.json'), state);
  await writeFile(join(pending, 'target.json'), identity);
  const refused = await invoke(
    ['--recover', '--root=' + installRoot],
    'pending-recovery-playing',
    20,
  );
  assert.match(refused.diagnostic, /对局|进行/);
  assert.equal(
    digest(await readFile(join(pending, 'state.json'))),
    digest(state),
  );
  assert.equal(
    digest(await readFile(join(box, '.install.json'))),
    digest(identity),
  );
  assert.equal((await view()).game.releaseRef, fixture.releaseRef);
  await unlink(join(pending, 'state.json'));
  await unlink(join(pending, 'target.json'));
  await rmdir(pending);
  report.checks.push({
    name: 'actual-playing-native-refuses-pending-update-recovery',
    result: 'passed',
    desktopPid: desktop.startup.desktopPid,
    servicePid: desktop.startup.servicePid,
  });
  const history = (await view(hostToken)).history;
  await command(hostSocket, hostToken, {
    type: 'rollback',
    checkpointId: history.at(-1).id,
  });
  const rolled = await view();
  assert.equal(rolled.branch, restored.branch + 1);
  assert.equal(rolled.game.releaseRef, fixture.releaseRef);
  assert.equal(rolled.gameView.rulesProfile, 'research-buffer-v2');
  await close();
  hostSocket = await launch();
  assert.deepEqual((await view()).gameView, rolled.gameView);
  for (let i = 0; i < tokens.length; i++)
    assert.equal((await view(tokens[i])).self.seatId, original.seats[i].id);
  report.checks.push({
    name: 'old-checkpoint-and-player-identities-survive-restart',
    result: 'passed',
    releaseRef: fixture.releaseRef,
    checkpointCount: fixture.checkpointCount,
    branch: rolled.branch,
  });
  await command(hostSocket, hostToken, {
    type: 'select-game',
    gameId: 'pokemon-encounters',
    endCurrent: true,
  });
  await command(hostSocket, hostToken, {
    type: 'select-variant',
    variantId: 'expansion',
  });
  for (const token of tokens)
    await command(await socket(token), token, { type: 'ready', ready: true });
  await command(hostSocket, hostToken, { type: 'start' });
  const current = await view();
  const bootstrap = JSON.parse(
    await readFile(join(box, 'app/preinstalled-games/bootstrap.json'), 'utf8'),
  );
  assert.ok(bootstrap.releaseIds.includes(current.game.releaseRef));
  assert.notEqual(current.game.releaseRef, fixture.releaseRef);
  assert.equal(current.status, 'playing');
  for (const file of fixture.files)
    assert.equal(
      digest(
        await readFile(
          localFile(
            join(box, 'games/pokemon-encounters/blobs', file.blobId),
            file.path,
          ),
        ),
      ),
      file.sha256,
    );
  report.checks.push({
    name: 'new-game-uses-package-mapping-old-immutable-files-retained',
    result: 'passed',
    currentReleaseRef: current.game.releaseRef,
    oldReleaseRef: fixture.releaseRef,
  });
  await close();
  assert.deepEqual(await inventory(source), before);
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.failure = error.stack;
} finally {
  await close().catch((error) => {
    report.result = 'failed';
    report.cleanupFailure = error.stack;
  });
  if (
    sourceSha256 !==
    digest(
      await readFile(
        'tools/test/installation/verify-installed-legacy-save.mjs',
      ),
    )
  ) {
    report.result = 'failed';
    report.sourceChanged = true;
  }
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.map((item) => item.name),
      output,
      failure: report.failure,
    }),
  );
}
if (report.result !== 'passed') process.exitCode = 1;
