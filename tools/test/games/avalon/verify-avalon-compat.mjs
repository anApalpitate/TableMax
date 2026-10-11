import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { launchDesktop } from '../../support/desktop-test.mjs';
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const oldExe = resolve(process.argv[2]);
const newExe = resolve(process.argv[3]);
const output = resolve('artifacts/avalon/validation/bug-four-legacy-restore');
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/avalon-compat-'));
const report = {
  status: 'running',
  oldExe,
  newExe,
  work,
  checks: [],
  scope:
    'Actual old and new packaged native services, isolated SQLite data, loopback, muted. No physical device certification.',
};
let desktop, origin, hostToken, hostSocket;
const sockets = [];
async function start(executablePath, data) {
  desktop = await launchDesktop({
    executablePath,
    soundEnabled: false,
    env: {
      ...process.env,
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_DATA_DIR: data,
    },
  });
  const page = await desktop.firstWindow();
  await page.locator('.connection.online').waitFor();
  origin = new URL(page.url()).origin;
  hostToken = await page.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  hostSocket = await connect(hostToken);
}
async function connect(token) {
  const socket = io(origin, { auth: { token }, forceNew: true });
  sockets.push(socket);
  await new Promise((done, reject) => {
    socket.once('connect', done);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function view(token = hostToken) {
  const reply = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  ).json();
  assert.equal(reply.ok, true);
  return reply.view;
}
async function send(socket, token, command) {
  const before = await view(token);
  const reply = await socket
    .timeout(8000)
    .emitWithAck('room:command', {
      actionId: randomUUID(),
      instanceId: before.instanceId,
      branch: before.branch,
      revision: before.revision,
      command,
    });
  assert.equal(reply.ok, true, reply.reason);
}
async function stop() {
  for (const socket of sockets.splice(0)) socket.disconnect();
  await desktop?.close();
  desktop = null;
}
try {
  for (const [count, variant] of [
    [5, 'classic'],
    [6, 'court'],
  ]) {
    const data = join(work, `${count}-${variant}`);
    await start(oldExe, data);
    await send(hostSocket, hostToken, {
      type: 'select-game',
      gameId: 'avalon',
    });
    await send(hostSocket, hostToken, {
      type: 'select-variant',
      variantId: variant,
    });
    const players = [];
    for (let i = 0; i < count; i++) {
      const reply = await (
        await fetch(origin + '/api/session/join', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: `Legacy ${i + 1}`,
            avatarId: `avatar-${i + 1}`,
          }),
        })
      ).json();
      assert.equal(reply.ok, true);
      const socket = await connect(reply.token);
      players.push({ token: reply.token, socket });
      await send(socket, reply.token, { type: 'ready', ready: true });
    }
    await send(hostSocket, hostToken, { type: 'start' });
    const act = async (player, action) =>
      send(player.socket, player.token, {
        type: 'game',
        decisionId: (await view(player.token)).decisionId,
        action,
      });
    for (const player of players) await act(player, { type: 'acknowledge' });
    for (const player of players) {
      const own = await view(player.token);
      if (own.actions.length) {
        await act(player, own.actions[0]);
        break;
      }
    }
    await act(players[0], { type: 'vote-team', vote: 'reject' });
    const saved = await Promise.all(
      players.map(async (player) => (await view(player.token)).gameView),
    );
    await stop();
    await start(newExe, data);
    for (let i = 0; i < count; i++) {
      const restored = await view(players[i].token);
      assert.equal(restored.paused, true);
      const { evilCount, questFailThresholds, ...legacy } = restored.gameView;
      assert.equal(evilCount, 2);
      assert.deepEqual(questFailThresholds, [1, 1, 1, 1, 1]);
      assert.deepEqual(legacy, saved[i]);
      players[i].socket = await connect(players[i].token);
    }
    assert.equal((await view()).gameView.self, null);
    await send(hostSocket, hostToken, { type: 'resume' });
    for (const player of players.slice(1))
      await act(player, { type: 'vote-team', vote: 'approve' });
    assert.equal((await view()).gameView.phase, 'quest');
    report.checks.push(
      `${count}/${variant}: actual old SQLite role, sealed vote and projection restored; remaining vote resumes correctly`,
    );
    await stop();
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await stop();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      output,
    }),
  );
}
