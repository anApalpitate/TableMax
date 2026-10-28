import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

/** Integration helper, invoked only by the existing source verifier. */
export async function verifyGameFrameSmoke({ page, item, url, output }) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url + '?frame-game=' + item.key);
  const iframe = page.locator('iframe');
  await iframe.waitFor();
  const child = await (await iframe.elementHandle()).contentFrame();
  await child.waitForFunction(() => window.fixtureSession?.view?.gameView);
  await child.locator('main').first().waitFor();
  await iframe.evaluate((element) => {
    element.dataset.smokeIdentity = 'same-frame';
  });
  await child.evaluate(() => {
    window.smokeRoot = document.querySelector('main');
    window.smokeDocument = document;
  });
  let draft = null;
  if (item.key === 'pokemon-encounters') {
    const targets = child.locator('button.card-slot:not(:disabled)');
    assert(
      (await targets.count()) > 0,
      'Held Pokemon fixture has selectable board positions',
    );
    await targets.first().click();
    assert.equal(
      await child.locator('button.card-slot[aria-pressed="true"]').count(),
      1,
    );
    draft = await child
      .locator('button.card-slot[aria-pressed="true"]')
      .getAttribute('data-slot');
  } else if (item.key === 'rummikub') {
    await child.locator('[data-own-rack] button[data-tile-id]').first().click();
    await child.getByRole('button', { name: '建立新组', exact: true }).click();
    draft = await child.evaluate(() =>
      sessionStorage.getItem('tablemax:rummikub:turn-draft'),
    );
    assert(draft);
  }
  assert.deepEqual(await child.evaluate(() => window.fixtureCommands), []);
  const screenshots = [];
  await mkdir(join(output, 'screenshots'), { recursive: true });
  const capture = async (suffix) => {
    const path = join(output, 'screenshots', item.id + '-' + suffix + '.png');
    await page.screenshot({ path, fullPage: true, animations: 'disabled' });
    screenshots.push(path);
  };
  await capture('portrait');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('.phone-orientation-guard[open]').waitFor();
  assert(await iframe.evaluate((element) => element.inert));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  assert(
    await page
      .locator('.phone-orientation-guard')
      .evaluate(
        (element) => element.open && document.activeElement === element,
      ),
  );
  assert.equal(await iframe.getAttribute('data-smoke-identity'), 'same-frame');
  assert(
    await child.evaluate(
      () =>
        window.smokeRoot === document.querySelector('main') &&
        window.smokeDocument === document,
    ),
  );
  assert.deepEqual(await child.evaluate(() => window.fixtureCommands), []);
  await capture('guard');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.phone-orientation-guard').waitFor({ state: 'detached' });
  assert.equal(await iframe.getAttribute('data-smoke-identity'), 'same-frame');
  assert(
    await child.evaluate(
      () =>
        window.smokeRoot === document.querySelector('main') &&
        window.smokeDocument === document,
    ),
  );
  if (item.key === 'pokemon-encounters')
    assert.equal(
      await child
        .locator('button.card-slot[aria-pressed="true"]')
        .getAttribute('data-slot'),
      draft,
    );
  if (item.key === 'rummikub')
    assert.equal(
      await child.evaluate(() =>
        sessionStorage.getItem('tablemax:rummikub:turn-draft'),
      ),
      draft,
    );
  assert.deepEqual(await child.evaluate(() => window.fixtureCommands), []);
  return {
    screenshots,
    evidence: {
      sameIframe: true,
      sameRoot: true,
      sameDocument: true,
      guardBlocksKeyboard: true,
      commands: [],
      draftPreserved: draft === null ? 'not exercised in this smoke' : true,
    },
  };
}
