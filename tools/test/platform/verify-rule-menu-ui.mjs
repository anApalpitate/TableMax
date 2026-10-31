import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { start } from './rule-menu-fixture.mjs';
const option = (n) =>
  process.argv
    .find((x) => x.startsWith('--' + n + '='))
    ?.split('=')
    .slice(1)
    .join('=');
if (process.argv.includes('--navigation')) {
  const { runNavigation } = await import('./rule-menu-navigation.mjs');
  process.exit(
    await runNavigation({ task: option('task'), evidence: option('evidence') }),
  );
}
if (process.argv.includes('--states')) {
  const { runStates } = await import('./rule-menu-states.mjs');
  process.exit(
    await runStates({ task: option('task'), evidence: option('evidence') }),
  );
}
const phase = option('phase') ?? 'after';
const task = path.resolve(option('task'));
const evidence = option('evidence');
if (!/^[a-z0-9-]+$/.test(evidence ?? '')) throw Error('evidence required');
const dir = path.join(task, evidence);
const formal = path.resolve(
  'artifacts/maintenance',
  path.basename(task),
  evidence,
);
await fs.mkdir(formal, { recursive: true });
await fs.mkdir(dir, { recursive: true });
process.env.TEMP = process.env.TMP = dir;
const server = await start(task, phase);
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--mute-audio'],
});
const records = [];
const chapterChecks = [];
const failures = [];
const keys = [
  'pokemon-encounters',
  'expansion',
  'modern-art',
  'power-grid',
  'rummikub',
  'uno',
  'avalon',
  'manila',
  'cockroach-poker',
];
try {
  for (const [role, w, h] of [
    ['host', 1280, 720],
    ['player', 1280, 720],
    ['player', 390, 844],
    ['player', 320, 568],
    ['host', 1920, 1080],
    ['player', 1920, 1080],
    ['host', 3840, 2160],
    ['host', 1024, 576],
    ['host', 853, 480],
  ])
    for (const key of keys) {
      if (option('roles') && !option('roles').split(',').includes(role))
        continue;
      if (option('widths') && !option('widths').split(',').includes(String(w)))
        continue;
      if (option('games') && !option('games').split(',').includes(key))
        continue;
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        isMobile: w < 640,
        hasTouch: w < 640,
        reducedMotion: 'reduce',
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(server.url);
      await page.waitForFunction(() => typeof window.renderCase === 'function');
      await page.evaluate((a) => window.renderCase(a), {
        kind: 'game',
        key,
        role,
        owner: process.argv.includes('--owner'),
        paused: process.argv.includes('--paused'),
      });
      await page.waitForTimeout(300);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((x) => x.decode().catch(() => {})),
        );
      });
      for (const kind of option('panels')?.split(',') ?? ['rules', 'menu']) {
        try {
          await page
            .getByRole('button', {
              name:
                kind === 'rules'
                  ? /^(规则|图文规则)$/
                  : /^(菜单|管理与设置|牌桌管理与设置|设置)$/,
            })
            .first()
            .click();
          await page.waitForTimeout(150);
          const dialog = page.locator('dialog[open]').last();
          await dialog
            .locator('button[aria-label="关闭面板"]')
            .last()
            .waitFor({ state: 'visible' });
          const info = await dialog.evaluate((e) => ({
            text: e.innerText,
            scroll: e.scrollHeight,
            height: e.clientHeight,
            close: [...e.querySelectorAll('button[aria-label="关闭面板"]')].map(
              (n) => {
                const r = n.getBoundingClientRect();
                return {
                  x: r.x,
                  y: r.y,
                  w: r.width,
                  h: r.height,
                  hit:
                    document
                      .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                      ?.closest('button') === n,
                };
              },
            ),
            heading: [...e.querySelectorAll('h2,h2 span')].map((n) => ({
              text: n.textContent,
              font: getComputedStyle(n).fontSize,
            })),
            images: [...e.querySelectorAll('img')]
              .filter((i) => i.offsetWidth > 0)
              .map((i) => ({
                src: i.getAttribute('src'),
                ok: i.complete && i.naturalWidth > 0,
              })),
            buttons: [...e.querySelectorAll('button')].map((b) => ({
              text: b.innerText,
              label: b.getAttribute('aria-label'),
            })),
          }));
          const name = `${key}-${role}-${w}-${kind}.png`;
          await page.screenshot({ path: path.join(dir, name) });
          records.push({
            key,
            role,
            w,
            h,
            kind,
            file: name,
            ...info,
            commands: await page.evaluate(() => window.fixtureCommands),
            errors: [...errors],
          });
          if (phase === 'after') {
            assert.equal(errors.length, 0, errors.join('\n'));
            assert(
              info.close.some((x) => x.hit && x.w >= 44 && x.h >= 44),
              'close reachable and 44px',
            );
            assert(
              info.heading.every((x) => parseFloat(x.font) >= 20),
              'heading >=20px',
            );
            assert.equal(
              await page.locator('dialog[open]').count(),
              1,
              'one dialog',
            );
            if (kind === 'rules') {
              assert.equal(
                await page.locator('.rules-guide__chapters > section').count(),
                1,
                'one default chapter',
              );
              const choices = await page
                .locator('select[aria-label="当前规则章节"] option')
                .evaluateAll((es) =>
                  es.map((e) => ({ value: e.value, label: e.textContent })),
                );
              const target = choices[Math.min(1, choices.length - 1)];
              if (await page.getByLabel('当前规则章节').isVisible())
                await page
                  .getByLabel('当前规则章节')
                  .selectOption(target.value);
              else
                await page
                  .locator('.rules-guide__nav')
                  .getByRole('button', { name: target.label, exact: true })
                  .click();
              await page.waitForTimeout(50);
              assert.equal(
                await page.locator('.rules-guide__chapters > section').count(),
                1,
                'chapter switch',
              );
              await page
                .getByRole('button', { name: '完整规则', exact: true })
                .click();
              await page.waitForTimeout(50);
              assert.equal(
                await page.locator('.rules-guide__chapters > section').count(),
                choices.length - 1,
                'complete chapters',
              );
              await page
                .getByRole('button', { name: '分章查看', exact: true })
                .click();
              await page.waitForTimeout(50);
              assert.equal(
                await page.locator('.rules-guide__chapters > section').count(),
                1,
              );
              if (
                (role === 'host' && w === 1280) ||
                (role === 'player' && w === 390)
              ) {
                for (const item of choices) {
                  if (await page.getByLabel('当前规则章节').isVisible())
                    await page
                      .getByLabel('当前规则章节')
                      .selectOption(item.value);
                  else
                    await page
                      .locator('.rules-guide__nav')
                      .getByRole('button', { name: item.label, exact: true })
                      .click();
                  await page.waitForTimeout(40);
                  const measured = await page
                    .locator('.rules-guide__chapters')
                    .evaluate((e) => ({
                      width: e.clientWidth,
                      scrollWidth: e.scrollWidth,
                      text: e.innerText,
                    }));
                  const detailFile = `${key}-${role}-${w}-chapter-${item.value}.png`;
                  await page.screenshot({ path: path.join(dir, detailFile) });
                  chapterChecks.push({
                    key,
                    role,
                    w,
                    chapter: item.value,
                    file: detailFile,
                    ...measured,
                  });
                  assert(
                    measured.scrollWidth <= measured.width + 2,
                    'chapter horizontal fit ' + item.value,
                  );
                }
              }
              const current = await page
                .getByLabel('当前规则章节')
                .inputValue();
              await page.keyboard.press('Escape');
              await page
                .getByRole('button', { name: /^(规则|图文规则)$/ })
                .first()
                .click();
              assert.equal(
                await page.getByLabel('当前规则章节').inputValue(),
                current,
                'reading memory',
              );
            } else {
              for (const title of ['游戏设置', '视频设置']) {
                const entry = page.getByRole('button', {
                  name: title,
                  exact: true,
                });
                assert.equal(
                  await entry.count(),
                  1,
                  'setting available ' + title,
                );
                await entry.click();
                await page.waitForTimeout(80);
                assert.equal(
                  await page.locator('dialog[open]').count(),
                  1,
                  'embedded setting',
                );
                assert(
                  await page
                    .getByRole('button', { name: '返回', exact: true })
                    .isVisible(),
                  'return visible',
                );
                if (key === 'uno' && title === '游戏设置')
                  assert(
                    await page
                      .getByText('抓漏延迟', { exact: true })
                      .isVisible(),
                    'real UNO module',
                  );
                await page.keyboard.press('Escape');
                await page.waitForTimeout(50);
                assert(
                  await page
                    .getByRole('button', { name: title, exact: true })
                    .isVisible(),
                  'back to menu',
                );
              }
            }
            assert.equal(
              (await page.evaluate(() => window.fixtureCommands)).length,
              0,
              'read-only navigation',
            );
          }
          await page.keyboard.press('Escape');
        } catch (e) {
          failures.push({ key, role, w, kind, error: e.message });
          await page
            .screenshot({
              path: path.join(dir, `${key}-${role}-${w}-${kind}-failure.png`),
            })
            .catch(() => {});
          await page.keyboard.press('Escape').catch(() => {});
          if (failures.length >= 10) throw e;
        }
      }
      await ctx.close();
      console.log(`${phase} ${key} ${role} ${w}`);
    }
} finally {
  await browser.close();
  await server.server.close();
  const inputs = [];
  for (const [p, b] of server.inputs)
    inputs.push({
      path: p,
      sha256: crypto.createHash('sha256').update(b).digest('hex'),
    });
  await fs.writeFile(
    path.join(dir, 'report.json'),
    JSON.stringify(
      {
        phase,
        owner: process.argv.includes('--owner'),
        paused: process.argv.includes('--paused'),
        environment: {
          browser: browser.version(),
          muted: true,
          hidden: true,
          physicalDevice: false,
          physicalDpi: false,
          shortDesktopViewports:
            '1024x576 and 853x480 approximate CSS space at 125%/150% on 1280x720; not Windows system DPI',
        },
        method:
          'isolated Vite source registry, fresh browser context per game, legal frozen projections; releaseRef removed only to select source module',
        records,
        chapterChecks,
        failures,
        inputs,
      },
      null,
      2,
    ),
  );
  await fs.copyFile(
    path.join(dir, 'report.json'),
    path.join(formal, 'report.json'),
  );
  console.log(JSON.stringify({ phase, pages: records.length, failures }));
  if (failures.length) process.exitCode = 1;
}
