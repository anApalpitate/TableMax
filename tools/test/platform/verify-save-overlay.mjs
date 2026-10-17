import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
assertWorkspaceRoot();
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../support/screenshots.mjs';

const evidence = process.argv
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice(11);
assert.match(evidence ?? '', /^[a-z0-9-]{1,65}$/);
const selected = process.argv
  .find((arg) => arg.startsWith('--only='))
  ?.slice(7)
  .split(',');
const selectedWidth = Number(
  process.argv.find((arg) => arg.startsWith('--width='))?.slice(8) ?? 0,
);
const feedbackOnly = process.argv.includes('--feedback-only');
const output = resolve('artifacts/maintenance', evidence);
await mkdir(output);
const work = await mkdtemp(resolve('tmp/save-overlay-'));
const source = await readFile(new URL(import.meta.url));
await writeFile(join(output, 'verifier-source.mjs'), source, { flag: 'wx' });
await writeFile(
  join(work, 'index.html'),
  '<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
const path = (file) => JSON.stringify(resolve(file));
await writeFile(
  join(work, 'entry.tsx'),
  `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {PlatformGame} from ${path('apps/web/src/session/gameHostAdapter.tsx')};
import {BoxScreen} from ${path('apps/web/src/screens/BoxScreen.tsx')};
import {rulesByVariant as pokemonRules} from ${path('games/pokemon-encounters/rules/index.ts')};
import {client as pokemon} from ${path('games/pokemon-encounters/web/index.tsx')};
import {client as expansion} from ${path('games/pokemon-encounters/expansion/web/index.tsx')};
${['manila', 'modern-art', 'power-grid', 'rummikub', 'uno', 'avalon'].map((id, i) => `import {rules as rules${i}} from ${path(`games/${id}/rules/index.ts`)};\nimport {client as client${i}} from ${path(`games/${id}/web/index.tsx`)};`).join('\n')}
import ${path('apps/web/src/styles.css')};
import ${path('apps/web/src/screens/box-screen.css')};
import ${path('apps/web/src/scrollbars.css')};
const catalog={pokemon:{rules:pokemonRules.original,client:pokemon},expansion:{rules:pokemonRules.expansion,client:expansion},${['manila', 'modern-art', 'power-grid', 'rummikub', 'uno', 'avalon'].map((id, i) => `${JSON.stringify(id)}:{rules:rules${i},client:client${i}}`).join(',')}};
const noop=()=>{};
const root=createRoot(document.getElementById('root'));
window.commands=[];
window.renderSaveCase=(options={})=>{
 const {id='manila',role='player',feedback='none',locked=false,noFinance=false,longName=false,withClock=false}=options;
 const item=catalog[id==='box'?'manila':id],rules=item.rules;
 const ids=Array.from({length:rules.manifest.players.min},(_,i)=>String.fromCharCode(65+i));
 let seed=71217;
 const context={seats:ids,random:{next:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}}};
 const state=rules.initialize(context),decisions=rules.decisions(state);
 const actor=decisions[0]?.seatId??ids[0];
 const seats=ids.map((id,i)=>({id,name:['阿蓝','小林','港口伙伴','长昵称测试商人','小船长'][i]??('朋友'+i),avatarId:'avatar-'+(i+1),controller:'human',ready:true,online:true,botDifficulty:null}));
 if(longName)seats.find(s=>s.id===actor).name='长昵称测试商人甲乙';
 const message={none:'',saved:'已保存',progress:'正在提交…',error:'保存失败，请重试。',connection:'连接中断，正在重连。',retry:'等待服务器确认。'}[feedback];
 const view={instanceId:'overlay-'+id,branch:0,revision:1,status:id==='box'?'lobby':'playing',paused:false,playMode:'play',gameView:rules.project(state,role==='player'?{role:'player',seatId:actor}:{role:'public'}),decisionId:decisions[0]?.id??null,countdownSeconds:30,decisionClock:null,actions:role==='player'?rules.legalActions(state,actor).filter(a=>!noFinance||!['mortgage','repay'].includes(a.type)):[],lifecycleActions:[],seats,history:[],joinOpen:true,ownerSeatId:actor,game:{...rules.manifest,releaseRef:'fixture',minPlayers:rules.manifest.players.min,maxPlayers:rules.manifest.players.max}};
 if(withClock)view.decisionClock={id:'e6ed6d54-cf77-4fa3-95ea-bf2d105c0728',remainingMs:18000,serverTime:Date.now(),running:false};
 view.game.min=rules.manifest.players.min;view.game.max=rules.manifest.players.max;
 view.catalog=[];view.capabilities={manage:role==='host',control:role==='host',manageSeats:role==='host'};view.self={role,seatId:role==='player'?actor:null};view.restored=false;view.selectionToken=null;
 if(id==='box')view.gameView=null;
 const session={role,view,self:role==='player'?seats.find(s=>s.id===actor):undefined,isHost:role==='host',canControl:role==='host',canManageSeats:role==='host',connected:feedback!=='connection',locked:locked||feedback==='retry',busy:locked,message,messageKind:feedback==='retry'?'progress':feedback,admissionPending:false,awaitingConfirmation:feedback==='retry',feedback:null,errorId:feedback==='error'?'fixture-error':'',motion:[],credential:'fixture',name:'阿蓝',setName:noop,command:c=>window.commands.push(c),join:noop,retry:()=>window.commands.push({type:'retry'}),retryAdmission:noop,setPlayerCredential:noop,publicUrl:'http://127.0.0.1',localUrl:'http://127.0.0.1',admissionAvatarId:null};
 flushSync(()=>root.render(id==='box'?<BoxScreen key={id+'-'+role} session={session}/>:<PlatformGame key={id+'-'+role} session={session} client={item.client}/>));
 window.fixtureSession=session;
 return {actor,minimum:view.actions.find(a=>a.type==='bid')?.amount,maximum:view.actions.filter(a=>a.type==='bid').at(-1)?.amount};
};
window.renderSaveCase();
`,
);
const report = {
  result: 'running',
  scope:
    'Actual source components, real authorized initial rule projections and platform feedback adapter. Browser viewport/DPR emulation only; no transport, installed-runtime, physical-device, native-DPI or system acceptance proof.',
  verifierSha256: createHash('sha256').update(source).digest('hex'),
  output,
  work,
  layouts: [],
  auction: [],
  feedback: [],
  screenshots: [],
  failures: [],
  errors: [],
};
let browser, server;
const check = async (name, fn) => {
  if (report.failures.length >= 10) throw new Error('Failure budget exhausted');
  try {
    await fn();
  } catch (error) {
    report.failures.push({ name, error: error.stack });
  }
};
try {
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
  server = await serveFixture(join(work, 'bundle'));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  const viewports = [
    [320, 568, 1],
    [390, 844, 1],
    [430, 932, 1],
    [844, 390, 1],
    [1280, 720, 1],
    [1920, 1080, 1],
    [3840, 2160, 1],
    [1536, 864, 1.25],
    [1280, 720, 1.5],
  ];
  const available = [
    'box',
    'manila',
    'modern-art',
    'pokemon',
    'expansion',
    'uno',
    'rummikub',
    'avalon',
    'power-grid',
  ];
  assert(!selected || selected.every((id) => available.includes(id)));
  const ids = selected ?? available;
  report.selected = { ids, width: selectedWidth || 'all', feedbackOnly };
  for (const [width, height, dpr] of viewports) {
    if (
      (selectedWidth && width !== selectedWidth) ||
      (feedbackOnly && width !== 390)
    )
      continue;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => report.errors.push(e.message));
    await page.route('**/api/game-packages/releases/fixture/details', (route) =>
      route.fulfill({
        json: {
          schemaVersion: 1,
          id: 'manila',
          name: '马尼拉',
          description: '港湾商人',
          guidance: false,
        },
      }),
    );
    await page.goto(server.url);
    await page.waitForFunction(
      () => typeof window.renderSaveCase === 'function',
    );
    const settle = () =>
      page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
    const measure = () =>
      page.evaluate(() => {
        const root = document.querySelector('#root main'),
          header = root?.querySelector('header');
        if (!root || !header) throw new Error('Missing actual game header');
        const rect = (n) => {
          const r = n.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        const visible = (n) =>
          n.checkVisibility() &&
          n.getBoundingClientRect().width > 0 &&
          n.getBoundingClientRect().height > 0;
        const overlay = [
          ...root.querySelectorAll('.session-save-overlay,.box-save-status'),
        ].find((n) => visible(n) && n.textContent.trim());
        const shown = overlay && visible(overlay) && overlay.textContent.trim();
        const overlaps = (a, b) =>
          a.x < b.x + b.width - 0.5 &&
          b.x < a.x + a.width - 0.5 &&
          a.y < b.y + b.height - 0.5 &&
          b.y < a.y + a.height - 0.5;
        const blockers = [
          ...header.querySelectorAll(
            'button,a,input,select,h1,strong,.ma-round,.connection',
          ),
          ...root.querySelectorAll(
            '.mn-status button,.mn-status img,.mn-status .mn-phase-name,.mn-status .mn-actor-name,.mn-status .mn-turn-hint,.mn-status .mn-auction-standing',
          ),
        ].filter(
          (n) => visible(n) && !n.contains(overlay) && !overlay?.contains(n),
        );
        return {
          root: rect(root),
          header: rect(header),
          flow: [...root.children]
            .filter(
              (n) =>
                !n.classList.contains('session-feedback') &&
                visible(n) &&
                !['absolute', 'fixed'].includes(getComputedStyle(n).position),
            )
            .map((n) => ({ tag: n.tagName, class: n.className, ...rect(n) })),
          scrollHeight: document.scrollingElement.scrollHeight,
          scrollY,
          scrollX,
          overlay: shown
            ? {
                text: overlay.textContent,
                rect: rect(overlay),
                position: getComputedStyle(overlay).position,
                font: parseFloat(getComputedStyle(overlay).fontSize),
                pointerEvents: getComputedStyle(overlay).pointerEvents,
                collisions: blockers
                  .filter((n) => overlaps(rect(overlay), rect(n)))
                  .map((n) => ({
                    text: n.textContent,
                    label: n.getAttribute('aria-label'),
                    ...rect(n),
                  })),
              }
            : null,
        };
      });
    for (const id of feedbackOnly ? [] : ids)
      for (const role of ['player', 'host', 'public']) {
        if (role !== 'player' && width < 1280) continue;
        await check(`${id}-${role}-${width}-${dpr}`, async () => {
          await page.evaluate((o) => window.renderSaveCase(o), {
            id,
            role,
            feedback: 'none',
          });
          await settle();
          await page.evaluate(() =>
            Promise.all(
              [...document.images].map((i) => i.decode().catch(() => {})),
            ),
          );
          await page.evaluate(() =>
            scrollTo(
              0,
              Math.min(
                100,
                document.scrollingElement.scrollHeight - innerHeight,
              ),
            ),
          );
          const before = await measure();
          await page.evaluate((o) => window.renderSaveCase(o), {
            id,
            role,
            feedback: 'saved',
          });
          await settle();
          const after = await measure();
          report.layouts.push({ id, role, width, height, dpr, before, after });
          for (const key of [
            'root',
            'header',
            'flow',
            'scrollHeight',
            'scrollY',
            'scrollX',
          ])
            assert.deepEqual(
              after[key],
              before[key],
              `${id} saved changes ${key}`,
            );
          if (['box', 'manila', 'modern-art', 'pokemon'].includes(id)) {
            assert(after.overlay, `${id} saved marker missing`);
            assert.equal(after.overlay.position, 'absolute');
            assert.equal(after.overlay.pointerEvents, 'none');
            assert(after.overlay.font >= 16);
            assert.deepEqual(
              after.overlay.collisions,
              [],
              `${id} saved marker overlaps header content`,
            );
            assert(
              after.overlay.rect.x >= 0 &&
                after.overlay.rect.x + after.overlay.rect.width <= width + 0.5,
              'Saved marker outside viewport',
            );
          } else
            assert.equal(
              after.overlay,
              null,
              'Do not add a duplicate saved marker',
            );
          if (
            (role === 'player' &&
              [320, 390, 844].includes(width) &&
              dpr === 1) ||
            (role === 'host' && width === 1920 && dpr === 1)
          ) {
            await page.evaluate(() => scrollTo(0, 0));
            const file = join(output, `${id}-${role}-${width}.png`);
            await captureBrowserScreenshot(page, { path: file });
            report.screenshots.push(file);
          }
        });
      }
    if (dpr === 1 && !feedbackOnly && ids.includes('manila'))
      await check(`auction-${width}`, async () => {
        const range = await page.evaluate(() =>
          window.renderSaveCase({
            id: 'manila',
            role: 'player',
            feedback: 'saved',
          }),
        );
        await settle();
        await page.evaluate(() => scrollTo(0, 0));
        const geometry = await page.evaluate(() => {
          const controls = document.querySelector('.mn-controls');
          const targets = [
            ...controls.querySelectorAll(
              '.mn-auction-actions > button,.mn-auction-actions > details > summary',
            ),
          ];
          const rect = (n) => {
            const r = n.getBoundingClientRect();
            return {
              top: r.top,
              bottom: r.bottom,
              height: r.height,
              width: r.width,
              left: r.left,
              right: r.right,
            };
          };
          const rows = (n) => {
            const r = document.createRange();
            r.selectNodeContents(n);
            return [
              ...new Set(
                [...r.getClientRects()]
                  .filter((x) => x.width > 0.5 && x.height > 0.5)
                  .map((x) => Math.round(x.top)),
              ),
            ];
          };
          return {
            buttons: targets.map((n) => ({
              text: n.textContent.trim(),
              ...rect(n),
              font: parseFloat(getComputedStyle(n).fontSize),
              rows: rows(n.querySelector(':scope > span') ?? n),
              textRect: (() => {
                const r = document.createRange();
                r.selectNodeContents(n.querySelector(':scope > span') ?? n);
                const b = r.getBoundingClientRect();
                return { left: b.left, right: b.right };
              })(),
            })),
            heading: rect(controls.querySelector('h2')),
            range: rect(controls.querySelector('.mn-bid-range')),
            input: rect(controls.querySelector('input')),
          };
        });
        report.auction.push({ width, height, geometry });
        assert.deepEqual(
          geometry.buttons.map((b) => b.text),
          ['出价', '退出竞拍', '股份操作'],
        );
        assert(
          Math.max(...geometry.buttons.map((b) => b.top)) -
            Math.min(...geometry.buttons.map((b) => b.top)) <
            0.5,
        );
        assert(
          geometry.buttons.every(
            (b) =>
              b.height === 48 &&
              b.width >= 44 &&
              b.font >= 18 &&
              b.rows.length <= 1,
          ),
        );
        assert(
          geometry.buttons.every(
            (b) => b.textRect.left >= b.left && b.textRect.right <= b.right,
          ),
          'Action text must stay inside its button',
        );
        assert(
          Math.abs(
            geometry.heading.top +
              geometry.heading.height / 2 -
              geometry.range.top -
              geometry.range.height / 2,
          ) < 1,
        );
        assert(
          geometry.heading.bottom <= geometry.input.top &&
            geometry.input.bottom <= geometry.buttons[0].top,
        );
        const input = page.locator('#mn-bid-amount'),
          bid = page.locator('[data-manila-action="bid"]');
        await input.fill(String(range.minimum - 1));
        assert(await bid.isDisabled());
        await input.fill(String(range.maximum + 1));
        assert(await bid.isDisabled());
        await input.fill('');
        assert(await bid.isDisabled());
        await input.fill(String(range.minimum));
        await page.evaluate(() => (window.commands = []));
        await bid.click();
        assert.equal(
          (await page.evaluate(() => window.commands.at(-1))).action.amount,
          range.minimum,
        );
        await input.fill(String(range.maximum));
        await bid.click();
        assert.equal(
          (await page.evaluate(() => window.commands.at(-1))).action.amount,
          range.maximum,
        );
        await page.locator('[data-manila-action="pass"]').click();
        assert.equal(
          (await page.evaluate(() => window.commands.at(-1))).action.type,
          'pass',
        );
        const shares = page.locator('.mn-auction-actions > details > summary');
        await shares.click();
        assert(
          (await page
            .locator('.mn-auction-actions > details')
            .getAttribute('open')) !== null,
        );
        await page.keyboard.press('Escape');
        assert.equal(
          await page
            .locator('.mn-auction-actions > details')
            .getAttribute('open'),
          null,
        );
        assert(await shares.evaluate((n) => n === document.activeElement));
        await page.evaluate(() =>
          window.renderSaveCase({ id: 'manila', role: 'player', locked: true }),
        );
        await settle();
        assert(await bid.isDisabled());
        assert(await input.isDisabled());
        await page.evaluate(() =>
          window.renderSaveCase({
            id: 'manila',
            role: 'player',
            noFinance: true,
          }),
        );
        await settle();
        assert.equal(await shares.count(), 0);
        assert.equal(
          await page.locator('.mn-auction-actions > button').count(),
          2,
        );
      });
    if (width === 320 && ids.includes('manila'))
      await check('manila-long-name-and-clock', async () => {
        await page.evaluate(() =>
          window.renderSaveCase({
            id: 'manila',
            role: 'player',
            feedback: 'saved',
            longName: true,
            withClock: true,
          }),
        );
        await settle();
        const actual = await measure();
        assert(actual.overlay);
        assert.deepEqual(actual.overlay.collisions, []);
        await page.evaluate(() => scrollTo(0, 0));
        const file = join(output, 'manila-player-320-long-name-clock.png');
        await captureBrowserScreenshot(page, { path: file });
        report.screenshots.push(file);
        report.feedback.push({
          id: 'manila',
          feedback: 'long-name-and-clock',
          result: 'passed',
        });
      });
    if (width === 390 && dpr === 1)
      for (const id of ['manila', 'modern-art', 'pokemon', 'box'].filter((id) =>
        ids.includes(id),
      ))
        await check(`modal-${id}`, async () => {
          await page.evaluate((o) => window.renderSaveCase(o), {
            id,
            role: 'player',
            feedback: 'saved',
          });
          await settle();
          await page.evaluate(() => scrollTo(0, 0));
          const before = await page.evaluate(() =>
            JSON.stringify(window.fixtureSession.view.gameView),
          );
          const entry = page.getByRole('button', {
            name: id === 'box' ? '视频设置' : '菜单',
            exact: true,
          });
          await entry.click();
          assert.equal(await page.locator('dialog:modal').count(), 1);
          const marker = page
            .locator('.session-save-overlay,.box-save-status')
            .filter({ hasText: '已保存' })
            .first();
          const covered = await marker.evaluate((n) => {
            const r = n.getBoundingClientRect();
            const dialog = document.querySelector('dialog:modal');
            const top = document.elementFromPoint(
              r.x + r.width / 2,
              r.y + r.height / 2,
            );
            return top === dialog || dialog.contains(top);
          });
          assert(covered, 'Native modal must cover the saved layer');
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('dialog:modal').count(), 0);
          assert(await entry.evaluate((n) => n === document.activeElement));
          assert.equal(
            await page.evaluate(() =>
              JSON.stringify(window.fixtureSession.view.gameView),
            ),
            before,
          );
          report.feedback.push({
            id,
            feedback: 'modal-layer-focus-and-state',
            result: 'passed',
          });
        });
    if (width === 390 && dpr === 1)
      for (const id of ['manila', 'modern-art', 'pokemon', 'box'].filter((id) =>
        ids.includes(id),
      ))
        for (const feedback of ['progress', 'error', 'connection', 'retry'])
          await check(`feedback-${id}-${feedback}`, async () => {
            await page.evaluate((o) => window.renderSaveCase(o), {
              id,
              role: 'player',
              feedback,
            });
            await settle();
            assert.equal(
              await page
                .locator('.session-save-overlay')
                .filter({ hasText: '已保存' })
                .count(),
              0,
            );
            if (feedback === 'retry') {
              const retry = page.getByRole('button', {
                name: '重试确认',
                exact: true,
              });
              assert(await retry.isVisible());
              await retry.click();
            }
            if (feedback === 'error')
              assert(
                await page
                  .getByText('保存失败，请重试。', { exact: true })
                  .first()
                  .isVisible(),
              );
            if (feedback === 'connection')
              assert(
                await page
                  .getByText('连接中断，正在重连。', { exact: true })
                  .first()
                  .isVisible(),
              );
            report.feedback.push({ id, feedback, result: 'passed' });
          });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failures, []);
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      layouts: report.layouts.length,
      auction: report.auction.length,
      feedback: report.feedback.length,
      failures: report.failures.map((f) => ({
        name: f.name,
        error: f.error.split('\n').slice(0, 2).join(' '),
      })),
      errors: report.errors,
      output,
    }),
  );
}
