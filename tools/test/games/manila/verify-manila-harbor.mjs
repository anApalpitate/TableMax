import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';
import { fingerprint as sourceFingerprint } from '../../runner/evidence.mjs';

assertWorkspaceRoot();
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TABLEMAX_TEST_MAINTENANCE = '0';
const option = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const evidence = option('evidence');
assert.match(evidence ?? '', /^[a-z0-9-]{1,65}$/);
const available = [
  'structure',
  'setup',
  'pilot-small',
  'pilot-large',
  'stability',
  'boundary',
  'payment',
  'permissions',
  'guards',
  'rotation',
  'viewport',
  'tie',
  'tail',
  'share',
  'entries',
  'voyage-result',
  'text-flow',
  'lane-heading',
  'surface-polish',
  'visual-semantics',
];
const selected = option('only')?.split(',') ?? available;
assert(selected.every((value) => available.includes(value)));
// Explicit viewports let a content-bound plan include breakpoint neighbours,
// short landscape and keyboard-like heights without changing the defaults.
const requestedSizes = option('viewports')
  ?.split(',')
  .map((value) => {
    assert.match(value, /^\d+x\d+$/);
    return value.split('x').map(Number);
  });
assert(!(requestedSizes && option('widths')), 'Choose widths or viewports');
const widths = requestedSizes?.map(([width]) => width) ??
  option('widths')?.split(',').map(Number) ?? [320, 390, 430];
assert(
  widths.every(
    (value) => Number.isInteger(value) && value >= 320 && value <= 3840,
  ),
);
const suite = option('suite') ?? 'harbor';
assert(['harbor', 'composition'].includes(suite));
const parent = resolve(
  suite === 'composition'
    ? 'artifacts/maintenance/manila-board-composition-20261017/mobile'
    : 'artifacts/maintenance/manila-harbor-rebuild-20261017/mobile',
);
await mkdir(parent, { recursive: true });
const output = join(parent, evidence);
await mkdir(output);
const work = join(output, 'fixture');
await mkdir(work);
const source = await readFile(new URL(import.meta.url));
await writeFile(join(output, 'verifier-source.mjs'), source, { flag: 'wx' });
const file = (name) => JSON.stringify(resolve(name));
await writeFile(
  join(work, 'index.html'),
  '<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  join(work, 'entry.tsx'),
  `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {PlatformGame} from ${file('apps/web/src/session/gameHostAdapter.tsx')};
import {client} from ${file('games/manila/web/index.tsx')};
import {rules} from ${file('games/manila/rules/index.ts')};
import {turnSeat,validateState} from ${file('games/manila/rules/state.ts')};
import {finalScores,resolveWinners} from ${file('games/manila/rules/scoring.ts')};
import ${file('apps/web/src/styles.css')};
import ${file('apps/web/src/scrollbars.css')};
const ids=['A','B','C','D','E'];
const seats=ids.map((id,i)=>({id,name:['阿蓝','小林','港口伙伴','长昵称测试商人','小船长'][i],avatarId:'avatar-'+(i+1),controller:'human',ready:true,online:true,botDifficulty:null}));
const longNames=['这是一位使用二十四个汉字完整昵称的港口商人朋友甲乙','ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0,24),'港务长与海盗伙伴们的完整昵称测试商人甲乙丙丁戊己','MerchantWithoutAnySpaces1','中文商人与ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(name=>name.slice(0,24));
let seed=35719;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const ctx={seats:ids,random:{next:random}}, snapshots={}, origins={};
const required=['auction','share','share-funded','setup','place','board','plunder','pilot-small','pilot-large','round-result','ended'];
for(let run=0;run<32&&required.some(p=>!snapshots[p]);run++){
 let state=rules.initialize(ctx);
 for(let step=0;step<900;step++){
  if(state.phase==='share'&&!snapshots['share-funded']&&rules.legalActions(state,turnSeat(state)).some(a=>a.type==='buy-share')){snapshots['share-funded']=structuredClone(state);origins['share-funded']={kind:'legal-play',run,step,serial:state.serial,voyage:state.voyage};}
  if(required.includes(state.phase)&&!snapshots[state.phase]){snapshots[state.phase]=structuredClone(state);origins[state.phase]={kind:'legal-play',run,step,serial:state.serial,voyage:state.voyage};}
  if(state.phase==='auction'){
   const bidder=turnSeat(state),player=state.players[bidder],maximum=player.cash+player.shares.filter(share=>!share.mortgaged).length*12;
   if(maximum>state.auction.bid&&(!origins['auction-largest']||maximum>origins['auction-largest'].maximum)){snapshots['auction-largest']=structuredClone(state);origins['auction-largest']={kind:'largest-legal-bid-encountered',run,step,maximum};}
  }
  if(state.phase==='ended')break;
  if(state.phase==='round-result'){state=validateState(rules.applyLifecycle(state,{type:'next-voyage'},ctx).state,ids);continue;}
  const actor=turnSeat(state),all=rules.legalActions(state,actor);
  const actions=state.phase==='financing'?all:all.filter(a=>!['mortgage','repay'].includes(a.type));
  let action;
  if(state.phase==='auction')action=random()<0.45?actions[0]:actions[1+Math.floor(random()*(actions.length-1))]??actions[0];
  else if(state.phase==='place'){
   const special=actions.filter(a=>a.type==='place'&&/pirate|pilot/.test(a.space));
   action=special.length&&random()<0.55?special[Math.floor(random()*special.length)]:actions[Math.floor(random()*actions.length)];
  }else action=actions[Math.floor(random()*actions.length)];
  if(!action)throw new Error('No legal fixture action '+state.phase);
  state=validateState(rules.apply(state,action,actor,ctx).state,ids);
 }
}
let obligation=rules.initialize(ctx);
const payer=turnSeat(obligation), maxBid=rules.legalActions(obligation,payer).filter(a=>a.type==='bid').at(-1);
obligation=validateState(rules.apply(obligation,maxBid,payer,ctx).state,ids);
for(let i=0;i<10&&obligation.phase==='auction';i++){
 snapshots['before-payment']=structuredClone(obligation);
 obligation=validateState(rules.apply(obligation,{type:'pass'},turnSeat(obligation),ctx).state,ids);
}
if(obligation.phase!=='financing')throw new Error('Legal auction did not reach financing');
snapshots.financing=obligation;
origins.financing={kind:'legal-max-bid-and-passes',payer,amount:obligation.payment.amount};
const richest=structuredClone(snapshots['auction-largest']),richActor=turnSeat(richest),richBid=rules.legalActions(richest,richActor).filter(action=>action.type==='bid').at(-1);
if(!richBid)throw new Error('Largest-bid fixture has no legal bid');
snapshots['auction-leading']=validateState(rules.apply(richest,richBid,richActor,ctx).state,ids);
origins['auction-leading']={kind:'legal-largest-encountered-bid',amount:richBid.amount};
const tied=structuredClone(snapshots.ended);
const wealth=Math.max(...Object.values(tied.scores))+50;
for(const id of ids){const p=tied.players[id],cash=wealth-p.shares.reduce((n,s)=>n+tied.market[s.cargo]-(s.mortgaged?15:0),0),offset=cash-p.cash;p.cash=cash;for(const finance of new Set([tied.voyageFinance,tied.result?.finance]))if(finance){finance.players[id].openingCash+=offset;finance.players[id].closingCash+=offset;}}
tied.scores=finalScores(tied);tied.winners=resolveWinners(tied.scores,ids);
snapshots.tie=validateState(tied,ids);
origins.tie={kind:'controlled-valid-state',note:'Cash adjusted on legally reached terminal board; not natural tied-game evidence.'};
window.fixtureInfo={available:Object.keys(snapshots),origins,missing:required.filter(p=>!snapshots[p])};
let fullCrew=rules.initialize(ctx);
for(let i=0;i<12&&fullCrew.phase==='auction';i++)fullCrew=validateState(rules.apply(fullCrew,{type:'pass'},turnSeat(fullCrew),ctx).state,ids);
if(fullCrew.phase==='share')fullCrew=validateState(rules.apply(fullCrew,{type:'skip-share'},turnSeat(fullCrew),ctx).state,ids);
if(fullCrew.phase!=='setup')throw new Error('Full-crew fixture failed to reach setup');
const fullSetup=rules.legalActions(fullCrew,turnSeat(fullCrew)).find(a=>a.type==='setup'&&a.cargos.includes('jade')&&a.positions.every(p=>p===3));
fullCrew=validateState(rules.apply(fullCrew,fullSetup,turnSeat(fullCrew),ctx).state,ids);
for(let i=0;i<4;i++){const seat=turnSeat(fullCrew);const action=rules.legalActions(fullCrew,seat).find(a=>a.type==='place'&&a.space.startsWith('cargo-jade-'));if(!action)throw new Error('Full-crew fixture has no legal jade placement');fullCrew=validateState(rules.apply(fullCrew,action,seat,ctx).state,ids);}
snapshots['crew-full']=fullCrew;origins['crew-full']={kind:'legal-passes-setup-and-four-placements',serial:fullCrew.serial};
window.fixtureInfo.available=Object.keys(snapshots);window.fixtureInfo.origins=origins;
const root=createRoot(document.getElementById('root'));
let generation=0,current;
const noop=()=>{};
window.commands=[];window.scrollCalls=[];
const nativeScroll=Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView=function(options){window.scrollCalls.push({id:this.id,className:this.className,options});return nativeScroll.call(this,options);};
const nativeOwnerScroll=Element.prototype.scrollTo;
Element.prototype.scrollTo=function(...args){window.scrollCalls.push({method:'scrollTo',id:this.id,className:this.className,options:args[0]});return nativeOwnerScroll.apply(this,args);};
function info(){const v=current.session.view;return {actor:turnSeat(current.state),seatId:current.seatId,phase:current.state.phase,legal:v.actions,boats:v.gameView.boats,shares:v.gameView.self?.shares??[],result:v.gameView.result,seatOrder:v.gameView.seatOrder,decisionId:v.decisionId,branch:v.branch};}
function paint(){window.fixtureSession=current.session;flushSync(()=>root.render(<PlatformGame key={generation} session={current.session} client={client}/>));return info();}
function sessionFor(state,options={}){
 const actor=turnSeat(state)??ids[0],role=options.role??'player';
 const seatId=options.seatId??(options.waiting?ids.find(id=>id!==actor):actor),ownerSeatId=options.owner?seatId:null;
 const canControl=role==='host'||(role==='player'&&seatId===ownerSeatId);
 const pending=role==='player'?rules.decisions(state).find(p=>p.seatId===seatId):null;
 const projected=rules.project(state,role==='player'?{role:'player',seatId}:{role:'public'});
 const displaySeats=options.longNames?seats.map((seat,index)=>({...seat,name:longNames[index]})):seats;
 // A controlled older projection deliberately lacks a full-voyage ledger.
 if(options.legacy&&projected.result)delete projected.result.finance;
 const view={instanceId:'manila-harbor-fixture',branch:options.branch??0,revision:state.serial,status:state.phase==='ended'?'ended':'playing',paused:false,playMode:'play',gameView:projected,decisionId:pending?.id??null,countdownSeconds:30,decisionClock:null,actions:pending?rules.legalActions(state,seatId):[],lifecycleActions:canControl?rules.lifecycleActions(state):[],seats:displaySeats,history:[],joinOpen:true,ownerSeatId,game:{...rules.manifest,releaseRef:'fixture',minPlayers:3,maxPlayers:5,min:3,max:5},catalog:[],capabilities:{manage:role==='host',control:canControl,manageSeats:canControl},self:{role,seatId:role==='player'?seatId:null},restored:false,selectionToken:null};
 return {role,view,self:role==='player'?displaySeats.find(s=>s.id===seatId):undefined,isHost:role==='host',canControl,canManageSeats:canControl,connected:true,locked:false,busy:false,message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],credential:'fixture',name:'阿蓝',setName:noop,command:c=>window.commands.push(c),join:noop,retry:noop,retryAdmission:noop,setPlayerCredential:noop,publicUrl:'http://127.0.0.1',localUrl:'http://127.0.0.1',admissionAvatarId:null};
}
window.harbor={
 load(options={}){const phase=options.phase??'setup';const state=structuredClone(snapshots[phase]);if(!state)throw new Error('Missing fixture '+phase);current={state,options,seatId:options.seatId??(options.waiting?ids.find(id=>id!==(turnSeat(state)??ids[0])):turnSeat(state)??ids[0]),session:sessionFor(state,options)};window.commands=[];window.scrollCalls=[];generation++;return paint();},
 update(patch={}){const viewPatch=patch.view??{};current.session={...current.session,...patch,view:{...current.session.view,...viewPatch}};return paint();},
 boundary(){current.session={...current.session,view:{...current.session.view,branch:current.session.view.branch+1,revision:current.session.view.revision+1}};return paint();},
 switch(phase){current.state=structuredClone(snapshots[phase]);current.session=sessionFor(current.state,{...current.options,seatId:current.seatId,branch:current.session.view.branch});return paint();},
 // Restore a real previously reached snapshot on a new branch without changing
 // the PlatformGame generation: lifecycle assertions must not pass by remount.
 restore(phase){current.state=validateState(structuredClone(snapshots[phase]),ids);current.session=sessionFor(current.state,{...current.options,seatId:current.seatId,branch:current.session.view.branch+1});return paint();},
 repaint(){current.session={...current.session};return paint();},
 validate(){if(window.commands.length!==1)throw new Error('Expected exactly one command, got '+window.commands.length);const command=window.commands[0];if(command.type==='game'){if(command.decisionId!==current.session.view.decisionId)throw new Error('Stale decision submitted');if(!current.session.view.actions.some(a=>JSON.stringify(a)===JSON.stringify(command.action)))throw new Error('Illegal action submitted');validateState(rules.apply(structuredClone(current.state),command.action,current.seatId,ctx).state,ids);}else if(command.type==='lifecycle'){if(!current.session.canControl)throw new Error('Unauthorized lifecycle');validateState(rules.applyLifecycle(structuredClone(current.state),command.action,ctx).state,ids);}else if(command.type==='replay'){if(!current.session.canControl)throw new Error('Unauthorized replay');}else throw new Error('Unexpected command '+command.type);return command;},
 commit(){const command=this.validate();if(command.type==='game')current.state=validateState(rules.apply(current.state,command.action,current.seatId,ctx).state,ids);else if(command.type==='lifecycle')current.state=validateState(rules.applyLifecycle(current.state,command.action,ctx).state,ids);else throw new Error('Cannot commit '+command.type);current.session=sessionFor(current.state,{...current.options,seatId:current.seatId,branch:current.session.view.branch});window.commands=[];return paint();},
 info,
};
window.harbor.load();
`,
);

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
// The fixture's generated imports are dynamic, so declare their runtime trees
// explicitly, then reuse the runner's static import closure. Re-enumeration
// also detects newly added or removed styles, interaction code and resources.
const inputTrees = [
  'games/manila/ui',
  'games/manila/rules',
  'games/manila/web',
  'games/manila/shared',
  'packages/web-host/src',
  'packages/protocol/src',
  'packages/game-sdk/src',
  'assets/games/manila',
];
const declaredInputs = [
  'pnpm-workspace.yaml',
  'apps/web/package.json',
  'packages/web-host/package.json',
  'packages/protocol/package.json',
  'packages/game-sdk/package.json',
  'apps/web/src/session/gameHostAdapter.tsx',
  'apps/web/src/assets/avatars.ts',
  'apps/web/src/components/SessionFeedback.tsx',
  'apps/web/src/styles.css',
  'apps/web/src/scrollbars.css',
];
const sourceFiles = async (directory) =>
  (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) => {
        const file = directory + '/' + entry.name;
        return entry.isDirectory()
          ? sourceFiles(file)
          : /\.test\.[^.]+$/.test(entry.name)
            ? []
            : [file];
      }),
    )
  ).flat();
let inputBinding;
const fingerprint = async () => {
  const files = [
    ...declaredInputs,
    ...(await Promise.all(inputTrees.map(sourceFiles))).flat(),
    ...(await readdir('assets/platform'))
      .filter((name) => /^avatar-.*\.webp$/.test(name))
      .map((name) => 'assets/platform/' + name),
  ];
  const snapshot = sourceFingerprint(process.cwd(), {
    runtime: 'node',
    script: 'tools/test/games/manila/verify-manila-harbor.mjs',
    args: process.argv.slice(2),
    inputs: { complete: true, files: files.sort() },
  });
  assert.deepEqual(
    snapshot.value.gaps,
    [],
    'Source dependency closure is complete',
  );
  inputBinding = snapshot.value;
  return Object.fromEntries(
    snapshot.value.files.map(({ path, sha256 }) => [path, sha256]),
  );
};
const changedInputs = (before, after) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((file) => before[file] !== after[file])
    .sort();
const report = {
  result: 'running',
  output,
  selected,
  widths,
  requestedSizes,
  verifierSha256: sha(source),
  scope:
    'Actual React Manila through PlatformGame. Legal-play rule projections with controlled transport flags and branch synchronization; tie is explicitly controlled and state-validated. Muted hidden Edge on loopback with Android touch emulation. No real service transport, physical keyboard/phone, OS DPI, installer or natural tied-match acceptance claim.',
  inputsBefore: await fingerprint(),
  inputBindingBefore: inputBinding,
  checks: [],
  metrics: [],
  screenshots: [],
  failures: [],
  unexecuted: [],
  errors: [],
  interactions: 0,
  boundaries: [
    'Fresh fixture loads dispatch the product initial resize; allow its documented 400ms viewport grace to finish (450ms) before establishing an anchor baseline.',
    'Nonzero selection baseline is explicitly positioned in the real owner. If the closed board fits the viewport, the existing action list is opened first to create a user-reachable scroll range; selecting the board closes it normally.',
    'Viewport height reduction models layout resize only; it does not prove physical keyboard/IME behavior.',
    'Retained React click callbacks are used only for stale-event defenses; ordinary game actions use real taps.',
  ],
};
let browser, server;
async function check(name, run, page) {
  if (report.failures.length >= 10) {
    report.unexecuted.push(name);
    return;
  }
  const started = Date.now();
  const tapsBefore = report.interactions;
  try {
    await run();
    report.checks.push({
      name,
      result: 'passed',
      elapsedMs: Date.now() - started,
      realTaps: report.interactions - tapsBefore,
    });
  } catch (error) {
    const failure = { name, error: error.stack };
    report.failures.push(failure);
    report.checks.push({
      name,
      result: 'failed',
      elapsedMs: Date.now() - started,
      realTaps: report.interactions - tapsBefore,
    });
    if (page)
      try {
        const path = join(output, `failure-${report.failures.length}.png`);
        await captureBrowserScreenshot(page, { path, fullPage: false });
        failure.screenshot = path;
      } catch (capture) {
        failure.captureError = capture.message;
      }
  }
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
const sizes =
  requestedSizes ??
  widths.map((width) => [
    width,
    { 320: 568, 390: 844, 430: 932, 844: 390, 932: 430, 1024: 768, 1123: 1428 }[
      width
    ] ?? (width <= 620 ? Math.round(width * 2.16) : 900),
  ]);
assert(
  sizes.every(
    ([, height]) => Number.isInteger(height) && height >= 240 && height <= 3840,
  ),
);
try {
  await build({
    configFile: false,
    root: work,
    plugins: [react()],
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
    logLevel: 'error',
  });
  server = await serveFixture(join(work, 'bundle'));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  for (const [width, height] of sizes) {
    if (!widths.includes(width)) continue;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const cdp = await context.newCDPSession(page);
    page.on('pageerror', (e) =>
      report.errors.push({ width, error: e.message }),
    );
    await page.route('**/api/game-packages/releases/fixture/details', (route) =>
      route.fulfill({
        json: {
          schemaVersion: 1,
          id: 'manila',
          name: '马尼拉',
          description: '港湾商人',
          guidance: false,
        },
      }),
    );
    await page.goto(server.url);
    await page.waitForFunction(() => typeof window.harbor?.load === 'function');
    report.fixtureInfo ??= await page.evaluate(() => window.fixtureInfo);
    const settle = () =>
      page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
        await new Promise((r) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
        );
      });
    const load = async (options) => {
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 1,
      });
      const value = await page.evaluate((o) => {
        window.scrollTo(0, 0);
        return window.harbor.load(o);
      }, options);
      await settle();
      await page.waitForTimeout(450);
      return value;
    };
    const tap = async (locator) => {
      await locator.tap();
      report.interactions++;
      await settle();
    };
    const shot = async (label) => {
      const path = join(output, `${label}-${width}x${height}.png`);
      await captureBrowserScreenshot(page, { path, fullPage: false });
      report.screenshots.push(path);
    };
    const owner = page.locator('.mn-player-scroll');
    const commands = () => page.evaluate(() => window.commands);
    const positionControls = page.locator('.mn-position-controls');
    const positions = () =>
      positionControls.locator('output').allTextContents();
    const arrow = (index, step) =>
      positionControls.nth(index).locator(`button[data-mn-step="${step}"]`);
    const remember = async () =>
      page.evaluate(() => {
        window.identity = {
          scroll: document.querySelector('.mn-player-scroll'),
          board: document.querySelector('.mn-harbor'),
          lane: document.querySelector('.mn-lane'),
          slot: document.querySelector('.mn-lane-control'),
          controls: document.querySelector('#mn-action-area'),
        };
      });
    const identity = () =>
      page.evaluate(() =>
        Object.fromEntries(
          Object.entries(window.identity).map(([key, node]) => [
            key,
            node?.isConnected &&
              node ===
                document.querySelector(
                  {
                    scroll: '.mn-player-scroll',
                    board: '.mn-harbor',
                    lane: '.mn-lane',
                    slot: '.mn-lane-control',
                    controls: '#mn-action-area',
                  }[key],
                ),
          ]),
        ),
      );
    const geometry = async () =>
      page.evaluate(() => {
        const rect = (n) => {
          const b = n.getBoundingClientRect();
          return {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            bottom: b.bottom,
            right: b.right,
          };
        };
        const sc = document.querySelector('.mn-player-scroll'),
          status = document.querySelector('.mn-status'),
          confirm = document.querySelector('.mn-confirm');
        return {
          actualWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          windowScroll: window.scrollY,
          scrollTop: sc.scrollTop,
          scrollHeight: sc.scrollHeight,
          clientHeight: sc.clientHeight,
          scrollOwner: rect(sc),
          status: rect(status),
          statusOutside: !sc.contains(status),
          controlsInBoard: !!document.querySelector(
            '.mn-board-actions #mn-action-area',
          ),
          touch: matchMedia('(pointer: coarse)').matches,
          confirm: confirm && {
            ...rect(confirm),
            position: getComputedStyle(confirm).position,
          },
          slots: [...document.querySelectorAll('.mn-lane-control')].map(rect),
          arrows: [
            ...document.querySelectorAll('.mn-position-controls button'),
          ].map(rect),
          previewCount: document.querySelectorAll('.mn-boat-preview').length,
          scrollContainers: [...document.querySelectorAll('.mn-screen *')]
            .filter(
              (n) =>
                n.checkVisibility() &&
                ['auto', 'scroll'].includes(getComputedStyle(n).overflowY) &&
                n.scrollHeight > n.clientHeight + 1,
            )
            .map((n) => n.className),
        };
      });
    const row = async () => {
      const value = await geometry();
      report.metrics.push({ width, height, ...value });
      return value;
    };
    const tasks = [];
    const run = async (name, body) => {
      if (selected.includes(name)) tasks.push({ name, body });
    };
    await run('visual-semantics', async () => {
      for (const role of ['player', 'host', 'public']) {
        const actualSize =
          role === 'player'
            ? { width, height }
            : { width: Math.max(width, 1280), height: Math.max(height, 720) };
        await page.setViewportSize(actualSize);
        for (const phase of [
          'auction-leading',
          'setup',
          'place',
          'pilot-small',
          'plunder',
          'round-result',
        ]) {
          await load({ phase, role, longNames: true });
          assert.equal(
            await page.locator('.mn-market-panel h2').first().textContent(),
            '股价 · ₱/股',
          );
          assert(
            (await page
              .locator('.mn-market-stock[aria-label^="库存"]')
              .count()) >= 4,
          );
          assert.equal(
            await page
              .locator('.mn-space-price[aria-label^="入驻费用"]')
              .count(),
            await page.locator('.mn-space-price').count(),
            'Every rendered vacant position labels its cost; occupied slots show their owner instead',
          );
          assert(
            (await page
              .locator('.mn-space-earn[aria-label*="赔付风险"]')
              .count()) > 0,
          );
          assert(
            (await page
              .locator('.mn-merchant-assets > [aria-label^="可用伙伴"]')
              .count()) >= 3,
          );
          const collisions = await page
            .locator('.mn-merchant-card')
            .evaluateAll((nodes) =>
              nodes.flatMap((node) => {
                const name = node
                  .querySelector('.mn-merchant-name')
                  .getBoundingClientRect();
                const tags = node
                  .querySelector('.mn-merchant-tags')
                  .getBoundingClientRect();
                if (!name.width || !name.height || !tags.width || !tags.height)
                  return [];
                const overlap =
                  Math.min(name.right, tags.right) -
                    Math.max(name.left, tags.left) >
                    1 &&
                  Math.min(name.bottom, tags.bottom) -
                    Math.max(name.top, tags.top) >
                    1;
                return overlap ? [node.textContent] : [];
              }),
            );
          assert.deepEqual(
            collisions,
            [],
            'Merchant names and role badges occupy separate rows',
          );
          const lost = await page
            .locator(
              '.mn-lane[data-mn-lane-state="plundered"],.mn-lane[data-mn-lane-state="docked"]',
            )
            .evaluateAll((nodes) =>
              nodes.map((node) => ({
                state: node.dataset.mnLaneState,
                text: node.textContent,
              })),
            );
          report.metrics.push({
            width,
            height,
            kind: 'visual-semantics',
            role,
            phase,
            actualSize,
            lost,
          });
          if (phase === 'auction-leading') {
            assert.match(
              await page.locator('.mn-leading-player').textContent(),
              /^领先：/,
            );
            assert.doesNotMatch(
              await page
                .locator('#mn-action-area h2')
                .textContent()
                .catch(() => ''),
              /等待其他商人/,
            );
            const leading = await page
              .locator('.mn-leading-player')
              .evaluate((node) => {
                const box = node.getBoundingClientRect();
                const header = node
                  .closest('.mn-status')
                  .getBoundingClientRect();
                return {
                  top: box.top,
                  bottom: box.bottom,
                  headerTop: header.top,
                  headerBottom: header.bottom,
                };
              });
            assert(
              leading.top >= leading.headerTop - 1 &&
                leading.bottom <= leading.headerBottom + 1,
              'Long leading-merchant name stays inside the phase panel',
            );
          }
          if (phase === 'round-result') {
            assert.equal(
              await page.locator('.mn-tag--active,.mn-seat-active').count(),
              0,
              'Settled voyages do not label the last actor as still acting',
            );
            const amounts = await page
              .locator('.mn-result-merchant')
              .first()
              .evaluate((node) => {
                const body = node
                  .closest('.mn-result-body')
                  .getBoundingClientRect();
                return [
                  ...node.querySelectorAll('summary .mn-result-amount b'),
                ].map((amount) => {
                  const box = amount.getBoundingClientRect();
                  return {
                    text: amount.textContent,
                    top: box.top,
                    bottom: box.bottom,
                    bodyTop: body.top,
                    bodyBottom: body.bottom,
                  };
                });
              });
            assert(amounts.length >= 1);
            for (const amount of amounts)
              assert(
                amount.top >= amount.bodyTop - 1 &&
                  amount.bottom <= amount.bodyBottom + 1,
                `${role}: first merchant's complete financial summary is visible before scrolling`,
              );
          }
          if (
            role === 'player' &&
            ['setup', 'place', 'pilot-small'].includes(phase)
          ) {
            const jump = page.getByRole('button', { name: '定位到本人操作区' });
            await jump.click();
            const position = await page.evaluate(() => {
              const owner = document
                .querySelector('.mn-player-scroll')
                .getBoundingClientRect();
              const action = document
                .querySelector('#mn-action-area')
                .getBoundingClientRect();
              return {
                windowScroll: scrollY,
                actionTop: action.top,
                ownerTop: owner.top,
                ownerBottom: owner.bottom,
              };
            });
            assert.equal(position.windowScroll, 0);
            assert(
              position.actionTop >= position.ownerTop - 1 &&
                position.actionTop < position.ownerBottom - 44,
              'Phase shortcut exposes the real action area in the existing scroll owner',
            );
          }
          if (role === 'player' || width === 1280)
            await shot(`semantics-${role}-${phase}`);
        }
      }
      await page.setViewportSize({ width, height });
    });
    await run('lane-heading', async () => {
      await load({ phase: 'auction' });
      const labels = await page
        .locator('.mn-lane-heading > strong')
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            const text = range.getBoundingClientRect();
            const box = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return {
              text: node.textContent,
              width: box.width,
              textWidth: text.width,
              padding:
                parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
              parentWidth: node.parentElement.getBoundingClientRect().width,
              centreDelta: Math.abs(
                (box.left + box.right) / 2 -
                  (() => {
                    const parent = node.parentElement.getBoundingClientRect();
                    return (parent.left + parent.right) / 2;
                  })(),
              ),
              fontSize: parseFloat(style.fontSize),
            };
          }),
        );
      assert.equal(labels.length, 3, 'Every empty lane exposes its title');
      for (const label of labels) {
        assert(label.textWidth > 0);
        assert(label.fontSize >= 16, 'Keep the readable title size');
        assert(label.centreDelta <= 1, 'Empty lane title is centred');
        assert(
          label.width <= label.parentWidth + 1,
          'Title stays inside its lane',
        );
        assert(
          Math.abs(label.width - label.textWidth - label.padding) <= 1,
          'Title background hugs the text instead of stretching across the lane',
        );
      }
      report.metrics.push({ width, height, kind: 'lane-heading', labels });
      await shot('lane-heading');
    });
    await run('surface-polish', async () => {
      const tightLabels = [];
      const scan = async (role, phase) => {
        const labels = await page.evaluate(() => {
          const found = [];
          for (const node of document.querySelectorAll('.mn-theme *')) {
            const style = getComputedStyle(node);
            const box = node.getBoundingClientRect();
            if (!box.width || !box.height || style.visibility === 'hidden')
              continue;
            if (
              style.backgroundColor === 'rgba(0, 0, 0, 0)' ||
              style.backgroundColor === 'transparent'
            )
              continue;
            const texts = [...node.childNodes].filter(
              (child) =>
                child.nodeType === Node.TEXT_NODE && child.textContent.trim(),
            );
            if (!texts.length) continue;
            for (const child of texts) {
              const range = document.createRange();
              range.selectNodeContents(child);
              const text = range.getBoundingClientRect();
              if (!text.width) continue;
              const left = text.left - box.left;
              const right = box.right - text.right;
              if (left < 4 || right < 4)
                found.push({
                  className: node.className,
                  text: child.textContent.trim(),
                  left,
                  right,
                });
            }
          }
          return found;
        });
        tightLabels.push(...labels.map((label) => ({ role, phase, ...label })));
      };
      for (const role of ['player', 'host', 'public']) {
        // Host and public are desktop surfaces. Keep their audit at a desktop
        // viewport rather than treating a 390px phone as a supported host.
        await page.setViewportSize(
          role !== 'player' && width < 1280
            ? { width: 1280, height: 720 }
            : { width, height },
        );
        await load({ phase: 'auction', role });
        const tools = await page
          .locator('.mn-toolbar-tools > button')
          .evaluateAll((nodes) =>
            nodes.map((node) => {
              const box = node.getBoundingClientRect();
              return {
                label: node.getAttribute('aria-label'),
                width: box.width,
                height: box.height,
              };
            }),
          );
        assert.equal(tools.length, 4);
        for (const button of tools) {
          assert.equal(button.width, 44, `${role}: toolbar button width`);
          assert.equal(button.height, 44, `${role}: toolbar button height`);
        }
        await scan(role, 'auction');
        await page.getByRole('button', { name: '菜单', exact: true }).click();
        const heading = await page
          .locator('.mn-overlay > .panel-heading')
          .evaluate((node) => {
            const box = node.getBoundingClientRect();
            const text = node.querySelector('h2').getBoundingClientRect();
            return {
              left: text.left - box.left,
              right: box.right - text.right,
            };
          });
        assert(heading.left >= 12, 'Menu heading has a clear left inset');
        await shot(`surface-menu-${role}`);
        await page.locator('.mn-overlay > .panel-heading > button').click();
        await load({ phase: 'setup', role });
        await scan(role, 'setup');
        if (role === 'player') {
          const fields = await page
            .locator('.mn-lane-cargo-select select')
            .evaluateAll((nodes) =>
              nodes.map((node) => {
                const style = getComputedStyle(node);
                const box = node.getBoundingClientRect();
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                context.font = `${style.fontSize} ${style.fontFamily}`;
                return {
                  height: box.height,
                  padding: parseFloat(style.paddingLeft),
                  radius: parseFloat(style.borderRadius),
                  appearance: style.appearance,
                  textWidth: context.measureText(node.selectedOptions[0].text)
                    .width,
                  contentWidth:
                    box.width -
                    parseFloat(style.paddingLeft) -
                    parseFloat(style.paddingRight) -
                    parseFloat(style.borderLeftWidth) -
                    parseFloat(style.borderRightWidth),
                };
              }),
            );
          assert.equal(fields.length, 3);
          for (const field of fields) {
            assert(
              field.height >= 44 &&
                field.padding >= (width <= 389 ? 4 : 10) &&
                field.radius >= 7,
            );
            assert.equal(field.appearance, 'none');
            assert(
              field.textWidth <= field.contentWidth + 1,
              'Full cargo name fits the closed select',
            );
          }
          await page
            .locator('.mn-lane-cargo-select')
            .first()
            .scrollIntoViewIfNeeded();
          await shot('surface-loading');
        }
        await load({ phase: 'place', role });
        await scan(role, 'place');
      }
      report.metrics.push({
        width,
        height,
        kind: 'surface-spacing-audit',
        tightLabels,
      });
      await page.setViewportSize({ width, height });
      assert.deepEqual(
        tightLabels,
        [],
        'Solid text labels have at least 4px side breathing room',
      );
    });
    await run('structure', async () => {
      await load({ phase: 'setup' });
      const data = await row();
      assert.equal(data.actualWidth, width);
      assert(data.scrollWidth <= width + 1, 'No horizontal root overflow');
      assert(data.touch);
      assert(data.statusOutside);
      assert(data.controlsInBoard);
      assert.equal(data.windowScroll, 0);
      assert.deepEqual(
        data.scrollContainers,
        ['mn-player-scroll'],
        'Only the outer player owner scrolls',
      );
      assert.equal(data.slots.length, 3);
      for (const slot of data.slots)
        assert(
          slot.height >= 44,
          'Lane control slot is occupied at least 44px',
        );
      assert(
        data.confirm &&
          !['fixed', 'absolute', 'sticky'].includes(data.confirm.position),
        'Confirmation remains in normal flow',
      );
      assert.equal(data.previewCount, 0);
      const loadingLabels = await page
        .locator('.mn-lane-cargo-select > span')
        .evaluateAll((ns) =>
          ns.map((n) => {
            const b = n.getBoundingClientRect();
            const image = n
              .closest('.mn-lane')
              .querySelector('.mn-boat img')
              .getBoundingClientRect();
            return {
              text: n.textContent,
              label: { y: b.y, bottom: b.bottom },
              boat: { y: image.y, bottom: image.bottom },
            };
          }),
        );
      report.metrics.push({
        width,
        kind: 'loading-label-layout',
        loadingLabels,
      });
      assert.deepEqual(
        loadingLabels.map((n) => n.text),
        ['装货', '装货', '装货'],
        'Each lane has one clear loading label',
      );
      for (const lane of loadingLabels)
        assert(
          lane.boat.bottom <= lane.label.y - 4,
          'Loading label has at least four actual image-bbox pixels of separation from the ship',
        );
      assert.equal(
        await page.locator('.mn-boat-cargo-target > span').count(),
        0,
        'No duplicate floating boat loading hint',
      );
      await shot('setup-top');
    });
    for (const phase of ['setup', 'pilot-small', 'pilot-large'])
      await run(phase, async () => {
        await load({ phase });
        if (phase === 'setup')
          await tap(
            page.getByRole('button', { name: '下一步：设起点', exact: true }),
          );
        assert((await positionControls.count()) > 0);
        const initial = await positions();
        const slotBefore = await page
          .locator('.mn-lane-control')
          .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().height));
        for (let i = 0; i < 10; i++) {
          const forward = arrow(0, 1);
          const back = arrow(0, -1);
          if (await forward.isEnabled()) {
            await tap(forward);
            if (i === 0) {
              const readout = (await positions())[0];
              const expected = readout.includes('靠港')
                ? 100
                : (Number(readout.match(/(\d+)格/)?.[1]) / 13) * 100;
              const actual = await page
                .locator('.mn-lane:has(.mn-position-controls) .mn-boat')
                .first()
                .evaluate((n) =>
                  parseFloat(n.style.getPropertyValue('--boat-position')),
                );
              assert(
                Math.abs(actual - expected) < 0.001,
                'The real boat renders the draft position',
              );
              report.metrics.push({
                width,
                phase,
                kind: 'draft-boat-position',
                readout,
                expected,
                actual,
              });
            }
            await tap(back);
          } else {
            await tap(back);
            await tap(forward);
          }
        }
        assert.deepEqual(
          await positions(),
          initial,
          'Twenty real arrow taps return to initial draft',
        );
        assert.equal((await commands()).length, 0);
        const data = await row();
        for (const rect of data.arrows)
          assert(
            rect.width >= 44 && rect.height >= 44,
            'Arrow hit area is at least 44px',
          );
        assert.deepEqual(
          await page
            .locator('.mn-lane-control')
            .evaluateAll((ns) =>
              ns.map((n) => n.getBoundingClientRect().height),
            ),
          slotBefore,
        );
        if (phase === 'setup') {
          for (let i = 0; i < 3; i++) await tap(arrow(0, -1));
          assert(await arrow(0, -1).isDisabled());
          for (let i = 0; i < 5; i++) await tap(arrow(0, 1));
          assert(await arrow(0, 1).isDisabled());
          assert(
            await page.locator('[data-manila-action="setup"]').isDisabled(),
            'Non-nine total cannot submit',
          );
          await tap(arrow(0, -1));
          await tap(arrow(0, -1));
        } else {
          const budget = phase === 'pilot-small' ? 1 : 2;
          for (let i = 0; i < budget; i++) await tap(arrow(0, 1));
          assert(await arrow(0, 1).isDisabled(), 'Budget caps movement');
          for (let i = 1; i < (await positionControls.count()); i++)
            assert(await arrow(i, 1).isDisabled());
          await tap(
            page.getByRole('button', { name: '清空调整', exact: true }),
          );
          assert.deepEqual(await positions(), initial);
        }
        await shot(`${phase}-actions`);
        await tap(
          page.locator(
            `[data-manila-action="${phase === 'setup' ? 'setup' : 'pilot'}"]`,
          ),
        );
        const command = await page.evaluate(() => window.harbor.validate());
        report.metrics.push({ width, phase, command });
      });
    await run('stability', async () => {
      await load({ phase: 'setup' });
      const slotsAtCargo = await page
        .locator('.mn-lane-control')
        .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().height));
      await tap(
        page.getByRole('button', { name: '下一步：设起点', exact: true }),
      );
      const slotsAtPosition = await page
        .locator('.mn-lane-control')
        .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().height));
      report.metrics.push({
        width,
        kind: 'lane-slot-stage-stability',
        slotsAtCargo,
        slotsAtPosition,
      });
      assert.deepEqual(
        slotsAtPosition,
        slotsAtCargo,
        'Lane control slot height remains stable between cargo and position steps',
      );
      await arrow(0, 1).scrollIntoViewIfNeeded();
      const scrollBaseline = await owner.evaluate((n) => ({
        scrollTop: n.scrollTop,
        maximum: n.scrollHeight - n.clientHeight,
      }));
      assert(
        scrollBaseline.maximum > 0,
        'The real scroll owner has reachable content',
      );
      if (scrollBaseline.scrollTop === 0) {
        // Landscape can already show the first arrow. Establish a real positive
        // offset without moving that arrow outside the owner's visible bounds.
        const visibleArrow = await arrow(0, 1).boundingBox();
        const visibleOwner = await owner.boundingBox();
        const offset = Math.min(
          48,
          scrollBaseline.maximum,
          visibleArrow.y - visibleOwner.y - 2,
        );
        assert(
          offset >= 1,
          'A visible first arrow permits a nonzero scroll baseline',
        );
        await owner.evaluate((n, value) => {
          n.scrollTop = value;
        }, offset);
        await settle();
      }
      assert(
        (await owner.evaluate((n) => n.scrollTop)) > 0,
        'Arrow stability starts at nonzero owner scroll',
      );
      const box = await arrow(0, 1).boundingBox();
      const arrowOwnerBounds = await owner.boundingBox();
      assert(
        box.y >= arrowOwnerBounds.y - 1 &&
          box.y + box.height <=
            arrowOwnerBounds.y + arrowOwnerBounds.height + 1,
        'The entire arrow remains visible at the nonzero baseline',
      );
      report.metrics.push({
        width,
        kind: 'arrow-nonzero-baseline',
        before: scrollBaseline,
        scrollTop: await owner.evaluate((n) => n.scrollTop),
        arrow: box,
        owner: arrowOwnerBounds,
      });
      const laneBox = await page.locator('.mn-lane').first().boundingBox();
      await tap(arrow(0, 1));
      const after = await arrow(0, 1).boundingBox();
      const laneAfter = await page.locator('.mn-lane').first().boundingBox();
      report.metrics.push({
        width,
        kind: 'arrow-screen-stability',
        before: box,
        after,
        laneBox,
        laneAfter,
      });
      assert(
        Math.abs(after.y - box.y) <= 1 &&
          Math.abs(laneAfter.y - laneBox.y) <= 1,
        'Arrow and lane remain at screen coordinates',
      );
      await load({ phase: 'place' });
      const target = page
        .locator('.mn-specialist-slots .mn-space--legal')
        .last();
      if ((await owner.evaluate((n) => n.scrollHeight - n.clientHeight)) < 1)
        await tap(page.locator('.mn-alternatives > summary').first());
      await target.scrollIntoViewIfNeeded();
      await owner.evaluate((n) => {
        if (n.scrollTop < 1)
          n.scrollTop = Math.min(48, n.scrollHeight - n.clientHeight);
      });
      await settle();
      assert(
        (await owner.evaluate((n) => n.scrollTop)) > 0,
        'Selection starts at nonzero owner scroll',
      );
      const before = await target.boundingBox();
      const ownerBounds = await owner.boundingBox();
      assert(
        before.y >= ownerBounds.y - 1 &&
          before.y + before.height <= ownerBounds.y + ownerBounds.height + 1,
        'The nonzero baseline keeps the entire selected target visible before the real tap',
      );
      await tap(target);
      const selectedBox = await target.boundingBox();
      report.metrics.push({
        width,
        kind: 'selected-target-stability',
        before,
        after: selectedBox,
      });
      assert(
        Math.abs(selectedBox.y - before.y) <= 1,
        'Selecting does not shift target',
      );
      const openListClose = page.locator('.mn-alternatives[open] .mn-close');
      if (await openListClose.count()) await tap(openListClose.first());
      const cancel = page.getByRole('button', { name: '取消', exact: true });
      await cancel.scrollIntoViewIfNeeded();
      await settle();
      const cancelBefore = await target.boundingBox();
      await shot('place-selected-confirm');
      const scrollBeforeCancel = await owner.evaluate((n) => ({
        scrollTop: n.scrollTop,
        maximum: n.scrollHeight - n.clientHeight,
      }));
      await tap(cancel);
      const cancelAfter = await target.boundingBox();
      const scrollAfterCancel = await owner.evaluate((n) => ({
        scrollTop: n.scrollTop,
        maximum: n.scrollHeight - n.clientHeight,
      }));
      report.metrics.push({
        width,
        kind: 'cancel-screen-stability',
        before: cancelBefore,
        after: cancelAfter,
        scrollBeforeCancel,
        scrollAfterCancel,
      });
      assert(
        Math.abs(cancelBefore.y - cancelAfter.y) <= 1,
        'Cancelling preserves board target',
      );
      report.metrics.push({
        width,
        selectionDelta: selectedBox.y - before.y,
        cancelDelta: cancelAfter.y - cancelBefore.y,
        arrowDelta: after.y - box.y,
      });
      await shot('stability');
      const tailBeforeScroll = await owner.evaluate(
        (n) =>
          Number.parseFloat(n.style.getPropertyValue('--mn-anchor-tail')) || 0,
      );
      if (width >= 621 && height <= 600)
        assert(
          tailBeforeScroll > 0,
          'Bottom-clamped landscape cancellation repairs the measured scroll deficit',
        );
      if (tailBeforeScroll > 0) {
        const bounds = await owner.boundingBox();
        await page.mouse.move(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        );
        await page.mouse.wheel(0, -80);
        await settle();
        const tailAfterScroll = await owner.evaluate(
          (n) =>
            Number.parseFloat(n.style.getPropertyValue('--mn-anchor-tail')) ||
            0,
        );
        report.metrics.push({
          width,
          kind: 'anchor-tail-user-scroll-cleanup',
          tailBeforeScroll,
          tailAfterScroll,
        });
        assert.equal(
          tailAfterScroll,
          0,
          'The next real wheel gesture removes the temporary scroll repair',
        );
      }
    });
    await run('boundary', async () => {
      await load({ phase: 'setup' });
      await tap(
        page.getByRole('button', { name: '下一步：设起点', exact: true }),
      );
      await tap(arrow(0, 1));
      await tap(page.locator('.mn-alternatives > summary').first());
      await remember();
      await page.evaluate(() => window.harbor.boundary());
      await settle();
      assert(
        Object.values(await identity()).every(Boolean),
        'Decision boundary keeps DOM identities',
      );
      assert.equal(await positionControls.count(), 0, 'Setup step resets');
      assert.equal(
        await page.locator('.mn-alternatives[open]').count(),
        0,
        'Boundary closes temporary action lists',
      );
      await load({ phase: 'auction' });
      const input = page.locator('#mn-bid-amount');
      const min = await input.getAttribute('min');
      await input.fill(String(Number(min) + 3));
      await remember();
      await page.locator('[data-manila-action="bid"]').evaluate((n) => {
        window.retainedClick = Object.entries(n).find(([key]) =>
          key.startsWith('__reactProps$'),
        )[1].onClick;
        window.retainedInput =
          n.parentElement.querySelector('input') ??
          document.querySelector('#mn-bid-amount');
      });
      await page.evaluate(() => window.harbor.boundary());
      await settle();
      assert.equal(
        await input.inputValue(),
        min,
        'Boundary resets bid to legal minimum',
      );
      assert(
        await page.evaluate(
          () =>
            document.querySelector('#mn-bid-amount') === window.retainedInput &&
            document.activeElement === window.retainedInput,
        ),
        'Boundary preserves the bid input node and its focus',
      );
      assert(Object.values(await identity()).every(Boolean));
      await page.evaluate(() => window.retainedClick({}));
      assert.equal(
        (await commands()).length,
        0,
        'Old-boundary callback cannot submit',
      );
      await page.locator('[data-manila-action="bid"]').evaluate((n) => {
        window.retainedClick = Object.entries(n).find(([key]) =>
          key.startsWith('__reactProps$'),
        )[1].onClick;
      });
      await page.evaluate(() =>
        window.harbor.update({ view: { actions: [] } }),
      );
      await page.evaluate(() => window.retainedClick({}));
      assert.equal(
        (await commands()).length,
        0,
        'Same-boundary removed action cannot submit',
      );
      assert.equal(await page.locator('.mn-controls--waiting').count(), 1);
    });
    await run('payment', async () => {
      await load({ phase: 'before-payment', seatId: 'A' });
      await owner.evaluate((n) => {
        n.scrollTop = Math.min(80, n.scrollHeight - n.clientHeight);
      });
      await settle();
      const before = await owner.evaluate((n) => n.scrollTop);
      const boardBefore = await page
        .locator('[data-mn-space="port-0"]')
        .boundingBox();
      await page.evaluate(() => {
        window.scrollCalls = [];
        window.harbor.switch('financing');
      });
      await settle();
      assert.equal(
        (await page.evaluate(() => window.scrollCalls)).length,
        0,
        'Payment transition never calls scrollIntoView',
      );
      const boardAfter = await page
        .locator('[data-mn-space="port-0"]')
        .boundingBox();
      const afterTransition = await geometry();
      report.metrics.push({
        width,
        kind: 'payment-transition-position',
        scrollBefore: before,
        scrollAfter: afterTransition.scrollTop,
        boardBefore,
        boardAfter,
        ...afterTransition,
      });
      assert(
        Math.abs(boardAfter.y - boardBefore.y) <= 1,
        'Payment leaves the existing board target at the same screen position; owner scroll may compensate for phase-strip height',
      );
      const go = page.locator('.mn-payment-link');
      assert.equal(await go.count(), 1);
      await tap(go);
      await page.waitForFunction(() => {
        const n = document.querySelector('#mn-action-area'),
          s = document.querySelector('.mn-player-scroll'),
          b = n.getBoundingClientRect(),
          r = s.getBoundingClientRect();
        return b.top >= r.top - 1 && b.top < r.bottom - 44;
      });
      await page.evaluate(async () => {
        const sc = document.querySelector('.mn-player-scroll');
        let previous = sc.scrollTop,
          stable = 0;
        const deadline = performance.now() + 1800;
        while (performance.now() < deadline) {
          await new Promise((r) => requestAnimationFrame(r));
          const next = sc.scrollTop;
          stable = Math.abs(next - previous) < 0.1 ? stable + 1 : 0;
          previous = next;
          if (stable >= 4) return;
        }
        throw new Error(
          'Explicit payment scroll did not settle within its bound',
        );
      });
      const calls = await page.evaluate(() => window.scrollCalls);
      assert(
        calls.some(
          (c) => c.method === 'scrollTo' && c.className === 'mn-player-scroll',
        ),
        'Explicit CTA scrolls only the player owner',
      );
      const afterGo = await geometry();
      report.metrics.push({
        width,
        kind: 'payment-go-viewport',
        ...afterGo,
        calls,
      });
      assert.equal(
        afterGo.windowScroll,
        0,
        'Payment CTA must not scroll the document',
      );
      assert(
        afterGo.status.y >= 0 && afterGo.status.bottom <= height,
        'Fixed phase strip remains completely inside the actual viewport',
      );
      assert(
        afterGo.scrollOwner.y >= afterGo.status.bottom &&
          afterGo.scrollOwner.bottom <= height + 1 &&
          afterGo.scrollOwner.bottom >= height - 12,
        'The player owner stays visible through the viewport bottom',
      );
      const cards = page.locator('[data-mn-finance-share]');
      assert.equal(await cards.count(), 2);
      let firstCard = await cards.first().boundingBox();
      if (
        width !== 320 &&
        (firstCard.y < afterGo.scrollOwner.y - 1 ||
          firstCard.y + firstCard.height > afterGo.scrollOwner.bottom + 1)
      ) {
        await cards.first().evaluate((card) => {
          const sc = card.closest('.mn-player-scroll');
          const box = card.getBoundingClientRect(),
            bounds = sc.getBoundingClientRect();
          // Verify reachability at the minimum owner-only offset. Gesture
          // cancellation and real touch scrolling are checked by the tail case.
          const adjustment =
            box.top < bounds.top + 8
              ? box.top - bounds.top - 8
              : Math.max(0, box.bottom - bounds.bottom + 8);
          sc.scrollTo({
            top: sc.scrollTop + adjustment,
            behavior: 'instant',
          });
        });
        await settle();
        firstCard = await cards.first().boundingBox();
        report.metrics.push({
          width,
          kind: 'owner-collateral-target-alignment',
          firstCard,
          scope:
            'Reachability is measured at a minimum bbox-derived owner offset before a real card tap; this is not an inertial-gesture acceptance claim. The direct full-first-card guarantee applies to 320px portrait.',
        });
      }
      assert(
        firstCard.y >= afterGo.scrollOwner.y - 1 &&
          firstCard.y + firstCard.height <= afterGo.scrollOwner.bottom + 1,
        'First collateral is fully reachable inside the owner; 320px shows it directly after Go',
      );
      await shot('payment-options');
      await cards.evaluateAll((ns) => {
        window.financeCards = Object.fromEntries(
          ns.map((n) => [n.dataset.mnFinanceShare, n]),
        );
      });
      await tap(
        page
          .locator('.mn-finance-choice[data-manila-action="mortgage"]')
          .first(),
      );
      const boxesBefore = await cards.evaluateAll((ns) =>
        ns.map((n) => {
          const r = n.getBoundingClientRect();
          return { id: n.dataset.mnFinanceShare, y: r.y, height: r.height };
        }),
      );
      const transition = await page.evaluate(() => window.harbor.commit());
      await settle();
      assert.equal(
        transition.phase,
        'financing',
        'One mortgage leaves a second collateral choice',
      );
      const stable = await cards.evaluateAll((ns) =>
        ns.every((n) => window.financeCards[n.dataset.mnFinanceShare] === n),
      );
      assert(stable, 'Mortgage retains both card nodes and order');
      const boxesAfter = await cards.evaluateAll((ns) =>
        ns.map((n) => {
          const r = n.getBoundingClientRect();
          return { id: n.dataset.mnFinanceShare, y: r.y, height: r.height };
        }),
      );
      report.metrics.push({
        width,
        kind: 'mortgage-card-stability',
        boxesBefore,
        boxesAfter,
      });
      assert.deepEqual(
        boxesAfter.map((n) => n.id),
        boxesBefore.map((n) => n.id),
      );
      for (let index = 0; index < boxesBefore.length; index++)
        assert(
          Math.abs(boxesAfter[index].y - boxesBefore[index].y) <= 1 &&
            Math.abs(boxesAfter[index].height - boxesBefore[index].height) <= 1,
          'Mortgage preserves card screen position and height',
        );
      assert.equal(await cards.count(), 2);
      assert.equal(await cards.filter({ hasText: '已抵押' }).count(), 1);
      assert.equal(
        await page
          .locator('.mn-finance-choice[data-manila-action="mortgage"]')
          .count(),
        1,
      );
      await shot('payment-after-one');
      await load({ phase: 'financing', waiting: true });
      assert.equal(
        await page
          .locator('.mn-financing-notice,.mn-finance--payment,.mn-payment-link')
          .count(),
        0,
        'Other player sees no debtor-specific options',
      );
    });
    await run('voyage-result', async () => {
      const sum = (values) =>
        Object.values(values).reduce((total, value) => total + value, 0);
      const resultGeometry = async (role, phase) => {
        const metrics = await page.evaluate(() => {
          const root = document.querySelector('.mn-screen');
          const visible = (node) =>
            node &&
            node.checkVisibility() &&
            node.getBoundingClientRect().width > 0 &&
            node.getBoundingClientRect().height > 0;
          const rect = (node) => {
            const box = node.getBoundingClientRect();
            return {
              left: box.left,
              top: box.top,
              right: box.right,
              bottom: box.bottom,
              width: box.width,
              height: box.height,
            };
          };
          const clippedRect = (node) => {
            const box = rect(node);
            for (
              let parent = node.parentElement;
              parent && root.contains(parent);
              parent = parent.parentElement
            ) {
              const style = getComputedStyle(parent),
                outer = rect(parent);
              if (style.overflowX !== 'visible') {
                box.left = Math.max(box.left, outer.left);
                box.right = Math.min(box.right, outer.right);
              }
              if (style.overflowY !== 'visible') {
                box.top = Math.max(box.top, outer.top);
                box.bottom = Math.min(box.bottom, outer.bottom);
              }
            }
            return box;
          };
          const overlaps = (a, b) =>
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
          const collisions = [],
            groups = [];
          const group = (name, selectors) => {
            const nodes = selectors
              .flatMap((selector) => [...root.querySelectorAll(selector)])
              .filter(visible);
            const boxes = nodes.map((node) => ({
              label: node.className,
              box: clippedRect(node),
            }));
            groups.push({ name, boxes });
            for (let a = 0; a < boxes.length; a++)
              for (let b = a + 1; b < boxes.length; b++) {
                if (nodes[a].contains(nodes[b]) || nodes[b].contains(nodes[a]))
                  continue;
                if (overlaps(boxes[a].box, boxes[b].box))
                  collisions.push({ group: name, a: boxes[a], b: boxes[b] });
              }
            return nodes.length;
          };
          const portrait =
            root.classList.contains('mn-screen--player') && innerWidth <= 620;
          const majorCount = group(
            'board regions',
            portrait
              ? [
                  '.mn-shore > .mn-docks',
                  '.mn-shore > .mn-specialists',
                  '.mn-harbor > .mn-lanes',
                ]
              : [
                  '.mn-harbor > .mn-shore',
                  '.mn-harbor > .mn-board-market',
                  '.mn-harbor > .mn-lanes',
                  '.mn-layout > .mn-merchant-rack',
                ],
          );
          group('shore facilities', [
            '.mn-shore .mn-dock-group',
            '.mn-shore .mn-specialist-group',
          ]);
          group('lanes', ['.mn-lanes > .mn-lane']);
          group('merchants', ['.mn-merchant-rack .mn-merchant-card']);
          group('market rows', ['.mn-board-market .mn-market-row']);
          const contentEscapes = [];
          for (const [selector, owner] of [
            [
              '.mn-board-market .mn-market-title,.mn-board-market .mn-market-track',
              '.mn-market-row',
            ],
            [
              '.mn-merchant-rack .mn-merchant-name,.mn-merchant-rack .mn-merchant-assets',
              '.mn-merchant-card',
            ],
            ['.mn-lane-heading,.mn-track,.mn-crew', '.mn-lane'],
            ['.mn-shore .mn-space-wrap', '.mn-dock-group,.mn-specialist-group'],
          ]) {
            for (const node of root.querySelectorAll(selector)) {
              if (!visible(node)) continue;
              const container = node.closest(owner);
              if (!container) continue;
              const box = rect(node),
                outer = rect(container);
              if (
                box.left < outer.left - 1.5 ||
                box.right > outer.right + 1.5 ||
                box.top < outer.top - 1.5 ||
                box.bottom > outer.bottom + 1.5
              )
                contentEscapes.push({
                  part: node.className,
                  owner: container.className,
                  box,
                  outer,
                });
            }
          }
          const statusRows = [],
            abbreviatedStatuses = [];
          for (const node of root.querySelectorAll(
            '.mn-position-readout,.mn-manifest-state > span:not(.mn-manifest-hold)',
          )) {
            if (!visible(node)) continue;
            const style = getComputedStyle(node),
              box = rect(node.closest('.mn-manifest-state') ?? node),
              range = document.createRange();
            range.selectNodeContents(node);
            const textBoxes = [...range.getClientRects()].filter(
              (text) => text.width > 0 && text.height > 0,
            );
            const row = {
              text: node.textContent.trim(),
              overflow: style.textOverflow,
              box,
            };
            statusRows.push(row);
            if (
              style.textOverflow === 'ellipsis' ||
              textBoxes.some(
                (text) =>
                  text.left < box.left - 1.5 ||
                  text.right > box.right + 1.5 ||
                  text.top < box.top - 1.5 ||
                  text.bottom > box.bottom + 1.5,
              )
            )
              abbreviatedStatuses.push(row);
          }
          const clippedText = [],
            textRows = [];
          for (const node of root.querySelectorAll(
            '.mn-harbor .mn-space-price,.mn-harbor .mn-space-earn',
          )) {
            if (!visible(node)) continue;
            const cell = node.closest('.mn-space'),
              cellBox = rect(cell);
            const range = document.createRange();
            range.selectNodeContents(node);
            const textBoxes = [...range.getClientRects()]
              .filter((box) => box.width > 0 && box.height > 0)
              .map((box) => ({
                left: box.left,
                top: box.top,
                right: box.right,
                bottom: box.bottom,
              }));
            const row = {
              space: node.closest('[data-mn-space]')?.dataset.mnSpace,
              text: node.textContent,
              cell: cellBox,
              textBoxes,
            };
            textRows.push(row);
            for (const box of textBoxes) {
              const escapes = (outer, x = true, y = true) =>
                (x &&
                  (box.left < outer.left - 1.5 ||
                    box.right > outer.right + 1.5)) ||
                (y &&
                  (box.top < outer.top - 1.5 ||
                    box.bottom > outer.bottom + 1.5));
              if (escapes(cellBox))
                clippedText.push({
                  ...row,
                  reason: 'text leaves its own space',
                });
              let scrollX = false,
                scrollY = false;
              for (
                let parent = node.parentElement;
                parent && root.contains(parent);
                parent = parent.parentElement
              ) {
                const style = getComputedStyle(parent);
                scrollX ||= ['auto', 'scroll'].includes(style.overflowX);
                scrollY ||= ['auto', 'scroll'].includes(style.overflowY);
                const clipX =
                  !scrollX && ['hidden', 'clip'].includes(style.overflowX);
                const clipY =
                  !scrollY && ['hidden', 'clip'].includes(style.overflowY);
                if ((clipX || clipY) && escapes(rect(parent), clipX, clipY))
                  clippedText.push({
                    ...row,
                    reason: 'text clipped by ' + parent.className,
                  });
              }
            }
          }
          const scaleOverlaps = [];
          for (const track of root.querySelectorAll(
            '[data-mn-axis="vertical"] .mn-track-cells',
          )) {
            const labels = [...track.children].filter(
              (node) =>
                visible(node) &&
                getComputedStyle(node).visibility === 'visible',
            );
            for (let a = 0; a < labels.length; a++)
              for (let b = a + 1; b < labels.length; b++) {
                const first = rect(labels[a]),
                  second = rect(labels[b]);
                const gap = Math.max(
                  first.top - second.bottom,
                  second.top - first.bottom,
                );
                if (gap < 8 - 0.1)
                  scaleOverlaps.push({
                    first: labels[a].textContent,
                    second: labels[b].textContent,
                    gap,
                  });
              }
          }
          return {
            statusRows,
            abbreviatedStatuses,
            scaleOverlaps,
            majorCount,
            groups,
            collisions,
            contentEscapes,
            textRows,
            clippedText,
          };
        });
        report.metrics.push({
          width,
          role,
          phase,
          kind: 'result-board-content-geometry',
          ...metrics,
        });
        assert.equal(
          metrics.majorCount,
          role === 'player' && width <= 620 ? 3 : 4,
          `${role}/${phase}: every visible board region is measured (portrait keeps market and merchant ledger behind their existing entry)`,
        );
        assert.deepEqual(
          metrics.abbreviatedStatuses,
          [],
          `${role}/${phase}: saved boat destinations have full glyphs and no ellipsis`,
        );
        assert.equal(
          metrics.statusRows.length,
          3,
          `${role}/${phase}: all three settled boat status labels are checked`,
        );
        assert.deepEqual(
          metrics.collisions,
          [],
          `${role}/${phase}: facilities, market, lanes and merchants never overlap`,
        );
        assert.deepEqual(
          metrics.scaleOverlaps,
          [],
          `${role}/${phase}: vertical scale labels have at least 8px separation`,
        );
        assert.deepEqual(
          metrics.contentEscapes,
          [],
          `${role}/${phase}: facility slots, market rows, lane content and merchant content stay within their own region`,
        );
        assert(
          metrics.textRows.length > 0,
          `${role}/${phase}: fee and payout guard has actual text targets`,
        );
        assert.deepEqual(
          metrics.clippedText,
          [],
          `${role}/${phase}: every visible fee and payout stays readable inside its space`,
        );
      };
      for (const role of ['player', 'host', 'public']) {
        await page.setViewportSize(
          role === 'player' ? { width, height } : { width: 1280, height: 720 },
        );
        const fixture = await load({
          phase: 'round-result',
          role,
          owner: role === 'player',
        });
        assert(
          fixture.result?.finance,
          'New legal-play settlement includes its full-voyage ledger',
        );
        const card = page.locator('.mn-voyage-result');
        assert.equal(
          await card.count(),
          1,
          'Exactly one in-page voyage result card',
        );
        const toggle = card.locator('button.mn-result-toggle');
        assert.equal(
          await toggle.getAttribute('aria-expanded'),
          'true',
          'Result opens automatically on arrival',
        );
        const layout = await card.evaluate((node) => {
          const box = node.getBoundingClientRect(),
            main = document.querySelector('.mn-main').getBoundingClientRect();
          const button = node
            .querySelector('.mn-result-toggle')
            .getBoundingClientRect();
          return {
            position: getComputedStyle(node).position,
            bottom: box.bottom,
            width: box.width,
            mainTop: main.top,
            mainHeight: main.height,
            button: { width: button.width, height: button.height },
            viewport: { width: innerWidth, height: innerHeight },
          };
        });
        assert(
          !['fixed', 'absolute', 'sticky'].includes(layout.position),
          'Settlement remains in page flow',
        );
        assert(
          layout.bottom <= layout.mainTop + 1 && layout.mainHeight > 0,
          'Settlement takes its own row above the board',
        );
        assert(
          layout.button.width >= 44 && layout.button.height >= 44,
          'Settlement toggle retains a 44px target',
        );
        const rows = card.locator('details.mn-result-merchant');
        assert.equal(
          await rows.count(),
          fixture.seatOrder.length,
          'Each merchant has one details row',
        );
        if (role === 'player')
          assert.equal(
            await rows.first().getAttribute('data-seat-id'),
            fixture.seatId,
            'Own public finances appear first',
          );
        for (const id of fixture.seatOrder) {
          const merchant = card.locator(
            `details.mn-result-merchant[data-seat-id="${id}"]`,
          );
          const finance = fixture.result.finance.players[id];
          const net = finance.closingCash - finance.openingCash;
          assert.deepEqual(
            await merchant
              .locator(':scope > summary > .mn-result-amount > b')
              .allTextContents(),
            [
              `${sum(finance.income)} ₱`,
              `${sum(finance.expenses)} ₱`,
              `${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net)} ₱`,
            ],
            'Income, expense and net cash change remain separate values',
          );
          assert.equal(
            Number(
              await merchant
                .locator('.mn-result-net')
                .getAttribute('data-mn-net'),
            ),
            net,
            'Net is closing minus opening cash',
          );
          await tap(merchant.locator(':scope > summary'));
          assert(
            await merchant.evaluate((node) => node.open),
            'Merchant details expand using their summary',
          );
          const details = await merchant
            .locator('.mn-result-breakdown > div')
            .evaluateAll((nodes) =>
              Object.fromEntries(
                nodes.map((node) => [
                  node.querySelector('dt').textContent,
                  node.querySelector('dd').textContent,
                ]),
              ),
            );
          assert.equal(
            details['抵押借入'],
            `${finance.borrowed} ₱`,
            'Borrowing has its own detail line',
          );
          assert.equal(
            details['赎回支出'],
            `${finance.redeemed} ₱`,
            'Redemption has its own detail line',
          );
          assert.equal(details['期初现金'], `${finance.openingCash} ₱`);
          assert.equal(details['期末现金'], `${finance.closingCash} ₱`);
          await tap(merchant.locator(':scope > summary'));
          assert(
            !(await merchant.evaluate((node) => node.open)),
            'Merchant details collapse independently',
          );
        }
        await resultGeometry(role, 'round-result');
        await shot('voyage-result-' + role);
        await tap(toggle);
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(
          await card.locator('.mn-result-body').count(),
          0,
          'Main collapse removes the expanded body',
        );
        await page.evaluate(() => {
          window.resultLifecycle = {
            screen: document.querySelector('.mn-screen'),
            card: document.querySelector('.mn-voyage-result'),
          };
          return window.harbor.repaint();
        });
        await settle();
        assert(
          await page.evaluate(
            () =>
              window.resultLifecycle.screen ===
                document.querySelector('.mn-screen') &&
              window.resultLifecycle.card ===
                document.querySelector('.mn-voyage-result'),
          ),
          'Same-result rerender preserves both mounted screen and card identities',
        );
        assert.equal(
          await toggle.getAttribute('aria-expanded'),
          'false',
          'Same-result rerender keeps the user collapse choice',
        );
        const oldBranch = (await page.evaluate(() => window.harbor.info()))
          .branch;
        await page.evaluate(() => window.harbor.boundary());
        await settle();
        assert.equal(
          (await page.evaluate(() => window.harbor.info())).branch,
          oldBranch + 1,
        );
        assert(
          await page.evaluate(
            () =>
              window.resultLifecycle.screen ===
                document.querySelector('.mn-screen') &&
              !window.resultLifecycle.card.isConnected,
          ),
          'New branch replaces only the result card while the screen stays mounted',
        );
        assert.equal(
          await toggle.getAttribute('aria-expanded'),
          'true',
          'A different branch defaults its new result card to expanded',
        );
        await tap(toggle);
        await page.evaluate(() => window.harbor.restore('place'));
        await settle();
        assert.equal(
          await card.count(),
          0,
          'Restoring a legitimate pre-result snapshot removes the result card',
        );
        assert(
          await page.evaluate(
            () =>
              window.resultLifecycle.screen ===
              document.querySelector('.mn-screen'),
          ),
          'Rollback is projected into the still-mounted screen',
        );
        await page.evaluate(() => window.harbor.restore('round-result'));
        await settle();
        assert.equal(
          await card.count(),
          1,
          'Restoring the reached result mounts one new card',
        );
        assert.equal(
          await toggle.getAttribute('aria-expanded'),
          'true',
          'The restored result on its new branch starts expanded',
        );
        const final = await page.evaluate(() => window.harbor.switch('ended'));
        await settle();
        assert.equal(final.phase, 'ended');
        assert(
          final.result?.finance,
          'The real final voyage retains its ledger at ended',
        );
        assert.equal(
          await card.count(),
          1,
          'Ended retains one final-voyage card',
        );
        assert.equal(
          await card.getAttribute('aria-label'),
          `第${final.result.voyage}航次收支结算`,
          'Ended identifies the actual final voyage',
        );
        assert.equal(
          await card.locator('.mn-result-merchant').count(),
          final.seatOrder.length,
          'Ended retains every final merchant result',
        );
        await page.evaluate(() => {
          window.resultLifecycle.card =
            document.querySelector('.mn-voyage-result');
          return window.harbor.repaint();
        });
        await settle();
        assert(
          await page.evaluate(
            () =>
              window.resultLifecycle.screen ===
                document.querySelector('.mn-screen') &&
              window.resultLifecycle.card ===
                document.querySelector('.mn-voyage-result'),
          ),
          'Ordinary terminal-state rerender does not clear or remount the final card',
        );
        await resultGeometry(role, 'ended');
        await shot('voyage-result-ended-' + role);
        assert.equal(
          (await commands()).length,
          0,
          'Browsing and collapsing a settlement never submits a game action',
        );
        report.metrics.push({
          width,
          role,
          kind: 'voyage-result-layout',
          ...layout,
        });
      }
      await page.setViewportSize({ width, height });
      const legacy = await load({
        phase: 'round-result',
        role: 'player',
        legacy: true,
      });
      assert.equal(
        await page.locator('.mn-result-legacy').count(),
        1,
        'Older results show an explicit incomplete-ledger notice',
      );
      assert.equal(
        await page.locator('.mn-result-breakdown').count(),
        0,
        'Older results never fabricate a full-voyage breakdown',
      );
      for (const id of legacy.seatOrder) {
        const merchant = page.locator(
          `.mn-result-merchant[data-seat-id="${id}"]`,
        );
        assert.equal(
          await merchant.locator(':scope > summary .mn-result-amount').count(),
          1,
          'Legacy shows only the recorded settlement change',
        );
        assert.equal(
          Number(
            await merchant
              .locator('.mn-result-net')
              .getAttribute('data-mn-net'),
          ),
          legacy.result.income[id],
        );
      }
      await shot('voyage-result-legacy');
      await load({ phase: 'auction' });
      assert.equal(
        await page.locator('.mn-voyage-result').count(),
        0,
        'A new voyage does not invent persistent historical results',
      );
    });
    await run('permissions', async () => {
      for (const scenario of [
        { role: 'player', owner: true },
        { role: 'player', owner: false },
        { role: 'player', owner: false, waiting: true },
        { role: 'public' },
        { role: 'host' },
      ]) {
        const { role, owner: ownerFlag = false, waiting = false } = scenario;
        if (role !== 'player')
          await page.setViewportSize({ width: 1280, height: 720 });
        else await page.setViewportSize({ width, height });
        const controls = role === 'host' || ownerFlag;
        const permitted = controls || (role === 'player' && !waiting);
        await load({ phase: 'round-result', ...scenario });
        const next = page.locator(
          '.mn-next-voyage,[data-manila-action="next-voyage"]',
        );
        assert.equal(
          await next.count(),
          permitted ? 1 : 0,
          `${role} owner=${ownerFlag}: next voyage permission`,
        );
        if (permitted) {
          await tap(next);
          const command = await page.evaluate(() => window.harbor.validate());
          assert.equal(
            command.type,
            controls ? 'lifecycle' : 'game',
            'Controller and harbor master use their existing authorized command sources',
          );
        }
        await load({ phase: 'ended', ...scenario });
        const replay = page.getByRole('button', {
          name: '再玩一局',
          exact: true,
        });
        assert.equal(
          await replay.count(),
          controls ? 1 : 0,
          `${role} owner=${ownerFlag}: replay permission`,
        );
        if (controls) {
          await tap(replay);
          await page.evaluate(() => window.harbor.validate());
        }
      }
      await page.setViewportSize({ width, height });
    });
    await run('guards', async () => {
      for (const patch of [
        { locked: true },
        { connected: false },
        { view: { paused: true } },
        { view: { botError: '受控机器人错误' } },
      ]) {
        await load({ phase: 'auction' });
        await page.locator('[data-manila-action="bid"]').evaluate((n) => {
          window.retainedClick = Object.entries(n).find(([key]) =>
            key.startsWith('__reactProps$'),
          )[1].onClick;
        });
        await page.evaluate((p) => window.harbor.update(p), patch);
        await settle();
        await page.evaluate(() => window.retainedClick({}));
        assert.equal(
          (await commands()).length,
          0,
          'Locked/offline/paused/error retained callback cannot submit',
        );
        const bidButton = page.locator('[data-manila-action="bid"]');
        if (await bidButton.count()) assert(await bidButton.isDisabled());
      }
      await load({ phase: 'setup', waiting: true });
      const data = await row();
      assert.equal(await page.locator('#mn-action-area').count(), 1);
      assert.equal(await page.locator('.mn-confirm').count(), 0);
      assert(
        (await page.locator('.mn-controls--waiting').boundingBox()).height <=
          64,
        'Waiting state is a thin status row',
      );
      assert(data.controlsInBoard);
    });
    await run('rotation', async () => {
      await load({ phase: 'setup' });
      await tap(
        page.getByRole('button', { name: '下一步：设起点', exact: true }),
      );
      await tap(arrow(0, 1));
      const draft = await positions();
      await remember();
      await page.setViewportSize({ width: height, height: width });
      await settle();
      assert.deepEqual(
        await positions(),
        draft,
        'Rotation preserves effective setup draft',
      );
      assert(Object.values(await identity()).every(Boolean));
      await page.setViewportSize({ width, height });
      await settle();
      await load({ phase: 'place' });
      const source = page.locator('.mn-worker-source');
      await source.scrollIntoViewIfNeeded();
      const box = await source.boundingBox();
      await source.evaluate((n) => {
        window.captureNode = n;
        window.captureId = null;
        n.addEventListener(
          'gotpointercapture',
          (e) => (window.captureId = e.pointerId),
          { once: true },
        );
      });
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }],
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + 20, y: y - 10 }],
      });
      assert(
        await page.evaluate(
          () =>
            window.captureId !== null &&
            window.captureNode.hasPointerCapture(window.captureId),
        ),
        'Real touch obtains pointer capture',
      );
      await page.setViewportSize({ width: height, height: width });
      await settle();
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchCancel',
        touchPoints: [],
      });
      assert(
        await page.evaluate(
          () => !window.captureNode.hasPointerCapture(window.captureId),
        ),
        'Rotation releases pointer capture',
      );
      assert.equal(await page.locator('.mn-drag-ghost').count(), 0);
      assert.equal((await commands()).length, 0);
      await page.setViewportSize({ width, height });
      await settle();
      await shot('rotation-restored');
    });
    await run('viewport', async () => {
      await load({ phase: 'auction' });
      const field = page.locator('#mn-bid-amount');
      await field.focus();
      const before = await page.locator('.mn-lanes').boundingBox();
      await page.setViewportSize({
        width,
        height: Math.max(280, height - 210),
      });
      await settle();
      const after = await page.locator('.mn-lanes').boundingBox();
      assert(
        Math.abs(before.height - after.height) <= 1,
        'Keyboard-like height resize leaves width-derived sea height unchanged',
      );
      report.metrics.push({
        width,
        kind: 'keyboard-like-viewport-resize',
        before,
        after,
        active: await page.evaluate(() => document.activeElement?.id),
        boundary: 'Emulation only; no physical keyboard or IME proof',
      });
      await page.setViewportSize({ width, height });
      await settle();
    });
    await run('tie', async () => {
      await load({ phase: 'tie', owner: true });
      await page.getByRole('button', { name: '账本' }).click();
      await page.locator('.mn-overlay--ledger').waitFor();
      const data = await page
        .locator('.mn-merchant-slot[aria-label]')
        .evaluateAll((ns) =>
          ns.map((n) => ({
            text: n.innerText,
            label: n.getAttribute('aria-label'),
          })),
        );
      assert.equal(data.length, 5);
      assert(
        data.every((n) => n.label.includes('赢家')),
        'Every tied winner is marked',
      );
      const ranks = await page.locator('.mn-tag--rank').allTextContents();
      assert.equal(ranks.length, 5);
      assert.equal(new Set(ranks).size, 1, 'Tied wealth has identical rank');
      const rootBounds = await row();
      assert(rootBounds.scrollWidth <= width + 1);
      const shares = await page.evaluate(() => ({
        chips: [...document.querySelectorAll('.mn-share-chip')].map((n) => ({
          label: n.getAttribute('aria-label'),
          mortgaged: n.classList.contains('mn-share-chip--mortgaged'),
          width: n.getBoundingClientRect().width,
          height: n.getBoundingClientRect().height,
          image: n.querySelector('img')?.naturalWidth ?? 0,
        })),
        text: document.querySelector('.mn-players-panel')?.textContent ?? '',
      }));
      assert(shares.chips.length > 0, 'Final settlement shows share icons');
      assert(
        shares.chips.every(
          (chip) =>
            chip.width >= 28 &&
            chip.height >= 28 &&
            chip.image > 0 &&
            chip.label,
        ),
        'Every settlement share icon is decoded and has an accessible label',
      );
      assert(
        shares.chips.some((chip) => chip.mortgaged),
        'Mortgage state is represented by a visual chip',
      );
      assert(
        !shares.text.includes('（抵押）'),
        'Settlement does not repeat the mortgage parenthetical',
      );
      await page.locator('.mn-players-panel').scrollIntoViewIfNeeded();
      await shot('controlled-tie');
      report.metrics.push({
        width,
        kind: 'controlled-valid-tie',
        players: data,
        ranks,
        shares,
      });
      await page.keyboard.press('Escape');
      await page.locator('.mn-overlay--ledger').waitFor({ state: 'hidden' });
    });
    await run('tail', async () => {
      await load({ phase: 'place' });
      const target = page.locator('[data-mn-space="insurance"]');
      await tap(target.locator('button'));
      await tap(page.locator('[data-manila-action="place"]'));
      assert.equal((await commands()).length, 1);
      const before = await target.boundingBox();
      const scrollBefore = await owner.evaluate((n) => ({
        top: n.scrollTop,
        max: n.scrollHeight - n.clientHeight,
      }));
      await page.evaluate(() => window.harbor.commit());
      await settle();
      const after = await target.boundingBox();
      const tail = await owner.evaluate(
        (n) => parseFloat(n.style.getPropertyValue('--mn-anchor-tail')) || 0,
      );
      const scrollAfter = await owner.evaluate((n) => ({
        top: n.scrollTop,
        max: n.scrollHeight - n.clientHeight,
      }));
      report.metrics.push({
        width,
        kind: 'saved-to-waiting-tail',
        before,
        after,
        tail,
        scrollBefore,
        scrollAfter,
      });
      assert.equal(await page.locator('.mn-controls--waiting').count(), 1);
      assert(
        Math.abs(before.y - after.y) <= 1,
        'Saving a placement into waiting preserves the board target despite shrinking action content',
      );
      assert(
        tail > 0,
        'Shrinking bottom content receives only the required scroll-range repair',
      );
      const bounds = await owner.boundingBox();
      const x = bounds.x + 3,
        y = bounds.y + bounds.height / 2;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }],
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - 55 }],
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await settle();
      assert.equal(
        await owner.evaluate(
          (n) => parseFloat(n.style.getPropertyValue('--mn-anchor-tail')) || 0,
        ),
        0,
        'A real user touch scroll releases temporary tail space',
      );
    });
    await run('share', async () => {
      await load({ phase: 'share-funded' });
      const skip = page.locator('[data-manila-action="skip-share"]');
      await skip.scrollIntoViewIfNeeded();
      await settle();
      const metrics = await page.evaluate(() => {
        const skip = document.querySelector(
          '[data-manila-action="skip-share"]',
        );
        const summary = document.querySelector(
          '#mn-action-area .mn-inline-actions > .mn-alternatives > summary',
        );
        const read = (n) => {
          const r = n.getBoundingClientRect(),
            s = getComputedStyle(n);
          const label = n.querySelector(':scope > span:last-child') ?? n;
          const range = document.createRange();
          range.selectNodeContents(label);
          const t = range.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            padding: s.padding,
            fontSize: s.fontSize,
            lineHeight: s.lineHeight,
            textY: t.y,
            textHeight: t.height,
            textCenter: t.y + t.height / 2,
            center: r.y + r.height / 2,
          };
        };
        return {
          skip: read(skip),
          finance: read(summary),
          sameContainer:
            skip.parentElement === summary.parentElement.parentElement,
        };
      });
      report.metrics.push({ width, phase: 'share', ...metrics });
      await shot('share-actions');
      assert(
        metrics.sameContainer,
        'Skip-share and finance entry share one action row',
      );
      assert(
        Math.abs(metrics.skip.y - metrics.finance.y) <= 1 &&
          Math.abs(metrics.skip.height - metrics.finance.height) <= 1,
        'Actual share phase action entries share a top and height',
      );
      assert.equal(
        metrics.skip.padding,
        metrics.finance.padding,
        'Share action entries use identical padding',
      );
      assert(
        Math.abs(metrics.skip.textCenter - metrics.finance.textCenter) <= 1,
        'Share action labels share their visual text baseline',
      );
      assert(await skip.isEnabled());
      await tap(skip);
      await page.evaluate(() => window.harbor.validate());
    });
    await run('entries', async () => {
      const selectors = {
        bid: '[data-manila-action="bid"]',
        pass: '[data-manila-action="pass"]',
        'skip-share': '[data-manila-action="skip-share"]',
        'buy-share': '.mn-share-choices button',
        setup: '.mn-lane-cargo-select',
        place: '.mn-space--legal',
        board: '[data-manila-drop^="board:"]',
        pilot: '.mn-position-controls',
        plunder: '[data-manila-drop^="destination:"]',
        mortgage:
          '.mn-alternatives > summary,.mn-finance-choice[data-manila-action="mortgage"]',
        repay:
          '.mn-alternatives > summary,.mn-finance-choice[data-manila-action="repay"]',
        'next-voyage': '.mn-next-voyage',
      };
      for (const phase of [
        'auction',
        'share-funded',
        'setup',
        'place',
        'crew-full',
        'board',
        'pilot-small',
        'pilot-large',
        'plunder',
        'financing',
        'round-result',
      ]) {
        const fixture = await load({ phase });
        for (const type of new Set(fixture.legal.map((a) => a.type)))
          assert(
            await page.locator(selectors[type]).count(),
            phase + ' exposes the authorized ' + type + ' entry',
          );
        const metrics = await page.evaluate(() => {
          const rect = (n) => {
            const r = n.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            };
          };
          return {
            pirateLines: [...document.querySelectorAll('.mn-pirate-line')]
              .filter((n) => n.checkVisibility())
              .map((n) => ({
                box: rect(n),
                active: n.classList.contains('is-active'),
                label: n.textContent,
                lanes: rect(n.closest('.mn-lanes')),
              })),
            slots: [...document.querySelectorAll('.mn-lane-control')].map(
              (node) => ({
                ...rect(node),
                contents: [...node.children]
                  .filter((child) => child.checkVisibility())
                  .map(rect),
              }),
            ),
            spaces: [...document.querySelectorAll('.mn-harbor .mn-space')]
              .filter((n) => n.checkVisibility())
              .map((n) => ({
                space: rect(n),
                name: rect(n.querySelector('.mn-space-name')),
                value: rect(n.querySelector('.mn-space-value')),
                head:
                  n.querySelector('.mn-worker-head') &&
                  rect(n.querySelector('.mn-worker-head')),
              })),
            payouts: [
              ...document.querySelectorAll('.mn-lane-heading .mn-cargo-payout'),
            ]
              .filter((n) => n.checkVisibility())
              .map((n) => ({
                text: n.textContent,
                box: rect(n),
                lane: rect(n.closest('.mn-lane')),
              })),
            dice: [...document.querySelectorAll('.mn-lane .mn-dice')]
              .filter((n) => n.checkVisibility())
              .map((n) => ({
                box: rect(n),
                heading: rect(
                  n.closest('.mn-lane').querySelector('.mn-lane-heading'),
                ),
              })),
            touchEntries: [
              ...document.querySelectorAll(
                '#mn-action-area button,#mn-action-area summary',
              ),
            ]
              .filter((n) => n.checkVisibility())
              .map((n) => ({
                label: n.getAttribute('aria-label') ?? n.textContent,
                box: rect(n),
              })),
            crew: [...document.querySelectorAll('.mn-crew')]
              .filter((n) => n.checkVisibility())
              .map((n) => ({
                cargo: n.closest('.mn-lane').dataset.mnCargo,
                state: n.dataset.mnLaneState,
                count: Number(n.dataset.mnCrewCount),
                readout: n.querySelector('.mn-manifest-kicker')?.textContent,
                roster:
                  n.querySelector('.mn-manifest-members') &&
                  rect(n.querySelector('.mn-manifest-members')),
                target:
                  n.querySelector('.mn-manifest-target .mn-space') &&
                  rect(n.querySelector('.mn-manifest-target .mn-space')),
                members: [
                  ...n.querySelectorAll('.mn-manifest-members .mn-worker'),
                ].map((member) => ({
                  body: rect(member),
                  head: member
                    .querySelector('.mn-worker-head')
                    ?.checkVisibility()
                    ? rect(member.querySelector('.mn-worker-head'))
                    : null,
                })),
              })),
          };
        });
        report.metrics.push({
          width,
          phase,
          kind: 'all-action-entries',
          ...metrics,
        });
        assert(
          metrics.slots.every(
            (slot) =>
              slot.height >= 64 &&
              slot.contents.every(
                (content) =>
                  content.x >= slot.x - 1 &&
                  content.right <= slot.right + 1 &&
                  content.y >= slot.y - 1 &&
                  content.bottom <= slot.bottom + 1,
              ),
          ),
          'Every phase reserves at least 64px for lane controls and fully contains their growing contents',
        );
        assert.equal(
          metrics.pirateLines.length,
          1,
          'Every mobile action phase exposes one pirate intercept marker',
        );
        const pirateLine = metrics.pirateLines[0];
        assert.match(
          pirateLine.label,
          /海盗拦截/,
          'Pirate intercept marker names the 13-cell boundary',
        );
        assert(
          pirateLine.box.width >= 40 &&
            pirateLine.box.right <= pirateLine.lanes.right + 1,
          'Pirate intercept marker stays inside the lanes',
        );
        assert.equal(
          pirateLine.active,
          phase === 'board' ||
            phase === 'plunder' ||
            fixture.boats.some(
              (boat) => boat.destination === 'sea' && boat.position === 13,
            ),
          'Pirate intercept marker activates on the 13-cell boundary',
        );
        for (const space of metrics.spaces) {
          const overlapX =
            Math.min(space.value.right, space.name.right) -
            Math.max(space.value.x, space.name.x);
          const overlapY =
            Math.min(space.value.bottom, space.name.bottom) -
            Math.max(space.value.y, space.name.y);
          assert(
            overlapX <= 1 || overlapY <= 1,
            'Names and costs or occupants use separate readable regions',
          );
          assert(
            space.value.bottom <= space.space.bottom + 1,
            'Space value stays within the same cell',
          );
          if (space.head)
            assert(
              space.head.y >= space.value.y - 1,
              'Pawn head fits the lower state field',
            );
        }
        for (const item of metrics.touchEntries)
          assert(
            item.box.width >= 44 && item.box.height >= 44,
            'Visible action entry preserves its 44px hit target: ' + item.label,
          );
        if (phase === 'auction')
          assert(
            metrics.touchEntries.every(
              (item) =>
                Math.abs(item.box.y - metrics.touchEntries[0].box.y) <= 1 &&
                Math.abs(
                  item.box.height - metrics.touchEntries[0].box.height,
                ) <= 1,
            ),
            'Auction action entries preserve matching top and height',
          );
        for (const payout of metrics.payouts) {
          assert(payout.text.includes('分红池'));
          assert(
            payout.box.x >= payout.lane.x - 1 &&
              payout.box.right <= payout.lane.right + 1,
            'Payout field fits its lane',
          );
        }
        for (const die of metrics.dice) {
          assert(
            die.box.y >= die.heading.y - 1 &&
              die.box.bottom <= die.heading.bottom + 1,
            'The dice result stays inside the cargo header band',
          );
          assert(
            Math.abs(die.box.width - die.box.height) <= 0.6,
            'The mobile dice result remains square',
          );
        }
        for (const crew of metrics.crew) {
          if (crew.roster)
            for (const member of crew.members) {
              if (member.head)
                assert(
                  member.head.y >= crew.roster.y - 1,
                  'A saved crew pawn head stays inside the roster row',
                );
              assert(
                member.body.y >= crew.roster.y - 1 &&
                  member.body.bottom <= crew.roster.bottom + 1,
                'Saved crew pawn fits the roster row',
              );
              assert(
                member.body.x >= crew.roster.x - 1 &&
                  member.body.right <= crew.roster.right + 1,
                'Saved crew pawn fits the lane width',
              );
            }
          if (phase === 'crew-full' && crew.cargo === 'jade')
            assert.equal(
              crew.members.length,
              4,
              'Four saved jade crew members remain visible',
            );
          if (crew.target)
            assert(
              crew.target.width >= 44 && crew.target.height >= 44,
              'The manifest keeps every legal vacancy at least 44px',
            );
          const boat = fixture.boats.find((b) => b.cargo === crew.cargo);
          if (
            boat?.destination === 'sea' &&
            !boat.plundered &&
            crew.state === 'sea'
          ) {
            const count = await page.evaluate(
              (cargo) =>
                window.fixtureSession.view.gameView.spaces.filter(
                  (s) => s.kind === 'cargo' && s.cargo === cargo && s.occupant,
                ).length,
              crew.cargo,
            );
            assert.equal(
              crew.count,
              count,
              'Sea lane manifest exposes the actual saved crew count',
            );
            assert.match(
              crew.readout,
              /船员/,
              `${phase}/${crew.cargo}: Sea lane manifest labels the crew row`,
            );
          }
          assert.notEqual(
            (crew.readout ?? '').trim(),
            '等待装船',
            'The retired waiting-ship sentence is not rendered as a text block',
          );
          assert.doesNotMatch(
            (crew.readout ?? '').trim(),
            /^船员 \d+$/,
            'The retired crew-count sentence is not rendered as a text block',
          );
        }
        if (
          ['place', 'crew-full', 'pilot-small', 'round-result'].includes(phase)
        )
          await shot('entries-' + phase);
      }
      if (width === 390) {
        await page.setViewportSize({ width: 1280, height: 720 });
        await load({ phase: 'pilot-small' });
        const desktop = await page.evaluate(() => ({
          viewport: { width: innerWidth, height: innerHeight },
          payouts: [
            ...document.querySelectorAll('.mn-crew > .mn-detail-button'),
          ].map((n) => ({ text: n.textContent, visible: n.checkVisibility() })),
          headerPayouts: [
            ...document.querySelectorAll('.mn-lane-heading .mn-cargo-payout'),
          ].filter((n) => n.checkVisibility()).length,
        }));
        report.metrics.push({
          width,
          phase: 'pilot-small',
          kind: 'player-desktop-visual',
          ...desktop,
        });
        assert(
          desktop.payouts.every((p) => !p.visible),
          'Desktop avoids a duplicate bottom payout label',
        );
        assert.equal(
          desktop.headerPayouts,
          3,
          'Every desktop player lane exposes its payout in the header',
        );
        const path = join(output, 'entries-player-desktop-pilot-1280x720.png');
        await captureBrowserScreenshot(page, { path, fullPage: false });
        report.screenshots.push(path);
        await page.setViewportSize({ width, height });
      }
    });
    await run('text-flow', async () => {
      const measure = () =>
        page.evaluate(() => {
          const root = document.querySelector('.manila-screen');
          const owner = root.querySelector('.mn-player-scroll');
          const rect = (node) => {
            const box = node.getBoundingClientRect();
            return {
              left: box.left,
              right: box.right,
              top: box.top,
              bottom: box.bottom,
              width: box.width,
              height: box.height,
            };
          };
          const outside = (box, outer, x = true, y = true) =>
            (x &&
              (box.left < outer.left - 1.5 || box.right > outer.right + 1.5)) ||
            (y &&
              (box.top < outer.top - 1.5 || box.bottom > outer.bottom + 1.5));
          const intersection = (a, b) =>
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1.5 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1.5;
          // Scroll-reachable content retains its full glyph checks below. For
          // collision checks use only pixels painted through every scroll/clip
          // viewport, so an offscreen board never collides with a fixed header.
          const paintedBox = (node, source = rect(node)) => {
            const box = {
              left: Math.max(0, source.left),
              right: Math.min(innerWidth, source.right),
              top: Math.max(0, source.top),
              bottom: Math.min(innerHeight, source.bottom),
            };
            for (
              let parent = node.parentElement;
              parent && root.contains(parent);
              parent = parent.parentElement
            ) {
              const style = getComputedStyle(parent);
              const outer = rect(parent);
              const left = outer.left + parent.clientLeft;
              const top = outer.top + parent.clientTop;
              if (
                ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX)
              ) {
                box.left = Math.max(box.left, left);
                box.right = Math.min(box.right, left + parent.clientWidth);
              }
              if (
                ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY)
              ) {
                box.top = Math.max(box.top, top);
                box.bottom = Math.min(box.bottom, top + parent.clientHeight);
              }
            }
            return box.right > box.left && box.bottom > box.top ? box : null;
          };
          const visible = (node) =>
            node.checkVisibility() &&
            getComputedStyle(node).visibility === 'visible' &&
            !node.closest('.mn-sr-only,.sr-only') &&
            !node.closest('[aria-hidden="true"]') &&
            rect(node).width > 0 &&
            rect(node).height > 0;
          const clipped = [],
            glyphs = [];
          let targetId = 0;
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const text = walker.currentNode;
            const node = text.parentElement;
            if (!text.textContent.trim() || !visible(node)) continue;
            const range = document.createRange();
            range.selectNodeContents(text);
            const boxes = [...range.getClientRects()].filter(
              (box) => box.width > 0 && box.height > 0,
            );
            const label = text.textContent.trim();
            const cell = node.closest(
              '.mn-space,.mn-saved-position,.mn-lane-position,.mn-boat-preview,.mn-lane-heading,.mn-finance-choice,.mn-confirm,.mn-controls,.mn-merchant-card,.mn-status,.mn-private,.mn-result-merchant,.mn-notice,.mn-detail-card',
            );
            for (const box of boxes) {
              const id = targetId++;
              const saved = !!node.closest('.session-save-overlay');
              if (cell && !saved && outside(box, rect(cell)))
                clipped.push({
                  label,
                  reason: 'glyph leaves own card',
                  cell: cell.className,
                  nodeClass: node.className,
                  glyphBox: box.toJSON(),
                  cellBox: rect(cell),
                });
              let scrollX = false,
                scrollY = false;
              for (
                let parent = node;
                parent && root.contains(parent);
                parent = parent.parentElement
              ) {
                const style = getComputedStyle(parent);
                scrollX ||= ['auto', 'scroll'].includes(style.overflowX);
                scrollY ||= ['auto', 'scroll'].includes(style.overflowY);
                const clipX =
                  !scrollX && ['hidden', 'clip'].includes(style.overflowX);
                const clipY =
                  !scrollY && ['hidden', 'clip'].includes(style.overflowY);
                if (
                  (clipX || clipY) &&
                  outside(box, rect(parent), clipX, clipY)
                )
                  clipped.push({
                    label,
                    reason: 'glyph clipped by ancestor',
                    ancestor: parent.className,
                    nodeClass: node.className,
                    glyphBox: box.toJSON(),
                    ancestorBox: rect(parent),
                  });
              }
              const painted = paintedBox(node, box);
              if (painted)
                glyphs.push({ id, label, node, box: painted, saved });
            }
          }
          const overlaps = [],
            covered = [];
          for (let a = 0; a < glyphs.length; a++)
            for (let b = a + 1; b < glyphs.length; b++)
              if (intersection(glyphs[a].box, glyphs[b].box))
                overlaps.push({
                  a: glyphs[a].label,
                  b: glyphs[b].label,
                  aClass: glyphs[a].node.className,
                  bClass: glyphs[b].node.className,
                  aBox: glyphs[a].box,
                  bBox: glyphs[b].box,
                });
          const objects = [
            ...root.querySelectorAll(
              '.mn-dice,.mn-cargo-art,.mn-site-art,.mn-actor-avatar,button,a.button,summary,input,select',
            ),
          ]
            .filter(visible)
            .map((node) => ({ node, box: paintedBox(node) }))
            .filter((object) => object.box);
          for (const glyph of glyphs)
            for (const object of objects) {
              if (
                object.node.contains(glyph.node) ||
                glyph.node.contains(object.node)
              )
                continue;
              if (intersection(glyph.box, object.box))
                covered.push({
                  text: glyph.label,
                  object: object.node.className || object.node.tagName,
                  textBox: glyph.box,
                  objectBox: object.box,
                });
            }
          const anchors = [
            ...root.querySelectorAll('.session-save-anchor,.mn-status-save'),
          ]
            .filter((node) => getComputedStyle(node).display !== 'none')
            .map((node) => ({
              className: node.className,
              position: getComputedStyle(node).position,
              ...rect(node),
            }));
          const actions = [
            ...root.querySelectorAll(
              '.mn-controls button,.mn-controls summary',
            ),
          ]
            .filter(visible)
            .map((node) => ({ text: node.textContent.trim(), ...rect(node) }));
          const readoutGaps = [];
          for (const lane of root.querySelectorAll(
            '.mn-harbor[data-mn-axis="vertical"] .mn-lane',
          )) {
            const readout = lane.querySelector('.mn-saved-position');
            const marker = lane.querySelector(
              '.mn-track-cells [data-mn-cell="13"]',
            );
            if (!readout || !marker || !visible(readout) || !visible(marker))
              continue;
            const signRange = document.createRange();
            const markerRange = document.createRange();
            signRange.selectNodeContents(readout);
            markerRange.selectNodeContents(marker);
            readoutGaps.push({
              cargo: lane.dataset.mnCargo,
              gap:
                markerRange.getBoundingClientRect().top -
                signRange.getBoundingClientRect().bottom,
            });
          }
          return {
            glyphs: glyphs.length,
            targetIds: glyphs.map((glyph) => glyph.id),
            ownerTargetIds: glyphs
              .filter((glyph) => owner.contains(glyph.node))
              .map((glyph) => glyph.id),
            clipped,
            overlaps,
            covered,
            anchors,
            actions,
            readoutGaps,
            ownerOverflow: owner.scrollWidth - owner.clientWidth,
            rootOverflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
      const inspectFrame = async (phase, variant) => {
        const metrics = await measure();
        report.metrics.push({
          width,
          height,
          phase,
          variant,
          kind: 'full-text-flow',
          ...metrics,
        });
        assert(
          metrics.glyphs > 0,
          `${phase}: each measured viewport has actual painted glyph targets`,
        );
        assert(
          metrics.rootOverflow <= 1 && metrics.ownerOverflow <= 1,
          `${phase}: no horizontal page or owner overflow`,
        );
        assert.deepEqual(
          metrics.clipped,
          [],
          `${phase}/${variant}: full glyphs fit their card and clipping ancestors`,
        );
        assert.deepEqual(
          metrics.overlaps,
          [],
          `${phase}/${variant}: text groups never overlap`,
        );
        assert.deepEqual(
          metrics.covered,
          [],
          `${phase}/${variant}: text stays clear of other controls and icons`,
        );
        assert(
          metrics.readoutGaps.every(({ gap }) => gap >= 8),
          `${phase}/${variant}: ship-position signs keep 8px of clear space before the 13 marker`,
        );
        assert(
          metrics.anchors.every(
            (anchor) =>
              anchor.position === 'absolute' &&
              anchor.width <= 0.5 &&
              anchor.height <= 0.5,
          ),
          `${phase}: save anchors never participate in layout`,
        );
        assert(
          metrics.actions.every(
            (action) => action.width >= 44 && action.height >= 44,
          ),
          `${phase}: every visible action retains a 44px hit target`,
        );
        return metrics;
      };
      const inspect = async (phase, variant) => {
        const scroll = await owner.evaluate((node) => ({
          original: node.scrollTop,
          height: node.clientHeight,
          maximum: node.scrollHeight - node.clientHeight,
        }));
        assert(
          scroll.height >= 44,
          `${phase}: the real scroll viewport can expose a full touch target`,
        );
        const offsets = new Set([scroll.original, 0, scroll.maximum]);
        for (
          let top = 0;
          top < scroll.maximum;
          top += Math.max(44, Math.floor(scroll.height * 0.75))
        )
          offsets.add(top);
        const targets = new Set(),
          ownerTargets = new Set();
        try {
          for (const top of offsets) {
            await owner.evaluate(
              (node, value) =>
                node.scrollTo({ top: value, behavior: 'instant' }),
              top,
            );
            await settle();
            const metrics = await inspectFrame(
              phase,
              variant + '/scroll-' + Math.round(top),
            );
            metrics.targetIds.forEach((id) => targets.add(id));
            metrics.ownerTargetIds.forEach((id) => ownerTargets.add(id));
          }
          assert(
            targets.size >= 20 && ownerTargets.size >= 5,
            `${phase}: the actual viewport scan paints at least 20 distinct glyph targets, including 5 inside the scroll owner`,
          );
          report.metrics.push({
            width,
            height,
            phase,
            variant,
            kind: 'text-flow-scroll-coverage',
            offsets: [...offsets],
            paintedTargets: targets.size,
            ownerTargets: ownerTargets.size,
          });
        } finally {
          await owner.evaluate(
            (node, top) => node.scrollTo({ top, behavior: 'instant' }),
            scroll.original,
          );
          await settle();
        }
      };
      const layout = () =>
        page.evaluate(() =>
          [
            '.mn-toolbar',
            '.mn-status',
            '.mn-player-scroll',
            '.mn-harbor',
            '.mn-lane-control',
          ].map((selector) => {
            const box = document
              .querySelector(selector)
              .getBoundingClientRect();
            return {
              selector,
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
            };
          }),
        );
      for (const phase of [
        'auction',
        'auction-largest',
        'auction-leading',
        'share-funded',
        'setup',
        'place',
        'crew-full',
        'board',
        'pilot-small',
        'pilot-large',
        'plunder',
        'financing',
        'round-result',
        'ended',
      ])
        for (const longNames of [false, true]) {
          const fixture = await load({ phase, longNames, owner: true });
          if (phase === 'auction-largest') {
            const maximum = fixture.legal
              .filter((action) => action.type === 'bid')
              .at(-1)?.amount;
            assert(
              Number.isInteger(maximum),
              'Largest amount comes from the real legal bid list',
            );
            await page.locator('#mn-bid-amount').fill(String(maximum));
            await settle();
            report.metrics.push({
              width,
              height,
              phase,
              kind: 'largest-legal-bid',
              maximum,
            });
          }
          const variant = longNames ? '24-character-names' : 'ordinary-names';
          const before = await layout();
          await page.evaluate(() =>
            window.harbor.update({ message: '已保存', messageKind: 'saved' }),
          );
          await settle();
          assert.deepEqual(
            await layout(),
            before,
            `${phase}: showing save feedback moves no layout region`,
          );
          await inspect(phase, variant + '/saved');
          await page.evaluate(() =>
            window.harbor.update({ message: '', messageKind: 'none' }),
          );
          await settle();
          assert.deepEqual(
            await layout(),
            before,
            `${phase}: hiding save feedback moves no layout region`,
          );
          const summary = page
            .locator('.mn-controls .mn-alternatives > summary')
            .first();
          if (await summary.isVisible()) {
            await tap(summary);
            await inspect(phase, variant + '/alternatives-open');
          }
          if (phase === 'place') {
            const target = page.locator('.mn-space--legal').first();
            await tap(target);
            await inspect(phase, variant + '/draft-confirmation');
          }
          assert.deepEqual(
            await commands(),
            [],
            `${phase}: measuring content never submits a game action`,
          );
          if (
            longNames &&
            ['auction-leading', 'place', 'financing'].includes(phase)
          )
            await shot('text-flow-' + phase);
        }
      await load({ phase: 'place', longNames: true });
      for (const [variant, patch] of [
        ['paused', { view: { paused: true } }],
        ['restored', { view: { paused: true, restored: true } }],
        [
          'connection',
          { connected: false, view: { paused: false, restored: false } },
        ],
      ]) {
        await page.evaluate((value) => window.harbor.update(value), patch);
        await settle();
        await inspect('place', variant);
      }
    });
    const priority = [
      'text-flow',
      'voyage-result',
      'share',
      'entries',
      'tail',
      'stability',
      'tie',
      'permissions',
      'boundary',
      'payment',
      'rotation',
      'guards',
      'viewport',
      'structure',
      'setup',
      'pilot-small',
      'pilot-large',
    ];
    for (const task of tasks.sort(
      (a, b) => priority.indexOf(a.name) - priority.indexOf(b.name),
    )) {
      await check(`${task.name}-${width}x${height}`, task.body, page);
      await page.setViewportSize({ width, height });
    }
    await context.close();
  }
  if (report.errors.length)
    report.failures.push({
      name: 'browser-errors',
      error: JSON.stringify(report.errors),
    });
} catch (error) {
  report.failures.push({ name: 'verifier-runtime', error: error.stack });
} finally {
  await browser?.close();
  await server?.close();
  report.inputsAfter = await fingerprint();
  report.inputBindingAfter = inputBinding;
  report.changedInputs = changedInputs(report.inputsBefore, report.inputsAfter);
  if (report.changedInputs.length)
    report.failures.push({
      name: 'input-stability',
      error:
        'Relevant product sources changed during this run: ' +
        report.changedInputs.join(', '),
    });
  report.result = report.failures.length ? 'failed' : 'passed';
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.length,
      interactions: report.interactions,
      failures: report.failures.map(({ name, error }) => ({
        name,
        error: error.split('\n')[0],
      })),
      unexecuted: report.unexecuted,
      report: join(output, 'report.json'),
    }),
  );
  process.exitCode = report.failures.length ? 1 : 0;
}
