import {
  captureBrowserScreenshot,
  saveVerificationScreenshot,
} from '../../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';
import {
  desktopExecutable,
  launchDesktop,
} from '../../support/desktop-test.mjs';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const captureRules = process.argv.includes('--capture-rules');
const portable = process.argv.includes('--portable');
const seats = Number(
  process.argv.find((a) => a.startsWith('--seats='))?.slice(8) ?? 5,
);
assert.ok(seats === 4 || seats === 5);
const name =
  process.argv.find((a) => a.startsWith('--run='))?.slice(6) ??
  (portable ? 'portable' : 'source');
assert.match(name, /^[a-z0-9-]{1,48}$/);
const output = resolve(
  'artifacts/maintenance/v1.0.2/modern-art-debug-20261004',
  ...(portable ? ['delivery'] : []),
  name,
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/modern-art-polish-'));
const evidence = {
  startedAt: new Date().toISOString(),
  work,
  captureRules,
  portable,
  seats,
  checks: [],
  runtimes: [],
  screenshots: [],
  pageErrors: [],
};
const start = performance.now();
const verifierSource = await readFile(new URL(import.meta.url));
evidence.verifierSha256 = createHash('sha256')
  .update(verifierSource)
  .digest('hex');
await writeFile(join(output, 'verifier-start-source.mjs'), verifierSource);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
let executablePath = desktopExecutable;
if (portable) {
  const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
  const extracted = join(work, 'portable');
  const archiveBytes = await readFile(archive);
  evidence.archive = archive;
  evidence.archiveBytes = archiveBytes.length;
  evidence.archiveSha256 = createHash('sha256')
    .update(archiveBytes)
    .digest('hex');
  evidence.extractedDir = extracted;
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      '$ErrorActionPreference = "Stop"; Expand-Archive -LiteralPath $env:TABLEMAX_DEBUG_ARCHIVE -DestinationPath $env:TABLEMAX_DEBUG_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_DEBUG_ARCHIVE: archive,
        TABLEMAX_DEBUG_EXTRACT: extracted,
      },
    },
  );
  executablePath = join(extracted, 'TableMax.exe');
}
evidence.executablePath = executablePath;
const compiled = join(work, 'prepare.cjs');
await build({
  entryPoints: ['tools/test/fixtures/prepare-modern-art-polish.ts'],
  outfile: compiled,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'silent',
});
const { prepare } = require(compiled);
const fixture = await prepare(work, seats);
let desktop, origin, host, phone, hostToken;
const sockets = [];
async function view(token = '') {
  const result = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(result.ok, true);
  return result.view;
}
async function send(token, command) {
  const current = await view(token);
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: { token },
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  const reply = await new Promise((done, reject) =>
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: current.instanceId,
        branch: current.branch,
        revision: current.revision,
        command,
      },
      (error, result) => (error ? reject(error) : done(result)),
    ),
  );
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return reply;
}
async function resize(page, width, height, mobile = false, zoom = 1) {
  const win = await desktop.browserWindow(page);
  await win.evaluate(
    (w, args) => {
      w.setContentSize(args.width, args.height);
      w.webContents.setZoomFactor(args.zoom);
    },
    { width, height, zoom },
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: Math.round(width / zoom),
    height: Math.round(height / zoom),
    deviceScaleFactor: 1,
    mobile,
  });
  await cdp.detach();
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
}
async function shot(page, label, selector) {
  const path = join(output, label + '.png');
  if (selector)
    await captureBrowserScreenshot(page.locator(selector), { path });
  else {
    const win = await desktop.browserWindow(page);
    const bytes = await win.evaluate(async (w) =>
      (await w.webContents.capturePage()).toPNG().toString('base64'),
    );
    await saveVerificationScreenshot(path, Buffer.from(bytes, 'base64'));
  }
  evidence.screenshots.push(path);
  return path;
}
async function captureAsset(page, selector, assetName) {
  if (!captureRules) return;
  const dir = resolve('assets/games/modern-art/rules');
  await mkdir(dir, { recursive: true });
  const path = join(dir, assetName + '.png');
  await page.locator(selector).first().screenshot({ path });
  evidence.screenshots.push(path);
}
async function startCase(id) {
  const entry = fixture.cases.find((c) => c.id === id);
  assert.ok(entry, id);
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: entry.dataDir,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  delete env.NODE_PATH;
  if (portable)
    env.PATH = process.env.SystemRoot + '\\system32;' + process.env.SystemRoot;
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-play-mode'],
    env,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  const runtime = await desktop.request('runtime');
  assert.equal(runtime.packaged, portable);
  assert.equal(runtime.appVersion, version);
  assert.equal(runtime.versions.node, '22.14.0');
  const windows = await desktop.request('windows');
  assert.ok(windows.every((w) => !w.visible && w.rendered));
  const runtimeEvidence = { id, runtime, windows };
  if (portable) {
    const { stdout } = await promisify(execFile)(
      join(
        process.env.SystemRoot,
        'System32/WindowsPowerShell/v1.0/powershell.exe',
      ),
      [
        '-NoProfile',
        '-Command',
        '$ErrorActionPreference = "Stop"; (Get-Process -Id ([int]$env:TABLEMAX_DEBUG_SERVICE_PID)).Path',
      ],
      {
        windowsHide: true,
        env: {
          ...process.env,
          TABLEMAX_DEBUG_SERVICE_PID: String(runtime.servicePid),
        },
      },
    );
    runtimeEvidence.serviceExecutable = stdout.trim();
    assert.equal(
      resolve(runtimeEvidence.serviceExecutable).toLowerCase(),
      resolve(evidence.extractedDir, 'node.exe').toLowerCase(),
    );
  }
  evidence.runtimes.push(runtimeEvidence);
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  await host.goto(origin + '/host/game');
  await host.locator('.ma-screen').waitFor();
  let token = fixture.players[0].token;
  for (const p of fixture.players)
    if ((await view(p.token)).decisionId) {
      token = p.token;
      break;
    }
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, args) => {
      const w = new BrowserWindow({
        show: false,
        width: 390,
        height: 844,
        webPreferences: { partition: 'persist:' + args.id, offscreen: true },
      });
      void w.loadURL(args.url);
    },
    { id: randomUUID(), url: origin + '/player' },
  );
  phone = await next;
  await phone.waitForURL('**/player');
  await phone.evaluate(
    (token) => localStorage.setItem('tablemax-player', token),
    token,
  );
  await phone.goto(origin + '/player/game');
  await phone.locator('.ma-player').waitFor();
  for (const page of [host, phone])
    page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  await send(hostToken, { type: 'resume' });
  await resize(phone, 390, 844, true);
  return token;
}
async function stop() {
  for (const socket of sockets.splice(0)) socket.disconnect();
  if (desktop) await desktop.close();
  desktop = null;
}
async function layout(page, label, mobile) {
  const metrics = await page.evaluate(() => {
    const main = document.querySelector('.ma-screen');
    const toolbar = [
      ...document.querySelectorAll('.ma-toolbar button, .ma-toolbar a'),
    ]
      .filter((e) => e.getClientRects().length)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          text: e.textContent,
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
        };
      });
    const galleries = [
      ...document.querySelectorAll('.ma-hand,.ma-museum__collection'),
    ]
      .filter((e) => e.children.length > 1)
      .map((e) => ({
        columns: getComputedStyle(e).gridTemplateColumns.split(' ').length,
        overflowX: getComputedStyle(e).overflowX,
        overflowY: getComputedStyle(e).overflowY,
        width: e.clientWidth,
        scrollWidth: e.scrollWidth,
      }));
    const texts = [
      ...main.querySelectorAll('p, h2, h3, strong, span, button, select'),
    ]
      .filter(
        (e) =>
          e.getClientRects().length &&
          e.textContent.trim() &&
          [...e.childNodes].some(
            (n) => n.nodeType === 3 && n.textContent.trim(),
          ),
      )
      .map((e) => ({
        text: e.textContent.slice(0, 50),
        size: parseFloat(getComputedStyle(e).fontSize),
      }));
    return {
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      toolbar,
      galleries,
      texts,
    };
  });
  await shot(page, label);
  assert.ok(
    metrics.scrollWidth <= metrics.width + 1,
    label + ' horizontal overflow',
  );
  assert.ok(
    metrics.toolbar.every(
      (r) =>
        r.left >= -1 &&
        r.right <= metrics.width + 1 &&
        r.top >= 0 &&
        r.bottom <= metrics.height,
    ),
    label + ' toolbar clipped',
  );
  assert.ok(
    metrics.texts.every((t) => t.size >= 16),
    label + ' information below 16px',
  );
  assert.ok(
    metrics.galleries.every(
      (g) =>
        g.columns >= 2 &&
        g.overflowY === 'auto' &&
        g.scrollWidth <= g.width + 1,
    ),
    label + ' gallery direction/columns',
  );
  evidence.checks.push({ label, mobile, metrics });
}
try {
  await startCase('offer');
  for (const [w, h, z] of [
    [1280, 720, 1.5],
    [1920, 1080, 1],
    [3840, 2160, 1],
  ]) {
    await resize(host, w, h, false, z);
    assert.equal(await host.locator('.decision-countdown').count(), 0);
    await layout(host, `offer-host-${w}-${z}`, false);
  }
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [390, 844],
  ]) {
    await resize(phone, w, h, true);
    assert.equal(await phone.locator('.decision-countdown').count(), 0);
    await layout(phone, `offer-phone-${w}`, true);
  }
  await captureAsset(phone, '.ma-hand', 'hand');
  await resize(host, 1920, 1080);
  await captureAsset(host, '.ma-market', 'market');
  await phone.getByRole('button', { name: '规则', exact: true }).click();
  const dialog = phone.locator('dialog[open]');
  await dialog.waitFor();
  assert.ok(await dialog.getByText('四轮结束，现金最多获胜').count());
  if (!captureRules) {
    const ruleImages = dialog.locator('figure img');
    assert.equal(await ruleImages.count(), 4);
    for (let index = 0; index < 4; index++) {
      await ruleImages.nth(index).scrollIntoViewIfNeeded();
      await phone.waitForFunction(
        (imageIndex) => {
          const image = document.querySelectorAll('dialog[open] figure img')[
            imageIndex
          ];
          return image?.complete && image.naturalWidth > 0;
        },
        index,
        { timeout: 15000 },
      );
    }
    assert.ok(
      await ruleImages.evaluateAll((images) =>
        images.every((i) => i.complete && i.naturalWidth > 0),
      ),
    );
  }
  await dialog.getByText('四轮结束，现金最多获胜').scrollIntoViewIfNeeded();
  await shot(phone, 'rules-phone');
  await phone.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(
    await phone
      .getByRole('button', { name: '规则', exact: true })
      .evaluate((button) => document.activeElement === button),
    true,
  );
  evidence.checks.push({
    label:
      'Four lazy rules illustrations load after scrolling; Escape restores rule-button focus',
  });
  await stop();
  const token = await startCase('auction-open');
  await resize(host, 1280, 720, false, 1.5);
  await layout(host, 'auction-host-720-150', false);
  const input = phone.locator('#ma-bid-amount');
  await input.waitFor();
  await input.fill('35');
  await input.evaluate((e) => {
    window.__maBidInput = e;
    e.focus();
  });
  const opponent = fixture.players.find(
    (p) =>
      p.token !== token &&
      p.id !== fixture.players.find((p) => p.token === token)?.id,
  );
  const opponentView = await view(opponent.token);
  await send(opponent.token, {
    type: 'game',
    decisionId: opponentView.decisionId,
    action: { type: 'bid', amount: 10 },
  });
  await phone.waitForFunction(
    () => Number(document.querySelector('#ma-bid-amount')?.min) === 11,
  );
  assert.equal(await input.inputValue(), '35');
  assert.equal(
    await input.evaluate(
      (e) => e === window.__maBidInput && document.activeElement === e,
    ),
    true,
  );
  const opponent2 = fixture.players.find(
    (p) => p.token !== token && p.token !== opponent.token,
  );
  const v2 = await view(opponent2.token);
  await send(opponent2.token, {
    type: 'game',
    decisionId: v2.decisionId,
    action: { type: 'bid', amount: 40 },
  });
  await phone.waitForFunction(
    () => Number(document.querySelector('#ma-bid-amount')?.min) === 41,
  );
  assert.equal(await input.inputValue(), '35');
  assert.equal(await phone.locator('button[type="submit"]').isDisabled(), true);
  await phone.getByRole('button', { name: '增加出价' }).click();
  assert.equal(await input.inputValue(), '41');
  await captureAsset(host, '.ma-auction', 'auction');
  await shot(phone, 'bid-draft-preserved');
  evidence.checks.push({
    label:
      'Open auction preserves element, focus and draft across other bids; obsolete draft disables submit; step recovers to legal minimum',
  });
  await stop();
  await startCase('collections');
  await resize(host, 1280, 720, false, 1.5);
  await layout(host, 'collections-host-720-150', false);
  await resize(phone, 360, 640, true);
  await layout(phone, 'collections-phone-360', true);
  await captureAsset(
    host,
    '.ma-museum:has(.ma-museum__collection)',
    'collection',
  );
  await stop();
  assert.equal(evidence.pageErrors.length, 0);
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = String(error.stack ?? error);
  throw error;
} finally {
  await stop();
  evidence.elapsedSeconds = (performance.now() - start) / 1000;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify({
      result: evidence.result,
      checks: evidence.checks.length,
      output,
      elapsedSeconds: evidence.elapsedSeconds,
    }),
  );
}
