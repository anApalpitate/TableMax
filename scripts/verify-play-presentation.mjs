import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const output = resolve(
  'artifacts/maintenance/v1.6.0',
  portable ? 'presentation-portable' : 'presentation',
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/play-presentation-'));
await build({
  entryPoints: ['games/pokemon-encounters/bot/index.ts'],
  outfile: join(work, 'driver.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const { bot } = require(join(work, 'driver.cjs'));
let executablePath = require('electron'),
  archiveSha256;
if (portable) {
  const project = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = resolve(
    `artifacts/releases/TableMax-${project.version}-win-x64.zip`,
  );
  const extracted = await mkdtemp(resolve('tmp/play-presentation-portable-'));
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_PRESENTATION_ARCHIVE -DestinationPath $env:TABLEMAX_PRESENTATION_EXTRACT',
    ],
    {
      env: {
        ...process.env,
        TABLEMAX_PRESENTATION_ARCHIVE: archive,
        TABLEMAX_PRESENTATION_EXTRACT: extracted,
      },
      windowsHide: true,
    },
  );
  executablePath = join(extracted, 'TableMax.exe');
  archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
}
const args = [
  ...(portable ? [] : [resolve('build/desktop')]),
  '--foundation-test',
  '--tablemax-play-mode',
];
const evidence = {
  verifiedAt: new Date().toISOString(),
  scope:
    'Actual hidden Windows Electron/service with independent Chromium phone partitions; explicit production play path and real strategy Workers. No physical phone, Safari, Wi-Fi or listening claim.',
  portable,
  archiveSha256,
  checks: [],
  screenshots: [],
  errors: [],
  external: [],
  timing: {},
  modes: [],
  starSizes: [],
  focus: [],
  sixLayouts: [],
};
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
let desktop, origin, phoneUrl;
const clients = [];
async function until(check, message, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await wait(30);
  }
  throw new Error(message);
}
async function view(token) {
  const response = await (
    await fetch(`${origin}/api/session/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(response.ok, true);
  return response.view;
}
async function connect(token) {
  const socket = io(origin, {
    transports: ['websocket'],
    forceNew: true,
    auth: { token },
  });
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  clients.push(socket);
  return socket;
}
async function command(socket, token, value, reject = false) {
  for (let retry = 0; retry < 4; retry++) {
    const current = await view(token);
    const reply = await new Promise((done, fail) =>
      socket.timeout(5000).emit(
        'room:command',
        {
          actionId: randomUUID(),
          instanceId: current.instanceId,
          branch: current.branch,
          revision: current.revision,
          command: value,
        },
        (error, reply) => (error ? fail(error) : done(reply)),
      ),
    );
    if (!reply.ok && reply.reason === 'stale-revision') continue;
    assert.equal(reply.ok, !reject, JSON.stringify(reply));
    return reply;
  }
  throw new Error('Command could not obtain a current revision');
}
async function observe(page) {
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => evidence.errors.push(error.message));
  page.on('request', (request) => {
    if (
      request.url().startsWith('http') &&
      ![origin, new URL(phoneUrl).origin].includes(
        new URL(request.url()).origin,
      )
    )
      evidence.external.push(request.url());
  });
  await page.addInitScript(() => {
    window.presentationAudit = { animations: [], sounds: [] };
    document.addEventListener('animationstart', (event) =>
      window.presentationAudit.animations.push(event.animationName),
    );
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.presentationAudit.sounds.push(this.src);
      return play.call(this);
    };
  });
}
async function ready(page) {
  await page.getByText('本地连接已就绪', { exact: true }).waitFor();
}
async function openPhone(index) {
  const next = desktop.waitForEvent('window');
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
          partition: `persist:presentation-phone-${input.index}`,
        },
      });
      void window.loadURL(input.url);
    },
    { index, url: phoneUrl },
  );
  const page = await next;
  await observe(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  await page.reload();
  await ready(page);
  return page;
}
async function capture(page, name, width, height, mobile = false) {
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((w) => w.isVisible()), false);
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
  }
  await page.evaluate(() => {
    scrollTo(0, 0);
  });
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  await wait(120);
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
async function start(dataDir) {
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_HOST: '0.0.0.0',
    TABLEMAX_PORT: '0',
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_PATH;
  delete env.TABLEMAX_WEB_DEV_URL;
  delete env.TABLEMAX_PLAY_MODE;
  if (portable)
    env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
  desktop = await _electron.launch({
    executablePath,
    args,
    env,
    timeout: 30000,
  });
  const host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  await host.getByText('本地连接已就绪', { exact: true }).waitFor();
  if (
    await host.getByRole('button', { name: '选择游戏', exact: true }).count()
  ) {
    await host.getByRole('button', { name: '选择游戏', exact: true }).click();
    await host.getByRole('button', { name: '切换游戏', exact: true }).waitFor();
  }
  await ready(host);
  origin = new URL(host.url()).origin;
  phoneUrl = (await host.locator('.url').textContent()).trim();
  await observe(host);
  await host.reload();
  await ready(host);
  const token = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.equal((await view(token)).playMode, 'play');
  assert.equal(await desktop.evaluate(({ app }) => app.isPackaged), portable);
  return { host, token, socket: await connect(token) };
}
async function stop() {
  for (const socket of clients.splice(0)) socket.disconnect();
  if (desktop) {
    await desktop.close();
    desktop = undefined;
  }
}
async function shortcutMode(host, mode) {
  // Hidden renderers must receive focus through a real click before key input.
  await host.locator('body').click({ position: { x: 1, y: 1 } });
  await host.keyboard.press('Control+Shift+F12');
  const panel = host.getByRole('dialog', { name: '运行模式', exact: true });
  await panel.waitFor();
  await panel
    .getByRole('button', {
      name: mode === 'play' ? '游玩模式' : '测试模式',
      exact: true,
    })
    .click();
  await until(
    async () => (await view()).playMode === mode,
    'Native shortcut changes the saved room mode',
  );
  evidence.modes.push(mode);
  if (await panel.isVisible()) await host.keyboard.press('Escape');
}
async function assertStars(page, label) {
  const sizes = await page.locator('.win-pips i').evaluateAll((stars) =>
    stars.map((star) => ({
      size: parseFloat(getComputedStyle(star).fontSize),
      width: star.getBoundingClientRect().width,
      height: star.getBoundingClientRect().height,
    })),
  );
  assert.ok(sizes.length >= 3, `${label}: three visual win stars`);
  evidence.starSizes.push({ label, sizes });
  assert.ok(
    sizes.every(
      (star) => star.size >= 28 && star.width >= 20 && star.height >= 28,
    ),
    `${label}: stars remain large and readable`,
  );
  assert.equal(
    await page
      .locator('.win-track')
      .first()
      .evaluate((track) => /\d\s*\/\s*3/.test(track.textContent)),
    false,
  );
  assert.ok(
    (
      await page.locator('.win-track').first().getAttribute('aria-label')
    ).includes('胜'),
  );
}
async function assertFocus(locator, label) {
  const audit = await locator.evaluate((element) => ({
    focused: document.activeElement === element,
    activeTag: document.activeElement?.tagName,
    activeText: document.activeElement?.textContent?.trim(),
    activeDialog: document.activeElement
      ?.closest('dialog')
      ?.getAttribute('aria-labelledby'),
  }));
  evidence.focus.push({ label, ...audit });
  assert.equal(
    audit.focused,
    true,
    `${label}: focus remains on the intended control`,
  );
}
async function assertDialogFocus(dialog, label) {
  const active = await dialog.evaluate((element) => ({
    inside: element.contains(document.activeElement),
    enabled:
      document.activeElement instanceof HTMLButtonElement &&
      !document.activeElement.disabled,
    text: document.activeElement?.textContent?.trim(),
  }));
  evidence.focus.push({ label, ...active });
  assert.ok(
    active.inside && active.enabled,
    `${label}: focus remains on an enabled control in the parent dialog`,
  );
}
async function assertSixFits(page, label) {
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    seats: [...document.querySelectorAll('.game-seat')].map((seat) => {
      const rect = seat.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
    }),
    cards: [...document.querySelectorAll('.game-seat .pokemon-card')].map(
      (card) => {
        const rect = card.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      },
    ),
  }));
  evidence.sixLayouts.push({ label, ...layout });
  assert.equal(layout.seats.length, 6);
  assert.equal(layout.cards.length, 36);
  assert.ok(
    layout.documentHeight <= layout.height + 1,
    `${label}: six-player screen needs no page scrolling`,
  );
  assert.ok(
    [...layout.seats, ...layout.cards].every(
      (rect) =>
        rect.x >= -1 &&
        rect.y >= -1 &&
        rect.right <= layout.width + 1 &&
        rect.bottom <= layout.height + 1,
    ),
    `${label}: all six boards, names, win stars and results fit the first screen`,
  );
  assert.ok(
    layout.cards.every((card) => card.width >= 52 && card.height >= 70),
    `${label}: cards retain readable size`,
  );
}

try {
  const dataDir = join(work, 'six-phones');
  const { host, token } = await start(dataDir);
  assert.deepEqual((await view(token)).self, { role: 'host', seatId: null });
  assert.equal(
    await host.getByRole('button', { name: '运行模式', exact: true }).count(),
    0,
  );
  await shortcutMode(host, 'test');
  await host.locator('.test-mode-badge[data-mode="test"]').waitFor();
  const phones = [],
    tokens = [],
    humanSockets = [];
  for (let i = 0; i < 6; i++) {
    const phone = await openPhone(i);
    phones.push(phone);
    await phone.keyboard.press('Control+Shift+F12');
    assert.equal(
      await phone
        .getByRole('dialog', { name: '运行模式', exact: true })
        .count(),
      0,
    );
    await phone
      .getByLabel('你的昵称')
      .fill(
        i === 1
          ? '长昵称手机玩家不应该被截断到看不清本人座位'
          : `现场朋友 ${i + 1}`,
      );
    await phone.getByRole('button', { name: '加入', exact: true }).click();
    await phone
      .getByRole('button', { name: '我准备好了', exact: true })
      .waitFor();
    const playerToken = await phone.evaluate(() =>
      localStorage.getItem('tablemax-player'),
    );
    tokens.push(playerToken);
    humanSockets.push(await connect(playerToken));
    await phone
      .getByRole('button', { name: '我准备好了', exact: true })
      .click();
    await phone
      .getByRole('button', { name: '取消准备', exact: true })
      .waitFor();
  }
  assert.equal(new Set(tokens).size, 6);
  const seated = await view(token);
  assert.equal(seated.seats.length, 6);
  assert.ok(seated.seats.every((seat) => seat.controller === 'human'));
  await command(
    humanSockets[0],
    tokens[0],
    { type: 'set-play-mode', mode: 'play' },
    true,
  );
  const publicSocket = await connect(undefined);
  await command(
    publicSocket,
    undefined,
    { type: 'set-play-mode', mode: 'play' },
    true,
  );
  for (const label of ['连接帮助', '座位设置', '牌桌管理']) {
    const button = host.getByRole('button', { name: label, exact: true });
    await button.click();
    const panel = host.getByRole('dialog', { name: label, exact: true });
    await panel.waitFor();
    const bounds = await panel.boundingBox();
    assert.ok(bounds.width > 250 && bounds.height > 80);
    await capture(
      host,
      `floating-${label === '连接帮助' ? 'network' : label === '座位设置' ? 'seats' : 'management'}`,
      1080,
      800,
    );
    await host.keyboard.press('Escape');
    assert.equal(await host.locator('dialog[open]').count(), 0);
    assert.equal(
      await button.evaluate((element) => document.activeElement === element),
      true,
    );
  }
  await host.getByRole('button', { name: '开始游戏', exact: true }).click();
  await host.waitForURL('**/host/game');
  for (const phone of phones) {
    await phone.waitForURL('**/player/game');
    await phone
      .locator('.pokemon-player > .pokemon-board button')
      .nth(0)
      .click();
    await phone.locator('.confirm-action').click();
  }
  await until(
    async () => (await view(token)).gameView.initialDone.length === 6,
    'All six actual phones flip an initial card',
  );
  assert.deepEqual(
    await host.evaluate(() => window.presentationAudit.sounds),
    [],
  );
  assert.deepEqual(
    await host.evaluate(() => window.presentationAudit.animations),
    [],
  );
  assert.equal(await host.locator('.saved-effects,.saved-motion').count(), 0);
  for (const [width, height] of [
    [1080, 800],
    [1366, 768],
    [1920, 1080],
  ]) {
    await capture(host, `six-phone-game-${width}`, width, height);
    assert.equal(await host.locator('.game-seat').count(), 6);
    assert.equal(
      await host.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    assert.ok(
      await host
        .locator('.game-seat .card-name')
        .evaluateAll((names) =>
          names.every(
            (name) => parseFloat(getComputedStyle(name).fontSize) >= 12,
          ),
        ),
    );
    await assertStars(host, `host ${width}`);
    if (width <= 1366)
      await assertSixFits(host, `Six-phone play ${width}x${height}`);
  }
  await capture(phones[0], 'phone-game-390', 390, 844, true);
  await assertStars(phones[0], 'phone 390');
  await host.getByRole('button', { name: '菜单', exact: true }).click();
  const gameMenu = host.getByRole('dialog', { name: '牌桌菜单', exact: true });
  assert.equal(
    await gameMenu.getByRole('button', { name: '换手机', exact: true }).count(),
    0,
  );
  await gameMenu.getByLabel('手机房主').selectOption(seated.seats[0].id);
  await until(
    async () => (await view(token)).ownerSeatId === seated.seats[0].id,
    'Administrator assigns mobile owner',
  );
  await host.keyboard.press('Escape');
  await shortcutMode(host, 'play');
  await until(
    async () => (await phones[0].locator('.test-mode-badge').count()) === 0,
    'All phones leave test mode',
  );
  await host
    .getByRole('button', { name: '提示音已开启 · 静音', exact: true })
    .waitFor();
  const playSoundBaseline = await host.evaluate(
    () => window.presentationAudit.sounds.length,
  );
  const active = await view(
    tokens.find((playerToken) => playerToken === tokens[0]),
  );
  const turnIndex = tokens.findIndex(
    (_, index) => seated.seats[index].id === active.gameView.actorSeat,
  );
  assert.ok(turnIndex >= 0);
  await phones[turnIndex]
    .getByRole('button', { name: '从牌库取牌', exact: true })
    .click();
  const current = await view(tokens[turnIndex]);
  const announcement = host.locator('.action-announcement');
  await announcement.waitFor();
  await until(
    async () => (await announcement.getAttribute('data-verb')) === 'draw',
    'Saved card draw is announced',
  );
  assert.equal(
    await announcement.getAttribute('data-actor'),
    current.self.seatId,
  );
  assert.ok(
    (await announcement.locator('.action-kicker').textContent()).includes(
      seated.seats[turnIndex].name,
    ),
  );
  assert.ok(
    (await announcement.locator('.action-title').textContent()).includes(
      current.gameView.held.name,
    ),
  );
  await host.waitForFunction(
    () => window.presentationAudit.animations.length > 0,
  );
  await host.waitForFunction(
    (baseline) => window.presentationAudit.sounds.length > baseline,
    playSoundBaseline,
  );
  await capture(host, 'production-saved-action', 1366, 768);
  await host.locator('.recent-actions').click();
  await host.locator('dialog.action-history-panel[open]').waitFor();
  await capture(host, 'recent-saved-actions', 1366, 768);
  await host.keyboard.press('Escape');
  await shortcutMode(host, 'test');
  await host.locator('.test-mode-badge[data-mode="test"]').waitFor();
  await host.waitForFunction(
    () => !document.querySelector('.saved-effects,.saved-motion'),
  );
  const testAudioBaseline = await host.evaluate(
    () => window.presentationAudit.sounds.length,
  );
  const testAnimationBaseline = await host.evaluate(
    () => window.presentationAudit.animations.length,
  );
  let moves = 0;
  for (let loop = 0; loop < 1000; loop++) {
    const room = await view(token);
    assert.deepEqual(room.actions, []);
    assert.equal(room.gameView.peek, null);
    if (room.gameView.roundResult) break;
    for (let i = 0; i < tokens.length; i++) {
      const player = await view(tokens[i]);
      if (!player.actions.length) continue;
      const choice = await bot.decide({
        view: player.gameView,
        actions: player.actions,
        decision: { id: player.decisionId, seatId: player.self.seatId },
        difficulty: 'default',
        memory: null,
        random: {
          next() {
            throw new Error('Unused default driver RNG');
          },
        },
        signal: new AbortController().signal,
      });
      await command(humanSockets[i], tokens[i], {
        type: 'game',
        decisionId: player.decisionId,
        action: choice.action,
      });
      moves++;
    }
  }
  assert.ok((await view(token)).gameView.roundResult);
  assert.equal(
    await host.evaluate(() => window.presentationAudit.sounds.length),
    testAudioBaseline,
    'Test mode remains silent after production audio was unlocked',
  );
  assert.equal(
    await host.evaluate(() => window.presentationAudit.animations.length),
    testAnimationBaseline,
    'Test mode suppresses later saved-action animation events',
  );
  const result = await view(token);
  for (const [width, height] of [
    [1080, 800],
    [1366, 768],
  ]) {
    await capture(host, `six-phone-result-${width}`, width, height);
    await assertSixFits(host, `Six-phone result ${width}x${height}`);
  }
  for (const [index, seat] of result.seats.entries()) {
    const score = result.gameView.roundResult.scores[seat.id];
    const article = host.locator(`.game-seat[data-seat="${seat.id}"]`);
    const trigger = article.getByRole('button', {
      name: '计分明细',
      exact: true,
    });
    await trigger.click();
    const scorePanel = article.getByRole('dialog', {
      name: `计分明细 · 总分 ${score.total}`,
      exact: true,
    });
    await scorePanel.waitFor();
    const text = (await scorePanel.textContent()).replace(/\s/g, '');
    assert.ok(
      text.includes(`三列贡献：${score.columns.join('/')}`),
      'Score panel shows the saved public column totals',
    );
    for (const copy of score.copies)
      assert.ok(
        text.includes(
          `百变怪${copy.slot + 1}→${copy.value}（路径${copy.path.map((slot) => slot + 1).join('→')}）`,
        ),
        'Public Ditto resolution has correct one-based path',
      );
    assert.equal(
      /#[0-9]|instanceId|tokenHash|peekSlot/.test(text),
      false,
      'Score panel contains no private card identity or credentials',
    );
    if (index === 0) await capture(host, 'score-breakdown-floating', 1366, 768);
    if (index % 2 === 0) await host.keyboard.press('Escape');
    else
      await scorePanel
        .getByRole('button', { name: '关闭', exact: true })
        .click();
    await scorePanel.waitFor({ state: 'hidden' });
    await assertFocus(
      trigger,
      `Score popup ${index + 1} returns to its trigger`,
    );
    assert.equal(
      (await view(token)).revision,
      result.revision,
      'Opening score details never mutates the game',
    );
  }
  await capture(phones[0], 'large-phone-win-stars', 360, 640, true);
  await assertStars(phones[0], 'phone 360 result');
  evidence.checks.push(
    `Six actual phone identities complete a natural round (${moves} driver moves), computer is administrator/public display only, modal panels close with focus return, mode shortcut is host-only, test suppresses sound/effects and production plays saved action animation; six-seat readable layouts and large accessible win stars`,
  );
  await stop();

  const timing = await start(join(work, 'timing'));
  const human = await (
    await fetch(`${origin}/api/session/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '仅手机玩家等候' }),
    })
  ).json();
  assert.equal(human.ok, true);
  const phoneSocket = await connect(human.token);
  await command(phoneSocket, human.token, { type: 'ready', ready: true });
  for (const difficulty of ['default', 'doubao', 'juewu'])
    await command(timing.socket, timing.token, {
      type: 'add-bot',
      name: `${difficulty} timing`,
      difficulty,
    });
  const observations = [],
    seen = new Set();
  timing.socket.on('room:view', (room) => {
    for (const entry of room.history)
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        observations.push({ id: entry.id, seat: entry.seatId, at: Date.now() });
      }
  });
  const started = Date.now();
  await command(timing.socket, timing.token, { type: 'start' });
  await until(
    async () => (await view(timing.token)).gameView.initialDone.length === 3,
    'Production bots complete deliberately paced choices',
    18000,
  );
  const production = observations.slice();
  const delays = [1500, 1800, 2200];
  assert.equal(production.length, 3);
  const intervals = production.map(
    (entry, index) => entry.at - (index ? production[index - 1].at : started),
  );
  for (let i = 0; i < 3; i++)
    assert.ok(
      intervals[i] >= delays[i] - 120,
      `Production ${i} respects its thinking interval: ${intervals[i]}`,
    );
  const played = await view(timing.token);
  await command(timing.socket, timing.token, {
    type: 'rollback',
    checkpointId: played.history[0].id,
  });
  await command(timing.socket, timing.token, {
    type: 'set-play-mode',
    mode: 'test',
  });
  const beforeResume = await view(timing.token);
  assert.equal(beforeResume.history.length, 0);
  const fastStart = Date.now();
  await command(timing.socket, timing.token, { type: 'resume' });
  await until(
    async () => (await view(timing.token)).gameView.initialDone.length === 3,
    'Test bots choose quickly',
  );
  const fastMs = Date.now() - fastStart;
  evidence.timing = {
    productionIntervals: intervals,
    expectedMinimums: delays,
    testThreeDecisionsMs: fastMs,
    cancellationWaitMs: 2400,
  };
  assert.ok(
    fastMs < intervals.reduce((a, b) => a + b, 0) / 2,
    'Test mode is materially faster on the same restored decisions',
  );
  const fast = await view(timing.token);
  await command(timing.socket, timing.token, {
    type: 'rollback',
    checkpointId: fast.history[0].id,
  });
  await command(timing.socket, timing.token, {
    type: 'set-play-mode',
    mode: 'play',
  });
  await command(timing.socket, timing.token, { type: 'resume' });
  await wait(100);
  await command(timing.socket, timing.token, { type: 'pause' });
  const paused = await view(timing.token);
  await wait(2400);
  assert.equal(
    (await view(timing.token)).history.length,
    paused.history.length,
    'Pause cancels delayed bot work without another saved move',
  );
  await command(timing.socket, timing.token, {
    type: 'set-play-mode',
    mode: 'test',
  });
  await command(timing.socket, timing.token, { type: 'resume' });
  await command(timing.socket, timing.token, {
    type: 'set-play-mode',
    mode: 'play',
  });
  const switched = await view(timing.token);
  await wait(400);
  assert.equal(
    (await view(timing.token)).history.length,
    switched.history.length,
    'Changing mode cancels the previous fast timer',
  );
  await command(timing.socket, timing.token, { type: 'pause' });
  await timing.host.waitForURL('**/host/game');
  await timing.host.getByRole('button', { name: '菜单', exact: true }).click();
  const menu = timing.host.getByRole('dialog', {
    name: '牌桌菜单',
    exact: true,
  });
  assert.equal(
    await menu.getByRole('button', { name: '换手机', exact: true }).count(),
    0,
  );
  await menu.getByRole('button', { name: '结束游戏', exact: true }).click();
  const confirmation = timing.host.getByRole('dialog', {
    name: '结束游戏',
    exact: true,
  });
  await confirmation.waitFor();
  await assertFocus(
    confirmation.getByRole('button', { name: '取消', exact: true }),
    'End confirmation defaults to cancel',
  );
  await timing.host.keyboard.press('Escape');
  const endTrigger = menu.getByRole('button', {
    name: '结束游戏',
    exact: true,
  });
  await assertFocus(endTrigger, 'Escape restores menu end trigger');
  await endTrigger.click();
  await confirmation.getByRole('button', { name: '取消', exact: true }).click();
  await assertFocus(endTrigger, 'Cancel restores menu end trigger');
  assert.equal((await view(timing.token)).status, 'playing');
  await menu.getByRole('button', { name: '结束游戏', exact: true }).click();
  await confirmation
    .getByRole('button', { name: '确认结束游戏', exact: true })
    .click();
  await until(
    async () => (await view(timing.token)).status === 'ended',
    'Direct menu confirmation ends the game',
  );
  await confirmation.waitFor({ state: 'detached' });
  if (await menu.isVisible()) {
    await assertDialogFocus(
      menu,
      'Completed end confirmation returns to its parent menu',
    );
  }
  const ended = await view(timing.token);
  await wait(2400);
  assert.equal((await view(timing.token)).history.length, ended.history.length);
  evidence.checks.push(
    'Actual default/doubao/juewu Workers respect 1500/1800/2200ms production pacing; the same initial decisions run faster in test mode; pause/mode switch/end cancel queued work, direct end dialog defaults to cancel and requires explicit confirmation',
  );
  for (const page of desktop.windows())
    assert.equal(
      await (
        await desktop.browserWindow(page)
      ).evaluate((window) => window.isVisible()),
      false,
    );
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(evidence.external, []);
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = error.stack;
  if (desktop)
    for (const [index, page] of desktop.windows().entries())
      await capture(page, `failure-${index}`).catch(() => undefined);
  throw error;
} finally {
  await stop();
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
      timing: evidence.timing,
      checks: evidence.checks,
    },
    null,
    2,
  ),
);
