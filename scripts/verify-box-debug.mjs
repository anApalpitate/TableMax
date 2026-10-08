import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';
import { verificationOutput } from './verification-output.mjs';

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const { PNG } = createRequire(resolve('apps/server/package.json'))('pngjs');
const portable = process.argv.includes('--portable');
const runName = process.argv
  .find((argument) => argument.startsWith('--run='))
  ?.slice(6);
assert.ok(!runName || /^[a-z0-9-]+$/.test(runName));
const output = verificationOutput(
  'box-debug-20261004',
  runName ?? (portable ? 'portable' : 'development'),
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/room-levels-'));
const started = performance.now();
const evidence = {
  status: 'running',
  portable,
  scope:
    'Actual hidden native WebView2, independent simulated phone windows and real loopback HTTP/Socket/SQLite; no physical phone, LAN or TV claim.',
  checks: [],
  screenshots: [],
  layouts: [],
  errors: [],
  external: [],
};
let desktop, hostSocket, origin, hostToken, archiveSha256;
const phones = [];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(check, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await wait(80);
  }
  throw new Error(label);
}
async function save() {
  evidence.elapsedSeconds =
    Math.round((performance.now() - started) / 10) / 100;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2),
  );
}
async function check(message) {
  evidence.checks.push(message);
  await save();
  console.log(message);
}
function observe(page) {
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => evidence.errors.push(error.message));
  page.on('request', (request) => {
    if (
      request.url().startsWith('http') &&
      new URL(request.url()).origin !== origin
    )
      evidence.external.push(request.url());
  });
}
async function view(token = hostToken) {
  const result = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  ).json();
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.view;
}
async function command(value) {
  const state = await view();
  const reply = await new Promise((done, reject) =>
    hostSocket.timeout(5000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: state.instanceId,
        revision: state.revision,
        branch: state.branch,
        command: value,
      },
      (error, result) => (error ? reject(error) : done(result)),
    ),
  );
  assert.equal(reply.ok, true, JSON.stringify(reply));
}
async function settle(page) {
  await page.locator('.connection.online').waitFor();
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
}
async function box(page, role = 'host') {
  await page.goto(`${origin}/${role}`, { waitUntil: 'domcontentloaded' });
  await settle(page);
}
async function capture(page, label) {
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((w) => w.isVisible()), false);
  const png = Buffer.from(
    await window.evaluate(async (w) =>
      (
        await w.webContents.capturePage(undefined, {
          stayHidden: true,
          stayAwake: true,
        })
      )
        .toPNG()
        .toString('base64'),
    ),
    'base64',
  );
  await writeFile(join(output, `${label}.png`), png);
  evidence.screenshots.push(`${label}.png`);
  await save();
}
async function resize(page, width, height, mobile = false) {
  const window = await desktop.browserWindow(page);
  await window.evaluate(
    (w, size) => w.setContentSize(size.width, size.height),
    { width, height },
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
}
async function fit(page, label) {
  const metrics = await page.evaluate(() => {
    const panel = document.querySelector('dialog[open]');
    const bounds = panel?.getBoundingClientRect();
    const icons = [
      ...document.querySelectorAll('.header-status .icon-label-control'),
    ].map((button) => {
      const icon = button.querySelector('svg')?.getBoundingClientRect(),
        text = button.querySelector('span')?.getBoundingClientRect();
      return {
        name: button.getAttribute('aria-label'),
        icon: icon && { width: icon.width, center: icon.y + icon.height / 2 },
        text: text && { center: text.y + text.height / 2 },
      };
    });
    const text = [
      ...document.querySelectorAll(
        '.lobby-readiness, .display-settings-fields label, .display-settings-metrics dt, .countdown-settings p',
      ),
    ].map((node) => ({
      text: node.textContent,
      font: parseFloat(getComputedStyle(node).fontSize),
    }));
    return {
      width: innerWidth,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      panel: bounds && {
        x: bounds.x,
        y: bounds.y,
        right: bounds.right,
        bottom: bounds.bottom,
      },
      icons,
      text,
    };
  });
  evidence.layouts.push({ label, ...metrics });
  await save();
  assert.equal(metrics.overflow, false, label + ' no horizontal overflow');
  if (metrics.panel)
    assert.ok(
      metrics.panel.x >= -1 &&
        metrics.panel.y >= -1 &&
        metrics.panel.right <= metrics.width + 1 &&
        metrics.panel.bottom <= metrics.height + 1,
      label + ' panel fits',
    );
  for (const icon of metrics.icons)
    if (icon.icon && icon.text)
      assert.ok(
        icon.icon.width >= 20 &&
          Math.abs(icon.icon.center - icon.text.center) <= 3,
        label + ' icon aligned',
      );
  for (const text of metrics.text)
    assert.ok(text.font >= 16, label + ' readable: ' + text.text);
}
async function openPage(index, role = 'player', width = 390, height = 844) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, input) => {
      const window = new BrowserWindow({
        frame: false,
        show: false,
        width: input.width,
        height: input.height,
        webPreferences: {
          partition: `persist:box-debug-${input.index}`,
          offscreen: true,
          backgroundThrottling: false,
        },
      });
      void window.loadURL(input.url);
    },
    { index, width, height, url: `${origin}/${role}` },
  );
  const page = await next;
  observe(page);
  await resize(page, width, height, role === 'player');
  phones.push(page);
  return page;
}
async function avatarDialog(page, joined = false) {
  await page
    .getByRole('button', {
      name: joined ? '更换头像' : '选择头像',
      exact: true,
    })
    .click();
  const panel = page.getByRole('dialog', { name: '选择头像', exact: true });
  await panel.waitFor();
  return panel;
}
async function seats(page) {
  await page.getByRole('button', { name: '座位设置', exact: true }).click();
  await page.getByRole('dialog', { name: '座位设置', exact: true }).waitFor();
}
async function chooseGame(page, name) {
  await page.getByRole('button', { name: '切换游戏', exact: true }).click();
  await page
    .locator('.game-library__item')
    .filter({ hasText: name })
    .getByRole('button', { name: '选择游戏', exact: true })
    .click();
}

try {
  let executablePath = desktopExecutable;
  const env = {
    ...process.env,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
    TABLEMAX_DATA_DIR: join(work, 'data'),
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  delete env.NODE_PATH;
  if (portable) {
    const archive = resolve('artifacts/releases/TableMax-1.0.2-win-x64.zip');
    archiveSha256 = createHash('sha256')
      .update(await readFile(archive))
      .digest('hex');
    evidence.archiveSha256 = archiveSha256;
    const extracted = join(work, 'portable');
    await promisify(execFile)(
      join(
        process.env.SystemRoot,
        'System32/WindowsPowerShell/v1.0/powershell.exe',
      ),
      [
        '-NoProfile',
        '-Command',
        'Expand-Archive -LiteralPath $env:TABLEMAX_DEBUG_ARCHIVE -DestinationPath $env:TABLEMAX_DEBUG_EXTRACT',
      ],
      {
        env: {
          ...process.env,
          TABLEMAX_DEBUG_ARCHIVE: archive,
          TABLEMAX_DEBUG_EXTRACT: extracted,
        },
        windowsHide: true,
      },
    );
    executablePath = join(extracted, 'TableMax.exe');
    env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
  }
  desktop = await launchDesktop({ executablePath, env });
  const host = await desktop.firstWindow();
  await settle(host);
  origin = new URL(host.url()).origin;
  observe(host);
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  hostSocket = io(origin, {
    auth: { token: hostToken },
    transports: ['websocket'],
    forceNew: true,
  });
  await new Promise((done, reject) => {
    hostSocket.once('room:view', done);
    hostSocket.once('connect_error', reject);
  });
  await host
    .locator('.game-library__item')
    .filter({ hasText: '宝可梦奇遇' })
    .getByRole('button', { name: '选择游戏', exact: true })
    .click();
  await host.getByRole('button', { name: '切换游戏', exact: true }).waitFor();
  assert.equal(
    await host.getByRole('button', { name: '游戏设置', exact: true }).count(),
    0,
  );
  assert.equal(await host.locator('.phone-entry-note, .url').count(), 0);
  await check(
    'Pokemon has no empty game settings; redundant QR captions are absent',
  );
  const data = Buffer.alloc(512 * 256 * 4, 255);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 512; x++) {
      const offset = (y * 512 + x) * 4;
      data[offset] = x < 256 ? 40 : 220;
      data[offset + 1] = y;
      data[offset + 2] = 120;
    }
  const file = join(work, 'crop-input.png');
  await writeFile(file, PNG.sync.write({ width: 512, height: 256, data }));
  const phone = await openPage(1);
  let dialog = await avatarDialog(phone);
  await dialog.locator('input[type=file]').setInputFiles(file);
  await dialog.locator('.avatar-upload__frame img').waitFor();
  await dialog
    .getByRole('slider', { name: '头像缩放', exact: true })
    .press('Home');
  for (let n = 0; n < 8; n++)
    await dialog
      .getByRole('slider', { name: '头像缩放', exact: true })
      .press('ArrowRight');
  const crop = await dialog.locator('.avatar-upload__frame').boundingBox();
  assert.ok(crop);
  await phone.mouse.move(crop.x + crop.width / 2, crop.y + crop.height / 2);
  await phone.mouse.down();
  await phone.mouse.move(
    crop.x + crop.width / 2 - 20,
    crop.y + crop.height / 2,
    { steps: 4 },
  );
  await phone.mouse.up();
  await fit(phone, 'phone-crop-390');
  await capture(phone, 'phone-crop-390');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(await dialog.locator('.avatar-upload__frame').count(), 0);
  await dialog.locator('input[type=file]').setInputFiles(file);
  await dialog.locator('.avatar-upload__frame img').waitFor();
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await phone.getByLabel('你的昵称').fill('自定义头像朋友');
  await phone.getByRole('button', { name: '加入', exact: true }).click();
  await phone.getByRole('button', { name: '更换头像', exact: true }).waitFor();
  const playerToken = await phone.evaluate(() =>
    localStorage.getItem('tablemax-player'),
  );
  let state = await view();
  const playerId = state.seats[0].id,
    customId = state.seats[0].avatarId;
  assert.match(customId, /^custom-[0-9a-f]{64}$/);
  await phone.reload();
  await settle(phone);
  assert.equal((await view(playerToken)).seats[0].avatarId, customId);
  const second = await openPage(2);
  await second.getByLabel('你的昵称').fill('另一位朋友');
  await second.getByRole('button', { name: '加入', exact: true }).click();
  await second.getByRole('button', { name: '更换头像', exact: true }).waitFor();
  await command({ type: 'set-owner', seatId: playerId });
  for (let n = 1; n <= 4; n++)
    await command({
      type: 'add-bot',
      name: `人机 ${n}`,
      difficulty: 'default',
    });
  await until(
    async () =>
      (await phone
        .getByRole('button', { name: '座位设置', exact: true })
        .count()) === 1,
    'owner seat permission visible',
  );
  await seats(phone);
  await phone
    .getByRole('button', { name: '人机 1座位操作', exact: true })
    .click();
  await phone
    .getByRole('button', { name: '修改人机名称', exact: true })
    .click();
  await phone
    .getByLabel('人机名称', { exact: true })
    .fill('会思考的长名字伙伴');
  await phone.getByRole('button', { name: '保存名称', exact: true }).click();
  await until(
    async () =>
      (await view()).seats.some((seat) => seat.name === '会思考的长名字伙伴'),
    'owner rename saved',
  );
  await phone
    .getByRole('button', { name: '人机 2座位操作', exact: true })
    .click();
  await phone.getByRole('button', { name: '移除人机', exact: true }).click();
  await phone.getByRole('button', { name: '确认移除', exact: true }).click();
  await until(
    async () => (await view()).seats.length === 5,
    'owner removal saved',
  );
  await phone.keyboard.press('Escape');
  await command({ type: 'add-bot', name: '最后一席', difficulty: 'default' });
  await check(
    'Real owner phone renames and removes bot seats; credential and uploaded image survive reload',
  );
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
    [2560, 1440],
    [3840, 2160],
  ]) {
    await resize(host, width, height);
    await fit(host, `host-${width}`);
    await capture(host, `host-${width}`);
    await host
      .getByRole('button', { name: /^(?:视频|显示)设置$/, exact: true })
      .click();
    await fit(host, `display-${width}`);
    await capture(host, `display-${width}`);
    await host.keyboard.press('Escape');
  }
  await resize(host, 1280, 720);
  for (const scale of [125, 150]) {
    await host.evaluate(
      (value) =>
        window.tablemaxDisplay.update({
          resolution: 'auto',
          interfaceScale: value,
        }),
      scale,
    );
    await host
      .getByRole('button', { name: /^(?:视频|显示)设置$/, exact: true })
      .click();
    await fit(host, `display-720-${scale}`);
    await capture(host, `display-720-${scale}`);
    await host.keyboard.press('Escape');
  }
  await host.evaluate(() =>
    window.tablemaxDisplay.update({ resolution: 'auto', interfaceScale: 100 }),
  );
  for (const width of [320, 360, 390]) {
    await resize(phone, width, 640, true);
    await fit(phone, `phone-${width}`);
    await capture(phone, `phone-${width}`);
    await seats(phone);
    await fit(phone, `phone-seats-${width}`);
    await capture(phone, `phone-seats-${width}`);
    await phone.keyboard.press('Escape');
  }
  await phone.getByRole('button', { name: '我准备好了', exact: true }).click();
  await second.getByRole('button', { name: '我准备好了', exact: true }).click();
  await until(
    async () => (await view()).seats.every((seat) => seat.ready),
    'all seats ready',
  );
  await command({ type: 'start' });
  await command({ type: 'pause' });
  await host.goto(`${origin}/host/game`);
  await host
    .locator(`img[src$="/api/avatars/${customId}"]:visible`)
    .first()
    .waitFor();
  assert.equal(
    await host
      .locator(`img[src$="/api/avatars/${customId}"]:visible`)
      .first()
      .evaluate((image) => image.complete && image.naturalWidth === 256),
    true,
  );
  await capture(host, 'pokemon-uploaded-avatar');
  await box(host);
  await box(phone, 'player');
  assert.equal((await view()).decisionClock, null);
  await seats(phone);
  await phone
    .getByRole('button', { name: '人机 3座位操作', exact: true })
    .click();
  await phone.getByRole('button', { name: '移除人机', exact: true }).click();
  await phone
    .getByText('请先结束游戏，再移除座位。', { exact: true })
    .waitFor();
  await capture(phone, 'phone-playing-remove-hint');
  await phone.keyboard.press('Escape');
  await phone.keyboard.press('Escape');
  await chooseGame(host, '电力公司');
  await host.getByRole('button', { name: '结束并切换', exact: true }).click();
  await until(
    async () => (await view()).game.id === 'power-grid',
    'atomic switch to power grid',
  );
  await host
    .getByRole('dialog', { name: '游戏库', exact: true })
    .waitFor({ state: 'hidden' });
  state = await view();
  assert.equal(state.seats.length, 6);
  assert.equal(state.ownerSeatId, playerId);
  assert.equal(state.seats[0].avatarId, customId);
  await host.getByRole('button', { name: '游戏设置', exact: true }).click();
  await host.getByRole('slider').press('Home');
  for (let n = 0; n < 6; n++)
    await host.getByRole('slider').press('ArrowRight');
  await host.getByRole('button', { name: '保存设置', exact: true }).click();
  await until(
    async () => (await view()).countdownSeconds === 25,
    'reminder saved',
  );
  await fit(host, 'power-grid-settings');
  await capture(host, 'power-grid-settings');
  await host.keyboard.press('Escape');
  await check(
    'Playing removal hints first; confirmed atomic switch retains all six identities and avatars, then game reminder settings save',
  );
  const publicReady = desktop.waitForEvent('window');
  await host.getByRole('button', { name: '管理设置', exact: true }).click();
  await host
    .getByRole('link', { name: '打开公共屏', exact: true })
    .click({ noWaitAfter: true });
  const publicPage = await publicReady;
  observe(publicPage);
  await resize(publicPage, 1920, 1080);
  await box(host);
  assert.equal(
    await publicPage
      .getByRole('button', { name: '座位设置', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await publicPage
      .getByRole('button', { name: '游戏设置', exact: true })
      .count(),
    0,
  );
  await publicPage.evaluate(() =>
    window.tablemaxDisplay.update({ resolution: 'auto', interfaceScale: 150 }),
  );
  assert.equal(
    (await host.evaluate(() => window.tablemaxDisplay.read())).preferences
      .interfaceScale,
    100,
  );
  await publicPage.reload();
  await settle(publicPage);
  assert.equal(
    (await publicPage.evaluate(() => window.tablemaxDisplay.read())).preferences
      .interfaceScale,
    150,
  );
  await fit(publicPage, 'public-independent-scale');
  await capture(publicPage, 'public-independent-scale');
  await box(phone, 'player');
  await box(second, 'player');
  await phone.getByRole('button', { name: '我准备好了', exact: true }).click();
  await second.getByRole('button', { name: '我准备好了', exact: true }).click();
  await until(
    async () => (await view()).seats.every((seat) => seat.ready),
    'power grid ready',
  );
  await command({ type: 'start' });
  await command({ type: 'pause' });
  await host.goto(`${origin}/host/game`);
  await host
    .locator(`img[src$="/api/avatars/${customId}"]:visible`)
    .first()
    .waitFor();
  assert.equal(
    await host
      .locator(`img[src$="/api/avatars/${customId}"]:visible`)
      .first()
      .evaluate((image) => image.complete && image.naturalWidth === 256),
    true,
  );
  await capture(host, 'power-grid-uploaded-avatar');
  await box(host);
  await host.getByRole('button', { name: '结束游戏', exact: true }).click();
  await host.getByRole('button', { name: '确认结束游戏', exact: true }).click();
  await until(
    async () => (await view()).status === 'ended',
    'outer end action saved',
  );
  const endedInstance = (await view()).instanceId;
  await seats(host);
  await host
    .getByRole('button', { name: '最后一席座位操作', exact: true })
    .click();
  await host.getByRole('button', { name: '移除人机', exact: true }).click();
  await host.getByRole('button', { name: '确认移除', exact: true }).click();
  await until(async () => (await view()).seats.length === 5, 'five seats');
  await host.keyboard.press('Escape');
  assert.equal((await view()).status, 'lobby');
  assert.notEqual((await view()).instanceId, endedInstance);
  await check(
    'Visible outer End action saves, and removing an ended seat creates a fresh lobby without an extra replay action',
  );
  await chooseGame(host, '现代艺术');
  await until(
    async () => (await view()).game.id === 'modern-art',
    'modern art selected',
  );
  await host.getByRole('button', { name: '人机等级说明', exact: true }).click();
  await capture(host, 'modern-art-bot-info');
  await host.keyboard.press('Escape');
  await host.getByRole('button', { name: '游戏设置', exact: true }).click();
  await capture(host, 'modern-art-settings');
  await host.keyboard.press('Escape');
  await check(
    'Both timer-enabled games expose game settings; public remains read-only and display preferences are independently restored',
  );
  await box(phone, 'player');
  await box(second, 'player');
  await phone.getByRole('button', { name: '我准备好了', exact: true }).click();
  await second.getByRole('button', { name: '我准备好了', exact: true }).click();
  await until(
    async () => (await view()).seats.every((seat) => seat.ready),
    'modern art ready',
  );
  await command({ type: 'start' });
  await command({ type: 'pause' });
  await host.goto(`${origin}/host/game`);
  await host
    .locator(`img[src$="/api/avatars/${customId}"]:visible`)
    .first()
    .waitFor();
  assert.equal(
    await host
      .locator(`img[src$="/api/avatars/${customId}"]:visible`)
      .first()
      .evaluate((image) => image.complete && image.naturalWidth === 256),
    true,
  );
  await capture(host, 'modern-art-uploaded-avatar');
  await check(
    'All three real game pages decode and display the uploaded 256 × 256 avatar',
  );
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(evidence.external, []);
  evidence.status = 'passed';
} catch (error) {
  evidence.status = 'failed';
  evidence.failure = String(error.stack ?? error);
  console.error(evidence.failure);
  if (desktop) {
    const page = (await desktop.windows()).find((p) => !p.isClosed());
    if (page) await capture(page, 'failure').catch(() => {});
  }
  process.exitCode = 1;
} finally {
  hostSocket?.disconnect();
  if (desktop) await desktop.close();
  await save();
  console.log(
    JSON.stringify({
      status: evidence.status,
      seconds: evidence.elapsedSeconds,
      evidence: output,
    }),
  );
}
