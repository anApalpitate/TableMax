import { captureBrowserScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from '../../release/package-limits.mjs';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { launchDesktop } from '../support/desktop-test.mjs';
import { verificationOutput } from '../support/verification-output.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const args = process.argv.slice(2);
assert.ok(
  args.length <= 1 &&
    args.every((arg) => /^--evidence=[A-Za-z0-9][A-Za-z0-9-]*$/.test(arg)),
);
const output = verificationOutput(
  'test-silence',
  args[0]?.slice(11) ?? String(Date.now()),
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/desktop-verify-'));
const extracted = join(work, 'extracted');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
const manifest = JSON.parse(
  await readFile(archive.replace(/\.zip$/, '-manifest.json'), 'utf8'),
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(await readFile(archive)), manifest.archive.sha256);
await promisify(execFile)(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    'Expand-Archive -LiteralPath $env:TABLEMAX_VERIFY_ARCHIVE -DestinationPath $env:TABLEMAX_VERIFY_EXTRACT',
  ],
  {
    windowsHide: true,
    env: {
      ...process.env,
      TABLEMAX_VERIFY_ARCHIVE: archive,
      TABLEMAX_VERIFY_EXTRACT: extracted,
    },
  },
);
let extractedBytes = 0;
for (const file of manifest.files) {
  const bytes = await readFile(join(extracted, file.path));
  assert.equal(bytes.length, file.bytes, file.path);
  assert.equal(hash(bytes), file.sha256, file.path);
  extractedBytes += bytes.length;
}
assert.equal(extractedBytes, manifest.extractedBytes);
assert.ok(
  extractedBytes < PACKAGE_BUDGET_BYTES &&
    manifest.archive.bytes < MAXIMUM_PACKAGE_BYTES,
);
const report = {
  portable: true,
  archiveSha256: manifest.archive.sha256,
  result: 'started',
  extractedBytes,
  fileCount: manifest.files.length,
  checks: [],
  externalRequests: [],
  pageErrors: [],
};
let desktop, socket;
try {
  for (const soundEnabled of [false, true]) {
    const browser = await launchTestBrowser({
      channel: 'msedge',
      headless: true,
      ...(soundEnabled ? { soundEnabled: true } : {}),
      args: ['--enable-automation'],
    });
    try {
      const cdp = await browser.newBrowserCDPSession();
      const { arguments: flags } = await cdp.send(
        'Browser.getBrowserCommandLine',
      );
      assert.equal(flags.includes('--mute-audio'), !soundEnabled);
      await cdp.detach();
    } finally {
      await browser.close();
    }
  }
  report.checks.push(
    'Direct Edge verification launcher defaults to mute and supports explicit sound opt-in',
  );
  for (const soundEnabled of [false, true]) {
    const data = join(work, soundEnabled ? 'opt-in' : 'default');
    desktop = await launchDesktop({
      executablePath: join(extracted, 'TableMax.exe'),
      args: ['--tablemax-play-mode'],
      ...(soundEnabled ? { soundEnabled: true } : {}),
      env: {
        TABLEMAX_HOST: '127.0.0.1',
        TABLEMAX_PORT: '0',
        TABLEMAX_DATA_DIR: data,
        TABLEMAX_TEST_AUDIO: '1',
        TABLEMAX_WEB_DEV_URL: '',
        NODE_PATH: '',
      },
    });
    const host = await desktop.firstWindow();
    await host.waitForURL('**/host');
    const origin = new URL(host.url()).origin;
    const observe = (page) => {
      page.on('pageerror', (error) => report.pageErrors.push(error.message));
      page.on('request', (request) => {
        if (
          /^https?:/.test(request.url()) &&
          new URL(request.url()).origin !== origin
        )
          report.externalRequests.push(request.url());
      });
    };
    observe(host);
    const runtime = await desktop.request('runtime');
    assert.equal(runtime.versions.node, '22.14.0');
    assert.equal(runtime.packaged, true);
    assert.equal(runtime.appVersion, version);
    const publicState = await desktop.request('open-public');
    const phoneState = await desktop.request('new-window', {
      url: origin + '/player',
      width: 390,
      height: 844,
      managed: false,
      partition: 'silent-phone',
    });
    const windows = await desktop.request('windows');
    assert.equal(windows.length, 3);
    for (const state of windows) {
      assert.equal(state.audioMuted, !soundEnabled);
      assert.equal(state.visible, false);
    }
    assert.equal(publicState.audioMuted, !soundEnabled);
    assert.equal(phoneState.audioMuted, !soundEnabled);
    for (const page of desktop.windows()) if (page !== host) observe(page);
    report.checks.push(
      soundEnabled
        ? 'Explicit sound opt-in enables all three verification renderers (no audio is played)'
        : 'Default play-mode verification mutes host/public/phone despite inherited opt-in environment',
    );
    if (!soundEnabled) {
      const token = await host.evaluate(() =>
        sessionStorage.getItem('tablemax-host'),
      );
      const view = async () =>
        (
          await (
            await fetch(origin + '/api/session/view', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ token }),
            })
          ).json()
        ).view;
      socket = io(origin, {
        transports: ['websocket'],
        auth: { token },
        forceNew: true,
      });
      await new Promise((done, reject) => {
        socket.once('room:view', done);
        socket.once('connect_error', reject);
      });
      const send = async (command) => {
        const current = await view();
        const reply = await new Promise((done, reject) =>
          socket.timeout(5000).emit(
            'room:command',
            {
              actionId: randomUUID(),
              instanceId: current.instanceId,
              revision: current.revision,
              branch: current.branch,
              command,
            },
            (error, result) => (error ? reject(error) : done(result)),
          ),
        );
        assert.equal(reply.ok, true, JSON.stringify(reply));
      };
      await send({ type: 'select-game', gameId: 'power-grid' });
      await send({
        type: 'add-bot',
        name: '静音验证一',
        difficulty: 'default',
      });
      await send({
        type: 'add-bot',
        name: '静音验证二',
        difficulty: 'default',
      });
      await send({ type: 'start' });
      await send({ type: 'pause' });
      await host.goto(origin + '/host/game');
      const button = host.locator('[data-power-grid-sound]');
      await button.waitFor();
      assert.equal(await button.isDisabled(), true);
      assert.equal(await button.getAttribute('aria-pressed'), 'false');
      assert.equal((await button.innerText()).trim(), '声音关');
      const preference = await host.evaluate(() =>
        localStorage.getItem('tablemax-sound-muted'),
      );
      await send({ type: 'set-play-mode', mode: 'test' });
      await send({ type: 'resume' });
      await host.waitForFunction(
        () =>
          document.querySelector('[data-power-grid-sound]')?.disabled === true,
      );
      assert.equal(
        await host.evaluate(() => localStorage.getItem('tablemax-sound-muted')),
        preference,
      );
      await send({ type: 'set-play-mode', mode: 'play' });
      await host.waitForFunction(
        () =>
          document.querySelector('[data-power-grid-sound]')?.disabled === false,
      );
      assert.equal(
        await host.evaluate(() => localStorage.getItem('tablemax-sound-muted')),
        preference,
      );
      await send({ type: 'pause' });
      await captureBrowserScreenshot(host, {
        path: join(output, 'silent-power-grid.png'),
      });
      await host.reload();
      await button.waitFor();
      assert.ok(
        (await desktop.request('windows')).every((state) => state.audioMuted),
      );
      report.checks.push(
        'Production Power Grid button is disabled/off in test and pause; play restores the unchanged preference; renderer remains muted after reload',
      );
      socket.close();
      socket = null;
    }
    await desktop.close();
    desktop = null;
  }
  assert.deepEqual(report.externalRequests, []);
  assert.deepEqual(report.pageErrors, []);
  report.checks.push(
    'Same ZIP extracted file hashes, local Node, offline requests and complete desktop exit verified',
  );
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = String(error.stack ?? error);
  throw error;
} finally {
  socket?.close();
  await desktop?.close();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    result: report.result,
    checks: report.checks.length,
    archiveSha256: report.archiveSha256,
    extractedBytes,
  }),
);
