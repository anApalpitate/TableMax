/** Actual old-framework recovery chain, including its unchanged seven hard assertions. */
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { writeFile, lstat, readFile, readdir, rename } from 'node:fs/promises';
import { record, json, noLinks, exists } from '../prepare/handoff-fixture.mjs';
import { verifyResourceCleanup } from '../../../release/installation-evidence.mjs';

export async function runFrameworkRecoveryScenario(context) {
  const {
    root,
    report,
    fixtureId,
    oldBuild,
    newBuild,
    step,
    registration,
    execute,
    actualExecutionInputs,
    evidence,
    lifecycle,
    databaseFingerprint,
    maybeJson,
    preservedData,
    work,
    waitUntil,
  } = context;

  const box = join(root, 'data');
  const oldHelper = report.old.manifest.files.find(
    (file) => file.path === 'UpdateHelper.exe',
  );
  const newHelper = report.new.manifest.files.find(
    (file) => file.path === 'UpdateHelper.exe',
  );
  for (const [value, helper] of [
    [report.old, oldHelper],
    [report.new, newHelper],
  ]) {
    const embedded =
      value.delivery.executable.installation.recipe.compiler
        .embeddedUninstallHelper;
    assert.equal(
      embedded.encoding,
      'base64',
      'Framework must contain its own embedded coordinator',
    );
    assert.equal(embedded.sha256, helper.sha256);
    assert.equal(embedded.bytes, helper.bytes);
  }
  assert.notEqual(
    oldHelper.sha256,
    newHelper.sha256,
    'The two fixture helpers must have different actual bytes',
  );
  const outside = join(root, '朋友资料.txt');
  await writeFile(outside, 'Preserved by actual old-framework recovery\n', {
    flag: 'wx',
  });
  const outsideBefore = await record(outside);
  report.frameworkRecovery = {
    productId: fixtureId,
    root,
    oldBuild,
    newBuild,
    expectedNativeExitCode: 42,
    failureRequest: 'foundation-write-and-fail-v1',
    boundary:
      'Actual fixture Inno failure and the previously installed framework uninstaller. No production identity, external data directory, real internet, genuine power-loss or successful B update claim.',
  };
  await step('framework-old-inno-install', async () => {
    assert.equal(await registration(), null);
    const result = await execute(
      actualExecutionInputs.old.path,
      [
        '/VERYSILENT',
        '/SUPPRESSMSGBOXES',
        '/NORESTART',
        '/DIR=' + root,
        '/LOG=' + join(evidence, 'framework-old-inno.log'),
      ],
      'framework-old-inno',
    );
    assert.equal(result.code, 0, result.log);
    lifecycle.installed = true;
    const current = await registration();
    assert.equal(resolve(current.InstallLocation), root);
    assert.equal(current.DisplayVersion, oldBuild);
    assert.equal(
      (await json(join(box, 'TableMax.config.json'))).dataDirectory,
      '.',
    );
    return { registration: current };
  });
  const shortcutSnapshot = async () => {
    const name = 'TableMax Installation Fixture';
    const paths = [
      ['desktop', join(root, 'fixture-shortcuts/Desktop', name + '.lnk')],
      ['launch', join(root, 'fixture-shortcuts/Start', name + '.lnk')],
      [
        'uninstall',
        join(root, 'fixture-shortcuts/Start', '卸载 ' + name + '.lnk'),
      ],
    ];
    const files = [];
    for (const [role, path] of paths) {
      await noLinks(path);
      const present = await exists(path);
      if (role !== 'desktop') assert.equal(present, true);
      if (present) assert.ok((await lstat(path)).isFile());
      files.push({
        role,
        path,
        present,
        file: present ? await record(path) : null,
      });
    }
    return files;
  };
  let frameworkBefore,
    configBefore,
    fingerprintBefore,
    registrationBefore,
    shortcutsBefore;
  await step('framework-old-bootstrap-baseline', async () => {
    frameworkBefore = await Promise.all(
      ['unins000.exe', 'unins000.dat'].map((name) => record(join(root, name))),
    );
    configBefore = await record(join(box, 'TableMax.config.json'));
    fingerprintBefore = await databaseFingerprint(box);
    registrationBefore = await registration(true);
    assert.equal(resolve(registrationBefore.InstallLocation), root);
    assert.equal(registrationBefore.DisplayVersion, oldBuild);
    assert.ok(registrationBefore.values.length > 0);
    shortcutsBefore = await shortcutSnapshot();
    assert.equal(
      (await record(join(root, 'UpdateHelper.exe'))).sha256,
      oldHelper.sha256,
    );
    report.frameworkRecovery.oldFramework = frameworkBefore;
    report.frameworkRecovery.beforeDatabaseFingerprint = fingerprintBefore;
    report.frameworkRecovery.beforeRegistration = registrationBefore;
    report.frameworkRecovery.beforeShortcuts = shortcutsBefore;
    return {
      framework: frameworkBefore,
      registration: registrationBefore,
      shortcuts: shortcutsBefore,
      oldHelperSha256: oldHelper.sha256,
      config: configBefore,
      databaseFingerprint: fingerprintBefore,
    };
  });
  let witness,
    pending,
    dataBeforeUninstall,
    uninstallIdentity,
    unknownGameBefore;
  await step('framework-new-inno-expected-health-failure', async () => {
    const innoLogPath = join(evidence, 'framework-new-failed-inno.log');
    const result = await execute(
      actualExecutionInputs.new.path,
      [
        '/VERYSILENT',
        '/SUPPRESSMSGBOXES',
        '/NORESTART',
        '/DIR=' + root,
        '/LOG=' + innoLogPath,
      ],
      'framework-new-expected-failure',
      180000,
      { TABLEMAX_HANDOFF_FRAMEWORK_FAILURE: 'foundation-write-and-fail-v1' },
    );
    assert.equal(
      result.code,
      7,
      'B must reject preparation before PerformInstall',
    );
    const innoLog = await record(innoLogPath);
    const text = await readFile(innoLogPath, 'utf8');
    const coordinator = [
      ...text.matchAll(
        /TableMax coordinator finished with exit code: ([0-9]+)\b/g,
      ),
    ];
    assert.equal(
      coordinator.length,
      1,
      'Exactly one actual coordinator exit marker is required',
    );
    const helperExitCode = Number(coordinator[0][1]);
    assert.equal(helperExitCode, 40);
    for (const marker of [
      'Starting the installation process.',
      'Saving uninstall information.',
      'Renaming uninstaller.',
      'Creating new uninstall log:',
      'Will overwrite existing uninstall log:',
      'Creating new uninstall key:',
      'Writing uninstall key values.',
      'Deleting uninstall key left over',
    ])
      assert.equal(
        text.includes(marker),
        false,
        'Rejected B reached framework writes: ' + marker,
      );
    witness = await json(join(evidence, 'framework-health-failure.json'));
    assert.equal(witness.productId, fixtureId);
    assert.equal(resolve(witness.root), root);
    assert.equal(resolve(witness.dataDirectory), box);
    assert.equal(witness.buildVersion, newBuild);
    assert.equal(witness.nodeExitCode, 0);
    assert.equal(witness.expectedNativeExitCode, 42);
    assert.equal(witness.productionEntryInvoked, false);
    assert.equal(witness.sqliteWriteCompleted, true);
    assert.notEqual(witness.beforeSha256, witness.afterSha256);
    const candidates = [];
    for (const name of await readdir(join(box, '.installation-transactions'))) {
      const directory = join(box, '.installation-transactions', name);
      const state = await maybeJson(join(directory, 'state.json'));
      if (state?.phase === 'health-failed') {
        const targetIdentity = await json(join(directory, 'target.json'));
        if (targetIdentity.buildVersion === newBuild)
          candidates.push({ directory, state, target: targetIdentity });
      }
    }
    assert.equal(
      candidates.length,
      1,
      'Exactly one failed B transaction required',
    );
    pending = candidates[0];
    assert.equal(resolve(pending.state.dataDirectory), box);
    assert.equal(pending.state.databaseFingerprint, fingerprintBefore);
    const fingerprintAfter = await databaseFingerprint(box);
    assert.notEqual(fingerprintAfter, pending.state.databaseFingerprint);
    const current = await json(join(box, '.install.json'));
    assert.equal(current.buildVersion, newBuild);
    assert.equal(current.installationId, witness.installationId);
    assert.equal(
      current.payloadManifestSha256,
      report.new.manifest.payloadManifestSha256,
    );
    const receipt = await json(join(box, '.installer-receipt.json'));
    assert.equal(receipt.sha256, report.new.delivery.executable.sha256);
    assert.equal(
      (await record(join(root, 'UpdateHelper.exe'))).sha256,
      newHelper.sha256,
    );
    assert.deepEqual(
      await record(join(box, 'TableMax.config.json')),
      configBefore,
    );
    uninstallIdentity = current;
    const unknownGamePath = join(box, 'games', '朋友保留资料.txt');
    await writeFile(
      unknownGamePath,
      'Unknown game-directory bytes remain after framework uninstall.\n',
      { flag: 'wx' },
    );
    unknownGameBefore = await record(unknownGamePath);
    dataBeforeUninstall = await preservedData(box);
    report.frameworkRecovery.failedBExitCode = result.code;
    report.frameworkRecovery.witness = witness;
    report.frameworkRecovery.failedTransaction = pending;
    report.frameworkRecovery.afterFailureDatabaseFingerprint = fingerprintAfter;
    report.frameworkRecovery.dataBeforeUninstall = dataBeforeUninstall;
    return {
      expectedFailure: true,
      installerExitCode: result.code,
      helperExitCode,
      innoLog,
      preparationRejectedBeforePerformInstall: true,
      frameworkWritesAbsent: true,
      nativeWitness: witness,
      pending,
      databaseFingerprint: fingerprintAfter,
      actualBHelperSha256: newHelper.sha256,
    };
  });
  await step('framework-old-uninstaller-retained', async () => {
    const after = await Promise.all(
      frameworkBefore.map((file) => record(file.path)),
    );
    assert.deepEqual(
      after,
      frameworkBefore,
      'Failed B must retain the actual A framework bytes',
    );
    const current = await registration(true);
    assert.equal(resolve(current.InstallLocation), root);
    assert.equal(current.DisplayVersion, oldBuild);
    assert.deepEqual(
      current,
      registrationBefore,
      'Rejected B must retain every original A registry name/kind/data value',
    );
    const shortcuts = await shortcutSnapshot();
    assert.deepEqual(
      shortcuts,
      shortcutsBefore,
      'Rejected B must retain every original A shortcut state and raw bytes',
    );
    report.frameworkRecovery.registrationAfterBFailure = current;
    report.frameworkRecovery.shortcutsAfterBFailure = shortcuts;
    return {
      framework: after,
      registration: current,
      shortcuts,
      oldFrameworkRetained: true,
      registrationRetained: true,
      shortcutsRetained: true,
    };
  });
  await step('framework-missing-live-helper', async () => {
    const path = join(root, 'UpdateHelper.exe'),
      before = await record(path);
    assert.equal(before.sha256, newHelper.sha256);
    const backup = join(work, 'fixture-missing-helper-original.exe');
    assert.equal(await exists(backup), false);
    await rename(path, backup);
    const retained = await record(backup);
    assert.equal(retained.sha256, before.sha256);
    assert.equal(retained.bytes, before.bytes);
    assert.equal(await exists(path), false);
    report.frameworkRecovery.helperFault = {
      mode: 'missing',
      original: before,
      preserved: retained,
    };
    return report.frameworkRecovery.helperFault;
  });
  await step('framework-actual-old-default-uninstall', async () => {
    assert.deepEqual(await record(frameworkBefore[0].path), frameworkBefore[0]);
    assert.deepEqual(await record(frameworkBefore[1].path), frameworkBefore[1]);
    assert.equal(await exists(join(root, 'UpdateHelper.exe')), false);
    const result = await execute(
      frameworkBefore[0].path,
      [
        '/VERYSILENT',
        '/SUPPRESSMSGBOXES',
        '/NORESTART',
        '/LOG=' + join(evidence, 'framework-actual-old-uninstall.log'),
      ],
      'framework-actual-old-default-uninstall',
    );
    assert.equal(result.code, 0, result.log);
    report.frameworkRecovery.uninstallerExitCode = result.code;
    return {
      exitCode: result.code,
      executedActualOldFramework: frameworkBefore[0],
      liveHelperWasMissing: true,
    };
  });
  await step('framework-preserved-data-and-registration', async () => {
    assert.equal(await registration(), null);
    assert.deepEqual(await record(outside), outsideBefore);
    const resourceBefore = dataBeforeUninstall
      .filter((file) => file.name.startsWith('games/'))
      .map(({ name, ...file }) => ({
        path: name.slice('games/'.length),
        ...file,
      }));
    const resourceCleanup = await verifyResourceCleanup({
      root,
      identity: uninstallIdentity,
      before: resourceBefore,
      directory: join(evidence, 'resource-cleanup'),
      name: 'final-uninstall-resources.json',
    });
    assert.deepEqual(
      await record(unknownGameBefore.path),
      unknownGameBefore,
      'Unknown game-directory file must be retained',
    );
    assert.deepEqual(
      (await preservedData(box)).filter(
        (file) => !file.name.startsWith('games/'),
      ),
      dataBeforeUninstall.filter((file) => !file.name.startsWith('games/')),
    );
    report.frameworkRecovery.resourceCleanup = resourceCleanup;
    assert.deepEqual(
      await record(join(box, 'TableMax.config.json')),
      configBefore,
    );
    for (const file of report.new.manifest.files)
      assert.equal(
        await exists(join(root, file.path)),
        false,
        'Managed file remains after default framework uninstall: ' + file.path,
      );
    await waitUntil(
      async () =>
        !(await exists(frameworkBefore[0].path)) &&
        !(await exists(frameworkBefore[1].path)),
      'Old framework self-removal',
      15000,
    );
    lifecycle.installed = false;
    report.frameworkRecovery.registrationRemoved = true;
    report.frameworkRecovery.preservedData = true;
    return {
      registrationRemoved: true,
      dataAndRequiredGamesAndConfigPreserved: true,
      resourceCleanup,
      unknown: outsideBefore,
      managedFilesRemoved: true,
      frameworkFilesRemoved: true,
    };
  });
}
