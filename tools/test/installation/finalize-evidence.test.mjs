import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileRecord } from '../runner/evidence.mjs';
import { finalizeInstallationEvidence } from './finalize-evidence.mjs';

function fixture() {
  mkdirSync(resolve('tmp'), { recursive: true });
  const root = mkdtempSync(resolve('tmp/finalization-test-'));
  const put = (path, value) => {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), JSON.stringify(value));
    return fileRecord(root, path);
  };
  const methodSources = [
    'verify-production-user.ps1',
    'verify-production-user-child.ps1',
  ].map((name) =>
    put('tools/test/installation/' + name, 'inert source fixture'),
  );
  const receipt = {
    schemaVersion: 1,
    kind: 'installation-execution-receipt',
    methodSources,
    delivery: put('artifacts/maintenance/case/delivery.json', {}),
    proof: put('artifacts/maintenance/case/execution-proof.json', {
      ownerSid: 'S-1-5-21-test',
    }),
    isolation: put('artifacts/maintenance/case/isolation.json', {
      result: 'passed',
      exitCode: 0,
      accountRemoved: true,
      profileRemoved: false,
      errors: [],
    }),
  };
  const report = 'artifacts/maintenance/case/execution-receipt.json';
  const out = 'artifacts/maintenance/case/final.json';
  return { root, receipt, put, report, out };
}

test('changed execution bytes fail before output; original receipt can be retried with a fresh output', async () => {
  const f = fixture();
  f.put(f.report, f.receipt);
  f.put(f.receipt.proof.path, { ownerSid: 'changed raw execution' });
  await assert.rejects(
    finalizeInstallationEvidence(f),
    /Evidence (length|bytes) changed/,
  );
  assert.equal(existsSync(resolve(f.root, f.out)), false);
  assert.ok(existsSync(resolve(f.root, f.report)));
});

test('profile cleanup failure cannot be turned into a finalized acceptance proof', async () => {
  const f = fixture();
  f.put(f.report, f.receipt);
  await assert.rejects(finalizeInstallationEvidence(f), {
    code: 'ERR_ASSERTION',
  });
  assert.equal(existsSync(resolve(f.root, f.out)), false);
});

test('execution method changes invalidate reuse before any output or installer access', async () => {
  const f = fixture();
  f.put(f.report, f.receipt);
  f.put(f.receipt.methodSources[1].path, 'changed child source');
  await assert.rejects(
    finalizeInstallationEvidence(f),
    /Evidence (length|bytes) changed/,
  );
  assert.equal(existsSync(resolve(f.root, f.out)), false);
});
