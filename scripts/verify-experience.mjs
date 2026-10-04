import assert from 'node:assert/strict';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { verificationOutput } from './verification-output.mjs';
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const output = verificationOutput(
  portable ? 'experience-portable' : 'experience',
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/experience-'));
let executablePath = desktopExecutable,
  archiveSha256;
if (portable) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
  const extracted = join(work, 'portable');
  await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_ARCHIVE -DestinationPath $env:TABLEMAX_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_ARCHIVE: archive,
        TABLEMAX_EXTRACT: extracted,
      },
    },
  );
  executablePath = join(extracted, 'TableMax.exe');
  archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
}
const evidence = {
  verifiedAt: new Date().toISOString(),
  portable,
  archiveSha256,
  scope:
    'Real hidden WebView2 and service; six independent Chromium phone sessions, not physical phone/TV or listening verification.',
  checks: [],
  screenshots: [],
  errors: [],
  resources: [],
  audio: [],
};
const clients = [];
let desktop, origin;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(check, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(35);
  }
  throw new Error(label);
}
async function view(token) {
  const result = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(result.ok, true);
  return result.view;
}
async function connect(token) {
  const socket = io(origin, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  await new Promise((done, fail) => {
    socket.once('room:view', done);
    socket.once('connect_error', fail);
  });
  clients.push(socket);
  return socket;
}
async function send(socket, token, command) {
  const current = await view(token);
  const result = await new Promise((done, fail) =>
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: current.instanceId,
        branch: current.branch,
        revision: current.revision,
        command,
      },
      (error, reply) => (error ? fail(error) : done(reply)),
    ),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}
async function observe(page) {
  page.on('pageerror', (error) => evidence.errors.push(error.message));
  await page.addInitScript(() => {
    window.experienceSounds = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.experienceSounds.push(this.src);
      return play.call(this);
    };
  });
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
  const png = await window.evaluate(async (window) =>
    (
      await window.webContents.capturePage(undefined, {
        stayHidden: true,
        stayAwake: true,
      })
    )
      .toPNG()
      .toString('base64'),
  );
  await writeFile(join(output, name + '.png'), Buffer.from(png, 'base64'));
  evidence.screenshots.push(name + '.png');
}
async function phone(index) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, { index, origin }) => {
      const window = new BrowserWindow({
        show: false,
        frame: false,
        width: 390,
        height: 844,
        webPreferences: {
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          offscreen: true,
          backgroundThrottling: false,
          partition: 'persist:experience-' + index,
        },
      });
      void window.loadURL(origin + '/player');
    },
    { index, origin },
  );
  const page = await next;
  await observe(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page.getByLabel('你的昵称').fill('朋友 ' + (index + 1));
  await page.getByRole('button', { name: '加入', exact: true }).click();
  await page.getByRole('button', { name: '我准备好了', exact: true }).waitFor();
  return {
    page,
    token: await page.evaluate(() => localStorage.getItem('tablemax-player')),
  };
}
try {
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: join(work, 'data'),
    TABLEMAX_PORT: '0',
    TABLEMAX_HOST: '127.0.0.1',
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  delete env.NODE_PATH;
  if (portable)
    env.PATH = process.env.SystemRoot + '\\system32;' + process.env.SystemRoot;
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-play-mode'],
    env,
    timeout: 30000,
  });
  const host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  await observe(host);
  await host.reload();
  await host
    .locator('.game-library__item')
    .filter({ hasText: '宝可梦奇遇' })
    .getByRole('button', { name: '选择游戏', exact: true })
    .waitFor();
  const hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  const socket = await connect(hostToken);
  assert.equal((await view(hostToken)).game, null);
  assert.equal(
    (await (await fetch(origin + '/api/foundation/health')).json())
      .protocolVersion,
    6,
  );
  const initialResources = await host.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.name),
  );
  assert.ok(
    initialResources.every(
      (url) =>
        !/PokemonScreen|ordinary-|special-|garden-table|\.mp3|\.wav/i.test(url),
    ),
    'Unselected box loads no game client/audio/character/table resources',
  );
  evidence.resources.push({ phase: 'unselected', urls: initialResources });
  const alignment = await host
    .getByRole('button', { name: '显示设置', exact: true })
    .evaluate((button) => {
      const a = button.querySelector('svg').getBoundingClientRect(),
        b = button.querySelector('span').getBoundingClientRect();
      return {
        display: getComputedStyle(button).display,
        delta: Math.abs(a.y + a.height / 2 - b.y - b.height / 2),
      };
    });
  assert.ok(['flex', 'inline-flex'].includes(alignment.display));
  assert.ok(alignment.delta < 2);
  await capture(host, 'game-library');
  await host.getByRole('button', { name: '连接帮助', exact: true }).click();
  const help = host.getByRole('dialog', { name: '连接帮助', exact: true });
  await help.getByRole('button', { name: '刷新连接地址', exact: true }).click();
  await capture(host, 'connection-help');
  await host.keyboard.press('Escape');
  await host
    .locator('.game-library__item')
    .filter({ hasText: '宝可梦奇遇' })
    .getByRole('button', { name: '选择游戏', exact: true })
    .click();
  await host.getByRole('button', { name: '切换游戏', exact: true }).waitFor();
  assert.equal(
    await host.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .some((entry) => /PokemonScreen/.test(entry.name)),
    ),
    false,
    'Box selection keeps full game client unloaded',
  );
  evidence.checks.push(
    'Fresh game catalog, unloaded box client, aligned display/help controls',
  );
  const phones = [];
  for (let i = 0; i < 6; i++) phones.push(await phone(i));
  await Promise.all(
    phones.map(({ page }) =>
      page.getByRole('button', { name: '我准备好了', exact: true }).click(),
    ),
  );
  await until(
    async () => (await view(hostToken)).seats.every((seat) => seat.ready),
    'All simultaneous ready requests persist',
  );
  const seated = await view(hostToken);
  await host.getByRole('button', { name: '管理设置', exact: true }).click();
  await host.getByLabel('手机房主').selectOption(seated.seats[0].id);
  await until(
    async () => (await view(phones[0].token)).capabilities.control,
    'Owner delegated',
  );
  await host.keyboard.press('Escape');
  assert.equal(
    await phones[1].page
      .getByRole('button', { name: '开始游戏', exact: true })
      .count(),
    0,
  );
  await phones[0].page
    .getByRole('button', { name: '开始游戏', exact: true })
    .click();
  await Promise.all(
    phones.map(({ page }) => page.waitForURL('**/player/game')),
  );
  await host.waitForURL('**/host/game');
  await host.locator('.pokemon-screen').waitFor();
  assert.equal(
    await host.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .some((entry) => /PokemonScreen/.test(entry.name)),
    ),
    true,
    'Game route loads its independent client',
  );
  await host
    .getByRole('button', { name: '提示音已开启 · 静音', exact: true })
    .waitFor();
  await phones[0].page
    .getByRole('button', { name: '位置 1：暗牌', exact: true })
    .click();
  await phones[1].page
    .getByRole('button', { name: '位置 1：暗牌', exact: true })
    .click();
  await phones[1].page
    .getByRole('button', { name: '翻开位置 1', exact: true })
    .click();
  await phones[1].page
    .getByText('你已翻牌，等朋友们选好。', { exact: true })
    .waitFor();
  assert.equal(
    await phones[0].page
      .getByRole('button', { name: '翻开位置 1', exact: true })
      .isEnabled(),
    true,
  );
  const remaining = phones.filter((_, i) => i !== 1);
  await Promise.all(
    remaining
      .slice(1)
      .map(({ page }) =>
        page.getByRole('button', { name: '位置 1：暗牌', exact: true }).click(),
      ),
  );
  await Promise.all(
    remaining.map(({ page }) =>
      page.getByRole('button', { name: '翻开位置 1', exact: true }).click(),
    ),
  );
  await until(
    async () => (await view()).gameView.initialDone.length === 6,
    'All independent initial flips persist',
  );
  assert.equal((await view()).gameView.phase, 'draw');
  evidence.checks.push(
    'Six independent phone readiness and initial flips, another actor does not clear local choice',
  );
  await phones[0].page
    .getByRole('button', { name: '菜单', exact: true })
    .click();
  const ownerMenu = phones[0].page.getByRole('dialog', {
    name: '牌桌菜单',
    exact: true,
  });
  assert.equal(
    await ownerMenu
      .getByRole('button', { name: '结束游戏', exact: true })
      .count(),
    0,
  );
  assert.equal(await ownerMenu.getByLabel('手机房主').count(), 0);
  await ownerMenu
    .getByRole('button', { name: '暂停游戏', exact: true })
    .click();
  await until(async () => (await view()).paused, 'Owner pauses');
  await ownerMenu
    .getByRole('button', { name: '恢复游戏', exact: true })
    .click();
  await until(async () => !(await view()).paused, 'Owner resumes');
  await phones[0].page.keyboard.press('Escape');
  await capture(phones[0].page, 'mobile-owner');
  assert.equal(
    (
      await fetch(origin + '/api/session/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'removed' }),
      })
    ).status,
    404,
  );
  evidence.checks.push(
    'Mobile owner controls only authorized lifecycle actions; rebind endpoint removed',
  );
  // Open the real app-managed public screen so it receives the narrow preload bridge.
  await host.getByRole('button', { name: '菜单', exact: true }).click();
  const nextPublic = desktop.waitForEvent('window');
  await host
    .getByRole('link', { name: '打开公共屏', exact: true })
    .click({ noWaitAfter: true });
  const publicPage = await nextPublic;
  await observe(publicPage);
  await publicPage.locator('.pokemon-screen').waitFor();
  await publicPage.evaluate(() => {
    window.experienceReloadMarker = true;
  });
  await (
    await desktop.browserWindow(publicPage)
  ).evaluate((window) => window.webContents.reload());
  await publicPage.waitForFunction(
    () => window.experienceReloadMarker === undefined,
  );
  await publicPage
    .getByRole('button', { name: '提示音已开启 · 静音', exact: true })
    .waitFor();
  await host.keyboard.press('Escape');
  await until(
    async () =>
      await publicPage.evaluate(() =>
        window.tablemaxAudio.claimEvent('experience-public-ready'),
      ),
    'Public screen takes audio output',
  );
  assert.equal(
    await host.evaluate(() =>
      window.tablemaxAudio.claimEvent('experience-host-denied'),
    ),
    false,
  );
  const shared = 'experience-shared-' + randomUUID();
  assert.equal(
    await publicPage.evaluate(
      (key) => window.tablemaxAudio.claimEvent(key),
      shared,
    ),
    true,
  );
  const actor = (await view()).gameView.actorSeat;
  const actorPhone = phones.find(
    (_, index) => seated.seats[index].id === actor,
  );
  const baselineHost = await host.evaluate(
    () => window.experienceSounds.length,
  );
  await actorPhone.page
    .getByRole('button', { name: '从牌库取牌', exact: true })
    .click();
  await until(
    async () =>
      (await publicPage.evaluate(() => window.experienceSounds.length)) > 0,
    'Default public sound plays on committed draw',
  );
  assert.equal(
    await host.evaluate(() => window.experienceSounds.length),
    baselineHost,
  );
  await publicPage.locator('.held-pile').waitFor();
  assert.match(
    await publicPage.locator('.held-zone').textContent(),
    /暂持|未入场|等待处理/,
  );
  await capture(publicPage, 'public-action-and-held');
  evidence.audio.push({
    publicSounds: await publicPage.evaluate(() => window.experienceSounds),
    hostCount: baselineHost,
  });
  const publicWindow = await desktop.browserWindow(publicPage);
  await publicWindow.evaluate((window) => window.close());
  await until(
    async () =>
      await host.evaluate(() =>
        window.tablemaxAudio.claimEvent('experience-host-restored'),
      ),
    'Audio returns to admin',
  );
  assert.equal(
    await host.evaluate((key) => window.tablemaxAudio.claimEvent(key), shared),
    false,
    'Handoff never replays the same event',
  );
  await send(socket, hostToken, { type: 'set-owner', seatId: null });
  assert.equal((await view(phones[0].token)).capabilities.control, false);
  evidence.checks.push(
    'Saved sound defaults on, public wins output, closing returns output, cross-window event deduplication, owner revocation',
  );
  evidence.resources.push({
    phase: 'selected',
    urls: await host.evaluate(() =>
      performance.getEntriesByType('resource').map((entry) => entry.name),
    ),
  });
  assert.deepEqual(evidence.errors, []);
  assert.ok(
    evidence.resources.every(({ urls }) =>
      urls.every((url) => new URL(url).origin === origin),
    ),
  );
  evidence.result = 'passed';
  console.log(
    JSON.stringify({
      result: evidence.result,
      checks: evidence.checks.length,
      output,
    }),
  );
} catch (error) {
  evidence.result = 'failed';
  evidence.error = String(error.stack ?? error);
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const socket of clients) socket.disconnect();
  if (desktop) await desktop.close();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2),
  );
}
