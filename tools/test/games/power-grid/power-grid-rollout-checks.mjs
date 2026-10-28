import assert from 'node:assert/strict';
import { join } from 'node:path';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';

// Current host/player source matrix; old release-specific checks remain separate.
export async function verifyRollout(
  page,
  fixtures,
  report,
  output,
  choosePhoneCity,
  detailsOnly = false,
) {
  const settle = () => page.waitForTimeout(180);
  const shot = async (name) => {
    await captureBrowserScreenshot(page, {
      path: join(output, name + '.png'),
      fullPage: true,
    });
    report.screenshots.push(name + '.png');
  };
  const seats = fixtures.regions.game.seatOrder.length;
  if (seats === 2) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => window.setFixture('replace', 'host'));
    await settle();
    const replacement = fixtures.replace.game.replacement;
    const owner = fixtures.replace.game.actor;
    assert.equal(
      fixtures.replace.game.players[owner].plants.length,
      5,
      'Legal two-player fifth plant fixture',
    );
    await page
      .locator(`.pg-company-overview [data-company-seat="${owner}"]`)
      .getByRole('button')
      .first()
      .click();
    const detail = page.locator(`dialog [data-inspector-seat="${owner}"]`);
    assert.equal(await detail.locator('[data-inspector-plant]').count(), 4);
    assert.equal(
      await detail
        .locator(`[data-inspector-pending-plant="${replacement.newPlantId}"]`)
        .count(),
      1,
    );
    await detail
      .locator('[data-inspector-pending-plant]')
      .scrollIntoViewIfNeeded();
    await shot('H-two-player-fifth-plant');
    await page.keyboard.press('Escape');
    report.actions.push(
      'H: legal fifth plant plus four retained plants reachable in detail',
    );
  }
  for (const [layout, width, height, role] of detailsOnly
    ? []
    : [
        ['H', 1280, 720, 'host'],
        ['P', 390, 844, 'player'],
        ['L', 1280, 720, 'player'],
      ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate((wide) => {
      document.documentElement.dataset.playerDisplay = wide
        ? 'wide'
        : 'portrait';
    }, layout === 'L');
    for (const name of [
      'regions',
      'offer',
      'auction',
      'replace',
      'salvage',
      'resources',
      'building',
      'powering',
      'mixed-fuel',
      'ended',
    ]) {
      if (!fixtures[name]) {
        report.layouts.push({ layout, name, status: 'not-generated' });
        continue;
      }
      await page.evaluate(({ name, role }) => window.setFixture(name, role), {
        name,
        role,
      });
      await settle();
      assert.equal(await page.locator('.pg-screen').first().isVisible(), true);
      const geometry = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        root: document
          .querySelector('.pg-screen')
          .getBoundingClientRect()
          .toJSON(),
      }));
      assert(
        geometry.scrollWidth <= width + 1,
        `${layout}/${name} horizontal document overflow`,
      );
      assert.deepEqual(
        await page.evaluate(() => window.__commands),
        [],
        'Rendering cannot submit',
      );
      if (role === 'host' && name !== 'ended') {
        assert.equal(
          await page.locator('[data-company-cash]').count(),
          name === 'ended' ? fixtures[name].publicGame.seatOrder.length : 0,
        );
      } else if (name !== 'ended') {
        const tabs = page.locator('.pg-page-nav button');
        assert.equal(await tabs.count(), 4);
        {
          for (let i = 0; i < 4; i++) {
            await tabs.nth(i).click();
            assert.equal(
              await page.locator('.pg-phone-page:not([hidden])').count(),
              1,
            );
            const hidden = await page
              .locator('.pg-phone-page[hidden]')
              .evaluateAll((nodes) => nodes.every((node) => node.inert));
            assert(hidden, 'Inactive pages are inert');
          }
          await tabs.first().click();
        }
      }
      await shot(`${layout}-${name}`);
      report.layouts.push({ layout, name, status: 'passed', geometry });
    }
    if (role === 'player') {
      await page.evaluate(() => window.setFixture('building', 'player'));
      await settle();
      const select = page.locator('.pg-build-controls select');
      const city = fixtures.building.game.buildOptions[0]?.cityId;
      assert(city, 'Legal building option exists');
      await choosePhoneCity(page, city);
      await settle();
      const before = await select.inputValue();
      await page.setViewportSize({
        width: layout === 'P' ? 430 : 1440,
        height: layout === 'P' ? 932 : 900,
      });
      await settle();
      assert.equal(
        await select.inputValue(),
        before,
        'Resize preserves city draft',
      );
      assert.deepEqual(
        await page.evaluate(() => window.__commands),
        [],
        'Resize and selection do not submit',
      );
      const map = page
        .locator('.pg-phone-page:not([hidden]) .pg-map-panel')
        .first();
      const beforeZoom = await map.getAttribute('data-map-zoom');
      await page
        .getByRole('button', { name: '放大地图', exact: true })
        .first()
        .click();
      const afterZoom = await map.getAttribute('data-map-zoom');
      assert.notEqual(afterZoom, beforeZoom);
      await page.locator('.pg-page-nav button').nth(1).click();
      await page.locator('.pg-page-nav button').first().click();
      assert.equal(
        await map.getAttribute('data-map-zoom'),
        afterZoom,
        'Page changes preserve map camera',
      );
      assert.equal(
        await select.inputValue(),
        before,
        'Page changes preserve selected city',
      );
      await page.locator('.pg-build-preview .pg-primary').click();
      assert.deepEqual(
        (await page.evaluate(() => window.__commands)).at(-1).action,
        { type: 'build', cityId: city },
      );
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.setFixture('offer', 'player'));
      await settle();
      const offers = fixtures.offer.actions.filter(
        (action) => action.type === 'offer',
      );
      const input = page.getByRole('spinbutton', { name: '报价金额' });
      await input.fill('');
      assert(await page.locator('.pg-offer-confirm .pg-primary').isDisabled());
      await page.getByRole('button', { name: '增加报价', exact: true }).click();
      const amount = Number(await input.inputValue());
      assert(offers.some((action) => action.amount === amount));
      await page.locator('.pg-offer-confirm .pg-primary').click();
      const commands = await page.evaluate(() => window.__commands);
      assert.equal(commands.length, 1);
      assert.equal(commands[0].action.amount, amount);
      report.actions.push(
        `${layout}: four pages inert, city draft retained, legal recovered bid submitted once`,
      );
      await page.evaluate(() => window.setFixture('resources', 'player'));
      await settle();
      await page.locator('.pg-page-nav button').nth(1).click();
      const prices = page.locator(
        '.pg-phone-page:not([hidden]) .pg-price-lane',
      );
      assert.equal(await prices.count(), 4);
      assert.equal(
        await prices.locator('[data-price]').count(),
        36,
        'Full resource price ladder retained',
      );
      await prices.locator('[data-price="16"]').scrollIntoViewIfNeeded();
      assert(await prices.locator('[data-price="16"]').isVisible());
      assert(fixtures['mixed-fuel'], 'Legal mixed-fuel fixture generated');
      await page.evaluate(() => window.setFixture('mixed-fuel', 'player'));
      await settle();
      const options = page.locator('.pg-run-options').first();
      await options.locator('summary').click();
      assert((await options.locator('button').count()) > 1);
      await options.locator('button').first().click();
      const chosen = (await page.evaluate(() => window.__commands)).at(
        -1,
      ).action;
      assert(
        fixtures['mixed-fuel'].actions.some(
          (action) => JSON.stringify(action) === JSON.stringify(chosen),
        ),
        'Mixed fuel recipe is authorized',
      );
      report.actions.push(
        `${layout}: full price ladder and legal mixed-fuel recipe reachable`,
      );
    }
  }
  for (const [width, height, display] of [
    [390, 844, 'portrait'],
    [1280, 720, 'wide'],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate((display) => {
      document.documentElement.dataset.playerDisplay = display;
      window.setFixture('salvage', 'player');
    }, display);
    await settle();
    const fuel = page.locator('.pg-salvage');
    assert((await fuel.count()) > 0, 'Pending salvage is displayed');
    const action = fuel.getByRole('button').first();
    await action.click();
    const sent = (await page.evaluate(() => window.__commands)).at(-1).action;
    assert(
      fixtures.salvage.actions.some(
        (a) => JSON.stringify(a) === JSON.stringify(sent),
      ),
      'Salvage control submits an authorized action',
    );
    await shot(`salvage-${width}`);
    report.actions.push(
      `${display}: pending salvage and legal storage/discard control`,
    );
  }
  for (const [width, height] of [
    [1280, 720],
    [3840, 2160],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.setFixture('crowded', 'host'));
    await settle();
    const cards = page.locator('.pg-company-overview [data-company-seat]');
    assert.equal(await cards.count(), seats);
    for (let i = 0; i < seats; i++) {
      const r = await cards.nth(i).boundingBox();
      assert(
        r &&
          r.x >= 0 &&
          r.y >= 0 &&
          r.x + r.width <= width + 1 &&
          r.y + r.height <= height + 1,
        'All six company summaries fit',
      );
      await cards.nth(i).getByRole('button').first().click();
      assert(await page.locator('dialog .pg-company-inspector').isVisible());
      await page.keyboard.press('Escape');
    }
    await shot(`H-${width}-six-companies`);
    report.actions.push(`H${width}: six summaries and each detail accessible`);
  }
}
