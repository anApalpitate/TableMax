import { captureBrowserScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
import { verificationOutput } from '../support/verification-output.mjs';
import { leanCatalogPlugin } from '../../build/lean-catalog.mjs';
import { projectGameDetails } from '../../../packages/game-sdk/src/metadata.mjs';

const output = verificationOutput('game-library', 'run-' + Date.now());
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/box-layout-'));
await writeFile(
  join(work, 'index.html'),
  '<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  join(work, 'entry.tsx'),
  `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BoxScreen} from ${JSON.stringify(resolve('apps/web/src/screens/BoxScreen.tsx'))};
import {moduleCatalog} from ${JSON.stringify(resolve('apps/web/src/catalog.ts'))};
import {feedbackKind} from ${JSON.stringify(resolve('apps/web/src/content/feedback.ts'))};
import {useInstalledResources} from ${JSON.stringify(resolve('apps/web/src/components/game-library/server-resources.ts'))};
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
import ${JSON.stringify(resolve('apps/web/src/screens/box-screen.css'))};
// The authority supplies runtime capabilities after installation; browsing entries omit them.
const catalog=moduleCatalog.filter(m=>!m.internal).map(m=>({...m.catalog,decisionTimer:true}));
window.commands=[];
window.catalog=catalog;
window.moduleCatalog=moduleCatalog;
window.developmentIds=moduleCatalog.filter(m=>m.development).map(m=>m.id);
window.packageSnapshot=null;
window.trustedReleases=[];
window.packageOperations=[];
window.refreshFailure='';
window.holdCatalogRefresh=false;
const originalFetch=window.fetch.bind(window);
window.fetch=async (input,options)=>{
 const url=typeof input==='string'?input:input.url;
 if(!window.packageSnapshot)return originalFetch(input,options);
 if(url==='/api/game-packages')return new Response(JSON.stringify(window.packageSnapshot),{status:200,headers:{'Content-Type':'application/json'}});
 if(url==='/api/game-packages/manage'){
  const operation=JSON.parse(options.body);
  window.packageOperations.push(operation);
  if(operation.operation==='refresh'){
   await new Promise(resolve=>{window.finishCatalogRefresh=resolve;if(!window.holdCatalogRefresh)setTimeout(resolve,120)});
   if(window.refreshFailure)return new Response(JSON.stringify({ok:false,reason:window.refreshFailure}),{status:503,headers:{'Content-Type':'application/json'}});
   window.packageSnapshot={...window.packageSnapshot,catalog:{releases:window.trustedReleases}};
  }
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
 }
 return originalFetch(input,options);
};
let resourceSnapshot=[];
const resourceListeners=new Set();
window.resourceDownloads=[];
window.setResources=(entries)=>{resourceSnapshot=entries;for(const listener of resourceListeners)listener()};
const resources={getSnapshot:()=>resourceSnapshot,subscribe(listener){resourceListeners.add(listener);return()=>resourceListeners.delete(listener)},async download(key){window.resourceDownloads.push(key);window.setResources([{key,name:'宝可梦奇遇',status:{state:'downloading',progress:0.4}}])}};

const base={revision:12,instanceId:'fixture',branch:0,status:'lobby',game:catalog.find(g=>g.id==='uno'),catalog,seats:[],ownerSeatId:null,joinOpen:true,gameView:null,history:[],lifecycleActions:[],playMode:'play',decisionClock:null,capabilities:{manage:true}};
window.baseBox=base;
function App(){
 const [patch,setPatch]=useState({}),[name,setName]=useState('朋友');
 window.patchBox=(next)=>setPatch(previous=>({...previous,...next}));
 const message=patch.message??'';
 const session={role:'host',view:{...base,game:null},self:null,isHost:true,canControl:true,canManageSeats:true,locked:false,busy:false,connected:true,credential:'fixture',name,setName,message,messageKind:feedbackKind(message),errorId:'',admissionPending:false,admissionAvatarId:null,admissionAvatarImage:null,awaitingConfirmation:false,join(){},retry(){},retryAdmission(){},setPlayerCredential(){},command(command){window.commands.push(command)},addresses:[],adapters:[],address:'',port:38473,networkMessage:'',externalJoinUrl:null,setAddress(){},refreshNetwork(){},async saveExternalJoinUrl(){return true},...patch};
 const serverResources=useInstalledResources(session);
 window.serverResourceAdapter=serverResources.adapter;
 window.serverResourceManage=serverResources.manage;
 window.serverResourceRefresh=serverResources.refresh;
 window.serverResourceError=serverResources.error;
 return <BoxScreen session={session} resources={resources}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
`,
);
console.log('Building source box library fixture (about 10 seconds)…');
await build({
  configFile: false,
  root: work,
  plugins: [leanCatalogPlugin(resolve('.')), react()],
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
const server = await serveFixture(join(work, 'bundle'));
const browser = await launchTestBrowser({ channel: 'msedge', headless: true });
const report = {
  status: 'running',
  work,
  bundle: join(work, 'bundle'),
  checks: [],
  errors: [],
  layouts: [],
  detailRequests: [],
};
const checked = (message) => report.checks.push(message);
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.route('**/games/*/web/details.json', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/')[2];
    assert.match(id, /^[a-z][a-z0-9-]*$/);
    const module = JSON.parse(
      await readFile(resolve('games', id, 'game-module.json'), 'utf8'),
    );
    report.detailRequests.push(id);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(projectGameDetails(module)),
    });
  });
  await page.route('**/api/game-packages/releases/*/details', async (route) => {
    const module = JSON.parse(
      await readFile(resolve('games/avalon/game-module.json'), 'utf8'),
    );
    report.detailRequests.push('avalon-pinned');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(projectGameDetails(module)),
    });
  });
  await page.goto(server.url);
  const leanCatalog = await page.evaluate(() => window.moduleCatalog);
  for (const game of leanCatalog) {
    for (const field of [
      'introduction',
      'botIntroduction',
      'guidance',
      'budgets',
      'entries',
      'compatibility',
      'styles',
      'versions',
    ])
      assert.ok(!(field in game), `Catalog excludes ${field}`);
    assert.deepEqual(Object.keys(game.catalog).sort(), [
      'id',
      'max',
      'min',
      'name',
    ]);
    for (const variant of game.variants ?? [])
      assert.deepEqual(Object.keys(variant).sort(), [
        'description',
        'id',
        'name',
      ]);
  }
  for (const role of ['host', 'player', 'public']) {
    await page.evaluate(
      (role) =>
        window.patchBox({
          role,
          isHost: role === 'host',
          canControl: role === 'host',
          canManageSeats: role === 'host',
          view: { ...window.baseBox, game: null },
        }),
      role,
    );
    await page
      .getByRole('heading', { name: '请前往游戏库下载', exact: true })
      .waitFor();
    assert.equal(await page.locator('.hero .box-download-icon').count(), 1);
    assert.equal(await page.locator('.hero img').count(), 0);
    assert.equal(await page.locator('.box-screen > .game-library').count(), 0);
    assert.equal(await page.locator('.room-table__seat').count(), 6);
    if (role === 'host') {
      for (const [width, height] of [
        [320, 568],
        [390, 844],
        [844, 390],
        [1280, 720],
        [3840, 2160],
      ]) {
        await page.setViewportSize({ width, height });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${width}: empty lobby fits width`,
        );
        const bounds = await page
          .getByRole('button', { name: '游戏库', exact: true })
          .boundingBox();
        assert.ok(bounds.width >= 44 && bounds.height >= 44);
        await captureBrowserScreenshot(page, {
          path: join(output, `empty-box-${width}x${height}.png`),
        });
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      assert.ok(
        await page
          .getByRole('button', { name: '添加人机', exact: true })
          .isDisabled(),
      );
      assert.ok(
        await page
          .getByRole('button', { name: '开始游戏', exact: true })
          .isDisabled(),
      );
      await page
        .getByRole('button', { name: '管理设置', exact: true })
        .waitFor();
    }
    await page.getByRole('button', { name: '游戏库', exact: true }).click();
    await page.locator('.game-library-panel .game-library').waitFor();
    if (role !== 'host') {
      for (const button of await page
        .locator('.game-library-panel')
        .getByRole('button', { name: '下载资源', exact: true })
        .all()) {
        assert.ok(await button.isDisabled());
      }
    }
    await page.keyboard.press('Escape');
  }
  assert.deepEqual(report.detailRequests, []);
  checked(
    'Uninstalled catalog contains only browsing metadata and variant summaries; an empty box and its library request no game details.',
  );
  await page.evaluate(() =>
    window.patchBox({
      role: 'host',
      isHost: true,
      canControl: true,
      canManageSeats: true,
      view: window.baseBox,
    }),
  );
  checked(
    'Empty installation keeps the box lobby, six seats and download hero; library opens in a modal for all roles, administrator-only downloads and disabled game actions remain enforced.',
  );
  const repository = page.getByRole('link', {
    name: 'TableMax 的 GitHub 仓库（在新窗口打开）',
    exact: true,
  });
  assert.equal(
    await repository.getAttribute('href'),
    'https://github.com/anApalpitate/TableMax',
  );
  assert.equal(await repository.getAttribute('target'), '_blank');
  assert.ok((await repository.getAttribute('rel')).includes('noopener'));
  const repoBounds = await repository.boundingBox();
  assert.ok(repoBounds.width >= 44 && repoBounds.height >= 44);
  assert.equal(await repository.innerText(), 'TableMax');
  assert.equal(
    await page.locator('.box-footer,.box-repository-link').count(),
    0,
  );
  assert.equal(await repository.locator('svg').count(), 0);
  assert.equal(
    await repository.evaluate((el) => !!el.closest('.box-screen > header')),
    true,
  );
  for (const role of ['player', 'public', 'host']) {
    await page.evaluate(
      (role) =>
        window.patchBox({
          role,
          isHost: role === 'host',
          canControl: role === 'host',
          canManageSeats: role === 'host',
        }),
      role,
    );
    await repository.waitFor();
  }
  await page
    .context()
    .route('https://github.com/anApalpitate/TableMax', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>Repository destination fixture</title>',
      }),
    );
  const popup = await Promise.all([
    page.waitForEvent('popup'),
    repository.click(),
  ]);
  await popup[0].waitForLoadState();
  assert.equal(popup[0].url(), 'https://github.com/anApalpitate/TableMax');
  await popup[0].close();
  checked(
    'Top-left TableMax brand is the sole repository link on all three box roles; browser click opens the exact project destination.',
  );
  await page.getByRole('button', { name: '切换游戏', exact: true }).click();
  const library = page.getByRole('region', { name: '游戏库', exact: true });
  const cards = library.locator('.game-library__item');
  await cards.first().waitFor();
  assert.equal(await cards.count(), 6);
  assert.equal(await cards.locator('.game-library__tags').count(), 6);
  assert.equal(await cards.locator(':scope > img').count(), 6);
  for (const id of await page.evaluate(() => window.developmentIds))
    assert.ok(
      await library.locator(`[data-game-id="${id}"] button`).isDisabled(),
    );
  assert.ok(
    await library.locator('[data-game-id="uno"] > button').isDisabled(),
  );
  checked(
    'All six catalog games show local category tags; current and development games retain selection guards.',
  );
  const search = library.getByRole('searchbox', { name: '搜索游戏' });
  const categories = library.getByRole('group', { name: '游戏分类' });
  await search.fill('ＰＯＫＥＭＯＮ');
  await page.waitForFunction(
    () => document.querySelectorAll('.game-library__item').length === 1,
  );
  assert.equal(
    await cards.first().getAttribute('data-game-id'),
    'pokemon-encounters',
  );
  await search.fill('');
  await categories.getByRole('button', { name: '卡牌', exact: true }).click();
  await library.getByRole('combobox', { name: '按人数筛选' }).selectOption('6');
  await page.waitForFunction(
    () => document.querySelectorAll('.game-library__item').length === 3,
  );
  assert.equal(
    await categories
      .getByRole('button', { name: '卡牌', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  await search.fill('乌诺');
  await page.waitForFunction(
    () => document.querySelectorAll('.game-library__item').length === 1,
  );
  assert.equal(await cards.first().getAttribute('data-game-id'), 'uno');
  assert.deepEqual(await page.evaluate(() => window.commands), []);
  await search.fill('不存在的游戏');
  await page.locator('.game-library__empty').waitFor();
  await library
    .getByRole('button', { name: '重置筛选', exact: true })
    .first()
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll('.game-library__item').length === 6,
  );
  assert.equal(await search.inputValue(), '');
  assert.equal(
    await library.getByRole('combobox', { name: '按人数筛选' }).inputValue(),
    '',
  );
  checked(
    'Full-width aliases, category, player count and keyword combine; empty results reset without sending room commands.',
  );
  await library.locator('[data-game-id="modern-art"] > button').click();
  assert.deepEqual(await page.evaluate(() => window.commands), [
    { type: 'select-game', gameId: 'modern-art' },
  ]);
  await page.evaluate(() => {
    window.commands = [];
    window.patchBox({
      view: {
        revision: 12,
        instanceId: 'fixture',
        branch: 0,
        status: 'playing',
        game: window.catalog.find((g) => g.id === 'uno'),
        catalog: window.catalog,
        seats: [],
        ownerSeatId: null,
        joinOpen: false,
        gameView: null,
        history: [],
        lifecycleActions: [],
        playMode: 'play',
        decisionClock: null,
        capabilities: { manage: true },
      },
    });
  });
  await library.locator('[data-game-id="power-grid"] > button').click();
  assert.deepEqual(await page.evaluate(() => window.commands), []);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.commands), []);
  await library.locator('[data-game-id="power-grid"] > button').click();
  await page.getByRole('button', { name: '结束并切换', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.commands), [
    { type: 'select-game', gameId: 'power-grid', endCurrent: true },
  ]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  checked(
    'Lobby switch sends one game command; an active match switches only after confirmation, with endCurrent true.',
  );
  await page.evaluate(() =>
    window.patchBox({
      view: {
        revision: 12,
        instanceId: 'fixture',
        branch: 0,
        status: 'lobby',
        game: null,
        catalog: window.catalog,
        seats: [],
        ownerSeatId: null,
        joinOpen: true,
        gameView: null,
        history: [],
        lifecycleActions: [],
        playMode: 'play',
        decisionClock: null,
        capabilities: { manage: false },
      },
      role: 'player',
      isHost: false,
      canControl: false,
      canManageSeats: false,
    }),
  );
  await page.getByRole('button', { name: '游戏库', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('.game-library__item').length === 6,
  );
  assert.equal(await cards.locator(':scope > button').count(), 0);
  await search.fill('art');
  await page.waitForFunction(
    () => document.querySelectorAll('.game-library__item').length === 1,
  );
  assert.deepEqual(await page.evaluate(() => window.commands), [
    { type: 'select-game', gameId: 'power-grid', endCurrent: true },
  ]);
  checked(
    'Player can browse and filter an unselected catalog without acquiring game selection permission.',
  );
  await page
    .locator('.game-library-panel')
    .getByRole('button', { name: '关闭面板', exact: true })
    .click();
  await page.evaluate(() =>
    window.patchBox({
      view: {
        revision: 12,
        instanceId: 'fixture',
        branch: 0,
        status: 'lobby',
        game: window.catalog.find((g) => g.id === 'uno'),
        catalog: window.catalog,
        seats: Array.from({ length: 6 }, (_, i) => ({
          id: 's' + i,
          name: '朋友' + i,
          avatarId: '',
          controller: 'bot',
          ready: true,
          connected: true,
        })),
        ownerSeatId: null,
        joinOpen: true,
        gameView: null,
        history: [],
        lifecycleActions: [],
        playMode: 'play',
        decisionClock: null,
        capabilities: { manage: true },
      },
      role: 'host',
      isHost: true,
      canControl: true,
      canManageSeats: true,
    }),
  );
  await page.getByRole('button', { name: '切换游戏', exact: true }).click();
  await cards.first().waitFor();
  assert.ok(
    await library.locator('[data-game-id="modern-art"] > button').isDisabled(),
  );
  await page.keyboard.press('Escape');
  await page.evaluate(() =>
    window.patchBox({
      view: {
        revision: 12,
        instanceId: 'fixture',
        branch: 0,
        status: 'lobby',
        game: window.catalog.find((g) => g.id === 'uno'),
        catalog: window.catalog,
        seats: [],
        ownerSeatId: null,
        joinOpen: true,
        gameView: null,
        history: [],
        lifecycleActions: [],
        playMode: 'play',
        decisionClock: null,
        capabilities: { manage: true },
      },
    }),
  );
  checked(
    'Six-seat catalog disables games with lower capacity and retains the seat-adjustment path.',
  );
  await page.getByRole('button', { name: '切换游戏', exact: true }).click();
  await cards.first().waitFor();
  assert.equal(
    await library.locator('[data-game-id="pokemon-encounters"] h3').innerText(),
    '宝可梦奇遇',
  );
  assert.equal(
    await library.getByRole('button', { name: /^版本：/ }).count(),
    0,
  );
  await categories.getByRole('button', { name: '德式', exact: true }).click();
  assert.equal(await cards.count(), 1);
  assert.equal(await cards.first().getAttribute('data-game-id'), 'power-grid');
  await categories.getByRole('button', { name: '全部', exact: true }).click();
  await page.evaluate(() =>
    window.setResources([
      {
        key: { gameId: 'pokemon-encounters' },
        name: '宝可梦奇遇',
        status: { state: 'missing' },
      },
    ]),
  );
  const pokemon = library.locator('[data-game-id="pokemon-encounters"]');
  const beforeDownload = await page.evaluate(() => window.commands.length);
  await pokemon.getByRole('button', { name: '下载资源', exact: true }).click();
  await pokemon
    .getByRole('button', { name: '下载中 40%', exact: true })
    .waitFor();
  assert.ok(
    await pokemon
      .getByRole('button', { name: '下载中 40%', exact: true })
      .isDisabled(),
  );
  assert.equal(
    await page.evaluate(() => window.commands.length),
    beforeDownload,
  );
  assert.deepEqual(
    await pokemon
      .getByRole('button', { name: '下载中 40%', exact: true })
      .evaluate((button) => {
        const style = getComputedStyle(button);
        return { color: style.color, opacity: style.opacity };
      }),
    { color: 'rgb(0, 0, 0)', opacity: '1' },
  );
  await page.evaluate(() =>
    window.setResources([
      {
        key: { gameId: 'pokemon-encounters' },
        name: '宝可梦奇遇',
        status: { state: 'failed' },
      },
    ]),
  );
  await pokemon.getByRole('button', { name: '重试下载', exact: true }).click();
  await page.evaluate(() =>
    window.setResources([
      {
        key: { gameId: 'pokemon-encounters' },
        name: '宝可梦奇遇',
        status: { state: 'installed' },
      },
    ]),
  );
  await page
    .locator('.tablemax-notice')
    .filter({ hasText: '资源下载完成' })
    .waitFor();
  await page.evaluate(() =>
    window.setResources([
      {
        key: { gameId: 'pokemon-encounters' },
        name: '宝可梦奇遇',
        status: { state: 'installed' },
      },
    ]),
  );
  assert.equal(
    await page
      .locator('.tablemax-notice')
      .filter({ hasText: '资源下载完成' })
      .count(),
    1,
  );
  await page.keyboard.press('Escape');
  checked(
    'Short title, version separation, German-style tag, download/retry/progress and single completion notification preserve room actions.',
  );
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: '切换游戏', exact: true }).click();
    await cards.first().waitFor();
    const geometry = await library.evaluate((element) => {
      const dialog = element.closest('dialog'),
        bounds = dialog.getBoundingClientRect();
      const controls = [
        ...element.querySelectorAll('button,input,select'),
      ].filter((e) => e.getClientRects().length);
      const text = [
        ...element.querySelectorAll(
          'h2,h3,p,.game-library__tags span,.game-library__players',
        ),
      ].filter((e) => e.textContent.trim());
      return {
        dialog: {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          client: dialog.clientWidth,
          scroll: dialog.scrollWidth,
        },
        minControl: Math.min(
          ...controls.map((e) => e.getBoundingClientRect().height),
        ),
        minFont: Math.min(
          ...text.map((e) => parseFloat(getComputedStyle(e).fontSize)),
        ),
        actionFont: parseFloat(
          getComputedStyle(
            element.querySelector('.game-library__item > button'),
          ).fontSize,
        ),
      };
    });
    assert.ok(
      geometry.dialog.left >= -1 && geometry.dialog.right <= width + 1,
      `${width}: dialog fits horizontally`,
    );
    assert.ok(
      geometry.dialog.scroll <= geometry.dialog.client + 1,
      `${width}: no horizontal scrolling`,
    );
    assert.ok(
      geometry.minControl >= 44,
      `${width}: controls remain touch sized`,
    );
    assert.ok(
      geometry.minFont >= 16 && geometry.actionFont >= 18,
      `${width}: readable text sizes`,
    );
    report.layouts.push({ width, height, ...geometry });
    await captureBrowserScreenshot(page, {
      path: join(output, `library-${width}x${height}.png`),
    });
    await page.keyboard.press('Escape');
  }
  checked(
    'Source-rendered modal fits 320–3840 pixel widths, landscape short screens, readable text and 44 pixel controls.',
  );
  await page.evaluate(() =>
    window.patchBox({
      view: {
        ...window.baseBox,
        seats: Array.from({ length: 3 }, (_, index) => ({
          id: `settings-${index}`,
          position: index + 1,
          name: `完整昵称朋友${index + 1}`,
          avatarId: `avatar-${index + 1}`,
          controller: index === 0 ? 'human' : 'bot',
          online: false,
          ready: false,
          botDifficulty: ['default', 'doubao', 'juewu'][index],
        })),
      },
    }),
  );
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ]) {
    await page.setViewportSize({ width, height });
    for (const title of ['游戏设置', '视频设置', '座位设置']) {
      await page.getByRole('button', { name: title, exact: true }).click();
      const panel = page.locator('.settings-panel');
      await panel.waitFor();
      const geometry = await panel.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        scroll: element.scrollWidth,
        client: element.clientWidth,
        fonts: [...element.querySelectorAll('p,label,h3,strong')]
          .filter((e) => e.getBoundingClientRect().height > 0)
          .map((e) => parseFloat(getComputedStyle(e).fontSize)),
      }));
      if (geometry.width > width || geometry.scroll > geometry.client + 1)
        await captureBrowserScreenshot(page, {
          path: join(output, `failure-settings-${width}.png`),
        });
      assert.ok(
        geometry.width <= width && geometry.scroll <= geometry.client + 1,
        `${title} ${width}: horizontal fit ${JSON.stringify(geometry)}`,
      );
      assert.ok(
        geometry.fonts.every((size) => size >= 16),
        `${title} ${width}: readable text`,
      );
      if (width === 390 || width === 1280)
        await captureBrowserScreenshot(page, {
          path: join(
            output,
            `settings-${['游戏设置', '视频设置', '座位设置'].indexOf(title)}-${width}.png`,
          ),
        });
      await page.keyboard.press('Escape');
    }
  }
  checked(
    'Game, video and seat settings fit six viewports with readable text; current role functionality remains available.',
  );
  assert.deepEqual(
    await page.evaluate(() =>
      window.moduleCatalog
        .find((game) => game.id === 'avalon')
        .variants.map((variant) => variant.id),
    ),
    ['configured'],
  );
  await page.evaluate(() => {
    window.setResources([]);
    window.patchBox({
      role: 'host',
      isHost: true,
      locked: false,
      awaitingConfirmation: false,
      view: {
        ...window.baseBox,
        game: {
          ...window.catalog.find((game) => game.id === 'pokemon-encounters'),
          variantId: 'original',
          releaseRef: 'a'.repeat(64),
        },
      },
    });
  });
  await page.getByRole('button', { name: '版本：原版', exact: true }).click();
  const gameplaySelector = page.getByRole('dialog', {
    name: '宝可梦奇遇：皮卡丘和朋友们版本',
    exact: true,
  });
  await gameplaySelector.waitFor();
  assert.equal(
    await gameplaySelector.locator('.gameplay-selector-card').count(),
    2,
  );
  assert.equal(
    await gameplaySelector
      .getByRole('button', { name: '原版 · 已选中', exact: true })
      .getAttribute('aria-current'),
    'true',
  );
  for (const permission of [
    { role: 'player', isHost: false, canControl: false, manage: false },
    { role: 'player', isHost: false, canControl: true, manage: false },
    { role: 'public', isHost: false, canControl: false, manage: false },
    { role: 'host', isHost: true, manage: true, locked: true },
    {
      role: 'host',
      isHost: true,
      manage: true,
      awaitingConfirmation: true,
    },
    { role: 'host', isHost: true, manage: true, status: 'playing' },
  ]) {
    await page.evaluate((permission) => {
      const { manage, status = 'lobby', ...session } = permission;
      window.patchBox({
        locked: false,
        awaitingConfirmation: false,
        ...session,
        view: {
          ...window.baseBox,
          status,
          capabilities: { manage },
          game: {
            ...window.catalog.find((game) => game.id === 'pokemon-encounters'),
            variantId: 'original',
            releaseRef: 'a'.repeat(64),
          },
        },
      });
    }, permission);
    assert.ok(
      await gameplaySelector
        .getByRole('button', { name: '扩展版', exact: true })
        .isDisabled(),
      `Gameplay selection respects ${JSON.stringify(permission)}`,
    );
  }
  await page.evaluate(() => {
    window.patchBox({
      role: 'host',
      isHost: true,
      canControl: true,
      locked: false,
      awaitingConfirmation: false,
      view: {
        ...window.baseBox,
        game: {
          ...window.catalog.find((game) => game.id === 'pokemon-encounters'),
          variantId: 'original',
          releaseRef: 'a'.repeat(64),
        },
      },
    });
    window.setResources([
      {
        key: { gameId: 'pokemon-encounters', variantId: 'original' },
        name: '原版',
        releaseRef: 'b'.repeat(64),
        status: { state: 'installed' },
      },
    ]);
  });
  const currentReleaseButton = gameplaySelector.getByRole('button', {
    name: '原版',
    exact: true,
  });
  assert.equal(await currentReleaseButton.getAttribute('aria-current'), null);
  assert.ok(await currentReleaseButton.isEnabled());
  const gameplayCommands = await page.evaluate(() => window.commands.length);
  await gameplaySelector
    .getByRole('button', { name: '扩展版', exact: true })
    .click();
  assert.deepEqual(await page.evaluate(() => window.commands.at(-1)), {
    type: 'select-variant',
    variantId: 'expansion',
  });
  assert.equal(
    await page.evaluate(() => window.commands.length),
    gameplayCommands + 1,
  );
  await gameplaySelector.waitFor({ state: 'hidden' });
  checked(
    'The platform gameplay selector supports the current two-variant Pokemon catalog without duplicate versions metadata, preserves release identity, and enforces administrator, owner, player, public, playing, locked and pending-confirmation permissions.',
  );
  await page.evaluate(() => window.setResources([]));
  await page.evaluate(() =>
    window.patchBox({
      view: {
        ...window.baseBox,
        game: {
          ...window.catalog.find((game) => game.id === 'pokemon-encounters'),
          variantId: 'original',
        },
      },
    }),
  );
  await page.getByRole('button', { name: '版本：原版', exact: true }).click();
  const versions = page.getByRole('dialog', {
    name: '宝可梦奇遇：皮卡丘和朋友们版本',
    exact: true,
  });
  await versions.waitFor();
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [1280, 720],
    [3840, 2160],
  ]) {
    await page.setViewportSize({ width, height });
    const metrics = await versions.evaluate((dialog) => {
      const outer = dialog.getBoundingClientRect();
      const scroll = dialog.querySelector('.box-overlay-panel__content');
      const inner = scroll.getBoundingClientRect();
      return {
        outer: { width: outer.width, height: outer.height, right: outer.right },
        inner: {
          right: inner.right,
          scroll: scroll.scrollHeight,
          client: scroll.clientHeight,
        },
        dialogScroll: dialog.scrollHeight,
        dialogClient: dialog.clientHeight,
        controls: [...dialog.querySelectorAll('button')].map((el) => ({
          height: el.getBoundingClientRect().height,
          font: parseFloat(getComputedStyle(el).fontSize),
        })),
        fonts: [...dialog.querySelectorAll('p,h3')].map((el) =>
          parseFloat(getComputedStyle(el).fontSize),
        ),
      };
    });
    assert.ok(metrics.outer.width <= width && metrics.outer.height <= height);
    assert.ok(
      metrics.inner.right <= metrics.outer.right - 13,
      'Scrollbar inset inside rounded shell',
    );
    assert.ok(
      metrics.dialogScroll <= metrics.dialogClient + 1,
      'Only inset content scrolls',
    );
    assert.ok(metrics.controls.every((item) => item.height >= 44));
    assert.ok(metrics.fonts.every((font) => font >= 16));
    report.layouts.push({ versionPicker: true, width, height, ...metrics });
    await captureBrowserScreenshot(page, {
      path: join(output, `versions-${width}x${height}.png`),
    });
  }
  assert.equal(
    await versions
      .getByRole('button', { name: '原版 · 已选中', exact: true })
      .getAttribute('aria-current'),
    'true',
  );
  await page.evaluate(() =>
    window.setResources([
      {
        key: { gameId: 'pokemon-encounters', variantId: 'expansion' },
        name: '扩展版',
        status: { state: 'missing' },
      },
    ]),
  );
  const versionCommands = await page.evaluate(() => window.commands.length);
  await versions.getByRole('button', { name: '下载资源', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.resourceDownloads.at(-1)), {
    gameId: 'pokemon-encounters',
    variantId: 'expansion',
  });
  assert.equal(
    await page.evaluate(() => window.commands.length),
    versionCommands,
  );
  await page.evaluate(() => {
    window.setResources([
      {
        key: { gameId: 'pokemon-encounters', variantId: 'expansion' },
        name: '扩展版',
        status: { state: 'failed' },
      },
    ]);
    window.patchBox({ role: 'player', isHost: false });
  });
  assert.ok(
    await versions
      .getByRole('button', { name: '重试下载', exact: true })
      .isDisabled(),
  );
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.patchBox({ role: 'host', isHost: true }));
  checked(
    'Variant resource downloads address gameId/variantId, preserve selection and remain administrator-only; current variant exposes aria-current.',
  );
  const serverResourceCommands = await page.evaluate(() => {
    const release = (gameId, variantId, releaseId, defaultVariantId) => ({
      releaseId,
      gameId,
      ...(variantId ? { variantId, variantName: variantId } : {}),
      name: gameId,
      ...(defaultVariantId ? { defaultVariantId } : {}),
      releaseTag: 'v1.0.6',
      compatible: true,
    });
    window.trustedReleases = [
      release('uno', undefined, 'c'.repeat(64)),
      release('modern-art', undefined, 'd'.repeat(64)),
      release('pokemon-encounters', 'original', 'e'.repeat(64), 'original'),
      release('pokemon-encounters', 'expansion', 'f'.repeat(64), 'original'),
    ];
    window.packageSnapshot = {
      catalog: { releases: [] },
      index: { releases: {}, selected: {} },
      tasks: [],
      unavailableReleaseIds: [],
    };
    return window.commands.length;
  });
  await page.evaluate(() => window.serverResourceRefresh());
  assert.deepEqual(await page.evaluate(() => window.packageOperations), []);
  await page.evaluate(() =>
    Promise.all([
      window.serverResourceAdapter.download({ gameId: 'uno' }),
      window.serverResourceAdapter.download({ gameId: 'modern-art' }),
    ]),
  );
  assert.deepEqual(await page.evaluate(() => window.packageOperations), [
    { operation: 'refresh' },
    { operation: 'install', releaseId: 'c'.repeat(64) },
    { operation: 'install', releaseId: 'd'.repeat(64) },
  ]);
  await page.evaluate(async () => {
    await window.serverResourceAdapter.download({
      gameId: 'pokemon-encounters',
    });
    await window.serverResourceAdapter.download({
      gameId: 'pokemon-encounters',
      variantId: 'expansion',
    });
  });
  assert.deepEqual(
    await page.evaluate(() => window.packageOperations.slice(-2)),
    [
      { operation: 'install', releaseId: 'e'.repeat(64) },
      { operation: 'install', releaseId: 'f'.repeat(64) },
    ],
  );
  assert.equal(
    await page.evaluate(() => window.commands.length),
    serverResourceCommands,
  );
  await page.evaluate(() => window.patchBox({ role: 'player', isHost: false }));
  await page.waitForFunction(() =>
    document.querySelector('.box-screen.player'),
  );
  const unauthorized = await page.evaluate(async () => {
    try {
      await window.serverResourceAdapter.download({ gameId: 'uno' });
      return '';
    } catch (cause) {
      return cause.message;
    }
  });
  assert.match(unauthorized, /仅电脑管理员/);
  assert.equal(await page.evaluate(() => window.packageOperations.length), 5);
  await page.evaluate(() => window.patchBox({ role: 'host', isHost: true }));
  await page.waitForFunction(() => document.querySelector('.box-screen.host'));
  await page.evaluate(async () => {
    window.packageSnapshot.catalog = { releases: [] };
    window.packageOperations = [];
    window.refreshFailure = '签名目录不可用';
    await window.serverResourceRefresh();
  });
  const failedRefresh = await page.evaluate(async () => {
    try {
      await window.serverResourceAdapter.download({ gameId: 'uno' });
      return '';
    } catch (cause) {
      return cause.message;
    }
  });
  assert.match(failedRefresh, /无法刷新可信发行目录：签名目录不可用/);
  assert.deepEqual(await page.evaluate(() => window.packageOperations), [
    { operation: 'refresh' },
  ]);
  await page.evaluate(async () => {
    window.refreshFailure = '';
    window.packageOperations = [];
    window.holdCatalogRefresh = true;
    await window.serverResourceRefresh();
    window.pendingDownload = window.serverResourceAdapter
      .download({ gameId: 'uno' })
      .then(
        () => '',
        (cause) => cause.message,
      );
  });
  await page.waitForFunction(
    () => window.packageOperations[0]?.operation === 'refresh',
  );
  await page.evaluate(() => window.patchBox({ role: 'player', isHost: false }));
  await page.waitForFunction(() =>
    document.querySelector('.box-screen.player'),
  );
  const changedIdentity = await page.evaluate(async () => {
    window.finishCatalogRefresh();
    return window.pendingDownload;
  });
  assert.match(changedIdentity, /管理员身份已变化/);
  assert.deepEqual(await page.evaluate(() => window.packageOperations), [
    { operation: 'refresh' },
  ]);
  await page.evaluate(() => {
    window.holdCatalogRefresh = false;
    window.patchBox({ role: 'host', isHost: true });
  });
  checked(
    'Lightweight installation summaries preserve resource keys; downloads explicitly refresh an empty trusted catalog once across concurrent requests, match default or named variants, never select a game, and reject refresh failures or a changed administrator identity.',
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event('tablemax:repository-open-error')),
  );
  await page
    .locator('.tablemax-notice')
    .filter({ hasText: '无法打开 GitHub' })
    .waitFor();
  checked(
    'Native repository-open failure is presented through the universal popup.',
  );
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log(
    `Game library: ${report.checks.length} checks passed; evidence ${output}; bundle ${report.bundle}`,
  );
} catch (error) {
  report.status = 'failed';
  report.failure = error.stack;
  throw error;
} finally {
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  await browser.close();
  await server.close();
}
