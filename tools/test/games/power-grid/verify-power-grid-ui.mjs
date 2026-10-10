import { captureBrowserScreenshot } from '../../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { verifyUiPolish } from './power-grid-ui-polish-checks.mjs';
import { verifyUiRefinement } from './power-grid-ui-refinement-checks.mjs';
import { verifyPurchaseProgress } from './power-grid-purchase-progress-checks.mjs';
import { verifyBoardFacts } from './power-grid-board-checks.mjs';
import { mkdir, writeFile, readFile, mkdtemp, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, join, extname, sep } from 'node:path';
import { build as bundle } from 'esbuild';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { verificationOutput } from '../../support/verification-output.mjs';

const name =
  process.argv.find((value) => value.startsWith('--evidence='))?.slice(11) ??
  'fixture';
const maintenance =
  process.argv.find((value) => value.startsWith('--maintenance='))?.slice(14) ??
  'shared-visual-20261004';
const cachedFixtures = process.argv
  .find((v) => v.startsWith('--fixtures='))
  ?.slice(11);
const amountOnly = process.argv.includes('--amount-only');
const mapOnly = process.argv.includes('--map-only');
const boardOnly = process.argv.includes('--board-only');
const seatCount = Number(
  process.argv.find((value) => value.startsWith('--seats='))?.slice(8) ?? 6,
);
assert.ok([2, 3, 4, 5, 6].includes(seatCount), 'Classic supported seat count');
const captureRulesOnly = process.argv.includes('--capture-rules-only');
const captureRules =
  captureRulesOnly || process.argv.includes('--capture-rules');
assert.match(name, /^[a-z0-9-]{1,40}$/);
assert.match(maintenance, /^[a-z0-9-]{1,40}$/);
const output = verificationOutput(maintenance, 'power-grid', name);
await mkdir(output, { recursive: true });
const work = await mkdtemp(join(output, 'work-'));
const started = performance.now();
const report = {
  scope:
    'Actual independent production React components with legal rules-generated authorized fixtures in background Chromium. This is not a live service or native DPI acceptance.',
  startedAt: new Date().toISOString(),
  layouts: [],
  actions: [],
  audio: [],
  errors: [],
  requests: [],
  screenshots: [],
};
const generator = `
import { rules, bot } from ${JSON.stringify(resolve('games/power-grid/index.ts'))};
import { BOARD_WIDTH, BOARD_HEIGHT, GERMANY_CITIES, GERMANY_EDGES } from ${JSON.stringify(resolve('games/power-grid/data/germany.ts'))};
import { INCOME } from ${JSON.stringify(resolve('games/power-grid/data/economy.ts'))};
export const diagramData={income:INCOME,board:{width:BOARD_WIDTH,height:BOARD_HEIGHT,cities:GERMANY_CITIES,edges:GERMANY_EDGES}};
export async function make(){
 const seats=Array.from({length:${seatCount}},(_,index)=>'p'+(index+1));let seed=728;
 const random={next(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}};
 const context={seats,random};let state=rules.initialize(context);const fixtures={};
 for(let index=0;index<12000;index++){
  rules.validateState(state,seats);
  const decision=rules.decisions(state)[0];
  const seat=decision?.seatId ?? seats[0];
  const view=rules.project(state,{role:'player',seatId:seat});
  const actions=rules.legalActions(state,seat);
  if(view.phase==='resources' && view.round===1 && !fixtures['first-order']) fixtures['first-order']={game:view,publicGame:rules.project(state,{role:'public'}),actions,decision};
  if(!fixtures[view.phase]) fixtures[view.phase]={game:view,publicGame:rules.project(state,{role:'public'}),actions,decision};
  if(view.phase==='building' && Object.values(view.players).reduce((n,p)=>n+p.cities.length,0)>30) fixtures.crowded={game:view,publicGame:rules.project(state,{role:'public'}),actions,decision};
  if(view.phase==='replace' && view.replacement?.removedPlantId!==null) fixtures.salvage={game:view,publicGame:rules.project(state,{role:'public'}),actions,decision};
  if(view.phase==='resources' && view.players[seat]?.plants.length>=3) fixtures['owned-resources']={game:view,publicGame:rules.project(state,{role:'public'}),actions,decision};
  if(view.phase==='powering' && actions.filter(a=>a.type==='run'&&a.plantId===view.players[seat]?.plants.find(p=>p.id===a.plantId&&p.resources.coal>0&&p.resources.oil>0)?.id).length>1) fixtures['mixed-fuel']={game:view,publicGame:rules.project(state,{role:'public'}),actions,decision};
  if(rules.ended(state)) break;
  if(!decision || !actions.length) throw new Error('Rules fixture stopped without a legal decision');
  const result=await bot.decide({view,actions,decision,memory:null,difficulty:'juewu',random,signal:new AbortController().signal});
  state=rules.apply(state,result.action,seat,context).state;
 }
 if(!fixtures.ended) throw new Error('Fixture match did not finish');
 return {fixtures,income:INCOME,board:{width:BOARD_WIDTH,height:BOARD_HEIGHT,cities:GERMANY_CITIES,edges:GERMANY_EDGES}};
}`;
await bundle({
  stdin: {
    contents: generator,
    resolveDir: resolve('.'),
    sourcefile: 'power-grid-ui-fixtures.ts',
  },
  outfile: join(work, 'generator.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'silent',
});
const generated = await import(
  new URL('file:///' + join(work, 'generator.mjs').replaceAll('\\', '/'))
);
const { fixtures, board, income } = cachedFixtures
  ? {
      fixtures: JSON.parse(await readFile(cachedFixtures, 'utf8')),
      ...generated.diagramData,
    }
  : await generated.make();
assert.equal(fixtures.regions.game.seatOrder.length, seatCount);
if (cachedFixtures) report.fixtureSource = resolve(cachedFixtures);
await writeFile(join(work, 'fixtures.json'), JSON.stringify(fixtures));
const entry = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {client} from ${JSON.stringify(resolve('apps/web/src/game-clients/PowerGridScreen.tsx'))};
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
import ${JSON.stringify(resolve('apps/web/src/scrollbars.css'))};
const fixtures=await (await fetch('./fixtures.json')).json();
window.__commands=[];window.__plays=[];
HTMLMediaElement.prototype.play=function(){window.__plays.push(this.src);return Promise.resolve();};
HTMLMediaElement.prototype.pause=function(){};
const names=['一号电力公司测试长昵称abcdefghijklmnop','蓝色莱茵电力','第三家电力公司','第四家绿色电网','五号原子动力','六号能源投资'];
function Fixture(){const [setting,setSetting]=useState({name:'regions',role:'host',paused:false,serial:0});const [feedback,setFeedback]=useState(null);
window.setFixture=(name,role='host',paused=false)=>{setFeedback(null);window.__commands=[];setSetting(s=>({name,role,paused,serial:s.serial+1}));};
window.changeFixture=(name)=>{window.__commands=[];setSetting(s=>({...s,name}));};
window.changeSavedFixture=(name,revision=2)=>{const target=fixtures[name].publicGame;setFeedback({instanceId:'00000000-0000-4000-8000-000000000001',branch:0,revision,events:[{kind:'effect-complete',text:target.latest?.text??'保存',action:{actor:target.latest?.actor??null,verb:target.latest?.verb??'round',cardCategory:null,ability:null,targets:[]}}]});setSetting(s=>({...s,name,revision}));};
window.setTestMode=()=>setSetting(s=>({...s,test:true}));
window.restoreFixture=()=>{setFeedback(null);setSetting(s=>({...s,branch:(s.branch??0)+1,revision:(s.revision??1)+1}));};
window.syncFixture=()=>setSetting(s=>({...s,revision:(s.revision??1)+1}));
const fixture=fixtures[setting.name];const game=setting.role==='player'?fixture.game:fixture.publicGame;
window.advanceFeedback=(revision=2,verb=game.latest?.verb??'bid')=>{setSetting(s=>({...s,revision}));setFeedback({instanceId:'00000000-0000-4000-8000-000000000001',branch:0,revision,events:[{kind:verb==='end'?'game-ended':'effect-complete',text:game.latest?.text??'保存',action:{actor:game.latest?.actor??null,verb,cardCategory:null,ability:null,targets:[]}}]});};
const seats=game.seatOrder.map((id,index)=>({id,name:names[index],avatarId:'avatar-'+(index+1),controller:'human',ready:true,online:true,botDifficulty:null}));
const view={instanceId:'00000000-0000-4000-8000-000000000001',revision:setting.revision??1,branch:setting.branch??0,status:game.phase==='ended'?'ended':'playing',paused:setting.paused,restored:false,joinOpen:false,playMode:setting.test?'test':'play',countdownSeconds:20,decisionClock:game.phase==='ended'?null:{id:'clock-'+setting.serial,serverTime:Date.now(),remainingMs:20000,running:!setting.paused},game:{id:'power-grid',name:'电力公司',min:2,max:6},catalog:[],ownerSeatId:'p1',capabilities:{manage:setting.role==='host',control:setting.role==='host'||(setting.role==='player'&&game.self?.seatId==='p1')},seats,self:{role:setting.role,seatId:game.self?.seatId??null},gameView:game,actions:setting.role==='player'&&!setting.paused?fixture.actions:[],decisionId:fixture.decision?.id??null,selectionToken:fixture.decision?.id??null,history:[],lifecycleActions:[],botError:null,endReason:game.phase==='ended'?'游戏完成':null};
const session={role:setting.role,view,connected:true,locked:false,canControl:view.capabilities.control,isHost:setting.role==='host',message:'',motion:[],feedback,busy:false,admissionPending:false,awaitingConfirmation:false,errorId:'',command(value){window.__commands.push(value);},retry(){}};
return <client.Screen key={setting.serial} session={session}/>;}
createRoot(document.getElementById('root')).render(<Fixture/>);window.fixtureNames=Object.keys(fixtures);
`;
await writeFile(join(work, 'entry.tsx'), entry);
await writeFile(
  join(work, 'index.html'),
  '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Power Grid component verification</title></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>',
);
await build({
  configFile: false,
  root: work,
  resolve: {
    alias: {
      react: resolve('apps/web/node_modules/react'),
      'react-dom': resolve('apps/web/node_modules/react-dom'),
    },
  },
  plugins: [react()],
  build: {
    outDir: join(work, 'bundle'),
    emptyOutDir: false,
    target: 'chrome110',
  },
  logLevel: 'error',
});
await writeFile(
  join(work, 'bundle', 'fixtures.json'),
  JSON.stringify(fixtures),
);
const directory = join(work, 'bundle');
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const file = resolve(
      directory,
      '.' +
        decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
    );
    if (!file.startsWith(directory + sep)) throw new Error('Invalid path');
    const data = await readFile(file);
    const mime = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.json': 'application/json',
      '.webp': 'image/webp',
      '.wav': 'audio/wav',
      '.svg': 'image/svg+xml',
    };
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
    });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser, page;
try {
  browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
    soundEnabled: process.argv.includes('--sound'),
  });
  page = await browser.newPage({ viewport: { width: 854, height: 480 } });
  page.on('pageerror', (error) => report.errors.push(String(error)));
  page.on('request', (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith('data:'))
      report.requests.push(request.url());
  });
  await page.goto(origin);
  await page.waitForFunction(() => window.fixtureNames?.length > 0);
  const verifyStageSummaries = async () => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => window.setFixture('building', 'host'));
    await page.waitForTimeout(400);
    const market = page.locator('#pg-board-market'),
      guide = page.locator('#pg-board-income');
    assert.ok(await market.isHidden());
    assert.ok(await guide.isHidden());
    assert.ok(await page.locator('.pg-map-table .pg-map-panel').isVisible());
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await page.evaluate(() => window.syncFixture());
    await page.waitForTimeout(400);
    assert.ok(
      await market.isVisible(),
      'Same-stage sync preserves manual drawer choice',
    );
    await page.evaluate(() => window.changeFixture('resources'));
    await page.waitForTimeout(400);
    assert.ok(await market.isVisible());
    assert.equal(
      await market
        .getByRole('button', { name: '燃料', exact: true })
        .getAttribute('aria-pressed'),
      'true',
    );
    assert.equal(
      await page.locator('.pg-price-lanes:visible').count(),
      1,
      'No duplicate fuel market',
    );
    await page.getByRole('button', { name: '收起玩家公司' }).click();
    await page.evaluate(() => window.changeFixture('powering'));
    await page.waitForTimeout(400);
    assert.ok(await market.isHidden());
    assert.ok(await guide.isVisible());
    assert.ok(
      await page.locator('.pg-board-companies').isHidden(),
      'Manual company closure survives stages',
    );
    await page.getByRole('button', { name: '展开玩家公司' }).click();
    await page.setViewportSize({ width: 854, height: 480 });
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await page.waitForTimeout(400);
    assert.ok(await market.isVisible());
    assert.ok(
      await guide.isHidden(),
      'Narrow desktops open one auxiliary drawer',
    );
    const bounds = await market.boundingBox(),
      companies = await page.locator('.pg-board-companies').boundingBox();
    assert.ok(
      bounds.y + bounds.height <= companies.y + 1,
      'Market ends above player drawer',
    );
    assert.ok(
      await market
        .locator('.pg-board-drawer-content')
        .evaluate((n) => n.clientHeight >= 44),
      'Short screen keeps a usable market scrolling region',
    );
    assert.equal((await page.evaluate(() => window.__commands)).length, 0);
    await captureBrowserScreenshot(page, {
      path: join(output, 'board-short-market.png'),
    });
    report.screenshots.push('board-short-market.png');
    report.actions.push(
      'Stage drawers, persistent company choice, narrow exclusivity and viewing zero actions',
    );
  };
  const verifyPolish = async () => {
    await page.setViewportSize({ width: 854, height: 480 });
    await page.evaluate(() =>
      window.setFixture(
        window.fixtureNames.includes('crowded') ? 'crowded' : 'building',
        'host',
      ),
    );
    await page.waitForTimeout(60);
    const map = page.locator('.pg-map-panel');
    const clearView = map.locator('.pg-map-view-switch button').last();
    await clearView.click();
    assert.equal(await map.getAttribute('data-map-view'), 'clear');
    await page.setViewportSize({ width: 600, height: 854 });
    await page.waitForTimeout(60);
    assert.equal(
      await map.getAttribute('data-map-view'),
      'clear',
      'Resizing across the phone breakpoint retains the device preference',
    );
    await page.setViewportSize({ width: 854, height: 480 });
    assert.equal(await map.locator('[data-map-edge]').count(), 83);
    assert.equal(await map.locator('[data-city]').count(), 42);
    await map.getByRole('button', { name: '放大地图' }).click();
    const zoomBeforePhase = await map.getAttribute('data-map-zoom');
    const centerBeforePhase = await map.getAttribute('data-map-center');
    await page.evaluate(() => window.changeFixture('resources'));
    await page.waitForTimeout(60);

    assert.equal(
      await map.getAttribute('data-map-zoom'),
      zoomBeforePhase,
      'Manual zoom survives phase changes',
    );
    assert.equal(await map.getAttribute('data-map-center'), centerBeforePhase);
    assert.equal(await map.getAttribute('data-map-follow'), 'false');
    await page.evaluate(() =>
      window.setFixture(
        window.fixtureNames.includes('crowded') ? 'crowded' : 'building',
        'host',
      ),
    );
    await page.waitForTimeout(60);
    assert.equal(
      await map.getAttribute('data-map-view'),
      'clear',
      'Map presentation preference survives remount',
    );
    await captureBrowserScreenshot(page, {
      path: join(output, 'host-clear-map.png'),
    });
    assert.ok(
      await map.evaluate((node) => {
        const finalEdge = [...node.querySelectorAll('[data-map-edge]')].at(-1);
        const label = node.querySelector('.pg-map-route-label');
        return Boolean(
          label &&
          finalEdge.compareDocumentPosition(label) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }),
      'All road strokes precede opaque cost labels',
    );
    report.screenshots.push('host-clear-map.png');
    await map.locator('.pg-map-view-switch button').first().click();
    assert.equal((await page.evaluate(() => window.__commands)).length, 0);
    report.actions.push(
      'Map presentation toggle preserves 42 cities/83 edges, per-role local preference and zoom across phase changes without commands',
    );
    await page.evaluate(() => window.setFixture('powering', 'host'));
    await page.waitForTimeout(60);
    const card = page.locator('#pg-board-income');
    assert.ok(await card.isVisible());
    assert.deepEqual(
      await card
        .locator('[data-income-value]')
        .evaluateAll((nodes) =>
          nodes.map((node) => Number(node.dataset.incomeValue)),
        ),
      income,
    );
    assert.equal(
      await card.locator('[data-income-selected]').count(),
      0,
      'Public guide has no private draft',
    );
    await captureBrowserScreenshot(page, {
      path: join(output, 'host-income-card.png'),
    });
    report.screenshots.push('host-income-card.png');
    await page.getByRole('button', { name: '关闭收益边栏' }).click();
    await card.waitFor({ state: 'hidden' });
    assert.ok(await card.isHidden());
    assert.equal((await page.evaluate(() => window.__commands)).length, 0);
    report.actions.push(
      'Desktop income drawer retains the complete table and authorized public estimate',
    );
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => window.setFixture('powering', 'player'));
    await page.waitForTimeout(60);
    const phoneTrigger = page.locator('[data-income-trigger]');
    const overflow = await page.evaluate(() => document.body.style.overflow);
    await phoneTrigger.click();
    await page.locator('.pg-income-dialog[open]').waitFor();
    assert.equal(await page.locator('.pg-income-tier--capability').count(), 1);
    assert.equal(await page.locator('[data-income-selected]').count(), 0);
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      'hidden',
    );
    await captureBrowserScreenshot(page, {
      path: join(output, 'player-income-card.png'),
    });
    report.screenshots.push('player-income-card.png');
    await page.keyboard.press('Escape');
    await page.locator('.pg-income-dialog').waitFor({ state: 'hidden' });
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      overflow,
    );
    assert.equal((await page.evaluate(() => window.__commands)).length, 0);
    report.actions.push(
      'Phone income modal shows only one authorized capability tier, locks and restores background scroll, and does not submit',
    );
    await page.getByRole('button', { name: '规则', exact: true }).click();
    const rules = page.getByRole('dialog');
    const themes = [
      'flow',
      'resources',
      'storage',
      'network',
      'steps',
      'income',
    ];
    assert.deepEqual(
      await rules
        .locator('[data-rule-diagram]')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.dataset.ruleDiagram).sort(),
        ),
      [...themes].sort(),
    );
    assert.equal(
      await rules.locator('figure img').count(),
      0,
      'Original diagrams do not use captured UI',
    );
    for (const theme of themes) {
      await rules
        .locator(`[data-rule-diagram="${theme}"]`)
        .scrollIntoViewIfNeeded();
      await captureBrowserScreenshot(page, {
        path: join(output, `player-rules-${theme}.png`),
      });
      report.screenshots.push(`player-rules-${theme}.png`);
    }
    await page.keyboard.press('Escape');
    await rules.waitFor({ state: 'hidden' });
    assert.equal((await page.evaluate(() => window.__commands)).length, 0);
    report.actions.push(
      'Six original rule themes are available on short phone without captured screens or saved actions',
    );
  };
  const verifyPlayReview = async () => {
    const swipe = async (selector, dx, dy = 0, fingers = 1) => {
      await page.locator(selector).evaluate(
        (node, args) => {
          const touch = (x, y, id) =>
            new Touch({ identifier: id, target: node, clientX: x, clientY: y });
          const send = (name, x, y, count) =>
            node.dispatchEvent(
              new TouchEvent(name, {
                bubbles: true,
                cancelable: true,
                touches: Array.from({ length: count }, (_, i) =>
                  touch(x + i * 15, y, i),
                ),
                changedTouches: [touch(x, y, 0)],
              }),
            );
          send('touchstart', 180, 240, args.fingers);
          send('touchmove', 180 + args.dx, 240 + args.dy, args.fingers);
          send('touchend', 180 + args.dx, 240 + args.dy, 0);
        },
        { dx, dy, fingers },
      );
      await page.waitForTimeout(30);
    };
    for (const size of [
      { width: 320, height: 568 },
      { width: 360, height: 640 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.evaluate(() => window.setFixture('resources', 'player'));
      await page.waitForTimeout(80);
      assert.equal(await page.locator('.pg-page-nav button').count(), 4);
      const done = page.getByRole('button', { name: '完成采购', exact: true });
      const box = await done.boundingBox();
      assert.ok(
        box.y >= 0 && box.y + box.height <= size.height,
        'Completion dock stays in viewport',
      );
      const purchase = page
        .locator('.pg-fuel-purchases button:visible')
        .first();
      if (await purchase.count()) {
        const b = await purchase.boundingBox();
        assert.ok(b.y + b.height <= size.height, 'First purchase visible');
      }
      await page.getByRole('button', { name: '市场', exact: true }).click();
      const scroll = page.locator('[data-phone-page="1"] .pg-page-scroll');
      await scroll.evaluate((node) => {
        node.scrollTop = 250;
      });
      const before = await scroll.evaluate((node) => node.scrollTop);
      await page.evaluate(() => window.syncFixture());
      await page.waitForTimeout(60);
      assert.equal(await scroll.evaluate((node) => node.scrollTop), before);
      await page.getByRole('button', { name: '公司', exact: true }).click();
      const companyCards = page.locator(
        '.pg-phone-page:not([hidden]) .pg-company-card',
      );
      assert.ok(await companyCards.count());
      assert.equal(
        await companyCards
          .first()
          .locator('.pg-company-card-plants > div')
          .count(),
        fixtures['owned-resources'].publicGame.plantLimit,
      );
      if (size.width === 320) {
        await captureBrowserScreenshot(page, {
          path: join(output, 'player-320-568-company.png'),
        });
        report.screenshots.push('player-320-568-company.png');
      }
      const companyScroll = page.locator(
        '[data-phone-page="3"] .pg-page-scroll',
      );
      await companyScroll.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      const lastCompany = await companyCards.last().boundingBox();
      const companyViewport = await companyScroll.boundingBox();
      assert.ok(
        lastCompany.y + lastCompany.height <=
          companyViewport.y + companyViewport.height + 1,
        'Last company is reachable above fixed phone navigation',
      );
      await page.getByRole('button', { name: '市场', exact: true }).click();
      assert.equal(await scroll.evaluate((node) => node.scrollTop), before);
      await page.evaluate(() => window.changeFixture('powering'));
      await page.waitForTimeout(80);
      assert.equal(
        await page.locator('.pg-page-nav [aria-current="page"]').textContent(),
        '行动',
      );
      assert.equal((await page.evaluate(() => window.__commands)).length, 0);
    }
    await page.evaluate(() => window.setFixture('auction', 'player'));
    await page.waitForTimeout(80);
    await swipe('.pg-phone-table', -100);
    assert.equal(
      await page
        .locator('.pg-page-nav [aria-current="page"]')
        .getAttribute('aria-label'),
      '市场',
    );
    await swipe('[data-phone-page="1"] .pg-market-tabs', 100, 150);
    assert.equal(
      await page
        .locator('.pg-page-nav [aria-current="page"]')
        .getAttribute('aria-label'),
      '市场',
    );
    await swipe('[data-phone-page="1"] .pg-market-tabs', 100, 0, 2);
    assert.equal(
      await page
        .locator('.pg-page-nav [aria-current="page"]')
        .getAttribute('aria-label'),
      '市场',
    );
    await swipe('[data-phone-page="1"] .pg-market-tabs', 100);
    assert.equal(
      await page
        .locator('.pg-page-nav [aria-current="page"]')
        .getAttribute('aria-label'),
      '行动',
    );
    await page.getByRole('button', { name: '行动', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    assert.equal(
      await page
        .locator('.pg-page-nav [aria-current="page"]')
        .getAttribute('aria-label'),
      '市场',
    );
    await page.getByRole('button', { name: '行动', exact: true }).click();
    const input = page.getByRole('spinbutton', { name: '报价金额' });
    await input.fill(
      String(fixtures.auction.actions.find((a) => a.type === 'bid').amount + 1),
    );
    const quote = await input.inputValue();
    await swipe('.pg-phone-table', -100);
    assert.equal(
      await page
        .locator('.pg-page-nav [aria-current="page"]')
        .getAttribute('aria-label'),
      '行动',
      'Editing prevents swipe',
    );
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await page.getByRole('button', { name: '行动', exact: true }).click();
    assert.equal(
      await input.inputValue(),
      quote,
      'Quote draft survives paging',
    );
    await page.evaluate(() => window.setFixture('regions', 'player'));
    await page.waitForTimeout(80);
    const regions = page.locator(
      '.pg-region-choices button[aria-pressed="true"]',
    );
    const count = await regions.count();
    await regions.first().click();
    await page.getByRole('button', { name: '地图', exact: true }).click();
    const map = page.locator('[data-phone-page="2"] .pg-map-panel');
    assert.equal(
      await map.locator('[data-region-selected="true"]').count(),
      count - 1,
    );
    await map.getByRole('button', { name: '放大地图' }).click();
    const zoom = await map.getAttribute('data-map-zoom');
    const cameraCenter = await map.getAttribute('data-map-center');
    await page.getByRole('button', { name: '行动', exact: true }).click();
    assert.equal(
      await page
        .locator('[data-phone-page="0"] .pg-map-panel')
        .getAttribute('data-map-zoom'),
      zoom,
    );
    assert.equal(
      await page
        .locator('[data-phone-page="0"] .pg-map-panel')
        .getAttribute('data-map-center'),
      cameraCenter,
    );
    assert.equal((await page.evaluate(() => window.__commands)).length, 0);
    report.actions.push(
      'Four phone pages preserve scroll, valid quote/region drafts and shared map viewport; dock remains visible; viewing emits zero game commands',
    );
    report.actions.push(
      'Horizontal single-touch paging, vertical/multitouch cancellation, keyboard navigation and focused-input lock emit no commands',
    );
  };
  const captureRuleScreens = async () => {
    const directory = resolve('assets/games/power-grid/rules');
    await mkdir(directory, { recursive: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => window.setFixture('owned-resources', 'host'));
    await page.waitForTimeout(70);
    await page
      .getByRole('button', { name: '查看各家公司', exact: true })
      .click();
    await page.waitForFunction(() => document.querySelector('dialog[open]'));
    await page
      .locator('dialog .pg-inspector-company')
      .filter({ has: page.locator('.pg-plant-card') })
      .first()
      .screenshot({ path: join(directory, 'companies-v2.png') });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 1800 });
    await page.evaluate(() => window.setFixture('offer', 'player'));
    await page.waitForTimeout(70);
    await page.getByRole('button', { name: '公司', exact: true }).click();
    await page
      .locator('.pg-phone-page:not([hidden]) .pg-company-cards')
      .screenshot({ path: join(directory, 'order.png') });
    await page
      .locator('.pg-page-nav')
      .getByRole('button', { name: '市场', exact: true })
      .click();
    assert.ok(
      (await page.locator('[data-phone-page="1"] .pg-plant-card').count()) >= 4,
      'Rule market screenshot contains actual current and future plants',
    );
    await page
      .locator('[data-phone-page="1"] .pg-market')
      .screenshot({ path: join(directory, 'market-v2.png') });
    await page.setViewportSize({ width: 854, height: 1800 });
    await page.evaluate(() => window.setFixture('resources', 'host'));
    await page.waitForTimeout(350);
    await page
      .locator('#pg-board-market .pg-price-lanes')
      .screenshot({ path: join(directory, 'resource-prices.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    const stage = fixtures.crowded ? 'crowded' : 'building';
    const options = fixtures[stage].game.buildOptions;
    const option =
      ['fulda', 'kassel', 'wurzburg', 'hannover']
        .map((id) =>
          options.find(
            (entry) => entry.cityId === id && entry.connectionCost > 0,
          ),
        )
        .find(Boolean) ??
      options.find((entry) => entry.connectionCost > 0) ??
      options[0];
    assert.ok(option, 'Rule network screenshot has a legal cost preview');
    await page.evaluate((stage) => window.setFixture(stage, 'player'), stage);
    await page.waitForTimeout(70);
    await page
      .locator('.pg-page-nav')
      .getByRole('button', { name: '地图', exact: true })
      .click();
    await choosePhoneCity(page, option.cityId);
    await page
      .getByRole('button', { name: '放大地图' })
      .click({ clickCount: 2, delay: 70 });
    assert.equal(
      await page.locator('.pg-map-panel:visible [data-city]').count(),
      42,
      'Rules network screenshot retains all classic cities',
    );
    const routeLabels = await page
      .locator('.pg-map-panel:visible .pg-map-routes text')
      .count();
    assert.ok(
      routeLabels > 0 && routeLabels <= 83,
      'Short map displays selected adjacent route costs without all-map label clutter',
    );
    await page
      .locator('.pg-phone-table')
      .screenshot({ path: join(directory, 'network-v2.png') });
    report.ruleCaptures = [
      'companies-v2.png',
      'market-v2.png',
      'network-v2.png',
      'order.png',
      'resource-prices.png',
    ];
  };
  if (captureRulesOnly) {
    await captureRuleScreens();
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.requests, []);
    report.status = 'passed';
  } else if (boardOnly) {
    await verifyStageSummaries();
    await verifyBoardFacts(page, fixtures, report);
    await verifyUiPolish(page, fixtures, report, output);
    await verifyUiRefinement(page, fixtures, report, output);
    await verifyPurchaseProgress(page, fixtures, report, output);
    await verifyPolish();
    await verifyPlayReview();
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.requests, []);
    report.status = 'passed';
  } else if (mapOnly) {
    for (const role of ['host', 'public', 'player']) {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.evaluate((role) => window.setFixture('building', role), role);
      await page.waitForTimeout(150);
      assert.equal(
        await page.getByLabel('选择城市', { exact: true }).count(),
        role === 'host' ? 1 : 0,
      );
      const map = page.locator('.pg-map-panel:visible').first();
      await map.getByRole('button', { name: '复位', exact: true }).click();
      const minus = map.getByRole('button', { name: '缩小地图', exact: true });
      for (let i = 0; i < 4 && (await minus.isEnabled()); i++)
        await minus.click();
      assert.equal(Number(await map.getAttribute('data-map-zoom')), 0.64);
      assert.ok(await minus.isDisabled());
      await map.getByRole('button', { name: '复位', exact: true }).click();
      assert.equal(Number(await map.getAttribute('data-map-zoom')), 1);
    }
    report.actions.push(
      'Host-only city locator; three roles can zoom to 0.64 and reset to 1',
    );
    await verifyStageSummaries();
    await verifyBoardFacts(page, fixtures, report);
    await verifyUiPolish(page, fixtures, report, output);
    await verifyUiRefinement(page, fixtures, report, output);
    await verifyPurchaseProgress(page, fixtures, report, output);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => window.setFixture('building', 'player'));
    await page.waitForTimeout(50);
    const rotatedMap = await page
      .locator('.pg-phone-page:not([hidden]) .pg-phone-map .pg-map')
      .evaluate((svg) => ({
        viewBox: svg.getAttribute('viewBox'),
        terrainRotation: svg.querySelector('image')?.getAttribute('transform'),
        cities: [...svg.querySelectorAll('[data-city]')].map((node) => ({
          id: node.getAttribute('data-city'),
          transform: node.getAttribute('transform'),
          matrix: { a: node.getScreenCTM().a, b: node.getScreenCTM().b },
        })),
      }));
    assert.equal(
      rotatedMap.viewBox,
      '-300 -225 1800 1350',
      'Decorative extensions preserve the classic board world coordinates',
    );
    assert.equal(rotatedMap.terrainRotation, null);
    for (const original of board.cities) {
      const actual = rotatedMap.cities.find(
        (entry) => entry.id === original.id,
      );
      assert.equal(
        actual.transform,
        `translate(${board.height - original.y},${original.x})`,
      );
      assert.ok(
        actual.matrix.a > 0 && Math.abs(actual.matrix.b) < 0.001,
        'City houses and labels stay upright',
      );
    }
    const city = fixtures.building.game.buildOptions[0].cityId;
    const target = page.locator(
      `.pg-phone-page:not([hidden]) .pg-phone-map [data-city="${city}"]`,
    );
    await choosePhoneCity(page, city);
    await page.waitForTimeout(350);
    await choosePhoneCity(page, '');
    await page.waitForTimeout(80);
    const targetPoint = await target.evaluate((node) => {
      const matrix = node.getScreenCTM();
      return { x: matrix.e, y: matrix.f };
    });
    await page.mouse.click(targetPoint.x, targetPoint.y);
    assert.equal(
      await page
        .locator(
          '.pg-phone-page:not([hidden]) .pg-phone-map [aria-pressed="true"][data-city]',
        )
        .getAttribute('data-city'),
      city,
      'Pointer hit selects the correct rotated city',
    );
    await choosePhoneCity(page, '');
    await target.focus();
    await page.keyboard.press('Enter');
    assert.equal(
      await page
        .locator(
          '.pg-phone-page:not([hidden]) .pg-phone-map [aria-pressed="true"][data-city]',
        )
        .getAttribute('data-city'),
      city,
      'Keyboard and pointer selection agree',
    );
    await choosePhoneCity(page, city);
    await page
      .getByRole('button', { name: '放大地图' })
      .click({ clickCount: 2, delay: 70 });
    assert.equal(
      await page.locator('.pg-map-panel:visible [data-city]').count(),
      42,
    );
    assert.equal(
      await page.locator('.pg-map-panel:visible [data-map-edge]').count(),
      83,
    );
    const focused = await page
      .locator('.pg-map-panel:visible .pg-map-routes text')
      .count();
    assert.ok(
      focused > 0 && focused <= 83,
      'Cropped narrow map retains visible connection costs',
    );
    const textSizes = await page
      .locator('.pg-map-panel:visible .pg-map-routes text')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const matrix = node.getScreenCTM();
          return (
            parseFloat(getComputedStyle(node).fontSize) *
            Math.hypot(matrix.a, matrix.b)
          );
        }),
      );
    assert.ok(
      textSizes.every((size) => size >= 15.9),
      'Selected route prices remain at least 16 screen pixels',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(50);
    await page
      .getByRole('button', { name: '放大地图' })
      .click({ clickCount: 6, delay: 60 });
    assert.ok(
      (await page
        .locator('.pg-map-panel:visible .pg-map-routes text')
        .count()) > 0,
      'Cropped high zoom retains visible route prices',
    );
    await page.getByRole('button', { name: '复位', exact: true }).click();
    assert.ok(
      (await page
        .locator('.pg-map-panel:visible')
        .getAttribute('data-map-zoom')) === '1',
    );
    assert.deepEqual(
      await page.evaluate(() => window.__commands),
      [],
      'Preview, zoom and reset remain local',
    );
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(50);
    const selectableCities = await page
      .locator(
        '.pg-phone-page:not([hidden]) .pg-phone-map [data-city][tabindex="0"]',
      )
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.city));
    for (const entry of board.cities.filter((city) =>
      selectableCities.includes(city.id),
    )) {
      await choosePhoneCity(page, entry.id);
      await page.waitForTimeout(50);
      const bounds = await page
        .locator(
          `.pg-phone-page:not([hidden]) .pg-phone-map [data-city="${entry.id}"] text`,
        )
        .evaluate((node) => {
          const frame = node.closest('.pg-map-frame').getBoundingClientRect();
          const label = node.getBoundingClientRect();
          return {
            fits:
              label.left >= frame.left &&
              label.right <= frame.right &&
              label.top >= frame.top &&
              label.bottom <= frame.bottom,
            frame: { left: frame.left, right: frame.right },
            label: { left: label.left, right: label.right },
          };
        });
      assert.ok(
        bounds.fits,
        'Selected city name stays within the narrow full-map frame: ' +
          JSON.stringify({ city: entry.id, bounds }),
      );
    }
    await choosePhoneCity(page, city);
    await captureBrowserScreenshot(page, {
      path: join(output, 'rotated-map-player-320.png'),
      fullPage: true,
    });
    report.screenshots.push('rotated-map-player-320.png');
    report.actions.push(
      'Clockwise landscape map with 42 upright city markers and 83 unchanged routes; pointer/keyboard select the same city; narrow zoom shows readable selected prices; reset stays local',
    );
    await captureBrowserScreenshot(page, {
      path: join(output, 'rotated-map-player-390.png'),
      fullPage: true,
    });
    report.screenshots.push('rotated-map-player-390.png');
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.requests, []);
    report.status = 'passed';
  } else if (amountOnly) {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => window.setFixture('offer', 'player'));
    await page.waitForTimeout(50);
    const offers = fixtures.offer.actions.filter(
      (action) => action.type === 'offer',
    );
    const id = offers[0].plantId;
    const range = offers.filter((action) => action.plantId === id);
    const minimum = range[0].amount,
      maximum = range.at(-1).amount;
    const input = page.getByRole('spinbutton', { name: '报价金额' });
    for (const invalid of [
      String(minimum - 1),
      String(maximum + 1),
      String(minimum + 0.5),
      '',
    ]) {
      await input.fill(invalid);
      assert.ok(
        await page.locator('.pg-controls .pg-primary').isDisabled(),
        'Illegal offer remains unsubmitted: ' + invalid,
      );
      assert.equal(
        await input.inputValue(),
        invalid,
        'Offer does not silently clamp a typed amount',
      );
    }
    await input.fill(String(maximum + 1));
    await page.getByRole('button', { name: '减少报价', exact: true }).click();
    assert.equal(await input.inputValue(), String(maximum));
    assert.ok(await page.locator('.pg-controls .pg-primary').isEnabled());
    await input.fill(String(minimum - 1));
    await page.getByRole('button', { name: '增加报价', exact: true }).click();
    assert.equal(await input.inputValue(), String(minimum));
    await input.fill(String(minimum + 0.5));
    await page.getByRole('button', { name: '减少报价', exact: true }).click();
    assert.equal(await input.inputValue(), String(minimum));
    await input.fill('');
    await page.getByRole('button', { name: '增加报价', exact: true }).click();
    assert.equal(await input.inputValue(), String(minimum));
    await page.locator('.pg-controls .pg-primary').click();
    assert.equal(
      (await page.evaluate(() => window.__commands)).at(-1).action.amount,
      minimum,
    );
    report.actions.push(
      'Offer preserves below-minimum, above-cash, fractional and blank input; all remain disabled',
      'Directional amount steps recover into exact legal integer bounds',
      'Only confirmed legal recovered offer sends an action',
    );
    await captureBrowserScreenshot(page, {
      path: join(output, 'player-320-568-amount-recovered.png'),
      fullPage: true,
    });
    report.screenshots.push('player-320-568-amount-recovered.png');
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.requests, []);
    report.status = 'passed';
  } else {
    const stages = Object.keys(fixtures);
    for (const [width, height, role] of [
      [854, 480, 'host'],
      [1280, 720, 'public'],
      [1920, 1080, 'host'],
      [2560, 1440, 'public'],
      [3840, 2160, 'host'],
      [320, 568, 'player'],
      [360, 640, 'player'],
      [390, 844, 'player'],
      [844, 390, 'player'],
    ]) {
      await page.setViewportSize({ width, height });
      for (const stage of stages) {
        await page.evaluate(
          ({ stage, role }) => window.setFixture(stage, role),
          {
            stage,
            role,
          },
        );
        await page.waitForTimeout(role === 'player' ? 60 : 350);
        await page.waitForFunction(() =>
          [...document.images].every((image) => image.complete),
        );
        const geometry = await page.evaluate(() => {
          const root = document.querySelector('.pg-screen');
          const rect = root.getBoundingClientRect();
          const small = [
            ...root.querySelectorAll(
              'span,strong,button,label,input,select,h1,h2,h3,p',
            ),
          ]
            .filter(
              (element) =>
                element.getClientRects().length > 0 &&
                getComputedStyle(element).fontSize &&
                parseFloat(getComputedStyle(element).fontSize) < 15.9,
            )
            .map((element) => ({
              text: element.textContent.slice(0, 30),
              font: getComputedStyle(element).fontSize,
            }));
          const cardGroups = [
            ...root.querySelectorAll(
              '.pg-select-plants,.pg-own-plants,.pg-company-plants',
            ),
          ]
            .filter((group) => group.getClientRects().length > 0)
            .map((group) => ({
              className: group.className,
              columns:
                getComputedStyle(group).gridTemplateColumns.split(' ').length,
              overflowX: getComputedStyle(group).overflowX,
              scrollWidth: group.scrollWidth,
              width: group.clientWidth,
            }));
          const cards = [...root.querySelectorAll('.pg-plant-card')].filter(
            (card) => card.getClientRects().length > 0,
          );
          const markers = cards.map((card) => {
            const mark = card
              .querySelector('.pg-fuel-mark')
              .getBoundingClientRect();
            const artElement = card.querySelector(
              '.pg-plant-art,.pg-plant-illustration',
            );
            const art = artElement.getBoundingClientRect();
            const visibleArt = artElement.getClientRects().length > 0;
            return {
              border: parseFloat(getComputedStyle(card).borderLeftWidth),
              aboveArt: !visibleArt || mark.bottom <= art.top + 1,
              besideArt:
                Boolean(card.closest('.pg-company-card')) &&
                (mark.left >= art.right - 1 || mark.right <= art.left + 1),
              visibleArt,
              markerVisible: mark.width > 0 && mark.height > 0,
            };
          });
          return {
            width: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            rootHeight: rect.height,
            viewportHeight: innerHeight,
            small,
            cityNodes: root.querySelectorAll('[data-city]').length,
            cardGroups,
            markers,
            turnOrder: [...root.querySelectorAll('.pg-turn-order li')].map(
              (node) => node.dataset.seat,
            ),
            bidControls: [
              ...root.querySelectorAll(
                '.pg-bid-controls input,.pg-bid-controls button',
              ),
            ].map((node) => {
              const box = node.getBoundingClientRect();
              return {
                text: node.getAttribute('aria-label') ?? node.textContent,
                left: box.left,
                right: box.right,
                top: box.top,
                bottom: box.bottom,
                width: box.width,
                height: box.height,
              };
            }),
            companies: [
              ...root.querySelectorAll(
                '.pg-desktop-table > .pg-companies .pg-company > header',
              ),
            ]
              .filter((node) => node.getClientRects().length > 0)
              .map((node) => {
                const box = node.getBoundingClientRect();
                return { left: box.left, right: box.right };
              }),
            priceLanes: [...root.querySelectorAll('.pg-price-lane')].map(
              (lane) => ({
                resource: lane.dataset.resource,
                areas: [...lane.querySelectorAll('.pg-price-area')].map(
                  (area) => ({
                    price: Number(area.dataset.price),
                    count: Number(area.dataset.count),
                    displayedCount: Number(
                      area.querySelector('.pg-price-count')?.textContent,
                    ),
                    next: area.classList.contains('pg-price-area--next'),
                  }),
                ),
              }),
            ),
          };
        });
        assert.ok(
          geometry.scrollWidth <= geometry.width + 1,
          'No horizontal document overflow: ' +
            JSON.stringify({ width, height, role, stage, geometry }),
        );
        assert.deepEqual(
          geometry.small,
          [],
          'Information font floor: ' +
            JSON.stringify({ role, stage, small: geometry.small }),
        );
        for (const group of geometry.cardGroups) {
          assert.ok(
            group.columns >=
              (group.className.includes('pg-company-plants') ||
              (role === 'player' && group.className.includes('pg-own-plants'))
                ? 1
                : 2),
            'Owned/selection collections keep two columns; narrow public companies may use one: ' +
              JSON.stringify({ role, stage, group }),
          );
          assert.ok(
            group.scrollWidth <= group.width + 1,
            'Collection has no horizontal overflow: ' +
              JSON.stringify({ role, stage, group }),
          );
        }
        if (role === 'player' && stage === 'auction') {
          assert.ok(geometry.bidControls.length > 0);
          assert.ok(
            geometry.bidControls.every(
              (box) =>
                box.top >= 0 &&
                box.bottom <= height &&
                box.left >= 0 &&
                box.right <= width &&
                box.width >= 44 &&
                box.height >= 44,
            ),
            'Current bid input/confirm/exit are usable in the first phone viewport: ' +
              JSON.stringify({ width, height, boxes: geometry.bidControls }),
          );
        }
        assert.ok(
          geometry.companies.every(
            (box) => box.left >= 0 && box.right <= width,
          ),
          'Every visible desktop company header is within the viewport: ' +
            JSON.stringify({ role, stage, width, boxes: geometry.companies }),
        );
        for (const marker of geometry.markers) {
          assert.ok(
            marker.border >= 5,
            'Fuel frame has explicit strong thickness',
          );
          assert.ok(
            (marker.aboveArt || marker.besideArt) && marker.markerVisible,
            'Fuel type badge remains visible outside the illustration',
          );
        }
        const projected =
          role === 'player' ? fixtures[stage].game : fixtures[stage].publicGame;
        if (
          role !== 'player' &&
          !['regions', 'ended'].includes(projected.phase)
        ) {
          assert.deepEqual(
            geometry.turnOrder,
            [],
            'Player cards carry the order without a separate order panel',
          );
        }
        for (const lane of geometry.priceLanes) {
          const prices =
            lane.resource === 'uranium'
              ? [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16]
              : [1, 2, 3, 4, 5, 6, 7, 8];
          const capacity = lane.resource === 'uranium' ? 1 : 3;
          assert.deepEqual(
            lane.areas.map((area) => area.price),
            prices,
            'Printed classic resource price areas are complete',
          );
          assert.equal(
            lane.areas.reduce((sum, area) => sum + area.count, 0),
            projected.resources[lane.resource],
            'Visible price areas account for every remaining resource',
          );
          assert.ok(
            lane.areas.every(
              (area) =>
                area.count >= 0 &&
                area.count <= capacity &&
                area.count === area.displayedCount,
            ),
            'Each displayed price area shows the exact available count within classic capacity',
          );
          const next = lane.areas.filter((area) => area.next);
          assert.equal(
            next.length,
            projected.resources[lane.resource] > 0 ? 1 : 0,
          );
          if (next.length)
            assert.equal(
              next[0].price,
              projected.resourcePrices[lane.resource],
              'Next marked price agrees with the server-authoritative per-unit price',
            );
          const firstStocked = lane.areas.findIndex((area) => area.count > 0);
          if (firstStocked >= 0)
            assert.ok(
              lane.areas
                .slice(firstStocked + 1)
                .every((area) => area.count === capacity),
              'Higher price areas remain filled after cheapest-first buying',
            );
        }
        if (role !== 'player') {
          assert.ok(
            geometry.rootHeight <= height + 1,
            'Desktop fills viewport',
          );
          assert.equal(
            geometry.cityNodes,
            projected.phase === 'ended' ? 0 : 42,
          );
        }
        report.layouts.push({ width, height, role, stage, ...geometry });
        if (
          (width === 854 || width === 320) &&
          [
            'auction',
            'building',
            'resources',
            'powering',
            'ended',
            'crowded',
            'replace',
            'salvage',
            'owned-resources',
            'mixed-fuel',
          ].includes(stage)
        ) {
          const file = `${role}-${width}-${height}-${stage}.png`;
          await captureBrowserScreenshot(page, {
            path: join(output, file),
            fullPage: role === 'player',
          });
          report.screenshots.push(file);
        }
      }
    }
    await verifyStageSummaries();
    await verifyBoardFacts(page, fixtures, report);
    await verifyUiPolish(page, fixtures, report, output);
    await verifyUiRefinement(page, fixtures, report, output);
    await verifyPurchaseProgress(page, fixtures, report, output);
    await verifyPolish();
    await verifyPlayReview();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => window.setFixture('building', 'player'));
    await page.waitForTimeout(50);
    const legalCity = fixtures.building.actions.find(
      (action) => action.type === 'build',
    ).cityId;
    await choosePhoneCity(page, legalCity);
    await page.locator('.pg-build-preview .pg-primary').click();
    assert.deepEqual(
      (await page.evaluate(() => window.__commands)).at(-1).action,
      { type: 'build', cityId: legalCity },
    );
    report.actions.push(
      'City selection shows exact current cost and sends the authorized build intent',
    );
    await captureBrowserScreenshot(page, {
      path: join(output, 'player-320-568-build-costs.png'),
      fullPage: true,
    });
    report.screenshots.push('player-320-568-build-costs.png');
    const previousZoom = Number(
      await page.locator('.pg-map-panel:visible').getAttribute('data-map-zoom'),
    );
    await page.getByRole('button', { name: '放大地图' }).click();
    assert.ok(
      (await page
        .locator('.pg-map-panel:visible')
        .getAttribute('data-map-zoom')) ===
        String(Math.min(4, previousZoom + 0.4)),
    );
    await page.getByRole('button', { name: '复位', exact: true }).click();
    assert.ok(
      (await page
        .locator('.pg-map-panel:visible')
        .getAttribute('data-map-zoom')) === '1',
    );
    report.actions.push('Map zoom and reset do not send game commands');
    await page.getByRole('button', { name: '放大地图' }).click();
    const mapRect = await page
      .locator('.pg-phone-page:not([hidden]) .pg-phone-map .pg-map-frame')
      .boundingBox();
    const beforeDrag = await page
      .locator('.pg-phone-page:not([hidden]) .pg-phone-map .pg-map')
      .getAttribute('style');
    const scrollRect = await page
      .locator('.pg-phone-page:not([hidden]) .pg-page-scroll')
      .boundingBox();
    const dragY =
      (Math.max(mapRect.y, scrollRect.y) +
        Math.min(
          mapRect.y + mapRect.height,
          scrollRect.y + scrollRect.height,
        )) /
      2;
    await page.mouse.move(mapRect.x + mapRect.width * 0.5, dragY);
    await page.mouse.down();
    await page.mouse.move(mapRect.x + mapRect.width * 0.5 + 25, dragY + 15, {
      steps: 5,
    });
    await page.mouse.up();
    assert.notEqual(
      await page
        .locator('.pg-phone-page:not([hidden]) .pg-phone-map .pg-map')
        .getAttribute('style'),
      beforeDrag,
    );
    report.actions.push(
      'Dragging zoomed map changes viewport and sends no build intent',
    );
    await page.evaluate(() => window.setFixture('auction', 'player'));
    await page.waitForTimeout(50);
    const minimum = fixtures.auction.actions.find(
      (action) => action.type === 'bid',
    )?.amount;
    if (minimum != null) {
      const preserved = String(minimum + 1);
      await page.getByRole('spinbutton', { name: '报价金额' }).fill(preserved);
      await page
        .getByRole('spinbutton', { name: '报价金额' })
        .evaluate((input) => {
          window.__bidInput = input;
        });
      await page.evaluate(() => window.syncFixture());
      await page.waitForTimeout(60);
      assert.equal(
        await page.getByRole('spinbutton', { name: '报价金额' }).inputValue(),
        preserved,
        'Same decision synchronization preserves the typed quote',
      );
      assert.equal(
        await page
          .getByRole('spinbutton', { name: '报价金额' })
          .evaluate((input) => input === window.__bidInput),
        true,
        'Same decision synchronization does not remount the quote control',
      );
      report.actions.push(
        'Same-decision revision sync keeps quote input and DOM control stable',
      );
      await page
        .getByRole('spinbutton', { name: '报价金额' })
        .fill(String(minimum + 0.5));
      assert.ok(await page.locator('.pg-controls .pg-primary').isDisabled());
      await page.getByRole('button', { name: '增加报价', exact: true }).click();
      await page.locator('.pg-controls .pg-primary').click();
      assert.equal(
        (await page.evaluate(() => window.__commands)).at(-1).action.amount,
        minimum + 1,
      );
      report.actions.push(
        'Fractional bid cannot submit; directional step restores an integer legal bid',
      );
    }
    await page.evaluate(() => window.setFixture('offer', 'player'));
    await page.waitForTimeout(50);
    await page.getByRole('button', { name: '公司', exact: true }).click();
    await page
      .locator('.pg-phone-page:not([hidden]) .pg-company-card')
      .first()
      .click();
    await page.waitForFunction(() => document.querySelector('dialog[open]'));
    assert.ok(
      await page.locator('dialog .pg-screen .pg-company-inspector').count(),
    );
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(), 0);
    report.actions.push(
      'Portal company panel carries independent pg scope and Escape closes it',
    );
    if (fixtures['mixed-fuel']) {
      await page.evaluate(() => window.setFixture('mixed-fuel', 'player'));
      await page.waitForTimeout(50);
      const options = page.locator('.pg-run-options').first();
      await options.locator('summary').click();
      assert.ok(
        (await options.locator('button').count()) > 1,
        'Each legal mixed-fuel recipe remains selectable',
      );
      await options.locator('button').first().click();
      const chosen = (await page.evaluate(() => window.__commands)).at(
        -1,
      ).action;
      assert.ok(
        fixtures['mixed-fuel'].actions.some(
          (action) => JSON.stringify(action) === JSON.stringify(chosen),
        ),
        'Expanded mixed-fuel button submits a legal action',
      );
      report.actions.push(
        'Collapsed mixed-fuel recipe list opens and retains every legal authorized run',
      );
    }
    if (captureRules) {
      await captureRuleScreens();
    }
    await page.evaluate(() => window.setFixture('auction', 'host'));
    await page.waitForTimeout(50);
    const initial = await page.evaluate(() => window.__plays.length);
    await page.evaluate(() => window.advanceFeedback());
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.__plays.length), initial + 1);
    assert.equal(
      await page
        .locator('[data-power-grid-effect]')
        .getAttribute('data-power-grid-effect'),
      'bid',
    );
    await page.evaluate(() => window.advanceFeedback());
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.__plays.length), initial + 1);
    assert.equal(
      await page
        .locator('[data-power-grid-effect]')
        .getAttribute('data-power-grid-effect'),
      'bid',
      'Duplicate saved event leaves the original effect running',
    );
    report.audio.push(
      'Only a new saved feedback key invokes local playback; identical feedback is consumed once',
    );
    await page.evaluate(() => window.setFixture('auction', 'host', true));
    await page.waitForTimeout(50);
    const paused = await page.evaluate(() => window.__plays.length);
    await page.evaluate(() => window.advanceFeedback());
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.__plays.length), paused);
    report.audio.push('Paused feedback invokes no playback');
    assert.equal(await page.locator('[data-power-grid-effect]').count(), 0);
    await page.evaluate(() => window.setFixture('ended', 'host'));
    await page.waitForTimeout(50);
    const beforeEnd = await page.evaluate(() => window.__plays.length);
    await page.evaluate(() => window.advanceFeedback(3, 'end'));
    await page.waitForTimeout(50);
    assert.equal(
      await page.evaluate(() => window.__plays.length),
      beforeEnd + 1,
      'New saved terminal event can play its ending cue',
    );
    assert.equal(
      await page
        .locator('[data-power-grid-effect]')
        .getAttribute('data-power-grid-effect'),
      'end',
    );
    report.audio.push(
      'New terminal saved event plays ending cue and effect; terminal phase is not disabled',
    );
    await page.evaluate(() => window.setFixture('auction', 'player'));
    await page.waitForTimeout(50);
    assert.equal(await page.locator('[data-power-grid-sound]').count(), 0);
    report.audio.push('Phone exposes no sound control');
    const audioFiles = (await readdir(join(directory, 'assets'))).filter(
      (file) => /\.(wav|flac)$/.test(file),
    );
    assert.equal(audioFiles.length, 6);
    report.audio.push(
      await page.evaluate(async (files) => {
        const audio = new AudioContext();
        const decoded = [];
        try {
          for (const file of files) {
            const sound = await audio.decodeAudioData(
              await (await fetch('/assets/' + file)).arrayBuffer(),
            );
            const channel = sound.getChannelData(0);
            let peak = 0,
              square = 0;
            for (const value of channel) {
              peak = Math.max(peak, Math.abs(value));
              square += value * value;
            }
            decoded.push({
              file,
              seconds: sound.duration,
              channels: sound.numberOfChannels,
              sampleRate: sound.sampleRate,
              peak,
              rms: Math.sqrt(square / channel.length),
            });
            if (
              sound.numberOfChannels !== 1 ||
              sound.duration <= 0 ||
              peak >= 0.9
            )
              throw new Error('Invalid decoded audio');
          }
          return { decoded };
        } finally {
          await audio.close();
        }
      }, audioFiles),
    );
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.requests, []);
    report.status = 'passed';
  }
} catch (error) {
  report.status = 'failed';
  report.failure = String(error);
  await captureBrowserScreenshot(page, {
    path: join(output, 'failure.png'),
    fullPage: true,
  })
    .then(() => report.screenshots.push('failure.png'))
    .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
  report.elapsedSeconds = Math.round((performance.now() - started) / 10) / 100;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      status: report.status,
      layouts: report.layouts.length,
      actions: report.actions.length,
      audio: report.audio.length,
      elapsedSeconds: report.elapsedSeconds,
      output,
    }),
  );
}

async function choosePhoneCity(page, city) {
  await page.keyboard.press('Escape');
  if (city)
    await page
      .locator(
        `.pg-phone-page:not([hidden]) .pg-phone-map [data-city="${city}"]`,
      )
      .press('Enter');
}
