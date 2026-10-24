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
      await page.goto(servers.find((s) => s.variant === item.variant).url);
      await page.waitForFunction(
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
              }[scene],
              targetStage: ['mew-target', 'mewtwo-target'].includes(scene),
              event: scene === 'weather' ? 'rain' : undefined,
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
      check.fixture = await page.evaluate(
        ({ variant, settings }) =>
          variant === 'original'
            ? window.setPokemonFixture(settings)
            : window.redesignShow(settings),
        { variant: item.variant, settings },
      );
      await page.waitForFunction(() =>
        Array.from(document.images).every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      );
      await page.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      const measure = async () =>
        page.evaluate(() => {
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
          return {
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
        await page.getByRole('button', { name: /朋友/ }).first().click();
        check.friends = await page.locator('dialog[open]').evaluate((e) => ({
          width: e.getBoundingClientRect().width,
          count: e.querySelectorAll('.friend-board, .ex-player').length,
          overflow: e.scrollWidth - e.clientWidth,
        }));
      }
      const png = join(work, `${item.id}.png`);
      await captureBrowserScreenshot(page, {
        path: png,
        fullPage: phase === 'before' || item.device === 'below-minimum',
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
        if (item.seats) {
          expect(g.boards.length === item.seats, 'Unexpected seat count');
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
        if (item.device !== 'below-minimum') {
          expect(
            g.rootOverflow <= 1,
            `Page vertical overflow ${g.rootOverflow}`,
          );
          expect(
            g.grids.every((r) => r.scroll <= 1),
            'Main seats internally scroll',
          );
          expect(
            g.boards.every((r) => r.bottom <= height + 1 && r.y >= 0),
            'Board outside first screen',
          );
        }
        expect(
          !g.nameIssues.length,
          `Card names clipped: ${g.nameIssues.join(',')}`,
        );
        if (scene === 'weather') {
          expect(
            await page.locator('.ex-event-status').isVisible(),
            'Weather status missing',
          );
          expect(
            (await page.locator('[data-score-effect="rain"]').count()) > 0,
            'Rain effective-value marker missing',
          );
        }
        if (scene === 'buffer')
          expect(
            (await page
              .locator('.ex-buffer-source .pokemon-card.face')
              .count()) > 0,
            'Occupied buffer not displayed',
          );
        if (scene === 'buffer-take')
          expect(
            (await page.locator('.ex-held-options').count()) === 0,
            'Forced buffer placement offers discard/store',
          );
        if (item.device !== 'below-minimum')
          expect(
            g.controls.every(
              (r) =>
                r.bottom <= height + 1 &&
                r.y >= 0 &&
                r.height >= 44 &&
                r.font >= 18,
            ),
            'Current confirmation/action is outside screen or below text/touch minimum',
          );
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
            (await page.locator('dialog[open]').count()) === 0,
            'Friends Escape failed',
          );
          expect(
            await page
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
            (await page.getByText('已保存', { exact: true }).count()) === 0,
            'Ordinary saved acknowledgement visible',
          );
          const changed = await measure();
          expect(
            JSON.stringify(g.boards) === JSON.stringify(changed.boards),
            'Saved message moved boards',
          );
          await update({ message: '保存失败，请重试', messageKind: 'error' });
          expect(
            await page
              .getByText('保存失败，请重试', { exact: true })
              .isVisible(),
            'Save failure hidden',
          );
          await update({ message: '正在保存…', messageKind: null, busy: true });
          expect(
            await page.getByText('正在保存…', { exact: true }).isVisible(),
            'Saving state hidden',
          );
          await update({ connected: false, message: '', messageKind: null });
          expect(
            await page.locator('.session-feedback').isVisible(),
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
            await page
              .getByRole('button', { name: '重试入座确认', exact: true })
              .isVisible(),
            'Admission retry hidden',
          );
          expect(
            await page
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
            await page
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
          const confirm = page
            .locator(
              item.variant === 'original'
                ? '.confirm-action'
                : '.ex-submit > button',
            )
            .first();
          await confirm.click();
          const count = await page.evaluate(
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
