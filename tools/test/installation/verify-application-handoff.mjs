import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Transform } from 'node:stream';
import { chromium } from 'playwright';
import { createInstallationFixturePackage } from '../../release/installation-fixture.mjs';
import {
  applicationPublicKeyXml,
  applicationUpdateMachineBlock,
  extractApplicationUpdate,
  parseStrictJson,
} from '../../shared/application-update.mjs';
import {
  signFixtureApplicationUpdate,
  verifyFixtureApplicationUpdate,
} from '../support/fixture-application-update.mjs';
import {
  materializeAcceptanceExecutable,
  resolveWindowsAcceptanceProfile,
} from '../../shared/windows-acceptance-profile.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
import { launchDesktop } from '../support/desktop-test.mjs';

const fixtureId = '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const powershell = join(
  process.env.WINDIR ?? 'C:/Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe',
);
const powershellUtf8 =
  '$ErrorActionPreference="Stop"; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); ';
function inside(root, path) {
  const name = relative(resolve(root), resolve(path));
  assert.ok(
    name && !isAbsolute(name) && name !== '..' && !name.startsWith('..' + sep),
    'Path escapes fixture scope',
  );
  return resolve(path);
}
async function noLinks(path) {
  for (let cursor = resolve(path); ; cursor = dirname(cursor)) {
    try {
      assert.ok(!(await lstat(cursor)).isSymbolicLink(), 'Linked fixture path');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (dirname(cursor) === cursor) break;
  }
}
async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + '\n');
}
async function record(path) {
  const bytes = await readFile(path);
  return { path: resolve(path), bytes: bytes.length, sha256: hash(bytes) };
}
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
async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
async function databaseFingerprint(directory) {
  const lines = [];
  for (const name of databaseNames) {
    const path = join(directory, name);
    lines.push(
      name +
        ':' +
        ((await exists(path)) ? (await record(path)).sha256 : 'missing'),
    );
  }
  return hash(Buffer.from(lines.join('\n'), 'utf8'));
}
async function preservedData(directory) {
  const files = [];
  async function visit(path, prefix = '') {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (
        !prefix &&
        [
          'app',
          'updates',
          '.installation-transactions',
          '.install.json',
          '.installer-receipt.json',
          '.uninstalled.json',
        ].includes(entry.name)
      )
        continue;
      const full = join(path, entry.name);
      await noLinks(full);
      if (entry.isDirectory()) await visit(full, name + '/');
      else {
        assert.ok(entry.isFile(), 'Unexpected preserved-data member');
        const value = await record(full);
        files.push({ name, bytes: value.bytes, sha256: value.sha256 });
      }
    }
  }
  await visit(directory);
  return files.sort((a, b) => a.name.localeCompare(b.name));
}
async function waitUntil(callback, label, timeout = 120000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await callback();
    if (value) return value;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(label + ' timed out');
}
async function maybeJson(path) {
  try {
    return await json(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
const sourcePaths = [
  'apps/desktop/installation-runtime/InstallationCore.cs',
  'apps/desktop/installation-runtime/UpdateProtocol.cs',
  'apps/desktop/installation-runtime/TrustRoots.cs',
  'tools/test/installation/verify-application-handoff.cs',
];

/** Builds and runs only explicitly isolated fixture Native/installer chains. */
export async function verifyApplicationHandoff({
  nativeTemplate,
  serverDirectory,
  webDirectory,
  evidence,
  prepareOnly = false,
  compileOnly = false,
  preparedReport,
  verifyPreparedOnly = false,
  frameworkRecoveryOnly = false,
  activeUninstallOnly = false,
  shortExternalData = false,
  longRootExternalData = false,
}) {
  assertWorkspaceRoot();
  assert.equal(process.platform, 'win32');
  const usesExternalData = shortExternalData || longRootExternalData;
  assert.ok(
    !longRootExternalData ||
      (preparedReport &&
        !activeUninstallOnly &&
        !frameworkRecoveryOnly &&
        !compileOnly &&
        !prepareOnly &&
        !verifyPreparedOnly),
    'Long-root external data requires execution of the complete prepared handoff pair',
  );
  assert.ok(
    !shortExternalData || (activeUninstallOnly && preparedReport),
    'Short external data requires the isolated prepared active-uninstall mode',
  );
  assert.ok(
    !activeUninstallOnly ||
      (preparedReport &&
        !frameworkRecoveryOnly &&
        !compileOnly &&
        !prepareOnly &&
        !verifyPreparedOnly),
    'Active uninstall requires an exact prepared pair and excludes all other modes',
  );
  assert.ok(
    !frameworkRecoveryOnly ||
      (preparedReport && !compileOnly && !prepareOnly && !verifyPreparedOnly),
    'Framework recovery requires execution of an exact prepared pair',
  );
  const repository = resolve('.');
  let prepared;
  if (preparedReport) {
    assert.ok(!compileOnly && !prepareOnly, 'Prepared input is execution only');
    preparedReport = inside(resolve('artifacts/maintenance'), preparedReport);
    await noLinks(preparedReport);
    prepared = await json(preparedReport);
    assert.equal(prepared.result, 'prepared-not-executed');
    assert.equal(prepared.failures, 0);
    assert.equal(prepared.fixtureId, fixtureId);
    const original = await json(
      inside(repository, prepared.old.delivery.manifestPath),
    );
    nativeTemplate = original.fixture.nativeDirectory;
    serverDirectory = original.fixture.serverDirectory;
    webDirectory = original.fixture.webDirectory;
  }
  assert.ok(!verifyPreparedOnly || prepared, 'Prepared report required');
  nativeTemplate = inside(repository, nativeTemplate);
  serverDirectory = inside(repository, serverDirectory);
  webDirectory = inside(repository, webDirectory);
  evidence = inside(resolve('artifacts/maintenance'), evidence);
  for (const path of [
    nativeTemplate,
    serverDirectory,
    webDirectory,
    evidence,
    resolve('tmp'),
  ])
    await noLinks(path);
  assert.ok(
    (await stat(nativeTemplate)).isDirectory(),
    'Native template directory required',
  );
  if (!compileOnly) {
    assert.ok(
      (await stat(serverDirectory)).isDirectory(),
      'Explicit server unit directory required',
    );
    assert.ok(
      (await stat(webDirectory)).isDirectory(),
      'Explicit box unit directory required',
    );
  }
  assert.ok(
    !(await maybeJson(join(evidence, 'report.json'))),
    'Use new evidence',
  );
  await mkdir(dirname(evidence), { recursive: true });
  await mkdir(evidence, { recursive: false });
  const configuredParent = process.env.TABLEMAX_INSTALLATION_HANDOFF_TMP;
  const profile = await resolveWindowsAcceptanceProfile(configuredParent);
  assert.ok(
    !usesExternalData || profile,
    'Short external data requires the verified standard profile',
  );
  assert.ok(
    !profile || prepared,
    'Profile execution requires exact prepared materials',
  );
  if (!profile) await mkdir(resolve('tmp'), { recursive: true });
  const workParent = profile
    ? profile.workParent
    : configuredParent
      ? inside(resolve('tmp'), configuredParent)
      : resolve('tmp');
  const scopeRoot = profile ? profile.root : resolve('tmp');
  if (profile) {
    assert.equal(resolve(configuredParent), resolve(profile.workParent));
    assert.equal(dirname(resolve(profile.workParent)), resolve(profile.root));
    assert.equal(profile.ownerSid.length > 0, true);
  } else if (configuredParent) {
    assert.equal(dirname(workParent), resolve('tmp'));
    await noLinks(workParent);
    assert.ok(
      (await stat(workParent)).isDirectory(),
      'Private handoff parent required',
    );
  }
  const work = await mkdtemp(join(workParent, 'application-handoff-'));
  await noLinks(work);
  const longInstallationRoot = usesExternalData;
  const rootBase = join(work, '安装 根');
  // Keep the redirected fixture uninstall shortcut below MAX_PATH while the
  // canonical update helper and installer sources still exceed it.
  assert.ok(
    !longInstallationRoot || rootBase.length <= 198,
    'The private work parent cannot produce the required 198-character installation root',
  );
  const root = longInstallationRoot
    ? rootBase + '测'.repeat(198 - rootBase.length)
    : rootBase;
  const nativeWorkingDirectory = join(root, 'TableMax/app');
  const configurationPath = join(root, 'TableMax/TableMax.config.json');
  const externalDataDirectory = usesExternalData ? join(work, 'D') : null;
  const dataDirectory = externalDataDirectory ?? join(root, 'TableMax');
  const gamesDirectory = join(root, 'TableMax/games');
  const longestFixtureShortcut = join(
    root,
    'fixture-shortcuts/Start/卸载 TableMax Installation Fixture.lnk',
  );
  assert.ok(
    longestFixtureShortcut.length < 260,
    'The redirected fixture shortcut exceeds the ordinary Shell path limit',
  );
  assert.ok(
    configurationPath.length < 260,
    'The fixture configuration exceeds the production startup path limit',
  );
  const startupPathPlan = {
    boundary:
      'Computed startup-path preflight only; actual launched module paths require their own runtime evidence.',
    rootLength: root.length,
    requiredRootLength: longInstallationRoot ? 198 : null,
    longestFixtureShortcut: {
      path: longestFixtureShortcut,
      length: longestFixtureShortcut.length,
    },
    images: [
      'TableMax.exe',
      'UpdateHelper.exe',
      'TableMax/app/TableMax.exe',
      'TableMax/app/node.exe',
    ].map((name) => {
      const path = join(root, name);
      assert.ok(
        path.length < 260,
        'A fixture startup image exceeds the production path limit',
      );
      return { path, length: path.length };
    }),
    nativeWorkingDirectory: {
      path: nativeWorkingDirectory,
      length: nativeWorkingDirectory.length,
    },
    configuration: {
      path: configurationPath,
      length: configurationPath.length,
    },
    dataPaths: ['desktop/webview2', 'logs'].map((name) => {
      const path = join(dataDirectory, name);
      assert.ok(
        path.length < 248,
        'A fixture data path exceeds the production startup limit',
      );
      return { path, length: path.length };
    }),
  };
  await mkdir(root);
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
    DOTNET_NOLOGO: '1',
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    DOTNET_CLI_HOME: resolve('.cache/dotnet-home'),
  });
  process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
  process.env.TABLEMAX_TEST_MAINTENANCE = '0';
  const report = {
    format: 1,
    result: 'running',
    scenario: shortExternalData
      ? 'startup-external-data'
      : longRootExternalData
        ? 'long-root-external-data'
        : activeUninstallOnly
          ? 'active-uninstall'
          : frameworkRecoveryOnly
            ? 'framework-recovery'
            : 'application-handoff',
    cacheable: false,
    startedAtUtc: new Date().toISOString(),
    work,
    root,
    startupPathPlan,
    scopeRoot,
    executionProfile: profile,
    fixtureId,
    steps: [],
    failures: 0,
    failureLimit: 3,
    nativeDiagnostics: {
      desktopLogs: [],
      errors: [],
      logBoundary:
        'Raw snapshots of the selected private D/logs/desktop.log may include either fixture Native generation. They do not attribute a record to a PID or recover the exit status of the indirectly launched persistent host.',
    },
    ...(usesExternalData
      ? {
          startupExternalData: {
            boundary: shortExternalData
              ? 'Independent startup classification with I198 and a fresh short external D. This is not default-D, update check/download/Apply or production acceptance evidence.'
              : 'Complete actual fixture handoff with I198 and a fresh short external D, independently recorded from the ordinary-root default-D handoff.',
            rootLength: root.length,
            dataDirectory,
            gamesDirectory,
            configurationPath,
          },
        }
      : {}),
    boundary: shortExternalData
      ? 'Independent fixture startup classification only: unchanged I198 and prepared PE bytes with a fresh short external data directory. Four actual install/host/active-uninstall steps; no default-D full chain or Apply claim.'
      : longRootExternalData
        ? 'Complete eight-step fixture handoff with I198 and a fixed private short external D. Real signed download, parent exit0, actual short launch copies, installer, persistent new host and default uninstall; this does not claim arbitrary-depth default-D support or real internet.'
        : activeUninstallOnly
          ? 'Actual old-build fixture Inno installation, ready Native/Node and default framework uninstall while that host is active. No update check, download, Apply, production GUID installation, public version/current pointer or internet request is executed. Both prepared inputs retain their original source/SHA bindings.'
          : 'Actual two-build fixture Inno/Native/Node and real ApplicationUpdate.Apply/prepare/parent handoff. Only GitHub HTTP is a managed signed-fixture transport. No production GUID installation/system mutation, public version/current pointer, actual internet availability or old-version saved-game compatibility claim. Original fixture-GUID payload bytes are authenticated by a test-only RSA wrapper; Windows registration uses that same fixture GUID. The production JS product contract is unchanged.',
    releaseMetadataBoundary:
      'The source ZIP asset is metadata-only (one-byte placeholder), never built, downloaded or published. Installer bytes and their signed identity are real fixture materials.',
  };
  await writeJson(join(evidence, 'report.json'), report);
  let sequence = 0,
    installed = false,
    desktop,
    newBrowser,
    oldNativeCapture,
    restartedDesktop,
    restartNativeCapture,
    oldInstallationIdentity,
    actualExecutionInputs;
  function observeOldNative(child, role = 'old') {
    assert.ok(['old', 'restart'].includes(role));
    const observed = {
      pid: child.pid,
      attachedAtUtc: new Date().toISOString(),
      exitCode: child.exitCode,
      signalCode: child.signalCode,
      boundary:
        'Raw streams begin after launchDesktop returns. Earlier startup bytes cannot be replayed by this caller; launchDesktop errors retain only its existing bounded startup diagnostic. The original persistent new Native is not this directly observed child; its selected D/logs/desktop.log is archived separately.',
    };
    report.nativeDiagnostics[role === 'old' ? 'oldNative' : 'restartNative'] =
      observed;
    const updateExit = (code, signal) => {
      observed.exitCode = code;
      observed.signalCode = signal;
      observed.exitObservedAtUtc = new Date().toISOString();
    };
    child.once('exit', updateExit);
    child.once('close', (code, signal) => {
      updateExit(code, signal);
      observed.closeObservedAtUtc = new Date().toISOString();
    });
    child.once('error', (error) => {
      observed.processError = error.message;
    });
    const streams = ['stdout', 'stderr'].map((name) => {
      const path = join(evidence, role + '-native-' + name + '.bin');
      assert.equal(
        child[name].readableEncoding,
        null,
        'Native raw stream was already decoded',
      );
      const output = createWriteStream(path, { flags: 'wx' });
      const stream = {
        name,
        path,
        source: child[name],
        output,
        maximumBytes: 2 * 1024 * 1024,
        observedBytes: 0,
        archivedBytes: 0,
        truncated: false,
        archiveConnected: false,
        archiveDetachedBeforeEof: false,
        detachObservations: [],
        sourceEofObservedAtUtc: child[name].readableEnded
          ? new Date().toISOString()
          : null,
      };
      stream.count = (chunk) => {
        stream.observedBytes += chunk.length;
      };
      stream.observeEof = () => {
        stream.sourceEofObservedAtUtc = new Date().toISOString();
      };
      stream.source.once('end', stream.observeEof);
      const archive = new Transform({
        transform(chunk, encoding, done) {
          const bytes = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk, encoding);
          const remaining = stream.maximumBytes - stream.archivedBytes;
          const stored = bytes.subarray(0, remaining);
          stream.archivedBytes += stored.length;
          if (stored.length !== bytes.length) {
            stream.truncated = true;
            stream.detachArchive('stream-budget-exceeded');
          }
          done(null, stored);
          if (stream.truncated) archive.end();
        },
      });
      stream.archive = archive;
      archive.on('pipe', (source) => {
        if (source === stream.source) stream.archiveConnected = true;
      });
      archive.on('unpipe', (source) => {
        if (source !== stream.source) return;
        const sourceReachedEof = source.readableEnded;
        stream.archiveConnected = false;
        stream.archiveDetachedBeforeEof ||= !sourceReachedEof;
        stream.detachObservations.push({
          reason: stream.detachReason ?? 'pipe-lifecycle',
          observedAtUtc: new Date().toISOString(),
          sourceReachedEof,
          observedBytes: stream.observedBytes,
          archivedBytes: stream.archivedBytes,
        });
      });
      stream.detachArchive = (reason) => {
        stream.detachReason = reason;
        stream.source.unpipe(archive);
        stream.detachReason = null;
        stream.source.resume();
      };
      stream.closed = new Promise((done) => output.once('close', done));
      output.once('error', (error) => {
        stream.error = error.message;
        stream.detachArchive('archive-write-error');
        archive.destroy();
      });
      stream.source.on('data', stream.count);
      stream.source.pipe(archive).pipe(output);
      return stream;
    });
    return async () => {
      let timer;
      let complete;
      for (const stream of streams)
        if (stream.archiveConnected) stream.source.resume();
      try {
        complete = await Promise.race([
          Promise.all(streams.map((stream) => stream.closed)).then(() => true),
          new Promise((done) => {
            timer = setTimeout(() => done(false), 5000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      if (!complete) {
        observed.captureStoppedBeforeStreamClose = true;
        for (const stream of streams) {
          stream.detachArchive('archive-close-timeout');
          stream.archive.end();
        }
        try {
          complete = await Promise.race([
            Promise.all(streams.map((stream) => stream.closed)).then(
              () => true,
            ),
            new Promise((done) => {
              timer = setTimeout(() => done(false), 5000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      }
      observed.exitCode = child.exitCode;
      observed.signalCode = child.signalCode;
      observed.processStillRunning =
        child.exitCode === null && child.signalCode === null;
      observed.streams = [];
      for (const stream of streams) {
        stream.source.off('data', stream.count);
        stream.source.off('end', stream.observeEof);
        const lifecycle = {
          sourceEofObservedAtUtc: stream.sourceEofObservedAtUtc,
          archiveDetachedBeforeEof: stream.archiveDetachedBeforeEof,
          detachObservations: stream.detachObservations,
        };
        if (!complete) {
          stream.output.destroy();
          observed.streams.push({
            name: stream.name,
            path: stream.path,
            maximumBytes: stream.maximumBytes,
            observedBytes: stream.observedBytes,
            truncated: stream.truncated,
            ...lifecycle,
            status: 'archive-close-timeout',
          });
          continue;
        }
        observed.streams.push({
          name: stream.name,
          ...(await record(stream.path)),
          maximumBytes: stream.maximumBytes,
          observedBytes: stream.observedBytes,
          truncated: stream.truncated,
          ...lifecycle,
          sourceReachedEof: stream.source.readableEnded,
          ...(stream.error ? { error: stream.error } : {}),
        });
      }
      assert.ok(complete, 'Native raw stream archive did not close');
      assert.ok(
        streams.every((stream) => !stream.error),
        'Native raw stream archive failed',
      );
      assert.ok(
        streams.every((stream) => !stream.truncated),
        'Native raw stream exceeded its per-stream 2 MiB archive budget',
      );
      assert.ok(
        streams.every((stream) => !stream.archiveDetachedBeforeEof),
        'Native raw archive detached before source EOF',
      );
      assert.ok(
        streams.every((stream) => stream.source.readableEnded),
        'Native raw stream archive stopped before source EOF',
      );
    };
  }
  async function archiveDesktopLog(stage) {
    const sourcePath = join(dataDirectory, 'logs/desktop.log');
    await noLinks(sourcePath);
    if (!(await exists(sourcePath))) {
      report.nativeDiagnostics.desktopLogs.push({
        stage,
        sourcePath,
        status: 'absent',
      });
      return;
    }
    const bytes = await readFile(sourcePath);
    const path = join(evidence, 'native-' + stage + '-desktop.log');
    await writeFile(path, bytes, { flag: 'wx' });
    report.nativeDiagnostics.desktopLogs.push({
      stage,
      sourcePath,
      capturedAtUtc: new Date().toISOString(),
      ...(await record(path)),
    });
  }
  function diagnosticFailure(name, error) {
    report.result = 'failed';
    report.failures++;
    report.nativeDiagnostics.errors.push({ name, error: error.message });
  }
  async function cancelledFixtureShortcuts() {
    const name = 'TableMax Installation Fixture';
    const directory = join(root, 'fixture-shortcuts');
    const desktop = join(directory, 'Desktop', name + '.lnk');
    const launch = join(directory, 'Start', name + '.lnk');
    const uninstall = join(directory, 'Start', '卸载 ' + name + '.lnk');
    for (const path of [desktop, launch, uninstall]) await noLinks(path);
    assert.equal(
      await exists(desktop),
      false,
      'The cancelled fixture desktop shortcut was recreated',
    );
    for (const path of [launch, uninstall])
      assert.ok(
        (await lstat(path)).isFile(),
        'Expected redirected fixture Start-menu shortcut is missing',
      );
    return {
      task: 'desktopicon',
      selected: false,
      desktop: { path: desktop, present: false },
      startMenu: {
        launch: await record(launch),
        uninstall: await record(uninstall),
      },
      scope:
        'Fixture redirected filesystem existence and raw-file identity only; no user-shell shortcut or COM target parsing.',
    };
  }
  async function stopPersistentHost(ready) {
    assert.ok(Number.isSafeInteger(ready.desktopPid) && ready.desktopPid > 0);
    const image = join(root, 'TableMax/app/TableMax.exe');
    const marker = join(evidence, 'persistent-host-handle-held.json');
    const observation = join(evidence, 'persistent-host-exit.json');
    const request = join(evidence, 'quit.request');
    for (const path of [marker, observation, request]) {
      inside(evidence, path);
      await noLinks(path);
      assert.equal(await exists(path), false);
    }
    const script =
      powershellUtf8 +
      `function Write-NewJson([string]$path,$value){$raw=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 8 -Compress));$stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$stream.Write($raw,0,$raw.Length);$stream.Flush($true)}finally{$stream.Dispose()}}; ` +
      `$expectedSid=$env:TABLEMAX_HANDOFF_EXIT_SID;if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ne $expectedSid){throw 'Native exit observer SID differs'}; ` +
      `$p=[Diagnostics.Process]::GetProcessById([int]$env:TABLEMAX_HANDOFF_EXIT_PID);try{$held=$p.Handle;$actual=[IO.Path]::GetFullPath($p.MainModule.FileName);$created=$p.StartTime.ToUniversalTime();if($actual -ne [IO.Path]::GetFullPath($env:TABLEMAX_HANDOFF_EXIT_IMAGE) -or $created -lt [DateTime]::Parse($env:TABLEMAX_HANDOFF_EXIT_NOT_BEFORE).ToUniversalTime().AddSeconds(-2)){throw 'Native exit observer image or start time differs'}; ` +
      `$peer=Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = '+$p.Id);if($null -eq $peer){throw 'Native exit observer process is unavailable'};$owner=Invoke-CimMethod -InputObject $peer -MethodName GetOwnerSid;$cimCreated=([DateTime]$peer.CreationDate).ToUniversalTime();if($owner.ReturnValue -ne 0 -or $owner.Sid -ne $expectedSid -or [Math]::Abs([long]$created.Ticks-[long]$cimCreated.Ticks) -gt 9){throw 'Native exit observer owner or creation time differs'}; ` +
      `$before=@{schemaVersion=1;kind='fixture-native-exit-observation';stage='handle-held';pid=$p.Id;image=$actual;ownerSid=$owner.Sid;startedAtUtc=$created.ToString('o');observedAtUtc=[DateTime]::UtcNow.ToString('o');handleHeld=$true};Write-NewJson $env:TABLEMAX_HANDOFF_EXIT_MARKER $before; ` +
      `if(-not $p.WaitForExit(90000)){throw 'Pinned actual Native did not exit within its bounded budget'};if($p.ExitCode -ne 0){throw ('Pinned actual Native returned '+$p.ExitCode)};$after=@{};foreach($key in $before.Keys){$after[$key]=$before[$key]};$after.stage='exited';$after.exitCode=$p.ExitCode;$after.processHasExited=$p.HasExited;$after.exitedAtUtc=[DateTime]::UtcNow.ToString('o');$after.quitRequestPath=$env:TABLEMAX_HANDOFF_EXIT_REQUEST;Write-NewJson $env:TABLEMAX_HANDOFF_EXIT_OBSERVATION $after;$after|ConvertTo-Json -Depth 8 -Compress}finally{$p.Dispose()}`;
    let settled, observerError;
    const pending = execute(
      powershell,
      ['-NoProfile', '-NonInteractive', '-Command', script],
      'persistent-host-exit-observer',
      120000,
      {
        TABLEMAX_HANDOFF_EXIT_PID: String(ready.desktopPid),
        TABLEMAX_HANDOFF_EXIT_IMAGE: image,
        TABLEMAX_HANDOFF_EXIT_SID: oldInstallationIdentity.ownerSid,
        TABLEMAX_HANDOFF_EXIT_NOT_BEFORE: report.startedAtUtc,
        TABLEMAX_HANDOFF_EXIT_MARKER: marker,
        TABLEMAX_HANDOFF_EXIT_OBSERVATION: observation,
        TABLEMAX_HANDOFF_EXIT_REQUEST: request,
      },
    );
    pending.then(
      (value) => {
        settled = value;
      },
      (error) => {
        observerError = error;
      },
    );
    try {
      const held = await waitUntil(
        async () => {
          if (observerError) throw observerError;
          const value = await maybeJson(marker);
          if (value) return value;
          if (settled)
            throw new Error(
              'Native handle observer exited before pinning: ' + settled.log,
            );
          return null;
        },
        'Actual persistent Native process handle',
        15000,
      );
      assert.equal(held.schemaVersion, 1);
      assert.equal(held.kind, 'fixture-native-exit-observation');
      assert.equal(held.stage, 'handle-held');
      assert.equal(held.pid, ready.desktopPid);
      assert.equal(resolve(held.image), image);
      assert.equal(held.ownerSid, oldInstallationIdentity.ownerSid);
      assert.equal(held.handleHeld, true);
      assert.ok(Number.isFinite(Date.parse(held.startedAtUtc)));
      await writeFile(request, 'Actual fixture context.Quit request\n', {
        flag: 'wx',
      });
      const result = await pending;
      assert.equal(result.code, 0, result.log);
      const exited = await json(observation);
      for (const name of [
        'schemaVersion',
        'kind',
        'pid',
        'image',
        'ownerSid',
        'startedAtUtc',
        'observedAtUtc',
        'handleHeld',
      ])
        assert.equal(exited[name], held[name]);
      assert.equal(exited.stage, 'exited');
      assert.equal(exited.exitCode, 0);
      assert.equal(exited.processHasExited, true);
      assert.equal(resolve(exited.quitRequestPath), request);
      return {
        held,
        heldFile: await record(marker),
        exited,
        exitedFile: await record(observation),
        request: await record(request),
        checker: { code: result.code, log: result.log },
      };
    } finally {
      await pending.catch(() => {});
    }
  }
  async function verifyNextStartupCleanup({
    directory,
    shortLaunch,
    target,
    plan,
    outside,
    outsideBefore,
  }) {
    const persistent = report.steps.find(
      (entry) => entry.id === 'actual-new-persistent-host',
    );
    assert.equal(persistent?.result, 'passed');
    const persistentHostExit = await stopPersistentHost(persistent);
    await newBrowser?.close().catch(() => {});
    newBrowser = undefined;
    await archiveDesktopLog('before-next-startup');
    const box = join(root, 'TableMax');
    const before = {
      configuration: await record(configurationPath),
      identity: await record(join(box, '.install.json')),
      receipt: await record(join(box, '.installer-receipt.json')),
      unknown: await record(outside),
    };
    assert.deepEqual(before.unknown, outsideBefore);
    const sentinel = join(dataDirectory, 'next-startup-preserved.txt');
    await noLinks(sentinel);
    await writeFile(
      sentinel,
      'Preserve this private D file across actual startup cleanup.\n',
      {
        flag: 'wx',
      },
    );
    before.dataSentinel = await record(sentinel);
    const gamesBefore = await preservedData(gamesDirectory);
    assert.ok(gamesBefore.length > 0);
    const gamesSnapshot = join(evidence, 'next-startup-games-before.json');
    await writeFile(
      gamesSnapshot,
      JSON.stringify(gamesBefore, null, 2) + '\n',
      {
        flag: 'wx',
      },
    );
    const restartEvidence = join(evidence, 'next-startup');
    await mkdir(restartEvidence);
    const restartPlan = join(work, 'next-startup-plan.json');
    await writeJson(restartPlan, {
      ...(await json(plan)),
      evidence: restartEvidence,
    });
    try {
      restartedDesktop = await launchDesktop({
        executablePath: join(box, 'app/TableMax.exe'),
        timeout: 90000,
        env: {
          ...environment,
          TABLEMAX_BOX_DIRECTORY: box,
          TABLEMAX_HANDOFF_TEST_PLAN: restartPlan,
        },
      });
    } catch (error) {
      report.nativeDiagnostics.restartLaunchError = {
        error: error.message,
        boundary:
          'launchDesktop did not return the independent child handle; only its existing bounded startup diagnostic is available.',
      };
      throw error;
    }
    restartNativeCapture = observeOldNative(
      restartedDesktop.process(),
      'restart',
    );
    const ready = await waitUntil(async () => {
      const error = await maybeJson(
        join(restartEvidence, 'old-fixture-error.json'),
      );
      if (error) throw new Error(error.error);
      return await maybeJson(join(restartEvidence, 'old-native-ready.json'));
    }, 'Independent same-version Native readiness');
    assert.equal(ready.buildVersion, newBuild);
    assert.equal(ready.desktopPid, restartedDesktop.process().pid);
    assert.notEqual(ready.desktopPid, persistent.desktopPid);
    assert.equal(ready.currentMappingSha256, target.currentMappingSha256);
    assert.equal(resolve(ready.root), root);
    assert.equal(resolve(ready.boxRoot), box);
    assert.equal(resolve(ready.dataDirectory), dataDirectory);
    assert.equal(ready.realShutdownDelegates, true);
    const runtime = await restartedDesktop.request('runtime');
    assert.equal(runtime.appVersion, newBuild);
    assert.equal(runtime.desktopPid, ready.desktopPid);
    assert.equal(runtime.servicePid, ready.servicePid);
    const restartHost = await restartedDesktop.firstWindow();
    const state = await restartHost.evaluate(() =>
      window.tablemaxUpdate.read(),
    );
    assert.equal(state.currentVersion, newBuild);
    const cleanupSource = join(directory, 'cleanup.json');
    await noLinks(cleanupSource);
    const raw = await readFile(cleanupSource);
    const cleanup = parseStrictJson(raw, 32768, { canonicalIntegers: true });
    const cleanupPath = join(evidence, 'next-startup-cleanup.json');
    await writeFile(cleanupPath, raw, { flag: 'wx' });
    assert.deepEqual(
      Object.keys(cleanup).sort(),
      [
        'schemaVersion',
        'kind',
        'status',
        'root',
        'boxRoot',
        'installationId',
        'ownerSid',
        'buildVersion',
        'currentBuildVersion',
        'payloadManifestSha256',
        'currentMappingSha256',
        'receiptSha256',
        'launchAuditSha256',
        'handoffSha256',
        'launchMetadataPath',
        'launchMetadataSha256',
        'targetEnvelopeSha256',
        'temporaryDirectory',
        'removed',
        'retainedSourceInstaller',
      ].sort(),
    );
    assert.equal(cleanup.schemaVersion, 1);
    assert.equal(cleanup.kind, 'TableMax.ApplicationUpdate.Cleanup');
    assert.equal(cleanup.status, 'completed');
    assert.equal(resolve(cleanup.root), root);
    assert.equal(resolve(cleanup.boxRoot), box);
    assert.equal(
      cleanup.installationId,
      oldInstallationIdentity.installationId,
    );
    assert.equal(cleanup.ownerSid, oldInstallationIdentity.ownerSid);
    assert.equal(cleanup.buildVersion, newBuild);
    assert.equal(cleanup.currentBuildVersion, newBuild);
    assert.equal(cleanup.payloadManifestSha256, target.payloadManifestSha256);
    assert.equal(cleanup.currentMappingSha256, target.currentMappingSha256);
    assert.equal(cleanup.receiptSha256, before.receipt.sha256);
    assert.equal(cleanup.launchAuditSha256, shortLaunch.audit.sha256);
    assert.equal(cleanup.handoffSha256, shortLaunch.handoffRecord.sha256);
    assert.equal(
      resolve(cleanup.launchMetadataPath),
      shortLaunch.metadata.sourcePath,
    );
    assert.equal(cleanup.launchMetadataSha256, shortLaunch.metadata.sha256);
    assert.equal(
      cleanup.targetEnvelopeSha256,
      shortLaunch.targetEnvelope.sha256,
    );
    assert.equal(
      resolve(cleanup.temporaryDirectory),
      shortLaunch.temporaryDirectory,
    );
    const plainTuple = (value) => {
      assert.deepEqual(
        Object.keys(value).sort(),
        ['sourcePath', 'path', 'bytes', 'sha256'].sort(),
      );
      const { sourcePath, path, bytes, sha256 } = value;
      return { sourcePath, path, bytes, sha256 };
    };
    const expectedRemoved = [
      {
        sourcePath: shortLaunch.canonicalHelperSource.path,
        ...shortLaunch.retainedHelper,
      },
      ...(shortLaunch.retainedInstaller
        ? [
            {
              sourcePath: shortLaunch.canonicalInstallerSource.path,
              ...shortLaunch.retainedInstaller,
            },
          ]
        : []),
      {
        sourcePath: shortLaunch.metadata.sourcePath,
        path: shortLaunch.metadata.sourcePath,
        bytes: shortLaunch.metadata.bytes,
        sha256: shortLaunch.metadata.sha256,
      },
      {
        sourcePath: shortLaunch.canonicalHelperSource.path,
        ...shortLaunch.canonicalHelperSource,
      },
    ];
    assert.deepEqual(cleanup.removed.map(plainTuple), expectedRemoved);
    for (const file of expectedRemoved) {
      await noLinks(file.path);
      assert.equal(await exists(file.path), false);
    }
    assert.equal(await exists(shortLaunch.temporaryDirectory), false);
    const retainedSourceInstaller = await record(
      shortLaunch.canonicalInstallerSource.path,
    );
    assert.deepEqual(
      retainedSourceInstaller,
      shortLaunch.canonicalInstallerSource,
    );
    assert.deepEqual(plainTuple(cleanup.retainedSourceInstaller), {
      sourcePath: retainedSourceInstaller.path,
      ...retainedSourceInstaller,
    });
    const retainedAudits = [];
    for (const file of [
      shortLaunch.audit,
      shortLaunch.handoffRecord,
      shortLaunch.targetEnvelope,
    ]) {
      await noLinks(file.sourcePath);
      const actual = await record(file.sourcePath);
      assert.deepEqual(actual, {
        path: file.sourcePath,
        bytes: file.bytes,
        sha256: file.sha256,
      });
      retainedAudits.push(actual);
    }
    const after = {
      configuration: await record(configurationPath),
      identity: await record(join(box, '.install.json')),
      receipt: await record(join(box, '.installer-receipt.json')),
      unknown: await record(outside),
      dataSentinel: await record(sentinel),
    };
    assert.deepEqual(after, before);
    assert.deepEqual(await preservedData(gamesDirectory), gamesBefore);
    return {
      result: 'passed',
      persistentHostExit,
      restart: {
        ready,
        readyFile: await record(join(restartEvidence, 'old-native-ready.json')),
        plan: await record(restartPlan),
        evidenceDirectory: restartEvidence,
        appVersion: runtime.appVersion,
        actualHostState: state,
      },
      cleanup: {
        value: cleanup,
        file: { sourcePath: cleanupSource, ...(await record(cleanupPath)) },
      },
      removed: expectedRemoved,
      retainedSourceInstaller,
      retainedAudits,
      preservation: {
        before,
        after,
        games: {
          files: gamesBefore.length,
          snapshot: await record(gamesSnapshot),
        },
      },
      boundary:
        'Actual healthy post-Apply host exited 0 through the existing fixture request and real context.Quit while its exact process handle was held. A separate same-version installed Native then ran local cleanup; this direct child remains active for the final real default uninstall. Original download and public signed audit bytes are retained. G/config/identity/receipt/unknown files and a private D sentinel are byte-bound; normal SQLite startup bookkeeping is not claimed unchanged.',
    };
  }
  async function verifyShortLaunch(
    directory,
    outcome,
    oldHelper,
    target,
    trust,
  ) {
    const samePath = (actual, expected) => {
      assert.ok(typeof actual === 'string' && isAbsolute(actual));
      assert.equal(
        resolve(actual).toLowerCase(),
        resolve(expected).toLowerCase(),
      );
    };
    const keys = (value, expected) => {
      assert.ok(value && typeof value === 'object' && !Array.isArray(value));
      assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
    };
    const archiveJson = async (sourcePath, name, maximum = 32768) => {
      sourcePath = inside(work, sourcePath);
      await noLinks(sourcePath);
      const raw = await readFile(sourcePath);
      const value = parseStrictJson(raw, maximum, { canonicalIntegers: true });
      const path = join(evidence, name);
      await writeFile(path, raw, { flag: 'wx' });
      return {
        value,
        file: { sourcePath, path, bytes: raw.length, sha256: hash(raw) },
      };
    };
    const tuple = (value, sourcePath, path, expected) => {
      keys(value, ['sourcePath', 'path', 'bytes', 'sha256']);
      samePath(value.sourcePath, sourcePath);
      samePath(value.path, path);
      assert.equal(value.bytes, expected.bytes);
      assert.equal(value.sha256, expected.sha256);
    };
    const tupleRepresentation = (value) => {
      keys(value, ['sourcePath', 'path', 'bytes', 'sha256']);
      const { sourcePath, path, bytes, sha256 } = value;
      return { sourcePath, path, bytes, sha256 };
    };
    samePath(dirname(directory), join(root, 'TableMax/updates'));
    assert.match(
      directory.slice(dirname(directory).length + 1),
      /^handoff-[a-f0-9]{32}$/,
    );
    keys(outcome, [
      'schemaVersion',
      'root',
      'buildVersion',
      'status',
      'exitCode',
      'actualHelper',
      'actualInstaller',
      'sourceInstaller',
      'launchMetadataPath',
      'launchMetadataSha256',
      'cleanup',
    ]);
    assert.equal(outcome.schemaVersion, 1);
    samePath(outcome.root, root);
    assert.equal(outcome.buildVersion, target.buildVersion);
    assert.equal(outcome.status, 'installer-finished');
    assert.equal(outcome.exitCode, 0);
    const observedHelper = outcome.actualHelper;
    assert.equal(observedHelper?.queriedFromProcessHandle, true);
    assert.equal(observedHelper.pathObserved, true);
    samePath(observedHelper.path, observedHelper.modulePath);
    const temporaryDirectory = inside(work, dirname(observedHelper.modulePath));
    samePath(dirname(temporaryDirectory), work);
    assert.match(
      temporaryDirectory.slice(dirname(temporaryDirectory).length + 1),
      /^TableMax-update-[a-f0-9]{32}$/,
    );
    await noLinks(temporaryDirectory);
    const metadataPath = join(temporaryDirectory, 'launch.json');
    samePath(outcome.launchMetadataPath, metadataPath);
    const metadata = await archiveJson(
      metadataPath,
      'handoff-launch-metadata.json',
    );
    assert.equal(metadata.file.sha256, outcome.launchMetadataSha256);
    const launch = metadata.value;
    keys(launch, [
      'schemaVersion',
      'kind',
      'productId',
      'installationId',
      'ownerSid',
      'root',
      'boxRoot',
      'installedBuildVersion',
      'targetBuildVersion',
      'payloadManifestSha256',
      'currentMappingSha256',
      'temporaryParent',
      'temporaryDirectory',
      'auditPath',
      'helper',
      'installer',
      'target',
    ]);
    assert.equal(launch.schemaVersion, 1);
    assert.equal(launch.kind, 'TableMax.ApplicationUpdate.Launch');
    assert.equal(launch.productId, fixtureId);
    assert.equal(launch.installationId, oldInstallationIdentity.installationId);
    assert.equal(launch.ownerSid, oldInstallationIdentity.ownerSid);
    samePath(launch.root, root);
    samePath(launch.boxRoot, join(root, 'TableMax'));
    assert.equal(launch.installedBuildVersion, oldBuild);
    assert.equal(launch.targetBuildVersion, target.buildVersion);
    assert.equal(launch.payloadManifestSha256, target.payloadManifestSha256);
    assert.equal(launch.currentMappingSha256, target.currentMappingSha256);
    samePath(launch.temporaryParent, work);
    samePath(launch.temporaryDirectory, temporaryDirectory);
    samePath(launch.auditPath, join(directory, 'launch.json'));
    const helperPath = join(temporaryDirectory, 'h.exe');
    const installerPath = join(temporaryDirectory, 'i.exe');
    const helperSource = join(directory, 'UpdateHelper.exe');
    for (const path of [helperPath, installerPath, helperSource])
      await noLinks(path);
    const canonicalHelper = await record(helperSource);
    assert.equal(canonicalHelper.bytes, oldHelper.bytes);
    assert.equal(canonicalHelper.sha256, oldHelper.sha256);
    const installerSource = join(
      root,
      'TableMax/updates/downloads',
      target.sha256,
      target.assetName,
    );
    await noLinks(installerSource);
    const canonicalInstaller = await record(installerSource);
    assert.equal(canonicalInstaller.bytes, target.bytes);
    assert.equal(canonicalInstaller.sha256, target.sha256);
    const targetEnvelope = await archiveJson(
      join(directory, 'envelope.json'),
      'handoff-envelope.json',
      16384,
    );
    const verified = verifyFixtureApplicationUpdate(targetEnvelope.value, {
      trustedKeys: (await json(trust)).keys,
    });
    assert.deepEqual(verified.description, target);
    tuple(launch.helper, canonicalHelper.path, helperPath, oldHelper);
    tuple(launch.installer, canonicalInstaller.path, installerPath, target);
    tuple(
      launch.target,
      targetEnvelope.file.sourcePath,
      targetEnvelope.file.sourcePath,
      targetEnvelope.file,
    );
    const audit = await archiveJson(
      join(directory, 'launch.json'),
      'handoff-launch-audit.json',
    );
    keys(audit.value, [
      'schemaVersion',
      'root',
      'installationId',
      'ownerSid',
      'temporaryDirectory',
      'metadataPath',
      'metadataSha256',
      'actualHelper',
      'sourceInstaller',
      'target',
    ]);
    assert.equal(audit.value.schemaVersion, 1);
    samePath(audit.value.root, root);
    assert.equal(audit.value.installationId, launch.installationId);
    assert.equal(audit.value.ownerSid, launch.ownerSid);
    samePath(audit.value.temporaryDirectory, temporaryDirectory);
    samePath(audit.value.metadataPath, metadataPath);
    assert.equal(audit.value.metadataSha256, metadata.file.sha256);
    for (const [actual, expected] of [
      [audit.value.actualHelper, launch.helper],
      [audit.value.sourceInstaller, launch.installer],
      [audit.value.target, launch.target],
      [outcome.sourceInstaller, launch.installer],
    ])
      assert.deepEqual(
        tupleRepresentation(actual),
        tupleRepresentation(expected),
      );
    const observations = [];
    for (const [name, expected, helper] of [
      ['actualHelper', launch.helper, true],
      ['actualInstaller', launch.installer, false],
    ]) {
      const value = outcome[name];
      keys(value, [
        'sourcePath',
        'path',
        'bytes',
        'sha256',
        'expectedPath',
        'pid',
        'modulePath',
        'pathObserved',
        'processStarted',
        'queriedFromProcessHandle',
        ...(helper ? ['assemblyLocation'] : []),
      ]);
      samePath(value.sourcePath, expected.sourcePath);
      samePath(value.expectedPath, expected.path);
      samePath(value.path, expected.path);
      samePath(value.modulePath, expected.path);
      if (helper) samePath(value.assemblyLocation, expected.path);
      assert.ok(value.modulePath.length < 260);
      assert.ok(Number.isSafeInteger(value.pid) && value.pid > 0);
      assert.equal(value.bytes, expected.bytes);
      assert.equal(value.sha256, expected.sha256);
      for (const flag of [
        'pathObserved',
        'processStarted',
        'queriedFromProcessHandle',
      ])
        assert.equal(value[flag], true);
      observations.push({
        name,
        ...value,
        modulePathLength: value.modulePath.length,
      });
    }
    assert.notEqual(observations[0].pid, observations[1].pid);
    const retainedHelper = await record(helperPath);
    assert.equal(retainedHelper.bytes, oldHelper.bytes);
    assert.equal(retainedHelper.sha256, oldHelper.sha256);
    keys(outcome.cleanup, ['installerDeleted', 'selfHelperRetained', 'reason']);
    assert.equal(typeof outcome.cleanup.installerDeleted, 'boolean');
    assert.equal(outcome.cleanup.selfHelperRetained, true);
    assert.ok(
      typeof outcome.cleanup.reason === 'string' &&
        outcome.cleanup.reason.length > 0,
    );
    let retainedInstaller = null;
    if (outcome.cleanup.installerDeleted)
      assert.equal(await exists(installerPath), false);
    else {
      retainedInstaller = await record(installerPath);
      assert.equal(retainedInstaller.bytes, target.bytes);
      assert.equal(retainedInstaller.sha256, target.sha256);
    }
    const entries = await readdir(temporaryDirectory, { withFileTypes: true });
    assert.ok(
      entries.every((entry) => entry.isFile() && !entry.isSymbolicLink()),
    );
    assert.deepEqual(
      entries.map((entry) => entry.name).sort(),
      [
        'h.exe',
        'launch.json',
        ...(!outcome.cleanup.installerDeleted ? ['i.exe'] : []),
      ].sort(),
    );
    const handoffRecord = await archiveJson(
      join(directory, 'handoff.json'),
      'handoff-record.json',
    );
    assert.deepEqual(
      handoffRecord.value,
      parseStrictJson(JSON.stringify(outcome), 32768, {
        canonicalIntegers: true,
      }),
    );
    if (startupPathPlan.requiredRootLength === 198) {
      assert.ok(canonicalHelper.path.length >= 260);
      assert.ok(canonicalInstaller.path.length >= 260);
    }
    return {
      canonicalHelperSource: canonicalHelper,
      canonicalInstallerSource: canonicalInstaller,
      temporaryDirectory,
      metadata: metadata.file,
      audit: audit.file,
      targetEnvelope: targetEnvelope.file,
      handoffRecord: handoffRecord.file,
      actualModuleObservations: observations,
      retainedHelper,
      retainedInstaller,
      cleanup: outcome.cleanup,
      boundary:
        'Actual process-handle module observations come from the same-SHA fixture helper record. Node independently verifies original files, retained copies and public metadata/audit raw bytes; it does not query Windows ACLs or recover an exit status for the indirect processes.',
    };
  }
  async function execute(
    executable,
    args,
    label,
    timeout = 180000,
    extraEnvironment = {},
  ) {
    const child = spawn(executable, args, {
      cwd: repository,
      env: { ...environment, ...extraEnvironment },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    let output = '',
      timedOut = false,
      outputTruncated = false,
      outputBytesObserved = 0;
    const save = (chunk) => {
      outputBytesObserved += Buffer.byteLength(chunk, 'utf8');
      const text = chunk.toString();
      const remaining = 2 * 1024 * 1024 - output.length;
      if (remaining > 0) output += text.slice(0, remaining);
      if (text.length > remaining) outputTruncated = true;
    };
    child.stdout.on('data', save);
    child.stderr.on('data', save);
    const result = await new Promise((done, reject) => {
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeout);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (code, signal) => {
        clearTimeout(timer);
        done({ code, signal });
      });
    });
    const log = join(
      evidence,
      `${String(++sequence).padStart(3, '0')}-${label}.log`,
    );
    await writeFile(log, output);
    await writeJson(log + '.json', {
      executable,
      args,
      pid: child.pid,
      ...result,
      timedOut,
      outputTruncated,
      outputBytesObserved,
    });
    assert.ok(!timedOut, label + ' exceeded its bounded budget');
    assert.ok(!outputTruncated, label + ' exceeded its bounded log budget');
    return { ...result, output, log };
  }
  async function registration() {
    const result = await execute(
      powershell,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        powershellUtf8 +
          `$key='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${fixtureId}_is1'; if(Test-Path -LiteralPath $key){Get-ItemProperty -LiteralPath $key | Select-Object InstallLocation,DisplayVersion | ConvertTo-Json -Compress}else{'null'}`,
      ],
      'fixture-registration',
    );
    assert.equal(result.code, 0);
    return JSON.parse(result.output.trim());
  }
  async function step(id, action) {
    const started = performance.now();
    try {
      const detail = await action();
      report.steps.push({
        id,
        result: 'passed',
        durationMs: Math.round(performance.now() - started),
        ...detail,
      });
      await writeJson(join(evidence, 'report.json'), report);
      console.log(JSON.stringify({ id, result: 'passed', evidence }));
      return detail;
    } catch (error) {
      report.failures++;
      report.steps.push({
        id,
        result: 'failed',
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
  async function frameworkRecovery() {
    const box = join(root, 'TableMax');
    const oldHelper = report.old.manifest.files.find(
      (file) => file.path === 'UpdateHelper.exe',
    );
    const newHelper = report.new.manifest.files.find(
      (file) => file.path === 'UpdateHelper.exe',
    );
    for (const [value, helper] of [
      [report.old, oldHelper],
      [report.new, newHelper],
    ]) {
      const embedded =
        value.delivery.executable.installation.recipe.compiler
          .embeddedUninstallHelper;
      assert.equal(
        embedded.encoding,
        'base64',
        'Framework must contain its own embedded coordinator',
      );
      assert.equal(embedded.sha256, helper.sha256);
      assert.equal(embedded.bytes, helper.bytes);
    }
    assert.notEqual(
      oldHelper.sha256,
      newHelper.sha256,
      'The two fixture helpers must have different actual bytes',
    );
    const outside = join(root, '朋友资料.txt');
    await writeFile(outside, 'Preserved by actual old-framework recovery\n', {
      flag: 'wx',
    });
    const outsideBefore = await record(outside);
    report.frameworkRecovery = {
      productId: fixtureId,
      root,
      oldBuild,
      newBuild,
      expectedNativeExitCode: 42,
      failureRequest: 'foundation-write-and-fail-v1',
      boundary:
        'Actual fixture Inno failure and the previously installed framework uninstaller. No production identity, external data directory, real internet, genuine power-loss or successful B update claim.',
    };
    await step('framework-old-inno-install', async () => {
      assert.equal(await registration(), null);
      const result = await execute(
        actualExecutionInputs.old.path,
        [
          '/VERYSILENT',
          '/SUPPRESSMSGBOXES',
          '/NORESTART',
          '/DIR=' + root,
          '/LOG=' + join(evidence, 'framework-old-inno.log'),
        ],
        'framework-old-inno',
      );
      assert.equal(result.code, 0, result.log);
      installed = true;
      const current = await registration();
      assert.equal(resolve(current.InstallLocation), root);
      assert.equal(current.DisplayVersion, oldBuild);
      assert.equal(
        (await json(join(box, 'TableMax.config.json'))).dataDirectory,
        '.',
      );
      return { registration: current };
    });
    let frameworkBefore, configBefore, fingerprintBefore;
    await step('framework-old-bootstrap-baseline', async () => {
      frameworkBefore = await Promise.all(
        ['unins000.exe', 'unins000.dat'].map((name) =>
          record(join(root, name)),
        ),
      );
      configBefore = await record(join(box, 'TableMax.config.json'));
      fingerprintBefore = await databaseFingerprint(box);
      assert.equal(
        (await record(join(root, 'UpdateHelper.exe'))).sha256,
        oldHelper.sha256,
      );
      report.frameworkRecovery.oldFramework = frameworkBefore;
      report.frameworkRecovery.beforeDatabaseFingerprint = fingerprintBefore;
      return {
        framework: frameworkBefore,
        oldHelperSha256: oldHelper.sha256,
        config: configBefore,
        databaseFingerprint: fingerprintBefore,
      };
    });
    let witness, pending, dataBeforeUninstall;
    await step('framework-new-inno-expected-health-failure', async () => {
      const result = await execute(
        actualExecutionInputs.new.path,
        [
          '/VERYSILENT',
          '/SUPPRESSMSGBOXES',
          '/NORESTART',
          '/DIR=' + root,
          '/LOG=' + join(evidence, 'framework-new-failed-inno.log'),
        ],
        'framework-new-expected-failure',
        180000,
        { TABLEMAX_HANDOFF_FRAMEWORK_FAILURE: 'foundation-write-and-fail-v1' },
      );
      assert.ok(
        Number.isInteger(result.code) && result.code !== 0,
        'Expected B Inno health failure must exit nonzero',
      );
      witness = await json(join(evidence, 'framework-health-failure.json'));
      assert.equal(witness.productId, fixtureId);
      assert.equal(resolve(witness.root), root);
      assert.equal(resolve(witness.dataDirectory), box);
      assert.equal(witness.buildVersion, newBuild);
      assert.equal(witness.nodeExitCode, 0);
      assert.equal(witness.expectedNativeExitCode, 42);
      assert.equal(witness.productionEntryInvoked, false);
      assert.equal(witness.sqliteWriteCompleted, true);
      assert.notEqual(witness.beforeSha256, witness.afterSha256);
      const candidates = [];
      for (const name of await readdir(
        join(box, '.installation-transactions'),
      )) {
        const directory = join(box, '.installation-transactions', name);
        const state = await maybeJson(join(directory, 'state.json'));
        if (state?.phase === 'health-failed') {
          const targetIdentity = await json(join(directory, 'target.json'));
          if (targetIdentity.buildVersion === newBuild)
            candidates.push({ directory, state, target: targetIdentity });
        }
      }
      assert.equal(
        candidates.length,
        1,
        'Exactly one failed B transaction required',
      );
      pending = candidates[0];
      assert.equal(resolve(pending.state.dataDirectory), box);
      assert.equal(pending.state.databaseFingerprint, fingerprintBefore);
      const fingerprintAfter = await databaseFingerprint(box);
      assert.notEqual(fingerprintAfter, pending.state.databaseFingerprint);
      const current = await json(join(box, '.install.json'));
      assert.equal(current.buildVersion, newBuild);
      assert.equal(current.installationId, witness.installationId);
      assert.equal(
        current.payloadManifestSha256,
        report.new.manifest.payloadManifestSha256,
      );
      const receipt = await json(join(box, '.installer-receipt.json'));
      assert.equal(receipt.sha256, report.new.delivery.executable.sha256);
      assert.equal(
        (await record(join(root, 'UpdateHelper.exe'))).sha256,
        newHelper.sha256,
      );
      assert.deepEqual(
        await record(join(box, 'TableMax.config.json')),
        configBefore,
      );
      dataBeforeUninstall = await preservedData(box);
      report.frameworkRecovery.failedBExitCode = result.code;
      report.frameworkRecovery.witness = witness;
      report.frameworkRecovery.failedTransaction = pending;
      report.frameworkRecovery.afterFailureDatabaseFingerprint =
        fingerprintAfter;
      report.frameworkRecovery.dataBeforeUninstall = dataBeforeUninstall;
      return {
        expectedFailure: true,
        installerExitCode: result.code,
        nativeWitness: witness,
        pending,
        databaseFingerprint: fingerprintAfter,
        actualBHelperSha256: newHelper.sha256,
      };
    });
    await step('framework-old-uninstaller-retained', async () => {
      const after = await Promise.all(
        frameworkBefore.map((file) => record(file.path)),
      );
      assert.deepEqual(
        after,
        frameworkBefore,
        'Failed B must retain the actual A framework bytes',
      );
      const current = await registration();
      assert.equal(resolve(current.InstallLocation), root);
      assert.equal(current.DisplayVersion, oldBuild);
      report.frameworkRecovery.registrationAfterBFailure = current;
      return {
        framework: after,
        registration: current,
        oldFrameworkRetained: true,
      };
    });
    await step('framework-missing-live-helper', async () => {
      const path = join(root, 'UpdateHelper.exe'),
        before = await record(path);
      assert.equal(before.sha256, newHelper.sha256);
      const backup = join(work, 'fixture-missing-helper-original.exe');
      assert.equal(await exists(backup), false);
      await rename(path, backup);
      const retained = await record(backup);
      assert.equal(retained.sha256, before.sha256);
      assert.equal(retained.bytes, before.bytes);
      assert.equal(await exists(path), false);
      report.frameworkRecovery.helperFault = {
        mode: 'missing',
        original: before,
        preserved: retained,
      };
      return report.frameworkRecovery.helperFault;
    });
    await step('framework-actual-old-default-uninstall', async () => {
      assert.deepEqual(
        await record(frameworkBefore[0].path),
        frameworkBefore[0],
      );
      assert.deepEqual(
        await record(frameworkBefore[1].path),
        frameworkBefore[1],
      );
      assert.equal(await exists(join(root, 'UpdateHelper.exe')), false);
      const result = await execute(
        frameworkBefore[0].path,
        [
          '/VERYSILENT',
          '/SUPPRESSMSGBOXES',
          '/NORESTART',
          '/LOG=' + join(evidence, 'framework-actual-old-uninstall.log'),
        ],
        'framework-actual-old-default-uninstall',
      );
      assert.equal(result.code, 0, result.log);
      report.frameworkRecovery.uninstallerExitCode = result.code;
      return {
        exitCode: result.code,
        executedActualOldFramework: frameworkBefore[0],
        liveHelperWasMissing: true,
      };
    });
    await step('framework-preserved-data-and-registration', async () => {
      assert.equal(await registration(), null);
      assert.deepEqual(await record(outside), outsideBefore);
      assert.deepEqual(await preservedData(box), dataBeforeUninstall);
      assert.deepEqual(
        await record(join(box, 'TableMax.config.json')),
        configBefore,
      );
      for (const file of report.new.manifest.files)
        assert.equal(
          await exists(join(root, file.path)),
          false,
          'Managed file remains after default framework uninstall: ' +
            file.path,
        );
      await waitUntil(
        async () =>
          !(await exists(frameworkBefore[0].path)) &&
          !(await exists(frameworkBefore[1].path)),
        'Old framework self-removal',
        15000,
      );
      installed = false;
      report.frameworkRecovery.registrationRemoved = true;
      report.frameworkRecovery.preservedData = true;
      return {
        registrationRemoved: true,
        dataAndGamesAndConfigPreserved: true,
        unknown: outsideBefore,
        managedFilesRemoved: true,
        frameworkFilesRemoved: true,
      };
    });
  }
  const nativeFiles = (await readdir(resolve('apps/desktop/native')))
    .filter((name) => name.endsWith('.cs'))
    .map((name) => 'apps/desktop/native/' + name);
  const sources = [...nativeFiles, ...sourcePaths];
  report.sourceHashes = Object.fromEntries(
    await Promise.all(
      [
        ...sources,
        'tools/shared/application-update.mjs',
        'tools/shared/windows-acceptance-profile.mjs',
        'tools/test/support/fixture-application-update.mjs',
      ].map(async (path) => [path, hash(await readFile(path))]),
    ),
  );
  const keyId = 'fixture-rsa-handoff';
  let privateKey, publicKey;
  const trust = join(work, 'fixture-public-trust.json');
  if (prepared) {
    const source = inside(repository, prepared.fixturePublicKey.path);
    await noLinks(source);
    assert.deepEqual(await record(source), prepared.fixturePublicKey);
    await copyFile(source, trust);
  } else {
    ({ privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 3072,
      publicExponent: 65537,
    }));
    const publicXml = applicationPublicKeyXml(publicKey);
    await writeJson(trust, { schemaVersion: 1, keys: { [keyId]: publicXml } });
  }
  report.fixturePublicKey = await record(trust);
  report.privateKey = prepared
    ? 'No private key used; reverified public signed prepared materials'
    : 'Generated only in Node memory; never serialized, logged or exported';
  const version = (await json('package.json')).version;
  const oldBuild = version + '.60000',
    newBuild = version + '.60001';
  const refs = resolve(
    '.cache/nuget/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8',
  );
  const sdk = (await json('global.json')).sdk.version;
  const compiler = join(
    process.env.ProgramFiles ?? 'C:/Program Files',
    'dotnet/sdk',
    sdk,
    'Roslyn/bincore/csc.dll',
  );
  async function native(buildVersion) {
    const directory = join(work, 'native-' + buildVersion);
    await mkdir(directory);
    for (const name of [
      'TableMax.exe.config',
      'Microsoft.Web.WebView2.Core.dll',
      'Microsoft.Web.WebView2.WinForms.dll',
      'WebView2Loader.dll',
    ])
      await copyFile(join(nativeTemplate, name), join(directory, name));
    const metadata = join(directory, 'Fixture.AssemblyInfo.cs');
    await writeFile(
      metadata,
      `using System.Reflection;\n[assembly:AssemblyVersion("${buildVersion}")]\n[assembly:AssemblyFileVersion("${buildVersion}")]\n[assembly:AssemblyMetadata("TableMaxRepositoryRoot", @"${repository.replaceAll('"', '""')}")]\n`,
    );
    const compile = await execute(
      'dotnet',
      [
        compiler,
        '/nologo',
        '/target:winexe',
        '/platform:x64',
        '/langversion:12',
        '/optimize+',
        '/deterministic+',
        '/warnaserror+',
        '/nostdlib+',
        '/define:TABLEMAX_INSTALLATION_TEST',
        '/main:TableMax.InstallationTesting.ApplicationHandoffFixture',
        '/out:' + join(directory, 'TableMax.exe'),
        '/win32icon:' + resolve('assets/platform/app-icon.ico'),
        '/win32manifest:' + resolve('apps/desktop/native/app.manifest'),
        ...[
          'mscorlib',
          'System',
          'System.Core',
          'System.Drawing',
          'System.Windows.Forms',
          'System.Security',
          'System.Xml',
          'System.Configuration',
          'System.Net.Http',
          'System.Web.Extensions',
          'Microsoft.CSharp',
        ].map((name) => '/reference:' + join(refs, name + '.dll')),
        ...[
          'Microsoft.Web.WebView2.Core.dll',
          'Microsoft.Web.WebView2.WinForms.dll',
        ].map((name) => '/reference:' + join(directory, name)),
        '/resource:' +
          resolve('apps/desktop/native/Bridge.js') +
          ',TableMax.Desktop.Bridge.js',
        '/resource:' + trust + ',TableMax.Desktop.ApplicationUpdateKeys.json',
        ...sources.map((path) => resolve(path)),
        metadata,
      ],
      'compile-native-' + buildVersion,
    );
    assert.equal(
      compile.code,
      0,
      'Fixture Native compilation failed: ' + compile.log,
    );
    return directory;
  }
  async function fixture(buildVersion, handoffTest) {
    const directory = await native(buildVersion);
    const delivery = await createInstallationFixturePackage({
      nativeDirectory: directory,
      serverDirectory,
      webDirectory,
      buildVersion,
      applicationTrustRootsPath: trust,
      handoffTest,
    });
    const manifest = await json(delivery.executable.installation.manifestPath);
    assert.equal(
      delivery.buildVersion,
      buildVersion,
      'Builder did not honor explicit fixture build',
    );
    assert.equal(manifest.buildVersion, buildVersion);
    assert.equal(manifest.productId, fixtureId);
    assert.equal(
      (
        await json(
          join(
            delivery.executable.installation.candidateDirectory,
            'TableMax/app/package.json',
          ),
        )
      ).buildVersion,
      buildVersion,
      'Fixture runtime package build must match PE and manifest',
    );
    for (const executable of [
      join(directory, 'TableMax.exe'),
      join(
        delivery.executable.installation.candidateDirectory,
        'UpdateHelper.exe',
      ),
    ]) {
      const resource = await execute(
        powershell,
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          powershellUtf8 +
            '$assembly=[Reflection.Assembly]::ReflectionOnlyLoadFrom($env:TABLEMAX_FIXTURE_ASSEMBLY); $name=@($assembly.GetManifestResourceNames() | Where-Object { $_.EndsWith("ApplicationUpdateKeys.json") }); if($name.Count -ne 1){throw "Fixture trust resource missing"}; $stream=$assembly.GetManifestResourceStream($name[0]); try { $sha=[Security.Cryptography.SHA256]::Create(); try { [BitConverter]::ToString($sha.ComputeHash($stream)).Replace("-", "").ToLowerInvariant() } finally { $sha.Dispose() } } finally { $stream.Dispose() }',
        ],
        'verify-embedded-trust-' + buildVersion,
        180000,
        { TABLEMAX_FIXTURE_ASSEMBLY: executable },
      );
      assert.equal(resource.code, 0, resource.log);
      assert.equal(
        resource.output.trim(),
        report.fixturePublicKey.sha256,
        'Fixture public trust root was not embedded',
      );
    }
    return { delivery, manifest };
  }
  try {
    if (compileOnly) {
      report.nativeOnly = [];
      for (const buildVersion of [oldBuild, newBuild])
        await step('compile-only-' + buildVersion, async () => {
          const directory = await native(buildVersion);
          const file = await record(join(directory, 'TableMax.exe'));
          report.nativeOnly.push({ directory, buildVersion, file });
          return { directory, buildVersion, file, executed: false };
        });
      report.result = 'native-compiled-not-executed';
      return report;
    }
    if (!prepareOnly && !verifyPreparedOnly) {
      const previousRegistration = await registration();
      assert.equal(
        previousRegistration,
        null,
        'Another fixture installation must be preserved; serialize with its owner',
      );
    }
    let target, api;
    if (prepared) {
      await step('verify-prepared-materials', async () => {
        for (const [path, sha256] of Object.entries(prepared.sourceHashes)) {
          assert.equal(
            hash(await readFile(inside(repository, path))),
            sha256,
            'Prepared Native source changed: ' + path,
          );
        }
        for (const [role, buildVersion, handoffTest] of [
          ['old', oldBuild, false],
          ['new', newBuild, true],
        ]) {
          const value = prepared[role];
          const delivery = value.delivery;
          assert.equal(delivery.deliveryType, 'installer');
          assert.equal(delivery.buildVersion, buildVersion);
          assert.equal(delivery.executable.installation.productId, fixtureId);
          const executable = inside(repository, delivery.executable.path);
          await noLinks(executable);
          assert.deepEqual(await record(executable), {
            path: executable,
            bytes: delivery.executable.bytes,
            sha256: delivery.executable.sha256,
          });
          const installation = delivery.executable.installation;
          assert.equal(
            installation.recipe.fixtureOptions.handoffTest,
            handoffTest,
          );
          assert.equal(
            installation.recipe.fixtureOptions.buildVersion,
            buildVersion,
          );
          for (const input of installation.recipe.inputs) {
            const path = inside(repository, input.path);
            await noLinks(path);
            const actual = await record(path);
            assert.equal(
              actual.bytes,
              input.bytes,
              'Prepared recipe bytes changed',
            );
            assert.equal(
              actual.sha256,
              input.sha256,
              'Prepared recipe SHA changed',
            );
          }
          const path = inside(repository, installation.manifestPath);
          await noLinks(path);
          assert.equal(
            (await record(path)).sha256,
            installation.manifestSha256,
          );
          const manifest = await json(path);
          assert.deepEqual(manifest, value.manifest);
          assert.equal(manifest.productId, fixtureId);
          assert.equal(manifest.buildVersion, buildVersion);
          const candidate = inside(repository, installation.candidateDirectory);
          for (const file of manifest.files) {
            const path = inside(candidate, join(candidate, file.path));
            await noLinks(path);
            const actual = await record(path);
            assert.equal(actual.bytes, file.bytes);
            assert.equal(actual.sha256, file.sha256);
          }
          report[role] = value;
        }
        const planPath = inside(repository, prepared.plan.path);
        await noLinks(planPath);
        assert.deepEqual(await record(planPath), prepared.plan);
        const previousPlan = await json(planPath);
        assert.equal(previousPlan.schemaVersion, 1);
        assert.equal(resolve(previousPlan.scopeRoot), resolve('tmp'));
        assert.equal(
          previousPlan.newInstaller,
          report.new.delivery.executable.path,
        );
        api = JSON.parse(previousPlan.apiJson);
        const signed = extractApplicationUpdate(api.body).envelope;
        target = verifyFixtureApplicationUpdate(signed, {
          trustedKeys: (await json(trust)).keys,
        }).description;
        assert.deepEqual(target, prepared.description);
        assert.equal(target.bytes, report.new.delivery.executable.bytes);
        assert.equal(target.sha256, report.new.delivery.executable.sha256);
        assert.equal(
          target.payloadManifestSha256,
          report.new.manifest.payloadManifestSha256,
        );
        assert.equal(
          target.currentMappingSha256,
          report.new.manifest.currentMappingSha256,
        );
        report.preparedInput = await record(preparedReport);
        return {
          actualExeAndManifestSHAReverified: true,
          privateKeyUsed: false,
        };
      });
    } else {
      await step('build-old-actual-fixture', async () => {
        const value = await fixture(oldBuild, false);
        report.old = value;
        return {
          executable: await record(value.delivery.executable.path),
          buildVersion: oldBuild,
        };
      });
      await step('build-new-actual-fixture', async () => {
        const value = await fixture(newBuild, true);
        report.new = value;
        return {
          executable: await record(value.delivery.executable.path),
          buildVersion: newBuild,
        };
      });
      target = {
        schemaVersion: 1,
        productId: fixtureId,
        channel: 'stable',
        os: 'windows',
        arch: 'x64',
        installProtocol: 1,
        releaseVersion: version,
        buildVersion: newBuild,
        releaseTag: 'v' + version,
        repo: 'anApalpitate/TableMax',
        assetName: `TableMax-${version}-win-x64.exe`,
        assetUrl: `https://github.com/anApalpitate/TableMax/releases/download/v${version}/TableMax-${version}-win-x64.exe`,
        bytes: report.new.delivery.executable.bytes,
        sha256: report.new.delivery.executable.sha256,
        payloadManifestSha256: report.new.manifest.payloadManifestSha256,
        currentMappingSha256: report.new.manifest.currentMappingSha256,
      };
      const envelope = signFixtureApplicationUpdate(target, privateKey, {
        keyId,
      });
      verifyFixtureApplicationUpdate(envelope, {
        trustedKeys: { [keyId]: publicKey },
      });
      privateKey = undefined;
      api = {
        id: 60001,
        draft: false,
        prerelease: false,
        tag_name: target.releaseTag,
        html_url: `https://github.com/${target.repo}/releases/tag/${target.releaseTag}`,
        body:
          'Offline handoff fixture release notes.\n' +
          applicationUpdateMachineBlock(envelope),
        assets: [
          {
            id: 60002,
            name: target.assetName,
            size: target.bytes,
            state: 'uploaded',
            browser_download_url: target.assetUrl,
            digest: 'sha256:' + target.sha256,
          },
          {
            id: 60003,
            name: `TableMax-${version}-source.zip`,
            size: 1,
            state: 'uploaded',
            browser_download_url: `https://github.com/${target.repo}/releases/download/${target.releaseTag}/TableMax-${version}-source.zip`,
          },
        ],
      };
    }
    const executionDirectory = join(work, 'inputs');
    if (profile) await mkdir(executionDirectory, { recursive: false });
    actualExecutionInputs = {};
    for (const role of ['old', 'new']) {
      const source = report[role].delivery.executable;
      actualExecutionInputs[role] = await materializeAcceptanceExecutable({
        source: source.path,
        expected: { bytes: source.bytes, sha256: source.sha256 },
        profile,
        directory: executionDirectory,
        name: 'TableMax-' + role + '-fixture.exe',
      });
      assert.equal(actualExecutionInputs[role].bytes, source.bytes);
      assert.equal(actualExecutionInputs[role].sha256, source.sha256);
    }
    report.actualExecutionInputs = actualExecutionInputs;
    const plan = join(work, 'handoff-plan.json');
    await writeJson(plan, {
      schemaVersion: 1,
      scopeRoot,
      root,
      evidence,
      newInstaller: actualExecutionInputs.new.path,
      newBytes: target.bytes,
      newSha256: target.sha256,
      apiJson: JSON.stringify(api),
    });
    environment.TABLEMAX_HANDOFF_TEST_PLAN = plan;
    report.plan = await record(plan);
    report.description = target;
    if (frameworkRecoveryOnly) {
      await frameworkRecovery();
    } else if (!prepareOnly && !verifyPreparedOnly) {
      const outside = join(root, '朋友资料.txt');
      await writeFile(outside, 'Preserved by actual installer and update\n');
      const outsideBefore = await record(outside);
      await step('actual-old-inno-install', async () => {
        assert.equal(await registration(), null);
        if (usesExternalData) {
          await noLinks(externalDataDirectory);
          assert.equal(await exists(externalDataDirectory), false);
          await mkdir(externalDataDirectory);
          await mkdir(join(root, 'TableMax'));
          await writeJson(configurationPath, {
            dataDirectory: externalDataDirectory,
          });
          report.startupExternalData.configurationBefore =
            await record(configurationPath);
        }
        const run = await execute(
          actualExecutionInputs.old.path,
          [
            '/VERYSILENT',
            '/SUPPRESSMSGBOXES',
            '/NORESTART',
            '/DIR=' + root,
            ...(!activeUninstallOnly ? ['/TASKS=!desktopicon'] : []),
            '/LOG=' + join(evidence, 'old-inno.log'),
          ],
          'old-inno',
        );
        assert.equal(run.code, 0, run.log);
        installed = true;
        const value = await registration();
        assert.equal(resolve(value.InstallLocation), root);
        assert.equal(value.DisplayVersion, oldBuild);
        const identityPath = join(root, 'TableMax/.install.json');
        oldInstallationIdentity = await json(identityPath);
        assert.equal(oldInstallationIdentity.productId, fixtureId);
        assert.equal(oldInstallationIdentity.buildVersion, oldBuild);
        assert.equal(resolve(oldInstallationIdentity.root), root);
        assert.equal(
          resolve(oldInstallationIdentity.boxRoot),
          join(root, 'TableMax'),
        );
        assert.match(
          oldInstallationIdentity.installationId,
          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
        );
        if (profile)
          assert.equal(oldInstallationIdentity.ownerSid, profile.ownerSid);
        if (usesExternalData) {
          assert.equal(
            (await json(configurationPath)).dataDirectory,
            externalDataDirectory,
          );
          assert.deepEqual(
            await record(configurationPath),
            report.startupExternalData.configurationBefore,
          );
        }
        return {
          registration: value,
          installationIdentity: {
            installationId: oldInstallationIdentity.installationId,
            ownerSid: oldInstallationIdentity.ownerSid,
            buildVersion: oldInstallationIdentity.buildVersion,
            file: await record(identityPath),
          },
          ...(!activeUninstallOnly
            ? { shortcutSelection: await cancelledFixtureShortcuts() }
            : {}),
        };
      });
      await step('actual-old-host-transport', async () => {
        try {
          desktop = await launchDesktop({
            executablePath: join(root, 'TableMax/app/TableMax.exe'),
            timeout: 90000,
            env: {
              ...environment,
              TABLEMAX_BOX_DIRECTORY: join(root, 'TableMax'),
            },
          });
        } catch (error) {
          report.nativeDiagnostics.oldLaunchError = {
            error: error.message,
            boundary:
              'launchDesktop did not return its child handle. Raw startup streams and the final child exit status are unavailable to this caller; this is the existing bounded support diagnostic.',
          };
          throw error;
        }
        oldNativeCapture = observeOldNative(desktop.process());
        const ready = await waitUntil(async () => {
          const error = await maybeJson(
            join(evidence, 'old-fixture-error.json'),
          );
          if (error) throw new Error(error.error);
          return maybeJson(join(evidence, 'old-native-ready.json'));
        }, 'Actual old Native transport attachment');
        assert.equal(ready.buildVersion, oldBuild);
        assert.equal(ready.desktopPid, desktop.process().pid);
        assert.equal(resolve(ready.dataDirectory), dataDirectory);
        assert.equal(resolve(ready.boxRoot), join(root, 'TableMax'));
        if (usesExternalData) {
          assert.equal(resolve(ready.dataDirectory), externalDataDirectory);
          assert.equal(resolve(ready.boxRoot), join(root, 'TableMax'));
          assert.ok((await stat(gamesDirectory)).isDirectory());
          const gameEntries = (await readdir(gamesDirectory)).sort();
          assert.ok(
            gameEntries.length > 0,
            'Actual preinstalled G must remain under B',
          );
          assert.equal(
            await exists(join(externalDataDirectory, 'games')),
            false,
          );
          assert.equal(
            (await json(configurationPath)).dataDirectory,
            externalDataDirectory,
          );
          report.startupExternalData.actualReady = {
            dataDirectory: ready.dataDirectory,
            boxRoot: ready.boxRoot,
            servicePid: ready.servicePid,
          };
          report.startupExternalData.gameEntries = gameEntries;
          report.startupExternalData.externalGamesPresent = false;
        }
        return ready;
      });
      if (!activeUninstallOnly) {
        const host = await desktop.firstWindow();
        await step('actual-check-download', async () => {
          await host.evaluate(() => window.tablemaxUpdate.check());
          const available = await waitUntil(
            async () => {
              const state = await host.evaluate(() =>
                window.tablemaxUpdate.read(),
              );
              if (state.phase === 'error')
                throw new Error(state.error || 'Actual check failed');
              return state.phase === 'available' ? state : null;
            },
            'Actual available update',
            90000,
          );
          assert.equal(available.targetVersion, newBuild);
          await host.evaluate(() => window.tablemaxUpdate.download());
          const state = await waitUntil(
            async () => {
              const state = await host.evaluate(() =>
                window.tablemaxUpdate.read(),
              );
              if (state.phase === 'error')
                throw new Error(state.error || 'Actual download failed');
              return state.phase === 'ready' ? state : null;
            },
            'Actual complete download',
            90000,
          );
          assert.equal(state.targetVersion, newBuild);
          const downloaded = await record(
            join(
              root,
              'TableMax/updates/downloads',
              target.sha256,
              target.assetName,
            ),
          );
          assert.equal(downloaded.bytes, target.bytes);
          assert.equal(downloaded.sha256, target.sha256);
          const partialPathLength =
            downloaded.path.length + 1 + 32 + '.partial'.length;
          if (profile && !longRootExternalData)
            assert.ok(
              partialPathLength >= 260,
              'The default-D profile chain must exercise the long partial IO path',
            );
          return {
            state,
            downloaded,
            partialPathPlan: {
              length: partialPathLength,
              boundary:
                'Computed from the actual downloaded path and the frozen production .32hex.partial naming rule; the transient GUID path was not independently observed.',
            },
            transport:
              'Managed response and actual new installer stream; no real internet',
          };
        });
        await step('real-apply-parent-handoff', async () => {
          const parent = desktop.process();
          const ended =
            parent.exitCode !== null
              ? Promise.resolve(parent.exitCode)
              : new Promise((done) => parent.once('exit', done));
          await host.evaluate(() => {
            void window.tablemaxUpdate.apply().catch(() => {});
          });
          let exitTimer;
          let code;
          try {
            code = await Promise.race([
              ended,
              new Promise((_, reject) => {
                exitTimer = setTimeout(
                  () => reject(new Error('Actual parent did not exit')),
                  90000,
                );
              }),
            ]);
          } finally {
            clearTimeout(exitTimer);
          }
          assert.equal(code, 0);
          return {
            parentPid: parent.pid,
            parentExitCode: code,
            realPrepareAndQuit: true,
          };
        });
        await step('actual-new-persistent-host', async () => {
          const ready = await waitUntil(
            async () => {
              const error = await maybeJson(
                join(evidence, 'new-fixture-error.json'),
              );
              if (error) throw new Error(error.error);
              return await maybeJson(join(evidence, 'new-native-ready.json'));
            },
            'Actual new host',
            180000,
          );
          assert.equal(ready.buildVersion, newBuild);
          assert.equal(ready.persistent, true);
          assert.equal(ready.currentMappingSha256, target.currentMappingSha256);
          assert.equal(resolve(ready.dataDirectory), dataDirectory);
          assert.equal(resolve(ready.boxRoot), join(root, 'TableMax'));
          if (usesExternalData) {
            assert.equal(
              (await json(configurationPath)).dataDirectory,
              externalDataDirectory,
            );
            assert.deepEqual(
              await record(configurationPath),
              report.startupExternalData.configurationBefore,
            );
            report.startupExternalData.newActualReady = {
              dataDirectory: ready.dataDirectory,
              boxRoot: ready.boxRoot,
              servicePid: ready.servicePid,
            };
          }
          const installerFinished = await waitUntil(
            async () => {
              const directories = (
                await readdir(join(root, 'TableMax/updates'))
              ).filter((name) => name.startsWith('handoff-'));
              assert.ok(
                directories.length <= 1,
                'Unexpected additional handoff transaction',
              );
              if (directories.length === 0) return null;
              const value = await maybeJson(
                join(root, 'TableMax/updates', directories[0], 'handoff.json'),
              );
              if (value?.status === 'installer-failed')
                throw new Error(
                  'Actual handoff installer failed: ' + value.exitCode,
                );
              return value?.status === 'installer-finished' ? value : null;
            },
            'Actual handoff installer before registration',
            180000,
          );
          assert.equal(installerFinished.exitCode, 0);
          assert.equal(resolve(installerFinished.root), root);
          assert.equal(installerFinished.buildVersion, newBuild);
          const identity = await json(join(root, 'TableMax/.install.json'));
          assert.equal(identity.buildVersion, newBuild);
          assert.equal(
            identity.installationId,
            oldInstallationIdentity.installationId,
          );
          assert.equal(identity.ownerSid, oldInstallationIdentity.ownerSid);
          assert.equal(
            identity.payloadManifestSha256,
            target.payloadManifestSha256,
          );
          const reg = await registration();
          assert.equal(reg.DisplayVersion, newBuild);
          const shortcutSelection = await cancelledFixtureShortcuts();
          newBrowser = await chromium.connectOverCDP(
            'http://127.0.0.1:' + ready.cdpPort,
          );
          const page = await waitUntil(
            () =>
              newBrowser
                .contexts()
                .flatMap((ctx) => ctx.pages())
                .find((page) => page.url().includes('/host')),
            'New host page',
          );
          const state = await page.evaluate(() => window.tablemaxUpdate.read());
          assert.equal(state.currentVersion, newBuild);
          assert.deepEqual(await record(outside), outsideBefore);
          return {
            ...ready,
            installerFinished,
            shortcutSelection,
            identity,
            registration: reg,
            actualHostState: state,
          };
        });
        await step('handoff-helper-and-data', async () => {
          const directories = (
            await readdir(join(root, 'TableMax/updates'))
          ).filter((name) => name.startsWith('handoff-'));
          assert.equal(directories.length, 1);
          const directory = join(root, 'TableMax/updates', directories[0]);
          const outcome = await waitUntil(async () => {
            const value = await maybeJson(join(directory, 'handoff.json'));
            return value?.status === 'installer-finished' ? value : null;
          }, 'Actual handoff completion');
          assert.equal(outcome.exitCode, 0);
          const oldHelper = report.old.manifest.files.find(
            (file) => file.path === 'UpdateHelper.exe',
          );
          assert.equal(
            (await record(join(directory, 'UpdateHelper.exe'))).sha256,
            oldHelper.sha256,
          );
          const shortLaunch = await verifyShortLaunch(
            directory,
            outcome,
            oldHelper,
            target,
            trust,
          );
          const newHelper = report.new.manifest.files.find(
            (file) => file.path === 'UpdateHelper.exe',
          );
          assert.equal(
            (await record(join(root, 'UpdateHelper.exe'))).sha256,
            newHelper.sha256,
          );
          for (const file of report.new.manifest.files)
            assert.deepEqual(
              {
                bytes: (await stat(join(root, file.path))).size,
                sha256: hash(await readFile(join(root, file.path))),
              },
              { bytes: file.bytes, sha256: file.sha256 },
            );
          const nextStartupCleanup = await verifyNextStartupCleanup({
            directory,
            shortLaunch,
            target,
            plan,
            outside,
            outsideBefore,
          });
          return {
            outcome,
            shortLaunch,
            nextStartupCleanup,
            temporaryHelperSha256: oldHelper.sha256,
            newOwnedHelperSha256: newHelper.sha256,
          };
        });
      }
    }
    report.result = verifyPreparedOnly
      ? 'prepared-reverified-not-executed'
      : prepareOnly
        ? 'prepared-not-executed'
        : 'passed';
  } catch (error) {
    if (report.steps.at(-1)?.result !== 'failed') {
      report.failures++;
      report.steps.push({
        id: 'preflight-or-plan',
        result: 'failed',
        error: error.message,
      });
    }
    report.result = 'failed';
    report.error = error.message;
  } finally {
    const actualExecution = !prepareOnly && !verifyPreparedOnly && !compileOnly;
    if (actualExecution)
      await archiveDesktopLog('before-uninstall').catch((error) =>
        diagnosticFailure('desktop-log-before-uninstall', error),
      );
    if (installed) {
      try {
        await step('exact-fixture-uninstall-cleanup', async () => {
          const current = await registration();
          assert.ok(
            current && resolve(current.InstallLocation) === root,
            'Fixture registration changed; preserve it',
          );
          let activeNativeBeforeUninstall;
          if (activeUninstallOnly) {
            assert.ok(desktop, 'Active uninstall requires the actual old host');
            const child = desktop.process();
            assert.equal(
              child.exitCode,
              null,
              'Old host exited before uninstall',
            );
            assert.equal(
              child.signalCode,
              null,
              'Old host was terminated before uninstall',
            );
            activeNativeBeforeUninstall = {
              pid: child.pid,
              exitCode: child.exitCode,
              signalCode: child.signalCode,
              observedAtUtc: new Date().toISOString(),
            };
          }
          const result = await execute(
            join(root, 'unins000.exe'),
            [
              '/VERYSILENT',
              '/SUPPRESSMSGBOXES',
              '/NORESTART',
              '/LOG=' + join(evidence, 'uninstall-inno.log'),
            ],
            'exact-fixture-uninstall',
          );
          assert.equal(result.code, 0, result.log);
          assert.equal(await registration(), null);
          const nextStartupCleanup = report.steps.find(
            (entry) => entry.id === 'handoff-helper-and-data',
          )?.nextStartupCleanup;
          if (nextStartupCleanup) {
            const retained = {};
            for (const name of ['configuration', 'unknown', 'dataSentinel']) {
              const expected = nextStartupCleanup.preservation.before[name];
              retained[name] = await record(expected.path);
              assert.deepEqual(retained[name], expected);
            }
            assert.deepEqual(
              await preservedData(gamesDirectory),
              await json(nextStartupCleanup.preservation.games.snapshot.path),
            );
            nextStartupCleanup.uninstallPreservation = retained;
          }
          if (usesExternalData) {
            assert.equal(
              (await json(configurationPath)).dataDirectory,
              externalDataDirectory,
            );
            assert.deepEqual(
              await record(configurationPath),
              report.startupExternalData.configurationBefore,
            );
            assert.ok((await stat(externalDataDirectory)).isDirectory());
            assert.ok((await stat(gamesDirectory)).isDirectory());
            report.startupExternalData.configurationAfterUninstall =
              await record(configurationPath);
            report.startupExternalData.dataAndGamesRetained = true;
          }
          return {
            registrationRemoved: true,
            scope: root,
            ...(activeUninstallOnly ? { activeNativeBeforeUninstall } : {}),
          };
        });
      } catch (error) {
        report.result = 'failed';
        report.cleanupError = error.message;
      }
    }
    await newBrowser?.close().catch(() => {});
    if (desktop) {
      const child = desktop.process();
      try {
        await desktop.close();
        assert.equal(
          child.exitCode,
          0,
          'Actual old Native normal shutdown returned a nonzero exit code',
        );
      } catch (error) {
        report.desktopCleanupError = error.message;
        diagnosticFailure('old-native-normal-shutdown', error);
      } finally {
        report.nativeDiagnostics.oldNative.exitCode = child.exitCode;
        report.nativeDiagnostics.oldNative.signalCode = child.signalCode;
        report.nativeDiagnostics.oldNative.normalShutdownExpected = true;
      }
    }
    await oldNativeCapture?.().catch((error) =>
      diagnosticFailure('old-native-raw-streams', error),
    );
    if (restartedDesktop) {
      const child = restartedDesktop.process();
      try {
        await restartedDesktop.close();
        assert.equal(
          child.exitCode,
          0,
          'Independent same-version Native normal shutdown returned a nonzero exit code',
        );
      } catch (error) {
        report.restartDesktopCleanupError = error.message;
        diagnosticFailure('restart-native-normal-shutdown', error);
      } finally {
        report.nativeDiagnostics.restartNative.exitCode = child.exitCode;
        report.nativeDiagnostics.restartNative.signalCode = child.signalCode;
        report.nativeDiagnostics.restartNative.normalShutdownExpected = true;
      }
    }
    await restartNativeCapture?.().catch((error) =>
      diagnosticFailure('restart-native-raw-streams', error),
    );
    if (actualExecution)
      await archiveDesktopLog('final').catch((error) =>
        diagnosticFailure('desktop-log-final', error),
      );
    for (const [path, sha256] of Object.entries(report.sourceHashes))
      if (hash(await readFile(path)) !== sha256) {
        report.result = 'failed';
        report.sourceChanged = path;
      }
    report.finishedAtUtc = new Date().toISOString();
    report.toolSha256 = hash(await readFile(fileURLToPath(import.meta.url)));
    await writeJson(join(evidence, 'report.json'), report);
  }
  return report;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    value = (name) =>
      args
        .find((arg) => arg.startsWith('--' + name + '='))
        ?.slice(name.length + 3);
  for (const name of value('prepared-report')
    ? ['prepared-report', 'evidence']
    : ['native-template', 'server', 'web', 'evidence'])
    assert.ok(value(name), 'Required --' + name);
  const report = await verifyApplicationHandoff({
    nativeTemplate: value('native-template'),
    serverDirectory: value('server'),
    webDirectory: value('web'),
    evidence: value('evidence'),
    prepareOnly: args.includes('--prepare-only'),
    compileOnly: args.includes('--compile-only'),
    preparedReport: value('prepared-report'),
    verifyPreparedOnly: args.includes('--verify-prepared-only'),
    frameworkRecoveryOnly: args.includes('--framework-recovery-only'),
    activeUninstallOnly: args.includes('--active-uninstall-only'),
    shortExternalData: args.includes('--short-external-data'),
    longRootExternalData: args.includes('--long-root-external-data'),
  });
  console.log(
    JSON.stringify({
      result: report.result,
      failures: report.failures,
      report: join(value('evidence'), 'report.json'),
      work: report.work,
    }),
  );
  if (
    ![
      'passed',
      'prepared-not-executed',
      'prepared-reverified-not-executed',
      'native-compiled-not-executed',
    ].includes(report.result)
  )
    process.exitCode = 1;
}
