import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { launchDesktop } from '../support/desktop-test.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { playerFrame, playerUi } from '../support/player-test.mjs';

const output = resolve('artifacts/maintenance/v1.0.5/speech-panel-20261009');
const archive = resolve('artifacts/releases/TableMax-1.0.5-win-x64.zip');
const manifest = JSON.parse(
  await readFile(archive.replace('.zip', '-manifest.json'), 'utf8'),
);
const catalog = JSON.parse(
  await readFile('packages/protocol/src/interaction-catalog.json', 'utf8'),
);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const report = {
  portable: true,
  result: 'running',
  archiveSha256: manifest.archive.sha256,
  layouts: [],
  sent: [],
  pageErrors: [],
  scope:
    'Muted real portable desktop and Edge player; speech panel layout, trusted wheel selection, six UI sends, Escape without trapped focus. No game actions or listening claim.',
};
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
let desktop, browser, observer;
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/root-entry-'));
report.work = work;
const extracted = join(work, 'extracted');
async function open(page) {
  const frame = await playerFrame(page);
  const orb = frame.locator('.interaction-orb');
  await orb.waitFor();
  // Resizing updates the iframe and the orb's 160ms position transition.
  await page.waitForTimeout(250);
  const bounds = await orb.boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  const wheel = frame.locator('.interaction-wheel');
  await wheel.waitFor();
  // The production wheel settles its position for 160ms before sliding selection.
  await page.waitForTimeout(200);
  const ring = await wheel.boundingBox();
  const angle = (210 * Math.PI) / 180;
  await page.mouse.move(
    ring.x + ring.width / 2 + Math.cos(angle) * 86,
    ring.y + ring.height / 2 + Math.sin(angle) * 86,
    { steps: 2 },
  );
  await page.mouse.up();
  const panel = frame.getByRole('dialog', { name: '发言', exact: true });
  await panel.waitFor();
  return { frame, panel, orb };
}
try {
  assert.equal(hash(await readFile(archive)), manifest.archive.sha256);
  await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:SPEECH_ARCHIVE -DestinationPath $env:SPEECH_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        SPEECH_ARCHIVE: archive,
        SPEECH_EXTRACT: extracted,
      },
    },
  );
  for (const file of manifest.files) {
    const path = resolve(extracted, file.path);
    assert.ok(path.startsWith(extracted + sep));
    const content = await readFile(path);
    assert.equal(content.length, file.bytes);
    assert.equal(hash(content), file.sha256);
  }
  desktop = await launchDesktop({
    executablePath: join(extracted, 'TableMax.exe'),
    soundEnabled: false,
    env: {
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_DATA_DIR: join(work, 'data'),
    },
  });
  const host = await desktop.firstWindow();
  await host.locator('[data-room-revision]').waitFor();
  const origin = new URL(host.url()).origin;
  assert.equal(new URL(origin).hostname, '127.0.0.1');
  observer = io(origin, { transports: ['websocket'], forceNew: true });
  await new Promise((done, reject) => {
    observer.once('connect', done);
    observer.once('connect_error', reject);
  });
  browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
    soundEnabled: false,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  await page.goto(origin);
  await playerUi(page).getByLabel('你的昵称', { exact: true }).fill('面板验证');
  await playerUi(page)
    .getByRole('button', { name: '加入', exact: true })
    .click();
  await playerUi(page)
    .getByRole('button', { name: '我准备好了', exact: true })
    .waitFor();
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 480, height: 640 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    const { frame, panel } = await open(page);
    const metrics = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const buttons = [...element.querySelectorAll('.interaction-phrase')];
      const heading = element.querySelector('.panel-heading');
      return {
        viewport: [innerWidth, innerHeight],
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        headingBackground: getComputedStyle(heading).backgroundColor,
        rows: buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return {
            text: button.textContent.trim(),
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            font: parseFloat(getComputedStyle(button).fontSize),
            visible: box.top >= rect.top && box.bottom <= rect.bottom,
            clipped: button.scrollWidth > button.clientWidth + 1,
          };
        }),
      };
    });
    report.layouts.push({ size, metrics });
    await page.screenshot({ path: join(output, `speech-${size.width}.png`) });
    assert.equal(metrics.rows.length, 6);
    assert.equal(metrics.overflow, false);
    assert.equal(metrics.headingBackground, 'rgba(0, 0, 0, 0)');
    assert.ok(metrics.rect.x >= 0 && metrics.rect.y >= 0);
    assert.ok(metrics.rect.y + metrics.rect.height <= metrics.viewport[1] + 1);
    for (const row of metrics.rows)
      assert.ok(
        row.visible && !row.clipped && row.height >= 48 && row.font >= 18,
        JSON.stringify(row),
      );
    for (const row of metrics.rows) assert.equal(row.x, metrics.rows[0].x);
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'detached' });
    assert.equal(
      await frame.evaluate(() =>
        Boolean(document.activeElement?.closest('dialog')),
      ),
      false,
    );
    assert.equal(await frame.locator('.interaction-wheel').count(), 0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const frame = await playerFrame(page);
  const token = await frame.evaluate(() =>
    localStorage.getItem('tablemax-player'),
  );
  const before = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  ).json();
  for (const phrase of catalog.phrases) {
    const { panel } = await open(page);
    const sent = new Promise((done, reject) => {
      const timer = setTimeout(() => {
        observer.off('room:interaction', receive);
        reject(new Error('No saved speech event'));
      }, 5000);
      const receive = (event) => {
        if (
          event.interaction.type === 'speech' &&
          event.interaction.phraseId === phrase.id
        ) {
          clearTimeout(timer);
          observer.off('room:interaction', receive);
          done(event);
        }
      };
      observer.on('room:interaction', receive);
    });
    await panel.locator(`[data-phrase="${phrase.id}"]`).click();
    await sent;
    await panel.waitFor({ state: 'detached' });
    report.sent.push(phrase.id);
    await page.waitForTimeout(400);
  }
  const after = await (
    await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  ).json();
  assert.equal(before.view.revision, after.view.revision);
  assert.deepEqual(report.pageErrors, []);
  for (const file of manifest.files)
    assert.equal(
      hash(await readFile(resolve(extracted, file.path))),
      file.sha256,
    );
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  observer?.disconnect();
  await browser?.close();
  await desktop?.close();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    `Speech panel: ${report.result}; ${report.layouts.length} layouts; ${report.sent.length} sends; ${output}`,
  );
  if (report.error) console.error(report.error);
}
