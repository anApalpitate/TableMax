import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from './browser-test.mjs';
import { serveFixture } from './fixture-server.mjs';
import { verificationOutput } from './verification-output.mjs';

const evidenceName =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  'source';
assert.match(evidenceName, /^[a-z0-9-]{1,40}$/);
const output = verificationOutput(
  'pokemon-polish-20261005',
  'layout',
  evidenceName,
);
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/game-ui-'));
const started = performance.now();
const report = {
  scope:
    'Headless Edge renders the actual production PokemonScreen and PlayerControls with authorized projections from complete verification deck permutations and legal production-rule transitions. This checks source component layout and commands, not server persistence, native DPI, portable-package or physical-phone acceptance.',
  topbars: [],
  choices: [],
  buttonPolish: [],
  guidanceSettings: [],
  commands: [],
  screenshots: [],
  errors: [],
};
await writeFile(
  join(work, 'entry.tsx'),
  `import ${JSON.stringify(resolve('scripts/fixtures/pokemon-polish-layout.tsx'))};`,
);
await writeFile(
  join(work, 'index.html'),
  '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pokemon Screen layout verification</title></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>',
);
await build({
  configFile: false,
  root: work,
  plugins: [react()],
  resolve: {
    alias: {
      react: resolve('apps/web/node_modules/react'),
      'react-dom': resolve('apps/web/node_modules/react-dom'),
    },
  },
  build: {
    outDir: join(work, 'bundle'),
    emptyOutDir: false,
    target: 'chrome110',
  },
  logLevel: 'error',
});
const server = await serveFixture(join(work, 'bundle'));
let browser;
try {
  browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
    soundEnabled: process.argv.includes('--sound'),
  });
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(server.url);
  await page.waitForFunction(
    () => typeof window.setPokemonFixture === 'function',
  );
  const reset = async (setting) => {
    await page.evaluate((next) => window.setPokemonFixture(next), setting);
    await page.waitForFunction(() =>
      [...document.images].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
    await page.evaluate(() => scrollTo(0, 0));
  };
  const capture = async (name, fullPage = false) => {
    const file = `${name}.png`;
    await page.screenshot({ path: join(output, file), fullPage });
    report.screenshots.push(file);
  };
  const controls = async (selector) =>
    page.locator(selector).evaluateAll((elements) =>
      elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const hit = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        );
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        return {
          label: element.textContent.trim(),
          accessible: element.getAttribute('aria-label'),
          disabled: element.matches(':disabled'),
          fontSize: parseFloat(style.fontSize),
          whiteSpace: style.whiteSpace,
          textWidth: text.width,
          clientWidth: element.clientWidth,
          padding:
            parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          right: bounds.right,
          bottom: bounds.bottom,
          uncovered: !!hit && (hit === element || element.contains(hit)),
        };
      }),
    );
  const inspectTop = async (label) => {
    const buttons = await controls('.game-toolbar > button, .game-toolbar > a');
    report.topbars.push({ label, buttons });
    assert.deepEqual(
      buttons.map((button) => button.label),
      ['‹ 盒子', '朋友', '规则', '菜单'],
      `${label}: four stable phone controls`,
    );
    for (const button of buttons) {
      assert.ok(button.fontSize >= 18, `${label}: ${button.label} font`);
      assert.ok(
        button.width >= 44 && button.height >= 44 && button.uncovered,
        `${label}: ${button.label} touch target`,
      );
      assert.ok(
        button.right <= page.viewportSize().width + 1 &&
          button.textWidth <= button.clientWidth - button.padding + 1 &&
          button.whiteSpace === 'nowrap',
        `${label}: ${button.label} fits without wrapping`,
      );
      assert.ok(Math.abs(button.y - buttons[0].y) < 1, `${label}: one top row`);
    }
    assert.equal(
      await page.locator('.game-toolbar .test-mode-badge').count(),
      0,
    );
    assert.ok(
      (
        await page
          .locator('.game-toolbar .connection')
          .getAttribute('aria-label')
      )?.length > 0,
      `${label}: accessible connection status`,
    );
  };
  const inspectChoices = async (label, firstScreen) => {
    // Context guidance may naturally extend a short screen; preserve readable cards and controls.
    if (firstScreen)
      await page.locator('.choice-actions').scrollIntoViewIfNeeded();
    const buttons = await controls('.choice-actions > button');
    const bar = await page.locator('.choice-actions').boundingBox();
    report.choices.push({ label, bar, buttons });
    assert.ok(
      [2, 3].includes(buttons.length),
      `${label}: bounded button count`,
    );
    assert.equal(buttons.at(-1).label, '取消', `${label}: cancel last in DOM`);
    assert.ok(
      Math.abs(buttons.at(-1).width - 64) < 1,
      `${label}: cancel width`,
    );
    assert.ok(
      Math.abs(buttons.at(-1).right - (bar.x + bar.width)) < 1,
      `${label}: cancel anchored right`,
    );
    assert.ok(
      Math.abs(buttons[0].x - bar.x) < 1,
      `${label}: confirmation left`,
    );
    assert.ok(
      Math.abs(buttons[0].y - buttons.at(-1).y) < 1,
      `${label}: confirm and cancel share a row`,
    );
    for (const button of buttons) {
      assert.ok(button.fontSize >= 18, `${label}: ${button.label} readable`);
      assert.ok(
        button.width >= 44 && button.height >= 44,
        `${label}: ${button.label} touch target`,
      );
      assert.ok(
        button.textWidth <= button.clientWidth - button.padding + 1 &&
          button.whiteSpace === 'nowrap',
        `${label}: ${button.label} label fits`,
      );
      if (firstScreen)
        assert.ok(
          button.bottom <= page.viewportSize().height + 1 && button.uncovered,
          `${label}: ${button.label} is reachable and uncovered after natural scroll`,
        );
    }
    if (buttons.length === 3)
      assert.ok(
        bar.width > 260
          ? Math.abs(buttons[1].y - buttons[0].y) < 1
          : buttons[1].y >= buttons[0].bottom,
        `${label}: deliberate single-row or narrow two-row placement`,
      );
  };
  const select = async (scene) => {
    const board = page.locator(
      scene === 'mew-other'
        ? '.target-board .pokemon-board'
        : '.pokemon-player > .pokemon-board',
    );
    if (scene === 'snorlax') await board.locator('button').nth(0).click();
    await board.locator('button').nth(2).click();
  };

  const openGuidanceSettings = async () => {
    await page.getByRole('button', { name: '菜单', exact: true }).click();
    await page.getByRole('button', { name: '游戏设置', exact: true }).click();
  };
  const closeGuidanceSettings = async () => {
    await page
      .getByRole('button', { name: '关闭面板', exact: true })
      .last()
      .click();
    await page.getByRole('button', { name: '关闭面板', exact: true }).click();
  };
  const setGuidance = async (enabled) => {
    await openGuidanceSettings();
    const toggle = page.getByRole('switch', { name: '新手引导', exact: true });
    if ((await toggle.getAttribute('aria-checked')) !== String(enabled))
      await toggle.click();
    await closeGuidanceSettings();
  };
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await reset({ scene: 'peek' });
    assert.equal(
      await page
        .locator('.guidance-instruction, .guidance-notice, .ability-trigger')
        .count(),
      0,
    );
    assert.equal(
      await page.locator('.ability-phrase').textContent(),
      '喷火龙：查看暗牌',
    );
    const compactHeight = (
      await page.locator('.decision-guidance').boundingBox()
    ).height;
    const prior = await page.evaluate(() =>
      JSON.stringify(window.pokemonFixture),
    );
    await openGuidanceSettings();
    const toggle = page.getByRole('switch', { name: '新手引导', exact: true });
    assert.equal(await toggle.getAttribute('aria-checked'), 'false');
    const size = await controls('.guidance-toggle');
    assert.ok(
      size[0].height >= 44 && size[0].fontSize >= 18 && size[0].uncovered,
    );
    assert.equal(
      await page.getByRole('slider').count(),
      0,
      'Ordinary phone cannot change the room timer',
    );
    await capture(`guidance-setting-${width}`);
    await toggle.click();
    await closeGuidanceSettings();
    const expandedHeight = (
      await page.locator('.decision-guidance').boundingBox()
    ).height;
    assert.ok(expandedHeight > compactHeight + 30);
    assert.ok(await page.locator('.guidance-instruction').isVisible());
    assert.equal(
      await page.evaluate(() => JSON.stringify(window.pokemonFixture)),
      prior,
    );
    assert.equal(await page.evaluate(() => window.pokemonCommands.length), 0);
    await setGuidance(false);
    await capture(`guidance-compact-${width}`, true);
    report.guidanceSettings.push({
      width,
      compactHeight,
      expandedHeight,
      defaultDisabled: true,
      commands: 0,
      toggle: size[0],
    });
  }
  await reset({ scene: 'charizard', surface: 'box' });
  await page.getByRole('button', { name: '游戏设置', exact: true }).click();
  await page.getByRole('switch', { name: '新手引导', exact: true }).click();
  await page.getByRole('button', { name: '关闭面板', exact: true }).click();
  await reset({ scene: 'charizard' });
  assert.ok(
    await page.locator('.guidance-instruction').isVisible(),
    'Box preference reaches the game',
  );
  await page.reload();
  await page.waitForFunction(() => Boolean(window.setPokemonFixture));
  await reset({ scene: 'charizard' });
  assert.ok(
    await page.locator('.guidance-instruction').isVisible(),
    'Preference survives reload',
  );
  await select('charizard');
  assert.ok(await page.locator('.cancel-selection').isEnabled());
  await setGuidance(false);
  assert.ok(
    await page.locator('.cancel-selection').isEnabled(),
    'Toggle preserves the selected slot',
  );
  assert.equal(await page.evaluate(() => window.pokemonCommands.length), 0);
  const another = await page.context().newPage();
  await another.goto(page.url());
  await another.getByRole('button', { name: '菜单', exact: true }).click();
  await another.getByRole('button', { name: '游戏设置', exact: true }).click();
  await another.getByRole('switch', { name: '新手引导', exact: true }).click();
  await page.waitForFunction(() =>
    Boolean(document.querySelector('.guidance-instruction')),
  );
  await another.getByRole('switch', { name: '新手引导', exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector('.guidance-instruction'),
  );
  await another.close();
  assert.ok(await page.locator('.cancel-selection').isEnabled());
  report.guidanceSettings.push({
    box: true,
    reload: true,
    crossWindow: true,
    preservesSelection: true,
    commands: 0,
  });
  await reset({ scene: 'draw' });
  assert.equal(
    await page.locator('.decision-guidance').count(),
    0,
    'Ordinary draw has no redundant guidance paragraph',
  );
  await reset({ scene: 'peek', role: 'host' });
  await openGuidanceSettings();
  assert.equal(
    await page.getByRole('slider').count(),
    1,
    'Host timer remains available',
  );
  assert.equal(
    await page
      .getByRole('switch', { name: '新手引导', exact: true })
      .getAttribute('aria-checked'),
    'false',
  );
  await closeGuidanceSettings();

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 568, height: 320 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    for (const variant of [
      { connected: true, fullscreenSupported: true, playMode: 'play' },
      { connected: false, fullscreenSupported: false, playMode: 'test' },
    ]) {
      await reset({ scene: 'initial', ...variant });
      const label = `${viewport.width}x${viewport.height}-${variant.connected ? 'online' : 'offline-test'}`;
      await inspectTop(label);
      if (viewport.width <= 390 || viewport.width === 844) await capture(label);
      await page.locator('.toolbar-menu').click();
      const menu = page.locator('dialog[open] .pokemon-mobile-menu-controls');
      assert.equal(await menu.count(), 1, `${label}: ordinary player's menu`);
      assert.equal(
        await menu.locator('button').count(),
        variant.fullscreenSupported ? 1 : 0,
        `${label}: fullscreen stays in menu`,
      );
      assert.equal(
        await menu.locator('.test-mode-badge').count(),
        variant.playMode === 'test' ? 1 : 0,
        `${label}: test badge stays in menu`,
      );
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog[open]').count(), 0);
      assert.equal(
        await page
          .locator('.toolbar-menu')
          .evaluate((button) => button === document.activeElement),
        true,
        `${label}: menu restores focus`,
      );
    }
  }

  const choiceScenes = [
    'initial',
    'place',
    'discard-place',
    'snorlax',
    'charizard',
    'mew-other',
    'mew-self',
    'rocket',
    'zapdos-self',
    'zapdos-receive',
  ];
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 568, height: 320 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const scenes =
      viewport.width > 430 ? ['place', 'snorlax', 'charizard'] : choiceScenes;
    for (const scene of scenes) {
      const label = `${viewport.width}x${viewport.height}-${scene}`;
      await reset({ scene });
      await inspectTop(label);
      const cancel = page.getByRole('button', {
        name: '取消卡片选择',
        exact: true,
      });
      const confirm = page.locator('.confirm-action');
      assert.equal(
        await cancel.isDisabled(),
        true,
        `${label}: unselected cancel reserves its slot`,
      );
      assert.equal(
        await confirm.isDisabled(),
        true,
        `${label}: selection is required`,
      );
      const step = await page.evaluate(() => window.pokemonFixture.step);
      await select(scene);
      await page.evaluate(() => scrollTo(0, 0));
      await inspectChoices(
        label,
        viewport.width >= 360 && viewport.width <= 430,
      );
      if (viewport.width === 360 || scene === 'place') await capture(label);
      assert.equal(await page.evaluate(() => window.pokemonCommands.length), 0);
      await cancel.click();
      assert.equal(
        await cancel.isDisabled(),
        true,
        `${label}: cancellation clears choice`,
      );
      assert.equal(
        await confirm.isDisabled(),
        true,
        `${label}: cancellation disables confirm`,
      );
      assert.equal(await page.evaluate(() => window.pokemonFixture.step), step);
      assert.equal(await page.evaluate(() => window.pokemonCommands.length), 0);
      await select(scene);
      await confirm.click();
      const commands = await page.evaluate(() => window.pokemonCommands);
      assert.equal(commands.length, 1, `${label}: one legal confirmed command`);
      assert.equal(
        await page.evaluate(() => window.pokemonFixture.step),
        step + 1,
      );
      report.commands.push({ label, command: commands[0] });
    }
  }

  await page.setViewportSize({ width: 360, height: 640 });
  for (const scene of ['draw', 'waiting', 'peek']) {
    await reset({ scene });
    assert.equal(
      await page.locator('.submit-choice').count(),
      0,
      `${scene}: no empty choice area`,
    );
    if (scene === 'peek')
      assert.equal(
        await page
          .getByRole('button', { name: '查看完成，关闭暗牌查看', exact: true })
          .count(),
        1,
      );
  }
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 568, height: 320 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await reset({ scene: 'peek' });
    const close = page.getByRole('button', {
      name: '查看完成，关闭暗牌查看',
      exact: true,
    });
    await close.scrollIntoViewIfNeeded();
    const [button] = await controls('.close-peek-action');
    const privateArea = await page.locator('.private-peek').boundingBox();
    assert.equal(button.label, '查看完成');
    assert.ok(
      button.fontSize >= 18 && button.height >= 48 && button.width >= 180,
    );
    assert.ok(button.uncovered && button.whiteSpace === 'nowrap');
    assert.ok(
      Math.abs(
        button.x + button.width / 2 - privateArea.x - privateArea.width / 2,
      ) < 1,
    );
    assert.ok(
      await page
        .locator('.peek-caption')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16),
    );
    const prior = await page.evaluate(() => window.pokemonFixture.step);
    await capture(`buttons-peek-${viewport.width}x${viewport.height}`, true);
    await close.click();
    assert.equal(await page.locator('.private-peek').count(), 0);
    assert.equal(
      await page.evaluate(() => window.pokemonFixture.step),
      prior + 1,
    );
    assert.deepEqual(
      await page.evaluate(() =>
        window.pokemonCommands.map((c) => c.action.type),
      ),
      ['close-peek'],
    );
    report.buttonPolish.push({ viewport, scene: 'peek', button });

    await reset({ scene: 'mew-other', longTargets: true });
    await page.locator('.target-tabs').scrollIntoViewIfNeeded();
    const targets = await controls('.target-tabs button');
    assert.equal(targets.length, 5);
    assert.deepEqual(
      await page.locator('.target-seat-number').allTextContents(),
      ['2', '3', '4', '5', '6'],
    );
    for (const target of targets) {
      assert.ok(
        target.fontSize >= 18 && target.height >= 44 && target.width >= 44,
      );
      assert.ok(target.uncovered && target.whiteSpace === 'nowrap');
      assert.ok(target.accessible.includes('很长昵称的朋友'));
      assert.ok(target.right <= viewport.width + 1);
    }
    const rows = [...new Set(targets.map((target) => Math.round(target.y)))];
    assert.ok(rows.length >= 2 && rows.length <= 3);
    const area = await page.locator('.target-tabs').boundingBox();
    for (const row of rows) {
      const items = targets.filter((target) => Math.round(target.y) === row);
      assert.ok(
        Math.abs(
          (items[0].x + items.at(-1).right) / 2 - area.x - area.width / 2,
        ) < 1,
      );
    }
    await page.locator('.ability-summary').first().scrollIntoViewIfNeeded();
    assert.equal(
      await page.locator('.ability-phrase').first().textContent(),
      '梦幻：偷取卡牌',
    );
    const rule = await controls('.ability-detail');
    const summary = await page
      .locator('.ability-summary')
      .first()
      .boundingBox();
    assert.ok(rule[0].height >= 44 && rule[0].width >= 44 && rule[0].uncovered);
    assert.ok(Math.abs(rule[0].right - summary.x - summary.width) < 1);
    await capture(`buttons-mew-${viewport.width}x${viewport.height}`, true);
    report.buttonPolish.push({
      viewport,
      scene: 'mew-other',
      targets,
      rules: rule,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await reset({ scene: 'peek', connected: false });
  assert.equal(
    await page.locator('.private-peek').count(),
    0,
    'Disconnected player cannot use the peek control',
  );
  assert.equal(await page.evaluate(() => window.pokemonCommands.length), 0);
  for (const role of ['host', 'public']) {
    await reset({ scene: 'peek', role });
    assert.equal(
      await page.locator('.private-peek, .close-peek-action').count(),
      0,
      'Peek remains owner-only',
    );
  }
  for (const action of ['弃掉这张牌', '跳过能力']) {
    await reset({ scene: action === '弃掉这张牌' ? 'place' : 'snorlax' });
    await page.getByRole('button', { name: action, exact: true }).click();
    const commands = await page.evaluate(() => window.pokemonCommands);
    assert.equal(commands.length, 1);
    assert.equal(
      commands[0].action.type,
      action === '弃掉这张牌' ? 'discard-held' : 'decline-ability',
    );
    report.commands.push({ label: action, command: commands[0] });
  }
  for (const paused of [false, true]) {
    await reset({ scene: 'mew-other', paused });
    assert.equal(
      await page.locator('.saved-effects, .saved-action-trails').count(),
      0,
      'Static synchronization and pause do not create saved effects',
    );
    if (paused) assert.equal(await page.locator('.submit-choice').count(), 0);
  }
  for (const scene of [
    'mew-other',
    'rocket',
    'zapdos-receive',
    'snorlax',
    'charizard',
  ]) {
    // The original detailed guidance checks now explicitly enable the opt-in setting.
    await reset({ scene: 'peek' });
    await setGuidance(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await reset({ scene });
    const instruction = page.locator('.guidance-instruction');
    assert.ok(await instruction.isVisible());
    assert.ok(
      await instruction.evaluate(
        (element) => parseFloat(getComputedStyle(element).fontSize) >= 18,
      ),
    );
    const prior = await page.evaluate(() =>
      JSON.stringify(window.pokemonFixture),
    );
    await page.locator('.ability-detail').first().click();
    await page.waitForFunction(() => document.activeElement?.tagName === 'H3');
    assert.ok(await page.locator('dialog[open] .rules-guide').isVisible());
    assert.equal(
      await page.evaluate(() => JSON.stringify(window.pokemonFixture)),
      prior,
    );
    assert.equal(await page.evaluate(() => window.pokemonCommands.length), 0);
    await page.getByRole('button', { name: '关闭面板', exact: true }).click();
    assert.equal(
      await page
        .locator('.ability-detail')
        .first()
        .evaluate((element) => element === document.activeElement),
      true,
    );
  }
  // Current-production render inventory for the read-only gameplay art review.
  for (const role of ['player', 'host']) {
    await page.setViewportSize(
      role === 'player'
        ? { width: 390, height: 844 }
        : { width: 1280, height: 720 },
    );
    for (const scene of [
      'draw',
      'place',
      'mew-other',
      'snorlax',
      'peek',
      'waiting',
      'round-result',
      'match-result',
    ]) {
      await reset({ scene, role });
      await capture(`audit-${role}-${scene}`, role === 'player');
    }
    await reset({ scene: 'place', role, paused: true });
    await capture(`audit-${role}-paused`, role === 'player');
    await reset({ scene: 'place', role });
    await page
      .getByRole('button', {
        name: role === 'player' ? '看看朋友的牌桌' : '菜单',
        exact: true,
      })
      .click();
    await capture(`audit-${role}-overlay`);
    await page.getByRole('button', { name: '关闭面板', exact: true }).click();
    if (role === 'host') {
      await reset({ scene: 'round-result', role });
      await page
        .getByRole('button', { name: '计分明细', exact: true })
        .first()
        .click();
      await capture('audit-host-score-detail');
      await page
        .locator('dialog[open]')
        .getByRole('button', { name: '关闭', exact: true })
        .click();
    }
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    for (const scene of ['mew-other', 'zapdos-self', 'rocket']) {
      await reset({ scene, animate: true });
      await page.waitForFunction(
        () =>
          document.querySelector('.anime-cut-in')?.getAnimations().length > 0,
      );
      const geometry = await page
        .locator('.anime-entrance')
        .evaluate((element) => {
          const frames = element.getAnimations({ subtree: true });
          const duration = parseFloat(
            element.style.getPropertyValue('--scene-ms'),
          );
          for (const frame of frames) {
            frame.pause();
            frame.currentTime = duration * 0.45;
          }
          const bounds = element
            .querySelector('.anime-cut-in')
            .getBoundingClientRect();
          const dashboard = document
            .querySelector('.pokemon-status')
            .getBoundingClientRect();
          const actions = document
            .querySelector('.player-action-bar')
            .getBoundingClientRect();
          return {
            top: bounds.top,
            bottom: bounds.bottom,
            statusBottom: dashboard.bottom,
            actionsTop: actions.top,
            duration,
            pointerEvents: getComputedStyle(element).pointerEvents,
          };
        });
      assert.equal(geometry.pointerEvents, 'none');
      assert.ok(
        geometry.top >= geometry.statusBottom &&
          geometry.bottom <=
            Math.min(geometry.actionsTop, page.viewportSize().height),
      );
      await capture(`cutin-player-${width}-${scene}`);
      await reset({ scene, animate: true, playMode: 'test' });
      assert.equal(await page.locator('.anime-entrance').count(), 0);
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reset({ scene: 'place', playMode: 'test' });
  assert.equal(
    await page.locator('.saved-effects, .saved-action-trails').count(),
    0,
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await reset({ scene: 'place' });
  assert.equal(
    await page.locator('.saved-effects, .saved-action-trails').count(),
    0,
  );
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = error.stack ?? String(error);
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: join(output, 'failure.png') });
    report.screenshots.push('failure.png');
  }
  throw error;
} finally {
  report.elapsedSeconds = (performance.now() - started) / 1000;
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await server.close();
}
console.log(
  `Pokemon phone layout verified: ${report.topbars.length} top bars, ${report.choices.length} choice layouts; evidence ${output}`,
);
