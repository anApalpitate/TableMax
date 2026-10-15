import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import {
  INSTALLATION_FIXTURE_ID,
  INSTALLATION_PRODUCT_ID,
  installationInventory,
} from './installation-package.mjs';
import { hash } from './installation-toolchain.mjs';
import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from './package-limits.mjs';
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

export async function verifyPreservedRuntime({
  copy,
  delivery,
  payloadBytes,
  sourceRuntimeRoot,
  installationId,
}) {
  const payload = JSON.parse(payloadBytes.toString('utf8'));
  const members = [
    ...payload.files,
    {
      path: '.tablemax-release.json',
      bytes: payloadBytes.length,
      sha256: hash(payloadBytes),
    },
  ].sort((a, b) => a.path.localeCompare(b.path));
  assert.equal(copy.sourceRuntimeRoot, sourceRuntimeRoot);
  assert.equal(copy.installationId, installationId);
  assert.equal(copy.executableSha256, delivery.executable.sha256);
  assert.equal(copy.payloadSha256, delivery.executable.payloadSha256);
  assert.equal(copy.payloadManifestSha256, hash(payloadBytes));
  assert.equal(copy.fileCount, members.length);
  assert.deepEqual(copy.files, members);
  assert.deepEqual(
    await installationInventory(copy.path),
    members,
    'Retained runtime must remain the exact frozen payload plus marker after uninstall',
  );
}

async function installedIdentity(root, manifest, delivery, ownerSid) {
  const identity = JSON.parse(
    await readFile(join(root, 'TableMax/.install.json'), 'utf8'),
  );
  assert.equal(identity.productId, manifest.productId);
  assert.equal(identity.ownerSid, ownerSid);
  assert.equal(resolve(identity.root), resolve(root));
  assert.equal(resolve(identity.boxRoot), resolve(root, 'TableMax'));
  assert.equal(identity.buildVersion, manifest.buildVersion);
  assert.equal(identity.payloadManifestSha256, manifest.payloadManifestSha256);
  assert.equal(identity.currentMappingSha256, manifest.currentMappingSha256);
  assert.deepEqual(identity.files, manifest.files);
  const receipt = JSON.parse(
    await readFile(join(root, 'TableMax/.installer-receipt.json'), 'utf8'),
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

async function noLinks(path) {
  for (let cursor = resolve(path); ; cursor = dirname(cursor)) {
    try {
      assert.ok(
        !(await lstat(cursor)).isSymbolicLink(),
        'Evidence contains a link',
      );
    } catch (cause) {
      if (cause.code !== 'ENOENT') throw cause;
    }
    if (dirname(cursor) === cursor) break;
  }
}

export async function archiveInstallationLog({ source, directory, name }) {
  assert.match(name, /^(install|reinstall|uninstall)\.log$/);
  let entry;
  try {
    entry = await lstat(source);
  } catch (cause) {
    if (cause.code === 'ENOENT')
      return { sourcePath: resolve(source), missing: true };
    throw cause;
  }
  assert.ok(
    entry.isFile() && !entry.isSymbolicLink(),
    'Installer log is not a regular file',
  );
  await noLinks(source);
  await noLinks(directory);
  const bytes = await readFile(source);
  const path = join(directory, name);
  await writeFile(path, bytes, { flag: 'wx' });
  assert.equal(hash(await readFile(path)), hash(bytes));
  return {
    sourcePath: resolve(source),
    path,
    bytes: bytes.length,
    sha256: hash(bytes),
  };
}
async function preserveVerifiedRuntime({
  root,
  delivery,
  evidencePath,
  installationId,
}) {
  const payloadBytes = await readFile(delivery.manifestPath),
    payload = JSON.parse(payloadBytes.toString('utf8'));
  const source = join(root, 'TableMax/app');
  const destination = resolve(dirname(evidencePath), 'verified-runtime');
  assert.ok(destination.startsWith(resolve(dirname(evidencePath)) + sep));
  await mkdir(destination, { recursive: false });
  const records = [];
  for (const file of [
    ...payload.files,
    {
      path: '.tablemax-release.json',
      bytes: payloadBytes.length,
      sha256: hash(payloadBytes),
    },
  ]) {
    const input = join(source, file.path),
      output = join(destination, file.path);
    assert.equal((await stat(input)).size, file.bytes);
    assert.equal(hash(await readFile(input)), file.sha256);
    await mkdir(dirname(output), { recursive: true });
    await copyFile(input, output);
    assert.equal(hash(await readFile(output)), file.sha256);
    records.push(file);
  }
  assert.deepEqual(
    await installationInventory(destination),
    records.sort((a, b) => a.path.localeCompare(b.path)),
  );
  return {
    path: destination,
    files: records,
    fileCount: records.length,
    executableSha256: delivery.executable.sha256,
    payloadSha256: payload.archive.sha256,
    payloadManifestSha256: hash(await readFile(delivery.manifestPath)),
    installationId,
    sourceRuntimeRoot: source,
    boundary:
      'Exact payload members and ownership marker copied from the real verified installation before uninstall; component input only, does not repeat installer/registry/updater acceptance.',
  };
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
export async function installedProgramFootprint(root, manifest) {
  const declared = [];
  for (const file of manifest.files) {
    const path = join(root, file.path);
    assert.equal((await stat(path)).size, file.bytes);
    assert.equal(hash(await readFile(path)), file.sha256, file.path);
    declared.push(file);
  }
  assert.deepEqual(
    await installationInventory(join(root, 'TableMax/app')),
    manifest.files
      .filter((file) => file.path.startsWith('TableMax/app/'))
      .map((file) => ({
        ...file,
        path: file.path.slice('TableMax/app/'.length),
      })),
    'Fresh app must contain exactly the managed payload and marker',
  );
  const framework = [];
  for (const name of await readdir(root))
    if (/^unins\d+\.(exe|dat|msg)$/i.test(name)) {
      const path = join(root, name);
      framework.push({
        path: name,
        bytes: (await stat(path)).size,
        sha256: hash(await readFile(path)),
      });
    }
  assert.ok(
    framework.some((file) => file.path.endsWith('.exe')) &&
      framework.some((file) => file.path.endsWith('.dat')),
    'Framework uninstaller and registration log required',
  );
  const metadata = await Promise.all(
    [
      'TableMax/.install.json',
      'TableMax/.installer-receipt.json',
      'TableMax/TableMax.config.json',
    ].map(async (path) => ({
      path,
      bytes: (await stat(join(root, path))).size,
      sha256: hash(await readFile(join(root, path))),
    })),
  );
  const identityBytes = metadata.reduce((sum, file) => sum + file.bytes, 0);
  const games = await installationInventory(join(root, 'TableMax/games'));
  const programBytes = declared.reduce((sum, file) => sum + file.bytes, 0),
    frameworkBytes = framework.reduce((sum, file) => sum + file.bytes, 0),
    currentGamesBytes = games.reduce((sum, file) => sum + file.bytes, 0);
  const total =
    programBytes + frameworkBytes + identityBytes + currentGamesBytes;
  assert.ok(
    total < MAXIMUM_PACKAGE_BYTES,
    'First startup complete program must be strictly below 120,000,000 bytes',
  );
  return {
    programBytes,
    frameworkBytes,
    identityBytes,
    metadata,
    currentGamesBytes,
    total,
    engineeringBudgetBytes: PACKAGE_BUDGET_BYTES,
    engineeringWarning: total >= PACKAGE_BUDGET_BYTES,
    framework,
    games,
    measurement:
      'Fresh installation: exact managed app/entry/helper, framework uninstaller/log, identity/receipt/config, all current materialized games. User saves/browser caches/transaction copies are excluded from the program footprint; preservation is checked separately.',
  };
}

/** Mutating installer verification only uses an isolated test product by default. */
export async function verifyInstallationDelivery({
  delivery,
  evidencePath,
  isolatedWindows = false,
  keepInstalled = false,
}) {
  assertWorkspaceRoot();
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
  const installerTemporary = join(work, 'installer-temporary');
  await mkdir(installerTemporary);
  const childEnvironment =
    installationVerificationEnvironment(installerTemporary);
  const unknown = join(root, '朋友资料.txt');
  await writeFile(unknown, 'Preserved unrelated original\n');
  const originalHash = hash(await readFile(unknown));
  const logs = {
    install: join(work, 'install.log'),
    reinstall: join(work, 'reinstall.log'),
    uninstall: join(work, 'uninstall.log'),
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
    try {
      result = await run(executable, args, options);
    } catch (cause) {
      failure = cause;
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
      };
      await writeLogIndex();
    } catch (cause) {
      if (failure)
        throw new AggregateError(
          [failure, cause],
          'Installer phase failed and its log could not be preserved',
        );
      throw cause;
    }
    if (failure) throw failure;
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
  const preserved = join(root, 'TableMax', '用户资料.txt');
  await writeFile(preserved, 'Preserved user data\n');
  const preservedHash = hash(await readFile(preserved));
  await runPhase('reinstall', executablePath, argumentsFor(logs.reinstall), {
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 1024 * 1024,
    env: childEnvironment,
  });
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
    hash(await readFile(join(root, 'TableMax/TableMax.config.json'))),
    footprint.metadata.find(
      (file) => file.path === 'TableMax/TableMax.config.json',
    ).sha256,
  );
  const repeatRegistration = await registration(manifest.productId);
  verifyRegistration(repeatRegistration, root, manifest, fixture);
  const repeatLinks = await shortcuts(root, fixture);
  verifyShortcuts(repeatLinks, root);
  assert.deepEqual(repeatLinks, links);
  assert.equal(hash(await readFile(preserved)), preservedHash);
  assert.equal(hash(await readFile(unknown)), originalHash);
  let uninstalled = false;
  let verifiedRuntime;
  if (!keepInstalled) {
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
      { path: 'TableMax/.install.json' },
    ])
      await assert.rejects(stat(join(root, file.path)), { code: 'ENOENT' });
    assert.equal(
      hash(await readFile(join(root, 'TableMax/TableMax.config.json'))),
      footprint.metadata.find(
        (file) => file.path === 'TableMax/TableMax.config.json',
      ).sha256,
    );
    assert.deepEqual(
      await installationInventory(join(root, 'TableMax/games')),
      footprint.games,
      'Default uninstall preserves every current/original game repository byte',
    );
    await verifyPreservedRuntime({
      copy: verifiedRuntime,
      delivery,
      payloadBytes,
      sourceRuntimeRoot: join(root, 'TableMax/app'),
      installationId: identity.installationId,
    });
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
    boxRoot: join(root, 'TableMax'),
    runtimeRoot: join(root, 'TableMax/app'),
    extracted: join(root, 'TableMax/app'),
    installationId: identity.installationId,
    ownerSid: identity.ownerSid,
    environment,
    productId: manifest.productId,
    firstStartupBytes: footprint.total,
    footprint,
    registration: firstRegistration,
    reinstall: {
      result: 'passed',
      registration: repeatRegistration,
      shortcuts: repeatLinks,
      footprint: repeatFootprint,
    },
    shortcuts: links,
    uninstalled,
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
