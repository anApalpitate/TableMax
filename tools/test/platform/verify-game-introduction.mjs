import { captureBrowserScreenshot } from '../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { leanCatalogPlugin } from '../../build/lean-catalog.mjs';
import { projectGameDetails } from '../../../packages/game-sdk/src/metadata.mjs';
import { launchTestBrowser } from '../support/browser-test.mjs';
import { serveFixture } from '../support/fixture-server.mjs';
import { verificationOutput } from '../support/verification-output.mjs';

const evidence =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  'layout';
const resourceOnly = process.argv.includes('--resource-only');
const sourcePreview = process.argv.includes('--source-preview');
assert.match(evidence, /^[a-z0-9-]{1,40}$/);
const output = verificationOutput('game-introduction', evidence);
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/gameplay-introduction-'));
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
const games=[{id:'power-grid',name:'电力公司',min:2,max:6},{id:'modern-art',name:'现代艺术',min:3,max:5},{id:'pokemon-encounters',name:'宝可梦奇遇：皮卡丘和朋友们',min:2,max:6},{id:'pokemon-encounters',variantId:'expansion',name:'宝可梦奇遇：九宫格扩展版',min:2,max:6},{id:'uno',name:'UNO',min:2,max:6},{id:'rummikub',name:'拉密',min:2,max:4},{id:'avalon',name:'阿瓦隆',min:5,max:10},{id:'manila',name:'马尼拉',min:3,max:5}];
const seat={id:'S1',name:'介绍查看者',controller:'human',ready:true,online:true,avatarId:'avatar-1',botDifficulty:null};
window.renderBox=(index,role,releaseRef)=>{
 const game={...games[index],...(releaseRef?{releaseRef}:{})};window.boxData={revision:12,branch:0,status:'lobby',game,catalog:games,seats:[seat],ownerSeatId:null,joinOpen:true,gameView:null,history:[],lifecycleActions:[],playMode:'play',decisionClock:null,capabilities:{manage:false}};
 const session={role,view:window.boxData,self:role==='player'?seat:null,isHost:role==='host',canControl:false,canManageSeats:false,locked:false,busy:false,connected:true,credential:'fixture',name:'玩家',message:'',errorId:'',admissionPending:false,awaitingConfirmation:false,command:c=>window.commands.push(c),retry(){},setName(){},join(){}};
 flushSync(()=>root.render(<BoxScreen key={index+'-'+role+'-'+(releaseRef??'source')} session={session}/>));
}; window.renderBox(0,'host');
`,
);
await build({
  configFile: false,
  root: work,
  plugins: [leanCatalogPlugin(), react()],
  ...(sourcePreview
    ? {
        define: {
          'import.meta.env.PROD': 'false',
          'import.meta.env.DEV': 'true',
        },
      }
    : {}),
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
const detailsRequests = [];
const illustrationRequests = [];
const screenshots = [];
const resourceChecks = [];
const frozenRequests = [];
let notFoundResource;
let passed = false;
try {
  const page = await browser.newPage();
  const capture = async (path) => {
    const image = await captureBrowserScreenshot(page, { path });
    screenshots.push({
      file: relative(resolve('.'), path).replaceAll('\\', '/'),
      relativePath: relative(output, path).replaceAll('\\', '/'),
      sha256: createHash('sha256').update(image).digest('hex'),
      bytes: image.length,
    });
  };
  await page.route('**/games/*/web/details.json', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/')[2];
    detailsRequests.push(id);
    const module = JSON.parse(
      await readFile(resolve('games', id, 'game-module.json'), 'utf8'),
    );
    await route.fulfill({ json: projectGameDetails(module) });
  });
  await page.route('**/games/*/resources/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const match =
      /^\/games\/([a-z][a-z0-9-]*)\/resources\/\1\/((?:[a-z0-9-]+\/)*introduction-[a-z0-9-]+\.svg)$/.exec(
        pathname,
      );
    assert(
      match,
      'Only local per-game introduction SVG resources are requested',
    );
    illustrationRequests.push(pathname);
    await route.fulfill({
      body: await readFile(resolve('assets/games', match[1], match[2])),
      contentType: 'image/svg+xml',
    });
  });
  await page.route('**/api/game-packages/releases/*/details', async (route) => {
    const module = JSON.parse(
      await readFile('games/power-grid/game-module.json', 'utf8'),
    );
    await route.fulfill({ json: projectGameDetails(module) });
  });
  await page.route('**/game-packages/*/resources/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const match =
      /^\/game-packages\/([a-f0-9]{64})\/resources\/(power-grid)\/(introduction-[a-z0-9-]+\.svg)$/.exec(
        pathname,
      );
    assert(
      match,
      'Frozen introduction requests remain bound to their release and game',
    );
    frozenRequests.push({
      path: pathname,
      status: pathname === notFoundResource ? 404 : 200,
    });
    await route.fulfill(
      pathname === notFoundResource
        ? { status: 404, body: 'Not found' }
        : {
            body: await readFile(resolve('assets/games', match[2], match[3])),
            contentType: 'image/svg+xml',
          },
    );
  });
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
  for (const role of resourceOnly ? [] : ['host', 'public', 'player']) {
    for (const index of [0, 1, 2, 3, 4, 5, 6, 7]) {
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
        await dialog.locator('.game-overview__goal').waitFor();
        await page.waitForFunction(() =>
          [...document.querySelectorAll('.game-overview img')].every(
            (image) => image.complete && image.naturalWidth > 0,
          ),
        );
        assert.equal(
          await dialog.locator('img.game-overview__illustration').count(),
          [1, 2].includes(index) ? 0 : 3,
          'New diagrams must decode; retained illustrations remain original SVG components',
        );
        assert.equal(
          (await dialog.locator('.game-overview').innerText()).includes('·'),
          false,
          'Introduction copy uses grouping instead of middle-dot chains',
        );
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
        if (role === 'host' && [320, 390, 1280].includes(width)) {
          const screenshot = join(output, `intro-${index}-host-${width}.png`);
          await capture(screenshot);
        }
        if (role === 'player' && width === 390) {
          const screenshot = join(output, `intro-${index}-player-${width}.png`);
          await capture(screenshot);
        }
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
          const content = element.querySelector('.box-overlay-panel__content');
          content.scrollTop = content.scrollHeight;
        });
        if (role === 'host' && width === 320) {
          const screenshot = join(
            output,
            `intro-${index}-host-${width}-bottom.png`,
          );
          await capture(screenshot);
        }
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
  if (!resourceOnly)
    assert.deepEqual([...new Set(detailsRequests)].sort(), [
      'avalon',
      'manila',
      'modern-art',
      'pokemon-encounters',
      'power-grid',
      'rummikub',
      'uno',
    ]);
  await page.setViewportSize({ width: 390, height: 844 });
  const openResourceCase = async (releaseRef) => {
    await page.evaluate(
      (releaseRef) => window.renderBox(0, 'host', releaseRef),
      releaseRef,
    );
    await page.getByRole('button', { name: '游戏介绍', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '游戏介绍', exact: true });
    await dialog.locator('.game-overview__goal').waitFor();
    return dialog;
  };
  let dialog = await openResourceCase(undefined);
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('img.game-overview__illustration')]
        .length === 3 &&
      [...document.querySelectorAll('img.game-overview__illustration')].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
  );
  const localImages = await dialog
    .locator('img.game-overview__illustration')
    .evaluateAll((images) => images.map((image) => image.currentSrc));
  assert(
    localImages.every(
      (url) =>
        url.startsWith('data:image/svg+xml') ||
        new URL(url).origin === new URL(server.url).origin,
    ),
  );
  assert(localImages.every((url) => !url.includes('/game-packages/')));
  resourceChecks.push({
    case: sourcePreview
      ? 'development source preview'
      : 'current local source fixture',
    images: localImages.length,
    allLocal: true,
    frozenReleaseUsed: false,
  });
  const frozenRef = 'a'.repeat(64);
  dialog = await openResourceCase(frozenRef);
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('img.game-overview__illustration')]
        .length === 3 &&
      [...document.querySelectorAll('img.game-overview__illustration')].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
  );
  const frozenImages = await dialog
    .locator('img.game-overview__illustration')
    .evaluateAll((images) =>
      images.map((image) => new URL(image.currentSrc).pathname),
    );
  assert(
    frozenImages.every((path) =>
      path.startsWith(`/game-packages/${frozenRef}/resources/power-grid/`),
    ),
  );
  assert.equal(
    frozenRequests.filter(
      (request) => request.path.includes(frozenRef) && request.status === 200,
    ).length,
    3,
  );
  resourceChecks.push({
    case: 'valid 64-hex release',
    release: frozenRef,
    images: frozenImages,
    allReleaseBound: true,
  });
  const missingRef = 'b'.repeat(64);
  notFoundResource = `/game-packages/${missingRef}/resources/power-grid/introduction-2-v1.svg`;
  dialog = await openResourceCase(missingRef);
  await dialog.locator('svg.game-overview__illustration').waitFor();
  assert.equal(
    await dialog.locator('img.game-overview__illustration').count(),
    2,
  );
  assert.equal(
    await dialog.locator('svg.game-overview__illustration').count(),
    1,
  );
  assert(
    frozenRequests.some(
      (request) => request.path === notFoundResource && request.status === 404,
    ),
  );
  await capture(join(output, 'resource-404-fallback-390.png'));
  assert.deepEqual(await page.evaluate(() => window.commands), []);
  resourceChecks.push({
    case: 'actual HTTP 404 image response',
    path: notFoundResource,
    fallbackSvg: 1,
    remainingImages: 2,
    commandsSent: 0,
  });
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
        detailsRequests,
        illustrationRequests: [...new Set(illustrationRequests)],
        screenshots,
        resourceChecks,
        frozenRequests,
        sourcePreview,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  await server.close();
}
