import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { launchDesktop } from './desktop-test.mjs';
import { launchTestBrowser } from './browser-test.mjs';
import { playerFrame, playerUi } from './player-test.mjs';

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const catalog = JSON.parse(
  await readFile('packages/protocol/src/interaction-catalog.json', 'utf8'),
);
assert.equal(catalog.playbackPolicy, 'replace');
assert.equal(catalog.shots.length, 5);
assert.equal(catalog.phrases.length, 6);
const args = process.argv.slice(2);
const executableOptions = args.filter((arg) => arg.startsWith('--executable='));
assert.ok(
  executableOptions.length <= 1,
  'Only one --executable option is supported',
);
const executablePath = resolve(
  executableOptions[0]?.slice(13) ?? 'build/desktop/TableMax.exe',
);
const packagedWeb = join(dirname(executablePath), 'web');
const packageManifest = executableOptions.length
  ? JSON.parse(
      await readFile(
        join(dirname(dirname(executablePath)), 'release-manifest.json'),
        'utf8',
      ),
    )
  : null;
const gameOptions = args.filter((arg) => arg.startsWith('--game='));
const boxOnly = args.includes('--box-only');
const shotVisuals = args.includes('--shot-visuals');
const effectOptions = args.filter((arg) => arg.startsWith('--effect='));
assert.ok(effectOptions.length <= 1, 'Only one --effect option is supported');
const effectFilter = effectOptions[0]?.slice(9);
assert.ok(!effectFilter || shotVisuals, '--effect requires --shot-visuals');
assert.ok(
  !effectFilter || catalog.shots.some((entry) => entry.id === effectFilter),
  'Unknown --effect',
);
assert.ok(gameOptions.length <= 1, 'Only one --game option is supported');
assert.ok(!boxOnly || !gameOptions.length, '--box-only excludes --game');
assert.ok(
  !shotVisuals || (!boxOnly && !gameOptions.length),
  '--shot-visuals excludes --box-only and --game',
);
const selectedGame = gameOptions[0]?.slice(7);
const gameIds = ['modern-art', 'power-grid', 'pokemon-encounters'];
assert.ok(!selectedGame || gameIds.includes(selectedGame), 'Unknown --game');
const choices =
  boxOnly || shotVisuals
    ? []
    : [
        { gameId: 'modern-art' },
        { gameId: 'power-grid' },
        { gameId: 'pokemon-encounters', variantId: 'original' },
        { gameId: 'pokemon-encounters', variantId: 'expansion' },
      ].filter((choice) => !selectedGame || choice.gameId === selectedGame);
const run =
  args.find((arg) => arg.startsWith('--run='))?.slice(6) ??
  `${Date.now()}-${randomUUID().slice(0, 8)}`;
assert.match(run, /^[a-zA-Z0-9_-]+$/, 'Unsafe evidence directory name');
const evidenceRoot = resolve(
  'artifacts/maintenance/v1.0.5/interaction-refinement/ui',
);
await mkdir(evidenceRoot, { recursive: true });
const output = join(evidenceRoot, run);
// Refuse to overwrite either previous successful evidence or failure evidence.
await mkdir(output);
const work = await mkdtemp(resolve('tmp/interaction-ui-'));
const report = {
  status: 'running',
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
  external: [],
  screenshots: [],
  events: [],
  selections: [],
  playback: [],
  gameChoices: choices,
  effectFilter,
  executablePath,
  packagedWeb,
  portable: !!packageManifest,
  archiveSha256: packageManifest?.archive.sha256,
  packageSnapshot: packageManifest?.snapshot,
  pauseFixture: !boxOnly && !shotVisuals,
  scope: shotVisuals
    ? `Actual hidden frozen WinForms/WebView2 package and muted headless Edge on 127.0.0.1; admission and ${effectFilter ? effectFilter : 'five'} shots only. Production CSS animations naturally reach the selected frame, then pause briefly for screenshot stability; currentTime is never assigned. Local decoded images, canvas alpha, opacity and hit geometry are inspected; no game matrix, gesture regression, speech, settings or audio regression.`
    : `Actual hidden WinForms/WebView2 and muted headless Edge on 127.0.0.1. Shared interaction/video controls only; ${boxOnly ? 'no game routes or start/pause fixture' : 'one start/pause fixture'}, no game rules or complete-game matrix. Simulated mobile viewports; real audio decode/start/stop observations, no human listening or physical-phone claim.`,
};
let desktop, browser, origin, host, publicPage, player, hostToken, token;
let hostSocket, playerSocket;
const sockets = [];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const save = () =>
  writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2));
const checked = async (text) => {
  report.checks.push(text);
  console.log(text);
  await save();
};
async function until(check, label, timeout = 1500) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await check();
    if (result) return result;
    await wait(30);
  }
  throw new Error(`Timed out: ${label}`);
}

// Wrap real browser calls; preserve their return values, authorization and sound.
// Muting belongs to the test launcher, never to a fake context or fake source.
function installAudioAudit() {
  if (window.__interactionAudioAudit) return;
  const audit = (window.__interactionAudioAudit = {
    documentId: String(performance.timeOrigin),
    decodes: [],
    starts: [],
    stops: [],
    ended: [],
    errors: [],
  });
  const encoded = new Map();
  const buffers = new WeakMap();
  const sources = new WeakMap();
  let sequence = 0;
  function signature(bytes) {
    const data = new Uint8Array(bytes);
    return [data.length, ...data.slice(0, 24), ...data.slice(-24)].join(',');
  }
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await Reflect.apply(originalFetch, this, args);
    if (/\.mp3(?:\?|$)/i.test(response.url)) {
      const originalBytes = response.arrayBuffer;
      response.arrayBuffer = async function (...byteArgs) {
        const bytes = await Reflect.apply(originalBytes, this, byteArgs);
        encoded.set(signature(bytes), response.url);
        return bytes;
      };
    }
    return response;
  };
  const context = window.AudioContext ?? window.webkitAudioContext;
  if (context) {
    const originalDecode = context.prototype.decodeAudioData;
    context.prototype.decodeAudioData = function (...args) {
      const url = encoded.get(signature(args[0])) ?? null;
      const result = Reflect.apply(originalDecode, this, args);
      void result.then(
        (buffer) => {
          const entry = {
            url,
            duration: buffer.duration,
            channels: buffer.numberOfChannels,
            length: buffer.length,
            sampleRate: buffer.sampleRate,
          };
          buffers.set(buffer, entry);
          audit.decodes.push(entry);
        },
        (error) =>
          audit.errors.push({ phase: 'decode', url, error: String(error) }),
      );
      return result;
    };
  }
  if (window.AudioBufferSourceNode) {
    const originalStart = AudioBufferSourceNode.prototype.start;
    const originalStop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const result = Reflect.apply(originalStart, this, args);
      const id = ++sequence;
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
      audit.stops.push({ id: sources.get(this), at: performance.now(), args });
      return result;
    };
  }
}
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
async function post(path, body) {
  const reply = await (
    await fetch(origin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  ).json();
  assert.ok(reply.ok, JSON.stringify(reply));
  return reply;
}
async function view(credential = hostToken) {
  return (await post('/api/session/view', { token: credential })).view;
}
async function connect(credential) {
  const socket = io(origin, {
    auth: { token: credential },
    transports: ['websocket'],
    forceNew: true,
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Socket connect timeout')),
      5000,
    );
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
async function command(command, credential = hostToken, socket = hostSocket) {
  const state = await view(credential);
  const reply = await socket.timeout(5000).emitWithAck('room:command', {
    actionId: randomUUID(),
    instanceId: state.instanceId,
    branch: state.branch,
    revision: state.revision,
    command,
  });
  assert.ok(reply.ok, JSON.stringify(reply));
}
async function audit(surface) {
  return surface.evaluate(() => window.__interactionAudioAudit);
}
function matchesAudio(url, file) {
  if (!url) return false;
  const stem = file.slice(0, -4);
  const name = basename(new URL(url).pathname);
  return (
    name === file || (name.startsWith(stem + '-') && name.endsWith('.mp3'))
  );
}
async function screenshot(name) {
  await player.screenshot({ path: join(output, name + '.png') });
  report.screenshots.push(name + '.png');
}
async function beginWheel({ checkDelay = false } = {}) {
  const frame = await playerFrame(player);
  const orb = frame.locator('.interaction-orb');
  const rect = await orb.boundingBox();
  assert.ok(rect);
  await player.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  const started = Date.now();
  await player.mouse.down();
  if (checkDelay) {
    await wait(100);
    assert.equal(await frame.locator('.interaction-wheel').count(), 0);
  }
  const wheel = frame.locator('.interaction-wheel');
  await wheel.waitFor({ timeout: 1500 });
  const openedAfterMs = Date.now() - started;
  if (checkDelay)
    assert.ok(openedAfterMs >= 200, `Opened after ${openedAfterMs}ms`);
  assert.equal(
    await frame.locator('.interaction-wheel__sectors path').count(),
    6,
  );
  assert.equal(await frame.locator('.interaction-wheel__slot').count(), 6);
  const sectorLengths = await frame
    .locator('.interaction-wheel__sectors path')
    .evaluateAll((paths) => paths.map((path) => path.getTotalLength()));
  assert.ok(Math.max(...sectorLengths) - Math.min(...sectorLengths) < 0.02);
  report.wheelGeometry ??= { sectorLengths };
  const speech = frame.locator('.interaction-wheel__slot').nth(5);
  assert.equal(await speech.locator('svg[aria-label="发言"]').count(), 1);
  assert.equal((await speech.textContent()).trim(), '');
  // Wait only for the documented 160ms positioning transition, not playback.
  await until(async () => {
    const [orbBox, wheelBox] = await Promise.all([
      orb.boundingBox(),
      wheel.boundingBox(),
    ]);
    return (
      orbBox &&
      wheelBox &&
      Math.abs(orbBox.x + orbBox.width / 2 - wheelBox.x - wheelBox.width / 2) <
        2 &&
      Math.abs(
        orbBox.y + orbBox.height / 2 - wheelBox.y - wheelBox.height / 2,
      ) < 2
    );
  }, 'orb and wheel share the actual displayed center');
  assert.equal(await orb.getAttribute('aria-label'), '取消互动');
  assert.equal((await orb.textContent()).trim(), '取消');
  return { frame, wheel, ring: await wheel.boundingBox(), openedAfterMs };
}
async function pointTo(ring, index) {
  const angle = ((-90 + index * 60) * Math.PI) / 180;
  await player.mouse.move(
    ring.x + ring.width / 2 + Math.cos(angle) * 86,
    ring.y + ring.height / 2 + Math.sin(angle) * 86,
    { steps: 2 },
  );
}
async function select(index) {
  const opened = await beginWheel();
  await pointTo(opened.ring, index);
  assert.equal(
    await opened.frame
      .locator('.interaction-wheel__sectors path[data-selected="true"]')
      .count(),
    1,
  );
  await player.mouse.up();
  await opened.wheel.waitFor({ state: 'detached' });
  report.selections.push({ index, openedAfterMs: opened.openedAfterMs });
}
async function video(surface) {
  await surface.getByRole('button', { name: '视频设置', exact: true }).click();
  const dialog = surface.getByRole('dialog', { name: '视频设置', exact: true });
  await dialog.waitFor();
  assert.equal(
    await dialog.locator('.interaction-video-setting button').count(),
    1,
  );
  return dialog;
}
async function closePanel(dialog) {
  await dialog.getByRole('button', { name: '关闭面板', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
}
async function setBlocked(surface, blocked) {
  const dialog = await video(surface);
  await dialog
    .getByRole('button', {
      name: blocked ? '禁用互动特效' : '恢复互动特效',
      exact: true,
    })
    .click();
  const next = dialog.getByRole('button', {
    name: blocked ? '恢复互动特效' : '禁用互动特效',
    exact: true,
  });
  assert.equal(await next.getAttribute('aria-pressed'), String(blocked));
  await closePanel(dialog);
}
async function assertVisibleEvent(entry, surface) {
  const locator =
    entry.type === 'shot'
      ? surface.locator(`[data-effect="${entry.id}"]`)
      : surface
          .locator('.interaction-speech span')
          .filter({ hasText: entry.text });
  await locator.waitFor({ timeout: 1500 });
  if (entry.type === 'speech')
    assert.equal(await locator.textContent(), entry.text);
  assert.equal(
    await surface.locator('.interaction-shot,.interaction-speech').count(),
    1,
  );
}
async function playback(entry, action, { blockedRole = null } = {}) {
  const frame = await playerFrame(player);
  const surfaces = { player: frame, host, public: publicPage };
  const before = await view();
  const eventIndex = report.events.length;
  const audits = Object.fromEntries(
    await Promise.all(
      Object.entries(surfaces).map(async ([role, surface]) => [
        role,
        await audit(surface),
      ]),
    ),
  );
  const started = Date.now();
  await action(frame);
  const observed = await until(
    () => report.events[eventIndex],
    `immediate ${entry.id} server broadcast`,
  );
  assert.equal(observed.event.interaction.type, entry.type);
  assert.equal(
    observed.event.interaction[entry.type === 'shot' ? 'effectId' : 'phraseId'],
    entry.id,
  );
  assert.ok(
    observed.at - started < 1500,
    'Interaction must not wait for old playback',
  );
  await Promise.all(
    Object.entries(surfaces).map(async ([role, surface]) => {
      if (role === blockedRole) {
        assert.equal(
          await surface
            .locator('.interaction-shot,.interaction-speech')
            .count(),
          0,
        );
      } else await assertVisibleEvent(entry, surface);
    }),
  );
  const audioRole = blockedRole === 'public' ? 'host' : 'public';
  for (const role of ['player', audioRole].filter(
    (role) => role !== blockedRole,
  )) {
    const surface = surfaces[role];
    await until(async () => {
      const current = await audit(surface);
      return current.starts
        .slice(audits[role].starts.length)
        .some((item) => matchesAudio(item.url, entry.audio));
    }, `real ${role} source.start for ${entry.audio}`);
  }
  for (const [role, surface] of Object.entries(surfaces)) {
    const current = await audit(surface);
    if (role === blockedRole)
      assert.equal(current.starts.length, audits[role].starts.length);
    report.playback.push({
      eventId: observed.event.eventId,
      entry: entry.id,
      role,
      sourceStarts: current.starts.slice(audits[role].starts.length),
      sourceStops: current.stops.slice(audits[role].stops.length),
    });
  }
  assert.equal((await view()).revision, before.revision);
  return observed.event;
}
async function shot(entry, index, options) {
  await select(index);
  const frame = await playerFrame(player);
  await frame.locator('.interaction-aim').waitFor();
  await frame.evaluate(() => {
    window.__interactionUnderlyingClicks = 0;
    document
      .querySelector('.room-root')
      .addEventListener('click', () => window.__interactionUnderlyingClicks++);
  });
  await playback(
    { ...entry, type: 'shot' },
    async () => {
      const rect = await frame.locator('body').boundingBox();
      await player.mouse.click(
        rect.x + rect.width * 0.32,
        rect.y + rect.height * 0.38,
      );
    },
    options,
  );
  assert.equal(await frame.locator('.interaction-aim').count(), 0);
  assert.equal(
    await frame.evaluate(() => window.__interactionUnderlyingClicks),
    0,
  );
  await until(
    () =>
      frame
        .locator('.interaction-shot img')
        .evaluateAll(
          (images) =>
            images.length > 0 &&
            images.every((image) => image.complete && image.naturalWidth > 0),
        ),
    `${entry.id} local image decoding`,
  );
}
async function speak(entry, options) {
  await select(5);
  const frame = await playerFrame(player);
  const dialog = frame.getByRole('dialog', { name: '发言', exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.locator('.interaction-phrases button').count(), 6);
  assert.equal(await dialog.locator('input,textarea').count(), 0);
  await playback(
    { ...entry, type: 'speech' },
    () => dialog.getByRole('button', { name: entry.text, exact: true }).click(),
    options,
  );
  await dialog.waitFor({ state: 'detached' });
}
async function verifyDragAndCancel() {
  let frame = await playerFrame(player);
  const before = await view();
  const eventCount = report.events.length;
  const old = await frame.locator('.interaction-orb').boundingBox();
  await player.mouse.move(old.x + old.width / 2, old.y + old.height / 2);
  await player.mouse.down();
  await player.mouse.move(old.x - 95, old.y - 100, { steps: 2 });
  await player.mouse.up();
  assert.equal(await frame.locator('.interaction-wheel').count(), 0);
  const saved = await frame.evaluate(() =>
    JSON.parse(localStorage.getItem('tablemax-interaction-orb-player')),
  );
  assert.ok(saved.x >= 0 && saved.x <= 1 && saved.y >= 0 && saved.y <= 1);
  await player.reload();
  await playerUi(player).locator('.interaction-orb').waitFor();
  frame = await playerFrame(player);
  const restored = await frame.locator('.interaction-orb').evaluate((orb) => {
    const rect = orb.getBoundingClientRect();
    return {
      x: (rect.x + rect.width / 2) / innerWidth,
      y: (rect.y + rect.height / 2) / innerHeight,
    };
  });
  assert.ok(
    Math.abs(restored.x - saved.x) < 0.015 &&
      Math.abs(restored.y - saved.y) < 0.015,
  );
  const opened = await beginWheel({ checkDelay: true });
  await pointTo(opened.ring, 0);
  await player.mouse.move(
    opened.ring.x + opened.ring.width / 2,
    opened.ring.y + opened.ring.height / 2,
  );
  assert.equal(
    await frame
      .locator('.interaction-wheel__sectors path[data-selected="true"]')
      .count(),
    0,
  );
  await player.mouse.up();
  await opened.wheel.waitFor({ state: 'detached' });
  assert.equal(await frame.locator('.interaction-aim').count(), 0);
  assert.equal(
    await frame.getByRole('dialog', { name: '发言', exact: true }).count(),
    0,
  );
  const escape = await beginWheel();
  await pointTo(escape.ring, 1);
  await player.keyboard.press('Escape');
  await player.mouse.up();
  await escape.wheel.waitFor({ state: 'detached' });
  await select(0);
  const aim = frame.locator('.interaction-aim');
  const cancel = aim.getByRole('button', { name: '取消', exact: true });
  await frame.evaluate(() => {
    window.__interactionCancelUnderlyingClicks = 0;
    document
      .querySelector('.room-root')
      .addEventListener(
        'click',
        () => window.__interactionCancelUnderlyingClicks++,
      );
  });
  const cancelBox = await cancel.boundingBox();
  await player.mouse.move(
    cancelBox.x + cancelBox.width / 2,
    cancelBox.y + cancelBox.height / 2,
  );
  await player.mouse.down();
  await player.mouse.move(cancelBox.x - 90, cancelBox.y - 70, { steps: 2 });
  await player.mouse.up();
  assert.equal(report.events.length, eventCount);
  assert.equal(
    await frame.evaluate(() => window.__interactionCancelUnderlyingClicks),
    0,
  );
  if (await aim.count()) await cancel.click();
  assert.equal(await frame.locator('.interaction-aim').count(), 0);
  assert.equal(report.events.length, eventCount);
  assert.equal((await view()).revision, before.revision);
  report.drag = { saved, restored, openedAfterMs: opened.openedAfterMs };
  await checked(
    'Short drag persists across reload; delayed six-sector wheel follows the actual orb; speech SVG has no text; central release, Escape, aim cancel and sliding off pressed cancel send nothing',
  );
}
async function verifyPortalGestureRecovery() {
  const frame = await playerFrame(player);
  const eventCount = report.events.length;
  // Focus before pointer-down: preventing the orb's default down preserves focus,
  // so a real Enter opens/closes the actual dialog during pointer capture.
  const videoButton = frame.getByRole('button', {
    name: '视频设置',
    exact: true,
  });
  await videoButton.focus();
  const orb = frame.locator('.interaction-orb');
  const box = await orb.boundingBox();
  await player.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await player.mouse.down();
  await player.mouse.move(box.x - 45, box.y - 40, { steps: 2 });
  await player.keyboard.press('Enter');
  const dialog = frame.getByRole('dialog', { name: '视频设置', exact: true });
  await dialog.waitFor();
  await player.mouse.up();
  assert.equal(await frame.locator('.interaction-wheel').count(), 0);
  await until(
    () =>
      dialog
        .locator('.interaction-orb')
        .count()
        .then((count) => count === 1),
    'orb moved into opened dialog',
  );
  await dialog.getByRole('button', { name: '关闭面板', exact: true }).focus();
  const opened = await beginWheel();
  await pointTo(opened.ring, 0);
  await player.keyboard.press('Enter');
  await dialog.waitFor({ state: 'detached' });
  await player.mouse.up();
  assert.equal(await frame.locator('.interaction-wheel').count(), 0);
  assert.equal(await frame.locator('.interaction-aim').count(), 0);
  const recovered = await orb.boundingBox();
  await player.mouse.move(
    recovered.x + recovered.width / 2,
    recovered.y + recovered.height / 2,
  );
  await player.mouse.down();
  await player.mouse.move(recovered.x + 50, recovered.y - 30, { steps: 2 });
  await player.mouse.up();
  assert.equal(await frame.locator('.interaction-wheel').count(), 0);
  const usable = await beginWheel();
  await player.mouse.move(
    usable.ring.x + usable.ring.width / 2,
    usable.ring.y + usable.ring.height / 2,
  );
  await player.mouse.up();
  await usable.wheel.waitFor({ state: 'detached' });
  assert.equal(report.events.length, eventCount);
  await checked(
    'Opening a dialog during drag and closing it during a held wheel safely migrate the portal; subsequent dragging/long-press work with no stuck capture, residual wheel or unintended send',
  );
}
async function verifyBlockControls() {
  const frame = await playerFrame(player);
  for (const [role, surface] of Object.entries({
    host,
    public: publicPage,
    player: frame,
  })) {
    await speak(catalog.phrases[3]);
    await setBlocked(surface, true);
    await until(
      () =>
        surface
          .locator('.interaction-shot,.interaction-speech')
          .count()
          .then((count) => count === 0),
      `${role} clears active playback`,
    );
    assert.equal(
      await surface.evaluate(
        (key) => localStorage.getItem(key),
        `tablemax-interaction-blocked-${role}`,
      ),
      'true',
    );
    await speak(catalog.phrases[0], { blockedRole: role });
    const beforeRestore = await audit(surface);
    await setBlocked(surface, false);
    assert.equal(
      await surface.locator('.interaction-shot,.interaction-speech').count(),
      0,
    );
    await wait(100);
    assert.equal(
      (await audit(surface)).starts.length,
      beforeRestore.starts.length,
    );
    await speak(catalog.phrases[1]);
  }
  assert.equal(
    await frame.evaluate(() => typeof window.tablemaxInteractionAudio),
    'undefined',
  );
  const priorityId = randomUUID();
  assert.deepEqual(
    await Promise.all([
      host.evaluate(
        (id) => window.tablemaxInteractionAudio.claimEvent(id),
        priorityId,
      ),
      publicPage.evaluate(
        (id) => window.tablemaxInteractionAudio.claimEvent(id),
        priorityId,
      ),
    ]),
    [false, true],
  );
  await setBlocked(publicPage, true);
  const fallbackId = randomUUID();
  await until(
    () =>
      host.evaluate(
        (id) => window.tablemaxInteractionAudio.claimEvent(id),
        fallbackId,
      ),
    'host receives native audio ownership',
  );
  assert.equal(
    await publicPage.evaluate(
      (id) => window.tablemaxInteractionAudio.claimEvent(id),
      fallbackId,
    ),
    false,
  );
  await speak(catalog.phrases[2], { blockedRole: 'public' });
  await setBlocked(publicPage, false);
  await checked(
    'Video settings independently disable/restore host, public and player visuals/speech/audio; restoring never replays; public native audio priority and host fallback; player has no native bridge',
  );
}
async function verifyMobileAndModal() {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
  ]) {
    await player.setViewportSize(viewport);
    const frame = await playerFrame(player);
    const dialog = await video(frame);
    assert.equal(await dialog.locator('.interaction-orb').count(), 1);
    assert.equal(await dialog.locator('.display-settings-fields').count(), 0);
    const opened = await beginWheel();
    const metrics = await opened.wheel.evaluate((wheel) => {
      const rect = wheel.getBoundingClientRect();
      const orb = document
        .querySelector('.interaction-orb')
        .getBoundingClientRect();
      return {
        width: innerWidth,
        height: innerHeight,
        rect: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom },
        hitIsOrb: !!document
          .elementFromPoint(orb.x + orb.width / 2, orb.y + orb.height / 2)
          ?.closest('.interaction-orb'),
        inModal: !!wheel.closest('dialog[open]'),
      };
    });
    assert.ok(
      metrics.rect.x >= 0 &&
        metrics.rect.y >= 0 &&
        metrics.rect.right <= metrics.width &&
        metrics.rect.bottom <= metrics.height,
      JSON.stringify(metrics),
    );
    assert.equal(metrics.hitIsOrb, true);
    assert.equal(metrics.inModal, true);
    await screenshot(`wheel-modal-${viewport.width}x${viewport.height}`);
    await player.mouse.move(
      opened.ring.x + opened.ring.width / 2,
      opened.ring.y + opened.ring.height / 2,
    );
    await player.mouse.up();
    await opened.wheel.waitFor({ state: 'detached' });
    await shot(catalog.shots[0], 0);
    assert.equal(
      await dialog
        .getByRole('button', { name: '禁用互动特效', exact: true })
        .count(),
      1,
    );
    await closePanel(dialog);
    report.mobile ??= [];
    report.mobile.push({ viewport, metrics });
  }
  await player.setViewportSize({ width: 390, height: 844 });
  await checked(
    'Short portrait, landscape and browser-player viewport: complete wheel and central cancel stay visible/hittable in the real modal top layer; aim consumes clicks without toggling the underlying settings',
  );
}
async function verifyGameEntries() {
  for (const choice of choices) {
    await command({ type: 'select-game', gameId: choice.gameId });
    if (choice.variantId)
      await command({ type: 'select-variant', variantId: choice.variantId });
    await Promise.all([
      host.goto(origin + '/host/game'),
      publicPage.goto(origin + '/public/game'),
      player.goto(origin + '/player/game'),
    ]);
    await playerUi(player).locator('.interaction-orb').waitFor();
    const frame = await playerFrame(player);
    for (const surface of [host, publicPage, frame]) {
      const dialog = await video(surface);
      assert.equal(
        await dialog
          .getByRole('button', { name: '禁用互动特效', exact: true })
          .count(),
        1,
      );
      await closePanel(dialog);
      assert.equal(await surface.locator('.interaction-block').count(), 0);
    }
    assert.equal(await host.locator('.interaction-orb').count(), 0);
    assert.equal(await publicPage.locator('.interaction-orb').count(), 0);
    await select(0);
    await frame
      .locator('.interaction-aim')
      .getByRole('button', { name: '取消', exact: true })
      .click();
    await speak(catalog.phrases[1]);
    await screenshot(`game-${choice.gameId}-${choice.variantId ?? 'default'}`);
  }
  if (choices.length)
    await checked(
      'Selected /game routes expose shared video and player interaction controls on all roles; three-game/Pokémon-version coverage is restricted to shared controls and one saved speech',
    );
}
async function verifyPauseAndNewRoom() {
  if (!boxOnly) {
    const fixtureGame = selectedGame ?? 'modern-art';
    await command({ type: 'select-game', gameId: fixtureGame });
    const extraPlayers = [];
    for (let index = 0; index < 2; index++) {
      const joined = await post('/api/session/join', {
        name: `暂停夹具${index + 1}`,
        avatarId: `avatar-${20 + index}`,
      });
      extraPlayers.push({
        token: joined.token,
        socket: await connect(joined.token),
      });
    }
    await command({ type: 'ready', ready: true }, token, playerSocket);
    for (const extra of extraPlayers)
      await command({ type: 'ready', ready: true }, extra.token, extra.socket);
    await command({ type: 'start' });
    await command({ type: 'pause' });
    assert.equal((await view()).paused, true);
    await speak(catalog.phrases[3]);
    await speak(catalog.phrases[0]);
    assert.equal((await view()).paused, true);
    await checked(
      'Paused game accepts immediately replacing speech/audio without resuming or advancing game state',
    );
    await command({ type: 'end' });
  } else await speak(catalog.phrases[0]);
  const previous = await view();
  const eventCount = report.events.length;
  await command({ type: 'new-room' });
  const current = await view();
  assert.notEqual(current.instanceId, previous.instanceId);
  await until(async () => {
    const frame = await playerFrame(player);
    return (
      await Promise.all(
        [host, publicPage, frame].map((surface) =>
          surface.locator('.interaction-shot,.interaction-speech').count(),
        ),
      )
    ).every((count) => count === 0);
  }, 'new room discards old interaction on all roles');
  await player.reload();
  await playerUi(player).getByLabel('你的昵称', { exact: true }).waitFor();
  await wait(300);
  assert.equal(report.events.length, eventCount);
  assert.equal(
    await playerUi(player)
      .locator('.interaction-shot,.interaction-speech')
      .count(),
    0,
  );
  assert.equal((await view()).instanceId, current.instanceId);
  await checked(
    'New room clears active playback immediately; player reconnect does not replay an old event or transfer it into the new context',
  );
}
async function verifyPackagedAudio() {
  const files = [];
  async function scan(directory, prefix = '') {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + item.name;
      if (item.isDirectory())
        await scan(join(directory, item.name), path + '/');
      else if (/\.mp3$/i.test(path)) files.push('/' + path);
    }
  }
  await scan(packagedWeb);
  const entries = [...catalog.shots, ...catalog.phrases];
  const media = entries.map((entry) => {
    const urls = files.filter((url) => matchesAudio(origin + url, entry.audio));
    assert.equal(urls.length, 1, `Expected one packaged ${entry.audio}`);
    return { id: entry.id, audio: entry.audio, url: urls[0] };
  });
  const decoded = await host.evaluate(async (entries) => {
    const audio = new AudioContext();
    try {
      return await Promise.all(
        entries.map(async (entry) => {
          const response = await fetch(entry.url);
          if (!response.ok) throw new Error(entry.url);
          const buffer = await audio.decodeAudioData(
            await response.arrayBuffer(),
          );
          return {
            ...entry,
            duration: buffer.duration,
            channels: buffer.numberOfChannels,
            frames: buffer.length,
          };
        }),
      );
    } finally {
      await audio.close();
    }
  }, media);
  assert.equal(decoded.length, 11);
  assert.ok(decoded.every((item) => item.duration > 0 && item.frames > 0));
  report.media = decoded;
  await checked(
    'Exactly the eleven catalogued local interaction MP3 decode in real WebView2; unrelated game audio is excluded',
  );
}

async function captureShotStage(entry, stage, targetMs) {
  const frame = await playerFrame(player);
  const metrics = await frame.evaluate(
    async ({ id, targetMs }) => {
      const layer = document.querySelector(`[data-effect="${id}"]`);
      if (!layer) throw new Error('Missing shot layer: ' + id);
      const clock = layer
        .querySelector('.interaction-actor')
        .getAnimations()[0];
      if (!clock) throw new Error('Production animation clock is unavailable');
      const elapsed =
        parseFloat(layer.style.getPropertyValue('--elapsed')) || 0;
      const deadline = performance.now() + 3000;
      // pause() settles on the next rendering frame. Anticipate that single frame
      // without assigning currentTime or substituting the production animation.
      while (Number(clock.currentTime) + elapsed < targetMs - 16) {
        if (performance.now() > deadline)
          throw new Error('Shot frame did not advance');
        await new Promise(requestAnimationFrame);
      }
      const animations = layer.getAnimations({ subtree: true });
      for (const animation of animations) animation.pause();
      await Promise.all(animations.map((animation) => animation.ready));
      const actualMs = Number(clock.currentTime) + elapsed;
      function style(element) {
        if (!element) return null;
        const computed = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          opacity: Number(computed.opacity),
          display: computed.display,
          position: computed.position,
          pointerEvents: computed.pointerEvents,
          transform: computed.transform,
          backgroundImage: computed.backgroundImage,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          centerX: rect.x + rect.width / 2,
          centerY: rect.y + rect.height / 2,
        };
      }
      const images = Array.from(layer.querySelectorAll('img'));
      await Promise.all(images.map((image) => image.decode()));
      const unique = [
        ...new Map(images.map((image) => [image.src, image])).values(),
      ];
      const imageAlpha = unique.map((image) => {
        function sample(width, height) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, width, height);
          const pixels = context.getImageData(0, 0, width, height).data;
          let transparent = 0,
            opaque = 0,
            nearOpaque = 0,
            maxAlpha = 0;
          for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] === 0) transparent++;
            if (pixels[i] === 255) opaque++;
            if (pixels[i] >= 250) nearOpaque++;
            maxAlpha = Math.max(maxAlpha, pixels[i]);
          }
          return {
            transparent,
            opaque,
            nearOpaque,
            maxAlpha,
            total: width * height,
          };
        }
        return {
          src: image.src,
          width: image.naturalWidth,
          height: image.naturalHeight,
          ...sample(image.naturalWidth, image.naturalHeight),
          scaled64: sample(64, 64),
        };
      });
      return {
        actualMs,
        targetMs,
        viewport: { width: innerWidth, height: innerHeight },
        hit: {
          x: parseFloat(layer.style.getPropertyValue('--hit-x')),
          y: parseFloat(layer.style.getPropertyValue('--hit-y')),
        },
        layer: style(layer),
        imageAlpha,
        images: images.map((image) => ({
          complete: image.complete,
          src: image.src,
          ...style(image),
        })),
        firstObject: style(
          layer.querySelector('.interaction-projectile > img'),
        ),
        firstSplash: style(layer.querySelector('.interaction-splash')),
        bloom: style(layer.querySelector('.interaction-flower-bloom img')),
        petals: Array.from(layer.querySelectorAll('.interaction-petals i')).map(
          style,
        ),
        coffeeStream: style(layer.querySelector('.interaction-coffee-stream')),
      };
    },
    { id: entry.id, targetMs },
  );
  const name = `shot-${stage}`;
  report.shotVisuals ??= [];
  report.shotVisuals.push({
    effectId: entry.id,
    stage,
    screenshot: name + '.png',
    ...metrics,
  });
  await save();
  assert.ok(
    Math.abs(metrics.actualMs - targetMs) < 65,
    JSON.stringify({ stage, actualMs: metrics.actualMs, targetMs }),
  );
  assert.equal(metrics.layer.position, 'absolute');
  assert.equal(metrics.layer.pointerEvents, 'none');
  assert.ok(metrics.images.every((image) => image.complete));
  assert.ok(
    metrics.imageAlpha.every(
      (image) =>
        image.width > 0 &&
        image.height > 0 &&
        image.transparent > 0 &&
        (image.opaque > 0 || (image.maxAlpha === 254 && image.nearOpaque > 0)),
    ),
  );
  assert.ok(Math.abs(metrics.hit.x / metrics.viewport.width - 0.52) < 0.01);
  assert.ok(Math.abs(metrics.hit.y / metrics.viewport.height - 0.58) < 0.01);
  const visible =
    stage === 'flower-bloom'
      ? metrics.bloom
      : stage === 'poop-flight'
        ? metrics.firstObject
        : entry.id === 'cappuccino'
          ? metrics.coffeeStream
          : metrics.firstSplash;
  assert.ok(
    visible && visible.display !== 'none' && visible.opacity > 0.1,
    JSON.stringify({ stage, visible }),
  );
  assert.ok(
    visible.x >= 0 &&
      visible.y >= 0 &&
      visible.x + visible.width <= metrics.viewport.width &&
      visible.y + visible.height <= metrics.viewport.height,
    JSON.stringify({ stage, visible, viewport: metrics.viewport }),
  );
  if (stage === 'flower-bloom') {
    assert.ok(metrics.bloom.opacity > 0.7);
    assert.ok(metrics.petals.some((petal) => petal.opacity > 0.2));
  }
  if (stage === 'poop-flight') assert.ok(metrics.firstObject.opacity > 0.75);
  await screenshot(name);
  await frame.evaluate((id) => {
    for (const animation of document
      .querySelector(`[data-effect="${id}"]`)
      .getAnimations({ subtree: true }))
      animation.play();
  }, entry.id);
}

async function verifyShotVisuals() {
  const before = await view();
  for (const [index, entry] of catalog.shots.entries()) {
    if (effectFilter && effectFilter !== entry.id) continue;
    await select(index);
    const frame = await playerFrame(player);
    await frame.locator('.interaction-aim').waitFor();
    const eventIndex = report.events.length;
    const bounds = await player
      .locator('iframe[data-player-frame]')
      .boundingBox();
    const viewport = await frame.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
    }));
    await player.mouse.click(
      bounds.x + viewport.width * 0.52,
      bounds.y + viewport.height * 0.58,
    );
    await until(() => report.events[eventIndex], `${entry.id} shot saved`);
    const event = report.events[eventIndex].event;
    assert.equal(event.interaction.effectId, entry.id);
    assert.equal(event.durationMs, entry.durationMs);
    await frame.locator(`[data-effect="${entry.id}"]`).waitFor();
    const hit = entry.steps[0].hitMs;
    if (entry.id === 'poop') {
      await captureShotStage(entry, 'poop-flight', hit - 10);
      await captureShotStage(entry, 'poop-splash', hit + 100);
    } else
      await captureShotStage(
        entry,
        entry.id === 'flower' ? 'flower-bloom' : `${entry.id}-hit`,
        hit + (entry.id === 'flower' ? 350 : 100),
      );
    assert.equal((await view()).revision, before.revision);
    await checked(
      `${entry.id}: centered saved shot at real animation stage; decoded local transparent image, visible layer and hit geometry captured`,
    );
  }
  assert.equal(report.events.length, effectFilter ? 1 : 5);
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
  host = await desktop.firstWindow();
  await host.locator('[data-room-revision]').waitFor();
  origin = new URL(host.url()).origin;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  observe(host);
  await host.addInitScript(installAudioAudit);
  await host.reload();
  await host.locator('[data-room-revision]').waitFor();
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  hostSocket = await connect(hostToken);
  await command({ type: 'select-game', gameId: selectedGame ?? 'modern-art' });
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()
      .items[0].submenu.items.find((item) => item.label === '打开公共屏')
      .click(),
  );
  publicPage = await next;
  observe(publicPage);
  await publicPage.addInitScript(installAudioAudit);
  await publicPage.reload();
  await publicPage
    .getByRole('button', { name: '视频设置', exact: true })
    .waitFor();
  browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
    soundEnabled: false,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(installAudioAudit);
  player = await context.newPage();
  observe(player);
  await player.goto(origin);
  await playerUi(player)
    .getByLabel('你的昵称', { exact: true })
    .fill('互动验收');
  await playerUi(player)
    .getByRole('button', { name: '加入', exact: true })
    .click();
  await playerUi(player).locator('.interaction-orb').waitFor();
  token = await (
    await playerFrame(player)
  ).evaluate(() => localStorage.getItem('tablemax-player'));
  playerSocket = await connect(token);
  playerSocket.on('room:interaction', (event) =>
    report.events.push({ at: Date.now(), event }),
  );
  if (selectedGame) {
    await Promise.all([
      host.goto(origin + '/host/game'),
      publicPage.goto(origin + '/public/game'),
      player.goto(origin + '/player/game'),
    ]);
    await playerUi(player).locator('.interaction-orb').waitFor();
  }
  if (shotVisuals) {
    await verifyShotVisuals();
  } else {
    for (const surface of [host, publicPage, await playerFrame(player)])
      assert.equal(await surface.locator('.interaction-block').count(), 0);
    assert.equal(await host.locator('.interaction-orb').count(), 0);
    assert.equal(await publicPage.locator('.interaction-orb').count(), 0);
    await checked(
      'Only an admitted human player has an orb; all roles expose video settings and no separate floating block button',
    );
    await verifyPackagedAudio();
    await verifyDragAndCancel();
    await verifyPortalGestureRecovery();
    for (const [index, entry] of catalog.shots.entries()) {
      await shot(entry, index);
      await screenshot(`shot-${entry.id}`);
    }
    for (const entry of catalog.phrases) await speak(entry);
    const playerAudit = await audit(await playerFrame(player));
    const publicAudit = await audit(publicPage);
    for (const entry of [...catalog.shots, ...catalog.phrases]) {
      for (const [role, observed] of [
        ['player', playerAudit],
        ['public', publicAudit],
      ]) {
        assert.ok(
          observed.decodes.some((item) => matchesAudio(item.url, entry.audio)),
          `${role} decoded ${entry.audio}`,
        );
        assert.ok(
          observed.starts.some(
            (item) =>
              matchesAudio(item.url, entry.audio) && item.state === 'running',
          ),
          `${role} really started ${entry.audio}`,
        );
      }
    }
    assert.ok(
      playerAudit.stops.length > 0 && publicAudit.stops.length > 0,
      'Replacement stops old real sources',
    );
    report.initialAudio = {
      player: playerAudit,
      public: publicAudit,
      host: await audit(host),
    };
    await checked(
      'Five aimed effects and all six speech choices rapidly replace prior visuals/audio on three roles; all eleven decoded sources actually start in player and native audio-owner documents; old sources stop; room revision stays unchanged',
    );
    await verifyBlockControls();
    await verifyMobileAndModal();
    await verifyGameEntries();
    await verifyPauseAndNewRoom();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.external, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.stack;
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  for (const socket of sockets) socket.disconnect();
  const cleanup = await Promise.allSettled([
    browser?.close(),
    desktop?.close(),
  ]);
  report.cleanupErrors = cleanup
    .filter((result) => result.status === 'rejected')
    .map((result) => String(result.reason));
  if (report.cleanupErrors.length) {
    report.status = 'failed';
    process.exitCode = 1;
  }
  report.result = report.status === 'passed' ? 'passed' : 'failed';
  await save();
}
