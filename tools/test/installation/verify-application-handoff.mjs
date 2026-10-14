import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
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
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createInstallationFixturePackage } from '../../release/installation-fixture.mjs';
import {
  applicationPublicKeyXml,
  applicationUpdateMachineBlock,
  extractApplicationUpdate,
  signApplicationUpdate,
  verifyApplicationUpdate,
} from '../../shared/application-update.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
import { launchDesktop } from '../support/desktop-test.mjs';

const fixtureId = '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const powershell = join(
  process.env.WINDIR ?? 'C:/Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe',
);
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
}) {
  assertWorkspaceRoot();
  assert.equal(process.platform, 'win32');
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
  await mkdir(resolve('tmp'), { recursive: true });
  const configuredParent = process.env.TABLEMAX_INSTALLATION_HANDOFF_TMP;
  const workParent = configuredParent
    ? inside(resolve('tmp'), configuredParent)
    : resolve('tmp');
  if (configuredParent) {
    assert.equal(dirname(workParent), resolve('tmp'));
    await noLinks(workParent);
    assert.ok(
      (await stat(workParent)).isDirectory(),
      'Private handoff parent required',
    );
  }
  const work = await mkdtemp(join(workParent, 'application-handoff-'));
  await noLinks(work);
  const root = join(work, '安装 根');
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
    cacheable: false,
    startedAtUtc: new Date().toISOString(),
    work,
    root,
    fixtureId,
    steps: [],
    failures: 0,
    failureLimit: 3,
    boundary:
      'Actual two-build fixture Inno/Native/Node and real ApplicationUpdate.Apply/prepare/parent handoff. Only GitHub HTTP is a managed signed-fixture transport. No production GUID installation/system mutation, public version/current pointer, actual internet availability or old-version saved-game compatibility claim. Signed descriptions retain the protocol product GUID; Windows registration uses the distinct fixture GUID.',
    releaseMetadataBoundary:
      'The source ZIP asset is metadata-only (one-byte placeholder), never built, downloaded or published. Installer bytes and their signed identity are real fixture materials.',
  };
  await writeJson(join(evidence, 'report.json'), report);
  let sequence = 0,
    installed = false,
    desktop,
    newBrowser;
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
    let output = '',
      timedOut = false,
      outputTruncated = false,
      outputBytesObserved = 0;
    const save = (chunk) => {
      outputBytesObserved += chunk.length;
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
  const nativeFiles = (await readdir(resolve('apps/desktop/native')))
    .filter((name) => name.endsWith('.cs'))
    .map((name) => 'apps/desktop/native/' + name);
  const sources = [...nativeFiles, ...sourcePaths];
  report.sourceHashes = Object.fromEntries(
    await Promise.all(
      sources.map(async (path) => [path, hash(await readFile(path))]),
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
          '$ErrorActionPreference="Stop"; $assembly=[Reflection.Assembly]::ReflectionOnlyLoadFrom($env:TABLEMAX_FIXTURE_ASSEMBLY); $name=@($assembly.GetManifestResourceNames() | Where-Object { $_.EndsWith("ApplicationUpdateKeys.json") }); if($name.Count -ne 1){throw "Fixture trust resource missing"}; $stream=$assembly.GetManifestResourceStream($name[0]); try { $sha=[Security.Cryptography.SHA256]::Create(); try { [BitConverter]::ToString($sha.ComputeHash($stream)).Replace("-", "").ToLowerInvariant() } finally { $sha.Dispose() } } finally { $stream.Dispose() }',
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
        assert.equal(
          previousPlan.newInstaller,
          report.new.delivery.executable.path,
        );
        api = JSON.parse(previousPlan.apiJson);
        const signed = extractApplicationUpdate(api.body).envelope;
        target = verifyApplicationUpdate(signed, {
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
        productId: '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}',
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
      const envelope = signApplicationUpdate(target, privateKey, { keyId });
      verifyApplicationUpdate(envelope, {
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
    const plan = join(work, 'handoff-plan.json');
    await writeJson(plan, {
      schemaVersion: 1,
      root,
      evidence,
      newInstaller: report.new.delivery.executable.path,
      newBytes: target.bytes,
      newSha256: target.sha256,
      apiJson: JSON.stringify(api),
    });
    environment.TABLEMAX_HANDOFF_TEST_PLAN = plan;
    report.plan = await record(plan);
    report.description = target;
    if (!prepareOnly && !verifyPreparedOnly) {
      const outside = join(root, '朋友资料.txt');
      await writeFile(outside, 'Preserved by actual installer and update\n');
      const outsideBefore = await record(outside);
      await step('actual-old-inno-install', async () => {
        assert.equal(await registration(), null);
        const run = await execute(
          report.old.delivery.executable.path,
          [
            '/VERYSILENT',
            '/SUPPRESSMSGBOXES',
            '/NORESTART',
            '/DIR=' + root,
            '/LOG=' + join(evidence, 'old-inno.log'),
          ],
          'old-inno',
        );
        assert.equal(run.code, 0, run.log);
        installed = true;
        const value = await registration();
        assert.equal(resolve(value.InstallLocation), root);
        assert.equal(value.DisplayVersion, oldBuild);
        return { registration: value };
      });
      await step('actual-old-host-transport', async () => {
        desktop = await launchDesktop({
          executablePath: join(root, 'TableMax/app/TableMax.exe'),
          timeout: 90000,
          env: {
            ...environment,
            TABLEMAX_BOX_DIRECTORY: join(root, 'TableMax'),
          },
        });
        const ready = await waitUntil(async () => {
          const error = await maybeJson(
            join(evidence, 'old-fixture-error.json'),
          );
          if (error) throw new Error(error.error);
          return maybeJson(join(evidence, 'old-native-ready.json'));
        }, 'Actual old Native transport attachment');
        assert.equal(ready.buildVersion, oldBuild);
        assert.equal(ready.desktopPid, desktop.process().pid);
        return ready;
      });
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
        return {
          state,
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
        const identity = await json(join(root, 'TableMax/.install.json'));
        assert.equal(identity.buildVersion, newBuild);
        assert.equal(
          identity.payloadManifestSha256,
          target.payloadManifestSha256,
        );
        const reg = await registration();
        assert.equal(reg.DisplayVersion, newBuild);
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
        return {
          outcome,
          temporaryHelperSha256: oldHelper.sha256,
          newOwnedHelperSha256: newHelper.sha256,
        };
      });
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
    if (installed) {
      try {
        await step('exact-fixture-uninstall-cleanup', async () => {
          const current = await registration();
          assert.ok(
            current && resolve(current.InstallLocation) === root,
            'Fixture registration changed; preserve it',
          );
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
          return { registrationRemoved: true, scope: root };
        });
      } catch (error) {
        report.result = 'failed';
        report.cleanupError = error.message;
      }
    }
    await newBrowser?.close().catch(() => {});
    await desktop?.close().catch((error) => {
      report.result = 'failed';
      report.desktopCleanupError = error.message;
    });
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
