import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';
import { verificationOutput } from './verification-output.mjs';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const output = verificationOutput(
  'modern-art',
  portable ? 'portable' : 'development',
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/desktop-verify-'));
await build({
  entryPoints: ['games/modern-art/bot/index.ts'],
  outfile: join(work, 'driver.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const { bot } = require(join(work, 'driver.cjs'));
let executablePath = desktopExecutable;
const evidence = {
  startedAt: new Date().toISOString(),
  portable,
  checks: [],
  screenshots: [],
  pageErrors: [],
  externalRequests: [],
  phases: [],
  actions: [],
};
if (portable) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
  const extracted = await mkdtemp(resolve('tmp/portable-game-'));
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_VERIFY_ARCHIVE -DestinationPath $env:TABLEMAX_VERIFY_EXTRACT',
    ],
    {
      env: {
        ...process.env,
        TABLEMAX_VERIFY_ARCHIVE: archive,
        TABLEMAX_VERIFY_EXTRACT: extracted,
      },
      windowsHide: true,
    },
  );
  evidence.archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  executablePath = join(extracted, 'TableMax.exe');
}
const dataDir = join(work, 'data');
let desktop, origin, host, publicPage, hostToken;
const sockets = [];
const phones = [];
const metricsSessions = new Map();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(predicate, description, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await sleep(40);
  }
  throw new Error(description);
}
async function view(token = '') {
  const result = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(result.ok, true);
  return result.view;
}
async function connect(token) {
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: token ? { token } : {},
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function send(socket, token, command) {
  const current = await view(token);
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
  if (!reply.ok && ['stale-revision', 'stale-decision'].includes(reply.reason))
    return false;
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return true;
}
function observe(page) {
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin)
      evidence.externalRequests.push(request.url());
  });
}
async function viewport(page, width, height, mobile = false) {
  const window = await desktop.browserWindow(page);
  const scale = mobile
    ? 1
    : await window.evaluate(
        (window) => window.getBounds().width / window.getContentSize()[0],
      );
  await window.evaluate(
    (window, size) => window.setContentSize(size.width, size.height),
    { width: Math.round(width / scale), height: Math.round(height / scale) },
  );
  if (mobile) {
    let cdp = metricsSessions.get(page);
    if (!cdp) {
      cdp = await page.context().newCDPSession(page);
      metricsSessions.set(page, cdp);
    }
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
    await page.waitForFunction(
      (size) => innerWidth === size.width && innerHeight === size.height,
      { width, height },
    );
  } else {
    const geometry = await window.evaluate((window) => ({
      content: window.getContentSize(),
      zoom: window.webContents.getZoomFactor(),
    }));
    await page.waitForFunction(
      (geometry) =>
        Math.abs(innerWidth - geometry.content[0] / geometry.zoom) <= 2 &&
        Math.abs(innerHeight - geometry.content[1] / geometry.zoom) <= 2,
      geometry,
    );
  }
}
async function capture(page, name, width, height, mobile = false) {
  if (width) await viewport(page, width, height, mobile);
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  await page.waitForTimeout(120);
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((window) => window.isVisible()), false);
  const png = await window.evaluate(async (window) =>
    (await window.webContents.capturePage()).toPNG().toString('base64'),
  );
  await writeFile(join(output, name + '.png'), Buffer.from(png, 'base64'));
  evidence.screenshots.push(name + '.png');
  evidence.layouts ??= [];
  evidence.layouts.push({
    name,
    requested: width ? { width, height, mobile } : null,
    ...(await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      devicePixelRatio,
    }))),
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 2,
  );
  assert.equal(overflow, false, name + ' horizontal overflow');
  const panels = await page.evaluate(() => {
    if (!document.querySelector('.ma-screen:not(.player)')) return [];
    return [
      ...document.querySelectorAll(
        '.ma-market,.ma-center,.ma-museums,.ma-notice',
      ),
    ].map((element) => {
      const r = element.getBoundingClientRect();
      return {
        className: element.className,
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
      };
    });
  });
  const dimensions = evidence.layouts.at(-1);
  for (const panel of panels)
    assert.ok(
      panel.y >= -1 &&
        panel.bottom <= dimensions.height + 2 &&
        panel.right <= dimensions.width + 2,
      name + ' panel fits: ' + panel.className,
    );
  for (let i = 0; i < panels.length; i++)
    for (const other of panels.slice(i + 1)) {
      const a = panels[i];
      assert.ok(
        Math.min(a.right, other.right) - Math.max(a.x, other.x) <= 1 ||
          Math.min(a.bottom, other.bottom) - Math.max(a.y, other.y) <= 1,
        name + ' panels do not overlap: ' + a.className + '/' + other.className,
      );
    }
  dimensions.panels = panels;
  const clippedContent = await page.evaluate(() => {
    if (!document.querySelector('.ma-screen:not(.player)')) return [];
    return [...document.querySelectorAll('.ma-market > *, .ma-center > *')]
      .filter((element) => {
        const child = element.getBoundingClientRect();
        const parent = element.parentElement.getBoundingClientRect();
        return child.top < parent.top - 2 || child.bottom > parent.bottom + 2;
      })
      .map((element) => element.className);
  });
  assert.deepEqual(
    clippedContent,
    [],
    name + ' market and auction content fits',
  );
}
async function newPhone(index, restore = false) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, options) => {
      const window = new BrowserWindow({
        show: false,
        width: 390,
        height: 844,
        webPreferences: {
          partition: 'persist:modern-art-' + options.index,
          offscreen: true,
        },
      });
      void window.loadURL(
        options.origin + (options.restore ? '/player/game' : '/player'),
      );
    },
    { origin, index, restore },
  );
  const page = await next;
  observe(page);
  await viewport(page, 390, 844, true);
  if (restore) await page.locator('.ma-wallet').waitFor();
  else {
    await page.getByLabel('你的昵称').fill('美术馆 ' + (index + 1));
    await page.getByRole('button', { name: '加入', exact: true }).click();
    await page
      .getByRole('button', { name: '我准备好了', exact: true })
      .waitFor();
  }
  const token = await page.evaluate(() =>
    localStorage.getItem('tablemax-player'),
  );
  return { page, token, socket: await connect(token) };
}
try {
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_PORT: '0',
    TABLEMAX_HOST: '127.0.0.1',
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  if (portable)
    env.PATH = process.env.SystemRoot + '\\system32;' + process.env.SystemRoot;
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-test-mode'],
    env,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  observe(host);
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  let hostSocket = await connect(hostToken);
  await capture(host, 'box-game-library', 1920, 1080);
  await host
    .locator('.game-library__item')
    .filter({ hasText: '现代艺术' })
    .getByRole('button', { name: '选择游戏', exact: true })
    .click();
  await until(
    async () => (await view(hostToken)).game?.id === 'modern-art',
    'Modern Art selection saved',
  );
  assert.equal(
    await host.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .some((entry) => /ModernArtScreen|atlas/.test(entry.name)),
    ),
    false,
    'Box must load only thumbnails',
  );
  for (let i = 0; i < 3; i++) phones.push(await newPhone(i));
  for (const [difficulty, name] of [
    ['doubao', '豆包美术馆'],
    ['juewu', '绝悟美术馆'],
  ])
    await send(hostSocket, hostToken, { type: 'add-bot', name, difficulty });
  const initial = await view(hostToken);
  await send(hostSocket, hostToken, {
    type: 'set-owner',
    seatId: initial.seats[0].id,
  });
  await Promise.all(
    phones.map(({ page }) =>
      page.getByRole('button', { name: '我准备好了', exact: true }).click(),
    ),
  );
  await until(
    async () => (await view(hostToken)).seats.every((seat) => seat.ready),
    'Independent phone ready persisted',
  );
  await phones[0].page
    .getByRole('button', { name: '开始游戏', exact: true })
    .click();
  await Promise.all(
    [host, ...phones.map((phone) => phone.page)].map((page) =>
      page.waitForURL('**/game'),
    ),
  );
  await host.locator('.ma-screen').waitFor();
  const assetDecode = await phones[0].page.evaluate(async () => {
    const moduleUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((name) => /ModernArtScreen.*\.js/.test(name));
    if (!moduleUrl) throw new Error('Modern Art client chunk missing');
    const source = await (await fetch(moduleUrl)).text();
    const atlases = [
      ...new Set(source.match(/\/[\w./-]+-atlas-v1-[\w-]+\.webp/g) ?? []),
    ];
    if (atlases.length !== 5)
      throw new Error('Five local art atlases must be bundled');
    await Promise.all(
      atlases.map(async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        if (image.naturalWidth !== 1536 || image.naturalHeight !== 1536)
          throw new Error('Unexpected atlas dimensions');
      }),
    );
    if (document.querySelector('.ma-card__art--pending'))
      throw new Error('Card image fallback present');
    return atlases;
  });
  evidence.decodedAtlases = assetDecode;
  await send(hostSocket, hostToken, { type: 'pause' });
  const nextPublic = desktop.waitForEvent('window');
  await desktop.request('open-public', { path: '/public/game' });
  publicPage = await nextPublic;
  observe(publicPage);
  await publicPage.locator('.ma-screen').waitFor();
  assert.equal((await view(hostToken)).actions.length, 0);
  assert.equal((await view()).gameView.self, null);
  assert.ok(
    Object.values((await view()).gameView.players).every(
      (player) => player.cash === null,
    ),
  );
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
    [2560, 1440],
    [3840, 2160],
  ])
    await capture(host, `host-${width}`, width, height);
  await capture(publicPage, 'public-1080p', 1920, 1080);
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
  ])
    await capture(phones[0].page, `phone-${width}`, width, height, true);
  await viewport(host, 1280, 900);
  await viewport(phones[0].page, 390, 844, true);
  await host.getByRole('button', { name: '菜单', exact: true }).click();
  await host.getByRole('dialog').waitFor();
  await capture(host, 'management-paused');
  await host.keyboard.press('Escape');
  const started = await view(hostToken);
  await send(phones[0].socket, phones[0].token, { type: 'resume' });
  const seenPhases = new Set();
  const seenActions = new Set();
  const requiredActions = [
    'offer',
    'add-double',
    'decline-double',
    'bid',
    'pass',
    'sealed-bid',
    'set-price',
    'buy',
  ];
  const end = Date.now() + 180000;
  let steps = 0;
  while (Date.now() < end) {
    const current = await view(hostToken);
    assert.equal(current.botError, null);
    if (current.status === 'ended') break;
    if (current.lifecycleActions.length) {
      const round = current.gameView.round;
      await phones[0].page
        .getByRole('button', { name: '开始下一轮', exact: true })
        .click();
      await until(
        async () => (await view(hostToken)).gameView.round === round + 1,
        'Phone owner next round saved',
      );
      continue;
    }
    const game = current.gameView;
    const phase = game.phase === 'auction' ? game.auction.kind : game.phase;
    if (!seenPhases.has(phase)) {
      // Pause first so screenshots and UI checks represent one durable state.
      await send(hostSocket, hostToken, { type: 'pause' });
      const pausedGame = (await view(hostToken)).gameView;
      const savedPhase =
        pausedGame.phase === 'auction'
          ? pausedGame.auction.kind
          : pausedGame.phase;
      seenPhases.add(savedPhase);
      await capture(host, 'phase-' + savedPhase);
      await capture(phones[0].page, 'phone-phase-' + savedPhase);
      await send(hostSocket, hostToken, { type: 'resume' });
      if (savedPhase === 'open')
        await capture(publicPage, 'tabletop-active', 1920, 1080);
    }
    let acted = false;
    for (const phone of phones) {
      let player = await view(phone.token);
      if (!player.actions.length || player.paused) continue;
      const own = player.gameView;
      let action;
      if (own.phase === 'offer') {
        const missing = own.self.hand.find(
          (card) => !seenPhases.has(card.auctionKind),
        );
        action = player.actions.find(
          (action) => action.type === 'offer' && action.cardId === missing?.id,
        );
      }
      action ??= (
        await bot.decide({
          view: own,
          actions: player.actions,
          decision: { id: player.decisionId, seatId: player.self.seatId },
          memory: null,
          difficulty: 'doubao',
          random: { next: () => 0.31 },
          signal: new AbortController().signal,
        })
      ).action;
      const untested = player.actions.find(
        (entry) =>
          requiredActions.includes(entry.type) &&
          !seenActions.has(entry.type) &&
          entry.type !== 'offer',
      );
      if (untested) action = untested;
      // Exercise each available phone control once; later actions use the same authorized socket path.
      if (
        !seenActions.has(action.type) &&
        [
          'offer',
          'add-double',
          'bid',
          'sealed-bid',
          'set-price',
          'buy',
          'pass',
          'decline-double',
        ].includes(action.type)
      ) {
        // Stop an already scheduled fast bot, then resume at the ordinary 1.8s pace.
        await send(hostSocket, hostToken, { type: 'pause' });
        await send(hostSocket, hostToken, {
          type: 'set-play-mode',
          mode: 'play',
        });
        await send(hostSocket, hostToken, { type: 'resume' });
        player = await view(phone.token);
        if (
          !player.actions.some(
            (entry) => JSON.stringify(entry) === JSON.stringify(action),
          )
        )
          continue;
        const afterLog = Number(player.gameView.latest?.id.slice(4) ?? 0);
        const seat = player.self.seatId;
        const verb =
          {
            'add-double': 'double-add',
            'decline-double': 'double-decline',
            'sealed-bid': 'sealed-submit',
            buy: 'sale',
          }[action.type] ?? action.type;
        if ('amount' in action)
          await phone.page
            .locator('input[type="number"]')
            .fill(String(action.amount));
        const button =
          'cardId' in action
            ? phone.page.locator(`[data-card-id="${action.cardId}"]`)
            : phone.page.locator(`[data-ma-action="${action.type}"]`);
        await button.first().click();
        await until(
          async () =>
            (await view(phone.token)).gameView.history.some(
              (log) =>
                Number(log.id.slice(4)) > afterLog &&
                log.verb === verb &&
                (action.type === 'buy'
                  ? log.winner === seat
                  : log.actor === seat) &&
                (!('cardId' in action) ||
                  log.cards.some((card) => card.id === action.cardId)) &&
                (!('amount' in action) ||
                  action.type === 'sealed-bid' ||
                  log.amount === action.amount),
            ),
          'Specific phone UI action saved: ' + action.type,
        );
        seenActions.add(action.type);
        await send(hostSocket, hostToken, {
          type: 'set-play-mode',
          mode: 'test',
        });
      } else
        await send(phone.socket, phone.token, {
          type: 'game',
          decisionId: player.decisionId,
          action,
        });
      steps++;
      acted = true;
      break;
    }
    if (!acted) await sleep(80);
  }
  const result = await view(hostToken);
  assert.equal(result.status, 'ended', 'Full four-round match completed');
  assert.equal(result.gameView.phase, 'ended');
  assert.equal(result.gameView.round, 4, 'All four rounds completed');
  for (const phase of ['open', 'once', 'sealed', 'fixed', 'double'])
    assert.ok(seenPhases.has(phase), 'Auction phase covered: ' + phase);
  for (const action of requiredActions)
    assert.ok(
      seenActions.has(action),
      'Actual phone control covered: ' + action,
    );
  assert.ok(result.gameView.winners.length);
  assert.equal(Object.keys(result.gameView.finalCash).length, 5);
  await capture(host, 'final-result');
  await capture(phones[0].page, 'phone-final-result');
  evidence.phases = [...seenPhases];
  evidence.actions = [...seenActions];
  evidence.steps = steps;
  evidence.finalRound = result.gameView.round;
  evidence.checks.push(
    'Five-seat real Worker match, three private phone identities, phone owner control, public secrecy, responsive background rendering',
  );
  // Restore a real before boundary, replay from the saved state, and preserve identities across restart.
  await send(hostSocket, hostToken, {
    type: 'rollback',
    checkpointId: result.history.at(-1).id,
  });
  const saved = await view(phones[0].token);
  assert.equal(saved.paused, true);
  const savedToken = phones[0].token;
  env.TABLEMAX_PORT = new URL(origin).port;
  for (const socket of sockets) socket.disconnect();
  await desktop.close();
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test'],
    env,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  observe(host);
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  hostSocket = await connect(hostToken);
  await host.goto(origin + '/host/game');
  await host.locator('.ma-screen').waitFor();
  const restored = await view(phones[0].token);
  assert.equal(restored.paused, true);
  assert.deepEqual(restored.gameView, saved.gameView);
  assert.equal(restored.ownerSeatId, started.ownerSeatId);
  assert.equal(restored.self.seatId, saved.self.seatId);
  phones[0] = await newPhone(0, true);
  assert.equal(
    phones[0].token,
    savedToken,
    'Same phone profile restores its own credential',
  );
  await capture(phones[0].page, 'phone-restart-restored');
  await capture(host, 'restart-restored');
  await send(hostSocket, hostToken, { type: 'end' });
  await host.evaluate(() => {
    window.modernArtSwitchDocument = true;
  });
  const identities = (await view(hostToken)).seats.map((seat) => seat.id);
  await send(hostSocket, hostToken, {
    type: 'select-game',
    gameId: 'pokemon-encounters',
  });
  for (const phone of phones)
    await send(await connect(phone.token), phone.token, {
      type: 'ready',
      ready: true,
    });
  await send(hostSocket, hostToken, { type: 'start' });
  await host.locator('.pokemon-screen').waitFor();
  await send(hostSocket, hostToken, { type: 'pause' });
  await send(hostSocket, hostToken, { type: 'end' });
  await send(hostSocket, hostToken, {
    type: 'select-game',
    gameId: 'modern-art',
  });
  for (const phone of phones)
    await send(await connect(phone.token), phone.token, {
      type: 'ready',
      ready: true,
    });
  await send(hostSocket, hostToken, { type: 'start' });
  await host.locator('.ma-screen').waitFor();
  await send(hostSocket, hostToken, { type: 'pause' });
  assert.equal(
    await host.evaluate(() => window.modernArtSwitchDocument),
    true,
    'Switch reuses the same SPA document',
  );
  const styles = await host.evaluate(() =>
    [...document.styleSheets].map((sheet) => sheet.href ?? ''),
  );
  assert.ok(
    styles.some((url) => /PokemonScreen.*\.css/.test(url)) &&
      styles.some((url) => /ModernArtScreen.*\.css/.test(url)),
    'Both game stylesheets coexist after switching',
  );
  evidence.coexistingStyles = styles;
  assert.deepEqual(
    (await view(hostToken)).seats.map((seat) => seat.id),
    identities,
  );
  assert.ok(
    !(
      await host
        .locator('.ma-screen')
        .evaluate((element) => getComputedStyle(element).backgroundImage)
    ).includes('garden-table'),
  );
  await capture(host, 'game-switch-isolation');
  evidence.checks.push(
    'Rollback plus SQLite restart preserves secrets and phone owner; Pokemon/Modern Art switching preserves all five identities and isolates CSS',
  );
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  evidence.result = 'passed';
  evidence.finishedAt = new Date().toISOString();
  console.log(
    JSON.stringify({
      checks: evidence.checks,
      phases: evidence.phases,
      actions: evidence.actions,
      steps,
      screenshots: evidence.screenshots.length,
      output,
    }),
  );
} finally {
  for (const socket of sockets) socket.disconnect();
  if (desktop) await desktop.close();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
}
