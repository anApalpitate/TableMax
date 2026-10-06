import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { launchDesktop } from './desktop-test.mjs';

const args = process.argv.slice(2);
assert.ok(
  args.every(
    (arg) => arg === '--portable' || /^--evidence=[a-zA-Z0-9_-]+$/.test(arg),
  ),
);
const name =
  args.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  `run-${Date.now()}`;
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const output = resolve(
  `artifacts/maintenance/v${version}/pokemon-expansion-normal-play`,
  name,
);
await mkdir(resolve(output, '..'), { recursive: true });
await mkdir(output, { recursive: false });
const work = await mkdtemp(resolve('tmp/pokemon-expansion-normal-play-'));
const manifest = JSON.parse(
  await readFile(
    `artifacts/releases/TableMax-${version}-win-x64-manifest.json`,
    'utf8',
  ),
);
const archive = resolve('artifacts/releases', manifest.archive.name);
const hash = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
assert.equal(await hash(archive), manifest.archive.sha256);
const portable = args.includes('--portable');
let executablePath = resolve('build/desktop/TableMax.exe');
if (portable) {
  await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_PLAY_ARCHIVE -DestinationPath $env:TABLEMAX_PLAY_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_PLAY_ARCHIVE: archive,
        TABLEMAX_PLAY_EXTRACT: join(work, 'portable'),
      },
    },
  );
  executablePath = join(work, 'portable/TableMax.exe');
}
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const report = {
  status: 'running',
  startedAt: new Date().toISOString(),
  portable,
  archiveSha256: portable ? manifest.archive.sha256 : null,
  scope:
    'Actual normal play mode, production UI clicks by two automated phone identities and one real default Worker. No test mode, injected game state or game commands outside UI. Administrative setup uses authority Socket actions. Automated wall time is not human round duration, physical phone or human listening evidence.',
  steps: [],
  screenshots: [],
  phases: [],
  botActions: 0,
  pageErrors: [],
  externalRequests: [],
  acknowledgements: [],
};
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
let desktop, hostSocket, origin;
const phones = [];
const tokens = [];
const phases = new Set();
async function view(token) {
  const reply = await (
    await fetch(`${origin}/api/session/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(reply.ok, true);
  return reply.view;
}
async function until(test, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await test()) return;
    await delay(100);
  }
  throw Error(description);
}
async function command(token, command) {
  const current = await view(token);
  const reply = await new Promise((done, reject) =>
    hostSocket.timeout(8000).emit(
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
function observe(page, index) {
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin)
      report.externalRequests.push(request.url());
  });
  const pending = new Map();
  page.on('websocket', (socket) => {
    socket.on('framesent', ({ payload }) => {
      const match = /^42(\d+)(\[.*)$/.exec(String(payload));
      if (!match) return;
      const [event, envelope] = JSON.parse(match[2]);
      if (event !== 'room:command') return;
      const item = {
        phone: index,
        command: envelope.command.type,
        actionType: envelope.command.action?.type,
        revisionBefore: envelope.revision,
        sentAt: Date.now(),
        ok: null,
      };
      pending.set(match[1], item);
      report.acknowledgements.push(item);
    });
    socket.on('framereceived', ({ payload }) => {
      const match = /^43(\d+)(\[.*)$/.exec(String(payload));
      if (!match || !pending.has(match[1])) return;
      const [reply] = JSON.parse(match[2]);
      const item = pending.get(match[1]);
      item.ok = reply.ok;
      item.elapsedMs = Date.now() - item.sentAt;
      if (!reply.ok) item.error = reply.error;
      pending.delete(match[1]);
    });
  });
}
async function screenshot(page, name) {
  const native = await desktop.browserWindow(page);
  const png = await native.evaluate(async (w) =>
    (await w.webContents.capturePage()).toPNG().toString('base64'),
  );
  await writeFile(join(output, name + '.png'), Buffer.from(png, 'base64'));
  report.screenshots.push(name + '.png');
}
function choose(player) {
  const actions = player.actions;
  if (player.gameView.phase === 'initial-flip')
    return actions.find((a) => a.slot === 4) ?? actions[0];
  for (const type of [
    'activate-arceus',
    'extra-draw',
    'pass-direction',
    'mewtwo-target',
    'mewtwo-exchange',
    'peek',
    'close-peek',
    'swap',
    'row-target',
  ]) {
    const action = actions.find((a) => a.type === type);
    if (action) return action;
  }
  const hidden = actions.find(
    (a) =>
      ['replace', 'mew-target'].includes(a.type) &&
      !player.gameView.boards[a.seat ?? player.self.seatId][a.slot].faceUp,
  );
  return (
    hidden ??
    actions.find((a) => a.type === 'ninja-target' && !a.swap) ??
    actions.find((a) => a.type === 'replace') ??
    actions.find((a) => a.type === 'draw' && a.source === 'deck') ??
    actions.find((a) => a.type === 'decline-ability') ??
    actions[0]
  );
}
async function clickAction(page, player, action) {
  if (action.type === 'vote-research') {
    await page
      .locator('.ex-mission-option')
      .nth(
        player.gameView.researchCandidates.findIndex(
          (task) => task.id === action.taskId,
        ),
      )
      .click();
  } else if (action.type === 'draw') {
    await page
      .locator('.ex-draw-options')
      .getByRole('button', { name: /摸牌堆/ })
      .click();
  } else if (action.type === 'row-target') {
    const target = player.seats.find((seat) => seat.id === action.seat);
    await page
      .locator('.ex-target-list')
      .getByRole('button', { name: target.name, exact: true })
      .click();
    await page
      .getByRole('button', { name: '确认交换这一整行', exact: true })
      .click();
  } else if (action.type === 'mewtwo-exchange') {
    await page
      .locator('.ex-private-peek section')
      .filter({
        has: page.getByText(`${action.slot + 1}号位`, { exact: true }),
      })
      .getByRole('button', { name: '与此牌交换', exact: true })
      .click();
  } else if ('slot' in action || 'a' in action) {
    if ('seat' in action) {
      const target = player.seats.find((seat) => seat.id === action.seat);
      await page
        .locator('.ex-target-list')
        .getByRole('button', { name: target.name, exact: true })
        .click();
    }
    const seat = action.seat ?? player.self.seatId;
    for (const slot of 'a' in action ? [action.a, action.b] : [action.slot])
      await page
        .locator(`.ex-target-board [data-slot="${seat}:${slot}"]`)
        .click();
    await page.locator('.ex-submit button').click();
  } else {
    const names = {
      'decline-ability': '放弃能力',
      'close-peek': '查看完成',
      'activate-arceus': '发动 · 每人随机一明',
      'extra-draw': '再取一张',
      'discard-held': '弃掉这张牌',
    };
    await page
      .locator('.ex-simple-actions')
      .getByRole('button', {
        name:
          action.type === 'pass-direction'
            ? action.direction === 'clockwise'
              ? '顺时针接力 ↻'
              : '逆时针接力 ↺'
            : names[action.type],
        exact: true,
      })
      .click();
  }
}
try {
  const env = {
    ...process.env,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
    TABLEMAX_DATA_DIR: join(work, 'data'),
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  if (portable)
    env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
  desktop = await launchDesktop({
    executablePath,
    args: ['--foundation-test'],
    env,
  });
  const host = await desktop.firstWindow();
  const observeMedia = () => {
    window.__pokemonMedia = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const entry = {
        source: this.currentSrc || this.src,
        playing: false,
        rejected: false,
      };
      window.__pokemonMedia.push(entry);
      this.addEventListener(
        'playing',
        () => {
          entry.playing = true;
        },
        { once: true },
      );
      const result = play.call(this);
      result.catch(() => {
        entry.rejected = true;
      });
      return result;
    };
  };
  await host.addInitScript(observeMedia);
  await host.evaluate(observeMedia);
  await host.waitForURL('**/host');
  origin = new URL(host.url()).origin;
  observe(host, 'host');
  await host
    .context()
    .route('**/*', (route) =>
      new URL(route.request().url()).hostname === '127.0.0.1'
        ? route.continue()
        : route.abort(),
    );
  await host.locator('.connection.online').waitFor();
  const hostToken = await host.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  hostSocket = io(origin, {
    auth: { token: hostToken },
    transports: ['websocket'],
  });
  await new Promise((done, reject) => {
    hostSocket.once('connect', done);
    hostSocket.once('connect_error', reject);
  });
  await command(hostToken, {
    type: 'select-game',
    gameId: 'pokemon-encounters',
  });
  await command(hostToken, { type: 'select-variant', variantId: 'expansion' });
  await host.locator('body').click({ position: { x: 1, y: 1 } });
  await host.keyboard.press('Control+Shift+F12');
  const modePanel = host.getByRole('dialog', { name: '运行模式', exact: true });
  await modePanel
    .getByRole('button', { name: '游玩模式', exact: true })
    .click();
  await until(
    async () => (await view()).playMode === 'play',
    'Production shortcut must switch the room to normal play before starting',
  );
  if (await modePanel.isVisible()) await host.keyboard.press('Escape');
  report.modeSetup =
    'Foundation renderer starts in test; production hidden administrator shortcut selected play before joining/starting. Every live phone decision is checked to remain play.';
  for (let index = 0; index < 2; index++) {
    const next = desktop.waitForEvent('window');
    await desktop.evaluate(
      ({ BrowserWindow }, config) => {
        const window = new BrowserWindow({
          show: false,
          width: config.width,
          height: config.height,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            offscreen: true,
            backgroundThrottling: false,
            partition: `persist:normal-expansion-${config.index}`,
          },
        });
        void window.loadURL(config.url);
      },
      {
        url: `${origin}/player`,
        width: index ? 390 : 320,
        height: index ? 844 : 568,
        index,
      },
    );
    const page = await next;
    observe(page, index);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: index ? 390 : 320,
      height: index ? 844 : 568,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5,
    });
    await page.locator('.connection.online').waitFor();
    await page.getByLabel('你的昵称').fill(`普通节奏${index + 1}`);
    await page.getByRole('button', { name: '加入', exact: true }).click();
    await page.getByRole('button', { name: '我准备好了', exact: true }).click();
    await page.getByRole('button', { name: '取消准备', exact: true }).waitFor();
    phones.push(page);
    tokens.push(
      await page.evaluate(() => localStorage.getItem('tablemax-player')),
    );
  }
  await command(hostToken, {
    type: 'add-bot',
    difficulty: 'default',
    name: '普通默认人机',
  });
  assert.equal((await view(hostToken)).playMode, 'play');
  await command(hostToken, { type: 'start' });
  for (const page of phones) await page.locator('.ex-vote').waitFor();
  await screenshot(phones[0], 'short-phone-vote');
  const start = Date.now();
  const captured = new Set();
  const humanSeats = new Set();
  for (const token of tokens) humanSeats.add((await view(token)).self.seatId);
  const botSeats = (await view()).seats
    .filter((seat) => !humanSeats.has(seat.id))
    .map((seat) => seat.id);
  assert.equal(botSeats.length, 1);
  const botEvents = new Set();
  while (Date.now() - start < 600000) {
    const publicView = await view();
    for (const event of publicView.gameView.events)
      if (botSeats.includes(event.action?.actor))
        botEvents.add(event.id ?? JSON.stringify(event));
    phases.add(publicView.gameView.phase);
    if (['round-result', 'match-result'].includes(publicView.gameView.phase)) {
      report.roundResult = publicView.gameView.roundResult;
      break;
    }
    let acted = false;
    for (let index = 0; index < phones.length; index++) {
      const player = await view(tokens[index]);
      assert.equal(player.playMode, 'play');
      if (!player.actions.length) continue;
      const action = choose(player);
      const baseline = report.acknowledgements.length;
      await clickAction(phones[index], player, action);
      await until(
        () =>
          report.acknowledgements
            .slice(baseline)
            .some(
              (item) =>
                item.phone === index &&
                item.actionType === action.type &&
                item.ok !== null,
            ),
        'UI action acknowledgement missing',
      );
      const ack = report.acknowledgements
        .slice(baseline)
        .find(
          (item) => item.phone === index && item.actionType === action.type,
        );
      assert.equal(ack.ok, true, JSON.stringify(ack));
      if (action.type === 'peek') {
        await phones[index].locator('.ex-private-peek').waitFor();
        for (let other = 0; other < phones.length; other++) {
          if (other === index) continue;
          assert.equal((await view(tokens[other])).gameView.peek, null);
          assert.equal(
            await phones[other].locator('.ex-private-peek').count(),
            0,
          );
        }
        assert.equal((await view()).gameView.peek, null);
        assert.equal(await host.locator('.ex-private-peek').count(), 0);
        report.privatePeekProjectionVerified = true;
      }
      report.steps.push({
        index,
        phase: player.gameView.phase,
        actionType: action.type,
        elapsedMs: Date.now() - start,
      });
      if (!captured.has(player.gameView.phase)) {
        captured.add(player.gameView.phase);
        await delay(100);
        await screenshot(
          phones[index],
          `phone-${index}-${player.gameView.phase}`,
        );
      }
      // Keep normal saved feedback visible; this is automation pacing, not measured human thinking.
      await delay(
        ['vote-research', 'initial-flip', 'draw', 'replace'].includes(
          action.type,
        )
          ? 700
          : 2000,
      );
      acted = true;
      break;
    }
    if (!acted) await delay(150);
  }
  assert.ok(
    report.roundResult,
    'Normal UI round did not finish in ten minutes',
  );
  report.automationRoundWallMs = Date.now() - start;
  const final = await view();
  report.botSeatIds = botSeats;
  report.botActions = botEvents.size;
  assert.ok(
    report.botActions > 0,
    'Real normal Worker must commit public saved actions',
  );
  report.publicEventCount = final.gameView.events.length;
  await phones[0].locator('.ex-victory').scrollIntoViewIfNeeded();
  await screenshot(phones[0], 'short-phone-result');
  await screenshot(host, 'host-result');
  report.hostMedia = await host.evaluate(() => window.__pokemonMedia);
  report.expansionCriesPlayed = report.hostMedia.filter(
    (entry) =>
      entry.source.includes('-encyclopedia-cry-v1-') &&
      entry.playing &&
      !entry.rejected,
  );
  assert.ok(
    report.expansionCriesPlayed.length > 0,
    'Actual normal host must play a newly packaged creature cry',
  );
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.externalRequests, []);
  if (portable) assert.equal(await hash(archive), manifest.archive.sha256);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack;
  throw error;
} finally {
  try {
    hostSocket?.disconnect();
    if (desktop) await desktop.close();
    if (origin)
      await until(
        async () => {
          try {
            await fetch(`${origin}/api/foundation/health`);
            return false;
          } catch {
            return true;
          }
        },
        'Owned service remained alive after desktop closed',
        12000,
      );
    report.allOwnedProcessesStopped = true;
  } catch (error) {
    report.cleanupError = error.stack;
    report.allOwnedProcessesStopped = false;
    report.status = 'failed';
    process.exitCode = 1;
  }
  report.phases = [...phases];
  report.finishedAt = new Date().toISOString();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      output,
      status: report.status,
      phases: report.phases,
      uiSteps: report.steps.length,
      automationRoundWallMs: report.automationRoundWallMs,
    }),
  );
}
