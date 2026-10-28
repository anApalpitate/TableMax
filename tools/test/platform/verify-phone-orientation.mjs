import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
assertWorkspaceRoot();
const arg = (n) =>
  process.argv.find((v) => v.startsWith('--' + n + '='))?.slice(n.length + 3);
const task = resolve(arg('task') ?? 'tmp/all-games-rollout-20261029/platform');
const output = resolve(
  arg('output') ??
    'artifacts/maintenance/all-games-rollout-20261029/platform/orientation-r1',
);
assert(task.startsWith(resolve('tmp') + sep));
assert(output.startsWith(resolve('artifacts/maintenance') + sep));
await assert.rejects(stat(output), 'Use a new evidence directory');
await mkdir(output, { recursive: true });
await mkdir(task, { recursive: true });
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TABLEMAX_TEST_MAINTENANCE = '0';
await mkdir(join(task, 'browser-temp'), { recursive: true });
process.env.TEMP = process.env.TMP = join(task, 'browser-temp');
const sources = [
  'apps/web/src/components/PlayerFrame.tsx',
  'apps/web/src/components/PhoneOrientationGuard.tsx',
  'apps/web/src/components/player-frame.ts',
  'apps/web/src/components/player-frame.css',
  'tools/test/platform/verify-phone-orientation.mjs',
];
const hash = (b) => createHash('sha256').update(b).digest('hex');
const report = {
  result: 'running',
  checks: [],
  inputs: await Promise.all(
    sources.map(async (path) => ({ path, sha256: hash(await readFile(path)) })),
  ),
  boundary:
    'Actual PlayerFrame with controlled same-origin iframe content. No game rules, service persistence or physical phone acceptance.',
};
const entry = join(task, 'orientation-entry.tsx');
await writeFile(
  entry,
  `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{PlayerFrame}from${JSON.stringify(resolve('apps/web/src/components/PlayerFrame.tsx').replaceAll('\\', '/'))};function Child(){const[count,setCount]=useState(0);return <main><input id="draft" aria-label="选择草稿"/><button id="action" onClick={()=>setCount(count+1)}>动作 {count}</button><button id="details" onClick={()=>document.querySelector('dialog').showModal()}>详情</button><dialog><input aria-label="详情输入"/><button onClick={()=>document.querySelector('dialog').close()}>关闭</button></dialog></main>}createRoot(document.getElementById('root')!).render(window.top===window.self?<PlayerFrame initialUrl={location.href}/>:<Child/>);`,
);
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: join(task, 'app.js'),
  platform: 'browser',
  format: 'esm',
  jsx: 'automatic',
  nodePaths: [resolve('apps/web/node_modules')],
});
let browser, server;
try {
  server = createServer(async (req, res) => {
    try {
      if (req.url === '/app.js' || req.url === '/app.css') {
        res.setHeader(
          'Content-Type',
          req.url.endsWith('.css') ? 'text/css' : 'text/javascript',
        );
        res.end(await readFile(join(task, req.url.slice(1))));
      } else {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
          '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>html,body{margin:0}button,input{font:18px sans-serif;min-height:44px}dialog{padding:24px}</style><div id="root"></div><script type="module" src="/app.js"></script>',
        );
      }
    } catch (e) {
      res.statusCode = 500;
      res.end(String(e));
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port + '/player');
  const frame = page.frameLocator('iframe');
  await frame.locator('#draft').fill('保留选择');
  const identity = await page.locator('iframe').evaluate((e) => {
    e.dataset.identity = 'stable';
    return e.dataset.identity;
  });
  assert.equal(await page.locator('.phone-orientation-guard').count(), 0);
  report.checks.push('portrait-no-guard');
  await frame.locator('#details').click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('.phone-orientation-guard[open]').waitFor();
  assert.equal(
    await page.locator('iframe').getAttribute('data-identity'),
    identity,
  );
  assert(await page.locator('iframe').evaluate((e) => e.inert));
  report.checks.push('landscape-covers-iframe-dialog');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  assert(
    await page
      .locator('.phone-orientation-guard')
      .evaluate((e) => e.open && document.activeElement === e),
  );
  report.checks.push('escape-tab-cannot-bypass');
  const bounds = await page.locator('.phone-orientation-guard').boundingBox();
  assert(bounds.width >= 843 && bounds.height >= 389);
  report.checks.push('guard-fills-viewport');
  await page.screenshot({ path: join(output, 'phone-landscape.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await page
      .locator('.phone-orientation-guard__phone')
      .evaluate((e) => getComputedStyle(e).animationName),
    'none',
  );
  report.checks.push('reduced-motion');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.phone-orientation-guard').waitFor({ state: 'detached' });
  assert.equal(await frame.locator('#draft').inputValue(), '保留选择');
  assert.equal(
    await page.locator('iframe').getAttribute('data-identity'),
    'stable',
  );
  assert(!(await page.locator('iframe').evaluate((e) => e.inert)));
  report.checks.push('portrait-restores-same-iframe-draft');
  assert(
    await frame
      .locator('dialog input')
      .evaluate((e) => e.ownerDocument.activeElement === e),
  );
  report.checks.push('valid-child-focus-restored');
  await frame.locator('dialog button').click();
  await frame.locator('#action').click();
  assert.equal(await frame.locator('#action').textContent(), '动作 1');
  report.checks.push('action-reachable-after-return');
  await page.evaluate(() =>
    Object.defineProperty(screen.orientation, 'type', {
      value: 'portrait-primary',
      configurable: true,
    }),
  );
  await page.setViewportSize({ width: 390, height: 280 });
  assert.equal(await page.locator('.phone-orientation-guard').count(), 0);
  assert.equal(await frame.locator('#draft').inputValue(), '保留选择');
  report.checks.push('keyboard-height-does-not-trigger-rotation');
  await context.close();
  const desktop = await browser.newPage({
    viewport: { width: 844, height: 390 },
  });
  await desktop.goto('http://127.0.0.1:' + server.address().port + '/player');
  await desktop.frameLocator('iframe').locator('#action').waitFor();
  assert.equal(await desktop.locator('.phone-orientation-guard').count(), 0);
  report.checks.push('desktop-landscape-not-blocked');
  for (const input of report.inputs)
    assert.equal(
      hash(await readFile(input.path)),
      input.sha256,
      'Source changed during check',
    );
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((r) => (server ? server.close(r) : r()));
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks,
      output,
      error: report.error,
    }),
  );
}
