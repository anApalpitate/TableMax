import assert from 'node:assert/strict';
import { readFile, lstat, open, rename, mkdir } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { lock } from '../build/module-build.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
import { hash } from './installation-toolchain.mjs';
import {
  loadIsolationEvidence,
  verifyInstallationAcceptance,
} from './installation-publication.mjs';
import { verifyPreservedRuntime } from './installation-verifier.mjs';
import { assertDeliveryPath } from './delivery-paths.mjs';

export function verifyCandidatePromotion({
  candidate,
  candidateSha256,
  currentSha256,
  acceptance,
}) {
  assert.equal(candidate.schemaVersion, 1);
  assert.equal(candidate.kind, 'installation-candidate');
  assert.ok(
    candidate.baseCurrentSha256 === null ||
      /^[a-f0-9]{64}$/.test(candidate.baseCurrentSha256),
  );
  assert.equal(
    candidate.baseCurrentSha256,
    currentSha256,
    'Current delivery changed after the candidate was frozen',
  );
  assert.match(candidateSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    acceptance.proof.candidateSha256,
    candidateSha256,
    'Actual acceptance belongs to another candidate record',
  );
  const pointer = candidate.pointer;
  assert.match(pointer.version, /^1\.\d+\.\d+$/);
  assert.match(pointer.buildVersion, /^1\.\d+\.\d+\.\d+$/);
  assert.equal(
    pointer.buildVersion.split('.').slice(0, 3).join('.'),
    pointer.version,
  );
  assert.match(pointer.snapshot, /^[a-f0-9]{64}$/);
  assert.equal(pointer.deliveries.length, 1);
  assert.equal(pointer.deliveries[0].edition, 'full');
  assert.equal(pointer.deliveries[0].deliveryType, 'installer');
  assert.equal(acceptance.snapshot, pointer.snapshot);
  assert.equal(acceptance.releaseVersion, pointer.version);
  assert.equal(acceptance.buildVersion, pointer.buildVersion);
  assert.deepEqual(acceptance.delivery, pointer.deliveries[0]);
  verifyInstallationAcceptance(acceptance);
  return pointer;
}

async function artifactPath(path, area, allowMissing = false) {
  const full = resolve(path),
    base = resolve(area);
  assert.ok(
    full.startsWith(base + sep),
    'Promotion input must be inside ' + area,
  );
  for (let cursor = full; ; cursor = dirname(cursor)) {
    try {
      assert.ok(
        !(await lstat(cursor)).isSymbolicLink(),
        'Promotion input contains a link',
      );
    } catch (error) {
      if (!(allowMissing && error.code === 'ENOENT')) throw error;
    }
    if (dirname(cursor) === cursor) break;
  }
  return full;
}

async function currentHash(path) {
  try {
    return hash(await readFile(path));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/** Promote only sealed bytes already tested in a new standard Windows account. */
export async function promoteInstallationCandidate({
  candidatePath,
  proofPath,
}) {
  assertWorkspaceRoot();
  return lock('package-win', async () => {
    const candidateFile = await artifactPath(
      candidatePath,
      'artifacts/package-payloads',
    );
    const proofFile = await artifactPath(proofPath, 'artifacts/maintenance');
    const candidateRaw = await readFile(candidateFile),
      candidate = JSON.parse(candidateRaw.toString('utf8'));
    const pointer = candidate.pointer;
    const version = JSON.parse(await readFile('package.json', 'utf8')).version;
    assert.equal(
      pointer.version,
      version,
      'Public version differs from the candidate',
    );
    const delivery = pointer.deliveries[0];
    const proofRaw = await readFile(proofFile),
      proof = JSON.parse(proofRaw.toString('utf8'));
    const executablePath = await artifactPath(
      delivery.executable.path,
      'artifacts/releases',
    );
    assertDeliveryPath({
      version,
      buildVersion: pointer.buildVersion ?? version,
      edition: delivery.edition,
      path: executablePath,
    });
    const payloadPath = await artifactPath(
      delivery.archivePath,
      'artifacts/package-payloads',
    );
    const payloadManifestPath = await artifactPath(
      delivery.manifestPath,
      'artifacts/package-payloads',
    );
    const installManifestPath = await artifactPath(
      delivery.executable.installation.manifestPath,
      'artifacts/package-payloads',
    );
    const executable = await readFile(executablePath),
      payload = await readFile(payloadPath);
    const payloadManifestRaw = await readFile(payloadManifestPath),
      installManifestRaw = await readFile(installManifestPath);
    assert.equal(hash(executable), delivery.executable.sha256);
    assert.equal(executable.length, delivery.executable.bytes);
    assert.equal(hash(payload), delivery.executable.payloadSha256);
    const current = resolve(
      'artifacts/package-payloads',
      'v' + version,
      'current.json',
    );
    await artifactPath(current, 'artifacts/package-payloads', true);
    const originalCurrentHash = await currentHash(current);
    const acceptance = {
      delivery,
      proof,
      payloadManifest: JSON.parse(payloadManifestRaw.toString('utf8')),
      payloadManifestSha256: hash(payloadManifestRaw),
      payloadManifestByteLength: payloadManifestRaw.length,
      installationManifest: JSON.parse(installManifestRaw.toString('utf8')),
      installationManifestSha256: hash(installManifestRaw),
      snapshot: pointer.snapshot,
      releaseVersion: pointer.version,
      buildVersion: pointer.buildVersion,
      ...(await loadIsolationEvidence(proof)),
    };
    const promoted = verifyCandidatePromotion({
      candidate,
      candidateSha256: hash(candidateRaw),
      currentSha256: originalCurrentHash,
      acceptance,
    });
    await artifactPath(proof.verifiedRuntime.path, 'artifacts/maintenance');
    await verifyPreservedRuntime({
      copy: proof.verifiedRuntime,
      delivery,
      payloadBytes: payloadManifestRaw,
      sourceRuntimeRoot: proof.runtimeRoot,
      installationId: proof.installationId,
    });
    // Keep the canonical shipping proof discoverable after switching current.
    const canonicalProof = resolve(
      'artifacts/maintenance',
      'v' + version,
      'windows-editions',
      pointer.snapshot,
      'shipping-executable-checks-full.json',
    );
    await artifactPath(canonicalProof, 'artifacts/maintenance', true);
    await mkdir(dirname(canonicalProof), { recursive: true });
    if (canonicalProof !== proofFile) {
      let previous;
      try {
        previous = await readFile(canonicalProof);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (previous)
        assert.equal(
          hash(previous),
          hash(proofRaw),
          'Existing canonical proof must be preserved',
        );
      else {
        const file = await open(canonicalProof, 'wx');
        try {
          await file.writeFile(proofRaw);
          await file.sync();
        } finally {
          await file.close();
        }
      }
    }
    assert.equal(
      await currentHash(current),
      originalCurrentHash,
      'Current changed during promotion',
    );
    const next = current + '.promotion-' + randomUUID() + '.next';
    const file = await open(next, 'wx');
    try {
      await file.writeFile(JSON.stringify(promoted, null, 2) + '\n');
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(next, current);
    return {
      result: 'promoted',
      current,
      candidateSha256: hash(candidateRaw),
      snapshot: pointer.snapshot,
      buildVersion: pointer.buildVersion,
      installerSha256: delivery.executable.sha256,
      proof: canonicalProof,
    };
  });
}

if (isDirectExecution(import.meta.url)) {
  const args = process.argv.slice(2),
    value = (name) =>
      args
        .find((arg) => arg.startsWith('--' + name + '='))
        ?.slice(name.length + 3);
  assert.ok(
    args.length === 2 &&
      args.every(
        (arg) => arg.startsWith('--candidate=') || arg.startsWith('--proof='),
      ) &&
      new Set(args.map((arg) => arg.split('=')[0])).size === 2 &&
      value('candidate') &&
      value('proof'),
    'Provide exactly --candidate and --proof',
  );
  console.log(
    JSON.stringify(
      await promoteInstallationCandidate({
        candidatePath: value('candidate'),
        proofPath: value('proof'),
      }),
    ),
  );
}
