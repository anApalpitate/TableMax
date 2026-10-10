import {
  captureMatrixScreenshot,
  browserScreenshotMetrics,
} from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { launchDesktop, desktopExecutable } from '../support/desktop-test.mjs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { verificationOutput } from '../support/verification-output.mjs';

const portable = process.argv.includes('--portable');
const shortOnly = process.argv.includes('--paused-720p-only');
const runName = process.argv
  .find((value) => value.startsWith('--run='))
  ?.slice(6);
if (runName && !/^[a-z0-9-]+$/i.test(runName))
  throw new Error('invalid run name');
const output = verificationOutput(
  process.argv.includes('--box-debug')
    ? 'box-debug-20261004/display'
    : 'display',
  runName ??
    (shortOnly ? 'paused-720p' : portable ? 'portable' : 'development'),
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/display-'));
const dataDir = join(work, 'data');
let executablePath = desktopExecutable;
let archiveSha256;
if (portable) {
  const project = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = resolve(
    `artifacts/releases/TableMax-${project.version}-win-x64.zip`,
  );
  const extracted = await mkdtemp(resolve('tmp/display-portable-'));
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_DISPLAY_ARCHIVE -DestinationPath $env:TABLEMAX_DISPLAY_EXTRACT',
    ],
    {
      env: {
        ...process.env,
        TABLEMAX_DISPLAY_ARCHIVE: archive,
        TABLEMAX_DISPLAY_EXTRACT: extracted,
      },
      windowsHide: true,
    },
  );
  executablePath = join(extracted, 'TableMax.exe');
  archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
}
const evidence = {
  verifiedAt: new Date().toISOString(),
  scope:
    'Actual updated offscreen, nonactivated WebView2 windows and independent local service, six real player identities with Chromium touch simulation; native window sizes simulate 720p/1080p/1440p/2160p and explicit test geometry plus CDP density simulate Windows DPI. No physical 4K monitor, television, phone or OS resolution change claim.',
  dataDir,
  portable,
  archiveSha256,
  checks: [],
  screenshots: [],
  layouts: [],
  dialogs: [],
  dpi: [],
  errors: [],
  external: [],
  desktopStderr: [],
};
const sizes = [
  [1280, 720],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function deadline(promise, message, timeout = 15000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
let desktop, origin, phoneUrl;
let shutdownFailure;
let port = '0';

async function until(check, message, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await wait(40);
  }
  throw new Error(message);
}
async function settle(page) {
  await page.locator('.connection.online').waitFor();
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  await wait(180);
}
function observe(page) {
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => evidence.errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().startsWith('http')) {
      const requestOrigin = new URL(request.url()).origin;
      if (![origin, new URL(phoneUrl ?? origin).origin].includes(requestOrigin))
        evidence.external.push(request.url());
    }
  });
}
async function view(token) {
  const response = await fetch(`${origin}/api/session/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(token ? { token } : {}),
  });
  const result = await response.json();
  assert.equal(result.ok, true);
  return result.view;
}
async function start() {
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: port,
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  delete env.NODE_PATH;
  if (portable)
    env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-play-mode'],
    env,
    timeout: 30000,
  });
  desktop.process().stderr.on('data', (chunk) => {
    const message = chunk.toString();
    evidence.desktopStderr.push(message);
    if (/Error|Exception|destroyed/i.test(message)) console.log(message.trim());
  });
  const host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  await host.locator('.connection.online').waitFor();
  if (
    await host
      .locator('.game-library__item')
      .filter({ hasText: '宝可梦奇遇' })
      .getByRole('button', { name: '选择游戏', exact: true })
      .count()
  ) {
    await host
      .locator('.game-library__item')
      .filter({ hasText: '宝可梦奇遇' })
      .getByRole('button', { name: '选择游戏', exact: true })
      .click();
    await host.getByRole('button', { name: '切换游戏', exact: true }).waitFor();
  }
  origin = new URL(host.url()).origin;
  port = new URL(origin).port;
  phoneUrl = `${origin}/player`;
  observe(host);
  await settle(host);
  const token = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.equal(await desktop.evaluate(({ app }) => app.isPackaged), portable);
  return { host, token };
}
async function stop() {
  if (desktop) {
    await deadline(
      desktop.close(),
      'Actual WebView2 desktop shutdown timed out',
      15000,
    );
    desktop = undefined;
    await until(
      async () => {
        try {
          await fetch(`${origin}/api/foundation/health`, {
            signal: AbortSignal.timeout(350),
          });
          return false;
        } catch {
          return true;
        }
      },
      'Independent service exits with its desktop',
      8000,
    );
  }
}
async function openPhone(index, url = phoneUrl) {
  const next = desktop.waitForEvent('window', { timeout: 15000 });
  await desktop.evaluate(
    ({ BrowserWindow }, input) => {
      const window = new BrowserWindow({
        frame: false,
        show: false,
        width: 390,
        height: 844,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          offscreen: true,
          backgroundThrottling: false,
          partition: `persist:display-phone-${input.index}`,
        },
      });
      void window.loadURL(input.url);
    },
    { index, url },
  );
  const phone = await next;
  observe(phone);
  const cdp = await phone.context().newCDPSession(phone);
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
  await settle(phone);
  return phone;
}
async function openPublic(host) {
  console.log('Display verification: opening another native public window');
  await host.getByRole('button', { name: '管理设置', exact: true }).click();
  const next = desktop.waitForEvent('window', { timeout: 15000 });
  await host
    .getByRole('link', { name: '打开公共屏', exact: true })
    .click({ noWaitAfter: true });
  const page = await next;
  observe(page);
  await settle(page);
  await host.goto(`${origin}/host`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await settle(host);
  return page;
}
async function reload(page) {
  // Native public-window navigation is cancelled by WebView2 and leaves a
  // pending Playwright load lifecycle. A native reload plus a new-document
  // marker verifies the real reload without awaiting that cancelled load.
  await page.evaluate(() => {
    window.displayReloadMarker = true;
  });
  const window = await desktop.browserWindow(page);
  await window.evaluate((w) => w.webContents.reload());
  await page.waitForFunction(
    () => window.displayReloadMarker === undefined,
    undefined,
    { timeout: 15000 },
  );
  await settle(page);
}
async function resize(page, width, height) {
  const window = await desktop.browserWindow(page);
  await window.evaluate(
    (w, size) => w.setContentSize(size.width, size.height),
    { width, height },
  );
  assert.deepEqual(
    await window.evaluate((w) => w.getContentSize()),
    [width, height],
    'Actual unzoomed native render dimensions must equal the requested display matrix dimensions',
  );
  await settle(page);
}
async function nativeState(page) {
  const window = await deadline(
    desktop.browserWindow(page),
    'Cannot find the actual native window',
  );
  return deadline(
    window.evaluate((w) => ({
      zoom: w.webContents.getZoomFactor(),
      content: w.getContentSize(),
      visible: w.isVisible(),
      fullscreen: w.isFullScreen(),
    })),
    'Native window state evaluation timed out',
  );
}
async function capture(page, name) {
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((w) => w.isVisible()), false);
  const screenshot = await captureMatrixScreenshot(
    join(output, name + '.png'),
    async () =>
      Buffer.from(
        await deadline(
          window.evaluate(async (w) =>
            (
              await w.webContents.capturePage(undefined, {
                stayHidden: true,
                stayAwake: true,
              })
            )
              .toPNG()
              .toString('base64'),
          ),
          'Hidden native screenshot timed out',
          8000,
        ),
        'base64',
      ),
    await browserScreenshotMetrics(
      page,
      await window.evaluate((w) => w.webContents.getZoomFactor()),
    ),
    { state: name },
  );
  const png = screenshot.image;
  evidence.screenshots.push({
    name: screenshot.path,
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  });
}
async function settings(page) {
  const trigger = page.getByRole('button', {
    name: /^(?:视频|显示)设置$/,
    exact: true,
  });
  assert.equal(await trigger.count(), 1);
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: /^(?:视频|显示)设置$/,
    exact: true,
  });
  await dialog.waitFor();
  assert.equal(
    await dialog.evaluate((panel) => panel.contains(document.activeElement)),
    true,
  );
  return { trigger, dialog };
}
async function chooseScale(dialog, label) {
  const select = dialog.getByLabel('界面大小', { exact: true });
  const options = await select
    .locator('option')
    .evaluateAll((items) =>
      items.map((item) => ({ value: item.value, text: item.textContent })),
    );
  const value = options.find((item) => item.text.includes(`${label}%`))?.value;
  assert.ok(value, `UI size ${label}% is available`);
  await select.selectOption(value);
}
async function configure(
  page,
  resolution,
  scale = 100,
  closeMethod = 'escape',
) {
  const { dialog, trigger } = await settings(page);
  const before = await nativeState(page);
  await dialog.getByLabel('适配方式', { exact: true }).selectOption(resolution);
  await chooseScale(dialog, scale);
  await settle(page);
  const bounds = await dialog.boundingBox();
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  assert.ok(
    bounds.x >= -1 &&
      bounds.y >= -1 &&
      bounds.x + bounds.width <= metrics.width + 1 &&
      bounds.y + bounds.height <= metrics.height + 1,
    'Display dialog fits the viewport after immediate zoom',
  );
  evidence.dialogs.push({
    resolution,
    scale,
    before,
    after: await nativeState(page),
    bounds,
    viewport: metrics,
  });
  if (
    new URL(page.url()).pathname.startsWith('/public') &&
    resolution === '3840x2160' &&
    [100, 150].includes(scale)
  ) {
    const native = await nativeState(page);
    const scene = new URL(page.url()).pathname.endsWith('/game')
      ? 'game'
      : 'lobby';
    await capture(
      page,
      `public-display-settings-${native.content.join('x')}-${scale}percent-${scene}`,
    );
  }
  if (closeMethod === 'escape') await page.keyboard.press('Escape');
  else
    await dialog.getByRole('button', { name: '关闭面板', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(
    await trigger.evaluate((button) => button === document.activeElement),
    true,
    'Closing returns focus to the display button',
  );
}
async function readSettings(page) {
  const { dialog } = await settings(page);
  const result = {
    resolution: await dialog
      .getByLabel('适配方式', { exact: true })
      .inputValue(),
    scale: await dialog.getByLabel('界面大小', { exact: true }).inputValue(),
  };
  await page.keyboard.press('Escape');
  return result;
}
async function layout(page, label, game = false, paused = false) {
  const native = await nativeState(page);
  const snapshot = await page.evaluate(() => window.tablemaxDisplay.read());
  const geometry = await page.evaluate((game) => {
    const rect = (element) => {
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
    const query = (selector) =>
      [...document.querySelectorAll(selector)].map(rect);
    const font = (selector) =>
      [...document.querySelectorAll(selector)].map((el) =>
        parseFloat(getComputedStyle(el).fontSize),
      );
    return {
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      seats: query(game ? '.game-seat' : '.room-table__seat'),
      cards: query('.game-seat .pokemon-card'),
      panels: query(
        '.game-toolbar,.pokemon-status,.action-announcement,.game-table,.game-seats',
      ),
      notices: query('.table-notice'),
      noticeText:
        document.querySelector('.table-notice')?.textContent?.trim() ?? '',
      resumeControls: [
        ...document.querySelectorAll('.table-notice button'),
      ].map((element) => ({
        text: element.textContent.trim(),
        ...rect(element),
      })),
      names: font(game ? '.seat-heading h3' : '.room-table__name'),
      cardNames: font('.game-seat .card-name'),
      stars: font('.game-seat .win-pips i'),
      controls: query(
        game
          ? '.game-toolbar button,.game-toolbar .button'
          : '.header-status button,.lobby-start button',
      ),
    };
  }, game);
  evidence.layouts.push({ label, native, snapshot, ...geometry });
  assert.ok(
    Math.abs(snapshot.zoomFactor - native.zoom) < 1e-9,
    `${label}: the bridge describes the actual native zoom`,
  );
  assert.deepEqual(
    [snapshot.viewport.width, snapshot.viewport.height],
    native.content,
    `${label}: settings use unzoomed native viewport dimensions`,
  );
  assert.equal(native.visible, false);
  assert.equal(geometry.seats.length, 6, `${label}: six players are displayed`);
  assert.ok(
    geometry.document.width <= geometry.viewport.width + 1,
    `${label}: no horizontal page overflow`,
  );
  assert.ok(
    geometry.document.height <= geometry.viewport.height + 1,
    `${label}: no page scrolling`,
  );
  assert.ok(
    [
      ...geometry.seats,
      ...geometry.cards,
      ...geometry.controls,
      ...geometry.notices,
      ...geometry.resumeControls,
    ].every(
      (r) =>
        r.x >= -1 &&
        r.y >= -1 &&
        r.right <= geometry.viewport.width + 1 &&
        r.bottom <= geometry.viewport.height + 1,
    ),
    `${label}: seats, cards and controls fit the first screen`,
  );
  for (const [index, a] of geometry.seats.entries())
    for (const b of geometry.seats.slice(index + 1))
      assert.ok(
        a.right <= b.x + 1 ||
          b.right <= a.x + 1 ||
          a.bottom <= b.y + 1 ||
          b.bottom <= a.y + 1,
        `${label}: seat panels do not overlap`,
      );
  if (game) {
    assert.equal(geometry.cards.length, 36);
    assert.ok(
      geometry.cards.every(
        (r) => r.width * native.zoom >= 52 && r.height * native.zoom >= 70,
      ),
      `${label}: visible card size remains readable`,
    );
    assert.ok(
      geometry.names.every((size) => size * native.zoom >= 14),
      `${label}: player names remain readable`,
    );
    assert.ok(
      geometry.cardNames.every((size) => size * native.zoom >= 12),
      `${label}: card names remain readable`,
    );
    assert.ok(
      geometry.stars.every((size) => size * native.zoom >= 28),
      `${label}: stars remain readable`,
    );
  }
  if (paused) {
    assert.equal(
      geometry.notices.length,
      1,
      `${label}: a saved pause is visible`,
    );
    assert.equal(await page.locator('.table-notice').isVisible(), true);
    assert.ok(
      geometry.notices[0].width > 0 && geometry.notices[0].height > 0,
      `${label}: pause notice has visible dimensions`,
    );
    assert.ok(
      (await page.locator('.table-notice > span').textContent()).trim().length >
        0,
      `${label}: pause notice text is nonempty`,
    );
    assert.ok(
      /暂停|读取存档/.test(geometry.noticeText),
      `${label}: pause or restoration is explained`,
    );
    const isHost = new URL(page.url()).pathname.startsWith('/host');
    assert.equal(
      geometry.resumeControls.length,
      isHost ? 1 : 0,
      `${label}: only host has a resume control`,
    );
    if (isHost) {
      assert.equal(geometry.resumeControls[0].text, '恢复游戏');
      assert.ok(
        geometry.resumeControls[0].height >= 44,
        `${label}: the visible resume button remains operable`,
      );
      const resume = page.getByRole('button', {
        name: '恢复游戏',
        exact: true,
      });
      assert.equal(await resume.isEnabled(), true);
      assert.equal(
        await resume.evaluate((element) => {
          const r = element.getBoundingClientRect();
          const top = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
          return element === top || element.contains(top);
        }),
        true,
        `${label}: resume button is not covered`,
      );
    }
  }
  return { native, ...geometry };
}

try {
  await (async () => {
    console.log(
      'Display verification: launch hidden desktop and six phone identities',
    );
    const { host, token } = await start(1);
    const originalDisplays = await desktop.evaluate(({ screen }) =>
      screen.getAllDisplays().map(({ id, bounds, workArea, scaleFactor }) => ({
        id,
        bounds,
        workArea,
        scaleFactor,
      })),
    );
    const phones = [];
    for (let index = 0; index < 6; index++) {
      const phone = await openPhone(index);
      phones.push(phone);
      assert.equal(
        await phone.evaluate(() => typeof window.tablemaxDisplay),
        'undefined',
        'Browser video settings never expose native computer display privileges',
      );
      await phone
        .getByLabel('你的昵称')
        .fill(
          index === 1
            ? '长昵称朋友在四倍分辨率下依然清晰'
            : `手机朋友 ${index + 1}`,
        );
      await phone.getByRole('button', { name: '加入', exact: true }).click();
      await phone
        .getByRole('button', { name: '我准备好了', exact: true })
        .click();
      await phone
        .getByRole('button', { name: '取消准备', exact: true })
        .waitFor();
    }
    const publicPage = await openPublic(host);
    const plainPublic = await openPhone(7, `${origin}/public`);
    assert.equal(
      await plainPublic.evaluate(() => typeof window.tablemaxDisplay),
      'undefined',
      'Browser video settings never expose native computer display privileges',
    );
    const phoneBefore = await nativeState(phones[0]);
    for (const [width, height] of sizes) {
      await resize(host, width, height);
      await configure(host, 'auto');
      await layout(host, `host lobby auto ${width}x${height}`);
      await capture(host, `host-lobby-auto-${width}x${height}`);
      await resize(publicPage, width, height);
      await configure(publicPage, `${width}x${height}`);
      await layout(publicPage, `public lobby preset ${width}x${height}`);
      await capture(publicPage, `public-lobby-preset-${width}x${height}`);
    }
    console.log(
      'Display verification: four-resolution lobby geometry passed; test independent settings',
    );
    evidence.checks.push(
      'Four native window resolutions, including an actual 3840x2160 hidden render, show all six lobby seats without overlap or scroll, and both computer lobby routes have the settings dialog.',
    );
    await configure(host, '1920x1080', 125);
    const hostSaved = await readSettings(host);
    const isolatedHostState = await nativeState(host);
    await configure(publicPage, '3840x2160', 150, 'button');
    assert.deepEqual(
      await nativeState(host),
      isolatedHostState,
      'Changing public zoom leaves the same-origin host zoom unchanged before host applies any setting again',
    );
    const publicSaved = await readSettings(publicPage);
    assert.notDeepEqual(publicSaved, hostSaved);
    assert.deepEqual(
      await readSettings(host),
      hostSaved,
      'Public settings never overwrite host settings',
    );
    const secondPublic = await openPublic(host);
    assert.deepEqual(
      await readSettings(secondPublic),
      publicSaved,
      'A new public window adopts the saved public preference',
    );
    await resize(secondPublic, 3840, 2160);
    await configure(secondPublic, '1920x1080');
    const secondSaved = await readSettings(secondPublic);
    const secondNative = await nativeState(secondPublic);
    await configure(publicPage, '3840x2160', 125);
    assert.deepEqual(
      await nativeState(secondPublic),
      secondNative,
      'Two simultaneous public windows retain independent native zoom',
    );
    await reload(secondPublic);
    assert.deepEqual(
      await readSettings(secondPublic),
      secondSaved,
      'A public window keeps its own preference on reload even after another public window saves',
    );
    await configure(publicPage, '3840x2160', 150);
    const thirdPublic = await openPublic(host);
    assert.deepEqual(
      await readSettings(thirdPublic),
      publicSaved,
      'A later new public window adopts the latest saved public default',
    );
    await secondPublic.close();
    await thirdPublic.close();
    console.log(
      'Display verification: two extra public windows closed; verify host reload',
    );
    await reload(host);
    await reload(publicPage);
    assert.deepEqual(await readSettings(host), hostSaved);
    assert.deepEqual(await readSettings(publicPage), publicSaved);
    const storedPreferences = JSON.parse(
      await readFile(join(dataDir, 'display-settings.json'), 'utf8'),
    );
    assert.equal(storedPreferences.version, 1);
    assert.deepEqual(storedPreferences.host, {
      resolution: '1920x1080',
      interfaceScale: 125,
    });
    assert.deepEqual(storedPreferences.public, {
      resolution: '3840x2160',
      interfaceScale: 150,
    });
    assert.deepEqual(
      await nativeState(phones[0]),
      phoneBefore,
      'Computer display settings do not affect a player window',
    );
    const seated = await view(token);
    await configure(host, 'auto');
    await configure(publicPage, 'auto');
    assert.equal(
      (await view(token)).revision,
      seated.revision,
      'Display preferences do not save any room action',
    );
    console.log(
      'Display verification: reload/persistence and native window isolation passed; begin six-phone game',
    );
    await host.getByRole('button', { name: '开始游戏', exact: true }).click();
    await host.waitForURL('**/host/game');
    await publicPage.waitForURL('**/public/game', { timeout: 15000 });
    for (const phone of phones) {
      await phone.waitForURL('**/player/game');
      await phone
        .locator('.pokemon-player > .pokemon-board button')
        .nth(0)
        .click();
      await phone.locator('.confirm-action').click();
      assert.equal(
        await phone.evaluate(() => typeof window.tablemaxDisplay),
        'undefined',
        'Browser video settings never expose native computer display privileges',
      );
    }
    await until(
      async () => (await view(token)).gameView.initialDone.length === 6,
      'All six genuine player identities complete their initial saved card selection',
    );
    console.log(
      'Display verification: save a host pause and check all six boards before resuming',
    );
    await host.getByRole('button', { name: '菜单', exact: true }).click();
    await host
      .getByRole('dialog', { name: '牌桌菜单', exact: true })
      .getByRole('button', { name: '暂停游戏', exact: true })
      .click();
    await until(
      async () => (await view(token)).paused,
      'The actual authorized host pause is saved',
    );
    await host.keyboard.press('Escape');
    await host.getByRole('button', { name: '恢复游戏', exact: true }).waitFor();
    const pausedRevision = (await view(token)).revision;
    for (const [width, height] of sizes) {
      for (const [role, page] of [
        ['host', host],
        ['public', publicPage],
      ]) {
        await resize(page, width, height);
        await configure(page, 'auto');
        await layout(
          page,
          `${role} paused game auto ${width}x${height}`,
          true,
          true,
        );
        await capture(page, `${role}-paused-game-auto-${width}x${height}`);
        if (shortOnly) return;
      }
    }
    for (const [role, page] of [
      ['host', host],
      ['public', publicPage],
    ]) {
      for (const scale of [100, 125, 150]) {
        await configure(page, '3840x2160', scale);
        await layout(page, `${role} paused game 2160p ${scale}%`, true, true);
        await capture(page, `${role}-paused-game-3840x2160-${scale}percent`);
      }
    }
    assert.equal(
      (await view(token)).revision,
      pausedRevision,
      'Display adjustments do not alter the saved pause',
    );
    await host.getByRole('button', { name: '恢复游戏', exact: true }).click();
    await until(
      async () => !(await view(token)).paused,
      'The real host resume command is saved',
    );
    await host.locator('.table-notice').waitFor({ state: 'hidden' });
    for (const page of [host, publicPage]) await configure(page, 'auto');
    evidence.checks.push(
      'An actual host pause and resume preserve all 36 cards on both computer screens: all four native resolutions and 4K 100/125/150% pause layouts require no page scrolling, and only the host exposes an uncovered 44px resume control.',
    );
    const gameRevision = (await view(token)).revision;
    for (const [width, height] of sizes) {
      for (const [role, page] of [
        ['host', host],
        ['public', publicPage],
      ]) {
        await resize(page, width, height);
        await configure(page, 'auto');
        await layout(page, `${role} game auto ${width}x${height}`, true);
        await capture(page, `${role}-game-auto-${width}x${height}`);
      }
    }
    console.log(
      'Display verification: game geometry passed at all four resolutions; test interface sizes',
    );
    const physicalFonts = [];
    for (const size of [100, 125, 150]) {
      await configure(publicPage, '3840x2160', size);
      const metrics = await layout(
        publicPage,
        `public game 2160p ${size}%`,
        true,
      );
      physicalFonts.push({
        size,
        zoom: metrics.native.zoom,
        name: metrics.names[0] * metrics.native.zoom,
      });
      await capture(publicPage, `public-game-3840x2160-${size}percent`);
    }
    assert.ok(
      physicalFonts[1].name > physicalFonts[0].name &&
        physicalFonts[2].name > physicalFonts[1].name,
      '125% and 150% increase displayed type size immediately',
    );
    evidence.fontScales = physicalFonts;
    evidence.originalDisplays = originalDisplays;
    assert.deepEqual(
      await desktop.evaluate(({ screen }) =>
        screen
          .getAllDisplays()
          .map(({ id, bounds, workArea, scaleFactor }) => ({
            id,
            bounds,
            workArea,
            scaleFactor,
          })),
      ),
      originalDisplays,
      'Display preferences leave native OS display geometry and DPI unchanged',
    );
    assert.equal(
      (await view(token)).revision,
      gameRevision,
      'Changing and resizing display settings never changes the game revision',
    );
    await capture(phones[0], 'phone-game-unaffected-390x844');
    await configure(host, '1920x1080', 125);
    const restartHostSettings = await readSettings(host);
    const restartPublicSettings = await readSettings(publicPage);
    console.log(
      'Display verification: restart desktop at simulated Windows 150% DPI',
    );
    await stop();
    const restarted = await start(1.5);
    assert.deepEqual(
      await readSettings(restarted.host),
      restartHostSettings,
      'Host preference survives the actual desktop/service restart',
    );
    const restartedPublic = await openPublic(restarted.host);
    assert.equal(
      (await view(restarted.token)).paused,
      true,
      'Actual service restart restores the saved game in a paused state',
    );
    assert.deepEqual(
      await readSettings(restartedPublic),
      restartPublicSettings,
      'Public preference survives an independent window recreation and restart',
    );
    for (const page of [restarted.host, restartedPublic]) {
      if (!new URL(page.url()).pathname.endsWith('/game'))
        await page.getByRole('link', { name: '进入牌桌', exact: true }).click();
      await settle(page);
      await resize(page, 2560, 1440);
      await configure(page, 'auto');
      const offscreenDensity = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      }));
      // Simulate DPI without changing OS settings. Native physical geometry and
      // renderer pixel density are distinct inputs and must both be explicit.
      const id = await page.evaluate(() => window.__tablemaxWindowId);
      const nativeBefore = await nativeState(page);
      await desktop.request('window', {
        id,
        operation: 'geometry',
        geometry: {
          viewport: {
            width: nativeBefore.content[0],
            height: nativeBefore.content[1],
          },
          screen: { width: 2560, height: 1440, scaleFactor: 1.5 },
        },
      });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 0,
        height: 0,
        deviceScaleFactor: 1.5,
        mobile: false,
      });
      const simulatedDensity = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      }));
      assert.deepEqual(
        [simulatedDensity.width, simulatedDensity.height],
        [offscreenDensity.width, offscreenDensity.height],
        'DPI simulation does not override native viewport dimensions',
      );
      evidence.dpi.push({
        role: page === restarted.host ? 'host' : 'public',
        offscreenDensity,
        simulatedDensity,
        method:
          'Explicit native test geometry with DPI 1.5 plus CDP density 1.5 with width/height 0; actual WebView2 offscreen capture PNG retains the current rendered frame.',
      });
      await layout(
        page,
        `${page === restarted.host ? 'host' : 'public'} game DPI 150%`,
        true,
        true,
      );
      const metrics = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      }));
      const native = await nativeState(page);
      assert.ok(
        Math.abs(metrics.dpr / native.zoom - 1.5) < 0.03,
        'WebView2 renderer uses the simulated Windows 150% pixel density',
      );
      await capture(
        page,
        `${page === restarted.host ? 'host' : 'public'}-game-dpi150`,
      );
      await configure(page, '3840x2160');
      const snapshot = await page.evaluate(() => window.tablemaxDisplay.read());
      assert.ok(
        Math.abs(snapshot.screen.scaleFactor - 1.5) < 0.03,
        'Display bridge uses the simulated Windows DPI for physical resolution presets',
      );
      assert.ok(
        Math.abs(snapshot.zoomFactor - 4 / 3) < 0.03,
        'A 3840x2160 preset at Windows 150% applies 133% UI zoom instead of double-counting DPI',
      );
    }
    evidence.checks.push(
      'Both computer game routes show all 36 cards at all four resolutions; 100/125/150% alter native zoom immediately, dialog close/Escape returns focus, settings survive reload and actual restart, host/public preferences are independent, and browser video settings have no native display privilege or zoom change.',
    );
    evidence.checks.push(
      'Native 150% display density simulation retains first-screen six-player geometry and records actual devicePixelRatio/zoom and screenshot dimensions; this is renderer simulation, not a physical display test.',
    );
    for (const page of desktop.windows())
      assert.equal((await nativeState(page)).visible, false);
    assert.deepEqual(evidence.errors, []);
    assert.deepEqual(evidence.external, []);
  })();
  evidence.result = 'passed';
} catch (error) {
  console.error('Display verification failed:', error.stack);
  evidence.result = 'failed';
  evidence.error = error.stack;
  if (desktop)
    for (const [index, page] of desktop.windows().entries())
      await capture(page, `failure-${index}`).catch(() => undefined);
  throw error;
} finally {
  try {
    await stop();
  } catch (error) {
    evidence.result = 'failed';
    evidence.shutdownError = error.stack;
    shutdownFailure = error;
  } finally {
    await writeFile(
      join(output, 'results.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
  }
}
if (shutdownFailure) throw shutdownFailure;
console.log(
  JSON.stringify(
    {
      result: evidence.result,
      output,
      checks: evidence.checks,
      screenshots: evidence.screenshots.length,
    },
    null,
    2,
  ),
);
