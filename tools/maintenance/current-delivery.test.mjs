import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { currentDeliveries } from './current-delivery.mjs';

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
        join(root, `artifacts/releases/TableMax-1.0.6-win-x64-${edition}.exe`),
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
          edition,
          archive: {
            bytes: Buffer.byteLength('payload-' + edition),
            sha256: payloadHash,
          },
        },
      );
      json(join(root, `artifacts/maintenance/v1.0.6/${edition}/results.json`), {
        result: 'passed',
        executableSha256: executable.sha256,
        payloadSha256: payloadHash,
      });
      return { edition, archivePath, manifestPath, executable };
    });
    const pointer = json(
      join(root, 'artifacts/package-payloads/v1.0.6/current.json'),
      { version: '1.0.6', deliveries },
    );
    assert.equal(currentDeliveries(root, '1.0.6').length, 2);
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
            '-Command',
            `$ErrorActionPreference='Stop'; $env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+$env:PSModulePath; . '${helper}'; ${expected}`,
          ],
          { stdio: 'pipe' },
        );
      invoke(
        `$value=Get-VerifiedCurrentDeliveries '${quoteRoot}' '1.0.6'; if($value.deliveries.Count -ne 2){throw 'Expected two verified deliveries'}`,
      );
      json(join(root, 'artifacts/maintenance/v1.0.6/box/results.json'), {
        result: 'passed',
        executableSha256: deliveries[1].executable.sha256,
        payloadSha256: '0'.repeat(64),
      });
      assert.throws(() =>
        invoke(`Get-VerifiedCurrentDeliveries '${quoteRoot}' '1.0.6'`),
      );
      const link = join(root, 'artifacts/package-payloads/v1.0.6/run/linked');
      symlinkSync(dirname(deliveries[0].archivePath), link, 'junction');
      try {
        json(pointer, {
          version: '1.0.6',
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
        json(pointer, { version: '1.0.6', deliveries });
      }
    }
    file(deliveries[1].archivePath, 'tampered');
    assert.throws(() => currentDeliveries(root, '1.0.6'), /hash mismatch/);
    json(pointer, {
      version: '1.0.6',
      deliveries: [
        { ...deliveries[0], archivePath: resolve(root, '../outside.zip') },
      ],
    });
    assert.throws(() => currentDeliveries(root, '1.0.6'), /escapes/);
  } finally {
    if (!root.startsWith(parent + '\\') && !root.startsWith(parent + '/'))
      throw new Error('Fixture escapes test workspace');
    rmSync(root, { recursive: true, force: true });
  }
});
