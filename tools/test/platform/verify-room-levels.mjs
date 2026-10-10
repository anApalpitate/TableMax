import { saveVerificationScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { launchDesktop, desktopExecutable } from '../support/desktop-test.mjs';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { verificationOutput } from '../support/verification-output.mjs';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const output = verificationOutput(portable ? 'room-portable' : 'room');
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/room-levels-'));
const dataDir = join(work, 'data');
await build({
  entryPoints: ['games/pokemon-encounters/bot/index.ts'],
  outfile: join(work, 'driver.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const { bot } = require(join(work, 'driver.cjs'));
let executablePath = desktopExecutable;
let archiveSha256;
if (portable) {
  const project = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = resolve(
    `artifacts/releases/TableMax-${project.version}-win-x64.zip`,
  );
  const extracted = await mkdtemp(resolve('tmp/room-levels-portable-'));
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_LEVELS_ARCHIVE -DestinationPath $env:TABLEMAX_LEVELS_EXTRACT',
    ],
    {
      env: {
        ...process.env,
        TABLEMAX_LEVELS_ARCHIVE: archive,
        TABLEMAX_LEVELS_EXTRACT: extracted,
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
  TABLEMAX_DATA_DIR: dataDir,
  TABLEMAX_HOST: '0.0.0.0',
  TABLEMAX_PORT: '0',
};
delete env.TABLEMAX_WEB_DEV_URL;
delete env.NODE_PATH;
if (portable)
  env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
const args = ['--foundation-test', '--tablemax-test-mode'];
const evidence = {
  verifiedAt: new Date().toISOString(),
  scope:
    'Actual hidden Windows WebView2 and local service; independent Chromium phone partitions using the invite URL, touch/viewport simulation and real strategy Workers. No physical phone, Wi-Fi, Safari, or globally optimal strategy claim.',
  portable,
  archiveSha256,
  dataDir,
  checks: [],
  screenshots: [],
  layouts: [],
  pageErrors: [],
  externalRequests: [],
  rounds: [],
};
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
let desktop, origin, phoneUrl;
const clients = [];
const tokens = [];

async function view(token) {
  const result = await (
    await fetch(`${origin}/api/session/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.view;
}
async function connect(token) {
  const socket = io(origin, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  clients.push(socket);
  return socket;
}
async function command(socket, token, value, rejected = false) {
  const room = await view(token);
  const reply = await new Promise((done, reject) =>
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: room.instanceId,
        revision: room.revision,
        branch: room.branch,
        command: value,
      },
      (error, result) => (error ? reject(error) : done(result)),
    ),
  );
  if (rejected) {
    assert.equal(
      reply.ok,
      false,
      'Unauthorized or non-lobby difficulty change must fail',
    );
    return reply;
  }
  if (!reply.ok && reply.reason === 'stale-revision') return false;
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return true;
}
function observe(page) {
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith('http')) return;
    if (![origin, new URL(phoneUrl).origin].includes(new URL(url).origin))
      evidence.externalRequests.push(url);
  });
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
async function openPhone(index) {
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
          partition: `persist:room-levels-phone-${input.index}`,
        },
      });
      void window.loadURL(input.url);
    },
    { url: phoneUrl, index },
  );
  const page = await ready;
  observe(page);
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
  await settle(page);
  return page;
}
async function capture(page, name, width, height, mobile = false) {
  const window = await desktop.browserWindow(page);
  assert.equal(
    await window.evaluate((w) => w.isVisible()),
    false,
    'Verification never shows a native window',
  );
  if (width) {
    await window.evaluate(
      (w, size) => w.setContentSize(size.width, size.height),
      { width, height },
    );
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    await page.waitForFunction(
      (size) => innerWidth === size.width && innerHeight === size.height,
      { width, height },
    );
  }
  await page.evaluate(() => {
    document.activeElement?.blur();
    scrollTo(0, 0);
  });
  await settle(page);
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
  await saveVerificationScreenshot(
    join(output, `${name}.png`),
    Buffer.from(png, 'base64'),
  );
  evidence.screenshots.push(`${name}.png`);
}
async function tableGeometry(page, label) {
  const geometry = await page.evaluate(() => {
    const table = document.querySelector('.room-table');
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
    return {
      viewport: { width: innerWidth, height: innerHeight },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      table: table ? rect(table) : null,
      felt: document.querySelector('.room-table__felt')
        ? rect(document.querySelector('.room-table__felt'))
        : null,
      seats: [...document.querySelectorAll('.room-table__seat')].map(
        (seat) => ({
          position: seat.dataset.position,
          id: seat.dataset.seatId ?? null,
          self: seat.dataset.self ?? null,
          name: seat.querySelector('.room-table__name')?.textContent ?? null,
          rect: rect(seat),
          nameRect: seat.querySelector('.room-table__name')
            ? rect(seat.querySelector('.room-table__name'))
            : null,
          readyRect: seat.querySelector('.room-table__ready')
            ? rect(seat.querySelector('.room-table__ready'))
            : null,
        }),
      ),
      obscuredControls: [
        ...document.querySelectorAll(
          'button:not(:disabled), select, input, summary',
        ),
      ]
        .filter((element) => {
          if (
            [...document.querySelectorAll('details:not([open])')].some(
              (details) =>
                details.contains(element) &&
                !details.querySelector(':scope > summary')?.contains(element),
            )
          )
            return false;
          const r = element.getBoundingClientRect();
          const x = r.left + r.width / 2,
            y = r.top + r.height / 2;
          if (
            !r.width ||
            !r.height ||
            x < 0 ||
            x >= innerWidth ||
            y < 0 ||
            y >= innerHeight
          )
            return false;
          if (getComputedStyle(element).visibility === 'hidden') return false;
          const top = document.elementFromPoint(x, y);
          return !top || !(element === top || element.contains(top));
        })
        .map(
          (element) =>
            element.textContent.trim() ||
            element.getAttribute('aria-label') ||
            element.id,
        ),
    };
  });
  evidence.layouts.push({ label, ...geometry });
  assert.ok(geometry.table, `${label}: actual table is rendered`);
  assert.ok(
    geometry.felt?.width > 100 && geometry.felt?.height > 100,
    `${label}: a visible tabletop is surrounded by the seats`,
  );
  assert.equal(geometry.seats.length, 6, `${label}: six physical places`);
  assert.deepEqual(
    geometry.seats.map((seat) => seat.position).sort(),
    ['1', '2', '3', '4', '5', '6'],
    `${label}: every table position exists exactly once`,
  );
  assert.equal(
    geometry.horizontalOverflow,
    false,
    `${label}: no horizontal page clipping`,
  );
  assert.deepEqual(
    geometry.obscuredControls,
    [],
    `${label}: actionable visible controls are not covered`,
  );
  for (const seat of geometry.seats) {
    assert.ok(
      seat.rect.width > 40 && seat.rect.height > 40,
      `${label}: usable seat size`,
    );
    assert.ok(
      seat.rect.left >= geometry.table.left - 1 &&
        seat.rect.right <= geometry.table.right + 1,
      `${label}: seats fit inside the table horizontally`,
    );
    assert.ok(
      seat.rect.top >= geometry.table.top - 1 &&
        seat.rect.bottom <= geometry.table.bottom + 1,
      `${label}: seats fit inside the table vertically`,
    );
    if (!label.startsWith('phone'))
      assert.ok(
        seat.rect.top >= 0 && seat.rect.bottom <= geometry.viewport.height,
        `${label}: all six seats and their ready status fit the first screen`,
      );
    for (const inner of [seat.nameRect, seat.readyRect])
      if (inner)
        assert.ok(
          inner.left >= seat.rect.left - 1 &&
            inner.right <= seat.rect.right + 1 &&
            inner.top >= seat.rect.top - 1 &&
            inner.bottom <= seat.rect.bottom + 1,
          `${label}: nickname and ready status stay inside their own seat`,
        );
  }
  for (let i = 0; i < geometry.seats.length; i++)
    for (let j = i + 1; j < geometry.seats.length; j++) {
      const a = geometry.seats[i].rect,
        b = geometry.seats[j].rect;
      assert.ok(
        Math.min(a.right, b.right) - Math.max(a.left, b.left) <= 1 ||
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 1,
        `${label}: seats ${i + 1}/${j + 1} do not overlap`,
      );
    }
}
async function firstScreenControls(page, selectors, label) {
  const controls = await page.evaluate(
    (selectors) =>
      selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return { selector, present: false };
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return {
          selector,
          present: true,
          withinViewport:
            rect.top >= 0 &&
            rect.bottom <= innerHeight &&
            rect.left >= 0 &&
            rect.right <= innerWidth,
          unobscured: Boolean(
            top && (element === top || element.contains(top)),
          ),
          size: { width: rect.width, height: rect.height },
        };
      }),
    selectors,
  );
  for (const control of controls) {
    assert.equal(control.present, true, `${label}: ${control.selector} exists`);
    assert.equal(
      control.withinViewport,
      true,
      `${label}: ${control.selector} fits the first screen without scrolling`,
    );
    assert.equal(
      control.unobscured,
      true,
      `${label}: ${control.selector} receives touch input`,
    );
    assert.ok(
      control.size.height >= 44,
      `${label}: touch target is at least 44 CSS px high`,
    );
  }
}
async function until(check, message, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await wait(75);
  }
  throw new Error(message);
}
async function driver(player) {
  return bot.decide({
    view: player.gameView,
    actions: player.actions,
    decision: { id: player.decisionId, seatId: player.self.seatId },
    difficulty: 'default',
    memory: null,
    random: {
      next() {
        throw new Error('Default phone driver does not use RNG');
      },
    },
    signal: new AbortController().signal,
  });
}
async function shutdown() {
  for (const socket of clients.splice(0)) socket.disconnect();
  if (desktop) {
    await desktop.close();
    desktop = undefined;
  }
  if (origin)
    await until(
      async () => {
        try {
          await fetch(`${origin}/api/foundation/health`, {
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
    args,
    env,
    timeout: 30000,
  });
  const host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  await settle(host);
  origin = new URL(host.url()).origin;
  env.TABLEMAX_PORT = new URL(origin).port;
  const network = await (await fetch(`${origin}/api/room/network`)).json();
  const adapter = network.adapters.find((a) => a.kind === 'lan');
  assert.ok(
    adapter,
    'Invite verification requires an actual LAN adapter address',
  );
  await host.getByRole('button', { name: '连接帮助', exact: true }).click();
  await host.getByLabel('电脑地址').selectOption(adapter.address);
  phoneUrl = `http://${new URL(await host.locator('.qr').getAttribute('src'), origin).searchParams.get('address')}:${new URL(origin).port}/player`;
  assert.equal(new URL(phoneUrl).hostname, adapter.address);
  assert.equal(new URL(phoneUrl).pathname, '/player');
  assert.equal(
    (await fetch(`${new URL(phoneUrl).origin}/api/foundation/health`)).status,
    200,
  );
  await host.keyboard.press('Escape');
  observe(host);
  const health = await (await fetch(`${origin}/api/foundation/health`)).json();
  assert.equal(health.protocolVersion, 8);
  assert.equal(await desktop.evaluate(({ app }) => app.isPackaged), portable);
  const hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  const hostSocket = await connect(hostToken);
  assert.equal((await view(hostToken)).game, null);
  await command(hostSocket, hostToken, {
    type: 'select-game',
    gameId: 'pokemon-encounters',
  });
  assert.equal((await view(hostToken)).playMode, 'test');
  assert.deepEqual((await view(hostToken)).self, {
    role: 'host',
    seatId: null,
  });
  assert.deepEqual((await view(hostToken)).actions, []);
  assert.equal((await view(hostToken)).seats.length, 0);
  assert.equal(await host.getByLabel('你的昵称').count(), 0);
  await capture(host, 'empty-host-table', 1080, 800);
  assert.equal(await host.locator('.room-table__seat--empty').count(), 6);
  evidence.checks.push(
    'Computer host is administrator only, occupies no seat, offers no join form, and displays six empty physical table places',
  );

  const phones = [await openPhone(0), await openPhone(1), await openPhone(2)];
  for (let i = 0; i < phones.length; i++) {
    const page = phones[i];
    await page
      .getByLabel('你的昵称')
      .fill(
        i === 1
          ? '手机乙昵称超过一行也要保留清晰座位与准备状态'
          : i === 2
            ? '手机丙'
            : '手机甲',
      );
    if (i === 0) {
      await capture(page, 'phone-first-screen-join-360', 360, 640, true);
      await firstScreenControls(
        page,
        ['#nickname', '.join-table__row button'],
        'phone 360x640 join',
      );
    }
    await page.getByRole('button', { name: '加入', exact: true }).click();
    await page
      .getByRole('button', { name: '我准备好了', exact: true })
      .waitFor();
    if (i === 0) {
      await capture(page, 'phone-first-screen-ready-360', 360, 640, true);
      await firstScreenControls(
        page,
        ['.player-actions button'],
        'phone 360x640 ready',
      );
    }
    const token = await page.evaluate(() =>
      localStorage.getItem('tablemax-player'),
    );
    tokens.push(token);
    const player = await view(token);
    assert.equal(player.self.role, 'player');
    assert.equal(
      player.seats.find((s) => s.id === player.self.seatId).botDifficulty,
      null,
    );
    await page.locator('.room-table__seat--self').waitFor();
    assert.equal(
      await page
        .locator('.room-table__seat--self')
        .getAttribute('data-seat-id'),
      player.self.seatId,
    );
    assert.equal(await page.locator('.seat-manager').count(), 0);
    assert.equal(
      await page.getByRole('button', { name: '添加人机', exact: true }).count(),
      0,
    );
  }
  assert.notEqual(tokens[0], tokens[1]);
  assert.equal((await view(hostToken)).seats.length, 3);
  evidence.checks.push(
    'Three independent phone browser partitions follow the selected invite URL, join separate human seats, and each sees its own seat highlighted with no administrator controls; nickname, join and ready controls fit the first 360x640 screen with uncovered 44px touch targets',
  );

  for (const difficulty of ['default', 'doubao', 'juewu']) {
    await host.getByLabel('人机等级', { exact: true }).selectOption(difficulty);
    await host.getByRole('button', { name: '添加人机', exact: true }).click();
    await until(
      async () =>
        (await view(hostToken)).seats.filter((s) => s.controller === 'bot')
          .length ===
        ['default', 'doubao', 'juewu'].indexOf(difficulty) + 1,
      `Added ${difficulty} bot is saved`,
    );
  }
  const full = await view(hostToken);
  assert.deepEqual(
    full.seats
      .filter((s) => s.controller === 'bot')
      .map((s) => s.botDifficulty),
    ['default', 'doubao', 'juewu'],
  );
  assert.equal(full.seats.length, 6);
  const bots = full.seats.filter((s) => s.controller === 'bot');
  await host.locator('.room-table__difficulty').nth(2).waitFor();
  assert.equal(await host.locator('.room-table__difficulty').count(), 3);
  for (const label of ['默认', '豆包', '绝悟'])
    assert.ok(
      (await host.locator('.room-table__difficulty').allTextContents()).some(
        (text) => text.includes(label),
      ),
      `Table seat displays ${label} difficulty`,
    );
  const managed = host.locator(
    `.seat-manager__row[data-seat-id="${bots[0].id}"]`,
  );
  await host.getByRole('button', { name: '座位设置', exact: true }).click();
  await managed.locator('select').selectOption('juewu');
  await until(
    async () =>
      (await view(hostToken)).seats.find((s) => s.id === bots[0].id)
        .botDifficulty === 'juewu',
    'Difficulty adjustment saved',
  );
  await managed.locator('select').selectOption('default');
  await until(
    async () =>
      (await view(hostToken)).seats.find((s) => s.id === bots[0].id)
        .botDifficulty === 'default',
    'Difficulty can return to default',
  );
  await host.keyboard.press('Escape');
  const humanSocket = await connect(tokens[0]);
  const publicSocket = await connect(undefined);
  await command(
    hostSocket,
    hostToken,
    {
      type: 'set-bot-difficulty',
      seatId: full.seats[0].id,
      difficulty: 'doubao',
    },
    true,
  );
  await command(
    humanSocket,
    tokens[0],
    { type: 'set-bot-difficulty', seatId: bots[0].id, difficulty: 'doubao' },
    true,
  );
  await command(
    publicSocket,
    undefined,
    { type: 'add-bot', name: 'Forbidden', difficulty: 'juewu' },
    true,
  );
  evidence.checks.push(
    'Host adds 默认/豆包/绝悟 using actual UI, adjusts a bot difficulty in the lobby, while human seats, players and public identities cannot change bot difficulty',
  );

  for (const [width, height] of [
    [1080, 800],
    [1366, 768],
    [1920, 1080],
  ]) {
    await capture(host, `host-table-${width}`, width, height);
    await tableGeometry(host, `host ${width}x${height}`);
    if (width === 1080 || width === 1366)
      await firstScreenControls(
        host,
        ['#bot-difficulty', '.bot-invite button', '.lobby-start button'],
        `host ${width}x${height} lobby controls`,
      );
  }
  for (const [width, height] of [
    [390, 844],
    [360, 640],
    [844, 390],
  ]) {
    await capture(
      phones[0],
      `phone-table-${width}x${height}`,
      width,
      height,
      true,
    );
    await tableGeometry(phones[0], `phone ${width}x${height}`);
  }
  await capture(phones[0], 'phone-table-ready', 390, 844, true);
  await host.getByRole('button', { name: '管理设置', exact: true }).click();
  const publicReady = desktop.waitForEvent('window');
  await host
    .getByRole('link', { name: '打开公共屏', exact: true })
    .click({ noWaitAfter: true });
  const publicPage = await publicReady;
  observe(publicPage);
  await settle(publicPage);
  await capture(publicPage, 'public-table-1920', 1920, 1080);
  await tableGeometry(publicPage, 'public 1920x1080');
  assert.equal(await publicPage.locator('.management').count(), 0);
  assert.equal(await publicPage.locator('.room-table__seat--self').count(), 0);
  assert.equal(
    await publicPage
      .getByRole('button', { name: '添加人机', exact: true })
      .count(),
    0,
  );
  assert.equal(await publicPage.getByLabel('你的昵称').count(), 0);
  // WebView2 cancels this original-window navigation when opening public
  // display. A fresh host navigation clears Playwright's pending load state.
  await host.goto(`${origin}/host`);
  await settle(host);
  for (const mobile of phones) {
    await mobile
      .getByRole('button', { name: '我准备好了', exact: true })
      .click();
    await mobile
      .getByRole('button', { name: '取消准备', exact: true })
      .waitFor();
  }
  await host.getByRole('button', { name: '开始游戏', exact: true }).click();
  await host.waitForURL('**/host/game');
  for (const phone of phones) await phone.waitForURL('**/player/game');
  if (new URL(publicPage.url()).pathname === '/public')
    await publicPage
      .getByRole('link', { name: '进入牌桌', exact: true })
      .click();
  await publicPage.waitForURL('**/public/game');
  await command(
    hostSocket,
    hostToken,
    { type: 'set-bot-difficulty', seatId: bots[0].id, difficulty: 'doubao' },
    true,
  );
  const publicView = await view();
  assert.deepEqual(publicView.self, { role: 'public', seatId: null });
  assert.deepEqual(publicView.actions, []);
  assert.deepEqual(publicView.history, []);
  assert.equal(publicView.gameView.peek, null);
  assert.equal(JSON.stringify(publicView.gameView).includes('#'), false);
  for (const page of [host, publicPage]) {
    assert.equal(await page.locator('.pokemon-player').count(), 0);
    assert.equal(await page.locator('.private-peek').count(), 0);
    assert.equal(await page.locator('.pokemon-board button').count(), 0);
    assert.equal(await page.getByText('游戏帮助', { exact: true }).count(), 0);
  }
  await until(
    async () => (await view(hostToken)).gameView.initialDone.length === 3,
    'All three real strategy Workers finish before phone selections',
  );
  for (const mobile of phones) {
    await mobile
      .locator('.pokemon-player > .pokemon-board button')
      .nth(0)
      .click();
    await mobile.locator('.confirm-action').click();
  }
  await until(
    async () => (await view(hostToken)).gameView.initialDone.length === 6,
    'All real Workers complete their initial flip',
  );
  await capture(host, 'host-public-information', 1366, 768);
  await capture(publicPage, 'public-readonly-game', 1920, 1080);
  await capture(phones[0], 'phone-own-game', 390, 844, true);
  evidence.checks.push(
    'Host and native public screen show all public boards without playable cards, legal game actions, private peeks or a player seat; real phone UI flips each own initial card; game-time difficulty changes reject',
  );

  const humans = [];
  for (let i = 0; i < tokens.length; i++)
    humans.push({
      token: tokens[i],
      socket: i ? await connect(tokens[i]) : humanSocket,
    });
  let driverActions = 0;
  const phases = new Set();
  const started = Date.now();
  let final;
  while (Date.now() - started < 180000) {
    const room = await view(hostToken);
    assert.equal(
      room.botError,
      null,
      'All three levels continue through actual Workers without an error',
    );
    assert.deepEqual(
      room.actions,
      [],
      'Administrator never receives a game action',
    );
    assert.equal(
      room.gameView.peek,
      null,
      'Administrator cannot see private card peeks',
    );
    phases.add(room.gameView.phase);
    if (room.gameView.roundResult) {
      final = room;
      break;
    }
    let acted = false;
    for (const human of humans) {
      const player = await view(human.token);
      if (!player.actions.length) continue;
      if (player.gameView.peek) {
        const publicState = await view();
        assert.equal(
          publicState.gameView.peek,
          null,
          'Public projection conceals the live phone peek',
        );
        assert.deepEqual(
          publicState.actions,
          [],
          'Public display never receives phone decisions',
        );
      }
      const choice = await driver(player);
      if (
        await command(human.socket, human.token, {
          type: 'game',
          decisionId: player.decisionId,
          action: choice.action,
        })
      ) {
        driverActions++;
        acted = true;
      }
    }
    if (!acted) await wait(75);
  }
  assert.ok(
    final?.gameView.roundResult,
    'Mixed-difficulty Workers and phone identities complete a natural small round',
  );
  for (const seat of bots)
    assert.ok(
      final.history.some((checkpoint) => checkpoint.seatId === seat.id),
      `${seat.botDifficulty} Worker saved a legal decision`,
    );
  assert.ok(final.gameView.roundResult.winners.length);
  assert.equal(final.seats.length, 6);
  evidence.rounds.push({
    roundNumber: final.gameView.roundNumber,
    driverActions,
    phases: [...phases],
    elapsedMs: Date.now() - started,
    winners: final.gameView.roundResult.winners,
    botSeats: bots.map(({ id, botDifficulty }) => ({ id, botDifficulty })),
  });
  await host.locator('.round-banner').waitFor();
  await capture(host, 'mixed-level-round-result', 1366, 768);
  await capture(phones[0], 'phone-round-result', 360, 640, true);
  evidence.checks.push(
    `Actual six-seat mixed-level Worker round completes naturally with ${driverActions} legal phone-driver choices, all three bot identities in saved history, public result and no bot error`,
  );
  await command(hostSocket, hostToken, { type: 'end' });
  await host.getByRole('button', { name: '菜单', exact: true }).click();
  await host
    .getByRole('button', { name: '原班人马再开一局', exact: true })
    .click();
  await host.waitForURL('**/host');
  for (const page of phones) await page.waitForURL('**/player');
  const replay = await view(hostToken);
  assert.notEqual(replay.instanceId, final.instanceId);
  assert.deepEqual(
    replay.seats.map(({ id, controller, botDifficulty }) => ({
      id,
      controller,
      botDifficulty,
    })),
    full.seats.map(({ id, controller, botDifficulty }) => ({
      id,
      controller,
      botDifficulty,
    })),
  );
  assert.ok(
    replay.seats.filter((s) => s.controller === 'human').every((s) => !s.ready),
  );
  assert.ok(
    replay.seats.filter((s) => s.controller === 'bot').every((s) => s.ready),
  );
  for (let i = 0; i < phones.length; i++)
    assert.equal(
      await phones[i].evaluate(() => localStorage.getItem('tablemax-player')),
      tokens[i],
    );
  await capture(host, 'same-friends-level-replay', 1366, 768);
  await shutdown();

  desktop = await launchDesktop({
    executablePath,
    args,
    env,
    timeout: 30000,
  });
  const restartedHost = await desktop.firstWindow();
  await restartedHost.waitForURL('**/host');
  observe(restartedHost);
  await settle(restartedHost);
  assert.equal(new URL(restartedHost.url()).origin, origin);
  const restartedToken = await restartedHost.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  const restored = await view(restartedToken);
  assert.deepEqual(
    restored.seats.map(({ id, controller, botDifficulty }) => ({
      id,
      controller,
      botDifficulty,
    })),
    replay.seats.map(({ id, controller, botDifficulty }) => ({
      id,
      controller,
      botDifficulty,
    })),
  );
  assert.deepEqual(restored.self, { role: 'host', seatId: null });
  for (let i = 0; i < 3; i++) {
    const phone = await openPhone(i);
    await phone
      .getByRole('button', { name: '我准备好了', exact: true })
      .waitFor();
    assert.equal(
      await phone.evaluate(() => localStorage.getItem('tablemax-player')),
      tokens[i],
    );
    assert.equal(
      await phone
        .locator('.room-table__seat--self')
        .getAttribute('data-seat-id'),
      restored.seats[i].id,
    );
  }
  await capture(restartedHost, 'restart-preserves-table-levels', 1080, 800);
  evidence.checks.push(
    'Original-friends replay and an actual desktop/service restart retain ordered phone seats, browser credentials and every bot difficulty; computer remains an administrator without a seat',
  );
  for (const page of desktop.windows())
    assert.equal(
      await (await desktop.browserWindow(page)).evaluate((w) => w.isVisible()),
      false,
    );
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  evidence.checks.push(
    'Seven actual table viewport layouts have six non-overlapping seats, no horizontal clipping or covered visible controls; all captured native windows remain hidden and all resources are local',
  );
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = error.stack;
  if (desktop)
    for (const [index, page] of desktop.windows().entries())
      await capture(page, `failure-${index}`).catch(() => undefined);
  throw error;
} finally {
  await shutdown();
  await writeFile(
    join(output, 'results.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}
console.log(
  JSON.stringify(
    {
      result: evidence.result,
      portable,
      output,
      checks: evidence.checks,
      rounds: evidence.rounds,
    },
    null,
    2,
  ),
);
