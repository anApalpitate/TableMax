import {
  captureBrowserScreenshot,
  captureBrowserMatrixScreenshot,
} from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launchDesktop } from '../support/desktop-test.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { playerFrame, playerUi } from '../support/player-test.mjs';
import {
  extractCurrentDelivery,
  materializePokemonClients,
} from '../support/shipping-input.mjs';

const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const source = process.argv.includes('--source');
const quick = process.argv.includes('--quick');
const scrollOnly = process.argv.includes('--scroll-only');
const visualAudit = process.argv.includes('--visual-audit');
const resultCssDiagnostic = process.argv.includes('--result-css-diagnostic');
const onlyAuditPhase = argument('audit-phase');
const auditMin = process.argv.includes('--audit-min');
const onlyVariant = argument('variant');
const onlyGame = argument('game');
assert.ok(
  !onlyGame ||
    ['pokemon-encounters', 'modern-art', 'power-grid'].includes(onlyGame),
);
const evidence = argument('evidence') ?? `run-${Date.now()}`;
assert.match(evidence, /^[a-z0-9-]+$/);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const output = resolve(
  visualAudit
    ? `artifacts/maintenance/v${version}/network-adaptation/game-audit`
    : `artifacts/maintenance/v${version}/player-display`,
  evidence,
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
// Existing audited temporary prefix: no new cleanup exclusion or deletion path.
const work = await mkdtemp(resolve('tmp/debug-portable-'));
let portable = resolve('build/desktop');
let delivery, packagedPokemon;
const report = {
  version,
  status: 'running',
  source,
  quick,
  scrollOnly,
  visualAudit,
  resultCssDiagnostic,
  onlyAuditPhase: onlyAuditPhase ?? null,
  auditMin,
  onlyVariant: onlyVariant ?? null,
  onlyGame: onlyGame ?? null,
  scope:
    'Muted hidden WinForms/WebView2 and headless Edge; authorized real server state, CSS viewport and device emulation. No physical hardware DPI or phone claim.',
  checks: [],
  layouts: [],
  screenshots: [],
  audits: [],
  errors: [],
};
if (!source) {
  delivery = await extractCurrentDelivery({
    work,
    expectedSha256: argument('sha256'),
  });
  portable = delivery.extracted;
  if (onlyGame === 'pokemon-encounters')
    packagedPokemon = await materializePokemonClients(
      delivery,
      work,
      join(work, 'module-probe'),
    );
  report.binding = delivery.binding;
  report.packageBytes = {
    executable: delivery.binding.executableBytes,
    payload: delivery.binding.payloadBytes,
    extracted: delivery.binding.extractedBytes,
  };
}
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const sockets = [];
const pages = [];
let desktop, browser, origin, hostToken, hostSocket, auditHost, auditPublic;
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
  page.__displayMobile = contextOptions.isMobile === true;
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
  const screenshot = await captureBrowserMatrixScreenshot(
    page,
    { path: join(output, name + '.png'), fullPage: true },
    { state: name },
  );
  report.screenshots.push(screenshot.path);
}
async function markerGeometry(frame, name) {
  const markers = await frame.evaluate(() =>
    [...document.querySelectorAll('.pokemon-screen .zero-column-badge')].map(
      (badge) => {
        const slot = badge.closest('.card-slot');
        const surface = slot
          .querySelector('.card-surface')
          .getBoundingClientRect();
        const rect = badge.getBoundingClientRect();
        return {
          label: badge.getAttribute('aria-label'),
          column: Number(badge.parentElement.firstChild.textContent),
          font: parseFloat(getComputedStyle(badge).fontSize),
          rect: [rect.x, rect.y, rect.width, rect.height],
          visible: rect.width > 0 && rect.height > 0,
          belowCard: rect.top >= surface.bottom - 1,
        };
      },
    ),
  );
  for (const marker of markers.filter((value) => value.visible)) {
    assert.ok(
      marker.font >= 16,
      `${name}: zero-column marker text is too small`,
    );
    assert.ok(
      marker.belowCard,
      `${name}: zero-column marker overlaps the card`,
    );
    assert.equal(
      marker.label.replace(/\s+/g, ''),
      `第${marker.column}列同值归零`,
      `${name}: zero marker must retain its column association`,
    );
  }
  return markers;
}
async function resultGeometry(frame, name) {
  const measure = () =>
    frame.evaluate(() => {
      const banner = document.querySelector(
        '[data-player-display="wide"] .pokemon-screen.player .result-table > .round-banner',
      );
      if (!banner || innerWidth < 960 || document.querySelector('dialog[open]'))
        return null;
      window.scrollTo({ top: 0, behavior: 'instant' });
      const bounds = (element) => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      const rect = bounds(banner);
      const table = getComputedStyle(banner.parentElement);
      const board = bounds(banner.parentElement.querySelector('.game-seats'));
      const recent = bounds(
        banner.parentElement.querySelector(':scope > .action-announcement'),
      );
      const content = [...banner.querySelectorAll('h2,p,button:not(:disabled)')]
        .map((element) => ({
          text: element.textContent?.trim(),
          ...bounds(element),
        }))
        .filter((element) => element.bottom > element.top);
      const legalButtons = [
        ...banner.querySelectorAll('button:not(:disabled)'),
      ].map((button) => {
        const r = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        return {
          text: button.textContent?.trim(),
          reachable: hit === button || button.contains(hit),
        };
      });
      return {
        viewport: [innerWidth, innerHeight],
        rect,
        board,
        recent,
        content,
        legalButtons,
        grid: {
          rows: table.gridTemplateRows,
          rowGap: table.rowGap,
          alignContent: table.alignContent,
          height: table.height,
          minHeight: table.minHeight,
          bannerAlign: getComputedStyle(banner).alignSelf,
          recentAlign: getComputedStyle(
            banner.parentElement.querySelector(':scope > .action-announcement'),
          ).alignSelf,
        },
      };
    });
  let result = await measure();
  if (!result) return null;
  const gapValid = () =>
    result.recent.top >= result.rect.bottom - 1 &&
    result.recent.top - result.rect.bottom <= 24;
  const record = async (stage) => {
    const screenshot = `${name}-result-geometry-${stage}.png`;
    await captureBrowserScreenshot(frame.page(), {
      path: join(output, screenshot),
      fullPage: false,
    });
    report.screenshots.push(screenshot);
    (report.resultDiagnostics ??= []).push({
      name,
      stage,
      screenshot,
      ...result,
    });
    await save();
  };
  if (!gapValid()) {
    await record('package');
    if (resultCssDiagnostic) {
      await frame.evaluate(() => {
        document.styleSheets[0].insertRule(
          `@media (min-width:960px) {
          [data-player-display='wide'] .pokemon-screen.player .game-table.result-table[data-seats][data-layout] > .action-announcement {
            grid-column: 1 !important;
            grid-row: 2 !important;
            align-self: start !important;
            width: 100% !important;
            margin: 0 !important;
          }
        }`,
          document.styleSheets[0].cssRules.length,
        );
      });
      await frame.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      result = await measure();
      await record('candidate-css-not-package-proof');
    }
  }
  const visible = (r) =>
    r.top >= 0 &&
    r.left >= 0 &&
    r.bottom <= result.viewport[1] + 1 &&
    r.right <= result.viewport[0] + 1;
  assert.ok(
    visible(result.rect) && result.content.every(visible),
    `${name}: full result banner text and legal continuation must be in the first screen`,
  );
  assert.ok(
    result.rect.right <= result.board.left + 1,
    `${name}: result banner cannot overlap the player board`,
  );
  assert.ok(
    visible(result.recent) && result.recent.right <= result.board.left + 1,
    `${name}: latest saved result must be fully visible beside the player board`,
  );
  assert.ok(
    gapValid(),
    `${name}: latest saved result must sit within 24px below the winner banner`,
  );
  assert.ok(
    result.legalButtons.every((button) => button.reachable),
    `${name}: legal continuation must be reachable without scrolling`,
  );
  return result;
}
async function geometry(page, name, size, next) {
  await page.setViewportSize({ width: size[0], height: size[1] });
  if (size[0] >= 800 && !page.__displayMobile) await mode(page, next);
  else {
    await page
      .locator('main.player-frame[data-player-display="mobile"]')
      .waitFor();
    await playerUi(page)
      .locator('html[data-player-display="mobile"]')
      .waitFor();
  }
  const child = await playerFrame(page);
  await child.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
  });
  await markerGeometry(child, name);
  await operationGeometry(page, child, name);
  const resultHero = await resultGeometry(child, name);
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
    cityLocators: document.querySelectorAll('select[aria-label="选择城市"]')
      .length,
    sprites: [...document.querySelectorAll('.pg-plant-art__sprite')]
      .map((e) => {
        const r = e.getBoundingClientRect();
        return [r.width, r.height];
      })
      .filter(([w, h]) => w && h),
    progressPages: [...document.querySelectorAll('.pg-game-progress')].map(
      (e) => e.closest('[data-phone-page]')?.getAttribute('data-phone-page'),
    ),
    seats: [...document.querySelectorAll('.room-table__seat')].map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
    auctionCore: [
      ...document.querySelectorAll(
        '.ma-auction__paintings > .ma-card,.ma-theme > strong,.ma-theme__price-tag,.ma-bid button[type="submit"],.ma-controls__simple button:not(:disabled)',
      ),
    ]
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { bottom: r.bottom, top: r.top, height: r.height };
      })
      .filter((r) => r.height),
    frameCount: document.querySelectorAll('iframe[data-player-frame]').length,
  }));
  metrics.resultHero = resultHero;
  if (metrics.overflow > 2) {
    metrics.overflowElements = await child.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            class: element.className,
            text: element.textContent?.trim().slice(0, 100),
            left: rect.left,
            right: rect.right,
          };
        })
        .filter((rect) => rect.right > innerWidth + 1 || rect.left < -1)
        .slice(0, 25),
    );
    report.layouts.push({ name, size, next, ...metrics });
    await capture(page, `${name}-${size.join('-')}-${next}-overflow`);
  }
  assert.ok(
    metrics.overflow <= 2,
    `${name} ${size}/${next}: overflow ${metrics.overflow}`,
  );
  if (
    next === 'wide' &&
    metrics.width >= 960 &&
    metrics.height >= 680 &&
    (name.includes('auction') || name.includes('double'))
  )
    assert.ok(
      metrics.auctionCore.every(
        (r) => r.top >= 0 && r.bottom <= metrics.height,
      ),
      name + ': painting, price and main action must be fully visible',
    );
  if (await child.locator('.pg-screen--player').count()) {
    assert.equal(
      metrics.cityLocators,
      0,
      'Player must not have host city locator',
    );
    assert.ok(
      metrics.progressPages.every((p) => p === '0'),
      'Player progress belongs only to action page',
    );
    assert.ok(
      metrics.sprites.every(([w, h]) => Math.abs(w - h) < 1),
      'Plant sprite must stay square',
    );
  }
  for (let i = 0; i < metrics.seats.length; i++)
    for (let j = i + 1; j < metrics.seats.length; j++) {
      const a = metrics.seats[i],
        b = metrics.seats[j];
      assert.ok(
        Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) <= 1 ||
          Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) <= 1,
        'Seat cards overlap',
      );
    }
  const frame = await page.locator('iframe[data-player-frame]').boundingBox();
  assert.ok(frame.width <= size[0] && frame.height <= size[1]);
  if (size[0] >= 800 && !page.__displayMobile) {
    const control = await page.locator('.player-frame__display').boundingBox();
    assert.equal(control.width, 48);
    assert.equal(control.height, 48);
    assert.ok(
      control.x >= frame.x + frame.width ||
        control.y + control.height <= frame.y,
      'Display control overlaps player UI',
    );
    assert.equal(metrics.mode, next);
    if (next === 'portrait')
      assert.ok(
        frame.width >= 390 && frame.width <= 480,
        'Portrait readable width',
      );
    if (next === 'wide')
      assert.ok(frame.y <= 17, 'Wide frame must not reserve a toggle row');
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
  const cityId = before.gameView?.buildOptions?.[0]?.cityId;
  const city = cityId ? map.locator(`[data-city="${cityId}"]`) : null;
  const progress = playerUi(page).locator('details.pg-game-progress:visible');
  const sort = playerUi(page).locator('.ma-hand-tools select').first();
  let numberValue,
    cityValue,
    sortValue,
    progressOpen,
    selectedSlot = false;
  if (await number.count()) {
    await number.fill('7');
    numberValue = await number.inputValue();
    await number.evaluate((node, value) => {
      node.__displayDraft = value;
    }, marker);
  }
  if (await slot.count()) {
    await slot.click();
    selectedSlot = (await slot.getAttribute('aria-pressed')) === 'true';
    await slot.evaluate((node, value) => {
      node.__displayDraft = value;
    }, marker);
  }
  if (city && (await city.count())) {
    await city.press('Enter');
    cityValue = await city.getAttribute('aria-pressed');
    assert.equal(cityValue, 'true');
  }
  if (await progress.count()) {
    if ((await progress.getAttribute('open')) === null)
      await progress.locator('summary').click();
    progressOpen = await progress.getAttribute('open');
    assert.equal(
      progressOpen,
      '',
      'Progress disclosure must open after editing a draft',
    );
    await progress.evaluate((node, value) => {
      node.__displayDraft = value;
    }, marker);
  }
  if (await sort.count()) {
    const option = await sort.locator('option').last().getAttribute('value');
    await sort.selectOption(option);
    sortValue = await sort.inputValue();
    await sort.evaluate((node, value) => {
      node.__displayDraft = value;
    }, marker);
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
  if (numberValue !== undefined) {
    assert.equal(await number.inputValue(), numberValue);
    assert.equal(
      await number.evaluate((node) => node.__displayDraft),
      marker,
      'Input node remounted',
    );
  }
  if (selectedSlot)
    assert.equal(await slot.getAttribute('aria-pressed'), 'true');
  if (cityValue !== undefined)
    assert.equal(await city.getAttribute('aria-pressed'), cityValue);
  if (progressOpen !== undefined) {
    assert.equal(await progress.getAttribute('open'), progressOpen);
    assert.equal(
      await progress.evaluate((node) => node.__displayDraft),
      marker,
    );
  }
  if (sortValue !== undefined) {
    assert.equal(await sort.inputValue(), sortValue);
    assert.equal(await sort.evaluate((node) => node.__displayDraft), marker);
  }
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
    await captureBrowserScreenshot(page, {
      path: join(output, device.name + '.png'),
    });
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
          [1366, 768],
          [1920, 1080],
          [3840, 2160],
          [1055, 768],
          [1056, 768],
          [1295, 900],
          [1296, 900],
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
  if (before.gameView?.rulesProfile === 'events-research-v3') {
    const phone = await phonePage(token);
    for (const [orientation, size] of [
      ['portrait', [390, 844]],
      ['landscape', [844, 390]],
    ])
      await geometry(phone, `${name}-phone-${orientation}`, size, 'mobile');
    assert.equal((await view(token)).revision, before.revision);
  }
}
async function phonePage(token) {
  return (
    pages.find(
      (page) => page.__displayToken === token && page.__displayMobile,
    ) ??
    open(token, {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    })
  );
}
/** Record actual rendered operation heights and unobstructed touch points. */
async function operationGeometry(page, frame, name) {
  const buttons = frame.locator(
    '.expansion-screen.player .ex-actions button:enabled:visible',
  );
  const records = [];
  for (const button of await buttons.all()) {
    await button.scrollIntoViewIfNeeded();
    const record = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const card =
        element.classList.contains('card-slot') ||
        element.classList.contains('ex-source');
      let naturalHeight = null;
      if (!card) {
        const probe = element.cloneNode(true);
        Object.assign(probe.style, {
          position: 'fixed',
          visibility: 'hidden',
          pointerEvents: 'none',
          width: `${rect.width}px`,
          flex: 'none',
          alignSelf: 'start',
        });
        probe.style.setProperty('height', 'auto', 'important');
        probe.style.setProperty('min-height', '0', 'important');
        probe.style.setProperty('max-height', 'none', 'important');
        element.parentElement.append(probe);
        naturalHeight = probe.getBoundingClientRect().height;
        probe.remove();
      }
      const hitDetails = [];
      const points = [
        [0.5, 0.5],
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ].map(([x, y]) => {
        const hit = document.elementFromPoint(
          rect.x + rect.width * x,
          rect.y + rect.height * y,
        );
        hitDetails.push(
          hit
            ? {
                tag: hit.tagName,
                className: hit.className,
                label: hit.getAttribute('aria-label'),
              }
            : null,
        );
        return hit === element || element.contains(hit);
      });
      return {
        action: element.dataset.action ?? null,
        name: element.getAttribute('aria-label') ?? element.textContent?.trim(),
        rect: [rect.x, rect.y, rect.width, rect.height],
        naturalHeight,
        font: parseFloat(style.fontSize),
        points,
        hitDetails,
      };
    });
    records.push(record);
  }
  (report.buttonGeometry ??= []).push({
    name,
    mobile: page.__displayMobile === true,
    records,
  });
  await save();
  for (const record of records) {
    assert.ok(
      record.font >= 18,
      `${name}: ${record.name} primary operation text is below 18px`,
    );
    assert.ok(
      record.rect[2] >= 44 && record.rect[3] >= 44,
      `${name}: ${record.name} touch target is below 44px`,
    );
    assert.ok(
      record.points.every(Boolean),
      `${name}: ${record.name} has an obscured touch point`,
    );
    if (record.naturalHeight !== null)
      assert.ok(
        record.rect[3] <= Math.max(48, record.naturalHeight) + 2,
        `${name}: ${record.name} stretched from natural ${record.naturalHeight}px to ${record.rect[3]}px`,
      );
  }
  return records;
}
async function prepareExpansionAction(page, state, action) {
  const ui = playerUi(page);
  const type = action.type;
  if (type === 'vote-research')
    return ui.locator(
      `[data-action="vote-research"][data-research="${action.taskId}"]`,
    );
  if (type === 'draw')
    return ui.locator(
      `[data-action="draw"][data-source="${action.source}"]${action.source === 'discard' ? `[data-discard-index="${action.discardIndex}"]` : ''}`,
    );
  if (type === 'mewtwo-exchange')
    return ui.locator(
      `[data-action="mewtwo-exchange"][data-slot-index="${action.slot}"]`,
    );
  if (
    type === 'reposition' &&
    !(await ui.locator('.ex-reposition-source').getAttribute('class')).includes(
      'selected',
    )
  )
    await ui.locator('.ex-reposition-source').click();
  if (action.seat)
    await ui.locator(`[data-target-seat="${action.seat}"]`).click();
  const slotIndexes =
    'a' in action
      ? [action.a, action.b]
      : 'slot' in action
        ? [action.slot]
        : [];
  if (slotIndexes.length) {
    const board = ui.locator('.ex-target-board .pokemon-board');
    const selectedSlots = await board
      .locator('button[aria-pressed="true"]')
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute('data-slot')),
      );
    for (const slot of selectedSlots)
      await board.locator(`button[data-slot="${slot}"]`).click();
    for (const index of slotIndexes) {
      const slotId =
        state.gameView.boards[action.seat ?? state.self.seatId][index].slotId;
      await board.locator(`button[data-slot="${slotId}"]`).click();
    }
    if (type === 'ninja-target')
      await ui
        .locator('.ex-branch button')
        .nth(action.swap ? 1 : 0)
        .click();
  }
  const button = ui
    .locator(
      `[data-action="${type}"]${action.direction ? `[data-direction="${action.direction}"]` : ''}`,
    )
    .filter({ visible: true });
  return (await button.count()) === 1 ? button : null;
}
async function clickExpansionAction(page, state, action, label) {
  const type = action.type;
  const button = await prepareExpansionAction(page, state, action);
  if (!button) return false;
  await operationGeometry(page, await playerFrame(page), label);
  const before = state.revision;
  await button.click();
  const deadline = Date.now() + 10000;
  let after;
  do {
    after = await view(page.__displayToken);
    if (after.revision > before) break;
    await page.waitForTimeout(50);
  } while (Date.now() < deadline);
  assert.ok(
    after.revision > before,
    `${label}: a real click must save the authorized action`,
  );
  await rendered(page, after);
  const saved = after.gameView.events.findLast((event) => event.action);
  const verb =
    type === 'ninja-target'
      ? action.swap
        ? 'ninja-swap'
        : 'ninja-cover'
      : type;
  assert.equal(
    saved?.action?.verb,
    verb,
    `${label}: clicked action did not match its saved public record`,
  );
  if (type === 'mewtwo-target') {
    assert.ok(
      'slot' in action && !('a' in action),
      'v3 Mewtwo target must have a single slot',
    );
    assert.equal(
      after.gameView.peek?.cards.length,
      1,
      'v3 Mewtwo must reveal exactly one authorized card',
    );
  }
  (report.actionsClicked ??= []).push({
    label,
    type,
    mobile: page.__displayMobile === true,
    viewport: page.viewportSize(),
    revision: after.revision,
  });
  await save();
  return true;
}
async function expansionDraftMatrix(page, state, action, name) {
  const phone = await phonePage(page.__displayToken);
  await rendered(phone, state);
  const records = [];
  for (const [client, display, width, height] of [
    [page, 'portrait', 1280, 720],
    [page, 'wide', 1280, 720],
    [phone, 'mobile', 390, 844],
    [phone, 'mobile', 844, 390],
  ]) {
    await client.setViewportSize({ width, height });
    if (client === page) await mode(client, display);
    const button = await prepareExpansionAction(client, state, action);
    if (!button) return;
    await button.scrollIntoViewIfNeeded();
    await operationGeometry(
      client,
      await playerFrame(client),
      `${name}-${display}-${width}-draft`,
    );
    assert.equal(
      (await view(page.__displayToken)).revision,
      state.revision,
      `${name}: selecting a target must stay local until confirmation`,
    );
    if (action.type === 'mewtwo-target') {
      assert.equal(
        await playerUi(client)
          .locator('.ex-target-board button[aria-pressed="true"]')
          .count(),
        1,
      );
      assert.match(await button.innerText(), /查看这一张牌/);
    }
    records.push({
      display,
      width,
      height,
      mobile: client.__displayMobile === true,
    });
    await capture(client, `${name}-${display}-${width}-draft`);
  }
  (report.actionDrafts ??= []).push({
    name,
    type: action.type,
    matrix: records,
  });
  await save();
}
async function expansionWeatherGeometry(page, state, name) {
  if (state.gameView.rulesProfile !== 'events-research-v3') return;
  const ui = playerUi(page);
  const expected = Object.values(state.gameView.boards)
    .flat()
    .filter((slot) => slot.card?.scoreEffect);
  const faces = [];
  for (const slot of expected) {
    const stack = ui
      .locator(`[data-slot="${slot.slotId}"] .ex-value-stack`)
      .filter({ visible: true })
      .first();
    if (!(await stack.count())) continue;
    const renderedValue = await stack.getAttribute('data-effective-value');
    assert.equal(Number(renderedValue), slot.card.effectiveValue);
    assert.equal(
      await stack.getAttribute('data-score-effect'),
      slot.card.scoreEffect.kind,
    );
    const card = stack
      .locator(
        'xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," ex-card ")]',
      )
      .first();
    const background = await card
      .locator('.card-value')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    if (slot.card.scoreEffect.kind === 'rain')
      assert.equal(
        background,
        'rgb(215, 237, 249)',
        'Rain score badge must use the pale blue effect background',
      );
    if (slot.card.scoreEffect.inherited)
      assert.match(await stack.getAttribute('aria-label'), /复制继承/);
    faces.push({
      slot: slot.slotId,
      effectiveValue: slot.card.effectiveValue,
      source: await stack.getAttribute('aria-label'),
      background,
      inherited: slot.card.scoreEffect.inherited === true,
    });
  }
  assert.equal(
    await ui.locator('.ex-public-buffers').count(),
    0,
    'Public supply must not list player buffers',
  );
  (report.weatherGeometry ??= []).push({
    name,
    kind: state.gameView.currentEvent?.kind ?? null,
    faces,
    authorizedWeatherFaces: expected.length,
    renderedWeatherFaces: faces.length,
  });
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
// This audit records real authorized pages and reachable controls. Scrollable
// content below the fold is reviewed separately from clipping or occlusion.
async function auditSnapshot(page, ui, frame, name) {
  await frame.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((image) => image.complete)
        .map((image) => image.decode().catch(() => {})),
    );
  });
  const resultHero = await resultGeometry(frame, name);
  await operationGeometry(page, frame, name);
  const metrics = await frame.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        !element.closest('[hidden],[inert]')
      );
    };
    const dialog = document.querySelector('dialog[open]');
    const root = dialog ?? document;
    const controls = [
      ...root.querySelectorAll('button, input, select, summary'),
    ].filter(visible);
    return {
      viewport: [innerWidth, innerHeight],
      overflow: document.documentElement.scrollWidth - innerWidth,
      dialog: dialog?.textContent?.trim().slice(0, 100) ?? null,
      controls: controls.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          name:
            element.getAttribute('aria-label') ??
            element.textContent?.trim() ??
            '',
          rect: [rect.x, rect.y, rect.width, rect.height],
          disabled: element.disabled === true,
          font: getComputedStyle(element).fontSize,
        };
      }),
      scrollOwners: [...root.querySelectorAll('*')]
        .filter((element) => {
          const style = getComputedStyle(element);
          return (
            visible(element) &&
            /auto|scroll/.test(style.overflowY) &&
            element.scrollHeight > element.clientHeight + 10
          );
        })
        .map((element) => ({
          class: element.className,
          visible: element.clientHeight,
          content: element.scrollHeight,
        })),
    };
  });
  assert.ok(
    metrics.overflow <= 2,
    `${name}: unintended document horizontal overflow ${metrics.overflow}px`,
  );
  const screenshot = `${name}.png`;
  await captureBrowserScreenshot(page, {
    path: join(output, screenshot),
    fullPage: false,
  });
  report.screenshots.push(screenshot);
  report.audits.push({
    name,
    screenshot,
    dialogCount: await ui.getByRole('dialog').count(),
    zeroMarkers: await markerGeometry(frame, name),
    resultHero,
    ...metrics,
  });
  await save();
}
async function auditDialogs(page, ui, frame, name, state, kinds = null) {
  const before = await view();
  const entries = [
    ['rules', ui.getByRole('button', { name: /^(规则|玩法)$/ }).first()],
    ['menu', ui.getByRole('button', { name: /^菜单$/ }).first()],
    ['friends', ui.getByRole('button', { name: /^朋友$/ }).first()],
    ['market', ui.getByRole('button', { name: /^历轮行情$/ }).first()],
    ['museums', ui.getByRole('button', { name: /^各家博物馆$/ }).first()],
    ['research', ui.locator('[data-research-details]').first()],
    ['score', ui.getByRole('button', { name: /查看.*计分明细/ }).first()],
    ['company', ui.locator('.pg-company-details').first()],
    ['income', ui.getByRole('button', { name: /收益/ }).first()],
  ];
  for (const [kind, entry] of entries) {
    if (kinds && !kinds.includes(kind)) continue;
    if (
      !(await entry.count()) ||
      !(await entry.isVisible()) ||
      !(await entry.isEnabled())
    )
      continue;
    await entry.scrollIntoViewIfNeeded();
    await entry.click();
    await page.waitForTimeout(50);
    const dialog = ui.getByRole('dialog').first();
    if (!(await dialog.count()) || !(await dialog.isVisible())) {
      await auditSnapshot(page, ui, frame, `${name}-${kind}-expanded`);
      if (kind === 'income') await entry.click();
      continue;
    }
    await auditSnapshot(page, ui, frame, `${name}-${kind}-top`);
    if (kind === 'market') {
      const market = dialog.locator('.ma-panel .ma-market');
      if (await market.count()) {
        const title = market.locator('.ma-section-heading h2');
        assert.equal(
          await title.evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return range.getClientRects().length;
          }),
          1,
          `${name}: market title must stay whole`,
        );
        for (const counter of await market.locator('.ma-artist__count').all()) {
          const number = await counter.locator('strong').boundingBox();
          const total = await counter.locator('span').last().boundingBox();
          assert.ok(
            Math.abs(number.y - total.y) < 3,
            `${name}: played count and /5 must stay together`,
          );
        }
      }
    }
    if (kind === 'rules') {
      const sections = dialog.locator('.rules-guide__nav button');
      for (let index = 0; index < (await sections.count()); index++) {
        await sections.nth(index).click();
        await auditSnapshot(
          page,
          ui,
          frame,
          `${name}-${kind}-section-${index}`,
        );
      }
      if (name.endsWith('player-320-mobile')) {
        const tasks = dialog.locator('.ex-research-card');
        for (let index = 0; index < (await tasks.count()); index++) {
          const task = tasks.nth(index);
          const id = await task.getAttribute('data-research');
          for (const selector of [
            '.ex-research-title',
            '.ex-research-condition',
            '.ex-research-diagram',
          ]) {
            await task.locator(selector).scrollIntoViewIfNeeded();
            await auditSnapshot(
              page,
              ui,
              frame,
              `${name}-${kind}-${id}-${selector.slice(1)}`,
            );
          }
        }
      }
    }
    await dialog.evaluate((element) => {
      for (const owner of [element, ...element.querySelectorAll('*')])
        if (
          /auto|scroll/.test(getComputedStyle(owner).overflowY) &&
          owner.scrollHeight > owner.clientHeight
        )
          owner.scrollTop = owner.scrollHeight;
    });
    await auditSnapshot(page, ui, frame, `${name}-${kind}-bottom`);
    await dialog.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.ok(
      await entry.evaluate(
        (element) =>
          document.activeElement === element ||
          element.contains(document.activeElement),
      ),
      `${name}-${kind}: closing must restore entry focus`,
    );
  }
  assert.equal(
    (await view()).revision,
    before.revision,
    `${name}: browsing dialogs cannot submit a game action`,
  );
  await checked(
    `${name}: ${kinds?.join('/') ?? 'applicable'} dialogs scroll, close and restore focus without revision change (${state.gameView.phase})`,
  );
}
async function auditPhase(current, humans, index, state, name, first) {
  const allDialogs =
    first ||
    ['round-result', 'match-result', 'ended'].includes(state.gameView.phase);
  const incomeDialogs = state.gameView.phase === 'powering';
  const desktopPage = current;
  const mobilePage =
    onlyGame === 'pokemon-encounters'
      ? await phonePage(current.__displayToken)
      : current;
  if (first && onlyGame === 'pokemon-encounters') {
    await mode(current, 'wide');
    const cdp = await current.context().newCDPSession(current);
    try {
      for (const scale of [1.25, 1.5]) {
        const size = [Math.round(1920 / scale), Math.round(1080 / scale)];
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: size[0],
          height: size[1],
          deviceScaleFactor: scale,
          mobile: false,
        });
        await geometry(current, `${name}-scale-${scale}`, size, 'wide');
      }
    } finally {
      await cdp.send('Emulation.clearDeviceMetricsOverride');
      await cdp.detach();
    }
  }
  for (const [width, height, display] of [
    [320, 568, 'mobile'],
    [360, 640, 'mobile'],
    [390, 844, 'mobile'],
    ...(onlyGame === 'pokemon-encounters'
      ? [
          [430, 932, 'mobile'],
          [568, 320, 'mobile'],
          [844, 390, 'mobile'],
          [932, 430, 'mobile'],
        ]
      : []),
    [799, 390, 'mobile'],
    [1280, 720, 'portrait'],
    [1280, 720, 'wide'],
    ...(onlyGame === 'pokemon-encounters'
      ? [
          [1366, 768, 'portrait'],
          [1366, 768, 'wide'],
          [1920, 1080, 'portrait'],
          [1920, 1080, 'wide'],
          [3840, 2160, 'portrait'],
          [3840, 2160, 'wide'],
          [1280, 480, 'wide'],
        ]
      : []),
  ]) {
    const current = display === 'mobile' ? mobilePage : desktopPage;
    const player = playerUi(current);
    const frame = await playerFrame(current);
    await current.setViewportSize({ width, height });
    if (display !== 'mobile') await mode(current, display);
    await current.waitForTimeout(80);
    await frame.evaluate(() => {
      window.scrollTo(0, 0);
      for (const owner of document.querySelectorAll(
        '.pg-page-scroll, .pg-action-dock',
      ))
        owner.scrollTop = 0;
    });
    await auditSnapshot(
      current,
      player,
      frame,
      `${name}-player-${width}-${display}`,
    );
    if (
      (allDialogs || incomeDialogs) &&
      [320, 1280].includes(width) &&
      display !== 'portrait'
    )
      await auditDialogs(
        current,
        player,
        frame,
        `${name}-player-${width}-${display}`,
        state,
        allDialogs ? null : ['income'],
      );
    const actions = player
      .locator(
        '[data-action], .submit-choice button, .ma-cash-panel button, .pg-action-dock button',
      )
      .filter({ visible: true });
    for (let action = 0; action < (await actions.count()); action++) {
      const element = actions.nth(action);
      if (!(await element.isEnabled())) continue;
      await element.scrollIntoViewIfNeeded();
      assert.ok(
        await element.evaluate((button) => {
          const rect = button.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          );
          return hit === button || button.contains(hit);
        }),
        `${name}: legal primary control is obscured after scrolling`,
      );
    }
    const tabs = player.locator('.pg-page-nav button');
    if (await tabs.count()) {
      for (let tab = 0; tab < (await tabs.count()); tab++) {
        await tabs.nth(tab).click();
        await auditSnapshot(
          current,
          player,
          frame,
          `${name}-player-${width}-${display}-page-${tab}`,
        );
      }
      await tabs.first().click();
    }
  }
  const otherViews = await Promise.all(
    humans
      .filter((_, seat) => seat !== index)
      .map(async (human) => ({ human, projection: await view(human.token) })),
  );
  const other = (
    otherViews.find(({ projection }) => {
      const values =
        projection.gameView.roundResult?.scores[projection.self.seatId]?.values;
      return (
        values?.length === 6 &&
        values.slice(0, 3).some((value, column) => value === values[column + 3])
      );
    }) ?? otherViews[0]
  )?.human;
  if (other) {
    const waiting =
      pages.find((page) => page.__displayToken === other.token) ??
      (await open(other.token));
    await rendered(waiting, await view(other.token));
    await waiting.setViewportSize({ width: 390, height: 844 });
    await auditSnapshot(
      waiting,
      playerUi(waiting),
      await playerFrame(waiting),
      `${name}-other-player`,
    );
    // Result boards may have no zero column for the first viewer. Cover the
    // marked player's phone and desktop layouts without editing server state.
    const waitingUi = playerUi(waiting);
    if (await waitingUi.locator('.zero-column-badge').count()) {
      for (const [width, height, display] of [
        [320, 568, 'mobile'],
        [360, 640, 'mobile'],
        [1280, 720, 'portrait'],
        [1280, 720, 'wide'],
      ]) {
        await waiting.setViewportSize({ width, height });
        if (width >= 800) await mode(waiting, display);
        const waitingFrame = await playerFrame(waiting);
        await waitingFrame.evaluate(() => window.scrollTo(0, 0));
        await auditSnapshot(
          waiting,
          waitingUi,
          waitingFrame,
          `${name}-other-player-${width}-${display}`,
        );
      }
    }
  }
  for (const [role, page] of [
    ['host', auditHost],
    ['public', auditPublic],
  ]) {
    await page.locator(`[data-room-revision="${state.revision}"]`).waitFor();
    const cdp = await page.context().newCDPSession(page);
    try {
      for (const [width, height] of [
        [1280, 720],
        [1920, 1080],
        ...(onlyGame === 'pokemon-encounters' ? [[3840, 2160]] : []),
      ]) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await auditSnapshot(page, page, page, `${name}-${role}-${width}`);
        if ((allDialogs || incomeDialogs) && width === 1280)
          await auditDialogs(
            page,
            page,
            page,
            `${name}-${role}-${width}`,
            state,
            allDialogs ? null : ['income'],
          );
      }
    } finally {
      await cdp.send('Emulation.clearDeviceMetricsOverride');
      await cdp.detach();
    }
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
  if (visualAudit) {
    auditHost = host;
    const opened = desktop.waitForEvent('window');
    await desktop.request('open-public');
    auditPublic = await opened;
  }
  const catalog = (await view()).catalog;
  for (const game of catalog.filter(
    (game) => !onlyGame || game.id === onlyGame,
  ))
    for (const variant of game.id === 'pokemon-encounters'
      ? onlyVariant
        ? [onlyVariant]
        : scrollOnly
          ? ['original']
          : ['original', 'expansion']
      : [null])
      for (const count of visualAudit &&
      onlyGame === 'pokemon-encounters' &&
      !auditMin
        ? [2, 4, 6]
        : quick || scrollOnly || visualAudit
          ? [scrollOnly || auditMin ? game.min : game.max]
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
        if (
          visualAudit &&
          onlyAuditPhase === 'round-result' &&
          onlyVariant === 'original'
        )
          await command({
            type: 'set-owner',
            seatId: (await view(humans[0].token)).self.seatId,
          });
        const page = await open(humans[0].token);
        const name = `${game.id}-${variant ?? 'default'}-${count}`;
        if (!visualAudit)
          await layouts(page, name + '-box', humans[0].token, !quick);
        if (
          !quick &&
          !visualAudit &&
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
        if (visualAudit) {
          await auditHost.goto(origin + '/host/game');
          await auditPublic.goto(origin + '/public/game');
        }
        await playerUi(page)
          .locator('.pokemon-screen, .expansion-screen, .ma-screen, .pg-screen')
          .first()
          .waitFor();
        const module = createRequire(import.meta.url)(
          game.id === 'pokemon-encounters' && packagedPokemon
            ? packagedPokemon.botPath
            : join(portable, `bots/${game.id}.cjs`),
        );
        const bot = module.botsByVariant?.[variant] ?? module.bot;
        const memories = new Map(),
          seen = new Set(),
          bufferActions = new Set(),
          clickedTypes = new Set(),
          eventKinds = new Set();
        const wanted =
          game.id === 'power-grid'
            ? ['regions', 'auction', 'resources', 'building', 'powering']
            : game.id === 'modern-art'
              ? [
                  'offer',
                  'double',
                  'auction-open',
                  'auction-once',
                  'auction-sealed',
                  'auction-fixed',
                  'round-result',
                ]
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
          let label =
            phase === 'auction' && state.gameView.auction
              ? `auction-${state.gameView.auction.kind ?? 'plants'}`
              : phase;
          if (variant === 'expansion') {
            assert.equal(
              state.gameView.rulesProfile,
              'events-research-v3',
              'Current expansion new game must use v3; restored legacy fixtures have separate validation',
            );
            const kind = state.gameView.currentEvent?.kind;
            if (kind && !eventKinds.has(kind)) {
              eventKinds.add(kind);
              label += `-event-${kind}`;
            }
          }
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
          if (variant === 'expansion')
            await expansionWeatherGeometry(current, state, `${name}-${label}`);
          if (!seen.has(label)) {
            seen.add(label);
            if (visualAudit && (!onlyAuditPhase || label === onlyAuditPhase))
              await auditPhase(
                current,
                humans,
                index,
                state,
                name + '-' + label,
                seen.size === 1,
              );
            else if (!visualAudit)
              await layouts(
                current,
                name + '-' + label,
                humans[index].token,
                !quick && seen.size === 1,
              );
            if (!quick && !visualAudit && seen.size === 1)
              await pageControls(current, name, humans[index].token);
          }
          if (scrollOnly) break;
          if (visualAudit && onlyAuditPhase && seen.has(onlyAuditPhase)) break;
          if (
            (quick && seen.size >= (variant === 'expansion' ? 4 : 3)) ||
            (!quick &&
              (wanted.every(
                (p) =>
                  seen.has(p) ||
                  (p === 'auction' &&
                    [...seen].some((p) => p.startsWith('auction'))),
              ) ||
                (game.id === 'modern-art'
                  ? ['ended']
                  : ['round-result', 'match-result', 'ended']
                ).includes(phase)))
          )
            break;
          if (
            actor < 0 &&
            game.id === 'modern-art' &&
            phase === 'round-result'
          ) {
            const host = await view();
            await command({
              type: 'lifecycle',
              action: host.lifecycleActions[0],
            });
            continue;
          }
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
          if (game.id === 'modern-art' && phase === 'offer') {
            const missing = state.actions.find((a) => {
              const c = state.gameView.self.hand.find((c) => c.id === a.cardId);
              return (
                c &&
                !seen.has(
                  c.auctionKind === 'double'
                    ? 'double'
                    : 'auction-' + c.auctionKind,
                )
              );
            });
            if (missing) chosen.action = missing;
          }
          if (variant === 'expansion') {
            if (
              ![
                'research-vote',
                'initial-flip',
                'draw',
                'place',
                'round-result',
              ].includes(phase)
            ) {
              const ability = state.actions.find(
                (action) => action.type !== 'decline-ability',
              );
              if (ability) chosen.action = ability;
            }
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
          let clicked = false;
          if (variant === 'expansion') {
            if (!clickedTypes.has(chosen.action.type))
              await expansionDraftMatrix(
                current,
                state,
                chosen.action,
                `${name}-${phase}-${chosen.action.type}`,
              );
            const phone = await phonePage(human.token);
            const [clickPage, display, width, height] = [
              [current, 'portrait', 1280, 720],
              [current, 'wide', 1280, 720],
              [phone, 'mobile', 390, 844],
              [phone, 'mobile', 844, 390],
            ][step % 4];
            await clickPage.setViewportSize({ width, height });
            if (clickPage === current) await mode(clickPage, display);
            await rendered(clickPage, state);
            clicked = await clickExpansionAction(
              clickPage,
              state,
              chosen.action,
              `${name}-${phase}-${display}-${width}`,
            );
            if (clicked) clickedTypes.add(chosen.action.type);
          }
          if (!clicked)
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
        if (variant === 'expansion') {
          const requiredPhases = [
            'research-vote',
            'initial-flip',
            'draw',
            'place',
            'charizard-choice',
            'charizard-view',
            'snorlax-choice',
            'mewtwo-target',
            'mewtwo-choice',
            'lucario-choice',
            'lucario-draw',
            'greninja-choice',
            'row-choice',
            'round-result',
          ];
          const requiredActions = [
            'vote-research',
            'initial-flip',
            'draw',
            'replace',
            'store-buffer',
            'draw-buffer',
            'peek',
            'swap',
            'mewtwo-target',
            'mewtwo-exchange',
            'extra-draw',
            'ninja-target',
            'row-target',
          ];
          const requiredEvents = [
            'mega',
            'rain',
            'sandstorm',
            'sun',
            'snow',
            'trick-room',
          ];
          (report.v3Coverage ??= []).push({
            name,
            observedPhases: [...seen],
            clickedActions: [...clickedTypes],
            observedEvents: [...eventKinds],
            uncoveredPhases: requiredPhases.filter(
              (phase) =>
                ![...seen].some(
                  (label) =>
                    label === phase || label.startsWith(phase + '-event-'),
                ),
            ),
            unclickedActions: requiredActions.filter(
              (action) => !clickedTypes.has(action),
            ),
            uncoveredEvents: requiredEvents.filter(
              (kind) => !eventKinds.has(kind),
            ),
            scope:
              'Only observed authorized scenarios count. Natural random draws do not establish coverage of missing scenarios; deterministic rule/fixture validation remains separate.',
          });
        }
        for (const page of pages.splice(0)) await page.context().close();
        for (const human of humans) human.client.disconnect();
      }
  assert.deepEqual(report.errors, []);
  report.status = resultCssDiagnostic ? 'diagnostic' : 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = String(error.stack ?? error);
  if (pages.at(-1))
    await captureBrowserScreenshot(pages.at(-1), {
      path: join(output, 'failure.png'),
    }).catch(() => {});
  throw error;
} finally {
  for (const socket of sockets) socket.disconnect();
  await browser?.close();
  await desktop?.close();
  await delivery?.assertUnchanged();
  await save();
}
