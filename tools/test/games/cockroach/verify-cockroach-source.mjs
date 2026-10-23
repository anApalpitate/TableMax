import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  cp,
  readdir,
} from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';

process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const name = process.argv.find((a) => a.startsWith('--evidence='))?.slice(11);
const densityOnly = process.argv.includes('--density-only');
assert.match(name ?? '', /^[a-z0-9-]{1,65}$/);
const output = resolve('artifacts/maintenance/cockroach-source', name);
await mkdir(output, { recursive: true });
const reportPath = join(output, 'report.json');
await writeFile(reportPath, '{}', { flag: 'wx' });
const work = await mkdtemp(resolve('tmp/cockroach-source-'));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const report = {
  scope: ['game:cockroach-poker', 'game:cockroach-salad'],
  inputs: {},
  checks: [],
  failures: [],
  boundary:
    'Production game clients and rule-derived fixtures in a hidden muted desktop browser. Commands apply actual game rules in memory; platform management slots are fixture placeholders. No network authority, SQLite, physical device or installer evidence.',
};
const source = await readFile(new URL(import.meta.url));
await writeFile(join(output, 'verifier-source.mjs'), source);
report.inputs['tools/test/games/cockroach/verify-cockroach-source.mjs'] =
  hash(source);
const file = (p) => JSON.stringify(resolve(p).replaceAll('\\', '/'));
async function bindTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await bindTree(path);
    else if (entry.isFile())
      report.inputs[relative(resolve('.'), path).replaceAll('\\', '/')] = hash(
        await readFile(path),
      );
  }
}
for (const game of ['cockroach-poker', 'cockroach-salad'])
  await bindTree(resolve('assets/games', game));
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
import {HostedGame} from ${file('packages/web-host/src/index.tsx')};
import {configureGameHost} from ${file('packages/web-host/src/presentation-services.ts')};
import {client as poker} from ${file('games/cockroach-poker/web/index.tsx')};
import {Card as PokerCard,cardAssetFile} from ${file('games/cockroach-poker/ui/Theme.tsx')};
import {client as salad} from ${file('games/cockroach-salad/web/index.tsx')};
import {rules as pokerRules} from ${file('games/cockroach-poker/rules/index.ts')};
import {rules as saladRules} from ${file('games/cockroach-salad/rules/index.ts')};
import ${file('apps/web/src/styles.css')};
configureGameHost({ScreenLink:p=><a {...p}/>,FullscreenControl:()=>null,DisplaySettings:()=>null,useAudioOutput:()=>false,claimAudioEvent:()=>false,avatarFor:()=>'',avatarChoices:[]});
const root=createRoot(document.getElementById('root'));
const fixtures={poker:{rules:pokerRules,client:poker},salad:{rules:saladRules,client:salad}};
let current, state, role, self, revision=0, feedback=null, seed=223;
const random={next(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}};
const seats=Array.from({length:6},(_,i)=>({id:'s'+i,name:['桌游伙伴名字八字','SixteenLetterABC','玩家丙','玩家丁','玩家戊','玩家己'][i],controller:'human',ready:true,online:true,avatarId:'preset-01',botDifficulty:null}));
window.commands=[];
function render(){
 const decisions=current.rules.decisions(state), decision=decisions.find(d=>d.seatId===self);
 const game=current.rules.project(state,role==='player'?{role:'player',seatId:self}:{role:'public'});
 const pending=current.rules.automaticAction?.(state);
 const view={instanceId:'source-fixture',revision,branch:0,status:current.rules.ended(state)?'ended':'playing',paused:false,seats:seats.slice(0,state.seats.length),self:{role,seatId:role==='player'?self:null},game:{...current.rules.manifest,min:2,max:6},gameView:game,decisionId:decision?.id??null,selectionToken:decision?.id??null,actions:role==='player'&&decision?current.rules.legalActions(state,self):[],lifecycleActions:[],history:[],joinOpen:false,ownerSeatId:null,decisionClock:null,automaticTiming:pending?{key:'a'.repeat(64),remainingMs:pending.delayMs,serverTime:Date.now(),running:true}:null};
 const session={role,view,self:view.seats.find(s=>s.id===self),connected:true,locked:false,canControl:role==='host',message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback,errorId:'',motion:[],command(value){window.commands.push(value);if(value.type==='game'){const result=current.rules.apply(state,value.action,self,{seats:state.seats,random});state=current.rules.validateState(result.state,state.seats);revision++;feedback={instanceId:view.instanceId,branch:0,revision,events:result.events??[]};render();}}};
 flushSync(()=>root.render(<HostedGame key={role+current.rules.manifest.id} session={session} client={current.client} presentation={{management:()=>null,feedback:()=>null,playMode:()=>null,countdown:()=>null}}/>));
 window.snapshot={game,actions:view.actions,decisionId:view.decisionId};
}
window.setup=(id,newRole,count=6,stage='opening')=>{current=fixtures[id];role=newRole;revision=0;feedback=null;seed=223;window.commands=[];state=current.rules.initialize({seats:seats.slice(0,count).map(s=>s.id),random});self=state.seats[0];
 if(id==='poker'&&stage!=='opening'){const a=current.rules.legalActions(state,self).find(a=>a.type==='offer');state=current.rules.apply(state,a,self,{seats:state.seats,random}).state;self=a.target;if(stage==='peek')state=current.rules.apply(state,{type:'peek'},self,{seats:state.seats,random}).state;}
 if(id==='salad'&&stage!=='opening'){if(stage==='overtime'){state=current.rules.applyAutomatic(state,current.rules.automaticAction(state).action,{seats:state.seats,random}).state;}else{state=current.rules.apply(state,{type:'answer',answer:'tomato'},self,{seats:state.seats,random}).state;}self=state.seats[1];}
 current.rules.validateState(state,state.seats);render();};
window.setup('poker','player');
window.pokerArtFiles=Array.from({length:64},(_,card)=>cardAssetFile(card));
window.showPokerArt=()=>flushSync(()=>root.render(<main className="cp-theme"><div className="cp-hand">{Array.from({length:64},(_,card)=><PokerCard key={card} card={card}/>)}</div></main>));
`,
);
let server, browser;
try {
  await build({
    configFile: false,
    root: work,
    plugins: [
      {
        name: 'bind-source',
        async transform(_, id) {
          const path = resolve(id.split('?')[0]);
          if (
            !path.startsWith(resolve('.')) ||
            path.includes('node_modules') ||
            path.startsWith(work)
          )
            return;
          try {
            report.inputs[relative(resolve('.'), path).replaceAll('\\', '/')] =
              hash(await readFile(path));
          } catch {
            // Vite virtual modules have no source file to bind.
          }
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
    logLevel: 'error',
  });
  for (const id of ['cockroach-poker', 'cockroach-salad'])
    await cp(
      resolve('assets/games', id),
      join(work, 'bundle/assets/games', id),
      { recursive: true },
    );
  server = await serveFixture(join(work, 'bundle'));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (error) =>
    report.failures.push({ id: 'browser-error', error: String(error) }),
  );
  await page.goto(server.url);
  await page.waitForFunction(() => typeof window.setup === 'function');
  async function check(id, fn) {
    if (report.failures.length >= 10) return;
    try {
      await fn();
      report.checks.push({ id, passed: true });
    } catch (error) {
      report.failures.push({ id, error: String(error) });
    }
  }
  if (!densityOnly) {
    await check('physical-poker-card-identity-and-all-64-images', async () => {
      const kinds = [
        'cockroach',
        'stink-bug',
        'bat',
        'spider',
        'fly',
        'toad',
        'rat',
        'scorpion',
      ];
      assert.deepEqual(
        await page.evaluate(() => window.pokerArtFiles),
        kinds.flatMap((kind) =>
          Array.from(
            { length: 8 },
            (_, i) => `runtime/cards/${kind}-${i + 1}.webp`,
          ),
        ),
        'Stable physical card IDs must select the corresponding eight illustrations',
      );
      await page.evaluate(() => window.showPokerArt());
      const images = await page
        .locator('main img')
        .evaluateAll(async (nodes) => {
          await Promise.all(nodes.map((node) => node.decode()));
          return nodes.map((node) => ({
            src: node.currentSrc,
            width: node.naturalWidth,
            height: node.naturalHeight,
          }));
        });
      assert.equal(images.length, 64);
      assert.equal(new Set(images.map((image) => image.src)).size, 64);
      assert(
        images.every((image) => image.width === 137 && image.height === 220),
      );
      report.checks.push({
        id: 'physical-poker-image-details',
        passed: true,
        images,
      });
    });
    await check('physical-salad-all-eight-faces-and-back', async () => {
      const resources = [
        ...['normal', 'taboo'].flatMap((type) =>
          ['tomato', 'lettuce', 'cauliflower', 'pepper'].map(
            (vegetable) => `${type}-${vegetable}.webp`,
          ),
        ),
        'back.webp',
      ];
      const results = await page.evaluate(async (files) => {
        const results = [];
        for (const file of files) {
          const url = `/assets/games/cockroach-salad/runtime/${file}`;
          const response = await fetch(url);
          const image = new Image();
          image.src = url;
          await image.decode();
          results.push({
            file,
            status: response.status,
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
        }
        return results;
      }, resources);
      assert(
        results.every(
          (result) =>
            result.status === 200 &&
            result.width === 116 &&
            result.height === 220,
        ),
        JSON.stringify(results),
      );
      report.checks.push({
        id: 'physical-salad-image-details',
        passed: true,
        images: results,
      });
    });
  }
  const sizes = [
    [320, 568],
    [390, 844],
    [844, 390],
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ];
  if (!densityOnly)
    for (const game of ['poker', 'salad'])
      for (const role of ['player', 'host', 'public'])
        for (const [width, height] of sizes) {
          await check([game, role, width, height].join('-'), async () => {
            await page.setViewportSize({ width, height });
            await page.evaluate(({ game, role }) => window.setup(game, role), {
              game,
              role,
            });
            await page.locator('main').waitFor();
            await page.evaluate(
              () =>
                new Promise((done) =>
                  requestAnimationFrame(() => requestAnimationFrame(done)),
                ),
            );
            const result = await page.evaluate(async () => {
              await document.fonts.ready;
              await Promise.all(
                [...document.images].map((i) => i.decode().catch(() => {})),
              );
              const main = document.querySelector('main');
              const hand = document.querySelector('.cp-hand');
              const answerImages = [
                ...document.querySelectorAll('.salad-answer-buttons img'),
              ].map((image) => {
                const box = image.getBoundingClientRect();
                const ratio = image.naturalWidth / image.naturalHeight;
                return {
                  width: Math.min(box.width, box.height * ratio),
                  height: Math.min(box.height, box.width / ratio),
                };
              });
              const images = [...document.images].filter(
                (i) => i.offsetParent !== null,
              );
              const svgImages = await Promise.all(
                [...document.querySelectorAll('svg image')].map(
                  async (node) => {
                    const image = new Image();
                    image.src = node.href.baseVal;
                    await image.decode();
                    return {
                      src: node.href.baseVal,
                      valid: image.naturalWidth > 0,
                    };
                  },
                ),
              );
              return {
                width: innerWidth,
                scroll: document.documentElement.scrollWidth,
                answerImages,
                hand: hand
                  ? {
                      overflowing: hand.scrollWidth > hand.clientWidth + 1,
                      hint: !!document.querySelector('.cp-hand-hint'),
                      snap: getComputedStyle(hand).scrollSnapType,
                    }
                  : null,
                images: [
                  ...images.map((i) => ({
                    src: i.getAttribute('src'),
                    valid: i.complete && i.naturalWidth > 0,
                  })),
                  ...svgImages,
                ],
                small: [
                  ...main.querySelectorAll(
                    'button,strong,p,h1,h2,h3,legend,label,span',
                  ),
                ]
                  .filter(
                    (e) =>
                      e.offsetParent !== null &&
                      e.textContent.trim() &&
                      getComputedStyle(e).fontSize.replace('px', '') * 1 < 16,
                  )
                  .map((e) => ({
                    tag: e.tagName,
                    text: e.textContent.slice(0, 35),
                    size: getComputedStyle(e).fontSize,
                  })),
              };
            });
            assert(result.scroll <= result.width + 1, JSON.stringify(result));
            if (game === 'poker' && role === 'player') {
              assert.equal(result.hand.hint, result.hand.overflowing);
              assert.equal(result.hand.snap, 'x mandatory');
              if (width === 390) {
                await page
                  .locator('.cp-hand button')
                  .last()
                  .scrollIntoViewIfNeeded();
                const finalCard = await page
                  .locator('.cp-hand')
                  .evaluate((hand) => {
                    const bounds = hand.getBoundingClientRect();
                    const card = hand.lastElementChild.getBoundingClientRect();
                    return {
                      left: card.left - bounds.left,
                      right: bounds.right - card.right,
                    };
                  });
                assert(
                  finalCard.left >= -1 && finalCard.right >= -1,
                  JSON.stringify(finalCard),
                );
                await page
                  .locator('.cp-hand button')
                  .first()
                  .scrollIntoViewIfNeeded();
              }
            }
            if (game === 'salad' && role === 'player' && width <= 800) {
              assert.equal(result.answerImages.length, 5);
              assert(
                result.answerImages.every(
                  (image) => image.width >= 24 && image.height >= 46,
                ),
                JSON.stringify(result.answerImages),
              );
            }
            assert(
              result.images.every((i) => i.valid),
              'Image decode: ' +
                JSON.stringify(result.images.filter((i) => !i.valid)),
            );
            assert.equal(
              result.small.length,
              0,
              'Small text: ' + JSON.stringify(result.small),
            );
            const geometry = await page.evaluate(() => {
              const rect = (selector) =>
                document
                  .querySelector(selector)
                  ?.getBoundingClientRect()
                  .toJSON();
              return {
                title: rect('main h1'),
                controls: rect('.cp-controls,.salad-answer-buttons'),
                answer: rect('.salad-answer'),
              };
            });
            assert(
              geometry.title.height <= 80,
              'Title squeezed into vertical text: ' + JSON.stringify(geometry),
            );
            if (role === 'player' && width < 900) {
              assert(
                geometry.controls?.top < 650,
                'Primary actions pushed below secondary content: ' +
                  JSON.stringify(geometry),
              );
            }
            if (game === 'salad' && role !== 'player' && width >= 1280) {
              assert(
                geometry.answer.bottom <= height,
                'Public answer outside initial short-screen view: ' +
                  JSON.stringify(geometry),
              );
            }
            if (role !== 'player')
              assert.equal(
                await page
                  .locator('main button')
                  .filter({ hasText: /相信|质疑错误|选好牌/ })
                  .count(),
                0,
              );
            if ((width === 390 || width === 1280) && role !== 'host')
              await captureBrowserScreenshot(page, {
                path: join(
                  output,
                  [game, role, width, height].join('-') + '.png',
                ),
                fullPage: true,
              });
          });
        }
  if (!densityOnly)
    for (const game of ['poker', 'salad'])
      await check(game + '-rules-dialog', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate((game) => window.setup(game, 'player'), game);
        await page
          .getByRole('button', { name: '图文规则', exact: true })
          .click();
        await page.getByRole('dialog').waitFor();
        assert((await page.getByRole('dialog').innerText()).length > 300);
        assert((await page.getByRole('dialog').locator('img').count()) > 0);
        await captureBrowserScreenshot(page, {
          path: join(output, game + '-rules.png'),
          fullPage: true,
        });
        if (game === 'salad') {
          await page.setViewportSize({ width: 320, height: 568 });
          const example = await page
            .locator('.salad-rule-flow')
            .evaluate((node) => ({
              width: node.getBoundingClientRect().width,
              scrollWidth: node.scrollWidth,
              fonts: [...node.querySelectorAll('span, strong, figcaption')].map(
                (text) => Number.parseFloat(getComputedStyle(text).fontSize),
              ),
            }));
          assert(
            example.fonts.length >= 7 &&
              example.fonts.every((size) => size >= 16),
          );
          assert(example.scrollWidth <= example.width + 1);
          await page.locator('.salad-rule-flow').scrollIntoViewIfNeeded();
          await captureBrowserScreenshot(page, {
            path: join(output, 'salad-rules-320.png'),
            fullPage: true,
          });
        }
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog').count(), 0);
      });
  if (!densityOnly)
    await check('salad-wrong-options-and-common-window', async () => {
      await page.evaluate(() => window.setup('salad', 'player'));
      const buttons = page.locator('.salad-answer-buttons button');
      assert.equal(await buttons.count(), 5);
      assert.equal(await buttons.filter({ visible: true }).count(), 5);
      for (let i = 0; i < 5; i++) assert(await buttons.nth(i).isEnabled());
      await buttons.nth(0).click();
      assert.equal(await page.evaluate(() => window.commands.length), 1);
      await page.evaluate(() => window.setup('salad', 'player', 6, 'review'));
      await page.getByRole('button', { name: '质疑错误／拖延' }).click();
      await page.getByText(/已秘密提交/).waitFor();
      assert.equal(await page.evaluate(() => window.commands.length), 1);
    });
  if (!densityOnly)
    await check('poker-belief-and-peek-commitment', async () => {
      await page.evaluate(() => window.setup('poker', 'player', 6, 'offer'));
      await page.getByRole('button', { name: /相信/ }).click();
      assert.equal(
        await page.evaluate(() => window.commands[0].action.type),
        'judge',
      );
      await page.evaluate(() => window.setup('poker', 'player', 6, 'offer'));
      await page.getByRole('button', { name: /查看/ }).click();
      assert.equal(
        await page.evaluate(() => window.commands[0].action.type),
        'peek',
      );
      assert.equal(
        await page.getByRole('button', { name: /相信|质疑/ }).count(),
        0,
      );
    });
  if (!densityOnly)
    await check('poker-compose-offer-through-production-controls', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => window.setup('poker', 'player'));
      await page.locator('.cp-hand button').first().click();
      await page
        .locator('.cp-controls fieldset')
        .first()
        .getByRole('button')
        .first()
        .click();
      await page.locator('.cp-claims button').first().click();
      const confirm = page.locator('.cp-confirm');
      assert(await confirm.isEnabled());
      await confirm.click();
      assert.equal(
        await page.evaluate(() => window.commands[0].action.type),
        'offer',
      );
    });
  for (const scale of [1.25, 1.5]) {
    const denseContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: scale,
      reducedMotion: 'reduce',
    });
    const densePage = await denseContext.newPage();
    await densePage.goto(server.url);
    await densePage.waitForFunction(() => typeof window.setup === 'function');
    for (const game of ['poker', 'salad'])
      for (const role of ['player', 'host', 'public'])
        await check(`${game}-${role}-density-${scale}`, async () => {
          await densePage.evaluate(
            ({ game, role }) => window.setup(game, role),
            { game, role },
          );
          const geometry = await densePage.evaluate(() => ({
            scale: devicePixelRatio,
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
            title: document.querySelector('main h1').getBoundingClientRect()
              .height,
            animations: document
              .querySelector('main')
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === 'running').length,
          }));
          assert.equal(geometry.scale, scale);
          assert(geometry.scroll <= geometry.width + 1);
          assert(geometry.title < 80);
          assert.equal(
            geometry.animations,
            0,
            'Reduced motion must suppress running game animations',
          );
          if (role === 'player')
            await captureBrowserScreenshot(densePage, {
              path: join(output, `${game}-${role}-density-${scale}.png`),
              fullPage: true,
            });
        });
    await denseContext.close();
  }
  for (const [path, expected] of Object.entries(report.inputs))
    assert.equal(
      hash(await readFile(resolve(path))),
      expected,
      'Source changed during verification: ' + path,
    );
} catch (error) {
  report.failures.push({ id: 'environment-or-build', error: String(error) });
} finally {
  await browser?.close();
  await server?.close();
  report.passed = report.failures.length === 0;
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  if (process.env.TABLEMAX_TEST_OUTPUT_DIR)
    await writeFile(
      join(process.env.TABLEMAX_TEST_OUTPUT_DIR, 'results.json'),
      JSON.stringify({
        result: report.passed ? 'passed' : 'failed',
        failures: report.failures.length,
        report: reportPath,
      }) + '\n',
    );
}
console.log(
  JSON.stringify({
    passed: report.passed,
    checks: report.checks.length,
    failures: report.failures,
    report: relative(resolve('.'), reportPath),
  }),
);
if (!report.passed) process.exitCode = 1;
