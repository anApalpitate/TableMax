import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createServer, request } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { launchDesktop } from './desktop-test.mjs';
import { launchTestBrowser } from './browser-test.mjs';
import { playerUi, playerFrame } from './player-test.mjs';

const version = JSON.parse(
  await readFile(resolve('package.json'), 'utf8'),
).version;

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const output = resolve(
  `artifacts/maintenance/v${version}/debug-20261008/portable`,
  process.argv.includes('--finals-only')
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
  manifest.archive.bytes < 100000000 && manifest.extractedBytes < 100000000,
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
    await page.screenshot({
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
  const pages = await Promise.all(humans.map((human) => player(human.token)));
  try {
    for (let step = 0; step < 2400; step++) {
      const views = await Promise.all(humans.map((human) => view(human.token)));
      const actor = views.findIndex((state) => state.actions.length);
      const index = actor < 0 ? 0 : actor,
        state = views[index],
        phase = state.gameView.phase,
        page = pages[index];
      if (!captured.has(phase)) {
        captured.add(phase);
        await rendered(page, state);
        for (const width of [1023, 1024, 1280, 1920, 3840, 390]) {
          await page.setViewportSize({
            width,
            height: width === 390 ? 844 : width === 1280 ? 720 : 1080,
          });
          await wait(80);
          const overflow = await (
            await playerFrame(page)
          ).evaluate(() => document.documentElement.scrollWidth - innerWidth);
          assert.ok(
            overflow <= 2,
            `${game.id}/${phase}/${width} overflow ${overflow}`,
          );
          if (width === 1280)
            await page.screenshot({
              path: join(
                output,
                `${game.id}-${variant ?? 'default'}-${count}-${phase}.png`,
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
        await page.setViewportSize({ width: 1280, height: 720 });
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
      )
        return;
      assert.ok(actor >= 0, `No legal decision ${game.id}/${phase}`);
      const human = humans[actor];
      const chosen = await bot.decide({
        view: state.gameView,
        actions: state.actions,
        decision: { id: state.decisionId, seatId: state.self.seatId },
        memory: memories.get(human.token) ?? null,
        difficulty: 'default',
        random: { next: Math.random },
        signal: new AbortController().signal,
      });
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
          (!process.argv.includes('--finals-only') ||
            game.id !== 'power-grid') &&
          (!process.argv.includes('--drafts-only') || game.id !== 'modern-art'),
      )) {
    const variants =
      game.id === 'pokemon-encounters'
        ? game.variants.map((value) => value.id)
        : [null];
    for (const variant of variants)
      if (!process.argv.includes('--finals-only') || variant !== 'original')
        for (const count of process.argv.includes('--drafts-only')
          ? [game.min]
          : process.argv.includes('--mixed-only') ||
              process.argv.includes('--finals-only')
            ? [game.max]
            : [...new Set([game.min, game.max])]) {
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
              name: `玩家${index + 1}`,
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
              await page.screenshot({
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
    await newPage.goto(origin + '/player');
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
    await newPage.screenshot({
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
      .getByText('https://example.com:8443/player', { exact: true })
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
      'https://example.com:8443/player',
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
