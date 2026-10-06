import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from './browser-test.mjs';
import { serveFixture } from './fixture-server.mjs';

const args = process.argv.slice(2);
assert.ok(
  args.every(
    (arg) =>
      /^--evidence=[a-zA-Z0-9_-]+$/.test(arg) ||
      arg === '--sample' ||
      arg === '--portable' ||
      arg === '--sound',
  ),
);
const name =
  args.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  `run-${Date.now()}`;
const sample = args.includes('--sample'),
  portable = args.includes('--portable');
const output = resolve(
  'artifacts/maintenance/v1.0.3/pokemon-ui-redesign/ui',
  name,
);
await mkdir(resolve(output, '..'), { recursive: true });
await mkdir(output, { recursive: false });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/pokemon-ui-redesign-'));
let manifest, extracted;
if (portable) {
  manifest = JSON.parse(
    await readFile(
      'artifacts/releases/TableMax-1.0.3-win-x64-manifest.json',
      'utf8',
    ),
  );
  const archive = resolve('artifacts/releases', manifest.archive.name);
  assert.equal(
    createHash('sha256')
      .update(await readFile(archive))
      .digest('hex'),
    manifest.archive.sha256,
  );
  extracted = join(work, 'portable');
  await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Expand-Archive -LiteralPath $env:TABLEMAX_EFFECTS_ZIP -DestinationPath $env:TABLEMAX_EFFECTS_EXTRACT',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_EFFECTS_ZIP: archive,
        TABLEMAX_EFFECTS_EXTRACT: extracted,
      },
    },
  );
  for (const file of manifest.files)
    assert.equal(
      createHash('sha256')
        .update(await readFile(join(extracted, file.path)))
        .digest('hex'),
      file.sha256,
    );
}
const started = performance.now();
const report = {
  result: 'running',
  scope:
    'Actual production React expansion UI and rule-valid projections in muted real Edge. Research diagrams use fixed public teaching data. No physical device, hardware DPI or human listening claim.',
  sample,
  portable,
  usesFinalPackagedClient: portable,
  poseFrames: [],
  sequences: [],
  ordinary: [],
  display: [],
  cancellation: [],
  screenshots: [],
  pageErrors: [],
  externalRequests: [],
};
await writeFile(
  join(work, 'entry.tsx'),
  `import ${JSON.stringify(resolve('scripts/fixtures/pokemon-ui-redesign.tsx'))};`,
);
await writeFile(
  join(work, 'index.html'),
  '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>',
);
const compilation = await build({
  configFile: false,
  root: work,
  plugins: [
    react(),
    ...(portable
      ? [
          {
            name: 'actual-packaged-screen',
            enforce: 'pre',
            resolveId(source, importer) {
              if (source === '/games/pokemon-encounters/web/entry.js')
                return { id: source, external: true };
              if (
                !importer
                  ?.replaceAll('\\', '/')
                  .endsWith('/scripts/fixtures/pokemon-ui-redesign.tsx')
              )
                return;
              if (source === '../../games/pokemon-encounters/expansion/web')
                return '\0actual-packaged-expansion';
              if (source === '../../packages/web-host/src')
                return { id: '/runtime/v1/web-host.js', external: true };
              if (source === '../../apps/web/src/styles.css')
                return '\0actual-packaged-css';
            },
            load(id) {
              if (id === '\0actual-packaged-expansion')
                return "import { clientsByVariant } from '/games/pokemon-encounters/web/entry.js'; export const client = clientsByVariant.expansion;";
              if (id === '\0actual-packaged-css') return '';
            },
          },
        ]
      : []),
  ],
  resolve: {
    alias: portable
      ? {}
      : {
          react: resolve('apps/web/node_modules/react'),
          'react-dom': resolve('apps/web/node_modules/react-dom'),
        },
  },
  build: {
    outDir: join(work, 'bundle'),
    emptyOutDir: false,
    target: 'chrome110',
    manifest: true,
    ...(portable
      ? {
          rolldownOptions: {
            external: [
              'react',
              'react/jsx-runtime',
              'react/jsx-dev-runtime',
              'react-dom',
              'react-dom/client',
            ],
            output: {
              paths: {
                react: '/runtime/v1/react.js',
                'react/jsx-runtime': '/runtime/v1/jsx-runtime.js',
                'react/jsx-dev-runtime': '/runtime/v1/jsx-dev-runtime.js',
                'react-dom': '/runtime/v1/react-dom.js',
                'react-dom/client': '/runtime/v1/react-dom-client.js',
              },
            },
          },
        }
      : {}),
  },
  logLevel: 'error',
});
const moduleInputs = [
  ...new Set(
    (Array.isArray(compilation) ? compilation : [compilation])
      .flatMap(
        (result) =>
          result.output?.flatMap((item) =>
            item.type === 'chunk' ? Object.keys(item.modules) : [],
          ) ?? [],
      )
      .map((path) => path.split('?')[0])
      .filter(
        (path) =>
          path.startsWith(resolve('.').replaceAll('\\', '/') + '/') &&
          !path.includes('node_modules') &&
          !path.includes('/tmp/'),
      ),
  ),
].sort();
const inputHashes = async () =>
  Object.fromEntries(
    await Promise.all(
      moduleInputs.map(async (path) => [
        path,
        createHash('sha256')
          .update(await readFile(path))
          .digest('hex'),
      ]),
    ),
  );
report.sourceBefore = await inputHashes();
if (portable) {
  report.archiveSha256 = createHash('sha256')
    .update(
      await readFile(resolve('artifacts/releases', manifest.archive.name)),
    )
    .digest('hex');
  assert.equal(report.archiveSha256, manifest.archive.sha256);
  await cp(join(extracted, 'web'), join(work, 'bundle'), {
    recursive: true,
    filter: (path) => path !== join(extracted, 'web/index.html'),
  });
  const styles = manifest.files
    .filter(
      (file) =>
        file.path.endsWith('.css') &&
        (file.path.startsWith('web/assets/') ||
          file.path.startsWith('web/runtime/v1/') ||
          file.path.startsWith('web/games/pokemon-encounters/')),
    )
    .map((file) => `<link rel="stylesheet" href="/${file.path.slice(4)}">`)
    .join('');
  const html = join(work, 'bundle/index.html');
  await writeFile(
    html,
    (await readFile(html, 'utf8')).replace('</head>', `${styles}</head>`),
  );
  report.scope =
    'Hash-verified actual final ZIP expansion client and shared runtime in muted real Edge with rule-valid projections. Native authority is separately verified on this ZIP. No physical device or human listening claim.';
}
const server = await serveFixture(join(work, 'bundle'));
let browser;
try {
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (
      url.startsWith(new URL(server.url).origin) ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    )
      return route.continue();
    report.externalRequests.push(url);
    await route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => report.pageErrors.push(e.message));
  await page.goto(server.url);
  await page.waitForFunction(() => typeof window.redesignShow === 'function');
  const shot = async (label, fullPage = false) => {
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete && img.naturalWidth > 0),
    );
    await page.evaluate(async () => {
      await Promise.all(
        [...document.querySelectorAll('svg image')].map(async (element) => {
          const img = new Image();
          img.src = element.getAttribute('href');
          await img.decode();
        }),
      );
    });
    const path = join(output, label + '.png');
    await page.screenshot({ path, fullPage });
    report.screenshots.push({ label, path });
  };
  const show = async (settings) =>
    page.evaluate(
      (s) => window.redesignShow({ ...s, animate: false }),
      settings,
    );
  const geometries = async () =>
    page.evaluate(() => ({
      viewport: [innerWidth, innerHeight],
      scrollWidth: document.documentElement.scrollWidth,
      cards: [
        ...document.querySelectorAll(
          '.ex-player .card-slot, .ex-actions .card-slot',
        ),
      ].map((el) => {
        const rect = el.getBoundingClientRect(),
          image = el.querySelector('.card-portrait, img'),
          number = el.querySelector('.slot-index');
        return {
          slot: el.dataset.slot,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          imageHeight: image?.getBoundingClientRect().height ?? null,
          numberFont: number ? getComputedStyle(number).fontSize : null,
        };
      }),
    }));
  for (const id of portable ? [] : ['R01', 'R23', 'H02']) {
    await page.evaluate((id) => window.redesignResearch(id), id);
    await shot('research-' + id, true);
    assert.equal(await page.locator('.ex-research-picture').count(), 1);
    assert.equal(await page.locator('.ex-research-diagram > svg').count(), 1);
  }
  await show({ scenario: 'draw', role: 'player' });
  assert.equal(await page.locator('.ex-source').count(), 4);
  assert.deepEqual(
    await page.locator('.ex-source > strong').allTextContents(),
    ['摸牌堆', '可选弃牌1', '可选弃牌2', '调位'],
  );
  assert.equal(await page.locator('.pokemon-board').count(), 1);
  assert.ok(
    (await page.locator('.ex-source').nth(1).innerText()).includes('顶行交换'),
  );
  assert.ok(
    (await page.locator('.ex-source').nth(2).innerText()).includes('横向复制'),
  );
  await shot('draw-player-390', true);
  await show({ scenario: 'draw', role: 'player', waiting: true });
  assert.equal(
    await page.locator('.ex-source').count(),
    0,
    'Another player turn must not show action choices',
  );
  assert.equal(await page.locator('.ex-held').count(), 0);
  assert.equal(await page.locator('.ex-observing .card-slot').count(), 9);
  await shot('waiting-player-390', true);
  await show({ scenario: 'draw', role: 'player' });
  report.display.push(await geometries());
  await page.setViewportSize({ width: 320, height: 568 });
  await show({ scenario: 'place', ordinary: 'magikarp', role: 'player' });
  assert.equal(await page.locator('.pokemon-board').count(), 1);
  assert.equal(await page.locator('.ex-held .ex-card').count(), 1);
  const legal = page.locator('.card-slot:not(:disabled)').first();
  await legal.click();
  assert.equal(
    await page.locator('.ex-submit button:not(:disabled)').count(),
    1,
  );
  await shot('place-player-320', true);
  const buttonColors = await page.evaluate(() => [
    getComputedStyle(document.querySelector('.ex-submit button'))
      .backgroundColor,
    getComputedStyle(document.querySelector('.ex-discard-action'))
      .backgroundColor,
  ]);
  assert.notEqual(buttonColors[0], buttonColors[1]);
  report.display.push(await geometries());
  await page.locator('.ex-submit button').click();
  assert.equal(
    await page.evaluate(() => window.redesignCommands.at(-1).action),
    'replace',
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await show({
    scenario: 'result',
    ordinary: 'magikarp',
    terminal: true,
    role: 'host',
  });
  assert.equal(await page.locator('.ex-player .card-slot').count(), 54);
  assert.equal(await page.locator('.ex-supply').count(), 0);
  assert.equal(await page.locator('.ex-victory').count(), 1);
  const resultBottom = await page
    .locator('.ex-players')
    .evaluate((el) => el.getBoundingClientRect().bottom);
  await shot('result-host-six-720', true);
  const settlementGeometry = await page.evaluate(() =>
    Object.fromEntries(
      [
        '.ex-toolbar',
        '.ex-victory',
        '.ex-players',
        '.ex-player',
        '.ex-player > header',
        '.ex-score',
        '.pokemon-board',
      ].map((selector) => {
        const el = document.querySelector(selector);
        return [
          selector,
          {
            height: el.getBoundingClientRect().height,
            margin: getComputedStyle(el).margin,
            padding: getComputedStyle(el).padding,
          },
        ];
      }),
    ),
  );
  assert.ok(
    resultBottom <= 721,
    `720p settlement overflow: ${resultBottom}; ${JSON.stringify(settlementGeometry)}`,
  );
  await shot('result-host-six-720');
  report.display.push(await geometries());
  await page.locator('.ex-score').first().click();
  assert.equal(await page.locator('.ex-score-detail').count(), 1);
  await shot('score-detail');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await show({ scenario: 'place', ordinary: 'piplup', role: 'public' });
  assert.equal(await page.locator('.ex-public-piles section').count(), 3);
  assert.equal(await page.locator('.ex-public-held .ex-card').count(), 1);
  assert.equal(await page.locator('.ex-supply .ex-research-strip').count(), 1);
  assert.equal(await page.locator('.ex-connection.online').count(), 0);
  assert.equal(await page.locator('.sound-icon-control > svg').count(), 1);
  const portraitMinimum = await page
    .locator('.ex-player .card-portrait')
    .evaluateAll((els) =>
      Math.min(...els.map((el) => el.getBoundingClientRect().height)),
    );
  assert.ok(
    portraitMinimum >= 80,
    `Six player portrait track is too small: ${portraitMinimum}`,
  );
  const publicBottom = await page
    .locator('.ex-players')
    .evaluate((el) => el.getBoundingClientRect().bottom);
  assert.ok(
    publicBottom <= 1081,
    `1080p six player board overflow: ${publicBottom}`,
  );
  await shot('public-six-held-1080', true);
  await page.setViewportSize({ width: 320, height: 568 });
  await show({ scenario: 'vote', role: 'player' });
  assert.equal(
    await page
      .locator('.ex-vote img, .ex-vote svg, .ex-vote .ex-research-card')
      .count(),
    0,
    'Phone ballot contains only options',
  );
  assert.equal(
    await page.locator('.ex-round-banner > strong').innerText(),
    '投票选择研究任务',
  );
  await shot('vote-player-320', true);
  if (!sample) {
    await page.setViewportSize({ width: 1280, height: 720 });
    const sixCommon = await show({
      scenario: 'result',
      ordinary: '5',
      terminal: true,
      commonWinner: true,
      seats: 6,
      role: 'host',
    });
    assert.equal(sixCommon.phase, 'match-result');
    assert.equal(await page.locator('.ex-player .card-slot').count(), 54);
    assert.equal(await page.locator('.ex-player.winner').count(), 2);
    const sixCommonGeometry = await geometries();
    report.display.push(sixCommonGeometry);
    await shot('result-host-six-common-720');
    const sixCommonBoard = await page.locator('.ex-players').boundingBox();
    assert.ok(sixCommonBoard.y + sixCommonBoard.height <= 721);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const common = await show({
      scenario: 'result',
      ordinary: '5',
      terminal: true,
      commonWinner: true,
      seats: 2,
      role: 'host',
    });
    assert.equal(common.phase, 'match-result');
    assert.equal(await page.locator('.ex-player .card-slot').count(), 18);
    assert.equal(await page.locator('.ex-player.winner').count(), 2);
    await shot('result-host-two-common-1080');
    report.display.push(await geometries());
    await page.setViewportSize({ width: 390, height: 844 });
    await show({
      scenario: 'result',
      ordinary: '5',
      terminal: true,
      commonWinner: true,
      seats: 2,
      role: 'player',
    });
    await shot('result-player-two-common-390', true);
    await show({ scenario: 'draw', role: 'player', emptyDiscard: true });
    assert.equal(await page.locator('.ex-source:disabled').count(), 2);
    await shot('empty-discard-player-390', true);
    for (const viewport of [
      { width: 360, height: 640 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(viewport);
      await show({ scenario: 'place', ordinary: 'magikarp', role: 'player' });
      await shot('place-player-' + viewport.width, true);
      report.display.push(await geometries());
    }
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
      { width: 2560, height: 1440 },
      { width: 3840, height: 2160 },
    ]) {
      await page.setViewportSize(viewport);
      await show({ scenario: 'draw', role: 'public' });
      await shot('draw-public-' + viewport.width);
      report.display.push(await geometries());
    }
    for (const zoom of [1.25, 1.5]) {
      await page.setViewportSize({ width: 1280, height: 720 });
      await show({
        scenario: 'result',
        ordinary: 'magikarp',
        terminal: true,
        role: 'host',
      });
      await page.evaluate(
        (zoom) => (document.documentElement.style.zoom = String(zoom)),
        zoom,
      );
      await shot('result-host-zoom-' + zoom, true);
      report.display.push(await geometries());
      await page.evaluate(() => (document.documentElement.style.zoom = ''));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await show({ scenario: 'vote', role: 'player' });
    await shot('research-vote-player', true);
    assert.equal(await page.locator('.ex-mission-option').count(), 3);
    await page.locator('.ex-mission-option').first().click();
    assert.equal(
      await page.evaluate(() => window.redesignCommands.at(-1).action),
      'vote-research',
    );
    await show({ scenario: 'draw', role: 'player' });
    await page.locator('.ex-research-summary').first().click();
    assert.equal(
      await page.locator('.ex-research-detail .ex-research-picture').count(),
      1,
    );
    await shot('active-research-detail', true);
    await show({ scenario: 'draw', role: 'player' });
    await page.getByRole('button', { name: '规则', exact: true }).click();
    await page.getByRole('button', { name: '研究任务', exact: true }).click();
    assert.equal(
      await page.locator('.ex-rule-tasks .ex-research-card').count(),
      30,
    );
    assert.equal(
      await page.locator('.ex-rule-tasks .ex-research-picture').count(),
      30,
    );
    assert.equal(
      await page.locator('.ex-rule-tasks .ex-research-diagram > svg').count(),
      30,
    );
    for (const card of await page
      .locator('.ex-rule-tasks .ex-research-card')
      .all()) {
      const id = await card.getAttribute('data-research');
      await card.scrollIntoViewIfNeeded();
      await card.screenshot({ path: join(output, `research-card-${id}.png`) });
      const decoded = await card
        .locator('.ex-research-picture')
        .evaluate((img) => img.complete && img.naturalWidth > 0);
      assert.ok(decoded, `Missing research art ${id}`);
    }
    await show({ creature: 'charizard', role: 'player' });
    assert.equal(await page.locator('.ex-private-peek').count(), 1);
    await shot('private-peek-player', true);
    await show({ creature: 'charizard', role: 'public' });
    assert.equal(await page.locator('.ex-private-peek').count(), 0);
    await show({ creature: 'rayquaza', scenario: 'row', role: 'player' });
    await shot('row-choice-player', true);
    assert.equal(
      await page.locator('.ex-actions > .ex-target-board').count(),
      0,
    );
    assert.equal(
      await page.locator('.ex-row-choice .pokemon-board').count(),
      1,
    );
    await page.locator('.ex-target-list button').last().click();
    assert.equal(await page.locator('.card-slot.selected').count(), 0);
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.externalRequests, []);
  for (const geometry of report.display) {
    assert.ok(
      geometry.scrollWidth <= geometry.viewport[0] + 1,
      'Horizontal document overflow',
    );
    for (const card of geometry.cards) {
      assert.ok(card.width > 0 && card.height > 0);
      assert.ok(card.imageHeight === null || card.imageHeight > 0);
    }
  }
  report.sourceAfter = await inputHashes();
  assert.deepEqual(
    report.sourceAfter,
    report.sourceBefore,
    'Source changed during UI evidence',
  );
  report.result = 'passed';
  await context.close();
} catch (error) {
  report.result = 'failed';
  report.error = error.stack ?? String(error);
  throw error;
} finally {
  if (browser) await browser.close();
  await server.close();
  report.durationMs = Math.round(performance.now() - started);
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      durationMs: report.durationMs,
      report: join(output, 'results.json'),
    }),
  );
}
