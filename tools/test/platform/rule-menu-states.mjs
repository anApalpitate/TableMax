import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { start } from './rule-menu-fixture.mjs';
export async function runStates({ task, evidence }) {
  const dir = path.resolve(task, evidence),
    formal = path.resolve(
      'artifacts/maintenance',
      path.basename(task),
      evidence,
    );
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(formal, { recursive: true });
  const s = await start(task, 'states'),
    b = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--mute-audio'],
    });
  const checks = [],
    failures = [];
  try {
    for (const [key, paused, loadFailure] of [
      ['uno', true, false],
      ['avalon-ended', false, false],
      ['uno', false, true],
    ])
      for (const [role, w, h] of [
        ['host', 1280, 720],
        ['player', 390, 844],
      ]) {
        const ctx = await b.newContext({ viewport: { width: w, height: h } }),
          p = await ctx.newPage();
        let requests = 0;
        await p.route('**/api/game-packages/releases/*', (r) => {
          requests++;
          return r.fulfill({ status: 503, body: 'fixture unavailable' });
        });
        try {
          await p.goto(s.url);
          await p.waitForFunction(
            () => typeof window.renderCase === 'function',
          );
          await p.evaluate((a) => window.renderCase(a), {
            key,
            role,
            paused,
            loadFailure,
          });
          await p.getByRole('button', { name: '菜单', exact: true }).click();
          if (paused && role === 'host')
            assert(
              await p
                .getByRole('button', { name: '恢复游戏', exact: true })
                .isVisible(),
            );
          if (key === 'avalon-ended')
            assert.equal(
              await p.evaluate(() => window.fixtureSession.view.status),
              'ended',
            );
          await p
            .getByRole('button', { name: '游戏设置', exact: true })
            .click();
          if (loadFailure) {
            await p.getByRole('alert').waitFor();
            assert(
              await p
                .getByRole('alert')
                .getByText(/已保存的对局仍保留/)
                .isVisible(),
            );
            const n = requests;
            await p.getByRole('button', { name: '重试', exact: true }).click();
            await p.waitForFunction(() =>
              document.querySelector('[role=alert]'),
            );
            assert(requests > n);
          }
          await p.screenshot({
            path: path.join(
              dir,
              `${key}-${role}-${loadFailure ? 'failure' : 'state'}.png`,
            ),
          });
          assert.equal(await p.locator('dialog[open]').count(), 1);
          await p.keyboard.press('Escape');
          await p
            .getByRole('button', { name: '游戏设置', exact: true })
            .waitFor();
          assert.equal(
            await p.evaluate(() => window.fixtureCommands.length),
            0,
          );
          checks.push({ key, role, paused, loadFailure, requests });
        } catch (e) {
          failures.push({ key, role, paused, loadFailure, error: e.stack });
          await p.screenshot({
            path: path.join(dir, `${key}-${role}-assertion-failure.png`),
          });
        } finally {
          await ctx.close();
        }
      }
  } finally {
    await b.close();
    await s.server.close();
    const report = {
      checks,
      failures,
      boundary:
        'Frozen source UI fixtures: UNO paused, actual generated Avalon-ended public projection, network 503 settings load/retry; no game action or save restoration.',
    };
    await fs.writeFile(
      path.join(formal, 'report.json'),
      JSON.stringify(report, null, 2),
    );
    await fs.writeFile(
      path.join(dir, 'report.json'),
      JSON.stringify(report, null, 2),
    );
  }
  console.log(JSON.stringify({ checks: checks.length, failures }));
  return failures.length ? 1 : 0;
}
