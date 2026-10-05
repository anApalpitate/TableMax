import { launchDesktop, desktopExecutable } from './desktop-test.mjs';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { platform, release, cpus } from 'node:os';
import { verificationOutput } from './verification-output.mjs';
const require = createRequire(import.meta.url);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
const verifyGuidanceSettings = process.argv.includes('--guidance-settings');
const project = JSON.parse(await readFile('package.json', 'utf8'));
const evidenceName = process.argv
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice('--evidence='.length);
if (evidenceName && !/^[a-zA-Z0-9_-]+$/.test(evidenceName))
  throw new Error('Invalid evidence directory name');
const output = verificationOutput(
  portable ? 'portable' : 'development',
  ...(evidenceName ? [evidenceName] : []),
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/pokemon-verify-'));
await build({
  entryPoints: ['games/pokemon-encounters/bot/index.ts'],
  outfile: join(work, 'driver.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const { bot } = require(join(work, 'driver.cjs'));
let executablePath = desktopExecutable,
  archive,
  archiveSha256;
if (portable) {
  archive = resolve(
    `artifacts/releases/TableMax-${project.version}-win-x64.zip`,
  );
  const extracted = await mkdtemp(resolve('tmp/portable-game-'));
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
  archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  executablePath = join(extracted, 'TableMax.exe');
}
const dataDir = await mkdtemp(resolve('tmp/pokemon-desktop-'));
const env = {
  ...process.env,
  TABLEMAX_DATA_DIR: dataDir,
  TABLEMAX_PORT: '0',
  TABLEMAX_HOST: '127.0.0.1',
};
delete env.TABLEMAX_WEB_DEV_URL;
delete env.NODE_PATH;
if (portable)
  env.PATH = `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`;
const args = ['--foundation-test', '--tablemax-test-mode'];
const evidence = {
  verifiedAt: new Date().toISOString(),
  scope:
    'Actual Windows desktop/service with Chromium phone and TV viewport simulation; no physical phone, Safari or TV claim',
  computer: { platform: platform(), release: release(), cpu: cpus()[0]?.model },
  portable,
  executablePath,
  archive,
  archiveSha256,
  dataDir,
  runs: [],
  checks: [],
  phases: [],
  externalRequests: [],
  pageErrors: [],
  screenshots: [],
  layouts: [],
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const phases = new Set();
let previous,
  tokens = [],
  activePhoneIndex = 0;
async function view(origin, token) {
  const result = await (
    await fetch(`${origin}/api/session/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    })
  ).json();
  assert.equal(result.ok, true);
  return result.view;
}
async function connect(origin, token) {
  const socket = io(origin, {
    forceNew: true,
    transports: ['websocket'],
    auth: { token },
  });
  await new Promise((r, reject) => {
    socket.once('room:view', r);
    socket.once('connect_error', reject);
  });
  return socket;
}
async function command(origin, socket, token, value) {
  const current = await view(origin, token);
  const reply = await new Promise((r, reject) =>
    socket.timeout(5000).emit(
      'room:command',
      {
        actionId: crypto.randomUUID(),
        instanceId: current.instanceId,
        revision: current.revision,
        branch: current.branch,
        command: value,
      },
      (error, reply) => (error ? reject(error) : r(reply)),
    ),
  );
  if (!reply.ok && reply.reason === 'stale-revision') return false;
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return true;
}
function observe(page, origin) {
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin)
      evidence.externalRequests.push(request.url());
  });
}
async function capture(desktop, page, name, width, height) {
  const window = await desktop.browserWindow(page);
  assert.equal(
    await window.evaluate((window) => window.isVisible()),
    false,
    'Verification windows remain hidden',
  );
  if (width) {
    await window.evaluate(
      (window, size) => window.setContentSize(size.width, size.height),
      { width, height },
    );
    // Windows DPI rounds native bounds; emulate the exact CSS viewport independently.
    const metrics = await page.context().newCDPSession(page);
    await metrics.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.waitForFunction(
      (size) => innerWidth === size.width && innerHeight === size.height,
      { width, height },
    );
  }
  await page.evaluate(() => {
    document.activeElement?.blur();
    scrollTo(0, 0);
  });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.waitForTimeout(150); // Allow the hidden compositor to finish the frame.
  const png = await window.evaluate(async (window) =>
    (
      await window.webContents.capturePage(undefined, {
        stayHidden: true,
        stayAwake: true,
      })
    )
      .toPNG()
      .toString('base64'),
  );
  await writeFile(join(output, `${name}.png`), Buffer.from(png, 'base64'));
  evidence.screenshots.push(`${name}.png`);
  await window.evaluate((window) => window.hide());
}
async function phone(desktop, origin, index) {
  const next = desktop.waitForEvent('window');
  await desktop.evaluate(
    ({ BrowserWindow }, config) => {
      const window = new BrowserWindow({
        frame: false,
        show: false,
        width: config.width,
        height: config.height,
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true,
          backgroundThrottling: false,
          offscreen: true,
          partition: `persist:phone-${config.index}`,
        },
      });
      window.setContentSize(config.width, config.height);
      void window.loadURL(config.url);
    },
    {
      url: `${origin}/player`,
      index,
      width: index ? 390 : 360,
      height: index ? 844 : 800,
    },
  );
  const page = await next;
  observe(page, origin);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  await cdp.send('Network.setUserAgentOverride', {
    userAgent: index
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/135.0.0.0 Mobile Safari/537.36',
  });
  await page.reload();
  await page.locator('.connection.online').waitFor();
  return page;
}

async function setGuidance(mobile, enabled, inGame) {
  if (inGame)
    await mobile.getByRole('button', { name: '菜单', exact: true }).click();
  await mobile.getByRole('button', { name: '游戏设置', exact: true }).click();
  const toggle = mobile.getByRole('switch', { name: '新手引导', exact: true });
  assert.equal(await toggle.getAttribute('aria-checked'), String(!enabled));
  assert.equal(await mobile.getByRole('slider').count(), 0);
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-checked'), String(enabled));
  await mobile
    .getByRole('button', { name: '关闭面板', exact: true })
    .last()
    .click();
  if (inGame)
    await mobile.getByRole('button', { name: '关闭面板', exact: true }).click();
}
async function strategy(player) {
  return bot.decide({
    view: player.gameView,
    actions: player.actions,
    decision: { id: player.decisionId, seatId: player.self.seatId },
    memory: null,
    random: {
      next() {
        throw new Error('Unused strategy RNG');
      },
    },
    signal: new AbortController().signal,
  });
}
for (let run = 0; run < 2; run++) {
  const desktop = await launchDesktop({
      executablePath,
      args,
      env,
      timeout: 30000,
    }),
    clients = [];
  let origin;
  try {
    const page = await desktop.firstWindow();
    await page.waitForURL('**/host');
    origin = new URL(page.url()).origin;
    env.TABLEMAX_PORT = new URL(origin).port;
    observe(page, origin);
    await page
      .context()
      .route('**/*', (route) =>
        new URL(route.request().url()).hostname === '127.0.0.1'
          ? route.continue()
          : route.abort(),
      );
    await page.reload();
    await page.locator('.connection.online').waitFor();
    const hostToken = await page.evaluate(() =>
      sessionStorage.getItem('tablemax-host'),
    );
    assert.ok(hostToken);
    const host = await connect(origin, hostToken);
    clients.push(host);
    const health = await (
      await fetch(`${origin}/api/foundation/health`)
    ).json();
    assert.equal(health.starts, run + 1);
    assert.equal(health.protocolVersion, 7);
    if (run === 0) {
      assert.equal((await view(origin, hostToken)).game, null);
      await command(origin, host, hostToken, {
        type: 'select-game',
        gameId: 'pokemon-encounters',
      });
    }
    assert.equal(health.runtime.node, '22.14.0');
    const runtime = await desktop.evaluate(({ app, screen }) => ({
      packaged: app.isPackaged,
      appVersion: app.getVersion(),
      metrics: app.getAppMetrics(),
      versions: process.versions,
      displays: screen
        .getAllDisplays()
        .map((d) => ({ width: d.bounds.width, height: d.bounds.height })),
    }));
    assert.equal(runtime.packaged, portable);
    assert.equal(runtime.appVersion, project.version);
    assert.ok(
      runtime.metrics.some(
        (entry) =>
          entry.type === 'Utility' && entry.name === 'TableMax local service',
      ),
    );
    assert.equal(new URL(page.url()).hash, '');
    const phones = [
      await phone(desktop, origin, 0),
      await phone(desktop, origin, 1),
    ];
    if (run > 0)
      [phones[0], phones[activePhoneIndex]] = [
        phones[activePhoneIndex],
        phones[0],
      ];
    if (run === 0) {
      await capture(desktop, page, 'host-lobby');
      if (verifyGuidanceSettings) {
        const before = await view(origin);
        await setGuidance(phones[0], true, false);
        await setGuidance(phones[0], false, false);
        const after = await view(origin);
        assert.equal(after.countdownSeconds, before.countdownSeconds);
        assert.deepEqual(after.gameView, before.gameView);
        assert.deepEqual(after.seats, before.seats);
        evidence.checks.push(
          'Unseated ordinary phone can toggle local beginner guidance in box game settings without changing room settings, seats or game state',
        );
      }
      for (let index = 0; index < phones.length; index++) {
        const mobile = phones[index];
        await mobile
          .getByLabel('你的昵称')
          .fill(index ? 'iPhone模拟玩家' : 'Android模拟玩家');
        await mobile.getByRole('button', { name: '加入', exact: true }).click();
        await mobile
          .getByRole('button', { name: '我准备好了', exact: true })
          .waitFor();
        await mobile
          .getByRole('button', { name: '我准备好了', exact: true })
          .click();
        await mobile
          .getByRole('button', { name: '取消准备', exact: true })
          .waitFor();
        tokens.push(
          await mobile.evaluate(() => localStorage.getItem('tablemax-player')),
        );
      }
      for (let i = 0; i < 4; i++)
        await command(origin, host, hostToken, {
          type: 'add-bot',
          name: `电脑 ${i + 1}`,
        });
      const full = await (
        await fetch(`${origin}/api/session/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '超额玩家' }),
        })
      ).json();
      assert.equal(full.ok, false);
      await page.getByRole('button', { name: '管理设置', exact: true }).click();
      const next = desktop.waitForEvent('window');
      await page
        .getByRole('link', { name: '打开公共屏' })
        .click({ noWaitAfter: true });
      const publicPage = await next;
      observe(publicPage, origin);
      await publicPage.locator('.connection.online').waitFor();
      await page.goto(`${origin}/host`);
      await page.locator('.connection.online').waitFor();
      await command(origin, host, hostToken, { type: 'start' });
      for (let retry = 0; retry < 60; retry++) {
        if ((await view(origin, tokens[0])).gameView.initialDone.length === 4)
          break;
        await wait(100);
      }
      for (let index = 0; index < phones.length; index++) {
        const mobile = phones[index];
        await mobile.locator('.confirm-action').waitFor();
        const before = (await view(origin, tokens[index])).gameView;
        await mobile
          .locator('.pokemon-player > .pokemon-board button')
          .nth(0)
          .click();
        assert.deepEqual(
          (await view(origin, tokens[index])).gameView,
          before,
          'Selection stays local',
        );
        await mobile
          .getByRole('button', { name: '取消卡片选择', exact: true })
          .click();
        await mobile
          .locator('.pokemon-player > .pokemon-board button')
          .nth(0)
          .click();
        await mobile.locator('.confirm-action').click();
        await wait(100);
      }
      for (let retry = 0; retry < 60; retry++) {
        if ((await view(origin, tokens[0])).gameView.phase === 'draw') break;
        await wait(100);
      }
      // Random starting seat: wait for a human draw without attributing a seat to the administrator.
      let activeIndex = -1;
      for (let retry = 0; retry < 120 && activeIndex < 0; retry++) {
        for (let index = 0; index < tokens.length; index++) {
          const candidate = await view(origin, tokens[index]);
          if (candidate.actions.some((a) => a.type === 'draw'))
            activeIndex = index;
          else if (candidate.actions.length) {
            // A bot starting first can pass a Zapdos card to a human before
            // that human's normal turn. Complete this legitimate decision.
            const participant = await connect(origin, tokens[index]);
            clients.push(participant);
            const choice = await strategy(candidate);
            await command(origin, participant, tokens[index], {
              type: 'game',
              decisionId: candidate.decisionId,
              action: choice.action,
            });
          }
        }
        if (activeIndex < 0) await wait(100);
      }
      assert.ok(
        activeIndex >= 0,
        'A human receives a legal draw after any bot turns',
      );
      activePhoneIndex = activeIndex;
      [phones[0], phones[activeIndex]] = [phones[activeIndex], phones[0]];
      [tokens[0], tokens[activeIndex]] = [tokens[activeIndex], tokens[0]];
      let own = await view(origin, tokens[0]);
      assert.equal(own.gameView.phase, 'draw');
      if (verifyGuidanceSettings) {
        assert.equal(await phones[0].locator('.decision-guidance').count(), 0);
        await setGuidance(phones[0], true, true);
        assert.ok(await phones[0].locator('.guidance-instruction').isVisible());
        await phones[0].reload();
        await phones[0].locator('.connection.online').waitFor();
        await phones[0].locator('.guidance-instruction').waitFor();
        assert.equal(
          await phones[0].evaluate(() =>
            localStorage.getItem('tablemax-player'),
          ),
          tokens[0],
        );
        await setGuidance(phones[0], false, true);
        assert.equal(await phones[0].locator('.decision-guidance').count(), 0);
        const after = await view(origin, tokens[0]);
        assert.deepEqual(after.gameView, own.gameView);
        assert.equal(after.decisionId, own.decisionId);
        assert.equal(after.selectionToken, own.selectionToken);
        own = after;
        evidence.checks.push(
          'Saved portable game uses compact guidance by default; ordinary phone toggles detailed instructions, retains preference and identity on reload, then disables it without changing the decision or saved game',
        );
      }
      const admin = await view(origin, hostToken);
      assert.deepEqual(admin.self, { role: 'host', seatId: null });
      assert.deepEqual(admin.actions, []);
      assert.equal(JSON.stringify(await view(origin)).includes('#'), false);
      assert.equal((await view(origin)).history.length, 0);
      assert.equal(await publicPage.locator('.management').count(), 0);
      assert.equal(await publicPage.locator('.private-peek').count(), 0);
      await capture(desktop, publicPage, 'public-1920', 1920, 1080);
      await capture(desktop, phones[0], 'android-360', 360, 800);
      await capture(desktop, phones[1], 'iphone-390', 390, 844);
      for (const mobile of phones) {
        assert.equal(
          await mobile.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        assert.equal(await mobile.locator('.sound-control').count(), 0);
      }
      await phones[0]
        .getByRole('button', { name: '从牌库取牌', exact: true })
        .click();
      await wait(100);
      own = await view(origin, tokens[0]);
      previous = own.gameView;
      const human = await connect(origin, tokens[0]);
      clients.push(human);
      const choice = await strategy(own);
      await command(origin, human, tokens[0], {
        type: 'game',
        decisionId: own.decisionId,
        action: choice.action,
      });
      const current = await view(origin, hostToken);
      await command(origin, host, hostToken, {
        type: 'rollback',
        checkpointId: current.history.at(-1).id,
      });
      assert.deepEqual((await view(origin, tokens[0])).gameView, previous);
      assert.equal((await view(origin)).paused, true);
      await capture(desktop, page, 'rollback');
      await phones[0].reload();
      await phones[0].locator('.connection.online').waitFor();
      assert.equal(
        await phones[0].evaluate(() => localStorage.getItem('tablemax-player')),
        tokens[0],
      );
      const mobileCdp = await phones[0].context().newCDPSession(phones[0]);
      await mobileCdp.send('Page.setWebLifecycleState', { state: 'frozen' });
      await command(origin, host, hostToken, { type: 'resume' });
      const frozenPlayer = await view(origin, tokens[0]);
      const frozenChoice = await strategy(frozenPlayer);
      await command(origin, human, tokens[0], {
        type: 'game',
        decisionId: frozenPlayer.decisionId,
        action: frozenChoice.action,
      });
      await command(origin, host, hostToken, { type: 'pause' });
      previous = (await view(origin, tokens[0])).gameView;
      await mobileCdp.send('Page.setWebLifecycleState', { state: 'active' });
      await phones[0].getByText('游戏已暂停', { exact: true }).waitFor();
      await mobileCdp.send('Network.enable');
      await mobileCdp.send('Network.emulateNetworkConditions', {
        offline: true,
        latency: 0,
        downloadThroughput: 0,
        uploadThroughput: 0,
      });
      await phones[0].reload({ timeout: 5000 }).catch(() => undefined);
      await mobileCdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
      await phones[0].goto(`${origin}/player/game`);
      await phones[0].locator('.connection.online').waitFor();
      assert.equal(
        await phones[0].evaluate(() => localStorage.getItem('tablemax-player')),
        tokens[0],
      );
      assert.deepEqual((await view(origin, tokens[0])).gameView, previous);
      assert.ok(
        await phones[0].getByText('游戏已暂停', { exact: true }).isVisible(),
      );
      evidence.checks.push(
        'Six-seat mixed lobby, over-capacity rejection, administrator without a player seat, independent phones, select/cancel/submit, public secrecy, 1920/360/390 layouts, freeze/background simulation, offline navigation and identity recovery, reload and rollback',
      );
      await publicPage.close();
      assert.equal(
        (await fetch(`${origin}/api/foundation/health`)).status,
        200,
      );
    } else {
      for (const screen of [page, ...phones])
        await screen
          .getByRole('link', { name: '进入牌桌', exact: true })
          .click();
      assert.deepEqual((await view(origin, tokens[0])).gameView, previous);
      assert.equal((await view(origin)).paused, true);
      for (let index = 0; index < phones.length; index++)
        assert.equal(
          await phones[index].evaluate(() =>
            localStorage.getItem('tablemax-player'),
          ),
          tokens[index],
        );
      await command(origin, host, hostToken, { type: 'resume' });
      const humans = [];
      for (const token of tokens) {
        const client = await connect(origin, token);
        clients.push(client);
        humans.push({ token, client });
      }
      let actions = 0,
        loops = 0;
      while (loops++ < 5000) {
        const room = await view(origin, hostToken);
        phases.add(room.gameView.phase);
        if (room.status === 'ended') break;
        if (room.lifecycleActions.length) {
          if (
            await command(origin, host, hostToken, {
              type: 'lifecycle',
              action: room.lifecycleActions[0],
            })
          )
            actions++;
          continue;
        }
        let acted = false;
        for (const human of humans) {
          const player = await view(origin, human.token);
          if (!player.actions.length) continue;
          const choice = await strategy(player);
          acted = await command(origin, human.client, human.token, {
            type: 'game',
            decisionId: player.decisionId,
            action: choice.action,
          });
          if (acted) actions++;
        }
        if (!acted) await wait(75);
      }
      const final = await view(origin, hostToken);
      assert.equal(final.status, 'ended');
      assert.ok(final.gameView.matchWinners.length);
      assert.ok(
        Object.values(final.gameView.winsBySeat).some((wins) => wins === 3),
      );
      await page.locator('.round-banner').waitFor();
      for (const [width, height] of [
        [1080, 800],
        [1366, 768],
        [1920, 1080],
      ]) {
        await capture(desktop, page, `match-result-${width}`, width, height);
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
          scrollHeight: document.documentElement.scrollHeight,
        }));
        evidence.layouts.push({ label: 'match-result', ...geometry });
        assert.ok(
          geometry.scrollHeight <= geometry.height + 1,
          'Desktop match result fits the viewport',
        );
      }
      await capture(desktop, page, 'match-result');
      await capture(desktop, phones[0], 'phone-result', 360, 800);
      evidence.checks.push(
        `Actual socket/worker six-seat complete mixed match, ${actions} driver actions; same identity/state on restart`,
      );
      await page.getByRole('button', { name: '再玩一局', exact: true }).click();
      await page.waitForURL('**/host');
      for (const mobile of phones) {
        await mobile.waitForURL('**/player');
        await mobile
          .getByRole('button', { name: '我准备好了', exact: true })
          .click();
      }
      const replay = await view(origin, hostToken);
      assert.notEqual(replay.instanceId, final.instanceId);
      assert.deepEqual(
        replay.seats.map((seat) => seat.id),
        final.seats.map((seat) => seat.id),
      );
      assert.equal(
        replay.seats.filter((seat) => seat.controller === 'bot').length,
        4,
      );
      await page.getByRole('button', { name: '开始游戏', exact: true }).click();
      await page.waitForURL('**/host/game');
      for (let i = 0; i < phones.length; i++) {
        await phones[i].waitForURL('**/player/game');
        assert.equal(
          await phones[i].evaluate(() =>
            localStorage.getItem('tablemax-player'),
          ),
          tokens[i],
        );
      }
      assert.equal((await view(origin, hostToken)).gameView.roundNumber, 1);
      await capture(desktop, page, 'same-friends-replay');
      evidence.checks.push(
        'Completed three-win match replays with the same six ordered seats, four bots and original phone credentials, then starts a fresh match',
      );
    }
    for (const mobile of phones) {
      const resources = await mobile.evaluate(() =>
        performance.getEntriesByType('resource').map((entry) => entry.name),
      );
      assert.ok(resources.every((url) => new URL(url).origin === origin));
      await mobile.close();
    }
    evidence.runs.push({
      health,
      packaged: runtime.packaged,
      appVersion: runtime.appVersion,
      versions: runtime.versions,
      displays: runtime.displays,
    });
  } catch (error) {
    evidence.result = 'failed';
    evidence.error = error.stack;
    evidence.phases = [...phases];
    await writeFile(
      join(output, 'results.json'),
      JSON.stringify(evidence, null, 2) + '\n',
    );
    throw error;
  } finally {
    for (const client of clients) client.disconnect();
    await desktop.close();
  }
  if (origin) {
    let alive = true;
    for (let retry = 0; retry < 25 && alive; retry++) {
      try {
        await fetch(`${origin}/api/foundation/health`, {
          signal: AbortSignal.timeout(500),
        });
      } catch {
        alive = false;
      }
      if (alive) await wait(100);
    }
    assert.equal(alive, false);
  }
}
assert.deepEqual(evidence.externalRequests, []);
assert.deepEqual(evidence.pageErrors, []);
const log = await readFile(join(dataDir, 'logs/service.log'), 'utf8');
assert.equal(log.match(/service-stopped/g)?.length, 2);
evidence.phases = [...phases];
evidence.result = 'passed';
await writeFile(
  join(output, 'results.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    { result: 'passed', portable, output, phases: evidence.phases },
    null,
    2,
  ),
);
