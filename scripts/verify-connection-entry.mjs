import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from './lib/package-limits.mjs';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { launchDesktop } from './desktop-test.mjs';
import { launchTestBrowser } from './browser-test.mjs';
import { playerFrame, playerUi } from './player-test.mjs';

// Real portable WebView2 event handling plus a real browser popup admission.
// The explicit native capture seam avoids opening user-visible OS browser tabs.
const argument = (name) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const expectedHash = argument('sha256');
assert.match(expectedHash ?? '', /^[a-f0-9]{64}$/);
const evidence = argument('evidence') ?? `run-${Date.now()}`;
assert.match(evidence, /^[A-Za-z0-9_-]+$/);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const output = resolve(
  `artifacts/maintenance/v${version}/network-adaptation/connection`,
  evidence,
);
const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const execute = promisify(execFile);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const QRCode = createRequire(resolve('apps/server/package.json'))('qrcode');
const report = {
  status: 'running',
  portable: true,
  version,
  archiveSha256: expectedHash,
  startedAt: new Date().toISOString(),
  scope:
    'Same frozen ZIP and all members; hidden muted WinForms/WebView2 approved launch targets, real headless Edge target=_blank popup and player admission. Native OS browser launch is captured only after actual NewWindowRequested authorization. Does not certify default OS browser association, public tunnels or physical devices.',
  checks: [],
  screenshots: [],
  pageErrors: [],
  externalRequests: [],
};
let desktop, browser, socket, hostToken, origin, work;
const secrets = new Set();
const save = () =>
  writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(predicate, message) {
  for (const end = Date.now() + 20000; Date.now() < end;) {
    if (await predicate()) return;
    await wait(50);
  }
  throw new Error(message);
}
async function checked(message) {
  report.checks.push(message);
  console.log(message);
  await save();
}
async function view(token = hostToken) {
  const result = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  ).json();
  assert.equal(result.ok, true);
  return result.view;
}
async function command(command) {
  const before = await view();
  const reply = await socket.timeout(5000).emitWithAck('room:command', {
    actionId: randomUUID(),
    instanceId: before.instanceId,
    branch: before.branch,
    revision: before.revision,
    command,
  });
  assert.equal(reply.ok, true, reply.reason);
  return view();
}
async function snapshot(page) {
  const id = await page.evaluate(() => window.__tablemaxWindowId);
  return (await desktop.request('windows')).find((item) => item.id === id);
}
async function capture(page, name) {
  const path = join(output, name + '.png');
  await page.screenshot({ path });
  report.screenshots.push({
    file: name + '.png',
    sha256: hash(await readFile(path)),
  });
}
async function nativeEntry(page, url, keyboard = false) {
  const link = page.locator('a[data-tablemax-join-link]');
  await until(
    async () => (await link.getAttribute('href')) === url,
    'Website entry did not update',
  );
  const before = await snapshot(page),
    state = await view(),
    original = page.url();
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
  const qr = await fetch(
    origin + (await page.locator('.invite-friends .qr').getAttribute('src')),
  );
  assert.equal(qr.status, 200);
  assert.equal(
    await qr.text(),
    await QRCode.toString(url, { type: 'svg', margin: 2 }),
    'Rendered QR and website link must encode exactly the same root URL',
  );
  const dimensions = await link.boundingBox();
  assert.ok(dimensions.height >= 48 && dimensions.width >= 120);
  if (keyboard) {
    await link.focus();
    await page.keyboard.press('Enter');
  } else await link.click();
  await until(async () => {
    const after = await snapshot(page);
    return (
      after.externalJoin.count === before.externalJoin.count + 1 &&
      after.externalJoin.url === new URL(url).href
    );
  }, 'Native did not approve the exact trusted current root entry');
  assert.equal(page.url(), original);
  assert.equal((await view()).revision, state.revision);
}
async function setExternal(host, url) {
  await host.getByRole('button', { name: '连接帮助', exact: true }).click();
  const panel = host.getByRole('dialog', { name: '连接帮助', exact: true });
  await panel.getByLabel('外部入口网址', { exact: true }).fill(url);
  await panel
    .getByRole('button', { name: '保存外部入口', exact: true })
    .click();
  await panel.getByText('二维码已更新。', { exact: true }).waitFor();
  await panel.getByRole('button', { name: '关闭面板', exact: true }).click();
}
await mkdir(output, { recursive: true });
try {
  const zip = await readFile(archive),
    manifest = JSON.parse(
      await readFile(archive.replace(/\.zip$/, '-manifest.json'), 'utf8'),
    );
  assert.equal(hash(zip), expectedHash);
  assert.equal(manifest.archive.sha256, expectedHash);
  assert.ok(
    zip.length < MAXIMUM_PACKAGE_BYTES &&
      manifest.extractedBytes <= PACKAGE_BUDGET_BYTES,
  );
  await mkdir('tmp', { recursive: true });
  work = await mkdtemp(resolve('tmp/connection-entry-'));
  report.work = work;
  const portable = join(work, 'extracted');
  await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:CONNECTION_ARCHIVE -DestinationPath $env:CONNECTION_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        CONNECTION_ARCHIVE: archive,
        CONNECTION_EXTRACT: portable,
      },
    },
  );
  const actual = new Set(),
    expected = new Set();
  let bytes = 0;
  for (const file of manifest.files) {
    const path = resolve(portable, file.path);
    assert.ok(path.startsWith(portable + sep));
    const value = await readFile(path);
    assert.equal(value.length, file.bytes);
    assert.equal(hash(value), file.sha256);
    bytes += value.length;
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
  assert.equal(bytes, manifest.extractedBytes);
  await checked(
    'Frozen ZIP, complete member inventory and actual byte gates passed',
  );
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
  const host = await desktop.firstWindow();
  await host.locator('[data-room-revision]').waitFor();
  origin = new URL(host.url()).origin;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken);
  secrets.add(hostToken);
  socket = io(origin, {
    auth: { token: hostToken },
    transports: ['polling', 'websocket'],
    forceNew: true,
  });
  await new Promise((done, reject) => {
    socket.once('connect', done);
    socket.once('connect_error', reject);
  });
  await command({ type: 'select-game', gameId: 'pokemon-encounters' });
  const oldLanUrl = await host
    .locator('a[data-tablemax-join-link]')
    .getAttribute('href');
  assert.ok(oldLanUrl);
  await setExternal(host, origin + '/player');
  await nativeEntry(host, origin);
  const publicEvent = desktop.waitForEvent('window');
  await desktop.request('open-public');
  const publicPage = await publicEvent;
  await publicPage.locator('[data-room-revision]').waitFor();
  await nativeEntry(publicPage, origin, true);
  await capture(host, 'host-current-entry');
  await capture(publicPage, 'public-current-entry');
  await checked(
    'Host mouse activation and public keyboard activation approved exact saved root URL without navigation or revision changes',
  );
  const beforeRejected = (await snapshot(host)).externalJoin.count;
  await host.evaluate((url) => window.open(url, '_blank'), origin);
  await host.evaluate((url) => {
    const link = document.createElement('a');
    link.id = 'unapproved-entry';
    link.href = url;
    link.target = '_blank';
    link.textContent = 'Unapproved root link';
    document.body.prepend(link);
  }, origin);
  await host.locator('#unapproved-entry').click();
  await wait(200);
  assert.equal((await snapshot(host)).externalJoin.count, beforeRejected);
  await host
    .locator('#unapproved-entry')
    .evaluate((element) => element.remove());
  await host.evaluate((url) => {
    const frame = document.createElement('iframe');
    frame.id = 'unapproved-player-frame';
    frame.src = url + '/?embed=1';
    frame.style.cssText =
      'position:fixed;inset:0;width:350px;height:250px;z-index:9999';
    document.body.append(frame);
  }, origin);
  const embedded = host.frameLocator('#unapproved-player-frame');
  await embedded.locator('.box-screen').waitFor();
  await embedded.locator('body').evaluate((element, url) => {
    const link = document.createElement('a');
    link.id = 'frame-entry';
    link.href = url;
    link.target = '_blank';
    link.textContent = 'Player frame entry';
    element.prepend(link);
  }, origin);
  await embedded.locator('#frame-entry').click();
  await wait(200);
  assert.equal((await snapshot(host)).externalJoin.count, beforeRejected);
  await host
    .locator('#unapproved-player-frame')
    .evaluate((element) => element.remove());
  await checked(
    'Script popup, unapproved top-page root link and trusted player-frame link remained blocked',
  );
  browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
    soundEnabled: false,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    report.externalRequests.push(url.origin);
    return route.abort();
  });
  const publicBrowser = await context.newPage();
  publicBrowser.on('pageerror', (error) =>
    report.pageErrors.push(error.message),
  );
  await publicBrowser.goto(origin + '/public');
  const popupEvent = publicBrowser.waitForEvent('popup');
  await publicBrowser
    .getByRole('link', { name: '使用网址，在浏览器中加入牌桌', exact: true })
    .click();
  const player = await popupEvent;
  player.on('pageerror', (error) => report.pageErrors.push(error.message));
  await playerUi(player).locator('.box-screen').waitFor();
  assert.equal(new URL(player.url()).pathname, '/');
  assert.equal(new URL(player.url()).hash, '');
  assert.equal(await player.evaluate(() => window.opener === null), true);
  const frame = await playerFrame(player);
  assert.equal(
    await frame.evaluate(() => sessionStorage.getItem('tablemax-host')),
    null,
  );
  assert.equal(
    await frame.evaluate(() => typeof window.tablemaxDisplay),
    'undefined',
  );
  await playerUi(player)
    .getByLabel('你的昵称', { exact: true })
    .fill('直接打开网页的玩家');
  await playerUi(player)
    .getByRole('button', { name: '加入', exact: true })
    .click();
  await playerUi(player)
    .getByRole('button', { name: '我准备好了', exact: true })
    .waitFor();
  const playerToken = await frame.evaluate(() =>
    localStorage.getItem('tablemax-player'),
  );
  assert.ok(playerToken);
  secrets.add(playerToken);
  const playerView = await view(playerToken);
  assert.equal(playerView.self.role, 'player');
  assert.equal(playerView.capabilities.manageSeats, false);
  await playerUi(player)
    .getByRole('button', { name: '我准备好了', exact: true })
    .click();
  await playerUi(player)
    .getByRole('button', { name: '取消准备', exact: true })
    .waitFor();
  const latest = await view(playerToken);
  assert.ok(latest.revision > playerView.revision);
  assert.equal(
    latest.seats.find((seat) => seat.id === latest.self.seatId).ready,
    true,
  );
  await playerUi(player)
    .locator(`[data-room-revision="${latest.revision}"]`)
    .waitFor();
  await capture(player, 'actual-browser-popup-player');
  await checked(
    'Real browser popup opened player root with noopener; no host token/native bridge; real join and ready action rendered latest revision',
  );
  const external =
    'https://network-multidevice-entry.long-player-connection.complete-lobby.example.test:33684';
  await setExternal(host, external + '/player');
  await nativeEntry(host, external);
  await nativeEntry(publicPage, external);
  await until(
    async () =>
      (await publicBrowser
        .locator('a[data-tablemax-join-link]')
        .getAttribute('href')) === external,
    'Browser link lagged QR entry',
  );
  for (const width of [320, 390, 1280]) {
    await publicBrowser.setViewportSize({
      width,
      height: width < 500 ? 640 : 720,
    });
    await publicBrowser
      .getByRole('button', { name: '连接帮助', exact: true })
      .click();
    const panel = publicBrowser.getByRole('dialog', {
      name: '连接帮助',
      exact: true,
    });
    await panel.getByText('手机扫码', { exact: true }).waitFor();
    await panel.getByText('直接打开', { exact: true }).waitFor();
    assert.equal(
      await panel.getByLabel('外部入口网址', { exact: true }).count(),
      0,
    );
    await panel.locator('.connection-help__url').scrollIntoViewIfNeeded();
    assert.ok(
      await panel.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 2,
      ),
    );
    assert.ok(
      await publicBrowser.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
    );
    await capture(publicBrowser, `public-help-long-url-${width}`);
    await panel.getByRole('button', { name: '关闭面板', exact: true }).click();
  }
  await checked(
    'HTTPS nonstandard-port normalized entry synchronized host/public/browser; long URL and dual instructions remained readable at 320/390/1280px',
  );
  await host.getByRole('button', { name: '连接帮助', exact: true }).click();
  await host.getByRole('button', { name: '使用局域网', exact: true }).click();
  await host.getByText('已切回局域网二维码。', { exact: true }).waitFor();
  await host.getByRole('button', { name: '关闭面板', exact: true }).click();
  await nativeEntry(host, oldLanUrl);
  await checked(
    'Clearing external entry restored exact selected LAN QR and direct website URL',
  );
  const secondContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const secondPlayer = await secondContext.newPage();
  await secondPlayer.goto(origin);
  await playerUi(secondPlayer)
    .getByLabel('你的昵称', { exact: true })
    .fill('游戏返回连接验证');
  await playerUi(secondPlayer)
    .getByRole('button', { name: '加入', exact: true })
    .click();
  await playerUi(secondPlayer)
    .getByRole('button', { name: '我准备好了', exact: true })
    .click();
  await playerUi(secondPlayer)
    .getByRole('button', { name: '取消准备', exact: true })
    .waitFor();
  await command({ type: 'start' });
  for (const page of [host, publicPage]) {
    await page.locator('.pokemon-screen').waitFor();
    await page.reload();
    await page.locator('.pokemon-screen').waitFor();
    await page.locator('.back-to-box').click();
    await page.locator('.invite-friends').waitFor();
    await page
      .getByRole('heading', { name: '对局进行中', exact: true })
      .waitFor();
    await nativeEntry(page, oldLanUrl);
  }
  await capture(host, 'host-game-refresh-return-entry');
  await checked(
    'After real two-human game start, game-page reload and return-to-box navigation preserved authorized host/public website entry',
  );
  assert.deepEqual(report.externalRequests, []);
  assert.deepEqual(report.pageErrors, []);
  assert.equal(hash(await readFile(archive)), expectedHash);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = String(error.stack ?? error);
  for (const secret of secrets)
    report.error = report.error.replaceAll(secret, '[redacted]');
  console.error(report.error);
  process.exitCode = 1;
} finally {
  socket?.disconnect();
  await browser?.close().catch(() => {});
  await desktop?.close().catch((error) => {
    report.status = 'failed';
    report.shutdownError = error.message;
    process.exitCode = 1;
  });
  report.finishedAt = new Date().toISOString();
  await save();
  console.log(
    `Connection entry: ${report.status}; ${report.checks.length} checks; ${output}`,
  );
}
