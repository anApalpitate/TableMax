import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';

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
reply({ fullscreen: false });
assert.equal((await read).fullscreen, false);
const set = fakeWindow.tablemaxWindow.setFullscreen(true);
assert.deepEqual(Array.from(calls.at(-1).params), [true]);
reply({ fullscreen: true });
assert.equal((await set).fullscreen, true);
let seen;
const unsubscribe = fakeWindow.tablemaxWindow.subscribe((value) => {
  seen = value;
});
handlers.get('message')({
  data: { type: 'changed', channel: 'window', value: { fullscreen: false } },
});
assert.equal(seen.fullscreen, false);
unsubscribe();
handlers.get('message')({
  data: { type: 'changed', channel: 'window', value: { fullscreen: true } },
});
assert.equal(seen.fullscreen, false);
const child = { top: fakeWindow };
vm.runInNewContext(bridgeSource, { window: child });
assert.equal(child.tablemaxWindow, undefined);
console.log(
  'Window bridge VM: read, set, notification, unsubscribe and frame exclusion passed',
);
if (process.argv.includes('--bridge-only')) process.exit(0);

const run =
  process.argv.find((value) => value.startsWith('--run='))?.slice(6) ??
  `fullscreen-${Date.now()}`;
assert.match(run, /^[a-z0-9-]+$/i);
const output = resolve(
  'artifacts/maintenance/v1.0.2/modern-art-polish-20261005',
  run,
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/desktop-fullscreen-'));
await build({
  entryPoints: ['scripts/fixtures/prepare-rules-guides.ts'],
  outfile: join(work, 'prepare.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
});
const { prepare } = createRequire(import.meta.url)(join(work, 'prepare.cjs'));
const fixture = await prepare(work, 5);
const dataDir = fixture.cases.find((entry) => entry.id === 'offer').dataDir;
const executablePath =
  process.argv.find((value) => value.startsWith('--executable='))?.slice(13) ??
  desktopExecutable;
const foreground = process.argv.includes('--foreground');
const evidence = {
  result: 'started',
  executablePath,
  dataDir,
  checks: [],
  foreground,
  scope: foreground
    ? 'Actual normally framed foreground test window, nonactivating, briefly visible on the current monitor; actual native bounds/style restore, React button, keys and menu. Hardware DPI and multi-monitor require separate acceptance.'
    : 'Actual hidden WebView2 native window checks; foreground, hardware DPI and multi-monitor behavior require separate acceptance.',
};
let desktop;
try {
  desktop = await launchDesktop({
    executablePath,
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
  await host.locator('.connection.online').waitFor();
  const state = async (page) => {
    const id = await page.evaluate(() => window.__tablemaxWindowId);
    return (await desktop.request('windows')).find((entry) => entry.id === id);
  };
  const until = async (page, value) => {
    await page.waitForFunction(
      (expected) =>
        window.tablemaxWindow.read().then((s) => s.fullscreen === expected),
      value,
    );
    assert.equal((await state(page)).fullscreen, value);
  };
  await host.evaluate(() => {
    window.fullscreenSnapshots = [];
    window.tablemaxWindow.subscribe((s) =>
      window.fullscreenSnapshots.push(s.fullscreen),
    );
  });
  const initial = await state(host);
  assert.equal(initial.fullscreen, false);
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
    true,
    false,
  ]);
  evidence.checks.push(
    'Set is idempotent; native bounds change and return exactly; subscribers receive real transitions',
  );

  await host.keyboard.press('F11');
  await until(host, true);
  await host.keyboard.press('F11');
  await until(host, false);
  await desktop.request('window', {
    id: initial.id,
    operation: 'menu-fullscreen',
  });
  await until(host, true);
  await host
    .getByRole('button', { name: /^(?:视频|显示)设置$/, exact: true })
    .click();
  await host.keyboard.press('Escape');
  await host.locator('dialog[open]').waitFor({ state: 'hidden' });
  await until(host, true);
  await host.keyboard.press('Escape');
  await until(host, false);
  evidence.checks.push(
    'Trusted F11 and native menu synchronize state; Escape closes dialog before exiting fullscreen',
  );

  if (!foreground) {
    const next = desktop.waitForEvent('window');
    await desktop.request('open-public');
    const publicPage = await next;
    await publicPage.locator('.connection.online').waitFor();
    await publicPage.evaluate(() => window.tablemaxWindow.setFullscreen(true));
    assert.equal((await state(host)).fullscreen, false);
    await host.evaluate(() => window.tablemaxWindow.setFullscreen(true));
    await publicPage.evaluate(() => window.tablemaxWindow.setFullscreen(false));
    assert.equal((await state(host)).fullscreen, true);
    await host.evaluate(() => window.tablemaxWindow.setFullscreen(false));
    evidence.checks.push(
      'Host and public native window fullscreen states are independent',
    );
  }

  await desktop.request('window', {
    id: initial.id,
    operation: 'window-state',
    value: 'Maximized',
  });
  const maximized = await state(host);
  assert.equal(maximized.windowState, 'Maximized');
  await host.evaluate(() => window.tablemaxWindow.setFullscreen(true));
  await host.evaluate(() => window.tablemaxWindow.setFullscreen(false));
  const restored = await state(host);
  assert.equal(restored.windowState, 'Maximized');
  assert.deepEqual(restored.restoreBounds, maximized.restoreBounds);
  await desktop.request('window', {
    id: initial.id,
    operation: 'window-state',
    value: 'Normal',
  });
  await host.screenshot({ path: join(output, 'restored-host.png') });
  evidence.checks.push(
    'Fullscreen exit restores original maximized state and restore geometry',
  );
  // Legal rules-generated fixture supplies an actual saved Modern Art game.
  const origin = new URL(host.url()).origin;
  await host.goto(origin + '/host/game');
  const fullscreenButton = host.getByRole('button', {
    name: '全屏',
    exact: true,
  });
  await fullscreenButton.waitFor();
  const beforeButton = await state(host);
  await fullscreenButton.click();
  await until(host, true);
  await host.getByRole('button', { name: '退出全屏', exact: true }).waitFor();
  assert.notDeepEqual((await state(host)).bounds, beforeButton.bounds);
  assert.equal(
    await host.evaluate(() => Boolean(document.fullscreenElement)),
    false,
  );
  await host.screenshot({
    path: join(output, 'actual-game-button-fullscreen.png'),
  });
  await host.keyboard.press('F11');
  await until(host, false);
  await fullscreenButton.waitFor();
  assert.deepEqual((await state(host)).bounds, beforeButton.bounds);
  await fullscreenButton.click();
  await until(host, true);
  await host.getByRole('button', { name: '退出全屏', exact: true }).click();
  await until(host, false);
  await fullscreenButton.waitFor();
  evidence.checks.push(
    'Actual Modern Art React button changes native bounds; F11 synchronizes its label; exit restores bounds without DOM fullscreen',
  );
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = error.stack;
  throw error;
} finally {
  await desktop?.close().catch(() => undefined);
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
