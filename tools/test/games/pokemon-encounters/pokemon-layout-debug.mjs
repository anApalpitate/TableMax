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
import { auditOverlayLayout } from './overlay-layout-audit.mjs';

process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const option = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const task = option('task');
const evidence = option('evidence');
const phase = option('phase') ?? 'after';
const only = option('only')?.split(',');
const cinematicCapture = option('cinematic-capture') === 'true';
const contrastAudit = option('contrast-audit') === 'true';
// Inspect actual inherited text colors on solid/light-gradient surfaces. Image
// backgrounds are reported as unmeasured rather than guessed from CSS alone.
async function auditLightText(surface, variant) {
  return surface.evaluate((variant) => {
    const rgb = (value) => value.match(/[\d.]+/g)?.map(Number) ?? [];
    const luminance = (c) =>
      c.slice(0, 3).reduce((sum, n, i) => {
        const v = n / 255;
        return (
          sum +
          (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) *
            [0.2126, 0.7152, 0.0722][i]
        );
      }, 0);
    const samples = [],
      unmeasured = [];
    for (const el of document.querySelectorAll(
      'main.expansion-screen *, main.pokemon-screen *, .dialog-surface *',
    )) {
      const text = [...el.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim())
        .filter(Boolean)
        .join(' ');
      if (
        !text ||
        !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) ||
        el.closest('[disabled], [aria-hidden="true"]')
      )
        continue;
      const foreground = rgb(getComputedStyle(el).color);
      if (
        variant !== 'original' &&
        luminance(foreground) < 0.45 &&
        !el.matches('.ex-paused, .ex-wait, .ex-coin-result strong')
      )
        continue;
      let background = null,
        layer = [0, 0, 0, 0];
      for (let parent = el; parent; parent = parent.parentElement) {
        // The arena paints its full viewport on ::before, above the pale body.
        // Do not mistake that underlying body for a transparent panel's surface.
        const style = parent.matches('main.expansion-screen')
          ? getComputedStyle(parent, '::before')
          : getComputedStyle(parent);
        if (style.backgroundImage !== 'none') {
          const stops = [
            ...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g),
          ].map((m) => rgb(m[0]));
          if (
            style.backgroundImage.includes('url(') ||
            !stops.length ||
            stops.some((c) => (c[3] ?? 1) < 1)
          )
            break;
          background = stops.reduce((a, b) =>
            luminance(a) < luminance(b) ? a : b,
          );
          break;
        }
        const color = rgb(style.backgroundColor),
          alpha = color[3] ?? 1;
        const a = layer[3] + alpha * (1 - layer[3]);
        if (a)
          layer = [0, 1, 2]
            .map(
              (i) =>
                (layer[i] * layer[3] + color[i] * alpha * (1 - layer[3])) / a,
            )
            .concat(a);
        if (a >= 0.999) {
          background = layer;
          break;
        }
      }
      const selector =
        el.tagName.toLowerCase() +
        (el.classList.length ? '.' + [...el.classList].join('.') : '');
      if (!background) {
        unmeasured.push({ selector, text: text.slice(0, 100) });
        continue;
      }
      if (luminance(background) < 0.5) continue;
      const a = luminance(foreground),
        b = luminance(background);
      samples.push({
        selector,
        parent: el.parentElement.className,
        text: text.slice(0, 160),
        foreground,
        background,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      });
    }
    return {
      samples,
      issues: samples.filter(
        (row) =>
          row.ratio < 4.5 &&
          (variant !== 'original' || luminance(row.foreground) >= 0.45),
      ),
      unmeasured,
    };
  }, variant);
}
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
  videos: [],
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
  const add = (device, scene, extra = {}) => {
    if (cases.some((item) => item.id === `${variant}-${device}-${scene}`))
      return;
    cases.push({
      id: `${variant}-${device}-${scene}`,
      variant,
      device,
      scene,
      ...extra,
    });
  };
  for (const scene of ['draw', 'initial', 'place', 'result'])
    add('host-1280', scene);
  add('host-1920', 'draw');
  add('host-4k', 'draw');
  for (const device of ['host-1280', 'portrait-390', 'landscape'])
    add(device, 'zapdos-entrance', { scene: 'zapdos-self', entrance: true });
  if (variant === 'expansion') {
    for (const creature of [
      'mewtwo',
      'mew',
      'arceus',
      'groudon',
      'kyogre',
      'rayquaza',
      'greninja',
      'team-rocket',
    ])
      add('landscape', `${creature}-entrance`, {
        scene: 'cinematic',
        creature,
        entrance: true,
      });
  }
  if (variant === 'original') {
    for (const device of ['host-1280', 'portrait-390', 'landscape'])
      for (const scene of ['menu', 'rules', 'paused']) add(device, scene);
    for (const device of ['portrait-390', 'landscape']) add(device, 'history');
    for (const device of ['host-1280', 'portrait-390', 'landscape'])
      add(device, 'trajectory-isolation');
    add('host-1280', 'zapdos-self');
    add('host-1920', 'zapdos-receive');
  }
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
    add('portrait-390', scene);
  for (const scene of ['draw', 'place', 'friends']) add('portrait-390', scene);
  for (const scene of [
    'draw',
    'place',
    'friends',
    'mew',
    'initial',
    'waiting',
    'result',
  ])
    add('landscape', scene);
  for (const scene of ['draw', 'place']) add('portrait-probe', scene);
  if (variant === 'expansion') {
    for (const device of ['host-1280', 'portrait-390', 'landscape'])
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
      add('portrait-390', scene);
  } else {
    for (const device of ['portrait-390', 'landscape'])
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
  for (const scene of ['draw', 'place', 'peek', 'mew']) add('landscape', scene);
  for (const scene of ['draw', 'place', 'waiting'])
    add('landscape-1920', scene);
  if (variant === 'expansion')
    for (const scene of ['buffer', 'buffer-take', 'rocket', 'lucario'])
      add('landscape', scene);
  for (const scene of ['draw', 'result']) add('host-tall', scene);
  add('frame-boundary', 'place', { outerFrame: true });
  for (const device of ['host-below-width', 'host-below-height'])
    add(device, 'place', { belowMinimum: true });
  if (variant === 'expansion') {
    for (const scene of [
      'mew-target',
      'mewtwo-target',
      'mewtwo-private',
      'weather',
      'vote',
    ])
      add('landscape', scene);
    for (const device of ['host-1280', 'portrait-390'])
      add(device, 'mewtwo-private');
    for (const device of ['host-1280', 'portrait-390', 'landscape'])
      add(device, 'event-details');
    add('host-1280', 'event-coin');
    for (const device of ['portrait-390', 'landscape'])
      add(device, 'overlay-layout');
    add('host-1280', 'paused');
    add('landscape', 'paused');
    for (const device of ['host-1280', 'portrait-390', 'landscape'])
      for (const scene of [
        'menu',
        'rules',
        'score-details',
        'research-details',
      ])
        add(device, scene);
    for (const device of ['host-1280', 'portrait-390', 'landscape'])
      for (const scene of ['trajectory-own', 'trajectory-other'])
        add(device, scene);
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
  'portrait-probe': [360, 800],
  'portrait-390': [390, 844],
  landscape: [1280, 720],
  'landscape-1920': [1920, 1080],
  'host-tall': [1920, 1200],
  'frame-boundary': [799, 900],
  'host-below-width': [1279, 720],
  'host-below-height': [1280, 719],
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
      ...(cinematicCapture && item.entrance
        ? { recordVideo: { dir: work, size: { width, height } } }
        : {}),
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
                  menu: 'draw',
                  rules: 'draw',
                  history: 'place',
                  mew: 'mew-other',
                  'trajectory-isolation': 'draw',
                }[scene] ?? scene,
              paused: scene === 'paused',
              animate: false,
              longTargets: true,
            }
          : {
              seats: item.seats ?? 6,
              role,
              scenario: ['vote', 'research-details'].includes(scene)
                ? 'vote'
                : ['result', 'score-details'].includes(scene)
                  ? 'result'
                  : [
                        'cinematic',
                        'trajectory-own',
                        'trajectory-other',
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
                        'zapdos-self',
                      ].includes(scene)
                    ? 'place'
                    : 'draw',
              initial: scene === 'initial',
              terminal: ['result', 'score-details'].includes(scene),
              ordinary: scene.startsWith('trajectory-')
                ? 'piplup'
                : [
                      'place',
                      'result',
                      'score-details',
                      'weather',
                      'buffer',
                      'buffer-take',
                    ].includes(scene)
                  ? '6'
                  : undefined,
              creature:
                item.creature ??
                {
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
                  'zapdos-self': 'zapdos',
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
              waiting: scene === 'waiting' || scene === 'trajectory-other',
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
      await surface.evaluate(() =>
        Promise.all(Array.from(document.images, (image) => image.decode())),
      );
      await surface.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      if (scene === 'event-details')
        await surface.locator('.ex-event-status summary').click();
      const openAuditPanel = async () => {
        if (item.variant === 'original') {
          if (scene === 'menu') await surface.locator('.toolbar-menu').click();
          if (scene === 'rules')
            await surface
              .getByRole('button', { name: '规则', exact: true })
              .click();
          if (scene === 'history')
            await surface.locator('.toolbar-history').click();
          return;
        }
        if (scene === 'menu') await surface.locator('.ex-menu-entry').click();
        if (scene === 'rules')
          await surface
            .getByRole('button', { name: '规则', exact: true })
            .click();
        if (scene === 'score-details')
          await surface.locator('.ex-score').first().click();
        if (scene === 'research-details')
          await surface
            .locator('.ex-mission-option .secondary')
            .first()
            .click();
      };
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
            .map((e) => {
              const container = e.parentElement;
              const style = getComputedStyle(container);
              return {
                ...rect(e),
                containerWidth:
                  container.clientWidth -
                  parseFloat(style.paddingLeft) -
                  parseFloat(style.paddingRight),
              };
            });
          const progress = Array.from(
            main.querySelectorAll('.decision-progress .progress-segment'),
          )
            .filter(visible)
            .map((e) => {
              const label = e.querySelector('.progress-label');
              const glyphs = document.createRange();
              glyphs.selectNodeContents(label);
              return {
                ...rect(e),
                label: label.textContent.trim(),
                font: parseFloat(getComputedStyle(label).fontSize),
                textOverflow: getComputedStyle(e).textOverflow,
                glyphs: Array.from(glyphs.getClientRects()).map((r) => ({
                  x: r.x,
                  y: r.y,
                  right: r.right,
                  bottom: r.bottom,
                })),
              };
            });
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
            .map((e) => ({
              ...rect(e),
              face: e.classList.contains('face'),
              presentation: e.closest('[data-layout="L"] .ex-buffer-source')
                ? 'buffer-thumbnail'
                : 'decision-card',
            }));
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
            progress,
            boardCards,
            cards,
            controls,
            nameIssues,
          };
        });
      check.geometry = await measure();
      await openAuditPanel();
      if (scene === 'friends') {
        await surface.getByRole('button', { name: /朋友/ }).first().click();
        check.friends = await surface.locator('dialog[open]').evaluate((e) => ({
          width: e.getBoundingClientRect().width,
          count: e.querySelectorAll('.friend-board, .ex-player').length,
          overflow: e.scrollWidth - e.clientWidth,
        }));
      }
      const png = join(work, `${item.id}.png`);
      if (contrastAudit)
        check.lightText = await auditLightText(surface, item.variant);
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
      if (item.entrance) {
        if (item.variant === 'expansion')
          assert.ok(
            check.fixture.events.some(
              (event) => event.effect?.entrance === (item.creature ?? 'zapdos'),
            ),
            'Expansion fixture must save the requested legal ability entrance',
          );
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await surface.evaluate(
          ({ variant, settings }) =>
            variant === 'original'
              ? window.setPokemonFixture({ ...settings, animate: true })
              : window.redesignShow({ ...settings, animate: true }),
          { variant: item.variant, settings },
        );
        await surface.locator('.anime-entrance').waitFor({ state: 'visible' });
        check.entranceGeometry = await surface
          .locator('.anime-entrance')
          .evaluate((e) => {
            for (const animation of e.getAnimations({ subtree: true })) {
              animation.pause();
              const duration = animation.effect.getTiming().duration;
              if (typeof duration === 'number')
                animation.currentTime = duration * 0.45;
            }
            const rect = (element) => {
              const r = element.getBoundingClientRect();
              return {
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
                right: r.right,
                bottom: r.bottom,
              };
            };
            const style = getComputedStyle(e);
            return {
              scene: e.dataset.scene,
              viewport: { width: innerWidth, height: innerHeight },
              surface: rect(e),
              energy: rect(e.querySelector('.entrance-energy-field')),
              banner: rect(e.querySelector('.anime-cut-in')),
              safeTop: parseFloat(style.getPropertyValue('--entrance-top')),
              safeHeight: parseFloat(
                style.getPropertyValue('--entrance-height'),
              ),
              pointerEvents: style.pointerEvents,
            };
          });
        const entrancePng = join(work, `${item.id}-effect.png`);
        await captureBrowserScreenshot(page, { path: entrancePng });
        const entranceBytes = await readFile(entrancePng);
        report.screenshots.push({
          id: `${item.id}-effect`,
          path: relative(resolve('.'), entrancePng).replaceAll('\\', '/'),
          sha256: hash(entranceBytes),
          bytes: entranceBytes.length,
        });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        check.entranceReducedMotionHidden = !(await surface
          .locator('.anime-entrance')
          .isVisible());
        await surface.evaluate(
          ({ variant, settings }) =>
            variant === 'original'
              ? window.setPokemonFixture(settings)
              : window.redesignShow(settings),
          { variant: item.variant, settings },
        );
        check.entranceStaticSyncCount = await surface
          .locator('.anime-entrance')
          .count();
      }
      if (item.variant === 'original' && scene === 'trajectory-isolation') {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        check.trajectorySequence = [];
        for (const [label, action] of [
          ['own-draw', { type: 'draw', source: 'deck' }],
          ['own-discard', { type: 'discard-held' }],
          ['other-draw', { type: 'draw', source: 'deck' }],
          ['other-discard', { type: 'discard-held' }],
        ]) {
          await surface.evaluate(
            (action) => window.applyPokemonSavedAction(action),
            action,
          );
          await surface.evaluate(
            () =>
              new Promise((done) =>
                requestAnimationFrame(() => requestAnimationFrame(done)),
              ),
          );
          const observed = await surface.evaluate(() => ({
            paths: document.querySelectorAll(
              '.saved-action-trails .saved-trail',
            ).length,
            impacts: document.querySelectorAll(
              '.saved-action-trails .target-impact, .saved-action-trails .draw-motif, .saved-action-trails .discarded-landing',
            ).length,
          }));
          check.trajectorySequence.push({ label, ...observed });
          const path = join(work, `${item.id}-${label}.png`);
          await captureBrowserScreenshot(page, { path });
          const bytes = await readFile(path);
          report.screenshots.push({
            id: `${item.id}-${label}`,
            path: relative(resolve('.'), path).replaceAll('\\', '/'),
            sha256: hash(bytes),
            bytes: bytes.length,
          });
        }
        await surface.evaluate(() =>
          window.updatePokemonSession({ animate: false }),
        );
        check.restoredTrails = await surface
          .locator('.saved-action-trails')
          .count();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await surface.evaluate(() =>
          window.updatePokemonSession({ animate: true }),
        );
        check.reducedForeignImpacts = await surface
          .locator('.saved-action-trails .discarded-landing')
          .count();
        await surface.evaluate(() =>
          window.updatePokemonSession({ animate: false }),
        );
      }
      if (phase === 'after') {
        const expect = (condition, reason) => {
          if (!condition) check.failures.push(reason);
        };
        const g = check.geometry;
        if (item.variant === 'original' && scene === 'trajectory-isolation') {
          for (const row of check.trajectorySequence) {
            const shouldPlay =
              role !== 'player' || row.label.startsWith('own-');
            expect(
              shouldPlay
                ? row.label.endsWith('draw')
                  ? row.paths + row.impacts > 0
                  : row.paths > 0
                : row.paths === 0 && row.impacts === 0,
              `Original ${row.label}: local trajectories must match the viewer`,
            );
          }
          expect(
            check.restoredTrails === 0,
            'Restored original snapshots must not replay trails',
          );
          expect(
            role === 'player'
              ? check.reducedForeignImpacts === 0
              : check.reducedForeignImpacts > 0,
            'Reduced-motion discard landing must respect player ownership while preserving host feedback',
          );
        }
        if (item.variant === 'expansion' && scene.startsWith('trajectory-')) {
          check.trajectory = await surface.evaluate(async (settings) => {
            const observed = new Set();
            const sample = () => {
              document
                .querySelectorAll(
                  '.ex-board-transfer, .ex-ordinary-burst, .ex-discard-landing',
                )
                .forEach((element) =>
                  observed.add(
                    element.classList[0] +
                      ':' +
                      (element.getAttribute('data-from') ?? '') +
                      ':' +
                      (element.getAttribute('data-to') ?? ''),
                  ),
                );
            };
            const observer = new MutationObserver(sample);
            observer.observe(document.body, { subtree: true, childList: true });
            const result = window.redesignShow({ ...settings, animate: true });
            sample();
            await new Promise((done) => setTimeout(done, 900));
            observer.disconnect();
            return { observed: [...observed], events: result.events };
          }, settings);
          const shouldPlay = role !== 'player' || scene === 'trajectory-own';
          expect(
            shouldPlay
              ? check.trajectory.observed.some((entry) =>
                  entry.startsWith('ex-board-transfer:'),
                ) &&
                  check.trajectory.observed.some((entry) =>
                    entry.startsWith('ex-ordinary-burst:'),
                  )
              : check.trajectory.observed.length === 0,
            'Local trajectories/bursts must belong to the player; host must retain all public playback',
          );
          await surface.evaluate(
            (settings) => window.redesignShow({ ...settings, animate: false }),
            settings,
          );
          expect(
            (await surface
              .locator('.ex-board-effects, .ex-ordinary-burst')
              .count()) === 0,
            'Restored snapshots must not replay trajectories',
          );
        }
        const contentHeight = g.viewport.height;
        if (
          item.device.startsWith('landscape') &&
          ['draw', 'place'].includes(scene)
        ) {
          const desk = await surface.evaluate(() => {
            const panel = document.querySelector('.player-decision-workbench');
            if (!panel) return null;
            const rect = panel.getBoundingClientRect();
            const sources = [
              ...panel.querySelectorAll('.draw-pile, .ex-source'),
            ]
              .filter((e) => e.getClientRects().length)
              .map((e) => e.getBoundingClientRect());
            const card = panel
              .querySelector(
                '.draw-pile .pokemon-card, .ex-source .pokemon-card, .held-pile .pokemon-card, .ex-held > .pokemon-card',
              )
              ?.getBoundingClientRect();
            return {
              height: rect.height,
              withinViewport:
                rect.top >= 0 &&
                rect.bottom <= innerHeight &&
                rect.right <= innerWidth,
              sourcesContained: sources.every(
                (r) =>
                  r.width >= 44 &&
                  r.height >= 44 &&
                  r.left >= rect.left &&
                  r.right <= rect.right &&
                  r.bottom <= rect.bottom,
              ),
              cardWidth: card?.width ?? 0,
            };
          });
          expect(
            desk?.withinViewport && desk.height >= 500,
            'Desktop decision workbench is absent, clipped or undersized',
          );
          expect(
            desk?.sourcesContained,
            'Desktop source controls escape their decision workbench',
          );
          expect(
            desk?.cardWidth >= (item.variant === 'original' ? 128 : 100),
            'Desktop decision cards still use compact phone sizing',
          );
        }
        if (
          item.device === 'landscape' &&
          scene === 'result' &&
          item.variant === 'original'
        ) {
          const separated = await surface.evaluate(() => {
            const board = document
              .querySelector('.game-seat > .pokemon-board')
              ?.getBoundingClientRect();
            const score = document
              .querySelector('.score-detail')
              ?.getBoundingClientRect();
            return board && score && score.top >= board.bottom;
          });
          expect(separated, 'Score detail overlaps desktop result field');
        }
        if (
          item.device === 'landscape' &&
          ['draw', 'place', 'waiting'].includes(scene)
        ) {
          expect(
            g.boards.every(
              (r) =>
                r.width >= (item.variant === 'original' ? 600 : 440) &&
                r.height >= 450,
            ),
            'Desktop field does not use its available space',
          );
          if (scene === 'place') {
            const decision = await surface.evaluate(() => {
              const source = document
                .querySelector('.decision-dashboard, .ex-decision-context')
                ?.getBoundingClientRect();
              const footer = document
                .querySelector('.player-action-bar, .ex-decision-footer')
                ?.getBoundingClientRect();
              return source && footer ? footer.top - source.bottom : null;
            });
            expect(
              decision !== null && decision >= 0 && decision <= 100,
              'Confirmation detached from current decision',
            );
          }
        }
        if (item.entrance) {
          const effect = check.entranceGeometry;
          expect(
            effect.scene === (item.creature ?? 'zapdos'),
            'Expected requested saved ability entrance',
          );
          if (item.device === 'landscape') {
            expect(
              effect.banner.height >= effect.viewport.height * 0.3,
              'Landscape entrance collapsed into a thin strip',
            );
            expect(
              effect.banner.y + effect.banner.height / 2 >=
                effect.viewport.height * 0.3 &&
                effect.banner.y + effect.banner.height / 2 <=
                  effect.viewport.height * 0.7,
              'Landscape entrance is not in the central screen region',
            );
          }
          for (const [name, r] of [
            ['surface', effect.surface],
            ['energy', effect.energy],
          ])
            expect(
              Math.abs(r.x) <= 1 &&
                Math.abs(r.y) <= 1 &&
                Math.abs(r.width - effect.viewport.width) <= 1 &&
                Math.abs(r.height - effect.viewport.height) <= 1,
              `Ability ${name} does not fill the complete viewport`,
            );
          expect(
            effect.banner.y >= effect.safeTop - 1 &&
              effect.banner.bottom <= effect.safeTop + effect.safeHeight + 1 &&
              effect.banner.y >= 0 &&
              effect.banner.bottom <= effect.viewport.height + 1,
            'Character banner leaves its independent safe region',
          );
          expect(
            effect.pointerEvents === 'none',
            'Decorative entrance intercepts actions',
          );
          expect(
            check.entranceReducedMotionHidden &&
              check.entranceStaticSyncCount === 0,
            'Reduced motion or static synchronization replays an entrance',
          );
        }
        if (item.variant === 'original' && role === 'host') {
          if (scene.startsWith('zapdos'))
            expect(
              g.progress.length === (item.seats ?? 6) &&
                g.progress[0].label.endsWith('自己换入') &&
                g.progress
                  .at(-1)
                  .label.endsWith(`传牌 ${(item.seats ?? 6) - 1}`),
              'Legal Zapdos manager projection lost a relay step',
            );
          expect(
            g.progress.every(
              (step) =>
                step.font >= 16 &&
                step.textOverflow !== 'ellipsis' &&
                step.glyphs.length > 0 &&
                step.glyphs.every(
                  (glyph) =>
                    glyph.x >= step.x - 1 &&
                    glyph.right <= step.right + 1 &&
                    glyph.y >= step.y - 1 &&
                    glyph.bottom <= step.bottom + 1,
                ),
            ),
            'Manager progress glyphs are clipped or replaced by ellipsis',
          );
        }
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
        if (item.device === 'portrait-390') {
          expect(
            g.boards.every((r) => r.width >= r.containerWidth * 0.9),
            'Portrait board uses less than 90% of its available container width',
          );
          if (scene === 'waiting')
            expect(
              g.boards.length > 0 &&
                g.boards.every(
                  (r) => r.y + r.height / 2 >= contentHeight / 2 - 1,
                ),
              'Waiting board remains concentrated above the viewport center',
            );
        }
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
          const desktopPeek =
            item.variant === 'original' &&
            item.device.startsWith('landscape') &&
            scene === 'peek';
          expect(
            g.boards.length ===
              (['vote', 'research-details'].includes(scene) ||
              (privateScene && !desktopPeek)
                ? 0
                : 1),
            `Unexpected authorized field count: ${g.boards.length}`,
          );
          if (desktopPeek) {
            expect(
              await surface.evaluate(() => {
                const slot = Number(
                  document
                    .querySelector('.peek-caption')
                    ?.textContent.match(/位置\s*(\d+)/)?.[1],
                );
                const card = document.querySelectorAll(
                  '.player-field .card-slot',
                )[slot - 1];
                return (
                  Boolean(card?.querySelector('.pokemon-card.back')) &&
                  document.querySelectorAll(
                    '.player-field button.card-slot:not(:disabled)',
                  ).length === 0 &&
                  document.querySelectorAll(
                    '.player-decision-workbench .private-peek',
                  ).length === 1
                );
              }),
              'Private peek must keep the original field masked and read-only',
            );
          }
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
          g.cards.every((card) => {
            // The desktop buffer is a labelled thumbnail, not a full source tile.
            // Preserve equal front/back sizes within each presentation contract.
            const peer = g.cards.find(
              (c) => c.presentation === card.presentation,
            );
            return (
              Math.abs(card.width - peer.width) <= 0.5 &&
              Math.abs(card.height - peer.height) <= 0.5 &&
              (card.presentation !== 'buffer-thumbnail' ||
                (card.width >= 44 &&
                  Math.abs(card.width / card.height - 5 / 7) < 0.02))
            );
          }),
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
          if (role === 'player' && item.device === 'portrait-390') {
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
          ['portrait-390', 'landscape'].includes(item.device)
        ) {
          const first = page.locator('button.card-slot:not(:disabled)').first();
          await first.click();
          expect(
            (await first.getAttribute('aria-pressed')) === 'true',
            'Card selection missing',
          );
          await page.setViewportSize(
            item.device === 'landscape'
              ? { width: 390, height: 844 }
              : { width: 1280, height: 720 },
          );
          expect(
            (await first.getAttribute('aria-pressed')) === 'true',
            'Portrait/desktop layout switch lost selection draft',
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
        if (cinematicCapture && item.entrance && item.variant === 'expansion') {
          // A second fresh saved transaction plays at real speed for video review.
          // No CSS seeking, synthetic poses or rendering replacement in this run.
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          await surface.evaluate(
            (settings) => window.redesignShow({ ...settings, animate: true }),
            settings,
          );
          await surface.locator('.ex-cinematic').waitFor({ state: 'visible' });
          await surface.locator('.ex-cinematic').waitFor({ state: 'detached' });
          check.liveCinematicCompleted = true;
        }
        if (item.variant === 'expansion' && scene === 'vote') {
          const probeResearchText = () =>
            surface.evaluate(() => {
              const rgb = (value) => value.match(/[\d.]+/g)?.map(Number) ?? [];
              const luminance = (color) =>
                color.slice(0, 3).reduce((sum, c, i) => {
                  const v = c / 255;
                  return (
                    sum +
                    (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) *
                      [0.2126, 0.7152, 0.0722][i]
                  );
                }, 0);
              return [
                ...document.querySelectorAll(
                  '.expansion-screen .ex-research-title b, .expansion-screen .ex-research-card h3, .expansion-screen .ex-research-copy p, .expansion-screen .ex-research-risk, .expansion-screen .ex-research-diagram figcaption, .expansion-screen .ex-diagram-notes, .expansion-screen .ex-diagram-roles',
                ),
              ]
                .filter(
                  (el) =>
                    el.getClientRects().length &&
                    getComputedStyle(el).visibility !== 'hidden',
                )
                .map((el) => {
                  const foreground = rgb(getComputedStyle(el).color);
                  let background;
                  for (let parent = el; parent; parent = parent.parentElement) {
                    const candidate = rgb(
                      getComputedStyle(parent).backgroundColor,
                    );
                    if (candidate.length === 3 || candidate[3] === 1) {
                      background = candidate;
                      break;
                    }
                  }
                  if (!background)
                    throw Error(
                      'Research text lacks a measurable opaque background',
                    );
                  const a = luminance(foreground),
                    b = luminance(background);
                  return {
                    text: el.textContent.trim(),
                    className: el.className,
                    color: foreground,
                    background,
                    ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
                  };
                });
            });
          check.researchContrast = await probeResearchText();
          await surface
            .locator('.ex-mission-option .secondary')
            .first()
            .click();
          await surface
            .locator('.ex-research-detail')
            .waitFor({ state: 'visible' });
          check.researchDetailContrast = await probeResearchText();
          expect(
            check.researchDetailContrast.length > 0,
            'Research detail contrast coverage missing',
          );
          expect(
            [...check.researchContrast, ...check.researchDetailContrast].every(
              (row) => row.ratio >= 4.5,
            ),
            'Research copy/reward/risk/diagram text contrast below 4.5:1',
          );
          const detailPng = join(work, `${item.id}-research-detail.png`);
          await captureBrowserScreenshot(page, { path: detailPng });
          const detailBytes = await readFile(detailPng);
          report.screenshots.push({
            id: `${item.id}-research-detail`,
            path: relative(resolve('.'), detailPng).replaceAll('\\', '/'),
            sha256: hash(detailBytes),
            bytes: detailBytes.length,
          });
        }
        if (contrastAudit) {
          check.lightTextAfterInteraction = await auditLightText(
            surface,
            item.variant,
          );
          expect(
            check.lightText.issues.length === 0 &&
              check.lightTextAfterInteraction.issues.length === 0,
            'Light text on light surfaces: ' +
              JSON.stringify([
                ...check.lightText.issues,
                ...check.lightTextAfterInteraction.issues,
              ]),
          );
        }
        if (item.variant === 'expansion' && scene === 'overlay-layout') {
          check.overlayLayout = await auditOverlayLayout(
            page,
            surface,
            work,
            item.device,
            report,
            option('overlay-kinds')?.split(','),
          );
          expect(
            check.overlayLayout.every(
              (c) =>
                c.changes.length === 0 &&
                c.blocked.length === 0 &&
                c.restored === 0 &&
                c.overlays.length > 0,
            ),
            'Overlay changed base content or intercepted input: ' +
              JSON.stringify(
                check.overlayLayout.filter(
                  (c) =>
                    c.changes.length ||
                    c.blocked.length ||
                    c.restored ||
                    !c.overlays.length,
                ),
              ),
          );
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
    if (cinematicCapture && item.entrance) {
      const path = join(work, `${item.id}-live.webm`);
      await page.video().saveAs(path);
      await page.video().delete();
      const bytes = await readFile(path);
      report.videos.push({
        id: item.id,
        path: relative(resolve('.'), path).replaceAll('\\', '/'),
        bytes: bytes.length,
        sha256: hash(bytes),
      });
    }
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
