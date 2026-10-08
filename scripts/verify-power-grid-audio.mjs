import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readCurrentSave } from './lib/save-audit.mjs';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const projectVersion = JSON.parse(
  await readFile('package.json', 'utf8'),
).version;
const maintenance =
  process.argv.find((arg) => arg.startsWith('--maintenance='))?.slice(14) ??
  'power-grid-debug-20261004';
assert.match(maintenance, /^[a-z0-9-]{1,64}$/);
const prepareOnly = process.argv.includes('--prepare-only');
const run =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  (portable ? 'portable-final' : 'development');
assert.match(run, /^[a-z0-9-]{1,48}$/, 'Safe independent evidence directory');
const output = resolve(
  'artifacts/maintenance/v' + projectVersion,
  maintenance,
  'native-audio',
  run,
);
await mkdir(output, { recursive: true });
const work = await mkdtemp(join(output, 'work-'));
const started = performance.now();
const evidence = {
  startedAt: new Date().toISOString(),
  portable,
  maintenance,
  work,
  output,
  scope:
    'Actual hidden production WebView2, local service and SQLite; legal prepared two-human Power Grid checkpoints followed by authorized Socket saved commands, native owner handoff, real box links, refresh and saved FX frames. Observations preserve native bridge and HTMLAudio results. Browser decoding and onplaying are not human listening, physical mobile autoplay policy or physical-speaker verification.',
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
    const saved = readCurrentSave(database);
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
    action: value.type === 'game' ? value.action : null,
  });
  return after;
}

// Preserve original results and authorization: only add counters around real calls/events.
function installAudit() {
  if (window.__pgAudioAudit) return;
  const audit = (window.__pgAudioAudit = {
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
      readyState: this.readyState,
      duration: Number.isFinite(this.duration) ? this.duration : null,
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
        item.readyState = this.readyState;
        item.duration = Number.isFinite(this.duration) ? this.duration : null;
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
    if (/\.(wav|flac)$/.test(new URL(request.url()).pathname))
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
      result[role] = await page.evaluate(() => window.__pgAudioAudit);
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

// This helper only produces isolated legal saved checkpoints. It never creates
// feedback, calls an audio function or changes any production rule/state field.
const fixtureSource = String.raw`
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { RoomCoordinator } from './packages/platform-core/src/room';
import { RandomSource } from './packages/platform-core/src/random';
import { validateSave } from './packages/platform-core/src/save-validation';
import { SqliteSaveRepository } from './apps/server/src/save-repository';
import { rules, bot } from './games/power-grid';

class MemoryRepository {
  saved = null;
  load() { return this.saved; }
  save(value) { this.saved = structuredClone(value); }
  close() {}
}
function cue(events) {
  const verbs = events.map(event => event.action?.verb);
  if (events.some(event => event.kind === 'game-ended') || verbs.includes('end')) return 'end';
  if (verbs.some(verb => ['purchase-plant', 'discard-plant'].includes(verb))) return 'plant';
  if (verbs.includes('build')) return 'build';
  if (verbs.some(verb => ['buy-resource', 'transfer', 'swap-resources', 'salvage', 'discard-salvage'].includes(verb))) return 'fuel';
  if (verbs.some(verb => ['run', 'supply', 'round', 'step'].includes(verb))) return 'run';
  if (verbs.some(verb => ['offer', 'bid'].includes(verb))) return 'bid';
  return null;
}
export async function prepare(work) {
  const repository = new MemoryRepository();
  const preparedRules = {
    ...rules,
    initialize: context => rules.initialize({ ...context, random: new RandomSource(21) }),
  };
  const room = new RoomCoordinator(preparedRules, bot, repository);
  const random = new RandomSource(52);
  let feedback = null;
  room.subscribe(value => { feedback = value ?? null; });
  const players = [];
  const cases = new Map();
  const execute = async (token, command) => {
    const view = room.view(token);
    feedback = null;
    const result = await room.command(token, {
      actionId: randomUUID(), instanceId: view.instanceId,
      branch: view.branch, revision: view.revision, command,
    });
    assert.equal(result.ok, true, JSON.stringify(result));
  };
  for (let index = 0; index < 2; index++) {
    const joined = await room.join('声画公司 ' + (index + 1));
    players.push({ ...joined, id: room.view(joined.token).self.seatId });
    await execute(joined.token, { type: 'ready', ready: true });
  }
  await execute(room.hostToken, { type: 'start' });
  let steps = 0;
  while (steps < 2400 && cases.size < 6) {
    if (room.view(room.hostToken).paused) await execute(room.hostToken, { type: 'resume' });
    const state = repository.saved.snapshot.state;
    const decision = rules.decisions(state)[0];
    assert.ok(decision, 'Legally prepared match has a decision before ending');
    const player = players.find(player => player.id === decision.seatId);
    const own = room.view(player.token);
    let action = !cases.has('bid') && own.actions.find(action => action.type === 'bid');
    if (!action && own.gameView.phase === 'building') {
      const costs = new Map(own.gameView.buildOptions.map(option => [option.cityId, option.cost]));
      action = own.actions.filter(action => action.type === 'build')
        .sort((a, b) => costs.get(a.cityId) - costs.get(b.cityId))[0];
    }
    if (!action) {
      const result = await bot.decide({
        view: own.gameView, actions: own.actions, decision,
        memory: null, difficulty: 'juewu', random,
        signal: new AbortController().signal,
      });
      action = result.action;
    }
    const before = structuredClone(repository.saved);
    await execute(player.token, { type: 'game', decisionId: own.decisionId, action });
    steps++;
    // Some legitimate setup decisions do not emit public animation feedback.
    const selected = feedback ? cue(feedback.events) : null;
    // Bid must be an actual bid rather than just offering the initial plant.
    if (selected && !cases.has(selected) &&
      (selected !== 'bid' || action.type === 'bid') &&
      (selected !== 'run' || action.type === 'run')) {
      validateSave(before, rules, bot);
      rules.validateState(before.snapshot.state, players.map(player => player.id));
      assert.ok(before.seats.every(seat => seat.controller === 'human'));
      const dataDir = join(work, 'checkpoint-' + selected);
      await mkdir(dataDir, { recursive: true });
      const savedRepository = new SqliteSaveRepository(dataDir);
      try { savedRepository.save(before); } finally { savedRepository.close(); }
      cases.set(selected, {
        cue: selected, dataDir, seatId: player.id, action,
        phase: rules.project(before.snapshot.state, { role: 'public' }).phase,
        steps, revision: before.revision, branch: before.branch,
        snapshotSha256: createHash('sha256').update(JSON.stringify(before.snapshot.state)).digest('hex'),
        actualVerbs: feedback.events.map(event => event.action?.verb).filter(Boolean),
        actualKinds: feedback.events.map(event => event.kind),
      });
    }
  }
  assert.equal(cases.size, 6, 'All six checkpoints come from a legally progressed match');
  return { players, cases: [...cases.values()], steps, rulesVersion: rules.manifest.rulesVersion };
}
`;

async function prepareFixtures() {
  await writeFile(join(output, 'prepare-fixtures.ts'), fixtureSource);
  await build({
    stdin: { contents: fixtureSource, resolveDir: resolve('.'), loader: 'ts' },
    outfile: join(work, 'prepare.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  fixture = await require(join(work, 'prepare.cjs')).prepare(work);
  evidence.fixture = {
    count: fixture.players.length,
    steps: fixture.steps,
    rulesVersion: fixture.rulesVersion,
    cases: fixture.cases,
    helperSha256: hash(fixtureSource),
    preparationOnly: true,
  };
  await save();
}

async function capture(page, label, cue) {
  const rendered = await page.evaluate(() => {
    const effect = document.querySelector('[data-power-grid-effect]');
    if (!effect) return null;
    const rect = effect.getBoundingClientRect();
    return {
      cue: effect.dataset.powerGridEffect,
      pointerEvents: getComputedStyle(effect).pointerEvents,
      ariaHidden: effect.getAttribute('aria-hidden'),
      viewport: { width: innerWidth, height: innerHeight },
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      label: effect.textContent,
    };
  });
  if (cue) {
    assert.equal(rendered?.cue, cue, 'Capture is a live saved event FX frame');
    assert.equal(rendered.pointerEvents, 'none');
    assert.equal(rendered.ariaHidden, 'true');
  }
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((window) => window.isVisible()), false);
  const encoded = await window.evaluate(async (window) =>
    (await window.webContents.capturePage()).toPNG().toString('base64'),
  );
  await writeFile(join(output, label + '.png'), Buffer.from(encoded, 'base64'));
  evidence.screenshots.push({ file: label + '.png', effect: rendered });
}

async function openPublic() {
  const next = desktop.waitForEvent('window');
  await desktop.request('open-public', { path: '/public' });
  publicPage = await next;
  await observe(publicPage, 'public');
  await publicPage.goto(origin + '/public/game');
  await publicPage.locator('[data-power-grid-sound]').waitFor();
  await until(
    async () => (await audits()).public?.owner === true,
    'Managed public becomes the native sound owner',
  );
  await until(
    async () => (await audits()).host?.owner === false,
    'Managed host yields native sound to public',
  );
}

async function openPhones() {
  for (const width of [320, 390]) {
    const next = desktop.waitForEvent('window');
    await desktop.request('new-window', {
      url: origin + '/player',
      width,
      height: 844,
      managed: false,
      partition: 'pg-audio-phone-' + randomUUID(),
    });
    phone = await next;
    await observe(phone, 'phone-' + width);
    await phone.evaluate(
      (token) => localStorage.setItem('tablemax-player', token),
      fixture.players[0].token,
    );
    await phone.goto(origin + '/player/game');
    await phone.locator('.pg-phone-table, .pg-results').waitFor();
    assert.equal(
      await phone.evaluate(() => Boolean(window.tablemaxAudio)),
      false,
    );
  }
}

async function reenter(page, role) {
  const documentId = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole('link', { name: '‹ 盒子', exact: true }).click();
  await page.waitForURL(`**/${role}`);
  await sleep(120);
  const denied = await page.evaluate(async () => {
    try {
      await window.tablemaxAudio.connect();
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(denied, true, 'Box cannot register native audio output');
  await page.getByRole('link', { name: '进入牌桌', exact: true }).click();
  await page.locator('[data-power-grid-sound]').waitFor();
  assert.equal(await page.evaluate(() => performance.timeOrigin), documentId);
}

async function actFixture(entry) {
  const player = fixture.players.find((player) => player.id === entry.seatId);
  const view = await current(player.token);
  assert.ok(
    view.actions.some(
      (action) => JSON.stringify(action) === JSON.stringify(entry.action),
    ),
    'Prepared action is still legal in the delivered rules and current identity',
  );
  return command(player.token, {
    type: 'game',
    decisionId: view.decisionId,
    action: entry.action,
  });
}

async function nextBid() {
  for (const player of fixture.players) {
    const view = await current(player.token);
    const action = view.actions.find((action) => action.type === 'bid');
    if (action)
      return command(player.token, {
        type: 'game',
        decisionId: view.decisionId,
        action,
      });
  }
  throw new Error('Checkpoint must still permit a fresh authorized bid');
}

async function savedSound(view, cue, owner, marks, label) {
  const key = `power-grid:${view.instanceId}:${view.branch}:${view.revision}`;
  const url = evidence.assets.find((asset) => asset.cue === cue).url;
  await until(
    async () => {
      const snapshot = await audits();
      return (
        audible(snapshot, marks).some(
          (play) =>
            play.role === owner &&
            play.src === url &&
            play.fulfilled &&
            snapshot[owner].playing.some(
              (event) => event.playId === play.id && event.volume > 0,
            ),
        ) &&
        fresh(snapshot, marks, 'claims').some(
          (claim) => claim.key === key && claim.result === true,
        )
      );
    },
    `${label}: real native claim, original play resolution and playing event`,
    10000,
  );
  const snapshot = await checkpoint(label);
  const plays = audible(snapshot, marks);
  const accepted = fresh(snapshot, marks, 'claims').filter(
    (claim) => claim.key === key && claim.result === true,
  );
  assert.equal(
    accepted.length,
    1,
    'Exactly one desktop accepts the saved native claim',
  );
  assert.equal(accepted[0].role, owner);
  assert.equal(
    plays.length,
    1,
    'Exactly one audible real media call across all documents',
  );
  assert.equal(plays[0].role, owner);
  assert.equal(plays[0].src, url);
  assert.equal(plays[0].volume, ['plant', 'end'].includes(cue) ? 0.42 : 0.26);
  assert.equal(plays[0].rejected, null);
  assert.equal(plays[0].fulfilled, true);
  assert.ok(plays[0].readyState >= 2 && plays[0].duration > 0);
  evidence.checks.push({
    check: label,
    cue,
    key,
    revision: view.revision,
    owner,
    acceptedClaims: 1,
    audiblePlays: 1,
    originalPlayResolved: true,
    actualPlaying: true,
  });
  return snapshot;
}

async function assetsAndDecode() {
  const manifest = JSON.parse(
    await readFile('assets/games/power-grid/manifest.json', 'utf8'),
  );
  const assets = manifest.audio.files;
  assert.deepEqual(assets.map((asset) => asset.cue).sort(), [
    'bid',
    'build',
    'end',
    'fuel',
    'plant',
    'run',
  ]);
  const legacyAssetRoot = join(dirname(executablePath), 'web/assets');
  const moduleAssetRoot = join(
    dirname(executablePath),
    'web/games/power-grid/web/assets',
  );
  let assetRoot = moduleAssetRoot;
  const files = await readdir(moduleAssetRoot).catch(() => {
    assetRoot = legacyAssetRoot;
    return readdir(legacyAssetRoot);
  });
  const assetUrlPrefix =
    assetRoot === legacyAssetRoot
      ? '/assets/'
      : '/games/power-grid/web/assets/';
  for (const asset of assets) {
    const original = await readFile(
      resolve('assets/games/power-grid/audio', asset.file),
    );
    assert.equal(hash(original), asset.sha256);
    const lossless = await readFile(
      resolve(
        'assets/games/power-grid/audio',
        asset.file.replace(/\.wav$/, '.flac'),
      ),
    ).catch(() => null);
    const expectedHash = (file) =>
      file.endsWith('.flac') && lossless ? hash(lossless) : asset.sha256;
    const matches = [];
    for (const file of files.filter(
      (file) =>
        file.startsWith(basename(asset.file, '.wav') + '-') &&
        /\.(wav|flac)$/.test(file),
    ))
      if (hash(await readFile(join(assetRoot, file))) === expectedHash(file))
        matches.push(file);
    assert.equal(
      matches.length,
      1,
      'Exactly one packed v2 cue with source hash: ' + asset.cue,
    );
    evidence.assets.push({
      cue: asset.cue,
      url: origin + assetUrlPrefix + encodeURIComponent(matches[0]),
      sha256: expectedHash(matches[0]),
      bytes:
        matches[0].endsWith('.flac') && lossless
          ? lossless.length
          : asset.bytes,
      seconds: asset.durationSeconds,
      peak: asset.peak,
    });
  }
  const decoded = await host.evaluate(async (assets) => {
    const context = new AudioContext();
    const result = [];
    try {
      for (const asset of assets) {
        const response = await fetch(asset.url);
        if (!response.ok || new URL(response.url).origin !== location.origin)
          throw new Error('Local WAV fetch failed');
        const bytes = await response.arrayBuffer();
        const digest = [
          ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        ]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
        const audio = await context.decodeAudioData(bytes);
        let peak = 0;
        for (const sample of audio.getChannelData(0))
          peak = Math.max(peak, Math.abs(sample));
        result.push({
          cue: asset.cue,
          url: response.url,
          sha256: digest,
          channels: audio.numberOfChannels,
          sampleRate: audio.sampleRate,
          frames: audio.length,
          duration: audio.duration,
          peak,
        });
      }
    } finally {
      await context.close();
    }
    return result;
  }, evidence.assets);
  for (const item of decoded) {
    const asset = evidence.assets.find((asset) => asset.cue === item.cue);
    assert.equal(item.sha256, asset.sha256);
    assert.equal(item.channels, 1);
    assert.ok(Math.abs(item.duration - asset.seconds) < 0.001);
    assert.ok(item.peak > 0 && item.peak < 0.65);
  }
  evidence.checks.push({
    check:
      'Six actual packaged v2 WAVs decode in real WebView2, exact local HTTP bytes',
    decoded,
  });
}

async function extractPortable() {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
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

async function openCase(entry, phones = false) {
  dataDir = entry.dataDir;
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
  await host.locator('[data-power-grid-sound]').waitFor();
  await until(
    async () => (await audits()).host?.owner === true,
    'Host initially owns the real native output',
  );
  if (phones) await openPhones();
  const initial = await audits();
  assert.ok(Object.values(initial).every((audit) => audit.plays.length === 0));
  await quiet(
    initial,
    entry.cue + ': first restored checkpoint remains silent',
  );
  await command(hostToken, { type: 'resume' });
  await openPublic();
  const windows = await desktop.request('windows');
  assert.ok(windows.every((window) => !window.visible && window.rendered));
  evidence.runtimes ??= [];
  const runtime = await desktop.request('runtime');
  assert.equal(runtime.packaged, portable);
  evidence.runtimes.push({ cue: entry.cue, runtime, windows });
  evidence.assets = [];
  await assetsAndDecode();
  await quiet(
    initial,
    entry.cue + ': resume and native ownership transfer never replay history',
  );
}

async function closeCase() {
  for (const socket of sockets.values()) socket.disconnect();
  sockets.clear();
  if (desktop) await desktop.close();
  desktop = null;
  pages.clear();
}

async function captureSavedFX(cue) {
  // Capture all active roles concurrently inside the actual animation lifetime.
  await Promise.all(
    [...pages].map(async ([role, page]) => {
      await page.locator(`[data-power-grid-effect="${cue}"]`).waitFor();
      await capture(page, 'saved-' + cue + '-' + role, cue);
    }),
  );
  evidence.checks.push({
    check:
      'Saved ' +
      cue +
      ' actual pointer-transparent FX in desktop and phone windows',
    roles: [...pages.keys()],
    simulatedPhonesOnly: true,
  });
}

async function verifyBidLifecycle() {
  let marks = await audits();
  const saved = await nextBid();
  await Promise.all([
    savedSound(
      saved,
      'bid',
      'public',
      marks,
      'Public alone plays a newly saved actual bid',
    ),
    captureSavedFX('bid'),
  ]);
  // Opening another authenticated socket is a real ordinary server view sync.
  marks = await audits();
  const sync = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: { token: fixture.players[0].token },
  });
  try {
    await new Promise((done, reject) => {
      sync.once('room:view', done);
      sync.once('connect_error', reject);
    });
  } finally {
    sync.disconnect();
  }
  await quiet(
    marks,
    'Ordinary authorized server view sync does not replay a saved bid',
  );
  marks = await audits();
  await command(hostToken, { type: 'pause' });
  await quiet(marks, 'Pause immediately clears audio and saved FX');
  assert.equal(await publicPage.locator('[data-power-grid-effect]').count(), 0);
  marks = await audits();
  await command(hostToken, { type: 'resume' });
  await quiet(marks, 'Resume consumes pre-pause history without replay');
  marks = await audits();
  await publicPage.reload();
  await publicPage.locator('[data-power-grid-sound]').waitFor();
  await until(
    async () => (await audits()).public?.owner === true,
    'Public rejoins the real sound coordinator after reload',
  );
  await quiet(
    marks,
    'Public refresh and transient host fallback do not replay saved audio',
  );
  marks = await audits();
  await reenter(publicPage, 'public');
  await until(
    async () => (await audits()).public?.owner === true,
    'Public reclaims output after real box return',
  );
  await quiet(
    marks,
    'Real box return preserves sound membership without a history replay',
  );
  marks = await audits();
  await publicPage.locator('[data-power-grid-sound]').click();
  await until(
    async () =>
      (await host
        .locator('[data-power-grid-sound]')
        .getAttribute('aria-pressed')) === 'false',
    'Native host shares the saved desktop mute preference',
  );
  const mutedSaved = await nextBid();
  await captureSavedFX('bid');
  await quiet(marks, 'Muted actual saved bid has FX and no sound');
  marks = await audits();
  await publicPage.locator('[data-power-grid-sound]').click();
  await quiet(
    marks,
    'Real zero-volume gesture unmute does not replay muted feedback',
  );
  assert.ok(
    (await audits()).public.plays.some(
      (play) => play.volume === 0 && play.fulfilled,
    ),
  );
  evidence.checks.push({
    check:
      'Mute only affects audio; a real saved bid still produces its visual FX',
    revision: mutedSaved.revision,
  });
  marks = await audits();
  await command(hostToken, { type: 'set-play-mode', mode: 'test' });
  await nextBid();
  await quiet(marks, 'Saved test-mode bid produces neither sound nor FX');
  assert.equal(await publicPage.locator('[data-power-grid-effect]').count(), 0);
  marks = await audits();
  await command(hostToken, { type: 'set-play-mode', mode: 'play' });
  await quiet(marks, 'Returning to ordinary play never replays the test bid');
  marks = await audits();
  await checkpoint('Public before actual native close');
  await publicPage.close();
  pages.delete('public');
  await until(
    async () => (await audits()).host?.owner === true,
    'Real public close hands output back to host',
  );
  await quiet(marks, 'Native owner handoff never replays earlier cues');
  marks = await audits();
  await savedSound(
    await nextBid(),
    'bid',
    'host',
    marks,
    'Host fallback plays exactly one newly saved bid',
  );
}

try {
  await prepareFixtures();
  if (prepareOnly) {
    evidence.result = 'prepared';
    evidence.nativeRunExecuted = false;
  } else {
    if (portable) await extractPortable();
    evidence.executablePath = executablePath;
    evidence.executableSha256 = hash(await readFile(executablePath));
    for (const cue of ['bid', 'plant', 'fuel', 'build', 'run', 'end']) {
      const entry = fixture.cases.find((entry) => entry.cue === cue);
      await openCase(entry, ['bid', 'run', 'end'].includes(cue));
      if (cue === 'bid') await verifyBidLifecycle();
      else {
        const marks = await audits();
        const saved = await actFixture(entry);
        const checks = [
          savedSound(
            saved,
            cue,
            'public',
            marks,
            cue + ': real legal saved action has one native output',
          ),
        ];
        if (['run', 'end'].includes(cue)) checks.push(captureSavedFX(cue));
        await Promise.all(checks);
        if (cue === 'end') {
          assert.equal(saved.status, 'ended');
          assert.equal(saved.gameView.phase, 'ended');
          evidence.checks.push({
            check:
              'New durably saved terminal result is audible despite ended status',
            revision: saved.revision,
          });
        }
      }
      const latest = await audits();
      for (const audit of Object.values(latest)) {
        assert.equal(audit.bufferStarts, 0);
        assert.deepEqual(audit.errors, []);
        assert.deepEqual(audit.nativeErrors, []);
      }
      await closeCase();
    }
    assert.deepEqual(evidence.pageErrors, []);
    assert.deepEqual(evidence.externalRequests, []);
    assert.deepEqual(evidence.audioRequestFailures, []);
    evidence.result = 'passed';
    evidence.nativeRunExecuted = true;
  }
  await save();
  console.log(
    JSON.stringify({
      result: evidence.result,
      output,
      archiveSha256: evidence.archiveSha256,
      checks: evidence.checks.length,
      cases: fixture.cases.length,
      elapsedSeconds: evidence.elapsedSeconds,
    }),
  );
} catch (error) {
  evidence.result = 'failed';
  evidence.error = String(error.stack ?? error);
  for (const [role, page] of pages)
    if (!page.isClosed())
      await capture(page, 'failure-' + role).catch(() => {});
  await checkpoint('Failure real audio audit').catch(() => {});
  await save();
  console.error(evidence.error);
  process.exitCode = 1;
} finally {
  await closeCase();
  await save();
}
