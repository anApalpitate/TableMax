import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { createInstallationLifecycleProof } from '../test/support/installation-fixture.mjs';
import {
  applicationUpdateMachineBlock,
  signApplicationUpdate,
} from '../shared/application-update.mjs';
import { hash } from './installation-toolchain.mjs';
import { INSTALLATION_PRODUCT_ID } from './installation-package.mjs';
import {
  installationUpdateDescription,
  verifyInstallationPublication,
  verifyLifecycleAndCapacity,
} from './installation-publication.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
});
const verification = { trustedKeys: { 'fixture-publication': publicKey } };
function fixture(
  newLayout = false,
  {
    installerBytes = 44_000_000,
    archiveBytes = 44_000_000,
    firstStartupBytes = 108_000_000,
  } = {},
) {
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
      bytes: installerBytes,
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
    firstStartupBytes,
    footprint: {
      programBytes: 1,
      frameworkBytes: 100,
      identityBytes: 10,
      currentGamesBytes: firstStartupBytes - 111,
      total: firstStartupBytes,
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
  if (newLayout) {
    proof.footprint.programBytes += 2;
    proof.footprint.total += 2;
    proof.firstStartupBytes += 2;
    proof.boxRoot = 'I/data';
    proof.runtimeRoot = 'I/data/app';
    proof.extracted = proof.runtimeRoot;
    proof.footprint.games = [
      { path: 'fixture.bin', bytes: 1, sha256: 'a'.repeat(64) },
    ];
  }
  Object.assign(proof, createInstallationLifecycleProof(proof));
  if (newLayout) {
    proof.postUninstallReinstall.gameResourceCleanup = Object.fromEntries(
      ['firstUninstall', 'finalUninstall'].map((group) => {
        const receipt = {
          schemaVersion: 1,
          productId: proof.productId,
          installationId:
            group === 'firstUninstall'
              ? proof.installationId
              : proof.postUninstallReinstall.installationId,
          ownerSid: proof.ownerSid,
          buildVersion: proof.buildVersion,
          root: proof.installRoot,
          boxRoot: proof.boxRoot,
          result: 'completed',
          deleted: [],
          retained: proof.footprint.games.map((file) => ({
            ...file,
            path: 'games/' + file.path,
          })),
          deferred: [],
        };
        const raw = JSON.stringify(receipt);
        return [
          group,
          {
            raw,
            receipt,
            bytes: Buffer.byteLength(raw),
            sha256: hash(Buffer.from(raw)),
          },
        ];
      }),
    );
  }
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
      archive: { bytes: archiveBytes, sha256: proof.payloadSha256 },
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
      files: [
        { path: 'TableMax.exe', bytes: 1, sha256: '2'.repeat(64) },
        ...(newLayout
          ? [
              { path: 'Updater.exe', bytes: 1, sha256: '3'.repeat(64) },
              { path: 'data/app/node.exe', bytes: 1, sha256: '2'.repeat(64) },
            ]
          : []),
      ],
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
  input.delivery.executable.path =
    'artifacts/releases/TableMax-1.0.6.11-win-x64.exe';
  const originalPath = input.delivery.executable.path;
  assert.equal(
    installationUpdateDescription(input.delivery, '1.0.6').assetName,
    'TableMax-1.0.6-installer-win-x64.exe',
  );
  assert.equal(
    verifyInstallationPublication(input).description.sha256,
    input.delivery.executable.sha256,
  );
  assert.equal(input.delivery.executable.path, originalPath);
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
      input.proof.firstStartupBytes++;
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
test('the 50 MB cap applies only to the final installer', () => {
  const input = fixture(false, {
    installerBytes: 50_000_000,
    archiveBytes: 120_000_001,
    firstStartupBytes: 120_000_001,
  });
  assert.equal(
    verifyInstallationPublication(input).description.bytes,
    50_000_000,
  );

  input.delivery.executable.bytes++;
  assert.throws(
    () => installationUpdateDescription(input.delivery, '1.0.6'),
    /at most 50,000,000 bytes/,
  );
  assert.throws(
    () => verifyInstallationPublication(input),
    /at most 50,000,000 bytes/,
  );
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

test('new-layout publication binds both uninstall resource receipts and rejects missing or tampered decisions', () => {
  const input = fixture(true);
  assert.equal(
    verifyInstallationPublication(input).description.sha256,
    input.delivery.executable.sha256,
  );
  for (const mutate of [
    (proof) => {
      delete proof.postUninstallReinstall.gameResourceCleanup;
    },
    (proof) => {
      proof.postUninstallReinstall.gameResourceCleanup.firstUninstall.raw +=
        ' ';
    },
    (proof) => {
      const evidence =
        proof.postUninstallReinstall.gameResourceCleanup.finalUninstall;
      evidence.receipt.retained = [];
      evidence.raw = JSON.stringify(evidence.receipt);
      evidence.bytes = Buffer.byteLength(evidence.raw);
      evidence.sha256 = hash(Buffer.from(evidence.raw));
    },
  ]) {
    const changed = fixture(true);
    mutate(changed.proof);
    assert.throws(() => verifyInstallationPublication(changed));
  }
});

function retainedCatalogFixture() {
  const input = fixture(true);
  input.proof.footprint.games[0].bytes =
    input.proof.footprint.currentGamesBytes;
  for (const evidence of Object.values(
    input.proof.postUninstallReinstall.gameResourceCleanup,
  ))
    evidence.receipt.retained[0].bytes =
      input.proof.footprint.currentGamesBytes;
  const bytes = Buffer.from('{"signed":"installed raw catalog"}');
  const catalog = {
    path: `.resource-archives/catalogs/${hash(bytes)}.json`,
    bytes: bytes.length,
    sha256: hash(bytes),
  };
  input.installationManifest.files.push({
    ...catalog,
    path: 'data/app/preinstalled-games/catalog.json',
  });
  const restored = input.proof.postUninstallReinstall;
  restored.footprint = structuredClone(restored.footprint);
  restored.footprint.games = [...input.proof.footprint.games, catalog].sort(
    (a, b) => a.path.localeCompare(b.path),
  );
  restored.footprint.currentGamesBytes += catalog.bytes;
  restored.footprint.total += catalog.bytes;
  const first = restored.gameResourceCleanup.firstUninstall;
  first.receipt.preservedArchives = [
    { ...catalog, path: 'games/' + catalog.path },
  ];
  const final = restored.gameResourceCleanup.finalUninstall;
  final.receipt.retained.push({ ...catalog, path: 'games/' + catalog.path });
  for (const evidence of [first, final]) {
    evidence.raw = JSON.stringify(evidence.receipt);
    evidence.bytes = Buffer.byteLength(evidence.raw);
    evidence.sha256 = hash(Buffer.from(evidence.raw));
  }
  return input;
}

test('publication lifecycle accepts only manifest-bound retained catalog capacity', () => {
  const input = retainedCatalogFixture();
  verifyLifecycleAndCapacity(input.proof, input.installationManifest);
});

test('publication lifecycle rejects extra restored files, forged catalog binding and capacity omissions', () => {
  for (const change of [
    (input) =>
      input.proof.postUninstallReinstall.footprint.games.push({
        path: 'unknown.bin',
        bytes: 1,
        sha256: 'f'.repeat(64),
      }),
    (input) =>
      (input.installationManifest.files.find((file) =>
        file.path.endsWith('catalog.json'),
      ).sha256 = 'f'.repeat(64)),
    (input) => input.proof.postUninstallReinstall.footprint.currentGamesBytes--,
    (input) => {
      input.proof.footprint.currentGamesBytes++;
      input.proof.postUninstallReinstall.footprint.currentGamesBytes++;
      input.proof.postUninstallReinstall.footprint.total++;
    },
    (input) => {
      const evidence =
        input.proof.postUninstallReinstall.gameResourceCleanup.firstUninstall;
      delete evidence.receipt.preservedArchives;
      evidence.raw = JSON.stringify(evidence.receipt);
      evidence.bytes = Buffer.byteLength(evidence.raw);
      evidence.sha256 = hash(Buffer.from(evidence.raw));
    },
    (input) => {
      const e =
        input.proof.postUninstallReinstall.gameResourceCleanup.finalUninstall;
      e.receipt.retained.pop();
      e.raw = JSON.stringify(e.receipt);
      e.bytes = Buffer.byteLength(e.raw);
      e.sha256 = hash(Buffer.from(e.raw));
    },
  ]) {
    const input = retainedCatalogFixture();
    change(input);
    assert.throws(() =>
      verifyLifecycleAndCapacity(input.proof, input.installationManifest),
    );
  }
});
