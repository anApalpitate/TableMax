import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  lstat,
  stat,
  writeFile,
  rename,
} from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
import { versionIdentity } from '../shared/application-version.mjs';
import { MAXIMUM_PACKAGE_BYTES } from './package-limits.mjs';
import {
  hash,
  prepareInstallationToolchain,
} from './installation-toolchain.mjs';

export const INSTALLATION_PRODUCT_ID = '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}';
export const INSTALLATION_FIXTURE_ID = '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}';
const run = promisify(execFile);
const coreSource = 'apps/desktop/installation-runtime/InstallationCore.cs';
const helperSources = [
  coreSource,
  'apps/desktop/installation-runtime/UpdateProtocol.cs',
  'apps/desktop/installation-runtime/TrustRoots.cs',
  'apps/desktop/installation-runtime/UpdateHelper.cs',
  'apps/desktop/native/LegacyGames.cs',
];
const launcherSources = [
  coreSource,
  'apps/desktop/installation/InstalledLauncher.cs',
];
const recipeSources = [
  ...new Set([
    ...helperSources,
    ...launcherSources,
    'apps/desktop/native/ApplicationUpdateKeys.json',
    'apps/desktop/native/app.manifest',
    'assets/platform/app-icon.ico',
    'global.json',
    'tools/release/installation-package.mjs',
    'tools/release/installation-toolchain.mjs',
    'tools/release/installation-toolchain.json',
    'apps/desktop/installation/TableMax.iss',
  ]),
];

export async function installationRecipeInputs({
  applicationTrustRootsPath,
} = {}) {
  return Promise.all(
    [
      ...recipeSources,
      ...(applicationTrustRootsPath
        ? [resolve(applicationTrustRootsPath)]
        : []),
    ].map(async (path) => ({
      path,
      bytes: (await stat(path)).size,
      sha256: hash(await readFile(path)),
    })),
  );
}

export async function installationInventory(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name),
        info = await lstat(path);
      assert.ok(!info.isSymbolicLink(), 'Installation input contains a link');
      if (info.isDirectory()) await visit(path);
      else {
        assert.ok(info.isFile());
        files.push({
          path: relative(directory, path).split(sep).join('/'),
          bytes: info.size,
          sha256: hash(await readFile(path)),
        });
      }
    }
  }
  await visit(directory);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** Compile against the locked SDK's Roslyn and the existing net48 system assemblies. */
export async function compileInstallationProgram({
  outputPath,
  sources,
  main,
  buildVersion,
  fixture = false,
  handoffTest = false,
  resources = [],
}) {
  assert.ok(
    fixture || !handoffTest,
    'Handoff test macro requires fixture identity',
  );
  const sdk = JSON.parse(await readFile('global.json', 'utf8')).sdk.version;
  assert.equal(sdk, '9.0.102');
  const listed = (await run('dotnet', ['--list-sdks'], { windowsHide: true }))
    .stdout;
  const sdkLine = listed
    .split(/\r?\n/)
    .find((line) => line.startsWith(sdk + ' ['));
  assert.ok(sdkLine, 'Locked .NET SDK 9.0.102 required');
  const compiler = join(
    sdkLine.slice(sdk.length + 2, -1),
    sdk,
    'Roslyn/bincore/csc.dll',
  );
  const framework = join(
    process.env.WINDIR,
    'Microsoft.NET/Framework64/v4.0.30319',
  );
  await mkdir(dirname(outputPath), { recursive: true });
  const metadata = outputPath + '.AssemblyInfo.cs';
  await writeFile(
    metadata,
    'using System.Reflection;\n[assembly: AssemblyTitle("TableMax")]\n[assembly: AssemblyProduct("TableMax")]\n[assembly: AssemblyVersion("' +
      buildVersion +
      '")]\n[assembly: AssemblyFileVersion("' +
      buildVersion +
      '")]\n',
  );
  await run(
    'dotnet',
    [
      'exec',
      compiler,
      '/nologo',
      '/target:winexe',
      '/platform:x64',
      '/langversion:12',
      '/optimize+',
      '/deterministic+',
      '/pathmap:' +
        resolve(dirname(outputPath)) +
        '=/_tablemax_generated,' +
        resolve('.') +
        '=/_tablemax_source',
      '/warnaserror+',
      '/nostdlib+',
      '/out:' + resolve(outputPath),
      '/main:' + main,
      '/win32icon:' + resolve('assets/platform/app-icon.ico'),
      '/win32manifest:' + resolve('apps/desktop/native/app.manifest'),
      ...(fixture ? ['/define:TABLEMAX_INSTALLATION_TEST'] : []),
      ...(handoffTest ? ['/define:TABLEMAX_INSTALLATION_HANDOFF_TEST'] : []),
      ...[
        'mscorlib',
        'System',
        'System.Core',
        'System.Security',
        'System.Xml',
        'System.Web.Extensions',
        'System.Windows.Forms',
        'System.Drawing',
      ].map((name) => '/reference:' + join(framework, name + '.dll')),
      ...resources.map(
        ({ path, name }) => '/resource:' + resolve(path) + ',' + name,
      ),
      ...sources.map((path) => resolve(path)),
      resolve(metadata),
    ],
    { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 },
  );
  return {
    sdk,
    compilerSha256: hash(await readFile(compiler)),
    bytes: (await stat(outputPath)).size,
    sha256: hash(await readFile(outputPath)),
  };
}

function issString(value) {
  assert.ok(!/["\r\n]/.test(value));
  return '"' + value + '"';
}

export async function compileInstallationScript({
  candidateDirectory,
  outputPath,
  buildVersion,
  fixture = false,
}) {
  const toolchain = await prepareInstallationToolchain();
  const recipeDirectory = join(dirname(candidateDirectory), 'inno-recipe');
  await mkdir(recipeDirectory, { recursive: true });
  await copyFile(
    'apps/desktop/installation/TableMax.iss',
    join(recipeDirectory, 'TableMax.iss'),
  );
  const productId = fixture ? INSTALLATION_FIXTURE_ID : INSTALLATION_PRODUCT_ID;
  const definitions = {
    InnoAppId: '{' + productId,
    ProductId: productId,
    ProductName: fixture ? 'TableMax Installation Fixture' : 'TableMax',
    BuildVersion: buildVersion,
    CandidateDirectory: resolve(candidateDirectory),
    OutputDirectory: resolve(dirname(outputPath)),
    OutputName: basename(outputPath, '.exe'),
    IconPath: resolve('assets/platform/app-icon.ico'),
    DesktopTaskFlags: 'checkedonce',
    HelperSHA256: hash(
      await readFile(join(candidateDirectory, 'UpdateHelper.exe')),
    ),
  };
  await writeFile(
    join(recipeDirectory, 'build-config.iss'),
    Object.entries(definitions)
      .map(([name, value]) => '#define ' + name + ' ' + issString(value))
      .join('\n') +
      '\n#define FixtureBuild ' +
      (fixture ? '1' : '0') +
      '\n',
  );
  await mkdir(dirname(outputPath), { recursive: true });
  const log = join(recipeDirectory, 'compiler.log');
  try {
    const result = await run(
      toolchain.executable,
      ['/Q', join(recipeDirectory, 'TableMax.iss')],
      { windowsHide: true, timeout: 180000, maxBuffer: 1024 * 1024 },
    );
    await writeFile(log, result.stdout + result.stderr);
  } catch (error) {
    await writeFile(
      log,
      (error.stdout ?? '') + (error.stderr ?? '') + '\n' + error.message,
    );
    throw new Error('Inno compiler failed; see ' + log, { cause: error });
  }
  const bytes = (await stat(outputPath)).size;
  assert.ok(
    bytes < MAXIMUM_PACKAGE_BYTES,
    'Complete installer must be strictly below 120,000,000 bytes',
  );
  return { ...toolchain, log, bytes, sha256: hash(await readFile(outputPath)) };
}

export async function createInstallationExecutable({
  archivePath,
  manifestPath,
  outputPath,
  fixture = false,
  frozenInstallation,
  applicationTrustRootsPath,
  handoffTest = false,
}) {
  assertWorkspaceRoot();
  assert.ok(
    fixture || (!applicationTrustRootsPath && !handoffTest),
    'Fixture trust/macro overrides are forbidden in production installers',
  );
  if (applicationTrustRootsPath) {
    const publicRoots = JSON.parse(
      await readFile(applicationTrustRootsPath, 'utf8'),
    );
    assert.equal(publicRoots.schemaVersion, 1);
    assert.ok(publicRoots.keys && Object.keys(publicRoots.keys).length > 0);
    for (const [keyId, xml] of Object.entries(publicRoots.keys)) {
      assert.match(keyId, /^[a-zA-Z0-9._-]{1,80}$/);
      assert.equal(typeof xml, 'string');
      assert.match(
        xml,
        /^<RSAKeyValue><Modulus>[A-Za-z0-9+/=]+<\/Modulus><Exponent>[A-Za-z0-9+/=]+<\/Exponent><\/RSAKeyValue>$/,
      );
    }
  }
  const started = performance.now();
  const payloadBytes = await readFile(manifestPath),
    payload = JSON.parse(payloadBytes.toString('utf8'));
  const buildVersion = payload.buildVersion ?? payload.version + '.0';
  assert.equal(
    versionIdentity(payload.version, Number(buildVersion.split('.').at(-1)))
      .buildVersion,
    buildVersion,
  );
  const archive = await readFile(archivePath);
  assert.equal(
    hash(archive),
    payload.archive.sha256,
    'Payload changed after freezing',
  );
  assert.ok(archive.length < MAXIMUM_PACKAGE_BYTES);
  const recipeOptions = { applicationTrustRootsPath };
  const inputs = await installationRecipeInputs(recipeOptions);
  if (frozenInstallation)
    assert.deepEqual(
      inputs,
      frozenInstallation.recipe.inputs,
      'Frozen installer recipe changed; create a new delivery',
    );
  await mkdir(resolve('tmp'), { recursive: true });
  const work = await mkdtemp(resolve('tmp/installation-package-'));
  const candidate = join(work, 'candidate');
  const app = join(candidate, 'TableMax/app');
  await mkdir(app, { recursive: true });
  // Validate every ZIP destination against the frozen manifest before extraction.
  await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      '$ErrorActionPreference="Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; $manifest=Get-Content -LiteralPath $env:TABLEMAX_PAYLOAD_MANIFEST -Raw | ConvertFrom-Json; $expected=@{}; foreach($file in $manifest.files){ if($file.path -match "(^/|\\\\|:|(^|/)\\.\\.?(/|$))" -or $expected.ContainsKey($file.path)){throw "Unsafe payload member"}; $expected[$file.path]=$file }; $zip=[IO.Compression.ZipFile]::OpenRead($env:TABLEMAX_PAYLOAD_ARCHIVE); try {if($zip.Entries.Count -ne $expected.Count){throw "Payload member count differs"}; foreach($entry in $zip.Entries){$name=$entry.FullName.Replace([char]92,[char]47); if(-not $expected.ContainsKey($name) -or $entry.Length -ne $expected[$name].bytes){throw "Payload member differs"}; $expected.Remove($name)}}finally{$zip.Dispose()}; [IO.Compression.ZipFile]::ExtractToDirectory($env:TABLEMAX_PAYLOAD_ARCHIVE,$env:TABLEMAX_INSTALL_CANDIDATE_APP)',
    ],
    {
      windowsHide: true,
      timeout: 120000,
      env: {
        ...process.env,
        TABLEMAX_PAYLOAD_MANIFEST: resolve(manifestPath),
        TABLEMAX_PAYLOAD_ARCHIVE: resolve(archivePath),
        TABLEMAX_INSTALL_CANDIDATE_APP: app,
      },
    },
  );
  assert.deepEqual(
    await installationInventory(app),
    payload.files,
    'Actual installer payload extraction differs',
  );
  await copyFile(manifestPath, join(app, '.tablemax-release.json'));
  const launcher = await compileInstallationProgram({
    outputPath: join(candidate, 'TableMax.exe'),
    sources: launcherSources,
    main: 'TableMax.Installation.InstalledLauncher',
    buildVersion,
    fixture,
  });
  const helper = await compileInstallationProgram({
    outputPath: join(candidate, 'UpdateHelper.exe'),
    sources: helperSources,
    main: 'TableMax.Installation.UpdateHelper',
    buildVersion,
    fixture,
    handoffTest,
    resources: [
      {
        path:
          applicationTrustRootsPath ??
          'apps/desktop/native/ApplicationUpdateKeys.json',
        name: 'TableMax.ApplicationUpdateKeys.json',
      },
    ],
  });
  // Compiler-only generated source is outside the installed file set.
  const records = (await installationInventory(candidate)).filter(
    (file) => !file.path.endsWith('.AssemblyInfo.cs'),
  );
  const candidateManifest = {
    schemaVersion: 1,
    productId: fixture ? INSTALLATION_FIXTURE_ID : INSTALLATION_PRODUCT_ID,
    arch: 'x64',
    installProtocol: 1,
    releaseVersion: payload.version,
    buildVersion,
    payloadManifestSha256: hash(payloadBytes),
    currentMappingSha256: hash(
      await readFile(join(app, 'preinstalled-games/bootstrap.json')),
    ),
    files: records,
  };
  const candidateManifestPath = join(candidate, 'installation-manifest.json');
  await writeFile(
    candidateManifestPath,
    JSON.stringify(candidateManifest, null, 2) + '\n',
  );
  const stagedProgramBytes = records.reduce((sum, file) => sum + file.bytes, 0);
  assert.ok(
    stagedProgramBytes < MAXIMUM_PACKAGE_BYTES,
    'Complete staged program exceeds limit',
  );
  const sealed = join(work, 'sealed', basename(outputPath));
  const inno = await compileInstallationScript({
    candidateDirectory: candidate,
    outputPath: sealed,
    buildVersion,
    fixture,
  });
  if (frozenInstallation) {
    assert.equal(
      inno.sha256,
      frozenInstallation.recipe.compiler.sha256,
      'Repacking the frozen installer changed final bytes; preserve the original artifact and create a new delivery',
    );
    assert.equal(inno.bytes, frozenInstallation.recipe.compiler.bytes);
    assert.equal(
      hash(await readFile(candidateManifestPath)),
      frozenInstallation.manifestSha256,
    );
  }
  assert.deepEqual(
    await installationRecipeInputs(recipeOptions),
    inputs,
    'Installer source changed during packaging',
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await rename(sealed, resolve(outputPath));
  const frozenManifestPath = join(
    dirname(manifestPath),
    fixture
      ? 'installation-fixture-manifest.json'
      : 'installation-manifest.json',
  );
  await copyFile(candidateManifestPath, frozenManifestPath);
  const installation = {
    productId: candidateManifest.productId,
    installProtocol: 1,
    manifestPath: frozenManifestPath,
    manifestSha256: hash(await readFile(frozenManifestPath)),
    payloadManifestSha256: candidateManifest.payloadManifestSha256,
    currentMappingSha256: candidateManifest.currentMappingSha256,
    candidateDirectory: candidate,
    stagedProgramBytes,
    recipe: {
      inputs,
      compiler: inno,
      launcher,
      helper,
      fixtureOptions: fixture
        ? {
            buildVersion,
            handoffTest,
            applicationTrustRootsPath: applicationTrustRootsPath
              ? resolve(applicationTrustRootsPath)
              : null,
          }
        : null,
    },
    requiredAcceptance: [
      'actual installer files and framework footprint',
      'first startup materialized current modules footprint',
      'installed identity and native health',
      'upgrade/uninstall/data preservation',
    ],
  };
  return {
    type: 'installer',
    path: resolve(outputPath),
    bytes: inno.bytes,
    sha256: hash(await readFile(outputPath)),
    payloadSha256: payload.archive.sha256,
    durationMs: Math.round(performance.now() - started),
    installation,
  };
}

if (isDirectExecution(import.meta.url)) {
  assertWorkspaceRoot();
  const args = process.argv.slice(2);
  const value = (name) =>
    args
      .find((arg) => arg.startsWith('--' + name + '='))
      ?.slice(name.length + 3);
  assert.ok(value('archive') && value('manifest') && value('out'));
  console.log(
    JSON.stringify(
      await createInstallationExecutable({
        archivePath: value('archive'),
        manifestPath: value('manifest'),
        outputPath: value('out'),
        fixture: args.includes('--fixture'),
      }),
    ),
  );
}
