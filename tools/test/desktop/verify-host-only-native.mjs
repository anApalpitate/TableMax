import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
const option = (name, fallback) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback;
const taskArgument = option('task');
const evidenceName = option('evidence');
assert.ok(
  taskArgument && evidenceName,
  'Usage: verify-host-only-native.mjs --task=tmp/<task-name> --evidence=<new-round> [--foreground] [--executable=<current-development-exe>]',
);
const task = resolve(taskArgument);
assert.ok(
  task.startsWith(resolve('tmp') + sep),
  'Task must stay within workspace tmp',
);
assert.match(evidenceName, /^[a-z0-9-]{1,64}$/);
const foreground = process.argv.includes('--foreground');
const output = resolve('artifacts/maintenance', basename(task), evidenceName);
const work = join(task, evidenceName);
await mkdir(work, { recursive: true });
await mkdir(output, { recursive: true });
const reportPath = join(output, 'report.json');
await assert.rejects(
  access(reportPath),
  'An evidence round must never overwrite an old report',
);
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TEMP = work;
process.env.TMP = work;
const { launchDesktop, desktopExecutable } =
  await import('../support/desktop-test.mjs');
const { captureBrowserScreenshot } = await import('../support/screenshots.mjs');
const executablePath = resolve(option('executable', desktopExecutable));
const integrity =
  execFileSync('whoami.exe', ['/groups'], {
    encoding: 'utf8',
    windowsHide: true,
  }).match(/S-1-16-\d+/g) ?? [];
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inputs = await Promise.all(
  [
    'apps/desktop/native/DesktopContext.cs',
    'apps/desktop/native/NativeWindow.cs',
    'apps/desktop/native/DisplaySettings.cs',
    'apps/desktop/native/Bridge.js',
    'apps/desktop/src/audio-controller.ts',
    'apps/desktop/src/display-controller.ts',
    'apps/desktop/src/runtime-guard.ts',
    'tools/test/desktop/verify-host-only-native.mjs',
    'tools/test/support/desktop-test.mjs',
    executablePath,
  ].map(async (path) => ({
    path: resolve(path),
    sha256: digest(await readFile(path)),
  })),
);
const report = {
  version: 1,
  startedAt: new Date().toISOString(),
  task,
  work,
  executablePath,
  foreground,
  integrity,
  inputs,
  checks: [],
  failures: [],
  pending: [],
  result: 'running',
  boundary: foreground
    ? 'Actual nonactivating WinForms/WebView2 and independent loopback service under a standard Medium token. Foreground window is briefly visible; native hide/minimize/restore power state checked. No installer, physical sleep, physical multi-monitor or real-device acceptance.'
    : 'Actual hidden muted WinForms/WebView2 and independent loopback service under a standard Medium token. Hidden mode intentionally does not prevent display sleep. No installer, physical sleep, foreground visibility, physical multi-monitor or real-device acceptance.',
};
const plannedChecks = [
  'current-development-assembly-and-loopback',
  'one-host-window-and-retired-menu',
  'legacy-display-read-without-write-or-profile-reset',
  'window-modes-keys-menu-and-screen-move',
  'host-audio-dedupe-and-box-release',
  'bridge-rejects-retired-player-and-child-frame-authority',
  'display-explicit-save-v2-host-only',
  'service-and-visible-host-power-policy',
  'v2-restart-and-existing-profile-preserved',
  'native-host-display-presets-and-png-scales',
  'real-app-denies-nonadministrator-host-routes-before-game-import',
  'real-unseated-player-game-returns-to-admission',
  'testing-prototype-compatibility-without-bridge-authority',
];
const requestedChecks = option('checks')?.split(',') ?? plannedChecks;
assert.equal(new Set(requestedChecks).size, requestedChecks.length);
for (const id of requestedChecks)
  assert.ok(plannedChecks.includes(id), `Unknown native check: ${id}`);
const selectedChecks = new Set(requestedChecks);
report.selectedChecks = requestedChecks;
report.excluded = plannedChecks
  .filter((id) => !selectedChecks.has(id))
  .map((id) => ({ id, reason: 'Not selected for this directed round' }));
let desktop;
let host;
let origin;
let servicePort = '0';
let prototypeServer;
const data = join(work, 'data');
const runtimeRoot = join(work, 'runtime-root');
const displayPath = join(data, 'display-settings.json');
const markerPath = join(data, 'desktop', 'profile-preservation.txt');
const oldHost = { resolution: '1920x1080', interfaceScale: 125 };
const legacy =
  JSON.stringify(
    {
      version: 1,
      host: oldHost,
      public: { resolution: '3840x2160', interfaceScale: 150 },
    },
    null,
    2,
  ) + '\n';
const savedPreferences = { resolution: '2560x1440', interfaceScale: 150 };
const check = async (id, run) => {
  if (!selectedChecks.has(id)) return;
  if (report.failures.length >= 10) {
    report.pending.push({ id, reason: 'Failure budget 10 reached' });
    return;
  }
  console.log(`native check: ${id}`);
  try {
    const details = await run();
    report.checks.push({
      id,
      result: 'passed',
      ...(details ? { details } : {}),
    });
  } catch (error) {
    const failure = {
      id,
      result: 'failed',
      error: error.stack ?? String(error),
    };
    report.checks.push(failure);
    report.failures.push(failure);
  }
};
const states = () => desktop.request('windows');
const windowState = async () => (await states()).find((entry) => entry.managed);
const requestWindow = async (operation, parameters = {}) =>
  desktop.request('window', {
    id: (await windowState()).id,
    operation,
    ...parameters,
  });
const waitForMode = (mode) =>
  host.waitForFunction(
    (expected) =>
      window.tablemaxWindow.read().then((state) => state.mode === expected),
    mode,
  );
async function prepareDevelopmentCache() {
  const directory = dirname(executablePath);
  const preparationData = join(work, 'cache-preparation-data');
  const startedAt = new Date().toISOString();
  const child = spawn(
    join(directory, 'node.exe'),
    [join(directory, 'server.cjs'), '--desktop-pipe'],
    {
      cwd: directory,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TABLEMAX_AUTO_MAINTENANCE: '0',
        TEMP: work,
        TMP: work,
      },
    },
  );
  let stderr = '';
  child.stderr.on('data', (bytes) => {
    stderr = (stderr + bytes.toString()).slice(-10000);
  });
  let readyResolve, readyReject, stoppedResolve;
  const ready = new Promise((done, reject) => {
    readyResolve = done;
    readyReject = reject;
  });
  const stopped = new Promise((done) => {
    stoppedResolve = done;
  });
  const exited = new Promise((done, reject) => {
    child.once('exit', (code) => done(code));
    child.once('error', reject);
  });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    try {
      const message = JSON.parse(line);
      if (message.type === 'ready') readyResolve(message);
      else if (message.type === 'error')
        readyReject(
          new Error(
            `Prepared service failed: ${message.message} ${message.code ?? ''}`,
          ),
        );
      else if (message.type === 'stopped') stoppedResolve(message.status);
    } catch (error) {
      readyReject(error);
    }
  });
  const deadline = async (promise, milliseconds, description) => {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(description)),
            milliseconds,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  report.preparation = {
    method:
      'Same SHA-verified built server.cjs private pipe prepares task-local development games cache, then stops before fresh native data/profile are created',
    startedAt,
    pid: child.pid,
    data: preparationData,
    games: join(runtimeRoot, 'games'),
    nativeColdStartup: false,
    installerAcceptance: false,
    result: 'running',
  };
  console.log(
    'Preparing task-local development games cache with the verified built service',
  );
  try {
    child.stdin.write(
      JSON.stringify({
        type: 'start',
        config: {
          host: '127.0.0.1',
          port: 0,
          dataDir: preparationData,
          webDir: join(directory, 'web'),
          gamesDir: join(runtimeRoot, 'games'),
          playMode: 'test',
        },
      }) + '\n',
    );
    const response = await deadline(
      Promise.race([
        ready,
        exited.then((code) => {
          throw new Error(
            `Prepared service exited before ready: ${code}; ${stderr}`,
          );
        }),
      ]),
      90000,
      'Development cache preparation exceeded 90 seconds',
    );
    assert.ok(Number.isInteger(response.port) && response.port > 0);
    assert.equal(typeof response.hostToken, 'string');
    child.stdin.end(JSON.stringify({ type: 'stop' }) + '\n');
    const [status, exitCode] = await deadline(
      Promise.all([stopped, exited]),
      15000,
      'Prepared service did not stop with a confirmation',
    );
    assert.equal(status, 'drained');
    assert.equal(exitCode, 0);
    Object.assign(report.preparation, {
      result: 'passed',
      port: response.port,
      status,
      exitCode,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    Object.assign(report.preparation, {
      result: 'failed',
      completedAt: new Date().toISOString(),
    });
    throw error;
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await deadline(
        exited,
        5000,
        'Owned preparation process did not exit after termination',
      );
    }
    lines.close();
    await writeFile(join(output, 'cache-preparation-stderr.log'), stderr);
  }
}
const launch = async (showForeground = foreground) => {
  const env = {
    ...process.env,
    TABLEMAX_DATA_DIR: data,
    TABLEMAX_BOX_DIRECTORY: runtimeRoot,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: servicePort,
    TABLEMAX_AUTO_MAINTENANCE: '0',
    TABLEMAX_TEST_MAINTENANCE: '0',
    TEMP: work,
    TMP: work,
  };
  delete env.TABLEMAX_WEB_DEV_URL;
  delete env.NODE_PATH;
  desktop = await launchDesktop({
    executablePath,
    timeout: 45000,
    soundEnabled: false,
    args: [
      '--foundation-test',
      '--tablemax-test-mode',
      ...(showForeground ? ['--tablemax-test-foreground'] : []),
    ],
    env,
  });
  host = await desktop.firstWindow();
  await host.waitForURL('**/host');
  await host.locator('.connection.online').waitFor();
  origin = new URL(host.url()).origin;
  servicePort = new URL(origin).port;
};
try {
  assert.deepEqual(
    integrity,
    ['S-1-16-8192'],
    'Native validation requires standard Medium integrity, not Low or elevated High',
  );
  const pointerPath = resolve('build/snapshots/latest.json');
  const pointer = JSON.parse(await readFile(pointerPath, 'utf8'));
  const snapshot = JSON.parse(await readFile(pointer.snapshotPath, 'utf8'));
  const assemblyPath = resolve(
    'build/snapshots',
    snapshot.id + '-assembly.json',
  );
  const assembly = JSON.parse(await readFile(assemblyPath, 'utf8'));
  const sourceFiles = new Map(
    snapshot.units.flatMap((unit) =>
      unit.inputs.files.map((file) => [file.path, file]),
    ),
  );
  for (const file of sourceFiles.values())
    assert.equal(
      digest(await readFile(resolve(file.path))),
      file.sha256,
      `Development assembly source became stale: ${file.path}`,
    );
  for (const file of assembly.files)
    assert.equal(
      digest(await readFile(resolve('build/desktop', file.path))),
      file.sha256,
      `Development assembly payload changed: ${file.path}`,
    );
  report.build = {
    snapshotId: snapshot.id,
    snapshotPath: pointer.snapshotPath,
    snapshotSha256: digest(await readFile(pointer.snapshotPath)),
    assemblyPath,
    assemblySha256: digest(await readFile(assemblyPath)),
    compiledSourceFiles: sourceFiles.size,
    payloadFiles: assembly.files.length,
  };
  await writeFile(
    join(output, 'development-snapshot.json'),
    await readFile(pointer.snapshotPath),
  );
  await writeFile(
    join(output, 'development-assembly.json'),
    await readFile(assemblyPath),
  );
  await prepareDevelopmentCache();
  await mkdir(join(data, 'desktop'), { recursive: true });
  await writeFile(displayPath, legacy, { flag: 'wx' });
  await writeFile(markerPath, 'retained profile marker\n', { flag: 'wx' });
  await launch();
  await check('current-development-assembly-and-loopback', async () => {
    const runtime = await desktop.request('runtime');
    assert.equal(runtime.packaged, false);
    assert.equal(new URL(origin).hostname, '127.0.0.1');
    return {
      origin,
      desktopPid: runtime.desktopPid,
      servicePid: runtime.servicePid,
      appVersion: runtime.appVersion,
      webview2: runtime.versions.webview2,
    };
  });
  await check('one-host-window-and-retired-menu', async () => {
    const before = await windowState();
    for (let index = 0; index < 3; index++) await desktop.request('show-host');
    const current = await states();
    assert.equal(current.length, 1);
    assert.equal(current[0].id, before.id);
    assert.equal(current[0].role, 'host');
    const menu = await requestWindow('menu-items');
    assert.equal(
      menu.some((text) => text.includes('公共屏')),
      false,
    );
    assert.ok(menu.some((text) => text.includes('房主管理')));
    await assert.rejects(desktop.request('open-public'), /Unknown test method/);
    await assert.rejects(
      desktop.request('new-window', { url: origin + '/public', managed: true }),
    );
    await assert.rejects(
      desktop.request('new-window', { url: origin + '/host', managed: true }),
    );
    assert.equal((await states()).length, 1);
    return { menu, id: before.id };
  });
  await check(
    'legacy-display-read-without-write-or-profile-reset',
    async () => {
      assert.deepEqual(
        (await host.evaluate(() => window.tablemaxDisplay.read())).preferences,
        oldHost,
      );
      assert.equal(await readFile(displayPath, 'utf8'), legacy);
      assert.equal(
        await readFile(markerPath, 'utf8'),
        'retained profile marker\n',
      );
      await host.evaluate(() =>
        localStorage.setItem('f1-profile-marker', 'retained'),
      );
    },
  );
  await check('window-modes-keys-menu-and-screen-move', async () => {
    for (const mode of ['windowed', 'borderless', 'fullscreen']) {
      assert.equal(
        (
          await host.evaluate(
            (value) => window.tablemaxWindow.setMode(value),
            mode,
          )
        ).mode,
        mode,
      );
    }
    await host.keyboard.press('Escape');
    await waitForMode('borderless');
    assert.equal(
      (await host.evaluate(() => window.tablemaxWindow.read())).mode,
      'borderless',
    );
    await host.keyboard.press('F11');
    await waitForMode('windowed');
    assert.equal(
      (await host.evaluate(() => window.tablemaxWindow.read())).mode,
      'windowed',
    );
    await requestWindow('menu-fullscreen');
    assert.equal(
      (await host.evaluate(() => window.tablemaxWindow.read())).mode,
      'fullscreen',
    );
    await requestWindow('key-f11');
    assert.equal(
      (await host.evaluate(() => window.tablemaxWindow.read())).mode,
      'windowed',
    );
    await requestWindow('move', { screen: 1 });
    assert.equal((await states()).length, 1);
    assert.equal((await windowState()).audioMuted, true);
  });
  await check('host-audio-dedupe-and-box-release', async () => {
    await host.evaluate(() => history.pushState(null, '', '/host/game'));
    assert.equal(
      await host.evaluate(() => window.tablemaxAudio.connect()),
      true,
    );
    assert.equal(
      await host.evaluate(() =>
        window.tablemaxAudio.claimEvent('f1:saved-event'),
      ),
      true,
    );
    assert.equal(
      await host.evaluate(() =>
        window.tablemaxAudio.claimEvent('f1:saved-event'),
      ),
      false,
    );
    await host.evaluate(() => window.tablemaxAudio.disconnect());
    assert.equal(
      await host.evaluate(() =>
        window.tablemaxAudio.claimEvent('f1:disconnected'),
      ),
      false,
    );
    assert.equal(
      await host.evaluate(() => window.tablemaxAudio.connect()),
      true,
    );
    assert.equal(
      await host.evaluate(() =>
        window.tablemaxAudio.claimEvent('f1:saved-event'),
      ),
      false,
    );
    assert.equal(
      await host.evaluate(() => window.tablemaxInteractionAudio.connect()),
      true,
    );
    assert.equal(
      await host.evaluate(() =>
        window.tablemaxInteractionAudio.claimEvent('f1:interaction'),
      ),
      true,
    );
    assert.equal(
      await host.evaluate(() =>
        window.tablemaxInteractionAudio.claimEvent('f1:interaction'),
      ),
      false,
    );
    await host.evaluate(() => history.pushState(null, '', '/host'));
    await host.evaluate(() => window.tablemaxAudio.disconnect());
    await assert.rejects(host.evaluate(() => window.tablemaxAudio.connect()));
    assert.equal((await windowState()).audioMuted, true);
  });
  await check(
    'bridge-rejects-retired-player-and-child-frame-authority',
    async () => {
      for (const path of [
        '/public',
        '/public/game',
        '/player',
        '/player/game',
      ]) {
        await host.evaluate(
          (value) => history.pushState(null, '', value),
          path,
        );
        await assert.rejects(
          host.evaluate(() => window.tablemaxDisplay.read()),
        );
        await assert.rejects(host.evaluate(() => window.tablemaxWindow.read()));
        await assert.rejects(
          host.evaluate(() => window.tablemaxAudio.connect()),
        );
        await assert.rejects(
          host.evaluate(() => window.tablemaxInteractionAudio.connect()),
        );
      }
      await host.evaluate(() => history.pushState(null, '', '/host'));
      const before = await host.evaluate(() => window.tablemaxDisplay.read());
      const blockedBefore = (await windowState()).blockedFrameNavigations;
      await host.evaluate(() => {
        const frame = document.createElement('iframe');
        frame.id = 'f1-blocked-srcdoc';
        frame.srcdoc = '<p>Blocked source document</p>';
        document.body.append(frame);
      });
      const blockedDeadline = Date.now() + 5000;
      while (
        (await windowState()).blockedFrameNavigations <= blockedBefore &&
        Date.now() < blockedDeadline
      )
        await new Promise((done) => setTimeout(done, 25));
      assert.ok(
        (await windowState()).blockedFrameNavigations > blockedBefore,
        'Native navigation policy must reject srcdoc',
      );
      await host.evaluate(() =>
        document.getElementById('f1-blocked-srcdoc').remove(),
      );
      await host.evaluate(() => {
        const frame = document.createElement('iframe');
        frame.id = 'f1-child';
        frame.src = 'about:blank';
        document.body.append(frame);
      });
      await host
        .frameLocator('#f1-child')
        .locator('body')
        .waitFor({ state: 'attached' });
      const frame = host.frames().find((entry) => entry !== host.mainFrame());
      assert.equal(
        await frame.evaluate(() => typeof window.tablemaxDisplay),
        'undefined',
      );
      await frame.evaluate(() =>
        window.chrome?.webview?.postMessage({
          id: 98765,
          method: 'display.update',
          params: [{ resolution: 'auto', interfaceScale: 100 }],
        }),
      );
      await host.waitForTimeout(150);
      assert.deepEqual(
        (await host.evaluate(() => window.tablemaxDisplay.read())).preferences,
        before.preferences,
      );
      await host.evaluate(() => document.getElementById('f1-child').remove());
    },
  );
  await check('display-explicit-save-v2-host-only', async () => {
    await host.evaluate(
      (value) => window.tablemaxDisplay.update(value),
      savedPreferences,
    );
    assert.deepEqual(JSON.parse(await readFile(displayPath, 'utf8')), {
      version: 2,
      host: savedPreferences,
    });
    assert.equal(
      await readFile(markerPath, 'utf8'),
      'retained profile marker\n',
    );
    const before = await readFile(displayPath, 'utf8');
    await assert.rejects(
      host.evaluate(() =>
        window.tablemaxDisplay.update({
          resolution: 'auto',
          interfaceScale: 200,
        }),
      ),
    );
    assert.equal(await readFile(displayPath, 'utf8'), before);
  });
  await check('service-and-visible-host-power-policy', async () => {
    let runtime = await desktop.request('runtime');
    assert.equal(runtime.powerBlockerActive, true);
    assert.equal(runtime.displayPowerBlockerActive, foreground);
    if (foreground) {
      await requestWindow('window-state', { value: 'Minimized' });
      runtime = await desktop.request('runtime');
      assert.equal(runtime.powerBlockerActive, true);
      assert.equal(runtime.displayPowerBlockerActive, false);
      await requestWindow('window-state', { value: 'Normal' });
      assert.equal(
        (await desktop.request('runtime')).displayPowerBlockerActive,
        true,
      );
      await requestWindow('hide');
      runtime = await desktop.request('runtime');
      assert.equal(runtime.powerBlockerActive, true);
      assert.equal(runtime.displayPowerBlockerActive, false);
      await requestWindow('show');
      assert.equal(
        (await desktop.request('runtime')).displayPowerBlockerActive,
        true,
      );
    }
    return {
      service: true,
      visibleHostDisplay: foreground,
      physicalSleepTested: false,
    };
  });
  await captureBrowserScreenshot(host, {
    path: join(output, 'actual-host.png'),
  });
  await desktop.close();
  desktop = undefined;
  await launch(false);
  await check('v2-restart-and-existing-profile-preserved', async () => {
    assert.deepEqual(
      (await host.evaluate(() => window.tablemaxDisplay.read())).preferences,
      savedPreferences,
    );
    assert.equal(
      await host.evaluate(() => localStorage.getItem('f1-profile-marker')),
      'retained',
    );
    assert.equal(
      await readFile(markerPath, 'utf8'),
      'retained profile marker\n',
    );
    assert.equal((await states()).length, 1);
  });
  await check('native-host-display-presets-and-png-scales', async () => {
    const samples = [];
    report.displayMeasurements = samples;
    for (const [width, height, scale] of [
      [1280, 720, 100],
      [1920, 1080, 125],
      [3840, 2160, 150],
    ]) {
      await requestWindow('resize', { width, height });
      const resolution = `${width}x${height}`;
      const display = await host.evaluate(
        (preferences) => window.tablemaxDisplay.update(preferences),
        { resolution, interfaceScale: scale },
      );
      await host.waitForFunction(
        (expected) =>
          Math.abs(devicePixelRatio / expected.osDpi - expected.zoom) < 0.02,
        { osDpi: display.screen.scaleFactor, zoom: display.zoomFactor },
      );
      const native = await windowState();
      const measure = () =>
        host.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
          dpi: devicePixelRatio,
          visualViewport: visualViewport && {
            width: visualViewport.width,
            height: visualViewport.height,
            scale: visualViewport.scale,
            offsetLeft: visualViewport.offsetLeft,
            offsetTop: visualViewport.offsetTop,
            pageLeft: visualViewport.pageLeft,
            pageTop: visualViewport.pageTop,
          },
        }));
      const css = await measure();
      const screenshotPath = join(
        output,
        `actual-host-${resolution}-${scale}.png`,
      );
      const cdp = await host.context().newCDPSession(host);
      let layoutMetrics;
      try {
        layoutMetrics = await cdp.send('Page.getLayoutMetrics');
      } finally {
        await cdp.detach();
      }
      const png = await captureBrowserScreenshot(host, {
        path: screenshotPath,
      });
      const afterCapture = await measure();
      const pixels = {
        width: png.readUInt32BE(16),
        height: png.readUInt32BE(20),
      };
      samples.push({
        requested: {
          resolution,
          interfaceScale: scale,
          contentDIP: [width, height],
        },
        nativeContentDIP: native.content,
        osDpi: display.screen.scaleFactor,
        zoomFactor: native.zoom,
        cssViewport: css,
        afterCapture,
        layoutMetrics,
        nativePhysicalClientPixels: {
          width: Math.round(native.content[0] * display.screen.scaleFactor),
          height: Math.round(native.content[1] * display.screen.scaleFactor),
        },
        captureBoundary:
          'Playwright Chromium CDP viewport PNG; output density excludes the native page zoom and is not a complete physical-window capture',
        png: { ...pixels, path: screenshotPath },
        densityWasSimulated: false,
      });
      await writeFile(
        join(output, 'display-measurements.json'),
        JSON.stringify({ version: 1, samples }, null, 2) + '\n',
      );
      assert.deepEqual(
        afterCapture,
        css,
        'Viewport geometry changed during PNG capture',
      );
      assert.deepEqual(native.content, [width, height]);
      assert.deepEqual(display.preferences, {
        resolution,
        interfaceScale: scale,
      });
      assert.ok(Math.abs(native.zoom - display.zoomFactor) < 1e-9);
      assert.ok(
        Math.abs(native.content[0] / css.width - display.zoomFactor) < 0.02,
      );
      assert.ok(
        Math.abs(native.content[1] / css.height - display.zoomFactor) < 0.02,
      );
      assert.ok(
        Math.abs(layoutMetrics.cssVisualViewport.zoom - native.zoom) < 1e-9,
      );
      assert.ok(
        Math.abs(
          layoutMetrics.layoutViewport.clientWidth -
            layoutMetrics.cssVisualViewport.clientWidth * css.dpi,
        ) <= 2,
      );
      assert.ok(
        Math.abs(
          layoutMetrics.layoutViewport.clientHeight -
            layoutMetrics.cssVisualViewport.clientHeight * css.dpi,
        ) <= 2,
      );
    }
    for (const sample of samples) {
      const samplingScale =
        sample.cssViewport.dpi / sample.layoutMetrics.cssVisualViewport.zoom;
      assert.ok(Math.abs(samplingScale - sample.osDpi) < 0.02);
      assert.ok(
        Math.abs(
          sample.png.width -
            Math.round(sample.cssViewport.width * samplingScale),
        ) <= 2,
      );
      assert.ok(
        Math.abs(
          sample.png.height -
            Math.round(sample.cssViewport.height * samplingScale),
        ) <= 2,
      );
    }
    await host.evaluate(
      (preferences) => window.tablemaxDisplay.update(preferences),
      savedPreferences,
    );
    await requestWindow('resize', { width: 1280, height: 800 });
    return { samples, physicalMultiDPITested: false };
  });
  await check(
    'real-app-denies-nonadministrator-host-routes-before-game-import',
    async () => {
      const { io } = createRequire(resolve('apps/web/package.json'))(
        'socket.io-client',
      );
      const hostToken = await host.evaluate(() =>
        sessionStorage.getItem('tablemax-host'),
      );
      const view = async (token) => {
        const response = await fetch(origin + '/api/session/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const reply = await response.json();
        assert.equal(reply.ok, true);
        return reply.view;
      };
      const command = async (token, action) => {
        const socket = io(origin, {
          auth: { token },
          transports: ['websocket'],
          forceNew: true,
          reconnection: false,
          timeout: 5000,
        });
        try {
          await new Promise((done, reject) => {
            socket.once('connect', done);
            socket.once('connect_error', reject);
          });
          const current = await view(token);
          const result = await socket
            .timeout(5000)
            .emitWithAck('room:command', {
              actionId: randomUUID(),
              instanceId: current.instanceId,
              revision: current.revision,
              branch: current.branch,
              command: action,
            });
          assert.equal(
            result.ok,
            true,
            `Legal command ${action.type} must succeed`,
          );
        } finally {
          socket.close();
        }
      };
      await command(hostToken, { type: 'select-game', gameId: 'uno' });
      const players = [];
      for (const name of ['原生门禁玩家', '门禁朋友']) {
        const response = await fetch(origin + '/api/session/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            requestKey: randomBytes(32).toString('hex'),
          }),
        });
        const joined = await response.json();
        assert.equal(joined.ok, true);
        assert.equal(typeof joined.token, 'string');
        players.push(joined);
        await command(joined.token, { type: 'ready', ready: true });
      }
      await command(hostToken, { type: 'start' });
      if ((await view(hostToken)).paused)
        await command(hostToken, { type: 'resume' });
      const playing = await view(hostToken);
      assert.equal(playing.game.id, 'uno');
      assert.ok(playing.gameView);
      const player = players[0];
      const cases = [];
      for (const [kind, credential] of [
        ['missing', ''],
        ['invalid', 'f1-invalid-administrator'.repeat(2)],
        ['player', player.token],
      ]) {
        for (const path of ['/host', '/host/game']) {
          const requests = [];
          const observedPaths = [];
          const next = desktop.waitForEvent('window').then((page) => {
            page.on('request', (request) => {
              if (request.url().startsWith(origin))
                observedPaths.push(new URL(request.url()).pathname);
              if (
                /\/(?:games\/[^/]+\/web\/|game-packages\/[a-f0-9]{64}\/web\/|api\/game-packages\/releases\/)/.test(
                  request.url(),
                )
              )
                requests.push(new URL(request.url()).pathname);
            });
            return page;
          });
          const window = await desktop.request('new-window', {
            url:
              origin +
              path +
              (credential ? '#host=' + encodeURIComponent(credential) : ''),
            managed: false,
            partition: `f1-gate-${kind}-${path.replaceAll('/', '-')}`,
          });
          const page = await next;
          try {
            await page
              .getByRole('heading', {
                name: 'TableMax 管理兼展示端',
                exact: true,
              })
              .waitFor();
            await page
              .getByText(
                '此入口仅供已认证管理员使用。请从本机 TableMax 管理窗口进入。',
                { exact: true },
              )
              .waitFor();
            assert.equal(
              await page.locator('.room-root,[data-interaction-layer]').count(),
              0,
            );
            assert.equal(
              await page.evaluate(() => typeof window.tablemaxWindow),
              'undefined',
            );
            assert.deepEqual(requests, []);
            assert.ok(
              observedPaths.includes(path),
              'The observer must see the initial real App navigation before checking no game imports',
            );
            cases.push({
              kind,
              path,
              gameModuleRequests: 0,
              observedRequests: observedPaths.length,
              roomMounted: false,
              nativeWindowId: window.id,
            });
          } finally {
            await page.close();
          }
        }
      }
      return {
        gameId: playing.game.id,
        status: playing.status,
        gameViewPresent: true,
        legalPlayers: 2,
        cases,
      };
    },
  );
  await check('real-unseated-player-game-returns-to-admission', async () => {
    const next = desktop.waitForEvent('window');
    await desktop.request('new-window', {
      url: origin + '/player/game',
      managed: false,
      partition: 'f1-unseated-player',
    });
    const page = await next;
    try {
      await page.waitForURL('**/player');
      const frame = page.frameLocator('iframe');
      await frame
        .getByRole('heading', { name: '加入牌桌', exact: true })
        .waitFor();
      await frame.getByLabel('你的昵称', { exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => typeof window.tablemaxWindow),
        'undefined',
      );
      return { path: new URL(page.url()).pathname, admission: true };
    } finally {
      await page.close();
    }
  });
  await desktop.close();
  desktop = undefined;
  await check(
    'testing-prototype-compatibility-without-bridge-authority',
    async () => {
      prototypeServer = createServer((_request, response) => {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(
          '<!doctype html><meta charset="utf-8"><h1>Native prototype compatibility fixture</h1>',
        );
      });
      await new Promise((done) => prototypeServer.listen(0, '127.0.0.1', done));
      const url = `http://127.0.0.1:${prototypeServer.address().port}/prototype.html`;
      desktop = await launchDesktop({
        executablePath,
        args: ['--foundation-test'],
        soundEnabled: false,
        env: {
          ...process.env,
          TABLEMAX_PROTOTYPE_URL: url,
          TABLEMAX_DATA_DIR: join(work, 'prototype-data'),
          TABLEMAX_BOX_DIRECTORY: join(work, 'prototype-runtime-root'),
          TABLEMAX_HOST: '127.0.0.1',
          TABLEMAX_PORT: '0',
          TEMP: work,
          TMP: work,
        },
        timeout: 30000,
      });
      const page = await desktop.firstWindow();
      await page
        .getByRole('heading', {
          name: 'Native prototype compatibility fixture',
        })
        .waitFor();
      assert.equal((await desktop.request('windows')).length, 1);
      await assert.rejects(page.evaluate(() => window.tablemaxWindow.read()));
      assert.equal(
        (await desktop.request('runtime')).powerBlockerActive,
        false,
      );
      return { testingOnly: true, bridgeAuthorized: false };
    },
  );
  report.result =
    report.failures.length || report.pending.length ? 'failed' : 'passed';
} catch (error) {
  report.result = 'failed';
  report.failures.push({
    id: 'setup-or-dependent-flow',
    error: error.stack ?? String(error),
  });
  process.exitCode = 1;
} finally {
  await desktop?.close().catch((error) => {
    report.result = 'failed';
    report.failures.push({ id: 'owned-shutdown', error: String(error) });
  });
  if (prototypeServer) await new Promise((done) => prototypeServer.close(done));
  for (const id of plannedChecks)
    if (
      selectedChecks.has(id) &&
      !report.checks.some((item) => item.id === id) &&
      !report.pending.some((item) => item.id === id)
    )
      report.pending.push({
        id,
        reason: 'Setup or an earlier dependent flow did not complete',
      });
  if (report.result !== 'passed') process.exitCode = 1;
  report.completedAt = new Date().toISOString();
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.length,
      failures: report.failures.length,
      report: relative(process.cwd(), reportPath),
    }),
  );
}
