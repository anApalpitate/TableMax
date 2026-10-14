import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { currentDeliveries } from './current-delivery.mjs';
import { windowsExecutableName } from '../release/windows-executable-name.mjs';

test('dual delivery protects hash-bound payloads and refuses missing actual EXE proof', () => {
  const parent = resolve('tmp');
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, 'delivery-guard-'));
  const digest = (text) => createHash('sha256').update(text).digest('hex');
  const file = (path, text) => {
    mkdirSync(resolve(path, '..'), { recursive: true });
    writeFileSync(path, text);
    return path;
  };
  const json = (path, value) => file(path, JSON.stringify(value));
  try {
    assert.deepEqual(currentDeliveries(root, '1.0.6'), []);
    const deliveries = ['full', 'box'].map((edition) => {
      const archivePath = file(
        join(
          root,
          `artifacts/package-payloads/v1.0.6/run/${edition}/payload.zip`,
        ),
        'payload-' + edition,
      );
      const payloadHash = digest('payload-' + edition);
      const path = file(
        join(
          root,
          'artifacts/releases',
          windowsExecutableName('1.0.6.4', edition),
        ),
        'exe-' + edition,
      );
      const executable = {
        path,
        bytes: Buffer.byteLength('exe-' + edition),
        sha256: digest('exe-' + edition),
        payloadSha256: payloadHash,
      };
      const manifestPath = json(
        join(
          root,
          `artifacts/package-payloads/v1.0.6/run/${edition}/release-manifest.json`,
        ),
        {
          version: '1.0.6',
          buildVersion: '1.0.6.4',
          edition,
          archive: {
            bytes: Buffer.byteLength('payload-' + edition),
            sha256: payloadHash,
          },
        },
      );
      json(
        join(
          root,
          `artifacts/maintenance/v1.0.6/windows-editions/run/shipping-executable-checks-${edition}.json`,
        ),
        {
          result: 'passed',
          executableSha256: executable.sha256,
          payloadSha256: payloadHash,
        },
      );
      return { edition, archivePath, manifestPath, executable };
    });
    const pointer = json(
      join(root, 'artifacts/package-payloads/v1.0.6/current.json'),
      {
        version: '1.0.6',
        buildVersion: '1.0.6.4',
        snapshot: 'run',
        deliveries,
      },
    );
    assert.equal(currentDeliveries(root, '1.0.6').length, 2);
    json(pointer, {
      version: '1.0.6',
      buildVersion: '1.0.6.4',
      snapshot: 'run',
      deliveries: [deliveries[0]],
    });
    assert.equal(currentDeliveries(root, '1.0.6').length, 1);
    if (process.platform === 'win32') {
      const helper = resolve(
        'tools/maintenance/current-delivery.ps1',
      ).replaceAll("'", "''");
      const quoteRoot = root.replaceAll("'", "''");
      const invoke = (expected) =>
        execFileSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            `$ErrorActionPreference='Stop'; $env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+$env:PSModulePath; . '${helper}'; ${expected}`,
          ],
          { stdio: 'pipe' },
        );
      invoke(
        `$value=Get-VerifiedCurrentDeliveries '${quoteRoot}' '1.0.6'; if($value.deliveries.Count -ne 1){throw 'Expected one complete delivery'}`,
      );
      json(pointer, {
        version: '1.0.6',
        buildVersion: '1.0.6.4',
        snapshot: 'run',
        deliveries,
      });
      invoke(
        `$value=Get-VerifiedCurrentDeliveries '${quoteRoot}' '1.0.6'; if($value.deliveries.Count -ne 2 -or $value.historicalReportScans -ne 0){throw 'Expected two verified deliveries without historical scans'}`,
      );
      json(
        join(
          root,
          'artifacts/maintenance/v1.0.6/windows-editions/run/shipping-executable-checks-box.json',
        ),
        {
          result: 'passed',
          executableSha256: deliveries[1].executable.sha256,
          payloadSha256: '0'.repeat(64),
        },
      );
      assert.throws(() =>
        invoke(`Get-VerifiedCurrentDeliveries '${quoteRoot}' '1.0.6'`),
      );
      const link = join(root, 'artifacts/package-payloads/v1.0.6/run/linked');
      symlinkSync(dirname(deliveries[0].archivePath), link, 'junction');
      try {
        json(pointer, {
          version: '1.0.6',
          buildVersion: '1.0.6.4',
          snapshot: 'run',
          deliveries: [
            { ...deliveries[0], archivePath: join(link, 'payload.zip') },
          ],
        });
        assert.throws(() => currentDeliveries(root, '1.0.6'), /link/);
        assert.throws(() =>
          invoke(`Get-VerifiedCurrentDeliveries '${quoteRoot}' '1.0.6'`),
        );
      } finally {
        unlinkSync(link);
        json(pointer, {
          version: '1.0.6',
          buildVersion: '1.0.6.4',
          snapshot: 'run',
          deliveries,
        });
      }
      const full = deliveries[0];
      const installationPath = json(
        join(
          root,
          'artifacts/package-payloads/v1.0.6/run/full/installation-manifest.json',
        ),
        {
          productId: '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}',
          releaseVersion: '1.0.6',
          buildVersion: '1.0.6.4',
          payloadManifestSha256: digest(readFileSync(full.manifestPath)),
        },
      );
      const installed = {
        ...full,
        deliveryType: 'installer',
        executable: {
          ...full.executable,
          type: 'installer',
          installation: {
            productId: '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}',
            manifestPath: installationPath,
            manifestSha256: digest(readFileSync(installationPath)),
          },
        },
      };
      json(pointer, {
        version: '1.0.6',
        buildVersion: '1.0.6.4',
        snapshot: 'run',
        deliveries: [installed],
      });
      assert.equal(currentDeliveries(root, '1.0.6').length, 1);
      // A legacy payload-only report cannot authorize installer retirement.
      assert.throws(() =>
        invoke(`Get-VerifiedCurrentDeliveries '${quoteRoot}' '1.0.6'`),
      );
      const installerProof = {
        result: 'passed',
        executableSha256: installed.executable.sha256,
        payloadSha256: installed.executable.payloadSha256,
        deliveryType: 'installer',
        fixture: false,
        isolatedWindows: true,
        installationId: 'metadata-fixture-id',
        productId: installed.executable.installation.productId,
        installationManifestSha256:
          installed.executable.installation.manifestSha256,
        firstStartupBytes: 119999999,
      };
      const installerProofPath = join(
        root,
        'artifacts/maintenance/v1.0.6/windows-editions/run/shipping-executable-checks-full.json',
      );
      json(installerProofPath, installerProof);
      invoke(
        `$value=Get-VerifiedCurrentDeliveries '${quoteRoot}' '1.0.6'; if($value.deliveries.Count -ne 1){throw 'Expected installer metadata'}`,
      );
      for (const changed of [
        { fixture: true },
        { isolatedWindows: false },
        { firstStartupBytes: 120000000 },
      ]) {
        json(installerProofPath, { ...installerProof, ...changed });
        assert.throws(() =>
          invoke(`Get-VerifiedCurrentDeliveries '${quoteRoot}' '1.0.6'`),
        );
      }
      json(installerProofPath, installerProof);
      file(installationPath, 'tampered installation identity');
      assert.throws(() => currentDeliveries(root, '1.0.6'), /manifest hash/);
      assert.throws(() =>
        invoke(`Get-VerifiedCurrentDeliveries '${quoteRoot}' '1.0.6'`),
      );
    }
    json(pointer, {
      version: '1.0.6',
      buildVersion: '1.0.6.4',
      snapshot: 'run',
      deliveries,
    });
    file(deliveries[1].archivePath, 'tampered');
    assert.throws(() => currentDeliveries(root, '1.0.6'), /hash mismatch/);
    json(pointer, {
      version: '1.0.6',
      buildVersion: '1.0.6.4',
      deliveries: [
        { ...deliveries[0], archivePath: resolve(root, '../outside.zip') },
      ],
    });
    assert.throws(() => currentDeliveries(root, '1.0.6'), /escapes/);
  } finally {
    assert.ok(
      root.startsWith(parent + '\\') || root.startsWith(parent + '/'),
      'Fixture escapes test workspace',
    );
    rmSync(root, { recursive: true, force: true });
  }
});
