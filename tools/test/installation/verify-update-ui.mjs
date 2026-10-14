import assert from 'node:assert/strict';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { launchDesktop } from '../support/desktop-test.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { saveVerificationScreenshot } from '../support/screenshots.mjs';
import { digest, localFile } from '../runner/evidence.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
const option = (name) =>
  process.argv
    .find((arg) => arg.startsWith('--' + name + '='))
    ?.slice(name.length + 3);
const installRoot = resolve(option('root') ?? '');
const permissionOnly = option('only') === 'permissions';
const layoutOnly = option('only') === 'layout';
const browserChannel = option('browser-channel');
assert.ok(
  !browserChannel || browserChannel === 'msedge',
  'Unknown browser channel',
);
assert.ok(
  !option('only') || permissionOnly || layoutOnly,
  'Unknown check selector',
);
const relativeRoot = relative(resolve('tmp'), installRoot);
assert.ok(
  relativeRoot &&
    !relativeRoot.startsWith('..') &&
    !relativeRoot.includes('..' + sep),
  'Use an isolated workspace installation',
);
const identityBytes = await readFile(
  localFile(installRoot, 'TableMax/.install.json'),
);
const identity = JSON.parse(identityBytes);
assert.ok(
  [
    '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}',
    '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}',
  ].includes(identity.productId),
);
assert.equal(resolve(identity.root), installRoot);
assert.equal(resolve(identity.boxRoot), join(installRoot, 'TableMax'));
assert.equal(
  JSON.parse(
    await readFile(
      localFile(installRoot, 'TableMax/TableMax.config.json'),
      'utf8',
    ),
  ).dataDirectory,
  '.',
  'Use the isolated default-data installation',
);
assert.ok(!(await lstat(installRoot)).isSymbolicLink());
const environment = { ...process.env };
for (const key of Object.keys(environment))
  if (
    key.startsWith('TABLEMAX_') ||
    key.startsWith('WEBVIEW2_') ||
    ['NODE_OPTIONS', 'NODE_PATH'].includes(key)
  )
    environment[key] = undefined;
Object.assign(environment, {
  TABLEMAX_DATA_DIR: identity.boxRoot,
  TABLEMAX_BOX_DIRECTORY: identity.boxRoot,
  TABLEMAX_HOST: '127.0.0.1',
  TABLEMAX_PORT: '0',
  TABLEMAX_AUTO_MAINTENANCE: '0',
  TABLEMAX_TEST_MAINTENANCE: '0',
});
const output = resolve(
  process.env.TABLEMAX_TEST_OUTPUT_DIR ??
    'artifacts/maintenance/v1.0.6/installation-remaining/update-ui-' +
      Date.now(),
);
await mkdir(output, { recursive: true });
const checks = [];
let desktop;
let browser;
let failure;
const record = (name, detail = {}) =>
  checks.push({ name, result: 'passed', ...detail });
try {
  validation: {
    desktop = await launchDesktop({
      executablePath: join(installRoot, 'TableMax/app/TableMax.exe'),
      timeout: 45000,
      env: environment,
    });
    const host = await desktop.firstWindow();
    if (!permissionOnly) {
      await host.getByRole('button', { name: '程序更新', exact: true }).click();
      const dialog = host.getByRole('dialog', { name: '程序更新' });
      await dialog.waitFor();
      await host.waitForFunction(() => window.tablemaxUpdate !== undefined);
      const initial = await host.evaluate(() => window.tablemaxUpdate.read());
      assert.equal(initial.currentVersion, identity.buildVersion);
      record('installed-host-reads-current-identity');
      const nativeWindow = await desktop.browserWindow(host);
      await nativeWindow.evaluate((window) => window.setContentSize(960, 540));
      const layout = await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: innerWidth,
          height: innerHeight,
          textSizes: Array.from(element.querySelectorAll('p, button, a')).map(
            (node) => parseFloat(getComputedStyle(node).fontSize),
          ),
        };
      });
      assert.ok(
        layout.left >= 0 &&
          layout.right <= layout.width &&
          layout.top >= 0 &&
          layout.bottom <= layout.height,
      );
      assert.ok(layout.textSizes.every((size) => size >= 16));
      const captured = await nativeWindow.evaluate(async (window) =>
        (await window.webContents.capturePage()).toPNG().toString('base64'),
      );
      await saveVerificationScreenshot(
        join(output, 'installed-host-update.png'),
        Buffer.from(captured, 'base64'),
      );
      record('short-screen-readable-dialog', layout);
      if (layoutOnly) break validation;
      await host.evaluate(() => window.tablemaxUpdate.check());
      const checked = await host.evaluate(
        () =>
          new Promise((done, reject) => {
            let unsubscribe = () => {};
            const timer = setTimeout(() => {
              unsubscribe();
              reject(
                new Error(
                  'Actual GitHub update check exceeded its bounded budget',
                ),
              );
            }, 75000);
            const completed = (value) => {
              if (value.phase === 'checking') return;
              clearTimeout(timer);
              unsubscribe();
              done(value);
            };
            unsubscribe = window.tablemaxUpdate.subscribe(completed);
            window.tablemaxUpdate.read().then(completed, (error) => {
              clearTimeout(timer);
              unsubscribe();
              reject(error);
            });
          }),
      );
      assert.ok(
        ['idle', 'available', 'unsupported', 'error'].includes(checked.phase),
      );
      record('actual-github-check-without-automatic-download', {
        phase: checked.phase,
        targetVersion: checked.targetVersion ?? null,
      });
      assert.equal(
        await dialog
          .getByRole('link', { name: '打开发布页' })
          .getAttribute('href'),
        'https://github.com/anApalpitate/TableMax/releases',
      );
    }
    await host.reload();
    await host.getByRole('button', { name: '程序更新', exact: true }).waitFor();
    const childReply = await host.evaluate(async () => {
      const frame = document.createElement('iframe');
      frame.hidden = true;
      frame.src = 'about:blank';
      const loaded = new Promise((done) =>
        frame.addEventListener('load', done, { once: true }),
      );
      document.body.append(frame);
      await loaded;
      if (!frame.contentWindow.chrome?.webview) {
        frame.remove();
        return 'native-api-unavailable';
      }
      const reply = await new Promise((done) => {
        const id = 901233;
        const handler = ({ data }) => {
          if (data.id === id) {
            window.chrome.webview.removeEventListener('message', handler);
            done(data.error ? 'rejected' : 'accepted');
          }
        };
        window.chrome.webview.addEventListener('message', handler);
        setTimeout(() => {
          window.chrome.webview.removeEventListener('message', handler);
          done('no-native-reply');
        }, 1500);
        frame.contentWindow.chrome.webview.postMessage({
          id,
          method: 'update.read',
          params: [],
        });
      });
      frame.remove();
      return reply;
    });
    assert.notEqual(childReply, 'accepted');
    record('child-frame-direct-message-has-no-native-update-capability', {
      reply: childReply,
    });
    const origin = new URL(host.url()).origin;
    browser = await launchTestBrowser(
      browserChannel ? { channel: browserChannel } : {},
    );
    const remote = await browser.newPage();
    await remote.goto(origin + '/host');
    assert.equal(
      await remote.evaluate(() => typeof window.tablemaxUpdate),
      'undefined',
    );
    assert.equal(
      await remote
        .getByRole('button', { name: '程序更新', exact: true })
        .count(),
      0,
    );
    record('ordinary-browser-has-no-update-capability');
    const publicCreated = desktop.waitForEvent('window');
    await desktop.request('open-public');
    const publicPage = await publicCreated;
    await publicPage.waitForLoadState();
    assert.equal(
      await publicPage.evaluate(() => typeof window.tablemaxUpdate),
      'undefined',
    );
    const rejected = await publicPage.evaluate(
      () =>
        new Promise((done, reject) => {
          const id = 901234;
          const timer = setTimeout(
            () => reject(new Error('Public update rejection timed out')),
            5000,
          );
          const handler = ({ data }) => {
            if (data.id !== id) return;
            clearTimeout(timer);
            window.chrome.webview.removeEventListener('message', handler);
            done(typeof data.error === 'string');
          };
          window.chrome.webview.addEventListener('message', handler);
          window.chrome.webview.postMessage({
            id,
            method: 'update.read',
            params: [],
          });
        }),
    );
    assert.equal(rejected, true);
    record('public-native-window-cannot-call-update');
    assert.equal(
      digest(await readFile(join(installRoot, 'TableMax/.install.json'))),
      digest(identityBytes),
    );
  }
} catch (cause) {
  failure = cause.message;
} finally {
  await browser?.close().catch(() => {});
  await desktop?.close().catch((cause) => {
    failure ??= cause.message;
  });
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(
      {
        result: failure ? 'failed' : 'passed',
        failure,
        checks,
        installRoot,
        productId: identity.productId,
        buildVersion: identity.buildVersion,
        installationIdentitySha256: digest(identityBytes),
        nativeSha256: digest(
          await readFile(localFile(installRoot, 'TableMax/app/TableMax.exe')),
        ),
        browserChannel: browserChannel ?? 'bundled-chromium',
        sourceSha256: digest(
          await readFile('tools/test/installation/verify-update-ui.mjs'),
        ),
        limits: [
          'No future release is published by this check',
          'No trusted future installer is available on GitHub yet; positive download/apply use separate controller and installer evidence',
          'Installer/upgrade/uninstall have separate evidence',
        ],
        cacheable: false,
      },
      null,
      2,
    ),
  );
}
console.log(
  JSON.stringify({
    result: failure ? 'failed' : 'passed',
    checks: checks.length,
    output,
    failure,
  }),
);
if (failure) process.exitCode = 1;
