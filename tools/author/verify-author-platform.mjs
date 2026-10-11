import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { exportAuthorToolkit } from './export-toolkit.mjs';
import { runIsolatedDevelopment } from './isolated-dev.mjs';
import { zipFiles, sha256 } from '../release/game-package-format.mjs';

const [platform, target] = process.argv.slice(2);
if (!platform || !target)
  throw new Error(
    'Usage: node tools/author/verify-author-platform.mjs <frozen-platform> <new-evidence-directory>',
  );
const root = resolve(target);
await mkdir(root, { recursive: false });
const toolkit = await exportAuthorToolkit(resolve(root, 'toolkit'));
const records = [];
const collect = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else
      records.push({
        path: relative(toolkit.output, path).replaceAll('\\', '/'),
        data: await readFile(path),
      });
  }
};
await collect(toolkit.output);
const zip = zipFiles(records);
await writeFile(resolve(root, 'TableMax-author-toolkit-1.0.6.zip'), zip);
const browserOptions = {
  headless: true,
  args: ['--mute-audio'],
  ...(existsSync(chromium.executablePath()) ? {} : { channel: 'msedge' }),
};
const results = [];
const active = new Set();
try {
  await Promise.all(
    [1, 2].map(async (number) => {
      const project = resolve(root, `project-${number}`);
      await cp(resolve(toolkit.output, 'template'), project, {
        recursive: true,
      });
      await cp(resolve(toolkit.output, 'public'), resolve(project, 'public'), {
        recursive: true,
      });
      await writeFile(
        resolve(project, 'public-freeze.json'),
        JSON.stringify({
          schemaVersion: 1,
          files: toolkit.files.filter((file) =>
            file.path.startsWith('public/'),
          ),
        }),
      );
      await mkdir(resolve(project, 'media'));
      await writeFile(
        resolve(project, 'media/badge.svg'),
        '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="20" fill="#327f55"/></svg>',
      );
      const web = resolve(project, 'games/author-example/web.tsx');
      let source = await readFile(web, 'utf8');
      source = `import badge from '../../media/badge.svg';\n${source}`.replace(
        '<h1>独立作者示例</h1>',
        '<h1>独立作者示例</h1><img src={badge} alt="作者徽记"/>',
      );
      await writeFile(web, source);
      await runIsolatedDevelopment(project, platform, {
        playMode: 'test',
        onReady: async ({ origin, hostToken, run, stop }) => {
          active.add(stop);
          const contexts = [];
          let persistent;
          try {
            persistent = await chromium.launchPersistentContext(
              resolve(run, 'browser'),
              browserOptions,
            );
            const browser = persistent.browser();
            assert.equal(
              (await fetch(`${origin}/api/foundation/health`)).status,
              200,
            );
            const errors = [];
            const hostContext = await browser.newContext({
              viewport: { width: 1280, height: 720 },
            });
            contexts.push(hostContext);
            await hostContext.addInitScript(
              (token) => sessionStorage.setItem('tablemax-host', token),
              hostToken,
            );
            const host = await hostContext.newPage();
            host.on('pageerror', () => errors.push('host-pageerror'));
            await host.goto(`${origin}/host`);
            await host
              .getByRole('heading', { name: '独立作者示例', exact: true })
              .waitFor();
            const players = [];
            const playerScopes = [];
            for (let index = 1; index <= 2; index++) {
              const context = await browser.newContext({
                viewport: { width: 390, height: 844 },
              });
              contexts.push(context);
              const page = await context.newPage();
              page.on('pageerror', () => errors.push('player-pageerror'));
              await page.goto(origin);
              const scope = page.frameLocator('iframe[data-player-frame]');
              await writeFile(
                resolve(run, `evidence/admission-${index}.json`),
                JSON.stringify(
                  {
                    url: page.url(),
                    frames: page.frames().map((frame) => frame.url()),
                    controls: await page.evaluate(() =>
                      Array.from(document.querySelectorAll('input')).map(
                        (input) => ({
                          id: input.id,
                          name: input.name,
                          type: input.type,
                          disabled: input.disabled,
                        }),
                      ),
                    ),
                  },
                  null,
                  2,
                ),
              );
              await scope
                .locator('input[name="nickname"]')
                .fill(`作者 ${number}-${index}`);
              await scope
                .getByRole('button', { name: '加入', exact: true })
                .click();
              await scope
                .getByRole('button', { name: '我准备好了', exact: true })
                .click();
              await scope
                .getByRole('button', { name: '取消准备', exact: true })
                .waitFor();
              players.push(page);
              playerScopes.push(scope);
            }
            await host
              .getByRole('button', { name: '开始游戏', exact: true })
              .click();
            await host.goto(`${origin}/host/game`);
            for (const page of players)
              await page.goto(`${origin}/player/game`);
            await host
              .getByRole('heading', { name: '独立作者示例', exact: true })
              .waitFor();
            for (const page of [host, ...playerScopes]) {
              await page.getByAltText('作者徽记').waitFor();
              assert.equal(
                await page
                  .getByAltText('作者徽记')
                  .evaluate(
                    (image) => image.complete && image.naturalWidth > 0,
                  ),
                true,
              );
            }
            for (let turn = 0; turn < 6; turn++) {
              const page = playerScopes[turn % 2];
              const button = page
                .getByRole('button', { name: /^加 1$/ })
                .first();
              await button.waitFor();
              await button.click();
              await host
                .getByText(`合计：${turn + 1}`, { exact: true })
                .waitFor();
            }
            assert.equal(
              await host.getByText('合计：6', { exact: true }).count(),
              1,
            );
            assert.equal(errors.length, 0);
            await host.screenshot({ path: resolve(run, 'evidence/host.png') });
            await players[0].screenshot({
              path: resolve(run, 'evidence/player.png'),
            });
            results.push({
              number,
              origin,
              run,
              actions: 6,
              complete: true,
              media: true,
              pageErrors: errors.length,
              browser:
                'Chromium, simulated 390px and 1280px; no physical phone claim',
            });
          } catch (error) {
            await writeFile(
              resolve(run, 'evidence/failure.json'),
              JSON.stringify(
                { message: error.message, contexts: contexts.length },
                null,
                2,
              ),
            );
            for (let index = 0; index < contexts.length; index++) {
              const page = contexts[index].pages()[0];
              if (page)
                await writeFile(
                  resolve(run, `evidence/failure-${index}.html`),
                  await page.content(),
                ).catch(() => undefined);
              if (page)
                await page
                  .screenshot({
                    path: resolve(run, `evidence/failure-${index}.png`),
                  })
                  .catch(() => undefined);
            }
            throw error;
          } finally {
            for (const context of contexts) await context.close();
            await persistent?.close();
            active.delete(stop);
            stop();
          }
        },
      });
    }),
  );
  assert.equal(new Set(results.map((item) => item.origin)).size, 2);
  assert.equal(new Set(results.map((item) => item.run)).size, 2);
  await writeFile(
    resolve(root, 'report.json'),
    JSON.stringify(
      {
        version: '1.0.6',
        id: randomUUID(),
        toolkit: {
          bytes: zip.length,
          sha256: sha256(zip),
          files: records.length,
        },
        results,
        passed: true,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: true,
      report: resolve(root, 'report.json'),
      toolkitBytes: zip.length,
    }),
  );
} finally {
  for (const stop of active) stop();
}
