import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  assertWindowsExecutableSecurity,
  assertWindowsExecutableSecurityNormalization,
} from './windows-executable-security.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
function fixture(rid = 8192, explicit = true) {
  const daclSddl = 'D:(A;;FA;;;SY)(A;;FR;;;BU)';
  return {
    schemaVersion: 1,
    kind: 'windows-executable-security',
    path: 'E:\\Repo\\artifacts\\installer.exe',
    bytes: 17,
    sha256: digest('executable'),
    securityInformation: 0x15,
    ownerSid: 'S-1-5-21-1-2-3-1001',
    ownerSddl: 'O:S-1-5-21-1-2-3-1001',
    ownerSha256: digest('O:S-1-5-21-1-2-3-1001'),
    daclSddl,
    daclSha256: digest(daclSddl),
    labelSddl: explicit
      ? `S:(ML;;NW;;;${rid === 4096 ? 'LW' : rid === 8192 ? 'ME' : 'HI'})`
      : '',
    integritySid: 'S-1-16-' + rid,
    integrity: {
      source: explicit ? 'mandatory-label' : 'windows-default-medium',
      rid,
      labels: explicit
        ? [{ sid: 'S-1-16-' + rid, rid, inherited: true, mask: 1 }]
        : [],
    },
    streams: [],
    authenticode: {
      status: 'NotSigned',
      signerCertificateSha256: null,
      timestampCertificateSha256: null,
    },
  };
}
test('shipping policy accepts explicit or Windows default Medium and unsigned products', () => {
  assertWindowsExecutableSecurity(fixture());
  assertWindowsExecutableSecurity(fixture(8192, false));
  const signed = fixture();
  signed.authenticode.status = 'Valid';
  signed.authenticode.signerCertificateSha256 = digest('certificate');
  assertWindowsExecutableSecurity(signed);
});
test('shipping policy rejects Low, High, unknown/multiple labels and inconsistent metadata', () => {
  for (const rid of [0, 4096, 8448, 12288, 16384])
    assert.throws(() => assertWindowsExecutableSecurity(fixture(rid)));
  for (const change of [
    (x) => x.integrity.labels.push(x.integrity.labels[0]),
    (x) => {
      x.integrity.labels[0].sid = 'S-1-16-4096';
    },
    (x) => {
      x.integrity.labels[0].mask = 8;
    },
    (x) => {
      x.labelSddl = '';
    },
    (x) => {
      x.daclSha256 = digest('wrong');
    },
    (x) => {
      x.path += ':Zone.Identifier';
    },
    (x) => {
      x.path = 'E:\\Repo\\..\\installer.exe';
    },
  ]) {
    const record = fixture();
    change(record);
    assert.throws(() => assertWindowsExecutableSecurity(record));
  }
});
test('MOTW is rejected even for ZoneId 0, missing ZoneId or an empty stream; URLs are never required', () => {
  for (const zoneId of [null, 0, 1, 2, 3, 4]) {
    const record = fixture();
    record.streams.push({
      name: 'Zone.Identifier',
      bytes: 0,
      sha256: digest(''),
      zoneId,
    });
    assert.throws(() => assertWindowsExecutableSecurity(record), /MOTW/);
  }
});
test('abnormal, unknown or incompletely recorded signatures fail closed', () => {
  for (const status of [
    'HashMismatch',
    'NotTrusted',
    'UnknownError',
    'NotSupportedFileFormat',
    'Incompatible',
    'future-status',
    'Valid',
  ]) {
    const record = fixture();
    record.authenticode.status = status;
    assert.throws(() => assertWindowsExecutableSecurity(record));
  }
});
test('normalization accepts only Low to Medium or an unchanged Medium record', () => {
  const receipt = {
    schemaVersion: 1,
    kind: 'windows-executable-security-normalization',
    changed: true,
    before: fixture(4096),
    after: fixture(),
  };
  assertWindowsExecutableSecurityNormalization(receipt);
  assertWindowsExecutableSecurityNormalization({
    ...receipt,
    changed: false,
    before: fixture(),
  });
  for (const key of [
    'sha256',
    'bytes',
    'path',
    'ownerSid',
    'ownerSddl',
    'ownerSha256',
    'daclSddl',
    'daclSha256',
    'streams',
    'authenticode',
  ]) {
    const changed = structuredClone(receipt);
    if (key === 'bytes') changed.before[key]++;
    else if (key === 'streams')
      changed.before.streams.push({
        name: 'other',
        bytes: 0,
        sha256: digest(''),
        zoneId: null,
      });
    else if (key === 'authenticode')
      changed.before.authenticode.status = 'UnknownError';
    else changed.before[key] += 'changed';
    assert.throws(
      () => assertWindowsExecutableSecurityNormalization(changed),
      key,
    );
  }
  assert.throws(() =>
    assertWindowsExecutableSecurityNormalization({
      ...receipt,
      before: fixture(12288),
    }),
  );
  assert.throws(() =>
    assertWindowsExecutableSecurityNormalization({
      ...receipt,
      changed: false,
    }),
  );
});
