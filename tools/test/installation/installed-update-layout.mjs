import assert from 'node:assert/strict';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SETTINGS_VIEWPORTS,
  inspectSettingsPanel,
  installSettingsTextStress,
  restoreSettingsTextStress,
} from '../box/settings-layout-measurement.mjs';
import { digest, fileRecord } from '../runner/evidence.mjs';
import { failureLimit } from '../runner/failure-policy.mjs';
import { saveVerificationScreenshot } from '../support/screenshots.mjs';
import { noLinks } from '../../release/installation-evidence.mjs';
import { INSTALLATION_PRODUCT_ID } from '../../release/installation-package.mjs';

/** Uses the already authenticated first installed Native, before default uninstall. */
export async function verifyInstalledUpdateLayout({
  desktop,
  page,
  root,
  identity,
  profile,
  output,
}) {
  const workspace = resolve('.');
  root = resolve(root);
  output = resolve(output);
  assert.ok(profile && profile.integritySid === 'S-1-16-8192');
  assert.equal(identity.productId, INSTALLATION_PRODUCT_ID);
  assert.equal(identity.ownerSid, profile.ownerSid);
  assert.equal(resolve(identity.root), root);
  assert.equal(resolve(identity.boxRoot), join(root, 'data'));
  assert.ok(root.startsWith(resolve(profile.workParent) + sep));
  assert.ok(
    output.startsWith(resolve(workspace, 'artifacts/maintenance') + sep),
  );
  await noLinks(root);
  await noLinks(output);
  await assert.rejects(lstat(output), { code: 'ENOENT' });
  const identityPath = join(root, 'data/.install.json');
  const identityBytes = await readFile(identityPath);
  assert.deepEqual(JSON.parse(identityBytes), identity);
  const nativePath = join(root, 'data/app/TableMax.exe');
  const nativeBytes = await readFile(nativePath);
  const declaredNative = identity.files.find(
    (file) => file.path === 'data/app/TableMax.exe',
  );
  assert.ok(declaredNative, 'The actual installed Native must be declared');
  assert.equal(nativeBytes.length, declaredNative.bytes);
  assert.equal(digest(nativeBytes), declaredNative.sha256);
  const id = await page.evaluate(() => window.__tablemaxWindowId);
  const original = (await desktop.request('windows')).find(
    (window) => window.id === id,
  );
  assert.ok(original && original.role === 'host' && original.managed);
  assert.equal(original.visible, false, 'Use the existing hidden Native');
  assert.equal(
    original.audioMuted,
    true,
    'Installed layout acceptance stays muted',
  );
  assert.equal(new URL(page.url()).hostname, '127.0.0.1');
  const nativeWindow = await desktop.browserWindow(page);
  const methodSources = [
    fileRecord(workspace, fileURLToPath(import.meta.url)),
    fileRecord(
      workspace,
      fileURLToPath(
        new URL('../box/settings-layout-measurement.mjs', import.meta.url),
      ),
    ),
  ];
  const reportPath = join(output, 'report.json');
  const report = {
    schemaVersion: 1,
    kind: 'actual-installed-program-update-layout',
    result: 'running',
    startedAtUtc: new Date().toISOString(),
    productId: identity.productId,
    installationId: identity.installationId,
    ownerSid: identity.ownerSid,
    buildVersion: identity.buildVersion,
    installRoot: root,
    executionProfile: profile,
    installationIdentitySha256: digest(identityBytes),
    native: {
      path: nativePath,
      bytes: nativeBytes.length,
      sha256: digest(nativeBytes),
    },
    methodSources,
    originalWindow: original,
    cases: [],
    checks: [],
    remaining: SETTINGS_VIEWPORTS.flatMap((size) =>
      ['normal', 'text-stress'].map((state) => `${size.label}-${state}`),
    ),
    failures: 0,
    pageErrors: [],
    failureLimit: failureLimit(),
    evidence: [],
    boundary:
      'Existing actual production installation and authenticated standard Medium profile Native. Local update.read only; no check/download/apply, snapshot replacement, identity fixture, installed files or game commands. Text-only stress is separate layout evidence. Window/DPI geometry is simulated, not physical-device certification.',
  };
  await mkdir(output);
  const save = () =>
    writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  await save();
  let cdp;
  let failure;
  const observeError = (error) => report.pageErrors.push(error.message);
  page.on('pageerror', observeError);
  const panel = page.getByRole('dialog', { name: '程序更新', exact: true });
  const roomState = () =>
    page.evaluate(async () => {
      const token = sessionStorage.getItem('tablemax-host');
      if (!token)
        throw new Error('The existing installed host is unauthenticated');
      const response = await fetch('/api/session/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const value = await response.json();
      if (!response.ok || !value.ok)
        throw new Error('The actual installed room view was rejected');
      const { instanceId, branch, revision, status } = value.view;
      return { instanceId, branch, revision, status };
    });
  const capture = async (name, context) => {
    const bytes = Buffer.from(
      await nativeWindow.evaluate(async (window) =>
        (await window.webContents.capturePage()).toPNG().toString('base64'),
      ),
      'base64',
    );
    const retained = await saveVerificationScreenshot(
      join(output, name + '.png'),
      bytes,
      { mustKeep: true, context },
    );
    const record = fileRecord(workspace, join(output, retained.path));
    report.evidence.push(record);
    return {
      ...record,
      width: retained.width,
      height: retained.height,
      sourceSha256: retained.sourceSha256,
    };
  };
  try {
    await page.waitForFunction(
      () => typeof window.tablemaxUpdate?.read === 'function',
    );
    const initial = await page.evaluate(() => window.tablemaxUpdate.read());
    assert.equal(initial.currentVersion, identity.buildVersion);
    assert.equal(
      initial.supported,
      true,
      'The genuine installed update capability must be supported',
    );
    report.initialUpdate = initial;
    report.checks.push({
      id: 'genuine-installed-update-read-and-current-identity',
      result: 'passed',
    });
    report.roomBefore = await roomState();
    await page.getByRole('button', { name: '程序更新', exact: true }).click();
    await panel.waitFor();
    cdp = await page.context().newCDPSession(page);
    for (const size of SETTINGS_VIEWPORTS) {
      await nativeWindow.evaluate(
        (window, dimensions) =>
          window.setContentSize(dimensions.width, dimensions.height),
        size,
      );
      const state = await desktop.request('window', {
        id,
        operation: 'geometry',
        geometry: {
          viewport: { width: size.width, height: size.height },
          screen: {
            width: size.width,
            height: size.height,
            scaleFactor: size.density,
          },
        },
      });
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 0,
        height: 0,
        deviceScaleFactor: size.density,
        mobile: false,
      });
      const expected = {
        width: Math.round(state.content[0] / state.zoom),
        height: Math.round(state.content[1] / state.zoom),
      };
      await page.waitForFunction(
        ({ width, height }) =>
          Math.abs(innerWidth - width) <= 1 &&
          Math.abs(innerHeight - height) <= 1,
        expected,
        { timeout: 15000 },
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        );
      });
      try {
        for (const stress of [false, true]) {
          const fixture = stress
            ? await installSettingsTextStress(page)
            : undefined;
          if (fixture) assert.ok(fixture.changedTextNodes > 0);
          const name = `${size.label}-${stress ? 'text-stress' : 'normal'}`;
          const measurement = await inspectSettingsPanel(page);
          const screenshot = await capture(name, {
            state: stress
              ? 'layout-text-fixture'
              : 'normal-production-rendering',
            requestedGeometry: size,
          });
          report.cases.push({
            id: name,
            state: stress
              ? 'layout-text-fixture'
              : 'normal-production-rendering',
            requestedGeometry: size,
            nativeState: state,
            fixture,
            ...measurement,
            screenshot,
          });
          report.checks.push({
            id: name,
            result: measurement.issues.length ? 'failed' : 'passed',
          });
          report.remaining.shift();
          if (measurement.issues.length) report.failures++;
          await save();
          assert.ok(
            report.failures < report.failureLimit,
            'Installed update layout reached its failed-case budget; remaining cases were not dispatched',
          );
        }
      } finally {
        await restoreSettingsTextStress(page);
      }
    }
    assert.equal(
      report.failures,
      0,
      'Actual installed update panel has layout issues; inspect the saved cases and PNGs',
    );
    report.finalUpdate = await page.evaluate(() =>
      window.tablemaxUpdate.read(),
    );
    assert.deepEqual(
      report.finalUpdate,
      report.initialUpdate,
      'Layout checks must not request or change update state',
    );
    report.roomAfter = await roomState();
    assert.deepEqual(
      report.roomAfter,
      report.roomBefore,
      'Layout checks must not change the saved room',
    );
    report.checks.push({
      id: 'update-state-and-saved-room-unchanged',
      result: 'passed',
    });
    assert.deepEqual(
      report.pageErrors,
      [],
      'The actual settings UI must not raise page errors',
    );
  } catch (cause) {
    failure = cause;
    report.failure = cause.message;
    await capture('failure-installed-update-layout', {
      state: 'failure',
    }).catch((error) => {
      report.failureCaptureError = error.message;
    });
  } finally {
    const cleanup = async (name, action) => {
      try {
        await action();
      } catch (error) {
        (report.cleanupErrors ??= []).push({ name, reason: error.message });
        failure ??= error;
      }
    };
    await cleanup('restore-layout-text', () => restoreSettingsTextStress(page));
    await cleanup('close-program-update-panel', async () => {
      if (await panel.count())
        await panel
          .getByRole('button', { name: '关闭面板', exact: true })
          .click();
      assert.equal(await panel.count(), 0);
    });
    await cleanup('clear-device-metrics', async () => {
      if (cdp) {
        await cdp.send('Emulation.clearDeviceMetricsOverride');
        await cdp.detach();
      }
    });
    await cleanup('restore-window-geometry', async () => {
      await desktop.request('window', {
        id,
        operation: 'geometry',
        clear: true,
      });
      await nativeWindow.evaluate(
        (window, dimensions) =>
          window.setContentSize(dimensions[0], dimensions[1]),
        original.content,
      );
      report.restoredWindow = (await desktop.request('windows')).find(
        (window) => window.id === id,
      );
      assert.equal(report.restoredWindow.mode, original.mode);
      assert.equal(report.restoredWindow.visible, false);
      for (let index = 0; index < 2; index++)
        assert.ok(
          Math.abs(
            report.restoredWindow.content[index] - original.content[index],
          ) <= 1,
        );
      assert.ok(Math.abs(report.restoredWindow.zoom - original.zoom) < 0.01);
    });
    await cleanup('verify-original-identity-and-methods', async () => {
      assert.equal(digest(await readFile(identityPath)), digest(identityBytes));
      assert.equal(digest(await readFile(nativePath)), digest(nativeBytes));
      for (const record of methodSources)
        assert.deepEqual(fileRecord(workspace, record.path), record);
    });
    if (!report.cleanupErrors?.length)
      report.checks.push({
        id: 'text-panel-window-and-original-identity-restored',
        result: 'passed',
      });
    const screenshotIndex = join(output, 'screenshot-index.json');
    if (report.evidence.length)
      report.evidence.push(fileRecord(workspace, screenshotIndex));
    report.result = failure ? 'failed' : 'passed';
    report.finishedAtUtc = new Date().toISOString();
    page.off('pageerror', observeError);
    await save();
  }
  if (failure)
    throw new Error(
      `Actual installed update layout failed; evidence: ${reportPath}; ${failure.message}`,
      { cause: failure },
    );
  return {
    ...report,
    evidence: [fileRecord(workspace, reportPath), ...report.evidence],
  };
}
