import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { start } from './rule-menu-fixture.mjs';

export async function runNavigation({ task, evidence }) {
  if (!/^[a-z0-9-]+$/.test(evidence)) throw Error('evidence required');
  const dir = path.join(task, evidence),
    formal = path.join('artifacts/maintenance', path.basename(task), evidence);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(formal, { recursive: true });
  process.env.TEMP = process.env.TMP = path.resolve(dir);
  const server = await start(task, 'navigation'),
    browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--mute-audio'],
    });
  const checks = [],
    failures = [];
  try {
    for (const [role, w, h, owner] of [
      ['host', 1280, 480, false],
      ['player', 390, 844, true],
    ]) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        isMobile: w < 640,
        hasTouch: w < 640,
        reducedMotion: 'reduce',
      });
      const page = await ctx.newPage();
      await page.goto(server.url);
      await page.waitForFunction(() => typeof window.renderCase === 'function');
      await page.evaluate((a) => window.renderCase(a), {
        kind: 'game',
        key: 'uno',
        role,
        owner,
      });
      await page.getByRole('button', { name: '菜单', exact: true }).click();
      for (const label of ['游戏设置', '视频设置']) {
        await page.getByRole('button', { name: label, exact: true }).click();
        await page.waitForFunction((title) => {
          const d = document.querySelector('dialog[open]');
          return (
            document.getElementById(d?.getAttribute('aria-labelledby'))
              ?.textContent === title
          );
        }, label);
        assert.equal(await page.locator('dialog[open]').count(), 1);
        assert.equal(
          await page.locator('dialog[open]').evaluate((d) => d.scrollTop),
          0,
        );
        assert.equal(
          await page.evaluate(() => document.activeElement?.tagName),
          'H2',
        );
        const close = page.getByRole('button', {
          name: '关闭面板',
          exact: true,
        });
        assert.equal(await close.count(), 1);
        const box = await close.boundingBox();
        assert(
          box &&
            box.width >= 44 &&
            box.height >= 44 &&
            box.y >= 0 &&
            box.y + box.height <= h,
        );
        await page.keyboard.press('Escape');
        await page.waitForFunction(
          (name) => document.activeElement?.getAttribute('aria-label') === name,
          label,
        );
        assert.equal(await page.locator('dialog[open]').count(), 1);
        checks.push(
          `${role}: ${label} one dialog, title label, focus, top, close44, Escape return`,
        );
      }
      if (role === 'host') {
        // This checkpoint exists only to exercise confirmation UI; no server save is attempted.
        await page.evaluate(() => {
          window.fixtureSession.view.history.push({
            id: 'ui-contract-checkpoint',
            roundNumber: 1,
            step: 1,
            seatId: null,
            label: '焦点回退界面检查',
            revealedInformation: true,
          });
        });
        // Opening and closing settings re-renders the menu with the explicit UI-contract history.
        await page
          .getByRole('button', { name: '游戏设置', exact: true })
          .click();
        await page.waitForFunction(
          () =>
            document.querySelector('.menu-subpage-content h2')?.textContent ===
            '游戏设置',
        );
        await page.keyboard.press('Escape');
        await page.waitForFunction(
          () => !document.querySelector('.menu-subpage-content'),
        );
        const rollback = page.getByRole('button', { name: /^决策点回退（/ });
        await fs.writeFile(
          path.join(dir, 'rollback-entry-diagnostic.json'),
          JSON.stringify(
            await page.evaluate(() => ({
              text: document.body.innerText,
              dialogs: [...document.querySelectorAll('dialog')].map((d) => ({
                open: d.open,
                html: d.outerHTML,
              })),
              commands: window.fixtureCommands,
            })),
            null,
            2,
          ),
        );
        await rollback.scrollIntoViewIfNeeded();
        const scroll = await page
          .locator('dialog[open]')
          .evaluate((d) => d.scrollTop);
        await rollback.click();
        await page.waitForFunction(
          () => document.activeElement?.textContent === '决策点回退',
        );
        assert.equal(await page.locator('dialog[open]').count(), 1);
        assert.equal(
          await page.locator('dialog[open]').evaluate((d) => d.scrollTop),
          0,
        );
        await page.getByRole('button', { name: /焦点回退界面检查/ }).click();
        assert.equal(await page.locator('dialog[open]').count(), 2);
        await page.getByRole('button', { name: '取消', exact: true }).click();
        assert.equal(await page.locator('dialog[open]').count(), 1);
        await page.getByRole('button', { name: '返回', exact: true }).click();
        await page.waitForFunction(() =>
          document.activeElement
            ?.getAttribute('aria-label')
            ?.startsWith('决策点回退'),
        );
        assert(
          Math.abs(
            (await page.locator('dialog[open]').evaluate((d) => d.scrollTop)) -
              scroll,
          ) <= 1,
        );
        checks.push(
          'host: rollback UI-contract checkpoint, separate confirmation, cancel, original menu focus and scroll',
        );
        await page
          .getByRole('button', { name: '结束游戏', exact: true })
          .click();
        assert.equal(await page.locator('dialog[open]').count(), 2);
        await page.getByRole('button', { name: '取消', exact: true }).click();
        assert.equal(await page.locator('dialog[open]').count(), 1);
        checks.push(
          'host: end confirmation separate, cancel does not send command',
        );
      }
      await page
        .getByRole('button', { name: '对局记录', exact: true })
        .scrollIntoViewIfNeeded();
      const scroll = await page
        .locator('dialog[open]')
        .evaluate((d) => d.scrollTop);
      await page.getByRole('button', { name: '对局记录', exact: true }).click();
      await page.waitForFunction(
        () =>
          document.activeElement?.tagName === 'H2' &&
          document.activeElement.textContent === '对局记录',
      );
      assert.equal(
        await page.locator('dialog[open]').evaluate((d) => d.scrollTop),
        0,
      );
      await page.getByRole('button', { name: '返回', exact: true }).click();
      await page.waitForFunction(
        () => document.activeElement?.textContent === '对局记录',
      );
      assert(
        Math.abs(
          (await page.locator('dialog[open]').evaluate((d) => d.scrollTop)) -
            scroll,
        ) <= 1,
      );
      checks.push(
        `${role}: dedicated history top, heading focus, return to rebuilt entry and original scroll`,
      );
      assert.deepEqual(await page.evaluate(() => window.fixtureCommands), []);
      await page.screenshot({ path: `${dir}/${role}-menu-return.png` });
      await ctx.close();
    }
    const ctx = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      }),
      page = await ctx.newPage();
    await page.goto(server.url);
    await page.waitForFunction(() => typeof window.renderCase === 'function');
    await page.evaluate(() =>
      window.renderCase({ kind: 'box', key: 'uno', role: 'host' }),
    );
    await page.getByRole('button', { name: '座位设置', exact: true }).click();
    const entry = page.getByRole('button', { name: /座位操作$/ }).first();
    const entryLabel = await entry.getAttribute('aria-label');
    await entry.click();
    assert.equal(await page.locator('dialog[open]').count(), 2);
    await page.getByRole('button', { name: '修改名称', exact: true }).click();
    assert.equal(await page.locator('dialog[open]').count(), 2);
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      (label) => document.activeElement?.getAttribute('aria-label') === label,
      entryLabel,
    );
    assert.equal(await page.locator('dialog[open]').count(), 1);
    assert.deepEqual(await page.evaluate(() => window.fixtureCommands), []);
    checks.push(
      'box: seat action → rename → Escape restores seat entry, no command',
    );
    await page.screenshot({ path: `${dir}/box-seat-return.png` });
    await ctx.close();
  } catch (error) {
    failures.push(error.stack ?? String(error));
  } finally {
    await browser.close();
    await server.server.close();
  }
  const inputs = [];
  for (const [file, bytes] of server.inputs)
    inputs.push({
      path: file,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    });
  await fs.writeFile(
    `${formal}/report.json`,
    JSON.stringify(
      {
        result: failures.length ? 'failed' : 'passed',
        checks,
        failures,
        inputs,
        limits: [
          'Frozen source fixture; no server mutations or real save validation.',
          'Rollback checkpoint is an explicit synthetic UI-contract record, not a legal replay proof.',
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks: checks.length, failures }));
  return failures.length ? 1 : 0;
}
