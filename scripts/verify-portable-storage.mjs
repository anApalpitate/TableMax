import assert from 'node:assert/strict';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  stat,
  readdir,
} from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { launchDesktop } from './desktop-test.mjs';
import { assertReleaseIdle } from './release-executable.mjs';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const evidenceName =
  process.argv.find((value) => value.startsWith('--evidence='))?.slice(11) ??
  'portable-storage';
assert.match(evidenceName, /^[a-z0-9-]{1,48}$/);
const output = resolve('artifacts/maintenance', `v${version}`, evidenceName);
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/portable-storage-'));
const extracted = join(work, 'extracted');
const run = promisify(execFile);
const shipping = resolve(`artifacts/releases/TableMax-${version}-win-x64.exe`);
const manifest = JSON.parse(
  await readFile(
    `artifacts/releases/TableMax-${version}-win-x64-manifest.json`,
    'utf8',
  ),
);
const env = {
  ...process.env,
  TABLEMAX_HOST: '127.0.0.1',
  TABLEMAX_PORT: '0',
  TABLEMAX_TEST_AUDIO: '0',
};
delete env.TABLEMAX_DATA_DIR;
delete env.TABLEMAX_BOX_DIRECTORY;
delete process.env.TABLEMAX_DATA_DIR;
delete process.env.TABLEMAX_BOX_DIRECTORY;
await run(shipping, [`--extract-only=${extracted}`], {
  windowsHide: true,
  timeout: 120000,
  env,
});
const hash = async (path) => {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
};
const report = {
  result: 'running',
  portable: true,
  archiveSha256: manifest.archive.sha256,
  work,
  checks: [],
  allOwnedProcessesStopped: false,
};
let desktop;
try {
  const boot = (extra = {}) =>
    launchDesktop({
      executablePath: join(extracted, 'TableMax.exe'),
      args: ['--foundation-test'],
      env: { ...env, ...extra },
      timeout: 1800000,
    });
  desktop = await boot();
  await assert.rejects(
    assertReleaseIdle(join(extracted, 'blocked-export.exe')),
    /busy/,
  );
  report.checks.push(
    'release target guard refuses an active native program in the output directory',
  );
  const info = await desktop.request('storage.info');
  assert.equal(info.active.toLowerCase(), extracted.toLowerCase());
  assert.equal(info.configured.toLowerCase(), extracted.toLowerCase());
  assert.deepEqual(JSON.parse(await readFile(info.configPath, 'utf8')), {
    dataDirectory: '.',
  });
  await stat(join(extracted, 'room.sqlite'));
  await stat(join(extracted, 'desktop/webview2'));
  const custom = join(work, 'custom-data');
  await desktop.request('storage.set', { directory: custom });
  assert.equal((await desktop.request('storage.info')).active, info.active);
  await desktop.close();
  desktop = undefined;
  const before = await hash(join(extracted, 'room.sqlite'));
  desktop = await boot();
  assert.equal(
    (await desktop.request('storage.info')).active.toLowerCase(),
    custom.toLowerCase(),
  );
  await desktop.close();
  desktop = undefined;
  assert.equal(await hash(join(extracted, 'room.sqlite')), before);
  report.checks.push(
    'native defaults to EXE sibling and writes explicit config',
    'custom directory applies on restart',
    'old save retained byte-for-byte',
    'WebView2 cache uses selected directory',
  );

  const box = join(work, 'single-exe');
  await mkdir(box);
  const launcher = join(box, 'TableMax.exe');
  await copyFile(shipping, launcher);
  await run(launcher, ['--foundation-check'], {
    windowsHide: true,
    timeout: 180000,
    env,
  });
  const boxRoot = join(box, 'TableMax');
  assert.deepEqual(
    JSON.parse(await readFile(join(boxRoot, 'TableMax.config.json'), 'utf8')),
    { dataDirectory: '.' },
  );
  await stat(join(boxRoot, 'room.sqlite'));
  await stat(join(boxRoot, 'desktop/webview2'));
  await stat(join(boxRoot, 'app/node.exe'));
  assert.deepEqual((await readdir(box)).sort(), ['TableMax', 'TableMax.exe']);
  const firstRuntimeWrite = (await stat(join(boxRoot, 'app/node.exe'))).mtimeMs;
  await run(launcher, ['--foundation-check'], {
    windowsHide: true,
    timeout: 180000,
    env,
  });
  assert.equal(
    (await stat(join(boxRoot, 'app/node.exe'))).mtimeMs,
    firstRuntimeWrite,
  );
  assert.deepEqual((await readdir(box)).sort(), ['TableMax', 'TableMax.exe']);
  const configured = join(work, 'launcher-custom');
  await writeFile(
    join(boxRoot, 'TableMax.config.json'),
    JSON.stringify({ dataDirectory: configured }),
  );
  await run(launcher, ['--foundation-check'], {
    windowsHide: true,
    timeout: 180000,
    env,
  });
  await stat(join(configured, 'room.sqlite'));
  report.checks.push(
    'single EXE creates one dedicated sibling TableMax folder for config and data',
    'single EXE runtime and browser cache stay inside dedicated folder',
    'repeat initialization reuses resources without loose sibling files',
    'shipping EXE honors custom configuration',
  );

  const source = process.argv
    .find((value) => value.startsWith('--source='))
    ?.slice(9);
  if (source) {
    const original = join(resolve(source), 'room.sqlite');
    const wal = join(resolve(source), 'room.sqlite-wal');
    try {
      assert.equal(
        (await stat(wal)).size,
        0,
        'Only copy an idle checkpointed original',
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const data = join(work, 'legacy-copy');
    await mkdir(data);
    const originalHash = await hash(original);
    await copyFile(original, join(data, 'room.sqlite'));
    assert.equal(await hash(join(data, 'room.sqlite')), originalHash);
    await writeFile(
      join(extracted, 'TableMax.config.json'),
      JSON.stringify({ dataDirectory: data }),
    );
    const started = performance.now();
    desktop = await boot();
    const elapsed = Math.round(performance.now() - started);
    const page = await desktop.firstWindow();
    await page.locator('.connection.online').waitFor();
    await desktop.close();
    desktop = undefined;
    const database = new DatabaseSync(join(data, 'room.sqlite'), {
      readOnly: true,
    });
    assert.equal(database.prepare('PRAGMA user_version').get().user_version, 2);
    assert.equal(
      database.prepare('PRAGMA quick_check').get().quick_check,
      'ok',
    );
    const revisions = database
      .prepare('SELECT count(*) AS n FROM journal')
      .get().n;
    database.close();
    const backup = (await readdir(data)).find((name) =>
      name.startsWith('room-v1-backup-'),
    );
    assert.ok(backup);
    assert.equal(await hash(join(data, backup, 'room.sqlite')), originalHash);
    assert.equal(await hash(original), originalHash);
    desktop = await boot();
    await desktop.close();
    desktop = undefined;
    report.legacy = {
      originalBytes: (await stat(original)).size,
      originalSha256: originalHash,
      startupMs: elapsed,
      migratedBytes: (await stat(join(data, 'room.sqlite'))).size,
      revisions,
      originalUnchanged: true,
      backupExact: true,
      restartPassed: true,
    };
    report.checks.push(
      'actual large v1 save copy migrates past 20 seconds and restarts',
      'original and retained migration backup hashes unchanged',
    );
  }
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.failure = error.message;
  throw error;
} finally {
  if (desktop) await desktop.close();
  report.allOwnedProcessesStopped = true;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(JSON.stringify(report));
