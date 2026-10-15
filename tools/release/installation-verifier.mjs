import {
  verifyPreservedRuntime,
  verifyResourceCleanup,
  noLinks,
  archiveInstallationLog,
  preserveVerifiedRuntime,
  installedProgramFootprint,
  storageObservation,
  databaseMembers,
} from './installation-evidence.mjs';
export {
  verifyPreservedRuntime,
  archiveInstallationLog,
  installedProgramFootprint,
} from './installation-evidence.mjs';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { launchDesktop } from '../test/support/desktop-test.mjs';
import {
  INSTALLATION_FIXTURE_ID,
  INSTALLATION_PRODUCT_ID,
  installationInventory,
} from './installation-package.mjs';
import { hash } from './installation-toolchain.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
import {
  materializeAcceptanceExecutable,
  resolveWindowsAcceptanceProfile,
} from '../shared/windows-acceptance-profile.mjs';

const run = promisify(execFile);
const powershellUtf8 =
  '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); ';
export function installationVerificationEnvironment(
  temporary,
  base = process.env,
) {
  return {
    ...base,
    TEMP: temporary,
    TMP: temporary,
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
    TABLEMAX_INSTALLATION_HEALTH_CHECK: '1',
  };
}

async function executionIdentity() {
  const result = await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      powershellUtf8 +
        '$user=[Security.Principal.WindowsIdentity]::GetCurrent(); $principal=[Security.Principal.WindowsPrincipal]::new($user); @{ownerSid=$user.User.Value;profile=[Environment]::GetFolderPath("UserProfile");elevated=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)} | ConvertTo-Json -Compress',
    ],
    { windowsHide: true, timeout: 15000 },
  );
  return JSON.parse(result.stdout.trim());
}

async function installedIdentity(root, manifest, delivery, ownerSid) {
  const identity = JSON.parse(
    await readFile(join(root, 'data/.install.json'), 'utf8'),
  );
  assert.equal(identity.productId, manifest.productId);
  assert.equal(identity.ownerSid, ownerSid);
  assert.equal(resolve(identity.root), resolve(root));
  assert.equal(resolve(identity.boxRoot), resolve(root, 'data'));
  assert.equal(identity.buildVersion, manifest.buildVersion);
  assert.equal(identity.payloadManifestSha256, manifest.payloadManifestSha256);
  assert.equal(identity.currentMappingSha256, manifest.currentMappingSha256);
  assert.deepEqual(identity.files, manifest.files);
  const receipt = JSON.parse(
    await readFile(join(root, 'data/.installer-receipt.json'), 'utf8'),
  );
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.productId, manifest.productId);
  assert.equal(receipt.installationId, identity.installationId);
  assert.equal(receipt.buildVersion, manifest.buildVersion);
  assert.equal(receipt.bytes, delivery.executable.bytes);
  assert.equal(receipt.sha256, delivery.executable.sha256);
  return identity;
}

function verifyRegistration(record, root, manifest, fixture) {
  assert.ok(record);
  assert.equal(
    record.DisplayName,
    fixture ? 'TableMax Installation Fixture' : 'TableMax',
  );
  assert.equal(record.DisplayVersion, manifest.buildVersion);
  assert.equal(resolve(record.InstallLocation), resolve(root));
  assert.equal(record.UninstallString, '"' + join(root, 'unins000.exe') + '"');
}

function verifyShortcuts(links, root) {
  assert.equal(links.length, 3);
  assert.equal(
    links.filter(
      (link) => resolve(link.target) === resolve(root, 'TableMax.exe'),
    ).length,
    2,
  );
  assert.equal(
    links.filter(
      (link) => resolve(link.target) === resolve(root, 'unins000.exe'),
    ).length,
    1,
  );
  for (const link of links) {
    assert.equal(resolve(link.workingDirectory), resolve(root));
    assert.equal(link.arguments, '');
  }
}
async function verificationParent() {
  const configured = process.env.TABLEMAX_INSTALLATION_VERIFY_TMP;
  const profile = await resolveWindowsAcceptanceProfile(configured);
  if (profile) return { parent: profile.workParent, profile };
  const parent = configured ? resolve(configured) : resolve('tmp');
  if (configured) {
    assert.equal(dirname(parent), resolve('tmp'));
    assert.match(
      parent.slice(resolve('tmp').length + 1),
      /^installation-user-[a-f0-9]{32}$/,
    );
    for (let path = parent; ; path = dirname(path)) {
      assert.ok(
        !(await lstat(path)).isSymbolicLink(),
        'Installation test parent contains a link',
      );
      if (dirname(path) === path) break;
    }
  } else await mkdir(parent, { recursive: true });
  return { parent, profile: null };
}

async function registration(productId) {
  const result = await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      powershellUtf8 +
        '$ErrorActionPreference="Stop"; $key="HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\"+$env:TABLEMAX_VERIFIER_PRODUCT+"_is1"; if(Test-Path -LiteralPath $key){Get-ItemProperty -LiteralPath $key | Select-Object DisplayName,DisplayVersion,InstallLocation,UninstallString | ConvertTo-Json -Compress}else{"null"}',
    ],
    {
      windowsHide: true,
      timeout: 15000,
      env: { ...process.env, TABLEMAX_VERIFIER_PRODUCT: productId },
    },
  );
  return JSON.parse(result.stdout.trim());
}
async function shortcuts(root, fixture) {
  const result = await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      powershellUtf8 +
        '$ErrorActionPreference="Stop"; if($env:TABLEMAX_VERIFIER_FIXTURE -eq "1"){$name="TableMax Installation Fixture";$programs=Join-Path $env:TABLEMAX_VERIFIER_ROOT "fixture-shortcuts\\Start";$desktop=Join-Path $env:TABLEMAX_VERIFIER_ROOT "fixture-shortcuts\\Desktop"}else{$name="TableMax";$programs=Join-Path ([Environment]::GetFolderPath("Programs")) $name;$desktop=[Environment]::GetFolderPath("DesktopDirectory")}; $paths=@((Join-Path $programs ($name+".lnk")),(Join-Path $programs ("卸载 "+$name+".lnk")),(Join-Path $desktop ($name+".lnk"))); $shell=New-Object -ComObject WScript.Shell; @($paths | ForEach-Object { if(-not(Test-Path -LiteralPath $_ -PathType Leaf)){throw "Expected exact shortcut missing"}; $link=$shell.CreateShortcut($_); @{path=$_;target=$link.TargetPath;arguments=$link.Arguments;workingDirectory=$link.WorkingDirectory} }) | ConvertTo-Json -Compress',
    ],
    {
      windowsHide: true,
      timeout: 15000,
      env: {
        ...process.env,
        TABLEMAX_VERIFIER_ROOT: root,
        TABLEMAX_VERIFIER_FIXTURE: fixture ? '1' : '0',
      },
    },
  );
  const text = result.stdout.trim();
  return text ? JSON.parse(text) : [];
}

const samePath = (left, right) =>
  resolve(left).toLowerCase() === resolve(right).toLowerCase();

async function protectedDatabases(boxRoot) {
  const files = [];
  for (const path of databaseMembers) {
    const absolute = join(boxRoot, path);
    const entry = await lstat(absolute).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!entry) continue;
    await noLinks(absolute);
    assert.ok(entry.isFile(), 'A protected database member is not a file');
    const bytes = await readFile(absolute);
    files.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  for (const path of ['foundation.sqlite', 'room.sqlite'])
    assert.ok(files.some((file) => file.path === path));
  return files;
}

async function waitForInstalledIdle(root, environment) {
  const windows = process.env.SystemRoot ?? process.env.WINDIR;
  assert.match(windows ?? '', /^[a-z]:[\\/]/i);
  const key = hash(Buffer.from(resolve(root).toLowerCase(), 'utf8'));
  await run(
    join(windows, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      powershellUtf8 +
        '$ErrorActionPreference="Stop";$mutex=$null;$held=$false;try{try{$mutex=[Threading.Mutex]::OpenExisting("Global\\TableMax-Installation-Run-"+$env:TABLEMAX_VERIFIER_RUN_KEY)}catch [Threading.WaitHandleCannotBeOpenedException]{};if($mutex){try{$held=$mutex.WaitOne(30000)}catch [Threading.AbandonedMutexException]{$held=$true};if(-not $held){throw "The exact installed run lock did not become idle"}}}finally{if($held){$mutex.ReleaseMutex()};if($mutex){$mutex.Dispose()}}; exit 0',
    ],
    {
      windowsHide: true,
      timeout: 35000,
      env: {
        ...environment,
        TABLEMAX_VERIFIER_RUN_KEY: key,
        PSModulePath: join(windows, 'System32/WindowsPowerShell/v1.0/Modules'),
      },
    },
  );
}

async function waitForUninstallerCleanup(executable, log, environment) {
  const started = Date.now();
  const deadline = started + 10000;
  while (true) {
    const entry = await lstat(executable).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!entry) break;
    assert.ok(entry.isFile() && !entry.isSymbolicLink());
    assert.ok(
      Date.now() < deadline,
      'Inno original uninstaller was not removed within its cleanup budget',
    );
    await new Promise((done) => setTimeout(done, 100));
  }
  const windows = process.env.SystemRoot ?? process.env.WINDIR;
  assert.match(windows ?? '', /^[a-z]:[\\/]/i);
  await run(
    join(windows, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      powershellUtf8 +
        '$ErrorActionPreference="Stop";$deadline=[DateTime]::UtcNow.AddSeconds(10);while($true){try{$stream=[IO.File]::Open($env:TABLEMAX_VERIFIER_UNINSTALL_LOG,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None);$stream.Dispose();break}catch [IO.IOException]{$code=$_.Exception.GetBaseException().HResult -band 65535;if(($code -ne 32 -and $code -ne 33) -or [DateTime]::UtcNow -ge $deadline){throw};Start-Sleep -Milliseconds 100}};exit 0',
    ],
    {
      windowsHide: true,
      timeout: 15000,
      env: {
        ...environment,
        TABLEMAX_VERIFIER_UNINSTALL_LOG: log,
        PSModulePath: join(windows, 'System32/WindowsPowerShell/v1.0/Modules'),
      },
    },
  );
  return {
    result: 'passed',
    originalExecutableAbsent: true,
    logClosedObserved: true,
    durationMs: Date.now() - started,
    boundary:
      'Observed exact original uninstaller removal and exclusive log readability after the outer first phase exited; no uninstall retry or file deletion by the verifier.',
  };
}

async function servicePost(origin, route, body) {
  const address = new URL(origin);
  assert.equal(address.protocol, 'http:');
  assert.equal(address.hostname, '127.0.0.1');
  const response = await fetch(origin + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  assert.equal(
    response.ok,
    true,
    'The actual saved-data HTTP operation failed',
  );
  assert.equal(value.ok, true, 'The actual saved-data operation was rejected');
  return value;
}

async function observeSavedPlayer({ root, environment, buildVersion, saved }) {
  await waitForInstalledIdle(root, environment);
  const boxRoot = join(root, 'data');
  const desktop = await launchDesktop({
    executablePath: join(boxRoot, 'app/TableMax.exe'),
    timeout: 180000,
    env: {
      ...environment,
      TABLEMAX_BOX_DIRECTORY: boxRoot,
      TABLEMAX_AUTO_MAINTENANCE: '0',
      TABLEMAX_TEST_MAINTENANCE: '0',
    },
  });
  let result;
  try {
    const runtime = await desktop.request('runtime');
    assert.equal(runtime.appVersion, buildVersion);
    const storage = await desktop.request('storage.info');
    assert.ok(samePath(storage.active, boxRoot));
    if (!saved) {
      const page = await desktop.firstWindow();
      await page.waitForFunction(
        () => Boolean(sessionStorage.getItem('tablemax-host')),
        null,
        { timeout: 15000 },
      );
      const hostToken = await page.evaluate(() =>
        sessionStorage.getItem('tablemax-host'),
      );
      assert.ok(hostToken, 'The actual installed host must authenticate');
      let view = (
        await servicePost(runtime.origin, '/api/session/view', {
          token: hostToken,
        })
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
              () => reject(new Error('Saved-data host socket timed out')),
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
          assert.equal(reply.ok, true);
        } finally {
          socket.disconnect();
        }
      }
      const joined = await servicePost(runtime.origin, '/api/session/join', {
        name: '卸载重装保留的隔离玩家',
      });
      assert.equal(typeof joined.token, 'string');
      view = (
        await servicePost(runtime.origin, '/api/session/view', {
          token: joined.token,
        })
      ).view;
      assert.equal(view.status, 'lobby');
      assert.ok(view.self?.seatId && view.game?.releaseRef);
      saved = {
        token: joined.token,
        public: {
          instanceId: view.instanceId,
          seatId: view.self.seatId,
          releaseRef: view.game.releaseRef,
          status: view.status,
        },
      };
    } else {
      const view = (
        await servicePost(runtime.origin, '/api/session/view', {
          token: saved.token,
        })
      ).view;
      assert.deepEqual(
        {
          instanceId: view.instanceId,
          seatId: view.self?.seatId,
          releaseRef: view.game?.releaseRef,
          status: view.status,
        },
        saved.public,
        'The real reinstalled service must reopen the original saved identity',
      );
    }
    result = {
      saved,
      observation: {
        desktopPid: runtime.desktopPid,
        servicePid: runtime.servicePid,
        appVersion: runtime.appVersion,
        dataDirectory: storage.active,
        publicState: saved.public,
      },
    };
  } finally {
    const child = desktop.process();
    await desktop.close();
    assert.equal(child.exitCode, 0, 'Saved-data Native must close normally');
    assert.equal(child.signalCode, null);
    if (result) result.observation.exitCode = child.exitCode;
  }
  return result;
}

/** Mutating installer verification only uses an isolated test product by default. */
export async function verifyInstallationDelivery({
  delivery,
  evidencePath,
  isolatedWindows = false,
  keepInstalled = false,
}) {
  assertWorkspaceRoot();
  process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
  process.env.TABLEMAX_TEST_MAINTENANCE = '0';
  assert.equal(delivery.deliveryType, 'installer');
  const installation = delivery.executable.installation;
  const environment = await executionIdentity();
  assert.equal(
    environment.elevated,
    false,
    'Installer acceptance must use a standard token',
  );
  const payloadBytes = await readFile(delivery.manifestPath),
    payload = JSON.parse(payloadBytes.toString('utf8'));
  const manifest = JSON.parse(
    await readFile(installation.manifestPath, 'utf8'),
  );
  const fixture = manifest.productId === INSTALLATION_FIXTURE_ID;
  assert.ok(
    fixture ||
      (manifest.productId === INSTALLATION_PRODUCT_ID &&
        isolatedWindows &&
        process.env.TABLEMAX_ISOLATED_WINDOWS_ACCEPTANCE === '1'),
    'Production identity acceptance requires an explicitly isolated Windows environment',
  );
  assert.equal(
    await registration(manifest.productId),
    null,
    'Existing product registration must be preserved',
  );
  assert.equal(
    hash(await readFile(delivery.executable.path)),
    delivery.executable.sha256,
  );
  assert.equal(
    hash(await readFile(installation.manifestPath)),
    installation.manifestSha256,
  );
  assert.equal(hash(payloadBytes), manifest.payloadManifestSha256);
  assert.equal(payload.archive.sha256, delivery.executable.payloadSha256);
  assert.equal(manifest.productId, installation.productId);
  if (delivery.candidatePath || delivery.candidateSha256) {
    assert.ok(
      typeof delivery.candidatePath === 'string' &&
        delivery.candidatePath.startsWith('artifacts/package-payloads/') &&
        !delivery.candidatePath.includes('\\') &&
        !delivery.candidatePath.includes(':') &&
        !delivery.candidatePath
          .split('/')
          .some((part) => !part || part === '.' || part === '..'),
      'Candidate record must remain inside the workspace payload area',
    );
    assert.match(delivery.candidateSha256, /^[a-f0-9]{64}$/);
    assert.equal(
      hash(await readFile(delivery.candidatePath)),
      delivery.candidateSha256,
      'Frozen candidate record changed',
    );
  }
  assert.equal(manifest.releaseVersion, payload.version);
  assert.equal(manifest.buildVersion, payload.buildVersion);
  if (delivery.version !== undefined)
    assert.equal(manifest.releaseVersion, delivery.version);
  if (delivery.buildVersion !== undefined)
    assert.equal(manifest.buildVersion, delivery.buildVersion);
  const { parent, profile } = await verificationParent();
  if (profile) {
    assert.equal(profile.ownerSid, environment.ownerSid);
    assert.equal(resolve(profile.profile), resolve(environment.profile));
    assert.ok(
      !keepInstalled,
      'Profile acceptance must complete default uninstall',
    );
  }
  evidencePath = resolve(evidencePath);
  assert.ok(
    evidencePath.startsWith(resolve('artifacts/maintenance') + sep),
    'Installation evidence must remain in workspace maintenance',
  );
  await noLinks(evidencePath);
  await assert.rejects(lstat(evidencePath), { code: 'ENOENT' });
  await mkdir(dirname(evidencePath), { recursive: true });
  const logDirectory = join(dirname(evidencePath), 'installer-logs');
  await mkdir(logDirectory, { recursive: false });
  const logEvidencePath = join(logDirectory, 'index.json');
  const logEvidence = {};
  const work = await mkdtemp(join(parent, 'installation-verify-'));
  let executionCopy = null;
  if (profile) {
    const inputDirectory = join(work, 'input');
    await mkdir(inputDirectory);
    executionCopy = await materializeAcceptanceExecutable({
      source: delivery.executable.path,
      expected: {
        bytes: delivery.executable.bytes,
        sha256: delivery.executable.sha256,
      },
      profile,
      directory: inputDirectory,
      name: basename(delivery.executable.path),
    });
    assert.equal(
      resolve(executionCopy.sourcePath),
      resolve(delivery.executable.path),
    );
    assert.equal(executionCopy.bytes, delivery.executable.bytes);
    assert.equal(executionCopy.sha256, delivery.executable.sha256);
  }
  const executablePath = executionCopy?.path ?? delivery.executable.path;
  const root = join(work, '程序 目录');
  await mkdir(root);
  // Inno extracts 64-character blob names through ordinary Win32 paths.
  // Keep this owned TEMP beside the private work directory's other cases,
  // rather than nesting it inside this verifier's longer case path.
  const installerTemporary = profile
    ? await mkdtemp(join(profile.workParent, 'it-'))
    : join(work, 'installer-temporary');
  if (!profile) await mkdir(installerTemporary);
  const childEnvironment =
    installationVerificationEnvironment(installerTemporary);
  const unknown = join(root, '朋友资料.txt');
  await writeFile(unknown, 'Preserved unrelated original\n');
  const originalHash = hash(await readFile(unknown));
  const logs = {
    install: join(work, 'install.log'),
    reinstall: join(work, 'reinstall.log'),
    uninstall: join(work, 'uninstall.log'),
    'restore-install': join(work, 'restore-install.log'),
    'restore-uninstall': join(work, 'restore-uninstall.log'),
  };
  const writeLogIndex = async () =>
    writeFile(
      logEvidencePath,
      JSON.stringify(
        {
          schemaVersion: 1,
          installerSha256: delivery.executable.sha256,
          sourceExecutable: delivery.executable.path,
          executionCopy,
          ...(profile ? { executionProfile: profile } : {}),
          logs: logEvidence,
        },
        null,
        2,
      ) + '\n',
    );
  await writeLogIndex();
  const runPhase = async (phase, executable, args, options) => {
    let failure;
    let result;
    let completionObservation;
    let observationFailure;
    try {
      result = await run(executable, args, options);
    } catch (cause) {
      failure = cause;
    }
    if (!failure && ['uninstall', 'restore-uninstall'].includes(phase)) {
      try {
        completionObservation = await waitForUninstallerCleanup(
          executable,
          logs[phase],
          options.env,
        );
      } catch (cause) {
        observationFailure = cause;
        completionObservation = { result: 'failed', message: cause.message };
      }
    }
    try {
      logEvidence[phase] = {
        ...(await archiveInstallationLog({
          source: logs[phase],
          directory: logDirectory,
          name: phase + '.log',
        })),
        process: failure
          ? {
              result: 'failed',
              code: failure.code ?? null,
              signal: failure.signal ?? null,
              message: failure.message,
            }
          : { result: 'exited', code: 0 },
        ...(completionObservation ? { completionObservation } : {}),
      };
      await writeLogIndex();
    } catch (cause) {
      if (failure)
        throw new AggregateError(
          [failure, cause],
          'Installer phase failed and its log could not be preserved',
          { cause },
        );
      throw cause;
    }
    if (failure) throw failure;
    if (observationFailure) throw observationFailure;
    assert.ok(
      !logEvidence[phase].missing,
      'Successful installer log is missing',
    );
    return result;
  };
  const started = performance.now();
  const argumentsFor = (log) => [
    '/VERYSILENT',
    '/SUPPRESSMSGBOXES',
    '/NORESTART',
    '/DIR=' + root,
    '/LOG=' + log,
  ];
  await runPhase('install', executablePath, argumentsFor(logs.install), {
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 1024 * 1024,
    env: childEnvironment,
  });
  await waitForInstalledIdle(root, childEnvironment);
  const firstRegistration = await registration(manifest.productId);
  verifyRegistration(firstRegistration, root, manifest, fixture);
  const identity = await installedIdentity(
    root,
    manifest,
    delivery,
    environment.ownerSid,
  );
  assert.equal(hash(await readFile(unknown)), originalHash);
  const footprint = await installedProgramFootprint(root, manifest);
  const links = await shortcuts(root, fixture);
  verifyShortcuts(links, root);
  const capacityObservedAtUtc = new Date().toISOString();
  const storageObservations = [];
  const observeStorage = async (phase) => {
    storageObservations.push(
      await storageObservation({
        root,
        temporary: installerTemporary,
        executablePath,
        manifest,
        currentGames: footprint.games,
        phase,
      }),
    );
  };
  await observeStorage('after-install');
  const preserved = join(root, 'data', '用户资料.txt');
  await writeFile(preserved, 'Preserved user data\n');
  const preservedHash = hash(await readFile(preserved));
  await runPhase('reinstall', executablePath, argumentsFor(logs.reinstall), {
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 1024 * 1024,
    env: childEnvironment,
  });
  await waitForInstalledIdle(root, childEnvironment);
  const restarted = await installedIdentity(
    root,
    manifest,
    delivery,
    environment.ownerSid,
  );
  assert.equal(restarted.installationId, identity.installationId);
  const repeatFootprint = await installedProgramFootprint(root, manifest);
  assert.deepEqual(repeatFootprint.games, footprint.games);
  assert.equal(
    hash(await readFile(join(root, 'data/TableMax.config.json'))),
    footprint.metadata.find((file) => file.path === 'data/TableMax.config.json')
      .sha256,
  );
  const repeatRegistration = await registration(manifest.productId);
  verifyRegistration(repeatRegistration, root, manifest, fixture);
  const repeatLinks = await shortcuts(root, fixture);
  verifyShortcuts(repeatLinks, root);
  assert.deepEqual(repeatLinks, links);
  assert.equal(hash(await readFile(preserved)), preservedHash);
  assert.equal(hash(await readFile(unknown)), originalHash);
  await observeStorage('after-repeat-install');
  let uninstalled = false;
  let verifiedRuntime;
  let postUninstallReinstall;
  if (!keepInstalled) {
    const savedPlayer = await observeSavedPlayer({
      root,
      environment: childEnvironment,
      buildVersion: manifest.buildVersion,
    });
    assert.deepEqual(
      await installationInventory(join(root, 'data/games')),
      footprint.games,
      'The first-start current game repository must already include the saved game',
    );
    const firstDatabasesBefore = await protectedDatabases(join(root, 'data'));
    await observeStorage('before-first-uninstall');
    await mkdir(dirnameFor(evidencePath), { recursive: true });
    verifiedRuntime = await preserveVerifiedRuntime({
      root,
      delivery,
      evidencePath,
      installationId: identity.installationId,
    });
    await runPhase(
      'uninstall',
      join(root, 'unins000.exe'),
      [
        '/VERYSILENT',
        '/SUPPRESSMSGBOXES',
        '/NORESTART',
        '/LOG=' + logs.uninstall,
      ],
      {
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
        env: childEnvironment,
      },
    );
    assert.equal(await registration(manifest.productId), null);
    for (const link of links)
      await assert.rejects(stat(link.path), { code: 'ENOENT' });
    assert.equal(hash(await readFile(preserved)), preservedHash);
    assert.equal(hash(await readFile(unknown)), originalHash);
    for (const file of [
      ...manifest.files,
      ...repeatFootprint.framework,
      { path: 'data/.install.json' },
    ])
      await assert.rejects(stat(join(root, file.path)), { code: 'ENOENT' });
    assert.equal(
      hash(await readFile(join(root, 'data/TableMax.config.json'))),
      footprint.metadata.find(
        (file) => file.path === 'data/TableMax.config.json',
      ).sha256,
    );
    const firstResourceCleanup = await verifyResourceCleanup({
      root,
      identity,
      before: footprint.games,
      directory: dirnameFor(evidencePath),
      name: 'first-uninstall-resources.json',
    });
    const firstDatabasesAfter = await protectedDatabases(join(root, 'data'));
    assert.deepEqual(firstDatabasesAfter, firstDatabasesBefore);
    await verifyPreservedRuntime({
      copy: verifiedRuntime,
      delivery,
      payloadBytes,
      sourceRuntimeRoot: join(root, 'data/app'),
      installationId: identity.installationId,
    });
    await observeStorage('after-first-uninstall');
    await runPhase(
      'restore-install',
      executablePath,
      argumentsFor(logs['restore-install']),
      {
        windowsHide: true,
        timeout: 180000,
        maxBuffer: 1024 * 1024,
        env: childEnvironment,
      },
    );
    await waitForInstalledIdle(root, childEnvironment);
    const restored = await installedIdentity(
      root,
      manifest,
      delivery,
      environment.ownerSid,
    );
    const restoredRegistration = await registration(manifest.productId);
    verifyRegistration(restoredRegistration, root, manifest, fixture);
    const restoredFootprint = await installedProgramFootprint(root, manifest);
    assert.deepEqual(restoredFootprint.games, footprint.games);
    const restoredLinks = await shortcuts(root, fixture);
    verifyShortcuts(restoredLinks, root);
    assert.deepEqual(restoredLinks, links);
    assert.equal(hash(await readFile(preserved)), preservedHash);
    assert.equal(hash(await readFile(unknown)), originalHash);
    assert.equal(
      hash(await readFile(join(root, 'data/TableMax.config.json'))),
      footprint.metadata.find(
        (file) => file.path === 'data/TableMax.config.json',
      ).sha256,
    );
    await observeStorage('after-restored-install');
    const restoredPlayer = await observeSavedPlayer({
      root,
      environment: childEnvironment,
      buildVersion: manifest.buildVersion,
      saved: savedPlayer.saved,
    });
    assert.deepEqual(
      restoredPlayer.observation.publicState,
      savedPlayer.observation.publicState,
    );
    const finalDatabasesBefore = await protectedDatabases(join(root, 'data'));
    await observeStorage('before-final-uninstall');
    await runPhase(
      'restore-uninstall',
      join(root, 'unins000.exe'),
      [
        '/VERYSILENT',
        '/SUPPRESSMSGBOXES',
        '/NORESTART',
        '/LOG=' + logs['restore-uninstall'],
      ],
      {
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
        env: childEnvironment,
      },
    );
    assert.equal(await registration(manifest.productId), null);
    for (const link of restoredLinks)
      await assert.rejects(stat(link.path), { code: 'ENOENT' });
    for (const file of [
      ...manifest.files,
      ...restoredFootprint.framework,
      { path: 'data/.install.json' },
    ])
      await assert.rejects(stat(join(root, file.path)), { code: 'ENOENT' });
    assert.equal(hash(await readFile(preserved)), preservedHash);
    assert.equal(hash(await readFile(unknown)), originalHash);
    assert.equal(
      hash(await readFile(join(root, 'data/TableMax.config.json'))),
      footprint.metadata.find(
        (file) => file.path === 'data/TableMax.config.json',
      ).sha256,
    );
    const finalResourceCleanup = await verifyResourceCleanup({
      root,
      identity: restored,
      before: restoredFootprint.games,
      directory: dirnameFor(evidencePath),
      name: 'final-uninstall-resources.json',
    });
    const finalDatabasesAfter = await protectedDatabases(join(root, 'data'));
    assert.deepEqual(finalDatabasesAfter, finalDatabasesBefore);
    await verifyPreservedRuntime({
      copy: verifiedRuntime,
      delivery,
      payloadBytes,
      sourceRuntimeRoot: join(root, 'data/app'),
      installationId: identity.installationId,
    });
    await observeStorage('after-final-uninstall');
    postUninstallReinstall = {
      result: 'passed',
      actualInstaller: true,
      sameRoot: true,
      sameInstaller: true,
      firstUninstalled: true,
      finalUninstalled: true,
      defaultUninstall: true,
      root,
      ownerSid: identity.ownerSid,
      installerSha256: delivery.executable.sha256,
      buildVersion: manifest.buildVersion,
      originalInstallationId: identity.installationId,
      installationId: restored.installationId,
      initialNative: savedPlayer.observation,
      restoredNative: restoredPlayer.observation,
      gameResourceCleanup: {
        firstUninstall: firstResourceCleanup,
        finalUninstall: finalResourceCleanup,
      },
      databases: {
        firstUninstall: {
          before: firstDatabasesBefore,
          after: firstDatabasesAfter,
        },
        finalUninstall: {
          before: finalDatabasesBefore,
          after: finalDatabasesAfter,
        },
      },
      registration: restoredRegistration,
      shortcuts: restoredLinks,
      footprint: restoredFootprint,
      boundary:
        'Real same-installer reinstall after default uninstall, actual local saved player restored by Native/Node, then default uninstall again. Tokens remain only in memory. Installation identity may change; saved room/player/release identity must not. The one retained runtime remains bound to the first actual installation.',
    };
    uninstalled = true;
  }
  const record = {
    result: 'passed',
    deliveryType: 'installer',
    fixture,
    isolatedWindows,
    version: manifest.releaseVersion,
    buildVersion: manifest.buildVersion,
    edition: 'full',
    snapshot: delivery.snapshot,
    executableSha256: delivery.executable.sha256,
    executableBytes: delivery.executable.bytes,
    installerSha256: delivery.executable.sha256,
    ...(executionCopy ? { executionCopy, executionProfile: profile } : {}),
    payloadSha256: delivery.executable.payloadSha256,
    installationManifestSha256: installation.manifestSha256,
    ...(delivery.candidateSha256
      ? { candidateSha256: delivery.candidateSha256 }
      : {}),
    installRoot: root,
    boxRoot: join(root, 'data'),
    runtimeRoot: join(root, 'data/app'),
    extracted: join(root, 'data/app'),
    installationId: identity.installationId,
    ownerSid: identity.ownerSid,
    environment,
    productId: manifest.productId,
    firstStartupBytes: footprint.total,
    footprint,
    capacityAccounting: {
      schemaVersion: 1,
      observation: 'installer-returned-after-health-startup',
      observedAtUtc: capacityObservedAtUtc,
      preStartupSampled: false,
      sameSample: true,
      firstInstallationProgramBytes:
        footprint.programBytes +
        footprint.frameworkBytes +
        footprint.identityBytes,
      firstStartupMaterializedGamesBytes: footprint.currentGamesBytes,
      firstStartupTotalBytes: footprint.total,
      boundary:
        'Inno commit starts and confirms Native before the installer returns. Installation members/framework/metadata and current materialized games are separate measured subtotals from the same first completed-installer sample, not separate pre-start and post-start time samples.',
    },
    observedStorage: {
      schemaVersion: 1,
      samples: storageObservations,
      maxObservedBytes: Math.max(
        ...storageObservations.map((sample) => sample.totalObservedBytes),
      ),
      isAbsolutePeak: false,
      boundary:
        'Logical byte inventories of this private installation root, dedicated installer TEMP and exact outer execution copy at the recorded completed phases only. The maximum is an observed lower bound, not an absolute or continuously sampled staging peak. No unrelated profile or external user directory is traversed.',
    },
    registration: firstRegistration,
    reinstall: {
      result: 'passed',
      registration: repeatRegistration,
      shortcuts: repeatLinks,
      footprint: repeatFootprint,
    },
    shortcuts: links,
    uninstalled,
    ...(postUninstallReinstall ? { postUninstallReinstall } : {}),
    ...(verifiedRuntime
      ? { verifiedRuntimeRoot: verifiedRuntime.path, verifiedRuntime }
      : {}),
    logs: Object.fromEntries(
      Object.entries(logEvidence).map(([phase, log]) => [phase, log.path]),
    ),
    logEvidence,
    logEvidencePath,
    checks: [
      'actual installer healthy commit',
      'all managed bytes and exact app file set',
      'owner SID and installer receipt',
      'complete first startup program footprint',
      'exact registry and three default shortcuts',
      'same-installer same-root repeat preserves identity/config/games/unknown bytes',
      ...(uninstalled
        ? [
            'all managed and framework files removed',
            'registry and exact shortcuts removed',
            'config/current games/unknown bytes retained',
            'exact preserved runtime verified after uninstall',
            'actual same-root reinstall reopens the real retained saved player and release',
            'second default uninstall preserves exact idle database groups and final data',
          ]
        : []),
    ],
    durationMs: Math.round(performance.now() - started),
    boundary: fixture
      ? 'Actual Inno installer/helper/healthy native/full payload with distinct test product and private shortcut roots; not production identity/UAC/interactive acceptance.'
      : 'Explicit isolated Windows production identity; actual silent installer chain. Interactive wizard/security experience recorded separately.',
  };
  await mkdir(dirnameFor(evidencePath), { recursive: true });
  await writeFile(evidencePath, JSON.stringify(record, null, 2) + '\n');
  return record;
}
function dirnameFor(path) {
  return resolve(path, '..');
}

if (isDirectExecution(import.meta.url)) {
  const args = process.argv.slice(2),
    value = (name) =>
      args
        .find((arg) => arg.startsWith('--' + name + '='))
        ?.slice(name.length + 3);
  assert.ok(value('delivery') && value('evidence'));
  const delivery = JSON.parse(await readFile(value('delivery'), 'utf8'));
  console.log(
    JSON.stringify(
      await verifyInstallationDelivery({
        delivery,
        evidencePath: resolve(value('evidence')),
        isolatedWindows: args.includes('--isolated-windows'),
        keepInstalled: args.includes('--keep-installed'),
      }),
    ),
  );
}
