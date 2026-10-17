import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
assertWorkspaceRoot();
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  launchDesktop,
  desktopExecutable,
} from '../../support/desktop-test.mjs';
import {
  ScreenshotPolicy,
  registerArtifacts,
  writeScreenshot,
} from '../../../maintenance/verification-artifacts.mjs';
import { MAXIMUM_PACKAGE_BYTES } from '../../../release/package-limits.mjs';

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const args = process.argv.slice(2);
assert.ok(
  args.every((arg) => /^--(executable|zip|evidence|seats|only)=.+$/.test(arg)),
);
assert.equal(new Set(args.map((arg) => arg.split('=')[0])).size, args.length);
const option = (name, fallback) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ??
  fallback;
const executablePath = resolve(option('executable', desktopExecutable));
const zipPath = option('zip') ? resolve(option('zip')) : null;
const seats = Number(option('seats', '5'));
const only = option('only', 'all');
const name = option('evidence', `native-${seats}-${Date.now()}`);
assert.ok([3, 4, 5].includes(seats));
assert.ok(['all', 'layout', 'phone', 'match'].includes(only));
assert.match(name, /^[a-z0-9-]{1,65}$/);
const output = resolve('artifacts/manila/validation', name);
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
await mkdir('tmp', { recursive: true });
const workDir = await mkdtemp(resolve('tmp/game-review-'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidence = {
  result: 'running',
  startedAt: new Date().toISOString(),
  seats,
  only,
  workDir,
  executablePath,
  executableSha256: hash(await readFile(executablePath)),
  zipPath,
  zipSha256: zipPath ? hash(await readFile(zipPath)) : null,
  verifierSha256: hash(await readFile(new URL(import.meta.url))),
  scope:
    'Only Manila: actual hidden WinForms/WebView2, local Socket/SQLite and authoritative legal actions. Phone sizes and display scaling are simulated. No real phone/LAN, physical DPI, human listening or system installer certification.',
  checks: [],
  screenshots: [],
  screenshotAliases: [],
  previewEncodings: [],
  layouts: [],
  phases: [],
  pageErrors: [],
  externalRequests: [],
  failures: [],
};
await writeFile(
  join(output, 'verifier-source.mjs'),
  await readFile(new URL(import.meta.url)),
  { flag: 'wx' },
);
const screenshotPolicy = new ScreenshotPolicy();
const sockets = [];
const players = [];
const emulationSessions = new WeakMap();
let desktop, origin, host, publicPage, phone, hostToken, hostSocket;
const surface = (page) =>
  page.frames().find((f) => f.parentFrame() === page.mainFrame()) ?? page;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(predicate, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await wait(80);
  }
  throw new Error(label);
}
async function view(token = '') {
  const response = await fetch(origin + '/api/session/view', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(token ? { token } : {}),
  });
  const data = await response.json();
  assert.equal(data.ok, true);
  return data.view;
}
async function connect(token = '') {
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
  const v = await view(token);
  const reply = await new Promise((done, reject) =>
    socket.timeout(10000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: v.instanceId,
        revision: v.revision,
        branch: v.branch,
        command,
      },
      (error, data) => (error ? reject(error) : done(data)),
    ),
  );
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return reply;
}
async function observe(page) {
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== origin)
      evidence.externalRequests.push(request.url());
  });
  await page.addInitScript(() => {
    window.__manilaMotion = [];
    window.__manilaMedia = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      window.__manilaMedia.push({
        source: new URL(this.currentSrc || this.src, location.href).pathname,
        muted: this.muted,
        volume: this.volume,
        time: performance.now(),
      });
      return originalPlay.apply(this, args);
    };
    const observer = new MutationObserver(() => {
      const root = document.querySelector('.manila-screen');
      if (!root) return;
      const boat = root.querySelector('.mn-boat');
      const die = root.querySelector('.mn-die');
      window.__manilaMotion.push({
        saved: root.dataset.savedMotion,
        motion: root.dataset.motion,
        mode: root.dataset.playMode,
        phase: root.dataset.phase,
        transition: boat ? getComputedStyle(boat).transitionDuration : null,
        animation: die ? getComputedStyle(die).animationName : null,
      });
      if (window.__manilaMotion.length > 5000) window.__manilaMotion.shift();
    });
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'data-saved-motion',
        'data-motion',
        'data-play-mode',
        'data-phase',
      ],
    });
    window.addEventListener('pagehide', () => observer.disconnect(), {
      once: true,
    });
  });
}
async function resize(page, width, height, mobile) {
  const native = await desktop.browserWindow(page);
  await native.evaluate(
    (win, size) => win.setContentSize(size.width, size.height),
    { width, height },
  );
  if (!mobile)
    await page.evaluate(async () => {
      const bridge = window.tablemaxDisplay;
      const current = await bridge.read();
      await bridge.update({
        ...current.preferences,
        resolution: '1920x1080',
        interfaceScale: 100,
      });
    });
  let cdp = emulationSessions.get(page);
  if (!cdp) {
    cdp = await page.context().newCDPSession(page);
    emulationSessions.set(page, cdp);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: mobile,
    maxTouchPoints: 5,
  });
  if (mobile)
    await cdp.send('Emulation.setUserAgentOverride', {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    });
  await wait(120);
}
async function capture(page, label, boundary) {
  const file = screenshotPolicy.path(
    `${String(evidence.screenshots.length + 1).padStart(3, '0')}-${label}.png`,
    { label, boundary },
  );
  if (!file) return;
  await surface(page).evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  const native = await desktop.browserWindow(page);
  assert.equal(await native.evaluate((win) => win.isVisible()), false);
  const bytes = await native.evaluate(async (win) =>
    (await win.webContents.capturePage()).toPNG(),
  );
  evidence.screenshots.push(
    await writeScreenshot(output, file, bytes, evidence.screenshotAliases, {
      encodings: evidence.previewEncodings,
    }),
  );
}
async function layout(page, label, boundary) {
  await surface(page).locator('.manila-screen').waitFor();
  await surface(page).evaluate(() => document.fonts.ready);
  await surface(page).evaluate(() =>
    Promise.all(
      [...document.querySelectorAll('.manila-screen img')].map((img) =>
        img.decode().catch(() => {}),
      ),
    ),
  );
  const metrics = await surface(page).evaluate(() => {
    const root = document.querySelector('.manila-screen');
    const visible = (node) => {
      const r = node.getBoundingClientRect(),
        css = getComputedStyle(node);
      return (
        r.width > 0 &&
        r.height > 0 &&
        css.display !== 'none' &&
        css.visibility !== 'hidden'
      );
    };
    const flowBottoms = (parent) =>
      [...parent.children].flatMap((node) => {
        const style = getComputedStyle(node);
        if (style.display === 'contents') return flowBottoms(node);
        return visible(node) && !['fixed', 'absolute'].includes(style.position)
          ? [node.getBoundingClientRect().bottom + scrollY]
          : [];
      });
    const rect = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      };
    };
    const seats = [...root.querySelectorAll('.mn-seat')].filter(visible);
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      devicePixelRatio: window.devicePixelRatio,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.scrollingElement.scrollHeight,
      tailGap:
        document.scrollingElement.scrollHeight -
        Math.max(document.documentElement.clientHeight, ...flowBottoms(root)),
      hasConfirmation: [...root.querySelectorAll('.mn-confirm')].some(visible),
      phase: root.dataset.phase,
      sections: [
        ...root.querySelectorAll(
          '.mn-toolbar, .mn-status, .mn-private, .mn-layout, .mn-board-scroll, .mn-controls, .mn-confirm',
        ),
      ].map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          class: node.className,
          top: rect.top,
          height: rect.height,
          bottom: rect.bottom,
        };
      }),
      smallText: [...root.querySelectorAll('*')]
        .filter(
          (node) =>
            visible(node) &&
            [...node.childNodes].some(
              (c) => c.nodeType === Node.TEXT_NODE && c.textContent.trim(),
            ) &&
            parseFloat(getComputedStyle(node).fontSize) < 16,
        )
        .map((node) => ({
          text: node.textContent.slice(0, 80),
          size: getComputedStyle(node).fontSize,
        })),
      brokenImages: [...root.querySelectorAll('img')]
        .filter((node) => !node.complete || !node.naturalWidth)
        .map((node) => node.src),
      controls: [...root.querySelectorAll('button')].filter(visible).length,
      hostComposition: {
        main: rect(root.querySelector('.mn-main')),
        side: rect(root.querySelector('.mn-side')),
        market: rect(root.querySelector('.mn-market-panel')),
        players: rect(root.querySelector('.mn-players-panel')),
        seats: seats.length,
        seatBoxes: seats.map(rect),
      },
    };
  });
  evidence.layouts.push({ label, ...metrics });
  await capture(page, label, boundary);
  const requested = label.match(/^(?:host|public)-(\d+)x(\d+)$/);
  if (requested) {
    assert.ok(Math.abs(metrics.width - Number(requested[1])) <= 16);
    assert.equal(metrics.height, Number(requested[2]));
  }
  const scaled = label.match(/^(?:host|public)-1920x1080-zoom(125|150)$/);
  if (scaled) {
    const factor = Number(scaled[1]) / 100;
    assert.ok(Math.abs(metrics.width - Math.floor(1920 / factor)) <= 16);
    assert.equal(metrics.height, Math.floor(1080 / factor));
  }
  if (label.startsWith('player') && label.includes('844x390'))
    assert.ok(
      metrics.width >= 800,
      `${label}: genuine landscape player surface required; desktop phone-frame emulation is insufficient`,
    );
  const composition = metrics.hostComposition;
  if (
    (label.startsWith('host') || label.startsWith('public')) &&
    composition.side
  ) {
    assert.ok(composition.main, `${label}: harbor main area is missing`);
    assert.ok(composition.market, `${label}: market rail is missing`);
    assert.ok(composition.players, `${label}: merchant rail is missing`);
    assert.ok(
      composition.side.x >= composition.main.right - 1,
      `${label}: market and merchants are not to the right of the board`,
    );
    assert.ok(
      Math.abs(composition.side.y - composition.main.y) <= 1,
      `${label}: right ledger rail does not start with the board`,
    );
    assert.ok(
      composition.market.bottom <= composition.players.y + 2,
      `${label}: market is not above the merchants`,
    );
    assert.ok(
      composition.players.bottom <= metrics.height + 1 &&
        composition.side.bottom <= metrics.height + 1,
      `${label}: right rail leaves the viewport`,
    );
    assert.ok(
      composition.seats >= 3,
      `${label}: merchant rail does not expose every seat`,
    );
    assert.ok(
      composition.seatBoxes.every(
        (seat) =>
          seat.width > 0 &&
          seat.height > 0 &&
          seat.bottom <= composition.players.bottom + 1,
      ),
      `${label}: a merchant card is clipped by its rail`,
    );
    assert.ok(
      metrics.scrollHeight <= metrics.height + 1,
      `${label}: host/public board requires vertical page scrolling`,
    );
  }
  assert.ok(
    metrics.scrollWidth <= metrics.width + 1,
    `${label}: document horizontal overflow ${JSON.stringify(metrics)}`,
  );
  assert.deepEqual(
    metrics.smallText,
    [],
    `${label}: information below 16 CSS px`,
  );
  assert.deepEqual(metrics.brokenImages, [], `${label}: broken local assets`);
  if (label.startsWith('player') && !metrics.hasConfirmation)
    assert.ok(
      metrics.tailGap <= 20,
      `${label}: no empty trailing scrolling below the last content`,
    );
  if (
    label.startsWith('player-board-') &&
    metrics.width <= 600 &&
    metrics.width < metrics.height
  ) {
    assert.ok(
      metrics.scrollHeight <=
        metrics.height * (metrics.width >= 390 ? 1 : 1.5) + 2,
      `${label}: core placement page exceeds its scroll budget ${JSON.stringify(metrics)}`,
    );
    const targets = await surface(page).evaluate(() =>
      [...document.querySelectorAll('[data-manila-drop], [data-mn-drag]')]
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            target:
              node.getAttribute('data-manila-drop') ??
              node.getAttribute('data-mn-drag'),
            width: rect.width,
            height: rect.height,
            top: rect.top,
            bottom: rect.bottom,
          };
        })
        .filter((rect) => rect.width > 0 && rect.height > 0),
    );
    assert.ok(targets.length > 0);
    assert.deepEqual(
      targets.filter((rect) => rect.width < 43.9 || rect.height < 43.9),
      [],
      `${label}: touch targets below 44px`,
    );
    if (metrics.width >= 390)
      assert.deepEqual(
        targets.filter((rect) => rect.top < 0 || rect.bottom > metrics.height),
        [],
        `${label}: every placement target must be initially reachable without vertical scroll`,
      );
    evidence.checks.push({
      check: 'Portrait core page scroll budget and 44px targets',
      label,
      targets,
      scrollHeight: metrics.scrollHeight,
    });
  }
}
async function phoneFor(index) {
  await phone.evaluate((token) => {
    localStorage.setItem('tablemax-player', token);
    localStorage.setItem('tablemax-sound-muted', 'true');
  }, players[index].token);
  await phone.goto(origin + '/player/game');
  await until(async () => surface(phone) !== phone, 'Player iframe attaches');
  await surface(phone).locator('.manila-screen').waitFor();
}
async function auditPackage(stage) {
  if (!zipPath) return;
  const manifestPath = zipPath.replace(/\.zip$/i, '-manifest.json');
  const manifest = JSON.parse(
    await readFile(manifestPath, 'utf8').catch(() =>
      readFile(join(dirname(zipPath), 'release-manifest.json'), 'utf8'),
    ),
  );
  assert.equal(hash(await readFile(zipPath)), manifest.archive.sha256);
  assert.equal((await stat(zipPath)).size, manifest.archive.bytes);
  let bytes = 0;
  for (const file of manifest.files) {
    const path = resolve(dirname(executablePath), file.path);
    assert.ok(path.startsWith(dirname(executablePath) + '\\'));
    const data = await readFile(path);
    assert.equal(data.length, file.bytes);
    assert.equal(hash(data), file.sha256, stage + ': ' + file.path);
    bytes += data.length;
  }
  assert.equal(bytes, manifest.extractedBytes);
  assert.ok(
    bytes < MAXIMUM_PACKAGE_BYTES &&
      manifest.archive.bytes < MAXIMUM_PACKAGE_BYTES,
  );
  evidence.checks.push({
    check: `package all-member SHA ${stage}`,
    files: manifest.files.length,
    extractedBytes: bytes,
    archiveBytes: manifest.archive.bytes,
  });
}
async function audioDecoders() {
  const manifest = JSON.parse(
    await readFile('assets/games/manila/audio/manifest.json', 'utf8'),
  );
  const inputs = [];
  for (const file of manifest.files) {
    const bytes = await readFile(join('assets/games/manila/audio', file.file));
    assert.equal(hash(bytes), file.sha256);
    inputs.push({
      id: file.id,
      base64: bytes.toString('base64'),
      seconds: file.seconds,
    });
  }
  const decoded = await surface(host).evaluate(async (files) => {
    const context = new AudioContext();
    try {
      const results = [];
      for (const file of files) {
        const bytes = Uint8Array.from(atob(file.base64), (value) =>
          value.charCodeAt(0),
        );
        const buffer = await context.decodeAudioData(bytes.buffer);
        results.push({
          id: file.id,
          seconds: buffer.duration,
          channels: buffer.numberOfChannels,
          samples: buffer.length,
          expectedSeconds: file.seconds,
        });
      }
      return results;
    } finally {
      await context.close();
    }
  }, inputs);
  assert.equal(decoded.length, 10);
  for (const file of decoded) {
    assert.equal(file.channels, 2);
    assert.ok(Math.abs(file.seconds - file.expectedSeconds) < 0.002, file.id);
    assert.ok(file.samples > 0);
  }
  evidence.checks.push({
    check:
      'Ten SHA-bound original short cues decode in actual WebView2 without connecting sound output',
    decoded,
    manifestSha256: hash(
      await readFile('assets/games/manila/audio/manifest.json'),
    ),
  });
}
async function privacy() {
  for (const token of ['', hostToken]) {
    const v = await view(token);
    assert.equal(v.gameView.self, null);
    assert.deepEqual(v.actions, []);
    assert.ok(Object.values(v.gameView.players).every((p) => !('shares' in p)));
  }
  for (const player of players) {
    const v = await view(player.token);
    assert.equal(v.gameView.self.seatId, player.seatId);
    assert.equal(v.gameView.self.shares.length, 2);
  }
  evidence.checks.push({
    check:
      'Host/public no private shares or game actions; only self receives original shares',
  });
}
function choose(v, financeAuction = false) {
  const actions = v.actions;
  const type = (name) => actions.find((a) => a.type === name);
  if (v.gameView.phase === 'auction')
    return v.gameView.auction.bid === 0
      ? (financeAuction &&
          actions.find(
            (a) => a.type === 'bid' && a.amount > v.gameView.self.cash,
          )) ||
          type('bid') ||
          type('pass')
      : type('pass');
  if (v.gameView.phase === 'share')
    return type('buy-share') ?? type('skip-share');
  if (v.gameView.phase === 'financing') return type('mortgage');
  if (v.gameView.phase === 'place') {
    const placements = actions.filter((a) => a.type === 'place');
    const priorities = [
      'pirate-0',
      'pilot-small',
      'pilot-large',
      'insurance',
      'pirate-1',
    ];
    return (
      placements.find(
        (a) =>
          a.space ===
          priorities[
            v.gameView.seatOrder.indexOf(v.self.seatId) % priorities.length
          ],
      ) ??
      placements.find((a) => a.space.startsWith('cargo-')) ??
      placements[0] ??
      type('pass')
    );
  }
  if (v.gameView.phase.startsWith('pilot'))
    return (
      actions.find(
        (a) => a.type === 'pilot' && a.moves.some((m) => m.delta > 0),
      ) ?? type('pilot')
    );
  if (v.gameView.phase === 'plunder')
    return actions.find(
      (a) => a.type === 'plunder' && a.destination === 'port',
    );
  return actions.find((a) => !['mortgage', 'repay'].includes(a.type));
}
async function alternatives(open) {
  const summary = surface(phone).getByLabel('展开替代操作', { exact: true });
  const details = summary.locator('..');
  if (
    (await details.count()) &&
    ((await details.getAttribute('open')) !== null) !== open
  )
    if (open) await summary.click();
    else
      await details
        .getByRole('button', { name: '收起操作列表', exact: true })
        .click();
}
async function actThroughUI(index, own, action) {
  await phoneFor(index);
  const page = surface(phone);
  if (action.type === 'bid')
    await page.getByLabel('出价', { exact: true }).fill(String(action.amount));
  if (action.type === 'setup') {
    for (let lane = 0; lane < 3; lane++)
      await touchDrag(
        page.locator(`[data-mn-drag="cargo:${action.cargos[lane]}"]`),
        page.locator(`[data-manila-drop="cargo:${lane}"]`),
      );
    await alternatives(true);
    for (let lane = 0; lane < 3; lane++)
      assert.equal(
        await page.locator('.mn-draft-grid select').nth(lane).inputValue(),
        action.cargos[lane],
        'Cargo touch drop equals explicit selection',
      );
    await page
      .getByRole('button', { name: '下一步：设起点', exact: true })
      .click();
    await alternatives(false);
    for (let lane = 0; lane < 3; lane++)
      await dragRail(
        page,
        `setup:${lane}`,
        `[data-rail-lane="${lane}"]`,
        action.positions[lane],
      );
    await alternatives(true);
    for (let lane = 0; lane < 3; lane++)
      assert.equal(
        await page.locator('.mn-draft-grid select').nth(lane).inputValue(),
        String(action.positions[lane]),
        'Starting position drag equals explicit selection',
      );
    await alternatives(false);
  }
  if (action.type === 'place')
    await page
      .locator(`[data-manila-drop="space:${action.space}"]`)
      .first()
      .click();
  if (action.type === 'buy-share')
    await page
      .locator('.mn-share-choices button')
      .filter({
        hasText: own.gameView.cargos.find((cargo) => cargo.id === action.cargo)
          .name,
      })
      .click();
  if (action.type === 'pilot') {
    await alternatives(true);
    for (const move of action.moves)
      await page
        .getByLabel(
          `${own.gameView.cargos.find((cargo) => cargo.id === move.cargo).name}移动`,
          { exact: true },
        )
        .selectOption(String(move.delta));
    await alternatives(false);
  }
  if (action.type === 'board') {
    if (action.cargo === null)
      await page
        .getByRole('button', { name: '留在海盗船', exact: true })
        .click();
    else {
      const target = page.locator(`[data-manila-drop="board:${action.cargo}"]`);
      await touchDrag(page.locator('[data-mn-drag="pirate"]'), target);
      assert.equal(
        await target.getAttribute('aria-pressed'),
        'true',
        'Pirate touch drop selects boarding',
      );
    }
  }
  if (action.type === 'plunder')
    await touchDrag(
      page.locator(`[data-mn-drag="plunder:${action.cargo}"]`),
      page.locator(`[data-manila-drop="destination:${action.destination}"]`),
    );
  if (['mortgage', 'repay'].includes(action.type)) {
    const finance = page.locator('details.mn-finance');
    if (
      (await finance.count()) &&
      (await finance.getAttribute('open')) === null
    )
      await finance.locator('summary').click();
    const options = own.actions.filter((entry) => entry.type === action.type);
    await page
      .locator(`[data-manila-action="${action.type}"]`)
      .nth(options.findIndex((entry) => entry.shareId === action.shareId))
      .click();
  } else
    await page.locator(`[data-manila-action="${action.type}"]`).first().click();
  await until(
    async () => (await view()).revision > own.revision,
    `UI ${action.type} saved`,
  );
}
async function dragRail(page, token, selector, position) {
  const destination = await page.locator(selector).evaluate((node, value) => {
    const rect = node.getBoundingClientRect();
    const vertical =
      getComputedStyle(node).getPropertyValue('--mn-vertical').trim() === '1';
    // DOM hit regions exclude their outer edge, and CDP rounds to float32.
    // Aim inside the endpoint cell while still requiring the exact snapped value.
    const inset = (coordinate, start, end) =>
      value === 0 || value === 13
        ? Math.min(end - 0.25, Math.max(start + 0.25, coordinate))
        : coordinate;
    return vertical
      ? {
          x: rect.left + rect.width / 2,
          y: inset(
            rect.bottom - (rect.height * value) / 13,
            rect.top,
            rect.bottom,
          ),
        }
      : {
          x: inset(
            rect.left + (rect.width * value) / 13,
            rect.left,
            rect.right,
          ),
          y: rect.top + rect.height / 2,
        };
  }, position);
  evidence.checks.push({
    check: 'Rail destination geometry',
    token,
    position,
    geometry: await page.locator(selector).evaluate((node, destination) => {
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(destination.x, destination.y);
      return {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        destination,
        hit: hit?.outerHTML.slice(0, 400),
        closestRail: hit
          ?.closest('[data-manila-rail]')
          ?.getAttribute('data-rail-lane'),
        closestLane: hit?.closest('.mn-lane')?.className,
        scrollY,
      };
    }, destination),
  });
  await touchDrag(page.locator(`[data-mn-drag="${token}"]`), destination);
}
async function touchDrag(source, target, cancel = false, beforeEnd) {
  await surface(phone).evaluate(() => {
    window.__manilaPointers = [];
    if (window.__manilaPointerObserver) return;
    window.__manilaPointerObserver = true;
    for (const name of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ])
      document.addEventListener(
        name,
        (event) =>
          window.__manilaPointers.push({
            type: event.type,
            pointerType: event.pointerType,
            x: event.clientX,
            y: event.clientY,
            target: event.target
              .closest('[data-mn-drag]')
              ?.getAttribute('data-mn-drag'),
            hit: document
              .elementFromPoint(event.clientX, event.clientY)
              ?.closest('[data-manila-drop]')
              ?.getAttribute('data-manila-drop'),
          }),
        true,
      );
  });
  const start = await source.boundingBox(),
    end =
      typeof target?.boundingBox === 'function'
        ? await target.boundingBox()
        : target;
  assert.ok(start && end, 'Rendered drag source and target');
  const cdp = emulationSessions.get(phone);
  const from = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  const to = {
    x: end.x + (end.width ?? 0) / 2,
    y: end.y + (end.height ?? 0) / 2,
  };
  const dispatch = (type, point) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: point ? [{ ...point, id: 1, radiusX: 1, radiusY: 1 }] : [],
    });
  await dispatch('touchStart', from);
  // A short rail step can end within the tap slop. Deliberately start dragging
  // before returning to that exact snapped position, as a player can do.
  if (Math.hypot(to.x - from.x, to.y - from.y) < 12)
    await dispatch('touchMove', { x: from.x + 14, y: from.y });
  for (let step = 1; step <= 8; step++) {
    await dispatch('touchMove', {
      x: from.x + ((to.x - from.x) * step) / 8,
      y: from.y + ((to.y - from.y) * step) / 8,
    });
    await wait(20);
  }
  await beforeEnd?.();
  const hover = await surface(phone).evaluate(() => {
    const targets = [...document.querySelectorAll('.mn-drop-ready')].filter(
      (node) => node.checkVisibility(),
    );
    const trace = window.__manilaPointers;
    return {
      targets: targets.map((node) => node.getAttribute('data-manila-drop')),
      lastHit: trace?.at(-1)?.hit ?? null,
    };
  });
  assert.ok(
    hover.targets.length <= 1,
    'Dragging highlights only its single rendered target',
  );
  if (hover.targets.length && hover.lastHit)
    assert.equal(
      hover.targets[0],
      hover.lastHit,
      'Highlight follows the actual pointer hit',
    );
  await dispatch(cancel ? 'touchCancel' : 'touchEnd');
  assert.equal(
    await surface(phone).locator('.mn-drop-ready').count(),
    0,
    'Ending or cancelling a gesture clears target highlighting',
  );
  evidence.checks.push({
    check: 'Actual touch gesture trace',
    from,
    to,
    cancel,
    hover,
    events: await surface(phone).evaluate(() => window.__manilaPointers),
  });
}
async function naturalMatch() {
  const end = Date.now() + 300000;
  let count = 0;
  const observed = new Set();
  const experience = new Set();
  const uiVoyage = (await view()).gameView.voyage + 1;
  const uiChain = [];
  while ((await view()).status !== 'ended') {
    assert.ok(
      Date.now() < end && count < 4000,
      'Natural match bounded completion',
    );
    const publicView = await view();
    const phase = publicView.gameView.phase;
    if (!observed.has(phase)) {
      observed.add(phase);
      evidence.phases.push({
        phase,
        voyage: publicView.gameView.voyage,
        action: count,
      });
      await capture(host, `host-${phase}`);
    }
    if (
      phase === 'auction' &&
      publicView.gameView.auction.highBidder &&
      !experience.has('auction')
    ) {
      const { bid, highBidder } = publicView.gameView.auction;
      const name = publicView.seats.find((seat) => seat.id === highBidder).name;
      for (const [page, role] of [
        [host, 'host'],
        [publicPage, 'public'],
      ]) {
        await until(async () => {
          const text = await surface(page)
            .locator('.mn-auction-standing')
            .textContent();
          return text.includes(String(bid)) && text.includes(name);
        }, `${role}: public highest bid and bidder`);
        await capture(page, `${role}-auction-leading`, 'auction-leading');
      }
      await phoneFor(
        players.findIndex(
          (player) => player.seatId !== publicView.gameView.turnSeat,
        ),
      );
      await resize(phone, 320, 568, true);
      await layout(phone, 'player-auction-leading-320x568', 'auction-leading');
      assert.ok(
        (
          await surface(phone).locator('.mn-auction-standing').textContent()
        ).includes(name),
      );
      experience.add('auction');
      evidence.checks.push({
        check:
          'Highest bid and bidder remain visible to host, public and waiting player',
      });
    }
    if (phase === 'financing' && !experience.has('financing')) {
      const payerIndex = players.findIndex(
        (player) => player.seatId === publicView.gameView.payment.seatId,
      );
      assert.ok(payerIndex >= 0);
      await phoneFor((payerIndex + 1) % players.length);
      await resize(phone, 320, 568, true);
      await layout(
        phone,
        'player-financing-waiting-320x568',
        'financing-waiting',
      );
      assert.equal(
        await surface(phone).locator('.mn-financing-notice').count(),
        0,
      );
      assert.equal(
        await surface(phone).locator('[data-manila-action="mortgage"]').count(),
        0,
      );
      await phoneFor(payerIndex);
      await layout(phone, 'player-financing-payer-320x568', 'financing-payer');
      const own = await view(players[payerIndex].token);
      const notice = await surface(phone)
        .locator('.mn-financing-notice')
        .textContent();
      assert.ok(notice.includes(String(own.gameView.payment.amount)));
      assert.ok(
        notice.includes(
          String(
            Math.max(0, own.gameView.payment.amount - own.gameView.self.cash),
          ),
        ),
      );
      const mortgage = surface(phone)
        .locator('[data-manila-action="mortgage"]')
        .first();
      const firstChoice = await mortgage.boundingBox();
      const viewportHeight = await surface(phone).evaluate(
        () => document.documentElement.clientHeight,
      );
      assert.ok(
        firstChoice &&
          firstChoice.y >= 0 &&
          firstChoice.y + firstChoice.height <= viewportHeight,
        'A complete collateral choice must be visible on the initial 320x568 screen',
      );
      await mortgage.click();
      await until(
        async () => (await view()).revision > own.revision,
        'Actual chosen mortgage saves',
      );
      experience.add('financing');
      if (own.gameView.voyage === uiVoyage)
        uiChain.push({ phase, action: 'mortgage', revision: own.revision });
      evidence.checks.push({
        check:
          'Only debtor sees financing gap and collateral actions; actual chosen mortgage saves through the player UI',
      });
      count++;
      continue;
    }
    if (phase.startsWith('pilot') && !experience.has(phase)) {
      const index = players.findIndex(
        (player) => player.seatId === publicView.gameView.turnSeat,
      );
      const own = await view(players[index].token);
      const choices = own.actions.filter(
        (action) => action.type === 'pilot' && action.moves.length,
      );
      const selected =
        choices.find((action) => action.moves.length === 2) ?? choices[0];
      if (selected) {
        await phoneFor(index);
        await resize(phone, 390, 844, true);
        for (const move of selected.moves) {
          const boat = own.gameView.boats.find(
            (item) => item.cargo === move.cargo,
          );
          await dragRail(
            surface(phone),
            `pilot:${move.cargo}`,
            `[data-rail-cargo="${move.cargo}"]`,
            boat.position + move.delta,
          );
        }
        await alternatives(true);
        for (const move of selected.moves) {
          const cargo = own.gameView.cargos.find(
            (item) => item.id === move.cargo,
          );
          const select = surface(phone).getByLabel(`${cargo.name}移动`, {
            exact: true,
          });
          assert.equal(
            await select.inputValue(),
            String(move.delta),
            'Pilot touch movement equals explicit selection',
          );
          const boat = own.gameView.boats.find(
            (item) => item.cargo === move.cargo,
          );
          const target = boat.position + move.delta;
          const preview = await select
            .locator('..')
            .locator('.mn-pilot-preview')
            .textContent();
          assert.ok(preview.includes(target > 13 ? '靠港' : `${target} 格`));
        }
        assert.equal(
          (await view()).revision,
          own.revision,
          'Pilot drafts do not submit',
        );
        await layout(phone, `player-${phase}-draft`, phase);
        await surface(phone)
          .getByRole('button', { name: '清空调整', exact: true })
          .click();
        for (const select of await surface(phone)
          .locator('.mn-draft-grid select')
          .all())
          assert.equal(await select.inputValue(), '0');
        assert.equal(
          (await view()).revision,
          own.revision,
          'Clear pilot draft does not submit',
        );
        await alternatives(true);
        for (const move of selected.moves) {
          const cargo = own.gameView.cargos.find(
            (item) => item.id === move.cargo,
          );
          await surface(phone)
            .getByLabel(`${cargo.name}移动`, { exact: true })
            .selectOption(String(move.delta));
        }
        await surface(phone).locator('[data-manila-action="pilot"]').click();
        await until(
          async () => (await view()).revision > own.revision,
          'Concrete pilot confirmation saves',
        );
        experience.add(phase);
        if (own.gameView.voyage === uiVoyage)
          uiChain.push({ phase, action: 'pilot', revision: own.revision });
        evidence.checks.push({
          check: 'Pilot target previews, clear draft and actual confirmation',
          phase,
          moves: selected.moves,
        });
        count++;
        continue;
      }
    }
    let acted = false;
    for (let i = 0; i < players.length; i++) {
      const player = players[i],
        own = await view(player.token);
      if (!own.actions.length) continue;
      let action = choose(own, !experience.has('financing'));
      if (phase === 'board' && !experience.has('drag-board'))
        action =
          own.actions.find(
            (entry) => entry.type === 'board' && entry.cargo !== null,
          ) ?? action;
      assert.ok(action, `Playable action in ${phase}`);
      const firstPirateDrag =
        ((action.type === 'board' && action.cargo !== null) ||
          action.type === 'plunder') &&
        !experience.has(`drag-${action.type}`);
      if (own.gameView.voyage === uiVoyage || firstPirateDrag) {
        await actThroughUI(i, own, action);
        if (own.gameView.voyage === uiVoyage)
          uiChain.push({ phase, action: action.type, revision: own.revision });
        if (firstPirateDrag) {
          experience.add(`drag-${action.type}`);
          evidence.checks.push({
            check: 'Actual pirate touch drag draft and confirmation saves',
            phase,
            action,
          });
        }
      } else {
        await send(player.socket, player.token, {
          type: 'game',
          decisionId: own.decisionId,
          action,
        });
      }
      count++;
      acted = true;
      break;
    }
    assert.ok(acted, `No actionable player in ${phase}`);
  }
  const final = await view();
  await until(
    () =>
      surface(host)
        .locator('[data-manila-scene="ended"]')
        .count()
        .then((count) => count > 0),
    'A fresh terminal save produces its actual ending performance',
    3000,
  );
  await capture(host, 'host-ending-performance', 'ending-performance');
  assert.ok(
    experience.has('auction') && experience.has('financing'),
    'Natural match must exercise auction standing and debtor-only financing UI',
  );
  assert.equal(final.gameView.phase, 'ended');
  assert.ok(final.gameView.winners.length > 0);
  assert.ok(Object.values(final.gameView.market).includes(30));
  assert.equal(Object.keys(final.gameView.scores).length, seats);
  assert.ok(
    uiChain.some((entry) => entry.phase === 'auction') &&
      uiChain.some((entry) => entry.action === 'setup') &&
      uiChain.some((entry) => entry.phase === 'place') &&
      uiChain.some((entry) => entry.action === 'next-voyage'),
    'A complete natural voyage, including next-voyage, must use real UI controls',
  );
  evidence.checks.push({
    check:
      'One full natural voyage through real player UI, including every decision',
    voyage: uiVoyage,
    decisions: uiChain,
  });
  evidence.checks.push({
    check: 'Natural complete match through real package Socket/SQLite',
    actions: count,
    voyages: final.gameView.voyage,
    scores: final.gameView.scores,
    winners: final.gameView.winners,
  });
  await phoneFor(0);
  await layout(phone, 'player-final', 'final');
  await capture(host, 'host-final', 'final');
}
async function firstPlacement(includeDesktop = true) {
  for (let step = 0; step < 100; step++) {
    if ((await view()).gameView.phase === 'place') break;
    let progressed = false;
    for (const player of players) {
      const own = await view(player.token);
      if (!own.actions.length) continue;
      const action = choose(own);
      assert.ok(action);
      await send(player.socket, player.token, {
        type: 'game',
        decisionId: own.decisionId,
        action,
      });
      progressed = true;
      break;
    }
    assert.ok(
      progressed,
      'Advance to first placement through authorized actions',
    );
  }
  assert.equal((await view()).gameView.phase, 'place');
  let index = -1;
  for (let i = 0; i < players.length; i++)
    if (
      (await view(players[i].token)).actions.some((a) => a.type === 'place')
    ) {
      index = i;
      break;
    }
  assert.ok(index >= 0);
  await phoneFor(index);
  await resize(phone, 320, 568, true);
  await layout(phone, 'player-board-320x568', 'board');
  if (includeDesktop) {
    await layout(host, 'host-board-1280x720', 'board');
    await layout(publicPage, 'public-board-1280x720', 'board');
  }
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 932],
    [844, 390],
  ]) {
    if (width !== 320) {
      await resize(phone, width, height, true);
      await layout(
        phone,
        `player-board-${width}x${height}`,
        `board-${width}x${height}`,
      );
    }
    const orb = await surface(phone).evaluate(() => {
      const button = document.querySelector('.interaction-orb');
      if (!button) return null;
      const r = button.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        toolbarGap:
          r.left -
          Math.max(
            ...[
              ...document.querySelectorAll('.mn-toolbar button, .mn-toolbar a'),
            ]
              .filter((node) => node.checkVisibility())
              .map((node) => node.getBoundingClientRect().right),
          ),
        overlaps: [
          ...document.querySelectorAll(
            '.mn-action-grid button, .mn-action-tray button, .mn-action-tray summary, [data-manila-drop], .mn-controls-heading, .mn-confirm button, .mn-toolbar button, .mn-toolbar a, .mn-brand, .mn-voyage',
          ),
        ]
          .filter((node) => {
            if (!node.checkVisibility()) return false;
            const b = node.getBoundingClientRect();
            return (
              b.width > 0 &&
              b.height > 0 &&
              r.x < b.right &&
              r.right > b.x &&
              r.y < b.bottom &&
              r.bottom > b.y
            );
          })
          .map((node) => node.textContent),
      };
    });
    assert.ok(orb, 'Actual default interaction control present');
    assert.deepEqual(
      orb.overlaps,
      [],
      'Interaction control does not obscure choices, action status, confirmation or toolbar controls',
    );
    assert.ok(
      orb.toolbarGap >= 3.9,
      'Default interaction control has at least 4 CSS pixels of clear space from toolbar controls',
    );
    evidence.checks.push({
      check:
        'Phone default movable interaction control does not overlap placement choices or necessary information',
      width,
      height,
      orb,
    });
  }
  await resize(phone, 390, 844, true);
  const before = await view(players[index].token);
  await surface(phone).evaluate(() => window.scrollTo(0, 0));
  const sound = surface(phone).locator('[data-manila-sound]');
  assert.equal(
    await sound.getAttribute('aria-pressed'),
    'false',
    'Phone starts silent',
  );
  await sound.click();
  await until(
    () => sound.getAttribute('aria-pressed').then((value) => value === 'true'),
    'Explicit gesture unlocks phone audio',
  );
  assert.deepEqual(
    await surface(phone).evaluate(() =>
      window.__manilaMedia.filter((item) => !item.muted),
    ),
    [],
    'Enabling audio does not replay old saved feedback',
  );
  const source = surface(phone).locator('[data-mn-drag="worker"]');
  const action = before.actions.find((entry) => entry.type === 'place');
  const target = surface(phone)
    .locator(`[data-manila-drop="space:${action.space}"]`)
    .first();
  await touchDrag(source, { x: 2, y: 2 });
  assert.notEqual(
    await target.getAttribute('aria-pressed'),
    'true',
    'Invalid drop does not choose a space',
  );
  await touchDrag(source, target, true);
  assert.notEqual(
    await target.getAttribute('aria-pressed'),
    'true',
    'pointercancel does not choose a space',
  );
  await touchDrag(source, target);
  assert.equal(
    await target.getAttribute('aria-pressed'),
    'true',
    'Actual touch drag chooses the concrete legal space',
  );
  const placementGeometry = await surface(phone).evaluate(() => {
    const confirmation = document
      .querySelector('.mn-confirm')
      .getBoundingClientRect();
    const obscured = [
      ...document.querySelectorAll('[data-manila-drop], [data-mn-drag]'),
    ]
      .filter((node) => {
        const box = node.getBoundingClientRect();
        return (
          box.width > 0 &&
          box.height > 0 &&
          box.left < confirmation.right &&
          box.right > confirmation.left &&
          box.top < confirmation.bottom &&
          box.bottom > confirmation.top
        );
      })
      .map(
        (node) =>
          node.getAttribute('data-manila-drop') ??
          node.getAttribute('data-mn-drag'),
      );
    return {
      scrollHeight: document.scrollingElement.scrollHeight,
      height: innerHeight,
      confirmation: { top: confirmation.top, bottom: confirmation.bottom },
      obscured,
    };
  });
  assert.ok(
    placementGeometry.scrollHeight <= placementGeometry.height + 2,
    '390 portrait selected draft and confirmation fit one screen',
  );
  assert.deepEqual(
    placementGeometry.obscured,
    [],
    'Confirmation never overlays any legal placement target or tray',
  );
  evidence.checks.push({
    check:
      'Selected portrait draft, tray and all targets stay visible above confirmation',
    ...placementGeometry,
  });
  await capture(
    phone,
    'player-selected-placement-390x844',
    'selected-placement',
  );
  const details = surface(phone).locator('.mn-lane .mn-detail-button').first();
  await details.click();
  const detailGeometry = await surface(phone).evaluate(() => {
    const card = document
      .querySelector('.mn-detail-card')
      .getBoundingClientRect();
    const trigger = document
      .querySelector('.mn-lane .mn-detail-button')
      .getBoundingClientRect();
    const confirmation = document
      .querySelector('.mn-confirm')
      .getBoundingClientRect();
    const overlaps = (a, b) =>
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top;
    return {
      inViewport:
        card.left >= 0 &&
        card.top >= 0 &&
        card.right <= innerWidth &&
        card.bottom <= innerHeight,
      triggerOverlap: overlaps(card, trigger),
      confirmationOverlap: overlaps(card, confirmation),
    };
  });
  assert.deepEqual(
    detailGeometry,
    { inViewport: true, triggerOverlap: false, confirmationOverlap: false },
    'Translucent details avoid their target and current confirmation',
  );
  await capture(phone, 'player-cargo-detail-390x844', 'detail');
  await surface(phone).locator('.mn-detail-card button').first().click();
  await details.focus();
  await details.press('Enter');
  assert.equal(
    await surface(phone).locator('.mn-detail-card').count(),
    1,
    'Keyboard opens details',
  );
  await details.press('Escape');
  assert.equal(
    await surface(phone).locator('.mn-detail-card').count(),
    0,
    'Escape dismisses details',
  );
  const detailBox = await details.boundingBox();
  const detailCdp = emulationSessions.get(phone);
  await detailCdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      {
        x: detailBox.x + detailBox.width / 2,
        y: detailBox.y + detailBox.height / 2,
        id: 1,
      },
    ],
  });
  await wait(520);
  assert.equal(
    await surface(phone).locator('.mn-detail-card').count(),
    1,
    'Actual long press opens details',
  );
  await detailCdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await phone.mouse.click(2, 2);
  assert.equal(
    await surface(phone).locator('.mn-detail-card').count(),
    0,
    'Outside click dismisses details',
  );
  evidence.checks.push({
    check:
      'Actual click, keyboard and long-press detail card with target/confirmation avoidance',
    ...detailGeometry,
  });
  await surface(phone).locator('.mn-secret-entry').click();
  await capture(phone, 'player-secret-shares-390x844', 'secret-shares');
  await surface(phone).locator('.mn-detail-card button').first().click();
  await surface(phone)
    .getByRole('button', { name: '账本', exact: true })
    .click();
  await capture(phone, 'player-ledger-390x844', 'ledger');
  await surface(phone).getByRole('button', { name: /关闭/ }).last().click();
  assert.equal(
    (await view()).revision,
    before.revision,
    'Opening and closing private shares and ledger never changes the game',
  );
  const otherAction = before.actions.find(
    (entry) => entry.type === 'place' && entry.space !== action.space,
  );
  await touchDrag(
    source,
    surface(phone)
      .locator(`[data-manila-drop="space:${otherAction.space}"]`)
      .first(),
    false,
    () => resize(phone, 844, 390, true),
  );
  assert.equal(
    await target.getAttribute('aria-pressed'),
    'true',
    'Rotation ends the active gesture and preserves the earlier valid draft',
  );
  assert.equal(
    (await view()).revision,
    before.revision,
    'Rotation never submits a draft',
  );
  await resize(phone, 390, 844, true);
  await surface(phone)
    .getByRole('button', { name: '取消', exact: true })
    .click();
  assert.notEqual(await target.getAttribute('aria-pressed'), 'true');
  await target.click();
  assert.equal(
    await target.getAttribute('aria-pressed'),
    'true',
    'Click chooses the same draft as drag',
  );
  assert.equal(
    (await view()).revision,
    before.revision,
    'Selecting a concrete space remains a local draft',
  );
  await surface(phone).locator('[data-manila-action="place"]').click();
  await until(
    async () => (await view()).revision > before.revision,
    'Concrete placement confirmed and saved',
  );
  await until(
    () =>
      surface(phone).evaluate(() =>
        window.__manilaMedia.some(
          (item) => !item.muted && item.source.endsWith('.flac'),
        ),
      ),
    'Only the new committed placement plays its decoded game cue',
  );
  await sound.click();
  assert.equal(await sound.getAttribute('aria-pressed'), 'false');
  const phoneWindowId = await phone.evaluate(() => window.__tablemaxWindowId);
  assert.equal(
    (await desktop.request('windows')).find((item) => item.id === phoneWindowId)
      .audioMuted,
    true,
    'Verification remains physically muted while validating playback',
  );
  evidence.checks.push({
    check:
      'Phone explicit audio unlock, no old-event replay and fresh saved playback under test-process mute',
    playback: await surface(phone).evaluate(() => window.__manilaMedia),
  });
  assert.equal(
    (await view()).gameView.spaces.filter(
      (space) => space.occupant === players[index].seatId,
    ).length,
    1,
  );
  evidence.checks.push({
    check:
      'Actual touch invalid/cancelled drops do not submit; click and drag choose the same concrete draft; confirmation saves it',
  });
  await resize(phone, 390, 844, true);
}
async function motionChecks() {
  async function advanceMovement() {
    const before = (await view()).gameView;
    for (let step = 0; step < 120; step++) {
      const current = (await view()).gameView;
      if (current.movement > before.movement) return;
      let progressed = false;
      for (const player of players) {
        const own = await view(player.token);
        if (!own.actions.length) continue;
        await send(player.socket, player.token, {
          type: 'game',
          decisionId: own.decisionId,
          action: choose(own),
        });
        progressed = true;
        break;
      }
      assert.ok(progressed, 'Motion scenario has an authorized decision');
    }
    throw new Error('Bounded motion scenario did not roll');
  }
  await surface(host).evaluate(() => {
    window.__manilaMotion = [];
  });
  await advanceMovement();
  await until(
    () =>
      surface(host).evaluate(() =>
        window.__manilaMotion.some(
          (m) =>
            m.saved === 'true' &&
            m.motion === 'sail' &&
            m.animation &&
            m.animation !== 'none',
        ),
      ),
    'Saved sailing produces actual dice motion',
  );
  evidence.motion = {
    normal: await surface(host).evaluate(() => window.__manilaMotion),
  };
  assert.ok(
    evidence.motion.normal.some(
      (m) =>
        m.saved === 'true' &&
        m.motion === 'sail' &&
        parseFloat(m.transition) > 0,
    ),
  );
  await host.emulateMedia({ reducedMotion: 'reduce' });
  await surface(host).evaluate(() => {
    window.__manilaMotion = [];
  });
  await advanceMovement();
  await until(
    () =>
      surface(host).evaluate(() =>
        window.__manilaMotion.some(
          (m) => m.saved === 'true' && m.motion === 'sail',
        ),
      ),
    'Reduced-motion saved sailing observed',
  );
  evidence.motion.reduced = await surface(host).evaluate(
    () => window.__manilaMotion,
  );
  assert.ok(
    evidence.motion.reduced
      .filter((m) => m.saved === 'true' && m.motion === 'sail')
      .every((m) => parseFloat(m.transition) === 0 && m.animation === 'none'),
  );
  await host.reload();
  await host.locator('.manila-screen').waitFor();
  await audioDecoders();
  await wait(150);
  assert.equal(
    await host.locator('.manila-screen').getAttribute('data-saved-motion'),
    'false',
  );
  assert.ok(
    (await surface(host).evaluate(() => window.__manilaMotion)).every(
      (m) => m.saved !== 'true',
    ),
  );
  await send(hostSocket, hostToken, { type: 'set-play-mode', mode: 'test' });
  await until(
    () =>
      host
        .locator('.manila-screen')
        .getAttribute('data-play-mode')
        .then((mode) => mode === 'test'),
    'Isolated test mode applied',
  );
  await surface(host).evaluate(() => {
    window.__manilaMotion = [];
  });
  await advanceMovement();
  await wait(150);
  evidence.motion.test = await surface(host).evaluate(
    () => window.__manilaMotion,
  );
  assert.ok(evidence.motion.test.every((m) => m.saved !== 'true'));
  await send(hostSocket, hostToken, { type: 'set-play-mode', mode: 'play' });
  await host.emulateMedia({ reducedMotion: 'no-preference' });
  evidence.checks.push({
    check:
      'Actual saved sailing animates; reduced motion disables animation/transition; refresh does not replay; test mode suppresses motion',
  });
}
try {
  await auditPackage('before');
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-play-mode'],
    env: {
      TABLEMAX_DATA_DIR: join(workDir, 'data'),
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_PLAY_MODE: 'play',
    },
    soundEnabled: false,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  await observe(host);
  await host.locator('.connection.online').waitFor();
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken);
  hostSocket = await connect(hostToken);
  await host.getByRole('button', { name: /^(切换游戏|游戏库)$/ }).click();
  const card = host.locator('.game-library [data-game-id="manila"]');
  await card.scrollIntoViewIfNeeded();
  await card.locator('img').evaluate((img) => img.decode());
  assert.ok(await card.locator('img').evaluate((img) => img.naturalWidth > 0));
  await card.getByRole('button', { name: '选择游戏', exact: true }).click();
  await until(
    async () => (await view(hostToken)).game?.id === 'manila',
    'Real library selects the preinstalled Manila release',
  );
  evidence.checks.push({
    check:
      'Actual Manila library cover decodes and its selection button loads the preinstalled game',
  });
  for (let i = 0; i < seats; i++) {
    const response = await (
      await fetch(origin + '/api/session/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: `港湾朋友${i + 1}`,
          avatarId: `avatar-${1 + i}`,
        }),
      })
    ).json();
    assert.equal(response.ok, true);
    const token = response.token,
      socket = await connect(token);
    players.push({ token, socket, seatId: (await view(token)).self.seatId });
    await send(socket, token, { type: 'ready', ready: true });
  }
  await send(hostSocket, hostToken, { type: 'start' });
  await host.goto(origin + '/host/game');
  await host.locator('.manila-screen').waitFor();
  const nextPublic = desktop.waitForEvent('window');
  await desktop.request('open-public');
  publicPage = await nextPublic;
  await observe(publicPage);
  await publicPage.goto(origin + '/public/game');
  await publicPage.locator('.manila-screen').waitFor();
  const nextPhone = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, config) => {
      const win = new BrowserWindow({
        show: false,
        width: 390,
        height: 844,
        webPreferences: { partition: config.partition, offscreen: true },
      });
      void win.loadURL(config.url);
    },
    { partition: `manila-${name}`, url: origin + '/player' },
  );
  phone = await nextPhone;
  await observe(phone);
  await resize(phone, 390, 844, true);
  await phoneFor(0);
  await privacy();
  if (only !== 'match') {
    for (const [w, h] of [
      [320, 568],
      [390, 844],
      [430, 932],
      [844, 390],
    ]) {
      await resize(phone, w, h, true);
      await layout(phone, `player-${w}x${h}`, `${w}x${h}`);
    }
    await resize(phone, 390, 844, true);
    for (const page of only === 'phone' ? [] : [host, publicPage]) {
      for (const [w, h] of [
        [1280, 720],
        [1920, 1080],
        [2560, 1440],
        [3840, 2160],
      ]) {
        await resize(page, w, h, false);
        await layout(
          page,
          `${page === host ? 'host' : 'public'}-${w}x${h}`,
          `${w}x${h}`,
        );
      }
      await resize(page, 1920, 1080, false);
      for (const zoom of [1.25, 1.5]) {
        const display = await page.evaluate(async (scale) => {
          const bridge = window.tablemaxDisplay;
          const current = await bridge.read();
          return bridge.update({
            ...current.preferences,
            resolution: '1920x1080',
            interfaceScale: scale,
          });
        }, zoom * 100);
        assert.equal(display.preferences.interfaceScale, zoom * 100);
        const cdp = emulationSessions.get(page);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await wait(120);
        evidence.checks.push({
          check:
            'Actual role-specific display preference and simulated scaled viewport',
          role: page === host ? 'host' : 'public',
          display,
        });
        await layout(
          page,
          `${page === host ? 'host' : 'public'}-1920x1080-zoom${zoom * 100}`,
          `zoom${zoom * 100}`,
        );
      }
      await page.evaluate(async () => {
        const bridge = window.tablemaxDisplay;
        const current = await bridge.read();
        await bridge.update({ ...current.preferences, interfaceScale: 100 });
      });
      await resize(page, 1280, 720, false);
    }
    await surface(phone).getByRole('button', { name: /规则/ }).first().click();
    await capture(phone, 'player-rules', 'rules');
    assert.equal(
      await surface(phone).locator('.mn-diagram').count(),
      7,
      'Seven process-related rule diagrams render',
    );
    for (const label of ['一航次', '派遣位置', '海盗与领航', '抵押与数字版']) {
      await surface(phone)
        .getByRole('button', { name: label, exact: true })
        .click();
      const escapedImages = await surface(phone).evaluate(() =>
        [...document.querySelectorAll('.mn-diagram img')]
          .filter((image) => {
            if (!image.checkVisibility()) return false;
            const box = image.getBoundingClientRect();
            const figure = image.closest('.mn-diagram').getBoundingClientRect();
            return (
              box.width > 0 &&
              box.height > 0 &&
              (box.left < figure.left - 1 ||
                box.right > figure.right + 1 ||
                box.top < figure.top - 1 ||
                box.bottom > figure.bottom + 1)
            );
          })
          .map((image) => image.getAttribute('src')),
      );
      assert.deepEqual(
        escapedImages,
        [],
        `${label}: rule images remain within their figure`,
      );
      await capture(
        phone,
        `player-rules-${['一航次', '派遣位置', '海盗与领航', '抵押与数字版'].indexOf(label) + 1}`,
        `rules-${label}`,
      );
    }
    await surface(phone).getByRole('button', { name: /关闭/ }).last().click();
    let index = -1;
    for (let i = 0; i < players.length; i++)
      if (
        (await view(players[i].token)).actions.some((a) => a.type === 'bid')
      ) {
        index = i;
        break;
      }
    assert.ok(index >= 0);
    await phoneFor(index);
    const before = await view(players[index].token);
    await surface(phone).locator('[data-manila-action="bid"]').click();
    await until(
      async () => (await view()).revision > before.revision,
      'UI bid saved',
    );
    const checkpoint = (await view(hostToken)).history.at(-1);
    await send(hostSocket, hostToken, {
      type: 'rollback',
      checkpointId: checkpoint.id,
    });
    assert.deepEqual(
      (await view(players[index].token)).gameView,
      before.gameView,
    );
    await send(hostSocket, hostToken, { type: 'resume' });
    evidence.checks.push({
      check:
        'Actual player bid button commits; rollback restores authoritative state',
    });
    await firstPlacement(only !== 'phone');
    if (only !== 'phone') await motionChecks();
  }
  if (!['layout', 'phone'].includes(only)) await naturalMatch();
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  await auditPackage('after');
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.failures.push(error.stack ?? String(error));
  if (host) await capture(host, 'host-failure', 'failure').catch(() => {});
  if (phone) await capture(phone, 'player-failure', 'failure').catch(() => {});
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.disconnect();
  if (desktop)
    await desktop.close().catch((error) => {
      evidence.failures.push('Native shutdown: ' + error.message);
      evidence.result = 'failed';
      process.exitCode = 1;
    });
  evidence.completedAt = new Date().toISOString();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2),
  );
  await registerArtifacts({
    output,
    reportPath: join(output, 'results.json'),
    work: workDir,
    passed: evidence.result === 'passed',
    policy: screenshotPolicy,
  });
  console.log(
    JSON.stringify(
      {
        result: evidence.result,
        output,
        checks: evidence.checks.length,
        layouts: evidence.layouts.length,
        failures: evidence.failures,
      },
      null,
      2,
    ),
  );
}
