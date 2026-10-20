import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { win32, resolve, dirname, join } from 'node:path';
import { promisify } from 'node:util';

const helper = fileURLToPath(
  new URL('./windows-executable-security.ps1', import.meta.url),
);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const sha256 = /^[a-f0-9]{64}$/;
const hasControlCharacter = (value) =>
  [...value].some((character) => character.codePointAt(0) < 32);
function localExecutablePath(path) {
  assert.equal(typeof path, 'string');
  const value = path.replaceAll('/', '\\');
  assert.match(value, /^[a-z]:\\/i, 'An absolute local EXE path is required');
  assert.ok(
    !hasControlCharacter(value) &&
      !/[<>"|?*]/.test(value) &&
      !value.slice(2).includes(':'),
  );
  assert.ok(
    value
      .slice(3)
      .split('\\')
      .every(
        (part) => part && part !== '.' && part !== '..' && !/[. ]$/.test(part),
      ),
  );
  assert.equal(win32.normalize(value), value);
  assert.match(value, /\.exe$/i);
  return value;
}
function validateRecord(record) {
  assert.equal(record?.schemaVersion, 1);
  assert.equal(record.kind, 'windows-executable-security');
  localExecutablePath(record.path);
  assert.ok(Number.isSafeInteger(record.bytes) && record.bytes > 0);
  assert.match(record.sha256, sha256);
  assert.equal(record.securityInformation, 0x15);
  assert.match(record.ownerSid, /^S-1-\d+(?:-\d+)+$/);
  assert.equal(typeof record.ownerSddl, 'string');
  assert.ok(record.ownerSddl.startsWith('O:'));
  assert.equal(record.ownerSha256, hash(record.ownerSddl));
  assert.equal(typeof record.daclSddl, 'string');
  assert.equal(record.daclSha256, hash(record.daclSddl));
  assert.equal(typeof record.labelSddl, 'string');
  assert.ok(Array.isArray(record.integrity?.labels));
  const labels = record.integrity.labels;
  assert.equal(record.integritySid, 'S-1-16-' + record.integrity.rid);
  assert.ok(labels.length <= 1, 'Multiple mandatory labels are ambiguous');
  if (labels.length === 0) {
    assert.equal(record.integrity.source, 'windows-default-medium');
    assert.equal(record.integrity.rid, 8192);
    assert.ok(
      !record.labelSddl.includes('(ML;'),
      'Label SDDL contradicts the default',
    );
  } else {
    const label = labels[0];
    assert.equal(record.integrity.source, 'mandatory-label');
    assert.ok(Number.isSafeInteger(label.rid) && label.rid >= 0);
    assert.equal(record.integrity.rid, label.rid);
    assert.equal(label.sid, 'S-1-16-' + label.rid);
    assert.equal(typeof label.inherited, 'boolean');
    assert.ok(
      Number.isSafeInteger(label.mask) && label.mask >= 0 && label.mask <= 7,
    );
    assert.ok(
      record.labelSddl.includes('(ML;'),
      'Mandatory label SDDL is required',
    );
  }
  assert.ok(Array.isArray(record.streams));
  const names = new Set();
  for (const stream of record.streams) {
    assert.equal(typeof stream.name, 'string');
    assert.ok(
      stream.name &&
        !hasControlCharacter(stream.name) &&
        !/[\\/:]/.test(stream.name),
    );
    const key = stream.name.toLowerCase();
    assert.ok(!names.has(key), 'Duplicate alternate stream');
    names.add(key);
    assert.ok(Number.isSafeInteger(stream.bytes) && stream.bytes >= 0);
    assert.match(stream.sha256, sha256);
    assert.ok(
      stream.zoneId === null ||
        (Number.isSafeInteger(stream.zoneId) && stream.zoneId >= 0),
    );
    if (key !== 'zone.identifier') assert.equal(stream.zoneId, null);
  }
  assert.equal(typeof record.authenticode?.status, 'string');
  for (const key of ['signerCertificateSha256', 'timestampCertificateSha256'])
    assert.ok(
      record.authenticode[key] === null ||
        sha256.test(record.authenticode[key]),
    );
  return record;
}

/** Shipping safety policy. Unsigned local builds are allowed; no metadata is changed. */
export function assertWindowsExecutableSecurity(record) {
  validateRecord(record);
  assert.equal(
    record.integrity.rid,
    8192,
    'The original shipping EXE must have Medium integrity',
  );
  assert.ok(
    !record.streams.some(
      (stream) => stream.name.toLowerCase() === 'zone.identifier',
    ),
    'The original shipping EXE contains Zone.Identifier / MOTW',
  );
  assert.ok(
    ['Valid', 'NotSigned'].includes(record.authenticode.status),
    'Abnormal or unknown Authenticode status',
  );
  if (record.authenticode.status === 'Valid')
    assert.match(record.authenticode.signerCertificateSha256 ?? '', sha256);
  return record;
}

/** Verify preservation independently of the native operation; also used by focused tests. */
export function assertWindowsExecutableSecurityNormalization(receipt) {
  assert.equal(receipt?.schemaVersion, 1);
  assert.equal(receipt.kind, 'windows-executable-security-normalization');
  const { before, after } = receipt;
  validateRecord(before);
  assertWindowsExecutableSecurity(after);
  assert.ok([4096, 8192].includes(before.integrity.rid));
  assert.equal(receipt.changed, before.integrity.rid === 4096);
  for (const key of [
    'path',
    'bytes',
    'sha256',
    'ownerSid',
    'ownerSddl',
    'ownerSha256',
    'daclSddl',
    'daclSha256',
    'streams',
    'authenticode',
  ])
    assert.deepEqual(
      after[key],
      before[key],
      'Normalization changed protected field: ' + key,
    );
  if (!receipt.changed) assert.deepEqual(after, before);
  return receipt;
}

async function inspect(path, mode) {
  assert.equal(
    process.platform,
    'win32',
    'Windows security inspection requires Windows',
  );
  path = localExecutablePath(path);
  const powershell = win32.join(
    process.env.WINDIR,
    'System32/WindowsPowerShell/v1.0/powershell.exe',
  );
  const profileRoot = process.env.TABLEMAX_WINDOWS_ACCEPTANCE_PROFILE_ROOT;
  const temporaryParent = profileRoot
    ? process.env.TEMP
    : fileURLToPath(new URL('../../tmp/', import.meta.url));
  assert.equal(
    typeof temporaryParent,
    'string',
    'A private compiler temporary parent is required',
  );
  if (profileRoot) {
    const relative = win32.relative(profileRoot, temporaryParent);
    assert.ok(
      relative &&
        !win32.isAbsolute(relative) &&
        relative !== '..' &&
        !relative.startsWith('..\\'),
      'Compiler temporary files must remain inside the verified profile',
    );
  }
  for (let cursor = resolve(temporaryParent); ; cursor = dirname(cursor)) {
    try {
      assert.ok(
        !(await lstat(cursor)).isSymbolicLink(),
        'Linked security compiler path',
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (dirname(cursor) === cursor) break;
  }
  await mkdir(temporaryParent, { recursive: true });
  const temporary = await mkdtemp(
    join(temporaryParent, 'executable-security-'),
  );
  const { stdout } = await promisify(execFile)(
    powershell,
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      helper,
      '-LiteralPath',
      path,
      '-Mode',
      mode,
    ],
    {
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        TEMP: temporary,
        TMP: temporary,
        PSModulePath: win32.join(
          process.env.WINDIR,
          'System32/WindowsPowerShell/v1.0/Modules',
        ),
      },
    },
  );
  return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
}

export async function readWindowsExecutableSecurity(path) {
  return validateRecord(await inspect(path, 'Read'));
}

/** Only trusted artifacts/tmp EXEs or the marked dev entry; preserves all other metadata. */
export async function normalizeBuiltExecutableSecurity(path) {
  return assertWindowsExecutableSecurityNormalization(
    await inspect(path, 'NormalizeBuilt'),
  );
}
