import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { digest, localFile } from '../runner/evidence.mjs';
import { launchDesktop } from './desktop-test.mjs';

export async function withDeliverySession({
  root = resolve('.'),
  edition = 'full',
  legacyPublicScreen = false,
  report,
  checks,
  workDirectory,
}) {
  assert.ok(['box', 'full'].includes(edition));
  assert.equal(typeof legacyPublicScreen, 'boolean');
  report.screenContract = legacyPublicScreen
    ? 'legacy-host-public-player'
    : 'host-player';
  assert.ok(Array.isArray(checks) && checks.length);
  const { version } = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  const pointer = localFile(
      root,
      `artifacts/package-payloads/v${version}/current.json`,
    ),
    pointerBytes = await readFile(pointer);
  const index = JSON.parse(pointerBytes),
    delivery = index.deliveries.find((item) => item.edition === edition);
  assert.ok(delivery);
  const executable = localFile(root, delivery.executable.path),
    manifestPath = localFile(root, delivery.manifestPath),
    payload = localFile(root, delivery.archivePath);
  const started = performance.now();
  const manifestBytes = await readFile(manifestPath),
    manifest = JSON.parse(manifestBytes);
  assert.equal(digest(await readFile(executable)), delivery.executable.sha256);
  assert.equal(
    digest(await readFile(payload)),
    delivery.executable.payloadSha256,
  );
  assert.equal(manifest.archive.sha256, delivery.executable.payloadSha256);
  assert.equal(manifest.edition, edition);
  report.binding = {
    version,
    edition,
    snapshot: index.snapshot,
    pointerSha256: digest(pointerBytes),
    executableSha256: delivery.executable.sha256,
    payloadSha256: manifest.archive.sha256,
    manifestSha256: digest(manifestBytes),
    files: manifest.files,
  };
  report.timings = {
    bindingHashMs: performance.now() - started,
    extractMs: 0,
    extractedHashMs: 0,
    checksMs: 0,
  };
  await mkdir(join(root, 'tmp'), { recursive: true });
  const work = workDirectory
    ? localFile(root, workDirectory)
    : await mkdtemp(join(root, 'tmp/delivery-session-'));
  assert.equal(dirname(work), join(root, 'tmp'));
  assert.match(basename(work), /^delivery-session-[A-Za-z0-9]{6}$/);
  if (workDirectory) {
    assert.ok(
      !(await readdir(work)).includes('data'),
      'Reuse only extraction-only sessions, never an existing game or profile',
    );
    report.reusedExtractionDirectory = true;
  }
  const app = join(work, 'app');
  report.work = work;
  report.startups = 0;
  report.checks = [];
  const extractStarted = performance.now();
  await promisify(execFile)(executable, [`--extract-only=${app}`], {
    windowsHide: true,
    timeout: 120000,
  });
  report.timings.extractMs = performance.now() - extractStarted;
  const hashStarted = performance.now();
  let count = 0,
    bytes = 0;
  async function inventory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink());
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await inventory(path);
      else {
        count++;
        bytes += (await stat(path)).size;
      }
    }
  }
  await inventory(app);
  assert.equal(count, manifest.files.length + 1);
  assert.ok(bytes < 120000000);
  for (const file of manifest.files) {
    const path = localFile(app, file.path);
    assert.equal((await stat(path)).size, file.bytes);
    assert.equal(digest(await readFile(path)), file.sha256);
  }
  report.extractedBytes = bytes;
  report.timings.extractedHashMs = performance.now() - hashStarted;
  let desktop;
  try {
    desktop = await launchDesktop({
      executablePath: join(app, 'TableMax.exe'),
      legacyPublicWindow: legacyPublicScreen,
      soundEnabled: false,
      env: {
        TABLEMAX_BOX_DIRECTORY: work,
        TABLEMAX_DATA_DIR: join(work, 'data'),
        TABLEMAX_HOST: '127.0.0.1',
        TABLEMAX_PORT: '0',
        PATH: `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`,
      },
    });
    report.startups++;
    const host = await desktop.firstWindow();
    await host.locator('[data-room-revision]').waitFor();
    const origin = new URL(host.url()).origin;
    const partitions = {
      host: 'desktop',
      player: 'player-' + report.work,
      ...(legacyPublicScreen ? { public: 'public-' + report.work } : {}),
    };
    // Only historical-package callers may request the retired third screen.
    const publicState = legacyPublicScreen
      ? await desktop.request('new-window', {
          url: origin + '/public',
          managed: true,
          partition: partitions.public,
        })
      : null;
    const playerState = await desktop.request('new-window', {
      url: origin + '/player',
      managed: false,
      partition: partitions.player,
      width: 390,
      height: 844,
    });
    async function pageFor(id) {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        for (const page of desktop.windows())
          if (
            (await page
              .evaluate(() => window.__tablemaxWindowId)
              .catch(() => undefined)) === id
          )
            return page;
        await new Promise((done) => setTimeout(done, 50));
      }
      throw new Error('Missing isolated native context');
    }
    const publicPage = publicState ? await pageFor(publicState.id) : undefined,
      player = await pageFor(playerState.id);
    if (legacyPublicScreen) {
      assert.equal(publicState.role, 'public');
      assert.equal(publicState.managed, true);
    }
    assert.equal(playerState.role, 'player');
    assert.equal(playerState.managed, false);
    report.partitions = partitions;
    // WebView2 CDP may aggregate profiles into one protocol context. Cookie isolation proves the native partitions.
    await host.evaluate(() => {
      document.cookie = 'tablemax-acceptance-probe=host; SameSite=Strict';
    });
    for (const page of legacyPublicScreen ? [publicPage, player] : [player])
      assert.ok(
        !(await page.evaluate(() => document.cookie)).includes(
          'tablemax-acceptance-probe',
        ),
      );
    report.environment = await desktop.request('runtime');
    for (const check of checks) {
      const checkStarted = performance.now();
      await check.run({
        desktop,
        host,
        player,
        origin,
        app,
        work,
        ...(legacyPublicScreen ? { publicPage } : {}),
      });
      const durationMs = performance.now() - checkStarted;
      report.checks.push({ id: check.id, status: 'passed', durationMs });
      report.timings.checksMs += durationMs;
    }
  } finally {
    if (desktop) {
      await desktop.close();
      Object.assign(report.timings, desktop.timings);
    }
    assert.equal(
      digest(await readFile(pointer)),
      report.binding.pointerSha256,
      'Delivery pointer changed during actual EXE verification',
    );
    assert.equal(
      digest(await readFile(executable)),
      report.binding.executableSha256,
      'Shipping EXE changed during verification',
    );
  }
}
