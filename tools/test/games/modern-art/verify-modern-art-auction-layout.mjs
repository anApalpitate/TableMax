import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';
import { build } from 'esbuild';

assertWorkspaceRoot();
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TABLEMAX_TEST_MAINTENANCE = '0';
const option = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const extraOnly = process.argv.includes('--extra-only');
const inactiveOnly = process.argv.includes('--inactive-only');
const fixedComparisonOnly = process.argv.includes('--fixed-comparison-only');
assert.ok(!(extraOnly && inactiveOnly), 'Choose one independent subset');
const afterOnly = process.argv.includes('--after-only');
const task = resolve(
  option('task') ?? 'tmp/modern-art-player-layout-20261023-b1',
);
assert.ok(task.startsWith(resolve('tmp') + sep));
const output = resolve(
  option('output') ??
    'artifacts/maintenance/modern-art-player-layout-20261023-b1/server-geometry-r01',
);
assert.ok(output.startsWith(resolve('artifacts') + sep));
const browserTemp = join(task, 'server-browser-temp');
await mkdir(browserTemp, { recursive: true });
await mkdir(output, { recursive: true });
process.env.TEMP = browserTemp;
process.env.TMP = browserTemp;
const { launchTestBrowser } = await import('../../support/browser-test.mjs');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const report = {
  arguments: process.argv.slice(2),
  scope: fixedComparisonOnly
    ? 'The identical legally prepared four-player fixed-price single/paired lots after an authorized set-price 30 command, rendered by frozen before and current after production management components at 1280x720. Baseline geometry is recorded, not judged against the current layout contract. Source viewport evidence, not physical DPI, network, or installer proof.'
    : inactiveOnly
      ? 'Production management components with legally paused three/four-player RoomCoordinator auctions and separately controlled disconnected transport. Only inactive layout hooks and acting indicators are checked. Frozen-clock component evidence does not certify real network disconnect or recovery.'
      : extraOnly
        ? 'Production management components with separately initialized and legally played three/four-player RoomCoordinator projections. Single/paired lots and empty galleries with frozen clocks. Source rendering evidence, not live network, physical DPI, natural full match, or installer proof. No state splicing or CSS mutation.'
        : 'Production management components in the already-built before/after fixture. Five-player legal RoomCoordinator projections, frozen clocks, empty and occupied galleries, single and paired lots, and double collection without a progress bar. Source rendering evidence, not live network, physical DPI, natural full match, or installer proof. No state or CSS mutation.',
  result: 'running',
  inputs: [],
  layouts: [],
  failures: [],
  pending: [],
  pageErrors: [],
  screenshots: [],
};
await writeFile(
  join(output, 'verifier-source.mjs'),
  await readFile(new URL(import.meta.url)),
);
const save = () =>
  writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
const contains = (outer, inner) =>
  inner.x >= outer.x - 1 &&
  inner.right <= outer.right + 1 &&
  inner.y >= outer.y - 1 &&
  inner.bottom <= outer.bottom + 1;
const overlaps = (a, b) =>
  Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
const scenes = fixedComparisonOnly
  ? ['4-fixed-single', '4-pair']
  : inactiveOnly
    ? [
        '3-pair-paused',
        '4-pair-paused',
        '3-pair-disconnected',
        '4-pair-disconnected',
      ]
    : extraOnly
      ? [
          '3-single',
          '3-pair',
          '3-fixed-single',
          '4-single',
          '4-pair',
          '4-fixed-single',
        ]
      : [
          'auction-sealed',
          'auction-open',
          'auction-pair',
          'auction-double',
          'auction-fixed',
        ];
const sizes =
  inactiveOnly || fixedComparisonOnly
    ? [[1280, 720]]
    : [
        [1280, 720],
        [1920, 1080],
        [960, 540],
        ...(!extraOnly ? [[3840, 2160]] : []),
      ];
let browser;
try {
  if (option('source-report')) {
    const sourceReport = resolve(option('source-report'));
    const binding = JSON.parse(await readFile(sourceReport, 'utf8'));
    const inputs = binding.inputs.after.filter((entry) =>
      entry.path.startsWith('games/modern-art/'),
    );
    assert.ok(
      inputs.length >= 5,
      'Source report must bind all five Modern Art files',
    );
    for (const input of inputs)
      assert.equal(
        hash(await readFile(resolve(input.path))),
        input.sha256,
        `Stale production fixture input: ${input.path}`,
      );
    report.sourceBinding = {
      path: sourceReport,
      sha256: hash(await readFile(sourceReport)),
      inputs,
    };
  }
  let extraSnapshots;
  if (extraOnly || inactiveOnly || fixedComparisonOnly) {
    const extraWork = join(task, 'server-extra-fixtures');
    await mkdir(extraWork, { recursive: true });
    if (option('prepared-snapshots')) {
      assert.ok(
        option('preparation-proof'),
        'Reused legal snapshots need their preparation proof',
      );
      extraSnapshots = JSON.parse(
        await readFile(resolve(option('prepared-snapshots')), 'utf8'),
      );
      report.reusedLegalSnapshots = resolve(option('prepared-snapshots'));
    } else {
      const compiled = join(extraWork, 'prepare.cjs');
      await build({
        entryPoints: [
          resolve('tools/test/games/modern-art/prepare-auction-layout.ts'),
        ],
        outfile: compiled,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        logLevel: 'silent',
      });
      extraSnapshots = await createRequire(import.meta.url)(
        compiled,
      ).prepareAuctionLayout(extraWork);
    }
    for (const name of ['snapshots.json', 'preparation-proof.json']) {
      const reused = option(
        name === 'snapshots.json' ? 'prepared-snapshots' : 'preparation-proof',
      );
      const bytes = await readFile(
        reused ? resolve(reused) : join(extraWork, name),
      );
      const evidence = join(output, `extra-${name}`);
      await writeFile(evidence, bytes);
      report.inputs.push({
        path: relative(process.cwd(), evidence).split(sep).join('/'),
        sha256: hash(bytes),
      });
    }
    report.extraProofPath = join(output, 'extra-preparation-proof.json');
    const helperSource = resolve(
      'tools/test/games/modern-art/prepare-auction-layout.ts',
    );
    await writeFile(
      join(output, 'preparation-helper-source.ts'),
      await readFile(helperSource),
    );
    report.extraPreparationSource = {
      path: relative(process.cwd(), helperSource).split(sep).join('/'),
      sha256: hash(await readFile(helperSource)),
    };
  }
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  for (const phase of extraOnly || inactiveOnly || afterOnly
    ? ['after']
    : ['before', 'after']) {
    const selectedBundle = option(`${phase}-bundle`);
    const bundle = selectedBundle
      ? resolve(selectedBundle)
      : join(task, `fixture-${phase}`, 'bundle');
    assert.ok(
      bundle.startsWith(task + sep),
      'Fixture bundle must stay in the task directory',
    );
    const assetFiles = (await readdir(join(bundle, 'assets'))).filter((name) =>
      /\.(css|js)$/.test(name),
    );
    for (const name of [
      'index.html',
      ...assetFiles.map((f) => `assets/${f}`),
    ]) {
      const file = join(bundle, name);
      report.inputs.push({
        phase,
        path: relative(process.cwd(), file).split(sep).join('/'),
        sha256: hash(await readFile(file)),
      });
    }
    const server = await serveFixture(bundle);
    try {
      const page = await browser.newPage();
      page.on('pageerror', (error) => report.pageErrors.push(error.message));
      for (const role of ['host'])
        for (const scene of scenes)
          for (const [width, height] of sizes) {
            if (
              width === 3840 &&
              !['auction-open', 'auction-pair'].includes(scene)
            )
              continue;
            const id = `${phase}-${role}-${scene}-${width}x${height}`;
            if (report.failures.length >= 10) {
              report.pending.push(id);
              continue;
            }
            try {
              await page.setViewportSize({ width, height });
              const url = new URL(server.url);
              url.searchParams.set('role', role);
              url.searchParams.set(
                'scene',
                extraOnly || inactiveOnly || fixedComparisonOnly
                  ? 'auction-open'
                  : scene,
              );
              await page.goto(url.href);
              if (extraOnly || inactiveOnly || fixedComparisonOnly)
                await page.evaluate(
                  ({ view, role, connected }) =>
                    window.renderModernArt({
                      scene: 'extra-legal-room',
                      role,
                      suppliedView: view,
                      connected,
                    }),
                  {
                    view: extraSnapshots[scene.replace('-disconnected', '')][
                      role
                    ],
                    role,
                    connected: !scene.endsWith('-disconnected'),
                  },
                );
              await page
                .locator('.ma-auction__paintings > .ma-card')
                .first()
                .waitFor();
              await page.evaluate(() => document.fonts.ready);
              const geometry = await page.evaluate(() => {
                const rect = (element) => {
                  if (!element) return null;
                  const r = element.getBoundingClientRect();
                  return {
                    x: r.x,
                    y: r.y,
                    right: r.right,
                    bottom: r.bottom,
                    width: r.width,
                    height: r.height,
                  };
                };
                const find = (selector) => document.querySelector(selector);
                const table = find('.ma-table');
                const auction = find('.ma-auction');
                const label = rect(find('.ma-auction__label'));
                const cards = [
                  ...document.querySelectorAll(
                    '.ma-auction__paintings > .ma-card',
                  ),
                ].map(rect);
                const theme = find('.ma-theme');
                const themeText = [];
                const walker = document.createTreeWalker(
                  theme,
                  NodeFilter.SHOW_TEXT,
                );
                while (walker.nextNode()) {
                  const node = walker.currentNode;
                  if (
                    !node.textContent.trim() ||
                    !node.parentElement.getClientRects().length
                  )
                    continue;
                  const range = document.createRange();
                  range.selectNodeContents(node);
                  const r = range.getBoundingClientRect();
                  themeText.push({
                    text: node.textContent.trim(),
                    x: r.x,
                    y: r.y,
                    right: r.right,
                    bottom: r.bottom,
                  });
                }
                return {
                  role: find('.ma-screen').className,
                  viewport: {
                    x: 0,
                    y: 0,
                    right: innerWidth,
                    bottom: innerHeight,
                  },
                  featured: table.classList.contains(
                    'ma-table--featured-auction',
                  ),
                  active: table.dataset.auctionActive,
                  activeIndicators: document.querySelectorAll(
                    '.ma-auction .ma-active, .ma-theme .ma-theme__current',
                  ).length,
                  activityMessage: theme.dataset.activityMessage,
                  tableRows: getComputedStyle(table).gridTemplateRows,
                  auctionRows: getComputedStyle(auction).gridTemplateRows,
                  market: rect(find('.ma-market')),
                  center: rect(find('.ma-center')),
                  auction: rect(auction),
                  museums: rect(find('.ma-museums')),
                  footer: rect(find('.ma-table-footer')),
                  label,
                  paintings: rect(find('.ma-auction__paintings')),
                  theme: rect(theme),
                  themeText,
                  participants: rect(find('.ma-auction__participants')),
                  countdown: rect(find('.ma-auction__countdown')),
                  cards,
                  labelToPainting:
                    Math.min(...cards.map((card) => card.y)) - label.bottom,
                  bodyOverflow:
                    Math.max(
                      document.documentElement.scrollWidth,
                      document.body.scrollWidth,
                    ) - innerWidth,
                  privateElements: document.querySelectorAll(
                    '.ma-player, .ma-wallet, #ma-bid-amount',
                  ).length,
                };
              });
              report.layouts.push({
                id,
                phase,
                role,
                scene,
                width,
                height,
                ...geometry,
              });
              if (width === 1280 || width === 3840) {
                await captureBrowserScreenshot(page, {
                  path: join(output, `${id}.png`),
                  fullPage: false,
                  animations: 'disabled',
                });
                report.screenshots.push({
                  id,
                  phase,
                  role,
                  scene,
                  width,
                  height,
                  ...(extraSnapshots
                    ? {
                        fixtureSha256: hash(
                          JSON.stringify(
                            extraSnapshots[scene.replace('-disconnected', '')][
                              role
                            ],
                          ),
                        ),
                      }
                    : {}),
                  path: join(output, `${id}.png`),
                });
              }
              if (phase === 'after') {
                if (inactiveOnly) {
                  assert.equal(
                    geometry.active,
                    undefined,
                    `${id}: inactive session has no active auction layout hook`,
                  );
                  assert.equal(
                    geometry.activeIndicators,
                    0,
                    `${id}: inactive session has no acting highlight`,
                  );
                  assert.equal(
                    geometry.activityMessage,
                    'true',
                    `${id}: inactive explanation replaces acting prompt`,
                  );
                  assert.equal(
                    geometry.privateElements,
                    0,
                    `${id}: no private controls`,
                  );
                  await save();
                  continue;
                }
                assert.equal(
                  geometry.active,
                  'true',
                  `${id}: active auction hook`,
                );
                assert.ok(
                  geometry.labelToPainting >= 15.9 &&
                    geometry.labelToPainting <= 24.1,
                  `${id}: title-to-painting gap ${geometry.labelToPainting}`,
                );
                assert.ok(
                  geometry.market.right <= geometry.center.x + 1,
                  `${id}: original left market and right auction`,
                );
                assert.ok(
                  Math.abs(geometry.market.y - geometry.center.y) <= 1,
                  `${id}: both original columns start together`,
                );
                assert.equal(
                  geometry.privateElements,
                  0,
                  `${id}: no private controls`,
                );
                assert.ok(
                  geometry.bodyOverflow <= 1,
                  `${id}: no horizontal overflow`,
                );
                for (const child of [
                  ...geometry.cards,
                  geometry.theme,
                  geometry.label,
                ])
                  assert.ok(
                    contains(geometry.auction, child),
                    `${id}: auction child contained`,
                  );
                for (const text of geometry.themeText)
                  assert.ok(
                    contains(geometry.theme, text),
                    `${id}: theme text remains inside its column: ${text.text}`,
                  );
                for (const card of geometry.cards)
                  assert.equal(
                    overlaps(card, geometry.theme),
                    false,
                    `${id}: lot and theme do not overlap`,
                  );
                for (const region of [
                  geometry.market,
                  geometry.auction,
                  geometry.museums,
                  geometry.footer,
                ])
                  assert.ok(
                    contains(geometry.viewport, region),
                    `${id}: main region fits viewport`,
                  );
                for (const [a, b] of [
                  [geometry.market, geometry.auction],
                  [geometry.auction, geometry.museums],
                  [geometry.auction, geometry.footer],
                  [geometry.museums, geometry.footer],
                ])
                  assert.equal(
                    overlaps(a, b),
                    false,
                    `${id}: main regions do not overlap`,
                  );
                if (geometry.cards.length > 1)
                  assert.equal(
                    overlaps(...geometry.cards),
                    false,
                    `${id}: paired cards do not overlap`,
                  );
                assert.equal(
                  Boolean(geometry.countdown),
                  extraOnly ||
                    fixedComparisonOnly ||
                    scene !== 'auction-double',
                  `${id}: auction-only progress bar`,
                );
              }
            } catch (error) {
              report.failures.push({ id, error: error.message });
            }
            await save();
          }
      await page.close();
    } finally {
      await server.close();
    }
  }
  assert.equal(report.pageErrors.length, 0, 'No browser runtime errors');
  report.result = report.failures.length ? 'failed' : 'passed';
} catch (error) {
  report.result = 'failed';
  report.failures.push({ id: 'setup-or-runtime', error: error.message });
} finally {
  await browser?.close();
  await save();
}
console.log(
  JSON.stringify({
    result: report.result,
    layouts: report.layouts.length,
    failures: report.failures,
    pending: report.pending.length,
    output,
  }),
);
if (report.result !== 'passed') process.exitCode = 1;
