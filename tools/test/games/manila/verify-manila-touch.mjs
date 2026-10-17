import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
assertWorkspaceRoot();
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';

process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TABLEMAX_TEST_MAINTENANCE = '0';
const evidence = process.argv
  .find((a) => a.startsWith('--evidence='))
  ?.slice(11);
assert.match(evidence ?? '', /^[a-z0-9-]{1,65}$/);
const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
const available = [
  'setup',
  'pilot-small',
  'pilot-large',
  'auction',
  'round-result',
  'waiting',
  'labels',
];
assert(!only || only.every((id) => available.includes(id)));
const selected = only ?? available;
const widths = process.argv
  .find((a) => a.startsWith('--widths='))
  ?.slice(9)
  .split(',')
  .map(Number);
assert(
  !widths || widths.every((value) => [320, 390, 430, 844, 932].includes(value)),
);
await mkdir(
  resolve('artifacts/maintenance/manila-touch-layout-20261017/touch'),
  { recursive: true },
);
const output = resolve(
  'artifacts/maintenance/manila-touch-layout-20261017/touch',
  evidence,
);
await mkdir(output, { recursive: false });
const work = join(output, 'fixture');
await mkdir(work);
const verifier = await readFile(new URL(import.meta.url));
await writeFile(join(output, 'verifier-source.mjs'), verifier, { flag: 'wx' });
const path = (name) => JSON.stringify(resolve(name));
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
import {PlatformGame} from ${path('apps/web/src/session/gameHostAdapter.tsx')};
import {client} from ${path('games/manila/web/index.tsx')};
import {rules} from ${path('games/manila/rules/index.ts')};
import {turnSeat,validateState} from ${path('games/manila/rules/state.ts')};
import ${path('apps/web/src/styles.css')};
import ${path('apps/web/src/scrollbars.css')};
const ids=['A','B','C','D','E'];
const seats=ids.map((id,i)=>({id,name:['阿蓝','小林','港口伙伴','长昵称测试商人','小船长'][i],avatarId:'avatar-'+(i+1),controller:'human',ready:true,online:true,botDifficulty:null}));
let seed=35719;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const snapshots={},origins={};
const phases=['auction','setup','pilot-small','pilot-large','round-result','ended'];
for(let run=0;run<32&&Object.keys(snapshots).length<phases.length;run++){
 const ctx={seats:ids,random:{next:random}};
 let state=rules.initialize(ctx);
 for(let step=0;step<900;step++){
  if(phases.includes(state.phase)&&!snapshots[state.phase]){snapshots[state.phase]=structuredClone(state);origins[state.phase]={run,step,serial:state.serial,voyage:state.voyage};}
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
window.fixtureInfo={available:Object.keys(snapshots),origins,missing:phases.filter(p=>!snapshots[p])};
const root=createRoot(document.getElementById('root'));
let generation=0,current;
const noop=()=>{};
window.commands=[];
function paint(){flushSync(()=>root.render(<PlatformGame key={generation} session={current.session} client={client}/>));}
window.renderManilaTouch=({phase='setup',role='player',waiting=false,locked=false,owner=false}={})=>{
 const state=snapshots[phase];if(!state)throw new Error('Missing legal fixture '+phase);
 const actor=turnSeat(state)??ids[0],seatId=waiting?ids.find(id=>id!==actor):actor;
 const ownerSeatId=owner?actor:null;
 // Match Room.controls and Room.managesSeats: a mobile owner keeps player role.
 const canControl=role==='host'||(role==='player'&&seatId===ownerSeatId);
 const view={instanceId:'manila-touch-'+phase,branch:0,revision:state.serial,status:state.phase==='ended'?'ended':'playing',paused:false,playMode:'play',gameView:rules.project(state,role==='player'?{role:'player',seatId}:{role:'public'}),decisionId:rules.decisions(state)[0]?.id??null,countdownSeconds:30,decisionClock:null,actions:role==='player'?rules.legalActions(state,seatId):[],lifecycleActions:rules.lifecycleActions(state),seats,history:[],joinOpen:true,ownerSeatId,game:{...rules.manifest,releaseRef:'fixture',minPlayers:3,maxPlayers:5,min:3,max:5},catalog:[],capabilities:{manage:role==='host',control:canControl,manageSeats:canControl},self:{role,seatId:role==='player'?seatId:null},restored:false,selectionToken:null};
 const session={role,view,self:role==='player'?seats.find(s=>s.id===seatId):undefined,isHost:role==='host',canControl,canManageSeats:canControl,connected:true,locked,busy:false,message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],credential:'fixture',name:'阿蓝',setName:noop,command:c=>window.commands.push(c),join:noop,retry:noop,retryAdmission:noop,setPlayerCredential:noop,publicUrl:'http://127.0.0.1',localUrl:'http://127.0.0.1',admissionAvatarId:null};
 current={state,actor,session};window.fixtureSession=session;window.commands=[];generation++;paint();
 return {actor,seatId,phase,boats:view.gameView.boats,legal:view.actions,origin:origins[phase]};
};
window.lockManilaTouch=(locked)=>{current.session={...current.session,locked};window.fixtureSession=current.session;paint();};
window.validateManilaCommand=()=>{
 if(window.commands.length!==1)throw new Error('Expected exactly one command');
 const command=window.commands[0],ctx={seats:ids,random:{next:()=>0.5}};
 if(command.type==='game'){
  if(!current.session.view.actions.some(a=>JSON.stringify(a)===JSON.stringify(command.action)))throw new Error('Submitted action not legal');
  validateState(rules.apply(structuredClone(current.state),command.action,current.actor,ctx).state,ids);
 }else if(command.type==='lifecycle')validateState(rules.applyLifecycle(structuredClone(current.state),command.action,ctx).state,ids);
 else throw new Error('Unexpected command '+command.type);
 return command;
};
window.renderManilaTouch();
`,
);

const inputFiles = [
  'games/manila/ui/Board.tsx',
  'games/manila/ui/PlayerControls.tsx',
  'games/manila/ui/style.css',
  'games/manila/ui/theme.css',
  'games/manila/ui/host-layout.css',
  'games/manila/web/index.tsx',
  'apps/web/src/session/gameHostAdapter.tsx',
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fingerprint = async () =>
  Object.fromEntries(
    await Promise.all(
      inputFiles.map(async (file) => [file, sha(await readFile(file))]),
    ),
  );
const report = {
  result: 'running',
  scope:
    'Actual current React Manila and PlatformGame adapter with five-seat states reached through legal rule play. Hidden muted Edge, loopback only, Android touch/viewport emulation. Command legality is checked against actual rules; no service transport, physical phone, installer or system-DPI acceptance proof.',
  selected,
  widths: widths ?? 'all',
  verifierSha256: sha(verifier),
  inputsBefore: await fingerprint(),
  output,
  work,
  checks: [],
  metrics: [],
  screenshots: [],
  failures: [],
  errors: [],
  unexecuted: [],
};
let browser, server;
async function check(name, run) {
  if (report.failures.length >= 10) {
    report.unexecuted.push(name);
    return;
  }
  try {
    await run();
    report.checks.push({ name, result: 'passed' });
  } catch (error) {
    report.failures.push({ name, error: error.stack });
    report.checks.push({ name, result: 'failed' });
  }
}
const sizes = [
  [320, 568],
  [390, 844],
  [430, 932],
  [844, 390],
  [932, 430],
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
  report.url = server.url;
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  for (const [width, height] of sizes) {
    if (widths && !widths.includes(width)) continue;
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
    const cdp = await context.newCDPSession(page);
    page.setDefaultTimeout(5000);
    page.on('pageerror', (error) => report.errors.push(error.message));
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
    await page.waitForFunction(
      () => typeof window.renderManilaTouch === 'function',
    );
    report.fixtureInfo ??= await page.evaluate(() => window.fixtureInfo);
    const settle = () =>
      page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((img) => img.decode().catch(() => {})),
        );
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
      });
    const render = async (options) => {
      // Edge/Playwright fullPage captures clear the coarse pointer flag while
      // retaining maxTouchPoints. Restore the declared context before each case.
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 1,
      });
      const value = await page.evaluate(
        (o) => window.renderManilaTouch(o),
        options,
      );
      await settle();
      return value;
    };
    const commands = () => page.evaluate(() => window.commands);
    const positions = () =>
      page.locator('.mn-position-controls output').allTextContents();
    const numericPositions = async () =>
      (await positions()).map((text) => Number(text.match(/(\d+)格/)?.[1]));
    const controls = page.locator('.mn-position-controls');
    const arrow = (lane, step) =>
      controls.nth(lane).locator(`button[data-mn-step="${step}"]`);
    const shot = async (label, fullPage = true) => {
      const file = join(output, `${label}-${width}x${height}.png`);
      await captureBrowserScreenshot(page, { path: file, fullPage });
      report.screenshots.push(file);
    };
    const geometry = async (phase) => {
      const row = await page.evaluate(() => {
        const visible = (node) =>
          node.checkVisibility() &&
          node.getBoundingClientRect().width > 0 &&
          node.getBoundingClientRect().height > 0;
        const box = (node) => {
          const r = node.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
          };
        };
        const tray = document.querySelector('.mn-action-tray'),
          details = tray?.querySelector('details');
        return {
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          touch: matchMedia('(pointer: coarse)').matches,
          arrows: [...document.querySelectorAll('.mn-position-controls button')]
            .filter(visible)
            .map((node) => ({
              ...box(node),
              disabled: node.disabled,
              step: node.dataset.mnStep,
            })),
          tray: tray && box(tray),
          details: details && {
            ...box(details),
            marginTop: getComputedStyle(details).marginTop,
            marginBottom: getComputedStyle(details).marginBottom,
          },
          pointerInstruction: [
            ...document.querySelectorAll(
              '.mn-pointer-instruction,.mn-start-handle,.mn-pilot-drag',
            ),
          ]
            .filter(visible)
            .map((n) => n.className),
          trayText: tray?.innerText ?? '',
        };
      });
      report.metrics.push({ phase, width, height, ...row });
      assert.equal(row.width, width, 'Actual mobile CSS width');
      assert(row.scrollWidth <= width + 1, 'No horizontal page overflow');
      assert(row.touch, 'Touch pointer media applies');
      for (const entry of row.arrows)
        assert(
          entry.width >= 44 && entry.height >= 44,
          'Every visible arrow has a 44px touch target',
        );
      assert.equal(
        row.pointerInstruction.length,
        0,
        'Mobile uses explicit arrows without draggable handles/instructions',
      );
      assert(
        !row.trayText.includes('拖动'),
        'No visible drag sentence in mobile position tray',
      );
      if (row.details) {
        assert.equal(
          row.details.marginTop,
          '0px',
          'Action list has no 20px top margin',
        );
        assert.equal(
          row.details.marginBottom,
          '0px',
          'Action list has no bottom margin',
        );
        const centerError = Math.abs(
          row.details.y +
            row.details.height / 2 -
            (row.tray.y + row.tray.height / 2),
        );
        assert(
          centerError <= 2,
          `Action list centered in tray (${centerError}px)`,
        );
      }
    };
    if (selected.includes('labels')) {
      for (const phase of ['setup', 'pilot-small', 'pilot-large']) {
        await check(
          `${phase}-${width}: one-line draft label bounds`,
          async () => {
            await render({ phase });
            if (phase === 'setup')
              await page
                .getByRole('button', { name: '下一步：设起点', exact: true })
                .tap();
            else await arrow(0, 1).tap();
            await settle();
            const labels = await page
              .locator('.mn-boat-preview > span')
              .evaluateAll((nodes) =>
                nodes.map((node) => {
                  const range = document.createRange();
                  range.selectNodeContents(node);
                  const rows = [
                    ...new Set(
                      [...range.getClientRects()]
                        .filter((r) => r.width > 0)
                        .map((r) => Math.round(r.top)),
                    ),
                  ];
                  const rect = node.getBoundingClientRect();
                  const lane = node.closest('.mn-lane').getBoundingClientRect();
                  return {
                    text: node.textContent,
                    rows,
                    x: rect.x,
                    right: rect.right,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    lane: { x: lane.x, right: lane.right },
                    scrollWidth: node.scrollWidth,
                    clientWidth: node.clientWidth,
                    originalPositionVisible:
                      node
                        .closest('.mn-track')
                        .querySelector('.mn-lane-position')
                        ?.checkVisibility() ?? false,
                  };
                }),
              );
            assert(labels.length > 0, 'Draft label is actually rendered');
            for (const label of labels) {
              assert.equal(
                label.rows.length,
                1,
                `${label.text} stays on one line`,
              );
              assert(
                label.x >= label.lane.x - 1 &&
                  label.right <= label.lane.right + 1,
                'Draft label stays inside its lane',
              );
              assert(
                label.x >= 0 && label.right <= width + 1,
                'Draft label stays inside viewport',
              );
              assert(
                label.scrollWidth <= label.clientWidth + 1,
                'Draft label text is not clipped',
              );
              assert.equal(
                label.originalPositionVisible,
                false,
                'Preview suppresses original boat-position badge rather than stacking labels',
              );
            }
            report.metrics.push({
              phase: 'labels',
              labelPhase: phase,
              width,
              height,
              labels,
            });
            await shot(`${phase}-label`);
          },
        );
      }
    }
    for (const phase of ['setup', 'pilot-small', 'pilot-large']) {
      if (!selected.includes(phase)) continue;
      await check(
        `${phase}-${width}: touch draft, limits, lock, legal confirmation`,
        async () => {
          const fixture = await render({ phase });
          if (phase === 'setup')
            await page
              .getByRole('button', { name: '下一步：设起点', exact: true })
              .tap();
          await settle();
          await geometry(phase);
          const laneCount = await controls.count();
          assert(phase === 'setup' ? laneCount === 3 : laneCount > 0);
          const initial = await positions();
          await arrow(0, 1).tap();
          assert.notDeepEqual(
            await positions(),
            initial,
            'Tap advances visible draft',
          );
          assert.equal((await commands()).length, 0, 'Arrow does not submit');
          await arrow(0, -1).tap();
          assert.deepEqual(
            await positions(),
            initial,
            'Reverse tap restores draft',
          );
          assert.equal((await commands()).length, 0);
          if (phase === 'setup') {
            for (let i = 0; i < 3; i++) await arrow(0, -1).tap();
            assert((await numericPositions())[0] === 0);
            assert(await arrow(0, -1).isDisabled(), 'Cannot go below 0');
            for (let i = 0; i < 5; i++) await arrow(0, 1).tap();
            assert((await numericPositions())[0] === 5);
            assert(await arrow(0, 1).isDisabled(), 'Cannot go above 5');
            assert(
              await page.locator('[data-manila-action="setup"]').isDisabled(),
              'Non-nine total cannot submit',
            );
            await arrow(0, -1).tap();
            await arrow(0, -1).tap();
          } else {
            const budget = phase === 'pilot-small' ? 1 : 2;
            for (let i = 0; i < budget; i++) await arrow(0, 1).tap();
            assert(
              await arrow(0, 1).isDisabled(),
              'Full budget prevents additional step',
            );
            for (let lane = 1; lane < (await controls.count()); lane++) {
              assert(
                await arrow(lane, 1).isDisabled(),
                'Budget blocks another boat forward',
              );
              assert(
                await arrow(lane, -1).isDisabled(),
                'Budget blocks another boat backward',
              );
            }
            await page
              .getByRole('button', { name: '清空调整', exact: true })
              .tap();
            assert.deepEqual(await positions(), initial);
            if (budget === 2 && laneCount >= 2) {
              await arrow(0, 1).tap();
              await arrow(1, 1).tap();
              assert(
                await arrow(0, 1).isDisabled(),
                'Split two-boat move consumes budget',
              );
              await arrow(1, -1).tap();
              await arrow(0, -1).tap();
            }
            await arrow(0, -1).tap();
          }
          await shot(phase + '-draft');
          const beforeLock = await positions();
          await page.evaluate(() => window.lockManilaTouch(true));
          assert.equal(
            await controls.locator('button:not(:disabled)').count(),
            0,
            'Lock disables all arrows',
          );
          const confirm = page.locator(
            `[data-manila-action="${phase === 'setup' ? 'setup' : 'pilot'}"]`,
          );
          assert(await confirm.isDisabled(), 'Lock disables confirmation');
          await arrow(0, 1).tap({ force: true });
          assert.deepEqual(
            await positions(),
            beforeLock,
            'Locked touch cannot change draft',
          );
          assert.equal((await commands()).length, 0);
          await page.evaluate(() => window.lockManilaTouch(false));
          assert(await confirm.isEnabled());
          await confirm.tap();
          const command = await page.evaluate(() =>
            window.validateManilaCommand(),
          );
          report.metrics.push({
            phase,
            width,
            height,
            submitted: command,
            fixture,
          });
        },
      );
    }
    if (selected.includes('auction'))
      await check(
        `auction-${width}: compact amount and valid bid`,
        async () => {
          const fixture = await render({ phase: 'auction' });
          const field = page.locator('#mn-bid-amount');
          const box = await field.boundingBox();
          assert(box.width <= 64.5, `Bid amount width ${box.width}`);
          assert(box.height >= 44);
          await field.fill(
            String(fixture.legal.find((a) => a.type === 'bid').amount),
          );
          await page.locator('[data-manila-action="bid"]').tap();
          const command = await page.evaluate(() =>
            window.validateManilaCommand(),
          );
          report.metrics.push({
            phase: 'auction',
            width,
            height,
            field: box,
            submitted: command,
          });
          await shot('auction');
        },
      );
    if (selected.includes('round-result'))
      await check(`round-result-${width}: next voyage CTA`, async () => {
        await render({ phase: 'round-result', role: 'player', owner: true });
        assert.equal(await page.locator('.mn-receipt-button').count(), 1);
        const button = page.locator('.mn-next-voyage');
        assert(await button.isVisible());
        await button.scrollIntoViewIfNeeded();
        await settle();
        const box = await button.boundingBox();
        assert(box.width >= 44 && box.height >= 44);
        assert(box.x >= 0 && box.x + box.width <= width + 1);
        assert(
          box.y >= 0 && box.y + box.height <= height + 1,
          'CTA can be brought fully into the actual viewport',
        );
        const data = {
          phase: 'round-result',
          width,
          height,
          button: box,
        };
        await shot('round-result', false);
        await button.tap();
        data.submitted = await page.evaluate(() =>
          window.validateManilaCommand(),
        );
        report.metrics.push(data);
      });
    if (selected.includes('waiting'))
      await check(
        `waiting-${width}: nonactor has no empty action panel`,
        async () => {
          const fixture = await render({ phase: 'setup', waiting: true });
          assert.equal(fixture.legal.length, 0, 'Nonactor legal actions empty');
          assert.equal(
            await page.locator('.mn-controls').count(),
            0,
            'No empty waiting panel',
          );
          assert.equal(
            await page.locator('.mn-confirm').count(),
            0,
            'No waiting confirmation',
          );
          assert.equal(await controls.count(), 0, 'No waiting arrows');
          await shot('waiting');
        },
      );
    await context.close();
  }
  assert.deepEqual(report.errors, [], 'No browser runtime errors');
} catch (error) {
  report.failures.push({ name: 'verifier-runtime', error: error.stack });
} finally {
  await browser?.close();
  await server?.close();
  report.inputsAfter = await fingerprint();
  report.changedInputs = inputFiles.filter(
    (file) => report.inputsBefore[file] !== report.inputsAfter[file],
  );
  if (
    report.changedInputs.some(
      (file) =>
        file !== 'games/manila/ui/host-layout.css' ||
        selected.includes('round-result'),
    )
  )
    report.failures.push({
      name: 'input-stability',
      error: 'Relevant source changed during verification.',
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
