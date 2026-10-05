import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';
import { verificationOutput } from './verification-output.mjs';

const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const executableArgument = process.argv.find((argument) =>
  argument.startsWith('--executable='),
);
assert.ok(
  !portable || !executableArgument,
  'Explicit executable and portable archive selection are mutually exclusive',
);
const audit = process.argv.includes('--audit');
const longNames = process.argv.includes('--long-names');
const seatCount = Number(
  process.argv.find((argument) => argument.startsWith('--seats='))?.slice(8) ??
    5,
);
assert.ok(
  [3, 4, 5].includes(seatCount),
  'Modern Art supports three to five seats',
);
const humanCount = Math.min(3, seatCount - 1);
const evidenceName = process.argv
  .find((argument) => argument.startsWith('--evidence='))
  ?.slice('--evidence='.length);
assert.ok(
  !evidenceName || /^[a-z0-9-]{1,40}$/.test(evidenceName),
  'Safe independent evidence name',
);
const output = audit
  ? verificationOutput(
      'modern-art-audit-20261004',
      'runtime',
      evidenceName ?? (portable ? 'portable' : 'source'),
    )
  : verificationOutput(
      'modern-art',
      portable ? 'portable' : 'development',
      ...(evidenceName ? [evidenceName] : []),
    );
await mkdir(output, { recursive: true });
const verifierSource = await readFile(new URL(import.meta.url));
const verifierSha256 = createHash('sha256')
  .update(verifierSource)
  .digest('hex');
await writeFile(join(output, 'verifier-start-source.mjs'), verifierSource);
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/desktop-verify-'));
await build({
  entryPoints: ['games/modern-art/bot/index.ts'],
  outfile: join(work, 'driver.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const { bot } = require(join(work, 'driver.cjs'));
const modernArtWavNames = (
  await readdir('assets/games/modern-art/audio')
).filter((name) => name.endsWith('.wav'));
const verificationStarted = performance.now();
let executablePath = executableArgument
  ? resolve(executableArgument.slice('--executable='.length))
  : desktopExecutable;
const evidence = {
  startedAt: new Date().toISOString(),
  workDir: work,
  portable,
  executablePath,
  audit,
  seatCount,
  longNames,
  humanPhoneProfiles: humanCount,
  concurrentPairWithThirdPendingPhoneApplicable: audit && humanCount === 3,
  verifierSha256,
  verifierSnapshot: join(output, 'verifier-start-source.mjs'),
  initialPlayMode: audit ? 'play' : 'test',
  checks: [],
  screenshots: [],
  pageErrors: [],
  externalRequests: [],
  requestFailures: [],
  consoleErrors: [],
  phases: [],
  actions: [],
  portraitChecks: [],
  resultLayouts: [],
  commandAudit: [],
  projectionAudit: [],
  controlAudit: [],
  inputAudit: [],
  liveFeedbackAudit: [],
};
if (portable) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
  const extracted = await mkdtemp(resolve('tmp/portable-game-'));
  evidence.extractedDir = extracted;
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_VERIFY_ARCHIVE -DestinationPath $env:TABLEMAX_VERIFY_EXTRACT',
    ],
    {
      env: {
        ...process.env,
        TABLEMAX_VERIFY_ARCHIVE: archive,
        TABLEMAX_VERIFY_EXTRACT: extracted,
      },
      windowsHide: true,
    },
  );
  evidence.archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  executablePath = join(extracted, 'TableMax.exe');
  evidence.executablePath = executablePath;
}
const dataDir = join(work, 'data');
evidence.dataDir = dataDir;
let desktop, origin, host, publicPage, hostToken, failurePhone;
const sockets = [];
const phones = [];
const metricsSessions = new Map();
const mobileSizes = new Map();
const expectedOfflinePages = new Set();
const avatarImages = new Map();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(predicate, description, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await sleep(40);
  }
  throw new Error(description);
}
async function view(token = '') {
  const result = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(result.ok, true);
  return result.view;
}
async function connect(token) {
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
  const current = await view(token);
  const reply = await commandAt(socket, current, command);
  if (!reply.ok && ['stale-revision', 'stale-decision'].includes(reply.reason))
    return false;
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return true;
}
async function commandAt(socket, current, command) {
  const reply = await new Promise((done, reject) =>
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: crypto.randomUUID(),
        instanceId: current.instanceId,
        revision: current.revision,
        branch: current.branch,
        command,
      },
      (error, result) => (error ? reject(error) : done(result)),
    ),
  );
  if (audit)
    evidence.commandAudit.push({
      command: command.type,
      gameAction: command.type === 'game' ? command.action.type : null,
      sentRevision: current.revision,
      branch: current.branch,
      accepted: reply.ok,
      reason: reply.ok ? null : reply.reason,
    });
  return reply;
}
function observe(page) {
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  if (audit) {
    page.on('console', (message) => {
      if (message.type() === 'error')
        evidence.consoleErrors.push({
          url: page.url(),
          text: message.text(),
          expectedNetworkOutage:
            expectedOfflinePages.has(page) &&
            message.text().includes('ERR_INTERNET_DISCONNECTED'),
        });
    });
    page.on('requestfailed', (request) =>
      evidence.requestFailures.push({
        url: request.url(),
        error: request.failure()?.errorText ?? null,
        expectedMediaCancellation:
          request.failure()?.errorText === 'net::ERR_ABORTED' &&
          new URL(request.url()).origin === origin &&
          modernArtWavNames.some((name) => {
            const path = new URL(request.url()).pathname;
            return (
              path.endsWith('/' + name) ||
              (path.includes('/assets/' + name.slice(0, -4) + '-') &&
                path.endsWith('.wav'))
            );
          }),
        expectedNetworkOutage:
          expectedOfflinePages.has(page) &&
          request
            .failure()
            ?.errorText?.includes('ERR_INTERNET_DISCONNECTED') === true,
      }),
    );
  }
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin)
      evidence.externalRequests.push(request.url());
  });
}
async function viewport(page, width, height, mobile = false) {
  const window = await desktop.browserWindow(page);
  const scale = mobile
    ? 1
    : await window.evaluate(
        (window) => window.getBounds().width / window.getContentSize()[0],
      );
  await window.evaluate(
    (window, size) => window.setContentSize(size.width, size.height),
    { width: Math.round(width / scale), height: Math.round(height / scale) },
  );
  if (mobile) {
    mobileSizes.set(page, { width, height });
    let cdp = metricsSessions.get(page);
    if (!cdp) {
      cdp = await page.context().newCDPSession(page);
      metricsSessions.set(page, cdp);
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5,
    });
    try {
      await page.waitForFunction(
        (size) => innerWidth === size.width && innerHeight === size.height,
        { width, height },
        { timeout: 3000 },
      );
    } finally {
      const actual = await page.evaluate(
        (requestedWidth) => ({
          width: innerWidth,
          height: innerHeight,
          visualWidth: visualViewport.width,
          visualHeight: visualViewport.height,
          scale: visualViewport.scale,
          scrollWidth: document.documentElement.scrollWidth,
          overflow: [...document.querySelectorAll('body *')]
            .map((element) => ({
              tag: element.tagName,
              className: String(element.className),
              right: element.getBoundingClientRect().right,
            }))
            .filter((element) => element.right > requestedWidth + 2)
            .slice(0, 15),
          toolbar: [...document.querySelectorAll('.ma-toolbar > *')].map(
            (element) => ({
              text: element.textContent,
              className: String(element.className),
              width: element.getBoundingClientRect().width,
              left: element.getBoundingClientRect().left,
              right: element.getBoundingClientRect().right,
            }),
          ),
        }),
        width,
      );
      evidence.phoneViewports ??= [];
      evidence.phoneViewports.push({ requested: { width, height }, actual });
    }
  } else {
    const geometry = await window.evaluate((window) => ({
      content: window.getContentSize(),
      zoom: window.webContents.getZoomFactor(),
    }));
    await page.waitForFunction(
      (geometry) =>
        Math.abs(innerWidth - geometry.content[0] / geometry.zoom) <= 2 &&
        Math.abs(innerHeight - geometry.content[1] / geometry.zoom) <= 2,
      geometry,
    );
  }
}
async function capture(page, name, width, height, mobile = false) {
  name = name.replaceAll(':', '-');
  if (width) await viewport(page, width, height, mobile);
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  await page.waitForTimeout(120);
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((window) => window.isVisible()), false);
  const png = await window.evaluate(async (window) =>
    (await window.webContents.capturePage()).toPNG().toString('base64'),
  );
  await writeFile(join(output, name + '.png'), Buffer.from(png, 'base64'));
  evidence.screenshots.push(name + '.png');
  evidence.layouts ??= [];
  evidence.layouts.push({
    name,
    requested: width ? { width, height, mobile } : null,
    ...(await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      devicePixelRatio,
    }))),
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 2,
  );
  assert.equal(overflow, false, name + ' horizontal overflow');
  const panels = await page.evaluate(() => {
    if (!document.querySelector('.ma-screen:not(.player)')) return [];
    return [
      ...document.querySelectorAll(
        '.ma-market,.ma-center,.ma-museums,.ma-notice',
      ),
    ].map((element) => {
      const r = element.getBoundingClientRect();
      return {
        className: element.className,
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
      };
    });
  });
  const dimensions = evidence.layouts.at(-1);
  if (audit && mobileSizes.has(page)) {
    const requested = mobileSizes.get(page);
    dimensions.mobileExpected = requested;
    dimensions.overflow = await page.evaluate(
      (expectedWidth) =>
        [...document.querySelectorAll('body *')]
          .map((element) => ({
            tag: element.tagName,
            className: String(element.className),
            right: element.getBoundingClientRect().right,
            parentClassName: String(element.parentElement?.className ?? ''),
          }))
          .filter((element) => element.right > expectedWidth + 2)
          .slice(0, 15),
      requested.width,
    );
    assert.equal(
      dimensions.width,
      requested.width,
      name + ': actual phone CSS width remains requested',
    );
    assert.equal(
      dimensions.height,
      requested.height,
      name + ': actual phone CSS height remains requested',
    );
    const chips = await page
      .locator('.ma-auction__participants > span')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const bounds = (target) => {
            const r = target.getBoundingClientRect();
            return {
              x: r.x,
              right: r.right,
              y: r.y,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            };
          };
          const number = element.querySelector('.ma-auction__seat-number');
          const status = element.querySelector('.ma-auction__seat-status');
          return {
            title: element.title,
            row: bounds(element),
            number: bounds(number),
            status: bounds(status),
            index: Number(number.textContent),
            font: parseFloat(getComputedStyle(number).fontSize),
            statusLabel: status.getAttribute('aria-label'),
          };
        }),
      );
    if (chips.length) {
      dimensions.participants = chips;
      assert.equal(
        chips.length,
        seatCount,
        name + ': each seat has a participant chip',
      );
      assert.deepEqual(
        chips.map((chip) => chip.index),
        Array.from({ length: seatCount }, (_, index) => index + 1),
      );
      for (const [index, chip] of chips.entries()) {
        assert.ok(
          chip.font >= 16 && chip.number.width > 0 && chip.status.width >= 17.9,
          name + ': seat number/status remain readable',
        );
        assert.ok(
          chip.number.x >= chip.row.x - 1 &&
            chip.number.right <= chip.row.right + 1 &&
            chip.status.x >= chip.row.x - 1 &&
            chip.status.right <= chip.row.right + 1,
          name + ': number/status fit chip',
        );
        assert.ok(
          chip.number.right <= chip.status.x + 1 ||
            chip.status.right <= chip.number.x + 1 ||
            chip.number.bottom <= chip.status.y + 1 ||
            chip.status.bottom <= chip.number.y + 1,
          name + ': seat number and status do not overlap',
        );
        assert.ok(
          chip.row.x >= -1 && chip.row.right <= dimensions.width + 1,
          name + ': participant fits width',
        );
        assert.ok(
          chip.title.includes(evidence.seatAvatars[index].name),
          name + ': complete participant identity accessible',
        );
      }
    }
  }
  dimensions.panels = panels;
  for (const panel of panels)
    assert.ok(
      panel.y >= -1 &&
        panel.bottom <= dimensions.height + 2 &&
        panel.right <= dimensions.width + 2,
      name + ' panel fits: ' + panel.className,
    );
  for (let i = 0; i < panels.length; i++)
    for (const other of panels.slice(i + 1)) {
      const a = panels[i];
      assert.ok(
        Math.min(a.right, other.right) - Math.max(a.x, other.x) <= 1 ||
          Math.min(a.bottom, other.bottom) - Math.max(a.y, other.y) <= 1,
        name + ' panels do not overlap: ' + a.className + '/' + other.className,
      );
    }
  const clippedContent = await page.evaluate(() => {
    if (!document.querySelector('.ma-screen:not(.player)')) return [];
    return [...document.querySelectorAll('.ma-market > *, .ma-center > *')]
      .filter((element) => {
        if (element.getClientRects().length === 0) return false;
        const child = element.getBoundingClientRect();
        if (child.width === 0 || child.height === 0) return false;
        const parent = element.parentElement.getBoundingClientRect();
        return child.top < parent.top - 2 || child.bottom > parent.bottom + 2;
      })
      .map((element) => element.className);
  });
  assert.deepEqual(
    clippedContent,
    [],
    name + ' market and auction content fits',
  );
}
function imageKey(source) {
  return source.startsWith('data:')
    ? 'sha256:' + createHash('sha256').update(source).digest('hex')
    : new URL(source).pathname;
}
const probedAmounts = new Set();
const probedControls = new Set();
let sealedConcurrent = false;
let openConfirmation = false;
const ledger = new Map();
const accountedSales = new Set();
const accountedRounds = new Set();
function publicAccounting(game) {
  if (!audit) return;
  for (const seat of game.seatOrder)
    if (!ledger.has(seat)) ledger.set(seat, 100);
  for (const log of game.history) {
    if (log.verb !== 'sale' || accountedSales.has(log.id)) continue;
    assert.ok(Number.isSafeInteger(log.amount) && log.amount >= 0);
    assert.ok(ledger.has(log.winner) && ledger.has(log.actor));
    ledger.set(log.winner, ledger.get(log.winner) - log.amount);
    if (log.winner !== log.actor)
      ledger.set(log.actor, ledger.get(log.actor) + log.amount);
    accountedSales.add(log.id);
  }
  const result = game.roundResult;
  if (result && !accountedRounds.has(result.round)) {
    for (const seat of game.seatOrder) {
      const income = result.paintings[seat].reduce(
        (sum, card) => sum + result.values[card.artistId],
        0,
      );
      assert.equal(
        result.income[seat],
        income,
        'Public paintings explain each income',
      );
      ledger.set(seat, ledger.get(seat) + income);
    }
    accountedRounds.add(result.round);
    evidence.publicAccounting ??= [];
    evidence.publicAccounting.push({
      round: result.round,
      income: result.income,
      values: result.values,
    });
  }
}
async function projectionAudit(label) {
  const publicView = await view();
  const game = publicView.gameView;
  assert.equal(game.self, null);
  assert.deepEqual(publicView.actions, []);
  for (const player of Object.values(game.players)) {
    assert.equal(
      'hand' in player,
      false,
      'Public projection never includes a hand',
    );
    assert.equal('sealedBid' in player, false);
    if (game.phase !== 'ended') assert.equal(player.cash, null);
  }
  if (game.auction) assert.equal('sealedBids' in game.auction, false);
  for (const log of game.history.filter(
    (log) => log.verb === 'sealed-submit',
  )) {
    assert.equal(log.amount, null);
    assert.equal(log.sealedBids, null);
  }
  for (const phone of phones) {
    const privateView = await view(phone.token);
    assert.equal(privateView.gameView.self.seatId, privateView.self.seatId);
    assert.ok(Number.isSafeInteger(privateView.gameView.self.cash));
    for (const [seat, player] of Object.entries(privateView.gameView.players)) {
      assert.equal('hand' in player, false, `No other hand for ${seat}`);
      if (privateView.gameView.phase !== 'ended')
        assert.equal(player.cash, null);
    }
  }
  evidence.projectionAudit.push({
    label,
    round: game.round,
    phase: game.phase,
    privateProfiles: phones.length,
    publicSecretsAbsent: true,
  });
}
async function controlGeometry(button, label) {
  const geometry = await button.evaluate((element) => {
    const r = element.getBoundingClientRect();
    const top = document.elementFromPoint(
      r.x + r.width / 2,
      r.y + r.height / 2,
    );
    return {
      x: r.x,
      y: r.y,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      fontSize: parseFloat(getComputedStyle(element).fontSize),
      unobscured: Boolean(top && (element === top || element.contains(top))),
      disabled: element.disabled,
    };
  });
  evidence.controlAudit.push({ label, ...geometry });
  assert.ok(
    geometry.width >= 43.9 && geometry.height >= 43.9,
    label + ': 44px target',
  );
  assert.ok(geometry.fontSize >= 18, label + ': operation text at least 18px');
  assert.ok(
    geometry.x >= -1 &&
      geometry.right <= geometry.viewportWidth + 1 &&
      geometry.y >= -1 &&
      geometry.bottom <= geometry.viewportHeight + 1,
    label + ': target visible',
  );
  assert.equal(geometry.unobscured, true, label + ': target hit test');
  assert.equal(geometry.disabled, false, label + ': enabled action');
}
async function basicsAudit(hostSocket) {
  const before = await view(phones[0].token);
  const page = phones[0].page;
  const selector = page.getByLabel('你的手牌和收藏排序', { exact: true });
  const artists = ['manuel', 'sigrid', 'daniel', 'ramon', 'rafael'];
  const auctions = ['open', 'once', 'sealed', 'fixed', 'double'];
  for (const mode of ['original', 'artist', 'auction']) {
    await selector.selectOption(mode);
    const hand = before.gameView.self.hand;
    const expected =
      mode === 'original'
        ? hand
        : hand
            .map((card, index) => ({ card, index }))
            .sort((a, b) => {
              const artist =
                artists.indexOf(a.card.artistId) -
                artists.indexOf(b.card.artistId);
              const auction =
                auctions.indexOf(a.card.auctionKind) -
                auctions.indexOf(b.card.auctionKind);
              return (
                (mode === 'artist' ? artist : auction || artist) ||
                a.index - b.index
              );
            })
            .map(({ card }) => card);
    assert.deepEqual(
      await page
        .locator('.ma-hand > button[data-card-id]')
        .evaluateAll((cards) => cards.map((card) => card.dataset.cardId)),
      expected.map((card) => card.id),
    );
    const after = await view(phones[0].token);
    assert.equal(after.revision, before.revision);
    assert.equal(after.decisionId, before.decisionId);
    assert.deepEqual(after.gameView.self.hand, hand);
    assert.equal(after.self.seatId, before.self.seatId);
  }
  await selector.selectOption('artist');
  assert.equal(
    await page.getByRole('timer').count(),
    0,
    'Paused offer has no numeric timer',
  );
  assert.equal(
    await page.getByRole('progressbar').count(),
    0,
    'Paused offer has no countdown progress',
  );
  await send(hostSocket, hostToken, { type: 'set-countdown', seconds: 5 });
  await send(hostSocket, hostToken, { type: 'resume' });
  const running = await view(phones[0].token);
  assert.equal(running.playMode, 'play');
  for (const [index, size] of [
    [0, 320],
    [1, 320],
    [0, 360],
    [1, 360],
  ]) {
    if (!phones[index]) continue;
    await capture(
      phones[index].page,
      `normal-offer-${index}-${size}`,
      size,
      size === 320 ? 568 : 640,
      true,
    );
    assert.equal(
      await phones[index].page.locator('.ma-waiting').count(),
      0,
      'Offer does not repeat acting name under the hand',
    );
    const title = await phones[index].page
      .locator('.ma-auction h2')
      .getAttribute('title');
    assert.ok(
      title.includes(
        before.seats.find((seat) => seat.id === before.gameView.turnSeat).name,
      ),
      'Offer actor complete in accessible title',
    );
    assert.equal(
      await phones[index].page.getByRole('timer').count(),
      0,
      'Offer has no numeric timer',
    );
    assert.equal(
      await phones[index].page.getByRole('progressbar').count(),
      0,
      'Offer has no countdown progress',
    );
  }
  await sleep(1100);
  const unchangedOffer = await view(phones[0].token);
  assert.equal(
    unchangedOffer.revision,
    running.revision,
    'Offer display does not submit or advance',
  );
  assert.equal(unchangedOffer.decisionId, running.decisionId);
  assert.deepEqual(unchangedOffer.gameView, running.gameView);
  const clockEvidencePath = resolve(
    'artifacts/maintenance/v1.0.2/modern-art-polish-20261005/audio/portable-timer-final/results.json',
  );
  if (portable) {
    try {
      const clockEvidence = JSON.parse(
        await readFile(clockEvidencePath, 'utf8'),
      );
      evidence.auctionClockIndependentEvidence = clockEvidencePath;
      evidence.auctionClockIndependentResult =
        clockEvidence.archiveSha256 === evidence.archiveSha256
          ? clockEvidence.result
          : 'unverified: evidence belongs to a different archive';
    } catch (error) {
      evidence.auctionClockIndependentResult =
        'unverified: independent evidence unavailable';
      evidence.auctionClockIndependentError = error.message;
    }
  }
  await send(hostSocket, hostToken, { type: 'pause' });
  assert.equal(
    await page.locator('.ma-waiting').count(),
    0,
    'Paused phone has no false acting message',
  );
  assert.equal(
    await page.locator('.ma-notice').count(),
    1,
    'Paused offer has one status notice',
  );
  assert.equal(
    await page.locator('.ma-auction--waiting').count(),
    0,
    'Paused offer does not repeat empty waiting stage',
  );
  assert.equal(
    await page.getByRole('progressbar').count(),
    0,
    'Paused offer retains no clock',
  );
  assert.equal(
    await page.locator('.ma-notice > span').getAttribute('title'),
    '游戏已暂停',
  );
  await send(hostSocket, hostToken, {
    type: 'set-countdown',
    seconds: before.countdownSeconds,
  });
  await projectionAudit('initial-sorting-clock');
  evidence.checks.push(
    'Original/artist/auction sorting keeps saved hand IDs, identity and decision; offer has no timer/progress while paused or running and never advances itself; resumed 24-character offer and other-phone waiting fit 320/360; auction clock independent audit is recorded separately when available for this exact archive',
  );
}
async function installMediaProbe(page) {
  await page.evaluate(() => {
    const original = HTMLMediaElement.prototype.play;
    window.maAudioProbe = [];
    HTMLMediaElement.prototype.play = function (...args) {
      const item = {
        source: new URL(this.currentSrc || this.src, location.href).pathname,
        volume: this.volume,
        playing: false,
        error: null,
      };
      window.maAudioProbe.push(item);
      this.addEventListener(
        'playing',
        () => {
          item.playing = true;
        },
        { once: true },
      );
      this.addEventListener(
        'error',
        () => {
          item.error = this.error?.code ?? 'media-error';
        },
        { once: true },
      );
      return original.apply(this, args);
    };
  });
}
async function motionClickAudit() {
  if (evidence.motionClick) return;
  for (const phone of phones) {
    const current = await view(phone.token);
    const action =
      current.actions.find((candidate) => candidate.type === 'pass') ??
      current.actions.find((candidate) => candidate.type === 'bid');
    if (!action) continue;
    const button = phone.page.locator(`[data-ma-action="${action.type}"]`);
    if ((await button.count()) !== 1 || (await button.isDisabled())) continue;
    if ('amount' in action)
      await phone.page.locator('#ma-bid-amount').fill(String(action.amount));
    await button.scrollIntoViewIfNeeded();
    const live = await phone.page.evaluate(() => ({
      saved: document
        .querySelector('.ma-screen')
        .classList.contains('ma-saved'),
      animations: document
        .getAnimations()
        .filter((animation) => animation.playState === 'running').length,
      width: innerWidth,
      height: innerHeight,
    }));
    if (!live.saved || !live.animations) continue;
    await controlGeometry(button, 'during-saved-motion:' + action.type);
    const beforeLog = Number(current.gameView.latest?.id.slice(4) ?? 0);
    await button.click();
    await until(
      async () =>
        (await view(phone.token)).gameView.history.some(
          (log) =>
            Number(log.id.slice(4)) > beforeLog &&
            log.actor === current.self.seatId &&
            log.verb === action.type,
        ),
      'Real primary operation during saved animation is saved',
    );
    evidence.motionClick = {
      action: action.type,
      phase: current.gameView.auction?.kind,
      ...live,
      savedByRealUI: true,
    };
    await capture(phone.page, 'actual-next-operation-during-saved-motion');
    return;
  }
}
async function amountAudit(phone, player, action) {
  const phase = player.gameView.auction?.kind ?? player.gameView.phase;
  const key = phase + ':' + action.type;
  if (probedAmounts.has(key)) return;
  const input = phone.page.locator('#ma-bid-amount');
  const button = phone.page.locator(`[data-ma-action="${action.type}"]`);
  const amounts = player.actions
    .filter(
      (candidate) => candidate.type === action.type && 'amount' in candidate,
    )
    .map((candidate) => candidate.amount);
  const minimum = Math.min(...amounts),
    maximum = Math.max(...amounts);
  const oldOwn = player.gameView.history
    .filter((log) => log.actor === player.self.seatId)
    .map((log) => log.id);
  for (const invalid of [
    '',
    '1.5',
    '-1',
    String(maximum + 1),
    ...(minimum > 0 ? [String(minimum - 1)] : []),
  ]) {
    await input.fill(invalid);
    assert.equal(
      await button.isDisabled(),
      true,
      key + ': illegal amount disabled',
    );
    await input.press('Enter');
    assert.deepEqual(
      (await view(phone.token)).gameView.history
        .filter((log) => log.actor === player.self.seatId)
        .map((log) => log.id),
      oldOwn,
      key + ': illegal input never saved',
    );
  }
  const increase = phone.page.getByRole('button', {
    name: '增加出价',
    exact: true,
  });
  const decrease = phone.page.getByRole('button', {
    name: '减少出价',
    exact: true,
  });
  const recoveries = [];
  for (const [label, raw, step] of [
    ['fraction-plus', '0.5', increase],
    ['fraction-minus', String(minimum + 1.5), decrease],
    ['over-max-minus', String(maximum + 0.5), decrease],
    ['under-min-plus', String(minimum - 0.5), increase],
  ]) {
    await input.fill(raw);
    assert.equal(
      await step.isDisabled(),
      false,
      key + ': recovery step available',
    );
    await step.click();
    const recovered = Number(await input.inputValue());
    const current = await view(phone.token);
    const permitted = current.actions.some(
      (candidate) =>
        candidate.type === action.type && candidate.amount === recovered,
    );
    const sample = {
      label,
      raw,
      recovered,
      permitted,
      submitEnabled: !(await button.isDisabled()),
    };
    recoveries.push(sample);
    evidence.inputAudit.push({ key, recovery: sample });
    assert.ok(Number.isInteger(recovered), key + ': step restores integer');
    assert.equal(
      permitted,
      true,
      key + ': recovered amount is currently permitted',
    );
    assert.equal(
      sample.submitEnabled,
      true,
      key + ': recovered integer enables explicit submit',
    );
    assert.deepEqual(
      current.gameView.history
        .filter((log) => log.actor === player.self.seatId)
        .map((log) => log.id),
      oldOwn,
      key + ': step changes input without auto submitting',
    );
  }
  await input.fill(String(minimum));
  assert.equal(
    await decrease.isDisabled(),
    true,
    key + ': minimum cannot decrease',
  );
  await input.fill(String(maximum));
  assert.equal(
    await increase.isDisabled(),
    true,
    key + ': maximum cannot increase',
  );
  console.log(
    JSON.stringify({
      inputRecovery: true,
      key,
      recoveries,
      boundaryButtonsDisabled: true,
    }),
  );
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  await capture(
    phone.page,
    `amount-${phase}-${action.type}-integer-recovery-320`,
  );
  await input.fill(String(action.amount));
  probedAmounts.add(key);
  evidence.inputAudit.push({
    key,
    invalidCases: 4 + (minimum > 0 ? 1 : 0),
    noSavedAction: true,
  });
}
async function sealedAudit(phone, player) {
  if (sealedConcurrent || phones.length < 3) return;
  const others = [];
  for (const candidate of phones) {
    if (candidate === phone) continue;
    const current = await view(candidate.token);
    const action = current.actions.find(
      (entry) => entry.type === 'sealed-bid' && entry.amount === 1,
    );
    if (action) others.push({ phone: candidate, current, action });
  }
  if (others.length !== 2) return;
  const draft =
    player.actions.find(
      (entry) => entry.type === 'sealed-bid' && entry.amount === 2,
    ) ?? player.actions.find((entry) => entry.type === 'sealed-bid');
  const input = phone.page.locator('#ma-bid-amount');
  await input.fill(String(draft.amount));
  const shared = await view(hostToken);
  const replies = await Promise.all(
    others.map(({ phone: other, current, action }) =>
      commandAt(other.socket, shared, {
        type: 'game',
        decisionId: current.decisionId,
        action,
      }),
    ),
  );
  assert.ok(
    replies.every((reply) => reply.ok),
    'Genuinely concurrent sealed submissions both accepted',
  );
  const after = await view(phone.token);
  assert.equal(
    after.decisionId,
    player.decisionId,
    'Other sealed submissions preserve own pending decision',
  );
  assert.equal(after.gameView.self.sealedBid, null);
  assert.equal(
    await input.inputValue(),
    String(draft.amount),
    'Other sealed submissions preserve own input',
  );
  for (const { phone: other, action } of others)
    assert.equal(
      (await view(other.token)).gameView.self.sealedBid,
      action.amount,
    );
  await projectionAudit('concurrent-sealed-pending');
  await capture(phone.page, 'sealed-other-two-submit-input-preserved-320');
  sealedConcurrent = true;
  evidence.checks.push(
    'Two real independent phones submit sealed bids concurrently from one revision; both save, third phone draft and decision remain, pending amounts stay private',
  );
}
async function openAudit() {
  if (openConfirmation || phones.length < 2) return;
  const first = await view(phones[0].token);
  const passer = first.actions.find((entry) => entry.type === 'pass');
  const second = await view(phones[1].token);
  const bid = second.actions.find((entry) => entry.type === 'bid');
  if (!passer || !bid) return;
  const acceptedPass = await commandAt(phones[0].socket, first, {
    type: 'game',
    decisionId: first.decisionId,
    action: passer,
  });
  if (
    !acceptedPass.ok &&
    ['stale-revision', 'stale-decision'].includes(acceptedPass.reason)
  )
    return;
  assert.equal(acceptedPass.ok, true);
  const confirmingPhone = phones[phones.length >= 3 ? 2 : 1];
  const oldConfirmation = await view(confirmingPhone.token);
  const oldPass = oldConfirmation.actions.find(
    (entry) => entry.type === 'pass' || entry.type === 'bid',
  );
  const liveBidder = await view(phones[1].token);
  const liveBid = liveBidder.actions.find((entry) => entry.type === 'bid');
  if (!oldPass || !liveBid) return;
  if (
    !(await send(phones[1].socket, phones[1].token, {
      type: 'game',
      decisionId: liveBidder.decisionId,
      action: liveBid,
    }))
  )
    return;
  const after = await view(phones[0].token);
  assert.equal(
    after.gameView.auction.passes.includes(first.self.seatId),
    false,
    'New bid releases prior pass',
  );
  const stale = await commandAt(confirmingPhone.socket, oldConfirmation, {
    type: 'game',
    decisionId: oldConfirmation.decisionId,
    action: oldPass,
  });
  assert.equal(stale.ok, false, 'Old price confirmation is rejected');
  assert.ok(['stale-revision', 'stale-decision'].includes(stale.reason));
  openConfirmation = true;
  evidence.checks.push(
    'New open price releases passed seat and rejects stale confirmation from old revision',
  );
}
async function verifyPortraits(page, name, seats, expectedKinds) {
  await page.waitForFunction(
    ({ seats, expectedKinds }) =>
      expectedKinds.every((kind) =>
        seats.every((seat) =>
          document.querySelector(
            `${kind === 'museum' ? '.ma-museum' : '.ma-results__income > div'}[data-seat-id="${seat.id}"] .${kind === 'museum' ? 'ma-museum' : 'ma-results'}__portrait`,
          ),
        ),
      ),
    { seats, expectedKinds },
  );
  const images = await page.evaluate(async () => {
    const images = [
      ...document.querySelectorAll(
        '.ma-museum__portrait, .ma-results__portrait',
      ),
    ];
    await Promise.all(images.map((image) => image.decode()));
    return images.map((image) => ({
      seatId: image.closest('[data-seat-id]').dataset.seatId,
      kind: image.classList.contains('ma-museum__portrait')
        ? 'museum'
        : 'result',
      source: image.currentSrc,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    }));
  });
  const check = {
    name,
    images: images.map(({ source, ...image }) => ({
      ...image,
      imageKey: imageKey(source),
    })),
  };
  evidence.portraitChecks.push(check);
  for (const image of check.images) {
    const seat = seats.find((seat) => seat.id === image.seatId);
    assert.ok(seat, name + ': portrait belongs to a current seat');
    assert.equal(
      image.imageKey,
      avatarImages.get(seat.avatarId),
      `${name}: ${image.kind} shows saved ${seat.avatarId}`,
    );
    assert.ok(
      image.naturalWidth > 0 && image.naturalHeight > 0,
      name + ': actual portrait decoded',
    );
    image.avatarId = seat.avatarId;
  }
  for (const kind of expectedKinds)
    assert.equal(
      check.images.filter((image) => image.kind === kind).length,
      seats.length,
      name + ': one ' + kind + ' portrait per seat',
    );
}
async function resultGeometry(page, name, includeMuseums, expectReplay) {
  const geometry = await page.evaluate(
    ({ includeMuseums }) => {
      const rect = (element) => {
        if (!element) return null;
        const r = element.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      const sample = (element) => {
        const bounds = rect(element);
        if (!bounds) return null;
        const style = getComputedStyle(element);
        const top = document.elementFromPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        );
        return {
          ...bounds,
          font: parseFloat(style.fontSize),
          textOverflow: style.textOverflow,
          lineClamp: style.webkitLineClamp,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          unobscured: Boolean(
            top && (element === top || element.contains(top)),
          ),
        };
      };
      const nameVisibility = (element) => {
        const glyphs = [];
        const hiddenAncestors = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          let offset = 0;
          for (const character of node.textContent) {
            const range = document.createRange();
            range.setStart(node, offset);
            offset += character.length;
            range.setEnd(node, offset);
            const bounds = rect(range);
            const hit = document.elementFromPoint(
              bounds.x + bounds.width / 2,
              bounds.y + bounds.height / 2,
            );
            glyphs.push({
              character,
              ...bounds,
              unobscured: hit === element || element.contains(hit),
            });
          }
        }
        const clippingAncestors = [];
        for (let parent = element; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          if (
            style.visibility === 'hidden' ||
            style.visibility === 'collapse' ||
            style.display === 'none' ||
            Number(style.opacity) === 0
          )
            hiddenAncestors.push(parent.className);
          const clipsX = /^(hidden|clip|auto|scroll)$/.test(style.overflowX);
          const clipsY = /^(hidden|clip|auto|scroll)$/.test(style.overflowY);
          if (!clipsX && !clipsY) continue;
          const bounds = rect(parent);
          clippingAncestors.push({
            className: parent.className,
            clipsX,
            clipsY,
            x: bounds.x + parent.clientLeft,
            y: bounds.y + parent.clientTop,
            right: bounds.x + parent.clientLeft + parent.clientWidth,
            bottom: bounds.y + parent.clientTop + parent.clientHeight,
          });
        }
        return {
          text: element.textContent.trim(),
          glyphs,
          clippingAncestors,
          hiddenAncestors,
        };
      };
      const income = [
        ...document.querySelectorAll('.ma-results__income > div'),
      ].map((row) => ({
        seatId: row.dataset.seatId,
        row: rect(row),
        portrait: sample(row.querySelector('.ma-results__portrait')),
        name: sample(row.querySelector('.ma-results__name')),
        visibleName: nameVisibility(row.querySelector('.ma-results__name')),
        amount: sample(row.querySelector(':scope > strong')),
        title: row.querySelector('.ma-results__name').title,
        cash: Number(row.dataset.finalCash),
        amountText: row.querySelector(':scope > strong').textContent.trim(),
        champion: row.dataset.champion === 'true',
        championMark: Boolean(row.querySelector('[aria-label="冠军"] svg')),
        championIcon: sample(row.querySelector('[aria-label="冠军"] svg')),
        championLabel: sample(row.querySelector('.ma-results__champion-label')),
        championText: row.querySelector('.ma-results__champion-label')
          ?.textContent,
      }));
      const museums = includeMuseums
        ? [...document.querySelectorAll('.ma-museum')].map((museum) => ({
            seatId: museum.dataset.seatId,
            row: rect(museum),
            portrait: sample(museum.querySelector('.ma-museum__portrait')),
            name: sample(museum.querySelector('h3')),
            amount: sample(museum.querySelector('.ma-museum__cash')),
          }))
        : [];
      return {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
        role: location.pathname.startsWith('/player')
          ? 'player'
          : location.pathname.startsWith('/public')
            ? 'public'
            : 'host',
        scrollY,
        replay: sample(document.querySelector('.ma-next-round')),
        actionControlCount: document.querySelectorAll(
          '[data-ma-action], .ma-controls',
        ).length,
        center: rect(document.querySelector('.ma-center')),
        horizontalOverflow:
          document.documentElement.scrollWidth > innerWidth + 2,
        income,
        museums,
      };
    },
    { includeMuseums },
  );
  evidence.resultLayouts.push({ name, expectReplay, ...geometry });
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  assert.equal(
    geometry.horizontalOverflow,
    false,
    name + ': no horizontal overflow',
  );
  assert.equal(
    geometry.income.length,
    seatCount,
    name + ': all visible settlement identities',
  );
  const authority = await view(hostToken);
  assert.equal(authority.gameView.phase, 'ended');
  const overlaps = (a, b) =>
    Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
  for (const row of geometry.income) {
    const seat = authority.seats.find((seat) => seat.id === row.seatId);
    assert.ok(seat, name + ': final identity belongs to a current player');
    assert.equal(
      row.title,
      seat.name,
      name + ': complete player name retained',
    );
    assert.equal(
      row.visibleName.text,
      seat.name,
      name + ': full name is rendered',
    );
    assert.deepEqual(
      row.visibleName.hiddenAncestors,
      [],
      name + ': final name has no visually hidden ancestor',
    );
    assert.notEqual(
      row.name.textOverflow,
      'ellipsis',
      name + ': final name never uses ellipsis',
    );
    assert.ok(
      !(parseInt(row.name.lineClamp, 10) > 0),
      name + ': final name has no line truncation',
    );
    assert.ok(
      row.name.font >= 18 && row.amount.font >= 18,
      name + ': readable final identities and assets',
    );
    if (row.name.clientWidth > 0)
      assert.ok(
        row.name.scrollWidth <= row.name.clientWidth + 1,
        name + ': no hidden name width overflow',
      );
    if (row.name.clientHeight > 0)
      assert.ok(
        row.name.scrollHeight <= row.name.clientHeight + 1,
        name + ': no hidden name height overflow',
      );
    for (const glyph of row.visibleName.glyphs.filter(
      (glyph) => !/^\s$/u.test(glyph.character),
    )) {
      assert.ok(
        glyph.width > 0 && glyph.height > 0,
        name + ': each name character is laid out',
      );
      // Font em boxes may extend beyond an overflow-visible CSS line box.
      // Actual clipping ancestors and the viewport remain strict on both axes.
      for (const bounds of [row.name, row.row])
        assert.ok(
          glyph.x >= bounds.x - 1 && glyph.right <= bounds.right + 1,
          name + ': each full-name character fits its identity width',
        );
      assert.ok(
        glyph.x >= -1 &&
          glyph.y >= -1 &&
          glyph.right <= geometry.width + 1 &&
          glyph.bottom <= geometry.height + 1,
        name + ': each full-name character fits the viewport',
      );
      assert.equal(
        overlaps(glyph, row.amount),
        false,
        name + ': full-name character does not cover money',
      );
      for (const other of geometry.income.filter(
        (other) => other.seatId !== row.seatId,
      ))
        assert.equal(
          overlaps(glyph, other.row),
          false,
          name + ': full-name character does not cover another seat',
        );
      for (const ancestor of row.visibleName.clippingAncestors)
        assert.ok(
          (!ancestor.clipsX ||
            (glyph.x >= ancestor.x - 1 && glyph.right <= ancestor.right + 1)) &&
            (!ancestor.clipsY ||
              (glyph.y >= ancestor.y - 1 &&
                glyph.bottom <= ancestor.bottom + 1)),
          name + ': no ancestor clips a full-name character',
        );
      assert.equal(
        glyph.unobscured,
        true,
        name + ': each name character is unobscured',
      );
    }
    assert.equal(row.cash, authority.gameView.finalCash[row.seatId]);
    assert.equal(row.amountText, `${row.cash.toLocaleString('zh-CN')} 千元`);
    assert.equal(row.champion, authority.gameView.winners.includes(row.seatId));
    assert.equal(row.championMark, row.champion);
    if (row.champion) {
      assert.ok(row.championIcon.width >= 18 && row.championIcon.height >= 18);
      assert.equal(
        row.championIcon.unobscured,
        true,
        name + ': champion mark is visible',
      );
      assert.ok(
        row.championIcon.x >= row.row.x - 1 &&
          row.championIcon.right <= row.row.right + 1 &&
          row.championIcon.y >= row.row.y - 1 &&
          row.championIcon.bottom <= row.row.bottom + 1,
        name + ': champion mark fits its player row',
      );
      if (geometry.role !== 'player') {
        assert.equal(row.championText, '冠军');
        assert.ok(row.championLabel?.font >= 18);
        assert.equal(row.championLabel.unobscured, true);
        assert.ok(
          row.championLabel.x >= row.row.x - 1 &&
            row.championLabel.right <= row.row.right + 1 &&
            row.championLabel.y >= row.row.y - 1 &&
            row.championLabel.bottom <= row.row.bottom + 1,
          name + ': desktop champion label fits its player row',
        );
      }
    }
  }
  assert.equal(
    geometry.scrollY,
    0,
    name + ': complete final result in first screen',
  );
  if (expectReplay) {
    assert.ok(
      geometry.replay?.height >= 43.9 &&
        geometry.replay.width >= 43.9 &&
        geometry.replay.font >= 18,
      name + ': replay target at least 44px',
    );
    assert.equal(
      geometry.replay.unobscured,
      true,
      name + ': replay is unobscured',
    );
    assert.ok(
      geometry.replay.y >= geometry.center.y - 1 &&
        geometry.replay.bottom <= geometry.center.bottom + 1 &&
        geometry.replay.bottom <= geometry.height + 1,
      name + ': replay fits its result area and viewport',
    );
  } else {
    assert.equal(geometry.role, 'public', name + ': read-only result role');
    assert.equal(
      geometry.replay,
      null,
      name + ': public has no replay control',
    );
    assert.equal(
      geometry.actionControlCount,
      0,
      name + ': public exposes no player action controls',
    );
  }
  if (includeMuseums)
    assert.equal(
      geometry.museums.length,
      seatCount,
      name + ': all final museums',
    );
  for (const row of [...geometry.income, ...geometry.museums]) {
    for (const [kind, element] of Object.entries(row).filter(([key]) =>
      ['portrait', 'name', 'amount'].includes(key),
    )) {
      assert.ok(
        element && element.width > 0 && element.height > 0,
        `${name}: ${row.seatId} has ${kind}`,
      );
      assert.ok(
        element.x >= -1 &&
          element.y >= -1 &&
          element.right <= geometry.width + 1 &&
          element.bottom <= geometry.height + 1,
        `${name}: ${row.seatId} ${kind} fits viewport`,
      );
      assert.ok(
        element.x >= row.row.x - 1 &&
          element.right <= row.row.right + 1 &&
          element.y >= row.row.y - 1 &&
          element.bottom <= row.row.bottom + 1,
        `${name}: ${row.seatId} ${kind} fits its player card`,
      );
      assert.equal(
        element.unobscured,
        true,
        `${name}: ${row.seatId} ${kind} is unobscured`,
      );
    }
    assert.ok(
      row.portrait.width >= 24 && row.portrait.height >= 24,
      name + ': recognizable portrait size',
    );
    assert.equal(
      overlaps(row.name, row.amount),
      false,
      name + ': name and money do not overlap',
    );
    assert.equal(
      overlaps(row.portrait, row.name),
      false,
      name + ': portrait and name do not overlap',
    );
    assert.equal(
      overlaps(row.portrait, row.amount),
      false,
      name + ': portrait and money do not overlap',
    );
  }
}
async function newPhone(index, restore = false) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, options) => {
      const window = new BrowserWindow({
        show: false,
        width: 390,
        height: 844,
        webPreferences: {
          partition: 'persist:modern-art-' + options.index,
          offscreen: true,
        },
      });
      void window.loadURL(
        options.origin + (options.restore ? '/player/game' : '/player'),
      );
    },
    { origin, index, restore },
  );
  const page = await next;
  observe(page);
  await viewport(page, 390, 844, true);
  if (restore) await page.locator('.ma-wallet').waitFor();
  else {
    await page.getByRole('button', { name: '选择头像', exact: true }).click();
    const picker = page.getByRole('dialog');
    await picker.waitFor();
    const sources = await picker
      .locator('[data-avatar-id]')
      .evaluateAll((buttons) =>
        buttons.map((button) => ({
          id: button.dataset.avatarId,
          source:
            button.querySelector('img').currentSrc ||
            button.querySelector('img').src,
        })),
      );
    for (const image of sources) {
      assert.ok(image.source, image.id + ': local preset source present');
      const key = imageKey(image.source);
      if (avatarImages.has(image.id))
        assert.equal(
          avatarImages.get(image.id),
          key,
          'Same preset source across phone profiles',
        );
      else avatarImages.set(image.id, key);
    }
    await picker.locator(`[data-avatar-id="avatar-${20 + index}"]`).click();
    await picker.waitFor({ state: 'hidden' });
    await page
      .getByLabel('你的昵称')
      .fill(
        longNames
          ? index === 0
            ? 'W'.repeat(24)
            : `第${index + 1}位长昵称美术馆玩家`
          : '美术馆 ' + (index + 1),
      );
    await page.getByRole('button', { name: '加入', exact: true }).click();
    await page
      .getByRole('button', { name: '我准备好了', exact: true })
      .waitFor();
  }
  const token = await page.evaluate(() =>
    localStorage.getItem('tablemax-player'),
  );
  return { page, token, socket: await connect(token) };
}
try {
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_PORT: '0',
    TABLEMAX_HOST: '127.0.0.1',
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  env.PATH = process.env.SystemRoot + '\\system32;' + process.env.SystemRoot;
  desktop = await launchDesktop({
    executablePath,
    args: [
      '--foundation-test',
      audit ? '--tablemax-play-mode' : '--tablemax-test-mode',
    ],
    env,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  observe(host);
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  let hostSocket = await connect(hostToken);
  await capture(host, 'box-game-library', 1920, 1080);
  await host
    .locator('.game-library__item')
    .filter({ hasText: '现代艺术' })
    .getByRole('button', { name: '选择游戏', exact: true })
    .click();
  await until(
    async () => (await view(hostToken)).game?.id === 'modern-art',
    'Modern Art selection saved',
  );
  assert.equal(
    await host.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .some((entry) => /ModernArtScreen|atlas/.test(entry.name)),
    ),
    false,
    'Box must load only thumbnails',
  );
  for (let i = 0; i < humanCount; i++) phones.push(await newPhone(i));
  for (const [difficulty, name] of [
    ['doubao', '豆包美术馆'],
    ['juewu', '绝悟美术馆'],
  ].slice(0, seatCount - humanCount))
    await send(hostSocket, hostToken, { type: 'add-bot', name, difficulty });
  const initial = await view(hostToken);
  const seatAvatars = initial.seats.map(({ id, name, avatarId }) => ({
    id,
    name,
    avatarId,
  }));
  assert.equal(
    new Set(seatAvatars.map((seat) => seat.avatarId)).size,
    seatCount,
    'Every seat has a unique saved player avatar',
  );
  assert.deepEqual(
    initial.seats
      .filter((seat) => seat.controller === 'human')
      .map((seat) => seat.avatarId),
    Array.from({ length: humanCount }, (_, index) => `avatar-${20 + index}`),
    'Phone-picked generated avatars saved',
  );
  evidence.seatAvatars = seatAvatars;
  await send(hostSocket, hostToken, {
    type: 'set-owner',
    seatId: initial.seats[0].id,
  });
  await Promise.all(
    phones.map(({ page }) =>
      page.getByRole('button', { name: '我准备好了', exact: true }).click(),
    ),
  );
  await until(
    async () => (await view(hostToken)).seats.every((seat) => seat.ready),
    'Independent phone ready persisted',
  );
  await phones[0].page
    .getByRole('button', { name: '开始游戏', exact: true })
    .click();
  await Promise.all(
    [host, ...phones.map((phone) => phone.page)].map((page) =>
      page.waitForURL('**/game'),
    ),
  );
  await host.locator('.ma-screen').waitFor();
  const assetDecode = await phones[0].page.evaluate(async () => {
    const moduleUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((name) => name.endsWith('/games/modern-art/web/entry.js'));
    if (!moduleUrl) throw new Error('Modern Art client chunk missing');
    const source = await (await fetch(moduleUrl)).text();
    const atlases = [
      ...new Set(source.match(/[\w-]+-atlas-v1-[\w-]+\.webp/g) ?? []),
    ];
    for (let i = 0; i < atlases.length; i++)
      atlases[i] = new URL('./assets/' + atlases[i], moduleUrl).href;
    if (atlases.length !== 5)
      throw new Error('Five local art atlases must be bundled');
    await Promise.all(
      atlases.map(async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        if (image.naturalWidth !== 1536 || image.naturalHeight !== 1536)
          throw new Error('Unexpected atlas dimensions');
      }),
    );
    if (document.querySelector('.ma-card__art--pending'))
      throw new Error('Card image fallback present');
    return atlases;
  });
  evidence.decodedAtlases = assetDecode;
  await send(hostSocket, hostToken, { type: 'pause' });
  const nextPublic = desktop.waitForEvent('window');
  await desktop.request('open-public', { path: '/public/game' });
  publicPage = await nextPublic;
  observe(publicPage);
  await publicPage.locator('.ma-screen').waitFor();
  if (audit) {
    await installMediaProbe(host);
    await installMediaProbe(publicPage);
  }
  await verifyPortraits(host, 'host-initial-museums', initial.seats, [
    'museum',
  ]);
  await verifyPortraits(publicPage, 'public-initial-museums', initial.seats, [
    'museum',
  ]);
  assert.equal((await view(hostToken)).actions.length, 0);
  assert.equal((await view()).gameView.self, null);
  assert.ok(
    Object.values((await view()).gameView.players).every(
      (player) => player.cash === null,
    ),
  );
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
    [2560, 1440],
    [3840, 2160],
  ])
    await capture(host, `host-${width}`, width, height);
  await capture(publicPage, 'public-1080p', 1920, 1080);
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
  ])
    await capture(phones[0].page, `phone-${width}`, width, height, true);
  await viewport(host, 1280, 900);
  await viewport(phones[0].page, 390, 844, true);
  await host.getByRole('button', { name: '菜单', exact: true }).click();
  await host.getByRole('dialog').waitFor();
  await capture(host, 'management-paused');
  await host.keyboard.press('Escape');
  const started = await view(hostToken);
  if (audit) await basicsAudit(hostSocket);
  await send(phones[0].socket, phones[0].token, { type: 'resume' });
  if (audit) {
    const sound = publicPage.locator('[data-modern-art-sound="true"]');
    if ((await sound.getAttribute('aria-pressed')) === 'true')
      await sound.click();
    await sound.click();
    await until(
      async () => (await sound.getAttribute('aria-pressed')) === 'true',
      'Public ordinary audio enabled by real gesture',
    );
  }
  const seenPhases = new Set();
  const seenActions = new Set();
  const requiredActions = [
    'offer',
    'add-double',
    'decline-double',
    'bid',
    'pass',
    'sealed-bid',
    'set-price',
    'buy',
  ];
  const end = Date.now() + (audit ? 600000 : 180000);
  let lastProgress = Date.now();
  let steps = 0;
  while (Date.now() < end) {
    const current = await view(hostToken);
    publicAccounting(current.gameView);
    if (audit && Date.now() - lastProgress >= 30000) {
      console.log(
        JSON.stringify({
          progress: true,
          round: current.gameView.round,
          phase: current.gameView.auction?.kind ?? current.gameView.phase,
          steps,
        }),
      );
      lastProgress = Date.now();
    }
    assert.equal(current.botError, null);
    if (current.status === 'ended') break;
    if (current.lifecycleActions.length) {
      const round = current.gameView.round;
      if (audit) {
        await capture(host, `round-${round}-income-720`, 1280, 720);
        await capture(
          phones[0].page,
          `round-${round}-income-320`,
          320,
          568,
          true,
        );
        await projectionAudit(`round-${round}-income`);
        const next = phones[0].page.getByRole('button', {
          name: '开始下一轮',
          exact: true,
        });
        await next.scrollIntoViewIfNeeded();
        await controlGeometry(next, `round-${round}-next`);
      }
      await phones[0].page
        .getByRole('button', { name: '开始下一轮', exact: true })
        .click();
      await until(
        async () => (await view(hostToken)).gameView.round === round + 1,
        'Phone owner next round saved',
      );
      continue;
    }
    const game = current.gameView;
    const phase = game.phase === 'auction' ? game.auction.kind : game.phase;
    if (!seenPhases.has(phase)) {
      // Pause first so screenshots and UI checks represent one durable state.
      await send(hostSocket, hostToken, { type: 'pause' });
      const pausedGame = (await view(hostToken)).gameView;
      const savedPhase =
        pausedGame.phase === 'auction'
          ? pausedGame.auction.kind
          : pausedGame.phase;
      seenPhases.add(savedPhase);
      await capture(host, 'phase-' + savedPhase);
      await capture(phones[0].page, 'phone-phase-' + savedPhase);
      if (audit) await projectionAudit('phase-' + savedPhase);
      await send(hostSocket, hostToken, { type: 'resume' });
      if (savedPhase === 'open')
        await capture(publicPage, 'tabletop-active', 1920, 1080);
    }
    if (audit && phase === 'open') await openAudit();
    let acted = false;
    for (const phone of phones) {
      let player = await view(phone.token);
      if (!player.actions.length || player.paused) continue;
      const own = player.gameView;
      failurePhone = phone.page;
      let action;
      if (own.phase === 'offer') {
        const needsDoubleControl =
          !seenActions.has('add-double') || !seenActions.has('decline-double');
        const missing =
          (audit
            ? ['once', 'fixed', 'sealed', 'open', 'double'].flatMap((kind) =>
                own.self.hand.filter(
                  (card) => card.auctionKind === kind && !seenPhases.has(kind),
                ),
              )[0]
            : own.self.hand.find(
                (card) => !seenPhases.has(card.auctionKind),
              )) ??
          (needsDoubleControl
            ? own.self.hand.find((card) => card.auctionKind === 'double')
            : undefined);
        action = player.actions.find(
          (action) => action.type === 'offer' && action.cardId === missing?.id,
        );
      }
      action ??= (
        await bot.decide({
          view: own,
          actions: player.actions,
          decision: { id: player.decisionId, seatId: player.self.seatId },
          memory: null,
          difficulty: 'doubao',
          random: { next: () => 0.31 },
          signal: new AbortController().signal,
        })
      ).action;
      const untested = player.actions.find(
        (entry) =>
          requiredActions.includes(entry.type) &&
          !seenActions.has(entry.type) &&
          entry.type !== 'offer',
      );
      if (untested) action = untested;
      // Exercise each available phone control once; later actions use the same authorized socket path.
      const activePhase =
        player.gameView.auction?.kind ?? player.gameView.phase;
      const controlKey = activePhase + ':' + action.type;
      if (
        (!seenActions.has(action.type) ||
          (audit && !probedControls.has(controlKey))) &&
        [
          'offer',
          'add-double',
          'bid',
          'sealed-bid',
          'set-price',
          'buy',
          'pass',
          'decline-double',
        ].includes(action.type)
      ) {
        // Stop an already scheduled fast bot, then resume at the ordinary 1.8s pace.
        await send(hostSocket, hostToken, { type: 'pause' });
        await send(hostSocket, hostToken, {
          type: 'set-play-mode',
          mode: 'play',
        });
        await send(hostSocket, hostToken, { type: 'resume' });
        player = await view(phone.token);
        if (
          !player.actions.some(
            (entry) => JSON.stringify(entry) === JSON.stringify(action),
          )
        )
          continue;
        if (audit) {
          await viewport(phone.page, 320, 568, true);
          if ('amount' in action) {
            await amountAudit(phone, player, action);
            if (action.type === 'sealed-bid') await sealedAudit(phone, player);
            player = await view(phone.token);
            if (
              !player.actions.some(
                (entry) => JSON.stringify(entry) === JSON.stringify(action),
              )
            )
              continue;
          }
        }
        const afterLog = Number(player.gameView.latest?.id.slice(4) ?? 0);
        const seat = player.self.seatId;
        const verb =
          {
            'add-double': 'double-add',
            'decline-double': 'double-decline',
            'sealed-bid': 'sealed-submit',
            buy: 'sale',
          }[action.type] ?? action.type;
        if ('amount' in action)
          await phone.page
            .locator('input[type="number"]')
            .fill(String(action.amount));
        const button =
          'cardId' in action
            ? phone.page.locator(`.ma-hand [data-card-id="${action.cardId}"]`)
            : phone.page.locator(`[data-ma-action="${action.type}"]`);
        if (audit) {
          await button.first().scrollIntoViewIfNeeded();
          await capture(phone.page, `ui-${controlKey}-320-before`);
          await controlGeometry(button.first(), controlKey);
        }
        await button.first().click();
        await until(
          async () =>
            (await view(phone.token)).gameView.history.some(
              (log) =>
                Number(log.id.slice(4)) > afterLog &&
                log.verb === verb &&
                (action.type === 'buy'
                  ? log.winner === seat
                  : log.actor === seat) &&
                (!('cardId' in action) ||
                  log.cards.some((card) => card.id === action.cardId)) &&
                (!('amount' in action) ||
                  action.type === 'sealed-bid' ||
                  log.amount === action.amount),
            ),
          'Specific phone UI action saved: ' + action.type,
        );
        seenActions.add(action.type);
        probedControls.add(controlKey);
        if (audit) {
          const feedback = await phone.page.evaluate(() => ({
            playMode: document.querySelector('.ma-screen')?.dataset.playMode,
            savedClass: document
              .querySelector('.ma-screen')
              ?.classList.contains('ma-saved'),
            runningAnimations: document
              .getAnimations()
              .filter((animation) => animation.playState === 'running').length,
            savedText:
              document.querySelector('.ma-latest')?.textContent.trim() ?? null,
            activeButtons: [
              ...document.querySelectorAll(
                '.ma-controls button:not(:disabled),.ma-hand button:not(:disabled)',
              ),
            ]
              .map((element) => {
                const r = element.getBoundingClientRect();
                const top = document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                );
                return {
                  action: element.dataset.maAction,
                  visible: r.y >= 0 && r.bottom <= innerHeight,
                  unobscured: Boolean(
                    top && (element === top || element.contains(top)),
                  ),
                };
              })
              .filter((entry) => entry.visible),
          }));
          evidence.liveFeedbackAudit.push({ controlKey, ...feedback });
          assert.equal(feedback.playMode, 'play');
          assert.ok(
            feedback.activeButtons.every((entry) => entry.unobscured),
            'Saved feedback never blocks visible next controls',
          );
          await motionClickAudit();
          await capture(phone.page, `ui-${controlKey}-320-saved`);
        } else
          await send(hostSocket, hostToken, {
            type: 'set-play-mode',
            mode: 'test',
          });
      } else
        await send(phone.socket, phone.token, {
          type: 'game',
          decisionId: player.decisionId,
          action,
        });
      steps++;
      evidence.steps = steps;
      evidence.actions = [...seenActions];
      evidence.phases = [...seenPhases];
      acted = true;
      break;
    }
    if (!acted) await sleep(80);
  }
  const result = await view(hostToken);
  publicAccounting(result.gameView);
  assert.deepEqual(
    result.seats.map(({ id, name, avatarId }) => ({ id, name, avatarId })),
    seatAvatars,
    'Match keeps selected avatars',
  );
  assert.equal(result.status, 'ended', 'Full four-round match completed');
  assert.equal(result.gameView.phase, 'ended');
  assert.equal(result.gameView.round, 4, 'All four rounds completed');
  // Retain the complete trace even when a random deal misses a required UI branch.
  evidence.phases = [...seenPhases];
  evidence.actions = [...seenActions];
  evidence.steps = steps;
  evidence.finalRound = result.gameView.round;
  for (const phase of ['open', 'once', 'sealed', 'fixed', 'double'])
    assert.ok(seenPhases.has(phase), 'Auction phase covered: ' + phase);
  for (const action of requiredActions)
    assert.ok(
      seenActions.has(action),
      'Actual phone control covered: ' + action,
    );
  assert.ok(result.gameView.winners.length);
  assert.equal(Object.keys(result.gameView.finalCash).length, seatCount);
  if (audit) {
    assert.equal(accountedRounds.size, 4);
    assert.deepEqual(
      Object.fromEntries(ledger),
      result.gameView.finalCash,
      'Independent public sale/income ledger explains final assets',
    );
    const largest = Math.max(...ledger.values());
    assert.deepEqual(
      result.gameView.winners.toSorted(),
      [...ledger]
        .filter(([, cash]) => cash === largest)
        .map(([seat]) => seat)
        .toSorted(),
    );
    assert.equal(
      sealedConcurrent,
      humanCount === 3,
      'Three-phone run includes actual concurrent sealed submissions',
    );
    assert.equal(
      openConfirmation,
      true,
      'Open auction stale confirmation covered',
    );
    await projectionAudit('natural-final-assets');
    evidence.mediaAudit = await Promise.all(
      [host, publicPage].map(async (page) => ({
        role: page === host ? 'host' : 'public',
        calls: await page.evaluate(() => window.maAudioProbe),
      })),
    );
    assert.ok(
      evidence.mediaAudit.some((role) =>
        role.calls.some((call) => call.playing && call.volume > 0),
      ),
      'Normal saved event really reaches media playing',
    );
    assert.ok(
      evidence.mediaAudit.every((role) =>
        role.calls.every((call) => call.error === null),
      ),
    );
    assert.ok(
      evidence.motionClick?.savedByRealUI,
      'An actual main operation succeeds during ordinary saved animation',
    );
    evidence.checks.push(
      'Four-round final public assets and champions match an independent sale/income ledger; ordinary saved feedback, unobscured next controls and actual onplaying observed (no human ear listening)',
    );
  }
  await capture(host, 'final-result');
  await capture(phones[0].page, 'phone-final-result');
  await verifyPortraits(host, 'host-final-identities', result.seats, [
    'result',
  ]);
  assert.equal(
    await host.locator('.ma-museum').count(),
    0,
    'Ended empty collections are not repeated beside the final identities',
  );
  await verifyPortraits(
    phones[0].page,
    'phone-final-identities',
    result.seats,
    ['result'],
  );
  await capture(host, 'final-result-1280x720', 1280, 720);
  await resultGeometry(host, 'final-result-1280x720', false, true);
  await capture(publicPage, 'final-result-public-1280x720', 1280, 720);
  await resultGeometry(
    publicPage,
    'final-result-public-1280x720',
    false,
    false,
  );
  for (const [width, height] of [
    [1920, 1080],
    [3840, 2160],
  ])
    for (const [role, page] of [
      ['host', host],
      ['public', publicPage],
    ]) {
      const label = `final-result-${role}-${width}x${height}`;
      await capture(page, label, width, height);
      await resultGeometry(page, label, false, role === 'host');
    }
  await viewport(phones[0].page, 360, 640, true);
  await phones[0].page.evaluate(() => window.scrollTo(0, 0));
  await capture(phones[0].page, 'phone-final-result-360x640', 360, 640, true);
  await capture(phones[0].page, 'phone-final-identities-360x640');
  await resultGeometry(
    phones[0].page,
    'phone-final-identities-360x640',
    false,
    true,
  );
  if (audit) {
    await viewport(phones[0].page, 320, 568, true);
    await phones[0].page.evaluate(() => scrollTo(0, 0));
    await capture(phones[0].page, 'phone-natural-final-320');
    await resultGeometry(
      phones[0].page,
      'phone-natural-final-320',
      false,
      true,
    );
  }
  await viewport(host, 1280, 900);
  await viewport(phones[0].page, 390, 844, true);
  evidence.checks.push(
    'Selected generated avatars decode and match saved avatarId in every public museum and final identity; all final name characters, assets and champions are visible on 720p/1080p/4K host and public plus 320/360 phone, with 44px unobscured first-screen authorized replay, read-only public controls absent, and no repeated empty collection or horizontal overflow',
  );
  evidence.checks.push(
    `${seatCount}-seat real Worker match, ${humanCount} private phone identities, phone owner control, public secrecy, responsive background rendering`,
  );
  // Restore a real before boundary, replay from the saved state, and preserve identities across restart.
  await send(hostSocket, hostToken, {
    type: 'rollback',
    checkpointId: result.history.at(-1).id,
  });
  const saved = await view(phones[0].token);
  assert.equal(saved.paused, true);
  const savedToken = phones[0].token;
  env.TABLEMAX_PORT = new URL(origin).port;
  for (const socket of sockets) socket.disconnect();
  await desktop.close();
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', ...(audit ? ['--tablemax-play-mode'] : [])],
    env,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  observe(host);
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  hostSocket = await connect(hostToken);
  await host.goto(origin + '/host/game');
  await host.locator('.ma-screen').waitFor();
  const restored = await view(phones[0].token);
  evidence.restoredPlayMode = restored.playMode;
  if (audit)
    assert.equal(
      restored.playMode,
      'play',
      'Audit restart remains ordinary play',
    );
  assert.equal(restored.paused, true);
  assert.deepEqual(restored.gameView, saved.gameView);
  assert.equal(restored.ownerSeatId, started.ownerSeatId);
  assert.equal(restored.self.seatId, saved.self.seatId);
  assert.deepEqual(
    restored.seats.map(({ id, name, avatarId }) => ({ id, name, avatarId })),
    seatAvatars,
    'Rollback and SQLite restart retain selected avatars',
  );
  phones[0] = await newPhone(0, true);
  failurePhone = phones[0].page;
  assert.equal(
    phones[0].token,
    savedToken,
    'Same phone profile restores its own credential',
  );
  await capture(phones[0].page, 'phone-restart-restored');
  await capture(host, 'restart-restored');
  await verifyPortraits(host, 'restart-restored-museums', restored.seats, [
    'museum',
  ]);
  if (audit) {
    for (let index = 1; index < humanCount; index++)
      phones[index] = await newPhone(index, true);
    await send(phones[0].socket, phones[0].token, { type: 'resume' });
    const recoveryDeadline = Date.now() + 90000;
    await until(
      async () => {
        const current = await view(hostToken);
        if (current.status === 'ended') return true;
        for (const phone of phones) {
          const own = await view(phone.token);
          if (!own.actions.length) continue;
          const action = (
            await bot.decide({
              view: own.gameView,
              actions: own.actions,
              decision: { id: own.decisionId, seatId: own.self.seatId },
              memory: null,
              difficulty: 'doubao',
              random: { next: () => 0.31 },
              signal: new AbortController().signal,
            })
          ).action;
          await send(phone.socket, phone.token, {
            type: 'game',
            decisionId: own.decisionId,
            action,
          });
          break;
        }
        return false;
      },
      'Real rollback/restart branch naturally ends',
      recoveryDeadline - Date.now(),
    );
    await phones[0].page.locator('.ma-next-round').click();
    await until(
      async () => (await view(hostToken)).status === 'lobby',
      'Real phone replay returns same seats to lobby',
    );
    assert.deepEqual(
      (await view(hostToken)).seats.map(({ id, name, avatarId }) => ({
        id,
        name,
        avatarId,
      })),
      seatAvatars,
    );
    await capture(phones[0].page, 'phone-actual-replay-lobby', 320, 568, true);
  } else await send(hostSocket, hostToken, { type: 'end' });
  await host.evaluate(() => {
    window.modernArtSwitchDocument = true;
  });
  const identities = (await view(hostToken)).seats.map((seat) => seat.id);
  await send(hostSocket, hostToken, {
    type: 'select-game',
    gameId: 'pokemon-encounters',
  });
  for (const phone of phones)
    await send(await connect(phone.token), phone.token, {
      type: 'ready',
      ready: true,
    });
  await send(hostSocket, hostToken, { type: 'start' });
  await host.locator('.pokemon-screen').waitFor();
  await send(hostSocket, hostToken, { type: 'pause' });
  await send(hostSocket, hostToken, { type: 'end' });
  await send(hostSocket, hostToken, {
    type: 'select-game',
    gameId: 'modern-art',
  });
  for (const phone of phones)
    await send(await connect(phone.token), phone.token, {
      type: 'ready',
      ready: true,
    });
  await send(hostSocket, hostToken, { type: 'start' });
  await host.locator('.ma-screen').waitFor();
  await send(hostSocket, hostToken, { type: 'pause' });
  assert.equal(
    await host.evaluate(() => window.modernArtSwitchDocument),
    true,
    'Switch reuses the same SPA document',
  );
  const styles = await host.evaluate(() =>
    [...document.styleSheets].map((sheet) => sheet.href ?? ''),
  );
  assert.ok(
    styles.some(
      (url) =>
        url.includes('/games/pokemon-encounters/web/') && url.endsWith('.css'),
    ) &&
      styles.some(
        (url) => url.includes('/games/modern-art/web/') && url.endsWith('.css'),
      ),
    'Both game stylesheets coexist after switching',
  );
  evidence.coexistingStyles = styles;
  assert.deepEqual(
    (await view(hostToken)).seats.map((seat) => seat.id),
    identities,
  );
  const switched = await view(hostToken);
  assert.deepEqual(
    switched.seats.map(({ id, name, avatarId }) => ({ id, name, avatarId })),
    seatAvatars,
    'Both game switches retain selected avatars',
  );
  await verifyPortraits(host, 'game-switch-restored-museums', switched.seats, [
    'museum',
  ]);
  assert.ok(
    !(
      await host
        .locator('.ma-screen')
        .evaluate((element) => getComputedStyle(element).backgroundImage)
    ).includes('garden-table'),
  );
  await capture(host, 'game-switch-isolation');
  if (audit) {
    await viewport(phones[0].page, 320, 568, true);
    await capture(phones[0].page, 'switch-paused-phone-320');
    assert.equal(await phones[0].page.locator('.ma-waiting').count(), 0);
    const page = phones[0].page;
    const cdp = metricsSessions.get(page);
    phones[0].socket.disconnect();
    await cdp.send('Network.enable');
    expectedOfflinePages.add(page);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await until(
      async () => (await page.locator('.game-loading').count()) === 1,
      'Real phone WebSocket loss removes stale interactive projection',
    );
    assert.match(
      await page.locator('.game-loading [role="status"]').innerText(),
      /正在重新连接本地服务/,
    );
    assert.equal(await page.locator('.ma-screen').count(), 0);
    assert.equal(
      await page.locator('[data-ma-action]:not(:disabled)').count(),
      0,
    );
    await writeFile(
      join(output, 'phone-actual-offline-320.png'),
      await page.screenshot({ fullPage: false }),
    );
    evidence.screenshots.push('phone-actual-offline-320.png');
    evidence.offlineLayout = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      waiting: document
        .querySelector('.game-loading [role="status"]')
        .textContent.trim(),
      staleGameScreens: document.querySelectorAll('.ma-screen').length,
      staleActions: document.querySelectorAll('[data-ma-action]:not(:disabled)')
        .length,
    }));
    assert.equal(evidence.offlineLayout.width, 320);
    assert.equal(evidence.offlineLayout.height, 568);
    assert.ok(
      evidence.offlineLayout.scrollWidth <= 322,
      'Shared reconnect page does not overflow',
    );
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await page.locator('.ma-wallet').waitFor();
    expectedOfflinePages.delete(page);
    phones[0].socket = await connect(phones[0].token);
    assert.equal((await view(phones[0].token)).self.seatId, saved.self.seatId);
    await capture(page, 'phone-actual-reconnected-paused-320');
    evidence.checks.push(
      'Actual phone network loss clears stale actions and shows reconnect waiting; same credential/seat restores with real network recovery',
    );
    await send(hostSocket, hostToken, { type: 'resume' });
    await capture(phones[0].page, 'switch-resumed-phone-320');
    await send(hostSocket, hostToken, { type: 'end' });
    await phones[0].page
      .getByRole('button', { name: '再玩一局', exact: true })
      .waitFor();
    await capture(phones[0].page, 'administrator-early-end-phone-320');
    assert.equal(
      await phones[0].page.locator('.ma-waiting').count(),
      0,
      'Ended snapshot never claims someone is acting',
    );
    assert.equal(
      await phones[0].page.locator('[data-ma-action]:not(:disabled)').count(),
      0,
    );
    assert.match(
      await phones[0].page.locator('.ma-auction').innerText(),
      /游戏已结束/,
    );
    const replay = phones[0].page.getByRole('button', {
      name: '再玩一局',
      exact: true,
    });
    await replay.click();
    await until(
      async () => (await view(hostToken)).status === 'lobby',
      'Administrator-ended game retains authorized replay',
    );
  }
  evidence.checks.push(
    `Rollback plus SQLite restart preserves secrets and phone owner; Pokemon/Modern Art switching preserves all ${seatCount} identities and isolates CSS`,
  );
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  if (audit) {
    assert.deepEqual(
      evidence.consoleErrors.filter((error) => !error.expectedNetworkOutage),
      [],
      'No unexpected browser console errors',
    );
    assert.deepEqual(
      evidence.requestFailures.filter(
        (error) =>
          !error.expectedNetworkOutage && !error.expectedMediaCancellation,
      ),
      [],
      'No unexpected request failures',
    );
  }
  evidence.result = 'passed';
  evidence.finishedAt = new Date().toISOString();
  console.log(
    JSON.stringify({
      checks: evidence.checks,
      phases: evidence.phases,
      actions: evidence.actions,
      steps,
      screenshots: evidence.screenshots.length,
      output,
    }),
  );
} catch (error) {
  evidence.result = 'failed';
  evidence.failure = { message: error.message, stack: error.stack };
  evidence.finishedAt = new Date().toISOString();
  if (audit && desktop) {
    try {
      const current = await view(hostToken);
      evidence.failureState = {
        status: current.status,
        paused: current.paused,
        playMode: current.playMode,
        round: current.gameView?.round,
        phase: current.gameView?.phase,
        auction: current.gameView?.auction?.kind,
        seats: current.seats.map(({ id, name, controller }) => ({
          id,
          name,
          controller,
        })),
      };
      const failureMedia = await Promise.all(
        [host, publicPage]
          .filter(Boolean)
          .filter((page) => !page.isClosed())
          .map(async (page) => ({
            role: page === host ? 'host' : 'public',
            calls: await page.evaluate(() => window.maAudioProbe ?? []),
          })),
      );
      if (evidence.mediaAudit) evidence.failureMediaAudit = failureMedia;
      else evidence.mediaAudit = failureMedia;
    } catch (captureError) {
      evidence.failureStateError = captureError.message;
    }
    evidence.failureScreenshots = [];
    for (const [label, page] of [
      ['failure-host', host],
      ['failure-phone', failurePhone ?? phones[0]?.page],
    ]) {
      if (!page || page.isClosed()) continue;
      try {
        await capture(page, label);
        evidence.failureScreenshots.push(label + '.png');
      } catch (captureError) {
        evidence.failureScreenshots.push({
          label,
          error: captureError.message,
        });
      }
    }
  }
  throw error;
} finally {
  for (const socket of sockets) socket.disconnect();
  if (desktop) await desktop.close();
  evidence.ownedDesktopClosed = true;
  if (origin) {
    try {
      await fetch(origin + '/api/session/view', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      evidence.serviceReachableAfterClose = true;
    } catch {
      evidence.serviceReachableAfterClose = false;
    }
  }
  evidence.elapsedSeconds =
    Math.round((performance.now() - verificationStarted) / 10) / 100;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
}
