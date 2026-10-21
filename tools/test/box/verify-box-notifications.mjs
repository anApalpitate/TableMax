import { captureBrowserScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
import { verificationOutput } from '../support/verification-output.mjs';

const run =
  process.argv.find((value) => value.startsWith('--run='))?.slice(6) ??
  `run-${Date.now()}`;
assert.match(run, /^[A-Za-z0-9_-]+$/);
const output = verificationOutput('box-notifications', run);
const messagesForReport = {
  full: '牌桌已满，请电脑管理员检查是否有离线的重复座位。',
};
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/box-layout-'));
await writeFile(
  join(work, 'index.html'),
  '<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  join(work, 'entry.tsx'),
  `
import React,{StrictMode,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {BoxScreen} from ${JSON.stringify(resolve('apps/web/src/screens/BoxScreen.tsx'))};
import {SeatSettings} from ${JSON.stringify(resolve('apps/web/src/components/SeatSettings.tsx'))};
import {AVATAR_PRESETS} from ${JSON.stringify(resolve('packages/protocol/src/avatars.ts'))};
import {useAdmission} from ${JSON.stringify(resolve('apps/web/src/session/useAdmission.ts'))};
import {Notifications} from ${JSON.stringify(resolve('apps/web/src/components/notifications/Notifications.tsx'))};
import {useNotifications} from ${JSON.stringify(resolve('apps/web/src/components/notifications/context.ts'))};
import {OverlayPanel} from ${JSON.stringify(resolve('apps/web/src/components/OverlayPanel.tsx'))};
import {feedbackKind} from ${JSON.stringify(resolve('apps/web/src/content/feedback.ts'))};
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
import ${JSON.stringify(resolve('apps/web/src/screens/box-screen.css'))};
const root=createRoot(document.getElementById('root'));
const game={id:'pokemon-encounters',name:'宝可梦奇遇：皮卡丘和朋友们',min:2,max:6};
const base={revision:12,instanceId:'fixture',branch:0,status:'lobby',game,catalog:[game],seats:[],ownerSeatId:null,joinOpen:true,gameView:null,history:[],lifecycleActions:[],playMode:'play',decisionClock:null,capabilities:{manage:false}};
function Box(){
 const [message,setMessage]=useState(''),[name,setName]=useState('朋友'),[credential,setCredential]=useState(''),[patch,setPatch]=useState({});
 const admission=useAdmission(!credential,setCredential,setMessage);
 window.patchBox=setPatch;
 const session={role:'player',view:base,self:null,isHost:false,canControl:false,canManageSeats:false,locked:admission.busy,busy:admission.busy,connected:true,credential,name,setName,message,errorId:'',admissionPending:admission.pending,admissionAvatarId:admission.avatarId,admissionAvatarImage:admission.avatarImage,awaitingConfirmation:false,join:(id,image)=>admission.join(name,id,image),retryAdmission:admission.retry,command(){},retry(){},setPlayerCredential:setCredential,...patch};
 session.messageKind=feedbackKind(session.message);
 return <BoxScreen session={session}/>;
}
function RenameProbe(){
 const seat={id:'rename-player',name:'小明',avatarId:AVATAR_PRESETS[0].id,controller:'human',connected:true,ready:false};
 window.renameCommands=[];
 const session={view:{...base,seats:[seat],self:{seatId:null}},isHost:window.managerRole==='host',canManageSeats:true,locked:false,command(c){window.renameCommands.push(c)}};
 return <Notifications><SeatSettings session={session} removeSeat={()=>{}}/></Notifications>;
}
function Probe(){
 const center=useNotifications();const [open,setOpen]=useState(false);
 useEffect(()=>{window.center=center;},[center]);
 return <><button id="open-dialog" onClick={()=>setOpen(true)}>打开测试面板</button><button id="background">背景操作</button>{open&&<OverlayPanel title="通知测试" close={()=>setOpen(false)}><button id="dialog-action">面板操作</button></OverlayPanel>}</>;
}
window.render=(mode)=>flushSync(()=>root.render(<StrictMode>{mode==='box'?<Box/>:mode==='names'?<RenameProbe/>:<Notifications><Probe/></Notifications>}</StrictMode>));
window.render('box');
`,
);
console.log('Building box notification fixture (about 10 seconds)…');
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
const report = { status: 'running', work, checks: [], errors: [], sources: {} };
for (const file of [
  'apps/web/src/screens/BoxScreen.tsx',
  'apps/web/src/components/SeatSettings.tsx',
  'packages/protocol/src/names.ts',
  'tools/test/box/verify-box-notifications.mjs',
]) {
  report.sources[file] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
}
const checked = (message) => report.checks.push(message);
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (error) => report.errors.push(error.message));
  let joinRequests = 0;
  await page.route('**/api/session/join', async (route) => {
    joinRequests++;
    const request = route.request().postDataJSON();
    assert.ok(request.requestKey, 'Admission keeps the original request key');
    await route.fulfill({
      json: { ok: false, reason: 'room-full' },
    });
  });
  await page.goto(server.url);
  const notices = page.locator('.tablemax-notice');
  const join = page.getByRole('button', { name: '加入', exact: true });
  const nickname = page.getByRole('textbox', { name: '你的昵称', exact: true });
  for (const [width, height] of [
    [320, 640],
    [844, 390],
    [1280, 720],
  ]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.getByText(/最多8个中文字|混合计长/).count(), 0);
    await nickname.fill('一二三四五六七八九'); // Deliberate invalid-length input.
    assert.equal(
      await notices.count(),
      0,
      'Typing alone does not show a warning',
    );
    await join.click();
    await notices.filter({ hasText: '最多8个中文字' }).waitFor();
    assert.equal(joinRequests, 0, 'Invalid admission must not send a request');
    assert.equal(await nickname.inputValue(), '一二三四五六七八九');
    await notices.getByRole('button', { name: '关闭提示' }).click();
    await notices.waitFor({ state: 'detached' });
    await nickname.fill('朋友');
    assert.equal(await nickname.getAttribute('aria-invalid'), 'false');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  checked(
    'Join nickname: no persistent hint or counter, submit-only popup, no invalid request, draft retained and correction clears invalid state at phone/landscape/desktop sizes.',
  );
  await join.click();
  await notices.filter({ hasText: messagesForReport.full }).waitFor();
  assert.equal(await notices.count(), 1);
  assert.equal(await page.locator('.session-feedback').count(), 0);
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('.tablemax-notice')).opacity ===
      '1',
  );
  await captureBrowserScreenshot(page, {
    path: joinPath('mobile-admission.png'),
  });
  await notices.getByRole('button', { name: '关闭提示' }).click();
  await notices.waitFor({ state: 'detached' });
  await join.click();
  await notices.filter({ hasText: messagesForReport.full }).waitFor();
  assert.equal(await notices.count(), 1);
  checked(
    'Real admission hook: room-full reply becomes a popup; same rejection can be shown again.',
  );

  await page.evaluate(() =>
    window.patchBox({
      message: '尚未收到入座确认。可重试原请求，刷新也不会重复占座。',
      admissionPending: true,
    }),
  );
  await page.getByRole('button', { name: '重试入座确认' }).waitFor();
  await page.evaluate(() => {
    for (const button of document.querySelectorAll('.tablemax-notice button'))
      button.click();
  });
  await page.waitForFunction(
    () => document.querySelectorAll('.tablemax-notice').length === 0,
  );
  assert.ok(
    await page.getByRole('button', { name: '重试入座确认' }).isVisible(),
  );
  await page.evaluate(() =>
    window.patchBox({
      message: '尚未收到保存确认，请重试确认。',
      awaitingConfirmation: true,
    }),
  );
  await page.getByRole('button', { name: '重试确认', exact: true }).waitFor();
  checked(
    'Admission and save-confirmation retry actions remain after dismissing feedback.',
  );

  await page.evaluate(() =>
    window.patchBox({
      message: '',
      admissionPending: false,
      awaitingConfirmation: false,
    }),
  );
  await page.getByRole('button', { name: '选择头像', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('invalid'),
  });
  const avatarError = notices.filter({ hasText: '请选择 10 MB 以内' });
  await avatarError.waitFor();
  assert.ok(
    await avatarError.evaluate((element) =>
      Boolean(element.closest('dialog[open]')),
    ),
  );
  await avatarError.getByRole('button', { name: '关闭提示' }).click();
  await avatarError.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '关闭面板', exact: true }).click();
  checked(
    'Avatar file errors are visible and dismissible inside the native modal dialog.',
  );

  await page.evaluate(() =>
    window.patchBox({
      connected: false,
      message: '连接已断开，正在重新同步。',
    }),
  );
  await page
    .locator('.session-feedback')
    .filter({ hasText: '正在重新同步' })
    .waitFor();
  assert.equal(await notices.filter({ hasText: '连接已断开' }).count(), 0);
  await page.evaluate(() => window.patchBox({ connected: true, message: '' }));
  await page.locator('.session-feedback').waitFor({ state: 'detached' });
  checked(
    'Reconnecting remains a persistent status and does not leave a stale error popup after recovery.',
  );

  await page.evaluate(() =>
    window.patchBox({
      role: 'host',
      isHost: true,
      message: '',
      addresses: ['127.0.0.1'],
      adapters: [{ address: '127.0.0.1', name: '本机验证', kind: 'lan' }],
      address: '127.0.0.1',
      port: 38473,
      networkMessage: '',
      externalJoinUrl: null,
      setAddress() {},
      refreshNetwork() {},
      async saveExternalJoinUrl() {
        return true;
      },
    }),
  );
  await page.getByRole('button', { name: '连接帮助', exact: true }).click();
  await page
    .getByLabel('外部入口网址', { exact: true })
    .fill('https://example.com:12345');
  await page.getByRole('button', { name: '保存外部入口', exact: true }).click();
  const savedEntry = page
    .locator('.connection-help')
    .getByRole('status')
    .filter({ hasText: '二维码已更新。' });
  await savedEntry.waitFor();
  assert.equal(await notices.filter({ hasText: '二维码已更新。' }).count(), 0);
  assert.ok(
    await savedEntry.evaluate((element) =>
      Boolean(element.closest('dialog[open]')),
    ),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event('tablemax:join-open-error')),
  );
  await notices.filter({ hasText: '无法打开系统浏览器' }).waitFor();
  checked(
    'Connection-entry save success remains visible inline without a duplicate popup; native browser-open failure uses modal-safe notifications.',
  );

  for (const managerRole of ['host', 'admin']) {
    await page.evaluate((role) => {
      window.managerRole = role;
      window.render('names');
    }, managerRole);
    await page
      .getByRole('button', { name: '小明座位操作', exact: true })
      .click();
    await page.getByRole('button', { name: '修改名称', exact: true }).click();
    const input = page.getByRole('textbox', { name: '玩家名称', exact: true });
    assert.equal(await page.getByText(/最多8个中文字|混合计长/).count(), 0);
    await input.fill('abcdefghijklmnopq'); // Deliberate invalid-length input.
    assert.equal(await notices.count(), 0);
    await input.press('Enter');
    const error = notices.filter({ hasText: '最多8个中文字' });
    await error.waitFor();
    assert.ok(
      await error.evaluate((node) => Boolean(node.closest('dialog[open]'))),
    );
    assert.deepEqual(await page.evaluate(() => window.renameCommands), []);
    assert.equal(await input.inputValue(), 'abcdefghijklmnopq');
    await error.getByRole('button', { name: '关闭提示' }).click();
    await error.waitFor({ state: 'detached' });
    await input.fill(' 新名字 ');
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.renameCommands), [
      { type: 'set-seat-name', seatId: 'rename-player', name: '新名字' },
    ]);
    assert.equal(await page.locator('dialog[open]').count(), 0);
    checked(
      managerRole +
        ': submit-only rename popup is visible in modal, sends no invalid command, corrected name can be saved.',
    );
  }
  await page.evaluate(() => window.render('notices'));
  await page.waitForFunction(() => Boolean(window.center));
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [844, 390],
    [1280, 720],
    [3840, 2160],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      window.center.clear();
      for (let index = 1; index <= 4; index++)
        window.center.show('操作提示 ' + index, 'error');
    });
    await notices.first().waitFor();
    assert.equal(await notices.count(), 3);
    assert.equal(await notices.filter({ hasText: '操作提示 1' }).count(), 0);
    const geometry = await notices.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect(),
          close = element.querySelector('button').getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          font: parseFloat(
            getComputedStyle(element.querySelector('p')).fontSize,
          ),
          closeWidth: close.width,
          closeHeight: close.height,
        };
      }),
    );
    for (const value of geometry) {
      assert.ok(
        value.left >= 0 && value.right <= width && value.bottom <= height,
      );
      assert.ok(
        value.font >= 18 &&
          value.closeWidth >= 43.9 &&
          value.closeHeight >= 43.9,
        `${width}px notification geometry: ${JSON.stringify(value)}`,
      );
    }
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('.tablemax-notice')).opacity ===
        '1',
    );
    await captureBrowserScreenshot(page, {
      path: joinPath('limit-' + width + '.png'),
    });
  }
  checked(
    'Three-item cap and minimum 18px text / 44px close targets at phone, landscape, desktop and 4K sizes.',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.mouse.move(1, 1);
  await page.evaluate(() => {
    window.center.clear();
    window.center.show('自动虚化淡出', 'info', 1200);
  });
  await notices.first().waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('.tablemax-notice')?.dataset.leaving === 'true',
  );
  await notices.waitFor({ state: 'detached' });
  checked(
    'Notification enters its blur/fade state and removes itself automatically.',
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.center.show('减少动态提示', 'info', 1200));
  await notices.first().waitFor();
  assert.equal(
    await notices
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
    'none',
  );
  await notices.waitFor({ state: 'detached' });
  checked(
    'Reduced-motion preference disables blur and movement, while automatic removal still works.',
  );

  await page.click('#open-dialog');
  await page.evaluate(() => window.center.show('面板中的提示', 'success'));
  await notices.first().waitFor();
  await notices.getByRole('button', { name: '关闭提示' }).focus();
  assert.ok(
    await notices.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  );
  await captureBrowserScreenshot(page, {
    path: joinPath('dialog-notification.png'),
  });
  await notices.getByRole('button', { name: '关闭提示' }).click();
  await notices.waitFor({ state: 'detached' });
  await page.click('#dialog-action');
  await page.getByRole('button', { name: '关闭面板', exact: true }).click();
  await page.evaluate(() => window.center.show('背景操作仍可使用'));
  await notices.first().waitFor();
  await page.click('#background');
  checked(
    'Modal notifications receive keyboard focus; both modal and background actions remain usable.',
  );
  await page.evaluate(() => window.center.clear());
  await page.click('#open-dialog');
  await page.evaluate(() =>
    window.center.show('关闭面板后继续计时', 'info', 1200),
  );
  await notices.first().waitFor();
  await notices.getByRole('button', { name: '关闭提示' }).focus();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.mouse.move(1, 1);
  await notices.waitFor({ state: 'detached' });
  checked(
    'Closing a dialog with a focused notification releases its timer hold.',
  );
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log(
    `PASS: ${report.checks.length} box notification checks; ${output}`,
  );
} catch (error) {
  report.status = 'failed';
  report.failure = error.stack;
  throw error;
} finally {
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  await browser.close();
  await server.close();
}

function joinPath(name) {
  return join(output, name);
}
