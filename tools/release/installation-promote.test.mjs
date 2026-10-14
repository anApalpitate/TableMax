import assert from 'node:assert/strict';
import test from 'node:test';
import { hash } from './installation-toolchain.mjs';
import { INSTALLATION_PRODUCT_ID } from './installation-package.mjs';
import { verifyCandidatePromotion } from './installation-promote.mjs';

function fixture() {
  const member = { path: 'TableMax.exe', bytes: 1, sha256: 'a'.repeat(64) };
  const payloadMember = { path: 'node.exe', bytes: 1, sha256: 'a'.repeat(64) };
  const delivery = {
    edition: 'full',
    deliveryType: 'installer',
    executable: {
      type: 'installer',
      bytes: 100,
      sha256: 'b'.repeat(64),
      installation: {
        productId: INSTALLATION_PRODUCT_ID,
        installProtocol: 1,
        manifestSha256: 'c'.repeat(64),
        payloadManifestSha256: 'd'.repeat(64),
        currentMappingSha256: 'e'.repeat(64),
      },
    },
  };
  const snapshot = 'f'.repeat(64);
  const candidate = {
    schemaVersion: 1,
    kind: 'installation-candidate',
    baseCurrentSha256: '1'.repeat(64),
    pointer: {
      version: '1.0.6',
      buildVersion: '1.0.6.11',
      snapshot,
      deliveries: [delivery],
    },
  };
  const candidateSha256 = hash(Buffer.from(JSON.stringify(candidate)));
  const sid = 'S-1-5-21-1-2-3-1001';
  const copy = {
    path: 'verified-runtime',
    sourceRuntimeRoot: 'I/TableMax/app',
    installationId: 'install',
    executableSha256: delivery.executable.sha256,
    payloadSha256: '2'.repeat(64),
    payloadManifestSha256: 'd'.repeat(64),
    fileCount: 2,
    files: [
      { path: '.tablemax-release.json', bytes: 123, sha256: 'd'.repeat(64) },
      payloadMember,
    ],
  };
  const proof = {
    result: 'passed',
    deliveryType: 'installer',
    fixture: false,
    isolatedWindows: true,
    productId: INSTALLATION_PRODUCT_ID,
    snapshot,
    candidateSha256,
    executableSha256: delivery.executable.sha256,
    installerSha256: delivery.executable.sha256,
    executableBytes: delivery.executable.bytes,
    installationManifestSha256: 'c'.repeat(64),
    payloadSha256: '2'.repeat(64),
    buildVersion: '1.0.6.11',
    version: '1.0.6',
    firstStartupBytes: 104,
    footprint: {
      programBytes: 1,
      frameworkBytes: 1,
      identityBytes: 1,
      currentGamesBytes: 101,
      total: 104,
    },
    installRoot: 'I',
    boxRoot: 'I/TableMax',
    runtimeRoot: 'I/TableMax/app',
    extracted: 'I/TableMax/app',
    uninstalled: true,
    installationId: 'install',
    ownerSid: sid,
    verifiedRuntimeRoot: copy.path,
    verifiedRuntime: copy,
    environment: {
      ownerSid: sid,
      elevated: false,
      profile: 'C:/Users/TMVerify_01234567',
    },
    isolationEvidencePath:
      'artifacts/maintenance/v1.0.6/isolation/isolated-account.json',
    isolationEvidenceSha256: '3'.repeat(64),
  };
  const acceptance = {
    delivery,
    proof,
    payloadManifest: {
      archive: { bytes: 100, sha256: '2'.repeat(64) },
      files: [payloadMember],
    },
    payloadManifestSha256: 'd'.repeat(64),
    payloadManifestByteLength: 123,
    installationManifest: {
      schemaVersion: 1,
      productId: INSTALLATION_PRODUCT_ID,
      arch: 'x64',
      installProtocol: 1,
      releaseVersion: '1.0.6',
      buildVersion: '1.0.6.11',
      payloadManifestSha256: 'd'.repeat(64),
      currentMappingSha256: 'e'.repeat(64),
      files: [member],
    },
    installationManifestSha256: 'c'.repeat(64),
    snapshot,
    releaseVersion: '1.0.6',
    buildVersion: '1.0.6.11',
    isolationEvidenceSha256: '3'.repeat(64),
    isolationEvidence: {
      schemaVersion: 1,
      kind: 'temporary-standard-user',
      result: 'passed',
      account: 'TMVerify_01234567',
      ownerSid: sid,
      accountSid: sid,
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
  return {
    candidate,
    candidateSha256,
    currentSha256: candidate.baseCurrentSha256,
    acceptance,
  };
}

test('exact accepted candidate promotes without allocating another revision', () => {
  const input = fixture();
  assert.equal(verifyCandidatePromotion(input), input.candidate.pointer);
  assert.equal(input.candidate.pointer.buildVersion, '1.0.6.11');
});

test('tampered candidate bytes, proof identity and stale current cannot promote', () => {
  for (const mutate of [
    (input) => {
      input.candidateSha256 = '4'.repeat(64);
    },
    (input) => {
      input.currentSha256 = '4'.repeat(64);
    },
    (input) => {
      input.acceptance.proof.installerSha256 = '4'.repeat(64);
    },
    (input) => {
      input.candidate.pointer.buildVersion = '1.0.6.12';
    },
    (input) => {
      input.candidate.pointer.snapshot = '../unsafe';
    },
  ]) {
    const input = fixture();
    mutate(input);
    assert.throws(() => verifyCandidatePromotion(input));
  }
});

test('capacity, fixture identity, diagnostics and incomplete isolation reject promotion', () => {
  for (const mutate of [
    (input) => {
      input.acceptance.proof.firstStartupBytes = 120000000;
    },
    (input) => {
      input.acceptance.proof.fixture = true;
    },
    (input) => {
      input.acceptance.proof.isolatedWindows = false;
    },
    (input) => {
      input.acceptance.proof.uninstalled = false;
    },
    (input) => {
      input.acceptance.isolationEvidence.profileRemoved = false;
    },
    (input) => {
      input.acceptance.proof.verifiedRuntime.files.pop();
    },
    (input) => {
      input.acceptance.isolationEvidence.ownerSid = 'another-user';
    },
  ]) {
    const input = fixture();
    mutate(input);
    assert.throws(() => verifyCandidatePromotion(input));
  }
});
