import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const reentryOnly = process.argv.includes('--reentry-only');
const entrancesOnly = process.argv.includes('--entrances-only');
const timerOnly = process.argv.includes('--timer-only');
assert.ok(!timerOnly || (!reentryOnly && !entrancesOnly));
const run =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  (portable ? 'portable-final' : 'development');
assert.match(run, /^[a-z0-9-]{1,48}$/, 'Safe independent evidence directory');
const output = resolve(
  timerOnly
    ? 'artifacts/maintenance/v1.0.2/modern-art-polish-20261005/audio'
    : 'artifacts/maintenance/v1.0.2/modern-art-debug-20261004/audio',
  run,
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/modern-art-audio-verify-'));
const started = performance.now();
const evidence = {
  startedAt: new Date().toISOString(),
  portable,
  work,
  output,
  scope:
    'Actual hidden production WebView2, local service and SQLite; legal prepared open-auction save followed by authorized saved commands, real box links, reloads and phone gesture controls. Observations preserve native bridge and HTMLAudio results. Browser decoding and onplaying are not human listening, physical mobile autoplay policy or physical-speaker verification.',
  humanListeningVerified: false,
  physicalSpeakerVerified: false,
  playbackImplementation:
    'HTMLAudioElement.play; AudioContext.decodeAudioData checks device codec independently and never starts a synthetic buffer source',
  checks: [],
  actions: [],
  assets: [],
  documents: [],
  screenshots: [],
  pageErrors: [],
  audioRequestFailures: [],
  externalRequests: [],
};
let executablePath = desktopExecutable;
let phoneSoundEnabled = false;
let desktop, host, publicPage, phone, origin, hostToken, fixture, dataDir;
const pages = new Map();
const sockets = new Map();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const hash = (data) => createHash('sha256').update(data).digest('hex');
async function save() {
  evidence.elapsedSeconds = (performance.now() - started) / 1000;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
}
async function until(predicate, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await sleep(40);
  }
  throw new Error(label);
}
async function current(token = '') {
  const reply = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(reply.ok, true);
  return reply.view;
}
async function socketFor(token) {
  if (sockets.has(token)) return sockets.get(token);
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: { token },
  });
  sockets.set(token, socket);
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function command(token, value) {
  const view = await current(token);
  const socket = await socketFor(token);
  const reply = await new Promise((done, reject) => {
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: view.instanceId,
        revision: view.revision,
        branch: view.branch,
        command: value,
      },
      (error, result) => (error ? reject(error) : done(result)),
    );
  });
  assert.equal(reply.ok, true, JSON.stringify(reply));
  const after = await current(hostToken);
  assert.ok(
    after.revision > view.revision,
    'Command actually saved a new revision',
  );
  const database = new DatabaseSync(join(dataDir, 'room.sqlite'), {
    readOnly: true,
  });
  try {
    const saved = JSON.parse(
      database.prepare('SELECT data FROM saves WHERE id=1').get().data,
    );
    assert.equal(
      saved.revision,
      after.revision,
      'SQLite save precedes observable sound',
    );
    assert.equal(saved.branch, after.branch);
  } finally {
    database.close();
  }
  evidence.actions.push({
    revision: after.revision,
    branch: after.branch,
    command: value.type,
    publicVerb: value.type === 'game' ? after.gameView.latest?.verb : null,
  });
  return after;
}

// Preserve original results and authorization: only add counters around real calls/events.
function installAudit() {
  if (window.__maAudioAudit) return;
  const audit = (window.__maAudioAudit = {
    documentId: String(performance.timeOrigin),
    owner: null,
    nativeInstalled: false,
    nativeErrors: [],
    claims: [],
    connects: [],
    plays: [],
    playing: [],
    ended: [],
    pauses: [],
    errors: [],
    bufferStarts: 0,
  });
  const elements = new WeakMap();
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    const item = {
      id: audit.plays.length,
      src: this.src || this.currentSrc,
      volume: this.volume,
      muted: this.muted,
      at: performance.now(),
      fulfilled: false,
      rejected: null,
    };
    audit.plays.push(item);
    if (!elements.has(this)) {
      elements.set(this, { last: item });
      for (const type of ['playing', 'ended', 'pause', 'error'])
        this.addEventListener(type, () => {
          const last = elements.get(this).last;
          const entry = {
            playId: last.id,
            src: this.currentSrc || this.src,
            volume: this.volume,
            muted: this.muted,
            at: performance.now(),
          };
          if (type === 'error')
            audit.errors.push({ ...entry, code: this.error?.code ?? null });
          else
            audit[
              { playing: 'playing', ended: 'ended', pause: 'pauses' }[type]
            ].push(entry);
        });
    } else elements.get(this).last = item;
    const result = Reflect.apply(originalPlay, this, args);
    void result.then(
      () => {
        item.fulfilled = true;
      },
      (error) => {
        item.rejected = String(error);
      },
    );
    return result;
  };
  if (window.AudioBufferSourceNode) {
    const originalStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      audit.bufferStarts++;
      return Reflect.apply(originalStart, this, args);
    };
  }
  function native() {
    if (audit.nativeInstalled || !window.chrome?.webview) return;
    const webview = window.chrome.webview;
    const original = webview.postMessage;
    const pending = new Map();
    try {
      webview.postMessage = function (message) {
        if (
          message?.method === 'audio.claim' ||
          message?.method === 'audio.connect'
        ) {
          const entry = {
            id: message.id,
            at: performance.now(),
            result: null,
            error: null,
          };
          if (message.method === 'audio.claim') {
            entry.key = message.params[0];
            audit.claims.push(entry);
          } else audit.connects.push(entry);
          pending.set(message.id, { method: message.method, entry });
        }
        return Reflect.apply(original, this, [message]);
      };
      webview.addEventListener('message', ({ data }) => {
        if (data?.type === 'changed' && data.channel === 'audio')
          audit.owner = data.value;
        const item = pending.get(data?.id);
        if (!item) return;
        item.entry.result = data.result ?? null;
        item.entry.error = data.error ?? null;
        if (item.method === 'audio.connect' && typeof data.result === 'boolean')
          audit.owner = data.result;
        pending.delete(data.id);
      });
      audit.nativeInstalled = webview.postMessage !== original;
    } catch (error) {
      audit.nativeErrors.push(String(error));
    }
  }
  native();
  document.addEventListener('DOMContentLoaded', native, { once: true });
}
async function observe(page, role) {
  pages.set(role, page);
  page.on('pageerror', (error) =>
    evidence.pageErrors.push({ role, error: error.message }),
  );
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin)
      evidence.externalRequests.push({ role, url: request.url() });
  });
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).pathname.endsWith('.wav'))
      evidence.audioRequestFailures.push({
        role,
        url: request.url(),
        error: request.failure(),
      });
  });
  await page.addInitScript(installAudit);
}
async function audits() {
  const result = {};
  for (const [role, page] of pages)
    if (!page.isClosed())
      result[role] = await page.evaluate(() => window.__maAudioAudit);
  return result;
}
async function checkpoint(label) {
  const snapshot = await audits();
  evidence.documents.push({ label, snapshot });
  await save();
  return snapshot;
}
function fresh(snapshot, marks, kind) {
  return Object.entries(snapshot).flatMap(([role, audit]) => {
    const previous = marks[role];
    const start =
      previous?.documentId === audit.documentId ? previous[kind].length : 0;
    return audit[kind].slice(start).map((item) => ({ role, ...item }));
  });
}
function audible(snapshot, marks) {
  return fresh(snapshot, marks, 'plays').filter(
    (item) => item.volume > 0 && !item.muted,
  );
}
async function quiet(marks, label, milliseconds = 650) {
  await sleep(milliseconds);
  const snapshot = await checkpoint(label);
  assert.deepEqual(
    audible(snapshot, marks),
    [],
    `${label}: no audible old feedback`,
  );
  evidence.checks.push({ check: label, audiblePlays: 0 });
  return snapshot;
}
async function capture(page, label) {
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((window) => window.isVisible()), false);
  const encoded = await window.evaluate(async (window) =>
    (await window.webContents.capturePage()).toPNG().toString('base64'),
  );
  await writeFile(join(output, label + '.png'), Buffer.from(encoded, 'base64'));
  evidence.screenshots.push(label + '.png');
}
async function openPublic() {
  const next = desktop.waitForEvent('window');
  await desktop.request('open-public', { path: '/public' });
  publicPage = await next;
  await observe(publicPage, 'public');
  await publicPage.goto(origin + '/public/game');
  await publicPage.locator('[data-modern-art-sound]').waitFor();
  await until(
    async () => (await audits()).public?.owner === true,
    'Native managed public is preferred audio owner',
  );
  await until(
    async () => (await audits()).host?.owner === false,
    'Native host yields audio to public',
  );
}
async function openPhone(token) {
  const next = desktop.waitForEvent('window');
  await desktop.request('new-window', {
    url: origin + '/player',
    width: 390,
    height: 844,
    managed: false,
    partition: 'ma-audio-phone-' + randomUUID(),
  });
  phone = await next;
  await observe(phone, 'phone');
  await phone.evaluate(
    (token) => localStorage.setItem('tablemax-player', token),
    token,
  );
  await phone.goto(origin + '/player/game');
  await phone.locator('.ma-wallet').waitFor();
  assert.equal(await phone.locator('[data-local-sound="true"]').count(), 1);
  assert.equal(
    await phone.evaluate(() => Boolean(window.tablemaxAudio)),
    false,
  );
}
async function reenter(page, role) {
  const documentId = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole('link', { name: '‹ 盒子', exact: true }).click();
  await page.waitForURL(`**/${role}`);
  if (role !== 'player') {
    await sleep(120);
    const denied = await page.evaluate(async () => {
      try {
        await window.tablemaxAudio.connect();
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(denied, true, 'Box route cannot register desktop audio');
  }
  await page.getByRole('link', { name: '进入牌桌', exact: true }).click();
  await page.locator('[data-modern-art-sound]').waitFor();
  assert.equal(
    await page.evaluate(() => performance.timeOrigin),
    documentId,
    'Real box links retain the document',
  );
}
async function candidate(type) {
  for (const player of fixture.players) {
    const view = await current(player.token);
    const action = view.actions.find(
      (action) =>
        action.type === type &&
        (type !== 'bid' || action.amount > view.gameView.auction.currentBid),
    );
    if (action) return { player, view, action };
  }
  throw new Error('No authorized legal ' + type + ' action');
}
async function act(choice) {
  return command(choice.player.token, {
    type: 'game',
    decisionId: choice.view.decisionId,
    action: choice.action,
  });
}
async function savedSound(view, cue, owner, marks, label) {
  const key = `${view.instanceId}:${view.branch}:${view.revision}`;
  const url = evidence.assets.find((asset) => asset.cue === cue).url;
  await until(
    async () => {
      const snapshot = await audits();
      const plays = audible(snapshot, marks);
      return (
        plays.some(
          (play) =>
            play.role === owner &&
            play.src === url &&
            play.fulfilled &&
            snapshot[owner].playing.some(
              (event) =>
                event.playId === play.id &&
                event.src === url &&
                event.volume > 0,
            ),
        ) &&
        fresh(snapshot, marks, 'claims').some(
          (claim) => claim.key === key && claim.result === true,
        )
      );
    },
    `${label}: saved revision has a real accepted native claim and onplaying`,
    10000,
  );
  await sleep(450);
  const snapshot = await checkpoint(label);
  const plays = audible(snapshot, marks);
  const accepted = fresh(snapshot, marks, 'claims').filter(
    (claim) => claim.key === key && claim.result === true,
  );
  assert.equal(
    accepted.length,
    1,
    'One native output claim per saved revision',
  );
  assert.equal(accepted[0].role, owner);
  assert.equal(
    plays.length,
    phoneSoundEnabled ? 2 : 1,
    'One desktop owner and, when enabled, one independent phone decoder',
  );
  const desktopPlay = plays.find((play) => play.role === owner);
  assert.equal(desktopPlay.src, url);
  assert.equal(desktopPlay.volume, 0.45, 'Actual default HTMLAudio volume');
  assert.equal(desktopPlay.rejected, null);
  const phonePlays = plays.filter((play) => play.role === 'phone');
  assert.equal(phonePlays.length, phoneSoundEnabled ? 1 : 0);
  if (phoneSoundEnabled) {
    assert.equal(phonePlays[0].src, url);
    assert.equal(phonePlays[0].rejected, null);
    assert.equal(phonePlays[0].fulfilled, true);
  }
  evidence.checks.push({
    check: label,
    revision: view.revision,
    key,
    cue,
    owner,
    acceptedClaims: accepted.length,
    actualOnPlaying: true,
    defaultVolume: desktopPlay.volume,
    independentPhoneSound: phoneSoundEnabled,
  });
  return snapshot;
}
async function assetsAndDecode() {
  const manifest = JSON.parse(
    await readFile('assets/games/modern-art/manifest.json', 'utf8'),
  );
  assert.equal(manifest.audio.assets.length, 17);
  const assetRoot = join(dirname(executablePath), 'web/assets');
  const files = await readdir(assetRoot);
  for (const asset of manifest.audio.assets) {
    const original = await readFile(
      resolve('assets/games/modern-art/audio', asset.path),
    );
    assert.equal(
      hash(original),
      asset.sha256,
      'Source audio matches recorded generation',
    );
    const candidates = files.filter(
      (file) =>
        file.startsWith(basename(asset.path, '.wav') + '-') &&
        file.endsWith('.wav'),
    );
    const matches = [];
    for (const file of candidates)
      if (hash(await readFile(join(assetRoot, file))) === asset.sha256)
        matches.push(file);
    assert.equal(
      matches.length,
      1,
      `One exact production asset for ${asset.cue}`,
    );
    const url = origin + '/assets/' + encodeURIComponent(matches[0]);
    evidence.assets.push({
      cue: asset.cue,
      url,
      sourceSha256: asset.sha256,
      packedSha256: asset.sha256,
      bytes: asset.bytes,
      seconds: asset.measurements.seconds,
    });
  }
  const decoded = await host.evaluate(async (assets) => {
    const context = new AudioContext();
    const results = [];
    try {
      for (const asset of assets) {
        const response = await fetch(asset.url);
        if (!response.ok || new URL(response.url).origin !== location.origin)
          throw new Error('Local WAV response failed');
        const buffer = await response.arrayBuffer();
        const digest = [
          ...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)),
        ]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
        const audio = await context.decodeAudioData(buffer);
        results.push({
          cue: asset.cue,
          url: response.url,
          status: response.status,
          type: response.headers.get('content-type'),
          sha256: digest,
          channels: audio.numberOfChannels,
          sampleRate: audio.sampleRate,
          duration: audio.duration,
          decodedFrames: audio.length,
        });
      }
    } finally {
      await context.close();
    }
    return results;
  }, evidence.assets);
  for (const item of decoded) {
    const asset = evidence.assets.find((asset) => asset.cue === item.cue);
    assert.equal(item.sha256, asset.sourceSha256);
    assert.equal(item.channels, 1);
    assert.ok(Math.abs(item.duration - asset.seconds) < 0.001);
  }
  evidence.checks.push({
    check:
      'All seventeen final production WAVs decoded by actual WebView2 codec with same-origin HTTP and exact source hash',
    decoded,
  });
  await save();
}

async function nextLegalChoice(wanted = []) {
  for (const player of fixture.players) {
    const view = await current(player.token);
    if (!view.decisionId || !view.actions.length) continue;
    const offers = view.actions.filter((action) => action.type === 'offer');
    const face = (action) =>
      view.gameView.self.hand.find((card) => card.id === action.cardId);
    const action =
      offers.find((action) => wanted.includes(face(action).auctionKind)) ??
      [...offers].sort((a, b) => {
        const count = (action) =>
          view.gameView.artists.find(
            (artist) => artist.id === face(action).artistId,
          ).playedCount;
        return count(a) - count(b);
      })[0] ??
      view.actions.find(
        (action) => action.type === 'pass' || action.type === 'decline-double',
      ) ??
      view.actions.find(
        (action) => 'amount' in action && action.amount === 0,
      ) ??
      view.actions[0];
    return {
      player,
      view,
      action,
      kind: action.type === 'offer' ? face(action).auctionKind : null,
    };
  }
  return null;
}
async function advanceToOffer() {
  for (let step = 0; step < 80; step++) {
    const view = await current(hostToken);
    if (view.gameView.phase === 'offer') return nextLegalChoice();
    if (view.gameView.phase === 'round-result') {
      await command(hostToken, {
        type: 'lifecycle',
        action: view.lifecycleActions[0],
      });
    } else {
      const choice = await nextLegalChoice();
      assert.ok(choice, 'A real next offer is reachable before game end');
      await act(choice);
    }
  }
  throw new Error('Could not reach the next real offer');
}
async function verifyEntrances() {
  const wanted = new Set(['open', 'once', 'sealed', 'fixed', 'double']);
  for (let step = 0; step < 350 && wanted.size; step++) {
    const before = await current(hostToken);
    if (before.gameView.phase === 'round-result') {
      await command(hostToken, {
        type: 'lifecycle',
        action: before.lifecycleActions[0],
      });
      continue;
    }
    const choice = await nextLegalChoice([...wanted]);
    assert.ok(choice, 'Natural legal path still offers an action');
    if (choice.kind && wanted.has(choice.kind)) await sleep(1400);
    const marks = await audits();
    const after = await act(choice);
    if (
      !choice.kind ||
      !wanted.has(choice.kind) ||
      after.gameView.latest?.verb !== 'offer' ||
      !['auction', 'double'].includes(after.gameView.phase)
    )
      continue;
    const entrance = host.locator(`[data-auction-entrance="${choice.kind}"]`);
    await entrance.waitFor({ state: 'attached', timeout: 1800 });
    const shape = await entrance.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const css = getComputedStyle(element);
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        position: css.position,
        pointerEvents: css.pointerEvents,
        animation: css.animationName,
        kind: element.dataset.auctionEntrance,
      };
    });
    assert.equal(shape.position, 'fixed');
    assert.equal(
      shape.pointerEvents,
      'none',
      'Entrance never blocks a saved-state action',
    );
    assert.equal(shape.x, 0);
    assert.equal(shape.y, 0);
    assert.equal(shape.width, shape.viewportWidth);
    assert.equal(shape.height, shape.viewportHeight);
    await capture(host, `entrance-${choice.kind}`);
    const cue =
      choice.kind === 'double' ? 'double-open' : `auction-${choice.kind}`;
    await savedSound(
      after,
      cue,
      'public',
      marks,
      `Saved ${choice.kind} offer selects its own actual entrance WAV`,
    );
    await entrance.waitFor({ state: 'detached', timeout: 2500 });
    evidence.checks.push({
      check: 'Actual saved full-screen entrance',
      revision: after.revision,
      kind: choice.kind,
      bounds: shape,
      screenshot: `entrance-${choice.kind}.png`,
    });
    wanted.delete(choice.kind);
  }
  assert.equal(
    wanted.size,
    0,
    'All five methods naturally offered and rendered',
  );
  await sleep(1400);
  const marks = await audits();
  await host.reload();
  await host.locator('[data-modern-art-sound]').waitFor();
  assert.equal(
    await host.locator('[data-auction-entrance]').count(),
    0,
    'Refresh never replays a saved entrance',
  );
  await quiet(marks, 'Entrance refresh does not replay its saved sound');

  await host.emulateMedia({ reducedMotion: 'reduce' });
  const reducedChoice = await advanceToOffer();
  await act(reducedChoice);
  const reduced = host.locator('[data-auction-entrance]');
  await reduced.waitFor({ state: 'attached' });
  const reducedStyle = await reduced.evaluate((element) => ({
    animation: getComputedStyle(element).animationName,
    rays: getComputedStyle(element.querySelector('.ma-entrance__rays')).display,
    seal: getComputedStyle(element.querySelector('.ma-entrance__seal')).display,
  }));
  assert.deepEqual(reducedStyle, {
    animation: 'none',
    rays: 'none',
    seal: 'none',
  });
  await reduced.waitFor({ state: 'detached', timeout: 1800 });
  evidence.checks.push({
    check: 'Reduced motion displays a short static auction banner',
    actualStyle: reducedStyle,
  });
  await host.emulateMedia({ reducedMotion: 'no-preference' });

  const testChoice = await advanceToOffer();
  await sleep(1400);
  await command(hostToken, { type: 'set-play-mode', mode: 'test' });
  const testMarks = await audits();
  // Refresh the decision after the mode-setting saved revision.
  const testView = await current(testChoice.player.token);
  await act({ ...testChoice, view: testView });
  await quiet(testMarks, 'Saved test-mode offer omits entrance sound');
  assert.equal(await host.locator('[data-auction-entrance]').count(), 0);
  await command(hostToken, { type: 'set-play-mode', mode: 'play' });
  assert.equal(
    await host.locator('[data-auction-entrance]').count(),
    0,
    'Returning to play never replays the test entrance',
  );
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  assert.deepEqual(evidence.audioRequestFailures, []);
  evidence.result = 'passed';
  await save();
  console.log(
    JSON.stringify({
      result: evidence.result,
      output,
      entrances: 5,
      checks: evidence.checks.length,
      seconds: evidence.elapsedSeconds,
    }),
  );
}

async function verifyTimerReminder() {
  await phone.locator('[data-modern-art-sound]').click();
  await until(
    async () =>
      (await phone
        .locator('[data-modern-art-sound]')
        .getAttribute('aria-label')) === '提示音已开启，点击静音',
    'Phone gesture unlocks timer cue decoder',
  );
  phoneSoundEnabled = true;
  await command(hostToken, { type: 'set-countdown', seconds: 5 });
  await until(
    async () =>
      (await publicPage
        .locator('.ma-decision-progress')
        .getAttribute('data-clock-id')) ===
      (await current(hostToken)).decisionClock.id,
    'Public receives the saved new timer',
  );
  const before = await current(hostToken);
  const key = `${before.instanceId}:${before.branch}:modern-art-time-elapsed:${before.decisionClock.id}`;
  const marks = await audits();
  await publicPage
    .locator('.ma-decision-progress[data-elapsed="true"]')
    .waitFor({ timeout: 10000 });
  const timerAsset = evidence.assets.find(
    (asset) => asset.cue === 'time-elapsed',
  );
  await until(
    async () =>
      audible(await audits(), marks).some(
        (play) => play.role === 'public' && play.src === timerAsset.url,
      ),
    'Saved timer crossing actually plays its local cue',
  );
  await sleep(550);
  const after = await current(hostToken);
  assert.equal(
    after.revision,
    before.revision,
    'Expiry is not a new saved action',
  );
  assert.equal(after.branch, before.branch);
  assert.deepEqual(
    after.gameView,
    before.gameView,
    'Expiry never forces auction progression or a penalty',
  );
  const snapshot = await checkpoint(
    'Saved clock reaches zero without a game action',
  );
  const timerPlays = audible(snapshot, marks).filter(
    (play) => play.src === timerAsset.url,
  );
  assert.equal(timerPlays.filter((play) => play.role === 'public').length, 1);
  assert.equal(timerPlays.filter((play) => play.role === 'host').length, 0);
  const phonePending =
    (await current(fixture.players[0].token)).decisionClock !== null;
  assert.equal(
    timerPlays.filter((play) => play.role === 'phone').length,
    phonePending ? 1 : 0,
  );
  assert.equal(
    fresh(snapshot, marks, 'claims').filter(
      (claim) => claim.key === key && claim.result === true,
    ).length,
    1,
  );
  assert.ok(
    fresh(snapshot, marks, 'playing').some(
      (play) => play.src === timerAsset.url && play.role === 'public',
    ),
  );
  assert.equal(
    await publicPage.locator('.ma-decision-progress').innerText(),
    '',
    'The timer has no visible remaining seconds',
  );
  evidence.checks.push({
    check:
      'Time expiry gives exactly one native-owned local cue and an independent pending phone cue, with no penalty or saved action',
    key,
    phonePending,
  });
  let quietMarks = await audits();
  await quiet(quietMarks, 'Repeated zero samples cannot replay time cue', 800);
  await publicPage.reload();
  await publicPage.locator('[data-modern-art-sound]').waitFor();
  await until(
    async () => (await audits()).public?.owner === true,
    'Public reacquires sound after zero-time refresh',
  );
  quietMarks = await audits();
  await quiet(
    quietMarks,
    'Zero-time reload and ownership restore never replay reminder',
  );
  await command(hostToken, { type: 'set-countdown', seconds: 8 });
  await sleep(450);
  await command(hostToken, { type: 'pause' });
  const frozen = await publicPage
    .locator('.ma-decision-progress')
    .getAttribute('data-remaining-seconds');
  quietMarks = await audits();
  await quiet(quietMarks, 'Paused positive clock has no expiry cue', 1150);
  assert.equal(
    await publicPage
      .locator('.ma-decision-progress')
      .getAttribute('data-remaining-seconds'),
    frozen,
    'Pause freezes the progress sample',
  );
  await command(hostToken, { type: 'resume' });
  await publicPage.locator('[data-modern-art-sound]').click();
  await phone.locator('[data-modern-art-sound]').click();
  phoneSoundEnabled = false;
  await command(hostToken, { type: 'set-countdown', seconds: 5 });
  quietMarks = await audits();
  await publicPage
    .locator('.ma-decision-progress[data-elapsed="true"]')
    .waitFor({ timeout: 10000 });
  await quiet(quietMarks, 'Muted timer crosses zero silently and is consumed');
  await publicPage.locator('[data-modern-art-sound]').click();
  quietMarks = await audits();
  await quiet(quietMarks, 'Unmute does not replay consumed expiry');
  const savedMarks = await audits();
  await savedSound(
    await act(await candidate('bid')),
    'bid',
    'public',
    savedMarks,
    'Legal bidding remains available after time has elapsed',
  );
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  assert.deepEqual(evidence.audioRequestFailures, []);
  evidence.result = 'passed';
  await capture(publicPage, 'timer-legal-after-expiry-public');
  await save();
  console.log(
    JSON.stringify({
      result: evidence.result,
      checks: evidence.checks.length,
      output,
      archiveSha256: evidence.archiveSha256,
      seconds: evidence.elapsedSeconds,
    }),
  );
}

try {
  if (portable) {
    const { version } = JSON.parse(await readFile('package.json', 'utf8'));
    const archive = resolve(
      `artifacts/releases/TableMax-${version}-win-x64.zip`,
    );
    evidence.archiveSha256 = hash(await readFile(archive));
    const extracted = join(work, 'extracted');
    await promisify(execFile)(
      join(
        process.env.SystemRoot,
        'System32/WindowsPowerShell/v1.0/powershell.exe',
      ),
      [
        '-NoProfile',
        '-Command',
        'Expand-Archive -LiteralPath $env:TABLEMAX_AUDIO_ARCHIVE -DestinationPath $env:TABLEMAX_AUDIO_EXTRACT',
      ],
      {
        env: {
          ...process.env,
          TABLEMAX_AUDIO_ARCHIVE: archive,
          TABLEMAX_AUDIO_EXTRACT: extracted,
        },
        windowsHide: true,
      },
    );
    executablePath = join(extracted, 'TableMax.exe');
  }
  evidence.executablePath = executablePath;
  evidence.executableSha256 = hash(await readFile(executablePath));
  await build({
    entryPoints: ['scripts/fixtures/prepare-modern-art-polish.ts'],
    outfile: join(work, 'prepare.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  fixture = await require(join(work, 'prepare.cjs')).prepare(work, 5);
  const entry = fixture.cases.find(
    (entry) => entry.id === (entrancesOnly ? 'offer' : 'auction-open'),
  );
  assert.ok(entry);
  dataDir = entry.dataDir;
  evidence.fixture = {
    count: fixture.count,
    steps: fixture.steps,
    sourceDir: fixture.sourceDir,
    dataDir,
    case: entry.id,
  };
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_PORT: '0',
    TABLEMAX_HOST: '127.0.0.1',
    PATH: [
      join(process.env.SystemRoot, 'System32'),
      process.env.SystemRoot,
      join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0'),
    ].join(';'),
  };
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  delete env.TABLEMAX_WEB_DEV_URL;
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-play-mode'],
    env,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  await observe(host, 'host');
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  await host.goto(origin + '/host/game');
  await host.locator('[data-modern-art-sound]').waitFor();
  await until(
    async () => (await audits()).host?.owner === true,
    'Native host initial fallback ownership',
  );
  await openPhone(fixture.players[0].token);
  assert.equal((await current(hostToken)).playMode, 'play');
  const restoration = await audits();
  assert.ok(
    Object.values(restoration).every((audit) => audit.plays.length === 0),
    'Restored saved fixture is not replayed on first mount',
  );
  await quiet(restoration, 'Initial restored paused fixture produces no audio');
  await command(hostToken, { type: 'resume' });
  await openPublic();
  await assetsAndDecode();
  const windows = await desktop.request('windows');
  assert.ok(windows.every((window) => !window.visible && window.rendered));
  assert.equal(
    windows.find((window) => window.role === 'public').managed,
    true,
  );
  evidence.runtime = await desktop.request('runtime');
  evidence.hiddenWindows = windows;
  if (timerOnly) {
    await verifyTimerReminder();
  } else if (entrancesOnly) {
    await verifyEntrances();
  } else {
    let marks = await checkpoint(
      'Ready managed public + host + phone awaiting its own gesture',
    );
    for (const role of ['host', 'public']) {
      assert.equal(marks[role].nativeInstalled, true);
      assert.deepEqual(marks[role].nativeErrors, []);
    }
    await quiet(
      restoration,
      'Resume and preferred public opening do not replay saved fixture',
    );
    marks = await audits();
    await savedSound(
      await act(await candidate('bid')),
      'bid',
      'public',
      marks,
      'Public alone plays a real saved open bid',
    );
    await capture(publicPage, 'public-saved-bid');
    await capture(phone, 'phone-saved-bid-silent');

    assert.equal(
      await phone.locator('[data-modern-art-sound]').getAttribute('aria-label'),
      '点击启用手机提示音',
    );
    await phone.locator('[data-modern-art-sound]').click();
    await until(
      async () =>
        (await phone
          .locator('[data-modern-art-sound]')
          .getAttribute('aria-label')) === '提示音已开启，点击静音',
      'Phone gesture silently unlocks local decoder',
    );
    phoneSoundEnabled = true;
    marks = await audits();
    await savedSound(
      await act(await candidate('bid')),
      'bid',
      'public',
      marks,
      'Phone gesture permits one future cue alongside the single desktop owner',
    );
    marks = await audits();
    await reenter(phone, 'player');
    await quiet(marks, 'Phone box return does not replay history');
    marks = await audits();
    await savedSound(
      await act(await candidate('bid')),
      'bid',
      'public',
      marks,
      'Phone reused decoder plays a future bid after box return',
    );

    marks = await audits();
    await phone.reload();
    await phone.locator('[data-modern-art-sound]').waitFor();
    phoneSoundEnabled = false;
    await quiet(
      marks,
      'Phone reload keeps preference without replaying history',
    );
    assert.equal(
      await phone.locator('[data-modern-art-sound]').getAttribute('aria-label'),
      '点击启用手机提示音',
      'Reload asks for the browser gesture again',
    );
    marks = await audits();
    await savedSound(
      await act(await candidate('bid')),
      'bid',
      'public',
      marks,
      'Phone consumes saved events silently while gesture is pending',
    );
    await phone.locator('[data-modern-art-sound]').click();
    phoneSoundEnabled = true;
    marks = await audits();
    await savedSound(
      await act(await candidate('bid')),
      'bid',
      'public',
      marks,
      'Phone refresh unlock permits future events without old backlog',
    );
    await phone.locator('[data-modern-art-sound]').click();
    phoneSoundEnabled = false;
    await reenter(phone, 'player');
    assert.equal(
      await phone.locator('[data-modern-art-sound]').getAttribute('aria-label'),
      '提示音已静音，点击开启',
      'Phone mute survives box return',
    );
    assert.equal(
      await publicPage
        .locator('[data-modern-art-sound]')
        .getAttribute('aria-pressed'),
      'true',
      'Phone mute does not alter desktop preference',
    );
    await phone.reload();
    await phone.locator('[data-modern-art-sound]').waitFor();
    assert.equal(
      await phone
        .locator('[data-modern-art-sound]')
        .getAttribute('aria-pressed'),
      'false',
      'Phone mute persists through a new document',
    );
    evidence.checks.push({
      check:
        'Phone native-independent local output, first gesture, box return, refresh gesture and independent persistent mute',
      actualDevice:
        'Hidden WebView2 phone simulation; physical Android/iOS browsers remain outside this check',
    });

    marks = await audits();
    await reenter(publicPage, 'public');
    await until(
      async () => (await audits()).public.owner === true,
      'Public reacquires native ownership after box return',
    );
    await quiet(marks, 'Public box return does not replay old feedback');
    marks = await audits();
    await savedSound(
      await act(await candidate('bid')),
      'bid',
      'public',
      marks,
      'New bid plays after public box return',
    );
    await reenter(host, 'host');
    assert.equal(
      (await audits()).host.owner,
      false,
      'Host box return preserves preferred public output',
    );
    if (reentryOnly) {
      evidence.result = 'passed';
      await save();
      console.log(
        JSON.stringify({
          result: evidence.result,
          output,
          checks: evidence.checks.length,
          seconds: evidence.elapsedSeconds,
        }),
      );
      process.exitCode = 0;
    } else {
      await publicPage.locator('[data-modern-art-sound]').click();
      await until(
        async () =>
          (await host
            .locator('[data-modern-art-sound]')
            .getAttribute('aria-pressed')) === 'false',
        'Mute preference propagates to host',
      );
      marks = await audits();
      await act(await candidate('bid'));
      await quiet(marks, 'A legal saved bid while muted is silent');
      marks = await audits();
      await publicPage.locator('[data-modern-art-sound]').click();
      await sleep(200);
      const unlock = await audits();
      assert.ok(
        unlock.public.plays.some((play) => play.volume === 0 && play.fulfilled),
        'Actual gesture unlock preserves silence',
      );
      await quiet(marks, 'Unmute does not replay the muted saved bid');
      marks = await audits();
      await savedSound(
        await act(await candidate('bid')),
        'bid',
        'public',
        marks,
        'Fresh saved bid after unmute plays once',
      );
      marks = await audits();
      await command(hostToken, { type: 'pause' });
      await quiet(
        marks,
        'Pause clears playback without repeating previous bid',
      );
      marks = await audits();
      await command(hostToken, { type: 'resume' });
      await quiet(marks, 'Resume does not replay the pre-pause saved bid');
      marks = await audits();
      await publicPage.reload();
      await publicPage.locator('[data-modern-art-sound]').waitFor();
      await until(
        async () => (await audits()).public.owner === true,
        'Public reacquires native membership after reload',
      );
      await quiet(
        marks,
        'Public reload and transient fallback do not replay old feedback',
      );
      marks = await audits();
      await host.reload();
      await host.locator('[data-modern-art-sound]').waitFor();
      await quiet(marks, 'Host reload while public owns output remains silent');
      marks = await audits();
      await checkpoint('Public document before close');
      await publicPage.close();
      pages.delete('public');
      await until(
        async () => (await audits()).host.owner === true,
        'Closing preferred public restores host ownership',
      );
      await quiet(marks, 'Public close handoff does not replay old feedback');
      marks = await audits();
      await savedSound(
        await act(await candidate('bid')),
        'bid',
        'host',
        marks,
        'Host fallback alone plays a newly saved bid',
      );
      marks = await audits();
      await openPublic();
      await quiet(
        marks,
        'Reopened preferred public does not duplicate previous host cue',
      );
      let sold = false;
      for (let index = 0; index < 8; index++) {
        marks = await audits();
        const view = await act(await candidate('pass'));
        const cue = view.gameView.latest?.verb === 'sale' ? 'sale' : 'pass';
        await savedSound(
          view,
          cue,
          'public',
          marks,
          cue === 'sale'
            ? 'Saved sale gives one gavel cue on preferred public'
            : 'Saved pass stays on preferred public',
        );
        if (cue === 'sale') {
          sold = true;
          break;
        }
      }
      assert.equal(
        sold,
        true,
        'Legal fixture actions actually completed a sale',
      );
      await capture(publicPage, 'public-saved-sale');
      marks = await audits();
      await command(hostToken, { type: 'set-play-mode', mode: 'test' });
      await quiet(marks, 'Entering test mode never repeats the sale');
      const afterSale = await current(hostToken);
      let testChoice;
      for (const player of fixture.players) {
        const view = await current(player.token);
        const action = view.actions.find((action) => action.type === 'offer');
        if (action) {
          testChoice = { player, view, action };
          break;
        }
      }
      assert.ok(testChoice, 'A real legal test-mode action remains available');
      marks = await audits();
      await act(testChoice);
      await quiet(
        marks,
        'Saved test-mode painting remains silent after audio was unlocked',
      );
      marks = await audits();
      await command(hostToken, { type: 'set-play-mode', mode: 'play' });
      await quiet(
        marks,
        'Returning to normal play does not replay the test action',
      );
      evidence.checks.push({
        check: 'Production sale followed by legal saved test action',
        saleRevision: afterSale.revision,
      });
      const final = await checkpoint('Final actual audio documents');
      for (const [role, audit] of evidence.documents.flatMap((document) =>
        Object.entries(document.snapshot),
      )) {
        assert.deepEqual(
          audit.errors,
          [],
          `${role}: no HTMLAudio decoder errors`,
        );
        assert.equal(
          audit.bufferStarts,
          0,
          'Decode probes did not synthesize playback',
        );
        assert.equal(
          audit.plays.filter((play) => play.rejected && play.volume > 0).length,
          0,
          'Actual cues are not autoplay rejected',
        );
      }
      assert.equal(
        final.phone.claims.length,
        0,
        'Phone never claims native desktop events',
      );
      assert.deepEqual(evidence.pageErrors, []);
      assert.deepEqual(evidence.externalRequests, []);
      assert.deepEqual(evidence.audioRequestFailures, []);
      evidence.result = 'passed';
      await save();
      console.log(
        JSON.stringify({
          result: evidence.result,
          output,
          archiveSha256: evidence.archiveSha256,
          wavs: evidence.assets.length,
          checks: evidence.checks.length,
          seconds: evidence.elapsedSeconds,
          work,
        }),
      );
    }
  }
} catch (error) {
  evidence.result = 'failed';
  evidence.error = String(error.stack ?? error);
  for (const [role, page] of pages)
    if (!page.isClosed())
      await capture(page, 'failure-' + role).catch(() => {});
  await checkpoint('Failure actual audio documents').catch(() => {});
  await save();
  console.error(evidence.error);
  process.exitCode = 1;
} finally {
  for (const socket of sockets.values()) socket.disconnect();
  if (desktop) await desktop.close();
  await save();
}
