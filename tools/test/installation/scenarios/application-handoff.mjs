/** Actual positive/active fixture chains; the entry point retains final cleanup and report ownership. */
import { join, resolve } from 'node:path';
import { writeFile, mkdir, stat, readdir, readFile } from 'node:fs/promises';
import {
  record,
  noLinks,
  exists,
  writeJson,
  json,
  hash,
} from '../prepare/handoff-fixture.mjs';
import assert from 'node:assert/strict';
import { launchDesktop } from '../../support/desktop-test.mjs';
import { chromium } from 'playwright';

export async function runApplicationHandoffScenario(context) {
  const {
    root,
    step,
    registration,
    usesExternalData,
    externalDataDirectory,
    configurationPath,
    report,
    execute,
    actualExecutionInputs,
    activeUninstallOnly,
    evidence,
    lifecycle,
    oldBuild,
    fixtureId,
    profile,
    cancelledFixtureShortcuts,
    environment,
    observeOldNative,
    waitUntil,
    maybeJson,
    dataDirectory,
    gamesDirectory,
    newBuild,
    target,
    longRootExternalData,
    verifyShortLaunch,
    trust,
    verifyNextStartupCleanup,
    invokeActualUpdater,
    verifyColdUpdater,
    plan,
  } = context;
  const exerciseUpdater =
    !activeUninstallOnly && !usesExternalData && !longRootExternalData;
  async function updateEffects() {
    const updates = join(root, 'data/updates');
    const inventory = [];
    async function visit(path, relative) {
      await noLinks(path);
      if (!(await exists(path))) return;
      if ((await stat(path)).isDirectory()) {
        inventory.push({ path: relative, directory: true });
        for (const name of (await readdir(path)).sort())
          await visit(join(path, name), relative + '/' + name);
      } else {
        const value = await record(path);
        inventory.push({
          path: relative,
          bytes: value.bytes,
          sha256: value.sha256,
        });
      }
    }
    await visit(join(updates, 'downloads'), 'downloads');
    if (await exists(updates))
      for (const name of (await readdir(updates)).sort())
        if (name.startsWith('handoff-')) await visit(join(updates, name), name);
    return inventory;
  }
  const outside = join(root, '朋友资料.txt');
  await writeFile(outside, 'Preserved by actual installer and update\n');
  const outsideBefore = await record(outside);
  await step('actual-old-inno-install', async () => {
    assert.equal(await registration(), null);
    if (usesExternalData) {
      await noLinks(externalDataDirectory);
      assert.equal(await exists(externalDataDirectory), false);
      await mkdir(externalDataDirectory);
      await mkdir(join(root, 'data'));
      await writeJson(configurationPath, {
        dataDirectory: externalDataDirectory,
      });
      report.startupExternalData.configurationBefore =
        await record(configurationPath);
    }
    const run = await execute(
      actualExecutionInputs.old.path,
      [
        '/VERYSILENT',
        '/SUPPRESSMSGBOXES',
        '/NORESTART',
        '/DIR=' + root,
        ...(!activeUninstallOnly ? ['/TASKS=!desktopicon'] : []),
        '/LOG=' + join(evidence, 'old-inno.log'),
      ],
      'old-inno',
    );
    assert.equal(run.code, 0, run.log);
    lifecycle.installed = true;
    const value = await registration();
    assert.equal(resolve(value.InstallLocation), root);
    assert.equal(value.DisplayVersion, oldBuild);
    const identityPath = join(root, 'data/.install.json');
    lifecycle.oldInstallationIdentity = await json(identityPath);
    assert.equal(lifecycle.oldInstallationIdentity.productId, fixtureId);
    assert.equal(lifecycle.oldInstallationIdentity.buildVersion, oldBuild);
    assert.equal(resolve(lifecycle.oldInstallationIdentity.root), root);
    assert.equal(
      resolve(lifecycle.oldInstallationIdentity.boxRoot),
      join(root, 'data'),
    );
    assert.match(
      lifecycle.oldInstallationIdentity.installationId,
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    );
    if (profile)
      assert.equal(
        lifecycle.oldInstallationIdentity.ownerSid,
        profile.ownerSid,
      );
    if (usesExternalData) {
      assert.equal(
        (await json(configurationPath)).dataDirectory,
        externalDataDirectory,
      );
      assert.deepEqual(
        await record(configurationPath),
        report.startupExternalData.configurationBefore,
      );
    }
    return {
      registration: value,
      installationIdentity: {
        installationId: lifecycle.oldInstallationIdentity.installationId,
        ownerSid: lifecycle.oldInstallationIdentity.ownerSid,
        buildVersion: lifecycle.oldInstallationIdentity.buildVersion,
        file: await record(identityPath),
      },
      ...(!activeUninstallOnly
        ? { shortcutSelection: await cancelledFixtureShortcuts() }
        : {}),
    };
  });
  await step('actual-old-host-transport', async () => {
    let updaterEntry;
    if (exerciseUpdater) {
      const effectsBefore = await updateEffects();
      updaterEntry = {
        cold: await verifyColdUpdater(plan),
        warm: [],
        effectsBefore,
        boundary:
          'Actual Updater no-argument cold/hot entry with rendered Chinese update panel. No game is started in this entry check; unchanged Native/service PIDs do not claim an active-game preservation test.',
      };
      assert.deepEqual(await updateEffects(), effectsBefore);
    }
    try {
      lifecycle.desktop = await launchDesktop({
        executablePath: join(root, 'data/app/TableMax.exe'),
        timeout: 90000,
        env: {
          ...environment,
          TABLEMAX_BOX_DIRECTORY: join(root, 'data'),
        },
      });
    } catch (error) {
      report.nativeDiagnostics.oldLaunchError = {
        error: error.message,
        boundary:
          'launchDesktop did not return its child handle. Raw startup streams and the final child exit status are unavailable to this caller; this is the existing bounded support diagnostic.',
      };
      throw error;
    }
    lifecycle.oldNativeCapture = observeOldNative(lifecycle.desktop.process());
    const ready = await waitUntil(async () => {
      const error = await maybeJson(join(evidence, 'old-fixture-error.json'));
      if (error) throw new Error(error.error);
      return maybeJson(join(evidence, 'old-native-ready.json'));
    }, 'Actual old Native transport attachment');
    assert.equal(ready.buildVersion, oldBuild);
    assert.equal(ready.desktopPid, lifecycle.desktop.process().pid);
    assert.equal(resolve(ready.dataDirectory), dataDirectory);
    assert.equal(resolve(ready.boxRoot), join(root, 'data'));
    if (usesExternalData) {
      assert.equal(resolve(ready.dataDirectory), externalDataDirectory);
      assert.equal(resolve(ready.boxRoot), join(root, 'data'));
      assert.ok((await stat(gamesDirectory)).isDirectory());
      const gameEntries = (await readdir(gamesDirectory)).sort();
      assert.ok(
        gameEntries.length > 0,
        'Actual preinstalled G must remain under B',
      );
      assert.equal(await exists(join(externalDataDirectory, 'games')), false);
      assert.equal(
        (await json(configurationPath)).dataDirectory,
        externalDataDirectory,
      );
      report.startupExternalData.actualReady = {
        dataDirectory: ready.dataDirectory,
        boxRoot: ready.boxRoot,
        servicePid: ready.servicePid,
      };
      report.startupExternalData.gameEntries = gameEntries;
      report.startupExternalData.externalGamesPresent = false;
    }
    if (exerciseUpdater) {
      const page = await lifecycle.desktop.firstWindow();
      const runtimeBefore = await lifecycle.desktop.request('runtime');
      assert.equal(runtimeBefore.desktopPid, ready.desktopPid);
      assert.equal(runtimeBefore.servicePid, ready.servicePid);
      const directory = join(evidence, 'updater-warm');
      await mkdir(directory);
      for (let attempt = 1; attempt <= 2; attempt++) {
        const before = await page.evaluate(() => window.tablemaxUpdate.read());
        const previousEntries = new Set(await readdir(evidence));
        const updater = await invokeActualUpdater(
          directory,
          'warm-updater-' + attempt,
          plan,
        );
        const state = await waitUntil(
          async () => {
            const value = await page.evaluate(() =>
              window.tablemaxUpdate.read(),
            );
            if (value.phase === 'error')
              throw new Error(
                value.error || 'Actual warm Updater check failed',
              );
            return value.panelRequestId === before.panelRequestId + 1 &&
              value.phase === 'available'
              ? value
              : null;
          },
          'Actual warm Updater activation ' + attempt,
          90000,
        );
        assert.equal(state.targetVersion, newBuild);
        assert.equal(state.downloadedBytes, 0);
        const dialog = page.getByRole('dialog', {
          name: '程序更新',
          exact: true,
        });
        await dialog.waitFor({ state: 'visible' });
        const status = await dialog.getByRole('status').innerText();
        assert.match(status, /[\u4e00-\u9fff]/);
        const text = await dialog.innerText();
        assert.match(text, /[\u4e00-\u9fff]/);
        assert.ok(text.includes(newBuild));
        const runtime = await lifecycle.desktop.request('runtime');
        assert.equal(runtime.desktopPid, runtimeBefore.desktopPid);
        assert.equal(runtime.servicePid, runtimeBefore.servicePid);
        const entries = (await readdir(evidence)).filter(
          (name) =>
            /^updater-native-entry-\d+\.json$/.test(name) &&
            !previousEntries.has(name),
        );
        assert.equal(entries.length, 1);
        const entryPath = join(evidence, entries[0]);
        const entry = await json(entryPath);
        assert.deepEqual(entry.receivedArguments, ['--check-updates']);
        assert.deepEqual(entry.forwardedArguments, [
          '--check-updates',
          '--foundation-test',
        ]);
        assert.equal(entry.productId, fixtureId);
        assert.equal(
          entry.installationId,
          lifecycle.oldInstallationIdentity.installationId,
        );
        assert.equal(
          entry.ownerSid,
          lifecycle.oldInstallationIdentity.ownerSid,
        );
        assert.equal(entry.buildVersion, oldBuild);
        assert.equal(
          resolve(entry.modulePath),
          join(root, 'data/app/TableMax.exe'),
        );
        assert.notEqual(entry.desktopPid, ready.desktopPid);
        const screenshot = join(
          directory,
          'warm-update-panel-' + attempt + '.png',
        );
        await page.screenshot({ path: screenshot });
        assert.deepEqual(await updateEffects(), updaterEntry.effectsBefore);
        updaterEntry.warm.push({
          updater: {
            ...updater,
            stdout: await record(updater.stdout),
            stderr: await record(updater.stderr),
          },
          nativeEntry: entry,
          nativeEntryRecord: await record(entryPath),
          before,
          state,
          runtime,
          status,
          text,
          screenshot: await record(screenshot),
          boundary:
            'The actual Updater exit0 is observed through its held OS process handle. The separate transient Native writes its own original argv/PID/module/SID entry; its OS exit status is not inferred from the Updater. Redirected logs are snapshots, not an indirect-Native EOF claim.',
        });
      }
      updaterEntry.effectsAfter = await updateEffects();
    }
    return { ...ready, ...(updaterEntry ? { updaterEntry } : {}) };
  });
  if (!activeUninstallOnly) {
    const host = await lifecycle.desktop.firstWindow();
    await step('actual-check-download', async () => {
      await host.evaluate(() => window.tablemaxUpdate.check());
      const available = await waitUntil(
        async () => {
          const state = await host.evaluate(() => window.tablemaxUpdate.read());
          if (state.phase === 'error')
            throw new Error(state.error || 'Actual check failed');
          return state.phase === 'available' ? state : null;
        },
        'Actual available update',
        90000,
      );
      assert.equal(available.targetVersion, newBuild);
      await host.evaluate(() => window.tablemaxUpdate.download());
      const state = await waitUntil(
        async () => {
          const state = await host.evaluate(() => window.tablemaxUpdate.read());
          if (state.phase === 'error')
            throw new Error(state.error || 'Actual download failed');
          return state.phase === 'ready' ? state : null;
        },
        'Actual complete download',
        90000,
      );
      assert.equal(state.targetVersion, newBuild);
      const downloaded = await record(
        join(root, 'data/updates/downloads', target.sha256, target.assetName),
      );
      assert.equal(downloaded.bytes, target.bytes);
      assert.equal(downloaded.sha256, target.sha256);
      const partialPathLength =
        downloaded.path.length + 1 + 32 + '.partial'.length;
      if (profile && !longRootExternalData)
        assert.ok(
          partialPathLength >= 260,
          'The default-D profile chain must exercise the long partial IO path',
        );
      return {
        state,
        downloaded,
        partialPathPlan: {
          length: partialPathLength,
          boundary:
            'Computed from the actual downloaded path and the frozen production .32hex.partial naming rule; the transient GUID path was not independently observed.',
        },
        transport:
          'Managed response and actual new installer stream; no real internet',
      };
    });
    await step('real-apply-parent-handoff', async () => {
      const parent = lifecycle.desktop.process();
      const ended =
        parent.exitCode !== null
          ? Promise.resolve(parent.exitCode)
          : new Promise((done) => parent.once('exit', done));
      await host.evaluate(() => {
        void window.tablemaxUpdate.apply().catch(() => {});
      });
      let exitTimer;
      let code;
      try {
        code = await Promise.race([
          ended,
          new Promise((_, reject) => {
            exitTimer = setTimeout(
              () => reject(new Error('Actual parent did not exit')),
              90000,
            );
          }),
        ]);
      } finally {
        clearTimeout(exitTimer);
      }
      assert.equal(code, 0);
      return {
        parentPid: parent.pid,
        parentExitCode: code,
        realPrepareAndQuit: true,
      };
    });
    await step('actual-new-persistent-host', async () => {
      const ready = await waitUntil(
        async () => {
          const error = await maybeJson(
            join(evidence, 'new-fixture-error.json'),
          );
          if (error) throw new Error(error.error);
          return await maybeJson(join(evidence, 'new-native-ready.json'));
        },
        'Actual new host',
        180000,
      );
      assert.equal(ready.buildVersion, newBuild);
      assert.equal(ready.persistent, true);
      assert.equal(ready.currentMappingSha256, target.currentMappingSha256);
      assert.equal(resolve(ready.dataDirectory), dataDirectory);
      assert.equal(resolve(ready.boxRoot), join(root, 'data'));
      if (usesExternalData) {
        assert.equal(
          (await json(configurationPath)).dataDirectory,
          externalDataDirectory,
        );
        assert.deepEqual(
          await record(configurationPath),
          report.startupExternalData.configurationBefore,
        );
        report.startupExternalData.newActualReady = {
          dataDirectory: ready.dataDirectory,
          boxRoot: ready.boxRoot,
          servicePid: ready.servicePid,
        };
      }
      const installerFinished = await waitUntil(
        async () => {
          const directories = (
            await readdir(join(root, 'data/updates'))
          ).filter((name) => name.startsWith('handoff-'));
          assert.ok(
            directories.length <= 1,
            'Unexpected additional handoff transaction',
          );
          if (directories.length === 0) return null;
          const value = await maybeJson(
            join(root, 'data/updates', directories[0], 'handoff.json'),
          );
          if (value?.status === 'installer-failed')
            throw new Error(
              'Actual handoff installer failed: ' + value.exitCode,
            );
          return value?.status === 'installer-finished' ? value : null;
        },
        'Actual handoff installer before registration',
        180000,
      );
      assert.equal(installerFinished.exitCode, 0);
      assert.equal(resolve(installerFinished.root), root);
      assert.equal(installerFinished.buildVersion, newBuild);
      const identity = await json(join(root, 'data/.install.json'));
      assert.equal(identity.buildVersion, newBuild);
      assert.equal(
        identity.installationId,
        lifecycle.oldInstallationIdentity.installationId,
      );
      assert.equal(
        identity.ownerSid,
        lifecycle.oldInstallationIdentity.ownerSid,
      );
      assert.equal(
        identity.payloadManifestSha256,
        target.payloadManifestSha256,
      );
      const reg = await registration();
      assert.equal(reg.DisplayVersion, newBuild);
      const shortcutSelection = await cancelledFixtureShortcuts();
      lifecycle.newBrowser = await chromium.connectOverCDP(
        'http://127.0.0.1:' + ready.cdpPort,
      );
      const page = await waitUntil(
        () =>
          lifecycle.newBrowser
            .contexts()
            .flatMap((ctx) => ctx.pages())
            .find((page) => page.url().includes('/host')),
        'New host page',
      );
      const state = await page.evaluate(() => window.tablemaxUpdate.read());
      assert.equal(state.currentVersion, newBuild);
      assert.deepEqual(await record(outside), outsideBefore);
      return {
        ...ready,
        installerFinished,
        shortcutSelection,
        identity,
        registration: reg,
        actualHostState: state,
      };
    });
    await step('handoff-helper-and-data', async () => {
      const directories = (await readdir(join(root, 'data/updates'))).filter(
        (name) => name.startsWith('handoff-'),
      );
      assert.equal(directories.length, 1);
      const directory = join(root, 'data/updates', directories[0]);
      const outcome = await waitUntil(async () => {
        const value = await maybeJson(join(directory, 'handoff.json'));
        return value?.status === 'installer-finished' ? value : null;
      }, 'Actual handoff completion');
      assert.equal(outcome.exitCode, 0);
      const oldHelper = report.old.manifest.files.find(
        (file) => file.path === 'UpdateHelper.exe',
      );
      assert.equal(
        (await record(join(directory, 'UpdateHelper.exe'))).sha256,
        oldHelper.sha256,
      );
      const shortLaunch = await verifyShortLaunch(
        directory,
        outcome,
        oldHelper,
        target,
        trust,
      );
      const newHelper = report.new.manifest.files.find(
        (file) => file.path === 'UpdateHelper.exe',
      );
      assert.equal(
        (await record(join(root, 'UpdateHelper.exe'))).sha256,
        newHelper.sha256,
      );
      for (const file of report.new.manifest.files)
        assert.deepEqual(
          {
            bytes: (await stat(join(root, file.path))).size,
            sha256: hash(await readFile(join(root, file.path))),
          },
          { bytes: file.bytes, sha256: file.sha256 },
        );
      const nextStartupCleanup = await verifyNextStartupCleanup({
        directory,
        shortLaunch,
        target,
        plan,
        outside,
        outsideBefore,
      });
      return {
        outcome,
        shortLaunch,
        nextStartupCleanup,
        temporaryHelperSha256: oldHelper.sha256,
        newOwnedHelperSha256: newHelper.sha256,
      };
    });
  }
}
