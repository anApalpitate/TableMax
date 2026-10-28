import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, relative, sep, dirname } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { leanCatalogPlugin } from '../../../build/lean-catalog.mjs';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';

process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const option = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const task = option('task'),
  evidence = option('evidence');
assert.match(task ?? '', /^tmp\/[a-z0-9-]+$/);
assert.match(evidence ?? '', /^[a-z0-9-]+$/);
const root = process.cwd(),
  work = resolve(task, 'rummikub', evidence),
  output = resolve(
    'artifacts/maintenance',
    task.slice(4),
    'rummikub',
    evidence,
  );
await mkdir(work, { recursive: true });
await mkdir(dirname(output), { recursive: true });
await mkdir(output, { recursive: false });
process.env.TEMP = work;
process.env.TMP = work;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const local = (p) => relative(root, p).replaceAll('\\', '/');
const inputs = new Map();
async function bind(p) {
  const absolute = resolve(p);
  if (!existsSync(absolute) || absolute.includes(`${sep}node_modules${sep}`))
    return;
  const bytes = await readFile(absolute);
  const sha256 = hash(bytes);
  if (inputs.has(absolute))
    assert.equal(
      inputs.get(absolute).sha256,
      sha256,
      'Input changed: ' + absolute,
    );
  inputs.set(absolute, { path: local(absolute), sha256 });
}
const fixturePath = resolve(task, 'legal-fixtures.json');
await bind(fixturePath);
const fixture = JSON.parse(await readFile(fixturePath, 'utf8')).games.rummikub
  .playing.player;
await writeFile(join(work, 'base.json'), JSON.stringify(fixture));
for (const p of [
  'tools/test/games/rummikub/verify-rummikub-ui.mjs',
  'tools/test/games/rummikub/rummikub-source-layout.mjs',
  'tools/test/support/browser-test.mjs',
  'tools/test/support/fixture-server.mjs',
  'pnpm-lock.yaml',
])
  await bind(p);
const file = (p) => JSON.stringify(resolve(p).replaceAll('\\', '/'));
await writeFile(
  join(work, 'index.html'),
  '<html><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>',
);
await writeFile(
  join(work, 'entry.tsx'),
  `
import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
import{PlatformGame}from ${file('apps/web/src/session/gameHostAdapter.tsx')};
import{client}from ${file('games/rummikub/web/index.tsx')};
import{rules}from ${file('games/rummikub/rules/index.ts')};
import{RandomSource}from ${file('packages/platform-core/src/random.ts')};
import{TILES}from ${file('games/rummikub/data/catalog.ts')};
import{parseMeld}from ${file('games/rummikub/shared/melds.ts')};
import ${file('apps/web/src/styles.css')};import ${file('apps/web/src/scrollbars.css')};
import base from './base.json';
const root=createRoot(document.getElementById('root')),noop=()=>{};let state,view,branch=0;
const seats=base.seats.map(s=>s.id),self=base.self.seatId,ctx={seats,random:new RandomSource(73)};
window.commands=[];
function reset(){state=rules.initialize(ctx);const table=[parseMeld(['blue-03-a','joker-a','blue-05-a'],{'joker-a':{color:'blue',value:4}},'run'),parseMeld(Array.from({length:13},(_,i)=>'red-'+String(i+1).padStart(2,'0')+'-a'))];const wanted=['blue-04-a','black-09-a','orange-09-a','blue-09-a','joker-b'];const used=new Set([...table.flatMap(m=>m.tiles.map(p=>p.tileId)),...wanted]);const rest=TILES.map(t=>t.id).filter(id=>!used.has(id));const own=[...wanted,...rest.splice(0,30-wanted.length)];state.table=table;state.racks=Object.fromEntries(seats.map(id=>[id,id===self?own:rest.splice(0,14)]));state.pool=rest;state.opened=Object.fromEntries(seats.map(id=>[id,true]));state.turnSeat=self;state.startSeat=self;state.turnNumber=17;state.serial=16;state.latest={serial:16,actor:seats.find(id=>id!==self),verb:'draw',text:'摸牌，结束回合。',placedTileIds:[]};rules.validateState(state,seats);window.fixtureState=state;branch++;render();}
function render(){view={...base,gameView:rules.project(state,{role:'player',seatId:self}),actions:rules.legalActions(state,self),branch,decisionId:'source-'+branch,instanceId:'rummikub-source',revision:branch};const session={role:'player',view,isHost:false,canControl:false,canManageSeats:false,self:view.seats.find(s=>s.id===self),credential:'fixture',connected:true,locked:false,busy:false,message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],saved:false,submitting:false,name:'',setName:noop,command:c=>window.commands.push(c),retry:noop,retryAdmission:noop,subscribeInteractions:()=>noop,subscribeInteractionReset:()=>noop,addresses:['127.0.0.1'],adapters:[],port:38473,catalog:view.catalog,games:view.catalog,address:'127.0.0.1',joinUrl:'http://127.0.0.1:38473/',externalJoinUrl:null,networkMessage:'',refreshNetwork:noop,setAddress:noop,saveExternalJoinUrl:async()=>true,join:noop,setPlayerCredential:noop};flushSync(()=>root.render(<PlatformGame session={session} client={client}/>));}
window.validateCommands=()=>window.commands.every(c=>rules.isLegalAction(state,c.action,self));window.resetFixture=()=>{sessionStorage.clear();window.commands=[];reset()};window.changeDecision=()=>{branch++;render()};window.renderLayout=()=>{document.documentElement.dataset.playerDisplay=innerWidth>=640?'wide':'portrait';render()};reset();window.renderLayout();
`,
);
const report = {
  result: 'running',
  scope:
    'Real Rummikub client and PlayerWorkshop with RoomCoordinator base metadata and controlled rules.validateState/project 106-tile fixtures. No network/save/device/installer proof.',
  checks: [],
  errors: [],
  screenshots: [],
  inputs: [],
  fixture: {
    rack: 30,
    longRun: 13,
    tableJoker: 'blue4',
    method:
      'Existing controlled state pattern; not naturally reached game history',
  },
};
let browser, server;
try {
  const aliases = {
    '@tablemax/web-host/platform': resolve('packages/web-host/src/platform.ts'),
    '@tablemax/web-host': resolve('packages/web-host/src/index.tsx'),
    '@tablemax/protocol': resolve('packages/protocol/src/index.ts'),
    '@tablemax/game-sdk/metadata': resolve(
      'packages/game-sdk/src/metadata.mjs',
    ),
    '@tablemax/game-sdk/module-manifest': resolve(
      'packages/game-sdk/src/module-manifest.ts',
    ),
    '@tablemax/game-sdk': resolve('packages/game-sdk/src/index.ts'),
    zod: resolve('packages/protocol/node_modules/zod'),
    react: resolve('apps/web/node_modules/react'),
    'react-dom': resolve('apps/web/node_modules/react-dom'),
  };
  await build({
    root: work,
    configFile: false,
    base: './',
    assetsInclude: ['**/*.flac'],
    plugins: [
      leanCatalogPlugin(root),
      react(),
      {
        name: 'bind-inputs',
        async load(id) {
          const p = id.split('?')[0];
          if (!p.startsWith('\0')) await bind(p);
          return null;
        },
      },
    ],
    resolve: {
      alias: Object.entries(aliases).map(([find, replacement]) => ({
        find,
        replacement,
      })),
    },
    build: {
      outDir: join(work, 'bundle'),
      target: 'chrome110',
      emptyOutDir: true,
    },
    logLevel: 'error',
  });
  server = await serveFixture(join(work, 'bundle'));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  report.environment = {
    node: process.version,
    browser: browser.version(),
    hidden: true,
    reducedMotion: true,
  };
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript(() =>
    localStorage.setItem('tablemax-sound-enabled', 'false'),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto(server.url);
  await page.waitForFunction(() => typeof window.resetFixture === 'function');
  const draft = () =>
    page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem('tablemax:rummikub:turn-draft'))
          .draft,
    );
  const screenshot = async (id) => {
    const p = join(output, id + '.png');
    await page.screenshot({ path: p, fullPage: true, animations: 'disabled' });
    report.screenshots.push({
      id,
      path: local(p),
      sha256: hash(await readFile(p)),
    });
  };
  const select = async (id, scope = '[data-own-rack]') => {
    await page.locator(scope + ' button[data-tile-id="' + id + '"]').click();
  };
  let failures = 0;
  for (const [width, height] of [
    [390, 844],
    [1280, 720],
  ]) {
    if (failures >= 10) break;
    const id = 'workshop-' + width;
    const check = { id, result: 'running', facts: {} };
    report.checks.push(check);
    try {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => {
        window.resetFixture();
        window.renderLayout();
      });
      await page.locator('[data-turn-workshop]').waitFor();
      assert.equal(
        await page.locator('[data-own-rack] button[data-tile-id]').count(),
        30,
      );
      assert.equal(
        await page
          .locator('[data-group-id="saved-1"] button[data-tile-id]')
          .count(),
        13,
      );
      const baseline = await draft();
      await screenshot(id + '-initial');
      const reachability = [];
      for (const selector of [
        '[data-own-rack] button[data-tile-id]',
        '[data-group-id="saved-1"] button[data-tile-id]',
      ]) {
        const buttons = page.locator(selector);
        const count = await buttons.count();
        for (let index = 0; index < count; index++) {
          const button = buttons.nth(index);
          await button.click();
          const target = await button.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const hit = document.elementFromPoint(
              rect.x + rect.width / 2,
              rect.y + rect.height / 2,
            );
            return {
              id: element.dataset.tileId,
              width: rect.width,
              height: rect.height,
              hit: hit === element || element.contains(hit),
            };
          });
          assert(
            target.hit && target.width >= 44 && target.height >= 44,
            'Every tile can be reached and hit at 44px or greater',
          );
          reachability.push(target);
          await button.click();
        }
      }
      await select('red-08-a', '[data-draft-table]');
      await page
        .getByRole('button', { name: '第 2 组操作', exact: true })
        .click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: '从选中牌拆分', exact: true })
        .click();
      assert.equal((await draft()).groups.length, 3);
      await page.getByRole('button', { name: '撤销', exact: true }).click();
      assert.deepEqual(await draft(), baseline);
      await select('blue-04-a');
      await page.getByRole('button', { name: '建立新组', exact: true }).click();
      assert(await page.locator('[data-submit-turn]').isDisabled());
      await page.getByRole('button', { name: '撤销', exact: true }).click();
      assert.deepEqual(await draft(), baseline);
      await select('blue-04-a');
      await page.getByRole('button', { name: '建立新组', exact: true }).click();
      const saved = await draft();
      await page.setViewportSize({
        width: width === 390 ? 1280 : 390,
        height: width === 390 ? 720 : 844,
      });
      await page.evaluate(() => window.renderLayout());
      assert.deepEqual(await draft(), saved, 'Resize preserves draft');
      assert.equal(await page.locator('[data-turn-workshop]').count(), 1);
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.renderLayout());
      await page.getByRole('button', { name: '重置', exact: true }).click();
      assert.deepEqual(await draft(), baseline);
      await select('joker-a', '[data-draft-table]');
      await page.getByRole('button', { name: '更多', exact: true }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: '指定百搭颜色数字', exact: true })
        .click();
      await page.getByRole('dialog').getByRole('spinbutton').fill('4');
      await page
        .getByRole('dialog')
        .getByRole('button', { name: '确定百搭', exact: true })
        .click();
      await screenshot(id + '-joker');
      await page.getByRole('button', { name: '取消选牌', exact: true }).click();
      await select('black-09-a');
      await page.getByRole('button', { name: '建立新组', exact: true }).click();
      await page.evaluate(() => window.changeDecision());
      assert.deepEqual(
        await draft(),
        baseline,
        'Decision scope invalidates old draft',
      );
      assert.equal(await page.evaluate(() => window.commands.length), 0);
      for (const tile of ['black-09-a', 'orange-09-a', 'blue-09-a'])
        await select(tile);
      await page.getByRole('button', { name: '建立新组', exact: true }).click();
      assert(await page.locator('[data-submit-turn]').isEnabled());
      await screenshot(id + '-legal-draft');
      await page.locator('[data-submit-turn]').click();
      assert.equal(await page.evaluate(() => window.commands.length), 1);
      assert(
        await page.evaluate(() => window.validateCommands()),
        'Submitted action is legal under real rules',
      );
      check.facts = {
        rack: 30,
        longRun: 13,
        undo: true,
        resizeDraft: true,
        decisionReset: true,
        jokerDialog: true,
        reachability,
        longRunSplitUndo: true,
        legalSubmit: true,
        commands: await page.evaluate(() => window.commands),
      };
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      check.result = 'passed';
    } catch (error) {
      failures++;
      check.result = 'failed';
      check.error = String(error.stack ?? error);
      await screenshot(id + '-failure');
    }
  }
  report.result =
    report.checks.every((c) => c.result === 'passed') && !report.errors.length
      ? 'passed'
      : 'failed';
} catch (error) {
  report.result = 'failed';
  report.errors.push(String(error.stack ?? error));
} finally {
  await browser?.close();
  await server?.close();
  for (const input of inputs.values())
    if (hash(await readFile(resolve(input.path))) !== input.sha256) {
      report.result = 'failed';
      report.errors.push('Input changed: ' + input.path);
    }
  report.inputs = [...inputs.values()];
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.map((c) => ({ id: c.id, result: c.result })),
      errors: report.errors,
      report: local(join(output, 'report.json')),
    }),
  );
  if (report.result !== 'passed') process.exitCode = 1;
}
