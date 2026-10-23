import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';
const arg = (n) =>
  process.argv.find((v) => v.startsWith(`--${n}=`))?.slice(n.length + 3);
assertWorkspaceRoot();
const task = resolve(arg('task') ?? 'tmp/modern-art-layout-refine-20261023-c1');
const out = resolve(
  arg('output') ??
    'artifacts/maintenance/modern-art-layout-refine-20261023-c1/visual-r01',
);
assert.ok(task.startsWith(resolve('tmp') + '\\'));
assert.ok(out.startsWith(resolve('artifacts') + '\\'));
const phases = arg('phase') ? [arg('phase')] : ['before', 'after'];
const only = (arg('only') ?? '').split(',').filter(Boolean);
assert.ok(phases.every((p) => ['before', 'after'].includes(p)));
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TABLEMAX_TEST_MAINTENANCE = '0';
await mkdir(join(task, 'browser-temp'), { recursive: true });
await mkdir(out, { recursive: true });
await writeFile(
  join(out, 'verifier-source.mjs'),
  await readFile(new URL(import.meta.url)),
);
process.env.TEMP = join(task, 'browser-temp');
process.env.TMP = process.env.TEMP;
const { launchTestBrowser } = await import('../../support/browser-test.mjs');
const report = {
  result: 'running',
  checks: [],
  failures: [],
  pending: [],
  screenshots: [],
  inputs: [],
  boundary:
    'Production components, legal role projections and controlled fixture transport. No physical device, live network, DPI or installer proof.',
};
const sources = [
  'games/modern-art/web/index.tsx',
  'games/modern-art/ui/player-wide.css',
  'games/modern-art/ui/player/index.tsx',
  'games/modern-art/ui/public/index.tsx',
  'games/modern-art/ui/style.css',
  'apps/web/src/components/PlayerFrame.tsx',
  'apps/web/src/components/player-frame.ts',
  'apps/web/src/components/player-frame.css',
];
const hash = (b) => createHash('sha256').update(b).digest('hex');
for (const source of sources) {
  const path =
    phases.length === 1 && phases[0] === 'before'
      ? join(task, 'baseline', source)
      : source;
  report.inputs.push({ path, sha256: hash(await readFile(path)) });
}
let browser;
try {
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  for (const phase of phases) {
    const bundle = resolve(arg(phase + '-bundle'));
    const bindingPath =
      arg('source-report') ??
      join(
        dirname(out),
        basename(dirname(bundle)).replace(/^fixture-/, ''),
        'report.json',
      );
    const bindingBytes = await readFile(bindingPath),
      binding = JSON.parse(bindingBytes);
    assert.equal(binding.result, 'built');
    for (const entry of binding.inputs.after)
      assert.equal(
        hash(await readFile(entry.path)),
        entry.sha256,
        'Bundle matches current source ' + entry.path,
      );
    report.sourceBinding = {
      path: bindingPath,
      sha256: hash(bindingBytes),
      inputs: binding.inputs.after,
    };
    const server = await serveFixture(bundle);
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    await page.addInitScript(() => localStorage.clear());
    const html = await readFile(join(bundle, 'index.html'));
    await page.route(
      (u) => u.pathname === '/player/game',
      (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }),
    );
    const cases = [];
    for (const scene of [
      'offer',
      'auction-open',
      'auction-once',
      'auction-sealed',
      'sealed-submitted',
      'auction-fixed',
      'auction-double',
      'auction-pair',
      'result',
      'ended',
    ])
      for (const [width, height] of [
        [1280, 720],
        [844, 390],
      ])
        cases.push({
          id: `${scene}-${width}`,
          scene,
          role: 'player',
          width,
          height,
          wide: true,
        });
    for (const scene of ['offer', 'auction-open'])
      cases.push({
        id: `${scene}-portrait`,
        scene,
        role: 'player',
        width: 390,
        height: 844,
        wide: false,
      });
    if (phase === 'after')
      for (const scene of ['offer', 'auction-open', 'auction-pair'])
        cases.push({
          id: scene + '-minimum',
          scene,
          role: 'player',
          width: 712,
          height: 336,
          wide: true,
        });
    for (const role of ['player', 'host', 'public'])
      cases.push({
        id: `saved-${role}`,
        scene: 'auction-open',
        role,
        width: 1280,
        height: 720,
        wide: role === 'player',
        saved: true,
      });
    assert.ok(
      only.every((id) => cases.some((c) => c.id === id)) &&
        new Set(only).size === only.length,
      'Known unique --only checks',
    );
    try {
      for (const item of cases) {
        if (only.length && !only.includes(item.id)) continue;
        const id = phase + '-' + item.id;
        if (report.failures.length >= 10) {
          report.pending.push(id);
          continue;
        }
        try {
          await page.setViewportSize({
            width: item.width,
            height: item.height,
          });
          await page.goto(
            server.url + `?role=${item.role}&scene=${item.scene}`,
          );
          await page
            .locator(
              item.role === 'player'
                ? 'iframe[data-player-frame]'
                : '.ma-screen',
            )
            .waitFor();
          if (item.role === 'player')
            await page
              .frameLocator('iframe[data-player-frame]')
              .locator('.ma-screen')
              .waitFor();
          let frame =
            item.role === 'player'
              ? page
                  .frames()
                  .find(
                    (f) =>
                      f !== page.mainFrame() &&
                      new URL(f.url()).pathname === '/player/game',
                  )
              : page.mainFrame();
          await frame.locator('.ma-screen').waitFor();
          if (item.role === 'player') {
            if (phase === 'before')
              await page
                .getByRole('combobox', { name: '玩家布局' })
                .selectOption(item.wide ? 'wide' : 'portrait');
            else {
              assert.equal(
                await page
                  .locator('[data-workspace-layout]')
                  .getAttribute('data-workspace-layout'),
                'portrait',
                'fresh default portrait',
              );
              if (item.wide)
                await page
                  .getByRole('button', { name: '切换横屏显示', exact: true })
                  .click();
            }
          }
          if (item.saved)
            await frame.evaluate(
              ({ scene, role }) =>
                window.renderModernArt({
                  scene,
                  role,
                  savedMessage: '已保存',
                  preserve: true,
                }),
              item,
            );
          await frame.evaluate(() =>
            Promise.all(
              [...document.images]
                .filter((i) => i.loading !== 'lazy')
                .map((i) => i.decode().catch(() => {})),
            ),
          );
          await page.waitForTimeout(60);
          const metrics = await frame.evaluate(() => {
            const box = (e) => {
              const r = e.getBoundingClientRect();
              return {
                x: r.x,
                y: r.y,
                right: r.right,
                bottom: r.bottom,
                width: r.width,
                height: r.height,
              };
            };
            const visible = (e) => {
              const s = getComputedStyle(e);
              return (
                e.getClientRects().length &&
                s.visibility !== 'hidden' &&
                s.display !== 'none'
              );
            };
            const painted = (e) => {
              const b = box(e);
              for (let p = e.parentElement; p; p = p.parentElement) {
                const s = getComputedStyle(p),
                  r = box(p);
                if (s.overflowX !== 'visible') {
                  b.x = Math.max(b.x, r.x);
                  b.right = Math.min(b.right, r.right);
                }
                if (s.overflowY !== 'visible') {
                  b.y = Math.max(b.y, r.y);
                  b.bottom = Math.min(b.bottom, r.bottom);
                }
              }
              return b;
            };
            const overlaps = (a, b) =>
              Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
            const saved = [...document.querySelectorAll('*')].filter(
              (e) =>
                e.children.length === 0 &&
                e.textContent.trim() === '已保存' &&
                visible(e),
            );
            return {
              width: innerWidth,
              height: innerHeight,
              scrollHeight: document.documentElement.scrollHeight,
              scrollWidth: document.documentElement.scrollWidth,
              saved: saved.map(box),
              savedOverlaps: saved.flatMap((s) =>
                [
                  ...document.querySelectorAll(
                    'button,input,select,.ma-card,.ma-round',
                  ),
                ]
                  .filter((e) => visible(e) && !e.contains(s))
                  .filter((e) => {
                    const a = painted(s),
                      b = painted(e);
                    return (
                      Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
                      Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1
                    );
                  })
                  .map((e) => e.className),
              ),
              hand: [...document.querySelectorAll('.ma-hand__card')].filter(
                visible,
              ).length,
              inputs: document.querySelectorAll('#ma-bid-amount').length,
              paintings: [
                ...document.querySelectorAll(
                  '.ma-auction__paintings > .ma-card',
                ),
              ]
                .filter(visible)
                .map((e) => ({ box: box(e), painted: painted(e) })),
              stageOverlaps: [
                ...document.querySelectorAll('.ma-auction__participants'),
              ]
                .filter(visible)
                .flatMap((p) =>
                  [
                    ...document.querySelectorAll(
                      '.ma-auction__label,.ma-theme > *',
                    ),
                  ]
                    .filter(visible)
                    .filter((e) => overlaps(painted(p), painted(e)))
                    .map((e) => e.className),
                ),
            };
          });
          report.checks.push({ id, ...metrics });
          const path = join(out, id + '.png');
          await captureBrowserScreenshot(page, {
            path,
            fullPage: false,
            animations: 'disabled',
          });
          report.screenshots.push({ ...item, id: item.id, phase, path });
          if (phase === 'after') {
            assert.ok(
              metrics.scrollWidth <= metrics.width + 1,
              'no horizontal page overflow',
            );
            if (item.wide)
              assert.ok(
                metrics.scrollHeight <= metrics.height + 1,
                `no vertical page overflow ${metrics.scrollHeight}/${metrics.height}`,
              );
            if (item.wide)
              assert.deepEqual(
                metrics.stageOverlaps,
                [],
                'participants do not overlap title, price or theme text',
              );
            if (
              item.wide &&
              [
                'auction-open',
                'auction-once',
                'auction-fixed',
                'auction-sealed',
                'sealed-submitted',
                'auction-pair',
              ].includes(item.scene)
            )
              assert.ok(
                metrics.paintings.some(
                  (c) =>
                    c.painted.bottom - c.painted.y >= c.box.height - 2 &&
                    c.painted.right - c.painted.x >= c.box.width - 2,
                ),
                'at least one complete auction painting is visible',
              );
            assert.ok(metrics.inputs <= 1, 'one quotation input');
            if (item.saved) {
              assert.deepEqual(
                metrics.savedOverlaps,
                [],
                'saved does not overlap controls or artwork',
              );
              assert.equal(
                metrics.saved.length,
                1,
                'exactly one visible saved acknowledgement',
              );
              for (const b of metrics.saved)
                assert.ok(
                  b.x >= 0 &&
                    b.y >= 0 &&
                    b.right <= metrics.width + 1 &&
                    b.bottom <= metrics.height + 1,
                  'saved within viewport',
                );
            }
            if (item.wide && item.scene === 'auction-open') {
              const input = frame.locator('#ma-bid-amount');
              await input.fill('9');
              const doc = await frame.evaluate(() => window.__documentId);
              await page
                .getByRole('button', { name: '返回竖屏显示', exact: true })
                .click();
              await page
                .getByRole('button', { name: '切换横屏显示', exact: true })
                .click();
              assert.equal(await input.inputValue(), '9');
              assert.equal(
                await frame.evaluate(() => window.__documentId),
                doc,
              );
            }
            if (item.wide && item.scene === 'offer') {
              const cards = frame.locator('.ma-hand__card');
              const count = await cards.count();
              assert.ok(count > 0);
              const seen = new Set();
              for (let n = 0; n <= count; n++) {
                const ids = await cards.evaluateAll((es) => {
                  const h = document
                    .querySelector('.ma-hand')
                    .getBoundingClientRect();
                  return es
                    .filter((e) => {
                      const r = e.getBoundingClientRect();
                      return (
                        r.x >= h.x - 1 &&
                        r.right <= h.right + 1 &&
                        r.y >= 0 &&
                        r.bottom <= innerHeight + 1
                      );
                    })
                    .map((e) => e.dataset.cardId);
                });
                ids.forEach((id) => seen.add(id));
                if (seen.size === count) break;
                await frame
                  .getByRole('button', { name: '下一页手牌', exact: true })
                  .click();
                await frame.evaluate(
                  () =>
                    new Promise((r) =>
                      requestAnimationFrame(() => requestAnimationFrame(r)),
                    ),
                );
              }
              assert.equal(
                seen.size,
                count,
                'each complete hand card reachable using actual next-page button',
              );
              assert.equal(await frame.evaluate(() => scrollY), 0);
            }
            if (item.wide && item.scene === 'result') {
              const entries = frame.locator('.ma-results__ranking > div');
              for (let i = 0; i < (await entries.count()); i++) {
                await entries.nth(i).evaluate((e) =>
                  e.scrollIntoView({
                    behavior: 'instant',
                    inline: 'nearest',
                    block: 'nearest',
                  }),
                );
                assert.ok(
                  await entries.nth(i).evaluate((e) => {
                    const r = e.getBoundingClientRect();
                    return (
                      r.y >= 0 &&
                      r.bottom <= innerHeight + 1 &&
                      r.x >= 0 &&
                      r.right <= innerWidth + 1
                    );
                  }),
                  'all artist values reachable',
                );
              }
            }
            if (item.wide && ['result', 'ended'].includes(item.scene)) {
              const rows = frame.locator('.ma-results__income > div');
              assert.equal(await rows.count(), 5);
              for (let i = 0; i < 5; i++) {
                await rows.nth(i).evaluate((e) =>
                  e.scrollIntoView({
                    behavior: 'instant',
                    block: 'nearest',
                    inline: 'nearest',
                  }),
                );
                assert.ok(
                  await rows.nth(i).evaluate((e) => {
                    const r = e.getBoundingClientRect();
                    return (
                      r.y >= -1 &&
                      r.bottom <= innerHeight + 1 &&
                      r.x >= -1 &&
                      r.right <= innerWidth + 1
                    );
                  }),
                  'all five result rows fully reachable',
                );
                assert.ok(
                  await rows
                    .nth(i)
                    .locator(':scope > strong')
                    .evaluate((e) => {
                      const r = e.getBoundingClientRect();
                      return r.y >= -1 && r.bottom <= innerHeight + 1;
                    }),
                  'result amount stays visible',
                );
              }
              assert.equal(await frame.evaluate(() => scrollY), 0);
            }
          }
        } catch (e) {
          report.failures.push({ id, error: e.message });
        }
        await writeFile(
          join(out, 'report-running.json'),
          JSON.stringify(report, null, 2),
        );
      }
    } finally {
      await page.close();
      await server.close();
    }
  }
  for (const v of report.inputs)
    assert.equal(
      hash(await readFile(v.path)),
      v.sha256,
      'stable source ' + v.path,
    );
  report.result =
    report.failures.length || report.pending.length ? 'failed' : 'passed';
} catch (e) {
  report.result = 'failed';
  report.failures.push({ id: 'setup', error: e.stack });
} finally {
  await browser?.close();
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(
  JSON.stringify(
    {
      result: report.result,
      checks: report.checks.length,
      failures: report.failures,
      pending: report.pending,
    },
    null,
    2,
  ),
);
if (report.result !== 'passed') process.exitCode = 1;
