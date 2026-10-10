import { captureBrowserScreenshot } from '../../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { join } from 'node:path';

/** Observe actual browser transitions and read-only company detail, using legal fixtures. */
export async function verifyUiRefinement(page, fixtures, report, output) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.setFixture('offer', 'host'));
  await page.waitForTimeout(400);
  const market = page.locator('#pg-board-market');
  const entry = page.getByRole('button', { name: '市场', exact: true });
  const close = page.getByRole('button', { name: '关闭市场边栏' });
  const observe = (button) =>
    button.evaluate(async (node) => {
      node.click();
      const surface = document.querySelector('#pg-board-market');
      const frames = [];
      const start = performance.now();
      do {
        await new Promise(requestAnimationFrame);
        const style = getComputedStyle(surface);
        frames.push({
          hidden: surface.hidden,
          inert: surface.inert,
          opacity: Number(style.opacity),
          x: new DOMMatrixReadOnly(style.transform).m41,
        });
      } while (performance.now() - start < 340);
      return frames;
    });
  const closing = await observe(close);
  assert.ok(
    closing[0].inert && !closing[0].hidden,
    'Closing drawer immediately stops interaction but stays rendered',
  );
  assert.ok(
    new Set(closing.filter((f) => !f.hidden).map((f) => f.x)).size >= 4,
    'Closing drawer has intermediate positions',
  );
  assert.ok(
    closing.at(-1).hidden,
    'Closing drawer leaves layout after its transition',
  );
  const opening = await observe(entry);
  assert.ok(
    new Set(opening.map((f) => f.x)).size >= 4,
    'Opening drawer has intermediate positions',
  );
  assert.ok(!opening.at(-1).hidden && !opening.at(-1).inert);
  await close.evaluate((node) => node.click());
  await page.waitForTimeout(90);
  const reverse = await observe(entry);
  assert.ok(
    reverse[0].opacity < 0.98 && reverse.at(-1).opacity === 1,
    'Fast reversal continues from the in-flight pose',
  );
  assert.ok(
    !reverse.at(-1).hidden,
    'Cancelled closing timer does not hide the reopened drawer',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await close.click();
  assert.ok(await market.isHidden(), 'Reduced motion closes directly');
  await entry.click();
  assert.equal(await market.getAttribute('data-drawer-animate'), 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.setTestMode());
  await close.click();
  assert.ok(await market.isHidden(), 'Test mode closes directly');
  report.drawerFrames = {
    opening: opening.length,
    closing: closing.length,
    reversal: reverse.length,
  };

  await page.evaluate(() => window.setFixture('owned-resources', 'host'));
  await page.waitForTimeout(350);
  assert.equal(
    await page.getByRole('button', { name: '顺序', exact: true }).count(),
    0,
  );
  const game = fixtures['owned-resources'].publicGame;
  assert.equal(
    await page.locator('.pg-turn-heading').getAttribute('data-current-actor'),
    game.actor,
  );
  assert.ok(await page.locator('.pg-stage-label').isVisible());
  assert.ok(await page.locator('.pg-actor-name').isVisible());
  const inspect = page.getByRole('button', {
    name: '查看各家公司',
    exact: true,
  });
  assert.equal(await inspect.locator('svg').count(), 1);
  await inspect.click();
  const dialog = page.locator('dialog:has(.pg-company-inspector)');
  const cards = dialog.locator('.pg-inspector-company');
  assert.ok(
    (await dialog.boundingBox()).width > 1150,
    'Desktop company detail uses a larger surface',
  );
  assert.deepEqual(
    await cards.evaluateAll((nodes) => nodes.map((n) => n.dataset.companySeat)),
    game.playerOrder,
  );
  assert.equal(
    await dialog.locator('[data-company-cash]').count(),
    0,
    'Host public company detail never guesses cash',
  );
  for (const seat of game.playerOrder) {
    const player = game.players[seat];
    // Direct seat selector preserves the stable identity across server rank changes.
    const ownCard = dialog.locator(
      `.pg-inspector-company[data-company-seat="${seat}"]`,
    );
    assert.equal(
      await ownCard
        .locator('.pg-inspector-fuel [data-inspector-resource]')
        .count(),
      4,
    );
    assert.equal(
      await ownCard.locator('[data-inspector-plant]').count(),
      player.plants.length,
    );
    assert.equal(
      await ownCard.locator('.pg-inspector-network li').count(),
      player.cities.length,
    );
    for (const resource of ['coal', 'oil', 'garbage', 'uranium']) {
      const amount = player.plants.reduce(
        (sum, plant) => sum + plant.resources[resource],
        0,
      );
      assert.match(
        await ownCard
          .locator(`.pg-inspector-fuel [data-inspector-resource="${resource}"]`)
          .innerText(),
        new RegExp(`×\\s*${amount}$`),
      );
    }
  }
  await captureBrowserScreenshot(page, {
    path: join(output, 'company-inspector-1280.png'),
  });
  report.screenshots.push('company-inspector-1280.png');
  assert.equal((await page.evaluate(() => window.__commands)).length, 0);
  await page.keyboard.press('Escape');

  await page.evaluate(() => window.setFixture('replace', 'host'));
  await page.waitForTimeout(350);
  await inspect.click();
  const replacement = fixtures.replace.publicGame.replacement;
  const owner = dialog.locator(
    `.pg-inspector-company[data-company-seat="${replacement.buyer}"]`,
  );
  assert.equal(
    await owner
      .locator('[data-inspector-pending-plant]')
      .getAttribute('data-inspector-pending-plant'),
    String(replacement.newPlantId),
  );
  assert.equal(
    await owner.locator('.pg-plant-art').count(),
    fixtures.replace.publicGame.players[replacement.buyer].plants.length,
  );
  assert.equal((await page.evaluate(() => window.__commands)).length, 0);
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => window.setFixture('owned-resources', 'player'));
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: '公司', exact: true }).click();
  await page
    .locator(
      `.pg-phone-page:not([hidden]) .pg-company-card[data-company-seat="${fixtures['owned-resources'].game.self.seatId}"]`,
    )
    .click();
  assert.equal(
    await dialog.locator('[data-company-cash]').count(),
    1,
    'Phone detail shows only the authorized player cash',
  );
  assert.equal(
    await dialog
      .locator('.pg-inspector-company--self')
      .getAttribute('data-company-seat'),
    fixtures['owned-resources'].game.self.seatId,
  );
  assert.ok((await dialog.boundingBox()).width <= 320);
  assert.ok(
    await dialog
      .locator('.pg-inspector-company')
      .evaluateAll((nodes) =>
        nodes.every((n) => n.scrollWidth <= n.clientWidth + 1),
      ),
    'Phone company detail has no clipped horizontal content',
  );
  await captureBrowserScreenshot(page, {
    path: join(output, 'company-inspector-320.png'),
  });
  report.screenshots.push('company-inspector-320.png');
  assert.equal((await page.evaluate(() => window.__commands)).length, 0);
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.setFixture('ended', 'host'));
  await page.waitForTimeout(100);
  await inspect.click();
  assert.equal(
    await dialog.locator('[data-company-cash]').count(),
    fixtures.ended.publicGame.seatOrder.length,
    'End company detail shows the authorized final cash of all players',
  );
  assert.equal((await page.evaluate(() => window.__commands)).length, 0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.setFixture('regions', 'host'));
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: '收起玩家公司' }).click();
  await page.waitForTimeout(350);
  const map = page.locator('.pg-map-panel[data-map-center]');
  await map.getByRole('button', { name: '复位', exact: true }).click();
  await page.waitForTimeout(150);
  const priceSize = () =>
    map
      .locator('.pg-map-routes text')
      .first()
      .evaluate(
        (n) => Number(n.getAttribute('font-size')) * n.getScreenCTM().a,
      );
  const before = await priceSize();
  const zoomBefore = Number(await map.getAttribute('data-map-zoom'));
  await map.getByRole('button', { name: '放大地图' }).click();
  await map.getByRole('button', { name: '放大地图' }).click();
  await page.waitForTimeout(350);
  const after = await priceSize();
  const zoomAfter = Number(await map.getAttribute('data-map-zoom'));
  assert.ok(
    after > before && after / before < zoomAfter / zoomBefore,
    'Route prices grow with zoom more slowly than terrain',
  );
  report.routePriceGrowth = {
    beforePx: before,
    afterPx: after,
    zoomBefore,
    zoomAfter,
  };
  await captureBrowserScreenshot(page, {
    path: join(output, 'map-price-zoom.png'),
  });
  report.screenshots.push('map-price-zoom.png');
  await page.evaluate(() => window.setFixture('powering', 'host'));
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: '收起玩家公司' }).click();
  await page.waitForTimeout(350);
  const guide = page.locator('#pg-board-income');
  assert.ok(await guide.locator('[data-income-cities="20"]').isVisible());
  await captureBrowserScreenshot(page, {
    path: join(output, 'income-full-1280.png'),
  });
  report.screenshots.push('income-full-1280.png');
  report.actions.push(
    'Open/close intermediate frames, quick reversal, reduced motion and test mode; larger read-only company detail and authorized cash; sublinear route price growth',
  );
}
