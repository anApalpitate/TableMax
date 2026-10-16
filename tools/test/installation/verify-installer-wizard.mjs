import { failureLimit } from '../runner/failure-policy.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
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
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
import { saveVerificationScreenshot } from '../support/screenshots.mjs';
import { resolveWindowsAcceptanceProfile } from '../../shared/windows-acceptance-profile.mjs';

const productIds = [
  '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}',
  '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}',
];
const source = 'tools/test/installation/verify-installer-wizard.cs';
const entrySources = [
  'apps/desktop/installation/InstalledLauncher.cs',
  'apps/desktop/installation/Updater.cs',
  'apps/desktop/installation-runtime/InstallationCore.cs',
  'apps/desktop/installation-runtime/UpdateHelper.cs',
  'apps/desktop/installation-runtime/UpdateProtocol.cs',
  'apps/desktop/installation-runtime/TrustRoots.cs',
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function inside(root, path) {
  const name = relative(resolve(root), resolve(path));
  assert.ok(
    name && !isAbsolute(name) && name !== '..' && !name.startsWith('..' + sep),
    'Path escapes wizard scope',
  );
  return resolve(path);
}
async function noLinks(path) {
  for (let cursor = resolve(path); ; cursor = dirname(cursor)) {
    try {
      assert.ok(
        !(await lstat(cursor)).isSymbolicLink(),
        'Linked wizard path: ' + cursor,
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (dirname(cursor) === cursor) break;
  }
}
async function record(path) {
  const bytes = await readFile(path);
  return { path: resolve(path), bytes: bytes.length, sha256: hash(bytes) };
}
async function inventory(root) {
  const files = [];
  async function visit(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      assert.ok(!item.isSymbolicLink(), 'Linked wizard output');
      if (item.isDirectory()) await visit(path);
      else if (item.isFile())
        files.push({
          name: relative(root, path).split(sep).join('/'),
          ...(await record(path)),
        });
      else assert.fail('Unexpected wizard output member');
    }
  }
  await visit(root);
  return files.sort((a, b) => a.name.localeCompare(b.name));
}
async function execute(executable, args, environment, cwd, timeout = 120000) {
  return new Promise((done, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: environment,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '',
      timedOut = false;
    const append = (chunk) => {
      if (output.length < 2 * 1024 * 1024)
        output += chunk.toString().slice(0, 2 * 1024 * 1024 - output.length);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
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
      done({ code, signal, timedOut, output, pid: child.pid });
    });
  });
}

async function prepareEntryPlan({
  deliveryPath,
  repository,
  work,
  temporary,
  captures,
  executable,
  environment,
  report,
}) {
  deliveryPath = inside(repository, deliveryPath);
  await noLinks(deliveryPath);
  const input = JSON.parse(await readFile(deliveryPath, 'utf8'));
  const deliveries = input.deliveries
    ? input.deliveries.filter(
        (item) => item.edition === 'full' && item.deliveryType === 'installer',
      )
    : [input];
  assert.equal(deliveries.length, 1);
  const delivery = deliveries[0];
  assert.equal(delivery.deliveryType, 'installer');
  assert.equal(delivery.edition, 'full');
  assert.equal(delivery.executable.type, 'installer');
  const installation = delivery.executable.installation;
  assert.equal(
    installation.productId,
    productIds[1],
    'Entry components require fixture GUID; production identities are not synthesized',
  );
  assert.equal(installation.installProtocol, 1);
  const manifestPath = inside(repository, installation.manifestPath);
  await noLinks(manifestPath);
  const manifestRecord = await record(manifestPath);
  assert.equal(manifestRecord.sha256, installation.manifestSha256);
  const frozenManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(frozenManifest.productId, productIds[1]);
  assert.match(frozenManifest.buildVersion, /^\d+\.\d+\.\d+\.\d+$/);
  const candidate = inside(repository, installation.candidateDirectory);
  await noLinks(candidate);
  const methodSources = [];
  for (const path of entrySources) {
    const current = await record(path);
    const frozen = installation.recipe.inputs.find(
      (item) => item.path === path,
    );
    assert.ok(
      frozen,
      'Entry dependency is missing from the frozen recipe: ' + path,
    );
    assert.equal(current.bytes, frozen.bytes);
    assert.equal(
      current.sha256,
      frozen.sha256,
      'Entry source changed since fixture sealing: ' + path,
    );
    methodSources.push(current);
  }
  const outer = await record(inside(repository, delivery.executable.path));
  assert.equal(outer.bytes, delivery.executable.bytes);
  assert.equal(outer.sha256, delivery.executable.sha256);
  const root = join(work, '入口 组件'),
    box = join(root, 'data'),
    nonce = randomUUID();
  await mkdir(root);
  const sourcePes = [],
    files = [];
  async function add(name, bytes) {
    const path = inside(root, join(root, ...name.split('/')));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { flag: 'wx' });
    const tuple = await record(path);
    files.push({ path: name, bytes: tuple.bytes, sha256: tuple.sha256 });
    return tuple;
  }
  for (const name of ['TableMax.exe', 'Updater.exe', 'UpdateHelper.exe']) {
    const expected = frozenManifest.files.find((item) => item.path === name);
    assert.ok(expected);
    const sourcePath = inside(candidate, join(candidate, name));
    await noLinks(sourcePath);
    const original = await record(sourcePath);
    assert.equal(original.bytes, expected.bytes);
    assert.equal(original.sha256, expected.sha256);
    const copy = await add(name, await readFile(sourcePath));
    assert.equal(copy.sha256, original.sha256);
    sourcePes.push({ source: original, executionCopy: copy });
  }
  const native = await add('data/app/TableMax.exe', await readFile(executable));
  await add(
    'data/app/node.exe',
    Buffer.from('Inert component member; never executed.\n'),
  );
  await add(
    'data/app/server.cjs',
    Buffer.from('Inert component member; never executed.\n'),
  );
  const payload = await add(
    'data/app/.tablemax-release.json',
    Buffer.from('{"component":"updater-entry"}\n'),
  );
  const mapping = await add(
    'data/app/preinstalled-games/bootstrap.json',
    Buffer.from('{"schemaVersion":1,"releaseIds":[]}\n'),
  );
  const sid = await execute(
    join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);[Console]::Write([Security.Principal.WindowsIdentity]::GetCurrent().User.Value)',
    ],
    {
      ...environment,
      PSModulePath: join(
        process.env.WINDIR,
        'System32/WindowsPowerShell/v1.0/Modules',
      ),
    },
    work,
  );
  assert.equal(sid.code, 0, sid.output);
  assert.equal(sid.timedOut, false);
  const ownerSid = sid.output.trim();
  assert.match(ownerSid, /^S-1-5-21-\d+-\d+-\d+-\d+$/);
  const identity = {
    schemaVersion: 1,
    productId: productIds[1],
    arch: 'x64',
    installProtocol: 1,
    releaseVersion: frozenManifest.releaseVersion,
    buildVersion: frozenManifest.buildVersion,
    payloadManifestSha256: payload.sha256,
    currentMappingSha256: mapping.sha256,
    files,
    installationId: randomUUID(),
    root,
    boxRoot: box,
    ownerSid,
  };
  const manifest = join(box, '.install.json');
  await writeFile(manifest, JSON.stringify(identity, null, 2) + '\n', {
    flag: 'wx',
  });
  await writeFile(
    join(box, 'TableMax.config.json'),
    '{"dataDirectory":"."}\n',
    { flag: 'wx' },
  );
  await writeFile(join(root, '.entry-component-nonce'), nonce, { flag: 'wx' });
  const unknown = join(root, '朋友资料.txt');
  await writeFile(
    unknown,
    'Owned entry component unknown-file preservation fixture.\n',
    { flag: 'wx' },
  );
  const plan = {
    schemaVersion: 1,
    mode: 'updater-entry',
    work,
    temporary,
    captures,
    root,
    updater: join(root, 'Updater.exe'),
    updaterSha256: sourcePes[1].executionCopy.sha256,
    helper: join(root, 'UpdateHelper.exe'),
    helperSha256: sourcePes[2].executionCopy.sha256,
    native: native.path,
    nativeSha256: native.sha256,
    manifest,
    manifestSha256: (await record(manifest)).sha256,
    receipt: join(root, 'native-argv.json'),
    release: join(root, 'native-release.txt'),
    nonce,
    unknown,
    unknownSha256: (await record(unknown)).sha256,
  };
  Object.assign(environment, {
    TABLEMAX_ENTRY_COMPONENT: '1',
    TABLEMAX_ENTRY_NONCE: nonce,
    TABLEMAX_ENTRY_RECEIPT: plan.receipt,
    TABLEMAX_ENTRY_RELEASE: plan.release,
  });
  for (const name of [
    'TABLEMAX_INSTALLATION_HEALTH_PIPE',
    'TABLEMAX_INSTALLATION_HEALTH_TOKEN',
  ])
    delete environment[name];
  report.entry = {
    sourceDelivery: await record(deliveryPath),
    sourceOuter: outer,
    frozenManifest: manifestRecord,
    sourcePes,
    methodSources,
    identity: await record(manifest),
    ownerSid,
    root,
    native: { ...native, fixtureOnlyArgvReceipt: true },
    unknown: await record(unknown),
    boundary:
      'Actual frozen fixture Updater/Helper PE and synthetic managed identity. Native is only this argv-receipt harness; node/server are inert and never execute. No existing-Native IPC, service, installer, account, registry or network acceptance.',
  };
  return plan;
}

/** Reads a real installer wizard on a private desktop; never invokes Install. */
export async function verifyInstallerWizard({
  deliveryPath,
  evidence,
  compileOnly = false,
  probeOnly = false,
  entryOnly = false,
  migrationSource = 'absent',
}) {
  assertWorkspaceRoot();
  assert.equal(process.platform, 'win32');
  assert.ok(
    [compileOnly, probeOnly, entryOnly].filter(Boolean).length <= 1,
    'Choose one preparation or entry mode',
  );
  assert.ok(
    ['absent', 'present'].includes(migrationSource),
    'Unknown migration source case',
  );
  assert.ok(
    compileOnly || probeOnly || deliveryPath,
    'Sealed delivery record required',
  );
  const repository = resolve('.');
  const profile = await resolveWindowsAcceptanceProfile(
    process.env.TABLEMAX_INSTALLATION_HANDOFF_TMP,
  );
  evidence = inside(resolve('artifacts/maintenance'), evidence);
  await noLinks(evidence);
  const workParent = profile?.workParent ?? resolve('tmp');
  await noLinks(workParent);
  await mkdir(dirname(evidence), { recursive: true });
  await mkdir(evidence, { recursive: false });
  await mkdir(workParent, { recursive: true });
  const work = await mkdtemp(join(workParent, 'installer-wizard-'));
  await noLinks(work);
  const temporary = join(work, 'temporary'),
    captures = join(work, 'captures');
  await mkdir(temporary);
  await mkdir(captures);
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/^(TABLEMAX_|WEBVIEW2_)/i.test(key) &&
        !/^(NODE_OPTIONS|NODE_PATH)$/i.test(key),
    ),
  );
  Object.assign(environment, {
    TEMP: temporary,
    TMP: temporary,
    TABLEMAX_AUTO_MAINTENANCE: '0',
    TABLEMAX_TEST_MAINTENANCE: '0',
    DOTNET_CLI_HOME: profile
      ? join(work, 'dotnet-home')
      : resolve('.cache/dotnet-home'),
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
    DOTNET_NOLOGO: '1',
    TABLEMAX_HOST: '127.0.0.1',
    TABLEMAX_PORT: '0',
    TABLEMAX_NATIVE_AUDIO: '0',
  });
  const sourceRecord = await record(source),
    driverRecord = await record(fileURLToPath(import.meta.url));
  const report = {
    schemaVersion: 1,
    cacheable: false,
    startedAtUtc: new Date().toISOString(),
    work,
    result: 'not-run',
    executionProfile: profile,
    failures: 0,
    failureLimit: failureLimit(),
    migrationSource,
    source: sourceRecord,
    driver: driverRecord,
    boundary:
      'Actual own-process windows rendered on an unswitched private desktop. Directory editing, option toggles, Back and Chinese exit confirmation only; no Install invocation, account creation, UAC, production installation, save/health/migration execution, security-prompt or online-delivery acceptance. The same sealed installer bytes are copied to an isolated Chinese-space source directory and default {src}/TableMax is checked. Generated config fixtures are only wizard inputs, never actual saved games or migration proof.',
    failureDomain: 'tool-or-environment-not-product-installation',
  };
  try {
    const sdk = JSON.parse(await readFile('global.json', 'utf8')).sdk.version;
    const compiler = join(
      process.env.ProgramFiles ?? 'C:/Program Files',
      'dotnet/sdk',
      sdk,
      'Roslyn/bincore/csc.dll',
    );
    const refs = resolve(
      '.cache/nuget/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8',
    );
    const executable = join(work, 'InstallerWizardHarness.exe');
    const compilation = await execute(
      'dotnet',
      [
        compiler,
        '/nologo',
        '/target:exe',
        '/platform:x64',
        '/langversion:12',
        '/optimize+',
        '/deterministic+',
        '/warnaserror+',
        '/nostdlib+',
        '/out:' + executable,
        ...[
          'mscorlib',
          'System',
          'System.Core',
          'System.Drawing',
          'System.Windows.Forms',
          'System.Web.Extensions',
          'UIAutomationClient',
          'UIAutomationTypes',
          'WindowsBase',
          'Accessibility',
        ].map((name) => '/reference:' + join(refs, name + '.dll')),
        resolve(source),
      ],
      environment,
      repository,
    );
    await writeFile(join(evidence, 'compile.log'), compilation.output);
    report.compilation = {
      ...compilation,
      output: undefined,
      sdk,
      compiler,
      references: refs,
      executable: await stat(executable)
        .then(() => record(executable))
        .catch(() => null),
    };
    assert.equal(
      compilation.timedOut,
      false,
      'Wizard harness compilation timed out',
    );
    assert.equal(
      compilation.code,
      0,
      'Wizard harness compilation failed; see compile.log',
    );
    if (compileOnly) report.result = 'compiled-not-executed';
    else {
      let plan = {
        schemaVersion: 1,
        mode: probeOnly ? 'api-probe' : 'installer-wizard',
        work,
        temporary,
        captures,
        target: join(work, '最终 安装位置'),
        installer: executable,
        installerSha256: report.compilation.executable.sha256,
        productId: productIds[1],
        migrationSource: join(work, '原配置 目录'),
        migrationSourceState: migrationSource,
      };
      if (entryOnly) {
        report.boundary =
          'Actual fixture Updater first Chinese feedback and exact synthetic Native argv handoff; actual helper no-argument Chinese guidance. Private desktop and own Job only, no installer/service/accounts/registration/network or existing-Native IPC proof.';
        plan = await prepareEntryPlan({
          deliveryPath,
          repository,
          work,
          temporary,
          captures,
          executable,
          environment,
          report,
        });
      } else if (!probeOnly) {
        deliveryPath = inside(repository, deliveryPath);
        await noLinks(deliveryPath);
        const input = JSON.parse(await readFile(deliveryPath, 'utf8'));
        const delivery = input.deliveries
          ? input.deliveries.filter(
              (item) =>
                item.edition === 'full' && item.deliveryType === 'installer',
            )
          : [input];
        assert.equal(
          delivery.length,
          1,
          'Exactly one complete installer delivery required',
        );
        const value = delivery[0];
        assert.equal(value.deliveryType, 'installer');
        assert.equal(value.edition, 'full');
        assert.equal(value.executable.type, 'installer');
        const installer = inside(repository, value.executable.path),
          installation = value.executable.installation;
        const manifestPath = inside(repository, installation.manifestPath);
        await noLinks(installer);
        await noLinks(manifestPath);
        const original = await record(installer),
          manifestRecord = await record(manifestPath);
        assert.match(value.executable.sha256, /^[a-f0-9]{64}$/);
        assert.equal(original.sha256, value.executable.sha256);
        assert.equal(original.bytes, value.executable.bytes);
        assert.ok(original.bytes > 0 && original.bytes < 120000000);
        assert.equal(manifestRecord.sha256, installation.manifestSha256);
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
        assert.ok(
          productIds.includes(manifest.productId),
          'Unknown product identity',
        );
        assert.equal(manifest.productId, installation.productId);
        assert.equal(installation.installProtocol, 1);
        assert.match(manifest.buildVersion, /^\d+\.\d+\.\d+\.\d+$/);
        const recipe = installation.recipe.inputs.find(
          (item) => item.path === 'apps/desktop/installation/TableMax.iss',
        );
        assert.ok(recipe, 'Frozen wizard source binding required');
        assert.equal(
          (await record(recipe.path)).sha256,
          recipe.sha256,
          'Wizard source differs from sealed recipe',
        );
        const languageRecipe = installation.recipe.inputs.find(
          (item) =>
            item.path ===
            'apps/desktop/installation/languages/ChineseSimplified.isl',
        );
        assert.ok(
          languageRecipe,
          'Frozen complete Simplified Chinese language binding required',
        );
        const languageRecord = await record(
          inside(repository, languageRecipe.path),
        );
        assert.equal(
          languageRecord.sha256,
          languageRecipe.sha256,
          'Complete Chinese language differs from sealed recipe',
        );
        assert.equal(
          languageRecord.bytes,
          languageRecipe.bytes,
          'Complete Chinese language length differs from sealed recipe',
        );
        const launchDirectory = join(work, '安装包 目录');
        await mkdir(launchDirectory);
        const copy = join(launchDirectory, basename(installer));
        await copyFile(installer, copy);
        assert.equal((await record(copy)).sha256, original.sha256);
        const unknown = join(launchDirectory, '朋友资料.txt');
        await writeFile(
          unknown,
          'TableMax wizard cancellation preservation fixture\n',
          { flag: 'wx' },
        );
        report.preservedUnknown = await record(unknown);
        const migrationFixtures = [];
        async function createConfigFixture(directory) {
          await noLinks(directory);
          await mkdir(directory, { recursive: false });
          const config = join(directory, 'TableMax.config.json');
          await writeFile(config, '{"dataDirectory":"."}\n', { flag: 'wx' });
          const marker = join(directory, '仅向导输入.txt');
          await writeFile(
            marker,
            'Wizard navigation only; no saved data or installation.\n',
            { flag: 'wx' },
          );
          migrationFixtures.push(await record(config), await record(marker));
        }
        await createConfigFixture(plan.migrationSource);
        const automaticMigrationRoot = join(launchDirectory, 'TableMax');
        if (migrationSource === 'present')
          await createConfigFixture(automaticMigrationRoot);
        else
          assert.equal(
            await lstat(automaticMigrationRoot)
              .then(() => true)
              .catch((error) => {
                if (error.code === 'ENOENT') return false;
                throw error;
              }),
            false,
            'Absent automatic migration source must not be synthesized',
          );
        report.migrationFixtures = {
          case: migrationSource,
          automaticRoot: automaticMigrationRoot,
          manualRoot: plan.migrationSource,
          files: migrationFixtures,
          boundary:
            'Legal config format for wizard path selection only; no program start, commit, database or copied old data.',
        };
        report.plannedLayout = {
          root: plan.target,
          boxRoot: join(plan.target, 'data'),
          runtimeRoot: join(plan.target, 'data', 'app'),
          observedInstalled: false,
        };
        Object.assign(plan, {
          installer: copy,
          installerSha256: original.sha256,
          productId: manifest.productId,
        });
        report.delivery = {
          record: await record(deliveryPath),
          original,
          launchCopy: await record(copy),
          installationManifest: manifestRecord,
          productId: manifest.productId,
          buildVersion: manifest.buildVersion,
          wizardSource: recipe,
          languageSource: languageRecipe,
        };
      }
      const planPath = join(work, 'plan.json');
      await writeFile(planPath, JSON.stringify(plan, null, 2) + '\n');
      const run = await execute(
        executable,
        ['--plan', planPath],
        environment,
        work,
      );
      await writeFile(join(evidence, 'run.log'), run.output);
      report.execution = { ...run, output: undefined };
      const raw = JSON.parse(await readFile(join(work, 'result.json'), 'utf8'));
      report.windowVerification = raw;
      report.screenshots = [];
      for (const capture of raw.captures ?? []) {
        const path = inside(captures, capture.path);
        await noLinks(path);
        report.screenshots.push(
          await saveVerificationScreenshot(
            join(evidence, basename(path)),
            await readFile(path),
            {
              mustKeep: true,
              failure: capture.failure,
              context: {
                mode: plan.mode,
                processId: capture.processId,
                windowHandle: capture.windowHandle,
                method: 'PrintWindow',
                page: capture.page,
                dpi: capture.dpi,
                windowRect: capture.windowRect,
                pngSize: { width: capture.width, height: capture.height },
                captureDpiContext: capture.captureDpiContext,
              },
            },
          ),
        );
      }
      assert.equal(run.timedOut, false, 'Private desktop harness timed out');
      assert.equal(run.code, 0, raw.error ?? 'Wizard harness failed');
      assert.equal(raw.passed, true);
      if (!probeOnly) {
        const required = entryOnly
          ? [
              'updater-first-chinese-feedback-before-native',
              'updater-managed-native-argv-and-exits',
              'helper-no-argument-chinese-guidance-and-exit',
              'entry-inputs-and-unknown-preserved',
            ]
          : [
              'actual-initial-directory-and-exact-notice',
              'desktop-task-on-off',
              'migration-default-unchecked-and-skip',
              'migration-auto-source-' + migrationSource,
              'migration-manual-source-preserved-and-controlled',
              'ready-observed-without-install-invocation',
              'back-retains-target-and-shortcut-choice',
              'owned-cancel-confirmation',
              'no-registration-or-target-after-cancel',
            ];
        const names = raw.checks.map((check) => check.name);
        assert.equal(
          new Set(names).size,
          names.length,
          'Duplicate wizard observation id',
        );
        for (const name of required)
          assert.equal(
            raw.checks.find((check) => check.name === name)?.passed,
            true,
            'Required actual wizard observation missing: ' + name,
          );
      }
      assert.equal(
        raw.remainingOwnProcesses,
        0,
        'Own installer process remains',
      );
      if (!entryOnly)
        assert.equal(
          await lstat(plan.target)
            .then(() => true)
            .catch((error) => {
              if (error.code === 'ENOENT') return false;
              throw error;
            }),
          false,
          'Browsing created an installation target',
        );
      report.workFiles = await inventory(work);
      if (!entryOnly)
        assert.ok(
          !report.workFiles.some(
            (item) =>
              item.path !== report.delivery?.launchCopy.path &&
              /(?:^|\/)(?:TableMax\.exe|UpdateHelper\.exe|Updater\.exe|unins\d+\.(?:exe|dat)|\.install\.json|\.installation(?:-manifest|-identity)?\.json)$/i.test(
                item.name,
              ),
          ),
          'Owned installation member appeared during browsing',
        );
      if (report.delivery)
        assert.deepEqual(
          await record(report.delivery.original.path),
          report.delivery.original,
          'Original sealed installer changed',
        );
      if (report.preservedUnknown)
        assert.deepEqual(
          await record(report.preservedUnknown.path),
          report.preservedUnknown,
          'Unknown source-directory file changed',
        );
      if (report.migrationFixtures) {
        for (const expected of report.migrationFixtures.files)
          assert.deepEqual(
            await record(expected.path),
            expected,
            'Wizard migration input changed',
          );
        assert.equal(
          await lstat(report.migrationFixtures.automaticRoot)
            .then(() => true)
            .catch((error) => {
              if (error.code === 'ENOENT') return false;
              throw error;
            }),
          migrationSource === 'present',
          'Automatic migration source state changed during cancellation',
        );
      }
      if (report.entry) {
        for (const expected of [
          report.entry.sourceDelivery,
          report.entry.sourceOuter,
          report.entry.frozenManifest,
          report.entry.identity,
          report.entry.native,
          report.entry.unknown,
          ...report.entry.methodSources,
          ...report.entry.sourcePes.flatMap((item) => [
            item.source,
            item.executionCopy,
          ]),
        ]) {
          const { path, bytes, sha256 } = expected;
          assert.deepEqual(
            await record(path),
            { path, bytes, sha256 },
            'Entry source, synthetic identity or unknown material changed',
          );
        }
        report.entry.argvReceipt = await record(plan.receipt);
      }
      report.result = entryOnly
        ? 'updater-helper-entry-component-passed'
        : probeOnly
          ? 'api-probe-passed-not-installer-proof'
          : 'actual-wizard-cancel-passed';
    }
    report.failureDomain = null;
    assert.deepEqual(
      await record(source),
      sourceRecord,
      'Harness source changed',
    );
    assert.deepEqual(
      await record(fileURLToPath(import.meta.url)),
      driverRecord,
      'Driver source changed',
    );
  } catch (error) {
    report.failures += 1;
    report.result = 'failed';
    report.error = error.stack ?? error.message;
  } finally {
    report.finishedAtUtc = new Date().toISOString();
    await writeFile(
      join(evidence, 'report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
  }
  return {
    result: report.result,
    failures: report.failures,
    report: join(evidence, 'report.json'),
    work,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const value = (name) =>
    args
      .find((item) => item.startsWith('--' + name + '='))
      ?.slice(name.length + 3);
  assert.ok(
    args.every(
      (item) =>
        ['--compile-only', '--probe-only', '--updater-entry'].includes(item) ||
        /^--(?:delivery|evidence|migration-source)=.+/.test(item),
    ),
    'Unknown wizard argument',
  );
  const result = await verifyInstallerWizard({
    deliveryPath: value('delivery'),
    evidence: value('evidence'),
    compileOnly: args.includes('--compile-only'),
    probeOnly: args.includes('--probe-only'),
    entryOnly: args.includes('--updater-entry'),
    migrationSource: value('migration-source') ?? 'absent',
  });
  console.log(JSON.stringify(result));
  assert.equal(result.failures, 0);
}
