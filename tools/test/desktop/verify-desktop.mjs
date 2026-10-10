import { saveVerificationScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { launchDesktop, desktopExecutable } from '../support/desktop-test.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const portable = process.argv.includes('--portable');
let executablePath = portable ? '' : desktopExecutable;
const output = resolve('artifacts/phase-03-04/verification');
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
let archive;
let archiveSha256;
if (portable) {
  const project = JSON.parse(await readFile('package.json', 'utf8'));
  archive = resolve(
    `artifacts/phase-01/TableMax-${project.version}-win-x64.zip`,
  );
  const extracted = await mkdtemp(resolve('tmp/portable-extracted-'));
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
    },
  );
  archiveSha256 = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  executablePath = join(extracted, 'TableMax.exe');
  console.log('Extracted portable ZIP for verification.');
}
const dataDir = await mkdtemp(resolve('tmp/desktop-verify-'));
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
const args = ['--foundation-test'];
const evidence = {
  portable,
  executablePath,
  archive,
  archiveSha256,
  dataDir,
  runs: [],
};
let priorSecret;

async function capture(desktop, page, file, size) {
  await page.evaluate(() => {
    document.activeElement?.blur();
    scrollTo(0, 0);
  });
  await page.evaluate(
    () =>
      new Promise((fulfill) =>
        requestAnimationFrame(() => requestAnimationFrame(fulfill)),
      ),
  );
  const window = await desktop.browserWindow(page);
  if (size) {
    await window.evaluate(
      (window, size) => window.setContentSize(size.width, size.height),
      size,
    );
    await page.waitForFunction((size) => innerWidth === size.width, size);
  }
  const png = await window.evaluate(async (window) => {
    const image = await window.webContents.capturePage(undefined, {
      stayHidden: true,
      stayAwake: true,
    });
    return image.toPNG().toString('base64');
  });
  assert.ok(png.length > 1000, 'Screenshot must contain a rendered image');
  await saveVerificationScreenshot(file, Buffer.from(png, 'base64'));
}

for (let run = 0; run < 2; run++) {
  const desktop = await launchDesktop({
    executablePath,
    args,
    env,
    timeout: 30_000,
  });
  let origin;
  try {
    const page = await desktop.firstWindow();
    await page.waitForURL('**/host');
    await page.locator('.connection.online').waitFor();
    origin = new URL(page.url()).origin;
    // Real desktop restarts reuse the configured port; browser identities are
    // scoped to the origin. Reuse the first allocated port for the second run.
    env.TABLEMAX_PORT = new URL(origin).port;
    const health = await (
      await fetch(`${origin}/api/foundation/health`)
    ).json();
    assert.equal(health.starts, run + 1, 'SQLite must survive desktop restart');
    assert.equal(health.database, 'ok');
    assert.equal(
      health.runtime.node,
      '22.14.0',
      'Service must use the bundled official Node runtime',
    );
    const runtime = await desktop.evaluate(({ app }) => ({
      packaged: app.isPackaged,
      metrics: app.getAppMetrics(),
      versions: process.versions,
    }));
    assert.equal(runtime.packaged, portable);
    const utility = runtime.metrics.find(
      (entry) =>
        entry.type === 'Utility' && entry.name === 'TableMax local service',
    );
    assert.ok(utility, 'Service must have a separate utility process');

    await page.getByRole('heading', { name: '房主管理' }).waitFor();
    assert.equal(
      new URL(page.url()).hash,
      '',
      'Host token must be removed from visible URL',
    );
    const client = io(origin, { transports: ['websocket'], forceNew: true });
    try {
      const rejected = await new Promise((fulfill, reject) =>
        client
          .timeout(5000)
          .emit(
            'foundation:echo',
            { text: 'ok', unexpected: true },
            (error, reply) => (error ? reject(error) : fulfill(reply)),
          ),
      );
      assert.deepEqual(rejected, { ok: false, reason: 'invalid-message' });
    } finally {
      client.disconnect();
    }

    if (run === 0) {
      await capture(
        desktop,
        page,
        join(output, portable ? 'portable-host.png' : 'host.png'),
      );
      const nextWindow = desktop.waitForEvent('window');
      await page
        .getByRole('link', { name: '打开公共屏' })
        .click({ noWaitAfter: true });
      const publicPage = await nextWindow;
      await publicPage
        .getByRole('heading', { name: '今晚，一起玩。' })
        .waitFor();
      assert.equal(
        await publicPage.getByRole('heading', { name: '房主管理' }).count(),
        0,
      );
      assert.equal(new URL(publicPage.url()).pathname, '/public');
      await capture(
        desktop,
        publicPage,
        join(output, portable ? 'portable-public.png' : 'public.png'),
        { width: 1920, height: 1080 },
      );
      await publicPage.close();
      // WebView2's prevented navigation can leave Playwright waiting on that
      // navigation; reload the host route before continuing real interactions.
      await page.goto(`${origin}/host`);
      await page.getByRole('heading', { name: '房主管理' }).waitFor();
      assert.equal(
        (await fetch(`${origin}/api/foundation/health`)).status,
        200,
        'Closing public screen must not stop service',
      );
      const phoneWindow = desktop.waitForEvent('window');
      await desktop.evaluate(({ BrowserWindow }, url) => {
        const phone = new BrowserWindow({
          show: false,
          width: 390,
          height: 844,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
          },
        });
        void phone.loadURL(url);
      }, `${origin}/player`);
      const phone = await phoneWindow;
      await phone.getByRole('heading', { name: '欢迎来到桌边。' }).waitFor();
      await phone.locator('.connection.online').waitFor();
      await phone.getByLabel('你的昵称').fill('桌面验证玩家');
      await phone.getByRole('button', { name: '加入', exact: true }).click();
      await phone.getByRole('button', { name: '我准备好了' }).waitFor();
      await page.getByRole('button', { name: '添加电脑', exact: true }).click();
      await page.getByText('电脑 1', { exact: true }).waitFor();
      await phone.getByRole('button', { name: '我准备好了' }).click();
      await phone.getByRole('button', { name: '取消准备' }).waitFor();
      await page.getByRole('button', { name: '开始游戏', exact: true }).click();
      await phone
        .getByRole('button', { name: '选择 +1', exact: true })
        .waitFor();
      priorSecret = await phone.locator('.secret').textContent();
      assert.equal(
        await page.locator('.secret').count(),
        0,
        'Host must not display private dice',
      );
      await capture(
        desktop,
        phone,
        join(output, portable ? 'portable-player.png' : 'player.png'),
        { width: 390, height: 844 },
      );
      assert.equal(
        await phone.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        'Phone page must not overflow horizontally',
      );
      const resources = await phone.evaluate(() =>
        performance.getEntriesByType('resource').map((entry) => entry.name),
      );
      assert.ok(
        resources.every((url) => new URL(url).origin === origin),
        'Runtime resources must load locally',
      );
      await phone.getByRole('button', { name: '选择 +1', exact: true }).click();
      await page.getByRole('button', { name: '创建新房间' }).waitFor();
      assert.equal(
        (await page.locator('.seat').filter({ hasText: '获胜' }).count()) > 0,
        true,
      );
      await page.getByText('决策点回退（2）', { exact: true }).click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: '座位 1 选择之前' }).click();
      await page
        .getByRole('button', { name: '恢复游戏', exact: true })
        .waitFor();
      await capture(
        desktop,
        page,
        join(output, portable ? 'portable-rollback.png' : 'rollback.png'),
      );
      assert.equal(await phone.locator('.secret').textContent(), priorSecret);
      await phone.close();
      const addresses = await (
        await fetch(`${origin}/api/foundation/addresses`)
      ).json();
      if (addresses.addresses.length) {
        const qr = await fetch(
          `${origin}/api/foundation/qr?address=${encodeURIComponent(addresses.addresses[0])}`,
        );
        assert.equal(qr.status, 200);
        assert.match(await qr.text(), /<svg/);
      }
    } else {
      await page
        .getByText('已读取存档，等待房主恢复和玩家重连。', { exact: true })
        .waitFor();
      const phoneWindow = desktop.waitForEvent('window');
      await desktop.evaluate(({ BrowserWindow }, url) => {
        const phone = new BrowserWindow({
          show: false,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
          },
        });
        void phone.loadURL(url);
      }, `${origin}/player`);
      const phone = await phoneWindow;
      await phone.locator('.secret').waitFor();
      assert.equal(
        await phone.locator('.secret').textContent(),
        priorSecret,
        'Restore same authorized secret and seat',
      );
      await page.getByRole('button', { name: '恢复游戏', exact: true }).click();
      await phone.getByRole('button', { name: '选择 +2', exact: true }).click();
      await page.getByRole('button', { name: '创建新房间' }).waitFor();
      await capture(
        desktop,
        page,
        join(output, portable ? 'portable-result.png' : 'result.png'),
      );
      await phone.close();
    }
    evidence.runs.push({
      health,
      runtime: {
        packaged: runtime.packaged,
        node: runtime.versions.node,
        webview2: runtime.versions.webview2,
      },
      servicePid: utility.pid,
    });
  } finally {
    await desktop.close();
  }
  // Desktop close must stop the owned service, not leave it listening.
  if (origin) {
    let listening = true;
    for (let retry = 0; retry < 20 && listening; retry++) {
      try {
        await fetch(`${origin}/api/foundation/health`, {
          signal: AbortSignal.timeout(500),
        });
      } catch {
        listening = false;
      }
      if (listening) await new Promise((fulfill) => setTimeout(fulfill, 100));
    }
    assert.equal(listening, false, 'Service must stop with desktop');
  }
}
const log = await readFile(join(dataDir, 'logs/service.log'), 'utf8');
assert.equal(
  log.match(/service-stopped/g)?.length,
  2,
  'Both runs must shut down gracefully',
);
await writeFile(
  join(output, portable ? 'portable.json' : 'development.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    { result: 'passed', portable, runs: evidence.runs.length, output },
    null,
    2,
  ),
);
