import { failureLimit } from '../runner/failure-policy.mjs';
import {
  prepareTransactionFixture,
  exists,
  noLinks,
  within,
  member,
  fileRecord,
  json,
  writeJson,
} from './prepare/transaction-fixture.mjs';
import { createUpdateTransactionScenarios } from './scenarios/update-transaction.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  [
    'pending-coordinator-repro',
    true,
    'Expected refusal reproduces missing/damaged coordinator with changed pending database',
  ],
  [
    'pending-coordinator-recovery',
    true,
    'Exact complete candidate restores only pending coordinator before existing recovery/uninstall',
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
  priorFailures = 0,
}) {
  assertWorkspaceRoot();
  assert.equal(process.platform, 'win32');
  const limit = failureLimit();
  assert.ok(
    Number.isInteger(priorFailures) &&
      priorFailures >= 0 &&
      priorFailures < limit,
  );
  const repository = resolve('.');
  const preparedFixture = await prepareTransactionFixture({
    repository,
    candidate,
    manifestPath,
    helper,
    installerSource,
    evidence,
  });
  ({ candidate, manifestPath, helper, installerSource, evidence } =
    preparedFixture);
  const {
    manifest,
    sourceRecords,
    helperRecord,
    manifestRecord,
    installerRecord,
  } = preparedFixture;
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
    sourceHashes: Object.fromEntries(
      await Promise.all(
        [
          'tools/test/installation/prepare/transaction-fixture.mjs',
          'tools/test/runner/failure-policy.mjs',
          'tools/test/installation/scenarios/update-transaction.mjs',
        ].map(async (path) => [path, digest(await readFile(path))]),
      ),
    ),
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
    failureLimit: limit,
    priorFailures,
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
  const box = join(installRoot, 'data');
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
    .filter((file) => file.path.startsWith('data/app/web/') && file.bytes > 0)
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
    join(root, 'data', '.installation-transactions');
  async function transactions(root = installRoot) {
    const directory = transactionRoot(root);
    return (await exists(directory))
      ? (await readdir(directory))
          .filter((name) => /^[a-f0-9-]{36}$/i.test(name))
          .map((name) => join(directory, name))
      : [];
  }
  const identity = (root = installRoot) =>
    json(join(root, 'data', '.install.json'));
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
          boxRoot: join(root, 'data'),
          ownerSid: sid,
        };
    const directory = join(transactionRoot(root), randomUUID());
    await mkdir(directory, { recursive: true });
    await writeJson(join(directory, 'target.json'), target);
    if (previous) {
      await writeJson(join(directory, 'previous.json'), target);
      await copyFile(
        join(root, 'data', '.installer-receipt.json'),
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
      dataDirectory: previous ? join(root, 'data') : null,
      databaseFingerprint: previous
        ? await fingerprint(join(root, 'data'))
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
    const path = join(root, 'data', 'room.sqlite');
    const code = update
      ? "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1]); db.exec('CREATE TABLE installation_transaction_fixture (value TEXT NOT NULL)'); db.prepare('INSERT INTO installation_transaction_fixture VALUES (?)').run('preserved-after-health-failure'); db.close(); console.log('changed-valid-database');"
      : "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1],{readOnly:true}); console.log(JSON.stringify(db.prepare('SELECT value FROM installation_transaction_fixture').all())); db.close();";
    const result = await execute(
      member(candidate, 'data/app/node.exe'),
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
  const scenarioState = {
    get baselineReady() {
      return baselineReady;
    },
    set baselineReady(value) {
      baselineReady = value;
    },
    get protectedRecords() {
      return protectedRecords;
    },
    set protectedRecords(value) {
      protectedRecords = value;
    },
    get sqlFixtureCreated() {
      return sqlFixtureCreated;
    },
  };
  const implementations = createUpdateTransactionScenarios({
    work,
    evidence,
    box,
    copyTree,
    inventory,
    candidate,
    manifest,
    small,
    invoke,
    installRoot,
    commitArguments,
    helperRecord,
    transactions,
    commit,
    latestTransaction,
    execute,
    fingerprint,
    databaseNames,
    protectedUnchanged,
    programUnchanged,
    installerSource,
    manifestRecord,
    makeJournal,
    retainJournal,
    identity,
    sid,
    protectedFiles,
    scenarioState,
    missing,
    manifestPath,
    globalMutex,
    withHeldResource,
    sql,
    digest,
    cases,
  });
  try {
    for (const [id, needsBaseline, purpose] of cases) {
      if (!selected.has(id)) continue;
      if (report.priorFailures + report.failures >= limit) {
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
      for (const [path, sha256] of Object.entries(report.sourceHashes))
        assert.equal(
          digest(await readFile(path)),
          sha256,
          'Transaction method changed: ' + path,
        );
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
      'prior-failures',
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
      priorFailures: Number(value('prior-failures') ?? 0),
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
