import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
assertWorkspaceRoot();
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';

const name = process.argv
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice(11);
assert.match(name ?? '', /^[a-z0-9-]{1,65}$/);
const output = resolve('artifacts/manila/validation', name);
await mkdir(output);
const work = await mkdtemp(resolve('tmp/game-review-'));
const source = await readFile(new URL(import.meta.url));
await writeFile(join(output, 'verifier-source.mjs'), source, { flag: 'wx' });
await writeFile(
  join(work, 'index.html'),
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  join(work, 'entry.tsx'),
  `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {HostedGame} from ${JSON.stringify(resolve('packages/web-host/src/index.tsx'))};
import {configureGameHost} from ${JSON.stringify(resolve('packages/web-host/src/platform.ts'))};
import {SessionFeedback as PlatformFeedback} from ${JSON.stringify(resolve('apps/web/src/components/SessionFeedback.tsx'))};
import {avatarFor,avatarChoices} from ${JSON.stringify(resolve('apps/web/src/assets/avatars.ts'))};
import {client} from ${JSON.stringify(resolve('games/manila/web/index.tsx'))};
import {rules} from ${JSON.stringify(resolve('games/manila/rules/index.ts'))};
import {turnSeat,validateState} from ${JSON.stringify(resolve('games/manila/rules/state.ts'))};
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
configureGameHost({ScreenLink:p=><a {...p}/>,FullscreenControl:()=>null,DisplaySettings:()=>null,useAudioOutput:()=>false,claimAudioEvent:()=>true,avatarFor,avatarChoices});
const ids=['A','B','C','D','E'];
const context={seats:ids,random:{next:()=>0.99}};
const seats=ids.map((id,i)=>({id,name:['阿蓝','小林','港口伙伴','长昵称测试商人','小船长'][i],avatarId:'avatar-'+(i+1),controller:'human',ready:true,online:true,botDifficulty:null}));
function advance(state){
 if(state.phase==='round-result') return rules.applyLifecycle(state,{type:'next-voyage'},context).state;
 const actor=turnSeat(state),actions=rules.legalActions(state,actor);
 const action=actions.find(a=>a.type==='place')??actions.find(a=>a.type==='pass')??actions.find(a=>a.type==='skip-share')??actions.find(a=>a.type==='setup'&&a.positions.every(p=>p===3))??actions[0];
 if(!action)throw new Error('Fixture has no legal advance');
 return validateState(rules.apply(state,action,actor,context).state,ids);
}
const initial=rules.initialize(context);
function stateFor(phase){
 let state=initial;
 for(let i=0;i<800;i++){
  if(phase==='auction'&&state.phase==='auction'||phase==='place'&&state.phase==='place'||phase==='sail'&&state.phase==='place'&&state.movement>0||phase==='ended'&&state.phase==='ended')return state;
  state=advance(state);
 }
 throw new Error('Unreachable fixture '+phase);
}
const root=createRoot(document.getElementById('root'));
window.renderManila=({phase='place',role='player'}={})=>{
 const state=stateFor(phase),actor=turnSeat(state)??ids[0];
 const projected=rules.project(state,role==='player'?{role:'player',seatId:actor}:{role:'public'});
 const session={role,self:role==='player'?seats.find(s=>s.id===actor):undefined,connected:true,locked:false,canControl:role==='host',message:'已保存',messageKind:'saved',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],command:c=>(window.commands??=[]).push(c),view:{instanceId:'design-'+phase+'-'+role,branch:0,revision:state.serial,status:state.phase==='ended'?'ended':'playing',paused:false,playMode:'play',gameView:projected,decisionId:rules.decisions(state)[0]?.id??null,countdownSeconds:30,decisionClock:state.phase==='ended'?null:{id:'e6ed6d54-cf77-4fa3-95ea-bf2d105c0728',remainingMs:18000,serverTime:Date.now(),running:true},actions:role==='player'?rules.legalActions(state,actor):[],lifecycleActions:[],seats,history:[]}};
 flushSync(()=>root.render(<HostedGame key={phase+'-'+role} session={session} client={client} presentation={{management:()=>null,feedback:props=><PlatformFeedback session={session} {...props}/>,playMode:()=>null,countdown:()=>null}}/>));
 return {actor,avatar:avatarFor(seats.find(s=>s.id===actor).avatarId),revision:state.serial,privateShares:projected.self?.shares.length??0};
};
window.renderManila();
`,
);
const report = {
  result: 'running',
  scope:
    'Real current Manila components and legal-rule projections in a source fixture; no transport, installed-runtime, physical-device or system-installation proof.',
  output,
  work,
  verifierSha256: createHash('sha256').update(source).digest('hex'),
  layouts: [],
  details: [],
  screenshots: [],
  errors: [],
  failures: [],
};
let server, browser, page;
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
  page = await browser.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.goto(server.url);
  await page.waitForFunction(() => typeof window.renderManila === 'function');
  const shot = async (name) => {
    const path = join(output, name + '.png');
    await captureBrowserScreenshot(page, { path });
    report.screenshots.push(path);
  };
  for (const role of ['player', 'host', 'public']) {
    const sizes =
      role === 'player'
        ? [
            [320, 568],
            [390, 844],
            [430, 932],
            [844, 390],
          ]
        : [
            [1280, 720],
            [1920, 1080],
            [3840, 2160],
          ];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      const expected = await page.evaluate(
        (role) => window.renderManila({ phase: 'sail', role }),
        role,
      );
      await page.evaluate(() =>
        Promise.all(
          [...document.images].map((img) => img.decode().catch(() => {})),
        ),
      );
      const geometry = await page.evaluate(() => {
        const root = document.querySelector('.mn-screen');
        const visible = (node) =>
          node.checkVisibility() &&
          node.getBoundingClientRect().width > 0 &&
          node.getBoundingClientRect().height > 0;
        const dice = [...root.querySelectorAll('.mn-die')]
          .filter(visible)
          .map((node) => {
            const r = node.getBoundingClientRect();
            return { width: r.width, height: r.height };
          });
        const flowBottoms = (parent) =>
          [...parent.children].flatMap((node) => {
            const style = getComputedStyle(node);
            if (style.display === 'contents') return flowBottoms(node);
            return visible(node) &&
              !['fixed', 'absolute'].includes(style.position)
              ? [node.getBoundingClientRect().bottom + scrollY]
              : [];
          });
        const rect = (node) => {
          if (!node) return null;
          const r = node.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        };
        const last = Math.max(0, ...flowBottoms(root));
        const dockGaps = [...root.querySelectorAll('.mn-dock-group')]
          .filter(visible)
          .map(
            (node) =>
              node.getBoundingClientRect().bottom -
              Math.max(
                ...[...node.children]
                  .filter(visible)
                  .map((child) => child.getBoundingClientRect().bottom),
              ) -
              parseFloat(getComputedStyle(node).paddingBottom),
          );
        const phase = root.querySelector('.mn-phase-name');
        const range = document.createRange();
        range.selectNodeContents(phase);
        const phaseRows = [
          ...new Set(
            [...range.getClientRects()]
              .filter((rect) => rect.width > 0.1)
              .map((rect) => Math.round(rect.top)),
          ),
        ];
        return {
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          tailGap:
            document.documentElement.scrollHeight - Math.max(innerHeight, last),
          dice,
          dockGaps,
          phaseRows,
          menuRight: root
            .querySelector('.mn-toolbar-tools > button:last-child')
            .getBoundingClientRect().right,
          smallText: [...root.querySelectorAll('*')]
            .filter(
              (node) =>
                visible(node) &&
                [...node.childNodes].some(
                  (child) =>
                    child.nodeType === Node.TEXT_NODE &&
                    child.textContent.trim(),
                ) &&
                parseFloat(getComputedStyle(node).fontSize) < 16,
            )
            .map((node) => ({
              text: node.textContent.slice(0, 80),
              size: getComputedStyle(node).fontSize,
            })),
          privateCount: root.querySelectorAll('.mn-private').length,
          specialistTitles: [
            ...root.querySelectorAll(
              '.mn-specialist-group > .mn-detail-button > span',
            ),
          ]
            .filter(visible)
            .map((node) => ({
              text: node.textContent,
              height: node.getBoundingClientRect().height,
              fontSize: parseFloat(getComputedStyle(node).fontSize),
            })),
          actorAvatar:
            root.querySelector('.mn-status img')?.getAttribute('src') ?? null,
          bodyText: root.textContent,
          hostComposition: {
            main: rect(root.querySelector('.mn-main')),
            side: rect(root.querySelector('.mn-side')),
            market: rect(root.querySelector('.mn-market-panel')),
            players: rect(root.querySelector('.mn-players-panel')),
            seats: root.querySelectorAll('.mn-seat').length,
          },
          laneMeta: [...root.querySelectorAll('.mn-lane-meta')]
            .filter(visible)
            .map((node) => ({
              meta: rect(node),
              status: rect(node.querySelector('.mn-position-readout')),
              payout: rect(node.querySelector('.mn-payout-label')),
            })),
          buttonSelect: [...root.querySelectorAll('button')]
            .filter(visible)
            .map((node) => getComputedStyle(node).userSelect),
          playerLandscape: root.classList.contains('mn-screen--player')
            ? {
                private: rect(root.querySelector('.mn-private')),
                lanes: rect(root.querySelector('.mn-lanes')),
                actions: rect(root.querySelector('.mn-board-actions')),
              }
            : null,
        };
      });
      report.layouts.push({
        role,
        width,
        height,
        ...geometry,
        bodyText: undefined,
      });
      assert.ok(
        geometry.scrollWidth <= width + 1,
        `${role} ${width}: horizontal overflow`,
      );
      if (role !== 'player')
        assert.ok(
          geometry.tailGap <= 20,
          `${role} ${width}: empty trailing scroll ${geometry.tailGap}`,
        );
      assert.ok(geometry.dice.length > 0, 'Sailed legal state renders dice');
      assert.ok(
        geometry.dice.every((d) => Math.abs(d.width - d.height) < 0.6),
        'Every visible die is square',
      );
      assert.ok(
        geometry.dockGaps.every((gap) => gap <= 4),
        'Dock cards do not stretch past their content',
      );
      assert.deepEqual(
        geometry.smallText,
        [],
        `${role} ${width}: information text is at least 16 CSS pixels`,
      );
      assert.ok(
        geometry.specialistTitles.every(
          (title) => title.height <= title.fontSize * 1.6,
        ),
        'Specialist names, including insurance, never split into orphan characters',
      );
      assert.equal(
        geometry.phaseRows.length,
        1,
        'The phase name stays one intact phrase',
      );
      if (role === 'player' && width <= 430)
        assert.ok(
          width - 38 - 23 - geometry.menuRight >= 4,
          'The toolbar leaves at least 4 CSS pixels before the default interaction orb',
        );
      assert.equal(
        geometry.actorAvatar,
        expected.avatar,
        'Status uses the current acting seat portrait',
      );
      assert.equal(
        geometry.privateCount,
        role === 'player' ? 1 : 0,
        'Only the player projection contains a private wallet',
      );
      if (role === 'player') {
        assert.match(
          geometry.bodyText,
          /抵押.*借|可借/,
          'Credit is described as borrowing against shares',
        );
        if (width === 844 && height === 390) {
          assert.ok(
            geometry.playerLandscape.private &&
              geometry.playerLandscape.private.width > 0,
            'Landscape keeps the private cash strip visible',
          );
          assert.ok(
            geometry.playerLandscape.actions &&
              geometry.playerLandscape.actions.x >
                geometry.playerLandscape.lanes.right - 1,
            'Landscape places actions beside the lanes',
          );
          assert.ok(
            geometry.scrollHeight <= height + 1,
            'Landscape does not need page scrolling',
          );
        }
      }
      assert.ok(
        geometry.buttonSelect.every((value) => value === 'none'),
        'Button labels are not text-selectable',
      );
      for (const meta of geometry.laneMeta) {
        if (meta.status && meta.payout)
          assert.ok(
            meta.payout.x >= meta.status.right - 1,
            'Lane status and dividend do not overlap',
          );
      }
      if (role !== 'player') {
        const composition = geometry.hostComposition;
        assert.ok(composition.main, `${role}: harbor main area is missing`);
        assert.ok(composition.side, `${role}: ledger rail is missing`);
        assert.ok(
          composition.side.x >= composition.main.right - 1,
          `${role}: ledger rail is not to the right of the board`,
        );
        assert.ok(
          composition.market.bottom <= composition.players.y + 2,
          `${role}: market is not above the merchants`,
        );
        assert.ok(
          composition.players.bottom <= height + 1,
          `${role}: merchant rail leaves the viewport`,
        );
        assert.equal(
          composition.seats,
          5,
          `${role}: every merchant remains visible in the ledger rail`,
        );
        assert.ok(
          geometry.tailGap <= 20,
          `${role}: host/public board requires page scrolling`,
        );
      }
      await shot(role + '-' + width + 'x' + height);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() =>
    window.renderManila({ phase: 'place', role: 'player' }),
  );
  const triggers = page.locator('.mn-detail-button');
  for (let index = 0; index < (await triggers.count()); index++) {
    const trigger = triggers.nth(index);
    if (!(await trigger.isVisible())) continue;
    const label =
      (await trigger.getAttribute('aria-label')) ?? (await trigger.innerText());
    await trigger.click();
    const card = page.locator('.mn-detail-card');
    await card.waitFor();
    const box = await card.boundingBox();
    assert.ok(
      box &&
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= 390.5 &&
        box.y + box.height <= 844.5,
      'Detail fits its viewport: ' + label,
    );
    await shot('detail-' + index);
    report.details.push({ label, box });
    await card.getByRole('button', { name: /关闭/ }).click();
    assert.equal(await card.count(), 0, 'Detail closes: ' + label);
    assert.ok(
      await trigger.evaluate((node) => document.activeElement === node),
      'Closing a detail restores focus to its trigger: ' + label,
    );
  }
  const operationSummary = page
    .locator('summary')
    .filter({ hasText: '操作列表' })
    .first();
  if (await operationSummary.isVisible()) {
    const box = await operationSummary.boundingBox();
    assert.ok(box, 'Operation summary has a draggable area');
    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 24, box.y + box.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    const selected = await page.evaluate(() =>
      window.getSelection()?.toString(),
    );
    assert.ok(
      !selected?.includes('操作列表'),
      'Dragging across a button label does not select its text',
    );
  }
  await page.getByRole('button', { name: '账本', exact: true }).click();
  await page.locator('.mn-overlay').waitFor();
  await shot('player-ledger-390x844');
  await page
    .locator('.mn-overlay')
    .getByRole('button', { name: /关闭/ })
    .click();
  assert.ok(
    await page
      .getByRole('button', { name: '账本', exact: true })
      .evaluate((node) => document.activeElement === node),
    'Closing the ledger restores focus to its trigger',
  );
  assert.deepEqual(
    await page.evaluate(() => window.commands ?? []),
    [],
    'Browsing details and ledger never submits actions',
  );
  assert.deepEqual(report.errors, []);
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.failures.push(error.stack ?? String(error));
  process.exitCode = 1;
  if (page)
    await captureBrowserScreenshot(page, {
      path: join(output, 'failure.png'),
    }).catch(() => {});
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      output,
      layouts: report.layouts.length,
      details: report.details.length,
      failures: report.failures,
    }),
  );
}
