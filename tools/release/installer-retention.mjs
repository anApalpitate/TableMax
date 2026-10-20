import assert from 'node:assert/strict';
import {
  readFile,
  readdir,
  lstat,
  mkdir,
  writeFile,
  unlink,
} from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
import { assertNoDeliveryLinks } from './delivery-paths.mjs';
import { isDirectExecution } from '../shared/workspace-root.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function ordinary(path) {
  assertNoDeliveryLinks(path);
  const stat = await lstat(path);
  assert.ok(stat.isFile(), 'Expected an ordinary installer file');
  return stat;
}
async function currentState(root, version) {
  assert.match(version, /^1\.\d+\.\d+$/);
  const pointerPath = resolve(
    root,
    'artifacts/package-payloads',
    'v' + version,
    'current.json',
  );
  await ordinary(pointerPath);
  const raw = await readFile(pointerPath);
  const pointer = JSON.parse(raw);
  assert.equal(pointer.version, version);
  const prefix = version + '.';
  assert.ok(pointer.buildVersion.startsWith(prefix));
  const revision = pointer.buildVersion.slice(prefix.length);
  assert.match(revision, /^\d+$/);
  assert.equal(pointer.deliveries.length, 1);
  const delivery = pointer.deliveries[0];
  assert.equal(delivery.deliveryType, 'installer');
  const executable = resolve(root, delivery.executable.path);
  assert.equal(
    executable,
    resolve(
      root,
      'artifacts/releases',
      'v' + version,
      pointer.buildVersion,
      'TableMax-' + pointer.buildVersion + '-installer-win-x64.exe',
    ),
  );
  await ordinary(executable);
  const bytes = await readFile(executable);
  assert.equal(sha(bytes), delivery.executable.sha256);
  assert.equal(bytes.length, delivery.executable.bytes);
  assert.match(pointer.snapshot, /^[a-f0-9]{64}$/);
  const proofPath = resolve(
    root,
    'artifacts/maintenance',
    'v' + version,
    'windows-editions',
    pointer.snapshot,
    'shipping-executable-checks-full.json',
  );
  await ordinary(proofPath);
  const proofRaw = await readFile(proofPath);
  const proof = JSON.parse(proofRaw);
  assert.equal(proof.result, 'passed');
  assert.equal(proof.fixture, false);
  assert.equal(proof.isolatedWindows, true);
  assert.equal(proof.snapshot, pointer.snapshot);
  assert.equal(proof.buildVersion, pointer.buildVersion);
  assert.equal(proof.installerSha256, delivery.executable.sha256);
  return {
    pointerPath,
    pointerSha256: sha(raw),
    proofPath,
    proofSha256: sha(proofRaw),
    buildVersion: pointer.buildVersion,
    revision: BigInt(revision),
    executable,
    executableSha256: sha(bytes),
  };
}

/** Preview only same-public-version installer EXEs superseded by accepted current. */
export async function planInstallerRetention({
  root = resolve('.'),
  version,
  candidatePath,
}) {
  root = resolve(root);
  const state = await currentState(root, version);
  let limit = state.revision;
  let candidate;
  if (candidatePath) {
    candidatePath = resolve(root, candidatePath);
    assert.ok(
      candidatePath.startsWith(
        resolve(root, 'artifacts/package-payloads', 'v' + version) + sep,
      ),
    );
    await ordinary(candidatePath);
    const raw = await readFile(candidatePath);
    const value = JSON.parse(raw);
    assert.equal(value.kind, 'installation-candidate');
    assert.equal(value.baseCurrentSha256, state.pointerSha256);
    assert.equal(value.pointer.version, version);
    assert.ok(value.pointer.buildVersion.startsWith(version + '.'));
    const revision = value.pointer.buildVersion.slice(version.length + 1);
    assert.match(revision, /^\d+$/);
    limit = BigInt(revision);
    assert.ok(limit > state.revision);
    assert.equal(value.pointer.deliveries.length, 1);
    const entry = value.pointer.deliveries[0].executable;
    const executable = resolve(
      root,
      'artifacts/releases',
      'v' + version,
      value.pointer.buildVersion,
      'TableMax-' + value.pointer.buildVersion + '-installer-win-x64.exe',
    );
    assert.equal(resolve(root, entry.path), executable);
    await ordinary(executable);
    const bytes = await readFile(executable);
    assert.equal(bytes.length, entry.bytes);
    assert.equal(sha(bytes), entry.sha256);
    candidate = {
      path: candidatePath,
      sha256: sha(raw),
      executable,
      executableSha256: entry.sha256,
    };
  }
  const directory = resolve(root, 'artifacts/releases', 'v' + version);
  assertNoDeliveryLinks(directory);
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (!item.name.startsWith(version + '.')) continue;
    const revision = item.name.slice(version.length + 1);
    if (
      !/^\d+$/.test(revision) ||
      BigInt(revision) >= limit ||
      BigInt(revision) === state.revision
    )
      continue;
    const folder = resolve(directory, item.name);
    assertNoDeliveryLinks(folder);
    assert.ok(item.isDirectory(), 'Revision must be an ordinary directory');
    const path = resolve(
      folder,
      'TableMax-' + item.name + '-installer-win-x64.exe',
    );
    let stat;
    try {
      stat = await ordinary(path);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const bytes = await readFile(path);
    files.push({
      path: relative(root, path).split(sep).join('/'),
      bytes: stat.size,
      mtimeMs: stat.mtimeMs,
      sha256: sha(bytes),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const retained = { ...state };
  delete retained.revision;
  return {
    schemaVersion: 1,
    kind: 'superseded-local-installers',
    root,
    version,
    ...(candidatePath ? { candidatePath, candidate } : {}),
    retained,
    files,
  };
}

/** Caller must hold package-win lock. Never deletes manifests, payloads or proofs. */
export async function applyInstallerRetention(plan) {
  const expected = await planInstallerRetention(plan);
  assert.deepEqual(plan, expected, 'Retention preview changed; preview again');
  const directory = resolve(
    plan.root,
    'artifacts/maintenance/installer-retention',
  );
  assertNoDeliveryLinks(directory);
  await mkdir(directory, { recursive: true });
  const reportPath = resolve(
    directory,
    Date.now() + '-' + randomUUID() + '.json',
  );
  const report = { ...plan, result: 'started', deleted: [], deletedBytes: 0 };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
  });
  try {
    for (const entry of plan.files) {
      if (plan.candidate) {
        await ordinary(plan.candidate.path);
        await ordinary(plan.candidate.executable);
        assert.equal(
          sha(await readFile(plan.candidate.path)),
          plan.candidate.sha256,
        );
        assert.equal(
          sha(await readFile(plan.candidate.executable)),
          plan.candidate.executableSha256,
        );
      }
      assert.equal(
        sha(await readFile(plan.retained.pointerPath)),
        plan.retained.pointerSha256,
        'Current changed during retention',
      );
      assert.equal(
        sha(await readFile(plan.retained.executable)),
        plan.retained.executableSha256,
        'Retained installer changed',
      );
      assert.equal(
        sha(await readFile(plan.retained.proofPath)),
        plan.retained.proofSha256,
        'Acceptance changed',
      );
      const path = resolve(plan.root, entry.path);
      assert.ok(
        path.startsWith(
          resolve(plan.root, 'artifacts/releases', 'v' + plan.version) + sep,
        ),
      );
      const stat = await ordinary(path);
      assert.equal(stat.size, entry.bytes);
      assert.equal(stat.mtimeMs, entry.mtimeMs);
      assert.equal(
        sha(await readFile(path)),
        entry.sha256,
        'Installer changed after preview',
      );
      await unlink(path);
      report.deleted.push(entry.path);
      report.deletedBytes += entry.bytes;
      await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
    }
    report.result = 'passed';
  } catch (error) {
    report.result = 'failed';
    report.error = error.message;
    throw error;
  } finally {
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  }
  return {
    result: report.result,
    reportPath,
    deleted: report.deleted.length,
    deletedBytes: report.deletedBytes,
    retained: plan.retained.buildVersion,
  };
}

if (isDirectExecution(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length <= 1 && args.every((arg) => arg === '--apply'));
  const { assertWorkspaceRoot } = await import('../shared/workspace-root.mjs');
  const { lock } = await import('../build/module-build.mjs');
  assertWorkspaceRoot();
  console.log(
    JSON.stringify(
      await lock('package-win', async () => {
        const { version } = JSON.parse(await readFile('package.json', 'utf8'));
        const plan = await planInstallerRetention({ version });
        return args.includes('--apply') ? applyInstallerRetention(plan) : plan;
      }),
      null,
      2,
    ),
  );
}
