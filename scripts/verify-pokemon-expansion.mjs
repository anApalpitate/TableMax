import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';

const portable = process.argv.includes('--portable');
assert.ok(
  process.argv
    .slice(2)
    .every(
      (arg) => arg === '--portable' || /^--evidence=[a-zA-Z0-9_-]+$/.test(arg),
    ),
);
const evidenceName = process.argv
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice(11);
const project = JSON.parse(await readFile('package.json', 'utf8'));
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/pokemon-expansion-runtime-'));
const dataDir = join(work, 'data');
let executablePath = desktopExecutable,
  archiveSha256,
  archive;
if (portable) {
  archive = resolve(
    `artifacts/releases/TableMax-${project.version}-win-x64.zip`,
  );
  const manifest = JSON.parse(
    await readFile(archive.replace('.zip', '-manifest.json'), 'utf8'),
  );
  archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  assert.equal(archiveSha256, manifest.archive.sha256);
  assert.ok(
    manifest.archive.bytes < 100000000 && manifest.extractedBytes < 100000000,
  );
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_EXPANSION_ARCHIVE -DestinationPath $env:TABLEMAX_EXPANSION_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_EXPANSION_ARCHIVE: archive,
        TABLEMAX_EXPANSION_EXTRACT: join(work, 'portable'),
      },
    },
  );
  executablePath = join(work, 'portable', 'TableMax.exe');
}
const output = resolve(
  `artifacts/maintenance/v${project.version}/pokemon-expansion-runtime/${evidenceName ?? (portable ? 'portable-' + archiveSha256.slice(0, 12) : 'build-' + Date.now())}`,
);
await mkdir(dirname(output), { recursive: true });
await mkdir(output, { recursive: false });
const env = {
  ...process.env,
  TABLEMAX_DATA_DIR: dataDir,
  TABLEMAX_HOST: '127.0.0.1',
  TABLEMAX_PORT: '0',
};
delete env.TABLEMAX_WEB_DEV_URL;
delete env.NODE_PATH;
if (portable)
  env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
const evidence = {
  result: 'running',
  portable,
  archiveSha256,
  executablePath,
  dataDir,
  started: new Date().toISOString(),
  scope:
    'Actual hidden WinForms/WebView2 and actual service Socket intents; phone viewports simulated, no physical-phone/Windows-DPI/voice-listening claim. Pose completeness is recorded by the separate actual animation verification.',
  checks: [],
  screenshots: [],
  pageErrors: [],
  externalRequests: [],
  phases: [],
  actionCounts: {},
  resources: [],
  runs: [],
  stopped: [],
};
let desktop,
  origin,
  hostToken,
  host,
  phones,
  tokens = [],
  sockets = [];
let beforeRestart;
const phases = new Set();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function view(token) {
  const reply = await (
    await fetch(`${origin}/api/session/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(reply.ok, true);
  return reply.view;
}
async function connect(token) {
  const socket = io(origin, {
    auth: { token },
    forceNew: true,
    transports: ['websocket'],
  });
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  sockets.push(socket);
  return socket;
}
async function command(socket, token, value) {
  const initial = await view(token);
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = attempt ? await view(token) : initial;
    assert.equal(current.instanceId, initial.instanceId);
    assert.equal(current.branch, initial.branch);
    const reply = await new Promise((done, reject) =>
      socket.timeout(8000).emit(
        'room:command',
        {
          actionId: randomUUID(),
          instanceId: current.instanceId,
          revision: current.revision,
          branch: current.branch,
          command: value,
        },
        (error, result) => (error ? reject(error) : done(result)),
      ),
    );
    if (
      !reply.ok &&
      reply.reason === 'stale-revision' &&
      value.type === 'pause' &&
      attempt < 7
    ) {
      evidence.pauseRevisionRetries = (evidence.pauseRevisionRetries ?? 0) + 1;
      await wait(30);
      continue;
    }
    assert.equal(reply.ok, true, JSON.stringify(reply));
    return reply;
  }
  throw new Error('Pause retry limit exhausted');
}
function observe(page) {
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => evidence.pageErrors.push(e.message));
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== origin)
      evidence.externalRequests.push(r.url());
  });
}
async function screenshot(page, name) {
  const native = await desktop.browserWindow(page);
  assert.equal(await native.evaluate((w) => w.isVisible()), false);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await wait(120);
  const png = await native.evaluate(async (w) =>
    (await w.webContents.capturePage()).toPNG().toString('base64'),
  );
  await writeFile(join(output, name + '.png'), Buffer.from(png, 'base64'));
  evidence.screenshots.push(name + '.png');
}
async function phone(index) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, config) => {
      const w = new BrowserWindow({
        show: false,
        width: config.width,
        height: config.height,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          offscreen: true,
          backgroundThrottling: false,
          partition: `persist:expansion-${config.index}`,
        },
      });
      void w.loadURL(config.url);
    },
    {
      url: `${origin}/player`,
      width: index ? 390 : 360,
      height: index ? 844 : 640,
      index,
    },
  );
  const page = await next;
  observe(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: index ? 390 : 360,
    height: index ? 844 : 640,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  await page.locator('.connection.online').waitFor();
  return page;
}
async function launch() {
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-test-mode'],
    env,
    timeout: 30000,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  env.TABLEMAX_PORT = new URL(origin).port;
  observe(host);
  await host
    .context()
    .route('**/*', (route) =>
      new URL(route.request().url()).hostname === '127.0.0.1'
        ? route.continue()
        : route.abort(),
    );
  await host.reload();
  await host.locator('.connection.online').waitFor();
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken);
  const health = await (await fetch(`${origin}/api/foundation/health`)).json();
  assert.equal(health.protocolVersion, 7);
  assert.equal(health.runtime.node, '22.14.0');
  evidence.runs.push({ health, origin });
  return connect(hostToken);
}
async function publicScreen() {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(({ BrowserWindow }, url) => {
    const w = new BrowserWindow({
      show: false,
      width: 1280,
      height: 720,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        offscreen: true,
        backgroundThrottling: false,
      },
    });
    void w.loadURL(url);
  }, `${origin}/public/game`);
  const page = await next;
  observe(page);
  await page.locator('.expansion-screen').waitFor();
  assert.equal(await page.locator('.ex-submit button').count(), 0);
  await screenshot(page, 'public-expansion-start');
  return page;
}
async function displayCheck(page, width, height, name) {
  const native = await desktop.browserWindow(page);
  await native.evaluate((w, size) => w.setBounds({ x: 0, y: 0, ...size }), {
    width,
    height,
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: name.includes('phone'),
  });
  await page.evaluate(() => scrollTo(0, 0));
  await wait(150);
  const geometry = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        getComputedStyle(el).visibility !== 'hidden'
      );
    };
    const text = [...document.querySelectorAll('.expansion-screen *')].filter(
      (el) =>
        visible(el) &&
        [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
        ),
    );
    const buttons = [
      ...document.querySelectorAll('.expansion-screen button'),
    ].filter(visible);
    return {
      width: innerWidth,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
      tiny: text
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => el.textContent.trim()),
      smallTouch: buttons
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width < 44 || r.height < 44;
        })
        .map((el) => el.textContent.trim()),
      fieldSlots: [...document.querySelectorAll('.ex-player [data-slot]')].map(
        (el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            visible:
              r.width > 0 &&
              r.height > 0 &&
              getComputedStyle(el).visibility !== 'hidden',
            outside:
              r.left < -1 ||
              r.top < -1 ||
              r.right > innerWidth + 1 ||
              r.bottom > innerHeight + 1,
          };
        },
      ),
    };
  });
  evidence.displayChecks ??= [];
  evidence.displayChecks.push({
    name,
    requestedWidth: width,
    requestedHeight: height,
    ...geometry,
  });
  await screenshot(page, name);
  // The current redesign preserves readable cards with one-axis scrolling on
  // short/high-scale windows and when pause/management notices need extra room.
  // Verify real scrolling, rather than accepting a larger document blindly.
  const scrollUnreachable = [];
  if (!name.includes('phone') && geometry.fieldSlots.some((s) => s.outside)) {
    for (const slot of await page.locator('.ex-player [data-slot]').all()) {
      await slot.scrollIntoViewIfNeeded();
      const bounds = await slot.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.slot,
          inside:
            r.left >= -1 &&
            r.top >= -1 &&
            r.right <= innerWidth + 1 &&
            r.bottom <= innerHeight + 1,
        };
      });
      if (!bounds.inside) scrollUnreachable.push(bounds.id);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  evidence.displayChecks.at(-1).scrollUnreachable = scrollUnreachable;
}
async function shutdown() {
  for (const s of sockets) s.disconnect();
  sockets = [];
  if (desktop) {
    await desktop.close();
    desktop = null;
  }
  if (origin) {
    let alive = true;
    for (let i = 0; i < 30 && alive; i++) {
      try {
        await fetch(`${origin}/api/foundation/health`, {
          signal: AbortSignal.timeout(400),
        });
      } catch {
        alive = false;
      }
      if (alive) await wait(100);
    }
    assert.equal(alive, false, 'Service should stop with native host');
    evidence.stopped.push(origin);
  }
}
function choose(player) {
  const actions = player.actions,
    g = player.gameView,
    own = player.self.seatId;
  for (const type of [
    'activate-arceus',
    'extra-draw',
    'pass-direction',
    'mewtwo-target',
    'mewtwo-exchange',
    'peek',
    'close-peek',
    'swap',
    'row-target',
  ]) {
    const a = actions.find((a) => a.type === type);
    if (a) return a;
  }
  const ninja = actions.find(
    (a) => a.type === 'ninja-target' && a.seat !== own && !a.swap,
  );
  if (ninja) return ninja;
  const hidden = actions.find(
    (a) =>
      ['replace', 'mew-target'].includes(a.type) &&
      !g.boards['seat' in a ? a.seat : own][a.slot].faceUp,
  );
  if (hidden) return hidden;
  const replace = actions.find((a) => a.type === 'replace');
  if (replace) return replace;
  const draw =
    actions.find((a) => a.type === 'draw' && a.source === 'deck') ??
    actions.find((a) => a.type === 'draw');
  if (draw) return draw;
  return actions.find((a) => a.type === 'decline-ability') ?? actions[0];
}
async function driveRound() {
  for (let step = 0; step < 1500; step++) {
    const publicView = await view();
    const phase = publicView.gameView.phase;
    phases.add(phase);
    if (['round-result', 'match-result'].includes(phase)) return publicView;
    let acted = false;
    for (let i = 0; i < tokens.length; i++) {
      const player = await view(tokens[i]);
      phases.add(player.gameView.phase);
      if (!player.actions.length) continue;
      const action = choose(player);
      await command(sockets[i + 1], tokens[i], {
        type: 'game',
        decisionId: player.decisionId,
        action,
      });
      evidence.actionCounts[action.type] =
        (evidence.actionCounts[action.type] ?? 0) + 1;
      acted = true;
      break;
    }
    assert.equal(
      acted,
      true,
      'Every live decision must have a legal human action',
    );
  }
  throw Error('Round exceeded 1500 authorized actions');
}
try {
  let hostSocket = await launch();
  assert.equal((await view(hostToken)).game, null);
  await command(hostSocket, hostToken, {
    type: 'select-game',
    gameId: 'pokemon-encounters',
  });
  assert.equal((await view(hostToken)).game.variantId, 'original');
  await host
    .getByRole('button', { name: '版本：原版', exact: true })
    .first()
    .click();
  await host.getByRole('button', { name: '扩展版', exact: true }).click();
  await host.waitForFunction(() =>
    document.body.textContent.includes('版本：扩展版'),
  );
  assert.equal((await view(hostToken)).game.variantId, 'expansion');
  await host.getByRole('button', { name: '游戏介绍', exact: true }).click();
  const introduction = await host.locator('.game-introduction').textContent();
  assert.ok(introduction.includes('九张') && introduction.includes('投票'));
  assert.equal(introduction.includes('每人六张'), false);
  await screenshot(host, 'lobby-expansion-nine-card-vote-introduction');
  await host.keyboard.press('Escape');
  evidence.checks.push(
    'Actual administrator version selector changes authoritative original to expansion; production lobby introduction states nine cards and research voting',
  );
  phones = [await phone(0), await phone(1)];
  for (let i = 0; i < phones.length; i++) {
    await phones[i].getByLabel('你的昵称').fill('扩展验收' + (i + 1));
    await phones[i].getByRole('button', { name: '加入', exact: true }).click();
    await phones[i]
      .getByRole('button', { name: '我准备好了', exact: true })
      .click();
    await phones[i]
      .getByRole('button', { name: '取消准备', exact: true })
      .waitFor();
    const token = await phones[i].evaluate(() =>
      localStorage.getItem('tablemax-player'),
    );
    assert.ok(token);
    tokens.push(token);
    await connect(token);
  }
  const seatIdentity = (await view()).seats.map((s) => ({
    id: s.id,
    name: s.name,
    avatarId: s.avatarId,
  }));
  await command(hostSocket, hostToken, { type: 'start' });
  for (const p of phones) {
    await p.waitForURL('**/player/game');
    await p.locator('.ex-vote').waitFor();
  }
  assert.equal((await view()).gameView.phase, 'research-vote');
  const candidates = (await view()).gameView.researchCandidates;
  assert.equal(new Set(candidates.map((t) => t.id)).size, 3);
  await phones[0].locator('.ex-mission-option').nth(0).click();
  await phones[0]
    .getByText(/等待其他玩家/)
    .first()
    .waitFor();
  const other = await view(tokens[1]);
  assert.equal(other.gameView.ownVote, null);
  assert.equal(other.gameView.voteCounts, null);
  assert.equal(other.gameView.votedSeats.length, 1);
  await screenshot(phones[0], 'vote-first-private-lock');
  await phones[1].locator('.ex-mission-option').nth(1).click();
  for (const p of phones) await p.locator('.ex-target-board').waitFor();
  const selected = await view();
  assert.equal(selected.gameView.phase, 'initial-flip');
  assert.equal(selected.gameView.voteCounts[candidates[0].id], 1);
  assert.equal(selected.gameView.voteCounts[candidates[1].id], 1);
  assert.ok(
    [candidates[0].id, candidates[1].id].includes(
      selected.gameView.activeResearch[0].id,
    ),
  );
  evidence.checks.push(
    'Production phone UI private locked votes, two-way top tie, saved random selection before dealing',
  );
  for (const p of phones) {
    await p.locator('.ex-target-board [data-slot]').nth(0).click();
    await p.locator('.ex-submit button').click();
  }
  await host.waitForURL('**/host/game');
  await host.locator('.expansion-screen').waitFor();
  await screenshot(host, 'host-expansion-start');
  await screenshot(phones[0], 'phone-nine-grid-start');
  await publicScreen();
  const current = await view();
  assert.deepEqual(current.actions, []);
  assert.equal(current.gameView.peek, null);
  assert.equal(JSON.stringify(current.gameView).includes('#'), false);
  assert.ok(
    Object.values(current.gameView.boards).every((b) => b.length === 9),
  );
  for (const p of phones) {
    assert.equal(await p.locator('.sound-control').count(), 0);
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  const assets = await readdir(
    join(dirname(executablePath), 'web/games/pokemon-encounters/web/assets'),
  );
  const portraitManifest = JSON.parse(
    await readFile(
      'assets/games/pokemon-encounters/expansion/portraits/portraits.json',
      'utf8',
    ),
  );
  for (const asset of portraitManifest.assets) {
    const built = assets.find(
      (name) =>
        name.startsWith(asset.creatureId + '-official-v1-') &&
        name.endsWith('.webp'),
    );
    assert.ok(built, 'Built portrait ' + asset.creatureId);
    const resourceBytes = await readFile(
      join(
        dirname(executablePath),
        'web/games/pokemon-encounters/web/assets',
        built,
      ),
    );
    const resourceSha256 = createHash('sha256')
      .update(resourceBytes)
      .digest('hex');
    assert.equal(
      resourceSha256,
      asset.sha256,
      'Exact packaged portrait bytes ' + asset.creatureId,
    );
    const decoded = await phones[0].evaluate(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, `${origin}/games/pokemon-encounters/web/assets/${built}`);
    assert.equal(decoded.width, 384);
    assert.equal(decoded.height, 384);
    evidence.resources.push({
      creatureId: asset.creatureId,
      built,
      sha256: resourceSha256,
      bytes: resourceBytes.length,
      ...decoded,
    });
  }
  evidence.checks.push(
    '18 production glob portrait URLs decoded locally while external requests are blocked; private cards do not appear in public projection',
  );
  const lossless = JSON.parse(
    await readFile(
      'assets/games/pokemon-encounters/characters/lossless-runtime.json',
      'utf8',
    ),
  );
  assert.equal(lossless.assets.length, 16);
  evidence.losslessCards = [];
  for (const asset of lossless.assets) {
    const stem = asset.runtime.split('/').at(-1).replace('.webp', '');
    const sourceStem = asset.source.split('/').at(-1).replace('.png', '');
    const built = assets.find(
      (name) => name.startsWith(stem + '-') && name.endsWith('.webp'),
    );
    assert.ok(built, 'Lossless runtime card ' + stem);
    assert.ok(
      !assets.some(
        (name) => name.startsWith(sourceStem + '-') && name.endsWith('.png'),
      ),
    );
    const sourceBytes = await readFile(asset.source);
    const runtimeBytes = await readFile(
      join(
        dirname(executablePath),
        'web/games/pokemon-encounters/web/assets',
        built,
      ),
    );
    assert.equal(
      createHash('sha256').update(sourceBytes).digest('hex'),
      asset.sourceSha256,
    );
    assert.equal(
      createHash('sha256').update(runtimeBytes).digest('hex'),
      asset.runtimeSha256,
    );
    const decoded = await phones[0].evaluate(
      async ({ source, runtime }) => {
        const pixels = async (url) => {
          const image = new Image();
          image.src = url;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0);
          return {
            dimensions: [canvas.width, canvas.height],
            rgba: context.getImageData(0, 0, canvas.width, canvas.height).data,
          };
        };
        const original = await pixels(source),
          converted = await pixels(runtime);
        return {
          dimensions: converted.dimensions,
          sourceDimensions: original.dimensions,
          browserRgbaEqual:
            original.rgba.length === converted.rgba.length &&
            original.rgba.every(
              (value, index) => value === converted.rgba[index],
            ),
        };
      },
      {
        source: 'data:image/png;base64,' + sourceBytes.toString('base64'),
        runtime: `${origin}/games/pokemon-encounters/web/assets/${built}`,
      },
    );
    assert.deepEqual(decoded.dimensions, asset.dimensions);
    assert.deepEqual(decoded.sourceDimensions, asset.dimensions);
    assert.equal(
      decoded.browserRgbaEqual,
      true,
      'Actual browser colors and alpha ' + stem,
    );
    evidence.losslessCards.push({
      built,
      bytes: runtimeBytes.length,
      sha256: asset.runtimeSha256,
      sourceSha256: asset.sourceSha256,
      ...decoded,
    });
  }
  evidence.checks.push(
    '16 lossless cards and coin faces decode offline with exact browser RGBA equality; original PNGs preserved outside runtime payload',
  );
  const audioManifest = JSON.parse(
    await readFile(
      'assets/games/pokemon-encounters/expansion/audio/themes.json',
      'utf8',
    ),
  );
  evidence.themeAudio = [];
  for (const asset of audioManifest.assets) {
    const built = assets.find(
      (name) =>
        name.startsWith(asset.id + '-theme-original-v1-') &&
        name.endsWith('.ogg'),
    );
    assert.ok(built, 'Packaged original theme ' + asset.id);
    const bytes = await readFile(
      join(
        dirname(executablePath),
        'web/games/pokemon-encounters/web/assets',
        built,
      ),
    );
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      asset.sha256,
    );
    const decoded = await phones[0].evaluate(async (url) => {
      const audio = new AudioContext();
      try {
        const buffer = await audio.decodeAudioData(
          await (await fetch(url)).arrayBuffer(),
        );
        let peak = 0;
        for (const sample of buffer.getChannelData(0))
          peak = Math.max(peak, Math.abs(sample));
        return {
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
          channels: buffer.numberOfChannels,
          peak,
        };
      } finally {
        await audio.close();
      }
    }, `${origin}/games/pokemon-encounters/web/assets/${built}`);
    assert.equal(decoded.channels, 1);
    assert.ok(Math.abs(decoded.duration - asset.seconds) < 0.002);
    assert.ok(decoded.peak > 0.1 && decoded.peak < 0.8);
    evidence.themeAudio.push({
      id: asset.id,
      built,
      sha256: asset.sha256,
      bytes: bytes.length,
      ...decoded,
      officialCharacterCry: false,
      humanListeningVerified: false,
    });
  }
  assert.equal(evidence.themeAudio.length, 8);
  evidence.checks.push(
    'Eight original ability/research Ogg/Opus themes match packaged bytes and decode offline in actual WebView2; official voices/human listening not claimed',
  );
  const cryManifest = JSON.parse(
    await readFile(
      'assets/games/pokemon-encounters/expansion/audio/cries/manifest.json',
      'utf8',
    ),
  );
  evidence.cryAudio = [];
  for (const asset of cryManifest.assets) {
    const built = assets.find(
      (name) =>
        name.startsWith(asset.id + '-encyclopedia-cry-v1-') &&
        name.endsWith('.ogg'),
    );
    assert.ok(built, 'Packaged encyclopedia cry ' + asset.id);
    const bytes = await readFile(
      join(
        dirname(executablePath),
        'web/games/pokemon-encounters/web/assets',
        built,
      ),
    );
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      asset.sha256,
    );
    const decoded = await phones[0].evaluate(async (url) => {
      const audio = new AudioContext();
      try {
        const buffer = await audio.decodeAudioData(
          await (await fetch(url)).arrayBuffer(),
        );
        let peak = 0;
        for (const sample of buffer.getChannelData(0))
          peak = Math.max(peak, Math.abs(sample));
        return {
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
          channels: buffer.numberOfChannels,
          peak,
        };
      } finally {
        await audio.close();
      }
    }, `${origin}/games/pokemon-encounters/web/assets/${built}`);
    assert.equal(decoded.channels, 1);
    assert.ok(Math.abs(decoded.duration - asset.seconds) < 0.02);
    assert.ok(Number.isFinite(decoded.peak) && decoded.peak > 0.01);
    evidence.cryAudio.push({
      id: asset.id,
      built,
      sha256: asset.sha256,
      bytes: bytes.length,
      ...decoded,
      sourceGameGenerationVerified: false,
      humanListeningVerified: false,
    });
  }
  assert.equal(evidence.cryAudio.length, 27);
  evidence.checks.push(
    '27 Chinese encyclopedia linked game cries match derived encoding hashes and decode offline in actual WebView2; source bytes are archived, game generation, reuse license and human listening remain unverified',
  );
  const result = await driveRound();
  assert.ok(result.gameView.roundResult);
  assert.ok(
    Object.values(result.gameView.roundResult.scores).every(
      (s) => s.total === s.base - s.deduction,
    ),
  );
  assert.ok(
    Object.values(evidence.actionCounts).reduce((a, b) => a + b, 0) > 0,
  );
  assert.ok(
    Object.keys(evidence.actionCounts).some((k) =>
      [
        'activate-arceus',
        'extra-draw',
        'pass-direction',
        'mewtwo-target',
        'mewtwo-exchange',
        'peek',
        'swap',
        'row-target',
        'ninja-target',
        'mew-target',
      ].includes(k),
    ),
    'Real shuffled round should exercise a legal special ability',
  );
  await phones[0].locator('.ex-victory').waitFor();
  await screenshot(host, 'host-complete-round');
  await screenshot(phones[0], 'phone-complete-round');
  beforeRestart = (await view(tokens[0])).gameView;
  const roundNumber = beforeRestart.roundNumber;
  evidence.checks.push(
    'Actual shuffled full technical round completes via authorized real Socket decisions and research score decomposition',
  );
  await shutdown();
  hostSocket = await launch();
  phones = [await phone(0), await phone(1)];
  for (let i = 0; i < phones.length; i++) {
    assert.equal(
      await phones[i].evaluate(() => localStorage.getItem('tablemax-player')),
      tokens[i],
    );
    await connect(tokens[i]);
  }
  const restored = await view(tokens[0]);
  assert.deepEqual(restored.gameView, beforeRestart);
  assert.equal(restored.game.variantId, 'expansion');
  assert.equal(restored.paused, true);
  assert.deepEqual(
    (await view()).seats.map((s) => ({
      id: s.id,
      name: s.name,
      avatarId: s.avatarId,
    })),
    seatIdentity,
  );
  await screenshot(host, 'restored-expansion-round');
  await command(hostSocket, hostToken, { type: 'resume' });
  await command(hostSocket, hostToken, {
    type: 'lifecycle',
    action: { type: 'next-round' },
  });
  const next = await view();
  assert.equal(next.gameView.roundNumber, roundNumber + 1);
  assert.equal(next.gameView.phase, 'research-vote');
  assert.equal(next.gameView.arceusUsed, false);
  assert.equal(next.gameView.activeResearch.length, 0);
  evidence.checks.push(
    'Native/service restart recovers identical expansion result, player identities and paused boundary; resume/next-round creates a fresh three-candidate vote',
  );
  await command(hostSocket, hostToken, { type: 'end' });
  await host.goto(`${origin}/host`);
  await host.locator('.connection.online').waitFor();
  await command(hostSocket, hostToken, {
    type: 'select-variant',
    variantId: 'original',
  });
  const original = await view(hostToken);
  assert.equal(original.game.variantId, 'original');
  assert.deepEqual(
    original.seats.map((s) => ({
      id: s.id,
      name: s.name,
      avatarId: s.avatarId,
    })),
    seatIdentity,
  );
  assert.ok(original.seats.every((s) => !s.ready));
  for (let i = 0; i < tokens.length; i++)
    await command(sockets[i + 1], tokens[i], { type: 'ready', ready: true });
  await command(hostSocket, hostToken, { type: 'start' });
  const classic = await view();
  assert.ok(
    Object.values(classic.gameView.boards).every((b) => b.length === 6),
  );
  evidence.checks.push(
    'End and original variant switch preserves seats/identity/avatar, clears ready; fresh original game still has six slots',
  );
  await screenshot(host, 'original-six-grid-after-switch');
  await command(hostSocket, hostToken, { type: 'end' });
  await command(hostSocket, hostToken, {
    type: 'select-variant',
    variantId: 'expansion',
  });
  for (let i = 0; i < 4; i++)
    await command(hostSocket, hostToken, {
      type: 'add-bot',
      name: '显示验收' + (i + 3),
      difficulty: 'default',
    });
  for (let i = 0; i < tokens.length; i++)
    await command(sockets[i + 1], tokens[i], { type: 'ready', ready: true });
  await command(hostSocket, hostToken, { type: 'start' });
  for (let i = 0; i < tokens.length; i++) {
    const player = await view(tokens[i]);
    const vote = player.actions.find((a) => a.type === 'vote-research');
    assert.ok(vote);
    await command(sockets[i + 1], tokens[i], {
      type: 'game',
      decisionId: player.decisionId,
      action: vote,
    });
  }
  for (
    let i = 0;
    i < 150 && (await view()).gameView.phase === 'research-vote';
    i++
  )
    await wait(100);
  assert.ok(
    Object.values((await view()).gameView.boards).every((b) => b.length === 9),
  );
  assert.equal((await view()).seats.length, 6);
  await command(hostSocket, hostToken, { type: 'pause' });
  await host.goto(`${origin}/host/game`);
  await host.locator('.expansion-screen').waitFor();
  const publicPage = await publicScreen();
  for (const [width, height] of [
    [3840, 2160],
    [1920, 1080],
    [1280, 720],
    [1024, 576],
    [854, 480],
  ]) {
    await displayCheck(host, width, height, `host-six-${width}x${height}`);
    await displayCheck(
      publicPage,
      width,
      height,
      `public-six-${width}x${height}`,
    );
  }
  await phones[0].goto(`${origin}/player/game`);
  await phones[0].locator('.expansion-screen').waitFor();
  await displayCheck(phones[0], 320, 568, 'phone-six-320x568');
  assert.deepEqual(
    evidence.displayChecks.filter(
      (g) =>
        g.overflow ||
        g.tiny.length ||
        g.smallTouch.length ||
        (!g.name.includes('phone') &&
          (g.fieldSlots.length !== 54 ||
            g.fieldSlots.some((s) => !s.visible) ||
            g.scrollUnreachable.length)),
    ),
    [],
    'Actual production display matrix must pass fonts/touch, preserve all 54 cards and prove each off-screen card reachable by real vertical scrolling',
  );
  evidence.checks.push(
    'Actual six-seat saved expansion game production host/public/phone display matrix: requested 4K (host native usable space may be constrained, actual dimensions recorded), 1080p, 720p, 1024x576, 854x480 and 320x568; 54 desktop cards preserved and every off-screen card reached by actual one-axis scrolling, no horizontal overflow, text >=16px and touch >=44px. Simulated viewport only, Windows DPI pending',
  );
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  if (portable)
    assert.equal(
      createHash('sha256')
        .update(await readFile(archive))
        .digest('hex'),
      archiveSha256,
      'Verified ZIP must remain identical during run',
    );
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = error.stack;
  throw error;
} finally {
  try {
    await shutdown();
  } finally {
    evidence.phases = [...phases];
    evidence.finished = new Date().toISOString();
    await writeFile(
      join(output, 'results.json'),
      JSON.stringify(evidence, null, 2) + '\n',
    );
    console.log(
      JSON.stringify({
        result: evidence.result,
        portable,
        archiveSha256,
        output,
        checks: evidence.checks.length,
        phases: evidence.phases,
      }),
    );
  }
}
