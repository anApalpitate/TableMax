import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, realpathSync } from 'node:fs';
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
import {
  controlledCanvasFontFaces,
  readMsEdgeRuntime,
  readControlledCanvasFonts,
} from '../support/msedge-runtime.mjs';
import { failureLimit } from '../runner/failure-policy.mjs';
import {
  fixedCanvasVariants,
  fixedCanvasAdapterClock,
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
    requestDiagnostics: [],
    boundaries: [
      'Current production React and adapter in hidden muted Edge, 127.0.0.1. Source viewport evidence only.',
      'Legal rule projections do not prove transport, persistence, natural matches, physical devices, native DPI or an installer.',
      'Only explicitly registered migrated variants are selected. No other game has fixed-canvas acceptance from this report.',
      'CSS scale remains one. Native display zoom and physical DPI require their independent profile evidence.',
    ],
  };
  let server, browser, browserRuntime, fontRuntime;
  try {
    browserRuntime = readMsEdgeRuntime();
    fontRuntime =
      selection.layer === 'adapter' ? readControlledCanvasFonts() : null;
    await bind('tools/test/platform/verify-public-screen-retirement-ui.mjs');
    await bind('tools/test/platform/verify-fixed-canvas-contract.mjs');
    await bind('tools/test/platform/fixed-canvas-contract.mjs');
    const fixture = selection.variants.length
      ? await prepareSelected()
      : {
          createdAt: fixedCanvasAdapterClock,
          games: {},
          proof: { entries: [] },
        };
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8">' +
        (selection.playerFrame ? '<base href="/">' : '') +
        '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
    );
    await writeFile(join(work, 'entry.tsx'), fixtureEntry(selection));
    await build({
      root: work,
      configFile: false,
      base: selection.playerFrame ? '/' : './',
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
    if (fontRuntime) {
      const fontDirectory = join(work, 'bundle', '__tablemax-contract-fonts');
      await mkdir(fontDirectory);
      for (const face of fontRuntime.faces) {
        const bytes = await readFile(face.path);
        assert.equal(
          sha256(bytes),
          face.sha256,
          'Controlled font changed before serving',
        );
        await writeFile(
          join(fontDirectory, face.id + extname(face.file)),
          bytes,
        );
      }
      report.controlledFonts = {
        ...fontRuntime,
        boundary:
          'Exact local bytes served as named faces on loopback. Font bytes remain only in task tmp, never in evidence/delivery. Controlled source fixture, not OS font mapping or physical-device proof.',
      };
    }
    server = await serveFixture(join(work, 'bundle'));
    browser = await launchTestBrowser({
      executablePath: browserRuntime.executable.path,
      headless: true,
      ignoreDefaultArgs: ['--hide-scrollbars'],
    });
    assert.equal(
      browser.version(),
      browserRuntime.version,
      'The launched browser matches the bound msedge runtime',
    );
    report.environment = {
      node: process.version,
      browser: browser.version(),
      hidden: true,
      muted: true,
      listen: '127.0.0.1',
      physicalDpi: false,
      hasTouch: true,
      reducedMotion: 'reduce',
      ignoredDefaultBrowserArgs: ['--hide-scrollbars'],
      msedge: browserRuntime,
      frozenClock: fixture.createdAt,
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
    let currentCaseId = null;
    const requestCases = new WeakMap();
    const recordRequest = (request, details) => {
      let url;
      try {
        url = new URL(request.url());
      } catch {
        return;
      }
      if (
        url.origin !== new URL(server.url).origin ||
        /(?:^|\/)favicon(?:\.[^/]*)?$/i.test(url.pathname)
      )
        return;
      let frameUrl = null;
      try {
        frameUrl = request.frame().url();
      } catch {
        /* Service worker and detached-frame requests have no frame. */
      }
      report.requestDiagnostics.push({
        caseId: requestCases.get(request) ?? currentCaseId,
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        frameUrl,
        ...details,
      });
    };
    page.on('request', (request) => requestCases.set(request, currentCaseId));
    page.on('requestfailed', (request) =>
      recordRequest(request, {
        kind: 'requestfailed',
        failure: request.failure()?.errorText ?? 'Unknown request failure',
      }),
    );
    page.on('response', (response) => {
      if (response.status() >= 400)
        recordRequest(response.request(), {
          kind: 'http-error',
          status: response.status(),
        });
    });
    if (selection.playerFrame)
      await page.route(
        (url) =>
          url.origin === new URL(server.url).origin &&
          url.pathname === '/player/game',
        async (route) =>
          route.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: await readFile(join(work, 'bundle/index.html')),
          }),
      );
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
      let surface = page;
      try {
        currentCaseId = item.id;
        await page.setViewportSize({ width: item.width, height: item.height });
        await page.goto(server.url);
        await page.waitForFunction(
          () => typeof window.renderFixedCase === 'function',
        );
        await page.evaluate((value) => window.renderFixedCase(value), item);
        if (item.playerFrame) {
          const iframe = page.locator('iframe[data-player-frame]');
          await iframe.waitFor({ state: 'visible' });
          const handle = await iframe.elementHandle();
          assert(handle);
          surface = await handle.contentFrame();
          assert(
            surface,
            'The real PlayerFrame creates its child browsing context',
          );
          await surface.waitForFunction(
            () => window.fixtureSession?.role === 'player',
          );
          await page.waitForFunction(() =>
            document.querySelector('[data-fixed-canvas-frame="true"]'),
          );
          await frameIdentity(page, true);
        }
        await settle(surface);
        await chooseLayout(surface, item.layout);
        let measurements;
        if (item.boundary === 'browser-zoom') {
          const { runBrowserZoomProof } =
            await import('./fixed-canvas-browser-zoom.mjs');
          measurements = await runBrowserZoomProof({
            browserRuntime,
            url: server.url,
            item,
            work,
            output,
            settle,
          });
          assert(
            Array.isArray(measurements.screenshots),
            'Real browser zoom proof returns its actual PNG records',
          );
          for (const screenshot of measurements.screenshots) {
            const absolute = resolve(screenshot.path),
              within = relative(output, absolute);
            assert(
              within && !within.startsWith('..' + sep) && !isAbsolute(within),
              'Browser zoom screenshots stay in the parent evidence directory',
            );
            assert.equal(
              sha256(await readFile(absolute)),
              screenshot.sha256,
              'Browser zoom screenshot bytes match their proof',
            );
            report.screenshots.push({ ...screenshot, path: local(absolute) });
          }
        } else
          measurements =
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
              : await checkGame(page, item, surface, async (stage) => {
                  const screenshot = await capture(
                    page,
                    output,
                    `${item.id}-${stage}`,
                  );
                  report.screenshots.push(screenshot);
                  return screenshot;
                });
        const screenshot = await capture(page, output, item.id);
        report.screenshots.push(screenshot);
        report.checks.push({
          ...item,
          result: 'passed',
          evidence: measurements,
          requestDiagnostics: report.requestDiagnostics.filter(
            (entry) => entry.caseId === item.id,
          ),
          screenshot,
        });
      } catch (error) {
        failures++;
        const diagnosticMeasurements = await measure(surface).catch(() => null);
        const diagnosticIframe = item.playerFrame
          ? await frameIdentity(page).catch(() => null)
          : null;
        let browserZoomEvidence, browserZoomEvidenceRejected;
        if (error.browserZoomEvidence) {
          try {
            const absolute = resolve(error.browserZoomEvidence);
            const within = relative(output, absolute);
            assert(
              within && !within.startsWith('..' + sep) && !isAbsolute(within),
              'Browser zoom failure proof must be inside this output',
            );
            const actual = realpathSync(absolute),
              actualWithin = relative(realpathSync(output), actual);
            assert(
              actualWithin &&
                !actualWithin.startsWith('..' + sep) &&
                !isAbsolute(actualWithin),
              'Linked browser zoom failure proof escapes this output',
            );
            assert(
              lstatSync(absolute).isFile() &&
                !lstatSync(absolute).isSymbolicLink(),
              'Browser zoom failure proof must be a regular file',
            );
            browserZoomEvidence = {
              path: local(actual),
              sha256: sha256(await readFile(actual)),
            };
          } catch (bindingError) {
            browserZoomEvidenceRejected = String(
              bindingError.stack ?? bindingError,
            );
          }
        }
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
          requestDiagnostics: report.requestDiagnostics.filter(
            (entry) => entry.caseId === item.id,
          ),
          ...(diagnosticMeasurements
            ? { evidence: diagnosticMeasurements }
            : {}),
          ...(diagnosticIframe ? { iframe: diagnosticIframe } : {}),
          ...(browserZoomEvidence ? { browserZoomEvidence } : {}),
          ...(browserZoomEvidenceRejected
            ? { browserZoomEvidenceRejected }
            : {}),
          ...(error.environmentCoverage
            ? { environmentCoverage: error.environmentCoverage }
            : {}),
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
    try {
      if (browserRuntime)
        assert.deepEqual(
          readMsEdgeRuntime(),
          browserRuntime,
          'Bound browser changed during verification',
        );
      if (fontRuntime)
        assert.deepEqual(
          readControlledCanvasFonts(),
          fontRuntime,
          'Controlled fonts changed during verification',
        );
    } catch (error) {
      report.result = 'failed';
      report.errors.push(String(error));
    }
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

export function fixtureEntry(selection) {
  const games = selection.variants.length > 0;
  const playerFrameImport = selection.playerFrame
    ? `import{PlayerFrame as ProductionPlayerFrame}from ${quoted('apps/web/src/components/PlayerFrame.tsx')};`
    : '';
  const platformImports = selection.platform
    ? `import{BoxOverlayPanel,BoxPanelScope}from ${quoted('apps/web/src/components/BoxOverlayPanel.tsx')};import{ConfirmationDialog}from ${quoted('apps/web/src/components/ConfirmationDialog.tsx')};import{RulesGuide as PlatformRulesGuide}from ${quoted('apps/web/src/components/RulesGuide.tsx')};import{DisplaySettings as PlatformDisplaySettings}from ${quoted('apps/web/src/components/DisplaySettings.tsx')};`
    : '';
  const controlledFontCss =
    selection.layer === 'adapter'
      ? controlledCanvasFontFaces
          .map(
            (face) =>
              `@font-face{font-family:"${face.family}";font-style:normal;font-weight:${face.weight};font-display:block;src:url("/__tablemax-contract-fonts/${face.id}${extname(face.file)}")} `,
          )
          .join('') +
        ':root{font-family:"TableMaxContractLatin","TableMaxContractCJK"}'
      : '';
  return `import React,{useEffect,useLayoutEffect,useState}from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{FixedCanvasFrame,PlayerLayoutControl,OverlayPanel,SettingHelp,useGameLayout}from'@tablemax/web-host';${platformImports}${playerFrameImport}${games ? `import{PlatformGame}from ${quoted('apps/web/src/session/gameHostAdapter.tsx')};${selection.variants.map((key, index) => `import{client as c${index}}from ${quoted(join(fixedCanvasVariants[key].path, 'web/index.tsx'))};`).join('')}` : ''}import fixtures from'./fixtures.json';import ${quoted('apps/web/src/styles.css')};import ${quoted('apps/web/src/scrollbars.css')};
const style=document.createElement('style');style.textContent=${JSON.stringify(controlledFontCss)}+'html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}.contract-fixture{box-sizing:border-box;padding:16px;font-size:18px;height:100%;background:#fffbe8;color:#182d36}.contract-fixture h1{font-size:24px}.contract-fixture input,.contract-fixture button,.contract-fixture select{font-size:18px;min-height:44px;max-width:100%;box-sizing:border-box}.contract-fixture label{display:block;margin:12px 0}.contract-target{position:absolute;right:8px;bottom:8px;width:48px;height:48px;padding:0}.contract-fixture p{font-size:16px;max-width:100%;overflow-wrap:anywhere}';document.head.append(style);window.controlledCanvasFontFaces=${JSON.stringify(selection.layer === 'adapter' ? controlledCanvasFontFaces : [])};
const root=createRoot(document.getElementById('root'));window.fixtureCommands=[];window.contractMounts=0;window.contractUnmounts=0;window.contractDrags=[];window.contractClicks=0;window.contractSubmissions=0;window.contractContext=null;const noop=()=>{};
${selection.playerFrame ? `window.contractParentMounts=0;window.contractParentUnmounts=0;window.integrationIframeLoads=0;function PlayerFrameHarness({source}){useLayoutEffect(()=>{const frames=document.querySelectorAll('iframe[data-player-frame]');if(frames.length!==1)throw new Error('PlayerFrame harness requires exactly one real iframe');const frame=frames[0];const loaded=()=>{window.integrationIframeLoads++};frame.addEventListener('load',loaded);return()=>frame.removeEventListener('load',loaded)},[]);useEffect(()=>{window.contractParentMounts++;return()=>{window.contractParentUnmounts++}},[]);return <ProductionPlayerFrame initialUrl={source}/>}` : ''}
function Probe(){const layout=useGameLayout();useLayoutEffect(()=>{window.contractContext=layout});useEffect(()=>{window.contractMounts++;return()=>{window.contractUnmounts++}},[]);return null}
function Adapter(){const [draft,setDraft]=useState('未提交草稿');const [panel,setPanel]=useState(false);return <><Probe/><div className="contract-fixture"><h1>固定画布契约</h1><p>一起开心玩桌游呀 WWWWWWWWWWWWWWWW 朋友WWWWWWWWWWWW</p><label>草稿<input aria-label="契约草稿" value={draft} onChange={event=>setDraft(event.target.value)}/></label><PlayerLayoutControl/><button type="button" aria-label="打开契约面板" onClick={()=>setPanel(true)}>查看详情</button><SettingHelp label="契约设置说明" hint="真实SettingHelp的浮层必须保持可读，并在窗口变化后仍然可达。"/><button type="button" aria-label="确认契约草稿" style={{position:'absolute',left:16,bottom:72}} onClick={()=>window.contractSubmissions++}>确认草稿</button><button className="contract-target" aria-label="边缘命中" onClick={()=>window.contractClicks++} onPointerDown={event=>event.currentTarget.setPointerCapture(event.pointerId)} onPointerUp={event=>window.contractDrags.push(window.contractContext.clientToLogical({x:event.clientX,y:event.clientY}))}>落点</button>{panel&&<OverlayPanel title="契约真实浮窗" close={()=>setPanel(false)}><label>面板草稿<input aria-label="面板草稿" defaultValue="浮窗内未提交内容"/></label><p>这是生产OverlayPanel创建的原生dialog和portal，不是模拟div。</p></OverlayPanel>}</div></>}
${games ? `const originals={${selection.variants.map((key, index) => `${JSON.stringify(key)}:c${index}`).join(',')}};const clients=Object.fromEntries(Object.entries(originals).map(([key,original])=>[key,{...original,Screen:({session})=><><Probe/><original.Screen session={session}/></>}]));function session(key,role){const view=fixtures.games[key].playing[role];return{role,view,isHost:role==='host',canControl:view.capabilities.control,canManageSeats:view.capabilities.manageSeats,self:view.seats.find(seat=>seat.id===view.self.seatId),credential:'fixture',connected:true,locked:false,busy:false,message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],saved:false,submitting:false,name:'',setName:noop,command:command=>window.fixtureCommands.push(command),retry:noop,retryAdmission:noop,subscribeInteractions:()=>noop,subscribeInteractionReset:()=>noop,addresses:['127.0.0.1'],adapters:[],port:38473,catalog:view.catalog,games:view.catalog,address:'127.0.0.1',joinUrl:'http://127.0.0.1:38473/',externalJoinUrl:null,networkMessage:'',refreshNetwork:noop,setAddress:noop,saveExternalJoinUrl:async()=>true,join:noop,setPlayerCredential:noop}}` : ''}
${selection.platform ? platformFixtureCode() : ''}
window.renderFixedCase=item=>{window.fixtureCommands=[];history.replaceState(null,'','/'+item.role+(item.layer==='adapter'?'':'/game'));${selection.playerFrame ? `if(item.playerFrame&&window.self===window.top){flushSync(()=>root.render(<PlayerFrameHarness source={'/player/game?fixed-canvas-case='+encodeURIComponent(item.id)}/>));return;}` : ''}${games ? `if(item.layer!=='adapter'){if(originals[item.variant].layout?.contract!=='fixed-v1')throw new Error('Game is not migrated to fixed-v1');const s=session(item.variant,item.role);window.fixtureSession=s;flushSync(()=>root.render(<PlatformGame session={s} client={clients[item.variant]}/>));return;}` : ''}${selection.platform ? `if(item.platform){installPlatformServices(item.role);flushSync(()=>root.render(<FixedCanvasFrame role={item.role}><PlatformOverlayFixture role={item.role}/></FixedCanvasFrame>));return;}` : ''}flushSync(()=>root.render(<FixedCanvasFrame role={item.role}><Adapter/></FixedCanvasFrame>))};
${selection.playerFrame ? `const childCaseId=new URLSearchParams(location.search).get('fixed-canvas-case');if(window.frameElement&&childCaseId){const item=${JSON.stringify(selection.cases)}.find(value=>value.id===childCaseId&&value.playerFrame);if(!item)throw new Error('Unknown iframe integration case');window.renderFixedCase(item);}` : ''}`;
}

function platformFixtureCode() {
  return `
function installPlatformServices(role){window.platformCounters={displayReads:0,displayUpdates:[],windowReads:0,windowModes:[],confirms:0};if(role!=='host'){delete window.tablemaxDisplay;delete window.tablemaxWindow;return}let display={preferences:{resolution:'auto',interfaceScale:100},viewport:{width:1280,height:720},screen:{width:1280,height:720,scaleFactor:1},zoomFactor:1,limited:false,layoutProfile:'fixed-host-1280-v1'};let mode='windowed';window.tablemaxDisplay={read:async()=>{window.platformCounters.displayReads++;return display},update:async preferences=>{window.platformCounters.displayUpdates.push({...preferences});display={...display,preferences};return display},subscribe:()=>noop};window.tablemaxWindow={read:async()=>{window.platformCounters.windowReads++;return{mode,fullscreen:mode==='fullscreen'}},setMode:async next=>{window.platformCounters.windowModes.push(next);mode=next;return{mode,fullscreen:mode==='fullscreen'}},setFullscreen:async enabled=>{mode=enabled?'fullscreen':'windowed';return{mode,fullscreen:enabled}},subscribe:()=>noop}}
const platformRuleChapters=[1,2,3].map(index=>({id:'ui-chapter-'+index,label:'示例章节'+['一','二','三'][index-1],title:'UI夹具规则章节'+['一','二','三'][index-1],content:<>{Array.from({length:7},(_,row)=><p key={row}>UI布局夹具段落{row+1}：这里只检查真实规则目录组件的章节、焦点和滚动，不提供任何游戏规则结论，也不表示服务端保存或原生授权已经发生。</p>)}</>}));
function PlatformOverlayFixture({role}){const [draft,setDraft]=useState('未提交草稿');const [panel,setPanel]=useState(null);return <><Probe/><BoxPanelScope><div className='contract-fixture'><h1>平台浮窗UI夹具</h1><p>真实生产组件；内容与显示服务仅受控UI输入，不代表规则、保存或原生授权。</p><label>草稿<input aria-label='契约草稿' value={draft} onChange={event=>setDraft(event.target.value)}/></label><PlayerLayoutControl/>{role==='host'&&<><button aria-label='打开平台盒子浮窗' onClick={()=>setPanel('box')}>盒子浮窗</button><button aria-label='打开平台确认' onClick={()=>setPanel('confirm')}>操作确认</button><button aria-label='打开平台规则' onClick={()=>setPanel('rules')}>规则目录</button></>}<PlatformDisplaySettings role={role}/>{panel==='box'&&<BoxOverlayPanel title='UI夹具盒子浮窗' close={()=>setPanel(null)}>{Array.from({length:18},(_,index)=><p key={index}>盒子滚动布局夹具{index+1}：这里只验证真实浮窗边框、独立滚动、关闭入口和焦点恢复，不表示任何游戏或账号操作。</p>)}<button aria-label='盒子内容尾部'>末尾可达位置</button></BoxOverlayPanel>}{panel==='confirm'&&<ConfirmationDialog title='UI夹具确认' confirmLabel='确认UI夹具操作' cancel={()=>setPanel(null)} confirm={()=>{window.platformCounters.confirms++;setPanel(null)}}><p>此确认仅增加UI夹具计数，不发送产品命令。</p></ConfirmationDialog>}{panel==='rules'&&<BoxOverlayPanel title='UI夹具规则目录' close={()=>setPanel(null)}><PlatformRulesGuide className='platform-contract-rules' summary='仅用于规则目录UI验证，不是游戏规则资料。' chapters={platformRuleChapters} source='受控布局夹具，没有官方规则结论。'/></BoxOverlayPanel>}</div></BoxPanelScope></>}
`;
}

async function settle(page) {
  await page.evaluate(async () => {
    window.controlledFontLoads = await Promise.all(
      (window.controlledCanvasFontFaces ?? []).map(async (face) => {
        const sample =
          face.family === 'TableMaxContractCJK' ? '契约草稿' : 'WWWW17';
        const fonts = await document.fonts.load(
          face.weight + ' 16px "' + face.family + '"',
          sample,
        );
        if (!fonts.length || fonts.some((font) => font.status !== 'loaded'))
          throw new Error('Controlled font failed to decode: ' + face.id);
        return {
          id: face.id,
          family: face.family,
          weight: face.weight,
          loaded: true,
        };
      }),
    );
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
    const box = (node) => {
      if (!node) return null;
      const style = getComputedStyle(node);
      const edges = (prefix) =>
        Object.fromEntries(
          ['top', 'right', 'bottom', 'left'].map((side) => [
            side,
            style.getPropertyValue(
              prefix + '-' + side + (prefix === 'border' ? '-width' : ''),
            ),
          ]),
        );
      return {
        tag: node.tagName,
        className: node.getAttribute('class') ?? '',
        rect: rect(node),
        scroll: {
          width: node.scrollWidth,
          height: node.scrollHeight,
          left: node.scrollLeft,
          top: node.scrollTop,
        },
        client: { width: node.clientWidth, height: node.clientHeight },
        offset: { width: node.offsetWidth, height: node.offsetHeight },
        overflow: { x: style.overflowX, y: style.overflowY },
        scrollbarGutter: style.scrollbarGutter,
        boxSizing: style.boxSizing,
        display: style.display,
        position: style.position,
        border: edges('border'),
        padding: edges('padding'),
        margin: edges('margin'),
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
      };
    };
    const fixture =
      canvas.querySelector('.contract-fixture') ?? canvas.querySelector('main');
    const beyond = (value, boundary) =>
      value.x < boundary.x - 0.5 ||
      value.y < boundary.y - 0.5 ||
      value.x + value.width > boundary.x + boundary.width + 0.5 ||
      value.y + value.height > boundary.y + boundary.height + 0.5;
    const canvasBounds = rect(canvas),
      fixtureBounds = fixture ? rect(fixture) : canvasBounds;
    const childOverflow = fixture
      ? [fixture, ...fixture.querySelectorAll('*')]
          .filter((node) => node instanceof HTMLElement)
          .flatMap((node) => {
            const bounds = rect(node);
            if (!bounds.width || !bounds.height) return [];
            const glyphs = [...node.childNodes]
              .filter(
                (child) =>
                  child.nodeType === Node.TEXT_NODE && child.textContent.trim(),
              )
              .flatMap((child) => {
                const range = document.createRange();
                range.selectNodeContents(child);
                return [...range.getClientRects()].map((value) => ({
                  x: value.x,
                  y: value.y,
                  width: value.width,
                  height: value.height,
                }));
              });
            const flags = {
              ownScrollOverflow:
                node.scrollWidth > node.clientWidth + 0.5 ||
                node.scrollHeight > node.clientHeight + 0.5,
              elementBeyondFixture: beyond(bounds, fixtureBounds),
              elementBeyondCanvas: beyond(bounds, canvasBounds),
              glyphBeyondElement: glyphs.some((glyph) => beyond(glyph, bounds)),
              glyphBeyondCanvas: glyphs.some((glyph) =>
                beyond(glyph, canvasBounds),
              ),
            };
            if (!Object.values(flags).some(Boolean)) return [];
            return [
              {
                ...box(node),
                text: node.textContent
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, 240),
                flags,
                glyphs,
              },
            ];
          })
          .slice(0, 40)
      : [];
    const context = window.contractContext;
    return {
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      },
      canvas: rect(canvas),
      outer: rect(viewport),
      layoutDiagnostics: {
        outer: box(viewport),
        canvas: box(canvas),
        fixture: box(fixture),
        childOverflow,
      },
      outerClient: {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      },
      outerOffset: {
        width: viewport.offsetWidth,
        height: viewport.offsetHeight,
      },
      computedScrollbar: {
        width: getComputedStyle(viewport, '::-webkit-scrollbar').width,
        height: getComputedStyle(viewport, '::-webkit-scrollbar').height,
        color: getComputedStyle(viewport).getPropertyValue('scrollbar-color'),
        standardWidth:
          getComputedStyle(viewport).getPropertyValue('scrollbar-width'),
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
      controlledFontLoads: window.controlledFontLoads,
      controlledFontFamily: getComputedStyle(document.documentElement)
        .fontFamily,
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
  if (item.layer === 'adapter') {
    assert.equal(
      value.controlledFontLoads.length,
      4,
      'All regular and bold controlled faces loaded',
    );
    assert(
      value.controlledFontFamily.includes('TableMaxContractLatin') &&
        value.controlledFontFamily.includes('TableMaxContractCJK'),
      'Adapter uses the explicitly loaded faces',
    );
  }
}
async function checkAdapter(page, item, captureStage) {
  const before = await measure(page);
  assertLogical(before, item);
  if (item.platform)
    return checkPlatformOverlays(page, item, before, captureStage);
  const edgeTargetBefore = await checkEdgeTargetGlyphs(page);
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
    if (item.layout === 'player-portrait')
      await page.addStyleTag({
        content:
          '[data-canvas-viewport]{scrollbar-color:auto;scrollbar-width:auto}[data-canvas-viewport]::-webkit-scrollbar{width:16px;height:16px}',
      });
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
    if (item.layout === 'player-portrait') {
      const occupiedWidth =
        shortened.outerOffset.width - shortened.outerClient.width;
      try {
        assert.equal(
          occupiedWidth,
          16,
          'Classic scrollbar environment not covered: the shortened viewport must actually reserve 16 CSS px',
        );
      } catch (error) {
        error.environmentCoverage = {
          status: 'not-covered',
          condition: 'classic-scrollbar-16px',
          requiredOccupiedWidth: 16,
          actualOccupiedWidth: occupiedWidth,
          measured: shortened,
        };
        throw error;
      }
    }
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
      ...(item.layout === 'player-portrait'
        ? {
            controlledScrollbar:
              'Controlled scrollbar-color/scrollbar-width auto with 16px webkit scrollbar CSS; actual occupied space is recorded via outerClient/outerOffset, never inferred from requested CSS.',
          }
        : {}),
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
    if (
      item.boundary === 'continuous-resize' &&
      (size.width > before.viewport.width ||
        size.height > before.viewport.height)
    )
      assert(
        next.revision > before.revision,
        'A larger available rectangle advances the layout revision',
      );
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
  const edgeTargetAfter = await checkEdgeTargetGlyphs(page);
  return {
    snapshots,
    final,
    draftRetained: true,
    edgeTargetBefore,
    edgeTargetAfter,
  };
}
async function checkEdgeTargetGlyphs(page) {
  const evidence = await page
    .getByRole('button', { name: '边缘命中', exact: true })
    .evaluate((element) => {
      const bounds = (node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      const range = document.createRange();
      range.selectNodeContents(element);
      return {
        text: element.textContent,
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        button: bounds(element),
        canvas: bounds(element.closest('[data-fixed-canvas]')),
        glyphs: [...range.getClientRects()].map((rect) => ({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        })),
      };
    });
  assert.equal(evidence.text, '落点');
  assert.equal(evidence.fontSize, 18);
  assert.equal(evidence.button.width, 48);
  assert.equal(evidence.button.height, 48);
  assert(
    evidence.glyphs.length > 0,
    'The edge target exposes actual text glyphs',
  );
  for (const glyph of evidence.glyphs) {
    const fits = (box, tolerance) =>
      glyph.x >= box.x - tolerance &&
      glyph.y >= box.y - tolerance &&
      glyph.x + glyph.width <= box.x + box.width + tolerance &&
      glyph.y + glyph.height <= box.y + box.height + tolerance;
    assert(
      fits(evidence.button, 0.5),
      'Edge target glyphs stay inside the 48px button: ' +
        JSON.stringify(evidence),
    );
    assert(
      fits(evidence.canvas, 1),
      'Edge target glyphs stay inside the logical canvas: ' +
        JSON.stringify(evidence),
    );
  }
  return evidence;
}
async function checkPlatformOverlays(page, item, before, captureStage) {
  const checks = [];
  const draft = page.getByRole('textbox', { name: '契约草稿', exact: true });
  await draft.fill('平台样本保留草稿');
  async function open(openerName, title) {
    const opener = page.getByRole('button', { name: openerName, exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await dialog.waitFor({ state: 'visible' });
    assert(
      await dialog.evaluate(
        (element) =>
          element instanceof HTMLDialogElement &&
          element.matches(':modal') &&
          element.classList.contains('box-overlay-panel'),
      ),
      'The production box component opens its actual native dialog',
    );
    return { opener, dialog, geometry: await reachable(page, dialog) };
  }
  async function closed(sample) {
    await sample.dialog.waitFor({ state: 'detached' });
    assert(
      await sample.opener.evaluate(
        (element) => document.activeElement === element,
      ),
      'Closing the production panel restores its exact opener',
    );
  }
  if (item.role === 'host') {
    const box = await open('打开平台盒子浮窗', 'UI夹具盒子浮窗');
    const heading = box.dialog.getByRole('heading', {
      name: 'UI夹具盒子浮窗',
      exact: true,
    });
    const top = await heading.boundingBox();
    const content = box.dialog.locator(':scope > .box-overlay-panel__content');
    assert(
      await content.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
      'The real box content has its own scrollable region',
    );
    const tail = await reachable(
      page,
      box.dialog.getByRole('button', { name: '盒子内容尾部', exact: true }),
    );
    assert(
      await content.evaluate((element) => element.scrollTop > 0),
      'Scrolling reaches the real content tail',
    );
    const afterScroll = await heading.boundingBox();
    assert(
      top && afterScroll && Math.abs(top.y - afterScroll.y) <= 0.5,
      'The box heading stays outside the content scroll',
    );
    checks.push({
      component: 'BoxOverlayPanel',
      geometry: box.geometry,
      tail,
      screenshot: await captureStage('box-panel-scroll'),
    });
    await box.dialog
      .getByRole('button', { name: '关闭面板', exact: true })
      .click();
    await closed(box);

    const confirmation = await open('打开平台确认', 'UI夹具确认');
    const cancel = confirmation.dialog.getByRole('button', {
      name: '取消',
      exact: true,
    });
    assert(
      await cancel.evaluate((element) => document.activeElement === element),
      'The production confirmation initially focuses Cancel',
    );
    const screenshot = await captureStage('confirmation');
    await cancel.click();
    await closed(confirmation);
    assert.equal(
      await page.evaluate(() => window.platformCounters.confirms),
      0,
    );
    const confirmed = await open('打开平台确认', 'UI夹具确认');
    await confirmed.dialog
      .getByRole('button', { name: '确认UI夹具操作', exact: true })
      .click();
    await closed(confirmed);
    assert.equal(
      await page.evaluate(() => window.platformCounters.confirms),
      1,
      'Only the explicit UI confirmation invokes its controlled callback',
    );
    checks.push({
      component: 'ConfirmationDialog',
      initialCancelFocus: true,
      cancelledWithoutCallback: true,
      explicitCallback: 1,
      screenshot,
    });

    const rules = await open('打开平台规则', 'UI夹具规则目录');
    const navigation = rules.dialog.getByRole('navigation', {
      name: '规则章节',
      exact: true,
    });
    await navigation
      .getByRole('button', { name: '示例章节三', exact: true })
      .click();
    const chapter = rules.dialog.getByRole('heading', {
      name: 'UI夹具规则章节三',
      exact: true,
    });
    assert(
      await chapter.evaluate((element) => document.activeElement === element),
      'The real rule anchor focuses its chapter heading',
    );
    const anchor = await reachable(page, chapter);
    assert(
      await rules.dialog
        .locator(':scope > .box-overlay-panel__content')
        .evaluate((element) => element.scrollTop > 0),
      'The real rule anchor advances the box scroll region',
    );
    const ruleScreenshot = await captureStage('rules-chapter-anchor');
    await rules.dialog
      .getByRole('button', { name: '回到章节', exact: true })
      .click();
    assert(
      await navigation
        .getByRole('button', { name: '示例章节一', exact: true })
        .evaluate((element) => document.activeElement === element),
      'Return to chapters restores the first actual navigation button',
    );
    await page.keyboard.press('Escape');
    await closed(rules);
    checks.push({
      component: 'RulesGuide',
      anchor,
      returnedToNavigation: true,
      sourceBoundary: 'Controlled UI chapters, not game rules',
      screenshot: ruleScreenshot,
    });
  }

  const video = await open('视频设置', '视频设置');
  const modes = video.dialog.getByRole('combobox', {
    name: '显示模式',
    exact: true,
  });
  if (item.role === 'host') {
    const resolution = video.dialog.getByRole('combobox', {
      name: '适配方式',
      exact: true,
    });
    const scale = video.dialog.getByRole('combobox', {
      name: '界面大小',
      exact: true,
    });
    assert.equal(await resolution.inputValue(), 'auto');
    assert.equal(await modes.locator('option[value="borderless"]').count(), 1);
    await scale.selectOption('125');
    await page.waitForFunction(
      () => window.platformCounters.displayUpdates.length === 1,
    );
    assert.equal(await scale.inputValue(), '125');
    const help = video.dialog.getByRole('button', {
      name: '适配方式',
      exact: true,
    });
    await help.focus();
    await page.waitForFunction(() =>
      document.activeElement?.getAttribute('aria-describedby'),
    );
    const described = await help.getAttribute('aria-describedby');
    assert(described);
    const tooltip = page.locator(
      `[id=${JSON.stringify(described)}][role="tooltip"]`,
    );
    await tooltip.waitFor({ state: 'visible' });
    assert(
      await tooltip.evaluate((element) => element.matches(':popover-open')),
      'The actual video setting help uses its native popover anchor',
    );
    const anchor = await reachable(page, tooltip);
    checks.push({
      component: 'DisplaySettings',
      role: 'host',
      controlledDisplayUpdate: { resolution: 'auto', interfaceScale: 125 },
      helpAnchor: anchor,
      screenshot: await captureStage('host-video-settings'),
    });
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'detached' });
    assert(
      await video.dialog.isVisible(),
      'Help Escape leaves the real settings dialog open',
    );
  } else {
    assert.equal(
      await video.dialog
        .locator('#display-resolution,#display-interface-scale')
        .count(),
      0,
      'A player without the desktop bridge receives no desktop display preferences',
    );
    assert.equal(
      await modes.locator('option[value="borderless"]').count(),
      0,
      'The browser player has no native borderless option',
    );
    const shooting = video.dialog.getByRole('switch', {
      name: '射击按钮',
      exact: true,
    });
    const original = await shooting.getAttribute('aria-checked');
    await shooting.click();
    assert.notEqual(
      await shooting.getAttribute('aria-checked'),
      original,
      'The actual player preference control updates locally',
    );
    await shooting.click();
    assert.equal(await shooting.getAttribute('aria-checked'), original);
    checks.push({
      component: 'DisplaySettings',
      role: 'player',
      desktopFieldsAbsent: true,
      nativeBorderlessAbsent: true,
      localPlayerPreference: true,
      screenshot: await captureStage('player-video-settings'),
    });
  }
  await page.keyboard.press('Escape');
  await closed(video);
  const counters = await page.evaluate(() => window.platformCounters);
  if (item.role === 'player')
    assert.deepEqual(
      counters,
      {
        displayReads: 0,
        displayUpdates: [],
        windowReads: 0,
        windowModes: [],
        confirms: 0,
      },
      'The browser player performs no desktop bridge operation',
    );
  else {
    assert(counters.displayReads > 0 && counters.windowReads > 0);
    assert.deepEqual(counters.displayUpdates, [
      { resolution: 'auto', interfaceScale: 125 },
    ]);
    assert.deepEqual(counters.windowModes, []);
  }
  const final = await measure(page);
  assertLogical(final, item);
  assert.equal(final.mounts, before.mounts);
  assert.equal(final.unmounts, before.unmounts);
  assert.equal(await draft.inputValue(), '平台样本保留草稿');
  return {
    before,
    checks,
    final,
    counters,
    draftRetained: true,
    boundary:
      'Production components with UI-only sample chapters and controlled host display callbacks; no rules, persistence or native authorization proof.',
  };
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
async function frameIdentity(page, remember = false) {
  return page.evaluate((capture) => {
    const iframe = document.querySelector('iframe[data-player-frame]');
    if (!iframe?.contentWindow || !iframe.contentDocument)
      throw new Error('The production player iframe is unavailable');
    if (capture)
      window.contractIframeIdentity = {
        element: iframe,
        window: iframe.contentWindow,
        document: iframe.contentDocument,
      };
    const baseline = window.contractIframeIdentity;
    return {
      sameElement: baseline?.element === iframe,
      sameContentWindow: baseline?.window === iframe.contentWindow,
      sameChildDocument: baseline?.document === iframe.contentDocument,
      source: iframe.getAttribute('src'),
      childUrl: iframe.contentWindow.location.href,
      parentMounts: window.contractParentMounts,
      parentUnmounts: window.contractParentUnmounts,
      iframeLoads: window.integrationIframeLoads,
      fixedCanvasFrame:
        document.querySelector('[data-fixed-canvas-frame="true"]') !== null,
    };
  }, remember);
}
function assertFrameIdentity(value, baseline) {
  assert(
    value.sameElement && value.sameContentWindow && value.sameChildDocument,
    'Resizing and layout selection preserve the exact iframe, window and child document',
  );
  assert.equal(value.parentMounts, baseline.parentMounts);
  assert.equal(value.parentUnmounts, baseline.parentUnmounts);
  assert.equal(
    value.iframeLoads,
    baseline.iframeLoads,
    'The iframe document never reloads',
  );
  assert.equal(value.source, baseline.source);
  assert(
    value.fixedCanvasFrame,
    'The real PlayerFrame detects its fixed canvas child',
  );
}

async function checkGame(page, item, surface = page, captureStage) {
  const before = await measure(surface);
  assertLogical(before, item);
  assert.equal(before.fitStatus, 'fits');
  const content = await surface.evaluate(() => {
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
  const input = surface.locator('main #ma-bid-amount:not([disabled])');
  const iframeBefore = item.playerFrame ? await frameIdentity(page) : null;
  if (iframeBefore) {
    assert.equal(iframeBefore.parentMounts, 1);
    assert.equal(iframeBefore.parentUnmounts, 0);
    assert.equal(iframeBefore.iframeLoads, 1);
    assertFrameIdentity(iframeBefore, iframeBefore);
  }
  let draft;
  let inputNode;
  if (await input.count()) {
    await input.fill('17');
    await input.focus();
    inputNode = await input.elementHandle();
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
    await settle(surface);
    const value = await measure(surface);
    assertLogical(value, item);
    if (
      size.width > before.viewport.width ||
      size.height > before.viewport.height
    )
      assert(
        value.revision > before.revision,
        'Game integration observes the revised available rectangle',
      );
    snapshots.push(value);
    assert.equal(value.mounts, before.mounts);
    assert.equal(value.unmounts, before.unmounts);
    assert.equal(value.connection, true);
    assert.equal(value.roomRevision, before.roomRevision);
    assert.equal(value.instanceId, before.instanceId);
    if (iframeBefore) {
      const identity = await frameIdentity(page);
      assertFrameIdentity(identity, iframeBefore);
      value.iframe = identity;
    }
    if (draft) {
      assert.equal(
        await input.inputValue(),
        draft.value,
        'Game draft survives resize',
      );
      assert(
        await inputNode.evaluate(
          (element) =>
            element.isConnected && document.activeElement === element,
        ),
        'The real game input retains its DOM identity and focus while resizing',
      );
    }
  }
  const layoutSwitches = [];
  if (item.playerFrame) {
    await page.setViewportSize({ width: 900, height: 760 });
    await settle(surface);
    const control = surface.getByRole('combobox', {
      name: '显示布局',
      exact: true,
    });
    const controlNode = await control.elementHandle();
    assert(controlNode);
    const original = item.layout === 'player-portrait' ? 'portrait' : 'wide';
    for (const preference of [
      original === 'portrait' ? 'wide' : 'portrait',
      original,
    ]) {
      await control.focus();
      await control.selectOption(preference);
      await settle(surface);
      const switched = await measure(surface);
      assertLogical(switched, {
        ...item,
        layout:
          preference === 'portrait' ? 'player-portrait' : 'player-landscape',
        width: preference === 'portrait' ? 360 : 640,
        height: preference === 'portrait' ? 640 : 360,
      });
      assert.equal(switched.mounts, before.mounts);
      assert.equal(switched.unmounts, before.unmounts);
      assert.equal(switched.roomRevision, before.roomRevision);
      assert.equal(switched.instanceId, before.instanceId);
      assert.equal(switched.connection, true);
      assert(
        await controlNode.evaluate(
          (element) =>
            element.isConnected && document.activeElement === element,
        ),
        'The actual display selector retains its identity and focus across layout changes',
      );
      if (draft) {
        assert.equal(await input.inputValue(), draft.value);
        assert(
          await inputNode.evaluate(
            (element) =>
              element.isConnected &&
              element === document.getElementById('ma-bid-amount'),
          ),
          'Switching layouts preserves the actual input node',
        );
      }
      const identity = await frameIdentity(page);
      assertFrameIdentity(identity, iframeBefore);
      layoutSwitches.push({
        preference,
        measurements: switched,
        iframe: identity,
        screenshot: await captureStage('player-frame-' + preference),
      });
    }
    if (draft) await input.focus();
    await page.setViewportSize({ width: item.width, height: item.height });
    await settle(surface);
    const restored = await measure(surface);
    assertLogical(restored, item);
    assert.equal(restored.mounts, before.mounts);
    assert.equal(restored.unmounts, before.unmounts);
    assert.equal(restored.connection, true);
    assert.equal(restored.roomRevision, before.roomRevision);
    assert.equal(restored.instanceId, before.instanceId);
    if (draft) {
      assert.equal(await input.inputValue(), draft.value);
      assert(
        await inputNode.evaluate(
          (element) =>
            element.isConnected && document.activeElement === element,
        ),
        'The input remains focused when the parent viewport is restored',
      );
    }
    const restoredIdentity = await frameIdentity(page);
    assertFrameIdentity(restoredIdentity, iframeBefore);
    layoutSwitches.push({ restored, iframe: restoredIdentity });
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
    ...(item.playerFrame
      ? {
          productionPlayerFrame: true,
          iframeBefore,
          layoutSwitches,
          focus: draft
            ? {
                resizeInputFocusRetained: true,
                layoutSelectorFocusRetained: true,
                restoredInputFocusRetained: true,
              }
            : {
                applicable: false,
                reason:
                  'No native input exists in this legal projection; display-selector focus is checked separately.',
              },
        }
      : {}),
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
