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
