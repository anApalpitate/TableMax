import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { spawnSync } from 'node:child_process';
import { build as bundleNode } from 'esbuild';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { leanCatalogPlugin } from '../../build/lean-catalog.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
import { failureLimit } from '../runner/failure-policy.mjs';
import {
  fixedCanvasVariants,
  selectFixedCanvasCases,
} from './fixed-canvas-contract.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const local = (path) => relative(resolve('.'), path).replaceAll('\\', '/');
const quoted = (path) => JSON.stringify(resolve(path));
function workspacePath(value, prefix) {
  assert(
    value,
    `Missing ${prefix === 'tmp' ? 'TABLEMAX_TASK_TMP' : 'TABLEMAX_TEST_OUTPUT_DIR'}`,
  );
  const root = resolve('.'),
    path = resolve(value),
    name = local(path);
  assert(
    !isAbsolute(name) && name.startsWith(prefix + '/'),
    `Expected ${prefix}/ workspace path`,
  );
  for (let cursor = path; cursor !== root; cursor = dirname(cursor))
    assert(
      !existsSync(cursor) || !lstatSync(cursor).isSymbolicLink(),
      'Linked output rejected',
    );
  return path;
}
const aliases = () => ({
  '@tablemax/web-host/platform': resolve('packages/web-host/src/platform.ts'),
  '@tablemax/web-host': resolve('packages/web-host/src/index.tsx'),
  '@tablemax/protocol': resolve('packages/protocol/src/index.ts'),
  '@tablemax/game-sdk/module-manifest': resolve(
    'packages/game-sdk/src/module-manifest.ts',
  ),
  '@tablemax/game-sdk/metadata': resolve('packages/game-sdk/src/metadata.mjs'),
  '@tablemax/game-sdk': resolve('packages/game-sdk/src/index.ts'),
  zod: resolve('packages/protocol/node_modules/zod'),
  'socket.io-client': resolve('apps/web/node_modules/socket.io-client'),
});

// Internal implementation of verify-public-screen-retirement-ui's fixed mode.
export async function runFixedCanvasContract(args) {
  const selection = selectFixedCanvasCases(args);
  const taskRoot = workspacePath(process.env.TABLEMAX_TASK_TMP, 'tmp');
  const output = workspacePath(
    process.env.TABLEMAX_TEST_OUTPUT_DIR,
    'artifacts',
  );
  await mkdir(taskRoot, { recursive: true });
  await mkdir(output, { recursive: true });
  assert(
    !existsSync(join(output, 'report.json')),
    'Evidence report already exists',
  );
  const work = await mkdtemp(join(taskRoot, 'fixed-'));
  await mkdir(join(work, 'browser-temp'));
  process.env.TEMP = process.env.TMP = join(work, 'browser-temp');
  process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
  const inputs = new Map();
  async function bind(path) {
    const absolute = resolve(path);
    if (!existsSync(absolute) || absolute.includes(`${sep}node_modules${sep}`))
      return;
    const bytes = await readFile(absolute),
      record = {
        path: local(absolute),
        bytes: bytes.length,
        sha256: sha256(bytes),
      };
    assert(
      !inputs.has(record.path) ||
        inputs.get(record.path).sha256 === record.sha256,
      `Input changed: ${record.path}`,
    );
    inputs.set(record.path, record);
  }
  const report = {
    schemaVersion: 1,
    result: 'running',
    contract: selection.version,
    layer: selection.layer,
    scopes: selection.scopes,
    expectedCaseIds: selection.expectedCaseIds,
    selectedCaseIds: selection.selectedCaseIds,
    migratedVariants: selection.variants,
    checks: [],
    screenshots: [],
    errors: [],
    boundaries: [
      'Current production React and adapter in hidden muted Edge, 127.0.0.1. Source viewport evidence only.',
      'Legal rule projections do not prove transport, persistence, natural matches, physical devices, native DPI or an installer.',
      'Only explicitly registered migrated variants are selected. No other game has fixed-canvas acceptance from this report.',
      'CSS scale remains one. Native display zoom and physical DPI require their independent profile evidence.',
    ],
  };
  let server, browser;
  try {
    await bind('tools/test/platform/verify-public-screen-retirement-ui.mjs');
    await bind('tools/test/platform/verify-fixed-canvas-contract.mjs');
    await bind('tools/test/platform/fixed-canvas-contract.mjs');
    const fixture = selection.variants.length
      ? await prepareSelected()
      : { createdAt: Date.now(), games: {}, proof: { entries: [] } };
    const fixturePath = join(work, 'fixtures.json');
    await writeFile(fixturePath, JSON.stringify(fixture));
    await bind(fixturePath);
    await writeFile(
      join(output, 'legal-fixtures.json'),
      JSON.stringify(fixture, null, 2) + '\n',
    );
    report.fixture = {
      path: local(join(output, 'legal-fixtures.json')),
      sha256: sha256(await readFile(join(output, 'legal-fixtures.json'))),
      proof: fixture.proof,
    };
    await writeFile(
      join(work, 'index.html'),
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
    );
    await writeFile(join(work, 'entry.tsx'), fixtureEntry(selection));
    await build({
      root: work,
      configFile: false,
      base: './',
      assetsInclude: ['**/*.flac'],
      plugins: [
        leanCatalogPlugin(resolve('.')),
        react(),
        {
          name: 'bind-fixed-contract-inputs',
          async load(id) {
            if (!id.startsWith('\0')) await bind(id.split('?')[0]);
            return null;
          },
        },
      ],
      resolve: {
        alias: [
          ...Object.entries(aliases()).map(([find, replacement]) => ({
            find,
            replacement,
          })),
          {
            find: 'react',
            replacement: resolve('apps/web/node_modules/react'),
          },
          {
            find: 'react-dom',
            replacement: resolve('apps/web/node_modules/react-dom'),
          },
        ],
      },
      build: {
        outDir: join(work, 'bundle'),
        target: 'chrome110',
        emptyOutDir: true,
      },
      logLevel: 'error',
    });
    server = await serveFixture(join(work, 'bundle'));
    browser = await launchTestBrowser({ channel: 'msedge', headless: true });
    report.environment = {
      node: process.version,
      browser: browser.version(),
      hidden: true,
      muted: true,
      listen: '127.0.0.1',
      physicalDpi: false,
      hasTouch: true,
      reducedMotion: 'reduce',
    };
    const context = await browser.newContext({
      reducedMotion: 'reduce',
      hasTouch: true,
    });
    await context.addInitScript((time) => {
      Date.now = () => time;
      localStorage.setItem('tablemax-sound-enabled', 'false');
    }, fixture.createdAt);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.route('**/assets/games/**', async (route) => {
      const path = resolve(
        '.' + decodeURIComponent(new URL(route.request().url()).pathname),
      );
      assert(path.startsWith(resolve('assets/games') + sep));
      const bytes = await readFile(path);
      await bind(path);
      const type =
        {
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.jpg': 'image/jpeg',
          '.flac': 'audio/flac',
          '.wav': 'audio/wav',
          '.ogg': 'audio/ogg',
        }[extname(path)] ?? 'application/octet-stream';
      await route.fulfill({ body: bytes, contentType: type });
    });
    let failures = 0;
    const budget = failureLimit();
    for (const item of selection.cases) {
      if (failures >= budget) {
        report.checks.push({
          ...item,
          result: 'pending',
          reason: 'Failure budget reached',
        });
        continue;
      }
      try {
        await page.setViewportSize({ width: item.width, height: item.height });
        await page.goto(server.url);
        await page.waitForFunction(
          () => typeof window.renderFixedCase === 'function',
        );
        await page.evaluate((value) => window.renderFixedCase(value), item);
        await settle(page);
        await chooseLayout(page, item.layout);
        const measurements =
          item.layer === 'adapter'
            ? await checkAdapter(page, item, async (stage) => {
                const screenshot = await capture(
                  page,
                  output,
                  `${item.id}-${stage}`,
                );
                report.screenshots.push(screenshot);
                return screenshot;
              })
            : await checkGame(page, item);
        const screenshot = await capture(page, output, item.id);
        report.screenshots.push(screenshot);
        report.checks.push({
          ...item,
          result: 'passed',
          evidence: measurements,
          screenshot,
        });
      } catch (error) {
        failures++;
        const screenshot = await capture(
          page,
          output,
          `failure-${item.id}`,
        ).catch(() => null);
        if (screenshot) report.screenshots.push(screenshot);
        report.checks.push({
          ...item,
          result: 'failed',
          error: String(error.stack ?? error),
          ...(screenshot ? { screenshot } : {}),
        });
      }
    }
    report.result =
      failures ||
      report.errors.length ||
      report.checks.some((item) => item.result === 'pending')
        ? 'failed'
        : 'passed';
    async function prepareSelected() {
      const preparation = join(work, 'prepare.ts');
      const entries = selection.variants.map((key) => ({
        key,
        ...fixedCanvasVariants[key],
      }));
      await writeFile(
        preparation,
        `import{writeFileSync}from'node:fs';import{RoomCoordinator}from ${quoted('packages/platform-core/src/room.ts')};import{allowsGameAction}from ${quoted('packages/platform-core/src/game-actions.ts')};import{RoomViewSchema}from ${quoted('packages/protocol/src/index.ts')};import{preparePublicScreenRetirement}from ${quoted('tools/test/fixtures/prepare-public-screen-retirement.ts')};${entries.map((entry, index) => `import{rules as r${index}}from ${quoted(join(entry.path, entry.rules))};import{bot as b${index}}from ${quoted(join(entry.path, entry.bot))};`).join('')}const entries=[${entries.map((entry, index) => `{key:${JSON.stringify(entry.key)},rules:r${index},bot:b${index}}`).join(',')}];preparePublicScreenRetirement(entries,(entry,repository)=>new RoomCoordinator(entry.rules,entry.bot,repository),input=>RoomViewSchema.parse(input),allowsGameAction,{selectedKeys:${JSON.stringify(selection.variants)},includeMixedName:true}).then(value=>writeFileSync(${quoted(join(work, 'legal-fixtures.json'))},JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1});`,
      );
      const bundle = await bundleNode({
        entryPoints: [preparation],
        outfile: join(work, 'prepare.cjs'),
        bundle: true,
        platform: 'node',
        target: 'node22',
        format: 'cjs',
        metafile: true,
        alias: aliases(),
        logLevel: 'silent',
      });
      for (const path of Object.keys(bundle.metafile.inputs)) await bind(path);
      const result = spawnSync(process.execPath, [join(work, 'prepare.cjs')], {
        encoding: 'utf8',
        env: process.env,
        windowsHide: true,
        timeout: 120000,
      });
      await writeFile(
        join(output, 'preparation.log'),
        `${result.stdout ?? ''}${result.stderr ?? ''}`,
      );
      assert.equal(
        result.status,
        0,
        `Legal preparation failed: ${result.stderr}`,
      );
      return JSON.parse(
        await readFile(join(work, 'legal-fixtures.json'), 'utf8'),
      );
    }
  } catch (error) {
    report.result = 'failed';
    report.errors.push(String(error.stack ?? error));
  } finally {
    await browser?.close();
    await server?.close();
    report.inputs = [...inputs.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    );
    for (const input of report.inputs) {
      try {
        const bytes = await readFile(resolve(input.path));
        assert.equal(
          sha256(bytes),
          input.sha256,
          `Input changed: ${input.path}`,
        );
        const generated = relative(work, resolve(input.path));
        if (!generated.startsWith('..' + sep) && !isAbsolute(generated)) {
          const archived = join(output, 'generated-inputs', generated);
          await mkdir(dirname(archived), { recursive: true });
          await writeFile(archived, bytes);
          input.archivedPath = local(archived);
        }
      } catch (error) {
        report.result = 'failed';
        report.errors.push(String(error));
      }
    }
    for (const path of [
      'tools/test/platform/verify-public-screen-retirement-ui.mjs',
      'tools/test/platform/verify-fixed-canvas-contract.mjs',
      'tools/test/platform/fixed-canvas-contract.mjs',
    ]) {
      const target = join(output, 'verifier', path.split('/').at(-1));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await readFile(path));
    }
    report.summary = {
      declared: selection.expectedCaseIds.length,
      selected: selection.cases.length,
      executed: report.checks.filter((item) => item.result !== 'pending')
        .length,
      passed: report.checks.filter((item) => item.result === 'passed').length,
      failed: report.checks.filter((item) => item.result === 'failed').length,
      pending: report.checks.filter((item) => item.result === 'pending').length,
      reused: 0,
      screenshots: report.screenshots.length,
    };
    await writeFile(
      join(output, 'report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(
      JSON.stringify({
        result: report.result,
        ...report.summary,
        report: local(join(output, 'report.json')),
      }),
    );
  }
  if (report.result !== 'passed') process.exitCode = 1;
}

function fixtureEntry(selection) {
  const games = selection.variants.length > 0;
  return `import React,{useEffect,useLayoutEffect,useState}from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{FixedCanvasFrame,PlayerLayoutControl,OverlayPanel,SettingHelp,useGameLayout}from'@tablemax/web-host';${games ? `import{PlatformGame}from ${quoted('apps/web/src/session/gameHostAdapter.tsx')};${selection.variants.map((key, index) => `import{client as c${index}}from ${quoted(join(fixedCanvasVariants[key].path, 'web/index.tsx'))};`).join('')}` : ''}import fixtures from'./fixtures.json';import ${quoted('apps/web/src/styles.css')};import ${quoted('apps/web/src/scrollbars.css')};
const style=document.createElement('style');style.textContent='html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}.contract-fixture{box-sizing:border-box;padding:16px;font-size:18px;height:100%;background:#fffbe8;color:#182d36}.contract-fixture h1{font-size:24px}.contract-fixture input,.contract-fixture button,.contract-fixture select{font-size:18px;min-height:44px;max-width:100%;box-sizing:border-box}.contract-fixture label{display:block;margin:12px 0}.contract-target{position:absolute;right:8px;bottom:8px;width:48px;height:48px}.contract-fixture p{font-size:16px;max-width:100%;overflow-wrap:anywhere}';document.head.append(style);
const root=createRoot(document.getElementById('root'));window.fixtureCommands=[];window.contractMounts=0;window.contractUnmounts=0;window.contractDrags=[];window.contractClicks=0;window.contractSubmissions=0;window.contractContext=null;const noop=()=>{};
function Probe(){const layout=useGameLayout();useLayoutEffect(()=>{window.contractContext=layout});useEffect(()=>{window.contractMounts++;return()=>{window.contractUnmounts++}},[]);return null}
function Adapter(){const [draft,setDraft]=useState('未提交草稿');const [panel,setPanel]=useState(false);return <><Probe/><div className="contract-fixture"><h1>固定画布契约</h1><p>一起开心玩桌游呀 WWWWWWWWWWWWWWWW 朋友WWWWWWWWWWWW</p><label>草稿<input aria-label="契约草稿" value={draft} onChange={event=>setDraft(event.target.value)}/></label><PlayerLayoutControl/><button type="button" aria-label="打开契约面板" onClick={()=>setPanel(true)}>查看详情</button><SettingHelp label="契约设置说明" hint="真实SettingHelp的浮层必须保持可读，并在窗口变化后仍然可达。"/><button type="button" aria-label="确认契约草稿" style={{position:'absolute',left:16,bottom:72}} onClick={()=>window.contractSubmissions++}>确认草稿</button><button className="contract-target" aria-label="边缘命中" onClick={()=>window.contractClicks++} onPointerDown={event=>event.currentTarget.setPointerCapture(event.pointerId)} onPointerUp={event=>window.contractDrags.push(window.contractContext.clientToLogical({x:event.clientX,y:event.clientY}))}>落点</button>{panel&&<OverlayPanel title="契约真实浮窗" close={()=>setPanel(false)}><label>面板草稿<input aria-label="面板草稿" defaultValue="浮窗内未提交内容"/></label><p>这是生产OverlayPanel创建的原生dialog和portal，不是模拟div。</p></OverlayPanel>}</div></>}
${games ? `const originals={${selection.variants.map((key, index) => `${JSON.stringify(key)}:c${index}`).join(',')}};const clients=Object.fromEntries(Object.entries(originals).map(([key,original])=>[key,{...original,Screen:({session})=><><Probe/><original.Screen session={session}/></>}]));function session(key,role){const view=fixtures.games[key].playing[role];return{role,view,isHost:role==='host',canControl:view.capabilities.control,canManageSeats:view.capabilities.manageSeats,self:view.seats.find(seat=>seat.id===view.self.seatId),credential:'fixture',connected:true,locked:false,busy:false,message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],saved:false,submitting:false,name:'',setName:noop,command:command=>window.fixtureCommands.push(command),retry:noop,retryAdmission:noop,subscribeInteractions:()=>noop,subscribeInteractionReset:()=>noop,addresses:['127.0.0.1'],adapters:[],port:38473,catalog:view.catalog,games:view.catalog,address:'127.0.0.1',joinUrl:'http://127.0.0.1:38473/',externalJoinUrl:null,networkMessage:'',refreshNetwork:noop,setAddress:noop,saveExternalJoinUrl:async()=>true,join:noop,setPlayerCredential:noop}}` : ''}
window.renderFixedCase=item=>{window.fixtureCommands=[];history.replaceState(null,'','/'+item.role+(item.layer==='adapter'?'':'/game'));${games ? `if(item.layer!=='adapter'){if(originals[item.variant].layout?.contract!=='fixed-v1')throw new Error('Game is not migrated to fixed-v1');const s=session(item.variant,item.role);window.fixtureSession=s;flushSync(()=>root.render(<PlatformGame session={s} client={clients[item.variant]}/>));return;}` : ''}flushSync(()=>root.render(<FixedCanvasFrame role={item.role}><Adapter/></FixedCanvasFrame>))};`;
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) => image.decode().catch(() => {})),
    );
  });
  await page.waitForFunction(
    () =>
      window.contractContext !== null &&
      document.querySelector('[data-fixed-canvas]'),
  );
  await page.evaluate(async () => {
    let previous = '',
      stableSince = performance.now();
    for (let frame = 0; frame < 120; frame++) {
      await new Promise((done) => requestAnimationFrame(done));
      const sample = JSON.stringify(
        [
          ...document.querySelectorAll(
            '[data-fixed-canvas],[data-canvas-viewport],main',
          ),
        ].map((node) => {
          const rect = node.getBoundingClientRect();
          return [
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            node.getAttribute('data-canvas-layout'),
            node.getAttribute('data-fit-status'),
          ];
        }),
      );
      if (sample !== previous) {
        previous = sample;
        stableSince = performance.now();
      }
      if (performance.now() - stableSince >= 200) return;
    }
    throw new Error('Fixed canvas did not settle for 200ms');
  });
}
async function chooseLayout(page, layout) {
  await page.evaluate((value) => {
    if (window.contractContext?.setPreference && value !== 'host')
      window.contractContext.setPreference(
        value === 'player-portrait' ? 'portrait' : 'wide',
      );
  }, layout);
  await settle(page);
}
async function measure(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-fixed-canvas]'),
      viewport = document.querySelector('[data-canvas-viewport]');
    const rect = (node) => {
      const value = node.getBoundingClientRect();
      return {
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
      };
    };
    const context = window.contractContext;
    return {
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      },
      canvas: rect(canvas),
      outer: rect(viewport),
      outerClient: {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      },
      computedPadding: Object.fromEntries(
        ['top', 'right', 'bottom', 'left'].map((side) => [
          side,
          Number.parseFloat(
            getComputedStyle(viewport).getPropertyValue('padding-' + side),
          ) || 0,
        ]),
      ),
      canvasData: { ...canvas.dataset },
      outerData: { ...viewport.dataset },
      transform: getComputedStyle(canvas).transform,
      layout: context.layout,
      logicalSize: context.logicalSize,
      availableRect: context.availableRect,
      offset: context.offset,
      fitStatus: context.fitStatus,
      revision: context.revision,
      preference: context.preference,
      mounts: window.contractMounts,
      unmounts: window.contractUnmounts,
      commands: window.fixtureCommands.length,
      connection: window.fixtureSession?.connected ?? null,
      roomRevision: window.fixtureSession?.view.revision ?? null,
      instanceId: window.fixtureSession?.view.instanceId ?? null,
      brokenImages: [...document.images]
        .filter(
          (image) =>
            image.getBoundingClientRect().width > 0 && !image.naturalWidth,
        )
        .map((image) => image.src),
    };
  });
}
function assertLogical(value, item) {
  assert.equal(
    value.layout,
    item.layout === 'host' ? 'host-landscape' : item.layout,
  );
  assert.equal(value.logicalSize.width, item.width);
  assert.equal(value.logicalSize.height, item.height);
  assert.equal(
    value.canvas.width,
    item.width,
    'Canvas CSS width stays logical',
  );
  assert.equal(
    value.canvas.height,
    item.height,
    'Canvas CSS height stays logical',
  );
  assert(
    ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(value.transform),
    'CSS does not scale text',
  );
  assert.equal(value.brokenImages.length, 0, 'Visible images decode');
  assert.equal(value.commands, 0, 'Layout work submits no game command');
}
async function checkAdapter(page, item, captureStage) {
  const before = await measure(page);
  assertLogical(before, item);
  const snapshots = [before];
  const sizes =
    {
      'width-minus-one': [{ width: item.width - 1, height: item.height }],
      'height-minus-one': [{ width: item.width, height: item.height - 1 }],
      'wide-gutter': [{ width: item.width + 347, height: item.height }],
      'tall-gutter': [{ width: item.width, height: item.height + 311 }],
      'max-scale': [{ width: item.width * 2, height: item.height * 2 }],
      'continuous-resize': [
        { width: item.width + 200, height: item.height + 120 },
        { width: item.width, height: item.height },
      ],
    }[item.boundary] ?? [];
  await page
    .getByRole('textbox', { name: '契约草稿', exact: true })
    .fill('保持此草稿');
  if (item.boundary === 'safe-insets') {
    const insets = { top: 11, right: 17, bottom: 19, left: 13 };
    await page.setViewportSize({
      width: item.width + insets.left + insets.right,
      height: item.height + insets.top + insets.bottom,
    });
    await page.evaluate((padding) => {
      const element = document.querySelector('[data-canvas-viewport]');
      for (const [side, value] of Object.entries(padding))
        element.style.setProperty('padding-' + side, value + 'px');
    }, insets);
    await settle(page);
    const measured = await measure(page);
    assertLogical(measured, item);
    assert.deepEqual(
      measured.computedPadding,
      insets,
      'Controlled insets reach the actual computed padding',
    );
    assert.equal(
      measured.availableRect.width,
      measured.outerClient.width - insets.left - insets.right,
      'Horizontal insets are deducted exactly once',
    );
    assert.equal(
      measured.availableRect.height,
      measured.outerClient.height - insets.top - insets.bottom,
      'Vertical insets are deducted exactly once',
    );
    assert.equal(measured.availableRect.width, item.width);
    assert.equal(measured.availableRect.height, item.height);
    snapshots.push({
      controlledInput:
        'Known CSS padding simulates safety insets; not a physical notch or env(safe-area-inset-*) proof.',
      insets,
      measured,
    });
  }
  if (item.boundary === 'focused-height-change') {
    await page.evaluate(() => document.activeElement?.blur());
    await page.setViewportSize({
      width: 640,
      height: item.layout === 'player-portrait' ? 640 : 360,
    });
    await settle(page);
    await chooseLayout(page, item.layout);
    const input = page.getByRole('textbox', { name: '契约草稿', exact: true });
    await input.focus();
    const focused = await measure(page);
    await page.setViewportSize({
      width: 640,
      height: item.layout === 'player-portrait' ? 400 : 280,
    });
    await settle(page);
    const shortened = await measure(page);
    assert.equal(
      shortened.layout,
      focused.layout,
      'A focused height-only change preserves the composition',
    );
    assert.equal(
      shortened.fitStatus,
      'overflow',
      'Focused overflow is reported from the actual available height',
    );
    assert.equal(await input.inputValue(), '保持此草稿');
    const inputReachable = await reachable(page, input);
    const submitReachable = await reachable(
      page,
      page.getByRole('button', { name: '确认契约草稿', exact: true }),
    );
    assert.equal(
      await page.evaluate(() => window.contractSubmissions),
      0,
      'Height changes never submit the draft',
    );
    const screenshot = await captureStage('focused-short-height');
    await input.evaluate((element) => element.blur());
    await settle(page);
    const blurred = await measure(page);
    assert(
      ['fallback', 'overflow'].includes(blurred.fitStatus),
      'Blur allows a fitting fallback or keeps explicit overflow',
    );
    if (item.layout === 'player-portrait') {
      assert.equal(blurred.layout, 'player-landscape');
      assert.equal(blurred.fitStatus, 'fallback');
      assert.equal(
        blurred.preference,
        'portrait',
        'Fallback preserves the explicit preference',
      );
    }
    snapshots.push({
      controlledInput:
        'A real focused input plus Playwright CSS viewport height changes; not an actual software keyboard.',
      focused,
      shortened,
      blurred,
      inputReachable,
      submitReachable,
      screenshot,
    });
  }
  if (item.boundary === 'unfocused-dynamic-height') {
    await page.evaluate(() => document.activeElement?.blur());
    for (const height of [
      item.height + 93,
      item.height - 1,
      item.height + 47,
      item.height,
    ]) {
      await page.setViewportSize({ width: item.width, height });
      await settle(page);
      const measured = await measure(page);
      assertLogical(measured, item);
      assert.equal(measured.mounts, before.mounts);
      assert.equal(measured.unmounts, before.unmounts);
      snapshots.push({
        controlledInput:
          'Unfocused viewport height simulation; not a real browser address bar.',
        measured,
      });
    }
  }
  if (item.boundary === 'overlay-focus') {
    const opener = page.getByRole('button', {
      name: '打开契约面板',
      exact: true,
    });
    await opener.click();
    const dialog = page.getByRole('dialog', {
      name: '契约真实浮窗',
      exact: true,
    });
    await dialog.waitFor({ state: 'visible' });
    assert(
      await dialog.evaluate(
        (element) =>
          element instanceof HTMLDialogElement && element.matches(':modal'),
      ),
      'Production OverlayPanel opens a native modal dialog',
    );
    await page
      .getByRole('textbox', { name: '面板草稿', exact: true })
      .fill('浮窗实际输入');
    const dialogGeometry = await reachable(page, dialog);
    const modalScreenshot = await captureStage('native-dialog');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert(
      await opener.evaluate((element) => document.activeElement === element),
      'Closing the real modal restores its opener focus',
    );
    const help = page.getByRole('button', {
      name: '契约设置说明',
      exact: true,
    });
    await help.focus();
    const tooltip = page.getByRole('tooltip', {
      name: '真实SettingHelp的浮层必须保持可读，并在窗口变化后仍然可达。',
      exact: true,
    });
    await tooltip.waitFor({ state: 'visible' });
    assert(
      await tooltip.evaluate((element) => element.matches(':popover-open')),
      'Production SettingHelp opens the native popover layer',
    );
    await page.setViewportSize({
      width: item.width + 64,
      height: item.height + 32,
    });
    await settle(page);
    const tooltipGeometry = await reachable(page, tooltip);
    const popoverScreenshot = await captureStage('native-popover');
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'detached' });
    assert(
      await help.evaluate((element) => document.activeElement === element),
      'Escape keeps focus on the actual help control',
    );
    snapshots.push({
      components: ['OverlayPanel', 'SettingHelp'],
      dialogGeometry,
      tooltipGeometry,
      focusRestored: true,
      modalScreenshot,
      popoverScreenshot,
    });
  }
  for (const size of sizes) {
    await page.setViewportSize(size);
    await settle(page);
    const next = await measure(page);
    assertLogical(next, item);
    snapshots.push(next);
  }
  const after = snapshots.at(-1);
  if (item.boundary.endsWith('minus-one'))
    assert.equal(after.fitStatus, 'overflow', 'Insufficient space is explicit');
  if (['wide-gutter', 'tall-gutter'].includes(item.boundary)) {
    assert(
      Math.abs(
        after.canvas.x - (after.outer.x + (after.outer.width - item.width) / 2),
      ) <= 1,
    );
    assert(
      Math.abs(
        after.canvas.y -
          (after.outer.y + (after.outer.height - item.height) / 2),
      ) <= 1,
    );
  }
  if (item.boundary === 'manual-selection' && item.role === 'player') {
    const control = page.getByLabel('显示布局', { exact: true });
    await control.selectOption(
      item.layout === 'player-portrait' ? 'wide' : 'portrait',
    );
    await settle(page);
    const manual = await measure(page);
    snapshots.push(manual);
    assert.equal(
      manual.preference,
      item.layout === 'player-portrait' ? 'wide' : 'portrait',
    );
    await chooseLayout(page, item.layout);
  }
  if (item.boundary === 'coordinates') {
    const target = page.getByRole('button', { name: '边缘命中', exact: true });
    const box = await target.boundingBox();
    assert(box);
    await target.click();
    const roundTrip = await page.evaluate(
      ({ x, y }) => {
        const ctx = window.contractContext;
        const point = ctx.clientToLogical({ x, y });
        return {
          point,
          back: ctx.logicalToClient(point),
          clicks: window.contractClicks,
          drags: window.contractDrags,
        };
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    assert.equal(roundTrip.clicks, 1);
    assert(Math.abs(roundTrip.back.x - (box.x + box.width / 2)) <= 0.5);
    assert(Math.abs(roundTrip.back.y - (box.y + box.height / 2)) <= 0.5);
    assert.equal(roundTrip.drags.length, 1);
    const end = {
      x: box.x + box.width / 2 - 60,
      y: box.y + box.height / 2 - 60,
    };
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 4 });
    await page.mouse.up();
    const drag = await page.evaluate(
      (point) => ({
        actual: window.contractDrags.at(-1),
        expected: window.contractContext.clientToLogical(point),
        count: window.contractDrags.length,
      }),
      end,
    );
    assert.equal(drag.count, 2, 'Pointer capture preserves the drag endpoint');
    assert(Math.abs(drag.actual.x - drag.expected.x) <= 0.5);
    assert(Math.abs(drag.actual.y - drag.expected.y) <= 0.5);
    snapshots.push({ coordinateRoundTrip: roundTrip, drag });
  }
  assert.equal(
    await page
      .getByRole('textbox', { name: '契约草稿', exact: true })
      .inputValue(),
    '保持此草稿',
  );
  const final = await measure(page);
  assert.equal(
    final.mounts,
    before.mounts,
    'Resizing preserves mounted identity',
  );
  assert.equal(final.unmounts, before.unmounts);
  return { snapshots, final, draftRetained: true };
}
async function reachable(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const result = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const hit = document.elementFromPoint(center.x, center.y);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      viewport: { width: innerWidth, height: innerHeight },
      reachable:
        rect.x >= -1 &&
        rect.y >= -1 &&
        rect.right <= innerWidth + 1 &&
        rect.bottom <= innerHeight + 1,
      uncovered: hit === element || element.contains(hit),
    };
  });
  assert(
    result.reachable && result.uncovered,
    'The actual input, action or overlay is reachable without occlusion after scrolling',
  );
  return result;
}
async function checkGame(page, item) {
  const before = await measure(page);
  assertLogical(before, item);
  assert.equal(before.fitStatus, 'fits');
  const content = await page.evaluate(() => {
    const main = document.querySelector('main');
    const problems = [];
    const texts = [];
    for (const element of main?.querySelectorAll('*') ?? []) {
      if (
        element.closest('[aria-hidden="true"],.tablemax-visually-hidden') ||
        element.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      )
        continue;
      const style = getComputedStyle(element),
        rect = element.getBoundingClientRect();
      if (
        !rect.width ||
        !rect.height ||
        style.visibility === 'hidden' ||
        style.display === 'none'
      )
        continue;
      const ownText = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim())
        .filter(Boolean)
        .join(' ');
      if (!ownText) continue;
      const font = Number.parseFloat(style.fontSize);
      const text = {
        tag: element.tagName,
        className: element.getAttribute('class') ?? '',
        text: ownText,
        font,
        width: rect.width,
        height: rect.height,
      };
      texts.push(text);
      if (font < 16)
        problems.push({
          ...text,
          reason: 'Information text is smaller than 16 CSS px',
        });
      if (
        style.textOverflow === 'ellipsis' &&
        element.scrollWidth > element.clientWidth + 1
      )
        problems.push({
          ...text,
          reason: 'Information is truncated with an ellipsis',
        });
    }
    return {
      text: main?.innerText ?? '',
      regions: document.querySelectorAll(
        'main [class*=board],main [class*=workspace],main [class*=auction],main [class*=hand]',
      ).length,
      textMetrics: texts,
      readabilityProblems: problems,
    };
  });
  assert(
    content.text.trim().length > 20 && content.regions >= 1,
    'Real game content renders',
  );
  assert.equal(
    content.readabilityProblems.length,
    0,
    JSON.stringify(content.readabilityProblems.slice(0, 20)),
  );
  if (item.layer === 'content') return { before, content };
  const input = page.locator('main #ma-bid-amount:not([disabled])');
  let draft;
  if (await input.count()) {
    await input.fill('17');
    draft = {
      selector: await input.getAttribute('id'),
      value: await input.inputValue(),
    };
  }
  const snapshots = [before];
  for (const size of [
    { width: item.width + 217, height: item.height + 111 },
    { width: item.width + 43, height: item.height + 53 },
    { width: item.width, height: item.height },
  ]) {
    await page.setViewportSize(size);
    await settle(page);
    const value = await measure(page);
    assertLogical(value, item);
    snapshots.push(value);
    assert.equal(value.mounts, before.mounts);
    assert.equal(value.unmounts, before.unmounts);
    assert.equal(value.connection, true);
    assert.equal(value.roomRevision, before.roomRevision);
    assert.equal(value.instanceId, before.instanceId);
    if (draft)
      assert.equal(
        await input.inputValue(),
        draft.value,
        'Game draft survives resize',
      );
  }
  return {
    snapshots,
    content,
    draft: draft ?? {
      applicable: false,
      reason:
        'This legal projection exposes no editable draft; no draft retention claim.',
    },
    sameMountedSession: true,
  };
}
async function capture(page, output, id) {
  const path = join(output, 'screenshots', `${id}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  return {
    path: local(path),
    sha256: sha256(await readFile(path)),
    fullPage: false,
  };
}
