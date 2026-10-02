import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const output = resolve(
  'artifacts/maintenance/six-player-presentation',
  portable ? 'party-portable' : 'party',
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const dataDir = await mkdtemp(resolve('tmp/party-'));
const env = {
  ...process.env,
  TABLEMAX_DATA_DIR: dataDir,
  TABLEMAX_HOST: '0.0.0.0',
  TABLEMAX_PORT: '0',
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.TABLEMAX_WEB_DEV_URL;
let executablePath = require('electron');
let archiveSha256;
if (portable) {
  const project = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = resolve(
    `artifacts/releases/TableMax-${project.version}-win-x64.zip`,
  );
  const extracted = await mkdtemp(resolve('tmp/party-portable-'));
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_PARTY_ARCHIVE -DestinationPath $env:TABLEMAX_PARTY_EXTRACT',
    ],
    {
      env: {
        ...process.env,
        TABLEMAX_PARTY_ARCHIVE: archive,
        TABLEMAX_PARTY_EXTRACT: extracted,
      },
      windowsHide: true,
    },
  );
  executablePath = join(extracted, 'TableMax.exe');
  archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
}
const args = portable
  ? ['--foundation-test', '--tablemax-test-mode']
  : [resolve('build/desktop'), '--foundation-test', '--tablemax-test-mode'];
const evidence = {
  verifiedAt: new Date().toISOString(),
  scope:
    'Actual Windows Electron/service, local adapter IPv4 access, hidden Chromium touch viewports and network/lifecycle simulation; no physical Wi-Fi, Safari or phone claim',
  checks: [],
  screenshots: [],
  pageErrors: [],
  dataDir,
  portable,
  archiveSha256,
};
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function view(origin, token) {
  const result = await (
    await fetch(`${origin}/api/session/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(result.ok, true);
  return result.view;
}
async function connect(origin, token) {
  const socket = io(origin, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function command(origin, socket, token, command) {
  const current = await view(origin, token);
  const reply = await new Promise((done, reject) =>
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: crypto.randomUUID(),
        instanceId: current.instanceId,
        revision: current.revision,
        branch: current.branch,
        command,
      },
      (error, result) => (error ? reject(error) : done(result)),
    ),
  );
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return reply;
}
async function openPhone(desktop, origin, index) {
  const ready = desktop.waitForEvent('window');
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
          partition: `persist:party-${input.index}`,
        },
      });
      void window.loadURL(`${input.origin}/player`);
    },
    { origin, index },
  );
  const page = await ready;
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
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
  await page.getByText('本地连接已就绪', { exact: true }).waitFor();
  return page;
}
async function capture(desktop, page, name) {
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((w) => w.isVisible()), false);
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  await wait(150);
  const png = await window.evaluate(async (w) =>
    (
      await w.webContents.capturePage(undefined, {
        stayHidden: true,
        stayAwake: true,
      })
    )
      .toPNG()
      .toString('base64'),
  );
  await writeFile(join(output, `${name}.png`), Buffer.from(png, 'base64'));
  evidence.screenshots.push(`${name}.png`);
}
async function loseReply(page, endpoint) {
  let first = true;
  await page.route(`**/api/session/${endpoint}`, async (route) => {
    if (!first) return route.continue();
    first = false;
    const response = await route.fetch();
    assert.equal((await response.json()).ok, true);
    await route.abort('failed');
  });
}
let desktop, socket, origin, lanOrigin, oldToken, seatId, beforeRestart;
try {
  desktop = await _electron.launch({
    executablePath,
    args,
    env,
    timeout: 30000,
  });
  let host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  await host.getByText('本地连接已就绪', { exact: true }).waitFor();
  origin = new URL(host.url()).origin;
  env.TABLEMAX_PORT = new URL(origin).port;
  const network = await (await fetch(`${origin}/api/room/network`)).json();
  const adapter = network.adapters.find((a) => a.kind === 'lan');
  assert.ok(
    adapter,
    'A local adapter IPv4 is required for LAN-address verification',
  );
  lanOrigin = `http://${adapter.address}:${network.port}`;
  assert.equal((await fetch(`${lanOrigin}/api/foundation/health`)).status, 200);
  const hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  socket = await connect(origin, hostToken);
  assert.ok(
    await desktop.evaluate(({ powerSaveBlocker }) =>
      Array.from({ length: 8 }, (_, id) => id).some((id) =>
        powerSaveBlocker.isStarted(id),
      ),
    ),
  );
  evidence.checks.push(
    'Service listens on 0.0.0.0 and responds through an actual local adapter IPv4; native power blocker active',
  );
  await host.getByRole('button', { name: '连接帮助', exact: true }).click();
  await host.getByLabel('电脑地址').selectOption(adapter.address);
  await host.getByRole('button', { name: '刷新连接地址', exact: true }).click();
  await host.reload();
  await host.getByRole('button', { name: '连接帮助', exact: true }).click();
  await host.waitForFunction(
    (address) => document.querySelector('#address')?.value === address,
    adapter.address,
  );
  assert.ok(
    (await host.locator('.url').textContent()).includes(adapter.address),
  );
  await capture(desktop, host, 'network-help');
  await host.keyboard.press('Escape');
  evidence.checks.push(
    'Adapter labels, refresh, remembered selection and QR URL use the selected local IPv4',
  );
  const first = await openPhone(desktop, lanOrigin, 0);
  await loseReply(first, 'join');
  await first.getByLabel('你的昵称').fill('聚会甲');
  await first.getByRole('button', { name: '加入', exact: true }).click();
  await first.getByText(/尚未收到入座确认/).waitFor();
  assert.equal((await view(origin)).seats.length, 1);
  await capture(desktop, first, 'join-lost-reply');
  await first.reload();
  await first
    .getByRole('button', { name: '我准备好了', exact: true })
    .waitFor();
  oldToken = await first.evaluate(() =>
    localStorage.getItem('tablemax-player'),
  );
  seatId = (await view(origin, oldToken)).self.seatId;
  assert.equal((await view(origin)).seats.length, 1);
  assert.equal(
    await first.evaluate(() => localStorage.getItem('tablemax-admission')),
    null,
  );
  evidence.checks.push(
    'Committed join reply deliberately dropped; refresh recovers one seat with the original request key',
  );
  const second = await openPhone(desktop, lanOrigin, 1);
  const cdp = await second.context().newCDPSession(second);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 250,
    downloadThroughput: 65536,
    uploadThroughput: 32768,
  });
  await second.getByLabel('你的昵称').fill('聚会乙');
  await second.getByRole('button', { name: '加入', exact: true }).click();
  await second
    .getByRole('button', { name: '我准备好了', exact: true })
    .waitFor();
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  const secondToken = await second.evaluate(() =>
    localStorage.getItem('tablemax-player'),
  );
  await first.getByRole('button', { name: '我准备好了', exact: true }).click();
  await second.getByRole('button', { name: '我准备好了', exact: true }).click();
  await host.getByRole('button', { name: '开始游戏', exact: true }).click();
  for (const page of [first, second]) {
    await page.waitForURL('**/player/game');
    await page.getByRole('button', { name: /^位置 1：/ }).click();
    await page.getByRole('button', { name: '翻开位置 1', exact: true }).click();
    await page.getByText('已保存', { exact: true }).waitFor();
  }
  await host.waitForURL('**/host/game');
  await host.getByRole('button', { name: '菜单', exact: true }).click();
  await host.getByRole('button', { name: /^决策点回退（/ }).click();
  await host.getByLabel('筛选回退玩家').selectOption(seatId);
  assert.ok(
    (await host.locator('.rollback-history').textContent()).includes(
      '第 1 小局 · 第 1 步 · 聚会甲',
    ),
  );
  await capture(desktop, host, 'rollback-context');
  await host
    .locator('.rollback-history')
    .getByRole('button', { name: /第 1 小局 · 第 1 步/ })
    .click();
  await host
    .getByRole('dialog', { name: '确认回退', exact: true })
    .getByRole('button', { name: '确认回退', exact: true })
    .click();
  await host.getByRole('button', { name: '关闭面板' }).click();
  await host.getByText('游戏已暂停', { exact: true }).waitFor();
  assert.equal((await view(origin, hostToken)).history.length, 0);
  await host.getByRole('button', { name: '恢复游戏', exact: true }).click();
  evidence.checks.push(
    '250ms/limited-bandwidth admission; actual touch selection; rollback filters and numbered player/round context, confirmation, synchronized pause',
  );
  await host.getByRole('button', { name: '菜单', exact: true }).click();
  await host.getByRole('button', { name: '换手机', exact: true }).click();
  await host
    .getByRole('button', { name: '聚会甲 · 换手机', exact: true })
    .click();
  await host
    .getByRole('dialog', { name: '确认换手机', exact: true })
    .getByRole('button', { name: '确认换手机', exact: true })
    .click();
  const bindingCode = await host.getByLabel('一次性绑定码').inputValue();
  const rebound = await openPhone(desktop, lanOrigin, 2);
  await loseReply(rebound, 'redeem');
  await rebound.getByText('换手机绑定', { exact: true }).click();
  await rebound.getByLabel('房主提供的绑定码').fill(bindingCode);
  await rebound
    .getByRole('button', { name: '绑定原座位', exact: true })
    .click();
  await rebound
    .getByRole('dialog', { name: '换手机绑定', exact: true })
    .getByText(/尚未收到入座确认/)
    .waitFor();
  assert.equal((await view(origin)).seats.length, 2);
  beforeRestart = await view(origin, secondToken);
  await capture(desktop, rebound, 'binding-lost-reply');
  socket.disconnect();
  socket = null;
  await desktop.close();
  desktop = null;
  desktop = await _electron.launch({
    executablePath,
    args,
    env,
    timeout: 30000,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  await host.getByText('本地连接已就绪', { exact: true }).waitFor();
  const newHostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  socket = await connect(origin, newHostToken);
  const restored = await openPhone(desktop, lanOrigin, 2);
  try {
    await restored
      .getByText('已恢复原座位', { exact: true })
      .waitFor({ timeout: 12000 });
  } catch (error) {
    await capture(desktop, restored, 'recovery-failure');
    console.log(
      await restored.evaluate(() => ({
        feedback: document.querySelector('.feedback')?.textContent,
        pending: Boolean(localStorage.getItem('tablemax-admission')),
        identity: Boolean(localStorage.getItem('tablemax-player')),
        visibility: document.visibilityState,
        path: location.pathname,
      })),
    );
    throw error;
  }
  const recoveredToken = await restored.evaluate(() =>
    localStorage.getItem('tablemax-player'),
  );
  const recovered = await view(origin, recoveredToken);
  assert.equal(recovered.self.seatId, seatId);
  assert.equal(recovered.paused, true);
  assert.deepEqual(recovered.gameView.boards, beforeRestart.gameView.boards);
  assert.equal(
    (
      await (
        await fetch(`${origin}/api/session/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: oldToken }),
        })
      ).json()
    ).ok,
    false,
  );
  evidence.checks.push(
    'Lost binding reply recovered from encrypted SQLite receipt after real application restart; old credential revoked and game restored paused',
  );
  await command(origin, socket, newHostToken, { type: 'resume' });
  const offline = await restored.context().newCDPSession(restored);
  await offline.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await offline.send('Page.setWebLifecycleState', { state: 'frozen' });
  await wait(500);
  await offline.send('Page.setWebLifecycleState', { state: 'active' });
  await offline.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await restored.evaluate(() => window.dispatchEvent(new Event('online')));
  await restored.getByText('本地连接已就绪', { exact: true }).waitFor();
  assert.equal((await view(origin, recoveredToken)).self.seatId, seatId);
  const oldInstance = (await view(origin, recoveredToken)).instanceId;
  await command(origin, socket, newHostToken, { type: 'end' });
  await host.goto(`${origin}/host/game`);
  await host.getByRole('button', { name: '再玩一局', exact: true }).click();
  await host.waitForURL('**/host');
  await restored.waitForURL('**/player');
  await restored
    .getByRole('button', { name: '我准备好了', exact: true })
    .waitFor();
  const replay = await view(origin, recoveredToken);
  assert.notEqual(replay.instanceId, oldInstance);
  assert.equal(replay.seats.length, 2);
  assert.equal(replay.self.seatId, seatId);
  assert.equal(
    replay.seats.every((s) => !s.ready),
    true,
  );
  assert.equal(replay.gameView, null);
  assert.equal(replay.status, 'lobby');
  const otherPhone = await openPhone(desktop, lanOrigin, 1);
  await restored
    .getByRole('button', { name: '我准备好了', exact: true })
    .click();
  await otherPhone
    .getByRole('button', { name: '我准备好了', exact: true })
    .click();
  await host.getByRole('button', { name: '开始游戏', exact: true }).click();
  await restored.waitForURL('**/player/game');
  assert.equal((await view(origin, recoveredToken)).gameView.roundNumber, 1);
  await capture(desktop, restored, 'same-friends-second-match');
  evidence.checks.push(
    'Freeze/offline/resume reuses identity; original friends return to lobby, re-ready and start a second match without joining again',
  );
  const expired = await openPhone(desktop, lanOrigin, 4);
  let expiredRequests = 0;
  await expired.route('**/api/session/join', async (route) => {
    expiredRequests++;
    await route.abort();
  });
  await expired.evaluate(() =>
    localStorage.setItem(
      'tablemax-admission',
      JSON.stringify({
        kind: 'join',
        requestKey: 'a'.repeat(64),
        value: '过期请求',
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
      }),
    ),
  );
  await expired.reload();
  await expired
    .getByText('入座确认已超过一天，请联系房主检查原座位后换绑。', {
      exact: true,
    })
    .waitFor();
  assert.equal(expiredRequests, 0);
  assert.equal((await view(origin)).seats.length, 2);
  await expired.close();
  evidence.checks.push(
    'Expired pending admission is stopped locally without resending or occupying another seat',
  );
  const duplicate = await promisify(execFile)(executablePath, args, {
    env,
    windowsHide: true,
    timeout: 10000,
  });
  assert.ok(!duplicate.stderr.includes('EADDRINUSE'));
  assert.equal(
    (await view(origin, recoveredToken)).instanceId,
    replay.instanceId,
  );
  evidence.checks.push(
    'Second actual desktop process exits cleanly and leaves the existing service/save intact',
  );
  await host.getByRole('button', { name: '菜单', exact: true }).click();
  const publicReady = desktop.waitForEvent('window');
  await host
    .getByRole('link', { name: '打开公共屏', exact: true })
    .click({ noWaitAfter: true });
  const publicPage = await publicReady;
  await publicPage.getByText('本地连接已就绪', { exact: true }).waitFor();
  const hostWindow = await desktop.browserWindow(host);
  await hostWindow.evaluate((w) => w.close());
  const newHostReady = desktop.waitForEvent('window');
  await desktop.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()
      .items.find((i) => i.label === '程序')
      .submenu.items.find((i) => i.label === '打开房主管理')
      .click(),
  );
  const reopened = await newHostReady;
  await reopened.getByText('本地连接已就绪', { exact: true }).waitFor();
  assert.equal((await view(origin, recoveredToken)).status, 'playing');
  for (const page of desktop.windows())
    assert.equal(
      await (await desktop.browserWindow(page)).evaluate((w) => w.isVisible()),
      false,
    );
  evidence.checks.push(
    'Closing host while public screen remains preserves play; native menu reopens authorized management without showing test windows',
  );
} finally {
  socket?.disconnect();
  if (desktop) await desktop.close();
}
const occupied = createServer();
await new Promise((done) => occupied.listen(0, '0.0.0.0', done));
try {
  const failureDir = await mkdtemp(resolve('tmp/party-startup-'));
  const port = occupied.address().port;
  await assert.rejects(
    promisify(execFile)(executablePath, args, {
      env: {
        ...env,
        TABLEMAX_DATA_DIR: failureDir,
        TABLEMAX_PORT: String(port),
      },
      windowsHide: true,
      timeout: 30000,
    }),
  );
  const log = await readFile(join(failureDir, 'logs/desktop.log'), 'utf8');
  assert.ok(log.includes(`端口 ${port} 已被其他程序占用`));
  assert.ok(log.includes('EADDRINUSE'));
  evidence.checks.push(
    'Actual occupied-port startup preserves the service cause in Chinese diagnostics and desktop log',
  );
} finally {
  await new Promise((done) => occupied.close(done));
}
assert.deepEqual(evidence.pageErrors, []);
await writeFile(
  join(output, 'results.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    { result: 'passed', output, checks: evidence.checks },
    null,
    2,
  ),
);
