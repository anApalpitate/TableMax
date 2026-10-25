import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { promisify } from 'node:util';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { leanCatalogPlugin } from '../../build/lean-catalog.mjs';
import { applicationVersion } from '../../shared/application-version.mjs';
import { launchDesktop } from '../support/desktop-test.mjs';
import { captureBrowserScreenshot } from '../support/screenshots.mjs';
import {
  fixedNativeProfileCheckIds,
  selectFixedNativeProfile,
} from '../runner/scopes.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const local = (value) =>
  relative(resolve('.'), resolve(value)).replaceAll('\\', '/');
const quoted = (value) => JSON.stringify(resolve(value));
const execute = promisify(execFile);
function checkedDirectory(value, prefix) {
  assert(value, `A ${prefix}/ directory is required`);
  const absolute = resolve(value),
    name = local(absolute);
  assert(
    !isAbsolute(name) && name.startsWith(prefix + '/'),
    `Expected workspace ${prefix}/ directory`,
  );
  for (let cursor = absolute; cursor !== resolve('.'); cursor = dirname(cursor))
    assert(
      !existsSync(cursor) || !lstatSync(cursor).isSymbolicLink(),
      'Linked test output rejected',
    );
  return absolute;
}

// Internal mode of verify-host-only-native.mjs, not a second CLI. The prototype
// transport changes no production authorization: /host must still pass the
// normal managed-window, origin, committed/current route and top-frame checks.
export async function runFixedProfileNative(args) {
  const selection = selectFixedNativeProfile(args);
  const task = checkedDirectory(
    selection.task ?? process.env.TABLEMAX_TASK_TMP,
    'tmp',
  );
  const evidence = selection.evidence ?? 'fixed-native';
  assert.match(evidence, /^[a-z0-9][a-z0-9-]{0,63}$/);
  const parentOutput = process.env.TABLEMAX_TEST_OUTPUT_DIR;
  const output = checkedDirectory(
    parentOutput ??
      join('artifacts/maintenance', relative(resolve('tmp'), task), evidence),
    'artifacts',
  );
  assert(
    !existsSync(join(output, 'report.json')),
    'Evidence round already exists',
  );
  await mkdir(task, { recursive: true });
  // Parent rounds own evidence output; their unique work directory must not
  // enter semantic arguments or the content fingerprint.
  const work = parentOutput
    ? await mkdtemp(join(task, 'fixed-native-'))
    : join(task, evidence);
  if (!parentOutput) {
    assert(!existsSync(work), 'Native work round already exists');
    await mkdir(work, { recursive: true });
  }
  await mkdir(output, { recursive: true });
  const temporary = join(work, 'temp');
  await mkdir(temporary);
  process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
  process.env.TEMP = process.env.TMP = temporary;
  const inputs = new Map();
  async function bind(path) {
    if (
      !existsSync(path) ||
      resolve(path).split(/[\\/]/).includes('node_modules')
    )
      return;
    const data = await readFile(path),
      key = local(path);
    const record = { path: key, bytes: data.length, sha256: sha(data) };
    assert(
      !inputs.has(key) || inputs.get(key).sha256 === record.sha256,
      `Source changed while preparing: ${key}`,
    );
    inputs.set(key, record);
  }
  async function bindTree(path) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      if (['obj', 'bin'].includes(item.name)) continue;
      const child = join(path, item.name);
      if (item.isDirectory()) await bindTree(child);
      else if (item.isFile()) await bind(child);
    }
  }
  const report = {
    version: 1,
    result: 'running',
    startedAt: new Date().toISOString(),
    selection,
    work: local(work),
    checks: [],
    failures: [],
    pending: [],
    samples: [],
    screenshots: [],
    inputs: [],
    boundary:
      'Actual current-source WinForms/WebView2 shell and production PlatformGame/FixedCanvasFrame in an authorized loopback /host source fixture. Hidden, muted, Medium token, current physical monitor DPI only. No game service, legal game state, natural match, complete assembled payload, installer, physical 4K, physical multi-monitor or real-phone acceptance.',
  };
  const shell = join(work, 'shell'),
    data = join(work, 'data');
  const displayPath = join(data, 'display-settings.json');
  let desktop, host, server;
  const selected = new Set(selection.checks);
  async function check(id, operation) {
    if (!selected.has(id)) return;
    if (report.failures.length >= 10) {
      report.pending.push({ id, reason: 'Failure budget reached' });
      return;
    }
    try {
      const details = await operation();
      report.checks.push({ id, result: 'passed', details });
    } catch (error) {
      const failure = {
        id,
        result: 'failed',
        error: error.stack ?? String(error),
      };
      if (host && !host.isClosed()) {
        try {
          const path = join(output, `${id}-failure.png`);
          const bytes = await captureBrowserScreenshot(host, { path });
          failure.screenshot = { path: local(path), sha256: sha(bytes) };
        } catch (captureError) {
          failure.captureError = String(captureError);
        }
      }
      report.checks.push(failure);
      report.failures.push(failure);
    }
  }
  const snapshot = () => host.evaluate(() => window.tablemaxDisplay.read());
  const windows = () => desktop.request('windows');
  const managed = async () => (await windows()).find((item) => item.managed);
  const resize = async (width, height) =>
    desktop.request('window', {
      id: (await managed()).id,
      operation: 'resize',
      width,
      height,
    });
  const render = async (mode) => {
    await host.evaluate((value) => window.renderNativeProfile(value), mode);
    await host.waitForFunction(
      (profile) =>
        window.tablemaxDisplay
          .read()
          .then((value) => value.layoutProfile === profile),
      mode === 'fixed' ? 'fixed-host-1280-v1' : 'legacy',
    );
  };
  const raw = (method, params) =>
    host.evaluate(
      ({ method, params }) =>
        new Promise((done, reject) => {
          const id = 1000000 + Math.floor(Math.random() * 1000000);
          const timer = setTimeout(() => {
            window.chrome.webview.removeEventListener('message', received);
            reject(new Error('Raw bridge reply timed out'));
          }, 5000);
          function received({ data }) {
            if (data.id !== id) return;
            clearTimeout(timer);
            window.chrome.webview.removeEventListener('message', received);
            done(data);
          }
          window.chrome.webview.addEventListener('message', received);
          window.chrome.webview.postMessage({ id, method, params });
        }),
      { method, params },
    );
  async function launch() {
    desktop = await launchDesktop({
      executablePath: join(shell, 'TableMax.exe'),
      args: ['--foundation-test'],
      soundEnabled: false,
      timeout: 45000,
      env: {
        ...process.env,
        TABLEMAX_PROTOTYPE_URL: server.url,
        TABLEMAX_DATA_DIR: data,
        TABLEMAX_BOX_DIRECTORY: join(work, 'runtime-root'),
        TABLEMAX_HOST: '127.0.0.1',
        TABLEMAX_PORT: '0',
        TEMP: temporary,
        TMP: temporary,
      },
    });
    host = await desktop.firstWindow();
    await host.waitForFunction(() => window.nativeFixtureReady === true);
    await host.waitForFunction(() =>
      window.tablemaxDisplay
        .read()
        .then((value) => value.layoutProfile === 'legacy'),
    );
  }
  try {
    const integrity =
      (
        await execute('whoami.exe', ['/groups'], { windowsHide: true })
      ).stdout.match(/S-1-16-\d+/g) ?? [];
    assert.deepEqual(
      integrity,
      ['S-1-16-8192'],
      'Native source check requires standard Medium integrity',
    );
    report.integrity = integrity;
    for (const path of [
      'tools/test/desktop/verify-host-only-native.mjs',
      'tools/test/desktop/fixed-profile-native.mjs',
      'tools/test/support/desktop-test.mjs',
      'tools/test/support/screenshots.mjs',
      'tools/test/runner/scopes.mjs',
      'tools/build/lean-catalog.mjs',
      'tools/shared/application-version.mjs',
      'global.json',
      'package.json',
      'build-version.json',
      'pnpm-lock.yaml',
      'assets/platform/app-icon.ico',
    ])
      await bind(resolve(path));
    await bindTree(resolve('apps/desktop/native'));
    await bindTree(resolve('apps/desktop/installation-runtime'));
    const version = await applicationVersion();
    const compilationArgs = [
      'build',
      resolve('apps/desktop/native/TableMax.csproj'),
      '--configuration',
      'Release',
      '--source',
      resolve('.cache/nuget-downloads'),
      '-p:RestoreLockedMode=true',
      '-p:NuGetAudit=false',
      '-p:UseSharedCompilation=false',
      '-p:IncludeSourceRevisionInInformationalVersion=false',
      `-p:Version=${version.releaseVersion}`,
      `-p:AssemblyVersion=${version.buildVersion}`,
      `-p:FileVersion=${version.buildVersion}`,
      `-p:OutputPath=${shell}/`,
      `-p:BaseIntermediateOutputPath=${join(work, 'obj')}/`,
      `-p:RestorePackagesPath=${join(work, 'nuget')}`,
    ];
    report.build = {
      project: 'apps/desktop/native/TableMax.csproj',
      arguments: compilationArgs,
      version,
      outputDirectory: local(shell),
      isolatedSourceBuild: true,
      installerExported: false,
    };
    try {
      const result = await execute('dotnet', compilationArgs, {
        windowsHide: true,
        timeout: 90000,
        maxBuffer: 8388608,
        env: {
          ...process.env,
          DOTNET_CLI_HOME: join(work, 'dotnet-home'),
          DOTNET_NOLOGO: '1',
          DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
          DOTNET_CLI_TELEMETRY_OPTOUT: '1',
          NUGET_PACKAGES: join(work, 'nuget'),
        },
      });
      await writeFile(
        join(output, 'native-build.log'),
        result.stdout + result.stderr,
      );
    } catch (error) {
      await writeFile(
        join(output, 'native-build.log'),
        (error.stdout ?? '') + (error.stderr ?? '') + String(error),
      );
      throw error;
    }
    await copyFile(
      join(shell, 'runtimes/win-x64/native/WebView2Loader.dll'),
      join(shell, 'WebView2Loader.dll'),
    );
    report.assembly = [];
    for (const name of [
      'TableMax.exe',
      'TableMax.exe.config',
      'Microsoft.Web.WebView2.Core.dll',
      'Microsoft.Web.WebView2.WinForms.dll',
      'WebView2Loader.dll',
    ]) {
      const bytes = await readFile(join(shell, name));
      report.assembly.push({ name, bytes: bytes.length, sha256: sha(bytes) });
    }
    await writeFile(
      join(work, 'index.html'),
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
    );
    await writeFile(join(work, 'entry.tsx'), sourceEntry());
    await bind(join(work, 'entry.tsx'));
    await build({
      root: work,
      configFile: false,
      base: '/',
      assetsInclude: ['**/*.flac'],
      logLevel: 'error',
      plugins: [
        leanCatalogPlugin(resolve('.')),
        react(),
        {
          name: 'bind-native-profile-source',
          async load(id) {
            if (!id.startsWith('\0')) await bind(id.split('?')[0]);
            return null;
          },
        },
      ],
      resolve: {
        alias: Object.entries({
          '@tablemax/web-host/platform': 'packages/web-host/src/platform.ts',
          '@tablemax/web-host': 'packages/web-host/src/index.tsx',
          '@tablemax/protocol': 'packages/protocol/src/index.ts',
          '@tablemax/game-sdk/module-manifest':
            'packages/game-sdk/src/module-manifest.ts',
          '@tablemax/game-sdk/metadata': 'packages/game-sdk/src/metadata.mjs',
          '@tablemax/game-sdk': 'packages/game-sdk/src/index.ts',
          zod: 'packages/protocol/node_modules/zod',
          'socket.io-client': 'apps/web/node_modules/socket.io-client',
          react: 'apps/web/node_modules/react',
          'react-dom': 'apps/web/node_modules/react-dom',
        }).map(([find, replacement]) => ({
          find,
          replacement: resolve(replacement),
        })),
      },
      build: {
        outDir: join(work, 'web'),
        target: 'chrome110',
        emptyOutDir: true,
      },
    });
    server = await sourceServer(join(work, 'web'));
    await mkdir(data);
    await writeFile(
      displayPath,
      JSON.stringify({
        version: 2,
        host: { resolution: 'auto', interfaceScale: 100 },
      }) + '\n',
      { flag: 'wx' },
    );
    await launch();
    await check('native-fixed-source-build-and-medium', async () => {
      const runtime = await desktop.request('runtime');
      report.environment = {
        node: process.version,
        webview2: runtime.versions.webview2,
        monitorDisplays: runtime.displays,
        currentMonitorDpi: (await snapshot()).screen.scaleFactor,
        densityWasSimulated: false,
        hidden: true,
        muted: true,
        listen: '127.0.0.1',
        nativePackagedFlag: runtime.packaged,
      };
      // IsDevelopmentBuild recognizes only <repository>/build/desktop and its
      // marker. An isolated tmp build is intentionally classified as packaged;
      // compilation inputs and output hashes above prove this shell's origin.
      assert.equal(runtime.packaged, true);
      assert.equal(runtime.servicePid, 0);
      assert.equal(new URL(runtime.origin).hostname, '127.0.0.1');
      assert.equal((await windows()).length, 1);
      assert.equal((await managed()).audioMuted, true);
      return {
        sourceBuild: true,
        servicePid: 0,
        productionAuthorizationUnchanged: true,
        nativeClassification: 'outside the sole recognized development output',
      };
    });
    await check('native-fixed-production-adapter', async () => {
      const before = await readFile(displayPath, 'utf8');
      await render('fixed');
      const first = await snapshot();
      assert.equal(first.layoutProfile, 'fixed-host-1280-v1');
      await render('legacy');
      assert.equal((await snapshot()).layoutDocumentId, first.layoutDocumentId);
      await render('fixed');
      assert.equal(await readFile(displayPath, 'utf8'), before);
      await host.getByLabel('原生契约草稿').fill('保留未提交草稿');
      await resize(1920, 1080);
      await host.waitForFunction(
        () => innerWidth >= 1280 && innerHeight >= 720,
      );
      assert.equal(
        await host.getByLabel('原生契约草稿').inputValue(),
        '保留未提交草稿',
      );
      assert.equal(await host.evaluate(() => window.nativeCommands.length), 0);
      return {
        fixedLegacyFixed: true,
        draftPreservedOnResize: true,
        commands: 0,
        profileWrites: 0,
      };
    });
    await check('native-fixed-ui-size-and-canvas', async () => {
      await render('fixed');
      for (const [width, height] of [
        [1920, 1080],
        [3840, 2160],
      ])
        for (const ui of [100, 125, 150]) {
          await resize(width, height);
          const display = await host.evaluate(
            (value) =>
              window.tablemaxDisplay.update({
                resolution: 'auto',
                interfaceScale: value,
              }),
            ui,
          );
          await host.waitForFunction(
            (value) =>
              Math.abs(
                devicePixelRatio / value.screen.scaleFactor - value.zoomFactor,
              ) < 0.02,
            display,
          );
          await host.waitForFunction(
            () => window.nativeLayout?.logicalSize.width === 1280,
          );
          const native = await managed();
          const geometry = await host.evaluate(() => {
            const canvas = document.querySelector('.tablemax-fixed-canvas');
            const rect = canvas.getBoundingClientRect();
            return {
              inner: [innerWidth, innerHeight],
              dpr: devicePixelRatio,
              canvas: {
                width: rect.width,
                height: rect.height,
                cssWidth: getComputedStyle(canvas).width,
                cssHeight: getComputedStyle(canvas).height,
                declaredWidth: getComputedStyle(canvas)
                  .getPropertyValue('--tablemax-canvas-width')
                  .trim(),
                declaredHeight: getComputedStyle(canvas)
                  .getPropertyValue('--tablemax-canvas-height')
                  .trim(),
                transform: getComputedStyle(canvas).transform,
              },
              font: getComputedStyle(
                document.querySelector('.native-profile-probe'),
              ).fontSize,
              layout: {
                scale: window.nativeLayout.scale,
                fitStatus: window.nativeLayout.fitStatus,
                logicalSize: window.nativeLayout.logicalSize,
              },
            };
          });
          const expected = Math.min(
            (Math.max(1, Math.min(width / 1920, height / 1080)) * ui) / 100,
            Math.max(1, Math.min(width / 1280, height / 720)),
            3,
          );
          const sample = {
            contentDIP: [width, height],
            ui,
            display,
            nativeZoom: native.zoom,
            expectedZoom: expected,
            geometry,
            densityWasSimulated: false,
          };
          report.samples.push(sample);
          assert.ok(Math.abs(display.zoomFactor - expected) < 1e-9);
          assert.ok(Math.abs(native.zoom - expected) < 1e-9);
          assert.equal(display.undersized, false);
          assert.equal(display.layoutProfile, 'fixed-host-1280-v1');
          assert.deepEqual(native.content, [width, height]);
          assert.ok(Math.abs(geometry.canvas.width - 1280) <= 0.5);
          assert.ok(Math.abs(geometry.canvas.height - 720) <= 0.5);
          assert.ok(
            Math.abs(parseFloat(geometry.canvas.cssWidth) - 1280) <= 0.5,
          );
          assert.ok(
            Math.abs(parseFloat(geometry.canvas.cssHeight) - 720) <= 0.5,
          );
          assert.equal(geometry.canvas.declaredWidth, '1280px');
          assert.equal(geometry.canvas.declaredHeight, '720px');
          assert.equal(geometry.canvas.transform, 'none');
          assert.deepEqual(geometry.layout.logicalSize, {
            width: 1280,
            height: 720,
          });
          assert.equal(geometry.font, '18px');
          assert.equal(geometry.layout.scale, 1);
          assert.equal(geometry.layout.fitStatus, 'fits');
          assert.ok(
            Math.abs(native.content[0] / geometry.inner[0] - native.zoom) <
              0.02,
          );
          if (width === 1920) {
            const path = join(output, `native-fixed-1080-ui${ui}.png`);
            const png = await captureBrowserScreenshot(host, { path });
            sample.png = {
              path: local(path),
              sha256: sha(png),
              width: png.readUInt32BE(16),
              height: png.readUInt32BE(20),
              boundary:
                'WebView2 CDP viewport PNG, not a whole physical window capture',
            };
            report.screenshots.push(sample.png);
          }
        }
      await host.evaluate(() =>
        window.tablemaxDisplay.update({
          resolution: 'auto',
          interfaceScale: 100,
        }),
      );
      await resize(1279, 719);
      await host.waitForFunction(
        () => window.nativeLayout?.fitStatus === 'overflow',
      );
      assert.equal((await snapshot()).undersized, true);
      assert.equal((await snapshot()).zoomFactor, 1);
      const scrolling = await host.evaluate(() => {
        const node = document.querySelector('.tablemax-canvas-viewport');
        node.scrollLeft = node.scrollWidth;
        node.scrollTop = node.scrollHeight;
        return {
          scrollWidth: node.scrollWidth,
          scrollHeight: node.scrollHeight,
          left: node.scrollLeft,
          top: node.scrollTop,
        };
      });
      assert.ok(scrolling.scrollWidth >= 1280 && scrolling.scrollHeight >= 720);
      assert.ok(scrolling.left > 0 && scrolling.top > 0);
      return {
        actualMonitorDpi: (await snapshot()).screen.scaleFactor,
        dpiOverride: false,
        measurementCount: report.samples.length,
        belowMinimumScroll: scrolling,
      };
    });
    await check('native-fixed-document-generation', async () => {
      await resize(1920, 1080);
      await render('fixed');
      const previous = await snapshot(),
        settings = await readFile(displayPath, 'utf8');
      const transitions = [
        { kind: 'initial', token: previous.layoutDocumentId },
      ];
      await host.evaluate(() => {
        location.hash = 'native-layout-hash';
      });
      const hash = await snapshot();
      assert.equal(hash.layoutDocumentId, previous.layoutDocumentId);
      assert.equal(hash.layoutProfile, 'fixed-host-1280-v1');
      transitions.push({ kind: 'hash', token: hash.layoutDocumentId });
      await host.evaluate(() =>
        history.pushState(null, '', '/host/game?native-layout-spa=1'),
      );
      const pushed = await snapshot();
      assert.equal(pushed.layoutDocumentId, previous.layoutDocumentId);
      assert.equal(pushed.layoutProfile, 'fixed-host-1280-v1');
      transitions.push({ kind: 'pushState', token: pushed.layoutDocumentId });
      await host.evaluate(() => history.replaceState(null, '', '/host'));
      const replaced = await snapshot();
      assert.equal(replaced.layoutDocumentId, previous.layoutDocumentId);
      assert.equal(replaced.layoutProfile, 'fixed-host-1280-v1');
      transitions.push({
        kind: 'replaceState',
        token: replaced.layoutDocumentId,
      });
      await host.reload();
      await host.waitForFunction(() => window.nativeFixtureReady === true);
      await host.waitForFunction(() =>
        window.tablemaxDisplay
          .read()
          .then((value) => value.layoutProfile === 'legacy'),
      );
      const fresh = await snapshot();
      assert.notEqual(fresh.layoutDocumentId, previous.layoutDocumentId);
      transitions.push({ kind: 'reload', token: fresh.layoutDocumentId });
      const late = await raw('display.setLayoutProfile', [
        {
          profile: 'fixed-host-1280-v1',
          generation: 2000000,
          documentId: previous.layoutDocumentId,
        },
      ]);
      assert.ok(late.error);
      assert.equal((await snapshot()).layoutProfile, 'legacy');
      await render('fixed');
      const duplicate = await raw('display.setLayoutProfile', [
        {
          profile: 'legacy',
          generation: 1,
          documentId: fresh.layoutDocumentId,
        },
      ]);
      assert.ok(duplicate.error);
      assert.equal((await snapshot()).layoutProfile, 'fixed-host-1280-v1');
      const nextUrl = new URL(server.url);
      nextUrl.pathname = '/host/game';
      await host.goto(nextUrl.href);
      await host.waitForFunction(() => window.nativeFixtureReady === true);
      await host.waitForFunction(() =>
        window.tablemaxDisplay
          .read()
          .then((value) => value.layoutProfile === 'legacy'),
      );
      const navigated = await snapshot();
      assert.notEqual(navigated.layoutDocumentId, fresh.layoutDocumentId);
      transitions.push({
        kind: 'new-document',
        token: navigated.layoutDocumentId,
      });
      const crossDocument = await raw('display.setLayoutProfile', [
        {
          profile: 'fixed-host-1280-v1',
          generation: 2000000,
          documentId: fresh.layoutDocumentId,
        },
      ]);
      assert.ok(crossDocument.error);
      await render('fixed');
      assert.equal(await readFile(displayPath, 'utf8'), settings);
      return {
        hashPreserved: true,
        pushStatePreserved: true,
        replaceStatePreserved: true,
        reloadReset: true,
        newDocumentReset: true,
        newDocumentToken: true,
        lateDocumentRejected: true,
        oldGenerationRejected: true,
        transitions,
        rejections: {
          lateDocument: late.error,
          oldGeneration: duplicate.error,
          previousDocument: crossDocument.error,
        },
      };
    });
    await check('native-fixed-authority-and-persistence', async () => {
      await render('fixed');
      const before = await snapshot();
      for (const path of [
        '/player',
        '/player/game',
        '/public',
        '/public/game',
      ]) {
        await host.evaluate(
          (value) => history.replaceState(null, '', value),
          path,
        );
        const denied = await raw('display.setLayoutProfile', [
          {
            profile: 'legacy',
            generation: 2000000,
            documentId: before.layoutDocumentId,
          },
        ]);
        assert.ok(denied.error, `Unauthorized route accepted profile: ${path}`);
      }
      await host.evaluate(() => history.replaceState(null, '', '/host'));
      const extra = await raw('display.setLayoutProfile', [
        {
          profile: 'legacy',
          generation: 2000000,
          documentId: before.layoutDocumentId,
          width: 1,
        },
      ]);
      assert.ok(extra.error);
      await host.evaluate(() => {
        const frame = document.createElement('iframe');
        frame.id = 'native-profile-child';
        frame.src = 'about:blank';
        document.body.append(frame);
      });
      const child = host.frameLocator('#native-profile-child');
      await child.locator('body').waitFor({ state: 'attached' });
      const frame = host.frames().find((value) => value !== host.mainFrame());
      assert.equal(
        await frame.evaluate(() => typeof window.tablemaxDisplay),
        'undefined',
      );
      await frame.evaluate(
        (documentId) =>
          window.chrome?.webview?.postMessage({
            id: 1999999,
            method: 'display.setLayoutProfile',
            params: [{ profile: 'legacy', generation: 2000000, documentId }],
          }),
        before.layoutDocumentId,
      );
      await host.waitForTimeout(150);
      assert.equal((await snapshot()).layoutProfile, 'fixed-host-1280-v1');
      await host.evaluate(() =>
        document.getElementById('native-profile-child').remove(),
      );
      const saved = await host.evaluate(() =>
        window.tablemaxDisplay.update({
          resolution: '2560x1440',
          interfaceScale: 125,
        }),
      );
      const bytes = await readFile(displayPath, 'utf8');
      assert.deepEqual(JSON.parse(bytes), {
        version: 2,
        host: saved.preferences,
      });
      await host.evaluate(() =>
        localStorage.setItem('native-fixed-profile-marker', 'retained'),
      );
      await desktop.close();
      desktop = undefined;
      await launch();
      const restarted = await snapshot();
      assert.deepEqual(restarted.preferences, saved.preferences);
      assert.equal(restarted.layoutProfile, 'legacy');
      assert.equal(
        await host.evaluate(() =>
          localStorage.getItem('native-fixed-profile-marker'),
        ),
        'retained',
      );
      assert.equal(await readFile(displayPath, 'utf8'), bytes);
      return {
        unauthorizedRoutes: 4,
        childFrameAuthority: false,
        arbitraryGeometryRejected: true,
        restartKeepsPreferencesButNotProfile: true,
      };
    });
    for (const record of inputs.values())
      assert.equal(
        sha(await readFile(resolve(record.path))),
        record.sha256,
        `Input changed during native verification: ${record.path}`,
      );
    report.result = report.failures.length ? 'failed' : 'passed';
  } catch (error) {
    report.result = 'failed';
    report.failures.push({
      id: 'setup-or-input-binding',
      error: error.stack ?? String(error),
    });
  } finally {
    await desktop?.close().catch((error) => {
      report.result = 'failed';
      report.failures.push({
        id: 'owned-native-shutdown',
        error: String(error),
      });
    });
    await server?.close();
    for (const id of fixedNativeProfileCheckIds)
      if (selected.has(id) && !report.checks.some((value) => value.id === id))
        report.pending.push({ id, reason: 'Setup did not complete' });
    report.inputs = [...inputs.values()];
    report.completedAt = new Date().toISOString();
    if (report.pending.length || report.failures.length) {
      report.result = 'failed';
      process.exitCode = 1;
    }
    await writeFile(
      join(output, 'report.json'),
      JSON.stringify(
        {
          ...report,
          failureDetails: report.failures,
          failures: report.failures.length,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      JSON.stringify({
        result: report.result,
        checks: report.checks.length,
        failures: report.failures.length,
        pending: report.pending.length,
        report: local(join(output, 'report.json')),
      }),
    );
  }
}

function sourceEntry() {
  return `import React,{useLayoutEffect,useState}from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{useGameLayout}from'@tablemax/web-host';import{PlatformGame}from ${quoted('apps/web/src/session/gameHostAdapter.tsx')};
const style=document.createElement('style');style.textContent='html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}*{box-sizing:border-box}.native-profile-probe{height:100%;padding:24px;background:#fff9e7;color:#173b32;font:18px Segoe UI,Microsoft YaHei,sans-serif}.native-profile-probe h1{font-size:24px}.native-profile-probe input,.native-profile-probe button{font:inherit;min-height:44px;margin:12px}.native-profile-probe label{display:block}';document.head.append(style);
window.nativeCommands=[];function Probe(){const layout=useGameLayout();const[draft,setDraft]=useState('未提交');useLayoutEffect(()=>{window.nativeLayout=layout});return <section className="native-profile-probe"><h1>原生固定画布接入</h1><p>1280×720逻辑画布，CSS倍率1</p><label>原生契约草稿<input aria-label="原生契约草稿" value={draft} onChange={event=>setDraft(event.target.value)}/></label><button onClick={()=>window.nativeCommands.push('unexpected-command')}>保持可达</button></section>}
const root=createRoot(document.getElementById('root')),legacy={Screen:Probe,savedChanges:()=>[],motionDuration:0},fixed={...legacy,layout:{contract:'fixed-v1'}},noop=()=>{};const session={role:'host',view:null,self:undefined,connected:true,locked:false,canControl:false,message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],command:noop};window.renderNativeProfile=mode=>flushSync(()=>root.render(<PlatformGame session={session} client={mode==='fixed'?fixed:legacy}/>));window.renderNativeProfile('legacy');window.nativeFixtureReady=true;`;
}

async function sourceServer(directory) {
  const root = resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://127.0.0.1').pathname;
      const file = resolve(
        root,
        '.' +
          (['/host', '/host/game', '/player', '/player/game'].includes(path)
            ? '/index.html'
            : decodeURIComponent(path)),
      );
      assert(file.startsWith(root + sep));
      const bytes = await readFile(file);
      response
        .writeHead(200, {
          'Content-Type':
            {
              '.html': 'text/html; charset=utf-8',
              '.js': 'text/javascript',
              '.css': 'text/css',
              '.png': 'image/png',
              '.webp': 'image/webp',
              '.svg': 'image/svg+xml',
            }[extname(file)] ?? 'application/octet-stream',
        })
        .end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}/host`,
    close: () => new Promise((done) => server.close(done)),
  };
}
