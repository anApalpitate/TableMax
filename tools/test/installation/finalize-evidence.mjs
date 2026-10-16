import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileRecord, localFile } from '../runner/evidence.mjs';
import { hash } from '../../release/installation-toolchain.mjs';
import { assertDeliveryPath } from '../../release/delivery-paths.mjs';
import { verifyInstallationAcceptance } from '../../release/installation-publication.mjs';
import { verifyPreservedRuntime } from '../../release/installation-evidence.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';

async function readBound(root, record) {
  assert.equal(typeof record?.path, 'string');
  assert.match(record.sha256, /^[a-f0-9]{64}$/);
  const path = localFile(root, record.path);
  const raw = await readFile(path);
  assert.equal(
    raw.length,
    record.bytes,
    'Evidence length changed: ' + record.path,
  );
  assert.equal(
    hash(raw),
    record.sha256,
    'Evidence bytes changed: ' + record.path,
  );
  return raw;
}

export async function verifyInstalledUpdateLayoutEvidence(root, layout) {
  if (!layout) return; // Historical proofs predate this additional UI check.
  assert.equal(layout.result, 'passed');
  assert.equal(layout.failures, 0);
  assert.equal(
    layout.cases?.length,
    16,
    'All installed update layout cases are required',
  );
  assert.deepEqual(layout.remaining, []);
  assert.ok(
    layout.checks?.length > 0 &&
      layout.checks.every((check) => check.result === 'passed'),
  );
  assert.ok(
    layout.evidence?.length > 0,
    'Installed update layout evidence is required',
  );
  for (const record of layout.evidence) await readBound(root, record);
}

/** Read completed execution only: no subprocess, account, installer or maintenance. */
export async function finalizeInstallationEvidence({
  report,
  out,
  root = resolve('.'),
}) {
  root = resolve(root);
  const reportPath = localFile(root, report);
  const outPath = localFile(root, out);
  for (const path of [reportPath, outPath])
    assert.ok(
      path.startsWith(resolve(root, 'artifacts/maintenance') + sep),
      'Finalization stays in maintenance evidence',
    );
  assert.notEqual(reportPath, outPath);
  const receiptRaw = await readFile(reportPath);
  const receipt = JSON.parse(receiptRaw.toString('utf8'));
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.kind, 'installation-execution-receipt');
  assert.ok(
    Array.isArray(receipt.methodSources) && receipt.methodSources.length >= 2,
    'Frozen driver and child methods are required',
  );
  const methodPaths = new Set();
  for (const method of receipt.methodSources) {
    assert.ok(
      !methodPaths.has(resolve(root, method.path)),
      'Duplicate method source',
    );
    methodPaths.add(resolve(root, method.path));
    await readBound(root, method);
  }
  for (const name of [
    'verify-production-user.ps1',
    'verify-production-user-child.ps1',
  ])
    assert.ok(
      methodPaths.has(resolve(root, 'tools/test/installation', name)),
      'Required execution method missing',
    );
  const delivery = JSON.parse(
    (await readBound(root, receipt.delivery)).toString('utf8'),
  );
  const proof = JSON.parse(
    (await readBound(root, receipt.proof)).toString('utf8'),
  );
  assert.equal(
    proof.snapshot,
    delivery.snapshot,
    'Execution must retain the frozen delivery snapshot',
  );
  assert.equal(proof.version, delivery.version);
  assert.equal(proof.buildVersion, delivery.buildVersion);
  if (delivery.candidatePath || delivery.candidateSha256) {
    assert.match(delivery.candidateSha256, /^[a-f0-9]{64}$/);
    const candidatePath = localFile(root, delivery.candidatePath);
    assert.ok(
      candidatePath.startsWith(
        resolve(root, 'artifacts/package-payloads') + sep,
      ),
    );
    const candidateRaw = await readFile(candidatePath);
    assert.equal(hash(candidateRaw), delivery.candidateSha256);
    assert.equal(proof.candidateSha256, delivery.candidateSha256);
    const candidate = JSON.parse(candidateRaw);
    assert.equal(candidate.kind, 'installation-candidate');
    assert.equal(candidate.pointer.snapshot, delivery.snapshot);
    assert.equal(candidate.pointer.version, delivery.version);
    assert.equal(candidate.pointer.buildVersion, delivery.buildVersion);
    assert.equal(
      candidate.pointer.deliveries[0].executable.sha256,
      delivery.executable.sha256,
    );
  }
  const isolationRaw = await readBound(root, receipt.isolation);
  const isolation = JSON.parse(isolationRaw.toString('utf8'));
  assert.equal(isolation.result, 'passed');
  assert.equal(isolation.exitCode, 0);
  assert.equal(isolation.accountRemoved, true);
  assert.equal(isolation.profileRemoved, true);
  assert.deepEqual(isolation.errors, []);
  assert.equal(receipt.exitCode, isolation.exitCode);
  assert.equal(receipt.ownerSid, isolation.ownerSid);
  assert.equal(receipt.methodSha256, isolation.methodSha256);
  assert.deepEqual(
    receipt.methodSources,
    isolation.methodSources,
    'Cleanup must bind the same frozen execution methods',
  );
  assert.equal(proof.ownerSid, isolation.ownerSid);
  assertDeliveryPath({
    root,
    version: proof.version,
    buildVersion: proof.buildVersion,
    edition: 'full',
    path: delivery.executable.path,
  });
  const executable = await readFile(localFile(root, delivery.executable.path));
  assert.equal(executable.length, delivery.executable.bytes);
  assert.equal(hash(executable), delivery.executable.sha256);
  const payload = await readFile(localFile(root, delivery.archivePath));
  assert.equal(hash(payload), delivery.executable.payloadSha256);
  const payloadRaw = await readFile(localFile(root, delivery.manifestPath));
  const installedRaw = await readFile(
    localFile(root, delivery.executable.installation.manifestPath),
  );
  assert.equal(payload.length, JSON.parse(payloadRaw).archive.bytes);
  for (const record of isolation.applicationChainEvidence ?? [])
    await readBound(root, record);
  for (const log of Object.values(proof.logEvidence ?? {})) {
    assert.equal(
      log.missing,
      undefined,
      'A completed installer phase must retain its log',
    );
    await readBound(root, log);
  }
  await verifyInstalledUpdateLayoutEvidence(
    root,
    proof.postUninstallReinstall?.initialNative?.updateLayout,
  );
  const finalized = {
    ...proof,
    applicationChainEvidence: isolation.applicationChainEvidence,
    isolationEvidencePath: relative(
      root,
      localFile(root, receipt.isolation.path),
    ).replaceAll('\\', '/'),
    isolationEvidenceSha256: hash(isolationRaw),
  };
  if (receipt.originalExecutableAcceptance) {
    await readBound(root, receipt.originalExecutableAcceptance);
    finalized.originalExecutableAcceptance =
      receipt.originalExecutableAcceptance;
  }
  verifyInstallationAcceptance({
    delivery,
    proof: finalized,
    payloadManifest: JSON.parse(payloadRaw),
    payloadManifestSha256: hash(payloadRaw),
    payloadManifestByteLength: payloadRaw.length,
    installationManifest: JSON.parse(installedRaw),
    installationManifestSha256: hash(installedRaw),
    snapshot: proof.snapshot,
    releaseVersion: proof.version,
    buildVersion: proof.buildVersion,
    isolationEvidence: isolation,
    isolationEvidenceSha256: hash(isolationRaw),
  });
  const retained = localFile(root, proof.verifiedRuntime.path);
  assert.ok(retained.startsWith(resolve(root, 'artifacts/maintenance') + sep));
  await verifyPreservedRuntime({
    copy: proof.verifiedRuntime,
    delivery,
    payloadBytes: payloadRaw,
    sourceRuntimeRoot: proof.runtimeRoot,
    installationId: proof.installationId,
  });
  assert.equal(
    hash(await readFile(reportPath)),
    hash(receiptRaw),
    'Receipt changed during finalization',
  );
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(finalized, null, 2) + '\n', {
    flag: 'wx',
  });
  return {
    result: 'passed',
    proof: fileRecord(root, outPath),
    executionReceipt: fileRecord(root, reportPath),
    boundary:
      'Read-only revalidation and new proof only; no business operation repeated.',
  };
}

if (isDirectExecution(import.meta.url)) {
  assertWorkspaceRoot();
  const args = process.argv.slice(2);
  assert.ok(
    args.length === 2 &&
      args.some((arg) => arg.startsWith('--report=')) &&
      args.some((arg) => arg.startsWith('--out=')),
    'Use --report=<execution-receipt> --out=<new-proof>',
  );
  console.log(
    JSON.stringify(
      await finalizeInstallationEvidence({
        report: args.find((arg) => arg.startsWith('--report=')).slice(9),
        out: args.find((arg) => arg.startsWith('--out=')).slice(6),
      }),
    ),
  );
}
