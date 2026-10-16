/** One actual old-fixture installation observed on the existing private desktop harness. */
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  exists,
  noLinks,
  record,
  writeJson,
} from './prepare/handoff-fixture.mjs';
import { resolveWindowsAcceptanceProfile } from '../../shared/windows-acceptance-profile.mjs';

const fixtureId = '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}';

export async function verifyFixtureInstallerProgress({
  root,
  evidence,
  input,
  fixture,
  profile,
  unknown,
  execute,
}) {
  assert.ok(
    profile,
    'GUI progress requires the actual isolated standard profile',
  );
  const actualProfile = await resolveWindowsAcceptanceProfile(
    profile.workParent,
  );
  assert.deepEqual(actualProfile, profile);
  const work = dirname(root);
  assert.ok(work.startsWith(profile.workParent + '\\'));
  for (const path of [work, root, input.path]) await noLinks(path);
  assert.equal(fixture.manifest.productId, fixtureId);
  assert.equal(fixture.delivery.executable.installation.productId, fixtureId);
  assert.equal(input.bytes, fixture.delivery.executable.bytes);
  assert.equal(input.sha256, fixture.delivery.executable.sha256);
  assert.equal(
    resolve(input.sourcePath),
    resolve(fixture.delivery.executable.path),
  );
  assert.deepEqual(await record(input.path), {
    path: resolve(input.path),
    bytes: input.bytes,
    sha256: input.sha256,
  });
  assert.deepEqual(await record(unknown.path), unknown);
  const directory = await mkdtemp(join(work, 'installer-wizard-progress-'));
  // Preserve the existing chain's already bounded Inno TEMP depth.
  const temporary = work,
    captures = join(directory, 'captures');
  await mkdir(captures);
  const output = join(evidence, 'installer-progress');
  await mkdir(output);
  const source = resolve('tools/test/installation/verify-installer-wizard.cs');
  const sdk = JSON.parse(await readFile('global.json', 'utf8')).sdk.version;
  const dotnet = join(
    process.env.ProgramFiles ?? 'C:/Program Files',
    'dotnet/dotnet.exe',
  );
  const compiler = join(dirname(dotnet), 'sdk', sdk, 'Roslyn/bincore/csc.dll');
  const refs = resolve(
    '.cache/nuget/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8',
  );
  const executable = join(directory, 'InstallerProgressObserver.exe');
  const resultPath = join(directory, 'result.json'),
    logPath = join(directory, 'installer.log');
  const planPath = join(directory, 'plan.json');
  await writeJson(planPath, {
    schemaVersion: 1,
    mode: 'installer-progress',
    work,
    temporary,
    captures,
    target: root,
    installer: input.path,
    installerBytes: input.bytes,
    installerSha256: input.sha256,
    productId: fixtureId,
    ownerSid: profile.ownerSid,
    profileRoot: profile.root,
    result: resultPath,
    log: logPath,
    unknownSha256: unknown.sha256,
  });
  const report = {
    schemaVersion: 1,
    kind: 'actual-fixture-installer-gui-progress',
    result: 'running',
    executionProfile: profile,
    input,
    plan: await record(planPath),
    sources: [
      await record(source),
      await record(fileURLToPath(import.meta.url)),
    ],
    sdk,
    compiler,
    references: refs,
    captures: [],
    boundary:
      'The original ordinary/default-D old-fixture install executes once with /SILENT on an unswitched private desktop and own Job. Actual Chinese labels, native progress-control style/position/range and PrintWindow PNG are observed. This is neither simulated progress nor a new production-GUID/account scenario; the original handoff retains registration, identity, save and uninstall checks.',
  };
  let run;
  try {
    const compilation = await execute(
      dotnet,
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
        source,
      ],
      'installer-progress-compile',
      120000,
      { TEMP: temporary, TMP: temporary },
    );
    report.compilation = compilation;
    assert.equal(compilation.code, 0, compilation.log);
    report.observerExecutable = await record(executable);
    run = await execute(
      executable,
      ['--plan', planPath],
      'installer-progress-observer',
      360000,
      {
        TEMP: temporary,
        TMP: temporary,
        TABLEMAX_INSTALLATION_HEALTH_CHECK: '1',
        TABLEMAX_HOST: '127.0.0.1',
        TABLEMAX_PORT: '0',
        TABLEMAX_TEST_AUDIO: '0',
      },
    );
    report.observer = run;
    const observed = JSON.parse(await readFile(resultPath, 'utf8'));
    report.actual = observed;
    assert.equal(run.code, 0, run.log);
    assert.equal(observed.passed, true, observed.error);
    assert.equal(observed.mode, 'installer-progress');
    assert.equal(observed.ownerSid, profile.ownerSid);
    assert.equal(observed.installerExit.exitCode, 0);
    assert.equal(observed.installerExit.handleHeld, true);
    assert.equal(observed.installerExit.actualProcessExited, true);
    assert.equal(observed.installer.sha256, input.sha256);
    assert.equal(observed.installer.bytes, input.bytes);
    assert.equal(resolve(observed.installer.modulePath), resolve(input.path));
    assert.equal(observed.installer.switchedDesktop, false);
    assert.equal(observed.progressWindowOwner.originalProcessHandleHeld, true);
    assert.equal(observed.naturalJobDrain, true);
    assert.equal(observed.remainingOwnProcesses, 0);
    assert.deepEqual(observed.cleanupTerminatedOwnProcesses, []);
    assert.equal(observed.restoredOriginalDesktop, true);
    assert.equal(observed.closedPrivateDesktop, true);
    assert.ok(observed.progressSamples.some((sample) => sample.marquee));
    assert.ok(
      observed.progressSamples.some(
        (sample) =>
          sample.fileCountMatched &&
          !sample.marquee &&
          sample.position > 0 &&
          sample.minimum === 0 &&
          sample.maximum === 65535 &&
          sample.stableFileCountText &&
          sample.fileCompleted > 0 &&
          sample.fileCompleted <= sample.fileTotal &&
          Math.abs(sample.quantizationResidual) <= 1,
      ),
    );
    for (const phase of [
      'installer-progress-marquee',
      'installer-progress-file-count',
    ])
      assert.ok(
        observed.captures.some(
          (capture) => capture.page === phase && !capture.failure,
        ),
      );
    const log = await readFile(logPath, 'utf8');
    assert.ok(log.includes('TableMax coordinator finished with exit code: 0'));
    const progress = [
      ...log.matchAll(
        /TABLEMAX-INSTALL-PROGRESS-V1\|([a-z]+)\|([0-9]+)\|([0-9]+)/g,
      ),
    ].map((match) => ({
      phase: match[1],
      completed: Number(match[2]),
      total: Number(match[3]),
    }));
    for (const phase of ['stage', 'switch']) {
      const counts = progress.filter((value) => value.phase === phase);
      assert.ok(
        counts.some((value) => value.completed === 0 && value.total > 0),
      );
      assert.ok(
        counts.some(
          (value) => value.completed === value.total && value.total > 0,
        ),
      );
      assert.ok(
        counts.every(
          (value, index) =>
            value.completed <= value.total &&
            (index === 0 || value.completed >= counts[index - 1].completed),
        ),
      );
    }
    assert.ok(progress.some((value) => value.phase === 'confirmed'));
    report.progressLog = progress;
    report.result = 'passed';
  } catch (error) {
    report.result = 'failed';
    report.error = error.message;
    throw error;
  } finally {
    // Account/profile cleanup must never erase the actual log or pixel evidence,
    // including when an observation fails after the installation itself succeeded.
    if (await exists(logPath)) {
      const destination = join(evidence, 'old-inno.log');
      await noLinks(destination);
      assert.equal(await exists(destination), false);
      await copyFile(logPath, destination);
      report.installerLog = await record(destination);
    }
    if (await exists(resultPath)) {
      const destination = join(output, 'native-observer-result.json');
      await copyFile(resultPath, destination);
      report.observerResult = await record(destination);
      const observed = JSON.parse(await readFile(resultPath, 'utf8'));
      for (const capture of observed.captures ?? []) {
        await noLinks(capture.path);
        assert.ok(resolve(capture.path).startsWith(captures + '\\'));
        const destination = join(
          output,
          capture.page + '-' + report.captures.length + '.png',
        );
        await copyFile(capture.path, destination);
        report.captures.push({
          ...capture,
          originalPath: capture.path,
          ...(await record(destination)),
        });
      }
    }
    report.finishedAtUtc = new Date().toISOString();
    await writeJson(join(output, 'report.json'), report);
  }
  return {
    code: 0,
    log: report.installerLog.path,
    guiProgress: {
      report: await record(join(output, 'report.json')),
      ...report,
    },
  };
}
