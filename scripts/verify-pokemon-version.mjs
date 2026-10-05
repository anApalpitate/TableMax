import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { serveFixture } from './fixture-server.mjs';

const output = resolve(
  'artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/version',
);
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/pokemon-version-'));
await writeFile(
  join(work, 'index.html'),
  '<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  join(work, 'entry.tsx'),
  `
import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
import {BoxScreen} from ${JSON.stringify(resolve('apps/web/src/screens/BoxScreen.tsx'))};
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
import ${JSON.stringify(resolve('apps/web/src/screens/box-screen.css'))};
const root=createRoot(document.getElementById('root')); window.commands=[];
const game={id:'pokemon-encounters',name:'宝可梦奇遇：皮卡丘和朋友们',min:2,max:6};
const seat={id:'S1',name:'版本查看者',controller:'human',ready:true,online:true,avatarId:'avatar-1',botDifficulty:null};
window.renderBox=role=>{
  window.boxData={revision:12,branch:0,status:'lobby',game,catalog:[game],seats:[seat],ownerSeatId:null,joinOpen:true,gameView:null,history:[],lifecycleActions:[],playMode:'play',decisionClock:null};
  const session={role,view:window.boxData,self:role==='player'?seat:null,isHost:role==='host',canControl:false,canManageSeats:false,locked:false,busy:false,connected:true,credential:'fixture',name:'玩家',message:'',errorId:'',admissionPending:false,awaitingConfirmation:false,command:c=>window.commands.push(c),retry(){},setName(){},join(){}};
  flushSync(()=>root.render(<BoxScreen key={role} session={session}/>));
};window.renderBox('public');
`,
);
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
    target: 'chrome110',
  },
  logLevel: 'error',
});
const assets = await readdir(join(work, 'bundle/assets'));
assert.ok(
  !assets.some((name) => /ordinary-|special-|\.wav$|\.mp3$/.test(name)),
  'Box must not load card portraits or audio',
);
const server = await serveFixture(join(work, 'bundle'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [],
  checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.url);
  await page.waitForFunction(() => typeof window.renderBox === 'function');
  for (const role of ['player', 'public', 'host']) {
    await page.evaluate((role) => window.renderBox(role), role);
    const before = await page.evaluate(() => JSON.stringify(window.boxData));
    await page.getByRole('button', { name: '版本：原版', exact: true }).click();
    await page
      .getByRole('button', { name: '扩展版 · 筹备中', exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: '扩展版 · 筹备中', exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole('button', { name: '原版 · 已选中', exact: true })
        .getAttribute('aria-current'),
      'true',
    );
    assert.equal(
      await page.evaluate(() => JSON.stringify(window.boxData)),
      before,
    );
    assert.deepEqual(await page.evaluate(() => window.commands), []);
    await page.screenshot({ path: join(output, role + '.png') });
    checks.push(
      role +
        ': readonly original/disabled expansion, zero commands and unchanged room',
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(
      {
        result: 'passed',
        scope:
          'Headless Edge renders actual BoxScreen; no complete Pokemon game art/audio in box bundle. Not physical-device acceptance.',
        checks,
        assets,
        errors,
      },
      null,
      2,
    ),
  );
  console.info('Pokemon version panel passed: ' + output);
} finally {
  await browser.close();
  await server.close();
}
