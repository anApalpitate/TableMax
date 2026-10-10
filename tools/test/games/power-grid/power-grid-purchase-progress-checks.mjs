import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { join } from 'node:path';

const commands = (page) => page.evaluate(() => window.__commands);
const waitForRender = (page) => page.waitForTimeout(120);

function purchaseCost(resource, marketCount, quantity) {
  let total = 0;
  for (let unit = 0; unit < quantity; unit++) {
    const remaining = marketCount - unit;
    total +=
      resource === 'uranium'
        ? [16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1][remaining - 1]
        : 9 - Math.ceil(remaining / 3);
  }
  return total;
}

async function verifyTrack(page, game) {
  const track = page.locator('.pg-game-progress');
  assert.equal(await track.getAttribute('data-game-step'), String(game.step));
  const maximum = Math.max(
    game.endThreshold,
    ...Object.values(game.players).map((player) => player.cities.length),
  );
  assert.deepEqual(
    await track
      .locator('[data-land-count]')
      .evaluateAll((nodes) =>
        nodes.map((node) => Number(node.dataset.landCount)),
      ),
    Array.from({ length: maximum + 1 }, (_, count) => count),
    'The progress track retains every city-count position',
  );
  assert.equal(
    await track.locator('.pg-progress-step2').getAttribute('data-land-count'),
    String(game.step2Threshold),
    'Step 2 uses the player-count-dependent classic threshold',
  );
  assert.equal(
    await track.locator('.pg-progress-end').getAttribute('data-land-count'),
    String(game.endThreshold),
    'The finish marker uses the classic city-count threshold',
  );
  const markers = await track
    .locator('[data-progress-player]')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        seat: node.dataset.progressPlayer,
        count: Number(node.closest('[data-land-count]').dataset.landCount),
      })),
    );
  assert.equal(markers.length, game.playerOrder.length);
  for (const seat of game.playerOrder)
    assert.deepEqual(
      markers.filter((marker) => marker.seat === seat),
      [{ seat, count: game.players[seat].cities.length }],
      'Each stable player identity occupies its proved city-count position',
    );
  return { maximum, step2: game.step2Threshold, end: game.endThreshold };
}

/** Actual rendered controls driven only by fixtures produced through legal rules. */
export async function verifyPurchaseProgress(page, fixtures, report, output) {
  await page.setViewportSize({ width: 854, height: 480 });
  await page.evaluate(() => window.setFixture('regions', 'host', true));
  await page.waitForTimeout(360);
  await page.getByRole('button', { name: '菜单', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '关闭面板', exact: true })
    .click();
  const cityPicker = page.getByLabel('选择城市', { exact: true });
  await cityPicker.click();
  await page.keyboard.press('Escape');
  const cityId = await cityPicker
    .locator('option')
    .evaluateAll((nodes) => nodes.find((node) => node.value).value);
  await cityPicker.selectOption(cityId);
  await page.getByRole('button', { name: /城市详情$/ }).click();
  await page
    .getByRole('dialog')
    .getByLabel('城市位置费用图例', { exact: true })
    .waitFor();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '关闭面板', exact: true })
    .click();
  assert.deepEqual(
    await commands(page),
    [],
    'Short paused display keeps the full city-list and menu paths clickable',
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.setFixture('powering', 'host'));
  await page.waitForTimeout(360);
  const progressBounds = await page.locator('.pg-game-progress').boundingBox();
  const lastCount = await page
    .locator('.pg-progress-scroll [data-land-count]')
    .last()
    .boundingBox();
  assert.ok(
    lastCount.x + lastCount.width >
      progressBounds.x + progressBounds.width - 16,
    'Desktop progress uses the available strip width',
  );
  const income = page.locator('#pg-board-income');
  const cells = income.locator('[data-income-cities]');
  assert.equal(await cells.count(), 21);
  const rows = await cells.evaluateAll((nodes) =>
    nodes.map((node) => {
      const bounds = node.getBoundingClientRect();
      const terms = [...node.querySelectorAll('dt, dd')].map((term) => {
        const rectangle = term.getBoundingClientRect();
        return {
          left: rectangle.left,
          right: rectangle.right,
          middle: rectangle.top + rectangle.height / 2,
          font: Number.parseFloat(getComputedStyle(term).fontSize),
        };
      });
      return {
        cities: Number(node.dataset.incomeCities),
        x: bounds.x,
        width: bounds.width,
        top: bounds.top,
        bottom: bounds.bottom,
        terms,
      };
    }),
  );
  const table = await income.locator('.pg-income-table').boundingBox();
  for (const row of rows) {
    assert.ok(
      Math.abs(row.terms[0].middle - row.terms[1].middle) < 1,
      `Income tier ${row.cities} has a single horizontal line`,
    );
    for (const term of row.terms) {
      assert.ok(term.font >= 18, 'Income values keep their readable size');
      assert.ok(
        term.left >= row.x - 1 && term.right <= row.x + row.width + 1,
        `Income tier ${row.cities} fits its cell`,
      );
    }
  }
  assert.ok(Math.abs(rows[20].width - table.width) < 1);
  assert.ok(rows[20].top >= rows[19].bottom);
  assert.ok(
    Math.abs(
      (rows[20].terms[0].left + rows[20].terms[1].right) / 2 -
        (table.x + table.width / 2),
    ) < 1,
    '20+ is centered across both columns',
  );
  assert.ok(rows.slice(0, 10).every((row) => Math.abs(row.x - rows[0].x) < 1));
  assert.ok(
    rows.slice(10, 20).every((row) => Math.abs(row.x - rows[10].x) < 1),
  );
  assert.equal(await income.locator('.pg-income-tier--capability').count(), 1);
  await income.screenshot({ path: join(output, 'income-single-line.png') });
  report.screenshots.push('income-single-line.png');

  const representativeSteps = new Map();
  for (const [name, fixture] of Object.entries(fixtures))
    if (!representativeSteps.has(fixture.publicGame.step))
      representativeSteps.set(fixture.publicGame.step, { name, fixture });
  report.progressSteps = [];
  for (const { name, fixture } of representativeSteps.values()) {
    await page.evaluate((name) => window.setFixture(name, 'host'), name);
    await waitForRender(page);
    assert.equal(
      await page.locator('.pg-toolbar .pg-round b').innerText(),
      `第${fixture.publicGame.step}阶段`,
    );
    report.progressSteps.push(await verifyTrack(page, fixture.publicGame));
  }

  const savedName = Object.keys(fixtures).find(
    (name) =>
      fixtures[name].publicGame.phase === 'resources' &&
      fixtures[name].publicGame.latest != null,
  );
  assert.ok(savedName, 'Saved resources fixture proves the feedback layout');
  await page.evaluate((name) => window.setFixture(name, 'host'), savedName);
  await page.waitForTimeout(380);
  const stable = await page.evaluate(async () => {
    const geometry = () =>
      ['.pg-map-table', '.pg-board-companies', '.pg-game-progress'].map(
        (selector) => {
          const bounds = document
            .querySelector(selector)
            .getBoundingClientRect();
          return [bounds.x, bounds.y, bounds.width, bounds.height];
        },
      );
    const before = geometry();
    const frames = [];
    for (let revision = 2; revision <= 4; revision++) {
      window.advanceFeedback(revision);
      const started = performance.now();
      do {
        await new Promise(requestAnimationFrame);
        frames.push({
          boxes: geometry(),
          badges: document.querySelectorAll('.pg-saved-fx__badge').length,
          latest: document.querySelectorAll('.pg-board-latest').length,
        });
      } while (performance.now() - started < 100);
    }
    return { before, frames };
  });
  assert.ok(stable.frames.length >= 6);
  for (const frame of stable.frames) {
    assert.equal(frame.badges, 0, 'The duplicate bottom message is absent');
    assert.equal(frame.latest, 1, 'The white latest saved message remains');
    frame.boxes.forEach((box, index) =>
      box.forEach((value, field) =>
        assert.ok(
          Math.abs(value - stable.before[index][field]) < 0.5,
          'Successive saved effects do not displace the map or player drawer',
        ),
      ),
    );
  }
  assert.equal(await page.locator('[data-power-grid-effect]').count(), 1);
  assert.deepEqual(await commands(page), []);
  report.savedGeometryFrames = stable.frames.length;

  const sound = page.locator('[data-power-grid-sound]');
  assert.equal(await sound.locator('svg').count(), 1);
  assert.equal((await sound.innerText()).trim(), '');
  const centering = await sound.evaluate((node) => {
    const button = node.getBoundingClientRect();
    const icon = node.querySelector('svg');
    const painted = icon.getBBox();
    const transform = icon.getScreenCTM();
    const center = new DOMPoint(
      painted.x + painted.width / 2,
      painted.y + painted.height / 2,
    ).matrixTransform(transform);
    return {
      dx: center.x - (button.left + button.width / 2),
      dy: center.y - (button.top + button.height / 2),
      width: button.width,
      height: button.height,
    };
  });
  assert.ok(Math.abs(centering.dx) <= 2 && Math.abs(centering.dy) <= 2);
  assert.ok(centering.width >= 44 && centering.height >= 44);
  await sound.hover();
  assert.equal(
    await sound.evaluate((node) => getComputedStyle(node, '::after').opacity),
    '1',
  );
  await page.mouse.move(0, 0);
  await page.keyboard.press('Tab');
  await sound.focus();
  assert.equal(
    await sound.evaluate((node) => getComputedStyle(node, '::after').opacity),
    '1',
    'Keyboard focus exposes the icon tooltip',
  );
  const pressed = await sound.getAttribute('aria-pressed');
  const muteBefore = await page.evaluate(() =>
    localStorage.getItem('tablemax-sound-muted'),
  );
  await sound.click();
  assert.equal(
    await sound.getAttribute('aria-pressed'),
    String(pressed !== 'true'),
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem('tablemax-sound-muted')),
    String(pressed === 'true'),
  );
  await sound.click();
  assert.equal(await sound.getAttribute('aria-pressed'), pressed);
  assert.deepEqual(await commands(page), []);
  await page.evaluate((value) => {
    if (value == null) localStorage.removeItem('tablemax-sound-muted');
    else localStorage.setItem('tablemax-sound-muted', value);
  }, muteBefore);
  report.soundIconCenter = centering;

  await page.evaluate(() => window.setFixture('offer', 'host'));
  await page.waitForTimeout(360);
  report.marketScrollbar = await page
    .locator('#pg-board-market .pg-board-drawer-content')
    .evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        colors: style.scrollbarColor,
        thumb: getComputedStyle(node, '::-webkit-scrollbar-thumb')
          .backgroundColor,
        track: getComputedStyle(node, '::-webkit-scrollbar-track')
          .backgroundColor,
        width: style.scrollbarWidth,
        scrollable: node.scrollHeight > node.clientHeight,
      };
    });
  assert.notEqual(report.marketScrollbar.thumb, report.marketScrollbar.track);
  assert.equal(report.marketScrollbar.width, 'auto');
  assert.equal(
    await page
      .locator('#pg-board-market .pg-board-drawer-content')
      .evaluate((node) => getComputedStyle(node, '::-webkit-scrollbar').width),
    '10px',
    'Chromium uses the round native scrollbar without standard-property overrides',
  );
  assert.ok(
    report.marketScrollbar.scrollable,
    'The market exercises its scrollbar',
  );
  assert.deepEqual(await commands(page), []);

  const candidates = Object.entries(fixtures).flatMap(([name, fixture]) =>
    fixture.game.phase !== 'resources'
      ? []
      : fixture.actions
          .filter(
            (action) => action.type === 'buy-resource' && action.quantity > 1,
          )
          .map((action) => ({ name, fixture, action })),
  );
  assert.ok(
    candidates.length,
    'Rules-generated fixtures include a legal batch purchase',
  );
  candidates.sort((left, right) => {
    const crossesTier = ({ fixture, action }) =>
      purchaseCost(
        action.resource,
        fixture.game.resources[action.resource],
        1,
      ) *
        action.quantity !==
      purchaseCost(
        action.resource,
        fixture.game.resources[action.resource],
        action.quantity,
      );
    return (
      Number(crossesTier(right)) - Number(crossesTier(left)) ||
      left.action.quantity - right.action.quantity
    );
  });
  const { name, fixture, action } = candidates[0];
  const { plantId, resource, quantity } = action;
  report.purchaseLayouts = [];
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate((name) => window.setFixture(name, 'player'), name);
    await waitForRender(page);
    const row = page.locator(
      `.pg-resource-purchase[data-plant-id="${plantId}"][data-resource="${resource}"]`,
    );
    const input = row.getByRole('spinbutton');
    const decrement = row.locator('.pg-resource-quantity button').first();
    const increment = row.locator('.pg-resource-quantity button').last();
    const confirm = row.locator('[data-resource-purchase-confirm]');
    await row.waitFor();
    await input.fill('1');
    await increment.click();
    assert.equal(await input.inputValue(), '2');
    assert.equal(
      await confirm.locator('strong').innerText(),
      `${purchaseCost(resource, fixture.game.resources[resource], 2)}电币`,
    );
    await decrement.click();
    assert.equal(await input.inputValue(), '1');
    await input.fill(String(quantity));
    const expectedCost = purchaseCost(
      resource,
      fixture.game.resources[resource],
      quantity,
    );
    assert.equal(
      await confirm.locator('strong').innerText(),
      `${expectedCost}电币`,
    );
    assert.deepEqual(await commands(page), []);
    await page.evaluate(() => window.syncFixture());
    await waitForRender(page);
    assert.equal(await input.inputValue(), String(quantity));
    assert.deepEqual(await commands(page), []);
    const sizes = await row.locator('button, input').evaluateAll((nodes) =>
      nodes.map((node) => {
        const bounds = node.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      }),
    );
    assert.ok(sizes.every((size) => size.width >= 44 && size.height >= 44));
    assert.ok(
      await row.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
      'Quantity controls fit the phone width without clipping',
    );
    const progress = page.locator('.pg-game-progress');
    if ((await progress.getAttribute('open')) === null)
      await progress.locator('summary').click();
    assert.equal(await progress.getAttribute('open'), '');
    await verifyTrack(page, fixture.game);
    const browsing = await progress
      .locator('.pg-progress-scroll')
      .evaluate((node) => {
        node.scrollLeft = node.scrollWidth;
        const bounds = node.getBoundingClientRect();
        const last = node
          .querySelector('[data-land-count]:last-child')
          .getBoundingClientRect();
        return {
          scrollLeft: node.scrollLeft,
          maximum: node.scrollWidth - node.clientWidth,
          finalVisible:
            last.left >= bounds.left - 1 && last.right <= bounds.right + 1,
        };
      });
    assert.ok(
      browsing.finalVisible,
      'Phone progress can show the last track position',
    );
    if (browsing.maximum > 1) assert.ok(browsing.scrollLeft > 1);
    assert.deepEqual(await commands(page), []);
    await progress.locator('summary').click();
    await input.scrollIntoViewIfNeeded();
    const screenshot = `purchase-quantity-${viewport.width}.png`;
    await page.screenshot({ path: join(output, screenshot) });
    report.screenshots.push(screenshot);
    await confirm.click();
    const submitted = await commands(page);
    assert.equal(
      submitted.length,
      1,
      'One confirmation submits one saved purchase intent',
    );
    assert.deepEqual(submitted[0].action, action);
    report.purchaseLayouts.push({
      ...viewport,
      fixture: name,
      plantId,
      resource,
      quantity,
      totalPrice: expectedCost,
      browsing,
    });
  }
  report.actions.push(
    'Single-line income tiers and full-width 20+; classic city progress and Step labels; stable saved-feedback geometry without duplicate message; centered accessible sound icon and themed scrollbars; legal batch quantity quotes preserve drafts and submit exactly one command across four phone layouts',
  );
}
