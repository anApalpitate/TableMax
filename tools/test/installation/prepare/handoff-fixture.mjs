import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  createInstallationFixturePackage,
  readInstallationFixtureSource,
} from '../../../release/installation-fixture.mjs';
import {
  applicationPublicKeyXml,
  applicationUpdateMachineBlock,
  extractApplicationUpdate,
} from '../../../shared/application-update.mjs';
import {
  signFixtureApplicationUpdate,
  verifyFixtureApplicationUpdate,
} from '../../support/fixture-application-update.mjs';
const fixtureId = '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}';
const powershell = join(
  process.env.WINDIR ?? 'C:/Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe',
);
const powershellUtf8 =
  '$ErrorActionPreference="Stop"; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); ';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
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
async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
const sourcePaths = [
  'apps/desktop/installation-runtime/InstallationCore.cs',
  'apps/desktop/installation-runtime/UpdateProtocol.cs',
  'apps/desktop/installation-runtime/TrustRoots.cs',
  'tools/test/installation/verify-application-handoff.cs',
];

export { hash, inside, noLinks, json, writeJson, record, exists };

/** Prepare or authenticate fixture materials only; execution is supplied and owned by the CLI caller. */
export async function prepareHandoffFixture({
  repository,
  work,
  prepared,
  preparedReport,
  report,
  nativeTemplate,
  serverDirectory,
  webDirectory,
  sourcePointer,
  execute,
  createPackage = createInstallationFixturePackage,
}) {
  const nativeFiles = (await readdir(resolve('apps/desktop/native')))
    .filter((name) => name.endsWith('.cs'))
    .map((name) => 'apps/desktop/native/' + name);
  const sources = [...nativeFiles, ...sourcePaths];
  report.sourceHashes = Object.fromEntries(
    await Promise.all(
      [
        ...sources,
        'tools/test/installation/prepare/handoff-fixture.mjs',
        'tools/release/installation-fixture.mjs',
        'tools/release/delivery-paths.mjs',
        'tools/release/windows-executable-name.mjs',
        'tools/test/runner/failure-policy.mjs',
        'tools/test/installation/scenarios/framework-recovery.mjs',
        'tools/test/installation/scenarios/application-handoff.mjs',
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
  // Two new-layout application fixtures exercise the v1.0.7 compatibility
  // baseline without changing package.json or the production release.
  const version = '1.0.7';
  let selectedSource;
  if (sourcePointer) {
    assert.ok(!prepared, 'Explicit source pointer is preparation only');
    sourcePointer = inside(repository, sourcePointer);
    await noLinks(sourcePointer);
    selectedSource = await readInstallationFixtureSource(sourcePointer);
    assert.equal(
      selectedSource.currentVersion,
      version,
      'Explicit-source preparation requires the current package public version',
    );
    report.sourcePointer = selectedSource.source.pointer;
  }
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
    const delivery = await createPackage({
      nativeDirectory: directory,
      serverDirectory,
      webDirectory,
      buildVersion,
      applicationTrustRootsPath: trust,
      handoffTest,
      ...(sourcePointer ? { sourcePointer } : {}),
    });
    assert.ok(delivery.source, 'Fixture builder must bind its frozen source');
    if (selectedSource) {
      const { frozenPointer, ...original } = delivery.source;
      assert.ok(frozenPointer);
      assert.deepEqual(
        original,
        selectedSource.source,
        'Frozen source changed during preparation',
      );
    }
    if (report.sourcePointer)
      assert.deepEqual(
        delivery.source.pointer,
        report.sourcePointer,
        'Fixture pair must use one exact source pointer',
      );
    else report.sourcePointer = delivery.source.pointer;
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
            'data/app/package.json',
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

  async function verifyPreparedSource(delivery) {
    const source = delivery.source;
    assert.ok(source, 'Prepared fixture source binding required');
    assert.deepEqual(source.pointer, prepared.sourcePointer);
    inside(repository, source.pointer.path);
    const frozen = inside(repository, source.frozenPointer.path);
    await noLinks(frozen);
    assert.deepEqual(await record(frozen), source.frozenPointer);
    assert.equal(source.frozenPointer.bytes, source.pointer.bytes);
    assert.equal(source.frozenPointer.sha256, source.pointer.sha256);
    const pointer = await json(frozen);
    assert.equal(pointer.version, source.version);
    assert.equal(pointer.buildVersion, source.buildVersion);
    assert.equal(pointer.snapshot, source.snapshot);
    const originals = pointer.deliveries.filter(
      (item) => item.edition === 'full',
    );
    assert.equal(originals.length, 1);
    const original = originals[0];
    assert.equal(resolve(original.manifestPath), source.manifest.path);
    assert.equal(resolve(original.archivePath), source.archive.path);
    assert.equal(resolve(original.executable.path), source.executable.path);
    assert.equal(original.executable.bytes, source.executable.bytes);
    assert.equal(original.executable.sha256, source.executable.sha256);
    for (const bound of [
      source.manifest,
      source.archive,
      source.executable,
      source.snapshotRecord,
      ...(source.installationManifest ? [source.installationManifest] : []),
    ]) {
      const path = inside(repository, bound.path);
      await noLinks(path);
      assert.deepEqual(
        await record(path),
        bound,
        'Prepared original source bytes changed',
      );
    }
    const payloadPath = inside(repository, delivery.manifestPath);
    await noLinks(payloadPath);
    assert.equal(
      (await record(payloadPath)).sha256,
      delivery.executable.installation.payloadManifestSha256,
    );
    const payload = await json(payloadPath);
    assert.deepEqual(payload.fixture.source, source);
    report.sourcePointer = source.pointer;
  }

  async function verifyPrepared() {
    let target, api;
    assert.deepEqual(
      Object.keys(prepared.sourceHashes).sort(),
      Object.keys(report.sourceHashes).sort(),
      'Prepared method dependency declaration changed',
    );
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
      await verifyPreparedSource(delivery);
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
      assert.equal(installation.recipe.fixtureOptions.handoffTest, handoffTest);
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
      assert.equal((await record(path)).sha256, installation.manifestSha256);
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
      target,
      api,
      verification: {
        actualExeAndManifestSHAReverified: true,
        privateKeyUsed: false,
      },
    };
  }
  function createDescription() {
    let target, api;
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
      assetName: `TableMax-${version}-installer-win-x64.exe`,
      assetUrl: `https://github.com/anApalpitate/TableMax/releases/download/v${version}/TableMax-${version}-installer-win-x64.exe`,
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
    return { target, api };
  }
  return {
    oldBuild,
    newBuild,
    trust,
    native,
    fixture,
    verifyPrepared,
    createDescription,
  };
}
