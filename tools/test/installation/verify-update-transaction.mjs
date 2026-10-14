import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStrictJson } from '../../shared/application-update.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

const fixtureProduct = '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const powershell = join(
  process.env.WINDIR ?? 'C:/Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe',
);
const databaseNames = [
  'foundation.sqlite',
  'foundation.sqlite-wal',
  'foundation.sqlite-shm',
  'foundation.sqlite-journal',
  'room.sqlite',
  'room.sqlite-wal',
  'room.sqlite-shm',
  'room.sqlite-journal',
  'room.sqlite.migration.json',
  'room.sqlite.migration.lock',
];
const processCleanupSource = String.raw`
$ErrorActionPreference = 'Stop'
$taskOwnRoot = [IO.Path]::GetFullPath($env:TABLEMAX_VERIFY_OWN_ROOT).TrimEnd('\')
if (-not $taskOwnRoot -or -not (Test-Path -LiteralPath $taskOwnRoot)) { throw 'Missing private process root' }
$taskSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if ($env:TABLEMAX_VERIFY_NATIVE_STARTED -ne '1') {
  $taskRemaining = @(Get-Process | Where-Object { try { $_.MainModule.FileName.StartsWith($taskOwnRoot + '\', [StringComparison]::OrdinalIgnoreCase) } catch { $false } })
  if ($taskRemaining.Count) { throw 'Unexpected private helper process remains' }
  @{ stopped = @(); remaining = 0; method = 'Exited tracked helpers; private image path enumeration; no native startup requested' } | ConvertTo-Json -Compress
  exit 0
}
function Test-OwnProcess($taskItem) {
  if ($taskItem.ExecutablePath -and $taskItem.ExecutablePath.StartsWith($taskOwnRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { return $true }
  if ($taskItem.Name -ne 'msedgewebview2.exe' -or -not $taskItem.CommandLine) { return $false }
  $taskMatch = [regex]::Match($taskItem.CommandLine, '--user-data-dir=(?:"([^"\r\n]+)"|([^ \r\n]+))')
  if (-not $taskMatch.Success) { return $false }
  $taskProfile = if ($taskMatch.Groups[1].Success) { $taskMatch.Groups[1].Value } else { $taskMatch.Groups[2].Value }
  return [IO.Path]::GetFullPath($taskProfile).StartsWith($taskOwnRoot + '\', [StringComparison]::OrdinalIgnoreCase)
}
$taskStopped = @()
foreach ($taskItem in Get-CimInstance Win32_Process) {
  if (-not (Test-OwnProcess $taskItem)) { continue }
  try { $taskProcess = [Diagnostics.Process]::GetProcessById($taskItem.ProcessId) } catch [ArgumentException] { continue }
  try {
    $taskHandle = $taskProcess.Handle
    if ($taskProcess.HasExited) { continue }
    if ([Math]::Abs(($taskProcess.StartTime.ToUniversalTime() - $taskItem.CreationDate.ToUniversalTime()).TotalMilliseconds) -gt 0.001) { throw 'Process creation changed' }
    if ($taskProcess.MainModule.FileName -ne $taskItem.ExecutablePath) { throw 'Process image changed' }
    $taskOwner = Invoke-CimMethod -InputObject $taskItem -MethodName GetOwnerSid
    if ($taskOwner.Sid -ne $taskSid) { throw 'Own test process SID changed' }
    $taskProcess.Kill()
    if (-not $taskProcess.WaitForExit(5000)) { throw 'Own test process did not exit' }
    $taskStopped += $taskItem.ProcessId
  } finally { $taskProcess.Dispose() }
}
$taskRemaining = @(Get-CimInstance Win32_Process | Where-Object { Test-OwnProcess $_ })
if ($taskRemaining.Count) { throw 'Own test processes remain' }
@{ stopped = $taskStopped; remaining = 0 } | ConvertTo-Json -Compress
`;
const cases = [
  [
    'root-junction',
    false,
    'Linked installation root rejects without touching target',
  ],
  [
    'candidate-junction',
    false,
    'Linked candidate rejects without touching target',
  ],
  [
    'managed-collision',
    false,
    'First install preserves unknown managed destination',
  ],
  [
    'manifest-path-escape',
    false,
    'Manifest cannot authorize deleting protected data',
  ],
  [
    'journal-partial-preparation',
    false,
    'Modified preparation copy remains diagnostic',
  ],
  ['journal-unknown-phase', false, 'Unknown durable phase remains diagnostic'],
  [
    'baseline',
    false,
    'Actual fixture helper commits and confirms actual native/service',
  ],
  ['unknown-app', true, 'Unknown app member blocks commit and uninstall'],
  [
    'unknown-app-junction',
    true,
    'Linked app member preserves its external target',
  ],
  [
    'damaged-repair',
    true,
    'Missing/damaged owned members repaired; damaged bytes retained',
  ],
  [
    'bad-candidate',
    true,
    'Changed candidate fails before live program replacement',
  ],
  [
    'operation-lock',
    true,
    'Global installation mutex rejects concurrent operation',
  ],
  [
    'run-lock',
    true,
    'Global running mutex without trusted control cannot be bypassed',
  ],
  ['database-lock', true, 'Exclusive SQLite ownership prevents program commit'],
  [
    'journal-preparing',
    true,
    'Complete preparation copies retired without changing live bytes',
  ],
  [
    'journal-prepared',
    true,
    'Prepared snapshot recovers exact previous program',
  ],
  [
    'journal-switching',
    true,
    'Missing member during switching recovers exact snapshot',
  ],
  [
    'journal-installed',
    true,
    'Installed phase recovers exact previous snapshot',
  ],
  [
    'journal-health-unchanged',
    true,
    'Unchanged database permits program-only recovery',
  ],
  [
    'health-changed-database',
    true,
    'Actual health failure preserves changed DB and retries same target',
  ],
  [
    'pending-damaged-uninstall',
    true,
    'Changed DB and damaged/missing owned files retain diagnostics and permit safe data-preserving uninstall/reinstall',
  ],
  ['portable-lock', true, 'Original portable data mutex blocks migration'],
  [
    'portable-default',
    true,
    'Default portable data/history copied, original bytes retained',
  ],
  [
    'portable-external',
    true,
    'External data pointer retained; original B/D/history protected',
  ],
  [
    'uninstall-reinstall',
    true,
    'Default helper uninstall/reinstall preserves data/history/unknown files',
  ],
];

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
async function noLinks(path) {
  for (let cursor = resolve(path); ; cursor = dirname(cursor)) {
    if (await exists(cursor))
      assert.ok(
        !(await lstat(cursor)).isSymbolicLink(),
        'Linked path: ' + cursor,
      );
    if (cursor === dirname(cursor)) break;
  }
}
function within(parent, path) {
  const name = relative(resolve(parent), resolve(path));
  assert.ok(
    name && !isAbsolute(name) && !name.startsWith('..' + sep) && name !== '..',
  );
  return resolve(path);
}
function member(parent, path) {
  assert.ok(
    typeof path === 'string' &&
      !path.includes('\\') &&
      !path.includes(':') &&
      !path.startsWith('/') &&
      path.split('/').every((part) => part && part !== '.' && part !== '..'),
    'Unsafe fixture member',
  );
  return within(parent, join(parent, ...path.split('/')));
}
async function fileRecord(path) {
  await noLinks(path);
  const data = await readFile(path);
  return { bytes: data.length, sha256: digest(data) };
}
async function inventory(root) {
  if (!(await exists(root))) return [];
  const records = [];
  async function visit(directory) {
    await noLinks(directory);
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      assert.ok(!item.isSymbolicLink(), 'Linked inventory member');
      if (item.isDirectory()) await visit(path);
      else
        records.push({
          path: relative(root, path).split(sep).join('/'),
          ...(await fileRecord(path)),
        });
    }
  }
  await visit(root);
  return records.sort((a, b) => a.path.localeCompare(b.path));
}
async function copyTree(source, target) {
  for (const item of await inventory(source)) {
    const destination = member(target, item.path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(member(source, item.path), destination);
    assert.deepEqual(await fileRecord(destination), {
      bytes: item.bytes,
      sha256: item.sha256,
    });
  }
}
async function json(path, canonicalIntegers = false) {
  return parseStrictJson(await readFile(path), 1024 * 1024, {
    canonicalIntegers,
  });
}
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n');
}
async function fingerprint(directory) {
  return digest(
    Buffer.from(
      (
        await Promise.all(
          databaseNames.map(
            async (name) =>
              `${name}:${(await exists(join(directory, name))) ? (await fileRecord(join(directory, name))).sha256 : 'missing'}`,
          ),
        )
      ).join('\n'),
    ),
  );
}

/** Only fixture helper operations; never executes the supplied Inno EXE. */
export async function verifyUpdateTransactions({
  candidate,
  manifest: manifestPath,
  helper,
  installerSource,
  evidence,
  only,
}) {
  assertWorkspaceRoot();
  assert.equal(process.platform, 'win32');
  const repository = resolve('.');
  candidate = within(repository, candidate);
  manifestPath = within(candidate, manifestPath);
  helper = within(repository, helper);
  installerSource = within(repository, installerSource);
  evidence = within(resolve('artifacts/maintenance'), evidence);
  for (const path of [
    candidate,
    manifestPath,
    helper,
    installerSource,
    evidence,
  ])
    await noLinks(path);
  assert.ok(!(await exists(evidence)), 'Use a new evidence directory');
  const manifest = await json(manifestPath, true);
  assert.equal(
    manifest.productId,
    fixtureProduct,
    'Production products are prohibited',
  );
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.installProtocol, 1);
  assert.equal(manifest.arch, 'x64');
  assert.ok(Array.isArray(manifest.files) && manifest.files.length);
  const sourceRecords = [];
  const names = new Set();
  for (const file of manifest.files) {
    assert.ok(!names.has(file.path.toLowerCase()), 'Duplicate managed member');
    names.add(file.path.toLowerCase());
    assert.ok(
      file.path === 'TableMax.exe' ||
        file.path === 'UpdateHelper.exe' ||
        file.path.startsWith('TableMax/app/'),
    );
    const record = await fileRecord(member(candidate, file.path));
    assert.deepEqual(
      record,
      { bytes: file.bytes, sha256: file.sha256 },
      file.path,
    );
    sourceRecords.push({ path: file.path, ...record });
  }
  const helperRecord = await fileRecord(helper);
  assert.deepEqual(
    helperRecord,
    sourceRecords.find((file) => file.path === 'UpdateHelper.exe') && {
      bytes: manifest.files.find((file) => file.path === 'UpdateHelper.exe')
        .bytes,
      sha256: manifest.files.find((file) => file.path === 'UpdateHelper.exe')
        .sha256,
    },
  );
  assert.equal(
    (await fileRecord(member(candidate, 'TableMax/app/.tablemax-release.json')))
      .sha256,
    manifest.payloadManifestSha256,
  );
  assert.equal(
    (
      await fileRecord(
        member(candidate, 'TableMax/app/preinstalled-games/bootstrap.json'),
      )
    ).sha256,
    manifest.currentMappingSha256,
  );
  const manifestRecord = await fileRecord(manifestPath);
  const installerRecord = await fileRecord(installerSource);
  assert.ok(installerRecord.bytes > 0 && installerRecord.bytes < 120000000);
  const selected = new Set(only?.length ? only : cases.map(([id]) => id));
  for (const id of selected)
    assert.ok(
      cases.some(([known]) => id === known),
      'Unknown case: ' + id,
    );
  if (cases.some(([id, baseline]) => baseline && selected.has(id)))
    selected.add('baseline');
  await noLinks(resolve('tmp'));
  await mkdir(resolve('tmp'), { recursive: true });
  const work = await mkdtemp(resolve('tmp/installation-transaction-'));
  await mkdir(dirname(evidence), { recursive: true });
  await mkdir(evidence, { recursive: false });
  const logs = join(evidence, 'logs');
  await mkdir(logs);
  const transientHelper = join(work, 'tools', 'UpdateHelper.exe');
  await mkdir(dirname(transientHelper));
  await copyFile(helper, transientHelper);
  assert.deepEqual(await fileRecord(transientHelper), helperRecord);
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith('TABLEMAX_') &&
        !key.startsWith('WEBVIEW2_') &&
        !['NODE_OPTIONS', 'NODE_PATH'].includes(key),
    ),
  );
  Object.assign(environment, {
    TABLEMAX_AUTO_MAINTENANCE: '0',
    TABLEMAX_TEST_MAINTENANCE: '0',
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
    TEMP: work,
    TMP: work,
    TABLEMAX_VERIFY_OWN_ROOT: work,
  });
  const report = {
    format: 1,
    startedAtUtc: new Date().toISOString(),
    result: 'running',
    cacheable: false,
    work,
    fixtureProduct,
    input: {
      candidate,
      manifestPath,
      manifestRecord,
      helper,
      helperRecord,
      transientHelper,
      installerSource,
      installerRecord,
      releaseVersion: manifest.releaseVersion,
      buildVersion: manifest.buildVersion,
      payloadManifestSha256: manifest.payloadManifestSha256,
      currentMappingSha256: manifest.currentMappingSha256,
      files: sourceRecords,
    },
    results: [],
    failureLimit: 3,
    failures: 0,
    databaseFingerprintNames: databaseNames,
    boundary:
      'Actual fixture helper, candidate files, native/service health and isolated B/D/G. No Inno execution, Windows registration/accounts/shortcuts, production GUID, real HTTP, genuine power loss, actual prior/new PE revision upgrade or historical saved-game compatibility acceptance. Constructed journal cases are explicitly synthetic durable inputs.',
    requiredSeparateAcceptance: [
      'Production standard-user installer/shortcuts/uninstall registration',
      'Actual different-build manual and box update using identical installer transaction',
      'Saved-game exact historical release recovery after upgrade',
      'Trusted parent shutdown failure/nonzero exit and helper handoff/self replacement',
      'Actual disk-full/nonwritable/file-in-use switch and precise interrupted process cases',
      'Continuous portable SQLite snapshot lease and cross-session old/new shared external D exclusion',
    ],
  };
  let sequence = 0;
  const active = new Set();
  async function execute(executable, args, label, timeout = 110000) {
    const record = { executable, args, startedAtUtc: new Date().toISOString() };
    const child = spawn(executable, args, {
      cwd: repository,
      windowsHide: true,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    active.add(child);
    record.pid = child.pid;
    let output = '',
      overflow = false;
    const save = (chunk) => {
      if (output.length < 2 * 1024 * 1024) output += chunk.toString('utf8');
      else overflow = true;
    };
    child.stdout.on('data', save);
    child.stderr.on('data', save);
    const started = performance.now();
    const result = await new Promise((done, reject) => {
      const timer = setTimeout(() => {
        record.timedOut = true;
        child.kill();
      }, timeout);
      child.once('error', (error) => {
        clearTimeout(timer);
        active.delete(child);
        reject(error);
      });
      child.once('close', (code, signal) => {
        clearTimeout(timer);
        active.delete(child);
        done({ code, signal });
      });
    });
    Object.assign(record, result, {
      durationMs: Math.round(performance.now() - started),
      overflow,
      log: join(logs, `${String(++sequence).padStart(3, '0')}-${label}.log`),
    });
    await writeFile(record.log, output);
    await writeJson(record.log + '.json', record);
    assert.ok(
      !record.timedOut && !overflow,
      'Process exceeded budget; see ' + record.log,
    );
    return { ...record, output };
  }
  const sidResult = await execute(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
    ],
    'account-sid',
  );
  assert.equal(sidResult.code, 0);
  const sid = sidResult.output.trim();
  assert.match(sid, /^S-1-5-/);
  report.accountSid = sid;
  const installRoot = join(work, '程序 空格');
  const box = join(installRoot, 'TableMax');
  await mkdir(box, { recursive: true });
  const protectedFiles = [
    join(installRoot, '朋友资料.txt'),
    join(box, '用户资料.txt'),
    join(box, 'games', 'original-history', 'required-old-release.bin'),
  ];
  for (const [index, path] of protectedFiles.entries()) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `Original isolated data ${index}\n`);
  }
  let protectedRecords = await Promise.all(
    protectedFiles.map(async (path) => ({ path, ...(await fileRecord(path)) })),
  );
  let baselineReady = false;
  let sqlFixtureCreated = false;
  const webMembers = manifest.files
    .filter(
      (file) => file.path.startsWith('TableMax/app/web/') && file.bytes > 0,
    )
    .sort((a, b) => a.path.length - b.path.length);
  const [small, missing] = webMembers;
  assert.ok(
    small && missing,
    'Real web members required for bounded repair fault',
  );
  async function protectedUnchanged() {
    for (const file of protectedRecords)
      assert.deepEqual(
        await fileRecord(file.path),
        { bytes: file.bytes, sha256: file.sha256 },
        file.path,
      );
  }
  async function programUnchanged(root = installRoot) {
    for (const file of manifest.files)
      assert.deepEqual(
        await fileRecord(member(root, file.path)),
        { bytes: file.bytes, sha256: file.sha256 },
        file.path,
      );
  }
  async function invoke(mode, root, extra = [], expected = 0, label = mode) {
    within(work, root);
    if (mode === 'commit' && [0, 40].includes(expected))
      environment.TABLEMAX_VERIFY_NATIVE_STARTED = '1';
    const result = await execute(
      transientHelper,
      [`--${mode}`, `--root=${root}`, ...extra],
      label,
    );
    assert.equal(result.code, expected, `${label}; see ${result.log}`);
    return result;
  }
  const commitArguments = [
    `--candidate=${candidate}`,
    `--manifest=${manifestPath}`,
    `--installer-source=${installerSource}`,
    '--health-timeout=90000',
  ];
  const commit = (
    root = installRoot,
    extra = [],
    expected = 0,
    label = 'commit',
  ) => invoke('commit', root, [...commitArguments, ...extra], expected, label);
  const transactionRoot = (root) =>
    join(root, 'TableMax', '.installation-transactions');
  async function transactions(root = installRoot) {
    const directory = transactionRoot(root);
    return (await exists(directory))
      ? (await readdir(directory))
          .filter((name) => /^[a-f0-9-]{36}$/i.test(name))
          .map((name) => join(directory, name))
      : [];
  }
  const identity = (root = installRoot) =>
    json(join(root, 'TableMax', '.install.json'));
  async function latestTransaction(before, root = installRoot) {
    const added = (await transactions(root)).filter(
      (path) => !before.includes(path),
    );
    assert.equal(added.length, 1);
    return added[0];
  }
  async function makeJournal(root, phase, previous = false) {
    const target = previous
      ? await identity(root)
      : {
          ...manifest,
          installationId: randomUUID(),
          root,
          boxRoot: join(root, 'TableMax'),
          ownerSid: sid,
        };
    const directory = join(transactionRoot(root), randomUUID());
    await mkdir(directory, { recursive: true });
    await writeJson(join(directory, 'target.json'), target);
    if (previous) {
      await writeJson(join(directory, 'previous.json'), target);
      await copyFile(
        join(root, 'TableMax', '.installer-receipt.json'),
        join(directory, 'previous-receipt.json'),
      );
      const snapshots = [];
      for (const file of target.files) {
        const destination = member(
          join(directory, 'previous-files'),
          file.path,
        );
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(member(root, file.path), destination);
        snapshots.push({ ...file, missing: false });
      }
      await writeJson(join(directory, 'previous-snapshot.json'), {
        schemaVersion: 1,
        files: snapshots,
      });
    }
    await writeJson(join(directory, 'state.json'), {
      schemaVersion: 1,
      root,
      phase,
      dataDirectory: previous ? join(root, 'TableMax') : null,
      databaseFingerprint: previous
        ? await fingerprint(join(root, 'TableMax'))
        : null,
    });
    return directory;
  }
  async function retainJournal(directory) {
    within(work, directory);
    const destination = join(work, 'retained-journal-' + randomUUID());
    const before = await inventory(directory);
    await rename(directory, destination);
    assert.deepEqual(await inventory(destination), before);
    return destination;
  }
  async function withHeldResource(kind, value, action) {
    const source =
      kind === 'file'
        ? '$resource=[IO.File]::Open($env:TABLEMAX_VERIFY_RESOURCE,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None); try { [Console]::WriteLine("READY"); [Console]::Out.Flush(); [Console]::In.ReadLine() | Out-Null } finally { $resource.Dispose() }'
        : '$resource=[Threading.Mutex]::new($false,$env:TABLEMAX_VERIFY_RESOURCE); if(-not $resource.WaitOne(0)){exit 2}; try { [Console]::WriteLine("READY"); [Console]::Out.Flush(); [Console]::In.ReadLine() | Out-Null } finally { $resource.ReleaseMutex(); $resource.Dispose() }';
    const child = spawn(
      powershell,
      ['-NoProfile', '-NonInteractive', '-Command', source],
      {
        windowsHide: true,
        cwd: work,
        env: { ...environment, TABLEMAX_VERIFY_RESOURCE: value },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    active.add(child);
    const ended = new Promise((done) =>
      child.once('close', (code) => {
        active.delete(child);
        done(code);
      }),
    );
    let output = '';
    await new Promise((done, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Resource holder readiness timed out'));
      }, 10000);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', () => {
        if (!output.includes('READY')) {
          clearTimeout(timer);
          reject(new Error('Resource holder failed: ' + output));
        }
      });
      child.stderr.on('data', (chunk) => {
        output += chunk.toString();
      });
      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
        if (output.includes('READY')) {
          clearTimeout(timer);
          done();
        }
      });
    });
    try {
      return await action();
    } finally {
      child.stdin.end('RELEASE\n');
      const timer = setTimeout(() => child.kill(), 5000);
      const code = await ended;
      clearTimeout(timer);
      assert.equal(code, 0, 'Own resource holder did not exit cleanly');
    }
  }
  const globalMutex = (kind, root) =>
    `Global\\TableMax-Installation-${kind}-${digest(Buffer.from(resolve(root).toLowerCase()))}`;
  async function sql(root, update) {
    const path = join(root, 'TableMax', 'room.sqlite');
    const code = update
      ? "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1]); db.exec('CREATE TABLE installation_transaction_fixture (value TEXT NOT NULL)'); db.prepare('INSERT INTO installation_transaction_fixture VALUES (?)').run('preserved-after-health-failure'); db.close(); console.log('changed-valid-database');"
      : "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1],{readOnly:true}); console.log(JSON.stringify(db.prepare('SELECT value FROM installation_transaction_fixture').all())); db.close();";
    const result = await execute(
      member(candidate, 'TableMax/app/node.exe'),
      ['-e', code, path],
      update ? 'sqlite-change' : 'sqlite-check',
    );
    assert.equal(
      result.code,
      0,
      'SQLite fixture operation failed: ' + result.log,
    );
    if (!update)
      assert.ok(result.output.includes('preserved-after-health-failure'));
    else sqlFixtureCreated = true;
  }
  async function portableSource(external) {
    const source = join(
      work,
      `旧便携 ${external ? '外部' : '默认'}-${randomUUID()}`,
    );
    const data = external ? join(work, '外置 数据-' + randomUUID()) : source;
    await mkdir(data, { recursive: true });
    await mkdir(source, { recursive: true });
    await copyFile(join(box, 'room.sqlite'), join(data, 'room.sqlite'));
    await writeFile(
      join(data, '朋友存档.txt'),
      'Original external/default saved data\n',
    );
    await writeFile(
      join(source, '用户偏好.json'),
      '{"fixture":"old-portable-settings"}\n',
    );
    await copyTree(join(box, 'games'), join(source, 'games'));
    await mkdir(join(source, 'app', 'games'), { recursive: true });
    await writeFile(join(source, 'app', 'modules.json'), '[]\n');
    await writeFile(
      join(source, 'app', 'games', 'legacy-fixture.cjs'),
      'module.exports={fixture:true};\n',
    );
    await writeJson(join(source, 'TableMax.config.json'), {
      dataDirectory: external ? data : '.',
    });
    return {
      source,
      data,
      before: await inventory(source),
      externalBefore: external ? await inventory(data) : null,
    };
  }
  const implementations = {
    async 'root-junction'() {
      const target = join(work, 'junction-victim');
      await mkdir(target);
      await writeFile(
        join(target, 'original.txt'),
        'untouched junction target\n',
      );
      const before = await inventory(target),
        link = join(work, 'linked-install');
      await symlink(target, link, 'junction');
      try {
        await invoke('recover', link, [], 10, 'root-junction');
        assert.deepEqual(await inventory(target), before);
      } finally {
        assert.ok((await lstat(link)).isSymbolicLink());
        await unlink(link);
      }
      return { target, preserved: before };
    },
    async 'candidate-junction'() {
      const root = join(work, 'candidate-link-root'),
        link = join(work, 'linked-candidate');
      await mkdir(root);
      await symlink(candidate, link, 'junction');
      try {
        await invoke(
          'commit',
          root,
          [
            `--candidate=${link}`,
            `--manifest=${join(link, 'installation-manifest.json')}`,
            `--installer-source=${installerSource}`,
          ],
          10,
          'candidate-junction',
        );
        assert.deepEqual(await inventory(root), []);
      } finally {
        assert.ok((await lstat(link)).isSymbolicLink());
        await unlink(link);
      }
      return { root, originalCandidateSha256: manifestRecord.sha256 };
    },
    async 'managed-collision'() {
      const root = join(work, 'collision-root');
      await mkdir(root);
      const file = join(root, 'TableMax.exe');
      await writeFile(file, 'Unknown original executable bytes\n');
      const before = await fileRecord(file);
      await commit(root, [], 10, 'managed-collision');
      assert.deepEqual(await fileRecord(file), before);
      assert.ok(!(await exists(join(root, 'TableMax', '.install.json'))));
      return { root, preserved: before };
    },
    async 'manifest-path-escape'() {
      const altered = join(work, 'unsafe-manifest-candidate');
      await mkdir(altered);
      const root = join(work, 'unsafe-manifest-root');
      await mkdir(root);
      const protectedPath = join(root, 'TableMax', '用户资料.txt');
      await mkdir(dirname(protectedPath));
      await writeFile(protectedPath, 'Never a managed program member\n');
      const before = await fileRecord(protectedPath),
        testManifest = structuredClone(manifest);
      testManifest.files.push({ path: 'TableMax/用户资料.txt', ...before });
      const path = join(altered, 'installation-manifest.json');
      await writeJson(path, testManifest);
      await invoke(
        'commit',
        root,
        [
          `--candidate=${altered}`,
          `--manifest=${path}`,
          `--installer-source=${installerSource}`,
        ],
        10,
        'manifest-path-escape',
      );
      assert.deepEqual(await fileRecord(protectedPath), before);
      return {
        root,
        protectedPath,
        preserved: before,
        boundary:
          'Allowed managed-program subtree guard; does not treat caller JSON as arbitrary B/D deletion authority.',
      };
    },
    async 'journal-partial-preparation'() {
      const root = join(work, 'pp');
      await mkdir(root);
      const directory = await makeJournal(root, 'preparing');
      const path = member(join(directory, 'next-files'), small.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, 'Partial or changed copy must be retained\n');
      const before = await fileRecord(path),
        state = await fileRecord(join(directory, 'state.json'));
      await invoke('recover', root, [], 30, 'partial-preparation');
      assert.deepEqual(await fileRecord(path), before);
      assert.deepEqual(await fileRecord(join(directory, 'state.json')), state);
      return {
        retainedJournal: await retainJournal(directory),
        preserved: before,
        syntheticJournal: true,
      };
    },
    async 'journal-unknown-phase'() {
      const root = join(work, 'unknown-phase-root');
      await mkdir(root);
      const directory = await makeJournal(root, 'unknown-future-stage'),
        before = await inventory(directory);
      await invoke('recover', root, [], 10, 'unknown-phase');
      assert.deepEqual(await inventory(directory), before);
      return {
        retainedJournal: await retainJournal(directory),
        preserved: before,
        syntheticJournal: true,
      };
    },
    async baseline() {
      await commit();
      await programUnchanged();
      await protectedUnchanged();
      const installed = await identity();
      assert.equal(installed.ownerSid, sid);
      protectedFiles.push(join(box, 'TableMax.config.json'));
      protectedRecords = await Promise.all(
        protectedFiles.map(async (path) => ({
          path,
          ...(await fileRecord(path)),
        })),
      );
      await stat(join(box, 'room.sqlite'));
      baselineReady = true;
      return {
        installRoot,
        installationId: installed.installationId,
        phase: 'completed',
        health: await json(join(box, 'desktop-check.json')),
        protected: protectedRecords,
      };
    },
    async 'unknown-app'() {
      const path = join(box, 'app', '朋友未知文件.txt');
      await writeFile(path, 'Unknown app bytes must remain\n');
      const before = await fileRecord(path);
      try {
        await commit(installRoot, [], 10, 'unknown-app-commit');
        await invoke('uninstall', installRoot, [], 10, 'unknown-app-uninstall');
        await programUnchanged();
        assert.deepEqual(await fileRecord(path), before);
        await protectedUnchanged();
      } finally {
        if (await exists(path)) {
          assert.deepEqual(await fileRecord(path), before);
          await unlink(path);
        }
      }
      return { preserved: before, bothCommitAndUninstallRejected: true };
    },
    async 'unknown-app-junction'() {
      const target = join(work, 'app-link-victim');
      await mkdir(target);
      await writeFile(
        join(target, 'original.txt'),
        'Original linked directory bytes\n',
      );
      const before = await inventory(target),
        link = join(box, 'app', 'foreign-link');
      await symlink(target, link, 'junction');
      try {
        await commit(installRoot, [], 10, 'app-junction-commit');
        await invoke(
          'uninstall',
          installRoot,
          [],
          10,
          'app-junction-uninstall',
        );
        assert.deepEqual(await inventory(target), before);
        await programUnchanged();
        await protectedUnchanged();
      } finally {
        assert.ok((await lstat(link)).isSymbolicLink());
        await unlink(link);
      }
      return {
        target,
        preserved: before,
        bothCommitAndUninstallRejected: true,
      };
    },
    async 'damaged-repair'() {
      const installed = await identity(),
        before = await transactions();
      const path = member(installRoot, small.path);
      await writeFile(path, 'Damaged but owned original bytes\n');
      const damaged = await fileRecord(path);
      await unlink(member(installRoot, missing.path));
      await commit(installRoot, [], 0, 'damaged-repair');
      await programUnchanged();
      await protectedUnchanged();
      assert.equal((await identity()).installationId, installed.installationId);
      const directory = await latestTransaction(before);
      assert.deepEqual(
        await fileRecord(member(join(directory, 'previous-files'), small.path)),
        damaged,
      );
      assert.equal(
        (await json(join(directory, 'previous-snapshot.json'))).files.find(
          (file) => file.path === missing.path,
        ).missing,
        true,
      );
      return {
        directory,
        repaired: [small.path, missing.path],
        retainedDamaged: damaged,
      };
    },
    async 'bad-candidate'() {
      const altered = join(work, 'changed-candidate');
      await mkdir(altered);
      await copyTree(candidate, altered);
      await writeFile(
        member(altered, small.path),
        'Changed candidate member\n',
      );
      await invoke(
        'commit',
        installRoot,
        [
          `--candidate=${altered}`,
          `--manifest=${member(altered, relative(candidate, manifestPath).split(sep).join('/'))}`,
          `--installer-source=${installerSource}`,
        ],
        10,
        'bad-candidate',
      );
      await programUnchanged();
      await protectedUnchanged();
      return { altered, changedMember: small.path };
    },
    async 'operation-lock'() {
      const name = globalMutex('Operation', installRoot);
      const result = await withHeldResource('mutex', name, () =>
        invoke('recover', installRoot, [], 20, 'operation-lock'),
      );
      await programUnchanged();
      await protectedUnchanged();
      return { mutex: name, durationMs: result.durationMs };
    },
    async 'run-lock'() {
      const name = globalMutex('Run', installRoot);
      await withHeldResource('mutex', name, () =>
        commit(installRoot, [], 20, 'run-lock'),
      );
      await programUnchanged();
      await protectedUnchanged();
      return { mutex: name, controlPipeAbsent: true };
    },
    async 'database-lock'() {
      const path = join(box, 'room.sqlite'),
        before = await fileRecord(path);
      await withHeldResource('file', path, () =>
        commit(installRoot, [], 20, 'database-lock'),
      );
      assert.deepEqual(await fileRecord(path), before);
      await programUnchanged();
      await protectedUnchanged();
      return { path, preserved: before };
    },
    async 'journal-preparing'() {
      const directory = await makeJournal(installRoot, 'preparing');
      const path = member(join(directory, 'next-files'), small.path);
      await mkdir(dirname(path), { recursive: true });
      await copyFile(member(candidate, small.path), path);
      await invoke('recover', installRoot, [], 0, 'journal-preparing');
      assert.equal(
        (await json(join(directory, 'state.json'))).phase,
        'preparation-aborted',
      );
      assert.ok(!(await exists(path)));
      await programUnchanged();
      await protectedUnchanged();
      return {
        directory,
        syntheticJournal: true,
        phase: 'preparation-aborted',
      };
    },
    async 'health-changed-database'() {
      const desktop = join(box, 'desktop'),
        preservedDesktop = join(work, 'health-desktop-original');
      assert.ok(await exists(desktop));
      await rename(desktop, preservedDesktop);
      await writeFile(
        desktop,
        'Owned fault: a file blocks the actual WebView2 cache directory\n',
      );
      const blocker = await fileRecord(desktop),
        before = await transactions();
      let restored = false;
      try {
        await commit(installRoot, [], 40, 'actual-health-failure');
        const directory = await latestTransaction(before),
          statePath = join(directory, 'state.json');
        const state = await json(statePath);
        assert.equal(state.phase, 'health-failed');
        const firstHealthDatabaseFingerprint = await fingerprint(box);
        await sql(installRoot, true);
        assert.notEqual(await fingerprint(box), state.databaseFingerprint);
        const beforeRetry = await fileRecord(statePath),
          database = await fileRecord(join(box, 'room.sqlite'));
        await invoke(
          'recover',
          installRoot,
          ['--health-timeout=90000'],
          40,
          'changed-database-health-failure',
        );
        assert.deepEqual(await fileRecord(statePath), beforeRetry);
        await programUnchanged();
        await protectedUnchanged();
        await sql(installRoot, false);
        assert.deepEqual(await fileRecord(desktop), blocker);
        await unlink(desktop);
        await rename(preservedDesktop, desktop);
        restored = true;
        await invoke(
          'recover',
          installRoot,
          ['--health-timeout=90000'],
          0,
          'changed-database-reconfirmation',
        );
        assert.equal((await json(statePath)).phase, 'completed');
        await sql(installRoot, false);
        await programUnchanged();
        await protectedUnchanged();
        return {
          directory,
          actualHealthFailure: true,
          firstHealthDatabaseFingerprint,
          fingerprintBeforeHealth: state.databaseFingerprint,
          changedDatabase: database,
          phase: 'completed',
          health: await json(join(box, 'desktop-check.json')),
          boundary:
            'A real native startup fails with blocked WebView2 cache; a valid SQLite fixture table then changes the fingerprint. Same-build target reconfirmation is real; this does not claim an actual application schema migration or different-PE rollback test.',
        };
      } finally {
        if (!restored && (await exists(desktop))) {
          assert.deepEqual(await fileRecord(desktop), blocker);
          await unlink(desktop);
          await rename(preservedDesktop, desktop);
        }
      }
    },
    async 'pending-damaged-uninstall'() {
      const desktop = join(box, 'desktop'),
        preservedDesktop = join(work, 'pending-damage-desktop-original');
      assert.ok(await exists(desktop));
      await rename(desktop, preservedDesktop);
      const blockerText =
        'Owned pending-health fault blocks the actual WebView2 cache\n';
      await writeFile(desktop, blockerText);
      const blocker = await fileRecord(desktop),
        before = await transactions();
      let restored = false;
      try {
        await commit(
          installRoot,
          [],
          40,
          'pending-damage-actual-health-failure',
        );
        const directory = await latestTransaction(before),
          statePath = join(directory, 'state.json');
        const state = await json(statePath);
        assert.equal(state.phase, 'health-failed');
        const changed = await execute(
          member(candidate, 'TableMax/app/node.exe'),
          [
            '-e',
            "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1]); db.exec('CREATE TABLE IF NOT EXISTS pending_damage_fixture (value TEXT NOT NULL)'); db.prepare('INSERT INTO pending_damage_fixture VALUES (?)').run('retained-pending-database'); db.close(); console.log('changed-valid-pending-database');",
            join(box, 'room.sqlite'),
          ],
          'pending-damage-sqlite-change',
        );
        assert.equal(changed.code, 0, changed.log);
        assert.notEqual(await fingerprint(box), state.databaseFingerprint);
        const databaseRecords = [];
        for (const name of databaseNames) {
          const path = join(box, name);
          if (await exists(path))
            databaseRecords.push({ path, ...(await fileRecord(path)) });
        }
        const history = await inventory(join(box, 'games')),
          identityBefore = await fileRecord(join(box, '.install.json')),
          receiptBefore = await fileRecord(
            join(box, '.installer-receipt.json'),
          ),
          stateBefore = await fileRecord(statePath),
          damagedPath = member(installRoot, small.path),
          missingPath = member(installRoot, missing.path),
          damageText =
            'Known owned pending-update damaged bytes must be quarantined\n';
        await writeFile(damagedPath, damageText);
        const damaged = await fileRecord(damagedPath);
        const unchangedData = async () => {
          for (const file of databaseRecords)
            assert.deepEqual(await fileRecord(file.path), {
              bytes: file.bytes,
              sha256: file.sha256,
            });
          assert.deepEqual(await inventory(join(box, 'games')), history);
          await protectedUnchanged();
        };
        const unchangedPending = async () => {
          await unchangedData();
          assert.deepEqual(await fileRecord(statePath), stateBefore);
          assert.deepEqual(
            await fileRecord(join(box, '.install.json')),
            identityBefore,
          );
          assert.deepEqual(
            await fileRecord(join(box, '.installer-receipt.json')),
            receiptBefore,
          );
        };
        const rejected = [];
        for (const fault of ['damaged-only', 'missing-only']) {
          if (fault === 'missing-only') {
            await copyFile(member(candidate, small.path), damagedPath);
            assert.deepEqual(await fileRecord(damagedPath), {
              bytes: small.bytes,
              sha256: small.sha256,
            });
            await unlink(missingPath);
          }
          for (const mode of ['recover', 'commit']) {
            const result =
              mode === 'commit'
                ? await commit(
                    installRoot,
                    [],
                    40,
                    'pending-' + fault + '-commit',
                  )
                : await invoke(
                    'recover',
                    installRoot,
                    [],
                    40,
                    'pending-' + fault + '-recover',
                  );
            assert.match(result.output, /卸载/);
            assert.match(result.output, /保留/);
            await unchangedPending();
            if (fault === 'damaged-only')
              assert.deepEqual(await fileRecord(damagedPath), damaged);
            else assert.ok(!(await exists(missingPath)));
            rejected.push({ fault, mode, exitCode: result.code });
          }
        }
        await writeFile(damagedPath, damageText);
        assert.deepEqual(await fileRecord(damagedPath), damaged);
        const foreign = join(box, 'app', 'pending-user-unknown.txt');
        await writeFile(
          foreign,
          'Owned test fixture representing unknown user app bytes\n',
        );
        const foreignBefore = await fileRecord(foreign);
        try {
          await invoke(
            'uninstall',
            installRoot,
            [],
            10,
            'pending-unknown-uninstall-refused',
          );
          await unchangedPending();
          assert.deepEqual(await fileRecord(foreign), foreignBefore);
          assert.deepEqual(await fileRecord(damagedPath), damaged);
          assert.ok(!(await exists(missingPath)));
        } finally {
          assert.deepEqual(await fileRecord(foreign), foreignBefore);
          await unlink(foreign);
        }
        const oversized = await open(damagedPath, 'r+');
        try {
          await oversized.truncate(120000000);
        } finally {
          await oversized.close();
        }
        await invoke(
          'uninstall',
          installRoot,
          [],
          10,
          'pending-oversized-uninstall-refused',
        );
        assert.equal((await stat(damagedPath)).size, 120000000);
        await unchangedPending();
        await writeFile(damagedPath, damageText);
        assert.deepEqual(await fileRecord(damagedPath), damaged);
        const priorQuarantines = new Set(
          ((await exists(join(box, 'updates')))
            ? await readdir(join(box, 'updates'))
            : []
          ).filter((name) => name.startsWith('uninstall-quarantine-')),
        );
        await invoke(
          'uninstall',
          installRoot,
          [],
          0,
          'pending-damaged-default-uninstall',
        );
        await unchangedData();
        assert.ok(!(await exists(join(box, '.install.json'))));
        for (const file of manifest.files)
          assert.ok(!(await exists(member(installRoot, file.path))), file.path);
        const added = (await readdir(join(box, 'updates'))).filter(
          (name) =>
            name.startsWith('uninstall-quarantine-') &&
            !priorQuarantines.has(name),
        );
        assert.equal(added.length, 1);
        const quarantine = join(box, 'updates', added[0]);
        assert.deepEqual(
          await fileRecord(member(quarantine, small.path)),
          damaged,
        );
        assert.ok(!(await exists(member(quarantine, missing.path))));
        assert.deepEqual(await fileRecord(desktop), blocker);
        await unlink(desktop);
        await rename(preservedDesktop, desktop);
        restored = true;
        await commit(
          installRoot,
          [],
          0,
          'pending-damaged-retained-data-reinstall',
        );
        await programUnchanged();
        await protectedUnchanged();
        const checked = await execute(
          member(candidate, 'TableMax/app/node.exe'),
          [
            '-e',
            "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1],{readOnly:true}); const rows=db.prepare('SELECT value FROM pending_damage_fixture').all(); db.close(); if(!rows.some(row=>row.value==='retained-pending-database'))process.exit(1); console.log('pending-database-content-preserved');",
            join(box, 'room.sqlite'),
          ],
          'pending-damage-reinstalled-sqlite-check',
        );
        assert.equal(checked.code, 0, checked.log);
        for (const file of history)
          assert.deepEqual(
            await fileRecord(member(join(box, 'games'), file.path)),
            { bytes: file.bytes, sha256: file.sha256 },
          );
        return {
          directory,
          actualHealthFailure: true,
          rejected,
          unknownAppRejected: true,
          oversizedOwnedRejected: true,
          quarantine,
          damaged,
          databaseRecords,
          health: await json(join(box, 'desktop-check.json')),
          boundary:
            'Real native health failure plus changed valid SQLite and independently damaged-only/missing-only owned files. Driver restores only its fault bytes between independent branches. Recover/commit preserve diagnostics; default helper uninstall quarantines owned damage and keeps D/G/config before same full fixture reinstall health. No Inno/framework uninstall, different-PE upgrade or actual schema migration claim.',
        };
      } finally {
        if (!restored && (await exists(desktop))) {
          assert.deepEqual(await fileRecord(desktop), blocker);
          await unlink(desktop);
          await rename(preservedDesktop, desktop);
        }
      }
    },
    async 'portable-lock'() {
      const original = await portableSource(false),
        root = join(work, 'portable-locked-install');
      await mkdir(root);
      const name =
        'Local\\TableMax-' +
        digest(Buffer.from(resolve(original.data).toUpperCase()))
          .slice(0, 32)
          .toUpperCase();
      await withHeldResource('mutex', name, () =>
        commit(
          root,
          [`--migration-root=${original.source}`],
          20,
          'portable-lock',
        ),
      );
      assert.deepEqual(await inventory(original.source), original.before);
      assert.ok(!(await exists(join(root, 'TableMax', '.install.json'))));
      return {
        root,
        original: original.source,
        mutex: name,
        preserved: original.before,
      };
    },
    async 'portable-default'() {
      return await migrate(false);
    },
    async 'portable-external'() {
      return await migrate(true);
    },
    async 'uninstall-reinstall'() {
      const before = await identity(),
        history = await inventory(join(box, 'games')),
        database = await fileRecord(join(box, 'room.sqlite'));
      const damagedPath = member(installRoot, small.path);
      await writeFile(
        damagedPath,
        'Owned damaged bytes must be quarantined before uninstall\n',
      );
      const damaged = await fileRecord(damagedPath);
      await invoke('uninstall', installRoot, [], 0, 'default-uninstall');
      for (const file of manifest.files)
        assert.ok(!(await exists(member(installRoot, file.path))), file.path);
      assert.ok(!(await exists(join(box, '.install.json'))));
      assert.equal(
        (await json(join(box, '.uninstalled.json'))).installationId,
        before.installationId,
      );
      await protectedUnchanged();
      assert.deepEqual(await inventory(join(box, 'games')), history);
      assert.deepEqual(await fileRecord(join(box, 'room.sqlite')), database);
      const quarantines = (await readdir(join(box, 'updates'))).filter((name) =>
        name.startsWith('uninstall-quarantine-'),
      );
      assert.equal(quarantines.length, 1);
      assert.deepEqual(
        await fileRecord(
          member(join(box, 'updates', quarantines[0]), small.path),
        ),
        damaged,
      );
      await commit(installRoot, [], 0, 'reinstall-retained-data');
      await programUnchanged();
      await protectedUnchanged();
      if (sqlFixtureCreated) await sql(installRoot, false);
      return {
        retainedDatabase: database,
        history,
        damagedQuarantine: join(box, 'updates', quarantines[0]),
        boundary:
          'Helper-owned program files only; Inno framework uninstaller, shortcut and registration effects are separate.',
      };
    },
  };
  async function migrate(external) {
    const original = await portableSource(external),
      root = join(work, `迁移 安装-${randomUUID()}`);
    await mkdir(root);
    await commit(
      root,
      [`--migration-root=${original.source}`],
      0,
      external ? 'portable-external' : 'portable-default',
    );
    await programUnchanged(root);
    assert.deepEqual(await inventory(original.source), original.before);
    if (external)
      for (const file of original.externalBefore)
        assert.deepEqual(await fileRecord(member(original.data, file.path)), {
          bytes: file.bytes,
          sha256: file.sha256,
        });
    const newBox = join(root, 'TableMax'),
      config = await json(join(newBox, 'TableMax.config.json'));
    assert.equal(config.dataDirectory, external ? original.data : '.');
    for (const file of original.before.filter((file) =>
      file.path.startsWith('games/'),
    ))
      assert.deepEqual(await fileRecord(member(newBox, file.path)), {
        bytes: file.bytes,
        sha256: file.sha256,
      });
    const legacy = await inventory(join(newBox, 'games', '.legacy'));
    assert.ok(
      legacy.some((file) => file.path.endsWith('/games/legacy-fixture.cjs')),
    );
    if (!external)
      assert.deepEqual(
        await fileRecord(join(newBox, '朋友存档.txt')),
        await fileRecord(join(original.source, '朋友存档.txt')),
      );
    else assert.ok(!(await exists(join(newBox, '朋友存档.txt'))));
    return {
      root,
      original: original.source,
      dataDirectory: config.dataDirectory,
      originalFiles: original.before,
      externalFiles: original.externalBefore,
      legacy,
      legacyFixture:
        'Valid empty module list; preservation-only arbitrary legacy bytes',
      boundary:
        'Real helper migration and native startup using current-valid synthetic SQLite/settings/G and a valid empty legacy module list. Legacy bytes are preserved without claiming a playable historical release. No old service is running during these copy cases. Continuous snapshot lease, cross-session exclusion and actual old-version saved-game/credential compatibility remain separate gates.',
    };
  }
  for (const [id, baseline] of cases.filter(
    ([id]) => id.startsWith('journal-') && !implementations[id],
  )) {
    implementations[id] = async () => {
      const phase = {
        'journal-prepared': 'prepared',
        'journal-switching': 'switching',
        'journal-installed': 'installed',
        'journal-health-unchanged': 'health-failed',
      }[id];
      const directory = await makeJournal(installRoot, phase, true);
      if (phase === 'switching') await unlink(member(installRoot, small.path));
      await invoke('recover', installRoot, [], 0, id);
      assert.equal(
        (await json(join(directory, 'state.json'))).phase,
        'rolled-back',
      );
      await programUnchanged();
      await protectedUnchanged();
      await invoke('recover', installRoot, [], 0, id + '-cleanup');
      assert.ok(!(await exists(join(directory, 'previous-files'))));
      return {
        directory,
        phase: 'rolled-back',
        syntheticJournal: true,
        exactSnapshot: true,
        boundary:
          'Constructed persistent interruption boundary with exact same-build previous snapshot; does not claim OS power loss or different-build end-to-end update.',
      };
    };
    assert.equal(baseline, true);
  }
  try {
    for (const [id, needsBaseline, purpose] of cases) {
      if (!selected.has(id)) continue;
      if (report.failures >= 3) {
        report.results.push({
          id,
          status: 'not-run',
          reason: 'Failure limit reached',
        });
        continue;
      }
      if (needsBaseline && !baselineReady) {
        report.results.push({
          id,
          status: 'not-run',
          reason: 'Required actual baseline did not pass',
        });
        continue;
      }
      const started = performance.now();
      try {
        const result = await implementations[id]();
        report.results.push({
          id,
          purpose,
          status: 'passed',
          durationMs: Math.round(performance.now() - started),
          ...result,
        });
      } catch (error) {
        report.failures++;
        if (needsBaseline) baselineReady = false;
        report.results.push({
          id,
          purpose,
          status: 'failed',
          durationMs: Math.round(performance.now() - started),
          error: error.message,
          stack: error.stack,
        });
      }
      await writeJson(join(evidence, 'report.json'), report);
      console.log(
        JSON.stringify({
          id,
          status: report.results.at(-1).status,
          failures: report.failures,
          evidence,
        }),
      );
    }
  } finally {
    for (const child of active) {
      child.stdin?.end();
      child.kill();
    }
    report.finalizationErrors = [];
    try {
      const cleanup = await execute(
        powershell,
        ['-NoProfile', '-NonInteractive', '-Command', processCleanupSource],
        'own-process-cleanup',
        40000,
      );
      assert.equal(
        cleanup.code,
        0,
        'Own process cleanup failed: ' + cleanup.log,
      );
      report.processCleanup = cleanup.output.trim();
    } catch (error) {
      report.finalizationErrors.push(error.message);
    }
    try {
      for (const file of sourceRecords)
        assert.deepEqual(
          await fileRecord(member(candidate, file.path)),
          { bytes: file.bytes, sha256: file.sha256 },
          'Original candidate changed',
        );
      assert.deepEqual(await fileRecord(manifestPath), manifestRecord);
      assert.deepEqual(await fileRecord(helper), helperRecord);
      assert.deepEqual(await fileRecord(installerSource), installerRecord);
      report.sourcesUnchanged = true;
    } catch (error) {
      report.finalizationErrors.push(error.message);
    }
    report.finishedAtUtc = new Date().toISOString();
    report.result =
      report.failures === 0 &&
      !report.finalizationErrors.length &&
      report.results.every((item) => item.status === 'passed')
        ? 'passed'
        : 'failed';
    report.toolSha256 = digest(await readFile(fileURLToPath(import.meta.url)));
    await writeJson(join(evidence, 'report.json'), report);
  }
  return report;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--list'))
    console.log(
      JSON.stringify(
        cases.map(([id, baseline, purpose]) => ({ id, baseline, purpose })),
        null,
        2,
      ),
    );
  else {
    const value = (name) =>
      args
        .find((arg) => arg.startsWith('--' + name + '='))
        ?.slice(name.length + 3);
    const allowed = [
      'candidate',
      'manifest',
      'helper',
      'installer-source',
      'evidence',
      'only',
    ];
    for (const arg of args)
      assert.ok(
        allowed.some((name) => arg.startsWith('--' + name + '=')),
        'Unknown argument',
      );
    for (const name of allowed.slice(0, 5))
      assert.ok(value(name), 'Required --' + name);
    const result = await verifyUpdateTransactions({
      candidate: value('candidate'),
      manifest: value('manifest'),
      helper: value('helper'),
      installerSource: value('installer-source'),
      evidence: value('evidence'),
      only: value('only')?.split(','),
    });
    console.log(
      JSON.stringify({
        result: result.result,
        cases: result.results.length,
        failures: result.failures,
        evidence: value('evidence'),
        work: result.work,
      }),
    );
    if (result.result !== 'passed') process.exitCode = 1;
  }
}
