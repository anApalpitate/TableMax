import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { hash } from './installation-toolchain.mjs';
import {
  extractApplicationUpdate,
  validateApplicationUpdateDescription,
  verifyApplicationUpdate,
} from '../shared/application-update.mjs';
import { INSTALLATION_PRODUCT_ID } from './installation-package.mjs';
import { MAXIMUM_PACKAGE_BYTES } from './package-limits.mjs';

export function installationUpdateDescription(delivery, releaseVersion) {
  assert.equal(delivery.deliveryType, 'installer');
  assert.equal(delivery.executable.type, 'installer');
  assert.equal(
    delivery.executable.installation.productId,
    INSTALLATION_PRODUCT_ID,
  );
  assert.equal(delivery.executable.installation.installProtocol, 1);
  assert.ok(
    delivery.executable.bytes > 0 &&
      delivery.executable.bytes < MAXIMUM_PACKAGE_BYTES,
  );
  const installation = delivery.executable.installation;
  assert.equal(installation.productId, INSTALLATION_PRODUCT_ID);
  const assetName = `TableMax-${releaseVersion}-win-x64.exe`;
  return validateApplicationUpdateDescription({
    schemaVersion: 1,
    productId: INSTALLATION_PRODUCT_ID,
    channel: 'stable',
    os: 'windows',
    arch: 'x64',
    installProtocol: 1,
    releaseVersion,
    buildVersion: delivery.buildVersion ?? delivery.executable.buildVersion,
    releaseTag: 'v' + releaseVersion,
    repo: 'anApalpitate/TableMax',
    assetName,
    assetUrl: `https://github.com/anApalpitate/TableMax/releases/download/v${releaseVersion}/${assetName}`,
    bytes: delivery.executable.bytes,
    sha256: delivery.executable.sha256,
    payloadManifestSha256: installation.payloadManifestSha256,
    currentMappingSha256: installation.currentMappingSha256,
  });
}

export async function loadIsolationEvidence(proof) {
  assert.equal(typeof proof.isolationEvidencePath, 'string');
  const path = proof.isolationEvidencePath;
  assert.ok(
    path.startsWith('artifacts/maintenance/') &&
      !path.includes('\\') &&
      !path.includes(':') &&
      !path.split('/').some((part) => !part || part === '.' || part === '..'),
    'Isolation evidence must be a workspace-relative maintenance path',
  );
  const absolute = resolve(path);
  assert.ok(absolute.startsWith(resolve('artifacts/maintenance') + sep));
  for (let cursor = absolute; ; cursor = dirname(cursor)) {
    assert.ok(
      !(await lstat(cursor)).isSymbolicLink(),
      'Isolation evidence contains a link',
    );
    if (dirname(cursor) === cursor) break;
  }
  const raw = await readFile(absolute);
  return {
    isolationEvidence: JSON.parse(raw.toString('utf8')),
    isolationEvidenceSha256: hash(raw),
  };
}

export function verifyLifecycleAndCapacity(proof) {
  const verifyRegistration = (registration) => {
    assert.equal(registration.DisplayName, 'TableMax');
    assert.equal(registration.DisplayVersion, proof.buildVersion);
    assert.equal(
      resolve(registration.InstallLocation),
      resolve(proof.installRoot),
    );
    assert.equal(
      registration.UninstallString,
      '"' + resolve(proof.installRoot, 'unins000.exe') + '"',
    );
  };
  const verifyLinks = (links) => {
    assert.equal(links.length, 3);
    assert.equal(
      links.filter(
        (link) =>
          resolve(link.target) === resolve(proof.installRoot, 'TableMax.exe'),
      ).length,
      2,
    );
    assert.equal(
      links.filter(
        (link) =>
          resolve(link.target) === resolve(proof.installRoot, 'unins000.exe'),
      ).length,
      1,
    );
    for (const link of links) {
      assert.equal(resolve(link.workingDirectory), resolve(proof.installRoot));
      assert.equal(link.arguments, '');
    }
  };
  assert.equal(proof.reinstall.result, 'passed');
  verifyRegistration(proof.registration);
  verifyRegistration(proof.reinstall.registration);
  verifyLinks(proof.shortcuts);
  verifyLinks(proof.reinstall.shortcuts);
  assert.deepEqual(proof.reinstall.shortcuts, proof.shortcuts);
  const restored = proof.postUninstallReinstall;
  assert.equal(restored.result, 'passed');
  for (const flag of [
    'actualInstaller',
    'sameRoot',
    'sameInstaller',
    'firstUninstalled',
    'finalUninstalled',
    'defaultUninstall',
  ])
    assert.equal(restored[flag], true);
  assert.equal(resolve(restored.root), resolve(proof.installRoot));
  assert.equal(restored.ownerSid, proof.ownerSid);
  assert.equal(restored.installerSha256, proof.installerSha256);
  assert.equal(restored.buildVersion, proof.buildVersion);
  assert.equal(restored.originalInstallationId, proof.installationId);
  assert.ok(
    typeof restored.installationId === 'string' && restored.installationId,
  );
  for (const native of [restored.initialNative, restored.restoredNative]) {
    assert.ok(Number.isInteger(native.desktopPid) && native.desktopPid > 0);
    assert.ok(Number.isInteger(native.servicePid) && native.servicePid > 0);
    assert.equal(native.appVersion, proof.buildVersion);
    assert.equal(resolve(native.dataDirectory), resolve(proof.boxRoot));
    assert.equal(native.exitCode, 0);
    assert.ok(
      typeof native.publicState.instanceId === 'string' &&
        native.publicState.instanceId,
    );
    assert.ok(
      typeof native.publicState.seatId === 'string' &&
        native.publicState.seatId,
    );
    assert.ok(native.publicState.releaseRef);
    assert.equal(native.publicState.status, 'lobby');
  }
  assert.deepEqual(
    restored.restoredNative.publicState,
    restored.initialNative.publicState,
  );
  for (const group of ['firstUninstall', 'finalUninstall']) {
    const databases = restored.databases[group];
    assert.ok(Array.isArray(databases.before));
    assert.equal(
      new Set(databases.before.map((file) => file.path)).size,
      databases.before.length,
    );
    for (const name of ['foundation.sqlite', 'room.sqlite'])
      assert.ok(databases.before.some((file) => file.path === name));
    for (const file of databases.before) {
      assert.match(
        file.path,
        /^(foundation\.sqlite(?:-(?:wal|shm|journal))?|room\.sqlite(?:-(?:wal|shm|journal)|\.migration\.(?:json|lock))?)$/,
      );
      assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
      assert.match(file.sha256, /^[a-f0-9]{64}$/);
    }
    assert.deepEqual(databases.after, databases.before);
  }
  verifyLinks(restored.shortcuts);
  verifyRegistration(restored.registration);
  assert.deepEqual(restored.shortcuts, proof.shortcuts);
  assert.equal(restored.footprint.programBytes, proof.footprint.programBytes);
  assert.equal(
    restored.footprint.currentGamesBytes,
    proof.footprint.currentGamesBytes,
  );
  assert.ok(
    restored.footprint.frameworkBytes > 0 &&
      restored.footprint.identityBytes > 0,
  );
  assert.equal(
    restored.footprint.total,
    restored.footprint.programBytes +
      restored.footprint.frameworkBytes +
      restored.footprint.identityBytes +
      restored.footprint.currentGamesBytes,
  );
  assert.ok(restored.footprint.total < MAXIMUM_PACKAGE_BYTES);
  const accounting = proof.capacityAccounting;
  assert.equal(accounting.schemaVersion, 1);
  assert.equal(
    accounting.observation,
    'installer-returned-after-health-startup',
  );
  assert.equal(accounting.preStartupSampled, false);
  assert.equal(accounting.sameSample, true);
  assert.ok(Number.isFinite(Date.parse(accounting.observedAtUtc)));
  assert.equal(
    accounting.firstInstallationProgramBytes,
    proof.footprint.programBytes +
      proof.footprint.frameworkBytes +
      proof.footprint.identityBytes,
  );
  assert.equal(
    accounting.firstStartupMaterializedGamesBytes,
    proof.footprint.currentGamesBytes,
  );
  assert.equal(accounting.firstStartupTotalBytes, proof.firstStartupBytes);
  const observed = proof.observedStorage;
  assert.equal(observed.schemaVersion, 1);
  assert.equal(observed.isAbsolutePeak, false);
  assert.deepEqual(
    observed.samples.map((sample) => sample.phase),
    [
      'after-install',
      'after-repeat-install',
      'before-first-uninstall',
      'after-first-uninstall',
      'after-restored-install',
      'before-final-uninstall',
      'after-final-uninstall',
    ],
  );
  const categories = [
    'program',
    'framework',
    'metadata',
    'currentGames',
    'historicalGames',
    'savedData',
    'browserCache',
    'logs',
    'updates',
    'transactions',
    'otherRetainedData',
    'unknownUserFiles',
  ];
  for (const sample of observed.samples) {
    assert.ok(Number.isFinite(Date.parse(sample.observedAtUtc)));
    assert.deepEqual(
      Object.keys(sample.categories).sort(),
      [...categories].sort(),
    );
    const paths = [];
    for (const name of categories) {
      const category = sample.categories[name];
      assert.ok(Number.isSafeInteger(category.bytes) && category.bytes >= 0);
      assert.equal(
        category.bytes,
        category.files.reduce((sum, file) => {
          assert.ok(
            typeof file.path === 'string' &&
              file.path &&
              !file.path.includes('\\') &&
              !file.path.includes(':') &&
              file.path
                .split('/')
                .every((part) => part && part !== '.' && part !== '..'),
          );
          assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
          paths.push(file.path);
          return sum + file.bytes;
        }, 0),
      );
    }
    assert.equal(new Set(paths).size, paths.length);
    assert.equal(
      sample.rootBytes,
      categories.reduce((sum, name) => sum + sample.categories[name].bytes, 0),
    );
    assert.equal(
      sample.installerTemporary.bytes,
      sample.installerTemporary.files.reduce((sum, file) => {
        assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
        return sum + file.bytes;
      }, 0),
    );
    assert.ok(
      Number.isSafeInteger(sample.executionCopyBytes) &&
        sample.executionCopyBytes > 0,
    );
    assert.equal(
      sample.totalObservedBytes,
      sample.rootBytes +
        sample.installerTemporary.bytes +
        sample.executionCopyBytes,
    );
    if (sample.phase.includes('after-') && sample.phase.endsWith('uninstall')) {
      assert.equal(sample.categories.program.bytes, 0);
      assert.equal(sample.categories.framework.bytes, 0);
    }
  }
  const first = observed.samples[0].categories;
  assert.equal(first.program.bytes, proof.footprint.programBytes);
  assert.equal(first.framework.bytes, proof.footprint.frameworkBytes);
  assert.equal(first.metadata.bytes, proof.footprint.identityBytes);
  assert.equal(first.currentGames.bytes, proof.footprint.currentGamesBytes);
  for (const [phase, group] of [
    ['before-first-uninstall', 'firstUninstall'],
    ['after-first-uninstall', 'firstUninstall'],
    ['before-final-uninstall', 'finalUninstall'],
    ['after-final-uninstall', 'finalUninstall'],
  ]) {
    const sample = observed.samples.find((item) => item.phase === phase);
    assert.equal(
      sample.categories.savedData.bytes,
      restored.databases[group].before.reduce(
        (sum, file) => sum + file.bytes,
        0,
      ),
    );
  }
  assert.equal(
    observed.maxObservedBytes,
    Math.max(...observed.samples.map((sample) => sample.totalObservedBytes)),
  );
}

/** Pure acceptance gate shared by local promotion and publication. */
export function verifyInstallationAcceptance({
  delivery,
  proof,
  payloadManifest,
  payloadManifestSha256,
  payloadManifestByteLength,
  installationManifest,
  installationManifestSha256,
  snapshot,
  releaseVersion,
  buildVersion,
  isolationEvidence,
  isolationEvidenceSha256,
}) {
  assert.equal(delivery.deliveryType, 'installer');
  assert.equal(delivery.executable.type, 'installer');
  assert.equal(
    delivery.executable.installation.productId,
    INSTALLATION_PRODUCT_ID,
  );
  assert.equal(delivery.executable.installation.installProtocol, 1);
  assert.ok(
    delivery.executable.bytes > 0 &&
      delivery.executable.bytes < MAXIMUM_PACKAGE_BYTES,
  );
  assert.ok(
    payloadManifest.archive.bytes > 0 &&
      payloadManifest.archive.bytes < MAXIMUM_PACKAGE_BYTES,
  );
  assert.equal(proof.result, 'passed');
  assert.equal(proof.deliveryType, 'installer');
  assert.equal(
    proof.fixture,
    false,
    'Test product identity cannot authorize production publication',
  );
  assert.equal(proof.productId, INSTALLATION_PRODUCT_ID);
  assert.equal(
    proof.isolatedWindows,
    true,
    'Production installer proof must record actual isolated Windows acceptance',
  );
  assert.equal(installationManifest.schemaVersion, 1);
  assert.equal(installationManifest.productId, INSTALLATION_PRODUCT_ID);
  assert.equal(installationManifest.arch, 'x64');
  assert.equal(installationManifest.installProtocol, 1);
  assert.equal(installationManifest.releaseVersion, releaseVersion);
  assert.equal(installationManifest.buildVersion, buildVersion);
  assert.equal(
    installationManifest.payloadManifestSha256,
    payloadManifestSha256,
  );
  assert.equal(
    installationManifest.payloadManifestSha256,
    delivery.executable.installation.payloadManifestSha256,
  );
  assert.equal(
    installationManifest.currentMappingSha256,
    delivery.executable.installation.currentMappingSha256,
  );
  assert.equal(
    installationManifestSha256,
    delivery.executable.installation.manifestSha256,
  );
  assert.equal(proof.snapshot, snapshot);
  assert.equal(proof.executableSha256, delivery.executable.sha256);
  assert.equal(proof.installerSha256, delivery.executable.sha256);
  assert.equal(proof.executableBytes, delivery.executable.bytes);
  assert.equal(
    proof.installationManifestSha256,
    delivery.executable.installation.manifestSha256,
  );
  assert.equal(proof.payloadSha256, payloadManifest.archive.sha256);
  assert.equal(proof.buildVersion, buildVersion);
  assert.equal(proof.version, releaseVersion);
  assert.ok(
    proof.firstStartupBytes > 0 &&
      proof.firstStartupBytes < MAXIMUM_PACKAGE_BYTES,
  );
  assert.equal(proof.footprint.total, proof.firstStartupBytes);
  assert.equal(
    proof.footprint.programBytes,
    installationManifest.files.reduce((sum, file) => sum + file.bytes, 0),
  );
  assert.ok(
    proof.footprint.frameworkBytes > 0 && proof.footprint.currentGamesBytes > 0,
  );
  assert.equal(
    proof.footprint.programBytes +
      proof.footprint.frameworkBytes +
      proof.footprint.identityBytes +
      proof.footprint.currentGamesBytes,
    proof.firstStartupBytes,
  );
  assert.ok(proof.installRoot && proof.boxRoot && proof.runtimeRoot);
  assert.equal(
    proof.uninstalled,
    true,
    'Diagnostic keep-installed proof cannot authorize promotion or publication',
  );
  assert.equal(proof.runtimeRoot, proof.extracted);
  assert.equal(resolve(proof.boxRoot), resolve(proof.installRoot, 'TableMax'));
  assert.equal(resolve(proof.runtimeRoot), resolve(proof.boxRoot, 'app'));
  const copy = proof.verifiedRuntime;
  assert.ok(copy && proof.verifiedRuntimeRoot);
  assert.equal(copy.path, proof.verifiedRuntimeRoot);
  assert.equal(copy.sourceRuntimeRoot, proof.runtimeRoot);
  assert.equal(copy.installationId, proof.installationId);
  assert.equal(copy.executableSha256, delivery.executable.sha256);
  assert.equal(copy.payloadSha256, payloadManifest.archive.sha256);
  assert.equal(copy.payloadManifestSha256, payloadManifestSha256);
  const members = [
    ...payloadManifest.files,
    {
      path: '.tablemax-release.json',
      bytes: payloadManifestByteLength,
      sha256: payloadManifestSha256,
    },
  ].sort((a, b) => a.path.localeCompare(b.path));
  assert.equal(copy.fileCount, members.length);
  assert.deepEqual(copy.files, members);
  assert.equal(isolationEvidence.schemaVersion, 1);
  assert.equal(isolationEvidence.kind, 'temporary-standard-user');
  assert.equal(isolationEvidence.result, 'passed');
  assert.equal(isolationEvidence.ownerSid, proof.ownerSid);
  assert.equal(isolationEvidence.accountSid, proof.ownerSid);
  assert.equal(isolationEvidence.installerSha256, delivery.executable.sha256);
  assert.equal(isolationEvidence.freshAccount, true);
  assert.equal(isolationEvidence.standardAccount, true);
  assert.equal(isolationEvidence.profileLoaded, true);
  assert.equal(isolationEvidence.accountRemoved, true);
  assert.equal(isolationEvidence.profileRemoved, true);
  assert.equal(isolationEvidence.exitCode, 0);
  assert.deepEqual(isolationEvidence.errors, []);
  assert.match(isolationEvidence.account, /^TMVerify_[a-f0-9]{8}$/);
  assert.equal(proof.environment.ownerSid, proof.ownerSid);
  assert.equal(proof.environment.elevated, false);
  assert.equal(
    proof.environment.profile.replaceAll('\\', '/').split('/').at(-1),
    isolationEvidence.account,
  );
  assert.match(proof.isolationEvidenceSha256, /^[a-f0-9]{64}$/);
  assert.equal(proof.isolationEvidenceSha256, isolationEvidenceSha256);
  verifyLifecycleAndCapacity(proof);
  return { delivery, proof };
}

/** Authenticate the approved body only after full actual installation acceptance. */
export function verifyInstallationPublication(options) {
  verifyInstallationAcceptance(options);
  const { delivery, notes, releaseVersion, buildVersion, verification } =
    options;
  const verified = verifyApplicationUpdate(
    extractApplicationUpdate(notes).envelope,
    verification,
  );
  const expected = installationUpdateDescription(
    { ...delivery, buildVersion },
    releaseVersion,
  );
  assert.deepEqual(
    verified.description,
    expected,
    'Approved signed description differs from final tested installer',
  );
  return verified;
}
