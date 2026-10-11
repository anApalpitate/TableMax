import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launchDesktop } from '../support/desktop-test.mjs';

process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const manifest = JSON.parse(
  await readFile(
    'artifacts/releases/TableMax-1.0.6-win-x64-manifest.json',
    'utf8',
  ),
);
const archive = resolve('artifacts/releases', manifest.archive.name);
const archiveHash = createHash('sha256')
  .update(await readFile(archive))
  .digest('hex');
assert.equal(archiveHash, manifest.archive.sha256);
const output = await mkdtemp(resolve('artifacts/package-library-'));
const extracted = join(output, 'runtime');
const dataDir = join(output, 'data');
await mkdir(dataDir);
const report = {
  portable: true,
  archiveSha256: archiveHash,
  output,
  result: 'running',
  checks: [],
  states: [],
  layouts: [],
  errors: [],
  scope:
    'Actual extracted Windows base ZIP, native WebView2, loopback, muted. Task snapshots are simulated GET-only fixtures, not actual GitHub downloads. No physical device or Safari claim.',
};
let desktop;
let host;
const save = () =>
  writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
try {
  await promisify(execFile)(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Expand-Archive -LiteralPath $env:LIBRARY_ARCHIVE -DestinationPath $env:LIBRARY_EXTRACT',
    ],
    {
      env: {
        ...process.env,
        LIBRARY_ARCHIVE: archive,
        LIBRARY_EXTRACT: extracted,
      },
      windowsHide: true,
    },
  );
  const env = {
    ...process.env,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
    TABLEMAX_DATA_DIR: dataDir,
    TABLEMAX_BOX_DIRECTORY: extracted,
    PATH: `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`,
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  desktop = await launchDesktop({
    executablePath: join(extracted, 'TableMax.exe'),
    env,
    soundEnabled: false,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  const origin = new URL(host.url()).origin;
  report.origin = origin;
  host.on('pageerror', (error) => report.errors.push(error.message));
  const actual = await (await fetch(origin + '/api/game-packages')).json();
  assert.equal(Object.keys(actual.index.releases).length, 0);
  await host
    .locator('[data-game-id="uno"] [data-resource-state="missing"]')
    .waitFor();
  const cardButton = host.locator('[data-game-id="uno"] [data-resource-state]');
  assert.equal(await cardButton.innerText(), '下载资源');
  assert.equal(await cardButton.isEnabled(), true);
  await host.getByText('游戏包管理', { exact: true }).click();
  assert.equal(
    await host.getByRole('button', { name: '导入离线包', exact: true }).count(),
    1,
  );
  report.checks.push(
    'Untouched fresh base contains no installed games; UNO has enabled download control and administrator package controls.',
  );
  for (const url of [
    '/api/game-packages/manage',
    '/api/game-packages/import',
  ]) {
    const response = await fetch(origin + url, {
      method: 'POST',
      headers: {
        'Content-Type': url.endsWith('import')
          ? 'application/octet-stream'
          : 'application/json',
      },
      body: url.endsWith('import')
        ? Buffer.from('not-a-package')
        : JSON.stringify({ operation: 'cancel', releaseId: 'a'.repeat(64) }),
    });
    assert.equal(response.status, 403);
  }
  report.checks.push(
    'Actual service rejects unauthenticated manage and import with 403.',
  );
  await desktop.request('open-public');
  let publicPage;
  for (let i = 0; i < 60 && !publicPage; i++) {
    publicPage = desktop
      .windows()
      .find((page) => new URL(page.url()).pathname === '/public');
    if (!publicPage) await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok(publicPage, 'Native public window');
  await desktop.request('new-window', {
    url: origin + '/',
    width: 390,
    height: 844,
    partition: 'package-library-player',
    managed: false,
  });
  let player;
  for (let i = 0; i < 60 && !player; i++) {
    player = desktop.windows().find((page) => {
      const url = new URL(page.url());
      return url.origin === origin && url.pathname === '/';
    });
    if (!player) await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok(player, 'Independent native browser player');
  const mobileCdp = await player.context().newCDPSession(player);
  await mobileCdp.send('Emulation.setUserAgentOverride', {
    userAgent:
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
    platform: 'Android',
  });
  await player.reload();
  await player.locator('iframe[data-player-frame]').waitFor();
  const playerFrame = () =>
    player
      .frames()
      .find(
        (frame) =>
          frame !== player.mainFrame() &&
          new URL(frame.url()).origin === origin,
      );
  await publicPage.locator('[data-game-id="uno"]').waitFor();
  await player
    .frameLocator('iframe[data-player-frame]')
    .locator('[data-game-id="uno"]')
    .waitFor();
  for (const page of [publicPage, player]) {
    assert.equal(
      await page.getByText('游戏包管理', { exact: true }).count(),
      0,
    );
  }
  const publicPicker = await publicPage.evaluate(async () => {
    if (!window.tablemaxPackages) return { exposed: false };
    try {
      await window.tablemaxPackages.pick();
      return { exposed: true, rejected: false };
    } catch (error) {
      return { exposed: true, rejected: true, reason: String(error) };
    }
  });
  assert.ok(
    !publicPicker.exposed || publicPicker.rejected,
    'Public cannot open managed picker',
  );
  report.checks.push(
    'Public/player omit administrator management; public managed picker absent or rejects before dialog.',
  );
  report.publicPicker = publicPicker;
  const release = actual.catalog.releases.find((item) => item.gameId === 'uno');
  assert.ok(release);
  let fixture = structuredClone(actual);
  const contexts = [
    ...new Set([host.context(), publicPage.context(), player.context()]),
  ];
  for (const context of contexts)
    await context.route('**/api/game-packages', (route) =>
      route.fulfill({ json: fixture }),
    );
  const ready = async (state) => {
    await host.waitForFunction(
      (expected) =>
        document.querySelector('[data-game-id="uno"] [data-resource-state]')
          ?.dataset.resourceState === expected,
      state,
      { timeout: 6000 },
    );
  };
  for (const state of [
    'downloading',
    'verifying',
    'installing',
    'failed',
    'incompatible',
    'installed',
    'update',
  ]) {
    fixture = structuredClone(actual);
    if (state === 'installed' || state === 'update') {
      const old = structuredClone(release);
      if (state === 'update') old.releaseId = 'e'.repeat(64);
      fixture.index.releases[old.releaseId] = old;
      fixture.index.selected['uno:'] = old.releaseId;
    } else if (state === 'incompatible') {
      fixture.catalog.releases.find(
        (item) => item.gameId === 'uno',
      ).module.compatibility.webHost = 99;
    } else
      fixture.tasks = [
        {
          releaseId: release.releaseId,
          phase: state,
          transferredBytes: 375,
          totalBytes: 1000,
          ...(state === 'failed' ? { error: 'simulated-network-failure' } : {}),
        },
      ];
    await ready(state);
    const text = await cardButton.innerText();
    if (state === 'downloading') {
      assert.match(text, /38%/);
      assert.match(await cardButton.getAttribute('style'), /37.5%/);
    }
    if (
      ['downloading', 'verifying', 'installing', 'incompatible'].includes(state)
    )
      assert.equal(await cardButton.isDisabled(), true);
    if (state === 'failed') assert.equal(text, '重试下载');
    if (['installed', 'update'].includes(state)) assert.match(text, /选择游戏/);
    report.states.push({
      state,
      text,
      disabled: await cardButton.isDisabled(),
      fixture: true,
    });
    for (const [role, frame] of [
      ['public', publicPage.mainFrame()],
      ['player', playerFrame()],
    ]) {
      await frame.waitForFunction(
        (expected) =>
          document.querySelector('[data-game-id="uno"] [data-resource-state]')
            ?.dataset.resourceState === expected,
        state,
        { timeout: 6000 },
      );
      const status = frame.locator(
        '[data-game-id="uno"] [data-resource-state]',
      );
      assert.equal(await status.evaluate((el) => el.tagName), 'SPAN');
      if (state === 'downloading')
        assert.match(await status.innerText(), /38%/);
      report.states.push({
        state,
        role,
        text: await status.innerText(),
        readonly: true,
        fixture: true,
      });
    }
  }
  await host.evaluate((completionLabel) => {
    window.__libraryCompletionCount = 0;
    const seen = new WeakSet();
    const inspect = () => {
      for (const el of document.querySelectorAll('.tablemax-notice')) {
        if (!seen.has(el) && el.textContent.includes(completionLabel)) {
          seen.add(el);
          window.__libraryCompletionCount++;
        }
      }
    };
    new MutationObserver(inspect).observe(document.body, {
      childList: true,
      subtree: true,
    });
    inspect();
  }, `${release.module.catalog.name}资源下载完成`);
  fixture = structuredClone(actual);
  const aliasRelease = structuredClone(release);
  aliasRelease.variantId = 'fixture';
  aliasRelease.module.defaultVariantId = 'fixture';
  fixture.catalog.releases = fixture.catalog.releases.map((item) =>
    item.gameId === 'uno' ? aliasRelease : item,
  );
  fixture.tasks = [
    {
      releaseId: release.releaseId,
      phase: 'installing',
      transferredBytes: 1000,
      totalBytes: 1000,
    },
  ];
  await ready('installing');
  fixture.index.releases[release.releaseId] = structuredClone(aliasRelease);
  fixture.index.selected['uno:fixture'] = release.releaseId;
  fixture.tasks = [];
  await ready('installed');
  await host.waitForTimeout(3200);
  report.completionNotifications = await host.evaluate(
    () => window.__libraryCompletionCount,
  );
  assert.equal(
    report.completionNotifications,
    1,
    'One completion notice for base alias and variant sharing releaseRef across repeated identical snapshot polls',
  );
  const actualAfter = await (await fetch(origin + '/api/game-packages')).json();
  assert.equal(Object.keys(actualAfter.index.releases).length, 0);
  assert.equal(
    await host.getByRole('heading', { name: '今天玩什么？' }).count(),
    1,
  );
  report.checks.push(
    'Simulated state transitions never install or select a game in actual service. Progress uses 37.5% fill / rounded 38% text.',
  );
  for (const [role, page, frame, sizes] of [
    [
      'host',
      host,
      () => host.mainFrame(),
      [
        [1280, 720],
        [3840, 2160],
      ],
    ],
    [
      'public',
      publicPage,
      () => publicPage.mainFrame(),
      [
        [1280, 720],
        [3840, 2160],
      ],
    ],
    [
      'player',
      player,
      playerFrame,
      [
        [320, 740],
        [390, 844],
        [844, 390],
      ],
    ],
  ]) {
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await frame().waitForFunction(
        (expected) => innerWidth >= expected - 20 && innerWidth <= expected,
        width,
      );
      const result = await frame().evaluate(() => {
        const root = document.querySelector('.game-library');
        const visible = (el) => {
          const box = el.getBoundingClientRect();
          return (
            box.width > 0 &&
            box.height > 0 &&
            getComputedStyle(el).visibility !== 'hidden'
          );
        };
        return {
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          controls: [...root.querySelectorAll('button,input,select,summary')]
            .filter(visible)
            .map((el) => {
              const box = el.getBoundingClientRect();
              return {
                text: el.textContent.trim().slice(0, 60),
                width: box.width,
                height: box.height,
                font: parseFloat(getComputedStyle(el).fontSize),
              };
            }),
          info: [
            ...root.querySelectorAll(
              'p,h2,h3,label,.game-library__players,.game-library__tags span,[data-resource-state]',
            ),
          ]
            .filter((el) => visible(el) && el.textContent.trim())
            .map((el) => ({
              text: el.textContent.trim().slice(0, 40),
              font: parseFloat(getComputedStyle(el).fontSize),
            })),
          taskStatusVisible: [
            ...root.querySelectorAll('[data-resource-state]'),
          ].map((el) => el.dataset.resourceState),
        };
      });
      await page.screenshot({
        path: join(output, `${role}-${width}x${height}.png`),
        fullPage: false,
      });
      result.role = role;
      result.viewport = { width, height };
      report.layouts.push(result);
      assert.ok(
        result.scrollWidth <= result.width + 1,
        `${role} ${width}px horizontal overflow`,
      );
      assert.ok(
        result.controls.every(
          (control) => control.height >= 43.5 && control.width >= 43.5,
        ),
        `${role} ${width}px target below 44px`,
      );
      assert.ok(
        result.info.every((info) => info.font >= 16),
        `${role} ${width}px information below 16px`,
      );
    }
  }
  fixture = structuredClone(actual);
  fixture.tasks = [
    {
      releaseId: release.releaseId,
      phase: 'downloading',
      transferredBytes: 375,
      totalBytes: 1000,
    },
  ];
  await ready('downloading');
  await publicPage.waitForTimeout(1700);
  report.observerStates = {
    public: await publicPage.locator('[data-game-id="uno"]').innerText(),
    player: await playerFrame().locator('[data-game-id="uno"]').innerText(),
  };
  assert.match(
    report.observerStates.public,
    /下载中.*38%/,
    'Public displays resource progress',
  );
  assert.match(
    report.observerStates.player,
    /下载中.*38%/,
    'Player displays resource progress',
  );
  fixture = structuredClone(actual);
  fixture.index.releases[release.releaseId] = structuredClone(release);
  fixture.index.selected['uno:'] = release.releaseId;
  let currentPin = 'e'.repeat(64);
  const overlay = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(overlay);
      return;
    }
    if (
      typeof value.instanceId === 'string' &&
      Array.isArray(value.seats) &&
      Array.isArray(value.catalog) &&
      'gameView' in value
    ) {
      value.game = {
        id: 'uno',
        name: release.module.catalog.name,
        min: release.module.catalog.min,
        max: release.module.catalog.max,
        releaseRef: currentPin,
      };
    }
    Object.values(value).forEach(overlay);
  };
  await host.routeWebSocket('**/socket.io/**', (socket) => socket.close());
  await host.route('**/socket.io/**', async (route) => {
    if (
      route.request().method() !== 'GET' ||
      !route.request().url().includes('transport=polling')
    )
      return route.continue();
    const response = await route.fetch();
    const packets = (await response.text()).split('\x1e').map((packet) => {
      const match = /^(\d+)(\[.*)$/s.exec(packet);
      if (!match) return packet;
      const json = JSON.parse(match[2]);
      overlay(json);
      return match[1] + JSON.stringify(json);
    });
    await route.fulfill({ response, body: packets.join('\x1e') });
  });
  for (const samePin of [false, true]) {
    currentPin = samePin ? release.releaseId : 'e'.repeat(64);
    await host.reload();
    await host.getByRole('button', { name: '切换游戏', exact: true }).click();
    await ready('installed');
    assert.equal(
      await cardButton.isDisabled(),
      samePin,
      'Only same current and installed pin is disabled',
    );
    report.states.push({
      state: 'installed',
      currentPin,
      availablePin: release.releaseId,
      disabled: samePin,
      fixture: 'GET-only room projection overlay, no service mutation',
    });
  }
  assert.equal(
    Object.keys(
      (await (await fetch(origin + '/api/game-packages')).json()).index
        .releases,
    ).length,
    0,
  );
  report.checks.push(
    'Actual compiled library permits explicit newer installed pin selection and disables same pin using read-only simulated room projections.',
  );
  assert.equal(report.errors.length, 0);
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  console.error(error.message);
  process.exitCode = 1;
  if (host)
    await host
      .screenshot({ path: join(output, 'failure.png') })
      .catch(() => {});
} finally {
  await desktop?.close().catch((error) => {
    report.shutdownError = error.message;
    report.result = 'failed';
    process.exitCode = 1;
  });
  report.allOwnedProcessesStopped = !report.shutdownError;
  await save();
  console.log(
    JSON.stringify({
      result: report.result,
      evidence: join(output, 'report.json'),
      archiveSha256: archiveHash,
    }),
  );
}
