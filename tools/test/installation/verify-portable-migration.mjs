import { failureLimit } from '../runner/failure-policy.mjs';
import assert from 'node:assert/strict';
import { verifyResourceCleanup } from '../../release/installation-evidence.mjs';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import {
  materializeAcceptanceExecutable,
  resolveWindowsAcceptanceProfile,
} from '../../shared/windows-acceptance-profile.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
import { launchDesktop } from '../support/desktop-test.mjs';

const run = promisify(execFile);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const productId = '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}';
const portablePointerSha256 =
  'f9fe7e68f267067856b84cb01680ec0658ff4b5a8e398fb997f4879dacb17bba';
const portableExecutableSha256 =
  '93207df18d568e808ea903ce5d538fe1835323f80a523af95a09241eeb6364bc';
const installerSha256 =
  '1eabdd13bdbea2712c731d6a77b00e1bdd2756331318194e685fc71a6cf3aa83';
const caseIds = ['defaultD', 'externalD'];
const databaseMembers = [
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
const sourcePaths = [
  'tools/test/installation/verify-portable-migration.mjs',
  'tools/shared/windows-acceptance-profile.mjs',
  'tools/test/support/desktop-test.mjs',
];
const samePath = (left, right) =>
  resolve(left).toLowerCase() === resolve(right).toLowerCase();

function inside(root, path, allowRoot = false) {
  const child = relative(root, path);
  return (
    (allowRoot && child === '') ||
    (child &&
      !isAbsolute(child) &&
      child !== '..' &&
      !child.startsWith('..' + sep))
  );
}

async function noLinks(path, allowMissing = false) {
  for (let cursor = resolve(path); ; cursor = dirname(cursor)) {
    const entry = await lstat(cursor).catch((error) => {
      if (allowMissing && error.code === 'ENOENT') return null;
      throw error;
    });
    if (entry) {
      assert.ok(!entry.isSymbolicLink(), 'Linked migration path rejected');
      assert.ok(
        samePath(await realpath(cursor), cursor),
        'Aliased migration path',
      );
    }
    if (dirname(cursor) === cursor) break;
  }
}

function member(root, path) {
  assert.equal(typeof path, 'string');
  assert.ok(
    path &&
      !path.includes('\\') &&
      !path.includes(':') &&
      path.split('/').every((part) => part && part !== '.' && part !== '..'),
    'Unsafe manifest member',
  );
  const result = resolve(root, path);
  assert.ok(inside(root, result), 'Manifest member escapes root');
  return result;
}

async function fileRecord(path) {
  await noLinks(path);
  assert.ok((await lstat(path)).isFile(), 'A regular input file is required');
  const bytes = await readFile(path);
  return { path: resolve(path), bytes: bytes.length, sha256: hash(bytes) };
}

async function inventory(root) {
  await noLinks(root);
  const files = [];
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name),
        name = prefix + entry.name;
      assert.ok(!entry.isSymbolicLink(), 'Linked migration inventory member');
      if (entry.isDirectory()) await walk(path, name + '/');
      else {
        assert.ok(entry.isFile(), 'Unexpected migration inventory member');
        const record = await fileRecord(path);
        files.push({ path: name, bytes: record.bytes, sha256: record.sha256 });
      }
    }
  }
  await walk(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function verifyMembers(root, files, exact = false) {
  for (const file of files) {
    const actual = await fileRecord(member(root, file.path));
    assert.equal(actual.bytes, file.bytes, file.path + ' bytes');
    assert.equal(actual.sha256, file.sha256, file.path + ' SHA');
  }
  if (exact) assert.deepEqual(await inventory(root), files);
}

async function workspaceInput(path) {
  const resolved = resolve(path);
  assert.ok(
    inside(resolve('artifacts'), resolved),
    'Input must be a workspace artifact',
  );
  return fileRecord(resolved);
}

function childEnvironment(temporary, box) {
  const environment = { ...process.env };
  for (const key of Object.keys(environment))
    if (
      key.startsWith('TABLEMAX_') ||
      key.startsWith('WEBVIEW2_') ||
      ['NODE_OPTIONS', 'NODE_PATH'].includes(key)
    )
      delete environment[key];
  return {
    ...environment,
    TEMP: temporary,
    TMP: temporary,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
    TABLEMAX_TEST_AUDIO: '0',
    TABLEMAX_AUTO_MAINTENANCE: '0',
    TABLEMAX_TEST_MAINTENANCE: '0',
    TABLEMAX_INSTALLATION_HEALTH_CHECK: '1',
    ...(box ? { TABLEMAX_BOX_DIRECTORY: box } : {}),
  };
}

async function inspectWindows(
  script,
  environment,
  values = {},
  timeout = 15000,
) {
  const windows = process.env.SystemRoot ?? process.env.WINDIR;
  assert.match(windows ?? '', /^[a-z]:[\\/]/i);
  const result = await run(
    join(windows, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);\n" +
        script,
    ],
    {
      windowsHide: true,
      encoding: 'utf8',
      timeout,
      maxBuffer: 256 * 1024,
      env: {
        ...environment,
        ...values,
        PSModulePath: join(windows, 'System32/WindowsPowerShell/v1.0/Modules'),
      },
    },
  );
  return JSON.parse(result.stdout.trim());
}

async function registrations(environment) {
  return inspectWindows(
    `$records=@(); foreach($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryHive]::LocalMachine)){foreach($view in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)){$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view);try{$key=$base.OpenSubKey('Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\'+$env:TABLEMAX_MIGRATION_PRODUCT+'_is1');if($key){try{$records+=@{hive=$hive.ToString();view=$view.ToString();root=$key.GetValue('InstallLocation');version=$key.GetValue('DisplayVersion');uninstall=$key.GetValue('UninstallString')}}finally{$key.Dispose()}}}finally{$base.Dispose()}}}; ConvertTo-Json -InputObject @($records) -Compress`,
    environment,
    { TABLEMAX_MIGRATION_PRODUCT: productId },
  );
}

async function registrationAt(root, environment) {
  const records = await registrations(environment);
  assert.ok(
    records.some(
      (record) => record.hive === 'CurrentUser' && record.view === 'Registry64',
    ),
  );
  // Some Windows versions expose the same HKCU key through both WOW64 views.
  // Both observations must still identify the one exact current-user root.
  for (const record of records) {
    assert.equal(record.hive, 'CurrentUser');
    assert.ok(
      samePath(record.root, root),
      'Registered installation root differs',
    );
    assert.equal(record.version, '1.0.7.2');
    assert.equal(record.uninstall, '"' + join(root, 'unins000.exe') + '"');
  }
  return records;
}

async function waitForHealthExit(root, started, environment) {
  return inspectWindows(
    `$expected=@((Join-Path $env:TABLEMAX_MIGRATION_ROOT 'TableMax.exe'),(Join-Path $env:TABLEMAX_MIGRATION_ROOT 'data\\app\\TableMax.exe'),(Join-Path $env:TABLEMAX_MIGRATION_ROOT 'data\\app\\node.exe')); $start=[DateTime]::Parse($env:TABLEMAX_MIGRATION_STARTED).ToUniversalTime().AddSeconds(-2); $seen=@(); foreach($process in [Diagnostics.Process]::GetProcesses()){try{$path=$process.MainModule.FileName;if($expected -contains $path){$handle=$process.Handle;$created=$process.StartTime.ToUniversalTime();if($created -lt $start){throw 'Unexpected pre-existing process in the private installation root'};if(-not $process.WaitForExit(15000)){throw 'Exact checking process did not exit within the bounded budget'};if($process.ExitCode -ne 0){throw 'Exact checking process returned a nonzero exit code'};$seen+=@{pid=$process.Id;path=$path;createdAtUtc=$created.ToString('o');exitCode=$process.ExitCode}}}catch [ComponentModel.Win32Exception]{}catch [InvalidOperationException]{}finally{$process.Dispose()}}; ConvertTo-Json -InputObject @($seen) -Compress`,
    environment,
    { TABLEMAX_MIGRATION_ROOT: root, TABLEMAX_MIGRATION_STARTED: started },
    60000,
  );
}

async function protectedData(root) {
  const files = [];
  for (const path of databaseMembers) {
    const full = join(root, path);
    const entry = await lstat(full).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (entry) {
      const record = await fileRecord(full);
      files.push({ path, bytes: record.bytes, sha256: record.sha256 });
    }
  }
  assert.ok(files.some((file) => file.path === 'room.sqlite'));
  assert.ok(files.some((file) => file.path === 'foundation.sqlite'));
  return files;
}

async function frameworkFiles(root) {
  const records = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!/^unins\d+\.(exe|dat|msg)$/i.test(entry.name)) continue;
    assert.ok(entry.isFile() && !entry.isSymbolicLink());
    const record = await fileRecord(join(root, entry.name));
    records.push({
      path: entry.name,
      bytes: record.bytes,
      sha256: record.sha256,
    });
  }
  return records.sort((a, b) => a.path.localeCompare(b.path));
}

async function post(origin, route, body) {
  const address = new URL(origin);
  assert.equal(address.protocol, 'http:');
  assert.equal(
    address.hostname,
    '127.0.0.1',
    'Only the actual private loopback service is allowed',
  );
  const response = await fetch(origin + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  assert.equal(response.ok, true, 'Actual service API returned an HTTP error');
  assert.equal(value.ok, true, 'Actual service API rejected the operation');
  return value;
}

async function createSavedPlayer(desktop, caseId) {
  const runtime = await desktop.request('runtime');
  const page = await desktop.firstWindow();
  const hostToken = await page.evaluate(() =>
    sessionStorage.getItem('tablemax-host'),
  );
  assert.ok(hostToken, 'The actual local host must be authenticated');
  let view = (
    await post(runtime.origin, '/api/session/view', { token: hostToken })
  ).view;
  if (!view.game) {
    const { io } = createRequire(resolve('apps/web/package.json'))(
      'socket.io-client',
    );
    const socket = io(runtime.origin, {
      auth: { token: hostToken },
      transports: ['websocket'],
      forceNew: true,
    });
    try {
      await new Promise((done, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Host socket readiness timed out')),
          15000,
        );
        socket.once('room:view', () => {
          clearTimeout(timer);
          done();
        });
        socket.once('connect_error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
      const reply = await new Promise((done, reject) =>
        socket.timeout(15000).emit(
          'room:command',
          {
            actionId: randomUUID(),
            instanceId: view.instanceId,
            revision: view.revision,
            branch: view.branch,
            command: { type: 'select-game', gameId: 'rummikub' },
          },
          (error, value) => (error ? reject(error) : done(value)),
        ),
      );
      assert.equal(
        reply.ok,
        true,
        'Select the bundled real game through its saved API',
      );
    } finally {
      socket.disconnect();
    }
  }
  // Deliberately uses the old portable admission limit: migration must preserve
  // existing saved names even when a new registration would reject their length.
  const name = '便携迁移已保存玩家 ' + caseId;
  const joined = await post(runtime.origin, '/api/session/join', { name });
  assert.equal(typeof joined.token, 'string');
  view = (
    await post(runtime.origin, '/api/session/view', { token: joined.token })
  ).view;
  assert.equal(view.status, 'lobby');
  assert.ok(
    view.game?.releaseRef,
    'A real immutable bundled release is required',
  );
  assert.ok(view.self?.seatId, 'The saved player must have a real seat');
  return {
    token: joined.token,
    public: {
      name,
      instanceId: view.instanceId,
      seatId: view.self.seatId,
      releaseRef: view.game.releaseRef,
    },
    native: {
      desktopPid: runtime.desktopPid,
      servicePid: runtime.servicePid,
      appVersion: runtime.appVersion,
    },
  };
}

async function closeDesktop(desktop) {
  const process = desktop.process();
  await desktop.close();
  assert.equal(
    process.exitCode,
    0,
    'The exact native process must save and exit normally',
  );
}

async function verifyIdentity(root, manifest, delivery, ownerSid) {
  await verifyMembers(root, manifest.files);
  const identity = JSON.parse(
    await readFile(join(root, 'data/.install.json'), 'utf8'),
  );
  assert.equal(identity.productId, productId);
  assert.equal(identity.ownerSid, ownerSid);
  assert.ok(samePath(identity.root, root));
  assert.ok(samePath(identity.boxRoot, join(root, 'data')));
  assert.equal(identity.buildVersion, '1.0.7.2');
  assert.equal(identity.payloadManifestSha256, manifest.payloadManifestSha256);
  assert.equal(identity.currentMappingSha256, manifest.currentMappingSha256);
  assert.deepEqual(identity.files, manifest.files);
  const receipt = JSON.parse(
    await readFile(join(root, 'data/.installer-receipt.json'), 'utf8'),
  );
  assert.equal(receipt.productId, productId);
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.installationId, identity.installationId);
  assert.equal(receipt.buildVersion, manifest.buildVersion);
  assert.equal(receipt.bytes, delivery.executable.bytes);
  assert.equal(receipt.sha256, delivery.executable.sha256);
  return {
    productId: identity.productId,
    installationId: identity.installationId,
    ownerSid: identity.ownerSid,
    buildVersion: identity.buildVersion,
  };
}

export async function verifyPortableMigration({
  deliveryPath,
  portablePointerPath,
  evidenceDirectory,
  priorFailures = 0,
}) {
  assertWorkspaceRoot();
  assert.equal(process.platform, 'win32');
  const limit = failureLimit();
  assert.equal(process.env.TABLEMAX_AUTO_MAINTENANCE, '0');
  assert.equal(process.env.TABLEMAX_TEST_MAINTENANCE, '0');
  assert.ok(
    Number.isInteger(priorFailures) &&
      priorFailures >= 0 &&
      priorFailures < limit,
  );
  const configuredParent =
    process.env.TABLEMAX_INSTALLATION_MIGRATION_TMP ??
    process.env.TABLEMAX_INSTALLATION_VERIFY_TMP;
  const profile = await resolveWindowsAcceptanceProfile(configuredParent);
  assert.ok(
    profile,
    'Real authorized standard-user Medium profile acceptance is mandatory',
  );
  assert.equal(profile.integritySid, 'S-1-16-8192');
  const output = resolve(evidenceDirectory);
  assert.ok(
    inside(resolve('artifacts/maintenance'), output),
    'Evidence must stay in workspace maintenance',
  );
  await noLinks(output, true);
  await mkdir(output, { recursive: false });
  const work = await mkdtemp(join(profile.workParent, 'portable-migration-'));
  await noLinks(work);
  const report = {
    schemaVersion: 1,
    scenario: 'portable-migration',
    result: 'running',
    startedAtUtc: new Date().toISOString(),
    priorFailures,
    failureLimit: limit,
    failures: 0,
    executionProfile: profile,
    work,
    ownerSid: profile.ownerSid,
    checks: [],
    cases: [],
    executionCopies: [],
    cleanupErrors: [],
    scope:
      'Actual frozen portable 1.0.6.10 generated idle saves and two same-root production 1.0.7.2 Inno migrations/default uninstalls, with I equal to the original portable B and new B at I/data, in one fresh authorized standard profile; no older-format save, public release, SmartScreen or full fresh-install capacity claim.',
  };
  let desktop, active;
  const environment = childEnvironment(work);
  const frozen = [];
  const preserveLog = async (source, name) => {
    const exists = await lstat(source).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!exists) return { sourcePath: source, missing: true };
    const record = await fileRecord(source),
      path = join(output, name);
    await writeFile(path, await readFile(source), { flag: 'wx' });
    assert.equal((await fileRecord(path)).sha256, record.sha256);
    return {
      sourcePath: source,
      path,
      bytes: record.bytes,
      sha256: record.sha256,
    };
  };
  const invoke = async (executable, args, name, temporary) => {
    const started = Date.now();
    let result, failure;
    try {
      result = await run(executable, args, {
        windowsHide: true,
        timeout: 2100000,
        maxBuffer: 512 * 1024,
        env: childEnvironment(temporary),
        encoding: 'utf8',
      });
    } catch (error) {
      failure = error;
      result = error;
    }
    await writeFile(join(output, name + '.stdout.log'), result.stdout ?? '', {
      flag: 'wx',
    });
    await writeFile(join(output, name + '.stderr.log'), result.stderr ?? '', {
      flag: 'wx',
    });
    const execution = {
      executable,
      args,
      exitCode: failure ? failure.code : 0,
      durationMs: Date.now() - started,
    };
    if (active) active.executions.push(execution);
    if (failure)
      throw new Error(name + ' failed; inspect preserved raw logs', {
        cause: failure,
      });
    return execution;
  };
  const uninstall = async (entry, manifest) => {
    assert.equal(
      entry.uninstallAttempted,
      undefined,
      'Do not retry a failed uninstall',
    );
    entry.uninstallAttempted = true;
    await registrationAt(entry.root, environment);
    const uninstaller = join(entry.root, 'unins000.exe');
    assert.deepEqual(await fileRecord(uninstaller), entry.uninstaller);
    const log = join(entry.temporary, 'uninstall.log');
    try {
      await invoke(
        uninstaller,
        ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/LOG=' + log],
        entry.id + '-uninstall',
        entry.temporary,
      );
      // Inno's first process can exit before its final log writer closes.
      // Observe that exact log before archiving; do not retry the uninstall.
      const closure = await inspectWindows(
        `$deadline=[DateTime]::UtcNow.AddSeconds(10);while($true){try{$stream=[IO.File]::Open($env:TABLEMAX_MIGRATION_UNINSTALL_LOG,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None);$stream.Dispose();break}catch [IO.IOException]{$code=$_.Exception.GetBaseException().HResult -band 65535;if(($code -ne 32 -and $code -ne 33) -or [DateTime]::UtcNow -ge $deadline){throw};Start-Sleep -Milliseconds 100}};@{closed=$true}|ConvertTo-Json -Compress;exit 0`,
        childEnvironment(entry.temporary),
        { TABLEMAX_MIGRATION_UNINSTALL_LOG: log },
        15000,
      );
      assert.equal(
        closure.closed,
        true,
        'Actual Inno log writer did not close',
      );
      entry.uninstallLogClosure = closure;
    } finally {
      entry.logs.push(await preserveLog(log, entry.id + '-uninstall.log'));
    }
    assert.deepEqual(await registrations(environment), []);
    const deadline = Date.now() + 15000;
    let remaining;
    do {
      remaining = [];
      for (const file of [...manifest.files, ...entry.framework]) {
        const exists = await lstat(member(entry.root, file.path)).catch(
          (error) => {
            if (error.code === 'ENOENT') return null;
            throw error;
          },
        );
        if (exists) remaining.push(file.path);
      }
      if (remaining.length) await delay(100);
    } while (remaining.length && Date.now() < deadline);
    assert.deepEqual(
      remaining,
      [],
      'Managed program/framework members remained',
    );
    entry.defaultUninstall = true;
    entry.checks.push('actual-default-uninstall');
  };
  try {
    report.sourceHashes = await Promise.all(
      sourcePaths.map((path) => fileRecord(resolve(path))),
    );
    const pointerRecord = await workspaceInput(portablePointerPath);
    assert.equal(
      pointerRecord.sha256,
      portablePointerSha256,
      'Use the exact frozen portable current raw bytes',
    );
    const pointer = JSON.parse(await readFile(pointerRecord.path, 'utf8'));
    assert.equal(pointer.buildVersion, '1.0.6.10');
    assert.equal(pointer.deliveries.length, 1);
    const portable = pointer.deliveries[0];
    assert.equal(portable.edition, 'full');
    assert.notEqual(portable.deliveryType, 'installer');
    assert.equal(portable.executable.sha256, portableExecutableSha256);
    const portableExecutable = await workspaceInput(portable.executable.path);
    assert.equal(portableExecutable.sha256, portable.executable.sha256);
    assert.equal(portableExecutable.bytes, portable.executable.bytes);
    const oldManifestRecord = await workspaceInput(portable.manifestPath);
    const oldManifest = JSON.parse(
      await readFile(oldManifestRecord.path, 'utf8'),
    );
    assert.equal(oldManifest.archive.sha256, portable.executable.payloadSha256);
    const deliveryRecord = await workspaceInput(deliveryPath);
    const delivery = JSON.parse(await readFile(deliveryRecord.path, 'utf8'));
    assert.equal(delivery.deliveryType, 'installer');
    assert.equal(delivery.executable.installation.productId, productId);
    assert.equal(
      delivery.executable.sha256,
      installerSha256,
      'Only the sealed candidate18 is authorized',
    );
    const installer = await workspaceInput(delivery.executable.path);
    assert.equal(installer.sha256, installerSha256);
    assert.equal(installer.bytes, delivery.executable.bytes);
    const manifestRecord = await workspaceInput(
      delivery.executable.installation.manifestPath,
    );
    assert.equal(
      manifestRecord.sha256,
      delivery.executable.installation.manifestSha256,
    );
    const manifest = JSON.parse(await readFile(manifestRecord.path, 'utf8'));
    assert.equal(manifest.productId, productId);
    assert.equal(manifest.buildVersion, '1.0.7.2');
    assert.equal(manifest.installProtocol, 1);
    assert.equal(
      manifest.currentMappingSha256,
      delivery.executable.installation.currentMappingSha256,
    );
    report.portable = {
      pointer: pointerRecord,
      buildVersion: '1.0.6.10',
      executable: {
        ...portableExecutable,
        sourcePath: portableExecutable.path,
      },
    };
    report.currentDelivery = {
      ...deliveryRecord,
      buildVersion: manifest.buildVersion,
      installationManifestSha256: manifestRecord.sha256,
      executable: { ...installer, sourcePath: installer.path },
    };
    frozen.push(
      pointerRecord,
      portableExecutable,
      oldManifestRecord,
      deliveryRecord,
      installer,
      manifestRecord,
      ...report.sourceHashes,
    );
    assert.deepEqual(
      await registrations(environment),
      [],
      'A fresh user must have no existing production registration',
    );
    report.checks.push(
      'frozen-portable10-and-candidate18-inputs',
      'actual-medium-standard-profile-and-empty-registration',
    );
    for (const id of caseIds) {
      active = {
        id,
        result: 'running',
        ownerSid: profile.ownerSid,
        checks: [],
        executions: [],
        logs: [],
        actualInstaller: false,
        defaultUninstall: false,
      };
      report.cases.push(active);
      // The frozen portable launcher stages beside B with a 32-character GUID.
      // Keep its actual source beneath the fresh authorized profile, without
      // spending its legacy MAX_PATH budget on the verifier's report grouping.
      const caseWork = join(
        profile.workParent,
        id === 'defaultD' ? '迁 甲' : '迁 乙',
      );
      await mkdir(caseWork);
      await noLinks(caseWork);
      active.temporary = await mkdtemp(join(profile.workParent, 'mt-'));
      const portableDirectory = caseWork;
      active.oldBox = join(portableDirectory, 'TableMax');
      active.root = active.oldBox;
      active.boxRoot = join(active.root, 'data');
      active.sourceIsInstallRoot = true;
      assert.ok(samePath(active.oldBox, active.root));
      assert.ok(samePath(active.boxRoot, join(active.oldBox, 'data')));
      active.dataDirectory =
        id === 'defaultD' ? active.boxRoot : join(caseWork, '外置 数据');
      const portablePaths = [
        join(active.oldBox, 'app'),
        join(active.oldBox, '.tablemax-stage-' + '0'.repeat(32)),
        join(active.oldBox, '.tablemax-previous-' + '0'.repeat(32)),
      ].flatMap((tree) =>
        [
          ...oldManifest.files.map((file) => file.path),
          '.tablemax-release.json',
        ].map((path) => member(tree, path)),
      );
      active.portablePathBudget = {
        maximumFileChars: Math.max(...portablePaths.map((path) => path.length)),
        maximumDirectoryChars: Math.max(
          ...portablePaths.map((path) => dirname(path).length),
        ),
        boundary:
          'UTF-16 pathname arithmetic from the frozen portable10 manifest, actual B, and Launcher.cs fixed stage/previous prefix plus 32 GUID characters. Synthetic names are not executed or created.',
      };
      assert.ok(
        active.portablePathBudget.maximumFileChars <= 259,
        'The frozen portable10 file paths exceed its legacy Windows budget',
      );
      assert.ok(
        active.portablePathBudget.maximumDirectoryChars <= 247,
        'The frozen portable10 directory paths exceed its legacy Windows budget',
      );
      await mkdir(active.root);
      const unknownPath = join(active.root, '安装目录额外资料.txt');
      await writeFile(unknownPath, '安装和卸载都须保留的未知文件\n', {
        flag: 'wx',
      });
      active.unknownFile = await fileRecord(unknownPath);
      const oldExecution = await materializeAcceptanceExecutable({
        source: portableExecutable.path,
        expected: portableExecutable,
        profile,
        directory: portableDirectory,
        name: 'TableMax-portable-1.0.6.10.exe',
      });
      const newExecution = await materializeAcceptanceExecutable({
        source: installer.path,
        expected: installer,
        profile,
        directory: join(caseWork, 'installer'),
        name: basename(installer.path),
      });
      report.executionCopies.push(
        { caseId: id, role: 'portable', ...oldExecution },
        { caseId: id, role: 'installer', ...newExecution },
      );
      await invoke(
        oldExecution.path,
        ['--foundation-check'],
        id + '-portable-initialize',
        active.temporary,
      );
      const oldAppFiles = [
        ...oldManifest.files,
        {
          path: '.tablemax-release.json',
          bytes: oldManifestRecord.bytes,
          sha256: oldManifestRecord.sha256,
        },
      ].sort((a, b) => a.path.localeCompare(b.path));
      await verifyMembers(join(active.oldBox, 'app'), oldAppFiles, true);
      const oldEnvironment = childEnvironment(active.temporary, active.oldBox);
      const boot = (box) =>
        launchDesktop({
          executablePath: join(box, 'app/TableMax.exe'),
          timeout: 180000,
          env: childEnvironment(active.temporary, box),
        });
      if (id === 'externalD') {
        desktop = await boot(active.oldBox);
        await desktop.request('storage.set', {
          directory: active.dataDirectory,
        });
        await closeDesktop(desktop);
        desktop = null;
      }
      desktop = await launchDesktop({
        executablePath: join(active.oldBox, 'app/TableMax.exe'),
        timeout: 180000,
        env: oldEnvironment,
      });
      const sourceData =
        id === 'defaultD' ? active.oldBox : active.dataDirectory;
      const storage = await desktop.request('storage.info');
      assert.ok(samePath(storage.active, sourceData));
      const saved = await createSavedPlayer(desktop, id);
      active.savedPlayer = saved.public;
      active.oldNative = saved.native;
      assert.equal(active.oldNative.appVersion, '1.0.6.10');
      await closeDesktop(desktop);
      desktop = null;
      active.checks.push('portable10-native-generated-saved-player');
      const friendPath = join(sourceData, '朋友保留资料.txt');
      await writeFile(
        friendPath,
        '迁移和默认卸载必须保留的用户资料 ' + id + '\n',
        { flag: 'wx' },
      );
      const friend = await fileRecord(friendPath);
      await assert.rejects(lstat(active.boxRoot), { code: 'ENOENT' });
      const sourceInventory = await inventory(active.oldBox);
      assert.ok(
        sourceInventory.every(
          (file) => file.path.split('/')[0].toLowerCase() !== 'data',
        ),
        'Freeze only original portable files before the nested new B exists',
      );
      const oldGames = await inventory(join(active.oldBox, 'games'));
      assert.ok(
        oldGames.length > 0,
        'The real portable must have materialized signed games',
      );
      active.sourceSnapshot = {
        root: active.oldBox,
        sourceIsInstallRoot: true,
        newBox: active.boxRoot,
        newBoxAbsentWhenFrozen: true,
        files: sourceInventory,
        currentGames: oldGames,
        dataFile: friend,
      };
      active.checks.push('portable10-source-idle-complete-inventory');
      assert.deepEqual(await registrations(environment), []);
      const installLog = join(active.temporary, 'install.log');
      const installStarted = new Date().toISOString();
      try {
        await invoke(
          newExecution.path,
          [
            '/VERYSILENT',
            '/SUPPRESSMSGBOXES',
            '/NORESTART',
            '/DIR=' + active.root,
            '/TABLEMAXMIGRATION=' + active.oldBox,
            '/LOG=' + installLog,
          ],
          id + '-install',
          active.temporary,
        );
        active.actualInstaller = true;
        active.uninstaller = await fileRecord(
          join(active.root, 'unins000.exe'),
        );
        active.framework = await frameworkFiles(active.root);
      } finally {
        active.logs.push(await preserveLog(installLog, id + '-install.log'));
      }
      active.healthProcessObservations = {
        scope:
          'Only exact live same-root images observed after Inno returned are held and awaited. Already exited processes have no recovered exit code; an empty array does not prove their exit status. Inno/helper health is recorded independently.',
        processes: await waitForHealthExit(
          active.root,
          installStarted,
          childEnvironment(active.temporary),
        ),
      };
      await registrationAt(active.root, environment);
      active.identity = await verifyIdentity(
        active.root,
        manifest,
        delivery,
        profile.ownerSid,
      );
      assert.ok(active.framework.some((file) => file.path.endsWith('.dat')));
      active.checks.push(
        'actual-inno-migration',
        // Stable legacy case ID; the version/SHA assertions bind the current frozen candidate above.
        'installed18-managed-members-and-receipt',
      );
      const config = JSON.parse(
        await readFile(join(active.boxRoot, 'TableMax.config.json'), 'utf8'),
      );
      assert.deepEqual(config, {
        dataDirectory: id === 'defaultD' ? '.' : active.dataDirectory,
      });
      desktop = await boot(active.boxRoot);
      const restoredStorage = await desktop.request('storage.info');
      assert.ok(samePath(restoredStorage.active, active.dataDirectory));
      const runtime = await desktop.request('runtime');
      assert.equal(runtime.appVersion, '1.0.7.2');
      const restored = (
        await post(runtime.origin, '/api/session/view', { token: saved.token })
      ).view;
      assert.equal(restored.instanceId, saved.public.instanceId);
      assert.equal(restored.self?.seatId, saved.public.seatId);
      assert.deepEqual(restored.game?.releaseRef, saved.public.releaseRef);
      assert.equal(restored.status, 'lobby');
      active.newNative = {
        desktopPid: runtime.desktopPid,
        servicePid: runtime.servicePid,
        appVersion: runtime.appVersion,
      };
      await closeDesktop(desktop);
      desktop = null;
      active.checks.push('saved-player-and-storage-restored');
      // The same-root install adds managed files and data/. Every frozen
      // original file must retain its bytes; the original games tree is exact.
      await verifyMembers(active.oldBox, sourceInventory);
      await verifyMembers(join(active.oldBox, 'games'), oldGames, true);
      await verifyMembers(join(active.boxRoot, 'games'), oldGames);
      const targetFriend = join(active.dataDirectory, '朋友保留资料.txt');
      assert.equal((await fileRecord(targetFriend)).sha256, friend.sha256);
      active.checks.push('old-source-and-games-preserved');
      assert.deepEqual(await fileRecord(unknownPath), active.unknownFile);
      const unknownGamePath = join(active.boxRoot, 'games', '朋友保留资料.txt');
      await writeFile(
        unknownGamePath,
        'Unknown migrated game-directory file is user data.\n',
        { flag: 'wx' },
      );
      active.unknownGameFile = await fileRecord(unknownGamePath);
      const retainedGames = await inventory(join(active.boxRoot, 'games'));
      const retainedConfig = await fileRecord(
        join(active.boxRoot, 'TableMax.config.json'),
      );
      active.retainedDatabases = await protectedData(active.dataDirectory);
      await uninstall(active, manifest);
      await verifyMembers(active.oldBox, sourceInventory);
      await verifyMembers(join(active.oldBox, 'games'), oldGames, true);
      active.resourceCleanup = await verifyResourceCleanup({
        root: active.root,
        identity: active.identity,
        before: retainedGames,
        directory: join(output, id + '-resource-cleanup'),
        name: 'final-uninstall-resources.json',
      });
      assert.deepEqual(
        await fileRecord(unknownGamePath),
        active.unknownGameFile,
        'Unknown game-directory file must survive migration uninstall',
      );
      assert.deepEqual(await fileRecord(retainedConfig.path), retainedConfig);
      assert.deepEqual(await fileRecord(unknownPath), active.unknownFile);
      assert.equal((await fileRecord(targetFriend)).sha256, friend.sha256);
      assert.deepEqual(
        await protectedData(active.dataDirectory),
        active.retainedDatabases,
        'Default uninstall must preserve every existing protected database member byte-for-byte',
      );
      active.checks.push(
        'data-games-config-and-source-preserved-after-uninstall',
      );
      active.result = 'passed';
      active = null;
    }
    for (const file of frozen)
      assert.deepEqual(
        await fileRecord(file.path),
        file,
        'Frozen source changed during migration verification',
      );
    for (const file of report.executionCopies) {
      const actual = await fileRecord(file.path);
      assert.equal(actual.bytes, file.bytes);
      assert.equal(actual.sha256, file.sha256);
    }
    report.checks.push('all-frozen-inputs-and-tool-sources-unchanged');
    report.result = 'passed';
  } catch (error) {
    report.failures++;
    report.result = 'failed';
    report.error = error.stack;
    if (active) {
      active.result = 'failed';
      active.error = error.message;
    }
  } finally {
    if (desktop) {
      try {
        await closeDesktop(desktop);
        desktop = null;
      } catch (error) {
        report.cleanupErrors.push('Owned native shutdown: ' + error.message);
        report.failures++;
      }
    }
    if (active?.actualInstaller && !active.uninstallAttempted && !desktop) {
      try {
        const manifest = JSON.parse(
          await readFile(resolve(report.currentDelivery.path), 'utf8'),
        );
        const candidateManifest = JSON.parse(
          await readFile(manifest.executable.installation.manifestPath, 'utf8'),
        );
        await uninstall(active, candidateManifest);
      } catch (error) {
        report.cleanupErrors.push(
          'Exact registered-root default uninstall: ' + error.message,
        );
        report.failures++;
      }
    }
    report.finishedAtUtc = new Date().toISOString();
    report.totalFailures = priorFailures + report.failures;
    if (report.cleanupErrors.length) report.result = 'failed';
    await writeFile(
      join(output, 'report.json'),
      JSON.stringify(report, null, 2) + '\n',
      { flag: 'wx' },
    );
  }
  return report;
}

if (isDirectExecution(import.meta.url)) {
  const arguments_ = process.argv.slice(2);
  const allowed = [
    'delivery',
    'portable-pointer',
    'evidence',
    'prior-failures',
  ];
  for (const argument of arguments_)
    assert.ok(
      allowed.some((name) => argument.startsWith('--' + name + '=')),
      'Unexpected migration verifier option',
    );
  const option = (name) => {
    const values = arguments_.filter((argument) =>
      argument.startsWith('--' + name + '='),
    );
    assert.ok(values.length <= 1, 'Duplicate migration verifier option');
    return values[0]?.slice(name.length + 3);
  };
  assert.ok(
    option('delivery') && option('portable-pointer') && option('evidence'),
    'Provide --delivery, --portable-pointer and --evidence',
  );
  const report = await verifyPortableMigration({
    deliveryPath: option('delivery'),
    portablePointerPath: option('portable-pointer'),
    evidenceDirectory: option('evidence'),
    priorFailures: Number(option('prior-failures') ?? 0),
  });
  console.log(
    JSON.stringify({
      result: report.result,
      failures: report.failures,
      priorFailures: report.priorFailures,
      totalFailures: report.totalFailures,
      evidence: resolve(option('evidence'), 'report.json'),
    }),
  );
  process.exitCode = report.result === 'passed' ? 0 : 1;
}
