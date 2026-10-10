import { captureBrowserScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { MAXIMUM_PACKAGE_BYTES } from '../../release/package-limits.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { request } from 'node:http';
import { createServer } from 'node:https';
import { launchDesktop } from '../support/desktop-test.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { playerUi, playerFrame } from '../support/player-test.mjs';
import { readCurrentSave } from '../../../apps/server/src/save-codec.mjs';

// Equivalent root-domain/port mapping only. No real tunnel, public hostname,
// firewall change, LAN listener, production save or source-side game fixture.
const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const { version: packageVersion } = JSON.parse(
  await readFile('package.json', 'utf8'),
);
assert.match(packageVersion, /^\d+\.\d+\.\d+$/);
const archive = resolve(
  argument('archive') ??
    `artifacts/releases/TableMax-${packageVersion}-win-x64.zip`,
);
const manifestPath = archive.replace(/\.zip$/i, '-manifest.json');
assert.notEqual(archive, manifestPath, 'Archive must be a ZIP');
const scenario = argument('scenario') ?? 'all';
assert.ok(
  [
    'all',
    'polling',
    'ack',
    'action',
    'offline',
    'freeze',
    'wss',
    'transfer',
  ].includes(scenario),
);
const expectedSha = argument('sha256');
if (expectedSha) assert.match(expectedSha, /^[a-f0-9]{64}$/i);
const preflightOnly = process.argv.includes('--preflight-only');
const freezeMode = argument('freeze-mode') ?? 'debugger';
assert.ok(['debugger', 'lifecycle'].includes(freezeMode));
const evidence = argument('evidence') ?? 'debug-20261008';
assert.match(evidence, /^[a-z0-9][a-z0-9-]{0,95}$/);
const output = resolve(
  `artifacts/maintenance/v${packageVersion}/${evidence}/remote`,
  `${scenario}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);
const execute = promisify(execFile);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const secrets = new Set();
const sockets = [];
const tunnels = [];
const pages = [];
const report = {
  version: packageVersion,
  scenario,
  scope:
    'Actual ZIP; hidden WinForms/WebView2, muted headless Edge, isolated local TLS root entry at a nonstandard port on 127.0.0.1. Equivalent Sakura/FRP reverse-proxy behavior only; no actual tunnel, physical phone, public certificate, cellular/Wi-Fi or Safari claim.',
  checks: [],
  traffic: [],
  pageErrors: [],
  cspErrors: [],
  status: 'running',
};
let work, desktop, browser, host, hostToken, hostSocket, origin, manifest;
let admissionRecovery, transferRecovery;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function redact(value) {
  let result = String(value);
  for (const secret of secrets)
    if (secret) result = result.replaceAll(secret, '[redacted]');
  return result;
}
async function save() {
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
async function checked(label, evidence = {}) {
  report.checks.push({ label, ...evidence });
  console.log(label);
  await save();
}
async function until(predicate, message, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await wait(50);
  }
  throw new Error(message);
}
function version(state) {
  return {
    instanceId: state.instanceId,
    branch: state.branch,
    revision: state.revision,
  };
}
function sameVersion(a, b) {
  return (
    a.instanceId === b.instanceId &&
    a.branch === b.branch &&
    a.revision === b.revision
  );
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
  const result = await post('/api/session/view', token ? { token } : {});
  assert.equal(result.ok, true, result.reason ?? 'Authorized view rejected');
  return result.view;
}
async function connect(token) {
  const socket = io(origin, {
    auth: { token },
    transports: ['polling', 'websocket'],
    forceNew: true,
    timeout: 5000,
  });
  sockets.push(socket);
  await new Promise((done, reject) => {
    socket.once('connect', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function command(value) {
  const state = await view();
  const reply = await hostSocket.timeout(5000).emitWithAck('room:command', {
    actionId: randomUUID(),
    ...version(state),
    command: value,
  });
  assert.equal(reply.ok, true, reply.reason ?? 'Authority command rejected');
  return view();
}
async function changedCountdown() {
  const before = await view();
  const seconds = before.countdownSeconds === 30 ? 60 : 30;
  const after = await command({ type: 'set-countdown', seconds });
  assert.ok(after.revision > before.revision, 'Saved update was a no-op');
  return after;
}

// Always interrogate RoomApp inside the stable player iframe when present.
// An outer shell attribute or viewport cannot prove the phone UI has updated.
async function rendered(page, state, timeout = 20000) {
  const selector = `[data-room-instance="${state.instanceId}"][data-room-branch="${state.branch}"][data-room-revision="${state.revision}"]`;
  await until(
    async () => {
      const frame = await playerFrame(page);
      return frame ? (await frame.locator(selector).count()) === 1 : false;
    },
    'Latest authorized revision did not render in the player RoomApp',
    timeout,
  );
  const frame = await playerFrame(page);
  assert.ok(frame);
  const metrics = await frame.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    path: location.pathname,
    domRevision: document
      .querySelector('[data-room-revision]')
      ?.getAttribute('data-room-revision'),
  }));
  assert.equal(metrics.domRevision, String(state.revision));
  return { ...version(state), framed: frame !== page.mainFrame(), ...metrics };
}
async function ready(page) {
  await until(
    async () =>
      Boolean(
        await (await playerFrame(page))?.locator('.connection.online').count(),
      ),
    'Player did not confirm its current connection',
  );
}
async function clickPlayer(page, label) {
  await playerUi(page)
    .getByRole('button', { name: label, exact: true })
    .click();
}
async function snapshot(page, name) {
  const frame = await playerFrame(page);
  await frame.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  await captureBrowserScreenshot(page, {
    path: join(output, name + '.png'),
    fullPage: true,
  });
}
async function sameIdentity(page, token) {
  const frame = await playerFrame(page);
  assert.equal(
    await frame.evaluate(
      (original) => localStorage.getItem('tablemax-player') === original,
      token,
    ),
    true,
    'Player credential changed during recovery',
  );
}
async function wake(page) {
  await (
    await playerFrame(page)
  ).evaluate(() => window.dispatchEvent(new Event('online')));
}
async function player(token, tunnel, wide = false) {
  const context = await browser.newContext({
    viewport: wide ? { width: 1280, height: 900 } : { width: 390, height: 844 },
    ignoreHTTPSErrors: true,
  });
  if (token)
    await context.addInitScript((credential) => {
      if (!localStorage.getItem('tablemax-player'))
        localStorage.setItem('tablemax-player', credential);
    }, token);
  const page = await context.newPage();
  pages.push(page);
  page.navigationCounts = { outer: 0, inner: 0 };
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) page.navigationCounts.outer++;
    else if (
      /^\/(?:player(?:\/game)?)?$/.test(
        new URL(frame.url(), page.url()).pathname,
      )
    )
      page.navigationCounts.inner++;
  });
  page.on('pageerror', (error) =>
    report.pageErrors.push(redact(error.message)),
  );
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /content security policy|connect-src/i.test(message.text())
    )
      report.cspErrors.push(redact(message.text()));
  });
  page.on('websocket', (socket) => {
    const address = new URL(socket.url());
    if (address.pathname !== '/socket.io/') return;
    tunnel.traffic.websocketPaths.push(address.origin + address.pathname);
    socket.on('framesent', ({ payload }) => {
      const packet = payload.toString();
      if (packet === '5') tunnel.traffic.engineUpgradeSent = true;
      observeOutgoing(
        packet,
        'websocket',
        '',
        tunnel.traffic,
        tunnel.behavior,
        new Map(),
      );
    });
    socket.on('framereceived', ({ payload }) => {
      const packet = payload.toString();
      tunnel.traffic.websocketFramesReceived++;
      observeIncoming(
        packet,
        'websocket',
        '',
        tunnel.traffic,
        tunnel.behavior,
        new Map(),
      );
    });
  });
  await page.goto(tunnel.url);
  await ready(page);
  const state = await view(token || '');
  await rendered(page, state);
  tunnel.traffic.renderedFrame = await rendered(page, state);
  // Exercise desktop presentation through the same local reverse proxy as the
  // reliability scenarios. Resizing/toggling cannot create another session.
  await page.setViewportSize({ width: 1280, height: 720 });
  const control = page.locator('.player-frame__display');
  await control.waitFor();
  const child = await playerFrame(page);
  const marker = randomUUID();
  await child.evaluate((value) => {
    window.__remoteDisplayDocument = value;
  }, marker);
  const beforeSwitch = { ...page.navigationCounts };
  for (const desired of ['wide', 'portrait', 'wide']) {
    if (
      (await page
        .locator('.player-frame')
        .getAttribute('data-player-display')) !== desired
    )
      await control.click();
    await playerUi(page)
      .locator(`html[data-player-display="${desired}"]`)
      .waitFor();
  }
  assert.equal(
    await child.evaluate(() => window.__remoteDisplayDocument),
    marker,
  );
  assert.deepEqual(page.navigationCounts, beforeSwitch);
  await rendered(page, state);
  return page;
}

// Record versions and opaque operation fingerprints only. Frames include
// credentials and projected secrets, so raw packet bodies never reach evidence.
function observeOutgoing(
  packet,
  transport,
  sid,
  traffic,
  behavior,
  acknowledgements,
) {
  const match = /^42(\d+)\[(.*)\]$/.exec(packet);
  if (!match) return;
  try {
    const [event, envelope] = JSON.parse(`[${match[2]}]`);
    const key = sid + ':' + match[1];
    if (event === 'room:sync') {
      traffic.syncRequests++;
      acknowledgements.set(key, {
        kind: 'sync',
        drop: behavior.dropNextSyncAck,
      });
      behavior.dropNextSyncAck = false;
    } else if (
      event === 'room:command' &&
      typeof envelope?.actionId === 'string'
    ) {
      traffic.operations.push({
        actionId: envelope.actionId,
        fingerprint: sha256(JSON.stringify(envelope)),
        transport,
        type: envelope.command?.type,
        sentAt: Date.now(),
      });
      acknowledgements.set(key, {
        kind: 'action',
        drop: behavior.dropNextActionAck,
      });
      behavior.dropNextActionAck = false;
    }
  } catch {
    /* Ignore nonapplication packets without exposing their payload. */
  }
}
function observeIncoming(
  packet,
  transport,
  sid,
  traffic,
  behavior,
  acknowledgements,
) {
  if (packet.startsWith('0{')) {
    traffic.acceptedConnections++;
    traffic.acceptedAt.push(Date.now());
  }
  if (packet.startsWith('42["room:view",')) {
    try {
      const state = JSON.parse(packet.slice(2))[1];
      if (typeof state?.instanceId === 'string')
        traffic.views.push({ ...version(state), transport });
    } catch {
      /* Do not retain private payloads. */
    }
    if (behavior.dropViews) {
      traffic.droppedViews++;
      return false;
    }
  }
  const match = /^43(\d+)(\[.*)$/.exec(packet);
  if (match) {
    const acknowledgement = acknowledgements.get(sid + ':' + match[1]);
    acknowledgements.delete(sid + ':' + match[1]);
    if (acknowledgement?.drop) {
      traffic[
        acknowledgement.kind === 'sync'
          ? 'droppedSyncAcks'
          : 'droppedActionAcks'
      ]++;
      traffic.lastDroppedAckAt = Date.now();
      return false;
    }
    try {
      const [reply] = JSON.parse(match[2]);
      if (reply?.ok && reply.view)
        traffic.syncReplies.push({ ...version(reply.view), transport });
      else if (acknowledgement?.kind === 'action')
        traffic.actionReplies.push({
          ok: reply?.ok === true,
          reason: reply?.reason,
          transport,
        });
    } catch {
      /* Do not retain private payloads. */
    }
  }
  return true;
}
async function testCertificate() {
  const config = join(work, 'remote-openssl.cnf');
  const key = join(work, 'remote-key.pem');
  const cert = join(work, 'remote-cert.pem');
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
async function proxy(name, allowWebSocket = false) {
  const behavior = {
    dropViews: false,
    dropNextSyncAck: false,
    dropNextActionAck: false,
    offline: false,
  };
  const traffic = {
    name,
    acceptedConnections: 0,
    acceptedAt: [],
    rejectedUpgrades: 0,
    acceptedUpgrades: 0,
    droppedViews: 0,
    droppedSyncAcks: 0,
    droppedActionAcks: 0,
    lastDroppedAckAt: 0,
    syncRequests: 0,
    operations: [],
    actionReplies: [],
    views: [],
    syncReplies: [],
    websocketPaths: [],
    websocketFramesReceived: 0,
    engineUpgradeSent: false,
  };
  report.traffic.push(traffic);
  const acknowledgements = new Map();
  const connections = new Set(),
    upstreamConnections = new Set();
  const server = createServer(await testCertificate(), (incoming, outgoing) => {
    if (behavior.offline) {
      incoming.resume();
      outgoing.destroy();
      return;
    }
    const polling = incoming.url.startsWith('/socket.io/');
    const sid = new URL(incoming.url, origin).searchParams.get('sid') ?? '';
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
          // Explicit identity upstream encoding and no stale body length after filtering.
          delete headers['content-length'];
          delete headers['content-encoding'];
          outgoing.writeHead(response.statusCode, headers);
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            const packets = Buffer.concat(chunks)
              .toString()
              .split('\x1e')
              .filter((packet) =>
                observeIncoming(
                  packet,
                  'polling',
                  sid,
                  traffic,
                  behavior,
                  acknowledgements,
                ),
              );
            outgoing.end(packets.join('\x1e') || '6');
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
        for (const packet of body.toString().split('\x1e'))
          observeOutgoing(
            packet,
            'polling',
            sid,
            traffic,
            behavior,
            acknowledgements,
          );
        upstream.end(body);
      });
      incoming.on('aborted', () => upstream.destroy());
    } else incoming.pipe(upstream);
  });
  server.on('connection', (socket) => {
    connections.add(socket);
    socket.once('close', () => connections.delete(socket));
  });
  server.on('upgrade', (incoming, connection, head) => {
    if (!allowWebSocket || behavior.offline) {
      traffic.rejectedUpgrades++;
      connection.destroy();
      return;
    }
    const upstream = request(origin + incoming.url, {
      headers: {
        ...incoming.headers,
        host: new URL(origin).host,
        'accept-encoding': 'identity',
      },
    });
    upstream.once('upgrade', (response, socket, upstreamHead) => {
      upstreamConnections.add(socket);
      socket.once('close', () => upstreamConnections.delete(socket));
      traffic.acceptedUpgrades++;
      const headers = response.rawHeaders.reduce(
        (lines, item, index, all) =>
          index % 2 === 0 ? lines + `${item}: ${all[index + 1]}\r\n` : lines,
        '',
      );
      connection.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n`);
      if (head.length) socket.write(head);
      if (upstreamHead.length) connection.write(upstreamHead);
      connection.on('error', () => socket.destroy());
      socket.on('error', () => connection.destroy());
      connection.on('close', () => socket.destroy());
      socket.on('close', () => connection.destroy());
      connection.pipe(socket).pipe(connection);
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
  const port = server.address().port;
  assert.ok(port > 1024 && port !== 443);
  const tunnel = {
    server,
    connections,
    upstreamConnections,
    behavior,
    traffic,
    url: `https://127.0.0.1:${port}`,
    disconnect: () => {
      for (const socket of connections) socket.destroy();
      for (const socket of upstreamConnections) socket.destroy();
    },
  };
  tunnels.push(tunnel);
  return tunnel;
}

async function pollingCase(token) {
  const tunnel = await proxy('tls-polling');
  const page = await player(token, tunnel, true);
  const before = await view(token);
  const started = Date.now();
  await clickPlayer(
    page,
    before.seats.find((seat) => seat.id === before.self.seatId).ready
      ? '取消准备'
      : '我准备好了',
  );
  await until(
    async () => (await view(token)).revision > before.revision,
    'Player operation did not reach the authority through TLS polling',
  );
  const after = await view(token);
  const dom = await rendered(page, after);
  const operationToRenderMs = Date.now() - started;
  assert.ok(
    operationToRenderMs < 5000,
    `Live polling push was not immediate: ${operationToRenderMs}ms`,
  );
  await until(
    () => tunnel.traffic.actionReplies.some((reply) => reply.ok),
    'Player operation was not acknowledged through polling',
  );
  await until(
    () => tunnel.traffic.rejectedUpgrades > 0,
    'WebSocket denial was not exercised',
  );
  assert.equal(tunnel.traffic.acceptedUpgrades, 0);
  assert.ok(
    tunnel.traffic.operations.some(
      (item) => item.type === 'ready' && item.transport === 'polling',
    ),
  );
  await snapshot(page, 'tls-polling-bidirectional');
  await checked(
    'HTTPS nonstandard root entry remains interactive when WebSocket is denied; a real ready operation is saved and its revision renders',
    {
      entryOrigin: tunnel.url,
      operationToRenderMs,
      before: version(before),
      after: dom,
    },
  );
  return { page, tunnel };
}
async function ackCase(token, page, tunnel) {
  const navigationCounts = { ...page.navigationCounts };
  const accepted = tunnel.traffic.acceptedConnections;
  tunnel.behavior.dropViews = true;
  tunnel.behavior.dropNextSyncAck = true;
  await wake(page);
  await until(
    () => tunnel.traffic.droppedSyncAcks === 1,
    'Sync ACK fault did not execute',
  );
  const droppedAt = tunnel.traffic.lastDroppedAckAt;
  const after = await changedCountdown();
  await until(
    () => tunnel.traffic.acceptedConnections > accepted,
    'Five-second sync deadline did not rebuild the falsely live TLS connection',
  );
  const rebuiltMs = tunnel.traffic.acceptedAt.at(-1) - droppedAt;
  assert.ok(
    rebuiltMs >= 4000 && rebuiltMs < 15000,
    `Unexpected sync rebuild time: ${rebuiltMs}ms`,
  );
  const dom = await rendered(page, after);
  await ready(page);
  await sameIdentity(page, token);
  const ackDropToRenderMs = Date.now() - droppedAt;
  assert.deepEqual(
    page.navigationCounts,
    navigationCounts,
    'Synchronization reloaded the shell or player iframe',
  );
  await snapshot(page, 'tls-missing-sync-ack');
  await checked(
    'Dropped push and room:sync ACK rebuild the TLS polling connection after five seconds and render the current inner revision without reload',
    { rebuiltMs, ackDropToRenderMs, after: dom },
  );
}
async function actionCase(token, page, tunnel) {
  tunnel.behavior.dropViews = true;
  tunnel.behavior.dropNextActionAck = true;
  tunnel.behavior.dropNextSyncAck = true;
  const navigationCounts = { ...page.navigationCounts };
  const firstOperation = tunnel.traffic.operations.length;
  const before = await view(token);
  const self = before.seats.find((seat) => seat.id === before.self.seatId);
  await clickPlayer(page, self.ready ? '取消准备' : '我准备好了');
  await until(
    () => tunnel.traffic.droppedActionAcks === 1,
    'Action ACK fault did not execute',
  );
  await until(
    async () => (await view(token)).revision === before.revision + 1,
    'Ready operation was not saved exactly once',
  );
  const committed = await view(token);
  await until(
    () => tunnel.traffic.operations.length >= firstOperation + 2,
    'Pending action was not automatically confirmed again after reconnect',
    25000,
  );
  const operations = tunnel.traffic.operations.slice(firstOperation);
  assert.ok(operations.length >= 2);
  assert.equal(
    new Set(operations.map((item) => item.actionId)).size,
    1,
    'Retry generated a new actionId',
  );
  assert.equal(
    new Set(operations.map((item) => item.fingerprint)).size,
    1,
    'Retry changed the original authority envelope',
  );
  await until(
    () => tunnel.traffic.actionReplies.at(-1)?.ok === true,
    'Deduplicated action confirmation was not received',
  );
  assert.equal(
    (await view(token)).revision,
    committed.revision,
    'Retry saved a second operation',
  );
  const dom = await rendered(page, committed);
  await ready(page);
  await sameIdentity(page, token);
  await until(
    async () =>
      await (
        await playerFrame(page)
      )
        .getByRole('button', {
          name: self.ready ? '我准备好了' : '取消准备',
          exact: true,
        })
        .isEnabled(),
    'Pending confirmation did not unlock the real player action',
  );
  assert.deepEqual(page.navigationCounts, navigationCounts);
  const confirmationMs = Date.now() - operations[0].sentAt;
  await snapshot(page, 'tls-action-receipt-deduplicated');
  await checked(
    'Lost action reply and next sync ACK automatically resend one unchanged actionId/envelope; authority deduplicates and unlocks the real UI',
    {
      transmissions: operations.length,
      resendMs: operations[1].sentAt - operations[0].sentAt,
      confirmationMs,
      actionId: operations[0].actionId,
      fingerprint: operations[0].fingerprint,
      revisionDelta: committed.revision - before.revision,
      after: dom,
    },
  );
}
async function offlineCase(token, page, tunnel) {
  const navigationCounts = { ...page.navigationCounts };
  tunnel.behavior.offline = true;
  tunnel.disconnect();
  await until(
    async () =>
      (await (
        await playerFrame(page)
      )
        .locator('.connection.online')
        .count()) === 0,
    'Offline UI kept its confirmed connection',
  );
  const after = await changedCountdown();
  await wait(500);
  tunnel.behavior.offline = false;
  const restoredAt = Date.now();
  // This models the browser's network-restored notification, not a reload.
  await wake(page);
  const dom = await rendered(page, after);
  await ready(page);
  await sameIdentity(page, token);
  assert.deepEqual(page.navigationCounts, navigationCounts);
  await snapshot(page, 'tls-network-restored');
  await checked(
    'A closed TLS proxy connection makes operations readonly and recovers the current inner view after the network-restored event',
    {
      syntheticNetworkEvent: true,
      restoreToRenderMs: Date.now() - restoredAt,
      after: dom,
    },
  );
}
async function freezeCase(token, page, tunnel) {
  const navigationCounts = { ...page.navigationCounts };
  tunnel.behavior.dropViews = true;
  const frame = await playerFrame(page);
  let cdp, frameSessionFailure;
  try {
    cdp = await page.context().newCDPSession(frame);
  } catch (error) {
    frameSessionFailure = redact(error.message);
    cdp = await page.context().newCDPSession(page);
  }
  const probe = await frame.evaluate(() => {
    window.__tablemaxRemoteFreezeTicks = 0;
    return setInterval(() => window.__tablemaxRemoteFreezeTicks++, 100);
  });
  try {
    let pausedProbeTicksAtEntry = 0;
    if (freezeMode === 'lifecycle') {
      await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    } else {
      let paused;
      cdp.on('Debugger.paused', (event) => {
        paused = event;
      });
      await cdp.send('Debugger.enable');
      await cdp.send('Debugger.pause');
      await until(
        () => Boolean(paused),
        'Debugger did not pause the player execution context',
      );
      const baseline = await cdp.send('Debugger.evaluateOnCallFrame', {
        callFrameId: paused.callFrames[0].callFrameId,
        expression:
          "window.top.document.querySelector('iframe[data-player-frame]').contentWindow.__tablemaxRemoteFreezeTicks",
        returnByValue: true,
      });
      assert.ok(
        Number.isSafeInteger(baseline.result.value),
        'Paused context could not inspect the actual iframe probe',
      );
      pausedProbeTicksAtEntry = baseline.result.value;
    }
    const after = await changedCountdown();
    await wait(1100);
    const resumedAt = Date.now();
    await cdp.send(
      freezeMode === 'lifecycle'
        ? 'Page.setWebLifecycleState'
        : 'Debugger.resume',
      freezeMode === 'lifecycle' ? { state: 'active' } : {},
    );
    const resumedProbeTicks = await frame.evaluate((timer) => {
      clearInterval(timer);
      const ticks = window.__tablemaxRemoteFreezeTicks;
      delete window.__tablemaxRemoteFreezeTicks;
      return ticks;
    }, probe);
    const frozenFrameTicks = resumedProbeTicks - pausedProbeTicksAtEntry;
    assert.ok(
      frozenFrameTicks <= 2,
      `CDP did not freeze the actual player iframe: ${frozenFrameTicks} timer ticks`,
    );
    const dom = await rendered(page, after, 25000);
    await ready(page);
    await sameIdentity(page, token);
    assert.deepEqual(page.navigationCounts, navigationCounts);
    await snapshot(page, 'tls-frozen-inner-recovered');
    await checked(
      'CDP pauses the actual player iframe execution; resuming with broadcasts still filtered automatically renders the latest saved inner revision',
      {
        resumeToRenderMs: Date.now() - resumedAt,
        frozenFrameTicks,
        pausedProbeTicksAtEntry,
        syntheticWake: false,
        freezeMode,
        frameSessionFailure,
        lifecycleClaim: false,
        after: dom,
      },
    );
  } finally {
    await cdp
      .send(
        freezeMode === 'lifecycle'
          ? 'Page.setWebLifecycleState'
          : 'Debugger.resume',
        freezeMode === 'lifecycle' ? { state: 'active' } : {},
      )
      .catch(() => {});
    if (freezeMode === 'debugger')
      await cdp.send('Debugger.disable').catch(() => {});
    await frame
      .evaluate((timer) => {
        clearInterval(timer);
        delete window.__tablemaxRemoteFreezeTicks;
      }, probe)
      .catch(() => {});
    await cdp.detach();
  }
}
async function wssCase(token) {
  const tunnel = await proxy('tls-wss', true);
  const page = await player(token, tunnel);
  await until(
    () =>
      tunnel.traffic.acceptedUpgrades > 0 && tunnel.traffic.engineUpgradeSent,
    'Engine.IO did not finish the TLS WebSocket upgrade',
  );
  // 101 plus 3probe is insufficient. Packet 5 and a WSS authorized sync ACK
  // prove both client and server have switched their active transports.
  await wake(page);
  await until(
    () =>
      tunnel.traffic.syncReplies.some(
        (reply) => reply.transport === 'websocket',
      ),
    'WSS transport did not confirm an authorized view',
  );
  await ready(page);
  const navigationCounts = { ...page.navigationCounts };
  const before = await view(token);
  const self = before.seats.find((seat) => seat.id === before.self.seatId);
  const firstOperation = tunnel.traffic.operations.length;
  const started = Date.now();
  await clickPlayer(page, self.ready ? '取消准备' : '我准备好了');
  await until(
    async () => (await view(token)).revision > before.revision,
    'Real player WSS operation did not reach the authority',
  );
  const after = await view(token);
  const dom = await rendered(page, after);
  const operationToRenderMs = Date.now() - started;
  assert.ok(
    operationToRenderMs < 5000,
    `Live WSS push was not immediate: ${operationToRenderMs}ms`,
  );
  assert.ok(
    tunnel.traffic.operations
      .slice(firstOperation)
      .some((item) => item.transport === 'websocket' && item.type === 'ready'),
  );
  await until(
    () =>
      tunnel.traffic.views.some(
        (state) => state.transport === 'websocket' && sameVersion(state, after),
      ),
    'Saved operation was not pushed back through WSS',
  );
  await until(
    async () =>
      await (
        await playerFrame(page)
      )
        .getByRole('button', {
          name: self.ready ? '我准备好了' : '取消准备',
          exact: true,
        })
        .isEnabled(),
    'WSS operation never received its saving confirmation',
  );
  assert.ok(
    tunnel.traffic.websocketPaths.every(
      (path) => path === tunnel.url.replace(/^https:/, 'wss:') + '/socket.io/',
    ),
  );
  assert.deepEqual(page.navigationCounts, navigationCounts);
  await sameIdentity(page, token);
  await snapshot(page, 'tls-wss-bidirectional');
  await checked(
    'HTTPS nonstandard root mapping upgrades to WSS /socket.io/; the real player operation and saved revision travel both ways without CSP errors',
    {
      entryOrigin: tunnel.url,
      operationToRenderMs,
      websocketPaths: tunnel.traffic.websocketPaths,
      before: version(before),
      after: dom,
      certificate:
        'One-day local fixture; trust ignored only in the isolated browser context',
    },
  );
}
async function transferCase(token, phase) {
  const tunnel = await proxy(`tls-transfer-${phase}`);
  const oldPage = await player(token, tunnel);
  const replacement = await player('', tunnel, true);
  const before = await view(token);
  const seatId = before.self.seatId;
  await clickPlayer(replacement, '换手机进入');
  const replacementFrame = await playerFrame(replacement);
  await replacementFrame
    .getByLabel('原座位', { exact: true })
    .selectOption(seatId);
  await clickPlayer(replacement, '申请接续座位');
  const requestedAt = Date.now();
  await replacementFrame.locator('.device-transfer__code strong').waitFor();
  const transferProof = await replacementFrame.evaluate(
    () =>
      JSON.parse(localStorage.getItem('tablemax-device-transfer')).requestKey,
  );
  secrets.add(transferProof);
  await until(
    async () => (await view()).transferRequests?.length === 1,
    'Replacement request was not visible to the administrator',
  );
  const pending = await view();
  const code = pending.transferRequests[0].verificationCode;
  assert.equal(
    await replacementFrame.locator('.device-transfer__code strong').innerText(),
    code,
  );
  assert.equal(
    Object.hasOwn(await view(''), 'transferRequests'),
    false,
    'Public view exposed administrator requests',
  );
  assert.equal(
    Object.hasOwn(await view(token), 'transferRequests'),
    false,
    'Player view exposed administrator requests',
  );
  const oldSocket = await connect(token);
  const rejected = await oldSocket.timeout(5000).emitWithAck('room:command', {
    actionId: randomUUID(),
    ...version(await view(token)),
    command: {
      type: 'approve-transfer',
      requestId: pending.transferRequests[0].requestId,
    },
  });
  assert.equal(rejected.ok, false, 'Player approved a transfer');
  for (
    let count = 0;
    count < 3 && (await host.locator('dialog[open]').count());
    count++
  )
    await host
      .getByRole('button', { name: '关闭面板', exact: true })
      .last()
      .click();
  if (
    !(await host.getByRole('button', { name: '管理设置', exact: true }).count())
  )
    await host.getByRole('link', { name: '‹ 盒子', exact: true }).click();
  await host.getByRole('button', { name: '管理设置', exact: true }).click();
  await host
    .locator('.device-transfer-request')
    .getByRole('button', { name: '批准换机', exact: true })
    .click();
  const approvedAt = Date.now();
  await host
    .getByRole('button', { name: '批准并退出旧设备', exact: true })
    .click();
  await until(
    async () =>
      Boolean(
        await (
          await playerFrame(replacement)
        ).evaluate(() => localStorage.getItem('tablemax-player')),
      ),
    'Replacement browser did not receive its credential',
    20000,
  );
  const nextToken = await (
    await playerFrame(replacement)
  ).evaluate(() => localStorage.getItem('tablemax-player'));
  secrets.add(nextToken);
  transferRecovery = {
    requestKey: transferProof,
    token: nextToken,
    oldToken: token,
  };
  assert.notEqual(nextToken, token);
  const after = await view(nextToken);
  assert.equal(after.self.role, 'player');
  assert.equal(after.self.seatId, seatId);
  assert.equal(after.ownerSeatId, before.ownerSeatId);
  assert.equal(after.instanceId, before.instanceId);
  assert.equal(after.status, before.status);
  assert.deepEqual(after.game, before.game);
  assert.deepEqual(after.gameView, before.gameView);
  const offlineSeats = (seats) =>
    seats.map((seat) => {
      const retained = { ...seat };
      delete retained.online;
      return retained;
    });
  assert.deepEqual(offlineSeats(after.seats), offlineSeats(before.seats));
  assert.equal(
    (await post('/api/session/view', { token })).ok,
    false,
    'Old credential still authorized a view',
  );
  await until(
    () => !oldSocket.connected,
    'Old authorized socket remained connected',
  );
  await until(
    async () =>
      await (
        await playerFrame(oldPage)
      ).evaluate(() => localStorage.getItem('tablemax-player') === null),
    'Old UI kept a revoked credential',
  );
  const dom = await rendered(replacement, after);
  await ready(replacement);
  if (before.gameView)
    await playerUi(replacement).locator('main.ma-screen.player').waitFor();
  const approvalToRenderMs = Date.now() - approvedAt;
  await snapshot(replacement, `tls-replacement-approved-${phase}`);
  await checked(
    'A new TLS browser requests its real seat; only the native administrator approves through management UI, then the replacement renders as player and the old credential/socket are revoked',
    {
      retainedSeat: seatId,
      retainedOwner: after.ownerSeatId,
      retainedGameState: true,
      transferDuring: before.status,
      requestToApprovalMs: approvedAt - requestedAt,
      approvalToRenderMs,
      after: dom,
    },
  );
  return nextToken;
}
async function transferPhases(initialToken) {
  const seatId = (await view(initialToken)).self.seatId;
  await command({ type: 'set-owner', seatId });
  let token = await transferCase(initialToken, 'lobby');
  const otherTokens = [];
  for (let index = 0; index < 2; index++) {
    const input = {
      name: `接续陪测${index + 1}`,
      requestKey: randomBytes(32).toString('hex'),
    };
    secrets.add(input.requestKey);
    const joined = await post('/api/session/join', input);
    assert.equal(joined.ok, true, joined.reason ?? 'Companion join rejected');
    secrets.add(joined.token);
    otherTokens.push(joined.token);
    admissionRecovery = { input, token: joined.token };
  }
  for (const credential of [token, ...otherTokens]) {
    const socket = await connect(credential);
    const state = await view(credential);
    const reply = await socket.timeout(5000).emitWithAck('room:command', {
      actionId: randomUUID(),
      ...version(state),
      command: { type: 'ready', ready: true },
    });
    assert.equal(reply.ok, true, reply.reason ?? 'Ready rejected');
  }
  const playing = await command({ type: 'start' });
  assert.equal(playing.status, 'playing');
  token = await transferCase(token, 'playing');
  const ended = await command({ type: 'end' });
  assert.equal(ended.status, 'ended');
  await transferCase(token, 'ended');
}

async function persistedReceiptCase(portable) {
  assert.ok(admissionRecovery && transferRecovery);
  const before = await view(transferRecovery.token);
  for (const socket of sockets) socket.disconnect();
  await browser.close();
  browser = undefined;
  for (const tunnel of tunnels) tunnel.disconnect();
  await desktop.close();
  desktop = undefined;

  // Inspect only the isolated fixture after the owning actual service exits.
  // No cipher, digest, proof or credential is retained in evidence.
  const database = new DatabaseSync(join(work, 'data', 'room.sqlite'), {
    readOnly: true,
  });
  let admissionCipher, transferCipher;
  try {
    const persisted = readCurrentSave(database);
    admissionCipher =
      persisted.sessionReceipts[sha256(admissionRecovery.input.requestKey)]
        .sealedCredential;
    transferCipher =
      persisted.transferRequests[sha256(transferRecovery.requestKey)]
        .sealedCredential;
    assert.ok(
      /^02[0-9a-f]{120}$/.test(admissionCipher),
      'Admission receipt is not version 02',
    );
    assert.ok(
      /^02[0-9a-f]{120}$/.test(transferCipher),
      'Transfer receipt is not version 02',
    );
  } finally {
    database.close();
  }
  const restartedAt = Date.now();
  desktop = await launchDesktop({
    executablePath: join(portable, 'TableMax.exe'),
    soundEnabled: false,
    env: {
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_DATA_DIR: join(work, 'data'),
    },
  });
  host = await desktop.firstWindow();
  await host.locator('[data-room-revision]').waitFor();
  origin = new URL(host.url()).origin;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  secrets.add(hostToken);
  const recoveredAdmission = await post(
    '/api/session/join',
    admissionRecovery.input,
  );
  assert.equal(
    recoveredAdmission.ok,
    true,
    recoveredAdmission.reason ?? 'Admission receipt reload failed',
  );
  assert.ok(
    recoveredAdmission.token === admissionRecovery.token,
    'Admission receipt rotated the credential',
  );
  const recoveredTransfer = await post('/api/session/transfer/status', {
    requestKey: transferRecovery.requestKey,
  });
  assert.equal(
    recoveredTransfer.ok,
    true,
    recoveredTransfer.reason ?? 'Transfer receipt reload failed',
  );
  assert.equal(recoveredTransfer.transfer.status, 'approved');
  assert.ok(
    recoveredTransfer.transfer.token === transferRecovery.token,
    'Transfer receipt rotated the credential',
  );
  assert.equal(
    (await post('/api/session/view', { token: transferRecovery.oldToken })).ok,
    false,
  );
  const after = await view(transferRecovery.token);
  assert.equal(after.self.role, 'player');
  assert.equal(after.self.seatId, before.self.seatId);
  assert.equal(after.ownerSeatId, before.ownerSeatId);
  assert.equal(after.status, before.status);
  assert.deepEqual(after.gameView, before.gameView);
  assert.ok(
    sameVersion(after, before),
    'Service restart changed the saved game revision',
  );
  browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
    soundEnabled: false,
    args: ['--ignore-certificate-errors'],
  });
  const tunnel = await proxy('tls-persisted-receipts');
  const page = await player(transferRecovery.token, tunnel, true);
  const dom = await rendered(page, after);
  await ready(page);
  await playerUi(page)
    .getByRole('link', { name: '进入牌桌', exact: true })
    .click();
  await playerUi(page).locator('main.ma-screen.player').waitFor();
  const gameDom = await rendered(page, after);
  await snapshot(page, 'tls-receipts-actual-service-reload');
  await checked(
    'Actual service restart reads version 02 join and approved-transfer receipts with the original proofs; the same player renders the ended game and the old credential remains revoked',
    {
      admissionCipherVersion: '02',
      admissionCipherHexLength: admissionCipher.length,
      transferCipherVersion: '02',
      transferCipherHexLength: transferCipher.length,
      recoveredAdmissionSameCredential: true,
      recoveredTransferSameCredential: true,
      oldCredentialRevoked: true,
      retainedSeat: after.self.seatId,
      restartToRenderMs: Date.now() - restartedAt,
      after: gameDom,
      boxAfterReload: dom,
    },
  );
}

async function verifyPackage() {
  const archiveBytes = await readFile(archive);
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(
    manifest.version,
    packageVersion,
    'Current source version and delivered manifest differ',
  );
  assert.equal(basename(archive), manifest.archive.name);
  report.archiveSha256 = sha256(archiveBytes);
  report.manifestSha256 = sha256(await readFile(manifestPath));
  assert.equal(report.archiveSha256, manifest.archive.sha256);
  if (expectedSha)
    assert.equal(
      report.archiveSha256,
      expectedSha.toLowerCase(),
      'ZIP differs from the explicitly pinned delivery',
    );
  assert.equal(archiveBytes.length, manifest.archive.bytes);
  assert.ok(
    manifest.archive.bytes < MAXIMUM_PACKAGE_BYTES &&
      manifest.extractedBytes < MAXIMUM_PACKAGE_BYTES,
  );
  await mkdir(resolve('tmp'), { recursive: true });
  work = await mkdtemp(resolve('tmp/debug-remote-'));
  const portable = join(work, 'portable');
  await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:REMOTE_ARCHIVE -DestinationPath $env:REMOTE_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        REMOTE_ARCHIVE: archive,
        REMOTE_EXTRACT: portable,
      },
    },
  );
  let extractedBytes = 0;
  const expectedFiles = new Set();
  for (const file of manifest.files) {
    const path = resolve(portable, file.path);
    assert.ok(
      path.startsWith(portable + sep),
      'Manifest file escapes the extracted root',
    );
    const bytes = await readFile(path);
    assert.equal(
      bytes.length,
      file.bytes,
      `File byte count differs: ${file.path}`,
    );
    assert.equal(
      sha256(bytes),
      file.sha256,
      `File SHA256 differs: ${file.path}`,
    );
    extractedBytes += bytes.length;
    expectedFiles.add(file.path.replaceAll('\\', '/'));
  }
  const actualFiles = new Set();
  async function inventory(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      assert.equal(
        item.isSymbolicLink(),
        false,
        'Portable ZIP contains a linked path',
      );
      const path = join(directory, item.name);
      if (item.isDirectory()) await inventory(path);
      else actualFiles.add(relative(portable, path).replaceAll('\\', '/'));
    }
  }
  await inventory(portable);
  assert.deepEqual(actualFiles, expectedFiles);
  assert.equal(extractedBytes, manifest.extractedBytes);
  assert.equal(actualFiles.size, manifest.fileCount);
  await checked(
    'Dynamic current-version ZIP SHA and every actual extracted file match the delivery manifest; both byte limits pass',
    {
      archive: basename(archive),
      extractedFiles: actualFiles.size,
      extractedBytes,
      explicitlyPinned: Boolean(expectedSha),
    },
  );
  return portable;
}

function packetSelfTest() {
  const behavior = {
    dropViews: true,
    dropNextSyncAck: true,
    dropNextActionAck: true,
  };
  const traffic = {
    syncRequests: 0,
    operations: [],
    views: [],
    syncReplies: [],
    actionReplies: [],
    droppedViews: 0,
    droppedSyncAcks: 0,
    droppedActionAcks: 0,
  };
  const acknowledgements = new Map();
  observeOutgoing(
    '420["room:sync"]',
    'polling',
    'first',
    traffic,
    behavior,
    acknowledgements,
  );
  observeOutgoing(
    '420["room:sync"]',
    'polling',
    'second',
    traffic,
    behavior,
    acknowledgements,
  );
  const state = { instanceId: 'public-instance', branch: 1, revision: 4 };
  const reply = '430' + JSON.stringify([{ ok: true, view: state }]);
  assert.equal(
    observeIncoming(
      reply,
      'polling',
      'second',
      traffic,
      behavior,
      acknowledgements,
    ),
    true,
  );
  assert.equal(
    observeIncoming(
      reply,
      'polling',
      'first',
      traffic,
      behavior,
      acknowledgements,
    ),
    false,
  );
  assert.equal(
    traffic.droppedSyncAcks,
    1,
    'ACK fault must be scoped to one Engine.IO connection',
  );
  assert.equal(
    observeIncoming(
      '42' + JSON.stringify(['room:view', state]),
      'polling',
      'first',
      traffic,
      behavior,
      acknowledgements,
    ),
    false,
  );
  assert.equal(traffic.droppedViews, 1);
  const envelope = {
    actionId: 'opaque-operation',
    ...state,
    command: { type: 'ready', ready: true },
  };
  const packet = '421' + JSON.stringify(['room:command', envelope]);
  observeOutgoing(
    packet,
    'polling',
    'first',
    traffic,
    behavior,
    acknowledgements,
  );
  assert.equal(
    observeIncoming(
      '431[{"ok":true}]',
      'polling',
      'first',
      traffic,
      behavior,
      acknowledgements,
    ),
    false,
  );
  observeOutgoing(
    packet,
    'polling',
    'first',
    traffic,
    behavior,
    acknowledgements,
  );
  assert.equal(
    observeIncoming(
      '431[{"ok":true}]',
      'polling',
      'first',
      traffic,
      behavior,
      acknowledgements,
    ),
    true,
  );
  assert.equal(traffic.droppedActionAcks, 1);
  assert.equal(
    traffic.operations[0].fingerprint,
    traffic.operations[1].fingerprint,
  );
  assert.equal(traffic.actionReplies[0].ok, true);
  assert.equal(
    JSON.stringify(traffic).includes('"command"'),
    false,
    'Evidence must not contain raw authority payloads',
  );
  console.log(
    'Remote packet filter self-test passed: isolated ACK IDs, one-shot losses and opaque retry fingerprints',
  );
}
if (process.argv.includes('--self-test')) {
  packetSelfTest();
  process.exit(0);
}

await mkdir(output, { recursive: true });
console.log('Remote evidence: ' + output);
try {
  const portable = await verifyPackage();
  if (!preflightOnly) {
    desktop = await launchDesktop({
      executablePath: join(portable, 'TableMax.exe'),
      soundEnabled: false,
      env: {
        TABLEMAX_HOST: '127.0.0.1',
        TABLEMAX_PORT: '0',
        TABLEMAX_DATA_DIR: join(work, 'data'),
      },
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
    hostSocket = await connect(hostToken);
    await command({ type: 'select-game', gameId: 'modern-art' });
    const joined = await post('/api/session/join', {
      name: '远程专项玩家',
      requestKey: randomBytes(32).toString('hex'),
    });
    assert.equal(joined.ok, true, joined.reason ?? 'Join rejected');
    secrets.add(joined.token);
    browser = await launchTestBrowser({
      channel: 'msedge',
      headless: true,
      soundEnabled: false,
      args: ['--ignore-certificate-errors'],
    });
    if (
      ['all', 'polling', 'ack', 'action', 'offline', 'freeze'].includes(
        scenario,
      )
    ) {
      const { page, tunnel } = await pollingCase(joined.token);
      if (['all', 'ack'].includes(scenario))
        await ackCase(joined.token, page, tunnel);
      if (['all', 'action'].includes(scenario))
        await actionCase(joined.token, page, tunnel);
      if (['all', 'offline'].includes(scenario))
        await offlineCase(joined.token, page, tunnel);
      if (['all', 'freeze'].includes(scenario))
        await freezeCase(joined.token, page, tunnel);
    }
    if (['all', 'wss'].includes(scenario)) await wssCase(joined.token);
    if (['all', 'transfer'].includes(scenario)) {
      await transferPhases(joined.token);
      await persistedReceiptCase(portable);
    }
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.cspErrors, []);
  }
  assert.equal(
    sha256(await readFile(archive)),
    report.archiveSha256,
    'Delivered ZIP changed during verification',
  );
  assert.equal(
    sha256(await readFile(manifestPath)),
    report.manifestSha256,
    'Delivery manifest changed during verification',
  );
  report.status = preflightOnly ? 'preflight-passed' : 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = redact(error.stack ?? error.message ?? error);
  for (const [index, page] of pages.entries())
    if (!page.isClosed())
      await captureBrowserScreenshot(page, {
        path: join(output, `failed-page-${index}.png`),
        fullPage: true,
      }).catch(() => {});
} finally {
  for (const socket of sockets) socket.disconnect();
  const cleanupErrors = [];
  await browser
    ?.close()
    .catch((error) => cleanupErrors.push(redact(error.message)));
  for (const tunnel of tunnels) {
    tunnel.disconnect();
    tunnel.server.closeAllConnections();
    await new Promise((done) => tunnel.server.close(done)).catch((error) =>
      cleanupErrors.push(redact(error.message)),
    );
  }
  await desktop
    ?.close()
    .catch((error) => cleanupErrors.push(redact(error.message)));
  report.cleanupErrors = cleanupErrors;
  if (cleanupErrors.length) {
    report.status = 'failed';
    report.failure ??= 'Verification process cleanup failed';
  }
  await save();
}
if (report.status === 'failed') throw new Error(report.failure);
