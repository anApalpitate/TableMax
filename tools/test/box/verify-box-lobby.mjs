import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { leanCatalogPlugin } from '../../build/lean-catalog.mjs';
import { projectGameDetails } from '../../../packages/game-sdk/src/metadata.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
const run = process.argv.find((x) => x.startsWith('--evidence='))?.slice(11);
assert.match(run ?? '', /^[a-z0-9-]+$/);
const output = resolve('artifacts/maintenance/box-lobby-20261023', run);
await mkdir(output, { recursive: true });
const taskRoot = resolve(
  'tmp',
  process.env.TABLEMAX_TASK_ID ?? `box-lobby-${run}`,
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
const seats=Array.from({length:o.joining?0:(o.count??3)},(_,i)=>({id:'seat-'+i,name:o.long?(i%2?'Abcdefghijklmnop':'大家一起开心玩耍'):i===0?'小明':'朋友'+i,avatarId:AVATAR_PRESETS[i%AVATAR_PRESETS.length].id,ready:i===0?!!o.ready:true,online:i!==1,controller:i===2?'bot':'human',botDifficulty:'default'}));
const role=o.role??'player';
const view={id:'fixture',name:'聚会牌桌',status:o.status??'lobby',joinOpen:!o.closed,playMode:'play',seats,ownerSeatId:o.owner?'seat-0':null,paused:!!o.paused,lifecycleActions:o.status==='playing'?[{type:'next'}]:[],botError:null,gameView:o.status==='playing'||o.status==='ended'?{}:null,capabilities:{manage:false,manageSeats:false},game:{id:o.game??'cockroach-poker',name:'德国小强',min:2,max:o.capacity??6}};
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
  await page.route('**/games/*/web/details.json', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/')[2];
    await route.fulfill({
      json: projectGameDetails(
        JSON.parse(
          await readFile(resolve('games', id, 'game-module.json'), 'utf8'),
        ),
      ),
    });
  });
  await page.route('**/games/*/resources/**', async (route) => {
    const m = new URL(route.request().url()).pathname.match(
      /^\/games\/([^/]+)\/resources\/\1\/(.*)$/,
    );
    assert(m);
    await route.fulfill({
      body: await readFile(resolve('assets/games', m[1], m[2])),
      contentType: 'image/svg+xml',
    });
  });
  await page.goto(server.url);
  await page.evaluate(
    () => (document.documentElement.dataset.playerDisplay = 'wide'),
  );
  await page.waitForFunction(() => !!window.renderBox);
  const render = async (o) => {
    await page.evaluate((o) => window.renderBox(o), o);
  };
  // Exercise the real host toolbar with the five-character lifecycle action.
  for (const [w, h] of [
    [320, 568],
    [844, 390],
    [1280, 720],
    [1568, 944],
    [1920, 1080],
    [3840, 2160],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    for (const status of ['lobby', 'playing', 'ended']) {
      await render({
        role: 'host',
        status,
        joining: false,
        count: 3,
        capacity: 5,
        paused: false,
      });
      const layout = await page.evaluate(() => {
        const heading = document
          .querySelector('.room-heading')
          .getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          buttons: [...document.querySelectorAll('.room-heading button')].map(
            (b) => {
              const r = b.getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(b);
              const text = range.getBoundingClientRect();
              return {
                label: b.textContent.trim(),
                left: r.left,
                right: r.right,
                top: r.top,
                bottom: r.bottom,
                clipped:
                  b.scrollWidth > b.clientWidth + 1 ||
                  b.scrollHeight > b.clientHeight + 1,
                textFits:
                  text.left >= r.left &&
                  text.right <= r.right &&
                  text.top >= r.top &&
                  text.bottom <= r.bottom,
                inside: r.left >= heading.left && r.right <= heading.right + 1,
              };
            },
          ),
        };
      });
      assert(!layout.overflow, `host overflow ${w} ${status}`);
      assert(
        layout.buttons.every((b) => !b.clipped && b.textFits && b.inside),
        JSON.stringify({ w, status, layout }),
      );
      for (let i = 0; i < layout.buttons.length; i++)
        for (let j = i + 1; j < layout.buttons.length; j++) {
          const a = layout.buttons[i],
            b = layout.buttons[j];
          assert(
            !(
              a.left < b.right - 1 &&
              a.right > b.left + 1 &&
              a.top < b.bottom - 1 &&
              a.bottom > b.top + 1
            ),
            `host actions overlap ${w} ${status}`,
          );
        }
      report.checks.push(`host actions ${w}x${h} ${status}`);
      if (status === 'playing') {
        const path = join(output, `host-${w}.png`);
        await page.screenshot({ path, fullPage: true });
        report.screenshots.push(path);
      }
    }
  }
  await render({ role: 'host', status: 'playing' });
  await page.getByRole('button', { name: '开始下一局', exact: true }).click();
  assert(
    await page.evaluate(() =>
      window.commands.some((c) => c.type === 'lifecycle'),
    ),
  );
  await page.getByRole('button', { name: '暂停游戏', exact: true }).click();
  assert(
    await page.evaluate(() => window.commands.some((c) => c.type === 'pause')),
  );
  await render({ paused: true });
  assert.equal(
    await page.getByRole('button', { name: '开始下一局', exact: true }).count(),
    0,
  );
  await page.getByRole('button', { name: '恢复游戏', exact: true }).click();
  assert(
    await page.evaluate(() => window.commands.some((c) => c.type === 'resume')),
  );
  await page.getByRole('button', { name: '结束游戏', exact: true }).click();
  assert(
    await page
      .getByRole('button', { name: '确认结束游戏', exact: true })
      .isVisible(),
  );
  await page.getByRole('button', { name: '取消', exact: true }).click();
  assert(
    !(await page.evaluate(() => window.commands.some((c) => c.type === 'end'))),
  );
  report.checks.push(
    'host lifecycle/pause/resume commands and end confirmation cancel',
  );
  // Returning from a running/ended game must not reserve a missing ready row.
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [1280, 720],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    for (const status of ['playing', 'ended']) {
      await render({
        role: 'player',
        owner: true,
        status,
        count: 4,
        capacity: 5,
        joining: false,
        paused: false,
      });
      const path = join(output, `return-${status}-${w}.png`);
      await page.screenshot({ path, fullPage: true });
      report.screenshots.push(path);
      const profile = await page.evaluate(() => {
        const card = document.querySelector('.player-actions');
        const content = [...card.children].map((e) =>
          e.getBoundingClientRect(),
        );
        const r = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        return {
          height: r.height,
          unused:
            r.bottom -
            Math.max(...content.map((c) => c.bottom)) -
            parseFloat(style.paddingBottom) -
            parseFloat(style.borderBottomWidth),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      assert(!profile.overflow, `returned player overflow ${w} ${status}`);
      assert(
        profile.unused <= 2,
        `unused ready row ${w} ${status}: ${JSON.stringify(profile)}`,
      );
      assert.equal(await page.locator('.player-ready').count(), 0);
      assert(
        await page
          .getByRole('link', { name: '进入牌桌', exact: true })
          .isVisible(),
      );
      assert(
        await page
          .getByRole('button', { name: '座位设置', exact: true })
          .isVisible(),
      );
      report.checks.push(
        `returned player owner compact profile ${w}x${h} ${status}`,
      );
    }
  }
  await render({
    role: 'player',
    owner: false,
    status: 'lobby',
    paused: false,
  });
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    for (const joining of [true, false]) {
      await render({
        joining,
        count: 3,
        capacity: 6,
        long: false,
        status: 'lobby',
        closed: false,
      });
      const metrics = await page.evaluate(() => {
        const seats = [...document.querySelectorAll('.room-table__seat')].map(
          (e) => {
            const r = e.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            };
          },
        );
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          seats,
        };
      });
      assert(!metrics.overflow, `no page overflow ${w} joining=${joining}`);
      for (let i = 0; i < metrics.seats.length; i++)
        for (let j = i + 1; j < metrics.seats.length; j++) {
          const a = metrics.seats[i],
            b = metrics.seats[j];
          assert(
            !(
              a.left < b.right - 1 &&
              a.right > b.left + 1 &&
              a.top < b.bottom - 1 &&
              a.bottom > b.top + 1
            ),
            `seats overlap ${w}`,
          );
        }
      if (w === 1280)
        assert(
          metrics.seats.every((s) => s.bottom <= h),
          `six seats in first screen joining=${joining}`,
        );
      if (joining) {
        assert(await page.locator('.join-table input').isVisible());
      }
      report.checks.push(`layout ${w}x${h} joining=${joining}`);
      const path = join(output, `${w}-${joining ? 'join' : 'self'}.png`);
      await page.screenshot({ path, fullPage: true });
      report.screenshots.push(path);
    }
  }
  for (const capacity of [10, 12]) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await render({ capacity, count: capacity, long: true });
    assert.equal(await page.locator('.room-table__seat').count(), capacity);
    report.checks.push(`${capacity} long-name seats`);
  }
  await render({ capacity: 6, count: 3, long: false, joining: false });
  await page.getByRole('button', { name: '我准备好了', exact: true }).click();
  assert(
    await page.evaluate(() =>
      window.commands.some((c) => c.type === 'ready' && c.ready === true),
    ),
  );
  report.checks.push('ready command');
  await render({ ready: true });
  await page.getByRole('button', { name: '取消准备', exact: true }).click();
  assert(
    await page.evaluate(() =>
      window.commands.some((c) => c.type === 'ready' && c.ready === false),
    ),
  );
  await render({ ready: false });
  report.checks.push('cancel ready command');

  await render({ joining: true });
  await page.locator('.join-table button').last().click();
  assert(
    await page.evaluate(() => window.commands.some((c) => c.type === 'join')),
  );
  report.checks.push('join command');
  await render({ closed: true });
  assert(await page.locator('.join-table button').last().isDisabled());
  report.checks.push('closed join locked');
  await render({
    closed: false,
    pending: true,
    message: '正在确认入座',
    kind: 'progress',
  });
  assert(
    await page
      .getByRole('button', { name: '重试入座确认', exact: true })
      .isVisible(),
  );
  assert.equal(await page.locator('.box-save-feedback').count(), 0);
  report.checks.push('pending stays explicit');
  await render({
    pending: false,
    joining: false,
    kind: 'progress',
    message: '正在提交…',
  });
  await render({ kind: 'saved', message: '已保存' });
  await page.locator('.box-save-feedback').waitFor({ state: 'visible' });
  await page.screenshot({ path: join(output, 'saved.png') });
  await page.waitForTimeout(1900);
  assert.equal(await page.locator('.box-save-feedback').count(), 0);
  await render({});
  assert.equal(await page.locator('.box-save-feedback').count(), 0);
  report.checks.push('save fades and rerender does not replay');
  await render({ kind: 'progress', message: '正在提交…' });
  await render({ kind: 'saved', message: '已保存' });
  await page.waitForTimeout(1000);
  await render({ kind: 'progress', message: '正在提交…' });
  await render({ kind: 'saved', message: '已保存' });
  await page.waitForTimeout(800);
  assert.equal(
    await page.locator('.box-save-feedback[data-phase=saved]').count(),
    1,
  );
  await render({ kind: 'error', message: '保存失败' });
  assert.equal(await page.locator('.box-save-feedback').count(), 0);
  await render({ connected: false, kind: 'saved', message: '已保存' });
  await render({ connected: true });
  assert.equal(await page.locator('.box-save-feedback').count(), 0);
  await render({ awaiting: true, message: '保存尚未确认', kind: 'progress' });
  assert(
    await page
      .getByRole('button', { name: '重试确认', exact: true })
      .isVisible(),
  );
  assert.equal(await page.locator('.box-save-feedback').count(), 0);
  await render({ awaiting: false, kind: 'saved', message: '已保存' });
  report.checks.push(
    'success renewal, error, reconnect and unconfirmed guards',
  );
  for (const status of ['playing', 'ended']) {
    await render({ status });
    assert.equal(await page.locator('.hero a[href="/player/game"]').count(), 1);
    assert.equal(await page.locator('.continue-game').count(), 0);
    report.checks.push(`${status} entry in hero`);
  }
  for (const role of ['host', 'player']) {
    for (const id of ['cockroach-poker']) {
      for (const [w, h] of [
        [320, 568],
        [390, 844],
        [844, 390],
        [1280, 720],
        [1920, 1080],
        [3840, 2160],
      ]) {
        await page.setViewportSize({ width: w, height: h });
        await render({ role, game: id, status: 'lobby', joining: false });
        const commandsBefore = await page.evaluate(
          () => window.commands.length,
        );
        await page
          .getByRole('button', { name: '玩法说明', exact: true })
          .click();
        const imgs = page.locator('img.game-overview__illustration');
        await imgs.first().waitFor();
        assert.equal(await imgs.count(), 3);
        await page.waitForFunction(() =>
          [
            ...document.querySelectorAll('img.game-overview__illustration'),
          ].every((e) => e.complete && e.naturalWidth > 0),
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        if (role === 'player')
          await page.screenshot({
            path: join(output, id + '-' + w + '-intro.png'),
            fullPage: true,
          });
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.game-introduction').count(), 0);
        assert.equal(
          await page.evaluate(() => window.commands.length),
          commandsBefore,
        );
        report.checks.push(`${role} ${id} introduction ${w}x${h}`);
      }
    }
  }
  await page.evaluate(
    () => delete document.documentElement.dataset.playerDisplay,
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await render({ role: 'player', joining: false, capacity: 6, count: 3 });
  assert(
    await page
      .locator('.room-table')
      .boundingBox()
      .then((r) => r.width > 400),
  );
  report.checks.push('default player display remains stacked');
  assert.deepEqual(report.errors, []);
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [1280, 720],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(
      () => (document.documentElement.dataset.playerDisplay = 'wide'),
    );
    await render({ kind: 'progress', message: '正在提交…' });
    await render({ kind: 'saved', message: '已保存' });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const receipt = await page.locator('.box-save-feedback').boundingBox();
    assert(
      receipt &&
        receipt.y >= 0 &&
        receipt.x >= 0 &&
        receipt.x + receipt.width <= w,
      JSON.stringify({ w, receipt }),
    );
    for (const control of await page
      .locator('header button, header .connection, header .brand-mark')
      .all()) {
      const r = await control.boundingBox();
      if (r)
        assert(
          !(
            receipt.x < r.x + r.width &&
            receipt.x + receipt.width > r.x &&
            receipt.y < r.y + r.height &&
            receipt.y + receipt.height > r.y
          ),
          'save avoids header controls ' + w,
        );
    }
    await page.screenshot({ path: join(output, 'saved-' + w + '.png') });
    report.checks.push('safe save anchor ' + w);
  }
  report.sources = {};
  for (const path of [
    'apps/web/src/screens/BoxScreen.tsx',
    'apps/web/src/screens/box-lobby.css',
    'apps/web/src/components/RoomTable.tsx',
    'apps/web/src/components/BoxSaveStatus.tsx',
    'tools/test/box/verify-box-lobby.mjs',
    ...['cockroach-poker'].flatMap((id) => [
      'games/' + id + '/game-module.json',
      ...[1, 2, 3].map(
        (n) => 'assets/games/' + id + '/introduction-' + n + '-v1.svg',
      ),
    ]),
  ])
    report.sources[path] = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
  report.result = 'passed';
} catch (e) {
  report.result = 'failed';
  report.error = e.stack;
  throw e;
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.length,
      output,
      error: report.error,
    }),
  );
}
