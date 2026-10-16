import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
assertWorkspaceRoot();
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
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
import { MAXIMUM_PACKAGE_BYTES } from '../../../release/package-limits.mjs';

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const args = process.argv.slice(2);
assert.ok(
  args.every((arg) => /^--(executable|zip|evidence|seats|only)=.+$/.test(arg)),
);
assert.equal(new Set(args.map((arg) => arg.split('=')[0])).size, args.length);
const option = (name, fallback) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ??
  fallback;
const executablePath = resolve(option('executable', desktopExecutable));
const zipPath = option('zip') ? resolve(option('zip')) : null;
const seats = Number(option('seats', '5'));
const only = option('only', 'all');
const name = option('evidence', `native-${seats}-${Date.now()}`);
assert.ok([3, 4, 5].includes(seats));
assert.ok(['all', 'layout', 'phone', 'match'].includes(only));
assert.match(name, /^[a-z0-9-]{1,65}$/);
const output = resolve('artifacts/manila/validation', name);
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
await mkdir('tmp', { recursive: true });
const workDir = await mkdtemp(resolve('tmp/game-review-'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidence = {
  result: 'running',
  startedAt: new Date().toISOString(),
  seats,
  only,
  workDir,
  executablePath,
  executableSha256: hash(await readFile(executablePath)),
  zipPath,
  zipSha256: zipPath ? hash(await readFile(zipPath)) : null,
  verifierSha256: hash(await readFile(new URL(import.meta.url))),
  scope:
    'Only Manila: actual hidden WinForms/WebView2, local Socket/SQLite and authoritative legal actions. Phone sizes and display scaling are simulated. No real phone/LAN, physical DPI, human listening or system installer certification.',
  checks: [],
  screenshots: [],
  screenshotAliases: [],
  previewEncodings: [],
  layouts: [],
  phases: [],
  pageErrors: [],
  externalRequests: [],
  failures: [],
};
await writeFile(
  join(output, 'verifier-source.mjs'),
  await readFile(new URL(import.meta.url)),
  { flag: 'wx' },
);
const screenshotPolicy = new ScreenshotPolicy();
const sockets = [];
const players = [];
const emulationSessions = new WeakMap();
let desktop, origin, host, publicPage, phone, hostToken, hostSocket;
const surface = (page) =>
  page.frames().find((f) => f.parentFrame() === page.mainFrame()) ?? page;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(predicate, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await wait(80);
  }
  throw new Error(label);
}
async function view(token = '') {
  const response = await fetch(origin + '/api/session/view', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(token ? { token } : {}),
  });
  const data = await response.json();
  assert.equal(data.ok, true);
  return data.view;
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
  const v = await view(token);
  const reply = await new Promise((done, reject) =>
    socket.timeout(10000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: v.instanceId,
        revision: v.revision,
        branch: v.branch,
        command,
      },
      (error, data) => (error ? reject(error) : done(data)),
    ),
  );
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return reply;
}
async function observe(page) {
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== origin)
      evidence.externalRequests.push(request.url());
  });
  await page.addInitScript(() => {
    window.__manilaMotion = [];
    const observer = new MutationObserver(() => {
      const root = document.querySelector('.manila-screen');
      if (!root) return;
      const boat = root.querySelector('.mn-boat');
      const die = root.querySelector('.mn-die');
      window.__manilaMotion.push({
        saved: root.dataset.savedMotion,
        motion: root.dataset.motion,
        mode: root.dataset.playMode,
        phase: root.dataset.phase,
        transition: boat ? getComputedStyle(boat).transitionDuration : null,
        animation: die ? getComputedStyle(die).animationName : null,
      });
      if (window.__manilaMotion.length > 5000) window.__manilaMotion.shift();
    });
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'data-saved-motion',
        'data-motion',
        'data-play-mode',
        'data-phase',
      ],
    });
    window.addEventListener('pagehide', () => observer.disconnect(), {
      once: true,
    });
  });
}
async function resize(page, width, height, mobile) {
  const native = await desktop.browserWindow(page);
  await native.evaluate(
    (win, size) => win.setContentSize(size.width, size.height),
    { width, height },
  );
  if (!mobile)
    await page.evaluate(async () => {
      const bridge = window.tablemaxDisplay;
      const current = await bridge.read();
      await bridge.update({
        ...current.preferences,
        resolution: '1920x1080',
        interfaceScale: 100,
      });
    });
  let cdp = emulationSessions.get(page);
  if (!cdp) {
    cdp = await page.context().newCDPSession(page);
    emulationSessions.set(page, cdp);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: mobile,
    maxTouchPoints: 5,
  });
  if (mobile)
    await cdp.send('Emulation.setUserAgentOverride', {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    });
  await wait(120);
}
async function capture(page, label, boundary) {
  const file = screenshotPolicy.path(
    `${String(evidence.screenshots.length + 1).padStart(3, '0')}-${label}.png`,
    { label, boundary },
  );
  if (!file) return;
  await surface(page).evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  const native = await desktop.browserWindow(page);
  assert.equal(await native.evaluate((win) => win.isVisible()), false);
  const bytes = await native.evaluate(async (win) =>
    (await win.webContents.capturePage()).toPNG(),
  );
  evidence.screenshots.push(
    await writeScreenshot(output, file, bytes, evidence.screenshotAliases, {
      encodings: evidence.previewEncodings,
    }),
  );
}
async function layout(page, label, boundary) {
  await surface(page).locator('.manila-screen').waitFor();
  await surface(page).evaluate(() => document.fonts.ready);
  await surface(page).evaluate(() =>
    Promise.all(
      [...document.querySelectorAll('.manila-screen img')].map((img) =>
        img.decode().catch(() => {}),
      ),
    ),
  );
  const metrics = await surface(page).evaluate(() => {
    const root = document.querySelector('.manila-screen');
    const visible = (node) => {
      const r = node.getBoundingClientRect(),
        css = getComputedStyle(node);
      return (
        r.width > 0 &&
        r.height > 0 &&
        css.display !== 'none' &&
        css.visibility !== 'hidden'
      );
    };
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      devicePixelRatio: window.devicePixelRatio,
      scrollWidth: document.documentElement.scrollWidth,
      smallText: [...root.querySelectorAll('*')]
        .filter(
          (node) =>
            visible(node) &&
            [...node.childNodes].some(
              (c) => c.nodeType === Node.TEXT_NODE && c.textContent.trim(),
            ) &&
            parseFloat(getComputedStyle(node).fontSize) < 16,
        )
        .map((node) => ({
          text: node.textContent.slice(0, 80),
          size: getComputedStyle(node).fontSize,
        })),
      brokenImages: [...root.querySelectorAll('img')]
        .filter((node) => !node.complete || !node.naturalWidth)
        .map((node) => node.src),
      controls: [...root.querySelectorAll('button')].filter(visible).length,
    };
  });
  evidence.layouts.push({ label, ...metrics });
  const requested = label.match(/^(?:host|public)-(\d+)x(\d+)$/);
  if (requested) {
    assert.ok(Math.abs(metrics.width - Number(requested[1])) <= 16);
    assert.equal(metrics.height, Number(requested[2]));
  }
  const scaled = label.match(/^(?:host|public)-1920x1080-zoom(125|150)$/);
  if (scaled) {
    const factor = Number(scaled[1]) / 100;
    assert.ok(Math.abs(metrics.width - Math.floor(1920 / factor)) <= 16);
    assert.equal(metrics.height, Math.floor(1080 / factor));
  }
  if (label.startsWith('player') && label.includes('844x390'))
    assert.ok(
      metrics.width >= 800,
      `${label}: genuine landscape player surface required; desktop phone-frame emulation is insufficient`,
    );
  assert.ok(
    metrics.scrollWidth <= metrics.width + 1,
    `${label}: document horizontal overflow ${JSON.stringify(metrics)}`,
  );
  assert.deepEqual(
    metrics.smallText,
    [],
    `${label}: information below 16 CSS px`,
  );
  assert.deepEqual(metrics.brokenImages, [], `${label}: broken local assets`);
  await capture(page, label, boundary);
}
async function phoneFor(index) {
  await phone.evaluate((token) => {
    localStorage.setItem('tablemax-player', token);
    localStorage.setItem('tablemax-sound-muted', 'true');
  }, players[index].token);
  await phone.goto(origin + '/player/game');
  await until(async () => surface(phone) !== phone, 'Player iframe attaches');
  await surface(phone).locator('.manila-screen').waitFor();
}
async function auditPackage(stage) {
  if (!zipPath) return;
  const manifestPath = zipPath.replace(/\.zip$/i, '-manifest.json');
  const manifest = JSON.parse(
    await readFile(manifestPath, 'utf8').catch(() =>
      readFile(join(dirname(zipPath), 'release-manifest.json'), 'utf8'),
    ),
  );
  assert.equal(hash(await readFile(zipPath)), manifest.archive.sha256);
  assert.equal((await stat(zipPath)).size, manifest.archive.bytes);
  let bytes = 0;
  for (const file of manifest.files) {
    const path = resolve(dirname(executablePath), file.path);
    assert.ok(path.startsWith(dirname(executablePath) + '\\'));
    const data = await readFile(path);
    assert.equal(data.length, file.bytes);
    assert.equal(hash(data), file.sha256, stage + ': ' + file.path);
    bytes += data.length;
  }
  assert.equal(bytes, manifest.extractedBytes);
  assert.ok(
    bytes < MAXIMUM_PACKAGE_BYTES &&
      manifest.archive.bytes < MAXIMUM_PACKAGE_BYTES,
  );
  evidence.checks.push({
    check: `package all-member SHA ${stage}`,
    files: manifest.files.length,
    extractedBytes: bytes,
    archiveBytes: manifest.archive.bytes,
  });
}
async function privacy() {
  for (const token of ['', hostToken]) {
    const v = await view(token);
    assert.equal(v.gameView.self, null);
    assert.deepEqual(v.actions, []);
    assert.ok(Object.values(v.gameView.players).every((p) => !('shares' in p)));
  }
  for (const player of players) {
    const v = await view(player.token);
    assert.equal(v.gameView.self.seatId, player.seatId);
    assert.equal(v.gameView.self.shares.length, 2);
  }
  evidence.checks.push({
    check:
      'Host/public no private shares or game actions; only self receives original shares',
  });
}
function choose(v, financeAuction = false) {
  const actions = v.actions;
  const type = (name) => actions.find((a) => a.type === name);
  if (v.gameView.phase === 'auction')
    return v.gameView.auction.bid === 0
      ? (financeAuction &&
          actions.find(
            (a) => a.type === 'bid' && a.amount > v.gameView.self.cash,
          )) ||
          type('bid') ||
          type('pass')
      : type('pass');
  if (v.gameView.phase === 'share')
    return type('buy-share') ?? type('skip-share');
  if (v.gameView.phase === 'financing') return type('mortgage');
  if (v.gameView.phase === 'place') {
    const placements = actions.filter((a) => a.type === 'place');
    const priorities = [
      'pirate-0',
      'pilot-small',
      'pilot-large',
      'insurance',
      'pirate-1',
    ];
    return (
      placements.find(
        (a) =>
          a.space ===
          priorities[
            v.gameView.seatOrder.indexOf(v.self.seatId) % priorities.length
          ],
      ) ??
      placements.find((a) => a.space.startsWith('cargo-')) ??
      placements[0] ??
      type('pass')
    );
  }
  if (v.gameView.phase.startsWith('pilot'))
    return (
      actions.find(
        (a) => a.type === 'pilot' && a.moves.some((m) => m.delta > 0),
      ) ?? type('pilot')
    );
  if (v.gameView.phase === 'plunder')
    return actions.find(
      (a) => a.type === 'plunder' && a.destination === 'port',
    );
  return actions.find((a) => !['mortgage', 'repay'].includes(a.type));
}
async function naturalMatch() {
  const end = Date.now() + 300000;
  let count = 0;
  const observed = new Set();
  const experience = new Set();
  while ((await view()).status !== 'ended') {
    assert.ok(
      Date.now() < end && count < 4000,
      'Natural match bounded completion',
    );
    const publicView = await view();
    const phase = publicView.gameView.phase;
    if (!observed.has(phase)) {
      observed.add(phase);
      evidence.phases.push({
        phase,
        voyage: publicView.gameView.voyage,
        action: count,
      });
      await capture(host, `host-${phase}`);
    }
    if (
      phase === 'auction' &&
      publicView.gameView.auction.highBidder &&
      !experience.has('auction')
    ) {
      const { bid, highBidder } = publicView.gameView.auction;
      const name = publicView.seats.find((seat) => seat.id === highBidder).name;
      for (const [page, role] of [
        [host, 'host'],
        [publicPage, 'public'],
      ]) {
        await until(async () => {
          const text = await surface(page)
            .locator('.mn-auction-standing')
            .textContent();
          return text.includes(String(bid)) && text.includes(name);
        }, `${role}: public highest bid and bidder`);
        await capture(page, `${role}-auction-leading`, 'auction-leading');
      }
      await phoneFor(
        players.findIndex(
          (player) => player.seatId !== publicView.gameView.turnSeat,
        ),
      );
      await resize(phone, 320, 568, true);
      await layout(phone, 'player-auction-leading-320x568', 'auction-leading');
      assert.ok(
        (
          await surface(phone).locator('.mn-auction-standing').textContent()
        ).includes(name),
      );
      experience.add('auction');
      evidence.checks.push({
        check:
          'Highest bid and bidder remain visible to host, public and waiting player',
      });
    }
    if (phase === 'financing' && !experience.has('financing')) {
      const payerIndex = players.findIndex(
        (player) => player.seatId === publicView.gameView.payment.seatId,
      );
      assert.ok(payerIndex >= 0);
      await phoneFor((payerIndex + 1) % players.length);
      await resize(phone, 320, 568, true);
      await layout(
        phone,
        'player-financing-waiting-320x568',
        'financing-waiting',
      );
      assert.equal(
        await surface(phone).locator('.mn-financing-notice').count(),
        0,
      );
      assert.equal(
        await surface(phone).locator('[data-manila-action="mortgage"]').count(),
        0,
      );
      await phoneFor(payerIndex);
      await layout(phone, 'player-financing-payer-320x568', 'financing-payer');
      const own = await view(players[payerIndex].token);
      const notice = await surface(phone)
        .locator('.mn-financing-notice')
        .textContent();
      assert.ok(notice.includes(String(own.gameView.payment.amount)));
      assert.ok(
        notice.includes(
          String(
            Math.max(0, own.gameView.payment.amount - own.gameView.self.cash),
          ),
        ),
      );
      const mortgage = surface(phone)
        .locator('[data-manila-action="mortgage"]')
        .first();
      const firstChoice = await mortgage.boundingBox();
      const viewportHeight = await surface(phone).evaluate(
        () => document.documentElement.clientHeight,
      );
      assert.ok(
        firstChoice &&
          firstChoice.y >= 0 &&
          firstChoice.y + firstChoice.height <= viewportHeight,
        'A complete collateral choice must be visible on the initial 320x568 screen',
      );
      await mortgage.click();
      await until(
        async () => (await view()).revision > own.revision,
        'Actual chosen mortgage saves',
      );
      experience.add('financing');
      evidence.checks.push({
        check:
          'Only debtor sees financing gap and collateral actions; actual chosen mortgage saves through the player UI',
      });
      count++;
      continue;
    }
    if (phase.startsWith('pilot') && !experience.has(phase)) {
      const index = players.findIndex(
        (player) => player.seatId === publicView.gameView.turnSeat,
      );
      const own = await view(players[index].token);
      const choices = own.actions.filter(
        (action) => action.type === 'pilot' && action.moves.length,
      );
      const selected =
        choices.find((action) => action.moves.length === 2) ?? choices[0];
      if (selected) {
        await phoneFor(index);
        await resize(phone, 390, 844, true);
        for (const move of selected.moves) {
          const cargo = own.gameView.cargos.find(
            (item) => item.id === move.cargo,
          );
          const select = surface(phone).getByLabel(`${cargo.name}移动`, {
            exact: true,
          });
          await select.selectOption(String(move.delta));
          const boat = own.gameView.boats.find(
            (item) => item.cargo === move.cargo,
          );
          const target = boat.position + move.delta;
          const preview = await select
            .locator('..')
            .locator('.mn-pilot-preview')
            .textContent();
          assert.ok(preview.includes(target > 13 ? '靠港' : `${target} 格`));
        }
        assert.equal(
          (await view()).revision,
          own.revision,
          'Pilot drafts do not submit',
        );
        await layout(phone, `player-${phase}-draft`, phase);
        await surface(phone)
          .getByRole('button', { name: '清空调整', exact: true })
          .click();
        for (const select of await surface(phone)
          .locator('.mn-draft-grid select')
          .all())
          assert.equal(await select.inputValue(), '0');
        assert.equal(
          (await view()).revision,
          own.revision,
          'Clear pilot draft does not submit',
        );
        for (const move of selected.moves) {
          const cargo = own.gameView.cargos.find(
            (item) => item.id === move.cargo,
          );
          await surface(phone)
            .getByLabel(`${cargo.name}移动`, { exact: true })
            .selectOption(String(move.delta));
        }
        await surface(phone).locator('[data-manila-action="pilot"]').click();
        await until(
          async () => (await view()).revision > own.revision,
          'Concrete pilot confirmation saves',
        );
        experience.add(phase);
        evidence.checks.push({
          check: 'Pilot target previews, clear draft and actual confirmation',
          phase,
          moves: selected.moves,
        });
        count++;
        continue;
      }
    }
    let acted = false;
    for (let i = 0; i < players.length; i++) {
      const player = players[i],
        own = await view(player.token);
      if (!own.actions.length) continue;
      const action = choose(own, !experience.has('financing'));
      assert.ok(action, `Playable action in ${phase}`);
      await send(player.socket, player.token, {
        type: 'game',
        decisionId: own.decisionId,
        action,
      });
      count++;
      acted = true;
      break;
    }
    assert.ok(acted, `No actionable player in ${phase}`);
  }
  const final = await view();
  assert.ok(
    experience.has('auction') && experience.has('financing'),
    'Natural match must exercise auction standing and debtor-only financing UI',
  );
  assert.equal(final.gameView.phase, 'ended');
  assert.ok(final.gameView.winners.length > 0);
  assert.ok(Object.values(final.gameView.market).includes(30));
  assert.equal(Object.keys(final.gameView.scores).length, seats);
  evidence.checks.push({
    check: 'Natural complete match through real package Socket/SQLite',
    actions: count,
    voyages: final.gameView.voyage,
    scores: final.gameView.scores,
    winners: final.gameView.winners,
  });
  await phoneFor(0);
  await layout(phone, 'player-final', 'final');
  await capture(host, 'host-final', 'final');
}
async function firstPlacement(includeDesktop = true) {
  for (let step = 0; step < 100; step++) {
    if ((await view()).gameView.phase === 'place') break;
    let progressed = false;
    for (const player of players) {
      const own = await view(player.token);
      if (!own.actions.length) continue;
      const action = choose(own);
      assert.ok(action);
      await send(player.socket, player.token, {
        type: 'game',
        decisionId: own.decisionId,
        action,
      });
      progressed = true;
      break;
    }
    assert.ok(
      progressed,
      'Advance to first placement through authorized actions',
    );
  }
  assert.equal((await view()).gameView.phase, 'place');
  let index = -1;
  for (let i = 0; i < players.length; i++)
    if (
      (await view(players[i].token)).actions.some((a) => a.type === 'place')
    ) {
      index = i;
      break;
    }
  assert.ok(index >= 0);
  await phoneFor(index);
  await resize(phone, 320, 568, true);
  await layout(phone, 'player-board-320x568', 'board');
  if (includeDesktop) {
    await layout(host, 'host-board-1280x720', 'board');
    await layout(publicPage, 'public-board-1280x720', 'board');
  }
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
  ]) {
    if (width !== 320) {
      await resize(phone, width, height, true);
      await layout(
        phone,
        `player-board-${width}x${height}`,
        `board-${width}x${height}`,
      );
    }
    const orb = await surface(phone).evaluate(() => {
      const button = document.querySelector('.interaction-orb');
      if (!button) return null;
      const r = button.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        overlaps: [
          ...document.querySelectorAll(
            '.mn-action-grid button, .mn-controls-heading, .mn-confirm button, .mn-toolbar button, .mn-toolbar a, .mn-brand, .mn-voyage',
          ),
        ]
          .filter((node) => {
            const b = node.getBoundingClientRect();
            return (
              r.x < b.right && r.right > b.x && r.y < b.bottom && r.bottom > b.y
            );
          })
          .map((node) => node.textContent),
      };
    });
    assert.ok(orb, 'Actual default interaction control present');
    assert.deepEqual(
      orb.overlaps,
      [],
      'Interaction control does not obscure choices, action status, confirmation or toolbar controls',
    );
    evidence.checks.push({
      check:
        'Phone default movable interaction control does not overlap placement choices or necessary information',
      width,
      height,
      orb,
    });
  }
  await resize(phone, 320, 568, true);
  const before = await view(players[index].token);
  await surface(phone)
    .locator('.mn-controls .mn-action-grid button')
    .first()
    .click();
  assert.equal(
    (await view()).revision,
    before.revision,
    'Selecting a concrete space remains a local draft',
  );
  await surface(phone).locator('[data-manila-action="place"]').click();
  await until(
    async () => (await view()).revision > before.revision,
    'Concrete placement confirmed and saved',
  );
  assert.equal(
    (await view()).gameView.spaces.filter(
      (space) => space.occupant === players[index].seatId,
    ).length,
    1,
  );
  evidence.checks.push({
    check:
      'Actual concrete-space UI draft does not submit; confirmation saves the chosen worker',
  });
  await resize(phone, 390, 844, true);
}
async function motionChecks() {
  async function advanceMovement() {
    const before = (await view()).gameView;
    for (let step = 0; step < 120; step++) {
      const current = (await view()).gameView;
      if (current.movement > before.movement) return;
      let progressed = false;
      for (const player of players) {
        const own = await view(player.token);
        if (!own.actions.length) continue;
        await send(player.socket, player.token, {
          type: 'game',
          decisionId: own.decisionId,
          action: choose(own),
        });
        progressed = true;
        break;
      }
      assert.ok(progressed, 'Motion scenario has an authorized decision');
    }
    throw new Error('Bounded motion scenario did not roll');
  }
  await surface(host).evaluate(() => {
    window.__manilaMotion = [];
  });
  await advanceMovement();
  await until(
    () =>
      surface(host).evaluate(() =>
        window.__manilaMotion.some(
          (m) =>
            m.saved === 'true' &&
            m.motion === 'sail' &&
            m.animation &&
            m.animation !== 'none',
        ),
      ),
    'Saved sailing produces actual dice motion',
  );
  evidence.motion = {
    normal: await surface(host).evaluate(() => window.__manilaMotion),
  };
  assert.ok(
    evidence.motion.normal.some(
      (m) =>
        m.saved === 'true' &&
        m.motion === 'sail' &&
        parseFloat(m.transition) > 0,
    ),
  );
  await host.emulateMedia({ reducedMotion: 'reduce' });
  await surface(host).evaluate(() => {
    window.__manilaMotion = [];
  });
  await advanceMovement();
  await until(
    () =>
      surface(host).evaluate(() =>
        window.__manilaMotion.some(
          (m) => m.saved === 'true' && m.motion === 'sail',
        ),
      ),
    'Reduced-motion saved sailing observed',
  );
  evidence.motion.reduced = await surface(host).evaluate(
    () => window.__manilaMotion,
  );
  assert.ok(
    evidence.motion.reduced
      .filter((m) => m.saved === 'true' && m.motion === 'sail')
      .every((m) => parseFloat(m.transition) === 0 && m.animation === 'none'),
  );
  await host.reload();
  await host.locator('.manila-screen').waitFor();
  await wait(150);
  assert.equal(
    await host.locator('.manila-screen').getAttribute('data-saved-motion'),
    'false',
  );
  assert.ok(
    (await surface(host).evaluate(() => window.__manilaMotion)).every(
      (m) => m.saved !== 'true',
    ),
  );
  await send(hostSocket, hostToken, { type: 'set-play-mode', mode: 'test' });
  await until(
    () =>
      host
        .locator('.manila-screen')
        .getAttribute('data-play-mode')
        .then((mode) => mode === 'test'),
    'Isolated test mode applied',
  );
  await surface(host).evaluate(() => {
    window.__manilaMotion = [];
  });
  await advanceMovement();
  await wait(150);
  evidence.motion.test = await surface(host).evaluate(
    () => window.__manilaMotion,
  );
  assert.ok(evidence.motion.test.every((m) => m.saved !== 'true'));
  await send(hostSocket, hostToken, { type: 'set-play-mode', mode: 'play' });
  await host.emulateMedia({ reducedMotion: 'no-preference' });
  evidence.checks.push({
    check:
      'Actual saved sailing animates; reduced motion disables animation/transition; refresh does not replay; test mode suppresses motion',
  });
}
try {
  await auditPackage('before');
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-play-mode'],
    env: {
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
  await host.locator('.connection.online').waitFor();
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken);
  hostSocket = await connect(hostToken);
  await host.getByRole('button', { name: /^(切换游戏|游戏库)$/ }).click();
  const card = host.locator('.game-library [data-game-id="manila"]');
  await card.scrollIntoViewIfNeeded();
  await card.locator('img').evaluate((img) => img.decode());
  assert.ok(await card.locator('img').evaluate((img) => img.naturalWidth > 0));
  await card.getByRole('button', { name: '选择游戏', exact: true }).click();
  await until(
    async () => (await view(hostToken)).game?.id === 'manila',
    'Real library selects the preinstalled Manila release',
  );
  evidence.checks.push({
    check:
      'Actual Manila library cover decodes and its selection button loads the preinstalled game',
  });
  for (let i = 0; i < seats; i++) {
    const response = await (
      await fetch(origin + '/api/session/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: `港湾朋友${i + 1}`,
          avatarId: `avatar-${1 + i}`,
        }),
      })
    ).json();
    assert.equal(response.ok, true);
    const token = response.token,
      socket = await connect(token);
    players.push({ token, socket, seatId: (await view(token)).self.seatId });
    await send(socket, token, { type: 'ready', ready: true });
  }
  await send(hostSocket, hostToken, { type: 'start' });
  await host.goto(origin + '/host/game');
  await host.locator('.manila-screen').waitFor();
  const nextPublic = desktop.waitForEvent('window');
  await desktop.request('open-public');
  publicPage = await nextPublic;
  await observe(publicPage);
  await publicPage.goto(origin + '/public/game');
  await publicPage.locator('.manila-screen').waitFor();
  const nextPhone = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, config) => {
      const win = new BrowserWindow({
        show: false,
        width: 390,
        height: 844,
        webPreferences: { partition: config.partition, offscreen: true },
      });
      void win.loadURL(config.url);
    },
    { partition: `manila-${name}`, url: origin + '/player' },
  );
  phone = await nextPhone;
  await observe(phone);
  await resize(phone, 390, 844, true);
  await phoneFor(0);
  await privacy();
  if (only !== 'match') {
    for (const [w, h] of [
      [320, 568],
      [390, 844],
      [844, 390],
    ]) {
      await resize(phone, w, h, true);
      await layout(phone, `player-${w}x${h}`, `${w}x${h}`);
    }
    await resize(phone, 390, 844, true);
    for (const page of only === 'phone' ? [] : [host, publicPage]) {
      for (const [w, h] of [
        [1280, 720],
        [1920, 1080],
        [2560, 1440],
        [3840, 2160],
      ]) {
        await resize(page, w, h, false);
        await layout(
          page,
          `${page === host ? 'host' : 'public'}-${w}x${h}`,
          `${w}x${h}`,
        );
      }
      await resize(page, 1920, 1080, false);
      for (const zoom of [1.25, 1.5]) {
        const display = await page.evaluate(async (scale) => {
          const bridge = window.tablemaxDisplay;
          const current = await bridge.read();
          return bridge.update({
            ...current.preferences,
            resolution: '1920x1080',
            interfaceScale: scale,
          });
        }, zoom * 100);
        assert.equal(display.preferences.interfaceScale, zoom * 100);
        const cdp = emulationSessions.get(page);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await wait(120);
        evidence.checks.push({
          check:
            'Actual role-specific display preference and simulated scaled viewport',
          role: page === host ? 'host' : 'public',
          display,
        });
        await layout(
          page,
          `${page === host ? 'host' : 'public'}-1920x1080-zoom${zoom * 100}`,
          `zoom${zoom * 100}`,
        );
      }
      await page.evaluate(async () => {
        const bridge = window.tablemaxDisplay;
        const current = await bridge.read();
        await bridge.update({ ...current.preferences, interfaceScale: 100 });
      });
      await resize(page, 1280, 720, false);
    }
    await surface(phone).getByRole('button', { name: /规则/ }).first().click();
    await capture(phone, 'player-rules', 'rules');
    await surface(phone).getByRole('button', { name: /关闭/ }).last().click();
    let index = -1;
    for (let i = 0; i < players.length; i++)
      if (
        (await view(players[i].token)).actions.some((a) => a.type === 'bid')
      ) {
        index = i;
        break;
      }
    assert.ok(index >= 0);
    await phoneFor(index);
    const before = await view(players[index].token);
    await surface(phone).locator('[data-manila-action="bid"]').click();
    await until(
      async () => (await view()).revision > before.revision,
      'UI bid saved',
    );
    const checkpoint = (await view(hostToken)).history.at(-1);
    await send(hostSocket, hostToken, {
      type: 'rollback',
      checkpointId: checkpoint.id,
    });
    assert.deepEqual(
      (await view(players[index].token)).gameView,
      before.gameView,
    );
    await send(hostSocket, hostToken, { type: 'resume' });
    evidence.checks.push({
      check:
        'Actual player bid button commits; rollback restores authoritative state',
    });
    await firstPlacement(only !== 'phone');
    if (only !== 'phone') await motionChecks();
  }
  if (!['layout', 'phone'].includes(only)) await naturalMatch();
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  await auditPackage('after');
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.failures.push(error.stack ?? String(error));
  if (host) await capture(host, 'host-failure', 'failure').catch(() => {});
  if (phone) await capture(phone, 'player-failure', 'failure').catch(() => {});
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.disconnect();
  if (desktop)
    await desktop.close().catch((error) => {
      evidence.failures.push('Native shutdown: ' + error.message);
      evidence.result = 'failed';
      process.exitCode = 1;
    });
  evidence.completedAt = new Date().toISOString();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2),
  );
  await registerArtifacts({
    output,
    reportPath: join(output, 'results.json'),
    work: workDir,
    passed: evidence.result === 'passed',
    policy: screenshotPolicy,
  });
  console.log(
    JSON.stringify(
      {
        result: evidence.result,
        output,
        checks: evidence.checks.length,
        layouts: evidence.layouts.length,
        failures: evidence.failures,
      },
      null,
      2,
    ),
  );
}
