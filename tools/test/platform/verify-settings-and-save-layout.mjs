import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../support/screenshots.mjs';

assertWorkspaceRoot();
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const evidence = process.argv
  .find((x) => x.startsWith('--evidence='))
  ?.slice(11);
assert.match(evidence ?? '', /^[a-z0-9-]{1,65}$/);
const only =
  process.argv
    .find((arg) => arg.startsWith('--only='))
    ?.slice(7)
    .split(',') ?? [];
assert(
  only.every((group) =>
    [
      'box',
      'settings',
      'settings-layout',
      'seat-names',
      'name-limits',
      'management-layout',
      'connection-layout',
      'save-layout',
      'sound',
      'mobile',
      'icons',
      'effects',
    ].includes(group),
  ),
);
const output = resolve(
  'artifacts/maintenance/settings-and-save-20261020',
  evidence,
);
await mkdir(resolve('artifacts/maintenance/settings-and-save-20261020'), {
  recursive: true,
});
await mkdir(output, { recursive: false });
const work = join(output, 'fixture');
await mkdir(work);
const file = (path) => JSON.stringify(resolve(path));
const games = [
  'pokemon-encounters',
  'expansion',
  'modern-art',
  'power-grid',
  'rummikub',
  'uno',
  'avalon',
  'manila',
];
const selectedGames =
  process.argv
    .find((arg) => arg.startsWith('--games='))
    ?.slice(8)
    .split(',') ?? [];
assert(selectedGames.every((game) => game === 'box' || games.includes(game)));
const source = (id) =>
  id === 'expansion' ? 'games/pokemon-encounters/expansion' : `games/${id}`;
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
import {BoxScreen} from ${file('apps/web/src/screens/BoxScreen.tsx')};
import {useSoundPreference} from ${file('packages/web-host/src/index.tsx')};
import {useRoomSession} from ${file('apps/web/src/session/useRoomSession.ts')};
import {RoomViewSchema} from ${file('packages/protocol/src/index.ts')};
import {RoomManagement} from ${file('apps/web/src/components/RoomManagement.tsx')};
import {OverlayPanel} from ${file('apps/web/src/components/OverlayPanel.tsx')};
import type {DisplaySnapshot, WindowMode} from ${file('apps/desktop/src/display-types.ts')};
import {AbilityIcon} from ${file('games/pokemon-encounters/ui/AbilityIcon.tsx')};
import {AbilityLegend} from ${file('games/pokemon-encounters/ui/RuleDiagrams.tsx')};
import ${file('apps/web/src/styles.css')};
import ${file('apps/web/src/screens/box-screen.css')};
import ${file('apps/web/src/scrollbars.css')};
${games.map((id, i) => `import {client as client${i}} from ${file(source(id) + '/web/index.tsx')};\nimport {rules as rules${i}} from ${file(source(id) + (id === 'expansion' ? '/index.ts' : '/rules/index.ts'))};`).join('\n')}
const entries={${games.map((id, i) => `${JSON.stringify(id)}:{client:client${i},rules:rules${i}}`).join(',')}};
const root=createRoot(document.getElementById('root'));
const noop=()=>{};
let current;
function Probe(){const [enabled,setEnabled]=useSoundPreference();window.setSound=setEnabled;return <output data-sound-probe={enabled?'on':'off'} hidden/>;}
function sessionFor(key,role){
 const count=key==='rummikub'?4:5;
 const ids=Array.from({length:count},(_,i)=>'s'+i);
 const seats=ids.map((id,i)=>({id,name:i===0?'阿明abcdefghijkl':('玩家'+i),avatarId:'avatar-'+(i+1),controller:'human',ready:true,online:true,botDifficulty:null}));
 const entry=entries[key]??entries.manila;
 let seed=1257;const context={seats:ids,random:{next:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}};
 let state=entry.rules.initialize(context);
 for(let n=0;n<12&&!entry.rules.project(state,{role:'public'}).latest;n++){
  const actor=ids.find(id=>entry.rules.legalActions(state,id).length);
  if(!actor)break;
  state=entry.rules.apply(state,entry.rules.legalActions(state,actor)[0],actor,context).state;
 }
 const actor=ids.find(id=>entry.rules.legalActions(state,id).length)??ids[0];
 const projected=entry.rules.project(state,role==='player'?{role:'player',seatId:actor}:{role:'public'});
 return {role,credential:"fixture",canManageSeats:role==="host",isHost:role==='host',self:role==='player'?seats.find(s=>s.id===actor):undefined,connected:true,locked:false,busy:false,canControl:role==='host',message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],saved:false,submitting:false,name:'',setName:noop,command:noop,retry:noop,retryAdmission:noop,subscribeInteractions:()=>noop,subscribeInteractionReset:()=>noop,addresses:[],adapters:[],port:38473,catalog:[],games:[],address:'',joinUrl:'',view:{instanceId:'settings-'+key+'-'+role,branch:0,revision:1,status:key==='box'?'lobby':'playing',paused:false,playMode:'play',game:{...entry.rules.manifest,decisionTimer:true},gameView:key==='box'?null:projected,decisionId:entry.rules.decisions(state)[0]?.id??null,countdownSeconds:30,decisionClock:null,actions:role==='player'?entry.rules.legalActions(state,actor):[],lifecycleActions:[],catalog:Object.values(entries).map(e=>e.rules.manifest),seats,history:[],ownerSeatId:ids[0],joinOpen:true},client:entry.client};
}
function paint(){const key=current.session.fixtureKey??current.key+'-'+current.session.role;flushSync(()=>root.render(<><Probe/>{current.key==='box'?<BoxScreen key={key} session={current.session}/>:<PlatformGame key={key} session={current.session} client={current.session.client}/>}</>));}
let renderSequence=0;
window.renderGame=(key,role)=>{history.replaceState(null,'','/'+role+(key==='box'?'':'/game'));const session=sessionFor(key,role);session.fixtureKey='case-'+key+'-'+(++renderSequence);current={key,session};paint();};
function GuestNameBox(){const [name,setName]=React.useState('');const session={...sessionFor('box','player'),credential:'',self:undefined,name,setName,join:()=>{window.guestJoinCount=(window.guestJoinCount??0)+1;}};return <BoxScreen session={session}/>;}
window.renderNameLimits=()=>{history.replaceState(null,'','/player');flushSync(()=>root.render(<GuestNameBox key={'guest-'+(++renderSequence)}/>));};
window.configureNativeSettings=(enabled)=>{
 window.nativeSettingsCalls={display:[],window:[]};
 if(!enabled){delete window.tablemaxDisplay;delete window.tablemaxWindow;return;}
 let snapshot:DisplaySnapshot={preferences:{resolution:'auto',interfaceScale:100},viewport:{width:innerWidth,height:innerHeight},screen:{width:1920,height:1080,scaleFactor:1.25},zoomFactor:1,limited:false};
 let mode:WindowMode='windowed';
 window.tablemaxDisplay={read:async()=>snapshot,subscribe:()=>noop,update:async preferences=>{window.nativeSettingsCalls.display.push({...preferences});snapshot={...snapshot,preferences:{...preferences}};return snapshot;}};
 window.tablemaxWindow={read:async()=>({mode,fullscreen:mode==='fullscreen'}),subscribe:()=>noop,setMode:async next=>{window.nativeSettingsCalls.window.push(next);mode=next;return {mode,fullscreen:mode==='fullscreen'};},setFullscreen:async enabled=>{mode=enabled?'fullscreen':'windowed';return {mode,fullscreen:enabled};}};
};
function SeatNamesBox({role}){const session=useRoomSession(role);window.seatLiveSession=session;return <BoxScreen session={session}/>;}
window.renderConnection=role=>{
 history.replaceState(null,'','/'+role);
 const session=sessionFor('box',role);session.fixtureKey='connection-'+(++renderSequence);
 session.addresses=['127.0.0.1'];session.adapters=[{address:'127.0.0.1',name:'本机回环地址',kind:'loopback'}];session.address='127.0.0.1';session.externalJoinUrl=null;session.networkMessage='';session.setAddress=noop;session.refreshNetwork=async()=>{};
 window.connectionCalls=[];
 session.saveExternalJoinUrl=value=>{window.connectionCalls.push(value);return new Promise(resolve=>{window.finishConnectionSave=success=>{current.session={...current.session,externalJoinUrl:success?value:current.session.externalJoinUrl,networkMessage:success?'':'外部入口保存失败，请重试。'};paint();resolve(success);};});};
 current={key:'box',session};window.setConnectionExternal=value=>{current.session={...current.session,externalJoinUrl:value};paint();};paint();
};
window.renderManagement=({status,full=false})=>{
 history.replaceState(null,'','/host');
 const session=sessionFor('box','host');
 session.fixtureKey='management-'+(++renderSequence);
 session.view={...session.view,status,ownerSeatId:'s0',self:{role:'host',seatId:null},capabilities:{manage:true,control:true,manageSeats:true},transferRequests:[],history:[{id:'checkpoint-one',label:'检查点一',revealedInformation:false,step:1,seatId:'s0',roundNumber:1},{id:'checkpoint-two',label:'检查点二',revealedInformation:true,step:2,seatId:'s1',roundNumber:1}],seats:session.view.seats.map((seat,index)=>({...seat,name:index===0?'长'.repeat(8):index===1?'WWWWWWWWWWWWWWWW':seat.name}))};
 window.managementCommands=[];
 const paintManagement=()=>{if(full)flushSync(()=>root.render(<OverlayPanel key={session.fixtureKey} title="共享管理组件" className="settings-panel settings-panel--management" close={noop}><RoomManagement session={current.session}/></OverlayPanel>));else paint();};
 session.command=command=>{window.managementCommands.push(structuredClone(command));if(command.type==='set-owner')current.session={...current.session,view:{...current.session.view,ownerSeatId:command.seatId}};if(command.type==='approve-transfer'||command.type==='reject-transfer')current.session={...current.session,view:{...current.session.view,transferRequests:current.session.view.transferRequests.filter(request=>request.requestId!==command.requestId)}};paintManagement();};
 current={key:'box',session};
 window.setManagementRequests=()=>{current.session={...current.session,view:{...current.session.view,transferRequests:[{requestId:'transfer-one',seatId:'s0',verificationCode:'123456',expiresAt:Date.now()+120000},{requestId:'transfer-two',seatId:'s1',verificationCode:'654321',expiresAt:Date.now()+120000}]}};paintManagement();};
 paintManagement();
};
window.renderSeatNames=({role,owner,status})=>{
 history.replaceState(null,'','/'+role);
 sessionStorage.setItem('tablemax-host','seat-host-fixture');localStorage.setItem('tablemax-player','seat-player-fixture');
 const self=role==='player'?(owner?'s0':'s1'):null;
 const view=RoomViewSchema.parse({instanceId:'00000000-0000-4000-8000-000000000001',revision:1,branch:0,status,paused:false,restored:false,joinOpen:true,playMode:'play',countdownSeconds:30,decisionClock:null,game:{id:'uno',name:'UNO',min:2,max:6,decisionTimer:true},catalog:[],ownerSeatId:'s0',capabilities:{manage:role==='host',control:role==='host'||owner,manageSeats:role==='host'||role==='player'&&owner},seats:[{id:'s0',name:'长'.repeat(8),avatarId:'avatar-1',controller:'human',ready:true,online:true,botDifficulty:null},{id:'s1',name:'WWWWWWWWWWWWWWWW',avatarId:'avatar-2',controller:'human',ready:true,online:true,botDifficulty:null},{id:'s2',name:'人机朋友',avatarId:'avatar-3',controller:'bot',ready:true,online:true,botDifficulty:'default'}],self:{role,seatId:self},gameView:null,decisionId:null,selectionToken:null,actions:[],lifecycleActions:[],history:[],botError:null,endReason:null});
 window.seatFixtureProjection={stamp:{serverSessionId:'00000000-0000-4000-8000-000000000002',instanceId:view.instanceId,branch:0,viewSeq:1},syncHint:'idle',interactionWatermark:0,view};
 window.seatFixtureCommands=[];
 flushSync(()=>root.render(<SeatNamesBox key={'seat-names-'+(++renderSequence)} role={role}/>));
};
window.setSaved=enabled=>{current.session={...current.session,message:enabled?'已保存':'',messageKind:enabled?'saved':'none',saved:enabled};paint();};
let discardSequence=0;
window.renderDiscard=key=>{
 const entry=entries[key],ids=['s0','s1','s2','s3','s4'];
 for(let attempt=1;attempt<=50;attempt++){
  let seed=attempt;const context={seats:ids,random:{next:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}};
  let state=entry.rules.initialize(context);
  for(let i=0;i<40&&state.phase!=='draw';i++){const actor=ids.find(id=>entry.rules.legalActions(state,id).length);if(!actor)break;state=entry.rules.apply(state,entry.rules.legalActions(state,actor)[0],actor,context).state;}
  if(state.phase!=='draw')continue;
  const actor=state.turnSeat,draw=entry.rules.legalActions(state,actor).find(a=>a.type==='draw'&&a.source==='deck');if(!draw)continue;
  const held=entry.rules.apply(state,draw,actor,context).state;
  const discard=entry.rules.legalActions(held,actor).find(a=>a.type==='discard-held');if(!discard)continue;
  const result=entry.rules.apply(held,discard,actor,context),session=sessionFor(key,'host');
  const before=entry.rules.project(held,{role:'public'}),after=entry.rules.project(result.state,{role:'public'});
  session.fixtureKey='discard-'+key+'-'+(++discardSequence);session.view={...session.view,instanceId:session.fixtureKey,revision:100,gameView:before};
  current={key,session};paint();
  window.commitDiscard=()=>{current.session={...session,motion:entry.client.savedChanges(before,after),feedback:{instanceId:session.view.instanceId,branch:0,revision:101,events:result.events},view:{...session.view,revision:101,gameView:after}};paint();};
  window.restoreDiscard=()=>{current.session={...current.session,fixtureKey:'restored-'+(++discardSequence),feedback:null,motion:[]};paint();};
  return;
 }
 throw new Error('No legal direct discard fixture '+key);
};
window.renderIcons=()=>flushSync(()=>root.render(<main style={{background:'#fff8e8',padding:24}}><AbilityLegend expansion/>{[18,20,22].map(size=><div key={size} style={{display:'flex',gap:20,margin:16}}>{['mandatory','optional','mixed'].map(kind=><span key={kind} className="pokemon-card" style={{display:'block',width:size,height:size,minWidth:0,minHeight:0,border:0,padding:0,boxSizing:'content-box'}}><AbilityIcon kind={kind}/></span>)}</div>)}</main>));
window.renderGame('box','host');
`,
);
const report = {
  scope:
    'Current source UI fixtures with legal rule projections; no installed-runtime, physical-device or network proof.',
  parameters: process.argv.slice(2),
  result: 'running',
  checks: [],
  failures: [],
  errors: [],
  pending: [],
  excluded: [],
  inputs: {},
  screenshots: [],
  fixtureBoundaries: [
    'Seat-name cases use the real useRoomSession pending/locked guards with a controlled Socket.IO transport and schema-validated projections/ACKs. They do not prove server authorization, durable persistence, joining or physical devices.',
    'Connection-layout cases render real BoxScreen/InviteFriends and control saveExternalJoinUrl promises. They prove UI composition, draft state, native form validation and callback arguments, not backend persistence, reachable external hosts, actual LAN connections or firewall behavior.',
  ],
};
await writeFile(
  join(work, 'seat-socket.ts'),
  `
export function io(){
 const handlers=new Map();
 const socket={connected:true,io:{engine:{transport:{name:'fixture'},on(){}}},on(event,listener){handlers.set(event,listener);return socket;},timeout(){return socket;},removeAllListeners(){handlers.clear();},disconnect(){socket.connected=false;handlers.get('disconnect')?.();return socket;},connect(){socket.connected=true;queueMicrotask(()=>handlers.get('connect')?.());return socket;},emit(event,...args){
  const callback=args.at(-1),projection=window.seatFixtureProjection;
  if(event==='room:sync')queueMicrotask(()=>callback(null,{ok:true,...projection}));
  else if(event==='room:probe')queueMicrotask(()=>callback(null,{ok:true,unchanged:true,stamp:projection.stamp,syncHint:projection.syncHint,interactionWatermark:0}));
  else if(event==='room:command:status')queueMicrotask(()=>callback(null,{ok:true,...projection,outcome:{status:'unknown'}}));
  else if(event==='room:command'){
   const envelope=args[0];window.seatFixtureCommands.push(structuredClone(envelope));
   window.finishSeatName=(outcome)=>{
    if(outcome==='pending'){callback(new Error('Controlled unconfirmed acknowledgement'),null);return;}
    if(outcome==='error'){callback(null,{ok:false,reason:'save-failed'});return;}
    const next=window.seatFixtureProjection;
    next.view={...next.view,revision:next.view.revision+1,seats:next.view.seats.map(seat=>seat.id===envelope.command.seatId?{...seat,name:envelope.command.name}:seat)};
    next.stamp={...next.stamp,viewSeq:next.stamp.viewSeq+1};handlers.get('room:view')?.(next);
    callback(null,{ok:true,revision:next.view.revision,branch:next.view.branch});
   };
  }
  return socket;
 }};
 queueMicrotask(()=>handlers.get('connect')?.());return socket;
}
`,
);
async function assertSettingRowsAndHelp(page, { touch = false } = {}) {
  const labels = page.locator('.dialog-surface .setting-help__label');
  assert((await labels.count()) > 0, 'Settings expose concise help labels');
  for (let index = 0; index < (await labels.count()); index++) {
    const label = labels.nth(index);
    const name = await label.textContent();
    const geometry = await label.evaluate((node) => {
      const row = node.closest('.setting-help').parentElement;
      const control = row.querySelector('input, select, [role="switch"]');
      if (!control || row.classList.contains('game-setup-settings'))
        return null;
      const a = node.getBoundingClientRect(),
        b = control.getBoundingClientRect();
      return {
        sameLine: Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top),
        separate: a.right <= b.left + 1,
        residentDescription: [...row.querySelectorAll('p, small')].some(
          (item) =>
            !item.closest(
              '.setting-help__tip, [role="status"], [role="alert"]',
            ),
        ),
      };
    });
    if (geometry) {
      assert(
        geometry.sameLine && geometry.separate,
        `${name}: label and control share one row`,
      );
      assert(
        !geometry.residentDescription,
        `${name}: long explanation is not resident`,
      );
    }
    const reset = async () => {
      await label.evaluate((node) => node.blur());
      await page.mouse.move(0, 0);
    };
    const readable = async (interaction) => {
      const tip = label.locator('..').locator('.setting-help__tip');
      await tip.waitFor({ state: 'visible', timeout: 3000 });
      assert(
        (await tip.textContent()).trim().length > 0,
        `${name}: ${interaction} help contains text`,
      );
      assert.equal(
        await label.getAttribute('aria-describedby'),
        await tip.getAttribute('id'),
      );
      const metrics = await tip.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
          font: Number.parseFloat(getComputedStyle(node).fontSize),
          inside:
            rect.x >= 0 &&
            rect.y >= 0 &&
            rect.right <= innerWidth + 1 &&
            rect.bottom <= innerHeight + 1,
          unclipped:
            node.scrollHeight <= node.clientHeight + 1 &&
            node.scrollWidth <= node.clientWidth + 1,
        };
      });
      assert(
        metrics.font >= 16 && metrics.inside && metrics.unclipped,
        `${name}: ${interaction} help is readable within viewport`,
      );
    };
    await reset();
    assert.equal(
      await label.locator('..').locator('.setting-help__tip').count(),
      0,
      `${name}: help starts closed`,
    );
    await label.hover();
    await readable('hover');
    await reset();
    await label.focus();
    await readable('focus');
    await label.press('Escape');
    assert.equal(
      await label.locator('..').locator('.setting-help__tip').count(),
      0,
      `${name}: Escape closes help`,
    );
    assert(await label.isVisible(), 'Escape leaves the settings dialog open');
    await reset();
    if (touch) await label.tap();
    else await label.click();
    await readable(touch ? 'tap' : 'click');
    await reset();
  }
}
const bindInput = async (path) => {
  report.inputs[relative(process.cwd(), path).replaceAll('\\', '/')] =
    createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
};
let browser, server;
try {
  await build({
    configFile: false,
    root: work,
    logLevel: 'warn',
    plugins: [
      react(),
      {
        name: 'bind-verified-source',
        async generateBundle() {
          for (const id of this.getModuleIds()) {
            const path = id.split('?')[0];
            if (
              !path.includes('\0') &&
              !path.includes('node_modules') &&
              !path.startsWith(output) &&
              existsSync(path)
            )
              await bindInput(path);
          }
          for (const path of [
            'tools/test/platform/verify-settings-and-save-layout.mjs',
            'tools/test/support/browser-test.mjs',
            'tools/test/support/fixture-server.mjs',
            'pnpm-lock.yaml',
            'package.json',
            'apps/desktop/src/display-types.ts',
          ])
            await bindInput(resolve(path));
        },
      },
    ],
    resolve: {
      alias: {
        react: resolve('apps/web/node_modules/react'),
        'react-dom': resolve('apps/web/node_modules/react-dom'),
        'socket.io-client': join(work, 'seat-socket.ts'),
      },
    },
    build: {
      outDir: join(work, 'bundle'),
      emptyOutDir: false,
      target: ['chrome110', 'safari16'],
    },
  });
  server = await serveFixture(join(work, 'bundle'));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  report.environment = {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    browser: browser.version(),
    channel: 'msedge',
    hidden: true,
    muted: true,
    listen: '127.0.0.1',
  };
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.goto(server.url);
  await page.waitForFunction(() => typeof window.renderGame === 'function');
  const check = async (id, action) => {
    const target = id.startsWith('effects:')
      ? id.split(':')[1]
      : id.split(':')[0];
    if (
      selectedGames.length &&
      (target === 'box' || games.includes(target)) &&
      !selectedGames.includes(target)
    ) {
      report.excluded.push(id);
      return;
    }
    if (only.length && !only.some((group) => id.split(':').includes(group))) {
      report.excluded.push(id);
      return;
    }
    if (report.failures.length >= 10) {
      report.pending.push(id);
      return;
    }
    try {
      await action();
      report.checks.push({ id, result: 'passed' });
    } catch (error) {
      report.failures.push({ id, error: error.message });
      await captureBrowserScreenshot(page, {
        path: join(output, 'failure-' + id.replaceAll(':', '-') + '.png'),
        fullPage: true,
      }).catch(() => undefined);
    }
  };
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1280, 900],
  ]) {
    await check(`box:player:${width}:name-limits`, async () => {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.renderNameLimits());
      const input = page.getByLabel('你的昵称', { exact: true });
      const joinButton = page.getByRole('button', {
        name: '加入',
        exact: true,
      });
      for (const value of [
        '中文名字一共九个字',
        'abcdefghijklmnopq',
        '阿明abcdefghijklm',
        'dad dad dad dad',
      ]) {
        await input.fill(value);
        assert.equal(
          await input.inputValue(),
          value,
          'Overlength input is explained, not silently truncated',
        );
        assert(await joinButton.isDisabled());
        assert.equal(await input.getAttribute('aria-invalid'), 'true');
      }
      for (const value of [
        '中文名字一共八字',
        'abcdefghijklmnop',
        '阿明abcdefghijkl',
        '👨‍👩‍👧‍👦'.repeat(8),
      ]) {
        await input.fill(value);
        assert(await joinButton.isEnabled(), 'Boundary nickname is accepted');
      }
      const hint = await page.locator('#nickname-length-hint').boundingBox();
      assert(hint && hint.x >= 0 && hint.x + hint.width <= width + 1);
      const path = join(output, `name-limits-player-${width}.png`);
      await captureBrowserScreenshot(page, { path, fullPage: true });
      report.screenshots.push({ path, width, height, panel: 'name-limits' });
    });
  }
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1280, 900],
  ])
    for (const role of ['host']) {
      await check(`box:${role}:${width}:connection-layout`, async () => {
        const connectionContext = await browser.newContext({
          viewport: { width, height },
          hasTouch: true,
          reducedMotion: 'reduce',
        });
        const connectionPage = await connectionContext.newPage();
        connectionPage.on('pageerror', (error) =>
          report.errors.push(error.message),
        );
        const open = async () => {
          await connectionPage
            .getByRole('button', { name: '连接帮助', exact: true })
            .click();
          await connectionPage
            .locator('.settings-panel--connection')
            .waitFor({ state: 'visible' });
        };
        const screenshot = async (panel) => {
          const path = join(
            output,
            `connection-layout-${role}-${width}-${panel}.png`,
          );
          await captureBrowserScreenshot(connectionPage, {
            path,
            fullPage: true,
          });
          report.screenshots.push({
            role,
            width,
            height,
            panel: 'connection-' + panel,
            path,
          });
        };
        const geometry = async () => {
          const result = await connectionPage
            .locator(
              '.settings-panel--connection,.connection-help__url,.connection-help__external,input[name="external-entry"]',
            )
            .evaluateAll((nodes) =>
              nodes.map((node) => {
                const rect = node.getBoundingClientRect();
                return {
                  inside: rect.left >= 0 && rect.right <= innerWidth + 1,
                  unclipped:
                    node instanceof HTMLInputElement ||
                    node.scrollWidth <= node.clientWidth + 1,
                };
              }),
            );
          assert(result.length > 0);
          for (const item of result)
            assert(
              item.inside && item.unclipped,
              'Connection cards and long URLs fit the viewport without horizontal clipping',
            );
        };
        const help = async () => {
          const labels = connectionPage.locator(
            '.settings-panel--connection .setting-help__label',
          );
          assert(
            (await labels.count()) > 0,
            'Connection explanations use help labels',
          );
          for (let index = 0; index < (await labels.count()); index++) {
            const label = labels.nth(index);
            const reset = async () => {
              await label.evaluate((node) => node.blur());
              await connectionPage.mouse.move(0, 0);
            };
            const readable = async () => {
              const tip = label.locator('..').locator('.setting-help__tip');
              await tip.waitFor({ state: 'visible' });
              assert((await tip.textContent()).trim().length > 0);
              assert.equal(
                await label.getAttribute('aria-describedby'),
                await tip.getAttribute('id'),
              );
              assert(
                await tip.evaluate((node) => {
                  const rect = node.getBoundingClientRect();
                  return (
                    parseFloat(getComputedStyle(node).fontSize) >= 16 &&
                    rect.left >= 0 &&
                    rect.top >= 0 &&
                    rect.right <= innerWidth + 1 &&
                    rect.bottom <= innerHeight + 1 &&
                    node.scrollHeight <= node.clientHeight + 1 &&
                    node.scrollWidth <= node.clientWidth + 1
                  );
                }),
                'Connection help is readable and within the viewport',
              );
            };
            await reset();
            await label.hover();
            await readable();
            await reset();
            await label.focus();
            await readable();
            await label.press('Escape');
            assert.equal(
              await label.locator('..').locator('.setting-help__tip').count(),
              0,
            );
            assert(
              await label.isVisible(),
              'Escape only closes connection help tooltip',
            );
            await reset();
            await label.tap();
            await readable();
            await reset();
          }
        };
        try {
          await connectionPage.goto(server.url);
          await connectionPage.waitForFunction(
            () => typeof window.renderConnection === 'function',
          );
          await connectionPage.evaluate(
            (role) => window.renderConnection(role),
            role,
          );
          await open();
          const panel = connectionPage.locator('.settings-panel--connection');
          await panel
            .getByText(/手机无法通过此地址加入/)
            .waitFor({ state: 'visible' });
          await help();
          await geometry();
          const details = panel.locator('.connection-help__troubleshooting');
          await details.locator('summary').click();
          assert.equal(await details.getAttribute('open'), '');
          assert(
            (await details.textContent()).includes('TableMax'),
            'Loopback troubleshooting retains the running-service guidance',
          );
          assert(
            (await details.textContent()).includes('原浏览器'),
            'Troubleshooting retains seat recovery guidance',
          );
          await screenshot('loopback');
          const longUrl =
            'https://' +
            [
              'a'.repeat(60),
              'b'.repeat(60),
              'c'.repeat(60),
              'example',
              'test',
            ].join('.') +
            ':12345';
          const prefix = panel.getByRole('button', {
              name: '网址前缀',
              exact: true,
            }),
            input = panel.locator('input[name="external-entry"]');
          const assertPrefix = async (text) =>
            assert(
              (await prefix.textContent()).includes(text),
              `Prefix displays ${text}`,
            );
          await assertPrefix('无前缀');
          assert.equal(await input.getAttribute('type'), 'url');
          await input.fill('https://switch.example.test/path');
          await prefix.click();
          await assertPrefix('http://');
          assert.equal(
            await input.inputValue(),
            'switch.example.test/path',
            'Choosing http strips any previous complete protocol',
          );
          await prefix.click();
          await assertPrefix('https://');
          await prefix.click();
          await assertPrefix('无前缀');
          const bare = 'bare.example.test:12345';
          await input.fill(bare);
          assert.equal(await input.inputValue(), bare);
          assert.equal(
            await input.evaluate((node) => node.checkValidity()),
            false,
            'Bare address is invalid with no prefix',
          );
          await panel
            .getByRole('button', { name: '保存外部入口', exact: true })
            .click();
          assert.deepEqual(
            await connectionPage.evaluate(() => window.connectionCalls),
            [],
            'No prefix never silently supplies a protocol',
          );
          await prefix.click();
          await assertPrefix('http://');
          assert.equal(await input.getAttribute('type'), 'text');
          const a = await prefix.boundingBox(),
            b = await input.boundingBox();
          assert(
            a &&
              b &&
              a.x + a.width <= b.x + 1 &&
              Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y),
            'Prefix button precedes input on the same row',
          );
          await panel
            .getByRole('button', { name: '保存外部入口', exact: true })
            .click();
          assert.deepEqual(
            await connectionPage.evaluate(() => window.connectionCalls),
            ['http://' + bare],
          );
          assert(
            (await prefix.isDisabled()) && (await input.isDisabled()),
            'Prefix and input are disabled during save',
          );
          await connectionPage.evaluate(() =>
            window.finishConnectionSave(true),
          );
          await panel
            .getByText('二维码已更新。', { exact: true })
            .waitFor({ state: 'visible' });
          await input.waitFor({ state: 'visible' });
          await connectionPage.keyboard.press('Escape');
          await open();
          await assertPrefix('http://');
          assert.equal(
            await input.inputValue(),
            bare,
            'Saved URL reopens as protocol and body',
          );
          await prefix.click();
          await assertPrefix('https://');
          await input.fill('http://pasted.example.test/entry');
          await assertPrefix('http://');
          assert.equal(
            await input.inputValue(),
            'pasted.example.test/entry',
            'Pasting a complete URL adopts its protocol without duplication',
          );
          await input.fill(longUrl);
          await assertPrefix('https://');
          assert.equal(await input.inputValue(), longUrl.slice(8));
          await panel
            .getByRole('button', { name: '保存外部入口', exact: true })
            .click();
          assert.deepEqual(
            await connectionPage.evaluate(() =>
              window.connectionCalls.slice(-1),
            ),
            [longUrl],
          );
          assert((await prefix.isDisabled()) && (await input.isDisabled()));
          await connectionPage.evaluate(() =>
            window.finishConnectionSave(false),
          );
          await connectionPage.waitForFunction(
            () =>
              !document.querySelector('input[name="external-entry"]').disabled,
          );
          await assertPrefix('https://');
          assert.equal(
            await input.inputValue(),
            longUrl.slice(8),
            'Failed save retains the complete draft body',
          );
          await panel
            .getByText('外部入口保存失败，请重试。', { exact: true })
            .waitFor({ state: 'visible' });
          await geometry();
          await screenshot('failed-draft');
          await panel
            .getByRole('button', { name: '保存外部入口', exact: true })
            .click();
          await connectionPage.evaluate(() =>
            window.finishConnectionSave(true),
          );
          await connectionPage.waitForFunction(
            () =>
              !document.querySelector('input[name="external-entry"]').disabled,
          );
          assert.equal(
            await panel.locator('.connection-help__url').textContent(),
            longUrl,
          );
          await geometry();
          await screenshot('long-url');
          await panel
            .getByRole('button', { name: '使用局域网', exact: true })
            .click();
          assert.equal(
            await connectionPage.evaluate(() => window.connectionCalls.at(-1)),
            null,
          );
          assert((await prefix.isDisabled()) && (await input.isDisabled()));
          await connectionPage.evaluate(() =>
            window.finishConnectionSave(true),
          );
          await connectionPage.waitForFunction(
            () =>
              !document.querySelector('input[name="external-entry"]').disabled,
          );
          await assertPrefix('无前缀');
          assert.equal(await input.inputValue(), '');
          assert.equal(await input.getAttribute('type'), 'url');
          await panel
            .getByText(/手机无法通过此地址加入/)
            .waitFor({ state: 'visible' });
          await screenshot('lan-restored');
        } catch (error) {
          await screenshot('failure').catch(() => undefined);
          throw error;
        } finally {
          await connectionContext.close();
        }
      });
    }
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1280, 900],
  ])
    for (const status of ['lobby', 'playing']) {
      await check(`box:${status}:${width}:management-layout`, async () => {
        const managementContext = await browser.newContext({
          viewport: { width, height },
          hasTouch: true,
          reducedMotion: 'reduce',
        });
        const managementPage = await managementContext.newPage();
        managementPage.on('pageerror', (error) =>
          report.errors.push(error.message),
        );
        const row = async (label, control) => {
          assert(
            await label.evaluate((node) =>
              Boolean(node.closest('.room-management-row')),
            ),
            'Management label belongs to a compact row',
          );
          assert(
            await control.evaluate((node) =>
              Boolean(node.closest('.room-management-row')),
            ),
            'Management control belongs to a compact row',
          );
          const a = await label.boundingBox(),
            b = await control.boundingBox();
          assert(
            a &&
              b &&
              Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y) &&
              a.x + a.width <= b.x + 1,
            'Management label and control share one row without overlap',
          );
        };
        const screenshot = async (panel) => {
          const path = join(
            output,
            `management-layout-${status}-${width}-${panel}.png`,
          );
          await captureBrowserScreenshot(managementPage, {
            path,
            fullPage: true,
          });
          report.screenshots.push({
            width,
            height,
            status,
            panel: 'management-' + panel,
            path,
          });
        };
        const unclipped = async (selector) => {
          for (const result of await managementPage
            .locator(selector)
            .evaluateAll((nodes) =>
              nodes.map((node) => {
                const rect = node.getBoundingClientRect();
                return (
                  rect.left >= 0 &&
                  rect.right <= innerWidth + 1 &&
                  node.scrollWidth <= node.clientWidth + 1
                );
              }),
            ))
            assert(
              result,
              'Management content and long names fit the available width',
            );
        };
        try {
          await managementPage.goto(server.url);
          await managementPage.waitForFunction(
            () => typeof window.renderManagement === 'function',
          );
          await managementPage.evaluate(
            (status) => window.renderManagement({ status }),
            status,
          );
          await managementPage
            .getByRole('button', { name: '管理设置', exact: true })
            .click();
          const panel = managementPage.locator('.settings-panel--management');
          await panel.waitFor({ state: 'visible' });
          assert.equal(
            await managementPage.locator('.seat-settings-row').count(),
            0,
            'This is the management settings panel, not seat settings',
          );
          const owner = managementPage.getByLabel('手机房主', { exact: true });
          const ownerLabel = panel.getByRole('button', {
            name: '手机房主',
            exact: true,
          });
          await row(ownerLabel, owner);
          const transferLabel = panel.getByRole('button', {
            name: '换机申请',
            exact: true,
          });
          await row(
            transferLabel,
            panel.locator('.device-transfer-requests__empty'),
          );
          await assertSettingRowsAndHelp(managementPage, { touch: true });
          assert.equal(
            await panel
              .getByRole('link', { name: '打开公共屏', exact: true })
              .count(),
            0,
          );
          if (status === 'playing') {
            const rollback = panel.getByRole('button', {
              name: '决策点回退（2）',
              exact: true,
            });
            await row(
              rollback.locator('..').getByText('决策点回退', { exact: true }),
              rollback,
            );
          }
          await owner.selectOption('s1');
          assert.deepEqual(
            await managementPage.evaluate(() => window.managementCommands),
            [{ type: 'set-owner', seatId: 's1' }],
          );
          assert.equal(await owner.inputValue(), 's1');
          await owner.selectOption('');
          assert.deepEqual(
            await managementPage.evaluate(() =>
              window.managementCommands.at(-1),
            ),
            { type: 'set-owner', seatId: null },
          );
          await unclipped(
            '.settings-panel--management,.owner-control,.device-transfer-requests',
          );
          await screenshot('empty');
          await managementPage.evaluate(() => window.setManagementRequests());
          const requests = panel.locator('.device-transfer-request');
          assert.equal(await requests.count(), 2);
          assert.equal(
            await requests
              .nth(0)
              .locator('.device-transfer-request__identity > strong')
              .textContent(),
            '长'.repeat(8),
          );
          assert.equal(
            await requests
              .nth(1)
              .locator('.device-transfer-request__identity > strong')
              .textContent(),
            'WWWWWWWWWWWWWWWW',
          );
          assert.equal(
            await requests
              .nth(0)
              .locator('.device-transfer-request__verification strong')
              .textContent(),
            '123456',
          );
          assert.equal(
            await requests
              .nth(1)
              .locator('.device-transfer-request__verification strong')
              .textContent(),
            '654321',
          );
          await unclipped(
            '.device-transfer-request,.device-transfer-request__identity',
          );
          await screenshot('requests');
          const before = await managementPage.evaluate(
            () => window.managementCommands.length,
          );
          await requests
            .nth(0)
            .getByRole('button', { name: '批准换机', exact: true })
            .click();
          const confirmation = managementPage.getByRole('dialog', {
            name: '批准换机',
            exact: true,
          });
          await confirmation.waitFor({ state: 'visible' });
          assert.equal(
            await confirmation
              .locator('.device-transfer-confirm-code')
              .textContent(),
            '123456',
          );
          await screenshot('approval-confirmation');
          await confirmation
            .getByRole('button', { name: '取消', exact: true })
            .click();
          assert.equal(
            await managementPage.evaluate(
              () => window.managementCommands.length,
            ),
            before,
            'Cancelling transfer approval sends nothing',
          );
          await requests
            .nth(0)
            .getByRole('button', { name: '批准换机', exact: true })
            .click();
          await managementPage
            .getByRole('button', { name: '批准并退出旧设备', exact: true })
            .click();
          assert.deepEqual(
            await managementPage.evaluate(
              (before) => window.managementCommands.slice(before),
              before,
            ),
            [{ type: 'approve-transfer', requestId: 'transfer-one' }],
          );
          assert.equal(await requests.count(), 1);
          await requests
            .nth(0)
            .getByRole('button', { name: '拒绝', exact: true })
            .click();
          assert.deepEqual(
            await managementPage.evaluate(
              (before) => window.managementCommands.slice(before),
              before,
            ),
            [
              { type: 'approve-transfer', requestId: 'transfer-one' },
              { type: 'reject-transfer', requestId: 'transfer-two' },
            ],
          );
          assert.equal(await requests.count(), 0);
          if (status === 'playing') {
            const prior = await managementPage.evaluate(
              () => window.managementCommands.length,
            );
            const openRollback = async () => {
              await panel
                .getByRole('button', { name: '决策点回退（2）', exact: true })
                .click();
              await managementPage
                .locator('.rollback-history')
                .getByRole('button', { name: /检查点二/ })
                .click();
            };
            await openRollback();
            const rollbackConfirm = managementPage.getByRole('dialog', {
              name: '确认回退',
              exact: true,
            });
            await rollbackConfirm.waitFor({ state: 'visible' });
            assert(
              (
                await rollbackConfirm
                  .locator('.confirmation-message')
                  .textContent()
              ).includes('检查点二'),
              'Rollback confirmation describes the selected checkpoint',
            );
            await rollbackConfirm
              .getByRole('button', { name: '取消', exact: true })
              .click();
            assert.equal(
              await managementPage.evaluate(
                () => window.managementCommands.length,
              ),
              prior,
            );
            await managementPage
              .locator('.rollback-history')
              .getByRole('button', { name: /检查点二/ })
              .click();
            await managementPage
              .getByRole('dialog', { name: '确认回退', exact: true })
              .getByRole('button', { name: '确认回退', exact: true })
              .click();
            assert.deepEqual(
              await managementPage.evaluate(
                (prior) => window.managementCommands.slice(prior),
                prior,
              ),
              [{ type: 'rollback', checkpointId: 'checkpoint-two' }],
            );
          }
          await managementPage.evaluate(
            (status) => window.renderManagement({ status, full: true }),
            status,
          );
          const full = managementPage.getByRole('dialog', {
            name: '共享管理组件',
            exact: true,
          });
          await full.waitFor({ state: 'visible' });
          await row(
            full.getByRole('button', { name: '手机房主', exact: true }),
            full.getByLabel('手机房主', { exact: true }),
          );
          await row(
            full.getByRole('button', { name: '换机申请', exact: true }),
            full.locator('.device-transfer-requests__empty'),
          );
          await assertSettingRowsAndHelp(managementPage, { touch: true });
          await screenshot('shared-full');
        } catch (error) {
          await screenshot('failure').catch(() => undefined);
          throw error;
        } finally {
          await managementContext.close();
        }
      });
    }
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1280, 900],
  ])
    for (const [role, owner] of [
      ['host', false],
      ['player', true],
      ['player', false],
    ])
      for (const status of ['lobby', 'playing']) {
        await check(
          `box:${role}:${owner ? 'owner' : 'member'}:${status}:${width}:seat-names`,
          async () => {
            await page.setViewportSize({ width, height });
            await page.route('**/api/room/network', (route) =>
              route.fulfill({
                json: {
                  addresses: [],
                  adapters: [],
                  port: 38473,
                  externalJoinUrl: null,
                },
              }),
            );
            await page.evaluate((options) => window.renderSeatNames(options), {
              role,
              owner,
              status,
            });
            await page.waitForFunction(
              () =>
                window.seatLiveSession?.connected &&
                window.seatLiveSession?.view,
            );
            const manager = page.getByRole('button', {
              name: '座位设置',
              exact: true,
            });
            const allowed = role === 'host' || owner;
            if (!allowed) {
              assert.equal(
                await manager.count(),
                0,
                'Ordinary players have no seat management entry',
              );
              assert.equal(
                await page.locator('.seat-settings-menu').count(),
                0,
              );
              assert.equal(
                await page.evaluate(() => window.seatFixtureCommands.length),
                0,
              );
              return;
            }
            const geometry = async (selector) => {
              const result = await page.locator(selector).evaluateAll((nodes) =>
                nodes.map((node) => {
                  const rect = node.getBoundingClientRect();
                  const within = rect.left >= 0 && rect.right <= innerWidth + 1;
                  const unclipped = node.scrollWidth <= node.clientWidth + 1;
                  const text = node.querySelector(
                    '.seat-settings-identity strong',
                  );
                  let textInside = true;
                  if (text) {
                    const range = document.createRange();
                    range.selectNodeContents(text);
                    const identity = text.parentElement.getBoundingClientRect();
                    textInside = [...range.getClientRects()].every(
                      (glyph) =>
                        glyph.left >= identity.left - 1 &&
                        glyph.right <= identity.right + 1,
                    );
                  }
                  return { within, unclipped, textInside };
                }),
              );
              assert(
                result.length > 0,
                `${selector}: real rendered geometry exists`,
              );
              for (const measured of result)
                assert(
                  measured.within && measured.unclipped && measured.textInside,
                  `${selector}: narrow layout and long names are not clipped`,
                );
            };
            await manager.click();
            await geometry('.seat-settings-row');
            const openRename = async (seatId) => {
              await page
                .locator(
                  `.seat-settings-row[data-seat-id="${seatId}"] .seat-settings-menu`,
                )
                .click();
              await page
                .getByRole('button', { name: '修改名称', exact: true })
                .click();
              const input = page.getByLabel('玩家名称', { exact: true });
              await input.waitFor({ state: 'visible' });
              await geometry('.seat-settings-rename-form');
              return input;
            };
            // Host manages every seat; the authorized owner includes their own s0 seat.
            for (const seatId of ['s0', 's1', 's2']) {
              const before = await page.evaluate(
                (seatId) => ({
                  count: window.seatFixtureCommands.length,
                  name: window.seatLiveSession.view.seats.find(
                    (seat) => seat.id === seatId,
                  ).name,
                }),
                seatId,
              );
              const input = await openRename(seatId);
              if (seatId === 's0') {
                const save = page.getByRole('button', {
                  name: '保存名称',
                  exact: true,
                });
                for (const value of [
                  '中文名字一共九个字',
                  'abcdefghijklmnopq',
                  'dad dad dad dad',
                ]) {
                  await input.fill(value);
                  assert(
                    await save.isDisabled(),
                    'Rename shares the submitted nickname limit',
                  );
                  assert.equal(
                    await input.getAttribute('aria-invalid'),
                    'true',
                  );
                }
                for (const value of [
                  '中文名字一共八字',
                  'abcdefghijklmnop',
                  '阿明abcdefghijkl',
                ]) {
                  await input.fill(value);
                  assert(
                    await save.isEnabled(),
                    'Boundary rename stays available',
                  );
                }
              }
              await input.fill('爸爸');
              assert.deepEqual(
                await page.evaluate(
                  (seatId) => ({
                    count: window.seatFixtureCommands.length,
                    name: window.seatLiveSession.view.seats.find(
                      (seat) => seat.id === seatId,
                    ).name,
                  }),
                  seatId,
                ),
                before,
                'Typing does not rename or send a command',
              );
              const save = page.getByRole('button', {
                name: '保存名称',
                exact: true,
              });
              await page.evaluate(() => {
                window.seatStaleCommand = window.seatLiveSession.command;
              });
              await save.dblclick();
              await page.waitForFunction(
                (count) => window.seatFixtureCommands.length === count + 1,
                before.count,
              );
              // Call the stale render's public command while ACK is held: the real hook's pending ref must reject it.
              await page.evaluate(
                (seatId) =>
                  window.seatStaleCommand({
                    type: 'set-seat-name',
                    seatId,
                    name: '重复提交',
                  }),
                seatId,
              );
              assert.equal(
                await page.evaluate(() => window.seatFixtureCommands.length),
                before.count + 1,
                'Double click and pending command cannot duplicate the rename',
              );
              assert.deepEqual(
                await page.evaluate(
                  () => window.seatFixtureCommands.at(-1).command,
                ),
                { type: 'set-seat-name', seatId, name: '儿子' },
              );
              assert.equal(
                await page.evaluate(() => window.seatLiveSession.locked),
                true,
                'Real session is locked before acknowledgement',
              );
              await page.evaluate(() => window.finishSeatName('saved'));
              await page.waitForFunction(
                (seatId) =>
                  !window.seatLiveSession.locked &&
                  window.seatLiveSession.view.seats.find(
                    (seat) => seat.id === seatId,
                  ).name === '儿子',
                seatId,
              );
              await geometry('.seat-settings-row');
            }
            const screenshot = async (suffix) => {
              const path = join(
                output,
                `seat-names-${role}-${owner ? 'owner' : 'member'}-${status}-${width}-${suffix}.png`,
              );
              await captureBrowserScreenshot(page, { path, fullPage: true });
              report.screenshots.push({
                role,
                owner,
                status,
                width,
                height,
                panel: 'seat-names-' + suffix,
                path,
              });
            };
            await screenshot('saved');
            const failed = await openRename('s1');
            await failed.fill('保存失败夹具');
            await page
              .getByRole('button', { name: '保存名称', exact: true })
              .click();
            await page.evaluate(() => window.finishSeatName('error'));
            await page.waitForFunction(
              () =>
                !window.seatLiveSession.locked &&
                window.seatLiveSession.messageKind === 'error',
            );
            const message = await page.evaluate(
              () => window.seatLiveSession.message,
            );
            const notice = page
              .locator('.tablemax-notice')
              .filter({ hasText: message });
            await notice.waitFor({ state: 'visible' });
            assert.equal(
              await page.evaluate(
                () =>
                  window.seatLiveSession.view.seats.find(
                    (seat) => seat.id === 's1',
                  ).name,
              ),
              '儿子',
              'Save rejection preserves the previous saved name',
            );
            await geometry('.tablemax-notice');
            await screenshot('error');
            await notice
              .getByRole('button', { name: '关闭提示', exact: true })
              .click();
            await notice.waitFor({ state: 'detached' });
            const pending = await openRename('s1');
            await pending.fill('待确认夹具');
            await page
              .getByRole('button', { name: '保存名称', exact: true })
              .click();
            await page.evaluate(() => window.finishSeatName('pending'));
            await page.waitForFunction(
              () => window.seatLiveSession.awaitingConfirmation,
            );
            const awaiting = page
              .locator('.tablemax-notice')
              .filter({ hasText: '尚未收到保存确认' });
            await awaiting.waitFor({ state: 'visible' });
            await geometry('.tablemax-notice');
            await awaiting
              .getByRole('button', { name: '关闭提示', exact: true })
              .click();
            await awaiting.waitFor({ state: 'detached' });
            await page.keyboard.press('Escape');
            const retry = page.getByRole('button', {
              name: '重试确认',
              exact: true,
            });
            await retry.scrollIntoViewIfNeeded();
            assert(
              (await retry.isVisible()) && (await retry.isEnabled()),
              'Pending confirmation exposes the existing retry control',
            );
            assert(
              await retry.evaluate((node) => {
                const rect = node.getBoundingClientRect();
                return node.contains(
                  document.elementFromPoint(
                    rect.x + rect.width / 2,
                    rect.y + rect.height / 2,
                  ),
                );
              }),
              'Pending confirmation retry is not covered',
            );
            await screenshot('pending');
          },
        );
      }
  for (const key of ['box', ...games])
    for (const role of ['host', 'player']) {
      await check(`${key}:${role}:settings`, async () => {
        await page.setViewportSize(
          role === 'player'
            ? { width: 390, height: 844 }
            : { width: 1280, height: 900 },
        );
        await page.evaluate(({ key, role }) => window.renderGame(key, role), {
          key,
          role,
        });
        if (key !== 'box') {
          const menu = page
            .getByRole('button', { name: /游戏菜单|菜单|管理与设置/ })
            .first();
          await menu.click({ timeout: 3000 });
        }
        await page
          .getByRole('button', { name: '游戏设置', exact: true })
          .click({ timeout: 3000 });
        const sound = page.getByRole('switch', { name: /声音/ });
        await sound.waitFor({ state: 'visible', timeout: 3000 });
        const was = await sound.getAttribute('aria-checked');
        await sound.click();
        assert.notEqual(await sound.getAttribute('aria-checked'), was);
        await assertSettingRowsAndHelp(page);
        await page.keyboard.press('Escape');
        await page
          .getByRole('button', { name: '视频设置', exact: true })
          .click({ timeout: 3000 });
        await page
          .getByText('显示模式', { exact: true })
          .waitFor({ timeout: 3000 });
        assert(
          (await page
            .locator('select')
            .filter({ has: page.locator('option[value="fullscreen"]') })
            .count()) > 0,
        );
        await assertSettingRowsAndHelp(page);
      });
    }
  for (const [key, role, native] of [
    ['box', 'host', true],
    ['uno', 'player', false],
  ])
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [1280, 900],
    ]) {
      await check(`${key}:${role}:${width}:settings-layout`, async () => {
        await page.setViewportSize({ width, height });
        await page.evaluate(
          ({ key, role, native }) => {
            window.configureNativeSettings(native);
            window.renderGame(key, role);
          },
          { key, role, native },
        );
        const screenshot = async (panel) => {
          await page
            .locator('.settings-panel--preferences')
            .evaluate((node) => {
              node.scrollTop = 0;
              for (const child of node.querySelectorAll('*'))
                if (child.scrollHeight > child.clientHeight)
                  child.scrollTop = 0;
            });
          const path = join(
            output,
            `settings-layout-${key}-${role}-${width}-${panel}.png`,
          );
          await captureBrowserScreenshot(page, { path, fullPage: true });
          report.screenshots.push({
            key,
            role,
            width,
            height,
            native,
            panel,
            path,
          });
        };
        try {
          if (key !== 'box')
            await page
              .getByRole('button', { name: '菜单', exact: true })
              .click();
          await page
            .getByRole('button', { name: '游戏设置', exact: true })
            .click();
          await page
            .getByRole('switch', { name: '声音', exact: true })
            .waitFor({ state: 'visible' });
          await assertSettingRowsAndHelp(page);
          await screenshot('game');
          await page.keyboard.press('Escape');
          await page
            .getByRole('button', { name: '视频设置', exact: true })
            .click();
          const mode = page.getByLabel('显示模式', { exact: true });
          await mode.waitFor({ state: 'visible' });
          if (native) {
            const resolution = page.getByLabel('适配方式', { exact: true });
            const scale = page.getByLabel('界面大小', { exact: true });
            await resolution.waitFor({ state: 'visible' });
            assert.deepEqual(
              await mode
                .locator('option')
                .evaluateAll((options) =>
                  options.map((option) => option.value),
                ),
              ['fullscreen', 'borderless', 'windowed'],
            );
            await mode.selectOption('borderless');
            assert.equal(await mode.inputValue(), 'borderless');
            await mode.selectOption('fullscreen');
            assert.equal(await mode.inputValue(), 'fullscreen');
            await mode.selectOption('windowed');
            await resolution.selectOption('1920x1080');
            await scale.selectOption('125');
            assert.equal(await resolution.inputValue(), '1920x1080');
            assert.equal(await scale.inputValue(), '125');
            assert.deepEqual(
              await page.evaluate(() => window.nativeSettingsCalls),
              {
                display: [
                  { resolution: '1920x1080', interfaceScale: 100 },
                  { resolution: '1920x1080', interfaceScale: 125 },
                ],
                window: ['borderless', 'fullscreen', 'windowed'],
              },
            );
            await page
              .getByRole('button', { name: '恢复自动适配', exact: true })
              .click();
            assert.equal(await resolution.inputValue(), 'auto');
            assert.equal(await scale.inputValue(), '100');
            assert.deepEqual(
              await page.evaluate(() =>
                window.nativeSettingsCalls.display.at(-1),
              ),
              { resolution: 'auto', interfaceScale: 100 },
            );
          } else {
            assert.equal(
              await page
                .locator('#display-resolution, #display-interface-scale')
                .count(),
              0,
              'Browser player has no native display controls',
            );
            assert.equal(
              await mode.locator('option[value="borderless"]').count(),
              0,
              'Browser player has no native borderless mode',
            );
          }
          await assertSettingRowsAndHelp(page);
          await screenshot('video');
        } finally {
          await page.evaluate(() => window.configureNativeSettings(false));
        }
      });
    }
  for (const width of [320, 360, 390, 844, 1280])
    for (const key of ['box', ...games]) {
      await check(`${key}:${width}:save-layout`, async () => {
        await page.setViewportSize({
          width,
          height: width === 844 ? 390 : 844,
        });
        await page.evaluate((key) => window.renderGame(key, 'player'), key);
        await page.evaluate(() => window.setSaved(false));
        const capture = () =>
          page.evaluate(() => {
            // Compare layout after result animations, rather than sampling moving cards.
            for (const animation of document.getAnimations())
              animation.cancel();
            return [
              ...document.querySelectorAll(
                'button, header, h1, [data-latest-saved-action], .ma-latest, .uno-latest, .rk-latest, .av-saved-action',
              ),
            ]
              .filter((el) => el.getClientRects().length)
              .map((el) => {
                const r = el.getBoundingClientRect();
                return [
                  el.tagName,
                  el.textContent.replace(/已保存/g, ''),
                  r.x,
                  r.y,
                  r.width,
                  r.height,
                ];
              });
          });
        const before = await capture();
        await page.evaluate(() => window.setSaved(true));
        assert.deepEqual(
          await capture(),
          before,
          'Saving acknowledgement must not move or resize other components',
        );
        const labels = await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              '.session-save-anchor,.uno-saved-label,.rk-saved-label,.av-saved-label,.ma-latest > span',
            ),
          ]
            .filter((el) => getComputedStyle(el).display !== 'none')
            .map((el) => ({
              class: el.className,
              position: getComputedStyle(el).position,
            })),
        );
        assert(
          labels.every((label) => label.position === 'absolute'),
          JSON.stringify(labels),
        );
        const overlaps = await page.evaluate(() => {
          const result = [];
          const labels = [
            ...document.querySelectorAll(
              '.session-save-overlay,.uno-saved-label,.rk-saved-label,.av-saved-label,.ma-latest > span,.box-save-status[data-visible="true"]',
            ),
          ];
          for (const label of labels) {
            if (
              !label.textContent ||
              !label.getClientRects().length ||
              getComputedStyle(label).visibility === 'hidden'
            )
              continue;
            const range = document.createRange();
            range.selectNodeContents(label);
            const box = range.getBoundingClientRect();
            const container =
              label.closest(
                'header,.uno-latest,.rk-latest,.av-saved-action,.ma-latest',
              ) ?? label.parentElement;
            const walker = document.createTreeWalker(
              container,
              NodeFilter.SHOW_TEXT,
            );
            while (walker.nextNode()) {
              const node = walker.currentNode;
              if (!node.textContent.trim() || label.contains(node)) continue;
              const element = node.parentElement;
              if (
                !element?.getClientRects().length ||
                getComputedStyle(element).visibility === 'hidden'
              )
                continue;
              const text = document.createRange();
              text.selectNodeContents(node);
              for (const rect of text.getClientRects())
                if (
                  Math.min(box.right, rect.right) -
                    Math.max(box.left, rect.left) >
                    1 &&
                  Math.min(box.bottom, rect.bottom) -
                    Math.max(box.top, rect.top) >
                    1
                )
                  result.push({
                    label: label.className,
                    text: node.textContent.trim(),
                  });
            }
          }
          return result;
        });
        assert.deepEqual(
          overlaps,
          [],
          'Saved label must not cover existing text',
        );
        if (width === 320 || width === 1280)
          await captureBrowserScreenshot(page, {
            path: join(output, `${key}-${width}.png`),
            fullPage: true,
          });
      });
    }
  await check('sound:same-origin-window-and-frame', async () => {
    await page.evaluate(() => window.setSound(true));
    const peer = await context.newPage();
    await peer.goto(server.url);
    await peer.waitForFunction(() => typeof window.setSound === 'function');
    await page.evaluate(() => window.setSound(false));
    await peer.waitForFunction(
      () =>
        document
          .querySelector('[data-sound-probe]')
          ?.getAttribute('data-sound-probe') === 'off',
    );
    await page.evaluate((url) => {
      const frame = document.createElement('iframe');
      frame.src = url;
      frame.dataset.soundSyncProbe = 'true';
      document.body.append(frame);
    }, server.url);
    const frame = page.frames().find((frame) => frame !== page.mainFrame());
    await frame.waitForFunction(() => typeof window.setSound === 'function');
    await frame.evaluate(() => window.setSound(true));
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-sound-probe]')
          ?.getAttribute('data-sound-probe') === 'on',
    );
    await peer.waitForFunction(
      () =>
        document
          .querySelector('[data-sound-probe]')
          ?.getAttribute('data-sound-probe') === 'on',
    );
    await peer.close();
    await page
      .locator('iframe[data-sound-sync-probe]')
      .evaluate((element) => element.remove());
  });
  await check(
    'mobile:fullscreen-success-rejection-and-unavailable',
    async () => {
      const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      });
      try {
        const phone = await mobile.newPage();
        await phone.goto(server.url);
        await phone.waitForFunction(
          () => typeof window.renderGame === 'function',
        );
        await phone.evaluate(() => window.renderGame('manila', 'player'));
        await phone.getByRole('button', { name: '菜单', exact: true }).click();
        await phone
          .getByRole('button', { name: '视频设置', exact: true })
          .click();
        await assertSettingRowsAndHelp(phone, { touch: true });
        const mode = phone.getByLabel('显示模式', { exact: true });
        await mode.selectOption('fullscreen');
        await phone.waitForFunction(() => Boolean(document.fullscreenElement));
        await mode.selectOption('windowed');
        await phone.waitForFunction(() => !document.fullscreenElement);
        await phone.evaluate(() => {
          document.documentElement.requestFullscreen = () =>
            Promise.reject(new Error('Fixture browser permission rejection'));
        });
        await mode.selectOption('fullscreen');
        await phone
          .getByText('显示模式切换失败，请重试', { exact: false })
          .waitFor();
        assert.equal(await mode.inputValue(), 'windowed');
        await phone.keyboard.press('Escape');
        await phone.evaluate(() => {
          Object.defineProperty(document, 'fullscreenEnabled', {
            configurable: true,
            value: false,
          });
        });
        await phone
          .getByRole('button', { name: '视频设置', exact: true })
          .click();
        assert(
          await phone.getByLabel('显示模式', { exact: true }).isDisabled(),
        );
        assert.equal(
          await phone
            .getByLabel('显示模式', { exact: true })
            .locator('option[value="fullscreen"]')
            .count(),
          1,
        );
      } finally {
        await mobile.close();
      }
    },
  );
  for (const key of ['pokemon-encounters', 'expansion']) {
    for (const reduced of [false, true])
      await check(
        `effects:${key}:${reduced ? 'reduced' : 'normal'}:saved-discard`,
        async () => {
          await page.setViewportSize({ width: 1920, height: 1080 });
          await page.emulateMedia({
            reducedMotion: reduced ? 'reduce' : 'no-preference',
          });
          await page.evaluate((key) => {
            window.setSound(false);
            window.renderDiscard(key);
          }, key);
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
          );
          const marker =
            key === 'expansion' ? '.ex-discard-landing' : '.discarded-landing';
          const trail =
            key === 'expansion'
              ? '.ex-discard-transfer .ex-board-trail'
              : '.discarded-trail';
          assert.equal(
            await page.locator(marker).count(),
            0,
            'Mount does not replay historical discard',
          );
          await page.evaluate(() => window.commitDiscard());
          const painted = page.locator(reduced ? marker : trail);
          await painted.waitFor({ state: 'visible', timeout: 3000 });
          if (!reduced)
            await painted.evaluate((element) => {
              for (const animation of element.getAnimations()) {
                const timing = animation.effect.getTiming();
                if (typeof timing.duration === 'number') {
                  animation.pause();
                  animation.currentTime =
                    Number(timing.delay) + timing.duration * 0.4;
                }
              }
            });
          const style = await painted.evaluate((element) => {
            const css = getComputedStyle(element);
            return {
              stroke: css.stroke,
              opacity: Number(css.opacity),
              length:
                element.tagName.toLowerCase() === 'path'
                  ? element.getTotalLength()
                  : null,
              animation: css.animationName,
              pointer: getComputedStyle(element.closest('svg')).pointerEvents,
            };
          });
          assert.equal(style.stroke, 'rgb(22, 140, 148)');
          assert.equal(style.pointer, 'none');
          assert(style.opacity > 0.1, 'Discard feedback is painted visibly');
          if (!reduced)
            assert(style.length > 12, 'Discard path has real visible geometry');
          if (reduced) {
            assert.equal(style.animation, 'none');
            assert.equal(await page.locator(trail).isVisible(), false);
          }
          await captureBrowserScreenshot(page, {
            path: join(
              output,
              `${key}-${reduced ? 'reduced' : 'normal'}-discard.png`,
            ),
            fullPage: true,
          });
          await page.evaluate(() => window.restoreDiscard());
          assert.equal(
            await page.locator(marker).count(),
            0,
            'Restore does not replay saved landing',
          );
        },
      );
  }
  await check('icons:svg-readable-at-card-sizes', async () => {
    await page.setViewportSize({ width: 480, height: 480 });
    await page.evaluate(() => window.renderIcons());
    await page.evaluate(() =>
      Promise.all([...document.images].map((image) => image.decode())),
    );
    const icons = await page
      .locator('.ability-mark-icon')
      .evaluateAll((images) =>
        images.map((image) => ({
          loaded: image.naturalWidth === 24 && image.naturalHeight === 24,
          width: image.getBoundingClientRect().width,
          height: image.getBoundingClientRect().height,
        })),
      );
    assert(
      icons.length >= 12 &&
        icons.every(
          (icon) => icon.loaded && icon.width >= 18 && icon.height >= 18,
        ),
    );
    await captureBrowserScreenshot(page, {
      path: join(output, 'ability-icons.png'),
      fullPage: true,
    });
  });
  assert.deepEqual(report.errors, [], 'Source fixture runtime errors');
  assert.deepEqual(report.failures, [], 'Targeted UI checks');
  for (const [path, hash] of Object.entries(report.inputs))
    assert.equal(
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
      hash,
      'Verified input changed during this run: ' + path,
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
  await writeFile(
    join(output, 'verifier-source.mjs'),
    await readFile(new URL(import.meta.url)),
  );
  console.log(
    JSON.stringify({
      result: report.result,
      passed: report.checks.length,
      failures: report.failures,
      errors: report.errors,
      report: join(output, 'report.json'),
      error: report.error,
    }),
  );
}
