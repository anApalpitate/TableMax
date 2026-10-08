import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { launchDesktop } from './desktop-test.mjs';
import { launchTestBrowser } from './browser-test.mjs';
import { playerFrame, playerUi } from './player-test.mjs';

const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const source = process.argv.includes('--source');
const quick = process.argv.includes('--quick');
const scrollOnly = process.argv.includes('--scroll-only');
const onlyGame = argument('game');
assert.ok(
  !onlyGame ||
    ['pokemon-encounters', 'modern-art', 'power-grid'].includes(onlyGame),
);
const evidence = argument('evidence') ?? `run-${Date.now()}`;
assert.match(evidence, /^[a-z0-9-]+$/);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const output = resolve(
  `artifacts/maintenance/v${version}/player-display`,
  evidence,
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
// Existing audited temporary prefix: no new cleanup exclusion or deletion path.
const work = await mkdtemp(resolve('tmp/debug-portable-'));
const execute = promisify(execFile);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
let portable = resolve('build/desktop');
const report = {
  version,
  status: 'running',
  source,
  quick,
  scrollOnly,
  onlyGame: onlyGame ?? null,
  scope:
    'Muted hidden WinForms/WebView2 and headless Edge; authorized real server state, CSS viewport and device emulation. No physical hardware DPI or phone claim.',
  checks: [],
  layouts: [],
  screenshots: [],
  errors: [],
};
if (!source) {
  const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
  const manifest = JSON.parse(
    await readFile(archive.replace('.zip', '-manifest.json'), 'utf8'),
  );
  const bytes = await readFile(archive);
  report.archiveSha256 = hash(bytes);
  assert.equal(
    report.archiveSha256,
    argument('sha256'),
    'Frozen ZIP hash required',
  );
  assert.equal(report.archiveSha256, manifest.archive.sha256);
  assert.equal(bytes.length, manifest.archive.bytes);
  assert.ok(bytes.length < 100000000 && manifest.extractedBytes < 100000000);
  portable = join(work, 'portable');
  await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:DISPLAY_ARCHIVE -DestinationPath $env:DISPLAY_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        DISPLAY_ARCHIVE: archive,
        DISPLAY_EXTRACT: portable,
      },
    },
  );
  let total = 0;
  for (const entry of manifest.files) {
    const bytes = await readFile(join(portable, entry.path));
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(hash(bytes), entry.sha256, entry.path);
    total += bytes.length;
  }
  assert.equal(total, manifest.extractedBytes);
  assert.ok(total <= 95000000);
  report.packageBytes = { archive: bytes.length, extracted: total };
}
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const sockets = [];
const pages = [];
let desktop, browser, origin, hostToken, hostSocket;
const save = () =>
  writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
async function checked(label) {
  report.checks.push(label);
  console.log(label);
  await save();
}
async function post(path, body) {
  return (
    await fetch(origin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
  ).json();
}
async function view(token = hostToken) {
  const reply = await post('/api/session/view', { token });
  assert.equal(reply.ok, true);
  return reply.view;
}
async function connect(token) {
  const client = io(origin, {
    auth: { token },
    transports: ['polling', 'websocket'],
    forceNew: true,
  });
  sockets.push(client);
  await new Promise((done, fail) => {
    client.once('connect', done);
    client.once('connect_error', fail);
  });
  return client;
}
async function command(value, token = hostToken, client = hostSocket) {
  const before = await view(token);
  const reply = await client.timeout(10000).emitWithAck('room:command', {
    actionId: randomUUID(),
    instanceId: before.instanceId,
    branch: before.branch,
    revision: before.revision,
    command: value,
  });
  assert.equal(reply.ok, true, reply.reason);
}
async function rendered(page, state) {
  await playerUi(page)
    .locator(
      `[data-room-instance="${state.instanceId}"][data-room-branch="${state.branch}"][data-room-revision="${state.revision}"]`,
    )
    .waitFor();
}
async function open(token, contextOptions = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ...contextOptions,
  });
  await context.addInitScript(
    (token) => localStorage.setItem('tablemax-player', token),
    token,
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.__displayConnections = 0;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.startsWith('/socket.io') &&
      url.searchParams.get('transport') === 'polling' &&
      !url.searchParams.has('sid')
    )
      page.__displayConnections++;
  });
  page.on('pageerror', (error) => report.errors.push(error.message));
  const state = await view(token);
  await page.goto(origin + (state.gameView ? '/player/game' : ''));
  page.__displayToken = token;
  pages.push(page);
  await rendered(page, state);
  return page;
}
async function mode(page, next) {
  const parent = page.locator('main.player-frame');
  await parent.locator(':scope:not([data-player-display="mobile"])').waitFor();
  if ((await parent.getAttribute('data-player-display')) !== next)
    await page.locator('.player-frame__display').click();
  await parent.locator(`:scope[data-player-display="${next}"]`).waitFor();
  await playerUi(page).locator(`html[data-player-display="${next}"]`).waitFor();
}
async function capture(page, name) {
  await (
    await playerFrame(page)
  ).evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((image) => image.complete)
        .map((image) => image.decode().catch(() => {})),
    );
  });
  await page.screenshot({ path: join(output, name + '.png'), fullPage: true });
  report.screenshots.push(name + '.png');
}
async function geometry(page, name, size, next) {
  await page.setViewportSize({ width: size[0], height: size[1] });
  if (size[0] >= 800) await mode(page, next);
  await page.waitForTimeout(100);
  const child = await playerFrame(page);
  const metrics = await child.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    overflow: document.documentElement.scrollWidth - innerWidth,
    mode: document.documentElement.dataset.playerDisplay,
    scrollbarWidth: getComputedStyle(
      document.documentElement,
      '::-webkit-scrollbar',
    ).width,
    tokens: getComputedStyle(document.documentElement)
      .getPropertyValue('--tm-scroll-thumb')
      .trim(),
    frameCount: document.querySelectorAll('iframe[data-player-frame]').length,
  }));
  assert.ok(
    metrics.overflow <= 2,
    `${name} ${size}/${next}: overflow ${metrics.overflow}`,
  );
  const frame = await page.locator('iframe[data-player-frame]').boundingBox();
  assert.ok(frame.width <= size[0] && frame.height <= size[1]);
  if (size[0] >= 800) {
    const control = await page.locator('.player-frame__display').boundingBox();
    assert.equal(control.width, 48);
    assert.equal(control.height, 48);
    assert.ok(
      control.x >= frame.x + frame.width ||
        control.y + control.height <= frame.y,
      'Display control overlaps player UI',
    );
    assert.equal(metrics.mode, next);
  }
  report.layouts.push({ name, size, requested: next, frame, ...metrics });
  if ([1280, 1920, 390].includes(size[0]))
    await capture(page, `${name}-${size[0]}-${next}`);
}
async function stableDraft(page, token, label) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await mode(page, 'wide');
  const child = await playerFrame(page);
  const marker = randomUUID();
  await child.evaluate((value) => {
    window.__displayDocument = value;
  }, marker);
  const before = await view(token);
  const connections = page.__displayConnections;
  const map = playerUi(page).locator('.pg-map-panel:visible').first();
  let mapCamera;
  if (await map.count()) {
    const zoom = map.getByRole('button', { name: '放大地图', exact: true });
    if (await zoom.count()) await zoom.click();
    await page.waitForTimeout(100);
  }
  const number = playerUi(page)
    .locator('input[type="number"]:enabled:visible')
    .first();
  const slot = playerUi(page)
    .locator('button.card-slot:enabled:visible')
    .first();
  const city = playerUi(page).getByRole('combobox', {
    name: '选择城市',
    exact: true,
  });
  let numberValue,
    cityValue,
    selectedSlot = false;
  if (await number.count()) {
    await number.fill('7');
    numberValue = await number.inputValue();
  }
  if (await slot.count()) {
    await slot.click();
    selectedSlot = (await slot.getAttribute('aria-pressed')) === 'true';
  }
  if (await city.count()) {
    const option = await city.locator('option').nth(1).getAttribute('value');
    if (option) {
      await city.selectOption(option);
      cityValue = option;
    }
  }
  if (await map.count()) {
    await page.waitForTimeout(400);
    mapCamera = {
      zoom: await map.getAttribute('data-map-zoom'),
      center: await map.getAttribute('data-map-center'),
    };
  }
  const pageTab = playerUi(page).locator(
    '.pg-page-nav button[aria-current="page"]',
  );
  const tabLabel = (await pageTab.count()) ? await pageTab.innerText() : null;
  for (const next of ['portrait', 'wide', 'portrait', 'wide'])
    await mode(page, next);
  assert.equal(await child.evaluate(() => window.__displayDocument), marker);
  assert.equal(await page.locator('iframe[data-player-frame]').count(), 1);
  if (mapCamera) {
    await page.waitForTimeout(100);
    assert.equal(
      await map.getAttribute('data-map-zoom'),
      mapCamera.zoom,
      'Map zoom reset during display switch',
    );
    const actual = (await map.getAttribute('data-map-center'))
      .split(',')
      .map(Number);
    const expected = mapCamera.center.split(',').map(Number);
    assert.ok(
      actual.every(
        (value, index) => Math.abs(value - expected[index]) < 0.000001,
      ),
      'Map center reset during display switch',
    );
  }
  if (numberValue !== undefined)
    assert.equal(await number.inputValue(), numberValue);
  if (selectedSlot)
    assert.equal(await slot.getAttribute('aria-pressed'), 'true');
  if (cityValue !== undefined) assert.equal(await city.inputValue(), cityValue);
  if (tabLabel !== null) assert.equal(await pageTab.innerText(), tabLabel);
  assert.equal(
    (await view(token)).revision,
    before.revision,
    'Layout switch must not submit an action',
  );
  const credential = await child.evaluate(() =>
    localStorage.getItem('tablemax-player'),
  );
  assert.equal(credential, token);
  assert.equal(
    page.__displayConnections,
    connections,
    'Display switching reopened the player Socket.IO connection',
  );
  await checked(
    `${label}: same document, credential, revision and available number/slot/city/page draft`,
  );
}
async function deviceChecks(token) {
  const definitions = [
    {
      name: 'touch-windows',
      desktop: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
      touch: 10,
    },
    {
      name: 'desktop-ipad',
      desktop: false,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15',
      platform: 'MacIntel',
      touch: 5,
    },
    {
      name: 'android-landscape',
      desktop: false,
      userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile',
      platform: 'Linux armv8l',
      touch: 5,
    },
    {
      name: 'unknown-platform',
      desktop: false,
      userAgent: 'Unknown',
      platform: '',
      touch: 0,
    },
  ];
  for (const device of definitions) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      hasTouch: device.touch > 0,
      userAgent: device.userAgent,
    });
    await context.addInitScript(
      ({ device, token }) => {
        Object.defineProperty(navigator, 'userAgentData', { value: undefined });
        Object.defineProperty(navigator, 'platform', {
          value: device.platform,
        });
        Object.defineProperty(navigator, 'maxTouchPoints', {
          value: device.touch,
        });
        localStorage.setItem('tablemax-player', token);
      },
      { device, token },
    );
    const page = await context.newPage();
    await page.goto(origin);
    await rendered(page, await view(token));
    assert.equal(
      await page.locator('.player-frame__display').count(),
      device.desktop ? 1 : 0,
    );
    assert.equal(
      await page.locator('.player-frame').getAttribute('data-player-display'),
      device.desktop ? 'portrait' : 'mobile',
    );
    await page.screenshot({ path: join(output, device.name + '.png') });
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  await context.addInitScript((token) => {
    localStorage.setItem('tablemax-player', token);
    localStorage.setItem('tablemax-player-display-mode', 'damaged');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tablemax-player-display-mode')
        throw new Error('blocked preference');
      original.call(this, key, value);
    };
  }, token);
  const page = await context.newPage();
  await page.goto(origin);
  await rendered(page, await view(token));
  await mode(page, 'wide');
  await mode(page, 'portrait');
  await context.close();
  await checked(
    'Touch Windows, desktop-UA iPad, Android landscape, absent Client Hints/unknown platform and corrupt/blocked preference',
  );
}
async function layouts(page, name, token, full) {
  const before = await view(token);
  for (const next of ['portrait', 'wide'])
    for (const size of full
      ? [
          [1280, 720],
          [1920, 1080],
          [3840, 2160],
          [1007, 768],
          [1008, 768],
          [1247, 900],
          [1248, 900],
        ]
      : [[1280, 720]])
      await geometry(page, name, size, next);
  if (full) {
    const cdp = await page.context().newCDPSession(page);
    for (const scale of [1.25, 1.5]) {
      const size = [Math.round(1920 / scale), Math.round(1080 / scale)];
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: size[0],
        height: size[1],
        deviceScaleFactor: scale,
        mobile: false,
      });
      await geometry(page, `${name}-scale-${scale}`, size, 'wide');
      await capture(page, `${name}-scale-${scale}`);
    }
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await cdp.detach();
    for (const width of [320, 360, 390, 430, 799])
      await geometry(page, name, [width, 844], 'wide');
    await page.setViewportSize({ width: 800, height: 844 });
    await mode(page, 'wide');
    await page.setViewportSize({ width: 799, height: 844 });
    await playerUi(page)
      .locator('html[data-player-display="mobile"]')
      .waitFor();
    await page.setViewportSize({ width: 1280, height: 720 });
    await playerUi(page).locator('html[data-player-display="wide"]').waitFor();
  }
  assert.equal((await view(token)).revision, before.revision);
  await stableDraft(page, token, name);
}
async function pageControls(page, name, token) {
  await mode(page, 'wide');
  const ui = playerUi(page);
  const tabs = ui.locator('.pg-page-nav button');
  if (await tabs.count()) {
    for (let index = 0; index < 4; index++) {
      await tabs.nth(index).click();
      const states = await (
        await playerFrame(page)
      ).evaluate(() =>
        [...document.querySelectorAll('.pg-phone-page')].map((element) => ({
          hidden: element.hidden,
          inert: element.inert,
          display: getComputedStyle(element).display,
        })),
      );
      assert.equal(states.filter((state) => !state.hidden).length, 1);
      assert.ok(
        states.every(
          (state) => !state.hidden || (state.inert && state.display === 'none'),
        ),
      );
      await stableDraft(page, token, `${name}-page-${index}`);
      await capture(page, `${name}-page-${index}`);
    }
    await tabs.first().click();
  }
  const rules = ui.getByRole('button', { name: /^(规则|玩法)$/ }).first();
  if (await rules.count()) {
    await checked(`${name}: opening rule dialog`);
    await rules.click({ timeout: 15000 });
    const dialog = ui.getByRole('dialog').first();
    await dialog.waitFor({ timeout: 15000 });
    const marker = randomUUID();
    await dialog.evaluate((element, value) => {
      element.dataset.displayProbe = value;
    }, marker);
    for (const next of ['portrait', 'wide']) {
      await mode(page, next);
      assert.equal(await dialog.getAttribute('data-display-probe'), marker);
      await capture(page, `${name}-rules-${next}`);
    }
    const child = await playerFrame(page);
    await dialog.evaluate((element) => {
      (element.querySelector('.dialog-surface') ?? element).scrollTop = 150;
    });
    const scrollable = await dialog.evaluate((element, value) => {
      const owner = [element, ...element.querySelectorAll('*')].find(
        (candidate) =>
          candidate.scrollHeight > candidate.clientHeight + 40 &&
          /auto|scroll/.test(getComputedStyle(candidate).overflowY),
      );
      if (!owner) return false;
      owner.dataset.scrollProbe = value;
      owner.tabIndex = 0;
      owner.scrollTop = 0;
      return true;
    }, marker);
    if (scrollable) {
      const owner = ui.locator(`[data-scroll-probe="${marker}"]`);
      await owner.press('PageDown');
      await page.waitForTimeout(150);
      assert.ok(
        await owner.evaluate((element) => element.scrollTop > 0),
        'Keyboard does not scroll dialog',
      );
      await owner.evaluate((element) => {
        element.scrollTop = 0;
      });
      const box = await owner.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(200);
      assert.ok(
        await owner.evaluate((element) => element.scrollTop > 0),
        'Wheel does not scroll dialog',
      );
      await owner.evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.mouse.move(box.x + box.width - 5, box.y + 12);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width - 5,
        box.y + Math.min(150, box.height / 2),
        { steps: 8 },
      );
      await page.mouse.up();
      await page.waitForTimeout(150);
      assert.ok(
        await owner.evaluate((element) => element.scrollTop > 0),
        'Native scrollbar drag does not scroll dialog',
      );
      await checked(
        `${name}: real keyboard, wheel and native scrollbar drag scroll the rule dialog`,
      );
    }
    await page.emulateMedia({ forcedColors: 'active' });
    assert.equal(
      await child.evaluate(
        () => getComputedStyle(document.documentElement).scrollbarColor,
      ),
      'auto',
    );
    await capture(page, `${name}-rules-high-contrast`);
    await page.emulateMedia({ forcedColors: 'none' });
    await dialog.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await checked(
      `${name}: same rule dialog through mode switching; system high-contrast scrollbar colors`,
    );
  }
}
try {
  desktop = await launchDesktop({
    executablePath: join(portable, 'TableMax.exe'),
    env: {
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_DATA_DIR: join(work, 'data'),
    },
  });
  const host = await desktop.firstWindow();
  await host.locator('[data-room-revision]').waitFor();
  origin = new URL(host.url()).origin;
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  hostSocket = await connect(hostToken);
  browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
    ignoreDefaultArgs: ['--hide-scrollbars'],
  });
  const catalog = (await view()).catalog;
  for (const game of catalog.filter(
    (game) => !onlyGame || game.id === onlyGame,
  ))
    for (const variant of game.id === 'pokemon-encounters'
      ? scrollOnly
        ? ['original']
        : ['original', 'expansion']
      : [null])
      for (const count of quick || scrollOnly
        ? [scrollOnly ? game.min : game.max]
        : [...new Set([game.min, game.max])]) {
        if ((await view()).status === 'playing') await command({ type: 'end' });
        await command({ type: 'new-room' });
        await command({ type: 'select-game', gameId: game.id });
        if (variant)
          await command({ type: 'select-variant', variantId: variant });
        const humans = [];
        for (let i = 0; i < count; i++) {
          const reply = await post('/api/session/join', {
            name: i === 0 ? '横屏测试玩家' : `朋友${i + 1}`,
            requestKey: randomBytes(32).toString('hex'),
          });
          assert.equal(reply.ok, true);
          const client = await connect(reply.token);
          humans.push({ token: reply.token, client });
          await command({ type: 'ready', ready: true }, reply.token, client);
        }
        const page = await open(humans[0].token);
        const name = `${game.id}-${variant ?? 'default'}-${count}`;
        await layouts(page, name + '-box', humans[0].token, !quick);
        if (
          !quick &&
          report.checks.every((label) => !label.startsWith('Touch Windows'))
        ) {
          await deviceChecks(humans[0].token);
          await mode(page, 'wide');
          await page.reload();
          await playerUi(page)
            .locator('html[data-player-display="wide"]')
            .waitFor();
          await page.locator('.player-frame__display').focus();
          await page.keyboard.press('Space');
          await playerUi(page)
            .locator('html[data-player-display="portrait"]')
            .waitFor();
          await mode(page, 'wide');
          await checked(
            'Reload remembers wide preference; keyboard Space toggles the named display button',
          );
        }
        await command({ type: 'start' });
        await playerUi(page)
          .locator('.pokemon-screen, .expansion-screen, .ma-screen, .pg-screen')
          .first()
          .waitFor();
        const module = createRequire(import.meta.url)(
          join(portable, `bots/${game.id}.cjs`),
        );
        const bot = module.botsByVariant?.[variant] ?? module.bot;
        const memories = new Map(),
          seen = new Set(),
          bufferActions = new Set();
        const wanted =
          game.id === 'power-grid'
            ? ['regions', 'auction', 'resources', 'building', 'powering']
            : game.id === 'modern-art'
              ? ['offer', 'auction', 'round-result']
              : variant === 'expansion'
                ? [
                    'research-vote',
                    'initial-flip',
                    'draw',
                    'place',
                    'round-result',
                  ]
                : ['initial-flip', 'draw', 'place', 'round-result'];
        for (let step = 0; step < (quick ? 35 : 1800); step++) {
          const views = await Promise.all(humans.map((h) => view(h.token)));
          const actor = views.findIndex((state) => state.actions.length),
            index = Math.max(0, actor),
            state = views[index],
            phase = state.gameView.phase;
          const label =
            phase === 'auction' && state.gameView.auction
              ? `auction-${state.gameView.auction.kind ?? 'plants'}`
              : phase;
          const current =
            pages.find((p) => p.__displayToken === humans[index].token) ??
            (await open(humans[index].token));
          current.__displayToken = humans[index].token;
          await rendered(current, state);
          await playerUi(current)
            .locator(
              '.pokemon-screen, .expansion-screen, .ma-screen, .pg-screen',
            )
            .first()
            .waitFor();
          if (!seen.has(label)) {
            seen.add(label);
            await layouts(
              current,
              name + '-' + label,
              humans[index].token,
              !quick && seen.size === 1,
            );
            if (!quick && seen.size === 1)
              await pageControls(current, name, humans[index].token);
          }
          if (scrollOnly) break;
          if (
            (quick && seen.size >= (variant === 'expansion' ? 4 : 3)) ||
            (!quick &&
              (wanted.every(
                (p) =>
                  seen.has(p) ||
                  (p === 'auction' &&
                    [...seen].some((p) => p.startsWith('auction'))),
              ) ||
                ['round-result', 'match-result', 'ended'].includes(phase)))
          )
            break;
          if (actor < 0) break;
          const human = humans[actor];
          const chosen = await bot.decide({
            view: state.gameView,
            actions: state.actions,
            decision: { id: state.decisionId, seatId: state.self.seatId },
            memory: memories.get(human.token) ?? null,
            difficulty: 'default',
            random: { next: Math.random },
            signal: new AbortController().signal,
          });
          if (variant === 'expansion') {
            const buffer = state.actions.find(
              (action) =>
                ['store-buffer', 'draw-buffer'].includes(action.type) &&
                !bufferActions.has(action.type),
            );
            if (buffer) {
              chosen.action = buffer;
              bufferActions.add(buffer.type);
              await stableDraft(
                current,
                human.token,
                `${name}-${buffer.type}-draft`,
              );
              await capture(current, `${name}-${buffer.type}-draft`);
            }
          }
          // Safely dispose any UI-only draft before advancing with an authorized action.
          memories.set(human.token, chosen.memory);
          await command(
            {
              type: 'game',
              decisionId: state.decisionId,
              action: chosen.action,
            },
            human.token,
            human.client,
          );
        }
        await checked(`${name}: authorized phases ${[...seen].join(', ')}`);
        if (variant === 'expansion')
          await checked(
            `${name}: authorized buffer operations ${[...bufferActions].join(', ') || 'not offered before this scenario ended'}`,
          );
        for (const page of pages.splice(0)) await page.context().close();
        for (const human of humans) human.client.disconnect();
      }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = String(error.stack ?? error);
  if (pages.at(-1))
    await pages
      .at(-1)
      .screenshot({ path: join(output, 'failure.png') })
      .catch(() => {});
  throw error;
} finally {
  for (const socket of sockets) socket.disconnect();
  await browser?.close();
  await desktop?.close();
  await save();
}
