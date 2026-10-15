import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { deliveryPaths, assertDeliveryPath } from './delivery-paths.mjs';
import { currentDeliveries } from '../maintenance/current-delivery.mjs';
import { createHash } from 'node:crypto';
const temporary = resolve('tmp');
mkdirSync(temporary, { recursive: true });

test('new outputs group builds; recorded legacy paths and snapshot restores remain stable', () => {
  const root = mkdtempSync(join(temporary, 'tablemax-delivery-'));
  const identity = { root, version: '1.0.6', buildVersion: '1.0.6.18' };
  const old = join(root, 'artifacts/releases/TableMax-1.0.6.18-win-x64.exe');
  const grouped = deliveryPaths(identity);
  assert.equal(
    grouped.executable,
    join(
      root,
      'artifacts/releases/v1.0.6/1.0.6.18/TableMax-1.0.6.18-win-x64.exe',
    ),
  );
  mkdirSync(join(root, 'artifacts/releases'), { recursive: true });
  writeFileSync(old, 'frozen');
  assert.equal(
    deliveryPaths({ ...identity, existingPath: old }).executable,
    old,
  );
  assert.equal(
    deliveryPaths({ ...identity, restoreSnapshot: true }).executable,
    old,
  );
  assert.equal(deliveryPaths(identity).executable, grouped.executable);
});

test('wrong version, filename, descendant and workspace escape are rejected', () => {
  const root = mkdtempSync(join(temporary, 'tablemax-delivery-'));
  const identity = { root, version: '1.0.6', buildVersion: '1.0.6.18' };
  for (const path of [
    '../TableMax-1.0.6.18-win-x64.exe',
    'artifacts/releases/other.exe',
    'artifacts/releases/v1.0.5/1.0.6.18/TableMax-1.0.6.18-win-x64.exe',
    'artifacts/releases/extra/TableMax-1.0.6.18-win-x64.exe',
  ]) {
    assert.throws(() => assertDeliveryPath({ ...identity, path }));
  }
  assert.throws(() => deliveryPaths({ ...identity, buildVersion: '1.0.7.18' }));
});

test('linked version directory is rejected before outputs are written', () => {
  const root = mkdtempSync(join(temporary, 'tablemax-delivery-'));
  const target = mkdtempSync(join(temporary, 'tablemax-delivery-target-'));
  mkdirSync(join(root, 'artifacts/releases'), { recursive: true });
  symlinkSync(
    target,
    join(root, 'artifacts/releases/v1.0.6'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.throws(
    () => deliveryPaths({ root, version: '1.0.6', buildVersion: '1.0.6.19' }),
    /link/,
  );
});

test('grouped current delivery retains byte-hash checks', () => {
  const root = mkdtempSync(join(temporary, 'tablemax-delivery-'));
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const put = (path, text) => {
    mkdirSync(resolve(path, '..'), { recursive: true });
    writeFileSync(path, text);
    return path;
  };
  const paths = deliveryPaths({
    root,
    version: '1.0.6',
    buildVersion: '1.0.6.19',
  });
  put(paths.executable, 'exe');
  const archivePath = put(
    join(root, 'artifacts/package-payloads/v1.0.6/run/full/payload.zip'),
    'payload',
  );
  const manifestPath = put(
    join(
      root,
      'artifacts/package-payloads/v1.0.6/run/full/release-manifest.json',
    ),
    JSON.stringify({
      version: '1.0.6',
      buildVersion: '1.0.6.19',
      edition: 'full',
      archive: { bytes: 7, sha256: digest('payload') },
    }),
  );
  put(
    join(root, 'artifacts/package-payloads/v1.0.6/current.json'),
    JSON.stringify({
      version: '1.0.6',
      buildVersion: '1.0.6.19',
      deliveries: [
        {
          edition: 'full',
          archivePath,
          manifestPath,
          executable: {
            path: paths.executable,
            bytes: 3,
            sha256: digest('exe'),
            payloadSha256: digest('payload'),
          },
        },
      ],
    }),
  );
  assert.equal(
    currentDeliveries(root, '1.0.6')[0].executable.path,
    paths.executable,
  );
  writeFileSync(paths.executable, 'bad');
  assert.throws(() => currentDeliveries(root, '1.0.6'), /hash mismatch/);
});
