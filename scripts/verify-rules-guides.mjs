import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';
import { verificationOutput } from './verification-output.mjs';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const captureRules = process.argv.includes('--capture-rules');
const game =
  process.argv.find((arg) => arg.startsWith('--game='))?.slice(7) ?? 'all';
assert.ok(
  ['all', 'pokemon-encounters', 'modern-art', 'power-grid'].includes(game),
);
assert.ok(!captureRules || game === 'all' || game === 'pokemon-encounters');
const maintenance =
  process.argv.find((arg) => arg.startsWith('--maintenance='))?.slice(14) ??
  'shared-visual-20261004';
assert.match(maintenance, /^[a-z0-9-]{1,40}$/);
assert.ok(
  !portable || !captureRules,
  'Capture assets from source before freezing the package',
);
const run =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  (portable ? 'portable' : 'source');
assert.match(run, /^[a-z0-9-]{1,48}$/);
const output = verificationOutput(maintenance, 'rules', run);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/modern-art-polish-'));
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const start = performance.now();
const report = {
  startedAt: new Date().toISOString(),
  portable,
  captureRules,
  scope:
    'Actual hidden native WebView2 with isolated legal rules-generated SQLite examples and independent phone identities; no physical device or human listening certification',
  work,
  checks: [],
  assets: [],
  runtimes: [],
  screenshots: [],
  pageErrors: [],
  externalRequests: [],
  closed: [],
};
let executablePath = desktopExecutable;
if (portable) {
  const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
  report.archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  report.extractedDir = join(work, 'portable');
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_RULES_ARCHIVE -DestinationPath $env:TABLEMAX_RULES_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_RULES_ARCHIVE: archive,
        TABLEMAX_RULES_EXTRACT: report.extractedDir,
      },
    },
  );
  executablePath = join(report.extractedDir, 'TableMax.exe');
}
await build({
  entryPoints: ['scripts/fixtures/prepare-rules-guides.ts'],
  outfile: join(work, 'prepare.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const { prepare, preparePokemonSixDraw, prepareGrid } = require(
  join(work, 'prepare.cjs'),
);
const includes = (id) => game === 'all' || game === id;
const pokemon = includes('pokemon-encounters')
  ? await preparePokemonSixDraw(work, captureRules)
  : undefined;
const modern =
  !captureRules && includes('modern-art') ? await prepare(work, 5) : undefined;
const grid =
  !captureRules && includes('power-grid') ? await prepareGrid(work) : undefined;
const cases = [
  {
    id: 'pokemon-encounters',
    dataDir: pokemon?.dataDir,
    players: pokemon?.players,
    root: '.pokemon-screen',
    images: 3,
  },
  {
    id: 'modern-art',
    dataDir: modern?.cases.find((c) => c.id === 'offer').dataDir,
    players: modern?.players,
    root: '.ma-screen',
    images: 9,
  },
  {
    id: 'power-grid',
    dataDir: grid?.dataDir,
    players: grid?.players,
    root: '.pg-screen',
    images: 0,
    diagrams: ['flow', 'resources', 'storage', 'network', 'steps', 'income'],
  },
].filter((entry) => includes(entry.id));
let desktop, origin, host, hostToken;
const sockets = [];
async function current(token = '') {
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
async function send(token, command) {
  const view = await current(token);
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: { token },
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  const result = await new Promise((done, reject) =>
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: view.instanceId,
        branch: view.branch,
        revision: view.revision,
        command,
      },
      (error, reply) => (error ? reject(error) : done(reply)),
    ),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
}
async function resize(page, width, height, mobile, zoom = 1) {
  const win = await desktop.browserWindow(page);
  await win.evaluate(
    (w, args) => {
      w.setContentSize(args.width, args.height);
      w.webContents.setZoomFactor(args.zoom);
    },
    { width, height, zoom },
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: Math.round(width / zoom),
    height: Math.round(height / zoom),
    deviceScaleFactor: 1,
    mobile,
  });
  await cdp.detach();
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
}
async function shot(page, name) {
  const path = join(output, name + '.png');
  const win = await desktop.browserWindow(page);
  const bytes = await win.evaluate(async (w) =>
    (await w.webContents.capturePage()).toPNG().toString('base64'),
  );
  await writeFile(path, Buffer.from(bytes, 'base64'));
  report.screenshots.push(path);
}
async function asset(page, selector, name) {
  const folder = resolve('assets/games/pokemon-encounters/rules');
  await mkdir(folder, { recursive: true });
  const path = join(folder, name + '.png');
  await page.locator(selector).first().screenshot({ path });
  const bytes = await readFile(path);
  report.assets.push({
    path,
    selector,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    source:
      'Current hidden production WebView2, isolated six-player legal example',
  });
}
async function stop() {
  for (const socket of sockets.splice(0)) socket.disconnect();
  if (desktop) {
    const previousOrigin = origin;
    await desktop.close();
    let reachable = false;
    try {
      await fetch(previousOrigin + '/api/health', {
        signal: AbortSignal.timeout(500),
      });
      reachable = true;
    } catch {
      /* Closed owned local service. */
    }
    report.closed.push({ serviceReachable: reachable });
    assert.equal(reachable, false);
  }
  desktop = null;
}
async function startCase(entry) {
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: entry.dataDir,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
  };
  for (const key of Object.keys(env))
    if (/^(NODE_PATH|NODE_OPTIONS|TABLEMAX_WEB_DEV_URL)$/i.test(key))
      delete env[key];
  if (portable)
    env.PATH = process.env.SystemRoot + '\\system32;' + process.env.SystemRoot;
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-play-mode'],
    env,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  const runtime = await desktop.request('runtime');
  assert.equal(runtime.packaged, portable);
  assert.equal(runtime.appVersion, version);
  assert.equal(runtime.versions.node, '22.14.0');
  const windows = await desktop.request('windows');
  assert.ok(windows.every((w) => !w.visible && w.rendered));
  report.runtimes.push({ game: entry.id, runtime, windows });
  await host.goto(origin + '/host/game');
  await host.locator(entry.root).waitFor();
  const nextPublic = desktop.waitForEvent('window');
  await desktop.request('open-public', { path: '/public' });
  const publicPage = await nextPublic;
  await publicPage.goto(origin + '/public/game');
  await publicPage.locator(entry.root).waitFor();
  const nextPhone = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, config) => {
      const window = new BrowserWindow({
        show: false,
        width: 390,
        height: 844,
        webPreferences: { partition: 'persist:' + config.id, offscreen: true },
      });
      void window.loadURL(config.url);
    },
    { id: randomUUID(), url: origin + '/player' },
  );
  const phone = await nextPhone;
  await phone.waitForURL('**/player');
  let player = entry.players[0];
  for (const candidate of entry.players)
    if ((await current(candidate.token)).decisionId) {
      player = candidate;
      break;
    }
  await phone.evaluate(
    (token) => localStorage.setItem('tablemax-player', token),
    player.token,
  );
  await phone.goto(origin + '/player/game');
  await phone.locator(entry.root).waitFor();
  for (const page of [host, publicPage, phone]) {
    page.on('pageerror', (error) => report.pageErrors.push(error.message));
    page.on('request', (request) => {
      if (
        /^https?:/.test(request.url()) &&
        new URL(request.url()).origin !== origin
      )
        report.externalRequests.push(request.url());
    });
  }
  await send(hostToken, { type: 'resume' });
  return { publicPage, phone, player };
}
async function verify(page, entry, role, size) {
  const mobile = role === 'player';
  await resize(page, size[0], size[1], mobile, size[2] ?? 1);
  const before = await current();
  const pageSize = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    width: innerWidth,
  }));
  assert.ok(
    pageSize.scrollWidth <= pageSize.width + 1,
    'Underlying game page has no horizontal overflow: ' +
      JSON.stringify({ game: entry.id, role, size, pageSize }),
  );
  const backgroundOverflow = await page.evaluate(
    () => getComputedStyle(document.documentElement).overflow,
  );
  const button = page.getByRole('button', { name: '规则', exact: true });
  await button.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const images = dialog.locator('figure img');
  assert.equal(
    await images.count(),
    entry.images,
    entry.id + ' locally packaged rule images',
  );
  for (const img of await images.all()) {
    await img.scrollIntoViewIfNeeded();
    await img.evaluate((image) =>
      image.complete && image.naturalWidth > 0
        ? true
        : new Promise((done, reject) => {
            const timeout = setTimeout(
              () => reject(new Error('Rule illustration decode timed out')),
              10000,
            );
            image.addEventListener(
              'load',
              () => {
                clearTimeout(timeout);
                done(true);
              },
              { once: true },
            );
            image.addEventListener(
              'error',
              () => {
                clearTimeout(timeout);
                reject(new Error('Rule illustration did not decode'));
              },
              { once: true },
            );
          }),
    );
  }
  if (entry.diagrams) {
    assert.deepEqual(
      await dialog
        .locator('[data-rule-diagram]')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.dataset.ruleDiagram).sort(),
        ),
      [...entry.diagrams].sort(),
      'Six original rule diagrams replace UI captures',
    );
    const decoded = await dialog.evaluate(async (d) => {
      const urls = new Set();
      for (const element of d.querySelectorAll('*')) {
        for (const match of getComputedStyle(element).backgroundImage.matchAll(
          /url\(["']?([^"')]+)["']?\)/g,
        ))
          urls.add(match[1]);
      }
      const sources = [...urls];
      await Promise.all(
        sources.map(async (src) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          if (!image.naturalWidth)
            throw new Error('Rule background illustration failed to decode');
          if (new URL(src, location.href).origin !== location.origin)
            throw new Error('Rules require external illustration');
        }),
      );
      return sources.length;
    });
    assert.ok(
      decoded >= 3,
      'Fuel, house and existing plant illustrations decode locally',
    );
    for (const theme of entry.diagrams) {
      const figure = dialog.locator(`[data-rule-diagram="${theme}"]`);
      await figure.scrollIntoViewIfNeeded();
      await shot(page, `${entry.id}-${role}-${size.join('-')}-${theme}`);
    }
  }
  const nav = dialog.locator('nav').getByRole('button');
  assert.ok((await nav.count()) >= 3);
  await nav.first().click();
  const metrics = await dialog.evaluate((d) => ({
    width: innerWidth,
    right: d.getBoundingClientRect().right,
    left: d.getBoundingClientRect().left,
    scrollWidth: d.scrollWidth,
    clientWidth: d.clientWidth,
    textSizes: [...d.querySelectorAll('p,h2,h3,h4,figcaption,button')]
      .filter((e) => e.getClientRects().length)
      .map((e) => parseFloat(getComputedStyle(e).fontSize)),
    buttons: [...d.querySelectorAll('button')]
      .filter((e) => e.getClientRects().length)
      .map((e) => ({
        text: e.textContent,
        width: e.getBoundingClientRect().width,
        height: e.getBoundingClientRect().height,
      })),
    focusOnHeading: document.activeElement?.matches('h2,h3,h4'),
    backgroundOverflow: getComputedStyle(document.documentElement).overflow,
  }));
  assert.ok(
    metrics.left >= -1 && metrics.right <= metrics.width + 1,
    'Dialog fits viewport',
  );
  assert.ok(
    metrics.scrollWidth <= metrics.clientWidth + 1,
    'No horizontal rule scrolling',
  );
  assert.ok(
    metrics.textSizes.every((px) => px >= 16),
    'Rule information >=16 CSS px',
  );
  assert.ok(
    metrics.buttons.every((b) => b.height >= 43.9 && b.width >= 43.9),
    '44px rule buttons',
  );
  assert.equal(
    metrics.focusOnHeading,
    true,
    'Navigation focuses the chapter heading',
  );
  assert.equal(
    metrics.backgroundOverflow,
    'hidden',
    'Only the rule card scrolls',
  );
  const label = `${entry.id}-${role}-${size.join('-')}`;
  await shot(page, label);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).overflow,
    ),
    backgroundOverflow,
    'Closing rules restores page scrolling',
  );
  assert.equal(
    await button.evaluate((b) => b === document.activeElement),
    true,
    'Escape restores entry focus',
  );
  const after = await current();
  assert.equal(after.revision, before.revision, 'Rules do not save an action');
  assert.equal(after.branch, before.branch);
  assert.deepEqual(
    after.seats,
    before.seats,
    'Rules do not change player identity',
  );
  if (role === 'public')
    assert.equal(
      await page.getByRole('button', { name: '下一小局', exact: true }).count(),
      0,
    );
  report.checks.push({
    game: entry.id,
    role,
    size,
    images: entry.images,
    metrics,
  });
}
try {
  for (const entry of captureRules ? cases.slice(0, 1) : cases) {
    const { publicPage, phone, player } = await startCase(entry);
    if (captureRules) {
      if (entry.id === 'pokemon-encounters') {
        await resize(publicPage, 1280, 720, false);
        await asset(publicPage, '.game-seat', 'table');
        await resize(phone, 390, 844, true);
        const own = await current(player.token);
        const action = own.actions.find(
          (a) => a.type === 'draw' && a.source === 'deck',
        );
        assert.ok(action);
        await send(player.token, {
          type: 'game',
          decisionId: own.decisionId,
          action,
        });
        await phone.locator('.held-pile').waitFor();
        await phone.locator('.held-pile').evaluate((element) => {
          for (const animation of element
            .closest('.game-table')
            .getAnimations({ subtree: true }))
            if (animation.effect?.getTiming().iterations !== Infinity)
              animation.finish();
        });
        await asset(phone, '.pokemon-status', 'draw');
      }
    } else {
      for (const [role, page] of [
        ['host', host],
        ['public', publicPage],
        ['player', phone],
      ])
        for (const size of role === 'player'
          ? [
              [320, 568],
              [360, 640],
              [390, 844],
            ]
          : [
              [1280, 720, 1],
              [1280, 720, 1.5],
              [3840, 2160, 1],
            ])
          await verify(page, entry, role, size);
    }
    await stop();
  }
  if (captureRules) {
    const entry = { ...cases[0], dataDir: pokemon.resultDataDir };
    const { publicPage } = await startCase(entry);
    await resize(publicPage, 1280, 720, false);
    await asset(publicPage, '.game-seat.winner', 'scoring');
    await stop();
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.externalRequests, []);
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  await stop();
  report.elapsedSeconds = (performance.now() - start) / 1000;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.length,
      assets: report.assets.length,
      output,
      elapsedSeconds: report.elapsedSeconds,
    }),
  );
}
