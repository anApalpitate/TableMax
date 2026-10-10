import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import {
  launchDesktop,
  desktopExecutable,
} from '../../support/desktop-test.mjs';
import {
  ScreenshotPolicy,
  registerArtifacts,
  writeScreenshot,
} from '../../../maintenance/verification-artifacts.mjs';
import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from '../../../release/package-limits.mjs';

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const option = (name, fallback) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback;
assert.ok(
  process.argv
    .slice(2)
    .every((a) =>
      /^--(executable|zip|evidence|seats|variant|only)=.+$/.test(a),
    ),
  'Unknown Avalon verifier argument',
);
const executablePath = resolve(option('executable', desktopExecutable));
const zipPath = option('zip') ? resolve(option('zip')) : null;
const seats = Number(option('seats', '6'));
const variant = option('variant', 'court');
const only = option('only', 'all');
const evidenceName = option('evidence', `native-${seats}-${Date.now()}`);
assert.ok([5, 6].includes(seats));
assert.ok(['classic', 'court'].includes(variant));
assert.ok(
  [
    'all',
    'layout',
    'success',
    'failure',
    'rejections',
    'assassination',
    'long-quest',
  ].includes(only),
);
assert.match(evidenceName, /^[a-z0-9-]{1,65}$/);
const output = resolve('artifacts/avalon/validation', evidenceName);
const screenshotPolicy = new ScreenshotPolicy();
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
await mkdir('tmp', { recursive: true });
const workDir = await mkdtemp(resolve('tmp/game-review-'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const started = performance.now();
const evidence = {
  result: 'running',
  portable: !!zipPath,
  zipPath,
  zipSha256: zipPath ? hash(await readFile(zipPath)) : null,
  executablePath,
  executableSha256: hash(await readFile(executablePath)),
  seats,
  variant,
  only,
  workDir,
  startedAt: new Date().toISOString(),
  scope:
    'Actual hidden WinForms/WebView2 and shipped Socket/SQLite service, only Avalon. Phone viewports and DPI are simulated. Native output remains physically muted; decoder signal checks do not certify human listening or physical phones/LAN.',
  checks: [],
  screenshots: [],
  screenshotAliases: [],
  layouts: [],
  effects: [],
  pageErrors: [],
  externalRequests: [],
  failures: [],
};
let desktop, origin, host, publicPage, phone, hostToken;
let sockets = [];
const players = [];
const surface = (page) =>
  page.frames().find((f) => f.parentFrame() === page.mainFrame()) ?? page;
async function until(predicate, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await wait(40);
  }
  throw new Error(label);
}
async function auditPackage(stage) {
  if (!zipPath) return;
  const manifest = JSON.parse(
    await readFile(zipPath.replace(/\.zip$/i, '-manifest.json'), 'utf8'),
  );
  assert.equal(hash(await readFile(zipPath)), manifest.archive.sha256);
  assert.equal(manifest.archive.sha256, evidence.zipSha256);
  assert.equal((await stat(zipPath)).size, manifest.archive.bytes);
  let bytes = 0;
  for (const file of manifest.files) {
    const path = resolve(dirname(executablePath), file.path);
    assert.ok(
      path.startsWith(dirname(executablePath) + '\\') ||
        path.startsWith(dirname(executablePath) + '/'),
    );
    const content = await readFile(path);
    assert.equal(content.length, file.bytes);
    assert.equal(hash(content), file.sha256, `${stage}: ${file.path}`);
    bytes += content.length;
  }
  assert.equal(bytes, manifest.extractedBytes);
  assert.ok(
    bytes <= PACKAGE_BUDGET_BYTES &&
      manifest.archive.bytes <= PACKAGE_BUDGET_BYTES,
  );
  assert.ok(
    bytes < MAXIMUM_PACKAGE_BYTES &&
      manifest.archive.bytes < MAXIMUM_PACKAGE_BYTES,
  );
  evidence.packageAudits ??= [];
  evidence.packageAudits.push({
    stage,
    files: manifest.files.length,
    extractedBytes: bytes,
    archiveBytes: manifest.archive.bytes,
    allFileHashesMatched: true,
  });
  evidence.snapshot = manifest.snapshot;
}
async function observe(page) {
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => evidence.pageErrors.push(e.message));
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.origin !== origin)
      evidence.externalRequests.push(r.url());
  });
  await page.addInitScript(() => {
    window.__avalonPlays = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      const item = {
        src: this.src,
        muted: this.muted,
        volume: this.volume,
        resolved: false,
      };
      window.__avalonPlays.push(item);
      const result = original.apply(this, args);
      result?.then(
        () => {
          item.resolved = true;
        },
        (error) => {
          item.error = error.name;
        },
      );
      return result;
    };
  });
}
async function view(token = '') {
  const response = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(response.ok, true);
  return response.view;
}
async function connect(token = '') {
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: token ? { token } : {},
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function send(socket, token, command) {
  const before = await view(token);
  const reply = await new Promise((done, reject) =>
    socket.timeout(10000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: before.instanceId,
        revision: before.revision,
        branch: before.branch,
        command,
      },
      (e, r) => (e ? reject(e) : done(r)),
    ),
  );
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return reply;
}
async function act(index, action) {
  const player = players[index],
    own = await view(player.token);
  await send(player.socket, player.token, {
    type: 'game',
    decisionId: own.decisionId,
    action,
  });
}
async function clickAction(index, action) {
  await phoneFor(index);
  const before = (await view()).revision;
  const page = surface(phone);
  if (action.type === 'acknowledge') {
    await page.locator('[data-av-action="identity"]').click();
    await page.locator('[data-av-secret="true"]').waitFor();
    await capture(phone, 'private-role-card');
    await page.locator('[data-av-action="acknowledge"]').click();
  } else if (action.type === 'propose-team' || action.type === 'assassinate') {
    for (const seat of action.type === 'propose-team'
      ? action.team
      : [action.target])
      await page.locator(`[data-av-seat="${seat}"]`).click();
    await page
      .locator(
        `[data-av-action="${action.type === 'propose-team' ? 'propose' : 'assassinate'}"]`,
      )
      .click();
  } else {
    await page
      .locator(
        `[data-av-action="${action.type === 'vote-team' ? 'vote-' + action.vote : 'quest-' + action.card}"]`,
      )
      .click();
  }
  await until(
    async () => (await view()).revision > before,
    'Real browser click commits saved action',
  );
  evidence.checks.push({
    check: `actual player UI ${action.type}`,
    result: 'passed',
  });
}
async function resize(page, width, height, mobile) {
  const native = await desktop.browserWindow(page);
  await native.evaluate(
    (win, size) => win.setContentSize(size.width, size.height),
    { width, height },
  );
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: mobile ? width : 0,
    height: mobile ? height : 0,
    deviceScaleFactor: 1,
    mobile,
  });
  await session.send('Emulation.setTouchEmulationEnabled', {
    enabled: mobile,
    maxTouchPoints: 5,
  });
  if (mobile)
    await session.send('Emulation.setUserAgentOverride', {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    });
  await session.detach();
  await wait(120);
}
async function capture(page, label, layout = false) {
  const filename = screenshotPolicy.path(
    `${String(evidence.screenshots.length + 1).padStart(3, '0')}-${label}.png`,
    { label, layout },
  );
  if (!filename) return;
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  const native = await desktop.browserWindow(page);
  assert.equal(await native.evaluate((win) => win.isVisible()), false);
  const image = await native.evaluate(async (win) =>
    (await win.webContents.capturePage()).toPNG(),
  );
  const retained = await writeScreenshot(
    output,
    filename,
    image,
    evidence.screenshotAliases,
  );
  evidence.screenshots.push(retained);
}
async function layout(page, label, mobile) {
  await surface(page).locator('.avalon-screen').waitFor();
  const sample = await surface(page).evaluate(() => {
    const root = document.querySelector('.avalon-screen');
    const bounds = root.getBoundingClientRect();
    const visible = (node) => {
      const r = node.getBoundingClientRect(),
        css = getComputedStyle(node);
      return (
        r.width > 0 &&
        r.height > 0 &&
        css.visibility !== 'hidden' &&
        css.display !== 'none'
      );
    };
    const buttons = [...root.querySelectorAll('button')]
      .filter(visible)
      .map((b) => {
        const r = b.getBoundingClientRect();
        return {
          name: b.getAttribute('aria-label') || b.textContent.trim(),
          width: r.width,
          height: r.height,
          size: Number.parseFloat(getComputedStyle(b).fontSize),
        };
      });
    const words = [
      ...root.querySelectorAll('p,span,strong,small,label,h1,h2,h3,button'),
    ]
      .filter((n) => n.textContent.trim() && !n.children.length && visible(n))
      .map((n) => ({
        text: n.textContent.trim().slice(0, 65),
        size: Number.parseFloat(getComputedStyle(n).fontSize),
      }));
    return {
      width: innerWidth,
      height: innerHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      overflowElements: [...root.querySelectorAll('*')]
        .map((node) => {
          const box = node.getBoundingClientRect();
          const css = getComputedStyle(node);
          return {
            tag: node.tagName,
            class: node.className,
            text: node.textContent?.trim().slice(0, 65),
            left: box.left,
            right: box.right,
            width: box.width,
            minWidth: css.minWidth,
            whiteSpace: css.whiteSpace,
          };
        })
        .filter(
          (box) =>
            box.width > 0 &&
            (box.left < -1 ||
              box.right > document.documentElement.clientWidth + 1),
        )
        .slice(0, 30),
      root: { width: bounds.width, height: bounds.height },
      buttons,
      words,
    };
  });
  sample.label = label;
  evidence.layouts.push(sample);
  assert.equal(sample.overflow, false, `${label}: no horizontal overflow`);
  assert.ok(
    sample.words.every((w) => w.size >= 15.9),
    `${label}: information >=16px`,
  );
  if (mobile)
    assert.ok(
      sample.buttons
        .filter((b) => !/规则|身份|关闭|记录/.test(b.name))
        .every((b) => b.height >= 43.9),
      `${label}: touch controls >=44px`,
    );
  await capture(page, label, true);
}
async function phoneFor(index) {
  await phone.evaluate((token) => {
    localStorage.setItem('tablemax-player', token);
    localStorage.setItem('tablemax-sound-muted', 'true');
  }, players[index].token);
  await phone.goto(origin + '/player/game');
  await until(
    () => Promise.resolve(surface(phone) !== phone),
    'Player iframe attaches',
  );
  await surface(phone).locator('.avalon-screen').waitFor();
}
async function privacy() {
  for (const token of ['', hostToken]) {
    const v = await view(token);
    assert.equal(v.gameView.self, null);
    assert.deepEqual(v.actions, []);
    if (v.status !== 'ended') assert.equal(v.gameView.revealedRoles, null);
    for (const key of ['roles', 'knowledge', 'votes', 'questCards'])
      assert.ok(!(key in v.gameView), `Public excludes ${key}`);
  }
}
async function audioDecode() {
  const files = (
    await readdir(
      resolve(dirname(executablePath), 'web/games/avalon/web/assets'),
    )
  ).filter((name) => /\.(wav|flac|ogg|mp3)$/.test(name));
  assert.ok(files.length >= 8, 'Thematic local sound cues exist');
  evidence.audio = await publicPage.evaluate(async (names) => {
    const context = new AudioContext();
    const records = [];
    try {
      for (const name of names) {
        const url = '/games/avalon/web/assets/' + name;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Missing offline audio ' + name);
        const decoded = await context.decodeAudioData(
          await response.arrayBuffer(),
        );
        const samples = decoded.getChannelData(0);
        let peak = 0,
          squares = 0;
        for (const value of samples) {
          peak = Math.max(peak, Math.abs(value));
          squares += value * value;
        }
        records.push({
          name,
          duration: decoded.duration,
          channels: decoded.numberOfChannels,
          sampleRate: decoded.sampleRate,
          peak,
          rms: Math.sqrt(squares / samples.length),
        });
      }
    } finally {
      await context.close();
    }
    return records;
  }, files);
  assert.ok(
    evidence.audio.every(
      (record) =>
        record.duration > 0.15 &&
        record.duration < 8 &&
        record.peak > 0.01 &&
        record.peak < 0.995 &&
        record.rms > 0.002,
    ),
    'Actual offline audio decodes without silence or clipping',
  );
}
async function effect(label, trigger, reduced = false) {
  await until(
    async () =>
      (await publicPage.locator('[data-avalon-effect]').count()) === 0,
    'Previous presentation finishes before auditing another saved event',
    5000,
  );
  await publicPage.emulateMedia({
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const counts = await Promise.all(
    [host, publicPage].map((page) =>
      page.evaluate(() => window.__avalonPlays?.length ?? 0),
    ),
  );
  const before = (await view()).revision;
  await trigger();
  await until(
    async () => (await view()).revision > before,
    'Saved revision advances',
  );
  const saved = (await view()).gameView;
  const expected =
    saved.latest.verb === 'assassination'
      ? 'assassination'
      : saved.winner
        ? `${saved.winner}-win`
        : {
            'team-approved': 'approved',
            'team-rejected': 'rejected',
            'quest-success': 'quest-success',
            'quest-fail': 'quest-fail',
          }[saved.latest.verb];
  assert.ok(expected, `${label}: trigger resolves an expected public result`);
  await publicPage.locator(`[data-avalon-effect="${expected}"]`).waitFor();
  await wait(reduced ? 70 : 200);
  const result = await publicPage.evaluate(() => ({
    overlays: [...document.querySelectorAll('[data-avalon-effect]')].map(
      (n) => ({
        cue: n.getAttribute('data-avalon-effect'),
        text: n.textContent,
        pointerEvents: getComputedStyle(n).pointerEvents,
        reduced: n.getAttribute('data-reduced'),
      }),
    ),
    animations: document.getAnimations().map((a) => ({
      name: a.animationName,
      duration: a.effect?.getComputedTiming().duration,
    })),
  }));
  assert.ok(
    result.overlays.length > 0,
    `${label}: saved result has a thematic full-screen effect`,
  );
  assert.ok(
    result.overlays.every((overlay) => overlay.cue === expected),
    'Effect matches this saved result',
  );
  assert.ok(
    result.overlays.every((overlay) => overlay.pointerEvents === 'none'),
    'Effects cannot intercept play',
  );
  assert.ok(
    result.overlays.every((overlay) => overlay.reduced === String(reduced)),
    'Effect follows reduced-motion preference',
  );
  const sound =
    expected === 'assassination' ? `assassination-${saved.winner}` : expected;
  const plays = await Promise.all(
    [host, publicPage].map((page, index) =>
      page.evaluate(
        (count) => (window.__avalonPlays ?? []).slice(count),
        counts[index],
      ),
    ),
  );
  const resolved = plays
    .flat()
    .filter(
      (play) =>
        play.src.includes(`/${sound}-v1-`) &&
        play.resolved &&
        !play.muted &&
        play.volume > 0,
    );
  assert.equal(
    resolved.length,
    1,
    `${label}: one authorized native window actually starts the saved-result sound`,
  );
  evidence.audioPlayback ??= [];
  evidence.audioPlayback.push({
    label,
    expectedSound: sound,
    host: plays[0],
    public: plays[1],
    singleNativeOwner: true,
  });
  evidence.effects.push({ label, expected, reduced, ...result });
  await capture(publicPage, `effect-${label}`);
  if (expected === 'assassination') {
    await surface(phone)
      .locator('[data-avalon-effect="assassination"]')
      .waitFor();
    await capture(phone, `effect-${label}-player`);
  }
  await wait(reduced ? 400 : label.includes('assassination') ? 2650 : 1900);
}
async function round(path) {
  await clickAction(0, { type: 'acknowledge' });
  const ack = players.slice(1).map(async (p) => {
    const own = await view(p.token);
    return send(p.socket, p.token, {
      type: 'game',
      decisionId: own.decisionId,
      action: { type: 'acknowledge' },
    });
  });
  await Promise.all(ack);
  let actions = 0,
    recovered = false;
  while ((await view()).status === 'playing' && actions < 140) {
    const v = await view(),
      g = v.gameView;
    await privacy();
    if (g.phase === 'team') {
      const index = players.findIndex((p) => p.seatId === g.leader);
      const own = await view(players[index].token);
      let action = own.actions.find((a) => a.type === 'propose-team');
      if (
        path === 'failure' ||
        (path === 'long-quest' && g.questNumber % 2 === 0)
      ) {
        const alignments = await Promise.all(
          players.map(async (p) => ({
            seat: p.seatId,
            alignment: (await view(p.token)).gameView.self.alignment,
          })),
        );
        const evil = alignments
          .filter((p) => p.alignment === 'evil')
          .map((p) => p.seat);
        action = {
          type: 'propose-team',
          team: [
            ...evil,
            ...g.seatOrder.filter((s) => !evil.includes(s)),
          ].slice(0, g.questSizes[g.questNumber - 1]),
        };
      }
      if (actions === 0 && path === 'success') await clickAction(index, action);
      else await act(index, action);
      actions++;
      if (!recovered && path === 'success') {
        await send(hostSocket, hostToken, { type: 'pause' });
        const paused = await view(hostToken),
          checkpoint = paused.history.at(-1);
        await send(hostSocket, hostToken, {
          type: 'rollback',
          checkpointId: checkpoint.id,
        });
        assert.equal((await view()).paused, true);
        await send(hostSocket, hostToken, { type: 'resume' });
        await act(index, action);
        recovered = true;
        evidence.checks.push({
          check: 'actual native service rollback restores proposal boundary',
          result: 'passed',
        });
      }
      if (actions === 1 && path === 'success') {
        await phoneFor(index);
        await layout(phone, 'team-vote-player', true);
      }
    } else if (g.phase === 'vote') {
      const pending = [];
      for (let i = 0; i < players.length; i++) {
        const own = await view(players[i].token);
        if (own.actions.length)
          pending.push({
            index: i,
            action: {
              type: 'vote-team',
              vote: path === 'rejections' ? 'reject' : 'approve',
            },
          });
      }
      const trigger = async () => {
        for (const item of pending) {
          if (g.proposalNumber === 1 && g.questNumber === 1 && item.index === 0)
            await clickAction(item.index, item.action);
          else await act(item.index, item.action);
        }
      };
      if (
        (g.proposalNumber === 1 && g.questNumber === 1) ||
        (path === 'rejections' && g.rejectedTeams === 4)
      )
        await effect(
          path === 'rejections' ? 'team-rejected' : 'team-approved',
          trigger,
        );
      else await trigger();
      actions += pending.length;
    } else if (g.phase === 'quest') {
      const pending = [];
      for (let i = 0; i < players.length; i++) {
        const own = await view(players[i].token);
        if (own.actions.length)
          pending.push({
            index: i,
            action: {
              type: 'quest-card',
              card:
                (path === 'failure' ||
                  (path === 'long-quest' && g.questNumber % 2 === 0)) &&
                own.gameView.self.alignment === 'evil'
                  ? 'fail'
                  : 'success',
            },
          });
      }
      if (g.questNumber === 1) {
        await phoneFor(pending[0].index);
        await layout(phone, `${path}-quest-player`, true);
        await capture(host, `${path}-quest-host`);
      }
      await effect(
        `${path}-quest-${g.questNumber}`,
        async () => {
          for (const item of pending) {
            if (g.questNumber === 1 && item.index === pending[0].index)
              await clickAction(item.index, item.action);
            else await act(item.index, item.action);
          }
        },
        path === 'success' && g.questNumber === 2,
      );
      actions += pending.length;
    } else if (g.phase === 'assassinate') {
      const index = players.findIndex((p) => p.seatId === g.assassin);
      const own = await view(players[index].token);
      const roles = await Promise.all(
        players.map(async (p) => ({
          seat: p.seatId,
          role: (await view(p.token)).gameView.self.role,
          alignment: (await view(p.token)).gameView.self.alignment,
        })),
      );
      const target = roles.find(
        (p) =>
          p.alignment === 'good' &&
          (path === 'assassination' || path === 'long-quest'
            ? p.role === 'merlin'
            : p.role !== 'merlin'),
      ).seat;
      assert.ok(own.actions.some((a) => a.target === target));
      await phoneFor(index);
      await resize(phone, 320, 568, true);
      await layout(phone, `${path}-assassin-player`, true);
      await effect(`${path}-assassination`, () =>
        clickAction(index, { type: 'assassinate', target }),
      );
      actions++;
    } else throw new Error(`Unexpected phase ${g.phase}`);
  }
  const final = await view();
  assert.equal(final.status, 'ended');
  assert.equal(final.gameView.winner, path === 'success' ? 'good' : 'evil');
  assert.ok(final.gameView.revealedRoles);
  await layout(phone, `${path}-final-player`, true);
  await capture(host, `${path}-final-host`);
  await privacy();
  evidence.checks.push({
    check: `natural authoritative ${path} match`,
    actions,
    result: 'passed',
    winReason: final.gameView.winReason,
  });
}
let hostSocket;
try {
  await auditPackage('before');
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-play-mode'],
    env: {
      ...process.env,
      TABLEMAX_DATA_DIR: join(workDir, 'data'),
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_PLAY_MODE: 'play',
    },
    soundEnabled: false,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  await observe(host);
  await host.evaluate(() =>
    localStorage.setItem('tablemax-sound-muted', 'false'),
  );
  await host.locator('.connection.online').waitFor();
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken);
  hostSocket = await connect(hostToken);
  await send(hostSocket, hostToken, { type: 'select-game', gameId: 'avalon' });
  await send(hostSocket, hostToken, {
    type: 'select-variant',
    variantId: variant,
  });
  for (let i = 0; i < seats; i++) {
    const response = await (
      await fetch(origin + '/api/session/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: `圆桌朋友${i + 1}`,
          avatarId: `avatar-${20 + i}`,
        }),
      })
    ).json();
    assert.equal(response.ok, true);
    const token = response.token,
      socket = await connect(token);
    const own = await view(token);
    players.push({ token, socket, seatId: own.self.seatId });
    await send(socket, token, { type: 'ready', ready: true });
  }
  await send(hostSocket, hostToken, { type: 'start' });
  await host.goto(origin + '/host/game');
  await host.locator('.avalon-screen').waitFor();
  const nextPublic = desktop.waitForEvent('window');
  await desktop.request('open-public');
  publicPage = await nextPublic;
  await observe(publicPage);
  await publicPage.goto(origin + '/public/game');
  await publicPage.locator('.avalon-screen').waitFor();
  await audioDecode();
  const nextPhone = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, config) => {
      const native = new BrowserWindow({
        show: false,
        width: 390,
        height: 844,
        webPreferences: { partition: config.partition, offscreen: true },
      });
      void native.loadURL(config.url);
    },
    { partition: `avalon-${evidenceName}`, url: origin + '/player' },
  );
  phone = await nextPhone;
  await observe(phone);
  await resize(phone, 390, 844, true);
  await phoneFor(0);
  await privacy();
  if (['all', 'layout'].includes(only)) {
    for (const [w, h] of [
      [320, 568],
      [390, 844],
      [844, 390],
    ]) {
      await resize(phone, w, h, true);
      await layout(phone, `player-${w}x${h}`, true);
    }
    await resize(phone, 390, 844, true);
    for (const [w, h] of [
      [1280, 720],
      [1920, 1080],
      [3840, 2160],
    ]) {
      await resize(host, w, h, false);
      await layout(host, `host-${w}x${h}`, false);
    }
    await resize(host, 1280, 720, false);
    await layout(publicPage, 'public-opening', false);
    await surface(phone).getByRole('button', { name: /规则/ }).click();
    await wait(160);
    await capture(phone, 'rules-player');
    await surface(phone).getByRole('button', { name: /关闭/ }).last().click();
    evidence.checks.push({
      check: 'three-end responsive opening and top-level illustrated rules',
      result: 'passed',
    });
  }
  if (only !== 'layout') {
    const paths =
      only === 'all'
        ? ['success', 'failure', 'rejections', 'assassination']
        : [only];
    for (let index = 0; index < paths.length; index++) {
      if (index) {
        await send(hostSocket, hostToken, { type: 'replay' });
        for (const p of players)
          await send(p.socket, p.token, { type: 'ready', ready: true });
        await send(hostSocket, hostToken, { type: 'start' });
      }
      await round(paths[index]);
    }
    await publicPage.reload();
    await publicPage.locator('.avalon-screen').waitFor();
    await wait(200);
    assert.equal(
      await publicPage.locator('[data-avalon-effect]').count(),
      0,
      'Historical synchronization does not replay effects',
    );
    assert.equal(
      await publicPage.evaluate(() => window.__avalonPlays.length),
      0,
      'Historical synchronization does not replay sound',
    );
  }
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  await auditPackage('after');
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.failures.push({ message: error.message, stack: error.stack });
  process.exitCode = 1;
  if (host) await capture(host, 'failure-host').catch(() => {});
  if (phone) await capture(phone, 'failure-player').catch(() => {});
} finally {
  sockets.forEach((s) => s.disconnect());
  if (desktop)
    await desktop.close().catch((e) => {
      evidence.failures.push({ message: e.message });
      evidence.result = 'failed';
      process.exitCode = 1;
    });
  evidence.elapsedSeconds =
    Math.round((performance.now() - started) / 10) / 100;
  evidence.ownedDesktopClosed = true;
  evidence.screenshotPolicy = {
    mode: screenshotPolicy.mode,
    skipped: screenshotPolicy.skipped,
  };
  const data = join(workDir, 'data');
  const savedFiles = await readdir(data).catch(() => []);
  evidence.savedState = [];
  for (const name of savedFiles.filter((name) =>
    /^[a-z-]+\.sqlite$/.test(name),
  )) {
    const target = join(output, 'saved-state', name);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(data, name), target);
    const bytes = await readFile(target);
    evidence.savedState.push({
      path: target,
      bytes: bytes.length,
      sha256: hash(bytes),
    });
  }
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  await registerArtifacts({
    output,
    reportPath: join(output, 'results.json'),
    work: workDir,
    passed: evidence.result === 'passed',
    policy: screenshotPolicy,
  });
}
console.log(
  JSON.stringify({
    result: evidence.result,
    portable: evidence.portable,
    seats,
    variant,
    only,
    checks: evidence.checks.length,
    screenshots: evidence.screenshots.length,
    elapsedSeconds: evidence.elapsedSeconds,
    output,
    failures: evidence.failures.map((f) => f.message),
  }),
);
