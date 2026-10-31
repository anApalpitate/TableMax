import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { start } from './rule-menu-fixture.mjs';
const option = (n) =>
  process.argv
    .find((x) => x.startsWith('--' + n + '='))
    ?.split('=')
    .slice(1)
    .join('=');
const task = path.resolve(option('task'));
const evidence = option('evidence');
assert.match(evidence ?? '', /^[a-z0-9-]+$/);
const dir = path.join(task, evidence);
await fs.mkdir(dir, { recursive: true });
const { server, url } = await start(task, 'after');
const src = path.join(task, 'work/after').replaceAll('\\', '/');
const work = path.join(task, 'serve-after');
let entry = (
  await fs.readFile(path.join(task, 'supplement-template.tsx'), 'utf8')
)
  .replaceAll('__SOURCE__', '/@fs/' + src)
  .replace(/(from ['"][^'"]+\/(?:RulesGuide|Rulebook))(['"])/g, '$1.tsx$2')
  .replace(
    /(from ['"][^'"]+\/(?:config|test-fixtures|project))(['"])/g,
    '$1.ts$2',
  );
entry += `\nimport ${JSON.stringify('/@fs/' + src + '/apps/web/src/styles.css')};import{loadGameClient}from ${JSON.stringify('/@fs/' + src + '/apps/web/src/game-clients/registry.ts')};window.prepareSupplement=async(key)=>{const id=key.startsWith('expansion:')?'pokemon-encounters':key.startsWith('cockroach:')?'cockroach-poker':key.split(':')[0];await loadGameClient(id,id==='pokemon-encounters'?'expansion':undefined);window.renderSupplement(key);};`;
await fs.writeFile(path.join(work, 'supplement-entry.tsx'), entry);
await fs.writeFile(
  path.join(work, 'supplement.html'),
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/supplement-entry.tsx"></script></html>',
);
const cases = JSON.parse(
  await fs.readFile(path.join(task, 'supplement-fixtures.json'), 'utf8'),
).cases;
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--mute-audio'],
});
const rows = [],
  failures = [];
try {
  for (const width of [390, 1280])
    for (const key of cases) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 720 },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      try {
        await page.goto(new URL('supplement.html', url).href);
        await page.waitForFunction(
          () => typeof window.prepareSupplement === 'function',
        );
        await page.evaluate((key) => window.prepareSupplement(key), key);
        await page
          .getByRole('button', { name: '完整规则', exact: true })
          .click();
        await page.waitForTimeout(100);
        const text = await page.locator('.rules-guide').innerText();
        if (key === 'cockroach:2') {
          assert.equal(
            await page.locator('.cp-rule-threshold').getAttribute('aria-label'),
            '5张同类',
          );
          assert.equal(
            await page.locator('.cp-rule-threshold > span > *').count(),
            5,
          );
        }
        if (key === 'avalon:classic') assert(text.includes('基础经典'));
        if (key === 'avalon:court') assert(text.includes('宫廷迷局'));
        if (key === 'uno:off:0') assert(!text.includes('本局已开启补牌传递'));
        if (key.startsWith('uno:')) {
          assert(
            text.includes(
              key.includes(':on:') ? '补牌传递开启' : '补牌传递关闭',
            ),
          );
        }
        if (key === 'expansion:events-research-v3')
          assert(text.includes('17项'));
        if (key === 'expansion:legacy') assert(!text.includes('局内事件'));
        const file = key.replaceAll(':', '-') + '-' + width + '.png';
        await page.screenshot({ path: path.join(dir, file) });
        rows.push({ key, width, file, text, passed: true });
      } catch (e) {
        failures.push({ key, width, error: e.message });
        if (failures.length >= 10) throw e;
      } finally {
        await context.close();
      }
    }
} finally {
  await browser.close();
  await server.close();
  const report = {
    boundary:
      'Rule component variants using actual validators and public projections; not saved-game restoration',
    rows,
    failures,
  };
  await fs.writeFile(
    path.join(dir, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  const formal = path.resolve(
    'artifacts/maintenance',
    path.basename(task),
    evidence,
  );
  await fs.mkdir(formal, { recursive: true });
  await fs.writeFile(
    path.join(formal, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ cases: rows.length, failures }));
  if (failures.length) process.exitCode = 1;
}
