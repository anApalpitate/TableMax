import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';
import { serveFixture } from '../../support/fixture-server.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';
const arg = (n) =>
  process.argv.find((v) => v.startsWith(`--${n}=`))?.slice(n.length + 3);
assertWorkspaceRoot();
const task = resolve(arg('task') ?? 'tmp/modern-art-layout-refine-20261023-c1');
const out = resolve(
  arg('output') ??
    'artifacts/maintenance/modern-art-layout-refine-20261023-c1/visual-r01',
);
assert.ok(task.startsWith(resolve('tmp') + '\\'));
assert.ok(out.startsWith(resolve('artifacts') + '\\'));
const phases = arg('phase') ? [arg('phase')] : ['before', 'after'];
const only = (arg('only') ?? '').split(',').filter(Boolean);
const fixedCanvas = process.argv.includes('--fixed-canvas');
assert.ok(phases.every((p) => ['before', 'after'].includes(p)));
assert.ok(
  !fixedCanvas || (phases.length === 1 && phases[0] === 'after'),
  'Fixed canvas checks require --phase=after',
);
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
process.env.TABLEMAX_TEST_MAINTENANCE = '0';
await mkdir(join(task, 'browser-temp'), { recursive: true });
await mkdir(out, { recursive: true });
await writeFile(
  join(out, 'verifier-source.mjs'),
  await readFile(new URL(import.meta.url)),
);
process.env.TEMP = join(task, 'browser-temp');
process.env.TMP = process.env.TEMP;
const { launchTestBrowser } = await import('../../support/browser-test.mjs');
const report = {
  result: 'running',
  checks: [],
  failures: [],
  pending: [],
  screenshots: [],
  inputs: [],
  fixedCanvas,
  boundary:
    'Production components, legal role projections and controlled fixture transport. No physical device, live network, DPI or installer proof.',
};
const sources = [
  'games/modern-art/web/index.tsx',
  'games/modern-art/ui/player-wide.css',
  'games/modern-art/ui/player/index.tsx',
  'games/modern-art/ui/public/index.tsx',
  'games/modern-art/ui/style.css',
  'apps/web/src/components/PlayerFrame.tsx',
  'apps/web/src/components/player-frame.ts',
  'apps/web/src/components/player-frame.css',
];
const hash = (b) => createHash('sha256').update(b).digest('hex');
for (const source of sources) {
  const path =
    phases.length === 1 && phases[0] === 'before'
      ? join(task, 'baseline', source)
      : source;
  report.inputs.push({ path, sha256: hash(await readFile(path)) });
}
let browser;
try {
  browser = await launchTestBrowser({ channel: 'msedge', headless: true });
  for (const phase of phases) {
    const bundle = resolve(arg(phase + '-bundle'));
    const bindingPath =
      arg('source-report') ??
      join(
        dirname(out),
        basename(dirname(bundle)).replace(/^fixture-/, ''),
        'report.json',
      );
    const bindingBytes = await readFile(bindingPath),
      binding = JSON.parse(bindingBytes);
    assert.equal(binding.result, 'built');
    for (const entry of binding.inputs.after)
      assert.equal(
        hash(await readFile(entry.path)),
        entry.sha256,
        'Bundle matches current source ' + entry.path,
      );
    report.sourceBinding = {
      path: bindingPath,
      sha256: hash(bindingBytes),
      inputs: binding.inputs.after,
    };
    const server = await serveFixture(bundle);
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    await page.addInitScript(() => localStorage.clear());
    const html = await readFile(join(bundle, 'index.html'));
    await page.route(
      (u) => u.pathname === '/player/game',
      (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }),
    );
    const cases = [];
    if (fixedCanvas) {
      for (const scene of [
        'offer',
        'auction-open',
        'auction-once',
        'auction-once-leading',
        'auction-sealed',
        'sealed-submitted',
        'auction-fixed',
        'auction-double',
        'auction-pair',
        'result',
        'ended',
      ]) {
        for (const layout of [
          'host-landscape',
          'player-portrait',
          'player-landscape',
        ]) {
          const [width, height] =
            layout === 'host-landscape'
              ? [1280, 720]
              : layout === 'player-portrait'
                ? [360, 640]
                : [640, 360];
          cases.push({
            id: `${layout}-${scene}`,
            scene,
            role: layout === 'host-landscape' ? 'host' : 'player',
            width,
            height,
            wide: layout === 'player-landscape',
            layout,
          });
        }
      }
      for (const behavior of ['draft-switch', 'overlays', 'blocked-actions'])
        cases.push({
          id: `player-${behavior}`,
          scene: 'auction-open',
          role: 'player',
          width: 1280,
          height: 720,
          wide: true,
          layout: 'player-landscape',
          behavior,
        });
      for (const [layout, role, width, height] of [
        ['host-landscape', 'host', 1280, 720],
        ['player-portrait', 'player', 360, 640],
        ['player-landscape', 'player', 640, 360],
      ])
        cases.push({
          id: `${layout}-saved`,
          scene: 'auction-open',
          role,
          width,
          height,
          wide: layout === 'player-landscape',
          layout,
          saved: true,
        });
    } else {
      for (const scene of [
        'offer',
        'auction-open',
        'auction-once',
        'auction-sealed',
        'sealed-submitted',
        'auction-fixed',
        'auction-double',
        'auction-pair',
        'result',
        'ended',
      ])
        for (const [width, height] of [
          [1280, 720],
          [844, 390],
        ])
          cases.push({
            id: `${scene}-${width}`,
            scene,
            role: 'player',
            width,
            height,
            wide: true,
          });
      for (const scene of ['offer', 'auction-open'])
        cases.push({
          id: `${scene}-portrait`,
          scene,
          role: 'player',
          width: 390,
          height: 844,
          wide: false,
        });
      if (phase === 'after')
        for (const scene of ['offer', 'auction-open', 'auction-pair'])
          cases.push({
            id: scene + '-minimum',
            scene,
            role: 'player',
            width: 712,
            height: 336,
            wide: true,
          });
      for (const role of ['player', 'host', 'public'])
        cases.push({
          id: `saved-${role}`,
          scene: 'auction-open',
          role,
          width: 1280,
          height: 720,
          wide: role === 'player',
          saved: true,
        });
    }
    assert.ok(
      only.every((id) => cases.some((c) => c.id === id)) &&
        new Set(only).size === only.length,
      'Known unique --only checks',
    );
    try {
      for (const item of cases) {
        if (only.length && !only.includes(item.id)) continue;
        const id = phase + '-' + item.id;
        if (report.failures.length >= 10) {
          report.pending.push(id);
          continue;
        }
        try {
          await page.setViewportSize({
            width: item.width,
            height: item.height,
          });
          await page.goto(
            server.url + `?role=${item.role}&scene=${item.scene}`,
          );
          await page
            .locator(
              item.role === 'player' && !fixedCanvas
                ? 'iframe[data-player-frame]'
                : '.ma-screen',
            )
            .waitFor();
          if (item.role === 'player' && !fixedCanvas)
            await page
              .frameLocator('iframe[data-player-frame]')
              .locator('.ma-screen')
              .waitFor();
          let frame =
            item.role === 'player' && !fixedCanvas
              ? page
                  .frames()
                  .find(
                    (f) =>
                      f !== page.mainFrame() &&
                      new URL(f.url()).pathname === '/player/game',
                  )
              : page.mainFrame();
          await frame.locator('.ma-screen').waitFor();
          if (item.role === 'player') {
            if (fixedCanvas) {
              await frame
                .getByRole('combobox', { name: '显示布局', exact: true })
                .selectOption(item.wide ? 'wide' : 'portrait');
              await frame
                .locator(
                  `[data-fixed-canvas][data-canvas-layout='${item.layout}']`,
                )
                .waitFor();
            } else if (phase === 'before')
              await page
                .getByRole('combobox', { name: '玩家布局' })
                .selectOption(item.wide ? 'wide' : 'portrait');
            else {
              assert.equal(
                await page
                  .locator('[data-workspace-layout]')
                  .getAttribute('data-workspace-layout'),
                'portrait',
                'fresh default portrait',
              );
              if (item.wide)
                await page
                  .getByRole('button', { name: '切换横屏显示', exact: true })
                  .click();
            }
          }
          if (item.saved)
            await frame.evaluate(
              ({ scene, role }) =>
                window.renderModernArt({
                  scene,
                  role,
                  savedMessage: '已保存',
                  preserve: true,
                }),
              item,
            );
          await frame.evaluate(() =>
            Promise.all(
              [...document.images]
                .filter((i) => i.loading !== 'lazy')
                .map((i) => i.decode().catch(() => {})),
            ),
          );
          await page.waitForTimeout(60);
          const metrics = await frame.evaluate(() => {
            const box = (e) => {
              const r = e.getBoundingClientRect();
              return {
                x: r.x,
                y: r.y,
                right: r.right,
                bottom: r.bottom,
                width: r.width,
                height: r.height,
              };
            };
            const visible = (e) => {
              const s = getComputedStyle(e);
              return (
                e.getClientRects().length &&
                s.visibility !== 'hidden' &&
                s.display !== 'none'
              );
            };
            const painted = (e) => {
              const b = box(e);
              for (let p = e.parentElement; p; p = p.parentElement) {
                const s = getComputedStyle(p),
                  r = box(p);
                if (s.overflowX !== 'visible') {
                  b.x = Math.max(b.x, r.x);
                  b.right = Math.min(b.right, r.right);
                }
                if (s.overflowY !== 'visible') {
                  b.y = Math.max(b.y, r.y);
                  b.bottom = Math.min(b.bottom, r.bottom);
                }
              }
              return b;
            };
            const semanticPaint = (element) => {
              const clip = painted(element);
              const ancestors = [];
              for (
                let parent = element.parentElement;
                parent;
                parent = parent.parentElement
              ) {
                const style = getComputedStyle(parent);
                const rect = box(parent);
                const paddingBox = {
                  x: rect.x + parent.clientLeft,
                  y: rect.y + parent.clientTop,
                  right: rect.x + parent.clientLeft + parent.clientWidth,
                  bottom: rect.y + parent.clientTop + parent.clientHeight,
                };
                const paintContainment =
                  /(?:^|\s)(?:paint|strict|content)(?:\s|$)/.test(
                    style.contain,
                  );
                const clipX = style.overflowX !== 'visible' || paintContainment;
                const clipY = style.overflowY !== 'visible' || paintContainment;
                if (style.display !== 'contents' && (clipX || clipY)) {
                  if (clipX) {
                    clip.x = Math.max(clip.x, paddingBox.x);
                    clip.right = Math.min(clip.right, paddingBox.right);
                  }
                  if (clipY) {
                    clip.y = Math.max(clip.y, paddingBox.y);
                    clip.bottom = Math.min(clip.bottom, paddingBox.bottom);
                  }
                }
                ancestors.push({
                  tag: parent.tagName,
                  className: parent.className,
                  rect,
                  paddingBox,
                  overflowX: style.overflowX,
                  overflowY: style.overflowY,
                  contain: style.contain,
                  clipPath: style.clipPath,
                });
              }
              const workspace = element.closest(
                '.ma-auction,.ma-player__operations,.ma-player-footer',
              );
              const allocation = workspace
                ? { className: workspace.className, rect: box(workspace) }
                : null;
              if (allocation) {
                clip.x = Math.max(clip.x, allocation.rect.x);
                clip.y = Math.max(clip.y, allocation.rect.y);
                clip.right = Math.min(clip.right, allocation.rect.right);
                clip.bottom = Math.min(clip.bottom, allocation.rect.bottom);
              }
              clip.width = Math.max(0, clip.right - clip.x);
              clip.height = Math.max(0, clip.bottom - clip.y);
              return { clip, allocation, ancestors };
            };
            const insidePaint = (rect, clip) =>
              rect.x >= clip.x - 1 &&
              rect.right <= clip.right + 1 &&
              rect.y >= clip.y - 1 &&
              rect.bottom <= clip.bottom + 1;
            const overlaps = (a, b) =>
              Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
            const saved = [...document.querySelectorAll('*')].filter(
              (e) =>
                e.children.length === 0 &&
                e.textContent.trim() === '已保存' &&
                visible(e),
            );
            // Distinct text nodes and status glyphs are the comparison units.
            // Parent panel rectangles are never compared with their children.
            const semanticLeaves = [];
            const semanticClips = [];
            const semanticRoots = [
              ['seller', document.querySelector('.ma-auction__label p')],
              ['quote', document.querySelector('.ma-auction__price')],
              [
                'painting',
                document.querySelector('.ma-auction__paintings > .ma-card'),
              ],
              [
                'participants',
                document.querySelector('.ma-auction__participants'),
              ],
            ];
            if (window.__fixture?.scene === 'auction-once-leading')
              semanticRoots.push([
                'operations',
                document.querySelector('.ma-player__operations'),
              ]);
            for (const [group, root] of semanticRoots) {
              if (
                !root ||
                (!visible(root) &&
                  getComputedStyle(root).display !== 'contents')
              )
                continue;
              const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
              );
              let node;
              while ((node = walker.nextNode())) {
                const element = node.parentElement;
                if (
                  !node.textContent.trim() ||
                  !visible(element) ||
                  element.closest('[aria-hidden="true"]')
                )
                  continue;
                const source = semanticLeaves.length;
                const range = document.createRange();
                range.selectNodeContents(node);
                const { clip, allocation } = semanticPaint(element);
                for (const rect of range.getClientRects()) {
                  if (!rect.width || !rect.height) continue;
                  const entry = {
                    group,
                    source,
                    text: node.textContent.trim(),
                    rect: {
                      x: rect.x,
                      y: rect.y,
                      right: rect.right,
                      bottom: rect.bottom,
                      width: rect.width,
                      height: rect.height,
                    },
                  };
                  semanticLeaves.push(entry);
                  if (!insidePaint(rect, clip))
                    semanticClips.push({ ...entry, clip, allocation });
                }
              }
            }
            for (const [group, selector] of [
              [
                'painting-art',
                '.ma-auction__paintings > .ma-card:first-child .ma-card__art',
              ],
              [
                'participant-status',
                '.ma-auction__participants .ma-auction__seat-status svg',
              ],
            ]) {
              for (const element of document.querySelectorAll(selector))
                if (visible(element))
                  semanticLeaves.push({
                    group,
                    source: semanticLeaves.length,
                    text: element.getAttribute('aria-label') ?? group,
                    rect: box(element),
                  });
            }
            const semanticOverlaps = [];
            for (let a = 0; a < semanticLeaves.length; a++)
              for (let b = a + 1; b < semanticLeaves.length; b++) {
                const first = semanticLeaves[a],
                  second = semanticLeaves[b];
                if (
                  first.source !== second.source &&
                  overlaps(first.rect, second.rect)
                )
                  semanticOverlaps.push({ first, second });
              }
            const marketCells = [
              ...document.querySelectorAll('.ma-market--summary .ma-artist'),
            ]
              .filter(visible)
              .map((element) => {
                const heading = element.querySelector('h3');
                const range = document.createRange();
                range.selectNodeContents(heading);
                return {
                  name: heading.textContent,
                  rect: box(element),
                  nameRect: box(heading),
                  lines: [...range.getClientRects()].map((rect) => ({
                    x: rect.x,
                    y: rect.y,
                    right: rect.right,
                    bottom: rect.bottom,
                  })),
                };
              });
            const handToggle = document.querySelector('.ma-hand-toggle');
            const footer = document.querySelector('.ma-player-footer');
            let handToggleHit = null;
            if (handToggle && visible(handToggle)) {
              const rect = box(handToggle);
              const point = {
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2,
              };
              const hit = document.elementFromPoint(point.x, point.y);
              handToggleHit = {
                point,
                button: rect,
                footer: footer ? box(footer) : null,
                hitTag: hit?.tagName,
                hitClass: hit?.className,
                occluded: hit !== handToggle && !handToggle.contains(hit),
              };
            }
            const once = document.querySelector('.ma-theme--once');
            const onceNames = once
              ? [
                  ...new Set(
                    [
                      window.__fixture?.auction?.actingSeats?.[0],
                      window.__fixture?.auction?.highBidder,
                    ].filter(Boolean),
                  ),
                ].map((seatId) => {
                  const expected = window.__currentView.seats.find(
                    (seat) => seat.id === seatId,
                  )?.name;
                  const marker = [
                    ...document.querySelectorAll(
                      '.ma-theme__identity > b, .ma-once-leader > b',
                    ),
                  ].find((element) => element.dataset.seatId === seatId);
                  const name = marker?.nextElementSibling;
                  const painting = name ? semanticPaint(name) : null;
                  const range = document.createRange();
                  if (name) range.selectNodeContents(name);
                  const lines = name
                    ? [...range.getClientRects()].map((rect) => ({
                        x: rect.x,
                        y: rect.y,
                        right: rect.right,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                      }))
                    : [];
                  return {
                    seatId,
                    expected,
                    actual: name?.textContent,
                    visible: Boolean(name && visible(name)),
                    fullyPainted: Boolean(
                      painting &&
                      lines.length &&
                      lines.every((rect) => insidePaint(rect, painting.clip)),
                    ),
                    lines,
                    painting,
                  };
                })
              : [];
            let onceTheme = null;
            if (once) {
              const ring = once.querySelector('.ma-theme__ring');
              const value = once.querySelector(
                '.ma-theme__once-price > strong, :scope > strong',
              );
              const price =
                once.querySelector('.ma-theme__once-price') ?? value;
              const label = once.querySelector('.ma-theme__price-label');
              const identity = once.querySelector(
                '.ma-theme__lead > .ma-theme__identity',
              );
              const action = once.querySelector(
                '.ma-theme__lead > span:last-child:not(.ma-theme__identity)',
              );
              if (ring && price && visible(ring) && visible(price)) {
                const badges = [...ring.querySelectorAll(':scope > b')]
                  .filter(visible)
                  .map((element) => {
                    const rect = box(element),
                      style = getComputedStyle(element);
                    const edge =
                      style.outlineStyle === 'none'
                        ? 0
                        : Math.max(
                            0,
                            (parseFloat(style.outlineWidth) || 0) +
                              (parseFloat(style.outlineOffset) || 0),
                          );
                    return {
                      text: element.textContent,
                      rect,
                      minWidth: style.minWidth,
                      maxWidth: style.maxWidth,
                      paint: {
                        ...rect,
                        x: rect.x - edge,
                        y: rect.y - edge,
                        right: rect.right + edge,
                        bottom: rect.bottom + edge,
                      },
                    };
                  });
                const ringRect = box(ring),
                  priceRect = box(price);
                onceTheme = {
                  ring: ringRect,
                  price: priceRect,
                  priceFont: parseFloat(getComputedStyle(value).fontSize),
                  label:
                    label && visible(label) ? label.textContent.trim() : null,
                  badges,
                  outsideSequence: badges.filter(
                    ({ rect }) =>
                      rect.x < ringRect.x - 1 ||
                      rect.right > ringRect.right + 1 ||
                      rect.y < ringRect.y - 1 ||
                      rect.bottom > ringRect.bottom + 1,
                  ),
                  priceCollisions: badges.filter(({ paint }) =>
                    overlaps(paint, priceRect),
                  ),
                  identity:
                    identity && visible(identity) ? box(identity) : null,
                  action: action && visible(action) ? box(action) : null,
                  identityActionCollision: Boolean(
                    identity &&
                    action &&
                    visible(identity) &&
                    visible(action) &&
                    overlaps(box(identity), box(action)),
                  ),
                };
              }
            }
            return {
              width: innerWidth,
              height: innerHeight,
              scrollHeight: document.documentElement.scrollHeight,
              scrollWidth: document.documentElement.scrollWidth,
              saved: saved.map(box),
              savedOverlaps: saved.flatMap((s) =>
                [
                  ...document.querySelectorAll(
                    'button,input,select,.ma-card,.ma-round',
                  ),
                ]
                  .filter((e) => visible(e) && !e.contains(s))
                  .filter((e) => {
                    const a = painted(s),
                      b = painted(e);
                    return (
                      Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
                      Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1
                    );
                  })
                  .map((e) => e.className),
              ),
              hand: [...document.querySelectorAll('.ma-hand__card')].filter(
                visible,
              ).length,
              inputs: document.querySelectorAll('#ma-bid-amount').length,
              semanticLeaves,
              semanticClips,
              semanticOverlaps,
              marketCells,
              handToggleHit,
              onceTheme,
              onceNames,
              fixtureAuction: window.__fixture?.auction ?? null,
              primary: [
                ...document.querySelectorAll(
                  '.ma-player__operations .ma-wallet,' +
                    '.ma-player__operations #ma-bid-amount,' +
                    '.ma-player__operations .ma-bid__submit button,' +
                    '.ma-player__operations .ma-controls__simple button,' +
                    '.ma-auction__label,.ma-auction__price,' +
                    '.ma-auction__participants,.ma-private-bid,' +
                    '.ma-theme__once-price,.ma-theme--once > .ma-theme__lead,.ma-once-leader',
                ),
              ]
                .filter(visible)
                .map((element) => ({
                  className: element.className,
                  text: element.textContent.trim(),
                  rect: box(element),
                  painted: painted(element),
                })),
              handCards: [...document.querySelectorAll('.ma-hand__card')]
                .filter(visible)
                .map((element) => ({
                  rect: box(element),
                  painted: painted(element),
                })),
              canvas: document.querySelector('[data-fixed-canvas]')
                ? {
                    layout: document.querySelector('[data-fixed-canvas]')
                      .dataset.canvasLayout,
                    rect: box(document.querySelector('[data-fixed-canvas]')),
                    transform: getComputedStyle(
                      document.querySelector('[data-fixed-canvas]'),
                    ).transform,
                    fitStatus: document.querySelector('[data-canvas-viewport]')
                      .dataset.fitStatus,
                  }
                : null,
              paintings: [
                ...document.querySelectorAll(
                  '.ma-auction__paintings > .ma-card',
                ),
              ]
                .filter(visible)
                .map((e) => ({ box: box(e), painted: painted(e) })),
              stageOverlaps: [
                ...document.querySelectorAll('.ma-auction__participants'),
              ]
                .filter(visible)
                .flatMap((p) =>
                  [
                    ...document.querySelectorAll(
                      '.ma-auction__label,.ma-theme > *',
                    ),
                  ]
                    .filter(visible)
                    .filter((e) => overlaps(painted(p), painted(e)))
                    .map((e) => e.className),
                ),
            };
          });
          report.checks.push({ id, ...metrics });
          const path = join(out, id + '.png');
          await captureBrowserScreenshot(page, {
            path,
            fullPage: false,
            animations: 'disabled',
          });
          report.screenshots.push({ ...item, id: item.id, phase, path });
          if (phase === 'after') {
            if (fixedCanvas) {
              assert.equal(metrics.canvas?.layout, item.layout);
              assert.equal(
                metrics.canvas?.transform,
                'none',
                'canvas scale remains one',
              );
              assert.equal(
                metrics.canvas?.rect.width,
                item.layout === 'host-landscape' ? 1280 : item.wide ? 640 : 360,
              );
              assert.equal(
                metrics.canvas?.rect.height,
                item.layout === 'host-landscape' ? 720 : item.wide ? 360 : 640,
              );
              assert.equal(metrics.canvas?.fitStatus, 'fits');
              if (item.scene === 'auction-once-leading') {
                assert.ok(
                  metrics.fixtureAuction?.currentBid > 0 &&
                    metrics.fixtureAuction.highBidder,
                  'dense once fixture retains its positive authoritative bid and actual high bidder',
                );
                assert.deepEqual(
                  metrics.onceNames.filter((name) => !name.fullyPainted),
                  [],
                  'acting and leading names remain fully painted inside their assigned workspace and every ancestor clip',
                );
                assert.deepEqual(
                  metrics.semanticClips,
                  [],
                  'dense once-auction identities, price, painting and required controls stay fully painted',
                );
                assert.deepEqual(
                  metrics.semanticOverlaps,
                  [],
                  'dense once-auction semantic leaves do not collide',
                );
                assert.equal(
                  metrics.onceNames.length,
                  2,
                  'the dense scene contains distinct acting and leading player identities',
                );
                for (const name of metrics.onceNames) {
                  assert.ok(
                    name.expected && name.visible,
                    'each acting or leading player has a visible authoritative name',
                  );
                  assert.equal(
                    name.actual,
                    name.expected,
                    'acting and leading names retain their complete legal text',
                  );
                }
              }
              if (item.wide && metrics.onceTheme) {
                assert.deepEqual(
                  metrics.onceTheme.outsideSequence,
                  [],
                  'each once-auction badge occupies its allocated sequence area',
                );
                assert.deepEqual(
                  metrics.onceTheme.priceCollisions,
                  [],
                  'once-auction badge backgrounds and current outline never collide with the price area',
                );
                assert.ok(
                  metrics.onceTheme.label,
                  'the current price has an explicit visible semantic label separate from seat numbers',
                );
                assert.ok(
                  metrics.onceTheme.priceFont >= 24,
                  'the once-auction price retains its 24px type size',
                );
                assert.equal(
                  metrics.onceTheme.identityActionCollision,
                  false,
                  'actor identity and action occupy distinct semantic blocks',
                );
              }
              if (
                item.layout === 'player-portrait' &&
                item.scene === 'auction-open'
              ) {
                assert.deepEqual(
                  metrics.semanticClips,
                  [],
                  'seller, quote, current painting text and participant states remain fully painted',
                );
                assert.deepEqual(
                  metrics.semanticOverlaps,
                  [],
                  'distinct semantic text leaves and status glyphs never overlap',
                );
                assert.equal(
                  metrics.marketCells.length,
                  5,
                  'all five artist cells remain in the market',
                );
                const firstY = metrics.marketCells[0].rect.y;
                for (const cell of metrics.marketCells) {
                  assert.ok(
                    Math.abs(cell.rect.y - firstY) <= 1,
                    'all artists occupy one aligned row',
                  );
                  assert.equal(
                    cell.lines.length,
                    1,
                    `${cell.name} stays on one complete English-name line`,
                  );
                  assert.ok(
                    cell.lines[0].x >= cell.rect.x - 1 &&
                      cell.lines[0].right <= cell.rect.right + 1,
                    `${cell.name} fits its own artist cell`,
                  );
                }
              }
              if (item.role === 'player') {
                const canvas = metrics.canvas.rect;
                const complete = ({ rect, painted }) =>
                  rect.x >= canvas.x - 1 &&
                  rect.right <= canvas.right + 1 &&
                  rect.y >= canvas.y - 1 &&
                  rect.bottom <= canvas.bottom + 1 &&
                  painted.right - painted.x >= rect.width - 1 &&
                  painted.bottom - painted.y >= rect.height - 1;
                assert.deepEqual(
                  metrics.primary.filter((entry) => !complete(entry)),
                  [],
                  'all necessary auction information, cash and bid actions are fully painted in the first canvas without scrolling',
                );
                if (['offer', 'auction-double'].includes(item.scene))
                  assert.ok(
                    metrics.handCards.some(complete),
                    'at least one complete actionable painting is present on the first canvas; the remaining gallery is locally browsable',
                  );
              }
              if (item.role === 'host')
                assert.equal(
                  await frame.locator('.ma-hand__card,#ma-bid-amount').count(),
                  0,
                  'host projection contains no private hand or bid controls',
                );
            }
            assert.ok(
              metrics.scrollWidth <= metrics.width + 1,
              'no horizontal page overflow',
            );
            if (item.wide)
              assert.ok(
                metrics.scrollHeight <= metrics.height + 1,
                `no vertical page overflow ${metrics.scrollHeight}/${metrics.height}`,
              );
            if (item.wide)
              assert.deepEqual(
                metrics.stageOverlaps,
                [],
                'participants do not overlap title, price or theme text',
              );
            if (
              item.wide &&
              [
                'auction-open',
                'auction-once',
                'auction-once-leading',
                'auction-fixed',
                'auction-sealed',
                'sealed-submitted',
                'auction-pair',
              ].includes(item.scene)
            )
              assert.ok(
                metrics.paintings.some(
                  (c) =>
                    c.painted.bottom - c.painted.y >= c.box.height - 2 &&
                    c.painted.right - c.painted.x >= c.box.width - 2,
                ),
                'at least one complete auction painting is visible',
              );
            assert.ok(metrics.inputs <= 1, 'one quotation input');
            if (item.saved) {
              assert.deepEqual(
                metrics.savedOverlaps,
                [],
                'saved does not overlap controls or artwork',
              );
              assert.equal(
                metrics.saved.length,
                1,
                'exactly one visible saved acknowledgement',
              );
              for (const b of metrics.saved)
                assert.ok(
                  b.x >= 0 &&
                    b.y >= 0 &&
                    b.right <= metrics.width + 1 &&
                    b.bottom <= metrics.height + 1,
                  'saved within viewport',
                );
            }
            if (item.wide && item.scene === 'auction-open') {
              const input = frame.locator('#ma-bid-amount');
              await input.fill('9');
              const doc = await frame.evaluate(() => window.__documentId);
              if (fixedCanvas) {
                // This exact viewport can contain both canvases at scale one.
                if (item.width >= 640 && item.height >= 640) {
                  const marker = await input.evaluate((element) => {
                    element.dataset.draftIdentity = crypto.randomUUID();
                    return element.dataset.draftIdentity;
                  });
                  const control = frame.getByRole('combobox', {
                    name: '显示布局',
                    exact: true,
                  });
                  await control.selectOption('portrait');
                  await frame
                    .locator(
                      "[data-fixed-canvas][data-canvas-layout='player-portrait']",
                    )
                    .waitFor();
                  await control.selectOption('wide');
                  await frame
                    .locator(
                      "[data-fixed-canvas][data-canvas-layout='player-landscape']",
                    )
                    .waitFor();
                  assert.equal(
                    await input.getAttribute('data-draft-identity'),
                    marker,
                  );
                }
              } else {
                await page
                  .getByRole('button', { name: '返回竖屏显示', exact: true })
                  .click();
                await page
                  .getByRole('button', { name: '切换横屏显示', exact: true })
                  .click();
              }
              assert.equal(await input.inputValue(), '9');
              assert.equal(
                await frame.evaluate(() => window.__documentId),
                doc,
              );
            }
            if (item.wide && item.scene === 'offer') {
              const cards = frame.locator('.ma-hand__card');
              const count = await cards.count();
              assert.ok(count > 0);
              const seen = new Set();
              for (let n = 0; n <= count; n++) {
                const ids = await cards.evaluateAll((es) => {
                  const h = document
                    .querySelector('.ma-hand')
                    .getBoundingClientRect();
                  return es
                    .filter((e) => {
                      const r = e.getBoundingClientRect();
                      return (
                        r.x >= h.x - 1 &&
                        r.right <= h.right + 1 &&
                        r.y >= 0 &&
                        r.bottom <= innerHeight + 1
                      );
                    })
                    .map((e) => e.dataset.cardId);
                });
                ids.forEach((id) => seen.add(id));
                if (seen.size === count) break;
                await frame
                  .getByRole('button', { name: '下一页手牌', exact: true })
                  .click();
                await frame.evaluate(
                  () =>
                    new Promise((r) =>
                      requestAnimationFrame(() => requestAnimationFrame(r)),
                    ),
                );
              }
              assert.equal(
                seen.size,
                count,
                'each complete hand card reachable using actual next-page button',
              );
              assert.equal(await frame.evaluate(() => scrollY), 0);
            }
            if (item.wide && item.scene === 'result') {
              const entries = frame.locator('.ma-results__ranking > div');
              for (let i = 0; i < (await entries.count()); i++) {
                await entries.nth(i).evaluate((e) =>
                  e.scrollIntoView({
                    behavior: 'instant',
                    inline: 'nearest',
                    block: 'nearest',
                  }),
                );
                assert.ok(
                  await entries.nth(i).evaluate((e) => {
                    const r = e.getBoundingClientRect();
                    return (
                      r.y >= 0 &&
                      r.bottom <= innerHeight + 1 &&
                      r.x >= 0 &&
                      r.right <= innerWidth + 1
                    );
                  }),
                  'all artist values reachable',
                );
              }
            }
            if (item.wide && ['result', 'ended'].includes(item.scene)) {
              const rows = frame.locator('.ma-results__income > div');
              assert.equal(await rows.count(), 5);
              for (let i = 0; i < 5; i++) {
                await rows.nth(i).evaluate((e) =>
                  e.scrollIntoView({
                    behavior: 'instant',
                    block: 'nearest',
                    inline: 'nearest',
                  }),
                );
                assert.ok(
                  await rows.nth(i).evaluate((e) => {
                    const r = e.getBoundingClientRect();
                    return (
                      r.y >= -1 &&
                      r.bottom <= innerHeight + 1 &&
                      r.x >= -1 &&
                      r.right <= innerWidth + 1
                    );
                  }),
                  'all five result rows fully reachable',
                );
                assert.ok(
                  await rows
                    .nth(i)
                    .locator(':scope > strong')
                    .evaluate((e) => {
                      const r = e.getBoundingClientRect();
                      return r.y >= -1 && r.bottom <= innerHeight + 1;
                    }),
                  'result amount stays visible',
                );
              }
              assert.equal(await frame.evaluate(() => scrollY), 0);
            }
            if (fixedCanvas && item.behavior === 'draft-switch') {
              assert.equal(
                metrics.handToggleHit?.occluded,
                false,
                'the native hand-toggle hit point belongs to the button, not the footer padding',
              );
              const input = frame.locator('#ma-bid-amount');
              const control = frame.getByRole('combobox', {
                name: '显示布局',
                exact: true,
              });
              await input.fill('9');
              const identity = await input.evaluate((element) => {
                element.dataset.draftIdentity = crypto.randomUUID();
                return element.dataset.draftIdentity;
              });
              await frame.locator('.ma-hand-toggle').click();
              const sort = frame.getByRole('combobox', {
                name: '你的手牌和收藏排序',
                exact: true,
              });
              await sort.selectOption('auction');
              const order = await frame
                .locator('.ma-hand__card')
                .evaluateAll((elements) =>
                  elements.map((element) => element.dataset.cardId),
                );
              await frame.locator('.ma-hand-toggle').click();
              const geometry = () =>
                frame.evaluate(() => {
                  const canvas = document
                    .querySelector('[data-fixed-canvas]')
                    .getBoundingClientRect();
                  return [
                    '.ma-auction',
                    '.ma-player__operations',
                    '.ma-player-footer',
                  ].map((selector) => {
                    const rect = document
                      .querySelector(selector)
                      .getBoundingClientRect();
                    return {
                      selector,
                      x: rect.x - canvas.x,
                      y: rect.y - canvas.y,
                      width: rect.width,
                      height: rect.height,
                    };
                  });
                });
              const initial = await geometry();
              await page.setViewportSize({ width: 800, height: 450 });
              await page.waitForTimeout(200);
              assert.deepEqual(
                await geometry(),
                initial,
                'nonbaseline window changes only canvas offset',
              );
              await page.setViewportSize({ width: 1280, height: 720 });
              await control.selectOption('portrait');
              await frame
                .locator(
                  "[data-fixed-canvas][data-canvas-layout='player-portrait']",
                )
                .waitFor();
              await frame.locator('.ma-hand-toggle').click();
              await frame.locator('.ma-hand-toggle').click();
              await control.selectOption('wide');
              await frame
                .locator(
                  "[data-fixed-canvas][data-canvas-layout='player-landscape']",
                )
                .waitFor();
              assert.equal(await input.inputValue(), '9');
              assert.equal(
                await input.getAttribute('data-draft-identity'),
                identity,
                'same draft input survives both layout changes',
              );
              await frame.locator('.ma-hand-toggle').click();
              assert.equal(await sort.inputValue(), 'auction');
              assert.deepEqual(
                await frame
                  .locator('.ma-hand__card')
                  .evaluateAll((elements) =>
                    elements.map((element) => element.dataset.cardId),
                  ),
                order,
                'manual sort survives layout changes',
              );
              assert.equal(
                await frame.evaluate(() => window.__commands.length),
                0,
                'layout, sorting and gallery browsing submit no game command',
              );
            }
            if (fixedCanvas && item.behavior === 'overlays') {
              const input = frame.locator('#ma-bid-amount');
              await input.fill('9');
              for (const [entry, panel, suffix] of [
                ['规则', '.rules-guide', 'rules'],
                ['行情', '.ma-market', 'market'],
                ['各家收藏', '.ma-museums', 'museums'],
              ]) {
                const trigger = frame.getByRole('button', {
                  name: entry,
                  exact: true,
                });
                await trigger.click();
                const dialog = frame.locator('dialog[open]');
                await dialog.locator(panel).waitFor();
                assert.ok(
                  await dialog.evaluate((element) => {
                    const rect = element.getBoundingClientRect();
                    return (
                      rect.x >= 0 &&
                      rect.y >= 0 &&
                      rect.right <= innerWidth + 1 &&
                      rect.bottom <= innerHeight + 1
                    );
                  }),
                  `${entry} uses a reachable window dialog`,
                );
                const overlayPath = join(out, `${id}-${suffix}.png`);
                await captureBrowserScreenshot(page, {
                  path: overlayPath,
                  fullPage: false,
                  animations: 'disabled',
                });
                report.screenshots.push({
                  ...item,
                  id: `${item.id}-${suffix}`,
                  phase,
                  path: overlayPath,
                  label: entry,
                });
                await page.keyboard.press('Escape');
                await dialog.waitFor({ state: 'detached' });
                assert.ok(
                  await trigger.evaluate(
                    (element) => element === document.activeElement,
                  ),
                  `${entry} restores focus to its trigger`,
                );
                assert.equal(
                  await input.inputValue(),
                  '9',
                  `${entry} preserves bid draft`,
                );
              }
              assert.equal(
                await frame.evaluate(() => window.__commands.length),
                0,
              );
            }
            if (fixedCanvas && item.behavior === 'blocked-actions') {
              const input = frame.locator('#ma-bid-amount');
              await input.fill('9');
              for (const state of [
                'disconnected',
                'paused',
                'awaiting',
                'locked',
              ]) {
                await frame.evaluate((state) => {
                  const suppliedView = structuredClone(window.__currentView);
                  suppliedView.paused = state === 'paused';
                  window.renderModernArt({
                    scene: 'auction-open',
                    role: 'player',
                    preserve: true,
                    suppliedView,
                    connected: state !== 'disconnected',
                    awaitingConfirmation: state === 'awaiting',
                    locked: state === 'locked',
                  });
                }, state);
                assert.ok(
                  await input.isDisabled(),
                  `${state} disables amount input`,
                );
                assert.equal(
                  await input.inputValue(),
                  '9',
                  `${state} retains amount draft`,
                );
                assert.deepEqual(
                  await frame
                    .locator('[data-ma-action]')
                    .evaluateAll((elements) =>
                      elements
                        .filter((element) => !element.disabled)
                        .map((element) => element.dataset.maAction),
                    ),
                  [],
                  `${state} prevents game actions`,
                );
              }
              await frame.evaluate(() =>
                window.renderModernArt({
                  scene: 'auction-open',
                  role: 'player',
                  preserve: true,
                }),
              );
              assert.ok(await input.isEnabled());
              assert.equal(await input.inputValue(), '9');
              assert.equal(
                await frame.evaluate(() => window.__commands.length),
                0,
              );
            }
          }
        } catch (e) {
          report.failures.push({ id, error: e.message });
          try {
            const failurePath = join(out, `${id}-failure.png`);
            await captureBrowserScreenshot(page, {
              path: failurePath,
              fullPage: false,
              animations: 'disabled',
            });
            report.screenshots.push({
              ...item,
              id: `${item.id}-failure`,
              phase,
              path: failurePath,
            });
          } catch (captureError) {
            report.failures.at(-1).failureCaptureError = captureError.message;
          }
        }
        await writeFile(
          join(out, 'report-running.json'),
          JSON.stringify(report, null, 2),
        );
      }
    } finally {
      await page.close();
      await server.close();
    }
  }
  for (const v of report.inputs)
    assert.equal(
      hash(await readFile(v.path)),
      v.sha256,
      'stable source ' + v.path,
    );
  report.result =
    report.failures.length || report.pending.length ? 'failed' : 'passed';
} catch (e) {
  report.result = 'failed';
  report.failures.push({ id: 'setup', error: e.stack });
} finally {
  await browser?.close();
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(
  JSON.stringify(
    {
      result: report.result,
      checks: report.checks.length,
      failures: report.failures.map(({ id, error }) => ({
        id,
        error: String(error ?? '')
          .split(/\r?\n/, 1)[0]
          .slice(0, 300),
      })),
      pending: report.pending,
      report: join(out, 'report.json'),
    },
    null,
    2,
  ),
);
if (report.result !== 'passed') process.exitCode = 1;
