import assert from 'node:assert/strict';
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  readdir,
  copyFile,
  stat,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { launchDesktop } from '../support/desktop-test.mjs';
import { readCurrentSave } from '../../../apps/server/src/save-codec.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
assertWorkspaceRoot();
const run = promisify(execFile);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const oldDirectory = resolve(
  'artifacts/maintenance/v1.0.6/game-packages/previous-delivery',
);
const oldArchive = join(oldDirectory, 'TableMax-1.0.6-win-x64.zip');
const oldManifest = JSON.parse(
  await readFile(
    join(oldDirectory, 'TableMax-1.0.6-win-x64-manifest.json'),
    'utf8',
  ),
);
const newExe =
  process.argv.find((arg) => arg.startsWith('--new-exe='))?.slice(10) ??
  resolve('artifacts/releases/TableMax-1.0.6-win-x64.exe');
await stat(newExe);
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/legacy-game-migration-'));
const application = join(work, 'app');
const evidence = resolve(
  'artifacts/maintenance/v1.0.6/game-packages/legacy-migration',
  `attempt-${Date.now()}`,
);
await mkdir(evidence, { recursive: true });
const report = {
  result: 'running',
  work,
  oldArchiveSha256: hash(await readFile(oldArchive)),
  newExeSha256: hash(await readFile(newExe)),
  checks: [],
  boundary:
    'Actual old ZIP and native-generated SQLite match, real new Launcher upgrade and Windows WebView2; loopback only, muted; no physical phone/Safari claim',
};
assert.equal(report.oldArchiveSha256, oldManifest.archive.sha256);
const env = {
  ...process.env,
  TABLEMAX_HOST: '127.0.0.1',
  TABLEMAX_PORT: '0',
  TABLEMAX_BOX_DIRECTORY: work,
  TABLEMAX_DATA_DIR: work,
  TABLEMAX_TEST_AUDIO: '0',
};
delete env.TABLEMAX_WEB_DEV_URL;
delete env.NODE_OPTIONS;
delete env.NODE_PATH;
const sockets = [];
let desktop;
async function post(origin, path, body) {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  assert.equal(response.status, 200, JSON.stringify(value));
  assert.equal(value.ok, true, JSON.stringify(value));
  return value;
}
const view = async (origin, token) =>
  (await post(origin, '/api/session/view', token ? { token } : {})).view;
async function connect(origin, token) {
  const socket = io(origin, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Socket connection timeout')),
      10000,
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
  return socket;
}
async function command(origin, socket, token, value) {
  const current = await view(origin, token);
  const reply = await new Promise((done, reject) =>
    socket.timeout(10000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: current.instanceId,
        revision: current.revision,
        branch: current.branch,
        command: value,
      },
      (error, result) => (error ? reject(error) : done(result)),
    ),
  );
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return reply;
}
function save() {
  const database = new DatabaseSync(join(work, 'room.sqlite'), {
    readOnly: true,
  });
  try {
    return readCurrentSave(database);
  } finally {
    database.close();
  }
}
async function boot() {
  desktop = await launchDesktop({
    executablePath: join(application, 'TableMax.exe'),
    args: ['--foundation-test', '--tablemax-test-mode'],
    env,
    timeout: 60000,
  });
  const page = await desktop.firstWindow();
  await page.waitForFunction(() =>
    Boolean(sessionStorage.getItem('tablemax-host')),
  );
  const origin = new URL(page.url()).origin,
    token = await page.evaluate(() => sessionStorage.getItem('tablemax-host'));
  const socket = await connect(origin, token);
  return { origin, token, socket, page };
}
async function close() {
  for (const socket of sockets.splice(0)) socket.disconnect();
  if (desktop) {
    await desktop.close();
    desktop = null;
  }
}
try {
  await run(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_LEGACY_ARCHIVE -DestinationPath $env:TABLEMAX_LEGACY_APPLICATION',
    ],
    {
      windowsHide: true,
      env: {
        ...env,
        TABLEMAX_LEGACY_ARCHIVE: oldArchive,
        TABLEMAX_LEGACY_APPLICATION: application,
      },
    },
  );
  let host = await boot();
  await command(host.origin, host.socket, host.token, {
    type: 'select-game',
    gameId: 'uno',
  });
  const players = [];
  for (const name of ['旧局甲', '旧局乙']) {
    const joined = await post(host.origin, '/api/session/join', { name });
    const socket = await connect(host.origin, joined.token);
    players.push({ token: joined.token, socket });
    await command(host.origin, socket, joined.token, {
      type: 'ready',
      ready: true,
    });
  }
  await command(host.origin, host.socket, host.token, { type: 'start' });
  let acted = false;
  for (const player of players) {
    const current = await view(host.origin, player.token);
    const action = current.actions.find((action) => action.type === 'draw');
    if (action) {
      await command(host.origin, player.socket, player.token, {
        type: 'game',
        decisionId: current.decisionId,
        action,
      });
      acted = true;
      break;
    }
  }
  assert.ok(acted, 'Old native game did not expose authorized draw action');
  const projections = await Promise.all(
    players.map((player) => view(host.origin, player.token)),
  );
  await close();
  const before = save();
  assert.equal(before.manifest.id, 'uno');
  assert.equal(before.releaseRef, undefined);
  assert.equal(before.status, 'playing');
  assert.equal(before.paused, false);
  assert.ok(before.history.length > 0);
  await copyFile(
    join(work, 'room.sqlite'),
    join(evidence, 'old-native-room.sqlite'),
  );
  report.oldSnapshotSha256 = hash(JSON.stringify(before.snapshot));
  report.oldInstanceId = before.instanceId;
  report.oldHistoryCount = before.history.length;
  report.checks.push(
    'Protected actual old full ZIP generated a real two-human UNO match, saved draw and checkpoint through authorized native session',
  );
  for (const file of oldManifest.files) {
    const bytes = await readFile(join(application, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(hash(bytes), file.sha256);
  }
  await writeFile(
    join(application, '.tablemax-release.json'),
    JSON.stringify({
      version: '1.0.6',
      archive: oldManifest.archive,
      files: oldManifest.files,
    }),
  );
  await run(newExe, [`--extract-only=${application}`], {
    windowsHide: true,
    env,
    timeout: 120000,
  });
  const preserved = await readdir(join(work, 'games', '.legacy'));
  assert.equal(
    preserved.filter((name) => /^[a-f0-9]{64}$/.test(name)).length,
    1,
  );
  const legacyRoot = join(
    work,
    'games',
    '.legacy',
    preserved.find((name) => /^[a-f0-9]{64}$/.test(name)),
  );
  for (const path of [
    'games/uno.cjs',
    'bots/uno.cjs',
    'web/games/uno/web/entry.js',
  ])
    assert.equal(
      hash(await readFile(join(legacyRoot, path))),
      oldManifest.files.find((file) => file.path === path).sha256,
    );
  report.checks.push(
    'Real shipping Launcher preserved exact old rules, bot, web and media before replacing managed app directory',
  );
  host = await boot();
  const restored = await view(host.origin, host.token);
  assert.equal(restored.instanceId, before.instanceId);
  assert.equal(restored.status, 'playing');
  assert.equal(restored.paused, true);
  assert.ok(
    restored.game,
    'Preserved actual legacy game unexpectedly entered missing-package repair mode',
  );
  assert.match(restored.game.releaseRef, /^[a-f0-9]{64}$/);
  const index = JSON.parse(
    await readFile(join(work, 'games', 'index.json'), 'utf8'),
  );
  const release = index.releases[restored.game.releaseRef];
  assert.equal(release.legacy, true);
  assert.equal(release.gameId, 'uno');
  const catalog = JSON.parse(
    await readFile(
      'artifacts/game-packages/v1.0.6/TableMax-game-catalog-v1.0.6.json',
      'utf8',
    ),
  );
  assert.ok(
    !catalog.payload.releases.some(
      (release) => release.releaseId === restored.game.releaseRef,
    ),
  );
  for (let i = 0; i < players.length; i++) {
    const current = await view(host.origin, players[i].token);
    assert.equal(current.self.seatId, projections[i].self.seatId);
    assert.deepEqual(current.gameView, projections[i].gameView);
  }
  const after = save();
  assert.deepEqual(after.snapshot, before.snapshot);
  assert.deepEqual(after.history, before.history);
  assert.deepEqual(
    after.seats.map(({ id, tokenHash }) => ({ id, tokenHash })),
    before.seats.map(({ id, tokenHash }) => ({ id, tokenHash })),
  );
  assert.equal(after.releaseRef, restored.game.releaseRef);
  report.releaseRef = after.releaseRef;
  report.checks.push(
    'Actual legacy save bound to preserved bytes, remained paused, retained both credentials, secret projections, snapshot and checkpoints; current signed release was not guessed',
  );
  const checkpoint = before.history.at(-1);
  await command(host.origin, host.socket, host.token, {
    type: 'rollback',
    checkpointId: checkpoint.id,
  });
  const rolled = save();
  assert.deepEqual(rolled.snapshot, checkpoint.before);
  assert.equal(rolled.releaseRef, after.releaseRef);
  assert.deepEqual(
    rolled.seats.map(({ id, tokenHash }) => ({ id, tokenHash })),
    before.seats.map(({ id, tokenHash }) => ({ id, tokenHash })),
  );
  await close();
  host = await boot();
  const restarted = await view(host.origin, host.token);
  assert.equal(restarted.game.releaseRef, after.releaseRef);
  assert.equal(restarted.paused, true);
  for (const player of players)
    assert.ok((await view(host.origin, player.token)).self.seatId);
  report.checks.push(
    'Rollback and native restart retained legacy release and independent player identities',
  );
  await close();
  report.result = 'passed';
  report.allOwnedProcessesStopped = true;
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  await close().catch(() => {});
  throw error;
} finally {
  await writeFile(
    join(evidence, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    result: report.result,
    checks: report.checks.length,
    evidence,
    work,
  }),
);
