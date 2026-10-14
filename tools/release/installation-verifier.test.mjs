import assert from 'node:assert/strict';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { hash } from './installation-toolchain.mjs';
import {
  installationVerificationEnvironment,
  verifyPreservedRuntime,
} from './installation-verifier.mjs';

test('installer checking uses private temp and loopback without asserting Windows isolation', () => {
  const base = {
    TEMP: 'unrelated',
    TMP: 'unrelated',
    TABLEMAX_HOST: '0.0.0.0',
    TABLEMAX_PORT: '7788',
    TABLEMAX_INSTALLATION_HEALTH_CHECK: '0',
  };
  const environment = installationVerificationEnvironment('private', base);
  assert.equal(environment.TEMP, 'private');
  assert.equal(environment.TMP, 'private');
  assert.equal(environment.TABLEMAX_HOST, '127.0.0.1');
  assert.equal(environment.TABLEMAX_PORT, '0');
  assert.equal(environment.TABLEMAX_INSTALLATION_HEALTH_CHECK, '1');
  assert.equal(environment.TABLEMAX_ISOLATED_WINDOWS_ACCEPTANCE, undefined);
  assert.equal(base.TABLEMAX_INSTALLATION_HEALTH_CHECK, '0');
});

async function fixture() {
  await mkdir(resolve('tmp'), { recursive: true });
  const work = await mkdtemp(resolve('tmp/installation-preserved-test-'));
  const source = join(work, 'app'),
    destination = join(work, 'verified-runtime');
  await mkdir(source);
  await mkdir(destination);
  const content = Buffer.from('synthetic component input');
  const payload = {
    archive: { sha256: 'a'.repeat(64) },
    files: [{ path: 'node.exe', bytes: content.length, sha256: hash(content) }],
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload) + '\n');
  await writeFile(join(source, 'node.exe'), content);
  await writeFile(join(source, '.tablemax-release.json'), payloadBytes);
  for (const path of ['node.exe', '.tablemax-release.json'])
    await copyFile(join(source, path), join(destination, path));
  const delivery = {
    executable: {
      sha256: 'b'.repeat(64),
      payloadSha256: payload.archive.sha256,
    },
  };
  const copy = {
    path: destination,
    sourceRuntimeRoot: source,
    installationId: 'synthetic',
    executableSha256: delivery.executable.sha256,
    payloadSha256: payload.archive.sha256,
    payloadManifestSha256: hash(payloadBytes),
    fileCount: 2,
    files: [
      ...payload.files,
      {
        path: '.tablemax-release.json',
        bytes: payloadBytes.length,
        sha256: hash(payloadBytes),
      },
    ].sort((a, b) => a.path.localeCompare(b.path)),
  };
  return {
    copy,
    delivery,
    payloadBytes,
    sourceRuntimeRoot: source,
    installationId: 'synthetic',
  };
}

test('preserved component copy is verified even after exact source members are removed', async () => {
  const input = await fixture();
  await verifyPreservedRuntime(input);
  await unlink(join(input.sourceRuntimeRoot, 'node.exe'));
  await unlink(join(input.sourceRuntimeRoot, '.tablemax-release.json'));
  await verifyPreservedRuntime(input);
});

test('changed retained bytes and unexpected copied members are rejected', async () => {
  const input = await fixture();
  const member = join(input.copy.path, 'node.exe'),
    original = await readFile(member);
  await writeFile(member, 'changed');
  await assert.rejects(verifyPreservedRuntime(input));
  await writeFile(member, original);
  await writeFile(join(input.copy.path, 'unknown.json'), '{}');
  await assert.rejects(verifyPreservedRuntime(input));
});
