import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
import { boundedPush, summarize, SAMPLE_LIMIT } from './summary.mjs';
import { playerFrame } from '../../test/support/player-test.mjs';

assertWorkspaceRoot();
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const childMode = process.argv.includes('--child');
const option = (key) =>
  process.argv.find((v) => v.startsWith(`--${key}=`))?.slice(key.length + 3);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(check, timeout = 10000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) {
    const value = await check();
    if (value) return value;
    await wait(20);
  }
  throw new Error('measurement-timeout');
}

if (childMode) {
  // Wrapping happens only in this isolated measurement process. No production
  // persistence, protocol, secrets projection, or journal formats are changed.
  const { SqliteSaveRepository } =
    await import('../../../apps/server/src/save-repository.ts');
  const { createService } = await import('../../../apps/server/src/service.ts');
  const saveMs = [],
    receiveToSaveMs = [];
  let receivedAt,
    lastReceivedAt,
    lastSavedAt,
    peakHeap = 0,
    peakRss = 0;
  const sample = () => {
    const memory = process.memoryUsage();
    peakHeap = Math.max(peakHeap, memory.heapUsed);
    peakRss = Math.max(peakRss, memory.rss);
  };
  const originalSave = SqliteSaveRepository.prototype.save;
  SqliteSaveRepository.prototype.save = function (...args) {
    const start = performance.now();
    const result = originalSave.apply(this, args);
    lastSavedAt = performance.now();
    boundedPush(saveMs, lastSavedAt - start);
    if (receivedAt !== undefined)
      boundedPush(receiveToSaveMs, lastSavedAt - receivedAt);
    sample();
    return result;
  };
  const start = performance.now();
  const service = await createService({
    host: '127.0.0.1',
    port: 0,
    dataDir: option('data'),
    webDir: resolve('build/desktop/web'),
    playMode: 'test',
  });
  const createMs = performance.now() - start;
  const listenStart = performance.now();
  const port = await service.listen();
  const originalCommand = service.room.command.bind(service.room);
  service.room.command = async (...args) => {
    receivedAt = lastReceivedAt = performance.now();
    try {
      return await originalCommand(...args);
    } finally {
      receivedAt = undefined;
    }
  };
  sample();
  const timer = setInterval(sample, 25);
  process.send({
    type: 'ready',
    port,
    hostToken: service.hostToken,
    createMs,
    listenMs: performance.now() - listenStart,
  });
  process.on('message', async (request) => {
    if (request.type === 'snapshot')
      process.send({
        id: request.id,
        at: performance.now(),
        lastReceivedAt,
        lastSavedAt,
        saveMs,
        receiveToSaveMs,
        sync: service.syncDiagnostics(),
        peakHeap,
        peakRss,
      });
    if (request.type === 'reset') {
      saveMs.length = 0;
      receiveToSaveMs.length = 0;
      process.send({ id: request.id });
    }
    if (request.type === 'stop') {
      clearInterval(timer);
      await service.close();
      process.exit(0);
    }
  });
} else {
  const samples = Number(option('samples') ?? 24);
  assert.ok(
    Number.isInteger(samples) && samples >= 6 && samples <= 128,
    '--samples must be 6..128',
  );
  const output = resolve(
    'artifacts/maintenance/development-efficiency/runtime',
  );
  await mkdir(output, { recursive: true });
  await mkdir('tmp', { recursive: true });
  const work = await mkdtemp(resolve('tmp/efficiency-runtime-'));
  const renderer = option('renderer') ?? 'edge';
  assert.ok(
    ['edge', 'webview2', 'none'].includes(renderer),
    '--renderer must be edge, webview2 or none',
  );
  const report = {
    schemaVersion: 1,
    at: new Date().toISOString(),
    runtime: { node: process.versions.node, platform: process.platform },
    sampleLimit: SAMPLE_LIMIT,
    work,
    scope:
      'Local 127.0.0.1, real SQLite and Socket.IO, six authorized seats; optional hidden silent browser pages. Fresh/repeated startup is not an OS disk-cache cold boot. Sampled peaks are not allocator maxima.',
    renderer,
    failures: [],
    startup: [],
    sync: null,
    workers: null,
    unverified: [
      'Physical phones, LAN/Wi-Fi, weak network, mobile background/foreground and audible playback.',
      'Full EXE startup (source service startup measured instead); standalone built desktop requires preinstalled-games.',
    ],
  };
  let stage = 'startup';
  report.inputs = Object.fromEntries(
    await Promise.all(
      [
        'apps/server/src/service.ts',
        'apps/server/src/bot-executor.ts',
        'games/uno/bot/index.ts',
        'build/desktop/web/index.html',
      ].map(async (path) => [
        path,
        createHash('sha256')
          .update(await readFile(path))
          .digest('hex'),
      ]),
    ),
  );
  const persist = async () => {
    const data = JSON.stringify(report, null, 2) + '\n';
    await writeFile(join(output, `runtime-${work.slice(-6)}.json`), data);
    await writeFile(join(output, 'runtime.json'), data);
  };
  const requireWeb = createRequire(resolve('apps/web/package.json'));
  const { io } = requireWeb('socket.io-client');
  let child, desktop, browser;
  const sockets = [];
  const pages = [];
  let sequence = 0;
  const pending = new Map();
  async function boot(dataDir) {
    const start = performance.now();
    const proc = fork(
      fileURLToPath(import.meta.url),
      ['--child', `--data=${dataDir}`],
      {
        execArgv: ['--import', 'tsx'],
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        env: {
          ...process.env,
          TABLEMAX_AUTO_MAINTENANCE: '0',
          TABLEMAX_HOST: '127.0.0.1',
          TABLEMAX_PORT: '0',
          TABLEMAX_TEST_AUDIO: '0',
        },
      },
    );
    let ready;
    proc.on('message', (message) => {
      if (message.type === 'ready') ready = message;
      else if (pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    });
    const exit = new Promise((done) => proc.once('exit', done));
    // Native errors may contain paths: never persist raw stderr or credentials.
    proc.stderr.resume();
    try {
      await until(
        () =>
          ready ||
          (proc.exitCode !== null &&
            Promise.reject(new Error('service-startup-failed'))),
        30000,
      );
    } catch (error) {
      proc.kill();
      await exit;
      throw error;
    }
    return { ...ready, proc, exit, spawnToReadyMs: performance.now() - start };
  }
  function request(type) {
    const id = ++sequence;
    return new Promise((done, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('diagnostic-timeout'));
      }, 10000);
      pending.set(id, (v) => {
        clearTimeout(timer);
        done(v);
      });
      child.proc.send({ type, id });
    });
  }
  async function connect(origin, token) {
    const socket = io(origin, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    await new Promise((done, reject) => {
      const timer = setTimeout(
        () => reject(new Error('socket-timeout')),
        10000,
      );
      socket.once('room:view', () => {
        clearTimeout(timer);
        done();
      });
      socket.once('connect_error', () => {
        clearTimeout(timer);
        reject(new Error('socket-connect-failed'));
      });
    });
    return socket;
  }
  async function command(socket, token, value, origin, onSubmit = () => {}) {
    const response = await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const { view, ok } = await response.json();
    assert.equal(ok, true);
    const envelope = {
      actionId: randomUUID(),
      instanceId: view.instanceId,
      revision: view.revision,
      branch: view.branch,
      command: value,
    };
    onSubmit();
    return await new Promise((done, reject) =>
      socket
        .timeout(10000)
        .emit('room:command', envelope, (error, result) =>
          error ? reject(new Error('command-timeout')) : done(result),
        ),
    );
  }
  try {
    for (const pass of ['fresh', 'repeated']) {
      child = await boot(join(work, 'service-data'));
      report.startup.push({
        pass,
        spawnToReadyMs: child.spawnToReadyMs,
        createServiceMs: child.createMs,
        listenMs: child.listenMs,
      });
      if (pass === 'fresh') {
        child.proc.send({ type: 'stop' });
        await child.exit;
        child = null;
      }
    }
    const origin = `http://127.0.0.1:${child.port}`;
    stage = 'six-client-join';
    const hostSocket = await connect(origin, child.hostToken);
    assert.equal(
      (
        await command(
          hostSocket,
          child.hostToken,
          { type: 'select-game', gameId: 'uno' },
          origin,
        )
      ).ok,
      true,
    );
    const tokens = [];
    for (let index = 0; index < 6; index++) {
      const joined = await (
        await fetch(origin + '/api/session/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `Measurement ${index + 1}` }),
        })
      ).json();
      assert.equal(joined.ok, true);
      tokens.push(joined.token);
    }
    const clientSockets = [];
    for (const token of tokens)
      clientSockets.push(await connect(origin, token));
    const rendererStart = performance.now();
    stage = 'renderer-startup';
    if (renderer === 'webview2') {
      const { launchDesktop } =
        await import('../../test/support/desktop-test.mjs');
      desktop = await launchDesktop({
        args: ['--foundation-test', '--tablemax-test-mode'],
        env: {
          TABLEMAX_DATA_DIR: join(work, 'webview-host-data'),
          TABLEMAX_HOST: '127.0.0.1',
          TABLEMAX_PORT: '0',
          TABLEMAX_AUTO_MAINTENANCE: '0',
        },
        timeout: 30000,
      });
      report.rendererHost = {
        startupMs: performance.now() - rendererStart,
        timings: desktop.timings,
      };
    } else if (renderer === 'edge') {
      const { launchTestBrowser } =
        await import('../../test/support/browser-test.mjs');
      browser = await launchTestBrowser({ channel: 'msedge', headless: true });
      report.rendererHost = {
        startupMs: performance.now() - rendererStart,
        browserVersion: browser.version(),
      };
    } else
      report.unverified.push(
        'Page operability and receive-to-frame: --renderer=none selected.',
      );
    for (let index = 0; index < (renderer === 'none' ? 0 : 6); index++) {
      stage = 'page-operable';
      const pageStart = performance.now();
      let page;
      if (desktop) {
        const nextPage = desktop.waitForEvent('window', { timeout: 20000 });
        await desktop.request('new-window', {
          url: origin + '/',
          width: 390,
          height: 844,
          partition: `persist:runtime-${work.slice(-6)}-${index}`,
          managed: false,
        });
        page = await nextPage;
      } else {
        page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await page.goto(origin + '/');
      }
      await page.waitForLoadState('domcontentloaded');
      await page.evaluate((token) => {
        localStorage.setItem('tablemax-player', token);
      }, tokens[index]);
      await page.reload();
      const surface = await playerFrame(page);
      await surface
        .getByRole('button', { name: '我准备好了', exact: true })
        .waitFor();
      const end = performance.now();
      const before = performance.now();
      const pageNow = await surface.evaluate(() => performance.now());
      const after = performance.now();
      pages.push({
        page: surface,
        offset: (before + after) / 2 - pageNow,
        errorMs: (after - before) / 2,
      });
      report.startup.push({
        pass: `page-${index + 1}`,
        pageOperableMs: end - pageStart,
        clockCalibrationErrorMs: (after - before) / 2,
      });
    }
    await request('reset');
    stage = 'six-client-sync';
    const beforeSync = (await request('snapshot')).sync;
    const submitToReceive = [],
      submitToAck = [],
      wireBytes = [],
      receiveToFrame = [],
      submitToFrame = [],
      savedToFrame = [];
    const submittedToServerReceived = [],
      serverClockErrors = [];
    let negativeSubmitToFrameDropped = 0;
    const pageBaseline = await Promise.all(
      pages.map(({ page }) =>
        page.evaluate(
          () => window.__tablemaxReadRoomSyncDiagnostics().at(-1)?.at ?? 0,
        ),
      ),
    );
    for (let index = 0; index < samples; index++) {
      const target = index % 6,
        ready = Math.floor(index / 6) % 2 === 0;
      const latest = [],
        sequences = [],
        revisions = [];
      let started = performance.now();
      const listeners = clientSockets.map((socket, seat) => {
        const listener = (projection) => {
          if (projection.view?.seats?.[target]?.ready === ready) {
            latest[seat] = performance.now() - started;
            sequences[seat] = projection.stamp.viewSeq;
            revisions[seat] = projection.view.revision;
            boundedPush(
              wireBytes,
              Buffer.byteLength(JSON.stringify(projection)),
            );
          }
        };
        socket.on('room:view', listener);
        return listener;
      });
      const snapshotBefore = await request('snapshot');
      const calibrationBefore = performance.now();
      const serverClock = await request('snapshot');
      const calibrationAfter = performance.now();
      const serverOffset =
        (calibrationBefore + calibrationAfter) / 2 - serverClock.at;
      const result = await command(
        clientSockets[target],
        tokens[target],
        { type: 'ready', ready },
        origin,
        () => {
          started = performance.now();
        },
      );
      assert.equal(result.ok, true);
      boundedPush(submitToAck, performance.now() - started);
      await until(() => latest.filter(Number.isFinite).length === 6);
      for (const value of latest) boundedPush(submitToReceive, value);
      const snapshot = await request('snapshot');
      boundedPush(
        submittedToServerReceived,
        Math.max(0, snapshot.lastReceivedAt + serverOffset - started),
      );
      boundedPush(
        serverClockErrors,
        (calibrationAfter - calibrationBefore) / 2,
      );
      const pageResults = pages.length
        ? await until(async () => {
            const entries = await Promise.all(
              pages.map(({ page }, seat) =>
                page.evaluate(
                  (since) =>
                    window
                      .__tablemaxReadRoomSyncDiagnostics()
                      .filter((entry) => entry.at > since),
                  pageBaseline[seat],
                ),
              ),
            );
            if (
              !entries.every((items, seat) =>
                items.some(
                  (entry) =>
                    entry.phase === 'frame' && entry.viewSeq >= sequences[seat],
                ),
              )
            )
              return false;
            const committed = await Promise.all(
              pages.map(({ page }) =>
                page.evaluate(() =>
                  Number(
                    document.querySelector('.room-root')?.dataset.roomRevision,
                  ),
                ),
              ),
            );
            if (
              !committed.every((revision, seat) => revision === revisions[seat])
            )
              return false;
            return entries;
          })
        : [];
      for (let seat = 0; seat < pages.length; seat++) {
        const entries = pageResults[seat];
        const frame = entries.filter((entry) => entry.phase === 'frame').at(-1);
        const receive = entries
          .filter((entry) => entry.phase === 'receive' && entry.at <= frame.at)
          .at(-1);
        pageBaseline[seat] = frame.at;
        if (receive) boundedPush(receiveToFrame, frame.at - receive.at);
        const frameEstimate = frame.at + pages[seat].offset - started;
        if (frameEstimate < 0) negativeSubmitToFrameDropped++;
        boundedPush(submitToFrame, frameEstimate);
        boundedPush(
          savedToFrame,
          Math.max(
            0,
            frame.at + pages[seat].offset - snapshot.lastSavedAt - serverOffset,
          ),
        );
      }
      listeners.forEach((listener, seat) =>
        clientSockets[seat].off('room:view', listener),
      );
      assert.ok(
        snapshot.saveMs.length > snapshotBefore.saveMs.length,
        'ready command must save',
      );
    }
    // A real player cannot acquire host authorization through diagnostics.
    assert.equal(
      (
        await command(
          clientSockets[0],
          tokens[0],
          { type: 'select-game', gameId: 'modern-art' },
          origin,
        )
      ).ok,
      false,
    );
    const snapshot = await request('snapshot');
    const metrics = Object.fromEntries(
      Object.entries(snapshot.sync.metrics).map(([name, value]) => [
        name,
        summarize(
          value.count === beforeSync.metrics[name].count
            ? []
            : value.samplesMs.slice(
                -Math.min(value.count - beforeSync.metrics[name].count, 256),
              ),
        ),
      ]),
    );
    report.sync = {
      scenario:
        'Six real human UNO lobby seats, sequential ready/cancel-ready commits; each seat has a Node transport observer and, when enabled, an independent hidden browser page. No rule/strategy optimization.',
      commands: samples,
      domRevisionConfirmed: pages.length === 6,
      failures: 0,
      saveMs: summarize(snapshot.saveMs),
      receivedToSavedMs: summarize(snapshot.receiveToSaveMs),
      server: metrics,
      submitToServerReceivedCalibratedMs: summarize(submittedToServerReceived),
      serverClockErrorMs: summarize(serverClockErrors),
      submitToReceiveMs: summarize(submitToReceive),
      submitToAckMs: summarize(submitToAck),
      projectionJsonBytes: summarize(wireBytes),
      receiveToFrameMs: summarize(receiveToFrame),
      submitToFrameCalibratedMs: summarize(submitToFrame),
      negativeSubmitToFrameDropped,
      savedToFrameCalibratedMs: summarize(savedToFrame),
      sampledPeakHeapBytes: snapshot.peakHeap,
      sampledPeakRssBytes: snapshot.peakRss,
      clock:
        'Single-process monotonic timings per segment; page clocks calibrated once via CDP midpoint, errors recorded in page startup; server calibrated per command over IPC. Submit begins immediately before Socket.IO emit. Calibrated intervals are estimates with clock-error bounds; frame callback marks an animation frame, not verified pixel paint.',
    };
    await persist();
    stage = 'worker-lifecycle';
    // Compile and measure in a normal Node child, without inherited TS loaders.
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const workerRun = await promisify(execFile)(
      process.execPath,
      [
        resolve('tools/analysis/runtime/measure-workers.mjs'),
        `--work=${work}`,
        '--json',
      ],
      {
        windowsHide: true,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, TABLEMAX_AUTO_MAINTENANCE: '0' },
      },
    );
    report.workers = JSON.parse(workerRun.stdout);
    report.result = 'measured';
  } catch (error) {
    // Only fixed categories; error messages may include private URLs/tokens.
    report.failures.push({
      stage,
      category:
        error?.code === 'ENOENT'
          ? 'missing-prerequisite'
          : 'measurement-failed',
    });
    report.result = 'failed';
    process.exitCode = 1;
    console.error(
      'Runtime measurement failed; inspect stage and local prerequisites.',
    );
    console.error(
      String(error?.stack ?? '')
        .split('\n')
        .filter((line) => /^\s+at .*measure-runtime\.mjs:\d+/.test(line))
        .slice(0, 3)
        .join('\n'),
    );
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (desktop) await desktop.close();
    if (browser) await browser.close();
    if (child) {
      child.proc.send({ type: 'stop' });
      await child.exit;
    }
    await persist();
  }
  console.log(
    JSON.stringify({
      result: report.result,
      report: join(output, 'runtime.json'),
      commands: report.sync?.commands ?? 0,
      failures: report.failures.length,
    }),
  );
}
