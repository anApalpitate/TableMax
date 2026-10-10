import { captureBrowserScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { MAXIMUM_PACKAGE_BYTES } from '../../release/package-limits.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createServer, request } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { launchDesktop } from '../support/desktop-test.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { playerUi, playerFrame } from '../support/player-test.mjs';

const version = JSON.parse(
  await readFile(resolve('package.json'), 'utf8'),
).version;

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const evidenceName =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  'debug-20261008';
assert.match(evidenceName, /^[A-Za-z0-9_-]+$/);
const placementOnly = process.argv.includes('--placement-only');
const output = resolve(
  `artifacts/maintenance/v${version}/${evidenceName}/portable`,
  placementOnly
    ? 'placement'
    : process.argv.includes('--finals-only')
      ? 'finals'
      : process.argv.includes('--density-only')
        ? 'density'
        : process.argv.includes('--drafts-only')
          ? 'drafts'
          : process.argv.includes('--mixed-only')
            ? 'mixed'
            : process.argv.includes('--phases-only')
              ? 'phases'
              : process.argv.includes('--connection-only')
                ? 'connections'
                : 'matrix',
);
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/debug-portable-'));
const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
const manifest = JSON.parse(
  await readFile(archive.replace('.zip', '-manifest.json'), 'utf8'),
);
const report = {
  scope:
    'Actual ZIP, hidden native WebView2 and muted headless Edge; loopback HTTP/HTTPS proxies. No physical phone, external tunnel or native Windows DPI claim.',
  checks: [],
  layouts: [],
  errors: [],
  archiveSha256: createHash('sha256')
    .update(await readFile(archive))
    .digest('hex'),
};
assert.equal(report.archiveSha256, manifest.archive.sha256);
assert.ok(
  manifest.archive.bytes < MAXIMUM_PACKAGE_BYTES &&
    manifest.extractedBytes < MAXIMUM_PACKAGE_BYTES,
);
const execute = promisify(execFile);
await execute(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    'Expand-Archive -LiteralPath $env:DEBUG_ARCHIVE -DestinationPath $env:DEBUG_EXTRACT',
  ],
  {
    windowsHide: true,
    env: {
      ...process.env,
      DEBUG_ARCHIVE: archive,
      DEBUG_EXTRACT: join(work, 'portable'),
    },
  },
);
let extractedBytes = 0;
for (const file of manifest.files) {
  const bytes = await readFile(join(work, 'portable', file.path));
  assert.equal(bytes.length, file.bytes, file.path);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    file.sha256,
    file.path,
  );
  extractedBytes += bytes.length;
}
assert.equal(extractedBytes, manifest.extractedBytes);
report.extractedFiles = manifest.files.length;
report.extractedBytes = extractedBytes;
let desktop, browser, hostSocket, origin, hostToken;
const sockets = [],
  proxies = [];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function check(label) {
  report.checks.push(label);
  console.log(label);
  await save();
}
async function save() {
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2),
  );
}
async function post(path, body) {
  return (
    await fetch(origin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  ).json();
}
async function view(token = hostToken) {
  const reply = await post('/api/session/view', { token });
  assert.equal(reply.ok, true);
  return reply.view;
}
async function socket(token) {
  const client = io(origin, {
    auth: { token },
    transports: ['polling', 'websocket'],
    forceNew: true,
  });
  sockets.push(client);
  await new Promise((done, fail) => {
    client.once('connect', done);
    client.once('connect_error', fail);
  });
  return client;
}
async function command(value, token = hostToken, client = hostSocket) {
  const state = await view(token);
  const result = await client.timeout(5000).emitWithAck('room:command', {
    actionId: randomUUID(),
    instanceId: state.instanceId,
    revision: state.revision,
    branch: state.branch,
    command: value,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  return view(token);
}
async function clearRoom() {
  if ((await view()).status === 'playing') await command({ type: 'end' });
  await command({ type: 'new-room' });
}
async function player(token, url = origin, width = 1280, height = 720) {
  const context = await browser.newContext({
    viewport: { width, height },
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(
    (value) => localStorage.setItem('tablemax-player', value),
    token,
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.goto(url + '/player/game');
  return page;
}
async function rendered(page, state) {
  try {
    await playerUi(page)
      .locator(
        `[data-room-revision="${state.revision}"][data-room-instance="${state.instanceId}"][data-room-branch="${state.branch}"]`,
      )
      .waitFor({ timeout: 20000 });
  } catch (error) {
    report.renderFailure = {
      expected: {
        revision: state.revision,
        instanceId: state.instanceId,
        branch: state.branch,
      },
      actual: await playerUi(page)
        .locator('[data-room-revision]')
        .getAttribute('data-room-revision'),
      text: (await playerUi(page).locator('body').innerText()).slice(0, 200),
    };
    await captureBrowserScreenshot(page, {
      path: join(output, 'failed-render.png'),
      fullPage: true,
    });
    throw error;
  }
}
async function proxy(secure = false) {
  const behavior = { dropViews: false, offline: false, connections: 0 };
  const handle = (incoming, outgoing) => {
    if (behavior.offline && incoming.url.startsWith('/socket.io')) {
      outgoing.destroy();
      return;
    }
    if (incoming.url.startsWith('/socket.io') && !incoming.url.includes('sid='))
      behavior.connections++;
    const upstream = request(
      origin + incoming.url,
      {
        method: incoming.method,
        headers: {
          ...incoming.headers,
          host: new URL(origin).host,
          'accept-encoding': 'identity',
        },
      },
      (response) => {
        const headers = { ...response.headers };
        if (
          behavior.dropViews &&
          incoming.url.startsWith('/socket.io') &&
          incoming.method === 'GET'
        )
          delete headers['content-length'];
        outgoing.writeHead(response.statusCode, headers);
        if (
          !behavior.dropViews ||
          !incoming.url.startsWith('/socket.io') ||
          incoming.method !== 'GET'
        ) {
          response.pipe(outgoing);
          return;
        }
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          outgoing.end(
            Buffer.concat(chunks)
              .toString()
              .split('\x1e')
              .filter((packet) => !packet.startsWith('42["room:view"'))
              .join('\x1e') || '6',
          ),
        );
      },
    );
    upstream.on('error', () => outgoing.destroy());
    incoming.pipe(upstream);
  };
  let server;
  if (secure) {
    const key = join(work, 'test-key.pem'),
      cert = join(work, 'test-cert.pem');
    const config = join(work, 'test-openssl.cnf');
    await writeFile(config, '[req]\ndistinguished_name=dn\n[dn]\n');
    await execute(
      'openssl.exe',
      [
        'req',
        '-config',
        config,
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        key,
        '-out',
        cert,
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
      ],
      { windowsHide: true },
    );
    server = httpsServer(
      { key: await readFile(key), cert: await readFile(cert) },
      handle,
    );
  } else server = createServer(handle);
  server.on('upgrade', (_request, connection) => connection.destroy());
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  proxies.push(server);
  return {
    behavior,
    url: `${secure ? 'https' : 'http'}://127.0.0.1:${server.address().port}`,
  };
}
async function phases(game, variant, count, humans) {
  const module = createRequire(import.meta.url)(
    join(work, `portable/bots/${game.id}.cjs`),
  );
  const bot = module.botsByVariant?.[variant] ?? module.bot;
  const captured = new Set(),
    memories = new Map();
  const bufferDrawSeats = new Set();
  const pages = await Promise.all(humans.map((human) => player(human.token)));
  const displays = [];
  if (process.argv.includes('--expansion-only')) {
    for (const role of ['host', 'public']) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
      if (role === 'host')
        await context.addInitScript(
          (token) => sessionStorage.setItem('tablemax-host', token),
          hostToken,
        );
      const page = await context.newPage();
      page.on('pageerror', (error) => report.errors.push(error.message));
      await page.goto(`${origin}/${role}/game`);
      displays.push({ role, page });
    }
  }
  async function researchReferences(page, role) {
    const ui = role === 'player' ? playerUi(page) : page;
    await page.setViewportSize(
      role === 'player'
        ? { width: 320, height: 568 }
        : { width: 1280, height: 720 },
    );
    await ui.getByRole('button', { name: '规则', exact: true }).click();
    await ui.getByRole('button', { name: '研究任务', exact: true }).click();
    const cards = ui.locator('.expansion-rules .ex-rule-tasks [data-research]');
    assert.equal(await cards.count(), 30);
    const referenceDocument =
      role === 'player' ? await playerFrame(page) : page;
    await referenceDocument.waitForFunction(() =>
      [
        ...document.querySelectorAll('.expansion-rules .ex-rule-tasks img'),
      ].every((image) => image.complete && image.naturalWidth > 0),
    );
    for (let i = 0; i < 30; i++) {
      const card = cards.nth(i),
        id = await card.getAttribute('data-research');
      await card.scrollIntoViewIfNeeded();
      assert.ok(await card.locator('.ex-research-condition').innerText());
      assert.ok(await card.locator('.ex-research-risk').innerText());
      const facts = await card.evaluate((node) => ({
        width: node.getBoundingClientRect().width,
        overflow: node.scrollWidth - node.clientWidth,
        text: node.textContent,
        imagesReady: [...node.querySelectorAll('img')].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      }));
      assert.ok(facts.overflow <= 2, `${role}/${id} research overflow`);
      assert.equal(facts.imagesReady, true, `${role}/${id} research art`);
      await captureBrowserScreenshot(card, {
        path: join(output, `research-${id}-${role}.png`),
      });
      if (role === 'player') {
        await card.locator('h3').scrollIntoViewIfNeeded();
        await captureBrowserScreenshot(page, {
          path: join(output, `research-${id}-player-text.png`),
        });
        await card.locator('.ex-research-diagram').scrollIntoViewIfNeeded();
        await captureBrowserScreenshot(page, {
          path: join(output, `research-${id}-player-diagram.png`),
        });
      }
      report.researchReferences ??= [];
      report.researchReferences.push({ role, id, ...facts });
    }
    await ui.getByRole('button', { name: '关闭面板', exact: true }).click();
  }
  async function shortPlacement(page, state) {
    await page.setViewportSize({ width: 320, height: 568 });
    await rendered(page, state);
    await wait(80);
    const phone = await playerFrame(page);
    await phone.evaluate(() => window.scrollTo(0, 0));
    const cards = await phone
      .locator('.ex-actions .ex-target-board .card-slot')
      .evaluateAll((nodes) =>
        nodes.slice(0, 3).map((node) => {
          const rect = node.getBoundingClientRect(),
            index = node.querySelector('.slot-index')?.getBoundingClientRect();
          return {
            top: rect.top,
            bottom: Math.max(rect.bottom, index?.bottom ?? rect.bottom),
            height: rect.height,
          };
        }),
      );
    const panels = await phone
      .locator(
        '.ex-toolbar, .ex-round-banner, .ex-action-heading, .ex-held, .ex-target-heading',
      )
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect(),
            style = getComputedStyle(node);
          return {
            className: node.className,
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            minHeight: style.minHeight,
            padding: style.padding,
            margin: style.margin,
            text: node.textContent,
          };
        }),
      );
    const held = state.gameView.held;
    const context = `${state.gameView.drawSource}-${held?.ability ? 'ability' : 'ordinary'}-${held?.abilityUsed ? 'used' : 'unused'}`;
    report.shortPhoneTargetRows ??= [];
    report.shortPhoneTargetRows.push({
      count,
      phase: 'place',
      revision: state.revision,
      heldName: held?.name,
      context,
      width: 320,
      height: 568,
      cards,
      panels,
    });
    if (
      cards.length !== 3 ||
      cards.some(
        (card) => card.top < 0 || card.bottom > 568 || card.height < 44,
      )
    )
      await captureBrowserScreenshot(page, {
        path: join(output, `short-phone-target-failure-${count}.png`),
      });
    assert.equal(cards.length, 3, 'Own first target row present');
    for (const card of cards)
      assert.ok(
        card.top >= 0 && card.bottom <= 568 && card.height >= 44,
        `Complete first target row on short phone: ${JSON.stringify(card)}`,
      );
    if (!captured.has(`short-place-${context}`)) {
      captured.add(`short-place-${context}`);
      await captureBrowserScreenshot(page, {
        path: join(output, `short-place-${count}-${context}.png`),
      });
    }
  }
  async function bufferGeometry(page, phase, populatedBuffers) {
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.ex-public-buffers img')].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    const cards = await page
      .locator('.ex-public-buffers [data-pile="buffer"]')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          const name = element.querySelector('strong');
          const range = document.createRange();
          range.selectNodeContents(name);
          return {
            seat: element.getAttribute('data-seat'),
            text: element.innerText,
            x: box.x,
            y: box.y,
            right: box.right,
            bottom: box.bottom,
            fontSize: parseFloat(getComputedStyle(name).fontSize),
            nameLines: new Set(
              [...range.getClientRects()].map((line) => Math.round(line.top)),
            ).size,
            nameOverflow: name.scrollWidth - name.clientWidth,
            imagesReady: [...element.querySelectorAll('img')].every(
              (image) => image.complete && image.naturalWidth > 0,
            ),
          };
        }),
      );
    if (!cards.length) return;
    assert.equal(cards.length, 6, 'Six public buffer states remain present');
    for (const card of cards) {
      assert.ok(
        card.x >= 0 && card.y >= 0 && card.right <= 1282 && card.bottom <= 720,
        `Public buffer clipped: ${JSON.stringify(card)}`,
      );
      assert.ok(
        card.fontSize >= 16 && card.imagesReady,
        'Readable public buffer labels and loaded art',
      );
      assert.ok(
        card.nameLines <= 1 && card.nameOverflow <= 1,
        `Complete one-line buffer name: ${JSON.stringify(card)}`,
      );
    }
    const headings = await page
      .locator('.ex-player h2')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          text: element.textContent,
          title: element.getAttribute('title'),
          height: element.getBoundingClientRect().height,
        })),
      );
    for (const heading of headings) {
      assert.ok(
        heading.height <= 29,
        `Player name intrudes into cards: ${JSON.stringify(heading)}`,
      );
      if (heading.text.length >= 10)
        assert.equal(
          heading.title,
          heading.text,
          'Long player name retained in title',
        );
    }
    const boards = await page.locator('.ex-player').evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        const header = element.querySelector('header').getBoundingClientRect();
        return {
          name: element.querySelector('h2').textContent,
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          headerBottom: header.bottom,
          cards: [...element.querySelectorAll('.pokemon-board .card-slot')].map(
            (card) => {
              const rect = card.getBoundingClientRect();
              return {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
              };
            },
          ),
        };
      }),
    );
    for (const board of boards) {
      assert.ok(
        board.cards.length === 0 || board.cards.length === 9,
        'Complete nine-card board',
      );
      for (const card of board.cards)
        assert.ok(
          card.left >= board.left - 1 &&
            card.right <= board.right + 1 &&
            card.top >= board.headerBottom - 1 &&
            card.bottom <= board.bottom + 1,
          `Card intrudes into adjacent seat or heading: ${JSON.stringify({ board, card })}`,
        );
    }
    report.bufferGeometry ??= [];
    report.bufferGeometry.push({
      phase,
      populatedBuffers,
      cards,
      headings,
      boards,
    });
  }
  try {
    for (let step = 0; step < 2400; step++) {
      const views = await Promise.all(humans.map((human) => view(human.token)));
      const actor = views.findIndex((state) => state.actions.length);
      const index = actor < 0 ? 0 : actor,
        state = views[index],
        phase = state.gameView.phase,
        page = pages[index];
      const populatedBuffers = Object.values(
        state.gameView.buffersBySeat ?? {},
      ).filter(Boolean).length;
      if (
        variant === 'expansion' &&
        count === 6 &&
        populatedBuffers > 0 &&
        !captured.has(`buffer-${populatedBuffers}`)
      ) {
        captured.add(`buffer-${populatedBuffers}`);
        for (const display of displays) {
          await display.page.setViewportSize({ width: 1280, height: 720 });
          await display.page
            .locator(
              `[data-room-revision="${state.revision}"][data-room-instance="${state.instanceId}"][data-room-branch="${state.branch}"]`,
            )
            .waitFor();
          await bufferGeometry(display.page, phase, populatedBuffers);
          await captureBrowserScreenshot(display.page, {
            path: join(
              output,
              `pokemon-expansion-6-buffers-${populatedBuffers}-${display.role}-720.png`,
            ),
          });
        }
        report.populatedBufferScreens ??= [];
        report.populatedBufferScreens.push({
          count,
          phase,
          populatedBuffers,
          revision: state.revision,
        });
      }
      if (variant === 'expansion' && phase === 'place' && captured.has(phase))
        await shortPlacement(page, state);
      if (!captured.has(phase)) {
        captured.add(phase);
        await rendered(page, state);
        for (const width of [
          320, 360, 390, 430, 1023, 1024, 1280, 1920, 3840,
        ]) {
          await page.setViewportSize({
            width,
            height:
              width === 320
                ? 568
                : width === 360
                  ? 640
                  : width <= 430
                    ? 844
                    : width === 1280
                      ? 720
                      : 1080,
          });
          await wait(80);
          const overflow = await (
            await playerFrame(page)
          ).evaluate(() => document.documentElement.scrollWidth - innerWidth);
          assert.ok(
            overflow <= 2,
            `${game.id}/${phase}/${width} overflow ${overflow}`,
          );
          if (
            game.id === 'pokemon-encounters' &&
            variant === 'expansion' &&
            width === 320
          ) {
            const phone = await playerFrame(page);
            await phone.evaluate(() => window.scrollTo(0, 0));
            if (phase === 'place') await shortPlacement(page, state);
            const buttons = await (
              await playerFrame(page)
            )
              .locator('.ex-actions button, .ex-vote button')
              .evaluateAll((nodes) =>
                nodes
                  .map((node) => {
                    const rect = node.getBoundingClientRect(),
                      style = getComputedStyle(node);
                    const range = document.createRange();
                    range.selectNodeContents(node);
                    return {
                      text: node.textContent?.trim().slice(0, 80),
                      width: rect.width,
                      height: rect.height,
                      fontSize: parseFloat(style.fontSize),
                      textLines: new Set(
                        [...range.getClientRects()].map((line) =>
                          Math.round(line.top),
                        ),
                      ).size,
                      textOverflow: node.scrollWidth - node.clientWidth,
                      visible:
                        rect.width > 0 &&
                        rect.height > 0 &&
                        style.visibility !== 'hidden',
                    };
                  })
                  .filter((button) => button.visible),
              );
            for (const button of buttons) {
              assert.ok(
                button.width >= 43.5 && button.height >= 43.5,
                `${phase}/${button.text} touch area ${button.width}x${button.height}`,
              );
              assert.ok(
                button.fontSize >= 16,
                `${phase}/${button.text} button font ${button.fontSize}`,
              );
              if (button.text === '存入本人缓冲')
                assert.ok(
                  button.textLines === 1 &&
                    button.textOverflow <= 1 &&
                    button.fontSize >= 18,
                  `Complete readable buffer action label: ${JSON.stringify(button)}`,
                );
            }
            report.actionGeometry ??= [];
            report.actionGeometry.push({ count, phase, width, buttons });
          }
          if (width === 1280 || width === 320)
            await captureBrowserScreenshot(page, {
              path: join(
                output,
                `${game.id}-${variant ?? 'default'}-${count}-${phase}${width === 320 ? '-phone' : ''}.png`,
              ),
              fullPage: true,
            });
          report.layouts.push({
            game: game.id,
            variant,
            count,
            phase,
            width,
            overflow,
          });
        }
        for (const display of displays) {
          const projection = await view(
            display.role === 'host' ? hostToken : undefined,
          );
          await display.page
            .locator(
              `[data-room-revision="${projection.revision}"][data-room-instance="${projection.instanceId}"][data-room-branch="${projection.branch}"]`,
            )
            .waitFor();
          for (const size of [
            [1280, 720],
            [1920, 1080],
            [3840, 2160],
          ]) {
            await display.page.setViewportSize({
              width: size[0],
              height: size[1],
            });
            await wait(80);
            const overflow = await display.page.evaluate(
              () => document.documentElement.scrollWidth - innerWidth,
            );
            assert.ok(
              overflow <= 2,
              `${display.role}/${phase}/${size[0]} overflow ${overflow}`,
            );
            if (variant === 'expansion' && count === 6 && size[0] === 1280)
              await bufferGeometry(display.page, phase, populatedBuffers);
            await captureBrowserScreenshot(display.page, {
              path: join(
                output,
                `${game.id}-${variant}-${count}-${phase}-${display.role}-${size[0]}.png`,
              ),
              fullPage: true,
            });
            if (size[0] === 1280)
              await captureBrowserScreenshot(display.page, {
                path: join(
                  output,
                  `${game.id}-${variant}-${count}-${phase}-${display.role}-720-viewport.png`,
                ),
              });
            report.layouts.push({
              game: game.id,
              variant,
              count,
              phase,
              role: display.role,
              width: size[0],
              height: size[1],
              overflow,
              renderer:
                'Actual packaged webpage in headless browser; CSS geometry simulation',
            });
          }
        }
        await page.setViewportSize({ width: 1280, height: 720 });
        if (
          phase === 'research-vote' &&
          count === 2 &&
          process.argv.includes('--expansion-only')
        ) {
          await researchReferences(page, 'player');
          await researchReferences(
            displays.find((display) => display.role === 'host').page,
            'host',
          );
          await page.setViewportSize({ width: 1280, height: 720 });
        }
        if (game.id === 'power-grid' && phase === 'building') {
          const city = playerUi(page).getByRole('combobox', {
            name: '选择城市',
            exact: true,
          });
          const option = await city
            .locator('option')
            .nth(1)
            .getAttribute('value');
          await city.selectOption(option);
          await page.setViewportSize({ width: 1023, height: 768 });
          await page.setViewportSize({ width: 1024, height: 768 });
          assert.equal(await city.inputValue(), option);
          await check('Power Grid city target draft retained across 1023/1024');
          if (process.argv.includes('--drafts-only')) return;
        }
        if (
          game.id === 'pokemon-encounters' &&
          ['initial-flip', 'place', 'mew-other', 'mew-self'].includes(phase)
        ) {
          const slot = playerUi(page)
            .locator('button.card-slot:enabled:visible')
            .first();
          if (await slot.count()) {
            const before = state.revision;
            await slot.click();
            await page.setViewportSize({ width: 1023, height: 768 });
            await page.setViewportSize({ width: 1024, height: 768 });
            assert.equal(await slot.getAttribute('aria-pressed'), 'true');
            assert.equal((await view(humans[index].token)).revision, before);
            await check(
              `${game.id}/${phase}: slot draft retained without committing an action`,
            );
            await slot.click();
            if (process.argv.includes('--drafts-only') && phase === 'place')
              return;
          }
        }
        const number = playerUi(page)
          .locator('input[type="number"]:visible')
          .first();
        if (await number.count()) {
          const prior = await number.inputValue();
          await number.fill('7');
          const accepted = await number.inputValue();
          await page.setViewportSize({ width: 1023, height: 768 });
          await page.setViewportSize({ width: 1024, height: 768 });
          assert.equal(await number.inputValue(), accepted);
          await number.fill(prior);
          await check(
            `${game.id}/${phase}: number draft retained across 1023/1024`,
          );
        }
        await check(
          `${game.id}/${variant ?? 'default'} ${count} seats: ${phase} authorized actor layout`,
        );
        if (placementOnly && phase === 'place') return;
      }
      if (phase === 'round-result' && process.argv.includes('--finals-only')) {
        const controls = await view();
        assert.ok(controls.lifecycleActions.length, 'No authorized next round');
        await command({
          type: 'lifecycle',
          action: controls.lifecycleActions[0],
        });
        continue;
      }
      if (
        ['ended', 'round-result', 'match-result'].includes(phase) ||
        state.status === 'ended'
      ) {
        if (variant === 'expansion' && count === 6)
          assert.ok(
            captured.has('buffer-6'),
            'All six occupied buffers captured through legal actions',
          );
        return;
      }
      assert.ok(actor >= 0, `No legal decision ${game.id}/${phase}`);
      const human = humans[actor];
      const fillBuffer =
        variant === 'expansion' && count === 6 && populatedBuffers < 6
          ? (state.actions.find((action) => action.type === 'store-buffer') ??
            state.actions.find(
              (action) => action.type === 'draw' && action.source === 'deck',
            ))
          : null;
      const chosen = fillBuffer
        ? { action: fillBuffer, memory: memories.get(human.token) ?? null }
        : await bot.decide({
            view: state.gameView,
            actions: state.actions,
            decision: { id: state.decisionId, seatId: state.self.seatId },
            memory: memories.get(human.token) ?? null,
            difficulty: 'default',
            random: { next: Math.random },
            signal: new AbortController().signal,
          });
      if (
        variant === 'expansion' &&
        count === 6 &&
        captured.has('buffer-6') &&
        !bufferDrawSeats.has(actor)
      ) {
        const draw = state.actions.find(
          (action) => action.type === 'draw-buffer',
        );
        if (draw) {
          chosen.action = draw;
          chosen.memory = memories.get(human.token) ?? null;
          bufferDrawSeats.add(actor);
        }
      }
      memories.set(human.token, chosen.memory);
      await command(
        { type: 'game', decisionId: state.decisionId, action: chosen.action },
        human.token,
        human.client,
      );
    }
    throw Error(`Exceeded phase action budget ${game.id}`);
  } finally {
    for (const page of pages) await page.context().close();
    for (const display of displays) await display.page.context().close();
  }
}
try {
  desktop = await launchDesktop({
    executablePath: join(work, 'portable/TableMax.exe'),
    env: {
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_DATA_DIR: join(work, 'data'),
    },
  });
  const host = await desktop.firstWindow();
  await host.locator('[data-room-revision]').waitFor();
  origin = new URL(host.url()).origin;
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  hostSocket = await socket(hostToken);
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  const catalog = (await view()).catalog;
  for (const game of process.argv.includes('--connection-only')
    ? []
    : catalog.filter(
        (game) =>
          (!process.argv.includes('--expansion-only') ||
            game.id === 'pokemon-encounters') &&
          (!process.argv.includes('--finals-only') ||
            game.id !== 'power-grid') &&
          (!process.argv.includes('--drafts-only') || game.id !== 'modern-art'),
      )) {
    const variants =
      game.id === 'pokemon-encounters'
        ? game.variants.map((value) => value.id)
        : [null];
    for (const variant of variants)
      if (
        (!process.argv.includes('--finals-only') || variant !== 'original') &&
        (!process.argv.includes('--expansion-only') || variant === 'expansion')
      )
        for (const count of process.argv.includes('--drafts-only')
          ? [game.min]
          : placementOnly ||
              process.argv.includes('--mixed-only') ||
              process.argv.includes('--finals-only')
            ? [game.max]
            : [
                ...new Set(
                  process.argv.includes('--max-first')
                    ? [game.max, game.min]
                    : [game.min, game.max],
                ),
              ]) {
          await clearRoom();
          await command({ type: 'select-game', gameId: game.id });
          if (variant)
            await command({ type: 'select-variant', variantId: variant });
          const humans = [];
          for (let index = 0; index < count; index++) {
            if (process.argv.includes('--mixed-only') && index === count - 1) {
              await command({
                type: 'add-bot',
                name: '默认电脑',
                difficulty: 'default',
              });
              continue;
            }
            const joined = await post('/api/session/join', {
              name:
                process.argv.includes('--phases-only') &&
                variant === 'expansion' &&
                count === 6 &&
                index === 0
                  ? '热爱研究的宝可梦训练家'
                  : `玩家${index + 1}`,
              requestKey: randomBytes(32).toString('hex'),
            });
            assert.equal(joined.ok, true, JSON.stringify(joined));
            const client = await socket(joined.token);
            humans.push({ token: joined.token, client });
            await command({ type: 'ready', ready: true }, joined.token, client);
          }
          await command({ type: 'start' });
          if (process.argv.includes('--mixed-only'))
            await command({ type: 'pause' });
          if (
            placementOnly ||
            process.argv.includes('--finals-only') ||
            process.argv.includes('--phases-only') ||
            process.argv.includes('--drafts-only')
          ) {
            await phases(game, variant, count, humans);
            for (const human of humans) human.client.disconnect();
            continue;
          }
          const state = await view(humans[0].token),
            page = await player(humans[0].token);
          const metrics = await page.context().newCDPSession(page);
          await rendered(page, state);
          for (const [width, height, scale] of [
            [1023, 768, 1],
            [1024, 768, 1],
            [1280, 720, 1],
            [1920, 1080, 1],
            [3840, 2160, 1],
            [1536, 864, 1.25],
            [1280, 720, 1.5],
            [390, 844, 1],
          ].filter(
            ([, , scale]) =>
              !process.argv.includes('--density-only') || scale > 1,
          )) {
            await page.setViewportSize({ width, height });
            await metrics.send('Emulation.setDeviceMetricsOverride', {
              width,
              height,
              deviceScaleFactor: scale,
              mobile: false,
            });
            await wait(180);
            const geometry = await (
              await playerFrame(page)
            ).evaluate(() => ({
              phoneWidth: innerWidth,
              overflow: document.documentElement.scrollWidth - innerWidth,
              hiddenControls: [
                ...document.querySelectorAll('.pg-phone-page'),
              ].filter((value) => value.hidden || value.inert).length,
              text: document.body.innerText.slice(0, 250),
            }));
            assert.ok(
              geometry.overflow <= 2,
              `${game.id} ${variant} ${width} horizontal overflow ${geometry.overflow}`,
            );
            const frameBounds = await page
              .locator('iframe[data-player-frame]')
              .boundingBox();
            assert.ok(
              frameBounds && frameBounds.width <= 620,
              'Phone viewport must remain narrow',
            );
            assert.ok(
              Math.abs(frameBounds.x + frameBounds.width / 2 - width / 2) <= 2,
              'Phone viewport must be centered',
            );
            assert.equal(geometry.phoneWidth, Math.round(frameBounds.width));
            assert.ok(
              (await page.evaluate(
                () => document.documentElement.scrollWidth - innerWidth,
              )) <= 2,
            );
            report.layouts.push({
              game: game.id,
              variant,
              count,
              width,
              height,
              simulatedDesktopDensity: scale,
              frameBounds,
              ...geometry,
            });
            if ([1023, 1024, 1280, 390].includes(width))
              await captureBrowserScreenshot(page, {
                path: join(
                  output,
                  `${game.id}-${variant ?? 'default'}-${count}-${width}.png`,
                ),
                fullPage: true,
              });
          }
          await check(
            `${game.id}/${variant ?? 'default'} ${count} seats: initial authorized screen and eight viewport sizes`,
          );
          await page.context().close();
          for (const human of humans) human.client.disconnect();
        }
  }
  if (
    !placementOnly &&
    !process.argv.includes('--finals-only') &&
    !process.argv.includes('--density-only') &&
    !process.argv.includes('--drafts-only') &&
    !process.argv.includes('--phases-only') &&
    !process.argv.includes('--mixed-only')
  ) {
    await clearRoom();
    await command({ type: 'select-game', gameId: 'modern-art' });
    const joined = await post('/api/session/join', {
      name: '连接测试',
      requestKey: randomBytes(32).toString('hex'),
    });
    const oldToken = joined.token,
      oldSocket = await socket(oldToken);
    for (const secure of [false, true]) {
      const tunnel = await proxy(secure),
        page = await player(oldToken, tunnel.url);
      await rendered(page, await view(oldToken));
      tunnel.behavior.dropViews = true;
      const changed = await command({ type: 'set-countdown', seconds: 30 });
      await rendered(page, changed);
      await check(
        `${secure ? 'HTTPS' : 'HTTP'} polling-only proxy: lost room:view repaired and latest revision rendered`,
      );
      tunnel.behavior.offline = true;
      await wait(6000);
      tunnel.behavior.offline = false;
      const recovered = await command({ type: 'set-countdown', seconds: 60 });
      await (
        await playerFrame(page)
      ).evaluate(() => window.dispatchEvent(new Event('online')));
      await rendered(page, recovered);
      await check(
        `${secure ? 'HTTPS' : 'HTTP'} proxy disconnection resumes without browser refresh`,
      );
      await page.context().close();
    }
    const oldPage = await player(oldToken);
    await oldPage.goto(origin + '/player');
    await rendered(oldPage, await view(oldToken));
    const newContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      newPage = await newContext.newPage();
    await newPage.goto(origin);
    await playerUi(newPage)
      .getByRole('button', { name: '换手机进入', exact: true })
      .click();
    await playerUi(newPage)
      .getByLabel('原座位', { exact: true })
      .selectOption((await view(oldToken)).self.seatId);
    await playerUi(newPage)
      .getByRole('button', { name: '申请接续座位' })
      .click();
    await playerUi(newPage).locator('.device-transfer__code strong').waitFor();
    const pending = (await view()).transferRequests[0];
    assert.equal(
      await playerUi(newPage)
        .locator('.device-transfer__code strong')
        .innerText(),
      pending.verificationCode,
    );
    await host.getByRole('button', { name: '管理设置', exact: true }).click();
    await host.getByRole('button', { name: '批准换机', exact: true }).click();
    await host
      .getByRole('button', { name: '批准并退出旧设备', exact: true })
      .click();
    await newPage.waitForFunction(() =>
      Boolean(localStorage.getItem('tablemax-player')),
    );
    assert.notEqual(
      await newPage.evaluate(() => localStorage.getItem('tablemax-player')),
      oldToken,
    );
    await playerUi(oldPage).getByText('身份已失效', { exact: false }).waitFor();
    await captureBrowserScreenshot(newPage, {
      path: join(output, 'replacement-approved.png'),
      fullPage: true,
    });
    await check(
      'Real replacement UI: code verified, approval receives new identity and old browser revoked',
    );
    oldSocket.disconnect();
    await host
      .getByRole('dialog', { name: '管理设置', exact: true })
      .getByRole('button', { name: '关闭面板', exact: true })
      .click();
    const publicPage = await browser.newPage();
    await publicPage.goto(origin + '/public');
    await host.getByRole('button', { name: '连接帮助', exact: true }).click();
    await host
      .getByLabel('外部入口网址', { exact: true })
      .fill('https://example.com:8443');
    await host
      .getByRole('button', { name: '保存外部入口', exact: true })
      .click();
    await host.getByText('二维码已更新。', { exact: true }).waitFor();
    await publicPage
      .locator('img.qr[src="/api/foundation/qr?external=1"]')
      .waitFor();
    await publicPage
      .getByRole('button', { name: '连接帮助', exact: true })
      .click();
    assert.equal(
      await publicPage.getByLabel('外部入口网址', { exact: true }).count(),
      0,
    );
    await publicPage
      .getByText('https://example.com:8443', { exact: true })
      .waitFor();
    await host
      .getByLabel('外部入口网址', { exact: true })
      .fill('https://example.com/tablemax/');
    await host
      .getByRole('button', { name: '保存外部入口', exact: true })
      .click();
    await host
      .getByText(
        '请填写 HTTP 或 HTTPS 网址；仅支持网站根地址或 /player，不支持路径前缀、登录信息或查询参数。',
        { exact: true },
      )
      .waitFor();
    assert.equal(
      (await (await fetch(origin + '/api/room/network')).json())
        .externalJoinUrl,
      'https://example.com:8443',
    );
    await check(
      'Real administrator/public QR controls: external URL saved, synchronized, readonly public and invalid prefix retains previous URL',
    );
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.stack;
  throw error;
} finally {
  for (const client of sockets) client.disconnect();
  await browser?.close();
  for (const server of proxies) {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  await desktop?.close();
  await save();
}
