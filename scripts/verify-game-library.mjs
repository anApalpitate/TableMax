import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from './browser-test.mjs';
import { serveFixture } from './fixture-server.mjs';
import { verificationOutput } from './verification-output.mjs';

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
const base={revision:12,instanceId:'fixture',branch:0,status:'lobby',game:catalog.find(g=>g.id==='uno'),catalog,seats:[],ownerSeatId:null,joinOpen:true,gameView:null,history:[],lifecycleActions:[],playMode:'play',decisionClock:null,capabilities:{manage:true}};
function App(){
 const [patch,setPatch]=useState({}),[name,setName]=useState('朋友');
 window.patchBox=(next)=>setPatch(previous=>({...previous,...next}));
 const message=patch.message??'';
 const session={role:'host',view:base,self:null,isHost:true,canControl:true,canManageSeats:true,locked:false,busy:false,connected:true,credential:'fixture',name,setName,message,messageKind:feedbackKind(message),errorId:'',admissionPending:false,admissionAvatarId:null,admissionAvatarImage:null,awaitingConfirmation:false,join(){},retry(){},retryAdmission(){},setPlayerCredential(){},command(command){window.commands.push(command)},addresses:[],adapters:[],address:'',port:38473,networkMessage:'',externalJoinUrl:null,setAddress(){},refreshNetwork(){},async saveExternalJoinUrl(){return true},...patch};
 return <BoxScreen session={session}/>;
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
    'Repository icon is accessible on all three box roles; browser click opens the exact project destination.',
  );
  await page.getByRole('button', { name: '切换游戏', exact: true }).click();
  const library = page.getByRole('region', { name: '游戏库', exact: true });
  const cards = library.locator('.game-library__item');
  await cards.first().waitFor();
  assert.equal(await cards.count(), 5);
  assert.equal(await cards.locator('.game-library__tags').count(), 5);
  assert.equal(await cards.locator(':scope > img').count(), 5);
  assert.ok(
    await library.locator('[data-game-id="rummikub"] button').isDisabled(),
  );
  assert.ok(
    await library.locator('[data-game-id="uno"] > button').isDisabled(),
  );
  checked(
    'All five catalog games show local category tags; current and development games retain selection guards.',
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
    () => document.querySelectorAll('.game-library__item').length === 2,
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
    () => document.querySelectorAll('.game-library__item').length === 5,
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
    () => document.querySelectorAll('.game-library__item').length === 5,
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
    await page.screenshot({
      path: join(output, `library-${width}x${height}.png`),
    });
    await page.keyboard.press('Escape');
  }
  checked(
    'Source-rendered modal fits 320–3840 pixel widths, landscape short screens, readable text and 44 pixel controls.',
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event('tablemax:repository-open-error')),
  );
  await page.locator('.tablemax-notice').waitFor();
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
