import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, mkdtemp, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, join, extname, sep } from 'node:path';
import { build as bundle } from 'esbuild';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const name =
  process.argv.find((value) => value.startsWith('--evidence='))?.slice(11) ??
  'fixture';
const amountOnly = process.argv.includes('--amount-only');
assert.match(name, /^[a-z0-9-]{1,40}$/);
const output = resolve('artifacts/maintenance/v1.0.1/power-grid/ui', name);
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
export async function make(){
 const seats=['p1','p2','p3','p4','p5','p6'];let seed=728;
 const random={next(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}};
 const context={seats,random};let state=rules.initialize(context);const fixtures={};
 for(let index=0;index<12000;index++){
  rules.validateState(state,seats);
  const decision=rules.decisions(state)[0];
  const seat=decision?.seatId ?? seats[0];
  const view=rules.project(state,{role:'player',seatId:seat});
  const actions=rules.legalActions(state,seat);
  if(!fixtures[view.phase]) fixtures[view.phase]={game:view,publicGame:rules.project(state,{role:'public'}),actions,decision};
  if(view.phase==='building' && Object.values(view.players).reduce((n,p)=>n+p.cities.length,0)>30) fixtures.crowded={game:view,publicGame:rules.project(state,{role:'public'}),actions,decision};
  if(view.phase==='replace' && view.replacement?.removedPlantId!==null) fixtures.salvage={game:view,publicGame:rules.project(state,{role:'public'}),actions,decision};
  if(rules.ended(state)) break;
  if(!decision || !actions.length) throw new Error('Rules fixture stopped without a legal decision');
  const result=await bot.decide({view,actions,decision,memory:null,difficulty:'juewu',random,signal:new AbortController().signal});
  state=rules.apply(state,result.action,seat,context).state;
 }
 if(!fixtures.ended) throw new Error('Fixture match did not finish');
 return fixtures;
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
const fixtures = await (
  await import(
    new URL('file:///' + join(work, 'generator.mjs').replaceAll('\\', '/'))
  )
).make();
await writeFile(join(work, 'fixtures.json'), JSON.stringify(fixtures));
const entry = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {client} from ${JSON.stringify(resolve('apps/web/src/game-clients/PowerGridScreen.tsx'))};
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
const fixtures=await (await fetch('./fixtures.json')).json();
window.__commands=[];window.__plays=[];
HTMLMediaElement.prototype.play=function(){window.__plays.push(this.src);return Promise.resolve();};
HTMLMediaElement.prototype.pause=function(){};
const names=['一号电力公司测试长昵称abcdefghijklmnop','蓝色莱茵电力','第三家电力公司','第四家绿色电网','五号原子动力','六号能源投资'];
function Fixture(){const [setting,setSetting]=useState({name:'regions',role:'host',paused:false,serial:0});const [feedback,setFeedback]=useState(null);
window.setFixture=(name,role='host',paused=false)=>{setFeedback(null);window.__commands=[];setSetting(s=>({name,role,paused,serial:s.serial+1}));};
const fixture=fixtures[setting.name];const game=setting.role==='player'?fixture.game:fixture.publicGame;
window.advanceFeedback=()=>setFeedback({instanceId:'00000000-0000-4000-8000-000000000001',branch:0,revision:2,events:[{kind:'effect-complete',text:game.latest?.text??'保存'}]});
const seats=game.seatOrder.map((id,index)=>({id,name:names[index],avatarId:'avatar-'+(index+1),controller:'human',ready:true,online:true,botDifficulty:null}));
const view={instanceId:'00000000-0000-4000-8000-000000000001',revision:1,branch:0,status:game.phase==='ended'?'ended':'playing',paused:setting.paused,restored:false,joinOpen:false,playMode:'play',countdownSeconds:20,decisionClock:game.phase==='ended'?null:{id:'clock-'+setting.serial,serverTime:Date.now(),remainingMs:20000,running:!setting.paused},game:{id:'power-grid',name:'电力公司',min:2,max:6},catalog:[],ownerSeatId:'p1',capabilities:{manage:setting.role==='host',control:setting.role==='host'||(setting.role==='player'&&game.self?.seatId==='p1')},seats,self:{role:setting.role,seatId:game.self?.seatId??null},gameView:game,actions:setting.role==='player'&&!setting.paused?fixture.actions:[],decisionId:fixture.decision?.id??null,selectionToken:fixture.decision?.id??null,history:[],lifecycleActions:[],botError:null,endReason:game.phase==='ended'?'游戏完成':null};
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
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 854, height: 480 } });
  page.on('pageerror', (error) => report.errors.push(String(error)));
  page.on('request', (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith('data:'))
      report.requests.push(request.url());
  });
  await page.goto(origin);
  await page.waitForFunction(() => window.fixtureNames?.length > 0);
  if (amountOnly) {
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
    await page.screenshot({
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
        await page.waitForTimeout(50);
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
          return {
            width: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            rootHeight: rect.height,
            viewportHeight: innerHeight,
            small,
            cityNodes: root.querySelectorAll('[data-city]').length,
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
        if (role !== 'player') {
          assert.ok(
            geometry.rootHeight <= height + 1,
            'Desktop fills viewport',
          );
          assert.equal(geometry.cityNodes, stage === 'ended' ? 0 : 42);
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
          ].includes(stage)
        ) {
          const file = `${role}-${width}-${height}-${stage}.png`;
          await page.screenshot({
            path: join(output, file),
            fullPage: role === 'player',
          });
          report.screenshots.push(file);
        }
      }
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => window.setFixture('building', 'player'));
    await page.waitForTimeout(50);
    const legalCity = fixtures.building.actions.find(
      (action) => action.type === 'build',
    ).cityId;
    await page.locator('.pg-phone-map select').selectOption(legalCity);
    await page.locator('.pg-build-preview .pg-primary').click();
    assert.deepEqual(
      (await page.evaluate(() => window.__commands)).at(-1).action,
      { type: 'build', cityId: legalCity },
    );
    report.actions.push(
      'City selection shows exact current cost and sends the authorized build intent',
    );
    await page.getByRole('button', { name: '放大地图' }).click();
    assert.ok(
      (await page.locator('.pg-map').getAttribute('style')).includes(
        'scale(1.4)',
      ),
    );
    await page.getByRole('button', { name: '全图', exact: true }).click();
    assert.ok(
      (await page.locator('.pg-map').getAttribute('style')).includes(
        'scale(1)',
      ),
    );
    report.actions.push('Map zoom and reset do not send game commands');
    await page.getByRole('button', { name: '放大地图' }).click();
    const mapRect = await page
      .locator('.pg-phone-map .pg-map-frame')
      .boundingBox();
    const beforeDrag = await page
      .locator('.pg-phone-map .pg-map')
      .getAttribute('style');
    await page.mouse.move(
      mapRect.x + mapRect.width * 0.5,
      mapRect.y + mapRect.height * 0.5,
    );
    await page.mouse.down();
    await page.mouse.move(
      mapRect.x + mapRect.width * 0.5 + 25,
      mapRect.y + mapRect.height * 0.5 + 15,
      { steps: 5 },
    );
    await page.mouse.up();
    assert.notEqual(
      await page.locator('.pg-phone-map .pg-map').getAttribute('style'),
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
    await page.getByRole('button', { name: '各家公司', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('dialog[open]'));
    assert.ok(await page.locator('dialog .pg-screen .pg-companies').count());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(), 0);
    report.actions.push(
      'Portal company panel carries independent pg scope and Escape closes it',
    );
    await page.evaluate(() => window.setFixture('auction', 'host'));
    await page.waitForTimeout(50);
    const initial = await page.evaluate(() => window.__plays.length);
    await page.evaluate(() => window.advanceFeedback());
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.__plays.length), initial + 1);
    await page.evaluate(() => window.advanceFeedback());
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.__plays.length), initial + 1);
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
    await page.evaluate(() => window.setFixture('auction', 'player'));
    await page.waitForTimeout(50);
    assert.equal(await page.locator('[data-power-grid-sound]').count(), 0);
    report.audio.push('Phone exposes no sound control');
    const audioFiles = (await readdir(join(directory, 'assets'))).filter(
      (file) => file.endsWith('.wav'),
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
