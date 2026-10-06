import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { launchDesktop } from './desktop-test.mjs';
import { decodeSave, readCurrentSave } from './lib/save-audit.mjs';

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const evidenceName = process.argv[2];
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
assert.equal(process.argv.length, 3);
assert.match(evidenceName, /^[a-zA-Z0-9_-]+$/);
const output = resolve(
  `artifacts/maintenance/v${version}/pokemon-final-revision/storage`,
  evidenceName,
);
await mkdir(resolve(output, '..'), { recursive: true });
await mkdir(output, { recursive: false });
const manifest = JSON.parse(
  await readFile(
    `artifacts/releases/TableMax-${version}-win-x64-manifest.json`,
    'utf8',
  ),
);
const archive = resolve('artifacts/releases', manifest.archive.name);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(await readFile(archive)), manifest.archive.sha256);
const work = await mkdtemp(resolve('tmp/portable-storage-games-'));
const extracted = join(work, 'extracted');
await promisify(execFile)(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    'Expand-Archive -LiteralPath $env:TABLEMAX_STORAGE_ZIP -DestinationPath $env:TABLEMAX_STORAGE_EXTRACT',
  ],
  {
    windowsHide: true,
    env: {
      ...process.env,
      TABLEMAX_STORAGE_ZIP: archive,
      TABLEMAX_STORAGE_EXTRACT: extracted,
    },
  },
);
for (const file of manifest.files)
  assert.equal(hash(await readFile(join(extracted, file.path))), file.sha256);
const report = {
  result: 'running',
  archiveSha256: manifest.archive.sha256,
  scope:
    'Same final ZIP, actual hidden native/service, real bot-authorized saved actions. v1 fixtures are reconstructed only from these valid isolated v2 saves, then migrated by the actual packaged server. No formal user data or physical devices.',
  games: [],
  externalRequests: [],
  pageErrors: [],
  allOwnedProcessesStopped: false,
};
let desktop, socket, origin, token;
async function view() {
  const reply = await (
    await fetch(`${origin}/api/session/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  ).json();
  assert.equal(reply.ok, true);
  return reply.view;
}
async function boot(dataDir) {
  desktop = await launchDesktop({
    executablePath: join(extracted, 'TableMax.exe'),
    args: ['--foundation-test', '--tablemax-test-mode'],
    env: {
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_DATA_DIR: dataDir,
      PATH: `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`,
      NODE_PATH: '',
    },
  });
  const host = await desktop.firstWindow();
  await host.waitForURL('**/host**');
  origin = new URL(host.url()).origin;
  host.on('pageerror', (error) => report.pageErrors.push(error.message));
  host.on('request', (request) => {
    if (new URL(request.url()).origin !== origin)
      report.externalRequests.push(request.url());
  });
  await host.locator('.connection.online').waitFor();
  token = await host.evaluate(() => sessionStorage.getItem('tablemax-host'));
  assert.ok(token);
  socket = io(origin, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
}
async function command(value) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const current = await view();
    const reply = await new Promise((done, reject) =>
      socket.timeout(8000).emit(
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
    if (
      !reply.ok &&
      reply.reason === 'stale-revision' &&
      value.type === 'pause'
    )
      continue;
    assert.equal(reply.ok, true, JSON.stringify(reply));
    return view();
  }
  throw new Error('pause-revision-retry-exhausted');
}
async function stop() {
  socket?.disconnect();
  socket = undefined;
  await desktop?.close();
  desktop = undefined;
}
try {
  for (const [game, seats] of [
    ['pokemon-encounters', 2],
    ['modern-art', 3],
    ['power-grid', 2],
  ]) {
    const fresh = join(work, `${game}-fresh`);
    await boot(fresh);
    await command({ type: 'select-game', gameId: game });
    if (game === 'pokemon-encounters')
      await command({ type: 'select-variant', variantId: 'expansion' });
    for (let i = 0; i < seats; i++)
      await command({
        type: 'add-bot',
        name: `恢复验收${i + 1}`,
        difficulty: 'default',
      });
    const started = await command({ type: 'start' });
    const limit = performance.now() + 10000;
    while (
      (await view()).revision <= started.revision &&
      performance.now() < limit
    )
      await new Promise((done) => setTimeout(done, 30));
    assert.ok(
      (await view()).revision > started.revision,
      `${game}: at least one real saved bot action`,
    );
    await command({ type: 'pause' });
    const before = (await view()).gameView;
    await stop();
    const source = new DatabaseSync(join(fresh, 'room.sqlite'), {
      readOnly: true,
    });
    const save = readCurrentSave(source);
    const journal = source
      .prepare('SELECT data FROM journal ORDER BY rowid')
      .all()
      .map((row) => decodeSave(source, row.data));
    const legacyDir = join(work, `${game}-legacy`);
    await mkdir(legacyDir);
    const legacyPath = join(legacyDir, 'room.sqlite');
    const legacy = new DatabaseSync(legacyPath);
    legacy.exec(
      'CREATE TABLE saves(id INTEGER PRIMARY KEY,data TEXT NOT NULL) STRICT; CREATE TABLE journal(instance TEXT,revision INTEGER,data TEXT,PRIMARY KEY(instance,revision)) STRICT; CREATE TABLE avatar_images(id TEXT PRIMARY KEY,png BLOB NOT NULL) STRICT; PRAGMA user_version=1;',
    );
    legacy.prepare('INSERT INTO saves VALUES(1,?)').run(JSON.stringify(save));
    for (const row of journal)
      legacy
        .prepare('INSERT INTO journal VALUES(?,?,?)')
        .run(row.instanceId, row.revision, JSON.stringify(row));
    for (const row of source.prepare('SELECT id,png FROM avatar_images').all())
      legacy
        .prepare('INSERT INTO avatar_images VALUES(?,?)')
        .run(row.id, row.png);
    source.close();
    legacy.close();
    const originalHash = hash(await readFile(legacyPath));
    await boot(legacyDir);
    const restored = await view();
    assert.equal(restored.paused, true);
    assert.equal(restored.game.id, game);
    assert.deepEqual(restored.gameView, before);
    assert.deepEqual(
      restored.seats.map((seat) => seat.id),
      save.seats.map((seat) => seat.id),
    );
    await stop();
    const migrated = new DatabaseSync(legacyPath, { readOnly: true });
    assert.equal(migrated.prepare('PRAGMA user_version').get().user_version, 2);
    assert.deepEqual(readCurrentSave(migrated).snapshot, save.snapshot);
    for (const row of journal) {
      const stored = migrated
        .prepare('SELECT data FROM journal WHERE instance=? AND revision=?')
        .get(row.instanceId, row.revision);
      assert.deepEqual(decodeSave(migrated, stored.data), row);
    }
    migrated.close();
    const backup = (await readdir(legacyDir)).find((name) =>
      name.startsWith('room-v1-backup-'),
    );
    assert.ok(backup);
    assert.equal(
      hash(await readFile(join(legacyDir, backup, 'room.sqlite'))),
      originalHash,
    );
    await boot(legacyDir);
    assert.deepEqual((await view()).gameView, before);
    await stop();
    const samples = join(output, 'migration-samples', game);
    await mkdir(samples, { recursive: true });
    const sampleFiles = [];
    for (const [name, source] of [
      ['original-v1.sqlite', join(legacyDir, backup, 'room.sqlite')],
      ['migrated-v2.sqlite', legacyPath],
      ['fresh-v2.sqlite', join(fresh, 'room.sqlite')],
    ]) {
      const target = join(samples, name);
      await copyFile(source, target);
      const sha256 = hash(await readFile(source));
      assert.equal(hash(await readFile(target)), sha256);
      sampleFiles.push({ path: target, sha256 });
    }
    report.games.push({
      game,
      seats,
      journalRevisions: journal.length,
      snapshotAndSeatIdsRestored: true,
      originalV1Sha256: originalHash,
      v1BackupIdentical: true,
      allHistoricalRevisionsIdentical: true,
      v2ReopenIdentical: true,
      retainedMigrationSamples: sampleFiles,
    });
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.externalRequests, []);
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  throw error;
} finally {
  await stop();
  report.allOwnedProcessesStopped = true;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  process.stdout.write(
    JSON.stringify({
      result: report.result,
      games: report.games.length,
      output,
    }) + '\n',
  );
}
