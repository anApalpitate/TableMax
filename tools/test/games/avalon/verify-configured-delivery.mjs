import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { withDeliverySession } from '../../support/delivery-session.mjs';
import { captureBrowserScreenshot } from '../../support/screenshots.mjs';
import { assertWorkspaceRoot } from '../../../shared/workspace-root.mjs';

assertWorkspaceRoot();
const option = (name, fallback) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback;
const edition = option('edition', 'full');
assert.ok(['full', 'box'].includes(edition));
const output = resolve(
  option(
    'out',
    `artifacts/avalon/validation/configured-${edition}-${Date.now()}`,
  ),
);
await mkdir(output, { recursive: true });
const packages = resolve(
  option(
    'packages',
    'artifacts/game-packages/v1.0.6/avalon-configured-final-20261011',
  ),
);
const envelope = JSON.parse(
  await readFile(join(packages, 'TableMax-game-catalog-v1.0.6.json'), 'utf8'),
);
const release = envelope.payload.releases.find(
  (r) => r.gameId === 'avalon' && r.variantId === 'configured',
);
assert.ok(release);
const { io } = createRequire(resolve('apps/web/package.json'))(
  'socket.io-client',
);
const report = {
  result: 'running',
  startedAt: new Date().toISOString(),
  edition,
  releaseRef: release.releaseId,
  layouts: [],
  pageErrors: [],
  scope:
    'Actual shipping EXE, hidden muted native WebView2 on 127.0.0.1. Simulated 320px–4K viewports; no physical phones or LAN certification.',
};
let socket;
try {
  await withDeliverySession({
    edition,
    report,
    workDirectory: option('work'),
    checks: [
      {
        id: 'configured-package-and-three-end-rules',
        async run({ desktop, host, publicPage, player, origin }) {
          for (const page of [host, publicPage, player])
            page.on('pageerror', (error) =>
              report.pageErrors.push(error.message),
            );
          const token = await host.evaluate(() =>
            sessionStorage.getItem('tablemax-host'),
          );
          assert.ok(token);
          async function view(credential = token) {
            const response = await fetch(origin + '/api/session/view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(credential ? { token: credential } : {}),
            });
            const result = await response.json();
            assert.equal(result.ok, true);
            return result.view;
          }
          const catalog = async () =>
            (await fetch(origin + '/api/game-packages')).json();
          const visibleVariants = async () =>
            (await view()).catalog
              .find((g) => g.id === 'avalon')
              .variants.map((v) => v.id);
          assert.deepEqual(await visibleVariants(), ['configured']);
          async function importOffline(path) {
            const response = await fetch(origin + '/api/game-packages/import', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/octet-stream',
                Authorization: `Bearer ${token}`,
              },
              body: await readFile(path),
            });
            const result = await response.json();
            assert.equal(result.ok, true, result.reason);
          }
          if (edition === 'box') {
            assert.ok(
              !Object.values((await catalog()).index.releases).some(
                (r) => r.gameId === 'avalon',
              ),
            );
            // Real historical package installation must not revive its new-game selector.
            const old = JSON.parse(
              await readFile(
                'artifacts/game-packages/v1.0.6/pages-ready-20261011/TableMax-game-catalog-v1.0.6.json',
                'utf8',
              ),
            );
            const historical = old.payload.releases.find(
              (r) => r.gameId === 'avalon' && r.variantId === 'court',
            );
            assert.ok(historical);
            await importOffline(
              join(
                'artifacts/game-packages/v1.0.6/pages-ready-20261011',
                historical.offlineAsset,
              ),
            );
            assert.deepEqual(await visibleVariants(), ['configured']);
            assert.ok(
              !Object.values((await catalog()).index.releases).some(
                (r) => r.gameId === 'avalon',
              ),
            );
            await importOffline(join(packages, release.offlineAsset));
            assert.deepEqual(await visibleVariants(), ['configured']);
            await host.reload();
            await host.locator('[data-room-revision]').waitFor();
            assert.deepEqual(await visibleVariants(), ['configured']);
          }
          const installed = Object.values(
            (await catalog()).index.releases,
          ).filter((r) => r.gameId === 'avalon');
          assert.equal(installed.length, 1);
          assert.equal(installed[0].releaseId, release.releaseId);
          socket = io(origin, {
            forceNew: true,
            transports: ['websocket'],
            auth: { token },
          });
          await new Promise((done, reject) => {
            socket.once('room:view', done);
            socket.once('connect_error', reject);
          });
          async function command(command) {
            const before = await view();
            const reply = await new Promise((done, reject) =>
              socket.timeout(10000).emit(
                'room:command',
                {
                  actionId: randomUUID(),
                  instanceId: before.instanceId,
                  branch: before.branch,
                  revision: before.revision,
                  command,
                },
                (error, result) => (error ? reject(error) : done(result)),
              ),
            );
            assert.equal(reply.ok, true, JSON.stringify(reply));
          }
          await command({ type: 'select-game', gameId: 'avalon' });
          const joined = await (
            await fetch(origin + '/api/session/join', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: '规则查看者' }),
            })
          ).json();
          assert.equal(joined.ok, true);
          await player.evaluate((credential) => {
            localStorage.setItem('tablemax-player', credential);
            localStorage.setItem('tablemax-sound-muted', 'true');
          }, joined.token);
          // Mark the human ready with their own socket; the administrator never occupies a seat.
          const human = io(origin, {
            forceNew: true,
            transports: ['websocket'],
            auth: { token: joined.token },
          });
          try {
            await new Promise((done, reject) => {
              human.once('room:view', done);
              human.once('connect_error', reject);
            });
            const own = await view(joined.token);
            const reply = await new Promise((done) =>
              human.emit(
                'room:command',
                {
                  actionId: randomUUID(),
                  instanceId: own.instanceId,
                  branch: own.branch,
                  revision: own.revision,
                  command: { type: 'ready', ready: true },
                },
                done,
              ),
            );
            assert.equal(reply.ok, true);
          } finally {
            human.disconnect();
          }
          for (let i = 0; i < 9; i++)
            await command({
              type: 'add-bot',
              name: `密投${i + 1}`,
              difficulty: ['default', 'doubao', 'juewu'][i % 3],
            });
          await command({ type: 'start' });
          await command({ type: 'pause' });
          await host.goto(origin + '/host/game');
          await publicPage.goto(origin + '/public/game');
          await player.goto(origin + '/player/game');
          const surfaces = [
            [
              host,
              host,
              'host',
              [
                [1280, 720],
                [3840, 2160],
              ],
            ],
            [
              publicPage,
              publicPage,
              'public',
              [
                [1280, 720],
                [3840, 2160],
              ],
            ],
            [
              player,
              player.frameLocator('iframe[data-player-frame]'),
              'player',
              [
                [320, 568],
                [390, 844],
                [844, 390],
              ],
            ],
          ];
          for (const [page, surface, role, sizes] of surfaces) {
            await surface.locator('.avalon-screen').waitFor();
            for (const [width, height] of sizes) {
              const native = await desktop.browserWindow(page);
              await native.evaluate(
                (win, size) => win.setContentSize(size.width, size.height),
                { width, height },
              );
              const cdp = await page.context().newCDPSession(page);
              await cdp.send('Emulation.setDeviceMetricsOverride', {
                width,
                height,
                deviceScaleFactor: 1,
                mobile: role === 'player',
              });
              await cdp.detach();
              const before = await view();
              await surface
                .getByRole('button', { name: /规则/ })
                .first()
                .click();
              await surface
                .getByRole('button', { name: '角色与知识', exact: true })
                .click();
              await surface.locator('.av-rule-configurations').waitFor();
              const geometry = await surface
                .locator('.av-rule-configurations')
                .evaluate((root) => {
                  const viewport = document.documentElement.clientWidth;
                  return {
                    viewport,
                    rows: root.children.length,
                    current: root.querySelector('[data-current="true"]')
                      ?.textContent,
                    overflow: [root, ...root.querySelectorAll('*')].some(
                      (node) => {
                        const box = node.getBoundingClientRect();
                        return (
                          box.width > 0 &&
                          (box.left < -1 || box.right > viewport + 1)
                        );
                      },
                    ),
                    minimumFont: Math.min(
                      ...[...root.querySelectorAll('strong,b,span')].map(
                        (node) => parseFloat(getComputedStyle(node).fontSize),
                      ),
                    ),
                  };
                });
              assert.equal(geometry.rows, 6);
              assert.match(geometry.current, /10 人.*本局/);
              assert.equal(geometry.overflow, false);
              assert.ok(geometry.minimumFont >= 16);
              assert.equal(
                await surface.locator('.av-overlay--secret').count(),
                0,
              );
              const after = await view();
              assert.equal(after.revision, before.revision);
              assert.deepEqual(after.gameView, before.gameView);
              report.layouts.push({ role, width, height, geometry });
              if (
                (role === 'player' && width === 320) ||
                (role !== 'player' && width === 1280)
              )
                await captureBrowserScreenshot(
                  page,
                  { path: join(output, `${role}-${width}-rules.png`) },
                  { purpose: 'key' },
                );
              await surface
                .getByRole('button', { name: /关闭/ })
                .last()
                .click();
            }
          }
          const publicView = await view('');
          assert.equal(publicView.gameView.self, null);
          assert.equal(publicView.gameView.revealedRoles, null);
          assert.deepEqual(report.pageErrors, []);
        },
      },
    ],
  });
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  socket?.disconnect();
  report.finishedAt = new Date().toISOString();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      output,
      layouts: report.layouts.length,
      error: report.error,
    }),
  );
}
