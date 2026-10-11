import { captureBrowserScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
import { verificationOutput } from '../support/verification-output.mjs';

const output = verificationOutput('game-library');
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
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
import ${JSON.stringify(resolve('apps/web/src/screens/box-screen.css'))};
const catalog=moduleCatalog.filter(m=>!m.internal).map(m=>m.catalog);
window.commands=[];
window.catalog=catalog;
window.developmentIds=moduleCatalog.filter(m=>m.development).map(m=>m.id);
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
 const session={role:'host',view:base,self:null,isHost:true,canControl:true,canManageSeats:true,locked:false,busy:false,connected:true,credential:'fixture',name,setName,message,messageKind:feedbackKind(message),errorId:'',admissionPending:false,admissionAvatarId:null,admissionAvatarImage:null,awaitingConfirmation:false,join(){},retry(){},retryAdmission(){},setPlayerCredential(){},command(command){window.commands.push(command)},addresses:[],adapters:[],address:'',port:38473,networkMessage:'',externalJoinUrl:null,setAddress(){},refreshNetwork(){},async saveExternalJoinUrl(){return true},...patch};
 return <BoxScreen session={session} resources={resources}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
`,
);
console.log('Building source box library fixture (about 10 seconds)…');
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
const server = await serveFixture(join(work, 'bundle'));
const browser = await launchTestBrowser({ channel: 'msedge', headless: true });
const report = {
  status: 'running',
  work,
  bundle: join(work, 'bundle'),
  checks: [],
  errors: [],
  layouts: [],
};
const checked = (message) => report.checks.push(message);
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.goto(server.url);
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
