import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join, resolve } from 'node:path';
import { launchDesktop } from './desktop-test.mjs';
import { launchTestBrowser } from './browser-test.mjs';
import { playerUi } from './player-test.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ??
  fallback;
const profile = option('profile', 'all');
const scenario = option('scenario', 'full');
assert.ok(['all', 'touch', 'desktop'].includes(profile), 'Unknown profile');
assert.ok(['full', 'refresh'].includes(scenario), 'Unknown scenario');
const run = option('run', `${Date.now()}-${randomUUID().slice(0, 8)}`);
assert.match(run, /^[a-zA-Z0-9_-]+$/);
const executablePath = resolve(
  option('executable', 'build/desktop/TableMax.exe'),
);
const soundEnabled = args.includes('--sound');
const catalog = JSON.parse(
  await readFile('packages/protocol/src/interaction-catalog.json', 'utf8'),
);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const output = resolve(
  'artifacts/maintenance/v1.0.5/player-interaction-audio',
  run,
);
await mkdir(resolve('tmp'), { recursive: true });
await mkdir(resolve('artifacts/maintenance/v1.0.5/player-interaction-audio'), {
  recursive: true,
});
await mkdir(output);
const work = await mkdtemp(resolve('tmp/root-entry-'));
// Keep this verification's browser profiles and subprocess temporary files inside
// its isolated workspace. The setting does not alter the user's environment.
process.env.TEMP = work;
process.env.TMP = work;
const report = {
  status: 'running',
  startedAt: new Date().toISOString(),
  executablePath,
  executableSha256: createHash('sha256')
    .update(await readFile(executablePath))
    .digest('hex'),
  work,
  profile,
  scenario,
  soundEnabled,
  autoplayPolicy: 'document-user-activation-required',
  checks: [],
  profiles: [],
  errors: [],
  external: [],
  boundary:
    'Hidden real Edge, simulated touch/desktop player documents, actual local server on 127.0.0.1. Parallel analyser observes the existing production node feeding destination without replacing its connection. Default launch is muted; nonzero PCM does not certify physical speakers, real phones or human listening.',
};
const save = () =>
  writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2));
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(callback, description, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await callback();
    if (value) return value;
    await wait(30);
  }
  throw new Error('Timed out: ' + description);
}

// Preserve all real browser calls and the existing audible graph. A parallel
// analyser reads the last production node already connected to destination.
function installAudioAudit() {
  if (window.__playerInteractionAudioAudit) return;
  const audit = (window.__playerInteractionAudioAudit = {
    documentId: String(performance.timeOrigin),
    decodes: [],
    starts: [],
    ended: [],
    stops: [],
    resumes: [],
    gestures: [],
    contexts: [],
    outputs: [],
    errors: [],
  });
  const bytesToUrl = new Map();
  const buffers = new WeakMap();
  const contexts = new WeakMap();
  const sources = new WeakMap();
  const outputNodes = new WeakSet();
  const signature = (bytes) => {
    const data = new Uint8Array(bytes);
    return [data.length, ...data.slice(0, 24), ...data.slice(-24)].join(',');
  };
  const activation = () => ({
    active: navigator.userActivation?.isActive,
    everActive: navigator.userActivation?.hasBeenActive,
  });
  let gesture = null;
  for (const type of [
    'pointerdown',
    'pointerup',
    'touchstart',
    'touchend',
    'keydown',
    'click',
  ])
    window.addEventListener(
      type,
      (event) => {
        gesture = {
          type,
          trusted: event.isTrusted,
          pointerType: event.pointerType,
          at: performance.now(),
          ...activation(),
        };
        audit.gestures.push(gesture);
      },
      { capture: true },
    );
  function contextEntry(context) {
    let entry = contexts.get(context);
    if (entry) return entry;
    entry = {
      id: audit.contexts.length + 1,
      state: context.state,
      createdAt: performance.now(),
      changes: [],
    };
    contexts.set(context, entry);
    audit.contexts.push(entry);
    context.addEventListener('statechange', () => {
      entry.state = context.state;
      entry.changes.push({ at: performance.now(), state: context.state });
    });
    return entry;
  }
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await Reflect.apply(originalFetch, this, args);
    if (/\.mp3(?:\?|$)/i.test(response.url)) {
      const originalBytes = response.arrayBuffer;
      response.arrayBuffer = async function (...byteArgs) {
        const bytes = await Reflect.apply(originalBytes, this, byteArgs);
        bytesToUrl.set(signature(bytes), response.url);
        return bytes;
      };
    }
    return response;
  };
  const Context = window.AudioContext ?? window.webkitAudioContext;
  const originalDecode = Context.prototype.decodeAudioData;
  Context.prototype.decodeAudioData = function (...args) {
    const context = contextEntry(this);
    const url = bytesToUrl.get(signature(args[0]));
    const result = Reflect.apply(originalDecode, this, args);
    void result.then(
      (buffer) => {
        let peak = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel++)
          for (const sample of buffer.getChannelData(channel))
            peak = Math.max(peak, Math.abs(sample));
        const entry = {
          url,
          contextId: context.id,
          duration: buffer.duration,
          channels: buffer.numberOfChannels,
          frames: buffer.length,
          sampleRate: buffer.sampleRate,
          peak,
        };
        buffers.set(buffer, entry);
        audit.decodes.push(entry);
      },
      (error) =>
        audit.errors.push({ phase: 'decode', url, error: String(error) }),
    );
    return result;
  };
  const originalResume = Context.prototype.resume;
  Context.prototype.resume = function (...args) {
    const context = contextEntry(this);
    const entry = {
      contextId: context.id,
      before: this.state,
      at: performance.now(),
      gesture,
      ...activation(),
      status: 'pending',
    };
    audit.resumes.push(entry);
    const result = Reflect.apply(originalResume, this, args);
    void result.then(
      () => {
        entry.status = 'resolved';
        entry.after = this.state;
        entry.elapsedMs = performance.now() - entry.at;
      },
      (error) => {
        entry.status = 'rejected';
        audit.errors.push({ phase: 'resume', error: String(error) });
      },
    );
    return result;
  };
  const originalConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (...args) {
    const result = Reflect.apply(originalConnect, this, args);
    if (args[0] === this.context.destination && !outputNodes.has(this)) {
      outputNodes.add(this);
      const context = contextEntry(this.context);
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 2048;
      Reflect.apply(originalConnect, this, [analyser]);
      const samples = new Float32Array(analyser.fftSize);
      const entry = {
        contextId: context.id,
        productionNode: this.constructor.name,
        samples: [],
      };
      audit.outputs.push(entry);
      const timer = setInterval(() => {
        if (this.context.state === 'closed') return clearInterval(timer);
        analyser.getFloatTimeDomainData(samples);
        let peak = 0,
          squares = 0;
        for (const sample of samples) {
          peak = Math.max(peak, Math.abs(sample));
          squares += sample * sample;
        }
        entry.samples.push({
          at: performance.now(),
          state: this.context.state,
          peak,
          rms: Math.sqrt(squares / samples.length),
        });
        if (entry.samples.length > 1000) entry.samples.shift();
      }, 20);
    }
    return result;
  };
  const originalStart = AudioBufferSourceNode.prototype.start;
  const originalStop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const result = Reflect.apply(originalStart, this, args);
    const id = audit.starts.length + 1;
    sources.set(this, id);
    audit.starts.push({
      id,
      at: performance.now(),
      state: this.context.state,
      args,
      ...buffers.get(this.buffer),
    });
    this.addEventListener('ended', () =>
      audit.ended.push({ id, at: performance.now() }),
    );
    return result;
  };
  AudioBufferSourceNode.prototype.stop = function (...args) {
    const result = Reflect.apply(originalStop, this, args);
    audit.stops.push({ id: sources.get(this), at: performance.now() });
    return result;
  };
}

let desktop, browser, origin, hostSocket;
const sockets = [];
const cdpReaders = new WeakMap();
function observe(page) {
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('request', (request) => {
    if (
      request.url().startsWith('http') &&
      new URL(request.url()).origin !== origin
    )
      report.external.push(request.url());
  });
}
async function connect(token) {
  const socket = io(origin, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket timeout')), 5000);
    socket.once('connect', () => {
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
async function view(socket) {
  const result = await socket.timeout(5000).emitWithAck('room:sync');
  assert.ok(result.ok, JSON.stringify(result));
  return result.view;
}
async function command(socket, command) {
  const current = await view(socket);
  const result = await socket.timeout(5000).emitWithAck('room:command', {
    actionId: randomUUID(),
    instanceId: current.instanceId,
    branch: current.branch,
    revision: current.revision,
    command,
  });
  assert.ok(result.ok, JSON.stringify(result));
}
async function snapshot(page) {
  let cdp = cdpReaders.get(page);
  if (!cdp) {
    cdp = await page.context().newCDPSession(page);
    cdpReaders.set(page, cdp);
  }
  // Playwright's public evaluate() sets userGesture:true in Chromium. Strict
  // autoplay evidence must be read without granting artificial activation.
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const frame = document.querySelector('iframe[data-player-frame]')?.contentWindow;
      if (!frame?.__tablemaxReadInteractionDiagnostics) return null;
      return {
        ready: !!frame.document.querySelector('.interaction-orb'),
        pathname: frame.location.pathname,
        visibility: frame.document.visibilityState,
        activation: {
          active: frame.navigator.userActivation.isActive,
          everActive: frame.navigator.userActivation.hasBeenActive,
        },
        audio: frame.__playerInteractionAudioAudit,
        diagnostics: frame.__tablemaxReadInteractionDiagnostics(),
      };
    })()`,
    userGesture: false,
    returnByValue: true,
  });
  assert.equal(
    result.exceptionDetails,
    undefined,
    'Read-only CDP snapshot failed',
  );
  return result.result.value;
}
function matches(url, file) {
  if (!url) return false;
  const name = basename(new URL(url).pathname);
  return (
    name === file ||
    (name.startsWith(file.slice(0, -4) + '-') && name.endsWith('.mp3'))
  );
}
async function send(socket, entry) {
  const current = await view(socket);
  const result = await socket
    .timeout(5000)
    .emitWithAck('room:interaction:send', {
      requestId: randomUUID().replaceAll('-', ''),
      instanceId: current.instanceId,
      branch: current.branch,
      interaction: catalog.shots.includes(entry)
        ? { type: 'shot', effectId: entry.id, point: { x: 0.5, y: 0.5 } }
        : { type: 'speech', phraseId: entry.id },
    });
  assert.ok(result.ok, JSON.stringify(result));
  return result.eventId;
}
async function hear(page, socket, entry, label, result) {
  const before = await snapshot(page);
  const eventId = await send(socket, entry);
  const sampled = await until(
    async () => {
      const current = await snapshot(page);
      const diagnostic = current.diagnostics.find(
        (item) => item.phase === 'start' && item.eventId === eventId,
      );
      const source = current.audio.starts
        .slice(before.audio.starts.length)
        .find((item) => matches(item.url, entry.audio));
      const output =
        source &&
        current.audio.outputs
          .flatMap((item) => item.samples)
          .filter(
            (item) =>
              item.at >= source.at &&
              item.state === 'running' &&
              item.peak > 0.00001 &&
              item.rms > 0.000001,
          );
      return diagnostic && source && output.length
        ? { current, diagnostic, source, output }
        : null;
    },
    `${label}: ${entry.id} real source and nonzero destination input`,
    2000,
  ).catch(async (error) => {
    result.failureSnapshot = await snapshot(page);
    await save();
    throw error;
  });
  assert.equal(sampled.source.state, 'running');
  assert.equal(sampled.source.args[1], 0, 'New sound begins from zero');
  assert.ok(sampled.diagnostic.durationMs <= catalog.startDeadlineMs);
  assert.ok(sampled.source.peak > 0);
  result.playback.push({
    label,
    id: entry.id,
    eventId,
    startLatencyMs: sampled.diagnostic.durationMs,
    source: sampled.source,
    signal: {
      peak: Math.max(...sampled.output.map((item) => item.peak)),
      rms: Math.max(...sampled.output.map((item) => item.rms)),
      firstAfterStartMs: sampled.output[0].at - sampled.source.at,
    },
  });
  await until(
    async () => {
      const current = await snapshot(page);
      return (
        current.audio.ended.some((item) => item.id === sampled.source.id) ||
        current.audio.stops.some((item) => item.id === sampled.source.id)
      );
    },
    `${entry.id} source completed`,
    sampled.source.duration * 1000 + 1500,
  );
  await save();
}
async function gesture(page, touch, locator) {
  if (touch) await locator.tap();
  else await locator.click();
}
async function unlock(page, touch) {
  // Even locator visibility/geometry uses Playwright evaluation, which can grant
  // Chromium activation before the real input. Read coordinates only through
  // non-activating CDP, then dispatch real touchscreen or mouse input directly.
  await snapshot(page);
  const cdp = cdpReaders.get(page);
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('iframe[data-player-frame]');
      const frame = iframe.contentWindow;
      const candidates = [...frame.document.querySelectorAll('button')];
      const button = ['视频设置', '菜单'].map(label => candidates.find(button => {
        const rect = button.getBoundingClientRect();
        return button.textContent.trim() === label && rect.width > 0 && rect.height > 0;
      })).find(Boolean) ?? frame.document.querySelector('h1,[role="status"]');
      if (!button) throw new Error('Receiving-player settings button is unavailable');
      const inner = button.getBoundingClientRect(), outer = iframe.getBoundingClientRect();
      return {
        label: button.textContent.trim(),
        x: outer.x + (inner.x + inner.width / 2) * outer.width / frame.innerWidth,
        y: outer.y + (inner.y + inner.height / 2) * outer.height / frame.innerHeight,
      };
    })()`,
    userGesture: false,
    returnByValue: true,
  });
  assert.equal(
    result.exceptionDetails,
    undefined,
    'Read-only input geometry failed',
  );
  const point = result.result.value;
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}
async function noReplay(page, socket, result, label, touch) {
  await page.reload();
  await until(async () => {
    const current = await snapshot(page);
    return current?.ready && current.audio.decodes.length === 11;
  }, 'eleven local MP3 prepared');
  await wait(350);
  result.reload = await snapshot(page);
  assert.equal(
    result.reload.audio.starts.length,
    0,
    'Refresh never replays a previous sound',
  );
  // Also open a receiver without an opener, retaining only this already-admitted
  // player's legitimate browser storage. Both reads avoid Playwright evaluate.
  const context = page.context();
  await page.close();
  page = await context.newPage();
  observe(page);
  await page.goto(origin);
  await until(async () => {
    const current = await snapshot(page);
    return current?.ready && current.audio.decodes.length === 11;
  }, 'fresh receiver local MP3 prepared');
  const before = await snapshot(page);
  result.refresh = { before, label };
  await save();
  assert.equal(
    before.activation.everActive,
    false,
    'Fresh receiving page must have no document activation',
  );
  assert.equal(before.visibility, 'visible');
  assert.ok(before.audio.contexts.length > 0);
  assert.ok(
    before.audio.contexts.every((item) => item.state === 'suspended'),
    'Strict autoplay must actually suspend WebAudio',
  );
  const eventId = await send(socket, catalog.shots[0]);
  await wait(catalog.startDeadlineMs + 150);
  const blocked = await snapshot(page);
  assert.equal(blocked.audio.starts.length, 0);
  assert.ok(
    blocked.diagnostics.some(
      (item) => item.phase === 'drop' && item.eventId === eventId,
    ),
  );
  result.refresh.blocked = blocked;
  await save();
  await unlock(page, touch);
  await wait(350);
  const afterGesture = await snapshot(page);
  result.refresh.afterGesture = afterGesture;
  await save();
  assert.equal(
    afterGesture.audio.starts.length,
    0,
    'Old events never start after unlock',
  );
  assert.ok(
    afterGesture.audio.contexts.some((item) => item.state === 'running'),
    `${label}: real ${touch ? 'touch tap' : 'mouse click'} resumes receiving document`,
  );
  await hear(page, socket, catalog.shots[1], `${label}-new`, result);
  await closePanels(page, touch);
  report.checks.push(
    `${result.name}: reload never replays; fresh receiver rejects unactivated event; trusted gesture resumes with no old sound replay and new sound reaches destination`,
  );
  return page;
}
async function closePanels(page, touch) {
  const close = playerUi(page).getByRole('button', {
    name: '关闭面板',
    exact: true,
  });
  for (let index = 0; index < 3 && (await close.count()); index++)
    await gesture(page, touch, close.last());
}
async function blockedControls(page, socket, result, touch) {
  const ui = playerUi(page);
  const video = ui.getByRole('button', { name: '视频设置', exact: true });
  if (!(await video.isVisible()))
    await gesture(
      page,
      touch,
      ui.getByRole('button', { name: '菜单', exact: true }),
    );
  await gesture(page, touch, video);
  const dialog = ui.getByRole('dialog', { name: '视频设置', exact: true });
  await gesture(
    page,
    touch,
    dialog.getByRole('button', { name: '禁用互动特效', exact: true }),
  );
  const before = await snapshot(page);
  await send(socket, catalog.phrases[0]);
  await wait(450);
  assert.equal(
    (await snapshot(page)).audio.starts.length,
    before.audio.starts.length,
  );
  await gesture(
    page,
    touch,
    dialog.getByRole('button', { name: '恢复互动特效', exact: true }),
  );
  await wait(350);
  assert.equal(
    (await snapshot(page)).audio.starts.length,
    before.audio.starts.length,
  );
  await gesture(
    page,
    touch,
    dialog.getByRole('button', { name: '关闭面板', exact: true }),
  );
  await hear(page, socket, catalog.phrases[1], 'restored-new', result);
  report.checks.push(
    `${result.name}: disabled endpoint stays silent, restoring never replays old sound, next event starts`,
  );
}
async function verifyProfile(name) {
  const touch = name === 'touch';
  const context = await browser.newContext({
    viewport: touch
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 },
    isMobile: touch,
    hasTouch: touch,
  });
  await context.addInitScript(installAudioAudit);
  let page = await context.newPage();
  observe(page);
  const result = { name, touch, playback: [] };
  report.profiles.push(result);
  await page.goto(origin);
  await playerUi(page)
    .getByLabel('你的昵称', { exact: true })
    .fill(`音效接收${name}`);
  await gesture(
    page,
    touch,
    playerUi(page).getByRole('button', { name: '加入', exact: true }),
  );
  await playerUi(page).locator('.interaction-orb').waitFor();
  await snapshot(page);
  const tokenRead = await cdpReaders.get(page).send('Runtime.evaluate', {
    expression: `document.querySelector('iframe[data-player-frame]').contentWindow.localStorage.getItem('tablemax-player')`,
    userGesture: false,
    returnByValue: true,
  });
  assert.equal(tokenRead.exceptionDetails, undefined);
  const token = tokenRead.result.value;
  assert.ok(token);
  const socket = await connect(token);
  await until(
    async () => (await snapshot(page)).audio.decodes.length === 11,
    'local audio preload',
  );
  result.join = await snapshot(page);
  await save();
  if (scenario === 'full')
    await hear(page, socket, catalog.phrases[0], 'before-reload', result);
  page = await noReplay(page, socket, result, 'fresh-receiver', touch);
  if (scenario === 'full') {
    for (const entry of [...catalog.shots, ...catalog.phrases])
      await hear(page, socket, entry, 'after-trusted-unlock', result);
    report.checks.push(
      `${name}: after a trusted gesture in a previously unactivated receiver, all five effects and six speeches decode and start with nonzero destination input and <=300ms start delay`,
    );
    await blockedControls(page, socket, result, touch);
    for (const path of ['/player/game', '/']) {
      await page.goto(origin + path);
      await until(
        async () => (await snapshot(page))?.ready,
        'player route ready',
      );
      await unlock(page, touch);
      await hear(page, socket, catalog.phrases[2], `route-${path}`, result);
      await closePanels(page, touch);
    }
    report.checks.push(
      `${name}: box to /game and back uses fresh player documents and new trusted gesture, with next speech audible in the real graph`,
    );
  }
  result.final = await snapshot(page);
  assert.deepEqual(result.final.audio.errors, []);
  await context.close();
  socket.disconnect();
}

try {
  desktop = await launchDesktop({
    executablePath,
    soundEnabled: false,
    env: {
      ...process.env,
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_DATA_DIR: join(work, 'data'),
    },
  });
  const host = await desktop.firstWindow();
  await host.locator('[data-room-revision]').waitFor();
  origin = new URL(host.url()).origin;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  hostSocket = await connect(
    await host.evaluate(() => sessionStorage.getItem('tablemax-host')),
  );
  await command(hostSocket, { type: 'select-game', gameId: 'modern-art' });
  browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
    soundEnabled,
    args: ['--autoplay-policy=document-user-activation-required'],
  });
  for (const name of profile === 'all' ? ['touch', 'desktop'] : [profile])
    await verifyProfile(name);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.external, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  for (const socket of sockets) socket.disconnect();
  const cleanup = await Promise.allSettled([
    browser?.close(),
    desktop?.close(),
  ]);
  report.cleanupErrors = cleanup
    .filter((item) => item.status === 'rejected')
    .map((item) => String(item.reason));
  if (report.cleanupErrors.length) {
    report.status = 'failed';
    process.exitCode = 1;
  }
  await save();
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      evidence: join(output, 'results.json'),
      failure: report.failure,
    }),
  );
}
