import {
  captureMatrixScreenshot,
  browserScreenshotMetrics,
} from '../../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from '../../../release/package-limits.mjs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, dirname, isAbsolute } from 'node:path';
import {
  launchDesktop,
  desktopExecutable,
} from '../../support/desktop-test.mjs';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const requestedExecutable = process.argv
  .find((value) => value.startsWith('--executable='))
  ?.slice(13);
if (requestedExecutable) {
  assert.ok(
    isAbsolute(requestedExecutable),
    'Executable must be an absolute path',
  );
  assert.ok(!portable, '--executable and --portable are mutually exclusive');
}
const layoutOnly = process.argv.includes('--layout-only');
const requestedCounts = process.argv
  .find((value) => value.startsWith('--counts='))
  ?.slice(9)
  .split(',')
  .map(Number);
if (requestedCounts)
  assert.ok(
    requestedCounts.length > 0 &&
      requestedCounts.every((count) => [3, 4, 5].includes(count)),
  );
const continueFindings = process.argv.includes('--continue-findings');
const diagnostic = process.argv.includes('--diagnostic');
const representative = diagnostic || process.argv.includes('--representative');
const requestedStages = process.argv
  .find((value) => value.startsWith('--stages='))
  ?.slice(9)
  .split(',');
if (requestedStages)
  assert.ok(
    requestedStages.every((stage) =>
      [
        'offer',
        'collections',
        'auction-open',
        'auction-once',
        'auction-sealed',
        'auction-fixed',
        'auction-double',
        'result',
        'ended',
      ].includes(stage),
    ),
  );
const name =
  process.argv.find((v) => v.startsWith('--evidence='))?.slice(11) ??
  `v2-${Date.now()}`;
assert.match(name, /^[a-z0-9-]{1,48}$/);
const output = resolve(
  'artifacts/maintenance/v1.0.2/modern-art-polish-20261005/ui-v2',
  name,
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/modern-art-polish-v2-'));
const began = performance.now();
const report = {
  result: 'started',
  portable,
  representative,
  requestedStages,
  continueFindings,
  layoutOnly,
  requestedCounts,
  requestedExecutable,
  work,
  scope:
    'Actual hidden, nonactivated WebView2 + authoritative loopback service + legally prepared SQLite saves. Native size/test geometry and CDP density simulate desktop resolutions and DPI; isolated player WebView2 simulates short touch phones. No physical monitor/phone/network certification.',
  assertions: 0,
  checks: [],
  layouts: [],
  screenshots: [],
  failures: [],
  pageErrors: [],
  externalRequests: [],
  fixtures: [],
};
let executablePath = requestedExecutable ?? desktopExecutable;
if (portable) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
  const extracted = join(work, 'extracted');
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_V2_ARCHIVE -DestinationPath $env:TABLEMAX_V2_EXTRACT',
    ],
    {
      env: {
        ...process.env,
        TABLEMAX_V2_ARCHIVE: archive,
        TABLEMAX_V2_EXTRACT: extracted,
      },
      windowsHide: true,
    },
  );
  const archiveBytes = await readFile(archive);
  report.archiveSha256 = createHash('sha256')
    .update(archiveBytes)
    .digest('hex');
  const manifestPath = resolve(
    `artifacts/releases/TableMax-${version}-win-x64-manifest.json`,
  );
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(
    manifest.archive.bytes,
    archiveBytes.length,
    'Portable ZIP byte count matches manifest',
  );
  assert.equal(
    manifest.archive.sha256,
    report.archiveSha256,
    'Portable ZIP hash matches manifest',
  );
  assert.ok(
    archiveBytes.length < MAXIMUM_PACKAGE_BYTES,
    'Portable ZIP remains strictly below 120 MB',
  );
  const extractedPaths = [];
  async function enumerate(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.ok(
        !entry.isSymbolicLink(),
        'Portable extraction contains no links',
      );
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory())
        await enumerate(join(directory, entry.name), relative);
      else if (entry.isFile()) extractedPaths.push(relative);
      else assert.fail('Unexpected portable filesystem entry');
    }
  }
  await enumerate(extracted);
  assert.equal(
    new Set(manifest.files.map((file) => file.path)).size,
    manifest.files.length,
    'Manifest paths are unique',
  );
  assert.equal(manifest.fileCount, manifest.files.length);
  assert.deepEqual(
    extractedPaths.sort(),
    manifest.files.map((file) => file.path).sort(),
    'No missing or extra portable files',
  );
  let extractedBytes = 0;
  for (const file of manifest.files) {
    assert.ok(
      !file.path.startsWith('/') &&
        !file.path.includes('..') &&
        !file.path.includes(':'),
      'Manifest contains only relative safe paths',
    );
    const bytes = await readFile(join(extracted, file.path));
    assert.equal(bytes.length, file.bytes, `Portable bytes: ${file.path}`);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      file.sha256,
      `Portable SHA-256: ${file.path}`,
    );
    extractedBytes += bytes.length;
  }
  assert.equal(extractedBytes, manifest.extractedBytes);
  assert.equal(extractedBytes, manifest.unpackedBytes);
  assert.ok(
    extractedBytes <= PACKAGE_BUDGET_BYTES &&
      extractedBytes < MAXIMUM_PACKAGE_BYTES,
    'Actual portable extraction meets 114 MB engineering budget and strict 120 MB gate',
  );
  report.portableInventory = {
    result: 'passed',
    manifestPath,
    manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    archiveBytes: archiveBytes.length,
    extractedBytes,
    files: extractedPaths.length,
    zipSha256: report.archiveSha256,
  };
  executablePath = join(extracted, 'TableMax.exe');
}
report.executable = executablePath;
report.executableSha256 = createHash('sha256')
  .update(await readFile(executablePath))
  .digest('hex');
report.bundledNode = join(dirname(executablePath), 'node.exe');
report.bundledNodeSha256 = createHash('sha256')
  .update(await readFile(report.bundledNode))
  .digest('hex');
let desktop, origin, host, publicPage, phone, hostToken, hostSocket, phoneToken;
const sockets = [];
const sessions = new Map();
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function save() {
  report.elapsedSeconds = (performance.now() - began) / 1000;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
function check(ok, label, detail) {
  report.assertions++;
  if (!ok) report.failures.push({ label, detail });
}
async function state(token = '') {
  const response = await fetch(origin + '/api/session/view', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(token ? { token } : {}),
  });
  const result = await response.json();
  assert.equal(result.ok, true);
  return result.view;
}
async function socket(token) {
  const connection = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: token ? { token } : {},
  });
  sockets.push(connection);
  await new Promise((done, reject) => {
    connection.once('room:view', done);
    connection.once('connect_error', reject);
  });
  return connection;
}
async function command(value, token = hostToken, connection = hostSocket) {
  const view = await state(token);
  const reply = await new Promise((done, reject) =>
    connection.timeout(5000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: view.instanceId,
        revision: view.revision,
        branch: view.branch,
        command: value,
      },
      (error, result) => (error ? reject(error) : done(result)),
    ),
  );
  assert.equal(reply.ok, true, JSON.stringify(reply));
}
function observe(page) {
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin)
      report.externalRequests.push(request.url());
  });
}
async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  await wait(100);
}
async function native(page) {
  const id = await page.evaluate(() => window.__tablemaxWindowId);
  return (await desktop.request('windows')).find((s) => s.id === id);
}
async function resize(page, width, height, mobile = false, dpi = 1) {
  const win = await desktop.browserWindow(page);
  const density = mobile
    ? 1
    : await win.evaluate((w) => w.getBounds().width / w.getContentSize()[0]);
  await win.evaluate(
    (w, size) => w.setContentSize(size[0], size[1]),
    [Math.round(width / density), Math.round(height / density)],
  );
  let cdp = sessions.get(page);
  if (!cdp) {
    cdp = await page.context().newCDPSession(page);
    sessions.set(page, cdp);
  }
  if (!mobile) {
    const current = await native(page);
    await desktop.request('window', {
      id: current.id,
      operation: 'geometry',
      geometry: {
        viewport: { width: current.content[0], height: current.content[1] },
        screen: { width, height, scaleFactor: dpi },
      },
    });
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: mobile ? width : 0,
    height: mobile ? height : 0,
    deviceScaleFactor: dpi,
    mobile,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: mobile,
    maxTouchPoints: 5,
  });
  await settle(page);
}
async function capture(page, label) {
  await settle(page);
  const win = await desktop.browserWindow(page);
  assert.equal(await win.evaluate((w) => w.isVisible()), false);
  const screenshot = await captureMatrixScreenshot(
    join(output, label + '.png'),
    async () =>
      Buffer.from(
        await win.evaluate(async (w) =>
          (await w.webContents.capturePage()).toPNG().toString('base64'),
        ),
        'base64',
      ),
    await browserScreenshotMetrics(
      page,
      await win.evaluate((w) => w.webContents.getZoomFactor()),
    ),
    { state: label },
  );
  const bytes = screenshot.image;
  const filename = screenshot.path;
  report.screenshots.push({
    filename,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: screenshot.sha256,
  });
}
async function openPhone(token) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, options) => {
      const window = new BrowserWindow({
        show: false,
        width: 360,
        height: 640,
        webPreferences: { partition: options.partition, offscreen: true },
      });
      void window.loadURL(options.origin + '/player');
    },
    { origin, partition: `persist:ma-v2-${randomUUID()}` },
  );
  const page = await next;
  observe(page);
  await page.waitForURL('**/player');
  await page.evaluate(
    (token) => localStorage.setItem('tablemax-player', token),
    token,
  );
  await page.goto(origin + '/player/game');
  await page.locator('.ma-wallet').waitFor();
  await resize(page, 360, 640, true);
  return page;
}
async function stop() {
  for (const connection of sockets.splice(0)) connection.disconnect();
  for (const session of sessions.values())
    await session.detach().catch(() => {});
  sessions.clear();
  if (desktop) await desktop.close();
  desktop = null;
}
async function start(fixture, entry) {
  const env = {
    ...process.env,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
    TABLEMAX_DATA_DIR: entry.dataDir,
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  delete env.NODE_PATH;
  if (portable)
    env.PATH = `${process.env.SystemRoot};${join(process.env.SystemRoot, 'System32')};${join(process.env.SystemRoot, 'System32/Wbem')}`;
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-play-mode'],
    env,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  observe(host);
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  hostSocket = await socket(hostToken);
  await host.goto(origin + '/host/game');
  await host.locator('.ma-screen').waitFor();
  assert.equal((await state(hostToken)).seats.length, fixture.count);
  if ((await state(hostToken)).paused && entry.id !== 'paused')
    await command({ type: 'resume' });
  phoneToken = fixture.players[0].token;
  for (const player of fixture.players)
    if (
      (await state(player.token)).actions.some(
        (a) => a.type === 'add-double',
      ) ||
      (await state(player.token)).decisionId
    ) {
      phoneToken = player.token;
      break;
    }
  phone = await openPhone(phoneToken);
  const next = desktop.waitForEvent('window');
  await desktop.request('open-public');
  publicPage = await next;
  observe(publicPage);
  await publicPage.goto(origin + '/public/game');
  await publicPage.locator('.ma-screen').waitFor();
  report.checks.push({
    label: `${fixture.count}-${entry.id} startup`,
    runtime: await desktop.request('runtime'),
    listening: origin,
  });
}
async function layout(page, label, mobile = false) {
  const authority = (await state(mobile ? phoneToken : hostToken)).gameView;
  const snapshot = await page.evaluate(() => {
    const shown = (e) =>
      !!e.getClientRects().length &&
      getComputedStyle(e).visibility !== 'hidden';
    const rect = (e) => {
      const r = e.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      };
    };
    const scrollable = (e) => {
      const css = getComputedStyle(e);
      return (
        /(auto|scroll)/.test(css.overflowY) &&
        e.scrollHeight > e.clientHeight + 2
      );
    };
    const nested = [];
    for (const element of document.querySelectorAll(
      '.ma-screen *, dialog[open] *',
    )) {
      if (!shown(element) || !scrollable(element)) continue;
      for (
        let ancestor = element.parentElement;
        ancestor;
        ancestor = ancestor.parentElement
      )
        if (scrollable(ancestor)) {
          nested.push({ inner: element.className, outer: ancestor.className });
          break;
        }
    }
    const museums = [
      ...document.querySelectorAll('.ma-museum__collection'),
    ].map((e) => ({
      rect: rect(e),
      cards: [...e.querySelectorAll('.ma-card')].map((c) => ({
        rect: rect(c),
        artist: c.dataset.artistId,
        visibleArtist:
          !!c.querySelector('.ma-card__artist-name') &&
          shown(c.querySelector('.ma-card__artist-name')),
        auction: c.querySelector('.ma-card__foot > span')?.textContent,
      })),
    }));
    return {
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      nested,
      sections: Object.fromEntries(
        [
          '.ma-table',
          '.ma-market',
          '.ma-museums',
          '.ma-table-footer',
          '.ma-center',
        ].map((selector) => {
          const e = document.querySelector(selector);
          if (!e) return [selector, null];
          const style = getComputedStyle(e);
          return [
            selector,
            {
              ...rect(e),
              rows: style.gridTemplateRows,
              columns: style.gridTemplateColumns,
              minHeight: style.minHeight,
              overflowY: style.overflowY,
              flex: style.flex,
            },
          ];
        }),
      ),
      gallery: document.querySelector('.ma-table > .ma-museums')
        ? rect(document.querySelector('.ma-table > .ma-museums'))
        : null,
      lifecycleControls: [...document.querySelectorAll('.ma-next-round')]
        .filter(shown)
        .map((e) => ({
          text: e.textContent.trim(),
          rect: rect(e),
          font: parseFloat(getComputedStyle(e).fontSize),
          center: rect(e.closest('.ma-center')),
        })),
      championLabels: [
        ...document.querySelectorAll('.ma-results__champion-label'),
      ]
        .filter(shown)
        .map((e) => ({ text: e.textContent.trim(), rect: rect(e) })),
      museums,
      market: [...document.querySelectorAll('.ma-market .ma-artist')].map(
        (e) => ({
          color: getComputedStyle(e).getPropertyValue('--ma-artist').trim(),
          total: e.querySelector('.ma-artist__total').textContent,
          value: e.querySelector('.ma-artist__value').textContent.trim(),
          breakdown: e
            .querySelector('.ma-artist__breakdown')
            .textContent.trim(),
          rect: rect(e),
        }),
      ),
      badges: [...document.querySelectorAll('.ma-seat-number')]
        .filter(shown)
        .map((e) => ({
          text: e.textContent,
          font: parseFloat(getComputedStyle(e).fontSize),
          color: getComputedStyle(e).color,
          rect: rect(e),
        })),
      theme: document.querySelector('.ma-theme')?.textContent,
      themeRect: document.querySelector('.ma-theme')
        ? rect(document.querySelector('.ma-theme'))
        : null,
      themeCopy: [
        ...document.querySelectorAll(
          '.ma-theme > strong, .ma-theme > span, .ma-theme__identity, .ma-theme__lead, .ma-theme__caption',
        ),
      ]
        .filter(shown)
        .map((e) => ({ text: e.textContent, rect: rect(e) })),
      themeKind: document.querySelector('.ma-theme')?.className,
      ownCollectionFullCards: document.querySelectorAll(
        '.ma-self-collection .ma-card',
      ).length,
      summary: document.querySelector('.ma-collection-summary')?.textContent,
      info: [
        ...document.querySelectorAll(
          '.ma-screen p,.ma-screen h2,.ma-screen h3,.ma-screen .ma-artist__breakdown,.ma-screen .ma-collection-summary span',
        ),
      ]
        .filter(shown)
        .map((e) => ({
          text: e.textContent.slice(0, 90),
          font: parseFloat(getComputedStyle(e).fontSize),
        })),
      auction: document.querySelector('.ma-auction')
        ? rect(document.querySelector('.ma-auction'))
        : null,
      progress: document.querySelector('.ma-decision-progress')
        ? {
            text: document.querySelector('.ma-decision-progress').textContent,
            rect: rect(document.querySelector('.ma-decision-progress')),
            elapsed: document.querySelector('.ma-decision-progress').dataset
              .elapsed,
          }
        : null,
    };
  });
  const nativeState = await native(page);
  report.layouts.push({ label, native: nativeState, ...snapshot });
  check(
    !nativeState.visible && nativeState.rendered,
    `${label}: native hidden renderer`,
    nativeState,
  );
  check(
    snapshot.document.width <= snapshot.viewport.width + 1,
    `${label}: horizontal overflow`,
    snapshot.document,
  );
  if (!mobile)
    check(
      snapshot.document.height <= snapshot.viewport.height + 2,
      `${label}: desktop body scroll`,
      snapshot.document,
    );
  if (!mobile && authority.phase === 'ended') {
    const finalCash = await page.evaluate(() => {
      const table = document.querySelector('.ma-table');
      const before = table.scrollTop;
      table.scrollTop = table.scrollHeight;
      const box = (e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      };
      const button = document.querySelector('.ma-next-round');
      const action = button ? box(button) : null;
      const rows = [...document.querySelectorAll('[data-final-cash]')].map(
        (e) => ({
          seat: e.dataset.seatId,
          value: e.dataset.finalCash,
          rect: box(e.querySelector(':scope > strong')),
          champion: e.querySelector('.ma-results__champion-label')
            ? box(e.querySelector('.ma-results__champion-label'))
            : null,
        }),
      );
      table.scrollTop = before;
      return { rows, action, viewportHeight: innerHeight };
    });
    report.checks.push({
      label: `${label}: final cash after scroll`,
      ...finalCash,
    });
    for (const row of finalCash.rows) {
      const action = finalCash.action;
      check(
        row.rect.y >= -1 &&
          row.rect.bottom <= finalCash.viewportHeight + 1 &&
          (!action ||
            row.rect.right <= action.x ||
            row.rect.x >= action.right ||
            row.rect.bottom <= action.y ||
            row.rect.y >= action.bottom),
        `${label}: final cash visible without sticky action overlap`,
        { row, action },
      );
      if (row.champion)
        check(
          row.champion.y >= -1 &&
            row.champion.bottom <= finalCash.viewportHeight + 1 &&
            (!action ||
              row.champion.right <= action.x ||
              row.champion.x >= action.right ||
              row.champion.bottom <= action.y ||
              row.champion.y >= action.bottom),
          `${label}: champion visible without sticky action overlap after scroll`,
          { row, action },
        );
    }
  }
  check(
    !snapshot.nested.length,
    `${label}: nested vertical scroll`,
    snapshot.nested,
  );
  for (const control of snapshot.lifecycleControls) {
    check(
      control.rect.height >= 43.8 && control.font >= 18,
      `${label}: lifecycle action readable touch target`,
      control,
    );
    check(
      control.rect.x >= control.center.x - 1 &&
        control.rect.right <= control.center.right + 1 &&
        control.rect.y >= control.center.y - 1 &&
        control.rect.bottom <= control.center.bottom + 1,
      `${label}: lifecycle action stays inside center`,
      control,
    );
    if (!mobile)
      check(
        control.rect.y >= -1 &&
          control.rect.bottom <= snapshot.viewport.height + 1,
        `${label}: lifecycle action fully visible in desktop first screen`,
        { control, viewport: snapshot.viewport },
      );
    for (const champion of snapshot.championLabels)
      check(
        champion.rect.right <= control.rect.x ||
          champion.rect.x >= control.rect.right ||
          champion.rect.bottom <= control.rect.y ||
          champion.rect.y >= control.rect.bottom,
        `${label}: champion label avoids initial sticky action overlap`,
        { champion, control },
      );
  }
  check(
    snapshot.market.map((a) => a.total).join(',') === '12,13,14,15,16',
    `${label}: total badges`,
    snapshot.market,
  );
  check(
    snapshot.market[2].color.toLowerCase() === '#7b3f82',
    `${label}: Daniel purple`,
    snapshot.market[2],
  );
  for (const [index, artist] of authority.artists.entries()) {
    const historical = artist.history
      .slice(0, authority.round - 1)
      .reduce((a, b) => a + b, 0);
    const expected = artist.currentValue
      ? `历史 ${historical} ＋ 本轮 ${artist.currentValue - historical}`
      : `历史 ${historical} · 未入前三`;
    check(
      snapshot.market[index].value === String(artist.currentValue) &&
        snapshot.market[index].breakdown.includes(`历史 ${historical}`) &&
        (artist.currentValue
          ? snapshot.market[index].breakdown.includes(
              `本轮 ${artist.currentValue - historical}`,
            )
          : snapshot.market[index].breakdown.includes('未入前三')),
      `${label}: market composition ${artist.id}`,
      { expected, actual: snapshot.market[index] },
    );
  }
  if (!mobile && snapshot.museums.some((m) => m.cards.length))
    check(
      snapshot.gallery?.height >= 99,
      `${label}: gallery retains space for visible collection`,
      snapshot.gallery,
    );
  for (const museum of snapshot.museums)
    for (const card of museum.cards) {
      check(
        card.rect.width >= 139.8 && card.rect.width <= 188.2,
        `${label}: compact width`,
        card,
      );
      check(
        card.rect.x >= museum.rect.x - 1 &&
          card.rect.right <= museum.rect.right + 1,
        `${label}: collection overflow`,
        { museum: museum.rect, card },
      );
      check(
        card.visibleArtist && !!card.auction,
        `${label}: compact artist and auction label`,
        card,
      );
    }
  for (const badge of snapshot.badges)
    check(
      badge.font >= 18 &&
        badge.rect.width >= 27.8 &&
        badge.rect.height >= 27.8 &&
        badge.color === 'rgb(255, 250, 241)',
      `${label}: circular seat badge`,
      badge,
    );
  check(
    snapshot.info.every((i) => i.font >= 16),
    `${label}: information type minimum`,
    snapshot.info.filter((i) => i.font < 16),
  );
  if (mobile)
    check(
      snapshot.ownCollectionFullCards === 0 &&
        typeof snapshot.summary === 'string',
      `${label}: own collection summary`,
      snapshot,
    );
  if (snapshot.themeRect)
    for (const copy of snapshot.themeCopy)
      check(
        copy.rect.x >= snapshot.themeRect.x - 1 &&
          copy.rect.right <= snapshot.themeRect.right + 1,
        `${label}: auction theme copy remains within its own column`,
        { theme: snapshot.themeRect, copy },
      );
  if (authority.auction) {
    const kind =
      authority.phase === 'double' ? 'double' : authority.auction.kind;
    check(
      snapshot.themeKind?.includes(`ma-theme--${kind}`),
      `${label}: correct auction motif`,
      snapshot.themeKind,
    );
    if (kind === 'sealed')
      check(
        snapshot.theme.includes(
          `${authority.auction.submitted.length} / ${authority.seatOrder.length}`,
        ) && !/千元/.test(snapshot.theme),
        `${label}: sealed public submission status only`,
        snapshot.theme,
      );
    if (authority.phase === 'auction')
      check(
        snapshot.progress &&
          snapshot.progress.text.trim() === '' &&
          snapshot.progress.rect.width >= snapshot.auction.width - 50,
        `${label}: top progress without visible seconds`,
        snapshot.progress,
      );
    else
      check(
        !snapshot.progress,
        `${label}: no double/offer clock`,
        snapshot.progress,
      );
  }
  await capture(page, label);
  await save();
}
async function modalChecks(page, label, mobile = false) {
  const before = await state(mobile ? phoneToken : hostToken);
  const entry = page.getByRole('button', { name: /^历轮(?:估值|行情)$/ });
  await entry.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  check(
    (await dialog.textContent()).includes('各轮增值') &&
      (await dialog.textContent()).includes('累计价值'),
    `${label}: historical composition legend`,
  );
  await page.keyboard.press('Escape');
  check(
    await entry.evaluate((e) => e === document.activeElement),
    `${label}: market focus restore`,
  );
  const rulesEntry = page.getByRole('button', { name: '规则', exact: true });
  await rulesEntry.click();
  await dialog.waitFor();
  const figures = dialog.locator('[data-rule-illustration]');
  check(
    (await figures.count()) === 9,
    `${label}: nine original rule figures`,
    await figures.count(),
  );
  for (const figure of await figures.all()) {
    const image = figure.locator('img');
    check((await image.count()) === 1, `${label}: rule image source`);
    if (await image.count()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((e) => e.decode());
      check(
        await image.evaluate(
          (e) => e.naturalWidth > 0 && e.src.includes('.webp'),
        ),
        `${label}: actual rule image decoded`,
      );
    }
  }
  const nav = dialog.locator('nav').getByRole('button');
  check((await nav.count()) === 4, `${label}: four rule chapters`);
  for (const button of await nav.all()) {
    await button.click();
    check(
      await page.evaluate(() => document.activeElement?.tagName === 'H3'),
      `${label}: chapter heading focus`,
    );
  }
  const metrics = await dialog.evaluate((e) => {
    const shown = (n) => !!n.getClientRects().length;
    const scrollable = (n) =>
      /(auto|scroll)/.test(getComputedStyle(n).overflowY) &&
      n.scrollHeight > n.clientHeight + 2;
    return {
      width: e.clientWidth,
      scrollWidth: e.scrollWidth,
      fonts: [...e.querySelectorAll('p,h3,h4,figcaption,td,th,button')]
        .filter(shown)
        .map((n) => parseFloat(getComputedStyle(n).fontSize)),
      buttons: [...e.querySelectorAll('button')].filter(shown).map((n) => {
        const r = n.getBoundingClientRect();
        return { text: n.textContent, width: r.width, height: r.height };
      }),
      nested: [...e.querySelectorAll('*')]
        .filter((n) => shown(n) && scrollable(n))
        .map((n) => {
          for (let p = n.parentElement; p; p = p.parentElement)
            if (scrollable(p)) return [n.className, p.className];
          return null;
        })
        .filter(Boolean),
    };
  });
  check(
    metrics.scrollWidth <= metrics.width + 1 && !metrics.nested.length,
    `${label}: rules single scroll and fit`,
    metrics,
  );
  check(
    metrics.fonts.every((v) => v >= 16) &&
      metrics.buttons.every((b) => b.width >= 43.8 && b.height >= 43.8),
    `${label}: rules font and touch minimum`,
    metrics,
  );
  await capture(page, `${label}-rules`);
  await page.keyboard.press('Escape');
  check(
    await rulesEntry.evaluate((e) => e === document.activeElement),
    `${label}: rules focus restore`,
  );
  const after = await state(mobile ? phoneToken : hostToken);
  check(
    before.revision === after.revision &&
      before.self?.seatId === after.self?.seatId,
    `${label}: modal revision and identity unchanged`,
    { before: before.revision, after: after.revision },
  );
}
async function doubleChecks(label) {
  const view = await state(phoneToken);
  const legal = view.actions
    .filter((a) => a.type === 'add-double')
    .map((a) => a.cardId);
  const outlines = () =>
    phone.locator('.ma-hand__card--double').evaluateAll((elements) =>
      elements.map((e) => ({
        id: e.dataset.cardId,
        disabled: e.disabled,
        style: getComputedStyle(e).outlineStyle,
        width: getComputedStyle(e).outlineWidth,
        animation: getComputedStyle(e).animationDuration,
        name: getComputedStyle(e).animationName,
      })),
    );
  const actual = await outlines();
  check(
    legal.length > 0 &&
      actual
        .map((e) => e.id)
        .sort()
        .join(',') === legal.sort().join(','),
    'Double legal candidates only',
    { legal, actual },
  );
  check(
    actual.every(
      (e) =>
        !e.disabled &&
        e.style === 'dashed' &&
        Math.abs(parseFloat(e.width) - 3) <= 0.5 &&
        e.animation === '1.8s',
    ),
    'Double breathing dashed treatment',
    actual,
  );
  await phone.emulateMedia({ reducedMotion: 'reduce' });
  check(
    (await outlines()).every((e) => e.name === 'none'),
    'Double reduced motion static',
  );
  await phone.emulateMedia({ reducedMotion: 'no-preference' });
  await command({ type: 'pause' });
  await phone.waitForFunction(
    () => !document.querySelector('.ma-hand__card--double'),
  );
  check(
    (await phone.locator('.ma-hand__card--double').count()) === 0,
    'Double pause disables highlight',
  );
  await command({ type: 'resume' });
  await phone.waitForFunction(
    () => !!document.querySelector('.ma-hand__card--double'),
  );
  await capture(phone, `${label}-restored-phone`);
  await phone.evaluate((cardId) => {
    window.polishSubmissionFrames = [];
    const observe = () => {
      const e = document.querySelector(
        `.ma-hand__card[data-card-id="${cardId}"]`,
      );
      window.polishSubmissionFrames.push({
        present: !!e,
        locked: !!e?.disabled,
        animated: e?.classList.contains('ma-hand__card--double') ?? false,
      });
    };
    window.polishSubmissionObserver = new MutationObserver(observe);
    window.polishSubmissionObserver.observe(
      document.querySelector('.ma-player'),
      { attributes: true, subtree: true, childList: true },
    );
  }, legal[0]);
  const revision = (await state(phoneToken)).revision;
  await phone.locator(`.ma-hand__card[data-card-id="${legal[0]}"]`).click();
  await phone.waitForFunction(
    () => !document.querySelector('.ma-theme--double'),
  );
  const frames = await phone.evaluate(() => {
    window.polishSubmissionObserver.disconnect();
    return window.polishSubmissionFrames;
  });
  check(
    frames.some((frame) => frame.locked && !frame.animated),
    'Double submitted control stops breathing while locked',
    frames,
  );
  check(
    (await state(phoneToken)).revision > revision,
    'Double legitimate addition saves through authority',
  );
}
async function clockChecks() {
  const view = await state(hostToken);
  if (view.gameView.phase !== 'auction') return;
  await command({ type: 'pause' });
  await host.locator('.ma-decision-progress--paused').waitFor();
  const read = () =>
    host
      .locator('.ma-decision-progress')
      .evaluate((e) => e.style.getPropertyValue('--ma-time-progress'));
  const frozen = await read();
  await wait(650);
  check((await read()) === frozen, 'Auction progress freezes while paused');
  await command({ type: 'resume' });
  await host
    .locator('.ma-decision-progress[data-clock-running="true"]')
    .waitFor();
  await host.waitForFunction(
    () =>
      document.querySelector('.ma-decision-progress')?.dataset.elapsed ===
      'true',
    undefined,
    { timeout: 24000 },
  );
  const expired = await state(phoneToken);
  check(
    expired.actions.length > 0 && expired.decisionId,
    'Expiry retains legal authority choices',
  );
  const connection = await socket(phoneToken);
  const action =
    expired.actions.find((a) => a.type === 'pass') ??
    expired.actions.find((a) => a.type === 'sealed-bid' && a.amount === 0) ??
    expired.actions[0];
  await command(
    { type: 'game', decisionId: expired.decisionId, action },
    phoneToken,
    connection,
  );
  check(
    (await state(phoneToken)).revision > expired.revision,
    'Legal action saves after expiry',
  );
}
async function fullscreenChecks(page, label) {
  const initial = await native(page);
  await page.getByRole('button', { name: '全屏', exact: true }).click();
  await page.waitForFunction(() =>
    window.tablemaxWindow.read().then((s) => s.fullscreen),
  );
  const full = await native(page);
  check(
    full.fullscreen &&
      JSON.stringify(full.bounds) !== JSON.stringify(initial.bounds) &&
      !(await page.evaluate(() => !!document.fullscreenElement)),
    `${label}: game native button changes real bounds`,
    { initial, full },
  );
  await page.getByRole('button', { name: '退出全屏', exact: true }).click();
  await page.waitForFunction(() =>
    window.tablemaxWindow.read().then((s) => !s.fullscreen),
  );
  check(
    JSON.stringify((await native(page)).bounds) ===
      JSON.stringify(initial.bounds),
    `${label}: game button restores native bounds`,
  );
}
try {
  // Stable fixture API; all captured states use authorized RoomCoordinator
  // transitions and production game validation before each SQLite clone.
  await build({
    entryPoints: ['tools/test/fixtures/prepare-modern-art-polish.ts'],
    outfile: join(work, 'prepare.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  const { prepare, prepareThreeDigit } = require(join(work, 'prepare.cjs'));
  for (const count of requestedCounts ?? (representative ? [3] : [3, 4, 5])) {
    const fixture = await prepare(work, count, true, [
      'open',
      'once',
      'sealed',
      'fixed',
      'double',
    ]);
    report.fixtures.push({ count, steps: fixture.steps, cases: fixture.cases });
    const stages =
      requestedStages ??
      (representative
        ? ['collections', 'auction-open', 'auction-double']
        : [
            'offer',
            'collections',
            'auction-open',
            'auction-once',
            'auction-sealed',
            'auction-fixed',
            'auction-double',
            'result',
            'ended',
          ]);
    const cases = fixture.cases.filter((entry) => stages.includes(entry.id));
    for (const required of stages)
      assert.ok(
        cases.some((entry) => entry.id === required),
        `${count}: legal fixture missing ${required}`,
      );
    if (representative)
      cases.sort(
        (a, b) =>
          (
            requestedStages ?? ['collections', 'auction-open', 'auction-double']
          ).indexOf(a.id) -
          (
            requestedStages ?? ['collections', 'auction-open', 'auction-double']
          ).indexOf(b.id),
      );
    for (const entry of diagnostic
      ? cases.filter((e) => e.id === 'collections')
      : cases) {
      await start(fixture, entry);
      const sizes = representative
        ? [[1280, 720, 1]]
        : [
            [1280, 720, 1],
            [1920, 1080, 1],
            [2560, 1440, 1],
            [3840, 2160, 1],
            [1920, 1080, 1.25],
            [2560, 1440, 1.5],
          ];
      for (const [width, height, dpi] of sizes)
        for (const [role, page] of [
          ['host', host],
          ['public', publicPage],
        ]) {
          await resize(page, width, height, false, dpi);
          await layout(
            page,
            `${count}-${entry.id}-${role}-${width}-${Math.round(dpi * 100)}`,
          );
        }
      for (const [width, height] of representative
        ? [[360, 640]]
        : [
            [320, 568],
            [360, 640],
            [390, 667],
          ]) {
        await resize(phone, width, height, true);
        await layout(phone, `${count}-${entry.id}-phone-${width}`, true);
      }
      if (entry.id === 'collections' && !diagnostic && !layoutOnly) {
        await modalChecks(host, `${count}-host`);
        await modalChecks(publicPage, `${count}-public`);
        await modalChecks(phone, `${count}-phone`, true);
        await fullscreenChecks(host, `${count}-host`);
        await fullscreenChecks(publicPage, `${count}-public`);
      }
      if (entry.id === 'auction-double' && !layoutOnly)
        await doubleChecks(`${count}-double`);
      if (entry.id === 'auction-open' && count === 3 && !layoutOnly)
        await clockChecks();
      await stop();
      await save();
      console.log(
        `${count}-${entry.id}: ${report.failures.length} cumulative findings`,
      );
      if (representative && !continueFindings && report.failures.length) break;
    }
    if (representative && !continueFindings && report.failures.length) break;
    if (!representative) {
      const historical = await prepareThreeDigit(work, count);
      await start(historical, historical.cases[0]);
      await resize(host, 1280, 720);
      await layout(host, `${count}-history-120-host`);
      await layout(phone, `${count}-history-120-phone`, true);
      await stop();
    }
  }
  check(!report.pageErrors.length, 'No page errors', report.pageErrors);
  check(
    !report.externalRequests.length,
    'All resources remain local',
    report.externalRequests,
  );
  report.result = report.failures.length ? 'failed' : 'passed';
} catch (error) {
  report.result = 'failed';
  report.failures.push({
    label: 'Execution',
    error: error.stack ?? String(error),
  });
} finally {
  await stop().catch((error) =>
    report.failures.push({ label: 'Shutdown', error: String(error) }),
  );
  if (report.failures.length) report.result = 'failed';
  await save();
}
console.log(
  JSON.stringify({
    result: report.result,
    failures: report.failures.length,
    screenshots: report.screenshots.length,
    evidence: output,
  }),
);
if (report.result !== 'passed') process.exitCode = 1;
