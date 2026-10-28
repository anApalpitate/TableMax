import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { createHash, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
assertWorkspaceRoot();
const arg = (n) =>
  process.argv.find((v) => v.startsWith('--' + n + '='))?.slice(n.length + 3);
const task = resolve(
  arg('task') ?? 'tmp/all-games-rollout-20261029/platform/shared-controls',
);
const output = resolve(
  arg('output') ??
    'artifacts/maintenance/all-games-rollout-20261029/platform/shared-controls-r1',
);
assert(task.startsWith(resolve('tmp') + sep));
assert(output.startsWith(resolve('artifacts/maintenance') + sep));
await assert.rejects(stat(output), 'Use new evidence directory');
await mkdir(output, { recursive: true });
await mkdir(task, { recursive: true });
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TABLEMAX_TEST_MAINTENANCE = '0';
await mkdir(join(task, 'browser-temp'), { recursive: true });
process.env.TEMP = process.env.TMP = join(task, 'browser-temp');
const hash = (b) => createHash('sha256').update(b).digest('hex');
const report = {
  result: 'running',
  checks: [],
  inputs: [],
  boundary:
    'Actual legacy platform imports and shared public exports rendered together with controlled view data. Controlled v1 source signatures are not historical release bytes. No game rule, service or installer acceptance.',
};
let browser, server;
try {
  if (arg('historical')) {
    await verifyHistoricalBytes();
  } else {
    const entry = join(task, 'entry.tsx');
    const source = (p) => JSON.stringify(resolve(p).replaceAll('\\', '/'));
    await writeFile(
      entry,
      `import React from 'react';import{createRoot}from'react-dom/client';import{useGuidancePreference as oldGuidance}from${source('apps/web/src/session/useGuidancePreference.ts')};import{useGuidancePreference as newGuidance,HostedGame,SessionFeedback,RoomManagement,PlayModeControl,CountdownSettings,WEB_HOST_VERSION}from'@tablemax/web-host';import{RulesGuide}from${source('apps/web/src/components/RulesGuide.tsx')};import{DecisionCountdown}from${source('apps/web/src/components/DecisionCountdown.tsx')};import{PlayModeBadge}from${source('apps/web/src/components/PlayModeBadge.tsx')};import{useDecisionClock}from${source('apps/web/src/components/useDecisionClock.ts')};const legacySession={role:'player',view:null,motion:[],command:()=>{}};function LegacyConsumer({session}){return <section id="legacy-slots"><SessionFeedback session={session}/><RoomManagement session={session}/><PlayModeControl session={session}/><CountdownSettings session={session}/><output id="abi">{WEB_HOST_VERSION}</output></section>}const legacySlots={feedback:options=><span id="legacy-feedback">{options===undefined?'all-default':'unexpected'}</span>,management:options=><span id="legacy-management">{Object.keys(options).length}</span>,playMode:()=> <span id="legacy-play-mode">old-slot</span>,countdown:options=><span id="legacy-countdown">{Object.keys(options).length}</span>};const legacyClient={Screen:LegacyConsumer};const clock={id:'fixture-clock',remainingMs:15000,running:false,serverTime:1};function Pref({kind}){const[value,set]= (kind==='legacy'?oldGuidance:newGuidance)('verification');return <button id={kind} onClick={()=>set(!value)}>{kind+':'+value}</button>}function Fixture(){const remaining=useDecisionClock(clock);return <main><h1>公共控件兼容入口验证</h1><HostedGame session={legacySession} client={legacyClient} presentation={legacySlots}/><Pref kind="legacy"/><Pref kind="public"/><output id="clock-value">{remaining}</output><DecisionCountdown view={{decisionClock:clock,countdownSeconds:30}}/><PlayModeBadge mode="test"/><RulesGuide className="fixture-guide" summary="真实公共规则控件" chapters={[{id:'first',label:'第一章',title:'第一章标题',content:<p>内容一</p>},{id:'second',label:'第二章',title:'第二章标题',content:<p>内容二</p>}]} source="验证夹具"/></main>}createRoot(document.getElementById('root')).render(<Fixture/>);`,
    );
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      outfile: join(task, 'app.js'),
      platform: 'browser',
      format: 'esm',
      jsx: 'automatic',
      nodePaths: [resolve('apps/web/node_modules')],
      metafile: true,
    });
    for (const path of [
      ...Object.keys(result.metafile.inputs),
      'tools/test/platform/verify-shared-controls.mjs',
    ])
      report.inputs.push({ path, sha256: hash(await readFile(path)) });
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
            '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{margin:20px;background:#fff9e8;font:18px sans-serif;color:#243c35}button{font:inherit;min-height:44px}main{max-width:900px;margin:auto}</style><div id="root"></div><script type="module" src="/app.js"></script>',
          );
        }
      } catch (error) {
        res.statusCode = 500;
        res.end(String(error));
      }
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    browser = await launchTestBrowser({ channel: 'msedge', headless: true });
    for (const storage of ['normal', 'blocked']) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
      if (storage === 'blocked')
        await context.addInitScript(() => {
          Object.defineProperty(Storage.prototype, 'getItem', {
            value() {
              throw Error('blocked test storage');
            },
          });
          Object.defineProperty(Storage.prototype, 'setItem', {
            value() {
              throw Error('blocked test storage');
            },
          });
        });
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('http://127.0.0.1:' + server.address().port + '/');
      assert.equal(await page.locator('#abi').textContent(), '1');
      assert.equal(
        await page.locator('#legacy-feedback').textContent(),
        'all-default',
      );
      assert.equal(await page.locator('#legacy-management').textContent(), '0');
      assert.equal(await page.locator('#legacy-countdown').textContent(), '0');
      assert.equal(
        await page.locator('#legacy-play-mode').textContent(),
        'old-slot',
      );
      report.checks.push(storage + '-web-host-v1-source-slot-signatures');
      await page.locator('#legacy').click();
      assert.equal(await page.locator('#public').textContent(), 'public:true');
      await page.locator('#public').click();
      assert.equal(await page.locator('#legacy').textContent(), 'legacy:false');
      report.checks.push(storage + '-guidance-two-way-synchronization');
      assert.equal(await page.locator('#clock-value').textContent(), '15000');
      assert.equal(
        await page
          .locator('[role=timer]')
          .getAttribute('data-remaining-seconds'),
        '15',
      );
      assert.equal(
        await page.locator('[role=timer]').getAttribute('data-clock-running'),
        'false',
      );
      report.checks.push(storage + '-paused-countdown-and-legacy-hook');
      await page.getByRole('button', { name: '第二章', exact: true }).click();
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent),
        '第二章标题',
      );
      await page.getByRole('button', { name: '回到章节', exact: true }).click();
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent),
        '第一章',
      );
      report.checks.push(storage + '-rules-navigation-focus');
      assert.equal(
        await page.locator('[data-mode=test]').textContent(),
        '测试模式',
      );
      assert.notEqual(
        await page
          .locator('.rules-guide')
          .evaluate((e) => getComputedStyle(e).display),
        'none',
      );
      assert.deepEqual(errors, []);
      report.checks.push(storage + '-badge-styles-no-render-errors');
      if (storage === 'normal')
        await page.screenshot({ path: join(output, 'shared-controls.png') });
      await context.close();
    }
    for (const input of report.inputs)
      assert.equal(
        hash(await readFile(input.path)),
        input.sha256,
        'Input changed during verification',
      );
    report.result = 'passed';
  }
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

async function verifyHistoricalBytes() {
  const provenance = JSON.parse(
    await readFile(join(task, 'provenance.json'), 'utf8'),
  );
  report.boundary =
    'Actual untouched shipped traditional bundle and historical frozen three-v1 source bundle imported by current compiled web-host v1. Old rules initialize in memory and project public/self views; no commands, server persistence, EXE or native device proof.';
  report.provenance = provenance;
  const catalog = JSON.parse(
    await readFile(join(task, 'catalog.json'), 'utf8'),
  );
  const canonical = (v) =>
    Array.isArray(v)
      ? '[' + v.map(canonical).join(',') + ']'
      : v && typeof v === 'object'
        ? '{' +
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b, 'en'))
            .map(([k, val]) => JSON.stringify(k) + ':' + canonical(val))
            .join(',') +
          '}'
        : JSON.stringify(v);
  const keySource = await readFile(
    'apps/server/src/game-packages/project-public-key.ts',
    'utf8',
  );
  const key = keySource
    .match(/'(-----BEGIN PUBLIC KEY-----[^']+)'/)[1]
    .replaceAll('\\n', '\n');
  assert(
    verify(
      null,
      Buffer.from(canonical(catalog.payload)),
      key,
      Buffer.from(catalog.signature, 'base64'),
    ),
    'Historical catalog signature',
  );
  assert.equal(
    hash(await readFile(provenance.payload.path)),
    provenance.payload.sha256,
    'Original payload unchanged',
  );
  report.checks.push('signed-historical-catalog-and-payload-sha');
  const require = createRequire(import.meta.url);
  const records = [];
  for (const item of provenance.cases) {
    const exports = require(item.rulePath),
      rules = item.variant
        ? exports.rulesByVariant[item.variant]
        : exports.rules;
    const seats = Array.from(
      { length: item.seats },
      (_, i) => 'seat-' + (i + 1),
    );
    let seed = 37;
    const state = rules.initialize({
      seats,
      random: {
        next() {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          return (seed >>> 0) / 4294967296;
        },
      },
    });
    rules.validateState(state, seats);
    for (const role of ['host', 'player'])
      records.push({
        ...item,
        role,
        seats,
        projection: rules.project(state, {
          role: role === 'host' ? 'public' : 'player',
          seatId: role === 'player' ? seats[0] : undefined,
        }),
      });
  }
  await writeFile(join(task, 'views.json'), JSON.stringify(records));
  const styles = provenance.currentRuntime.files
    .filter((f) => f.path.endsWith('.css'))
    .map((f) => '<link rel="stylesheet" href="/runtime/v1/' + f.path + '">')
    .join('');
  await writeFile(
    join(task, 'index.html'),
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>body{margin:0}*{box-sizing:border-box}</style><div id="root"></div><script type="module" src="/probe.js"></script>`,
  );
  await writeFile(
    join(task, 'probe.js'),
    `import React from '/runtime/v1/react.js';import{createRoot}from'/runtime/v1/react-dom-client.js';import{HostedGame,configureGameHost}from'/runtime/v1/web-host.js';const h=React.createElement;configureGameHost({ScreenLink:p=>h('a',p),FullscreenControl:()=>null,DisplaySettings:()=>null,useAudioOutput:()=>false,claimAudioEvent:()=>false,avatarFor:()=>"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23edd7a6'/%3E%3C/svg%3E",avatarChoices:[]});const records=await(await fetch('/views.json')).json();const item=records[Number(new URLSearchParams(location.search).get('case'))];for(const href of item.styles){const el=document.createElement('link');el.rel='stylesheet';el.href=href;document.head.append(el)}const module=await import(item.entry);const client=item.variant?module.clientsByVariant[item.variant]:module.client;window.commands=[];const session={role:item.role,connected:true,locked:false,canControl:false,message:'',feedback:null,errorId:'',motion:[],command:c=>window.commands.push(c),view:{instanceId:'historical-readonly',branch:0,revision:0,status:'playing',paused:true,playMode:'test',gameView:item.projection,game:{id:item.id,variantId:item.variant},decisionId:null,countdownSeconds:30,decisionClock:null,actions:[],lifecycleActions:[],seats:item.seats.map((id,i)=>({id,name:'历史玩家'+(i+1),avatarId:'fixture',controller:'human',online:true,ready:true})),history:[]}};const wrapped={...client,Screen:props=>{window.received=props.session.view.gameView;return h(client.Screen,props)}};createRoot(document.getElementById('root')).render(h(HostedGame,{session,client:wrapped,presentation:{management:()=>null,feedback:()=>null,playMode:()=>null,countdown:()=>null}}));window.ready=item;`,
  );
  server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      const path = resolve(
        task,
        '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)),
      );
      assert(path.startsWith(task + sep));
      res.setHeader(
        'Content-Type',
        path.endsWith('.js')
          ? 'text/javascript'
          : path.endsWith('.css')
            ? 'text/css'
            : path.endsWith('.html')
              ? 'text/html'
              : path.endsWith('.json')
                ? 'application/json'
                : path.endsWith('.svg')
                  ? 'image/svg+xml'
                  : 'application/octet-stream',
      );
      res.end(await readFile(path));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  for (const [index, item] of records.entries()) {
    const context = await browser.newContext({
      viewport:
        item.role === 'player'
          ? { width: 390, height: 844 }
          : { width: 1280, height: 720 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage(),
      errors = [],
      responses = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400) responses.push([r.url(), r.status()]);
    });
    await page.goto(
      'http://127.0.0.1:' + server.address().port + '/?case=' + index,
    );
    await page.locator(item.selector).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() =>
      Array.from(document.images).every((i) => i.complete),
    );
    assert.deepEqual(
      await page.evaluate(() => window.received),
      item.projection,
      'Same authorized historical projection',
    );
    const marker = await page
      .locator(item.selector)
      .getAttribute('data-player-layout-contract');
    assert.equal(
      marker,
      item.id === 'modern-art' && item.role === 'player' ? 'three-v1' : null,
    );
    if (item.role === 'host')
      assert.equal(
        await page.locator('[data-av-secret=true],.ma-hand').count(),
        0,
        'Public host does not gain private content',
      );
    assert.equal(await page.evaluate(() => window.commands.length), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(responses, []);
    assert(
      await page.evaluate(() =>
        Array.from(document.images).every((i) => i.naturalWidth > 0),
      ),
      'Historical resources decode',
    );
    await page.screenshot({
      path: join(output, item.id + '-' + item.role + '.png'),
      fullPage: true,
    });
    report.checks.push(
      item.id + '-' + item.role + '-historical-byte-import-and-authorized-view',
    );
    await context.close();
  }
  for (const source of provenance.sources)
    for (const f of source.files ?? []) {
      const path = join(
        task,
        'games/modern-art',
        source.kind.endsWith('web') ? 'web' : 'rules',
        f.path,
      );
      assert.equal(hash(await readFile(path)), f.sha256);
    }
  for (const f of provenance.currentRuntime.files)
    assert.equal(
      hash(await readFile(join(task, 'runtime/v1', f.path))),
      f.sha256,
    );
  assert.equal(
    hash(await readFile(provenance.payload.path)),
    provenance.payload.sha256,
  );
  report.verifierSha256 = hash(await readFile(new URL(import.meta.url)));
  report.result = 'passed';
}
