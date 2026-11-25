import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { leanCatalogPlugin } from '../../build/lean-catalog.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
const run = process.argv.find((x) => x.startsWith('--evidence='))?.slice(11);
assert.match(run ?? '', /^[a-z0-9-]+$/);
const output = resolve('artifacts/maintenance/bot-rise-mischief-20261126', run);
await mkdir(output, { recursive: true });
const taskRoot = resolve(
  'tmp',
  process.env.TABLEMAX_TASK_ID ?? `bot-style-${run}`,
);
await mkdir(taskRoot, { recursive: true });
const work = await mkdtemp(join(taskRoot, 'fixture-'));
const report = { checks: [], screenshots: [], errors: [] };
await writeFile(
  join(work, 'index.html'),
  '<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  join(work, 'entry.tsx'),
  `
import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
import {BoxScreen} from ${JSON.stringify(resolve('apps/web/src/screens/BoxScreen.tsx'))};
import {AVATAR_PRESETS} from ${JSON.stringify(resolve('packages/protocol/src/index.ts'))};
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
import ${JSON.stringify(resolve('apps/web/src/screens/box-screen.css'))};
import ${JSON.stringify(resolve('apps/web/src/screens/box-lobby.css'))};
const root=createRoot(document.getElementById('root')); window.commands=[];
let options={};
window.renderBox=(patch={})=>{options={...options,...patch};const o=options;
const seats=Array.from({length:o.joining?0:(o.count??3)},(_,i)=>({id:'seat-'+i,name:o.long?(i%2?'Abcdefghijklmnop':'大家一起开心玩耍'):i===0?'小明':'朋友'+i,avatarId:AVATAR_PRESETS[i%AVATAR_PRESETS.length].id,ready:i===0?!!o.ready:true,online:i!==1,controller:i===2?'bot':'human',botDifficulty:i===2?(o.botSeatStyle??'default'):null}));
const role=o.role??'player';
const view={id:'fixture',name:'聚会牌桌',status:o.status??'lobby',joinOpen:!o.closed,playMode:'play',self:{role,seatId:role==='player'?(seats[0]?.id??null):null},seats,ownerSeatId:o.owner?'seat-0':null,paused:!!o.paused,lifecycleActions:o.status==='playing'?[{type:'next'}]:[],botError:null,gameView:o.status==='playing'||o.status==='ended'?{}:null,capabilities:{manage:false,manageSeats:false},game:{id:o.game??'uno',name:'UNO',min:2,max:o.capacity??6,...(o.botLevels?{botDifficulties:o.botLevels}:{})}};
const session={role,view,self:role!=='player'||o.joining?null:seats[0],isHost:role==='host',canControl:role==='host'||!!o.owner,canManageSeats:role==='host'||!!o.owner,locked:!!o.closed,busy:!!o.busy,connected:o.connected!==false,credential:o.joining?null:'fixture',name:'小明',message:o.message??'',messageKind:o.kind??'saved',errorId:'',admissionPending:!!o.pending,awaitingConfirmation:!!o.awaiting,admissionAvatarId:null,admissionAvatarImage:null,addresses:[],adapters:[],address:'',port:38473,networkMessage:'',externalJoinUrl:null,setAddress(){},refreshNetwork(){},async saveExternalJoinUrl(){return true},setName(){},join(){window.commands.push({type:'join'})},retry(){window.commands.push({type:'retry'})},retryAdmission(){window.commands.push({type:'retryAdmission'})},setPlayerCredential(){},command(c){window.commands.push(c)}};
flushSync(()=>root.render(<BoxScreen session={session}/>));};window.renderBox();
`,
);
await build({
  configFile: false,
  root: work,
  plugins: [leanCatalogPlugin(), react()],
  resolve: {
    alias: {
      react: resolve('apps/web/node_modules/react'),
      'react-dom': resolve('apps/web/node_modules/react-dom'),
    },
  },
  build: { outDir: join(work, 'bundle'), target: 'chrome110' },
  logLevel: 'error',
});
const server = await serveFixture(join(work, 'bundle'));
const browser = await launchTestBrowser({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto(server.url);
  await page.evaluate(
    () => (document.documentElement.dataset.playerDisplay = 'wide'),
  );
  await page.waitForFunction(() => !!window.renderBox);
  const render = async (o) => {
    await page.evaluate((o) => window.renderBox(o), o);
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await render({
    role: 'host',
    status: 'lobby',
    botLevels: ['default', 'doubao', 'juewu', 'mischief'],
    botSeatStyle: 'mischief',
  });
  const styleSelect = page.locator('#bot-difficulty');
  await styleSelect.selectOption('mischief');
  await page.getByRole('button', { name: '添加人机' }).click();
  assert.deepEqual(await page.evaluate(() => window.commands.at(-1)), {
    type: 'add-bot',
    name: '捣蛋王1',
    difficulty: 'mischief',
  });
  assert.equal(
    await page.locator('.room-table__difficulty--mischief').textContent(),
    '捣蛋王人机',
  );
  const styleScreenshot = join(output, 'uno-bot-style-390.png');
  await page.screenshot({ path: styleScreenshot });
  report.screenshots.push(styleScreenshot);
  await render({
    game: 'rummikub',
    botLevels: ['default', 'doubao', 'juewu'],
    botSeatStyle: 'default',
  });
  assert.equal(
    await styleSelect.locator('option[value="mischief"]').count(),
    0,
  );
  assert.equal(await styleSelect.inputValue(), 'default');
  await render({ game: 'uno', botLevels: null, botSeatStyle: null });
  report.checks.push(
    'UNO style is selectable only when advertised and resets across games',
  );
  assert.deepEqual(report.errors, []);
  report.sources = {};
  for (const path of [
    'apps/web/src/screens/BoxScreen.tsx',
    'apps/web/src/content/bot-difficulty.ts',
    'apps/web/src/components/RoomTable.tsx',
    'tools/test/box/verify-uno-bot-style.mjs',
  ])
    report.sources[path] = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  throw error;
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.length,
      output,
    }),
  );
}
