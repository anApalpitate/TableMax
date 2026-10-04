import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';
import { verificationOutput } from './verification-output.mjs';

const portable = process.argv.includes('--portable');
const evidenceName = process.argv
  .find((value) => value.startsWith('--evidence='))
  ?.slice(11);
assert.ok(
  !evidenceName || /^[a-z0-9-]{1,48}$/.test(evidenceName),
  'Safe evidence name',
);
const executableArgument = process.argv.find((value) =>
  value.startsWith('--executable='),
);
const executablePath = executableArgument
  ? resolve(executableArgument.slice('--executable='.length))
  : desktopExecutable;
if (portable && !executableArgument)
  throw new Error('Portable safety requires the actual extracted executable');
const output = verificationOutput(
  'webview2',
  evidenceName ?? (portable ? 'safety-portable' : 'safety'),
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const dataDir = await mkdtemp(resolve('tmp/desktop-verify-'));
const env = {
  ...process.env,
  TABLEMAX_DATA_DIR: dataDir,
  TABLEMAX_HOST: '127.0.0.1',
  TABLEMAX_PORT: '0',
};
delete env.TABLEMAX_WEB_DEV_URL;
delete env.NODE_PATH;
delete env.ELECTRON_RUN_AS_NODE;
if (portable)
  env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
const evidence = {
  startedAt: new Date().toISOString(),
  portable,
  executablePath,
  checks: [],
  result: 'started',
};
if (portable) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const manifest = JSON.parse(
    await readFile(
      `artifacts/releases/TableMax-${version}-win-x64-manifest.json`,
      'utf8',
    ),
  );
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const archiveSha256 = hash(
    await readFile(join('artifacts/releases', manifest.archive.name)),
  );
  assert.equal(archiveSha256, manifest.archive.sha256);
  const executableSha256 = hash(await readFile(executablePath));
  assert.equal(
    executableSha256,
    manifest.files.find((file) => file.path === 'TableMax.exe').sha256,
  );
  evidence.archiveSha256 = archiveSha256;
  evidence.executableSha256 = executableSha256;
}
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(predicate, description, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await wait(100);
  }
  throw new Error(description);
}
async function stopped(origin) {
  await until(async () => {
    try {
      await fetch(origin + '/api/foundation/health', {
        signal: AbortSignal.timeout(400),
      });
      return false;
    } catch {
      return true;
    }
  }, 'Independent service did not stop');
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}
async function raw(args, overrides = {}) {
  const child = spawn(executablePath, args, {
    env: { ...env, ...overrides },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  const timeout = setTimeout(() => child.kill(), 30000);
  try {
    const [code] = await once(child, 'exit');
    return { code, stdout, stderr };
  } finally {
    clearTimeout(timeout);
  }
}
let desktop;
try {
  const missing = await raw(['--foundation-test'], {
    TABLEMAX_TEST_WEBVIEW_MISSING: '1',
  });
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /WebView2/i);
  assert.equal(missing.stdout.includes('desktop-ready'), false);
  evidence.checks.push(
    'Missing runtime fails without starting service or requiring an interactive dialog',
  );

  desktop = await launchDesktop({
    executablePath,
    env,
    args: ['--foundation-test', '--tablemax-test-mode'],
    timeout: 45000,
  });
  const host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  await host.locator('.connection.online').waitFor();
  const origin = new URL(host.url()).origin;
  const nativeRuntime = await desktop.request('runtime');
  assert.equal(nativeRuntime.packaged, portable);
  evidence.webview2Version = nativeRuntime.versions.webview2;
  assert.equal(desktop.startup.hostToken, undefined);
  const health = await (await fetch(origin + '/api/foundation/health')).json();
  assert.equal(health.runtime.node, '22.14.0');
  assert.equal(health.runtime.electron, null);
  evidence.runtime = health.runtime;
  evidence.checks.push(
    'Bundled Node and private administrator credential handoff',
  );
  assert.equal(
    await host.evaluate(() => !!sessionStorage.getItem('tablemax-host')),
    true,
  );

  await host.evaluate(() => history.pushState(null, '', '/host/game'));
  await host.evaluate(() => window.tablemaxDisplay.read());
  assert.equal(
    typeof (await host.evaluate(() => window.tablemaxWindow.read())).fullscreen,
    'boolean',
  );
  assert.equal(await host.evaluate(() => window.tablemaxAudio.connect()), true);
  assert.equal(
    await host.evaluate(() => window.tablemaxAudio.claimEvent('safety-spa')),
    true,
  );
  await host.evaluate(() => history.pushState(null, '', '/player/game'));
  await assert.rejects(host.evaluate(() => window.tablemaxDisplay.read()));
  await assert.rejects(host.evaluate(() => window.tablemaxWindow.read()));
  await assert.rejects(
    host.evaluate(() => window.tablemaxWindow.setFullscreen(true)),
  );
  await assert.rejects(
    host.evaluate(() => window.tablemaxAudio.claimEvent('safety-player')),
  );
  await host.evaluate(() => history.pushState(null, '', '/host'));
  await host.evaluate(() => window.tablemaxAudio.disconnect());
  evidence.checks.push(
    'Same-document game navigation retains authorized bridge and rejects a phone role',
  );

  await assert.rejects(desktop.request('unrecognized-method'));
  await assert.rejects(host.evaluate(() => window.tablemaxWindow.read(true)));
  await assert.rejects(
    host.evaluate(() => window.tablemaxWindow.setFullscreen('true')),
  );
  await assert.rejects(
    host.evaluate(() => window.tablemaxWindow.setFullscreen(true, false)),
  );
  const beforeWindow = await host.evaluate(() => window.tablemaxWindow.read());
  await assert.rejects(host.evaluate(() => window.tablemaxDisplay.read(true)));
  await assert.rejects(
    host.evaluate(() =>
      window.tablemaxDisplay.update({
        resolution: 'auto',
        interfaceScale: 101,
      }),
    ),
  );
  await assert.rejects(
    host.evaluate(() =>
      window.tablemaxDisplay.update({
        resolution: 'auto',
        interfaceScale: 100,
        extra: true,
      }),
    ),
  );
  const before = await host.evaluate(() => window.tablemaxDisplay.read());
  await host.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'security-frame';
    frame.srcdoc = '<p>Frame</p>';
    document.body.append(frame);
  });
  await until(
    () => Promise.resolve(host.frames().length > 1),
    'Test iframe missing',
  );
  assert.equal(
    await host.frames()[1].evaluate(() => typeof window.tablemaxWindow),
    'undefined',
  );
  await host.frames()[1].evaluate(() => {
    window.chrome?.webview?.postMessage({
      id: 99998,
      method: 'window.setFullscreen',
      params: [true],
    });
    window.chrome?.webview?.postMessage({
      id: 99999,
      method: 'display.update',
      params: [{ resolution: 'auto', interfaceScale: 150 }],
    });
  });
  await wait(250);
  assert.deepEqual(
    (await host.evaluate(() => window.tablemaxDisplay.read())).preferences,
    before.preferences,
  );
  assert.deepEqual(
    await host.evaluate(() => window.tablemaxWindow.read()),
    beforeWindow,
  );
  await host.evaluate(() => document.getElementById('security-frame').remove());
  evidence.checks.push(
    'Unknown IPC, malformed display options and child-frame mutation rejected',
  );

  await host.goto(origin + '/player');
  await assert.rejects(host.evaluate(() => window.tablemaxDisplay.read()));
  await host.goto(origin + '/host');
  await host.locator('.connection.online').waitFor();
  evidence.checks.push('Managed desktop bridge rejects a phone route');

  const duplicate = await raw(['--foundation-test']);
  assert.equal(duplicate.code, 0);
  assert.equal(duplicate.stdout.includes('desktop-ready'), false);
  assert.equal(
    (await (await fetch(origin + '/api/foundation/health')).json()).starts,
    health.starts,
  );
  evidence.checks.push(
    'Duplicate instance reopens management without another service',
  );

  await host.screenshot({ path: join(output, 'actual-host.png') });
  await desktop.close();
  desktop = undefined;
  await stopped(origin);
  evidence.checks.push(
    'Background actual WebView2 screenshot and graceful shutdown',
  );

  const forbiddenCache = join(dataDir, 'inherited-cache-must-not-exist');
  const check = await raw(['--foundation-check'], {
    TABLEMAX_TEST_CDP_PORT: '9222',
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222',
    WEBVIEW2_USER_DATA_FOLDER: forbiddenCache,
    WEBVIEW2_WAIT_FOR_SCRIPT_DEBUGGER: '1',
    ...(portable ? { TABLEMAX_WEB_DEV_URL: 'http://127.0.0.1:9' } : {}),
    NODE_OPTIONS: '--inspect=9229',
  });
  assert.equal(check.code, 0, check.stderr);
  const checkRecord = JSON.parse(
    await readFile(join(dataDir, 'desktop-check.json'), 'utf8'),
  );
  assert.equal(checkRecord.health.runtime.electron, null);
  assert.equal(checkRecord.cdpPort, 0);
  assert.equal(check.stdout.includes('cdpPort'), false);
  await assert.rejects(access(forbiddenCache));
  evidence.checks.push(
    'Production check ignores test CDP and inherited WebView2 overrides and exits normally',
  );

  desktop = await launchDesktop({ executablePath, env, timeout: 45000 });
  const crashOrigin = desktop.startup.origin;
  const serviceExit = once(desktop.process(), 'exit');
  process.kill(desktop.startup.servicePid, 'SIGKILL');
  await until(
    () => desktop.process().exitCode !== null,
    'Service crash did not close desktop',
  );
  const [crashCode] = await serviceExit;
  assert.notEqual(crashCode, 0);
  await stopped(crashOrigin);
  await desktop.close();
  desktop = undefined;
  evidence.checks.push(
    'Independent service crash closes the desktop with a failure status',
  );

  desktop = await launchDesktop({ executablePath, env, timeout: 45000 });
  const orphanPid = desktop.startup.servicePid;
  const orphanOrigin = desktop.startup.origin;
  const parentExit = once(desktop.process(), 'exit');
  desktop.process().kill('SIGKILL');
  await parentExit;
  await until(
    () => !alive(orphanPid),
    'Job Object left a Node process after parent crash',
  );
  await stopped(orphanOrigin);
  await desktop.close();
  desktop = undefined;
  evidence.checks.push(
    'Parent crash releases Job Object and terminates bundled Node',
  );
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = error.stack;
  throw error;
} finally {
  await desktop?.close().catch(() => undefined);
  evidence.completedAt = new Date().toISOString();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: evidence.result,
      checks: evidence.checks,
      output,
    }),
  );
}
