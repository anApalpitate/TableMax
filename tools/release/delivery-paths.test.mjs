import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { deliveryPaths, assertDeliveryPath } from './delivery-paths.mjs';
import { currentDeliveries } from '../maintenance/current-delivery.mjs';
import { createHash } from 'node:crypto';
import {
  windowsExecutableName,
  legacyWindowsExecutableName,
} from './windows-executable-name.mjs';
const temporary = resolve('tmp');
mkdirSync(temporary, { recursive: true });

test('installer names are canonical and historical full/box names require explicit selection', () => {
  assert.equal(
    windowsExecutableName('1.0.6'),
    'TableMax-1.0.6-installer-win-x64.exe',
  );
  assert.equal(
    windowsExecutableName('1.0.6.20', 'full'),
    'TableMax-1.0.6.20-installer-win-x64.exe',
  );
  assert.equal(
    legacyWindowsExecutableName('1.0.6.10'),
    'TableMax-1.0.6.10-win-x64.exe',
  );
  assert.equal(
    legacyWindowsExecutableName('1.0.6.4', 'box'),
    'TableMax-1.0.6.4-win-x64-box.exe',
  );
  assert.throws(() => windowsExecutableName('1.0.6', 'box'));
  for (const version of [
    '1.00.6',
    '1.0.6.01',
    '1.0.6.65535',
    '1.0.6/other',
    '2.0.6',
    null,
  ]) {
    assert.throws(() => windowsExecutableName(version));
    assert.throws(() => legacyWindowsExecutableName(version));
  }
});

test('new outputs group builds; recorded legacy paths and snapshot restores remain stable', () => {
  const root = mkdtempSync(join(temporary, 'tablemax-delivery-'));
  const identity = { root, version: '1.0.6', buildVersion: '1.0.6.18' };
  const old = join(root, 'artifacts/releases/TableMax-1.0.6.18-win-x64.exe');
  const grouped = deliveryPaths(identity);
  assert.equal(
    grouped.executable,
    join(
      root,
      'artifacts/releases/v1.0.6/1.0.6.18/TableMax-1.0.6.18-installer-win-x64.exe',
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
  const oldGroupedIdentity = {
    root,
    version: '1.0.6',
    buildVersion: '1.0.6.19',
  };
  const oldGrouped = join(
    root,
    'artifacts/releases/v1.0.6/1.0.6.19/TableMax-1.0.6.19-win-x64.exe',
  );
  mkdirSync(resolve(oldGrouped, '..'), { recursive: true });
  writeFileSync(oldGrouped, 'original grouped');
  assert.equal(
    deliveryPaths({ ...oldGroupedIdentity, restoreSnapshot: true }).executable,
    oldGrouped,
  );
  mkdirSync(resolve(grouped.executable, '..'), { recursive: true });
  writeFileSync(grouped.executable, 'another exact name');
  assert.throws(
    () => deliveryPaths({ ...identity, restoreSnapshot: true }),
    /Ambiguous/,
  );
  assert.throws(
    () => deliveryPaths({ ...identity, edition: 'box', restoreSnapshot: true }),
    /Missing frozen/,
  );
  const missing = {
    root,
    version: '1.0.6',
    buildVersion: '1.0.6.21',
    restoreSnapshot: true,
  };
  assert.throws(() => deliveryPaths(missing), /recorded existingPath/);
  const recorded = 'artifacts/releases/TableMax-1.0.6.21-win-x64.exe';
  assert.equal(
    deliveryPaths({ ...missing, existingPath: recorded }).executable,
    join(root, recorded),
  );
});

test('wrong version, filename, descendant and workspace escape are rejected', () => {
  const root = mkdtempSync(join(temporary, 'tablemax-delivery-'));
  const identity = { root, version: '1.0.6', buildVersion: '1.0.6.18' };
  for (const path of [
    '../TableMax-1.0.6.18-win-x64.exe',
    'artifacts/releases/other.exe',
    'artifacts/releases/v1.0.5/1.0.6.18/TableMax-1.0.6.18-win-x64.exe',
    'artifacts/releases/extra/TableMax-1.0.6.18-win-x64.exe',
    'artifacts/releases/TableMax-1.0.6.19-installer-win-x64.exe',
    'artifacts/releases/TableMax-1.0.6.18-installer-win-x64-box.exe',
    'artifacts/releases/v1.0.6/1.0.6.18/renamed-installer.exe',
    'artifacts/releases/v1.0.6/1.0.6.18/TableMax-1.0.6.18-installer-win-x64.exe/child.exe',
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

for (const { buildVersion, existingPath } of [
  { buildVersion: '1.0.6.20' },
  {
    buildVersion: '1.0.6.10',
    existingPath: 'artifacts/releases/TableMax-1.0.6.10-win-x64.exe',
  },
  {
    buildVersion: '1.0.6.18',
    existingPath: 'artifacts/releases/TableMax-1.0.6.18-win-x64.exe',
  },
  {
    buildVersion: '1.0.6.19',
    existingPath:
      'artifacts/releases/v1.0.6/1.0.6.19/TableMax-1.0.6.19-win-x64.exe',
  },
])
  test(`${buildVersion} current delivery retains its exact frozen path and byte-hash checks`, () => {
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
      buildVersion,
      existingPath,
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
        buildVersion,
        edition: 'full',
        archive: { bytes: 7, sha256: digest('payload') },
      }),
    );
    put(
      join(root, 'artifacts/package-payloads/v1.0.6/current.json'),
      JSON.stringify({
        version: '1.0.6',
        buildVersion,
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
