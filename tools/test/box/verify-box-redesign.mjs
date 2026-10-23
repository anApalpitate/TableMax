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
const profileOnly = process.argv.includes('--profile-only');
const run = process.argv.find((x) => x.startsWith('--evidence='))?.slice(11);
assert.match(run ?? '', /^[a-z0-9-]+$/);
const output = resolve('artifacts/maintenance/box-redesign-20261023', run);
await mkdir(output, { recursive: true });
const sourcePaths = [
  'apps/web/src/screens/BoxScreen.tsx',
  'apps/web/src/screens/box-lobby.css',
  'apps/web/src/components/RoomTable.tsx',
  'apps/web/src/components/AvatarPicker.tsx',
  'apps/web/src/components/AvatarUpload.tsx',
  'apps/web/src/components/avatar-picker.css',
  'apps/web/src/components/avatar-upload.css',
  'apps/web/src/components/GameLibrary.tsx',
  'apps/web/src/components/game-library/library.css',
  'tools/test/box/verify-box-redesign.mjs',
  'apps/web/src/screens/box-screen.css',
  'apps/web/src/screens/box-refinements.css',
  'apps/web/src/styles.css',
];
const inputHashes = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (p) => [
      p,
      createHash('sha256')
        .update(await readFile(p))
        .digest('hex'),
    ]),
  ),
);
const work = await mkdtemp(resolve('tmp/box-redesign-'));
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
const seats=Array.from({length:o.joining&&!o.existing?0:(o.count??3)},(_,i)=>({id:'seat-'+i,name:o.long?(i%2?'Abcdefghijklmnop':'大家一起开心玩耍'):i===o.selfIndex?'lc':i===0?'小明':'朋友'+i,avatarId:AVATAR_PRESETS[i%AVATAR_PRESETS.length].id,ready:i===(o.selfIndex??0)?!!o.ready:true,online:i!==1,controller:i===2?'bot':'human',botDifficulty:'default'}));
const role=o.role??'player';
const view={catalog:${JSON.stringify([
    { id: 'avalon', name: '阿瓦隆', min: 5, max: 10, decisionTimer: true },
    { id: 'cockroach-poker', name: '德国小强', min: 2, max: 6 },
    { id: 'cockroach-salad', name: '蟑螂沙拉', min: 2, max: 6 },
    { id: 'manila', name: '马尼拉', min: 3, max: 5 },
    { id: 'modern-art', name: '现代艺术', min: 3, max: 5, decisionTimer: true },
    {
      id: 'pokemon-encounters',
      name: '宝可梦奇遇：皮卡丘和朋友们',
      min: 2,
      max: 6,
    },
    { id: 'power-grid', name: '电力公司', min: 2, max: 6, decisionTimer: true },
    { id: 'rummikub', name: '拉密', min: 2, max: 4, decisionTimer: true },
    { id: 'uno', name: 'UNO', min: 2, max: 6, decisionTimer: true },
  ])},lifecycleActions:[],joinPolicy:'open',id:'fixture',name:'聚会牌桌',status:o.status??'lobby',joinOpen:!o.closed,playMode:'play',seats,ownerSeatId:o.owner?seats[0]?.id:null,paused:false,botError:null,gameView:o.status==='playing'||o.status==='ended'?{}:null,capabilities:{manage:role==='host',manageSeats:role==='host'},game:{id:o.game??'cockroach-salad',name:o.game==='modern-art'?'现代艺术':o.game==='cockroach-poker'?'德国小强':'蟑螂沙拉',min:2,max:o.capacity??6}};
const session={role,view,self:role!=='player'||o.joining?null:seats[o.selfIndex??0],isHost:role==='host',canControl:role==='host',canManageSeats:role==='host',locked:!!o.closed,busy:!!o.busy,connected:o.connected!==false,credential:o.joining?null:'fixture',name:'小明',message:o.message??'',messageKind:o.kind??'saved',errorId:'',admissionPending:!!o.pending,awaitingConfirmation:!!o.awaiting,admissionAvatarId:null,admissionAvatarImage:null,addresses:[],adapters:[],address:'127.0.0.1',port:38473,networkMessage:'',externalJoinUrl:null,setAddress(){},refreshNetwork(){},async saveExternalJoinUrl(){return true},setName(){},join(){window.commands.push({type:'join'})},retry(){window.commands.push({type:'retry'})},retryAdmission(){window.commands.push({type:'retryAdmission'})},setPlayerCredential(){},uploadAvatar(image){window.commands.push({type:'upload-avatar',bytes:image.length})},command(c){window.commands.push(c)}};
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
  await page.route('**/api/foundation/qr?*', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="196" height="196"><rect width="196" height="196" fill="#edf3e7"/><path d="M24 24h48v48H24zm100 0h48v48h-48zM24 124h48v48H24z" fill="#215947"/></svg>',
    }),
  );
  await page.goto(server.url);
  await page.evaluate(
    () => (document.documentElement.dataset.playerDisplay = 'wide'),
  );
  await page.waitForFunction(() => !!window.renderBox);
  const render = async (o) => {
    await page.evaluate((o) => window.renderBox(o), o);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((img) => img.decode().catch(() => {})),
      );
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    });
  };
  const snap = async (name) => {
    const path = join(output, name + '.png');
    await page.screenshot({ path, fullPage: true });
    report.screenshots.push(path);
  };
  const slots = async () =>
    page.locator('.room-table__seat').evaluateAll((es) =>
      es.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
  for (const role of ['host', 'public', 'player']) {
    for (const [w, h] of [
      [320, 568],
      [390, 844],
      [844, 390],
      [1280, 720],
      [1920, 1080],
      [3840, 2160],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await render({
        role,
        joining: true,
        existing: false,
        count: 3,
        capacity: 6,
        long: false,
        status: 'lobby',
      });
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: 'instant' }),
      );
      const before = await slots();
      await snap(`${role}-${w}-empty`);
      await render({ joining: false });
      const after = await slots();
      await snap(`${role}-${w}-occupied`);
      for (let i = 0; i < 6; i++)
        for (const key of ['x', 'y', 'width', 'height'])
          assert(
            Math.abs(after[i][key] - before[i][key]) < 1,
            `${role} ${w} slot ${i} ${key} stable ${before[i][key]} -> ${after[i][key]}`,
          );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${role} ${w} no horizontal overflow`,
      );
      if (w >= 1280) {
        const bottom = Math.max(...after.map((x) => x.y + x.height));
        if (h === 720)
          assert(bottom <= h, `${role} six seats in 720p ${bottom}`);
        assert(
          bottom >= h * 0.72,
          `${role} table uses viewport height ${bottom}/${h}`,
        );
      }
      await snap(`${role}-${w}`);
      await render({ long: true });
      assert.deepEqual(
        (await slots()).map((r) => r.height),
        after.map((r) => r.height),
        'maximum names do not resize cards',
      );
      const clipped = await page
        .locator('.room-table__name,.room-table__identity,.room-table__ready')
        .evaluateAll((es) =>
          es
            .filter((e) => {
              const a = e.getBoundingClientRect(),
                r = e.closest('.room-table__seat').getBoundingClientRect();
              return (
                a.bottom > r.bottom + 1 ||
                a.left < r.left - 1 ||
                a.right > r.right + 1
              );
            })
            .map((e) => e.textContent),
        );
      assert.deepEqual(clipped, [], `${role} ${w} full legal names fit`);
      report.checks.push(
        `${role} ${w} stable empty/occupied/max-name slots and viewport use`,
      );
    }
  }
  if (!profileOnly) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await render({
      role: 'player',
      joining: false,
      count: 3,
      capacity: 6,
      long: false,
    });
    await page.getByRole('button', { name: '更换头像', exact: true }).click();
    for (const [w, h] of [
      [320, 568],
      [844, 390],
      [1280, 720],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      const choices = page.locator('.avatar-choice');
      await choices.first().waitFor();
      assert.equal(await choices.count(), 26);
      assert(
        await page
          .locator('.avatar-choice[data-occupied="true"]')
          .first()
          .isDisabled(),
      );
      assert.equal(
        await page.locator('.avatar-choice[aria-pressed="true"]').count(),
        1,
      );
      assert.equal(await page.locator('input[type=file]').count(), 1);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await snap('avatars-' + w);
      report.checks.push('avatar gallery states ' + w);
    }
    await page.locator('.avatar-choice:not([disabled])').last().click();
    assert(
      await page.evaluate(() =>
        window.commands.some((c) => c.type === 'set-avatar'),
      ),
    );
    assert.equal(
      await page.locator('.avatar-picker').count(),
      1,
      'existing player selection waits for authoritative update',
    );
    await page
      .locator('input[type=file]')
      .setInputFiles(resolve('assets/platform/app-icon-180.png'));
    await page.locator('.avatar-upload__frame').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: '确定', exact: true }).click();
    assert(
      await page.evaluate(() =>
        window.commands.some((c) => c.type === 'upload-avatar' && c.bytes > 0),
      ),
    );
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.avatar-picker').count(), 0);
    await render({ joining: true });
    await page.getByRole('button', { name: '选择头像', exact: true }).click();
    await page.locator('.avatar-choice:not([disabled])').last().click();
    assert.equal(
      await page.locator('.avatar-picker').count(),
      0,
      'draft choice closes without submission',
    );
    await render({ joining: false });
    report.checks.push('existing and draft avatar selection, upload crop');
    await page.setViewportSize({ width: 1280, height: 720 });
    await render({ role: 'host' });
    await page.getByRole('button', { name: '切换游戏', exact: true }).click();
    for (const [w, h] of [
      [320, 568],
      [1280, 720],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      assert.equal(await page.locator('.game-library__tagline').count(), 0);
      assert(
        (await page.locator('.game-library__item[data-planned=true]').count()) >
          0,
      );
      assert(
        (await page.locator('.game-library__item[data-planned=true]').count()) <
          (await page.locator('.game-library__item').count()),
      );
      await snap('library-' + w);
      report.checks.push('concise released/planned library ' + w);
    }
    const search = page.getByRole('searchbox', { name: '搜索游戏' });
    await search.fill('UNO');
    assert.equal(await page.locator('.game-library__item').count(), 1);
    await search.fill('');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.game-library').count(), 0);
    report.checks.push('library search and close');
    await render({ role: 'host', count: 6, capacity: 6, long: false });
    await page.setViewportSize({ width: 1920, height: 1080 });
    const reserved = await page.evaluate(() => {
      const a = document
          .querySelector('aside.controls')
          .getBoundingClientRect(),
        b = document.querySelector('.invite-friends').getBoundingClientRect();
      return a.bottom - b.bottom;
    });
    assert(reserved > 80, 'space below connection remains reserved');
    assert.equal(
      await page.locator('aside.controls input').count(),
      0,
      'no future host player URL input implemented',
    );
    report.checks.push('connection lower reserve unchanged');
    for (const capacity of [10, 12]) {
      await render({ role: 'player', count: capacity, capacity, long: true });
      assert.equal(await page.locator('.room-table__seat').count(), capacity);
      await snap('seats-' + capacity);
      report.checks.push('expanded capacity ' + capacity);
    }
  }
  if (profileOnly) {
    for (const [w, h] of [
      [320, 568],
      [390, 844],
      [844, 390],
      [1280, 720],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await render({
        role: 'player',
        game: 'modern-art',
        capacity: 5,
        count: 4,
        selfIndex: 3,
        joining: false,
        long: false,
        ready: false,
      });
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: 'instant' }),
      );
      const panel = await page.locator('.player-actions').boundingBox();
      assert(panel.height <= 168, 'profile ticket has no tall spacer');
      await snap('profile-' + w);
      await page
        .locator('.player-actions')
        .screenshot({ path: join(output, 'ticket-' + w + '.png') });
      const seatsBefore = await slots();
      await page
        .getByRole('button', { name: '我准备好了', exact: true })
        .click();
      assert(
        await page.evaluate(() =>
          window.commands.some((c) => c.type === 'ready' && c.ready),
        ),
      );
      await render({ ready: true });
      assert(
        (await page
          .getByRole('button', { name: '取消准备', exact: true })
          .getAttribute('aria-pressed')) === 'true',
      );
      assert.deepEqual(
        await slots(),
        seatsBefore,
        'ready change leaves seats in place',
      );
      await page.getByRole('button', { name: '取消准备', exact: true }).click();
      assert(
        await page.evaluate(() =>
          window.commands.some((c) => c.type === 'ready' && !c.ready),
        ),
      );
      await snap('profile-' + w + '-ready');
      report.checks.push(
        'compact modern-art personal ticket and ready toggle ' + w,
      );
    }
  }
  assert.deepEqual(report.errors, []);
  for (const p of sourcePaths)
    assert.equal(
      createHash('sha256')
        .update(await readFile(p))
        .digest('hex'),
      inputHashes[p],
      `input remained frozen: ${p}`,
    );
  report.sources = inputHashes;
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
