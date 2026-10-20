import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import {
  planInstallerRetention,
  applyInstallerRetention,
} from './installer-retention.mjs';
const digest = (b) => createHash('sha256').update(b).digest('hex');
async function fixture() {
  const root = await mkdtemp(resolve('tmp/installer-retention-test-'));
  const version = '1.0.7',
    snapshot = 'a'.repeat(64);
  const exe = (revision) =>
    resolve(
      root,
      'artifacts/releases/v1.0.7',
      '1.0.7.' + revision,
      'TableMax-1.0.7.' + revision + '-installer-win-x64.exe',
    );
  for (const revision of [9, 10, 18, 19]) {
    await mkdir(dirname(exe(revision)), { recursive: true });
    await writeFile(exe(revision), 'installer-' + revision);
    await writeFile(
      exe(revision).replace('.exe', '-manifest.json'),
      'manifest',
    );
  }
  const current = resolve(
    root,
    'artifacts/package-payloads/v1.0.7/current.json',
  );
  await mkdir(dirname(current), { recursive: true });
  const bytes = await readFile(exe(18));
  const pointer = {
    version,
    buildVersion: '1.0.7.18',
    snapshot,
    deliveries: [
      {
        deliveryType: 'installer',
        executable: {
          path: exe(18),
          bytes: bytes.length,
          sha256: digest(bytes),
        },
      },
    ],
  };
  await writeFile(current, JSON.stringify(pointer));
  const proof = resolve(
    root,
    'artifacts/maintenance/v1.0.7/windows-editions',
    snapshot,
    'shipping-executable-checks-full.json',
  );
  await mkdir(dirname(proof), { recursive: true });
  await writeFile(
    proof,
    JSON.stringify({
      result: 'passed',
      fixture: false,
      isolatedWindows: true,
      snapshot,
      buildVersion: pointer.buildVersion,
      installerSha256: digest(bytes),
    }),
  );
  return { root, version, exe, current, proof };
}
test('preview is read-only, compares numeric revisions, and keeps current/future', async () => {
  const f = await fixture();
  const plan = await planInstallerRetention(f);
  assert.equal(plan.files.length, 2);
  assert.ok(plan.files.every((e) => /1\.0\.7\.(9|10)\//.test(e.path)));
  await access(f.exe(9));
  await access(f.exe(10));
  await access(f.exe(18));
  await access(f.exe(19));
});
test('apply deletes only superseded EXEs and records exact hashes; repeated run is empty', async () => {
  const f = await fixture();
  const plan = await planInstallerRetention(f);
  const result = await applyInstallerRetention(plan);
  assert.equal(result.deleted, 2);
  assert.equal(result.result, 'passed');
  await assert.rejects(access(f.exe(9)));
  await assert.rejects(access(f.exe(10)));
  for (const n of [9, 10, 18, 19])
    await access(f.exe(n).replace('.exe', '-manifest.json'));
  await access(f.current);
  await access(f.proof);
  await access(f.exe(18));
  await access(f.exe(19));
  const report = JSON.parse(await readFile(result.reportPath));
  assert.equal(report.files[0].sha256.length, 64);
  assert.equal((await planInstallerRetention(f)).files.length, 0);
});
test('changed old file or current pointer invalidates the complete preview before deletion', async () => {
  for (const target of ['old', 'current']) {
    const f = await fixture();
    const plan = await planInstallerRetention(f);
    await writeFile(
      target === 'old' ? f.exe(9) : f.current,
      target === 'old' ? 'changed' : (await readFile(f.current, 'utf8')) + ' ',
    );
    await assert.rejects(applyInstallerRetention(plan));
    await access(f.exe(9));
    await access(f.exe(10));
  }
});
test('missing proof or tampered retained EXE refuses cleanup', async () => {
  const f = await fixture();
  await writeFile(f.exe(18), 'tampered');
  await assert.rejects(planInstallerRetention(f));
  await access(f.exe(9));
  const g = await fixture();
  await writeFile(g.proof, JSON.stringify({ result: 'failed' }));
  await assert.rejects(planInstallerRetention(g));
  await access(g.exe(9));
});
test('forged delete path and unknown files are never deleted', async () => {
  const f = await fixture();
  const unknown = resolve(dirname(f.exe(9)), 'notes.txt');
  await writeFile(unknown, 'keep');
  const plan = await planInstallerRetention(f);
  plan.files[0].path = '../outside.exe';
  await assert.rejects(applyInstallerRetention(plan));
  await access(unknown);
  await access(f.exe(9));
});

test('new candidate prunes older candidates but preserves accepted current until promotion', async () => {
  const f = await fixture();
  const current = JSON.parse(await readFile(f.current, 'utf8'));
  await mkdir(dirname(f.exe(20)), { recursive: true });
  await writeFile(f.exe(20), 'new candidate');
  const bytes = await readFile(f.exe(20));
  const candidatePath = resolve(
    f.root,
    'artifacts/package-payloads/v1.0.7/pending/candidate.json',
  );
  await mkdir(dirname(candidatePath), { recursive: true });
  await writeFile(
    candidatePath,
    JSON.stringify({
      kind: 'installation-candidate',
      baseCurrentSha256: digest(await readFile(f.current)),
      pointer: {
        ...current,
        buildVersion: '1.0.7.20',
        deliveries: [
          {
            executable: {
              path: f.exe(20),
              bytes: bytes.length,
              sha256: digest(bytes),
            },
          },
        ],
      },
    }),
  );
  const plan = await planInstallerRetention({ ...f, candidatePath });
  assert.equal(plan.files.length, 3);
  const result = await applyInstallerRetention(plan);
  assert.equal(result.deleted, 3);
  await access(f.exe(18));
  await access(f.exe(20));
  await assert.rejects(access(f.exe(19)));
});
