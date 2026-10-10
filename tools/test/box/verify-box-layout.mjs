import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { MAXIMUM_PACKAGE_BYTES } from '../../release/package-limits.mjs';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { launchDesktop } from '../support/desktop-test.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { playerFrame, playerUi } from '../support/player-test.mjs';

// This verifies real, authorized UI from the current delivery. It never writes
// checkpoints, assigns browser administrator credentials or opens a LAN port.
const version = JSON.parse(
  await readFile(resolve('package.json'), 'utf8'),
).version;
const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
const libraryOnly = process.argv.includes('--library-only');
const refinementsOnly =
  libraryOnly || process.argv.includes('--refinements-only');
const evidence =
  argument('evidence') ?? new Date().toISOString().replace(/[:.]/g, '-');
assert.match(
  evidence,
  /^[a-zA-Z0-9_-]+$/,
  'Evidence name must be a safe directory name',
);
const output = resolve(
  `artifacts/maintenance/v${version}/debug-20261008/box`,
  evidence,
);
const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
const manifestPath = archive.replace(/\.zip$/i, '-manifest.json');
const execute = promisify(execFile);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const wait = (milliseconds) =>
  new Promise((done) => setTimeout(done, milliseconds));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const clients = [],
  contexts = [],
  secrets = new Set();
let desktop, browser, host, publicPage, origin, hostToken, hostSocket, work;
const report = {
  version,
  mode: libraryOnly
    ? 'game-library'
    : refinementsOnly
      ? 'affected-dialogs'
      : 'full-box-matrix',
  status: 'running',
  scope: libraryOnly
    ? 'Actual current-version ZIP and all extracted members; hidden muted WinForms/WebView2 game-library dialog at 390, 720p and 1080p. Does not certify physical devices or unrelated dialogs.'
    : refinementsOnly
      ? 'Actual current-version ZIP and all extracted members; muted hidden WinForms/WebView2 host/public and headless Edge player iframe. Authorized lobby joins, owner and bot; affected game-library, avatar and connection-help dialogs at 390, 720p and 1080p. CSS viewport simulation does not certify physical Windows DPI, physical phones or public tunnels.'
      : 'Actual current-version ZIP and all extracted members; muted hidden WinForms/WebView2 host/public and headless Edge player iframe. Authorized lobby joins, owner, bots and device transfer. CSS viewport and 125/150 percent density simulation do not certify physical Windows DPI, physical phones or public tunnels.',
  layouts: [],
  dialogs: [],
  screenshots: [],
  issues: [],
  pageErrors: [],
  checks: [],
  contactSheets: [],
};
function redact(value) {
  let text = String(value);
  for (const secret of secrets)
    if (secret) text = text.replaceAll(secret, '[redacted]');
  return text;
}
async function save() {
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2),
  );
}
async function checked(message) {
  report.checks.push(message);
  console.log(message);
  await save();
}
async function until(predicate, description, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await wait(50);
  }
  throw new Error(description);
}
async function post(path, body) {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}
async function view(token = hostToken) {
  const result = await post('/api/session/view', { token });
  assert.equal(result.ok, true, result.reason ?? 'View rejected');
  return result.view;
}
async function connect(token) {
  const socket = io(origin, {
    auth: { token },
    transports: ['polling', 'websocket'],
    forceNew: true,
    timeout: 5000,
  });
  clients.push(socket);
  await new Promise((done, reject) => {
    socket.once('connect', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function command(value) {
  const before = await view();
  const reply = await hostSocket.timeout(5000).emitWithAck('room:command', {
    actionId: randomUUID(),
    instanceId: before.instanceId,
    branch: before.branch,
    revision: before.revision,
    command: value,
  });
  assert.equal(reply.ok, true, reply.reason ?? 'Command rejected');
  return view();
}
async function documentFor(surface) {
  return surface.player ? playerFrame(surface.page) : surface.page;
}
function ui(surface) {
  return surface.player ? playerUi(surface.page) : surface.page;
}
async function rendered(surface, state = null) {
  const current = state ?? (await view(surface.token ?? hostToken));
  await ui(surface)
    .locator(
      `[data-room-instance="${current.instanceId}"][data-room-branch="${current.branch}"][data-room-revision="${current.revision}"]`,
    )
    .waitFor();
  await ui(surface).locator('.box-screen').waitFor();
  const doc = await documentFor(surface);
  await doc.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) => image.decode().catch(() => {})),
    );
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
  });
}
async function connectionEntry(surface, expectedUrl) {
  const page = surface.page;
  const link = page.getByRole('link', {
    name: '使用网址，在浏览器中加入牌桌',
    exact: true,
  });
  await until(
    async () => (await link.getAttribute('href')) === expectedUrl,
    'Open-website link did not follow the current QR entry',
  );
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
  const before = await view();
  const originalUrl = page.url();
  const id = await page.evaluate(() => window.__tablemaxWindowId);
  const previous = (await desktop.request('windows')).find(
    (window) => window.id === id,
  ).externalJoin.count;
  await link.click();
  await until(async () => {
    const current = (await desktop.request('windows')).find(
      (window) => window.id === id,
    ).externalJoin;
    return current.count === previous + 1 && current.url === expectedUrl + '/';
  }, 'Trusted native website entry was not approved');
  assert.equal(page.url(), originalUrl, 'Entry displaced the desktop page');
  assert.equal((await view()).revision, before.revision);
  await checked(
    `${surface.role}: current QR and native open-website link matched; unchanged desktop page and game revision`,
  );
}
function observe(page) {
  page.on('pageerror', (error) =>
    report.pageErrors.push(redact(error.message)),
  );
}
async function newPlayer(name = null) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  contexts.push(context);
  const page = await context.newPage();
  observe(page);
  const surface = {
    page,
    player: true,
    role: name ? 'seated-player' : 'unseated-player',
  };
  await page.goto(origin + '/player');
  await rendered(surface);
  if (name) {
    await ui(surface).getByLabel('你的昵称', { exact: true }).fill(name);
    await ui(surface)
      .getByRole('button', { name: '加入', exact: true })
      .click();
    await ui(surface)
      .getByRole('button', { name: '我准备好了', exact: true })
      .waitFor();
    surface.token = await (
      await playerFrame(page)
    ).evaluate(() => localStorage.getItem('tablemax-player'));
    assert.ok(surface.token, 'Real UI admission did not retain identity');
    secrets.add(surface.token);
  }
  return surface;
}
const sizes = [
  { width: 390, height: 844, density: 1, label: '390' },
  { width: 1280, height: 720, density: 1, label: '720p' },
  { width: 1920, height: 1080, density: 1, label: '1080p' },
  { width: 3840, height: 2160, density: 1, label: '4k' },
  { width: 1536, height: 864, density: 1.25, label: '125pct' },
  { width: 1280, height: 720, density: 1.5, label: '150pct' },
];
async function resize(surface, size) {
  const { width, height, density } = size;
  surface.requestedGeometry = size;
  if (surface.native) {
    const win = await desktop.browserWindow(surface.page);
    await win.evaluate(
      (window, dimensions) =>
        window.setContentSize(dimensions.width, dimensions.height),
      { width, height },
    );
    const id = await surface.page.evaluate(() => window.__tablemaxWindowId);
    surface.nativeState = await desktop.request('window', {
      id,
      operation: 'geometry',
      geometry: {
        viewport: { width, height },
        screen: { width, height, scaleFactor: density },
      },
    });
  } else await surface.page.setViewportSize({ width, height });
  surface.cdp ??= await surface.page.context().newCDPSession(surface.page);
  await surface.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: surface.native ? 0 : width,
    height: surface.native ? 0 : height,
    deviceScaleFactor: density,
    mobile: false,
  });
  const expectedWidth = surface.native
    ? Math.round(surface.nativeState.content[0] / surface.nativeState.zoom)
    : width;
  const expectedHeight = surface.native
    ? Math.round(surface.nativeState.content[1] / surface.nativeState.zoom)
    : height;
  await until(
    async () =>
      surface.page.evaluate(
        ([w, h]) =>
          Math.abs(innerWidth - w) <= 1 && Math.abs(innerHeight - h) <= 1,
        [expectedWidth, expectedHeight],
      ),
    `Viewport did not settle at ${expectedWidth} x ${expectedHeight} (requested ${width} x ${height})`,
  );
  await wait(150);
  await (
    await documentFor(surface)
  ).evaluate(() => {
    window.scrollTo(0, 0);
    for (const dialog of document.querySelectorAll('dialog[open]'))
      dialog.scrollTop = 0;
  });
  await (
    await documentFor(surface)
  ).evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
}
async function screenshot(surface, name) {
  const path = join(output, name + '.png');
  if (surface.native) {
    const win = await desktop.browserWindow(surface.page);
    assert.equal(await win.evaluate((window) => window.isVisible()), false);
    const encoded = await win.evaluate(async (window) =>
      (await window.webContents.capturePage()).toPNG().toString('base64'),
    );
    await writeFile(path, Buffer.from(encoded, 'base64'));
  } else await surface.page.screenshot({ path, fullPage: false });
  const bytes = await readFile(path);
  report.screenshots.push({
    file: basename(path),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: hash(bytes),
  });
}
async function reviewSheets() {
  const groups = new Map();
  for (const entry of [...report.layouts, ...report.dialogs]) {
    const group = entry.label.replace(
      /-(390|720p|1080p|4k|125pct|150pct)$/,
      '',
    );
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(entry.label + '.png');
  }
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
  });
  try {
    const page = await context.newPage();
    for (const [group, files] of groups) {
      const figures = [];
      for (const file of files)
        figures.push(
          `<figure><figcaption>${file}</figcaption><img src="data:image/png;base64,${(await readFile(join(output, file))).toString('base64')}" /></figure>`,
        );
      await page.setContent(
        `<html><head><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#e9eee7;color:#173b32;font:16px Segoe UI,sans-serif}h1{font-size:24px;margin:0 0 16px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;padding:12px;background:white;border-radius:12px}figcaption{font-weight:600;overflow-wrap:anywhere;margin:0 0 10px}img{display:block;width:100%;height:480px;object-fit:contain;background:#f4f3ed}</style></head><body><h1>Actual screenshots: ${group}</h1><div class="grid">${figures.join('')}</div></body></html>`,
      );
      await page
        .locator('img')
        .evaluateAll((images) =>
          Promise.all(images.map((image) => image.decode())),
        );
      const filename = 'review-' + group + '.png';
      await page.screenshot({ path: join(output, filename), fullPage: true });
      report.contactSheets.push({ file: filename, originals: files });
    }
  } finally {
    await context.close();
  }
}
async function layout(surface, label, dialog = false) {
  const doc = await documentFor(surface);
  // Static dialog density is measured after dismissing transient feedback.
  // Notifications intentionally occupy the modal top layer and have separate
  // interaction coverage in verify-box-notifications.mjs.
  const notices = ui(surface).locator('.tablemax-notice button');
  for (const notice of await notices.all())
    if (await notice.isVisible()) await notice.click();
  await ui(surface).locator('.tablemax-notice').waitFor({ state: 'hidden' });
  const metrics = await doc.evaluate(() => {
    const root =
      [...document.querySelectorAll('dialog[open]')].at(-1) ??
      document.querySelector('.box-screen');
    const shown = (element) => {
      const css = getComputedStyle(element),
        rect = element.getBoundingClientRect();
      return (
        css.display !== 'none' &&
        css.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0 &&
        element.checkVisibility({ checkVisibilityCSS: true }) &&
        !element.closest('[hidden], [inert]')
      );
    };
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const issues = [],
      controls = [];
    const gameTitle = root.querySelector('.box-game-title h1');
    if (
      gameTitle &&
      gameTitle.innerText.length > 6 &&
      gameTitle.getBoundingClientRect().width <
        parseFloat(getComputedStyle(gameTitle).fontSize) * 3
    )
      issues.push({
        kind: 'narrow-game-title',
        text: gameTitle.innerText,
        ...box(gameTitle),
      });
    const textLines = (element) => {
      const lines = new Map();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        let offset = 0;
        for (const character of node.textContent) {
          const range = document.createRange();
          range.setStart(node, offset);
          offset += character.length;
          range.setEnd(node, offset);
          if (!character.trim()) continue;
          const rect = range.getBoundingClientRect();
          const top = Math.round(rect.top);
          lines.set(top, (lines.get(top) ?? '') + character);
        }
      }
      return [...lines.values()];
    };
    for (const title of root.querySelectorAll('.game-library__item h3')) {
      if (!shown(title)) continue;
      const lines = textLines(title);
      if (title.innerText.length > 6 && lines.at(-1)?.length === 1)
        issues.push({
          kind: 'orphan-game-library-title',
          text: title.innerText,
          lines,
          ...box(title),
        });
    }
    for (const version of root.querySelectorAll(
      '.game-library__item > div > button',
    )) {
      if (!shown(version)) continue;
      const lines = textLines(version);
      if (lines.length > 1)
        issues.push({
          kind: 'wrapped-game-library-version',
          text: version.innerText,
          lines,
          ...box(version),
        });
    }
    for (const element of root.querySelectorAll(
      'button, input:not([type="file"]), select, a.button, summary',
    )) {
      if (!shown(element)) continue;
      const rect = box(element),
        text =
          element.getAttribute('aria-label') ||
          element.innerText ||
          element.getAttribute('name') ||
          element.tagName;
      controls.push({
        text: text.trim().slice(0, 80),
        ...rect,
        disabled: Boolean(element.disabled),
      });
      if (rect.height < 43.5 || rect.width < 43.5)
        issues.push({
          kind: 'small-control',
          text: text.trim().slice(0, 80),
          ...rect,
        });
      if (
        element.scrollWidth > element.clientWidth + 2 &&
        !element.matches('input, select')
      )
        issues.push({
          kind: 'control-content-overflow',
          text: text.trim().slice(0, 80),
          ...rect,
        });
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let node;
    while ((node = walker.nextNode())) {
      const element = node.parentElement,
        text = node.textContent.trim();
      if (
        !text ||
        !shown(element) ||
        element.closest('svg, option, script, style') ||
        seen.has(element)
      )
        continue;
      seen.add(element);
      const font = parseFloat(getComputedStyle(element).fontSize);
      if (font < 15.9)
        issues.push({
          kind: 'small-text',
          text: text.slice(0, 80),
          font,
          ...box(element),
        });
    }
    const buttons = [...root.querySelectorAll('button, a.button')].filter(
      shown,
    );
    for (let first = 0; first < buttons.length; first++)
      for (let second = first + 1; second < buttons.length; second++) {
        const a = buttons[first],
          b = buttons[second];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect(),
          rb = b.getBoundingClientRect();
        if (
          Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 2 &&
          Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > 2
        )
          issues.push({
            kind: 'overlapping-buttons',
            text: a.innerText.slice(0, 30),
            other: b.innerText.slice(0, 30),
          });
      }
    for (const element of root.querySelectorAll(
      '.room-table__name, .player-profile strong',
    )) {
      if (!shown(element)) continue;
      if (element.scrollHeight > element.clientHeight + 2)
        issues.push({
          kind: 'clipped-name',
          text: element.innerText,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        });
    }
    const seats = [...root.querySelectorAll('.room-table__seat')].filter(shown);
    for (let first = 0; first < seats.length; first++)
      for (let second = first + 1; second < seats.length; second++) {
        const a = seats[first].getBoundingClientRect(),
          b = seats[second].getBoundingClientRect();
        if (
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2
        )
          issues.push({
            kind: 'overlapping-seats',
            first: first + 1,
            second: second + 1,
          });
      }
    const overflow = document.documentElement.scrollWidth - innerWidth;
    if (overflow > 2) issues.push({ kind: 'horizontal-overflow', overflow });
    if (root.matches('dialog') && root.scrollWidth > root.clientWidth + 2)
      issues.push({
        kind: 'dialog-horizontal-overflow',
        overflow: root.scrollWidth - root.clientWidth,
      });
    return {
      width: innerWidth,
      height: innerHeight,
      density: devicePixelRatio,
      bodyHeight: document.documentElement.scrollHeight,
      root: box(root),
      controls,
      issues,
    };
  });
  if (surface.player) {
    const frame = await surface.page
      .locator('iframe[data-player-frame]')
      .boundingBox();
    metrics.frameBounds = frame;
    const outerWidth = await surface.page.evaluate(() => innerWidth);
    if (!frame || frame.width > Math.min(480, outerWidth) + 0.5)
      metrics.issues.push({
        kind: 'player-frame-width',
        frameBounds: frame,
        outerWidth,
      });
    if (frame && Math.abs(frame.x + frame.width / 2 - outerWidth / 2) >= 2)
      metrics.issues.push({
        kind: 'player-frame-centering',
        frameBounds: frame,
        outerWidth,
      });
    if (frame && metrics.width !== Math.round(frame.width))
      metrics.issues.push({
        kind: 'player-frame-document-width',
        frameBounds: frame,
        documentWidth: metrics.width,
      });
  }
  // Trial clicks scroll each live button into view, verify hit testing and avoid
  // invoking commands. A tall phone dialog is valid if every control is reachable.
  const root = ui(surface)
    .locator(dialog ? 'dialog[open]' : '.box-screen')
    .last();
  for (const button of await root
    .locator('button:not(:disabled), a.button')
    .all()) {
    if (!(await button.isVisible())) continue;
    try {
      await button.click({ trial: true, timeout: 2000 });
    } catch (error) {
      metrics.issues.push({
        kind: 'unreachable-button',
        text: (await button.innerText()).slice(0, 80),
        reason: redact(error.message).slice(0, 350),
      });
    }
  }
  const entry = {
    label,
    role: surface.role,
    requestedGeometry: surface.requestedGeometry,
    nativeState: surface.nativeState,
    ...metrics,
  };
  (dialog ? report.dialogs : report.layouts).push(entry);
  report.issues.push(
    ...metrics.issues.map((issue) => ({ label, role: surface.role, ...issue })),
  );
  await doc.evaluate(() => {
    window.scrollTo(0, 0);
    for (const panel of document.querySelectorAll('dialog[open]'))
      panel.scrollTop = 0;
  });
  await save();
  return metrics;
}
async function dialogMatrix(
  surface,
  buttonName,
  title,
  prefix,
  configure = null,
) {
  for (const size of sizes.slice(0, refinementsOnly ? 3 : 2)) {
    await resize(surface, size);
    await ui(surface)
      .getByRole('button', { name: buttonName, exact: true })
      .click();
    const panel = ui(surface).getByRole('dialog', { name: title, exact: true });
    await panel.waitFor();
    if (configure) await configure(panel);
    await layout(surface, `${prefix}-${size.label}`, true);
    await screenshot(surface, `${prefix}-${size.label}`);
    await panel.getByRole('button', { name: '关闭面板', exact: true }).click();
  }
}
async function verifyPackage() {
  const bytes = await readFile(archive),
    manifestBytes = await readFile(manifestPath),
    manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.version, version);
  assert.equal(manifest.archive.name, basename(archive));
  report.archiveSha256 = hash(bytes);
  report.manifestSha256 = hash(manifestBytes);
  assert.equal(report.archiveSha256, manifest.archive.sha256);
  assert.equal(bytes.length, manifest.archive.bytes);
  if (argument('sha256'))
    assert.equal(report.archiveSha256, argument('sha256').toLowerCase());
  assert.ok(
    bytes.length < MAXIMUM_PACKAGE_BYTES &&
      manifest.extractedBytes < MAXIMUM_PACKAGE_BYTES,
  );
  await mkdir(resolve('tmp'), { recursive: true });
  work = await mkdtemp(resolve('tmp/box-layout-'));
  report.work = relative(resolve('.'), work).replaceAll('\\', '/');
  const portable = join(work, 'portable');
  await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:BOX_ARCHIVE -DestinationPath $env:BOX_EXTRACT',
    ],
    {
      windowsHide: true,
      env: { ...process.env, BOX_ARCHIVE: archive, BOX_EXTRACT: portable },
    },
  );
  let total = 0;
  const expected = new Set(),
    actual = new Set();
  for (const file of manifest.files) {
    const path = resolve(portable, file.path);
    assert.ok(
      path.startsWith(portable + sep),
      'Manifest path escapes portable root',
    );
    const member = await readFile(path);
    assert.equal(member.length, file.bytes, file.path);
    assert.equal(hash(member), file.sha256, file.path);
    total += member.length;
    expected.add(file.path.replaceAll('\\', '/'));
  }
  async function inventory(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      assert.equal(item.isSymbolicLink(), false);
      const path = join(directory, item.name);
      if (item.isDirectory()) await inventory(path);
      else actual.add(relative(portable, path).replaceAll('\\', '/'));
    }
  }
  await inventory(portable);
  assert.deepEqual(actual, expected);
  assert.equal(total, manifest.extractedBytes);
  assert.equal(actual.size, manifest.fileCount);
  report.extracted = { files: actual.size, bytes: total };
  await checked(
    'Current delivery ZIP, manifest SHA, every extracted member and both portable byte limits verified',
  );
  return portable;
}

await mkdir(output, { recursive: true });
try {
  const portable = await verifyPackage();
  if (!process.argv.includes('--preflight-only')) {
    desktop = await launchDesktop({
      executablePath: join(portable, 'TableMax.exe'),
      soundEnabled: false,
      env: {
        TABLEMAX_TEST_CAPTURE_EXTERNAL: '1',
        TABLEMAX_HOST: '127.0.0.1',
        TABLEMAX_PORT: '0',
        TABLEMAX_DATA_DIR: join(work, 'data'),
      },
    });
    host = await desktop.firstWindow();
    observe(host);
    await host.locator('[data-room-revision]').waitFor();
    origin = new URL(host.url()).origin;
    assert.equal(new URL(origin).hostname, '127.0.0.1');
    hostToken = await host.evaluate(() =>
      sessionStorage.getItem('tablemax-host'),
    );
    assert.ok(hostToken);
    secrets.add(hostToken);
    hostSocket = await connect(hostToken);
    browser = await launchTestBrowser({
      channel: 'msedge',
      headless: true,
      soundEnabled: false,
    });
    await command({ type: 'select-game', gameId: 'modern-art' });
    const chinese = await newPlayer('蓝天白云与朋友们一起探索奇妙桌游世界');
    const english = await newPlayer('AlexandraLongPlayerName');
    const unseated = await newPlayer();
    await command({
      type: 'add-bot',
      name: '默认人机伙伴',
      difficulty: 'default',
    });
    await command({
      type: 'set-owner',
      seatId: (await view(chinese.token)).self.seatId,
    });
    const publicEvent = desktop.waitForEvent('window');
    await desktop.request('open-public');
    publicPage = await publicEvent;
    observe(publicPage);
    const hostSurface = { page: host, role: 'host', native: true },
      publicSurface = { page: publicPage, role: 'public', native: true };
    const surfaces = [unseated, chinese, hostSurface, publicSurface];
    if (refinementsOnly) {
      for (const surface of surfaces) await rendered(surface);
      await dialogMatrix(hostSurface, '切换游戏', '游戏库', 'host-library');
      if (!libraryOnly) {
        const expandTroubleshooting = async (panel) => {
          await panel.getByText('手机扫码', { exact: true }).waitFor();
          await panel.getByText('直接打开', { exact: true }).waitFor();
          await panel.locator('summary').click();
        };
        await dialogMatrix(
          hostSurface,
          '连接帮助',
          '连接帮助',
          'host-connection',
          async (panel) => {
            await panel
              .getByLabel('外部入口网址', { exact: true })
              .fill(origin + '/player');
            await panel
              .getByRole('button', { name: '保存外部入口', exact: true })
              .click();
            await panel.getByText('二维码已更新。', { exact: true }).waitFor();
            await expandTroubleshooting(panel);
          },
        );
        await dialogMatrix(
          publicSurface,
          '连接帮助',
          '连接帮助',
          'public-connection',
          async (panel) => {
            assert.equal(
              await panel.getByLabel('外部入口网址', { exact: true }).count(),
              0,
              'Public screen must not edit the network entry',
            );
            await expandTroubleshooting(panel);
          },
        );
        await connectionEntry(hostSurface, origin);
        await connectionEntry(publicSurface, origin);
        await dialogMatrix(
          unseated,
          '选择头像',
          '选择头像',
          'player-avatar-unseated',
        );
        await dialogMatrix(
          chinese,
          '更换头像',
          '选择头像',
          'player-avatar-seated',
        );
      }
      assert.deepEqual(report.pageErrors, []);
      await checked(
        libraryOnly
          ? 'Actual game-library dialog recorded at 390, 720p and 1080p'
          : 'Affected authorized game-library, avatar and host/public connection-help dialogs recorded at 390, 720p and 1080p',
      );
      await reviewSheets();
    } else {
      for (const selection of [
        { id: 'modern-art' },
        { id: 'power-grid' },
        { id: 'pokemon-encounters', variant: 'original' },
        { id: 'pokemon-encounters', variant: 'expansion' },
      ]) {
        await command({ type: 'select-game', gameId: selection.id });
        if (selection.variant)
          await command({
            type: 'select-variant',
            variantId: selection.variant,
          });
        const gameLabel =
          selection.id + (selection.variant ? '-' + selection.variant : '');
        for (const surface of surfaces) {
          await rendered(surface);
          for (const size of sizes) {
            await resize(surface, size);
            const label = `${gameLabel}-${surface.role}-${size.label}`;
            await layout(surface, label);
            await screenshot(surface, label);
          }
        }
        await checked(
          `${gameLabel}: four authorized box roles, six viewport/density combinations and reachable controls recorded`,
        );
      }
      await command({ type: 'select-game', gameId: 'modern-art' });
      for (const surface of surfaces) await rendered(surface);
      await dialogMatrix(
        hostSurface,
        '管理设置',
        '管理设置',
        'host-management',
      );
      await dialogMatrix(
        hostSurface,
        '连接帮助',
        '连接帮助',
        'host-connection',
        async (panel) => {
          await panel
            .getByLabel('外部入口网址', { exact: true })
            .fill(origin + '/player');
          await panel
            .getByRole('button', { name: '保存外部入口', exact: true })
            .click();
          await panel.getByText('二维码已更新。', { exact: true }).waitFor();
          await panel.locator('summary').click();
        },
      );
      await dialogMatrix(
        publicSurface,
        '连接帮助',
        '连接帮助',
        'public-connection',
        async (panel) => {
          assert.equal(
            await panel.getByLabel('外部入口网址', { exact: true }).count(),
            0,
            'Public screen must not edit the network entry',
          );
          await panel.locator('summary').click();
        },
      );
      await resize(hostSurface, sizes[1]);
      await host.locator('.qr[src="/api/foundation/qr?external=1"]').waitFor();
      await connectionEntry(hostSurface, origin);
      await connectionEntry(publicSurface, origin);
      await screenshot(hostSurface, 'host-external-qr-720p');
      await host.getByRole('button', { name: '连接帮助', exact: true }).click();
      await host
        .getByRole('button', { name: '使用局域网', exact: true })
        .click();
      await host.getByText('已切回局域网二维码。', { exact: true }).waitFor();
      await host.getByRole('button', { name: '关闭面板', exact: true }).click();
      await checked(
        'Real administrator UI saved a loopback external entry and restored LAN; public help remained read-only',
      );
      await dialogMatrix(
        hostSurface,
        '游戏设置',
        '游戏设置',
        'host-game-settings',
      );
      await dialogMatrix(
        hostSurface,
        '座位设置',
        '座位设置',
        'host-seat-settings',
      );
      await dialogMatrix(hostSurface, '切换游戏', '游戏库', 'host-library');
      await dialogMatrix(
        unseated,
        '选择头像',
        '选择头像',
        'player-avatar-unseated',
      );
      await dialogMatrix(
        chinese,
        '更换头像',
        '选择头像',
        'player-avatar-seated',
      );
      await dialogMatrix(
        unseated,
        '换手机进入',
        '换手机进入',
        'player-transfer-empty',
      );
      await resize(unseated, sizes[0]);
      await ui(unseated)
        .getByRole('button', { name: '换手机进入', exact: true })
        .click();
      await ui(unseated)
        .getByLabel('原座位', { exact: true })
        .selectOption((await view(english.token)).self.seatId);
      await ui(unseated)
        .getByRole('button', { name: '申请接续座位', exact: true })
        .click();
      await ui(unseated).locator('.device-transfer__code strong').waitFor();
      await layout(unseated, 'player-transfer-pending-390', true);
      await screenshot(unseated, 'player-transfer-pending-390');
      await ui(unseated)
        .getByRole('button', { name: '关闭面板', exact: true })
        .click();
      await until(
        async () => (await view()).transferRequests?.length === 1,
        'Transfer request did not reach host',
      );
      await resize(hostSurface, sizes[1]);
      await host.getByRole('button', { name: '管理设置', exact: true }).click();
      await host.locator('.device-transfer-request').waitFor();
      await layout(hostSurface, 'host-transfer-request-720p', true);
      await screenshot(hostSurface, 'host-transfer-request-720p');
      await host.getByRole('button', { name: '批准换机', exact: true }).click();
      await host
        .getByRole('dialog', { name: '批准换机', exact: true })
        .waitFor();
      await layout(hostSurface, 'host-transfer-confirmation-720p', true);
      await screenshot(hostSurface, 'host-transfer-confirmation-720p');
      await host
        .getByRole('button', { name: '批准并退出旧设备', exact: true })
        .click();
      await ui(unseated)
        .getByRole('button', { name: '我准备好了', exact: true })
        .waitFor();
      const restored = await (
        await playerFrame(unseated.page)
      ).evaluate(() => localStorage.getItem('tablemax-player'));
      assert.ok(restored);
      secrets.add(restored);
      assert.equal(
        (await view(restored)).self.seatId,
        (await view()).seats.find(
          (seat) => seat.name === 'AlexandraLongPlayerName',
        ).id,
      );
      await checked(
        'Real administrator transfer request, verification code and approval confirmation rendered; approval retained original seat',
      );
      assert.deepEqual(report.pageErrors, []);
      await reviewSheets();
    }
  }
  assert.equal(
    hash(await readFile(archive)),
    report.archiveSha256,
    'Delivery changed during validation',
  );
  assert.equal(
    hash(await readFile(manifestPath)),
    report.manifestSha256,
    'Manifest changed during validation',
  );
  report.status = report.issues.length ? 'layout-issues-found' : 'passed';
  await save();
  console.log(
    `Box layout result: ${report.status}; ${report.layouts.length} layouts, ${report.dialogs.length} dialogs, ${report.issues.length} issues; ${output}`,
  );
  if (report.issues.length) process.exitCode = 1;
} catch (error) {
  report.status = 'failed';
  report.error = redact(error.stack ?? error.message);
  await save();
  console.error(report.error);
  process.exitCode = 1;
} finally {
  for (const client of clients) client.disconnect();
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close().catch(() => {});
  await desktop?.close().catch((error) => {
    console.error(redact(error.message));
    process.exitCode = 1;
  });
}
