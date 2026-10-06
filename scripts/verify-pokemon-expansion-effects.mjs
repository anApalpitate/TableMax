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
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const output = resolve(
  `artifacts/maintenance/v${version}/pokemon-expansion-effects`,
  name,
);
await mkdir(resolve(output, '..'), { recursive: true });
await mkdir(output, { recursive: false });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/pokemon-expansion-effects-'));
let manifest, extracted;
if (portable) {
  manifest = JSON.parse(
    await readFile(
      `artifacts/releases/TableMax-${version}-win-x64-manifest.json`,
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
    'Headless real Edge renders the production expansion Screen, rule-validated state and actual legal rule transitions; 14 vector skeleton timelines and ordinary themes. Component fixture is separately bound to frozen source; final ZIP runtime/authority is verified by the portable and normal-play checks. No physical phone, human listening or hardware DPI claim.',
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
  `import ${JSON.stringify(resolve('scripts/fixtures/pokemon-expansion-effects.tsx'))};`,
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
                  .endsWith('/scripts/fixtures/pokemon-expansion-effects.tsx')
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
    'Actual final ZIP client, shared React/WebHost runtime, CSS and media are extracted and hash-checked, then rendered in real hidden Edge using rule-valid component fixtures. All 63 poses are observed from the packaged Screen. Native service, saved authority and ordinary production controls are separately tested on this same ZIP. No physical-phone, listening or hardware-DPI claim.';
}
const server = await serveFixture(join(work, 'bundle'));
let browser;
try {
  browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
    soundEnabled: args.includes('--sound'),
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) =>
    report.pageErrors.push(error.stack ?? error.message),
  );
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
  await page.goto(server.url);
  await page.waitForFunction(() => typeof window.expansionShow === 'function');
  const timelines = await page.evaluate(() => window.expansionTimelines);
  const creatures = sample ? ['mewtwo'] : Object.keys(timelines);
  const screenshot = async (label) => {
    const path = join(output, `${label}.png`);
    await page.screenshot({ path, fullPage: false });
    report.screenshots.push({ label, path });
  };
  for (const creature of creatures) {
    const timeline = timelines[creature];
    await page.setViewportSize({
      width: Math.max(1280, timeline.poseNames.length * 246 + 40),
      height: 370,
    });
    await page.evaluate((id) => window.expansionGallery(id), creature);
    const frames = await page
      .locator('svg[data-creature]')
      .evaluateAll((svgs) =>
        svgs.map((svg) => {
          const box = svg.getBBox();
          return {
            creature: svg.dataset.creature,
            pose: svg.dataset.pose,
            source: svg.dataset.poseSource,
            joints: [...svg.querySelectorAll('[data-joint]')].map((joint) => [
              joint.getAttribute('data-joint'),
              joint.getAttribute('transform'),
            ]),
            bbox: { x: box.x, y: box.y, width: box.width, height: box.height },
          };
        }),
      );
    assert.equal(frames.length, timeline.poseNames.length);
    assert.deepEqual(
      frames.map((frame) => frame.pose),
      timeline.poseNames,
    );
    assert.equal(
      new Set(frames.map((frame) => JSON.stringify(frame.joints))).size,
      frames.length,
      `${creature} must have real different body joints in every key pose`,
    );
    for (const frame of frames) {
      assert.equal(frame.source, 'layered-svg-skeleton');
      assert.ok(frame.joints.length >= 3);
      assert.ok(frame.bbox.width > 50 && frame.bbox.height > 50);
    }
    report.poseFrames.push(...frames);
    await screenshot(`poses-${creature}`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate((id) => {
      window.poseTrace = [];
      window.expansionShow({ creature: id, role: 'host' });
      const start = performance.now(),
        duration = window.expansionTimelines[id].durationMs;
      let first = null;
      const trace = () => {
        const svg = document.querySelector(
          '[data-sequence] svg[data-creature]',
        );
        if (svg) {
          first ??= performance.now();
          window.poseTrace.push({
            elapsed: performance.now() - start,
            pose: svg.dataset.pose,
            index: Number(svg.dataset.poseIndex),
            joints: [...svg.querySelectorAll('[data-joint]')]
              .map((joint) => joint.getAttribute('transform'))
              .join('|'),
          });
        }
        if (
          performance.now() - (first ?? start) <
          (first ? duration + 100 : 10000)
        )
          requestAnimationFrame(trace);
      };
      requestAnimationFrame(trace);
    }, creature);
    await page
      .locator(`[data-sequence="${creature}"]`)
      .waitFor({ state: 'attached' });
    await page.waitForTimeout(Math.floor(timeline.durationMs * 0.52));
    await screenshot(`playing-${creature}`);
    await page.waitForTimeout(Math.ceil(timeline.durationMs * 0.48) + 180);
    const trace = await page.evaluate(() => window.poseTrace);
    assert.deepEqual(
      [...new Set(trace.map((frame) => frame.pose))],
      timeline.poseNames,
      `${creature}: all poses must be observed during actual playback`,
    );
    assert.ok(
      new Set(trace.map((frame) => frame.joints)).size >
        timeline.poseNames.length,
    );
    report.sequences.push({
      creature,
      durationMs: timeline.durationMs,
      observed: [...new Set(trace.map((frame) => frame.pose))],
      samples: trace.length,
      distinctBodySamples: new Set(trace.map((frame) => frame.joints)).size,
    });
  }
  if (!sample) {
    assert.equal(report.poseFrames.length, 63);
    assert.equal(report.sequences.length, 14);
    for (const theme of [
      'togepi',
      'magikarp',
      'piplup',
      'rowlet',
      'psyduck',
      'garchomp',
      'gardevoir',
      'dragonite',
      'metagross',
      'mimikyu',
    ]) {
      await page.evaluate(
        (ordinary) => window.expansionShow({ ordinary, role: 'player' }),
        theme,
      );
      await page.waitForTimeout(100);
      const observation = await page
        .locator('[data-ordinary-theme]')
        .evaluate((svg) => ({
          theme: svg.dataset.ordinaryTheme,
          duration: getComputedStyle(svg).animationDuration,
          opacity: Number(getComputedStyle(svg).opacity),
          pointerEvents: getComputedStyle(svg).pointerEvents,
          visible: getComputedStyle(svg).visibility,
          geometry: svg.innerHTML,
        }));
      assert.equal(observation.theme, theme);
      assert.equal(observation.duration, '0.32s');
      assert.ok(observation.opacity > 0.8);
      assert.equal(observation.pointerEvents, 'none');
      assert.equal(observation.visible, 'visible');
      report.ordinary.push(observation);
      await screenshot(`ordinary-${theme}`);
    }
    assert.equal(
      new Set(report.ordinary.map((item) => item.geometry)).size,
      10,
      'Every ordinary theme needs its own visible geometry',
    );
    await page.evaluate(() =>
      window.expansionShow({ creature: 'charizard', role: 'public' }),
    );
    assert.equal(await page.locator('.ex-private-peek').count(), 0);
    await page.evaluate(() =>
      window.expansionShow({ creature: 'charizard', role: 'player' }),
    );
    assert.ok((await page.locator('.ex-private-peek').count()) > 0);
    await page.evaluate(() =>
      window.expansionShow({ creature: 'mewtwo', paused: true }),
    );
    assert.equal(await page.locator('[data-sequence]').count(), 0);
    await page.evaluate(() =>
      window.expansionShow({ creature: 'mewtwo', connected: false }),
    );
    assert.equal(await page.locator('[data-sequence]').count(), 0);
    await page.evaluate(() =>
      window.expansionShow({ creature: 'mewtwo', animate: false, branch: 1 }),
    );
    assert.equal(await page.locator('[data-sequence]').count(), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => window.expansionShow({ creature: 'mewtwo' }));
    await page.locator('.ex-static-hero').waitFor();
    assert.equal(await page.locator('.anime-entrance').isVisible(), false);
    assert.equal(await page.locator('.ex-static-hero').isVisible(), true);
    report.cancellation.push(
      'public private-peek isolation',
      'pause',
      'disconnect',
      'restored branch without new saved events',
      'reduced-motion static hero',
    );
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => window.expansionShow({ creature: 'mewtwo' }));
    await page.locator('[data-sequence="mewtwo"]').waitFor();
    await page.evaluate(() => window.expansionReenter());
    assert.equal(await page.locator('[data-sequence]').count(), 0);
    report.cancellation.push('fast reentry ignores the previous saved receipt');
    const terminal = await page.evaluate(() =>
      window.expansionShow({ creature: 'groudon', terminal: true }),
    );
    assert.ok(['round-result', 'match-result'].includes(terminal.phase));
    assert.ok(terminal.events.some((event) => event.kind === 'research'));
    const began = Date.now();
    await page.locator('[data-sequence="groudon"]').waitFor();
    const starsBeforeResult = await page
      .locator('.ex-player .win-pips .earned')
      .count();
    assert.equal(
      await page.locator('.ex-player .win-track[aria-label*="赢家"]').count(),
      0,
    );
    assert.equal(await page.locator('.ex-victory').isVisible(), false);
    await page.locator('.ex-research-reveal').waitFor({ state: 'attached' });
    const researchAt = Date.now() - began;
    assert.equal(await page.locator('.ex-victory').isVisible(), false);
    await screenshot('last-ability-research-before-settlement');
    await page.locator('.ex-victory').waitFor();
    const resultAt = Date.now() - began;
    assert.ok(resultAt >= researchAt + 2300);
    assert.ok(await page.locator('.ex-victory h2').isVisible());
    const winnerCount = await page.locator('.ex-player.winner').count();
    assert.ok(winnerCount > 0);
    assert.equal(
      await page.locator('.ex-player .win-pips .earned').count(),
      starsBeforeResult + winnerCount,
    );
    report.cancellation.push({
      terminal: terminal.phase,
      order: terminal.events.map((event) => event.kind),
      researchAt,
      resultAt,
      starsBeforeResult,
      winnerCount,
    });
    for (const [role, width, height, scale] of [
      ['host', 1280, 720, 1],
      ['public', 1920, 1080, 1],
      ['host', 3840, 2160, 1],
      ['host', 1024, 576, 1.25],
      ['public', 854, 480, 1.5],
      ['player', 320, 568, 1],
      ['player', 360, 640, 1],
      ['player', 390, 844, 1],
      ['player', 430, 932, 1],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(
        (role) =>
          window.expansionShow({ creature: 'mewtwo', role, animate: false }),
        role,
      );
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: scale,
        mobile: role === 'player',
      });
      await page.waitForTimeout(100);
      const geometry = await page.evaluate(() => {
        const shown = (el) => {
          const rect = el.getBoundingClientRect();
          return (
            rect.width &&
            rect.height &&
            getComputedStyle(el).visibility !== 'hidden' &&
            getComputedStyle(el).display !== 'none'
          );
        };
        const slots = [
          ...document.querySelectorAll('.ex-player [data-slot]'),
        ].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            outside:
              r.left < -1 ||
              r.top < -1 ||
              r.right > innerWidth + 1 ||
              r.bottom > innerHeight + 1,
          };
        });
        const tiny = [...document.querySelectorAll('.expansion-screen *')]
          .filter(
            (el) =>
              shown(el) &&
              [...el.childNodes].some(
                (node) =>
                  node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
              ) &&
              parseFloat(getComputedStyle(el).fontSize) < 16,
          )
          .map((el) => el.textContent.trim());
        return {
          width: innerWidth,
          height: innerHeight,
          overflow: document.documentElement.scrollWidth > innerWidth,
          slots: slots.length,
          outside: slots.filter((slot) => slot.outside).length,
          tiny,
        };
      });
      assert.equal(geometry.overflow, false);
      assert.deepEqual(geometry.tiny, []);
      if (role !== 'player') {
        assert.equal(geometry.slots, 54);
        const unreachable = [];
        if (geometry.outside) {
          for (const slot of await page
            .locator('.ex-player [data-slot]')
            .all()) {
            await slot.scrollIntoViewIfNeeded();
            const reachable = await slot.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.left >= -1 &&
                r.top >= -1 &&
                r.right <= innerWidth + 1 &&
                r.bottom <= innerHeight + 1
              );
            });
            if (!reachable)
              unreachable.push(await slot.getAttribute('data-slot'));
          }
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        geometry.scrollUnreachable = unreachable;
        assert.deepEqual(
          unreachable,
          [],
          'All 54 cards must remain reachable by real one-axis scrolling',
        );
      }
      report.display.push({ role, width, height, scale, ...geometry });
      await screenshot(`display-${role}-${width}-${height}-${scale}`);
      if (role === 'player') {
        await page.evaluate(() =>
          window.expansionShow({ creature: 'mewtwo', role: 'player' }),
        );
        await page.waitForTimeout(800);
        const overlay = await page.locator('.anime-entrance').evaluate((el) => {
          const bounds = el.getBoundingClientRect();
          return {
            inside:
              bounds.left >= 0 &&
              bounds.top >= 0 &&
              bounds.right <= innerWidth &&
              bounds.bottom <= innerHeight,
            pointerEvents: getComputedStyle(el).pointerEvents,
            playersAudioSlots: document.querySelectorAll('audio').length,
          };
        });
        assert.equal(overlay.inside, true);
        assert.equal(overlay.pointerEvents, 'none');
        assert.equal(overlay.playersAudioSlots, 0);
        await screenshot(`motion-player-${width}`);
        report.display.push({ role, width, height, scale, motion: overlay });
        await page.evaluate(() =>
          window.expansionShow({
            creature: 'charizard',
            role: 'player',
            animate: false,
          }),
        );
        const finish = page.getByRole('button', {
          name: '查看完成',
          exact: true,
        });
        await finish.scrollIntoViewIfNeeded();
        assert.equal(await finish.isEnabled(), true);
        await screenshot(`action-player-${width}`);
        await finish.click();
        const commands = await page.evaluate(() => window.expansionCommands);
        assert.equal(commands.length, 1);
        assert.equal(commands[0].action, 'close-peek');
        report.display.push({
          role,
          width,
          height,
          scale,
          legalComponentIntent: commands,
        });
      }
      await cdp.detach();
    }
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.externalRequests, []);
  report.sourceAfter = await inputHashes();
  assert.deepEqual(
    report.sourceAfter,
    report.sourceBefore,
    'Verification source must stay frozen',
  );
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  throw error;
} finally {
  await browser?.close();
  await server.close();
  report.elapsedMs = performance.now() - started;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      output,
      sample,
      frames: report.poseFrames.length,
      sequences: report.sequences.length,
      elapsedMs: report.elapsedMs,
    }),
  );
}
