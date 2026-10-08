import assert from 'node:assert/strict';

/** Production UI checks against the caller's legal, authorized rule fixtures. */
export async function verifyBoardFacts(page, fixtures, report) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.setFixture('regions', 'public'));
  await page.waitForTimeout(150);
  const cards = page.locator('.pg-company-card');
  assert.deepEqual(
    await cards.evaluateAll((nodes) =>
      nodes.map((node) => node.dataset.companySeat),
    ),
    fixtures.regions.publicGame.playerOrder,
  );
  for (const card of await cards.all()) {
    assert.equal(
      await card.locator('.pg-company-card-plants > div').count(),
      fixtures.regions.publicGame.plantLimit,
    );
    assert.equal(await card.locator('[data-company-resource]').count(), 4);
    assert.deepEqual(
      await card.locator('[data-company-resource]').allTextContents(),
      ['×0', '×0', '×0', '×0'],
    );
    assert.equal(
      await card.locator('.pg-company-rank').textContent(),
      await card.getAttribute('data-company-rank'),
    );
    assert.match(
      await card.locator('.pg-company-rank').getAttribute('aria-label'),
      /位次/,
    );
  }
  assert.equal(
    await page.getByText(/现金/).count(),
    0,
    'Public cards do not reveal cash',
  );
  await page.getByRole('button', { name: '收起玩家公司' }).click();
  const map = page.locator('.pg-map-panel[data-map-center]');
  for (const [dx, dy] of [
    [30, 0],
    [-30, 0],
    [0, 30],
    [0, -30],
  ]) {
    await map.getByRole('button', { name: '复位', exact: true }).click();
    await page.waitForTimeout(80);
    assert.equal(await map.getAttribute('data-map-zoom'), '1');
    const before = await map.getAttribute('data-map-center');
    const frame = await map.locator('.pg-map-frame').boundingBox();
    await page.mouse.move(
      frame.x + frame.width / 2,
      frame.y + frame.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      frame.x + frame.width / 2 + dx,
      frame.y + frame.height / 2 + dy,
      { steps: 4 },
    );
    await page.mouse.up();
    assert.notEqual(
      await map.getAttribute('data-map-center'),
      before,
      'Minimum zoom permits movement in both axes',
    );
    assert.equal(await map.getAttribute('data-map-follow'), 'false');
  }
  await map.getByRole('button', { name: '恢复跟随', exact: true }).click();
  assert.equal(await map.getAttribute('data-map-follow'), 'true');
  await page.evaluate(() => window.setFixture('crowded', 'host'));
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: '市场', exact: true }).click();
  await page.waitForTimeout(250);
  const chosen =
    fixtures.crowded.game.buildOptions[0]?.cityId ??
    fixtures.crowded.game.players[fixtures.crowded.game.actor].cities[0];
  await map.locator('select').selectOption(chosen);
  await page.waitForTimeout(100);
  const point = await map
    .locator(`[data-city="${chosen}"]`)
    .evaluate((node) => {
      const m = node.getScreenCTM();
      return { x: m.e, y: m.f };
    });
  const left = await page.locator('#pg-board-market').boundingBox();
  const bottom = await page.locator('.pg-board-companies').boundingBox();
  assert.ok(
    point.x > left.x + left.width && point.y < bottom.y,
    'Selected city is outside open drawers',
  );
  await page.getByRole('button', { name: /城市详情$/ }).click();
  const cityDialog = page.getByRole('dialog', { name: /城市详情$/ });
  await cityDialog.getByLabel('城市位置费用图例', { exact: true }).waitFor();
  await cityDialog
    .getByRole('button', { name: '关闭面板', exact: true })
    .click();
  await page.getByRole('button', { name: '关闭市场边栏' }).click();
  await page.evaluate(() => window.advanceFeedback(2, 'build'));
  await page.waitForTimeout(450);
  assert.equal(
    await map.locator('select').inputValue(),
    fixtures.crowded.publicGame.latest.cityId,
  );
  const savedCenter = await map.getAttribute('data-map-center');
  await page.evaluate(() => window.syncFixture());
  await page.waitForTimeout(80);
  assert.equal(
    await map.getAttribute('data-map-center'),
    savedCenter,
    'Ordinary sync preserves saved focus',
  );
  const frame = await map.locator('.pg-map-frame').boundingBox();
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 90);
  await page.mouse.down();
  await page.mouse.move(frame.x + frame.width / 2 - 30, frame.y + 110, {
    steps: 4,
  });
  await page.mouse.up();
  const manual = await map.getAttribute('data-map-center');
  await page.evaluate(() => window.advanceFeedback(4, 'build'));
  await page.waitForTimeout(100);
  assert.equal(
    await map.getAttribute('data-map-center'),
    manual,
    'New saved construction respects paused following',
  );
  await map.getByRole('button', { name: '恢复跟随', exact: true }).click();
  await page.waitForTimeout(450);
  await page.evaluate(() => window.restoreFixture());
  await page.waitForTimeout(100);
  assert.equal(
    await map
      .locator('svg.pg-map')
      .evaluate((node) => node.getAnimations().length),
    0,
    'Restored branches do not replay camera animation',
  );
  await page.evaluate(() => window.setFixture('offer', 'host'));
  await page.waitForTimeout(100);
  const identities = (nodes) =>
    Object.fromEntries(
      nodes.map((node) => [
        node.dataset.companySeat,
        {
          color: node.style.getPropertyValue('--pg-player-color'),
          avatar: node.querySelector('img').src,
        },
      ]),
    );
  const identity = await cards.evaluateAll(identities);
  await page.evaluate(() => window.changeSavedFixture('first-order', 2));
  await page.waitForTimeout(60);
  assert.deepEqual(
    await cards.evaluateAll((nodes) =>
      nodes.map((node) => node.dataset.companySeat),
    ),
    fixtures['first-order'].publicGame.playerOrder,
  );
  const orderChanged =
    fixtures.offer.publicGame.playerOrder.join() !==
    fixtures['first-order'].publicGame.playerOrder.join();
  assert.equal(
    await cards.evaluateAll((nodes) =>
      nodes.some((node) => node.getAnimations().length > 0),
    ),
    orderChanged,
    'Only a saved rank change animates',
  );
  assert.deepEqual(
    await cards.evaluateAll(identities),
    identity,
    'Identity and color remain stable',
  );
  await page.waitForTimeout(600);
  await page.evaluate(() => window.syncFixture());
  assert.equal(
    await cards.evaluateAll((nodes) =>
      nodes.reduce((n, node) => n + node.getAnimations().length, 0),
    ),
    0,
  );
  await page.evaluate(() => window.setFixture('replace', 'host'));
  await page.waitForTimeout(100);
  const replacement = fixtures.replace.publicGame.replacement;
  const owner = page.locator(
    `.pg-company-card[data-company-seat="${replacement.buyer}"]`,
  );
  assert.equal(
    await owner.locator('.pg-company-card-plants > div').count(),
    fixtures.replace.publicGame.plantLimit,
  );
  assert.equal(
    await owner.locator('.pg-plant-art').count(),
    fixtures.replace.publicGame.players[replacement.buyer].plants.length,
  );
  assert.equal(
    await owner
      .locator('.pg-company-pending [data-plant-summary]')
      .getAttribute('data-plant-summary'),
    String(replacement.newPlantId),
  );
  assert.equal(
    await owner.locator('[data-plant-summary]').count(),
    fixtures.replace.publicGame.players[replacement.buyer].plants.length,
    'Temporary replacement plant is not dropped',
  );
  if (fixtures.salvage) {
    await page.evaluate(() => window.setFixture('salvage', 'host'));
    await page.waitForTimeout(100);
    assert.equal(
      (await page.locator('.pg-company-salvage').count()) > 0,
      Object.values(fixtures.salvage.publicGame.replacement.salvage).some(
        (amount) => amount > 0,
      ),
      'Only actual unplaced fuel has a separate stock summary',
    );
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.setFixture('offer', 'host'));
  await page.waitForTimeout(60);
  await page.evaluate(() => window.changeSavedFixture('first-order', 2));
  await page.waitForTimeout(60);
  assert.equal(
    await cards.evaluateAll((nodes) =>
      nodes.reduce((n, node) => n + node.getAnimations().length, 0),
    ),
    0,
    'Reduced motion disables rank animation',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.setFixture('offer', 'host'));
  await page.waitForTimeout(60);
  await page.evaluate(() => window.setTestMode());
  await page.evaluate(() => window.changeSavedFixture('first-order', 2));
  await page.waitForTimeout(60);
  assert.equal(
    await cards.evaluateAll((nodes) =>
      nodes.reduce((n, node) => n + node.getAnimations().length, 0),
    ),
    0,
    'Test mode disables rank animation',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.setFixture('crowded', 'player'));
  await page.waitForTimeout(80);
  await page
    .locator('.pg-page-nav')
    .getByRole('button', { name: '地图', exact: true })
    .click();
  const phoneMap = page.locator('.pg-map-panel:visible');
  await phoneMap.locator(`[data-city="${chosen}"]`).press('Enter');
  await page.waitForTimeout(80);
  const phoneCenter = await phoneMap.getAttribute('data-map-center');
  await page.evaluate(() => window.advanceFeedback(7, 'build'));
  await page.waitForTimeout(100);
  assert.equal(
    await phoneMap.getAttribute('data-map-center'),
    phoneCenter,
    'Other saved construction never moves phone map',
  );
  await phoneMap.getByRole('button', { name: '复位', exact: true }).click();
  await page.waitForTimeout(80);
  const frameTouch = await phoneMap.locator('.pg-map-frame').boundingBox();
  const x = frameTouch.x + frameTouch.width / 2;
  const y = frameTouch.y + frameTouch.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touches = (distance) => [
    { x: x - distance, y, id: 0 },
    { x: x + distance, y, id: 1 },
  ];
  const beforePinch = Number(await phoneMap.getAttribute('data-map-zoom'));
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: touches(30),
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: touches(55),
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.waitForTimeout(80);
  assert.ok(
    Number(await phoneMap.getAttribute('data-map-zoom')) > beforePinch,
    'Real two-touch pinch zooms map',
  );
  assert.equal(
    await page
      .locator('.pg-page-nav [aria-current="page"]')
      .getAttribute('aria-label'),
    '地图',
    'Pinch never switches phone page',
  );
  assert.equal(await phoneMap.getAttribute('data-map-follow'), 'false');
  await cdp.detach();
  report.actions.push(
    'Phone ignores other saved cities; actual two-touch pinch changes camera and preserves page',
  );
  assert.equal((await page.evaluate(() => window.__commands)).length, 0);
  report.actions.push(
    'Minimum camera moves four ways; safe saved focus, manual hold, follow recovery and branch restoration',
  );
  report.actions.push(
    'Stable ranked cards animate only saved changes; four slots/resources, replacement overflow, salvage and public privacy',
  );
}
