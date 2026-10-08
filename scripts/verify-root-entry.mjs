import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { launchDesktop } from './desktop-test.mjs';
import { launchTestBrowser } from './browser-test.mjs';
import { playerFrame, playerUi } from './player-test.mjs';

// Actual frozen package and UI admission, never a source-side game fixture.
const args = process.argv.slice(2);
assert.ok(
  args.every((arg) =>
    /^--(?:evidence=[A-Za-z0-9_-]+|sha256=[a-f0-9]{64})$/i.test(arg),
  ),
);
const argument = (name) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const expectedSha = argument('sha256');
assert.ok(expectedSha, 'A frozen delivery SHA256 is required');
const evidence = argument('evidence') ?? `run-${Date.now()}`;
const output = resolve(
  `artifacts/maintenance/v${version}/root-entry`,
  evidence,
);
const archive = resolve(`artifacts/releases/TableMax-${version}-win-x64.zip`);
const execute = promisify(execFile);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const QRCode = createRequire(resolve('apps/server/package.json'))('qrcode');
const contexts = [],
  proxies = [],
  secrets = new Set();
let work, desktop, browser, host, hostSocket, hostToken, origin;
const report = {
  version,
  status: 'running',
  startedAt: new Date().toISOString(),
  scope:
    'Actual frozen ZIP and every member; hidden muted WinForms/WebView2 and muted headless Edge. Root UI admission, persisted browser identity, root HTTP/HTTPS reverse proxies at nonstandard loopback ports and legacy player routes. Does not certify public tunnels, physical phones, public TLS certificates or Windows DPI.',
  checks: [],
  entries: [],
  screenshots: [],
  pageErrors: [],
  externalRequests: [],
};
const redact = (value) => {
  let text = String(value);
  for (const secret of secrets) text = text.replaceAll(secret, '[redacted]');
  return text;
};
async function save() {
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
async function checked(message) {
  report.checks.push(message);
  console.log(message);
  await save();
}
async function post(path, body) {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  return { response, reply: await response.json() };
}
async function view(token = hostToken) {
  const { reply } = await post('/api/session/view', token ? { token } : {});
  assert.equal(reply.ok, true, reply.reason);
  return reply.view;
}
async function command(value) {
  const before = await view();
  const reply = await hostSocket.timeout(8000).emitWithAck('room:command', {
    actionId: randomUUID(),
    instanceId: before.instanceId,
    branch: before.branch,
    revision: before.revision,
    command: value,
  });
  assert.equal(reply.ok, true, reply.reason);
}
async function rendered(page, state) {
  await playerUi(page)
    .locator(
      `[data-room-instance="${state.instanceId}"][data-room-branch="${state.branch}"][data-room-revision="${state.revision}"]`,
    )
    .waitFor();
}
async function capture(page, name) {
  await (
    await playerFrame(page)
  ).evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) => image.decode().catch(() => {})),
    );
  });
  await page.screenshot({ path: join(output, name + '.png'), fullPage: true });
  report.screenshots.push(name + '.png');
}
async function verifyPackage() {
  const manifest = JSON.parse(
    await readFile(archive.replace(/\.zip$/, '-manifest.json'), 'utf8'),
  );
  const bytes = await readFile(archive);
  report.archiveSha256 = hash(bytes);
  assert.equal(report.archiveSha256, expectedSha.toLowerCase());
  assert.equal(report.archiveSha256, manifest.archive.sha256);
  assert.equal(bytes.length, manifest.archive.bytes);
  assert.ok(bytes.length < 100000000 && manifest.extractedBytes < 100000000);
  assert.equal(manifest.fileCount, 248, 'Frozen runtime member count changed');
  await mkdir(resolve('tmp'), { recursive: true });
  work = await mkdtemp(resolve('tmp/root-entry-'));
  const portable = join(work, 'portable');
  report.work = relative(resolve('.'), work).replaceAll('\\', '/');
  await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:ROOT_ENTRY_ARCHIVE -DestinationPath $env:ROOT_ENTRY_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        ROOT_ENTRY_ARCHIVE: archive,
        ROOT_ENTRY_EXTRACT: portable,
      },
    },
  );
  const expected = new Set(),
    actual = new Set();
  let total = 0;
  for (const file of manifest.files) {
    const path = resolve(portable, file.path);
    assert.ok(path.startsWith(portable + sep), 'Manifest path escapes package');
    const member = await readFile(path);
    assert.equal(member.length, file.bytes, file.path);
    assert.equal(hash(member), file.sha256, file.path);
    total += member.length;
    expected.add(file.path.replaceAll('\\', '/'));
  }
  async function inventory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.equal(entry.isSymbolicLink(), false);
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await inventory(path);
      else actual.add(relative(portable, path).replaceAll('\\', '/'));
    }
  }
  await inventory(portable);
  assert.deepEqual(actual, expected);
  assert.equal(total, manifest.extractedBytes);
  assert.ok(total <= 95000000, 'Runtime exceeds the 95 MB engineering budget');
  assert.equal(actual.size, manifest.fileCount);
  report.package = {
    archiveBytes: bytes.length,
    extractedBytes: total,
    files: actual.size,
  };
  await checked(
    'Frozen ZIP, all 248 members, both 100 MB limits and 95 MB engineering budget verified',
  );
  return portable;
}
async function proxy(secure) {
  const handle = (incoming, outgoing) => {
    const upstream = request(
      origin + incoming.url,
      {
        method: incoming.method,
        headers: { ...incoming.headers, host: new URL(origin).host },
      },
      (response) => {
        outgoing.writeHead(response.statusCode, response.headers);
        response.pipe(outgoing);
      },
    );
    upstream.on('error', () => outgoing.destroy());
    outgoing.on('close', () => upstream.destroy());
    incoming.pipe(upstream);
  };
  let certificate;
  if (secure) {
    const config = join(work, 'root-openssl.cnf'),
      key = join(work, 'root-key.pem'),
      cert = join(work, 'root-cert.pem');
    await writeFile(
      config,
      '[req]\ndistinguished_name=dn\nx509_extensions=local\n[dn]\n[local]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n',
    );
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
    certificate = { key: await readFile(key), cert: await readFile(cert) };
  }
  const server = secure
    ? createHttpsServer(certificate, handle)
    : createServer(handle);
  server.on('upgrade', (_request, connection) => connection.destroy());
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  proxies.push(server);
  const port = server.address().port;
  assert.ok(port !== 80 && port !== 443);
  return `${secure ? 'https' : 'http'}://${secure ? '127.0.0.1' : 'localhost'}:${port}`;
}
async function assertPlayer(page, token = null) {
  const frame = await playerFrame(page);
  await playerUi(page).locator('.box-screen.player, .screen.player').waitFor();
  assert.equal(
    await playerUi(page)
      .locator('.box-screen.host, .box-screen.public')
      .count(),
    0,
  );
  for (const name of ['管理设置', '添加人机', '切换游戏', '座位设置'])
    assert.equal(
      await playerUi(page).getByRole('button', { name, exact: true }).count(),
      0,
    );
  const bridges = await frame.evaluate(() => ({
    hostCredential: sessionStorage.getItem('tablemax-host') !== null,
    windowBridge: !!window.tablemaxWindow,
    audioBridge: !!window.tablemaxAudio,
    nativeWebView: !!window.chrome?.webview,
  }));
  assert.deepEqual(bridges, {
    hostCredential: false,
    windowBridge: false,
    audioBridge: false,
    nativeWebView: false,
  });
  if (token) {
    const state = await view(token);
    assert.equal(state.self.role, 'player');
    assert.equal(state.capabilities.control, false);
    await rendered(page, state);
  }
}
async function rootPlayer(url, label, viewport) {
  const context = await browser.newContext({
    viewport,
    ignoreHTTPSErrors: true,
  });
  contexts.push(context);
  await context.route('**/*', (route) =>
    ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) =>
    report.pageErrors.push(redact(error.message)),
  );
  page.on('request', (request) => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname))
      report.externalRequests.push(request.url());
  });
  const response = await page.goto(url);
  assert.equal(response.status(), 200);
  assert.equal(new URL(page.url()).pathname, '/');
  await assertPlayer(page);
  await playerUi(page).getByLabel('你的昵称', { exact: true }).fill(label);
  await playerUi(page)
    .getByRole('button', { name: '加入', exact: true })
    .click();
  await playerUi(page)
    .getByRole('button', { name: '我准备好了', exact: true })
    .waitFor();
  const token = await (
    await playerFrame(page)
  ).evaluate(() => localStorage.getItem('tablemax-player'));
  assert.ok(token);
  secrets.add(token);
  const initial = await view(token);
  await assertPlayer(page, token);
  const denied = await post('/api/room/network', {
    token,
    externalJoinUrl: url,
  });
  assert.equal(denied.response.status, 403);
  assert.equal(denied.reply.reason, 'unauthorized');
  const rect = await page.locator('iframe[data-player-frame]').boundingBox();
  assert.ok(rect);
  const expectedWidth =
    viewport.width >= 800
      ? Math.max(320, Math.min(430, ((viewport.height - 48) * 9) / 19.5))
      : viewport.width;
  assert.ok(Math.abs(rect.width - expectedWidth) < 2);
  assert.ok(Math.abs(rect.x + rect.width / 2 - viewport.width / 2) < 2);
  await capture(page, label + '-root');
  await page.reload();
  await assertPlayer(page, token);
  assert.equal(
    await (
      await playerFrame(page)
    ).evaluate(() => localStorage.getItem('tablemax-player')),
    token,
  );
  assert.equal((await view(token)).self.seatId, initial.self.seatId);
  assert.equal(new URL(page.url()).pathname, '/');
  await playerUi(page)
    .getByRole('button', { name: '我准备好了', exact: true })
    .click();
  await playerUi(page)
    .getByRole('button', { name: '取消准备', exact: true })
    .waitFor();
  const ready = await view(token);
  assert.equal(
    ready.seats.find((seat) => seat.id === ready.self.seatId).ready,
    true,
  );
  await rendered(page, ready);
  for (const path of ['/player', '/']) {
    await page.goto(url + path);
    await assertPlayer(page, token);
    assert.equal((await view(token)).self.seatId, initial.self.seatId);
    assert.equal(
      await (
        await playerFrame(page)
      ).evaluate(() => localStorage.getItem('tablemax-player')),
      token,
    );
  }
  const { response: savedResponse, reply: settings } = await post(
    '/api/room/network',
    { token: hostToken, externalJoinUrl: url + '/player' },
  );
  assert.equal(savedResponse.status, 200);
  assert.equal(settings.externalJoinUrl, url);
  const qr = await fetch(origin + '/api/foundation/qr?external=1');
  assert.equal(
    await qr.text(),
    await QRCode.toString(url, { type: 'svg', margin: 2 }),
  );
  report.entries.push({
    label,
    url,
    viewport,
    frame: rect,
    sameIdentityAfterReload: true,
    legacyBoxCompatible: true,
    latestRenderedRevision: ready.revision,
    rootQr: true,
  });
  await checked(
    label +
      ': root UI admission, refresh, ready, legacy box and root QR verified',
  );
  return { page, token, url };
}
await mkdir(resolve(output, '..'), { recursive: true });
await mkdir(output, { recursive: false });
try {
  const portable = await verifyPackage();
  const env = {
    ...process.env,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
    TABLEMAX_DATA_DIR: join(work, 'data'),
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
  desktop = await launchDesktop({
    executablePath: join(portable, 'TableMax.exe'),
    soundEnabled: false,
    env,
  });
  host = await desktop.firstWindow();
  await host.locator('[data-room-revision]').waitFor();
  origin = new URL(host.url()).origin;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken);
  secrets.add(hostToken);
  hostSocket = io(origin, {
    auth: { token: hostToken },
    transports: ['polling', 'websocket'],
    forceNew: true,
  });
  await new Promise((done, reject) => {
    hostSocket.once('connect', done);
    hostSocket.once('connect_error', reject);
  });
  await command({ type: 'select-game', gameId: 'modern-art' });
  browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
    soundEnabled: false,
  });
  const players = [
    await rootPlayer(origin, 'direct-root', { width: 1280, height: 720 }),
    await rootPlayer(await proxy(false), 'http-root', {
      width: 390,
      height: 844,
    }),
    await rootPlayer(await proxy(true), 'https-root', {
      width: 1920,
      height: 1080,
    }),
  ];
  const beforeStart = await view();
  assert.equal(beforeStart.seats.length, players.length);
  for (const player of players)
    await rendered(player.page, await view(player.token));
  await command({ type: 'start' });
  for (const player of players) {
    await player.page.goto(player.url + '/player/game');
    const state = await view(player.token);
    await rendered(player.page, state);
    assert.equal(state.self.role, 'player');
    assert.equal(state.capabilities.control, false);
    assert.ok(state.gameView);
    assert.equal(
      await (
        await playerFrame(player.page)
      ).evaluate(() => localStorage.getItem('tablemax-player')),
      player.token,
    );
    assert.equal(new URL(player.page.url()).pathname, '/player/game');
    await capture(
      player.page,
      report.entries[players.indexOf(player)].label + '-legacy-game',
    );
    await player.page.reload();
    await rendered(player.page, await view(player.token));
  }
  for (const path of ['/host', '/public', '/host/game', '/public/game']) {
    const page = await browser.newPage();
    await page.goto(origin + path);
    await page.locator('[data-room-revision]').waitFor();
    assert.equal(await page.locator('iframe[data-player-frame]').count(), 0);
    await page.close();
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.externalRequests, []);
  await checked(
    'Legacy /player/game refresh and standalone host/public routes verified',
  );
  assert.equal(hash(await readFile(archive)), report.archiveSha256);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = redact(error.stack);
  if (browser)
    for (const [index, context] of contexts.entries()) {
      const page = context.pages()[0];
      if (page && !page.isClosed())
        await capture(page, `failure-${index}`).catch(() => {});
    }
  process.exitCode = 1;
} finally {
  hostSocket?.disconnect();
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close().catch(() => {});
  for (const server of proxies) {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  try {
    await desktop?.close();
    if (origin) {
      await assert.rejects(
        fetch(origin + '/api/foundation/health', {
          signal: AbortSignal.timeout(1000),
        }),
      );
    }
    report.allOwnedProcessesStopped = true;
  } catch (error) {
    report.allOwnedProcessesStopped = false;
    report.cleanupError = redact(error.stack);
    report.status = 'failed';
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  await save();
  console.log(
    JSON.stringify({
      status: report.status,
      output,
      checks: report.checks.length,
    }),
  );
}
