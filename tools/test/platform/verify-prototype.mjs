import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { launchDesktop, desktopExecutable } from '../support/desktop-test.mjs';
import { preview } from 'vite';
import { mkdir, mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const output = resolve('artifacts/phase-02/verification');
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/prototype-verify-'));
const server = await preview({
  configFile: resolve('apps/web/vite.prototype.config.ts'),
  preview: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
});
const address = server.httpServer.address();
assert.ok(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
const env = {
  ...process.env,
  TABLEMAX_DATA_DIR: join(work, 'data'),
  TABLEMAX_PROTOTYPE_URL: `${origin}/prototype.html`,
};
delete env.NODE_PATH;
let desktop;
const evidence = {
  date: new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()),
  verifiedAt: new Date().toISOString(),
  scope: 'Synthetic UI prototype only; no product AC or game rules verified',
  checks: [],
  screenshots: [],
  externalRequests: [],
  consoleErrors: [],
};
try {
  const files = await readdir(resolve('artifacts/phase-02/prototype'));
  assert.ok(files.includes('prototype.html'));
  assert.ok(
    !files.includes('index.html'),
    'Prototype output must not include the production entry',
  );
  assert.equal((await fetch(`${origin}/api/foundation/health`)).status, 404);
  evidence.checks.push('Independent build and preview, no production API');
  desktop = await launchDesktop({
    executablePath: desktopExecutable,
    args: ['--foundation-test'],
    env,
    timeout: 30_000,
  });
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(10_000);
  // Reload after installing observation to include all document/assets requests.
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin)
      evidence.externalRequests.push(request.url());
  });
  page.on('pageerror', (error) => evidence.consoleErrors.push(error.message));
  await page.reload();
  await page.getByRole('heading', { name: '今晚，玩一局。' }).waitFor();
  const review = page.locator('.review-drawer');
  assert.equal(
    await review.getAttribute('open'),
    null,
    'Review tools closed by default',
  );
  async function setReview(open) {
    if (((await review.getAttribute('open')) !== null) !== open)
      await review.locator(':scope > summary').click();
  }
  function reviewSelect(label) {
    return {
      async selectOption(value) {
        await setReview(true);
        await page.getByLabel(label, { exact: true }).selectOption(value);
        await setReview(false);
      },
    };
  }
  const role = reviewSelect('角色');
  const screen = reviewSelect('页面');
  async function simulate(name) {
    await setReview(true);
    await page.getByRole('button', { name, exact: true }).click();
    await setReview(false);
  }
  const window = await desktop.browserWindow(page);
  async function resize(width, height) {
    await window.evaluate(
      (window, size) => window.setContentSize(size.width, size.height),
      { width, height },
    );
    await page.waitForFunction(
      (size) => innerWidth === size.width && innerHeight === size.height,
      { width, height },
    );
    await page.evaluate(
      () =>
        new Promise((fulfill) =>
          requestAnimationFrame(() => requestAnimationFrame(fulfill)),
        ),
    );
  }
  async function capture(name, width, height) {
    await setReview(false);
    await resize(width, height);
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
    assert.ok(png.length > 1000);
    await writeFile(join(output, `${name}.png`), Buffer.from(png, 'base64'));
    evidence.screenshots.push({
      file: `${name}.png`,
      width,
      height,
      deviceScaleFactor: await page.evaluate(() => devicePixelRatio),
    });
  }
  await capture('host-setup', 1280, 900);
  console.log('Prototype: setup captured');
  await screen.selectOption('lobby');
  await page
    .getByRole('button', { name: '关闭新玩家加入', exact: true })
    .click();
  await role.selectOption('player');
  await page.getByLabel('昵称', { exact: true }).fill('小林');
  assert.equal(
    await page
      .getByRole('button', { name: '取得座位（模拟）', exact: true })
      .isEnabled(),
    false,
  );
  await role.selectOption('host');
  const avatarBeforeMove = await page
    .locator('[data-seat="S2"] img')
    .getAttribute('src');
  await page.getByRole('button', { name: '重新开放加入' }).click();
  await page.getByRole('button', { name: '上移座位 S2' }).click();
  assert.ok(
    (await page.locator('.seat-list li').first().textContent()).includes('S2'),
  );
  assert.equal(
    await page.locator('[data-seat="S2"] img').getAttribute('src'),
    avatarBeforeMove,
  );
  await role.selectOption('player');
  await page
    .getByRole('button', { name: '取得座位（模拟）', exact: true })
    .click();
  await page
    .getByRole('status')
    .filter({ hasText: '已有同名玩家，请用座位 S3 区分' })
    .waitFor();
  await page.getByRole('button', { name: '我已准备', exact: true }).click();
  assert.ok(
    (await page.locator('.seat-list li').last().textContent()).includes(
      '已准备',
    ),
  );
  await capture('player-lobby-360', 360, 800);
  console.log('Prototype: lobby captured');
  evidence.checks.push(
    'Lobby duplicate name, joining closed/open, stable seat ID after reorder, player ready',
  );

  await screen.selectOption('session');
  const choose = page.getByRole('button', { name: '选项 A', exact: true });
  const submit = page.getByRole('button', {
    name: '提交示例选择',
    exact: true,
  });
  await choose.click();
  await submit.click();
  assert.equal(await submit.isEnabled(), false);
  await capture('player-submitting-390', 390, 844);
  await simulate('模拟拒绝');
  assert.match(await page.getByTestId('submission').textContent(), /被拒绝/);
  await choose.click();
  await submit.click();
  await simulate('模拟确认丢失');
  assert.equal(await choose.isEnabled(), false);
  assert.match(await page.getByTestId('submission').textContent(), /结果未知/);
  await simulate('模拟完整同步');
  assert.equal(await submit.isEnabled(), false);
  assert.equal(await choose.getAttribute('aria-pressed'), 'false');
  await choose.click();
  await submit.click();
  await simulate('模拟保存确认');
  assert.match(
    await page.getByTestId('submission').textContent(),
    /已保存并确认/,
  );
  evidence.checks.push(
    'Submission lock, reject/reselect, uncertain result blocks new action, sync clears selection, save confirmation',
  );

  await choose.click();
  await simulate('模拟掉线');
  assert.equal(await submit.isEnabled(), false);
  await page
    .getByRole('button', { name: '模拟重连并同步', exact: true })
    .click();
  assert.equal(await choose.getAttribute('aria-pressed'), 'false');
  await role.selectOption('host');
  await page.getByRole('button', { name: '暂停对局', exact: true }).click();
  await role.selectOption('player');
  assert.equal(await choose.isEnabled(), false);
  assert.equal(
    await page.getByRole('button', { name: '暂停对局', exact: true }).count(),
    0,
  );
  await role.selectOption('host');
  await page.getByRole('button', { name: '恢复对局', exact: true }).click();
  await page
    .getByRole('button', { name: '选择决策点回退', exact: true })
    .click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page
    .getByRole('button', { name: '选择决策点回退', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByText(/已有信息可能被看见/)
    .waitFor();
  await capture('host-rollback', 1280, 900);
  await page
    .getByRole('button', { name: '确认回退（模拟）', exact: true })
    .click();
  await page
    .getByRole('button', { name: '选择决策点回退', exact: true })
    .click();
  await page.getByLabel('目标决策点').selectOption('决策示例 A 之前');
  await page
    .getByRole('button', { name: '确认回退（模拟）', exact: true })
    .click();
  assert.match(await page.getByTestId('revision').textContent(), /分支 3/);
  const revision = await page.getByTestId('revision').textContent();
  await simulate('模拟旧分支迟到动作');
  assert.equal(await page.getByTestId('revision').textContent(), revision);
  await page
    .getByRole('button', { name: '确认换手机绑定', exact: true })
    .click();
  await page
    .getByRole('button', { name: '确认重新绑定（模拟）', exact: true })
    .click();
  await page.getByRole('status').filter({ hasText: '原凭证失效' }).waitFor();
  evidence.checks.push(
    'Disconnect/sync, pause/resume views, rollback warning and monotonic synthetic branch, stale-action feedback, rebind confirmation',
  );

  await role.selectOption('public');
  assert.equal(
    await page
      .getByRole('button', { name: '提交示例选择', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole('button', { name: '选择决策点回退', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole('button', { name: '试听示例音', exact: true })
      .isEnabled(),
    false,
  );
  await page.getByRole('button', { name: '启用提示音', exact: true }).click();
  await page.getByRole('button', { name: '试听示例音', exact: true }).waitFor();
  await page.getByRole('button', { name: '静音', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '试听示例音', exact: true })
      .isEnabled(),
    false,
  );
  await capture('public-session-1920', 1920, 1080);
  await role.selectOption('player');
  assert.equal(
    await page.getByRole('button', { name: '启用提示音', exact: true }).count(),
    0,
  );
  evidence.checks.push(
    'Product-view role controls separated, public-only sound enable/mute; real authorization not tested',
  );

  await role.selectOption('host');
  await screen.selectOption('recovery');
  await page
    .getByRole('button', { name: '查看版本不兼容提示', exact: true })
    .click();
  await page
    .getByRole('heading', { name: '存档版本不兼容', exact: true })
    .waitFor();
  await reviewSelect('异常类型').selectOption('corrupt');
  await page.getByText('原存档保留，未修改或覆盖。', { exact: true }).waitFor();
  await capture('host-save-error', 1280, 900);
  await screen.selectOption('recovery');
  await page.getByRole('button', { name: '模拟恢复存档', exact: true }).click();
  await page
    .getByRole('button', { name: '模拟重连并同步', exact: true })
    .click();
  await page.getByRole('button', { name: '结束当前对局', exact: true }).click();
  await page
    .getByRole('button', { name: '确认结束（模拟）', exact: true })
    .click();
  await page
    .getByRole('heading', { name: '这场相聚，告一段落。', exact: true })
    .waitFor();
  evidence.checks.push(
    'Recovery, incompatible/corrupt copy, host termination flow; no actual persistence tested',
  );

  await screen.selectOption('setup');
  await page.locator('.network-settings > summary').click();
  await page.getByLabel('网卡地址').selectOption('172.20.0.1');
  await page
    .getByText('http://172.20.0.1:38473/player', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: '查看连接帮助', exact: true }).click();
  await page
    .getByRole('heading', { name: '手机暂时无法连接', exact: true })
    .waitFor();
  await reviewSelect('异常类型').selectOption('port');
  await page
    .getByRole('heading', { name: '本地服务未能启动', exact: true })
    .waitFor();
  evidence.checks.push(
    'Example adapter selection, network help, explicit port conflict feedback',
  );

  for (const width of [360, 390]) {
    await resize(width, 844);
    for (const viewer of ['host', 'public', 'player']) {
      await role.selectOption(viewer);
      for (const view of [
        'setup',
        'lobby',
        'session',
        'result',
        'recovery',
        'error',
      ]) {
        await screen.selectOption(view);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        assert.equal(overflow, false, `${viewer}/${view} must fit ${width}px`);
        const smallTargets = await page
          .locator('main button, main input, main select')
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const rect = element.getBoundingClientRect();
                return rect.height > 0 && rect.height < 44;
              })
              .map((element) => element.textContent),
          );
        assert.deepEqual(
          smallTargets,
          [],
          `${viewer}/${view} touch targets must be at least 44px tall`,
        );
      }
    }
  }
  evidence.checks.push(
    'All 6 pages × 3 roles at 360/390px, no horizontal overflow, 44px touch target height',
  );
  // Art reset: common desktop views fit the viewport with review tools closed.
  for (const [viewer, width, height] of [
    ['host', 1080, 800],
    ['host', 1280, 900],
    ['public', 1920, 1080],
  ]) {
    await resize(width, height);
    await role.selectOption(viewer);
    for (const view of ['setup', 'lobby', 'session', 'result', 'recovery']) {
      await screen.selectOption(view);
      if (view === 'lobby') {
        assert.equal(
          await page.locator('.seat-list .own-seat').count(),
          0,
          'Host and public lobby do not inherit the phone identity marker',
        );
      }
      const metrics = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        broken: [...document.images]
          .filter((img) => !img.complete || img.naturalWidth === 0)
          .map((img) => img.src),
      }));
      assert.ok(
        metrics.scrollHeight <= height + 1,
        `${viewer}/${view} must fit ${width}×${height}: ${JSON.stringify(metrics)}`,
      );
      assert.ok(
        metrics.scrollWidth <= width,
        `${viewer}/${view} horizontal overflow`,
      );
      assert.deepEqual(metrics.broken, [], 'Artwork loads locally');
      await capture(`${viewer}-${view}-${width}-art`, width, height);
    }
  }
  for (const [width, height] of [
    [360, 800],
    [390, 844],
  ]) {
    await resize(width, height);
    await role.selectOption('player');
    for (const view of ['lobby', 'session']) {
      await screen.selectOption(view);
      const button = page.locator('.player-action-bar .primary');
      const box = await button.boundingBox();
      assert.ok(
        box && box.y >= 0 && box.y + box.height <= height,
        `${view} primary action visible at ${width}`,
      );
      if (view === 'session') {
        const choice = await page
          .getByRole('button', { name: '选项 A', exact: true })
          .boundingBox();
        const bar = await page.locator('.player-action-bar').boundingBox();
        assert.ok(
          choice && bar && choice.y + choice.height <= bar.y,
          'Choice is not covered by the fixed action bar',
        );
      }
      await capture(`player-${view}-${width}-art`, width, height);
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const transition = await page
    .getByRole('button', { name: '选项 A', exact: true })
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  assert.equal(transition, '0s');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await role.selectOption('host');
  await screen.selectOption('session');
  await page
    .getByRole('button', { name: '选择决策点回退', exact: true })
    .focus();
  const outline = await page
    .getByRole('button', { name: '选择决策点回退', exact: true })
    .evaluate((el) => getComputedStyle(el).outlineWidth);
  // Chromium rounds CSS outlines to device pixels at Windows display scaling.
  assert.ok(Number.parseFloat(outline) >= 2, 'Keyboard focus remains visible');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Tab');
  assert.equal(
    await page
      .getByRole('button', { name: '确认回退（模拟）', exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press('Escape');
  assert.equal(
    await page
      .getByRole('button', { name: '选择决策点回退', exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  evidence.checks.push(
    'Art reset: default closed review drawer, stable seat artwork, desktop viewport fit, all images load, mobile actions visible and choices unobscured, reduced motion and dialog keyboard focus',
  );

  assert.deepEqual(
    evidence.externalRequests,
    [],
    'Prototype runtime requests must stay local',
  );
  assert.deepEqual(evidence.consoleErrors, []);
  const html = await readFile(
    resolve('artifacts/phase-02/prototype/prototype.html'),
    'utf8',
  );
  assert.ok(!html.includes('socket.io'));
  evidence.checks.push(
    'All observed runtime requests local, no browser page errors',
  );
  evidence.passed = true;
  console.log(
    `Prototype verified: ${evidence.checks.length} groups. Evidence: artifacts/phase-02/verification/prototype.json`,
  );
} catch (error) {
  evidence.passed = false;
  evidence.failure = String(error);
  throw error;
} finally {
  await writeFile(
    join(output, 'prototype.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  if (desktop) await desktop.close();
  await new Promise((fulfill, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : fulfill())),
  );
}
