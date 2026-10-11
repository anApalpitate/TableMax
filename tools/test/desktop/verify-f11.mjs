import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { launchDesktop } from '../support/desktop-test.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/native-f11-'));
const output = resolve('artifacts/results/native-f11', String(Date.now()));
await mkdir(output, { recursive: true });
const executablePath = resolve(
  process.argv.find((arg) => arg.startsWith('--executable='))?.slice(13) ??
    'build/desktop/TableMax.exe',
);
const evidence = {
  executablePath,
  executableSha256: createHash('sha256')
    .update(await readFile(executablePath))
    .digest('hex'),
  work,
  checks: [],
  errors: [],
  scope:
    'Actual hidden muted WebView2/WinForms windows on loopback; trusted WebView F11, native ProcessCmdKey test invocation and native menu handler. Not a foreground hardware keyboard, physical monitor or packaged-release acceptance.',
};
let desktop;
try {
  desktop = await launchDesktop({
    executablePath,
    soundEnabled: false,
    env: {
      TABLEMAX_DATA_DIR: join(work, 'data'),
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
    },
  });
  const host = await desktop.firstWindow();
  await host.locator('[data-room-revision]').waitFor();
  host.on('pageerror', (error) => evidence.errors.push(error.message));
  const id = await host.evaluate(() => window.__tablemaxWindowId);
  const state = async () =>
    (await desktop.request('windows')).find((window) => window.id === id);
  const until = async (mode) => {
    await host.waitForFunction(
      (expected) =>
        window.tablemaxWindow.read().then((value) => value.mode === expected),
      mode,
    );
    assert.equal((await state()).mode, mode);
  };
  for (const path of ['webview', 'key-f11', 'menu-fullscreen']) {
    for (const from of ['windowed', 'borderless', 'fullscreen']) {
      await host.evaluate(
        (mode) => window.tablemaxWindow.setMode(mode),
        'windowed',
      );
      await host.evaluate((mode) => window.tablemaxWindow.setMode(mode), from);
      const before = await state();
      if (path === 'webview') await host.keyboard.press('F11');
      else await desktop.request('window', { id, operation: path });
      const to = from === 'windowed' ? 'fullscreen' : 'windowed';
      await until(to);
      const after = await state();
      assert.equal(after.fullscreen, to === 'fullscreen');
      assert.equal(after.audioMuted, true);
      evidence.checks.push({
        path,
        from,
        to,
        before: before.bounds,
        after: after.bounds,
      });
    }
  }
  await host.evaluate(() => window.tablemaxWindow.setMode('borderless'));
  await host.evaluate(() => window.tablemaxWindow.setFullscreen(true));
  await host.evaluate(() => window.tablemaxWindow.setFullscreen(false));
  await until('borderless');
  await host.evaluate(() => window.tablemaxWindow.setFullscreen(true));
  await host.keyboard.press('Escape');
  await until('borderless');
  evidence.checks.push({
    path: 'explicit-fullscreen-and-escape',
    preservedReturnMode: 'borderless',
  });
  const next = desktop.waitForEvent('window');
  await desktop.request('open-public');
  const publicPage = await next;
  await publicPage.locator('[data-room-revision]').waitFor();
  await publicPage.evaluate(() => window.tablemaxWindow.setMode('borderless'));
  await publicPage.keyboard.press('F11');
  await publicPage.waitForFunction(() =>
    window.tablemaxWindow.read().then((value) => value.mode === 'windowed'),
  );
  assert.equal((await state()).mode, 'borderless');
  evidence.checks.push({
    path: 'public-webview',
    from: 'borderless',
    to: 'windowed',
    hostIndependent: true,
  });
  assert.deepEqual(evidence.errors, []);
  evidence.passed = true;
} catch (error) {
  evidence.passed = false;
  evidence.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await desktop?.close();
  evidence.allOwnedProcessesExited = true;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: evidence.passed,
      checks: evidence.checks.length,
      output,
    }),
  );
}
