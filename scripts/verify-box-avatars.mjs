import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';
import { verificationOutput } from './verification-output.mjs';

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const compactOnly = process.argv.includes('--compact-only');
const runName = process.argv
  .find((argument) => argument.startsWith('--run='))
  ?.slice('--run='.length);
assert.ok(!runName || /^[a-z0-9-]+$/.test(runName), 'Safe evidence run name');
const output = verificationOutput(
  'box-avatars-20261004',
  'verification',
  runName ?? (portable ? 'portable' : compactOnly ? 'compact' : 'development'),
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
// The existing cleanup guard already recognizes this exact test prefix.
const work = await mkdtemp(resolve('tmp/room-levels-'));
const started = performance.now();
const presetSource = await readFile('packages/protocol/src/avatars.ts', 'utf8');
const presets = [
  ...presetSource.matchAll(/id: '(avatar-\d+)', name: '([^']+)'/g),
].map((match) => ({ id: match[1], name: match[2] }));
assert.equal(presets.length, 26, 'Twenty new presets and the six original IDs');
assert.equal(new Set(presets.map((preset) => preset.id)).size, 26);
let executablePath = desktopExecutable;
let archiveSha256;
if (portable) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
  const extracted = join(work, 'portable');
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_AVATAR_ARCHIVE -DestinationPath $env:TABLEMAX_AVATAR_EXTRACT',
    ],
    {
      env: {
        ...process.env,
        TABLEMAX_AVATAR_ARCHIVE: archive,
        TABLEMAX_AVATAR_EXTRACT: extracted,
      },
      windowsHide: true,
    },
  );
  executablePath = join(extracted, 'TableMax.exe');
  archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
}
const env = {
  ...process.env,
  TABLEMAX_DATA_DIR: join(work, 'data'),
  TABLEMAX_HOST: '0.0.0.0',
  TABLEMAX_PORT: '0',
};
delete env.TABLEMAX_WEB_DEV_URL;
delete env.NODE_PATH;
if (portable)
  env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
const evidence = {
  verifiedAt: new Date().toISOString(),
  status: 'in-progress',
  scope:
    'Actual hidden Windows WebView2 and the local service, with independent phone partitions and real LAN invite origin. Touch, viewport and desktop UI scaling are simulated; no physical phone or Wi-Fi claim. Artwork is inspected as loaded local images; source provenance remains in its asset manifest.',
  preferences: ['docs/reference/art-preferences.md', 'S08', 'S09'],
  portable,
  compactOnly,
  archiveSha256,
  dataDir: env.TABLEMAX_DATA_DIR,
  checks: [],
  layouts: [],
  screenshots: [],
  nativeWindows: [],
  images: [],
  pageErrors: [],
  externalRequests: [],
};
let desktop, origin, phoneUrl, hostToken, hostSocket;
const sockets = new Set();
const phones = [];
let currentPage;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function save() {
  evidence.elapsedSeconds =
    Math.round((performance.now() - started) / 10) / 100;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2),
  );
}
async function check(description) {
  evidence.checks.push(description);
  await save();
  console.log('Box verification: ' + description);
}
async function until(callback, description, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await callback()) return;
    await wait(75);
  }
  throw new Error(description);
}
async function view(token) {
  const reply = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return reply.view;
}
async function connect(token) {
  const socket = io(origin, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  sockets.add(socket);
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function command(socket, token, value, expectedReason) {
  const state = await view(token);
  const reply = await new Promise((done, reject) => {
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: state.instanceId,
        revision: state.revision,
        branch: state.branch,
        command: value,
      },
      (error, result) => (error ? reject(error) : done(result)),
    );
  });
  if (expectedReason) {
    assert.equal(reply.ok, false, JSON.stringify(reply));
    assert.equal(reply.reason, expectedReason);
  } else assert.equal(reply.ok, true, JSON.stringify(reply));
  return reply;
}
async function playerCommand(token, value, expectedReason) {
  const socket = await connect(token);
  try {
    return await command(socket, token, value, expectedReason);
  } finally {
    socket.disconnect();
    sockets.delete(socket);
  }
}
function observe(page) {
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith('http')) return;
    const requestOrigin = new URL(request.url()).origin;
    if (![origin, new URL(phoneUrl).origin].includes(requestOrigin))
      evidence.externalRequests.push(request.url());
  });
}
async function settle(page) {
  currentPage = page;
  await page.locator('.connection.online').waitFor();
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
}
async function resize(page, width, height, mobile = false) {
  const window = await desktop.browserWindow(page);
  await window.evaluate(
    (w, size) => w.setContentSize(size.width, size.height),
    {
      width,
      height,
    },
  );
  const cdp = await page.context().newCDPSession(page);
  if (mobile)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
  else await cdp.send('Emulation.clearDeviceMetricsOverride');
  await cdp.detach();
  await settle(page);
  const native = await window.evaluate((w) => ({
    content: w.getContentSize(),
    zoom: w.webContents.getZoomFactor(),
    visible: w.isVisible(),
  }));
  evidence.nativeWindows.push({
    url: new URL(page.url()).pathname,
    requested: { width, height },
    mobile,
    ...native,
  });
  await save();
  assert.deepEqual(
    native.content,
    [width, height],
    'The actual native render size matches the requested matrix entry',
  );
  assert.equal(native.visible, false, 'Resizing never shows the test window');
}
async function openPhone(index, width = 390, height = 844) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, input) => {
      const window = new BrowserWindow({
        frame: false,
        show: false,
        width: input.width,
        height: input.height,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          offscreen: true,
          backgroundThrottling: false,
          partition: `persist:box-avatars-phone-${input.index}`,
        },
      });
      void window.loadURL(input.url);
    },
    { index, url: phoneUrl, width, height },
  );
  const page = await next;
  observe(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  await cdp.detach();
  await settle(page);
  phones.push(page);
  return page;
}
async function capture(page, name) {
  currentPage = page;
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((w) => w.isVisible()), false);
  const encoded = await window.evaluate(async (w) =>
    (
      await w.webContents.capturePage(undefined, {
        stayHidden: true,
        stayAwake: true,
      })
    )
      .toPNG()
      .toString('base64'),
  );
  const png = Buffer.from(encoded, 'base64');
  await writeFile(join(output, name + '.png'), png);
  evidence.screenshots.push({
    name: name + '.png',
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  });
  await save();
}
async function geometry(page, label, selectors = [], dialogSelector = null) {
  const result = await page.evaluate(
    ({ selectors, dialogSelector }) => {
      const rect = (element) => {
        const r = element.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      const dialog = dialogSelector
        ? document.querySelector(dialogSelector)
        : null;
      const activeRoot = dialog ?? document;
      return {
        viewport: { width: innerWidth, height: innerHeight },
        horizontalOverflow:
          document.documentElement.scrollWidth > innerWidth + 1,
        dialog: dialog
          ? {
              ...rect(dialog),
              scrollWidth: dialog.scrollWidth,
              clientWidth: dialog.clientWidth,
            }
          : null,
        controls: selectors.map((selector) => {
          const element = document.querySelector(selector);
          if (!element) return { selector, present: false };
          const bounds = rect(element);
          const top = document.elementFromPoint(
            bounds.left + bounds.width / 2,
            bounds.top + bounds.height / 2,
          );
          return {
            selector,
            present: true,
            rect: bounds,
            withinViewport:
              bounds.left >= 0 &&
              bounds.right <= innerWidth + 1 &&
              bounds.top >= 0 &&
              bounds.bottom <= innerHeight + 1,
            unobscured: Boolean(
              top && (element === top || element.contains(top)),
            ),
          };
        }),
        smallText: [
          ...activeRoot.querySelectorAll(
            '.game-introduction p, .game-introduction li',
          ),
        ]
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => ({
            text: element.textContent.trim(),
            fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
          })),
      };
    },
    { selectors, dialogSelector },
  );
  evidence.layouts.push({ label, ...result });
  await save();
  assert.equal(
    result.horizontalOverflow,
    false,
    label + ': no horizontal page clipping',
  );
  if (result.dialog) {
    assert.ok(
      result.dialog.left >= -1 &&
        result.dialog.right <= result.viewport.width + 1 &&
        result.dialog.top >= -1 &&
        result.dialog.bottom <= result.viewport.height + 1,
      label + ': dialog fits the viewport',
    );
    assert.ok(
      result.dialog.scrollWidth <= result.dialog.clientWidth + 1,
      label + ': no horizontal dialog scroll',
    );
  }
  for (const control of result.controls) {
    assert.equal(
      control.present,
      true,
      label + ': ' + control.selector + ' exists',
    );
    assert.equal(
      control.withinViewport,
      true,
      label + ': ' + control.selector + ' is visible without page scroll',
    );
    assert.equal(
      control.unobscured,
      true,
      label + ': ' + control.selector + ' receives touch',
    );
    assert.ok(
      control.rect.height >= 44 && control.rect.width >= 44,
      label + ': 44 CSS px touch target',
    );
  }
  for (const text of result.smallText)
    assert.ok(
      text.fontSize >= 16,
      label + ': main introduction text is at least 16 CSS px: ' + text.text,
    );
  return result;
}
async function picker(page, joined = false) {
  await page
    .getByRole('button', {
      name: joined ? '更换头像' : '选择头像',
      exact: true,
    })
    .click();
  const dialog = page.getByRole('dialog', { name: '选择头像', exact: true });
  await dialog.waitFor();
  return dialog;
}
async function chooseAvatar(page, avatarId, joined = false) {
  const dialog = await picker(page, joined);
  await dialog.locator(`[data-avatar-id="${avatarId}"]`).click();
  if (await dialog.count()) await page.keyboard.press('Escape');
  await settle(page);
}
async function tokenOf(page) {
  const token = await page.evaluate(() =>
    localStorage.getItem('tablemax-player'),
  );
  assert.ok(token, 'Successful UI admission stores the device credential');
  return token;
}
function ownSeat(state) {
  const seat = state.seats.find(
    (candidate) => candidate.id === state.self.seatId,
  );
  assert.ok(seat, 'The player has exactly one own seat');
  return seat;
}
async function avatarImages(dialog) {
  await dialog.locator('[data-avatar-id] img').evaluateAll(async (images) => {
    await Promise.all(images.map((image) => image.decode()));
  });
  const images = await dialog
    .locator('[data-avatar-id]')
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const image = button.querySelector('img');
        return {
          id: button.dataset.avatarId,
          name: button.getAttribute('aria-label'),
          src: image?.src,
          width: image?.naturalWidth,
          height: image?.naturalHeight,
          complete: image?.complete,
          rect: {
            width: button.getBoundingClientRect().width,
            height: button.getBoundingClientRect().height,
          },
        };
      }),
    );
  evidence.images = images;
  await save();
  assert.deepEqual(
    images.map((image) => image.id).sort(),
    presets.map((preset) => preset.id).sort(),
  );
  assert.equal(
    new Set(images.map((image) => new URL(image.src).pathname)).size,
    26,
    'Every preset has its own local bitmap',
  );
  for (const image of images) {
    assert.ok(
      image.complete && image.width >= 512 && image.height >= 512,
      image.id + ': local avatar decodes at full intended size',
    );
    assert.equal(
      new URL(image.src).origin,
      new URL(phoneUrl).origin,
      'Artwork is served offline from the LAN host',
    );
    assert.ok(
      image.rect.width >= 44 && image.rect.height >= 44,
      image.id + ': selectable image has a usable touch target',
    );
    assert.ok(
      image.name?.includes(
        presets.find((preset) => preset.id === image.id).name,
      ),
      image.id + ': accessible preset name',
    );
  }
}
async function occupied(dialog, avatarId, seat) {
  const button = dialog.locator(`[data-avatar-id="${avatarId}"]`);
  assert.equal(
    await button.isDisabled(),
    true,
    'Another seat owns ' + avatarId,
  );
  assert.equal(await button.getAttribute('data-occupied'), 'true');
  assert.ok(
    (await button.textContent()).includes('已被选择'),
    'Occupancy is visible as text, independently of color',
  );
  assert.ok(
    (await button.getAttribute('aria-label')).includes(seat.name),
    'Occupancy accessibility includes the full nickname',
  );
  await button.scrollIntoViewIfNeeded();
}
async function consistentAvatars(pages, state, game = false) {
  const imagePaths = new Map(
    evidence.images.map((image) => [image.id, new URL(image.src).pathname]),
  );
  for (const [index, page] of pages.entries()) {
    await settle(page);
    for (const seat of state.seats) {
      const selector = game
        ? `.game-seat[data-seat="${seat.id}"] .avatar`
        : `.room-table__seat[data-seat-id="${seat.id}"] .room-table__avatar`;
      const image = page.locator(selector);
      await image.waitFor();
      const src = await image.getAttribute('src');
      assert.equal(
        new URL(src, page.url()).pathname,
        imagePaths.get(seat.avatarId),
        `View ${index}: selected avatar follows saved seat ${seat.name}`,
      );
      if (!game) {
        const article = page.locator(
          `.room-table__seat[data-seat-id="${seat.id}"]`,
        );
        assert.ok(
          (await article.getAttribute('aria-label')).includes(seat.name),
          'Complete nickname remains accessible',
        );
        assert.equal(
          await article.locator('.room-table__name').getAttribute('title'),
          seat.name,
        );
      }
    }
  }
}
async function introduction(page, gameId, label) {
  await page.getByRole('button', { name: '游戏介绍', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '游戏介绍', exact: true });
  await dialog.waitFor();
  const text = (await dialog.textContent()).replace(/\s+/g, ' ');
  const patterns =
    gameId === 'pokemon-encounters'
      ? [
          /宝可梦奇遇/,
          /六|6/,
          /取|摸/,
          /换/,
          /同.{0,12}列|列.{0,12}同/,
          /0|零/,
          /低/,
          /三|3/,
        ]
      : [/现代艺术/, /画/, /拍卖/, /热度|热门/, /四|4/, /资金|钱|资产/];
  for (const pattern of patterns)
    assert.match(
      text,
      pattern,
      label + ': game-specific goal, turn and victory summary',
    );
  assert.ok(
    !text.includes('电脑由管理员管理'),
    'Device duties do not replace the game explanation',
  );
  const bodyText = await dialog
    .locator('.game-introduction p, .game-introduction li')
    .count();
  assert.ok(bodyText > 0, 'Real introduction body is rendered');
  await capture(page, label);
  await geometry(
    page,
    label,
    ['dialog[open] .panel-heading button'],
    'dialog[open]',
  );
  await page.keyboard.press('Escape');
}
async function chooseScale(page, percent) {
  await page
    .getByRole('button', { name: /^(?:视频|显示)设置$/, exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: /^(?:视频|显示)设置$/,
    exact: true,
  });
  const select = dialog.getByLabel('界面大小', { exact: true });
  const options = await select
    .locator('option')
    .evaluateAll((items) =>
      items.map((item) => ({ value: item.value, text: item.textContent })),
    );
  const selected = options.find((option) =>
    option.text.includes(`${percent}%`),
  );
  assert.ok(selected, 'Display preset is available: ' + percent);
  await select.selectOption(selected.value);
  await page.waitForFunction(async (expected) => {
    const snapshot = await window.tablemaxDisplay.read();
    return snapshot.preferences.interfaceScale === expected;
  }, percent);
  const snapshot = await page.evaluate(() => window.tablemaxDisplay.read());
  await page.keyboard.press('Escape');
  await settle(page);
  const window = await desktop.browserWindow(page);
  evidence.layouts.push({
    label: 'native-scale-' + percent,
    zoom: await window.evaluate((w) => w.webContents.getZoomFactor()),
    snapshot,
  });
  await save();
  assert.equal(
    snapshot.limited,
    false,
    'The chosen representative window is large enough for the requested UI enlargement',
  );
  assert.ok(
    Math.abs(snapshot.zoomFactor - percent / 100) < 0.001,
    'The actual native zoom equals the requested UI enlargement',
  );
}
async function introductionMatrix(host, first, gameId) {
  for (const [width, height] of [
    [360, 640],
    [390, 844],
  ]) {
    await resize(first, width, height, true);
    await introduction(first, gameId, `${gameId}-intro-phone-${width}`);
  }
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ]) {
    await resize(host, width, height);
    await introduction(host, gameId, `${gameId}-intro-host-${width}`);
  }
  for (const [width, height, percent] of [
    [1920, 1080, 125],
    [1920, 1080, 150],
  ]) {
    await resize(host, width, height);
    await chooseScale(host, percent);
    await introduction(
      host,
      gameId,
      `${gameId}-intro-host-${width}-scale-${percent}`,
    );
  }
  await chooseScale(host, 100);
}
async function shutdown() {
  for (const socket of sockets) socket.disconnect();
  sockets.clear();
  if (desktop) await desktop.close();
  desktop = undefined;
  if (origin)
    await until(
      async () => {
        try {
          await fetch(origin + '/api/foundation/health', {
            signal: AbortSignal.timeout(400),
          });
          return false;
        } catch {
          return true;
        }
      },
      'Independent service exits with the desktop',
      8000,
    );
}

try {
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-test-mode'],
    env,
    timeout: 30000,
  });
  const host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  const network = await (await fetch(origin + '/api/room/network')).json();
  const adapter = network.adapters.find((item) => item.kind === 'lan');
  assert.ok(adapter, 'Invite verification uses an actual LAN adapter');
  phoneUrl = `http://${adapter.address}:${network.port}/player`;
  observe(host);
  await settle(host);
  evidence.runtime = await (
    await fetch(origin + '/api/foundation/health')
  ).json();
  assert.equal(await desktop.evaluate(({ app }) => app.isPackaged), portable);
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  hostSocket = await connect(hostToken);
  await host
    .locator('.game-library__item')
    .filter({ hasText: '宝可梦奇遇' })
    .getByRole('button', { name: '选择游戏', exact: true })
    .click();
  await host.getByRole('button', { name: '切换游戏', exact: true }).waitFor();
  await host.getByRole('button', { name: '连接帮助', exact: true }).click();
  await host.getByLabel('电脑地址').selectOption(adapter.address);
  assert.equal(
    (await host.locator('.connection-help__url').textContent()).trim(),
    phoneUrl,
  );
  await host.keyboard.press('Escape');
  assert.equal(
    await host.getByRole('button', { name: /选择头像|更换头像/ }).count(),
    0,
  );
  assert.ok(
    !/电脑\s*·\s*管理员与公共展示|现场公共屏\s*·\s*只读展示/.test(
      await host.locator('.hero').textContent(),
    ),
  );
  const first = await openPhone(0, 360, 640);
  const longName = '手机甲昵称很长也要完整保留姓名与头像身份';
  assert.ok(longName.length <= 24);
  await first.locator('#nickname').fill(longName);
  const initialPicker = await picker(first);
  await avatarImages(initialPicker);
  await capture(first, 'avatar-picker-phone-360');
  await geometry(
    first,
    'avatar-picker-phone-360',
    ['dialog[open] .panel-heading button'],
    'dialog[open]',
  );
  await initialPicker.locator('[data-avatar-id="avatar-20"]').click();
  if (await initialPicker.count()) await first.keyboard.press('Escape');
  assert.equal(
    (await view()).seats.length,
    0,
    'Pre-admission selection is a local draft and does not reserve a seat',
  );
  await capture(first, 'phone-join-360');
  await geometry(first, 'phone-join-360', [
    '#nickname',
    '.join-table__row button',
    '[aria-label="选择头像"]',
  ]);
  await first.getByRole('button', { name: '加入', exact: true }).click();
  await first
    .getByRole('button', { name: '我准备好了', exact: true })
    .waitFor();
  const tokenA = await tokenOf(first);
  const seatA = ownSeat(await view(tokenA));
  assert.equal(seatA.avatarId, 'avatar-20');
  assert.equal(seatA.name, longName);
  await capture(first, 'phone-ready-360');
  await geometry(first, 'phone-ready-360', [
    '.player-actions button:not([aria-label])',
    '[aria-label="更换头像"]',
  ]);
  await introduction(
    first,
    'pokemon-encounters',
    'pokemon-intro-phone-360-initial',
  );
  await consistentAvatars([host, first], await view());
  await check(
    '26 distinct local images decode, all presets have accessible names and 44 px selection buttons; choosing a draft then joining persists the selected avatar, and join/ready controls fit an unobscured 360×640 first screen',
  );
  if (compactOnly) {
    const observer = await openPhone(1, 360, 640);
    const observedPicker = await picker(observer);
    await occupied(observedPicker, 'avatar-20', seatA);
    await capture(observer, 'avatar-picker-visible-occupied-phone-360');
    await observer.keyboard.press('Escape');
    await check(
      'The actual short-screen picker is scrolled to the saved occupied image; disabled choice and explicit non-color occupancy text are visible in the screenshot',
    );
  }
  if (!compactOnly) {
    let second = await openPhone(1);
    const secondPicker = await picker(second);
    await occupied(secondPicker, 'avatar-20', seatA);
    await capture(second, 'avatar-picker-occupied-phone-390');
    await secondPicker.locator('[data-avatar-id="avatar-21"]').click();
    if (await secondPicker.count()) await second.keyboard.press('Escape');
    await second.locator('#nickname').fill('手机乙');
    await second.getByRole('button', { name: '加入', exact: true }).click();
    await second
      .getByRole('button', { name: '我准备好了', exact: true })
      .waitFor();
    const tokenB = await tokenOf(second);
    const seatB = ownSeat(await view(tokenB));
    const ownPicker = await picker(first, true);
    const ownButton = ownPicker.locator('[data-avatar-id="avatar-20"]');
    assert.equal(await ownButton.isDisabled(), false);
    assert.equal(await ownButton.getAttribute('aria-pressed'), 'true');
    assert.ok((await ownButton.textContent()).includes('当前头像'));
    await ownButton.click();
    if (await ownPicker.count()) await first.keyboard.press('Escape');
    assert.equal(ownSeat(await view(tokenA)).avatarId, 'avatar-20');
    await chooseAvatar(first, 'avatar-22', true);
    await until(
      async () => ownSeat(await view(tokenA)).avatarId === 'avatar-22',
      'Changing an own avatar saves the new claim',
    );
    const releasedPicker = await picker(second, true);
    assert.equal(
      await releasedPicker.locator('[data-avatar-id="avatar-20"]').isDisabled(),
      false,
    );
    await first
      .getByRole('button', { name: '更换头像', exact: true })
      .waitFor();
    await second.keyboard.press('Escape');
    await check(
      'Occupied choices are disabled and visibly labeled with the full occupant name; own current choice is marked, selecting it preserves identity, and choosing a new avatar releases the old one',
    );

    const third = await openPhone(2);
    await third.locator('#nickname').fill('丢回复手机丙');
    await chooseAvatar(third, 'avatar-20');
    let dropped = false;
    const admissionRequests = [];
    await third.route('**/api/session/join', async (route) => {
      const body = route.request().postDataJSON();
      admissionRequests.push({
        name: body.name,
        avatarId: body.avatarId,
        requestKey: body.requestKey,
      });
      if (dropped) return route.continue();
      dropped = true;
      const response = await route.fetch();
      assert.equal((await response.json()).ok, true);
      await route.abort('failed');
    });
    const beforeDrop = (await view()).seats.length;
    await third.getByRole('button', { name: '加入', exact: true }).click();
    await third.getByText(/尚未收到入座确认/).waitFor();
    const committed = (await view()).seats.find(
      (seat) => seat.name === '丢回复手机丙',
    );
    assert.equal(committed.avatarId, 'avatar-20');
    assert.equal((await view()).seats.length, beforeDrop + 1);
    const pending = await third.evaluate(() =>
      JSON.parse(localStorage.getItem('tablemax-admission')),
    );
    assert.equal(pending.avatarId, 'avatar-20');
    await capture(third, 'phone-admission-reply-dropped');
    await third.reload();
    await third
      .getByRole('button', { name: '我准备好了', exact: true })
      .waitFor();
    const tokenC = await tokenOf(third);
    assert.equal(ownSeat(await view(tokenC)).id, committed.id);
    assert.equal(ownSeat(await view(tokenC)).avatarId, 'avatar-20');
    assert.equal((await view()).seats.length, beforeDrop + 1);
    assert.equal(
      await third.evaluate(() => localStorage.getItem('tablemax-admission')),
      null,
    );
    assert.ok(admissionRequests.length >= 2);
    assert.ok(
      admissionRequests.every(
        (request) =>
          request.avatarId === 'avatar-20' &&
          request.requestKey === pending.requestKey,
      ),
    );
    evidence.admissionRecovery = {
      seatId: committed.id,
      avatarId: committed.avatarId,
      requests: admissionRequests.length,
      oneSavedSeat: true,
    };
    await check(
      'A genuinely committed join response is dropped; pending admission keeps the avatar and request key, and reload recovers exactly the same one seat without claiming a second avatar',
    );

    const offlineCdp = await second.context().newCDPSession(second);
    await offlineCdp.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    // CDP network emulation alone can leave an already established WebSocket
    // alive. Close the real test Form to disconnect this device while retaining
    // its persisted partition. The native origin guard rejects about:blank.
    await offlineCdp.detach();
    phones.splice(phones.indexOf(second), 1);
    await second.close();
    await until(
      async () =>
        !(await view()).seats.find((seat) => seat.id === seatB.id).online,
      'Offline phone is reflected by the service',
    );
    const offlinePicker = await picker(first, true);
    await occupied(offlinePicker, 'avatar-21', seatB);
    await first.keyboard.press('Escape');
    second = await openPhone(1);
    await settle(second);
    assert.equal(await tokenOf(second), tokenB);
    assert.equal(ownSeat(await view(tokenB)).avatarId, 'avatar-21');
    await check(
      'Network-offline device page closes its actual socket without releasing the saved avatar; returning in the same partition retains the original nickname, credential and one seat',
    );

    const raceBodies = ['抢占甲', '抢占乙'].map((name) => ({
      name,
      avatarId: 'avatar-25',
      requestKey: randomBytes(32).toString('hex'),
    }));
    const raced = await Promise.all(
      raceBodies.map(async (body) => {
        const response = await fetch(origin + '/api/session/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return { status: response.status, body: await response.json() };
      }),
    );
    assert.equal(
      raced.filter((reply) => reply.body.ok).length,
      1,
      'Exactly one simultaneous claimant succeeds',
    );
    const rejected = raced.find((reply) => !reply.body.ok);
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.reason, 'avatar-unavailable');
    assert.equal(
      (await view()).seats.filter((seat) => seat.avatarId === 'avatar-25')
        .length,
      1,
    );
    evidence.race = {
      replies: raced.map((reply) => ({
        status: reply.status,
        ok: reply.body.ok,
        reason: reply.body.reason ?? null,
      })),
      savedClaims: 1,
    };
    const raceSeat = (await view()).seats.find(
      (seat) => seat.avatarId === 'avatar-25',
    );
    const racePicker = await picker(first, true);
    await occupied(racePicker, 'avatar-25', raceSeat);
    await capture(first, 'avatar-picker-race-occupied-360');
    await first.keyboard.press('Escape');
    const fourth = await openPhone(3);
    const raceToken = raced.find((reply) => reply.body.ok).body.token;
    await fourth.evaluate(
      (token) => localStorage.setItem('tablemax-player', token),
      raceToken,
    );
    await fourth.reload();
    await fourth
      .getByRole('button', { name: '我准备好了', exact: true })
      .waitFor();
    await check(
      'Two real concurrent HTTP admissions claim the same avatar: one succeeds, one receives avatar-unavailable, and the live picker shows the saved claim as disabled',
    );

    const publicReady = desktop.waitForEvent('window');
    await host.getByRole('button', { name: '管理设置', exact: true }).click();
    await host
      .getByRole('link', { name: '打开公共屏', exact: true })
      .click({ noWaitAfter: true });
    const publicPage = await publicReady;
    observe(publicPage);
    await settle(publicPage);
    await host.goto(origin + '/host', { waitUntil: 'domcontentloaded' });
    await settle(host);
    assert.equal(
      await publicPage
        .getByRole('button', { name: /选择头像|更换头像/ })
        .count(),
      0,
    );
    assert.equal(await publicPage.locator('#nickname').count(), 0);
    const guestSocket = await connect(undefined);
    const guestReply = await command(
      guestSocket,
      undefined,
      { type: 'set-avatar', avatarId: 'avatar-26' },
      'unauthorized',
    );
    assert.equal(guestReply.ok, false);
    guestSocket.disconnect();
    sockets.delete(guestSocket);
    const state = await view();
    await consistentAvatars([host, publicPage, ...phones], state);
    await resize(host, 1920, 1080);
    await resize(publicPage, 1920, 1080);
    await capture(host, 'box-host-four-avatars-1920');
    await capture(publicPage, 'box-public-four-avatars');
    await introductionMatrix(host, first, 'pokemon-encounters');
    await check(
      'Host, native public screen and four independent phone identities show the same saved avatars; public has no selection/join controls and an unauthorized claim is rejected',
    );
    for (const page of phones) {
      await page
        .getByRole('button', { name: '我准备好了', exact: true })
        .click();
      await until(
        async () => ownSeat(await view(await tokenOf(page))).ready,
        'Actual phone ready command is saved',
      );
    }
    await host.getByRole('button', { name: '开始游戏', exact: true }).click();
    await until(
      async () => (await view()).status === 'playing',
      'Actual UI starts the selected game',
    );
    for (const page of [host, publicPage, ...phones]) {
      const role = new URL(page.url()).pathname.split('/')[1];
      await page.goto(new URL(`/${role}/game`, page.url()).href, {
        waitUntil: 'domcontentloaded',
      });
      await page.locator('.pokemon-screen').waitFor();
    }
    await consistentAvatars([host, publicPage], await view(), true);
    for (let index = 0; index < phones.length; index++) {
      const playerState = await view(await tokenOf(phones[index]));
      const self = ownSeat(playerState);
      const path = await phones[index]
        .locator(`.game-seat[data-seat="${self.id}"] .avatar`)
        .getAttribute('src');
      assert.equal(
        new URL(path, phones[index].url()).pathname,
        new URL(evidence.images.find((image) => image.id === self.avatarId).src)
          .pathname,
      );
    }
    await playerCommand(
      tokenA,
      { type: 'set-avatar', avatarId: 'avatar-26' },
      'avatars-locked',
    );
    assert.equal(ownSeat(await view(tokenA)).avatarId, 'avatar-22');
    await capture(first, 'pokemon-game-selected-avatar');
    await check(
      'Entering the real game retains each chosen portrait on host/public/player tables, and changing an avatar during the game is rejected without mutating identity',
    );

    await command(hostSocket, hostToken, { type: 'end' });
    const beforeSwitch = (await view()).seats.map(({ id, name, avatarId }) => ({
      id,
      name,
      avatarId,
    }));
    await command(hostSocket, hostToken, {
      type: 'select-game',
      gameId: 'modern-art',
    });
    assert.deepEqual(
      (await view()).seats.map(({ id, name, avatarId }) => ({
        id,
        name,
        avatarId,
      })),
      beforeSwitch,
    );
    await host.goto(origin + '/host', { waitUntil: 'domcontentloaded' });
    await first.goto(new URL('/player', phoneUrl).href, {
      waitUntil: 'domcontentloaded',
    });
    await settle(host);
    await settle(first);
    assert.ok(
      !/手机\s*·\s*你的玩家座位/.test(
        await first.locator('.hero').textContent(),
      ),
    );
    await consistentAvatars([host, first], await view());
    await introductionMatrix(host, first, 'modern-art');
    await check(
      'A genuine game switch retains all four names, seat IDs and avatars; both games explain their own core play and victory conditions on 360/390 phones, 720p/1080p/4K desktop and 125/150% display presets with readable text and no horizontal clipping',
    );
  }
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  await shutdown();
  evidence.status = 'passed';
  evidence.completedAt = new Date().toISOString();
  await save();
  console.log(
    JSON.stringify(
      {
        status: evidence.status,
        checks: evidence.checks.length,
        layouts: evidence.layouts.length,
        screenshots: evidence.screenshots.length,
        archiveSha256,
        output,
      },
      null,
      2,
    ),
  );
} catch (error) {
  evidence.status = 'failed';
  evidence.failure = error.stack ?? String(error);
  if (desktop && currentPage && !currentPage.isClosed()) {
    await capture(currentPage, 'failure-current-page').catch(() => {});
    evidence.failureDocument = await currentPage
      .locator('body')
      .innerText()
      .catch(() => 'Document unavailable');
  }
  await shutdown().catch((shutdownError) => {
    evidence.shutdownFailure = String(shutdownError);
  });
  await save();
  console.error(evidence.failure);
  process.exitCode = 1;
}
