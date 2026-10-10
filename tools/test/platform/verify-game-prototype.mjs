import { saveVerificationScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { launchDesktop, desktopExecutable } from '../support/desktop-test.mjs';
import { preview } from 'vite';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const layoutOnly = process.argv.includes('--layout-only');
const output = resolve(
  'artifacts/phase-02/verification/game',
  layoutOnly ? 'layout' : '.',
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/game-prototype-verify-'));
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
  TABLEMAX_PROTOTYPE_URL: `${origin}/prototype.html?game=pokemon-encounters`,
};
delete env.NODE_PATH;
const evidence = {
  verifiedAt: new Date().toISOString(),
  scope:
    'Synthetic authorized UI and motion only; no rules engine, real network authorization, bot or save/product acceptance',
  layoutOnly,
  checks: [],
  screenshots: [],
  externalRequests: [],
  pageErrors: [],
  animations: [],
};
let desktop;
try {
  desktop = await launchDesktop({
    executablePath: desktopExecutable,
    args: ['--foundation-test'],
    env,
    timeout: 30000,
  });
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin)
      evidence.externalRequests.push(request.url());
  });
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  await page.reload();
  await page
    .getByRole('heading', { name: '宝可梦奇遇', exact: true })
    .waitFor();
  const window = await desktop.browserWindow(page);
  async function drawer(open) {
    const review = page.locator('.game-review');
    if (((await review.getAttribute('open')) !== null) !== open)
      await review.locator(':scope > summary').click();
  }
  async function select(label, value) {
    await drawer(true);
    await page.getByLabel(label, { exact: true }).selectOption(value);
    await drawer(false);
  }
  async function simulate(name) {
    await drawer(true);
    await page.getByRole('button', { name, exact: true }).click();
    await drawer(false);
  }
  async function scene(id, seat = 'S1') {
    await select('游戏场景', id);
    await select('角色', 'player');
    await select('本人座位', seat);
  }
  async function pick(owner, slot) {
    const board = page.locator(`.game-board[data-seat=${owner}]`);
    if (!(await board.isVisible()))
      await page.locator('.game-public > summary').click();
    await board.locator('.game-card').nth(slot).click();
  }
  async function save() {
    await page.getByRole('button', { name: '提交选择', exact: true }).click();
    assert.equal(
      await page
        .getByRole('button', { name: '提交中…', exact: true })
        .isDisabled(),
      true,
    );
    await simulate('模拟保存确认');
  }
  async function capture(name, width, height, resetScroll = true) {
    await drawer(false);
    await window.evaluate(
      (w, size) => w.setContentSize(size.width, size.height),
      { width, height },
    );
    await page.waitForFunction(
      (s) => innerWidth === s.width && innerHeight === s.height,
      { width, height },
    );
    await page.evaluate((resetScroll) => {
      if (resetScroll) scrollTo(0, 0);
      document.activeElement?.blur();
    }, resetScroll);
    await page.evaluate(
      () =>
        new Promise((fulfill) =>
          requestAnimationFrame(() => requestAnimationFrame(fulfill)),
        ),
    );
    const measurements = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
      controls: [
        ...document.querySelectorAll(
          '.game-demo button,.game-demo select,.game-demo summary,.game-demo a',
        ),
      ]
        .filter(
          (e) => e.getClientRects().length && !e.closest('dialog:not([open])'),
        )
        .map((e) => ({
          text: e.textContent.trim().slice(0, 32),
          height: e.getBoundingClientRect().height,
        })),
      images: [...document.images].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    }));
    assert.equal(measurements.overflow, false, `${name} horizontal overflow`);
    assert.ok(
      measurements.controls.every((control) => control.height >= 44),
      `${name}: touch target <44px`,
    );
    assert.equal(measurements.images, true);
    const png = await window.evaluate(async (w) =>
      (
        await w.webContents.capturePage(undefined, {
          stayHidden: true,
          stayAwake: true,
        })
      )
        .toPNG()
        .toString('base64'),
    );
    await saveVerificationScreenshot(
      join(output, `${name}.png`),
      Buffer.from(png, 'base64'),
    );
    evidence.screenshots.push({ name, ...measurements });
  }
  if (!layoutOnly) {
    await scene('initial');
    assert.equal(
      await page.locator('.game-board[data-seat=S1] .face-up').count(),
      0,
    );
    await pick('S1', 5);
    assert.equal(
      await page.locator('.game-board[data-seat=S1] .face-up').count(),
      0,
      'Selection must not reveal',
    );
    await save();
    assert.equal(
      await page.locator('.game-board[data-seat=S1] .face-up').count(),
      1,
    );
    assert.ok(
      (await page.locator('.game-status').textContent()).includes(
        '等待其他玩家',
      ),
    );
    await simulate('推进自动步骤');
    assert.equal(
      await page
        .getByRole('button', { name: '弃牌为空', exact: true })
        .isDisabled(),
      true,
    );
    evidence.checks.push(
      'Initial phone selection reveals only after save, all-player wait, empty discard disabled',
    );

    await scene('normal');
    await page
      .getByRole('button', { name: '弃牌顶 · 普通牌 0', exact: true })
      .click();
    await save();
    assert.equal(
      await page.getByRole('button', { name: '直接弃掉', exact: true }).count(),
      0,
    );
    await pick('S1', 5);
    await page.getByRole('button', { name: '提交选择', exact: true }).click();
    const beforeRejected = await page
      .locator('.game-grid')
      .first()
      .textContent();
    await simulate('模拟拒绝');
    assert.equal(
      await page.locator('.game-grid').first().textContent(),
      beforeRejected,
    );
    await pick('S1', 4);
    await page.getByRole('button', { name: '提交选择', exact: true }).click();
    await simulate('模拟确认丢失');
    assert.equal(
      await page
        .getByRole('button', { name: '提交选择', exact: true })
        .isDisabled(),
      true,
    );
    await simulate('模拟完整同步');
    assert.equal(await page.locator('.chosen').count(), 0);
    assert.equal(await page.locator('[data-animation=saved]').count(), 0);
    await scene('normal');
    await page
      .getByRole('button', { name: '牌库顶 · 26 张', exact: true })
      .click();
    await save();
    await page.getByRole('button', { name: '直接弃掉', exact: true }).click();
    await save();
    evidence.checks.push(
      'Deck discard and mandatory discard replacement, pending lock, rejection, uncertain result and synchronization clear selections/animations',
    );

    await scene('mew');
    await pick('S2', 5);
    await save();
    assert.equal(await page.locator('.game-result').count(), 0);
    assert.ok(
      (await page.locator('.game-status').textContent()).includes('己方替换位'),
    );
    await pick('S1', 5);
    await save();
    assert.equal(await page.locator('.game-result').count(), 1);
    await scene('rocket-meowth');
    await pick('S1', 5);
    await save();
    await scene('rocket-pikachu');
    await pick('S1', 5);
    await save();
    for (const owner of ['S1', 'S2', 'S3']) {
      assert.equal(await page.locator('.game-result').count(), 0);
      await simulate('推进自动步骤');
      if (owner === 'S1')
        assert.ok(
          (await page.locator('.game-status').textContent()).includes('S2'),
        );
    }
    assert.equal(await page.locator('.game-result').count(), 1);
    await scene('zapdos');
    await pick('S1', 5);
    await save();
    assert.equal(
      await page
        .getByRole('button', { name: '提交选择', exact: true })
        .isDisabled(),
      true,
    );
    await select('本人座位', 'S2');
    await pick('S2', 5);
    await save();
    assert.equal(await page.locator('.game-result').count(), 0);
    await select('角色', 'host');
    await simulate('模拟电脑选择');
    await simulate('模拟保存确认');
    assert.equal(await page.locator('.game-result').count(), 1);
    evidence.checks.push(
      'Mew both targets, both Rocket faces with complete refill, Zapdos recipient handoff and synthetic computer response finish before ending',
    );

    await scene('snorlax');
    await pick('S1', 0);
    await pick('S1', 5);
    await save();
    await scene('snorlax');
    await pick('S1', 1);
    await page.getByRole('button', { name: '不发动能力', exact: true }).click();
    await save();
    await scene('charizard');
    assert.equal(
      await page
        .locator('.game-board[data-seat=S1] .game-card')
        .first()
        .isDisabled(),
      true,
    );
    await pick('S1', 5);
    await save();
    assert.equal(await page.getByTestId('peek-value').count(), 1);
    await select('角色', 'host');
    assert.equal(await page.getByTestId('peek-value').count(), 0);
    await select('角色', 'player');
    await select('本人座位', 'S2');
    assert.equal(await page.getByTestId('peek-value').count(), 0);
    await select('本人座位', 'S1');
    await page
      .getByRole('button', { name: '确认查看结束', exact: true })
      .click();
    await save();
    assert.equal(await page.getByTestId('peek-value').count(), 0);
    await scene('charizard');
    await page.getByRole('button', { name: '不发动能力', exact: true }).click();
    await save();
    await scene('charizard-empty');
    await simulate('推进自动步骤');
    evidence.checks.push(
      'Snorlax distinct swap or decline, Charizard own hidden target/decline/no target, temporary peek restricted and cleared',
    );

    await scene('zapdos');
    await pick('S1', 5);
    await save();
    await select('角色', 'host');
    await page.locator('.game-management > summary').click();
    await page.getByRole('button', { name: '暂停游戏', exact: true }).click();
    await select('角色', 'player');
    await select('本人座位', 'S2');
    assert.equal(
      await page
        .getByRole('button', { name: '提交选择', exact: true })
        .isDisabled(),
      true,
    );
    await select('角色', 'host');
    await page.locator('.game-management > summary').click();
    await page.getByRole('button', { name: '恢复游戏', exact: true }).click();
    await page
      .getByRole('button', { name: '恢复所选决策', exact: true })
      .click();
    await page
      .locator('dialog')
      .getByRole('button', { name: '确认', exact: true })
      .click();
    assert.ok(
      (await page.locator('.game-status').textContent()).includes('分支 2'),
    );
    assert.equal(await page.locator('.chosen').count(), 0);
    assert.equal(await page.locator('[data-animation=saved]').count(), 0);
    await page
      .getByRole('button', { name: '确认换手机绑定', exact: true })
      .click();
    await page
      .locator('dialog')
      .getByRole('button', { name: '确认', exact: true })
      .click();
    assert.ok(
      (await page.locator('.game-management').textContent()).includes(
        '绑定代数 2',
      ),
    );
    await simulate('模拟重启恢复');
    await simulate('模拟完整同步');
    await simulate('模拟旧动作');
    evidence.checks.push(
      'Pause, decision history rollback/new branch, stale choices/animation cleanup, phone rebind and middle-effect restore feedback',
    );
  }
  await scene('normal');
  await page
    .getByRole('button', { name: '牌库顶 · 26 张', exact: true })
    .click();
  await save();
  await pick('S1', 5);
  await page.getByRole('button', { name: '提交选择', exact: true }).click();
  assert.equal(
    await page
      .locator('.game-tables')
      .evaluate((node) => node.getAnimations().length),
    0,
  );
  await drawer(true);
  await page.getByRole('button', { name: '模拟保存确认', exact: true }).click();
  const motion = await page.locator('.game-result').evaluate((node) =>
    node.getAnimations().map((a) => ({
      playState: a.playState,
      duration: a.effect.getTiming().duration,
      keyframes: a.effect.getKeyframes(),
    })),
  );
  assert.ok(motion.some((a) => a.duration === 220));
  evidence.animations.push({ event: 'saved-result', ...motion[0] });
  await drawer(false);
  await scene('normal');
  await page
    .getByRole('button', { name: '牌库顶 · 26 张', exact: true })
    .click();
  await save();
  await capture('phone-360', 360, 800);
  await pick('S1', 5);
  const footer = await page.locator('.game-submit').evaluate((node) => ({
    position: getComputedStyle(node).position,
    top: node.getBoundingClientRect().top,
    bottom: node.getBoundingClientRect().bottom,
  }));
  const card = await page
    .locator('.game-board[data-seat=S1] .game-card')
    .nth(5)
    .boundingBox();
  assert.equal(footer.position, 'fixed');
  assert.ok(card && card.y + card.height / 2 < footer.top);
  evidence.footer = footer;
  assert.ok(footer.bottom <= 801, JSON.stringify(footer));
  await capture('phone-selection-footer-360', 360, 800, false);
  evidence.checks.push(
    'Phone submission stays visible after lower-row selection; selected card center unobscured by footer',
  );

  await capture('phone-390', 390, 844);
  await page
    .locator('.game-demo')
    .evaluate((node) =>
      node.style.setProperty('--prototype-safe-bottom', '24px'),
    );
  assert.equal(
    await page
      .locator('.game-demo')
      .evaluate((node) => getComputedStyle(node).paddingBottom),
    '130px',
  );
  await capture('phone-safe-area-390', 390, 844);
  await page
    .locator('.game-demo')
    .evaluate((node) => node.style.removeProperty('--prototype-safe-bottom'));
  evidence.checks.push(
    'Simulated 24px bottom safe area reserves 130px including fixed submit footer; real device remains phase six',
  );
  await select('角色', 'host');
  await capture('public-1920', 1920, 1080);
  await scene('charizard');
  await pick('S1', 5);
  await save();
  await capture('private-peek-390', 390, 844);
  await select('角色', 'host');
  await capture('public-during-peek', 1920, 1080);
  for (const id of [
    'initial',
    'mew',
    'rocket-meowth',
    'rocket-pikachu',
    'zapdos',
    'snorlax',
    'charizard',
    'charizard-empty',
    'result',
  ]) {
    await scene(id);
    await capture(`${id}-360`, 360, 800);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await scene('result');
  assert.equal(
    await page
      .locator('.game-result')
      .evaluate((node) => getComputedStyle(node).animationName),
    'none',
  );
  await capture('result-reduced-390', 390, 844);
  evidence.checks.push(
    'Public 1920 and phones 360/390: no horizontal overflow, visible targets >=44px, images load, all scenes, saved-only motion and reduced motion',
  );
  await page.goto(`${origin}/prototype.html`);
  await page.locator('.review-drawer > summary').click();
  await page.getByLabel('页面', { exact: true }).selectOption('lobby');
  await page.getByRole('button', { name: '模拟全员准备', exact: true }).click();
  await page.locator('.review-drawer > summary').click();
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: '添加电脑', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '添加电脑', exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole('button', { name: '移除电脑', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: '添加电脑', exact: true })
      .isDisabled(),
    false,
  );
  await page.getByRole('button', { name: '开始游戏原型', exact: true }).click();
  await page
    .getByRole('heading', { name: '宝可梦奇遇', exact: true })
    .waitFor();
  evidence.checks.push(
    'Lobby prepares through review simulation, maximum five human/bot seats, remove bot and clickable game entry',
  );
  assert.deepEqual(evidence.externalRequests, []);
  assert.deepEqual(evidence.pageErrors, []);
  assert.equal((await fetch(`${origin}/api/foundation/health`)).status, 404);
  evidence.checks.push(
    'All runtime requests local and independent preview has no production API',
  );
  evidence.passed = true;
  console.log(
    `Game prototype verified: ${evidence.checks.length} groups; ${evidence.screenshots.length} captures`,
  );
} catch (error) {
  evidence.passed = false;
  evidence.failure = String(error);
  throw error;
} finally {
  await writeFile(
    join(output, 'game-prototype.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  if (desktop) await desktop.close();
  await new Promise((fulfill, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : fulfill())),
  );
}
