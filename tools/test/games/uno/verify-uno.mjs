import { captureBrowserScreenshot } from '../../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import {
  launchDesktop,
  desktopExecutable,
} from '../../support/desktop-test.mjs';
import {
  ScreenshotPolicy,
  registerArtifacts,
  writeScreenshot,
} from '../../../maintenance/verification-artifacts.mjs';
import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from '../../../release/package-limits.mjs';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const option = (key, fallback) =>
  process.argv
    .find((arg) => arg.startsWith(`--${key}=`))
    ?.slice(key.length + 3) ?? fallback;
assert.ok(
  process.argv
    .slice(2)
    .every(
      (arg) =>
        /^--(mode|seats|evidence|executable|legacy-executable|zip|only)=.+$/.test(
          arg,
        ) ||
        arg === '--sample' ||
        arg === '--compact' ||
        arg === '--landscape' ||
        arg === '--hand-interactions' ||
        arg === '--layout-only',
    ),
  'Unknown UNO verification argument',
);
const mode = option('mode', 'ui');
const count = Number(option('seats', '6'));
const name = option('evidence', `${mode}-${count}-${Date.now()}`);
const sample = process.argv.includes('--sample');
const compact = process.argv.includes('--compact');
const landscape = process.argv.includes('--landscape');
const handInteractions = process.argv.includes('--hand-interactions');
const layoutOnly = process.argv.includes('--layout-only');
const only = option('only', '').split(',').filter(Boolean);
assert.ok(['ui', 'runtime'].includes(mode));
assert.ok([2, 3, 4, 6].includes(count));
assert.match(name, /^[a-z0-9-]{1,60}$/);
const executablePath = resolve(option('executable', desktopExecutable));
const runtimeRoot = dirname(executablePath);
const legacyExecutable = option('legacy-executable')
  ? resolve(option('legacy-executable'))
  : null;
const zipPath = option('zip') ? resolve(option('zip')) : null;
const output = resolve('artifacts/uno/validation', name);
const screenshotPolicy = new ScreenshotPolicy();
await mkdir(dirname(output), { recursive: true });
await mkdir(output, { recursive: false });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/game-review-'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const started = performance.now();
const evidence = {
  result: 'running',
  portable: !!zipPath,
  zipPath,
  zipSha256: zipPath ? hash(await readFile(zipPath)) : null,
  executablePath,
  executableSha256: hash(await readFile(executablePath)),
  mode,
  seats: count,
  sample,
  compact,
  landscape,
  only,
  workDir: work,
  startedAt: new Date().toISOString(),
  verifierSha256: hash(await readFile(new URL(import.meta.url))),
  scope:
    'Actual hidden WinForms/WebView2, unmodified shipped service and React routes. Natural random match uses service bots and shipped 32 MiB strategy Workers supplied only authorized player views. Complete 108-card SQLite fixtures are separately identified UI boundary input. Phone touch, screen DPI and resolutions are simulated; no physical-phone or human-listening claim.',
  audioScope:
    'TABLEMAX_TEST_AUDIO=0 physically mutes WebView2. Isolated browser profile preferences may be enabled to observe actual calls; persistent user profiles are untouched. Decoder and playback observations are separate.',
  budgetScope:
    'Sampled payload and per-WebView2 JS heap/service private bytes; not allocation-profiler maxima, worst-case proof or isolated game increments.',
  checks: [],
  cases: [],
  layouts: [],
  screenshots: [],
  screenshotAliases: [],
  previewEncodings: [],
  audio: [],
  memory: [],
  payloadMaxBytes: {},
  commands: [],
  pageErrors: [],
  externalRequests: [],
  failures: [],
};
await writeFile(
  join(output, 'verifier-source.mjs'),
  await readFile(new URL(import.meta.url)),
);
let desktop, host, publicPage, phone, origin, hostToken, hostSocket;
let sockets = [],
  cdpSessions = new Map(),
  players = [],
  currentScenario = mode;
const humanMemory = new Map();
let packagedBot;
async function until(predicate, label, timeout = 20000) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    if (await predicate()) return;
    await wait(50);
  }
  throw new Error(label);
}
async function packageAudit(stage) {
  if (!zipPath) return;
  const manifestPath = zipPath.replace(/\.zip$/i, '-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  evidence.packageSnapshot = manifest.snapshot;
  if (stage === 'before')
    await writeFile(
      join(output, 'package-manifest.json'),
      await readFile(manifestPath),
    );
  assert.equal(
    hash(await readFile(zipPath)),
    evidence.zipSha256,
    'ZIP unchanged',
  );
  assert.equal(evidence.zipSha256, manifest.archive.sha256);
  assert.equal((await stat(zipPath)).size, manifest.archive.bytes);
  let actualBytes = 0;
  const members = [];
  for (const entry of manifest.files) {
    const path = resolve(runtimeRoot, entry.path);
    assert.ok(
      path.startsWith(runtimeRoot + '\\') || path.startsWith(runtimeRoot + '/'),
      'Runtime path within executable directory',
    );
    const bytes = await readFile(path);
    assert.equal(bytes.length, entry.bytes, `${stage}: ${entry.path} bytes`);
    assert.equal(hash(bytes), entry.sha256, `${stage}: ${entry.path} hash`);
    actualBytes += bytes.length;
    members.push({
      path: entry.path,
      actualBytes: bytes.length,
      actualSha256: hash(bytes),
    });
  }
  assert.equal(actualBytes, manifest.extractedBytes);
  assert.ok(
    actualBytes < MAXIMUM_PACKAGE_BYTES &&
      manifest.archive.bytes < MAXIMUM_PACKAGE_BYTES,
  );
  assert.ok(
    actualBytes <= PACKAGE_BUDGET_BYTES &&
      manifest.archive.bytes <= PACKAGE_BUDGET_BYTES,
  );
  evidence.packageAudits ??= [];
  evidence.packageAudits.push({
    stage,
    manifestSha256: hash(await readFile(manifestPath)),
    archiveBytes: manifest.archive.bytes,
    actualRuntimeBytes: actualBytes,
    fileCount: manifest.files.length,
    allFileHashesMatched: true,
    members,
  });
}
const surface = (page) =>
  page.frames().find((frame) => frame.parentFrame() === page.mainFrame()) ??
  page;
async function cdp(page) {
  if (!cdpSessions.has(page))
    cdpSessions.set(page, await page.context().newCDPSession(page));
  return cdpSessions.get(page);
}
function observe(page) {
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) =>
    evidence.pageErrors.push({
      scenario: currentScenario,
      message: error.message,
    }),
  );
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== origin)
      evidence.externalRequests.push(request.url());
  });
}
async function instrumentation(page) {
  await page.addInitScript(() => {
    window.__unoAudit = { plays: [], animations: [], commands: [] };
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      if (typeof data === 'string' && data.includes('room:command'))
        window.__unoAudit.commands.push(data);
      return originalSend.call(this, data);
    };
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      const item = {
        src: this.src,
        muted: this.muted,
        volume: this.volume,
        at: performance.now(),
        resolved: false,
      };
      window.__unoAudit.plays.push(item);
      const result = original.apply(this, args);
      result?.then(
        () => {
          item.resolved = true;
        },
        (error) => {
          item.error = error.name;
        },
      );
      return result;
    };
    document.addEventListener(
      'animationstart',
      (event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest('.uno-screen,.uno-event-layer')
        )
          window.__unoAudit.animations.push({
            name: event.animationName,
            className: target.className,
            at: performance.now(),
          });
      },
      true,
    );
  });
}
async function view(token = '') {
  const response = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(response.ok, true);
  const role = token === hostToken ? 'host' : token ? 'player' : 'public';
  evidence.payloadMaxBytes[role] = Math.max(
    evidence.payloadMaxBytes[role] ?? 0,
    Buffer.byteLength(JSON.stringify(response.view)),
  );
  return response.view;
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
async function rawSend(socket, envelope) {
  return new Promise((done, reject) =>
    socket
      .timeout(10000)
      .emit('room:command', envelope, (error, reply) =>
        error ? reject(error) : done(reply),
      ),
  );
}
async function send(socket, token, command, expected = true) {
  // A pause barrier may race one committed service bot move; fresh envelopes
  // coordinate the barrier, never replay game intents or rerun failed checks.
  for (let attempt = 0; attempt < 8; attempt++) {
    const before = await view(token);
    const reply = await rawSend(socket, {
      actionId: randomUUID(),
      instanceId: before.instanceId,
      revision: before.revision,
      branch: before.branch,
      command,
    });
    evidence.commands.push({
      scenario: currentScenario,
      type: command.type,
      action: command.action?.type,
      beforeRevision: before.revision,
      accepted: reply.ok,
      reason: reply.reason ?? null,
    });
    if (
      !reply.ok &&
      reply.reason === 'stale-revision' &&
      command.type === 'pause' &&
      expected &&
      attempt < 7
    )
      continue;
    if (expected !== null)
      assert.equal(reply.ok, expected, JSON.stringify(reply));
    return reply;
  }
}
async function resize(page, width, height, mobile = false, zoom = 1) {
  const window = await desktop.browserWindow(page);
  await window.evaluate(
    (native, size) => native.setContentSize(size.width, size.height),
    { width, height },
  );
  const session = await cdp(page);
  let display = null;
  if (!mobile) {
    const other = page === host ? publicPage : host;
    const otherPreferences =
      other && !other.isClosed()
        ? await other.evaluate(() =>
            window.tablemaxDisplay.read().then((state) => state.preferences),
          )
        : null;
    const before = await view(hostToken);
    display = await page.evaluate(
      (scale) =>
        window.tablemaxDisplay.update({
          resolution: 'auto',
          interfaceScale: scale,
        }),
      Math.round(zoom * 100),
    );
    assert.equal(display.preferences.interfaceScale, Math.round(zoom * 100));
    if (otherPreferences)
      assert.deepEqual(
        await other.evaluate(() =>
          window.tablemaxDisplay.read().then((state) => state.preferences),
        ),
        otherPreferences,
        'Host/public display preferences are independent',
      );
    assert.equal(
      (await view(hostToken)).revision,
      before.revision,
      'Display preferences do not revise the game',
    );
  }
  // A zero desktop override retains native auto scaling and space protection.
  // Mobile is a separate touch simulation with an explicit CSS viewport.
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: mobile ? width : 0,
    height: mobile ? height : 0,
    deviceScaleFactor: 1,
    mobile,
  });
  await session.send('Emulation.setTouchEmulationEnabled', {
    enabled: mobile,
    maxTouchPoints: 5,
  });
  if (mobile)
    await session.send('Emulation.setUserAgentOverride', {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      userAgentMetadata: {
        brands: [{ brand: 'Chromium', version: '130' }],
        platform: 'Android',
        platformVersion: '14',
        architecture: 'arm',
        model: 'Validation phone',
        mobile: true,
        bitness: '64',
        wow64: false,
      },
    });
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  return {
    requested: { width, height, mobile, interfaceScale: zoom * 100 },
    display,
    native: await window.evaluate((native) => ({
      content: native.getContentSize(),
      zoom: native.webContents.getZoomFactor(),
    })),
    actual: await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      dpi: devicePixelRatio,
    })),
  };
}
async function capture(page, label, layout = false) {
  const filename = screenshotPolicy.path(`${currentScenario}-${label}.png`, {
    group: currentScenario,
    label,
    layout,
  });
  if (!filename) return;
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((native) => native.isVisible()), false);
  const png = await window.evaluate(async (native) =>
    (await native.webContents.capturePage()).toPNG(),
  );
  const retained = await writeScreenshot(
    output,
    filename,
    png,
    evidence.screenshotAliases,
    { encodings: evidence.previewEncodings },
  );
  evidence.screenshots.push(retained);
}
async function sampleMemory(page, label, role) {
  const session = await cdp(page);
  const heap = await session.send('Runtime.getHeapUsage');
  const native = await desktop.request('runtime');
  evidence.memory.push({
    scenario: currentScenario,
    label,
    role,
    heap,
    servicePrivateBytes:
      (native.metrics?.find((metric) => metric.type === 'Utility')?.memory
        ?.privateBytes ?? 0) * 1024,
  });
}
async function measure(page, label, role, geometry) {
  // The shared orb repositions over 160 ms when a touch viewport rotates.
  // Read the settled current render, rather than an intermediate CSS frame.
  await wait(220);
  const layout = await surface(page).evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect(),
        s = getComputedStyle(el);
      return (
        !el.closest('[aria-hidden="true"],[hidden]') &&
        s.display !== 'none' &&
        s.visibility !== 'hidden' &&
        r.width > 0 &&
        r.height > 0 &&
        r.right > 0 &&
        r.bottom > 0 &&
        r.left < innerWidth &&
        r.top < innerHeight
      );
    };
    const elements = [
      ...document.querySelectorAll('.uno-screen *,.uno-rules *'),
    ].filter(visible);
    const smallText = elements
      .filter(
        (el) =>
          [...el.childNodes].some(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
          ) && parseFloat(getComputedStyle(el).fontSize) < 15.9,
      )
      .map((el) => ({
        text: el.textContent.trim().slice(0, 80),
        className: el.className,
        font: getComputedStyle(el).fontSize,
      }));
    const controls = elements.filter((el) =>
      el.matches('button,input,select,a'),
    );
    const smallTargets = controls
      .map((el) => ({
        text: el.textContent.trim().slice(0, 60),
        className: el.className,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      }))
      .filter((r) => r.width < 43.9 || r.height < 43.9);
    const seatRects = [...document.querySelectorAll('.uno-seat')]
      .filter(visible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: el.textContent.trim(),
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
        };
      });
    const seatOverlaps = [];
    for (let i = 0; i < seatRects.length; i++)
      for (let j = i + 1; j < seatRects.length; j++) {
        const a = seatRects[i],
          b = seatRects[j];
        if (
          Math.min(a.right, b.right) - Math.max(a.x, b.x) > 2 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 2
        )
          seatOverlaps.push([a.label, b.label]);
      }
    const centralRects = [
      ...document.querySelectorAll(
        '.uno-piles .uno-card,.uno-pile-label,.uno-active-color,.uno-table-pending',
      ),
    ].map((el) => el.getBoundingClientRect());
    const piles = centralRects.length
      ? {
          left: Math.min(...centralRects.map((rect) => rect.left)),
          right: Math.max(...centralRects.map((rect) => rect.right)),
          top: Math.min(...centralRects.map((rect) => rect.top)),
          bottom: Math.max(...centralRects.map((rect) => rect.bottom)),
        }
      : null;
    const pileGaps = piles
      ? seatRects.map((seat) => ({
          label: seat.label,
          gap: Math.max(
            piles.left - seat.right,
            seat.x - piles.right,
            piles.top - seat.bottom,
            seat.y - piles.bottom,
          ),
        }))
      : [];
    const handViewport = document
      .querySelector('.uno-hand-scroll')
      ?.getBoundingClientRect();
    const exposed = [...document.querySelectorAll('.uno-hand-card')].filter(
      (el) => {
        const r = el.getBoundingClientRect();
        return (
          handViewport &&
          r.left >= handViewport.left - 1 &&
          r.left + 44 <= handViewport.right + 1
        );
      },
    ).length;
    const latest = document
      .querySelector('.uno-latest')
      ?.getBoundingClientRect();
    const orb = document
      .querySelector('.interaction-orb')
      ?.getBoundingClientRect();
    const hand = document
      .querySelector('.uno-hand-scroll')
      ?.getBoundingClientRect();
    const intersect = (a, b) =>
      a &&
      b &&
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const orbObscures = orb
      ? [
          ...document.querySelectorAll(
            '.uno-hand-actions button,.uno-hand-card,.uno-active-color,.uno-table-pending',
          ),
        ]
          .filter(visible)
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const target =
              el.matches('.uno-hand-card') && hand
                ? {
                    left: Math.max(r.left, hand.left),
                    top: Math.max(r.top, hand.top),
                    right: Math.min(r.right, hand.right),
                    bottom: Math.min(r.bottom, hand.bottom),
                  }
                : r;
            return intersect(orb, target);
          })
          .map((el) => ({
            label: el.getAttribute('aria-label') ?? el.textContent.trim(),
            className: el.className,
          }))
      : [];
    return {
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      smallText,
      smallTargets,
      seatOverlaps,
      pileGaps,
      exposed,
      firstScreen: {
        latest: latest
          ? {
              top: latest.top,
              bottom: latest.bottom,
              fullyVisible:
                latest.top >= -1 && latest.bottom <= innerHeight + 1,
            }
          : null,
        orbPresent: !!orb,
        orbObscures,
      },
      handCount: document.querySelectorAll('.uno-hand-card').length,
      headings: elements
        .filter((el) => el.matches('h2'))
        .map((el) => ({
          text: el.textContent,
          size: parseFloat(getComputedStyle(el).fontSize),
        })),
    };
  });
  evidence.layouts.push({
    scenario: currentScenario,
    label,
    role,
    geometry,
    ...layout,
  });
  await capture(page, label, true);
  assert.ok(
    layout.scrollWidth <= layout.width + 1,
    `${label}: no horizontal document overflow`,
  );
  assert.deepEqual(
    layout.smallText,
    [],
    `${label}: readable information text >= 16px`,
  );
  assert.deepEqual(
    layout.smallTargets,
    [],
    `${label}: visible touch targets >=44px`,
  );
  assert.deepEqual(
    layout.seatOverlaps,
    [],
    `${label}: seat components do not overlap`,
  );
  if (
    role === 'player' &&
    ['player-320x568', 'player-390x844', 'player-844x390'].includes(label) &&
    ['opening', 'dense'].includes(currentScenario)
  ) {
    assert.equal(
      layout.firstScreen.latest?.fullyVisible,
      true,
      'Short-phone latest saved action is entirely on the first screen',
    );
    assert.deepEqual(
      layout.firstScreen.orbObscures,
      [],
      'Default interaction orb does not overlap draw control or visible hand cards',
    );
  }
  if (role !== 'player')
    assert.ok(
      layout.pileGaps.every((seat) => seat.gap >= 15.9),
      `${label}: seats separated from piles by >=16px`,
    );
  if (role === 'player' && ['opening', 'dense'].includes(currentScenario)) {
    assert.ok(
      layout.exposed >= (label === 'player-390x844' ? 6 : 4),
      `${label}: distinguishable exposed hand cards`,
    );
  }
  if (role !== 'player')
    assert.ok(
      layout.headings.every((heading) => heading.size >= 20),
      `${label}: desktop section headings >=20px`,
    );
  await sampleMemory(page, label, role);
}
async function launch(dataDir, fast = false, executable = executablePath) {
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
    TABLEMAX_PLAY_MODE: fast ? 'test' : 'play',
  };
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  delete env.TABLEMAX_WEB_DEV_URL;
  if (zipPath)
    env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
  desktop = await launchDesktop({
    executablePath: executable,
    args: [
      '--foundation-test',
      fast ? '--tablemax-test-mode' : '--tablemax-play-mode',
    ],
    env,
    soundEnabled: false,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  observe(host);
  await instrumentation(host);
  await host.reload();
  await host.locator('.connection.online').waitFor();
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken);
  hostSocket = await connect(hostToken);
  const nativeRuntime = await desktop.request('runtime');
  assert.equal(
    nativeRuntime.appVersion,
    executable === legacyExecutable
      ? '1.0.5'
      : JSON.parse(await readFile('package.json', 'utf8')).version,
    'Actual native running product version',
  );
  evidence.nativeAppVersion = nativeRuntime.appVersion;
  const health = await (await fetch(origin + '/api/foundation/health')).json();
  assert.equal(health.runtime.node, '22.14.0');
  evidence.checks.push({
    scenario: currentScenario,
    check: 'native package Node health',
    health,
  });
}
async function openPublic() {
  const next = desktop.waitForEvent('window');
  await desktop.request('open-public');
  const page = await next;
  observe(page);
  await instrumentation(page);
  await page.goto(origin + '/public/game');
  await page.locator('.uno-screen').waitFor();
  return page;
}
async function openPhone(index = 0) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, config) => {
      const native = new BrowserWindow({
        show: false,
        width: 390,
        height: 844,
        webPreferences: { partition: config.partition, offscreen: true },
      });
      void native.loadURL(config.url);
    },
    {
      partition: `uno-${name}-${currentScenario}-${index}`,
      url: origin + '/player',
    },
  );
  const page = await next;
  observe(page);
  await instrumentation(page);
  await resize(page, 390, 844, true);
  await page.evaluate((token) => {
    localStorage.setItem('tablemax-player', token);
    localStorage.setItem('tablemax-sound-muted', 'true');
  }, players[index].token);
  await page.goto(origin + '/player/game');
  await page.locator('iframe[data-player-frame]').waitFor();
  await until(() => surface(page) !== page, 'Player game frame attaches');
  await surface(page).locator('.uno-screen').waitFor();
  return page;
}
async function shutdown() {
  for (const socket of sockets) socket.disconnect();
  sockets = [];
  for (const session of cdpSessions.values())
    await session.detach().catch(() => {});
  cdpSessions = new Map();
  if (desktop) await desktop.close();
  desktop = null;
  host = null;
  publicPage = null;
  phone = null;
}
async function privacy() {
  const pub = await view(),
    admin = await view(hostToken);
  assert.equal(pub.gameView.self, null);
  assert.equal(admin.gameView.self, null);
  for (const key of ['hands', 'deck', 'evidenceIds', 'guilty'])
    assert.ok(!Object.hasOwn(pub.gameView, key));
  for (const player of players) {
    const own = await view(player.token);
    assert.equal(own.gameView.self.seatId, player.seatId);
    assert.equal(
      own.gameView.self.hand.length,
      own.gameView.players[player.seatId].handCount,
    );
  }
  for (const page of [host, publicPage].filter(Boolean))
    assert.equal(await surface(page).locator('.uno-hand-card').count(), 0);
  evidence.checks.push({
    scenario: currentScenario,
    check:
      'host/public have no private hands; each human has only own authorized hand',
  });
}
async function rulesCheck(page, token, label) {
  const before = await view(token);
  await surface(page)
    .getByRole('button', { name: '规则', exact: true })
    .click();
  const dialog = surface(page).getByRole('dialog').last();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /500/);
  await measure(
    page,
    `${label}-rules`,
    token === hostToken ? 'host' : token ? 'player' : 'public',
  );
  await dialog.getByRole('button', { name: '关闭面板', exact: true }).click();
  const after = await view(token);
  assert.equal(after.revision, before.revision);
  assert.equal(after.branch, before.branch);
  evidence.checks.push({
    scenario: currentScenario,
    check: `${label}: illustrated rules read-only and closable`,
  });
}
async function audioDecode(page) {
  const base = resolve(runtimeRoot, 'web/games/uno/web/assets');
  async function walk(path) {
    const found = [];
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const next = join(path, entry.name);
      if (entry.isDirectory()) found.push(...(await walk(next)));
      else if (
        /\.(wav|flac)$/i.test(entry.name) &&
        /uno/.test(next.replaceAll('\\', '/'))
      )
        found.push(next);
    }
    return found;
  }
  const files = await walk(base);
  assert.ok(
    files.length >= 9,
    'At least nine distinct local UNO cues packaged',
  );
  const urls = files.map(
    (file) =>
      '/games/uno/web/assets/' +
      file.slice(base.length + 1).replaceAll('\\', '/'),
  );
  const decoded = await page.evaluate(async (paths) => {
    const context = new AudioContext();
    try {
      return await Promise.all(
        paths.map(async (file) => {
          const response = await fetch(file);
          if (!response.ok) throw new Error(file);
          const buffer = await context.decodeAudioData(
            await response.arrayBuffer(),
          );
          let peak = 0,
            energy = 0;
          const samples = buffer.getChannelData(0);
          for (const value of samples) {
            peak = Math.max(peak, Math.abs(value));
            energy += value * value;
          }
          return {
            file,
            seconds: buffer.duration,
            channels: buffer.numberOfChannels,
            sampleRate: buffer.sampleRate,
            peak,
            rms: Math.sqrt(energy / samples.length),
          };
        }),
      );
    } finally {
      await context.close();
    }
  }, urls);
  assert.ok(
    decoded.every(
      (cue) =>
        cue.seconds > 0.08 &&
        cue.seconds < 8 &&
        cue.peak > 0.01 &&
        cue.rms > 0.001,
    ),
  );
  evidence.audio.push(...decoded);
  evidence.checks.push({
    scenario: currentScenario,
    check: `${decoded.length} packaged local cues decoded with nonzero PCM; physically muted`,
  });
}
async function nativeAudioClaims() {
  const key = `uno-verifier:${randomUUID()}`;
  const bridge = await publicPage.evaluate(async (key) => {
    if (!window.tablemaxAudio) return null;
    const owner = await window.tablemaxAudio.connect();
    return {
      owner,
      first: await window.tablemaxAudio.claimEvent(key),
      duplicate: await window.tablemaxAudio.claimEvent(key),
    };
  }, key);
  assert.deepEqual(bridge, { owner: true, first: true, duplicate: false });
  const hostClaim = await host.evaluate(
    (key) => window.tablemaxAudio.claimEvent(key),
    key,
  );
  assert.equal(hostClaim, false);
  assert.equal(
    await surface(phone).evaluate(() => window.tablemaxAudio === undefined),
    true,
  );
  evidence.checks.push({
    scenario: currentScenario,
    check:
      'real native audio owner is public; duplicate and host claims denied; player frame has no native audio bridge',
  });
}
async function handInteractionCheck() {
  await resize(phone, 390, 844, true);
  const frame = surface(phone);
  const snapshot = () =>
    frame.evaluate(() => ({
      ids: [...document.querySelectorAll('.uno-hand-card')].map(
        (el) => el.dataset.cardId,
      ),
      scroll: document.querySelector('.uno-hand-scroll').scrollLeft,
      commands: window.__unoAudit.commands.length,
      plays: window.__unoAudit.plays.length,
    }));
  const initial = await snapshot();
  const revision = (await view(players[0].token)).revision;
  await frame.getByRole('button', { name: '按数字排序', exact: true }).click();
  await frame.getByRole('button', { name: '按颜色排序', exact: true }).click();
  await frame.locator('.uno-hand-scroll').evaluate((el) => {
    el.scrollLeft = 0;
    window.__stableHand = el;
  });
  const illegal = frame.locator('.uno-hand-card[aria-disabled="true"]').first();
  const illegalId = await illegal.getAttribute('data-card-id');
  await illegal.scrollIntoViewIfNeeded();
  const box = await illegal.boundingBox();
  const previous = await frame
    .locator('.uno-hand-card')
    .evaluateAll((els, id) => {
      const index = els.findIndex((el) => el.dataset.cardId === id);
      return els[Math.max(0, index - 1)].dataset.cardId;
    }, illegalId);
  const first = await frame
    .locator(`[data-card-id="${previous}"]`)
    .boundingBox();
  assert.ok(box && first);
  const input = await cdp(phone);
  const touch = (type, x, y) =>
    input.send('Input.dispatchTouchEvent', {
      type,
      touchPoints:
        type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1 }],
    });
  await touch('touchStart', box.x + 22, box.y + 45);
  await wait(370);
  assert.equal(
    await frame.locator('.uno-hand-card--dragging').count(),
    1,
    'Long hold enters drag for an illegal card',
  );
  await touch('touchMove', first.x + 10, first.y + 45);
  await wait(40);
  await touch('touchEnd');
  await wait(100);
  const manual = await snapshot();
  assert.equal(
    manual.ids.indexOf(illegalId) + 1,
    manual.ids.indexOf(previous),
    'Illegal card reordered without playing',
  );
  assert.equal(
    manual.commands,
    initial.commands,
    'Sorting and dragging produce no game commands',
  );
  assert.equal(manual.plays, initial.plays, 'Organizing is silent');
  assert.equal((await view(players[0].token)).revision, revision);
  await frame.locator('.uno-hand-scroll').evaluate((el) => {
    el.scrollLeft = 0;
  });
  const swipeBox = await frame.locator('.uno-hand-card').first().boundingBox();
  await touch('touchStart', swipeBox.x + 22, swipeBox.y + 45);
  await touch('touchMove', swipeBox.x - 70, swipeBox.y + 45);
  await touch('touchEnd');
  await wait(100);
  assert.deepEqual(
    (await snapshot()).ids,
    manual.ids,
    'Quick horizontal swipe does not reorder',
  );
  assert.equal(
    (await view(players[0].token)).revision,
    revision,
    'Swipe does not play',
  );
  await frame.locator('.uno-hand-scroll').evaluate((el) => {
    el.scrollLeft = 0;
  });
  const edgeBox = await frame.locator('.uno-hand-card').first().boundingBox();
  const scrollBox = await frame.locator('.uno-hand-scroll').boundingBox();
  await touch('touchStart', edgeBox.x + 22, edgeBox.y + 45);
  await wait(370);
  await touch('touchMove', scrollBox.x + scrollBox.width - 8, edgeBox.y + 45);
  await wait(180);
  assert.ok((await snapshot()).scroll > 0, 'Held drag autoscrolls at edge');
  await touch('touchCancel');
  await wait(80);
  assert.deepEqual(
    (await snapshot()).ids,
    manual.ids,
    'Canceled edge drag keeps committed order',
  );
  await frame.locator('.uno-hand-scroll').evaluate((el) => {
    el.scrollLeft = 0;
  });
  const cancelBox = await frame.locator('.uno-hand-card').first().boundingBox();
  await touch('touchStart', cancelBox.x + 22, cancelBox.y + 45);
  await wait(370);
  await send(hostSocket, hostToken, { type: 'pause' });
  await until(
    () =>
      frame
        .locator('.uno-hand-card--dragging')
        .count()
        .then((n) => n === 0),
    'Pause cancels pending drag',
  );
  const pausedRevision = (await view(players[0].token)).revision;
  await touch('touchEnd');
  assert.equal(
    (await view(players[0].token)).revision,
    pausedRevision,
    'Canceled drag never plays',
  );
  await send(hostSocket, hostToken, { type: 'resume' });
  await frame.getByRole('button', { name: '积分榜', exact: true }).click();
  assert.equal(await frame.locator('.uno-leaderboard li').count(), count);
  assert.equal(
    await frame.locator('.uno-leaderboard li[data-rank="1"]').count(),
    count,
    'Equal starting scores share rank',
  );
  await frame.getByRole('button', { name: /关闭/ }).last().click();
  await phone.reload();
  await until(
    () =>
      surface(phone)
        .locator('.uno-hand-card')
        .count()
        .then((n) => n === manual.ids.length),
    'Hand restored after refresh',
  );
  assert.deepEqual(
    await surface(phone)
      .locator('.uno-hand-card')
      .evaluateAll((els) => els.map((el) => el.dataset.cardId)),
    manual.ids,
    'Same-tab session order restored',
  );
  await surface(phone)
    .locator('.uno-hand-scroll')
    .evaluate((el) => {
      window.__stableHand = el;
      el.scrollLeft = 123;
      window.__handScrollAnchor = el.scrollLeft;
    });
  const own = await view(players[0].token);
  const draw = own.actions.find((action) => action.type === 'draw');
  assert.ok(draw);
  await send(await connect(players[0].token), players[0].token, {
    type: 'game',
    decisionId: own.decisionId,
    action: draw,
  });
  await until(
    () =>
      surface(phone)
        .locator('.uno-hand-card')
        .count()
        .then((n) => n === manual.ids.length + 1),
    'Draw appears',
  );
  const drawnIds = await surface(phone)
    .locator('.uno-hand-card')
    .evaluateAll((els) => els.map((el) => el.dataset.cardId));
  assert.deepEqual(
    drawnIds.slice(0, -1),
    manual.ids,
    'Draw appends without reordering manual hand',
  );
  assert.equal(
    await surface(phone).evaluate(
      () => window.__stableHand === document.querySelector('.uno-hand-scroll'),
    ),
    true,
    'Saved decision retains hand DOM',
  );
  assert.equal(
    await surface(phone).evaluate(
      () => document.querySelector('.uno-hand-scroll').scrollLeft,
    ),
    await surface(phone).evaluate(() => window.__handScrollAnchor),
    'Saved draw retains horizontal scroll anchor',
  );
  await send(hostSocket, hostToken, { type: 'pause' });
  const saved = await view(hostToken);
  assert.ok(saved.history.at(-1));
  await send(hostSocket, hostToken, {
    type: 'rollback',
    checkpointId: saved.history.at(-1).id,
  });
  await send(hostSocket, hostToken, { type: 'resume' });
  await wait(200);
  assert.deepEqual(
    await surface(phone)
      .locator('.uno-hand-card')
      .evaluateAll((els) => els.map((el) => el.dataset.cardId)),
    manual.ids,
    'Manual order survives branch change',
  );
  evidence.checks.push({
    scenario: currentScenario,
    check:
      'trusted touch: illegal-card drag, sort toggle, swipe isolation, no command/audio, score ties, same-tab refresh and rollback order',
    before: initial.ids,
    after: manual.ids,
  });
}
async function clickCard(id) {
  const card = surface(phone).locator(`button[data-card-id="${id}"]`);
  assert.equal(await card.count(), 1);
  await card.scrollIntoViewIfNeeded();
  const before = await view(players[0].token);
  await card.click({ position: { x: 22, y: 45 } });
  if (
    (await view(players[0].token)).revision === before.revision &&
    (await surface(phone).locator('.uno-wild-selection').count())
  ) {
    await surface(phone)
      .getByRole('button', { name: '红色', exact: true })
      .click();
  }
  await until(
    async () => (await view(players[0].token)).revision > before.revision,
    'Real card UI click produces saved ACK',
  );
}
async function savedVisual(page, game, reduced = false) {
  await until(
    () => page.locator('.uno-saved-effect').count(),
    'A newly saved result renders its actual effect layer',
    3000,
  );
  const visual = await page.evaluate(() => {
    const effect = document.querySelector('.uno-saved-effect');
    return {
      className: effect.className,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      flights: [...effect.querySelectorAll('.uno-flight')].map((node) => {
        const css = getComputedStyle(node);
        return {
          type: node.dataset.flight,
          display: css.display,
          card: node.querySelector('.uno-card')?.getAttribute('aria-label'),
          from: ['--from-x', '--from-y'].map((key) =>
            Number.parseFloat(css.getPropertyValue(key)),
          ),
          to: ['--to-x', '--to-y'].map((key) =>
            Number.parseFloat(css.getPropertyValue(key)),
          ),
        };
      }),
      hiddenMotion: [
        ...effect.querySelectorAll(
          '.uno-flight,.uno-confetti,.uno-effect-ring',
        ),
      ].every((node) => getComputedStyle(node).display === 'none'),
      highlightedSeats: [
        ...document.querySelectorAll('.uno-seat[data-feedback-target="true"]'),
      ].map((node) => node.dataset.seatId),
      activeAnimations: document.getAnimations().map((animation) => ({
        name: animation.animationName,
        duration: animation.effect?.getComputedTiming().duration,
      })),
    };
  });
  evidence.visualSamples ??= [];
  evidence.visualSamples.push({
    scenario: currentScenario,
    phase: game.phase,
    ...visual,
  });
  assert.equal(visual.reduced, reduced);
  assert.ok(
    visual.flights.every((flight) =>
      [...flight.from, ...flight.to].every(Number.isFinite),
    ),
    'Actual card-flight endpoints are computed finite DOM coordinates',
  );
  if (game.latest.card)
    assert.ok(visual.flights.some((flight) => flight.type === 'play'));
  assert.ok(
    visual.flights
      .filter((flight) => flight.type === 'draw')
      .every((flight) => flight.card === 'UNO 牌背'),
    'Penalty/draw flights reveal only card backs',
  );
  if (reduced) {
    assert.equal(visual.hiddenMotion, true);
    assert.ok(
      visual.activeAnimations.every((animation) => animation.duration <= 600),
      'New reduced-motion feedback has only the brief static symbol',
    );
  } else {
    assert.ok(visual.flights.every((flight) => flight.display !== 'none'));
    if (game.phase === 'playing')
      assert.ok(
        visual.flights.every(
          (flight) =>
            Math.hypot(
              flight.from[0] - flight.to[0],
              flight.from[1] - flight.to[1],
            ) > 5,
        ),
        'New saved cards travel between distinct real table positions',
      );
    else
      visual.geometryScope =
        'Result replaces the live table; finite viewport-center fallback with win symbol and confetti.';
    assert.ok(visual.activeAnimations.length > 0);
  }
  return visual;
}
async function newAudioCall(start, expectedCue) {
  await until(
    () =>
      publicPage.evaluate(
        (index) =>
          window.__unoAudit.plays
            .slice(index)
            .some((play) => !play.muted && play.resolved),
        start,
      ),
    'Actual native public owner plays a newly saved local cue while physically muted',
    4000,
  );
  const calls = await publicPage.evaluate(
    (index) => window.__unoAudit.plays.slice(index),
    start,
  );
  assert.ok(
    calls.some(
      (play) =>
        !play.muted &&
        play.resolved &&
        new URL(play.src).pathname.includes(`/${expectedCue}-v1-`),
    ),
    `Saved result uses the ${expectedCue} local cue`,
  );
  return calls;
}
async function reducedSavedAction() {
  for (const player of players) {
    const own = await view(player.token);
    const choice =
      own.actions.find((action) => action.type === 'draw') ??
      own.actions.find((action) => action.type === 'play') ??
      own.actions[0];
    if (!choice) continue;
    const socket = await connect(player.token);
    const audioStart = await publicPage.evaluate(
      () => window.__unoAudit.plays.length,
    );
    await send(socket, player.token, {
      type: 'game',
      decisionId: own.decisionId,
      action: choice,
    });
    const saved = await view();
    const result = {
      action: choice.type,
      revision: saved.revision,
      visual: await savedVisual(publicPage, saved.gameView, true),
    };
    if (choice.type === 'draw')
      result.newSavedAudio = await newAudioCall(audioStart, 'draw');
    return result;
  }
  return null;
}
const gameScores = (game) =>
  game.seatOrder.map((id) => game.players[id].score).sort((a, b) => b - a);
async function uiCase(scenario, prepare) {
  currentScenario = scenario;
  const item = {
    id: scenario,
    result: 'running',
    input:
      'Complete conserved 108-card legal SQLite fixture, shipped validator loads it',
  };
  evidence.cases.push(item);
  const dataDir = join(work, scenario);
  await mkdir(dataDir);
  const fixture = await prepare(scenario, dataDir, count);
  players = fixture.players;
  let legacyState, legacyPreferences;
  if (legacyExecutable) {
    await launch(dataDir, false, legacyExecutable);
    await send(hostSocket, hostToken, { type: 'resume' });
    await send(hostSocket, hostToken, { type: 'pause' });
    legacyState = (await view(players[0].token)).gameView;
    await host.evaluate(() =>
      window.tablemaxDisplay.update({
        resolution: 'auto',
        interfaceScale: 125,
      }),
    );
    legacyPreferences = await host.evaluate(() =>
      window.tablemaxDisplay.read().then((state) => state.preferences),
    );
    await shutdown();
  }
  await launch(dataDir);
  if (legacyState) {
    assert.deepEqual(
      (await view(players[0].token)).gameView,
      legacyState,
      'v1.0.5 actual save restored unchanged',
    );
    assert.deepEqual(
      await host.evaluate(() =>
        window.tablemaxDisplay.read().then((state) => state.preferences),
      ),
      legacyPreferences,
      'v1.0.5 display settings restored',
    );
    evidence.checks.push({
      scenario,
      check:
        'Actual v1.0.5 runtime writes settings/save, v1.0.6 restores game and settings unchanged',
      legacyExecutable,
      legacyExeSha256: hash(await readFile(legacyExecutable)),
    });
  }
  const cover = host.locator('img[alt="UNO游戏封面"]');
  await cover.waitFor();
  const coverSize = await cover.evaluate(async (image) => {
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  assert.deepEqual(
    coverSize,
    [800, 600],
    'Actual local UNO library cover decode',
  );
  item.cover = { dimensions: coverSize, decoded: true };
  await host.goto(origin + '/host/game');
  await host.locator('.uno-screen').waitFor();
  publicPage = await openPublic();
  phone = await openPhone();
  assert.equal((await view()).paused, true);
  await privacy();
  await send(hostSocket, hostToken, { type: 'resume' });
  await until(
    () => surface(phone).locator('.uno-hand-card--legal').first().isEnabled(),
    'Fixture human can act after resume',
  );
  if (!sample && !layoutOnly && evidence.audio.length === 0) {
    await audioDecode(publicPage);
    await nativeAudioClaims();
  }
  if (['opening', 'dense'].includes(scenario)) {
    const phoneSizes = landscape
      ? [[844, 390]]
      : sample || compact
        ? [[320, 568]]
        : [
            [320, 568],
            [390, 844],
            [844, 390],
          ];
    for (const [width, height] of phoneSizes) {
      const geometry = await resize(phone, width, height, true);
      await surface(phone)
        .locator('.uno-hand-scroll')
        .evaluate((el) => {
          el.scrollLeft = 0;
        });
      await measure(phone, `player-${width}x${height}`, 'player', geometry);
      await rulesCheck(phone, players[0].token, `player-${width}x${height}`);
      const cards = surface(phone).locator('.uno-hand-card');
      assert.equal(await cards.count(), fixture.handCount);
      for (const index of [0, (await cards.count()) - 1]) {
        await cards.nth(index).scrollIntoViewIfNeeded();
        const access = await cards.nth(index).evaluate((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + 22, r.y + r.height / 2);
          return {
            inside:
              r.x >= -1 &&
              r.right <= innerWidth + 1 &&
              r.y >= -1 &&
              r.bottom <= innerHeight + 1,
            hit: hit === el || el.contains(hit),
          };
        });
        assert.deepEqual(
          access,
          { inside: true, hit: true },
          'First and last hand card locally scrollable and unobscured',
        );
      }
    }
    for (const [role, page] of [
      ['host', host],
      ['public', publicPage],
    ]) {
      const sizes =
        sample || compact
          ? [[1280, 720, 1]]
          : [
              [1280, 720, 1],
              [1920, 1080, 1],
              [3840, 2160, 1],
              [1280, 720, 1.25],
              [1280, 720, 1.5],
              [1920, 1080, 1.25],
              [1920, 1080, 1.5],
              [3840, 2160, 1.25],
              [3840, 2160, 1.5],
            ];
      for (const [width, height, zoom] of sizes) {
        const geometry = await resize(page, width, height, false, zoom);
        await measure(
          page,
          `${role}-${width}x${height}-zoom-${zoom}`,
          role,
          geometry,
        );
        assert.ok(
          Math.abs(geometry.native.zoom - geometry.display.zoomFactor) < 0.01,
          'Actual native zoom equals saved display settings with space protection',
        );
      }
    }
    if (handInteractions) await handInteractionCheck();
    if (sample || layoutOnly) {
      item.scope = `${scenario} layout only: actual viewport matrix, illustrated rules, private projection, density, pile separation and exposed hand-card access; no natural-match claim.`;
      item.result = 'passed';
      await shutdown();
      return;
    }
    await resize(phone, 390, 844, true);
    await rulesCheck(host, hostToken, 'host');
  }
  await connect(players[0].token);
  if (scenario === 'uno')
    await surface(phone).locator('.uno-call-toggle').click();
  const before = await view(players[0].token);
  const audioStart = await publicPage.evaluate(
    () => window.__unoAudit.plays.length,
  );
  await clickCard(fixture.firstCard);
  const after = await view(players[0].token);
  assert.equal(
    after.gameView.self.hand.length,
    before.gameView.self.hand.length - 1,
  );
  item.savedAction = {
    revision: after.revision,
    branch: after.branch,
    kind: after.gameView.latest.card?.kind,
    phase: after.gameView.phase,
  };
  item.savedVisual = await savedVisual(publicPage, after.gameView);
  const expectedCue = scenario.endsWith('finish')
    ? 'win'
    : scenario === 'uno'
      ? 'uno'
      : ['draw-four', 'challenge'].includes(scenario)
        ? 'draw-four'
        : ['reverse', 'skip', 'draw-two', 'wild'].includes(scenario)
          ? scenario
          : 'place';
  item.newSavedAudio = await newAudioCall(audioStart, expectedCue);
  assert.deepEqual(
    await host.evaluate(() =>
      window.__unoAudit.plays.filter((play) => !play.muted),
    ),
    [],
    'Managed host does not duplicate the public native audio owner',
  );
  if (scenario === 'uno')
    assert.equal(after.gameView.players[players[0].seatId].uno, true);
  if (scenario === 'challenge') {
    const target = after.gameView.drawFour.target;
    const targetPlayer = players.find((player) => player.seatId === target);
    const socket = await connect(targetPlayer.token),
      targetView = await view(targetPlayer.token);
    const challengeAudioStart = await publicPage.evaluate(
      () => window.__unoAudit.plays.length,
    );
    await send(socket, targetPlayer.token, {
      type: 'game',
      decisionId: targetView.decisionId,
      action: { type: 'challenge-draw-four' },
    });
    assert.equal(
      (await view(targetPlayer.token)).gameView.self.challengeEvidence.guilty,
      true,
    );
    assert.equal(
      (await view(players[0].token)).gameView.self.challengeEvidence,
      null,
    );
    assert.equal((await view()).gameView.self, null);
    item.challengeVisual = await savedVisual(
      publicPage,
      (await view()).gameView,
    );
    item.challengeAudio = await newAudioCall(challengeAudioStart, 'challenge');
    item.challenge =
      'Actual +4 challenge saved; proof belongs solely to authorized challenger';
  }
  if (scenario.endsWith('finish')) {
    const expected = scenario === 'match-finish' ? 'ended' : 'round-result';
    assert.equal(after.gameView.phase, expected);
    assert.equal(after.gameView.results.at(-1).winner, players[0].seatId);
    await surface(phone)
      .getByRole('button', { name: '积分榜', exact: true })
      .click();
    const ranks = await surface(phone)
      .locator('.uno-leaderboard li')
      .evaluateAll((rows) =>
        rows.map((row) => ({
          rank: Number(row.dataset.rank),
          score: Number(row.querySelector('span b').textContent),
        })),
      );
    const expectedScores = gameScores(after.gameView);
    assert.deepEqual(
      ranks.map((row) => row.score),
      expectedScores,
      'Actual score leaderboard descending',
    );
    assert.deepEqual(
      ranks.map((row) => row.rank),
      expectedScores.map((score) => expectedScores.indexOf(score) + 1),
      'Actual score leaderboard tied ranks',
    );
    await surface(phone).getByRole('button', { name: /关闭/ }).last().click();

    assert.equal(
      after.gameView.results.at(-1).points,
      Object.values(after.gameView.results.at(-1).handValues).reduce(
        (sum, value) => sum + value,
        0,
      ),
    );
    if (scenario === 'match-finish')
      assert.ok(after.gameView.players[players[0].seatId].score >= 500);
  }
  await capture(host, 'saved-result-host');
  await capture(phone, 'saved-result-player');
  await wait(1800);
  item.actualAnimations = await publicPage.evaluate(
    () => window.__unoAudit?.animations ?? [],
  );
  // Returning to the same game or reloading must initialize with no old event.
  await publicPage.reload();
  await publicPage.locator('.uno-screen').waitFor();
  await wait(200);
  const replay = await publicPage.evaluate(
    () => window.__unoAudit?.plays.filter((play) => !play.muted) ?? [],
  );
  assert.deepEqual(replay, [], 'Reload never replays old saved audio');
  assert.equal(
    await publicPage.locator('.uno-saved-effect').count(),
    0,
    'Reload never replays old saved motion',
  );
  item.reloadHistoricalAudioCalls = replay.length;
  await (
    await cdp(publicPage)
  ).send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  item.reducedMotion = await reducedSavedAction();
  if (after.gameView.phase === 'playing')
    assert.ok(
      item.reducedMotion,
      'A further actual saved action checks reduced motion',
    );
  else
    item.reducedMotionScope =
      'Finished fixture has no next game action; new reduced-motion results are checked in every playing fixture.';
  assert.equal((await view(players[0].token)).self.seatId, players[0].seatId);
  const observer = await connect();
  await send(
    observer,
    '',
    {
      type: 'game',
      decisionId: after.decisionId ?? 'unauthorized',
      action: { type: 'draw' },
    },
    false,
  );
  item.result = 'passed';
  await shutdown();
}
async function workerDecision(playerView, memory, random) {
  assert.equal(
    process.versions.node,
    '22.14.0',
    'Verifier uses same Node version as bundled Worker',
  );
  const task = {
    gameId: 'uno',
    rulesVersion: playerView.gameView.rulesVersion,
    instanceId: playerView.instanceId,
    revision: playerView.revision,
    branch: playerView.branch,
    decision: { id: playerView.decisionId, seatId: playerView.self.seatId },
    view: playerView.gameView,
    actions: playerView.actions,
    data: {
      id: packagedBot.id,
      version: packagedBot.version,
      memory,
      random,
      difficulty: 'juewu',
    },
  };
  const at = performance.now();
  const result = await new Promise((done, reject) => {
    const worker = new Worker(join(runtimeRoot, 'bot-worker.cjs'), {
      workerData: task,
      resourceLimits: { maxOldGenerationSizeMb: 32 },
    });
    let complete = false;
    const finish = (error, value) => {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else done(value);
    };
    const timer = setTimeout(
      () => finish(new Error('UNO human strategy Worker exceeded two seconds')),
      2000,
    );
    worker.once('message', (value) =>
      finish(value.error ? new Error(value.error) : null, value),
    );
    worker.once('error', (error) => finish(error));
    worker.once('exit', () => finish(new Error('UNO strategy Worker exited')));
  });
  assert.ok(
    playerView.actions.some(
      (action) => JSON.stringify(action) === JSON.stringify(result.action),
    ),
    'Shipped Worker chooses an authorized legal action',
  );
  evidence.workerSamples ??= [];
  evidence.workerSamples.push({
    milliseconds: Math.round(performance.now() - at),
    action: result.action.type,
    oldGenerationMiB: 32,
    inputRole: 'own-player-only',
  });
  return result;
}
async function runtimeCase() {
  currentScenario = 'natural-match';
  const item = {
    id: 'natural-match',
    result: 'running',
    input:
      'Natural service initialization and random complete 108-card deck; no fixture state',
  };
  evidence.cases.push(item);
  const dataDir = join(work, 'natural');
  await mkdir(dataDir);
  await launch(dataDir, true);
  if (!(await host.locator('.game-library__item').count()))
    await host.getByRole('button', { name: '切换游戏', exact: true }).click();
  const tile = host.locator('.game-library__item').filter({
    has: host.getByRole('heading', { name: 'UNO', exact: true }),
  });
  await tile.waitFor();
  const select = tile.getByRole('button', { name: '选择游戏', exact: true });
  assert.equal(await select.isEnabled(), true);
  assert.ok(!(await tile.innerText()).includes('开发中'));
  item.libraryTile = await tile.locator('img').evaluate(async (image) => {
    await image.decode();
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      source: image.src,
    };
  });
  assert.deepEqual(
    [item.libraryTile.width, item.libraryTile.height],
    [800, 600],
  );
  const tilePath = join(output, 'natural-match-library-tile.png');
  await captureBrowserScreenshot(tile, { path: tilePath });
  evidence.screenshots.push({
    scenario: currentScenario,
    label: 'library-tile',
    path: tilePath,
    capture: 'actual rendered WebView2 element',
  });
  await select.click();
  await until(
    async () => (await view()).game?.id === 'uno',
    'Actual UNO library selection saves gameId',
  );
  item.librarySelection =
    'Enabled formal UNO tile selected through actual Native library UI';
  packagedBot = require(join(runtimeRoot, 'bots/uno.cjs')).bot;
  const humanCount = count === 2 ? 1 : 2;
  const observeHuman = (player) =>
    player.socket.on('room:view', (incoming) => {
      if (
        incoming.gameView?.gameId === 'uno' &&
        incoming.gameView.self?.seatId === player.seatId
      )
        humanMemory.set(
          player.token,
          packagedBot.observe({
            view: incoming.gameView,
            memory: humanMemory.get(player.token) ?? null,
            seatId: player.seatId,
            difficulty: 'juewu',
          }),
        );
    });
  players = [];
  for (let i = 0; i < humanCount; i++) {
    const reply = await (
      await fetch(origin + '/api/session/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: `UNO真人验收 ${i + 1}`,
          requestKey: randomBytes(32).toString('hex'),
        }),
      })
    ).json();
    assert.equal(reply.ok, true, JSON.stringify(reply));
    const token = reply.token,
      socket = await connect(token),
      playerView = await view(token);
    players.push({
      token,
      socket,
      seatId: playerView.self.seatId,
      random: 6391 + i * 7919,
    });
    await send(socket, token, { type: 'ready', ready: true });
    humanMemory.set(token, null);
  }
  for (let i = humanCount; i < count; i++)
    await send(hostSocket, hostToken, {
      type: 'add-bot',
      name: `UNO电脑 ${i + 1}`,
      difficulty: ['default', 'doubao', 'juewu'][i % 3],
    });
  await send(hostSocket, hostToken, {
    type: 'set-owner',
    seatId: players[0].seatId,
  });
  await send(hostSocket, hostToken, { type: 'start' });
  for (const player of players) observeHuman(player);
  await host.goto(origin + '/host/game');
  await host.locator('.uno-screen').waitFor();
  publicPage = await openPublic();
  phone = await openPhone();
  await privacy();
  await measure(host, 'random-opening-host', 'host');
  await measure(phone, 'random-opening-player', 'player');
  console.log(
    JSON.stringify({
      stage: 'runtime-opening-gate',
      seats: count,
      result: 'passed',
      check: 'actual test-mode host/player text and 390x844 touch geometry',
    }),
  );
  let recoveryDone = false;
  const deadline = performance.now() + 12 * 60 * 1000;
  let observedSerial = -1,
    noProgressAt = performance.now(),
    actions = 0;
  const observedKinds = new Set(),
    naturalRounds = new Map();
  while (performance.now() < deadline && actions < 10000) {
    const publicView = await view(),
      g = publicView.gameView;
    assert.equal(publicView.botError, null);
    if (g.latest?.serial !== observedSerial) {
      observedSerial = g.latest?.serial;
      noProgressAt = performance.now();
    }
    assert.ok(
      performance.now() - noProgressAt < 30000,
      'Natural match makes progress',
    );
    if (g.latest?.card) observedKinds.add(g.latest.card.kind);
    for (const result of g.results)
      naturalRounds.set(result.roundNumber, result);
    if (g.phase === 'ended') {
      assert.equal(g.winners.length, 1);
      assert.ok(g.players[g.winners[0]].score >= 500);
      item.final = {
        roundNumber: g.roundNumber,
        winners: g.winners,
        scores: Object.fromEntries(
          Object.entries(g.players).map(([seat, value]) => [seat, value.score]),
        ),
        results: [...naturalRounds.values()],
      };
      await capture(host, 'natural-500-point-end-host');
      await capture(phone, 'natural-500-point-end-player');
      break;
    }
    if (g.phase === 'round-result') {
      await send(hostSocket, hostToken, {
        type: 'lifecycle',
        action: { type: 'next-round' },
      });
      continue;
    }
    if (!recoveryDone && g.latest.serial >= 12) {
      await send(hostSocket, hostToken, { type: 'pause' });
      const paused = await view(hostToken),
        checkpoint = paused.history.at(-1);
      assert.ok(checkpoint);
      const oldEnvelope = {
        actionId: randomUUID(),
        instanceId: paused.instanceId,
        revision: paused.revision,
        branch: paused.branch,
        command: { type: 'game', decisionId: 'old', action: { type: 'draw' } },
      };
      await send(hostSocket, hostToken, {
        type: 'rollback',
        checkpointId: checkpoint.id,
      });
      const rolled = await view(hostToken);
      assert.ok(rolled.branch > paused.branch);
      assert.equal(rolled.paused, true);
      assert.equal(rolled.ownerSeatId, players[0].seatId);
      const oldReply = await rawSend(players[0].socket, oldEnvelope);
      assert.equal(oldReply.ok, false);
      const savedGame = (await view()).gameView;
      await shutdown();
      await launch(dataDir, true);
      assert.deepEqual(
        (await view()).gameView,
        savedGame,
        'Native/service restart recovers identical game',
      );
      assert.equal((await view()).paused, true);
      assert.equal((await view()).restored, true);
      for (const player of players) {
        player.socket = await connect(player.token);
        humanMemory.set(player.token, null);
        observeHuman(player);
        assert.equal((await view(player.token)).self.seatId, player.seatId);
      }
      await host.goto(origin + '/host/game');
      await host.locator('.uno-screen').waitFor();
      publicPage = await openPublic();
      phone = await openPhone();
      await send(hostSocket, hostToken, { type: 'resume' });
      recoveryDone = true;
      item.recovery = {
        rollbackBranch: rolled.branch,
        oldEnvelopeReason: oldReply.reason,
        identitiesRetained: true,
        restartExactGame: true,
      };
      console.log(
        JSON.stringify({
          stage: 'runtime-recovery',
          seats: count,
          result: 'passed',
          serial: g.latest.serial,
        }),
      );
      continue;
    }
    let humanActed = false;
    for (const player of players) {
      const own = await view(player.token);
      if (!own.actions.length) continue;
      const result = await workerDecision(
        own,
        humanMemory.get(player.token) ?? null,
        player.random,
      );
      const reply = await rawSend(player.socket, {
        actionId: randomUUID(),
        instanceId: own.instanceId,
        revision: own.revision,
        branch: own.branch,
        command: {
          type: 'game',
          decisionId: own.decisionId,
          action: result.action,
        },
      });
      if (
        !reply.ok &&
        ['stale-revision', 'stale-decision'].includes(reply.reason)
      ) {
        item.staleWorkerDiscards = (item.staleWorkerDiscards ?? 0) + 1;
        break;
      }
      assert.equal(reply.ok, true, JSON.stringify(reply));
      humanMemory.set(player.token, result.memory);
      player.random = result.random;
      evidence.commands.push({
        scenario: currentScenario,
        type: 'game',
        action: result.action.type,
        accepted: true,
        workerMs: evidence.workerSamples.at(-1).milliseconds,
      });
      actions++;
      humanActed = true;
      break;
    }
    if (!humanActed) await wait(25);
  }
  assert.ok(
    item.final,
    'Natural random match reaches 500 points within bounded time/actions',
  );
  assert.equal(recoveryDone, true);
  assert.ok(naturalRounds.size >= 1);
  item.humanSavedActions = actions;
  item.observedCardKinds = [...observedKinds];
  item.controllerMix = (await view()).seats.map((seat) => ({
    controller: seat.controller,
    difficulty: seat.botDifficulty,
  }));
  await privacy();
  await sampleMemory(host, 'natural-match-final', 'host');
  item.result = 'passed';
  await shutdown();
}

try {
  await packageAudit('before');
  if (mode === 'runtime') await runtimeCase();
  else {
    const bundle = join(work, 'prepare.cjs');
    await build({
      entryPoints: ['tools/test/fixtures/prepare-uno-ui.ts'],
      outfile: bundle,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      logLevel: 'silent',
    });
    const { prepare, scenarios } = require(bundle);
    assert.ok(only.every((id) => scenarios.includes(id)));
    const selected = only.length ? only : sample ? ['opening'] : scenarios;
    for (const scenario of selected) await uiCase(scenario, prepare);
  }
  assert.deepEqual(evidence.pageErrors, [], 'No game page errors');
  assert.deepEqual(evidence.externalRequests, [], 'No internet runtime assets');
  await packageAudit('after');
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.failures.push({
    scenario: currentScenario,
    message: error.message,
    stack: error.stack,
  });
  const item = evidence.cases.at(-1);
  if (item) item.result = 'failed';
  for (const [label, page] of [
    ['failure-host', host],
    ['failure-player', phone],
  ])
    if (page && !page.isClosed()) await capture(page, label).catch(() => {});
  process.exitCode = 1;
} finally {
  await shutdown().catch((error) => {
    evidence.failures.push({ shutdown: error.message });
    evidence.result = 'failed';
    process.exitCode = 1;
  });
  evidence.elapsedSeconds =
    Math.round((performance.now() - started) / 10) / 100;
  evidence.ownedDesktopClosed = true;
  evidence.screenshotPolicy = {
    mode: screenshotPolicy.mode,
    skipped: screenshotPolicy.skipped,
  };
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  await registerArtifacts({
    output,
    reportPath: join(output, 'results.json'),
    work,
    passed: evidence.result === 'passed',
    policy: screenshotPolicy,
  });
}
console.log(
  JSON.stringify({
    result: evidence.result,
    portable: evidence.portable,
    mode,
    seats: count,
    cases: evidence.cases.map(({ id, result }) => ({ id, result })),
    screenshots: evidence.screenshots.length,
    output,
    elapsedSeconds: evidence.elapsedSeconds,
    failures: evidence.failures.map((item) => item.message ?? item.shutdown),
  }),
);
