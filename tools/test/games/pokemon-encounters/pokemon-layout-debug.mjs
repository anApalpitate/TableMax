import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { launchTestBrowser } from '../../support/browser-test.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';

process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const option = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const task = option('task');
const evidence = option('evidence');
const phase = option('phase') ?? 'after';
const only = option('only')?.split(',');
assert.match(task ?? '', /^tmp\/[a-z0-9][a-z0-9-]{1,90}$/);
assert.match(evidence ?? '', /^[a-z0-9][a-z0-9-]{1,70}$/);
assert(['before', 'after'].includes(phase));
const work = resolve(task, evidence);
const output = resolve('artifacts/maintenance', task.slice(4), evidence);
assert(!existsSync(output), `Evidence already exists: ${output}`);
await mkdir(output, { recursive: true });
await mkdir(work, { recursive: true });
await mkdir(resolve(task, 'browser-temp'), { recursive: true });
process.env.TEMP = process.env.TMP = resolve(task, 'browser-temp');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inputs = new Map();
const report = {
  result: 'running',
  phase,
  task,
  evidence,
  startedAt: new Date().toISOString(),
  boundaries: [
    'Real production React components and host feedback slots with validated rule fixtures in hidden, muted Edge on 127.0.0.1.',
    'Browser viewport / DPR simulation only; no installer, physical phone, native Windows DPI, network persistence or natural-game proof.',
  ],
  checks: [],
  screenshots: [],
  errors: [],
  inputs: [],
  verifier: {
    path: 'tools/test/games/pokemon-encounters/pokemon-layout-debug.mjs',
    sha256: hash(await readFile(new URL(import.meta.url))),
  },
  arguments: process.argv.slice(2),
};
const cases = [];
for (const variant of ['original', 'expansion']) {
  const add = (device, scene, extra = {}) =>
    cases.push({
      id: `${variant}-${device}-${scene}`,
      variant,
      device,
      scene,
      ...extra,
    });
  for (const scene of ['draw', 'initial', 'place', 'result'])
    add('host-1280', scene);
  add('host-1920', 'draw');
  add('host-4k', 'draw');
  for (const seats of [2, 3]) {
    for (const scene of ['draw', 'initial', 'place', 'result'])
      add('host-1280', `${seats}p-${scene}`, { scene, seats });
    for (const device of ['host-1920', 'host-4k'])
      add(device, `${seats}p-draw`, { scene: 'draw', seats });
  }
  for (const scene of [
    'draw',
    'initial',
    'place',
    'waiting',
    'paused',
    'result',
    'peek',
    'mew',
  ])
    add('portrait-360', scene);
  for (const scene of ['draw', 'place', 'friends']) add('portrait-390', scene);
  for (const scene of ['draw', 'place', 'friends', 'mew'])
    add('landscape', scene);
  add('wide-player', 'place');
  add('below-minimum', 'place');
  if (variant === 'expansion') {
    for (const device of ['host-1280', 'portrait-360', 'landscape'])
      add(device, 'vote');
    for (const scene of [
      'rocket',
      'lucario',
      'weather',
      'mew-target',
      'mewtwo-target',
      'buffer',
      'buffer-take',
    ])
      add('portrait-360', scene);
  } else {
    for (const device of ['portrait-360', 'landscape'])
      for (const scene of [
        'snorlax',
        'charizard',
        'rocket',
        'zapdos-self',
        'zapdos-receive',
        'mew-self',
      ])
        add(device, scene);
  }
  for (const seats of [4, 5])
    for (const scene of ['draw', 'result'])
      add('host-1280', `${seats}p-${scene}`, { scene, seats });
  for (const scene of ['draw', 'place', 'peek', 'mew'])
    add('landscape-min', scene);
  for (const scene of ['draw', 'result']) add('host-tall', scene);
  add('frame-boundary', 'place', { outerFrame: true });
  for (const device of [
    'host-below-width',
    'host-below-height',
    'portrait-below-width',
    'portrait-below-height',
    'landscape-below-width',
    'landscape-below-height',
  ])
    add(device, 'place', { belowMinimum: true });
  if (variant === 'expansion') {
    for (const scene of [
      'mew-target',
      'mewtwo-target',
      'mewtwo-private',
      'weather',
      'vote',
    ])
      add('landscape-min', scene);
    for (const device of ['host-1280', 'portrait-360'])
      add(device, 'mewtwo-private');
    for (const device of ['host-1280', 'portrait-360', 'landscape-min'])
      add(device, 'event-details');
    add('host-1280', 'event-coin');
  }
}
if (only)
  assert(
    only.every((id) => cases.some((c) => c.id === id)),
    'Unknown --only case',
  );
const selected = cases.filter((c) => !only || only.includes(c.id));
const sizes = {
  'host-1280': [1280, 720],
  'host-1920': [1920, 1080],
  'host-4k': [1920, 1080],
  'portrait-360': [360, 640],
  'portrait-390': [390, 844],
  landscape: [844, 390],
  'wide-player': [1280, 720],
  'below-minimum': [320, 568],
  'landscape-min': [640, 360],
  'host-tall': [1920, 1200],
  'frame-boundary': [799, 900],
  'host-below-width': [1279, 720],
  'host-below-height': [1280, 719],
  'portrait-below-width': [359, 640],
  'portrait-below-height': [360, 639],
  'landscape-below-width': [639, 360],
  'landscape-below-height': [640, 359],
};
let browser;
const servers = [];
try {
  for (const variant of ['original', 'expansion']) {
    if (!selected.some((c) => c.variant === variant)) continue;
    const root = join(work, variant);
    await mkdir(root);
    const fixture =
      variant === 'original' ? 'pokemon-polish-layout' : 'pokemon-ui-redesign';
    await writeFile(
      join(root, 'entry.tsx'),
      `import ${JSON.stringify(resolve(`tools/test/fixtures/${fixture}.tsx`))};`,
    );
    await writeFile(
      join(root, 'index.html'),
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
    );
    await build({
      configFile: false,
      root,
      plugins: [
        react(),
        {
          name: 'bind-layout-source',
          async load(id) {
            const path = id.split('?')[0];
            if (
              !path.includes('node_modules') &&
              existsSync(path) &&
              /\.(tsx?|css|json|mjs|webp|svg|png)$/.test(path)
            ) {
              const bytes = await readFile(path);
              inputs.set(path, {
                path: relative(resolve('.'), path).replaceAll('\\', '/'),
                sha256: hash(bytes),
                bytes: bytes.length,
              });
            }
            return null;
          },
        },
      ],
      resolve: {
        alias: {
          react: resolve('apps/web/node_modules/react'),
          'react-dom': resolve('apps/web/node_modules/react-dom'),
        },
      },
      build: {
        outDir: join(root, 'bundle'),
        emptyOutDir: false,
        target: 'chrome110',
      },
      logLevel: 'error',
    });
    const server = await serveFixture(join(root, 'bundle'));
    servers.push({ variant, ...server });
  }
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  let failed = 0;
  for (const item of selected) {
    if (failed >= 10) {
      report.checks.push({
        id: item.id,
        result: 'not-run',
        reason: '10 failures reached',
      });
      continue;
    }
    const [width, height] = sizes[item.device];
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: item.device === 'host-4k' ? 2 : 1,
      isMobile: false,
      hasTouch: !item.device.startsWith('host'),
    });
    const page = await context.newPage();
    let surface = page;
    page.on('pageerror', (error) =>
      report.errors.push({ id: item.id, error: error.message }),
    );
    const check = {
      ...item,
      viewport: { width, height },
      result: 'running',
      failures: [],
    };
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const fixtureServer = servers.find((s) => s.variant === item.variant);
      if (item.outerFrame) {
        const html = await readFile(
          join(work, item.variant, 'bundle/index.html'),
          'utf8',
        );
        await context.route('**/player/game?layout-child=1', (route) =>
          route.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: html,
          }),
        );
      }
      await page.goto(
        fixtureServer.url + (item.outerFrame ? '?layout-outer=1' : ''),
      );
      if (item.outerFrame) {
        await surface.locator('iframe').waitFor();
        surface = await (
          await page.locator('iframe').elementHandle()
        ).contentFrame();
        await surface.locator('main').waitFor();
      }
      await surface.waitForFunction(
        () => !!(window.setPokemonFixture || window.redesignShow),
      );
      const role = item.device.startsWith('host') ? 'host' : 'player';
      const scene = item.scene;
      const settings =
        item.variant === 'original'
          ? {
              seats: item.seats ?? 6,
              role,
              scene:
                {
                  result: 'round-result',
                  paused: 'draw',
                  friends: 'draw',
                  mew: 'mew-other',
                }[scene] ?? scene,
              paused: scene === 'paused',
              animate: false,
              longTargets: true,
            }
          : {
              seats: item.seats ?? 6,
              role,
              scenario:
                scene === 'vote'
                  ? 'vote'
                  : scene === 'result'
                    ? 'result'
                    : [
                          'place',
                          'peek',
                          'mew',
                          'rocket',
                          'lucario',
                          'weather',
                          'mew-target',
                          'mewtwo-target',
                          'mewtwo-private',
                          'event-details',
                          'event-coin',
                          'buffer',
                          'buffer-take',
                        ].includes(scene)
                      ? 'place'
                      : 'draw',
              initial: scene === 'initial',
              terminal: scene === 'result',
              ordinary: [
                'place',
                'result',
                'weather',
                'buffer',
                'buffer-take',
              ].includes(scene)
                ? '6'
                : undefined,
              creature: {
                peek: 'charizard',
                mew: 'mew',
                rocket: 'team-rocket',
                lucario: 'lucario',
                weather: 'kyogre',
                'mew-target': 'mew',
                'mewtwo-target': 'mewtwo',
                'mewtwo-private': 'mewtwo',
                'event-details': 'kyogre',
                'event-coin': 'team-rocket',
              }[scene],
              targetStage: ['mew-target', 'mewtwo-target'].includes(scene),
              privateStage: scene === 'mewtwo-private',
              event: ['weather', 'event-details', 'event-coin'].includes(scene)
                ? 'rain'
                : undefined,
              buffer:
                scene === 'buffer'
                  ? 'occupied'
                  : scene === 'buffer-take'
                    ? 'take'
                    : undefined,
              waiting: scene === 'waiting',
              paused: scene === 'paused',
              animate: false,
            };
      check.fixture = await surface.evaluate(
        ({ variant, settings }) =>
          variant === 'original'
            ? window.setPokemonFixture(settings)
            : window.redesignShow(settings),
        { variant: item.variant, settings },
      );
      await surface.waitForFunction(() =>
        Array.from(document.images).every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      );
      await surface.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      if (scene === 'event-details')
        await surface.locator('.ex-event-status summary').click();
      const measure = async () =>
        surface.evaluate(() => {
          const main = document.querySelector(
            'main.game-screen, main.expansion-screen',
          );
          const rect = (e) => {
            const r = e.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              bottom: r.bottom,
              right: r.right,
            };
          };
          const visible = (e) => {
            const closed = e.closest('details:not([open])');
            if (closed && !closed.querySelector('summary')?.contains(e))
              return false;
            return (
              e.getClientRects().length &&
              getComputedStyle(e).visibility !== 'hidden'
            );
          };
          const nameIssues = Array.from(
            main.querySelectorAll('.card-name-text, .ex-source-name'),
          )
            .filter(visible)
            .flatMap((e) => {
              const r = document.createRange();
              r.selectNodeContents(e);
              const box =
                e.closest('.pokemon-card')?.getBoundingClientRect() ??
                e.getBoundingClientRect();
              const style = getComputedStyle(e);
              return Array.from(r.getClientRects()).some(
                (v) =>
                  v.left < box.left - 1 ||
                  v.right > box.right + 1 ||
                  v.bottom > box.bottom + 1,
              ) || style.textOverflow === 'ellipsis'
                ? [e.textContent]
                : [];
            });
          const grids = Array.from(
            main.querySelectorAll('.game-seats, .ex-players'),
          )
            .filter(visible)
            .map((e) => ({
              ...rect(e),
              scroll: e.scrollHeight - e.clientHeight,
            }));
          const boards = Array.from(main.querySelectorAll('.pokemon-board'))
            .filter(visible)
            .map(rect);
          const boardCards = Array.from(
            main.querySelectorAll(
              '.game-seat .pokemon-board .pokemon-card, .ex-player .pokemon-board .pokemon-card',
            ),
          )
            .filter(visible)
            .map(rect);
          const controls = Array.from(
            main.querySelectorAll(
              '.confirm-action, .ex-submit > button, .ex-held-options > button',
            ),
          )
            .filter(visible)
            .map((e) => ({
              ...rect(e),
              text: e.textContent,
              font: parseFloat(getComputedStyle(e).fontSize),
            }));
          const cards = Array.from(
            main.querySelectorAll(
              '.card-piles .pokemon-card, .held-zone .pokemon-card, .ex-source .pokemon-card, .ex-public-piles .pokemon-card, .ex-public-held .pokemon-card, .ex-held > .pokemon-card',
            ),
          )
            .filter(visible)
            .map((e) => ({ ...rect(e), face: e.classList.contains('face') }));
          const diagnostics = Array.from(
            main.querySelectorAll(
              '.pile-display, .draw-pile, .decision-dashboard, .ex-round-banner, .ex-research-strip, .ex-buffer-card, .ex-table-layout, .ex-actions',
            ),
          ).map((e) => ({
            className: e.className,
            ...rect(e),
            display: getComputedStyle(e).display,
            children: Array.from(e.children).map((c) => ({
              className: c.className,
              ...rect(c),
              display: getComputedStyle(c).display,
            })),
          }));
          const targets = Array.from(
            main.querySelectorAll(
              'button.card-slot:not(:disabled), .target-tabs button, .ex-target-list button, .ex-research-summary, .ex-event-status summary, button.ex-event-status, .ex-event-status button, .ability-detail, .close-peek-action, .ex-private-peek button',
            ),
          )
            .filter(visible)
            .map((e) => {
              const r = e.getBoundingClientRect();
              const hit = document.elementFromPoint(
                r.x + r.width / 2,
                r.y + r.height / 2,
              );
              return {
                ...rect(e),
                name: e.getAttribute('aria-label') || e.textContent,
                className: e.className,
                hit: Boolean(hit && (e === hit || e.contains(hit))),
                horizontalChoice: Boolean(
                  e.closest('.target-tabs, .ex-target-list'),
                ),
              };
            });
          const information = Array.from(
            main.querySelectorAll(
              '.card-name, .card-name-text, .slot-index, .ex-source-name, .ex-research-summary strong, .ex-event-status',
            ),
          )
            .filter(visible)
            .map((e) => ({
              text: e.textContent,
              font: parseFloat(getComputedStyle(e).fontSize),
            }));
          const artwork = Array.from(
            main.querySelectorAll('.pokemon-board .pokemon-card.face > img'),
          )
            .filter(visible)
            .map((e) => ({
              ...rect(e),
              fit: getComputedStyle(e).objectFit,
              natural: [e.naturalWidth, e.naturalHeight],
              card: rect(e.closest('.pokemon-card')),
            }));
          return {
            viewport: {
              width: innerWidth,
              height: innerHeight,
              dpr: devicePixelRatio,
            },
            net: {
              width: main.dataset.netWidth,
              height: main.dataset.netHeight,
              layout: main.dataset.layout,
              belowMinimum: main.dataset.belowMinimum,
            },
            targets,
            information,
            artwork,
            eventDetails: Array.from(
              main.querySelectorAll('.ex-event-status details[open] > p'),
            )
              .filter(visible)
              .map(rect),
            privatePanels: Array.from(
              main.querySelectorAll('.private-peek, .ex-private-peek'),
            ).filter(visible).length,
            seatRects: Array.from(
              main.querySelectorAll(
                '.game-seats > .game-seat, .ex-players > .ex-player',
              ),
            )
              .filter(visible)
              .map(rect),
            diagnostics,
            rootOverflow: document.documentElement.scrollHeight - innerHeight,
            horizontalOverflow:
              document.documentElement.scrollWidth - innerWidth,
            main: rect(main),
            grids,
            boards,
            boardCards,
            cards,
            controls,
            nameIssues,
          };
        });
      check.geometry = await measure();
      if (scene === 'friends') {
        await surface.getByRole('button', { name: /朋友/ }).first().click();
        check.friends = await surface.locator('dialog[open]').evaluate((e) => ({
          width: e.getBoundingClientRect().width,
          count: e.querySelectorAll('.friend-board, .ex-player').length,
          overflow: e.scrollWidth - e.clientWidth,
        }));
      }
      const png = join(work, `${item.id}.png`);
      await captureBrowserScreenshot(page, {
        path: png,
        fullPage:
          phase === 'before' ||
          item.device === 'below-minimum' ||
          item.belowMinimum,
      });
      const bytes = await readFile(png);
      report.screenshots.push({
        id: item.id,
        path: relative(resolve('.'), png).replaceAll('\\', '/'),
        sha256: hash(bytes),
        bytes: bytes.length,
      });
      if (phase === 'after') {
        const expect = (condition, reason) => {
          if (!condition) check.failures.push(reason);
        };
        const g = check.geometry;
        const contentHeight = g.viewport.height;
        if (item.seats) {
          expect(g.boards.length === item.seats, 'Unexpected seat count');
        }
        if ([2, 3].includes(item.seats)) {
          expect(
            g.boardCards.every(
              (r) => Math.abs(r.height / r.width - 1.4) < 0.035,
            ),
            'Low-player cards stretched out of 5:7 proportion',
          );
        }
        expect(
          g.horizontalOverflow <= 1,
          `Horizontal overflow ${g.horizontalOverflow}`,
        );
        if (item.device !== 'below-minimum' && !item.belowMinimum) {
          expect(
            g.rootOverflow <= 1,
            `Page vertical overflow ${g.rootOverflow}`,
          );
          expect(
            g.grids.every((r) => r.scroll <= 1),
            'Main seats internally scroll',
          );
          expect(
            g.boards.every((r) => r.bottom <= contentHeight + 1 && r.y >= 0),
            'Board outside first screen',
          );
        }
        expect(
          !g.nameIssues.length,
          `Card names clipped: ${g.nameIssues.join(',')}`,
        );
        if (['weather', 'event-details', 'event-coin'].includes(scene)) {
          expect(
            await surface.locator('.ex-event-status').isVisible(),
            'Weather status missing',
          );
          expect(
            (await surface.locator('[data-score-effect="rain"]').count()) > 0,
            'Rain effective-value marker missing',
          );
        }
        if (scene === 'event-details') {
          expect(
            g.eventDetails.length === 1 &&
              g.eventDetails.every(
                (r) =>
                  r.x >= 0 &&
                  r.y >= 0 &&
                  r.right <= g.viewport.width &&
                  r.bottom <= contentHeight,
              ),
            'Opened event details are outside the game viewport',
          );
          await surface.locator('.ex-event-status summary').click();
          expect(
            await surface
              .locator('.ex-event-status details')
              .evaluate((e) => !e.open),
            'Event details cannot be closed',
          );
        }
        if (scene === 'event-coin')
          expect(
            (await surface.locator('.ex-coin-result').count()) > 0 &&
              (await surface.locator('.ex-research-summary').count()) > 0,
            'Combined event, coin and active research fixture is incomplete',
          );
        if (scene === 'buffer')
          expect(
            (await surface
              .locator('.ex-buffer-source .pokemon-card.face')
              .count()) > 0,
            'Occupied buffer not displayed',
          );
        if (scene === 'buffer-take')
          expect(
            (await surface.locator('.ex-held-options').count()) === 0,
            'Forced buffer placement offers discard/store',
          );
        if (item.device !== 'below-minimum' && !item.belowMinimum)
          expect(
            g.controls.every(
              (r) =>
                r.bottom <= contentHeight + 1 &&
                r.y >= 0 &&
                r.height >= 44 &&
                r.font >= 18,
            ),
            'Current confirmation/action is outside screen or below text/touch minimum',
          );
        expect(
          g.information.every((e) => e.font >= 16),
          'Information text below 16 CSS px',
        );
        if (item.variant === 'original' && role === 'player')
          expect(
            g.artwork.every(
              (r) =>
                r.height >= 32 &&
                r.fit === 'contain' &&
                r.natural.every((n) => n > 0),
            ),
            'Original player board artwork is squeezed below 32px or loses its contain fit',
          );
        if (item.device !== 'below-minimum' && !item.belowMinimum)
          expect(
            g.targets.every(
              (r) =>
                r.width >= 44 &&
                r.height >= 44 &&
                (r.hit || r.horizontalChoice),
            ),
            `Touch target below 44px or occluded: ${g.targets
              .filter((r) => r.width < 44 || r.height < 44 || !r.hit)
              .map((r) => r.name)
              .join(',')}`,
          );
        for (const target of g.targets.filter(
          (r) => !r.hit && r.horizontalChoice,
        )) {
          const choice = surface.getByRole('button', {
            name: target.name,
            exact: true,
          });
          await choice.scrollIntoViewIfNeeded();
          expect(
            await choice.evaluate((e) => {
              const r = e.getBoundingClientRect();
              const hit = document.elementFromPoint(
                r.x + r.width / 2,
                r.y + r.height / 2,
              );
              return (
                r.width >= 44 &&
                r.height >= 44 &&
                r.y >= 0 &&
                r.bottom <= innerHeight &&
                Boolean(hit && (e === hit || e.contains(hit)))
              );
            }),
            `Horizontally scrolled choice remains unreachable: ${target.name}`,
          );
        }
        if (role === 'player') {
          const privateScene = scene === 'peek' || scene === 'mewtwo-private';
          expect(
            g.boards.length === (scene === 'vote' || privateScene ? 0 : 1),
            `Expected one decision board (none during private view/vote), found ${g.boards.length}`,
          );
          if (privateScene)
            expect(
              g.privatePanels === 1,
              'Private view must have exactly one authorized panel',
            );
        } else expect(g.privatePanels === 0, 'Private panel leaked to manager');
        if (item.seats === 4) {
          const xs = new Set(g.seatRects.map((r) => Math.round(r.x)));
          const ys = new Set(g.seatRects.map((r) => Math.round(r.y)));
          expect(
            xs.size === 2 && ys.size === 2,
            'Four-seat layout must remain 2 by 2',
          );
        }
        if (item.seats === 5) {
          const ys = g.seatRects.map((r) => Math.round(r.y));
          expect(
            new Set(ys).size === 2 &&
              ys.filter((y) => y === Math.min(...ys)).length === 3,
            'Five-seat layout must retain three seats in its first row',
          );
        }
        if (item.belowMinimum) {
          expect(
            g.net.belowMinimum === 'true',
            'Below-minimum region is not identified',
          );
          expect(
            await surface.locator('.pokemon-layout-warning').isVisible(),
            'Below-minimum access warning missing',
          );
          const reachable = surface
            .locator(
              'button.card-slot:not(:disabled), .confirm-action, .ex-submit button',
            )
            .last();
          if (await reachable.count()) {
            await reachable.scrollIntoViewIfNeeded();
            expect(
              await reachable.evaluate((e) => {
                const r = e.getBoundingClientRect();
                const hit = document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                );
                return (
                  r.width >= 44 &&
                  r.height >= 44 &&
                  Boolean(hit && (hit === e || e.contains(hit)))
                );
              }),
              'Below-minimum action cannot be reached by scrolling',
            );
          }
        }
        if (item.outerFrame) {
          check.frameProbe = [];
          await surface.evaluate(() => {
            window.pilotDocumentToken = 'pokemon-pilot-stable-document';
          });
          const selected = surface
            .locator('button.card-slot:not(:disabled)')
            .first();
          await selected.click();
          for (const outerWidth of [799, 800, 801]) {
            await page.setViewportSize({ width: outerWidth, height: 900 });
            await page.waitForFunction((w) => innerWidth === w, outerWidth);
            await page.evaluate(
              () =>
                new Promise((done) =>
                  requestAnimationFrame(() => requestAnimationFrame(done)),
                ),
            );
            const toggle = page.locator('.player-frame__display');
            expect(
              (await toggle.count()) === (outerWidth >= 800 ? 1 : 0),
              'PlayerFrame legacy 800px mode gate changed',
            );
            expect(
              await surface.evaluate(
                () =>
                  window.pilotDocumentToken === 'pokemon-pilot-stable-document',
              ),
              'PlayerFrame replaced the game document',
            );
            expect(
              (await selected.getAttribute('aria-pressed')) === 'true',
              'PlayerFrame boundary lost selection draft',
            );
            check.frameProbe.push({
              outerWidth,
              outer: await page.evaluate(() => ({
                media: matchMedia('(min-width: 800px)').matches,
                mode: document.querySelector('.player-frame')?.dataset
                  .playerDisplay,
                contract:
                  document.querySelector('.player-frame')?.dataset
                    .workspaceLayout,
                childContract: document
                  .querySelector('iframe')
                  ?.contentDocument?.querySelector(
                    '[data-player-layout-contract]',
                  )
                  ?.getAttribute('data-player-layout-contract'),
              })),
              child: await measure(),
            });
          }
          await page.locator('.player-frame__display').click();
          expect(
            await surface.evaluate(
              () => document.documentElement.dataset.playerDisplay === 'wide',
            ),
            'Manual PlayerFrame wide mode did not reach child',
          );
          expect(
            (await selected.getAttribute('aria-pressed')) === 'true',
            'PlayerFrame manual switch lost selection draft',
          );
          expect(
            await surface.evaluate(
              () =>
                window.pilotDocumentToken === 'pokemon-pilot-stable-document',
            ),
            'Manual PlayerFrame switch replaced document',
          );
          check.frameWide = await measure();
        }
        expect(
          g.cards.every(
            (card) =>
              !g.cards.length ||
              (Math.abs(card.width - g.cards[0].width) <= 0.5 &&
                Math.abs(card.height - g.cards[0].height) <= 0.5),
          ),
          'Source / held front and back dimensions differ',
        );
        if (check.friends) {
          expect(check.friends.count === 5, 'Expected five friends');
          expect(check.friends.overflow <= 1, 'Friends horizontal overflow');
          if (width >= 700)
            expect(check.friends.width > 620, 'Friends dialog remains narrow');
          await page.keyboard.press('Escape');
          expect(
            (await surface.locator('dialog[open]').count()) === 0,
            'Friends Escape failed',
          );
          expect(
            await surface
              .getByRole('button', { name: /朋友/ })
              .first()
              .evaluate((e) => e === document.activeElement),
            'Friends focus not restored',
          );
        }
        if (scene === 'draw') {
          const update = async (next) =>
            page.evaluate(
              ({ variant, next }) =>
                variant === 'original'
                  ? window.updatePokemonSession(next)
                  : window.redesignUpdate(next),
              { variant: item.variant, next },
            );
          await update({ message: '已保存', messageKind: 'saved' });
          expect(
            (await surface.getByText('已保存', { exact: true }).count()) === 0,
            'Ordinary saved acknowledgement visible',
          );
          const changed = await measure();
          expect(
            JSON.stringify(g.boards) === JSON.stringify(changed.boards),
            'Saved message moved boards',
          );
          await update({ message: '保存失败，请重试', messageKind: 'error' });
          expect(
            await surface
              .getByText('保存失败，请重试', { exact: true })
              .isVisible(),
            'Save failure hidden',
          );
          await update({ message: '正在保存…', messageKind: null, busy: true });
          expect(
            await surface.getByText('正在保存…', { exact: true }).isVisible(),
            'Saving state hidden',
          );
          await update({ connected: false, message: '', messageKind: null });
          expect(
            await surface.locator('.session-feedback').isVisible(),
            'Disconnected feedback hidden',
          );
          await update({
            connected: true,
            message: '',
            busy: false,
            admissionPending: true,
            awaitingConfirmation: true,
          });
          expect(
            await surface
              .getByRole('button', { name: '重试入座确认', exact: true })
              .isVisible(),
            'Admission retry hidden',
          );
          expect(
            await surface
              .getByRole('button', { name: '重试确认', exact: true })
              .isVisible(),
            'Confirmation retry hidden',
          );
          await update({
            connected: true,
            message: '',
            messageKind: null,
            busy: false,
            admissionPending: false,
            awaitingConfirmation: false,
          });
          if (role === 'player' && item.device === 'portrait-360') {
            await surface
              .locator(
                item.variant === 'original'
                  ? '.draw-pile.deck-pile-control'
                  : '.ex-source[data-source="deck"]',
              )
              .click();
            const afterDraw = await measure();
            check.drawGeometry = afterDraw;
            expect(
              g.boards.length === afterDraw.boards.length &&
                g.boards.every((r, i) =>
                  ['x', 'y', 'width', 'height'].every(
                    (key) => Math.abs(r[key] - afterDraw.boards[i][key]) <= 1,
                  ),
                ),
              'Ordinary draw moved/resized main board',
            );
          }
        }
        if (
          role === 'player' &&
          scene === 'place' &&
          item.device === 'portrait-360'
        ) {
          const first = page.locator('button.card-slot:not(:disabled)').first();
          await first.click();
          expect(
            (await first.getAttribute('aria-pressed')) === 'true',
            'Card selection missing',
          );
          await page.setViewportSize({ width: 844, height: 390 });
          expect(
            (await first.getAttribute('aria-pressed')) === 'true',
            'Rotation lost selection draft',
          );
          await page.setViewportSize({ width, height });
          const confirm = surface
            .locator(
              item.variant === 'original'
                ? '.confirm-action'
                : '.ex-submit > button',
            )
            .first();
          await confirm.click();
          const count = await surface.evaluate(
            (variant) =>
              variant === 'original'
                ? window.pokemonCommands.length
                : window.redesignCommands.length,
            item.variant,
          );
          expect(count === 1, 'Expected one legal confirmed command');
        }
        check.result = check.failures.length ? 'failed' : 'passed';
      } else check.result = 'observed';
    } catch (error) {
      check.result = 'failed';
      check.failures.push(error.stack ?? String(error));
    }
    if (check.result === 'failed') failed++;
    report.checks.push(check);
    console.log(
      `${check.result} ${item.id}${check.failures.length ? ': ' + check.failures.join('; ').slice(0, 900) : ''}`,
    );
    await context.close();
  }
  report.result = failed || report.errors.length ? 'failed' : 'passed';
} catch (error) {
  report.result = 'failed';
  report.errors.push(error.stack ?? String(error));
} finally {
  await browser?.close();
  for (const server of servers) await server.close();
  for (const [path, input] of inputs)
    assert.equal(
      hash(await readFile(path)),
      input.sha256,
      `Input changed: ${path}`,
    );
  report.inputs = Array.from(inputs.values());
  report.finishedAt = new Date().toISOString();
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    result: report.result,
    checks: report.checks.length,
    failures: report.checks.filter((c) => c.result === 'failed').length,
    output,
  }),
);
if (report.result !== 'passed') process.exitCode = 1;
