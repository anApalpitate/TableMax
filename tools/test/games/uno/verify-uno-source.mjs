import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';

assertWorkspaceRoot();
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const values = args.filter((arg) => arg.startsWith('--' + name + '='));
  assert(values.length <= 1, 'Duplicate option: ' + name);
  return values[0]?.slice(name.length + 3) ?? fallback;
};
const evidence = option('evidence');
assert.match(evidence ?? '', /^[a-z0-9-]{1,65}$/);
const groups = [
  'layout',
  'dialogs',
  'config',
  'delay',
  'penalty',
  'evidence',
  'baseline',
];
const selected = option('only', groups.join(',')).split(',');
assert(
  selected.every((value) => groups.includes(value)),
  'Unknown verification group',
);
const allSizes = [
  [320, 568],
  [360, 800],
  [390, 844],
  [430, 932],
  [620, 900],
  [621, 900],
  [844, 390],
  [932, 430],
  [1280, 720],
  [1920, 1080],
  [3840, 2160],
];
const sizes = option('sizes', allSizes.map(([w, h]) => w + 'x' + h).join(','))
  .split(',')
  .map((value) => value.split('x').map(Number));
assert(sizes.every(([w, h]) => allSizes.some(([x, y]) => x === w && y === h)));
const priorFailures = Number(option('prior-failures', '0'));
assert(
  Number.isInteger(priorFailures) && priorFailures >= 0 && priorFailures < 10,
);
const output = resolve('artifacts/maintenance/uno-source-20261020', evidence);
await mkdir(dirname(output), { recursive: true });
await mkdir(output, { recursive: false });
const sha = (value) => createHash('sha256').update(value).digest('hex');
const pathKey = (value) => relative(process.cwd(), value).replaceAll('\\', '/');
const sourcePath = 'tools/test/games/uno/verify-uno-source.mjs';
const report = {
  schemaVersion: 1,
  scope:
    'Current UNO source compiled by Vite, real React PlatformGame/BoxScreen/CountdownSettings and real UNO rules/project/validateState. Initial natural deals plus explicitly controlled valid 108-card states; user commands use simulated transport. No Socket.IO, durable-save, installer, physical-phone, OS-DPI or speaker/listening proof.',
  result: 'running',
  output,
  parameters: args,
  selected,
  sizes,
  failureBudget: 10,
  priorFailures,
  checks: [],
  failures: [],
  unexecuted: [],
  metrics: [],
  comparisons: [],
  screenshots: [],
  errors: [],
  externalRequests: [],
  inputs: {},
  generated: {},
  baseline: null,
  fixtureBoundaries: [
    'Browser is headless Edge with --mute-audio, isolated temporary context and 127.0.0.1-only HTTP.',
    'Registry discovery is restricted to UNO, and its production/development branch selects the actual source loader. Other registry/setting logic remains product source.',
    'Dense hands, catch windows and penalties start from full-deck state-validated fixtures; stated rule transitions are applied by actual UNO rules before projection.',
    'ActionTiming snapshots and command delivery are simulated transport. Real authority, persistence and Socket.IO are outside this script.',
    'Baseline loads only f719708 UNO web/index.tsx, ui/Hand.tsx and ui/style.css; all other imports resolve to current source. Current and baseline have isolated builds and contexts.',
  ],
};
await writeFile(
  join(output, 'verifier-source.mjs'),
  await readFile(new URL(import.meta.url)),
);
const bind = async (path) => {
  const absolute = resolve(path);
  if (
    absolute.startsWith(output) ||
    absolute.includes('node_modules') ||
    !existsSync(absolute)
  )
    return;
  const key = pathKey(absolute);
  const bytes = await readFile(absolute);
  if (report.inputs[key])
    assert.equal(
      report.inputs[key],
      sha(bytes),
      'Input changed during compilation: ' + key,
    );
  else report.inputs[key] = sha(bytes);
};
const methodClosure = new Set();
async function bindMethod(path) {
  const absolute = resolve(path);
  if (methodClosure.has(absolute)) return;
  methodClosure.add(absolute);
  await bind(absolute);
  const source = await readFile(absolute, 'utf8');
  for (const match of source.matchAll(
    /(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g,
  )) {
    const dependency = resolve(dirname(absolute), match[1]);
    if (existsSync(dependency)) await bindMethod(dependency);
  }
}
for (const path of [
  sourcePath,
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'tools/test/support/browser-test.mjs',
  'tools/test/support/fixture-server.mjs',
  'tools/test/support/screenshots.mjs',
  'tools/maintenance/verification-artifacts.mjs',
  'tools/maintenance/lifecycle.mjs',
])
  await bind(path);
for (const path of [
  sourcePath,
  'tools/test/runner/test-scoped.mjs',
  'tools/test/runner/scopes.mjs',
])
  await bindMethod(path);

const file = (value) => JSON.stringify(resolve(value).replaceAll('\\', '/'));
function fixtureSource(clientPath) {
  return `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {PlatformGame} from ${file('apps/web/src/session/gameHostAdapter.tsx')};
import {BoxScreen} from ${file('apps/web/src/screens/BoxScreen.tsx')};
import {rules} from ${file('games/uno/rules/index.ts')};
import {fixture,context} from ${file('games/uno/rules/test-fixtures.ts')};
import {CARD_IDS,getCard} from ${file('games/uno/data/catalog.ts')};
import {validateUnoSetup,unoSetupFor} from ${file('games/uno/config.ts')};
import {moduleCatalog} from ${file('apps/web/src/catalog.ts')};
import {client} from ${file(clientPath)};
import ${file('apps/web/src/styles.css')};
import ${file('apps/web/src/scrollbars.css')};
import ${file('apps/web/src/screens/box-screen.css')};
const root=createRoot(document.getElementById('root'));
const noop=()=>{};
const ids=['a','b','c','d','e','f'];
let serial=0,current,catchObserver;
window.commands=[];window.cardClicks=[];window.fixtureFacts=[];
document.addEventListener('click',event=>{const button=event.target.closest?.('.uno-hand-card');if(button)window.cardClicks.push(button.dataset.cardId);},true);
function configured(state,setup){state.setup=setup;if(setup.drawPenaltyStacking)state.drawPenalty??=null;return rules.validateState(state,state.seats);}
function step(state,action,seat=state.turnSeat){const result=rules.apply(state,action,seat,context(41,state.seats));rules.validateState(result.state,state.seats);return result;}
function scenario(name,setup){
 let state,actor='a',before=null,result=null;
 if(name==='normal'){
  state=rules.initialize({...context(1257,ids),setup});
  if(state.stage==='choose-color')state=step(state,{type:'choose-color',color:'red'}).state;
  actor=state.turnSeat;
 }else if(name==='dense'){
  const playable=CARD_IDS.filter(id=>id!=='red-5-a'&&(getCard(id).color==='red'||getCard(id).kind==='number'&&getCard(id).value===5)).slice(0,28);
  const chosen=new Set([...playable,'red-5-a']),available=CARD_IDS.filter(id=>!chosen.has(id)),hands={a:playable};
  for(const id of ids.slice(1))hands[id]=available.splice(0,7);
  state=configured(fixture(hands),setup);
 }else if(name==='catch'){
  state=configured(fixture({a:['red-1-a','yellow-2-a'],b:['red-2-a','blue-1-a'],c:['green-2-a','yellow-3-a']}),setup);
  state=step(state,{type:'play',cardId:'red-1-a'},'a').state;actor='c';
 }else if(name==='penalty'||name==='four'||name==='evidence'){
  state=configured(fixture({a:['red-draw-two-a','yellow-2-a'],b:['blue-draw-two-a','wild-draw-four-1','red-1-a'],c:['green-draw-two-a','green-1-a'],d:['blue-2-a'],e:['yellow-1-a'],f:['blue-3-a']}),{...setup,drawPenaltyStacking:true});
  state=step(state,{type:'play',cardId:'red-draw-two-a'},'a').state;
  if(name==='penalty')state=step(state,{type:'play',cardId:'blue-draw-two-a'},'b').state;
  else state=step(state,{type:'play',cardId:'wild-draw-four-1',color:'green'},'b').state;
  actor='c';
  if(name==='evidence'){before=state;result=step(state,{type:'challenge-draw-four'},'c');}
 }else throw new Error('Unknown scenario '+name);
 rules.validateState(state,state.seats);
 return {state,actor,before,result};
}
function displayNames(mode,seats){return seats.map((id,i)=>({id,name:mode==='chinese'?'长'.repeat(24):mode==='latin'?'LongNicknameWithoutSpaces'.slice(0,24):'玩家'+(i+1),avatarId:'avatar-'+(i+1),controller:'human',ready:true,online:true,botDifficulty:null}));}
function sessionFor(options){
 const setup=validateUnoSetup(options.setup??{drawPenaltyStacking:false,catchUnoDelayMs:500});
 const made=scenario(options.scenario??'normal',setup),role=options.role??'player',actor=options.actor??made.actor;
 const seats=displayNames(options.names??'short',made.state.seats),owner=options.owner!==false;
 const canControl=options.control??(role==='host'||role==='player'&&owner);
 const entry=moduleCatalog.find(game=>game.id==='uno');
 const session={role,credential:'fixture',isHost:role==='host',canManageSeats:role==='host',canControl,self:role==='player'?seats.find(s=>s.id===actor):undefined,
 connected:true,locked:false,busy:false,admissionPending:false,awaitingConfirmation:false,message:'',messageKind:'none',feedback:null,errorId:'',motion:[],name:'',setName:noop,retry:noop,retryAdmission:noop,
 addresses:[],adapters:[],port:38473,address:'',joinUrl:'',catalog:moduleCatalog,games:moduleCatalog,subscribeInteractions:()=>noop,subscribeInteractionResets:()=>noop,
 view:{instanceId:'uno-source-'+(++serial),branch:0,revision:1,status:options.status??(options.box?'lobby':'playing'),paused:false,restored:false,playMode:'play',game:{...entry,setup:unoSetupFor(made.state)},gameView:null,
 decisionId:null,countdownSeconds:30,decisionClock:null,actions:[],lifecycleActions:[],seats,history:[],joinOpen:true,ownerSeatId:owner?actor:made.state.seats.find(id=>id!==actor),catalog:moduleCatalog,capabilities:{control:canControl,manage:role==='host',manageSeats:role==='host'},self:{role,seatId:role==='player'?actor:null},selectionToken:null},command:send};
 current={options,made,actor,session,key:session.view.instanceId,openedAt:performance.now()};project();return session;
}
function project(){const {session,actor,made,options}=current;const state=made.state;
 session.view.gameView=options.box&&session.view.status==='lobby'?null:rules.project(state,session.role==='player'?{role:'player',seatId:actor}:{role:'public'});
 const decision=rules.decisions(state).find(d=>d.seatId===actor)??rules.decisions(state)[0];
 session.view.decisionId=decision?.id??null;session.view.actions=session.role==='player'?rules.legalActions(state,actor):[];
 session.view.lifecycleActions=rules.lifecycleActions(state);
 if(options.scenario==='catch')session.view.actionTiming=[{actionType:'catch-uno',remainingMs:options.delay??500,serverTime:Date.now(),running:options.running!==false}];
}
function paint(){flushSync(()=>root.render(current.options.box?<BoxScreen key={current.key} session={current.session}/>:<PlatformGame key={current.key} session={current.session} client={client}/>));}
function send(command){window.commands.push({command,at:performance.now()});
 if(command.type==='set-game-setup'){
  if(current.session.view.status!=='lobby'||!current.session.canControl)throw new Error('Fixture rejected unauthorized setup');
  current.session.view={...current.session.view,game:{...current.session.view.game,setup:validateUnoSetup(command.setup)}};paint();return;
 }
 if(command.type==='game'&&current.options.commit){const result=step(current.made.state,command.action,current.actor);commit(result);}
}
function commit(result){const before=rules.project(current.made.state,{role:'player',seatId:current.actor});current.made.state=result.state;project();const after=current.session.view.gameView;
 current.session.view={...current.session.view,revision:current.session.view.revision+1};
 current.session.feedback={instanceId:current.session.view.instanceId,branch:current.session.view.branch,revision:current.session.view.revision,events:result.events};
 current.session.motion=client.savedChanges(before,after);paint();
}
window.renderUno=options=>{catchObserver?.disconnect();window.catchObservation=null;history.replaceState(null,'','/'+(options.role??'player')+(options.box?'':'/game'));window.commands=[];window.cardClicks=[];sessionFor(options);paint();const catchButton=document.querySelector('.uno-catch-control');if(catchButton){const observation={receivedAt:current.openedAt,initialDisabled:catchButton.disabled,enabledAt:catchButton.disabled?null:performance.now()};window.catchObservation=observation;catchObserver=new MutationObserver(()=>{if(!catchButton.disabled&&observation.enabledAt===null)observation.enabledAt=performance.now();});catchObserver.observe(catchButton,{attributes:true,attributeFilter:['disabled']});}window.fixtureFacts.push({scenario:options.scenario??'normal',origin:options.scenario==='normal'?'natural-initial-deal':'controlled-validated-108-card-state',role:current.session.role,actor:current.actor,handCount:current.session.view.gameView?.self?.hand.length,setup:current.session.view.game.setup});};
window.saveStatus=enabled=>{current.session={...current.session,message:enabled?'已保存':'',messageKind:enabled?'saved':'none'};paint();};
window.commitEvidence=()=>{if(!current.made.result)throw new Error('Evidence scenario required');commit(current.made.result);};
window.restore=()=>{current.key='restored-'+(++serial);current.session={...current.session,feedback:null,motion:[]};paint();};
window.snapshot=()=>({commands:window.commands,cardClicks:window.cardClicks,view:current.session.view,hand:current.session.view.gameView?.self?.hand.map(c=>c.id),facts:window.fixtureFacts,catchObservation:window.catchObservation});
window.renderUno({scenario:'normal'});
`;
}

async function compile(name, clientPath, baselineFiles = {}) {
  const work = join(output, name);
  await mkdir(work);
  await writeFile(
    join(work, 'index.html'),
    '<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
  );
  await writeFile(join(work, 'entry.tsx'), fixtureSource(clientPath));
  const registry = resolve('apps/web/src/game-clients/registry.ts').replaceAll(
    '\\',
    '/',
  );
  const details = resolve('apps/web/src/game-clients/details.ts').replaceAll(
    '\\',
    '/',
  );
  await build({
    configFile: false,
    root: work,
    logLevel: 'error',
    plugins: [
      {
        name: 'bind-source-and-uno-discovery',
        enforce: 'pre',
        async load(id) {
          const path = id.split('?')[0];
          if (!path.includes('\0') && existsSync(path)) await bind(path);
          if (baselineFiles[path]) return baselineFiles[path];
        },
        transform(code, id) {
          const path = id.split('?')[0].replaceAll('\\', '/');
          if (path === registry)
            return code
              .replace(
                /const development = import\.meta\.glob<ClientExports>\([\s\S]*?\);/,
                'const development = {"../../../../games/uno/web/index.tsx":()=>import(' +
                  file(clientPath) +
                  ')};',
              )
              .replaceAll('import.meta.env.PROD', 'false');
          if (path === details)
            return code
              .replace(
                /const development = import\.meta\.glob<ModuleManifest>\([\s\S]*?\);/,
                'const development = {"../../../../games/uno/game-module.json":()=>import(' +
                  file('games/uno/game-module.json') +
                  ').then(m=>m.default)};',
              )
              .replaceAll('import.meta.env.PROD', 'false');
        },
      },
      react(),
    ],
    resolve: {
      alias: {
        react: resolve('apps/web/node_modules/react'),
        'react-dom': resolve('apps/web/node_modules/react-dom'),
      },
    },
    build: {
      outDir: join(work, 'bundle'),
      emptyOutDir: false,
      target: ['chrome110', 'safari16'],
    },
  });
  for (const path of ['index.html', 'entry.tsx'])
    report.generated[name + '/' + path] = sha(await readFile(join(work, path)));
  return serveFixture(join(work, 'bundle'));
}

let browser, currentServer, baselineServer;
const currentMetrics = new Map();
const enabled = (group) => selected.includes(group);
const planned = [];
for (const [w, h] of sizes) {
  if (enabled('layout'))
    for (const [scenario, names] of [
      ['normal', 'short'],
      ['dense', 'chinese'],
      ['dense', 'latin'],
    ])
      planned.push(`layout:${w}x${h}:${scenario}:${names}`);
  if (enabled('dialogs')) planned.push(`dialogs:${w}x${h}`);
  if (enabled('baseline'))
    for (const [scenario, names] of [
      ['normal', 'short'],
      ['dense', 'chinese'],
    ])
      planned.push(`baseline:${w}x${h}:${scenario}:${names}`);
}
if (enabled('config'))
  for (const [role, status, control] of [
    ['host', 'lobby', true],
    ['player', 'lobby', true],
    ['player', 'lobby', false],
    ['host', 'playing', true],
    ['public', 'lobby', false],
  ])
    planned.push(`config:${role}:${status}:${control}`);
if (enabled('delay'))
  for (const delay of [0, 500, 5000]) planned.push('delay:' + delay);
if (enabled('penalty'))
  for (const scenario of ['penalty', 'four'])
    planned.push('penalty:' + scenario);
if (enabled('evidence'))
  planned.push('evidence:authorized-new-result-and-restore');
async function capture(page, name) {
  const path = join(output, name + '.png');
  await captureBrowserScreenshot(page, { path, fullPage: true });
  report.screenshots.push(path);
}
async function check(name, run, page) {
  if (report.failures.length + priorFailures >= 10) {
    report.unexecuted.push(name);
    return;
  }
  const started = Date.now();
  try {
    const metrics = await run();
    report.checks.push({
      name,
      result: 'passed',
      elapsedMs: Date.now() - started,
    });
    if (metrics) report.metrics.push({ name, ...metrics });
  } catch (error) {
    const item = { name, error: error.stack };
    report.failures.push(item);
    report.checks.push({
      name,
      result: 'failed',
      elapsedMs: Date.now() - started,
    });
    if (page)
      try {
        await capture(page, 'failure-' + report.failures.length);
      } catch (captureError) {
        item.captureError = captureError.message;
      }
  }
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
async function ready(page, options) {
  await page.evaluate((options) => window.renderUno(options), options);
  await page.locator(options.box ? '.box-screen' : '.uno-screen').waitFor();
  await page.evaluate(() =>
    Promise.all(
      [...document.images].map((image) =>
        image.decode().catch(() => undefined),
      ),
    ),
  );
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
}
async function openSettings(page, box = false) {
  if (!box)
    await page.getByRole('button', { name: '菜单', exact: true }).click();
  await page.getByRole('button', { name: '游戏设置', exact: true }).click();
  await page.locator('.uno-setup-settings').waitFor();
}
async function measurements(page, { dialogs = false } = {}) {
  return page.evaluate((dialogs) => {
    const rect = (element) => {
      const r = element.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        bottom: r.bottom,
        right: r.right,
      };
    };
    const root = document.documentElement,
      screen = dialogs
        ? [...document.querySelectorAll('dialog[open]')].at(-1)
        : document.querySelector('.uno-screen,.box-screen');
    if (!screen) throw new Error('Expected active fixture surface');
    const clipped = [],
      small = [],
      buttons = [];
    const walker = document.createTreeWalker(screen, NodeFilter.SHOW_TEXT);
    const decorative =
      '.uno-card,.uno-mini-hand,.uno-saved-effect,svg,script,style,[hidden]';
    while (walker.nextNode()) {
      const node = walker.currentNode,
        element = node.parentElement;
      if (
        !node.textContent.trim() ||
        !element ||
        element.closest(decorative) ||
        !element.getClientRects().length ||
        getComputedStyle(element).visibility === 'hidden'
      )
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const textRects = [...range.getClientRects()].filter(
        (r) => r.width > 0 && r.height > 0,
      );
      if (!textRects.length) continue;
      const font = Number.parseFloat(getComputedStyle(element).fontSize);
      if (font < 15.9)
        small.push({ text: node.textContent.trim().slice(0, 60), font });
      let visibleRects = textRects.map(({ left, right, top, bottom }) => ({
        left,
        right,
        top,
        bottom,
      }));
      for (
        let ancestor = element;
        ancestor && ancestor !== screen.parentElement;
        ancestor = ancestor.parentElement
      ) {
        const style = getComputedStyle(ancestor),
          r = ancestor.getBoundingClientRect();
        if (
          visibleRects.some(
            (t) =>
              (/hidden|clip/.test(style.overflowX) &&
                (t.left < r.left - 2 || t.right > r.right + 2)) ||
              (/hidden|clip/.test(style.overflowY) &&
                (t.top < r.top - 2 || t.bottom > r.bottom + 2)),
          )
        ) {
          clipped.push({
            text: node.textContent.trim().slice(0, 60),
            ancestor: ancestor.className,
          });
          break;
        }
        visibleRects = visibleRects
          .map((t) => ({
            left: /auto|scroll/.test(style.overflowX)
              ? Math.max(t.left, r.left)
              : t.left,
            right: /auto|scroll/.test(style.overflowX)
              ? Math.min(t.right, r.right)
              : t.right,
            top: /auto|scroll/.test(style.overflowY)
              ? Math.max(t.top, r.top)
              : t.top,
            bottom: /auto|scroll/.test(style.overflowY)
              ? Math.min(t.bottom, r.bottom)
              : t.bottom,
          }))
          .filter((t) => t.right > t.left && t.bottom > t.top);
      }
    }
    for (const button of screen.querySelectorAll('button')) {
      if (
        !button.getClientRects().length ||
        button.closest('.uno-card,.uno-saved-effect')
      )
        continue;
      const r = rect(button),
        css = getComputedStyle(button);
      buttons.push({
        name: button.getAttribute('aria-label') ?? button.textContent.trim(),
        ...r,
        font: Number.parseFloat(css.fontSize),
        major: button.matches('.uno-primary,.uno-reaction button'),
      });
    }
    const header = screen.querySelector('.uno-hand-heading h2'),
      sort = screen.querySelector('.uno-hand-title button');
    const owner = screen.querySelector('.uno-hand-scroll');
    const receipts = [
      ...screen.querySelectorAll(
        '.uno-saved-label,.session-save-overlay,.box-save-status[data-visible="true"]',
      ),
    ]
      .filter(
        (element) =>
          element.textContent.trim() && element.getClientRects().length,
      )
      .map((element) => {
        const parent =
          element.closest('.uno-latest,.uno-toolbar,.box-hero,.game-toolbar') ??
          element.parentElement;
        const range = document.createRange();
        range.selectNodeContents(element);
        return {
          text: element.textContent.trim(),
          ...rect(element),
          parent: rect(parent),
          glyphs: [...range.getClientRects()].map((r) => ({
            x: r.x,
            y: r.y,
            right: r.right,
            bottom: r.bottom,
          })),
        };
      });
    const scrolls = [
      screen,
      ...screen.querySelectorAll('.uno-hand-scroll,.uno-evidence-cards'),
    ].map((element) => ({
      className: element.className,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      gutter: getComputedStyle(element).scrollbarGutter,
      color: getComputedStyle(element).scrollbarColor,
      track: getComputedStyle(element, '::-webkit-scrollbar-track')
        .backgroundColor,
    }));
    return {
      width: innerWidth,
      height: innerHeight,
      rootWidth: root.clientWidth,
      rootScrollWidth: root.scrollWidth,
      screen: {
        ...rect(screen),
        scrollHeight: screen.scrollHeight,
        clientHeight: screen.clientHeight,
      },
      clipped,
      small,
      buttons,
      receipts,
      header: header && rect(header),
      sort: sort && rect(sort),
      hand: owner && {
        ...rect(owner),
        scrollWidth: owner.scrollWidth,
        clientWidth: owner.clientWidth,
      },
      scrolls,
      actionsInViewport: buttons
        .filter((b) => b.major || /排序/.test(b.name))
        .map((b) => ({
          name: b.name,
          visible:
            b.y >= 0 &&
            b.bottom <= innerHeight &&
            b.x >= 0 &&
            b.right <= innerWidth,
        })),
    };
  }, dialogs);
}
function assertGeometry(metrics, { dialogs = false } = {}) {
  assert(
    metrics.rootScrollWidth <= metrics.rootWidth + 1,
    'Horizontal root overflow: ' +
      JSON.stringify({
        root: metrics.rootWidth,
        scroll: metrics.rootScrollWidth,
      }),
  );
  assert.deepEqual(
    metrics.clipped,
    [],
    'Text clipped by a non-scroll ancestor',
  );
  assert.deepEqual(metrics.small, [], 'Information text is below 16 CSS px');
  for (const receipt of metrics.receipts) {
    if (
      (receipt.parent.y >= 0 && receipt.parent.bottom <= metrics.height) ||
      (receipt.bottom > 0 &&
        receipt.y < metrics.height &&
        receipt.right > 0 &&
        receipt.x < metrics.width)
    ) {
      assert(
        receipt.y >= 0 &&
          receipt.bottom <= metrics.height &&
          receipt.x >= 0 &&
          receipt.right <= metrics.width,
        'Saved receipt remains within the viewport when its anchor is visible: ' +
          JSON.stringify(receipt),
      );
      assert(
        receipt.glyphs.every(
          (r) =>
            r.x >= 0 &&
            r.y >= 0 &&
            r.right <= metrics.width &&
            r.bottom <= metrics.height,
        ),
        'Saved receipt text remains fully inside the viewport: ' +
          JSON.stringify(receipt),
      );
    }
  }
  assert(
    metrics.buttons.every((b) => b.w >= 43.9 && b.h >= 43.9),
    'Every visible control retains a 44px target: ' +
      JSON.stringify(metrics.buttons.filter((b) => b.w < 43.9 || b.h < 43.9)),
  );
  assert(
    metrics.buttons.filter((b) => b.major).every((b) => b.font >= 17.9),
    'Primary actions retain 18px text',
  );
  if (!dialogs && metrics.header && metrics.sort) {
    assert(
      Math.abs(
        metrics.header.y +
          metrics.header.h / 2 -
          metrics.sort.y -
          metrics.sort.h / 2,
      ) < 5,
      'Sort shares the hand title row',
    );
    assert(
      metrics.sort.x >= metrics.header.right - 1,
      'Sort does not cover the title',
    );
  }
  for (const scroll of metrics.scrolls) {
    if (
      scroll.scrollHeight <= scroll.clientHeight + 1 &&
      scroll.scrollWidth <= scroll.clientWidth + 1
    )
      assert(
        !scroll.gutter.startsWith('stable'),
        'Short content reserves no stable gutter',
      );
    if (
      scroll.scrollHeight > scroll.clientHeight + 1 ||
      scroll.scrollWidth > scroll.clientWidth + 1
    ) {
      assert.notEqual(
        scroll.color,
        'auto',
        'Scrollable content has explicit themed scrollbar colors',
      );
      assert(
        !/rgb\(255, 255, 255\)/.test(scroll.track),
        'Scrollbar track is not a white slot',
      );
    }
  }
}
async function layout(page, width, height, scenario, names) {
  await page.setViewportSize({ width, height });
  await ready(page, { scenario, names, role: 'player' });
  const metrics = await measurements(page);
  currentMetrics.set(
    width + 'x' + height + ':' + scenario + ':' + names,
    metrics,
  );
  assertGeometry(metrics);
  const positions = await page
    .locator(
      '.uno-toolbar,.uno-turn-bar,.uno-seats--compact,.uno-table,.uno-hand-heading,.uno-hand-scroll',
    )
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return {
          className: node.className,
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
        };
      }),
    );
  await page.evaluate(() => window.saveStatus(true));
  assertGeometry(await measurements(page));
  const saved = await page
    .locator(
      '.uno-toolbar,.uno-turn-bar,.uno-seats--compact,.uno-table,.uno-hand-heading,.uno-hand-scroll',
    )
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return {
          className: node.className,
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
        };
      }),
    );
  assert.deepEqual(
    saved,
    positions,
    'Saved acknowledgement does not move the layout',
  );
  if (scenario === 'dense') {
    const count = await page.locator('.uno-hand-card').count();
    assert(count >= 28);
    const first = page.locator('.uno-hand-card').first(),
      firstId = await first.getAttribute('data-card-id');
    await first.scrollIntoViewIfNeeded();
    await first.click();
    assert.equal(await page.evaluate(() => window.cardClicks.at(-1)), firstId);
    await ready(page, { scenario, names, role: 'player' });
    const last = page.locator('.uno-hand-card').last(),
      lastId = await last.getAttribute('data-card-id');
    await page.locator('.uno-hand-scroll').evaluate((node) => {
      node.scrollLeft = node.scrollWidth;
    });
    await last.scrollIntoViewIfNeeded();
    await last.click();
    assert.equal(await page.evaluate(() => window.cardClicks.at(-1)), lastId);
    assert(
      await page
        .locator('.uno-hand-scroll')
        .evaluate((node) => node.scrollLeft > 0),
      'Dense hand reaches the last card by horizontal scroll',
    );
  }
  await ready(page, { scenario, names, role: 'player' });
  await capture(
    page,
    'current-' + width + 'x' + height + '-' + scenario + '-' + names,
  );
  return metrics;
}

try {
  currentServer = await compile('current', 'games/uno/web/index.tsx');
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  report.environment = {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    browser: browser.version(),
    channel: 'msedge',
    headless: true,
    muted: true,
    listen: '127.0.0.1',
    deviceScaleFactor: 1,
    timezone: 'Asia/Shanghai',
  };
  const context = await browser.newContext({
    viewport: { width: sizes[0][0], height: sizes[0][1] },
    deviceScaleFactor: 1,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
    timezoneId: 'Asia/Shanghai',
  });
  await context.addInitScript(() =>
    localStorage.setItem('tablemax-sound-muted', 'true'),
  );
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) &&
      !['data:', 'blob:'].includes(url.protocol)
    ) {
      report.externalRequests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', (error) => report.errors.push(error.stack));
  await page.goto(currentServer.url);
  await page.waitForFunction(() => typeof window.renderUno === 'function');
  if (enabled('layout'))
    for (const [width, height] of sizes)
      for (const [scenario, names] of [
        ['normal', 'short'],
        ['dense', 'chinese'],
        ['dense', 'latin'],
      ])
        await check(
          'layout:' + width + 'x' + height + ':' + scenario + ':' + names,
          () => layout(page, width, height, scenario, names),
          page,
        );
  if (enabled('dialogs'))
    for (const [width, height] of sizes) {
      await check(
        'dialogs:' + width + 'x' + height,
        async () => {
          await page.setViewportSize({ width, height });
          await ready(page, { scenario: 'normal' });
          await page.getByRole('button', { name: '规则', exact: true }).click();
          await page.locator('.uno-rules').waitFor();
          assertGeometry(await measurements(page, { dialogs: true }), {
            dialogs: true,
          });
          await capture(page, 'rules-' + width + 'x' + height);
          await page.keyboard.press('Escape');
          await page.getByRole('button', { name: '菜单', exact: true }).click();
          assertGeometry(await measurements(page, { dialogs: true }), {
            dialogs: true,
          });
          await page
            .getByRole('button', { name: '游戏设置', exact: true })
            .click();
          await page.locator('.uno-setup-settings').waitFor();
          assertGeometry(await measurements(page, { dialogs: true }), {
            dialogs: true,
          });
          await capture(page, 'settings-' + width + 'x' + height);
          await page.keyboard.press('Escape');
          await page.keyboard.press('Escape');
        },
        page,
      );
    }
  if (enabled('config'))
    for (const [role, status, control] of [
      ['host', 'lobby', true],
      ['player', 'lobby', true],
      ['player', 'lobby', false],
      ['host', 'playing', true],
      ['public', 'lobby', false],
    ])
      await check(
        'config:' + role + ':' + status + ':' + control,
        async () => {
          await page.setViewportSize({ width: 390, height: 844 });
          await ready(page, { box: true, role, status, control });
          await openSettings(page, true);
          const slider = page.getByLabel('抓漏延迟', { exact: true }),
            toggle = page.getByRole('switch', {
              name: '补牌传递',
              exact: true,
            });
          assert.equal(await slider.inputValue(), '500');
          const editable = status === 'lobby' && control;
          assert.equal(await slider.isDisabled(), !editable);
          assert.equal(await toggle.isDisabled(), !editable);
          for (const delayof of [0, 1000, 2000, 5000]) {
            const preset = page.getByRole('button', {
              name: delayof / 1000 + ' 秒',
              exact: true,
            });
            assert.equal(await preset.isDisabled(), !editable);
            if (editable) {
              await preset.click();
              assert.equal(await slider.inputValue(), String(delayof));
            }
          }
          if (editable) {
            await slider.focus();
            await slider.press('Home');
            for (let step = 0; step < 17; step++)
              await slider.press('ArrowRight');
            assert.equal(await slider.inputValue(), '1700');
            await toggle.click();
            await page
              .getByRole('button', { name: '应用开局设置', exact: true })
              .click();
            const snapshot = await page.evaluate(() => window.snapshot());
            assert.deepEqual(snapshot.commands.at(-1).command, {
              type: 'set-game-setup',
              setup: { drawPenaltyStacking: true, catchUnoDelayMs: 1700 },
            });
          } else
            assert.equal(
              (await page.evaluate(() => window.snapshot())).commands.length,
              0,
            );
          assertGeometry(await measurements(page, { dialogs: true }), {
            dialogs: true,
          });
          await capture(
            page,
            'box-settings-' + role + '-' + status + '-' + control,
          );
          return { editable };
        },
        page,
      );
  if (enabled('delay'))
    for (const delayof of [0, 500, 5000])
      await check(
        'delay:' + delayof,
        async () => {
          await ready(page, { scenario: 'catch', delay: delayof, actor: 'c' });
          assertGeometry(await measurements(page));
          const catchButton = page.getByRole('button', {
            name: /质疑漏喊 UNO/,
          });
          assert.equal(
            (await page.evaluate(() => window.snapshot())).catchObservation
              .initialDisabled,
            delayof > 0,
          );
          if (delayof > 0) {
            await page.waitForTimeout(Math.min(150, delayof / 2));
            assert.equal(
              (await page.evaluate(() => window.snapshot())).commands.length,
              0,
            );
          }
          await catchButton.waitFor();
          await page.waitForFunction(
            () => !document.querySelector('.uno-catch-control').disabled,
            null,
            { timeout: 6500 },
          );
          const observation = (await page.evaluate(() => window.snapshot()))
            .catchObservation;
          assert.notEqual(observation.enabledAt, null);
          const elapsed = observation.enabledAt - observation.receivedAt;
          assert(
            elapsed >= delayof,
            'Catch button enabled before the server-projected delay elapsed',
          );
          await catchButton.click();
          assert.equal(
            (await page.evaluate(() => window.snapshot())).commands.at(-1)
              .command.action.type,
            'catch-uno',
          );
          await ready(page, { scenario: 'catch', delay: delayof, actor: 'a' });
          assertGeometry(await measurements(page));
          assert.equal(
            await page
              .getByRole('button', { name: 'UNO!', exact: true })
              .isEnabled(),
            true,
          );
          await page.getByRole('button', { name: 'UNO!', exact: true }).click();
          assert.equal(
            (await page.evaluate(() => window.snapshot())).commands.at(-1)
              .command.action.type,
            'declare-uno',
          );
          await ready(page, { scenario: 'catch', delay: delayof, actor: 'b' });
          assertGeometry(await measurements(page));
          assert((await page.locator('.uno-hand-card--legal').count()) > 0);
          await page.locator('.uno-hand-card--legal').first().click();
          assert.equal(
            (await page.evaluate(() => window.snapshot())).commands.at(-1)
              .command.action.type,
            'play',
          );
          return { delayMs: delayof, elapsedUntilEnabledMs: elapsed };
        },
        page,
      );
  if (enabled('penalty'))
    for (const scenarioof of ['penalty', 'four'])
      await check(
        'penalty:' + scenarioof,
        async () => {
          await ready(page, { scenario: scenarioof, actor: 'c', commit: true });
          const snapshot = await page.evaluate(() => window.snapshot()),
            count = snapshot.view.gameView.drawPenalty.count;
          assert.equal(count, scenarioof === 'penalty' ? 4 : 6);
          assert(
            await page
              .getByRole('button', {
                name: '接受摸 ' + count + ' 张',
                exact: true,
              })
              .isEnabled(),
          );
          if (scenarioof === 'four') {
            assert(
              await page
                .getByRole('button', { name: '质疑 +4', exact: true })
                .isEnabled(),
            );
            assert.equal(
              await page.locator('.uno-hand-card--legal').count(),
              0,
            );
          }
          await capture(page, 'pending-' + scenarioof);
          await page
            .getByRole('button', {
              name: '接受摸 ' + count + ' 张',
              exact: true,
            })
            .click();
          assert.equal(
            (await page.evaluate(() => window.snapshot())).view.gameView
              .drawPenalty,
            null,
          );
        },
        page,
      );
  if (enabled('evidence'))
    await check(
      'evidence:authorized-new-result-and-restore',
      async () => {
        await ready(page, { scenario: 'evidence', actor: 'c' });
        assert.equal(
          await page
            .getByRole('button', { name: '查看你的质疑证据', exact: true })
            .count(),
          0,
        );
        await page.evaluate(() => window.commitEvidence());
        await page.locator('.uno-challenge-result').waitFor();
        assertGeometry(await measurements(page));
        assert(
          (await page.locator('.uno-challenge-result .uno-card').count()) > 0,
        );
        await page.locator('.uno-challenge-result').scrollIntoViewIfNeeded();
        await capture(page, 'challenge-evidence-private');
        await page
          .getByRole('button', { name: '关闭质疑证据', exact: true })
          .click();
        assert.equal(await page.locator('.uno-challenge-result').count(), 0);
        await page.evaluate(() => window.restore());
        assert.equal(await page.locator('.uno-challenge-result').count(), 0);
        for (const roleof of ['host', 'public']) {
          await ready(page, { scenario: 'evidence', role: roleof, actor: 'c' });
          await page.evaluate(() => window.commitEvidence());
          assert.equal(await page.locator('.uno-challenge-result').count(), 0);
          assert.equal(await page.locator('.uno-hand-section').count(), 0);
        }
      },
      page,
    );
  if (enabled('baseline') && report.failures.length + priorFailures < 10) {
    const ref = execFileSync('git', ['rev-parse', 'f719708^{commit}'], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
    const originalPaths = [
      'games/uno/web/index.tsx',
      'games/uno/ui/Hand.tsx',
      'games/uno/ui/style.css',
    ];
    const baselineRoot = join(output, 'baseline-source');
    await mkdir(baselineRoot);
    const replacements = {};
    report.baseline = { ref, files: {} };
    const destinations = Object.fromEntries(
      originalPaths.map((path) => [
        resolve(path).replaceAll('\\', '/'),
        join(baselineRoot, path.split('/').at(-1)).replaceAll('\\', '/'),
      ]),
    );
    for (const path of originalPaths) {
      const original = execFileSync('git', ['show', ref + ':' + path], {
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 2_000_000,
      });
      report.baseline.files[path] = sha(original);
      const destination = destinations[resolve(path).replaceAll('\\', '/')];
      let mapped = original.replace(
        /((?:from\s*|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,
        (_match, prefix, imported, suffix) => {
          let target = resolve(dirname(path), imported);
          if (!/\.[a-z]+$/i.test(target)) {
            for (const extension of ['.tsx', '.ts', '.css'])
              if (existsSync(target + extension)) {
                target += extension;
                break;
              }
          }
          const absolute = target.replaceAll('\\', '/');
          return prefix + (destinations[absolute] ?? absolute) + suffix;
        },
      );
      const originalRequire = createRequire(resolve(path));
      mapped = mapped.replace(
        /((?:from\s*|import\s*)['"])(@tablemax\/[^'"]+)(['"])/g,
        (_match, prefix, imported, suffix) =>
          prefix +
          originalRequire.resolve(imported).replaceAll('\\', '/') +
          suffix,
      );
      if (path.endsWith('.css'))
        mapped = mapped.replace(
          /url\((['"]?)([^)'"\s]+)\1\)/g,
          (match, quote, url) =>
            url.startsWith('.')
              ? 'url(' +
                quote +
                relative(
                  dirname(destination),
                  resolve(dirname(path), url),
                ).replaceAll('\\', '/') +
                quote +
                ')'
              : match,
        );
      await writeFile(destination, mapped);
      replacements[destination] = mapped;
      report.generated['baseline-source/' + path.split('/').at(-1)] =
        sha(mapped);
    }
    baselineServer = await compile(
      'baseline',
      destinations[resolve(originalPaths[0]).replaceAll('\\', '/')],
      replacements,
    );
    const baselineContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
      timezoneId: 'Asia/Shanghai',
    });
    await baselineContext.addInitScript(() =>
      localStorage.setItem('tablemax-sound-muted', 'true'),
    );
    await baselineContext.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) &&
        !['data:', 'blob:'].includes(url.protocol)
      ) {
        report.externalRequests.push(url.href);
        return route.abort();
      }
      return route.continue();
    });
    const baselinePage = await baselineContext.newPage();
    baselinePage.setDefaultTimeout(7000);
    baselinePage.on('pageerror', (error) => report.errors.push(error.stack));
    await baselinePage.goto(baselineServer.url);
    await baselinePage.waitForFunction(
      () => typeof window.renderUno === 'function',
    );
    for (const [width, height] of sizes)
      for (const [scenario, names] of [
        ['normal', 'short'],
        ['dense', 'chinese'],
      ])
        await check(
          'baseline:' + width + 'x' + height + ':' + scenario + ':' + names,
          async () => {
            await baselinePage.setViewportSize({ width, height });
            await ready(baselinePage, { scenario, names, role: 'player' });
            const before = await measurements(baselinePage);
            let after = currentMetrics.get(
              width + 'x' + height + ':' + scenario + ':' + names,
            );
            if (!after) {
              await page.setViewportSize({ width, height });
              await ready(page, { scenario, names, role: 'player' });
              after = await measurements(page);
            }
            const comparison = {
              width,
              height,
              scenario,
              names,
              before: {
                scrollHeight: before.screen.scrollHeight,
                clientHeight: before.screen.clientHeight,
                handTop: before.header?.y,
                actions: before.actionsInViewport,
              },
              after: {
                scrollHeight: after.screen.scrollHeight,
                clientHeight: after.screen.clientHeight,
                handTop: after.header?.y,
                actions: after.actionsInViewport,
              },
              scrollHeightDelta:
                after.screen.scrollHeight - before.screen.scrollHeight,
            };
            report.comparisons.push(comparison);
            await capture(
              baselinePage,
              'baseline-' + width + 'x' + height + '-' + scenario + '-' + names,
            );
            return comparison;
          },
          baselinePage,
        );
    await baselineContext.close();
  }
  report.fixtureFacts = await page.evaluate(() => window.fixtureFacts);
  await context.close();
  assert.deepEqual(report.errors, [], 'No runtime errors');
  assert.deepEqual(report.externalRequests, [], 'No external requests');
  for (const [path, hash] of Object.entries(report.inputs))
    assert.equal(
      sha(await readFile(resolve(path))),
      hash,
      'Input changed during run: ' + path,
    );
  if (enabled('baseline') && report.comparisons.some((c) => c.width <= 621))
    assert(
      report.comparisons.some((c) => c.width <= 621 && c.scrollHeightDelta < 0),
      'Measured source/baseline comparison includes a real reduction',
    );
  report.result = report.failures.length ? 'failed' : 'passed';
  if (report.failures.length) process.exitCode = 1;
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await currentServer?.close();
  await baselineServer?.close();
  const executed = new Set(report.checks.map((check) => check.name));
  for (const name of planned)
    if (!executed.has(name) && !report.unexecuted.includes(name))
      report.unexecuted.push(name);
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.length,
      failures: report.failures,
      unexecuted: report.unexecuted.length,
      error: report.error,
      report: join(output, 'report.json'),
    }),
  );
}
