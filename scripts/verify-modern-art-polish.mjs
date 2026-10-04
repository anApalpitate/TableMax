import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const name =
  process.argv
    .find(
      (argument) =>
        argument.startsWith('--evidence=') || argument.startsWith('--run='),
    )
    ?.split('=')[1] ?? 'development';
assert.match(name, /^[a-z0-9-]{1,48}$/);
const highRisk = process.argv.includes('--high-risk');
const representative = process.argv.includes('--representative');
assert.ok(
  !(representative && highRisk),
  'Representative four/five-player scope and high-risk five-player scope are distinct',
);
const mobileOnly = process.argv.includes('--mobile-only');
const onlyNaturalEnded = process.argv.includes('--only-natural-ended');
const naturalEnded =
  onlyNaturalEnded || process.argv.includes('--natural-ended');
assert.ok(
  !(mobileOnly && naturalEnded),
  'Verify natural host/public scope separately from mobile-only scope',
);
const portable = process.argv.includes('--portable');
const skipClock = process.argv.includes('--skip-clock');
const clockEvidence = process.argv
  .find((argument) => argument.startsWith('--clock-evidence='))
  ?.slice('--clock-evidence='.length);
if (clockEvidence) assert.match(clockEvidence, /^[a-z0-9-]{1,48}$/);
const prepareOnly = process.argv.includes('--prepare-only');
const onlyPokemon = process.argv.includes('--only-pokemon');
assert.ok(
  !(mobileOnly && onlyPokemon),
  'Mobile-only Modern Art verification cannot select Pokemon-only verification',
);
const mobileViewports = [
  [320, 568],
  [360, 640],
  [390, 844],
];
const poke = onlyPokemon || process.argv.includes('--pokemon');
const pokemonResult = process.argv.includes('--pokemon-result');
const requestedStages = process.argv
  .find((argument) => argument.startsWith('--stages='))
  ?.slice('--stages='.length)
  .split(',');
const fixturesEvidence = process.argv
  .find((argument) => argument.startsWith('--fixtures-evidence='))
  ?.slice('--fixtures-evidence='.length);
if (fixturesEvidence) {
  assert.match(fixturesEvidence, /^[a-z0-9-]{1,48}$/);
  assert.deepEqual(
    requestedStages,
    ['ended'],
    'Private prepared fixture reuse is limited to the explicit ended scope',
  );
}
if (requestedStages)
  assert.ok(
    requestedStages.every((stage) =>
      [
        'offer',
        'auction-open',
        'auction-sealed',
        'collections',
        'paused',
        'result',
        'three-digit',
        'ended',
      ].includes(stage),
    ),
    'Only known legal saved stages may be selected',
  );
const output = resolve(
  'artifacts/maintenance/v1.0.1/modern-art-polish-20261004/verification',
  name,
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/modern-art-polish-'));
const started = performance.now();
let executablePath = desktopExecutable;
let archiveSha256;
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
      'Expand-Archive -LiteralPath $env:TABLEMAX_POLISH_ARCHIVE -DestinationPath $env:TABLEMAX_POLISH_EXTRACT',
    ],
    {
      env: {
        ...process.env,
        TABLEMAX_POLISH_ARCHIVE: archive,
        TABLEMAX_POLISH_EXTRACT: extracted,
      },
      windowsHide: true,
    },
  );
  archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  executablePath = join(extracted, 'TableMax.exe');
}
const evidence = {
  startedAt: new Date().toISOString(),
  work,
  highRisk,
  representative,
  mobileOnly,
  naturalEnded,
  onlyNaturalEnded,
  mobileViewports,
  prepareOnly,
  skipClock,
  clockEvidence,
  pokemonCompatibility: poke,
  onlyPokemon,
  requestedStages,
  fixturesEvidence,
  scope:
    'Production hidden WebView2 + service + SQLite. Modern Art fixtures use deterministic legal initialization and authorized RoomCoordinator actions; optional Pokemon fixtures use six legal initial flips and legal actions to the round result. Saved states are validated by each unmodified game rule module. This is targeted presentation verification, not natural gameplay acceptance.',
  executable: executablePath,
  portable,
  archiveSha256,
  executableSha256: createHash('sha256')
    .update(await readFile(executablePath))
    .digest('hex'),
  fixtures: [],
  checks: [],
  screenshots: [],
  layouts: [],
  failures: [],
  pageErrors: [],
  externalRequests: [],
};
let desktop;
let origin;
let host;
let hostToken;
let hostSocket;
let phone;
let publicPage;
let phoneToken;
const sockets = [];
const cdpSessions = new Map();
const sleep = (milliseconds) =>
  new Promise((done) => setTimeout(done, milliseconds));
async function save() {
  evidence.elapsedSeconds = (performance.now() - started) / 1000;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2),
  );
}
async function until(callback, description, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await callback()) return;
    await sleep(35);
  }
  throw new Error(description);
}
async function current(token = '') {
  const response = await fetch(origin + '/api/session/view', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(token ? { token } : {}),
  });
  const result = await response.json();
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
async function command(value) {
  const view = await current(hostToken);
  const reply = await new Promise((done, reject) =>
    hostSocket.timeout(5000).emit(
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
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (url.origin !== origin) evidence.externalRequests.push(request.url());
    }
  });
}
async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  await page.waitForTimeout(80);
}
async function resize(page, width, height, mobile = false) {
  const window = await desktop.browserWindow(page);
  const density = mobile
    ? 1
    : await window.evaluate(
        (window) => window.getBounds().width / window.getContentSize()[0],
      );
  await window.evaluate(
    (window, dimensions) =>
      window.setContentSize(dimensions.width, dimensions.height),
    {
      width: Math.round(width / density),
      height: Math.round(height / density),
    },
  );
  if (mobile) {
    let cdp = cdpSessions.get(page);
    if (!cdp) {
      cdp = await page.context().newCDPSession(page);
      cdpSessions.set(page, cdp);
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
    await page.waitForTimeout(150);
    const actual = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      visualWidth: visualViewport.width,
      visualHeight: visualViewport.height,
      scale: visualViewport.scale,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    evidence.checks.push({
      check: 'Mobile emulation requested and actual dimensions',
      requested: { width, height },
      actual,
    });
    if (
      actual.width !== width ||
      actual.height !== height ||
      Math.abs(actual.visualWidth - width) > 0.2 ||
      Math.abs(actual.scale - 1) > 0.001
    ) {
      await capture(
        page,
        `viewport-failure-${width}-${height}-${evidence.screenshots.length}`,
      );
      await save();
      assert.fail(
        `Mobile viewport must match ${width}x${height} at scale 1: ${JSON.stringify(actual)}`,
      );
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await settle(page);
}
async function scale(page, percent) {
  await page.getByRole('button', { name: '显示设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '显示设置', exact: true });
  const select = dialog.getByLabel('界面大小', { exact: true });
  const options = await select.locator('option').evaluateAll((options) =>
    options.map((option) => ({
      value: option.value,
      label: option.textContent,
    })),
  );
  const target = options.find((option) => option.label.includes(`${percent}%`));
  assert.ok(target);
  await select.selectOption(target.value);
  await page.waitForFunction(
    async (percent) =>
      (await window.tablemaxDisplay.read()).preferences.interfaceScale ===
      percent,
    percent,
  );
  const display = await page.evaluate(() => window.tablemaxDisplay.read());
  await page.keyboard.press('Escape');
  await settle(page);
  return display;
}
async function capture(page, label) {
  await settle(page);
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((window) => window.isVisible()), false);
  const encoded = await window.evaluate(async (window) =>
    (await window.webContents.capturePage()).toPNG().toString('base64'),
  );
  const buffer = Buffer.from(encoded, 'base64');
  await writeFile(join(output, label + '.png'), buffer);
  evidence.screenshots.push({
    name: label + '.png',
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  });
  return {
    window,
    zoom: await window.evaluate((window) => window.webContents.getZoomFactor()),
  };
}
async function geometry(page, label, mobile = false) {
  const native = await capture(page, label);
  const layout = await page.evaluate(() => {
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return {
        top: box.top,
        left: box.left,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };
    const shown = (element) => {
      const style = getComputedStyle(element);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        element.getClientRects().length > 0
      );
    };
    const dialog = document.querySelector('dialog[open]');
    const root =
      dialog ?? document.querySelector('.ma-screen') ?? document.body;
    const text = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const value = node.textContent.trim();
      const parent = node.parentElement;
      if (
        !value ||
        !parent ||
        !shown(parent) ||
        ['SCRIPT', 'STYLE', 'OPTION'].includes(parent.tagName)
      )
        continue;
      if (parent.closest('details:not([open])') && !parent.closest('summary'))
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      text.push({
        text: value,
        className: parent.className,
        tag: parent.tagName,
        font: Number.parseFloat(getComputedStyle(parent).fontSize),
        bounds: rect(parent),
        isHeading: parent.closest('.ma-section-heading h2') !== null,
        isKey:
          parent.closest(
            '.ma-round, .ma-auction__participants, .ma-auction__price strong, .ma-waiting, .ma-private-bid, .ma-wallet, .ma-results__income strong',
          ) !== null,
      });
    }
    const controls = [
      ...root.querySelectorAll('button, .button, select, input, summary'),
    ]
      .filter(shown)
      .map((element) => {
        const bounds = rect(element);
        const ancestor = element.closest('.ma-museum__collection, .ma-hand');
        return {
          label:
            element.getAttribute('aria-label') || element.textContent.trim(),
          tag: element.tagName,
          ...bounds,
          offscreenScrollItem:
            !!ancestor &&
            (bounds.right > innerWidth || bounds.top > innerHeight),
          isToolbar: !!element.closest('.ma-toolbar'),
          isNextRound: element.classList.contains('ma-next-round'),
          disabled: element.disabled,
          font: Number.parseFloat(getComputedStyle(element).fontSize),
          unobscured:
            bounds.top >= 0 &&
            bounds.bottom <= innerHeight &&
            bounds.left >= 0 &&
            bounds.right <= innerWidth
              ? (() => {
                  const hit = document.elementFromPoint(
                    bounds.left + bounds.width / 2,
                    bounds.top + bounds.height / 2,
                  );
                  return hit === element || element.contains(hit);
                })()
              : null,
        };
      });
    const museums = [
      ...document.querySelectorAll('.ma-table > .ma-museums .ma-museum'),
    ].map((element) => ({
      id: element.dataset.seatId,
      bounds: rect(element),
      header: rect(element.querySelector('.ma-museum__screen')),
      collection: element.querySelector('.ma-museum__collection')
        ? rect(element.querySelector('.ma-museum__collection'))
        : null,
    }));
    const income = [
      ...document.querySelectorAll('.ma-results__income > div'),
    ].map((element) => {
      const name = element.querySelector('.ma-results__identity > span');
      const amount = element.querySelector(':scope > strong');
      return {
        id: element.dataset.seatId,
        finalCash: element.dataset.finalCash,
        champion: element.dataset.champion === 'true',
        bounds: rect(element),
        name: {
          text: name.textContent,
          title: name.title,
          ...rect(name),
        },
        amount: { text: amount.textContent, ...rect(amount) },
      };
    });
    const cards = [...document.querySelectorAll('.ma-card')]
      .filter(shown)
      .map((element) => ({
        id: element.dataset.cardId,
        artist: element.dataset.artistId,
        auction: element.dataset.auctionKind,
        border: getComputedStyle(element).borderTopColor,
        borderWidth: Number.parseFloat(
          getComputedStyle(element).borderTopWidth,
        ),
        stamp: !!element.querySelector('.ma-card__artist-mark svg'),
        typeMark: !!element.querySelector('.ma-card__auction-mark svg'),
      }));
    const artistValues = [...document.querySelectorAll('.ma-artist')].map(
      (element) => {
        const range = document.createRange();
        range.selectNodeContents(element.querySelector('.ma-artist__count'));
        const box = range.getBoundingClientRect();
        return {
          name: element.querySelector('h3').textContent,
          count: {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          },
          value: rect(element.querySelector('.ma-artist__value')),
        };
      },
    );
    return {
      width: innerWidth,
      height: innerHeight,
      visualWidth: visualViewport.width,
      visualHeight: visualViewport.height,
      visualScale: visualViewport.scale,
      dpr: devicePixelRatio,
      scrollX,
      scrollY,
      scrollWidth: document.documentElement.scrollWidth,
      text,
      controls,
      museums,
      income,
      cards,
      artistValues,
      dialog: dialog ? rect(dialog) : null,
      market: document.querySelector('.ma-market')
        ? rect(document.querySelector('.ma-market'))
        : null,
      center: document.querySelector('.ma-center')
        ? rect(document.querySelector('.ma-center'))
        : null,
      centerChildren: [...document.querySelectorAll('.ma-center > *')].map(
        (element) => ({ className: element.className, ...rect(element) }),
      ),
    };
  });
  const failures = [];
  const problem = (check, data) => failures.push({ check, data });
  for (const item of layout.text) {
    if (item.font < 16 - 0.01 || item.font * native.zoom < 16 - 0.01)
      problem('Information font below 16 CSS/effective pixels', item);
    if (item.isHeading && item.font < 20 - 0.01)
      problem('Section heading below 20 pixels', item);
    if (item.isKey && item.font < 18 - 0.01)
      problem('Critical state label below 18 pixels', item);
  }
  if (layout.scrollWidth > layout.width + 1 || layout.scrollX !== 0)
    problem('Page horizontal overflow', {
      width: layout.width,
      scrollWidth: layout.scrollWidth,
    });
  if (mobile && layout.width > layout.visualWidth + 1)
    problem('Mobile layout extends beyond actual emulated visual viewport', {
      layoutWidth: layout.width,
      visualWidth: layout.visualWidth,
      visualScale: layout.visualScale,
    });
  for (const control of layout.controls) {
    if (
      control.width * native.zoom < 44 - 0.1 ||
      control.height * native.zoom < 44 - 0.1
    )
      problem('Control below 44 effective pixels', control);
    if (['BUTTON', 'SELECT'].includes(control.tag) && control.font < 18)
      problem('Operation label below 18 pixels', control);
    if (!mobile && !control.offscreenScrollItem && control.unobscured !== true)
      problem('Desktop control outside viewport or obscured', control);
    if (control.isToolbar && control.unobscured !== true)
      problem('Toolbar control outside viewport or obscured', control);
    if (mobile && control.isNextRound && control.unobscured !== true)
      problem('Next-round operation outside first screen or obscured', control);
  }
  if (layout.dialog) {
    if (
      layout.dialog.left < -1 ||
      layout.dialog.right > layout.width + 1 ||
      layout.dialog.top < -1 ||
      layout.dialog.bottom > layout.height + 1
    )
      problem('Modal outside viewport', layout.dialog);
    for (const control of layout.controls)
      if (control.unobscured !== true)
        problem('Modal control outside viewport or obscured', control);
  }
  if (!mobile)
    for (const child of layout.centerChildren)
      if (
        child.top < layout.center.top - 2 ||
        child.bottom > layout.center.bottom + 2
      )
        problem('Center content exceeds its allocated panel', child);
  if (!mobile)
    for (const museum of layout.museums) {
      if (museum.bounds.top < 0 || museum.bounds.bottom > layout.height + 1)
        problem('Museum clipped', museum);
      if (layout.center && layout.center.bottom > museum.bounds.top + 1)
        problem('Auction/result and museum overlap', {
          center: layout.center,
          museum,
        });
    }
  for (const row of layout.income) {
    if (row.bounds.bottom > layout.height + 1 || row.bounds.top < 0)
      problem('Income row outside first screen', row);
    if (
      row.bounds.left < -1 ||
      row.bounds.right > layout.width + 1 ||
      row.name.right > row.amount.left - 3 ||
      row.amount.right > row.bounds.right + 1 ||
      row.name.title !== row.name.text
    )
      problem(
        'Income identity overlaps amount, overflows, or loses full name',
        row,
      );
  }
  for (const card of layout.cards)
    if (card.borderWidth < 2.5 || !card.stamp || !card.typeMark)
      problem('Painting identification absent', card);
  for (const artist of layout.artistValues)
    if (
      artist.count.top < artist.value.bottom &&
      artist.count.bottom > artist.value.top &&
      artist.count.right > artist.value.left - 3
    )
      problem('Market quantity and valuation lack clear separation', artist);
  evidence.layouts.push({
    label,
    mobile,
    zoom: native.zoom,
    ...layout,
    failures,
  });
  evidence.failures.push(...failures.map((failure) => ({ label, ...failure })));
  await save();
  return layout;
}
async function openPhone(
  token,
  dimensions = [360, 640],
  selector = '.ma-wallet',
) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, options) => {
      const window = new BrowserWindow({
        show: false,
        width: 390,
        height: 844,
        webPreferences: { partition: options.partition, offscreen: true },
      });
      void window.loadURL(options.origin + '/player');
    },
    { origin, partition: 'persist:ma-polish-' + randomUUID() },
  );
  const page = await next;
  observe(page);
  await page.waitForURL('**/player');
  await page.evaluate(
    (token) => localStorage.setItem('tablemax-player', token),
    token,
  );
  await page.goto(origin + '/player/game');
  await resize(page, ...dimensions, true);
  await page.locator(selector).waitFor();
  return page;
}
async function stop() {
  for (const socket of sockets.splice(0)) socket.disconnect();
  for (const cdp of cdpSessions.values()) await cdp.detach().catch(() => {});
  cdpSessions.clear();
  if (desktop) await desktop.close();
  desktop = null;
  phone = null;
  publicPage = null;
}
async function startFixture(fixture, entry) {
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: entry.dataDir,
    TABLEMAX_PORT: '0',
    TABLEMAX_HOST: '127.0.0.1',
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  delete env.NODE_PATH;
  desktop = await launchDesktop({
    executablePath,
    args: [
      '--foundation-test',
      ...(fixture.preservePlayMode === 'test' ? [] : ['--tablemax-play-mode']),
    ],
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
  if (!fixture.publicOnly) {
    phoneToken = fixture.players[0].token;
    for (const player of fixture.players)
      if ((await current(player.token)).decisionId) {
        phoneToken = player.token;
        break;
      }
    phone = await openPhone(phoneToken);
  }
  const state = await current(hostToken);
  assert.equal(state.seats.length, fixture.count);
  assert.equal(state.game.id, 'modern-art');
  assert.equal(state.countdownSeconds, 20);
  assert.equal((await current()).gameView.self, null);
  if (state.gameView.phase !== 'ended')
    assert.ok(
      Object.values((await current()).gameView.players).every(
        (player) => player.cash === null,
      ),
    );
  if (state.status === 'playing' && entry.id !== 'paused')
    await command({ type: 'resume' });
  await settle(host);
  if (phone) await settle(phone);
}
async function endedChecks(page, label) {
  const authority = (
    await current(page === host ? hostToken : page === phone ? phoneToken : '')
  ).gameView;
  assert.equal(authority.phase, 'ended');
  assert.ok(authority.finalCash);
  const rows = await page
    .locator('.ma-results__income > div')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        seat: element.dataset.seatId,
        cash: Number(element.dataset.finalCash),
        amount: element.querySelector(':scope > strong').textContent.trim(),
        champion: element.dataset.champion === 'true',
        championMark: !!element.querySelector('[aria-label="冠军"] svg'),
        title: element.querySelector('.ma-results__identity > span').title,
      })),
    );
  assert.equal(rows.length, authority.seatOrder.length);
  for (const row of rows) {
    assert.equal(row.cash, authority.finalCash[row.seat]);
    assert.ok(Number.isFinite(row.cash));
    assert.equal(row.amount, `${row.cash.toLocaleString('zh-CN')} 千元`);
    assert.equal(row.champion, authority.winners.includes(row.seat));
    assert.equal(row.championMark, authority.winners.includes(row.seat));
    assert.ok(row.title.length > 0);
  }
  assert.equal(await page.locator('.ma-results__ranking').count(), 0);
  assert.equal(await page.locator('.ma-table .ma-latest').count(), 0);
  if (page !== phone)
    assert.equal(await page.locator('.ma-table > .ma-museums').count(), 0);
  evidence.checks.push({
    check:
      'Actual ended assets match public finalCash, all identities and champions retained',
    label,
    rows,
  });
}
async function naturalEndedChecks(fixture) {
  const next = desktop.waitForEvent('window');
  await desktop.request('open-public', { path: '/public/game' });
  publicPage = await next;
  observe(publicPage);
  await publicPage.locator('.ma-screen').waitFor();
  const before = await current(hostToken);
  await host.keyboard.press('Control+Shift+F12');
  const modeDialog = host.getByRole('dialog', {
    name: '运行模式',
    exact: true,
  });
  await modeDialog.waitFor();
  await modeDialog
    .getByRole('button', {
      name: before.playMode === 'test' ? '测试模式' : '游玩模式',
      exact: true,
    })
    .click();
  await until(
    async () => (await current(hostToken)).revision > before.revision,
    'An actual saved UI acknowledgement was received',
  );
  await host.keyboard.press('Escape');
  await modeDialog.waitFor({ state: 'detached' });
  await settle(host);
  assert.equal(await host.locator('.saved-acknowledgement').count(), 0);
  for (const [page, role] of [
    [host, 'host'],
    [publicPage, 'public'],
  ]) {
    await resize(page, 1280, 720);
    await scale(page, 100);
    const label = `natural-ended-${role}-720p`;
    await geometry(page, label);
    await endedChecks(page, label);
    await historyChecks(page, label, false);
  }
  const seats = (await current(hostToken)).seats.map((seat) => seat.id);
  await host
    .getByRole('button', { name: '原班人马再玩一局', exact: true })
    .click();
  await until(
    async () => (await current(hostToken)).status === 'lobby',
    'Actual final replay action returns to the lobby',
  );
  assert.deepEqual(
    (await current(hostToken)).seats.map((seat) => seat.id),
    seats,
  );
  evidence.checks.push({
    check:
      'Natural four-round save replay, successful ACK deduplicated, and host/public assets checked',
    source: fixture.sourceProof,
  });
}
async function sortingChecks(page, label, selector, controlLabel) {
  const authority = (await current(page === host ? hostToken : phoneToken))
    .gameView;
  const originalIds = selector.includes('.ma-hand ')
    ? authority.self.hand.map((card) => card.id)
    : selector.includes('.ma-self-collection ')
      ? authority.players[authority.self.seatId].collection.map(
          (card) => card.id,
        )
      : authority.seatOrder.flatMap((seat) =>
          authority.players[seat].collection.map((card) => card.id),
        );
  const rows = () =>
    page.locator(selector).evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.dataset.cardId,
        artist: element.dataset.artistId,
        auction: element.dataset.auctionKind,
      })),
    );
  const baseline = await rows();
  const select = page.getByLabel(controlLabel, { exact: true });
  assert.equal(await select.inputValue(), 'artist');
  const order = ['manuel', 'sigrid', 'daniel', 'ramon', 'rafael'];
  let groups;
  if (selector.includes('ma-museums')) {
    groups = await page
      .locator('.ma-museum__collection')
      .evaluateAll((collections) =>
        collections.map((collection) =>
          [...collection.querySelectorAll('.ma-card')].map(
            (card) => card.dataset.artistId,
          ),
        ),
      );
  } else groups = [baseline.map((card) => card.artist)];
  for (const artists of groups)
    assert.ok(
      artists.every(
        (artist, index) =>
          !index || order.indexOf(artist) >= order.indexOf(artists[index - 1]),
      ),
      'Default painter grouping',
    );
  const modes = [];
  for (const mode of ['auction', 'original', 'artist']) {
    await select.selectOption(mode);
    const sorted = await rows();
    assert.deepEqual(
      [...new Set(sorted.map((card) => card.id))].sort(),
      [...new Set(baseline.map((card) => card.id))].sort(),
      'Sorting preserves physical card IDs',
    );
    if (mode === 'original')
      assert.deepEqual(
        sorted.map((card) => card.id),
        originalIds,
        'Original display matches the unchanged authorized projection',
      );
    if (mode === 'auction') {
      const types = ['open', 'once', 'sealed', 'fixed', 'double'];
      const sets = selector.includes('ma-museums')
        ? await page
            .locator('.ma-museum__collection')
            .evaluateAll((collections) =>
              collections.map((collection) =>
                [...collection.querySelectorAll('.ma-card')].map(
                  (card) => card.dataset.auctionKind,
                ),
              ),
            )
        : [sorted.map((card) => card.auction)];
      for (const set of sets)
        assert.ok(
          set.every(
            (kind, index) =>
              !index || types.indexOf(kind) >= types.indexOf(set[index - 1]),
          ),
          'Auction kinds visibly grouped',
        );
    }
    modes.push({ mode, ids: sorted.map((card) => card.id) });
  }
  evidence.checks.push({
    label,
    check:
      'Default painter grouping and three display orders preserve all card IDs',
    modes,
  });
  await save();
}
async function settingsSeconds(seconds) {
  await host.goto(origin + '/host');
  await host.getByRole('button', { name: '倒计时设置', exact: true }).click();
  const dialog = host.getByRole('dialog', { name: '倒计时设置', exact: true });
  const slider = dialog.getByRole('slider');
  const choices = [5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 90, 105, 120];
  assert.equal(await slider.getAttribute('min'), '0');
  assert.equal(await slider.getAttribute('max'), '14');
  await slider.focus();
  await slider.press('Home');
  for (let index = 0; index < choices.indexOf(seconds); index++)
    await slider.press('ArrowRight');
  assert.equal(await slider.getAttribute('aria-valuetext'), `${seconds} 秒`);
  await dialog.getByRole('button', { name: '保存设置', exact: true }).click();
  await until(
    async () => (await current(hostToken)).countdownSeconds === seconds,
    'Countdown slider setting persisted',
  );
  await capture(host, `countdown-settings-${seconds}`);
  await host.keyboard.press('Escape');
  await host.goto(origin + '/host/game');
  await host.locator('.ma-screen').waitFor();
}
async function clockChecks() {
  const initial = await current(hostToken);
  assert.ok(initial.decisionClock?.running);
  assert.equal(initial.countdownSeconds, 20);
  const read = (page) =>
    page.locator('.decision-countdown').evaluate((element) => ({
      id: element.dataset.clockId,
      seconds: Number(element.dataset.remainingSeconds),
      running: element.dataset.clockRunning,
    }));
  const before = await read(phone);
  await phone.reload();
  await phone.locator('.ma-wallet').waitFor();
  const after = await read(phone);
  assert.equal(after.id, before.id);
  assert.ok(
    after.seconds <= before.seconds + 1,
    'Refresh does not reset countdown',
  );
  const hostClock = await read(host);
  assert.equal(hostClock.id, after.id);
  assert.ok(
    Math.abs(hostClock.seconds - after.seconds) <= 1,
    'Multiple actual viewers share the same timer sample',
  );
  await command({ type: 'pause' });
  await until(
    async () => (await read(phone)).running === 'false',
    'Paused clock displayed',
  );
  const frozen = await read(phone);
  await sleep(1100);
  const later = await read(phone);
  assert.deepEqual(later, frozen, 'Actual paused UI countdown freezes');
  await command({ type: 'resume' });
  await settingsSeconds(5);
  await until(
    async () =>
      Number(
        await phone
          .locator('.decision-countdown')
          .getAttribute('data-remaining-seconds'),
      ) === 0,
    'Five-second countdown reaches zero',
    8000,
  );
  const expired = await current(phoneToken);
  assert.ok(expired.actions.length > 0, 'Expiry retains authorized choices');
  assert.equal(expired.status, 'playing');
  await capture(phone, 'countdown-expired-phone');
  await settingsSeconds(120);
  assert.ok(
    (await current(phoneToken)).decisionClock.remainingMs > 115000,
    '120-second slider endpoint applies to the active decision',
  );
  evidence.checks.push({
    check:
      'Real box range slider: default20, min5, max120; same multi-view clock, refresh continuity, pause freeze and expiry without auto action',
    before,
    after,
    hostClock,
  });
  await settingsSeconds(20);
  await save();
}
async function historyChecks(page, label, mobile) {
  const trigger = page.getByRole('button', { name: '历轮估值', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '历轮估值', exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.locator('tbody tr').count(), 5);
  assert.equal(await dialog.locator('thead th').count(), 5);
  await geometry(page, label + '-history', mobile);
  await dialog.getByRole('button', { name: '关闭面板', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(
    await trigger.evaluate((element) => document.activeElement === element),
    true,
    'Modal close restores focus to history trigger',
  );
  await trigger.click();
  await dialog.waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(
    await trigger.evaluate((element) => document.activeElement === element),
    true,
    'Escape restores focus to history trigger',
  );
  evidence.checks.push({
    check:
      'Real history overlay opens, close and Escape work, focus restored; five public artists and four rounds',
    label,
    mobile,
  });
}

async function pokemonCompatibility(preparePokemon) {
  const entry = await preparePokemon(work, pokemonResult);
  evidence.checks.push({
    check: 'Pokemon legal result fixture preparation',
    resultSteps: entry.resultSteps,
    resultDataDir: entry.resultDataDir,
  });
  for (const scene of [
    { id: 'draw', dataDir: entry.dataDir },
    ...(entry.resultDataDir
      ? [{ id: 'round-result', dataDir: entry.resultDataDir }]
      : []),
  ]) {
    const env = {
      ...process.env,
      TABLEMAX_DATA_DIR: scene.dataDir,
      TABLEMAX_PORT: '0',
      TABLEMAX_HOST: '127.0.0.1',
    };
    delete env.TABLEMAX_WEB_DEV_URL;
    delete env.NODE_PATH;
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
    hostSocket = await connect(hostToken);
    await host.goto(origin + '/host/game');
    await host.locator('.pokemon-screen').waitFor();
    await command({ type: 'resume' });
    let credential =
      scene.id === 'round-result' ? entry.players[0].token : undefined;
    for (const player of entry.players) {
      const view = await current(player.token);
      if (view.decisionId) {
        credential = player.token;
        break;
      }
    }
    assert.ok(credential);
    phone = await openPhone(
      credential,
      [360, 640],
      '.game-seat .pokemon-board',
    );
    const view = await current(credential);
    assert.equal(view.gameView.phase, scene.id);
    if (scene.id === 'draw') assert.ok(view.decisionClock?.running);
    await resize(host, 1280, 720);
    for (const [page, label, selector] of [
      [
        phone,
        `pokemon-phone-360-${scene.id}`,
        '.game-seat .pokemon-board .card-slot',
      ],
      [
        host,
        `pokemon-six-720p-${scene.id}`,
        '.game-seat .pokemon-board .card-slot',
      ],
    ]) {
      await capture(page, label);
      const metrics = await page.evaluate((selector) => {
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return {
            top: box.top,
            bottom: box.bottom,
            left: box.left,
            right: box.right,
            width: box.width,
            height: box.height,
          };
        };
        const cards = [...document.querySelectorAll(selector)].map(rect);
        const numbers = [
          ...document.querySelectorAll(selector + ' .slot-index'),
        ].map(rect);
        const faces = [
          ...document.querySelectorAll(selector + ' .pokemon-card'),
        ].map(rect);
        const seats = [...document.querySelectorAll('.game-seat')].map(rect);
        const avatars = [
          ...document.querySelectorAll('.game-seat .avatar'),
        ].map((element) => ({
          ...rect(element),
          decoded: element.complete && element.naturalWidth > 0,
        }));
        const images = [
          ...document.querySelectorAll(selector + ' .pokemon-card.face img'),
        ].map((element) => ({
          ...rect(element),
          decoded: element.complete && element.naturalWidth > 0,
        }));
        const scoreButtons = [
          ...document.querySelectorAll('.score-breakdown'),
        ].map((element) => {
          const box = rect(element);
          const hit = document.elementFromPoint(
            box.left + box.width / 2,
            box.top + box.height / 2,
          );
          return {
            ...box,
            unobscured: hit === element || element.contains(hit),
          };
        });
        return {
          width: innerWidth,
          height: innerHeight,
          visualWidth: visualViewport.width,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          header: rect(document.querySelector('.game-toolbar')),
          cards,
          numbers,
          faces,
          seats,
          images,
          avatars,
          scoreButtons,
          action: document.querySelector('.action-announcement')
            ? rect(document.querySelector('.action-announcement'))
            : null,
          resultBanner: document.querySelector('.round-banner')
            ? rect(document.querySelector('.round-banner'))
            : null,
          countdown: document.querySelector('.decision-countdown')
            ? rect(document.querySelector('.decision-countdown'))
            : null,
        };
      }, selector);
      evidence.checks.push({
        check: 'Pokemon shared compact countdown real draw compatibility',
        label,
        metrics,
      });
      const needed = page === phone ? 6 : 36;
      if (
        metrics.cards.length !== needed ||
        metrics.scrollWidth > metrics.width + 1 ||
        metrics.scrollHeight > metrics.height + 1 ||
        metrics.cards.some(
          (card) =>
            card.bottom > metrics.height + 1 ||
            card.width <= 20 ||
            card.height <= 20,
        ) ||
        metrics.numbers.length !== needed ||
        metrics.numbers.some((number) => number.bottom > metrics.height + 1) ||
        metrics.faces.length !== needed ||
        metrics.faces.some((face) => face.width <= 20 || face.height <= 20) ||
        !metrics.images.length ||
        metrics.images.some((image) => !image.decoded || image.height < 20) ||
        metrics.avatars.length !== (page === host ? 6 : 1) ||
        metrics.avatars.some((image) => !image.decoded || image.height < 20) ||
        (scene.id === 'draw' && !metrics.countdown) ||
        (scene.id === 'round-result' &&
          (metrics.scoreButtons.length !== (page === host ? 6 : 1) ||
            metrics.scoreButtons.some(
              (button) =>
                button.width < 44 ||
                button.height < 44 ||
                button.bottom > metrics.height + 1 ||
                !button.unobscured,
            )))
      )
        evidence.failures.push({
          label,
          check: 'Pokemon compact countdown clips six-card screen or overflows',
          data: metrics,
        });
      if (page === host) {
        const overlaps = (a, b) =>
          a.left < b.right - 1 &&
          a.right > b.left + 1 &&
          a.top < b.bottom - 1 &&
          a.bottom > b.top + 1;
        for (let index = 0; index < metrics.seats.length; index++) {
          const seat = metrics.seats[index];
          if (
            metrics.seats
              .slice(index + 1)
              .some((other) => overlaps(seat, other)) ||
            (metrics.action && overlaps(seat, metrics.action)) ||
            (metrics.resultBanner && overlaps(seat, metrics.resultBanner))
          )
            evidence.failures.push({
              label,
              check: 'Pokemon seats overlap each other or saved action',
              data: metrics,
            });
        }
      }
    }
    await stop();
  }
}
try {
  await build({
    entryPoints: ['scripts/fixtures/prepare-modern-art-polish.ts'],
    outfile: join(work, 'prepare.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  const {
    prepare,
    prepareThreeDigit,
    preparePokemonCompatibility,
    prepareNaturalEnded,
    clonePreparedEnded,
  } = require(join(work, 'prepare.cjs'));
  if (skipClock) {
    const previous = resolve(
      'artifacts/maintenance/v1.0.1/modern-art-polish-20261004/verification',
      clockEvidence ?? 'high-risk-fixed',
      'results.json',
    );
    const bytes = await readFile(previous);
    const proof = JSON.parse(bytes);
    if (portable && clockEvidence)
      assert.equal(
        proof.archiveSha256,
        archiveSha256,
        'Explicit portable countdown evidence must belong to the same ZIP',
      );
    const check = proof.checks.find((item) =>
      item.check.startsWith('Real box range slider:'),
    );
    assert.ok(
      check,
      'Previous real slider and timer chain must exist before reusing unrelated checks',
    );
    evidence.checks.push({
      check:
        'Previously verified shared countdown chain reused for scoped layout checks',
      source: previous,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      originalCheck: check,
    });
  }
  const fixtures = [];
  for (const count of onlyPokemon || onlyNaturalEnded || fixturesEvidence
    ? []
    : highRisk
      ? [5]
      : [5, 4]) {
    const prepared = [];
    if (
      !requestedStages ||
      requestedStages.some((stage) => stage !== 'three-digit')
    )
      prepared.push(
        await prepare(
          work,
          count,
          !requestedStages || requestedStages.includes('ended'),
        ),
      );
    if (
      !highRisk &&
      (!requestedStages || requestedStages.includes('three-digit'))
    )
      prepared.push(await prepareThreeDigit(work, count));
    for (const fixture of prepared) {
      fixtures.push(fixture);
      evidence.fixtures.push({
        count,
        sourceDir: fixture.sourceDir,
        steps: fixture.steps,
        cases: fixture.cases,
        players: fixture.players.map(({ id, name }) => ({ id, name })),
        estimateProof: fixture.estimateProof,
      });
    }
  }
  if (fixturesEvidence) {
    const sourceEvidence = resolve(
      'artifacts/maintenance/v1.0.1/modern-art-polish-20261004/verification',
      fixturesEvidence,
      'results.json',
    );
    const sourceBytes = await readFile(sourceEvidence);
    const sourceProof = JSON.parse(sourceBytes);
    const privateFile = join(
      sourceProof.work,
      'prepared-fixtures-private.json',
    );
    const prepared = await clonePreparedEnded(
      work,
      JSON.parse(await readFile(privateFile, 'utf8')),
    );
    for (const fixture of prepared.filter(
      (entry) => !highRisk || entry.count === 5,
    )) {
      fixtures.push(fixture);
      evidence.fixtures.push({
        count: fixture.count,
        sourceDir: fixture.sourceDir,
        steps: fixture.steps,
        cases: fixture.cases,
        players: fixture.players.map(({ id, name }) => ({ id, name })),
        reuseProof: fixture.reuseProof,
      });
    }
    evidence.checks.push({
      check:
        'Legally prepared four-round ended fixtures and private credentials reused in fresh SQLite',
      source: sourceEvidence,
      sha256: createHash('sha256').update(sourceBytes).digest('hex'),
    });
  }
  if (naturalEnded) {
    const fixture = await prepareNaturalEnded(
      work,
      resolve(
        'artifacts/maintenance/v1.0.1/modern-art-polish-20261004/verification/ended-natural-fixture/save.json',
      ),
    );
    fixtures.push(fixture);
    evidence.fixtures.push(fixture);
  }
  await writeFile(
    join(work, 'prepared-fixtures-private.json'),
    JSON.stringify(fixtures),
  );
  await save();
  for (const fixture of prepareOnly ? [] : fixtures) {
    const stages = (
      requestedStages ??
      (highRisk
        ? ['offer', 'auction-open', 'collections', 'result']
        : [
            'offer',
            'auction-open',
            'auction-sealed',
            'collections',
            'paused',
            'result',
            'three-digit',
            'ended',
          ])
    ).filter((stage) => fixture.cases.some((entry) => entry.id === stage));
    assert.ok(
      stages.length > 0,
      'Every prepared fixture must have a nonempty requested case',
    );
    for (const stage of stages) {
      const entry = fixture.cases.find((entry) => entry.id === stage);
      await startFixture(fixture, entry);
      if (fixture.publicOnly) {
        await naturalEndedChecks(fixture);
        await save();
        await stop();
        continue;
      }
      if (mobileOnly) {
        for (const [width, height] of mobileViewports) {
          await resize(phone, width, height, true);
          const label = `${fixture.count}-${stage}-phone-${width}`;
          await geometry(phone, label, true);
          if (stage === 'ended') await endedChecks(phone, label);
          if (stage === 'offer') {
            await sortingChecks(
              phone,
              `${fixture.count}-phone-${width}-hand-sort`,
              '.ma-hand .ma-card',
              '你的手牌和收藏排序',
            );
            if (fixture.count === 5 && width === 360 && !skipClock)
              await clockChecks();
          }
          if (stage === 'collections')
            await sortingChecks(
              phone,
              `${fixture.count}-phone-${width}-own-collections-sort`,
              '.ma-self-collection .ma-card',
              '你的手牌和收藏排序',
            );
          if (stage === 'result')
            assert.equal(
              await phone.locator('.ma-results__income > div').count(),
              fixture.count,
            );
          if (
            stage === 'offer' ||
            stage === 'collections' ||
            stage === 'three-digit'
          )
            await historyChecks(phone, label, true);
        }
        await save();
        await stop();
        continue;
      }
      if (stage === 'offer') {
        await resize(host, 1280, 720);
        await scale(host, 100);
        await geometry(host, `${fixture.count}-offer-720p`);
        await geometry(phone, `${fixture.count}-offer-phone-360`, true);
        if (highRisk && evidence.failures.length)
          throw new Error(
            'High-risk first screen failed; screenshots and precise metrics saved before the full matrix',
          );
        await sortingChecks(
          phone,
          `${fixture.count}-phone-hand-sort`,
          '.ma-hand .ma-card',
          '你的手牌和收藏排序',
        );
        if (fixture.count === 5 && !skipClock) await clockChecks();
      } else {
        await resize(host, 1280, 720);
        await scale(host, 100);
        await geometry(host, `${fixture.count}-${stage}-720p`);
        await geometry(phone, `${fixture.count}-${stage}-phone-360`, true);
        if (stage === 'ended') {
          await endedChecks(host, `${fixture.count}-${stage}-720p`);
          await endedChecks(phone, `${fixture.count}-${stage}-phone-360`);
        }
        if (stage === 'collections')
          await sortingChecks(
            phone,
            `${fixture.count}-own-collections-sort`,
            '.ma-self-collection .ma-card',
            '你的手牌和收藏排序',
          );
        if (stage === 'collections')
          await sortingChecks(
            host,
            `${fixture.count}-global-collections-sort`,
            '.ma-table > .ma-museums .ma-card',
            '全局收藏排序',
          );
        if (stage === 'result') {
          assert.equal(
            await host.locator('.ma-results__income > div').count(),
            fixture.count,
          );
          assert.equal(
            await phone.locator('.ma-results__income > div').count(),
            fixture.count,
          );
        }
      }
      if (!highRisk) {
        for (const [width, height] of representative
          ? [[1920, 1080]]
          : [
              [1280, 720],
              [1920, 1080],
              [3840, 2160],
            ]) {
          await resize(host, width, height);
          for (const percent of representative ? [100] : [100, 125, 150]) {
            if (width === 1280 && percent === 100) continue;
            const display = await scale(host, percent);
            const label = `${fixture.count}-${stage}-${width}-${percent}`;
            await geometry(host, label);
            if (stage === 'ended') await endedChecks(host, label);
            evidence.checks.push({
              check: 'Native display preference and actual protection recorded',
              label,
              display,
            });
          }
        }
        for (const [width, height] of mobileViewports) {
          if (width === 360) continue;
          await resize(phone, width, height, true);
          await geometry(
            phone,
            `${fixture.count}-${stage}-phone-${width}`,
            true,
          );
          if (stage === 'ended')
            await endedChecks(
              phone,
              `${fixture.count}-${stage}-phone-${width}`,
            );
        }
        await resize(host, 1280, 720);
        await scale(host, 100);
        await resize(phone, 360, 640, true);
      }
      if (
        stage === 'offer' ||
        stage === 'collections' ||
        stage === 'three-digit'
      ) {
        await historyChecks(host, `${fixture.count}-${stage}`, false);
        await historyChecks(phone, `${fixture.count}-${stage}-phone`, true);
      }
      await save();
      await stop();
    }
  }
  if (poke && !prepareOnly)
    await pokemonCompatibility(preparePokemonCompatibility);
  if (mobileOnly && !prepareOnly)
    assert.ok(
      evidence.layouts.length > 0 &&
        evidence.layouts.every((layout) => layout.mobile === true),
      'Mobile-only verification must execute a nonempty set of actual mobile layouts',
    );
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  evidence.result = prepareOnly
    ? 'fixtures-prepared'
    : evidence.failures.length
      ? 'failed'
      : 'passed';
  await save();
  assert.equal(
    evidence.failures.length,
    0,
    `${evidence.failures.length} presentation failures; see ${join(output, 'results.json')}`,
  );
  console.log(
    JSON.stringify({
      result: evidence.result,
      output,
      screenshots: evidence.screenshots.length,
      layouts: evidence.layouts.length,
      seconds: evidence.elapsedSeconds,
    }),
  );
} catch (error) {
  evidence.result = 'failed';
  evidence.error = String(error.stack ?? error);
  await save();
  console.error(evidence.error);
  process.exitCode = 1;
} finally {
  await stop();
  await save();
}
