import assert from 'node:assert/strict';
import { readFile, lstat, open, rename } from 'node:fs/promises';
import { resolve, dirname, sep, win32 } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash } from './installation-toolchain.mjs';
import { lock } from '../build/module-build.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
import {
  readWindowsExecutableSecurity,
  assertWindowsExecutableSecurity,
} from '../shared/windows-executable-security.mjs';

const samePath = (left, right) =>
  resolve(left).toLowerCase() === resolve(right).toLowerCase();
const fileRecord = (path, raw) => ({
  path: resolve(path),
  bytes: raw.length,
  sha256: hash(raw),
});

export function verifyOriginalExecutableEvidence({
  delivery,
  evidence,
  report,
  isolation,
  security,
}) {
  const executable = delivery.executable;
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.kind, 'original-executable-acceptance');
  assert.equal(evidence.result, 'passed');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.originalExecutable, true);
  assert.equal(report.result, 'original-executable-passed');
  assert.equal(report.failures, 0);
  for (const actual of [
    evidence.executable,
    report.delivery.original,
    report.delivery.launchCopy,
    report.originalSecurityBefore,
    report.originalSecurityAfter,
    security,
  ]) {
    assert.ok(
      samePath(actual.path, executable.path),
      'Original EXE acceptance must execute the canonical delivery path',
    );
    assert.equal(actual.bytes, executable.bytes);
    assert.equal(actual.sha256, executable.sha256);
  }
  assertWindowsExecutableSecurity(report.originalSecurityBefore);
  assert.deepEqual(
    report.originalSecurityAfter,
    report.originalSecurityBefore,
    'Original security changed during startup',
  );
  assertWindowsExecutableSecurity(security);
  assert.deepEqual(
    security,
    report.originalSecurityAfter,
    'Original EXE metadata changed since acceptance',
  );
  assert.equal(isolation.result, 'passed');
  assert.ok(
    [
      'temporary-standard-user-original-executable',
      'temporary-standard-user',
    ].includes(isolation.kind),
  );
  for (const key of [
    'freshAccount',
    'standardAccount',
    'profileLoaded',
    'accountRemoved',
    'profileRemoved',
  ])
    assert.equal(
      isolation[key],
      true,
      'Original EXE acceptance requires completed isolated cleanup',
    );
  assert.equal(isolation.exitCode, 0);
  assert.deepEqual(isolation.errors, []);
  assert.match(isolation.account, /^TMVerify_[a-f0-9]{8}$/);
  assert.equal(isolation.installerSha256, executable.sha256);
  assert.equal(report.executionProfile.ownerSid, isolation.ownerSid);
  assert.equal(report.executionProfile.integritySid, 'S-1-16-8192');
  assert.equal(report.executionProfile.root, isolation.profileAcceptanceRoot);
  const raw = report.windowVerification;
  assert.equal(raw.ownerSid, isolation.ownerSid);
  assert.equal(raw.passed, true);
  assert.equal(raw.mode, 'original-installer');
  assert.equal(raw.originalProcessExitedBeforeCleanup, true);
  assert.equal(raw.originalProcessExitCode, 2);
  assert.equal(raw.remainingOwnProcesses, 0);
  assert.deepEqual(raw.cleanupTerminatedOwnProcesses, []);
  assert.equal(raw.cleanupError, undefined);
  assert.ok(
    raw.processes.length >= 2,
    'Both original bootstrap and actual wizard processes must be observed',
  );
  assert.ok(
    raw.processes.some((process) => samePath(process.path, executable.path)),
    'Original process image missing',
  );
  const pids = new Set();
  for (const process of raw.processes) {
    assert.ok(Number.isSafeInteger(process.pid) && process.pid > 0);
    assert.ok(!pids.has(process.pid), 'Duplicate process observation');
    pids.add(process.pid);
    assert.ok(
      samePath(process.path, executable.path) ||
        win32
          .resolve(process.path)
          .toLowerCase()
          .startsWith(
            win32.resolve(report.executionProfile.root, 'work').toLowerCase() +
              win32.sep,
          ),
      'Unexpected original-launch child image',
    );
    assert.equal(process.ownerSid, isolation.ownerSid);
    assert.equal(process.integritySid, 'S-1-16-8192');
    assert.equal(process.elevated, false);
  }
  for (const name of [
    'actual-initial-directory-and-exact-notice',
    'ready-observed-without-install-invocation',
    'owned-cancel-confirmation',
    'no-registration-or-target-after-cancel',
  ]) {
    assert.equal(
      raw.checks.filter((check) => check.name === name && check.passed === true)
        .length,
      1,
      'Missing unique original startup/cancellation check',
    );
  }
  assert.equal(raw.registrationBefore.length, 0);
  assert.equal(raw.registrationAfter.length, 0);
  assert.ok(
    report.screenshots.length >= 2,
    'Actual original EXE rendering evidence is required',
  );
  return { result: 'passed', executable: evidence.executable };
}

async function noLinks(path) {
  for (let cursor = resolve(path); ; cursor = dirname(cursor)) {
    assert.ok(
      !(await lstat(cursor)).isSymbolicLink(),
      'Linked original EXE evidence',
    );
    if (dirname(cursor) === cursor) break;
  }
}
async function boundRecord(record, area) {
  assert.ok(
    record && typeof record.path === 'string',
    'Original executable acceptance evidence is required',
  );
  const path = resolve(record.path);
  assert.ok(
    path.startsWith(resolve(area) + sep),
    'Original evidence escapes its workspace area',
  );
  await noLinks(path);
  const raw = await readFile(path);
  assert.equal(raw.length, record.bytes);
  assert.equal(hash(raw), record.sha256);
  return raw;
}

/** Recheck original file security and exact raw evidence before current/public delivery. */
export async function verifyOriginalExecutableAcceptance({
  delivery,
  evidence,
}) {
  const raw = await boundRecord(evidence, 'artifacts/maintenance');
  const wrapper = JSON.parse(raw);
  const report = JSON.parse(
    await boundRecord(wrapper.report, 'artifacts/maintenance'),
  );
  const isolation = JSON.parse(
    await boundRecord(wrapper.isolation, 'artifacts/maintenance'),
  );
  assert.deepEqual(
    isolation.originalExecutableEvidence,
    wrapper.report,
    'Account cleanup does not bind this exact original report',
  );
  assert.deepEqual(isolation.methodSources, wrapper.methodSources);
  assert.equal(isolation.methodSha256, wrapper.methodSha256);
  for (const source of [report.source, report.driver]) {
    assert.equal(
      wrapper.methodSources.filter(
        (record) =>
          samePath(record.path, source.path) &&
          record.bytes === source.bytes &&
          record.sha256 === source.sha256,
      ).length,
      1,
      'Original report source is not bound to the isolated execution method',
    );
  }
  const deliveryRecord = JSON.parse(
    await boundRecord(wrapper.delivery, 'artifacts/package-payloads'),
  );
  assert.deepEqual(deliveryRecord.executable, delivery.executable);
  await noLinks(delivery.executable.path);
  for (const capture of report.screenshots) {
    const png = await boundRecord(
      { ...capture, path: resolve(dirname(wrapper.report.path), capture.path) },
      'artifacts/maintenance',
    );
    assert.ok(
      png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'Original screenshot is not PNG data',
    );
    assert.equal(capture.context.mode, 'original-installer');
    assert.ok(
      report.windowVerification.processes.some(
        (process) => process.pid === capture.context.processId,
      ),
      'Original screenshot process was not observed',
    );
  }
  const security = await readWindowsExecutableSecurity(
    delivery.executable.path,
  );
  verifyOriginalExecutableEvidence({
    delivery,
    evidence: wrapper,
    report,
    isolation,
    security,
  });
  return {
    result: 'passed',
    evidence: fileRecord(evidence.path, raw),
    security,
  };
}

/** Attach supplemental direct-original acceptance without changing original system proof bytes. */
export async function attachOriginalExecutableAcceptance({
  currentPath,
  proofPath,
}) {
  assertWorkspaceRoot();
  return lock('package-win', async () => {
    const version = JSON.parse(await readFile('package.json', 'utf8')).version;
    const current = resolve(
      'artifacts/package-payloads',
      'v' + version,
      'current.json',
    );
    assert.equal(resolve(currentPath), current);
    await noLinks(current);
    const before = await readFile(current),
      pointer = JSON.parse(before);
    assert.equal(pointer.deliveries.length, 1);
    const proof = await readFile(proofPath),
      evidence = fileRecord(proofPath, proof);
    const checked = await verifyOriginalExecutableAcceptance({
      delivery: pointer.deliveries[0],
      evidence,
    });
    assert.equal(
      hash(await readFile(current)),
      hash(before),
      'Current changed while attaching original acceptance',
    );
    pointer.originalExecutableAcceptance = checked.evidence;
    const next = current + '.original-' + randomUUID() + '.next';
    const file = await open(next, 'wx');
    try {
      await file.writeFile(JSON.stringify(pointer, null, 2) + '\n');
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(next, current);
    return {
      result: 'attached',
      current,
      buildVersion: pointer.buildVersion,
      originalExecutableAcceptance: checked.evidence,
      previousCurrentSha256: hash(before),
      currentSha256: hash(await readFile(current)),
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
    args.length === 2 && value('current') && value('proof'),
    'Use --current=<current.json> --proof=<original-executable-evidence.json>',
  );
  console.log(
    JSON.stringify(
      await attachOriginalExecutableAcceptance({
        currentPath: value('current'),
        proofPath: value('proof'),
      }),
    ),
  );
}
