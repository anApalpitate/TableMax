import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { withDeliverySession } from '../support/delivery-session.mjs';
import { captureBrowserScreenshot } from '../support/screenshots.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
const output =
  process.env.TABLEMAX_TEST_OUTPUT_DIR ??
  resolve(
    'artifacts/maintenance/v1.0.6/test-flow-optimization',
    'session-' + Date.now(),
  );
await mkdir(output, { recursive: true });
const report = {
  result: 'started',
  startedAt: new Date().toISOString(),
  kind: 'actual-shipping-box-exe',
  scope:
    'One extracted shipping box EXE, three independent native profiles, muted hidden WebView2 on loopback. Representative UI/permission checks, not first-start/restart/migration/crash/full-game or physical-device acceptance.',
};
try {
  await withDeliverySession({
    edition: 'box',
    legacyPublicScreen: true,
    report,
    checks: [
      {
        id: 'isolated-role-pages',
        async run({ host, publicPage, player }) {
          for (const page of [host, publicPage])
            await page
              .getByRole('heading', { name: '请前往游戏库下载', exact: true })
              .waitFor();
          await player.locator('iframe[data-player-frame]').waitFor();
          await captureBrowserScreenshot(
            host,
            { path: join(output, 'host.png') },
            { purpose: 'key' },
          );
          await captureBrowserScreenshot(
            publicPage,
            { path: join(output, 'public.png') },
            { purpose: 'key' },
          );
          await captureBrowserScreenshot(
            player,
            { path: join(output, 'player.png') },
            { purpose: 'key' },
          );
        },
      },
      {
        id: 'library-and-readonly-permission',
        async run({ host, publicPage }) {
          await host
            .getByRole('button', { name: '游戏库', exact: true })
            .click();
          await host
            .getByRole('region', { name: '游戏库', exact: true })
            .waitFor();
          await publicPage
            .getByRole('button', { name: '游戏库', exact: true })
            .click();
          await publicPage
            .getByRole('region', { name: '游戏库', exact: true })
            .waitFor();
          assert.equal(
            await publicPage
              .getByRole('button', { name: '下载资源', exact: true })
              .count(),
            0,
          );
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
  report.finishedAt = new Date().toISOString();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    result: report.result,
    startups: report.startups,
    timings: report.timings,
    report: join(output, 'results.json'),
  }),
);
