import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
import { verificationOutput } from '../support/verification-output.mjs';
import { registerArtifacts } from '../../maintenance/verification-artifacts.mjs';

const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const run = argument('run') ?? `run-${Date.now()}`;
assert.match(run, /^[A-Za-z0-9_-]+$/);
const section = argument('section') ?? 'all';
assert.ok(['all', 'layout', 'controls'].includes(section));
const roleFilter = argument('role');
assert.ok(!roleFilter || ['host', 'public', 'player'].includes(roleFilter));
const capacityFilter = argument('capacity');
assert.ok(
  !capacityFilter || ['1', '6', '7', '9', '12'].includes(capacityFilter),
);
const sizes = [
  [320, 568],
  [390, 844],
  [844, 390],
  [1280, 720],
  [1920, 1080],
  [3840, 2160],
];
const sizeFilter = argument('size');
assert.ok(!sizeFilter || sizes.some(([w, h]) => `${w}x${h}` === sizeFilter));
const output = verificationOutput('box-seats', run);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/box-layout-'));
const report = {
  status: 'running',
  startedAt: new Date().toISOString(),
  section,
  roleFilter,
  capacityFilter,
  sizeFilter,
  scope:
    'Compiled production BoxScreen components with synthetic session/catalog inputs in hidden muted Edge, loopback only. Synthetic UNO capacity 12 checks layout compatibility; released games retain their actual catalog limits. Captured replay is a component intent assertion, not a simulated server or persistence test. CSS viewport checks do not certify physical devices, Windows DPI, native lifecycle or portable delivery.',
  work,
  bundle: join(work, 'bundle'),
  checks: [],
  layouts: [],
  screenshots: [],
  errors: [],
  externalRequests: [],
  sources: {},
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const file of [
  'apps/web/src/components/RoomTable.tsx',
  'apps/web/src/components/room-table.css',
  'apps/web/src/components/RoomManagement.tsx',
  'apps/web/src/components/GameLibrary.tsx',
  'apps/web/src/screens/BoxScreen.tsx',
  'apps/web/src/screens/box-refinements.css',
  'apps/web/src/screens/box-screen.css',
  'apps/web/src/content/feedback.ts',
  'apps/web/src/content/feedback.zh-CN.json',
])
  report.sources[file] = hash(await readFile(file));
const save = () =>
  writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
const checked = (message) => report.checks.push(message);
await writeFile(
  join(work, 'index.html'),
  '<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  join(work, 'entry.tsx'),
  `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AVATAR_PRESETS} from ${JSON.stringify(resolve('packages/protocol/src/index.ts'))};
import {BoxScreen} from ${JSON.stringify(resolve('apps/web/src/screens/BoxScreen.tsx'))};
import {moduleCatalog} from ${JSON.stringify(resolve('apps/web/src/catalog.ts'))};
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
import ${JSON.stringify(resolve('apps/web/src/screens/box-screen.css'))};
const normalCatalog=moduleCatalog.filter(m=>!m.internal).map(m=>m.catalog);
const uno=normalCatalog.find(game=>game.id==='uno');
window.commands=[];
window.normalCatalog=normalCatalog;
const names=['很长的中文昵称需要每个汉字都完整可见','ExtraLongUnbrokenNickname','默认策略朋友','豆包策略朋友','绝悟策略朋友','离线后仍在座的真人','亲爱的第七位朋友','Mixed中文EnglishLongName','第九位的中文名字也比较长','FriendTen','朋友十一','本人第十二座SelfPlayer'];
const ringNames=['朋友一','朋友二','默认队友','豆包队友','绝悟队友','朋友六'];
function App(){
 const [options,setOptions]=useState({role:'host',capacity:6,occupied:5}),[name,setName]=useState('朋友');
 window.configureBox=(next)=>{window.commands=[];setOptions(next)};
 const capacity=options.capacity??6,occupied=options.occupied??capacity,role=options.role??'host';
 const seats=Array.from({length:occupied},(_,i)=>({id:'seat-'+(i+1),name:(capacity<=6?ringNames[i]:names[i])??('朋友'+(i+1)),avatarId:AVATAR_PRESETS[i%AVATAR_PRESETS.length].id,controller:i>=2&&i<=4?'bot':'human',botDifficulty:i===2?'default':i===3?'doubao':i===4?'juewu':undefined,online:i!==1&&i!==5,ready:i!==0&&i!==5}));
 const self=role==='player'?(seats[capacity===12?11:0]??null):null;
 const game=options.normalCatalog?uno:{...uno,min:Math.min(2,capacity),max:capacity};
 const catalog=options.normalCatalog?normalCatalog:options.wideCatalog?[...normalCatalog.map(item=>item.id==='uno'?{...item,max:12}:item),{...uno,id:'fixture-twelve',name:'仅用于布局验证的十二席目录项',min:7,max:12}]:normalCatalog;
 const isHost=role==='host',canControl=isHost||Boolean(options.owner);
 const view={revision:12,instanceId:'seat-fixture',branch:0,status:options.status??'lobby',game,catalog,seats,ownerSeatId:options.owner?self?.id:null,joinOpen:options.status==='ended'?false:true,gameView:null,history:[],lifecycleActions:[],playMode:'play',decisionClock:null,capabilities:{manage:isHost}};
 window.fixtureCase={role,capacity,occupied,seats,selfId:self?.id??null};
 const session={role,view,self,isHost,canControl,canManageSeats:isHost,locked:false,busy:false,connected:true,credential:'fixture',name,setName,message:'',messageKind:'saved',errorId:'',admissionPending:false,admissionAvatarId:null,admissionAvatarImage:null,awaitingConfirmation:false,join(){},retry(){},retryAdmission(){},setPlayerCredential(){},command(command){window.commands.push(command)},addresses:[],adapters:[],address:'',port:38473,networkMessage:'',externalJoinUrl:null,setAddress(){},refreshNetwork(){},async saveExternalJoinUrl(){return true}};
 return <BoxScreen session={session}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
`,
);

let server, browser, page;
async function configure(options, size = [1280, 720]) {
  await page.setViewportSize({ width: size[0], height: size[1] });
  await page.evaluate((settings) => {
    document.documentElement.dataset.playerDisplay =
      settings.role === 'player' && window.innerWidth >= 1000
        ? 'wide'
        : 'phone';
    window.configureBox(settings);
  }, options);
  await page.waitForFunction(
    (settings) =>
      document
        .querySelector('.box-screen')
        ?.classList.contains(settings.role) &&
      document.querySelector('.room-table')?.dataset.capacity ===
        String(settings.capacity) &&
      document.querySelectorAll('.room-table__seat[data-seat-id]').length ===
        settings.occupied,
    options,
  );
  await page.locator('.room-table').evaluate(async (table) => {
    await Promise.all(
      [...table.querySelectorAll('img')].map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((done) => {
              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
            }),
      ),
    );
  });
}
async function measure(options, size) {
  const measurement = await page.evaluate(() => {
    const table = document.querySelector('.room-table');
    const seats = [...table.querySelectorAll('.room-table__seat')];
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return {
        left: value.left,
        right: value.right,
        top: value.top,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      };
    };
    const visible = (element) =>
      element.getClientRects().length &&
      getComputedStyle(element).visibility !== 'hidden';
    const text = [
      ...document.querySelectorAll(
        '.room-table__seat-number,.room-table__name,.room-table__identity span,.room-table__ready,.room-table__seat--empty h3,.room-table__seat--empty p,.room-capacity,.room-status,.player-profile span',
      ),
    ]
      .filter(visible)
      .map((element) => ({
        text: element.textContent.trim(),
        font: parseFloat(getComputedStyle(element).fontSize),
      }));
    const states = [
      ...document.querySelectorAll(
        '.room-table[data-layout="grid"] .room-table__ready,.room-table__felt strong',
      ),
    ]
      .filter(visible)
      .map((element) => ({
        text: element.textContent.trim(),
        font: parseFloat(getComputedStyle(element).fontSize),
      }));
    const clippedNames = [...table.querySelectorAll('.room-table__name')]
      .filter(
        (element) =>
          element.scrollWidth > element.clientWidth + 1 ||
          element.scrollHeight > element.clientHeight + 1,
      )
      .map((element) => element.textContent);
    return {
      layout: table.dataset.layout,
      capacity: Number(table.dataset.capacity),
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      table: rect(table),
      tableClientWidth: table.clientWidth,
      tableScrollWidth: table.scrollWidth,
      seats: seats.map((element) => ({
        ...rect(element),
        position: Number(element.dataset.position),
        id: element.dataset.seatId ?? null,
        self: element.dataset.self === 'true',
        text: element.innerText,
      })),
      text,
      states,
      clippedNames,
      fixture: window.fixtureCase,
    };
  });
  assert.equal(measurement.capacity, options.capacity);
  assert.equal(measurement.layout, options.capacity > 6 ? 'grid' : 'table');
  assert.equal(measurement.seats.length, options.capacity);
  assert.ok(
    measurement.documentWidth <= measurement.viewportWidth + 1,
    'Page horizontal overflow',
  );
  assert.ok(
    measurement.tableScrollWidth <= measurement.tableClientWidth + 1,
    'Seat collection horizontal overflow',
  );
  assert.deepEqual(
    measurement.clippedNames,
    [],
    'Names must wrap without clipping',
  );
  for (const value of measurement.text)
    assert.ok(
      value.font >= 16,
      `Information text below 16px: ${value.text} (${value.font})`,
    );
  for (const value of measurement.states)
    assert.ok(
      value.font >= 18,
      `Key status below 18px: ${value.text} (${value.font})`,
    );
  for (const [index, seat] of measurement.seats.entries()) {
    assert.ok(seat.width > 0 && seat.height > 0, 'Seat must render');
    assert.ok(
      seat.left >= measurement.table.left - 1 &&
        seat.right <= measurement.table.right + 1 &&
        seat.top >= measurement.table.top - 1 &&
        seat.bottom <= measurement.table.bottom + 1,
      `Seat ${seat.position} clipped by table`,
    );
    for (const other of measurement.seats.slice(index + 1)) {
      const overlapX =
        Math.min(seat.right, other.right) - Math.max(seat.left, other.left);
      const overlapY =
        Math.min(seat.bottom, other.bottom) - Math.max(seat.top, other.top);
      assert.ok(
        overlapX <= 1 || overlapY <= 1,
        `Seats ${seat.position} and ${other.position} overlap`,
      );
    }
  }
  for (const seat of measurement.fixture.seats) {
    const card = page.locator(`.room-table__seat[data-seat-id="${seat.id}"]`);
    assert.equal(
      await card.locator('.room-table__name').innerText(),
      seat.name,
    );
    if (seat.controller === 'human')
      assert.equal(
        await card
          .locator(seat.online ? '.room-table__online' : '.room-table__offline')
          .innerText(),
        seat.online ? '在线' : '离线',
      );
    else
      assert.equal(
        await card.locator('.room-table__difficulty').innerText(),
        { default: '默认', doubao: '豆包', juewu: '绝悟' }[seat.botDifficulty] +
          '人机',
      );
    assert.equal(
      await card.locator('.room-table__ready').innerText(),
      seat.ready ? '已准备' : '未准备',
    );
  }
  const selfCards = page.locator('.room-table__seat[data-self="true"]');
  assert.equal(
    await selfCards.count(),
    options.role === 'player' && options.occupied ? 1 : 0,
  );
  if (
    options.role === 'player' &&
    options.capacity === 12 &&
    options.occupied === 12
  ) {
    assert.equal(await selfCards.getAttribute('data-position'), '12');
    assert.equal(
      await selfCards.locator('.room-table__self').innerText(),
      '你',
    );
    assert.match(
      await page.locator('.player-profile').innerText(),
      /12\s*号位/,
    );
  }
  for (const seat of await page.locator('.room-table__seat').all()) {
    await seat.evaluate((element) =>
      element.scrollIntoView({ block: 'center', inline: 'nearest' }),
    );
    const visibility = await seat.evaluate((element) => {
      const box = element.getBoundingClientRect();
      let left = 0,
        right = window.innerWidth,
        top = 0,
        bottom = window.innerHeight;
      for (
        let ancestor = element.parentElement;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        const style = getComputedStyle(ancestor),
          r = ancestor.getBoundingClientRect();
        if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) {
          left = Math.max(left, r.left);
          right = Math.min(right, r.right);
        }
        if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY)) {
          top = Math.max(top, r.top);
          bottom = Math.min(bottom, r.bottom);
        }
      }
      return {
        position: element.dataset.position,
        complete:
          box.left >= left - 1 &&
          box.right <= right + 1 &&
          box.top >= top - 1 &&
          box.bottom <= bottom + 1,
      };
    });
    assert.ok(
      visibility.complete,
      `Seat ${visibility.position} cannot be scrolled completely into view`,
    );
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  measurement.role = options.role;
  measurement.size = size;
  report.layouts.push(measurement);
}
const screenshotCases = new Set([
  'host/1/1280x720',
  'host/6/1280x720',
  'host/12/1920x1080',
  'public/12/3840x2160',
  'player/12/320x568',
  'player/12/390x844',
  'player/12/844x390',
  'player/12/1280x720',
]);
async function capture(name) {
  const file = name + '.png';
  await page.screenshot({ path: join(output, file), fullPage: true });
  report.screenshots.push({
    file,
    sha256: hash(await readFile(join(output, file))),
  });
}
try {
  console.log('Building source box seat fixture (about 10 seconds)…');
  const started = performance.now();
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
  report.buildMs = Math.round(performance.now() - started);
  server = await serveFixture(join(work, 'bundle'));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === new URL(server.url).origin)
      return route.continue();
    report.externalRequests.push(route.request().url());
    return route.abort();
  });
  page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.goto(server.url);
  await page.locator('.room-table').waitFor();
  if (section !== 'controls') {
    for (const role of ['host', 'public', 'player'].filter(
      (value) => !roleFilter || value === roleFilter,
    )) {
      for (const capacity of [1, 6, 7, 9, 12].filter(
        (value) => !capacityFilter || String(value) === capacityFilter,
      )) {
        for (const size of sizes.filter(
          ([w, h]) => !sizeFilter || `${w}x${h}` === sizeFilter,
        )) {
          const options = {
            role,
            capacity,
            occupied:
              capacity === 1 || capacity === 12 ? capacity : capacity - 1,
          };
          report.current = {
            role,
            capacity,
            size,
            existingRingLayout: capacity <= 6,
            compactHostPublicPressure: role !== 'player' && size[0] < 1000,
          };
          await configure(options, size);
          await measure(options, size);
          const label = `${role}/${capacity}/${size[0]}x${size[1]}`;
          if (screenshotCases.has(label))
            await capture(label.replaceAll('/', '-'));
        }
      }
    }
    checked(
      `${report.layouts.length} role/capacity/viewport layouts: readable complete seat cards, no overlap/horizontal overflow, all seats scroll into view, actual online/ready/bot/self labels`,
    );
    if (!capacityFilter || capacityFilter === '12') {
      for (const role of ['host', 'public', 'player'].filter(
        (value) => !roleFilter || value === roleFilter,
      )) {
        const options = { role, capacity: 12, occupied: 0 };
        await configure(options, [390, 844]);
        await measure(options, [390, 844]);
        assert.equal(
          await page.locator('.room-table__seat--empty').count(),
          12,
        );
      }
      checked(
        'Empty twelve-seat collection preserves every numbered seat and readable empty-state labels',
      );
    }
    assert.deepEqual(
      await page.evaluate(() => window.commands),
      [],
      'Layout inspection must not issue room commands',
    );
  }
  if (section !== 'layout') {
    for (const role of ['host', 'public', 'player']) {
      await configure(
        { role, capacity: 6, occupied: 5, status: 'ended' },
        [1280, 720],
      );
      const actions = page.getByRole('region', {
        name: '牌桌操作',
        exact: true,
      });
      const button = page.getByRole('button', {
        name: '恢复加入',
        exact: true,
      });
      if (role === 'host') {
        assert.equal(await button.count(), 1);
        assert.equal(
          await actions
            .getByRole('button', { name: '再玩一局', exact: true })
            .count(),
          0,
        );
        await button.click();
        assert.deepEqual(await page.evaluate(() => window.commands), [
          { type: 'replay' },
        ]);
      } else {
        assert.equal(await button.count(), 0);
        assert.equal(await actions.count(), 0);
      }
    }
    await configure(
      {
        role: 'player',
        capacity: 12,
        occupied: 12,
        status: 'ended',
        owner: true,
      },
      [390, 844],
    );
    await page.getByRole('button', { name: '恢复加入', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.commands), [
      { type: 'replay' },
    ]);
    checked(
      'Ended action is 恢复加入 and emits one existing replay intent for host/authorized human owner; public and ordinary player have no control',
    );
    await configure(
      { role: 'host', capacity: 6, occupied: 5, normalCatalog: true },
      [1280, 720],
    );
    await page.getByRole('button', { name: '切换游戏', exact: true }).click();
    let library = page.getByRole('region', { name: '游戏库', exact: true });
    const actualMax = await page.evaluate(() =>
      Math.max(...window.normalCatalog.map((game) => game.max)),
    );
    assert.equal(
      actualMax,
      6,
      'Current released catalog remains at most six players',
    );
    assert.deepEqual(
      await library
        .getByRole('combobox', { name: '按人数筛选' })
        .locator('option')
        .evaluateAll((options) => options.map((option) => option.value)),
      ['', '2', '3', '4', '5', '6'],
    );
    await page
      .getByRole('dialog', { name: '游戏库', exact: true })
      .getByRole('button', { name: '关闭面板', exact: true })
      .click();
    await configure(
      { role: 'host', capacity: 12, occupied: 12, wideCatalog: true },
      [1280, 720],
    );
    await page.getByRole('button', { name: '切换游戏', exact: true }).click();
    library = page.getByRole('region', { name: '游戏库', exact: true });
    const playerFilter = library.getByRole('combobox', { name: '按人数筛选' });
    assert.deepEqual(
      await playerFilter
        .locator('option')
        .evaluateAll((options) => options.map((option) => option.value)),
      ['', ...Array.from({ length: 11 }, (_, index) => String(index + 2))],
    );
    await playerFilter.selectOption('12');
    await page.waitForFunction(
      () => document.querySelectorAll('.game-library__item').length === 2,
    );
    assert.deepEqual(
      (
        await library
          .locator('.game-library__item')
          .evaluateAll((items) => items.map((item) => item.dataset.gameId))
      ).sort(),
      ['fixture-twelve', 'uno'],
    );
    assert.deepEqual(
      await page.evaluate(() => window.commands),
      [],
      'Filtering does not submit selection',
    );
    checked(
      'Actual catalog offers 2–6 player filters only; synthetic twelve-player catalog offers 2–12 and correctly retains only eligible entries',
    );
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.externalRequests, []);
  report.status = 'passed';
  console.log(
    `${report.checks.length} check groups passed; ${report.layouts.length} layouts; ${report.screenshots.length} screenshots; build ${report.buildMs}ms.`,
  );
} catch (error) {
  report.status = 'failed';
  report.error = error.stack ?? error.message;
  if (page && !page.isClosed())
    await page
      .screenshot({ path: join(output, 'failure.png'), fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await server?.close();
  report.finishedAt = new Date().toISOString();
  await save();
  await registerArtifacts({
    output,
    reportPath: join(output, 'report.json'),
    work,
    passed: report.status === 'passed',
  });
  console.log('Evidence: ' + output);
}
