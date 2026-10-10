import {
  captureMatrixScreenshot,
  browserScreenshotMetrics,
} from '../../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  desktopExecutable,
  launchDesktop,
} from '../../support/desktop-test.mjs';
import { verificationOutput } from '../../support/verification-output.mjs';

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const scaleOnly = process.argv.includes('--scale-only');
const shortOnly = process.argv.includes('--short-only');
assert.ok(!(scaleOnly && shortOnly), 'Choose only one targeted subset');
const name =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  'source-empty-first';
assert.match(name, /^[a-z0-9-]{1,40}$/);
const output = verificationOutput('modern-art-audit-20261004', 'runtime', name);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/desktop-verify-'));
const source = await readFile(new URL(import.meta.url));
await writeFile(join(output, 'verifier-start-source.mjs'), source);
const started = performance.now();
const evidence = {
  workDir: work,
  portable,
  scaleOnly,
  shortOnly,
  startedAt: new Date().toISOString(),
  verifierSha256: createHash('sha256').update(source).digest('hex'),
  scope:
    'Targeted live all-human empty-collection presentation, not a natural four-round match. Only production join, ready, start, game, rollback, end, replay and resume commands; no fixtures or privileged endpoints.',
  preparations: [],
  leaderBids: [],
  layouts: [],
  screenshots: [],
  pageErrors: [],
  consoleErrors: [],
  externalRequests: [],
  closedSessions: [],
};
let executablePath = desktopExecutable;
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
      'Expand-Archive -LiteralPath $env:TABLEMAX_GALLERY_ARCHIVE -DestinationPath $env:TABLEMAX_GALLERY_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_GALLERY_ARCHIVE: archive,
        TABLEMAX_GALLERY_EXTRACT: extracted,
      },
    },
  );
  evidence.archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  executablePath = join(extracted, 'TableMax.exe');
}
let desktop, origin, host, publicPage, hostToken, hostSocket;
const sockets = [];
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
async function save() {
  evidence.elapsedSeconds =
    Math.round((performance.now() - started) / 10) / 100;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
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
async function connect(token) {
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: { token },
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    socket.once('room:view', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function command(socket, token, command) {
  const current = await view(token);
  const reply = await new Promise((done, reject) =>
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: randomUUID(),
        instanceId: current.instanceId,
        revision: current.revision,
        branch: current.branch,
        command,
      },
      (error, result) => (error ? reject(error) : done(result)),
    ),
  );
  assert.equal(reply.ok, true, JSON.stringify(reply));
}
function observe(page) {
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin)
      evidence.externalRequests.push(request.url());
  });
}
async function begin(count) {
  const dataDir = join(work, `data-${count}`);
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_PORT: '0',
    TABLEMAX_HOST: '127.0.0.1',
    PATH: process.env.SystemRoot + '\\system32;' + process.env.SystemRoot,
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test', '--tablemax-play-mode'],
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
  await command(hostSocket, hostToken, {
    type: 'select-game',
    gameId: 'modern-art',
  });
  const players = [];
  for (let index = 0; index < count; index++) {
    const result = await (
      await fetch(origin + '/api/session/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name:
            index === 0
              ? 'W'.repeat(24)
              : 'W'.repeat(22) + String(index + 1).padStart(2, '0'),
          avatarId: `avatar-${20 + index}`,
        }),
      })
    ).json();
    assert.equal(result.ok, true);
    players.push({ token: result.token, socket: await connect(result.token) });
  }
  return players;
}
async function readyStart(players) {
  for (const player of players)
    await command(player.socket, player.token, { type: 'ready', ready: true });
  await command(hostSocket, hostToken, { type: 'start' });
}
async function prepare(players, count) {
  for (let attempt = 1; attempt <= 15; attempt++) {
    await readyStart(players);
    const first = await view(players[0].token);
    const hand = first.gameView.self.hand;
    const double = hand.find((card) => card.auctionKind === 'double');
    const single = hand.find((card) => card.auctionKind !== 'double');
    let appendPossible = false;
    if (double) {
      for (const player of players)
        appendPossible ||= (await view(player.token)).gameView.self.hand.some(
          (card) =>
            card.id !== double.id &&
            card.artistId === double.artistId &&
            card.auctionKind === 'once',
        );
    }
    if (double && single && appendPossible) {
      evidence.preparations.push({
        count,
        attempts: attempt,
        singleCard: single.id,
        doubleCard: double.id,
        seats: first.seats.map(({ id, name, avatarId, controller }) => ({
          id,
          name,
          avatarId,
          controller,
        })),
      });
      assert.ok(first.seats.every((seat) => seat.controller === 'human'));
      await host.goto(origin + '/host/game');
      await host.locator('.ma-screen').waitFor();
      const next = desktop.waitForEvent('window');
      await desktop.request('open-public', { path: '/public/game' });
      publicPage = await next;
      observe(publicPage);
      await publicPage.locator('.ma-screen').waitFor();
      return { single, double };
    }
    await command(hostSocket, hostToken, { type: 'end' });
    await command(hostSocket, hostToken, { type: 'replay' });
  }
  throw new Error(
    'No legal initial single/double plus same-artist append after fifteen real replays',
  );
}
async function gameAction(player, action) {
  const current = await view(player.token);
  await command(player.socket, player.token, {
    type: 'game',
    decisionId: current.decisionId,
    action,
  });
}
async function resize(page, width, height) {
  const window = await desktop.browserWindow(page);
  const density = await window.evaluate(
    (window) => window.getBounds().width / window.getContentSize()[0],
  );
  await window.evaluate(
    (window, size) => window.setContentSize(size.width, size.height),
    {
      width: Math.round(width / density),
      height: Math.round(height / density),
    },
  );
  await pause(100);
}
async function scale(page, percent) {
  await page
    .getByRole('button', { name: /^(?:视频|显示)设置$/, exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: /^(?:视频|显示)设置$/,
    exact: true,
  });
  const control = dialog.getByLabel('界面大小', { exact: true });
  const options = await control.locator('option').evaluateAll((options) =>
    options.map((option) => ({
      value: option.value,
      label: option.textContent,
    })),
  );
  const option = options.find((option) => option.label.includes(`${percent}%`));
  assert.ok(option, 'Requested display percentage is available');
  await control.selectOption(option.value);
  await page.waitForFunction(
    async (percent) =>
      (await window.tablemaxDisplay.read()).preferences.interfaceScale ===
      percent,
    percent,
  );
  const display = await page.evaluate(() => window.tablemaxDisplay.read());
  await page.keyboard.press('Escape');
  await pause(100);
  return display;
}
async function screenshot(page, name) {
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  const window = await desktop.browserWindow(page);
  assert.equal(await window.evaluate((window) => window.isVisible()), false);
  const screenshot = await captureMatrixScreenshot(
    join(output, name + '.png'),
    async () =>
      Buffer.from(
        await window.evaluate(async (window) =>
          (await window.webContents.capturePage()).toPNG().toString('base64'),
        ),
        'base64',
      ),
    await browserScreenshotMetrics(
      page,
      await window.evaluate((w) => w.webContents.getZoomFactor()),
    ),
    { state: name },
  );
  const bytes = screenshot.image;
  evidence.screenshots.push({
    name: screenshot.path,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  });
  return {
    content: await window.evaluate((window) => window.getContentSize()),
    zoom: await window.evaluate((window) => window.webContents.getZoomFactor()),
  };
}
async function geometry(page, label, requested, display, expectedCards, seats) {
  const native = await screenshot(page, label);
  const layout = await page.evaluate(() => {
    const rect = (element) => {
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
      const style = getComputedStyle(element);
      return {
        ...rect(element),
        className: element.getAttribute('class'),
        font: parseFloat(style.fontSize),
        display: style.display,
        visibility: style.visibility,
        backgroundColor: style.backgroundColor,
        visible:
          element.getClientRects().length > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.visibility !== 'collapse',
      };
    };
    const panel = (selector) => sample(document.querySelector(selector));
    const texts = [];
    const root = document.querySelector('.ma-screen');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode,
        parent = node.parentElement;
      if (
        !node.textContent.trim() ||
        !parent.getClientRects().length ||
        ['OPTION', 'STYLE', 'SCRIPT'].includes(parent.tagName)
      )
        continue;
      texts.push({ value: node.textContent.trim(), ...sample(parent) });
    }
    return {
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio,
      scrollWidth: document.documentElement.scrollWidth,
      featured: !!document.querySelector('.ma-table--featured-auction'),
      paired: !!document.querySelector('.ma-table--paired-auction'),
      market: panel('.ma-market'),
      center: panel('.ma-center'),
      museums: panel('.ma-museums'),
      latest: panel('.ma-latest'),
      footer: panel('.ma-table-footer'),
      auction: panel('.ma-auction'),
      auctionLabel: panel('.ma-auction__label'),
      paintings: panel('.ma-auction__paintings'),
      price: panel('.ma-auction__price'),
      participants: panel('.ma-auction__participants'),
      priceStatus: (() => {
        const element = document.querySelector('.ma-auction__price small');
        const range = document.createRange();
        range.selectNodeContents(element);
        return {
          ...sample(element),
          text: element.textContent,
          title: element.title,
          textBounds: rect(range),
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      })(),
      cards: [
        ...document.querySelectorAll('.ma-auction__paintings > .ma-card'),
      ].map((card) => ({
        cardId: card.dataset.cardId,
        artistId: card.dataset.artistId,
        auctionKind: card.dataset.auctionKind,
        title: card.title,
        accessibleLabel: card.getAttribute('aria-label'),
        ...sample(card),
        art: sample(card.querySelector('.ma-card__art')),
        head: sample(card.querySelector('.ma-card__head')),
        foot: sample(card.querySelector('.ma-card__foot')),
        artistMark: sample(card.querySelector('.ma-card__artist-mark')),
        artistGlyph: sample(card.querySelector('.ma-card__artist-mark svg')),
        auctionMark: sample(card.querySelector('.ma-card__auction-mark')),
        auctionGlyph: sample(card.querySelector('.ma-card__auction-mark svg')),
      })),
      portraits: [...document.querySelectorAll('.ma-museum')].map((row) => ({
        seatId: row.dataset.seatId,
        name: row.querySelector('h3').title,
        fullName: row.querySelector('.ma-museum__name').textContent,
        avatar:
          row.querySelector('img')?.complete &&
          row.querySelector('img')?.naturalWidth > 0,
        row: sample(row),
      })),
      seatNumbers: [...document.querySelectorAll('.ma-seat-number')].map(
        (element) => ({
          ...sample(element),
          seatId: element.dataset.seatId,
          number: element.textContent,
          parent: sample(element.parentElement),
          fullTitle: element.parentElement.title,
          fullText: element.parentElement.textContent,
        }),
      ),
      participantIdentities: [
        ...document.querySelectorAll('.ma-auction__participants > span'),
      ].map((element) => ({
        number: element.querySelector('.ma-auction__seat-number').textContent,
        name: element.querySelector('strong').textContent,
        title: element.title,
      })),
      texts,
      controls: [...root.querySelectorAll('button,select,.button')]
        .filter(
          (element) =>
            element.getClientRects().length &&
            getComputedStyle(element).display !== 'none',
        )
        .map((element) => {
          const bounds = sample(element);
          const hit = document.elementFromPoint(
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height / 2,
          );
          return {
            ...bounds,
            text: element.textContent,
            centerHit: hit === element || element.contains(hit),
            hitClass: hit?.getAttribute('class'),
          };
        }),
    };
  });
  const current = await view(hostToken);
  const record = {
    label,
    requested,
    display,
    native,
    layout,
    state: {
      status: current.status,
      paused: current.paused,
      mode: current.playMode,
      round: current.gameView.round,
      phase: current.gameView.phase,
      auctionKind: current.gameView.auction.kind,
      seller: current.gameView.auction.seller,
      highBidder: current.gameView.auction.highBidder,
      currentBid: current.gameView.auction.currentBid,
      latestActor: current.gameView.latest.actor,
      cardIds: current.gameView.auction.cards.map((card) => card.id),
      collectionCounts: Object.fromEntries(
        Object.entries(current.gameView.players).map(([seat, player]) => [
          seat,
          player.collection.length,
        ]),
      ),
    },
  };
  evidence.layouts.push(record);
  await save();
  assert.equal(current.status, 'playing');
  assert.equal(current.paused, false);
  assert.equal(current.playMode, 'play');
  assert.ok(
    Object.values(record.state.collectionCounts).every((count) => count === 0),
  );
  assert.equal(layout.featured, true, label + ': actual featured class');
  assert.equal(layout.cards.length, expectedCards);
  assert.ok(layout.scrollWidth <= layout.width + 1);
  const contained = (child, parent) =>
    child.x >= parent.x - 1 &&
    child.right <= parent.right + 1 &&
    child.y >= parent.y - 1 &&
    child.bottom <= parent.bottom + 1;
  const overlap = (a, b) =>
    Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
  const viewport = { x: 0, y: 0, right: layout.width, bottom: layout.height };
  for (const region of [
    layout.market,
    layout.center,
    layout.museums,
    layout.footer,
  ])
    assert.ok(contained(region, viewport), label + ': main region fits');
  const regions = [layout.market, layout.center, layout.museums, layout.footer];
  for (let i = 0; i < regions.length; i++)
    for (const other of regions.slice(i + 1))
      assert.equal(
        overlap(regions[i], other),
        false,
        label + ': main regions do not overlap',
      );
  for (const child of [
    layout.auctionLabel,
    layout.paintings,
    layout.price,
    layout.participants,
  ]) {
    assert.ok(
      contained(child, layout.auction),
      label + ': auction component fits',
    );
    assert.ok(
      contained(child, viewport),
      label + ': visible auction content fits',
    );
    assert.equal(
      overlap(child, layout.market),
      false,
      label + ': visible auction content does not cover market',
    );
  }
  if (record.state.highBidder) {
    const status =
      String(current.gameView.seatOrder.indexOf(record.state.highBidder) + 1) +
      ' ' +
      seats.find((seat) => seat.id === record.state.highBidder).name +
      ' 领拍';
    assert.equal(layout.priceStatus.text, status);
    assert.equal(layout.priceStatus.title, status);
    assert.ok(contained(layout.priceStatus, layout.price));
    assert.ok(contained(layout.priceStatus.textBounds, layout.price));
    assert.ok(
      layout.priceStatus.scrollHeight <= layout.priceStatus.clientHeight + 1,
      label + ': full leader nickname is not vertically clipped',
    );
  }
  assert.equal(
    overlap(layout.paintings, layout.price),
    false,
    label + ': art does not cover price',
  );
  assert.equal(
    overlap(layout.paintings, layout.participants),
    false,
    label + ': art does not cover participants',
  );
  for (const card of layout.cards) {
    assert.ok(contained(card, layout.paintings), label + ': card fits column');
    assert.equal(card.art.visible, true);
    assert.equal(card.foot.visible, true);
    for (const child of [card.art, card.head, card.foot].filter(
      (child) => child.visible,
    ))
      assert.ok(contained(child, card), label + ': image and labels fit card');
    if (card.head.visible) assert.equal(overlap(card.head, card.art), false);
    assert.equal(overlap(card.foot, card.art), false);
    assert.ok(card.art.width > 0 && card.art.height > 0);
    for (const [mark, glyph] of [
      [card.artistMark, card.artistGlyph],
      [card.auctionMark, card.auctionGlyph],
    ]) {
      assert.equal(mark.visible, true, label + ': visible card identity mark');
      assert.equal(
        glyph.visible,
        true,
        label + ': visible card identity glyph',
      );
      assert.ok(contained(mark, card.head));
      assert.equal(
        overlap(mark, card.art),
        false,
        label + ': marks do not cover painting',
      );
      assert.ok(contained(glyph, mark));
      assert.ok(glyph.width >= 15.99 && glyph.height >= 15.99);
    }
    assert.equal(overlap(card.artistMark, card.auctionMark), false);
    const face = current.gameView.auction.cards.find(
      (face) => face.id === card.cardId,
    );
    assert.ok(face, label + ': saved public card matches rendered card');
    assert.equal(card.artistId, face.artistId);
    assert.equal(card.auctionKind, face.auctionKind);
    const artist = current.gameView.artists.find(
      (artist) => artist.id === face.artistId,
    );
    for (const description of [card.title, card.accessibleLabel]) {
      assert.ok(description.includes(artist.name));
      assert.ok(description.includes(face.title));
      assert.ok(
        description.includes(
          {
            open: '公开竞价',
            once: '一次出价',
            sealed: '暗标拍卖',
            fixed: '一口价',
            double: '双重拍卖',
          }[face.auctionKind],
        ),
      );
    }
  }
  if (layout.cards.length === 2)
    assert.equal(overlap(layout.cards[0], layout.cards[1]), false);
  assert.equal(layout.portraits.length, seats.length);
  for (const identity of layout.portraits) {
    assert.equal(
      identity.name,
      seats.find((seat) => seat.id === identity.seatId).name,
    );
    assert.equal(identity.fullName, identity.name);
    assert.equal(identity.avatar, true);
  }
  const order = current.gameView.seatOrder;
  for (const number of layout.seatNumbers) {
    assert.equal(number.visible, true);
    assert.equal(number.number, String(order.indexOf(number.seatId) + 1));
    assert.ok(order.includes(number.seatId));
    assert.ok(number.font >= 18);
    assert.ok(contained(number, number.parent));
    assert.ok(contained(number, viewport));
    assert.ok(
      number.fullTitle.includes(
        seats.find((seat) => seat.id === number.seatId).name,
      ),
    );
    assert.ok(
      number.fullText.includes(
        seats.find((seat) => seat.id === number.seatId).name,
      ),
    );
  }
  for (const [className, seatId] of [
    ['ma-auction__seller-number', record.state.seller],
    ['ma-auction__bidder-number', record.state.highBidder],
    ['ma-latest__actor-number', record.state.latestActor],
  ]) {
    const numbers = layout.seatNumbers.filter((number) =>
      number.className.split(' ').includes(className),
    );
    assert.equal(numbers.length, order.includes(seatId) ? 1 : 0);
    if (numbers.length) assert.equal(numbers[0].seatId, seatId);
  }
  const museumNumbers = layout.seatNumbers.filter((number) =>
    number.className.split(' ').includes('ma-museum__seat-number'),
  );
  assert.deepEqual(
    museumNumbers.map((number) => number.seatId),
    order,
  );
  assert.equal(layout.participantIdentities.length, order.length);
  for (const [index, identity] of layout.participantIdentities.entries()) {
    const name = seats.find((seat) => seat.id === order[index]).name;
    assert.equal(identity.number, String(index + 1));
    assert.equal(identity.name, name);
    assert.ok(identity.title.includes(name));
  }
  for (const text of layout.texts)
    assert.ok(
      text.font >= 15.99 && text.font * native.zoom >= 15.99,
      label + ': readable information ' + text.value,
    );
  for (const control of layout.controls) {
    assert.ok(
      control.font >= 18 &&
        control.height * native.zoom >= 43.9 &&
        control.width * native.zoom >= 43.9,
      label + ': readable 44px control',
    );
    assert.equal(
      control.centerHit,
      true,
      label + ': control center is reachable',
    );
  }
  if (layout.paired && layout.width >= 701 && layout.height <= 600) {
    await page.getByRole('button', { name: '历轮估值', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '历轮估值', exact: true });
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    const after = await view(hostToken);
    assert.equal(after.revision, current.revision);
    assert.equal(after.branch, current.branch);
    record.marketHistoryInteraction = {
      opened: true,
      closed: true,
      revisionUnchanged: true,
    };
    await save();
  }
}
const sizes = [
  [1280, 720, 100],
  [1920, 1080, 100],
  [3840, 2160, 100],
  [1280, 720, 125],
  [1280, 720, 150],
  [1920, 1080, 125],
  [1920, 1080, 150],
  [3840, 2160, 125],
  [3840, 2160, 150],
];
async function matrix(count, stage, cards, seats, players) {
  if ((await view(hostToken)).gameView.auction.kind === 'once') {
    let leaderSaved = false;
    for (const player of players) {
      const current = await view(player.token);
      const bid = current.actions
        .filter((action) => action.type === 'bid' && action.amount > 0)
        .sort((a, b) => a.amount - b.amount)[0];
      if (!bid) continue;
      await gameAction(player, bid);
      const saved = await view(hostToken);
      assert.equal(saved.gameView.auction.highBidder, current.self.seatId);
      assert.equal(saved.gameView.auction.currentBid, bid.amount);
      assert.ok(saved.gameView.auction.actingSeats.length > 0);
      evidence.leaderBids.push({
        count,
        stage,
        seatId: current.self.seatId,
        name: seats.find((seat) => seat.id === current.self.seatId).name,
        amount: bid.amount,
      });
      leaderSaved = true;
      break;
    }
    assert.equal(
      leaderSaved,
      true,
      'A real acting player saved the lowest legal positive bid',
    );
  }
  for (const [width, height, percent] of sizes.filter(([width, , percent]) =>
    scaleOnly
      ? width === 3840 && percent > 100
      : !shortOnly || (width === 1280 && percent === 100),
  ))
    for (const [role, page] of [
      ['host', host],
      ['public', publicPage],
    ]) {
      await resize(page, width, height);
      const display = await scale(page, percent);
      await geometry(
        page,
        `${count}-${stage}-${role}-${width}-${percent}`,
        { width, height, percent },
        display,
        cards,
        seats,
      );
    }
}
async function stop(count) {
  for (const socket of sockets.splice(0)) socket.disconnect();
  if (desktop) {
    await desktop.close();
    desktop = null;
  }
  let serviceReachable = false;
  try {
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    serviceReachable = true;
  } catch {
    /* Native job shut down its isolated service. */
  }
  evidence.closedSessions.push({ count, nativeClosed: true, serviceReachable });
}
try {
  for (const count of [5, 4, 3]) {
    const players = await begin(count);
    const selected = await prepare(players, count);
    const seats = (await view(hostToken)).seats;
    await gameAction(players[0], { type: 'offer', cardId: selected.double.id });
    const doubleCheckpoint = (await view(hostToken)).history.at(-1).id;
    let attempts = 0;
    while (
      (await view(hostToken)).gameView.auction.cards.length < 2 &&
      attempts++ < count
    ) {
      for (const player of players) {
        const current = await view(player.token);
        const action =
          current.actions.find(
            (action) =>
              action.type === 'add-double' &&
              current.gameView.self.hand.find(
                (card) => card.id === action.cardId,
              )?.auctionKind === 'once',
          ) ??
          current.actions.find((action) => action.type === 'decline-double');
        if (action) {
          await gameAction(player, action);
          break;
        }
      }
    }
    assert.equal(
      (await view(hostToken)).gameView.auction.cards.length,
      2,
      'Double prepared by a legal same-artist append',
    );
    assert.equal((await view(hostToken)).gameView.auction.kind, 'once');
    await matrix(count, 'paired', 2, seats, players);
    await command(hostSocket, hostToken, {
      type: 'rollback',
      checkpointId: doubleCheckpoint,
    });
    assert.equal((await view(hostToken)).gameView.phase, 'offer');
    await command(hostSocket, hostToken, { type: 'resume' });
    await gameAction(players[0], { type: 'offer', cardId: selected.single.id });
    await publicPage.locator('.ma-table--featured-auction').waitFor();
    await matrix(count, 'single', 1, seats, players);
    await stop(count);
    await save();
    console.log(
      JSON.stringify({ count, passedLayouts: evidence.layouts.length }),
    );
  }
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.consoleErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  assert.equal(evidence.layouts.length, scaleOnly ? 24 : shortOnly ? 12 : 108);
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.failure = { message: error.message, stack: error.stack };
  for (const [role, page] of [
    ['host', host],
    ['public', publicPage],
  ])
    if (page && !page.isClosed())
      await screenshot(page, 'failure-' + role).catch((error) => {
        evidence.failureCaptureError = error.message;
      });
  throw error;
} finally {
  if (desktop) await stop(null);
  evidence.finishedAt = new Date().toISOString();
  await save();
  console.log(
    JSON.stringify({
      result: evidence.result,
      layouts: evidence.layouts.length,
      elapsedSeconds: evidence.elapsedSeconds,
      output,
    }),
  );
}
