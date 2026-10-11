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
import { leanCatalogPlugin } from '../../build/lean-catalog.mjs';

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
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
import ${JSON.stringify(resolve('apps/web/src/screens/box-screen.css'))};
// The authority supplies runtime capabilities after installation; browsing entries omit them.
const catalog=moduleCatalog.filter(m=>!m.internal).map(m=>({...m.catalog,decisionTimer:true}));
window.commands=[];
window.catalog=catalog;
window.moduleCatalog=moduleCatalog;
window.developmentIds=moduleCatalog.filter(m=>m.development).map(m=>m.id);
const base={revision:12,instanceId:'fixture',branch:0,status:'lobby',game:catalog.find(g=>g.id==='uno'),catalog,seats:[],ownerSeatId:null,joinOpen:true,gameView:null,history:[],lifecycleActions:[],playMode:'play',decisionClock:null,capabilities:{manage:true}};
window.baseBox=base;
window.base=base;
function App(){
 const [patch,setPatch]=useState({}),[name,setName]=useState('朋友');
 window.patchBox=(next)=>setPatch(previous=>({...previous,...next}));
 const message=patch.message??'';
 const session={role:'host',view:{...base,game:null},self:null,isHost:true,canControl:true,canManageSeats:true,locked:false,busy:false,connected:true,credential:'fixture',name,setName,message,messageKind:feedbackKind(message),errorId:'',admissionPending:false,admissionAvatarId:null,admissionAvatarImage:null,awaitingConfirmation:false,join(){},retry(){},retryAdmission(){},setPlayerCredential(){},command(command){window.commands.push(command)},addresses:[],adapters:[],address:'',port:38473,networkMessage:'',externalJoinUrl:null,setAddress(){},refreshNetwork(){},async saveExternalJoinUrl(){return true},...patch};
 return <BoxScreen session={session}/>;
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
  const page = await browser.newPage();
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(server.url);
  await page.getByRole('button', { name: '游戏库', exact: true }).click();
  const library = page.locator('.game-library');
  await library.waitFor();
  assert.equal(
    await page.locator('.hero h1').innerText(),
    '请在游戏库选择游戏',
  );
  assert.equal(await page.locator('.box-download-icon').count(), 0);
  assert.equal(await library.locator('[data-game-id]').count(), 6);
  await library.getByRole('searchbox', { name: '搜索游戏' }).fill('UNO');
  assert.equal(await library.locator('[data-game-id]').count(), 1);
  await library.locator('[data-game-id="uno"]').getByRole('button').click();
  assert.deepEqual(await page.evaluate(() => window.commands), [
    { type: 'select-game', gameId: 'uno' },
  ]);
  await library.getByRole('searchbox', { name: '搜索游戏' }).fill('');
  checked(
    'All bundled games browse and filter, and selection uses the normal command.',
  );
  for (const role of ['host', 'player', 'public']) {
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
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [844, 390],
      [1280, 720],
      [1920, 1080],
      [3840, 2160],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      assert.equal(
        await library.evaluate((e) => e.scrollWidth > e.clientWidth + 2),
        false,
        role + ' ' + width + ' overflow',
      );
      assert.equal(
        await library
          .getByRole('button', { name: /下载|安装|导入|卸载/ })
          .count(),
        0,
      );
      assert.equal(await library.locator('.package-management').count(), 0);
      report.layouts.push({ role, width, height });
      if (role !== 'host')
        assert.equal(
          await library
            .getByRole('button', { name: '选择游戏', exact: true })
            .count(),
          0,
        );
      await captureBrowserScreenshot(page, {
        path: join(output, role + '-' + width + 'x' + height + '.png'),
      });
    }
  }
  assert.ok(
    !requests.some((url) =>
      /\/api\/game-packages(?:$|\/manage|\/import)/.test(url),
    ),
  );
  checked(
    'Three roles and 18 layouts fit 320px–4K with no installation UI or requests.',
  );
  await page.keyboard.press('Escape');
  await page.evaluate(() =>
    window.patchBox({
      role: 'host',
      isHost: true,
      canControl: true,
      view: {
        ...window.base,
        game: {
          id: 'pokemon-encounters',
          name: '宝可梦奇遇',
          min: 2,
          max: 8,
          variantId: 'original',
          restoreOnly: true,
        },
        seats: [],
        capabilities: { manage: true },
      },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText('正在继续旧版本对局', { exact: true }).waitFor();
  await page.getByRole('button', { name: /^版本：/ }).click();
  const variants = page.locator('.gameplay-selector-panel');
  await variants.waitFor();
  await variants.getByRole('button', { name: '扩展版', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.commands.at(-1)), {
    type: 'select-variant',
    variantId: 'expansion',
  });
  checked(
    'Old sessions are labelled, and variant selection remains an authorized command.',
  );
  report.status = 'passed';
  console.log(
    'Complete game library passed: ' +
      report.checks.length +
      ' checks / 18 layouts; ' +
      output,
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
