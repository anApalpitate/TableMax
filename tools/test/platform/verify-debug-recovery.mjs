import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { MAXIMUM_PACKAGE_BYTES } from '../../release/package-limits.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createServer, request } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { launchDesktop } from '../support/desktop-test.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { playerUi, playerFrame } from '../support/player-test.mjs';

// This runner deliberately uses only the current delivered ZIP, an isolated save,
// hidden native windows and muted headless Edge. No LAN listener or tunnel setup.
const projectVersion = JSON.parse(
  await readFile(resolve('package.json'), 'utf8'),
).version;
const wssOnly = process.argv.includes('--wss-only');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(
  `artifacts/maintenance/v${projectVersion}/debug-20261008/recovery`,
  `${wssOnly ? 'wss' : 'full'}-${runId}`,
);
const archive = resolve(
  `artifacts/releases/TableMax-${projectVersion}-win-x64.zip`,
);
const execute = promisify(execFile);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const secrets = new Set();
const clients = [];
const proxies = [];
const pages = [];
const report = {
  scope:
    'Pinned actual ZIP; hidden WinForms/WebView2 and muted headless Edge; HTTP polling fault injection, actual player Frame Debugger execution pause/resume and an HTTPS proxy permitting WSS upgrade, all on 127.0.0.1. No physical phone lifecycle freeze, real FRP/Sakura tunnel, public certificate or Wi-Fi claim.',
  checks: [],
  mode: wssOnly ? 'wss-only' : 'full',
  pageErrors: [],
  status: 'running',
};
let desktop, browser, origin, hostToken, hostSocket, work;
const wait = (milliseconds) =>
  new Promise((done) => setTimeout(done, milliseconds));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function redact(value) {
  let text = String(value);
  for (const secret of secrets)
    if (secret) text = text.replaceAll(secret, '[redacted]');
  return text;
}
async function save() {
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2),
  );
}
async function checked(label, evidence = {}) {
  report.checks.push({ label, ...evidence });
  console.log(label);
  await save();
}
async function until(predicate, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await wait(50);
  }
  throw new Error(description);
}
async function post(path, body) {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}
async function view(token = hostToken) {
  const result = await post('/api/session/view', { token });
  assert.equal(result.ok, true, result.reason ?? 'View request rejected');
  return result.view;
}
async function connect(token) {
  const socket = io(origin, {
    auth: { token },
    transports: ['polling', 'websocket'],
    forceNew: true,
    timeout: 5000,
  });
  clients.push(socket);
  await new Promise((done, reject) => {
    socket.once('connect', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function command(value) {
  const before = await view();
  const reply = await hostSocket.timeout(5000).emitWithAck('room:command', {
    actionId: randomUUID(),
    instanceId: before.instanceId,
    revision: before.revision,
    branch: before.branch,
    command: value,
  });
  assert.equal(reply.ok, true, reply.reason ?? 'Command rejected');
  return view();
}
function version(state) {
  return {
    instanceId: state.instanceId,
    branch: state.branch,
    revision: state.revision,
  };
}
async function rendered(page, state, timeout = 20000) {
  await playerUi(page)
    .locator(
      `[data-room-instance="${state.instanceId}"][data-room-branch="${state.branch}"][data-room-revision="${state.revision}"]`,
    )
    .waitFor({ timeout });
}
async function snapshot(page, name) {
  await (
    await playerFrame(page)
  ).evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  await page.screenshot({ path: join(output, name + '.png'), fullPage: true });
}
async function player(token, url) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(
    (credential) => localStorage.setItem('tablemax-player', credential),
    token,
  );
  const page = await context.newPage();
  pages.push(page);
  page.navigationCount = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) page.navigationCount++;
  });
  page.on('pageerror', (error) =>
    report.pageErrors.push(redact(error.message)),
  );
  await page.goto(url + '/player');
  await rendered(page, await view(token));
  await playerUi(page).locator('.connection.online').waitFor();
  return page;
}

async function testCertificate() {
  const config = join(work, 'recovery-openssl.cnf');
  const key = join(work, 'recovery-key.pem');
  const cert = join(work, 'recovery-cert.pem');
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
  return { key: await readFile(key), cert: await readFile(cert) };
}

// Socket.IO polling packets are text records separated by the Engine.IO RS.
// Never retain packet payloads: only handshake, dropped ACK and upgrade counts.
async function proxy({ secure = false, allowWebSocket = false } = {}) {
  const behavior = {
    dropViews: false,
    dropNextSyncAck: false,
    acceptedConnections: 0,
    acceptedAt: [],
    droppedSyncAcks: 0,
    ackDroppedAt: 0,
    upgrades: 0,
  };
  const dropAcknowledgements = new Set();
  const connections = new Set();
  const upstreamConnections = new Set();
  const handle = (incoming, outgoing) => {
    const polling = incoming.url.startsWith('/socket.io/');
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
        if (polling && incoming.method === 'GET') {
          // All inspected payloads must be identity encoded and may shrink.
          delete headers['content-length'];
          delete headers['content-encoding'];
          outgoing.writeHead(response.statusCode, headers);
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            const filtered = Buffer.concat(chunks)
              .toString()
              .split('\x1e')
              .filter((packet) => {
                if (packet.startsWith('0{') && response.statusCode === 200) {
                  behavior.acceptedConnections++;
                  behavior.acceptedAt.push(Date.now());
                }
                if (behavior.dropViews && packet.startsWith('42["room:view"'))
                  return false;
                const acknowledgement = /^43(\d+)\[/.exec(packet);
                if (
                  acknowledgement &&
                  dropAcknowledgements.delete(acknowledgement[1])
                ) {
                  behavior.droppedSyncAcks++;
                  behavior.ackDroppedAt = Date.now();
                  return false;
                }
                return true;
              })
              .join('\x1e');
            outgoing.end(filtered || '6');
          });
          response.on('error', () => outgoing.destroy());
        } else {
          outgoing.writeHead(response.statusCode, headers);
          response.pipe(outgoing);
        }
      },
    );
    upstream.on('error', () => outgoing.destroy());
    outgoing.on('close', () => upstream.destroy());
    if (polling && incoming.method === 'POST') {
      const chunks = [];
      incoming.on('data', (chunk) => chunks.push(chunk));
      incoming.on('end', () => {
        const body = Buffer.concat(chunks);
        for (const packet of body.toString().split('\x1e')) {
          const sync = /^42(\d+)\["room:sync"\]$/.exec(packet);
          if (sync && behavior.dropNextSyncAck) {
            dropAcknowledgements.add(sync[1]);
            behavior.dropNextSyncAck = false;
          }
        }
        upstream.end(body);
      });
      incoming.on('aborted', () => upstream.destroy());
    } else incoming.pipe(upstream);
  };
  const server = secure
    ? createHttpsServer(await testCertificate(), handle)
    : createServer(handle);
  server.on('connection', (connection) => {
    connections.add(connection);
    connection.once('close', () => connections.delete(connection));
  });
  server.on('upgrade', (incoming, connection, head) => {
    if (!allowWebSocket) return connection.destroy();
    const upstream = request(origin + incoming.url, {
      headers: {
        ...incoming.headers,
        host: new URL(origin).host,
        'accept-encoding': 'identity',
      },
    });
    upstream.once('upgrade', (response, upstreamSocket, upstreamHead) => {
      upstreamConnections.add(upstreamSocket);
      upstreamSocket.once('close', () =>
        upstreamConnections.delete(upstreamSocket),
      );
      behavior.upgrades++;
      const headers = response.rawHeaders.reduce(
        (lines, item, index, all) =>
          index % 2 === 0 ? lines + `${item}: ${all[index + 1]}\r\n` : lines,
        '',
      );
      connection.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n`);
      if (head.length) upstreamSocket.write(head);
      if (upstreamHead.length) connection.write(upstreamHead);
      connection.on('error', () => upstreamSocket.destroy());
      upstreamSocket.on('error', () => connection.destroy());
      connection.on('close', () => upstreamSocket.destroy());
      upstreamSocket.on('close', () => connection.destroy());
      connection.pipe(upstreamSocket).pipe(connection);
    });
    upstream.on('response', (response) => {
      response.resume();
      connection.destroy();
    });
    upstream.on('error', () => connection.destroy());
    upstream.end();
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  proxies.push({ server, connections, upstreamConnections });
  return {
    behavior,
    url: `${secure ? 'https' : 'http'}://127.0.0.1:${server.address().port}`,
  };
}

async function ackRecovery(token) {
  const tunnel = await proxy();
  const page = await player(token, tunnel.url);
  const navigationCount = page.navigationCount;
  const before = await view(token);
  const connections = tunnel.behavior.acceptedConnections;
  tunnel.behavior.dropViews = true;
  tunnel.behavior.dropNextSyncAck = true;
  await (
    await playerFrame(page)
  ).evaluate(() => window.dispatchEvent(new Event('online')));
  await until(
    () => tunnel.behavior.droppedSyncAcks === 1,
    'No sync ACK was dropped',
  );
  const changed = await command({ type: 'set-countdown', seconds: 30 });
  assert.ok(changed.revision > before.revision);
  await until(
    () => tunnel.behavior.acceptedConnections > connections,
    'Missing sync ACK did not rebuild the transport',
    15000,
  );
  const rebuiltAt = tunnel.behavior.acceptedAt.at(-1);
  const rebuildMs = rebuiltAt - tunnel.behavior.ackDroppedAt;
  assert.ok(
    rebuildMs >= 4000 && rebuildMs < 15000,
    `ACK recovery timing outside the five-second deadline allowance: ${rebuildMs}ms`,
  );
  await rendered(page, changed);
  await playerUi(page).locator('.connection.online').waitFor();
  assert.equal(
    page.navigationCount,
    navigationCount,
    'ACK recovery reloaded the page',
  );
  assert.ok(
    await (
      await playerFrame(page)
    ).evaluate(
      (original) => localStorage.getItem('tablemax-player') === original,
      token,
    ),
    'ACK recovery changed player identity',
  );
  await snapshot(page, 'ack-timeout-recovered');
  await checked(
    'Dropped room:sync ACK rebuilds the falsely live connection and renders the latest revision without reload',
    {
      droppedSyncAcks: tunnel.behavior.droppedSyncAcks,
      acceptedConnections: tunnel.behavior.acceptedConnections,
      rebuildMs,
      before: version(before),
      after: version(changed),
    },
  );
  return { page, tunnel };
}

async function frozenRecovery(token, page, tunnel) {
  const navigationCount = page.navigationCount;
  const before = await view(token);
  const cdp = await page.context().newCDPSession(page);
  const frame = await playerFrame(page);
  const timer = await frame.evaluate(() => {
    window.__tablemaxRecoveryTicks = 0;
    return setInterval(() => window.__tablemaxRecoveryTicks++, 100);
  });
  try {
    // Lifecycle freezing a parent did not stop its real player iframe in Edge.
    // Pause script execution instead and prove that the actual child stopped.
    let paused;
    cdp.on('Debugger.paused', (event) => {
      paused = event;
    });
    await cdp.send('Debugger.enable');
    await cdp.send('Debugger.pause');
    await until(() => Boolean(paused), 'Player execution was not paused');
    const baseline = await cdp.send('Debugger.evaluateOnCallFrame', {
      callFrameId: paused.callFrames[0].callFrameId,
      expression:
        "window.top.document.querySelector('iframe[data-player-frame]').contentWindow.__tablemaxRecoveryTicks",
      returnByValue: true,
    });
    assert.ok(Number.isSafeInteger(baseline.result.value));
    const changed = await command({ type: 'set-countdown', seconds: 60 });
    assert.ok(changed.revision > before.revision);
    await wait(1000);
    const resumedAt = Date.now();
    await cdp.send('Debugger.resume');
    const ticks = await frame.evaluate((probe) => {
      clearInterval(probe);
      return window.__tablemaxRecoveryTicks;
    }, timer);
    const frozenFrameTicks = ticks - baseline.result.value;
    assert.ok(
      frozenFrameTicks <= 2,
      `Player continued running while paused: ${frozenFrameTicks} ticks`,
    );
    // Keep room:view filtered: only the real foreground sync can supply this
    // revision. Do not dispatch a synthetic wake event or reload the browser.
    assert.equal(tunnel.behavior.dropViews, true);
    await rendered(page, changed, 20000);
    await playerUi(page).locator('.connection.online').waitFor();
    assert.equal(
      page.navigationCount,
      navigationCount,
      'Freeze recovery reloaded the page',
    );
    assert.ok(
      await (
        await playerFrame(page)
      ).evaluate(
        (original) => localStorage.getItem('tablemax-player') === original,
        token,
      ),
      'Freeze recovery changed player identity',
    );
    await snapshot(page, 'frozen-recovered');
    await checked(
      'CDP execution pause/resume with broadcasts dropped renders the saved newer inner revision through automatic synchronization',
      {
        resumeToRenderMs: Date.now() - resumedAt,
        before: version(before),
        after: version(changed),
        syntheticWake: false,
        frozenFrameTicks,
        lifecycleClaim: false,
      },
    );
  } finally {
    await cdp.send('Debugger.resume').catch(() => {});
    await cdp.send('Debugger.disable').catch(() => {});
    await frame
      .evaluate((probe) => {
        clearInterval(probe);
        delete window.__tablemaxRecoveryTicks;
      }, timer)
      .catch(() => {});
    await cdp.detach();
  }
}

async function secureUpgrade(token) {
  const tunnel = await proxy({ secure: true, allowWebSocket: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(
    (credential) => localStorage.setItem('tablemax-player', credential),
    token,
  );
  const page = await context.newPage();
  pages.push(page);
  const traffic = {
    wssPaths: [],
    socketFramesReceived: 0,
    frameTypes: {},
    engineUpgradeSent: false,
    receivedVersions: [],
    synchronizedVersions: [],
    cspErrors: [],
  };
  report.wssTraffic = traffic;
  const recordVersion = (state, destination) => {
    if (
      typeof state?.instanceId === 'string' &&
      Number.isSafeInteger(state?.branch) &&
      Number.isSafeInteger(state?.revision)
    )
      destination.push(version(state));
  };
  page.on('pageerror', (error) =>
    report.pageErrors.push(redact(error.message)),
  );
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /content security policy|connect-src/i.test(message.text())
    )
      traffic.cspErrors.push(redact(message.text()));
  });
  page.on('websocket', (socket) => {
    const address = new URL(socket.url());
    if (address.protocol === 'wss:' && address.pathname === '/socket.io/') {
      traffic.wssPaths.push(address.origin + address.pathname);
      traffic.engineUpgradeSent = false;
      socket.on('framesent', ({ payload }) => {
        if (payload.toString() === '5') traffic.engineUpgradeSent = true;
      });
      socket.on('framereceived', ({ payload }) => {
        traffic.socketFramesReceived++;
        const text = payload.toString();
        const kind = /^\d{1,2}/.exec(text)?.[0] ?? 'other';
        traffic.frameTypes[kind] = (traffic.frameTypes[kind] ?? 0) + 1;
        try {
          if (text.startsWith('42["room:view",')) {
            const packet = JSON.parse(text.slice(2));
            recordVersion(packet[1], traffic.receivedVersions);
          } else if (/^43\d+\[/.test(text)) {
            const packet = JSON.parse(text.replace(/^43\d+/, ''));
            if (packet[0]?.ok === true)
              recordVersion(packet[0].view, traffic.synchronizedVersions);
          }
        } catch {
          // Raw frames contain private state and are never recorded.
        }
      });
    }
  });
  await page.goto(tunnel.url + '/player');
  await rendered(page, await view(token));
  await playerUi(page).locator('.connection.online').waitFor();
  await until(
    () => tunnel.behavior.upgrades > 0 && traffic.engineUpgradeSent,
    'HTTPS proxy never completed the WSS upgrade',
  );
  // A 101 response and 3probe only start the upgrade. Engine.IO must pause the
  // old polling transport and send packet 5 before changing active transports.
  // A full authorized sync ACK received on WSS proves the server switched too.
  await (
    await playerFrame(page)
  ).evaluate(() => window.dispatchEvent(new Event('online')));
  await until(
    () => traffic.synchronizedVersions.length > 0,
    'WSS upgrade did not return an authorized synchronization acknowledgement',
  );
  await playerUi(page).locator('.connection.online').waitFor();
  const before = await view(token);
  const seconds = before.countdownSeconds === 90 ? 105 : 90;
  const changed = await command({ type: 'set-countdown', seconds });
  assert.ok(changed.revision > before.revision, 'WSS saved update was a no-op');
  report.wssExpected = version(changed);
  await rendered(page, changed);
  await until(
    () =>
      traffic.receivedVersions.some(
        (received) =>
          received.instanceId === changed.instanceId &&
          received.branch === changed.branch &&
          received.revision === changed.revision,
      ),
    'Saved update was not received on the upgraded WSS transport',
  );
  assert.deepEqual(traffic.cspErrors, []);
  await snapshot(page, 'https-wss-upgraded');
  await checked(
    'HTTPS root/port proxy upgrades to WSS /socket.io/ and renders the next saved revision without CSP errors',
    {
      upgrades: tunnel.behavior.upgrades,
      wssPaths: traffic.wssPaths,
      framesReceived: traffic.socketFramesReceived,
      engineUpgradeSent: traffic.engineUpgradeSent,
      websocketSyncConfirmed: traffic.synchronizedVersions.at(-1),
      before: version(before),
      websocketViewRendered: version(changed),
      after: version(changed),
      certificate:
        'Local one-day fixture; certificate trust ignored in the isolated test browser only',
    },
  );
}

await mkdir(output, { recursive: true });
console.log('Recovery evidence: ' + output);
try {
  const archiveBytes = await readFile(archive);
  const manifest = JSON.parse(
    await readFile(archive.replace('.zip', '-manifest.json'), 'utf8'),
  );
  report.archiveSha256 = sha256(archiveBytes);
  assert.equal(report.archiveSha256, manifest.archive.sha256);
  assert.ok(
    manifest.archive.bytes < MAXIMUM_PACKAGE_BYTES &&
      manifest.extractedBytes < MAXIMUM_PACKAGE_BYTES,
  );
  await mkdir(resolve('tmp'), { recursive: true });
  work = await mkdtemp(resolve('tmp/debug-recovery-'));
  const portable = join(work, 'portable');
  await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:RECOVERY_ARCHIVE -DestinationPath $env:RECOVERY_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        RECOVERY_ARCHIVE: archive,
        RECOVERY_EXTRACT: portable,
      },
    },
  );
  for (const file of manifest.files) {
    const bytes = await readFile(join(portable, file.path));
    assert.equal(
      bytes.length,
      file.bytes,
      `Extracted byte count differs: ${file.path}`,
    );
    assert.equal(
      sha256(bytes),
      file.sha256,
      `Extracted SHA256 differs: ${file.path}`,
    );
  }
  await checked(
    'Pinned ZIP and every extracted file match the delivery manifest',
    {
      extractedFiles: manifest.files.length,
      extractedBytes: manifest.extractedBytes,
    },
  );
  desktop = await launchDesktop({
    executablePath: join(portable, 'TableMax.exe'),
    soundEnabled: false,
    env: {
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_DATA_DIR: join(work, 'data'),
    },
  });
  const host = await desktop.firstWindow();
  await host.locator('[data-room-revision]').waitFor();
  origin = new URL(host.url()).origin;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken, 'Native host credential missing');
  secrets.add(hostToken);
  hostSocket = await connect(hostToken);
  await command({ type: 'select-game', gameId: 'modern-art' });
  const joined = await post('/api/session/join', {
    name: '恢复专项玩家',
    requestKey: randomBytes(32).toString('hex'),
  });
  assert.equal(joined.ok, true, joined.reason ?? 'Player join rejected');
  secrets.add(joined.token);
  browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
    soundEnabled: false,
    args: ['--ignore-certificate-errors'],
  });
  if (!wssOnly) {
    const recovery = await ackRecovery(joined.token);
    await frozenRecovery(joined.token, recovery.page, recovery.tunnel);
  }
  await secureUpgrade(joined.token);
  assert.deepEqual(report.pageErrors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = redact(error.stack ?? error.message ?? error);
  for (const [index, page] of pages.entries())
    if (!page.isClosed())
      await page
        .screenshot({
          path: join(output, `failed-page-${index}.png`),
          fullPage: true,
        })
        .catch(() => {});
} finally {
  for (const socket of clients) socket.disconnect();
  const cleanupErrors = [];
  await browser
    ?.close()
    .catch((error) => cleanupErrors.push(redact(error.message)));
  for (const { server, connections, upstreamConnections } of proxies) {
    for (const socket of connections) socket.destroy();
    for (const socket of upstreamConnections) socket.destroy();
    server.closeAllConnections();
    await new Promise((done) => server.close(done)).catch((error) =>
      cleanupErrors.push(redact(error.message)),
    );
  }
  await desktop
    ?.close()
    .catch((error) => cleanupErrors.push(redact(error.message)));
  report.cleanupErrors = cleanupErrors;
  if (cleanupErrors.length) {
    report.status = 'failed';
    report.failure ??= 'Verification process cleanup failed; see cleanupErrors';
  }
  await save();
}
if (report.status === 'failed') throw new Error(report.failure);
