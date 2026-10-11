import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { launchDesktop } from '../test/support/desktop-test.mjs';
import { captureBrowserScreenshot } from '../test/support/screenshots.mjs';
import { readCurrentSave } from '../../apps/server/src/save-codec.mjs';
import { assertWorkspaceRoot } from '../shared/workspace-root.mjs';

assertWorkspaceRoot();
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const index = JSON.parse(
  await readFile(
    resolve('artifacts/package-payloads', `v${version}`, 'current.json'),
    'utf8',
  ),
);
const output = resolve(
  'artifacts/maintenance',
  `v${version}`,
  'windows-editions',
  index.snapshot,
  'actual-install',
  String(Date.now()),
);
await mkdir(output, { recursive: true });
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/windows-editions-'));
const run = promisify(execFile);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidence = {
  work,
  snapshot: index.snapshot,
  checks: [],
  editions: [],
  errors: [],
  scope:
    'Actual full/box shipping EXE extraction and muted hidden native WebView2 on 127.0.0.1. Fresh roots, local preinstallation, box modal, eight installed variants and preserved save/index across edition replacement. No physical phone, LAN, Safari or full-game acceptance.',
};
let desktop;
async function launch(root) {
  return launchDesktop({
    executablePath: join(root, 'app/TableMax.exe'),
    soundEnabled: false,
    env: {
      TABLEMAX_BOX_DIRECTORY: root,
      TABLEMAX_DATA_DIR: join(root, 'data'),
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      PATH: `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`,
    },
  });
}
async function footprint(root) {
  let bytes = 0;
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      assert.equal(entry.isSymbolicLink(), false);
      if (entry.isDirectory()) await visit(file);
      else bytes += (await stat(file)).size;
    }
  };
  await visit(join(root, 'app'));
  try {
    await visit(join(root, 'games'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return bytes;
}
const roots = {};
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7);
assert.ok(
  !only || only === 'full',
  'Only the full-install affected retry can be narrowed',
);
try {
  for (const edition of only ? ['full'] : ['box', 'full']) {
    const delivery = index.deliveries.find((item) => item.edition === edition);
    assert.ok(delivery);
    assert.equal(
      hash(await readFile(delivery.executable.path)),
      delivery.executable.sha256,
    );
    const root = join(work, edition);
    roots[edition] = root;
    await mkdir(root);
    await run(
      delivery.executable.path,
      [`--extract-only=${join(root, 'app')}`],
      { windowsHide: true, timeout: 120000 },
    );
    desktop = await launch(root);
    let host = await desktop.firstWindow();
    await host.locator('[data-room-revision]').waitFor();
    host.on('pageerror', (error) => evidence.errors.push(error.message));
    let origin = new URL(host.url()).origin;
    const external = [];
    await host.context().route('**/*', async (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        external.push(route.request().url());
        await route.abort();
      } else await route.continue();
    });
    const packages = await (await fetch(origin + '/api/game-packages')).json();
    assert.equal(
      Object.keys(packages.index.releases).length,
      edition === 'box' ? 0 : 8,
    );
    if (edition === 'box') {
      assert.equal(await host.locator('h1').innerText(), '请前往游戏库下载');
      assert.equal(await host.locator('.box-download-icon').count(), 1);
      const icon = await host.locator('.box-download-icon').boundingBox();
      assert.ok(icon.width >= 44 && icon.width <= 80);
    } else {
      assert.match(await host.locator('h1').innerText(), /^宝可梦奇遇/);
      assert.equal(await host.locator('.box-download-icon').count(), 0);
      assert.equal(await host.locator('.hero img').count(), 1);
      const initialResponse = await fetch(origin + '/api/session/view', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      assert.equal(initialResponse.status, 200);
      const initial = (await initialResponse.json()).view;
      const installed = packages.catalog.releases.find(
        (release) =>
          release.gameId === 'pokemon-encounters' &&
          release.variantId === 'original',
      );
      assert.ok(installed);
      assert.equal(initial.game.releaseRef, installed.releaseId);
      await desktop.close();
      desktop = undefined;
      desktop = await launch(root);
      host = await desktop.firstWindow();
      await host.getByRole('heading', { name: /^宝可梦奇遇/ }).waitFor();
      host.on('pageerror', (error) => evidence.errors.push(error.message));
      origin = new URL(host.url()).origin;
      const restartedResponse = await fetch(origin + '/api/session/view', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      assert.equal(restartedResponse.status, 200);
      assert.equal(
        (await restartedResponse.json()).view.game.releaseRef,
        installed.releaseId,
      );
      await host.context().route('**/*', async (route) => {
        if (new URL(route.request().url()).origin !== origin) {
          external.push(route.request().url());
          await route.abort();
        } else await route.continue();
      });
    }
    const library = host.getByRole('button', {
      name: edition === 'box' ? '游戏库' : '切换游戏',
      exact: true,
    });
    if (edition === 'box')
      assert.equal(await library.getAttribute('class'), 'box-library-entry');
    assert.equal(await host.locator('.room-table__seat--empty').count(), 6);
    await library.click();
    const modal = host.getByRole('dialog', { name: '游戏库', exact: true });
    await modal.waitFor();
    assert.equal(await modal.locator('[data-game-id]').count(), 6);
    if (edition === 'box') {
      assert.equal(
        await modal
          .getByRole('button', { name: '下载资源', exact: true })
          .count(),
        6,
      );
      evidence.checks.push(
        'Actual empty box shows compact download icon/title, highlighted modal entry, six empty seats and six missing-resource cards',
      );
      await captureBrowserScreenshot(host, {
        path: join(output, 'box-library.png'),
      });
    } else {
      const manifest = JSON.parse(
        await readFile(delivery.manifestPath, 'utf8'),
      );
      assert.deepEqual(
        Object.keys(packages.index.releases).sort(),
        [...manifest.preinstalled.releaseIds].sort(),
      );
      assert.equal(packages.unavailableReleaseIds.length, 0);
      assert.equal(
        packages.tasks.some((task) => task.phase === 'downloading'),
        false,
      );
      const receipts = await readdir(join(root, 'games/.preinstalled'));
      assert.equal(receipts.length, 1);
      await modal
        .locator('[data-game-id="uno"]')
        .getByRole('button', { name: '选择游戏', exact: true })
        .click();
      await host.getByRole('heading', { name: 'UNO', exact: true }).waitFor();
      assert.deepEqual(external, []);
      await captureBrowserScreenshot(host, {
        path: join(output, 'full-installed-uno.png'),
      });
      evidence.checks.push(
        'Actual full EXE installs eight exact signed releases, defaults to Pokemon original with normal cover/title across an unsaved restart, and switches to local UNO without browser external requests',
      );
    }
    const installedBytes = await footprint(root);
    assert.ok(
      installedBytes < 120_000_000,
      'Actual app plus preinstalled games must fit the extraction budget',
    );
    evidence.editions.push({
      edition,
      executableSha256: delivery.executable.sha256,
      installedRuntimeBytes: installedBytes,
      releaseCount: Object.keys(packages.index.releases).length,
    });
    await desktop.close();
    desktop = undefined;
  }
  const root = roots.full;
  const database = new DatabaseSync(join(root, 'data/room.sqlite'), {
    readOnly: true,
  });
  const before = readCurrentSave(database);
  database.close();
  const installedIndex = await readFile(join(root, 'games/index.json'));
  const box = index.deliveries.find((item) => item.edition === 'box');
  await run(box.executable.path, [`--extract-only=${join(root, 'app')}`], {
    windowsHide: true,
    timeout: 120000,
  });
  desktop = await launch(root);
  const restored = await desktop.firstWindow();
  await restored.getByRole('heading', { name: 'UNO', exact: true }).waitFor();
  assert.deepEqual(
    await readFile(join(root, 'games/index.json')),
    installedIndex,
  );
  await desktop.close();
  desktop = undefined;
  const reopened = new DatabaseSync(join(root, 'data/room.sqlite'), {
    readOnly: true,
  });
  const after = readCurrentSave(reopened);
  reopened.close();
  assert.equal(after.instanceId, before.instanceId);
  assert.equal(after.releaseRef, before.releaseRef);
  assert.deepEqual(after.snapshot, before.snapshot);
  evidence.checks.push(
    'Replacing a full installation with box EXE preserves the eight-package index, exact saved instance/release and snapshot',
  );
  assert.deepEqual(evidence.errors, []);
  evidence.passed = true;
} catch (error) {
  evidence.passed = false;
  evidence.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await desktop?.close();
  evidence.allOwnedProcessesExited = true;
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: evidence.passed,
      checks: evidence.checks.length,
      output,
      work,
    }),
  );
}
