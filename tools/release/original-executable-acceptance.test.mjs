import assert from 'node:assert/strict';
import test from 'node:test';
import { hash } from './installation-toolchain.mjs';
import {
  verifyOriginalExecutableEvidence,
  verifyOriginalExecutableAcceptance,
} from './original-executable-acceptance.mjs';

function fixture() {
  const path =
    'E:\\Repo\\artifacts\\releases\\v1.0.7\\1.0.7.9\\TableMax-1.0.7.9-installer-win-x64.exe';
  const executable = {
    path,
    bytes: 17,
    sha256: hash(Buffer.from('executable')),
  };
  const security = {
    ...executable,
    schemaVersion: 1,
    kind: 'windows-executable-security',
    securityInformation: 0x15,
    ownerSid: 'S-1-5-21-1-2-3-1001',
    ownerSddl: 'O:S-1-5-21-1-2-3-1001',
    ownerSha256: hash(Buffer.from('O:S-1-5-21-1-2-3-1001')),
    daclSddl: 'D:',
    daclSha256: hash(Buffer.from('D:')),
    labelSddl: 'S:(ML;;NW;;;ME)',
    integritySid: 'S-1-16-8192',
    integrity: {
      source: 'mandatory-label',
      rid: 8192,
      labels: [{ sid: 'S-1-16-8192', rid: 8192, inherited: false, mask: 1 }],
    },
    streams: [],
    authenticode: {
      status: 'NotSigned',
      signerCertificateSha256: null,
      timestampCertificateSha256: null,
    },
  };
  const ownerSid = 'S-1-5-21-1-2-3-1002',
    root =
      'C:\\Users\\TMVerify_1234abcd\\AppData\\Local\\TableMaxAcceptance\\' +
      'a'.repeat(32);
  const checks = [
    'actual-initial-directory-and-exact-notice',
    'ready-observed-without-install-invocation',
    'owned-cancel-confirmation',
    'no-registration-or-target-after-cancel',
  ].map((name) => ({ name, passed: true }));
  return {
    delivery: { executable },
    evidence: {
      schemaVersion: 1,
      kind: 'original-executable-acceptance',
      result: 'passed',
      executable,
    },
    security,
    report: {
      schemaVersion: 1,
      originalExecutable: true,
      result: 'original-executable-passed',
      failures: 0,
      delivery: {
        original: executable,
        launchCopy: structuredClone(executable),
      },
      originalSecurityBefore: structuredClone(security),
      originalSecurityAfter: structuredClone(security),
      executionProfile: { ownerSid, root, integritySid: 'S-1-16-8192' },
      screenshots: [{ path: 'actual-1.png' }, { path: 'actual-2.png' }],
      windowVerification: {
        ownerSid,
        passed: true,
        mode: 'original-installer',
        originalProcessExitedBeforeCleanup: true,
        originalProcessExitCode: 2,
        remainingOwnProcesses: 0,
        cleanupTerminatedOwnProcesses: [],
        registrationBefore: [],
        registrationAfter: [],
        checks,
        processes: [
          {
            pid: 12,
            path,
            ownerSid,
            integritySid: 'S-1-16-8192',
            elevated: false,
          },
          {
            pid: 13,
            path: root + '\\work\\temporary\\setup.tmp',
            ownerSid,
            integritySid: 'S-1-16-8192',
            elevated: false,
          },
        ],
      },
    },
    isolation: {
      kind: 'temporary-standard-user-original-executable',
      result: 'passed',
      freshAccount: true,
      standardAccount: true,
      profileLoaded: true,
      accountRemoved: true,
      profileRemoved: true,
      exitCode: 0,
      errors: [],
      account: 'TMVerify_1234abcd',
      installerSha256: executable.sha256,
      ownerSid,
      profileAcceptanceRoot: root,
    },
  };
}

test('original acceptance binds exact source bytes, real Medium bootstrap/window and completed cleanup', () => {
  assert.equal(verifyOriginalExecutableEvidence(fixture()).result, 'passed');
});
test('delivery gate refuses missing original acceptance before any process or file access', async () => {
  await assert.rejects(
    verifyOriginalExecutableAcceptance({
      delivery: fixture().delivery,
      evidence: null,
    }),
    /Original executable acceptance evidence is required/,
  );
});
test('same-SHA execution copy cannot replace the canonical original path', () => {
  const value = fixture();
  value.report.delivery.launchCopy.path = 'C:\\Users\\copy.exe';
  assert.throws(
    () => verifyOriginalExecutableEvidence(value),
    /canonical delivery path/,
  );
  const noOriginal = fixture();
  noOriginal.report.windowVerification.processes.shift();
  assert.throws(() => verifyOriginalExecutableEvidence(noOriginal));
});
test('Low or MOTW on the original file blocks delivery', () => {
  for (const mutate of [
    (s) => {
      s.integrity.rid = 4096;
      s.integritySid = 'S-1-16-4096';
      s.integrity.labels[0] = {
        sid: s.integritySid,
        rid: 4096,
        inherited: true,
        mask: 1,
      };
      s.labelSddl = 'S:(ML;ID;NW;;;LW)';
    },
    (s) =>
      s.streams.push({
        name: 'Zone.Identifier',
        bytes: 0,
        sha256: hash(Buffer.alloc(0)),
        zoneId: null,
      }),
  ]) {
    const value = fixture();
    mutate(value.security);
    value.report.originalSecurityBefore = structuredClone(value.security);
    value.report.originalSecurityAfter = structuredClone(value.security);
    assert.throws(() => verifyOriginalExecutableEvidence(value));
  }
});
test('metadata changes after a passed launch invalidate its proof', () => {
  const value = fixture();
  value.security.daclSddl = 'D:(A;;FA;;;SY)';
  value.security.daclSha256 = hash(Buffer.from(value.security.daclSddl));
  assert.throws(
    () => verifyOriginalExecutableEvidence(value),
    /metadata changed/,
  );
});
test('elevated, Low or different-owner child processes are rejected', () => {
  for (const mutate of [
    (p) => {
      p.elevated = true;
    },
    (p) => {
      p.integritySid = 'S-1-16-4096';
    },
    (p) => {
      p.ownerSid += '0';
    },
  ]) {
    const value = fixture();
    mutate(value.report.windowVerification.processes[1]);
    assert.throws(() => verifyOriginalExecutableEvidence(value));
  }
});
test('cleanup and profile failures cannot become an original EXE pass', () => {
  for (const key of [
    'freshAccount',
    'standardAccount',
    'profileLoaded',
    'accountRemoved',
    'profileRemoved',
  ]) {
    const value = fixture();
    value.isolation[key] = false;
    assert.throws(() => verifyOriginalExecutableEvidence(value));
  }
  const value = fixture();
  value.isolation.errors.push('profile survived');
  assert.throws(() => verifyOriginalExecutableEvidence(value));
});
test('forced termination, wrong cancellation exit or missing actual rendering checks are rejected', () => {
  for (const mutate of [
    (r) => {
      r.originalProcessExitCode = 0;
    },
    (r) => r.cleanupTerminatedOwnProcesses.push(12),
    (r) => r.checks.pop(),
    (r) => r.registrationAfter.push({ product: 'unexpected' }),
  ]) {
    const value = fixture();
    mutate(value.report.windowVerification);
    assert.throws(() => verifyOriginalExecutableEvidence(value));
  }
  const value = fixture();
  value.report.screenshots = [];
  assert.throws(() => verifyOriginalExecutableEvidence(value));
});
