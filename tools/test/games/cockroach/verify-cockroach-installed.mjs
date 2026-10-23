import assert from 'node:assert/strict';
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  copyFile,
} from 'node:fs/promises';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { launchDesktop } from '../../support/desktop-test.mjs';
import { playerFrame } from '../../support/player-test.mjs';
import { digest, localFile } from '../../runner/evidence.mjs';
import {
  verifyPreservedRuntime,
  noLinks,
} from '../../../release/installation-evidence.mjs';
import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';

assertWorkspaceRoot();
const require = createRequire(resolve('apps/web/package.json'));
const { io } = require('socket.io-client');
const options = new Map();
for (const arg of process.argv.slice(2)) {
  const match = /^--(delivery|proof|evidence)=(.+)$/.exec(arg);
  assert.ok(
    match && !options.has(match[1]),
    'Use unique --delivery, --proof and --evidence arguments',
  );
  options.set(match[1], match[2]);
}
assert.equal(
  options.size,
  3,
  'Required: --delivery=<installer-delivery.json> --proof=<shipping-proof.json> --evidence=<new project directory>',
);
const evidencePath = resolve(options.get('evidence'));
const evidenceRelative = relative(resolve('.'), evidencePath);
assert.ok(
  !evidenceRelative.startsWith('..') &&
    !resolve(evidenceRelative).includes(`${sep}.git${sep}`),
);
assert.match(
  evidenceRelative.replaceAll('\\', '/'),
  /^(artifacts\/maintenance|tmp)\//,
);
await noLinks(evidencePath);
await mkdir(evidencePath, { recursive: false });
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const evidence = {
  schemaVersion: 1,
  started: new Date().toISOString(),
  result: 'running',
  componentScope:
    'Exact frozen installed app payload copied from formal shipping proof; native WebView2 host/public and headless Edge phone browser simulations. Does not repeat installer/system acceptance or prove physical devices, DPI or listening.',
  cases: [],
  errors: [],
};
const bindings = [];
async function bound(path) {
  const full = localFile(resolve('.'), path);
  await noLinks(full);
  const bytes = await readFile(full);
  bindings.push({ path: full, sha256: digest(bytes), bytes: bytes.length });
  return bytes;
}
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(callback, message, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await callback();
    if (result) return result;
    await wait(75);
  }
  throw new Error(message);
}
async function connect(origin, token) {
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: token ? { token } : {},
  });
  await new Promise((done, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Socket connection deadline')),
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
async function fetchView(origin, token) {
  const response = await fetch(`${origin}/api/session/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(token ? { token } : {}),
  });
  assert.equal(response.status, 200);
  return (await response.json()).view;
}
async function send(origin, socket, token, command) {
  const view = await fetchView(origin, token);
  const reply = await new Promise((done, reject) =>
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: crypto.randomUUID(),
        instanceId: view.instanceId,
        revision: view.revision,
        branch: view.branch,
        command,
      },
      (error, reply) => (error ? reject(error) : done(reply)),
    ),
  );
  assert.equal(reply.ok, true, `Command rejected: ${command.type}`);
}
async function openPublic(desktop, origin) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(({ BrowserWindow }, url) => {
    const window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: { partition: 'cockroach-public', offscreen: true },
    });
    void window.loadURL(url);
  }, `${origin}/public/game`);
  const page = await next;
  await page.waitForURL(`${origin}/public/game`);
  return page;
}
async function screenshot(page, filename, desktop) {
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  if (desktop) {
    const window = await desktop.browserWindow(page);
    const bytes = await window.evaluate(async (native) =>
      (await native.webContents.capturePage()).toPNG(),
    );
    await writeFile(join(evidencePath, filename), bytes, { flag: 'wx' });
  } else
    await page.screenshot({
      path: join(evidencePath, filename),
      fullPage: true,
    });
}
async function decodeResources(page, origin, release, catalog) {
  const code = catalog.blobs.find((blob) => blob.id === release.code);
  assert.ok(code, 'Frozen code blob inventory required');
  const resources = [
    ...new Set([
      ...Object.keys(release.resourceMap),
      ...code.files
        .filter((file) => file.path.startsWith('resources/'))
        .map((file) => file.path.slice('resources/'.length)),
    ]),
  ].filter((path) => /\.(svg|png|jpe?g|webp|gif|wav)$/i.test(path));
  assert.ok(
    resources.some((path) => /\.(svg|png|jpe?g|webp)$/i.test(path)),
    'Frozen image inventory required',
  );
  assert.ok(
    release.gameId !== 'cockroach-poker' ||
      resources.some((path) => /\.wav$/i.test(path)),
    'Frozen WAV inventory required',
  );
  return page.evaluate(
    async ({ origin, releaseId, resources }) => {
      const context = new AudioContext();
      try {
        return await Promise.all(
          resources.map(async (path) => {
            const url = `${origin}/game-packages/${releaseId}/resources/${path.split('/').map(encodeURIComponent).join('/')}`;
            const response = await fetch(url);
            if (!response.ok)
              throw new Error(`Frozen resource HTTP failure: ${path}`);
            const bytes = await response.arrayBuffer();
            if (/\.wav$/i.test(path)) {
              const byteLength = bytes.byteLength;
              const decoded = await context.decodeAudioData(bytes);
              if (!(decoded.duration > 0 && decoded.numberOfChannels > 0))
                throw new Error(`Audio decode failed: ${path}`);
              return {
                path,
                bytes: byteLength,
                duration: decoded.duration,
                channels: decoded.numberOfChannels,
              };
            }
            const blob = URL.createObjectURL(
              new Blob([bytes], {
                type: response.headers.get('content-type') ?? '',
              }),
            );
            try {
              const image = new Image();
              image.src = blob;
              await image.decode();
              if (!(image.naturalWidth > 0 && image.naturalHeight > 0))
                throw new Error(`Image decode failed: ${path}`);
              return {
                path,
                bytes: bytes.byteLength,
                width: image.naturalWidth,
                height: image.naturalHeight,
              };
            } finally {
              URL.revokeObjectURL(blob);
            }
          }),
        );
      } finally {
        await context.close();
      }
    },
    { origin, releaseId: release.releaseId, resources },
  );
}

let edge;
try {
  evidence.method = [];
  for (const path of [
    'tools/test/games/cockroach/verify-cockroach-installed.mjs',
    'tools/test/support/desktop-test.mjs',
    'tools/test/support/player-test.mjs',
    'tools/release/installation-evidence.mjs',
    'package.json',
    'pnpm-lock.yaml',
  ]) {
    const bytes = await readFile(path);
    evidence.method.push({ path, bytes: bytes.length, sha256: digest(bytes) });
    if (path.endsWith('verify-cockroach-installed.mjs'))
      await writeFile(join(evidencePath, 'verifier-source.mjs'), bytes, {
        flag: 'wx',
      });
  }
  const deliveryBytes = await bound(options.get('delivery'));
  const candidate = JSON.parse(deliveryBytes);
  const delivery = candidate.pointer?.deliveries?.[0] ?? candidate;
  assert.equal(delivery.deliveryType, 'installer');
  assert.equal(delivery.edition, 'full');
  const proofBytes = await bound(options.get('proof'));
  const proof = JSON.parse(proofBytes);
  const payloadBytes = await bound(delivery.manifestPath);
  const payload = JSON.parse(payloadBytes);
  const archive = await bound(delivery.archivePath);
  const executable = await bound(delivery.executable.path);
  const installation = await bound(
    delivery.executable.installation.manifestPath,
  );
  assert.equal(digest(executable), delivery.executable.sha256);
  assert.equal(executable.length, delivery.executable.bytes);
  assert.equal(digest(archive), delivery.executable.payloadSha256);
  assert.equal(payload.archive.sha256, digest(archive));
  assert.equal(
    digest(payloadBytes),
    delivery.executable.installation.payloadManifestSha256,
  );
  assert.equal(
    digest(installation),
    delivery.executable.installation.manifestSha256,
  );
  assert.equal(proof.result, 'passed');
  assert.equal(proof.deliveryType, 'installer');
  assert.equal(
    proof.uninstalled,
    true,
    'Formal completed uninstall and preserved runtime proof required',
  );
  assert.equal(proof.snapshot, payload.snapshot);
  assert.equal(proof.executableSha256, digest(executable));
  assert.equal(proof.payloadSha256, digest(archive));
  assert.equal(proof.installationManifestSha256, digest(installation));
  assert.equal(proof.runtimeRoot, proof.extracted);
  assert.equal(proof.verifiedRuntimeRoot, proof.verifiedRuntime.path);
  assert.ok(proof.installationId && proof.installRoot && proof.boxRoot);
  await verifyPreservedRuntime({
    copy: proof.verifiedRuntime,
    delivery,
    payloadBytes,
    sourceRuntimeRoot: proof.runtimeRoot,
    installationId: proof.installationId,
  });
  await mkdir('tmp', { recursive: true });
  const work = await mkdtemp(resolve('tmp/cockroach-installed-'));
  const runtime = join(work, 'runtime');
  await mkdir(runtime);
  const members = [
    ...payload.files,
    {
      path: '.tablemax-release.json',
      bytes: payloadBytes.length,
      sha256: digest(payloadBytes),
    },
  ];
  assert.ok(
    members.reduce((total, member) => total + member.bytes, 0) < 120000000,
    'Frozen extracted payload exceeds byte limit',
  );
  for (const member of members) {
    const input = localFile(proof.verifiedRuntime.path, member.path),
      output = localFile(runtime, member.path);
    const bytes = await readFile(input);
    assert.equal(bytes.length, member.bytes, member.path);
    assert.equal(digest(bytes), member.sha256, member.path);
    await mkdir(dirname(output), { recursive: true });
    await copyFile(input, output);
    assert.equal(digest(await readFile(output)), member.sha256, member.path);
  }
  evidence.binding = {
    delivery: bindings[0],
    proof: bindings[1],
    inputs: bindings,
    snapshot: payload.snapshot,
    version: payload.version,
    buildVersion: payload.buildVersion,
    runtime,
    files: members.length,
    componentScope: evidence.componentScope,
  };
  const catalog = JSON.parse(
    await readFile(join(runtime, 'preinstalled-games/catalog.json'), 'utf8'),
  );
  const releases = catalog.payload.releases;
  edge = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--mute-audio'],
  });
  for (const [gameId, title] of [
    ['cockroach-poker', '德国小强'],
    ['cockroach-salad', '蟑螂沙拉'],
  ]) {
    const release = releases.find((item) => item.gameId === gameId);
    assert.ok(
      release,
      'Both games must exist in the frozen preinstalled catalog',
    );
    const assetManifest = JSON.parse(
      await bound(`assets/games/${gameId}/manifest.json`),
    );
    const originals = assetManifest.assets ?? assetManifest.files;
    const assetFiles = assetManifest.runtimeAssets
      ? [
          ...assetManifest.runtimeAssets,
          ...originals.filter(
            (asset) =>
              gameId === 'cockroach-poker' &&
              /\.(svg|wav)$/i.test(asset.file) &&
              asset.file !== 'cover.svg',
          ),
        ]
      : originals;
    assert.ok(Array.isArray(assetFiles) && assetFiles.length > 0);
    assert.deepEqual(
      Object.keys(release.resourceMap).sort(),
      assetFiles.map((asset) => `${gameId}/${asset.file}`).sort(),
      'Frozen resources must cover every declared game asset',
    );
    for (const asset of assetFiles) {
      const bytes = await bound(`assets/games/${gameId}/${asset.file}`);
      const resource = release.resourceMap[`${gameId}/${asset.file}`];
      const blob = catalog.payload.blobs.find(
        (item) => item.id === resource.blobId,
      );
      const member = blob?.files.find((item) => item.path === resource.path);
      assert.ok(member, 'Frozen asset member required');
      assert.equal(member.sha256, digest(bytes), asset.file);
      assert.equal(member.size, bytes.length, asset.file);
    }
    const dataDir = join(work, gameId);
    await mkdir(dataDir);
    const env = {
      TABLEMAX_DATA_DIR: dataDir,
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_WEB_DEV_URL: '',
      NODE_PATH: '',
    };
    let desktop;
    const sockets = [],
      contexts = [];
    const item = {
      gameId,
      releaseId: release.releaseId,
      screenshots: [],
      requests: [],
      actions: [],
    };
    evidence.cases.push(item);
    try {
      desktop = await launchDesktop({
        executablePath: join(runtime, 'TableMax.exe'),
        args: ['--foundation-test', '--tablemax-test-mode'],
        env,
      });
      const host = await desktop.firstWindow();
      host.on('pageerror', (error) =>
        evidence.errors.push({ gameId, role: 'host', error: error.message }),
      );
      await host.waitForURL('**/host');
      const origin = new URL(host.url()).origin;
      assert.equal(new URL(origin).hostname, '127.0.0.1');
      const hostToken = await host.evaluate(() =>
        sessionStorage.getItem('tablemax-host'),
      );
      assert.ok(hostToken);
      const hostSocket = await connect(origin, hostToken);
      sockets.push(hostSocket);
      await send(origin, hostSocket, hostToken, {
        type: 'select-game',
        gameId,
      });
      const players = [];
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${origin}/api/session/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `手机${i + 1}` }),
        });
        assert.equal(response.status, 200);
        const { token } = await response.json();
        const socket = await connect(origin, token);
        sockets.push(socket);
        await send(origin, socket, token, { type: 'ready', ready: true });
        const context = await edge.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 1,
        });
        contexts.push(context);
        await context.addInitScript(
          (token) => localStorage.setItem('tablemax-player', token),
          token,
        );
        const page = await context.newPage();
        page.on('pageerror', (error) =>
          evidence.errors.push({ gameId, error: error.message }),
        );
        page.on('request', (request) => {
          const url = new URL(request.url());
          if (
            url.origin === origin &&
            /\/game-packages\/|\/games\//.test(url.pathname)
          )
            item.requests.push(url.pathname);
        });
        await page.goto(`${origin}/player/game`);
        players.push({ token, socket, page });
      }
      await send(origin, hostSocket, hostToken, { type: 'start' });
      await send(origin, hostSocket, hostToken, { type: 'pause' });
      await host.goto(`${origin}/host/game`);
      const publicPage = await openPublic(desktop, origin);
      publicPage.on('pageerror', (error) =>
        evidence.errors.push({ gameId, role: 'public', error: error.message }),
      );
      const frames = await Promise.all(
        players.map(async (player) => {
          const frame = await playerFrame(player.page);
          await frame
            .getByRole('heading', { name: new RegExp(title), level: 1 })
            .waitFor();
          return frame;
        }),
      );
      await host
        .getByRole('heading', { name: new RegExp(title), level: 1 })
        .waitFor();
      await publicPage
        .getByRole('heading', { name: new RegExp(title), level: 1 })
        .waitFor();
      const view = (token) => fetchView(origin, token);
      const started = await view(hostToken);
      assert.equal(started.game.id, gameId);
      const publicView = await view();
      assert.deepEqual(publicView.actions, []);
      assert.ok(!('hands' in publicView.gameView));
      assert.equal(
        await publicPage.locator('.cp-controls, .salad-controls').count(),
        0,
      );
      assert.equal(started.game.releaseRef, release.releaseId);
      await send(origin, hostSocket, hostToken, { type: 'resume' });
      if (gameId === 'cockroach-poker') {
        assert.deepEqual(publicView.gameView.ownHand, []);
        const actor = await until(async () => {
          for (let i = 0; i < 3; i++)
            if (
              (await view(players[i].token)).actions.some(
                (a) => a.type === 'offer',
              )
            )
              return { index: i };
        }, 'Poker offer actor unavailable');
        const i = actor.index,
          own = await view(players[i].token),
          target = own.actions.find((a) => a.type === 'offer').target;
        const targetIndex = (
          await Promise.all(players.map((p) => view(p.token)))
        ).findIndex((v) => v.self.seatId === target);
        await frames[i].locator('.cp-hand button').first().click();
        await frames[i]
          .getByRole('group', { name: '交给谁' })
          .getByRole('button', {
            name: own.seats.find((s) => s.id === target).name,
            exact: true,
          })
          .click();
        await frames[i].locator('.cp-claims button').first().click();
        await frames[i].locator('.cp-confirm').click();
        item.actions.push('production offer card/target/claim/confirm');
        await frames[targetIndex]
          .getByRole('button', { name: '秘密查看，并承诺转传', exact: true })
          .click();
        item.actions.push('production peek');
        await until(
          async () =>
            (await view(players[targetIndex].token)).gameView.offer?.passing,
          'Peek not saved',
        );
        const targetView = await view(players[targetIndex].token);
        const pass = targetView.actions.find((a) => a.type === 'pass');
        assert.ok(pass);
        const pv = await view();
        assert.equal(pv.gameView.offer.knownCard, null);
        await send(
          origin,
          players[targetIndex].socket,
          players[targetIndex].token,
          { type: 'game', decisionId: targetView.decisionId, action: pass },
        );
        item.actions.push('socket pass after production peek');
        const last = (
          await Promise.all(players.map((p) => view(p.token)))
        ).findIndex((v) => v.actions.some((a) => a.type === 'judge'));
        await frames[last]
          .getByRole('button', { name: '相信 声明是真的', exact: true })
          .click();
        item.actions.push('production judge');
        await until(
          async () => !(await view()).gameView.offer,
          'Judgment not saved',
        );
      } else {
        const actor = (await view()).gameView.actor;
        const views = await Promise.all(players.map((p) => view(p.token)));
        const i = views.findIndex((v) => v.self.seatId === actor);
        const step = views[i].gameView.step;
        await frames[i].locator('.salad-answer-buttons button').first().click();
        await until(async () => {
          const saved = (await view(players[i].token)).gameView;
          return (
            saved.step === step + 1 &&
            saved.phase === 'review' &&
            saved.answer === 'tomato'
          );
        }, 'Production answer not saved in the same review window');
        item.actions.push('production answer');
        const challenger = (i + 1) % 3;
        await frames[challenger]
          .getByRole('button', { name: '质疑错误／拖延', exact: true })
          .click();
        await until(async () => {
          const saved = (await view(players[challenger].token)).gameView;
          return (
            saved.step === step + 1 &&
            saved.phase === 'review' &&
            saved.selfResponse === 'challenge'
          );
        }, 'Production challenge not saved in the same review window');
        item.actions.push('production challenge');
        await until(
          async () => (await view()).gameView.step > step + 1,
          'Production review deadline not advanced',
          12000,
        );
        const afterReview = (await view()).gameView.step;
        await until(
          async () =>
            (await view()).gameView.step >= afterReview + 2 &&
            (await view()).gameView.lastResult.includes('无人作答'),
          'Production no-operation deadline did not penalize',
          16000,
        );
        item.actions.push(
          'production automatic overtime/no-operation deadline',
        );
      }
      await send(origin, hostSocket, hostToken, { type: 'pause' });
      item.resources = await decodeResources(
        publicPage,
        origin,
        release,
        catalog.payload,
      );
      await frames[0]
        .getByRole('button', { name: '图文规则', exact: true })
        .click();
      await frames[0].locator('.cp-rulebook, .salad-rulebook').waitFor();
      await frames[0].evaluate(async () => {
        for (const image of document.querySelectorAll('img')) {
          image.loading = 'eager';
          await image.decode();
        }
      });
      await screenshot(players[0].page, `${gameId}-player-rules.png`);
      item.screenshots.push(`${gameId}-player-rules.png`);
      await frames[0]
        .getByRole('button', { name: '关闭面板', exact: true })
        .click();
      for (const [name, page] of [
        ['host', host],
        ['public', publicPage],
        ['phone', players[0].page],
      ]) {
        const file = `${gameId}-${name}.png`;
        await screenshot(page, file, name === 'phone' ? undefined : desktop);
        item.screenshots.push(file);
      }
      assert.ok(
        item.requests.some(
          (path) =>
            path === `/api/game-packages/releases/${release.releaseId}` ||
            path.includes(`/game-packages/${release.releaseId}/web/`),
        ),
        'Production dynamic release client must load',
      );
      assert.ok(
        item.requests.some(
          (path) =>
            path.includes(`/game-packages/${release.releaseId}/web/`) &&
            /\.js$/.test(path),
        ),
        'Production dynamic JS entry must load',
      );
      const beforeRestart = await view(hostToken);
      for (const socket of sockets.splice(0)) socket.disconnect();
      await desktop.close();
      desktop = null;
      desktop = await launchDesktop({
        executablePath: join(runtime, 'TableMax.exe'),
        args: ['--foundation-test', '--tablemax-test-mode'],
        env,
      });
      const restoredHost = await desktop.firstWindow();
      await restoredHost.waitForURL('**/host');
      const restoredOrigin = new URL(restoredHost.url()).origin;
      const restoredToken = await restoredHost.evaluate(() =>
        sessionStorage.getItem('tablemax-host'),
      );
      assert.ok(restoredToken, 'Restored native host credential required');
      const restored = await fetchView(restoredOrigin, restoredToken);
      assert.equal(restored.instanceId, beforeRestart.instanceId);
      assert.equal(restored.game.id, gameId);
      assert.equal(restored.paused, true);
      assert.deepEqual(restored.gameView, beforeRestart.gameView);
      await restoredHost.goto(`${restoredOrigin}/host/game`);
      await restoredHost
        .getByRole('heading', { name: new RegExp(title), level: 1 })
        .waitFor();
      await screenshot(restoredHost, `${gameId}-restored.png`, desktop);
      item.screenshots.push(`${gameId}-restored.png`);
      item.restart = {
        instancePreserved: true,
        gamePreserved: true,
        paused: true,
        projectionPreserved: true,
      };
      item.result = 'passed';
    } finally {
      for (const socket of sockets) socket.disconnect();
      for (const context of contexts) await context.close();
      if (desktop) await desktop.close();
    }
  }
  for (const binding of bindings)
    assert.equal(
      digest(await readFile(binding.path)),
      binding.sha256,
      'Frozen input changed',
    );
  for (const source of evidence.method)
    assert.equal(
      digest(await readFile(source.path)),
      source.sha256,
      'Verification method changed',
    );
  await verifyPreservedRuntime({
    copy: proof.verifiedRuntime,
    delivery,
    payloadBytes,
    sourceRuntimeRoot: proof.runtimeRoot,
    installationId: proof.installationId,
  });
  assert.deepEqual(evidence.errors, []);
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  // Never print session credentials or network command/view payloads.
  evidence.failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  if (edge) await edge.close();
  evidence.finished = new Date().toISOString();
  await writeFile(
    join(evidencePath, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
    { flag: 'wx' },
  );
  console.log(
    `Cockroach frozen app smoke ${evidence.result}: ${join(evidencePath, 'results.json')}`,
  );
}
