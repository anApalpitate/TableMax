import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
assertWorkspaceRoot();
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';
import { fingerprint as sourceFingerprint } from '../../runner/evidence.mjs';

process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TABLEMAX_TEST_MAINTENANCE = '0';

const name = process.argv
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice(11);
assert.match(name ?? '', /^[a-z0-9-]{1,65}$/);
const output = resolve('artifacts/manila/validation', name);
// Local iteration filter: --only=player:844x390,player:1024x768 keeps the
// canonical run unchanged (no flag ⇒ every role and viewport).
const only = (process.argv.find((arg) => arg.startsWith('--only=')) ?? '')
  .slice(7)
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
const wanted = (role, width, height) =>
  !only.length || only.includes(`${role}:${width}x${height}`);
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
  if(phase==='auction'&&state.phase==='auction'||phase==='place'&&state.phase==='place'||phase==='sail'&&state.phase==='place'&&state.movement>0||phase==='round-result'&&state.phase==='round-result'||phase==='ended'&&state.phase==='ended')return state;
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
    script: 'tools/test/games/manila/verify-manila-design.mjs',
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
  scope:
    'Real current Manila components and legal-rule projections in a source fixture; no transport, installed-runtime, physical-device or system-installation proof.',
  output,
  work,
  verifierSha256: createHash('sha256').update(source).digest('hex'),
  inputsBefore: await fingerprint(),
  inputBindingBefore: inputBinding,
  layouts: [],
  destinations: [],
  details: [],
  screenshots: [],
  errors: [],
  failures: [],
  pending: [],
};
const pending = report.pending;
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
            [620, 900],
            [621, 900],
            [844, 390],
            [932, 430],
            [1024, 768],
            [1123, 1428],
          ]
        : [
            [1280, 720],
            [1920, 1080],
            [3840, 2160],
          ];
    for (const [width, height] of sizes) {
      if (!wanted(role, width, height)) continue;
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
        const describe = (node) =>
          node.tagName.toLowerCase() +
          [...node.classList].map((entry) => '.' + entry).join('') +
          (node.textContent.trim()
            ? ' "' + node.textContent.trim().slice(0, 22) + '"'
            : '');
        const clips = (node) => {
          const style = getComputedStyle(node);
          return [style.overflowX, style.overflowY].some(
            (value) => value !== 'visible',
          );
        };
        /* A container the reader can scroll is not a clip: content below or
           beyond its edge is reachable, so only unreachable overflow counts. */
        const scrolls = (node, inner) => {
          const style = getComputedStyle(node);
          const vertical =
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            node.scrollHeight > node.clientHeight + 1;
          const horizontal =
            (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
            node.scrollWidth > node.clientWidth + 1;
          const box = node.getBoundingClientRect();
          const down = inner.bottom > box.bottom + 1;
          const across = inner.right > box.right + 1;
          return (down && vertical) || (across && horizontal);
        };
        const escapes = (node, parent) => {
          const inner = node.getBoundingClientRect();
          const outer = parent.getBoundingClientRect();
          return (
            inner.left < outer.left - 1 ||
            inner.right > outer.right + 1 ||
            inner.top < outer.top - 1 ||
            inner.bottom > outer.bottom + 1
          );
        };
        const mustFit =
          '.mn-space-wrap, .mn-space, .mn-space-name, .mn-space-price, .mn-space-earn, .mn-crew-slots, .mn-lane-meta, .mn-lane-position, .mn-payout-label, .mn-position-readout, .mn-lane-heading, .mn-crew, .mn-dock-group, .mn-specialist-group, .mn-merchant-card, .mn-merchant-name, .mn-merchant-stats, .mn-market-title, .mn-market-track, .mn-track, .mn-board-actions, .mn-board-market, .mn-shore, .mn-lanes';
        const cells =
          '.mn-lane, .mn-dock-group, .mn-specialist-group, .mn-merchant-card, .mn-market-row';
        const clipped = [];
        const clippedSeen = new Set();
        for (const node of root.querySelectorAll(mustFit)) {
          if (!visible(node) || node.closest('[aria-hidden="true"]')) continue;
          if (
            node.children.length === 0 &&
            node.scrollWidth > node.clientWidth + 1
          ) {
            clipped.push({
              part: describe(node),
              reason: 'text wider than its own box',
            });
            continue;
          }
          const cell = node.closest(cells);
          if (cell && cell !== node && escapes(node, cell)) {
            const key = describe(node) + ' in ' + describe(cell);
            if (!clippedSeen.has(key)) {
              clippedSeen.add(key);
              clipped.push({
                part: describe(node),
                reason: 'leaves ' + describe(cell),
                box: rect(node),
                cell: rect(cell),
              });
            }
            continue;
          }
          for (
            let parent = node.parentElement;
            parent && parent !== root.parentElement;
            parent = parent.parentElement
          ) {
            if (!clips(parent)) continue;
            if (!escapes(node, parent)) continue;
            if (scrolls(parent, node.getBoundingClientRect())) break;
            const key = describe(node) + ' < ' + describe(parent);
            if (!clippedSeen.has(key)) {
              clippedSeen.add(key);
              clipped.push({
                part: describe(node),
                reason: 'escapes ' + describe(parent),
                box: rect(node),
                cell: rect(parent),
              });
            }
            break;
          }
        }
        const intersect = (a, b) => {
          const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          return across > 2 && down > 2 ? Math.round(across * down) : 0;
        };
        const blockSelectors = [
          '.mn-lanes',
          '.mn-shore',
          '.mn-board-market',
          '.mn-board-actions',
          '.mn-merchant-rack',
          '.mn-private',
        ];
        const boxes = blockSelectors
          .map((selector) => ({ selector, node: root.querySelector(selector) }))
          .filter((entry) => entry.node && visible(entry.node))
          .map((entry) => ({
            selector: entry.selector,
            box: entry.node.getBoundingClientRect(),
          }));
        const collisions = [];
        for (let a = 0; a < boxes.length; a++)
          for (let b = a + 1; b < boxes.length; b++) {
            const area = intersect(boxes[a].box, boxes[b].box);
            if (area)
              collisions.push({
                pair: boxes[a].selector + ' 与 ' + boxes[b].selector,
                area,
              });
          }
        const groups = [
          ['lane', '.mn-lanes > .mn-lane'],
          ['dock', '.mn-shore .mn-dock-group'],
          ['specialist', '.mn-shore .mn-specialist-group'],
          ['merchant', '.mn-merchant-card'],
          ['marketRow', '.mn-board-market .mn-market-row'],
          ['boardChild', '.mn-harbor > *'],
        ];
        for (const [topic, selector] of groups) {
          const list = [...root.querySelectorAll(selector)]
            .filter(visible)
            .map((node) => node.getBoundingClientRect());
          for (let a = 0; a < list.length; a++)
            for (let b = a + 1; b < list.length; b++) {
              const area = intersect(list[a], list[b]);
              if (area)
                collisions.push({
                  pair: topic + ' ' + (a + 1) + ' 与 ' + (b + 1),
                  area,
                });
            }
        }
        return {
          diceCoveringLabels: [
            ...root.querySelectorAll('.mn-lane-heading'),
          ].flatMap((heading) => {
            const die = heading.querySelector('.mn-die');
            if (!die || !visible(die)) return [];
            const box = die.getBoundingClientRect();
            return [
              ...heading.querySelectorAll(
                '.mn-detail-button > strong,.mn-cargo-payout > span,.mn-cargo-payout > strong',
              ),
              ...heading
                .closest('.mn-lane')
                .querySelectorAll(
                  '.mn-crew .mn-worker,.mn-crew .mn-position-readout,.mn-crew .mn-space-name',
                ),
            ]
              .filter(visible)
              .flatMap((label) => {
                const range = document.createRange();
                range.selectNodeContents(label);
                return [...range.getClientRects()].some(
                  (text) =>
                    Math.min(text.right, box.right) -
                      Math.max(text.left, box.left) >
                      1 &&
                    Math.min(text.bottom, box.bottom) -
                      Math.max(text.top, box.top) >
                      1,
                )
                  ? [label.textContent.trim()]
                  : [];
              });
          }),
          outerScrollAttempt: (() => {
            if (!root.classList.contains('mn-screen--player')) return null;
            window.scrollTo(0, 10000);
            const box = root.getBoundingClientRect();
            const result = {
              top: box.top,
              bottom: box.bottom,
              scrollY,
              height: innerHeight,
            };
            window.scrollTo(0, 0);
            return result;
          })(),
          timerCoveringStatus: (() => {
            const timer = root.querySelector('.mn-status .decision-countdown');
            if (!timer || !visible(timer)) return [];
            const box = timer.getBoundingClientRect();
            return [...root.querySelectorAll('.mn-current-turn-copy *')]
              .filter(
                (node) =>
                  visible(node) &&
                  [...node.childNodes].some(
                    (child) =>
                      child.nodeType === Node.TEXT_NODE &&
                      child.textContent.trim(),
                  ),
              )
              .flatMap((label) => {
                const range = document.createRange();
                range.selectNodeContents(label);
                return [...range.getClientRects()].some(
                  (text) => intersect(text, box) > 1,
                )
                  ? [label.textContent.trim()]
                  : [];
              });
          })(),
          statusBackground: getComputedStyle(root.querySelector('.mn-status'))
            .backgroundColor,
          abbreviatedLabels: [
            ...root.querySelectorAll(
              '.mn-position-readout,.mn-lane-heading > strong,.mn-lane-heading > .mn-detail-button > strong,.mn-space-name,.mn-space-price,.mn-space-earn',
            ),
          ]
            .filter(visible)
            .flatMap((node) => {
              const range = document.createRange();
              range.selectNodeContents(node);
              const sign = (
                node.closest(
                  '.mn-space,.mn-lane-heading > .mn-detail-button,.mn-lane-heading,.mn-crew',
                ) ?? node
              ).getBoundingClientRect();
              const box =
                getComputedStyle(node).overflowX === 'visible'
                  ? sign
                  : node.getBoundingClientRect();
              return [...range.getClientRects()].some(
                (text) =>
                  text.left < box.left - 1 ||
                  text.right > box.right + 1 ||
                  text.top < sign.top - 1 ||
                  text.bottom > sign.bottom + 1,
              )
                ? [node.textContent.trim()]
                : [];
            }),
          axis: root.querySelector('.mn-harbor')?.dataset.mnAxis,
          railAxes: [...root.querySelectorAll('.mn-track')].map((node) =>
            getComputedStyle(node).getPropertyValue('--mn-vertical').trim(),
          ),
          photoText: [
            ...root.querySelectorAll(
              '.mn-lane-heading > strong,.mn-track-cells span,.mn-position-readout,.mn-payout-label,.mn-manifest-kicker,.mn-manifest-empty,.mn-manifest-state,.mn-position-controls output',
            ),
          ]
            .filter(visible)
            .map((node) => {
              const style = getComputedStyle(node);
              let surface = node;
              while (
                surface.parentElement &&
                Number(
                  getComputedStyle(surface).backgroundColor.match(
                    /[\d.]+/g,
                  )?.[3] ?? 1,
                ) < 0.9
              )
                surface = surface.parentElement;
              return {
                text: node.textContent.trim(),
                color: style.color,
                background: getComputedStyle(surface).backgroundColor,
              };
            }),
          shipTicks: [...root.querySelectorAll('.mn-lane')].flatMap((lane) => {
            const images = [...lane.querySelectorAll('.mn-boat img')].filter(
              visible,
            );
            const ticks = [
              ...lane.querySelectorAll('.mn-track-cells span'),
            ].filter(visible);
            return images.flatMap((image) =>
              ticks.map((tick) => {
                const a = image.getBoundingClientRect(),
                  b = tick.getBoundingClientRect();
                const dx = Math.max(a.left - b.right, b.left - a.right, 0);
                const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
                return {
                  tick: tick.textContent,
                  gap: Math.hypot(dx, dy),
                  image: rect(image),
                  label: rect(tick),
                };
              }),
            );
          }),
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
            lanes: rect(root.querySelector('.mn-lanes')),
            market: rect(root.querySelector('.mn-board-market')),
            rack: rect(root.querySelector('.mn-merchant-rack')),
            seats: root.querySelectorAll('.mn-merchant-card').length,
          },
          marketDebug: (() => {
            const panel = root.querySelector(
              '.mn-board-market .mn-market-panel',
            );
            const market = root.querySelector('.mn-board-market .mn-market');
            if (!panel || !market) return null;
            const row = market.querySelector('.mn-market-row');
            return {
              panel: rect(panel),
              market: rect(market),
              marketHeight: getComputedStyle(market).height,
              marketRows: getComputedStyle(market).gridTemplateRows,
              rowHeight: row ? getComputedStyle(row).height : null,
              rowRows: row ? getComputedStyle(row).gridTemplateRows : null,
              rowBox: row ? rect(row) : null,
            };
          })(),
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
          playerWide: root.classList.contains('mn-screen--player')
            ? {
                rack: rect(root.querySelector('.mn-merchant-rack')),
                market: rect(root.querySelector('.mn-board-market')),
                harbor: rect(root.querySelector('.mn-harbor')),
                lanes: rect(root.querySelector('.mn-lanes')),
                shore: rect(root.querySelector('.mn-shore')),
                docks: rect(root.querySelector('.mn-docks')),
                specialists: rect(root.querySelector('.mn-specialists')),
                actions: rect(root.querySelector('.mn-board-actions')),
                screen: rect(root),
                scroll: rect(root.querySelector('.mn-player-scroll')),
                harborStyle: (() => {
                  const node = root.querySelector('.mn-harbor');
                  if (!node) return null;
                  const style = getComputedStyle(node);
                  return {
                    display: style.display,
                    areas: style.gridTemplateAreas,
                    columns: style.gridTemplateColumns,
                    rows: style.gridTemplateRows,
                  };
                })(),
              }
            : null,
          clipped,
          collisions,
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
      const expectedAxis =
        role === 'player' && width <= 620 ? 'vertical' : 'horizontal';
      assert.equal(
        geometry.axis,
        expectedAxis,
        `${role} ${width}: one explicit harbor axis`,
      );
      assert(
        geometry.railAxes.every(
          (axis) => axis === (expectedAxis === 'vertical' ? '1' : '0'),
        ),
        `${role} ${width}: artwork and hit testing use the same axis`,
      );
      if (expectedAxis === 'horizontal') {
        assert(
          geometry.shipTicks.length > 0,
          'Horizontal ship/tick guard has actual visible targets',
        );
        assert(
          geometry.shipTicks.every(({ gap }) => gap >= 8 - 0.1),
          `${role} ${width}: every visible scale number is separated from ship artwork by at least 8px`,
        );
      }
      assert(
        geometry.photoText.length > 0,
        'Photo text contrast guard has actual targets',
      );
      for (const entry of geometry.photoText) {
        const rgb = (value) => value.match(/[\d.]+/g).map(Number);
        const foreground = rgb(entry.color),
          background = rgb(entry.background);
        const luminance = (values) =>
          values
            .slice(0, 3)
            .map((value) => {
              const channel = value / 255;
              return channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4;
            })
            .reduce(
              (sum, value, index) =>
                sum + value * [0.2126, 0.7152, 0.0722][index],
              0,
            );
        const foregroundLight = luminance(foreground),
          backgroundLight = luminance(background);
        const contrast =
          (Math.max(foregroundLight, backgroundLight) + 0.05) /
          (Math.min(foregroundLight, backgroundLight) + 0.05);
        assert(
          backgroundLight > 0.5
            ? foreground.every((value, index) => index > 2 || value < 100)
            : foreground[0] >= 240 &&
                foreground[1] >= 235 &&
                foreground[2] >= 220,
          `Text uses ink on paper or warm white on dark backing: ${entry.text}`,
        );
        assert(
          (background[3] ?? 1) >= 0.9 && contrast >= 4.5,
          `Photo text has a stable backing with >=4.5:1 contrast: ${entry.text}`,
        );
      }
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
      if (role === 'player') {
        assert.ok(
          geometry.outerScrollAttempt.top >= -1 &&
            geometry.outerScrollAttempt.bottom <= height + 1 &&
            geometry.outerScrollAttempt.scrollY === 0,
          'Programmatic document scrolling cannot move the fixed player shell',
        );
      }
      if (role === 'player')
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
              geometry.playerLandscape.actions.y >=
                geometry.playerLandscape.lanes.bottom - 1,
            'Landscape pins the decision row under the lanes',
          );
          assert.ok(
            geometry.playerLandscape.actions.height >= 39,
            'Landscape keeps a full-height decision row',
          );
          assert.ok(
            geometry.scrollHeight <= height + 1,
            'Landscape does not need page scrolling',
          );
        }
      }
      if (role === 'player' && width >= 900 && height > 600) {
        assert.ok(
          geometry.scrollHeight <= height + 1,
          `${width}x${height}: wide player keeps the page still`,
        );
        assert.ok(
          geometry.playerWide?.rack,
          `${width}x${height}: merchant rack is visible`,
        );
        assert.ok(
          geometry.playerWide?.market,
          `${width}x${height}: board market is visible`,
        );
        assert.ok(
          geometry.playerWide?.actions,
          `${width}x${height}: decision area is visible`,
        );
      }
      if (role !== 'player')
        assert.equal(
          Number(geometry.statusBackground.match(/[\d.]+/g)?.[3] ?? 1),
          0,
          'Toolbar phase information shares the toolbar surface',
        );
      assert.deepEqual(
        geometry.abbreviatedLabels,
        [],
        `${role} ${width}: label text is fully inside its own sign`,
      );
      assert.deepEqual(
        geometry.diceCoveringLabels,
        [],
        `${role} ${width}: dice leave cargo labels and crew visible`,
      );
      assert.deepEqual(
        geometry.timerCoveringStatus,
        [],
        `${role} ${width}: countdown leaves all turn information visible`,
      );
      if (width >= 320) {
        if (geometry.clipped.length)
          pending.push({
            layout: `${width}x${height}`,
            kind: 'clipped',
            issues: geometry.clipped,
          });
        if (geometry.collisions.length)
          pending.push({
            layout: `${width}x${height}`,
            kind: 'overlap',
            issues: geometry.collisions,
          });
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
        assert.ok(composition.rack, `${role}: merchant rack is missing`);
        assert.ok(composition.market, `${role}: board market is missing`);
        assert.ok(
          composition.rack.y >= composition.main.bottom - 2,
          `${role}: merchant rack is not below the board`,
        );
        assert.ok(
          composition.market.x >= composition.lanes.right - 2,
          `${role}: board market is not in the right board column`,
        );
        assert.ok(
          composition.market.bottom <= composition.main.bottom + 2,
          `${role}: board market leaves the board`,
        );
        assert.ok(
          composition.rack.bottom <= height + 1,
          `${role}: merchant rack leaves the viewport`,
        );
        assert.equal(
          composition.seats,
          5,
          `${role}: every merchant remains visible in the rack`,
        );
        assert.ok(
          geometry.tailGap <= 20,
          `${role}: host/public board requires page scrolling`,
        );
      }
      await shot(role + '-' + width + 'x' + height);
    }
  }
  assert.deepEqual(
    pending,
    [],
    'Every role keeps every part inside its own box without overlapping',
  );
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
  // This legal all-six voyage reaches A/B/C; the seeded harbor fixture also
  // checks mixed port/shipyard results. Keep destination glyphs in both suites.
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const role of ['host', 'public']) {
    await page.evaluate(
      (role) => window.renderManila({ phase: 'round-result', role }),
      role,
    );
    const labels = await page
      .locator('.mn-position-readout')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const style = getComputedStyle(node),
            box = node.getBoundingClientRect(),
            range = document.createRange();
          range.selectNodeContents(node);
          return {
            text: node.textContent.trim(),
            overflow: style.textOverflow,
            clipped: [...range.getClientRects()].some(
              (text) =>
                text.left < box.left - 1 ||
                text.right > box.right + 1 ||
                text.top < box.top - 1 ||
                text.bottom > box.bottom + 1,
            ),
          };
        }),
      );
    report.destinations.push({ role, labels });
    assert.deepEqual(
      labels.map(({ text }) => text),
      ['靠港A', '靠港B', '靠港C'],
    );
    assert(
      labels.every(
        ({ overflow, clipped }) => overflow !== 'ellipsis' && !clipped,
      ),
      `${role}: every saved port letter is fully visible`,
    );
    await shot('destinations-' + role + '-1280x720');
  }
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
  report.inputsAfter = await fingerprint();
  report.inputBindingAfter = inputBinding;
  report.changedInputs = changedInputs(report.inputsBefore, report.inputsAfter);
  if (report.changedInputs.length) {
    report.result = 'failed';
    report.failures.push(
      'Relevant source inputs changed: ' + report.changedInputs.join(', '),
    );
    process.exitCode = 1;
  }
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
