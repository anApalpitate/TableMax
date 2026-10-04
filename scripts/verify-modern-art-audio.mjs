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
const run =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  (portable ? 'portable-final' : 'development');
assert.match(run, /^[a-z0-9-]{1,48}$/, 'Safe independent evidence directory');
const output = resolve(
  'artifacts/maintenance/v1.0.1/modern-art-polish-20261004/audio',
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
    'Actual hidden production WebView2, local service and SQLite; legal prepared open-auction save followed by authorized saved commands. Observations preserve native bridge and HTMLAudio results. Browser decoding and onplaying are not human listening or physical-speaker verification.',
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
  assert.equal(await phone.locator('[data-modern-art-sound]').count(), 0);
  assert.equal(
    await phone.evaluate(() => Boolean(window.tablemaxAudio)),
    false,
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
    1,
    'A saved action plays one cue on one authorized window',
  );
  assert.equal(plays[0].role, owner);
  assert.equal(plays[0].src, url);
  assert.equal(plays[0].volume, 0.45, 'Actual default HTMLAudio volume');
  assert.equal(plays[0].rejected, null);
  assert.equal(
    snapshot.phone.plays.length,
    0,
    'Player phone never creates audio playback',
  );
  evidence.checks.push({
    check: label,
    revision: view.revision,
    key,
    cue,
    owner,
    acceptedClaims: accepted.length,
    actualOnPlaying: true,
    defaultVolume: plays[0].volume,
  });
  return snapshot;
}
async function assetsAndDecode() {
  const manifest = JSON.parse(
    await readFile('assets/games/modern-art/manifest.json', 'utf8'),
  );
  assert.equal(manifest.audio.assets.length, 16);
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
      'All sixteen final production WAVs decoded by actual WebView2 codec with same-origin HTTP and exact source hash',
    decoded,
  });
  await save();
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
  const entry = fixture.cases.find((entry) => entry.id === 'auction-open');
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
  let marks = await checkpoint(
    'Ready managed public + host + independent silent phone',
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
  await quiet(marks, 'Pause clears playback without repeating previous bid');
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
  assert.equal(sold, true, 'Legal fixture actions actually completed a sale');
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
    assert.deepEqual(audit.errors, [], `${role}: no HTMLAudio decoder errors`);
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
  assert.equal(final.phone.plays.length, 0);
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
