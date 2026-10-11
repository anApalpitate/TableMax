import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Worker } from 'node:worker_threads';
import { launchDesktop } from '../support/desktop-test.mjs';
import { saveVerificationScreenshot } from '../support/screenshots.mjs';
import { verificationOutput } from '../support/verification-output.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
const option = (name, fallback) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback;
const archive = resolve(
  option('zip', 'artifacts/releases/TableMax-1.0.6-win-x64.zip'),
);
const manifestPath = archive.replace(/\.zip$/, '-manifest.json');
const evidenceName = option('evidence', 'installed-games');
assert.match(evidenceName, /^[a-z0-9-]{1,60}$/);
const output = verificationOutput('game-packages', evidenceName);
const packagesRoot = resolve(
  option('packages', 'artifacts/game-packages/v1.0.6'),
);
const catalog = JSON.parse(
  await readFile(
    join(packagesRoot, 'TableMax-game-catalog-v1.0.6.json'),
    'utf8',
  ),
).payload;
const selected = option('only', '').split(',').filter(Boolean);
const releases = catalog.releases.filter(
  (r) =>
    !selected.length ||
    selected.includes(r.gameId) ||
    selected.includes(`${r.gameId}:${r.variantId ?? ''}`),
);
assert.ok(releases.length);
const maxMs = Number(option('max-ms', '300000'));
const playMode = option('play-mode', 'test');
assert.ok(['play', 'test'].includes(playMode));
const timingCheckpoint = option('timing-checkpoint', 'false') === 'true';
assert.ok(!timingCheckpoint || playMode === 'play');
const maxFailures = Number(option('max-failures', '3'));
assert.ok(
  Number.isInteger(maxFailures) && maxFailures >= 1 && maxFailures <= 3,
);
const onlineRelease = option('online-release', '');
if (onlineRelease)
  assert.equal(
    onlineRelease,
    'https://github.com/anApalpitate/TableMax/releases/tag/v1.0.6',
  );
const entryOnly = option('entry-only', 'false') === 'true';
const unoSeats = Number(option('uno-seats', '2'));
assert.ok(Number.isInteger(unoSeats) && unoSeats >= 2 && unoSeats <= 6);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/installed-games-'));
const extracted = join(work, 'runtime');
const dataDir = join(work, 'data');
await mkdir(dataDir);
const report = {
  startedAt: new Date().toISOString(),
  archive,
  archiveSha256: hash(await readFile(archive)),
  work,
  checks: [],
  games: [],
  pageErrors: [],
  externalRequests: [],
  failures: 0,
  scope:
    'Actual extracted Windows native/WebView2, package Node/service/Workers, loopback HTTP, isolated SQLite, Chromium mobile viewport simulation. No physical phone/LAN/Safari claim. Browser external requests denied; ' +
    (onlineRelease
      ? 'administrator explicitly refreshes and installs real GitHub Release assets; '
      : 'service uses offline import only; ') +
    'no OS-level Node egress-denial claim.',
  ...(onlineRelease ? { onlineRelease } : {}),
  playMode,
};
const save = () =>
  writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
let desktop, host, origin, hostToken, hostSocket;
const sockets = [];
async function current(token) {
  const response = await fetch(origin + '/api/session/view', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(token ? { token } : {}),
  });
  const reply = await response.json();
  assert.equal(reply.ok, true);
  return reply.view;
}
async function connect(token) {
  const socket = io(origin, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function send(socket, token, command) {
  const view = await current(token);
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
      (error, result) => (error ? reject(error) : done(result)),
    ),
  );
  return reply;
}
async function hostCommand(command) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const reply = await send(hostSocket, hostToken, command);
    if (reply.ok) return;
    if (!/^stale-/.test(reply.reason ?? '')) assert.fail(JSON.stringify(reply));
    await wait(25);
  }
  assert.fail('host command remained stale');
}
async function observe(page, label) {
  page.on('pageerror', (error) =>
    report.pageErrors.push({ label, message: error.message }),
  );
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (
      !url.startsWith(origin + '/') &&
      !url.startsWith('data:') &&
      !url.startsWith('blob:')
    ) {
      report.externalRequests.push({ label, url });
      return route.abort();
    }
    return route.continue();
  });
}
async function newPage(path, label, width = 1280, height = 720) {
  const ready = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, input) => {
      const window = new BrowserWindow({
        show: false,
        width: input.width,
        height: input.height,
        webPreferences: {
          partition: 'persist:' + input.label,
          offscreen: true,
          backgroundThrottling: false,
        },
      });
      void window.loadURL(input.url);
    },
    { url: origin + path, label, width, height },
  );
  const page = await ready;
  await observe(page, label);
  return page;
}
async function capture(page, label, width, height, mobile = false) {
  const window = await desktop.browserWindow(page);
  await window.evaluate(
    (window, size) => window.setContentSize(size.width, size.height),
    { width, height },
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  await wait(120);
  await page.waitForFunction(
    () =>
      [...document.images]
        .filter((image) => image.currentSrc)
        .every((image) => image.complete),
    undefined,
    { timeout: 10000 },
  );
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    loadedImages: [...document.images]
      .filter((i) => i.currentSrc)
      .map((i) => ({
        url: i.currentSrc,
        complete: i.complete,
        width: i.naturalWidth,
      })),
    styles: [...document.styleSheets].map((s) => s.href).filter(Boolean),
    entry: performance.getEntriesByType('resource').map((r) => r.name),
  }));
  assert.ok(
    metrics.scrollWidth <= metrics.width,
    `${label} horizontal overflow ${metrics.scrollWidth}/${metrics.width}`,
  );
  assert.ok(
    metrics.loadedImages.every((i) => i.complete && i.width > 0),
    `${label} broken image`,
  );
  assert.ok(
    metrics.loadedImages.every(
      (i) =>
        i.url.startsWith(origin + '/') ||
        i.url.startsWith('data:') ||
        i.url.startsWith('blob:'),
    ),
    `${label} external image`,
  );
  const bitmap = await window.evaluate(async (window) =>
    (await window.webContents.capturePage()).toPNG(),
  );
  await saveVerificationScreenshot(join(output, label + '.png'), bitmap, {
    gameId: label.split('-')[0],
    width,
    height,
    device: 'simulated WebView2',
    state: 'installed playable',
  });
  await cdp.detach();
  return metrics;
}
async function decisionWorker(task, entry) {
  return new Promise((done, reject) => {
    const worker = new Worker(join(extracted, 'bot-worker.cjs'), {
      workerData: { ...task, botEntry: entry },
      resourceLimits: { maxOldGenerationSizeMb: 32 },
    });
    const timer = setTimeout(
      () => finish(new Error('player-driver-worker-budget')),
      2000,
    );
    let finished = false;
    function finish(error, result) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else done(result);
    }
    worker.once('error', (error) => finish(error));
    worker.once('exit', () => finish(new Error('player-driver-worker-exited')));
    worker.once('message', (result) =>
      finish(result.error ? new Error(result.error) : null, result),
    );
  });
}
async function verifyRelease(release) {
  const caseName = `${release.gameId}-${release.variantId ?? 'default'}`;
  const result = {
    gameId: release.gameId,
    variantId: release.variantId ?? null,
    releaseRef: release.releaseId,
    startedAt: new Date().toISOString(),
    actions: 0,
    lifecycleActions: 0,
    workerMaxMs: 0,
    check: 'running',
  };
  report.games.push(result);
  await save();
  let phone, publicPage, playerSocket, observeTiming;
  try {
    if ((await current(hostToken)).status === 'playing') {
      // Explicit cleanup never counts as natural match completion.
      if (report.games.at(-2)?.checkpointOnly)
        result.resetPriorCheckpointCase = true;
      else result.resetPriorFailedCase = true;
      await hostCommand({
        type: 'select-game',
        gameId: release.gameId,
        endCurrent: true,
      });
    }
    await hostCommand({ type: 'new-room' });
    await hostCommand({ type: 'select-game', gameId: release.gameId });
    if (release.variantId)
      await hostCommand({
        type: 'select-variant',
        variantId: release.variantId,
      });
    await hostCommand({ type: 'set-play-mode', mode: playMode });
    assert.equal((await current(hostToken)).playMode, playMode);
    assert.equal((await current(hostToken)).game.releaseRef, release.releaseId);
    const admitted = await (
      await fetch(origin + '/api/session/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '验收真人' }),
      })
    ).json();
    assert.equal(admitted.ok, true);
    const playerToken = admitted.token;
    playerSocket = await connect(playerToken);
    phone = await newPage('/player', caseName + '-phone', 390, 844);
    await phone.evaluate(
      (token) => localStorage.setItem('tablemax-player', token),
      playerToken,
    );
    await phone.goto(origin + '/player/game');
    publicPage = await newPage('/public/game', caseName + '-public');
    await host.goto(origin + '/host/game');
    result.seats =
      release.gameId === 'uno' ? unoSeats : release.module.catalog.min;
    for (let i = 1; i < result.seats; i++)
      await hostCommand({
        type: 'add-bot',
        name: '验收人机' + i,
        difficulty: 'doubao',
      });
    assert.equal(
      (await send(playerSocket, playerToken, { type: 'ready', ready: true }))
        .ok,
      true,
    );
    await hostCommand({ type: 'start' });
    await hostCommand({ type: 'pause' });
    for (const page of [host, phone, publicPage])
      await page.waitForFunction(
        () => !document.querySelector('.game-loading'),
        undefined,
        { timeout: 15000 },
      );
    await wait(300);
    result.player320 = await capture(
      phone,
      caseName + '-player-320',
      320,
      568,
      true,
    );
    result.player390 = await capture(
      phone,
      caseName + '-player-390',
      390,
      844,
      true,
    );
    result.playerLandscape = await capture(
      phone,
      caseName + '-player-landscape',
      844,
      390,
      true,
    );
    result.host = await capture(host, caseName + '-host-720', 1280, 720);
    result.host4K = await capture(host, caseName + '-host-4k', 3840, 2160);
    result.public = await capture(
      publicPage,
      caseName + '-public-720',
      1280,
      720,
    );
    const audioIds = Object.keys(release.resourceMap).filter((id) =>
      /\.(flac|wav|mp3|ogg)$/i.test(id),
    );
    result.audioDecoded = await phone.evaluate(
      async ({ origin, ref, ids }) => {
        const context = new AudioContext();
        try {
          for (const id of ids) {
            const response = await fetch(
              `${origin}/game-packages/${ref}/resources/${id}`,
            );
            if (!response.ok) throw new Error('missing audio ' + id);
            await context.decodeAudioData(await response.arrayBuffer());
          }
          return ids.length;
        } finally {
          await context.close();
        }
      },
      { origin, ref: release.releaseId, ids: audioIds },
    );
    await hostCommand({ type: 'resume' });
    if (release.gameId === 'avalon' && playMode === 'play') {
      result.discussionTimings = [];
      result.botSavedActions = [];
      result.phaseEvidence = [];
      let pendingSpeaker,
        seenSerial,
        previousActionAt = performance.now();
      observeTiming = (projection) => {
        const view = projection.view ?? projection;
        if (view.game?.releaseRef !== release.releaseId || view.paused) {
          pendingSpeaker = undefined;
          return;
        }
        const game = view.gameView;
        if (!game) return;
        const now = performance.now();
        const latest = game.latest;
        if (latest && latest.serial !== seenSerial) {
          if (
            view.seats.find((seat) => seat.id === latest.actor)?.controller ===
            'bot'
          ) {
            result.botSavedActions.push({
              verb: latest.verb,
              actor: latest.actor,
              serial: latest.serial,
              sincePreviousSaveMs: now - previousActionAt,
            });
            if (
              latest.verb === 'finish-discussion' &&
              pendingSpeaker?.seat === latest.actor
            )
              result.discussionTimings.push({
                seat: latest.actor,
                elapsedMs: now - pendingSpeaker.at,
                serial: latest.serial,
              });
          }
          seenSerial = latest.serial;
          previousActionAt = now;
        }
        const currentSpeaker =
          game.phase === 'discussion' ? game.discussion?.current : null;
        if (currentSpeaker !== pendingSpeaker?.seat) {
          pendingSpeaker = currentSpeaker
            ? { seat: currentSpeaker, at: now }
            : undefined;
          result.phaseEvidence.push({
            phase: game.phase,
            current: currentSpeaker,
            atMs: now,
          });
        } else if (result.phaseEvidence.at(-1)?.phase !== game.phase)
          result.phaseEvidence.push({ phase: game.phase, atMs: now });
      };
      hostSocket.on('room:view', observeTiming);
      observeTiming(await current(hostToken));
    }
    if (entryOnly) {
      result.check = 'passed';
      result.entryOnly = true;
      result.durationMs = Date.now() - Date.parse(result.startedAt);
      assert.equal((await current(hostToken)).status, 'playing');
      assert.equal(
        (await current(hostToken)).game.releaseRef,
        release.releaseId,
      );
      return;
    }
    const codeRoot = join(
        extracted,
        'games',
        release.gameId,
        'blobs',
        release.code,
      ),
      entry = join(codeRoot, release.module.entries.bot);
    const exports = require(entry);
    const bot = release.variantId
      ? exports.botsByVariant?.[release.variantId]
      : exports.bot;
    assert.ok(bot);
    let memory = bot.validateMemory(null),
      random = 0x51aa3321;
    const deadline = Date.now() + maxMs;
    let logged = 0;
    while (Date.now() < deadline) {
      const administrator = await current(hostToken);
      assert.equal(administrator.game.releaseRef, release.releaseId);
      assert.equal(administrator.botError, null);
      if (administrator.status === 'ended') {
        result.final = administrator.gameView;
        result.check = 'passed';
        break;
      }
      if (
        timingCheckpoint &&
        administrator.gameView?.phase === 'vote' &&
        result.humanWaitProof &&
        result.discussionTimings?.length >= result.seats - 1
      ) {
        await hostCommand({ type: 'pause' });
        result.final = administrator.gameView;
        result.checkpointOnly = true;
        result.check = 'passed';
        break;
      }
      const lifecycleAction = administrator.lifecycleActions.find(
        (action) => action.type !== 'skip-discussion',
      );
      if (lifecycleAction) {
        assert.ok(result.lifecycleActions++ < 50, 'natural lifecycle limit');
        await hostCommand({
          type: 'lifecycle',
          action: lifecycleAction,
        });
        continue;
      }
      const own = await current(playerToken);
      if (own.decisionId) {
        if (
          release.gameId === 'avalon' &&
          playMode === 'play' &&
          own.actions.some((action) => action.type === 'finish-discussion') &&
          !result.humanWaitProof
        ) {
          const before = await current(hostToken);
          await wait(150);
          const after = await current(hostToken);
          assert.equal(
            after.revision,
            before.revision,
            'human speaker advanced automatically',
          );
          result.humanWaitProof = {
            waitedMs: 150,
            unchangedRevision: after.revision,
          };
        }
        const before = performance.now();
        const decision = { id: own.decisionId, seatId: own.self.seatId };
        const selected = await decisionWorker(
          {
            gameId: release.gameId,
            variantId: release.variantId,
            rulesVersion: bot.rulesVersion,
            decision,
            view: own.gameView,
            actions: own.actions,
            data: {
              id: bot.id,
              version: bot.version,
              difficulty: 'doubao',
              memory,
              random,
            },
          },
          entry,
        );
        result.workerMaxMs = Math.max(
          result.workerMaxMs,
          performance.now() - before,
        );
        const reply = await send(playerSocket, playerToken, {
          type: 'game',
          decisionId: decision.id,
          action: selected.action,
        });
        if (reply.ok) {
          memory = selected.memory;
          random = selected.random;
          result.actions++;
        } else if (
          !/stale|changed|conflict|decision|turn/.test(reply.reason ?? '')
        )
          throw new Error('player driver ' + JSON.stringify(reply));
      }
      if (Date.now() - logged > 30000) {
        logged = Date.now();
        console.log(
          JSON.stringify({
            game: caseName,
            phase: administrator.gameView?.phase,
            revision: administrator.revision,
            playerActions: result.actions,
            roundNumber: administrator.gameView?.roundNumber,
            scores: administrator.gameView?.scores,
            remainingSeconds: Math.round((deadline - Date.now()) / 1000),
          }),
        );
        await save();
      }
      await wait(35);
    }
    assert.equal(
      result.check,
      'passed',
      `${caseName} did not naturally complete within ${maxMs}ms`,
    );
    if (result.discussionTimings) {
      assert.ok(
        result.discussionTimings.length >= result.seats - 1,
        'missing real server discussion confirmations',
      );
      assert.ok(
        result.discussionTimings.every((sample) => sample.elapsedMs < 1000),
        'discussion retained the normal thinking delay',
      );
      assert.ok(
        result.humanWaitProof,
        'missing ordinary-mode human wait proof',
      );
      assert.ok(
        result.botSavedActions.some(
          (action) =>
            action.verb === 'acknowledge' && action.sincePreviousSaveMs >= 1400,
        ),
        'identity acknowledgement lost normal delay',
      );
    }
    result.durationMs = Date.now() - Date.parse(result.startedAt);
    assert.ok(
      !report.pageErrors.some((error) => error.label.startsWith(caseName)),
      `${caseName} render errors`,
    );
  } catch (error) {
    result.check = 'failed';
    result.error = error.stack;
    report.failures++;
    console.error(JSON.stringify({ game: caseName, error: error.message }));
  } finally {
    if (observeTiming) hostSocket.off('room:view', observeTiming);
    playerSocket?.disconnect();
    await phone?.close().catch(() => {});
    await publicPage?.close().catch(() => {});
    await host.goto(origin + '/host').catch(() => {});
    await save();
  }
}
try {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(report.archiveSha256, manifest.archive.sha256);
  assert.ok((await stat(archive)).size < 120000000);
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_INSTALL_ARCHIVE -DestinationPath $env:TABLEMAX_INSTALL_EXTRACT',
    ],
    {
      env: {
        ...process.env,
        TABLEMAX_INSTALL_ARCHIVE: archive,
        TABLEMAX_INSTALL_EXTRACT: extracted,
      },
      windowsHide: true,
    },
  );
  let bytes = 0;
  for (const file of manifest.files) {
    const data = await readFile(join(extracted, file.path));
    assert.equal(data.length, file.bytes);
    assert.equal(hash(data), file.sha256);
    bytes += data.length;
    assert.ok(
      !/^(?:games|bots)\/.+\.cjs(?:\.br)?$/.test(file.path),
      'base embeds game code',
    );
    assert.ok(
      !/^web\/games\/[^/]+\/web\//.test(file.path),
      'base embeds game webpage',
    );
  }
  assert.ok(bytes < 120000000);
  report.baseBytes = bytes;
  report.checks.push('base exact bytes/hash and empty game-code boundary');
  const env = {
    ...process.env,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_BOX_DIRECTORY: extracted,
    PATH: `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`,
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  desktop = await launchDesktop({
    executablePath: join(extracted, 'TableMax.exe'),
    args: ['--foundation-test', '--tablemax-test-mode'],
    env,
    soundEnabled: false,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  await observe(host, 'host');
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken);
  hostSocket = await connect(hostToken);
  const initial = await (await fetch(origin + '/api/game-packages')).json();
  assert.equal(Object.keys(initial.index.releases).length, 0);
  assert.equal((await current(hostToken)).game, null);
  report.checks.push('actual empty base starts without game selection');
  if (onlineRelease) {
    const manage = async (operation, releaseId) => {
      const response = await fetch(origin + '/api/game-packages/manage', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + hostToken,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          operation,
          ...(releaseId ? { releaseId } : {}),
        }),
      });
      const reply = await response.json();
      assert.equal(reply.ok, true, JSON.stringify(reply));
    };
    await manage('refresh');
    const refreshed = await (await fetch(origin + '/api/game-packages')).json();
    assert.deepEqual(refreshed.catalog, catalog);
    report.onlineProgress = [];
    // Same-target requests merge while the two Pokémon variants share blobs.
    await Promise.all(
      releases.flatMap((release) => [
        manage('install', release.releaseId),
        manage('install', release.releaseId),
      ]),
    );
    const deadline = Date.now() + 300000;
    let installed;
    while (Date.now() < deadline) {
      const snapshot = await (
        await fetch(origin + '/api/game-packages')
      ).json();
      const tasks = snapshot.tasks.filter((task) =>
        releases.some((release) => release.releaseId === task.releaseId),
      );
      assert.equal(
        new Set(tasks.map((task) => task.releaseId)).size,
        tasks.length,
      );
      assert.ok(
        !tasks.some((task) => task.phase === 'failed'),
        JSON.stringify(tasks),
      );
      const summary = tasks.map(
        ({ releaseId, phase, transferredBytes, totalBytes }) => ({
          releaseId,
          phase,
          transferredBytes,
          totalBytes,
        }),
      );
      if (
        JSON.stringify(summary) !==
        JSON.stringify(report.onlineProgress.at(-1)?.tasks)
      ) {
        report.onlineProgress.push({
          at: new Date().toISOString(),
          tasks: summary,
        });
        await save();
      }
      if (
        releases.every(
          (release) => snapshot.index.releases[release.releaseId],
        ) &&
        tasks.length === releases.length &&
        tasks.every((task) => task.phase === 'complete')
      ) {
        installed = snapshot;
        break;
      }
      await wait(250);
    }
    assert.ok(installed, 'real Release download/install timed out');
    assert.equal(
      (await current(hostToken)).game,
      null,
      'download auto-selected game',
    );
    assert.ok(installed.tasks.every((task) => task.phase === 'complete'));
    assert.ok(
      installed.tasks.every(
        (task) => task.transferredBytes === task.totalBytes,
      ),
    );
    const closure = new Set(
      releases.flatMap((release) => [release.code, ...release.resources]),
    );
    assert.deepEqual(
      Object.keys(installed.index.blobs).sort(),
      [...closure].sort(),
    );
    const beforeIndex = installed.index;
    await manage('install', releases[0].releaseId);
    let repeated;
    for (let attempts = 0; attempts < 100; attempts++) {
      repeated = await (await fetch(origin + '/api/game-packages')).json();
      if (
        repeated.tasks.find((task) => task.releaseId === releases[0].releaseId)
          ?.phase === 'complete'
      )
        break;
      await wait(100);
    }
    const repeatedTask = repeated.tasks.find(
      (task) => task.releaseId === releases[0].releaseId,
    );
    assert.equal(repeatedTask.phase, 'complete');
    assert.equal(repeatedTask.transferredBytes, 0);
    assert.equal(
      repeatedTask.totalBytes,
      0,
      'installed repeat started another download',
    );
    assert.deepEqual(repeated.index, beforeIndex);
    report.onlineTasks = installed.tasks;
    report.checks.push(
      'real signed Release refresh, actual-byte download progress, same-target merge, shared immutable dependencies, installed repeat, no automatic game selection',
    );
  } else
    for (const release of releases) {
      const archiveBytes = await readFile(
        join(packagesRoot, release.offlineAsset),
      );
      const response = await fetch(origin + '/api/game-packages/import', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + hostToken,
          'content-type': 'application/octet-stream',
        },
        body: archiveBytes,
      });
      const result = await response.json();
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.releaseId, release.releaseId);
    }
  report.checks.push(
    'actual host offline imports verified immutable dependencies',
  );
  await save();
  for (const release of releases) {
    if (report.failures >= maxFailures) break;
    await verifyRelease(release);
  }
  report.skipped = releases
    .slice(report.games.length)
    .map((r) => `${r.gameId}:${r.variantId ?? ''}`);
  assert.equal(report.externalRequests.length, 0, 'external client requests');
  assert.equal(report.pageErrors.length, 0, 'host/public/player render errors');
  report.result = report.failures ? 'failed' : 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.disconnect();
  await desktop?.close().catch((error) => {
    report.shutdownError = error.message;
    report.result = 'failed';
  });
  report.finishedAt = new Date().toISOString();
  await save();
  if (report.result !== 'passed') process.exitCode = 1;
  console.log(
    JSON.stringify({
      result: report.result,
      games: report.games.map((g) => ({
        gameId: g.gameId,
        variantId: g.variantId,
        check: g.check,
        durationMs: g.durationMs,
      })),
      failures: report.failures,
      evidence: join(output, 'results.json'),
    }),
  );
}
