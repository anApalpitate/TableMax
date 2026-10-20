import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { assertWorkspaceRoot } from '../shared/workspace-root.mjs';
import { createDevelopmentSession } from './session.mjs';

assertWorkspaceRoot();
assert.equal(
  process.platform,
  'win32',
  'This check exercises the actual Windows dev entry',
);
const evidence = await mkdtemp(resolve('artifacts/maintenance/dev-session-'));
const box = join(evidence, 'old-box');
const external = join(evidence, 'external-data');
const sessions = [];
await mkdir(box);
await mkdir(external);
const config = JSON.stringify({ dataDirectory: external });
await writeFile(join(box, 'TableMax.config.json'), config);
await writeFile(join(box, 'foundation.sqlite'), 'Old state must not be read');
await writeFile(
  join(external, 'foundation.sqlite'),
  'External state must not be read',
);
const report = { passed: false, sessions, files: {} };
for (const file of [
  'tools/dev/dev.mjs',
  'tools/dev/session.mjs',
  'tools/dev/verify-session.mjs',
  'build/desktop/TableMax.exe',
])
  report.files[file] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');

async function launch(index) {
  // Use the real native entry without replacing an EXE another session uses.
  const session = await createDevelopmentSession({
    ...process.env,
    TABLEMAX_BOX_DIRECTORY: box,
    TABLEMAX_DATA_DIR: external,
  });
  const child = spawn(
    resolve('build/desktop/TableMax.exe'),
    ['--foundation-test'],
    {
      windowsHide: true,
      env: {
        ...session.env,
        TABLEMAX_HOST: '127.0.0.1',
        TABLEMAX_PORT: '0',
        TABLEMAX_TEST_AUDIO: '0',
        TABLEMAX_PACKAGED: '0',
        TABLEMAX_WEB_DEV_URL: undefined,
        TABLEMAX_AUTO_MAINTENANCE: '0',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  let log = '',
    sequence = 0,
    readyResolve,
    readyReject;
  const pending = new Map();
  const ready = new Promise((done, reject) => {
    readyResolve = done;
    readyReject = reject;
  });
  const exit = new Promise((done) => child.once('close', done));
  const lines = createInterface({ input: child.stdout });
  child.stderr.on('data', (chunk) => {
    log += chunk;
  });
  child.stdout.on('data', (chunk) => {
    log += chunk;
  });
  child.once('error', readyReject);
  child.once('close', (code) => {
    const error = new Error('Development entry exited: ' + code);
    readyReject(error);
    for (const item of pending.values()) item.reject(error);
    pending.clear();
  });
  lines.on('line', (line) => {
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      return;
    }
    if (value.type === 'desktop-ready') readyResolve(value);
    const item = pending.get(value.id);
    if (!item) return;
    pending.delete(value.id);
    if (value.error) item.reject(new Error(value.error));
    else item.done(value.result);
  });
  function request(method) {
    return new Promise((done, reject) => {
      const id = ++sequence;
      pending.set(id, { done, reject });
      child.stdin.write(JSON.stringify({ id, method, params: {} }) + '\n');
    });
  }
  const deadline = setTimeout(() => {
    readyReject(new Error('Development startup timed out'));
    child.kill();
  }, 60000);
  try {
    await ready;
    const storage = await request('storage.info');
    const runtime = await request('runtime');
    assert.equal(runtime.health.starts, 1);
    assert.equal(dirname(storage.active), join(box, 'sessions'));
    assert.equal(
      storage.configPath,
      join(storage.active, 'TableMax.config.json'),
    );
    assert.ok(!sessions.some((prior) => prior.active === storage.active));
    assert.ok(
      (await readdir(join(storage.active, 'desktop/webview2'))).length > 0,
    );
    assert.equal(
      await readFile(join(storage.active, 'TableMax.config.json'), 'utf8'),
      '{"dataDirectory":"."}\n',
    );
    sessions.push({
      active: storage.active,
      health: runtime.health,
      origin: runtime.origin,
    });
    await writeFile(
      join(storage.active, 'desktop/webview2/previous-session'),
      'history',
    );
    await request('quit');
    assert.equal(await exit, 0);
    await session.dispose();
    assert.deepEqual(await readdir(join(box, 'sessions')), []);
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null) {
      child.stdin.end();
      child.kill();
      await exit;
    }
    lines.close();
    await writeFile(join(evidence, `launch-${index}.log`), log);
    await session.dispose();
  }
}

try {
  await launch(1);
  await launch(2);
  assert.equal(
    await readFile(join(box, 'TableMax.config.json'), 'utf8'),
    config,
  );
  assert.equal(
    await readFile(join(box, 'foundation.sqlite'), 'utf8'),
    'Old state must not be read',
  );
  assert.equal(
    await readFile(join(external, 'foundation.sqlite'), 'utf8'),
    'External state must not be read',
  );
  report.passed = true;
} finally {
  await writeFile(
    join(evidence, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(join(evidence, 'report.json'));
}
