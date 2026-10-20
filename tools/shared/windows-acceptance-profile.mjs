import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  unlink,
} from 'node:fs/promises';
import { win32 } from 'node:path';

const mediumIntegritySid = 'S-1-16-8192'; // SECURITY_MANDATORY_MEDIUM_RID = 0x2000
const resolvedProfiles = new WeakSet();
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const equalPath = (left, right) => left.toLowerCase() === right.toLowerCase();
const hasControlCharacter = (value) =>
  [...value].some((character) => character.codePointAt(0) < 32);

function localPath(value) {
  assert.equal(typeof value, 'string', 'A Windows path is required');
  assert.ok(
    /^[a-z]:[\\/](?![\\/])/i.test(value),
    'Only ordinary local drive paths are allowed',
  );
  assert.ok(
    !hasControlCharacter(value) &&
      !/[<>"|?*]/.test(value) &&
      !value.slice(2).includes(':'),
    'Unsafe Windows path',
  );
  const normalized = value.replaceAll('/', '\\').replace(/\\+$/, '');
  const components = normalized.slice(3).split('\\');
  assert.ok(
    components.every(
      (part) => part && part !== '.' && part !== '..' && !/[. ]$/.test(part),
    ),
    'Ambiguous Windows path',
  );
  assert.equal(
    win32.normalize(normalized),
    normalized,
    'Windows path aliases are forbidden',
  );
  return normalized;
}

function within(root, path) {
  const relative = win32.relative(root, path);
  return (
    relative === '' ||
    (!win32.isAbsolute(relative) &&
      relative !== '..' &&
      !relative.startsWith('..\\'))
  );
}

function acceptanceLocation({
  root,
  configuredParent,
  expectedSid,
  isolated,
  identity,
}) {
  assert.equal(
    isolated,
    '1',
    'Profile acceptance requires the explicit isolation flag',
  );
  assert.match(
    expectedSid ?? '',
    /^S-1-5-21-\d+-\d+-\d+-\d+$/,
    'An isolated account SID is required',
  );
  assert.ok(
    Number(expectedSid.split('-').at(-1)) >= 1000,
    'A newly created local account SID is required',
  );
  assert.equal(
    identity.ownerSid,
    expectedSid,
    'The actual account SID differs',
  );
  assert.equal(
    identity.elevated,
    false,
    'Profile acceptance requires a standard token',
  );
  assert.equal(typeof identity.machineName, 'string');
  const account = String(identity.accountName).split('\\');
  assert.equal(account.length, 2, 'A local test account is required');
  assert.ok(
    equalPath(account[0], identity.machineName),
    'A local test account is required',
  );
  assert.match(
    account[1],
    /^TMVerify_[0-9a-f]{8}$/i,
    'Only a temporary acceptance account is allowed',
  );
  const profile = localPath(identity.profile);
  assert.ok(
    equalPath(win32.basename(profile), account[1]),
    'The loaded profile differs from the temporary account',
  );
  const localAppData = localPath(identity.localAppData);
  assert.ok(
    within(profile, localAppData) && !equalPath(profile, localAppData),
    'Actual LocalAppData must belong to the test profile',
  );
  const configuredRoot = localPath(root);
  const id = win32.basename(configuredRoot);
  assert.match(
    id,
    /^[0-9a-f]{32}$/i,
    'The profile acceptance directory needs a unique 32-hex name',
  );
  const actualRoot = win32.join(localAppData, 'TableMaxAcceptance', id);
  assert.ok(
    equalPath(configuredRoot, actualRoot),
    'Acceptance ROOT differs from actual LocalAppData',
  );
  const workParent = win32.join(actualRoot, 'work');
  assert.ok(
    equalPath(localPath(configuredParent), workParent),
    'Configured parent must be ROOT/work',
  );
  return {
    root: actualRoot,
    workParent,
    ownerSid: expectedSid,
    profile,
    localAppData,
  };
}

/** Pure validation for review/tests; only resolveWindowsAcceptanceProfile grants I/O capability. */
export function validateWindowsAcceptanceContext(options) {
  const profile = acceptanceLocation(options);
  for (const [name, expectedPid] of [
    ['node', options.nodePid],
    ['inspector', options.inspectorPid],
  ]) {
    const token = options.identity[name];
    assert.ok(
      Number.isSafeInteger(expectedPid) && expectedPid > 0,
      'An actual process ID is required',
    );
    assert.equal(token?.pid, expectedPid, `${name} process differs`);
    assert.equal(token.ownerSid, profile.ownerSid, `${name} owner SID differs`);
    assert.equal(token.elevated, false, `${name} must use a standard token`);
    assert.equal(
      token.integritySid,
      mediumIntegritySid,
      `${name} must actually run at Medium integrity`,
    );
  }
  assert.notEqual(
    options.nodePid,
    options.inspectorPid,
    'The inspector must be an actual child process',
  );
  return Object.freeze({ ...profile, integritySid: mediumIntegritySid });
}

/** Pure destination validation; this does not grant permission to materialize bytes. */
export function acceptanceExecutablePath(profile, directory, name) {
  const root = localPath(profile.root),
    destination = localPath(directory);
  assert.ok(
    within(root, destination),
    'Executable destination escapes the private acceptance root',
  );
  assert.equal(typeof name, 'string');
  assert.ok(
    name.length > 4 && name.length <= 180 && name === win32.basename(name),
    'A plain executable basename is required',
  );
  assert.ok(
    /\.exe$/i.test(name) &&
      !hasControlCharacter(name) &&
      !/[\\/:<>"|?*]/.test(name) &&
      !/^[ .]|[. ]$/.test(name),
    'Unsafe executable basename',
  );
  assert.ok(
    !/^(con|prn|aux|nul|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3])(?:\.|$)/i.test(
      name,
    ),
    'Windows device basenames are forbidden',
  );
  return win32.join(destination, name);
}

async function noLinks(path, { allowMissing = false, file = false } = {}) {
  const full = localPath(path);
  for (let cursor = full; ; cursor = win32.dirname(cursor)) {
    const entry = await lstat(cursor).catch((error) => {
      if (allowMissing && error.code === 'ENOENT') return null;
      throw error;
    });
    if (entry) {
      assert.ok(
        !entry.isSymbolicLink(),
        'Acceptance paths must not contain links',
      );
      assert.ok(
        cursor === full && file ? entry.isFile() : entry.isDirectory(),
        'Unexpected acceptance path type',
      );
      assert.ok(
        equalPath(await realpath(cursor), cursor),
        'Acceptance path resolves through an alias',
      );
    }
    const parent = win32.dirname(cursor);
    if (parent === cursor) break;
  }
}

function systemPowerShell() {
  const windows = localPath(process.env.SystemRoot ?? process.env.WINDIR);
  return {
    executable: win32.join(
      windows,
      'System32/WindowsPowerShell/v1.0/powershell.exe',
    ),
    modules: win32.join(windows, 'System32/WindowsPowerShell/v1.0/Modules'),
  };
}

function inspect(script, { workParent } = {}) {
  const host = systemPowerShell();
  return new Promise((resolve, reject) => {
    const child = execFile(
      host.executable,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);\n" +
          script,
      ],
      {
        windowsHide: true,
        timeout: 30000,
        maxBuffer: 256 * 1024,
        env: {
          ...process.env,
          PSModulePath: host.modules,
          ...(workParent ? { TEMP: workParent, TMP: workParent } : {}),
        },
      },
      (error, stdout) => {
        if (error)
          return reject(
            new Error('Cannot inspect the actual Windows acceptance identity', {
              cause: error,
            }),
          );
        try {
          resolve({ pid: child.pid, identity: JSON.parse(stdout.trim()) });
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

const identityScript = `
$user=[Security.Principal.WindowsIdentity]::GetCurrent()
@{ownerSid=$user.User.Value;accountName=$user.Name;machineName=[Environment]::MachineName;profile=[Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile);localAppData=[Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData,[Environment+SpecialFolderOption]::DoNotVerify);elevated=([Security.Principal.WindowsPrincipal]::new($user)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)} | ConvertTo-Json -Compress
`;

// Only queried access rights; no token, integrity label, registry or ACL mutation APIs.
// https://learn.microsoft.com/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation
const tokenScript = `
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.Principal;
public static class TableMaxAcceptanceTokenProbe {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr token, int kind, IntPtr data, int size, out int needed);
  static string ReadSid(IntPtr token, int kind) {
    int needed;
    if(GetTokenInformation(token, kind, IntPtr.Zero, 0, out needed) || Marshal.GetLastWin32Error()!=122 || needed<=0 || needed>65536) throw new InvalidOperationException("Invalid token SID size");
    IntPtr data=Marshal.AllocHGlobal(needed);
    try {
      if(!GetTokenInformation(token, kind, data, needed, out needed)) throw new Win32Exception(Marshal.GetLastWin32Error());
      return new SecurityIdentifier(Marshal.ReadIntPtr(data)).Value;
    } finally { Marshal.FreeHGlobal(data); }
  }
  static bool Elevated(IntPtr token) {
    IntPtr data=Marshal.AllocHGlobal(4);
    try {
      int needed;
      if(!GetTokenInformation(token, 20, data, 4, out needed)) throw new Win32Exception(Marshal.GetLastWin32Error());
      if(needed!=4) throw new InvalidOperationException("Invalid TOKEN_ELEVATION size");
      return Marshal.ReadInt32(data)!=0;
    } finally { Marshal.FreeHGlobal(data); }
  }
  public static object Read(int pid) {
    IntPtr process=OpenProcess(0x1000, false, pid), token=IntPtr.Zero;
    if(process==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
    try {
      if(!OpenProcessToken(process, 0x0008, out token)) throw new Win32Exception(Marshal.GetLastWin32Error());
      return new Dictionary<string,object>{{"pid",pid},{"ownerSid",ReadSid(token,1)},{"integritySid",ReadSid(token,25)},{"elevated",Elevated(token)}};
    } finally { if(token!=IntPtr.Zero) CloseHandle(token); CloseHandle(process); }
  }
}
'@
`;

/** Read-only probe for a running local process; never changes its token. */
export async function readWindowsProcessToken(pid, workParent) {
  assert.ok(
    Number.isSafeInteger(pid) && pid > 0,
    'A positive process ID is required',
  );
  const observed = await inspect(
    tokenScript +
      `\n[TableMaxAcceptanceTokenProbe]::Read(${pid}) | ConvertTo-Json -Compress`,
    { workParent },
  );
  return observed.identity;
}

export async function resolveWindowsAcceptanceProfile(configuredParent) {
  const root = process.env.TABLEMAX_WINDOWS_ACCEPTANCE_PROFILE_ROOT;
  if (!root) return null;
  assert.equal(
    process.platform,
    'win32',
    'Windows profile acceptance requires Windows',
  );
  const options = {
    root,
    configuredParent,
    expectedSid: process.env.TABLEMAX_WINDOWS_ACCEPTANCE_PROFILE_SID,
    isolated: process.env.TABLEMAX_ISOLATED_WINDOWS_ACCEPTANCE,
  };
  assert.equal(
    options.isolated,
    '1',
    'Profile acceptance requires the explicit isolation flag',
  );
  const observed = await inspect(identityScript);
  const location = acceptanceLocation({
    ...options,
    identity: observed.identity,
  });
  await noLinks(location.workParent);
  // Any temporary compiler artifacts from system Windows PowerShell remain in this
  // already verified private work directory, after profile authorization by the driver.
  const tokens = await inspect(
    tokenScript +
      `\n@{node=[TableMaxAcceptanceTokenProbe]::Read(${process.pid});inspector=[TableMaxAcceptanceTokenProbe]::Read($PID)} | ConvertTo-Json -Depth 5 -Compress`,
    location,
  );
  const profile = validateWindowsAcceptanceContext({
    ...options,
    identity: { ...observed.identity, ...tokens.identity },
    nodePid: process.pid,
    inspectorPid: tokens.pid,
  });
  await noLinks(profile.workParent);
  resolvedProfiles.add(profile);
  return profile;
}

export async function materializeAcceptanceExecutable({
  source,
  expected,
  profile,
  directory,
  name,
}) {
  if (profile)
    assert.ok(
      resolvedProfiles.has(profile),
      'An actual resolved acceptance profile is required',
    );
  assert.ok(
    Number.isSafeInteger(expected?.bytes) && expected.bytes > 0,
    'Frozen executable bytes are required',
  );
  assert.match(
    expected.sha256 ?? '',
    /^[0-9a-f]{64}$/,
    'Frozen executable SHA-256 is required',
  );
  const sourcePath = localPath(source);
  assert.match(sourcePath, /\.exe$/i, 'The source must be a frozen executable');
  await noLinks(sourcePath, { file: true });
  const sourceBytes = await readFile(sourcePath);
  assert.equal(
    sourceBytes.length,
    expected.bytes,
    'Frozen source length differs',
  );
  assert.equal(
    digest(sourceBytes),
    expected.sha256,
    'Frozen source SHA differs',
  );
  if (!profile)
    return {
      sourcePath,
      path: sourcePath,
      bytes: expected.bytes,
      sha256: expected.sha256,
    };
  const path = acceptanceExecutablePath(profile, directory, name);
  await noLinks(profile.workParent);
  await noLinks(directory, { allowMissing: true });
  await mkdir(directory, { recursive: true });
  await noLinks(directory);
  let handle;
  let createdIdentity;
  try {
    handle = await open(path, 'wx');
    createdIdentity = await handle.stat();
    await handle.writeFile(sourceBytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await noLinks(path, { file: true });
    const written = await readFile(path);
    assert.equal(
      written.length,
      expected.bytes,
      'Execution copy length differs',
    );
    assert.equal(
      digest(written),
      expected.sha256,
      'Execution copy SHA differs',
    );
    await noLinks(sourcePath, { file: true });
    const after = await readFile(sourcePath);
    assert.equal(
      after.length,
      expected.bytes,
      'Frozen source length changed during materialization',
    );
    assert.equal(
      digest(after),
      expected.sha256,
      'Frozen source changed during materialization',
    );
    return { sourcePath, path, bytes: expected.bytes, sha256: expected.sha256 };
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    // Only a successful exclusive creation grants permission to remove this file.
    if (createdIdentity) {
      await (async () => {
        await noLinks(path, { file: true });
        const current = await lstat(path);
        if (
          current.dev === createdIdentity.dev &&
          current.ino === createdIdentity.ino
        )
          await unlink(path);
      })().catch(() => {});
    }
    throw error;
  }
}
