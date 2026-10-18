import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';

const name = process.argv
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice(11);
assert.match(name ?? '', /^[a-z0-9-]{1,65}$/);
const output = resolve('artifacts/avalon/validation', name);
await mkdir(output, { recursive: false });
const inputPaths = [
  'games/avalon/ui/style.css',
  'games/avalon/web/index.tsx',
  'games/avalon/ui/Board.tsx',
  'games/avalon/rules/test-fixtures.ts',
  'tools/test/games/avalon/verify-host-layout.mjs',
];
const inputs = await Promise.all(
  inputPaths.map(async (path) => ({
    path,
    sha256: createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
  })),
);
await writeFile(
  join(output, 'verifier-source.mjs'),
  await readFile(new URL(import.meta.url)),
);
const work = await mkdtemp(resolve('tmp/avalon-host-'));
await writeFile(
  join(work, 'index.html'),
  '<html lang="zh-CN"><meta charset="utf-8"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
const local = (path) => JSON.stringify(resolve(path));
await writeFile(
  join(work, 'entry.tsx'),
  `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {HostedGame} from ${local('packages/web-host/src/index.tsx')};
import {configureGameHost} from ${local('packages/web-host/src/platform.ts')};
import {avatarFor,avatarChoices} from ${local('apps/web/src/assets/avatars.ts')};
import {client} from ${local('games/avalon/web/index.tsx')};
import {rulesByVariant} from ${local('games/avalon/rules/index.ts')};
import {fixture,reveal,apply,discuss,approve,quest} from ${local('games/avalon/rules/test-fixtures.ts')};
import ${local('apps/web/src/styles.css')};
configureGameHost({ScreenLink:p=><a {...p}/>,FullscreenControl:()=>null,DisplaySettings:()=>null,useAudioOutput:()=>false,claimAudioEvent:()=>true,avatarFor,avatarChoices});
const root=createRoot(document.getElementById('root'));
window.renderAvalon=({count=10,phase='discussion',role='host',long=false,paused=false}={})=>{
 let state=fixture('configured',count);
 if(phase!=='reveal') state=reveal(state);
 if(['discussion','vote'].includes(phase)) {
  state=apply(state,rulesByVariant.configured.legalActions(state,state.leader)[0],state.leader);
  if(phase==='vote') state=discuss(state);
 }
 if(['quest','assassinate','ended'].includes(phase)) {
  state=approve(state,rulesByVariant.configured.legalActions(state,state.leader)[0].team);
  if(phase!=='quest') {
   state=quest(state);
   for(let i=0;i<2;i++) { const action=rulesByVariant.configured.legalActions(state,state.leader)[0];state=approve(state,action.team);state=quest(state); }
   if(phase==='ended') {
    const assassin=state.seats.find(id=>state.roles[id]==='assassin');
    const action=rulesByVariant.configured.legalActions(state,assassin)[0];
    state=apply(state,action,assassin);
   }
  }
 }
 const rules=rulesByVariant.configured;
 const seats=state.seats.map((id,i)=>({id,name:long?'圆桌骑士长昵称'+(i+1):'骑士'+(i+1),avatarId:'avatar-'+(i+1),controller:'human',ready:true,online:true,botDifficulty:null}));
 const game=rules.project(state,{role:role==='player'?'player':'public',seatId:role==='player'?state.seats[0]:undefined});
 const session={role,connected:true,locked:false,canControl:role==='host',message:'',messageKind:'saved',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],command:c=>(window.commands??=[]).push(c),view:{instanceId:'host-layout',branch:0,revision:1,status:state.phase==='ended'?'ended':'playing',paused,playMode:'play',gameView:game,decisionId:rules.decisions(state)[0]?.id??null,countdownSeconds:30,decisionClock:null,actions:role==='player'?rules.legalActions(state,state.seats[0]):[],lifecycleActions:role==='host'&&state.phase==='discussion'?[{type:'skip-discussion',target:game.discussion.current}]:[],seats,history:[]}};
 flushSync(()=>root.render(<HostedGame key={count+phase+role+long+paused} session={session} client={client} presentation={{management:()=>null,feedback:()=>null,playMode:()=>null,countdown:()=>null}}/>));
};
window.renderAvalon();
`,
);
const report = {
  inputs,
  result: 'running',
  scope:
    'Current Avalon source fixture; simulated viewports, no installed EXE or physical-device proof.',
  layouts: [],
  failures: [],
  screenshots: [],
};
let server, browser;
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
    build: { outDir: join(work, 'bundle'), emptyOutDir: false },
    logLevel: 'error',
  });
  server = await serveFixture(join(work, 'bundle'));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => report.failures.push(error.message));
  await page.goto(server.url);
  await page.waitForFunction(() => typeof window.renderAvalon === 'function');
  for (const [width, height] of [
    [1024, 640],
    [1280, 720],
    [1536, 864],
    [1920, 1080],
    [3840, 2160],
  ]) {
    await page.setViewportSize({ width, height });
    for (const count of [5, 6, 7, 8, 9, 10])
      for (const phase of [
        'reveal',
        'team',
        'discussion',
        'vote',
        'quest',
        'assassinate',
        'ended',
      ]) {
        const scenario = {
          count,
          phase,
          long: true,
          paused: phase === 'discussion',
        };
        await page.evaluate((s) => window.renderAvalon(s), scenario);
        await page.evaluate(() => document.fonts.ready);
        const geometry = await page.evaluate(() => {
          const bounds = (el) => {
            const r = el.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            };
          };
          const seats = [...document.querySelectorAll('.av-seat')].map(bounds);
          const siblings = [
            ...document.querySelectorAll(
              '.av-toolbar,.av-status-bar,.av-campaign,.av-workspace,.av-discussion,.av-recent-ballot,.av-saved-action,.av-public-footer,.av-replay',
            ),
          ].map(bounds);
          const visible = [
            ...document.querySelectorAll(
              '.avalon-screen > :not(.av-effects),.av-seat,.av-council-center,.av-revealed-roles > article',
            ),
          ].filter((el) => el.getBoundingClientRect().height > 0);
          const outside = visible
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.x < -1 ||
                r.right > innerWidth + 1 ||
                r.y < -1 ||
                r.bottom > innerHeight + 1
              );
            })
            .map((el) => el.className);
          const overlaps = seats.flatMap((a, i) =>
            seats
              .slice(i + 1)
              .filter(
                (b) =>
                  Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
                  Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1,
              )
              .map(() => i),
          );
          const panelOverlaps = siblings.flatMap((a, i) =>
            siblings
              .slice(i + 1)
              .filter(
                (b) =>
                  Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
                  Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1,
              )
              .map(() => i),
          );
          return {
            scrollHeight: document.documentElement.scrollHeight,
            scrollWidth: document.documentElement.scrollWidth,
            outside,
            overlaps,
            panelOverlaps,
            seats: seats.length,
          };
        });
        report.layouts.push({ width, height, ...scenario, ...geometry });
        if (
          geometry.scrollHeight > height + 1 ||
          geometry.scrollWidth > width + 1 ||
          geometry.outside.length ||
          geometry.overlaps.length ||
          geometry.panelOverlaps.length
        )
          report.failures.push({ width, height, ...scenario, ...geometry });
        if (
          count === 10 &&
          ['discussion', 'quest', 'ended'].includes(phase) &&
          [1024, 1280, 1920, 3840].includes(width)
        ) {
          const path = join(output, `${width}-${phase}.png`);
          await captureBrowserScreenshot(page, { path });
          report.screenshots.push(path);
        }
      }
  }
  report.result = report.failures.length ? 'failed' : 'passed';
} catch (error) {
  report.result = 'failed';
  report.failures.push(error.stack);
} finally {
  await browser?.close();
  await server?.close();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(
  JSON.stringify({
    result: report.result,
    cases: report.layouts.length,
    failures: report.failures.length,
    report: join(output, 'report.json'),
  }),
);
if (report.result !== 'passed') process.exitCode = 1;
