import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { serveFixture } from '../support/fixture-server.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';

const option = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const task = option('task'),
  evidence = option('evidence');
assert.match(task ?? '', /^tmp\/[a-z0-9][a-z0-9-]{1,90}$/);
assert.match(evidence ?? '', /^[a-z0-9][a-z0-9-]{1,70}$/);
const work = resolve(task, 'shared', evidence);
const output = resolve(
  'artifacts/maintenance',
  task.split('/')[1],
  'shared',
  evidence,
);
assert(!existsSync(output), 'Evidence must be new');
await mkdir(output, { recursive: true });
await mkdir(work, { recursive: true });
await mkdir(join(work, 'browser-temp'));
process.env.TEMP = process.env.TMP = join(work, 'browser-temp');
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const sourceFiles = [
  'packages/web-host/src/viewport/viewport.ts',
  'packages/web-host/src/viewport/useViewportSnapshot.ts',
  'packages/web-host/src/index.tsx',
  'tools/test/platform/verify-viewport-measurement.mjs',
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(
      sourceFiles.map(async (path) => [path, sha(await readFile(path))]),
    ),
  );
const report = {
  result: 'running',
  inputs: await hashes(),
  checks: [],
  boundary:
    'Actual React public export in a local browser fixture; not a physical safe-area, phone, service or installer proof.',
};
let server, browser;
try {
  await writeFile(
    join(work, 'index.html'),
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script>window.resizeBalance=0;for(const target of [window,window.visualViewport]){const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target);target.addEventListener=(name,...args)=>{if(name==="resize")window.resizeBalance++;return add(name,...args)};target.removeEventListener=(name,...args)=>{if(name==="resize")window.resizeBalance--;return remove(name,...args)}};</script><script type="module" src="/fixture.tsx"></script>',
  );
  await writeFile(
    join(work, 'fixture.tsx'),
    `
import React,{useId,useState} from 'react';
import{createRoot}from'react-dom/client';
import{useViewportSnapshot}from ${JSON.stringify(resolve('packages/web-host/src/index.tsx'))};
function Probe(){const id=useId(),[mounted,setMounted]=useState(false),[safe,setSafe]=useState('env(safe-area-inset-bottom, 0px)');const snapshot=useViewportSnapshot('[data-measured-root="'+id+'"]','--safe-');return <main><h1>CSS viewport fixture</h1><button id="mount" onClick={()=>setMounted(v=>!v)}>Toggle root</button><button id="safe" onClick={()=>setSafe('34px')}>Inset 34</button><button id="safe20" onClick={()=>setSafe('20px')}>Inset 20</button><output id="measure">{JSON.stringify(snapshot)}</output>{mounted&&<section data-measured-root={id} style={{'--safe-top':'env(safe-area-inset-top, 0px)','--safe-bottom':safe,'--safe-left':'0px','--safe-right':'0px'} as React.CSSProperties}>Measured root {id}</section>}</main>}
const root=createRoot(document.querySelector('#root')!);root.render(<Probe/>);(window as any).dispose=()=>root.unmount();
`,
  );
  await build({
    configFile: false,
    root: work,
    plugins: [react()],
    logLevel: 'error',
    build: { outDir: join(work, 'dist'), emptyOutDir: true },
    resolve: {
      alias: {
        react: resolve('apps/web/node_modules/react'),
        'react-dom': resolve('apps/web/node_modules/react-dom'),
        '@tablemax/protocol': resolve('packages/protocol/src/index.ts'),
        '@tablemax/game-sdk': resolve('packages/game-sdk/src/index.ts'),
      },
    },
  });
  server = await serveFixture(join(work, 'dist'));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.url);
  const snapshot = async () =>
    JSON.parse(await page.locator('#measure').innerText());
  await page.locator('#measure').waitFor();
  assert.equal((await snapshot()).available.width, 390);
  await page.locator('#mount').click();
  const actualSafe = await page
    .locator('[data-measured-root]')
    .evaluate(
      (e) =>
        Number.parseFloat(
          getComputedStyle(e).getPropertyValue('--safe-bottom'),
        ) || 0,
    );
  assert.equal((await snapshot()).safeInsets.bottom, actualSafe);
  report.checks.push('actual-env-css-value-and-dpr2-css-size');
  await page.locator('#safe').click();
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector('#measure').textContent).available
        .height === 810,
  );
  assert.equal((await snapshot()).safeInsets.bottom, 34);
  report.checks.push('late-root-and-css-inset-subtracted-once');
  await page.locator('#mount').click();
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector('#measure').textContent).available
        .height === 844,
  );
  await page.locator('#safe20').click();
  await page.locator('#mount').click();
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector('#measure').textContent).available
        .height === 824,
  );
  report.checks.push('root-removal-and-replacement');
  await page.setViewportSize({ width: 390, height: 400 });
  await page.waitForFunction(
    () =>
      JSON.parse(document.querySelector('#measure').textContent).available
        .height === 380,
  );
  report.checks.push('actual-resize');
  await page.screenshot({ path: join(output, 'measurement.png') });
  await page.evaluate(() => window.dispose());
  assert.equal(await page.evaluate(() => window.resizeBalance), 0);
  report.checks.push('resize-subscriptions-cleaned');
  const outer = await context.newPage();
  await outer.goto(server.url);
  await outer.evaluate(() => {
    window.dispose();
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:300px;height:700px;border:0';
    frame.src = location.href;
    document.body.append(frame);
  });
  const inner = outer.frameLocator('iframe');
  await inner.locator('#measure').waitFor();
  assert.deepEqual(
    JSON.parse(await inner.locator('#measure').innerText()).available,
    { width: 300, height: 700 },
  );
  report.checks.push('iframe-local-size-without-parent-margin-subtraction');
  assert.deepEqual(errors, []);
  assert.deepEqual(
    await hashes(),
    report.inputs,
    'Source changed during verification',
  );
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({ result: report.result, checks: report.checks, output }),
  );
}
