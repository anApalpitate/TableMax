import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { launchTestBrowser } from '../test/support/browser-test.mjs';
import { playerFrame } from '../test/support/player-test.mjs';
import { captureBrowserScreenshot } from '../test/support/screenshots.mjs';
import { assertWorkspaceRoot } from '../shared/workspace-root.mjs';

assertWorkspaceRoot();
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const name = process.argv
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice(11);
assert.match(name ?? '', /^[a-z0-9-]{1,65}$/);
const cdpPort = Number(
  process.argv.find((arg) => arg.startsWith('--cdp-port='))?.slice(11),
);
assert.ok(Number.isInteger(cdpPort) && cdpPort > 0 && cdpPort <= 65535);
const output = resolve('artifacts/maintenance/dev-game-resources', name);
await mkdir(output, { recursive: true });
const reportPath = join(output, 'report.json');
await writeFile(reportPath, '{}', { flag: 'wx' });
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const report = {
  passed: false,
  boundary:
    'Attaches to the hidden native WebView2 session independently started by the actual node tools/dev/dev.mjs command, preserving the build idle guard. Checks current resource HTTP bytes and browser decoding, two games with simulated phone. No installer, physical phone or LAN evidence.',
  inputs: {},
  games: [],
  errors: [],
};
await writeFile(
  join(output, 'verifier-source.mjs'),
  await readFile(new URL(import.meta.url)),
);
let attached, browser;
const sockets = [];
async function bind(file) {
  const bytes = await readFile(file);
  report.inputs[file] = digest(bytes);
  return bytes;
}
async function view(origin, token) {
  const response = await fetch(`${origin}/api/session/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(token ? { token } : {}),
  });
  assert.equal(response.status, 200);
  return (await response.json()).view;
}
async function connect(origin, token) {
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: { token },
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Connection timed out')),
      10000,
    );
    socket.once('room:view', () => {
      clearTimeout(timer);
      done();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  return socket;
}
async function command(origin, socket, token, value) {
  const current = await view(origin, token);
  const reply = await new Promise((done, reject) =>
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: current.instanceId,
        revision: current.revision,
        branch: current.branch,
        command: value,
      },
      (error, reply) => (error ? reject(error) : done(reply)),
    ),
  );
  assert.equal(reply.ok, true, JSON.stringify({ command: value.type, reply }));
}
try {
  for (const file of [
    'tools/dev/dev.mjs',
    'tools/dev/session.mjs',
    'tools/build/game-resources.mjs',
    'tools/build/module-build.mjs',
    'tools/build/setup-desktop.mjs',
    'apps/server/src/game-packages/store.ts',
    'tools/dev/verify-game-resources.mjs',
  ])
    await bind(file);
  attached = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`, {
    timeout: 30000,
  });
  const host = attached
    .contexts()
    .flatMap((context) => context.pages())
    .find((page) => /^\/host(?:\/game)?$/.test(new URL(page.url()).pathname));
  assert.ok(host, 'Expected the independently started development host');
  report.environment = {
    node: process.version,
    platform: process.platform,
    webview2: attached.version(),
  };
  await host.waitForURL((url) => /^\/host(?:\/game)?$/.test(url.pathname));
  host.on('pageerror', (error) => report.errors.push(error.message));
  const origin = new URL(host.url()).origin;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  const token = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(token);
  const hostSocket = await connect(origin, token);
  if (process.argv.includes('--reset-fixture')) {
    const previous = await view(origin, token);
    assert.equal(previous.game.id, 'cockroach-poker');
    assert.equal(previous.paused, true);
    assert.deepEqual(previous.seats.map((seat) => seat.name).sort(), [
      '实体牌1',
      '实体牌2',
      '实体牌3',
    ]);
    await command(origin, hostSocket, token, {
      type: 'select-game',
      gameId: 'cockroach-poker',
      endCurrent: true,
    });
    await command(origin, hostSocket, token, { type: 'new-room' });
  }
  assert.equal(
    (await view(origin, token)).seats.length,
    0,
    'Use a fresh isolated development room',
  );
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  const players = [];
  for (let index = 0; index < 3; index++) {
    const response = await fetch(`${origin}/api/session/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `实体牌${index + 1}` }),
    });
    assert.equal(response.status, 200);
    const playerToken = (await response.json()).token;
    players.push({
      token: playerToken,
      socket: await connect(origin, playerToken),
    });
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await context.addInitScript(
    (token) => localStorage.setItem('tablemax-player', token),
    players[0].token,
  );
  const phone = await context.newPage();
  phone.on('pageerror', (error) => report.errors.push(error.message));
  for (const [gameId, title] of [
    ['cockroach-poker', '德国小强'],
    ['cockroach-salad', '蟑螂沙拉'],
  ]) {
    await command(origin, hostSocket, token, {
      type: 'select-game',
      gameId,
      endCurrent: true,
    });
    for (const player of players)
      await command(origin, player.socket, player.token, {
        type: 'ready',
        ready: true,
      });
    await command(origin, hostSocket, token, { type: 'start' });
    await command(origin, hostSocket, token, { type: 'pause' });
    const current = await view(origin, token);
    const release = current.game.releaseRef;
    assert.ok(release);
    const descriptorResponse = await fetch(
      `${origin}/api/game-packages/releases/${release}`,
    );
    assert.equal(descriptorResponse.status, 200);
    const descriptor = await descriptorResponse.json();
    assert.equal(descriptor.gameId, gameId);
    assert.equal(
      (
        await fetch(
          `${origin}/game-packages/${release}/${descriptor.module.entries.web}`,
        )
      ).status,
      200,
    );
    const manifest = JSON.parse(
      await bind(`assets/games/${gameId}/manifest.json`),
    );
    const originals = manifest.assets ?? manifest.files;
    const assets = manifest.runtimeAssets
      ? [
          ...manifest.runtimeAssets,
          ...originals.filter(
            (asset) =>
              gameId === 'cockroach-poker' &&
              /\.(svg|wav)$/i.test(asset.file) &&
              !['cover.svg', 'card-reference.svg'].includes(asset.file),
          ),
        ]
      : originals;
    assert.ok(assets.length >= (gameId === 'cockroach-poker' ? 65 : 9));
    const item = { gameId, release, resources: [], rendered: [] };
    report.games.push(item);
    for (const asset of assets) {
      const file = asset.file;
      const expected = await bind(`assets/games/${gameId}/${file}`);
      const resource = `${origin}/game-packages/${release}/resources/${gameId}/${file.split('/').map(encodeURIComponent).join('/')}`;
      const response = await fetch(resource);
      assert.equal(response.status, 200, resource);
      const contentType = response.headers.get('content-type') ?? '';
      assert(
        contentType.startsWith(file.endsWith('.wav') ? 'audio/' : 'image/'),
        `${file}: ${contentType}`,
      );
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(digest(bytes), digest(expected), file);
      const decoded = await host.evaluate(
        async ({ resource, file }) => {
          if (!/\.(svg|png|jpe?g|webp|gif)$/i.test(file)) return null;
          const image = new Image();
          image.src = resource;
          await image.decode();
          return [image.naturalWidth, image.naturalHeight];
        },
        { resource, file },
      );
      if (decoded) assert.ok(decoded[0] > 0 && decoded[1] > 0, file);
      item.resources.push({
        file,
        bytes: bytes.length,
        sha256: digest(bytes),
        decoded,
      });
    }
    await host.goto(`${origin}/host/game`);
    await phone.goto(`${origin}/player/game`);
    const frame = await playerFrame(phone);
    for (const target of [host, frame]) {
      await target
        .getByRole('heading', { name: new RegExp(title), level: 1 })
        .waitFor();
      await target
        .locator(gameId === 'cockroach-poker' ? '.cp-game' : '.salad-screen')
        .waitFor();
      try {
        await target.waitForFunction(
          (release) =>
            [...document.querySelectorAll('img,svg image')].some((node) =>
              (
                node.currentSrc ||
                node.href?.baseVal ||
                node.getAttribute('src') ||
                ''
              ).includes(`/game-packages/${release}/`),
            ),
          release,
          { timeout: 10000 },
        );
      } catch (error) {
        item.rendered.push(
          await target.evaluate(() => ({
            text: document.body.innerText.slice(0, 600),
            images: [...document.querySelectorAll('img,svg image')].map(
              (node) =>
                node.currentSrc ||
                node.href?.baseVal ||
                node.getAttribute('src'),
            ),
          })),
        );
        await captureBrowserScreenshot(phone, {
          path: join(output, `${gameId}-failed-phone.png`),
          fullPage: true,
        });
        throw error;
      }
      const images = await target.evaluate(async () => {
        const nodes = [...document.querySelectorAll('img')];
        await Promise.all(nodes.map((image) => image.decode()));
        const bitmaps = nodes.map((image) => ({
          src: image.currentSrc,
          width: image.naturalWidth,
        }));
        const embedded = await Promise.all(
          [...document.querySelectorAll('svg image')].map(async (node) => {
            const image = new Image();
            image.src = node.href.baseVal;
            await image.decode();
            return { src: image.src, width: image.naturalWidth };
          }),
        );
        return [...bitmaps, ...embedded];
      });
      assert.ok(images.every((image) => image.width > 0));
      assert.ok(
        images.some((image) =>
          image.src.includes(`/game-packages/${release}/`),
        ),
      );
      item.rendered.push(images);
    }
    await captureBrowserScreenshot(phone, {
      path: join(output, `${gameId}-phone.png`),
      fullPage: true,
    });
  }
  const snapshot = JSON.parse(await bind('build/snapshots/latest.json'));
  await bind(snapshot.snapshotPath);
  await bind('build/desktop/.tablemax-development.json');
  await bind('build/desktop/TableMax.exe');
  for (const [file, expected] of Object.entries(report.inputs))
    assert.equal(
      digest(await readFile(file)),
      expected,
      `Input changed: ${file}`,
    );
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.errors.push(error.stack ?? String(error));
} finally {
  for (const socket of sockets) socket.disconnect();
  for (const child of [browser, attached]) {
    try {
      await child?.close();
    } catch (error) {
      report.passed = false;
      report.errors.push(error.stack ?? String(error));
    }
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  if (process.env.TABLEMAX_TEST_OUTPUT_DIR)
    await writeFile(
      join(process.env.TABLEMAX_TEST_OUTPUT_DIR, 'results.json'),
      JSON.stringify({
        result: report.passed ? 'passed' : 'failed',
        failures: report.errors.length,
        report: reportPath,
      }) + '\n',
    );
}
console.log(
  JSON.stringify({
    passed: report.passed,
    games: report.games.length,
    errors: report.errors,
    report: reportPath,
  }),
);
if (!report.passed) process.exitCode = 1;
