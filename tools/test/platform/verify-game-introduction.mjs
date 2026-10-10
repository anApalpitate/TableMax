import { captureBrowserScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
import { verificationOutput } from '../support/verification-output.mjs';

const evidence =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  'layout';
assert.match(evidence, /^[a-z0-9-]{1,40}$/);
const output = verificationOutput('game-introduction', evidence);
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
const root=createRoot(document.getElementById('root'));window.commands=[];
const games=[{id:'power-grid',name:'电力公司',min:2,max:6},{id:'modern-art',name:'现代艺术',min:3,max:5},{id:'pokemon-encounters',name:'宝可梦奇遇：皮卡丘和朋友们',min:2,max:6},{id:'pokemon-encounters',variantId:'expansion',name:'宝可梦奇遇：九宫格扩展版',min:2,max:6}];
const seat={id:'S1',name:'介绍查看者',controller:'human',ready:true,online:true,avatarId:'avatar-1',botDifficulty:null};
window.renderBox=(index,role)=>{
 const game=games[index];window.boxData={revision:12,branch:0,status:'lobby',game,catalog:games,seats:[seat],ownerSeatId:null,joinOpen:true,gameView:null,history:[],lifecycleActions:[],playMode:'play',decisionClock:null,capabilities:{manage:false}};
 const session={role,view:window.boxData,self:role==='player'?seat:null,isHost:role==='host',canControl:false,canManageSeats:false,locked:false,busy:false,connected:true,credential:'fixture',name:'玩家',message:'',errorId:'',admissionPending:false,awaitingConfirmation:false,command:c=>window.commands.push(c),retry(){},setName(){},join(){}};
 flushSync(()=>root.render(<BoxScreen key={index+'-'+role} session={session}/>));
}; window.renderBox(0,'host');
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
const server = await serveFixture(join(work, 'bundle'));
const browser = await launchTestBrowser({ channel: 'msedge', headless: true });
const errors = [],
  layouts = [];
let passed = false;
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(server.url);
  // Shared runtime CSS can arrive after the independently bundled box CSS.
  // Exercise that real production cascade rather than the fixture import order.
  await page.addStyleTag({
    content: await readFile(
      'apps/web/src/components/overlay-panel.css',
      'utf8',
    ),
  });
  await page.waitForFunction(() => typeof window.renderBox === 'function');
  for (const role of ['host', 'public', 'player']) {
    for (const index of [0, 1, 2, 3]) {
      for (const [width, height] of [
        [320, 640],
        [360, 640],
        [390, 844],
        [600, 900],
        [620, 887],
        [934, 1331],
        [1280, 720],
        [1920, 1080],
        [3840, 2160],
      ]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(
          ({ index, role }) => window.renderBox(index, role),
          { index, role },
        );
        const entry = page.getByRole('button', {
          name: '游戏介绍',
          exact: true,
        });
        await entry.click();
        const dialog = page.getByRole('dialog', {
          name: '游戏介绍',
          exact: true,
        });
        const geometry = await dialog.evaluate((element) => {
          const intro = element.querySelector('.game-overview');
          const heading = intro.querySelector('.game-overview__heading');
          const lead = intro.querySelector('.game-overview__lead');
          const steps = intro.querySelector('.game-overview__steps');
          const goal = intro.querySelector('.game-overview__goal');
          const rect = (node) => {
            const r = node.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              bottom: r.bottom,
            };
          };
          return {
            display: getComputedStyle(intro).display,
            dialog: rect(element),
            heading: rect(heading),
            lead: rect(lead),
            steps: rect(steps),
            goal: rect(goal),
            cards: [...steps.children].map(rect),
            overflow: element.scrollWidth - element.clientWidth,
            bodyOverflow: document.documentElement.scrollWidth - innerWidth,
            fonts: [...intro.querySelectorAll('p,h3,h4')].map((node) =>
              parseFloat(getComputedStyle(node).fontSize),
            ),
          };
        });
        layouts.push({ role, index, width, height, ...geometry });
        if (
          role === 'host' &&
          index === 0 &&
          [360, 620, 934, 1280].includes(width)
        )
          await captureBrowserScreenshot(page, {
            path: join(output, `power-grid-${width}.png`),
          });
        assert.equal(
          geometry.display,
          'block',
          'Introduction sections must stack, regardless of stylesheet import order',
        );
        assert.ok(
          geometry.lead.y >= geometry.heading.bottom - 1,
          'Summary follows the heading',
        );
        assert.ok(
          geometry.steps.y >= geometry.lead.bottom - 1,
          'Steps follow the summary',
        );
        assert.ok(
          geometry.goal.y >= geometry.steps.bottom - 1,
          'Goal follows the steps',
        );
        assert.ok(
          geometry.overflow <= 1 && geometry.bodyOverflow <= 1,
          'No horizontal overflow',
        );
        assert.ok(
          geometry.cards.every((card) => card.width >= 150),
          'Step cards retain readable widths',
        );
        assert.ok(
          geometry.fonts.every((font) => font >= 16),
          'Information text remains at least 16 CSS px',
        );
        if (width === 1280)
          assert.ok(
            geometry.dialog.width >= 900,
            'Desktop uses the intended wide introduction panel',
          );
        await dialog.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        const close = dialog.getByRole('button', {
          name: '关闭面板',
          exact: true,
        });
        const button = await close.boundingBox();
        assert.ok(
          button.y >= 0 && button.y + button.height <= height,
          'Sticky close remains in the viewport after scrolling',
        );
        await close.click();
        await entry.focus();
        await entry.click();
        await page.keyboard.press('Escape');
        assert.equal(
          await entry.evaluate((element) => element === document.activeElement),
          true,
          'Escape restores focus',
        );
        assert.equal(await page.evaluate(() => window.boxData.revision), 12);
        assert.deepEqual(
          await page.evaluate(() => window.commands),
          [],
          'Reading the introduction sends no game commands',
        );
      }
    }
  }
  assert.deepEqual(errors, []);
  passed = true;
  console.info(
    'Game introduction: ' + layouts.length + ' layouts passed: ' + output,
  );
} finally {
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(
      {
        result: passed ? 'passed' : 'incomplete',
        scope:
          'Actual BoxScreen, GameIntroduction and OverlayPanel rendered in hidden muted Edge; simulated viewports, not physical-device or complete-game acceptance.',
        layouts,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  await server.close();
}
