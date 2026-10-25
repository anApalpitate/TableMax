import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join, relative, sep, basename } from 'node:path';
import { build as esbuild } from 'esbuild';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';

assertWorkspaceRoot();
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TABLEMAX_TEST_MAINTENANCE = '0';
const arg = (name) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const phase = arg('phase');
const smoke = process.argv.includes('--smoke');
const buildOnly = process.argv.includes('--build-only');
const fixedCanvas = process.argv.includes('--fixed-canvas');
const extra = process.argv.includes('--extra');
const extraChecks = [
  'minimum-phone-320-bid',
  'minimum-phone-320-offer',
  'width-and-height-boundary-drafts',
  'paused-and-controlled-disconnected',
];
const only = (arg('only') ?? (extra ? extraChecks.join(',') : ''))
  .split(',')
  .filter(Boolean);
assert.ok(
  !extra || phase === 'after',
  'Extra checks apply to the current after source',
);
assert.ok(
  ['before', 'after'].includes(phase),
  'Choose --phase=before or after',
);
assert.ok(
  !fixedCanvas || phase === 'after',
  'Fixed canvas uses current source',
);
const task = resolve(arg('task') ?? 'tmp/modern-art-player-layout-20261023-b1');
assert.ok(
  task.startsWith(resolve('tmp') + sep),
  'Task directory must remain inside workspace tmp',
);
const browserTemp = join(task, 'browser-temp');
await mkdir(browserTemp, { recursive: true });
process.env.TEMP = browserTemp;
process.env.TMP = browserTemp;
const { launchTestBrowser } = await import('../../support/browser-test.mjs');
const output = resolve(
  arg('output') ??
    `artifacts/maintenance/modern-art-player-layout-20261023-b1/${phase}`,
);
assert.ok(
  output.startsWith(resolve('artifacts') + sep),
  'Evidence output must remain inside artifacts',
);
const require = createRequire(import.meta.url);
const scenes = [
  'offer',
  'auction-open',
  'auction-once',
  'auction-sealed',
  'sealed-submitted',
  'auction-fixed',
  'auction-double',
  'result',
  'ended',
];
const knownChecks = new Set([
  ...extraChecks,
  ...[...scenes, 'collections', 'auction-pair'].flatMap((scene) =>
    ['portrait', 'wide'].map((layout) => `${scene}-${layout}`),
  ),
  ...['host', 'public'].flatMap((role) =>
    ['auction-open', 'auction-pair'].map((scene) => `${role}-${scene}`),
  ),
  'compact-landscape',
  'compact-landscape-rules-overlay',
  'contract-resize-draft-and-legacy',
  'focused-input-space-freeze-and-blur-recovery',
  'sealed-submitted-and-paired-auction-authority',
]);
assert.ok(
  only.every(
    (id) => knownChecks.has(id) && (!extraChecks.includes(id) || extra),
  ) && new Set(only).size === only.length,
  'Every --only entry must name a unique real check',
);
const report = {
  phase,
  smoke,
  buildOnly,
  fixedCanvas,
  extra,
  only,
  excluded: [],
  result: 'running',
  scope:
    'Actual production Modern Art components and PlayerFrame, five-player authoritative legal-rule projections; controlled local fixture transport and frozen clock. No temporary layout CSS, actual network session, physical device, Windows DPI, installer, or audio-listening proof.',
  task,
  output,
  failures: [],
  pending: [],
  screenshots: [],
  layouts: [],
  behaviors: [],
  pageErrors: [],
  externalRequests: [],
  inputs: {},
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const record = async (path) => ({
  path: relative(process.cwd(), path).split(sep).join('/'),
  sha256: hash(await readFile(path)),
});
const sourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? sourceFiles(path) : [path];
      }),
    )
  ).flat();
};
const checks = async (id, fn) => {
  if (only.length && !only.includes(id)) {
    report.excluded.push(id);
    return;
  }
  if (report.failures.length >= 10) {
    report.pending.push(id);
    return;
  }
  try {
    await fn();
    report.behaviors.push({ id, passed: true });
  } catch (e) {
    report.failures.push({ id, error: e.message });
  }
  await writeFile(
    join(output, 'report-running.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      id,
      failures: report.failures.length,
      errors: report.pageErrors.slice(-2),
    }),
  );
};
const sourceRoot = phase === 'before' ? join(task, 'baseline') : resolve('.');
await mkdir(output, { recursive: true });
await writeFile(
  join(output, 'verifier-source.mjs'),
  await readFile(new URL(import.meta.url)),
);
const work = join(task, `fixture-${basename(output)}`);
await mkdir(work, { recursive: true });
let browser, server, page;
try {
  const preparationSource = resolve(
    'tools/test/fixtures/prepare-modern-art-workspace.ts',
  );
  const preparationHash = hash(await readFile(preparationSource));
  const data = join(
    task,
    fixedCanvas
      ? `fixed-legal-fixtures-${preparationHash.slice(0, 12)}`
      : 'legal-fixtures',
  );
  let snapshots;
  try {
    snapshots = JSON.parse(
      await readFile(join(data, 'snapshots.json'), 'utf8'),
    );
  } catch {
    await esbuild({
      entryPoints: ['tools/test/fixtures/prepare-modern-art-workspace.ts'],
      outfile: join(task, 'prepare-layout.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      logLevel: 'silent',
    });
    ({ snapshots } = await require(
      join(task, 'prepare-layout.cjs'),
    ).prepareLayout(data, fixedCanvas));
  }
  if (!snapshots['sealed-submitted']) {
    await esbuild({
      entryPoints: ['tools/test/fixtures/prepare-modern-art-workspace.ts'],
      outfile: join(task, 'prepare-layout-augment.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      logLevel: 'silent',
    });
    snapshots = await require(
      join(task, 'prepare-layout-augment.cjs'),
    ).augmentSubmitted(data);
  }
  await writeFile(
    join(output, 'preparation-proof.json'),
    await readFile(join(data, 'preparation-proof.json')),
  );
  if (phase === 'before') {
    await mkdir(join(sourceRoot, 'assets/games'), { recursive: true });
    await cp(
      resolve('assets/games/modern-art'),
      join(sourceRoot, 'assets/games/modern-art'),
      { recursive: true },
    );
  }
  const game = join(sourceRoot, 'games/modern-art/web/index.tsx');
  const frame = join(sourceRoot, 'apps/web/src/components/PlayerFrame.tsx');
  const tracked = [
    game,
    frame,
    join(sourceRoot, 'games/modern-art/ui/style.css'),
    join(sourceRoot, 'games/modern-art/ui/public/index.tsx'),
    join(sourceRoot, 'games/modern-art/ui/player-wide.css'),
    join(sourceRoot, 'games/modern-art/ui/player/index.tsx'),
    join(sourceRoot, 'apps/web/src/components/player-frame.css'),
    join(sourceRoot, 'apps/web/src/components/player-frame.ts'),
    join(data, 'snapshots.json'),
  ];
  if (fixedCanvas) {
    tracked.push(
      ...(await sourceFiles(join(sourceRoot, 'games/modern-art/ui'))),
      ...(await sourceFiles(resolve('packages/web-host/src/layout'))),
      resolve('packages/web-host/src/index.tsx'),
      resolve('packages/web-host/src/types.ts'),
      preparationSource,
      resolve('tools/test/fixtures/prepare-modern-art-polish.ts'),
      join(data, 'preparation-proof.json'),
    );
    tracked.splice(0, tracked.length, ...new Set(tracked));
  }
  report.inputs.before = await Promise.all(tracked.map(record));
  if (phase === 'after') {
    const css = await readFile(
      join(sourceRoot, 'games/modern-art/ui/player-wide.css'),
      'utf8',
    );
    const declarations = [...css.matchAll(/padding:\s*([^;]+);/g)]
      .map((match) => match[1].replace(/\s+/g, ' ').trim())
      .filter((value) => value.includes('safe-area-inset-'));
    assert.deepEqual(
      declarations,
      fixedCanvas
        ? []
        : [10, 8, 12].map((base) =>
            ['top', 'right', 'bottom', 'left']
              .map((side) => `max(${base}px, env(safe-area-inset-${side}))`)
              .join(' '),
          ),
      fixedCanvas
        ? 'Public frame deducts safe area; game does not deduct it again'
        : 'All three contract padding overrides preserve four native safe-area insets',
    );
    report.safeAreaEvidence = {
      source: 'games/modern-art/ui/player-wide.css',
      declarations,
      computedScope: fixedCanvas
        ? 'Current FixedCanvasFrame owns four native env insets. Game padding is internal logical spacing. Physical nonzero safe areas remain separate.'
        : 'Normal headless browser native env values; expected base padding is checked in actual player captures and boundary samples. No temporary CSS override.',
      nonzeroPhysicalSafeAreaTested: false,
    };
  }
  const entry = `
import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';
import{HostedGame}from ${JSON.stringify(resolve('packages/web-host/src/index.tsx'))};
import{configureGameHost}from ${JSON.stringify(resolve('packages/web-host/src/platform.ts'))};
import{SessionFeedback}from ${JSON.stringify(resolve('apps/web/src/components/SessionFeedback.tsx'))};
import{avatarFor,avatarChoices}from ${JSON.stringify(resolve('apps/web/src/assets/avatars.ts'))};
import{client}from ${JSON.stringify(game)};
import{PlayerFrame}from ${JSON.stringify(frame)};
import ${JSON.stringify(resolve('apps/web/src/styles.css'))};
import ${JSON.stringify(resolve('apps/web/src/scrollbars.css'))};
const snapshots=${JSON.stringify(snapshots)};
configureGameHost({ScreenLink:p=><a {...p}/>,FullscreenControl:()=>null,DisplaySettings:()=>null,useAudioOutput:()=>false,claimAudioEvent:()=>true,avatarFor,avatarChoices});
const root=createRoot(document.getElementById('root'));let sequence=0,currentKey='initial';
window.__commands=[];window.__documentId=crypto.randomUUID();
window.renderModernArt=({scene='auction-open',role='player',preserve=false,view:providedView,suppliedView,connected=true,savedMessage='',locked=false,awaitingConfirmation=false,admissionPending=false}={})=>{
 const view=structuredClone(suppliedView??providedView??snapshots[scene][role]);
 if(view.decisionClock)view.decisionClock={...view.decisionClock,running:false,serverTime:Date.now()};
 const self=role==='player'?view.seats.find(s=>s.id===view.self?.seatId):undefined;
 const session={role,view,self,connected,locked:locked||!connected||awaitingConfirmation||admissionPending,canControl:role==='host'||Boolean(view.self?.capabilities?.control),message:savedMessage,messageKind:savedMessage?'saved':'none',admissionPending,awaitingConfirmation,feedback:null,errorId:'',motion:[],command:c=>window.__commands.push(c)};
 window.__currentView=view;
 window.__fixture={scene,role,revision:view.revision,decisionId:view.decisionId,actions:view.actions,paused:view.paused,connected,publicHasSelf:role!=='player'&&Boolean(view.gameView?.self),auction:view.gameView?.auction?{kind:view.gameView.auction.kind,currentBid:view.gameView.auction.currentBid,highBidder:view.gameView.auction.highBidder,actingSeats:view.gameView.auction.actingSeats}:null};
 if(!preserve)currentKey=String(++sequence);
 flushSync(()=>root.render(<HostedGame key={currentKey} session={session} client={client} presentation={{management:()=>null,feedback:p=><SessionFeedback session={session}{...p}/>,playMode:()=>null,countdown:()=>null}}/>));
 return window.__fixture;
};
const params=new URLSearchParams(location.search),role=params.get('role')??'player',scene=params.get('scene')??'auction-open';
if(!${JSON.stringify(fixedCanvas)}&&role==='player'&&self===top){const url=new URL('/player/game',location.origin);url.searchParams.set('role','player');url.searchParams.set('scene',scene);flushSync(()=>root.render(<PlayerFrame initialUrl={url.href}/>));}
else window.renderModernArt({scene,role});
`;
  await writeFile(join(work, 'entry.tsx'), entry);
  await writeFile(
    join(work, 'index.html'),
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
  );
  await build({
    configFile: false,
    root: work,
    plugins: [react()],
    resolve: {
      alias: {
        react: resolve('apps/web/node_modules/react'),
        'react-dom': resolve('apps/web/node_modules/react-dom'),
        '@tablemax/web-host/platform': resolve(
          'packages/web-host/src/platform.ts',
        ),
        '@tablemax/web-host': resolve('packages/web-host/src/index.tsx'),
      },
    },
    build: {
      outDir: join(work, 'bundle'),
      emptyOutDir: false,
      target: ['chrome110', 'safari16'],
    },
    logLevel: 'error',
  });
  await mkdir(join(work, 'bundle/player'), { recursive: true });
  await cp(join(work, 'bundle/index.html'), join(work, 'bundle/player/game'));
  if (buildOnly) {
    report.result = 'built';
    report.inputs.after = await Promise.all(tracked.map(record));
    assert.deepEqual(
      report.inputs.after,
      report.inputs.before,
      'Stable source build',
    );
    await writeFile(
      join(output, 'report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(
      JSON.stringify({
        result: 'built',
        bundle: join(work, 'bundle'),
        report: join(output, 'report.json'),
      }),
    );
    process.exit(0);
  }
  server = await serveFixture(join(work, 'bundle'));
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  page = await browser.newPage();
  page.setDefaultTimeout(10000);
  await page.route(
    (url) => url.pathname === '/player/game',
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: await readFile(join(work, 'bundle/index.html')),
      }),
  );
  report.responses = [];
  page.on('response', (r) => {
    if (report.responses.length < 16)
      report.responses.push({
        url: r.url(),
        status: r.status(),
        type: r.headers()['content-type'],
      });
  });
  page.on('pageerror', (e) => report.pageErrors.push(e.message));
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== new URL(server.url).origin)
      report.externalRequests.push(r.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem('tablemax-player-display-mode', 'wide'),
  );
  const load = async (scene, role, width, height) => {
    await page.setViewportSize({ width, height });
    const url = new URL(server.url);
    url.searchParams.set('scene', scene);
    url.searchParams.set('role', role);
    await page.goto(url.href);
    await page.waitForTimeout(120);
    if (role === 'player')
      try {
        await page
          .frameLocator('iframe[data-player-frame]')
          .locator('.ma-screen')
          .waitFor();
      } catch (e) {
        await writeFile(
          join(output, 'frame-debug.json'),
          JSON.stringify(
            await Promise.all(
              page
                .frames()
                .map(async (f) => ({ url: f.url(), html: await f.content() })),
            ),
            null,
            2,
          ),
        );
        await captureBrowserScreenshot(page, {
          path: join(output, 'frame-debug-failure.png'),
          failure: true,
        });
        throw e;
      }
    const f =
      role === 'player'
        ? page
            .frames()
            .find(
              (f) =>
                f !== page.mainFrame() &&
                new URL(f.url()).pathname === '/player/game',
            )
        : page.mainFrame();
    try {
      await f.locator('.ma-screen').waitFor();
    } catch (e) {
      await writeFile(join(output, 'failed-document.html'), await f.content());
      throw e;
    }
    await f.evaluate(() =>
      Promise.all(
        [...document.images]
          .filter((i) => i.loading !== 'lazy')
          .map((i) => i.decode().catch(() => {})),
      ),
    );
    return f;
  };
  const capture = async (id, scene, role, width, height) => {
    const f = await load(scene, role, width, height);
    const metrics = await f.evaluate(() => {
      const root = document.querySelector('.ma-screen'),
        r = root.getBoundingClientRect(),
        style = getComputedStyle(root);
      const visible = (e) =>
        e.checkVisibility() &&
        e.getBoundingClientRect().width > 0 &&
        e.getBoundingClientRect().height > 0;
      return {
        width: innerWidth,
        height: innerHeight,
        documentId: window.__documentId,
        fixture: window.__fixture,
        root: { x: r.x, y: r.y, width: r.width, height: r.height },
        rootPadding: ['Top', 'Right', 'Bottom', 'Left'].map((side) =>
          parseFloat(style[`padding${side}`]),
        ),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        brokenImages: [...document.images].filter(
          (i) => i.loading !== 'lazy' && (!i.complete || !i.naturalWidth),
        ).length,
        buttons: [...root.querySelectorAll('button')]
          .filter(visible)
          .map((e) => {
            const r = e.getBoundingClientRect();
            return {
              text: e.getAttribute('aria-label') ?? e.textContent.trim(),
              width: r.width,
              height: r.height,
              top: r.top,
              bottom: r.bottom,
              action: e.getAttribute('data-ma-action'),
              disabled: e.disabled,
            };
          }),
        layout: document.documentElement.dataset.playerLayout,
        contract: Boolean(root.dataset.playerLayoutContract),
      };
    });
    const image = join(output, id + '.png');
    await captureBrowserScreenshot(page, { path: image });
    report.screenshots.push({ id, path: image, scene, role, width, height });
    report.layouts.push({ id, ...metrics });
    assert.equal(
      metrics.fixture.publicHasSelf,
      false,
      'Role projection must not expose private self',
    );
    if (phase === 'after') {
      assert.equal(metrics.overflow, false, 'Document horizontal overflow');
      if (role === 'player') {
        const base =
          metrics.layout !== 'wide' ? 10 : metrics.width >= 960 ? 16 : 8;
        assert.deepEqual(
          metrics.rootPadding,
          Array(4).fill(base),
          'Normal browser computed four-side safe-area padding preserves the responsive base',
        );
      }
      if (metrics.layout === 'wide')
        assert.ok(
          metrics.root.width >= Math.min(metrics.width, 960) - 24,
          'Wide layout must use the available horizontal workspace instead of a legacy 620px column',
        );
      const submit = metrics.buttons.find(
        (button) =>
          ['bid', 'sealed-bid', 'set-price'].includes(button.action) &&
          !button.disabled,
      );
      if (role === 'player' && scene === 'auction-open')
        assert.ok(submit, 'An authorized open bidder has a submit control');
      if (submit) {
        assert.ok(
          submit.top >= 0 && submit.bottom <= metrics.height + 1,
          'Current monetary submit must be visible in the initial representative portrait, landscape, and compact viewport',
        );
      }
      assert.equal(
        metrics.brokenImages,
        0,
        'Non-lazy production images decode',
      );
    }
  };
  for (const scene of smoke ? ['auction-open'] : scenes)
    for (const [layout, width, height] of smoke
      ? [['wide', 1280, 720]]
      : [
          ['portrait', 390, 844],
          ['wide', 1280, 720],
        ])
      await checks(`${scene}-${layout}`, () =>
        capture(`${scene}-${layout}`, scene, 'player', width, height),
      );
  for (const role of smoke ? ['host'] : ['host', 'public'])
    for (const scene of smoke
      ? ['auction-open']
      : ['auction-open', 'auction-pair'])
      await checks(`${role}-${scene}`, () =>
        capture(`${role}-${scene}`, scene, role, 1280, 720),
      );
  if (!smoke) {
    for (const scene of ['collections', 'auction-pair'])
      for (const [layout, width, height] of [
        ['portrait', 390, 844],
        ['wide', 1280, 720],
      ])
        await checks(`${scene}-${layout}`, () =>
          capture(`${scene}-${layout}`, scene, 'player', width, height),
        );
    await checks('compact-landscape', () =>
      capture('compact-landscape', 'auction-open', 'player', 844, 390),
    );
    await checks('compact-landscape-rules-overlay', async () => {
      const f = await load('auction-open', 'player', 844, 390);
      await f.getByRole('button', { name: '规则', exact: true }).click();
      const dialog = f.locator('dialog[open]');
      await dialog.waitFor();
      const box = await dialog.boundingBox();
      assert.ok(box && box.width <= 844 && box.height <= 390);
      await captureBrowserScreenshot(page, {
        path: join(output, 'compact-landscape-rules.png'),
      });
      report.screenshots.push({
        id: 'compact-landscape-rules',
        path: join(output, 'compact-landscape-rules.png'),
        scene: 'auction-open',
        role: 'player',
        width: 844,
        height: 390,
      });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
    });
    if (phase === 'after') {
      await checks('contract-resize-draft-and-legacy', async () => {
        const f = await load('auction-open', 'player', 1280, 720);
        assert.equal(
          new URL(page.url()).pathname,
          '/player/game',
          'Child navigation synchronizes outer address',
        );
        await page.locator('select[aria-label="玩家布局"]').waitFor();
        await page
          .locator('select[aria-label="玩家布局"]')
          .selectOption('auto');
        const number = f.locator('input[type="number"]').first();
        await number.fill('7');
        await number.blur();
        const initial = await f.evaluate(() => ({
          id: window.__documentId,
          revision: window.__fixture.revision,
          value: document.querySelector('input[type="number"]').value,
          commands: window.__commands.length,
        }));
        const handSort = f.getByLabel('你的手牌和收藏排序');
        await handSort.selectOption('auction');
        for (const [width, height] of [
          [390, 844],
          [844, 390],
          [1280, 720],
        ]) {
          await page.setViewportSize({ width, height });
          await page.waitForTimeout(80);
          assert.equal(
            await page.locator('iframe[data-player-frame]').count(),
            1,
          );
          assert.deepEqual(
            await f.evaluate(() => ({
              id: window.__documentId,
              revision: window.__fixture.revision,
              value: document.querySelector('input[type="number"]').value,
              commands: window.__commands.length,
            })),
            initial,
          );
          if (await handSort.isVisible())
            assert.equal(await handSort.inputValue(), 'auction');
        }
        await page
          .locator('select[aria-label="玩家布局"]')
          .selectOption('wide');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(80);
        assert.equal(
          await page
            .locator('main.player-frame')
            .getAttribute('data-workspace-layout'),
          'portrait',
        );
        await page.getByText('空间不足，暂用竖屏').waitFor();
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.waitForTimeout(80);
        assert.equal(
          await page
            .locator('main.player-frame')
            .getAttribute('data-workspace-layout'),
          'wide',
        );
        await f
          .locator('[data-player-layout-contract]')
          .evaluate((e) => e.removeAttribute('data-player-layout-contract'));
        await page.waitForTimeout(80);
        assert.equal(
          await page
            .locator('main.player-frame')
            .getAttribute('data-workspace-layout'),
          null,
        );
        assert.equal(await page.locator('.player-frame__display').count(), 1);
        await f
          .locator('.ma-screen')
          .evaluate((e) =>
            e.setAttribute('data-player-layout-contract', 'three-v1'),
          );
        await page.locator('select[aria-label="玩家布局"]').waitFor();
        assert.deepEqual(
          await f.evaluate(() => ({
            id: window.__documentId,
            revision: window.__fixture.revision,
            value: document.querySelector('input[type="number"]').value,
            commands: window.__commands.length,
          })),
          initial,
        );
        await f.locator('button[data-ma-action="bid"]').click();
        const emitted = await f.evaluate(() => window.__commands);
        assert.equal(emitted.length, 1, 'A direct bid submits exactly once');
        assert.equal(emitted[0].action.type, 'bid');
        assert.equal(emitted[0].action.amount, 7);
        assert.ok(
          (await f.evaluate(() => window.__fixture.actions)).some(
            (a) => JSON.stringify(a) === JSON.stringify(emitted[0].action),
          ),
          'Emitted bid belongs to authorized legal actions',
        );
      });
      await checks('focused-input-space-freeze-and-blur-recovery', async () => {
        const f = await load('auction-open', 'player', 700, 900);
        await page
          .locator('select[aria-label="玩家布局"]')
          .selectOption('auto');
        const input = f.locator('input[type="number"]').first();
        await input.focus();
        const mode = await page
          .locator('main.player-frame')
          .getAttribute('data-workspace-layout');
        assert.equal(mode, 'portrait');
        await page.setViewportSize({ width: 700, height: 390 });
        await page.waitForTimeout(80);
        assert.equal(
          await page
            .locator('main.player-frame')
            .getAttribute('data-workspace-layout'),
          mode,
        );
        await input.blur();
        await page.waitForTimeout(100);
        assert.equal(
          await page
            .locator('main.player-frame')
            .getAttribute('data-workspace-layout'),
          'wide',
        );
        await input.focus();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(100);
        assert.equal(
          await page
            .locator('main.player-frame')
            .getAttribute('data-workspace-layout'),
          'portrait',
          'A real width-changing rotation reflows even while focused',
        );
      });
      await checks(
        'sealed-submitted-and-paired-auction-authority',
        async () => {
          const contribution = await load('auction-double', 'player', 390, 844);
          await contribution
            .getByRole('button', { name: /^追加 / })
            .first()
            .click();
          const contributionCommands = await contribution.evaluate(
            () => window.__commands,
          );
          assert.equal(
            contributionCommands.length,
            1,
            'Choosing a legal second painting emits one explicit contribution',
          );
          assert.equal(contributionCommands[0].action.type, 'add-double');
          assert.ok(
            (await contribution.evaluate(() => window.__fixture.actions)).some(
              (action) =>
                JSON.stringify(action) ===
                JSON.stringify(contributionCommands[0].action),
            ),
            'Second painting is one of the authorized legal choices',
          );
          const sealed = await load('sealed-submitted', 'player', 390, 844);
          assert.equal(
            (await sealed.evaluate(() => window.__fixture.actions)).length,
            0,
            'Submitted bidder has no second decision',
          );
          assert.equal(
            await sealed.locator('input[type="number"]').count(),
            0,
            'Submitted sealed bid has no editable amount',
          );
          const pair = await load('auction-pair', 'player', 1280, 720);
          assert.equal(
            await pair.locator('.ma-auction__paintings .ma-card').count(),
            2,
            'A legally completed pair shows two paintings',
          );
          assert.equal(
            await pair.evaluate(() => window.__commands.length),
            0,
            'Viewing a pair submits no command',
          );
        },
      );
      if (extra) {
        for (const [id, scene, selector] of [
          [
            'minimum-phone-320-bid',
            'auction-open',
            'button[data-ma-action="bid"]',
          ],
          ['minimum-phone-320-offer', 'offer', 'button[aria-label^="上拍 "]'],
        ])
          await checks(id, async () => {
            const f = await load(scene, 'player', 320, 568);
            const control = f.locator(selector).first();
            await control.scrollIntoViewIfNeeded();
            const state = await f.evaluate((selector) => {
              const e = document.querySelector(selector),
                r = e.getBoundingClientRect();
              return {
                width: innerWidth,
                height: innerHeight,
                overflow: document.documentElement.scrollWidth > innerWidth + 1,
                rect: {
                  top: r.top,
                  bottom: r.bottom,
                  width: r.width,
                  height: r.height,
                },
                disabled: e.disabled,
                commands: window.__commands.length,
                scrollY,
              };
            }, selector);
            assert.equal(state.overflow, false);
            assert.equal(state.disabled, false);
            assert.ok(
              state.rect.width >= 44 &&
                state.rect.height >= 44 &&
                state.rect.top >= 0 &&
                state.rect.bottom <= state.height + 1,
              'Minimum phone control is reachable by ordinary scrolling with a 44px target',
            );
            assert.equal(state.commands, 0, 'Scrolling submits no action');
            await captureBrowserScreenshot(page, {
              path: join(output, id + '.png'),
            });
            report.screenshots.push({
              id,
              path: join(output, id + '.png'),
              scene,
              role: 'player',
              width: 320,
              height: 568,
            });
            await control.click();
            const commands = await f.evaluate(() => window.__commands);
            assert.equal(commands.length, 1);
            assert.ok(
              (await f.evaluate(() => window.__fixture.actions)).some(
                (action) =>
                  JSON.stringify(action) === JSON.stringify(commands[0].action),
              ),
              'Reached control emits one authorized legal action',
            );
            report.layouts.push({ id, ...state });
          });
        await checks('width-and-height-boundary-drafts', async () => {
          const f = await load('auction-open', 'player', 960, 500);
          await page
            .getByLabel('玩家布局', { exact: true })
            .selectOption('auto');
          const input = f.locator('input[type="number"]');
          await input.fill('9');
          await input.blur();
          const snapshot = await f.evaluate(() => ({
            id: window.__documentId,
            revision: window.__fixture.revision,
            value: document.querySelector('input[type="number"]').value,
            commands: window.__commands.length,
          }));
          const samples = [];
          for (const [width, height, expected] of [
            [639, 500, 'portrait'],
            [640, 500, 'wide'],
            [959, 500, 'wide'],
            [960, 500, 'wide'],
            [640, 371, 'portrait'],
            [640, 372, 'wide'],
          ]) {
            await page.setViewportSize({ width, height });
            await page.waitForFunction(
              (expected) =>
                document
                  .querySelector('main.player-frame')
                  ?.getAttribute('data-workspace-layout') === expected,
              expected,
            );
            const current = await f.evaluate(() => ({
              id: window.__documentId,
              revision: window.__fixture.revision,
              value: document.querySelector('input[type="number"]').value,
              commands: window.__commands.length,
            }));
            assert.deepEqual(current, snapshot);
            assert.equal(
              await page.locator('iframe[data-player-frame]').count(),
              1,
            );
            const sample = {
              outerWidth: width,
              outerHeight: height,
              expected,
              ...(await f.evaluate(() => {
                const root = document.querySelector('.ma-screen'),
                  style = getComputedStyle(root);
                return {
                  width: innerWidth,
                  height: innerHeight,
                  layout: document.documentElement.dataset.playerLayout,
                  rootWidth: root.getBoundingClientRect().width,
                  rootPadding: ['Top', 'Right', 'Bottom', 'Left'].map((side) =>
                    parseFloat(style[`padding${side}`]),
                  ),
                };
              })),
            };
            assert.deepEqual(
              sample.rootPadding,
              Array(4).fill(
                sample.layout !== 'wide' ? 10 : sample.width >= 960 ? 16 : 8,
              ),
              'Normal safe-area computed padding survives layout boundaries',
            );
            samples.push(sample);
          }
          report.layouts.push({
            id: 'width-and-height-boundary-drafts',
            samples,
            documentAndDraftPreserved: true,
          });
        });
        await checks('paused-and-controlled-disconnected', async () => {
          const paused = await load('paused', 'player', 390, 844);
          assert.equal(
            await paused.evaluate(() => window.__fixture.paused),
            true,
            'Paused snapshot came from the legal RoomCoordinator preparation',
          );
          const pauseNotice = paused.locator('.ma-notice [title="游戏已暂停"]');
          await pauseNotice.waitFor();
          assert.match(
            await pauseNotice.innerText(),
            /暂停|恢复/,
            'The legal restored-pause state has a readable pause/recovery message',
          );
          assert.equal(
            await paused.evaluate(() => window.__commands.length),
            0,
          );
          await captureBrowserScreenshot(page, {
            path: join(output, 'paused-player.png'),
          });
          report.screenshots.push({
            id: 'paused-player',
            path: join(output, 'paused-player.png'),
            scene: 'paused',
            role: 'player',
            width: 390,
            height: 844,
          });
          const disconnected = await load('auction-open', 'player', 1280, 720);
          const before = await disconnected.evaluate(() => ({
            id: window.__documentId,
            revision: window.__fixture.revision,
          }));
          await disconnected.evaluate(() =>
            window.renderModernArt({
              scene: 'auction-open',
              role: 'player',
              preserve: true,
              connected: false,
            }),
          );
          await disconnected
            .getByText('正在重新连接', { exact: true })
            .first()
            .waitFor();
          assert.equal(
            await disconnected
              .locator('button[data-ma-action="bid"]')
              .isDisabled(),
            true,
            'Controlled disconnected transport locks the authorized action',
          );
          assert.deepEqual(
            await disconnected.evaluate(() => ({
              id: window.__documentId,
              revision: window.__fixture.revision,
            })),
            before,
          );
          assert.equal(
            await disconnected.evaluate(() => window.__commands.length),
            0,
          );
          await captureBrowserScreenshot(page, {
            path: join(output, 'controlled-disconnected-player.png'),
          });
          report.screenshots.push({
            id: 'controlled-disconnected-player',
            path: join(output, 'controlled-disconnected-player.png'),
            scene: 'auction-open',
            role: 'player',
            width: 1280,
            height: 720,
          });
          report.layouts.push({
            id: 'paused-and-controlled-disconnected',
            pauseSource:
              'legal-fixtures/preparation-proof.json paused; RoomCoordinator pause command',
            disconnectSource:
              'Fixture transport connected=false and matching locked state; saved role projection unchanged',
            actualSocketDisconnectProven: false,
          });
        });
      }
    }
  }
  report.inputs.after = await Promise.all(tracked.map(record));
  assert.deepEqual(
    report.inputs.after,
    report.inputs.before,
    'Source remained stable while building and capturing',
  );
  assert.deepEqual(report.pageErrors, [], 'No browser page errors');
  assert.deepEqual(report.externalRequests, [], 'Loopback only');
  report.result = report.failures.length ? 'failed' : 'passed';
} catch (e) {
  report.result = 'failed';
  report.failures.push({
    id: 'setup-or-finalize',
    error: e.stack ?? e.message,
  });
} finally {
  await browser?.close();
  await server?.close();
  const completed = new Set(
    [...report.behaviors, ...report.failures].map((r) => r.id),
  );
  for (const id of only)
    if (!completed.has(id) && !report.pending.includes(id))
      report.pending.push(id);
  for (const scene of scenes)
    for (const layout of ['portrait', 'wide'])
      if (!completed.has(`${scene}-${layout}`))
        if (!only.length || only.includes(`${scene}-${layout}`))
          report.pending.push(`${scene}-${layout}`);
  for (const role of ['host', 'public'])
    for (const scene of ['auction-open', 'auction-pair'])
      if (!completed.has(`${role}-${scene}`))
        if (!only.length || only.includes(`${role}-${scene}`))
          report.pending.push(`${role}-${scene}`);
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify(
    {
      phase,
      result: report.result,
      checks: report.behaviors.length,
      failures: report.failures,
      pending: report.pending,
      report: join(output, 'report.json'),
    },
    null,
    2,
  ),
);
if (report.result !== 'passed') process.exitCode = 1;
