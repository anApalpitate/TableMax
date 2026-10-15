import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { createInstallationLifecycleProof } from '../test/support/installation-fixture.mjs';
import {
  applicationUpdateMachineBlock,
  signApplicationUpdate,
} from '../shared/application-update.mjs';
import { INSTALLATION_PRODUCT_ID } from './installation-package.mjs';
import {
  installationUpdateDescription,
  verifyInstallationPublication,
} from './installation-publication.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
});
const verification = { trustedKeys: { 'fixture-publication': publicKey } };
function fixture() {
  const installation = {
    productId: INSTALLATION_PRODUCT_ID,
    installProtocol: 1,
    manifestSha256: 'd'.repeat(64),
    payloadManifestSha256: 'c'.repeat(64),
    currentMappingSha256: 'b'.repeat(64),
  };
  const delivery = {
    deliveryType: 'installer',
    buildVersion: '1.0.6.11',
    executable: {
      type: 'installer',
      bytes: 44000000,
      sha256: 'a'.repeat(64),
      installation,
    },
  };
  const description = installationUpdateDescription(delivery, '1.0.6');
  const notes =
    'Reviewed human notes\n\n' +
    applicationUpdateMachineBlock(
      signApplicationUpdate(description, privateKey, {
        keyId: 'fixture-publication',
      }),
    );
  const proof = {
    result: 'passed',
    deliveryType: 'installer',
    fixture: false,
    isolatedWindows: true,
    productId: INSTALLATION_PRODUCT_ID,
    snapshot: 'snapshot',
    executableSha256: delivery.executable.sha256,
    installerSha256: delivery.executable.sha256,
    executableBytes: delivery.executable.bytes,
    installationManifestSha256: installation.manifestSha256,
    payloadSha256: 'e'.repeat(64),
    buildVersion: delivery.buildVersion,
    version: '1.0.6',
    firstStartupBytes: 108000000,
    footprint: {
      programBytes: 1,
      frameworkBytes: 100,
      identityBytes: 10,
      currentGamesBytes: 107999889,
      total: 108000000,
    },
    installRoot: 'I',
    boxRoot: 'I/TableMax',
    runtimeRoot: 'I/TableMax/app',
    extracted: 'I/TableMax/app',
    uninstalled: true,
    installationId: '00000000-0000-0000-0000-000000000001',
    ownerSid: 'S-1-5-21-1-2-3-1001',
    environment: {
      ownerSid: 'S-1-5-21-1-2-3-1001',
      elevated: false,
      profile: 'C:/Users/TMVerify_01234567',
    },
    isolationEvidencePath:
      'artifacts/maintenance/v1.0.6/isolation/isolated-account.json',
    isolationEvidenceSha256: '1'.repeat(64),
  };
  Object.assign(proof, createInstallationLifecycleProof(proof));
  const payloadFiles = [{ path: 'node.exe', bytes: 1, sha256: '2'.repeat(64) }];
  proof.verifiedRuntimeRoot = 'verified-runtime';
  proof.verifiedRuntime = {
    path: proof.verifiedRuntimeRoot,
    sourceRuntimeRoot: proof.runtimeRoot,
    installationId: proof.installationId,
    executableSha256: delivery.executable.sha256,
    payloadSha256: proof.payloadSha256,
    payloadManifestSha256: installation.payloadManifestSha256,
    fileCount: 2,
    files: [
      ...payloadFiles,
      {
        path: '.tablemax-release.json',
        bytes: 123,
        sha256: installation.payloadManifestSha256,
      },
    ].sort((a, b) => a.path.localeCompare(b.path)),
  };
  return {
    delivery,
    proof,
    payloadManifest: {
      archive: { bytes: 44000000, sha256: proof.payloadSha256 },
      files: payloadFiles,
    },
    payloadManifestSha256: installation.payloadManifestSha256,
    payloadManifestByteLength: 123,
    installationManifest: {
      schemaVersion: 1,
      productId: INSTALLATION_PRODUCT_ID,
      arch: 'x64',
      installProtocol: 1,
      releaseVersion: '1.0.6',
      buildVersion: delivery.buildVersion,
      payloadManifestSha256: installation.payloadManifestSha256,
      currentMappingSha256: installation.currentMappingSha256,
      files: [{ path: 'TableMax.exe', bytes: 1, sha256: '2'.repeat(64) }],
    },
    installationManifestSha256: installation.manifestSha256,
    snapshot: 'snapshot',
    notes,
    releaseVersion: '1.0.6',
    buildVersion: delivery.buildVersion,
    verification,
    isolationEvidenceSha256: proof.isolationEvidenceSha256,
    isolationEvidence: {
      schemaVersion: 1,
      kind: 'temporary-standard-user',
      result: 'passed',
      account: 'TMVerify_01234567',
      ownerSid: proof.ownerSid,
      accountSid: proof.ownerSid,
      installerSha256: delivery.executable.sha256,
      freshAccount: true,
      standardAccount: true,
      profileLoaded: true,
      accountRemoved: true,
      profileRemoved: true,
      exitCode: 0,
      errors: [],
    },
  };
}

test('production proof and approved RSA machine block bind final installer, payload and mapping', () => {
  const input = fixture();
  assert.equal(
    verifyInstallationPublication(input).description.sha256,
    input.delivery.executable.sha256,
  );
});
test('test identity, changed final bytes and changed frozen mapping cannot authorize publication', () => {
  for (const mutate of [
    (input) => {
      input.proof.fixture = true;
    },
    (input) => {
      input.proof.isolatedWindows = false;
    },
    (input) => {
      input.installationManifest.productId =
        '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}';
    },
    (input) => {
      input.installationManifestSha256 = 'f'.repeat(64);
    },
    (input) => {
      input.delivery.executable.sha256 = 'f'.repeat(64);
    },
    (input) => {
      input.delivery.executable.installation.currentMappingSha256 = 'f'.repeat(
        64,
      );
    },
    (input) => {
      input.proof.firstStartupBytes = 120000000;
    },
    (input) => {
      input.proof.uninstalled = false;
    },
    (input) => {
      input.proof.verifiedRuntime.files[0].sha256 = 'f'.repeat(64);
    },
    (input) => {
      input.isolationEvidence.accountRemoved = false;
    },
    (input) => {
      input.isolationEvidenceSha256 = 'f'.repeat(64);
    },
  ]) {
    const input = fixture();
    mutate(input);
    assert.throws(() => verifyInstallationPublication(input));
  }
});
test('production preflight never trusts a test RSA key by default', () => {
  const input = fixture();
  delete input.verification;
  assert.throws(() => verifyInstallationPublication(input), /untrusted-key/);
});

test('publication requires actual post-uninstall reinstall evidence', () => {
  const input = fixture();
  delete input.proof.postUninstallReinstall;
  assert.throws(() => verifyInstallationPublication(input));
});

test('publication rejects changed capacity subtotals and observation claims', () => {
  for (const mutate of [
    (proof) => {
      proof.capacityAccounting.firstInstallationProgramBytes++;
    },
    (proof) => {
      proof.capacityAccounting.preStartupSampled = true;
    },
    (proof) => {
      proof.observedStorage.isAbsolutePeak = true;
    },
  ]) {
    const input = fixture();
    mutate(input.proof);
    assert.throws(() => verifyInstallationPublication(input));
  }
});
