import assert from 'node:assert/strict';
import { join } from 'node:path';
export async function verifyUiPolish(page, fixtures, report, output) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.setFixture('offer', 'host'));
  await page.waitForTimeout(400);
  const board = page.locator('.pg-map-table'),
    map = page.locator('.pg-map-panel[data-map-center]');
  const market = page.locator('#pg-board-market');
  assert.equal(await board.getAttribute('data-market-width'), 'narrow');
  await page.getByRole('button', { name: '关闭市场边栏' }).click();
  const entry = page.getByRole('button', { name: '市场', exact: true });
  assert.equal(await entry.locator('svg').count(), 1);
  await entry.hover();
  assert.equal(
    await entry.evaluate((n) => getComputedStyle(n, '::after').opacity),
    '1',
  );
  await entry.click();
  await page.getByRole('button', { name: '展开为宽市场' }).click();
  await page.waitForTimeout(300);
  const boxes = await market
    .locator('.pg-market-row')
    .first()
    .locator('.pg-plant-card')
    .evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width };
      }),
    );
  assert.equal(boxes.length, 4);
  assert.ok(
    boxes.every((b) => Math.abs(b.y - boxes[0].y) < 1),
    'Wide market puts four plants on one row',
  );
  await page.evaluate(() => window.syncFixture());
  assert.equal(await board.getAttribute('data-market-width'), 'wide');
  await page.getByRole('button', { name: '关闭市场边栏' }).click();
  await market.waitFor({ state: 'hidden' });
  assert.ok(await market.isHidden());
  assert.ok(await page.getByRole('button', { name: '收窄市场' }).isHidden());
  await entry.click();
  assert.equal(await board.getAttribute('data-market-width'), 'wide');
  await page.screenshot({ path: join(output, 'wide-market-1280.png') });
  report.screenshots.push('wide-market-1280.png');
  await page.evaluate(() => window.setFixture('regions', 'host'));
  await page.waitForTimeout(400);
  await entry.click();
  await page.getByRole('button', { name: '展开为宽市场' }).click();
  // The leftmost legal city exercises hard image edges plus temporary drawer relief.
  const options = await map
    .locator('select option')
    .evaluateAll((nodes) => nodes.map((n) => n.value).filter(Boolean));
  const edgeCity = await map
    .locator('[data-city]')
    .evaluateAll(
      (nodes, options) =>
        nodes
          .filter((n) => options.includes(n.dataset.city))
          .sort(
            (a, b) =>
              Number(a.getAttribute('transform').match(/[\d.]+/g)[0]) -
              Number(b.getAttribute('transform').match(/[\d.]+/g)[0]),
          )[0].dataset.city,
      options,
    );
  await map.locator('select').selectOption(edgeCity);
  await page.waitForTimeout(550);
  const visibility = await map
    .locator(`[data-city="${edgeCity}"]`)
    .evaluate((node) => {
      const m = node.getScreenCTM(),
        frame = node.closest('.pg-map-frame').getBoundingClientRect();
      return {
        x: m.e,
        y: m.f,
        left: frame.left,
        right: frame.right,
        top: frame.top,
        bottom: frame.bottom,
      };
    });
  assert.ok(
    visibility.x > visibility.left &&
      visibility.x < visibility.right &&
      visibility.y > visibility.top &&
      visibility.y < visibility.bottom,
  );
  assert.ok(
    Number(await board.getAttribute('data-map-avoidance')) > 0,
    'Edge target temporarily reduces obstructing drawers',
  );
  if (await entry.isVisible()) await entry.click();
  await page.getByRole('button', { name: '展开为宽市场' }).click();
  await page.waitForTimeout(350);
  assert.equal(await board.getAttribute('data-market-width'), 'wide');
  assert.equal(
    await board.getAttribute('data-map-avoidance'),
    '0',
    'Manual width wins over temporary relief',
  );
  const center = await map.getAttribute('data-map-center');
  const playersTitle = board.locator('h2').filter({ hasText: '玩家公司' });
  if (await playersTitle.isVisible()) await playersTitle.click();
  else await page.locator('.pg-toolbar .pg-brand').click();
  await page.waitForTimeout(350);
  assert.equal(await map.locator('select').inputValue(), '');
  assert.equal(await board.getAttribute('data-market-width'), 'wide');
  assert.equal(
    await map.getAttribute('data-map-center'),
    center,
    'External deselection restores panels without recentering',
  );
  await page.getByRole('button', { name: '关闭市场边栏' }).click();
  if (await page.getByRole('button', { name: '收起玩家公司' }).isVisible())
    await page.getByRole('button', { name: '收起玩家公司' }).click();
  await map.getByRole('button', { name: '复位', exact: true }).click();
  await page.waitForTimeout(400);
  await map.locator('select').selectOption(edgeCity);
  await page.waitForTimeout(400);
  const selectedNode = map.locator(`[data-city="${edgeCity}"]`);
  assert.equal(await selectedNode.locator(':scope > rect').count(), 1);
  assert.equal(
    await selectedNode.locator('path[d="M-20 0H20M0-7V7"]').count(),
    0,
    'Empty city has no cross',
  );
  assert.equal(
    await selectedNode
      .locator('text')
      .first()
      .evaluate((n) => getComputedStyle(n).userSelect),
    'none',
  );
  await selectedNode.focus();
  await selectedNode.press('Enter');
  assert.equal(
    await map.locator('select').inputValue(),
    '',
    'Repeated selection clears',
  );
  await map.locator('select').selectOption(edgeCity);
  await page.keyboard.press('Escape');
  assert.equal(await map.locator('select').inputValue(), '', 'Escape clears');
  await map.getByRole('button', { name: '复位', exact: true }).click();
  await page.waitForTimeout(100);
  const frame = await map.locator('.pg-map-frame').boundingBox();
  const anchor = {
    x: frame.x + frame.width / 2,
    y: frame.y + frame.height / 2,
  };
  const worldAt = () =>
    map.locator('svg.pg-map').evaluate((node, p) => {
      const point = node.createSVGPoint();
      point.x = p.x;
      point.y = p.y;
      const q = point.matrixTransform(node.getScreenCTM().inverse());
      return { x: q.x, y: q.y };
    }, anchor);
  const before = await worldAt();
  await page.mouse.move(anchor.x, anchor.y);
  const samplesPromise = page.evaluate(
    () =>
      new Promise((resolve) => {
        const samples = [];
        let last = performance.now();
        const tick = () => {
          samples.push({
            zoom: Number(
              document.querySelector('[data-map-zoom]').dataset.mapZoom,
            ),
            gap: performance.now() - last,
          });
          last = performance.now();
          if (samples.length < 35) requestAnimationFrame(tick);
          else resolve(samples);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.mouse.wheel(0, -120);
  await page.mouse.wheel(0, -120);
  await page.mouse.wheel(0, -120);
  const samples = await samplesPromise;
  await page.waitForTimeout(250);
  assert.ok(Number(await map.getAttribute('data-map-zoom')) > 1);
  assert.equal(await map.getAttribute('data-map-follow'), 'false');
  assert.ok(
    new Set(samples.map((s) => s.zoom)).size >= 4,
    'Wheel produces intermediate frames, not discrete jumps',
  );
  const after = await worldAt();
  assert.ok(
    Math.hypot(after.x - before.x, after.y - before.y) < 1,
    'Wheel retains pointer world anchor',
  );
  report.wheelFrames = {
    samples: samples.length,
    distinctZooms: new Set(samples.map((s) => s.zoom)).size,
    p95GapMs: samples.map((s) => s.gap).sort((a, b) => a - b)[
      Math.floor(samples.length * 0.95)
    ],
  };
  for (const [dx, dy] of [
    [2000, 0],
    [-2000, 0],
    [0, 2000],
    [0, -2000],
  ]) {
    await map.getByRole('button', { name: '复位', exact: true }).click();
    await page.waitForTimeout(100);
    await page.mouse.move(anchor.x, anchor.y);
    await page.mouse.down();
    await page.mouse.move(anchor.x + dx, anchor.y + dy, { steps: 4 });
    await page.mouse.up();
    const bounds = await map.locator('svg.pg-map').evaluate((node) => {
      const image = node.getBoundingClientRect(),
        frame = node.closest('.pg-map-frame').getBoundingClientRect();
      return {
        left: image.left - frame.left,
        top: image.top - frame.top,
        right: image.right - frame.right,
        bottom: image.bottom - frame.bottom,
      };
    });
    assert.ok(
      bounds.left <= 1 &&
        bounds.top <= 1 &&
        bounds.right >= -1 &&
        bounds.bottom >= -1,
      'Extreme pan never exposes blank frame',
    );
  }
  await page.evaluate(() => window.setFixture('powering', 'host'));
  await page.waitForTimeout(400);
  const guide = page.locator('#pg-board-income');
  assert.equal(
    await guide.locator('.pg-income-markers,.pg-income-scroll-hint').count(),
    0,
  );
  assert.equal(await guide.locator('.pg-income-tier--capability').count(), 1);
  const tiers = await guide
    .locator('[data-income-cities]')
    .evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return {
          cities: Number(n.dataset.incomeCities),
          x: r.x,
          y: r.y,
          width: r.width,
        };
      }),
    );
  assert.equal(tiers.length, 21);
  assert.ok(tiers.slice(0, 10).every((t) => t.x === tiers[0].x));
  assert.ok(tiers.slice(10, 20).every((t) => t.x === tiers[10].x));
  assert.ok(tiers[9].y > tiers[0].y && tiers[10].y === tiers[0].y);
  assert.equal(tiers[20].x, tiers[0].x);
  assert.ok(tiers[20].width > tiers[0].width + tiers[10].width);
  assert.ok(tiers[20].y > tiers[19].y);
  assert.equal(
    await guide
      .locator('[data-income-cities="20"]')
      .evaluate((n) => getComputedStyle(n).justifyContent),
    'center',
  );
  assert.ok(
    (await guide.boundingBox()).height < 660,
    'Income guide wraps its content',
  );
  await page.setViewportSize({ width: 854, height: 480 });
  await page.evaluate(() => window.setFixture('ended', 'host'));
  await page.waitForTimeout(100);
  assert.equal(
    await page
      .locator('.pg-results')
      .getByText(/^现金 /)
      .count(),
    fixtures.ended.game.seatOrder.length,
  );
  assert.ok(
    await page
      .locator('.pg-results')
      .getByText(/^现金 /)
      .first()
      .isVisible(),
    'End cash stays visible on short desktop',
  );
  await page.evaluate(() => window.setFixture('owned-resources', 'player'));
  await page.waitForTimeout(100);
  await page
    .locator('.pg-page-nav')
    .getByRole('button', { name: '公司', exact: true })
    .click();
  const own = page.locator(
    `.pg-company-card[data-company-seat="${fixtures['owned-resources'].game.self.seatId}"]`,
  );
  assert.equal(await page.locator('[data-company-cash]').count(), 1);
  assert.ok(await own.locator('[data-company-cash]').isVisible());
  assert.equal(
    await own.locator('.pg-plant-art').count(),
    fixtures['owned-resources'].game.players[
      fixtures['owned-resources'].game.self.seatId
    ].plants.length,
  );
  assert.equal((await page.evaluate(() => window.__commands)).length, 0);
  report.actions.push(
    'Icon tooltips; remembered narrow/wide/closed market; four plants per wide row; temporary edge-focus relief and external deselection',
    'Ordinary continuous wheel retains anchor; four hard image edges never expose blank frame',
    'Compact column-first income has one green tier; illustrated company cards keep authorized cash',
  );
}
