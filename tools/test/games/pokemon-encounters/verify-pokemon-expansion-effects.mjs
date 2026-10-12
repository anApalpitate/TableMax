import {
  extractCurrentDelivery,
  materializePokemonClients,
} from '../../support/shipping-input.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';

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
let manifest, extracted, shipping;
if (portable) {
  shipping = await extractCurrentDelivery({ work });
  ({ manifest, extracted } = shipping);
}
const started = performance.now();
const report = {
  result: 'running',
  scope:
    'Hidden real Edge renders rule-validated constructed inputs and actual legal rule transitions: 13 skeleton timelines (59 poses), one simplified Lucario portrait/aura sequence, six event themes and original Charizard/Snorlax entrances. Component playback evidence is separate from saved server authority and artistic approval. No physical phone, human listening or hardware DPI claim.',
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
  simplifiedSequences: [],
  events: [],
  originalEntrances: [],
};
await writeFile(
  join(work, 'entry.tsx'),
  `import ${JSON.stringify(resolve('tools/test/fixtures/pokemon-expansion-effects.tsx'))};`,
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
                  .endsWith(
                    '/tools/test/fixtures/pokemon-expansion-effects.tsx',
                  )
              )
                return;
              if (source === '../../../games/pokemon-encounters/expansion/web')
                return '\0actual-packaged-expansion';
              if (source === '../../../games/pokemon-encounters/web')
                return '\0actual-packaged-original';
              if (
                source === '../../../packages/web-host/src' ||
                source === '../../../packages/web-host/src/platform'
              )
                return { id: '/runtime/v1/web-host.js', external: true };
              if (source === '../../../apps/web/src/styles.css')
                return '\0actual-packaged-css';
            },
            load(id) {
              if (id === '\0actual-packaged-expansion')
                return "import { clientsByVariant } from '/games/pokemon-encounters/web/entry.js'; export const client = clientsByVariant.expansion;";
              if (id === '\0actual-packaged-original')
                return "import { clientsByVariant } from '/games/pokemon-encounters/web/entry.js'; export const client = clientsByVariant.original;";
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
  report.binding = shipping.binding;
  await shipping.assertUnchanged();
  await cp(join(extracted, 'web'), join(work, 'bundle'), {
    recursive: true,
    filter: (path) => path !== join(extracted, 'web/index.html'),
  });
  const game = await materializePokemonClients(
    shipping,
    work,
    join(work, 'bundle'),
  );
  report.releaseIds = game.releaseIds;
  const styles =
    manifest.files
      .filter(
        (file) =>
          file.path.endsWith('.css') &&
          (file.path.startsWith('web/assets/') ||
            file.path.startsWith('web/runtime/v1/') ||
            file.path.startsWith('web/games/pokemon-encounters/')),
      )
      .map((file) => `<link rel="stylesheet" href="/${file.path.slice(4)}">`)
      .join('') +
    game.styles
      .map((href) => `<link rel="stylesheet" href="${href}">`)
      .join('');
  const html = join(work, 'bundle/index.html');
  await writeFile(
    html,
    (await readFile(html, 'utf8')).replace('</head>', `${styles}</head>`),
  );
  report.scope =
    'Actual final EXE clients, shared React/WebHost runtime, CSS and media are extracted and hash-checked, then rendered in hidden real Edge with rule-validated constructed fixtures. Current requirements cover 59 skeleton poses plus one Lucario portrait/aura sequence, six saved event playback themes and original Charizard/Snorlax entrances. Native service, save/recovery authority and production controls are tested separately on this same EXE. Technical playback is not artistic approval; no physical-phone, listening or hardware-DPI claim.';
}
await writeFile(
  join(work, 'bundle/avatars.json'),
  JSON.stringify(
    Object.fromEntries(
      (manifest?.files ?? []).flatMap((file) => {
        const match = file.path.match(/^web\/assets\/(avatar-\d+)-.+\.webp$/);
        return match ? [[match[1], '/' + file.path.slice(4)]] : [];
      }),
    ),
  ),
);
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
  const creatures = sample
    ? ['mewtwo']
    : Object.keys(timelines).filter((creature) => creature !== 'lucario');
  const screenshot = async (label) => {
    const path = join(output, `${label}.png`);
    await captureBrowserScreenshot(page, { path, fullPage: false });
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
    assert.equal(report.poseFrames.length, 59);
    assert.equal(report.sequences.length, 13);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() =>
      window.expansionShow({ creature: 'lucario', role: 'host' }),
    );
    const lucario = page.locator('[data-sequence="lucario"]');
    await lucario.waitFor({ state: 'attached' });
    const portrait = lucario.locator('.ex-aura-portrait');
    await portrait.evaluate((image) => image.decode());
    assert.equal(
      await lucario.locator('svg[data-creature]').count(),
      0,
      'Lucario uses the adopted portrait and code aura rather than the retired skeleton',
    );
    assert.equal(
      await lucario.locator('.ex-aura-ring,.ex-aura-pulse').count(),
      2,
    );
    const simplified = await portrait.evaluate((image) => ({
      src: image.currentSrc,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }));
    assert.ok(simplified.width > 0 && simplified.height > 0);
    await screenshot('playing-lucario-portrait-aura');
    await lucario.waitFor({ state: 'detached' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() =>
      window.expansionShow({ creature: 'lucario', role: 'host' }),
    );
    await page.waitForFunction(
      () => {
        const hero = document.querySelector('.ex-static-hero');
        return hero && getComputedStyle(hero).display !== 'none';
      },
      undefined,
      { polling: 'raf' },
    );
    assert.equal(await page.locator('.ex-static-hero').isVisible(), true);
    assert.equal(
      await page.locator('[data-sequence="lucario"]').isVisible(),
      false,
    );
    await screenshot('lucario-reduced-static-portrait');
    await page.locator('.ex-static-hero').waitFor({ state: 'detached' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() =>
      window.expansionShow({ creature: 'lucario', role: 'host' }),
    );
    await page.locator('[data-sequence="lucario"]').waitFor();
    await page.evaluate(() => window.expansionReenter());
    assert.equal(await page.locator('[data-sequence="lucario"]').count(), 0);
    report.simplifiedSequences.push({
      creature: 'lucario',
      representation: 'existing portrait + code aura',
      oldSkeletonPoses: 0,
      ...simplified,
      reducedMotion: 'static portrait',
      cleanup: true,
      reentryDoesNotReplay: true,
    });
    assert.equal(report.simplifiedSequences.length, 1);
    const environmentBackgrounds = new Map();
    for (const kind of [
      'mega',
      'rain',
      'sandstorm',
      'sun',
      'snow',
      'trick-room',
    ]) {
      for (const role of ['host', 'public', 'player']) {
        await page.setViewportSize(
          role === 'player'
            ? { width: 390, height: 844 }
            : { width: 1280, height: 720 },
        );
        const saved = await page.evaluate(
          ({ event, role }) => window.expansionShow({ event, role }),
          { event: kind, role },
        );
        assert.equal(saved.currentEvent.kind, kind);
        const announced = saved.events.filter(
          (event) => event.kind === 'special-event',
        );
        assert.equal(
          announced.length,
          1,
          'A rule transaction announces the event once',
        );
        assert.equal(announced[0].effect.eventKind, kind);
        assert.equal(announced[0].effect.placeholder, kind === 'mega');
        assert.ok(
          saved.events.findIndex((event) => event.kind === 'special-event') <
            saved.events.findIndex((event) => event.action?.verb === 'draw'),
        );
        const entrance = page.locator(`[data-event-entrance="${kind}"]`);
        await entrance.waitFor({ state: 'attached' });
        const geometry = await entrance.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            rect: [bounds.x, bounds.y, bounds.width, bounds.height],
            viewport: [
              document.documentElement.getBoundingClientRect().width,
              innerHeight,
            ],
            pointerEvents: getComputedStyle(element).pointerEvents,
          };
        });
        assert.deepEqual(geometry.rect, [0, 0, ...geometry.viewport]);
        assert.equal(geometry.pointerEvents, 'none');
        const environment = page.locator(`[data-event-environment="${kind}"]`);
        assert.equal(await environment.count(), 1);
        const background = await environment
          .locator('.ex-environment-wallpaper')
          .evaluate((element) => getComputedStyle(element).backgroundImage);
        const drift = await environment
          .locator('.ex-environment-drift')
          .evaluate((element) => ({
            animation: getComputedStyle(element).animationName,
            pointerEvents: getComputedStyle(element).pointerEvents,
          }));
        assert.equal(drift.pointerEvents, 'none');
        if (role === 'host') environmentBackgrounds.set(kind, background);
        const badges = await page
          .locator('[data-score-effect]')
          .evaluateAll((elements) =>
            elements.map((element) => ({
              kind: element.dataset.scoreEffect,
              value: Number(element.dataset.effectiveValue),
              source: element.getAttribute('aria-label'),
              background: getComputedStyle(element.closest('.card-value'))
                .backgroundColor,
              slot: element.closest('[data-slot]')?.getAttribute('data-slot'),
            })),
          );
        for (const badge of badges) {
          const authoritative = Object.values(saved.boards)
            .flat()
            .find((slot) => slot.slotId === badge.slot)?.card;
          if (badge.kind === 'trick-room') {
            assert.notEqual(
              authoritative.originalCategoryId,
              authoritative.categoryId,
            );
            assert.ok(badge.source.includes('戏法空间'));
          } else assert.equal(badge.kind, authoritative.scoreEffect.kind);
          assert.equal(badge.value, authoritative.effectiveValue);
          if (kind === 'rain')
            assert.equal(badge.background, 'rgb(215, 237, 249)');
        }
        if (['rain', 'sandstorm', 'sun', 'snow'].includes(kind)) {
          assert.ok(badges.length > 0);
          assert.ok(
            badges.some((badge) => badge.source.includes('复制继承')),
            'A fully authorized copy inherits the weather source',
          );
        }
        if (kind === 'mega') {
          assert.equal(saved.currentEvent.placeholder, true);
          assert.deepEqual(
            saved.boards,
            saved.beforeBoards,
            'Mega theme placeholder cannot change card effects or values',
          );
          assert.equal(saved.overrideCount, 0);
          assert.equal(badges.length, 0);
          assert.match(await entrance.innerText(), /效果待设计/);
        }
        if (kind === 'trick-room') assert.ok(saved.overrideCount > 0);
        await screenshot(`event-${kind}-${role}`);
        await entrance.waitFor({ state: 'detached' });
        const trace = await page.evaluate(() =>
          window.expansionSceneTrace.filter((scene) => scene.kind === 'event'),
        );
        assert.equal(trace.length, 1, 'Actual event playback starts once');
        await page.evaluate(() => window.expansionReenter());
        assert.equal(
          await page.locator('[data-event-entrance]').count(),
          0,
          'Reentry never replays a committed event',
        );
        assert.equal(
          await page.locator(`[data-event-environment="${kind}"]`).count(),
          1,
          'Environment survives reentry',
        );
        report.events.push({
          kind,
          role,
          input: 'validated constructed post-protection boundary',
          savedEvent: announced[0],
          geometry,
          background,
          drift,
          badges,
          starts: trace.length,
          reentryDoesNotReplay: true,
        });
      }
    }
    assert.equal(environmentBackgrounds.size, 6);
    assert.equal(
      new Set(environmentBackgrounds.values()).size,
      6,
      'Each event has a distinct persistent background',
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() =>
      window.expansionShow({ event: 'rain', role: 'host' }),
    );
    await page.locator('[data-event-entrance="rain"]').waitFor();
    assert.equal(
      await page
        .locator('.ex-environment-drift')
        .evaluate((element) => getComputedStyle(element).display),
      'none',
    );
    assert.equal(
      await page
        .locator('.ex-event-announcement')
        .evaluate((element) => getComputedStyle(element).animationName),
      'none',
    );
    await screenshot('event-rain-reduced-static');
    await page.locator('[data-event-entrance]').waitFor({ state: 'detached' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() =>
      window.expansionShow({ event: 'rain', creature: 'mewtwo', role: 'host' }),
    );
    await page.locator('[data-event-entrance="rain"]').waitFor();
    assert.equal(
      await page.locator('[data-sequence="mewtwo"]').count(),
      0,
      "The event starts before the same draw's native ability",
    );
    await page.locator('[data-sequence="mewtwo"]').waitFor();
    const following = await page.evaluate(() =>
      window.expansionSceneTrace.filter(
        (scene) => scene.kind === 'event' || scene.kind === 'ability',
      ),
    );
    assert.equal(following[0].kind, 'event');
    assert.equal(following[1].kind, 'ability');
    assert.ok(following[1].at - following[0].at >= 1400);
    report.events.push({
      kind: 'rain',
      nativeAbility: 'mewtwo',
      order: following,
    });
    for (const creature of ['charizard', 'snorlax']) {
      await page.setViewportSize({ width: 1280, height: 720 });
      const saved = await page.evaluate(
        (creature) => window.originalShow(creature),
        creature,
      );
      assert.ok(
        saved.actions.some(
          (action) =>
            action.type === (creature === 'charizard' ? 'peek' : 'swap'),
        ),
      );
      assert.equal(saved.events.at(-1).action.ability, `special-${creature}`);
      const entrance = page.locator(
        `.anime-entrance[data-scene="${creature}"]`,
      );
      await entrance.waitFor();
      assert.equal(
        await entrance.evaluate(
          (element) => getComputedStyle(element).pointerEvents,
        ),
        'none',
      );
      const fullscreen = await entrance.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          rect: [rect.x, rect.y, rect.width, rect.height],
          viewport: [
            document.documentElement.getBoundingClientRect().width,
            innerHeight,
          ],
        };
      });
      assert.deepEqual(fullscreen.rect, [0, 0, ...fullscreen.viewport]);
      assert.ok(await entrance.locator('.cut-in-character').count());
      await screenshot(`original-${creature}-fullscreen`);
      assert.equal(
        await page.locator('.saved-action-trails').count(),
        1,
        'Original local action feedback remains mounted alongside the entrance',
      );
      await page.evaluate(() => window.originalClear());
      assert.equal(
        await page.locator(`.anime-entrance[data-scene="${creature}"]`).count(),
        0,
      );
      report.originalEntrances.push({
        creature,
        ruleSource: 'games/pokemon-encounters/rules',
        actions: saved.actions,
        event: saved.events.at(-1),
        fullscreen,
        cleared: true,
        localFeedbackPreserved: true,
      });
    }
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
    await page.waitForFunction(
      () => {
        const hero = document.querySelector('.ex-static-hero');
        return hero && getComputedStyle(hero).display !== 'none';
      },
      undefined,
      { polling: 'raf' },
    );
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
    assert.equal(
      terminal.events.some((event) => event.kind === 'research'),
      false,
    );
    assert.ok(
      terminal.events.some((event) => event.kind === 'bond-placeholder'),
    );
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
    await page
      .locator('[data-sequence="groudon"]')
      .waitFor({ state: 'hidden' });
    const abilityEndedAt = Date.now() - began;
    await page.locator('.ex-victory').waitFor();
    const resultAt = Date.now() - began;
    assert.ok(resultAt >= abilityEndedAt - 100);
    assert.equal(await page.locator('.ex-research-reveal').count(), 0);
    await screenshot('last-ability-bond-before-settlement');
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
      abilityEndedAt,
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
  await shipping?.assertUnchanged();
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
      simplifiedSequences: report.simplifiedSequences.length,
      events: report.events.length,
      originalEntrances: report.originalEntrances.length,
      elapsedMs: report.elapsedMs,
    }),
  );
}
