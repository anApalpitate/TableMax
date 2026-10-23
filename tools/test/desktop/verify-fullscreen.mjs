import { captureBrowserScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { launchDesktop, desktopExecutable } from '../support/desktop-test.mjs';

const bridgeSource = (await readFile('apps/desktop/native/Bridge.js', 'utf8'))
  .replace('__WINDOW_ID__', '1')
  .replace('__MANAGED__', 'true')
  .replace('__TESTING__', 'true');
const calls = [],
  handlers = new Map();
const fakeWindow = {
  chrome: {
    webview: {
      postMessage: (message) => calls.push(message),
      addEventListener: (name, handler) => handlers.set(name, handler),
    },
  },
  addEventListener: (name, handler) => handlers.set(name, handler),
};
fakeWindow.top = fakeWindow;
vm.runInNewContext(bridgeSource, {
  window: fakeWindow,
  document: { querySelector: () => null },
  setTimeout,
  clearTimeout,
});
const reply = (value) => {
  const call = calls.at(-1);
  handlers.get('message')({ data: { id: call.id, result: value } });
};
const read = fakeWindow.tablemaxWindow.read();
assert.equal(calls.at(-1).method, 'window.read');
reply({ fullscreen: false, mode: 'windowed' });
assert.deepEqual(await read, { fullscreen: false, mode: 'windowed' });
const set = fakeWindow.tablemaxWindow.setFullscreen(true);
assert.deepEqual(Array.from(calls.at(-1).params), [true]);
reply({ fullscreen: true, mode: 'fullscreen' });
assert.deepEqual(await set, { fullscreen: true, mode: 'fullscreen' });
for (const mode of ['windowed', 'borderless', 'fullscreen']) {
  const changed = fakeWindow.tablemaxWindow.setMode(mode);
  assert.equal(calls.at(-1).method, 'window.setMode');
  assert.deepEqual(Array.from(calls.at(-1).params), [mode]);
  reply({ fullscreen: mode === 'fullscreen', mode });
  assert.equal((await changed).mode, mode);
}
let seen;
const unsubscribe = fakeWindow.tablemaxWindow.subscribe((value) => {
  seen = value;
});
handlers.get('message')({
  data: {
    type: 'changed',
    channel: 'window',
    value: { fullscreen: false, mode: 'borderless' },
  },
});
assert.equal(seen.fullscreen, false);
assert.equal(seen.mode, 'borderless');
unsubscribe();
handlers.get('message')({
  data: {
    type: 'changed',
    channel: 'window',
    value: { fullscreen: true, mode: 'fullscreen' },
  },
});
assert.equal(seen.fullscreen, false);
assert.equal(seen.mode, 'borderless');
const child = { top: fakeWindow };
vm.runInNewContext(bridgeSource, { window: child });
assert.equal(child.tablemaxWindow, undefined);
for (const [mode, expected] of [
  ['windowed', 'fullscreen'],
  ['borderless', 'windowed'],
  ['fullscreen', 'windowed'],
]) {
  handlers.get('keydown')({
    key: 'F11',
    isTrusted: true,
    repeat: false,
    preventDefault() {},
  });
  assert.equal(calls.at(-1).method, 'window.read');
  reply({ fullscreen: mode === 'fullscreen', mode });
  await new Promise((done) => setImmediate(done));
  assert.equal(calls.at(-1).method, 'window.setMode');
  assert.deepEqual(Array.from(calls.at(-1).params), [expected]);
  reply({ fullscreen: expected === 'fullscreen', mode: expected });
  await new Promise((done) => setImmediate(done));
}
console.log(
  'Window bridge VM: read, legacy fullscreen, all three modes, notification, unsubscribe and frame exclusion passed',
);
if (process.argv.includes('--bridge-only')) process.exit(0);

const run =
  process.argv.find((value) => value.startsWith('--run='))?.slice(6) ??
  `fullscreen-${Date.now()}`;
assert.match(run, /^[a-z0-9-]+$/i);
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const output = resolve(`artifacts/maintenance/v${version}/window-modes`, run);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/desktop-fullscreen-'));
await build({
  entryPoints: ['tools/test/fixtures/prepare-rules-guides.ts'],
  outfile: join(work, 'prepare.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const { prepare } = createRequire(import.meta.url)(join(work, 'prepare.cjs'));
const fixture = await prepare(work, 5);
const dataDir = fixture.cases.find((entry) => entry.id === 'offer').dataDir;
const executablePath = resolve(
  process.argv.find((value) => value.startsWith('--executable='))?.slice(13) ??
    desktopExecutable,
);
const archivePath = process.argv
  .find((value) => value.startsWith('--zip='))
  ?.slice(6);
const foreground = process.argv.includes('--foreground');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidence = {
  result: 'started',
  executablePath,
  executableSha256: hash(await readFile(executablePath)),
  dataDir,
  checks: [],
  transitions: [],
  errors: [],
  foreground,
  portable: Boolean(archivePath),
  scope: foreground
    ? 'Actual normally framed foreground test window, nonactivating, briefly visible on the current monitor; three native window modes, video settings, trusted keys and menu, plus a saved Modern Art menu fixture. Hardware DPI and multi-monitor require separate acceptance.'
    : 'Actual hidden WebView2 native windows; three native window modes, video settings, trusted keys and menu, plus a saved Modern Art menu fixture. Hidden verification keeps native chrome off; foreground border rendering, hardware DPI and multi-monitor behavior require separate acceptance.',
};
if (archivePath) {
  const manifest = JSON.parse(
    await readFile(archivePath.replace(/\.zip$/i, '-manifest.json'), 'utf8'),
  );
  evidence.archiveSha256 = hash(await readFile(archivePath));
  assert.equal(evidence.archiveSha256, manifest.archive.sha256);
  assert.equal(
    evidence.executableSha256,
    manifest.files.find((file) => file.path === 'TableMax.exe').sha256,
  );
  evidence.packageSnapshot = manifest.snapshot;
}
let desktop;
try {
  desktop = await launchDesktop({
    executablePath,
    soundEnabled: false,
    args: foreground
      ? ['--foundation-test', '--tablemax-test-foreground']
      : ['--foundation-test'],
    env: {
      ...process.env,
      TABLEMAX_DATA_DIR: dataDir,
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
    },
  });
  const host = await desktop.firstWindow();
  host.on('pageerror', (error) => evidence.errors.push(error.message));
  await host.locator('[data-room-revision]').waitFor();
  const state = async (page) => {
    const id = await page.evaluate(() => window.__tablemaxWindowId);
    return (await desktop.request('windows')).find((entry) => entry.id === id);
  };
  const until = async (page, mode) => {
    await page.waitForFunction(
      (expected) =>
        window.tablemaxWindow
          .read()
          .then(
            (s) =>
              s.mode === expected &&
              s.fullscreen === (expected === 'fullscreen'),
          ),
      mode,
    );
    const current = await state(page);
    assert.equal(current.mode, mode);
    assert.equal(current.fullscreen, mode === 'fullscreen');
    assert.equal(
      current.borderStyle,
      foreground && mode === 'windowed' ? 'Sizable' : 'None',
    );
    evidence.transitions.push({
      mode,
      id: current.id,
      bounds: current.bounds,
      windowState: current.windowState,
      restoreBounds: current.restoreBounds,
      borderStyle: current.borderStyle,
    });
    return current;
  };
  const setMode = async (page, mode) => {
    assert.equal(
      (
        await page.evaluate(
          (value) => window.tablemaxWindow.setMode(value),
          mode,
        )
      ).mode,
      mode,
    );
    return until(page, mode);
  };
  const openVideo = async (page) => {
    const entry = page.getByRole('button', { name: '视频设置', exact: true });
    if (!(await entry.count()) || !(await entry.isVisible()))
      await page.getByRole('button', { name: '菜单', exact: true }).click();
    await entry.click();
    const dialog = page.getByRole('dialog', { name: '视频设置', exact: true });
    await dialog.waitFor();
    const select = dialog.getByRole('combobox', {
      name: '显示模式',
      exact: true,
    });
    await select.waitFor();
    assert.deepEqual(
      await select.locator('option').evaluateAll((options) =>
        options.map((option) => ({
          value: option.value,
          label: option.textContent,
        })),
      ),
      [
        { value: 'fullscreen', label: '全屏' },
        { value: 'borderless', label: '无边框窗口' },
        { value: 'windowed', label: '窗口' },
      ],
    );
    assert.equal(await dialog.getByText(/F11/i).count(), 0);
    await page.waitForFunction(() => {
      const select = document.querySelector('#window-mode');
      return select && !select.disabled;
    });
    return { dialog, select };
  };
  const selectMode = async (page, select, mode) => {
    await select.selectOption(mode);
    const current = await until(page, mode);
    await page.waitForFunction((expected) => {
      const control = document.querySelector('#window-mode');
      return control && !control.disabled && control.value === expected;
    }, mode);
    assert.equal(await select.inputValue(), mode);
    return current;
  };
  const closeVideo = async (dialog) => {
    await dialog.getByRole('button', { name: '关闭面板', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
  };
  await host.evaluate(() => {
    window.fullscreenSnapshots = [];
    window.tablemaxWindow.subscribe((s) =>
      window.fullscreenSnapshots.push(s.mode),
    );
  });
  const initial = await state(host);
  assert.equal(initial.fullscreen, false);
  assert.equal(initial.mode, 'windowed');
  assert.equal(initial.foregroundTest, foreground);
  assert.equal(initial.visible, foreground);
  assert.equal(initial.borderStyle, foreground ? 'Sizable' : 'None');
  assert.equal(initial.showInTaskbar, foreground);
  evidence.initialWindow = initial;
  assert.equal(
    (await host.evaluate(() => window.tablemaxWindow.setFullscreen(true)))
      .fullscreen,
    true,
  );
  const full = await state(host);
  assert.equal(full.fullscreen, true);
  assert.equal(full.mode, 'fullscreen');
  assert.equal(full.borderStyle, 'None');
  evidence.fullscreenWindow = full;
  if (foreground) {
    const runtime = await desktop.request('runtime');
    assert.equal(
      runtime.displays.some(
        (screen) =>
          JSON.stringify(screen.bounds) === JSON.stringify(full.bounds),
      ),
      true,
      'Foreground fullscreen must cover the actual monitor bounds',
    );
  }
  assert.notDeepEqual(full.bounds, initial.bounds);
  await host.evaluate(() => window.tablemaxWindow.setFullscreen(true));
  assert.deepEqual((await state(host)).bounds, full.bounds);
  await host.evaluate(() => window.tablemaxWindow.setFullscreen(false));
  assert.deepEqual((await state(host)).bounds, initial.bounds);
  assert.equal((await state(host)).borderStyle, initial.borderStyle);
  assert.deepEqual(await host.evaluate(() => window.fullscreenSnapshots), [
    'fullscreen',
    'windowed',
  ]);
  evidence.checks.push(
    'Legacy fullscreen remains idempotent; native bounds change and return exactly; subscribers receive actual mode transitions',
  );

  const boxVideo = await openVideo(host);
  assert.equal(await boxVideo.select.inputValue(), 'windowed');
  const borderless = await selectMode(host, boxVideo.select, 'borderless');
  assert.deepEqual(borderless.bounds, initial.bounds);
  const notificationCount = await host.evaluate(
    () => window.fullscreenSnapshots.length,
  );
  await setMode(host, 'borderless');
  assert.equal(
    await host.evaluate(() => window.fullscreenSnapshots.length),
    notificationCount,
  );
  assert.deepEqual((await state(host)).bounds, borderless.bounds);
  await captureBrowserScreenshot(host, {
    path: join(output, 'box-video-borderless.png'),
  });
  await closeVideo(boxVideo.dialog);
  await host.keyboard.press('F11');
  await until(host, 'windowed');
  await host.keyboard.press('F11');
  await until(host, 'fullscreen');
  await host.keyboard.press('F11');
  await until(host, 'windowed');
  assert.deepEqual((await state(host)).bounds, borderless.bounds);
  await desktop.request('window', {
    id: initial.id,
    operation: 'menu-fullscreen',
  });
  await until(host, 'fullscreen');
  const fullVideo = await openVideo(host);
  assert.equal(await fullVideo.select.inputValue(), 'fullscreen');
  await host.keyboard.press('Escape');
  await fullVideo.dialog.waitFor({ state: 'detached' });
  await until(host, 'fullscreen');
  await host.keyboard.press('Escape');
  await until(host, 'windowed');
  assert.deepEqual((await state(host)).bounds, borderless.bounds);
  const restoredVideo = await openVideo(host);
  await selectMode(host, restoredVideo.select, 'windowed');
  assert.deepEqual((await state(host)).bounds, initial.bounds);
  await closeVideo(restoredVideo.dialog);
  evidence.checks.push(
    'Box video settings expose all three modes; F11 and native menu return borderless/fullscreen to windowed; Escape closes video before returning from fullscreen',
  );

  if (!foreground) {
    await assert.rejects(desktop.request('open-public'), /Unknown test method/);
    await desktop.request('show-host');
    assert.equal(
      (await desktop.request('windows')).filter((window) => window.managed)
        .length,
      1,
    );
    evidence.checks.push(
      'The host is the only managed display window; retired public-window requests are rejected',
    );
  }

  await desktop.request('window', {
    id: initial.id,
    operation: 'window-state',
    value: 'Maximized',
  });
  const maximized = await state(host);
  assert.equal(maximized.windowState, 'Maximized');
  await host.keyboard.press('F11');
  await until(host, 'fullscreen');
  await host.keyboard.press('F11');
  await until(host, 'windowed');
  const restored = await state(host);
  assert.equal(restored.windowState, 'Maximized');
  assert.deepEqual(restored.restoreBounds, maximized.restoreBounds);
  await desktop.request('window', {
    id: initial.id,
    operation: 'window-state',
    value: 'Normal',
  });
  await captureBrowserScreenshot(host, {
    path: join(output, 'restored-host.png'),
  });
  evidence.checks.push(
    'F11 fullscreen exit restores windowed maximized state and original restore geometry',
  );
  // Legal rules-generated fixture supplies an actual saved Modern Art game.
  const origin = new URL(host.url()).origin;
  await host.goto(origin + '/host/game');
  await host.getByRole('button', { name: '菜单', exact: true }).waitFor();
  assert.equal(
    await host
      .getByRole('button', { name: /^(全屏|退出全屏)$/, exact: true })
      .count(),
    0,
  );
  const beforeGame = await state(host);
  const gameVideo = await openVideo(host);
  await selectMode(host, gameVideo.select, 'borderless');
  const beforeGameFullscreen = await state(host);
  await selectMode(host, gameVideo.select, 'fullscreen');
  assert.notDeepEqual((await state(host)).bounds, beforeGameFullscreen.bounds);
  assert.equal(
    await host.evaluate(() => Boolean(document.fullscreenElement)),
    false,
  );
  await captureBrowserScreenshot(host, {
    path: join(output, 'actual-game-video-fullscreen.png'),
  });
  await host.keyboard.press('F11');
  await until(host, 'windowed');
  await host.waitForFunction(
    () => document.querySelector('#window-mode')?.value === 'windowed',
  );
  assert.equal(await gameVideo.select.inputValue(), 'windowed');
  assert.deepEqual((await state(host)).bounds, beforeGameFullscreen.bounds);
  await host.keyboard.press('F11');
  await until(host, 'fullscreen');
  await host.waitForFunction(
    () => document.querySelector('#window-mode')?.value === 'fullscreen',
  );
  await closeVideo(gameVideo.dialog);
  const menu = host.getByRole('dialog', { name: /菜单$/ });
  await menu.getByRole('button', { name: '关闭面板', exact: true }).click();
  await menu.waitFor({ state: 'detached' });
  await host.keyboard.press('Escape');
  await until(host, 'windowed');
  assert.deepEqual((await state(host)).bounds, beforeGameFullscreen.bounds);
  const finalVideo = await openVideo(host);
  await selectMode(host, finalVideo.select, 'windowed');
  assert.deepEqual((await state(host)).bounds, beforeGame.bounds);
  await captureBrowserScreenshot(host, {
    path: join(output, 'actual-game-video-windowed.png'),
  });
  await closeVideo(finalVideo.dialog);
  evidence.checks.push(
    'Actual saved Modern Art moves fullscreen into video settings; all three select modes change native bounds without DOM fullscreen; F11 exits to windowed and updates the open select',
  );
  assert.deepEqual(evidence.errors, []);
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = error.stack;
  throw error;
} finally {
  try {
    await desktop?.close();
  } catch (error) {
    evidence.result = 'failed';
    evidence.cleanupError = String(error);
    process.exitCode = 1;
  }
  evidence.finishedAt = new Date().toISOString();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: evidence.result,
      checks: evidence.checks,
      output,
    }),
  );
}
