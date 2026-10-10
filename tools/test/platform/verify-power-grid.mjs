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
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { launchDesktop, desktopExecutable } from '../support/desktop-test.mjs';
import { verificationOutput } from '../support/verification-output.mjs';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const execute = promisify(execFile);
const portable = process.argv.includes('--portable');
const displayOnly = process.argv.includes('--display-only');
const withDisplay = process.argv.includes('--display');
const seats = Number(
  process.argv.find((arg) => arg.startsWith('--seats='))?.slice(8) ?? 6,
);
assert.ok(
  [3, 4, 5, 6].includes(seats),
  'This mixed-match verifier requires at least two separate human phones and a bot',
);
const humans = Math.min(3, seats - 1);
const runName =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  `${displayOnly ? 'display-' : ''}seats-${seats}`;
assert.match(runName, /^[a-z0-9-]{1,48}$/, 'Safe separate evidence name');
const output = verificationOutput(
  'power-grid',
  'runtime',
  portable ? 'portable' : 'development',
  runName,
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/desktop-verify-'));
const started = performance.now();
const verifier = await readFile(new URL(import.meta.url));
await writeFile(join(output, 'verifier-start-source.mjs'), verifier);
await build({
  stdin: {
    contents: `export { rules } from './games/power-grid/rules'; export { bot } from './games/power-grid/bot'; export { RandomSource } from './packages/platform-core/src/random'; export { getPlant, RESOURCES, RESOURCE_LABELS } from './games/power-grid/data/catalog'; export { GERMANY_REGIONS, getCity } from './games/power-grid/data/germany'; export { income } from './games/power-grid/data/economy'; export { resourcePurchaseCost } from './games/power-grid/rules/resource-purchase';`,
    resolveDir: resolve('.'),
    sourcefile: 'power-grid-verifier.ts',
    loader: 'ts',
  },
  outfile: join(work, 'driver.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const {
  getPlant,
  GERMANY_REGIONS,
  getCity,
  income,
  resourcePurchaseCost,
} = require(join(work, 'driver.cjs'));
const evidence = {
  startedAt: new Date().toISOString(),
  portable,
  displayOnly,
  withDisplay,
  seats,
  humanPhoneProfiles: humans,
  workDir: work,
  verifierSha256: createHash('sha256').update(verifier).digest('hex'),
  simulationBoundary:
    'Hidden native WinForms/WebView2 desktop and separate touch-emulated phone browser profiles on localhost; no physical phone, Wi-Fi, television or foreground desktop acceptance.',
  modeBoundary: displayOnly
    ? 'Native display-only checks use a real paused mixed room; this mode does not claim a full match.'
    : 'Full match uses test timing with authoritative actions, SQLite saves and real Worker; sampled phone controls and one Worker decision use ordinary play timing.',
  checks: [],
  screenshots: [],
  controls: [],
  livePresentation: [],
  commands: [],
  phases: [],
  steps: [],
  pageErrors: [],
  externalRequests: [],
};
const systemPath =
  process.env.SystemRoot + '\\system32;' + process.env.SystemRoot;
const environment = {
  ...process.env,
  PATH: systemPath,
  TABLEMAX_DATA_DIR: join(work, 'data'),
  TABLEMAX_HOST: '127.0.0.1',
  TABLEMAX_PORT: '0',
};
for (const key of Object.keys(environment))
  if (
    ['NODE_PATH', 'NODE_OPTIONS', 'TABLEMAX_WEB_DEV_URL'].includes(
      key.toUpperCase(),
    )
  )
    delete environment[key];
for (const key of Object.keys(environment))
  if (key.toUpperCase() === 'PATH' && key !== 'PATH') delete environment[key];
let executable = desktopExecutable;
async function inventory(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      assert.equal(
        entry.isSymbolicLink(),
        false,
        'Delivery contains no linked file',
      );
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile())
        files.push({
          path: relative(directory, path).split(sep).join('/'),
          bytes: (await stat(path)).size,
          sha256: createHash('sha256')
            .update(await readFile(path))
            .digest('hex'),
        });
    }
  }
  await visit(directory);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
if (portable) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
  const manifest = JSON.parse(
    await readFile(
      resolve(`artifacts/releases/TableMax-${version}-win-x64-manifest.json`),
      'utf8',
    ),
  );
  const extracted = await mkdtemp(resolve('tmp/portable-game-'));
  await execute(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      '$ErrorActionPreference="Stop"; Expand-Archive -LiteralPath $env:TABLEMAX_VERIFY_ARCHIVE -DestinationPath $env:TABLEMAX_VERIFY_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...environment,
        TABLEMAX_VERIFY_ARCHIVE: archive,
        TABLEMAX_VERIFY_EXTRACT: extracted,
      },
    },
  );
  const files = await inventory(extracted);
  evidence.archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  evidence.archiveBytes = (await stat(archive)).size;
  evidence.extractedBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  evidence.extractedDir = extracted;
  assert.equal(
    evidence.archiveSha256,
    manifest.archive.sha256,
    'Actual ZIP matches current manifest',
  );
  assert.deepEqual(
    files,
    manifest.files,
    'Every extracted file byte count and SHA-256 matches',
  );
  assert.ok(
    evidence.archiveBytes < MAXIMUM_PACKAGE_BYTES &&
      evidence.extractedBytes < MAXIMUM_PACKAGE_BYTES,
    'ZIP and actual extracted files strictly below 120 MB',
  );
  evidence.budgetPassed = evidence.extractedBytes < PACKAGE_BUDGET_BYTES;
  evidence.packagedIcons = [];
  for (const file of files.filter((entry) => /app-icon/.test(entry.path))) {
    const record = { ...file };
    if (file.path.endsWith('.png')) {
      const png = await readFile(join(extracted, file.path));
      record.width = png.readUInt32BE(16);
      record.height = png.readUInt32BE(20);
      assert.equal(
        record.width,
        180,
        'Final package keeps only the 180px icon PNG',
      );
      assert.equal(record.height, 180);
    }
    evidence.packagedIcons.push(record);
  }
  assert.ok(
    evidence.packagedIcons.some((file) => file.path.endsWith('.ico')),
    'Original favicon remains in final package',
  );
  assert.ok(
    evidence.packagedIcons.some((file) => file.width === 180),
    'Mobile and box 180px image is packaged',
  );
  executable = join(extracted, 'TableMax.exe');
  evidence.checks.push(
    'Same-version ZIP hash, every extracted file hash, actual ZIP/extracted hard byte gates',
  );
}
const runtimeDir = dirname(executable);
const nodePath = join(runtimeDir, 'node.exe');
const runtimeRulesSnapshot = join(work, 'runtime-rules.cjs');
const runtimeRulesSource = await readFile(
  join(runtimeDir, 'games/power-grid.cjs'),
);
await writeFile(runtimeRulesSnapshot, runtimeRulesSource);
evidence.runtimeRulesSha256 = createHash('sha256')
  .update(runtimeRulesSource)
  .digest('hex');
const { bot } = require(join(runtimeDir, 'bots/power-grid.cjs'));
let desktop, host, publicPage, origin, hostToken, hostSocket;
const phones = [],
  sockets = [],
  observed = new WeakSet();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function until(predicate, description, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await sleep(40);
  }
  throw new Error(description);
}
async function view(token = '') {
  const reply = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(reply.ok, true);
  return reply.view;
}
async function connect(token) {
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: token ? { token } : {},
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
function envelope(current, command) {
  return {
    actionId: randomUUID(),
    instanceId: current.instanceId,
    revision: current.revision,
    branch: current.branch,
    command,
  };
}
async function commandAt(socket, message) {
  const reply = await new Promise((done, reject) =>
    socket
      .timeout(5000)
      .emit('room:command', message, (error, result) =>
        error ? reject(error) : done(result),
      ),
  );
  evidence.commands.push({
    command: message.command.type,
    action: message.command.action?.type ?? null,
    revision: message.revision,
    branch: message.branch,
    accepted: reply.ok,
    reason: reply.reason ?? null,
  });
  return reply;
}
async function send(socket, token, command) {
  const reply = await commandAt(socket, envelope(await view(token), command));
  if (!reply.ok && ['stale-revision', 'stale-decision'].includes(reply.reason))
    return false;
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return true;
}
function observe(page) {
  if (observed.has(page)) return;
  observed.add(page);
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) &&
      url.origin !== origin
    )
      evidence.externalRequests.push(request.url());
  });
}
async function touch(page) {
  const window = await desktop.browserWindow(page);
  await window.evaluate((window) => window.setContentSize(390, 844));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  await cdp.detach();
  await page.waitForFunction(() => innerWidth === 390 && innerHeight === 844);
}
async function capture(page, name) {
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((window) => window.isVisible()), false);
  const data = await window.evaluate(async (window) =>
    (await window.webContents.capturePage()).toPNG().toString('base64'),
  );
  const png = Buffer.from(data, 'base64');
  await writeFile(join(output, name + '.png'), png);
  evidence.screenshots.push({
    file: name + '.png',
    pngWidth: png.readUInt32BE(16),
    pngHeight: png.readUInt32BE(20),
    ...(await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      phase: document.querySelector('.pg-screen')?.dataset.phase,
      devicePixelRatio,
    }))),
  });
}
async function phone(index, restore = false) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, input) => {
      const window = new BrowserWindow({
        show: false,
        width: 390,
        height: 844,
        webPreferences: {
          partition: 'persist:power-grid-' + input.index,
          offscreen: true,
        },
      });
      void window.loadURL(
        input.origin + (input.restore ? '/player/game' : '/player'),
      );
    },
    { origin, index, restore },
  );
  const page = await next;
  observe(page);
  await touch(page);
  if (!restore) {
    await page.getByRole('button', { name: '选择头像', exact: true }).click();
    await page
      .getByRole('dialog')
      .locator(`[data-avatar-id="avatar-${20 + index}"]`)
      .click();
    await page.getByLabel('你的昵称').fill('电网公司 ' + (index + 1));
    await page.getByRole('button', { name: '加入', exact: true }).click();
    await page
      .getByRole('button', { name: '我准备好了', exact: true })
      .waitFor();
  } else await page.locator('.pg-screen').waitFor();
  const token = await page.evaluate(() =>
    localStorage.getItem('tablemax-player'),
  );
  assert.ok(token);
  return { page, token, socket: await connect(token) };
}
async function boot(restart = false) {
  const env = {
    ...environment,
    TABLEMAX_PORT: restart ? String(new URL(origin).port) : '0',
  };
  desktop = await launchDesktop({
    executablePath: executable,
    args: ['--foundation-test', '--tablemax-test-mode'],
    env,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  observe(host);
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  hostSocket = await connect(hostToken);
  evidence.runtime = await desktop.request('runtime');
  assert.equal(evidence.runtime.versions.node, '22.14.0');
  assert.equal(evidence.runtime.packaged, portable);
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(evidence.runtime.appVersion, version);
  const processProbe = await execute(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      '(Get-Process -Id ([int]$env:TABLEMAX_VERIFY_PID)).Path',
    ],
    {
      windowsHide: true,
      env: {
        ...environment,
        TABLEMAX_VERIFY_PID: String(evidence.runtime.servicePid),
      },
    },
  );
  assert.equal(
    resolve(processProbe.stdout.trim()).toLowerCase(),
    nodePath.toLowerCase(),
    'Independent service actually uses this delivery Node',
  );
  evidence.actualServiceNode = processProbe.stdout.trim();
  if (restart) {
    await host.goto(origin + '/host/game');
    await host.locator('.pg-screen').waitFor();
  }
}
async function projectionAudit(label) {
  const current = await view(hostToken),
    game = current.gameView;
  assert.equal(current.self.seatId, null);
  assert.equal(current.actions.length, 0);
  assert.equal(game.self, null);
  if (game.phase !== 'ended')
    assert.ok(
      Object.values(game.players).every((player) => player.cash === null),
    );
  const publicView = await view();
  assert.deepEqual(publicView.gameView, game);
  assert.equal(publicView.actions.length, 0);
  for (const entry of phones) {
    const own = await view(entry.token),
      ownGame = own.gameView;
    assert.equal(ownGame.self.seatId, own.self.seatId);
    assert.equal(ownGame.self.cash, ownGame.players[own.self.seatId].cash);
    if (ownGame.phase !== 'ended')
      assert.ok(
        Object.entries(ownGame.players).every(
          ([id, player]) => id === own.self.seatId || player.cash === null,
        ),
      );
  }
  evidence.checks.push(
    label +
      ': host/public have no seat or actions; each phone sees only its cash before final result',
  );
}
async function iconProof(page, role, checkBrand = false) {
  const proof = await page.evaluate(async (checkBrand) => {
    const icon = document.querySelector('link[rel="icon"]'),
      mobile = document.querySelector('link[rel="apple-touch-icon"]');
    const image = new Image();
    image.src = mobile.href;
    await image.decode();
    const result = {
      favicon: icon.href,
      mobile: mobile.href,
      mobileWidth: image.naturalWidth,
      mobileHeight: image.naturalHeight,
    };
    if (checkBrand) {
      const brand = document.querySelector('.brand-mark');
      await brand.decode();
      const r = brand.getBoundingClientRect();
      result.brand = {
        source: brand.currentSrc,
        naturalWidth: brand.naturalWidth,
        naturalHeight: brand.naturalHeight,
        width: r.width,
        height: r.height,
        complete: brand.complete,
      };
    }
    return result;
  }, checkBrand);
  evidence.iconProofs ??= [];
  evidence.iconProofs.push({ role, ...proof });
  assert.equal(new URL(proof.favicon).origin, origin);
  assert.equal(new URL(proof.mobile).origin, origin);
  assert.equal(proof.mobileWidth, 180);
  assert.equal(proof.mobileHeight, 180);
  const ico = Buffer.from(await (await fetch(proof.favicon)).arrayBuffer());
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(
    createHash('sha256').update(ico).digest('hex'),
    createHash('sha256')
      .update(await readFile('assets/platform/app-icon.ico'))
      .digest('hex'),
    'Actual local favicon remains the original ICO',
  );
  if (checkBrand) {
    assert.equal(proof.brand.naturalWidth, 180);
    assert.equal(proof.brand.naturalHeight, 180);
    assert.ok(
      proof.brand.complete &&
        Math.abs(proof.brand.width - 36) <= 1 &&
        Math.abs(proof.brand.height - 36) <= 1,
      '180px decoded box mark keeps the actual 36 CSS px display',
    );
  }
  evidence.iconProofs.at(-1).faviconSha256 = createHash('sha256')
    .update(ico)
    .digest('hex');
}
async function geometry(button, action) {
  await button.scrollIntoViewIfNeeded();
  const result = await button.evaluate((element) => {
    const r = element.getBoundingClientRect(),
      target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      text: element.textContent.trim(),
      width: r.width,
      height: r.height,
      font: parseFloat(getComputedStyle(element).fontSize),
      visible:
        r.x >= -1 &&
        r.right <= innerWidth + 1 &&
        r.y >= -1 &&
        r.bottom <= innerHeight + 1,
      unobscured: !!target && (target === element || element.contains(target)),
    };
  });
  assert.ok(
    result.width >= 44 &&
      result.height >= 44 &&
      result.visible &&
      result.unobscured,
    'Real phone control touch target accessible: ' + action,
  );
  evidence.controls.push({ action, ...result });
}
async function nativeMatrix() {
  evidence.displayLayouts = [];
  evidence.displayDialogs = [];
  evidence.dpiBoundary =
    'Display requests and simulated Windows 125/150% are explicit native test geometry plus CDP density with zero width/height. Actual native DIP size, effective ZoomFactor, CSS viewport, simulated DPR, physical native bounds and PNG raster size are recorded independently; the OS capture raster density remains unchanged. No OS display setting is changed. 720p UI125/150 requests can be limited to effective zoom1 to preserve layout.';
  const before = await view(hostToken);
  const cases = [
    ...[
      [1280, 720],
      [1920, 1080],
      [3840, 2160],
    ].map(([width, height]) => ({ width, height, scale: 100, dpi: 1 })),
    ...[125, 150].flatMap((scale) =>
      [
        [1280, 720],
        [3840, 2160],
      ].map(([width, height]) => ({ width, height, scale, dpi: 1 })),
    ),
    ...[1.25, 1.5].flatMap((dpi) =>
      [
        [1280, 720],
        [3840, 2160],
      ].map(([width, height]) => ({ width, height, scale: 100, dpi })),
    ),
  ];
  for (const [role, page] of [
    ['host', host],
    ['public', publicPage],
  ]) {
    const id = await page.evaluate(() => window.__tablemaxWindowId);
    const window = await desktop.browserWindow(page),
      cdp = await page.context().newCDPSession(page);
    for (const request of cases) {
      const width = Math.round(request.width / request.dpi),
        height = Math.round(request.height / request.dpi);
      await window.evaluate(
        (window, size) => window.setContentSize(size.width, size.height),
        { width, height },
      );
      await desktop.request('window', {
        id,
        operation: 'geometry',
        geometry: {
          viewport: { width, height },
          screen: { width, height, scaleFactor: request.dpi },
        },
      });
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 0,
        height: 0,
        deviceScaleFactor: request.dpi,
        mobile: false,
      });
      const trigger = page.getByRole('button', {
        name: /^(?:视频|显示)设置$/,
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole('dialog', {
        name: /^(?:视频|显示)设置$/,
        exact: true,
      });
      await dialog
        .getByLabel('适配方式', { exact: true })
        .selectOption(`${request.width}x${request.height}`);
      await dialog
        .getByLabel('界面大小', { exact: true })
        .selectOption(String(request.scale));
      await until(async () => {
        const s = await page.evaluate(() => window.tablemaxDisplay.read());
        return (
          s.preferences.resolution === `${request.width}x${request.height}` &&
          s.preferences.interfaceScale === request.scale
        );
      }, 'Native display preferences saved');
      const dialogGeometry = await dialog.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          width: innerWidth,
          height: innerHeight,
          focus: element.contains(document.activeElement),
        };
      });
      assert.ok(
        dialogGeometry.x >= -1 &&
          dialogGeometry.y >= -1 &&
          dialogGeometry.right <= dialogGeometry.width + 1 &&
          dialogGeometry.bottom <= dialogGeometry.height + 1 &&
          dialogGeometry.focus,
        'Native display dialog fits and contains focus',
      );
      evidence.displayDialogs.push({ role, request, ...dialogGeometry });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(
        await trigger.evaluate((element) => document.activeElement === element),
        true,
        'Display close returns focus',
      );
      await page.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      const native = await window.evaluate((window) => ({
        content: window.getContentSize(),
        physicalBounds: window.getBounds(),
        zoom: window.webContents.getZoomFactor(),
        visible: window.isVisible(),
      }));
      const bridge = await page.evaluate(() => window.tablemaxDisplay.read());
      const layout = await page.evaluate(() => {
        const bounds = (element) => {
          const r = element.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        };
        return {
          width: innerWidth,
          height: innerHeight,
          dpr: devicePixelRatio,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          panels: [
            ...document.querySelectorAll(
              '.pg-map-table,.pg-board-drawer,.pg-board-companies',
            ),
          ]
            .filter(
              (element) =>
                element.getBoundingClientRect().width > 0 &&
                element.getBoundingClientRect().height > 0,
            )
            .map((element) => ({
              className: element.className,
              ...bounds(element),
            })),
          mapCities: document.querySelectorAll('.pg-map-city').length,
          companyRows: [
            ...document.querySelectorAll('.pg-company-card'),
          ].filter(
            (item) =>
              item.getBoundingClientRect().width > 0 &&
              item.getBoundingClientRect().height > 0,
          ).length,
        };
      });
      evidence.displayLayouts.push({ role, request, native, bridge, layout });
      assert.equal(native.visible, false);
      assert.deepEqual(native.content, [width, height]);
      assert.ok(
        Math.abs(layout.width - width / native.zoom) <= 2 &&
          Math.abs(layout.height - height / native.zoom) <= 2,
        'Actual CSS viewport follows native content and effective ZoomFactor',
      );
      assert.ok(
        Math.abs(layout.dpr / native.zoom - request.dpi) < 0.04,
        'Actual renderer density matches requested simulated Windows DPI',
      );
      assert.ok(
        layout.scrollWidth <= layout.width + 2,
        'Native game has no horizontal document overflow',
      );
      for (const panel of layout.panels)
        assert.ok(
          panel.x >= -1 &&
            panel.y >= -1 &&
            panel.right <= layout.width + 1 &&
            panel.bottom <= layout.height + 1,
          'Desktop map/market/companies remain in actual first screen',
        );
      assert.equal(
        layout.mapCities,
        42,
        'Actual Germany map renders all 42 cities',
      );
      await page
        .getByRole('button', { name: '查看各家公司', exact: true })
        .click();
      const companiesDialog = page.getByRole('dialog', {
        name: '各家电力公司',
        exact: true,
      });
      await companiesDialog.waitFor();
      assert.equal(
        await companiesDialog.locator('.pg-inspector-company').count(),
        before.seats.length,
        'Every saved company is available through the native company overview',
      );
      await companiesDialog
        .getByRole('button', { name: '关闭面板', exact: true })
        .click();
      assert.ok(
        layout.scrollHeight <= layout.height + 2,
        'Actual native document has no vertical overflow',
      );
      const label = `native-${role}-${request.width}x${request.height}-ui${request.scale}-dpi${Math.round(request.dpi * 100)}`;
      await capture(page, label);
      const frame = evidence.screenshots.at(-1);
      evidence.displayLayouts.at(-1).capture = {
        pngWidth: frame.pngWidth,
        pngHeight: frame.pngHeight,
        rasterScaleX: frame.pngWidth / native.content[0],
        rasterScaleY: frame.pngHeight / native.content[1],
      };
      await page.getByRole('button', { name: '菜单', exact: true }).click();
      const menu = page.getByRole('dialog', { name: '电网菜单', exact: true });
      const menuBounds = await menu.boundingBox();
      assert.ok(
        menuBounds.x >= -1 &&
          menuBounds.y >= -1 &&
          menuBounds.x + menuBounds.width <= layout.width + 1 &&
          menuBounds.y + menuBounds.height <= layout.height + 1,
        'Native game menu fits effective viewport',
      );
      if (request.scale === 150 || request.dpi > 1)
        await capture(page, label + '-menu');
      await menu.getByRole('button', { name: '关闭面板', exact: true }).click();
      await menu.waitFor({ state: 'hidden' });
      const transform = await page.locator('.pg-map').getAttribute('style');
      await page.mouse.move(0, 0);
      if (await page.locator('[data-income-card]').count())
        await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '放大地图', exact: true }).click();
      assert.notEqual(
        await page.locator('.pg-map').getAttribute('style'),
        transform,
        'Native map zoom button changes actual transform',
      );
      await page.getByRole('button', { name: '复位', exact: true }).click();
      const picker = page.getByLabel('选择城市', { exact: true });
      const selected = await picker
        .locator('option')
        .evaluateAll(
          (options) => options.find((option) => option.value)?.value,
        );
      await picker.selectOption(selected);
      await page.getByRole('button', { name: /城市详情$/ }).click();
      const cityDialog = page.getByRole('dialog', { name: /城市详情$/ });
      await cityDialog
        .getByLabel('城市位置费用图例', { exact: true })
        .waitFor();
      await cityDialog
        .getByRole('button', { name: '关闭面板', exact: true })
        .click();
      evidence.displayLayouts.at(-1).selectedCity = selected;
    }
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await cdp.detach();
    await desktop.request('window', { id, operation: 'geometry', clear: true });
  }
  const after = await view(hostToken);
  assert.equal(after.revision, before.revision);
  assert.equal(after.branch, before.branch);
  assert.equal(after.ownerSeatId, before.ownerSeatId);
  assert.deepEqual(
    after.gameView,
    before.gameView,
    'Display, modal and map controls do not mutate saved game',
  );
  assert.equal(
    await phones[0].page
      .getByRole('button', { name: /^(?:视频|显示)设置$/, exact: true })
      .count(),
    0,
    'Phone never receives computer display settings',
  );
  evidence.checks.push(
    'Actual hidden host/public 720p/1080p/4K native renders, 100/125/150% settings and 125/150% Windows density samples record effective CSS/native/PNG geometry; real dialog/menu/map controls preserve state and identity',
  );
}
const sampled = new Set();
const capturedLivePhases = new Set();
async function livePresentation(page, current, label, marketRequired) {
  const game = current.gameView;
  const active = !current.paused && current.status === 'playing';
  const expectedOrder = game.playerOrder.map((seat, index) => ({
    seat,
    rank: `位次 ${index + 1}`,
    current: active && seat === game.actor,
  }));
  const expectedMarkets = ['coal', 'oil', 'garbage', 'uranium'].map(
    (resource) => {
      const capacity = resource === 'uranium' ? 1 : 3;
      const prices =
        resource === 'uranium'
          ? [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16]
          : [1, 2, 3, 4, 5, 6, 7, 8];
      let remaining = game.resources[resource];
      // Fill physical board slots from the high-price end, independently of
      // the client's price-area formula and the rules' next-price formula.
      const areas = [...prices]
        .reverse()
        .map((price) => {
          const count = Math.min(capacity, remaining);
          remaining -= count;
          return {
            price,
            count,
            visibleCount: count,
            next: count > 0 && price === game.resourcePrices[resource],
          };
        })
        .reverse();
      assert.equal(remaining, 0, 'Finite resource slots fit the board');
      assert.equal(
        areas.find((area) => area.count > 0)?.price ?? null,
        game.resourcePrices[resource],
        'Authoritative next price is the cheapest occupied physical area',
      );
      return { resource, areas };
    },
  );
  const expected = {
    phase: game.phase,
    order: expectedOrder,
    markets: marketRequired ? expectedMarkets : [],
  };
  let actual;
  try {
    await until(async () => {
      actual = await page.evaluate(() => ({
        phase: document.querySelector('.pg-screen')?.dataset.phase,
        order: [
          ...document.querySelectorAll('.pg-company-cards .pg-company-card'),
        ].map((item) => ({
          seat: item.dataset.companySeat,
          rank: item
            .querySelector('.pg-company-rank')
            ?.getAttribute('aria-label'),
          current: item.classList.contains('pg-company-card--acting'),
        })),
        markets: [
          ...document.querySelectorAll('.pg-price-lane[data-resource]'),
        ].map((lane) => ({
          resource: lane.dataset.resource,
          areas: [...lane.querySelectorAll('.pg-price-area')].map((area) => ({
            price: Number(area.dataset.price),
            count: Number(area.dataset.count),
            visibleCount: Number(
              area.querySelector('.pg-price-count')?.textContent,
            ),
            next: area.classList.contains('pg-price-area--next'),
          })),
        })),
      }));
      return equal(actual, expected);
    }, 'Real client order and price areas match the saved safe view: ' + label);
  } catch (error) {
    evidence.livePresentation.push({ label, expected, actual, passed: false });
    throw error;
  }
  evidence.livePresentation.push({
    label,
    round: game.round,
    step: game.step,
    actor: game.actor,
    ...actual,
    passed: true,
  });
}
async function stablePhaseCapture(page, label) {
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-power-grid-effect]') &&
      document
        .getAnimations()
        .every((animation) => animation.playState !== 'running'),
  );
  await capture(page, label);
}
async function clickAction(entry, current, action) {
  await send(hostSocket, hostToken, { type: 'set-play-mode', mode: 'play' });
  const saved = await view(entry.token);
  if (!saved.actions.some((legal) => equal(legal, action))) return false;
  const page = entry.page;
  await page
    .locator(`.pg-screen[data-phase="${current.gameView.phase}"] .pg-controls`)
    .waitFor();
  let button;
  if (action.type === 'select-regions') {
    for (const region of GERMANY_REGIONS) {
      const control = page
        .locator('.pg-region-choices')
        .getByRole('button', { name: new RegExp('^' + region.name) });
      if (
        ((await control.getAttribute('aria-pressed')) === 'true') !==
        action.regions.includes(region.id)
      )
        await control.click();
    }
    button = page.getByRole('button', {
      name: `确认区域 ${action.regions.length}/${current.gameView.regionCount}`,
      exact: true,
    });
  } else if (action.type === 'offer') {
    await page
      .locator('.pg-select-plants')
      .getByRole('button', { name: new RegExp('^' + action.plantId + '号') })
      .click();
    await page.getByLabel('报价金额').fill(String(action.amount));
    button = page.getByRole('button', {
      name: `以 ${action.amount} E 竞拍 ${action.plantId} 号电厂`,
      exact: true,
    });
  } else if (action.type === 'bid') {
    await page.getByLabel('报价金额').fill(String(action.amount));
    button = page.getByRole('button', {
      name: `确认出价 ${action.amount} E`,
      exact: true,
    });
  } else if (action.type === 'buy-resource') {
    const purchase = page.locator(
      `.pg-resource-purchase[data-plant-id="${action.plantId}"][data-resource="${action.resource}"]`,
    );
    await purchase.getByRole('spinbutton').fill(String(action.quantity ?? 1));
    const sync = await connect(entry.token);
    sync.disconnect();
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
    assert.equal(
      await purchase.getByRole('spinbutton').inputValue(),
      String(action.quantity ?? 1),
    );
    const afterDraft = await view(entry.token);
    assert.deepEqual(
      [afterDraft.revision, afterDraft.branch, afterDraft.decisionId],
      [saved.revision, saved.branch, saved.decisionId],
      'Quantity and synchronization never save a purchase',
    );
    button = purchase.locator('[data-resource-purchase-confirm]');
  } else if (action.type === 'build') {
    await page
      .locator('.pg-phone-page:not([hidden]) .pg-phone-map')
      .getByLabel('选择城市', { exact: true })
      .selectOption(action.cityId);
    button = page.getByRole('button', {
      name: '建设 ' + getCity(action.cityId).name,
      exact: true,
    });
  } else if (action.type === 'run') {
    const plant = getPlant(action.plantId);
    const name =
      plant.fuel === 'hybrid'
        ? `煤 ${action.coal} ＋ 油 ${plant.input - action.coal}`
        : '启动';
    button = page
      .locator('.pg-run-plant')
      .filter({
        has: page.locator('.pg-plant-number', {
          hasText: new RegExp('^' + action.plantId + '$'),
        }),
      })
      .getByRole('button', { name: new RegExp(name) })
      .first();
  } else if (action.type === 'discard-plant')
    button = page.getByRole('button', {
      name: `淘汰 ${action.plantId} 号`,
      exact: true,
    });
  else if (action.type === 'finish' && current.gameView.phase === 'powering') {
    await page.getByLabel('选择供电城市数').selectOption(String(action.cities));
    button = page.getByRole('button', {
      name: `供电 ${action.cities} 城，收入 ${income(action.cities)} E`,
      exact: true,
    });
  } else throw new Error('Unimplemented UI probe: ' + action.type);
  if (action.type === 'offer' || action.type === 'bid') {
    const beforeSync = await view(entry.token);
    const quotes = saved.actions.filter(
      (choice) =>
        choice.type === action.type &&
        (action.type !== 'offer' || choice.plantId === action.plantId),
    );
    const probeQuote =
      quotes.find((choice) => choice.amount !== quotes[0]?.amount)?.amount ??
      action.amount;
    await page.getByLabel('报价金额').fill(String(probeQuote));
    // A second authorized connection triggers a real room:view broadcast to
    // the phone's own UI connection without submitting or changing a decision.
    const sync = await connect(entry.token);
    sync.disconnect();
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
    assert.equal(
      await page.getByLabel('报价金额').inputValue(),
      String(probeQuote),
    );
    await page.getByRole('button', { name: '规则', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: '关闭面板', exact: true })
      .click();
    assert.equal(
      await page.getByLabel('报价金额').inputValue(),
      String(probeQuote),
    );
    await page.getByLabel('报价金额').fill(String(action.amount));
    const afterSync = await view(entry.token);
    assert.deepEqual(
      [afterSync.revision, afterSync.branch, afterSync.decisionId],
      [beforeSync.revision, beforeSync.branch, beforeSync.decisionId],
      'Sync and rules reading preserve the real saved auction decision',
    );
    evidence.checks.push(
      action.type + ': real sync and rulebook preserve entered quote',
    );
  }
  if (
    [
      'offer',
      'auction',
      'resources',
      'building',
      'powering',
      'replace',
    ].includes(saved.gameView.phase)
  ) {
    await livePresentation(
      host,
      saved,
      'host-' + action.type,
      saved.gameView.phase === 'resources',
    );
    await livePresentation(
      publicPage,
      saved,
      'public-' + action.type,
      saved.gameView.phase === 'resources',
    );
    await livePresentation(
      page,
      saved,
      'phone-' + action.type,
      saved.gameView.phase === 'resources',
    );
    if (!capturedLivePhases.has(saved.gameView.phase)) {
      await stablePhaseCapture(host, 'live-' + saved.gameView.phase + '-host');
      await stablePhaseCapture(
        publicPage,
        'live-' + saved.gameView.phase + '-public',
      );
      capturedLivePhases.add(saved.gameView.phase);
    }
  }
  if (action.type === 'build') {
    // Restore the local city choice after inspecting the saved client presentation.
    await page
      .locator('.pg-phone-page:not([hidden]) .pg-phone-map')
      .getByLabel('选择城市', { exact: true })
      .selectOption(action.cityId);
  }
  await geometry(button, action.type);
  await capture(page, 'control-' + action.type + '-before');
  const serial = Number(saved.gameView.latest?.id.slice(3) ?? 0),
    actor = saved.self.seatId;
  await button.click();
  const verb =
    action.type === 'select-regions'
      ? 'regions'
      : action.type === 'finish'
        ? 'supply'
        : action.type;
  await until(
    async () =>
      (await view(entry.token)).gameView.history.some(
        (log) =>
          Number(log.id.slice(3)) > serial &&
          log.actor === actor &&
          log.verb === verb &&
          (!('plantId' in action) || log.plantId === action.plantId) &&
          (!('amount' in action) || log.amount === action.amount) &&
          (!('cities' in action) || log.amount === action.cities) &&
          (!('cityId' in action) || log.cityId === action.cityId),
      ),
    'Specific UI action durably saved: ' + action.type,
  );
  await capture(page, 'control-' + action.type + '-saved');
  if (
    action.type === 'buy-resource' &&
    (action.quantity ?? 1) > 1 &&
    !sampled.has('batch-purchase')
  ) {
    const after = await view(entry.token),
      quantity = action.quantity;
    const oldPlant = saved.gameView.players[actor].plants.find(
      (plant) => plant.id === action.plantId,
    );
    const newPlant = after.gameView.players[actor].plants.find(
      (plant) => plant.id === action.plantId,
    );
    const cost = resourcePurchaseCost(
      action.resource,
      saved.gameView.resources[action.resource],
      quantity,
    );
    assert.equal(
      after.gameView.resources[action.resource],
      saved.gameView.resources[action.resource] - quantity,
    );
    assert.equal(
      newPlant.resources[action.resource],
      oldPlant.resources[action.resource] + quantity,
    );
    assert.equal(after.gameView.self.cash, saved.gameView.self.cash - cost);
    const logs = after.gameView.history.filter(
      (log) => Number(log.id.slice(3)) > serial,
    );
    assert.equal(logs.length, 1, 'Multi-unit purchase saves one log');
    assert.equal(logs[0].amount, cost);
    const stale = await commandAt(
      entry.socket,
      envelope(saved, { type: 'game', decisionId: saved.decisionId, action }),
    );
    assert.equal(stale.ok, false, 'Old purchase cannot be applied again');
    assert.deepEqual((await view(entry.token)).gameView, after.gameView);
    sampled.add('batch-purchase');
    const management = await view(hostToken);
    await send(hostSocket, hostToken, {
      type: 'rollback',
      checkpointId: management.history.at(-1).id,
    });
    const rolled = await view(entry.token);
    assert.equal(rolled.paused, true);
    assert.deepEqual(
      rolled.gameView,
      saved.gameView,
      'Batch rollback restores cash, market and storage together',
    );
    evidence.checks.push(
      'Real phone multi-unit purchase: one log/checkpoint, exact cumulative total, stale rejection, atomic rollback and repeat',
    );
    await send(hostSocket, hostToken, { type: 'resume' });
    return clickAction(entry, await view(entry.token), action);
  }
  sampled.add(action.type === 'finish' ? 'finish:powering' : action.type);
  await send(hostSocket, hostToken, { type: 'set-play-mode', mode: 'test' });
  return true;
}

// Audit the real SQLite journal with the same delivered Node, without exporting
// credentials, concealed balances or hidden deck order into the public evidence.
await writeFile(
  join(work, 'save-audit.mjs'),
  await readFile(resolve('apps/server/src/save-codec.mjs')),
);
await writeFile(
  join(work, 'audit.cjs'),
  `
const assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const {readCurrentSave,readJournalSave}=require('./save-audit.mjs');
const {RandomSource,getPlant,RESOURCES}=require('./driver.cjs'),{rules}=require(process.argv[3]);
const db=new DatabaseSync(process.argv[2],{readOnly:true}),seen=new Set(),phases=new Set(),steps=new Set(),actors={},actions={},botData=new Map(); let rows=0,validatedStates=0,replayed=0;
for(const {rowid} of db.prepare('SELECT rowid FROM journal ORDER BY rowid').all()){
 rows++; const save=readJournalSave(db,rowid); if(save.manifest?.id!=='power-grid'||!save.snapshot)continue;
 const s=rules.validateState(save.snapshot.state,save.seats.map(p=>p.id)); validatedStates++; phases.add(s.phase);steps.add(s.step);
 for(const value of Object.values(save.snapshot.bots)){const metadata={id:value.id,version:value.version,difficulty:value.difficulty};botData.set(JSON.stringify(metadata),metadata);}
 const checkpoint=save.history.at(-1),before=checkpoint?.before?.state;
 if(!before||s.actionSerial!==before.actionSerial+1)continue;
 const key=save.instanceId+':'+save.branch+':'+s.actionSerial;if(seen.has(key))continue;seen.add(key);
 rules.validateState(before,s.seatOrder); const seat=before.actor,logs=s.history.filter(l=>Number(l.id.slice(3))>before.logSerial),first=logs[0];let a;
 if(before.phase==='regions')a={type:'select-regions',regions:s.regions};
 else if(first?.verb==='offer')a={type:'offer',plantId:first.plantId,amount:first.amount};
 else if(first?.verb==='bid')a={type:'bid',amount:first.amount};
 else if(['pass','pass-round'].includes(first?.verb))a={type:'pass'};
 else if(first?.verb==='discard-plant')a={type:'discard-plant',plantId:first.plantId};
 else if(['buy-resource','salvage'].includes(first?.verb)){const quantity=first.verb==='buy-resource'?s.players[seat].plants.find(p=>p.id===first.plantId).resources[first.resource]-before.players[seat].plants.find(p=>p.id===first.plantId).resources[first.resource]:1;a={type:first.verb,resource:first.resource,plantId:first.plantId,...(quantity>1?{quantity}:{})};}
 else if(first?.verb==='discard-salvage')a={type:'discard-salvage',resource:first.resource};
 else if(first?.verb==='build')a={type:'build',cityId:first.cityId};
 else if(first?.verb==='run'){const plant=before.players[seat].plants.find(p=>p.id===first.plantId),after=s.players[seat].plants.find(p=>p.id===first.plantId);a={type:'run',plantId:first.plantId,coal:getPlant(first.plantId).fuel==='hybrid'?plant.resources.coal-after.resources.coal:0};}
 else if(first?.verb==='transfer'){const from=before.players[seat].plants.find(p=>p.resources[first.resource]>(s.players[seat].plants.find(q=>q.id===p.id)?.resources[first.resource]??0));a={type:'transfer',resource:first.resource,fromPlantId:from.id,toPlantId:first.plantId};}
 else if(first?.verb==='swap-resources'){const to=before.players[seat].plants.find(p=>p.id===first.plantId),after=s.players[seat].plants.find(p=>p.id===first.plantId),resource=RESOURCES.find(r=>after.resources[r]>to.resources[r]),otherResource=RESOURCES.find(r=>after.resources[r]<to.resources[r]),from=before.players[seat].plants.find(p=>p.id!==to.id&&p.resources[resource]>(s.players[seat].plants.find(q=>q.id===p.id)?.resources[resource]??0));a={type:'swap-resources',resource,otherResource,fromPlantId:from.id,toPlantId:to.id};}
 else a=before.phase==='powering'?{type:'finish',cities:logs.find(l=>l.verb==='supply').amount}:{type:'finish'};
 assert.ok(rules.legalActions(before,seat).some(legal=>JSON.stringify(rules.validateAction(legal))===JSON.stringify(rules.validateAction(a))),'Saved action was legal '+JSON.stringify(a));
 const random=new RandomSource(checkpoint.before.random),applied=rules.apply(before,a,seat,{seats:s.seatOrder,random});assert.deepEqual(applied.state,s,'Deterministic replay of actual SQLite action');
 replayed++;actors[seat]=(actors[seat]??0)+1;actions[a.type]=(actions[a.type]??0)+1;
}
const final=readCurrentSave(db);db.close();
console.log(JSON.stringify({rows,validatedStates,replayed,actors,actions,phases:[...phases],steps:[...steps],botData:[...botData.values()],finalStatus:final.status}));
`,
);

try {
  await boot();
  if (portable) {
    evidence.initialBoxBrand = await host
      .locator('.brand-mark')
      .evaluate(async (brand) => {
        await brand.decode();
        const r = brand.getBoundingClientRect();
        return {
          naturalWidth: brand.naturalWidth,
          width: r.width,
          height: r.height,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
        };
      });
    assert.equal(evidence.initialBoxBrand.naturalWidth, 180);
    assert.ok(
      [30, 36].includes(evidence.initialBoxBrand.width),
      'Existing compact/regular box icon CSS sizing is preserved',
    );
    const window = await desktop.browserWindow(host);
    await window.evaluate((window) => window.setContentSize(1920, 1080));
    await host.waitForFunction(
      () => innerWidth === 1920 && innerHeight === 1080,
    );
    await iconProof(host, 'host-box-1080p', true);
  }
  await host
    .locator('.game-library__item')
    .filter({ hasText: '电力公司' })
    .getByRole('button', { name: '选择游戏', exact: true })
    .click();
  await until(
    async () => (await view(hostToken)).game?.id === 'power-grid',
    'Game selected',
  );
  assert.equal(
    await host.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .some((entry) =>
          /PowerGridScreen|plants-atlas|germany-terrain/.test(entry.name),
        ),
    ),
    false,
    'Box only loads thumbnail/catalog',
  );
  for (let i = 0; i < humans; i++) phones.push(await phone(i));
  const levels = ['default', 'doubao', 'juewu'];
  for (let i = 0; i < seats - humans; i++)
    await send(hostSocket, hostToken, {
      type: 'add-bot',
      name: '电力人机 ' + (i + 1),
      difficulty: levels[i % 3],
    });
  const initial = await view(hostToken),
    identities = initial.seats.map(
      ({ id, name, avatarId, controller, botDifficulty }) => ({
        id,
        name,
        avatarId,
        controller,
        botDifficulty,
      }),
    );
  evidence.identities = identities;
  await send(hostSocket, hostToken, {
    type: 'set-owner',
    seatId: initial.seats[0].id,
  });
  async function readyStart() {
    for (const entry of phones)
      await send(entry.socket, entry.token, { type: 'ready', ready: true });
    await send(phones[0].socket, phones[0].token, { type: 'start' });
    await send(hostSocket, hostToken, { type: 'pause' });
  }
  await readyStart();
  // A real randomized initial order is retried through lifecycle commands when
  // the regional selector is a bot, so the phone region control is sampled too.
  for (let retry = 0; retry < 12; retry++) {
    const current = await view(hostToken);
    if (
      phones.some(
        (entry, index) => initial.seats[index].id === current.gameView.actor,
      )
    )
      break;
    await send(hostSocket, hostToken, { type: 'end' });
    await send(hostSocket, hostToken, { type: 'replay' });
    await readyStart();
  }
  await Promise.all(
    [host, ...phones.map((entry) => entry.page)].map((page) =>
      page.waitForURL('**/game'),
    ),
  );
  const next = desktop.waitForEvent('window');
  await desktop.request('open-public', { path: '/public/game' });
  publicPage = await next;
  observe(publicPage);
  await publicPage.locator('.pg-screen').waitFor();
  if (portable) {
    await iconProof(publicPage, 'public-game');
    evidence.checks.push(
      'Portable host box mark is decoded at 180px and displayed at 36 CSS px; host/public original ICO and mobile180 links are local and decoded, with no large icon PNG packaged',
    );
  }
  await projectionAudit('Initial paused match');
  await capture(host, 'initial-host');
  await capture(publicPage, 'initial-public');
  if (displayOnly) await nativeMatrix();
  else {
    const phaseSet = new Set(),
      stepSet = new Set();
    await send(hostSocket, hostToken, { type: 'resume' });
    const deadline = Date.now() + 600000;
    let humanActions = 0,
      lastProgress = Date.now(),
      staleMessage;
    while (Date.now() < deadline) {
      const current = await view(hostToken),
        game = current.gameView;
      assert.equal(
        current.botError,
        null,
        'Actual Worker strategy did not fail',
      );
      if (!phaseSet.has(game.phase)) {
        phaseSet.add(game.phase);
        evidence.phases.push({
          phase: game.phase,
          round: game.round,
          step: game.step,
        });
      }
      if (!stepSet.has(game.step)) {
        stepSet.add(game.step);
        evidence.steps.push({
          step: game.step,
          round: game.round,
          phase: game.phase,
        });
      }
      if (current.status === 'ended') break;
      let acted = false;
      for (const entry of phones) {
        const own = await view(entry.token);
        if (own.paused || !own.actions.length) continue;
        let action = (
          await bot.decide({
            view: own.gameView,
            actions: own.actions,
            decision: { id: own.decisionId, seatId: own.self.seatId },
            memory: null,
            difficulty: 'doubao',
            random: { next: () => 0.31 },
            signal: new AbortController().signal,
          })
        ).action;
        if (!sampled.has('bid') && own.gameView.phase === 'auction')
          action =
            own.actions.find((choice) => choice.type === 'bid') ?? action;
        if (
          !sampled.has('batch-purchase') &&
          own.gameView.phase === 'resources'
        )
          action =
            own.actions.find(
              (choice) =>
                choice.type === 'buy-resource' && (choice.quantity ?? 1) > 1,
            ) ?? action;
        assert.ok(
          own.actions.some((legal) => equal(legal, action)),
          'Driver only uses current authorized safe-view legalActions',
        );
        const command = { type: 'game', decisionId: own.decisionId, action };
        staleMessage ??= {
          token: entry.token,
          message: envelope(own, command),
        };
        if (
          (action.type === 'finish' &&
            own.gameView.phase === 'powering' &&
            !sampled.has('finish:powering')) ||
          (!sampled.has(action.type) &&
            [
              'select-regions',
              'offer',
              'bid',
              'buy-resource',
              'build',
              'run',
              'discard-plant',
            ].includes(action.type))
        )
          acted = await clickAction(entry, own, action);
        else acted = await send(entry.socket, entry.token, command);
        if (acted) {
          humanActions++;
          break;
        }
      }
      if (!acted) await sleep(25);
      if (Date.now() - lastProgress >= 30000) {
        console.log(
          JSON.stringify({
            progress: true,
            round: game.round,
            phase: game.phase,
            step: game.step,
            humanActions,
          }),
        );
        lastProgress = Date.now();
      }
    }
    const result = await view(hostToken);
    assert.equal(result.status, 'ended', 'Full natural mixed match completes');
    assert.equal(result.gameView.phase, 'ended');
    assert.ok(result.gameView.winners.length);
    evidence.finalResults = result.gameView.finalResults;
    evidence.winners = result.gameView.winners;
    evidence.finalRound = result.gameView.round;
    evidence.humanActions = humanActions;
    for (const phase of [
      'regions',
      'offer',
      'auction',
      'resources',
      'building',
      'powering',
      'ended',
    ])
      assert.ok(
        phaseSet.has(phase),
        'Natural five-stage flow includes ' + phase,
      );
    for (const action of [
      'select-regions',
      'offer',
      'bid',
      'buy-resource',
      'batch-purchase',
      'build',
      'run',
      'discard-plant',
      'finish:powering',
    ])
      assert.ok(sampled.has(action), 'Real phone control sampled: ' + action);
    await projectionAudit('Final result');
    await capture(host, 'final-host');
    await capture(publicPage, 'final-public');
    await capture(phones[0].page, 'final-phone');
    evidence.checks.push(
      'Full natural mixed match with actual Worker, five phases, exact mobile action controls and actual supply/cash/cities final ranking',
    );

    // A last durable before checkpoint is close to the natural ending, allowing
    // rollback/restart/replay coverage without regenerating a second whole game.
    const ownerBefore = result.ownerSeatId;
    await send(hostSocket, hostToken, {
      type: 'rollback',
      checkpointId: result.history.at(-1).id,
    });
    const rolled = await view(hostToken);
    assert.equal(rolled.paused, true);
    assert.ok(rolled.branch > result.branch);
    assert.equal(rolled.ownerSeatId, ownerBefore);
    const stale = await commandAt(
      phones.find((entry) => entry.token === staleMessage.token).socket,
      staleMessage.message,
    );
    assert.equal(stale.ok, false);
    assert.ok(
      [
        'stale-branch',
        'stale-revision',
        'stale-instance',
        'stale-decision',
      ].includes(stale.reason),
    );
    await projectionAudit('Rollback paused');
    if (withDisplay) await nativeMatrix();
    for (const socket of sockets) socket.disconnect();
    await desktop.close();
    desktop = null;
    await boot(true);
    const restored = await view(hostToken);
    assert.equal(restored.paused, true);
    assert.equal(restored.restored, true);
    assert.equal(restored.ownerSeatId, ownerBefore);
    assert.deepEqual(
      restored.gameView,
      rolled.gameView,
      'Real restart restores exact public game snapshot',
    );
    for (let i = 0; i < phones.length; i++) phones[i] = await phone(i, true);
    assert.deepEqual(
      (await view(hostToken)).seats.map(
        ({ id, name, avatarId, controller, botDifficulty }) => ({
          id,
          name,
          avatarId,
          controller,
          botDifficulty,
        }),
      ),
      identities,
      'Restart retains phone identities/avatars and bot levels',
    );
    await projectionAudit('Real SQLite restart');
    const staleAfterRestart = await commandAt(
      phones.find((entry) => entry.token === staleMessage.token).socket,
      staleMessage.message,
    );
    assert.equal(staleAfterRestart.ok, false);
    await capture(host, 'restart-host');
    await capture(phones[0].page, 'restart-phone');
    await send(phones[0].socket, phones[0].token, { type: 'resume' });
    await until(
      async () => {
        const current = await view(hostToken);
        assert.equal(current.botError, null);
        if (current.status === 'ended') return true;
        for (const entry of phones) {
          const own = await view(entry.token);
          if (!own.actions.length) continue;
          const action = (
            await bot.decide({
              view: own.gameView,
              actions: own.actions,
              decision: { id: own.decisionId, seatId: own.self.seatId },
              memory: null,
              difficulty: 'doubao',
              random: { next: () => 0.31 },
              signal: new AbortController().signal,
            })
          ).action;
          await send(entry.socket, entry.token, {
            type: 'game',
            decisionId: own.decisionId,
            action,
          });
          break;
        }
        return false;
      },
      'Restored branch legally finishes again',
      30000,
    );
    await phones[0].page
      .getByRole('button', { name: '原班人马再玩一局', exact: true })
      .click();
    await until(
      async () => (await view(hostToken)).status === 'lobby',
      'Real phone owner replay',
    );
    assert.deepEqual(
      (await view(hostToken)).seats.map(
        ({ id, name, avatarId, controller, botDifficulty }) => ({
          id,
          name,
          avatarId,
          controller,
          botDifficulty,
        }),
      ),
      identities,
    );
    evidence.checks.push(
      'Pause, real checkpoint rollback, old action rejection, same-origin SQLite restart, same phone owner/identity, natural restored ending and phone replay',
    );

    await host.evaluate(() => {
      window.powerGridSwitchDocument = true;
    });
    // Modern Art has max five seats; for six seats the compatible five-seat group
    // is explicitly formed through host management before testing both old games.
    if (seats > 5)
      await send(hostSocket, hostToken, {
        type: 'remove-seat',
        seatId: identities.at(-1).id,
      });
    const switchingIds = (await view(hostToken)).seats.map((seat) => seat.id);
    for (const [gameId, selector] of [
      ['pokemon-encounters', '.pokemon-screen'],
      ['modern-art', '.ma-screen'],
      ['power-grid', '.pg-screen'],
    ]) {
      await send(hostSocket, hostToken, { type: 'select-game', gameId });
      for (const entry of phones)
        await send(entry.socket, entry.token, { type: 'ready', ready: true });
      await send(hostSocket, hostToken, { type: 'start' });
      await host.locator(selector).waitFor();
      await send(hostSocket, hostToken, { type: 'pause' });
      assert.deepEqual(
        (await view(hostToken)).seats.map((seat) => seat.id),
        switchingIds,
        'Compatible switch preserves all remaining phone/bot seats',
      );
      await capture(host, 'switch-' + gameId);
      await send(hostSocket, hostToken, { type: 'end' });
    }
    assert.equal(
      await host.evaluate(() => window.powerGridSwitchDocument),
      true,
      'All three games reused one SPA document',
    );
    evidence.coexistingStyles = await host.evaluate(() =>
      [...document.styleSheets].map((sheet) => sheet.href ?? ''),
    );
    for (const name of ['pokemon-encounters', 'modern-art', 'power-grid'])
      assert.ok(
        evidence.coexistingStyles.some(
          (path) =>
            path.includes('/games/' + name + '/web/') && path.endsWith('.css'),
        ),
        name + ' CSS coexists in same SPA',
      );
    evidence.checks.push(
      'Both old game switches retain compatible identity/avatars; all three independent game stylesheets coexist in one document',
    );

    // Sample ordinary pacing on a new Power Grid region decision whose actor is
    // a real Worker. The minimum is a reminder of actual think time, not a test
    // shortcut around the authoritative action/persist pipeline.
    await send(hostSocket, hostToken, { type: 'replay' });
    await send(hostSocket, hostToken, { type: 'set-play-mode', mode: 'play' });
    for (const entry of phones)
      await send(entry.socket, entry.token, { type: 'ready', ready: true });
    await send(hostSocket, hostToken, { type: 'start' });
    await send(hostSocket, hostToken, { type: 'pause' });
    const botIds = new Set(
      (await view(hostToken)).seats
        .filter((seat) => seat.controller === 'bot')
        .map((seat) => seat.id),
    );
    for (let attempt = 0; attempt < 30; attempt++) {
      const current = await view(hostToken);
      if (botIds.has(current.gameView.actor)) break;
      await send(hostSocket, hostToken, { type: 'resume' });
      const entry = phones.find(
          (phone, index) => current.gameView.actor === identities[index].id,
        ),
        own = await view(entry.token);
      const action = own.actions[0];
      await send(entry.socket, entry.token, {
        type: 'game',
        decisionId: own.decisionId,
        action,
      });
      await send(hostSocket, hostToken, { type: 'pause' });
    }
    const ordinary = await view(hostToken);
    assert.ok(botIds.has(ordinary.gameView.actor));
    const beforeTime = performance.now(),
      beforeLog = ordinary.gameView.latest?.id;
    await send(hostSocket, hostToken, { type: 'resume' });
    await until(
      async () => (await view(hostToken)).gameView.latest?.id !== beforeLog,
      'Actual ordinary Worker decision saved',
      12000,
    );
    evidence.ordinaryWorkerDelayMs = Math.round(performance.now() - beforeTime);
    assert.ok(
      evidence.ordinaryWorkerDelayMs >= 1500,
      'Ordinary Worker decision retains real think pacing',
    );
    await send(hostSocket, hostToken, { type: 'pause' });
    evidence.checks.push(
      'Ordinary play timing samples an actual Worker saved decision separately from test-speed full match',
    );
  }
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.failure = { message: error.message, stack: error.stack };
  if (desktop)
    for (const [name, page] of [
      ['failure-host', host],
      ['failure-phone', phones[0]?.page],
    ])
      if (page && !page.isClosed()) await capture(page, name).catch(() => {});
  throw error;
} finally {
  for (const socket of sockets) socket.disconnect();
  if (desktop) await desktop.close();
  evidence.ownedDesktopClosed = true;
  if (origin) {
    try {
      await fetch(origin + '/api/health');
      evidence.serviceReachableAfterClose = true;
    } catch {
      evidence.serviceReachableAfterClose = false;
    }
  }
  if (evidence.runtime) {
    try {
      const audit = await execute(
        nodePath,
        [
          join(work, 'audit.cjs'),
          join(environment.TABLEMAX_DATA_DIR, 'room.sqlite'),
          runtimeRulesSnapshot,
        ],
        { env: environment, windowsHide: true, maxBuffer: 1000000 },
      );
      evidence.sqliteAudit = JSON.parse(audit.stdout.trim());
      if (evidence.result === 'passed' && !displayOnly) {
        assert.ok(
          evidence.sqliteAudit.replayed > 100,
          'Audit covers whole saved match',
        );
        for (const step of [1, 3])
          assert.ok(
            evidence.sqliteAudit.steps.includes(step),
            'Natural saved match includes STEP ' + step,
          );
        evidence.step2Observed = evidence.sqliteAudit.steps.includes(2);
        if (!evidence.step2Observed)
          evidence.checks.push(
            'Classic STEP 3 can validly skip STEP 2; this natural match went from STEP 1 directly to STEP 3 and every saved transition was independently replayed',
          );
        for (const id of evidence.identities
          .filter((seat) => seat.controller === 'bot')
          .map((seat) => seat.id))
          assert.ok(
            evidence.sqliteAudit.actors[id] > 10,
            'Each real Worker bot saved multiple legal decisions',
          );
        evidence.checks.push(
          'Every SQLite journal state validates 42-card plus STEP marker partition, finite fuel/cash conservation and final supply; each saved game action replays from its exact checkpoint/random source and is legal',
        );
      }
    } catch (error) {
      evidence.result = 'failed';
      evidence.sqliteAuditError = error.message;
      process.exitCode = 1;
    }
  }
  evidence.finishedAt = new Date().toISOString();
  evidence.elapsedSeconds =
    Math.round((performance.now() - started) / 10) / 100;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: evidence.result,
      output,
      elapsedSeconds: evidence.elapsedSeconds,
      sqliteAudit: evidence.sqliteAudit,
      failure: evidence.failure?.message ?? evidence.sqliteAuditError,
    }),
  );
}
