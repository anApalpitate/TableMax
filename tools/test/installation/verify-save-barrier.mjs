import assert from 'node:assert/strict';
import { once } from 'node:events';
import { connect } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, lstat, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { launchDesktop } from '../support/desktop-test.mjs';
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
const root = resolve(option('root') ?? '');
const child = relative(resolve('tmp'), root);
assert.ok(
  child &&
    !isAbsolute(child) &&
    !child.startsWith('..' + sep) &&
    child !== '..',
);
for (let path = root; ; path = dirname(path)) {
  assert.ok(
    !(await lstat(path)).isSymbolicLink(),
    'Fixture root contains a link',
  );
  if (dirname(path) === path) break;
}
const identityPath = localFile(root, 'data/.install.json');
const identityBytes = await readFile(identityPath);
const identity = JSON.parse(identityBytes);
assert.equal(
  identity.productId,
  '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}',
  'This failure injection requires a distinct fixture installation',
);
assert.equal(resolve(identity.root), root);
const box = join(root, 'data');
const environment = { ...process.env };
for (const key of Object.keys(environment))
  if (
    key.startsWith('TABLEMAX_') ||
    key.startsWith('WEBVIEW2_') ||
    ['NODE_OPTIONS', 'NODE_PATH'].includes(key)
  )
    environment[key] = undefined;
Object.assign(environment, {
  TABLEMAX_BOX_DIRECTORY: box,
  TABLEMAX_DATA_DIR: box,
  TABLEMAX_HOST: '127.0.0.1',
  TABLEMAX_PORT: '0',
  TABLEMAX_AUTO_MAINTENANCE: '0',
  TABLEMAX_TEST_MAINTENANCE: '0',
});
const configuration = JSON.parse(
  await readFile(localFile(root, 'data/TableMax.config.json'), 'utf8'),
);
assert.equal(
  configuration.dataDirectory,
  '.',
  'Use the fresh default-data fixture, never an external data directory',
);
const output = resolve(
  process.env.TABLEMAX_TEST_OUTPUT_DIR ??
    'artifacts/maintenance/v1.0.6/installation-remaining/save-barrier-' +
      Date.now(),
);
await mkdir(output, { recursive: true });
const report = {
  result: 'running',
  fixture: true,
  installationId: identity.installationId,
  buildVersion: identity.buildVersion,
  root,
  checks: [],
  boundary:
    'Real installed fixture Native, package Node and SQLite write failure; same-user private update control. No production data, registry or installer application.',
};
const sourcePaths = [
  'apps/desktop/native/DesktopContext.cs',
  'apps/desktop/native/ServiceProcess.cs',
  'apps/desktop/native/InstallationSession.cs',
  'apps/server/src/service.ts',
];
report.sourceHashes = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (path) => [path, digest(await readFile(path))]),
  ),
);
report.nativeSha256 = digest(
  await readFile(localFile(root, 'data/app/TableMax.exe')),
);
let desktop, socket, database, failure, hostToken;
let diagnostic = '';
const triggerNames = [
  'tablemax_fixture_save_insert',
  'tablemax_fixture_save_update',
];
const createdTriggers = [];
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
};
async function privateUpdate() {
  const pipe =
    '\\\\.\\pipe\\TableMax.Installation.' +
    digest(Buffer.from(root.replace(/[\\/]+$/, '').toLowerCase(), 'utf8'));
  return new Promise((done, reject) => {
    const stream = connect(pipe);
    let text = '';
    const timer = setTimeout(() => {
      stream.destroy();
      reject(new Error('Fixture installation control timed out'));
    }, 15000);
    const finish = () => {
      clearTimeout(timer);
      try {
        done(text.trim() ? JSON.parse(text.trim()) : null);
      } catch (error) {
        reject(error);
      }
    };
    stream.on('connect', () =>
      stream.write(
        JSON.stringify({ schemaVersion: 1, root, operation: 'update' }) + '\n',
      ),
    );
    stream.on('data', (chunk) => {
      text += chunk.toString();
      if (text.includes('\n')) stream.end();
    });
    stream.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    stream.once('close', finish);
  });
}
try {
  desktop = await launchDesktop({
    executablePath: join(box, 'app/TableMax.exe'),
    env: environment,
    timeout: 45000,
  });
  desktop.process().stderr.on('data', (chunk) => {
    diagnostic = (diagnostic + chunk.toString()).slice(-20000);
  });
  const host = await desktop.firstWindow();
  await host.locator('.connection.online').waitFor();
  const origin = new URL(host.url()).origin;
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken);
  socket = io(origin, {
    auth: { token: hostToken },
    transports: ['websocket'],
    forceNew: true,
  });
  await new Promise((done, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Fixture socket readiness timed out')),
      15000,
    );
    socket.once('room:view', () => {
      clearTimeout(timer);
      done();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  const view = (
    await (
      await fetch(origin + '/api/session/view', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: hostToken }),
        signal: AbortSignal.timeout(10000),
      })
    ).json()
  ).view;
  assert.equal(view.status, 'lobby');
  if (!view.game) {
    const reply = await new Promise((done, reject) =>
      socket.timeout(10000).emit(
        'room:command',
        {
          actionId: randomUUID(),
          instanceId: view.instanceId,
          revision: view.revision,
          branch: view.branch,
          command: { type: 'select-game', gameId: 'pokemon-encounters' },
        },
        (error, result) => (error ? reject(error) : done(result)),
      ),
    );
    assert.equal(reply.ok, true);
  }
  const persisted = await (
    await fetch(origin + '/api/session/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '已保存的隔离玩家' }),
      signal: AbortSignal.timeout(10000),
    })
  ).json();
  assert.equal(
    persisted.ok,
    true,
    'Create a real saved room before failure injection',
  );
  database = new DatabaseSync(localFile(root, 'data/room.sqlite'));
  const before = database
    .prepare('SELECT data FROM saves WHERE id=1')
    .get().data;
  assert.ok(before);
  for (const name of triggerNames)
    assert.equal(
      database
        .prepare(
          "SELECT count(*) AS count FROM sqlite_master WHERE type='trigger' AND name=?",
        )
        .get(name).count,
      0,
    );
  for (const [index, name] of triggerNames.entries()) {
    database.exec(
      `CREATE TRIGGER ${name} BEFORE ${index === 0 ? 'INSERT' : 'UPDATE'} ON saves BEGIN SELECT RAISE(ABORT,'fixture-save-failed'); END;`,
    );
    createdTriggers.push(name);
  }
  const response = await fetch(origin + '/api/session/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '不能保存的隔离玩家' }),
    signal: AbortSignal.timeout(10000),
  });
  const rejected = await response.json();
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'save-or-action-failed');
  assert.equal(
    database.prepare('SELECT data FROM saves WHERE id=1').get().data,
    before,
  );
  report.checks.push({
    name: 'actual-sqlite-save-failure-keeps-last-committed-room',
    result: 'passed',
    savedRoomSha256: digest(before),
  });
  const cdp = await host.context().browser().newBrowserCDPSession();
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  await cdp.detach();
  const pids = [
    desktop.startup.desktopPid,
    desktop.startup.servicePid,
    ...processInfo.map((item) => item.id),
  ];
  const exited = once(desktop.process(), 'exit');
  const reply = await privateUpdate();
  assert.ok(reply === null || reply.confirmed === false);
  let exitTimer;
  let code;
  try {
    [code] = await Promise.race([
      exited,
      new Promise((_, reject) => {
        exitTimer = setTimeout(
          () => reject(new Error('Save-failed desktop did not safely exit')),
          20000,
        );
      }),
    ]);
  } finally {
    clearTimeout(exitTimer);
  }
  assert.equal(code, 1);
  await desktop.close();
  for (const pid of pids)
    assert.equal(
      alive(pid),
      false,
      'A fixture process survived failed update: ' + pid,
    );
  assert.match(diagnostic, /更新已停止：保存关闭失败/);
  assert.equal(digest(await readFile(identityPath)), digest(identityBytes));
  assert.equal(
    database.prepare('SELECT data FROM saves WHERE id=1').get().data,
    before,
  );
  report.checks.push({
    name: 'native-refuses-update-and-exits-after-save-failure',
    result: 'passed',
    exitCode: code,
    confirmed: reply?.confirmed ?? false,
    pids,
    installationIdentityUnchanged: true,
  });
  report.result = 'passed';
} catch (error) {
  failure = error.stack;
  report.result = 'failed';
  report.failure = failure;
} finally {
  socket?.disconnect();
  await desktop?.close().catch((error) => {
    if (!failure) {
      report.result = 'failed';
      report.failure = error.stack;
    }
  });
  if (database) {
    try {
      for (const name of createdTriggers)
        database.exec('DROP TRIGGER IF EXISTS ' + name);
    } catch (error) {
      report.result = 'failed';
      report.cleanupFailure = error.stack;
    } finally {
      database.close();
    }
  }
  report.nativeDiagnostic = hostToken
    ? diagnostic.replaceAll(hostToken, '[private credential removed]')
    : diagnostic;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.map((item) => item.name),
      output,
    }),
  );
}
if (report.result !== 'passed') process.exitCode = 1;
