import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
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

const productIds = [
  '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}',
  '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}',
];
const source = 'tools/test/installation/verify-installer-wizard.cs';
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

/** Reads a real installer wizard on a private desktop; never invokes Install. */
export async function verifyInstallerWizard({
  deliveryPath,
  evidence,
  compileOnly = false,
  probeOnly = false,
}) {
  assertWorkspaceRoot();
  assert.equal(process.platform, 'win32');
  assert.ok(!(compileOnly && probeOnly), 'Choose one preparation mode');
  assert.ok(
    compileOnly || probeOnly || deliveryPath,
    'Sealed delivery record required',
  );
  const repository = resolve('.');
  evidence = inside(resolve('artifacts/maintenance'), evidence);
  await noLinks(evidence);
  await noLinks(resolve('tmp'));
  await mkdir(dirname(evidence), { recursive: true });
  await mkdir(evidence, { recursive: false });
  await mkdir(resolve('tmp'), { recursive: true });
  const work = await mkdtemp(join(resolve('tmp'), 'installer-wizard-'));
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
    DOTNET_CLI_HOME: resolve('.cache/dotnet-home'),
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
    failures: 0,
    failureLimit: 3,
    source: sourceRecord,
    driver: driverRecord,
    boundary:
      'Actual own-process windows rendered on an unswitched private desktop. Browse, Back and Cancel only; no Install invocation, account creation, UAC, production installation, security-prompt or online-delivery acceptance. The same sealed installer bytes are copied to an isolated Chinese-space source directory and {src} is checked against that actual launch directory.',
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
      const plan = {
        schemaVersion: 1,
        mode: probeOnly ? 'api-probe' : 'installer-wizard',
        work,
        temporary,
        captures,
        target: join(work, '安装 目标'),
        installer: executable,
        installerSha256: report.compilation.executable.sha256,
        productId: productIds[1],
      };
      if (!probeOnly) {
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
      assert.equal(
        raw.remainingOwnProcesses,
        0,
        'Own installer process remains',
      );
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
      assert.ok(
        !report.workFiles.some(
          (item) =>
            item.path !== report.delivery?.launchCopy.path &&
            /(?:^|\/)(?:TableMax\.exe|UpdateHelper\.exe|unins\d+\.(?:exe|dat)|\.installation(?:-manifest|-identity)?\.json)$/i.test(
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
      report.result = probeOnly
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
        ['--compile-only', '--probe-only'].includes(item) ||
        /^--(?:delivery|evidence)=.+/.test(item),
    ),
    'Unknown wizard argument',
  );
  const result = await verifyInstallerWizard({
    deliveryPath: value('delivery'),
    evidence: value('evidence'),
    compileOnly: args.includes('--compile-only'),
    probeOnly: args.includes('--probe-only'),
  });
  console.log(JSON.stringify(result));
  assert.equal(result.failures, 0);
}
