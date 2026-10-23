import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, relative, sep, basename } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';

if (process.argv.includes('--discussion-only')) {
  await verifyDiscussionOnly();
  process.exit(process.exitCode ?? 0);
}

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
  const { launchTestBrowser } = await import('../../support/browser-test.mjs');
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

async function verifyDiscussionOnly() {
  const argument = (key) =>
    process.argv
      .find((value) => value.startsWith(`--${key}=`))
      ?.slice(key.length + 3);
  const phase = argument('phase');
  assert.ok(
    ['before', 'after'].includes(phase),
    'Choose --phase=before or after',
  );
  const task = resolve(
    argument('task') ?? 'tmp/avalon-discussion-ui-20261024-e1',
  );
  assert.ok(
    task.startsWith(resolve('tmp') + sep),
    'Task must remain under workspace tmp',
  );
  const name = argument('evidence');
  assert.match(name ?? '', /^[a-z0-9-]{1,65}$/);
  const outputRoot = resolve('artifacts/maintenance', basename(task)),
    output = join(outputRoot, name),
    work = join(task, name);
  await mkdir(outputRoot, { recursive: true });
  await mkdir(output, { recursive: false });
  await mkdir(work, { recursive: true });
  process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
  process.env.TABLEMAX_TEST_MAINTENANCE = '0';
  const browserTemp = join(task, 'browser-temp');
  await mkdir(browserTemp, { recursive: true });
  process.env.TEMP = browserTemp;
  process.env.TMP = browserTemp;
  const { launchTestBrowser } = await import('../../support/browser-test.mjs');
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
    local = (path) => relative(resolve('.'), path).split(sep).join('/');
  const frozen = new Map();
  if (phase === 'before')
    for (const path of [
      'games/avalon/web/index.tsx',
      'games/avalon/ui/style.css',
    ])
      frozen.set(
        resolve(path),
        await readFile(join(task, 'baseline', path), 'utf8'),
      );
  const report = {
    result: 'running',
    phase,
    task,
    output,
    scope:
      'Production Avalon client/HostedGame and configured5/10 rules fixtures. Reveal, legal nomination and discussion completions validate real state and project authorized role views. Local command capture/apply is not real Socket/server/persistence/acknowledgement proof. Source viewport and disabled-presentation checks do not certify physical devices, DPI, installer or audio listening. Before loads only frozen client/style bytes; no temporary overlay CSS.',
    checks: [],
    layouts: [],
    screenshots: [],
    failures: [],
    pending: [],
    pageErrors: [],
    externalRequests: [],
    inputs: {},
    verifierSha256: hash(await readFile(new URL(import.meta.url))),
  };
  const save = () =>
    writeFile(
      join(output, 'report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
  await writeFile(
    join(output, 'verifier-source.mjs'),
    await readFile(new URL(import.meta.url)),
  );
  await writeFile(
    join(work, 'index.html'),
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
  );
  const source = (path) => JSON.stringify(resolve(path));
  await writeFile(
    join(work, 'entry.tsx'),
    `
import React from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
import{HostedGame}from ${source('packages/web-host/src/index.tsx')};import{configureGameHost}from ${source('packages/web-host/src/platform.ts')};
import{avatarFor,avatarChoices}from ${source('apps/web/src/assets/avatars.ts')};
import{playerNameError}from ${source('packages/protocol/src/index.ts')};
import{client}from ${source('games/avalon/web/index.tsx')};import{rulesByVariant}from ${source('games/avalon/rules/index.ts')};
import{fixture,reveal,apply,context}from ${source('games/avalon/rules/test-fixtures.ts')};import ${source('apps/web/src/styles.css')};
configureGameHost({ScreenLink:p=><a {...p}/>,FullscreenControl:()=>null,DisplaySettings:()=>null,useAudioOutput:()=>false,claimAudioEvent:()=>true,avatarFor,avatarChoices});
const root=createRoot(document.getElementById('root')),rules=rulesByVariant.configured;
const names=['圆桌骑士一号朋友','ABCDEFGHIJKLMNOP','圆桌骑士三号朋友','FriendFour123456','圆桌骑士五号朋友','FriendSix1234567','圆桌骑士七号朋友','FriendEight12345','圆桌骑士九号朋友','FriendTen1234567'];
if(names.some(n=>playerNameError(n)))throw new Error('Illegal fixture nickname');
let state,options,revision=1,selfId;
window.commands=[];window.legalProof=[];
function paint(){
 const{count,role,paused=false,connected=true,otherPlayer=false}=options;
 const current=state.discussion?.order[state.discussion.completed.length],next=state.discussion?.order[state.discussion.completed.length+1]??null;
 selfId=role==='player'?options.playerSeatId:null;
 const seats=state.seats.map((id,i)=>({id,name:names[i],avatarId:'avatar-'+(i+1),controller:'human',ready:true,online:true,botDifficulty:null}));
 const game=rules.project(state,{role:role==='player'?'player':'public',seatId:selfId??undefined});
 const actions=role==='player'?rules.legalActions(state,selfId):[],lifecycleActions=role==='host'?rules.lifecycleActions(state):[];
 const session={role,self:seats.find(seat=>seat.id===selfId)??null,connected,locked:!connected,canControl:role==='host',message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],command:c=>window.commands.push(c),view:{instanceId:'discussion-source-fixture',branch:0,revision,status:state.phase==='ended'?'ended':'playing',paused,playMode:'play',gameView:game,decisionId:rules.decisions(state)[0]?.id??null,countdownSeconds:30,decisionClock:null,actions,lifecycleActions,seats,history:[]}};
 window.fixtureCase={count,role,phase:state.phase,paused,connected,current,next,completed:state.discussion?.completed.length??count,skipped:state.discussion?.skipped??[],order:state.discussion?.order??[],names:Object.fromEntries(seats.map(s=>[s.id,s.name])),hasSelf:Boolean(game.self),actions,lifecycleActions,revision,selfId};
 flushSync(()=>root.render(<HostedGame key={count+role} session={session} client={client} presentation={{management:()=>null,feedback:()=>null,playMode:()=>null,countdown:()=>null}}/>));
 return window.fixtureCase;
}
window.renderAvalonDiscussion=(nextOptions={})=>{
 options={count:10,role:'host',completed:2,...nextOptions};window.commands=[];revision=1;
 state=reveal(fixture('configured',options.count));state=apply(state,rules.legalActions(state,state.leader)[0],state.leader);
 for(let i=0;i<options.completed;i++)state=apply(state,{type:'finish-discussion'},state.discussion.order[state.discussion.completed.length]);
 rules.validateState(state,state.seats);
 const current=state.discussion.order[state.discussion.completed.length];
 options.playerSeatId=options.otherPlayer?state.seats.find(id=>id!==current):current;
 window.legalProof.push({count:options.count,phase:state.phase,completed:state.discussion.completed.length,order:[...state.discussion.order],leader:state.leader,validated:true});return paint();
};
window.applyCapturedAvalon=()=>{
 const command=window.commands.at(-1);if(!command)throw new Error('No captured command');
 if(!options.connected&&options.connected!==undefined||options.paused)throw new Error('Inactive fixture cannot apply');
 if(command.type==='lifecycle'){
  if(options.role!=='host'||rules.lifecyclePermission(state,command.action)!=='host')throw new Error('Unauthorized lifecycle');
  state=rules.applyLifecycle(state,command.action,context(37,state.seats)).state;
 }else if(command.type==='game'){
  if(options.role!=='player'||!rules.isLegalAction(state,command.action,selfId))throw new Error('Unauthorized player action');
  state=rules.apply(state,command.action,selfId,context(37,state.seats)).state;
 }else throw new Error('Unexpected captured command type');
 state=rules.validateState(state,state.seats);revision++;return paint();
};window.renderAvalonDiscussion();
`,
  );
  let files = [],
    server,
    browser,
    page;
  const fingerprint = () =>
    Promise.all(
      files.map(async (path) => ({
        path: local(path),
        sha256: hash(
          frozen.has(path) ? frozen.get(path) : await readFile(path),
        ),
        ...(frozen.has(path)
          ? { frozenSource: local(join(task, 'baseline', local(path))) }
          : {}),
      })),
    );
  const checked = async (id, fn) => {
    if (report.failures.length >= 10) {
      report.pending.push(id);
      return;
    }
    try {
      await fn();
      report.checks.push({ id, passed: true });
    } catch (error) {
      report.failures.push({ id, error: error.message });
      await captureBrowserScreenshot(page, {
        path: join(output, id + '-failure.png'),
        failure: true,
        fullPage: true,
      }).catch(() => {});
    }
    await save();
  };
  try {
    await build({
      configFile: false,
      root: work,
      plugins: [
        {
          name: 'frozen-discussion-inputs',
          enforce: 'pre',
          load(id) {
            return frozen.get(resolve(id.split('?')[0]));
          },
        },
        react(),
        {
          name: 'discussion-inputs',
          generateBundle() {
            files = [
              ...new Set(
                [...this.getModuleIds()]
                  .map((id) => id.split('?')[0])
                  .filter(
                    (id) =>
                      !id.startsWith('\0') &&
                      id
                        .replaceAll('\\', '/')
                        .startsWith(resolve('.').replaceAll('\\', '/') + '/') &&
                      !id.includes('node_modules') &&
                      /\.(tsx?|css|json|png|webp|svg)$/.test(id),
                  )
                  .map((id) => resolve(id)),
              ),
            ].sort();
          },
        },
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
      logLevel: 'error',
    });
    report.inputs.before = await fingerprint();
    server = await serveFixture(join(work, 'bundle'));
    browser = await launchTestBrowser({ channel: 'msedge', headless: true });
    page = await browser.newPage({ reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    page.on('pageerror', (error) => report.pageErrors.push(error.message));
    page.on('request', (request) => {
      if (!request.url().startsWith(new URL(server.url).origin))
        report.externalRequests.push(request.url());
    });
    await page.goto(server.url);
    await page.waitForFunction(
      () => typeof window.renderAvalonDiscussion === 'function',
    );
    const configure = async (options, width = 1280, height = 720) => {
      await page.setViewportSize({ width, height });
      await page.evaluate((options) => {
        window.renderAvalonDiscussion(options);
        scrollTo(0, 0);
      }, options);
      await page.locator('.av-edition').waitFor({ state: 'attached' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images]
            .filter((i) => i.loading !== 'lazy')
            .map((i) => i.decode().catch(() => {})),
        );
        await new Promise(requestAnimationFrame);
      });
    };
    const metrics = () =>
      page.evaluate(() => {
        const rect = (el) => {
            const r = el.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              right: r.right,
              bottom: r.bottom,
            };
          },
          edition = document.querySelector('.av-edition'),
          style = getComputedStyle(edition),
          range = document.createRange();
        range.selectNodeContents(edition);
        const discussion = document.querySelector('.av-discussion');
        const parts = discussion
          ? [
              ...discussion.querySelectorAll(
                '.av-discussion-progress>span,.av-discussion-progress>strong,.av-discussion-next>span,.av-discussion-next>strong,button',
              ),
            ]
              .filter((el) => el.getClientRects().length)
              .map((el) => {
                const textRange = document.createRange();
                textRange.selectNodeContents(el);
                return {
                  text: el.textContent.trim(),
                  strong: el.tagName === 'STRONG',
                  button: el.tagName === 'BUTTON',
                  rect: rect(el),
                  glyph: rect(textRange),
                  font: parseFloat(getComputedStyle(el).fontSize),
                };
              })
          : [];
        return {
          fixture: window.fixtureCase,
          viewport: { width: innerWidth, height: innerHeight },
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          currentSpeaker:
            document.querySelector('.av-speaking-name')?.textContent,
          edition: {
            text: edition.textContent.trim(),
            rect: rect(edition),
            glyph: rect(range),
            weight: parseInt(style.fontWeight),
            font: parseFloat(style.fontSize),
            display: style.display,
            textAlign: style.textAlign,
            alignItems: style.alignItems,
            justifyContent: style.justifyContent,
          },
          discussion: discussion
            ? {
                text: discussion.innerText,
                rect: rect(discussion),
                parts,
                html: discussion.innerHTML,
                progressLabel: discussion
                  .querySelector('.av-discussion-progress strong')
                  ?.getAttribute('aria-label'),
                nextSpeaker: discussion.querySelector(
                  '.av-discussion-next strong',
                )?.textContent,
              }
            : null,
          commands: window.commands.length,
        };
      });
    const checkSummary = (sample) => {
      assert.equal(sample.overflow, false, 'Horizontal overflow');
      assert.equal(sample.edition.text, '经典配置');
      if (sample.edition.rect.width > 0) {
        assert.ok(
          sample.edition.weight >= 700,
          'Visible classic label is bold',
        );
        assert.ok(
          Math.abs(
            sample.edition.glyph.x +
              sample.edition.glyph.width / 2 -
              (sample.edition.rect.x + sample.edition.rect.width / 2),
          ) <= 2,
          'Classic label glyphs horizontally centered',
        );
        assert.ok(
          Math.abs(
            sample.edition.glyph.y +
              sample.edition.glyph.height / 2 -
              (sample.edition.rect.y + sample.edition.rect.height / 2),
          ) <= 3,
          'Classic label glyphs vertically centered',
        );
      }
      assert.ok(sample.discussion, 'Discussion summary exists');
      assert.ok(
        !sample.discussion.text.includes('→'),
        'No full arrow-linked speaker chain',
      );
      assert.equal(
        sample.currentSpeaker,
        sample.fixture.names[sample.fixture.current],
        'Current speaker remains in status heading',
      );
      if (sample.fixture.next)
        assert.equal(
          sample.discussion.nextSpeaker,
          sample.fixture.names[sample.fixture.next],
          'Next speaker shown',
        );
      else
        assert.ok(
          sample.discussion.text.includes('本轮最后发言'),
          'Last speaker summary',
        );
      assert.ok(
        new RegExp(
          sample.fixture.completed + '\\s*/\\s*' + sample.fixture.count,
        ).test(sample.discussion.text),
        'Completed/total shown',
      );
      if (sample.fixture.role !== 'player')
        assert.equal(
          sample.fixture.hasSelf,
          false,
          'Public role has no private self',
        );
      for (const [index, part] of sample.discussion.parts.entries()) {
        const glyph = part.glyph,
          container = sample.discussion.rect;
        assert.ok(
          glyph.x >= container.x - 1 &&
            glyph.right <= container.right + 1 &&
            glyph.y >= container.y - 1 &&
            glyph.bottom <= container.bottom + 1,
          'Summary glyphs stay inside the panel: ' + part.text,
        );
        assert.ok(
          part.font >= (part.strong ? 18 : 16),
          'Summary readable font: ' + part.text,
        );
        if (part.button)
          assert.ok(
            part.rect.height >= 44 && part.rect.width >= 44,
            'Summary button44px target',
          );
        for (const other of sample.discussion.parts.slice(index + 1))
          assert.ok(
            Math.min(glyph.right, other.glyph.right) -
              Math.max(glyph.x, other.glyph.x) <=
              1 ||
              Math.min(glyph.bottom, other.glyph.bottom) -
                Math.max(glyph.y, other.glyph.y) <=
                1,
            'Summary glyphs do not overlap: ' + part.text + '/' + other.text,
          );
      }
    };
    const checkReachable = async () => {
      for (const node of await page
        .locator('.av-discussion,.av-discussion button')
        .all()) {
        await node.scrollIntoViewIfNeeded();
        assert.equal(
          await node.evaluate((el) => {
            const r = el.getBoundingClientRect();
            let left = 0,
              right = innerWidth,
              top = 0,
              bottom = innerHeight;
            for (let p = el.parentElement; p; p = p.parentElement) {
              const s = getComputedStyle(p),
                b = p.getBoundingClientRect();
              if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX)) {
                left = Math.max(left, b.left);
                right = Math.min(right, b.right);
              }
              if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowY)) {
                top = Math.max(top, b.top);
                bottom = Math.min(bottom, b.bottom);
              }
            }
            return (
              r.x >= left - 1 &&
              r.right <= right + 1 &&
              r.y >= top - 1 &&
              r.bottom <= bottom + 1
            );
          }),
          true,
          'Discussion panel and button remain fully reachable',
        );
      }
      await page.evaluate(() => scrollTo(0, 0));
    };
    for (const item of [
      {
        id: 'host5-1280',
        role: 'host',
        count: 5,
        completed: 0,
        width: 1280,
        height: 720,
      },
      {
        id: 'host10-1920',
        role: 'host',
        count: 10,
        completed: 2,
        width: 1920,
        height: 1080,
      },
      {
        id: 'public10-1280',
        role: 'public',
        count: 10,
        completed: 2,
        width: 1280,
        height: 720,
      },
      {
        id: 'player10-390',
        role: 'player',
        count: 10,
        completed: 2,
        width: 390,
        height: 844,
      },
    ])
      await checked(item.id, async () => {
        await configure(item, item.width, item.height);
        const sample = await metrics();
        report.layouts.push({ id: item.id, ...sample });
        if (phase === 'after') {
          checkSummary(sample);
          await checkReachable();
        }
        const path = join(output, item.id + '.png');
        await captureBrowserScreenshot(page, { path, fullPage: true });
        report.screenshots.push({
          id: item.id,
          path,
          role: item.role,
          width: item.width,
          height: item.height,
          sha256: hash(await readFile(path)),
        });
      });
    if (phase === 'after') {
      for (const item of [
        {
          id: 'host10-844-short',
          role: 'host',
          count: 10,
          completed: 2,
          width: 844,
          height: 390,
        },
        {
          id: 'player10-320',
          role: 'player',
          count: 10,
          completed: 2,
          width: 320,
          height: 568,
        },
        {
          id: 'last-speaker',
          role: 'host',
          count: 10,
          completed: 9,
          width: 1280,
          height: 720,
        },
      ])
        await checked(item.id, async () => {
          await configure(item, item.width, item.height);
          const sample = await metrics();
          report.layouts.push({ id: item.id, ...sample });
          checkSummary(sample);
          await checkReachable();
        });
      await checked(
        'player-authorized-finish-and-last-transition',
        async () => {
          await configure(
            { role: 'player', count: 10, completed: 2 },
            390,
            844,
          );
          const before = await page.evaluate(() => window.fixtureCase);
          const button = page.locator('[data-av-action="finish-discussion"]');
          assert.equal(await button.count(), 1);
          await button.click();
          assert.equal(await page.evaluate(() => window.commands.length), 1);
          const after = await page.evaluate(() => window.applyCapturedAvalon());
          assert.equal(after.completed, 3);
          assert.equal(after.current, before.next);
          assert.equal(after.revision, before.revision + 1);
          await configure(
            { role: 'player', count: 10, completed: 9 },
            390,
            844,
          );
          await page.locator('[data-av-action="finish-discussion"]').click();
          const last = await page.evaluate(() => window.applyCapturedAvalon());
          assert.equal(last.phase, 'vote');
          assert.equal(await page.locator('.av-discussion').count(), 0);
        },
      );
      await checked('host-authorized-skip', async () => {
        await configure({ role: 'host', count: 5, completed: 0 });
        const before = await page.evaluate(() => window.fixtureCase);
        await page.getByRole('button', { name: /^跳过当前发言：/ }).click();
        assert.equal(await page.evaluate(() => window.commands.length), 1);
        const after = await page.evaluate(() => window.applyCapturedAvalon());
        assert.ok(after.skipped.includes(before.current));
        assert.equal(after.current, before.next);
        assert.equal(after.completed, 1);
        const sample = await metrics();
        checkSummary(sample);
        assert.match(
          sample.discussion.progressLabel,
          /已结束 1 人，其中跳过 1 人，共 5 人/,
          'Skipped speech counts once in handled total',
        );
      });
      await checked('public-and-other-player-readonly', async () => {
        for (const options of [
          { role: 'public', count: 10, completed: 2 },
          { role: 'player', count: 10, completed: 2, otherPlayer: true },
        ]) {
          await configure(options, 390, 844);
          assert.equal(
            await page.locator('[data-av-action="finish-discussion"]').count(),
            0,
          );
          assert.equal(
            await page.getByRole('button', { name: /^跳过当前发言：/ }).count(),
            0,
          );
          assert.equal(await page.evaluate(() => window.commands.length), 0);
        }
      });
      await checked('paused-and-controlled-disconnected', async () => {
        for (const inactive of [{ paused: true }, { connected: false }])
          for (const role of ['host', 'player']) {
            await configure(
              { role, count: 10, completed: 2, ...inactive },
              390,
              844,
            );
            const button =
              role === 'host'
                ? page.getByRole('button', { name: /^跳过当前发言：/ })
                : page.locator('[data-av-action="finish-discussion"]');
            assert.equal(await button.isDisabled(), true);
            assert.equal(await page.evaluate(() => window.commands.length), 0);
          }
      });
    }
    report.legalPreparation = await page.evaluate(() => window.legalProof);
    report.inputs.after = await fingerprint();
    assert.deepEqual(
      report.inputs.after,
      report.inputs.before,
      'Stable source inputs',
    );
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.externalRequests, []);
    report.result = report.failures.length ? 'failed' : 'passed';
  } catch (error) {
    report.result = 'failed';
    report.failures.push({
      id: 'setup-or-finalize',
      error: error.stack ?? error.message,
    });
  } finally {
    await browser?.close();
    await server?.close();
    await save();
  }
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.length,
      screenshots: report.screenshots.length,
      failures: report.failures,
      pending: report.pending,
      report: join(output, 'report.json'),
    }),
  );
  if (report.result !== 'passed') process.exitCode = 1;
}
