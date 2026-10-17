import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';

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
];
const selected = option('only')?.split(',') ?? available;
assert(selected.every((value) => available.includes(value)));
const widths = option('widths')?.split(',').map(Number) ?? [320, 390, 430, 844];
assert(widths.every((value) => [320, 390, 430, 844].includes(value)));
const parent = resolve(
  'artifacts/maintenance/manila-harbor-rebuild-20261017/mobile',
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
let seed=35719;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const ctx={seats:ids,random:{next:random}}, snapshots={}, origins={};
const required=['auction','share','setup','place','pilot-small','pilot-large','round-result','ended'];
for(let run=0;run<32&&required.some(p=>!snapshots[p]);run++){
 let state=rules.initialize(ctx);
 for(let step=0;step<900;step++){
  if(required.includes(state.phase)&&!snapshots[state.phase]){snapshots[state.phase]=structuredClone(state);origins[state.phase]={kind:'legal-play',run,step,serial:state.serial,voyage:state.voyage};}
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
const tied=structuredClone(snapshots.ended);
const wealth=Math.max(...Object.values(tied.scores))+50;
for(const id of ids){const p=tied.players[id];p.cash=wealth-p.shares.reduce((n,s)=>n+tied.market[s.cargo]-(s.mortgaged?15:0),0);}
tied.scores=finalScores(tied);tied.winners=resolveWinners(tied.scores,ids);
snapshots.tie=validateState(tied,ids);
origins.tie={kind:'controlled-valid-state',note:'Cash adjusted on legally reached terminal board; not natural tied-game evidence.'};
window.fixtureInfo={available:Object.keys(snapshots),origins,missing:required.filter(p=>!snapshots[p])};
const root=createRoot(document.getElementById('root'));
let generation=0,current;
const noop=()=>{};
window.commands=[];window.scrollCalls=[];
const nativeScroll=Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView=function(options){window.scrollCalls.push({id:this.id,className:this.className,options});return nativeScroll.call(this,options);};
const nativeOwnerScroll=Element.prototype.scrollTo;
Element.prototype.scrollTo=function(...args){window.scrollCalls.push({method:'scrollTo',id:this.id,className:this.className,options:args[0]});return nativeOwnerScroll.apply(this,args);};
function info(){const v=current.session.view;return {actor:turnSeat(current.state),seatId:current.seatId,phase:current.state.phase,legal:v.actions,boats:v.gameView.boats,shares:v.gameView.self?.shares??[],decisionId:v.decisionId,branch:v.branch};}
function paint(){window.fixtureSession=current.session;flushSync(()=>root.render(<PlatformGame key={generation} session={current.session} client={client}/>));return info();}
function sessionFor(state,options={}){
 const actor=turnSeat(state)??ids[0],role=options.role??'player';
 const seatId=options.seatId??(options.waiting?ids.find(id=>id!==actor):actor),ownerSeatId=options.owner?seatId:null;
 const canControl=role==='host'||(role==='player'&&seatId===ownerSeatId);
 const pending=role==='player'?rules.decisions(state).find(p=>p.seatId===seatId):null;
 const view={instanceId:'manila-harbor-fixture',branch:options.branch??0,revision:state.serial,status:state.phase==='ended'?'ended':'playing',paused:false,playMode:'play',gameView:rules.project(state,role==='player'?{role:'player',seatId}:{role:'public'}),decisionId:pending?.id??null,countdownSeconds:30,decisionClock:null,actions:pending?rules.legalActions(state,seatId):[],lifecycleActions:canControl?rules.lifecycleActions(state):[],seats,history:[],joinOpen:true,ownerSeatId,game:{...rules.manifest,releaseRef:'fixture',minPlayers:3,maxPlayers:5,min:3,max:5},catalog:[],capabilities:{manage:role==='host',control:canControl,manageSeats:canControl},self:{role,seatId:role==='player'?seatId:null},restored:false,selectionToken:null};
 return {role,view,self:role==='player'?seats.find(s=>s.id===seatId):undefined,isHost:role==='host',canControl,canManageSeats:canControl,connected:true,locked:false,busy:false,message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],credential:'fixture',name:'阿蓝',setName:noop,command:c=>window.commands.push(c),join:noop,retry:noop,retryAdmission:noop,setPlayerCredential:noop,publicUrl:'http://127.0.0.1',localUrl:'http://127.0.0.1',admissionAvatarId:null};
}
window.harbor={
 load(options={}){const phase=options.phase??'setup';const state=structuredClone(snapshots[phase]);if(!state)throw new Error('Missing fixture '+phase);current={state,options,seatId:options.seatId??(options.waiting?ids.find(id=>id!==(turnSeat(state)??ids[0])):turnSeat(state)??ids[0]),session:sessionFor(state,options)};window.commands=[];window.scrollCalls=[];generation++;return paint();},
 update(patch={}){const viewPatch=patch.view??{};current.session={...current.session,...patch,view:{...current.session.view,...viewPatch}};return paint();},
 boundary(){current.session={...current.session,view:{...current.session.view,branch:current.session.view.branch+1,revision:current.session.view.revision+1}};return paint();},
 switch(phase){current.state=structuredClone(snapshots[phase]);current.session=sessionFor(current.state,{...current.options,seatId:current.seatId,branch:current.session.view.branch});return paint();},
 validate(){if(window.commands.length!==1)throw new Error('Expected exactly one command, got '+window.commands.length);const command=window.commands[0];if(command.type==='game'){if(command.decisionId!==current.session.view.decisionId)throw new Error('Stale decision submitted');if(!current.session.view.actions.some(a=>JSON.stringify(a)===JSON.stringify(command.action)))throw new Error('Illegal action submitted');validateState(rules.apply(structuredClone(current.state),command.action,current.seatId,ctx).state,ids);}else if(command.type==='lifecycle'){if(!current.session.canControl)throw new Error('Unauthorized lifecycle');validateState(rules.applyLifecycle(structuredClone(current.state),command.action,ctx).state,ids);}else if(command.type==='replay'){if(!current.session.canControl)throw new Error('Unauthorized replay');}else throw new Error('Unexpected command '+command.type);return command;},
 commit(){const command=this.validate();if(command.type==='game')current.state=validateState(rules.apply(current.state,command.action,current.seatId,ctx).state,ids);else if(command.type==='lifecycle')current.state=validateState(rules.applyLifecycle(current.state,command.action,ctx).state,ids);else throw new Error('Cannot commit '+command.type);current.session=sessionFor(current.state,{...current.options,seatId:current.seatId,branch:current.session.view.branch});window.commands=[];return paint();},
 info,
};
window.harbor.load();
`,
);

const inputFiles = [
  'games/manila/ui/Board.tsx',
  'games/manila/ui/PlayerControls.tsx',
  'games/manila/ui/interaction.tsx',
  'games/manila/ui/useBoardAnchor.ts',
  'games/manila/ui/style.css',
  'games/manila/ui/theme.css',
  'games/manila/ui/host-layout.css',
  'games/manila/ui/harbor-layout.css',
  'games/manila/web/index.tsx',
  'apps/web/src/session/gameHostAdapter.tsx',
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fingerprint = async () =>
  Object.fromEntries(
    await Promise.all(
      inputFiles.map(async (name) => [name, sha(await readFile(name))]),
    ),
  );
const report = {
  result: 'running',
  output,
  selected,
  widths,
  verifierSha256: sha(source),
  scope:
    'Actual React Manila through PlatformGame. Legal-play rule projections with controlled transport flags and branch synchronization; tie is explicitly controlled and state-validated. Muted hidden Edge on loopback with Android touch emulation. No real service transport, physical keyboard/phone, OS DPI, installer or natural tied-match acceptance claim.',
  inputsBefore: await fingerprint(),
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
const sizes = [
  [320, 568],
  [390, 844],
  [430, 932],
  [844, 390],
];
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
      assert((await owner.evaluate((n) => n.scrollTop)) > 0);
      const box = await arrow(0, 1).boundingBox();
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
      const data = await page.locator('.mn-seat').evaluateAll((ns) =>
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
      const ranks = await page
        .locator('.mn-seat-result > span')
        .allTextContents();
      assert.equal(ranks.length, 5);
      assert.equal(new Set(ranks).size, 1, 'Tied wealth has identical rank');
      const rootBounds = await row();
      assert(rootBounds.scrollWidth <= width + 1);
      await page.locator('.mn-players-panel').scrollIntoViewIfNeeded();
      await shot('controlled-tie');
      report.metrics.push({
        width,
        kind: 'controlled-valid-tie',
        players: data,
        ranks,
      });
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
    const priority = [
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
  report.changedInputs = inputFiles.filter(
    (name) => report.inputsBefore[name] !== report.inputsAfter[name],
  );
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
